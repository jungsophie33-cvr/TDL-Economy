/* THE DROWNED LANDS — TABLEAU DES MISSIONS (MARINGOUINS) · SOCLE
   (rep-mis-core.js) — à charger AVANT rep-mis-mission.js et rep-mis-coup.js.
   Ordre global : eco-core → tdl-base → rep-mis-core → rep-mis-mission →
   rep-mis-coup.

   [MAJ v4] FACTORISATION. rep-mis-marin dépassait 700 lignes et devait
     accueillir un second type d'entrée. Le fichier est scindé sur le modèle de
     TDLFlot et TDLCarr : ce socle porte tout ce qui ne dépend pas du type
     (données, argent, veille, liste, montage), et chaque type se déclare
     auprès de lui. AUCUNE donnée ne change de forme : le nœud missions
     est identique, le HTML du sujet porteur et les classes tdlm- aussi.

   [MAJ v4] UN CHAMP genre DISTINGUE LES DEUX TYPES. Absent, il vaut
     « mission » : toutes les entrées existantes sont donc lues exactement comme
     avant, sans conversion ni migration supplémentaire.

   [MAJ v4] CONVERSION v1 → v2 RETIRÉE. Plus aucune entrée du nœud missions
     n'était restée au format ancien : le plan de migration, le bandeau staff et
     lancerMigration n'avaient plus rien à convertir. exigeV2 reste en place,
     seul garde-fou utile si une entrée v1 revenait d'une sauvegarde.

   [MAJ v4] NŒUD PRIVÉ missions_prv/{id}, pour le seul rôle secret des coups,
     avec la sentinelle missions_rev PARTAGÉE : une écriture dans le privé bumpe
     la même révision, et la veille invalide le cache de l'entrée. Les autres
     tableaux ne lisent jamais ce nœud, et il est destiné à recevoir une règle
     de lecture par chemin (le titulaire et le staff).

   REPRIS DE v3 ET v4 SANS CHANGEMENT — les pièges déjà payés :
     - verrou() : tout mouvement d'argent pose un drapeau false→true dans une
       TRANSACTION avant de verser. Lire un booléen dans l'instantané en mémoire
       laissait deux clients verser la même prime deux fois, sans trace.
       COMPROMIS ASSUMÉ : le verrou est pris AVANT le versement — une entrée
       bloquée est visible et réparable, un double paiement est silencieux.
     - crediterDollars() : un delta négatif part en debiterDollars, qui LÈVE sur
       solde insuffisant ; l'ancienne version plafonnait à zéro et CRÉAIT la
       différence. Et une seule veille sentinelle à 15 s, deux lectures ciblées
       au chargement, toute écriture passant par TDLBase. */
