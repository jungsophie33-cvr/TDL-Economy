/* THE DROWNED LANDS — TABLEAU DES SECRETS · LES SÉANCES
   L'empreinte des âmes : une nuit de sommeil rituel autour d'un objet hérité,
   achetée en boutique et jouée en RP entre le demandeur et une Sorcière.

   LE CYCLE : la fiche naît à la validation de l'achat (quais-staff), ouverte
   aux volontaires. Une Sorcière la prend → LE DÉ TOMBE → le staff écrit le
   fait → le RP se joue → bilan → clôture. Sept jours sans volontaire et le
   staff reprend la séance en mambo PNJ, au même endroit du cycle.

   ORDRE : le dé tombe À LA PRISE, avant que le fait soit écrit. Un fait rédigé
   pour une nuit propre n'est pas le même que pour une amnésie ou un contrecoup.

   DEUX VERROUS, car les deux actes sont irréversibles :
   - « prise » avant le tirage : deux volontaires dans la même fenêtre de veille
     écraseraient l'inscription du premier, chacun avec son propre dé ;
   - « versee » avant la clôture : elle écrit au registre et peut ouvrir une
     créance ; deux clics en écriraient deux.

   CE QUI SORT DE LA SÉANCE : un secret au registre — au nom de la Sorcière si
   elle est jouée, au POT COMMUN si c'est le staff en PNJ, puisque personne ne
   le détient alors. Le demandeur ne peut pas s'y opposer : c'est annoncé sur
   la fiche boutique avant l'achat.

   L’OFFRANDE RESTE EN SUSPENS jusqu’au dénouement (voir rep-lb-argent) : la
   cagnotte des Spectres n’est créditée qu’à la clôture, et « Classer sans
   suite » rend tout au demandeur. Sept jours sans volontaire et l’échéancier
   fait de même, tout seul.

   STATUTS : ceux du socle. À CHARGER après rep-lb-core et rep-lb-argent. */
