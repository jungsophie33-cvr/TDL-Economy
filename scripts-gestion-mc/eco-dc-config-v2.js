/*
 * eco-dc-config.js — Configuration centrale du système multi-compte · TDL
 *
 * CE QUE CE FICHIER FAIT : définit l'objet global window.DC avec toutes les
 * constantes de configuration, les sélecteurs ForumActif et les chaînes visibles.
 * CE QU'IL NE FAIT PAS : aucun accès DOM, aucune logique métier.
 *
 * CARTE DES BLOCS :
 *   CONFIG  — paramètres du jeu et sélecteurs ForumActif
 *   TEXTES  — toutes les chaînes visibles par l'utilisateur
 *
 * [v2] Textes remaniés pour le panneau « mc- » : titres de section courts
 * (le CSS les met en bas-de-casse), sous-titres, libellés de conditions.
 * Retirés : STAFF_LABEL_AJOUT, STAFF_BTN_AJOUT, STAFF_ERR_PSEUDO_VIDE,
 * STAFF_ERR_DEJA_LIE, STAFF_AJOUT_OK — le formulaire d'ajout de pseudo
 * n'existe plus, le rattachement se fait à la validation de fiche.
 *
 * ORDRE DE CHARGEMENT : en premier, avant tous les autres eco-dc-*.js
 */

/* === CONFIG === */
window.DC = {};

window.DC.CFG = {

  /* Paramètres du jeu — à adapter */
  TOPIC_SLUG:      "/t63-",          // Partie de l'URL qui identifie le sujet DC
  BOTTIN_SLUG:     "/t50-",          // [MAJ] Partie de l'URL du sujet bottin des MC — à adapter
  STAFF_USERS:     [],               // Pseudos staff (s'ajoutent à EcoCore.ADMIN_USERS)
  MOIS_ANCIENNETE: 1,
  RP_MINIMUM:      15,
  COUT_DC:         150,              // En monnaie du jeu, à partir du 3e compte
  MAX_COMPTES:     5,

  /*
   * [MAJ] Sélecteurs ForumActif — à vérifier après toute mise à jour de la plateforme.
   * Ces sélecteurs ciblent : le DOM du sujet, les champs de profil personnalisés,
   * et le textarea de réponse rapide. Ils sont les points de fragilité les plus probables.
   */
  SEL: {
    /*
     * [MAJ] Sélecteurs dépendants du thème et de la structure du forum.
     * ZONE_INJECTION cible la div placée manuellement dans le corps du message
     * en HTML/BBCode par l'admin. Si elle est renommée ou supprimée, rien ne s'affiche.
     * Chemin complet dans le DOM : .sj-postmsg .sj-post-msg div .demande-dc
     */
    ZONE_INJECTION:   ".demande-dc",     // [MAJ] Div placée dans le corps du post DC
    ZONE_BOTTIN:      ".affichage-dc",   // [MAJ] Div placée dans le corps du post bottin
    // [MAJ] SCEditor (éditeur WYSIWYG de ForumActif) génère son textarea dans ce conteneur
    TEXTAREA_REPONSE: "#quick_reply .sceditor-container textarea",

    /*
     * [MAJ] IDs natifs ForumActif des champs personnalisés.
     * Ces IDs sont stables (définis dans Admin > Profils > Champs personnalisés).
     * Attention : les classes comme .field-date-dinscription sont ajoutées par le JS
     * du thème sj-* au DOMContentLoaded — elles sont absentes du HTML fetché par fetch().
     * On cible donc les IDs bruts + .field_uneditable qui contient la valeur affichée.
     */
    PROFIL_DATE:      "#field_id-4 .field_uneditable",   // Champ "Date d'inscription"
    PROFIL_RP:        "#field_id-13 .field_uneditable",  // Champ "RP"
  },
};

