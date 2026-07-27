/* ==================================================================
   THE DROWNED LANDS — PANNEAU DES ENQUÊTES  ·  JS (relié à Firebase)
   Dépend de window.EcoCore (chargé globalement par le forum) :
     safeReadBin()                → lit tout le record (cache 60s)
     writeField(path, data)       → écriture ciblée (PUT) d'un noeud
     firebaseUpdate({path:v|null})→ PATCH racine multi-chemins (null supprime)
     transactDollars(pseudo, +/-) → crédit/débit atomique des dollars
   Données : noeud racine  enquetes/{id}  (id interne stable ; la cote
   « AG-25-01 » est calculée à l'affichage, jamais stockée comme clé).
   ================================================================== */
(function(){
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  NODE: "enquetes",           /* [MAJ] noeud Firebase racine des affaires */
  DEV_POV: false,             /* true = affiche le sélecteur de rôle (aperçu) */
  FORUM_HOME: "https://thedrownedlands.forumactif.com/"
};
var BONUS_PARTICIPANT = 60;   /* à chaque participant validé (référent inclus) */
var BONUS_REFERENT    = 100;  /* bonus supplémentaire, référent seulement       */
var SEP = " ⟡ ";

var STATUTS = {
  en_cours:     {label:"En cours",     c:"var(--gr1-color)"},
  attente:      {label:"En attente",   c:"var(--gr3-color)"},
  non_elucidee: {label:"Non élucidée", c:"var(--gr6-color)"},
  classee:      {label:"Classée",      c:"var(--cntr)"}
};
var TYPES = [
  {id:"VC", label:"Vols & infractions civiles"},
  {id:"AG", label:"Agressions"},
  {id:"MH", label:"Meurtres / tentatives d'homicide"},
  {id:"FP", label:"Faits particuliers"},
  {id:"DR", label:"Disparitions"}
];
var TYPE_ICON = {VC:"fi-tr-people-robbery", AG:"fi-ts-user-injured", MH:"fi-tr-gun-shooting", FP:"fi-ts-ghost", DR:"fi-tr-shield-interrogation"};
var TYPE_CAT  = {VC:"vols", AG:"meurtres", MH:"meurtres", FP:"faits", DR:"disparitions"};
var CAT_LABEL = {vols:"Vols & infractions civiles", meurtres:"Meurtres & agressions", faits:"Signalements & faits particuliers", disparitions:"Disparitions"};
var MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

/* ===================== UTILS ===================== */
function typeLabel(id){for(var i=0;i<TYPES.length;i++){if(TYPES[i].id===id)return TYPES[i].label;}return id;}
function formatFR(iso){if(!iso)return"—";var p=iso.split("-").map(Number);if(!p[0])return"—";return p[2]+" "+MOIS[p[1]-1]+" "+p[0];}
function nowFR(){var d=new Date();return d.getDate()+" "+MOIS[d.getMonth()]+" "+d.getFullYear();}
function cleanTitre(s){var t=(s.titre&&!/^t\d+-/i.test(s.titre))?s.titre:(s.titre||(s.url||"").split("/").pop()||"");t=t.replace(/^t\d+-/i,"").replace(/[-_]/g," ").trim();return t?t.charAt(0).toUpperCase()+t.slice(1):"(sujet)";}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escAttr(s){return String(s==null?"":s).replace(/"/g,"&quot;");}
function versTableau(v){return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]);}
function newId(){return "e"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}

/* identité réelle (forum) */
function isStaff(){try{return typeof _userdata!=="undefined"&&(_userdata.user_level===1||_userdata.user_level===2);}catch(e){return false;}}
function myPseudo(){try{if(typeof _userdata!=="undefined"&&_userdata.username)return String(_userdata.username).trim();}catch(e){}return null;}

/* ===================== DONNÉES / FIREBASE ===================== */
var A = [];   /* affaires en mémoire (id interne stable) */

/* normalise une affaire lue depuis Firebase (arrays, booléens, liens {id,note}) */
function normaliser(o){
  o.type=o.type||"FP"; o.dateISO=o.dateISO||"";
  o.intrigue=!!o.intrigue; o.coldcase=!!o.coldcase; o.cloturee=!!o.cloturee; o.bonusVerse=!!o.bonusVerse; o.demandeCloture=!!o.demandeCloture;
  o.referent=o.referent||null; o.enqueteur=o.enqueteur||"—";
  o.titre=o.titre||"Affaire"; o.victime=o.victime||"—"; o.lieu=o.lieu||"—"; o.synthese=o.synthese||""; o.statutTxt=o.statutTxt||""; o.rp=o.rp||"";
  o.particularites=versTableau(o.particularites); o.elements=versTableau(o.elements); o.folklore=versTableau(o.folklore);
  o.roles=versTableau(o.roles); o.valides=versTableau(o.valides); o.demandesReferent=versTableau(o.demandesReferent);
  o.chrono=versTableau(o.chrono).map(function(e){return versTableau(e);});
  o.personnes=versTableau(o.personnes).map(function(e){return versTableau(e);});
  o.sujets=versTableau(o.sujets).map(function(s){s.membres=versTableau(s.membres);return s;});
  o.liens=versTableau(o.liens).map(function(l){return Array.isArray(l)?{id:l[0],note:l[1]||""}:l;});
  o.demandesLien=versTableau(o.demandesLien);
  if(!o.roles.length)o.roles=["—"];
  return o;
}
/* objet à écrire (sans la cote calculée) */
function serialize(a){var o={};for(var k in a){if(a.hasOwnProperty(k)&&k!=="cote")o[k]=a[k];}return o;}
/* persiste une affaire entière */
function persist(a){
  try{var p=window.EcoCore.writeField(CFG.NODE+"/"+a.id, serialize(a)); if(p&&p.catch)p.catch(function(){toast("Sauvegarde échouée — réessaie.");});}
  catch(e){toast("Sauvegarde échouée.");}
}

/* cote calculée : [TYPE]-[AA]-[ORDRE] par date d'ouverture (type+année) */
function renumeroter(){
  var g={};
  A.forEach(function(a){var y=(a.dateISO||"0000").slice(0,4);var k=a.type+"|"+y;(g[k]=g[k]||[]).push(a);});
  Object.keys(g).forEach(function(k){
    var list=g[k];
    list.sort(function(x,y){return (x.dateISO||"").localeCompare(y.dateISO||"");});
    list.forEach(function(a,i){a.cote=a.type+"-"+(a.dateISO||"2000").slice(2,4)+"-"+String(i+1).padStart(2,"0");});
  });
}
function parId(id){for(var i=0;i<A.length;i++){if(A[i].id===id)return A[i];}return null;}
function coteDe(id){var x=parId(id);return x?x.cote:"(retirée)";}
function cat(a){return TYPE_CAT[a.type];}

/* ===================== ÉTAT ===================== */
var POV = "visiteur"; /* utilisé uniquement en mode DEV_POV */
var S = {vue:"dossiers", type:"tous", statut:"tous", rpOnly:false, sel:null, onglet:"resume", mob:"liste", drawer:null, inline:null};
function $(s,ctx){return (ctx||document).querySelector(s);}
function av(n){return '<span class="tdle-avatar">'+esc(String(n||"?").replace(/[@.\s]/g,"").slice(0,2).toUpperCase())+'</span>';}

function statut(a){if(a.cloturee)return"classee";if(a.coldcase)return"non_elucidee";return a.referent?"en_cours":"attente";}
function role(a){
  if(CFG.DEV_POV){if(POV==="staff")return"staff";if(POV==="referent"&&!a.intrigue&&a.referent&&a.referent===myPseudo())return"referent";return"visiteur";}
  if(isStaff())return"staff";
  if(a.referent&&a.referent===myPseudo()&&!a.intrigue)return"referent";
  return"visiteur";
}
function participants(a){var s=[];a.sujets.forEach(function(x){x.membres.forEach(function(m){if(s.indexOf(m)<0)s.push(m);});});return s;}
function aDesDemandes(a){return a.demandesReferent.length>0||a.demandeCloture||a.demandesLien.length>0;}
function jouable(a){return !a.cloturee&&!a.intrigue&&a.roles.length&&a.roles[0]!=="—";}

/* ===================== FILTRAGE ===================== */
function baseType(){return A.filter(function(a){return S.type==="tous"||a.type===S.type;});}
function filtre(){return baseType().filter(function(a){
  if(S.statut==="demandes")return aDesDemandes(a);
  return (S.statut==="tous"||statut(a)===S.statut)&&(!S.rpOnly||jouable(a));
});}
function fixSel(){var d=filtre();var ok=false;d.forEach(function(a){if(a.id===S.sel)ok=true;});if(!ok)S.sel=d[0]?d[0].id:null;}

/* ===================== RENDER : bande de types ===================== */
function typeStripHTML(){
  var items=[{id:"tous",ac:"TOUT",ic:"fi-tr-folder-open"}];
  TYPES.forEach(function(t){items.push({id:t.id,ac:t.id,ic:TYPE_ICON[t.id]});});
  return '<div class="tdle-typestrip">'+items.map(function(it){
    return '<button class="tdle-tp" data-type="'+it.id+'" aria-selected="'+(it.id===S.type)+'"><i class="fi '+it.ic+'"></i><span>'+it.ac+'</span></button>';
  }).join("")+'</div>';
}
function renderStatutFilters(){
  var set=baseType();
  var chips=[{id:"tous",label:"Toutes",c:"var(--cntr)"}];
  Object.keys(STATUTS).forEach(function(id){chips.push({id:id,label:STATUTS[id].label,c:STATUTS[id].c});});
  var html=chips.map(function(s){
    var n=s.id==="tous"?set.length:set.filter(function(a){return statut(a)===s.id;}).length;
    return '<button class="tdle-stf" data-st="'+s.id+'" aria-pressed="'+(s.id===S.statut)+'" style="--sc:'+s.c+'"><span class="tdle-fdot"></span>'+s.label+' <b>'+n+'</b></button>';
  }).join("");
  if(estStaffCourant()){var nd=set.filter(aDesDemandes).length;html+='<button class="tdle-stf tdle-req-chip" data-st="demandes" aria-pressed="'+(S.statut==="demandes")+'">⚑ Demandes <b>'+nd+'</b></button>';}
  var el=$("#tdle-stf"); if(el){el.innerHTML=html; el.querySelectorAll(".tdle-stf").forEach(function(b){b.onclick=function(){S.statut=b.getAttribute("data-st");fixSel();renderStage();renderStatutFilters();};});}
}
/* « staff courant » (pour pastilles/filtre demandes) */
function estStaffCourant(){return CFG.DEV_POV?POV==="staff":isStaff();}

/* ===================== RENDER : scène ===================== */
var _lastSel=null;
function renderStage(){
  var el=$("#tdle-stage"); if(!el)return;
  var pl=el.querySelector(".tdle-dlist-rows"); var scl=pl?pl.scrollTop:0;
  var pb=el.querySelector(".tdle-dp-body"); var scb=pb?pb.scrollTop:0;
  var same=(_lastSel===S.sel);
  el.innerHTML=S.vue==="board"?viewBoard():viewDossier();
  var nl=el.querySelector(".tdle-dlist-rows"); if(nl)nl.scrollTop=scl;
  if(same){var nb=el.querySelector(".tdle-dp-body"); if(nb)nb.scrollTop=scb;}
  _lastSel=S.sel;
  brancher();
}
function badge(a){var v=STATUTS[statut(a)];return '<span class="tdle-stamp" style="--sc:'+v.c+'">'+v.label+'</span>';}

function viewDossier(){
  var d=filtre(), st=estStaffCourant();
  var rowsHtml = d.length ? d.map(function(x){
    return '<div class="tdle-drow" data-sel="'+x.id+'" aria-current="'+(x.id===S.sel)+'">'
      +'<span class="tdle-ddot" style="--sc:'+STATUTS[statut(x)].c+'"></span>'
      +'<div style="min-width:0">'
        +'<div class="tdle-drow-head"><span class="tdle-cote">'+x.cote+'</span><span class="tdle-type">'+esc(x.titre)+'</span></div>'
        +'<div class="tdle-drow-vic">'+esc(x.victime)+'</div>'
        +'<div class="tdle-drow-tags">'+badge(x)
          +(jouable(x)?'<span class="tdle-rpflag">RP</span>':'')
          +(x.intrigue?'<span class="tdle-lockflag">🔒</span>':'')
          +(st&&x.demandesReferent.length?'<span class="tdle-req">⚑ '+x.demandesReferent.length+' réf.</span>':'')
          +(st&&x.demandeCloture?'<span class="tdle-req">⚑ clôture</span>':'')
          +(st&&x.demandesLien.length?'<span class="tdle-req">⚑ lien</span>':'')
        +'</div>'
      +'</div>'
      +'<div style="text-align:right">'+(x.referent?av(x.referent):'')+'</div>'
    +'</div>';
  }).join("") : '<div class="tdle-empty">Aucune affaire pour ce filtre.</div>';
  var newbtn = st ? '<button class="tdle-newaffaire" data-act="new">＋ Nouvelle affaire</button>' : "";
  var a=parId(S.sel)||d[0];
  return '<div class="tdle-dossier'+(S.mob==="detail"?" detail":"")+'">'
    +'<div class="tdle-dlist">'+typeStripHTML()+'<div class="tdle-dlist-rows">'+rowsHtml+'</div>'+newbtn+'</div>'
    +'<div class="tdle-dpanel">'+(a?panel(a):'<div class="tdle-empty">—</div>')+'</div></div>';
}

function panel(a){
  var r=role(a);
  var onglets=[["resume","Résumé"],["elements","Éléments"],["chrono","Chronologie"],["personnes","Personnes"],["liens","Liens"]];
  var banner="";
  if(r==="staff"&&aDesDemandes(a)){
    banner='<div class="tdle-reqbanner">';
    if(a.demandesReferent.length){banner+='<p class="tdle-hsec">Demande(s) de référent — à arbitrer</p>'+a.demandesReferent.map(function(m){return '<div class="tdle-reqrow">'+av(m)+'<span>'+esc(m)+'</span><button class="tdle-abtn prim" data-valref="'+escAttr(m)+'">Valider comme référent</button></div>';}).join("");}
    if(a.demandesLien.length){banner+='<p class="tdle-hsec"'+(a.demandesReferent.length?' style="margin-top:8px"':'')+'>Demande(s) de lien</p>'+a.demandesLien.map(function(l){return '<div class="tdle-reqrow"><span class="tdle-cote">'+coteDe(l.id)+'</span><span>'+esc(l.note||"lien proposé")+' — par '+esc(l.par)+'</span><button class="tdle-abtn prim" data-vallien="'+escAttr(l.id)+'">Valider le lien</button></div>';}).join("");}
    if(a.demandeCloture){banner+='<div class="tdle-reqrow"'+((a.demandesReferent.length||a.demandesLien.length)?' style="border-top:1px dashed var(--dark2);margin-top:6px;padding-top:8px"':'')+'><span class="tdle-req">⚑</span><span>Le référent demande la clôture.</span></div>';}
    banner+='</div>';
  }
  var flags="";
  if(jouable(a))flags+='<span class="tdle-rpflag">Ouverte au RP</span>';
  if(a.intrigue)flags+='<span class="tdle-lockflag">🔒 Intrigue — staff</span>';
  var flagsRow=flags?'<div class="tdle-flags">'+flags+'</div>':'';
  return ''
    +'<button class="tdle-dret" data-back>← Retour à la liste</button>'
    +'<div class="tdle-dp-title"><span class="tdle-cote">'+a.cote+'</span><span class="tdle-type">'+esc(a.titre)+'</span>'+badge(a)+'</div>'
    +'<div class="tdle-dp-body">'
    +'<div class="tdle-dp-hd">'
      +'<div class="tdle-dp-meta">'
        +'<div class="tdle-m"><span class="tdle-k">Type</span><span class="tdle-v">'+typeLabel(a.type)+'</span></div>'
        +'<div class="tdle-m"><span class="tdle-k">Ouverture</span><span class="tdle-v">'+formatFR(a.dateISO)+'</span></div>'
        +'<div class="tdle-m"><span class="tdle-k">Lieu</span><span class="tdle-v">'+esc(a.lieu)+'</span></div>'
        +'<div class="tdle-m"><span class="tdle-k">Victime</span><span class="tdle-v"><b>'+esc(a.victime)+'</b></span></div>'
        +'<div class="tdle-m"><span class="tdle-k">Enquêteur (PJ)</span><span class="tdle-v">'+esc(a.enqueteur)+'</span></div>'
        +'<div class="tdle-m"><span class="tdle-k">Référent (membre)</span><span class="tdle-v">'+(a.intrigue?'<span class="tdle-todo">— staff —</span>':(a.referent?esc(a.referent):'<span class="tdle-todo">à pourvoir</span>'))+'</span></div>'
      +'</div>'+banner
    +'</div>'
    +flagsRow
    +'<div class="tdle-tabs">'+onglets.map(function(o){return '<button data-tab="'+o[0]+'" aria-selected="'+(o[0]===S.onglet)+'">'+o[1]+'</button>';}).join("")+'</div>'
    +'<div class="tdle-tabpane">'+tab(a)+'</div>'+drawer(a)
    +'</div>'
    +actionbar(a);
}

function tab(a){
  var r=role(a), editable=(r==="staff"||r==="referent");
  if(S.onglet==="elements"){
    var puce=function(v,i,delKey){return '<li class="tdle-puce">'+esc(v)+(editable?'<span class="tdle-rm" data-'+delKey+'="'+i+'" title="Supprimer">✕</span>':'')+'</li>';};
    var listP=a.particularites.length?a.particularites.map(function(v,i){return puce(v,i,"delpart");}).join(""):'<li>—</li>';
    var listE=a.elements.length?a.elements.map(function(v,i){return puce(v,i,"delel");}).join(""):'<li>—</li>';
    var addP=editable?'<button class="tdle-mini" data-act="addpart">+</button>':"";
    var addE=editable?'<button class="tdle-mini" data-act="addel">+</button>':"";
    var formP=S.inline==="particularite"?'<div class="tdle-iform"><input class="txt" id="tdle-partin" placeholder="Nouvelle particularité…"><button class="go" data-do="partok">Ajouter</button><button class="no" data-do="cancel">Annuler</button></div>':"";
    var formE=S.inline==="element"?'<div class="tdle-iform"><input class="txt" id="tdle-elin" placeholder="Nouvel élément / indice relevé…"><button class="go" data-do="elok">Ajouter</button><button class="no" data-do="cancel">Annuler</button></div>':"";
    var fk=a.folklore.length?'<p class="tdle-hsec" style="margin-top:18px">Éléments atypiques / folklore '+(a.intrigue?'🔒':'')+'</p><ul class="tdle-clean">'+a.folklore.map(function(x){return '<li class="tdle-puce">'+esc(x)+'</li>';}).join("")+'</ul>':"";
    return '<p class="tdle-tabhint">Les faits et indices de l\'affaire.</p>'
      +'<p class="tdle-hsec">Particularités '+addP+'</p><ul class="tdle-clean">'+listP+'</ul>'+formP
      +'<p class="tdle-hsec" style="margin-top:18px">Éléments relevés '+addE+'</p><ul class="tdle-clean">'+listE+'</ul>'+formE+fk
      +(a.intrigue&&r!=="staff"?'<p class="tdle-locked" style="margin-top:16px">Éléments verrouillés : affaire liée à une intrigue. Seul le staff peut les modifier.</p>':'');
  }
  if(S.onglet==="chrono"){
    var addBtn2=editable?'<button class="tdle-mini" data-act="addchr">+</button>':"";
    var form2=S.inline==="chrono"?'<div class="tdle-iform"><input class="dt" id="tdle-chdate" placeholder="Date RP (ex. 14 avril 2025)"><input class="txt" id="tdle-chtxt" placeholder="Progression de l\'enquête…"><button class="go" data-do="chok">Ajouter</button><button class="no" data-do="cancel">Annuler</button></div>':"";
    return '<p class="tdle-tabhint">La progression de l\'enquête, datée selon le RP.</p><p class="tdle-hsec">Journal de l\'affaire '+addBtn2+'</p>'+form2
      +'<ul class="tdle-timeline">'+a.chrono.map(function(e){return '<li><div class="tdle-tl-when">'+esc(e[1])+SEP+'<small>par '+esc(e[0])+'</small></div><div class="tdle-tl-txt">'+esc(e[2])+'</div></li>';}).join("")+'</ul>';
  }
  if(S.onglet==="personnes"){
    var list=participants(a), canCheck=editable;
    var h='<p class="tdle-hsec">Victime</p><div class="tdle-person vic">'+av(a.victime)+'<div><div>'+esc(a.victime)+'</div><div class="tdle-r">Victime</div></div></div>';
    h+='<p class="tdle-hsec" style="margin-top:16px">Participants RP '+(canCheck?'— cochez ceux qui touchent le bonus à la clôture':'')+'</p>';
    h+= list.length ? list.map(function(n){return '<div class="tdle-person">'+av(n)+'<div><div>'+esc(n)+'</div><div class="tdle-r">Participant RP</div></div>'+(canCheck?'<label class="tdle-chk"><input type="checkbox" data-val="'+escAttr(n)+'" '+(a.valides.indexOf(n)>=0?'checked':'')+'> validé</label>':(a.valides.indexOf(n)>=0?'<span class="tdle-r" style="margin-left:auto">✓ validé</span>':''))+'</div>';}).join("") : '<p style="color:var(--darkopa6);font-style:italic">Aucun participant pour l\'instant.</p>';
    if(a.personnes.length){h+='<p class="tdle-hsec" style="margin-top:16px">Autres personnes citées</p>'+a.personnes.map(function(p){return '<div class="tdle-person">'+av(p[0])+'<div><div>'+esc(p[0])+'</div><div class="tdle-r">'+esc(p[1])+'</div></div></div>';}).join("");}
    return h;
  }
  if(S.onglet==="liens"){
    var others=A.filter(function(x){return x.id!==a.id && !a.liens.some(function(l){return l.id===x.id;});});
    var addBtn3=editable?'<button class="tdle-mini" data-act="addlien">+</button>':"";
    var form3=S.inline==="lien"?'<div class="tdle-iform"><select id="tdle-liensel">'+(others.map(function(x){return '<option value="'+x.id+'">'+x.cote+' — '+esc(x.titre)+'</option>';}).join("")||'<option value="">(aucune)</option>')+'</select><input class="txt" id="tdle-liennote" placeholder="Note (ex. même mode opératoire)…"><button class="go" data-do="lienok">'+(r==="staff"?"Ajouter le lien":"Demander le lien")+'</button><button class="no" data-do="cancel">Annuler</button></div>':"";
    var pend=a.demandesLien.length?'<p class="tdle-hsec" style="margin-top:14px">Demandes de lien en attente</p><ul class="tdle-clean">'+a.demandesLien.map(function(l){return '<li><span class="tdle-cote">'+coteDe(l.id)+'</span> '+esc(l.note||'')+' <span style="color:var(--darkopa6)">— par '+esc(l.par)+(r==="staff"?'':' (à valider par le staff)')+'</span></li>';}).join("")+'</ul>':"";
    var suj = a.sujets.length
      ? '<p class="tdle-hsec" style="margin-top:18px">Sujets RP liés</p>'+a.sujets.map(function(s){return '<div class="tdle-sujet"><a href="'+escAttr(s.url)+'">'+esc(cleanTitre(s))+'</a><div class="tdle-who">'+esc(s.membres.join(", "))+'</div></div>';}).join("")
      : '<p class="tdle-hsec" style="margin-top:18px">Sujets RP liés</p><p style="color:var(--darkopa6);font-style:italic">Aucun sujet RP rattaché.</p>';
    return '<p class="tdle-tabhint">Affaires connexes et sujets RP rattachés à l\'enquête.</p>'
      +'<p class="tdle-hsec">Affaires liées '+addBtn3+'</p>'
      +(a.liens.length?'<ul class="tdle-clean tdle-liens">'+a.liens.map(function(l){return '<li><span class="tdle-cote link" data-goto="'+escAttr(l.id)+'">'+coteDe(l.id)+'</span><span>'+esc(l.note)+'</span></li>';}).join("")+'</ul>':'<p style="color:var(--darkopa6);font-style:italic">Aucune affaire liée.</p>')
      +form3+pend+suj;
  }
  /* resume */
  var roleForm=S.inline==="role"?'<div class="tdle-iform"><input class="txt" id="tdle-rlin" placeholder="Nouveau rôle recherché (ex. ambulancier)…"><button class="go" data-do="rlok">Ajouter</button><button class="no" data-do="cancel">Fermer</button></div>':"";
  return ''
    +'<p class="tdle-synthese">'+esc(a.synthese)+'</p>'
    +'<p style="margin-top:12px"><span class="tdle-hsec" style="display:inline">Statut'+SEP+'</span>'+esc(a.statutTxt)+'</p>'
    +'<div class="tdle-rpbox"><p class="tdle-hsec">Implication RP</p>'
      +(a.intrigue?'<p style="margin:0">Coordonnée par le staff.</p>':'<p style="margin:0 0 6px">'+esc(a.rp)+'</p><div class="tdle-roles">'
        +a.roles.filter(function(x){return x!=="—";}).map(function(rr){return '<span class="tdle-role">'+esc(rr)+(editable?'<span class="rm" data-delrole="'+escAttr(rr)+'">✕</span>':'')+'</span>';}).join("")
        +(editable?'<span class="tdle-role add" data-act="addrole">+ rôle</span>':(a.roles.filter(function(x){return x!=="—";}).length?'':'<span style="color:var(--darkopa6)">Aucun rôle défini.</span>'))
        +'</div>'+roleForm)
    +'</div>';
}

function actionbar(a){
  var r=role(a), btns="", label="";
  var rpBtn='<button class="tdle-abtn rp" data-act="rp">M\'impliquer en RP</button>';
  if(r==="staff"){label="Staff";
    btns+='<button class="tdle-abtn" data-act="edit">Éditer l\'affaire</button>';
    btns+='<button class="tdle-abtn" data-act="cold">'+(a.coldcase?"Retirer « cold case »":"Marquer « cold case »")+'</button>';
    btns+='<button class="tdle-abtn" data-act="intrigue">'+(a.intrigue?"Retirer « intrigue »":"Marquer « intrigue »")+'</button>';
    if(!a.intrigue)btns+='<button class="tdle-abtn" data-act="ref">'+(a.referent?"Retirer référent":"Assigner référent")+'</button>';
    btns+=rpBtn;
    btns+='<button class="tdle-abtn prim" data-act="close" '+(a.cloturee?'disabled':'')+'>'+(a.cloturee?"Déjà clôturée":"Clôturer & verser les bonus")+'</button>';
    btns+='<button class="tdle-abtn warn" data-act="delete">Supprimer</button>';
  }else if(r==="referent"){label="Référent";
    btns+='<button class="tdle-abtn" data-act="verif">Vérifier les participants</button>'+rpBtn;
    btns+=a.demandeCloture?'<button class="tdle-abtn prim" disabled>Clôture demandée ✓</button>':'<button class="tdle-abtn prim" data-act="askclose">Demander la clôture</button>';
  }else{label="Visiteur";
    if(a.cloturee)btns='<span style="color:var(--darkopa6);font-style:italic">Affaire close.</span>';
    else if(a.intrigue)btns='<span style="color:var(--darkopa6);font-style:italic">Pilotée par le staff — contactez le staff pour vous impliquer.</span>';
    else{
      var moi=myPseudo();
      if(!a.referent)btns+=(moi&&a.demandesReferent.indexOf(moi)>=0?'<button class="tdle-abtn prim" disabled>Demande envoyée ✓</button>':'<button class="tdle-abtn prim" data-act="demander">Demander à être référent</button>');
      btns+=rpBtn;
    }
  }
  return '<div class="tdle-actionbar"><span class="tdle-ab-role">Vous : '+label+'</span>'+btns+'</div>';
}

function drawer(a){
  if(S.drawer==="rp"){
    var opts=a.sujets.length?a.sujets.map(function(s){return '<label class="tdle-opt"><input type="checkbox" data-joinurl="'+escAttr(s.url)+'"> '+esc(cleanTitre(s))+'</label>';}).join(""):'<p style="color:var(--darkopa6);font-style:italic;margin:0 0 8px">Aucun sujet RP rattaché pour l\'instant.</p>';
    return '<div class="tdle-drawer on"><h4>M\'impliquer en RP — '+a.cote+'</h4>'
      +(a.sujets.length?'<p style="margin:0 0 8px">Cochez le(s) sujet(s) où joue votre personnage :</p>':'')+opts
      +'<h4 style="margin-top:12px">…ou rattachez un nouveau topic</h4>'
      +'<input type="text" id="tdle-rpurl" placeholder="https://thedrownedlands.forumactif.com/t000-titre-du-rp">'
      +'<div class="tdle-row"><button class="tdle-abtn prim" data-do="rpok">Valider</button><button class="tdle-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="edit"){
    return '<div class="tdle-drawer on"><h4>Éditer l\'affaire — '+a.cote+'</h4>'
      +'<label class="tdle-fl">Type d\'affaire (détermine le préfixe de cote)</label><div class="tdle-typepick">'
      +TYPES.map(function(t){return '<label><input type="radio" name="tdle-etype" value="'+t.id+'" '+(t.id===a.type?'checked':'')+'> '+t.id+' ⟡ '+t.label+'</label>';}).join("")+'</div>'
      +'<label class="tdle-fl">Date d\'ouverture (fixe l\'année et l\'ordre de la cote)</label><input type="date" id="tdle-edate" value="'+escAttr(a.dateISO||'')+'">'
      +'<label class="tdle-fl">Intitulé de l\'affaire</label><input type="text" id="tdle-etitre" value="'+escAttr(a.titre||'')+'">'
      +'<label class="tdle-fl">Victime</label><input type="text" id="tdle-evic" value="'+escAttr(a.victime||'')+'">'
      +'<label class="tdle-fl">Lieu</label><input type="text" id="tdle-elieu" value="'+escAttr(a.lieu||'')+'">'
      +'<label class="tdle-fl">Enquêteur (PJ)</label><input type="text" id="tdle-eenq" value="'+escAttr(a.enqueteur||'')+'">'
      +'<label class="tdle-fl">Synthèse</label><textarea id="tdle-esyn">'+esc(a.synthese||'')+'</textarea>'
      +'<label class="tdle-fl">Statut (texte affiché)</label><input type="text" id="tdle-estatut" value="'+escAttr(a.statutTxt||'')+'">'
      +'<label class="tdle-fl">Implication RP (accroche)</label><textarea id="tdle-erp">'+esc(a.rp||'')+'</textarea>'
      +'<div class="tdle-row"><button class="tdle-abtn prim" data-do="editok">Enregistrer</button><button class="tdle-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

function viewBoard(){
  var d=filtre(), st=estStaffCourant();
  var grid = d.length ? '<div class="tdle-board">'+d.map(function(a){
    return '<article class="tdle-fc" data-open="'+a.id+'">'
      +'<div class="tdle-fc-top"><span class="tdle-cote">'+a.cote+'</span>'+badge(a)+'</div>'
      +'<div class="tdle-dateline">'+formatFR(a.dateISO)+'</div><div class="tdle-type">'+esc(a.titre)+'</div><div class="tdle-fc-vic">'+esc(a.victime)+'</div>'
      +'<div class="tdle-fc-foot"><span>'+(a.intrigue?'🔒 Intrigue':(jouable(a)?'<span class="tdle-rpflag">Ouverte au RP</span>':CAT_LABEL[cat(a)]))+(st&&aDesDemandes(a)?' <span class="tdle-req">⚑</span>':'')+'</span><span>Ouvrir →</span></div>'
    +'</article>';
  }).join("")+'</div>' : '<div class="tdle-empty">Aucune affaire pour ce filtre.</div>';
  return '<div class="tdle-boardwrap">'+typeStripHTML()+'<div class="tdle-boardscroll">'+grid+'</div></div>';
}

/* ===================== ÉVÉNEMENTS ===================== */
function toast(m){var t=document.createElement("div");t.className="tdle-toast";t.textContent=m;document.body.appendChild(t);setTimeout(function(){t.style.transition="opacity .4s";t.style.opacity="0";setTimeout(function(){t.remove();},400);},3600);}
function ajouterLien(a,targetId,note){
  if(!a.liens.some(function(l){return l.id===targetId;}))a.liens.push({id:targetId,note:note||""});
  var b=parId(targetId);
  if(b&&!b.liens.some(function(l){return l.id===a.id;})){b.liens.push({id:a.id,note:note||""});persist(b);}
}
function staffNom(){return myPseudo()||"Staff";}

function brancher(){
  var stage=$("#tdle-stage"); if(!stage)return;
  stage.querySelectorAll("[data-sel]").forEach(function(el){el.onclick=function(){S.sel=el.getAttribute("data-sel");S.onglet="resume";S.drawer=null;S.inline=null;S.mob="detail";renderStage();};});
  stage.querySelectorAll("[data-open]").forEach(function(el){el.onclick=function(){S.sel=el.getAttribute("data-open");S.onglet="resume";S.drawer=null;S.inline=null;S.vue="dossiers";S.mob="detail";syncVue();renderStage();};});
  stage.querySelectorAll("[data-tab]").forEach(function(el){el.onclick=function(){S.onglet=el.getAttribute("data-tab");S.drawer=null;S.inline=null;renderStage();};});
  stage.querySelectorAll("[data-type]").forEach(function(el){el.onclick=function(){S.type=el.getAttribute("data-type");if(S.statut==="demandes"&&!estStaffCourant())S.statut="tous";fixSel();renderAll();};});
  stage.querySelectorAll("[data-goto]").forEach(function(el){el.onclick=function(){var id=el.getAttribute("data-goto");if(!parId(id)){toast("Affaire introuvable (peut-être supprimée).");return;}S.sel=id;S.type="tous";S.statut="tous";S.onglet="resume";renderAll();};});
  var back=stage.querySelector("[data-back]"); if(back)back.onclick=function(){S.mob="liste";renderStage();};
  stage.querySelectorAll("[data-val]").forEach(function(el){el.onchange=function(){var a=parId(S.sel),n=el.getAttribute("data-val");if(el.checked){if(a.valides.indexOf(n)<0)a.valides.push(n);}else{a.valides=a.valides.filter(function(x){return x!==n;});}persist(a);};});
  stage.querySelectorAll("[data-delrole]").forEach(function(el){el.onclick=function(){var a=parId(S.sel);a.roles=a.roles.filter(function(x){return x!==el.getAttribute("data-delrole");});if(!a.roles.length)a.roles=["—"];persist(a);renderStage();};});
  stage.querySelectorAll("[data-delpart]").forEach(function(el){el.onclick=function(){var a=parId(S.sel);a.particularites.splice(+el.getAttribute("data-delpart"),1);persist(a);renderStage();};});
  stage.querySelectorAll("[data-delel]").forEach(function(el){el.onclick=function(){var a=parId(S.sel);a.elements.splice(+el.getAttribute("data-delel"),1);persist(a);renderStage();};});
  stage.querySelectorAll("[data-valref]").forEach(function(el){el.onclick=function(){var a=parId(S.sel),m=el.getAttribute("data-valref");a.referent=m;a.demandesReferent=[];a.chrono.push([staffNom(),nowFR(),"Référent validé : "+m]);persist(a);toast(m+" est désormais référent.");renderAll();};});
  stage.querySelectorAll("[data-vallien]").forEach(function(el){el.onclick=function(){var a=parId(S.sel),tid=el.getAttribute("data-vallien");var dm=a.demandesLien.filter(function(l){return l.id===tid;})[0];ajouterLien(a,tid,dm?dm.note:"");a.demandesLien=a.demandesLien.filter(function(l){return l.id!==tid;});persist(a);toast("Lien validé.");renderStage();};});
  stage.querySelectorAll("[data-act]").forEach(function(el){el.onclick=function(){act(el.getAttribute("data-act"));};});
  stage.querySelectorAll("[data-do]").forEach(function(el){el.onclick=function(){doo(el.getAttribute("data-do"));};});
}

function act(k){
  var a=parId(S.sel); if(!a&&k!=="new")return;
  if(k==="demander"){var moi=myPseudo();if(!moi){toast("Connexion requise.");return;}if(a.demandesReferent.indexOf(moi)<0)a.demandesReferent.push(moi);persist(a);toast("Demande envoyée au staff.");renderStage();}
  else if(k==="rp"){S.drawer="rp";S.inline=null;renderStage();}
  else if(k==="verif"){S.onglet="personnes";S.drawer=null;S.inline=null;renderStage();}
  else if(k==="askclose"){a.demandeCloture=true;persist(a);toast("Demande de clôture envoyée au staff.");renderStage();}
  else if(k==="addel"){S.inline=S.inline==="element"?null:"element";renderStage();}
  else if(k==="addpart"){S.inline=S.inline==="particularite"?null:"particularite";renderStage();}
  else if(k==="addchr"){S.inline=S.inline==="chrono"?null:"chrono";renderStage();}
  else if(k==="addrole"){S.inline=S.inline==="role"?null:"role";renderStage();}
  else if(k==="addlien"){S.inline=S.inline==="lien"?null:"lien";renderStage();}
  else if(k==="edit"){S.drawer=S.drawer==="edit"?null:"edit";S.inline=null;renderStage();}
  else if(k==="cold"){a.coldcase=!a.coldcase;persist(a);toast(a.coldcase?"Marquée « cold case ».":"« Cold case » retiré.");renderAll();}
  else if(k==="intrigue"){a.intrigue=!a.intrigue;if(a.intrigue){a.referent=null;a.demandesReferent=[];}persist(a);toast(a.intrigue?"Marquée « intrigue » — verrouillée staff.":"« Intrigue » retiré.");renderAll();}
  else if(k==="ref"){a.referent=a.referent?null:(myPseudo()||null);if(a.referent)a.demandesReferent=[];persist(a);toast(a.referent?"Référent assigné.":"Référent retiré → En attente.");renderAll();}
  else if(k==="close"){cloturer(a);}
  else if(k==="delete"){supprimer(a);}
  else if(k==="new"){creerAffaire();}
}
function doo(k){
  var a=parId(S.sel);
  if(k==="cancel"){S.drawer=null;S.inline=null;renderStage();return;}
  if(k==="rpok"){
    var joins=[];document.querySelectorAll("[data-joinurl]:checked").forEach(function(x){joins.push(x.getAttribute("data-joinurl"));});
    var url=(($("#tdle-rpurl")||{}).value||"").trim();
    var moi=myPseudo(); if(!moi){toast("Connexion requise.");return;}
    joins.forEach(function(u){var s=a.sujets.filter(function(s){return s.url===u;})[0];if(s&&s.membres.indexOf(moi)<0)s.membres.push(moi);});
    if(url)a.sujets.push({url:url,titre:cleanTitre({url:url}),membres:[moi]});
    if(!joins.length&&!url){toast("Cochez un sujet ou renseignez une URL.");return;}
    persist(a);S.drawer=null;S.onglet="liens";toast("Inscrit·e comme participant·e.");renderStage();
  }
  if(k==="elok"){var t=(($("#tdle-elin")||{}).value||"").trim();if(!t){toast("Rien à ajouter.");return;}a.elements.push(t);a.chrono.push([staffNom(),nowFR(),"Nouvel élément ajouté au dossier"]);persist(a);S.inline=null;toast("Élément ajouté.");renderStage();}
  if(k==="partok"){var tp=(($("#tdle-partin")||{}).value||"").trim();if(!tp){toast("Rien à ajouter.");return;}a.particularites.push(tp);persist(a);S.inline=null;toast("Particularité ajoutée.");renderStage();}
  if(k==="chok"){var dt=(($("#tdle-chdate")||{}).value||"").trim(),tx=(($("#tdle-chtxt")||{}).value||"").trim();if(!tx){toast("Décris l'étape.");return;}a.chrono.push([staffNom(),dt||"date RP ?",tx]);persist(a);S.inline=null;toast("Étape ajoutée.");renderStage();}
  if(k==="rlok"){var tr=(($("#tdle-rlin")||{}).value||"").trim();if(!tr)return;a.roles=a.roles.filter(function(x){return x!=="—";});a.roles.push(tr);persist(a);renderStage();}
  if(k==="lienok"){var tid=(($("#tdle-liensel")||{}).value||"").trim();if(!tid){toast("Aucune affaire à lier.");return;}var note=(($("#tdle-liennote")||{}).value||"").trim();
    if(role(a)==="staff"){ajouterLien(a,tid,note);persist(a);toast("Lien ajouté.");}
    else{var moi=myPseudo()||"—";if(!a.demandesLien.some(function(l){return l.id===tid;}))a.demandesLien.push({id:tid,note:note,par:moi});persist(a);toast("Demande de lien envoyée au staff.");}
    S.inline=null;renderStage();}
  if(k==="editok"){
    var rt=document.querySelector('input[name=tdle-etype]:checked'); if(rt)a.type=rt.value;
    a.dateISO=(($("#tdle-edate")||{}).value)||a.dateISO;
    a.titre=(($("#tdle-etitre")||{}).value||"").trim()||a.titre;
    a.victime=(($("#tdle-evic")||{}).value||"").trim()||"—";
    a.lieu=(($("#tdle-elieu")||{}).value||"").trim()||"—";
    a.enqueteur=(($("#tdle-eenq")||{}).value||"").trim()||"—";
    a.synthese=(($("#tdle-esyn")||{}).value||"").trim();
    a.statutTxt=(($("#tdle-estatut")||{}).value||"").trim();
    a.rp=(($("#tdle-erp")||{}).value||"").trim();
    a.chrono.push([staffNom(),nowFR(),"Dossier édité"]);
    renumeroter();persist(a);S.drawer=null;toast("Affaire enregistrée — cote : "+a.cote);renderAll();
  }
}

/* ---- créations / suppressions / clôture (Firebase) ---- */
function creerAffaire(){
  var t=S.type!=="tous"?S.type:"AG";
  var na=normaliser({id:newId(),type:t,dateISO:new Date().toISOString().slice(0,10),enqueteur:"—",titre:"Nouvelle affaire",victime:"—",lieu:"—",statutTxt:"À compléter.",chrono:[[staffNom(),nowFR(),"Affaire créée"]]});
  A.push(na);renumeroter();persist(na);
  S.sel=na.id;S.vue="dossiers";S.mob="detail";S.onglet="resume";S.drawer="edit";S.inline=null;
  toast("Affaire "+na.cote+" créée — complétez-la.");renderAll();
}
function supprimer(a){
  if(!window.confirm("Supprimer définitivement l'affaire "+a.cote+" ("+a.titre+") ?\nCette action est irréversible."))return;
  var updates={}; updates[CFG.NODE+"/"+a.id]=null;
  A.forEach(function(x){ if(x===a)return;
    var l0=x.liens.length, d0=x.demandesLien.length;
    x.liens=x.liens.filter(function(l){return l.id!==a.id;});
    x.demandesLien=x.demandesLien.filter(function(l){return l.id!==a.id;});
    if(x.liens.length!==l0)updates[CFG.NODE+"/"+x.id+"/liens"]=x.liens;
    if(x.demandesLien.length!==d0)updates[CFG.NODE+"/"+x.id+"/demandesLien"]=x.demandesLien;
  });
  try{var p=window.EcoCore.firebaseUpdate(updates);if(p&&p.catch)p.catch(function(){toast("Suppression Firebase échouée.");});}catch(e){toast("Suppression échouée.");}
  A=A.filter(function(x){return x!==a;});renumeroter();
  var d=filtre();S.sel=d[0]?d[0].id:(A[0]?A[0].id:null);S.drawer=null;S.inline=null;S.mob="liste";
  toast("Affaire supprimée.");renderAll();
}
function cloturer(a){
  if(a.bonusVerse){toast("Bonus déjà versés.");return;}
  if(!window.confirm("Clôturer "+a.cote+" et verser les bonus ? (irréversible)"))return;
  var vals=a.valides.slice();
  if(a.referent&&vals.indexOf(a.referent)<0)vals.push(a.referent);
  var chain=Promise.resolve();
  vals.forEach(function(p){chain=chain.then(function(){return window.EcoCore.transactDollars(p,BONUS_PARTICIPANT);});});
  if(a.referent)chain=chain.then(function(){return window.EcoCore.transactDollars(a.referent,BONUS_REFERENT);});
  chain.then(function(){
    a.cloturee=true;a.bonusVerse=true;a.demandeCloture=false;
    a.chrono.push([staffNom(),nowFR(),"Affaire clôturée — bonus distribués"]);
    persist(a);
    var nb=vals.length,tot=nb*BONUS_PARTICIPANT+(a.referent?BONUS_REFERENT:0);
    toast("Clôturée. "+nb+" × "+BONUS_PARTICIPANT+"$"+(a.referent?" + "+BONUS_REFERENT+"$ référent":"")+" = "+tot+"$.");
    renderAll();
  }).catch(function(){toast("Erreur lors du versement des bonus — clôture annulée.");});
}

function syncVue(){var v=$("#tdle-vue");if(v)v.querySelectorAll("button").forEach(function(b){b.setAttribute("aria-selected",b.getAttribute("data-v")===S.vue);});}
function renderAll(){renderStatutFilters();renderStage();}

/* ===================== INIT ===================== */
function loading(msg){var el=$("#tdle-stage");if(el)el.innerHTML='<div class="tdle-empty">'+esc(msg||"Chargement…")+'</div>';}

function loadData(){
  loading("Chargement des enquêtes…");
  var pr;
  try{pr=window.EcoCore.safeReadBin();}catch(e){loading("EcoCore indisponible.");return;}
  Promise.resolve(pr).then(function(rec){
    var raw=(rec&&rec[CFG.NODE])?rec[CFG.NODE]:{};
    A=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliser(o);});
    renumeroter();fixSel();renderAll();
    if(!A.length)loading("Aucune enquête pour l'instant."+(estStaffCourant()?" Utilisez « Nouvelle affaire ».":""));
  }).catch(function(){loading("Impossible de charger les enquêtes.");});
}

function initApp(){
  var dev=$("#tdle-dev");
  if(dev){
    if(!CFG.DEV_POV){dev.style.display="none";}
    else{POV=isStaff()?"staff":"visiteur";dev.querySelectorAll("button").forEach(function(b){b.setAttribute("aria-selected",b.getAttribute("data-p")===POV);b.onclick=function(){POV=b.getAttribute("data-p");dev.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-selected",x.getAttribute("data-p")===POV);});if(S.statut==="demandes"&&!estStaffCourant())S.statut="tous";S.drawer=null;S.inline=null;renderAll();};});}
  }
  var vue=$("#tdle-vue");
  if(vue)vue.querySelectorAll("button").forEach(function(b){b.onclick=function(){S.vue=b.getAttribute("data-v");S.mob="liste";S.drawer=null;S.inline=null;syncVue();renderStage();};});
  syncVue();
  var rp=$("#tdle-rp");
  if(rp)rp.onclick=function(){S.rpOnly=!S.rpOnly;rp.setAttribute("aria-pressed",S.rpOnly);fixSel();renderStage();renderStatutFilters();};
  whenEco(loadData);
}

function whenEco(cb){
  if(window.EcoCore&&window.EcoCore.safeReadBin){cb();return;}
  loading("Connexion à la base…");
  var n=0,iv=setInterval(function(){
    if(window.EcoCore&&window.EcoCore.safeReadBin){clearInterval(iv);cb();}
    else if(++n>80){clearInterval(iv);loading("EcoCore introuvable — vérifiez que le script économie est chargé.");}
  },125);
}

/* ===================== MONTAGE FORUM ===================== */
var mounted=false;
function boot(){
  if(mounted)return true;
  var bg=document.querySelector(".tdle-bg");
  if(!bg)return false;
  mounted=true;
  document.body.appendChild(bg);
  var st=document.createElement("style");
  st.textContent="html#min-width,body,#wrap,#sj-main{min-width:0!important} html,body{overflow-x:hidden!important}";
  document.head.appendChild(st);
  if(!document.querySelector("meta[name=viewport]")){var mv=document.createElement("meta");mv.name="viewport";mv.content="width=device-width, initial-scale=1";document.head.appendChild(mv);}
  initApp();
  return true;
}
var tries=0, iv=setInterval(function(){if(boot()||++tries>60)clearInterval(iv);},250);
window.addEventListener("load",boot);
if(document.readyState!=="loading")boot();

})();