(function(){
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  NODE: "missions",
  NODE_PRV: "missions_prv",
  NODE_REV: "missions_rev",
  NODE_MEMBRES: "membres",
  EDIT_URL: "https://thedrownedlands.forumactif.com/post?p=467&mode=editpost" /* [MAJ] édition du sujet porteur */
};
var SCHEMA     = 2;
var VEILLE_MS  = 15000;
var CHEF_BONUS = 50;                 /* bonus maison au chef d'une mission */
var DELAI_REFUS = 7 * 86400000;      /* 7 j sans chef → refus auto (missions) */

var STATUTS = {
  en_attente:    {label:"En attente",    c:"var(--gr3-color)"},
  acceptee:      {label:"Acceptée",      c:"var(--gr1-color)"},
  en_validation: {label:"En validation", c:"var(--gr4-color)"},
  terminee:      {label:"Terminée",      c:"var(--gr2-color)"},
  refusee:       {label:"Refusée",       c:"var(--gr6-color)"}
};
var TYPES = [
  {id:"recuperation", label:"Récupération", ic:"fi-tr-box-open"},
  {id:"contrebande",  label:"Contrebande",  ic:"fi-tr-sack"},
  {id:"transport",    label:"Transport",    ic:"fi-tr-truck-side"},
  {id:"sabotage",     label:"Sabotage",     ic:"fi-tr-bomb"},
  {id:"intimidation", label:"Intimidation", ic:"fi-tr-hand-fist"}
];

/* ===================== UTILS ===================== */
function typeLabel(id){for(var i=0;i<TYPES.length;i++){if(TYPES[i].id===id)return TYPES[i].label;}return id;}
function typeIcon(id){for(var i=0;i<TYPES.length;i++){if(TYPES[i].id===id)return TYPES[i].ic;}return "fi-tr-briefcase";}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escAttr(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function versTableau(v){return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]);}
function newId(p){return (p||"m")+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function cp(p){return window.TDLBase.clePseudo(p);}
/* pseudos : v1 = tableau de pseudos, v2 = {pseudoAssaini: pseudoRéel} */
function lstPseudos(v){
  if(v==null)return [];
  if(Array.isArray(v))return v.filter(Boolean).map(String);
  if(typeof v!=="object")return [];
  return Object.keys(v).map(function(k){return String(v[k]||k);});
}
function nbJours(iso){var t=new Date(iso).getTime();if(isNaN(t))return null;return Math.floor((Date.now()-t)/86400000);}
function ilya(iso){var d=nbJours(iso);if(d==null)return"\u2014";return d<=0?"aujourd'hui":("il y a "+d+" j");}
function money(n){return (+n||0)+" $";}
function $(s,ctx){return (ctx||document).querySelector(s);}

function crediterDollars(pseudo, delta){
  delta=Math.round(+delta||0);
  if(!delta)return Promise.resolve(0);
  return (delta>0) ? window.EcoCore.crediterDollars(pseudo, delta)
                   : window.EcoCore.debiterDollars(pseudo, -delta);
}
function verrou(m, champ){
  var path=CFG.NODE+"/"+encodeURIComponent(m.id)+"/"+champ;
  try{
    return Promise.resolve(window.EcoCore.firebaseTransaction(path,function(cur){
      if(cur===true)throw new Error("DEJA");
      return true;
    }));
  }catch(e){ return Promise.reject(e); }
}
function estDeja(e){ return !!(e&&e.message==="DEJA"); }

function isStaff(){try{return typeof _userdata!=="undefined"&&(_userdata.user_level===1||_userdata.user_level===2);}catch(e){return false;}}
function estConnecte(){try{return typeof _userdata!=="undefined"&&parseInt(_userdata.user_id,10)>0;}catch(e){return false;}}
function myPseudo(){try{if(typeof _userdata!=="undefined"&&_userdata.username)return String(_userdata.username).trim();}catch(e){}return null;}

/* ===================== DONNÉES ===================== */
var M=[], MEMBRES={}, TYPESDECL=[], VUES=[], PRVC={};
var PRV=null, VEILLE=null, demarre=false;

function genreDe(k){for(var i=0;i<TYPESDECL.length;i++)if(TYPESDECL[i].k===k)return TYPESDECL[i];return null;}
function vueDe(k){for(var i=0;i<VUES.length;i++)if(VUES[i].k===k)return VUES[i];return null;}
function vueActive(){var v=vueDe(S.statut);return (v&&(!v.visible||v.visible()))?v:null;}
function parId(id){for(var i=0;i<M.length;i++){if(M[i].id===id)return M[i];}return null;}

function hll(p){var m=p&&MEMBRES[p];return (m&&m.hors_la_loi)||null;}
function estMaringouin(p){var h=hll(p);return !!(h&&h.bande==="maringouins");}
function celluleDe(p){var h=hll(p);return (h&&h.cellule)||"";}
function solde(p){var m=MEMBRES[p];return (m&&+m.dollars)||0;}
/* Les trois cellules du lore, plus celles que les joueurs créeront : la liste
   affichée est l'union des deux, pour qu'une cellule existe au sélecteur avant
   d'avoir son premier membre.
   [MAJ] les CLÉS doivent être exactement ce qui est écrit dans
   membres/{pseudo}/hors_la_loi.cellule — « salespattes » est confirmé, les deux
   autres suivent la même convention (minuscules, sans accent ni espace). */
var CELLULES = {
  salespattes: "Les Sales Pattes",
  cypresmorts: "Les Cyprès morts",
  rouilles:    "Les Rouilles"
};
function celluleLabel(c){ return CELLULES[c]||c||""; }
function cellules(){
  var out=[], vu={};
  Object.keys(CELLULES).forEach(function(c){ vu[c]=1; out.push(c); });
  Object.keys(MEMBRES).forEach(function(p){
    var c=celluleDe(p); if(!c||vu[c])return; vu[c]=1; out.push(c);
  });
  out.sort(function(a,b){return celluleLabel(a).localeCompare(celluleLabel(b));});
  return out;
}

/* champs communs ; le reste est normalisé par le type */
function normaliser(o){
  o.schema=(o.schema===SCHEMA)?SCHEMA:1;
  /* genre absent = mission : toutes les entrées existantes passent par là */
  o.genre=genreDe(o.genre)?o.genre:"mission";
  o.titre=o.titre||"Mission"; o.type=o.type||"recuperation";
  o.statut=STATUTS[o.statut]?o.statut:"en_attente";
  o.chef=o.chef||null;
  o.participants=lstPseudos(o.participants);
  o.valides=lstPseudos(o.valides);
  o.objectif=o.objectif||""; o.contexte=o.contexte||"";
  o.contraintes=versTableau(o.contraintes);
  o.topic=o.topic||""; o.resume=o.resume||""; o.consequences=o.consequences||"";
  o.demandeValidation=!!o.demandeValidation;
  o.cree=o.cree||new Date().toISOString();
  o.primeVersee=!!o.primeVersee;
  var t=genreDe(o.genre);
  o=(t&&t.normaliser)?t.normaliser(o):o;
  o._t=t||null;
  return o;
}

/* ---- écritures : tout passe par le socle partagé ----
   PATCH ciblé + bump de missions_rev/{id} dans le MÊME appel réseau.
   RÈGLE : ne jamais écrire dans missions par un autre chemin. */
function patch(m, champs){
  return window.TDLBase.ecrire(CFG.NODE, m.id, champs, "modification de "+m.titre);
}
function patchPrv(m, champs){
  PRVC[m.id]=null;
  return PRV.ecrire(m.id, champs, "privé de "+m.titre);
}
/* Lecture paresseuse du privé : rend null tant que la feuille n'est pas là, et
   relance un rendu quand elle arrive. Une lecture refusée par les règles rend
   {} : le panneau se contente alors de ce qu'il peut montrer. */
function prv(m){
  if(Object.prototype.hasOwnProperty.call(PRVC,m.id)&&PRVC[m.id])return PRVC[m.id];
  if(PRVC["#"+m.id])return null;
  PRVC["#"+m.id]=1;
  Promise.resolve(window.EcoCore.firebaseGet(CFG.NODE_PRV+"/"+encodeURIComponent(m.id)))
    .then(function(v){ PRVC[m.id]=v||{}; })
    .catch(function(){ PRVC[m.id]={}; })
    .then(function(){ delete PRVC["#"+m.id]; renderStage(); });
  return null;
}

/* L'ENTRÉE EST INSÉRÉE DANS LA LISTE À LA MAIN. Le socle cale la révision
   localement au moment où il écrit — c'est ce qui évite de relire sa propre
   écriture à chaque tick — donc la veille ne rapportera JAMAIS l'entrée qu'on
   vient de créer, et elle n'apparaîtrait qu'au rechargement suivant. */
function creerEntree(id, objet, prive){
  objet.schema=SCHEMA;
  return window.TDLBase.ecrireEntree(CFG.NODE, id, objet, "ouverture de "+(objet.titre||id)).then(function(ok){
    if(!ok)return false;
    var suite=prive?PRV.ecrireEntree(id, prive, "privé de "+(objet.titre||id)):Promise.resolve(true);
    return Promise.resolve(suite).then(function(){
      PRVC[id]=prive||{};
      var o=objet; o.id=id;
      M.push(normaliser(o));
      M.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
      return true;
    });
  });
}
function supprimerEntree(m){
  window.TDLBase.supprimerEntree(CFG.NODE, m.id, "suppression de "+m.titre);
  PRV.supprimerEntree(m.id, "suppression du privé de "+m.titre);
  M=M.filter(function(x){return x!==m;});
  delete PRVC[m.id];
  fixSel(); S.drawer=null; S.inline=null; S.mob="liste";
}
/* GARDE-FOU CONSERVÉ après le retrait de la conversion v1 → v2, qui n'avait
   plus rien à convertir. Il ne coûte rien et protège le jour où une entrée au
   format ancien réapparaîtrait d'une restauration de sauvegarde : écrire dans
   participants ou valides d'une entrée v1 y écraserait la liste entière. */
function exigeV2(m){
  if(m&&m.schema===SCHEMA)return true;
  toast("Entrée au format ancien \u2014 lancez d\u2019abord la conversion (bouton staff).");
  return false;
}

/* ===================== ÉTAT ===================== */
var S = {statut:"tous", sel:null, mob:"liste", drawer:null, inline:null};
function occupe(){return !!(S.drawer||S.inline);}

function av(n){
  var c=window.TDLBase.avatar(n);
  if(c&&c.image)return '<span class="tdlm-avatar"><img src="'+escAttr(c.image)+'" alt=""></span>';
  return '<span class="tdlm-avatar">'+esc(String(n||"?").replace(/[@.\s]/g,"").slice(0,2).toUpperCase())+'</span>';
}
function toast(msg){
  var t=document.createElement("div");t.className="tdlm-toast";t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){t.style.transition="opacity .4s";t.style.opacity="0";
    setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},400);},3600);
}
function stamp(m){var v=STATUTS[m.statut]||{label:"\u2014",c:"var(--cntr)"};return '<span class="tdlm-stamp" style="--sc:'+v.c+'">'+v.label+'</span>';}

