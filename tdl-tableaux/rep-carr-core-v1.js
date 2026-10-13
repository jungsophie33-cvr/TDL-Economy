/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU CARREFOUR · SOCLE
   (tdlc-core.js) — à charger AVANT tdlc-chasse.js et tdlc-mission.js.
   Ordre global : eco-core → tdl-base → tdlc-core → les types.

   Moulé sur rep-flot-core, dont il reprend la fabrique de types et de vues,
   et le CSS « tdlm- ». Préfixe propre : « tdlc- ».

   TROIS NŒUDS, UNE SEULE SENTINELLE.
     carrefour/{id}      — ce que la LISTE affiche : type, titre, zone,
                           statut, auteur, prime, compteurs. Quelques centaines
                           d'octets par entrée. Seul nœud lu au chargement.
     carrefour_txt/{id}  — contexte et parties PUBLIQUES des intérêts. Lu à la
                           sélection d'une entrée, puis gardé en mémoire.
     carrefour_prv/{id}  — informations privées, accroches fermées, rôle secret.
                           Lu à la sélection, et destiné à recevoir une règle de
                           lecture par chemin (le titulaire et le staff).
     carrefour_rev/{id}  — sentinelle COMMUNE aux trois : une écriture dans le
                           texte ou dans le privé bumpe la même révision, et la
                           veille invalide les deux caches de l'entrée.

     RAISON : une mission porte un contexte plus trois champs rédigés par
     intérêt. À six intérêts on dépasse 4 ko ; trente entrées et c'est 120 ko
     téléchargés pour afficher une colonne de titres. Et tant que l'information
     privée vit dans le nœud commun, elle n'est pas secrète : elle part dans la
     réponse et s'ouvre dans l'onglet réseau.

   UNE SEULE LISTE. Chasses et missions se mélangent, triées par date ; le type
   s'affiche sous le titre. Statuts communs aux deux.

   Chaque type s'enregistre auprès du socle :
     TDLCarr.type({ k, label, ic, normaliser(o), sub(m), tags(m), panel(m),
                    act(k,m), doo(k,m), brancher(stage), auto(list) });
   ================================================================== */
