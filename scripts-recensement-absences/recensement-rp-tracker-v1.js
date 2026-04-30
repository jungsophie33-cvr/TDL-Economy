/*
 * recensement-rp-tracker.js — Suivi des RPs pour le recensement mensuel · TDL
 *
 * Résumé : Détecte un RP posté en zone RP et incrémente rp_par_mois dans Firebase.
 *
 * PROBLÈME DE TIMING résolu dans cette version :
 *   eco-gain.js lit "ecoJustPosted" à +3 500ms puis SUPPRIME la clé.
 *   Si le tracker lit aussi à +5 000ms → clé absente → rien ne s'écrit.
 *
 * SOLUTION — deux phases séparées :
 *   Phase 1 (+500ms)  : lire et mémoriser le forumId depuis sessionStorage,
 *                       AVANT qu'eco-gain le supprime à +3 500ms.
 *   Phase 2 (+5 000ms): écrire dans Firebase APRÈS qu'eco-gain a terminé
 *                       sa propre écriture (~+3 500ms), évite les collisions.
 *
 * CARTE DES BLOCS :
 *   UTILS   — zones RP, détection forum, clé de mois
 *   TRACKER — écriture Firebase (rp_par_mois + dernier_rp)
 *   INIT    — deux setTimeout sur window.load (500ms et 5000ms)
 *
 * PATCH eco-gain.js recommandé (une ligne après la déclaration de RP_ZONES) :
 *   window.EcoCore.RP_ZONES = RP_ZONES;
 */

(function () {
  "use strict";

  /* === UTILS === */

  function pret() {
    return window.RC?.CFG && window.EcoCore?.readBin && window.EcoCore?.getPseudo;
  }

  function getZonesRP() {
    return window.EcoCore?.RP_ZONES ?? window.RC?.CFG?.RP_ZONES_FALLBACK ?? [];
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

  // Appelé uniquement après avoir confirmé que le post est dans une zone RP.
  // Lit Firebase, incrémente rp_par_mois et dernier_rp, réécrit.
  // L'appel à +5 000ms garantit qu'eco-gain a terminé son écriture (~+3 500ms).
  async function ecrireRP() {
    if (!pret()) return;

    const pseudo = window.EcoCore.getPseudo();
    if (!pseudo || pseudo.toLowerCase() === "anonymous") return;

    try {
      const rec = await window.EcoCore.readBin();
      if (!rec?.membres?.[pseudo]) return;

      const mois = cleMois(new Date());

      rec.membres[pseudo].dernier_rp = new Date().toISOString();

      // rp_par_mois : objet clé/valeur (jamais un tableau) — stable sous Firebase
      if (!rec.membres[pseudo].rp_par_mois ||
          Array.isArray(rec.membres[pseudo].rp_par_mois)) {
        rec.membres[pseudo].rp_par_mois = {};
      }
      rec.membres[pseudo].rp_par_mois[mois] =
        (rec.membres[pseudo].rp_par_mois[mois] || 0) + 1;

      await window.EcoCore.writeBin(rec);
    } catch (_) {
      // Silencieux : le tracker est secondaire, un échec ne perturbe pas le forum
    }
  }

  /* === INIT === */

  window.addEventListener("load", () => {
    // Phase 1 — +500ms : lire le forumId AVANT qu'eco-gain supprime la clé (+3 500ms).
    // On stocke localement si c'est un RP en zone valide.
    let rpDetecte = false;

    setTimeout(() => {
      const s = sessionStorage.getItem("ecoJustPosted");
      if (!s) return;
      try {
        const data = JSON.parse(s);
        if (Date.now() - (data.t || 0) > 45000) return; // event trop vieux
        if (estEdition(data.mode)) return;
        if (!estForumRP(data.forumId)) return;
        rpDetecte = true; // forumId validé, on attendra la Phase 2
      } catch (_) {}
    }, 500);

    // Phase 2 — +5 000ms : écrire dans Firebase.
    // eco-gain a terminé son écriture à ~+3 500ms — pas de collision.
    setTimeout(() => {
      if (!rpDetecte) return;
      ecrireRP();
    }, 5000);
  });

})();
