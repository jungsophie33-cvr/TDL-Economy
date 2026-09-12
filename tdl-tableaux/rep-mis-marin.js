/* THE DROWNED LANDS — TABLEAU DES MISSIONS (MARINGOUINS) · JS
   Moulé sur eco-rep-enquete-v7.js. Dépend de window.EcoCore (safeReadBin,
   firebaseUpdate, firebaseTransaction). Données : missions/{id}. Création
   par la boutique (« mission de cellule ») ; ce panneau gère le cycle après.
   Appartenance : membres/{pseudo}.hors_la_loi.bande === "maringouins".
   Argent : prime débitée du PAYEUR à la création ; 7 j sans chef → refus auto
   + recrédit ; négociation → ajustement du delta ; validation staff → prime
   en parts égales aux participants + 50 $ bonus chef (fonds maison). */
(function(){
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  NODE: "missions",
  NODE_MEMBRES: "membres",
  EDIT_URL: "https://thedrownedlands.forumactif.com/post?p=467&mode=editpost" /* [MAJ] édition du sujet porteur */
};
var CHEF_BONUS = 50;                 /* bonus maison au chef à la validation */
var DELAI_REFUS = 7 * 86400000;      /* 7 j sans chef → refus auto */

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
var MANDANT = {joueur:"", entreprise:"entreprise", famille:"famille", pnj:"PNJ", anonyme:"anonyme"};

/* ===================== UTILS ===================== */
function typeLabel(id){for(var i=0;i<TYPES.length;i++){if(TYPES[i].id===id)return TYPES[i].label;}return id;}
function typeIcon(id){for(var i=0;i<TYPES.length;i++){if(TYPES[i].id===id)return TYPES[i].ic;}return "fi-tr-briefcase";}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escAttr(s){return String(s==null?"":s).replace(/"/g,"&quot;");}
function versTableau(v){return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]);}
function newId(){return "m"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function nbJours(iso){var t=new Date(iso).getTime();if(isNaN(t))return null;return Math.floor((Date.now()-t)/86400000);}
function ilya(iso){var d=nbJours(iso);if(d==null)return"—";return d<=0?"aujourd'hui":("il y a "+d+" j"+(d>1?"":""));}
function money(n){return (+n||0)+" $";}

/* crédite/débite un membre via transaction atomique (chemin racine) */
function crediterDollars(pseudo, delta){
  return window.EcoCore.firebaseTransaction("membres/"+encodeURIComponent(pseudo)+"/dollars",
    function(cur){return Math.max(0,(cur||0)+delta);});
}

/* identité réelle (forum) */
function isStaff(){try{return typeof _userdata!=="undefined"&&(_userdata.user_level===1||_userdata.user_level===2);}catch(e){return false;}}
function estConnecte(){try{return typeof _userdata!=="undefined"&&parseInt(_userdata.user_id,10)>0;}catch(e){return false;}}
function myPseudo(){try{if(typeof _userdata!=="undefined"&&_userdata.username)return String(_userdata.username).trim();}catch(e){}return null;}

/* ===================== DONNÉES ===================== */
var M = [];          /* missions en mémoire */
var MEMBRES = {};    /* snapshot membres (appartenance + soldes) */

function estMaringouin(pseudo){
  if(!pseudo)return false;
  var m=MEMBRES[pseudo];
  return !!(m&&m.hors_la_loi&&m.hors_la_loi.bande==="maringouins");
}
function solde(pseudo){var m=MEMBRES[pseudo];return (m&&+m.dollars)||0;}

function normaliser(o){
  o.titre=o.titre||"Mission"; o.type=o.type||"recuperation";
  o.mandataire=o.mandataire||"—"; o.mandataireType=o.mandataireType||"joueur";
  o.payeur=o.payeur||null;
  o.prime=+o.prime||0; o.primeInitiale=(o.primeInitiale!=null)?(+o.primeInitiale):o.prime;
  o.objectif=o.objectif||""; o.contexte=o.contexte||"";
  o.contraintes=versTableau(o.contraintes);
  o.statut=STATUTS[o.statut]?o.statut:"en_attente";
  o.chef=o.chef||null;
  o.participants=versTableau(o.participants);
  o.valides=versTableau(o.valides);
  o.nego=(o.nego&&o.nego.montant!=null)?o.nego:null;
  o.topic=o.topic||""; o.resume=o.resume||""; o.consequences=o.consequences||"";
  o.demandeValidation=!!o.demandeValidation;
  o.cree=o.cree||new Date().toISOString();
  o.rembourse=!!o.rembourse; o.primeVersee=!!o.primeVersee;
  return o;
}
function serialize(m){var o={};for(var k in m){if(m.hasOwnProperty(k)&&k!=="id")o[k]=m[k];}return o;}

var _lastWrite=0;
function patch(m, champs){
  _lastWrite=Date.now();
  var up={}; for(var k in champs){if(champs.hasOwnProperty(k))up[CFG.NODE+"/"+m.id+"/"+k]=champs[k];}
  try{var p=window.EcoCore.firebaseUpdate(up);if(p&&p.catch)p.catch(function(){toast("Sauvegarde échouée — réessaie.");});}
  catch(e){toast("Sauvegarde échouée.");}
}
function parId(id){for(var i=0;i<M.length;i++){if(M[i].id===id)return M[i];}return null;}

/* ===================== ÉTAT ===================== */
var S = {statut:"tous", sel:null, mob:"liste", drawer:null, inline:null};
function $(s,ctx){return (ctx||document).querySelector(s);}
function av(n){return '<span class="tdlm-avatar">'+esc(String(n||"?").replace(/[@.\s]/g,"").slice(0,2).toUpperCase())+'</span>';}
function aDesDemandes(m){return m.demandeValidation;}

/* ===================== FILTRAGE ===================== */
function estStaffCourant(){return isStaff();}
function filtre(){return M.filter(function(m){
  if(S.statut==="demandes")return aDesDemandes(m);
  return S.statut==="tous"||m.statut===S.statut;
});}
function fixSel(){var d=filtre();var ok=false;d.forEach(function(m){if(m.id===S.sel)ok=true;});if(!ok)S.sel=d[0]?d[0].id:null;}

/* ===================== FILTRES STATUT ===================== */
function renderStatutFilters(){
  var chips=[{id:"tous",label:"Toutes",c:"var(--cntr)"}];
  Object.keys(STATUTS).forEach(function(id){chips.push({id:id,label:STATUTS[id].label,c:STATUTS[id].c});});
  var html=chips.map(function(s){
    var n=s.id==="tous"?M.length:M.filter(function(m){return m.statut===s.id;}).length;
    return '<button class="tdlm-stf" data-st="'+s.id+'" aria-pressed="'+(s.id===S.statut)+'" style="--sc:'+s.c+'"><span class="tdlm-fdot"></span>'+s.label+' <b>'+n+'</b></button>';
  }).join("");
  if(estStaffCourant()){var nd=M.filter(aDesDemandes).length;html+='<button class="tdlm-stf tdlm-req-chip" data-st="demandes" aria-pressed="'+(S.statut==="demandes")+'">⚑ Demandes <b>'+nd+'</b></button>';}
  var el=$("#tdlm-stf"); if(el){el.innerHTML=html;el.querySelectorAll(".tdlm-stf").forEach(function(b){b.onclick=function(){S.statut=b.getAttribute("data-st");fixSel();renderStage();renderStatutFilters();};});}
}

/* ===================== RENDER ===================== */
function stamp(m){var v=STATUTS[m.statut];return '<span class="tdlm-stamp" style="--sc:'+v.c+'">'+v.label+'</span>';}

var _lastSel=null;
function renderStage(){
  var el=$("#tdlm-stage"); if(!el)return;
  var pl=el.querySelector(".tdlm-dlist-rows"); var scl=pl?pl.scrollTop:0;
  var pb=el.querySelector(".tdlm-dp-body"); var scb=pb?pb.scrollTop:0;
  var same=(_lastSel===S.sel);
  el.innerHTML=viewDossier();
  var nl=el.querySelector(".tdlm-dlist-rows"); if(nl)nl.scrollTop=scl;
  if(same){var nb=el.querySelector(".tdlm-dp-body"); if(nb)nb.scrollTop=scb;}
  _lastSel=S.sel;
  brancher();
}

function viewDossier(){
  var d=filtre(), st=estStaffCourant();
  var rows = d.length ? d.map(function(m){
    return '<div class="tdlm-drow" data-sel="'+m.id+'" aria-current="'+(m.id===S.sel)+'">'
      +'<span class="tdlm-ddot" style="--sc:'+STATUTS[m.statut].c+'"></span>'
      +'<div style="min-width:0">'
        +'<div class="tdlm-drow-head"><span class="tdlm-type">'+esc(m.titre)+'</span></div>'
        +'<div class="tdlm-drow-sub">'+esc(m.mandataire)+' · '+money(m.prime)+'</div>'
        +'<div class="tdlm-drow-tags">'+stamp(m)
          +(st&&m.demandeValidation?'<span class="tdlm-req">⚑ validation</span>':'')
        +'</div>'
        +'<div class="tdlm-dateline">posté '+ilya(m.cree)+'</div>'
      +'</div>'
      +'<div style="text-align:right">'+(m.chef?av(m.chef):'')+'</div>'
    +'</div>';
  }).join("") : '<div class="tdlm-empty">Aucune mission pour ce filtre.</div>';
  var sel=parId(S.sel)||d[0];
  return '<div class="tdlm-dossier'+(S.mob==="detail"?" detail":"")+'">'
    +'<div class="tdlm-dlist"><div class="tdlm-dlist-rows">'+rows+'</div></div>'
    +'<div class="tdlm-dpanel">'+(sel?panel(sel):'<div class="tdlm-empty">—</div>')+'</div></div>';
}

function panel(m){
  var me=myPseudo(), staff=isStaff();
  var mandLabel=esc(m.mandataire)+(MANDANT[m.mandataireType]?' <span class="tdlm-todo">('+MANDANT[m.mandataireType]+')</span>':'');
  var primeLabel=money(m.prime)+(m.prime!==m.primeInitiale?' <span class="tdlm-todo">(négociée, init. '+money(m.primeInitiale)+')</span>':'');

  /* bandeau demande de validation (staff) */
  var banner="";
  if(staff&&m.demandeValidation){
    banner='<div class="tdlm-reqbanner"><p class="tdlm-hsec">⚑ Le chef demande la validation</p>'
      +'<div class="tdlm-reqrow"><span>Coche les participants réellement impliqués, puis valide pour verser la prime.</span></div></div>';
  }

  /* négociation en cours */
  var negoBox="";
  if(m.nego){
    var estPayeur=(me&&me===m.payeur);
    negoBox='<div class="tdlm-negobox"><p class="tdlm-hsec">Négociation de prime</p>'
      +'<div class="tdlm-negorow"><span>Le chef propose <b>'+money(m.nego.montant)+'</b> (actuelle : '+money(m.prime)+').</span>'
      +(estPayeur?'<span class="tdlm-negoact"><button class="tdlm-abtn prim" data-act="negoyes">Accepter</button><button class="tdlm-abtn warn" data-act="negono">Refuser</button></span>':'')
      +'</div></div>';
  }

  /* participants */
  var editVal=(staff&&m.statut==="en_validation");
  var pList=m.participants.length?m.participants.map(function(p){
    var chk=editVal?'<label class="tdlm-chk"><input type="checkbox" data-val="'+escAttr(p)+'" '+(m.valides.indexOf(p)>=0?'checked':'')+'> validé</label>':'';
    return '<div class="tdlm-person'+(p===m.chef?' chef':'')+'">'+av(p)+'<span>'+esc(p)+(p===m.chef?' <span class="tdlm-r">chef de mission</span>':'')+'</span>'+chk+'</div>';
  }).join(""):'<p class="tdlm-todo" style="margin:0">Aucun Maringouin inscrit pour l\'instant.</p>';
  var peutRejoindre=(estMaringouin(me)&&m.participants.indexOf(me)<0&&(m.statut==="en_attente"||m.statut==="acceptee"));
  var joinBtn=peutRejoindre?'<button class="tdlm-abtn prim" data-act="join">Je participe</button>':'';
  var cadre='<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Participants</span>'+joinBtn+'</div>'+pList+'</div>';

  /* bilan (résumé / conséquences) */
  var bilan="";
  if(m.resume||m.consequences||m.statut==="en_validation"||m.statut==="terminee"){
    bilan='<div class="tdlm-sec"><p class="tdlm-hsec">Résumé</p><div class="tdlm-prose">'+(m.resume?esc(m.resume):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Conséquences</p><div class="tdlm-prose">'+(m.consequences?esc(m.consequences):'<span class="tdlm-todo">—</span>')+'</div></div>';
  }

  /* topic RP */
  var topicLine=m.topic?'<div class="tdlm-m"><span class="tdlm-k">Sujet RP</span><span class="tdlm-v"><a class="tdlm-lien" href="'+escAttr(m.topic)+'" target="_blank" rel="noopener">Ouvrir le sujet →</a></span></div>':'';

  var contraintes=m.contraintes.length
    ? '<ul class="tdlm-clean">'+m.contraintes.map(function(c){return '<li class="tdlm-puce">'+esc(c)+'</li>';}).join("")+'</ul>'
    : '<span class="tdlm-todo">—</span>';

  return ''
    +'<button class="tdlm-dret" data-back>← Retour à la liste</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">'+esc(m.titre)+'</span>'+stamp(m)+'</div>'
    +'<div class="tdlm-dp-body">'
      +'<div class="tdlm-dp-hd">'
        +'<div class="tdlm-dp-meta">'
          +'<div class="tdlm-m"><span class="tdlm-k">Commanditaire</span><span class="tdlm-v">'+mandLabel+'</span></div>'
          +'<div class="tdlm-m"><span class="tdlm-k">Type de mission</span><span class="tdlm-v"><i class="fi '+typeIcon(m.type)+'"></i> '+typeLabel(m.type)+'</span></div>'
          +'<div class="tdlm-m"><span class="tdlm-k">Prime proposée</span><span class="tdlm-v"><b>'+primeLabel+'</b></span></div>'
          +'<div class="tdlm-m"><span class="tdlm-k">Chef de mission</span><span class="tdlm-v">'+(m.chef?esc(m.chef):'<span class="tdlm-todo">à pourvoir</span>')+'</span></div>'
          +'<div class="tdlm-m"><span class="tdlm-k">Publiée</span><span class="tdlm-v">'+ilya(m.cree)+'</span></div>'
          +topicLine
        +'</div>'+banner
      +'</div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Objectif</p><div class="tdlm-prose">'+(m.objectif?esc(m.objectif):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Contraintes</p>'+contraintes+'</div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Contexte</p><div class="tdlm-prose">'+(m.contexte?esc(m.contexte):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +negoBox
      +cadre
      +bilan
      +drawer(m)
    +'</div>'
    +actionbar(m);
}

/* ---- barre d'action selon rôle ---- */
function actionbar(m){
  var me=myPseudo(), staff=isStaff(), payeur=(me&&me===m.payeur), chef=(me&&me===m.chef);
  var label, btns="";
  var edit=staff?'<button class="tdlm-abtn" data-act="edit">Modifier les termes</button>':"";
  var del=staff?'<button class="tdlm-abtn warn" data-act="delete">Supprimer</button>':"";
  var refuse=(staff&&m.statut!=="terminee"&&m.statut!=="refusee")?'<button class="tdlm-abtn warn" data-act="refuser">Refuser & rembourser</button>':"";

  if(staff){
    label="Staff";
    if(m.statut==="en_validation")btns+='<button class="tdlm-abtn prim" data-act="valider">Valider &amp; verser la prime</button>';
    btns+=edit+refuse+del;
  }else if(chef&&(m.statut==="acceptee"||m.statut==="en_validation")){
    label="Chef de mission";
    btns+='<button class="tdlm-abtn" data-act="topic">'+(m.topic?"Modifier le sujet RP":"Renseigner le sujet RP")+'</button>';
    if(m.statut==="acceptee")btns+='<button class="tdlm-abtn" data-act="nego">Négocier la prime</button>';
    btns+='<button class="tdlm-abtn prim" data-act="bilan">'+(m.statut==="en_validation"?"Modifier le bilan":"Bilan &amp; passer en validation")+'</button>';
  }else if(payeur&&(m.statut==="en_attente"||m.statut==="acceptee")){
    label="Commanditaire";
    if(m.statut==="en_attente")btns+='<button class="tdlm-abtn warn" data-act="retirer">Retirer ma mission</button>';
    if(!btns)btns='<span class="tdlm-idle">En attente du chef de mission.</span>';
  }else if(!estConnecte()){
    label="Invité"; btns='<span class="tdlm-idle">Connectez-vous pour interagir.</span>';
  }else if(estMaringouin(me)){
    label="Maringouin"; btns='<span class="tdlm-idle">Utilisez « Je participe » ci-dessus.</span>';
  }else{
    label="Visiteur"; btns='<span class="tdlm-idle">Table consultable — inscription réservée aux Maringouins.</span>';
  }
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+label+'</span>'+btns+'</div>';
}

/* ---- drawers / formulaires ---- */
function drawer(m){
  if(S.drawer==="edit"){
    var opts=TYPES.map(function(t){return '<option value="'+t.id+'"'+(t.id===m.type?' selected':'')+'>'+t.label+'</option>';}).join("");
    var mand=Object.keys(MANDANT).map(function(k){return '<option value="'+k+'"'+(k===m.mandataireType?' selected':'')+'>'+(k==="joueur"?"joueur":MANDANT[k])+'</option>';}).join("");
    return '<div class="tdlm-drawer on"><h4>Modifier les termes (staff)</h4>'
      +'<label class="tdlm-fl">Titre</label><input type="text" id="tdlm-etitre" value="'+escAttr(m.titre)+'">'
      +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Type</label><select id="tdlm-etype">'+opts+'</select></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Prime ($)</label><input type="text" id="tdlm-eprime" value="'+escAttr(m.prime)+'"></div></div>'
      +'<div class="tdlm-row"><div style="flex:2"><label class="tdlm-fl">Commanditaire (libellé)</label><input type="text" id="tdlm-emand" value="'+escAttr(m.mandataire)+'"></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Au nom de</label><select id="tdlm-emandt">'+mand+'</select></div></div>'
      +'<label class="tdlm-fl">Objectif</label><textarea id="tdlm-eobj">'+esc(m.objectif)+'</textarea>'
      +'<label class="tdlm-fl">Contraintes (une par ligne)</label><textarea id="tdlm-econtr">'+esc(m.contraintes.join("\n"))+'</textarea>'
      +'<label class="tdlm-fl">Contexte</label><textarea id="tdlm-ectx">'+esc(m.contexte)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="editok">Enregistrer</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="bilan"){
    return '<div class="tdlm-drawer on"><h4>Bilan de mission</h4>'
      +'<label class="tdlm-fl">Résumé</label><textarea id="tdlm-bresume">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Conséquences</label><textarea id="tdlm-bconseq">'+esc(m.consequences)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="bilanok">'+(m.statut==="en_validation"?"Enregistrer":"Envoyer en validation")+'</button>'
      +(m.statut!=="en_validation"?'<button class="tdlm-abtn" data-do="bilansave">Enregistrer sans envoyer</button>':'')
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline==="topic"){
    return '<div class="tdlm-drawer on"><h4>Sujet RP de la mission</h4>'
      +'<input type="text" id="tdlm-topic" value="'+escAttr(m.topic)+'" placeholder="https://thedrownedlands.forumactif.com/t...">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="topicok">Enregistrer</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline==="nego"){
    return '<div class="tdlm-drawer on"><h4>Proposer une nouvelle prime</h4>'
      +'<input type="text" id="tdlm-negom" placeholder="Montant en $" value="'+escAttr(m.nego?m.nego.montant:"")+'">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="negook">Proposer au commanditaire</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

/* ===================== ÉVÉNEMENTS ===================== */
function toast(msg){var t=document.createElement("div");t.className="tdlm-toast";t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.style.transition="opacity .4s";t.style.opacity="0";setTimeout(function(){t.remove();},400);},3600);}

function brancher(){
  var stage=$("#tdlm-stage"); if(!stage)return;
  stage.querySelectorAll("[data-sel]").forEach(function(el){el.onclick=function(){S.sel=el.getAttribute("data-sel");S.drawer=null;S.inline=null;S.mob="detail";renderStage();};});
  var back=stage.querySelector("[data-back]"); if(back)back.onclick=function(){S.mob="liste";renderStage();};
  stage.querySelectorAll("[data-val]").forEach(function(el){el.onchange=function(){var m=parId(S.sel),n=el.getAttribute("data-val");if(el.checked){if(m.valides.indexOf(n)<0)m.valides.push(n);}else{m.valides=m.valides.filter(function(x){return x!==n;});}patch(m,{valides:m.valides});};});
  stage.querySelectorAll("[data-act]").forEach(function(el){el.onclick=function(){act(el.getAttribute("data-act"));};});
  stage.querySelectorAll("[data-do]").forEach(function(el){el.onclick=function(){doo(el.getAttribute("data-do"));};});
}

function act(k){
  var m=parId(S.sel); if(!m)return;
  var me=myPseudo();
  if(k==="join"){
    if(!estMaringouin(me)){toast("Inscription réservée aux Maringouins.");return;}
    if(m.statut!=="en_attente"&&m.statut!=="acceptee"){toast("Mission fermée à l'inscription.");return;}
    if(m.participants.indexOf(me)>=0){toast("Déjà inscrit·e.");return;}
    m.participants.push(me);
    var champs={participants:m.participants};
    if(!m.chef){m.chef=me;m.statut="acceptee";champs.chef=me;champs.statut="acceptee";}
    patch(m,champs);toast(m.chef===me?"Inscrit·e — vous êtes chef de mission.":"Inscrit·e à la mission.");renderAll();
  }
  else if(k==="topic"){S.inline=S.inline==="topic"?null:"topic";S.drawer=null;renderStage();}
  else if(k==="nego"){S.inline=S.inline==="nego"?null:"nego";S.drawer=null;renderStage();}
  else if(k==="bilan"){S.drawer=S.drawer==="bilan"?null:"bilan";S.inline=null;renderStage();}
  else if(k==="edit"){S.drawer=S.drawer==="edit"?null:"edit";S.inline=null;renderStage();}
  else if(k==="negoyes"){accepterNego(m);}
  else if(k==="negono"){m.nego=null;patch(m,{nego:null});toast("Proposition refusée.");renderStage();}
  else if(k==="retirer"){retirer(m);}
  else if(k==="refuser"){refuserStaff(m);}
  else if(k==="valider"){valider(m);}
  else if(k==="delete"){supprimer(m);}
}

function doo(k){
  var m=parId(S.sel);
  if(k==="cancel"){S.drawer=null;S.inline=null;renderStage();return;}
  if(k==="topicok"){var u=(($("#tdlm-topic")||{}).value||"").trim();m.topic=u;patch(m,{topic:u});S.inline=null;toast("Sujet RP enregistré.");renderStage();return;}
  if(k==="negook"){
    var v=parseInt((($("#tdlm-negom")||{}).value||"").replace(/[^\d]/g,""),10);
    if(!v||v<0){toast("Montant invalide.");return;}
    m.nego={montant:v,statut:"en_cours",par:myPseudo()||m.chef};
    patch(m,{nego:m.nego});S.inline=null;toast("Proposition envoyée au commanditaire.");renderStage();return;
  }
  if(k==="bilanok"||k==="bilansave"){
    m.resume=(($("#tdlm-bresume")||{}).value||"").trim();
    m.consequences=(($("#tdlm-bconseq")||{}).value||"").trim();
    var champs={resume:m.resume,consequences:m.consequences};
    if(k==="bilanok"&&m.statut!=="en_validation"){
      if(!m.resume){toast("Renseigne au moins le résumé.");return;}
      m.statut="en_validation";m.demandeValidation=true;
      champs.statut="en_validation";champs.demandeValidation=true;
    }
    patch(m,champs);S.drawer=null;
    toast(k==="bilanok"&&champs.statut==="en_validation"?"Mission envoyée en validation.":"Bilan enregistré.");
    renderAll();return;
  }
  if(k==="editok"){
    m.titre=(($("#tdlm-etitre")||{}).value||"").trim()||m.titre;
    var rt=$("#tdlm-etype"); if(rt)m.type=rt.value;
    var pr=parseInt((($("#tdlm-eprime")||{}).value||"").replace(/[^\d]/g,""),10); m.prime=isNaN(pr)?m.prime:pr;
    m.mandataire=(($("#tdlm-emand")||{}).value||"").trim()||m.mandataire;
    var mt=$("#tdlm-emandt"); if(mt)m.mandataireType=mt.value;
    m.objectif=(($("#tdlm-eobj")||{}).value||"").trim();
    m.contraintes=(($("#tdlm-econtr")||{}).value||"").split("\n").map(function(x){return x.trim();}).filter(Boolean);
    m.contexte=(($("#tdlm-ectx")||{}).value||"").trim();
    patch(m,{titre:m.titre,type:m.type,prime:m.prime,mandataire:m.mandataire,mandataireType:m.mandataireType,objectif:m.objectif,contraintes:m.contraintes,contexte:m.contexte});
    S.drawer=null;toast("Termes enregistrés.");renderAll();return;
  }
}

/* ===================== ARGENT ===================== */
function accepterNego(m){
  if(!m.nego){return;}
  var montant=m.nego.montant, delta=montant-m.prime;
  if(delta>0&&solde(m.payeur)<delta){toast("Fonds insuffisants pour couvrir la hausse de prime ("+money(delta)+" manquants).");return;}
  var op=Promise.resolve();
  if(delta!==0)op=crediterDollars(m.payeur,-delta); /* delta>0 → débit ; delta<0 → recrédit */
  op.then(function(){
    m.prime=montant;m.nego=null;
    patch(m,{prime:montant,nego:null});
    toast("Prime ajustée à "+money(montant)+".");renderAll();
  }).catch(function(){toast("Ajustement de la prime échoué.");});
}

function retirer(m){
  if(m.statut!=="en_attente"){toast("Retrait possible seulement tant qu'aucun chef n'est inscrit.");return;}
  if(!window.confirm("Retirer la mission « "+m.titre+" » ? La prime ("+money(m.prime)+") vous sera recréditée."))return;
  var op=(m.payeur&&m.prime>0&&!m.rembourse)?crediterDollars(m.payeur,m.prime):Promise.resolve();
  op.then(function(){m.statut="refusee";m.rembourse=true;patch(m,{statut:"refusee",rembourse:true});toast("Mission retirée, prime recréditée.");renderAll();})
    .catch(function(){toast("Recrédit échoué.");});
}

function refuserStaff(m){
  if(!window.confirm("Refuser la mission « "+m.titre+" » et rembourser le commanditaire ?"))return;
  var op=(m.payeur&&m.prime>0&&!m.rembourse)?crediterDollars(m.payeur,m.prime):Promise.resolve();
  op.then(function(){m.statut="refusee";m.rembourse=true;m.demandeValidation=false;patch(m,{statut:"refusee",rembourse:true,demandeValidation:false});toast("Mission refusée, commanditaire remboursé.");renderAll();})
    .catch(function(){toast("Remboursement échoué.");});
}

function valider(m){
  if(m.primeVersee){toast("Prime déjà versée.");return;}
  var vals=m.valides.slice();
  if(!vals.length){toast("Coche au moins un participant.");return;}
  var n=vals.length, part=Math.floor(m.prime/n), reste=m.prime-part*n;
  if(!window.confirm("Valider « "+m.titre+" » ?\n"+n+" participant(s) : "+money(part)+" chacun"+(reste?" (+"+money(reste)+" au chef)":"")+" + "+money(CHEF_BONUS)+" bonus chef. Irréversible."))return;
  var chain=Promise.resolve();
  vals.forEach(function(p){chain=chain.then(function(){return crediterDollars(p,part);});});
  if(m.chef&&vals.indexOf(m.chef)>=0){chain=chain.then(function(){return crediterDollars(m.chef,reste+CHEF_BONUS);});}
  else if(reste){chain=chain.then(function(){return crediterDollars(vals[0],reste);});}
  chain.then(function(){
    m.statut="terminee";m.primeVersee=true;m.demandeValidation=false;
    patch(m,{statut:"terminee",primeVersee:true,demandeValidation:false});
    toast("Mission validée. "+n+" × "+money(part)+(m.chef?" + "+money(CHEF_BONUS)+" chef":"")+" versés.");
    renderAll();
  }).catch(function(){toast("Versement échoué — validation annulée.");});
}

function supprimer(m){
  if(!window.confirm("Supprimer définitivement la mission « "+m.titre+" » ?\nAucun remboursement automatique — utilisez « Refuser & rembourser » si nécessaire."))return;
  var up={};up[CFG.NODE+"/"+m.id]=null;
  try{var p=window.EcoCore.firebaseUpdate(up);if(p&&p.catch)p.catch(function(){toast("Suppression Firebase échouée.");});}catch(e){toast("Suppression échouée.");}
  M=M.filter(function(x){return x!==m;});
  var d=filtre();S.sel=d[0]?d[0].id:(M[0]?M[0].id:null);S.drawer=null;S.inline=null;S.mob="liste";
  toast("Mission supprimée.");renderAll();
}

/* ---- refus auto (7 j sans chef), évaluation paresseuse au chargement ---- */
function autoRefus(){
  var now=Date.now();
  M.forEach(function(m){
    if(m.statut==="en_attente"&&!m.chef&&!m.rembourse){
      if(now-new Date(m.cree).getTime()>=DELAI_REFUS){
        m.statut="refusee";m.rembourse=true;
        if(m.payeur&&m.prime>0)crediterDollars(m.payeur,m.prime);
        patch(m,{statut:"refusee",rembourse:true});
      }
    }
  });
}

/* ===================== CHARGEMENT ===================== */
function renderAll(){renderStatutFilters();renderStage();}
function loading(msg){var el=$("#tdlm-stage");if(el)el.innerHTML='<div class="tdlm-empty">'+esc(msg||"Chargement…")+'</div>';}

function loadData(){
  loading("Chargement des missions…");
  var pr;try{pr=window.EcoCore.safeReadBin();}catch(e){loading("EcoCore indisponible.");return;}
  Promise.resolve(pr).then(function(rec){
    MEMBRES=(rec&&rec[CFG.NODE_MEMBRES])||{};
    var raw=(rec&&rec[CFG.NODE])?rec[CFG.NODE]:{};
    M=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliser(o);});
    M.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
    autoRefus();fixSel();renderAll();
    if(!M.length)loading("Aucune mission pour l'instant.");
  }).catch(function(){loading("Impossible de charger les missions.");});
}

function whenEco(cb){
  if(window.EcoCore&&window.EcoCore.safeReadBin){cb();return;}
  loading("Connexion à la base…");
  var n=0,iv=setInterval(function(){
    if(window.EcoCore&&window.EcoCore.safeReadBin){clearInterval(iv);cb();}
    else if(++n>80){clearInterval(iv);loading("EcoCore introuvable — vérifiez que le script économie est chargé.");}
  },125);
}

/* ---- rafraîchissement périodique (co-édition) ---- */
var REFRESH_MS=20000;
function signature(list){return list.map(function(o){return o.id+":"+JSON.stringify(serialize(o));}).sort().join("|");}
function startAutoRefresh(){setInterval(tickRefresh,REFRESH_MS);}
function tickRefresh(){
  if(!window.EcoCore||!window.EcoCore.safeReadBin)return;
  if(S.drawer||S.inline)return;
  if(Date.now()-_lastWrite<5000)return;
  var ae=document.activeElement; if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))return;
  try{if(window.EcoCore.invalidateCache)window.EcoCore.invalidateCache();}catch(e){}
  var pr;try{pr=window.EcoCore.safeReadBin();}catch(e){return;}
  Promise.resolve(pr).then(function(rec){
    if(S.drawer||S.inline||Date.now()-_lastWrite<5000)return;
    MEMBRES=(rec&&rec[CFG.NODE_MEMBRES])||MEMBRES;
    var raw=(rec&&rec[CFG.NODE])?rec[CFG.NODE]:{};
    var next=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliser(o);});
    next.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
    if(signature(next)===signature(M))return;
    M=next;fixSel();renderAll();
  }).catch(function(){});
}

/* ===================== INIT / MONTAGE ===================== */
function initApp(){
  var edit=$("#tdlm-edit");
  if(edit){edit.href=CFG.EDIT_URL||"#";if(isStaff())edit.classList.add("on");}
  whenEco(function(){loadData();startAutoRefresh();});
}

var mounted=false;
function boot(){
  if(mounted)return true;
  var bg=document.querySelector(".tdlm-bg");
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
