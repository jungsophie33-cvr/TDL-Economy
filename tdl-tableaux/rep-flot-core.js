/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU HANGAR (LA FLOTTILLE) · SOCLE
   (rep-flot-core.js) — à charger AVANT rep-flot-ops.js.

   Moulé sur rep-mis-marin-v2-2.js, dont il réutilise intégralement le CSS
   « tdlm- ». Préfixe propre : « tdlh- » (tdlf- est pris par les Faiseuses).

   Ce fichier ne connaît AUCUN métier. Il tient la coquille, les onglets, la
   liste maître-détail, le rafraîchissement et l'écriture. Chaque flux
   (opérations, disparitions, marées, carnet) s'enregistre auprès de lui :

     TDLFlot.flux({
       k, label, ic, sous,          // sous = enfant de  flottille/<sous>
       statuts:{cle:{label,c}},     // pastilles + filtres
       normaliser(o), ligne(m),     // rendu d'une rangée de liste
       panel(m),                    // panneau de droite
       act(k,m), doo(k,m),          // actions barre / drawers
       auto(list)                   // échéances paresseuses (facultatif)
     });

   Données : flottille/<sous>/{id}. Appartenance lue dans
   membres/{pseudo}.hors_la_loi = { bande:"flottille", navire, role }.
   DÉPEND DE : window.EcoCore. Optionnel : window.TDLPoll, window.EcoNotif.
   ================================================================== */
