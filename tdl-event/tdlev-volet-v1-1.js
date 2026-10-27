/* THE DROWNED LANDS — LES ÉVÉNEMENTS · VOLET LATÉRAL
   Quatre usages dans un même volet :
     - demander un évent (choix du type, puis formulaire) ;
     - donner ou refuser son appui à la demande d'un autre ;
     - éditer le descriptif d'une fiche dont on est référent ;
     - se déclarer sur un évent ouvert.

   Le voile et le volet sont en position:fixed et REPARENTÉS sur <body>,
   comme au journal : les contextes d'empilement de ForumActif piègent un
   fixed laissé dans un message. Leurs couches (9020 et 9021) les placent
   au-dessus du panneau de gestion (9010) — voir CSS-evenements.css.

   QUOTA : une demande à la fois par joueur, et elle tient tant que l'évent
   qui en est né n'est pas clôturé. Le staff peut la libérer à la main.

   EXPOSE : window.TDLEvVolet
   DÉPEND DE : window.TDLEv, window.TDLEvUI, window.TDLEvPublic, window.TDLBase

   CARTE DES BLOCS : CONFIG · TEXTES · COQUE · CHOIX · FORMULAIRE · APPUI
                     · ÉDITION · ÉCRITURE · ÉVÉNEMENTS · INIT */

