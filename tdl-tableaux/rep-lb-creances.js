/* THE DROWNED LANDS — TABLEAU DES SECRETS · LES CRÉANCES
   Ce que l'on doit aux Sorcières. Deux origines, un seul cycle :
   - RÉCLAMÉE : les Sorcières exigent une contrepartie pour un service rendu.
     Jamais monétaire, jamais négociable. Ouverte par une Sorcière ou le staff.
   - PROPOSÉE : le joueur a payé un article de la boutique par une promesse de
     service. Ouverte par quais-staff à la validation de l'achat.
   Le texte affiché change selon l'origine, le cycle est le même.

   GARDE-FOU : une créance réclamée ne vise un PJ que si le dépôt ou la requête
   d'origine l'a désigné. Le formulaire le rappelle et exige la référence ; le
   socle ne peut pas le vérifier à notre place.

   JETON DE REFUS : acquis en confiant un secret aux Lwas. Il annule UNE créance
   sans trace. Il se consomme par TRANSACTION true→false — deux clics simultanés
   annuleraient sinon deux créances avec un seul jeton.

   STATUTS : ceux du socle, partagés par toutes les fiches. Une créance refusée
   et une créance annulée au jeton sont toutes deux « classée » — ce qui les
   distingue se lit dans reponse et jeton, pas dans une couleur de plus.

   À CHARGER après rep-lb-core. */