(function(){
"use strict";
var REG = (window.TDLBayou = window.TDLBayou || { types: [], registre: null });

/* ===================== CONFIG ===================== */
var CFG = { DELAI_VOLONTAIRE:7 };

/* Le dé est PRIVÉ : demandeur, Sorcière et staff. Son risque est
   pharmacologique et informationnel, jamais surnaturel. */
var DES = {
  propre:    {label:"La nuit est propre",       desc:"Rien ne déborde. Ce qui est lu est lu, et rien de plus."},
  aveu:      {label:"Il en a trop dit",         desc:"Sous la Brume, il a laissé échapper quelque chose qu\u2019il ne voulait pas dire. Un second secret entre au registre à la clôture."},
  amnesie:   {label:"Amnésie partielle",        desc:"La Sorcière se souvient d\u2019un passage de la nuit, lui non. À elle de décider si elle le lui dit."},
  contrecoup:{label:"Contrecoup",               desc:"Il se réveille en devant quelque chose. Une créance s\u2019ouvre à la clôture."}
};
var ORDRE_DES = ["propre","aveu","amnesie","contrecoup"];
var NATURES = {
  materiel:"Matériel ou fourniture", transport:"Transport ou passage", abri:"Abri",
  acces:"Accès à un lieu ou à un métier", silence:"Silence ou témoignage",
  mainoeuvre:"Main-d\u2019\u0153uvre", info:"Information à ramener"
};

var T = {
  OBJET:"L\u2019objet", ESPOIR:"Ce que le demandeur espère y trouver",
  DEMANDEUR:"Demandeur", SORC:"Sorcière", OUVERTE:"Ouverte", SUJET:"Sujet RP", RIEN:"—",
  DE:"Le dé de la nuit", FAIT:"Ce que l\u2019objet a livré",
  FAIT_VIDE:"Le staff n\u2019a pas encore écrit le fait. La séance peut commencer sans lui : il arrivera en cours de route.",
  PRIVE:"Lisible du demandeur, de la Sorcière et du staff seulement.",
  APPEL:"Une séance attend une Sorcière", APPEL_AIDE:"Prenez la séance et le dé tombe aussitôt : c\u2019est lui, avec le fait écrit par le staff, qui oriente la nuit.",
  RESTE:function(j){ return j>0?(j+" jour"+(j>1?"s":"")+" avant reprise du staff"):"délai dépassé \u2014 le staff peut reprendre"; },
  PRENDRE:"Je prends la séance", PNJ:"Reprendre en mambo PNJ",
  ECRIRE:"Écrire le fait", ECRIRE_MOD:"Modifier le fait",
  SUJET_BTN:"Renseigner le sujet RP", SUJET_MOD:"Modifier le sujet RP",
  BILAN:"Bilan & validation", BILAN_MOD:"Modifier le bilan",
  CLORE:"Clore la séance", CLASSER:"Classer sans suite", SUPPR:"Supprimer",
  CONF_CLASSER:"Classer cette séance sans suite ?\nL\u2019offrande est rendue au demandeur : la somme lui revient, le secret offert est effacé, la créance de service est fermée. La séance ne produira rien.",
  OK_CLASSER:"Séance classée \u2014 l\u2019offrande est rendue.",
  RIEN_FAIRE:"Rien à faire pour l\u2019instant.",
  ATTEND:"Une Sorcière doit se saisir de la séance.",
  EST_PNJ:"Séance menée par une mambo PNJ.",
  CONF_PRENDRE:"Prendre cette séance ?\nLe dé tombe immédiatement et ne se rejoue pas.",
  CONF_PNJ:"Reprendre cette séance en mambo PNJ ?\nLe dé tombe immédiatement.",
  CONF_SUPPR:"Supprimer définitivement cette séance ?",
  OK_PRISE:"Séance prise \u2014 le dé est tombé.",
  OK_FAIT:"Fait enregistré.", OK_CLOS:"Séance close.",
  DEJA:"Cette séance a déjà été prise ailleurs.",
  ERR_RESUME:"Renseignez au moins le résumé.",
  ERR_RECOLTE:"Écrivez ce qui est remonté pendant la nuit.",
  ERR_AVEU:"Le dé a donné un aveu : écrivez ce qu\u2019il a laissé échapper.",
  ERR_CONTRE:"Le dé a donné un contrecoup : dites ce que les Lwas réclament.",
  CL_TITRE:"Clore la séance", CL_RECOLTE:"Ce qui est remonté pendant la nuit",
  CL_RECOLTE_PH:"Ce que le demandeur a dit sous la Brume, et qu\u2019il ne redira pas éveillé.",
  CL_AVEU:"Ce qu\u2019il a laissé échapper", CL_CONTRE:"Ce que les Lwas réclament",
  CL_NATURE:"Nature de la créance",
  CL_AIDE:"Ce qui est écrit ici entre au registre des secrets et n\u2019en ressort plus."
};

/* ===================== UTILS ===================== */
function estDemandeur(m, api){ var me=api.moi(); return !!me && me===m.demandeur; }
function estMene(m, api){ var me=api.moi(); return !!me && me===m.responsable; }
function voitLeDe(m, api){ return api.staff()||estDemandeur(m, api)||estMene(m, api); }
function attendVolontaire(m){ return m.statut==="ouverte"&&!m.responsable&&!m.pnj; }
function joursRestants(m, api){ return api.joursRestants(m.ouverte, CFG.DELAI_VOLONTAIRE); }
function tirer(){ return ORDRE_DES[Math.floor(Math.random()*ORDRE_DES.length)]; }
function deLbl(k){ return (DES[k]&&DES[k].label)||T.RIEN; }

/* ===================== NORMALISATION ===================== */
function normaliser(o){
  o.objet=o.objet||"";
  o.espoir=o.espoir||"";
  o.de=DES[o.de]?o.de:null;
  o.prise=!!o.prise;
  o.pnj=!!o.pnj;
  o.fait=o.fait||"";
  o.versee=!!o.versee;
  o.secretId=o.secretId||null;
  o.secretAveuId=o.secretAveuId||null;
  o.creanceId=o.creanceId||null;
}

/* ===================== VISIBILITÉ ===================== */
/* Une séance regarde les Sorcières et celui qui l'a achetée. Un Spectre n'a
   rien à y voir : ce n'est pas une décision collégiale, et le dé est privé. */
function visible(m, api){ return api.staff()||api.estSorciere()||estDemandeur(m, api); }

/* ===================== LISTE ===================== */
function ligne(m, api){
  var tags=[];
  if(attendVolontaire(m)){
    tags.push({l:"cherche une Sorcière", c:"var(--gr1-color)"});
    var j=joursRestants(m, api);
    if(j!=null&&j<=2)tags.push({l:T.RESTE(j), c:"var(--gr6-color)"});
  }
  if(m.pnj)tags.push({l:"PNJ", c:"var(--cntr)"});
  if(m.de&&!m.fait&&api.staff())tags.push({l:"⚑ fait à écrire"});
  if(m.demandeValidation)tags.push({l:"⚑ validation"});
  return { titre:m.titre, sous:(m.demandeur||T.RIEN), tags:tags };
}

/* ===================== PANNEAU ===================== */
function blocDe(m, api){
  if(!m.de||!voitLeDe(m, api))return "";
  var d=DES[m.de];
  return '<div class="tdlm-negobox"><p class="tdlm-hsec">'+T.DE+'</p>'
    +'<div class="tdlm-negorow"><span><b>'+api.esc(d.label)+'</b> \u2014 '+api.esc(d.desc)+'</span></div>'
    +'<div class="tdlm-negorow"><span class="tdlm-todo">'+T.PRIVE+'</span></div></div>';
}
function panel(m, api){
  var esc=api.esc, escAttr=api.escAttr;

  var meta='<div class="tdlm-dp-meta">'
    +'<div class="tdlm-m"><span class="tdlm-k">'+T.DEMANDEUR+'</span><span class="tdlm-v">'+esc(m.demandeur||T.RIEN)+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">'+T.SORC+'</span><span class="tdlm-v">'
      +(m.responsable?esc(m.responsable):(m.pnj?'<span class="tdlm-todo">mambo PNJ</span>':'<span class="tdlm-todo">à désigner</span>'))+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">'+T.OUVERTE+'</span><span class="tdlm-v">'+esc(api.dateFr(m.cree))+'</span></div>'
    +(m.sujet?'<div class="tdlm-m"><span class="tdlm-k">'+T.SUJET+'</span><span class="tdlm-v">'
      +'<a class="tdlm-lien" href="'+escAttr(m.sujet)+'" target="_blank" rel="noopener">Ouvrir le sujet →</a></span></div>':"")
    +'</div>';

  var bandeaux="";
  if(attendVolontaire(m)){
    var j=joursRestants(m, api);
    bandeaux+='<div class="tdlm-reqbanner"><p class="tdlm-hsec">'+T.APPEL+'</p>'
      +'<div class="tdlm-reqrow"><span>'+esc(T.APPEL_AIDE)+'</span></div>'
      +(j!=null?'<div class="tdlm-reqrow"><span class="tdlm-todo">'+esc(T.RESTE(j))+'</span></div>':"")
      +(api.estSorciere()?'<div class="tdlm-reqrow"><span class="tdlm-negoact">'
        +'<button class="tdlm-abtn prim" data-act="prendre">'+T.PRENDRE+'</button></span></div>':"")
      +((api.staff()&&j===0)?'<div class="tdlm-reqrow"><span class="tdlm-negoact">'
        +'<button class="tdlm-abtn" data-act="pnj">'+T.PNJ+'</button></span></div>':"")
      +'</div>';
  }
  if(m.pnj)bandeaux+='<div class="tdlm-negobox"><div class="tdlm-negorow"><span class="tdlm-todo">'+T.EST_PNJ+'</span></div></div>';
  bandeaux+=blocDe(m, api);
  if(api.staff()&&m.de&&!m.fait){
    bandeaux+='<div class="tdlm-reqbanner"><p class="tdlm-hsec">⚑ Le fait reste à écrire</p>'
      +'<div class="tdlm-reqrow"><span>Le dé est tombé : écrivez un fait, un seul, court, que le joueur ne connaissait pas.</span></div></div>';
  }
  if(api.staff()&&m.demandeValidation){
    bandeaux+='<div class="tdlm-reqbanner"><p class="tdlm-hsec">⚑ Le bilan attend votre lecture</p>'
      +'<div class="tdlm-reqrow"><span>Relisez le bilan, puis clos la séance.</span></div></div>';
  }

  var corps='<div class="tdlm-sec"><p class="tdlm-hsec">'+T.OBJET+'</p>'
    +'<div class="tdlm-prose">'+(m.objet?esc(m.objet):'<span class="tdlm-todo">'+T.RIEN+'</span>')+'</div></div>';
  if(m.espoir)corps+='<div class="tdlm-sec"><p class="tdlm-hsec">'+T.ESPOIR+'</p>'
    +'<div class="tdlm-prose">'+esc(m.espoir)+'</div></div>';
  if(voitLeDe(m, api)){
    corps+='<div class="tdlm-sec"><p class="tdlm-hsec">'+T.FAIT+'</p><div class="tdlm-prose">'
      +(m.fait?esc(m.fait):'<span class="tdlm-todo">'+T.FAIT_VIDE+'</span>')+'</div></div>';
  }
  if(m.resume||m.consequences||m.statut==="en_validation"||m.statut==="close"){
    corps+='<div class="tdlm-sec"><p class="tdlm-hsec">Résumé</p><div class="tdlm-prose">'
      +(m.resume?esc(m.resume):'<span class="tdlm-todo">'+T.RIEN+'</span>')+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Conséquences</p><div class="tdlm-prose">'
      +(m.consequences?esc(m.consequences):'<span class="tdlm-todo">'+T.RIEN+'</span>')+'</div></div>';
  }
  return meta+bandeaux+corps;
}

/* ===================== BARRE D'ACTION ===================== */
function actionbar(m, api){
  var roles=[], btns="", mene=estMene(m, api)||(m.pnj&&api.staff());

  if(mene&&(m.statut==="saisie"||m.statut==="en_validation")){
    btns+='<button class="tdlm-abtn" data-act="sujet">'+(m.sujet?T.SUJET_MOD:T.SUJET_BTN)+'</button>'
      +'<button class="tdlm-abtn prim" data-act="bilan">'+(m.statut==="en_validation"?T.BILAN_MOD:T.BILAN)+'</button>';
  }
  if(api.estSorciere())roles.push("Sorcière");
  if(estDemandeur(m, api))roles.push("Demandeur");
  if(api.staff()){
    roles.push("Staff");
    if(m.de)btns+='<button class="tdlm-abtn" data-act="fait">'+(m.fait?T.ECRIRE_MOD:T.ECRIRE)+'</button>';
    if(m.statut==="en_validation"||m.statut==="saisie"){
      btns+='<button class="tdlm-abtn prim" data-act="clore">'+T.CLORE+'</button>'
        +'<button class="tdlm-abtn warn" data-act="classer">'+T.CLASSER+'</button>';
    }
    btns+='<button class="tdlm-abtn warn" data-act="supprimer">'+T.SUPPR+'</button>';
  }
  if(!btns){
    if(attendVolontaire(m))btns='<span class="tdlm-idle">'+T.ATTEND+'</span>';
    else btns='<span class="tdlm-idle">'+T.RIEN_FAIRE+'</span>';
  }
  if(!roles.length)roles.push(api.connecte()?"Visiteur":"Invité");
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles.join(" · ")+'</span>'+btns+'</div>';
}

/* ===================== TIROIRS ===================== */
function drawer(m, api){
  var esc=api.esc, S=api.etat();
  if(S.inline==="sujet"){
    return '<div class="tdlm-drawer on"><h4>'+T.SUJET+'</h4>'
      +'<input type="text" id="tdlb-sea-sujet" value="'+api.escAttr(m.sujet)+'" placeholder="https://thedrownedlands.forumactif.com/t...">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="sujetok">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="fait"){
    return '<div class="tdlm-drawer on"><h4>'+T.FAIT+'</h4>'
      +'<p class="tdlm-todo" style="margin:0 0 8px">Un fait, un seul, court : un nom, une date, une raison, un tort. '
      +'Quelque chose que le joueur ne possédait pas, et qu\u2019il ne pouvait pas inventer lui-même. '
      +'Le dé est tombé : <b>'+esc(deLbl(m.de))+'</b>.</p>'
      +'<textarea id="tdlb-sea-fait">'+esc(m.fait)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="faitok">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="bilan"){
    return '<div class="tdlm-drawer on"><h4>Bilan de la séance</h4>'
      +'<label class="tdlm-fl">Résumé</label><textarea id="tdlb-sea-resume">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Conséquences</label><textarea id="tdlb-sea-conseq" placeholder="Ce que la nuit laisse derrière\u2026">'+esc(m.consequences)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="bilanok">'
      +(m.statut==="en_validation"?"Enregistrer":"Envoyer en validation")+'</button>'
      +(m.statut!=="en_validation"?'<button class="tdlm-abtn" data-do="bilansave">Enregistrer sans envoyer</button>':"")
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="cloture"){
    var h='<div class="tdlm-drawer on"><h4>'+T.CL_TITRE+'</h4>'
      +'<p class="tdlm-todo" style="margin:0 0 8px">'+esc(T.CL_AIDE)+'</p>'
      +'<label class="tdlm-fl">'+T.CL_RECOLTE+'</label>'
      +'<textarea id="tdlb-sea-recolte" placeholder="'+api.escAttr(T.CL_RECOLTE_PH)+'"></textarea>';
    if(m.de==="aveu")h+='<label class="tdlm-fl">'+T.CL_AVEU+'</label><textarea id="tdlb-sea-aveu"></textarea>';
    if(m.de==="contrecoup"){
      h+='<label class="tdlm-fl">'+T.CL_NATURE+'</label><select id="tdlb-sea-nat">'
        +Object.keys(NATURES).map(function(k){return '<option value="'+k+'">'+esc(NATURES[k])+'</option>';}).join("")
        +'</select><label class="tdlm-fl">'+T.CL_CONTRE+'</label><textarea id="tdlb-sea-contre"></textarea>';
    }
    return h+'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="cloturok">'+T.CLORE+'</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

/* ===================== ACTIONS ===================== */
/* Verrou AVANT le tirage : deux volontaires dans la même fenêtre de veille
   écraseraient l'inscription du premier, chacun avec son propre dé. */
function prendre(m, api, pnj){
  if(!window.confirm(pnj?T.CONF_PNJ:T.CONF_PRENDRE))return;
  api.verrou(api.NODE, m.id, "prise").then(function(){
    var me=api.moi(), de=tirer();
    m.prise=true; m.de=de; m.statut="saisie";
    m.responsable=pnj?null:me; m.pnj=!!pnj;
    api.patch(m,{prise:true, de:de, statut:"saisie", responsable:m.responsable, pnj:m.pnj});
    try{ if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,218,{},"pri"+m.id); }catch(e){}
    try{ if(window.EcoNotif)EcoNotif.staff(219,{titre:m.titre},"fai"+m.id); }catch(e){}
    api.toast(T.OK_PRISE); api.rendre();
  }).catch(function(e){
    if(api.estDeja(e)){api.toast(T.DEJA);api.rendre();return;}
    api.toast("La séance n\u2019a pas pu être prise.");
  });
}

/* La clôture écrit au registre et peut ouvrir une créance : verrou d'abord.
   COMPROMIS ASSUMÉ, comme ailleurs : si une écriture échoue après la prise du
   verrou, la séance reste marquée versée. Le message le dit. */
function clore(m, api){
  var v=function(id){var el=document.getElementById(id);return el?String(el.value||"").trim():"";};
  var recolte=v("tdlb-sea-recolte");
  if(!recolte){api.toast(T.ERR_RECOLTE);return;}
  var aveu=(m.de==="aveu")?v("tdlb-sea-aveu"):"";
  if(m.de==="aveu"&&!aveu){api.toast(T.ERR_AVEU);return;}
  var contre=(m.de==="contrecoup")?v("tdlb-sea-contre"):"";
  var nat=(m.de==="contrecoup")?v("tdlb-sea-nat"):"";
  if(m.de==="contrecoup"&&!contre){api.toast(T.ERR_CONTRE);return;}

  api.verrou(api.NODE, m.id, "versee").then(function(){
    m.versee=true;
    var now=new Date().toISOString();
    var base={
      schema:api.SCHEMA, origine:"seance", demandeId:"", deposant:m.demandeur||"",
      article:"empreinte", intitule:"", recueilliPar:m.pnj?null:m.responsable,
      etat:m.pnj?"pot":"prive", usage:"dormant",
      deOuvert:false, fuite:null, rumeur:null, cree:now
    };
    var un={}; for(var k in base)if(base.hasOwnProperty(k))un[k]=base[k];
    un.contenu=recolte;
    return api.ecrireSecret(un, "secret recueilli en séance").then(function(id){
      m.secretId=id;
      if(!aveu)return null;
      var deux={}; for(var k2 in base)if(base.hasOwnProperty(k2))deux[k2]=base[k2];
      deux.contenu=aveu; deux.origine="seance_aveu";
      return api.ecrireSecret(deux, "aveu recueilli en séance").then(function(id2){ m.secretAveuId=id2; });
    });
  }).then(function(){
    if(!contre)return null;
    var now2=new Date().toISOString();
    return api.creer({
      schema:api.SCHEMA, type:"creance", origine:"reclame",
      titre:"Contrecoup \u2014 "+(m.demandeur||"?"),
      debiteur:m.demandeur||"", nature:nat||"", detail:contre,
      reference:"Séance : "+m.titre, article:"empreinte",
      demandeur:null, statut:"reponse_attendue", responsable:m.pnj?null:m.responsable,
      reponse:null, jeton:false,
      sujet:"", resume:"", consequences:"", demandeValidation:false,
      cree:now2, ouverte:now2, clos:null
    },"contrecoup de séance").then(function(idc){
      m.creanceId=idc;
      try{ if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,210,{},"cre"+idc); }catch(e){}
    });
  }).then(function(){
    /* la séance a produit du jeu : l’offrande est acquise aux Sorcières */
    return window.TDLBayou.argent.aboutir(api, m);
  }).then(function(){
    m.statut="close"; m.demandeValidation=false; m.clos=new Date().toISOString();
    api.patch(m,{statut:"close", demandeValidation:false, clos:m.clos, versee:true,
                 secretId:m.secretId, secretAveuId:m.secretAveuId, creanceId:m.creanceId});
    api.fermer(); api.toast(T.OK_CLOS); api.rendre();
  }).catch(function(e){
    if(api.estDeja(e)){api.toast("Séance déjà close ailleurs \u2014 rien n\u2019a été écrit une seconde fois.");api.rendre();return;}
    api.toast("Clôture incomplète \u2014 la séance est marquée versée : vérifiez le registre avant de la reclore.");
    api.rendre();
  });
}

function acte(k, m, api){
  if(!m)return;
  if(k==="prendre"){ if(api.estSorciere())prendre(m, api, false); return; }
  if(k==="pnj"){ if(api.staff())prendre(m, api, true); return; }
  if(k==="sujet"){api.inline("sujet");return;}
  if(k==="fait"){api.tiroir("fait");return;}
  if(k==="bilan"){api.tiroir("bilan");return;}
  if(k==="clore"){api.tiroir("cloture");return;}
  if(k==="classer"){
    if(!api.staff())return;
    if(!window.confirm(T.CONF_CLASSER))return;
    /* Le secret recueilli PENDANT la séance, s’il y en a un, n’est pas touché :
       il a été lu, il existe. Seule l’offrande qui a payé la séance est rendue. */
    window.TDLBayou.argent.annuler(api, m).then(function(ok){
      if(!ok)return;
      m.statut="classee"; m.demandeValidation=false; m.clos=new Date().toISOString();
      api.patch(m,{statut:"classee", demandeValidation:false, clos:m.clos});
      try{ if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,216,{},"cla"+m.id); }catch(e){}
      api.toast(T.OK_CLASSER); api.rendre();
    });
    return;
  }
  if(k==="supprimer"){
    if(!window.confirm(T.CONF_SUPPR))return;
    api.supprimer(m); api.toast("Séance supprimée."); api.rendre(); return;
  }
}

function faire(k, m, api){
  if(!m)return;
  if(k==="sujetok"){
    var el=document.getElementById("tdlb-sea-sujet");
    var u=el?String(el.value||"").trim():"";
    m.sujet=u; api.patch(m,{sujet:u}); api.fermer();
    api.toast(u?"Sujet RP enregistré.":"Sujet RP retiré."); return;
  }
  if(k==="faitok"){
    var f=document.getElementById("tdlb-sea-fait");
    m.fait=f?String(f.value||"").trim():"";
    api.patch(m,{fait:m.fait}); api.fermer();
    try{ if(window.EcoNotif&&m.fait){
      if(m.demandeur)EcoNotif.a(m.demandeur,220,{},"fac"+m.id);
      if(m.responsable)EcoNotif.a(m.responsable,220,{},"fas"+m.id);
    } }catch(e){}
    api.toast(T.OK_FAIT); api.rendre(); return;
  }
  if(k==="bilanok"||k==="bilansave"){
    var r=document.getElementById("tdlb-sea-resume"), c=document.getElementById("tdlb-sea-conseq");
    m.resume=r?String(r.value||"").trim():"";
    m.consequences=c?String(c.value||"").trim():"";
    var champs={resume:m.resume, consequences:m.consequences};
    if(k==="bilanok"&&m.statut!=="en_validation"){
      if(!m.resume){api.toast(T.ERR_RESUME);return;}
      m.statut="en_validation"; m.demandeValidation=true;
      champs.statut="en_validation"; champs.demandeValidation=true;
    }
    api.patch(m,champs);
    try{ if(window.EcoNotif&&champs.statut)EcoNotif.staff(215,{titre:m.titre},"val"+m.id); }catch(e){}
    api.fermer();
    api.toast(champs.statut?"Séance envoyée en validation.":"Bilan enregistré."); return;
  }
  if(k==="cloturok"){ clore(m, api); return; }
}

/* ===================== ENREGISTREMENT ===================== */
/* Pas de creer() : une séance naît toujours d'un achat en boutique, jamais
   d'un bouton du tableau. */
REG.types.push({
  k:"seance", label:"Séance", icon:"fi-tr-moon-stars",
  normaliser:normaliser, visible:visible, ligne:ligne, panel:panel,
  actionbar:actionbar, drawer:drawer, acte:acte, faire:faire
});
})();
