/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU HANGAR (LA FLOTTILLE) · SOCLE
   (rep-flot-core.js) — à charger AVANT rep-flot-ops.js et rep-flot-postes.js.
   Ordre global : eco-core → tdl-base → rep-flot-core → les types.

   [MAJ v2] SENTINELLE À DEUX NIVEAUX.
     Les entrées vivent en flottille/{sous}/{id} : la convention habituelle
     {nœud}_rev/{id} y produirait soit une carte de révisions imbriquée que la
     veille ne sait pas comparer, soit une branche flottille/{sous}_rev à
     l'intérieur même du nœud surveillé. Chaque type reçoit donc sa propre
     TDLBase.table, avec un chemin de sentinelle EXPLICITE :
         flottille/marees      →  flottille_rev/marees
     Les révisions vivent dans un arbre parallèle, hors des données, et chaque
     carte reste plate. Un veilleur par type, quelques centaines d'octets par
     tick au lieu des 126 ko de la racine.

   [MAJ v2] SCHÉMA 2 — les listes des entrées passent aux nœuds à clés, chaque
     type déclarant son propre plan (voir t.plan). Pour les marées, c'est
     postes : deux joueurs prenant DEUX postes différents de la même marée
     s'écrasaient mutuellement, et le second effaçait l'inscription du premier
     ET son dé — qui n'est tiré qu'une fois et ne se retrouve pas.

   [MAJ v2] L'ARGENT passe par eco-core. F.crediter accepte toujours un delta
     signé, mais un delta négatif part en debiterDollars, qui LÈVE si le compte
     ne couvre pas, au lieu de plafonner à zéro et de créer de la monnaie.
     F.verrou() expose aux types le verrou transactionnel des versements.

   Moulé sur rep-mis-marin / rep-det-main, dont il réutilise intégralement le
   CSS « tdlm- ». Préfixe propre : « tdlh- » (tdlf- est pris par les Faiseuses).

   UNE SEULE LISTE. Opérations, disparitions et marées se mélangent dans la
   colonne de gauche, triées par date ; le type s'affiche sous le titre.

   Chaque type s'enregistre auprès du socle :
     TDLFlot.type({ k, sous, label, ic, plan, normaliser(o), sub(m), tags(m),
                    panel(m), act(k,m), doo(k,m), brancher(stage), auto(list) });
   sous = enfant de  flottille/<sous>.  plan = descripteur de migration v1→v2.

   Données : flottille/<sous>/{id} et flottille/carnet/{pseudo}.
   Le CARNET reste hors sentinelle : index de fiches écrit par transaction, sans
   liste ni concurrence problématique. Il est relu à l'ouverture de sa vue.
   ================================================================== */
