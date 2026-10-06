/* THE DROWNED LANDS — TABLEAU DES MISSIONS (MARINGOUINS) · JS
   Moulé sur eco-rep-enquete. Données : missions/{id}.
   Sentinelle : missions_rev/{id}. Création par la boutique
   (« mission de cellule ») ; ce panneau gère le cycle après.
   Appartenance : membres/{pseudo}.hors_la_loi.bande === "maringouins".
   Argent : prime débitée du PAYEUR à la création ; 7 j sans chef → refus auto
   + recrédit ; négociation → ajustement du delta ; validation staff → prime
   en parts égales aux participants + 50 $ bonus chef (fonds maison).

   [MAJ v4] CORRECTIF DE DÉBIT. crediterDollars plafonnait à zéro et servait
     aussi à prélever (accepterNego, quand la prime négociée monte) : sur un
     solde insuffisant, le payeur tombait à 0 et la différence était CRÉÉE.
     Les prélèvements passent désormais par EcoCore.debiterDollars, qui lève
     FONDS, et la prime affichée revient en arrière si le débit est refusé.

   [MAJ v3] VERROUS SUR LES VERSEMENTS — le correctif le plus important ici.
     valider(), refuserStaff() et retirer() se gardaient d'un double paiement
     en lisant un booléen (primeVersee, rembourse) dans l'instantané en
     mémoire, vieux de 15 à 60 s. Deux membres du staff validant la même
     mission dans cette fenêtre passaient tous DEUX le test : la prime était
     versée deux fois, sans erreur et sans trace. L'argent n'était prélevé
     nulle part — il était créé.
     autoRefus() faisait pourtant déjà la bonne chose : poser le drapeau dans
     une TRANSACTION, qui ne laisse passer qu'un seul client. Ce motif est
     désormais extrait dans verrou() et appliqué aux quatre chemins.
     COMPROMIS ASSUMÉ : le verrou est pris AVANT le versement. Si les crédits
     échouent ensuite, la mission reste marquée payée sans que personne ait
     touché son argent. Un double paiement est silencieux et fausse l'économie
     définitivement ; une mission bloquée est visible et le staff la débloque.

   [MAJ v3] PASSAGE AU SOCLE PARTAGÉ tdl-base.
     - plus aucun safeReadBin : missions (~2 ko) et la branche membres
       partagée (~3 ko) au lieu des 126 ko racine ;
     - tickRefresh à 60 s ET TDLPoll sur le nœud entier remplacés par une seule
       veille sentinelle à 15 s, plus une réconciliation toutes les 5 min ;
     - toute écriture passe par TDLBase et bumpe la sentinelle ; en cas d'échec
       elle part dans une file de réessai au lieu d'être perdue ;
     - avatars et membres viennent de l'index partagé du socle.

   [MAJ v3] SCHÉMA 2 — participants et valides deviennent des nœuds à clés
     (clé = pseudo assaini). Deux Maringouins qui cliquent « Je participe » en
     même temps ne s'écrasent plus. contraintes RESTE un tableau (textarea qui
     réécrit la liste entière), nego est un objet unique.

   Ordre de chargement : eco-core → tdl-base → ce fichier. */
