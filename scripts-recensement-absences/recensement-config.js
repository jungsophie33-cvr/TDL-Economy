/*
 * recensement-config.js — Configuration du recensement mensuel · TDL
 *
 * Résumé : Source unique de vérité pour sélecteurs FA, seuils temporels,
 * types d'absence et textes visibles. Aucune logique.
 *
 * CARTE DES BLOCS :
 *   CONFIG — constantes, sélecteurs, RP_ZONES fallback
 *   TEXTES — tous les libellés visibles par l'utilisateur
 *
 * PATCH eco-gain.js requis (une ligne après la déclaration de RP_ZONES) :
 *   window.EcoCore.RP_ZONES = RP_ZONES;
 */

(function () {
  "use strict";

  window.RC = window.RC || {};

  /* === CONFIG === */

  window.RC.CFG = {
    TOPIC_SLUG:         "/t66-",
    TOPIC_ABSENCE_SLUG: "/t68-",   // [MAJ] ID du topic absences

    SEL: {
      ZONE_RECENSEMENT: ".zone-recensement",
      ZONE_ABSENCE:     ".zone-absence",
      TEXTAREA_REPONSE: "#quick_reply .sceditor-container textarea", // [MAJ]
    },

    // Types d'absence — clés utilisées dans rec.absences[].type
    TYPES_ABSENCE: {
      ABSENCE:    "absence",
      REDUITE:    "presence_reduite",
      SUPPRESSION:"suppression",
    },

    // Zones RP (source de vérité : window.EcoCore.RP_ZONES si patch appliqué)
    // [MAJ] Synchroniser manuellement avec eco-gain.js si le patch n'est pas appliqué.
    RP_ZONES_FALLBACK: [
      "/f7-les-bayous-sauvages",   "/f8-downtown-houma",
      "/f9-bayou-cane",            "/f10-bayou-blue",
      "/f11-mandalay-national-wildlife-refuge", "/f12-terrebonne-bay",
      "/f36-la-louisiane",         "/f37-la-nouvelle-orleans",
      "/f45-baton-rouge",          "/f29-bourg",
      "/f30-ashland",              "/f31-montegut",
      "/f38-le-reste-du-monde",
    ],

    JOUR_RECENSEMENT:    25,
    SEUIL_ABSENCE_JOURS: 15,  // absence > 15j → liste "absents" (si pas de RP)
    SEUIL_FICHE_TARD:    15,  // fiche validée ≥ 15 du mois → recensé sans RP requis
    ALERTE_FIN_JOURS:    1,   // carte rouge J+1 après la date de fin d'absence

    STAFF_USERS: ["Mami Wata", "Jason Blackford"], // [MAJ]
  };

  /* === TEXTES === */

  window.RC.T = {
    // Colonnes du recensement
    TITRE_RECENSES:    "Membres recensés",
    TITRE_MENACES:     "Membres menacés par le Doyen",   // Anciennement "en danger"
    TITRE_ABSENTS:     "Membres absents",
    TITRE_NOUVEAUX:    "Fiches validées après le 15",
    TITRE_SUPPRESSION: "Futurs repas du Doyen",

    // Actions staff — recensement
    BTN_GENERER:      "Générer la liste du recensement",
    BTN_FINALISER:    "Publier la liste finale (1er du mois)",
    BTN_VERS_RECENSE: "↑",
    BTN_VERS_MENACE:  "↓",

    // Types d'absence (libellés UI)
    TYPE_LABEL_ABSENCE:     "Absence totale",
    TYPE_LABEL_REDUITE:     "Présence réduite",
    TYPE_LABEL_SUPPRESSION: "Demande de suppression",

    TYPE_DESC_ABSENCE:     "Absence complète du forum. Date de retour estimée facultative.",
    TYPE_DESC_REDUITE:     "Rythme ralenti, présence moins fréquente. Dates de début et de fin.",
    TYPE_DESC_SUPPRESSION: "Souhait de quitter le forum. La suppression sera effective fin du mois.",

    // Actions admin — panneau absences
    BTN_CLOTURER:          "Absence terminée",
    BTN_PROLONGER:         "Prolonger",
    BTN_NOUVELLES:         "Prendre des nouvelles",
    BTN_SUPPRIMER_FICHE:   "Confirmer la suppression",
    CONFIRMER_PROLONGATION:"Confirmer",

    // Labels formulaire
    LABEL_TYPE:   "Type de déclaration",
    LABEL_DEBUT:  "Date de début",
    LABEL_FIN:    "Date de fin estimée (facultatif)",
    LABEL_LIEN:   "Lien vers ton sujet d'absence (facultatif)",
    LABEL_COMPTES:"Comptes concernés par la suppression",
    BTN_SOUMETTRE:"Envoyer la déclaration",

    // Feedback
    ERR_DONNEES:  "❌ Impossible de charger les données. Réessayez.",
    OK_ABSENCE:   "✅ Déclaration enregistrée — colle le message ci-dessous.",
    OK_RETOUR:    "✅ Retour enregistré.",
    OK_PROLONGE:  "✅ Absence prolongée.",
    OK_GENERE:    "✅ Snapshot généré — BBCode prêt dans la réponse rapide.",
    OK_FINALISE:  "✅ Liste finale enregistrée.",
    DEJA_GENERE:  (d) => `ℹ️ Liste déjà générée le ${d}. Les overrides restent actifs.`,
    PAS_LE_25:    "Le snapshot est disponible uniquement le 25 du mois.",
    PAS_LE_1ER:   "La liste finale est disponible uniquement le 1er du mois suivant.",
  };

})();
