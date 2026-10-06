/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU HANGAR · FLUX « OPÉRATIONS »
   (rep-flot-ops.js) — à charger APRÈS rep-flot-core.js.

   [MAJ v2] SCHÉMA 2 — participants et valides deviennent des nœuds à clés
     (clé = pseudo assaini). Deux membres de la Flottille qui cliquent
     « Je participe » dans la même fenêtre de veille ne s'écrasent plus.
     contraintes RESTE un tableau : il s'édite dans un textarea qui réécrit la
     liste entière, les clés n'y apporteraient rien.

   [MAJ v2] VERROUS SUR LES VERSEMENTS. verser() et le remboursement se
     gardaient d'un double paiement en lisant primeVersee / rembourse dans
     l'instantané en mémoire. Deux membres du staff agissant dans la même
     fenêtre de veille versaient la prime DEUX FOIS, ou remboursaient deux
     fois le commanditaire. auto() faisait pourtant déjà la bonne chose : le
     drapeau est désormais posé par transaction partout.
     COMPROMIS ASSUMÉ : le verrou est pris AVANT le mouvement. Si celui-ci
     échoue, l'opération reste marquée réglée sans que l'argent ait bougé. Un
     double versement est silencieux ; une opération bloquée est visible.

   [MAJ v2] LA NÉGOCIATION débitait par F.crediter(demandeur, -delta), bâti sur
     Math.max(0, …) : sur un solde insuffisant le commanditaire tombait à zéro
     et la différence était créée. Le prélèvement est strict, la prime affichée
     revient en arrière s'il est refusé, et un second clic ne passe plus.

   Données : flottille/operations/{id}, créées par quai-staff à la validation
   d'un achat « Opération » en boutique (1 000 $ minimum, prime déjà retenue
   sur le demandeur).

   CYCLE   en_attente → en_cours (un membre de la Flottille s'en empare et
           devient chef) → en_validation → clos.
           14 j sans chef → refusee + recrédit du demandeur.
   ARGENT  prime en parts égales aux participants validés, + 50 $ au chef.
   ACCÈS   lecture ouverte à tous ; inscription réservée à la Flottille
           (aucun navire exigé : l'opération n'est pas une sortie en mer).
   ================================================================== */
