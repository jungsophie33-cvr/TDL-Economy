/* THE DROWNED LANDS — TABLEAU DES SECRETS · SOCLE (Sorcières du Baron / Spectres)
   Moulé sur rep-det-main, dont il réutilise le CSS (classes tdlm-).
   Données : lost_bayou/{id}, sentinelle lost_bayou_rev/{id} ; le registre des
   secrets (nœud secrets, sentinelle secrets_rev) est une VUE à part, comme l'ardoise.

   CE FICHIER NE CONNAÎT AUCUN TYPE DE FICHE. Chaque module pousse le sien dans
   window.TDLBayou.types ; le socle fournit la coquille (zones, filtres, liste,
   panneau), la veille, les droits et les écritures. Ordre de chargement :
   eco-core → tdl-base → rep-lb-core → rep-lb-<type>… (comme la Barge).

   ACCÈS (tranché par le visible() de chaque module ; le socle ne pose que le
   garde-fou du dernier recours) : Sorcière et staff voient tout ; un Spectre
   l'avant-poste et les délibérations ; tout le monde l'avant-poste seul, pour
   pouvoir y déposer ; le demandeur et le PJ visé leur seule fiche.

   LE CONTENU D'UN SECRET NE SORT JAMAIS D'ICI. Le nœud secrets n'est même pas
   lu si le lecteur n'est pas Sorcière : une délibération porte une COPIE de
   l'intitulé public du secret, jamais son contenu. */