/* ===================== FILTRAGE ===================== */
function aDesDemandes(m){return m.demandeValidation;}
function filtre(){return M.filter(function(m){
  if(!m._t)return false;
  if(S.statut==="demandes")return aDesDemandes(m);
  return S.statut==="tous"||m.statut===S.statut;
});}
function fixSel(){var d=filtre(),ok=false;d.forEach(function(m){if(m.id===S.sel)ok=true;});if(!ok)S.sel=d[0]?d[0].id:null;}

function renderStatutFilters(){
  var chips=[{id:"tous",label:"Toutes",c:"var(--cntr)"}];
  Object.keys(STATUTS).forEach(function(id){chips.push({id:id,label:STATUTS[id].label,c:STATUTS[id].c});});
  var html=chips.map(function(s){
    var n=s.id==="tous"?M.length:M.filter(function(m){return m.statut===s.id;}).length;
    return '<button class="tdlm-stf" data-st="'+s.id+'" aria-pressed="'+(s.id===S.statut)+'" style="--sc:'+s.c+'">'
      +'<span class="tdlm-fdot"></span>'+s.label+' <b>'+n+'</b></button>';
  }).join("");
  if(isStaff()){
    var nd=M.filter(aDesDemandes).length;
    html+='<button class="tdlm-stf tdlm-req-chip" data-st="demandes" aria-pressed="'+(S.statut==="demandes")+'">\u2691 Demandes <b>'+nd+'</b></button>';
  }
  VUES.forEach(function(v){
    if(v.visible&&!v.visible())return;
    html+='<button class="tdlm-stf tdlm-req-chip" data-st="'+escAttr(v.k)+'" aria-pressed="'+(S.statut===v.k)+'">'+esc(v.label)+'</button>';
  });
  var el=$("#tdlm-stf");
  if(el){
    el.innerHTML=html;
    el.querySelectorAll(".tdlm-stf").forEach(function(b){
      b.onclick=function(){S.statut=b.getAttribute("data-st");S.drawer=null;S.inline=null;fixSel();renderStage();renderStatutFilters();};
    });
  }
}