(function(){
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  RACINE:       "flottille",
  NODE_MEMBRES: "membres",
  EDIT_URL:     "https://thedrownedlands.forumactif.com/post?p=475&mode=editpost" /* [MAJ] sujet porteur */
};
var DELAI_REFUS = 14 * 86400000;   /* 14 j sans preneur → refus auto + recrédit */
var CHEF_BONUS  = 50;              /* aligné sur rep-mis-marin et rep-det-main */
var REFRESH_MS  = 60000;

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

/* identité réelle (forum) */
function isStaff(){try{return typeof _userdata!=="undefined"&&(_userdata.user_level===1||_userdata.user_level===2);}catch(e){return false;}}
function estConnecte(){try{return typeof _userdata!=="undefined"&&parseInt(_userdata.user_id,10)>0;}catch(e){return false;}}
function myPseudo(){try{if(typeof _userdata!=="undefined"&&_userdata.username)return String(_userdata.username).trim();}catch(e){}return null;}

/* ===================== DONNÉES ===================== */
var FLUX = [];            /* descripteurs enregistrés, dans l'ordre d'arrivée */
var DATA = {};            /* DATA[fluxKey] = [items normalisés] */
var MEMBRES = {};
var AVATARS = {};

function fluxDe(k){for(var i=0;i<FLUX.length;i++)if(FLUX[i].k===k)return FLUX[i];return null;}
function fluxCourant(){return fluxDe(S.tab)||FLUX[0]||null;}
function liste(k){return DATA[k]||[];}

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

function serialize(m){var o={};for(var k in m){if(m.hasOwnProperty(k)&&k!=="id"&&k!=="_f")o[k]=m[k];}return o;}

var _lastWrite=0;
/* écriture ciblée : patch(m,{statut:…}) → PATCH flottille/<sous>/{id}/statut */
function patch(m, champs){
  _lastWrite=Date.now();
  var f=m._f; if(!f)return;
  var up={}; for(var k in champs){if(champs.hasOwnProperty(k))up[CFG.RACINE+"/"+f.sous+"/"+m.id+"/"+k]=champs[k];}
  try{var p=window.EcoCore.firebaseUpdate(up);if(p&&p.catch)p.catch(function(){toast("Sauvegarde échouée — réessaie.");});}
  catch(e){toast("Sauvegarde échouée.");}
}
function supprimerEntree(m){
  _lastWrite=Date.now();
  var f=m._f, up={}; up[CFG.RACINE+"/"+f.sous+"/"+m.id]=null;
  try{var p=window.EcoCore.firebaseUpdate(up);if(p&&p.catch)p.catch(function(){toast("Suppression échouée.");});}
  catch(e){toast("Suppression échouée.");}
  DATA[f.k]=liste(f.k).filter(function(x){return x!==m;});
  fixSel(); S.drawer=null; S.inline=null; S.mob="liste";
}
function parId(id){
  var f=fluxCourant(); if(!f)return null;
  var l=liste(f.k); for(var i=0;i<l.length;i++)if(l[i].id===id)return l[i];
  return null;
}

/* ===================== ÉTAT ===================== */
var S = {tab:null, statut:"tous", sel:null, mob:"liste", drawer:null, inline:null};

function filtre(){
  var f=fluxCourant(); if(!f)return [];
  return liste(f.k).filter(function(m){
    if(S.statut==="demandes")return !!m.demandeValidation;
    return S.statut==="tous"||m.statut===S.statut;
  });
}
function fixSel(){var d=filtre(),ok=false;d.forEach(function(m){if(m.id===S.sel)ok=true;});if(!ok)S.sel=d[0]?d[0].id:null;}

/* ===================== RENDER ===================== */
function stamp(m){var v=(m._f.statuts[m.statut])||{label:m.statut,c:"var(--cntr)"};return '<span class="tdlm-stamp" style="--sc:'+v.c+'">'+esc(v.label)+'</span>';}

function renderOnglets(){
  var el=$("#tdlh-tabs"); if(!el)return;
  el.innerHTML=FLUX.map(function(f){
    return '<button class="tdlm-stf" data-tab="'+f.k+'" aria-pressed="'+(f.k===S.tab)+'">'
      +(f.ic?'<i class="fi '+f.ic+'"></i> ':'')+esc(f.label)+' <b>'+liste(f.k).length+'</b></button>';
  }).join("");
  el.querySelectorAll("[data-tab]").forEach(function(b){
    b.onclick=function(){S.tab=b.getAttribute("data-tab");S.statut="tous";S.drawer=null;S.inline=null;fixSel();renderAll();};
  });
}

function renderStatutFilters(){
  var f=fluxCourant(), el=$("#tdlh-stf"); if(!el)return;
  if(!f){el.innerHTML="";return;}
  var l=liste(f.k);
  var chips=[{id:"tous",label:"Tout",c:"var(--cntr)"}];
  Object.keys(f.statuts).forEach(function(id){chips.push({id:id,label:f.statuts[id].label,c:f.statuts[id].c});});
  var html=chips.map(function(s){
    var n=s.id==="tous"?l.length:l.filter(function(m){return m.statut===s.id;}).length;
    return '<button class="tdlm-stf" data-st="'+s.id+'" aria-pressed="'+(s.id===S.statut)+'" style="--sc:'+s.c+'"><span class="tdlm-fdot"></span>'+esc(s.label)+' <b>'+n+'</b></button>';
  }).join("");
  if(isStaff()){
    var nd=l.filter(function(m){return !!m.demandeValidation;}).length;
    html+='<button class="tdlm-stf tdlm-req-chip" data-st="demandes" aria-pressed="'+(S.statut==="demandes")+'">⚑ Validation <b>'+nd+'</b></button>';
  }
  el.innerHTML=html;
  el.querySelectorAll("[data-st]").forEach(function(b){
    b.onclick=function(){S.statut=b.getAttribute("data-st");fixSel();renderStage();renderStatutFilters();};
  });
}

var _lastSel=null;
function renderStage(){
  var el=$("#tdlh-stage"); if(!el)return;
  var pl=el.querySelector(".tdlm-dlist-rows"); var scl=pl?pl.scrollTop:0;
  var pb=el.querySelector(".tdlm-dp-body"); var scb=pb?pb.scrollTop:0;
  var same=(_lastSel===S.sel);
  el.innerHTML=viewDossier();
  var nl=el.querySelector(".tdlm-dlist-rows"); if(nl)nl.scrollTop=scl;
  if(same){var nb=el.querySelector(".tdlm-dp-body"); if(nb)nb.scrollTop=scb;}
  _lastSel=S.sel;
  brancher();
}
function renderAll(){renderOnglets();renderStatutFilters();renderStage();}
function loading(msg){var el=$("#tdlh-stage");if(el)el.innerHTML='<div class="tdlm-empty">'+esc(msg||"Chargement…")+'</div>';}

function viewDossier(){
  var f=fluxCourant();
  if(!f)return '<div class="tdlm-empty">Aucun registre chargé.</div>';
  var d=filtre();
  var rows=d.length?d.map(function(m){return f.ligne(m);}).join("")
                   :'<div class="tdlm-empty">'+esc(f.vide||"Rien à cet endroit du registre.")+'</div>';
  var sel=parId(S.sel)||d[0];
  return '<div class="tdlm-dossier'+(S.mob==="detail"?" detail":"")+'">'
    +'<div class="tdlm-dlist"><div class="tdlm-dlist-rows">'+rows+'</div></div>'
    +'<div class="tdlm-dpanel">'+(sel?f.panel(sel):'<div class="tdlm-empty">—</div>')+'</div></div>';
}

/* rangée standard, offerte aux flux pour éviter la duplication */
function rangee(m, o){
  var tags=(o.tags||[]).filter(Boolean).map(function(t){return '<span class="tdlm-req">'+t+'</span>';}).join("");
  if(isStaff()&&m.demandeValidation)tags+='<span class="tdlm-req">⚑ validation</span>';
  var st=(m._f.statuts[m.statut])||{c:"var(--cntr)"};
  return '<div class="tdlm-drow" data-sel="'+m.id+'" aria-current="'+(m.id===S.sel)+'">'
    +'<span class="tdlm-ddot" style="--sc:'+st.c+'"></span>'
    +'<div style="min-width:0">'
      +'<div class="tdlm-drow-head"><span class="tdlm-type">'+esc(o.titre)+'</span></div>'
      +'<div class="tdlm-drow-sub">'+esc(o.sub||"")+'</div>'
      +(tags?'<div class="tdlm-drow-tags">'+tags+'</div>':'')
    +'</div>'
    +'<div class="tdlm-drow-right">'+(o.qui?av(o.qui):'')+'<div class="tdlm-posted">'+esc(o.quand||"")+'</div></div>'
  +'</div>';
}

/* ===================== ÉVÉNEMENTS ===================== */
function toast(msg){
  var t=document.createElement("div");t.className="tdlm-toast";t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){t.style.transition="opacity .4s";t.style.opacity="0";setTimeout(function(){t.remove();},400);},3600);
}