(function(F){
"use strict";
if(!F){ if(window.console) console.warn("[rep-flot-ops] rep-flot-core absent."); return; }
var esc=F.esc, escAttr=F.escAttr, vt=F.vt, money=F.money, ilya=F.ilya, av=F.av, $=F.$;
var S=F.S, patch=F.patch, toast=F.toast, cp=F.cp;

/* ===================== CONFIG ===================== */
var SOUS="operations";
var STATUTS=F.STATUTS;   /* statuts communs à tous les types du hangar */
var VERROUS={distance:"La distance", incompatibilite:"L\u2019opposition des les parties", invisibilite:"L\u2019invisibilité nécessaire"};
var MANDANT={joueur:"", entreprise:"entreprise", famille:"famille", pnj:"PNJ", anonyme:"anonyme"};

var T={
  NON_FLOT:"Inscription réservée aux membres de la Flottille.",
  FERMEE:"Opération fermée à l\u2019inscription.",
  DEJA:"Déjà inscrit\u27e1e.",
  CHEF:"Inscrit\u27e1e : vous menez l\u2019opération.",
  PART:"Inscrit\u27e1e à l\u2019opération.",
  CONSULT:"Registre consultable : inscription réservée à la Flottille.",
  CONNECT:"Connectez-vous pour interagir.",
  ATTENTE:"En attente d\u2019un capitaine."
};

/* ---- PLAN DE MIGRATION v1 → v2 ---- */
var PLAN = {
  participants: {mode:"pseudo", conv:function(x){return x?String(x):null;}},
  valides:      {mode:"pseudo", conv:function(x){return x?String(x):null;}}
};

/* pseudos : v1 = tableau de pseudos, v2 = {pseudoAssaini: pseudoRéel} */
function lstPseudos(v){
  if(v==null)return [];
  if(Array.isArray(v))return v.filter(Boolean).map(String);
  if(typeof v!=="object")return [];
  return Object.keys(v).map(function(k){return String(v[k]||k);});
}
function cheminOp(m){ return F.cheminEntree(m); }

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
  o.participants=lstPseudos(o.participants);
  o.valides=lstPseudos(o.valides);
  o.nego=(o.nego&&o.nego.montant!=null)?o.nego:null;
  o.sujet=o.sujet||"";
  o.resume=o.resume||""; o.consequences=o.consequences||"";
  o.demandeValidation=!!o.demandeValidation;
  o.cree=o.cree||new Date().toISOString();
  o.rembourse=!!o.rembourse; o.primeVersee=!!o.primeVersee;
  return o;
}

/* ===================== RANGÉE (le socle compose le reste) ===================== */
function sub(m){
  return { sub:m.mandataire+" \u27e1 "+money(m.prime), qui:m.chef, quand:"ouverte "+ilya(m.cree) };
}
function tags(m){
  return [ m.nego?"\u2691 prime proposée":"" ];
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
        return '<div class="tdlm-person'+(p===m.chef?' chef':'')+'">'+av(p)
      +'<span class="tdlm-pname">'+esc(p)+'</span>'
      +(nav?'<span class="tdlm-r">'+esc(nav)+'</span>':'')
      +chefLbl+chk+'</div>';
  }).join(""):'<p class="tdlm-todo" style="margin:0">Personne de la Flottille ne s\u2019en est encore emparé.</p>';

  var peutRejoindre=(F.estFlottille(me)&&m.participants.indexOf(me)<0&&(m.statut==="en_attente"||m.statut==="en_cours"));
  var joinBtn=peutRejoindre?'<button class="tdlm-abtn prim" data-act="join">Je participe</button>':'';
  var cadre='<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Équipage de l\u2019opération</span>'+joinBtn+'</div>'+pList+'</div>';

  var bilan="";
  if(m.resume||m.consequences||m.statut==="en_validation"||m.statut==="close"){
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

  if(chef&&(m.statut==="en_cours"||m.statut==="en_validation")){
    roles.push("Chef d\u2019opération");
    btns+='<button class="tdlm-abtn" data-act="sujet">'+(m.sujet?"Modifier le sujet RP":"Renseigner le sujet RP")+'</button>';
    if(m.statut==="en_cours"&&!m.sujet)btns+='<button class="tdlm-abtn" data-act="nego">Négocier la prime</button>';
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
    if(m.statut!=="close"&&m.statut!=="refusee")btns+='<button class="tdlm-abtn warn" data-act="refuser">Refuser &amp; rembourser</button>';
    btns+='<button class="tdlm-abtn warn" data-act="delete">Supprimer</button>';
  }
  if(!btns){
    if(dem){roles.push("Commanditaire");btns='<span class="tdlm-idle">'+T.ATTENTE+'</span>';}
    else if(!F.estConnecte()){roles.push("Invité");btns='<span class="tdlm-idle">'+T.CONNECT+'</span>';}
    else if(F.estFlottille(me)){roles.push("Flottille");btns='<span class="tdlm-idle">Utilisez « Je participe » ci-dessus.</span>';}
    else {roles.push("Visiteur");btns='<span class="tdlm-idle">'+T.CONSULT+'</span>';}
  }
  if(!roles.length)roles.push("Visiteur");
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles.join(" \u27e1 ")+'</span>'+btns+'</div>';
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
var _negoEnVol={};

function act(k,m){
  var me=F.myPseudo();

  if(k==="join"){
    if(!F.estFlottille(me)){toast(T.NON_FLOT);return;}
    if(m.statut!=="en_attente"&&m.statut!=="en_cours"){toast(T.FERMEE);return;}
    if(m.participants.indexOf(me)>=0){toast(T.DEJA);return;}
    if(!F.exigeV2(m))return;
    m.participants.push(me);
    /* [MAJ v2] on n'écrit QUE sa propre clé */
    var champs={}; champs["participants/"+cp(me)]=me;
    if(!m.chef){m.chef=me;m.statut="en_cours";champs.chef=me;champs.statut="en_cours";}
    patch(m,champs);toast(m.chef===me?T.CHEF:T.PART);F.renderStage();return;
  }
  if(k==="sujet"||k==="nego"){S.inline=k;S.drawer=null;F.renderStage();return;}
  if(k==="bilan"||k==="edit"){S.drawer=(k==="bilan"?"bilan":"edit");S.inline=null;F.renderStage();return;}

  if(k==="negoyes"){accepterNego(m);return;}
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
      if(!F.exigeV2(m)){el.checked=!el.checked;return;}
      var p=el.getAttribute("data-val"), i=m.valides.indexOf(p);
      if(el.checked&&i<0)m.valides.push(p); else if(!el.checked&&i>=0)m.valides.splice(i,1);
      var ch={}; ch["valides/"+cp(p)]=el.checked?p:null; patch(m,ch);
    };
  });
}

/* ===================== ARGENT ===================== */
/* [MAJ v2] La hausse de prime est un PRÉLÈVEMENT : elle passe par le débit
   strict du socle, et la prime affichée revient en arrière si le compte ne
   couvre pas. Un second clic ne passe plus tant que le premier est en vol. */
function accepterNego(m){
  if(!m.nego||_negoEnVol[m.id])return;
  var neuf=+m.nego.montant||0, delta=neuf-m.prime, ancienne=m.prime;
  if(delta>0&&F.solde(m.demandeur)<delta){toast("Solde insuffisant pour couvrir la hausse.");return;}
  _negoEnVol[m.id]=true;
  m.prime=neuf; m.nego=null;
  patch(m,{prime:neuf,nego:null});
  F.crediter(m.demandeur,-delta).then(function(){
    toast("Prime portée à "+money(neuf)+".");F.renderStage();
  }).catch(function(e){
    m.prime=ancienne; patch(m,{prime:ancienne});
    if(e&&e.message==="FONDS")toast("Fonds insuffisants au moment du prélèvement — prime inchangée, la proposition est annulée.");
    else toast("Ajustement impossible — prime inchangée, la proposition est annulée.");
    F.renderStage();
  }).then(function(){ delete _negoEnVol[m.id]; });
}

