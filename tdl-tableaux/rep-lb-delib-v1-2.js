/* THE DROWNED LANDS — TABLEAU DES SECRETS · LES DÉLIBÉRATIONS
   Se servir d'un secret — le monnayer, l'employer, le lâcher — exige TROIS
   VOIX. Un secret gardé pour soi reste donc inutilisable : pour agir dessus,
   il faut d'abord le verser au pot. C'est le dilemme de la bande.

   CE QUE LA FICHE MONTRE, ET À QUI. Les Spectres votent ici comme à
   l'avant-poste, mais ils ne lisent pas le secret : la fiche ne porte qu'une
   COPIE de son intitulé public, ce qui est proposé, à qui, contre quoi, et les
   voix. Le contenu reste au registre, chez les Sorcières. Le Baron regarde, il
   ne lit pas.

   LE D4 DE FUITE. Il tombe à l'OUVERTURE de la délibération, une seule fois
   par secret (le drapeau vit sur le secret, pas sur la fiche). Une chance sur
   quatre. Le résultat DORT : l'avis ne part que deux à quatre jours plus tard,
   délai lui aussi tiré au hasard — sans ce décalage, les Sorcières sauraient
   aussitôt quel secret est sorti. L'avis est anonyme pour tout le monde, la
   dépositaire comprise ; seul le staff voit sur quel secret il a porté.

   PAS DE CRON SUR FORUMACTIF : les fuites échues sont déclenchées par les
   sessions ouvertes (Sorcières et staff), sous verrou — comme la réconciliation
   périodique du socle rattrape les entrées écrites sans sentinelle.

   STATUTS : ceux du socle — ouverte (le vote), close (appliquée), classée
   (refusée). À CHARGER après rep-lb-core et rep-lb-secrets. */