/* ===================== RENDU ===================== */
function ligne(m){
  var t=m._t, o=(t.sub?t.sub(m):{})||{};
  var tags=((t.tags?t.tags(m):[])||[]).filter(Boolean);
  if(isStaff()&&m.demandeValidation)tags.unshift("\u2691 validation");
  var chips=tags.length?'<div class="tdlm-drow-tags">'+tags.map(function(x){
    return '<span class="tdlm-req">'+esc(x)+'</span>';}).join("")+'</div>':'';
  return '<div class="tdlm-drow" data-sel="'+escAttr(m.id)+'" aria-current="'+(m.id===S.sel)+'">'
    +'<span class="tdlm-ddot" style="--sc:'+(STATUTS[m.statut]||{c:"var(--cntr)"}).c+'"></span>'
    +'<div style="min-width:0">'
      +'<div class="tdlm-drow-head"><span class="tdlm-type">'+esc(m.titre)+'</span></div>'
      +'<div class="tdlm-drow-sub">'+esc(o.sub||t.label)+'</div>'+chips
    +'</div>'
    +'<div class="tdlm-drow-right">'+(o.qui?av(o.qui):'')
    +'<div class="tdlm-posted">'+esc(o.quand||("posté "+ilya(m.cree)))+'</div></div>'
  +'</div>';
}