(function(){
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  RACINE:       "flottille",
  RACINE_REV:   "flottille_rev",
  SOUS_CARNET:  "carnet",
  NODE_MEMBRES: "membres",
  EDIT_URL:     "https://thedrownedlands.forumactif.com/post?p=470&mode=editpost" /* [MAJ] sujet porteur */
};
var SCHEMA      = 2;               /* version du schéma des entrées */
var VEILLE_MS   = 15000;
var DELAI_REFUS = 14 * 86400000;   /* 14 j sans preneur → refus auto + recrédit */
var CHEF_BONUS  = 50;              /* aligné sur rep-mis-marin et rep-det-main */

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
function cp(p){return window.TDLBase.clePseudo(p);}

/* [MAJ v2] L'ancien crediterDollars faisait Math.max(0, cur+delta) et servait
   aussi à PRÉLEVER (la revente d'information débitait par delta négatif) : sur
   un solde insuffisant, l'acheteur tombait à zéro, le vendeur touchait le prix
   entier, et la différence était créée. Un delta négatif part désormais en
   debiterDollars, qui lève FONDS. */
function crediterDollars(pseudo, delta){
  delta=Math.round(+delta||0);
  if(!delta)return Promise.resolve(0);
  return (delta>0) ? window.EcoCore.crediterDollars(pseudo, delta)
                   : window.EcoCore.debiterDollars(pseudo, -delta);
}

/* Verrou de mouvement d'argent : la transaction fait passer un drapeau
   false → true, un seul client gagne. Le chemin est absolu pour pouvoir viser
   un drapeau DANS une entrée, par exemple un poste précis. */
function verrou(chemin){
  try{
    return Promise.resolve(window.EcoCore.firebaseTransaction(chemin,function(cur){
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
var TYPES = [];     /* descripteurs de type d'entrée */
var VUES  = [];     /* vues annexes : une puce de filtre + une scène pleine largeur */
var L = [];         /* LA liste, tous types confondus, triée par date */
var CARNET = {};    /* flottille/carnet/{pseudo} */
var MEMBRES = {};
var demarre = false;

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

/* [MAJ v2] avatars : index partagé du socle, chargé une fois pour tous les tableaux */
function av(n){
  var c=window.TDLBase.avatar(n);
  if(c&&c.image)return '<span class="tdlm-avatar"><img src="'+escAttr(c.image)+'" alt=""></span>';
  return '<span class="tdlm-avatar">'+esc(String(n||"?").replace(/[@.\s]/g,"").slice(0,2).toUpperCase())+'</span>';
}

function serialize(m){var o={};for(var k in m){if(m.hasOwnProperty(k)&&k!=="id"&&k!=="_t")o[k]=m[k];}return o;}

/* ---- écritures : chaque type a sa table liée (nœud + chemin de sentinelle) ----
   patch(m,{statut:…})                → PATCH flottille/<sous>/{id}/statut
   patch(m,{"postes/p0rfl":{…}})       → PATCH …/{id}/postes/p0rfl
   et, dans le même appel, flottille_rev/<sous>/{id}. */
function patch(m, champs){
  var t=m&&m._t; if(!t||!t._tab)return Promise.resolve(false);
  return t._tab.ecrire(m.id, champs, "modification de "+(m.titre||m.id));
}
/* Création d'une entrée par son type : la table liée fournit le chemin ET la
   sentinelle, de sorte qu'une marée ouverte apparaisse aux autres onglets sans
   rechargement. k = clé du type ("marees", "operations"…). */
function creerEntree(k, id, objet, libelle){
  var t=typeDe(k);
  if(!t||!t._tab)return Promise.resolve(false);
  objet.schema=SCHEMA;
  return t._tab.ecrireEntree(id, objet, libelle||("création dans "+t.sous));
}
function supprimerEntree(m){
  var t=m&&m._t; if(!t||!t._tab)return;
  t._tab.supprimerEntree(m.id, "suppression de "+(m.titre||m.id));
  L=L.filter(function(x){return x!==m;});
  fixSel(); S.drawer=null; S.inline=null; S.mob="liste";
}
/* Une entrée restée en v1 n'accepte pas d'écriture dans ses listes à clés. */
function exigeV2(m){
  if(m&&m.schema===SCHEMA)return true;
  toast("Entrée au format ancien — lancez d\u2019abord la conversion (bouton staff).");
  return false;
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
/* [MAJ v2] hors sentinelle : relu à la demande. Il ne bouge qu'à la clôture
   d'une marée, et il est minuscule. */
function rechargerCarnet(){
  if(!window.EcoCore||!window.EcoCore.firebaseGet)return Promise.resolve(CARNET);
  return Promise.resolve(window.EcoCore.firebaseGet(CFG.RACINE+"/"+CFG.SOUS_CARNET))
    .then(function(c){ CARNET=c||{}; return CARNET; })
    .catch(function(){ return CARNET; });
}
/* remise à zéro d'une fiche du carnet — staff seulement, utile en phase de
   test et quand une notation a été portée à tort. */
function razCarnet(pseudo){
  if(!isStaff()||!pseudo)return;
  if(!window.confirm("Effacer la fiche de "+pseudo+" du carnet ?\nPostes comptés, notes et ratio disparaissent. Irréversible."))return;
  var up={}; up[CFG.RACINE+"/"+CFG.SOUS_CARNET+"/"+pseudo]=null;
  try{
    Promise.resolve(window.EcoCore.firebaseUpdate(up)).then(function(){
      delete CARNET[pseudo]; toast("Fiche effacée."); renderAll();
    }).catch(function(){toast("Effacement échoué.");});
  }catch(e){toast("Effacement échoué.");}
}

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

function nonMigrees(){return L.filter(function(m){return m.schema!==SCHEMA&&m._t&&m._t.plan;});}
function barreMigration(){
  if(!isStaff())return "";
  var n=nonMigrees().length; if(!n)return "";
  return '<div class="tdlm-migbar"><span>⚙ '+n+' entrée'+(n>1?'s':'')+' au format ancien. '
    +'La prise de poste et la notation y restent bloquées avant conversion.</span>'
    +'<button class="tdlm-abtn prim" data-migrer="1">Convertir maintenant</button></div>';
}

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
    b.onclick=function(){
      S.statut=b.getAttribute("data-st");S.drawer=null;S.inline=null;fixSel();
      if(S.statut==="carnet"){ rechargerCarnet().then(function(){renderStage();renderStatutFilters();}); return; }
      renderStage();renderStatutFilters();
    };
  });
}

var _lastSel=null;
function renderStage(){
  var el=$("#tdlh-stage"); if(!el)return;
  var pl=el.querySelector(".tdlm-dlist-rows"); var scl=pl?pl.scrollTop:0;
  var pb=el.querySelector(".tdlm-dp-body"); var scb=pb?pb.scrollTop:0;
  var same=(_lastSel===S.sel);
  var vue=vueActive();
  el.innerHTML=barreMigration()
    +(vue?vue.render():((S.statut==="carnet"&&peutVoirCarnet())?viewCarnet():viewDossier()));
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
      +'<span class="tdlh-meta">'+esc(meta)+'</span>'
      +'<span class="tdlm-stamp" style="--sc:'+x.etat.c+'">'+esc(x.etat.label)+'</span>'
      +(isStaff()?'<button class="tdlm-abtn warn" data-raz="'+escAttr(x.pseudo)+'">Réinitialiser</button>':'')
      +'</div>';
  }).join(""):'<div class="tdlm-empty">Personne n\u2019a encore tenu de poste.</div>';
  return '<div class="tdlm-dpanel">'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">Le carnet</span></div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-sec"><p class="tdlm-hsec">Ceux qui ont travaillé pour le hangar</p>'
    +'<div class="tdlm-prose">Sur les dix derniers signalements. Personne n\u2019est exclu pour un mauvais ratio. On le paie moins et on vérifie derrière lui, voilà tout.</div></div>'
    +'<div class="tdlm-cadre">'+corps+'</div></div></div>';
}

/* ===================== ÉVÉNEMENTS ===================== */
function toast(msg){
  var t=document.createElement("div");t.className="tdlm-toast";t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){t.style.transition="opacity .4s";t.style.opacity="0";setTimeout(function(){t.remove();},400);},3600);
}