(function(){
"use strict";
var REG = (window.TDLBayou = window.TDLBayou || { types: [], registre: null });

/* ===================== CONFIG ===================== */
var CFG = {
  QUORUM:3, APPOINT_MAX:1,
  FUITE_SUR:4,          /* d4 : une chance sur quatre          */
  FUITE_MIN:2, FUITE_MAX:4,   /* jours avant que l'avis ne parte */
  NODE_MAIN:"dossiers_main",
  SCHEMA_MAIN:2,        /* doit suivre rep-det-main            */
  VEILLE_FUITE_MS:60000,
  URL_COURIER:"https://thedrownedlands.forumactif.com/t102-the-houma-courier#hc=rumeur-"
};
/* miroir de CFG.SECTEURS dans tdlhc-volet — [MAJ] si la liste y change */
var SECTEURS = ["Houma","Bayou Cane","Bayou Blue","Bourg","Ashland","Montegut","Chauvin","Cocodrie"];
var ACTES = {
  monnayer:{label:"Monnayer",  usage:"monnaye", desc:"Le céder à quelqu\u2019un de nommé, contre une offrande."},
  employer:{label:"Employer",  usage:"employe", desc:"S\u2019en servir contre quelqu\u2019un, sans le rendre public."},
  lacher:  {label:"Lâcher",    usage:"lache",   desc:"Le laisser courir. Il part en rumeur au Houma Courier."}
};
var T = {
  SECRET:"Le secret", PROPOSE:"Ce qui est proposé", CIBLE:"À qui, ou contre qui",
  CONTRE:"Contre quoi", OUVERTE:"Ouverte", RIEN:"—", VOIX:"Les voix",
  VOIX_AIDE:"Trois voix décident, dont au plus une de Spectre ou du staff. Le contenu du secret n\u2019est pas montré ici : on vote sur ce qu\u2019on en fait, pas sur ce qu\u2019il dit.",
  OUI:"Pour", NON:"Contre", VOTE_OUI:"Je suis pour", VOTE_NON:"Je suis contre",
  DEJA_VOTE:"Votre voix est consignée.",
  PAS_VOIX:"Cette décision ne vous revient pas.",
  AVIS:"Un secret n\u2019est pas tombé dans l\u2019oreille d\u2019un sourd.",
  AVIS_STAFF:function(s){ return "Fuite partie le "+s+" \u2014 visible du staff seul."; },
  FUITE_DORT:"Une fuite est en sommeil sur ce secret.",
  RUMEUR:"La rumeur", RUMEUR_VIDE:"La rumeur reste à écrire par la Sorcière qui a mené la délibération.",
  RUMEUR_BTN:"Écrire la rumeur", RUMEUR_MOD:"Modifier la rumeur",
  RUMEUR_AIDE:"Écrivez-la comme on la répète au marché. Elle consomme votre rumeur de la semaine au Courier, et elle paraîtra après relecture de la rédaction.",
  RUMEUR_ATTENTE:"À soumettre au Courier",
  RUMEUR_SECTEUR:"Où elle court",
  COURIER:"Soumettre au Courier", COURIER_FAIT:"Soumise au Courier",
  COURIER_AIDE:"Le volet du Courier s\u2019ouvrira sur la page du journal, déjà rempli. La rédaction relira avant parution.",
  ERR_RUM_VIDE:"Écrivez la rumeur avant de la soumettre.",
  CLORE:"Clore", REFUSER:"Refuser", SUPPR:"Supprimer",
  RIEN_FAIRE:"Rien à faire pour l\u2019instant.",
  CONF_REF:"Refuser cette délibération ?\nLe secret retourne dormant.",
  CONF_SUPPR:"Supprimer définitivement cette délibération ?",
  OK_VOIX:"Voix consignée.", OK_ACC:"Décision prise \u2014 le secret est marqué.",
  OK_REF:"Délibération refusée \u2014 le secret retourne dormant.",
  OK_RUMEUR:"Rumeur enregistrée.",
  NEUF:"Ouvrir une délibération", NEUF_TITRE:"Ouvrir une délibération",
  AVANT:"Vous proposez de vous servir d\u2019un secret. Dites lequel, ce que vous voulez en faire, et ce que la bande y gagne. Trois voix trancheront \u2014 et ce que vous écrivez ici sera lu par les Spectres, qui ne lisent pas le secret lui-même.",
  F_SECRET:"Le secret", F_ACTE:"Ce que vous proposez", F_CIBLE:"À qui, ou contre qui",
  F_CIBLE_PH:"Un personnage, une famille, un groupe", F_CONTRE:"Contre quoi",
  F_CONTRE_PH:"Une offrande, un service, rien du tout\u2026",
  F_INTITULE:"Intitulé public du secret", F_INTITULE_PH:"Une ligne, sans rien livrer : ce que les Spectres liront.",
  F_OUVRIR:"Ouvrir la délibération",
  ERR_FORM:"Choisissez un secret et ce que vous proposez.",
  ERR_INTITULE:"Écrivez l\u2019intitulé public : les Spectres n\u2019auront que lui.",
  ERR_AUCUN:"Aucun secret disponible : versez-en un au pot, ou attendez qu\u2019il en arrive.",
  OK_NEUF:"Délibération ouverte."
};

/* ===================== UTILS ===================== */
function acteLbl(k){ return (ACTES[k]&&ACTES[k].label)||T.RIEN; }
function enVote(m){ return m.statut==="ouverte"&&!m.decide; }
function compter(m, api, choix){
  var V=m.votes||{}, sorc=0, appoint=0;
  Object.keys(V).forEach(function(p){
    var v=V[p]; if(!v||v.choix!==choix)return;
    if(api.estSorciere(v.pseudo||p))sorc++; else appoint++;
  });
  return sorc+Math.min(appoint, CFG.APPOINT_MAX);
}
function maVoix(m, api){
  var me=api.moi(); if(!me)return null;
  var V=m.votes||{}, k=api.cle(me);
  return V[k]||V[me]||null;
}
/* Secrets sur lesquels une délibération peut s'ouvrir : au pot, ou recueillis
   par celle qui ouvre. Un secret déjà employé ne se rejoue pas. */
function secretsOuvrables(api){
  var me=api.moi();
  return api.secrets().filter(function(s){
    if(s.usage!=="dormant")return false;
    return s.etat==="pot"||s.recueilliPar===me||api.staff();
  });
}
function dansUneDelib(api, secretId){
  return api.fiches().some(function(f){
    return f.type==="delib"&&f.secretId===secretId&&f.statut==="ouverte";
  });
}

/* ===================== NORMALISATION ===================== */
function normaliser(o){
  o.secretId=o.secretId||"";
  o.intitule=o.intitule||"";
  o.acte=ACTES[o.acte]?o.acte:"employer";
  o.cible=o.cible||"";
  o.contrepartie=o.contrepartie||"";
  o.decide=(o.decide&&o.decide.date)?o.decide:null;
  o.tranche=!!o.tranche;
  o.fuite=(o.fuite&&o.fuite.du)?o.fuite:null;   /* {du:ISO, faite:bool} */
  o.de4=+o.de4||0;                              /* face tirée, 0 = dé non tiré ici */
  o.murmureId=o.murmureId||null;
  o.rumeur=o.rumeur||"";
  o.secteur=o.secteur||"";
  o.rumeurSoum=o.rumeurSoum||null;
}

/* ===================== VISIBILITÉ ===================== */
/* Les Spectres votent, donc ils voient — mais la fiche ne porte que
   l'intitulé public. Le contenu reste au registre. */
function visible(m, api){ return api.staff()||api.estSorciere()||api.estSpectre(); }

/* ===================== LISTE ===================== */
function ligne(m, api){
  var tags=[{l:acteLbl(m.acte), c:"var(--gr4-color)"}];
  if(enVote(m))tags.push({l:compter(m, api, "oui")+"/"+CFG.QUORUM+" voix"});
  if(m.acte==="lacher"&&m.decide&&m.decide.choix==="acceptee"&&!m.rumeurSoum)
    tags.push({l:T.RUMEUR_ATTENTE, c:"var(--gr1-color)"});
  return { titre:m.titre, sous:(m.intitule||T.RIEN), tags:tags };
}

/* ===================== PANNEAU ===================== */
function blocVoix(m, api){
  var esc=api.esc, V=m.votes||{}, oui=compter(m, api, "oui"), non=compter(m, api, "non");
  var lignes=Object.keys(V).map(function(k){
    var v=V[k]||{}, p=v.pseudo||k;
    return '<div class="tdlm-person">'+api.av(p)+'<span class="tdlm-pname">'+esc(p)+'</span>'
      +'<span class="tdlm-r">'+(v.choix==="oui"?T.OUI:T.NON)+'</span></div>';
  }).join("");
  var moi=maVoix(m, api), btns="";
  if(enVote(m)&&api.peutVoter()&&!moi){
    btns='<span class="tdlm-negoact"><button class="tdlm-abtn prim" data-act="oui">'+T.VOTE_OUI+'</button>'
      +'<button class="tdlm-abtn warn" data-act="non">'+T.VOTE_NON+'</button></span>';
  }
  return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd">'
    +'<span class="tdlm-hsec" style="margin:0">'+T.VOIX+' \u2014 '+oui+' '+T.OUI.toLowerCase()
    +', '+non+' '+T.NON.toLowerCase()+'</span>'+btns+'</div>'
    +(lignes||'<p class="tdlm-todo" style="margin:0">Personne ne s\u2019est encore prononcé.</p>')
    +'<p class="tdlm-todo" style="margin:6px 0 0">'+esc(T.VOIX_AIDE)+'</p>'
    +(moi?'<p class="tdlm-todo" style="margin:4px 0 0">'+T.DEJA_VOTE+'</p>':"")
    +'</div>';
}
function panel(m, api){
  var esc=api.esc;

  var meta='<div class="tdlm-dp-meta">'
    +'<div class="tdlm-m"><span class="tdlm-k">'+T.PROPOSE+'</span><span class="tdlm-v">'+esc(acteLbl(m.acte))+'</span></div>'
    +(m.cible?'<div class="tdlm-m"><span class="tdlm-k">'+T.CIBLE+'</span><span class="tdlm-v">'+esc(m.cible)+'</span></div>':"")
    +(m.contrepartie?'<div class="tdlm-m"><span class="tdlm-k">'+T.CONTRE+'</span><span class="tdlm-v">'+esc(m.contrepartie)+'</span></div>':"")
    +'<div class="tdlm-m"><span class="tdlm-k">Menée par</span><span class="tdlm-v">'
      +(m.responsable?esc(m.responsable):'<span class="tdlm-todo">'+T.RIEN+'</span>')+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">'+T.OUVERTE+'</span><span class="tdlm-v">'+esc(api.dateFr(m.cree))+'</span></div>'
    +'</div>';

  var bandeaux="";
  if(m.decide){
    bandeaux+='<div class="tdlm-negobox"><p class="tdlm-hsec">Décision</p><div class="tdlm-negorow"><span>'
      +'<b>'+(m.decide.choix==="acceptee"?"Acceptée":"Refusée")+'</b> le '+esc(api.dateFr(m.decide.date))
      +' \u00b7 '+esc(String(m.decide.oui||0))+' voix</span></div></div>';
  }
    /* Le staff seul sait qu'une fuite dort sur ce secret, et sur lequel. */
  if(api.staff()){
    var dd;
    if(!m.de4)dd="Dé non tiré sur cette fiche \u2014 le secret avait déjà été joué lors d\u2019une délibération précédente.";
    else if(!m.fuite)dd="Dé de fuite : "+m.de4+" sur "+CFG.FUITE_SUR+" \u2014 le secret a tenu.";
    else if(!m.fuite.faite)dd="Dé de fuite : "+m.de4+" sur "+CFG.FUITE_SUR+" \u2014 "+esc(T.FUITE_DORT)+" Avis prévu le "+esc(api.dateFr(m.fuite.du))+".";
    else dd="Dé de fuite : "+m.de4+" sur "+CFG.FUITE_SUR+" \u2014 "+esc(T.AVIS_STAFF(api.dateFr(m.fuite.du)));
    bandeaux+='<div class="tdlm-negobox"><p class="tdlm-hsec">Fuite</p>'
      +'<div class="tdlm-negorow"><span class="tdlm-todo">'+dd+'</span></div></div>';
  }

  var corps='<div class="tdlm-sec"><p class="tdlm-hsec">'+T.SECRET+'</p>'
    +'<div class="tdlm-prose">'+(m.intitule?esc(m.intitule):'<span class="tdlm-todo">'+T.RIEN+'</span>')+'</div></div>';
  if(ACTES[m.acte])corps+='<div class="tdlm-sec"><p class="tdlm-hsec">'+T.PROPOSE+'</p>'
    +'<div class="tdlm-prose">'+esc(ACTES[m.acte].desc)+'</div></div>';
  corps+=blocVoix(m, api);
  if(m.acte==="lacher"&&m.decide&&m.decide.choix==="acceptee"){
    corps+='<div class="tdlm-sec"><p class="tdlm-hsec">'+T.RUMEUR+'</p><div class="tdlm-prose">'
      +(m.rumeur?esc(m.rumeur):'<span class="tdlm-todo">'+T.RUMEUR_VIDE+'</span>')+'</div>'
      +(m.secteur?'<p class="tdlm-todo" style="margin:6px 0 0">'+T.RUMEUR_SECTEUR+' : '+esc(m.secteur)+'</p>':"")
      +(m.rumeurSoum?'<p class="tdlm-todo" style="margin:4px 0 0">'+T.COURIER_FAIT+' \u00b7 '+esc(api.dateFr(m.rumeurSoum))+'</p>'
                    :'<p class="tdlm-todo" style="margin:4px 0 0">'+esc(T.COURIER_AIDE)+'</p>')
      +'</div>';
  }
  return meta+bandeaux+corps;
}

/* ===================== BARRE D'ACTION ===================== */
function actionbar(m, api){
  var roles=[], btns="", mene=api.moi()&&api.moi()===m.responsable;
  if(api.estSorciere())roles.push("Sorcière");
  else if(api.estSpectre())roles.push("Spectre");
  if(m.acte==="lacher"&&m.decide&&m.decide.choix==="acceptee"&&(mene||api.staff())&&!m.rumeurSoum){
    btns+='<button class="tdlm-abtn" data-act="rumeur">'+(m.rumeur?T.RUMEUR_MOD:T.RUMEUR_BTN)+'</button>';
    if(m.rumeur)btns+='<button class="tdlm-abtn prim" data-act="courier">'+T.COURIER+'</button>';
  }
  if(api.staff()){
    roles.push("Staff");
    if(enVote(m))btns+='<button class="tdlm-abtn warn" data-act="refuser">'+T.REFUSER+'</button>';
    btns+='<button class="tdlm-abtn warn" data-act="supprimer">'+T.SUPPR+'</button>';
  }
  if(!btns){
    if(enVote(m)&&!api.peutVoter())btns='<span class="tdlm-idle">'+T.PAS_VOIX+'</span>';
    else btns='<span class="tdlm-idle">'+T.RIEN_FAIRE+'</span>';
  }
  if(!roles.length)roles.push(api.connecte()?"Visiteur":"Invité");
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles.join(" · ")+'</span>'+btns+'</div>';
}

/* ===================== TIROIRS ===================== */
function drawer(m, api){
  var esc=api.esc, S=api.etat();
  if(S.drawer==="rumeur"){
    return '<div class="tdlm-drawer on"><h4>'+T.RUMEUR+'</h4>'
      +'<p class="tdlm-todo" style="margin:0 0 8px">'+esc(T.RUMEUR_AIDE)+'</p>'
      +'<label class="tdlm-fl">'+T.RUMEUR_SECTEUR+'</label><select id="tdlb-del-secteur">'
      +SECTEURS.map(function(x){return '<option'+(x===m.secteur?" selected":"")+'>'+esc(x)+'</option>';}).join("")
      +'</select>'
      +'<label class="tdlm-fl">'+T.RUMEUR+'</label><textarea id="tdlb-del-rumeur">'+esc(m.rumeur)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="rumeurok">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

/* ===================== FORMULAIRE ===================== */
function form(api){
  var dispo=secretsOuvrables(api).filter(function(s){ return !dansUneDelib(api, s.id); });
  if(!dispo.length){
    return '<div class="tdlm-dpanel"><div class="tdlm-dp-title"><span class="tdlm-type">'+T.NEUF_TITRE+'</span></div>'
      +'<div class="tdlm-dp-body"><div class="tdlm-empty">'+T.ERR_AUCUN+'</div>'
      +'<div class="tdlm-row" style="padding:0 24px 20px">'
      +'<button class="tdlm-abtn" data-do="newcancel">Retour</button></div></div></div>';
  }
  var f=function(label, inner, full){
    return '<div class="fld'+(full?" full":"")+'"><label class="tdlm-fl">'+label+'</label>'+inner+'</div>';
  };
  var opts=dispo.map(function(s){
    var lbl=(s.intitule||String(s.contenu||"").slice(0,60)+"\u2026")+" \u00b7 "+(s.etat==="pot"?"pot":"privé");
    return '<option value="'+api.escAttr(s.id)+'">'+api.esc(lbl)+'</option>';
  }).join("");
  var g=f(T.F_SECRET,'<select id="tdlb-del-nsec">'+opts+'</select>')
    + f(T.F_ACTE,'<select id="tdlb-del-nacte">'+Object.keys(ACTES).map(function(k){
        return '<option value="'+k+'">'+api.esc(ACTES[k].label)+'</option>'; }).join("")+'</select>')
    + f(T.F_CIBLE,'<input type="text" id="tdlb-del-ncible" placeholder="'+T.F_CIBLE_PH+'">')
    + f(T.F_CONTRE,'<input type="text" id="tdlb-del-ncontre" placeholder="'+T.F_CONTRE_PH+'">')
    + f(T.F_INTITULE,'<textarea id="tdlb-del-nint" placeholder="'+T.F_INTITULE_PH+'"></textarea>', true);
  return '<div class="tdlm-dpanel"><div class="tdlm-dp-title"><span class="tdlm-type">'+T.NEUF_TITRE+'</span></div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-sec"><p class="tdlm-hsec">Avant d\u2019écrire</p>'
    +'<div class="tdlm-prose">'+api.esc(T.AVANT)+'</div></div>'
    +'<div class="tdlm-drawer on" style="margin:0 24px 20px"><div class="tdlm-fgrid">'+g+'</div>'
    +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="newok">'+T.F_OUVRIR+'</button>'
    +'<button class="tdlm-abtn" data-do="newcancel">Annuler</button></div></div></div></div>';
}

/* ===================== LA FUITE ===================== */
function joursFuite(){
  return CFG.FUITE_MIN+Math.floor(Math.random()*(CFG.FUITE_MAX-CFG.FUITE_MIN+1));
}
/* Le d4 ne tombe qu'une fois par SECRET : le drapeau vit sur le secret, pas
   sur la fiche. Un secret qui a tenu une délibération ne se rejoue pas.
   On rend la FACE en plus de la fuite : sans elle, le staff ne peut pas
   distinguer un secret épargné d'un dé jamais tiré. */
function tirerFuite(api, secret){
  if(!secret||secret.deOuvert)return {de4:0, fuite:null};
  api.patchSecret(secret,{deOuvert:true});
  secret.deOuvert=true;
  var face=1+Math.floor(Math.random()*CFG.FUITE_SUR);
  if(face!==1)return {de4:face, fuite:null};
  var d=new Date(); d.setDate(d.getDate()+joursFuite());
  return {de4:face, fuite:{du:d.toISOString(), faite:false}};
}
/* Le dossier de la Main : aucun demandeur, aucune cible jouable — la règle de
   visibilité de rep-det-main laisserait sinon le PJ visé lire son propre
   dossier, donc le secret. Le nom va dans evoquees. */
function ouvrirMurmure(api, m, secret){
  var now=new Date().toISOString(), id=api.nouvelId();
  var o={
    schema:CFG.SCHEMA_MAIN, type:"murmure", origine:"sorcieres",
    titre:"Un murmure remonté du bayou", service:"", doigt:null, ouvertTous:true,
    demandeur:null, cible_type:"aucune", cible:"", protege:"",
    contexte:(secret&&secret.contenu)||"", objectif:"", evoquees:(m.cible||""),
    contraintes:[], montant:0, dette:null, accord:null, defaut:null,
    certitude:null, urgence:"",
    prixIndicatif:0, prixPropose:0, issue:null, prixFinal:null,
    prime:0, primeVersee:false, phase:null, phaseService:false, phase1:null,
    statut:"ouvert", responsable:null,
    sujet:"", resume:"", consequences:"", conclusion:null,
    demandeValidation:false, verse:false,
    cree:now, ouverte:now, clos:null
  };
  return Promise.resolve(window.TDLBase.ecrireEntree(CFG.NODE_MAIN, id, o, "murmure remonté à la Main"))
    .then(function(ok){
      if(!ok)return null;
      try{ if(window.EcoNotif)EcoNotif.bande("main",221,{},"mur"+id); }catch(e){}
      return id;
    });
}
/* Pas de cron sur FA : les sessions ouvertes déclenchent les fuites échues,
   sous verrou. L'avis à la bande ne dit jamais QUEL secret est sorti. */
function echeances(api){
  if(!(api.estSorciere()||api.staff()))return;
  api.fiches().forEach(function(m){
    if(m.type!=="delib"||!m.fuite||m.fuite.faite)return;
    if(new Date(m.fuite.du).getTime()>Date.now())return;
    api.verrou(api.NODE, m.id, "fuiteFaite").then(function(){
      var s=api.secret(m.secretId);
      return ouvrirMurmure(api, m, s);
    }).then(function(idm){
      m.fuite.faite=true; m.murmureId=idm||null;
      api.patch(m,{fuite:m.fuite, murmureId:m.murmureId});
      try{ if(window.EcoNotif)EcoNotif.bande("sorcieres",222,{},"fui"+m.id); }catch(e){}
      api.rendre();
    }).catch(function(){ /* un autre onglet s'en est chargé, ou le réseau a lâché */ });
  });
}

/* ===================== ACTIONS ===================== */
function voter(m, api, choix){
  var me=api.moi(); if(!me||!api.peutVoter()||maVoix(m, api))return;
  var k=api.cle(me), voix={choix:choix, pseudo:me, date:new Date().toISOString()};
  m.votes[k]=voix;
  var champs={}; champs["votes/"+k]=voix;
  api.patch(m, champs);
  api.toast(T.OK_VOIX);
  var oui=compter(m, api, "oui"), non=compter(m, api, "non");
  if(oui>=CFG.QUORUM)trancher(m, api, "acceptee", oui);
  else if(non>=CFG.QUORUM)trancher(m, api, "refusee", non);
  else api.rendre();
}
function trancher(m, api, choix, voix){
  api.verrou(api.NODE, m.id, "tranche").then(function(){
    var s=api.secret(m.secretId);
    m.statut=(choix==="acceptee")?"close":"classee";
    m.decide={choix:choix, date:new Date().toISOString(), oui:voix};
    m.clos=m.decide.date;
    api.patch(m,{statut:m.statut, decide:m.decide, clos:m.clos, tranche:true});
    if(s){
      var u=(choix==="acceptee")?ACTES[m.acte].usage:"dormant";
      s.usage=u; api.patchSecret(s,{usage:u});
    }
    api.toast(choix==="acceptee"?T.OK_ACC:T.OK_REF);
    api.rendre();
  }).catch(function(e){
    if(api.estDeja(e)){api.rendre();return;}
    api.toast("La décision n\u2019a pas pu être enregistrée.");
  });
}

function acte(k, m, api){
  if(!m)return;
  if(k==="oui"){voter(m, api, "oui");return;}
  if(k==="non"){voter(m, api, "non");return;}
  if(k==="rumeur"){api.tiroir("rumeur");return;}
  if(k==="courier"){
    if(!m.rumeur){api.toast(T.ERR_RUM_VIDE);return;}
    /* FA intercepte les ancres et renvoie un 404 sur location.href : window.open */
    window.open(CFG.URL_COURIER+encodeURIComponent(m.id), "_blank");
    return;
  }
  if(k==="refuser"){
    if(!window.confirm(T.CONF_REF))return;
    trancher(m, api, "refusee", compter(m, api, "non")); return;
  }
  if(k==="supprimer"){
    if(!window.confirm(T.CONF_SUPPR))return;
    /* Le socle ne connaît pas le secret que la fiche tenait : sans ce retour à
       dormant, il resterait « en délibération » et ne ressortirait plus jamais
       dans la liste des secrets ouvrables. */
    var s=api.secret(m.secretId);
    if(s&&s.usage==="en_deliberation"){ s.usage="dormant"; api.patchSecret(s,{usage:"dormant"}); }
    /* Le d4 n'avait de sens que pour cette délibération : tant que la fuite
       n'est pas partie, on rend au secret son droit d'être rejoué. Une fois
       l'avis sorti, l'exposition a bien eu lieu — le drapeau reste. */
    if(s&&s.deOuvert&&(!m.fuite||!m.fuite.faite)){ s.deOuvert=false; api.patchSecret(s,{deOuvert:false}); }
    api.supprimer(m); api.toast("Délibération supprimée."); api.rendre(); return;
  }
}
function faire(k, m, api){
  if(k==="newok"){ouvrir(api);return;}
  if(!m)return;
  if(k==="rumeurok"){
    var el=document.getElementById("tdlb-del-rumeur"), se=document.getElementById("tdlb-del-secteur");
    m.rumeur=el?String(el.value||"").trim():"";
    m.secteur=se?String(se.value||"").trim():"";
    api.patch(m,{rumeur:m.rumeur, secteur:m.secteur});
    var s=api.secret(m.secretId);
    if(s&&m.rumeur){ s.rumeur={texte:m.rumeur, date:new Date().toISOString()}; api.patchSecret(s,{rumeur:s.rumeur}); }
    api.fermer(); api.toast(T.OK_RUMEUR); api.rendre(); return;
  }
}

function ouvrir(api){
  var v=function(id){var el=document.getElementById(id);return el?String(el.value||"").trim():"";};
  var sid=v("tdlb-del-nsec"), ac=v("tdlb-del-nacte"), intit=v("tdlb-del-nint");
  if(!sid||!ac){api.toast(T.ERR_FORM);return;}
  if(!intit){api.toast(T.ERR_INTITULE);return;}
  var s=api.secret(sid), me=api.moi(), now=new Date().toISOString();
  var jet=tirerFuite(api, s);
  /* l'intitulé public est recopié sur la fiche : les Spectres n'ont que lui,
     et il survit à tout changement du registre */
  if(s&&!s.intitule)api.patchSecret(s,{intitule:intit});
  var o={
    schema:api.SCHEMA, type:"delib", origine:"tableau",
    titre:acteLbl(ac)+" \u2014 "+(m_court(intit)),
    secretId:sid, intitule:intit, acte:ac,
    cible:v("tdlb-del-ncible"), contrepartie:v("tdlb-del-ncontre"),
    demandeur:null, statut:"ouverte", responsable:me,
    votes:{}, decide:null, tranche:false,
    fuite:jet.fuite, de4:jet.de4, murmureId:null, rumeur:"",
    sujet:"", resume:"", consequences:"", demandeValidation:false,
    cree:now, ouverte:now, clos:null
  };
  if(s){ s.usage="en_deliberation"; api.patchSecret(s,{usage:"en_deliberation"}); }
  api.creer(o,"délibération ouverte").then(function(id){
    if(!id){
      if(s){ s.usage="dormant"; api.patchSecret(s,{usage:"dormant"}); }   /* écriture compensée */
      api.toast("Ouverture échouée.");
      return;
    }
    try{ if(window.EcoNotif)EcoNotif.bande("sorcieres",211,{quoi:"une délibération est ouverte",titre:o.titre},"del"+id); }catch(e){}
    api.fermer(); api.selectionner(id); api.toast(T.OK_NEUF); api.rendre();
  });
}
function m_court(s){ s=String(s||""); return s.length>40?s.slice(0,40)+"\u2026":s; }

/* ===================== ENREGISTREMENT ===================== */
REG.types.push({
  k:"delib", label:"Délibération", icon:"fi-tr-scale-balanced",
  normaliser:normaliser, visible:visible, ligne:ligne, panel:panel,
  actionbar:actionbar, drawer:drawer, acte:acte, faire:faire,
  creer:function(){
    return { peut:function(api){ return api.estSorciere()||api.staff(); }, label:T.NEUF, form:form };
  }
});

/* Veille des fuites échues : elle tourne dans les sessions des Sorcières et du
   staff, les seules à pouvoir lire le secret qui part à la Main. */
setTimeout(function(){
  var api=REG.api; if(!api)return;
  echeances(api);
  setInterval(function(){ echeances(api); }, CFG.VEILLE_FUITE_MS);
}, 8000);
})();
