/* THE DROWNED LANDS — LES ÉVÉNEMENTS · VOLET LATÉRAL
   Demander un évent, donner son appui, éditer le descriptif, se déclarer.

   Le volet est monté DANS la coque .tdlev : son z-index le place au-dessus
   du panneau de gestion, pour qu'une édition ouverte depuis le panneau reste
   visible. Voir l'échelle des couches dans CSS-evenements.css.

   QUOTA : une demande à la fois par joueur, et elle tient tant que l'évent
   qui en est né n'est pas clôturé. Le staff peut la libérer à la main.

   EXPOSE : window.TDLEvVolet, window.TDLEvUI (composant de pastilles,
            partagé avec tdlev-staff.js)
   DÉPEND DE : window.TDLEv, window.TDLEvPublic, window.TDLBase

   CARTE DES BLOCS : CONFIG · TEXTES · PASTILLES · COQUE · CHOIX
                     · FORMULAIRE · ÉDITION · ÉCRITURE · ÉVÉNEMENTS · INIT */

(function () {
"use strict";

/* ===================== CONFIG ===================== */

var V = null, RACINE = null, VOL = null, VEIL = null;

/* Ce que le bouton couvre : seulement ce qu'aucun tableau n'offre. */
var TYPES = [
  { id:"communautaire", ico:"users", c:"var(--gr2-color)", prix:"Gratuit",
    nom:"Événement communautaire",
    desc:"Rassembler plusieurs communautés, ou faire avancer un projet communautaire. "
       + "Il n'appartient à personne : le forum le reprend." },
  { id:"bande", ico:"skull", c:"var(--gr6-color)", prix:"Gratuit",
    nom:"Événement de bande",
    desc:"Ce qu'aucun tableau ne couvre : une traque interne, une opération qui mêle "
       + "bandes, communautés et forces de l'ordre." },
  { id:"tradition", ico:"flame", c:"var(--gr3-color)", prix:"Gratuit",
    nom:"Tradition",
    desc:"Un rendez-vous qui revient chaque année et qui manque encore au calendrier "
       + "de la paroisse." }
];

/* [MAJ] codes de notification à déclarer dans sos-emi-notif (plage 230-239). */
var NOTIF = { APPUI:230, REPONSE:231, FILE:232 };

/* ===================== TEXTES ===================== */

var T = {
  TITRE_DEM:  "Demander un évent",
  TITRE_EDIT: "Éditer la fiche",
  QUEL_TYPE:  "Quel type d'événement ?",
  RENVOI_N:   "Une mission, un coup, une marée ?",
  RENVOI_D:   "Ces propositions se déposent dans le tableau de votre bande ou de votre "
            + "communauté, pas ici.",
  RENVOI_P:   "Voir les tableaux",
  NOTE_ACHAT: "Une demande n'est pas un achat : l'événement obtenu n'est au nom de personne. "
            + "Pour organiser une soirée à votre nom, passez par la Vie mondaine du Comptoir.",
  MES_DEM:    "Mes demandes",
  CHOISIR:    "Sélectionnez un type d'événement",
  CONTINUER:  "Continuer",
  RETOUR:     "Retour",
  ENVOYER:    "Envoyer la demande",
  ENREGISTRER:"Enregistrer",
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
  F_AFFICHE:  "Affiché sur la fiche",
  F_ROLE:     "Votre rôle à cet évent",
  R_JOUER:    "J'y joue un personnage",
  R_JOUER_D:  "Vous participez comme les autres. Vous pouvez être retenu à la clôture.",
  R_MJ:       "Je veux seulement animer cet évent en tant que MJ",
  R_MJ_D:     "Vous tenez les PNJ et les péripéties sans y jouer. Pas de badge de participation.",
  R_IDEE:     "Je propose seulement l'idée",
  R_IDEE_D:   "Le staff la reprend et l'anime. Votre nom n'apparaît pas sur la fiche.",
  F_APPUIS:   "Vos deux appuis",
  APPUIS_N:   "Deux joueurs doivent trouver l'idée bonne avant qu'elle parte au staff. "
            + "Ils reçoivent une notification et ont sept jours pour répondre. "
            + "<b>Donner son appui n'inscrit à rien</b> — ils pourront se déclarer plus tard, "
            + "ou pas du tout.",
  APPUI_1:    "Premier appui", APPUI_2:"Second appui",
  COMM:       "Communautés", BANDES:"Bandes et réseaux",
  TOUT:       "Tout afficher", REPLIER:"Replier",
  E_TITRE:    "Donnez un titre à votre demande.",
  E_APPUIS:   "Choisissez deux appuis différents.",
  E_ECRIT:    "Envoi impossible. Réessayez dans un instant.",
  OK_ENVOI:   "Demande envoyée. Vos deux appuis ont été prévenus.",
  OK_EDIT:    "Fiche enregistrée.",
  ETAPES:     ["Demande déposée","Appui de ","Transmise au staff","Acceptée et mise en ligne"],
  ETATS:      { appuis:"En attente d'appui", file:"Chez le staff", precisions:"Précisions demandées",
                acceptee:"Acceptée", refusee:"Refusée", expiree:"Expirée" }
};

/* ===================== PASTILLES ===================== */
/* Composant partagé avec le panneau de gestion : deux familles, repli à une
   ligne, bouton + pour déplier. L'état est un simple tableau de noms. */

function fit(n){ return '<i class="fi fi-tr-' + n + '"></i>'; }
function fis(n){ return '<i class="fi fi-sr-' + n + '"></i>'; }

function groupe(titre, cle, liste, sel){
  return '<div class="tdlev-grp"><div class="tdlev-grp-h"><b>' + V.esc(titre) + '</b><i></i>'
    + '<button type="button" class="tdlev-plus" data-plus="' + cle + '" aria-expanded="false" title="'
    + T.TOUT + '">' + fit("plus-small") + '</button></div>'
    + '<div class="tdlev-chips est-replie" id="tdlev-chips-' + cle + '">'
    + liste.map(function(p){
        return '<button type="button" class="tdlev-chip" data-grp="' + cle + '" data-portee="'
          + V.esc(p) + '" aria-pressed="' + (sel.indexOf(p) > -1) + '">' + V.esc(p) + '</button>';
      }).join("") + '</div></div>';
}

function brancherChips(racine, etats, apres){
  racine.querySelectorAll("[data-portee]").forEach(function(b){
    b.addEventListener("click", function(){
      var sel = etats[b.dataset.grp]; if (!sel) return;
      var p = b.dataset.portee, i = sel.indexOf(p);
      if (i > -1) sel.splice(i, 1); else sel.push(p);
      b.setAttribute("aria-pressed", i > -1 ? "false" : "true");
      if (apres) apres();
    });
  });
  racine.querySelectorAll("[data-plus]").forEach(function(b){
    b.addEventListener("click", function(){
      var boite = document.getElementById("tdlev-chips-" + b.dataset.plus);
      var replie = boite.classList.toggle("est-replie");
      b.setAttribute("aria-expanded", replie ? "false" : "true");
      b.innerHTML = replie ? fit("plus-small") : fit("minus-small");
      b.title = replie ? T.TOUT : T.REPLIER;
    });
  });
}

function apercu(sel){
  function replier(fam, pluriel){
    var pris = fam.filter(function(x){ return sel.indexOf(x) > -1; });
    if (!pris.length) return "";
    return pris.length >= 3 ? pluriel : pris.join(", ");
  }
  var b = [ replier(V.COMMUNAUTES, V.TEXTES.PLUS_COMM),
            replier(V.BANDES, V.TEXTES.PLUS_BANDES) ].filter(Boolean);
  return b.length ? b.join(" · ") : V.TEXTES.TOUTE;
}

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
    + '<button class="tdlev-vol-x" data-vol="fermer" title="Fermer">' + fit("cross-small") + '</button>'
    + '</header>'
    + '<div class="tdlev-vol-c" id="tdlev-vol-c"></div>'
    + '<footer class="tdlev-vol-p" id="tdlev-vol-p"></footer>';
  RACINE.appendChild(VEIL);
  RACINE.appendChild(VOL);
  VEIL.addEventListener("click", function(){ ouvrir(false); });
  VOL.addEventListener("click", surClic);
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && !VOL.hidden) ouvrir(false);
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

/* Mes demandes, avec leur colonne d'étapes. Une demande refusée s'arrête à
   l'étape du refus : les suivantes n'ont pas eu lieu. */
function etapes(d){
  var out = [["fait", T.ETAPES[0], V.dateFr(d.cree)]];
  var refus = false;
  V.cles(d.appuis).forEach(function(k){
    var a = d.appuis[k] || {};
    var etat = a.etat === "donne" ? "fait" : (a.etat === "refuse" ? "refus" : "cours");
    if (a.etat === "refuse") refus = true;
    var dit = a.etat === "donne" ? "Donné le " + V.dateFr(a.le)
            : a.etat === "refuse" ? "Refusé le " + V.dateFr(a.le)
            : "En attente — " + (V.joursRestants(d.expire) || 0) + " jours restants";
    out.push([etat, T.ETAPES[1] + (a.nom || k), dit]);
  });
  if (!refus){
    out.push([d.statut === "file" || d.statut === "acceptee" ? "fait" : "", T.ETAPES[2], ""]);
    out.push([d.statut === "acceptee" ? "fait" : "", T.ETAPES[3], ""]);
  }
  return out;
}

function mesDemandes(){
  var p = V.monPseudo();
  return V.D.demandes.filter(function(d){ return d.demandeur === p; })
    .sort(function(a,b){ return String(b.cree||"").localeCompare(String(a.cree||"")); });
}

/* Le quota : une demande vivante, ou un évent né d'elle encore ouvert. */
function quotaPris(){
  var vivantes = mesDemandes().filter(function(d){
    return d.statut === "appuis" || d.statut === "file" || d.statut === "precisions";
  });
  if (vivantes.length) return true;
  var p = V.monPseudo();
  return V.D.evenements.some(function(e){
    return e.origine === "demande" && e.referent === p && e.statut !== "cloture" && !e.quotaLibere;
  });
}

function vueChoix(){
  var h = '<p class="tdlev-vol-h2">' + T.QUEL_TYPE + '</p><div class="tdlev-opts">';
  TYPES.forEach(function(t){
    h += '<button class="tdlev-opt" data-type="' + t.id + '" style="--c:' + t.c + '"'
       + ' aria-pressed="' + (S.type === t.id) + '">' + fis(t.ico)
       + '<span><span class="tdlev-opt-n">' + V.esc(t.nom) + '</span>'
       + '<span class="tdlev-opt-d">' + V.esc(t.desc) + '</span></span>'
       + '<span class="tdlev-opt-p">' + t.prix + '</span></button>';
  });
  h += '<div class="tdlev-opt est-renvoi">' + fis("list")
     + '<span><span class="tdlev-opt-n">' + T.RENVOI_N + '</span>'
     + '<span class="tdlev-opt-d">' + T.RENVOI_D + '</span></span>'
     + '<span class="tdlev-opt-p">' + T.RENVOI_P + '</span></div></div>'
     + '<p class="tdlev-vol-note">' + T.NOTE_ACHAT + '</p>';

  var l = mesDemandes();
  if (l.length){
    h += '<p class="tdlev-vol-h2">' + T.MES_DEM + '</p>' + l.map(function(d){
      var cl = d.statut === "refusee" || d.statut === "expiree" ? "est-refus"
             : d.statut === "acceptee" ? "est-ok" : "est-attente";
      return '<div class="tdlev-dem"><div class="tdlev-dem-h">'
        + '<span class="tdlev-etat ' + cl + '">' + (T.ETATS[d.statut] || d.statut) + '</span>'
        + '<span class="tdlev-dem-d">' + V.ilya(d.cree) + '</span></div>'
        + '<p class="tdlev-dem-t">' + V.esc(d.titre) + '</p>'
        + (d.mot ? '<p class="tdlev-vol-note">' + V.esc(d.mot) + '</p>' : '')
        + '<ul class="tdlev-etapes">' + etapes(d).map(function(e){
            return '<li class="tdlev-etape' + (e[0] ? " est-" + e[0] : "") + '">'
              + '<b>' + V.esc(e[1]) + '</b>' + V.esc(e[2]) + '</li>';
          }).join("") + '</ul></div>';
    }).join("");
  }
  return h;
}

/* ===================== FORMULAIRE ===================== */

function champ(lib, aide, corps){
  return '<div class="tdlev-champ"><label>' + V.esc(lib)
    + (aide ? '<span class="tdlev-aide">' + aide + '</span>' : '') + '</label>' + corps + '</div>';
}
function listeOptions(l){
  return '<option value="">—</option>' + l.map(function(x){
    return '<option>' + V.esc(x) + '</option>'; }).join("");
}

/* Les appuis : tous les PJ sauf soi et sauf ses propres comptes liés.
   La branche doubles_comptes est indexée par le PREMIER compte : il faut la
   parcourir entièrement, un pseudo pouvant être la clé OU une valeur. */
function pjDisponibles(){
  var moi = V.monPseudo(), liens = V.D.doublesComptes || {}, miens = [moi];
  V.cles(liens).forEach(function(premier){
    var l = V.vt(liens[premier] && liens[premier].comptes);
    if (premier === moi || l.indexOf(moi) > -1) miens = miens.concat([premier]).concat(l);
  });
  return V.cles(V.D.membres).filter(function(p){ return miens.indexOf(p) === -1; }).sort();
}

function vueFormulaire(){
  var t = TYPES.filter(function(x){ return x.id === S.type; })[0];
  var pj = pjDisponibles();
  var h = '<p class="tdlev-vol-h2">' + V.esc(t.nom) + '</p>'
    + champ(T.F_TITRE, V.esc(T.F_TITRE_A), '<input type="text" id="tdlev-f-titre">')
    + champ(T.F_SOUS, V.esc(T.F_SOUS_A), '<input type="text" id="tdlev-f-sous">')
    + champ(T.F_CTX, V.esc(T.F_CTX_A), '<textarea id="tdlev-f-ctx"></textarea>')
    + champ(T.F_OBJ, V.esc(T.F_OBJ_A), '<textarea id="tdlev-f-obj"></textarea>')
    + champ(T.F_QUI, V.esc(T.F_QUI_A),
        groupe(T.COMM, "comm", V.COMMUNAUTES, S.portees)
        + groupe(T.BANDES, "bandes", V.BANDES, S.portees)
        + '<p class="tdlev-apercu"><b>' + T.F_AFFICHE + '</b>'
        + '<span id="tdlev-apercu">' + V.esc(apercu(S.portees)) + '</span></p>');

  if (S.type === "communautaire")
    h += champ(T.F_PROJET, V.esc(T.F_PROJET_A),
      '<select id="tdlev-f-projet">' + listeOptions(V.vt(V.D.projets).map(function(p){
        return p.nom || p; })) + '</select>');

  h += '<p class="tdlev-vol-h2">' + T.F_ROLE + '</p>'
    + [["jouer",T.R_JOUER,T.R_JOUER_D],["mj",T.R_MJ,T.R_MJ_D],["idee",T.R_IDEE,T.R_IDEE_D]]
      .map(function(r){
        return '<label class="tdlev-radio"><input type="radio" name="tdlev-role" value="' + r[0] + '"'
          + (S.role === r[0] ? " checked" : "") + '>'
          + '<span><b>' + V.esc(r[1]) + '</b><span>' + V.esc(r[2]) + '</span></span></label>';
      }).join("");

  h += '<p class="tdlev-vol-h2">' + T.F_APPUIS + '</p>'
    + '<p class="tdlev-vol-note" style="margin-top:0">' + T.APPUIS_N + '</p>'
    + '<div class="tdlev-champ tdlev-deux">'
    + '<div><label>' + T.APPUI_1 + '</label><select id="tdlev-f-a1">' + listeOptions(pj) + '</select></div>'
    + '<div><label>' + T.APPUI_2 + '</label><select id="tdlev-f-a2">' + listeOptions(pj) + '</select></div></div>';
  return h;
}

/* ===================== ÉDITION ===================== */

/* Le référent édite le DESCRIPTIF seulement. Ni statut, ni participants, ni
   conclusion : rien de ce qui produit une conséquence. */
function vueEdition(){
  var e = S.cible || {};
  return '<p class="tdlev-vol-h2">' + V.esc(e.titre || "") + '</p>'
    + champ(T.F_TITRE, "", '<input type="text" id="tdlev-f-titre" value="' + V.esc(e.titre) + '">')
    + champ(T.F_SOUS, "", '<input type="text" id="tdlev-f-sous" value="' + V.esc(e.sous) + '">')
    + champ(T.F_CTX, "", '<textarea id="tdlev-f-ctx">' + V.esc(e.contexte.join("\n")) + '</textarea>')
    + champ(T.F_OBJ, "", '<textarea id="tdlev-f-obj">' + V.esc(e.objectifs.join("\n")) + '</textarea>')
    + champ("Vignette", "", '<input type="text" id="tdlev-f-vig" value="' + V.esc(e.vignette || "") + '">');
}

/* ===================== ÉCRITURE ===================== */

function val(id){ var n = document.getElementById(id); return n ? String(n.value || "").trim() : ""; }
function lignes(id){ return val(id).split("\n").map(function(x){ return x.trim(); }).filter(Boolean); }
function toast(txt){
  try { if (window.EcoCore && window.EcoCore.toast) { window.EcoCore.toast(txt); return; } } catch(e){}
  try { window.alert(txt); } catch(e){}
}
function notifier(pseudo, code, data){
  try { if (window.EcoNotif && window.EcoNotif.a) window.EcoNotif.a(pseudo, code, data || {}); }
  catch(e){}
}

function envoyer(){
  var titre = val("tdlev-f-titre");
  if (!titre){ toast(T.E_TITRE); return; }
  var a1 = val("tdlev-f-a1"), a2 = val("tdlev-f-a2");
  if (!a1 || !a2 || a1 === a2){ toast(T.E_APPUIS); return; }

  var now = V.maintenant();
  var expire = new Date(Date.now() + V.CFG.JOURS_APPUI * 86400000).toISOString();
  var appuis = {};
  [a1, a2].forEach(function(p){ appuis[V.cle(p)] = { nom:p, etat:"attente", le:null }; });
  var portees = {};
  S.portees.forEach(function(p){ portees[V.cle(p)] = { nom:p }; });

  var o = {
    schema: V.SCHEMA, demandeur: V.monPseudo(), categorie: S.type,
    titre: titre, sous: val("tdlev-f-sous"),
    contexte: lignes("tdlev-f-ctx"), objectifs: lignes("tdlev-f-obj"),
    portees: portees, projet: val("tdlev-f-projet") || null,
    role: S.role, appuis: appuis, statut: "appuis",
    mot: "", cree: now, expire: expire
  };
  var id = V.nouvelId();
  window.TDLBase.ecrireEntree(V.CFG.NODE_DEM, id, o, "demande d'évent").then(function(ok){
    if (!ok){ toast(T.E_ECRIT); return; }
    [a1, a2].forEach(function(p){ notifier(p, NOTIF.APPUI, { titre:titre, de:o.demandeur }); });
    toast(T.OK_ENVOI);
    ouvrir(false);
    window.TDLEvPublic.rafraichir();
  });
}

function enregistrerEdition(){
  var e = S.cible; if (!e) return;
  var champs = {
    titre:     val("tdlev-f-titre"),
    sous:      val("tdlev-f-sous"),
    contexte:  lignes("tdlev-f-ctx"),
    objectifs: lignes("tdlev-f-obj"),
    vignette:  val("tdlev-f-vig"),
    modifie:   V.maintenant()
  };
  window.TDLBase.ecrire(V.CFG.NODE, e.id, champs, "édition de " + e.titre).then(function(ok){
    toast(ok ? T.OK_EDIT : T.E_ECRIT);
    if (ok){ ouvrir(false); window.TDLEvPublic.rafraichir(); }
  });
}

/* Se déclarer sur un évent ouvert : une seule feuille écrite. */
function participer(ev){
  var p = V.monPseudo(); if (!p || !ev) return;
  var champs = {}; champs["participants/" + V.cle(p)] = { nom:p, le:V.maintenant() };
  window.TDLBase.ecrire(V.CFG.NODE, ev.id, champs, "déclaration sur " + ev.titre).then(function(ok){
    toast(ok ? "Vous êtes déclaré. À vous de jouer." : T.E_ECRIT);
    if (ok) window.TDLEvPublic.rafraichir();
  });
}

/* ===================== ÉVÉNEMENTS ===================== */

function pied(){
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
    S.mode === "edition" ? T.TITRE_EDIT : T.TITRE_DEM;
  c.innerHTML = S.mode === "edition" ? vueEdition() : (S.type ? vueFormulaire() : vueChoix());
  document.getElementById("tdlev-vol-p").innerHTML = pied();
  c.scrollTop = 0;
  if (S.mode !== "edition" && S.type){
    brancherChips(c, { comm:S.portees, bandes:S.portees }, function(){
      var a = document.getElementById("tdlev-apercu");
      if (a) a.textContent = apercu(S.portees);
    });
    c.querySelectorAll('input[name="tdlev-role"]').forEach(function(r){
      r.addEventListener("change", function(){ S.role = r.value; });
    });
  }
}

function surClic(e){
  var b = e.target.closest ? e.target.closest("button") : null;
  if (!b || !VOL.contains(b)) return;
  if (b.dataset.type){ S.type = b.dataset.type; rendre(); return; }
  if (b.dataset.vol === "retour"){ S.type = null; rendre(); return; }
  if (b.dataset.vol === "fermer"){ ouvrir(false); return; }
  if (b.dataset.vol === "envoyer"){ envoyer(); return; }
  if (b.dataset.vol === "enregistrer"){ enregistrerEdition(); return; }
}

/* ===================== INIT ===================== */

function demanderOuvrir(){
  if (quotaPris()){ toast(T.QUOTA_PLEIN); }
  S.mode = "demande"; S.type = null; S.portees = []; S.role = "jouer";
  rendre(); ouvrir(true);
}
function editerOuvrir(ev){
  if (!ev || !V.peutEditer(ev)) return;
  S.mode = "edition"; S.cible = ev; rendre(); ouvrir(true);
}

function demarrer(){
  V = window.TDLEv;
  if (!V || !window.TDLEvPublic || !window.TDLEvPublic.racine()) { setTimeout(demarrer, 300); return; }
  monter();
  var b = document.getElementById("tdlev-demander");
  if (b) b.addEventListener("click", demanderOuvrir);
  document.addEventListener("tdlev:action", function(e){
    var d = e.detail || {};
    if (d.act === "editer") editerOuvrir(d.evenement);
    else if (d.act === "participer") participer(d.evenement);
  });
}

if (document.readyState === "complete") setTimeout(demarrer, 0);
else window.addEventListener("load", function(){ setTimeout(demarrer, 0); });

window.TDLEvVolet = { ouvrir:demanderOuvrir, editer:editerOuvrir, participer:participer };
window.TDLEvUI    = { groupe:groupe, brancherChips:brancherChips, apercu:apercu,
                      champ:champ, listeOptions:listeOptions, toast:toast,
                      val:val, lignes:lignes, fit:fit, fis:fis };

})();
