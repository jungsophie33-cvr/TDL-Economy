/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU HANGAR (LA FLOTTILLE) · SOCLE
   (rep-flot-core.js) — à charger AVANT rep-flot-ops.js.

   Moulé sur rep-mis-marin / rep-det-main, dont il réutilise intégralement le
   CSS « tdlm- ». Préfixe propre : « tdlh- » (tdlf- est pris par les Faiseuses).

   UNE SEULE LISTE. Opérations, disparitions et marées se mélangent dans la
   colonne de gauche, triées par date ; le type s'affiche sous le titre, comme
   partout ailleurs. Les filtres du haut portent sur le STATUT, commun à tous
   les types, plus « À traiter » (staff) et « Le carnet » (Flottille).

   Chaque type s'enregistre auprès du socle :
     TDLFlot.type({ k, sous, label, ic, normaliser(o), sub(m), tags(m),
                    panel(m), act(k,m), doo(k,m), brancher(stage), auto(list) });
   sous = enfant de  flottille/<sous>.

   Données : flottille/<sous>/{id} et flottille/carnet/{pseudo}.
   Appartenance : membres/{pseudo}.hors_la_loi = { bande:"flottille", navire, role }.
   DÉPEND DE : window.EcoCore. Optionnel : window.TDLPoll, window.EcoNotif.
   ================================================================== */
