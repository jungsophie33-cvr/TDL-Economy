/* THE DROWNED LANDS — LES ÉVÉNEMENTS · ÉCRANS DU PANNEAU DE GESTION
   Le rendu des quatre plans de travail du staff, et les textes du panneau.
   Aucune écriture, aucune navigation : tdlev-staff.js s'en charge.

   EXPOSE : window.TDLEvVues
   DÉPEND DE : window.TDLEv, window.TDLEvUI
   À CHARGER : avant tdlev-staff.js

   CARTE DES BLOCS : TEXTES · OUTILS · DOSSIERS · CLÔTURE · FICHE */

(function () {
"use strict";

function V(){ return window.TDLEv; }
function U(){ return window.TDLEvUI; }

/* ===================== TEXTES ===================== */

var T = {
  TITRE:      "Panneau de gestion",
  RETOUR:     "Retour au récapitulatif",
  NOUVELLE:   "Nouvel évent",
  VIDE:       "Rien à afficher.",
  RIEN:       "Rien à traiter.",
  ENTREE:     "entrée", ENTREES:"entrées",
  MARQ:       { demande:"Demande", cloture:"Clôture", tableau:"Tableau", fiche:"Fiche" },
  SECTIONS:   [ { id:"traiter",  ico:"inbox",   nom:"À traiter" },
                { id:"fiches",   ico:"list",    nom:"Les fiches" },
                { id:"classees", ico:"archive", nom:"Classées" } ],
  DOSSIER:    "Le dossier",
  A_LIRE:     "À lire avant de décider",
  REPONSE:    "Votre réponse",
  MOT:        "Mot au commanditaire",
  MOT_A:      "Envoyé avec la notification, quelle que soit la décision.",
  NOTE_ACC:   "Accepter crée l'évent avec les champs déjà remplis. Il restera à poser "
            + "les éléments importants, les liens et la vignette.",
  REFUSER:    "Refuser", PRECISIONS:"Demander des précisions",
  ACCEPTER:   "Accepter et créer l'évent",
  PARTS:      "Les participants",
  PARTS_T:    "Les participants confirmés",
  PARTS_N:    "« Suspect » reste inerte tant que l'action n'est pas déclarée connue de la paroisse.",
  PARTS_TN:   "Ces participants ont déjà été validés dans leur tableau : ils sont cochés "
            + "d'office. Il ne reste qu'à choisir ceux qui ont grillé leur discrétion.",
  PARTS_V:    "Personne ne s'est déclaré sur cet évent.",
  COL_PERS:   "Personnage", COL_RET:"participants", COL_NOM:"suspects",
  CONCL:      "La conclusion",
  F_ISSUE:    "Issue", F_JAUGE:"Jauge touchée", F_SENS:"Sens du mouvement", AUCUNE:"Aucune",
  NOTE_PB:    "La Pression du Bayou ne produit aucune contribution à la réputation. ",           
  F_PUBLIC:   "L'action est connue de la paroisse",
  F_PUBLIC_A: "Décochée, personne ne peut être suspecté et la mission n'est connue que de sa bande.",
  F_TEXTE:    "Conclusion retenue par la paroisse",
  F_TEXTE_A:  "Le texte affiché sur le descriptif une fois l'évent terminé.",
  CLOT_NOTE:  "La clôture applique badges et réputation",
  CLOTURER:   "Clôturer l'événement", LIBERER:"Libérer le quota du référent",
  REPERC:     "Cet évent a-t-il eu des répercussions sur la Paroisse ?",
  REPERC_N:   "Les données de la mission appartiennent à son tableau et ne sont pas modifiables. "
            + "On n'opère ici que la conclusion concernant jauges et réputation.",
  CLASSER:    "Classer sans suite", ENREG_CONCL:"Enregistrer la conclusion",
  CLASSEE_N:  "Cet évent a été classé sans suite : il n'a d'impact ni sur les jauges ni la réputation. "
            + "La conclusion peut être reprise si le jeu futur révèle de vraies conséquences.",
  REPRENDRE:  "Reprendre dans la file",
  LA_FICHE:   "L'événement",
  F_T:"Titre", F_S:"Accroche", F_CAT:"Catégorie", F_PER:"Période",
  F_CTX:"Contexte", F_OBJ:"Objectifs et thématiques",
  F_ELEM:"Éléments importants",
  F_ELEM_A:"Une ligne par élément : libellé, point-virgule, valeur.",
  F_LIENS:"Liens et ressources",
  F_LIENS_A:"Une ligne par lien : libellé, point-virgule, titre, point-virgule, URL.",
  F_RPS:"Sujets rattachés", F_RPS_A:"Une ligne par sujet : titre, point-virgule, URL.",
  F_VIG:"Vignette", F_QUI:"Qui est concerné",
  F_VISI:"Visibilité", F_VISI_PUB:"Public", F_VISI_RES:"Réservé aux bandes désignées",
  F_VISI_QUI:"Qui peut le voir",
  F_VISI_QUI_A:"Tant que l'évent n'est pas clôturé et déclaré connu de la paroisse, "
            + "il n'apparaît que pour ces bandes.",
  F_OUVERT:   "Les inscriptions sont ouvertes",
  F_RP:       "Permettre aux membres de contribuer via leurs topics RP",
  F_RP_A:     "Les participants pourront rattacher un sujet à la fiche, ou rejoindre "
            + "un sujet déjà joint. À réserver aux intrigues et aux événements "
            + "pouvant se dérouler sur plusieurs sujets.",
  F_DEBUT:    "Date de début",
  F_DEBUT_A:  "Au format 1962-11-02. Laissée vide, l'évent n'apparait jamais dans « à venir ».",
  F_UNE:      "Rang à la une",
  F_UNE_A:    "1 pour l'événement principal, 2 à 4 pour les secondaires. Vide sinon.",
  SUPPRIMER:  "Supprimer", ENREGISTRER:"Enregistrer", CREER:"Créer la fiche",
  OK_ACC:     "Demande acceptée, l'évent est créé.",
  OK_REF:     "Demande refusée.", OK_PREC:"Précisions demandées.",
  OK_CLOT:    "Événement clôturé.", OK_CONCL:"Conclusion enregistrée.",
  OK_CLASS:   "Event classé sans suite.", OK_REPR:"Event remis dans la file.",
  OK_FICHE:   "Event enregistré.", OK_SUPP:"Event supprimé.",
  E_ECRIT:    "Écriture impossible. Réessayez dans un instant.",
  C_SUPP:     "Supprimer définitivement cet évent ?"
};

var ISSUES = [["reussite","Réussite"],["mitigee","Mitigée"],["echec","Échec"]];
var SENS   = [["aggrave","Aggrave"],["apaise","Apaise"]];

/* ===================== OUTILS ===================== */

function dl(paires){
  return '<dl class="tdlev-g-doss">' + paires.map(function(p){
    return '<dt>' + V().esc(p[0]) + '</dt><dd>' + V().esc(p[1]) + '</dd>';
  }).join("") + '</dl>';
}
/* Liens de lecture : [[libellé, url], …]. Les URL sortent par window.open. */
function liens(l){
  l = (l || []).filter(function(x){ return x && x[0]; });
  if (!l.length) return "";
  return '<p class="tdlev-f-h">' + T.A_LIRE + '</p>' + l.map(function(x){
    return '<p style="margin:10px 0 0"><button class="tdlev-g-lien" data-url="'
      + V().esc(x[1] || "") + '">' + U().fit("link")
      + '<span>' + V().esc(x[0]) + '</span></button></p>';
  }).join("");
}
function noms(noeud){
  return V().cles(noeud).map(function(k){ return (noeud[k] || {}).nom || k; });
}

/* ===================== DOSSIERS ===================== */

function dossierDemande(d){
  var ap = V().cles(d.appuis).map(function(k){
    var a = d.appuis[k] || {};
    return (a.nom || k) + " (" + V().dateFr(a.le) + ")";
  });
  var p = noms(d.portees);
  return '<p class="tdlev-f-h">' + T.DOSSIER + '</p>' + dl([
    ["Accroche", d.sous || "—"],
    ["Contexte", d.contexte.join("\n") || "—"],
    ["Objectifs", d.objectifs.join(" — ") || "—"],
    ["Qui est concerné", p.length ? p.join(" · ") : V().TEXTES.TOUTE],
    ["Projet communautaire", d.projet || "—"],
    ["Rôle du demandeur", V().ROLE_DIT[d.role] || d.role],
    ["Appuis", ap.join(" · ")]
  ])
    + '<p class="tdlev-f-h">' + T.REPONSE + '</p>'
    + U().champ(T.MOT, V().esc(T.MOT_A), U().zone("tdlev-g-mot", d.mot))
    + '<p class="tdlev-g-note">' + T.NOTE_ACC + '</p>';
}

function dossierReprise(r){
  return '<p class="tdlev-f-h">' + T.DOSSIER + '</p>' + dl([
    ["Résumé du référent", r.sous || "—"],
    ["Contexte", (r.contexte || []).join("\n") || "—"],
    /* ce que le référent a écrit À LA CLÔTURE, jamais le contexte d'ouverture */
    ["Conséquences annoncées", (r.consequences || []).join("\n") || "—"],
    ["Participants validés par le tableau", noms(r.participants).join(" · ") || "—"]
  ]) + liens([ [r.urlRp ? "Le sujet RP" : "", r.urlRp], [r.source, r.urlSource] ]);
}

/* ===================== CLÔTURE ===================== */

/* Deux colonnes de cases : retenu, puis nommé. La seconde reste inerte tant
   que l'action n'est pas déclarée connue de la paroisse — c'est la règle
   d'attribution, rendue physique. `figee` interdit d'ajouter quelqu'un que
   le tableau d'origine n'a pas validé. */
function participants(ev, titre, note, figee){
  var l = V().cles(ev.participants);
  if (!l.length) return '<p class="tdlev-f-h">' + titre + '</p>'
    + '<p class="tdlev-g-note">' + T.PARTS_V + '</p>';
  return '<p class="tdlev-f-h">' + titre + '</p>'
    + (note ? '<p class="tdlev-g-note">' + note + '</p>' : '')
    + '<div class="tdlev-g-part"><div class="tdlev-g-part-h">'
    + '<span>' + T.COL_PERS + '</span><span>' + T.COL_RET + '</span>'
    + '<span>' + T.COL_NOM + '</span></div>'
    + l.map(function(k){
        var nom = (ev.participants[k] || {}).nom || k, r = ev.retenus[k];
        return '<div class="tdlev-g-part-l">'
          + '<span class="tdlev-g-part-n">' + V().esc(nom) + '</span>'
          + '<span><input type="checkbox" data-ret="' + V().esc(k) + '"'
          + ' data-nom="' + V().esc(nom) + '"'
          + ((r || (!r && !figee && !ev.conclusion)) ? " checked" : "")
          + (figee ? " disabled" : "") + '></span>'
          + '<span><input type="checkbox" class="tdlev-nomme" data-nom-de="' + V().esc(k) + '"'
          + (r && r.nomme ? " checked" : "") + ' disabled></span></div>';
      }).join("") + '</div>';
}

function conclusion(c){
  c = c || {};
  var jauges = [{ v:"aucune", l:T.AUCUNE }].concat(V().cles(V().JAUGES).map(function(k){
    return { v:k, l:V().JAUGES[k] };
  }));
  return '<p class="tdlev-f-h">' + T.CONCL + '</p>'
    + U().champ(T.F_ISSUE, "", U().choix("tdlev-c-issue",
        ISSUES.map(function(x){ return { v:x[0], l:x[1] }; }), c.issue))
    + '<div class="tdlev-champ tdlev-deux">'
    + '<div><label>' + T.F_JAUGE + '</label>'
    + U().choix("tdlev-c-jauge", jauges, c.jauge || "aucune") + '</div>'
    + '<div><label>' + T.F_SENS + '</label>'
    + U().choix("tdlev-c-sens", SENS.map(function(x){ return { v:x[0], l:x[1] }; }),
        c.sens || "aggrave") + '</div></div>'
    + '<p class="tdlev-g-note" id="tdlev-c-note">' + T.NOTE_PB + '</p>'
    + '<div class="tdlev-champ"><label><input type="checkbox" id="tdlev-c-public"'
    + (c.public ? " checked" : "") + '>' + T.F_PUBLIC
    + '<span class="tdlev-aide">' + T.F_PUBLIC_A + '</span></label></div>'
    + U().champ(T.F_TEXTE, V().esc(T.F_TEXTE_A), U().zone("tdlev-c-texte", c.texte));
}

/* ===================== FICHE ===================== */

/* Les nœuds à clés sont édités en texte, une ligne par entrée, champs
   séparés par un point-virgule : plus simple à relire qu'une pile de champs,
   et la relecture reste possible après coup. */
function enLignes(noeud, champs){
  return V().cles(noeud).map(function(k){
    var x = noeud[k] || {};
    return champs.map(function(c){ return x[c] || ""; }).join(" ; ");
  }).join("\n");
}

function fiche(ev, portees, visi){
  ev = ev || V().normaliser({});
  var cats = V().ORDRE_CAT.map(function(k){ return { v:k, l:V().CATEGORIES[k].nom }; });

  return '<p class="tdlev-f-h">' + T.LA_FICHE + '</p>'
    + U().champ(T.F_T, "", U().texte("tdlev-f-titre", ev.titre))
    + U().champ(T.F_S, "", U().texte("tdlev-f-sous", ev.sous))
    + '<div class="tdlev-champ tdlev-deux">'
    + '<div><label>' + T.F_CAT + '</label>'
    + U().choix("tdlev-f-cat", cats, ev.categorie) + '</div>'
    + '<div><label>' + T.F_PER + '</label>'
    + U().texte("tdlev-f-per", ev.periode, "Septembre — novembre 1962") + '</div></div>'
    + U().champ(T.F_CTX, "", U().zone("tdlev-f-ctx", ev.contexte.join("\n")))
    + U().champ(T.F_OBJ, "", U().zone("tdlev-f-obj", ev.objectifs.join("\n")))
    + U().champ(T.F_ELEM, V().esc(T.F_ELEM_A),
        U().zone("tdlev-f-elem", enLignes(ev.elements, ["libelle","valeur"])))
    + U().champ(T.F_LIENS, V().esc(T.F_LIENS_A),
        U().zone("tdlev-f-liens", enLignes(ev.liens, ["libelle","titre","url"])))
    + U().champ(T.F_RPS, V().esc(T.F_RPS_A),
        U().zone("tdlev-f-rps", enLignes(ev.rps, ["titre","url"])))
    + U().champ(T.F_QUI, "", U().portees(["gcomm","gbandes"], portees, true))
    + '<div class="tdlev-champ tdlev-deux">'
    + '<div><label>' + T.F_VIG + '</label>'
    + U().texte("tdlev-f-vig", ev.vignette, "URL de l'image") + '</div>'
    + '<div><label>' + T.F_DEBUT + '</label>'
    + U().texte("tdlev-f-debut", ev.debut, "1962-11-02")
    + '<span class="tdlev-aide">' + T.F_DEBUT_A + '</span></div></div>'
    + '<div class="tdlev-champ"><label><input type="checkbox" id="tdlev-f-ouvert"'
    + (ev.ouvert ? " checked" : "") + '>' + T.F_OUVERT + '</label></div>'
    + '<div class="tdlev-champ"><label><input type="checkbox" id="tdlev-f-rp"'
    + (ev.rpOuvert ? " checked" : "") + '>' + T.F_RP
    + '<span class="tdlev-aide">' + T.F_RP_A + '</span></label></div>'
    + U().champ(T.F_UNE, V().esc(T.F_UNE_A), U().texte("tdlev-f-une", ev.aLaUne || ""))
    + '<div class="tdlev-champ"><label>' + T.F_VISI + '</label>'
    + U().choix("tdlev-f-visi",
        [{ v:"publique", l:T.F_VISI_PUB }, { v:"bandes", l:T.F_VISI_RES }], ev.visibilite)
    + '</div>'
    + '<div class="tdlev-champ" id="tdlev-f-visi-bloc"'
    + (ev.visibilite === "bandes" ? "" : " hidden") + '>'
    + '<label>' + T.F_VISI_QUI + '<span class="tdlev-aide">' + T.F_VISI_QUI_A + '</span></label>'
    + U().groupe("Bandes et réseaux", "gvisi", V().BANDES, visi) + '</div>';
}

window.TDLEvVues = {
  T:T, dl:dl, liens:liens, noms:noms,
  dossierDemande:dossierDemande, dossierReprise:dossierReprise,
  participants:participants, conclusion:conclusion, fiche:fiche
};

})();