(function () {
"use strict";

/* ===================== CONFIG ===================== */

var V = null, U = null, RACINE = null, VOL = null, VEIL = null;

/* ===================== TEXTES ===================== */

var T = {
  TITRE_DEM:  "Demander un évent",
  TITRE_EDIT: "Éditer la fiche",
  TITRE_APP:  "Votre appui est demandé",
  QUEL_TYPE:  "Quel type d'événement ?",
  RENVOI_N:   "Une mission, un coup, une marée ?",
  RENVOI_D:   "Ces propositions se déposent dans le tableau de votre bande ou de votre "
            + "communauté, pas ici.",
  RENVOI_P:   "Voir les tableaux",
  NOTE_ACHAT: "Une demande n'est pas un achat : l'événement obtenu n'est au nom de personne. "
            + "Pour organiser une soirée à votre nom, passez par la Vie mondaine du Comptoir.",
  A_APPUYER:  "On attend votre réponse",
  EXAMINER:   "Examiner",
  MES_DEM:    "Mes demandes",
  CHOISIR:    "Sélectionnez un type d'événement",
  CONTINUER:  "Continuer",
  RETOUR:     "Retour",
  ENVOYER:    "Envoyer la demande",
  ENREGISTRER:"Enregistrer",
  APPUYER:    "Donner mon appui",
  REFUSER:    "Refuser",
  QUOTA:      "Une demande en cours à la fois",
  QUOTA_PLEIN:"Vous avez déjà une demande en cours. Attendez qu'elle soit traitée.",
  F_TITRE:    "Titre de l'événement",
  F_TITRE_A:  "Ce qu'on lira en tête de fiche",
  F_SOUS:     "Accroche",
  F_SOUS_A:   "Une phrase. Ce qui donne envie d'y entrer.",
  F_CTX:      "Contexte",
  F_CTX_A:    "La situation motivant l'existence de cet évent.",
  F_OBJ:      "Objectifs et thématiques",
  F_OBJ_A:    "Deux ou trois objectifs de jeu, un par ligne.",
  F_QUI:      "Qui est concerné",
  F_QUI_A:    "À partir de trois cochés dans une même famille, la fiche les replie.",
  F_PROJET:   "Projet communautaire concerné",
  F_PROJET_A: "Facultatif. L'événement apparaîtra aussi sur la fiche du projet.",
  F_ROLE:     "Votre rôle à cet évent",
  F_APPUIS:   "Vos deux appuis",
  F_VIGNETTE: "Vignette",
  F_PER:      "Période",
  F_PER_A:    "Septembre — novembre 1962, ou « Octobre 1962 ».",
  F_SUJET:    "Le sujet de l'événement",
  F_SUJET_A:  "Un évent membre se joue dans un seul sujet. Renseignez-le pour que votre fiche passe en « à rejoindre ».",
  F_SUJET_T:  "Titre du sujet",
  F_SUJET_U:  "Adresse du sujet",
  F_OUVERT:   "Ouvrir les inscriptions",
  F_OUVERT_A: "Votre fiche apparaîtra dans « à rejoindre ». Il faut un sujet renseigné.",
  F_CLORE:    "Mon événement est terminé",
  F_CLORE_A:  "Il passe en instance de clôture : le staff en tirera les conséquences.",
  E_URL:      "L'adresse du sujet n'est pas valide.",
  E_SANS_RP:  "Renseignez le sujet avant d'ouvrir les inscriptions.",
  APPUIS_N:   "Deux joueurs doivent trouver l'idée bonne avant qu'elle parte au staff. "
            + "Ils reçoivent une notification et ont sept jours pour répondre. "
            + "<b>Donner son appui n'inscrit à rien</b> — ils pourront se déclarer plus tard, "
            + "ou pas du tout.",
  APPUI_1:    "Premier appui", APPUI_2:"Second appui",
  APPUI_N:    "Vous ne vous inscrivez à rien en donnant votre appui. Vous dites seulement que "
            + "l'idée mérite d'exister. Si elle est acceptée, vous pourrez vous y déclarer "
            + "comme tout le monde, ou passer votre chemin.",
  APPUI_PAR:  "Proposé par",
  APPUI_ROLE: "Rôle du demandeur",
  APPUI_QUI:  "Qui est concerné",
  APPUI_DEL:  "Il vous reste ",
  APPUI_JOUR: " jour pour répondre", APPUI_JOURS:" jours pour répondre",
  E_TITRE:    "Donnez un titre à votre demande.",
  E_APPUIS:   "Choisissez deux appuis différents.",
  E_ECRIT:    "Envoi impossible. Réessayez dans un instant.",
  OK_ENVOI:   "Demande envoyée. Vos deux appuis ont été prévenus.",
  OK_EDIT:    "Fiche enregistrée.",
  OK_APPUI:   "Appui donné. La demande part au staff dès que l'autre a répondu.",
  OK_APPUI2:  "Appui donné. La demande part au staff.",
  OK_REFUS:   "Appui refusé. Le demandeur en est averti.",
  OK_DECL:    "Vous êtes déclaré. À vous de jouer.",
  ETAPES:     ["Demande déposée","Appui de ","Transmise au staff","Acceptée et mise en ligne"],
  ETATS:      { appuis:"En attente d'appui", file:"Chez le staff",
                precisions:"Précisions demandées", acceptee:"Acceptée",
                refusee:"Refusée", expiree:"Expirée" }
};

/* ===================== COQUE ===================== */

var S = { mode:null, type:null, portees:[], role:"jouer", cible:null };

function monter(){
  if (VOL) return;
  RACINE = window.TDLEvPublic.racine();
  if (!RACINE) return;
  VEIL = document.createElement("div");
  VEIL.className = "tdlev-veil"; VEIL.hidden = true;
  VOL = document.createElement("aside");
  VOL.className = "tdlev-vol"; VOL.hidden = true;
  VOL.innerHTML =
      '<header class="tdlev-vol-h"><h2 id="tdlev-vol-titre"></h2>'
    + '<button class="tdlev-vol-x" data-vol="fermer" title="Fermer">'
    + U.fit("cross-small") + '</button></header>'
    + '<div class="tdlev-vol-c" id="tdlev-vol-c"></div>'
    + '<footer class="tdlev-vol-p" id="tdlev-vol-p"></footer>';
  document.body.appendChild(VEIL);
  document.body.appendChild(VOL);
  VEIL.addEventListener("click", function(){ ouvrir(false); });
  VOL.addEventListener("click", surClic);
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && VOL && !VOL.hidden) ouvrir(false);
  });
}

function ouvrir(o){
  if (!VOL) return;
  if (o){
    VEIL.hidden = false; VOL.hidden = false;
    requestAnimationFrame(function(){
      VEIL.classList.add("est-ouvert"); VOL.classList.add("est-ouvert");
    });
  } else {
    VEIL.classList.remove("est-ouvert"); VOL.classList.remove("est-ouvert");
    setTimeout(function(){ VEIL.hidden = true; VOL.hidden = true; }, 300);
    S.mode = null; S.type = null; S.portees = []; S.role = "jouer"; S.cible = null;
  }
}

/* ===================== CHOIX ===================== */

