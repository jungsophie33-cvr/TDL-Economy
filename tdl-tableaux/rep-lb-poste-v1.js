/* THE DROWNED LANDS — TABLEAU DES SECRETS · L'AVANT-POSTE
   La plateforme flottante de la zone 2 : la seule porte de Lost Bayou, et la
   seule entrée du tableau ouverte à tout le forum.

   DEUX NAISSANCES, un seul cycle :
   - INVITATION : une Sorcière ou un Spectre annonce qu'il attend quelqu'un.
     Elle est acceptée d'office — la bande n'a pas à voter pour recevoir un
     invité qu'elle a elle-même appelé.
   - PROPOSITION : un extérieur dépose une offre (du matériel contre une
     pirogue, une protection, un passage). Elle passe par les TROIS VOIX.

   CE QU'ACCEPTER NE DONNE PAS : ni l'emplacement du village, ni le droit d'y
   aller. Le proposant sait seulement qu'on l'attend quelque part. Toute
   proposition acceptée exige un RÉPONDANT, Sorcière ou Spectre, qui vient le
   chercher — « jamais seuls, toujours attendus ou accompagnés ».

   QUORUM : trois voix, dont AU PLUS UNE de Spectre ou du staff. Les voix
   s'écrivent une par une (votes/{pseudo}), jamais l'objet entier : deux voix
   données dans la même fenêtre de veille s'écraseraient, et le quorum
   basculerait sur un décompte faux.

   STATUTS : ceux du socle. « Ouverte » couvre deux phases — le vote, puis
   l'attente d'un répondant ; enVote() et attendRepondant() les distinguent.

   À CHARGER après rep-lb-core. */