(function(){
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  NODE: "lost_bayou",
  NODE_SECRETS: "secrets",
  BANDE: "sorcieres",
  COMMUNAUTE: "Les Spectres",            /* libellé du groupe FA, comparé par inclusion */
  EDIT_URL: "https://thedrownedlands.forumactif.com/post?p=510&mode=editpost"
};
var SCHEMA    = 2;
var VEILLE_MS = 15000;

var TEXTES = {
  REGISTRE:"Registre", CHARGE:"Chargement du tableau…", VIDE:"Aucune fiche pour ce filtre.",
  RIEN:"—", TOUS:"Toutes", RETOUR:"‹ Retour", VOUS:"Vous : ", INVITE:"Connectez-vous.",
  ETRANGER:"Ce tableau ne vous concerne pas.", RIEN_FAIRE:"Rien à faire pour l\u2019instant.",
  PAS_TYPE:"Aucun module de fiche chargé \u2014 vérifiez l\u2019ordre de chargement des scripts.",
  PAS_REG:"Le registre n\u2019est pas chargé.", BASE:"Connexion à la base…",
  SOCLE:"EcoCore ou tdl-base introuvable \u2014 vérifiez l\u2019ordre de chargement des scripts.",
  ECHEC:"Impossible de charger le tableau.",
  NON_ECRIT:function(n){ var s=n>1?"s":""; return "⛔ "+n+" modification"+s+" non enregistrée"+s+". Ne rechargez pas la page."; }
};

/* ===================== REGISTRE DES MODULES ===================== */
/* Un type fournit : k, label, icon, statuts{id:{label,c}} ; normaliser(o) ;
   visible(m,api) ; ligne(m,api)→{titre,sous,tags[]} ; panel(m,api) ;
   actionbar(m,api) ; drawer(m,api) ; acte(k,m,api,el) ; faire(k,m,api,el) ;
   brancher(stage,api) ; et, facultatif, creer()→{peut,label,form,submit}. */
var REG = (window.TDLBayou = window.TDLBayou || { types: [], registre: null });

function types(){ return REG.types; }
function typeDe(k){ var t=types(); for(var i=0;i<t.length;i++){ if(t[i].k===k)return t[i]; } return null; }
function statutsDe(k){ var t=typeDe(k); return (t&&t.statuts)||{}; }

/* ===================== UTILS ===================== */
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escAttr(s){return String(s==null?"":s).replace(/"/g,"&quot;");}
function vt(v){return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]);}
function newId(){return "lb"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function cp(p){return window.TDLBase.clePseudo(p);}
function lstPseudos(v){
  if(v==null)return [];
  if(Array.isArray(v))return v.filter(Boolean).map(String);
  if(typeof v!=="object")return [];
  return Object.keys(v).map(function(k){return String(v[k]||k);});
}
function nbJours(iso){var t=new Date(iso).getTime();if(isNaN(t))return null;return Math.floor((Date.now()-t)/86400000);}
function ilya(iso){var d=nbJours(iso);if(d==null)return TEXTES.RIEN;return d<=0?"aujourd\u2019hui":("il y a "+d+" j");}
function joursRestants(iso,delai){var d=nbJours(iso);return d==null?null:Math.max(0,delai-d);}
function dateFr(iso){var d=new Date(iso);return isNaN(d.getTime())?TEXTES.RIEN:d.toLocaleDateString("fr-FR");}

function isStaff(){try{return typeof _userdata!=="undefined"&&(_userdata.user_level===1||_userdata.user_level===2);}catch(e){return false;}}
function estConnecte(){try{return typeof _userdata!=="undefined"&&parseInt(_userdata.user_id,10)>0;}catch(e){return false;}}
function myPseudo(){try{if(typeof _userdata!=="undefined"&&_userdata.username)return String(_userdata.username).trim();}catch(e){}return null;}

/* ===================== DONNÉES ===================== */
var D = [];          /* fiches de lost_bayou                     */
var SECRETS = [];    /* registre — chargé pour les Sorcières seules */
var MEMBRES = {};

function hll(p){var m=MEMBRES[p];return (m&&m.hors_la_loi)||null;}
function estSorciere(p){var h=hll(p);return !!(h&&h.bande===CFG.BANDE);}
/* group porte le LIBELLÉ complet du groupe FA — comparer par inclusion */
function estSpectre(p){var m=MEMBRES[p];return !!m&&String(m.group||"").indexOf(CFG.COMMUNAUTE)>=0;}
/* Une voix de Spectre ou du staff n'est qu'un APPOINT : le module compte les
   voix, le socle dit seulement qui a le droit d'en donner une. */
function peutVoter(p){ return estSorciere(p)||estSpectre(p)||isStaff(); }

function parId(id){for(var i=0;i<D.length;i++){if(D[i].id===id)return D[i];}return null;}
function secretParId(id){for(var i=0;i<SECRETS.length;i++){if(SECRETS[i].id===id)return SECRETS[i];}return null;}

function normaliser(o){
  o.schema=(o.schema===SCHEMA)?SCHEMA:1;
  o.type=o.type||""; o.titre=o.titre||"Fiche"; o.origine=o.origine||"tableau";
  o.demandeur=o.demandeur||null; o.statut=o.statut||""; o.responsable=o.responsable||null;
  o.participants=lstPseudos(o.participants);
  o.votes=(o.votes&&typeof o.votes==="object")?o.votes:{};
  o.sujet=o.sujet||""; o.resume=o.resume||""; o.consequences=o.consequences||"";
  o.demandeValidation=!!o.demandeValidation;
  o.cree=o.cree||new Date().toISOString(); o.ouverte=o.ouverte||o.cree; o.clos=o.clos||null;
  var t=typeDe(o.type);
  if(t&&t.normaliser)t.normaliser(o);
  return o;
}
function normaliserSecret(o){
  o.schema=(o.schema===SCHEMA)?SCHEMA:1;
  o.intitule=o.intitule||""; o.contenu=o.contenu||""; o.origine=o.origine||"";
  o.deposant=o.deposant||null; o.recueilliPar=o.recueilliPar||null;
  o.etat=(o.etat==="pot")?"pot":"prive"; o.usage=o.usage||"dormant"; o.deOuvert=!!o.deOuvert;
  o.fuite=(o.fuite&&typeof o.fuite==="object")?o.fuite:null;
  o.rumeur=(o.rumeur&&typeof o.rumeur==="object")?o.rumeur:null;
  o.cree=o.cree||new Date().toISOString();
  return o;
}

/* ---- écritures : tout passe par le socle partagé ----
   PATCH ciblé + bump de {node}_rev/{id} dans le MÊME appel réseau.
   RÈGLE : ne jamais écrire dans lost_bayou ni secrets par un autre chemin. */
function patch(m, champs){
  return window.TDLBase.ecrire(CFG.NODE, m.id, champs, "modification de "+m.titre);
}
function patchSecret(s, champs){
  return window.TDLBase.ecrire(CFG.NODE_SECRETS, s.id, champs, "modification d\u2019un secret");
}
function creerFiche(o, libelle){
  var id=newId();
  return Promise.resolve(window.TDLBase.ecrireEntree(CFG.NODE, id, o, libelle||"ouverture de fiche"))
    .then(function(ok){
      if(!ok)return null;
      var copie={}; for(var k in o)if(o.hasOwnProperty(k))copie[k]=o[k];
      copie.id=id; D.unshift(normaliser(copie)); return id;
    });
}

/* ===================== DROITS / VISIBILITÉ ===================== */
/* Dernier recours seulement : un module qui ne déclare pas visible() tombe sur
   la règle la plus fermée — Sorcières et staff. Mieux vaut une fiche invisible
   qu'une fiche ouverte à tout le forum par oubli. */
function visible(m){
  var t=typeDe(m.type), me=myPseudo();
  if(isStaff())return true;
  if(t&&t.visible)return !!t.visible(m, API);
  return estSorciere(me);
}

/* ===================== ÉTAT ===================== */
var S={zone:null, statut:"tous", sel:null, mob:"liste", drawer:null, inline:null, creation:false};
function $(s,ctx){return (ctx||document).querySelector(s);}
function av(n){
  var c=window.TDLBase.avatar(n);
  if(c&&c.image)return '<span class="tdlm-avatar"><img src="'+escAttr(c.image)+'" alt=""></span>';
  return '<span class="tdlm-avatar">'+esc(String(n||"?").replace(/[@.\s]/g,"").slice(0,2).toUpperCase())+'</span>';
}
function occupe(){ return !!(S.drawer||S.inline||S.creation); }
/* une zone n'est offerte que si au moins une de ses fiches est visible, ou si
   son module permet d'en créer une — sinon l'onglet mène à une page vide */
function zonesOuvertes(){
  return types().filter(function(t){
    if(t.creer&&t.creer().peut&&t.creer().peut(API))return true;
    for(var i=0;i<D.length;i++){ if(D[i].type===t.k&&visible(D[i]))return true; }
    return false;
  });
}
function fixZone(){
  if(S.zone==="registre")return;
  var z=zonesOuvertes(), ok=false;
  z.forEach(function(t){ if(t.k===S.zone)ok=true; });
  if(!ok)S.zone=z[0]?z[0].k:null;
}
function filtre(){
  if(!S.zone||S.zone==="registre")return [];
  return D.filter(function(m){
    if(m.type!==S.zone||!visible(m))return false;
    if(S.statut==="demandes")return !!m.demandeValidation;
    return S.statut==="tous"||m.statut===S.statut;
  });
}
function fixSel(){var d=filtre(),ok=false;d.forEach(function(m){if(m.id===S.sel)ok=true;});if(!ok)S.sel=d[0]?d[0].id:null;}

/* ===================== RENDER ===================== */
function loading(msg){var el=$("#tdlb-stage");if(el)el.innerHTML='<div class="tdlm-empty">'+esc(msg||TEXTES.CHARGE)+'</div>';}

function renderZones(){
  var el=$("#tdlb-zones"); if(!el)return;
  var html=zonesOuvertes().map(function(t){
    var n=D.filter(function(m){return m.type===t.k&&visible(m);}).length;
    return '<button class="tdlr-tab'+(t.k===S.zone?" on":"")+'" data-z="'+escAttr(t.k)+'">'
      +(t.icon?'<i class="fi '+escAttr(t.icon)+'"></i> ':"")+esc(t.label)+' <b>'+n+'</b></button>';
  }).join("");
  if(REG.registre&&(estSorciere(myPseudo())||isStaff()))
    html+='<button class="tdlr-tab'+(S.zone==="registre"?" on":"")+'" data-z="registre">'
      +'<i class="fi fi-tr-book-bookmark"></i> '+TEXTES.REGISTRE+' <b>'+SECRETS.length+'</b></button>';
  el.innerHTML=html;
  el.querySelectorAll(".tdlr-tab").forEach(function(b){
    b.onclick=function(){
      S.zone=b.getAttribute("data-z"); S.statut="tous"; S.drawer=null; S.inline=null; S.creation=false;
      fixSel(); renderAll(); };
  });
}

function renderStatutFilters(){
  var el=$("#tdlb-stf"); if(!el)return;
  if(!S.zone||S.zone==="registre"){el.innerHTML="";return;}
  var vis=D.filter(function(m){return m.type===S.zone&&visible(m);});
  var ST=statutsDe(S.zone);
  var chips=[{id:"tous",label:TEXTES.TOUS,c:"var(--cntr)"}];
  Object.keys(ST).forEach(function(id){chips.push({id:id,label:ST[id].label,c:ST[id].c});});
  var html=chips.map(function(s){
    var n=s.id==="tous"?vis.length:vis.filter(function(m){return m.statut===s.id;}).length;
    return '<button class="tdlm-stf" data-st="'+escAttr(s.id)+'" aria-pressed="'+(s.id===S.statut)+'" style="--sc:'+s.c+'">'
      +'<span class="tdlm-fdot"></span>'+esc(s.label)+' <b>'+n+'</b></button>';
  }).join("");
  if(isStaff()){
    var nd=vis.filter(function(m){return m.demandeValidation;}).length;
    html+='<button class="tdlm-stf tdlm-req-chip" data-st="demandes" aria-pressed="'+(S.statut==="demandes")+'">⚑ À traiter <b>'+nd+'</b></button>';
  }
  el.innerHTML=html;
  el.querySelectorAll(".tdlm-stf").forEach(function(b){
    b.onclick=function(){S.statut=b.getAttribute("data-st");fixSel();renderStage();renderStatutFilters();}; });
}

function stamp(m){
  var ST=statutsDe(m.type), v=ST[m.statut];
  if(!v)return "";
  return '<span class="tdlm-stamp" style="--sc:'+v.c+'">'+esc(v.label)+'</span>';
}

var _lastSel=null;
function renderStage(){
  var el=$("#tdlb-stage"); if(!el)return;
  var pl=el.querySelector(".tdlm-dlist-rows"); var scl=pl?pl.scrollTop:0;
  var pb=el.querySelector(".tdlm-dp-body"); var scb=pb?pb.scrollTop:0;
  var same=(_lastSel===S.sel);
  el.innerHTML=vue();
  var nl=el.querySelector(".tdlm-dlist-rows"); if(nl)nl.scrollTop=scl;
  if(same){var nb=el.querySelector(".tdlm-dp-body"); if(nb)nb.scrollTop=scb;}
  _lastSel=S.sel;
  brancher();
}
function renderAll(){renderZones();renderStatutFilters();renderStage();}

function vue(){
  if(!types().length)return '<div class="tdlm-empty">'+TEXTES.PAS_TYPE+'</div>';
  if(S.zone==="registre")
    return REG.registre?REG.registre(API):'<div class="tdlm-empty">'+TEXTES.PAS_REG+'</div>';
  var t=typeDe(S.zone);
  if(!t)return '<div class="tdlm-empty">'+TEXTES.VIDE+'</div>';
  if(S.creation&&t.creer)return t.creer().form(API);
  return viewFiches(t);
}

function viewFiches(t){
  var d=filtre();
  var rows=d.length?d.map(function(m){
    var L=t.ligne?t.ligne(m, API):{titre:m.titre, sous:"", tags:[]}, ST=statutsDe(m.type);
    var c=(ST[m.statut]&&ST[m.statut].c)||"var(--cntr)";
    var tags=(L.tags||[]).map(function(x){
      return '<span class="tdlm-req"'+(x.c?' style="background:'+x.c+'"':"")+'>'+esc(x.l||x)+'</span>';
    }).join("");
    return '<div class="tdlm-drow" data-sel="'+escAttr(m.id)+'" aria-current="'+(m.id===S.sel)+'">'
      +'<span class="tdlm-ddot" style="--sc:'+c+'"></span>'
      +'<div style="min-width:0">'
        +'<div class="tdlm-drow-head"><span class="tdlm-type">'+esc(L.titre||m.titre)+'</span></div>'
        +(L.sous?'<div class="tdlm-drow-sub">'+esc(L.sous)+'</div>':"")
        +(tags?'<div class="tdlm-drow-tags">'+tags+'</div>':"")
      +'</div>'
      +'<div class="tdlm-drow-right">'+(m.responsable?av(m.responsable):"")
        +'<div class="tdlm-posted">ouverte '+ilya(m.cree)+'</div></div>'
    +'</div>';
  }).join(""):'<div class="tdlm-empty">'+TEXTES.VIDE+'</div>';
  var sel=parId(S.sel)||d[0];
  return '<div class="tdlm-dossier'+(S.mob==="detail"?" detail":"")+'">'
    +'<div class="tdlm-dlist"><div class="tdlm-dlist-rows">'+rows+'</div></div>'
    +'<div class="tdlm-dpanel">'+(sel?panneau(t,sel):'<div class="tdlm-empty">'+TEXTES.RIEN+'</div>')+'</div></div>';
}

function panneau(t, m){
  var corps=t.panel?t.panel(m, API):"";
  var tiroir=(S.drawer||S.inline)&&t.drawer?t.drawer(m, API):"";
  var barre=t.actionbar?t.actionbar(m, API):"";
  if(!barre)barre=actionbarDefaut();
  return '<button class="tdlm-dret" data-back="1">'+TEXTES.RETOUR+'</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">'+esc(m.titre)+'</span>'+stamp(m)+'</div>'
    +'<div class="tdlm-dp-body">'+corps+tiroir+'</div>'
    +barre;
}
function actionbarDefaut(){
  var me=myPseudo(), role="Visiteur", txt=TEXTES.ETRANGER;
  if(estSorciere(me)){role="Sorcière";txt=TEXTES.RIEN_FAIRE;}
  else if(estSpectre(me)){role="Spectre";txt=TEXTES.RIEN_FAIRE;}
  else if(!estConnecte()){role="Invité";txt=TEXTES.INVITE;}
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">'+TEXTES.VOUS+role+'</span>'
    +'<span class="tdlm-idle">'+esc(txt)+'</span></div>';
}

/* ===================== ÉVÉNEMENTS ===================== */
function toast(msg){
  var t=document.createElement("div");t.className="tdlm-toast";t.textContent=msg;document.body.appendChild(t);
  setTimeout(function(){t.style.transition="opacity .4s";t.style.opacity="0";setTimeout(function(){t.remove();},400);},3600);
}
/* bandeau d'échec d'écriture — monté sur body (position:fixed piégé par FA) */
function majBandeau(n){
  var el=document.getElementById("tdlb-echec");
  if(!n){ if(el)el.remove(); return; }
  if(!el){ el=document.createElement("div"); el.id="tdlb-echec"; el.className="tdlm-echec"; document.body.appendChild(el); }
  el.innerHTML='<span>'+TEXTES.NON_ECRIT(n)+'</span><button class="tdlm-abtn prim" data-rejouer>Réessayer</button>';
  var b=el.querySelector("[data-rejouer]");
  b.onclick=function(){
    b.disabled=true; b.textContent="Envoi…";
    window.TDLBase.reessayer().then(function(){
      var reste=window.TDLBase.enAttente(); majBandeau(reste);
      toast(reste?"Il reste "+reste+" modification(s) en échec.":"Modifications enregistrées."); });
  };
}

function brancher(){
  var stage=$("#tdlb-stage"); if(!stage)return;
  stage.querySelectorAll("[data-sel]").forEach(function(el){
    el.onclick=function(){S.sel=el.getAttribute("data-sel");S.drawer=null;S.inline=null;S.mob="detail";renderStage();}; });
  var back=stage.querySelector("[data-back]"); if(back)back.onclick=function(){S.mob="liste";renderStage();};
  stage.querySelectorAll("[data-act]").forEach(function(el){
    el.onclick=function(){ relayer("acte", el.getAttribute("data-act"), el); }; });
  stage.querySelectorAll("[data-do]").forEach(function(el){
    el.onclick=function(){ relayer("faire", el.getAttribute("data-do"), el); }; });
  var t=typeDe(S.zone);
  if(t&&t.brancher)t.brancher(stage, API);
  if(S.zone==="registre"&&REG.brancher)REG.brancher(stage, API);
}
/* Les clics génériques du socle sont traités ici ; tout le reste part au module
   de la zone affichée, qui seul connaît ses actions. */
function relayer(canal, k, el){
  if(k==="newcancel"){S.creation=false;renderStage();return;}
  if(k==="new"){S.creation=true;S.drawer=null;S.inline=null;renderStage();return;}
  if(k==="cancel"){S.drawer=null;S.inline=null;renderStage();return;}
  if(S.zone==="registre"){ if(REG[canal])REG[canal](k, API, el); return; }
  var t=typeDe(S.zone); if(!t)return;
  var m=parId(S.sel);
  if(t[canal])t[canal](k, m, API, el);
}

/* ===================== API DES MODULES ===================== */
var API={
  /* lecture */
  fiches:function(){return D;}, fiche:function(id){return parId(id);},
  secrets:function(){return SECRETS;}, secret:function(id){return secretParId(id);},
  membres:function(){return MEMBRES;}, selId:function(){return S.sel;}, etat:function(){return S;},
  /* identité et droits */
  moi:myPseudo, staff:isStaff, connecte:estConnecte,
  estSorciere:function(p){return estSorciere(p===undefined?myPseudo():p);},
  estSpectre:function(p){return estSpectre(p===undefined?myPseudo():p);},
  peutVoter:function(p){return peutVoter(p===undefined?myPseudo():p);},
  /* écriture */
  patch:patch, patchSecret:patchSecret, creer:creerFiche,
  ecrireSecret:function(o, libelle){
    var id=newId();
    return Promise.resolve(window.TDLBase.ecrireEntree(CFG.NODE_SECRETS, id, o, libelle||"secret déposé"))
      .then(function(ok){ if(!ok)return null; var c={}; for(var k in o)if(o.hasOwnProperty(k))c[k]=o[k];
        c.id=id; SECRETS.unshift(normaliserSecret(c)); return id; });
  },
  supprimer:function(m){
    window.TDLBase.supprimerEntree(CFG.NODE, m.id, "suppression de "+m.titre);
    D=D.filter(function(x){return x!==m;}); fixSel(); S.drawer=null; S.inline=null; S.mob="liste";
  },
  /* verrou : pose un drapeau false→true AVANT tout acte irréversible
     (tirage de dé, versement, ouverture de dossier). Un seul client passe. */
  verrou:function(node, id, champ){
    var path=node+"/"+encodeURIComponent(id)+"/"+champ;
    try{
      return Promise.resolve(window.EcoCore.firebaseTransaction(path,function(cur){
        if(cur===true)throw new Error("DEJA"); return true;
      }));
    }catch(e){ return Promise.reject(e); }
  },
  estDeja:function(e){ return !!(e&&e.message==="DEJA"); },
  NODE:CFG.NODE, NODE_SECRETS:CFG.NODE_SECRETS, SCHEMA:SCHEMA,
  /* rendu et helpers */
  rendre:renderAll, rendreStage:renderStage, toast:toast,
  tiroir:function(k){S.drawer=(S.drawer===k)?null:k;S.inline=null;renderStage();},
  inline:function(k){S.inline=(S.inline===k)?null:k;S.drawer=null;renderStage();},
  fermer:function(){S.drawer=null;S.inline=null;S.creation=false;renderStage();},
  selectionner:function(id){S.sel=id;S.mob="detail";renderStage();},
  esc:esc, escAttr:escAttr, av:av, vt:vt, ilya:ilya, dateFr:dateFr,
  nbJours:nbJours, joursRestants:joursRestants, cle:cp, nouvelId:newId,
  rafraichir:function(){ return window.TDLBase.rafraichirMembres().then(function(m){ MEMBRES=m||{}; loadData(); }); }
};
REG.api=API;

/* ===================== CHARGEMENT ===================== */
function loadData(){
  loading(TEXTES.CHARGE);
  var pf, pm;
  try{ pf=window.EcoCore.firebaseGet(CFG.NODE); pm=window.TDLBase.membres(); }
  catch(e){ loading(TEXTES.SOCLE); return; }
  Promise.all([Promise.resolve(pf), Promise.resolve(pm)]).then(function(r){
    var raw=r[0]||{};
    MEMBRES=r[1]||{};
    D=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliser(o);});
    D.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
    fixZone(); fixSel(); renderAll();
    if(VEILLE&&VEILLE.caler)VEILLE.caler(raw);
    return chargerSecrets();
  }).catch(function(){loading(TEXTES.ECHEC);});
}
/* Le registre n'est lu QUE si le lecteur y a droit : une lecture inutile est
   une fuite potentielle, et le nœud n'a rien à faire dans un onglet de Spectre. */