function mesDemandes(){
  var p = V.monPseudo();
  return V.D.demandes.filter(function(d){ return d.demandeur === p; })
    .sort(function(a, b){ return String(b.cree || "").localeCompare(String(a.cree || "")); });
}
/* Les demandes où MON appui est attendu, et pas encore périmé. */
function appuisAttendus(){
  var k = V.cle(V.monPseudo() || "");
  return V.D.demandes.filter(function(d){
    if (d.statut !== "appuis") return false;
    var a = (d.appuis || {})[k];
    return a && a.etat === "attente" && (V.joursRestants(d.expire) || 0) >= 0;
  });
}
function quotaPris(){
  var vivantes = mesDemandes().filter(function(d){
    return d.statut === "appuis" || d.statut === "file" || d.statut === "precisions";
  });
  if (vivantes.length) return true;
  var p = V.monPseudo();
  return V.D.evenements.some(function(e){
    return e.origine === "demande" && e.referent === p
        && e.statut !== "cloture" && !e.quotaLibere;
  });
}

function etapes(d){
  var out = [["fait", T.ETAPES[0], V.dateFr(d.cree)]], refus = false;
  V.cles(d.appuis).forEach(function(k){
    var a = d.appuis[k] || {};
    var etat = a.etat === "donne" ? "fait" : (a.etat === "refuse" ? "refus" : "cours");
    if (a.etat === "refuse") refus = true;
    var dit = a.etat === "donne" ? "Donné le " + V.dateFr(a.le)
            : a.etat === "refuse" ? "Refusé le " + V.dateFr(a.le)
            : "En attente — " + Math.max(0, V.joursRestants(d.expire) || 0) + " jours restants";
    out.push([etat, T.ETAPES[1] + (a.nom || k), dit]);
  });
  if (!refus){
    out.push([(d.statut === "file" || d.statut === "acceptee") ? "fait" : "", T.ETAPES[2], ""]);
    out.push([d.statut === "acceptee" ? "fait" : "", T.ETAPES[3], ""]);
  }
  return out;
}

function carteDemande(d){
  var cl = (d.statut === "refusee" || d.statut === "expiree") ? "est-refus"
         : (d.statut === "acceptee") ? "est-ok" : "est-attente";
  return '<div class="tdlev-dem"><div class="tdlev-dem-h">'
    + '<span class="tdlev-etat ' + cl + '">' + (T.ETATS[d.statut] || d.statut) + '</span>'
    + '<span class="tdlev-dem-d">' + V.ilya(d.cree) + '</span></div>'
    + '<p class="tdlev-dem-t">' + V.esc(d.titre) + '</p>'
    + (d.mot ? '<p class="tdlev-vol-note">' + V.esc(d.mot) + '</p>' : '')
    + '<ul class="tdlev-etapes">' + etapes(d).map(function(e){
        return '<li class="tdlev-etape' + (e[0] ? " est-" + e[0] : "") + '">'
          + '<b>' + V.esc(e[1]) + '</b>' + V.esc(e[2]) + '</li>';
      }).join("") + '</ul></div>';
}

function vueChoix(){
  var h = "", att = appuisAttendus();
  if (att.length){
    h += '<p class="tdlev-vol-h2">' + T.A_APPUYER + '</p>' + att.map(function(d){
      return '<div class="tdlev-dem"><div class="tdlev-dem-h">'
        + '<span class="tdlev-etat est-attente">' + V.esc(d.demandeur) + '</span>'
        + '<span class="tdlev-dem-d">' + V.ilya(d.cree) + '</span></div>'
        + '<p class="tdlev-dem-t">' + V.esc(d.titre) + '</p>'
        + (d.sous ? '<p class="tdlev-vol-note" style="margin-top:8px">' + V.esc(d.sous) + '</p>' : '')
        + '<div class="tdlev-cta" style="margin-top:12px">'
        + '<button class="tdlev-btn" data-appui="' + V.esc(d.id) + '">' + T.EXAMINER + '</button>'
        + '</div></div>';
    }).join("");
  }

  h += '<p class="tdlev-vol-h2">' + T.QUEL_TYPE + '</p><div class="tdlev-opts">';
  V.TYPES_DEMANDE.forEach(function(t){
    h += '<button class="tdlev-opt" data-type="' + t.id + '" style="--c:' + t.c + '"'
       + ' aria-pressed="' + (S.type === t.id) + '">' + U.fis(t.ico)
       + '<span><span class="tdlev-opt-n">' + V.esc(t.nom) + '</span>'
       + '<span class="tdlev-opt-d">' + V.esc(t.desc) + '</span></span>'
       + '<span class="tdlev-opt-p">' + t.prix + '</span></button>';
  });
  h += '<div class="tdlev-opt est-renvoi">' + U.fis("list")
     + '<span><span class="tdlev-opt-n">' + T.RENVOI_N + '</span>'
     + '<span class="tdlev-opt-d">' + T.RENVOI_D + '</span></span>'
     + '<span class="tdlev-opt-p">' + T.RENVOI_P + '</span></div></div>'
     + '<p class="tdlev-vol-note">' + T.NOTE_ACHAT + '</p>';

  var l = mesDemandes();
  if (l.length) h += '<p class="tdlev-vol-h2">' + T.MES_DEM + '</p>' + l.map(carteDemande).join("");
  return h;
}

