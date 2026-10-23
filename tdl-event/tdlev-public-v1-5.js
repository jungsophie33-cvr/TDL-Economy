/* THE DROWNED LANDS — LES ÉVÉNEMENTS · PAGE PUBLIQUE
   Monte la coque, la une, les quatre onglets d'état et la fiche.

   La coque est REPARENTÉE sur document.body : position:fixed est piégé par
   les contextes d'empilement de ForumActif.

   Les deux boutons de barre (« Panneau de gestion », « Demander un évent »)
   sont posés ici mais branchés par tdlev-staff.js et tdlev-volet.js, qui
   n'ont qu'à écouter leur identifiant.

   EXPOSE : window.TDLEvPublic
   DÉPEND DE : window.TDLEv (tdlev-core), window.EcoCore, window.TDLBase
   CSS : CSS-evenements.css

   CARTE DES BLOCS : CONFIG · TEXTES · UTILS · COQUE · HÉROS · LA UNE
                     · PANNEAUX · FICHE · ÉVÉNEMENTS · INIT */

(function () {
"use strict";

/* ===================== CONFIG ===================== */

var V = null;                 /* window.TDLEv, résolu au démarrage */
var ETATS = ["rejoindre","cours","venir","cloture"];

/* ===================== TEXTES ===================== */

var T = {
  TITRE:      "Les Événements",
  GESTION:    "Panneau de gestion",
  DEMANDER:   "Demander un évent",
  ACCUEIL:    "Accueil",
  UNE:        "La une",
  AUTRES:     "Autres événements en cours",
  A_REJOINDRE:"À rejoindre",
  BIENTOT:    "Prochainement",
  VOIR_FICHE: "Voir le descriptif",
  RIEN:       "Rien dans cette catégorie.",
  RIEN_UNE:   "Rien pour l'instant.",
  CONTEXTE:   "Contexte",
  OBJECTIFS:  "Objectifs et thématiques",
  RPS:        "RP en rapport avec l'événement",
  INSCRITS:   "Personnages inscrits",
  RATTACHER:  "Joindre un RP",
  REJOINDRE:  "Rejoindre ce RP",
  F_DEBUT:    "Ouverture",
  RETENU_C:   "La paroisse en retiendra...",
  BREF:       "En bref",
  LIENS:      "Liens et ressources",
  EDITER:     "Éditer l'évent",
  PARTICIPER: "S'inscrire",
  TABLEAU:    "Aller au tableau",
  ATTENDRE:   "Prévenez-moi à l'ouverture",
  PERSONNE:   "personne", PERSONNES:"personnes",
  F_ISSUE:    "Issue",
  F_CONSEQ:   "Conséquence",
  F_PUBLIC:   "Connu de la paroisse",
  F_CLOS:     "Clôturé le",
  OUI_NON:    { true:"Oui", false:"Non" }
};

/* ===================== UTILS ===================== */

var S = { vue:"une", cat:null, sel:null };   /* état d'interface */
var RACINE = null;

function esc(s){ return V.esc(s); }
function fit(n){ return '<i class="fi fi-tr-' + n + '"></i>'; }
function fis(n){ return '<i class="fi fi-sr-' + n + '"></i>'; }
/* Pas de background-image vide : url() sans adresse est une règle invalide
   que le navigateur jette, et la classe « est-image » allège le dégradé du
   héros pour qu'on voie la photo. */
function img(ev){
  var u = String(ev.vignette || "").trim().replace(/["'()\s<>]/g, "");
  return u ? esc(u) : "";
}
function fond(ev){
  var u = img(ev);
  return u ? ' style="background-image:url(' + u + ')"' : "";
}
function cat(ev){ return V.CATEGORIES[ev.categorie]; }

function parEtat(k){
  return V.visibles().filter(function(e){ return V.etatAffichage(e) === k; });
}
function parId(id){
  var l = V.visibles();
  for (var i = 0; i < l.length; i++){ if (l[i].id === id) return l[i]; }
  return null;
}
function etiquettes(ev){
  var h = V.portees(ev).map(function(p){ return '<span class="tdlev-tag">' + esc(p) + '</span>'; }).join("");
  if (ev.catastrophe) h = '<span class="tdlev-tag est-catastrophe">Catastrophe</span>' + h;
  if (ev.source) h += '<span class="tdlev-tag">' + esc(ev.source) + '</span>';
  return h;
}
/* [MAJ] interception des liens FA : window.open, jamais location.href */
function ouvrir(url){
  if (!url) return;
  try { window.open(url, "_blank"); } catch(e){}
}

/* ===================== COQUE ===================== */

function coque(){
  var d = document.createElement("div");
  d.className = "tdlev";
  d.innerHTML =
      '<header class="tdlev-mastic">'
    +   '<div><button class="tdlev-ico-btn" id="tdlev-accueil" title="' + T.ACCUEIL + '">'
    +     fit("house-flood") + '</button></div>'
    +   '<h1 class="tdlev-mastic-titre">' + T.TITRE + '</h1>'
    +   '<div></div>'
    + '</header>'
    + '<div class="tdlev-barre">'
    +   '<div id="tdlev-barre-g"></div>'
    +   '<nav class="tdlev-nav" role="tablist" id="tdlev-nav"></nav>'
    +   '<div id="tdlev-barre-d" style="justify-self:end"></div>'
    + '</div>'
    + '<div class="tdlev-corps">'
    +   '<div class="tdlev-une" id="tdlev-vue-une">'
    +     '<div class="tdlev-une-g" id="tdlev-une-g"></div>'
    +     '<aside class="tdlev-une-rail" id="tdlev-une-rail"></aside>'
    +   '</div>'
    +   '<div class="tdlev-vue" id="tdlev-vue-pan" hidden>'
    +     '<div class="tdlev-col">'
    +       '<div class="tdlev-cats" id="tdlev-cats"></div>'
    +       '<div class="tdlev-liste" id="tdlev-liste"></div>'
    +     '</div>'
    +     '<article class="tdlev-fiche" id="tdlev-fiche"></article>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(d);
  /* iOS Safari : le verrou de défilement va sur <html>, jamais sur <body>. */
  document.documentElement.style.overflow = "hidden";
  return d;
}
function $(id){ return document.getElementById(id); }

/* Les deux boutons de barre, posés seulement si quelqu'un peut s'en servir. */
function boutonsBarre(){
  if (V.estStaff()) {
    $("tdlev-barre-g").innerHTML =
      '<button class="tdlev-txt-btn" id="tdlev-gestion">'
      + fit("settings-sliders") + '<span>' + T.GESTION + '</span></button>';
  }
  if (V.monPseudo()) {
    $("tdlev-barre-d").innerHTML =
      '<button class="tdlev-txt-btn est-plein" id="tdlev-demander">'
      + fit("paper-plane") + '<span>' + T.DEMANDER + '</span></button>';
  }
}

/* ===================== HÉROS ===================== */

/* stats : trois chiffres au plus, tous lus dans la fiche — aucun n'est
   inventé ni compté côté ForumActif. */
function stats(ev){
  var out = [];
  var nbP = V.cles(ev.participants).length;
  var nbR = V.cles(ev.rps).length;
  if (ev.statut === "cloture"){
    if (ev.conclusion && ev.conclusion.issue)
      out.push(["flag","Issue", V.TEXTES.ISSUES[ev.conclusion.issue] || "—"]);
    out.push(["users","Retenus", String(V.cles(ev.retenus).length)]);
    if (ev.conclusion && ev.conclusion.le) out.push(["clock", T.F_CLOS, V.dateFr(ev.conclusion.le)]);
  } else {
    if (nbP) out.push(["users","Inscrits", String(nbP)]);
    if (nbR) out.push(["feather", T.RPS, String(nbR)]);
    if (ev.referent) out.push(["user","Référent", esc(ev.referent)]);
  }
  return out;
}

/* Le bouton d'action, déduit de l'origine et de l'état — jamais générique. */
function action(ev){
  var etat = V.etatAffichage(ev);
  if (ev.categorie === "lore" || etat === "cloture") return null;
  if (ev.origine === "tableau") return { txt:T.TABLEAU, url:ev.urlSource || "", second:true };
  if (etat === "venir") return { txt:T.ATTENDRE, act:"rappel", second:true };
  if (etat === "rejoindre") return { txt:T.PARTICIPER, act:"participer" };
  return null;
}

function hero(ev, grand){
  var c = cat(ev), d = "";
  if (grand){
    d += '<button class="tdlev-hero-cta" data-ouvre="' + esc(ev.id) + '">' + T.VOIR_FICHE + '</button>';
  } else {
    var a = action(ev);
    if (a) d += '<button class="tdlev-hero-cta' + (a.second ? " est-second" : "") + '"'
             + (a.act ? ' data-act="' + a.act + '"' : '')
             + (a.url ? ' data-url="' + esc(a.url) + '"' : '') + '>' + esc(a.txt) + '</button>';
    if (V.peutEditer(ev))
      d += '<button class="tdlev-hero-cta est-second" data-act="editer">' + T.EDITER + '</button>';
  }
  var st = stats(ev);
  if (st.length) d += '<div class="tdlev-hero-stats">'
    + st.map(function(x){ return '<div class="tdlev-hero-s">' + fit(x[0])
        + '<b>' + esc(x[1]) + '</b><em>' + esc(x[2]) + '</em></div>'; }).join("")
    + '</div>';

  return '<div class="tdlev-hero' + (grand ? "" : " est-fiche")
    + (img(ev) ? " est-image" : "") + '">'
    + '<div class="tdlev-hero-img"' + fond(ev) + '></div>'
    + '<div class="tdlev-hero-c">'
    +   '<span class="tdlev-hero-rub" style="--c:' + c.c + '">'
    +     '<span class="tdlev-pt"></span>' + esc(c.nom) + '</span>'
    +   '<h2 class="tdlev-hero-titre">' + esc(ev.titre) + '</h2>'
    +   (ev.sous ? '<p class="tdlev-hero-sous">' + esc(ev.sous) + '</p>' : '')
    +   '<div class="tdlev-hero-tags">'
    +     '<span class="tdlev-tag est-etat">' + V.TEXTES.ETATS[V.etatAffichage(ev)] + '</span>'
    +     (ev.periode ? '<span class="tdlev-tag">' + esc(ev.periode) + '</span>' : '')
    +     etiquettes(ev) + '</div>'
    + '</div>'
    + (d ? '<div class="tdlev-hero-d">' + d + '</div>' : '')
    + '</div>';
}

/* ===================== LA UNE ===================== */

function rangee(ev){
  var c = cat(ev);
  return '<button class="tdlev-r" data-ouvre="' + esc(ev.id) + '">'
    + '<span class="tdlev-r-img"' + fond(ev) + '></span>'
    + '<span><span class="tdlev-rub" style="--c:' + c.c + '">' + esc(c.nom) + '</span>'
    + '<span class="tdlev-r-t">' + esc(ev.titre) + '</span>'
    + '<span class="tdlev-r-x">' + esc(ev.sous) + '</span></span>'
    + '<span class="tdlev-r-chev">' + fit("angle-right") + '</span></button>';
}
function bloc(titre, liste){
  if (!liste.length) return "";
  return '<div class="tdlev-bloc-h"><b>' + esc(titre) + '</b><span>' + liste.length + '</span></div>'
    + liste.map(rangee).join("");
}

function rendUne(){
  var tous = V.visibles();
  var principal = V.miseEnAvant(tous) || parEtat("cours")[0] || tous[0] || null;
  var g = $("tdlev-une-g");
  if (!principal){ g.innerHTML = '<p class="tdlev-vide">' + T.RIEN_UNE + '</p>'; $("tdlev-une-rail").innerHTML = ""; return; }

  var autres = parEtat("cours").filter(function(e){ return e !== principal; }).slice(0, 3);
  g.innerHTML = hero(principal, true) + bloc(T.AUTRES, autres);
  $("tdlev-une-rail").innerHTML =
      bloc(T.A_REJOINDRE, parEtat("rejoindre"))
    + bloc(T.BIENTOT, parEtat("venir"));
}

/* ===================== PANNEAUX ===================== */

function rendNav(){
  var h = '<button class="tdlev-ong" data-vue="une" role="tab" aria-selected="'
        + (S.vue === "une") + '">' + T.UNE + '</button>';
  ETATS.forEach(function(k){
    h += '<button class="tdlev-ong" data-vue="' + k + '" role="tab" aria-selected="'
       + (S.vue === k) + '">' + V.TEXTES.ETATS[k]
       + '<span class="tdlev-ong-nb">' + parEtat(k).length + '</span></button>';
  });
  $("tdlev-nav").innerHTML = h;
}

function rendCats(){
  var base = parEtat(S.vue);
  $("tdlev-cats").innerHTML = V.ORDRE_CAT.map(function(k){
    var n = base.filter(function(e){ return e.categorie === k; }).length;
    var c = V.CATEGORIES[k];
    return '<button class="tdlev-cat" data-cat="' + k + '" style="--c:' + c.c + '"'
      + ' aria-pressed="' + (S.cat === k) + '"' + (n ? "" : " disabled") + '>'
      + fit(c.ico) + '<b>' + esc(c.court) + '</b></button>';
  }).join("");
}

function rendListe(){
  rendCats();
  var l = parEtat(S.vue).filter(function(e){ return !S.cat || e.categorie === S.cat; });
  var box = $("tdlev-liste");
  if (!l.length){ box.innerHTML = '<p class="tdlev-vide">' + T.RIEN + '</p>'; rendFiche(null); return; }
  if (!S.sel || !parId(S.sel) || l.indexOf(parId(S.sel)) === -1) S.sel = l[0].id;

  box.innerHTML = l.map(function(ev){
    var c = cat(ev);
    return '<button class="tdlev-e" data-id="' + esc(ev.id) + '" style="--c:' + c.c + '"'
      + ' aria-current="' + (ev.id === S.sel) + '">'
      + '<span class="tdlev-e-img"' + fond(ev) + '></span>'
      + '<span><span class="tdlev-rub" style="--c:' + c.c + '">' + esc(c.nom) + '</span>'
      + '<span class="tdlev-e-t">' + esc(ev.titre) + '</span></span></button>';
  }).join("");
  rendFiche(parId(S.sel));
}

/* ===================== FICHE ===================== */

function pave(icone, titre, corps){
  return '<section class="tdlev-pave">'
    + '<div class="tdlev-pave-tete"><span class="tdlev-pave-ico">' + fis(icone) + '</span>'
    + '<h3 class="tdlev-pave-h">' + esc(titre) + '</h3></div>'
    + '<div class="tdlev-pave-c">' + corps + '</div></section>';
}

function accordeon(ev, peutRejoindre, moi){
  return V.cles(ev.rps).map(function(k, i){
    var r = ev.rps[k] || {};
    var gens = V.cles(r.participants);
    var n = gens.length;
    var dedans = moi && r.participants && r.participants[V.cle(moi)];
    return '<button class="tdlev-rat-l" data-acc="' + i + '" aria-expanded="false">'
      + '<span class="tdlev-rat-nom">' + esc(r.titre || "(sujet)") + '</span>'
      + '<span class="tdlev-rat-n">' + n + " " + (n > 1 ? T.PERSONNES : T.PERSONNE) + '</span>'
      + fit("angle-right") + '</button>'
      + '<div class="tdlev-rat-p" id="tdlev-acc-' + i + '"><div>'
      + '<div class="tdlev-gens">'
      + gens.map(function(g){ return '<span>' + esc(r.participants[g].nom || g) + '</span>'; }).join("")
      + '</div>'
      + (r.url ? '<div class="tdlev-cta"><button class="tdlev-btn est-second"'
                 + ' data-url="' + esc(r.url) + '">Lire le sujet</button>'
                 + (peutRejoindre && !dedans
                    ? '<button class="tdlev-btn" data-rp="' + esc(k) + '">'
                      + T.REJOINDRE + '</button>' : '')
                 + '</div>' : '')
      + '</div></div>';
  }).join("");
}

/* « En bref » : les faits saisis par le staff, précédés des lignes de
   conclusion quand la fiche est close. Rien n'y répète le héros. */
function faits(ev){
  var out = [];
  if (ev.debut && ev.statut !== "cloture") out.push([T.F_DEBUT, esc(V.dateFr(ev.debut))]);
  if (ev.statut === "cloture" && ev.conclusion){
    var c = ev.conclusion;
    if (c.issue) out.push([T.F_ISSUE,
      '<span class="tdlev-issue est-' + esc(c.issue) + '"><span class="tdlev-pt"></span>'
      + esc(V.TEXTES.ISSUES[c.issue] || c.issue) + '</span>']);
    if (c.jauge && c.jauge !== "aucune")
      out.push([T.F_CONSEQ, esc(V.JAUGES[c.jauge] || c.jauge) + " " + esc(V.TEXTES.SENS[c.sens] || "")]);
    out.push([T.F_PUBLIC, c.public ? T.OUI_NON.true : T.OUI_NON.false]);
  }
  V.cles(ev.faits).forEach(function(k){
    var f = ev.faits[k] || {};
    if (f.libelle) out.push([f.libelle, esc(f.valeur || "")]);
  });
  return out;
}

function rendFiche(ev){
  var p = $("tdlev-fiche");
  if (!ev){ p.innerHTML = ""; return; }
  var g = "", d = "";

  var el = V.cles(ev.elements);
  if (el.length) g += '<div class="tdlev-elem">' + el.map(function(k){
      var x = ev.elements[k] || {};
      return '<div><p class="tdlev-elem-k">' + fit(x.ico || "info") + esc(x.libelle || "") + '</p>'
        + '<p class="tdlev-elem-v">' + esc(x.valeur || "") + '</p></div>';
    }).join("") + '</div>';

  if (ev.contexte.length)
    g += pave("book-alt", T.CONTEXTE,
      ev.contexte.map(function(t){ return '<p class="tdlev-f-p">' + esc(t) + '</p>'; }).join(""));

  if (ev.objectifs.length)
    g += pave("flag", T.OBJECTIFS,
      '<ul class="tdlev-obj">' + ev.objectifs.map(function(o){ return '<li>' + esc(o) + '</li>'; }).join("") + '</ul>');

  if (ev.statut === "cloture" && ev.conclusion && ev.conclusion.texte)
    g += pave("stamp", T.RETENU_C,
      ev.conclusion.texte.split("\n").filter(Boolean).map(function(t){
        return '<p class="tdlev-f-p">' + esc(t) + '</p>'; }).join(""));

  var moi = V.monPseudo(), inscrit = moi && ev.participants[V.cle(moi)];
  if (V.cles(ev.rps).length || (ev.rpOuvert && inscrit)){
    g += '<p class="tdlev-f-h">' + T.RPS + '</p>';
    if (ev.rpOuvert && inscrit)
      g += '<div class="tdlev-cta"><button class="tdlev-btn est-second"'
         + ' data-act="rattacher">' + T.RATTACHER + '</button></div>';
    g += accordeon(ev, !!(ev.rpOuvert && inscrit), moi);
  }

  /* Avant que ça commence, la liste des inscrits est la seule information
     disponible. Dès que l'évent tourne, ce sont les sujets rattachés qui
     disent qui joue vraiment — répéter la liste n'apprendrait rien. */
  var etat = V.etatAffichage(ev), ins = V.cles(ev.participants);
  if (ins.length && (etat === "rejoindre" || etat === "venir"))
    g += '<p class="tdlev-f-h">' + T.INSCRITS + '</p><div class="tdlev-gens">'
      + ins.map(function(k){ return '<span>' + esc(ev.participants[k].nom || k) + '</span>'; }).join("")
      + '</div>';

  var f = faits(ev);
  if (f.length) d += '<p class="tdlev-f-h">' + T.BREF + '</p><dl class="tdlev-faits">'
    + f.map(function(x){ return '<dt>' + esc(x[0]) + '</dt><dd>' + x[1] + '</dd>'; }).join("") + '</dl>';

  var li = V.cles(ev.liens);
  if (li.length) d += '<p class="tdlev-f-h">' + T.LIENS + '</p><div>' + li.map(function(k){
      var l = ev.liens[k] || {};
      return '<button class="tdlev-lien" data-url="' + esc(l.url || "") + '">' + fit("link")
        + '<span class="tdlev-lien-c"><span class="tdlev-lien-k">' + esc(l.libelle || "") + '</span>'
        + '<span class="tdlev-lien-t">' + esc(l.titre || l.url || "") + '</span></span></button>';
    }).join("") + '</div>';

  p.innerHTML = hero(ev, false)
    + '<div class="tdlev-f-corps"><div class="tdlev-f-g">' + g + '</div>'
    + '<div class="tdlev-f-d"><div class="tdlev-f-d-in">' + d + '</div></div></div>';
  p.scrollTop = 0;
}

/* ===================== ÉVÉNEMENTS ===================== */

/* Une seule délégation sur la racine : le contenu est réécrit à chaque
   rendu, des écouteurs posés nœud par nœud fuiraient à chaque passage. */
function brancher(){
  RACINE.addEventListener("click", function(e){
    var b = e.target.closest ? e.target.closest("button") : null;
    if (!b || !RACINE.contains(b)) return;

    if (b.dataset.vue){ S.vue = b.dataset.vue; S.cat = null; S.sel = null; rendre(); return; }
    if (b.dataset.cat !== undefined && b.classList.contains("tdlev-cat")){
      S.cat = (S.cat === b.dataset.cat) ? null : b.dataset.cat; S.sel = null; rendListe(); return;
    }
    if (b.dataset.id){ S.sel = b.dataset.id; rendListe(); return; }
    if (b.dataset.ouvre){
      var ev = parId(b.dataset.ouvre);
      if (!ev) return;
      S.vue = V.etatAffichage(ev); S.cat = null; S.sel = ev.id; rendre(); return;
    }
    if (b.dataset.acc !== undefined){
      var c = document.getElementById("tdlev-acc-" + b.dataset.acc);
      var ouvert = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", ouvert ? "false" : "true");
      if (c) c.classList.toggle("est-ouvert", !ouvert);
      b.innerHTML = b.innerHTML;   /* le chevron pivote par CSS */
      return;
    }
    if (b.dataset.rp){ e.stopPropagation(); agir("rejoindreRp", b.dataset.rp); return; }
    if (b.dataset.url){ e.stopPropagation(); ouvrir(b.dataset.url); return; }
    if (b.dataset.act){ e.stopPropagation(); agir(b.dataset.act); return; }
    if (b.id === "tdlev-accueil"){ ouvrir("/"); return; }
  });
}

/* Les actions qui sortent de cette page sont émises, pas exécutées ici :
   tdlev-volet.js les écoute. */
function agir(act, arg){
  var ev = parId(S.sel);
  try {
    document.dispatchEvent(new CustomEvent("tdlev:action",
      { detail:{ act:act, evenement:ev, arg:arg } }));
  } catch(e){}
}

/* ===================== INIT ===================== */

function rendre(){
  rendNav();
  var surUne = (S.vue === "une");
  $("tdlev-vue-une").hidden = !surUne;
  $("tdlev-vue-pan").hidden = surUne;
  if (surUne) rendUne(); else rendListe();
}

function message(txt){
  var m = document.querySelector(V.CFG.MONTAGE + " .tdlev-chargement");
  if (m) m.textContent = txt;
}

function demarrer(){
  V = window.TDLEv;
  if (!V){ return; }
  var hote = document.querySelector(V.CFG.MONTAGE);
  if (!hote) return;

  V.charger().then(function(){
    var ancre = document.querySelector(V.CFG.MONTAGE);
    if (ancre) ancre.innerHTML = "";
    RACINE = coque();
    boutonsBarre();
    brancher();
    rendre();
    V.precharger();
    V.veiller(function(){
      V.charger().then(function(){ rendre(); V.precharger(); }).catch(function(){});
    });
  }).catch(function(e){
    message(e && e.message === "socle" ? V.TEXTES.SOCLE : V.TEXTES.ECHEC);
    try { console.warn("[tdlev] chargement", e); } catch(_){}
  });
}

/* FA déclenche DOMContentLoaded trop tôt. */
if (document.readyState === "complete") demarrer();
else window.addEventListener("load", demarrer);

window.TDLEvPublic = {
  rendre:     rendre,
  rafraichir: function(){ return V.charger().then(rendre); },
  etat:       S,
  racine:     function(){ return RACINE; }
};

})();
