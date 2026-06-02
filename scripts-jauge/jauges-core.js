// === JAUGES DE TERREBONNE — CORE CONFIG ===
// Auteur : Claude x THE DROWNED LANDS
// Charge les données de configuration des trois jauges collectives.
// Ne contient aucune logique Firebase ni DOM.
// Dépendances : aucune.

(function () {
  "use strict";

  // ---------- CONFIG DONNÉES ----------

  window.TDLJauges = window.TDLJauges || {};

  window.TDLJauges.KEYS = [
    "climat_social",
    "activite_clandestine",
    "pression_bayou"
  ];

  window.TDLJauges.CFG = {

    climat_social: {
      label  : "Climat Social",
      color  : "#C97F10",
      fbPath : "jauges/climat_social",
      niveaux: [
        { n: 1, label: "Harmonie relative",  desc: "La cohabitation est paisible entre les communautés." },
        { n: 2, label: "Murmures",           desc: "Des rumeurs et tensions commencent à circuler." },
        { n: 3, label: "Frictions",          desc: "Conflits locaux et rivalités visibles entre groupes." },
        { n: 4, label: "Crise sociale",      desc: "Manifestations, boycotts, sabotages de projets communautaires." },
        { n: 5, label: "Rupture",            desc: "Le conflit devient ouvert entre les communautés de Terrebonne." }
      ]
    },

    activite_clandestine: {
      label  : "Activité Clandestine",
      color  : "#8F565F",
      fbPath : "jauges/activite_clandestine",
      niveaux: [
        { n: 1, label: "Discrétion",              desc: "Les activités illégales sont rarement évoquées." },
        { n: 2, label: "Rumeurs",                 desc: "On parle d'activités clandestines proches de chez nous." },
        { n: 3, label: "Mouvement",               desc: "Les réseaux s'activent, sentiment d'insécurité croissant." },
        { n: 4, label: "Escalade",                desc: "Sabotages et intimidations se multiplient — le bureau du shérif est débordé." },
        { n: 5, label: "Guerre hors de l'ombre",  desc: "Les réseaux en conflit agissent ouvertement dans Terrebonne." }
      ]
    },

    pression_bayou: {
      label  : "Pression du Bayou",
      color  : "#579C8E",
      fbPath : "jauges/pression_bayou",
      niveaux: [
        { n: 1, label: "Équilibre",          desc: "La région est stable." },
        { n: 2, label: "Instabilité",        desc: "Des tensions apparaissent à plusieurs niveaux." },
        { n: 3, label: "Pression",           desc: "Plusieurs crises se superposent dans la région." },
        { n: 4, label: "Tempête imminente",  desc: "La situation devient explosive — une crise majeure approche." },
        { n: 5, label: "Ouragan",            desc: "Crise majeure touchant toute la paroisse de Terrebonne." }
      ]
    }

  };

  console.log("[TDLJauges] Core config chargée.");

})();