/* ===================== FORMULAIRE ===================== */

/* Tous les PJ sauf soi et ses propres comptes liés. La branche
   doubles_comptes est indexée par le PREMIER compte : il faut la parcourir
   entièrement, un pseudo pouvant être la clé OU une valeur. */
function pjDisponibles(){
  var moi = V.monPseudo(), liens = V.D.doublesComptes || {}, miens = [moi];
  V.cles(liens).forEach(function(premier){
    var l = V.vt(liens[premier] && liens[premier].comptes);
    if (premier === moi || l.indexOf(moi) > -1) miens = miens.concat([premier]).concat(l);
  });
  return V.cles(V.D.membres).filter(function(p){ return miens.indexOf(p) === -1; }).sort();
}

function vueFormulaire(){
  var t = V.TYPES_DEMANDE.filter(function(x){ return x.id === S.type; })[0];
  var pj = pjDisponibles();
  var h = '<p class="tdlev-vol-h2">' + V.esc(t.nom) + '</p>'
    + U.champ(T.F_TITRE, V.esc(T.F_TITRE_A), U.texte("tdlev-f-titre"))
    + U.champ(T.F_SOUS, V.esc(T.F_SOUS_A), U.texte("tdlev-f-sous"))
    + U.champ(T.F_CTX, V.esc(T.F_CTX_A), U.zone("tdlev-f-ctx"))
    + U.champ(T.F_OBJ, V.esc(T.F_OBJ_A), U.zone("tdlev-f-obj"))
    + U.champ(T.F_QUI, V.esc(T.F_QUI_A), U.portees(["comm","bandes"], S.portees, true));

  if (S.type === "communautaire")
    h += U.champ(T.F_PROJET, V.esc(T.F_PROJET_A),
      U.choix("tdlev-f-projet", V.vt(V.D.projets).map(function(p){ return p.nom || p; })));

  h += '<p class="tdlev-vol-h2">' + T.F_ROLE + '</p>' + U.radios("tdlev-role", V.ROLES_DEMANDE, S.role)
     + '<p class="tdlev-vol-h2">' + T.F_APPUIS + '</p>'
     + '<p class="tdlev-vol-note" style="margin-top:0">' + T.APPUIS_N + '</p>'
     + '<div class="tdlev-champ tdlev-deux">'
     + '<div><label>' + T.APPUI_1 + '</label>' + U.choix("tdlev-f-a1", pj) + '</div>'
     + '<div><label>' + T.APPUI_2 + '</label>' + U.choix("tdlev-f-a2", pj) + '</div></div>';
  return h;
}

/* ===================== APPUI ===================== */

/* Ce que voit celui dont on sollicite l'appui : l'idée entière, puisqu'il
   doit la juger — mais rien du circuit interne, et aucun bouton d'inscription. */
