/* THE DROWNED LANDS — TABLEAU DES TÂCHES (FAISEUSES D'ANGES) · JS
   Moulé sur rep-mis-marin-v1.js dont il réutilise INTÉGRALEMENT le CSS
   (classes tdlm-). Dépend de window.EcoCore. Données : taches_faiseuses/{id}.
   Deux origines :
   - "faveur"   : née d'une demande boutique validée par le staff (quai-staff).
                  Naît en_vote ; seules les Faiseuses, le staff et le demandeur
                  la voient. 3 voix identiques tranchent. Reste PRIVÉE : aucun
                  appel à volontaires, une Faiseuse s'en charge.
   - "faiseuse" : ouverte ici par une Faiseuse. Naît en_attente, publique.
                  7 j pour les volontaires (ouverts à tous) ; seule une Faiseuse
                  peut prendre la tête. 7 j sans chef → refus automatique.
   Aucun argent. Seul gain possible : un contact ajouté au réseau des Faiseuses
   à la validation staff (lien reseau_faiseuses, lu par le bottin). */
(function(){
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  NODE: "taches_faiseuses",
  NODE_DOSSIERS: "dossiers_main",   
  NODE_MEMBRES: "membres",
  BANDE: "faiseuses",
  EDIT_URL: "https://thedrownedlands.forumactif.com/post?p=468&mode=editpost" /* [MAJ] sujet porteur */
};
var QUORUM = 3;                  /* voix identiques pour trancher un vote */
var DELAI_REFUS = 7 * 86400000;  /* 7 j sans chef → refus auto (origine faiseuse) */

var STATUTS = {
  en_vote:       {label:"Au vote",       c:"var(--gr4-color)"},
  en_attente:    {label:"En attente",    c:"var(--gr3-color)"},
  acceptee:      {label:"Acceptée",      c:"var(--gr1-color)"},
  en_validation: {label:"En validation", c:"var(--gr5-color)"},
  terminee:      {label:"Terminée",      c:"var(--gr2-color)"},
  reportee:      {label:"Reportée",      c:"var(--clair2)"},
  refusee:       {label:"Refusée",       c:"var(--gr6-color)"}
};
var CATS = {
  faveur:    {label:"Faveur demandée", ic:"fi-tr-comments-question",
              amorce:"Une demande venue de l\u2019extérieur. Le réseau peut-il y répondre ?"},
  contact:   {label:"Besoin d\u2019un nouveau contact", ic:"fi-tr-address-book",
              amorce:"Notre contact habituel n\u2019est plus disponible. Il nous faut trouver une autre personne capable de nous aider."},
  service:   {label:"Un service à rendre", ic:"fi-tr-hands-heart",
              amorce:"Une personne de notre réseau nous demande un coup de main. Qui peut s\u2019en charger ?"},
  situation: {label:"Une situation délicate", ic:"fi-tr-triangle-warning",
              amorce:"Quelque chose complique actuellement notre activité. Nous cherchons quelqu\u2019un pour nous aider à trouver une solution."}
};
var VOTES = {accepter:"Accepter", reporter:"Reporter", refuser:"Refuser"};
var DISPO = {disponible:"Disponible", ponctuel:"Ponctuel", indisponible:"Indisponible"};
   /* Le deal avec la Main : elles donnent le silence, la Main donne la protection.
   Un signalement n'est pas une quête — c'est un appel au protecteur. Elles
   fournissent ce qu'elles savent, jamais la solution : à la Main d'enquêter. */
var CERTITUDE = {certitude:"Certitude — quelqu\u2019un sait que nous existons",
                 indices:"Faisceau d\u2019indices — plusieurs choses concordent",
                 soupcon:"Simple soupçon — une impression, rien de plus"};
var ALERTE = {
  intro:"La Main nous protège tant que nous nous taisons, et tant que les autres se taisent sur nous. Quand ce n\u2019est plus le cas, on l\u2019appelle. On lui donne ce qu\u2019on sait \u2014 pas ce qu\u2019on croit deviner, et surtout pas ce qu\u2019elle devrait faire.",
  garde:"Nommer quelqu\u2019un ici ne l\u2019accuse de rien. La Main décidera si la menace est réelle, et d\u2019où elle vient. Nous pouvons nous tromper.",
  fait:"Le dossier part au tableau des dettes de la Main. Vous seule et eux le verrez. Ils vous répondront par ce tableau."
};

/* ===================== UTILS ===================== */
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escAttr(s){return String(s==null?"":s).replace(/"/g,"&quot;");}
function versTableau(v){return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]);}
function newId(){return "t"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function nbJours(iso){var t=new Date(iso).getTime();if(isNaN(t))return null;return Math.floor((Date.now()-t)/86400000);}
function ilya(iso){var d=nbJours(iso);if(d==null)return"—";return d<=0?"aujourd'hui":("il y a "+d+" j");}
function reste(iso){var t=new Date(iso).getTime();if(isNaN(t))return null;return Math.ceil((t+DELAI_REFUS-Date.now())/86400000);}
function catLabel(k){return (CATS[k]&&CATS[k].label)||k;}
function catIcon(k){return (CATS[k]&&CATS[k].ic)||"fi-tr-clipboard-list";}

function isStaff(){try{return typeof _userdata!=="undefined"&&(_userdata.user_level===1||_userdata.user_level===2);}catch(e){return false;}}
function estConnecte(){try{return typeof _userdata!=="undefined"&&parseInt(_userdata.user_id,10)>0;}catch(e){return false;}}
function myPseudo(){try{if(typeof _userdata!=="undefined"&&_userdata.username)return String(_userdata.username).trim();}catch(e){}return null;}

/* ===================== DONNÉES ===================== */
var T = [];        /* tâches en mémoire */
var MEMBRES = {};  /* snapshot membres (appartenance de bande) */

function estFaiseuse(pseudo){
  if(!pseudo)return false;
  var m=MEMBRES[pseudo];
  return !!(m&&m.hors_la_loi&&m.hors_la_loi.bande===CFG.BANDE);
}
function nbFaiseuses(){var n=0;Object.keys(MEMBRES).forEach(function(p){if(estFaiseuse(p))n++;});return n;}
/* le staff ne vote qu'en renfort, quand la bande est trop clairsemée pour le quorum */
function peutVoter(){var me=myPseudo();return estFaiseuse(me)||(isStaff()&&nbFaiseuses()<QUORUM);}

function normaliser(o){
  o.titre=o.titre||"Tâche";
  o.origine=(o.origine==="faveur")?"faveur":"faiseuse";
  o.categorie=CATS[o.categorie]?o.categorie:(o.origine==="faveur"?"faveur":"contact");
  o.statut=STATUTS[o.statut]?o.statut:(o.origine==="faveur"?"en_vote":"en_attente");
  o.demandeur=o.demandeur||null;
  o.demande=o.demande||""; o.don=o.don||""; o.versRp=!!o.versRp;
  o.contexte=o.contexte||""; o.objectif=o.objectif||"";
  o.contraintes=versTableau(o.contraintes);
  o.votes=(o.votes&&typeof o.votes==="object")?o.votes:{};
  o.chef=o.chef||null;
  o.participants=versTableau(o.participants);
  o.sujet=o.sujet||""; o.resume=o.resume||""; o.consequences=o.consequences||"";
  o.contactPropose=(o.contactPropose&&o.contactPropose.pseudo)?o.contactPropose:null;
  o.contactInscrit=!!o.contactInscrit;
  o.demandeValidation=!!o.demandeValidation;
  o.cree=o.cree||new Date().toISOString();
  o.ouverte=o.ouverte||o.cree;
  o.expire=!!o.expire;
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
function parId(id){for(var i=0;i<T.length;i++){if(T[i].id===id)return T[i];}return null;}

/* ===================== ÉTAT ===================== */
var S = {statut:"tous", sel:null, mob:"liste", drawer:null, inline:null, creation:false, alerte:false};
function $(s,ctx){return (ctx||document).querySelector(s);}
function av(n){return '<span class="tdlm-avatar">'+esc(String(n||"?").replace(/[@.\s]/g,"").slice(0,2).toUpperCase())+'</span>';}

/* ===================== VISIBILITÉ / FILTRAGE ===================== */
/* une tâche au vote ne sort pas du cercle : Faiseuses, staff, et le demandeur
   (qui n'en verra que le statut, jamais le détail des voix). */
function visible(m){
  if(m.statut!=="en_vote")return true;
  var me=myPseudo();
  return isStaff()||estFaiseuse(me)||(!!me&&me===m.demandeur);
}
function aDesDemandes(m){return m.demandeValidation||m.statut==="en_vote";}
function filtre(){return T.filter(function(m){
  if(!visible(m))return false;
  if(S.statut==="demandes")return aDesDemandes(m);
  return S.statut==="tous"||m.statut===S.statut;
});}
function fixSel(){var d=filtre();var ok=false;d.forEach(function(m){if(m.id===S.sel)ok=true;});if(!ok)S.sel=d[0]?d[0].id:null;}

/* ===================== FILTRES STATUT ===================== */
function renderStatutFilters(){
  var vis=T.filter(visible);
  var chips=[{id:"tous",label:"Toutes",c:"var(--cntr)"}];
  Object.keys(STATUTS).forEach(function(id){chips.push({id:id,label:STATUTS[id].label,c:STATUTS[id].c});});
  var html=chips.map(function(s){
    var n=s.id==="tous"?vis.length:vis.filter(function(m){return m.statut===s.id;}).length;
    return '<button class="tdlm-stf" data-st="'+s.id+'" aria-pressed="'+(s.id===S.statut)+'" style="--sc:'+s.c+'"><span class="tdlm-fdot"></span>'+s.label+' <b>'+n+'</b></button>';
  }).join("");
  if(isStaff()||estFaiseuse(myPseudo())){
    var nd=vis.filter(aDesDemandes).length;
    html+='<button class="tdlm-stf tdlm-req-chip" data-st="demandes" aria-pressed="'+(S.statut==="demandes")+'">⚑ À traiter <b>'+nd+'</b></button>';
  }
  var el=$("#tdlf-stf");
  if(el){el.innerHTML=html;el.querySelectorAll(".tdlm-stf").forEach(function(b){b.onclick=function(){S.statut=b.getAttribute("data-st");fixSel();renderStage();renderStatutFilters();};});}
}

/* ===================== RENDER ===================== */
function stamp(m){var v=STATUTS[m.statut];return '<span class="tdlm-stamp" style="--sc:'+v.c+'">'+v.label+'</span>';}

var _lastSel=null;
function renderAll(){renderStatutFilters();renderStage();}
function loading(msg){var el=$("#tdlf-stage");if(el)el.innerHTML='<div class="tdlm-empty">'+esc(msg||"Chargement…")+'</div>';}

function renderStage(){
  var el=$("#tdlf-stage"); if(!el)return;
  var pl=el.querySelector(".tdlm-dlist-rows"); var scl=pl?pl.scrollTop:0;
  var pb=el.querySelector(".tdlm-dp-body"); var scb=pb?pb.scrollTop:0;
  var same=(_lastSel===S.sel);
  el.innerHTML=S.alerte?formAlerte():(S.creation?formCreation():viewDossier());
  var nl=el.querySelector(".tdlm-dlist-rows"); if(nl)nl.scrollTop=scl;
  if(same){var nb=el.querySelector(".tdlm-dp-body"); if(nb)nb.scrollTop=scb;}
  _lastSel=S.sel;
  brancher();
}

function viewDossier(){
  var d=filtre();
  var rows = d.length ? d.map(function(m){
    var tags="";
    if(m.statut==="en_vote")tags+='<span class="tdlm-req">⚑ vote</span>';
    if(m.origine==="faveur")tags+='<span class="tdlm-req" style="background:var(--gr4-color)">privée</span>';
    if(m.demandeValidation)tags+='<span class="tdlm-req">⚑ validation</span>';
    var sub=catLabel(m.categorie)+(m.demandeur?' · '+m.demandeur:'');
    return '<div class="tdlm-drow" data-sel="'+m.id+'" aria-current="'+(m.id===S.sel)+'">'
      +'<span class="tdlm-ddot" style="--sc:'+STATUTS[m.statut].c+'"></span>'
      +'<div style="min-width:0">'
        +'<div class="tdlm-drow-head"><span class="tdlm-type">'+esc(m.titre)+'</span></div>'
        +'<div class="tdlm-drow-sub">'+esc(sub)+'</div>'
        +(tags?'<div class="tdlm-drow-tags">'+tags+'</div>':'')
      +'</div>'
      +'<div class="tdlm-drow-right">'+(m.chef?av(m.chef):'')+'<div class="tdlm-posted">ouverte '+ilya(m.cree)+'</div></div>'
    +'</div>';
  }).join("") : '<div class="tdlm-empty">Aucune tâche pour ce filtre.</div>';
  var sel=parId(S.sel)||d[0];
  return '<div class="tdlm-dossier'+(S.mob==="detail"?" detail":"")+'">'
    +'<div class="tdlm-dlist"><div class="tdlm-dlist-rows">'+rows+'</div></div>'
    +'<div class="tdlm-dpanel">'+(sel?panel(sel):'<div class="tdlm-empty">—</div>')+'</div></div>';
}

/* ---- bloc de vote (Faiseuses + staff en renfort) ---- */
function voteBox(m){
  if(m.statut!=="en_vote")return "";
  var me=myPseudo(), vote=peutVoter();
  if(!vote&&!isStaff()){
    return '<div class="tdlm-negobox"><p class="tdlm-hsec">Demande soumise au réseau</p>'
      +'<div class="tdlm-negorow"><span>Les Faiseuses examinent la demande. Vous serez informé·e de leur décision.</span></div></div>';
  }
  var c={accepter:0,reporter:0,refuser:0};
  Object.keys(m.votes).forEach(function(p){if(c[m.votes[p]]!=null)c[m.votes[p]]++;});
  var compte=Object.keys(VOTES).map(function(k){return VOTES[k]+' <b>'+c[k]+'</b>';}).join(" · ");
  var mien=me?m.votes[me]:null;
  var btns=vote?Object.keys(VOTES).map(function(k){
    return '<button class="tdlm-abtn'+(mien===k?" prim":"")+'" data-act="vote-'+k+'">'+VOTES[k]+'</button>';
  }).join(""):"";
  var trancher=isStaff()?'<button class="tdlm-abtn warn" data-act="trancher">Trancher (staff)</button>':"";
  return '<div class="tdlm-negobox"><p class="tdlm-hsec">Décision du réseau — '+QUORUM+' voix identiques</p>'
    +'<div class="tdlm-negorow"><span>'+compte+(mien?' <span class="tdlm-todo">(votre voix : '+VOTES[mien]+')</span>':'')+'</span>'
    +'<span class="tdlm-negoact">'+btns+trancher+'</span></div></div>';
}

function panel(m){
  var me=myPseudo(), staff=isStaff(), cat=CATS[m.categorie]||{};

  var meta='<div class="tdlm-dp-meta">'
    +'<div class="tdlm-m"><span class="tdlm-k">Nature</span><span class="tdlm-v"><i class="fi '+catIcon(m.categorie)+'"></i>'+esc(catLabel(m.categorie))+'</span></div>'
    +(m.demandeur?'<div class="tdlm-m"><span class="tdlm-k">Demandeur</span><span class="tdlm-v">'+esc(m.demandeur)+'</span></div>':'')
    +'<div class="tdlm-m"><span class="tdlm-k">Chef de tâche</span><span class="tdlm-v">'+(m.chef?esc(m.chef):'<span class="tdlm-todo">à désigner</span>')+'</span></div>'
    +(m.origine==="faveur"?'<div class="tdlm-m"><span class="tdlm-k">Traitement</span><span class="tdlm-v">'+(m.versRp?"à jouer en RP":"en coulisses")+'</span></div>':'')
    +(m.sujet?'<div class="tdlm-m"><span class="tdlm-k">Sujet RP</span><span class="tdlm-v"><a class="tdlm-lien" href="'+escAttr(m.sujet)+'" target="_blank" rel="noopener">Ouvrir le sujet →</a></span></div>':'')
    +'</div>';

  /* compte à rebours des volontaires */
  var delai="";
  if(m.origine==="faiseuse"&&m.statut==="en_attente"&&!m.chef){
    var r=reste(m.ouverte);
    delai='<div class="tdlm-reqbanner"><p class="tdlm-hsec">Appel aux volontaires</p><div class="tdlm-reqrow"><span>'
      +(r>0?('Encore <b>'+r+' jour'+(r>1?'s':'')+'</b> pour qu\u2019une Faiseuse prenne la tête de cette tâche.'):'Délai dépassé — la tâche va être close.')
      +'</span></div></div>';
  }

  /* corps : demande d'origine ou termes rédigés */
  var corps="";
  if(m.origine==="faveur"){
    corps+='<div class="tdlm-sec"><p class="tdlm-hsec">Demande</p><div class="tdlm-prose">'+(m.demande?esc(m.demande):'<span class="tdlm-todo">—</span>')+'</div></div>';
    if(m.don)corps+='<div class="tdlm-sec"><p class="tdlm-hsec">Don proposé en remerciement</p><div class="tdlm-prose">'+esc(m.don)+'</div></div>';
  }else{
    corps+='<div class="tdlm-sec"><p class="tdlm-hsec">Objectif</p><div class="tdlm-prose">'+(m.objectif?esc(m.objectif):'<span class="tdlm-todo">—</span>')+'</div></div>';
  }
  if(m.contexte)corps+='<div class="tdlm-sec"><p class="tdlm-hsec">Contexte</p><div class="tdlm-prose">'+esc(m.contexte)+'</div></div>';
  if(m.contraintes.length)corps+='<div class="tdlm-sec"><p class="tdlm-hsec">Contraintes</p><ul class="tdlm-clean">'
    +m.contraintes.map(function(x){return '<li class="tdlm-puce">'+esc(x)+'</li>';}).join("")+'</ul></div>';

  /* participants */
  var pub=(m.origine==="faiseuse");
  var pList=m.participants.length?m.participants.map(function(p){
    return '<div class="tdlm-person'+(p===m.chef?' chef':'')+'">'+av(p)+'<span class="tdlm-pname">'+esc(p)+'</span>'
      +(p===m.chef?'<span class="tdlm-r">chef de tâche</span>':'')+'</div>';
  }).join(""):'<p class="tdlm-todo" style="margin:0">'+(pub?'Personne d\u2019inscrit pour l\u2019instant.':'Aucune Faiseuse ne s\u2019en est encore chargée.')+'</p>';
  var ouvert=(m.statut==="en_attente"||m.statut==="acceptee");
  var peutRejoindre=ouvert&&estConnecte()&&m.participants.indexOf(me)<0&&(pub||estFaiseuse(me));
  var joinBtn=peutRejoindre?'<button class="tdlm-abtn prim" data-act="join">'+(estFaiseuse(me)&&!m.chef?"Je prends la tête":"Je participe")+'</button>':'';
  var cadre=(m.statut==="en_vote")?"":'<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Participants</span>'+joinBtn+'</div>'+pList+'</div>';

  /* bilan */
  var bilan="";
  if(m.resume||m.consequences||m.statut==="en_validation"||m.statut==="terminee"){
    bilan='<div class="tdlm-sec"><p class="tdlm-hsec">Résumé</p><div class="tdlm-prose">'+(m.resume?esc(m.resume):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Conséquences</p><div class="tdlm-prose">'+(m.consequences?esc(m.consequences):'<span class="tdlm-todo">—</span>')+'</div></div>';
  }

  /* contact issu de la tâche */
  var contact="";
  if(m.contactPropose){
    var cp=m.contactPropose;
    contact='<div class="tdlm-reqbanner"><p class="tdlm-hsec">'+(m.contactInscrit?'Contact inscrit au réseau':'Contact proposé au réseau')+'</p>'
      +'<div class="tdlm-reqrow"><span><b>'+esc(cp.pseudo)+'</b>'+(cp.activite?' — '+esc(cp.activite):'')+' · '+esc(cp.apport||'—')+' <span class="tdlm-todo">('+esc(DISPO[cp.statut]||cp.statut||'—')+')</span></span></div></div>';
  }

  var banner="";
  if(staff&&m.demandeValidation){
    banner='<div class="tdlm-reqbanner"><p class="tdlm-hsec">⚑ Le chef demande la validation</p>'
      +'<div class="tdlm-reqrow"><span>Relis le bilan, puis valide pour clore la tâche'+(m.contactPropose&&!m.contactInscrit?' et inscrire le contact au réseau.':'.')+'</span></div></div>';
  }

  return '<button class="tdlm-dret" data-back="1">‹ Retour</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">'+esc(m.titre)+'</span>'+stamp(m)+'</div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-dp-hd">'+meta+banner+delai+voteBox(m)+contact+'</div>'
    +corps+cadre+bilan+drawer(m)+'</div>'
    +actionbar(m);
}

function actionbar(m){
  var me=myPseudo(), staff=isStaff(), chef=(me&&me===m.chef), label, btns="";
  if(staff){
    label="Staff";
    if(m.statut==="en_validation")btns+='<button class="tdlm-abtn prim" data-act="valider">Valider la tâche</button>';
    btns+='<button class="tdlm-abtn" data-act="edit">Modifier les termes</button>';
    if(m.statut!=="terminee"&&m.statut!=="refusee")btns+='<button class="tdlm-abtn warn" data-act="refuser">Classer sans suite</button>';
    btns+='<button class="tdlm-abtn warn" data-act="delete">Supprimer</button>';
  }else if(chef&&(m.statut==="acceptee"||m.statut==="en_validation")){
    label="Chef de tâche";
    btns+='<button class="tdlm-abtn" data-act="sujet">'+(m.sujet?"Modifier le sujet RP":"Renseigner le sujet RP")+'</button>';
    btns+='<button class="tdlm-abtn prim" data-act="bilan">'+(m.statut==="en_validation"?"Modifier le bilan":"Bilan &amp; validation")+'</button>';
  }else if(estFaiseuse(me)&&m.statut==="reportee"){
    label="Faiseuse d\u2019Anges";
    btns+='<button class="tdlm-abtn prim" data-act="rouvrir">Rouvrir le vote</button>';
  }else if(estFaiseuse(me)){
    label="Faiseuse d\u2019Anges";
    btns='<span class="tdlm-idle">'+(m.statut==="en_vote"?"Votez ci-dessus.":"Rien à faire pour l\u2019instant.")+'</span>';
  }else if(me&&me===m.demandeur){
    label="Demandeur";
    btns='<span class="tdlm-idle">'+(m.statut==="en_vote"?"Demande en cours d\u2019examen.":"Décision du réseau : "+STATUTS[m.statut].label.toLowerCase()+".")+'</span>';
  }else if(!estConnecte()){
    label="Invité"; btns='<span class="tdlm-idle">Connectez-vous pour interagir.</span>';
  }else{
    label="Visiteur"; btns='<span class="tdlm-idle">Table consultable — les tâches ouvertes acceptent tous les volontaires.</span>';
  }
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+label+'</span>'+btns+'</div>';
}

/* ---- drawers ---- */
function drawer(m){
  if(S.inline==="sujet"){
    return '<div class="tdlm-drawer on"><h4>Sujet RP de la tâche</h4>'
      +'<input type="text" id="tdlf-sujet" value="'+escAttr(m.sujet)+'" placeholder="https://thedrownedlands.forumactif.com/t...">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="sujetok">Enregistrer</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="bilan"){
    var cp=m.contactPropose||{};
    var opts=Object.keys(DISPO).map(function(k){return '<option value="'+k+'"'+(k===cp.statut?' selected':'')+'>'+DISPO[k]+'</option>';}).join("");
    return '<div class="tdlm-drawer on"><h4>Bilan de la tâche</h4>'
      +'<label class="tdlm-fl">Résumé</label><textarea id="tdlf-bresume">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Conséquences</label><textarea id="tdlf-bconseq">'+esc(m.consequences)+'</textarea>'
      +'<h4 style="margin-top:14px">Contact à intégrer au réseau (facultatif)</h4>'
      +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Pseudo</label><input type="text" id="tdlf-cps" value="'+escAttr(cp.pseudo||"")+'"></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Activité</label><input type="text" id="tdlf-cact" value="'+escAttr(cp.activite||"")+'"></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Disponibilité</label><select id="tdlf-cdisp">'+opts+'</select></div></div>'
      +'<label class="tdlm-fl">Ce qu\u2019il apporte</label><input type="text" id="tdlf-capp" value="'+escAttr(cp.apport||"")+'">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="bilanok">'+(m.statut==="en_validation"?"Enregistrer":"Envoyer en validation")+'</button>'
      +(m.statut!=="en_validation"?'<button class="tdlm-abtn" data-do="bilansave">Enregistrer sans envoyer</button>':'')
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="edit"){
    var co=Object.keys(CATS).map(function(k){return '<option value="'+k+'"'+(k===m.categorie?' selected':'')+'>'+CATS[k].label+'</option>';}).join("");
    return '<div class="tdlm-drawer on"><h4>Modifier les termes (staff)</h4>'
      +'<label class="tdlm-fl">Titre</label><input type="text" id="tdlf-etitre" value="'+escAttr(m.titre)+'">'
      +'<label class="tdlm-fl">Nature</label><select id="tdlf-ecat">'+co+'</select>'
      +'<label class="tdlm-fl">Objectif</label><textarea id="tdlf-eobj">'+esc(m.objectif)+'</textarea>'
      +'<label class="tdlm-fl">Contraintes (une par ligne)</label><textarea id="tdlf-econtr">'+esc(m.contraintes.join("\n"))+'</textarea>'
      +'<label class="tdlm-fl">Contexte</label><textarea id="tdlf-ectx">'+esc(m.contexte)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="editok">Enregistrer</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

/* ---- formulaire d'ouverture (Faiseuses) ---- */
function formCreation(){
  var keys=["contact","service","situation"];
  var opts=keys.map(function(k){return '<option value="'+k+'">'+CATS[k].label+'</option>';}).join("");
  var amorces=keys.map(function(k){return '<li class="tdlm-puce"><b>'+CATS[k].label+'</b> — '+esc(CATS[k].amorce)+'</li>';}).join("");
  return '<div class="tdlm-dpanel"><div class="tdlm-dp-title"><span class="tdlm-type">Ouvrir une tâche</span></div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-sec"><p class="tdlm-hsec">Trois façons d\u2019entrer en jeu</p>'
    +'<ul class="tdlm-clean">'+amorces+'</ul></div>'
    +'<div class="tdlm-drawer on" style="margin:0 24px 20px">'
    +'<label class="tdlm-fl">Nature</label><select id="tdlf-ncat">'+opts+'</select>'
    +'<label class="tdlm-fl">Titre</label><input type="text" id="tdlf-ntitre" placeholder="Ce que voient les autres en un coup d\u2019\u0153il">'
    +'<label class="tdlm-fl">Contexte</label><textarea id="tdlf-nctx" placeholder="Ce qui a amené cette situation\u2026"></textarea>'
    +'<label class="tdlm-fl">Objectif</label><textarea id="tdlf-nobj" placeholder="Ce qu\u2019il faut obtenir, trouver ou régler\u2026"></textarea>'
    +'<label class="tdlm-fl">Contraintes (une par ligne)</label><textarea id="tdlf-ncontr" placeholder="Discrétion absolue&#10;Avant la fin de la semaine"></textarea>'
    +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="newok">Ouvrir la tâche</button><button class="tdlm-abtn" data-do="newcancel">Annuler</button></div></div></div></div>';
}
   
   /* ---- signalement à la Main (canal d'urgence) ---- */
function formAlerte(){
  var opts=Object.keys(CERTITUDE).map(function(k){
    return '<option value="'+k+'">'+CERTITUDE[k]+'</option>';
  }).join("");
  return '<div class="tdlm-dpanel"><div class="tdlm-dp-title"><span class="tdlm-type">Le silence a été rompu</span></div>'
    +'<div class="tdlm-dp-body">'
    +'<div class="tdlm-sec"><p class="tdlm-hsec">Appeler la Main de la Providence</p>'
    +'<div class="tdlm-prose">'+esc(ALERTE.intro)+'</div></div>'
    +'<div class="tdlm-drawer on" style="margin:0 24px 20px">'
    +'<label class="tdlm-fl">En une ligne</label>'
    +'<input type="text" id="tdlf-atitre" placeholder="Ce qui arrive, dit le plus simplement possible">'
    +'<label class="tdlm-fl">Degré de certitude</label><select id="tdlf-acert">'+opts+'</select>'
    +'<label class="tdlm-fl">Ce que nous savons</label>'
    +'<textarea id="tdlf-asait" placeholder="Les faits, dans l\u2019ordre où vous les avez appris. Qui a dit quoi, à qui, quand\u2026"></textarea>'
    +'<label class="tdlm-fl">Personnes évoquées (facultatif)</label>'
    +'<input type="text" id="tdlf-aevoq" placeholder="Des noms qui reviennent, sans certitude">'
    +'<div class="tdlm-todo" style="margin:6px 0 10px">'+esc(ALERTE.garde)+'</div>'
    +'<label class="tdlm-fl">Ce qui est en jeu pour nous</label>'
    +'<textarea id="tdlf-aenjeu" placeholder="Ce que nous risquons si rien n\u2019est fait\u2026"></textarea>'
    +'<div class="tdlm-todo" style="margin:6px 0 0">'+esc(ALERTE.fait)+'</div>'
    +'<div class="tdlm-row"><button class="tdlm-abtn warn" data-do="alerteok">Transmettre à la Main</button>'
    +'<button class="tdlm-abtn" data-do="alertecancel">Annuler</button></div></div></div></div>';
}

/* ===================== ÉVÉNEMENTS ===================== */
function toast(msg){var t=document.createElement("div");t.className="tdlm-toast";t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.style.transition="opacity .4s";t.style.opacity="0";setTimeout(function(){t.remove();},400);},3600);}

function brancher(){
  var stage=$("#tdlf-stage"); if(!stage)return;
  stage.querySelectorAll("[data-sel]").forEach(function(el){el.onclick=function(){S.sel=el.getAttribute("data-sel");S.drawer=null;S.inline=null;S.mob="detail";renderStage();};});
  var back=stage.querySelector("[data-back]"); if(back)back.onclick=function(){S.mob="liste";renderStage();};
  stage.querySelectorAll("[data-act]").forEach(function(el){el.onclick=function(){act(el.getAttribute("data-act"));};});
  stage.querySelectorAll("[data-do]").forEach(function(el){el.onclick=function(){doo(el.getAttribute("data-do"));};});
}

function act(k){
  var m=parId(S.sel); if(!m&&k.indexOf("vote-")!==0)return;
  var me=myPseudo();
  if(k.indexOf("vote-")===0){voter(m,k.slice(5));return;}
  if(k==="trancher"){trancher(m);return;}
  if(k==="join"){
    if(!estConnecte()){toast("Connectez-vous pour participer.");return;}
    if(m.statut!=="en_attente"&&m.statut!=="acceptee"){toast("Tâche fermée à l\u2019inscription.");return;}
    if(m.origine==="faveur"&&!estFaiseuse(me)){toast("Cette faveur reste entre les mains du réseau.");return;}
    if(m.participants.indexOf(me)>=0){toast("Déjà inscrit·e.");return;}
    m.participants.push(me);
    var champs={participants:m.participants};
    if(!m.chef&&estFaiseuse(me)){m.chef=me;m.statut="acceptee";champs.chef=me;champs.statut="acceptee";}
    patch(m,champs);
    toast(m.chef===me?"Vous êtes chef de tâche.":"Inscrit·e — une Faiseuse doit encore prendre la tête.");
    renderAll();return;
  }
  if(k==="rouvrir"){
    if(!estFaiseuse(me)&&!isStaff()){toast("Réservé aux Faiseuses.");return;}
    m.statut="en_vote";m.votes={};m.ouverte=new Date().toISOString();
    patch(m,{statut:"en_vote",votes:{},ouverte:m.ouverte});
    toast("Vote rouvert.");renderAll();return;
  }
  if(k==="sujet"){S.inline=S.inline==="sujet"?null:"sujet";S.drawer=null;renderStage();return;}
  if(k==="bilan"){S.drawer=S.drawer==="bilan"?null:"bilan";S.inline=null;renderStage();return;}
  if(k==="edit"){S.drawer=S.drawer==="edit"?null:"edit";S.inline=null;renderStage();return;}
  if(k==="valider"){valider(m);return;}
  if(k==="refuser"){classer(m);return;}
  if(k==="delete"){supprimer(m);return;}
}

function doo(k){
  if(k==="alertecancel"){S.alerte=false;renderStage();return;}
  if(k==="alerteok"){alerter();return;}
  if(k==="newcancel"){S.creation=false;renderStage();return;}
  if(k==="newok"){creer();return;}
  var m=parId(S.sel); if(!m)return;
  if(k==="cancel"){S.drawer=null;S.inline=null;renderStage();return;}
  if(k==="sujetok"){
    var u=(($("#tdlf-sujet")||{}).value||"").trim();
    m.sujet=u;patch(m,{sujet:u});S.inline=null;
    toast(u?"Sujet RP enregistré.":"Sujet RP retiré.");renderStage();return;
  }
  if(k==="bilanok"||k==="bilansave"){
    m.resume=(($("#tdlf-bresume")||{}).value||"").trim();
    m.consequences=(($("#tdlf-bconseq")||{}).value||"").trim();
    var cps=(($("#tdlf-cps")||{}).value||"").trim();
    m.contactPropose=cps?{pseudo:cps,activite:(($("#tdlf-cact")||{}).value||"").trim(),
      apport:(($("#tdlf-capp")||{}).value||"").trim(),statut:(($("#tdlf-cdisp")||{}).value||"disponible")}:null;
    var champs={resume:m.resume,consequences:m.consequences,contactPropose:m.contactPropose};
    if(k==="bilanok"&&m.statut!=="en_validation"){
      if(!m.resume){toast("Renseigne au moins le résumé.");return;}
      m.statut="en_validation";m.demandeValidation=true;
      champs.statut="en_validation";champs.demandeValidation=true;
    }
    patch(m,champs);S.drawer=null;
    toast(champs.statut==="en_validation"?"Tâche envoyée en validation.":"Bilan enregistré.");
    renderAll();return;
  }
  if(k==="editok"){
    m.titre=(($("#tdlf-etitre")||{}).value||"").trim()||m.titre;
    var rc=$("#tdlf-ecat"); if(rc)m.categorie=rc.value;
    m.objectif=(($("#tdlf-eobj")||{}).value||"").trim();
    m.contraintes=(($("#tdlf-econtr")||{}).value||"").split("\n").map(function(x){return x.trim();}).filter(Boolean);
    m.contexte=(($("#tdlf-ectx")||{}).value||"").trim();
    patch(m,{titre:m.titre,categorie:m.categorie,objectif:m.objectif,contraintes:m.contraintes,contexte:m.contexte});
    S.drawer=null;toast("Termes enregistrés.");renderAll();return;
  }
}

/* ===================== VOTE ===================== */
function voter(m, choix){
  if(!VOTES[choix])return;
  var me=myPseudo();
  if(!me){toast("Connectez-vous pour voter.");return;}
  if(!peutVoter()){toast("Le vote est réservé aux Faiseuses.");return;}
  if(m.statut!=="en_vote"){toast("Le vote est clos.");return;}
  m.votes[me]=choix;patch(m,{votes:m.votes});
  var c={accepter:0,reporter:0,refuser:0},gagnant=null;
  Object.keys(m.votes).forEach(function(p){if(c[m.votes[p]]!=null)c[m.votes[p]]++;});
  Object.keys(c).forEach(function(kk){if(c[kk]>=QUORUM)gagnant=kk;});
  if(gagnant){appliquer(m,gagnant);toast("Quorum atteint — "+VOTES[gagnant].toLowerCase()+".");}
  else toast("Voix enregistrée.");
  renderAll();
}
function trancher(m){
  var choix=window.prompt("Décision du staff — tapez : accepter, reporter ou refuser.","accepter");
  if(!choix)return; choix=String(choix).trim().toLowerCase();
  if(!VOTES[choix]){toast("Décision inconnue.");return;}
  appliquer(m,choix);toast("Décision appliquée par le staff.");renderAll();
}
function appliquer(m, choix){
  if(choix==="accepter"){m.statut="acceptee";m.ouverte=new Date().toISOString();patch(m,{statut:"acceptee",ouverte:m.ouverte});}
  else if(choix==="refuser"){m.statut="refusee";patch(m,{statut:"refusee"});}
  else {m.statut="reportee";patch(m,{statut:"reportee"});}
}

/* ===================== STAFF ===================== */
function ajouterLien(pseudo, lien){
  return Promise.resolve(window.EcoCore.safeReadBin()).then(function(r){
    var arr=versTableau(r&&r[CFG.NODE_MEMBRES]&&r[CFG.NODE_MEMBRES][pseudo]&&r[CFG.NODE_MEMBRES][pseudo].liens);
    arr.push(lien);
    return window.EcoCore.writeField(CFG.NODE_MEMBRES+"/"+encodeURIComponent(pseudo)+"/liens",arr);
  });
}
function valider(m){
  var cp=m.contactPropose;
  var msg="Valider et clore « "+m.titre+" » ?";
  if(cp&&!m.contactInscrit)msg+="\n"+cp.pseudo+" sera inscrit·e au réseau des Faiseuses.";
  if(!window.confirm(msg))return;
  var op=(cp&&!m.contactInscrit)
    ? ajouterLien(cp.pseudo,{type:"reseau_faiseuses",categorie:"faiseuses",role:cp.apport||"",activite:cp.activite||"",statut:cp.statut||"disponible"})
    : Promise.resolve();
  op.then(function(){
    m.statut="terminee";m.demandeValidation=false;if(cp)m.contactInscrit=true;
    patch(m,{statut:"terminee",demandeValidation:false,contactInscrit:!!cp});
    toast(cp?"Tâche close — contact inscrit au réseau.":"Tâche close.");renderAll();
  }).catch(function(){toast("Inscription du contact échouée — tâche non close.");});
}
function classer(m){
  if(!window.confirm("Classer « "+m.titre+" » sans suite ?"))return;
  m.statut="refusee";m.demandeValidation=false;
  patch(m,{statut:"refusee",demandeValidation:false});
  toast("Tâche classée sans suite.");renderAll();
}
function supprimer(m){
  if(!window.confirm("Supprimer définitivement « "+m.titre+" » ?"))return;
  var up={};up[CFG.NODE+"/"+m.id]=null;
  try{var p=window.EcoCore.firebaseUpdate(up);if(p&&p.catch)p.catch(function(){toast("Suppression Firebase échouée.");});}catch(e){toast("Suppression échouée.");}
  T=T.filter(function(x){return x!==m;});
  var d=filtre();S.sel=d[0]?d[0].id:null;S.drawer=null;S.inline=null;S.mob="liste";
  toast("Tâche supprimée.");renderAll();
}

/* ===================== CRÉATION ===================== */
function creer(){
  var me=myPseudo();
  if(!estFaiseuse(me)&&!isStaff()){toast("Réservé aux Faiseuses d\u2019Anges.");return;}
  var titre=(($("#tdlf-ntitre")||{}).value||"").trim();
  if(!titre){toast("Donne un titre à la tâche.");return;}
  var o={
    origine:"faiseuse", categorie:(($("#tdlf-ncat")||{}).value||"contact"),
    titre:titre, demandeur:null, demande:"", don:"", versRp:true,
    contexte:(($("#tdlf-nctx")||{}).value||"").trim(),
    objectif:(($("#tdlf-nobj")||{}).value||"").trim(),
    contraintes:(($("#tdlf-ncontr")||{}).value||"").split("\n").map(function(x){return x.trim();}).filter(Boolean),
    statut:"en_attente", votes:{}, chef:null, participants:[],
    sujet:"", resume:"", consequences:"", contactPropose:null, contactInscrit:false,
    demandeValidation:false, expire:false,
    cree:new Date().toISOString(), ouverte:new Date().toISOString()
  };
  var id=newId();
  _lastWrite=Date.now();
  Promise.resolve(window.EcoCore.writeField(CFG.NODE+"/"+id,o)).then(function(){
    o.id=id;T.unshift(normaliser(o));S.creation=false;S.sel=id;S.mob="detail";
    toast("Tâche ouverte — une semaine pour trouver des volontaires.");renderAll();
  }).catch(function(){toast("Ouverture échouée.");});
}

   /* Écrit directement dans dossiers_main : pas de vote, pas de quorum. Une seule
   Faiseuse suffit — c'est une urgence, pas une délibération. Le compteur
   d'appels, lui, est collectif : il se voit des deux côtés. */
function alerter(){
  var me=myPseudo();
  if(!estFaiseuse(me)&&!isStaff()){toast("Réservé aux Faiseuses d\u2019Anges.");return;}
  var titre=(($("#tdlf-atitre")||{}).value||"").trim();
  var sait=(($("#tdlf-asait")||{}).value||"").trim();
  if(!titre){toast("Résume la situation en une ligne.");return;}
  if(!sait){toast("Dis à la Main ce que vous savez — sans ça, elle ne peut rien commencer.");return;}
  if(!window.confirm("Transmettre ce signalement à la Main ?\nElle décidera seule de la suite."))return;

  var o={ type:"silence", origine:"faiseuses", titre:titre,
          doigt:null, demandeur:me, cible_type:"aucune", cible:"", protege:"les Faiseuses d\u2019Anges",
          accord:null, defaut:null, dette:null, montant:0,
          contexte:sait,
          objectif:(($("#tdlf-aenjeu")||{}).value||"").trim(),
          contraintes:[],
          certitude:(($("#tdlf-acert")||{}).value||"soupcon"),
          evoquees:(($("#tdlf-aevoq")||{}).value||"").trim(), urgence:"",
          statut:"ouvert", responsable:null, participants:[],
          sujet:"", resume:"", consequences:"", conclusion:null,
          demandeValidation:false, verse:false,
          cree:new Date().toISOString(), ouverte:new Date().toISOString(), clos:null };

  var id="d"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  Promise.resolve(window.EcoCore.writeField(CFG.NODE_DOSSIERS+"/"+id,o)).then(function(){
    S.alerte=false;renderStage();
    toast("Signalement transmis. Suivez-le au tableau des dettes de la Main.");
  }).catch(function(){toast("Transmission échouée — rien n\u2019a été envoyé.");});
}

/* ---- refus auto : 7 j sans chef (origine faiseuse uniquement) ---- */
function autoRefus(){
  var now=Date.now();
  T.forEach(function(m){
    if(m.origine!=="faiseuse"||m.statut!=="en_attente"||m.chef||m.expire)return;
    if(now-new Date(m.ouverte).getTime()<DELAI_REFUS)return;
    var path=CFG.NODE+"/"+encodeURIComponent(m.id)+"/expire";
    var pr;try{pr=window.EcoCore.firebaseTransaction(path,function(cur){if(cur===true)throw new Error("DEJA");return true;});}catch(e){return;}
    Promise.resolve(pr).then(function(){
      m.expire=true;m.statut="refusee";patch(m,{statut:"refusee"});renderAll();
    }).catch(function(e){
      if(e&&e.message==="DEJA"){m.expire=true;m.statut="refusee";patch(m,{statut:"refusee"});renderAll();}
    });
  });
}

/* ===================== CHARGEMENT ===================== */
function loadData(){
  loading("Chargement des tâches…");
  var pr;try{pr=window.EcoCore.safeReadBin();}catch(e){loading("EcoCore indisponible.");return;}
  Promise.resolve(pr).then(function(rec){
    MEMBRES=(rec&&rec[CFG.NODE_MEMBRES])||{};
    var raw=(rec&&rec[CFG.NODE])?rec[CFG.NODE]:{};
    T=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliser(o);});
    T.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
    autoRefus();fixSel();renderAll();
    if(!T.length)loading("Aucune tâche pour l\u2019instant.");
  }).catch(function(){loading("Impossible de charger les tâches.");});
}
function whenEco(cb){
  if(window.EcoCore&&window.EcoCore.safeReadBin){cb();return;}
  loading("Connexion à la base…");
  var n=0,iv=setInterval(function(){
    if(window.EcoCore&&window.EcoCore.safeReadBin){clearInterval(iv);cb();}
    else if(++n>80){clearInterval(iv);loading("EcoCore introuvable — vérifiez que le script économie est chargé.");}
  },125);
}

var REFRESH_MS=60000;
function signature(list){return list.map(function(o){return o.id+":"+JSON.stringify(serialize(o));}).sort().join("|");}
function tickRefresh(){
  if(!window.EcoCore||!window.EcoCore.safeReadBin)return;
  if(S.drawer||S.inline||S.creation)return;
  if(Date.now()-_lastWrite<5000)return;
  var ae=document.activeElement; if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))return;
  try{if(window.EcoCore.invalidateCache)window.EcoCore.invalidateCache();}catch(e){}
  var pr;try{pr=window.EcoCore.safeReadBin();}catch(e){return;}
  Promise.resolve(pr).then(function(rec){
    if(S.drawer||S.inline||S.creation||Date.now()-_lastWrite<5000)return;
    MEMBRES=(rec&&rec[CFG.NODE_MEMBRES])||MEMBRES;
    var raw=(rec&&rec[CFG.NODE])?rec[CFG.NODE]:{};
    var next=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliser(o);});
    next.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
    if(signature(next)===signature(T))return;
    T=next;fixSel();renderAll();
  }).catch(function(){});
}