function chargerSecrets(){
  if(!(estSorciere(myPseudo())||isStaff())){ SECRETS=[]; return Promise.resolve(); }
  return Promise.resolve(window.EcoCore.firebaseGet(CFG.NODE_SECRETS)).then(function(raw){
    raw=raw||{};
    SECRETS=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliserSecret(o);});
    SECRETS.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
    if(VEILLE_S&&VEILLE_S.caler)VEILLE_S.caler(raw);
    renderAll();
  }).catch(function(){ SECRETS=[]; });
}

function pret(){return !!(window.EcoCore&&window.EcoCore.firebaseGet&&window.TDLBase&&window.TDLBase.suivre);}
function quandPret(cb){
  if(pret()){cb();return;}
  loading(TEXTES.BASE);
  var n=0,iv=setInterval(function(){
    if(pret()){clearInterval(iv);cb();}
    else if(++n>80){clearInterval(iv);loading(TEXTES.SOCLE);}
  },125);
}

/* ---- veille sentinelle : deux nœuds, deux veilles ---- */
var VEILLE=null, VEILLE_S=null;
function startVeille(){
  VEILLE=window.TDLBase.suivre({
    node:CFG.NODE, rev:true, ms:VEILLE_MS, occupe:occupe,
    onEntrees:function(majs, supprimes){ absorber(D, normaliser, majs, supprimes); }
  });
  if(estSorciere(myPseudo())||isStaff()){
    VEILLE_S=window.TDLBase.suivre({
      node:CFG.NODE_SECRETS, rev:true, ms:VEILLE_MS, occupe:occupe,
      onEntrees:function(majs, supprimes){ absorber(SECRETS, normaliserSecret, majs, supprimes); }
    });
  }
}
function absorber(liste, norm, majs, supprimes){
  var change=false, j;
  majs.forEach(function(x){
    var o=x.brut||{}; o.id=x.id;
    var n=norm(o), i=-1;
    for(j=0;j<liste.length;j++){ if(liste[j].id===x.id){i=j;break;} }
    if(i<0)liste.push(n); else liste[i]=n;
    change=true; });
  if(supprimes&&supprimes.length){
    for(j=liste.length-1;j>=0;j--){ if(supprimes.indexOf(liste[j].id)>=0){liste.splice(j,1);change=true;} }
  }
  if(!change)return;
  liste.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
  fixZone(); fixSel(); renderAll();
}