function vueAppui(){
  var d = S.cible; if (!d) return "";
  var j = Math.max(0, V.joursRestants(d.expire) || 0);
  var noms = V.cles(d.portees).map(function(k){ return (d.portees[k] || {}).nom || k; });

  var h = '<div class="tdlev-dem"><div class="tdlev-dem-h">'
    + '<span class="tdlev-etat est-attente">' + T.APPUI_PAR + " " + V.esc(d.demandeur) + '</span>'
    + '<span class="tdlev-dem-d">' + T.APPUI_DEL + j
    + (j > 1 ? T.APPUI_JOURS : T.APPUI_JOUR) + '</span></div>'
    + '<p class="tdlev-dem-t">' + V.esc(d.titre) + '</p>'
    + (d.sous ? '<p class="tdlev-vol-note" style="margin-top:8px">' + V.esc(d.sous) + '</p>' : '')
    + '</div>';

  if (d.contexte.length) h += '<p class="tdlev-vol-h2">' + T.F_CTX + '</p>'
    + d.contexte.map(function(x){ return '<p class="tdlev-f-p">' + V.esc(x) + '</p>'; }).join("");

  if (d.objectifs.length) h += '<p class="tdlev-vol-h2">' + T.F_OBJ + '</p><ul class="tdlev-obj">'
    + d.objectifs.map(function(x){ return '<li>' + V.esc(x) + '</li>'; }).join("") + '</ul>';

  h += '<p class="tdlev-vol-h2">' + T.APPUI_QUI + '</p><div class="tdlev-gens">'
    + (noms.length ? noms : [V.TEXTES.TOUTE]).map(function(n){
        return '<span>' + V.esc(n) + '</span>'; }).join("") + '</div>'
    + '<p class="tdlev-vol-h2">' + T.APPUI_ROLE + '</p>'
    + '<p class="tdlev-f-p">' + V.esc(V.ROLE_DIT[d.role] || d.role) + '</p>'
    + '<p class="tdlev-vol-note">' + T.APPUI_N + '</p>';
  return h;
}

/* ===================== ÉDITION ===================== */

function vueEdition(){
  var e = S.cible || {}, k = V.cles(e.rps)[0], rp = k ? e.rps[k] : {};
  return '<p class="tdlev-vol-h2">' + V.esc(e.titre || "") + '</p>'
    + U.champ(T.F_TITRE, "", U.texte("tdlev-f-titre", e.titre))
    + U.champ(T.F_SOUS, "", U.texte("tdlev-f-sous", e.sous))
    + U.champ(T.F_CTX, "", U.zone("tdlev-f-ctx", (e.contexte || []).join("\n")))
    + U.champ(T.F_OBJ, "", U.zone("tdlev-f-obj", (e.objectifs || []).join("\n")))
    + U.champ(T.F_PER, V.esc(T.F_PER_A), U.texte("tdlev-f-per", e.periode))
    + U.champ(T.F_QUI, V.esc(T.F_QUI_A), U.portees(["comm","bandes"], S.portees, true))
    + '<p class="tdlev-vol-h2">' + T.F_SUJET + '</p>'
    + '<p class="tdlev-vol-note" style="margin-top:0">' + T.F_SUJET_A + '</p>'
    + U.champ(T.F_SUJET_T, "", U.texte("tdlev-f-rpt", rp.titre))
    + U.champ(T.F_SUJET_U, "", U.texte("tdlev-f-rpu", rp.url, "https://…/t000-sujet"))
    + U.champ(T.F_VIGNETTE, "", U.texte("tdlev-f-vig", e.vignette, "URL de l'image"))
    + '<div class="tdlev-champ"><label><input type="checkbox" id="tdlev-f-ouvert"'
    + (e.ouvert ? " checked" : "") + '>' + T.F_OUVERT
    + '<span class="tdlev-aide">' + T.F_OUVERT_A + '</span></label></div>'
    + '<div class="tdlev-champ"><label><input type="checkbox" id="tdlev-f-clore"'
    + (e.aClore ? " checked" : "") + '>' + T.F_CLORE
    + '<span class="tdlev-aide">' + T.F_CLORE_A + '</span></label></div>';
}

/* ===================== ÉCRITURE ===================== */

function envoyer(){
  var titre = U.val("tdlev-f-titre");
  if (!titre){ U.toast(T.E_TITRE); return; }
  var a1 = U.val("tdlev-f-a1"), a2 = U.val("tdlev-f-a2");
  if (!a1 || !a2 || a1 === a2){ U.toast(T.E_APPUIS); return; }

  var appuis = {};
  [a1, a2].forEach(function(p){ appuis[V.cle(p)] = { nom:p, etat:"attente", le:null }; });

  var o = {
    schema: V.SCHEMA, demandeur: V.monPseudo(), categorie: S.type,
    titre: titre, sous: U.val("tdlev-f-sous"),
    contexte: U.lignes("tdlev-f-ctx"), objectifs: U.lignes("tdlev-f-obj"),
    portees: U.versNoeud(S.portees), projet: U.val("tdlev-f-projet") || null,
    role: S.role, appuis: appuis, statut: "appuis", mot: "",
    cree: V.maintenant(),
    expire: new Date(Date.now() + V.CFG.JOURS_APPUI * 86400000).toISOString()
  };
  window.TDLBase.ecrireEntree(V.CFG.NODE_DEM, V.nouvelId(), o, "demande d'évent")
    .then(function(ok){
      if (!ok){ U.toast(T.E_ECRIT); return; }
      [a1, a2].forEach(function(p){ U.notifier(p, V.NOTIF.APPUI, { titre:titre, de:o.demandeur }); });
      U.toast(T.OK_ENVOI); ouvrir(false); window.TDLEvPublic.rafraichir();
    });
}