function brancher(){
  var stage=$("#tdlh-stage"), f=fluxCourant(); if(!stage||!f)return;
  stage.querySelectorAll("[data-sel]").forEach(function(el){
    el.onclick=function(){S.sel=el.getAttribute("data-sel");S.drawer=null;S.inline=null;S.mob="detail";renderStage();};
  });
  var back=stage.querySelector("[data-back]"); if(back)back.onclick=function(){S.mob="liste";renderStage();};
  stage.querySelectorAll("[data-act]").forEach(function(el){
    el.onclick=function(){var m=parId(S.sel); if(m&&f.act)f.act(el.getAttribute("data-act"),m);};
  });
  stage.querySelectorAll("[data-do]").forEach(function(el){
    el.onclick=function(){var m=parId(S.sel); if(m&&f.doo)f.doo(el.getAttribute("data-do"),m);};
  });
  if(f.brancher)f.brancher(stage);
}

/* ===================== CHARGEMENT ===================== */
function absorber(rec){
  MEMBRES=(rec&&rec[CFG.NODE_MEMBRES])||MEMBRES;
  AVATARS=indexAvatars(rec);
  var racine=(rec&&rec[CFG.RACINE])||{};
  FLUX.forEach(function(f){
    var raw=racine[f.sous]||{};
    var l=Object.keys(raw).map(function(id){
      var o=raw[id]||{}; o.id=id; o._f=f;
      return f.normaliser?f.normaliser(o):o;
    });
    l.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
    DATA[f.k]=l;
  });
}
function signature(){
  var out=[];
  FLUX.forEach(function(f){
    liste(f.k).forEach(function(o){out.push(f.k+"/"+o.id+":"+JSON.stringify(serialize(o)));});
  });
  return out.sort().join("|");
}
function echeances(){FLUX.forEach(function(f){if(f.auto)f.auto(liste(f.k));});}

function loadData(){
  loading("Ouverture du registre…");
  var pr;try{pr=window.EcoCore.safeReadBin();}catch(e){loading("EcoCore indisponible.");return;}
  Promise.resolve(pr).then(function(rec){
    absorber(rec);
    if(!S.tab&&FLUX.length)S.tab=FLUX[0].k;
    echeances();fixSel();renderAll();
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

/* TDLPoll ne surveille qu'un nœud : on écoute la racine, tous flux confondus. */
function startAutoRefresh(){
  setInterval(tickRefresh,REFRESH_MS);
  if(window.TDLPoll)window.TDLPoll.suivre({
    node: CFG.RACINE,
    occupe: occupe,
    onDonnees: function(){ tickRefresh(); }
  });
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
  CFG:CFG, S:S, DELAI_REFUS:DELAI_REFUS, CHEF_BONUS:CHEF_BONUS,
  /* enregistrement d'un flux ; un flux arrivé après le montage relance la lecture */
  flux: function(def){
    FLUX.push(def);
    if(!S.tab)S.tab=def.k;
    if(mounted&&window.EcoCore&&window.EcoCore.safeReadBin)loadData();
  },
  esc:esc, escAttr:escAttr, vt:vt, money:money, ilya:ilya, nbJours:nbJours,
  newId:newId, av:av, stamp:stamp, rangee:rangee, toast:toast, $:$,
  patch:patch, supprimer:supprimerEntree, parId:parId,
  renderAll:renderAll, renderStage:renderStage, liste:liste,
  crediter:crediterDollars, solde:solde,
  isStaff:isStaff, estConnecte:estConnecte, myPseudo:myPseudo,
  estFlottille:estFlottille, estCapitaine:estCapitaine, navireDe:navireDe,
  membres: function(){return MEMBRES;}
};

var tries=0, iv=setInterval(function(){if(boot()||++tries>60)clearInterval(iv);},250);
window.addEventListener("load",boot);
if(document.readyState!=="loading")boot();

})();