/* [MAJ v2] verrou AVANT le recrédit — mêmes trois chemins que l'échéance
   automatique, qui le faisait déjà. */
function rembourser(m, msg){
  F.verrou(cheminOp(m)+"/rembourse").then(function(){
    m.rembourse=true;
    var suite=(m.demandeur&&m.prime>0)?F.crediter(m.demandeur,m.prime):Promise.resolve();
    return Promise.resolve(suite).then(function(){
      m.statut="refusee";
      patch(m,{statut:"refusee"});
      try{if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,101,{nom:m.titre,montant:m.prime},"fop"+m.id);}catch(e){}
      toast(msg);F.renderAll();
    });
  }).catch(function(e){
    if(F.estDeja(e)){m.rembourse=true;m.statut="refusee";patch(m,{statut:"refusee"});toast("Déjà remboursée ailleurs — aucun second recrédit.");F.renderAll();return;}
    toast("Remboursement impossible — l\u2019opération est marquée remboursée, vérifiez le solde avant de recommencer.");F.renderAll();
  });
}

/* [MAJ v2] verrou AVANT tout versement : deux validations simultanées ne
   versaient pas l'une après l'autre, elles versaient DEUX FOIS. */
function verser(m){
  if(m.primeVersee){toast("Prime déjà versée.");return;}
  var gagnants=m.valides.length?m.valides.slice():m.participants.slice();
  if(!gagnants.length){toast("Aucun participant à payer.");return;}
  var part=Math.floor(m.prime/gagnants.length);
  var total=part*gagnants.length+(m.chef?F.CHEF_BONUS:0);
  if(!window.confirm("Verser "+money(part)+" à chacun des "+gagnants.length+" participants"
      +(m.chef?", plus "+money(F.CHEF_BONUS)+" au chef":"")+" ?\nTotal distribué : "+money(total)+"."))return;

  F.verrou(cheminOp(m)+"/primeVersee").then(function(){
    m.primeVersee=true;
    var suite=Promise.resolve();
    gagnants.forEach(function(p){suite=suite.then(function(){return F.crediter(p,part);});});
    if(m.chef)suite=suite.then(function(){return F.crediter(m.chef,F.CHEF_BONUS);});
    return suite;
  }).then(function(){
    m.statut="close";m.demandeValidation=false;m.valides=gagnants;
    /* les validés retenus sont consignés un par un : aucune liste réécrite */
    var ch={statut:"close",demandeValidation:false};
    gagnants.forEach(function(p){ ch["valides/"+cp(p)]=p; });
    patch(m,ch);
    gagnants.forEach(function(p){try{if(window.EcoNotif)EcoNotif.a(p,100,{nom:m.titre},"vop"+m.id+p);}catch(e){}});
    toast("Opération close, prime versée.");F.renderAll();
  }).catch(function(e){
    if(F.estDeja(e)){m.primeVersee=true;toast("Prime déjà versée ailleurs — rien n\u2019a été versé une seconde fois.");F.renderAll();return;}
    toast("Versement interrompu \u2014 l\u2019opération est marquée payée, vérifiez les soldes avant de recommencer.");F.renderAll();
  });
}

/* ===================== ÉCHÉANCE 14 JOURS =====================
   Le drapeau rembourse est posé par TRANSACTION : seul le client qui le fait
   passer false→true rembourse. C'est ce motif, déjà juste ici, qui est
   désormais appliqué aux chemins manuels ci-dessus. */
function auto(list){
  var now=Date.now();
  list.forEach(function(m){
    if(m.statut!=="en_attente"||m.chef||m.rembourse)return;
    if(now-new Date(m.cree).getTime()<F.DELAI_REFUS)return;
    F.verrou(cheminOp(m)+"/rembourse").then(function(){
      m.rembourse=true;m.statut="refusee";
      var credit=(m.demandeur&&m.prime>0)?F.crediter(m.demandeur,m.prime):Promise.resolve();
      return Promise.resolve(credit).then(function(){
        try{if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,101,{nom:m.titre,montant:m.prime},"aop"+m.id);}catch(e){}
        patch(m,{statut:"refusee"});F.renderAll();
      });
    }).catch(function(e){
      if(F.estDeja(e)){m.rembourse=true;m.statut="refusee";patch(m,{statut:"refusee"});F.renderAll();}
    });
  });
}

/* ===================== DÉCLARATION ===================== */
F.type({
  k:"operations", sous:SOUS, label:"Opération", ic:"fi-tr-anchor", plan:PLAN,
  normaliser:normaliser, sub:sub, tags:tags, panel:panel,
  act:act, doo:doo, brancher:brancher, auto:auto
});

})(window.TDLFlot);
