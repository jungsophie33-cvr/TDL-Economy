/*
 * recensement-init.js — Routage et initialisation du recensement · TDL
 *
 * Résumé : Suit exactement le pattern de eco-dc-init.js (prouvé fonctionnel) :
 * poll 200ms → clearInterval → setTimeout(init, 600) pour laisser le thème sj-*
 * rendre les divs d'injection. toutPret() allégée : EcoCore + CFG seulement.
 * Les fonctions initRender/initAbsence sont vérifiées dans init() au moment
 * de l'appel, pas avant.
 *
 * CARTE DES BLOCS :
 *   UTILS — toutPret(), détection page, feedback visuel
 *   INIT  — dispatch par page (pattern eco-dc-init.js)
 *
 * Ordre de chargement (pied de page FA, après eco-*.js) :
 *   1. recensement-absence.css  ← <link> dans le thème
 *   2. recensement-config.js
 *   3. recensement-rp-tracker.js
 *   4. recensement-calcul.js
 *   5. recensement-render.js
 *   6. recensement-absence.js
 *   7. recensement-init.js  ← toujours en dernier
 */

(function () {
  "use strict";

  /* === UTILS === */

  // Dépendances minimales — comme eco-dc-init.js.
  // initRender et initAbsence sont vérifiées au moment de init(), pas ici,
  // pour ne pas bloquer si un fichier module a une erreur silencieuse.
  function toutPret() {
    return !!(
      window.EcoCore?.readBin   &&
      window.EcoCore?.getPseudo &&
      window.RC?.CFG?.SEL       &&
      window.RC?.Calcul
    );
  }

  // Affiche "Chargement…" dans la zone dès qu'elle est trouvée,
  // avant même que les données Firebase soient lues.
  function placeholderChargement(zone) {
    if (!zone || zone.dataset.rcInit) return;
    zone.dataset.rcInit = "1";
    zone.innerHTML = "<p class='rc-chargement'>Chargement…</p>";
  }

  /* === INIT === */

  function init() {
    const cfg = window.RC?.CFG;
    if (!cfg) return;

    const url = location.href;

    if (url.includes(cfg.TOPIC_SLUG)) {
      // [MAJ] ZONE_RECENSEMENT défini dans recensement-config.js CFG.SEL
      const zone = document.querySelector(cfg.SEL.ZONE_RECENSEMENT);
      if (!zone) return;
      placeholderChargement(zone);
      if (typeof window.RC?.initRender === "function") {
        window.RC.initRender(zone);
      } else {
        zone.innerHTML = "<p class='rc-erreur'>⚠️ Module recensement-render.js non chargé.</p>";
      }
      return;
    }

    if (url.includes(cfg.TOPIC_ABSENCE_SLUG)) {
      // [MAJ] ZONE_ABSENCE défini dans recensement-config.js CFG.SEL
      const zone = document.querySelector(cfg.SEL.ZONE_ABSENCE);
      if (!zone) return;
      placeholderChargement(zone);
      if (typeof window.RC?.initAbsence === "function") {
        window.RC.initAbsence(zone);
      } else {
        zone.innerHTML = "<p class='rc-erreur'>⚠️ Module recensement-absence.js non chargé.</p>";
      }
      return;
    }

    // Page hors périmètre — rien à faire (pas de clearInterval ici, déjà fait)
  }

  /* === ATTENTE — même pattern que eco-dc-init.js === */

  const attente = setInterval(() => {
    if (toutPret()) {
      clearInterval(attente);
      // [MAJ] 600ms comme eco-dc-init.js : laisse le thème sj-* rendre les divs
      setTimeout(init, 600);
    }
  }, 200);

  // Sécurité : arrêt après 30s [MAJ]
  setTimeout(() => clearInterval(attente), 30000);

})();
