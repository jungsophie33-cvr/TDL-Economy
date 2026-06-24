/*
 * fiche-config.js — Configuration du système de validation de fiche · TDL
 *
 * CE QUE CE FICHIER FAIT : définit window.FI avec toutes les constantes,
 * sélecteurs ForumActif, listes de choix et chaînes visibles.
 * CE QU'IL NE FAIT PAS : aucun accès DOM, aucune logique métier.
 *
 * CARTE DES BLOCS :
 *   CONFIG  — paramètres métier, sélecteurs FA, listes de choix
 *   TEXTES  — toutes les chaînes visibles par l'utilisateur
 *
 * ORDRE DE CHARGEMENT : en premier, avant tous les autres fiche-*.js
 */

/* === CONFIG === */
window.FI = {};

window.FI.CFG = {

  /* Paramètres métier */
  TOPIC_SLUG:     "/t64-",       // [MAJ] Slug du sujet de validation de fiches
  /*
   * STAFF_USERS est volontairement vide : la liste des admins se gère dans eco-core2.js
   * (constante ADMIN_USERS), qui est la source unique pour tout le système.
   * N'ajouter ici que des pseudos ayant accès à ce seul module sans être admins globaux.
   */
  STAFF_USERS:    [],
  PRIME_PRE_LIEN: 15,           // $ crédités au membre si pré-lien validé
  PRIME_PARRAIN:  10,           // $ crédités à la cagnotte du groupe du parrain

  /*
   * [MAJ] Sélecteurs dépendants du thème sj-* et de ForumActif.
   * ZONE_INJECTION : div placée manuellement dans le post par l'admin.
   * TEXTAREA_REPONSE : textarea interne de SCEditor dans la réponse rapide.
   */
  SEL: {
    ZONE_INJECTION:   ".validation-fiche",
    TEXTAREA_REPONSE: "#quick_reply .sceditor-container textarea",
  },

  /*
   * [MAJ] Les communautés ne sont plus déclarées ici. Source unique :
   * window.EcoCore.COMMUNAUTES (eco-core.js), indexée par ID de groupe FA.
   * Le select #fi-groupe est construit par FI.optionsGroupes() (fiche-utils.js)
   * — value = nom court (clé de cagnotte), label = nom long, jouables seulement.
   */
  LISTES: {
    BANDES: [
      "Main de la Providence",
      "Maringouins",
      "Braconneurs",
      "Faiseuses d'Anges",
      "Sorcières du Baron",
      "Flottille",
    ],
    LIEUX_METIER: [
      "Downtown Houma",
      "Bayou Blue",
      "Bayou Cane",
      "Terrebonne Parish",
    ],
    LIEUX_HABITATION: [
      "Downtown Houma", "Old Houma", "East City", "South City",
      "Bayou Cane", "Bayou Blue", "Bourg", "Ashland",
      "Montegut", "Cocodrie", "Lost Bayou",
    ],
  },
};

