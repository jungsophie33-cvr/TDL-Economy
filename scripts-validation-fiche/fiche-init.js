/*
 * fiche-init.js — Point d'entrée du système de validation de fiche · TDL
 *
 * CE QUE CE FICHIER FAIT : attend que EcoCore, les modules FI ET la div .validation-fiche
 * soient tous disponibles, puis initialise le panel staff et le bouton membre.
 * La div est rendue dynamiquement par le thème sj-* après le chargement des scripts —
 * il faut donc réessayer jusqu'à ce qu'elle soit présente dans le DOM.
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

  // On attend trois conditions simultanées :
  //   1. EcoCore prêt (readBin + getPseudo)
  //   2. Modules FI prêts (initMembre + initStaff)
  //   3. La div .validation-fiche présente dans le DOM
  //
  // Le thème sj-* peut injecter la div après les scripts → on ne peut pas
  // simplement mettre un délai fixe. On réessaie toutes les 300ms jusqu'à 30s.

  let _fait = false; // garde-fou : init ne s'exécute qu'une seule fois

  const attente = setInterval(() => {
    if (_fait) { clearInterval(attente); return; }

    const ecoPret  = window.EcoCore?.readBin    && window.EcoCore?.getPseudo;
    const fiPret   = window.FI?.initMembre      && window.FI?.initStaff;
    // [MAJ] TOPIC_SLUG et ZONE_INJECTION définis dans fiche-config.js
    const surPage  = window.FI?.CFG?.TOPIC_SLUG && location.href.includes(window.FI.CFG.TOPIC_SLUG);
    const ancrage  = surPage ? document.querySelector(window.FI.CFG.SEL.ZONE_INJECTION) : null;

    if (ecoPret && fiPret && surPage && ancrage) {
      clearInterval(attente);
      _fait = true;
      init(ancrage);
    }
  }, 300);

  // Sécurité : arrêt après 30s pour ne pas consommer des ressources indéfiniment
  setTimeout(() => clearInterval(attente), 30000);

  function init(ancrage) {
    const pseudo = window.EcoCore.getPseudo();
    if (!pseudo || pseudo.toLowerCase() === "anonymous") return;

    const estStaff = (window.EcoCore.ADMIN_USERS || []).includes(pseudo)
      || window.FI.CFG.STAFF_USERS.includes(pseudo);

    // Le panel staff précède le bouton membre
    if (estStaff) window.FI.initStaff(ancrage);
    window.FI.initMembre(ancrage, pseudo);
  }

})();
