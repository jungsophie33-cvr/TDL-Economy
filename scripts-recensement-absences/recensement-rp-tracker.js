/*
 * recensement-rp-tracker.js — Suivi des RPs pour le recensement mensuel · TDL
 *
 * Résumé : Écoute sessionStorage "ecoJustPosted" (posé par eco-gain.js) et,
 * si le forum est dans les zones RP, met à jour dernier_rp et rp_par_mois
 * dans le JSONBin. Délai 5s > délai eco-gain.js (3.5s) pour éviter la collision.
 *
 * CARTE DES BLOCS :
 *   UTILS   — source RP_ZONES, détection forum, clé de mois
 *   TRACKER — patch JSONBin après RP confirmé
 *   INIT    — écoute window.load
 *
 * PATCH eco-gain.js requis (une ligne après la déclaration de RP_ZONES) :
 *   window.EcoCore.RP_ZONES = RP_ZONES;
 */

(function () {
  "use strict";

  /* === UTILS === */

  function pret() {
    return window.RC?.CFG && window.EcoCore?.readBin && window.EcoCore?.getPseudo;
  }

  // Priorité : RP_ZONES exposé par eco-gain via EcoCore ; fallback : config locale
  // [MAJ] Appliquer le patch eco-gain.js pour éviter la désynchronisation
  function getZonesRP() {
    return window.EcoCore?.RP_ZONES ?? window.RC.CFG.RP_ZONES_FALLBACK;
  }

  function estForumRP(forumId) {
    if (!forumId) return false;
    const path = String(forumId).toLowerCase();
    return getZonesRP().some(z => path.includes(z));
  }

  function estEdition(mode) {
    return ["editpost", "delete"].includes((mode || "").toLowerCase());
  }

  function cleMois(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  /* === TRACKER === */

  async function trackerRP(data) {
    if (!pret()) return;
    if (estEdition(data.mode)) return;
    if (!estForumRP(data.forumId)) return;

    const pseudo = window.EcoCore.getPseudo();
    if (!pseudo || pseudo.toLowerCase() === "anonymous") return;

    try {
      const rec = await window.EcoCore.readBin();
      if (!rec?.membres?.[pseudo]) return;

      const maintenant = new Date();
      const mois       = cleMois(maintenant);

      rec.membres[pseudo].dernier_rp = maintenant.toISOString();

      // rp_par_mois est un objet clé/valeur — stable sous Firebase (pas un tableau)
      if (!rec.membres[pseudo].rp_par_mois || Array.isArray(rec.membres[pseudo].rp_par_mois)) {
        rec.membres[pseudo].rp_par_mois = {};
      }
      rec.membres[pseudo].rp_par_mois[mois] =
        (rec.membres[pseudo].rp_par_mois[mois] || 0) + 1;

      await window.EcoCore.writeBin(rec);
    } catch (_) {
      // Silencieux : le tracker est secondaire
    }
  }

  /* === INIT === */

  window.addEventListener("load", () => {
    setTimeout(() => {
      const s = sessionStorage.getItem("ecoJustPosted");
      if (!s) return;
      try {
        const data = JSON.parse(s);
        if (Date.now() - (data.t || 0) > 45000) return;
        trackerRP(data);
      } catch (_) {}
    }, 5000);
  });

})();
