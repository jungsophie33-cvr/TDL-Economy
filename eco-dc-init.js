/*
 * eco-dc-init.js — Point d'entrée du système multi-compte · TDL
 *
 * CE QUE CE FICHIER FAIT : attend que EcoCore et les modules DC soient chargés,
 * vérifie qu'on est sur la bonne page, puis délègue à initStaff / initMembre.
 * CE QU'IL NE FAIT PAS : aucune logique métier — il orchestre uniquement.
 *
 * ORDRE DE CHARGEMENT (dans le pied de page ForumActif) :
 *   1. eco-dc.css       (ou via l'éditeur CSS de ForumActif)
 *   2. eco-dc-config.js
 *   3. eco-dc-utils.js
 *   4. eco-dc-membre.js
 *   5. eco-dc-staff.js
 *   6. eco-dc-init.js   ← ce fichier, toujours en dernier
 */

(function () {
  "use strict";

  function init() {
    // [MAJ] TOPIC_SLUG doit correspondre à l'URL du sujet — à changer en cas de déplacement du sujet
    if (!location.href.includes(window.DC.CFG.TOPIC_SLUG)) return;

    const pseudo = window.EcoCore.getPseudo();
    if (!pseudo || pseudo.toLowerCase() === "anonymous") return;

    // [MAJ] Sélecteur d'ancrage — dépend du thème ForumActif actif (voir CFG.SEL.ANCRAGE_SUJET)
    const ancrage = document.querySelector(window.DC.CFG.SEL.ANCRAGE_SUJET);
    if (!ancrage) return;

    // Le panel staff s'insère avant le formulaire membre pour être lisible en premier
    if (window.DC.estStaff()) window.DC.initStaff(ancrage);
    window.DC.initMembre(ancrage, pseudo);
  }

  // Attend que EcoCore (chargé de façon asynchrone) et les modules DC soient disponibles.
  // L'intervalle se coupe dès que tout est prêt — pas de setTimeout fixe.
  const attente = setInterval(() => {
    const ecoCorePreet = window.EcoCore?.readBin && window.EcoCore?.getPseudo;
    const dcPret       = window.DC?.initMembre && window.DC?.initStaff;
    if (ecoCorePreet && dcPret) {
      clearInterval(attente);
      // Petit délai pour laisser ForumActif terminer son propre rendu DOM
      // [MAJ] Si ForumActif charge son DOM plus lentement, augmenter cette valeur
      setTimeout(init, 500);
    }
  }, 200);

})();