/* ===================== INIT / MONTAGE ===================== */
function initApp(){
  var edit=$("#tdlf-edit");
  if(edit){edit.href=CFG.EDIT_URL||"#";if(isStaff())edit.classList.add("on");}
   var neuf=$("#tdlf-new");
  if(neuf){
    neuf.style.display="none";
    neuf.onclick=function(){S.alerte=false;S.creation=true;S.drawer=null;S.inline=null;renderStage();};
  }
  var alrt=$("#tdlf-alerte");
  if(alrt){
    alrt.style.display="none";
    alrt.onclick=function(){S.creation=false;S.alerte=true;S.drawer=null;S.inline=null;renderStage();};
  }
  whenEco(function(){
    loadData();
    setInterval(tickRefresh,REFRESH_MS);
    if(window.TDLPoll)window.TDLPoll.suivre({
      node: CFG.NODE,
      occupe: function(){ return !!(S.drawer||S.inline||S.creation)||Date.now()-_lastWrite<3000; },
      onDonnees: function(raw){
        T=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliser(o);});
        T.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
        autoRefus();fixSel();renderAll();
      }
    });
    setTimeout(function(){ /* les boutons n'apparaissent qu'une fois l'appartenance connue */
      var ok=estFaiseuse(myPseudo())||isStaff();
      if(neuf&&ok)neuf.style.display="";
      if(alrt&&ok)alrt.style.display="";
    },1200);
  });
}

var mounted=false;
function boot(){
  if(mounted)return true;
  var bg=document.querySelector(".tdlm-bg");
  if(!bg||!document.querySelector("#tdlf-stage"))return false;
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