(function(){
"use strict";
var REG = (window.TDLBayou = window.TDLBayou || { types: [], registre: null });

/* ===================== CONFIG ===================== */
var CFG = { CHAMP_JETON:"jeton_sorcieres", NODE_MEMBRES:"membres" };

var NATURES = {
  materiel:"Matériel ou fourniture", transport:"Transport ou passage", abri:"Abri",
  acces:"Accès à un lieu ou à un métier", silence:"Silence ou témoignage",
  mainoeuvre:"Main-d\u2019\u0153uvre", info:"Information à ramener"
};
var T = {
  TITRE_REC:"Ce que les Lwas réclament", TITRE_PRO:"Ce que vous avez offert",
  INTRO_REC:"Les Sorcières ont rendu un service. Elles réclament aujourd\u2019hui leur dû. Rien ne vous force à vous exécuter \u2014 mais un refus se consigne, et elles s\u2019en souviennent.",
  INTRO_PRO:"Vous avez payé ce service par une promesse. Les Sorcières la réclament aujourd\u2019hui.",
  NATURE:"Nature", DETAIL:"Ce qui est demandé", DEBITEUR:"Qui le doit",
  SUIVI:"Sorcière qui suit", SUJET:"Sujet RP", OUVERTE:"Ouverte",
  REF:"Référence d\u2019origine", RIEN:"—",
  ACCEPTER:"Je m\u2019exécute", REFUSER:"Je refuse", JETON:"Utiliser mon jeton de refus",
  JETON_AIDE:"Vous avez confié un secret aux Lwas : vous pouvez annuler cette créance une fois, sans trace au carnet.",
  SUJET_BTN:"Renseigner le sujet RP", SUJET_MOD:"Modifier le sujet RP",
  BILAN:"Bilan & validation", BILAN_MOD:"Modifier le bilan",
  CLORE:"Clore la créance", SUPPR:"Supprimer", SUIVRE:"Je suis cette créance",
  ATTENTE:"Votre réponse est attendue ci-dessus.",
  RIEN_FAIRE:"Rien à faire pour l\u2019instant.",
  CONF_REF:"Refuser cette créance ?\nElle sera close et votre refus restera lisible des Sorcières.",
  CONF_JETON:"Utiliser votre jeton de refus ?\nLa créance disparaît sans trace, et le jeton est consommé.",
  CONF_CLORE:"Clore cette créance ?\nElle sera marquée acquittée.",
  CONF_SUPPR:"Supprimer définitivement cette créance ?",
  OK_ACC:"Vous vous êtes engagé. Jouez la scène, puis renseignez le bilan.",
  OK_REF:"Refus consigné.", OK_JETON:"Jeton consommé \u2014 la créance est annulée.",
  OK_CLOS:"Créance acquittée.", OK_SUIVI:"Vous suivez cette créance.",
  ERR_JETON:"Vous n\u2019avez pas de jeton de refus.",
  ERR_RESUME:"Renseignez au moins le résumé.",
  NEUF:"Réclamer une contrepartie", NEUF_TITRE:"Réclamer une contrepartie",
  NEUF_AVANT:"Les Lwas ne réclament qu\u2019à qui leur a demandé quelque chose. Une créance ne vise un personnage que si son dépôt ou sa requête l\u2019a désigné : indiquez laquelle.",
  F_TITRE:"Titre", F_TITRE_PH:"Ce que voient les autres en un coup d\u2019\u0153il",
  F_DEB:"Personnage visé", F_NAT:"Nature", F_DET:"Ce qui est demandé",
  F_DET_PH:"En une phrase, et sans détour.", F_REF:"Référence d\u2019origine",
  F_REF_PH:"Requête, séance ou secret qui l\u2019a désigné", F_OUVRIR:"Ouvrir la créance",
  ERR_FORM:"Nommez le personnage visé, la nature et ce qui est demandé.",
  ERR_REF:"Indiquez la référence qui désigne ce personnage.",
  OK_NEUF:"Créance ouverte."
};

/* ===================== UTILS ===================== */
function estDebiteur(m, api){ var me=api.moi(); return !!me && me===m.debiteur; }
function aJeton(api){
  var m=api.membres()[api.moi()];
  return !!(m && m[CFG.CHAMP_JETON]===true);
}
/* Consommation ATOMIQUE : la transaction true→false ne laisse passer qu'un
   client. Jamais un test sur l'instantané en mémoire. */
function prendreJeton(api){
  var p=api.moi();
  var path=CFG.NODE_MEMBRES+"/"+encodeURIComponent(p)+"/"+CFG.CHAMP_JETON;
  try{
    return Promise.resolve(window.EcoCore.firebaseTransaction(path,function(cur){
      if(cur!==true)throw new Error("PASJETON");
      return false;
    }));
  }catch(e){ return Promise.reject(e); }
}
function natureLbl(k){ return NATURES[k]||k||T.RIEN; }

/* ===================== NORMALISATION ===================== */
function normaliser(o){
  o.origine=(o.origine==="propose")?"propose":"reclame";
  o.debiteur=o.debiteur||"";
  o.nature=o.nature||"";
  o.detail=o.detail||"";
  o.reference=o.reference||"";
  o.article=o.article||"";
  o.reponse=(o.reponse&&o.reponse.choix)?o.reponse:null;
  o.jeton=!!o.jeton;
  if(o.statut==="ouverte"&&!o.reponse)o.statut="reponse_attendue";
}

/* ===================== VISIBILITÉ ===================== */
/* Une créance regarde les Sorcières et celui qui la doit. Un Spectre n'a rien
   à y voir : ce n'est pas une décision collégiale. */
function visible(m, api){
  return api.staff()||api.estSorciere()||estDebiteur(m, api);
}

/* ===================== LISTE ===================== */
function ligne(m, api){
  var tags=[];
  if(m.statut==="reponse_attendue")tags.push({l:"⚑ réponse attendue"});
  if(m.origine==="propose")tags.push({l:"offerte", c:"var(--gr3-color)"});
  if(m.jeton)tags.push({l:"jeton", c:"var(--cntr)"});
  if(m.demandeValidation)tags.push({l:"⚑ validation"});
  return { titre:m.titre, sous:natureLbl(m.nature)+(m.debiteur?" · "+m.debiteur:""), tags:tags };
}

/* ===================== PANNEAU ===================== */
function panel(m, api){
  var esc=api.esc, escAttr=api.escAttr, mien=estDebiteur(m, api);

  var meta='<div class="tdlm-dp-meta">'
    +'<div class="tdlm-m"><span class="tdlm-k">'+T.NATURE+'</span><span class="tdlm-v">'+esc(natureLbl(m.nature))+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">'+T.DEBITEUR+'</span><span class="tdlm-v">'+esc(m.debiteur||T.RIEN)+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">'+T.SUIVI+'</span><span class="tdlm-v">'
      +(m.responsable?esc(m.responsable):'<span class="tdlm-todo">à désigner</span>')+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">'+T.OUVERTE+'</span><span class="tdlm-v">'+esc(api.dateFr(m.cree))+'</span></div>'
    +(m.reference?'<div class="tdlm-m"><span class="tdlm-k">'+T.REF+'</span><span class="tdlm-v">'+esc(m.reference)+'</span></div>':"")
    +(m.sujet?'<div class="tdlm-m"><span class="tdlm-k">'+T.SUJET+'</span><span class="tdlm-v">'
      +'<a class="tdlm-lien" href="'+escAttr(m.sujet)+'" target="_blank" rel="noopener">Ouvrir le sujet →</a></span></div>':"")
    +'</div>';

  var bandeaux="";
  if(m.statut==="reponse_attendue"){
    bandeaux+='<div class="tdlm-reqbanner"><p class="tdlm-hsec">'
      +(m.origine==="propose"?T.TITRE_PRO:T.TITRE_REC)+'</p><div class="tdlm-reqrow"><span>'
      +esc(m.origine==="propose"?T.INTRO_PRO:T.INTRO_REC)+'</span></div>';
    if(mien){
      bandeaux+='<div class="tdlm-reqrow"><span class="tdlm-negoact">'
        +'<button class="tdlm-abtn prim" data-act="accepter">'+T.ACCEPTER+'</button>'
        +'<button class="tdlm-abtn warn" data-act="refuser">'+T.REFUSER+'</button>'
        +(aJeton(api)?'<button class="tdlm-abtn" data-act="jeton">'+T.JETON+'</button>':"")
        +'</span></div>';
      if(aJeton(api))bandeaux+='<div class="tdlm-reqrow"><span class="tdlm-todo">'+esc(T.JETON_AIDE)+'</span></div>';
    }
    bandeaux+='</div>';
  }
  if(m.reponse){
    bandeaux+='<div class="tdlm-negobox"><p class="tdlm-hsec">Réponse consignée</p><div class="tdlm-negorow"><span>'
      +esc(m.reponse.par)+' \u2014 <b>'+(m.reponse.choix==="accepte"?"s\u2019exécute":"refuse")+'</b> le '
      +esc(api.dateFr(m.reponse.date))
      +(m.reponse.raison?' <span class="tdlm-todo">('+esc(m.reponse.raison)+')</span>':"")+'</span></div></div>';
  }
  if(api.staff()&&m.demandeValidation){
    bandeaux+='<div class="tdlm-reqbanner"><p class="tdlm-hsec">⚑ Le bilan attend votre lecture</p>'
      +'<div class="tdlm-reqrow"><span>Relisez le bilan, puis clos la créance.</span></div></div>';
  }

  var corps='<div class="tdlm-sec"><p class="tdlm-hsec">'+T.DETAIL+'</p>'
    +'<div class="tdlm-prose">'+(m.detail?esc(m.detail):'<span class="tdlm-todo">'+T.RIEN+'</span>')+'</div></div>';
  if(m.resume||m.consequences||m.statut==="en_validation"||m.statut==="close"){
    corps+='<div class="tdlm-sec"><p class="tdlm-hsec">Résumé</p><div class="tdlm-prose">'
      +(m.resume?esc(m.resume):'<span class="tdlm-todo">'+T.RIEN+'</span>')+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Conséquences</p><div class="tdlm-prose">'
      +(m.consequences?esc(m.consequences):'<span class="tdlm-todo">'+T.RIEN+'</span>')+'</div></div>';
  }
  return meta+bandeaux+corps;
}

/* ===================== BARRE D'ACTION ===================== */
function peutBilan(m, api){
  if(m.statut!=="saisie"&&m.statut!=="en_validation")return false;
  return estDebiteur(m, api)||(api.moi()&&api.moi()===m.responsable)||api.staff();
}
function actionbar(m, api){
  var roles=[], btns="", me=api.moi();

  if(peutBilan(m, api)){
    btns+='<button class="tdlm-abtn" data-act="sujet">'+(m.sujet?T.SUJET_MOD:T.SUJET_BTN)+'</button>'
      +'<button class="tdlm-abtn prim" data-act="bilan">'+(m.statut==="en_validation"?T.BILAN_MOD:T.BILAN)+'</button>';
  }
  if(api.estSorciere()){
    roles.push("Sorcière");
    if(!m.responsable&&m.statut!=="close"&&m.statut!=="classee")
      btns+='<button class="tdlm-abtn" data-act="suivre">'+T.SUIVRE+'</button>';
  }
  if(api.staff()){
    roles.push("Staff");
    if(m.statut==="en_validation"||m.statut==="saisie")
      btns+='<button class="tdlm-abtn prim" data-act="clore">'+T.CLORE+'</button>';
    btns+='<button class="tdlm-abtn warn" data-act="supprimer">'+T.SUPPR+'</button>';
  }
  if(estDebiteur(m, api))roles.push("Personnage visé");
  if(!btns){
    if(estDebiteur(m, api)&&m.statut==="reponse_attendue")btns='<span class="tdlm-idle">'+T.ATTENTE+'</span>';
    else btns='<span class="tdlm-idle">'+T.RIEN_FAIRE+'</span>';
  }
  if(!roles.length)roles.push(me?"Visiteur":"Invité");
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles.join(" · ")+'</span>'+btns+'</div>';
}

/* ===================== TIROIRS ===================== */
function drawer(m, api){
  var esc=api.esc, S=api.etat();
  if(S.inline==="sujet"){
    return '<div class="tdlm-drawer on"><h4>'+T.SUJET+'</h4>'
      +'<input type="text" id="tdlb-cre-sujet" value="'+api.escAttr(m.sujet)+'" placeholder="https://thedrownedlands.forumactif.com/t...">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="sujetok">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="bilan"){
    return '<div class="tdlm-drawer on"><h4>Bilan de la créance</h4>'
      +'<label class="tdlm-fl">Résumé</label><textarea id="tdlb-cre-resume">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Conséquences</label><textarea id="tdlb-cre-conseq" placeholder="Ce que ça laisse derrière\u2026">'+esc(m.consequences)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="bilanok">'
      +(m.statut==="en_validation"?"Enregistrer":"Envoyer en validation")+'</button>'
      +(m.statut!=="en_validation"?'<button class="tdlm-abtn" data-do="bilansave">Enregistrer sans envoyer</button>':"")
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

/* ===================== FORMULAIRE D'OUVERTURE ===================== */
function optMembres(api){
  var M=api.membres();
  return '<option value="">\u2014 choisir \u2014</option>'
    +Object.keys(M).sort(function(a,b){return a.localeCompare(b,"fr");})
      .map(function(p){return '<option value="'+api.escAttr(p)+'">'+api.esc(p)+'</option>';}).join("");
}
function form(api){
  var f=function(label, inner, full){
    return '<div class="fld'+(full?" full":"")+'"><label class="tdlm-fl">'+label+'</label>'+inner+'</div>';
  };
  var g=f(T.F_TITRE,'<input type="text" id="tdlb-cre-ntitre" placeholder="'+T.F_TITRE_PH+'">')
    + f(T.F_DEB,'<select id="tdlb-cre-ndeb">'+optMembres(api)+'</select>')
    + f(T.F_NAT,'<select id="tdlb-cre-nnat">'+Object.keys(NATURES).map(function(k){
        return '<option value="'+k+'">'+api.esc(NATURES[k])+'</option>'; }).join("")+'</select>')
    + f(T.F_REF,'<input type="text" id="tdlb-cre-nref" placeholder="'+T.F_REF_PH+'">')
    + f(T.F_DET,'<textarea id="tdlb-cre-ndet" placeholder="'+T.F_DET_PH+'"></textarea>', true);
  return '<div class="tdlm-dpanel"><div class="tdlm-dp-title"><span class="tdlm-type">'+T.NEUF_TITRE+'</span></div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-sec"><p class="tdlm-hsec">Avant d\u2019écrire</p>'
    +'<div class="tdlm-prose">'+api.esc(T.NEUF_AVANT)+'</div></div>'
    +'<div class="tdlm-drawer on" style="margin:0 24px 20px"><div class="tdlm-fgrid">'+g+'</div>'
    +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="newok">'+T.F_OUVRIR+'</button>'
    +'<button class="tdlm-abtn" data-do="newcancel">Annuler</button></div></div></div></div>';
}

/* ===================== ACTIONS ===================== */
function repondre(m, api, oui){
  var me=api.moi(), raison="";
  if(!oui){
    var saisie=window.prompt("Pour les Sorcières : en quelques mots, pourquoi refusez-vous ?","");
    if(saisie===null)return;                 /* Annuler ≠ refuser à vide */
    raison=saisie.trim();
    if(!window.confirm(T.CONF_REF))return;
  }
  m.reponse={choix:oui?"accepte":"refuse", par:me, date:new Date().toISOString(), raison:raison};
  m.statut=oui?"saisie":"classee";
  if(!oui)m.clos=new Date().toISOString();
  api.patch(m,{reponse:m.reponse, statut:m.statut, clos:m.clos||null, ouverte:m.ouverte});
  try{ if(window.EcoNotif)EcoNotif.bande("sorcieres",oui?215:216,{titre:m.titre,pseudo:me},"rep"+m.id); }catch(e){}
  api.toast(oui?T.OK_ACC:T.OK_REF);
  api.rendre();
}
function utiliserJeton(m, api){
  if(!window.confirm(T.CONF_JETON))return;
  prendreJeton(api).then(function(){
    m.statut="classee"; m.jeton=true; m.clos=new Date().toISOString();
    api.patch(m,{statut:"classee", jeton:true, clos:m.clos});
    api.toast(T.OK_JETON);
    return api.rafraichir();
  }).catch(function(e){
    if(e&&e.message==="PASJETON"){api.toast(T.ERR_JETON);api.rafraichir();return;}
    api.toast("Annulation impossible \u2014 le jeton n\u2019a pas été consommé.");
  });
}
function clore(m, api){
  if(!window.confirm(T.CONF_CLORE))return;
  m.statut="close"; m.demandeValidation=false; m.clos=new Date().toISOString();
  api.patch(m,{statut:"close", demandeValidation:false, clos:m.clos});
  try{ if(window.EcoNotif&&m.debiteur)EcoNotif.a(m.debiteur,217,{titre:m.titre},"clo"+m.id); }catch(e){}
  api.toast(T.OK_CLOS); api.rendre();
}

function acte(k, m, api){
  if(k==="new"||!m)return;
  if(k==="accepter"){repondre(m, api, true);return;}
  if(k==="refuser"){repondre(m, api, false);return;}
  if(k==="jeton"){utiliserJeton(m, api);return;}
  if(k==="sujet"){api.inline("sujet");return;}
  if(k==="bilan"){api.tiroir("bilan");return;}
  if(k==="clore"){clore(m, api);return;}
  if(k==="suivre"){
    var me=api.moi();
    m.responsable=me; api.patch(m,{responsable:me});
    api.toast(T.OK_SUIVI); api.rendre(); return;
  }
  if(k==="supprimer"){
    if(!window.confirm(T.CONF_SUPPR))return;
    api.supprimer(m); api.toast("Créance supprimée."); api.rendre(); return;
  }
}

function faire(k, m, api){
  if(k==="newok"){creerCreance(api);return;}
  if(!m)return;
  if(k==="sujetok"){
    var el=document.getElementById("tdlb-cre-sujet");
    var u=el?String(el.value||"").trim():"";
    m.sujet=u; api.patch(m,{sujet:u}); api.fermer();
    api.toast(u?"Sujet RP enregistré.":"Sujet RP retiré."); return;
  }
  if(k==="bilanok"||k==="bilansave"){
    var r=document.getElementById("tdlb-cre-resume"), c=document.getElementById("tdlb-cre-conseq");
    m.resume=r?String(r.value||"").trim():"";
    m.consequences=c?String(c.value||"").trim():"";
    var champs={resume:m.resume, consequences:m.consequences};
    if(k==="bilanok"&&m.statut!=="en_validation"){
      if(!m.resume){api.toast(T.ERR_RESUME);return;}
      m.statut="en_validation"; m.demandeValidation=true;
      champs.statut="en_validation"; champs.demandeValidation=true;
    }
    api.patch(m,champs);
    try{ if(window.EcoNotif&&champs.statut)EcoNotif.staff(218,{titre:m.titre},"val"+m.id); }catch(e){}
    api.fermer();
    api.toast(champs.statut?"Créance envoyée en validation.":"Bilan enregistré.");
    return;
  }
}

function creerCreance(api){
  var v=function(id){var el=document.getElementById(id);return el?String(el.value||"").trim():"";};
  var titre=v("tdlb-cre-ntitre"), deb=v("tdlb-cre-ndeb"), nat=v("tdlb-cre-nnat"),
      det=v("tdlb-cre-ndet"), ref=v("tdlb-cre-nref");
  if(!deb||!nat||!det){api.toast(T.ERR_FORM);return;}
  if(!ref){api.toast(T.ERR_REF);return;}
  var now=new Date().toISOString();
  var o={
    schema:api.SCHEMA, type:"creance", origine:"reclame",
    titre:titre||("Ce que les Lwas réclament à "+deb),
    debiteur:deb, nature:nat, detail:det, reference:ref, article:"",
    demandeur:null, statut:"reponse_attendue", responsable:api.moi(),
    reponse:null, jeton:false,
    sujet:"", resume:"", consequences:"", demandeValidation:false,
    cree:now, ouverte:now, clos:null
  };
  api.creer(o,"créance réclamée").then(function(id){
    if(!id){api.toast("Ouverture échouée.");return;}
    try{ if(window.EcoNotif)EcoNotif.a(deb,210,{titre:o.titre},"cre"+id); }catch(e){}
    api.fermer(); api.selectionner(id); api.toast(T.OK_NEUF); api.rendre();
  });
}

/* ===================== ENREGISTREMENT ===================== */
REG.types.push({
  k:"creance", label:"Créance", icon:"fi-tr-hand-holding-heart",
  normaliser:normaliser, visible:visible, ligne:ligne, panel:panel,
  actionbar:actionbar, drawer:drawer, acte:acte, faire:faire,
  creer:function(){
    return { peut:function(api){ return api.estSorciere()||api.staff(); },
             label:T.NEUF, form:form };
  }
});
})();
