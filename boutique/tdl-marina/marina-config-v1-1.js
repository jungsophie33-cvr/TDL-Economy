/* THE DROWNED LANDS — LA MARINA · CONFIG GÉNÉRAL · v1
 *
 * LE point unique de réglage de La Marina : constantes, textes, couleurs,
 * icônes, libellés des communautés et des types. Aucun autre fichier de la
 * Marina ne déclare de texte visible, de couleur ni d'icône : tout se lit
 * ici (window.MarinaConfig), y compris les messages du volet et du panneau.
 *
 * À CHARGER : avant marina-core, marina-public, marina-volet, marina-staff.
 * EXPOSE : window.MarinaConfig.
 */
(function () {
"use strict";

/* ===================== CONSTANTES ===================== */

var CFG = {
  NODE:           "marina_fiches",
  NODE_MEMBRES:   "membres",
  NODE_CAGNOTTES: "cagnottes",
  NODE_EVENTS:    "evenements",
  NODE_CONSEQ:    "marina_conseq",
  VOTE_JOURS:     7,        /* scrutin de 7 jours                      */
  CO_JOURS:       3,        /* confirmation du co-auteur d'une inter   */
  PLAFOND:        0.5,      /* jamais plus de 50 % de la cagnotte nette */
  VEILLE_MS:     15000      /* sentinelle tdl-base                      */
};

/* ===================== COMMUNAUTÉS =====================
   Clés = libellés courts EcoCore (membres/<pseudo>/group, clés de
   cagnottes). NE PAS renommer sans migration des cagnottes. */
var COMMU = {
  "Les Goulipiats":  { nom:"Goulipiats", c:"var(--gr1-color)", icon:"fi-tr-house-flood" },
  "Les Fardoches":   { nom:"Fardoches",  c:"var(--gr2-color)", icon:"fi-tr-bolt" },
  "Les Ashlanders":  { nom:"Ashlanders", c:"var(--gr3-color)", icon:"fi-tr-crystal-ball" },
  "Les Spectres":    { nom:"Spectres de Baron Samedi", c:"var(--gr4-color)", icon:"fi-tr-cocktail" },
  "Les Perles":      { nom:"Perles de Cocodrie", c:"var(--gr5-color)", icon:"fi-tr-box" }
};
var COMMU_DEFAUT = { nom:"—", c:"var(--dark2)", icon:"fi-tr-anchor" };
var BANDES_KEY = "bandes";          /* case « Bandes hors la loi » des conséquences */

/* ===================== TYPES D'INITIATIVE ===================== */

var TYPES = {
  faveur:  { lab:"Petite faveur",          m:500,  ic:"fi-tr-cocktail",           c:"var(--gr2-color)", desc:"Une aide ponctuelle, vite vue, vite votée.", tarif:"500 $" },
  dossier: { lab:"Dossier communautaire",  m:1000, ic:"fi-tr-marketplace-store",  c:"var(--gr1-color)", desc:"Un chantier ou un service, la communauté en bénéficiaire.", tarif:"1 000 $" },
  oeuvre:  { lab:"Grand œuvre",            m:2000, ic:"fi-tr-ship",               c:"var(--gr3-color)", desc:"Le gros morceau — ce dont la paroisse se souviendra. Évent via tdl-event.", tarif:"2 000 $" },
  inter:   { lab:"Intercommunautaire",     m:2000, ic:"fi-tr-arrows-repeat",      c:"var(--gr5-color)", desc:"Deux communautés, une fiche commune, un co-auteur obligatoire.", tarif:"2 000 $ partagés" }
};

/* ===================== STATUTS ===================== */

var ST = {
  attente_co:   { t:"En attente de co-auteur", c:"var(--gr4-color)" },
  publiee:      { t:"En attente",             c:"var(--gr3-color)" },
  en_vote:      { t:"En vote",                c:"var(--gr1-color)" },
  en_jeu:       { t:"En jeu",                 c:"var(--gr5-color)" },
  cloturee:     { t:"Clôturée",               c:"var(--gr2-color)" },
  non_tranchee: { t:"Non tranchée",           c:"var(--dark2)" }
};

/* ===================== ICONES ===================== */

var ICONES = {
  onglet:     "fi-tr-anchor",                 /* onglet La Marina de la coque  */
  retour:     "fi-tr-angle-left",
  deposer:    "fi-tr-clipboard-check",
  ajouter:    "fi-tr-add",
  auteur:     "fi-tr-comment-user",           /* stats du hero                 */
  opposition: "fi-tr-diamond-exclamation",
  option:     "fi-tr-box",
  bande:      { k:BANDES_KEY, ic:"fi-tr-box", nom:"Bandes hors la loi" },
  cats: {                                              /* catégories de gauche  */
    solo:  { ic:"fi-tr-house-flood",    lab:"Internes",   c:"var(--gr2-color)" },
    inter: { ic:"fi-tr-arrows-repeat",  lab:"Inter",      c:"var(--gr5-color)" },
    done:  { ic:"fi-tr-clipboard-check", lab:"Terminées", c:"var(--darkopa6)" }
  },
  cles: {                                              /* informations clés    */
    benef:    "fi-sr-hand-present",
    conflit:  "fi-tr-balance-scale-left",
    abandon:  "fi-tr-diamond-exclamation"
  },
  paves: {                                             /* pavés de contexte   */
    contexte: "fi-tr-house-flood",
    objectif: "fi-tr-bullseye",
    risque:   "fi-tr-diamond-exclamation"
  },
  montants: {                                          /* lignes du panneau   */
    montant: "fi-tr-dollar",
    vote:    "fi-tr-bolt",
    benef:   "fi-sr-hand-present"
  },
  staffTabs: {                                         /* onglets du panneau  */
    vote:    { ic:"fi-tr-bolt",            lab:"Lancer au vote", c:"var(--gr1-color)" },
    cloture: { ic:"fi-tr-clipboard-check", lab:"Clôturer",       c:"var(--gr4-color)" },
    conseq:  { ic:"fi-tr-customize-edit",   lab:"Conséquences",   c:"var(--gr5-color)" }
  }
};


/* Libellés de champs — volet de proposition */
var CHAMPS_VOLET = {
  part:"Communauté partenaire",
  part_aide:"Un co-auteur membre de cette communauté est obligatoire ; les multicomptes d'un même groupe sont exclus.",
  coaut:"Co-auteur",
  coaut_span:"notifié, 3 jours pour confirmer",
  coaut_aide:"La fiche attend sa confirmation avant de partir en relecture staff.",
  nom:"Nom de l'initiative",
  nom_ph:"Ex. Réparer la digue de Gouloupi",
  img:"Image de la fiche",
  img_span:"URL, facultative",
  img_ph:"https://… — elle habille le hero et la miniature",
  ctx:"Contexte",
  ctx_span:"la situation, ce qui se passe si on ne fait rien",
  ctx_ph:"Le problème concret, vu de la communauté.",
  obj:"Objectif",
  obj_span:"une phrase, le mini-format suffit",
  obj_ph:"Ce que l'argent doit changer, concrètement.",
  ben:"Bénéficiaires",
  ben_ph:"Qui profite de l'initiative",
  ris:"Risque déclaré",
  ris_ph:"Ce qui peut mal tourner — dit ici, pardonné après",
  conflit:"Conflit d'intérêts",
  conflit_span:"visible de tous",
  conflit_ph:"Déclarer ici si un auteur est bénéficiaire principal ; sinon « aucun »",
  ab:"Abandon",
  ab_span:"si le projet meurt en cours de route",
  ab_ph:"Ce que la communauté perd si l'initiative est abandonnée",
  opts:"Options",
  opts_span:"deux minimum, trois maximum, avec leur concept",
  optA_ph:"Option A — titre",
  optAd_ph:"Concept de l'option A — l'idée en deux lignes",
  optB_ph:"Option B — titre",
  optBd_ph:"Concept de l'option B — l'idée en deux lignes",
  optC_ph:"Option C — titre (facultative)",
  optCd_ph:"Concept de l'option C",
  opt_titre:function(k){ return "Option " + k + " — titre"; },
  opt_concept:function(k){ return "Option " + k + " — concept"; },
  opt_concept_span:"ce que les membres liront avant de voter",
  addc:"Une 3e option"
};

/* Libellés de champs — panneau staff */
var CHAMPS_STAFF = {
  nom:"Nom de l'initiative",
  probleme:"Contexte",
  objectif:"Objectif",
  benef:"Bénéficiaires",
  risque:"Risques",
  conflit:"Conflit d'intérêts",
  abandon:"Abandon",
  img:"Image du hero (URL)"
};

/* ===================== TEXTES ===================== */

var TEXTES = {

  /* ----- socle et onglet public ----- */
  CORE: {
    VIDE:"Rien par ici — l'eau est calme.",
    CHOISIR:"Choisissez une initiative dans la colonne de gauche.",
    VOTE_OK:"Voix consignée. Égalité : un dé tranche, tiré en public.",
    OPP_OK:"Opposition consignée — une seule communauté majoritairement opposée bloque tout.",
    DEJA:"Vous avez déjà voté sur cette initiative.",
    CONFIRMEE:"Co-authorat confirmé — la fiche part en relecture staff.",
    CO_EXPIRE:"Le délai de confirmation de 3 jours est dépassé.",
    NOTE_CONSEQ_JEU:"Conséquences générales publiées 7 à 10 jours après le vote. Les suites s'éditeront quand les RP rattachés se clôtureront.",
    ATTEND_CO:"La fiche attend votre confirmation de co-auteur.",
    BTN_CONFIRME:"Confirmer le co-authorat",
    CONFIRMATION:"Confirmation attendue du co-auteur — délai de 3 jours.",
    SOLDE_COMMU:"Solde communauté",
    ENGAGES:"dont",
    PROPOSER:"Proposer une initiative",
    RETOUR_LISTE:"← Les initiatives",
    PRECISIONS_TITRE:"Précisions demandées par le staff",
    CONTEXTES_TITRE:"Contexte de l'initiative",
    OPTIONS_TITRE:"Les options soumises au vote",
    CONSEQ_TITRE:"Conséquences connues",
    CONSEQ_VIDE:"Les conséquences se rédigent à la clôture — selon qui doit les savoir.",
    CONSEQ_PAROISSE:"Par toute la paroisse",
    OPPOSITION:"S'y opposer",
    OPPOSITION_D:"Ne finance rien : bloque le lancement. Comptée par communauté.",
    VOIX:"voix",
    VOIX_CONSIGNEE:"voix consignée",
    OPPOSITION_CONSIGNEE:"opposition consignée",
    AUCUNE_OPPOSITION:"aucune",
    ATTENTE_REVUE:"ouvre après revue du staff",
    EN_JEU:"résolu — fonds engagés",
    ATTENTE_CO_INFO:"en attente du co-auteur",
    OUVERT:"ouvert",
    CLOS_DANS:" — clos dans ",
    JOURS:" jours",
    DEPOSEE:"Déposée ",
    CO_TITRE:"Co-authorat",
    INFO_BENEF:"Bénéficiaires",
    INFO_CONFLIT:"Conflit d'intérêts",
    INFO_ABANDON:"Abandon",
    PAVE_CTX:"Contexte",
    PAVE_OBJ:"Objectifs",
    PAVE_RISQUE:"Risques",
    RESOLU:"Résolu",
    BTN_VOTER:"Voter",
    BTN_CONFIRMER:"Confirmer ?",
    EDITER_FICHE:"Éditer la fiche",
    AUTEUR:"Auteur",
    ENGAGES_SUITE:"engagés"
  },

  /* ----- volet de proposition ----- */
  VOLET: {
    TITRE:"Proposer une initiative",
    FERMER:"Fermer",
    RETOUR:"Retour",
    DEPOSER:"Déposer la proposition",
    ENREGISTRER:"Enregistrer les modifications",
    MODIFIER:"Modifier la fiche",
    CHOISIR:"Sélectionnez un type d'initiative.",
    CHOIX_TITRE:"Quel type d'initiative ?",
    QUOTA_1:" proposition restante ce mois-ci.",
    QUOTA_0:"Quota du mois : épuisé.",
    QUOTA_NOTE:" Une proposition par membre et par mois. Le staff peut ouvrir un dossier hors quota en cas de crise.",
    NOTE_RELECTURE:"Toute proposition est relue par le staff avant l'ouverture du vote : la fiche reste en enrichissement ouvert jusqu'alors.",
    ERR_TYPE:"Choisissez d'abord un type d'initiative.",
    ERR_QUOTA:"Quota épuisé pour ce mois-ci — le staff peut ouvrir un dossier hors quota en cas de crise.",
    ERR_NOM:"Il manque un nom à l'initiative.",
    ERR_CTX:"Il manque le contexte — dites ce qui se passe si on ne fait rien.",
    ERR_OBJ:"Il manque l'objectif.",
    ERR_OPTS:"Deux options au minimum : la Marina ne finance pas l'évidence.",
    ERR_CONCEPTS:"Chaque option a besoin de son concept.",
    ERR_CO:"Un co-auteur de la communauté partenaire est obligatoire.",
    ERR_CO_INCONNU:"Ce co-auteur n'existe pas ou n'appartient pas à la communauté partenaire.",
    ERR_PLAFOND:function(net, com){ return "Plafond des 50 % : la cagnotte nette de " + com + " est de " + net + " — l'initiative est trop chère."; },
    ERR_COMMU:"Ta communauté n'est pas identifiable — préviens le staff.",
    OK:"Proposition déposée — enrichissement ouvert. Le vote s'ouvrira de la main du staff.",
    OK_EDIT:"Fiche mise à jour — l'enrichissement reste ouvert jusqu'au vote.",
    ERR_ENVOI:"L'envoi a échoué — rien n'a été écrit.",
    MONTANT:"Montant : ",
    PARTAGE:" · 1 000 / 1 000",
    AVANT_TITRE:"Avant de déposer",
    AVANT:[
      "Le montant finance la fiche — la mise en jeu du problème — pas les options.",
      "Pas plus de 50 % de la cagnotte nette : les fiches en vote retiennent déjà la leur.",
      "Fiche en attente : enrichissement ouvert jusqu'à l'ouverture du vote par le staff.",
      "En cas d'abandon, les fonds engagés ne reviennent jamais à l'avantage des joueurs."
    ]
  },

  /* ----- panneau de gestion staff ----- */
  STAFF: {
    TITRE:"Gestion Marina",
    RETOUR:"Retour à la marina",
    NOTE_VOTE:"Le vote ne s'ouvre que de la main du staff. Le plafond des 50 % de la cagnotte nette est revérifié au lancement.",
    NOTE_EDIT:"Le staff corrige avant l'ouverture du vote — les auteurs en sont prévenus par le résultat visible.",
    NOTE_CONSEQ:"Les conséquences se rédigent à la clôture : la paroisse d'abord, puis une case par groupe qui doit en savoir plus.",
    NOTE_DEBIT:"Le débit des cagnottes n'a lieu qu'à la clôture — jusque-là, la somme est affichée en gel d'engagement.",
    PRECISIONS_PH:"Ce que le staff attend des auteurs avant le vote — un point à préciser, un modèle à justifier, un responsable à nommer…",
    PRECISIONS_ERR:"Écrivez d'abord ce que vous attendez des auteurs.",
    OK_VOTE:"Vote ouvert — scrutin de 7 jours.",
    OK_PREC:"Demande envoyée — les auteurs la liront sur leur fiche.",
    OK_EDIT:"Fiche corrigée — prête à partir au vote.",
    OK_CONSEQ:"Conséquences consignées — chaque audience lira sa part, jamais celle des autres.",
    OK_CLOTURE:function(m){ return "Vote clôturé — " + m + " débités."; },
    OK_NONTRANCHEE:"Fiche classée non tranchée — les fonds restent en cagnotte.",
    OK_ENJEU:"Événement créé — la fiche est en jeu.",
    ERR_PLAFOND:function(com, m){ return "Plafond des 50 % : la cagnotte nette de " + com + " est de " + m + " — lance un dossier moins cher, ou attends une clôture."; },
    ERR_DE:"Indique le résultat du dé (1 à 2 pour départager les options A et B, 1 à 3 avec l'option C).",
    ERR_ECRIT:"L'écriture a échoué — réessaie.",
    ERR_QUORUM:function(q){ return "Le quorum (" + q + ") n'est pas atteint — classe en non tranchée."; },
    ERR_OPPO:"Une communauté est majoritairement opposée — la fiche ne peut que rester non tranchée.",
    ERR_FONDS:function(c){ return "La cagnotte " + c + " ne couvre pas l'engagement : corrige-la à la main avant de clôturer."; },
    QUORUM:function(q, n){ return "Quorum : " + n + " voix" + (n<q?" sur " + q + " requises":" — atteint") + "."; },
    LISTE_VIDE:"Rien par ici — le Bayou est calme. Savourons.",
    TRAVAIL_VIDE:"Choisissez une fiche dans la colonne de gauche.",
    TITRE_VOTE:"Revue avant ouverture du vote",
    TITRE_CLOTURE:"Votes à clôturer",
    TITRE_CONSEQ:"Fiches résolues ou en jeu",
    FICHES:"fiches",
    FICHE:"fiche",
    DECOMPTE:"Décompte",
    OPT_MAX:"Les options — trois au maximum",
    CLOTURER_OPT:function(k, n){ return "Clôturer — l'option " + k + " l'emporte (" + n + " voix)"; },
    NON_TRANCHEE:"Non tranchée",
    CONSIGNER_DE:"Consigner le dé (égalité)",
    DE_PH:"Dé de départage — résultat",
    NOTE_DE:"En cas d'égalité, le dé est tiré en public : 1 = première option, et ainsi de suite. Une inter ne se clôture que sur une vraie option — « s'y opposer » ne finance rien.",
    ISSUE_TITRE:"Issue du vote",
    EDIT_TITRE:"Édition de la fiche — avant l'ouverture du vote",
    OPT_TITRE:"Les options soumises au vote",
    CQ_TITRE:"Conséquences connues — qui sait quoi, à la clôture",
    CQ_TOUTES:"Tous les groupes ont déjà leur case de conséquences.",
    ENJEU_TITRE:"Passage en jeu",
    ENJEU_TXT:"Ce dossier a été clôturé sur une option. Son passage « en jeu » crée l'événement tdlev — décision staff.",
    ENJEU_BTN:"Passer en jeu — créer l'évent",
    PRECISIONS:"Précisions demandées",
    EDITER:"Éditer la fiche",
    OK_CONSEQ_BTN:"Enregistrer les conséquences",
    ENVOYER_DEMANDE:"Envoyer la demande",
    CQ_DEJA:"Ce groupe a déjà sa case de conséquences.",
    ANNULER:"Annuler",
    ENREGISTRER:"Enregistrer les modifications",
    DEMANDER:"Demander des précisions",
    OUVRIR_VOTE:function(j){ return "Ouvrir le vote — " + j + " jours"; },
    RESULTAT_OPT:function(k, t, v, tot){ return "L'option " + k + " — " + t + " — l'emporte, " + v + " voix sur " + tot + "."; },
    RESULTAT_JET:function(v){ return " Dé de départage tiré publiquement : " + v + " — consigné dans la fiche."; },
    RESULTAT_SOLO:function(m, com){ return " " + m + " engagés sur la cagnotte " + com + "."; },
    RESULTAT_INTER:" 1 000 $ engagés sur chaque cagnotte.",
    SANS_REVUE:"> 1 semaine sans revue"
  }
};

/* ===================== NOTIFICATIONS (sos-emi-notif) =====================
   Plage 240-249 réservée pour La Marina. À déclarer dans sos-emi-notif. */
var NOTIF = { NOUVELLE:240, VOTE:241, PRECISIONS:242, CLOTURE:243, CO:244 };

/* ===================== EXPORT ===================== */

window.MarinaConfig = {
  CFG:CFG, COMMU:COMMU, COMMU_DEFAUT:COMMU_DEFAUT, BANDES_KEY:BANDES_KEY,
  CHAMPS_VOLET:CHAMPS_VOLET, CHAMPS_STAFF:CHAMPS_STAFF,
  TYPES:TYPES, ST:ST, ICONES:ICONES, TEXTES:TEXTES, NOTIF:NOTIF
};

})();
