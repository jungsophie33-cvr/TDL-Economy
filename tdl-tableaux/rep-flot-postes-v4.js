/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU HANGAR · MOTEUR DES POSTES
   (rep-flot-postes.js) — à charger APRÈS rep-flot-core.js et AVANT
   rep-flot-marees.js, qui s'en sert.

   [MAJ v2] LES POSTES PASSENT AUX CLÉS.
     ecrirePostes() réécrivait le TABLEAU ENTIER à chaque geste : prise de
     poste, abandon, rapport, notation, paie. Deux joueurs prenant DEUX postes
     différents de la même marée à moins de quinze secondes d'écart : le second
     écrasait l'inscription du premier — et son dé, qui n'est tiré qu'une fois
     à l'inscription et ne se retrouve pas. Chaque poste porte désormais sa
     clé (le k qu'il avait déjà) et s'écrit seul : postes/{k}/qui, etc.
     Un champ ordre fige l'ordre d'affichage, que l'indice du tableau donnait
     jusqu'ici par accident.

   [MAJ v2] VERROUS SUR LA PAIE. payerMaree marquait p.paye en mémoire puis
     écrivait le tableau à la fin : deux clôtures simultanées payaient TOUS les
     postes deux fois, plus la part de créateur, et notaient le carnet deux
     fois. Le drapeau de chaque poste est désormais posé par une transaction.
     Le verrou est PAR POSTE, pas par marée : c'est ce qui permet à la paie de
     rester reprenable, un poste non noté étant réglé au passage suivant.

   [MAJ v2] LA REVENTE débitait par F.crediter(acheteur, -prix), bâti sur
     Math.max(0, …) : sur un solde insuffisant, l'acheteur tombait à zéro, le
     vendeur touchait le prix entier, et la différence était CRÉÉE. Elle passe
     par EcoCore.transfererDollars — débit strict puis crédit, avec annulation
     du débit si le crédit échoue — sous verrou pour qu'un double clic ne paie
     pas deux fois.

   DEUX FAMILLES DE POSTES. « À bord » et « au sec » RAPPORTENT au hangar :
   ils transmettent, ils sont notés, ils alimentent le carnet, et vendre à côté
   leur coûte leur prime. « La diversion » et « l'écueil » ne rapportent rien :
   on les paie pour avoir tenu leur place, pas pour une information. L'écueil
   garde un scellé — ce qu'il découvre s'il regarde de trop près — mais il ne
   le doit à personne, et il peut le vendre sans rien perdre.

   « À bord » est le seul poste réservé : on ne monte pas sur un bateau de la
   Flottille sans en être. Les trois autres sont ouverts à tout le monde, et
   c'est ce qui fait du tableau une porte d'entrée.

   LE SCELLÉ dit ce qui SE PRODUIT, jamais ce que le personnage en conclut.
   « Un pick-up remonte le chemin sans phares à 2h40 » est un scellé ; « vous
   reconnaissez le comptable » n'en est pas un, c'est une déduction, et elle
   appartient au joueur.

   LE DÉ — tiré À L'INSCRIPTION, pas après. « Repéré » n'est pas un verdict,
   c'est une matière : connu avant l'écriture il entre dans la scène, connu
   après il s'ajoute en note de bas de page. Privé : titulaire, créateur, staff.

   LA REVENTE — un seul acheteur, annonce périmée à 3 jours, et le contenu
   scellé n'est révélé qu'au paiement. Le vendeur ne peut transmettre que le
   scellé : il ne peut pas vendre du faux, seulement choisir à qui donner le
   vrai. La case reste invisible du créateur de la marée, visible du staff.
   ================================================================== */
(function(F){
"use strict";
if(!F){ if(window.console) console.warn("[rep-flot-postes] rep-flot-core absent."); return; }
var esc=F.esc, escAttr=F.escAttr, vt=F.vt, money=F.money, ilya=F.ilya, av=F.av, $=F.$;
var S=F.S, toast=F.toast;

/* ===================== CATALOGUE DES POSTES ===================== */
var POSTES={
  bord:     {label:"À bord",      montant:100, legal:"illégal selon la cargaison", scelle:true, rapporte:true, flottille:true,
             desc:"Vous partez avec le bateau comme matelot. Le travail ne manque pas à bord et vous manoeuvrez pendant qu'un autre arrange ce pourquoi vous vous retrouvez là. Témoin direct de toute l'aventure, vous pouvez être fiable... ou trop bavard."},
  sec:      {label:"Au sec",      montant:75,  legal:"légal", scelle:true, rapporte:true,
             desc:"Vous restez à terre et vous vous rendez utile au bon endroit. Votre capacité à observer est la raison pour laquelle on vous paie. Le travail est parfaitement légal ; la raison qui l'a créé... pas toujours."},
  diversion:{label:"La diversion",montant:75,  legal:"ambigu", scelle:false, rapporte:false,
             desc:"On vous demande de provoquer un peu de chaos, quelque part, à une heure précise. On ne vous dit pas pourquoi et si vous tenez à votre récompense, alors ne demandez pas. Ce que vous provoquez ne devrait pas vous exposer à de gros ennuis."},
  ecueil:   {label:"L\u2019écueil",montant:75, legal:"selon qui vous jouez", scelle:false, rapporte:false,
             desc:"Vous n\u2019êtes pas de l\u2019équipage. En fait, vous êtes le facteur imprévu, le caillou dans la chaussure mais qui avait toutes les raisons de se trouver là au moment où la Flottille arrive... et nulle raison de laisser faire ce qui se trame."}
};
var PART_CREATEUR=100;

/* d4 du coût, tiré à l'inscription */
var COUTS={
  1:{label:"Rien",     desc:"Sortie propre. Personne n\u2019a rien remarqué."},
  2:{label:"Repéré",   desc:"Quelqu\u2019un vous a vu. À vous de déterminer si vous savez qui."},
  3:{label:"Un mensonge", desc:"Vous avez dû mentir à quelqu'un d'important."},
  4:{label:"Du retard",desc:"Vous prenez plus de temps que le timing nécessaire et mettez potentiellement la marée en danger."}
};

/* notation par le créateur : ce que ça paie, ce que ça écrit au carnet */
var NOTES={
  conforme:     {label:"Conforme",      coef:1,   carnet:"fiable"},
  incomplete:   {label:"Incomplète",    coef:0.5, carnet:"invérifiable"},
  fausse:       {label:"Fausse",        coef:0,   carnet:"faux"},
  non_transmise:{label:"Non transmise", coef:0,   carnet:"faux"}
};
var NOTE_ABANDON="faux";

/* branches de clôture offertes au titulaire */
var BRANCHES={
  transmets:{label:"Je transmets ce que j\u2019ai vu", vend:false},
  arrange:  {label:"Je transmets une version arrangée, et je vends la vraie", vend:true},
  rien:     {label:"Je ne transmets rien, et je vends", vend:true}
};
var PEREMPTION=3*86400000;

/* ===================== HELPERS ===================== */
function tirerDe(){return 1+Math.floor(Math.random()*4);}
/* le chef ne rapporte rien : il ne se fait pas de rapport à lui-même */
function rapporte(p){return !!POSTES[p.type].rapporte && !p.chef;}

function normPoste(p,k,ordre){
  p=p||{};
  p.k=k||p.k||("p"+(ordre||0));
  if(p.ordre==null)p.ordre=(ordre==null?999:ordre);
  p.chef=!!p.chef;                       /* le capitaine qui a monté la sortie */
  p.type=POSTES[p.type]?p.type:"sec";
  p.titre=p.titre||POSTES[p.type].label;
  p.consigne=p.consigne||"";
  p.heure=p.heure||"";
  p.scelle=(POSTES[p.type].scelle&&!p.chef&&p.scelle)||"";  /* ni la diversion ni le chef */
  p.qui=p.qui||"";
  p.de=parseInt(p.de,10)||0;
  p.etat=/^(libre|pris|abandonne|clos)$/.test(p.etat)?p.etat:(p.qui?"pris":"libre");
  var rap=rapporte(p);
  p.branche=(rap&&BRANCHES[p.branche])?p.branche:"";
  p.transmis=rap?(p.transmis||""):"";
  p.note=(rap&&NOTES[p.note])?p.note:"";
  p.vente=(p.vente&&p.vente.acheteur)?p.vente:null;
  p.paye=!!p.paye;
  return p;
}

/* [MAJ v2] LECTURE BI-SCHÉMA. v2 = nœud à clés, v1 = tableau. On rend toujours
   une liste triée par ordre puis par clé : l'ordre d'affichage ne doit plus
   dépendre de la position dans un tableau qui n'existe plus. */
function postes(m){
  var v=m&&m.postes, out=[];
  if(v==null)return out;
  if(Array.isArray(v)){
    v.forEach(function(p,i){ if(p)out.push(normPoste(p,(p&&p.k)||("p"+i),i)); });
  } else if(typeof v==="object"){
    Object.keys(v).forEach(function(k){ var p=v[k]; if(p)out.push(normPoste(p,k,null)); });
  }
  out.sort(function(a,b){
    var oa=(a.ordre==null)?999:a.ordre, ob=(b.ordre==null)?999:b.ordre;
    if(oa!==ob)return oa-ob;
    return String(a.k).localeCompare(String(b.k));
  });
  return out;
}
function posteDe(m,k){
  var l=postes(m);
  for(var i=0;i<l.length;i++)if(l[i].k===k)return l[i];
  return null;
}
/* écriture d'UN poste : postes/{k}/champ — n'écrase aucun autre poste */
function ecrP(m,p,champs){
  var o={}, c;
  for(c in champs){ if(champs.hasOwnProperty(c)) o["postes/"+p.k+"/"+c]=champs[c]; }
  return F.patch(m,o);
}
function cheminPoste(m,p){ return F.cheminEntree(m)+"/postes/"+encodeURIComponent(p.k); }

function montantDe(p){return POSTES[p.type].montant;}
function peutTenir(m,me){
  if(!me)return false;
  return !postes(m).some(function(p){return p.qui===me;});
}
function offreVive(v){
  if(!v||v.statut!=="proposee")return false;
  return Date.now()-new Date(v.date).getTime()<PEREMPTION;
}

/* ---- PLAN DE MIGRATION v1 → v2, à déclarer par le type « marée » ----
   La clé du poste est celle qu'il portait déjà ; l'ordre est figé depuis sa
   position dans l'ancien tableau. */
var PLAN = {
  postes: {
    cle: function(p,i){ return (p&&p.k)||("p"+i); },
    conv:function(p,i){
      if(!p)return null;
      var o=normPoste(p,(p&&p.k)||("p"+i),i);
      o.ordre=i;
      return o;
    }
  }
};

/* ===================== RENDU D'UN POSTE ===================== */
/* vu = {createur, staff, me} ; les data-* portent la CLÉ du poste */
function carte(m,p,vu){
  var mien=(vu.me&&p.qui===vu.me), rap=rapporte(p);
  var confid=(mien||vu.createur||vu.staff);
  var def=POSTES[p.type];
  var cle=escAttr(p.k);

  var tete='<div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">'+esc(def.label)+' \u27e1 '+esc(p.titre)+'</span>'
    +(p.heure?'<span class="tdlm-r">'+esc(p.heure)+'</span>':'')
    +'<span class="tdlm-r">'+money(montantDe(p))+'</span>'
    +'<span class="tdlm-todo">'+esc(def.legal)+'</span></div>';

  var corps='<div class="tdlm-prose">'+esc(p.consigne||def.desc)+'</div>';

  if(p.qui){
    corps+='<div class="tdlm-person">'+av(p.qui)+'<span class="tdlm-pname">'+esc(p.qui)+'</span>'
      +(p.chef?'<span class="tdlm-r">mène la sortie</span>':'')
      +(p.etat==="abandonne"?'<span class="tdlm-r">a laissé tomber</span>':'')
      +(p.note?'<span class="tdlm-r">'+esc(NOTES[p.note].label)+'</span>':'')+'</div>';
  } else {
    corps+='<p class="tdlm-todo" style="margin:4px 0 0">Poste libre.</p>';
  }
  if(!rap&&p.qui&&p.etat==="pris")
    corps+='<div class="tdlm-prose tdlm-todo">'+(p.chef
      ?"Le capitaine mène la sortie qu\u2019il a montée : part de bord et prime de chef, sans rapport à rendre."
      :"Ce poste ne rapporte rien au hangar : la part est due pour avoir tenu sa place.")+'</div>';

  /* le scellé et le dé : titulaire, créateur, staff */
  if(confid&&p.qui){
    if(p.de)corps+='<div class="tdlm-prose"><b>Ce que ça vous a coûté :</b> '+esc(COUTS[p.de].label)+' \u2014 '+esc(COUTS[p.de].desc)+'</div>';
    if(p.scelle)corps+='<div class="tdlm-prose"><b>Ce qu\u2019il y avait à voir :</b> '+esc(p.scelle)+'</div>';
    if(p.transmis)corps+='<div class="tdlm-prose"><b>Ce qui a été transmis :</b> '+esc(p.transmis)+'</div>';
  }
  /* la revente ne se montre qu'au staff et au vendeur */
  if(p.vente&&(vu.staff||mien)){
    corps+='<div class="tdlm-prose tdlm-todo">Information vendue à '+esc(p.vente.acheteur)
      +' \u27e1 '+money(p.vente.prix)+' \u27e1 '+esc(p.vente.statut==="acceptee"?"payée":(offreVive(p.vente)?"en attente":"périmée"))+'</div>';
  }

  var btns="";
  var ferme=(def.flottille&&!F.estFlottille(vu.me))||p.chef;
  if(p.etat==="libre"&&def.flottille&&!p.chef)
    corps+='<div class="tdlm-prose tdlm-todo">Poste réservé aux membres de la Flottille.</div>';
  if(p.etat==="libre"&&!ferme&&m.statut!=="close"&&m.statut!=="refusee"&&F.estConnecte()&&peutTenir(m,vu.me))
    btns+='<button class="tdlm-abtn prim" data-poste="prendre:'+cle+'">Je prends ce poste</button>';
  /* le rapport reste ouvert jusqu'à la clôture effective, validation comprise */
  if(mien&&p.etat==="pris"&&m.statut!=="close"&&m.statut!=="refusee"){
    if(rap)btns+='<button class="tdlm-abtn'+(p.branche?'':' prim')+'" data-poste="cloturer:'+cle+'">'
      +(p.branche?"Modifier mon rapport":"Rendre compte ou vendre")+'</button>';
    else if(p.scelle)btns+='<button class="tdlm-abtn" data-poste="cloturer:'+cle+'">'+(p.vente?"Modifier mon offre":"Vendre ce que j\u2019ai appris")+'</button>';
  }
  if(mien&&rap&&p.etat==="pris"&&!p.branche&&m.statut!=="close"&&m.statut!=="refusee")
    corps+='<div class="tdlm-prose tdlm-todo">Vous n\u2019avez pas encore rendu compte. Sans rapport, le poste sera réglé comme non transmis.</div>';
  if((vu.createur||vu.staff)&&p.etat==="pris")
    btns+='<button class="tdlm-abtn warn" data-poste="abandon:'+cle+'">Marquer abandonné</button>';
  if((vu.createur||vu.staff)&&p.etat==="pris"&&rap&&p.branche&&m.statut==="en_validation"){
    btns+='<select class="tdlm-sel" data-note="'+cle+'"><option value="">— noter —</option>'
      +Object.keys(NOTES).map(function(k){return '<option value="'+k+'"'+(k===p.note?' selected':'')+'>'+esc(NOTES[k].label)+'</option>';}).join("")
      +'</select>';
  }

  return '<div class="tdlm-cadre">'+tete+corps+(btns?'<div class="tdlm-row">'+btns+'</div>':'')+'</div>';
}

/* ===================== TIROIRS ===================== */
function tiroirCloture(m,p){
  var def=POSTES[p.type], rap=rapporte(p), cle=escAttr(p.k);
  var pjs=Object.keys(F.membres()).sort(function(a,b){return a.localeCompare(b,"fr");})
    .filter(function(x){return x!==p.qui;})
    .map(function(x){return '<option value="'+escAttr(x)+'"'+(p.vente&&x===p.vente.acheteur?' selected':'')+'>'+esc(x)+'</option>';}).join("");
  var vente='<div class="tdlm-row"><div style="flex:2"><label class="tdlm-fl">Vendre à</label>'
    +'<select id="tdlh-vacheteur"><option value="">— personne —</option>'+pjs+'</select></div>'
    +'<div style="flex:1"><label class="tdlm-fl">Prix ($)</label><input type="text" id="tdlh-vprix" value="'+escAttr(p.vente?p.vente.prix:"")+'"></div></div>'
    +'<label class="tdlm-fl">L\u2019annonce (ce que vous vendez, sans le dire)</label>'
    +'<input type="text" id="tdlh-vannonce" value="'+escAttr(p.vente?p.vente.annonce:"")+'" placeholder="Ce que j\u2019ai vu passer dans le chenal de Dulac mardi soir…">';
  var scelle=p.scelle?'<div class="tdlm-prose"><b>Ce qu\u2019il y avait à voir :</b> '+esc(p.scelle)+'</div>':'';

  /* poste qui ne rapporte pas : rien à transmettre, seulement à vendre */
  if(!rap){
    return '<div class="tdlm-drawer on"><h4>Ce que vous en faites \u2014 '+esc(def.label)+'</h4>'+scelle
      +'<div class="tdlm-prose tdlm-todo">Votre part est due quoi qu\u2019il arrive : personne ne vous a payé pour rapporter quelque chose. Ce que vous savez ne regarde que vous, et vous pouvez le monnayer sans rien perdre.</div>'
      +vente
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="posteok:'+cle+'">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }

  var bs=Object.keys(BRANCHES).map(function(k){return '<option value="'+k+'"'+(k===p.branche?' selected':'')+'>'+esc(BRANCHES[k].label)+'</option>';}).join("");
  return '<div class="tdlm-drawer on"><h4>Rendre compte \u2014 '+esc(def.label)+'</h4>'+scelle
    +'<label class="tdlm-fl">Ce que vous faites de ce que vous savez</label><select id="tdlh-branche">'+bs+'</select>'
    +'<label class="tdlm-fl">Ce que vous transmettez au hangar</label><textarea id="tdlh-transmis">'+esc(p.transmis)+'</textarea>'
    +'<div class="tdlm-prose tdlm-todo">Vendre à côté ferme la prime du hangar et laisse une trace au carnet. C\u2019est le prix du double jeu, pas un empêchement.</div>'
    +vente
    +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="posteok:'+cle+'">Enregistrer</button>'
    +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
}

/* ===================== ÉCRITURES ===================== */
function prendre(m,k){
  var me=F.myPseudo();
  if(!me){toast("Connectez-vous pour prendre un poste.");return;}
  if(!F.exigeV2(m))return;
  var p=posteDe(m,k);
  if(!p||p.etat!=="libre"){toast("Ce poste n\u2019est plus libre.");return;}
  if(POSTES[p.type].flottille&&!F.estFlottille(me)){toast("On ne monte pas sur un bateau de la Flottille sans en \u00eatre.");return;}
  if(!peutTenir(m,me)){toast("Vous tenez déjà un poste sur cette marée.");return;}
  if(!window.confirm("S\u2019inscrire à un poste, c\u2019est s\u2019engager. On ne se retire pas d\u2019une marée.\n\nPrendre « "+POSTES[p.type].label+" » ?"))return;
  var de=tirerDe(), pris=new Date().toISOString();
  /* [MAJ v2] seul CE poste est écrit : l'inscription d'un voisin et son dé
     ne peuvent plus être effacés par la nôtre. */
  ecrP(m,p,{qui:me, etat:"pris", de:de, pris:pris});
  p.qui=me; p.etat="pris"; p.de=de; p.pris=pris;
  toast(COUTS[de].label+" \u2014 "+COUTS[de].desc);
  F.renderAll();
}

function abandonner(m,k){
  if(!F.exigeV2(m))return;
  var p=posteDe(m,k);
  if(!p||p.etat!=="pris")return;
  if(!window.confirm("Marquer le poste de "+p.qui+" comme abandonné ?\nIl ne sera pas payé et prendra un faux au carnet. Le poste n\u2019est pas rouvert."))return;
  ecrP(m,p,{etat:"abandonne"});
  p.etat="abandonne";
  noterCarnet(p.qui,NOTE_ABANDON);
  toast("Poste amputé. La marée continue sans.");
  F.renderAll();
}

function cloturerPoste(m,k){
  if(!F.exigeV2(m))return;
  var p=posteDe(m,k);
  if(!p)return;
  var rap=rapporte(p);
  var a=$("#tdlh-vacheteur"), px=$("#tdlh-vprix"), an=$("#tdlh-vannonce");
  var acheteur=a?a.value:"", prix=px?parseInt(String(px.value).replace(/[^\d]/g,""),10):0, annonce=an?String(an.value||"").trim():"";
  var vend=!!acheteur, champs={};

  if(rap){
    var b=$("#tdlh-branche"), t=$("#tdlh-transmis");
    var branche=b?b.value:"", transmis=t?String(t.value||"").trim():"";
    if(!BRANCHES[branche]){toast("Dis ce que tu fais de ce que tu sais.");return;}
    if(branche!=="rien"&&!transmis){toast("Écris ce que tu transmets au hangar.");return;}
    vend=BRANCHES[branche].vend;
    champs.branche=branche; champs.transmis=transmis;
    p.branche=branche; p.transmis=transmis;
  }
  if(vend){
    if(!acheteur){toast("Vendre à qui ?");return;}
    if(!prix||prix<=0){toast("Indique un prix.");return;}
    if(!annonce){toast("Écris l\u2019annonce : ce que tu vends, sans le dire.");return;}
    /* une offre modifiée repart à zéro : ni réglée, ni acceptée */
    p.vente={acheteur:acheteur, prix:prix, annonce:annonce, statut:"proposee", date:new Date().toISOString()};
    champs.vente=p.vente;
    try{if(window.EcoNotif)EcoNotif.a(acheteur,103,{nom:annonce},"vte"+m.id+p.k);}catch(e){}
  } else {
    p.vente=null; champs.vente=null;
  }
  ecrP(m,p,champs);
  S.inline=null; S.drawer=null;
  toast(vend?"Enregistré. L\u2019offre part à l\u2019acheteur.":"Enregistré.");
  F.renderAll();
}

function noterPoste(m,k,note){
  if(!NOTES[note])return;
  if(!F.exigeV2(m))return;
  var p=posteDe(m,k);
  if(!p)return;
  ecrP(m,p,{note:note});
  p.note=note;
}

/* ===================== CARNET ===================== */
/* transaction sur le nœud entier d'une fiche : deux clôtures simultanées ne
   s'écrasent pas. Le carnet ne recense QUE les postes notés : il mesure la
   fiabilité des signalements, pas la présence. Un écueil, une diversion, le
   chef n'y entrent pas. */
function noterCarnet(pseudo,note){
  if(!pseudo||!note)return Promise.resolve();
  var path=F.CFG.RACINE+"/"+F.CFG.SOUS_CARNET+"/"+encodeURIComponent(pseudo);
  try{
    return Promise.resolve(window.EcoCore.firebaseTransaction(path,function(cur){
      var e=cur||{}; var notes=vt(e.notes); notes.push(note);
      return {postes:(+e.postes||0)+1, notes:notes.slice(-10), dernier:new Date().toISOString()};
    })).catch(function(){});
  }catch(e){return Promise.resolve();}
}

/* ===================== PAIE ===================== */
/* [MAJ v2] UN VERROU PAR POSTE. Le drapeau paye est posé par transaction sur
   postes/{k}/paye : un seul client paie, les autres reçoivent DEJA et passent.
   Le verrou est volontairement au niveau du POSTE et non de la marée, pour que
   la paie reste reprenable — un poste non noté est réglé au passage suivant.
   Renvoie une promesse ; chaînée poste par poste pour ne pas noyer Firebase. */
function payerMaree(m){
  var l=postes(m), suite=Promise.resolve(), total=0;
  l.forEach(function(p){
    if(p.paye||p.etat!=="pris")return;
    var gain, carnet=null;
    if(rapporte(p)){
      if(!p.note)return;                       /* non noté : réglé plus tard */
      gain=Math.round(montantDe(p)*NOTES[p.note].coef);
      carnet=NOTES[p.note].carnet;
    } else {
      gain=montantDe(p)+(p.chef?F.CHEF_BONUS:0);  /* part pleine, + prime de chef */
    }
    var qui=p.qui;
    suite=suite.then(function(){
      return F.verrou(cheminPoste(m,p)+"/paye").then(function(){
        p.paye=true; total+=gain;
        return (gain>0?F.crediter(qui,gain):Promise.resolve()).then(function(){return noterCarnet(qui,carnet);});
      }, function(e){
        if(F.estDeja(e)){ p.paye=true; return; }   /* déjà réglé ailleurs */
        throw e;
      });
    });
  });
  /* le créateur qui embarque touche sa part de bord et sa prime de chef ;
     celui qui reste à terre (staff) touche la part de créateur. */
  var embarque=l.some(function(p){return p.chef&&p.qui===m.createur;});
  if(m.createur&&!m.createurPaye&&!embarque){
    suite=suite.then(function(){
      return F.verrou(F.cheminEntree(m)+"/createurPaye").then(function(){
        m.createurPaye=true; total+=PART_CREATEUR;
        return F.crediter(m.createur,PART_CREATEUR);
      }, function(e){
        if(F.estDeja(e)){ m.createurPaye=true; return; }
        throw e;
      });
    });
  }
  if(embarque&&!m.createurPaye)m.createurPaye=true;
  return suite.then(function(){ return total; });
}

/* ===================== REVENTE : CÔTÉ ACHETEUR ===================== */
function offresPourMoi(){
  var me=F.myPseudo(), out=[];
  if(!me)return out;
  F.liste().forEach(function(m){
    if(!m.postes)return;
    postes(m).forEach(function(p){
      if(!p.vente||p.vente.acheteur!==me)return;
      if(p.vente.statut==="proposee"&&!offreVive(p.vente))return;
      out.push({m:m,p:p});
    });
  });
  return out;
}

/* [MAJ v2] verrou puis TRANSFERT STRICT. L'ancienne version débitait par
   F.crediter(me,-prix) : sur un solde insuffisant, l'acheteur tombait à zéro
   et le vendeur touchait le prix entier. Si le transfert échoue, le verrou est
   relâché — relâcher un drapeau ne touche à aucun argent. */
function accepterOffre(m,k){
  var me=F.myPseudo(), p=posteDe(m,k);
  if(!p||!p.vente||p.vente.acheteur!==me)return;
  if(!offreVive(p.vente)){toast("Cette offre a expiré.");return;}
  var prix=+p.vente.prix||0, vendeur=p.qui;
  if(F.solde(me)<prix){toast("Fonds insuffisants.");return;}
  if(!window.confirm("Payer "+money(prix)+" à "+vendeur+" pour cette information ?"))return;
  F.verrou(cheminPoste(m,p)+"/vente/regle").then(function(){
    return F.transferer(me,vendeur,prix).then(function(){
      p.vente.statut="acceptee"; p.vente.paye=new Date().toISOString(); p.vente.regle=true;
      ecrP(m,p,{"vente/statut":"acceptee","vente/paye":p.vente.paye});
      toast("Information achetée.");F.renderAll();
    }, function(e){
      /* le paiement n'a pas eu lieu : on rouvre l'offre */
      ecrP(m,p,{"vente/regle":null});
      if(e&&e.message==="FONDS")toast("Fonds insuffisants au moment du paiement — rien n\u2019a été débité.");
      else toast("Paiement impossible — rien n\u2019a été débité.");
      F.renderAll();
    });
  }).catch(function(e){
    if(F.estDeja(e)){toast("Cette offre a déjà été payée — rien n\u2019a été débité une seconde fois.");F.renderAll();return;}
    toast("Paiement impossible.");
  });
}
function refuserOffre(m,k){
  var p=posteDe(m,k);
  if(!p||!p.vente)return;
  p.vente.statut="refusee";
  ecrP(m,p,{"vente/statut":"refusee"});
  toast("Offre refusée.");F.renderAll();
}

/* vue annexe « Offres reçues » */
function vueOffres(){
  var l=offresPourMoi();
  var corps=l.length?l.map(function(x){
    var v=x.p.vente, vive=offreVive(v), pris=(v.statut==="acceptee");
    var ref=escAttr(x.m.id)+':'+escAttr(x.p.k);
    var bloc='<div class="tdlm-cadre"><div class="tdlm-cadre-hd">'
      +'<span class="tdlm-hsec" style="margin:0">'+esc(v.annonce)+'</span>'
      +'<span class="tdlm-r">'+money(v.prix)+'</span></div>'
      +'<div class="tdlm-prose tdlm-todo">Proposée par '+esc(x.p.qui)+' \u27e1 '+esc(ilya(v.date))+'</div>';
    if(pris)bloc+='<div class="tdlm-prose"><b>Ce que vous avez acheté :</b> '+esc(x.p.scelle||"—")+'</div>';
    else if(vive)bloc+='<div class="tdlm-row"><button class="tdlm-abtn prim" data-offre="oui:'+ref+'">Payer et lire</button>'
      +'<button class="tdlm-abtn warn" data-offre="non:'+ref+'">Refuser</button></div>';
    else bloc+='<div class="tdlm-prose tdlm-todo">Offre expirée.</div>';
    return bloc+'</div>';
  }).join(""):'<div class="tdlm-empty">Personne ne vous a rien proposé.</div>';
  return '<div class="tdlm-dpanel">'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">Offres reçues</span></div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-sec"><p class="tdlm-hsec">Ce qu\u2019on vous propose</p>'
    +'<div class="tdlm-prose">Vous voyez ce qui est à vendre, pas ce que c\u2019est. Le contenu n\u2019apparaît qu\u2019une fois payé. Une offre tombe au bout de trois jours.</div></div>'
    +corps+'</div></div>';
}

F.vue({
  k:"offres", label:"Offres reçues",
  visible:function(){return F.estConnecte()&&offresPourMoi().length>0;},
  compte:function(){return offresPourMoi().filter(function(x){return x.p.vente.statut==="proposee";}).length;},
  render:vueOffres,
  brancher:function(stage){
    stage.querySelectorAll("[data-offre]").forEach(function(el){
      el.onclick=function(){
        /* oui:<idMaree>:<clePoste> — la clé peut contenir n'importe quoi sauf
           « : », qu'aucune clé Firebase générée ici ne comporte. */
        var b=el.getAttribute("data-offre").split(":");
        var m=null, l=F.liste();
        for(var i=0;i<l.length;i++)if(l[i].id===b[1])m=l[i];
        if(!m)return;
        if(b[0]==="oui")accepterOffre(m,b[2]); else refuserOffre(m,b[2]);
      };
    });
  }
});

/* ===================== EXPORT ===================== */
window.TDLPostes = {
  POSTES:POSTES, COUTS:COUTS, NOTES:NOTES, BRANCHES:BRANCHES, PART_CREATEUR:PART_CREATEUR, PLAN:PLAN,
  normPoste:normPoste, postes:postes, posteDe:posteDe, ecrP:ecrP,
  montantDe:montantDe, peutTenir:peutTenir, rapporte:rapporte, tirerDe:tirerDe,
  carte:carte, tiroirCloture:tiroirCloture,
  prendre:prendre, abandonner:abandonner, cloturerPoste:cloturerPoste, noterPoste:noterPoste,
  noterCarnet:noterCarnet, payerMaree:payerMaree
};

})(window.TDLFlot);