/* === TEXTES === */
window.DC.TEXTES = {

  /* En-tête du panneau */
  PANEL_TITRE:          "Gestion des multi-comptes",
  PANEL_SOUS_TITRE:     "Panel staff",

  /* Bouton et modale membre */
  BTN_OUVRIR:           "Faire une demande de multi-compte",
  BTN_OUVRIR_SOUS:      "Pour créer un nouveau compte, cliquez ici",
  TITRE_MODAL:          "Demande de multi-compte",
  CHARGEMENT:           "Chargement de vos informations…",
  CHARGEMENT_PROFIL:    "Lecture de votre profil en cours…",
  LABEL_RESUME:         "Résumé de vos idées pour le multi-compte *",
  LABEL_AVATAR:         "Faceclaim à réserver *",
  PH_RESUME:            "Décrivez votre idée de personnage, son background, ses motivations…",
  PH_AVATAR:            "Nom de l'acteur souhaité",
  BTN_SOUMETTRE:        "Envoyer ma demande",
  BTN_ANNULER:          "Annuler",
  BTN_FERMER:           "✕",
  ENVOI_EN_COURS:       "Envoi en cours…",

  /* Conditions d'éligibilité — cartes de la modale */
  COND_ANCIENNETE:      "Ancienneté",
  COND_RP:              "Posts RP",
  COND_SOLDE:           "Solde",
  COND_MIN_MOIS:        (n) => `min. ${n} mois`,
  COND_MIN_RP:          (n) => `min. ${n}`,
  COND_MIN_SOLDE:       (n) => `min. ${n} $`,
  COND_MOIS:            (n) => `${n} mois`,
  COND_MANQUE_MOIS:     (n) => `Manque ${n} mois`,
  COND_MANQUE_RP:       (n) => `Manque ${n} post${n > 1 ? "s" : ""}`,
  COND_MANQUE_SOLDE:    (n) => `Manque ${n} $`,
  COND_INCONNU:         "?",
  COND_OK:              "Vous <b>remplissez les conditions</b> pour demander un multi-compte.",
  COND_KO:              "Vous <b>ne remplissez pas encore les conditions</b> requises."
                        + "<br>Patientez avant de déposer une demande.",
  ERR_PROFIL:           "Impossible de lire votre profil (délai dépassé ou erreur réseau)."
                        + "<br>Rechargez la page et réessayez. Si le problème persiste, contactez un admin.",

  /* Erreurs conditions membres */
  ERR_COMPTE_RECENT:    (dernier) =>
    `Vous devez faire votre demande depuis votre dernier compte créé : <b>${dernier}</b>.`,
  ERR_MAX_COMPTES:      (max) =>
    `Vous avez atteint le maximum de ${max} comptes autorisés.`,
  ERR_DEMANDE_EN_COURS: (date) =>
    `Demande déjà en cours (soumise le ${date}). Attendez la décision du staff.`,
  ERR_CONDITIONS:       "Vous ne remplissez pas encore toutes les conditions requises.",
  ERR_RESUME_COURT:     "⚠️ Résumé trop court (minimum 30 caractères).",
  ERR_AVATAR_VIDE:      "⚠️ Veuillez préciser le faceclaim à réserver.",
  ERR_AVATAR_PRIS: (a) => `⛔ Le faceclaim « ${a} » est déjà pris ou réservé. Choisis-en un autre.`,
  ERR_SOLDE:            (s) => `❌ Solde insuffisant au moment de l'envoi (${s} $).`,
  ERR_DONNEES:          "❌ Impossible de lire les données. Réessayez dans quelques instants.",
  ERR_ENVOI:            "❌ Erreur lors de l'envoi. Réessayez ou contactez un admin.",

  /* Confirmation après soumission */
  CONFIRMATION: (n, paiement, cout, monnaie) =>
    `✅ Votre demande de ${n}e compte a été envoyée ! Le staff va la traiter prochainement.
    ${paiement ? `<br>💰 Le paiement de ${cout} ${monnaie} sera débité automatiquement à la validation.` : ""}
    <br><br>Un message récapitulatif a été pré-rempli ci-dessous —
    <strong>cliquez sur "Répondre"</strong> pour le poster dans le sujet.`,

  /* Panel staff — demandes */
  STAFF_TITRE:          "Demandes en attente",
  STAFF_SOUS_TITRE:     "Demandes de multi-compte en attente de validation.",
  STAFF_AUCUNE:         "Aucune demande en attente.",
  STAFF_RANG:           (n) => `${n}ᵉ compte`,
  STAFF_VALIDER:        "Valider",
  STAFF_REFUSER:        "Refuser",
  STAFF_VOIR_PLUS:      (n) => `Voir ${n} autre${n > 1 ? "s" : ""} demande${n > 1 ? "s" : ""}`,
  STAFF_REDUIRE:        "Réduire",
  STAFF_PROMPT_REFUS:   "Motif du refus (inclus dans le message automatique) :",
  STAFF_ERR_SOLDE:      (pseudo, s) =>
    `❌ Solde insuffisant de ${pseudo} (${s} $). Validation annulée.`,

  /* Panel staff — groupes */
  STAFF_GESTION_TITRE:    "Groupes de multi-comptes",
  STAFF_GESTION_SOUS:     "Vue d'ensemble des groupes existants et des comptes associés.",
  STAFF_GESTION_VIDE:     "Aucun groupe enregistré.",
  STAFF_COL_RACINE:       "Compte principal",
  STAFF_COL_COMPTES:      "Comptes associés",
  STAFF_RETIRER:          "Retirer du groupe",
  STAFF_SUPPR_GROUPE:     "Supprimer tout le groupe",
  STAFF_CONFIRM_SUPPRESSION: (pseudo) => `Supprimer "${pseudo}" de ce groupe ?`,
  STAFF_CONFIRM_GROUPE:   (racine) => `Supprimer TOUT le groupe de "${racine}" ? Cette action est irréversible.`,
  STAFF_SUPPR_OK:         (pseudo) => `✅ "${pseudo}" supprimé du groupe.`,
  STAFF_SUPPR_GROUPE_OK:  (racine) => `✅ Groupe de "${racine}" entièrement supprimé.`,
  STAFF_ERR_SUPPR:        "❌ Erreur lors de la suppression.",

  /* Panel staff — suppression d'un membre */
  SUPPR_TITRE:      "Suppression d'un membre",
  SUPPR_TEXTE:      "Supprime définitivement toutes les données du membre : économie, "
                    + "multi-comptes, index UID, faceclaims réservés, rôles occupés et statut "
                    + "de référent dans le bottin des métiers. À n'utiliser que si le membre "
                    + "a quitté le forum.",
  SUPPR_LABEL:      "Pseudo exact du membre",
  SUPPR_PH:         "Entrez le pseudo exact",
  SUPPR_BTN:        "Supprimer tout",
  SUPPR_ALERTE_T:   "Action irréversible",
  SUPPR_ALERTE:     "Les postes libérés rouvriront dans le bottin des métiers et les faceclaims "
                    + "redeviendront disponibles. Aucune restauration n'est possible.",
  SUPPR_CONFIRM:    (pseudo) => `⚠️ Supprimer TOUTES les données de "${pseudo}" ?\n\n`
                    + `Ses rôles seront libérés dans le bottin des métiers et ses faceclaims `
                    + `rendus disponibles.\nCette action est irréversible.`,
  SUPPR_VIDE:       "Pseudo vide.",
  SUPPR_INTROUVABLE:(pseudo) => `"${pseudo}" introuvable dans la base.`,
  SUPPR_OK:         (pseudo, actions) => `✅ "${pseudo}" supprimé (${actions}).`,
  SUPPR_ERR:        "❌ Échec de la suppression : ",
};