(function(){
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  NODE:        "carrefour",
  NODE_TXT:    "carrefour_txt",
  NODE_PRV:    "carrefour_prv",
  NODE_REV:    "carrefour_rev",
  NODE_MEMBRES:"membres",
  /* [MAJ] sujet porteur du tableau */
  EDIT_URL:    "https://thedrownedlands.forumactif.com/post?p=508&mode=editpost",
  /* membres/{pseudo}.group porte le libellé complet du groupe FA
     (« Les Goulipiats », « Les Ashlanders »…), d'où la comparaison par
     inclusion : elle survit à l'article et au singulier. */
  CHAMP_COMM:  "group",
  COMM_BAYOU:  "ashlander",
  BANDE_BRAC:  "braconneurs"
};
var SCHEMA    = 2;
var VEILLE_MS = 15000;
var DELAI_RETRAIT = 30 * 86400000;   /* 30 j sans démarrer → rappel au staff */

/* statuts COMMUNS : c'est ce qui permet la liste mélangée */
var STATUTS = {
  ouverte: {label:"Ouverte",  c:"var(--gr3-color)"},
  en_cours:{label:"En cours", c:"var(--gr1-color)"},
  close:   {label:"Close",    c:"var(--gr2-color)"},
  retiree: {label:"Retirée",  c:"var(--gr6-color)"}
};

/* ===================== UTILS ===================== */
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escAttr(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function vt(v){return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]);}
function newId(p){return (p||"c")+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function money(n){return (+n||0)+" $";}
function nbJours(iso){var t=new Date(iso).getTime();if(isNaN(t))return null;return Math.floor((Date.now()-t)/86400000);}
function ilya(iso){var d=nbJours(iso);if(d==null)return"\u2014";return d<=0?"aujourd'hui":("il y a "+d+" j");}
function $(s,ctx){return (ctx||document).querySelector(s);}
function cp(p){return window.TDLBase.clePseudo(p);}

/* Un delta négatif part en debiterDollars, qui LÈVE si le compte ne couvre
   pas, au lieu de plafonner à zéro et de créer de la monnaie. */
function crediterDollars(pseudo, delta){
  delta=Math.round(+delta||0);
  if(!delta)return Promise.resolve(0);
  return (delta>0) ? window.EcoCore.crediterDollars(pseudo, delta)
                   : window.EcoCore.debiterDollars(pseudo, -delta);
}

/* Verrou de mouvement d'argent : la transaction fait passer un drapeau
   false → true, un seul client gagne. Chemin ABSOLU, pour pouvoir viser un
   drapeau dans une entrée. À poser AVANT tout mouvement irréversible. */
function verrou(chemin){
  try{
    return Promise.resolve(window.EcoCore.firebaseTransaction(chemin,function(cur){
      if(cur===true)throw new Error("DEJA");
      return true;
    }));
  }catch(e){ return Promise.reject(e); }
}
function estDeja(e){ return !!(e&&e.message==="DEJA"); }

/* identité réelle (forum) */
function isStaff(){try{return typeof _userdata!=="undefined"&&(_userdata.user_level===1||_userdata.user_level===2);}catch(e){return false;}}
function estConnecte(){try{return typeof _userdata!=="undefined"&&parseInt(_userdata.user_id,10)>0;}catch(e){return false;}}
function myPseudo(){try{if(typeof _userdata!=="undefined"&&_userdata.username)return String(_userdata.username).trim();}catch(e){}return null;}

/* ===================== DONNÉES ===================== */
var TYPES=[], VUES=[], L=[], MEMBRES={};
var TXTC={}, PRVC={};            /* caches par id, vidés par la sentinelle */
var TAB=null, TXT=null, PRV=null;
var demarre=false, VEILLE=null;

function typeDe(k){for(var i=0;i<TYPES.length;i++)if(TYPES[i].k===k)return TYPES[i];return null;}
function vueDe(k){for(var i=0;i<VUES.length;i++)if(VUES[i].k===k)return VUES[i];return null;}
function vueActive(){var v=vueDe(S.statut);return (v&&(!v.visible||v.visible()))?v:null;}
function parId(id){for(var i=0;i<L.length;i++)if(L[i].id===id)return L[i];return null;}

function hll(p){var m=p&&MEMBRES[p];return (m&&m.hors_la_loi)||null;}
function bandeDe(p){var h=hll(p);return (h&&h.bande)||"";}
function estBraconneur(p){return bandeDe(p)===CFG.BANDE_BRAC;}
function estAshlander(p){
  var m=p&&MEMBRES[p]; if(!m)return false;
  return String(m[CFG.CHAMP_COMM]||"").toLowerCase()===CFG.COMM_BAYOU;
}
/* la condition structurelle du tableau : quelqu'un qui a vu le terrain */
function estBayou(p){return estAshlander(p)||estBraconneur(p);}
/* la condition facultative : un hors-la-loi QUI N'EST PAS braconneur */
function estOmbre(p){var b=bandeDe(p);return !!b&&b!==CFG.BANDE_BRAC;}
function solde(p){var m=MEMBRES[p];return (m&&+m.dollars)||0;}

/* ===================== ÉTAT ===================== */
var S={statut:"tous", sel:null, mob:"liste", drawer:null, inline:null};
function occupe(){return !!(S.drawer||S.inline);}

/* ===================== ÉCRITURES =====================
   RÈGLE : ne jamais écrire dans les trois nœuds par un autre chemin. Une
   écriture qui ne bumpe pas carrefour_rev/{id} reste invisible aux autres
   onglets, et laisse leur cache de texte périmé. */
function patch(m, champs){ return TAB.ecrire(m.id, champs, "modification de "+(m.titre||m.id)); }
function patchTxt(m, champs){
  TXTC[m.id]=null;
  return TXT.ecrire(m.id, champs, "texte de "+(m.titre||m.id));
}
function patchPrv(m, champs){
  PRVC[m.id]=null;
  return PRV.ecrire(m.id, champs, "privé de "+(m.titre||m.id));
}
/* Création : la fiche légère d'abord, puis le texte et le privé. Si l'une des
   deux secondes écritures rate, la file de réessai du socle la rejoue ; la
   fiche existe déjà, donc rien n'est perdu de vue. */
function creerEntree(id, objet, texte, prive){
  objet.schema=SCHEMA;
  return TAB.ecrireEntree(id, objet, "ouverture de "+(objet.titre||id)).then(function(ok){
    if(!ok)return false;
    var suite=texte?TXT.ecrireEntree(id, texte, "texte de "+(objet.titre||id)):Promise.resolve(true);
    return Promise.resolve(suite).then(function(){
      if(!prive)return true;
      return PRV.ecrireEntree(id, prive, "privé de "+(objet.titre||id));
    }).then(function(){ TXTC[id]=texte||{}; PRVC[id]=prive||{}; return true; });
  });
}
function supprimerEntree(m){
  TAB.supprimerEntree(m.id, "suppression de "+(m.titre||m.id));
  TXT.supprimerEntree(m.id, "suppression du texte de "+(m.titre||m.id));
  PRV.supprimerEntree(m.id, "suppression du privé de "+(m.titre||m.id));
  L=L.filter(function(x){return x!==m;});
  delete TXTC[m.id]; delete PRVC[m.id];
  fixSel(); S.drawer=null; S.inline=null; S.mob="liste";
}

/* ---- lectures paresseuses ----
   txt(m) et prv(m) rendent null tant que la feuille n'est pas là, et relancent
   un rendu quand elle arrive. Le panneau affiche « Chargement… » entre-temps.
   Une lecture refusée par les règles rend {} : le panneau se contente alors de
   ce qu'il peut montrer. */
function feuille(cache, node, m, apres){
  if(Object.prototype.hasOwnProperty.call(cache,m.id)&&cache[m.id]!==null)return cache[m.id];
  if(cache[m.id]===undefined||cache[m.id]===null){
    if(cache["#"+m.id])return null;          /* lecture déjà en vol */
    cache["#"+m.id]=1;
    Promise.resolve(window.EcoCore.firebaseGet(node+"/"+encodeURIComponent(m.id)))
      .then(function(v){ cache[m.id]=v||{}; })
      .catch(function(){ cache[m.id]={}; })
      .then(function(){ delete cache["#"+m.id]; if(apres)apres(); });
  }
  return null;
}
function txt(m){ return feuille(TXTC, CFG.NODE_TXT, m, renderStage); }
function prv(m){ return feuille(PRVC, CFG.NODE_PRV, m, renderStage); }

/* ===================== NORMALISATION ===================== */
function normaliser(o){
  o.type=o.type||"mission";
  o.titre=o.titre||"\u2014"; o.zone=o.zone||"";
  o.auteur=o.auteur||null;
  o.statut=STATUTS[o.statut]?o.statut:"ouverte";
  o.sujet=o.sujet||"";
  o.cree=o.cree||new Date().toISOString();
  o.schema=(o.schema===SCHEMA)?SCHEMA:1;
  var t=typeDe(o.type);
  return (t&&t.normaliser)?t.normaliser(o):o;
}
function absorber(id, brut){
  var o=brut||{}; o.id=id; o=normaliser(o);
  var t=typeDe(o.type); o._t=t||null;
  var i;
  for(i=0;i<L.length;i++){ if(L[i].id===id){ L[i]=o; return; } }
  L.push(o);
}
function exigeV2(m){
  if(m&&m.schema===SCHEMA)return true;
  toast("Entrée au format ancien \u2014 prévenez le staff.");
  return false;
}

/* ===================== FILTRAGE ===================== */
function filtre(){
  return L.filter(function(m){
    if(!m._t)return false;
    if(S.statut==="tous")return true;
    if(STATUTS[S.statut])return m.statut===S.statut;
    return false;
  });
}
function fixSel(){
  var d=filtre(), ok=false;
  d.forEach(function(m){if(m.id===S.sel)ok=true;});
  if(!ok)S.sel=d[0]?d[0].id:null;
}

/* ===================== RENDU ===================== */
function stamp(m){var v=STATUTS[m.statut]||{label:"\u2014",c:"var(--cntr)"};return '<span class="tdlm-stamp" style="--sc:'+v.c+'">'+v.label+'</span>';}
function av(n){
  var c=window.TDLBase.avatar(n);
  if(c&&c.image)return '<span class="tdlm-avatar"><img src="'+escAttr(c.image)+'" alt=""></span>';
  return '<span class="tdlm-avatar">'+esc(String(n||"?").replace(/[@.\s]/g,"").slice(0,2).toUpperCase())+'</span>';
}
function toast(msg){
  var t=document.createElement("div");
  t.className="tdlm-toast"; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },4200);
}