(function(){
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  NODE: "missions",
  NODE_MEMBRES: "membres",
  EDIT_URL: "https://thedrownedlands.forumactif.com/post?p=467&mode=editpost" /* [MAJ] édition du sujet porteur */
};
var SCHEMA     = 2;                  /* version du schéma des missions      */
var VEILLE_MS  = 15000;              /* cadence de la veille sentinelle     */
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

/* ---- PLAN DE MIGRATION v1 → v2, lu par TDLBase.migrer() ----
   Un champ absent du plan est recopié tel quel : contraintes garde sa forme
   de tableau, nego son objet. */
var PLAN = {
  participants: {mode:"pseudo", conv:function(x){return x?String(x):null;}},
  valides:      {mode:"pseudo", conv:function(x){return x?String(x):null;}}
};

/* ===================== UTILS ===================== */
function typeLabel(id){for(var i=0;i<TYPES.length;i++){if(TYPES[i].id===id)return TYPES[i].label;}return id;}
function typeIcon(id){for(var i=0;i<TYPES.length;i++){if(TYPES[i].id===id)return TYPES[i].ic;}return "fi-tr-briefcase";}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escAttr(s){return String(s==null?"":s).replace(/"/g,"&quot;");}
function versTableau(v){return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]);}
function newId(){return "m"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function cp(p){return window.TDLBase.clePseudo(p);}
/* pseudos : v1 = tableau de pseudos, v2 = {pseudoAssaini: pseudoRéel} */
function lstPseudos(v){
  if(v==null)return [];
  if(Array.isArray(v))return v.filter(Boolean).map(String);
  if(typeof v!=="object")return [];
  return Object.keys(v).map(function(k){return String(v[k]||k);});
}
function nbJours(iso){var t=new Date(iso).getTime();if(isNaN(t))return null;return Math.floor((Date.now()-t)/86400000);}
function ilya(iso){var d=nbJours(iso);if(d==null)return"—";return d<=0?"aujourd'hui":("il y a "+d+" j");}
function money(n){return (+n||0)+" $";}

/* [MAJ v4] CORRECTIF DE DÉBIT. Cette fonction faisait  Math.max(0, cur+delta)
   et servait aussi à DÉBITER, avec un delta négatif — c'est ce que fait
   accepterNego quand la prime négociée monte. Sur un solde insuffisant, le
   plafonnement à zéro ne lève rien : le payeur tombe à 0, et la différence est
   créée. Le pré-test  solde(m.payeur) < delta  ne protégeait pas, puisqu'il lit
   l'instantané en mémoire.
   Les deux sens passent désormais par eco-core : crediterDollars pour un
   crédit, debiterDollars pour un prélèvement — ce dernier lève FONDS. Tous les
   appels de ce fichier passent par ici, le correctif les couvre tous. */
function crediterDollars(pseudo, delta){
  delta=Math.round(+delta||0);
  if(!delta)return Promise.resolve(0);
  return (delta>0) ? window.EcoCore.crediterDollars(pseudo, delta)
                   : window.EcoCore.debiterDollars(pseudo, -delta);
}

/* [MAJ v3] Verrou de mouvement d'argent. La transaction fait passer le drapeau
   false → true : un seul client gagne, tous les autres reçoivent DEJA et ne
   versent rien. À utiliser AVANT tout crédit irréversible. */
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

/* identité réelle (forum) */
function isStaff(){try{return typeof _userdata!=="undefined"&&(_userdata.user_level===1||_userdata.user_level===2);}catch(e){return false;}}
function estConnecte(){try{return typeof _userdata!=="undefined"&&parseInt(_userdata.user_id,10)>0;}catch(e){return false;}}
function myPseudo(){try{if(typeof _userdata!=="undefined"&&_userdata.username)return String(_userdata.username).trim();}catch(e){}return null;}

/* ===================== DONNÉES ===================== */
var M = [];          /* missions en mémoire */
var MEMBRES = {};    /* snapshot membres, fourni par le socle */

function estMaringouin(pseudo){
  if(!pseudo)return false;
  var m=MEMBRES[pseudo];
  return !!(m&&m.hors_la_loi&&m.hors_la_loi.bande==="maringouins");
}
function solde(pseudo){var m=MEMBRES[pseudo];return (m&&+m.dollars)||0;}

function normaliser(o){
  o.schema=(o.schema===SCHEMA)?SCHEMA:1;
  o.titre=o.titre||"Mission"; o.type=o.type||"recuperation";
  o.mandataire=o.mandataire||"—"; o.mandataireType=o.mandataireType||"joueur";
  o.payeur=o.payeur||null;
  o.prime=+o.prime||0; o.primeInitiale=(o.primeInitiale!=null)?(+o.primeInitiale):o.prime;
  o.objectif=o.objectif||""; o.contexte=o.contexte||"";
  o.contraintes=versTableau(o.contraintes);
  o.statut=STATUTS[o.statut]?o.statut:"en_attente";
  o.chef=o.chef||null;
  o.participants=lstPseudos(o.participants);
  o.valides=lstPseudos(o.valides);
  o.nego=(o.nego&&o.nego.montant!=null)?o.nego:null;
  o.topic=o.topic||""; o.resume=o.resume||""; o.consequences=o.consequences||"";
  o.demandeValidation=!!o.demandeValidation;
  o.cree=o.cree||new Date().toISOString();
  o.rembourse=!!o.rembourse; o.primeVersee=!!o.primeVersee;
  return o;
}
function serialize(m){var o={};for(var k in m){if(m.hasOwnProperty(k)&&k!=="id")o[k]=m[k];}return o;}

/* ---- écritures : tout passe par le socle partagé ----
   PATCH ciblé + bump de missions_rev/{id} dans le MÊME appel réseau.
   RÈGLE : ne jamais écrire dans missions par un autre chemin. */
function patch(m, champs){
  return window.TDLBase.ecrire(CFG.NODE, m.id, champs, "modification de "+m.titre);
}
var ecr = patch;    /* mêmes mécanique et libellé, chemins relatifs */
/* Une mission restée en v1 n'accepte pas d'écriture dans participants/valides. */
function exigeV2(m){
  if(m&&m.schema===SCHEMA)return true;
  toast("Mission au format ancien — lancez d\u2019abord la conversion (bouton staff).");
  return false;
}
function parId(id){for(var i=0;i<M.length;i++){if(M[i].id===id)return M[i];}return null;}

/* ===================== ÉTAT ===================== */
var S = {statut:"tous", sel:null, mob:"liste", drawer:null, inline:null};
function $(s,ctx){return (ctx||document).querySelector(s);}

/* [MAJ] avatars : index partagé du socle, chargé une fois pour tous les tableaux */
function av(n){
  var c=window.TDLBase.avatar(n);
  if(c&&c.image)return '<span class="tdlm-avatar"><img src="'+escAttr(c.image)+'" alt=""></span>';
  return '<span class="tdlm-avatar">'+esc(String(n||"?").replace(/[@.\s]/g,"").slice(0,2).toUpperCase())+'</span>';
}
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

/* Bandeau de conversion — staff seulement, tant qu'il reste des missions v1. */
function nonMigrees(){return M.filter(function(m){return m.schema!==SCHEMA;});}
function barreMigration(){
  if(!isStaff())return "";
  var n=nonMigrees().length; if(!n)return "";
  return '<div class="tdlm-migbar"><span>⚙ '+n+' mission'+(n>1?'s':'')+' au format ancien. '
    +'L\u2019inscription et la validation des participants y restent bloquées avant conversion.</span>'
    +'<button class="tdlm-abtn prim" data-act="migrer">Convertir maintenant</button></div>';
}

var _lastSel=null;
function renderStage(){
  var el=$("#tdlm-stage"); if(!el)return;
  var pl=el.querySelector(".tdlm-dlist-rows"); var scl=pl?pl.scrollTop:0;
  var pb=el.querySelector(".tdlm-dp-body"); var scb=pb?pb.scrollTop:0;
  var same=(_lastSel===S.sel);
  el.innerHTML=barreMigration()+viewDossier();
  var nl=el.querySelector(".tdlm-dlist-rows"); if(nl)nl.scrollTop=scl;
  if(same){var nb=el.querySelector(".tdlm-dp-body"); if(nb)nb.scrollTop=scb;}
  _lastSel=S.sel;
  brancher();
}

function viewDossier(){
  var d=filtre(), st=estStaffCourant();
  var rows = d.length ? d.map(function(m){
    var reqTag=(st&&m.demandeValidation)?'<div class="tdlm-drow-tags"><span class="tdlm-req">⚑ validation</span></div>':'';
    return '<div class="tdlm-drow" data-sel="'+m.id+'" aria-current="'+(m.id===S.sel)+'">'
      +'<span class="tdlm-ddot" style="--sc:'+STATUTS[m.statut].c+'"></span>'
      +'<div style="min-width:0">'
        +'<div class="tdlm-drow-head"><span class="tdlm-type">'+esc(m.titre)+'</span></div>'
        +'<div class="tdlm-drow-sub">'+esc(m.mandataire)+' · '+money(m.prime)+'</div>'
        +reqTag
      +'</div>'
      +'<div class="tdlm-drow-right">'+(m.chef?av(m.chef):'')+'<div class="tdlm-posted">posté '+ilya(m.cree)+'</div></div>'
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
    var chefLbl=(p===m.chef)?'<span class="tdlm-r">chef de mission</span>':'';
    return '<div class="tdlm-person'+(p===m.chef?' chef':'')+'">'+av(p)+'<span class="tdlm-pname">'+esc(p)+'</span>'+chefLbl+chk+'</div>';
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
      +'<div class="tdlm-duo">'
        +'<div class="tdlm-sec"><p class="tdlm-hsec">Contraintes</p>'+contraintes+'</div>'
        +'<div class="tdlm-sec"><p class="tdlm-hsec">Contexte</p><div class="tdlm-prose">'+(m.contexte?esc(m.contexte):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +'</div>'
      +negoBox
      +cadre
      +bilan
      +drawer(m)
    +'</div>'
    +actionbar(m);
}

/* ---- barre d'action selon rôle ----
   Les rôles se CUMULENT : un chef de mission qui est aussi administrateur doit
   garder ses boutons de chef, sinon celui qui joue un personnage et tient le
   staff ne peut jamais rien conclure. */
function actionbar(m){
  var me=myPseudo(), staff=isStaff(), payeur=(me&&me===m.payeur), chef=(me&&me===m.chef);
  var roles=[], btns="";

  if(chef&&(m.statut==="acceptee"||m.statut==="en_validation")){
    roles.push("Chef de mission");
    btns+='<button class="tdlm-abtn" data-act="topic">'+(m.topic?"Modifier le sujet RP":"Renseigner le sujet RP")+'</button>';
    if(m.statut==="acceptee"&&!m.topic)btns+='<button class="tdlm-abtn" data-act="nego">Négocier la prime</button>';
    btns+='<button class="tdlm-abtn prim" data-act="bilan">'+(m.statut==="en_validation"?"Modifier le bilan":"Bilan &amp; passer en validation")+'</button>';
  }
  if(payeur&&m.statut==="en_attente"){
    roles.push("Commanditaire");
    btns+='<button class="tdlm-abtn warn" data-act="retirer">Retirer ma mission</button>';
  }
  if(staff){
    roles.push("Staff");
    if(m.statut==="en_validation")btns+='<button class="tdlm-abtn prim" data-act="valider">Valider &amp; verser la prime</button>';
    btns+='<button class="tdlm-abtn" data-act="edit">Modifier les termes</button>';
    if(m.statut!=="terminee"&&m.statut!=="refusee")btns+='<button class="tdlm-abtn warn" data-act="refuser">Refuser &amp; rembourser</button>';
    btns+='<button class="tdlm-abtn warn" data-act="delete">Supprimer</button>';
  }
  if(!btns){
    if(payeur){ roles.push("Commanditaire");
      btns='<span class="tdlm-idle">En attente du chef de mission.</span>'; }
    else if(!estConnecte()){ roles.push("Invité");
      btns='<span class="tdlm-idle">Connectez-vous pour interagir.</span>'; }
    else if(estMaringouin(me)){ roles.push("Maringouin");
      btns='<span class="tdlm-idle">Utilisez « Je participe » ci-dessus.</span>'; }
    else { roles.push("Visiteur");
      btns='<span class="tdlm-idle">Table consultable — inscription réservée aux Maringouins.</span>'; }
  }
  if(!roles.length)roles.push("Visiteur");
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles.join(" · ")+'</span>'+btns+'</div>';
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
  var stage=$("#tdlm-stage"); if(!stage)return;
  stage.querySelectorAll("[data-sel]").forEach(function(el){el.onclick=function(){S.sel=el.getAttribute("data-sel");S.drawer=null;S.inline=null;S.mob="detail";renderStage();};});
  var back=stage.querySelector("[data-back]"); if(back)back.onclick=function(){S.mob="liste";renderStage();};
  /* [MAJ v3] une case cochée n'écrit QUE sa propre clé */
  stage.querySelectorAll("[data-val]").forEach(function(el){el.onchange=function(){
    var m=parId(S.sel),n=el.getAttribute("data-val");
    if(!exigeV2(m)){el.checked=!el.checked;return;}
    if(el.checked){if(m.valides.indexOf(n)<0)m.valides.push(n);}
    else m.valides=m.valides.filter(function(x){return x!==n;});
    var ch={}; ch["valides/"+cp(n)]=el.checked?n:null; ecr(m,ch);
  };});
  stage.querySelectorAll("[data-act]").forEach(function(el){el.onclick=function(){act(el.getAttribute("data-act"));};});
  stage.querySelectorAll("[data-do]").forEach(function(el){el.onclick=function(){doo(el.getAttribute("data-do"));};});
}

function act(k){
  if(k==="migrer"){lancerMigration();return;}
  var m=parId(S.sel); if(!m)return;
  var me=myPseudo();
  if(k==="join"){
    if(!estMaringouin(me)){toast("Inscription réservée aux Maringouins.");return;}
    if(m.statut!=="en_attente"&&m.statut!=="acceptee"){toast("Mission fermée à l'inscription.");return;}
    if(m.participants.indexOf(me)>=0){toast("Déjà inscrit·e.");return;}
    if(!exigeV2(m))return;
    m.participants.push(me);
    /* [MAJ v3] on n'écrit QUE sa propre clé : deux inscriptions simultanées
       ne s'écrasent plus. */
    var champs={}; champs["participants/"+cp(me)]=me;
    if(!m.chef){m.chef=me;m.statut="acceptee";champs.chef=me;champs.statut="acceptee";}
    ecr(m,champs);toast(m.chef===me?"Inscrit·e — vous êtes chef de mission.":"Inscrit·e à la mission.");renderAll();
    try{ if(window.EcoNotif && m.payeur && m.chef===me) EcoNotif.a(m.payeur,111,{titre:m.titre,chef:me},"chef"+m.id); }catch(e){}
  }
  else if(k==="topic"){S.inline=S.inline==="topic"?null:"topic";S.drawer=null;renderStage();}
  else if(k==="nego"){S.inline=S.inline==="nego"?null:"nego";S.drawer=null;renderStage();}
  else if(k==="bilan"){S.drawer=S.drawer==="bilan"?null:"bilan";S.inline=null;renderStage();}
  else if(k==="edit"){S.drawer=S.drawer==="edit"?null:"edit";S.inline=null;renderStage();}
  else if(k==="negoyes"){accepterNego(m);}
  else if(k==="negono"){var nm=m.nego?m.nego.montant:0;m.nego=null;patch(m,{nego:null});
    try{ if(window.EcoNotif && m.chef) EcoNotif.a(m.chef,113,{titre:m.titre,ok:false},"negor"+m.id+"_"+nm); }catch(e){}
    toast("Proposition refusée.");renderStage();}
  else if(k==="retirer"){retirer(m);}
  else if(k==="refuser"){refuserStaff(m);}
  else if(k==="valider"){valider(m);}
  else if(k==="delete"){supprimer(m);}
}

function doo(k){
  var m=parId(S.sel);
  if(k==="cancel"){S.drawer=null;S.inline=null;renderStage();return;}
  if(k==="topicok"){var u=(($("#tdlm-topic")||{}).value||"").trim();m.topic=u;var champs={topic:u};if(u&&m.nego){m.nego=null;champs.nego=null;}patch(m,champs);S.inline=null;toast(u?"Sujet RP enregistré — la prime n'est plus négociable.":"Sujet RP retiré.");renderStage();return;}
  if(k==="negook"){
    var v=parseInt((($("#tdlm-negom")||{}).value||"").replace(/[^\d]/g,""),10);
    if(!v||v<0){toast("Montant invalide.");return;}
    m.nego={montant:v,statut:"en_cours",par:myPseudo()||m.chef};
    patch(m,{nego:m.nego});
    try{ if(window.EcoNotif && m.payeur) EcoNotif.a(m.payeur,112,{titre:m.titre,montant:v},"nego"+m.id+"_"+v); }catch(e){}
    S.inline=null;toast("Proposition envoyée au commanditaire.");renderStage();return;
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
    patch(m,champs);
     try{ if(window.EcoNotif && champs.statut==="en_validation") EcoNotif.staff(114,{titre:m.titre},"val"+m.id); }catch(e){}
     S.drawer=null;
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
/* Un mouvement d'argent rend le snapshot des soldes périmé. */
function rafraichir(){
  return window.TDLBase.rafraichirMembres().then(function(mb){ MEMBRES=mb||{}; renderAll(); });
}

/* La négociation n'a pas de drapeau à verrouiller : on efface donc nego AVANT
   d'ajuster l'argent. Un second clic ne trouve plus rien à accepter. Si
   l'ajustement échoue ensuite, la proposition est perdue et le chef doit la
   refaire — visible, contrairement à un double débit. */
var _negoEnVol = {};
function accepterNego(m){
  if(!m.nego||_negoEnVol[m.id]){return;}
  var montant=m.nego.montant, delta=montant-m.prime;
  if(delta>0&&solde(m.payeur)<delta){toast("Fonds insuffisants pour couvrir la hausse de prime ("+money(delta)+" manquants).");return;}
  _negoEnVol[m.id]=true;
  var ancienne=m.prime;
  m.nego=null; m.prime=montant;
  patch(m,{prime:montant,nego:null});
  /* delta>0 → débit STRICT du payeur ; delta<0 → recrédit */
  var op=(delta!==0)?crediterDollars(m.payeur,-delta):Promise.resolve();
  op.then(function(){
    try{ if(window.EcoNotif && m.chef) EcoNotif.a(m.chef,113,{titre:m.titre,ok:true},"negor"+m.id+"_"+montant); }catch(e){}
    toast("Prime ajustée à "+money(montant)+".");
    return rafraichir();
  }).catch(function(e){
    /* le débit a été refusé : la prime affichée doit revenir en arrière, sinon
       le tableau promettrait un montant qui n'a pas été retenu. */
    m.prime=ancienne; patch(m,{prime:ancienne});
    if(e&&e.message==="FONDS")toast("Fonds insuffisants au moment du prélèvement — prime inchangée, la proposition est annulée.");
    else toast("Ajustement de la prime échoué — prime inchangée, la proposition est annulée.");
    renderAll();
  }).then(function(){ delete _negoEnVol[m.id]; });
}

function retirer(m){
  if(m.statut!=="en_attente"){toast("Retrait possible seulement tant qu'aucun chef n'est inscrit.");return;}
  if(m.rembourse){toast("Déjà remboursée.");return;}
  if(!window.confirm("Retirer la mission « "+m.titre+" » ? La prime ("+money(m.prime)+") vous sera recréditée."))return;
  rembourser(m,"Mission retirée, prime recréditée.");
}

function refuserStaff(m){
  if(!window.confirm("Refuser la mission « "+m.titre+" » et rembourser le commanditaire ?"))return;
  rembourser(m,"Mission refusée, commanditaire remboursé.");
}

/* [MAJ v3] chemin commun des remboursements, sous verrou. */
function rembourser(m, msgOk){
  verrou(m,"rembourse").then(function(){
    m.rembourse=true;
    var credit=(m.payeur&&m.prime>0)?crediterDollars(m.payeur,m.prime):Promise.resolve();
    return Promise.resolve(credit).then(function(){
      m.statut="refusee";m.demandeValidation=false;
      patch(m,{statut:"refusee",demandeValidation:false});
      toast(msgOk);
      return rafraichir();
    });
  }).catch(function(e){
    if(estDeja(e)){
      m.rembourse=true;m.statut="refusee";
      patch(m,{statut:"refusee",demandeValidation:false});
      toast("Déjà remboursée ailleurs — aucun second recrédit.");renderAll();return;
    }
    toast("Remboursement échoué — mission inchangée.");
  });
}

function valider(m){
  if(m.primeVersee){toast("Prime déjà versée.");return;}
  var vals=m.valides.slice();
  if(!vals.length){toast("Coche au moins un participant.");return;}
  var n=vals.length, part=Math.floor(m.prime/n), reste=m.prime-part*n;
  if(!window.confirm("Valider « "+m.titre+" » ?\n"+n+" participant(s) : "+money(part)+" chacun"+(reste?" (+"+money(reste)+" au chef)":"")+" + "+money(CHEF_BONUS)+" bonus chef. Irréversible."))return;
  /* [MAJ v3] verrou AVANT tout crédit : deux validations simultanées ne
     versaient pas l'une après l'autre, elles versaient DEUX FOIS. */
  verrou(m,"primeVersee").then(function(){
    m.primeVersee=true;
    var chain=Promise.resolve();
    vals.forEach(function(p){chain=chain.then(function(){return crediterDollars(p,part);});});
    if(m.chef&&vals.indexOf(m.chef)>=0){chain=chain.then(function(){return crediterDollars(m.chef,reste+CHEF_BONUS);});}
    else if(reste){chain=chain.then(function(){return crediterDollars(vals[0],reste);});}
    return chain.then(function(){
      m.statut="terminee";m.demandeValidation=false;
      patch(m,{statut:"terminee",demandeValidation:false});
      try{ if(window.EcoNotif) vals.forEach(function(p){
        var g=part+((m.chef&&p===m.chef)?reste+CHEF_BONUS:0);
        EcoNotif.a(p,115,{titre:m.titre,montant:g},"prime"+m.id+"_"+p);
      }); }catch(e){}
      toast("Mission validée. "+n+" × "+money(part)+(m.chef?" + "+money(CHEF_BONUS)+" chef":"")+" versés.");
      return rafraichir();
    });
  }).catch(function(e){
    if(estDeja(e)){
      m.primeVersee=true;
      toast("Prime déjà versée ailleurs — rien n\u2019a été versé une seconde fois.");renderAll();return;
    }
    toast("Versement incomplet — la mission reste marquée payée, vérifiez les soldes avant de reverser.");
    renderAll();
  });
}

function supprimer(m){
  if(!window.confirm("Supprimer définitivement la mission « "+m.titre+" » ?\nAucun remboursement automatique — utilisez « Refuser & rembourser » si nécessaire."))return;
  window.TDLBase.supprimerEntree(CFG.NODE, m.id, "suppression de "+m.titre);
  M=M.filter(function(x){return x!==m;});
  var d=filtre();S.sel=d[0]?d[0].id:(M[0]?M[0].id:null);S.drawer=null;S.inline=null;S.mob="liste";
  toast("Mission supprimée.");renderAll();
}

/* ---- refus auto (7 j sans chef), évaluation paresseuse au chargement ----
   Même verrou que les chemins manuels : seul le client qui fait passer
   rembourse false→true verse ; les autres referment localement. */
function autoRefus(){
  var now=Date.now();
  M.forEach(function(m){
    if(m.statut!=="en_attente"||m.chef||m.rembourse)return;
    if(now-new Date(m.cree).getTime()<DELAI_REFUS)return;
    verrou(m,"rembourse").then(function(){
      m.rembourse=true;m.statut="refusee";
      var credit=(m.payeur&&m.prime>0)?crediterDollars(m.payeur,m.prime):Promise.resolve();
      return Promise.resolve(credit).then(function(){
        try{ if(window.EcoNotif && m.payeur) EcoNotif.a(m.payeur,116,{titre:m.titre},"auto"+m.id); }catch(e){}
        patch(m,{statut:"refusee"});renderAll();
      });
    }).catch(function(e){
      if(estDeja(e)){m.rembourse=true;m.statut="refusee";patch(m,{statut:"refusee"});renderAll();}
    });
  });
}

/* ===================== CONVERSION v1 → v2 (staff) ===================== */
function nonMigreesCount(){return nonMigrees().length;}
function lancerMigration(){
  if(!isStaff()){toast("Réservé au staff.");return;}
  var reste=nonMigreesCount();
  if(!reste){toast("Rien à convertir.");return;}
  if(!window.confirm("Convertir "+reste+" mission(s) au nouveau format ?\n\n"
    +"Seules les listes participants et valides changent de forme ; aucun montant n\u2019est touché.\n"
    +"Chaque mission est traitée séparément et l\u2019opération peut être relancée sans risque.\n"
    +"Assurez-vous que personne n\u2019a le tableau ouvert sur l\u2019ancienne version du script."))return;
  var b=document.querySelector('[data-act="migrer"]');
  if(b){b.disabled=true;b.textContent="Conversion…";}
  Promise.resolve(window.EcoCore.firebaseGet(CFG.NODE)).then(function(raw){
    return window.TDLBase.migrer({
      node:CFG.NODE, schema:SCHEMA, listes:PLAN, entrees:raw||{},
      surProgres:function(f,t){var x=document.querySelector('[data-act="migrer"]');if(x)x.textContent="Conversion "+f+" / "+t+"…";}
    });
  }).then(function(res){
    toast(res.erreurs.length
      ? res.faits+" mission(s) converties, "+res.erreurs.length+" en échec — relancez la conversion."
      : res.faits+" mission(s) converties.");
    loadData();
  }).catch(function(e){
    toast("Conversion impossible — rien n\u2019a été modifié.");
    try{console.error("[missions] migration",e);}catch(_){}
    renderStage();
  });
}

/* ===================== CHARGEMENT ===================== */
function renderAll(){renderStatutFilters();renderStage();}
function loading(msg){var el=$("#tdlm-stage");if(el)el.innerHTML='<div class="tdlm-empty">'+esc(msg||"Chargement…")+'</div>';}

/* [MAJ v3] deux lectures ciblées (missions ~2 ko, membres ~3 ko via le socle)
   au lieu des 126 ko de la racine. */
function loadData(){
  loading("Chargement des missions…");
  var pm, pb;
  try{ pm=window.EcoCore.firebaseGet(CFG.NODE); pb=window.TDLBase.membres(); }
  catch(e){ loading("EcoCore indisponible."); return; }
  Promise.all([Promise.resolve(pm), Promise.resolve(pb)]).then(function(r){
    var raw=r[0]||{};
    MEMBRES=r[1]||{};
    M=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliser(o);});
    M.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
    autoRefus();fixSel();renderAll();
    if(VEILLE&&VEILLE.caler)VEILLE.caler(raw);
    if(!M.length)loading("Aucune mission pour l'instant.");
  }).catch(function(){loading("Impossible de charger les missions.");});
}

function pret(){return !!(window.EcoCore&&window.EcoCore.firebaseGet&&window.TDLBase&&window.TDLBase.suivre);}
function whenEco(cb){
  if(pret()){cb();return;}
  loading("Connexion à la base…");
  var n=0,iv2=setInterval(function(){
    if(pret()){clearInterval(iv2);cb();}
    else if(++n>80){clearInterval(iv2);loading("EcoCore ou tdl-base introuvable — vérifiez l\u2019ordre de chargement des scripts.");}
  },125);
}

/* ---- veille sentinelle ----
   La réconciliation périodique du socle rattrape les missions créées par
   barge-maringouins tant qu'il écrit sans sentinelle. */
var VEILLE=null;
function startAutoRefresh(){
  VEILLE=window.TDLBase.suivre({
    node: CFG.NODE,
    rev: true,
    ms: VEILLE_MS,
    occupe: function(){ return !!(S.drawer||S.inline); },
    onEntrees: absorber
  });
}
function absorber(majs, supprimes){
  var change=false, j;
  majs.forEach(function(x){
    var o=x.brut||{}; o.id=x.id;
    var n=normaliser(o), i=-1;
    for(j=0;j<M.length;j++){ if(M[j].id===x.id){i=j;break;} }
    if(i<0)M.push(n); else M[i]=n;
    change=true;
  });
  if(supprimes&&supprimes.length){
    M=M.filter(function(x){return supprimes.indexOf(x.id)<0;});
    change=true;
  }
  if(!change)return;
  M.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
  autoRefus();fixSel();renderAll();
}

/* ===================== INIT / MONTAGE ===================== */
function initApp(){
  var edit=$("#tdlm-edit");
  if(edit){edit.href=CFG.EDIT_URL||"#";if(isStaff())edit.classList.add("on");}
  whenEco(function(){
    window.TDLBase.surEchec(majBandeau);
    window.TDLBase.avatars(function(){ if(!S.drawer&&!S.inline)renderAll(); });
    startAutoRefresh();
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
  if(!document.querySelector("meta[name=viewport]")){var mv=document.createElement("meta");mv.name="viewport";mv.content="width=device-width, initial-scale=1";document.head.appendChild(mv);}
  initApp();
  return true;
}
var tries=0, iv=setInterval(function(){if(boot()||++tries>60)clearInterval(iv);},250);
window.addEventListener("load",boot);
if(document.readyState!=="loading")boot();

})();
