/*
 * fiche-init.js — Point d'entrée du système de validation de fiche · TDL
 *
 * CE QUE CE FICHIER FAIT : attend que EcoCore et les modules FI soient chargés,
 * vérifie qu'on est sur la bonne page, trouve .validation-fiche et initialise
 * le panel staff (staff uniquement) puis le bouton membre.
 * CE QU'IL NE FAIT PAS : aucune logique métier.
 *
 * ORDRE DE CHARGEMENT (pied de page ForumActif) :
 *   1. fiche.css
 *   2. fiche-config.js
 *   3. fiche-utils.js
 *   4. fiche-membre.js
 *   5. fiche-staff.js
 *   6. fiche-init.js  ← toujours en dernier
 */

(function () {
  "use strict";

  /* === INIT === */

  function init() {
    // [MAJ] TOPIC_SLUG identifie le sujet par son numéro FA — à mettre à jour si recréé.
    if (!location.href.includes(window.FI.CFG.TOPIC_SLUG)) return;

    const pseudo = window.EcoCore.getPseudo();
    if (!pseudo || pseudo.toLowerCase() === "anonymous") return;

    // [MAJ] ZONE_INJECTION : div placée manuellement dans le post par l'admin.
    // À placer dans le premier post du sujet de validation.
    const ancrage = document.querySelector(window.FI.CFG.SEL.ZONE_INJECTION);
    if (!ancrage) return;

    // Le panel staff précède le bouton membre pour être visible en premier
    const estStaff = (window.EcoCore.ADMIN_USERS || []).includes(pseudo)
      || window.FI.CFG.STAFF_USERS.includes(pseudo);
    if (estStaff) window.FI.initStaff(ancrage);

    window.FI.initMembre(ancrage, pseudo);
  }

  /* === ATTENTE ECOCORE === */

  const attente = setInterval(() => {
    const ecoPret = window.EcoCore?.readBin && window.EcoCore?.getPseudo;
    const fiPret  = window.FI?.initMembre   && window.FI?.initStaff;
    if (ecoPret && fiPret) {
      clearInterval(attente);
      // [MAJ] Si rien ne s'affiche, augmenter ce délai (rendu DOM du thème sj-*)
      setTimeout(init, 600);
    }
  }, 200);

})();