/* ===================== INIT / MONTAGE ===================== */
function initApp(){
  var edit=$("#tdlb-edit");
  if(edit){edit.href=CFG.EDIT_URL||"#";if(isStaff())edit.classList.add("on");}
  var neuf=$("#tdlb-new");
  if(neuf){
    neuf.style.display="none";
    neuf.onclick=function(){S.creation=true;S.drawer=null;S.inline=null;renderStage();};
  }
  quandPret(function(){
    window.TDLBase.surEchec(majBandeau);
    window.TDLBase.avatars(function(){ if(!occupe())renderAll(); });
    startVeille();
    loadData();
    setTimeout(function(){
      var t=typeDe(S.zone), c=t&&t.creer&&t.creer();
      if(neuf&&c&&c.peut&&c.peut(API)){ neuf.textContent=c.label||"Ouvrir une fiche"; neuf.style.display=""; }
    },1200);
  });
}

var mounted=false;
function boot(){
  if(mounted)return true;
  var bg=document.querySelector(".tdlm-bg");
  if(!bg||!document.querySelector("#tdlb-stage"))return false;
  mounted=true;
  document.body.appendChild(bg);
  var st=document.createElement("style");
  st.textContent="html#min-width,body,#wrap,#sj-main{min-width:0!important} html,body{overflow-x:hidden!important}";
  document.head.appendChild(st);
  if(!document.querySelector("meta[name=viewport]")){
    var mv=document.createElement("meta");mv.name="viewport";mv.content="width=device-width, initial-scale=1";document.head.appendChild(mv);
  }
  initApp();
  return true;
}
var tries=0, iv=setInterval(function(){if(boot()||++tries>60)clearInterval(iv);},250);
window.addEventListener("load",boot);
if(document.readyState!=="loading")boot();

})();
