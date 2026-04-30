/*
 * recensement-rp-tracker.js — Suivi des RPs pour le recensement mensuel · TDL
 *
 * Résumé : Écoute sessionStorage "ecoJustPosted" (posé par eco-gain.js) et,
 * si le chemin du forum est dans les zones RP, met à jour dernier_rp et
 * rp_par_mois dans le JSONBin. Source des zones RP : window.EcoCore.RP_ZONES
 * (si le patch eco-gain est appliqué) ou RC.CFG.RP_ZONES_FALLBACK.
 * Délai 5s > délai eco-gain.js (3.5s) pour éviter la collision sur writeBin.
 *
 * CARTE DES BLOCS :
 *   UTILS   — source RP_ZONES, détection forum, clé de mois
 *   TRACKER — patch JSONBin après RP confirmé
 *   INIT    — écoute window.load + lecture sessionStorage
 */

(function () {
  "use strict";

  /* === UTILS === */

  function pret() {
    return window.RC?.CFG && window.EcoCore?.readBin && window.EcoCore?.getPseudo;
  }

  // Préférence : RP_ZONES exposé par eco-gain.js via window.EcoCore.RP_ZONES.
  // Fallback : liste locale dans recensement-config.js.
  // [MAJ] Appliquer le patch eco-gain.js pour éviter la désynchronisation.
  function getZonesRP() {
    return window.EcoCore?.RP_ZONES ?? window.RC.CFG.RP_ZONES_FALLBACK;
  }

  // Le chemin du forum est un path string ("/f7-les-bayous-sauvages"),
  // identique à la valeur stockée par eco-gain.js dans sessionStorage.forumId.
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

    // Un post hors zone RP ne contribue pas au recensement
    if (!estForumRP(data.forumId)) return;

    const pseudo = window.EcoCore.getPseudo();
    if (!pseudo || pseudo.toLowerCase() === "anonymous") return;

    try {
      const rec = await window.EcoCore.readBin();
      if (!rec?.membres?.[pseudo]) return;

      const maintenant = new Date();
      const mois       = cleMois(maintenant);

      rec.membres[pseudo].dernier_rp = maintenant.toISOString();

      // Firebase peut sérialiser rp_par_mois en objet {0: …} → on s'assure
      // que c'est un objet clé/valeur (pas un tableau), ce qui est stable sur Firebase.
      if (!rec.membres[pseudo].rp_par_mois ||
          Array.isArray(rec.membres[pseudo].rp_par_mois)) {
        rec.membres[pseudo].rp_par_mois = {};
      }
      rec.membres[pseudo].rp_par_mois[mois] =
        (rec.membres[pseudo].rp_par_mois[mois] || 0) + 1;

      await window.EcoCore.writeBin(rec);
    } catch (_) {
      // Silencieux : le tracker est secondaire, l'échec ne perturbe pas le forum
    }
  }

  /* === INIT === */

  window.addEventListener("load", () => {
    // 5s > 3.5s de eco-gain.js pour ne pas écrire en même temps dans le JSONBin
    setTimeout(() => {
      const s = sessionStorage.getItem("ecoJustPosted");
      if (!s) return;
      try {
        const data = JSON.parse(s);
        if (Date.now() - (data.t || 0) > 45000) return; // event trop ancien
        trackerRP(data);
      } catch (_) {}
    }, 5000);
  });

})();
