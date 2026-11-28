/* ==================================================================
   THE DROWNED LANDS — PANNEAU DES ENQUÊTES · FICHIER 1/4 : CONFIG
   ------------------------------------------------------------------
   Tout ce qui est modifiable sans toucher au code vit ici : textes,
   icônes, statuts, types, bonus, notifications, marqueurs d'archive.
   Les trois autres fichiers ne contiennent AUCUN texte ni style.
   Ordre de chargement : eco-core → tdl-base-v1-6.js → 1-config →
   2-data → 3-rendu → 4-actions.
   ================================================================== */
(function(){
"use strict";

window.TDLE_CFG = {

  /* ---- Données ---- */
  NODE: "enquetes",            /* noeud Firebase racine des affaires          */
  SCHEMA: 2,                   /* version du schéma des données d'une affaire */
  FORUM_HOME: "https://thedrownedlands.forumactif.com/",
  EDIT_URL: "https://thedrownedlands.forumactif.com/post?p=452&mode=editpost", /* édition du sujet portant le panneau */
  VEILLE_MS: 15000,            /* cadence de la veille sentinelle             */
  SEP: " ⟡ ",

  /* ---- Économie ---- */
  BONUS: { participant: 60, referent: 100 },

  /* ---- Identifiants EcoNotif (textes gérés par sos-emi-notif) ---- */
  NOTIFS: {
    creation: 140,
    implication: 141,
    implicationStaff: 142,
    ajout: 143,
    clotureParticipants: 144,
    clotureStaff: 145,
    bonus: 146,
    demandeReferent: 147
  },

  /* ---- Comptes de service : pseudo FA réel écrit en base (traçabilité),
         seul l'AFFICHAGE est remplacé par l'entité incarnée. ---- */
  ALIAS_AUTEUR: { "mami wata": "le TPSO" },

  /* ---- Statuts (couleurs issues du :root du forum) ---- */
  STATUTS: {
    en_cours:     { label: "En cours",     c: "var(--gr1-color)", tint: "var(--gr1-20)" },
    attente:      { label: "En attente",   c: "var(--gr3-color)", tint: "var(--gr3-20)" },
    non_elucidee: { label: "Non élucidée", c: "var(--gr6-color)", tint: "var(--gr6-20)" },
    classee:      { label: "Classée",      c: "var(--cntr)",      tint: "var(--cntr2)" }
  },

  /* ---- Types d'affaires ---- */
  TYPES: [
    { id: "VC", label: "Vols & infractions civiles" },
    { id: "AG", label: "Agressions" },
    { id: "MH", label: "Meurtres & tentatives d'homicide" },
    { id: "FP", label: "Faits particuliers" },
    { id: "DR", label: "Disparitions" }
  ],
  TYPE_ICON: { VC: "fi-tr-people-robbery", AG: "fi-ts-user-injured", MH: "fi-tr-gun-shooting", FP: "fi-ts-ghost", DR: "fi-tr-shield-interrogation" },
  /* icônes solid du bloc méta (colonne TYPE) */
  TYPE_ICON_SR: { VC: "fi-sr-people-robbery", AG: "fi-sr-user-injured", MH: "fi-sr-gun-shooting", FP: "fi-sr-ghost", DR: "fi-sr-shield-interrogation" },
  TYPE_CAT:  { VC: "vols", AG: "agressions", MH: "meurtres", FP: "faits", DR: "disparitions" },
  CAT_LABEL: {
    vols: "Vols & infractions civiles",
    agressions:"Agressions",
    meurtres: "Meurtres & homicides",
    faits: "Faits particuliers",
    disparitions: "Disparitions"
  },
  MOIS: ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"],

  /* ---- Marqueurs d'archive (grammaire Sophie-OS : === réservé à
         PANNEAU/FIN, sections internes en --- BLOC ---) ---- */
  ARCHIVE: {
    bloc: "enquete",                       /* --- BLOC enquete ---          */
    prefixPanneau: "ENQUÊTE",              /* === PANNEAU: ENQUÊTE COTE === */
    puce: "• ",                            /* FA échappe les lignes en "- " */
    cle: {                                 /* clés du post d'archive        */
      cote: "COTE", titre: "TITRE", type: "TYPE", ouverture: "OUVERTURE",
      lieu: "LIEU", victime: "VICTIME", enqueteur: "ENQUETEUR", referent: "REFERENT",
      synthese: "SYNTHESE", statut: "STATUT", rp: "RP",
      particularites: "PARTICULARITES", elements: "ELEMENTS", folklore: "FOLKLORE",
      roles: "ROLES", chrono: "CHRONO", personnes: "PERSONNES", valides: "VALIDES",
      sujets: "SUJETS", liens: "LIENS"
    }
  },

  /* ---- TEXTES : tout ce que le panneau affiche ---- */
  TEXTES: {
    titre: "Panneau des enquêtes",
    brand1: "Sheriff's Office",
    brand2: "Servir et protéger",
    titreEditer: "Éditer le message du panneau",
    vueDossiers: "Dossiers",
    vueBoard: "Mur",
    filtreToutes: "Toutes",
    filtreDemandes: "⚑ Demandes",
    typeTous: "TOUT",

    chargement: "Chargement des enquêtes…",
    connexionBase: "Connexion à la base…",
    introuvable: "EcoCore ou tdl-base introuvable. Vérifiez l'ordre de chargement des scripts.",
    ecoIndispo: "EcoCore indisponible.",
    loadErreur: "Impossible de charger les enquêtes.",
    videMembre: "Aucune enquête pour l'instant.",
    videStaff: "Aucune enquête pour l'instant. Utilisez « Nouvelle affaire ».",
    videFiltre: "Aucune affaire pour ce filtre.",
    videPanneau: "—",

    nouveau: "＋ Nouvelle affaire",
    retourListe: "← Retour à la liste",
    ouvrir: "Ouvrir →",

    metaType: "Type", metaOuverture: "Ouverture", metaLieu: "Lieu",
    metaVictime: "Victime(s)", metaEnqueteur: "Enquêteur (IRP)", metaReferent: "Référent",
    referentStaff: "(staff)", referentAPourvoir: "à pourvoir",

    onglets: { resume: "Résumé", elements: "Éléments", chrono: "Chronologie", personnes: "Personnes", liens: "Liens" },
    hintElements: "Ici tous les faits et indices de l'affaire récoltés jusqu'à présent.",
    hintChrono: "Retrouvez la progression de l'enquête, datée selon les événements IRP.",
    hintLiens: "Affaires connexes et sujets RP rattachés à l'enquête.",
    secParticularites: "Particularités",
    secElements: "Éléments relevés",
    secFolklore: "Éléments atypiques & folklore",
    secChrono: "Journal de l'affaire",
    secVictime: "Victime(s)",
    secParticipants: "Participants RP",
    secParticipantsCo: " : cocher pour le bonus de clôture",
    secPersonnes: "Autres personnes citées",
    secLiens: "Affaires liées",
    secDemandesRef: "Demande(s) de référent à arbitrer",
    secDemandesLien: "Demande(s) de lien",
    validerRef: "Valider comme référent",
    clotureDemandeeStaff: "Le référent demande la clôture.",
    aValiderStaff: "(à valider par le staff)",
    secSujets: "Sujets RP liés",
    secRoles: "Implication RP",
    secStatut: "Statut",
    ouvertureChrono: "Ouverture de l'affaire",
    intrigueCoord: "Coordonnée par le staff.",
    roleAjout: "+ rôle",
    aucuneListe: "Aucun rôle défini.",
    aucunParticipant: "Aucun participant pour l'instant.",
    aucunSujet: "Aucun sujet RP rattaché.",
    aucunSujetDrawer: "Aucun sujet RP rattaché pour l'instant.",
    aucunLien: "Aucune affaire liée.",
    aucuneALier: "(aucune)",
    lienPropose: "lien proposé",
    validePar: "validé",
    introuvableLien: "Affaire introuvable (peut-être supprimée).",
    verrouille: "Éléments verrouillés : affaire liée à une intrigue. Seul le staff peut les modifier.",
    archBadge: "Archive",

    placePart: "Nouvelle particularité…",
    placeEl: "Nouvel élément / indice relevé…",
    placeChrDate: "Date RP (ex. 14 avril 2025)",
    placeChrTxt: "Progression de l'enquête…",
    placeRole: "Nouveau rôle recherché (ex. ambulancier)…",
    placeLienNote: "Note (ex. même mode opératoire)…",
    placeSujetUrl: "https://thedrownedlands.forumactif.com/t000-titre-du-rp",
    ajouter: "Ajouter", annuler: "Annuler", fermer: "Fermer", valider: "Valider",
    enregistrer: "Enregistrer",
    ajouterLienStaff: "Ajouter le lien", demanderLien: "Demander le lien",

    roleVous: "Vous : ",
    roleStaff: "Staff", roleReferent: "Référent", roleInvite: "Invité", roleVisiteur: "Visiteur",
    impliquer: "M'impliquer en RP",
    editerAffaire: "Éditer l'affaire",
    coldAjouter: "Marquer « non élucidé »", coldRetirer: "Retirer « non élucidé »",
    intrAjouter: "Marquer « intrigue »", intrRetirer: "Retirer « intrigue »",
    refAssigner: "Assigner référent", refRetirer: "Retirer référent",
    clôturerBtn: "Clôturer & verser les bonus", dejaCloturee: "Déjà clôturée",
    supprimerBtn: "Supprimer",
    clotureDemandee: "Clôture demandée ✓",
    demanderCloture: "Demander la clôture",
    demanderRef: "Demander à être référent",
    demandeEnvoyee: "Demande envoyée ✓",
    closeTxt: "Affaire close.",
    inviteTxt: "Connectez-vous pour vous impliquer dans une affaire.",
    intrigueTxt: "Pilotée par le staff, contactez le staff pour vous impliquer.",
    archiverBtn: "Archiver dans le topic",
    dejaArchivee: "Déjà archivée ✓",
    finaliserBtn: "Finaliser l'archivage",

    drawerRpTitre: "M'impliquer en RP : ",
    drawerRpCochez: "Cochez le(s) sujet(s) où joue votre personnage :",
    drawerRpNouveau: "…ou rattachez un nouveau topic",
    drawerEditTitre: "Éditer l'affaire : ",
    flType: "Type d'affaire",
    flDate: "Date d'ouverture",
    flTitre: "Intitulé de l'affaire",
    flVictime: "Victime", flLieu: "Lieu", flEnqueteur: "Enquêteur (IRP)",
    flSynthese: "Synthèse", flStatutTxt: "Statut (texte affiché)", flRp: "Implication RP (accroche)",

    toast: {
      formatAncien: "Affaire au format ancien. Lancez d'abord la conversion (bouton staff).",
      close: "Affaire close.",
      connexionReq: "Connexion requise.",
      demandeRefOk: "Demande envoyée au staff.",
      clotureOk: "Demande de clôture envoyée au staff.",
      verifVide: "Cochez un sujet ou renseignez une URL.",
      inscrit: "Inscrit·e comme participant·e.",
      rienAAjouter: "Rien à ajouter.",
      decrireEtape: "Décris l'étape.",
      elAjoute: "Élément ajouté.",
      partAjoutee: "Particularité ajoutée.",
      chrAjoute: "Étape ajoutée.",
      sujetRetire: "Sujet RP retiré.",
      lienRetire: "Lien retiré.",
      lienAjoute: "Lien ajouté.",
      lienValide: "Lien validé.",
      lienDemande: "Demande de lien envoyée au staff.",
      aucuneAffaire: "Aucune affaire à lier.",
      refValide: " est désormais référent.",
      refAssignOk: "Référent assigné.",
      refRetire: "Référent retiré → En attente.",
      coldOk: "Marquée « cold case ».",
      coldKo: "« Cold case » retiré.",
      intrOk: "Marquée « intrigue » ; verrouillée staff.",
      intrKo: "« Intrigue » retiré.",
      enregistre: "Affaire enregistrée, cote : ",
      cree: "Affaire ",
      cree2: " créée, complétez-la.",
      supprime: "Affaire supprimée.",
      supprimeRef: " référent.",
      dejaVerse: "Bonus déjà versés.",
      clotureRefuse: "Aucun participant validé : cochez au moins un participant avant la clôture.",
      clotureErreur: "Erreur lors du versement des bonus. Clôture annulée, réessayez.",
      clotureOkPart1: "Clôturée. ",
      clotureReferentBonus: " + ",
      clotureRefSuffix: "$ référent",
      archivRefuse: "Seule une affaire clôturée peut être archivée.",
      archivConfirm: "Archiver cette affaire dans le topic ?\nLe post d'archive sera publié automatiquement, puis le nœud Firebase pourra être purgé.",
      archivErreur: "Quick reply introuvable — archivage impossible depuis cette page.",
      finalise: "Nœud allégé — l'affaire vit désormais dans le topic.",
      finaliseErreur: "Purge impossible.",
      resteEchec: "Il reste ",
      resteEchec2: " modification(s) en échec.",
      ecrits: "Modifications enregistrées.",
      migrerRefuse: "Réservé au staff.",
      rienAConvertir: "Rien à convertir.",
      migrImpossible: "Conversion impossible — rien n'a été modifié."
    },

    confirmes: {
      supprimer: "Supprimer définitivement l'affaire ",
      supprimer2: " ?\nCette action est irréversible.",
      retirerSujet: "Retirer le sujet RP « ",
      retirerSujet2: " » de cette affaire ?\nLes participants qui n'apparaissent que dans ce sujet ne compteront plus.",
      clôturer: "Clôturer ",
      clôturer2: " et verser les bonus ? (irréversible)",
      migrer1: "Convertir ",
      migrer2: " affaire(s) au nouveau format ?\n\nChaque affaire est traitée séparément et l'opération peut être relancée sans risque.\nAssurez-vous que personne n'a le panneau ouvert sur l'ancienne version du script.",
      migrerPart1: " affaire(s) converties, ",
      migrerPart2: " en échec, relancez la conversion.",
      migrerOk: " affaire(s) converties."
    },

    migbar1: "⚙ ",
    migbar2: " affaire",
    migbar3: "s au format ancien. ",
    migbar4: "Leurs listes (éléments, chronologie, rôles, sujets…) restent consultables mais ne sont pas modifiables avant conversion.",
    migBtn: "Convertir maintenant",
    migEnCours: "Conversion…",
    migProg1: "Conversion ",
    migProg2: " / ",
    migProg3: "…",

    echec1: "⛔ ",
    echec2: " modification",
    echec3: "s non enregistrée",
    echec4: "s. Ne rechargez pas la page.",
    echecBtn: "Réessayer",
    echecEnvoi: "Envoi…"
  }
};

})();