(function(){
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  RACINE:       "flottille",
  SOUS_CARNET:  "carnet",
  NODE_MEMBRES: "membres",
  EDIT_URL:     "https://thedrownedlands.forumactif.com/post?p=470&mode=editpost" /* [MAJ] sujet porteur */
};
var DELAI_REFUS = 14 * 86400000;   /* 14 j sans preneur → refus auto + recrédit */
var CHEF_BONUS  = 50;              /* aligné sur rep-mis-marin et rep-det-main */
var REFRESH_MS  = 60000;

/* statuts COMMUNS à tous les types : c'est ce qui permet la liste mélangée */
var STATUTS = {
  en_attente:   {label:"En attente",    c:"var(--gr3-color)"},
  en_cours:     {label:"En cours",      c:"var(--gr1-color)"},
  en_validation:{label:"En validation", c:"var(--gr5-color)"},
  close:        {label:"Clos",          c:"var(--gr2-color)"},
  refusee:      {label:"Refusé",        c:"var(--gr6-color)"}
};

/* seuils de lecture du carnet, sur les dix dernières notes */
var CARNET_ETATS = [
  {min:0.7, label:"sûr",              c:"var(--gr2-color)"},
  {min:0.4, label:"à vérifier",       c:"var(--gr1-color)"},
  {min:0,   label:"plusieurs clients",c:"var(--gr6-color)"}
];

/* ===================== UTILS ===================== */
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escAttr(s){return String(s==null?"":s).replace(/"/g,"&quot;");}
function vt(v){return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]);}
function newId(p){return (p||"f")+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function money(n){return (+n||0)+" $";}
function nbJours(iso){var t=new Date(iso).getTime();if(isNaN(t))return null;return Math.floor((Date.now()-t)/86400000);}
function ilya(iso){var d=nbJours(iso);if(d==null)return"—";return d<=0?"aujourd'hui":("il y a "+d+" j");}
function $(s,ctx){return (ctx||document).querySelector(s);}

function crediterDollars(pseudo, delta){
  return window.EcoCore.firebaseTransaction(CFG.NODE_MEMBRES+"/"+encodeURIComponent(pseudo)+"/dollars",
    function(cur){return Math.max(0,(cur||0)+delta);});
}

function isStaff(){try{return typeof _userdata!=="undefined"&&(_userdata.user_level===1||_userdata.user_level===2);}catch(e){return false;}}
function estConnecte(){try{return typeof _userdata!=="undefined"&&parseInt(_userdata.user_id,10)>0;}catch(e){return false;}}
function myPseudo(){try{if(typeof _userdata!=="undefined"&&_userdata.username)return String(_userdata.username).trim();}catch(e){}return null;}

/* ===================== DONNÉES ===================== */
var TYPES = [];     /* descripteurs de type d'entrée */
var VUES  = [];     /* vues annexes : une puce de filtre + une scène pleine largeur */
var L = [];         /* LA liste, tous types confondus, triée par date */
var CARNET = {};    /* flottille/carnet/{pseudo} */
var MEMBRES = {};
var AVATARS = {};

function typeDe(k){for(var i=0;i<TYPES.length;i++)if(TYPES[i].k===k)return TYPES[i];return null;}
function vueDe(k){for(var i=0;i<VUES.length;i++)if(VUES[i].k===k)return VUES[i];return null;}
function vueActive(){var v=vueDe(S.statut);return (v&&(!v.visible||v.visible()))?v:null;}

function hll(pseudo){var m=pseudo&&MEMBRES[pseudo];return (m&&m.hors_la_loi)||null;}
function estFlottille(pseudo){var h=hll(pseudo);return !!(h&&h.bande==="flottille");}
function navireDe(pseudo){var h=hll(pseudo);return (h&&h.navire)||"";}
/* Capitaine : un navire renseigné, et un rôle qui ne dit pas le contraire.
   [MAJ] aligner sur les champs du bottin dès que l'onglet Flottille existe. */
function estCapitaine(pseudo){
  var h=hll(pseudo); if(!h||h.bande!=="flottille"||!h.navire)return false;
  if(!h.role)return true;
  return /capitaine/i.test(String(h.role));
}
function solde(pseudo){var m=MEMBRES[pseudo];return (m&&+m.dollars)||0;}

function indexAvatars(rec){
  var fc=(rec&&rec.faceclaims)||{}, idx={};
  function score(c){return (c.statut==="pris"?4:(c.statut==="reserve"?1:0))+(c.image?2:0);}
  Object.keys(fc).forEach(function(k){
    var c=fc[k]; if(!c||!c.pseudo)return;
    var a=idx[c.pseudo]; if(!a||score(c)>score(a))idx[c.pseudo]=c;
  });
  return idx;
}
function av(n){
  var c=AVATARS[n];
  if(c&&c.image)return '<span class="tdlm-avatar"><img src="'+escAttr(c.image)+'" alt=""></span>';
  return '<span class="tdlm-avatar">'+esc(String(n||"?").replace(/[@.\s]/g,"").slice(0,2).toUpperCase())+'</span>';
}

function serialize(m){var o={};for(var k in m){if(m.hasOwnProperty(k)&&k!=="id"&&k!=="_t")o[k]=m[k];}return o;}

var _lastWrite=0;
/* écriture ciblée : patch(m,{statut:…}) → PATCH flottille/<sous>/{id}/statut */
function patch(m, champs){
  _lastWrite=Date.now();
  var t=m._t; if(!t)return;
  var up={}; for(var k in champs){if(champs.hasOwnProperty(k))up[CFG.RACINE+"/"+t.sous+"/"+m.id+"/"+k]=champs[k];}
  try{var p=window.EcoCore.firebaseUpdate(up);if(p&&p.catch)p.catch(function(){toast("Sauvegarde échouée — réessaie.");});}
  catch(e){toast("Sauvegarde échouée.");}
}
function supprimerEntree(m){
  _lastWrite=Date.now();
  var up={}; up[CFG.RACINE+"/"+m._t.sous+"/"+m.id]=null;
  try{var p=window.EcoCore.firebaseUpdate(up);if(p&&p.catch)p.catch(function(){toast("Suppression échouée.");});}
  catch(e){toast("Suppression échouée.");}
  L=L.filter(function(x){return x!==m;});
  fixSel(); S.drawer=null; S.inline=null; S.mob="liste";
}
function parId(id){for(var i=0;i<L.length;i++)if(L[i].id===id)return L[i];return null;}

/* ===================== CARNET ===================== */
function carnetEtat(notes){
  notes=vt(notes); if(!notes.length)return {label:"non noté",c:"var(--cntr)",ratio:null};
  var bons=0; notes.forEach(function(n){if(n==="fiable")bons++;});
  var r=bons/notes.length;
  for(var i=0;i<CARNET_ETATS.length;i++)if(r>=CARNET_ETATS[i].min)return {label:CARNET_ETATS[i].label,c:CARNET_ETATS[i].c,ratio:r};
  return {label:"—",c:"var(--cntr)",ratio:r};
}
function carnetListe(){
  return Object.keys(CARNET).map(function(p){
    var e=CARNET[p]||{}, notes=vt(e.notes).slice(-10);
    return {pseudo:p, postes:+e.postes||notes.length, notes:notes, dernier:e.dernier||"", etat:carnetEtat(notes)};
  }).sort(function(a,b){return (b.dernier||"").localeCompare(a.dernier||"");});
}
function peutVoirCarnet(){return isStaff()||estFlottille(myPseudo());}

/* ===================== ÉTAT ===================== */
var S = {statut:"tous", sel:null, mob:"liste", drawer:null, inline:null};

function filtre(){
  return L.filter(function(m){
    if(S.statut==="demandes")return !!m.demandeValidation;
    return S.statut==="tous"||m.statut===S.statut;
  });
}
function fixSel(){var d=filtre(),ok=false;d.forEach(function(m){if(m.id===S.sel)ok=true;});if(!ok)S.sel=d[0]?d[0].id:null;}

/* ===================== RENDER ===================== */
function stamp(m){var v=STATUTS[m.statut]||{label:m.statut,c:"var(--cntr)"};return '<span class="tdlm-stamp" style="--sc:'+v.c+'">'+esc(v.label)+'</span>';}

function renderStatutFilters(){
  var el=$("#tdlh-stf"); if(!el)return;
  var chips=[{id:"tous",label:"Tout",c:"var(--cntr)"}];
  Object.keys(STATUTS).forEach(function(id){chips.push({id:id,label:STATUTS[id].label,c:STATUTS[id].c});});
  var html=chips.map(function(s){
    var n=s.id==="tous"?L.length:L.filter(function(m){return m.statut===s.id;}).length;
    return '<button class="tdlm-stf" data-st="'+s.id+'" aria-pressed="'+(s.id===S.statut)+'" style="--sc:'+s.c+'"><span class="tdlm-fdot"></span>'+esc(s.label)+' <b>'+n+'</b></button>';
  }).join("");
  if(isStaff()){
    var nd=L.filter(function(m){return !!m.demandeValidation;}).length;
    html+='<button class="tdlm-stf tdlm-req-chip" data-st="demandes" aria-pressed="'+(S.statut==="demandes")+'">⚑ À traiter <b>'+nd+'</b></button>';
  }
  if(peutVoirCarnet()){
    html+='<button class="tdlm-stf tdlm-req-chip" data-st="carnet" aria-pressed="'+(S.statut==="carnet")+'">Le carnet <b>'+carnetListe().length+'</b></button>';
  }
  VUES.forEach(function(v){
    if(v.visible&&!v.visible())return;
    var n=v.compte?v.compte():null;   /* null = puce sans compteur (action) */
    html+='<button class="tdlm-stf tdlm-req-chip" data-st="'+esc(v.k)+'" aria-pressed="'+(S.statut===v.k)+'">'+esc(v.label)+(n==null?'':' <b>'+n+'</b>')+'</button>';
  });
  el.innerHTML=html;
  el.querySelectorAll("[data-st]").forEach(function(b){
    b.onclick=function(){S.statut=b.getAttribute("data-st");S.drawer=null;S.inline=null;fixSel();renderStage();renderStatutFilters();};
  });
}

var _lastSel=null;
function renderStage(){
  var el=$("#tdlh-stage"); if(!el)return;
  var pl=el.querySelector(".tdlm-dlist-rows"); var scl=pl?pl.scrollTop:0;
  var pb=el.querySelector(".tdlm-dp-body"); var scb=pb?pb.scrollTop:0;
  var same=(_lastSel===S.sel);
  var vue=vueActive();
  el.innerHTML=vue?vue.render():((S.statut==="carnet"&&peutVoirCarnet())?viewCarnet():viewDossier());
  var nl=el.querySelector(".tdlm-dlist-rows"); if(nl)nl.scrollTop=scl;
  if(same){var nb=el.querySelector(".tdlm-dp-body"); if(nb)nb.scrollTop=scb;}
  _lastSel=S.sel;
  brancher();
}
function renderAll(){renderStatutFilters();renderStage();}
function loading(msg){var el=$("#tdlh-stage");if(el)el.innerHTML='<div class="tdlm-empty">'+esc(msg||"Chargement…")+'</div>';}

/* rangée : titre, puis « type · précision », puis les tags du type */
function ligne(m){
  var t=m._t, o=(t.sub?t.sub(m):{})||{};
  var tags=(t.tags?t.tags(m):[])||[];
  var chips=tags.filter(Boolean).map(function(x){return '<span class="tdlm-req">'+x+'</span>';}).join("");
  if(isStaff()&&m.demandeValidation)chips+='<span class="tdlm-req">⚑ validation</span>';
  var st=STATUTS[m.statut]||{c:"var(--cntr)"};
  var sub=esc(t.label)+(o.sub?' \u27e1 '+esc(o.sub):'');
  return '<div class="tdlm-drow" data-sel="'+m.id+'" aria-current="'+(m.id===S.sel)+'">'
    +'<span class="tdlm-ddot" style="--sc:'+st.c+'"></span>'
    +'<div style="min-width:0">'
      +'<div class="tdlm-drow-head"><span class="tdlm-type">'+esc(m.titre||"—")+'</span></div>'
      +'<div class="tdlm-drow-sub">'+sub+'</div>'
      +(chips?'<div class="tdlm-drow-tags">'+chips+'</div>':'')
    +'</div>'
    +'<div class="tdlm-drow-right">'+(o.qui?av(o.qui):'')+'<div class="tdlm-posted">'+esc(o.quand||ilya(m.cree))+'</div></div>'
  +'</div>';
}

function viewDossier(){
  var d=filtre();
  var rows=d.length?d.map(ligne).join("")
                   :'<div class="tdlm-empty">Rien à cet endroit du registre.</div>';
  var sel=parId(S.sel)||d[0];
  return '<div class="tdlm-dossier'+(S.mob==="detail"?" detail":"")+'">'
    +'<div class="tdlm-dlist"><div class="tdlm-dlist-rows">'+rows+'</div></div>'
    +'<div class="tdlm-dpanel">'+(sel?sel._t.panel(sel):'<div class="tdlm-empty">—</div>')+'</div></div>';
}

/* vue pleine largeur, sur le modèle de l'ardoise de la Main */
function viewCarnet(){
  var g=carnetListe();
  var corps=g.length?g.map(function(x){
    var nav=navireDe(x.pseudo);
    var ratio=(x.etat.ratio==null)?"":(Math.round(x.etat.ratio*100)+" % fiables");
    var meta=x.postes+" poste"+(x.postes>1?"s":"")
      +(x.dernier?", dernier "+ilya(x.dernier):"")
      +(ratio?" \u27e1 "+ratio:"");
    return '<div class="tdlm-person">'+av(x.pseudo)
      +'<span class="tdlm-pname">'+esc(x.pseudo)+'</span>'
      +(nav?'<span class="tdlm-r">'+esc(nav)+'</span>':'')
      +'<span class="tdlm-stamp" style="--sc:'+x.etat.c+'">'+esc(x.etat.label)+'</span>'
      +'<span class="tdlh-meta">'+esc(meta)+'</span></div>';
  }).join(""):'<div class="tdlm-empty">Personne n\u2019a encore tenu de poste.</div>';
  return '<div class="tdlm-dpanel">'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">Le carnet</span></div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-sec"><p class="tdlm-hsec">Ceux qui ont travaillé pour le hangar</p>'
    +'<div class="tdlm-prose">Sur les dix derniers signalements. Personne n\u2019est exclu pour un mauvais ratio : on le paie moins, et on vérifie derrière lui.</div></div>'
    +'<div class="tdlm-cadre">'+corps+'</div></div></div>';
}

/* ===================== ÉVÉNEMENTS ===================== */
function toast(msg){
  var t=document.createElement("div");t.className="tdlm-toast";t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){t.style.transition="opacity .4s";t.style.opacity="0";setTimeout(function(){t.remove();},400);},3600);
}