function renderStatutFilters(){
  var el=$("#tdlc-stf"); if(!el)return;
  var chips=[{id:"tous",label:"Tout",c:"var(--cntr)"}];
  Object.keys(STATUTS).forEach(function(id){chips.push({id:id,label:STATUTS[id].label,c:STATUTS[id].c});});
  var html=chips.map(function(s){
    var n=(s.id==="tous")?L.length:L.filter(function(m){return m.statut===s.id;}).length;
    return '<button class="tdlm-stf" data-st="'+s.id+'" aria-pressed="'+(s.id===S.statut)+'" style="--sc:'+s.c+'">'
      +'<span class="tdlm-fdot"></span>'+s.label+' <b>'+n+'</b></button>';
  }).join("");
  VUES.forEach(function(v){
    if(v.visible&&!v.visible())return;
    var n=v.compte?v.compte():null;
    html+='<button class="tdlm-stf tdlm-req-chip" data-st="'+escAttr(v.k)+'" aria-pressed="'+(S.statut===v.k)+'">'
      +esc(v.label)+(n==null?'':' <b>'+n+'</b>')+'</button>';
  });
  el.innerHTML=html;
  el.querySelectorAll("[data-st]").forEach(function(b){
    b.onclick=function(){
      S.statut=b.getAttribute("data-st"); S.drawer=null; S.inline=null;
      fixSel(); renderStage(); renderStatutFilters();
    };
  });
}

