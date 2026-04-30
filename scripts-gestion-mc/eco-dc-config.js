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
 * ORDRE DE CHARGEMENT : en premier, avant tous les autres eco-dc-*.js
 */

/* === CONFIG === */
window.DC = {};

window.DC.CFG = {

  /* Paramètres du jeu — à adapter */
  TOPIC_SLUG:      "/t63-",          // Partie de l'URL qui identifie le sujet DC
  BOTTIN_SLUG:     "/t50-",          // [MAJ] Partie de l'URL du sujet bottin des MC — à adapter
  STAFF_USERS:     [],        // Pseudos staff (s'ajoutent à EcoCore.ADMIN_USERS)
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

  /* Bouton et modale membre */
  BTN_OUVRIR:           "📋 Faire une demande de multi-compte",
  TITRE_MODAL:          "📋 Demande de multi-compte",
  CHARGEMENT:           "Chargement de vos informations…",
  CHARGEMENT_PROFIL:    "Lecture de votre profil en cours…",
  LABEL_RESUME:         "🖊 Résumé de vos idées pour le nouveau personnage *",
  LABEL_AVATAR:         "🖼 Demande de réservation d'avatar *",
  PH_RESUME:            "Décrivez votre idée de personnage, son background, ses motivations…",
  PH_AVATAR:            "Nom/description de l'avatar souhaité (acteur·ice, personnage, etc.)",
  BTN_SOUMETTRE:        "Envoyer ma demande",
  BTN_ANNULER:          "Annuler",
  BTN_FERMER:           "✕",
  ENVOI_EN_COURS:       "Envoi en cours…",

  /* Erreurs conditions membres */
  ERR_COMPTE_RECENT:    (dernier) =>
    `❌ Vous devez faire votre demande depuis votre dernier compte créé : <strong>${dernier}</strong>.`,
  ERR_MAX_COMPTES:      (max) =>
    `❌ Vous avez atteint le maximum de ${max} comptes autorisés.`,
  ERR_DEMANDE_EN_COURS: (date) =>
    `⏳ Demande déjà en cours (soumise le ${date}). Attendez la décision du staff.`,
  ERR_CONDITIONS:       "⛔ Vous ne remplissez pas encore toutes les conditions requises.",
  ERR_RESUME_COURT:     "⚠️ Résumé trop court (minimum 30 caractères).",
  ERR_AVATAR_VIDE:      "⚠️ Veuillez préciser votre demande de réservation d'avatar.",
  ERR_SOLDE:            (s) => `❌ Solde insuffisant au moment de l'envoi (${s} $).`,
  ERR_DONNEES:          "❌ Impossible de lire les données. Réessayez dans quelques instants.",
  ERR_ENVOI:            "❌ Erreur lors de l'envoi. Réessayez ou contactez un admin.",

  /* Confirmation après soumission */
  CONFIRMATION: (n, paiement, cout, monnaie) =>
    `✅ Votre demande de ${n}e compte a été envoyée ! Le staff va la traiter prochainement.
    ${paiement ? `<br>💰 Le paiement de ${cout} ${monnaie} sera débité automatiquement à la validation.` : ""}
    <br><br>Un message récapitulatif a été pré-rempli ci-dessous —
    <strong>cliquez sur "Répondre"</strong> pour le poster dans le sujet.`,

  /* Panel staff — gestion des groupes */
  STAFF_GESTION_TITRE:    "🗂 Gestion des groupes multi-comptes",
  STAFF_GESTION_VIDE:     "Aucun groupe enregistré.",
  STAFF_CONFIRM_SUPPRESSION: (pseudo) => `Supprimer "${pseudo}" de ce groupe ?`,
  STAFF_CONFIRM_GROUPE:   (racine) => `Supprimer TOUT le groupe de "${racine}" ? Cette action est irréversible.`,
  STAFF_SUPPR_OK:         (pseudo) => `✅ "${pseudo}" supprimé du groupe.`,
  STAFF_SUPPR_GROUPE_OK:  (racine) => `✅ Groupe de "${racine}" entièrement supprimé.`,
  STAFF_ERR_SUPPR:        "❌ Erreur lors de la suppression.",

  /* Panel staff */
  STAFF_TITRE:          "🔐 Panel Staff — Demandes de multi-compte en attente",
  STAFF_AUCUNE:         "Aucune demande en attente.",
  STAFF_PROMPT_REFUS:   "Motif du refus (inclus dans le message automatique) :",
  STAFF_ERR_SOLDE:      (pseudo, s) =>
    `❌ Solde insuffisant de ${pseudo} (${s} $). Validation annulée.`,
  STAFF_LABEL_AJOUT:    "Enregistrer le pseudo du nouveau compte :",
  STAFF_BTN_AJOUT:      "Enregistrer",
  STAFF_ERR_PSEUDO_VIDE:  "Pseudo vide.",
  STAFF_ERR_DEJA_LIE:   (racine) => `Ce pseudo est déjà lié au groupe de "${racine}".`,
  STAFF_AJOUT_OK:       (pseudo, racine) => `✅ ${pseudo} ajouté au groupe de ${racine}.`,
};
