/* =============================================================
   SOS — Sophia OS · MANIFESTE DES ANNEXES (sos-manifeste.js)
   -------------------------------------------------------------
   Table déclarative des GRANDS SUJETS d'annexes. Elle alimente :
     • le sommaire « Guidebook du Bayou » (bouton boussole) ;
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
                               commence par « / », ex. :
                               '/t38-03-les-communautes'
     icone     (facultatif)  — classe Flaticon SOLID (fi-sr-*) pour le
                               filigrane d'angle, ex. 'fi-sr-users-alt'.
                               (nécessite la feuille uicons-solid-rounded)

   IMPORTANT — ordre de chargement des scripts :
     ce fichier doit être chargé APRÈS sos-core.js, car le noyau
     réassigne window.SOS à l'initialisation. Ordre conseillé :
       sos-core.js → sos-manifeste.js → sos-blocs.js → sos-annexe.js → sos-nav.js
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { console.error('sos-manifeste.js : sos-core.js doit être chargé avant.'); return; }

  SOS.manifeste = [

     {
      titre:     'Le Règlement',
      soustitre: 'lecture obligatoire.',
      url:       '/t76-01-le-reglement',
      icone:     'fi-sr-legal-case'
    },
     
    {
      titre:     'Les Communautés',
      soustitre: 'Les groupes de TDL.',
      url:       '/t88-test-plouf',
      icone:     'fi-sr-users-alt'
    },

    {
      titre:     'Les Bandes hors-la-loi',
      soustitre: 'Organisations clandestines jouables.',
      url:       '/t32-les-bandes-hors-la-loi',
      icone:     'fi-sr-skull'
    },

    {
      titre:     'Le Folklore',
      soustitre: 'Croyances, esprits et récits de la paroisse.',
      url:       '/t40-le-folklore',          // ← URL réelle quand le topic existera
      icone:     'fi-sr-moon-stars'
    },

    {
      titre:     'Découvrir Terrebonne',
      soustitre: 'Repères de la région et société.',
      url:       '/t12-terrebonne-parish',          // ← URL réelle quand le topic existera
      icone:     'fi-sr-map'
    },

    {
      titre:     'Le Système de jeu',
      soustitre: 'Intrigues, économie et gameplay.',
      url:       '/t72-le-systeme-de-jeu',          // ← URL réelle quand le topic existera
      icone:     'fi-sr-book-open-cover'
    }

    // Gabarit à copier pour une nouvelle annexe :
    // ,{ titre: '', soustitre: '', url: '/t000-a-remplacer', icone: 'fi-sr-' }

  ];

})(window);