function brancher(){
  var stage=$("#tdlh-stage"); if(!stage)return;
  stage.querySelectorAll("[data-sel]").forEach(function(el){
    el.onclick=function(){S.sel=el.getAttribute("data-sel");S.drawer=null;S.inline=null;S.mob="detail";renderStage();};
  });
  var back=stage.querySelector("[data-back]"); if(back)back.onclick=function(){S.mob="liste";renderStage();};
  var vue=vueActive();
  if(vue){ if(vue.brancher)vue.brancher(stage); return; }
  var m=parId(S.sel), t=m&&m._t;
  stage.querySelectorAll("[data-act]").forEach(function(el){
    el.onclick=function(){if(t&&t.act)t.act(el.getAttribute("data-act"),m);};
  });
  stage.querySelectorAll("[data-do]").forEach(function(el){
    el.onclick=function(){if(t&&t.doo)t.doo(el.getAttribute("data-do"),m);};
  });
  if(t&&t.brancher)t.brancher(stage);
}

/* ===================== CHARGEMENT ===================== */
function absorber(rec){
  MEMBRES=(rec&&rec[CFG.NODE_MEMBRES])||MEMBRES;
  AVATARS=indexAvatars(rec);
  var racine=(rec&&rec[CFG.RACINE])||{};
  CARNET=racine[CFG.SOUS_CARNET]||{};
  var out=[];
  TYPES.forEach(function(t){
    var raw=racine[t.sous]||{};
    Object.keys(raw).forEach(function(id){
      var o=raw[id]||{}; o.id=id; o._t=t;
      out.push(t.normaliser?t.normaliser(o):o);
    });
  });
  out.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
  L=out;
}
function signature(){
  return L.map(function(o){return o._t.k+"/"+o.id+":"+JSON.stringify(serialize(o));}).sort().join("|")
    +"||"+JSON.stringify(CARNET);
}
function echeances(){
  TYPES.forEach(function(t){
    if(!t.auto)return;
    t.auto(L.filter(function(m){return m._t===t;}));
  });
}