/* Un appui écrit une seule feuille. Le passage en file n'a lieu que si
   l'AUTRE appui est déjà donné ; un refus, lui, tue la demande tout de suite. */
function repondreAppui(donne){
  var d = S.cible; if (!d) return;
  var k = V.cle(V.monPseudo()), champs = {};
  champs["appuis/" + k + "/etat"] = donne ? "donne" : "refuse";
  champs["appuis/" + k + "/le"]   = V.maintenant();

  var autres = V.cles(d.appuis).filter(function(x){ return x !== k; });
  var tous = donne && autres.every(function(x){ return (d.appuis[x] || {}).etat === "donne"; });
  if (!donne) champs.statut = "refusee";
  else if (tous) champs.statut = "file";

  window.TDLBase.ecrire(V.CFG.NODE_DEM, d.id, champs, "appui sur " + d.titre)
    .then(function(ok){
      if (!ok){ U.toast(T.E_ECRIT); return; }
      if (!donne) U.notifier(d.demandeur, V.NOTIF.REPONSE, { titre:d.titre, etat:"refusée" });
      else if (tous) U.notifierStaff(V.NOTIF.FILE, { titre:d.titre, de:d.demandeur });
      U.toast(donne ? (tous ? T.OK_APPUI2 : T.OK_APPUI) : T.OK_REFUS);
      ouvrir(false); window.TDLEvPublic.rafraichir();
    });
}

function enregistrerEdition(){
  var e = S.cible; if (!e) return;
  var url = U.val("tdlev-f-rpu"), titreRp = U.val("tdlev-f-rpt");
  if (url && !/^https?:\/\/\S+$/.test(url)){ U.toast(T.E_URL); return; }
  var ouvert = U.coche("tdlev-f-ouvert");
  if (ouvert && !url){ U.toast(T.E_SANS_RP); return; }

  var champs = {
    titre:U.val("tdlev-f-titre"), sous:U.val("tdlev-f-sous"),
    contexte:U.lignes("tdlev-f-ctx"), objectifs:U.lignes("tdlev-f-obj"),
    periode:U.val("tdlev-f-per"), portees:U.versNoeud(S.portees),
    vignette:U.val("tdlev-f-vig"),
    ouvert:ouvert, aClore:U.coche("tdlev-f-clore"),
    modifie:V.maintenant()
  };
  /* un évent membre n'a qu'un seul sujet : toujours la même clé, jamais deux */
  if (url) champs["rps/s0"] = { titre:titreRp || champs.titre, url:url };

  window.TDLBase.ecrire(V.CFG.NODE, e.id, champs, "édition de " + e.titre)
    .then(function(ok){
      U.toast(ok ? T.OK_EDIT : T.E_ECRIT);
      if (ok){ ouvrir(false); window.TDLEvPublic.rafraichir(); }
    });
}

function participer(ev){
  var p = V.monPseudo(); if (!p || !ev) return;
  var champs = {};
  champs["participants/" + V.cle(p)] = { nom:p, le:V.maintenant() };
  window.TDLBase.ecrire(V.CFG.NODE, ev.id, champs, "déclaration sur " + ev.titre)
    .then(function(ok){
      U.toast(ok ? T.OK_DECL : T.E_ECRIT);
      if (ok) window.TDLEvPublic.rafraichir();
    });
}

/* ===================== ÉVÉNEMENTS ===================== */

