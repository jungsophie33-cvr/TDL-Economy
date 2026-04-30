/*
 * recensement-config.js — Configuration du recensement mensuel · TDL
 *
 * Résumé : Bloc unique de configuration. Tous les sélecteurs FA, les chemins
 * de forums RP, les textes UI et les seuils temporels sont ici. Aucune logique.
 *
 * CARTE DES BLOCS :
 *   CONFIG — constantes, sélecteurs, seuils, zones RP (fallback)
 *   TEXTES — tous les textes visibles dans l'interface
 *
 * PATCH eco-gain.js requis (une ligne, après la déclaration de RP_ZONES) :
 *   window.EcoCore.RP_ZONES = RP_ZONES;
 * Sans ce patch, recensement-rp-tracker.js utilise RP_ZONES_FALLBACK ci-dessous.
 */

(function () {
  "use strict";

  window.RC = window.RC || {};

  /* === CONFIG === */

  window.RC.CFG = {
    // Slugs des sujets dédiés [MAJ si les topics changent]
    TOPIC_SLUG:         "/t66-",
    TOPIC_ABSENCE_SLUG: "/t68-",

    /*
     * [MAJ] Sélecteurs dépendants du thème sj-* et de ForumActif.
     * ZONE_RECENSEMENT / ZONE_ABSENCE : divs créées manuellement en HTML dans
     * le 1er post de chaque topic par l'admin.
     * TEXTAREA_REPONSE : textarea interne de SCEditor dans la réponse rapide.
     */
    SEL: {
      ZONE_RECENSEMENT: ".zone-recensement",
      ZONE_ABSENCE:     ".zone-absence",
      TEXTAREA_REPONSE: "#quick_reply .sceditor-container textarea", // [MAJ]
    },

    // Source de vérité des zones RP : constante RP_ZONES dans eco-gain.js.
    // Lue via window.EcoCore.RP_ZONES si le patch eco-gain est appliqué.
    // [MAJ] Sinon, synchroniser manuellement avec eco-gain.js.
    RP_ZONES_FALLBACK: [
      "/f7-les-bayous-sauvages",
      "/f8-downtown-houma",
      "/f9-bayou-cane",
      "/f10-bayou-blue",
      "/f11-mandalay-national-wildlife-refuge",
      "/f12-terrebonne-bay",
      "/f36-la-louisiane",
      "/f37-la-nouvelle-orleans",
      "/f45-baton-rouge",
      "/f29-bourg",
      "/f30-ashland",
      "/f31-montegut",
      "/f38-le-reste-du-monde",
    ],

    JOUR_RECENSEMENT:    25,
    SEUIL_ABSENCE_JOURS: 15,  // jours avant qu'une absence devienne "absence longue"
    SEUIL_FICHE_TARD:    15,  // fiche validée à partir du 15 → recensé sans RP requis

    // [MAJ] Pseudos avec accès au panel staff et aux overrides
    STAFF_USERS: ["Mami Wata", "Jason Blackford"],
  };

  /* === TEXTES === */

  window.RC.T = {
    TITRE_RECENSES: "✅ Membres recensés",
    TITRE_DANGER:   "⚠️ Membres en danger",
    TITRE_ABSENTS:  "🌙 Membres absents",
    TITRE_NOUVEAUX: "🆕 Fiches validées après le 15",

    BTN_GENERER:      "📋 Générer le snapshot du 25",
    BTN_FINALISER:    "📌 Publier la liste finale (1er du mois)",
    BTN_VERS_RECENSE: "↑ Recenser",
    BTN_VERS_DANGER:  "↓ Mettre en danger",

    BTN_ABSENCE:  "✈️ Déclarer une absence",
    BTN_RETOUR:   "✅ Je suis de retour",
    BTN_PROLONGER:"⏳ Prolonger mon absence",
    LABEL_DEBUT:  "Date de début",
    LABEL_FIN:    "Date de fin estimée",
    LABEL_RAISON: "Raison (optionnel, visible du staff)",

    ERR_DONNEES: "❌ Impossible de charger les données. Réessayez.",
    OK_ABSENCE:  "✅ Absence enregistrée.",
    OK_RETOUR:   "✅ Retour enregistré. Bon RP !",
    OK_PROLONGE: "✅ Absence prolongée.",
    OK_GENERE:   "✅ Snapshot généré — BBCode prêt dans la réponse rapide ci-dessous.",
    OK_FINALISE: "✅ Liste finale enregistrée.",
    DEJA_GENERE: (d) => `ℹ️ Snapshot déjà généré le ${d}. Les overrides restent actifs.`,
    PAS_LE_25:   "Le snapshot est disponible uniquement le 25 du mois.",
    PAS_LE_1ER:  "La liste finale est disponible uniquement le 1er du mois suivant.",
  };

})();