/* === TEXTES === */
window.FI.TEXTES = {

  /* Bouton et modale membre */
  BTN_OUVRIR:    "Demander la validation de ma fiche",
  TITRE_MODAL:   "Demande de validation de fiche",
  BTN_SOUMETTRE: "Envoyer ma demande",
  BTN_ANNULER:   "Annuler",
  BTN_FERMER:    "✕",
  ENVOI_EN_COURS:"Envoi en cours…",

  /* Labels des champs */
  L_LIEN_FICHE:      "Lien vers ta fiche de présentation *",
  L_PRE_LIEN:        "Ton personnage est-il un pré-lien ?",
  L_LIEN_PRE_LIEN:   "Lien vers le pré-lien",
  L_PARRAIN:         "Tu es arrivé(e) sur le forum grâce à :",
  L_MULTICOMPTE:     "Ton personnage est-il un multi-compte ?",
  L_PREMIER_COMPTE:  "Ton premier compte créé :",
  L_FACECLAIM:       "Faceclaim choisi *",

  /* Faceclaim — sélecteur de mode de réservation */
  L_FC_MODE:         "As-tu réservé ce faceclaim ?",
  FC_MODE_SANS:      "Sans réservation",
  FC_MODE_7J:        "Faceclaim réservé (7 jours)",
  FC_MODE_MC:        "Multicompte réservé",
  FC_MODE_PRELIEN:   "Pré-lien réservé",
  L_FC_CHOIX:        "Choisis ta réservation",
  FC_OPT_CHOISIR:    "— Choisir —",
  FC_OPT_AUTRE:      "— Autre (saisie libre) —",
  FC_VIDE_7J:        "Aucune réservation 7 jours à ton nom.",
  FC_VIDE_MC:        "Sélectionne d'abord ton compte principal ci-dessus.",
  FC_VIDE_MC_AUCUNE: "Aucune réservation multicompte pour ce compte.",
  FC_VIDE_PRELIEN:   "Aucun pré-lien réservé pour le moment.",
  
  L_GROUPE:          "Communauté (groupe) *",
  L_BANDE:           "Appartenance à une bande hors-la-loi ?",
  L_NOM_BANDE:       "Nom de la bande :",
  L_ROLE_BANDE:      "Rôle dans la bande :",
  L_LIEU_METIER:     "Secteur de travail *",
  L_SOCIETE:         "Nom de la société / lieu de travail *",
  L_EMPLOI:          "Intitulé du poste *",
  L_LIEU_HAB:        "Lieu d'habitation *",
  L_NUMERO:          "N° de logement *",
  L_TYPE_LOGEMENT:   "Type de logement *",
  /* Erreurs de validation */
  ERR_LIEN_FICHE:     "⚠️ Le lien vers ta fiche est requis.",
  ERR_LIEN_PRELIEN:   "⚠️ Le lien du pré-lien est requis si tu as coché Oui.",
  ERR_PREMIER_COMPTE: "⚠️ Sélectionne le compte principal parmi tes MC.",
  ERR_FACECLAIM:      "⚠️ La barre de faceclaim est requise.",
  ERR_GROUPE:         "⚠️ Le groupe est requis.",
  ERR_BANDE_NOM:      "⚠️ Le nom de la bande est requis.",
  ERR_BANDE_ROLE:     "⚠️ Le rôle dans la bande est requis.",
  ERR_LIEU_METIER:    "⚠️ Le secteur de travail est requis.",
  ERR_SOCIETE:        "⚠️ Le nom de la société est requis.",
  ERR_EMPLOI:         "⚠️ L'emploi est requis.",
  ERR_LIEU_HAB:       "⚠️ Le lieu d'habitation est requis.",
  ERR_NUMERO:         "⚠️ Le numéro de logement est requis.",
  ERR_TYPE_LOGEMENT:  "⚠️ Le type de logement est requis.",  
  ERR_ENVOI:          "❌ Erreur lors de l'envoi. Réessayez ou contactez un admin.",
  ERR_DONNEES:        "❌ Impossible de charger les données.",

  CONFIRMATION: "✅ Ta demande a été envoyée ! Clique sur « Envoyer » dans la réponse rapide ci-dessous.",

  /* Panel staff */
  STAFF_TITRE:           "Panel Staff — Fiches en attente de validation",
  STAFF_AUCUNE:          "Aucune demande en attente.",
  STAFF_TITRE_MODAL:     (pseudo) => `✅ Valider la fiche de ${pseudo}`,
  STAFF_LABEL_MSG:       "Message personnalisé (apparaîtra dans le post de validation) :",
  STAFF_BTN_VALIDER:     "✅ Valider la fiche",
  STAFF_BTN_CONFIRMER:   "Confirmer et poster",
  STAFF_BTN_ANNULER:     "Annuler",
  STAFF_ERR_POSTING:     "❌ Impossible de poster dans la fiche.",
  STAFF_OK:              (pseudo) => `✅ Fiche de ${pseudo} validée et message posté.`,
  STAFF_FC_CONFLIT:  "⚠️ Ce faceclaim était réservé par un autre membre — vérifie qu'il n'y a pas de conflit.",
  STAFF_FC_ECHEC:    "⚠️ Carte faceclaim non mise à jour — à créer manuellement via le panneau admin.",
  
};
