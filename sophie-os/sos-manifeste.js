/* =============================================================
   SOS — Sophia OS · MANIFESTE DES ANNEXES (sos-manifeste.js)
   -------------------------------------------------------------
   Table déclarative des GRANDS SUJETS d'annexes. Elle alimente :
     • le sommaire général (bouton à côté de l'accueil forum) ;
     • la navigation in-page entre topics (chargement sans reload,
       donc sans coupure de l'ambiance sonore).

   >>> Ce fichier est fait pour être édité à la main. <<<
   Pour AJOUTER une annexe : copie un bloc { … } et complète les
   champs. Pour la RETIRER : supprime son bloc. Pour la DÉPLACER :
   change sa place dans le tableau — l'ordre du tableau = l'ordre
   d'affichage des cartes du sommaire.

   Champs d'une entrée :
     titre     (obligatoire) — nom affiché sur la carte du sommaire
     soustitre (facultatif)  — une ligne qui éclaire le contenu de
                               l'annexe pour le joueur
     url       (obligatoire) — adresse du topic, MÊME ORIGINE, qui
                               commence par « / ». Copie-la depuis la
                               barre d'adresse du topic, ex. :
                               '/t123-les-communautes'
     icone     (facultatif)  — classe Flaticon, ex. 'fi-tr-compass'.
                               Laisse la chaîne vide '' si aucune.

   IMPORTANT — ordre de chargement des scripts :
     ce fichier doit être chargé APRÈS sos-core.js, car le noyau
     réassigne window.SOS à l'initialisation. Ordre conseillé :
       sos-core.js  →  sos-manifeste.js  →  sos-blocs.js  →  sos-annexe.js
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { console.error('sos-manifeste.js : sos-core.js doit être chargé avant.'); return; }

  SOS.manifeste = [

    {
      titre:     'Les Communautés',
      soustitre: 'Les groupes de TDL',
      url:       'https://thedrownedlands.forumactif.com/t38-03-les-communautes',          // ← REMPLACER par l'URL réelle du topic
      icone:     'fi-tr-people-group'
    },

    {
      titre:     'Les Bandes hors-la-loi',
      soustitre: 'Les organisations clandestines',
      url:       'https://thedrownedlands.forumactif.com/t32-les-bandes-hors-la-loi',          // ← REMPLACER par l'URL réelle du topic
      icone:     'fi-tr-skull'
    }

    // Gabarit à copier pour une nouvelle annexe (retire les // et complète) :
    // ,{
    //   titre:     '',
    //   soustitre: '',
    //   url:       '/t000-a-remplacer',
    //   icone:     ''
    // }

  ];

})(window);
