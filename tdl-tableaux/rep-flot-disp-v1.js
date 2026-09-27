/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU HANGAR · TYPE « DISPARITION »
   (rep-flot-disp.js) — à charger APRÈS rep-flot-core.js.

   Données : flottille/disparitions/{id}, créées par quai-staff à la validation
   d'un achat « Disparition temporaire » en boutique (500 $ minimum, prime déjà
   retenue sur le demandeur).

   CYCLE   en_attente → en_cours (UN capitaine la prend, le personnage part)
           → en_validation → clos.  14 j sans preneur → refusé + recrédit.
   ARGENT  la prime va au capitaine, en entier, à la clôture. Pas de parts,
           pas de bonus : c'est un travail payé par un client, pas une mission
           de bande. Négociable à la hausse tant que le départ n'a pas eu lieu.
   ACCÈS   prendre un départ exige un NAVIRE (estCapitaine). Un homme
           d'équipage n'emmène personne en Floride tout seul.
   PRESSION  si le motif est une dette, la Main vient poser des questions. Le
           capitaine choisit : se taire, parler, mentir. Bloc visible du seul
           capitaine et du staff — le demandeur n'a pas à savoir.
   DÉNOUEMENT  tranché par le staff, PROPRE AU MOTIF, et obligatoire avant la
           clôture pour le seul motif « dette ». Lui seul écrit dans le grand
           livre : introuvable → la dette quitte le compte du disparu, soit
           vers un PJ qui l'a rachetée, soit effacée par l'entourage PNJ.
           Enquête et raisons personnelles ne touchent à aucun compte.
   ================================================================== */
