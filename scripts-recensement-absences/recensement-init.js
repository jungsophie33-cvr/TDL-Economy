/*
 * recensement-init.js — Routage et initialisation du recensement · TDL
 *
 * Résumé : Attend EcoCore + modules RC, détecte la page courante,
 * lance le bon module. Pattern identique à fiche-init.js et eco-dc-init.js.
 *
 * CARTE DES BLOCS :
 *   UTILS — détection de page, vérification dépendances
 *   INIT  — boucle d'attente + dispatch
 *
 * Ordre de chargement (pied de page FA, après tous les eco-*.js) :
 *   1. recensement-absence.css    ← chargé en <link> dans le thème
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

  function surPageRecensement() {
    return location.href.includes(window.RC?.CFG?.TOPIC_SLUG || "\x00");
  }

  function surPageAbsence() {
    return location.href.includes(window.RC?.CFG?.TOPIC_ABSENCE_SLUG || "\x00");
  }

  function toutPret() {
    return (
      window.EcoCore?.readBin     &&
      window.EcoCore?.safeReadBin &&
      window.EcoCore?.getPseudo   &&
      window.RC?.CFG?.SEL         &&
      window.RC?.Calcul           &&
      window.RC?.initRender       &&
      window.RC?.initAbsence
    );
  }

  /* === INIT === */

  let _lance = false;

  const attente = setInterval(() => {
    if (_lance) { clearInterval(attente); return; }
    if (!toutPret()) return;

    if (surPageRecensement()) {
      // [MAJ] ZONE_RECENSEMENT défini dans recensement-config.js CFG.SEL
      const zone = document.querySelector(window.RC.CFG.SEL.ZONE_RECENSEMENT);
      if (!zone) return;
      clearInterval(attente);
      _lance = true;
      window.RC.initRender(zone);

    } else if (surPageAbsence()) {
      // [MAJ] ZONE_ABSENCE défini dans recensement-config.js CFG.SEL
      const zone = document.querySelector(window.RC.CFG.SEL.ZONE_ABSENCE);
      if (!zone) return;
      clearInterval(attente);
      _lance = true;
      window.RC.initAbsence(zone);

    } else {
      clearInterval(attente);
    }
  }, 300);

  setTimeout(() => clearInterval(attente), 30000);

})();      window.EcoCore?.safeReadBin &&
      window.EcoCore?.getPseudo   &&
      window.RC?.CFG?.SEL         &&
      window.RC?.Calcul           &&
      window.RC?.initRender       &&
      window.RC?.initAbsence
    );
  }

  /* === INIT === */

  let _lance = false;

  const attente = setInterval(() => {
    if (_lance) { clearInterval(attente); return; }
    if (!toutPret()) return;

    if (surPageRecensement()) {
      // [MAJ] Sélecteur ZONE_RECENSEMENT défini dans recensement-config.js CFG.SEL
      const zone = document.querySelector(window.RC.CFG.SEL.ZONE_RECENSEMENT);
      if (!zone) return; // div pas encore rendue par le thème sj-* — on réessaie
      clearInterval(attente);
      _lance = true;
      window.RC.initRender(zone);

    } else if (surPageAbsence()) {
      // [MAJ] Sélecteur ZONE_ABSENCE défini dans recensement-config.js CFG.SEL
      const zone = document.querySelector(window.RC.CFG.SEL.ZONE_ABSENCE);
      if (!zone) return;
      clearInterval(attente);
      _lance = true;
      window.RC.initAbsence(zone);

    } else {
      // Page hors périmètre du recensement — arrêt propre sans attendre le timeout
      clearInterval(attente);
    }
  }, 300);

  // Sécurité : arrêt au bout de 30s pour ne pas consommer inutilement [MAJ]
  setTimeout(() => clearInterval(attente), 30000);

})();
