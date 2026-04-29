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
    // [MAJ] TOPIC_SLUG identifie le sujet — à mettre à jour si le sujet est recréé.
    if (!location.href.includes(window.FI.CFG.TOPIC_SLUG)) return;

    const pseudo = window.EcoCore.getPseudo();
    if (!pseudo || pseudo.toLowerCase() === "anonymous") return;

    // [MAJ] ZONE_INJECTION : div .validation-fiche placée dans le post par l'admin.
    const ancrage = document.querySelector(window.FI.CFG.SEL.ZONE_INJECTION);
    if (!ancrage) {
      // Avertissement visible uniquement pour les admins si la div est absente
      const estStaffDiag = (window.EcoCore.ADMIN_USERS || []).includes(pseudo);
      if (estStaffDiag) {
        const warn = document.createElement("div");
        warn.style.cssText = "background:#fff3cd;border:1px solid #ffc107;padding:8px;margin:8px;border-radius:4px;font-size:.9em;";
        warn.textContent = `⚠️ [Fiche-init] div "${window.FI.CFG.SEL.ZONE_INJECTION}" introuvable dans le post. Ajoutez-la dans le corps du message.`;
        document.body.prepend(warn);
      }
      return;
    }

    const estStaff = (window.EcoCore.ADMIN_USERS || []).includes(pseudo)
      || window.FI.CFG.STAFF_USERS.includes(pseudo);

    try {
      if (estStaff) window.FI.initStaff(ancrage);
    } catch (e) {
      ancrage.innerHTML += `<div style="color:red;padding:8px;">❌ [fiche-staff] Erreur init : ${e.message}</div>`;
    }

    try {
      window.FI.initMembre(ancrage, pseudo);
    } catch (e) {
      ancrage.innerHTML += `<div style="color:red;padding:8px;">❌ [fiche-membre] Erreur init : ${e.message}</div>`;
    }
  }

  /* === ATTENTE ECOCORE === */

  let _tentatives = 0;
  const attente = setInterval(() => {
    _tentatives++;
    const ecoPret = window.EcoCore?.readBin && window.EcoCore?.getPseudo;
    const fiPret  = window.FI?.initMembre   && window.FI?.initStaff;

    if (ecoPret && fiPret) {
      clearInterval(attente);
      // [MAJ] Si le contenu n'apparaît pas, augmenter ce délai (rendu DOM thème sj-*)
      setTimeout(init, 600);
      return;
    }

    // Après 10s sans résolution, afficher un diagnostic dans la console
    if (_tentatives === 50) {
      console.warn("[fiche-init] Modules non prêts après 10s.",
        "EcoCore.readBin:", !!window.EcoCore?.readBin,
        "EcoCore.getPseudo:", !!window.EcoCore?.getPseudo,
        "FI.initMembre:", !!window.FI?.initMembre,
        "FI.initStaff:", !!window.FI?.initStaff
      );
    }
  }, 200);

})();      || window.FI.CFG.STAFF_USERS.includes(pseudo);
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
