/*
 * eco-dc-init.js — Point d'entrée du système multi-compte · TDL
 *
 * CE QUE CE FICHIER FAIT : détecte la page courante (sujet DC ou bottin),
 * et initialise les modules correspondants.
 * CE QU'IL NE FAIT PAS : aucune logique métier.
 *
 * ORDRE DE CHARGEMENT :
 *   1. eco-dc.css
 *   2. eco-dc-config.js
 *   3. eco-dc-utils.js
 *   4. eco-dc-membre.js
 *   5. eco-dc-staff.js
 *   6. eco-dc-bottin.js
 *   7. eco-dc-init.js  ← toujours en dernier
 */

(function () {
  "use strict";

  /* === INIT === */

  function init() {
    const url = location.href;

    // [MAJ] Les deux slugs identifient les sujets par leur numéro FA.
    // Si un sujet est recréé, son numéro change — mettre à jour la config.
    if (url.includes(window.DC.CFG.TOPIC_SLUG)) initPageDC();
    if (url.includes(window.DC.CFG.BOTTIN_SLUG)) initPageBottin();
  }

  function initPageDC() {
    const pseudo = window.EcoCore.getPseudo();
    if (!pseudo || pseudo.toLowerCase() === "anonymous") return;

    // [MAJ] ZONE_INJECTION : div placée manuellement dans le post par l'admin
    const ancrage = document.querySelector(window.DC.CFG.SEL.ZONE_INJECTION);
    if (!ancrage) return;

    if (window.DC.estStaff()) window.DC.initStaff(ancrage);
    window.DC.initMembre(ancrage, pseudo);
  }

  function initPageBottin() {
    // [MAJ] ZONE_BOTTIN : div placée manuellement dans le post du bottin par l'admin
    const zone = document.querySelector(window.DC.CFG.SEL.ZONE_BOTTIN);
    if (!zone) return;
    window.DC.initBottin(zone);
  }

  /* === ATTENTE ECOCORE === */

  const attente = setInterval(() => {
    const ecoCorePreet = window.EcoCore?.readBin && window.EcoCore?.getPseudo;
    const dcPret       = window.DC?.initMembre   && window.DC?.initStaff && window.DC?.initBottin;
    if (ecoCorePreet && dcPret) {
      clearInterval(attente);
      // [MAJ] Si le contenu n'apparaît pas, augmenter ce délai (rendu DOM du thème sj-*)
      setTimeout(init, 600);
    }
  }, 200);

})();
