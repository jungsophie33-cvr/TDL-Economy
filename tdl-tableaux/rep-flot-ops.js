/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU HANGAR · FLUX « OPÉRATIONS »
   (rep-flot-ops.js) — à charger APRÈS rep-flot-core.js.

   Données : flottille/operations/{id}, créées par quai-staff à la validation
   d'un achat « Opération » en boutique (1 000 $ minimum, prime déjà retenue
   sur le demandeur).

   CYCLE   en_attente → acceptee (un membre de la Flottille s'en empare et
           devient chef) → en_validation → terminee.
           14 j sans chef → refusee + recrédit du demandeur.
   ARGENT  prime en parts égales aux participants validés, + 50 $ au chef.
   ACCÈS   lecture ouverte à tous ; inscription réservée à la Flottille
           (aucun navire exigé : l'opération n'est pas une sortie en mer).
   ================================================================== */
(function(F){
"use strict";
if(!F){ if(window.console) console.warn("[rep-flot-ops] rep-flot-core absent."); return; }
var esc=F.esc, escAttr=F.escAttr, vt=F.vt, money=F.money, ilya=F.ilya, av=F.av, $=F.$;
var S=F.S, patch=F.patch, toast=F.toast;

/* ===================== CONFIG ===================== */
var SOUS="operations";
var STATUTS={
  en_attente:   {label:"En attente",    c:"var(--gr3-color)"},
  acceptee:     {label:"Acceptée",      c:"var(--gr1-color)"},
  en_validation:{label:"En validation", c:"var(--gr4-color)"},
  terminee:     {label:"Terminée",      c:"var(--gr2-color)"},
  refusee:      {label:"Refusée",       c:"var(--gr6-color)"}
};
var VERROUS={distance:"La distance", incompatibilite:"L\u2019incompatibilité entre les parties", invisibilite:"L\u2019invisibilité nécessaire"};
var MANDANT={joueur:"", entreprise:"entreprise", famille:"famille", pnj:"PNJ", anonyme:"anonyme"};

var T={
  VIDE:"Aucune opération à cet endroit du registre.",
  INTRO:"La Flottille réunit et déplace. Les décisions sur place ne la regardent pas.",
  NON_FLOT:"Inscription réservée aux membres de la Flottille.",
  FERMEE:"Opération fermée à l\u2019inscription.",
  DEJA:"Déjà inscrit\u00b7e.",
  CHEF:"Inscrit\u00b7e \u2014 vous menez l\u2019opération.",
  PART:"Inscrit\u00b7e à l\u2019opération.",
  CONSULT:"Registre consultable \u2014 inscription réservée à la Flottille.",
  CONNECT:"Connectez-vous pour interagir.",
  ATTENTE:"En attente d\u2019un capitaine."
};

/* ===================== NORMALISATION ===================== */
function normaliser(o){
  o.titre=o.titre||"Opération";
  o.demandeur=o.demandeur||null;
  o.mandataire=o.mandataire||o.demandeur||"—";
  o.mandataireType=MANDANT.hasOwnProperty(o.mandataireType)?o.mandataireType:"joueur";
  o.prime=+o.prime||0;
  o.primeInitiale=(o.primeInitiale!=null)?(+o.primeInitiale||0):o.prime;
  o.verrou=o.verrou||"";
  o.parties=o.parties||"";
  o.objectif=o.objectif||"";
  o.contraintes=vt(o.contraintes);
  o.contexte=o.contexte||"";
  o.statut=STATUTS[o.statut]?o.statut:"en_attente";
  o.chef=o.chef||null;
  o.participants=vt(o.participants);
  o.valides=vt(o.valides);
  o.nego=(o.nego&&o.nego.montant!=null)?o.nego:null;
  o.sujet=o.sujet||"";
  o.resume=o.resume||""; o.consequences=o.consequences||"";
  o.demandeValidation=!!o.demandeValidation;
  o.cree=o.cree||new Date().toISOString();
  o.rembourse=!!o.rembourse; o.primeVersee=!!o.primeVersee;
  return o;
}

/* ===================== LIGNE DE LISTE ===================== */
function ligne(m){
  return F.rangee(m,{
    titre:m.titre,
    sub:m.mandataire+" \u00b7 "+money(m.prime),
    tags:[m.nego?"⚑ prime proposée":""],
    qui:m.chef, quand:"ouverte "+ilya(m.cree)
  });
}

/* ===================== PANNEAU ===================== */
function panel(m){
  var me=F.myPseudo(), staff=F.isStaff();
  var mandLabel=esc(m.mandataire)+(MANDANT[m.mandataireType]?' <span class="tdlm-todo">('+MANDANT[m.mandataireType]+')</span>':'');
  var primeLabel=money(m.prime)+(m.prime!==m.primeInitiale?' <span class="tdlm-todo">(négociée, init. '+money(m.primeInitiale)+')</span>':'');

  var banner="";
  if(staff&&m.demandeValidation){
    banner='<div class="tdlm-reqbanner"><p class="tdlm-hsec">⚑ Le chef demande la validation</p>'
      +'<div class="tdlm-reqrow"><span>Coche les participants réellement impliqués, puis valide pour verser la prime.</span></div></div>';
  }

  var negoBox="";
  if(m.nego){
    var estDem=(me&&me===m.demandeur);
    negoBox='<div class="tdlm-negobox"><p class="tdlm-hsec">Négociation de prime</p>'
      +'<div class="tdlm-negorow"><span>Le chef propose <b>'+money(m.nego.montant)+'</b> (actuelle : '+money(m.prime)+').</span>'
      +(estDem?'<span class="tdlm-negoact"><button class="tdlm-abtn prim" data-act="negoyes">Accepter</button><button class="tdlm-abtn warn" data-act="negono">Refuser</button></span>':'')
      +'</div></div>';
  }

  var editVal=(staff&&m.statut==="en_validation");
  var pList=m.participants.length?m.participants.map(function(p){
    var chk=editVal?'<label class="tdlm-chk"><input type="checkbox" data-val="'+escAttr(p)+'" '+(m.valides.indexOf(p)>=0?'checked':'')+'> validé</label>':'';
    var chefLbl=(p===m.chef)?'<span class="tdlm-r">mène l\u2019opération</span>':'';
    var nav=F.navireDe(p);
    return '<div class="tdlm-person'+(p===m.chef?' chef':'')+'">'+av(p)+'<span class="tdlm-pname">'+esc(p)
      +(nav?' <span class="tdlm-todo">\u00b7 '+esc(nav)+'</span>':'')+'</span>'+chefLbl+chk+'</div>';
  }).join(""):'<p class="tdlm-todo" style="margin:0">Personne de la Flottille ne s\u2019en est encore emparé.</p>';

  var peutRejoindre=(F.estFlottille(me)&&m.participants.indexOf(me)<0&&(m.statut==="en_attente"||m.statut==="acceptee"));
  var joinBtn=peutRejoindre?'<button class="tdlm-abtn prim" data-act="join">Je participe</button>':'';
  var cadre='<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Équipage de l\u2019opération</span>'+joinBtn+'</div>'+pList+'</div>';

  var bilan="";
  if(m.resume||m.consequences||m.statut==="en_validation"||m.statut==="terminee"){
    bilan='<div class="tdlm-sec"><p class="tdlm-hsec">Résumé</p><div class="tdlm-prose">'+(m.resume?esc(m.resume):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Conséquences</p><div class="tdlm-prose">'+(m.consequences?esc(m.consequences):'<span class="tdlm-todo">—</span>')+'</div></div>';
  }

  var sujetLine=m.sujet?'<div class="tdlm-m"><span class="tdlm-k">Sujet RP</span><span class="tdlm-v"><a class="tdlm-lien" href="'+escAttr(m.sujet)+'" target="_blank" rel="noopener">Ouvrir le sujet →</a></span></div>':'';
  var contraintes=m.contraintes.length
    ? '<ul class="tdlm-clean">'+m.contraintes.map(function(c){return '<li class="tdlm-puce">'+esc(c)+'</li>';}).join("")+'</ul>'
    : '<span class="tdlm-todo">—</span>';

  return ''
    +'<button class="tdlm-dret" data-back>← Retour à la liste</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">'+esc(m.titre)+'</span>'+F.stamp(m)+'</div>'
    +'<div class="tdlm-dp-body">'
      +'<div class="tdlm-dp-hd"><div class="tdlm-dp-meta">'
        +'<div class="tdlm-m"><span class="tdlm-k">Commanditaire</span><span class="tdlm-v">'+mandLabel+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Pourquoi la Flottille</span><span class="tdlm-v">'+esc(VERROUS[m.verrou]||"—")+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Prime</span><span class="tdlm-v"><b>'+primeLabel+'</b></span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Mène l\u2019opération</span><span class="tdlm-v">'+(m.chef?esc(m.chef):'<span class="tdlm-todo">à pourvoir</span>')+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Ouverte</span><span class="tdlm-v">'+ilya(m.cree)+'</span></div>'
        +sujetLine
      +'</div>'+banner+'</div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Qui doit se retrouver là</p><div class="tdlm-prose">'+(m.parties?esc(m.parties):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Objectif</p><div class="tdlm-prose">'+(m.objectif?esc(m.objectif):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +'<div class="tdlm-duo">'
        +'<div class="tdlm-sec"><p class="tdlm-hsec">Contraintes</p>'+contraintes+'</div>'
        +'<div class="tdlm-sec"><p class="tdlm-hsec">Contexte</p><div class="tdlm-prose">'+(m.contexte?esc(m.contexte):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +'</div>'
      +negoBox+cadre+bilan+drawer(m)
    +'</div>'
    +actionbar(m);
}

/* ---- barre d'action ----
   Les rôles se CUMULENT : un chef qui est aussi administrateur doit garder
   ses boutons de chef. Jamais de cascade exclusive. */
function actionbar(m){
  var me=F.myPseudo(), staff=F.isStaff();
  var dem=(me&&me===m.demandeur), chef=(me&&me===m.chef);
  var roles=[], btns="";

  if(chef&&(m.statut==="acceptee"||m.statut==="en_validation")){
    roles.push("Chef d\u2019opération");
    btns+='<button class="tdlm-abtn" data-act="sujet">'+(m.sujet?"Modifier le sujet RP":"Renseigner le sujet RP")+'</button>';
    if(m.statut==="acceptee"&&!m.sujet)btns+='<button class="tdlm-abtn" data-act="nego">Négocier la prime</button>';
    btns+='<button class="tdlm-abtn prim" data-act="bilan">'+(m.statut==="en_validation"?"Modifier le bilan":"Bilan &amp; passer en validation")+'</button>';
  }
  if(dem&&m.statut==="en_attente"){
    roles.push("Commanditaire");
    btns+='<button class="tdlm-abtn warn" data-act="retirer">Retirer mon opération</button>';
  }
  if(staff){
    roles.push("Staff");
    if(m.statut==="en_validation")btns+='<button class="tdlm-abtn prim" data-act="valider">Valider &amp; verser la prime</button>';
    btns+='<button class="tdlm-abtn" data-act="edit">Modifier les termes</button>';
    if(m.statut!=="terminee"&&m.statut!=="refusee")btns+='<button class="tdlm-abtn warn" data-act="refuser">Refuser &amp; rembourser</button>';
    btns+='<button class="tdlm-abtn warn" data-act="delete">Supprimer</button>';
  }
  if(!btns){
    if(dem){roles.push("Commanditaire");btns='<span class="tdlm-idle">'+T.ATTENTE+'</span>';}
    else if(!F.estConnecte()){roles.push("Invité");btns='<span class="tdlm-idle">'+T.CONNECT+'</span>';}
    else if(F.estFlottille(me)){roles.push("Flottille");btns='<span class="tdlm-idle">Utilisez « Je participe » ci-dessus.</span>';}
    else {roles.push("Visiteur");btns='<span class="tdlm-idle">'+T.CONSULT+'</span>';}
  }
  if(!roles.length)roles.push("Visiteur");
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles.join(" \u00b7 ")+'</span>'+btns+'</div>';
}

/* ---- drawers ---- */
function drawer(m){
  if(S.drawer==="edit"){
    var vsel=Object.keys(VERROUS).map(function(k){return '<option value="'+k+'"'+(k===m.verrou?' selected':'')+'>'+esc(VERROUS[k])+'</option>';}).join("");
    var msel=Object.keys(MANDANT).map(function(k){return '<option value="'+k+'"'+(k===m.mandataireType?' selected':'')+'>'+(k==="joueur"?"joueur":MANDANT[k])+'</option>';}).join("");
    return '<div class="tdlm-drawer on"><h4>Modifier les termes (staff)</h4>'
      +'<label class="tdlm-fl">Titre</label><input type="text" id="tdlh-etitre" value="'+escAttr(m.titre)+'">'
      +'<div class="tdlm-row"><div style="flex:2"><label class="tdlm-fl">Pourquoi la Flottille</label><select id="tdlh-everrou">'+vsel+'</select></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Prime ($)</label><input type="text" id="tdlh-eprime" value="'+escAttr(m.prime)+'"></div></div>'
      +'<div class="tdlm-row"><div style="flex:2"><label class="tdlm-fl">Commanditaire (libellé)</label><input type="text" id="tdlh-emand" value="'+escAttr(m.mandataire)+'"></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Au nom de</label><select id="tdlh-emandt">'+msel+'</select></div></div>'
      +'<label class="tdlm-fl">Qui doit se retrouver là</label><textarea id="tdlh-eparties">'+esc(m.parties)+'</textarea>'
      +'<label class="tdlm-fl">Objectif</label><textarea id="tdlh-eobj">'+esc(m.objectif)+'</textarea>'
      +'<label class="tdlm-fl">Contraintes (une par ligne)</label><textarea id="tdlh-econtr">'+esc(m.contraintes.join("\n"))+'</textarea>'
      +'<label class="tdlm-fl">Contexte</label><textarea id="tdlh-ectx">'+esc(m.contexte)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="editok">Enregistrer</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="bilan"){
    return '<div class="tdlm-drawer on"><h4>Bilan de l\u2019opération</h4>'
      +'<label class="tdlm-fl">Résumé</label><textarea id="tdlh-bresume">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Conséquences</label><textarea id="tdlh-bconseq">'+esc(m.consequences)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="bilanok">'+(m.statut==="en_validation"?"Enregistrer":"Envoyer en validation")+'</button>'
      +(m.statut!=="en_validation"?'<button class="tdlm-abtn" data-do="bilansave">Enregistrer sans envoyer</button>':'')
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline==="sujet"){
    return '<div class="tdlm-drawer on"><h4>Sujet RP de l\u2019opération</h4>'
      +'<input type="text" id="tdlh-sujet" value="'+escAttr(m.sujet)+'" placeholder="https://thedrownedlands.forumactif.com/t...">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="sujetok">Enregistrer</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline==="nego"){
    return '<div class="tdlm-drawer on"><h4>Proposer une nouvelle prime</h4>'
      +'<input type="text" id="tdlh-negom" placeholder="Montant en $" value="'+escAttr(m.nego?m.nego.montant:"")+'">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="negook">Proposer au commanditaire</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

/* ===================== ACTIONS ===================== */
function act(k,m){
  var me=F.myPseudo();

  if(k==="join"){
    if(!F.estFlottille(me)){toast(T.NON_FLOT);return;}
    if(m.statut!=="en_attente"&&m.statut!=="acceptee"){toast(T.FERMEE);return;}
    if(m.participants.indexOf(me)>=0){toast(T.DEJA);return;}
    m.participants.push(me);
    var champs={participants:m.participants};
    if(!m.chef){m.chef=me;m.statut="acceptee";champs.chef=me;champs.statut="acceptee";}
    patch(m,champs);toast(m.chef===me?T.CHEF:T.PART);F.renderStage();return;
  }
  if(k==="sujet"||k==="nego"){S.inline=k;S.drawer=null;F.renderStage();return;}
  if(k==="bilan"||k==="edit"){S.drawer=(k==="bilan"?"bilan":"edit");S.inline=null;F.renderStage();return;}

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
    if(!window.confirm("Fermer l\u2019opération et rembourser "+money(m.prime)+" à "+(m.demandeur||"?")+" ?"))return;
    rembourser(m,"Opération retirée. Prime rendue.");
    return;
  }
  if(k==="valider"){verser(m);return;}
  if(k==="delete"){
    if(!window.confirm("Supprimer définitivement « "+m.titre+" » ?\nAucun remboursement automatique \u2014 utilisez « Refuser & rembourser » si nécessaire."))return;
    F.supprimer(m);toast("Opération supprimée.");F.renderAll();return;
  }
}

/* ===================== DRAWERS : VALIDATION ===================== */
function doo(k,m){
  if(k==="cancel"){S.drawer=null;S.inline=null;F.renderStage();return;}

  if(k==="sujetok"){
    var el=$("#tdlh-sujet"), url=el?String(el.value||"").trim():"";
    m.sujet=url;patch(m,{sujet:url});S.inline=null;toast("Sujet enregistré.");F.renderStage();return;
  }
  if(k==="negook"){
    var em=$("#tdlh-negom"), v=em?parseInt(String(em.value).replace(/[^\d]/g,""),10):0;
    if(!v||v<=0){toast("Indique un montant valide.");return;}
    if(v<=m.prime){toast("La négociation se fait à la hausse.");return;}
    m.nego={montant:v,par:F.myPseudo(),date:new Date().toISOString()};
    patch(m,{nego:m.nego});S.inline=null;toast("Proposition transmise au commanditaire.");F.renderStage();return;
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
    toast(champs.statut?"Envoyé en validation.":"Bilan enregistré.");F.renderAll();return;
  }
  if(k==="editok"){
    var g=function(id){var e=$(id);return e?String(e.value||"").trim():"";};
    var prime=parseInt(g("#tdlh-eprime").replace(/[^\d]/g,""),10)||m.prime;
    m.titre=g("#tdlh-etitre")||m.titre;
    m.verrou=g("#tdlh-everrou")||m.verrou;
    m.mandataire=g("#tdlh-emand")||m.mandataire;
    m.mandataireType=g("#tdlh-emandt")||m.mandataireType;
    m.parties=g("#tdlh-eparties");
    m.objectif=g("#tdlh-eobj");
    m.contexte=g("#tdlh-ectx");
    m.contraintes=g("#tdlh-econtr").split("\n").map(function(x){return x.trim();}).filter(Boolean);
    m.prime=prime;
    patch(m,{titre:m.titre,verrou:m.verrou,mandataire:m.mandataire,mandataireType:m.mandataireType,
             parties:m.parties,objectif:m.objectif,contexte:m.contexte,contraintes:m.contraintes,prime:prime});
    S.drawer=null;toast("Termes modifiés.");F.renderAll();return;
  }
}

/* cases « validé » du staff : cochées dans le panneau, hors data-act/data-do */
function brancher(stage){
  stage.querySelectorAll("[data-val]").forEach(function(el){
    el.onchange=function(){
      var m=F.parId(S.sel); if(!m)return;
      var p=el.getAttribute("data-val"), i=m.valides.indexOf(p);
      if(el.checked&&i<0)m.valides.push(p); else if(!el.checked&&i>=0)m.valides.splice(i,1);
      patch(m,{valides:m.valides});
    };
  });
}

/* ===================== ARGENT ===================== */
function rembourser(m, msg){
  var suite=(m.demandeur&&m.prime>0)?F.crediter(m.demandeur,m.prime):Promise.resolve();
  Promise.resolve(suite).then(function(){
    m.rembourse=true;m.statut="refusee";
    patch(m,{rembourse:true,statut:"refusee"});
    try{if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,101,{nom:m.titre,montant:m.prime},"fop"+m.id);}catch(e){}
    toast(msg);F.renderAll();
  }).catch(function(){toast("Remboursement impossible.");});
}

function verser(m){
  if(m.primeVersee){toast("Prime déjà versée.");return;}
  var gagnants=m.valides.length?m.valides:m.participants;
  if(!gagnants.length){toast("Aucun participant à payer.");return;}
  var part=Math.floor(m.prime/gagnants.length);
  var total=part*gagnants.length+(m.chef?F.CHEF_BONUS:0);
  if(!window.confirm("Verser "+money(part)+" à chacun des "+gagnants.length+" participants"
      +(m.chef?", plus "+money(F.CHEF_BONUS)+" au chef":"")+" ?\nTotal distribué : "+money(total)+"."))return;

  var suite=Promise.resolve();
  gagnants.forEach(function(p){suite=suite.then(function(){return F.crediter(p,part);});});
  if(m.chef)suite=suite.then(function(){return F.crediter(m.chef,F.CHEF_BONUS);});
  suite.then(function(){
    m.primeVersee=true;m.statut="terminee";m.demandeValidation=false;
    patch(m,{primeVersee:true,statut:"terminee",demandeValidation:false,valides:gagnants});
    gagnants.forEach(function(p){try{if(window.EcoNotif)EcoNotif.a(p,100,{nom:m.titre},"vop"+m.id+p);}catch(e){}});
    toast("Opération close, prime versée.");F.renderAll();
  }).catch(function(){toast("Versement interrompu \u2014 vérifie les soldes avant de recommencer.");});
}

/* ===================== ÉCHÉANCE 14 JOURS =====================
   Le drapeau rembourse est posé par TRANSACTION : seul le client qui le fait
   passer false→true rembourse. Élimine le double-recrédit en cas de
   chargements simultanés. */
function auto(list){
  var now=Date.now();
  list.forEach(function(m){
    if(m.statut!=="en_attente"||m.chef||m.rembourse)return;
    if(now-new Date(m.cree).getTime()<F.DELAI_REFUS)return;
    var path=F.CFG.RACINE+"/"+SOUS+"/"+encodeURIComponent(m.id)+"/rembourse";
    var pr;
    try{pr=window.EcoCore.firebaseTransaction(path,function(cur){if(cur===true)throw new Error("DEJA");return true;});}
    catch(e){return;}
    Promise.resolve(pr).then(function(){
      m.rembourse=true;m.statut="refusee";
      var credit=(m.demandeur&&m.prime>0)?F.crediter(m.demandeur,m.prime):Promise.resolve();
      return Promise.resolve(credit).then(function(){
        try{if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,101,{nom:m.titre,montant:m.prime},"aop"+m.id);}catch(e){}
        patch(m,{statut:"refusee"});F.renderAll();
      });
    }).catch(function(e){
      if(e&&e.message==="DEJA"){m.rembourse=true;m.statut="refusee";patch(m,{statut:"refusee"});F.renderAll();}
    });
  });
}

/* ===================== DÉCLARATION ===================== */
F.flux({
  k:"operations", sous:SOUS, label:"Opérations", ic:"fi-tr-anchor",
  vide:T.VIDE, intro:T.INTRO, statuts:STATUTS,
  normaliser:normaliser, ligne:ligne, panel:panel,
  act:act, doo:doo, brancher:brancher, auto:auto
});

})(window.TDLFlot);