/* ---- bandeau d'échec d'écriture (monté sur body : position:fixed) ---- */
function majBandeau(n){
  var el=document.getElementById("tdlm-echec");
  if(!n){ if(el)el.remove(); return; }
  if(!el){ el=document.createElement("div"); el.id="tdlm-echec"; el.className="tdlm-echec"; document.body.appendChild(el); }
  var s=(n>1)?"s":"";
  el.innerHTML='<span>⛔ '+n+' modification'+s+' non enregistrée'+s+'. Ne rechargez pas la page.</span>'
    +'<button class="tdlm-abtn prim" data-rejouer>Réessayer</button>';
  var b=el.querySelector("[data-rejouer]");
  b.onclick=function(){
    b.disabled=true; b.textContent="Envoi…";
    window.TDLBase.reessayer().then(function(){
      var r=window.TDLBase.enAttente();
      majBandeau(r);
      toast(r?"Il reste "+r+" modification(s) en échec.":"Modifications enregistrées.");
    });
  };
}

function brancher(){
  var stage=$("#tdlh-stage"); if(!stage)return;
  var mig=stage.querySelector("[data-migrer]");
  if(mig)mig.onclick=function(){lancerMigration();};
  stage.querySelectorAll("[data-sel]").forEach(function(el){
    el.onclick=function(){S.sel=el.getAttribute("data-sel");S.drawer=null;S.inline=null;S.mob="detail";renderStage();};
  });
  var back=stage.querySelector("[data-back]"); if(back)back.onclick=function(){S.mob="liste";renderStage();};
  if(S.statut==="carnet"){
    stage.querySelectorAll("[data-raz]").forEach(function(el){
      el.onclick=function(){razCarnet(el.getAttribute("data-raz"));};
    });
    return;
  }
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

/* ===================== CONVERSION v1 → v2 (staff) ===================== */
/* Chaque type porte son plan. On relit la branche BRUTE de chaque sous-nœud :
   la version en mémoire est normalisée, donc lossy. Idempotente. */
function lancerMigration(){
  if(!isStaff()){toast("Réservé au staff.");return;}
  var reste=nonMigrees().length;
  if(!reste){toast("Rien à convertir.");return;}
  if(!window.confirm("Convertir "+reste+" entrée(s) au nouveau format ?\n\n"
    +"Les listes internes (postes, participants\u2026) passent aux clés ; aucun montant\n"
    +"n\u2019est touché. Chaque entrée est traitée séparément et l\u2019opération peut être\n"
    +"relancée sans risque.\nAssurez-vous que personne n\u2019a le tableau ouvert sur l\u2019ancienne version."))return;
  var b=document.querySelector("[data-migrer]");
  if(b){b.disabled=true;b.textContent="Conversion…";}
  var faits=0, erreurs=0;
  var chaine=Promise.resolve();
  TYPES.forEach(function(t){
    if(!t.plan||!t._tab)return;
    chaine=chaine.then(function(){
      return Promise.resolve(window.EcoCore.firebaseGet(CFG.RACINE+"/"+t.sous)).then(function(raw){
        return t._tab.migrer({schema:SCHEMA, listes:t.plan, entrees:raw||{},
          surProgres:function(f,tot){var x=document.querySelector("[data-migrer]");if(x)x.textContent="Conversion "+esc(t.label)+" "+f+" / "+tot+"…";}});
      }).then(function(res){ faits+=res.faits; erreurs+=res.erreurs.length; });
    });
  });
  chaine.then(function(){
    toast(erreurs ? faits+" entrée(s) converties, "+erreurs+" en échec — relancez la conversion."
                  : faits+" entrée(s) converties.");
    loadData();
  }).catch(function(e){
    toast("Conversion impossible — rien n\u2019a été modifié.");
    try{console.error("[flottille] migration",e);}catch(_){}
    renderStage();
  });
}

/* ===================== CHARGEMENT ===================== */
function absorberRacine(racine){
  racine=racine||{};
  CARNET=racine[CFG.SOUS_CARNET]||{};
  var out=[];
  TYPES.forEach(function(t){
    var raw=racine[t.sous]||{};
    Object.keys(raw).forEach(function(id){
      var o=raw[id]||{}; o.id=id; o._t=t;
      o.schema=(o.schema===SCHEMA)?SCHEMA:1;
      out.push(t.normaliser?t.normaliser(o):o);
    });
  });
  out.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
  L=out;
}
/* fusion d'une seule entrée, venue de la veille sentinelle */
function absorberEntree(t, id, brut){
  var o=brut||{}; o.id=id; o._t=t;
  o.schema=(o.schema===SCHEMA)?SCHEMA:1;
  var n=t.normaliser?t.normaliser(o):o, i=-1;
  for(var j=0;j<L.length;j++){ if(L[j].id===id&&L[j]._t===t){i=j;break;} }
  if(i<0)L.push(n); else L[i]=n;
}
function echeances(){
  TYPES.forEach(function(t){
    if(!t.auto)return;
    t.auto(L.filter(function(m){return m._t===t;}));
  });
}

/* [MAJ v2] lecture de la seule racine flottille (~6 ko) et de la branche
   membres partagée, au lieu des 126 ko du record. */
function loadData(){
  loading("Ouverture du registre…");
  var pr, pm;
  try{ pr=window.EcoCore.firebaseGet(CFG.RACINE); pm=window.TDLBase.membres(); }
  catch(e){ loading("EcoCore indisponible."); return; }
  Promise.all([Promise.resolve(pr), Promise.resolve(pm)]).then(function(r){
    var racine=r[0]||{};
    MEMBRES=r[1]||{};
    absorberRacine(racine);
    echeances();fixSel();renderAll();
    TYPES.forEach(function(t){ if(t._veille&&t._veille.caler)t._veille.caler(racine[t.sous]||{}); });
    if(!L.length)loading("Rien dans le registre pour l\u2019instant.");
  }).catch(function(){loading("Impossible de charger le registre.");});
}

function pret(){return !!(window.EcoCore&&window.EcoCore.firebaseGet&&window.TDLBase&&window.TDLBase.table);}
function whenEco(cb){
  if(pret()){cb();return;}
  loading("Connexion à la base…");
  var n=0,iv2=setInterval(function(){
    if(pret()){clearInterval(iv2);cb();}
    else if(++n>80){clearInterval(iv2);loading("EcoCore ou tdl-base introuvable — vérifiez l\u2019ordre de chargement des scripts.");}
  },125);
}

function occupe(){return !!(S.drawer||S.inline);}

/* ---- une table liée et un veilleur PAR TYPE ----
   Un type enregistré après le montage (rep-flot-ops arrivé plus tard, ou le
   type « operations » qui n'a encore aucune entrée en base) reçoit les siens
   à son tour : la machinerie ne suppose pas que la branche existe. */
function equiper(t){
  if(t._tab||!pret())return;
  t._tab=window.TDLBase.table({
    node:    CFG.RACINE+"/"+t.sous,
    revPath: CFG.RACINE_REV+"/"+t.sous
  });
  t._veille=t._tab.suivre({
    rev:true, ms:VEILLE_MS, occupe:occupe,
    onEntrees:function(majs, supprimes){
      var change=false;
      majs.forEach(function(x){ absorberEntree(t, x.id, x.brut); change=true; });
      if(supprimes&&supprimes.length){
        L=L.filter(function(m){ return !(m._t===t&&supprimes.indexOf(m.id)>=0); });
        change=true;
      }
      if(!change)return;
      L.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
      echeances();fixSel();renderAll();
    }
  });
}

/* ===================== INIT / MONTAGE ===================== */
function initApp(){
  var edit=$("#tdlh-edit");
  if(edit){edit.href=CFG.EDIT_URL||"#";if(isStaff())edit.classList.add("on");}
  whenEco(function(){
    demarre=true;
    window.TDLBase.surEchec(majBandeau);
    window.TDLBase.avatars(function(){ if(!occupe())renderAll(); });
    TYPES.forEach(equiper);
    loadData();
  });
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
  CFG:CFG, S:S, STATUTS:STATUTS, SCHEMA:SCHEMA, DELAI_REFUS:DELAI_REFUS, CHEF_BONUS:CHEF_BONUS,
  /* un type arrivé après le montage reçoit sa table et son veilleur, puis relance la lecture */
  type: function(def){
    TYPES.push(def);
    if(demarre){ equiper(def); loadData(); }
  },
  /* vue annexe : { k, label, visible(), compte(), render(), brancher(stage) } */
  vue: function(def){ VUES.push(def); if(mounted)renderAll(); },
  esc:esc, escAttr:escAttr, vt:vt, money:money, ilya:ilya, nbJours:nbJours,
  newId:newId, cp:cp, av:av, stamp:stamp, toast:toast, $:$,
  patch:patch, creerEntree:creerEntree, supprimer:supprimerEntree, parId:parId, exigeV2:exigeV2,
  renderAll:renderAll, renderStage:renderStage, liste:function(){return L;},
  crediter:crediterDollars, debiter:function(p,n){return window.EcoCore.debiterDollars(p,n);},
  transferer:function(a,b,n){return window.EcoCore.transfererDollars(a,b,n);},
  verrou:verrou, estDeja:estDeja, cheminEntree:function(m){return CFG.RACINE+"/"+m._t.sous+"/"+encodeURIComponent(m.id);},
  solde:solde, carnet:function(){return CARNET;}, carnetEtat:carnetEtat, rechargerCarnet:rechargerCarnet,
  isStaff:isStaff, estConnecte:estConnecte, myPseudo:myPseudo,
  estFlottille:estFlottille, estCapitaine:estCapitaine, navireDe:navireDe,
  membres:function(){return MEMBRES;}
};

var tries=0, iv=setInterval(function(){if(boot()||++tries>60)clearInterval(iv);},250);
window.addEventListener("load",boot);
if(document.readyState!=="loading")boot();

})();