function loadData(){
  loading("Ouverture du registre…");
  var pr;try{pr=window.EcoCore.safeReadBin();}catch(e){loading("EcoCore indisponible.");return;}
  Promise.resolve(pr).then(function(rec){
    absorber(rec);echeances();fixSel();renderAll();
  }).catch(function(){loading("Impossible de charger le registre.");});
}

function whenEco(cb){
  if(window.EcoCore&&window.EcoCore.safeReadBin){cb();return;}
  loading("Connexion à la base…");
  var n=0,iv=setInterval(function(){
    if(window.EcoCore&&window.EcoCore.safeReadBin){clearInterval(iv);cb();}
    else if(++n>80){clearInterval(iv);loading("EcoCore introuvable — vérifiez que le script économie est chargé.");}
  },125);
}

function occupe(){return !!(S.drawer||S.inline)||Date.now()-_lastWrite<5000;}
function tickRefresh(){
  if(!window.EcoCore||!window.EcoCore.safeReadBin)return;
  if(occupe())return;
  var ae=document.activeElement; if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))return;
  try{if(window.EcoCore.invalidateCache)window.EcoCore.invalidateCache();}catch(e){}
  var pr;try{pr=window.EcoCore.safeReadBin();}catch(e){return;}
  Promise.resolve(pr).then(function(rec){
    if(occupe())return;
    var avant=signature();
    absorber(rec);
    if(signature()===avant)return;
    echeances();fixSel();renderAll();
  }).catch(function(){});
}