function viewDossier(){
  var d=filtre();
  var rows=d.length?d.map(ligne).join(""):'<div class="tdlm-empty">Aucune entrée pour ce filtre.</div>';
  var sel=parId(S.sel)||d[0];
  return '<div class="tdlm-dossier'+(S.mob==="detail"?" detail":"")+'">'
    +'<div class="tdlm-dlist"><div class="tdlm-dlist-rows">'+rows+'</div></div>'
    +'<div class="tdlm-dpanel">'+(sel?sel._t.panel(sel):'<div class="tdlm-empty">\u2014</div>')+'</div></div>';
}

var _lastSel=null;
function renderStage(){
  var el=$("#tdlm-stage"); if(!el)return;
  var pl=el.querySelector(".tdlm-dlist-rows"), scl=pl?pl.scrollTop:0;
  var pb=el.querySelector(".tdlm-dp-body"),    scb=pb?pb.scrollTop:0;
  var same=(_lastSel===S.sel);
  var vue=vueActive();
  el.innerHTML=vue?vue.render():viewDossier();
  var nl=el.querySelector(".tdlm-dlist-rows"); if(nl)nl.scrollTop=scl;
  if(same){var nb=el.querySelector(".tdlm-dp-body"); if(nb)nb.scrollTop=scb;}
  _lastSel=S.sel;
  brancher();
}
function renderAll(){renderStatutFilters();renderStage();}
function loading(msg){var el=$("#tdlm-stage");if(el)el.innerHTML='<div class="tdlm-empty">'+esc(msg||"Chargement\u2026")+'</div>';}

/* ---- bandeau d'échec d'écriture (monté sur body : position:fixed) ---- */
function majBandeau(n){
  var el=document.getElementById("tdlm-echec");
  if(!n){ if(el&&el.parentNode)el.parentNode.removeChild(el); return; }
  if(!el){ el=document.createElement("div"); el.id="tdlm-echec"; el.className="tdlm-echec"; document.body.appendChild(el); }
  var s=(n>1)?"s":"";
  el.innerHTML='<span>\u26d4 '+n+' modification'+s+' non enregistrée'+s+'. Ne rechargez pas la page.</span>'
    +'<button class="tdlm-abtn prim" data-rejouer>Réessayer</button>';
  var b=el.querySelector("[data-rejouer]");
  b.onclick=function(){
    b.disabled=true; b.textContent="Envoi\u2026";
    window.TDLBase.reessayer().then(function(){
      var r=window.TDLBase.enAttente(); majBandeau(r);
      toast(r?("Il reste "+r+" modification(s) en échec."):"Modifications enregistrées.");
    });
  };
}

function brancher(){
  var stage=$("#tdlm-stage"); if(!stage)return;
  stage.querySelectorAll("[data-sel]").forEach(function(el){
    el.onclick=function(){S.sel=el.getAttribute("data-sel");S.drawer=null;S.inline=null;S.mob="detail";renderStage();};
  });
  var back=stage.querySelector("[data-back]");
  if(back)back.onclick=function(){S.mob="liste";renderStage();};
  var vue=vueActive();
  if(vue){ if(vue.brancher)vue.brancher(stage); return; }
  var m=parId(S.sel), t=m&&m._t;
  stage.querySelectorAll("[data-act]").forEach(function(el){
    var k=el.getAttribute("data-act");
    el.onclick=function(){if(t&&t.act)t.act(k,m);};
  });
  stage.querySelectorAll("[data-do]").forEach(function(el){
    el.onclick=function(){if(t&&t.doo)t.doo(el.getAttribute("data-do"),m);};
  });
  if(t&&t.brancher)t.brancher(stage);
}

/* ===================== ARGENT ===================== */
/* Un mouvement d'argent rend l'instantané des soldes périmé. */
function rafraichir(){
  return window.TDLBase.rafraichirMembres().then(function(mb){ MEMBRES=mb||{}; renderAll(); });
}

/* ===================== CHARGEMENT ===================== */
/* deux lectures ciblées (missions ~2 ko, membres ~3 ko via le socle) au lieu
   des 126 ko de la racine. Le privé n'est lu qu'à la sélection d'une entrée. */
