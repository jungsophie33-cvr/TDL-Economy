/* ==================================================================
   THE DROWNED LANDS — PANNEAU DES ENQUÊTES · FICHIER 3/4 : RENDU
   ------------------------------------------------------------------
   État d'affichage, coquille complète (le topic ne porte plus que
   <div id="tdl-enquete"></div>), filtres, liste épurée, panneau,
   onglets, vues Dossiers/Mur. Zéro texte en dur : TDLE_CFG.TEXTES.
   Zéro style inline : tout va dans la feuille CSS du forum.
   ================================================================== */
(function(){
"use strict";

var CFG=window.TDLE_CFG, T=CFG.TEXTES, D=window.TDLE_DATA;
var R={};

/* ===================== ÉTAT ===================== */
R.S={vue:"dossiers", type:"tous", statut:"tous", refOnly:false, sel:null, onglet:"resume", mob:"liste", drawer:null, inline:null};
R.A=[];            /* affaires en mémoire : vives (Firebase) + archives (topic) */

function $(s,ctx){ return (ctx||document).querySelector(s); }
R.$=$;

/* ===================== ACCÈS ===================== */
R.parId=function(id){ for(var i=0;i<R.A.length;i++){ if(R.A[i].id===id) return R.A[i]; } return null; };
R.coteDe=function(id){ var x=R.parId(id); return x?x.cote:"(retirée)"; };
R.cat=function(a){ return CFG.TYPE_CAT[a.type]; };
R.statut=function(a){ if(a.cloturee) return "classee"; if(a.coldcase) return "non_elucidee"; return a.referent?"en_cours":"attente"; };
R.role=function(a){
  if(D.isStaff()) return "staff";
  if(a.archive) return "visiteur";
  if(a.referent&&a.referent===D.myPseudo()&&!a.intrigue) return "referent";
  return "visiteur";
};
R.estStaffCourant=function(){ return D.isStaff(); };
R.participants=function(a){ var s=[]; a.sujets.forEach(function(x){ x.membres.forEach(function(m){ if(s.indexOf(m)<0) s.push(m); }); }); return s; };
R.aDesDemandes=function(a){ return a.demandesReferent.length>0||a.demandeCloture||a.demandesLien.length>0; };
/* remplace « ouverte au RP » : une enquête vivante non-intrigue est jouable
   dès qu'elle a un référent ; le flag roles ne filtre plus rien */
R.avecRef=function(a){ return !a.cloturee&&!!a.referent; };

/* cote recalculée : uniquement pour les affaires VIVES ; une archive
   garde la cote figée de son post. */
R.renumeroter=function(){
  var g={};
  R.A.forEach(function(a){ if(a.archive) return;
    var y=(a.dateISO||"0000").slice(0,4), k=a.type+"|"+y; (g[k]=g[k]||[]).push(a); });
  Object.keys(g).forEach(function(k){
    var list=g[k];
    list.sort(function(x,y){ return (x.dateISO||"").localeCompare(y.dateISO||""); });
    list.forEach(function(a,i){ a.cote=a.type+"-"+(a.dateISO||"2000").slice(2,4)+"-"+D.pad2(i+1); });
  });
};

/* ===================== FILTRAGE ===================== */
function baseType(){ return R.A.filter(function(a){ return S.type==="tous"||a.type===S.type; }); }
function filtre(){ return baseType().filter(function(a){
  if(S.statut==="demandes") return R.aDesDemandes(a);
  return (S.statut==="tous"||R.statut(a)===S.statut)&&(!S.refOnly||R.avecRef(a));
});}
R.filtre=filtre;
R.fixSel=function(){ var d=filtre(), ok=false;
  d.forEach(function(a){ if(a.id===S.sel) ok=true; });
  if(!ok) S.sel=d[0]?d[0].id:null; };

/* ===================== AVATAR / BADGE ===================== */
function av(n){
  var c=window.TDLBase.avatar(n);
  if(c&&c.image) return '<span class="tdle-avatar"><img src="'+D.escAttr(c.image)+'" alt=""></span>';
  return '<span class="tdle-avatar">'+D.esc(String(n||"?").replace(/[@.\s]/g,"").slice(0,2).toUpperCase())+'</span>';
}
R.av=av;
R.badge=function(a){ var v=CFG.STATUTS[R.statut(a)];
  return '<span class="tdle-stamp" style="--sc:'+v.c+'">'+v.label+'</span>'; };

/* ===================== COQUILLE =====================
   Le topic ne porte plus que #tdl-enquete : le header, les outils et
   la scène sont générés ici, entièrement depuis le config. */
R.coquille=function(){
  return '<div class="tdle-bg"><div class="tdle-app">'
    +'<header class="tdle-header">'
      +'<span class="tdle-badge"><i class="fi fi-ts-badge-sheriff"></i></span>'
      +'<h1 class="tdle-h1">'+D.esc(T.titre)+'</h1>'
      +'<div class="tdle-brand"><span class="b1">'+D.esc(T.brand1)+'</span><span class="b2">'+D.esc(T.brand2)+'</span></div>'
      +'<a class="tdle-edit" id="tdle-edit" href="'+D.escAttr(CFG.EDIT_URL||"#")+'" title="'+D.escAttr(T.titreEditer)+'" target="_blank" rel="noopener"><i class="fi fi-tr-pen-field"></i></a>'
    +'</header>'
    +'<div class="tdle-tools">'
      +'<div id="tdle-stf"></div>'
      +'<button class="tdle-refonly" id="tdle-refonly" aria-pressed="false">'+D.esc(T.filtreRef)+'</button>'
      +'<div class="tdle-vue" id="tdle-vue">'
        +'<button data-v="dossiers" aria-selected="true">'+D.esc(T.vueDossiers)+'</button>'
        +'<button data-v="board" aria-selected="false">'+D.esc(T.vueBoard)+'</button>'
      +'</div>'
    +'</div>'
    +'<div id="tdle-stage"></div>'
  +'</div></div>';
};

/* ===================== FILTRES STATUT ===================== */
R.renderStatutFilters=function(){
  var set=baseType();
  var chips=[{id:"tous",label:T.filtreToutes,c:"var(--cntr)"}];
  Object.keys(CFG.STATUTS).forEach(function(id){ chips.push({id:id,label:CFG.STATUTS[id].label,c:CFG.STATUTS[id].c}); });
  var html=chips.map(function(s){
    var n=s.id==="tous"?set.length:set.filter(function(a){ return R.statut(a)===s.id; }).length;
    return '<button class="tdle-stf" data-st="'+s.id+'" aria-pressed="'+(s.id===S.statut)+'" style="--sc:'+s.c+'"><span class="tdle-fdot"></span>'+s.label+' <b>'+n+'</b></button>';
  }).join("");
  if(R.estStaffCourant()){
    var nd=set.filter(R.aDesDemandes).length;
    html+='<button class="tdle-stf tdle-req-chip" data-st="demandes" aria-pressed="'+(S.statut==="demandes")+'">'+T.filtreDemandes+' <b>'+nd+'</b></button>';
  }
  var el=$("#tdle-stf"); if(el){ el.innerHTML=html;
    el.querySelectorAll(".tdle-stf").forEach(function(b){ b.onclick=function(){ S.statut=b.getAttribute("data-st"); R.fixSel(); R.renderStage(); R.renderStatutFilters(); }; }); }
  var rb=$("#tdle-refonly"); if(rb){ rb.setAttribute("aria-pressed",S.refOnly); }
};

/* ===================== BANDE DE TYPES ===================== */
function typeStripHTML(){
  var items=[{id:"tous",ac:T.typeTous,ic:"fi-tr-folder-open"}];
  CFG.TYPES.forEach(function(t){ items.push({id:t.id,ac:t.id,ic:CFG.TYPE_ICON[t.id]}); });
  return '<div class="tdle-typestrip">'+items.map(function(it){
    return '<button class="tdle-tp" data-type="'+it.id+'" aria-selected="'+(it.id===S.type)+'"><i class="fi '+it.ic+'"></i><span>'+it.ac+'</span></button>';
  }).join("")+'</div>';
}

/* ===================== SCÈNE ===================== */
var _lastSel=null;
R.renderStage=function(){
  var el=$("#tdle-stage"); if(!el) return;
  var pl=el.querySelector(".tdle-dlist-rows"), scl=pl?pl.scrollTop:0;
  var pb=el.querySelector(".tdle-dp-body"), scb=pb?pb.scrollTop:0;
  var same=(_lastSel===S.sel);
  el.innerHTML=R.barreMigration()+(S.vue==="board"?viewBoard():viewDossier());
  var nl=el.querySelector(".tdle-dlist-rows"); if(nl) nl.scrollTop=scl;
  if(same){ var nb=el.querySelector(".tdle-dp-body"); if(nb) nb.scrollTop=scb; }
  _lastSel=S.sel;
  if(window.TDLE_ACT) window.TDLE_ACT.brancher(el);
};
R.renderAll=function(){ R.renderStatutFilters(); R.renderStage(); };
R.loading=function(msg){ var el=$("#tdle-stage"); if(el) el.innerHTML='<div class="tdle-empty">'+D.esc(msg||T.chargement)+'</div>'; };
R.syncVue=function(){ var v=$("#tdle-vue");
  if(v) v.querySelectorAll("button").forEach(function(b){ b.setAttribute("aria-selected",b.getAttribute("data-v")===S.vue); }); };

/* ===================== BANDEAU DE MIGRATION ===================== */
R.nonMigrees=function(){ return R.A.filter(function(a){ return !a.archive&&a.schema!==CFG.SCHEMA; }); };
R.barreMigration=function(){
  if(!R.estStaffCourant()) return "";
  var n=R.nonMigrees().length; if(!n) return "";
  return '<div class="tdle-migbar"><span>'+T.migbar1+n+T.migbar2+(n>1?"s":"")+T.migbar3+' '+T.migbar4+'</span>'
    +'<button class="tdle-abtn prim" data-act="migrer">'+T.migBtn+'</button></div>';
};

/* ===================== VUE DOSSIERS ===================== */
/* Ligne épurée : plus de tdle-ddot (la cote porte --sc en bordure),
   plus de tdle-drow-tags, plus de flag RP. */
function viewDossier(){
  var d=filtre(), st=R.estStaffCourant();
  var rowsHtml=d.length?d.map(function(x){
    return '<div class="tdle-drow" data-sel="'+x.id+'" aria-current="'+(x.id===S.sel)+'">'
      +'<div class="tdle-drow-main">'
        +'<div class="tdle-drow-head"><span class="tdle-cote" style="--sc:'+CFG.STATUTS[R.statut(x)].c+'">'+x.cote+'</span>'
        +'<span class="tdle-type">'+D.esc(x.titre)+'</span></div>'
        +'<div class="tdle-drow-vic">'+D.esc(x.victime)+'</div>'
        +'<div class="tdle-drow-foot">'+R.badge(x)
          +(x.archive?'<span class="tdle-archbadge">'+T.archBadge+'</span>':'')
          +(x.aArchive?'<span class="tdle-archbadge todo">'+T.archBadge+'</span>':'')
          +(x.intrigue?'<span class="tdle-lockflag">🔒</span>':'')
          +(st&&x.demandesReferent.length?'<span class="tdle-req">⚑ '+x.demandesReferent.length+' réf.</span>':'')
          +(st&&x.demandeCloture?'<span class="tdle-req">⚑ clôture</span>':'')
          +(st&&x.demandesLien.length?'<span class="tdle-req">⚑ lien</span>':'')
        +'</div>'
      +'</div>'
      +'<div class="tdle-drow-side">'+(x.referent?av(x.referent):'')+'</div>'
    +'</div>';
  }).join(""):'<div class="tdle-empty">'+D.esc(T.videFiltre)+'</div>';
  var newbtn=st?'<button class="tdle-newaffaire" data-act="new">'+D.esc(T.nouveau)+'</button>':"";
  var a=R.parId(S.sel)||d[0];
  return '<div class="tdle-dossier'+(S.mob==="detail"?" detail":"")+'">'
    +'<div class="tdle-dlist">'+typeStripHTML()+'<div class="tdle-dlist-rows">'+rowsHtml+'</div>'+newbtn+'</div>'
    +'<div class="tdle-dpanel">'+(a?R.panel(a):'<div class="tdle-empty">'+D.esc(T.videPanneau)+'</div>')+'</div></div>';
}

/* ===================== PANNEAU ===================== */
R.panel=function(a){
  var r=R.role(a), O=T.onglets, banner="";
  if(r==="staff"&&R.aDesDemandes(a)){
    banner='<div class="tdle-reqbanner">';
    if(a.demandesReferent.length){ banner+='<p class="tdle-hsec">'+D.esc(T.secDemandesRef)+'</p>'
      +a.demandesReferent.map(function(m){ return '<div class="tdle-reqrow">'+av(m)+'<span>'+D.esc(m)+'</span><button class="tdle-abtn prim" data-valref="'+D.escAttr(m)+'">'+D.esc(T.validerRef)+'</button></div>'; }).join(""); }
    if(a.demandesLien.length){ banner+='<p class="tdle-hsec">'+D.esc(T.secDemandesLien)+'</p>'
      +a.demandesLien.map(function(l){ return '<div class="tdle-reqrow"><span class="tdle-cote">'+R.coteDe(l.k)+'</span><span>'+D.esc(l.note||T.lienPropose)+' — '+D.esc(l.par)+'</span><button class="tdle-abtn prim" data-vallien="'+D.escAttr(l.k)+'">'+D.esc(T.valider)+'</button></div>'; }).join(""); }
    if(a.demandeCloture){ banner+='<div class="tdle-reqrow"><span class="tdle-req">⚑</span><span>'+D.esc(T.clotureDemandeeStaff)+'</span></div>'; }
    banner+='</div>';
  }
  return ''
    +'<button class="tdle-dret" data-back>'+D.esc(T.retourListe)+'</button>'
    +'<div class="tdle-dp-title"><span class="tdle-cote" style="--sc:'+CFG.STATUTS[R.statut(a)].c+'">'+a.cote+'</span><span class="tdle-type">'+D.esc(a.titre)+'</span>'+R.badge(a)
      +(a.archive?'<span class="tdle-archbadge">'+T.archBadge+'</span>':'')+'</div>'
    +'<div class="tdle-dp-body">'
    +'<div class="tdle-dp-hd">'
      +'<div class="tdle-dp-meta">'
        +'<div class="tdle-m"><span class="tdle-k">'+D.esc(T.metaType)+'</span><span class="tdle-v">'+D.esc(D.typeLabel(a.type))+'</span></div>'
        +'<div class="tdle-m"><span class="tdle-k">'+D.esc(T.metaOuverture)+'</span><span class="tdle-v">'+D.esc(D.formatFR(a.dateISO))+'</span></div>'
        +'<div class="tdle-m"><span class="tdle-k">'+D.esc(T.metaLieu)+'</span><span class="tdle-v">'+D.esc(a.lieu)+'</span></div>'
        +'<div class="tdle-m"><span class="tdle-k">'+D.esc(T.metaVictime)+'</span><span class="tdle-v"><b>'+D.esc(a.victime)+'</b></span></div>'
        +'<div class="tdle-m"><span class="tdle-k">'+D.esc(T.metaEnqueteur)+'</span><span class="tdle-v">'+D.esc(a.enqueteur)+'</span></div>'
        +'<div class="tdle-m"><span class="tdle-k">'+D.esc(T.metaReferent)+'</span><span class="tdle-v">'+(a.intrigue?'<span class="tdle-todo">'+D.esc(T.referentStaff)+'</span>':(a.referent?D.esc(a.referent):'<span class="tdle-todo">'+D.esc(T.referentAPourvoir)+'</span>'))+'</span></div>'
      +'</div>'+banner
    +'</div>'
    +'<div class="tdle-tabs">'+Object.keys(O).map(function(k){ return '<button data-tab="'+k+'" aria-selected="'+(k===S.onglet)+'">'+D.esc(O[k])+'</button>'; }).join("")+'</div>'
    +'<div class="tdle-tabpane">'+R.tab(a)+'</div>'+R.drawer(a)
    +'</div>'
    +R.actionbar(a);
};

/* ===================== ONGLETS ===================== */
R.tab=function(a){
  var r=R.role(a), editable=(r==="staff"||r==="referent")&&!a.archive;
  if(S.onglet==="elements"){
    var puce=function(o,delKey){ return '<li class="tdle-puce">'+D.esc(o.txt)
      +(o.par?'<span class="tdle-puce-by">'+D.esc(D.nomAffiche(o.par))+'</span>':'')
      +((editable&&o.k)?'<span class="tdle-rm" data-'+delKey+'="'+D.escAttr(o.k)+'" title="'+D.escAttr(T.supprimerBtn)+'">✕</span>':'')+'</li>'; };
    var listP=a.particularites.length?a.particularites.map(function(o){ return puce(o,"delpart"); }).join(""):'<li>—</li>';
    var listE=a.elements.length?a.elements.map(function(o){ return puce(o,"delel"); }).join(""):'<li>—</li>';
    var addP=editable?'<button class="tdle-mini" data-act="addpart">+</button>':"";
    var addE=editable?'<button class="tdle-mini" data-act="addel">+</button>':"";
    var formP=S.inline==="particularite"?'<div class="tdle-iform"><input class="txt" id="tdle-partin" placeholder="'+D.escAttr(T.placePart)+'"><button class="go" data-do="partok">'+D.esc(T.ajouter)+'</button><button class="no" data-do="cancel">'+D.esc(T.annuler)+'</button></div>':"";
    var formE=S.inline==="element"?'<div class="tdle-iform"><input class="txt" id="tdle-elin" placeholder="'+D.escAttr(T.placeEl)+'"><button class="go" data-do="elok">'+D.esc(T.ajouter)+'</button><button class="no" data-do="cancel">'+D.esc(T.annuler)+'</button></div>':"";
    var fk=a.folklore.length?'<p class="tdle-hsec alt">'+D.esc(T.secFolklore)+(a.intrigue?' 🔒':'')+'</p><ul class="tdle-clean">'+a.folklore.map(function(o){ return '<li class="tdle-puce">'+D.esc(o.txt)+'</li>'; }).join("")+'</ul>':"";
    return '<p class="tdle-tabhint">'+D.esc(T.hintElements)+'</p>'
      +'<p class="tdle-hsec">'+D.esc(T.secParticularites)+' '+addP+'</p><ul class="tdle-clean">'+listP+'</ul>'+formP
      +'<p class="tdle-hsec alt">'+D.esc(T.secElements)+' '+addE+'</p><ul class="tdle-clean">'+listE+'</ul>'+formE+fk
      +(a.intrigue&&r!=="staff"?'<p class="tdle-locked">'+D.esc(T.verrouille)+'</p>':'');
  }
  if(S.onglet==="chrono"){
    var addBtn2=editable?'<button class="tdle-mini" data-act="addchr">+</button>':"";
    var form2=S.inline==="chrono"?'<div class="tdle-iform"><input class="dt" id="tdle-chdate" placeholder="'+D.escAttr(T.placeChrDate)+'"><input class="txt" id="tdle-chtxt" placeholder="'+D.escAttr(T.placeChrTxt)+'"><button class="go" data-do="chok">'+D.esc(T.ajouter)+'</button><button class="no" data-do="cancel">'+D.esc(T.annuler)+'</button></div>':"";
    return '<p class="tdle-tabhint">'+D.esc(T.hintChrono)+'</p><p class="tdle-hsec">'+D.esc(T.secChrono)+' '+addBtn2+'</p>'+form2
      +'<ul class="tdle-timeline"><li><div class="tdle-tl-when">'+D.esc(D.formatFR(a.dateISO))+'</div><div class="tdle-tl-txt">'+D.esc(T.ouvertureChrono)+'</div></li>'
      +a.chrono.map(function(e){ return '<li><div class="tdle-tl-when">'+D.esc(e.dateRp)+CFG.SEP+'<small>'+D.esc(D.nomAffiche(e.par))+'</small>'
        +((editable&&e.k)?'<span class="tdle-rm" data-delchr="'+D.escAttr(e.k)+'">✕</span>':'')
        +'</div><div class="tdle-tl-txt">'+D.esc(e.txt)+'</div></li>'; }).join("")+'</ul>';
  }
  if(S.onglet==="personnes"){
    var list=R.participants(a), canCheck=editable;
    var h='<p class="tdle-hsec">'+D.esc(T.secVictime)+'</p><div class="tdle-person vic">'+av(a.victime)+'<div><div>'+D.esc(a.victime)+'</div><div class="tdle-r">'+D.esc(T.secVictime)+'</div></div></div>';
    h+='<p class="tdle-hsec alt">'+D.esc(T.secParticipants)+' '+(canCheck?D.esc(T.secParticipantsCo):'')+'</p>';
    h+=list.length?list.map(function(n){ return '<div class="tdle-person">'+av(n)+'<div><div>'+D.esc(n)+'</div><div class="tdle-r">'+D.esc(T.secParticipants)+'</div></div>'
      +(canCheck?'<label class="tdle-chk"><input type="checkbox" data-val="'+D.escAttr(n)+'" '+(a.valides.indexOf(n)>=0?'checked':'')+'> '+D.esc(T.validePar)+'</label>'
        :(a.valides.indexOf(n)>=0?'<span class="tdle-r push">✓ '+D.esc(T.validePar)+'</span>':''))+'</div>'; }).join("")
      :'<p class="tdle-vide">'+D.esc(T.aucunParticipant)+'</p>';
    if(a.personnes.length){ h+='<p class="tdle-hsec alt">'+D.esc(T.secPersonnes)+'</p>'+a.personnes.map(function(p){ return '<div class="tdle-person">'+av(p.nom)+'<div><div>'+D.esc(p.nom)+'</div><div class="tdle-r">'+D.esc(p.role)+'</div></div></div>'; }).join(""); }
    return h;
  }
  if(S.onglet==="liens"){
    var others=R.A.filter(function(x){ return !x.archive&&x.id!==a.id&&!a.liens.some(function(l){ return l.k===x.id; }); });
    var addBtn3=editable?'<button class="tdle-mini" data-act="addlien">+</button>':"";
    var form3=S.inline==="lien"?'<div class="tdle-iform"><select id="tdle-liensel">'+(others.map(function(x){ return '<option value="'+x.id+'">'+x.cote+' — '+D.esc(x.titre)+'</option>'; }).join("")||'<option value="">'+D.esc(T.aucuneALier)+'</option>')+'</select>'
      +'<input class="txt" id="tdle-liennote" placeholder="'+D.escAttr(T.placeLienNote)+'"><button class="go" data-do="lienok">'+D.esc(r==="staff"?T.ajouterLienStaff:T.demanderLien)+'</button><button class="no" data-do="cancel">'+D.esc(T.annuler)+'</button></div>':"";
    var pend=a.demandesLien.length?'<p class="tdle-hsec alt">'+D.esc(T.secDemandesLien)+'</p><ul class="tdle-clean">'+a.demandesLien.map(function(l){ return '<li><span class="tdle-cote">'+R.coteDe(l.k)+'</span> '+D.esc(l.note||"")+' <span class="tdle-vide-inline">— '+D.esc(l.par)+(r==="staff"?'':' '+D.esc(T.aValiderStaff))+'</span></li>'; }).join("")+'</ul>':"";
    var suj=a.sujets.length?'<p class="tdle-hsec alt">'+D.esc(T.secSujets)+'</p>'+a.sujets.map(function(s){ return '<div class="tdle-sujet"><a href="'+D.escAttr(s.url)+'">'+D.esc(D.cleanTitre(s))+'</a>'
      +((r==="staff"&&s.k&&!a.archive)?'<span class="tdle-rm" data-delsujet="'+D.escAttr(s.k)+'">✕</span>':'')
      +'<div class="tdle-who">'+D.esc(s.membres.join(", "))+'</div></div>'; }).join("")
      :'<p class="tdle-hsec alt">'+D.esc(T.secSujets)+'</p><p class="tdle-vide">'+D.esc(T.aucunSujet)+'</p>';
    return '<p class="tdle-tabhint">'+D.esc(T.hintLiens)+'</p>'
      +'<p class="tdle-hsec">'+D.esc(T.secLiens)+' '+addBtn3+'</p>'
      +(a.liens.length?'<ul class="tdle-clean tdle-liens">'+a.liens.map(function(l){ return '<li><span class="tdle-cote link" data-goto="'+D.escAttr(l.k)+'">'+R.coteDe(l.k)+'</span><span>'+D.esc(l.note)+'</span>'
        +((r==="staff"&&!a.archive)?'<span class="tdle-rm" data-dellien="'+D.escAttr(l.k)+'">✕</span>':'')+'</li>'; }).join("")+'</ul>':'<p class="tdle-vide">'+D.esc(T.aucunLien)+'</p>')
      +form3+pend+suj;
  }
  /* resume */
  var roleForm=S.inline==="role"?'<div class="tdle-iform"><input class="txt" id="tdle-rlin" placeholder="'+D.escAttr(T.placeRole)+'"><button class="go" data-do="rlok">'+D.esc(T.ajouter)+'</button><button class="no" data-do="cancel">'+D.esc(T.fermer)+'</button></div>':"";
  return ''
    +'<p class="tdle-synthese">'+D.esc(a.synthese)+'</p>'
    +'<p class="tdle-statut"><span class="tdle-hsec inline">'+D.esc(T.secStatut)+CFG.SEP+'</span>'+D.esc(a.statutTxt)+'</p>'
    +'<div class="tdle-rpbox"><p class="tdle-hsec">'+D.esc(T.secRoles)+'</p>'
      +(a.intrigue?'<p class="tdle-rp-coord">'+D.esc(T.intrigueCoord)+'</p>':'<p class="tdle-rp-accroche">'+D.esc(a.rp)+'</p><div class="tdle-roles">'
        +a.roles.map(function(rr){ return '<span class="tdle-role">'+D.esc(rr.txt)+((editable&&rr.k)?'<span class="rm" data-delrole="'+D.escAttr(rr.k)+'">✕</span>':'')+'</span>'; }).join("")
        +(editable?'<span class="tdle-role add" data-act="addrole">'+D.esc(T.roleAjout)+'</span>':(a.roles.length?'':'<span class="tdle-vide">'+D.esc(T.aucuneListe)+'</span>'))
        +'</div>'+roleForm)
    +'</div>';
};

/* ===================== BARRE D'ACTIONS ===================== */
R.actionbar=function(a){
  var r=R.role(a), btns="", label="", X=window.TDLE_ACT||{};
  var rpBtn='<button class="tdle-abtn rp" data-act="rp">'+D.esc(T.impliquer)+'</button>';
  if(a.archive){ label=T.roleVisiteur; btns='<span class="tdle-vide">'+D.esc(T.archBadge)+'</span>'; }
  else if(r==="staff"){ label=T.roleStaff;
    btns+='<button class="tdle-abtn" data-act="edit">'+D.esc(T.editerAffaire)+'</button>';
    btns+='<button class="tdle-abtn" data-act="cold">'+D.esc(a.coldcase?T.coldRetirer:T.coldAjouter)+'</button>';
    btns+='<button class="tdle-abtn" data-act="intrigue">'+D.esc(a.intrigue?T.intrRetirer:T.intrAjouter)+'</button>';
    if(!a.intrigue) btns+='<button class="tdle-abtn" data-act="ref">'+D.esc(a.referent?T.refRetirer:T.refAssigner)+'</button>';
    btns+=rpBtn;
    btns+='<button class="tdle-abtn prim" data-act="close" '+((a.cloturee||!a.valides.length)?'disabled':'')+'>'+D.esc(a.cloturee?T.dejaCloturee:T.clôturerBtn)+'</button>';
    if(a.cloturee&&!a.aArchive) btns+='<button class="tdle-abtn" data-act="archiver">'+D.esc(T.archiverBtn)+'</button>';
    if(a.aArchive) btns+='<button class="tdle-abtn warn" data-act="finaliser">'+D.esc(T.finaliserBtn)+'</button>';
    if(!a.cloturee) btns+='<button class="tdle-abtn warn" data-act="delete">'+D.esc(T.supprimerBtn)+'</button>';
  }else if(r==="referent"){ label=T.roleReferent;
    if(a.cloturee) btns='<span class="tdle-vide">'+D.esc(T.closeTxt)+'</span>';
    else{
      btns+='<button class="tdle-abtn" data-act="verif">'+D.esc(T.verifierBtn)+'</button>'+rpBtn;
      btns+=a.demandeCloture?'<button class="tdle-abtn prim" disabled>'+D.esc(T.clotureDemandee)+'</button>':'<button class="tdle-abtn prim" data-act="askclose">'+D.esc(T.demanderCloture)+'</button>';
    }
  }else if(!D.estMembre()){ label=T.roleInvite;
    btns='<span class="tdle-vide">'+D.esc(T.inviteTxt)+'</span>';
  }else{ label=T.roleVisiteur;
    if(a.cloturee) btns='<span class="tdle-vide">'+D.esc(T.closeTxt)+'</span>';
    else if(a.intrigue) btns='<span class="tdle-vide">'+D.esc(T.intrigueTxt)+'</span>';
    else{
      var moi=D.myPseudo();
      if(!a.referent) btns+=(moi&&a.demandesReferent.indexOf(moi)>=0?'<button class="tdle-abtn prim" disabled>'+D.esc(T.demandeEnvoyee)+'</button>':'<button class="tdle-abtn prim" data-act="demander">'+D.esc(T.demanderRef)+'</button>');
      btns+=rpBtn;
    }
  }
  return '<div class="tdle-actionbar"><span class="tdle-ab-role">'+D.esc(T.roleVous+label)+'</span>'+btns+'</div>';
};

/* ===================== TIROIRS ===================== */
R.drawer=function(a){
  if(S.drawer==="rp"){
    var opts=a.sujets.length?a.sujets.map(function(s){ return '<label class="tdle-opt"><input type="checkbox" data-joinurl="'+D.escAttr(s.url)+'"> '+D.esc(D.cleanTitre(s))+'</label>'; }).join("")
      :'<p class="tdle-vide">'+D.esc(T.aucunSujetDrawer)+'</p>';
    return '<div class="tdle-drawer on"><h4>'+D.esc(T.drawerRpTitre)+a.cote+'</h4>'
      +(a.sujets.length?'<p class="tdle-drawer-p">'+D.esc(T.drawerRpCochez)+'</p>':'')+opts
      +'<h4 class="alt">'+D.esc(T.drawerRpNouveau)+'</h4>'
      +'<input type="text" id="tdle-rpurl" placeholder="'+D.escAttr(T.placeSujetUrl)+'">'
      +'<div class="tdle-row"><button class="tdle-abtn prim" data-do="rpok">'+D.esc(T.valider)+'</button><button class="tdle-abtn" data-do="cancel">'+D.esc(T.annuler)+'</button></div></div>';
  }
  if(S.drawer==="edit"){
    return '<div class="tdle-drawer on"><h4>'+D.esc(T.drawerEditTitre)+a.cote+'</h4>'
      +'<label class="tdle-fl">'+D.esc(T.flType)+'</label><div class="tdle-typepick">'
      +CFG.TYPES.map(function(t){ return '<label><input type="radio" name="tdle-etype" value="'+t.id+'" '+(t.id===a.type?'checked':'')+'> '+t.id+CFG.SEP+D.esc(t.label)+'</label>'; }).join("")+'</div>'
      +'<label class="tdle-fl">'+D.esc(T.flDate)+'</label><input type="date" id="tdle-edate" value="'+D.escAttr(a.dateISO||'')+'">'
      +'<label class="tdle-fl">'+D.esc(T.flTitre)+'</label><input type="text" id="tdle-etitre" value="'+D.escAttr(a.titre||'')+'">'
      +'<label class="tdle-fl">'+D.esc(T.flVictime)+'</label><input type="text" id="tdle-evic" value="'+D.escAttr(a.victime||'')+'">'
      +'<label class="tdle-fl">'+D.esc(T.flLieu)+'</label><input type="text" id="tdle-elieu" value="'+D.escAttr(a.lieu||'')+'">'
      +'<label class="tdle-fl">'+D.esc(T.flEnqueteur)+'</label><input type="text" id="tdle-eenq" value="'+D.escAttr(a.enqueteur||'')+'">'
      +'<label class="tdle-fl">'+D.esc(T.flSynthese)+'</label><textarea id="tdle-esyn">'+D.esc(a.synthese||'')+'</textarea>'
      +'<label class="tdle-fl">'+D.esc(T.flStatutTxt)+'</label><input type="text" id="tdle-estatut" value="'+D.escAttr(a.statutTxt||'')+'">'
      +'<label class="tdle-fl">'+D.esc(T.flRp)+'</label><textarea id="tdle-erp">'+D.esc(a.rp||'')+'</textarea>'
      +'<div class="tdle-row"><button class="tdle-abtn prim" data-do="editok">'+D.esc(T.enregistrer)+'</button><button class="tdle-abtn" data-do="cancel">'+D.esc(T.annuler)+'</button></div></div>';
  }
  return "";
};

/* ===================== VUE MUR ===================== */
function viewBoard(){
  var d=filtre(), st=R.estStaffCourant();
  var grid=d.length?'<div class="tdle-board">'+d.map(function(a){
    return '<article class="tdle-fc" data-open="'+a.id+'">'
      +'<div class="tdle-fc-top"><span class="tdle-cote" style="--sc:'+CFG.STATUTS[R.statut(a)].c+'">'+a.cote+'</span>'+R.badge(a)+'</div>'
      +'<div class="tdle-dateline">'+D.esc(D.formatFR(a.dateISO))+'</div><div class="tdle-type">'+D.esc(a.titre)+'</div><div class="tdle-fc-vic">'+D.esc(a.victime)+'</div>'
      +'<div class="tdle-fc-foot"><span>'+(a.intrigue?'🔒':(a.archive?D.esc(T.archBadge):D.esc(CFG.CAT_LABEL[R.cat(a)])))+(st&&R.aDesDemandes(a)?' <span class="tdle-req">⚑</span>':'')+'</span><span>'+D.esc(T.ouvrir)+'</span></div>'
    +'</article>';
  }).join("")+'</div>':'<div class="tdle-empty">'+D.esc(T.videFiltre)+'</div>';
  return '<div class="tdle-boardwrap">'+typeStripHTML()+'<div class="tdle-boardscroll">'+grid+'</div></div>';
}

/* ===================== TOAST ===================== */
R.toast=function(m){
  var t=document.createElement("div"); t.className="tdle-toast"; t.textContent=m;
  document.body.appendChild(t);
  setTimeout(function(){ t.style.opacity="0"; setTimeout(function(){ t.remove(); },400); },3600);
};

window.TDLE_R=R;
})();
