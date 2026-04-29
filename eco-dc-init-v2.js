/*
 * eco-dc-init.js — Point d'entrée du système multi-compte · TDL
 *
 * CE QUE CE FICHIER FAIT : attend que EcoCore et les modules DC soient chargés,
 * vérifie qu'on est sur la bonne page, localise la div .demande-dc placée dans
 * le corps du post, et y injecte le panel staff + le bouton de demande.
 * CE QU'IL NE FAIT PAS : aucune logique métier — il orchestre uniquement.
 *
 * ORDRE DE CHARGEMENT (pied de page ForumActif) :
 *   1. eco-dc.css
 *   2. eco-dc-config.js
 *   3. eco-dc-utils.js
 *   4. eco-dc-membre.js
 *   5. eco-dc-staff.js
 *   6. eco-dc-init.js  ← ce fichier, toujours en dernier
 */

(function () {
  "use strict";

  /* === INIT === */

  function init() {
    // [MAJ] TOPIC_SLUG identifie le sujet — à mettre à jour si le sujet est recréé.
    if (!location.href.includes(window.DC.CFG.TOPIC_SLUG)) return;

    const pseudo = window.EcoCore.getPseudo();
    if (!pseudo || pseudo.toLowerCase() === "anonymous") return;

    /*
     * La div .demande-dc est placée manuellement dans le corps du post en HTML.
     * C'est le seul point d'injection — si elle est absente, rien ne s'affiche.
     * [MAJ] Si le sélecteur change, mettre à jour CFG.SEL.ZONE_INJECTION.
     */
    const ancrage = document.querySelector(window.DC.CFG.SEL.ZONE_INJECTION);
    if (!ancrage) return;

    if (window.DC.estStaff()) window.DC.initStaff(ancrage);
    window.DC.initMembre(ancrage, pseudo);
  }

  /* === ATTENTE ECOCORE === */

  const attente = setInterval(() => {
    const ecoCorePreet = window.EcoCore?.readBin && window.EcoCore?.getPseudo;
    const dcPret       = window.DC?.initMembre   && window.DC?.initStaff;
    if (ecoCorePreet && dcPret) {
      clearInterval(attente);
      // [MAJ] Si rien ne s'affiche, augmenter ce délai (le DOM du thème sj-* peut
      // charger ses éléments après le DOMContentLoaded standard).
      setTimeout(init, 600);
    }
  }, 200);

})();