function ligne(m){
  var t=m._t, o=(t.sub?t.sub(m):{})||{};
  var tags=((t.tags?t.tags(m):[])||[]).filter(Boolean);
  var chips=tags.map(function(x){return '<span class="tdlm-req">'+esc(x)+'</span>';}).join("");
  var st=STATUTS[m.statut]||{c:"var(--cntr)"};
  var sub=esc(t.label)+(o.sub?' \u27e1 '+esc(o.sub):'');
  return '<div class="tdlm-drow" data-sel="'+escAttr(m.id)+'" aria-current="'+(m.id===S.sel)+'">'
    +'<span class="tdlm-ddot" style="--sc:'+st.c+'"></span>'
    +'<div style="min-width:0">'
      +'<div class="tdlm-drow-head"><span class="tdlm-type">'+esc(m.titre)+'</span></div>'
      +'<div class="tdlm-drow-sub">'+sub+'</div>'
      +(chips?'<div class="tdlm-drow-tags">'+chips+'</div>':'')
    +'</div>'
    +'<div class="tdlm-drow-right">'+(o.qui?av(o.qui):'')
    +'<div class="tdlm-posted">'+esc(o.quand||ilya(m.cree))+'</div></div>'
  +'</div>';
}

function viewDossier(){
  var d=filtre();
  var rows=d.length?d.map(ligne).join("")
                   :'<div class="tdlm-empty">Rien d\u2019affiché au tableau.</div>';
  var sel=parId(S.sel)||d[0];
  return '<div class="tdlm-dossier'+(S.mob==="detail"?" detail":"")+'">'
    +'<div class="tdlm-dlist"><div class="tdlm-dlist-rows">'+rows+'</div></div>'
    +'<div class="tdlm-dpanel">'+(sel?sel._t.panel(sel):'<div class="tdlm-empty">\u2014</div>')+'</div></div>';
}