(function(){
"use strict";
var REG = (window.TDLBayou = window.TDLBayou || { types: [], registre: null });

/* ===================== CONFIG ===================== */
var CFG = {
  QUORUM:      3,    /* voix « oui » nécessaires                       */
  APPOINT_MAX: 1,    /* voix de Spectre ou de staff comptées au plus   */
  DELAI_VOIX:  7,    /* jours avant péremption d'une proposition       */
  DELAI_REPOND:7     /* jours pour qu'un répondant se désigne          */
};

var T = {
  INV:"Invitation", PRO:"Proposition",
  OBJET:"Ce qui est proposé", APPORT:"Ce que le proposant apporte",
  ATTENDU:"Qui est attendu", REPOND:"Répondant", OUVERTE:"Ouverte",
  SUJET:"Sujet RP", RIEN:"—", VOIX:"Les voix",
  VOIX_AIDE:"Trois voix décident, dont au plus une de Spectre ou du staff. Une proposition sans décision au bout de "+CFG.DELAI_VOIX+" jours est refusée.",
  RESTE:function(j){ return j>0?(j+" jour"+(j>1?"s":"")+" avant péremption"):"délai dépassé"; },
  RESTE_REP:function(j){ return j>0?(j+" jour"+(j>1?"s":"")+" pour qu\u2019un répondant se désigne"):"aucun répondant \u2014 à clore"; },
  OUI:"Pour", NON:"Contre", VOTE_OUI:"Je suis pour", VOTE_NON:"Je suis contre",
  DEJA_VOTE:"Votre voix est consignée.",
  REPOND_BTN:"Je vais le chercher", REPOND_AIDE:"Vous vous portez garant : vous l\u2019attendez à la plateforme, et vous ne le laissez pas seul.",
  SUJET_BTN:"Renseigner le sujet RP", SUJET_MOD:"Modifier le sujet RP",
  BILAN:"Bilan & validation", BILAN_MOD:"Modifier le bilan",
  CLORE:"Clore", REFUSER:"Refuser", SUPPR:"Supprimer",
  RIEN_FAIRE:"Rien à faire pour l\u2019instant.",
  ATTEND_VOIX:"Les Sorcières délibèrent. Vous serez prévenu.",
  PAS_VOIX:"Cette décision ne vous revient pas.",
  CONF_REF:"Refuser cette proposition ?", CONF_CLORE:"Clore cette entrée ?",
  CONF_SUPPR:"Supprimer définitivement cette entrée ?",
  OK_VOIX:"Voix consignée.", OK_ACC:"Proposition acceptée \u2014 il reste à désigner un répondant.",
  OK_REF:"Proposition refusée.", OK_REPOND:"Vous êtes le répondant.",
  OK_CLOS:"Entrée close.", ERR_RESUME:"Renseignez au moins le résumé.",
  NEUF:"Déposer à l\u2019avant-poste", NEUF_TITRE:"Déposer à l\u2019avant-poste",
  AVANT_INT:"Vous attendez quelqu\u2019un à la plateforme. Dites qui, et pourquoi : l\u2019invitation ne passe pas par les voix, vous en répondez.",
  AVANT_EXT:"La plateforme est le seul endroit où l\u2019on vous recevra. Dites ce que vous proposez et ce que vous apportez. Les Sorcières délibéreront \u2014 et si elles acceptent, quelqu\u2019un viendra vous chercher. Vous ne saurez pas où.",
  F_TITRE:"Titre", F_TITRE_PH:"Ce que voient les autres en un coup d\u2019\u0153il",
  F_OBJET:"Ce que vous proposez", F_OBJET_PH:"En une phrase.",
  F_APPORT:"Ce que vous apportez", F_APPORT_PH:"Matériel, service, information, protection\u2026",
  F_ATTENDU:"Qui vous attendez", F_ATTENDU_PH:"Pseudo, ou le nom d\u2019un PNJ",
  F_DEPOSER:"Déposer", ERR_FORM:"Dites au moins ce que vous proposez.",
  OK_NEUF_INT:"Invitation affichée à l\u2019avant-poste.", OK_NEUF_EXT:"Proposition déposée \u2014 les Sorcières en décideront."
};

/* ===================== UTILS ===================== */
function estInvitation(m){ return m.sousType==="invitation"; }
/* Deux phases tiennent dans le statut « ouverte » : le vote, puis l'attente
   d'un répondant. La fiche les distingue par decide, pas le socle. */
function enVote(m){ return m.statut==="ouverte"&&!m.decide&&!estInvitation(m); }
function attendRepondant(m){ return m.statut==="ouverte"&&!!m.decide&&m.decide.choix==="acceptee"&&!m.repondant; }
function estDemandeur(m, api){ var me=api.moi(); return !!me && me===m.demandeur; }
function estRepondant(m, api){ var me=api.moi(); return !!me && me===m.repondant; }

/* Décompte à appoint plafonné : toutes les voix de Sorcières comptent, celles
   des Spectres et du staff pour UNE au plus. Le détail du vote est relu à
   chaque affichage, jamais mémorisé. */
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
function joursVoix(m, api){ return api.joursRestants(m.ouverte, CFG.DELAI_VOIX); }

/* ===================== NORMALISATION ===================== */
function normaliser(o){
  o.sousType=(o.sousType==="invitation")?"invitation":"proposition";
  o.objet=o.objet||"";
  o.apport=o.apport||"";
  o.attendu=o.attendu||"";
  o.repondant=o.repondant||null;
  o.decide=(o.decide&&o.decide.date)?o.decide:null;
  
}

/* ===================== VISIBILITÉ ===================== */
/* L'avant-poste est public : un extérieur doit pouvoir lire ce qui s'y passe
   avant d'y déposer quoi que ce soit. Un tableau où l'on dépose à l'aveugle
   est un tableau mort. */
function visible(){ return true; }

/* ===================== LISTE ===================== */
function ligne(m, api){
  var tags=[];
  tags.push({l:estInvitation(m)?"invitation":"proposition", c:estInvitation(m)?"var(--gr5-color)":"var(--clair2)"});
  if(enVote(m)){
    var j=joursVoix(m, api);
    tags.push({l:compter(m, api, "oui")+"/"+CFG.QUORUM+" voix"});
    if(j!=null&&j<=2)tags.push({l:T.RESTE(j), c:"var(--gr6-color)"});
  }
  if(attendRepondant(m))tags.push({l:"sans répondant", c:"var(--gr1-color)"});
  if(m.demandeValidation)tags.push({l:"⚑ validation"});
  return { titre:m.titre, sous:(m.demandeur||m.attendu||T.RIEN), tags:tags };
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
  if(enVote(m)&&api.peutVoter()&&!moi&&!estDemandeur(m, api)){
    btns='<span class="tdlm-negoact"><button class="tdlm-abtn prim" data-act="oui">'+T.VOTE_OUI+'</button>'
      +'<button class="tdlm-abtn warn" data-act="non">'+T.VOTE_NON+'</button></span>';
  }
  var j=joursVoix(m, api);
  return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd">'
    +'<span class="tdlm-hsec" style="margin:0">'+T.VOIX+' \u2014 '+oui+' '+T.OUI.toLowerCase()
    +', '+non+' '+T.NON.toLowerCase()+'</span>'+btns+'</div>'
    +(lignes||'<p class="tdlm-todo" style="margin:0">Personne ne s\u2019est encore prononcé.</p>')
    +'<p class="tdlm-todo" style="margin:6px 0 0">'+esc(T.VOIX_AIDE)
    +(j!=null&&enVote(m)?' \u00b7 '+esc(T.RESTE(j)):"")+'</p>'
    +(moi?'<p class="tdlm-todo" style="margin:4px 0 0">'+T.DEJA_VOTE+'</p>':"")
    +'</div>';
}
function panel(m, api){
  var esc=api.esc, escAttr=api.escAttr;

  var meta='<div class="tdlm-dp-meta">'
    +'<div class="tdlm-m"><span class="tdlm-k">Nature</span><span class="tdlm-v">'
      +(estInvitation(m)?T.INV:T.PRO)+'</span></div>'
    +(m.demandeur?'<div class="tdlm-m"><span class="tdlm-k">Proposant</span><span class="tdlm-v">'+esc(m.demandeur)+'</span></div>':"")
    +(m.attendu?'<div class="tdlm-m"><span class="tdlm-k">'+T.ATTENDU+'</span><span class="tdlm-v">'+esc(m.attendu)+'</span></div>':"")
    +'<div class="tdlm-m"><span class="tdlm-k">'+T.REPOND+'</span><span class="tdlm-v">'
      +(m.repondant?esc(m.repondant):'<span class="tdlm-todo">à désigner</span>')+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">'+T.OUVERTE+'</span><span class="tdlm-v">'+esc(api.dateFr(m.cree))+'</span></div>'
    +(m.sujet?'<div class="tdlm-m"><span class="tdlm-k">'+T.SUJET+'</span><span class="tdlm-v">'
      +'<a class="tdlm-lien" href="'+escAttr(m.sujet)+'" target="_blank" rel="noopener">Ouvrir le sujet →</a></span></div>':"")
    +'</div>';

  var bandeaux="";
  if(attendRepondant(m)){
    var jr=api.joursRestants(m.decide?m.decide.date:m.ouverte, CFG.DELAI_REPOND);
    bandeaux+='<div class="tdlm-reqbanner"><p class="tdlm-hsec">Un répondant est attendu</p>'
      +'<div class="tdlm-reqrow"><span>'+esc(T.REPOND_AIDE)+'</span></div>'
      +(jr!=null?'<div class="tdlm-reqrow"><span class="tdlm-todo">'+esc(T.RESTE_REP(jr))+'</span></div>':"")
      +((api.estSorciere()||api.estSpectre())?'<div class="tdlm-reqrow"><span class="tdlm-negoact">'
        +'<button class="tdlm-abtn prim" data-act="repondre">'+T.REPOND_BTN+'</button></span></div>':"")
      +'</div>';
  }
  if(m.decide){
    bandeaux+='<div class="tdlm-negobox"><p class="tdlm-hsec">Décision</p><div class="tdlm-negorow"><span>'
      +'<b>'+(m.decide.choix==="acceptee"?"Acceptée":"Refusée")+'</b> le '+esc(api.dateFr(m.decide.date))
      +' \u00b7 '+esc(String(m.decide.oui||0))+' voix pour</span></div></div>';
  }
  if(api.staff()&&m.demandeValidation){
    bandeaux+='<div class="tdlm-reqbanner"><p class="tdlm-hsec">⚑ Le bilan attend votre lecture</p>'
      +'<div class="tdlm-reqrow"><span>Relisez le bilan, puis clos l\u2019entrée.</span></div></div>';
  }

  var corps='<div class="tdlm-sec"><p class="tdlm-hsec">'+T.OBJET+'</p>'
    +'<div class="tdlm-prose">'+(m.objet?esc(m.objet):'<span class="tdlm-todo">'+T.RIEN+'</span>')+'</div></div>';
  if(m.apport)corps+='<div class="tdlm-sec"><p class="tdlm-hsec">'+T.APPORT+'</p>'
    +'<div class="tdlm-prose">'+esc(m.apport)+'</div></div>';
  if(!estInvitation(m))corps+=blocVoix(m, api);
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
  var roles=[], btns="", dedans=api.estSorciere()||api.estSpectre();
  var mene=estRepondant(m, api)||api.staff();

  if(mene&&(attendRepondant(m)||m.statut==="saisie"||m.statut==="en_validation")){
    btns+='<button class="tdlm-abtn" data-act="sujet">'+(m.sujet?T.SUJET_MOD:T.SUJET_BTN)+'</button>'
      +'<button class="tdlm-abtn prim" data-act="bilan">'+(m.statut==="en_validation"?T.BILAN_MOD:T.BILAN)+'</button>';
  }
  if(api.estSorciere())roles.push("Sorcière");
  else if(api.estSpectre())roles.push("Spectre");
  if(api.staff()){
    roles.push("Staff");
    if(m.statut==="en_validation"||m.statut==="saisie")
      btns+='<button class="tdlm-abtn prim" data-act="clore">'+T.CLORE+'</button>';
    if(enVote(m))btns+='<button class="tdlm-abtn warn" data-act="refuser">'+T.REFUSER+'</button>';
    btns+='<button class="tdlm-abtn warn" data-act="supprimer">'+T.SUPPR+'</button>';
  }
  if(estDemandeur(m, api))roles.push("Proposant");
  if(!btns){
    if(estDemandeur(m, api)&&enVote(m))btns='<span class="tdlm-idle">'+T.ATTEND_VOIX+'</span>';
    else if(enVote(m)&&!api.peutVoter())btns='<span class="tdlm-idle">'+T.PAS_VOIX+'</span>';
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
      +'<input type="text" id="tdlb-pos-sujet" value="'+api.escAttr(m.sujet)+'" placeholder="https://thedrownedlands.forumactif.com/t...">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="sujetok">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="bilan"){
    return '<div class="tdlm-drawer on"><h4>Bilan de l\u2019entrée</h4>'
      +'<label class="tdlm-fl">Résumé</label><textarea id="tdlb-pos-resume">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Conséquences</label><textarea id="tdlb-pos-conseq" placeholder="Ce que ça laisse derrière\u2026">'+esc(m.consequences)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="bilanok">'
      +(m.statut==="en_validation"?"Enregistrer":"Envoyer en validation")+'</button>'
      +(m.statut!=="en_validation"?'<button class="tdlm-abtn" data-do="bilansave">Enregistrer sans envoyer</button>':"")
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

/* ===================== FORMULAIRE ===================== */
function form(api){
  var dedans=api.estSorciere()||api.estSpectre();
  var f=function(label, inner, full){
    return '<div class="fld'+(full?" full":"")+'"><label class="tdlm-fl">'+label+'</label>'+inner+'</div>';
  };
  var g=f(T.F_TITRE,'<input type="text" id="tdlb-pos-ntitre" placeholder="'+T.F_TITRE_PH+'">');
  if(dedans)g+=f(T.F_ATTENDU,'<input type="text" id="tdlb-pos-nattendu" placeholder="'+T.F_ATTENDU_PH+'">');
  else g+=f(T.F_APPORT,'<input type="text" id="tdlb-pos-napport" placeholder="'+T.F_APPORT_PH+'">');
  g+=f(T.F_OBJET,'<textarea id="tdlb-pos-nobjet" placeholder="'+T.F_OBJET_PH+'"></textarea>', true);
  return '<div class="tdlm-dpanel"><div class="tdlm-dp-title"><span class="tdlm-type">'+T.NEUF_TITRE+'</span></div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-sec"><p class="tdlm-hsec">Avant d\u2019écrire</p>'
    +'<div class="tdlm-prose">'+api.esc(dedans?T.AVANT_INT:T.AVANT_EXT)+'</div></div>'
    +'<div class="tdlm-drawer on" style="margin:0 24px 20px"><div class="tdlm-fgrid">'+g+'</div>'
    +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="newok">'+T.F_DEPOSER+'</button>'
    +'<button class="tdlm-abtn" data-do="newcancel">Annuler</button></div></div></div></div>';
}

/* ===================== ACTIONS ===================== */
/* Une voix s'écrit SEULE, sous sa propre clé. Le quorum est recalculé ensuite
   sur la fiche en mémoire, que le socle tient à jour par la sentinelle. */
function voter(m, api, choix){
  var me=api.moi(); if(!me||!api.peutVoter())return;
  if(maVoix(m, api))return;
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
/* Le basculement est posé par un VERROU : trois onglets peuvent atteindre le
   quorum dans la même fenêtre de veille et trancher trois fois. */
function trancher(m, api, choix, voix){
  api.verrou(api.NODE, m.id, "tranche").then(function(){
    var statut=(choix==="acceptee")?"ouverte":"classee";   /* acceptée : reste ouverte, un répondant manque */
    m.statut=statut;
    m.decide={choix:choix, date:new Date().toISOString(), oui:voix};
    if(choix==="refusee")m.clos=m.decide.date;
    api.patch(m,{statut:statut, decide:m.decide, clos:m.clos||null, tranche:true});
    try{ if(window.EcoNotif&&m.demandeur&&choix==="refusee")EcoNotif.a(m.demandeur,216,{},"dec"+m.id); }catch(e){}
    api.toast(choix==="acceptee"?T.OK_ACC:T.OK_REF);
    api.rendre();
  }).catch(function(e){
    if(api.estDeja(e)){api.rendre();return;}               /* un autre onglet a tranché */
    api.toast("La décision n\u2019a pas pu être enregistrée.");
  });
}
function clore(m, api){
  if(!window.confirm(T.CONF_CLORE))return;
  m.statut="close"; m.demandeValidation=false; m.clos=new Date().toISOString();
  api.patch(m,{statut:"close", demandeValidation:false, clos:m.clos});
  api.toast(T.OK_CLOS); api.rendre();
}

function acte(k, m, api){
  if(k==="new"||!m)return;
  if(k==="oui"){voter(m, api, "oui");return;}
  if(k==="non"){voter(m, api, "non");return;}
  if(k==="repondre"){
    if(!(api.estSorciere()||api.estSpectre()))return;
    var me=api.moi();
    m.repondant=me; m.statut="saisie";
    api.patch(m,{repondant:me, statut:"saisie"});
    try{ if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,217,{},"rep"+m.id); }catch(e){}
    api.toast(T.OK_REPOND); api.rendre(); return;
  }
  if(k==="sujet"){api.inline("sujet");return;}
  if(k==="bilan"){api.tiroir("bilan");return;}
  if(k==="clore"){clore(m, api);return;}
  if(k==="refuser"){
    if(!window.confirm(T.CONF_REF))return;
    trancher(m, api, "refusee", compter(m, api, "non")); return;
  }
  if(k==="supprimer"){
    if(!window.confirm(T.CONF_SUPPR))return;
    api.supprimer(m); api.toast("Entrée supprimée."); api.rendre(); return;
  }
}

function faire(k, m, api){
  if(k==="newok"){deposer(api);return;}
  if(!m)return;
  if(k==="sujetok"){
    var el=document.getElementById("tdlb-pos-sujet");
    var u=el?String(el.value||"").trim():"";
    m.sujet=u; api.patch(m,{sujet:u}); api.fermer();
    api.toast(u?"Sujet RP enregistré.":"Sujet RP retiré."); return;
  }
  if(k==="bilanok"||k==="bilansave"){
    var r=document.getElementById("tdlb-pos-resume"), c=document.getElementById("tdlb-pos-conseq");
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
    api.toast(champs.statut?"Entrée envoyée en validation.":"Bilan enregistré."); return;
  }
}

function deposer(api){
  var v=function(id){var el=document.getElementById(id);return el?String(el.value||"").trim():"";};
  var dedans=api.estSorciere()||api.estSpectre();
  var objet=v("tdlb-pos-nobjet");
  if(!objet){api.toast(T.ERR_FORM);return;}
  var me=api.moi(), now=new Date().toISOString();
  var o={
    schema:api.SCHEMA, type:"poste", origine:"tableau",
    sousType:dedans?"invitation":"proposition",
    titre:v("tdlb-pos-ntitre")||(dedans?"Quelqu\u2019un est attendu":"Une proposition à la plateforme"),
    objet:objet, apport:dedans?"":v("tdlb-pos-napport"), attendu:dedans?v("tdlb-pos-nattendu"):"",
    demandeur:dedans?null:me, repondant:dedans?me:null,
    statut:dedans?"saisie":"ouverte", responsable:dedans?me:null,
    votes:{}, decide:null, tranche:false,
    sujet:"", resume:"", consequences:"", demandeValidation:false,
    cree:now, ouverte:now, clos:null
  };
  api.creer(o, dedans?"invitation à l\u2019avant-poste":"proposition à l\u2019avant-poste").then(function(id){
    if(!id){api.toast("Dépôt échoué.");return;}
    try{ if(window.EcoNotif)EcoNotif.bande("sorcieres",211,{quoi:"une proposition est déposée à l\u2019avant-poste",titre:o.titre},"pos"+id); }catch(e){}
    api.fermer(); api.selectionner(id);
    api.toast(dedans?T.OK_NEUF_INT:T.OK_NEUF_EXT); api.rendre();
  });
}

/* ===================== ENREGISTREMENT ===================== */
REG.types.push({
  k:"poste", label:"Avant-poste", icon:"fi-tr-anchor",
  normaliser:normaliser, visible:visible, ligne:ligne, panel:panel,
  actionbar:actionbar, drawer:drawer, acte:acte, faire:faire,
  creer:function(){
    return { peut:function(api){ return api.connecte(); }, label:T.NEUF, form:form };
  }
});
})();