/* TDLPoll ne surveille qu'un nœud : on écoute la racine, tous types confondus. */
function startAutoRefresh(){
  setInterval(tickRefresh,REFRESH_MS);
  if(window.TDLPoll)window.TDLPoll.suivre({node:CFG.RACINE, occupe:occupe, onDonnees:function(){tickRefresh();}});
}

/* ===================== INIT / MONTAGE ===================== */
function initApp(){
  var edit=$("#tdlh-edit");
  if(edit){edit.href=CFG.EDIT_URL||"#";if(isStaff())edit.classList.add("on");}
  whenEco(function(){loadData();startAutoRefresh();});
}

var mounted=false;
function boot(){
  if(mounted)return true;
  var bg=document.querySelector(".tdlh-bg");
  if(!bg)return false;
  mounted=true;
  document.body.appendChild(bg);
  var st=document.createElement("style");
  st.textContent="html#min-width,body,#wrap,#sj-main{min-width:0!important} html,body{overflow-x:hidden!important}";
  document.head.appendChild(st);
  if(!document.querySelector("meta[name=viewport]")){
    var mv=document.createElement("meta");mv.name="viewport";mv.content="width=device-width, initial-scale=1";
    document.head.appendChild(mv);
  }
  initApp();
  return true;
}

/* ===================== EXPORT ===================== */
window.TDLFlot = {
  CFG:CFG, S:S, STATUTS:STATUTS, DELAI_REFUS:DELAI_REFUS, CHEF_BONUS:CHEF_BONUS,
  /* un type arrivé après le montage relance la lecture */
  type: function(def){
    TYPES.push(def);
    if(mounted&&window.EcoCore&&window.EcoCore.safeReadBin)loadData();
  },
  /* vue annexe : { k, label, visible(), compte(), render(), brancher(stage) } */
  vue: function(def){ VUES.push(def); if(mounted)renderAll(); },
  esc:esc, escAttr:escAttr, vt:vt, money:money, ilya:ilya, nbJours:nbJours,
  newId:newId, av:av, stamp:stamp, toast:toast, $:$,
  patch:patch, supprimer:supprimerEntree, parId:parId,
  renderAll:renderAll, renderStage:renderStage, liste:function(){return L;},
  crediter:crediterDollars, solde:solde, carnet:function(){return CARNET;}, carnetEtat:carnetEtat,
  isStaff:isStaff, estConnecte:estConnecte, myPseudo:myPseudo,
  estFlottille:estFlottille, estCapitaine:estCapitaine, navireDe:navireDe,
  membres:function(){return MEMBRES;}
};

var tries=0, iv=setInterval(function(){if(boot()||++tries>60)clearInterval(iv);},250);
window.addEventListener("load",boot);
if(document.readyState!=="loading")boot();

})();