var _lastSel=null;
function renderStage(){
  var el=$("#tdlc-stage"); if(!el)return;
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
function loading(msg){var el=$("#tdlc-stage");if(el)el.innerHTML='<div class="tdlm-empty">'+esc(msg||"Chargement\u2026")+'</div>';}

function brancher(){
  var stage=$("#tdlc-stage"); if(!stage)return;
  stage.querySelectorAll("[data-sel]").forEach(function(el){
    el.onclick=function(){
      S.sel=el.getAttribute("data-sel"); S.drawer=null; S.inline=null; S.mob="detail";
      renderStage();
    };
  });
  var back=stage.querySelector("[data-back]");
  if(back)back.onclick=function(){S.mob="liste";renderStage();};
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
/* Une seule lecture ciblée : carrefour (fiches légères) + la branche membres
   partagée par le socle. Les textes et le privé viennent à la sélection. */
function loadData(){
  loading("Chargement du tableau\u2026");
  var pc, pb;
  try{ pc=window.EcoCore.firebaseGet(CFG.NODE); pb=window.TDLBase.membres(); }
  catch(e){ loading("EcoCore indisponible."); return; }
  Promise.all([Promise.resolve(pc), Promise.resolve(pb)]).then(function(r){
    var raw=r[0]||{};
    MEMBRES=r[1]||{};
    L=[];
    Object.keys(raw).forEach(function(id){ absorber(id, raw[id]); });
    L.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
    TYPES.forEach(function(t){ if(t.auto)t.auto(L); });
    fixSel(); renderAll();
    if(VEILLE&&VEILLE.caler)VEILLE.caler(raw);
    if(!L.length)loading("Rien d\u2019affiché au tableau pour l\u2019instant.");
  }).catch(function(){loading("Impossible de charger le tableau.");});
}

function pret(){return !!(window.EcoCore&&window.EcoCore.firebaseGet&&window.TDLBase&&window.TDLBase.suivre);}
function whenEco(cb){
  if(pret()){cb();return;}
  loading("Connexion à la base\u2026");
  var n=0, iv2=setInterval(function(){
    if(pret()){clearInterval(iv2);cb();}
    else if(++n>80){clearInterval(iv2);loading("EcoCore ou tdl-base introuvable \u2014 vérifiez l\u2019ordre de chargement.");}
  },125);
}

function equiper(){
  if(TAB)return;
  TAB=window.TDLBase.table({node:CFG.NODE,     revPath:CFG.NODE_REV});
  TXT=window.TDLBase.table({node:CFG.NODE_TXT, revPath:CFG.NODE_REV});
  PRV=window.TDLBase.table({node:CFG.NODE_PRV, revPath:CFG.NODE_REV});
  VEILLE=TAB.suivre({
    rev:true, ms:VEILLE_MS, occupe:occupe,
    onEntrees:function(majs, supprimes){
      var change=false;
      majs.forEach(function(x){
        /* la révision a bougé : le texte et le privé de cette entrée peuvent
           avoir changé aussi, puisqu'ils partagent la sentinelle */
        delete TXTC[x.id]; delete PRVC[x.id];
        absorber(x.id, x.brut); change=true;
      });
      if(supprimes&&supprimes.length){
        L=L.filter(function(m){return supprimes.indexOf(m.id)<0;});
        supprimes.forEach(function(id){delete TXTC[id];delete PRVC[id];});
        change=true;
      }
      if(!change)return;
      L.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
      TYPES.forEach(function(t){ if(t.auto)t.auto(L); });
      fixSel(); renderAll();
    }
  });
}

/* ===================== INIT / MONTAGE ===================== */
function initApp(){
  var edit=$("#tdlc-edit");
  if(edit){edit.href=CFG.EDIT_URL||"#";if(isStaff())edit.classList.add("on");}
  whenEco(function(){
    demarre=true;
    equiper();
    window.TDLBase.avatars(function(){ if(!occupe())renderAll(); });
    loadData();
  });
}

var mounted=false;
function boot(){
  if(mounted)return true;
  var bg=document.querySelector(".tdlc-bg");
  if(!bg)return false;
  mounted=true;
  document.body.appendChild(bg);
  var st=document.createElement("style");
  st.textContent="html#min-width,body,#wrap,#sj-main{min-width:0!important} html,body{overflow-x:hidden!important}";
  document.head.appendChild(st);
  if(!document.querySelector("meta[name=viewport]")){
    var mv=document.createElement("meta");
    mv.name="viewport"; mv.content="width=device-width, initial-scale=1";
    document.head.appendChild(mv);
  }
  initApp();
  return true;
}

/* ===================== EXPORT ===================== */
window.TDLCarr = {
  CFG:CFG, S:S, STATUTS:STATUTS, SCHEMA:SCHEMA, DELAI_RETRAIT:DELAI_RETRAIT,
  type: function(def){ TYPES.push(def); if(demarre){ loadData(); } },
  vue:  function(def){ VUES.push(def); if(mounted)renderAll(); },
  esc:esc, escAttr:escAttr, vt:vt, money:money, ilya:ilya, nbJours:nbJours,
  newId:newId, cp:cp, av:av, stamp:stamp, toast:toast, $:$,
  patch:patch, patchTxt:patchTxt, patchPrv:patchPrv,
  creerEntree:creerEntree, supprimer:supprimerEntree,
  txt:txt, prv:prv, parId:parId, exigeV2:exigeV2, liste:function(){return L;},
  renderAll:renderAll, renderStage:renderStage,
  crediter:crediterDollars,
  debiter:function(p,n){return window.EcoCore.debiterDollars(p,n);},
  verrou:verrou, estDeja:estDeja,
  cheminEntree:function(m){return CFG.NODE+"/"+encodeURIComponent(m.id);},
  cheminPrive:function(m){return CFG.NODE_PRV+"/"+encodeURIComponent(m.id);},
  solde:solde, membres:function(){return MEMBRES;},
  isStaff:isStaff, estConnecte:estConnecte, myPseudo:myPseudo,
  bandeDe:bandeDe, estBayou:estBayou, estOmbre:estOmbre,
  estBraconneur:estBraconneur, estAshlander:estAshlander
};

var tries=0, iv=setInterval(function(){if(boot()||++tries>60)clearInterval(iv);},250);
window.addEventListener("load",boot);
if(document.readyState!=="loading")boot();

})();