(function(F){
"use strict";
if(!F){ if(window.console) console.warn("[rep-flot-disp] rep-flot-core absent."); return; }
var esc=F.esc, escAttr=F.escAttr, vt=F.vt, money=F.money, ilya=F.ilya, av=F.av, $=F.$;
var S=F.S, patch=F.patch, toast=F.toast, STATUTS=F.STATUTS;

/* ===================== CONFIG ===================== */
var SOUS="disparitions";
var MOTIFS={dette:"Se soustraire à une dette", enquete:"Échapper à une enquête", perso:"Raisons personnelles"};
var PRESSIONS={
  taire:  {label:"S\u2019est tu",  desc:"La Main n\u2019a rien obtenu. Elle s\u2019en souviendra, dans les deux sens."},
  parler: {label:"A parlé",       desc:"La Main sait où le passager a été déposé."},
  mentir: {label:"A menti",       desc:"La Main l\u2019a découvert. Elle pardonne la loyauté, pas la ruse."}
};
/* Le dénouement dépend du motif : on ne referme pas une fuite devant la Main
   comme une fuite devant le shérif ou comme un départ de famille. */
var ISSUES={
  dette:{
    retrouve:   {label:"Retrouvé par la Main", desc:"Elle a remis la main sur lui. La dette reste à son compte, intacte."},
    introuvable:{label:"Introuvable",          desc:"Elle ne l\u2019a pas trouvé. La dette quitte son compte \u2014 quelqu\u2019un d\u2019autre a payé."}
  },
  enquete:{
    interpelle:{label:"Localisé par les autorités", desc:"On est venu le chercher là où il était. L\u2019affaire reprend son cours."},
    revenu:    {label:"Rentré de lui-même",         desc:"Il est revenu se présenter. Ce qu\u2019il en attend le regarde."},
    jamais:    {label:"Jamais localisé",            desc:"Personne ne l\u2019a retrouvé pendant son absence. L\u2019affaire a pris du retard."}
  },
  perso:{
    revenu: {label:"Rentré de lui-même",      desc:"Le temps a fait son affaire."},
    ramene: {label:"Ramené par ses proches",  desc:"Quelqu\u2019un est allé le chercher, ou l\u2019a convaincu."},
    reste:  {label:"N\u2019est pas rentré",    desc:"Il est resté là-bas plus longtemps que prévu. Ceux qui l\u2019attendaient le savent."}
  }
};
function issuesDe(m){ return ISSUES[m.motif]||ISSUES.perso; }
function issueDe(m){ var i=issuesDe(m); return (m.denouement&&i[m.denouement.issue])||null; }

var T={
  NON_CAP:"Prendre un départ exige un navire : réservé aux capitaines de la Flottille.",
  FERME:"Ce départ n\u2019est plus disponible.",
  PRIS:"Départ pris \u2014 le passager quitte la Louisiane.",
  CONSULT:"Registre consultable \u2014 seuls les capitaines prennent les départs.",
  CONNECT:"Connectez-vous pour interagir.",
  ATTENTE:"En attente d\u2019un capitaine.",
  DEN_MANQUE:"Tranche d\u2019abord le dénouement : la dette doit aller quelque part."
};

/* ===================== NORMALISATION ===================== */
function normaliser(o){
  o.titre=o.titre||("Disparition de "+(o.demandeur||"?"));
  o.demandeur=o.demandeur||null;
  o.prime=+o.prime||0;
  o.primeInitiale=(o.primeInitiale!=null)?(+o.primeInitiale||0):o.prime;
  o.duree=parseInt(o.duree,10)||1;
  o.destination=o.destination||"";
  o.motif=MOTIFS[o.motif]?o.motif:"perso";
  o.dette_key=o.dette_key||""; o.dette_libelle=o.dette_libelle||"";
  o.enquete_id=o.enquete_id||""; o.enquete_titre=o.enquete_titre||"";
  o.restent=o.restent||""; o.restent_pnj=o.restent_pnj||"";
  o.contexte=o.contexte||"";
  o.statut=STATUTS[o.statut]?o.statut:"en_attente";
  o.capitaine=o.capitaine||null;
  o.depart=o.depart||"";
  o.nego=(o.nego&&o.nego.montant!=null)?o.nego:null;
  o.pression=(o.pression&&PRESSIONS[o.pression.choix])?o.pression:null;
  /* un motif changé par le staff invalide un dénouement devenu hors sujet */
  o.denouement=(o.denouement&&ISSUES[o.motif]&&ISSUES[o.motif][o.denouement.issue])?o.denouement:null;
  o.sujet=o.sujet||"";
  o.resume=o.resume||""; o.consequences=o.consequences||"";
  o.demandeValidation=!!o.demandeValidation;
  o.cree=o.cree||new Date().toISOString();
  o.rembourse=!!o.rembourse; o.primeVersee=!!o.primeVersee;
  return o;
}

/* ===================== RANGÉE ===================== */
function sub(m){
  var bouts=[m.duree+" mois"];
  if(m.destination)bouts.push(m.destination);
  return { sub:bouts.join(" \u00b7 "), qui:m.capitaine, quand:"déposée "+ilya(m.cree) };
}
function tags(m){
  var out=[];
  if(m.motif==="dette")out.push("\u2691 dette");
  if(m.nego)out.push("\u2691 prime proposée");
  var r=retour(m);
  if(r!=null&&r<=0&&m.statut==="en_cours")out.push("retour échu");
  return out;
}
/* jours restants avant le retour prévu, null si pas encore parti */
function retour(m){
  if(!m.depart)return null;
  var d=F.nbJours(m.depart); if(d==null)return null;
  return m.duree*30-d;
}

/* ===================== PANNEAU ===================== */
function panel(m){
  var me=F.myPseudo(), staff=F.isStaff(), cap=(me&&me===m.capitaine);
  var primeLabel=money(m.prime)+(m.prime!==m.primeInitiale?' <span class="tdlm-todo">(négociée, init. '+money(m.primeInitiale)+')</span>':'');

  var banner="";
  if(staff&&m.demandeValidation){
    banner='<div class="tdlm-reqbanner"><p class="tdlm-hsec">⚑ Le capitaine demande la clôture</p>'
      +'<div class="tdlm-reqrow"><span>'+esc(m.motif==="dette"
          ?"Tranche le dénouement avant de verser : la dette doit aller quelque part."
          :"Tu peux noter ce qu\u2019est devenu le passager avant de clore.")+'</span></div></div>';
  }

  var negoBox="";
  if(m.nego){
    var estDem=(me&&me===m.demandeur);
    negoBox='<div class="tdlm-negobox"><p class="tdlm-hsec">Négociation de prime</p>'
      +'<div class="tdlm-negorow"><span>Le capitaine demande <b>'+money(m.nego.montant)+'</b> (actuelle : '+money(m.prime)+').</span>'
      +(estDem?'<span class="tdlm-negoact"><button class="tdlm-abtn prim" data-act="negoyes">Accepter</button><button class="tdlm-abtn warn" data-act="negono">Refuser</button></span>':'')
      +'</div></div>';
  }

  /* motif : la dette et l'affaire ne s'affichent qu'à ceux que ça regarde */
  var confid=(staff||cap||(me&&me===m.demandeur));
  var motifV=esc(MOTIFS[m.motif]);
  if(m.motif==="dette"&&m.dette_libelle)motifV+=confid?' <span class="tdlm-todo">\u00b7 '+esc(m.dette_libelle)+'</span>':'';
  if(m.motif==="enquete"&&m.enquete_titre)motifV+=' <span class="tdlm-todo">\u00b7 '+esc(m.enquete_titre)+'</span>';

  /* pression de la Main : capitaine + staff uniquement */
  var pressionBox="";
  if(m.motif==="dette"&&(staff||cap)){
    var etat=m.pression
      ? '<div class="tdlm-prose"><b>'+esc(PRESSIONS[m.pression.choix].label)+'</b> \u2014 '+esc(PRESSIONS[m.pression.choix].desc)+'</div>'
      : '<div class="tdlm-prose"><span class="tdlm-todo">La Main finira par poser la question. Rien n\u2019est encore décidé.</span></div>';
    pressionBox='<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Quand la Main demande</span>'
      +((cap&&m.statut==="en_cours")?'<button class="tdlm-abtn" data-act="pression">'+(m.pression?"Revenir sur ma réponse":"Répondre")+'</button>':'')
      +'</div>'+etat+'</div>';
  }

  /* dénouement : visible de tous une fois tranché */
  var denBox="", iss=issueDe(m);
  if(iss){
    var d=m.denouement, suite="";
    if(d.lavee_par)suite=" La dette a changé de mains : "+esc(d.lavee_par)+" a payé, et attend son dû.";
    else if(d.lavee_pnj)suite=" "+esc(d.lavee_pnj)+" a réglé l\u2019ardoise. Le grand livre est propre.";
    denBox='<div class="tdlm-sec"><p class="tdlm-hsec">Dénouement</p><div class="tdlm-prose"><b>'
      +esc(iss.label)+'</b> \u2014 '+esc(iss.desc)+suite+'</div></div>';
  }

  var bilan="";
  if(m.resume||m.consequences||m.statut==="en_validation"||m.statut==="close"){
    bilan='<div class="tdlm-sec"><p class="tdlm-hsec">Résumé</p><div class="tdlm-prose">'+(m.resume?esc(m.resume):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Conséquences</p><div class="tdlm-prose">'+(m.consequences?esc(m.consequences):'<span class="tdlm-todo">—</span>')+'</div></div>';
  }

  var sujetLine=m.sujet?'<div class="tdlm-m"><span class="tdlm-k">Sujet RP</span><span class="tdlm-v"><a class="tdlm-lien" href="'+escAttr(m.sujet)+'" target="_blank" rel="noopener">Ouvrir le sujet →</a></span></div>':'';
  var r=retour(m);
  var retourV=(r==null)?'<span class="tdlm-todo">pas encore parti</span>'
    :(r>0?("dans "+r+" j"):'<span class="tdlm-todo">échu depuis '+(-r)+' j</span>');

  var prendreBtn=(F.estCapitaine(me)&&!m.capitaine&&m.statut==="en_attente")
    ? '<button class="tdlm-abtn prim" data-act="prendre">Je prends ce départ</button>' : '';
    var capBloc='<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Le capitaine</span>'+prendreBtn+'</div>'
    +(m.capitaine
      ? '<div class="tdlm-person chef">'+av(m.capitaine)
        +'<span class="tdlm-pname">'+esc(m.capitaine)+'</span>'
        +(F.navireDe(m.capitaine)?'<span class="tdlm-r">'+esc(F.navireDe(m.capitaine))+'</span>':'')
        +'</div>'
      : '<p class="tdlm-todo" style="margin:0">Aucun capitaine n\u2019a encore pris ce départ.</p>')+'</div>';

  return ''
    +'<button class="tdlm-dret" data-back>← Retour à la liste</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">'+esc(m.titre)+'</span>'+F.stamp(m)+'</div>'
    +'<div class="tdlm-dp-body">'
      +'<div class="tdlm-dp-hd"><div class="tdlm-dp-meta">'
        +'<div class="tdlm-m"><span class="tdlm-k">Passager</span><span class="tdlm-v">'+esc(m.demandeur||"—")+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Durée</span><span class="tdlm-v">'+m.duree+' mois</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Destination</span><span class="tdlm-v">'+esc(m.destination||"peu importe")+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Motif</span><span class="tdlm-v">'+motifV+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Prime</span><span class="tdlm-v"><b>'+primeLabel+'</b></span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Retour prévu</span><span class="tdlm-v">'+retourV+'</span></div>'
        +sujetLine
      +'</div>'+banner+'</div>'
      +'<div class="tdlm-duo">'
        +'<div class="tdlm-sec"><p class="tdlm-hsec">Reste derrière</p><div class="tdlm-prose">'
          +(m.restent?esc(m.restent):'<span class="tdlm-todo">—</span>')
          +(m.restent_pnj?'<br><span class="tdlm-todo">'+esc(m.restent_pnj)+'</span>':'')+'</div></div>'
        +'<div class="tdlm-sec"><p class="tdlm-hsec">Contexte</p><div class="tdlm-prose">'+(m.contexte?esc(m.contexte):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +'</div>'
      +negoBox+capBloc+pressionBox+denBox+bilan+drawer(m)
    +'</div>'
    +actionbar(m);
}

/* ---- barre d'action (rôles cumulés, jamais de cascade exclusive) ---- */
function actionbar(m){
  var me=F.myPseudo(), staff=F.isStaff();
  var dem=(me&&me===m.demandeur), cap=(me&&me===m.capitaine);
  var roles=[], btns="";

  if(cap&&(m.statut==="en_cours"||m.statut==="en_validation")){
    roles.push("Capitaine");
    btns+='<button class="tdlm-abtn" data-act="sujet">'+(m.sujet?"Modifier le sujet RP":"Renseigner le sujet RP")+'</button>';
    if(m.statut==="en_cours"&&!m.sujet)btns+='<button class="tdlm-abtn" data-act="nego">Demander plus</button>';
    btns+='<button class="tdlm-abtn prim" data-act="bilan">'+(m.statut==="en_validation"?"Modifier le bilan":"Bilan &amp; demander la clôture")+'</button>';
  }
  if(dem&&m.statut==="en_attente"){
    roles.push("Passager");
    btns+='<button class="tdlm-abtn warn" data-act="retirer">Renoncer au départ</button>';
  }
  if(staff){
    roles.push("Staff");
    if(m.statut==="en_cours"||m.statut==="en_validation")btns+='<button class="tdlm-abtn" data-act="denouement">'+(m.denouement?"Revoir le dénouement":"Trancher le dénouement")+'</button>';
    if(m.statut==="en_validation")btns+='<button class="tdlm-abtn prim" data-act="valider">Clore &amp; payer le capitaine</button>';
    btns+='<button class="tdlm-abtn" data-act="edit">Modifier les termes</button>';
    if(m.statut!=="close"&&m.statut!=="refusee")btns+='<button class="tdlm-abtn warn" data-act="refuser">Refuser &amp; rembourser</button>';
    btns+='<button class="tdlm-abtn warn" data-act="delete">Supprimer</button>';
  }
  if(!btns){
    if(dem){roles.push("Passager");btns='<span class="tdlm-idle">'+T.ATTENTE+'</span>';}
    else if(!F.estConnecte()){roles.push("Invité");btns='<span class="tdlm-idle">'+T.CONNECT+'</span>';}
    else if(F.estCapitaine(me)){roles.push("Capitaine");btns='<span class="tdlm-idle">Utilisez « Je prends ce départ » ci-dessus.</span>';}
    else {roles.push("Visiteur");btns='<span class="tdlm-idle">'+T.CONSULT+'</span>';}
  }
  if(!roles.length)roles.push("Visiteur");
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles.join(" \u00b7 ")+'</span>'+btns+'</div>';
}

/* ---- drawers ---- */
function drawer(m){
  if(S.drawer==="edit"){
    var msel=Object.keys(MOTIFS).map(function(k){return '<option value="'+k+'"'+(k===m.motif?' selected':'')+'>'+esc(MOTIFS[k])+'</option>';}).join("");
    return '<div class="tdlm-drawer on"><h4>Modifier les termes (staff)</h4>'
      +'<label class="tdlm-fl">Titre</label><input type="text" id="tdlh-etitre" value="'+escAttr(m.titre)+'">'
      +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Durée (mois)</label><input type="text" id="tdlh-eduree" value="'+escAttr(m.duree)+'"></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Destination</label><input type="text" id="tdlh-edest" value="'+escAttr(m.destination)+'"></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Prime ($)</label><input type="text" id="tdlh-eprime" value="'+escAttr(m.prime)+'"></div></div>'
      +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Motif</label><select id="tdlh-emotif">'+msel+'</select></div>'
      +'<div style="flex:2"><label class="tdlm-fl">Reste derrière (PNJ)</label><input type="text" id="tdlh-epnj" value="'+escAttr(m.restent_pnj)+'"></div></div>'
      +'<label class="tdlm-fl">Contexte</label><textarea id="tdlh-ectx">'+esc(m.contexte)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="editok">Enregistrer</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="bilan"){
    return '<div class="tdlm-drawer on"><h4>Bilan du départ</h4>'
      +'<label class="tdlm-fl">Résumé</label><textarea id="tdlh-bresume">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Conséquences</label><textarea id="tdlh-bconseq">'+esc(m.consequences)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="bilanok">'+(m.statut==="en_validation"?"Enregistrer":"Demander la clôture")+'</button>'
      +(m.statut!=="en_validation"?'<button class="tdlm-abtn" data-do="bilansave">Enregistrer sans envoyer</button>':'')
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="denouement"){
    var cur=m.denouement||{}, jeu=issuesDe(m);
    var isel='<option value="">— à trancher —</option>'+Object.keys(jeu).map(function(k){
      return '<option value="'+k+'"'+(k===cur.issue?' selected':'')+'>'+esc(jeu[k].label)+'</option>';}).join("");
    /* les champs de payeur n'existent que pour une fuite devant la Main */
    var argent="";
    if(m.motif==="dette"){
      var pjs=Object.keys(F.membres()).sort(function(a,b){return a.localeCompare(b,"fr");})
        .map(function(p){return '<option value="'+escAttr(p)+'"'+(p===cur.lavee_par?' selected':'')+'>'+esc(p)+'</option>';}).join("");
      argent='<label class="tdlm-fl">Introuvable : la dette rachetée par un PJ — la créance passe à lui</label>'
        +'<select id="tdlh-dpj"><option value="">— aucun —</option>'+pjs+'</select>'
        +'<label class="tdlm-fl">Ou lavée par l\u2019entourage (PNJ) — la dette sort du grand livre</label>'
        +'<input type="text" id="tdlh-dpnj" value="'+escAttr(cur.lavee_pnj||"")+'" placeholder="Qui a payé à sa place…">';
    }
    return '<div class="tdlm-drawer on"><h4>Dénouement (staff)</h4>'
      +'<label class="tdlm-fl">Ce qu\u2019est devenu le passager</label><select id="tdlh-dissue">'+isel+'</select>'
      +argent
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="denok">Enregistrer le dénouement</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline==="pression"){
    var psel=Object.keys(PRESSIONS).map(function(k){return '<option value="'+k+'"'+(m.pression&&k===m.pression.choix?' selected':'')+'>'+esc(PRESSIONS[k].label)+'</option>';}).join("");
    return '<div class="tdlm-drawer on"><h4>La Main pose la question</h4>'
      +'<label class="tdlm-fl">Votre réponse</label><select id="tdlh-pchoix">'+psel+'</select>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="pressionok">Enregistrer</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline==="sujet"){
    return '<div class="tdlm-drawer on"><h4>Sujet RP du départ</h4>'
      +'<input type="text" id="tdlh-sujet" value="'+escAttr(m.sujet)+'" placeholder="https://thedrownedlands.forumactif.com/t...">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="sujetok">Enregistrer</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline==="nego"){
    return '<div class="tdlm-drawer on"><h4>Demander une prime plus haute</h4>'
      +'<input type="text" id="tdlh-negom" placeholder="Montant en $" value="'+escAttr(m.nego?m.nego.montant:"")+'">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="negook">Proposer au passager</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

/* ===================== ACTIONS ===================== */
function act(k,m){
  var me=F.myPseudo();

  if(k==="prendre"){
    if(!F.estCapitaine(me)){toast(T.NON_CAP);return;}
    if(m.capitaine||m.statut!=="en_attente"){toast(T.FERME);return;}
    var iso=new Date().toISOString();
    m.capitaine=me;m.statut="en_cours";m.depart=iso;
    patch(m,{capitaine:me,statut:"en_cours",depart:iso});
    try{if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,100,{nom:m.titre},"dpr"+m.id);}catch(e){}
    toast(T.PRIS);F.renderAll();return;
  }
  if(k==="sujet"||k==="nego"||k==="pression"){S.inline=k;S.drawer=null;F.renderStage();return;}
  if(k==="bilan"||k==="edit"||k==="denouement"){S.drawer=k;S.inline=null;F.renderStage();return;}

  if(k==="negoyes"){
    if(!m.nego)return;
    var neuf=+m.nego.montant||0, delta=neuf-m.prime;
    if(delta>0&&F.solde(m.demandeur)<delta){toast("Solde insuffisant pour couvrir la hausse.");return;}
    F.crediter(m.demandeur,-delta).then(function(){
      m.prime=neuf;m.nego=null;patch(m,{prime:neuf,nego:null});
      toast("Prime portée à "+money(neuf)+".");F.renderStage();
    }).catch(function(){toast("Ajustement impossible.");});
    return;
  }
  if(k==="negono"){m.nego=null;patch(m,{nego:null});toast("Proposition refusée.");F.renderStage();return;}

  if(k==="retirer"||k==="refuser"){
    if(m.rembourse){toast("Déjà remboursée.");return;}
    if(!window.confirm("Fermer ce départ et rembourser "+money(m.prime)+" à "+(m.demandeur||"?")+" ?"))return;
    var suite=(m.demandeur&&m.prime>0)?F.crediter(m.demandeur,m.prime):Promise.resolve();
    Promise.resolve(suite).then(function(){
      m.rembourse=true;m.statut="refusee";
      patch(m,{rembourse:true,statut:"refusee"});
      try{if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,101,{nom:m.titre,montant:m.prime},"fdi"+m.id);}catch(e){}
      toast("Départ annulé, prime rendue.");F.renderAll();
    }).catch(function(){toast("Remboursement impossible.");});
    return;
  }
  if(k==="valider"){clore(m);return;}
  if(k==="delete"){
    if(!window.confirm("Supprimer définitivement « "+m.titre+" » ?\nAucun remboursement automatique \u2014 utilisez « Refuser & rembourser » si nécessaire."))return;
    F.supprimer(m);toast("Départ supprimé.");F.renderAll();return;
  }
}

/* ===================== DRAWERS : VALIDATION ===================== */
function doo(k,m){
  if(k==="cancel"){S.drawer=null;S.inline=null;F.renderStage();return;}

  if(k==="sujetok"){
    var el=$("#tdlh-sujet"), url=el?String(el.value||"").trim():"";
    m.sujet=url;patch(m,{sujet:url});S.inline=null;toast("Sujet enregistré.");F.renderStage();return;
  }
  if(k==="pressionok"){
    var pc=$("#tdlh-pchoix"), choix=pc?pc.value:"";
    if(!PRESSIONS[choix]){toast("Choisis une réponse.");return;}
    m.pression={choix:choix,par:F.myPseudo(),date:new Date().toISOString()};
    patch(m,{pression:m.pression});S.inline=null;
    toast(PRESSIONS[choix].label+". Le staff en tiendra compte.");F.renderStage();return;
  }
  if(k==="negook"){
    var em=$("#tdlh-negom"), v=em?parseInt(String(em.value).replace(/[^\d]/g,""),10):0;
    if(!v||v<=0){toast("Indique un montant valide.");return;}
    if(v<=m.prime){toast("La négociation se fait à la hausse.");return;}
    m.nego={montant:v,par:F.myPseudo(),date:new Date().toISOString()};
    patch(m,{nego:m.nego});S.inline=null;toast("Proposition transmise au passager.");F.renderStage();return;
  }
  if(k==="bilanok"||k==="bilansave"){
    var r=$("#tdlh-bresume"), c=$("#tdlh-bconseq");
    m.resume=r?String(r.value||"").trim():m.resume;
    m.consequences=c?String(c.value||"").trim():m.consequences;
    var champs={resume:m.resume,consequences:m.consequences};
    if(k==="bilanok"&&m.statut!=="en_validation"){
      if(!m.resume){toast("Écris au moins un résumé.");return;}
      m.statut="en_validation";m.demandeValidation=true;
      champs.statut="en_validation";champs.demandeValidation=true;
      try{if(window.EcoNotif)EcoNotif.staff(103,{pseudo:F.myPseudo(),nom:m.titre});}catch(e){}
    }
    patch(m,champs);S.drawer=null;
    toast(champs.statut?"Clôture demandée.":"Bilan enregistré.");F.renderAll();return;
  }
  if(k==="denok"){denouer(m);return;}
  if(k==="editok"){
    var g=function(id){var e=$(id);return e?String(e.value||"").trim():"";};
    m.titre=g("#tdlh-etitre")||m.titre;
    m.duree=parseInt(g("#tdlh-eduree"),10)||m.duree;
    m.destination=g("#tdlh-edest");
    m.prime=parseInt(g("#tdlh-eprime").replace(/[^\d]/g,""),10)||m.prime;
    m.motif=g("#tdlh-emotif")||m.motif;
    m.restent_pnj=g("#tdlh-epnj");
    m.contexte=g("#tdlh-ectx");
    patch(m,{titre:m.titre,duree:m.duree,destination:m.destination,prime:m.prime,
             motif:m.motif,restent_pnj:m.restent_pnj,contexte:m.contexte});
    S.drawer=null;toast("Termes modifiés.");F.renderAll();return;
  }
}

function brancher(){ /* aucune case à cocher ici : un seul capitaine, pas de participants */ }

/* ===================== DÉNOUEMENT ===================== */
/* Chemins BRUTS pour firebaseUpdate : c'est un PATCH à la racine, jamais
   encodeURIComponent, y compris pour un pseudo qui contient un espace. */
function denouer(m){
  var i=$("#tdlh-dissue"), pj=$("#tdlh-dpj"), pnj=$("#tdlh-dpnj");
  var issue=i?i.value:"", jeu=issuesDe(m);
  var lPar=(m.motif==="dette"&&pj)?pj.value:"";
  var lPnj=(m.motif==="dette"&&pnj)?String(pnj.value||"").trim():"";
  if(!jeu[issue]){toast("Choisis ce qu\u2019est devenu le passager.");return;}

  if(m.motif==="dette"){
    if(issue==="introuvable"&&!lPar&&!lPnj){toast("Introuvable : dis qui a payé à sa place, un PJ ou l\u2019entourage.");return;}
    if(issue==="retrouve"&&(lPar||lPnj)){toast("Retrouvé : personne n\u2019a payé à sa place, la dette lui reste.");return;}
    if(lPar&&lPnj){toast("Un seul payeur : un PJ ou l\u2019entourage, pas les deux.");return;}
  }

  var den={issue:issue, lavee_par:lPar||"", lavee_pnj:lPnj||"", date:new Date().toISOString(), par:F.myPseudo()};
  var chemin=(m.motif==="dette"&&m.demandeur&&m.dette_key)
    ? "membres/"+m.demandeur+"/dettes/"+m.dette_key : null;

  var ecrire={};
  if(chemin&&issue==="introuvable"){
    if(lPar){
      /* la dette change de créancier : elle reste au compte du disparu, mais
         c'est un PJ qui la détient désormais. */
      ecrire[chemin+"/creancier"]=lPar;
      ecrire[chemin+"/motif"]="Dette rachetée pendant sa disparition";
      ecrire[chemin+"/date"]=den.date;
    } else {
      /* l'entourage a payé : la dette sort du grand livre. */
      ecrire[chemin]=null;
    }
  }

  var suite=Object.keys(ecrire).length?window.EcoCore.firebaseUpdate(ecrire):Promise.resolve();
  Promise.resolve(suite).then(function(){
    m.denouement=den;patch(m,{denouement:den});
    S.drawer=null;
    toast(lPar?("Créance transférée à "+lPar+"."):(lPnj?"Dette effacée du grand livre.":"Dénouement enregistré."));
    F.renderAll();
  }).catch(function(){toast("Écriture de la dette impossible \u2014 dénouement non enregistré.");});
}

/* ===================== ARGENT ===================== */
function clore(m){
  if(m.primeVersee){toast("Prime déjà versée.");return;}
  if(!m.capitaine){toast("Aucun capitaine à payer.");return;}
  if(m.motif==="dette"&&!m.denouement){toast(T.DEN_MANQUE);return;}
  if(!window.confirm("Verser "+money(m.prime)+" à "+m.capitaine+" et clore le départ ?"))return;
  F.crediter(m.capitaine,m.prime).then(function(){
    m.primeVersee=true;m.statut="close";m.demandeValidation=false;
    patch(m,{primeVersee:true,statut:"close",demandeValidation:false});
    try{if(window.EcoNotif)EcoNotif.a(m.capitaine,100,{nom:m.titre},"vdi"+m.id);}catch(e){}
    toast("Départ clos, capitaine payé.");F.renderAll();
  }).catch(function(){toast("Versement impossible.");});
}

/* ===================== ÉCHÉANCE 14 JOURS =====================
   Drapeau rembourse posé par TRANSACTION : seul le client qui le fait passer
   false→true rembourse. Pas de double recrédit sur chargements simultanés. */
function auto(list){
  var now=Date.now();
  list.forEach(function(m){
    if(m.statut!=="en_attente"||m.capitaine||m.rembourse)return;
    if(now-new Date(m.cree).getTime()<F.DELAI_REFUS)return;
    var path=F.CFG.RACINE+"/"+SOUS+"/"+encodeURIComponent(m.id)+"/rembourse";
    var pr;
    try{pr=window.EcoCore.firebaseTransaction(path,function(cur){if(cur===true)throw new Error("DEJA");return true;});}
    catch(e){return;}
    Promise.resolve(pr).then(function(){
      m.rembourse=true;m.statut="refusee";
      var credit=(m.demandeur&&m.prime>0)?F.crediter(m.demandeur,m.prime):Promise.resolve();
      return Promise.resolve(credit).then(function(){
        try{if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,101,{nom:m.titre,montant:m.prime},"adi"+m.id);}catch(e){}
        patch(m,{statut:"refusee"});F.renderAll();
      });
    }).catch(function(e){
      if(e&&e.message==="DEJA"){m.rembourse=true;m.statut="refusee";patch(m,{statut:"refusee"});F.renderAll();}
    });
  });
}

/* ===================== DÉCLARATION ===================== */
F.type({
  k:"disparitions", sous:SOUS, label:"Disparition", ic:"fi-tr-fog",
  normaliser:normaliser, sub:sub, tags:tags, panel:panel,
  act:act, doo:doo, brancher:brancher, auto:auto
});

})(window.TDLFlot);