function pied(){
  if (S.mode === "appui")
    return '<button class="tdlev-btn est-fantome" data-vol="refuser">' + T.REFUSER + '</button>'
      + '<span class="tdlev-vol-p-txt"></span>'
      + '<button class="tdlev-btn" data-vol="appuyer">' + T.APPUYER + '</button>';
  if (S.mode === "edition")
    return '<button class="tdlev-btn est-fantome" data-vol="fermer">' + T.RETOUR + '</button>'
      + '<span class="tdlev-vol-p-txt"></span>'
      + '<button class="tdlev-btn" data-vol="enregistrer">' + T.ENREGISTRER + '</button>';
  if (!S.type)
    return '<span class="tdlev-vol-p-txt">' + T.CHOISIR + '</span>'
      + '<button class="tdlev-btn" disabled>' + T.CONTINUER + '</button>';
  return '<button class="tdlev-btn est-fantome" data-vol="retour">' + T.RETOUR + '</button>'
    + '<span class="tdlev-vol-p-txt">' + T.QUOTA + '</span>'
    + '<button class="tdlev-btn" data-vol="envoyer">' + T.ENVOYER + '</button>';
}

function rendre(){
  var c = document.getElementById("tdlev-vol-c");
  document.getElementById("tdlev-vol-titre").textContent =
    S.mode === "edition" ? T.TITRE_EDIT : (S.mode === "appui" ? T.TITRE_APP : T.TITRE_DEM);
  c.innerHTML = S.mode === "edition" ? vueEdition()
              : S.mode === "appui"   ? vueAppui()
              : (S.type ? vueFormulaire() : vueChoix());
  document.getElementById("tdlev-vol-p").innerHTML = pied();
  c.scrollTop = 0;

  /* les portées sont saisies dans deux vues : l'édition et le formulaire */
  var avecPortees = (S.mode === "edition") || (S.mode === "demande" && S.type);
  if (avecPortees) U.brancherChips(c, { comm:S.portees, bandes:S.portees });

  if (S.mode === "demande" && S.type)
    c.querySelectorAll('input[name="tdlev-role"]').forEach(function(r){
      r.addEventListener("change", function(){ S.role = r.value; });
    });
}

function surClic(e){
  var b = e.target.closest ? e.target.closest("button") : null;
  if (!b || !VOL.contains(b)) return;
  if (b.dataset.type){ S.type = b.dataset.type; rendre(); return; }
  if (b.dataset.appui){ appuiOuvrir(b.dataset.appui); return; }
  switch (b.dataset.vol){
    case "retour":      S.type = null; rendre(); break;
    case "fermer":      ouvrir(false); break;
    case "envoyer":     envoyer(); break;
    case "enregistrer": enregistrerEdition(); break;
    case "appuyer":     repondreAppui(true); break;
    case "refuser":     repondreAppui(false); break;
  }
}

/* ===================== INIT ===================== */

function demanderOuvrir(){
  if (quotaPris()) U.toast(T.QUOTA_PLEIN);
  S.mode = "demande"; S.type = null; S.portees = []; S.role = "jouer";
  rendre(); ouvrir(true);
}
function editerOuvrir(ev){
  if (!ev || !V.peutEditer(ev)) return;
  S.mode = "edition"; S.cible = ev;
  S.portees = V.cles(ev.portees).map(function(k){ return (ev.portees[k] || {}).nom || k; });
  rendre(); ouvrir(true);
}
function appuiOuvrir(id){
  var d = V.D.demandes.filter(function(x){ return x.id === id; })[0];
  if (!d) return;
  S.mode = "appui"; S.cible = d; rendre(); ouvrir(true);
}

function demarrer(){
  V = window.TDLEv; U = window.TDLEvUI;
  if (!V || !U || !window.TDLEvPublic || !window.TDLEvPublic.racine()){
    setTimeout(demarrer, 300); return;
  }
  monter();
  var b = document.getElementById("tdlev-demander");
  if (b) b.addEventListener("click", demanderOuvrir);
  document.addEventListener("tdlev:action", function(e){
    var d = e.detail || {};
    if (d.act === "editer") editerOuvrir(d.evenement);
    else if (d.act === "participer") participer(d.evenement);
  });
  /* Une notification d'appui mène ici : #tdlev-appui-{id} dans l'URL. */
  var m = String(location.hash || "").match(/^#tdlev-appui-(.+)$/);
  if (m) appuiOuvrir(m[1]);
}

if (document.readyState === "complete") setTimeout(demarrer, 0);
else window.addEventListener("load", function(){ setTimeout(demarrer, 0); });

window.TDLEvVolet = { ouvrir:demanderOuvrir, editer:editerOuvrir,
                      appui:appuiOuvrir, participer:participer };

})();
