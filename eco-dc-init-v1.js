/*
 * eco-dc-init.js — Point d'entrée du système multi-compte · TDL
 *
 * CE QUE CE FICHIER FAIT : attend que EcoCore et les modules DC soient chargés,
 * vérifie qu'on est sur la bonne page, localise le post cible (#251) et y injecte
 * le panel staff (staff uniquement) et le bouton de demande (tous les membres).
 * CE QU'IL NE FAIT PAS : aucune logique métier — il orchestre uniquement.
 *
 * ORDRE DE CHARGEMENT (dans le pied de page ForumActif) :
 *   1. eco-dc.css         (ou via l'éditeur CSS ForumActif)
 *   2. eco-dc-config.js
 *   3. eco-dc-utils.js
 *   4. eco-dc-membre.js
 *   5. eco-dc-staff.js
 *   6. eco-dc-init.js     ← ce fichier, toujours en dernier
 */

(function () {
  "use strict";

  /* === INIT === */

  function init() {
    // [MAJ] TOPIC_SLUG identifie le sujet par son numéro FA (t63-).
    // Si le sujet est recréé, son numéro change — mettre à jour CFG.TOPIC_SLUG.
    if (!location.href.includes(window.DC.CFG.TOPIC_SLUG)) return;

    const pseudo = window.EcoCore.getPseudo();
    if (!pseudo || pseudo.toLowerCase() === "anonymous") return;

    const ancrage = trouverAncrage();
    if (!ancrage) return;

    // Le panel staff s'insère avant le bouton membre pour être lu en premier
    if (window.DC.estStaff()) window.DC.initStaff(ancrage);
    window.DC.initMembre(ancrage, pseudo);
  }

  /*
   * Localise le point d'injection à l'intérieur du post cible.
   *
   * ForumActif attribue l'id "p{N}" à chaque div de post, où N correspond
   * au numéro d'ancre dans l'URL (#251 → id="p251").
   * On cherche le .postbody à l'intérieur de ce post ; c'est là qu'on injecte,
   * afin que le contenu apparaisse visuellement dans le corps du message.
   *
   * [MAJ] Si ForumActif change le schéma d'id des posts (ex : "post-251"),
   *       mettre à jour CFG.SEL.POST_CIBLE dans eco-dc-config.js.
   * [MAJ] Si ForumActif renomme .postbody, mettre à jour CFG.SEL.CONTENU_POST.
   */
  function trouverAncrage() {
    const post = document.querySelector(window.DC.CFG.SEL.POST_CIBLE);
    if (!post) return null;

    // On préfère injecter dans .postbody pour rester dans le flux visuel du post
    return post.querySelector(window.DC.CFG.SEL.CONTENU_POST) || post;
  }

  /* === ATTENTE ECOCORE === */

  // Attend que EcoCore (chargé de façon asynchrone) et les modules DC soient disponibles.
  // L'intervalle se coupe dès que tout est prêt.
  const attente = setInterval(() => {
    const ecoCorePreet = window.EcoCore?.readBin && window.EcoCore?.getPseudo;
    const dcPret       = window.DC?.initMembre   && window.DC?.initStaff;
    if (ecoCorePreet && dcPret) {
      clearInterval(attente);
      // Délai pour laisser ForumActif terminer son propre rendu DOM avant d'injecter.
      // [MAJ] Si le bouton n'apparaît pas, augmenter cette valeur (ex : 800).
      setTimeout(init, 500);
    }
  }, 200);

})();