function loadData(){
  loading("Chargement des missions\u2026");
  var pm, pb;
  try{ pm=window.EcoCore.firebaseGet(CFG.NODE); pb=window.TDLBase.membres(); }
  catch(e){ loading("EcoCore indisponible."); return; }
  Promise.all([Promise.resolve(pm), Promise.resolve(pb)]).then(function(r){
    var raw=r[0]||{};
    MEMBRES=r[1]||{};
    M=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliser(o);});
    M.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
    TYPESDECL.forEach(function(t){ if(t.auto)t.auto(M); });
    fixSel(); renderAll();
    if(VEILLE&&VEILLE.caler)VEILLE.caler(raw);
    if(!M.length)loading("Aucune entrée pour l'instant.");
  }).catch(function(){loading("Impossible de charger les missions.");});
}

function absorber(majs, supprimes){
  var change=false, j;
  majs.forEach(function(x){
    delete PRVC[x.id];
    var o=x.brut||{}; o.id=x.id;
    var n=normaliser(o), i=-1;
    for(j=0;j<M.length;j++){ if(M[j].id===x.id){i=j;break;} }
    if(i<0)M.push(n); else M[i]=n;
    change=true;
  });
  if(supprimes&&supprimes.length){
    M=M.filter(function(x){return supprimes.indexOf(x.id)<0;});
    supprimes.forEach(function(id){delete PRVC[id];});
    change=true;
  }
  if(!change)return;
  M.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
  TYPESDECL.forEach(function(t){ if(t.auto)t.auto(M); });
  fixSel(); renderAll();
}

function pret(){return !!(window.EcoCore&&window.EcoCore.firebaseGet&&window.TDLBase&&window.TDLBase.suivre);}
function whenEco(cb){
  if(pret()){cb();return;}
  loading("Connexion à la base\u2026");
  var n=0,iv2=setInterval(function(){
    if(pret()){clearInterval(iv2);cb();}
    else if(++n>80){clearInterval(iv2);loading("EcoCore ou tdl-base introuvable \u2014 vérifiez l\u2019ordre de chargement des scripts.");}
  },125);
}

/* ===================== INIT / MONTAGE ===================== */
function initApp(){
  var edit=$("#tdlm-edit");
  if(edit){edit.href=CFG.EDIT_URL||"#";if(isStaff())edit.classList.add("on");}
  whenEco(function(){
    demarre=true;
    PRV=window.TDLBase.table({node:CFG.NODE_PRV, revPath:CFG.NODE_REV});
    window.TDLBase.surEchec(majBandeau);
    window.TDLBase.avatars(function(){ if(!occupe())renderAll(); });
    VEILLE=window.TDLBase.suivre({
      node:CFG.NODE, rev:true, ms:VEILLE_MS, occupe:occupe, onEntrees:absorber
    });
    loadData();
  });
}

var mounted=false;
function boot(){
  if(mounted)return true;
  var bg=document.querySelector(".tdlm-bg");
  if(!bg||!document.querySelector("#tdlm-stage"))return false;
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
window.TDLMis = {
  CFG:CFG, S:S, STATUTS:STATUTS, TYPES:TYPES, SCHEMA:SCHEMA,
  CHEF_BONUS:CHEF_BONUS, DELAI_REFUS:DELAI_REFUS,
  type:function(def){ TYPESDECL.push(def); if(demarre)loadData(); },
  vue:function(def){ VUES.push(def); if(mounted)renderAll(); },
  esc:esc, escAttr:escAttr, versTableau:versTableau, lstPseudos:lstPseudos,
  cp:cp, av:av, money:money, ilya:ilya, nbJours:nbJours, newId:newId, $:$,
  toast:toast, stamp:stamp, typeLabel:typeLabel, typeIcon:typeIcon,
  patch:patch, ecr:patch, patchPrv:patchPrv, prv:prv,
  creerEntree:creerEntree, supprimer:supprimerEntree, exigeV2:exigeV2,
  parId:parId, liste:function(){return M;}, filtre:filtre, fixSel:fixSel,
  renderAll:renderAll, renderStage:renderStage,
  crediter:crediterDollars, verrou:verrou, estDeja:estDeja, rafraichir:rafraichir,
  solde:solde, membres:function(){return MEMBRES;},
  estMaringouin:estMaringouin, celluleDe:celluleDe, cellules:cellules,
  CELLULES:CELLULES, celluleLabel:celluleLabel,
  isStaff:isStaff, estConnecte:estConnecte, myPseudo:myPseudo
};

var tries=0, iv=setInterval(function(){if(boot()||++tries>60)clearInterval(iv);},250);
window.addEventListener("load",boot);
if(document.readyState!=="loading")boot();

})();
