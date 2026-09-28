/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU HANGAR · MOTEUR DES POSTES
   (rep-flot-postes.js) — à charger APRÈS rep-flot-core.js et AVANT
   rep-flot-marees.js, qui s'en sert.

   Tout ce qui est commun aux postes d'une marée et n'a pas besoin de savoir
   ce qu'est une marée : le catalogue des postes, le dé du coût, la notation,
   la paie, l'écriture du carnet, et la revente d'information.

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
   appartient au joueur. Seuls « à bord » et « au sec » en ont un : observer
   est leur travail. Ce qui se découvre par hasard passe par les ACCROCHES de
   la marée, ouvertes en cours de RP (voir rep-flot-marees).

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
  3:{label:"Un mensonge", desc:"Vous avez dû mentir à quelqu\u2019un d'important."},
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
function normPoste(p,i){
  p=p||{};
  p.k=p.k||("p"+i);
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
function montantDe(p){return POSTES[p.type].montant;}
function peutTenir(m,me){
  if(!me)return false;
  return !vt(m.postes).some(function(p){return p.qui===me;});
}
function offreVive(v){
  if(!v||v.statut!=="proposee")return false;
  return Date.now()-new Date(v.date).getTime()<PEREMPTION;
}

/* ===================== RENDU D'UN POSTE ===================== */
/* vu = {createur, staff, me} ; idx sert aux data-* */
function carte(m,p,idx,vu){
  var mien=(vu.me&&p.qui===vu.me), rap=rapporte(p);
  var confid=(mien||vu.createur||vu.staff);
  var def=POSTES[p.type];

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
    btns+='<button class="tdlm-abtn prim" data-poste="prendre:'+idx+'">Je prends ce poste</button>';
  /* le rapport reste ouvert jusqu'à la clôture effective, validation comprise */
  if(mien&&p.etat==="pris"&&m.statut!=="close"&&m.statut!=="refusee"){
    if(rap)btns+='<button class="tdlm-abtn'+(p.branche?'':' prim')+'" data-poste="cloturer:'+idx+'">'
      +(p.branche?"Modifier mon rapport":"Rendre compte ou vendre")+'</button>';
    else if(p.scelle)btns+='<button class="tdlm-abtn" data-poste="cloturer:'+idx+'">'+(p.vente?"Modifier mon offre":"Vendre ce que j\u2019ai appris")+'</button>';
  }
  if(mien&&rap&&p.etat==="pris"&&!p.branche&&m.statut!=="close"&&m.statut!=="refusee")
    corps+='<div class="tdlm-prose tdlm-todo">Vous n\u2019avez pas encore rendu compte. Sans rapport, le poste sera réglé comme non transmis.</div>';
  if((vu.createur||vu.staff)&&p.etat==="pris")
    btns+='<button class="tdlm-abtn warn" data-poste="abandon:'+idx+'">Marquer abandonné</button>';
  if((vu.createur||vu.staff)&&p.etat==="pris"&&rap&&p.branche&&m.statut==="en_validation"){
    btns+='<select class="tdlm-sel" data-note="'+idx+'"><option value="">— noter —</option>'
      +Object.keys(NOTES).map(function(k){return '<option value="'+k+'"'+(k===p.note?' selected':'')+'>'+esc(NOTES[k].label)+'</option>';}).join("")
      +'</select>';
  }

  return '<div class="tdlm-cadre">'+tete+corps+(btns?'<div class="tdlm-row">'+btns+'</div>':'')+'</div>';
}

/* ===================== TIROIRS ===================== */
function tiroirCloture(m,p,idx){
  var def=POSTES[p.type], rap=rapporte(p);
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
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="posteok:'+idx+'">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }

  var bs=Object.keys(BRANCHES).map(function(k){return '<option value="'+k+'"'+(k===p.branche?' selected':'')+'>'+esc(BRANCHES[k].label)+'</option>';}).join("");
  return '<div class="tdlm-drawer on"><h4>Rendre compte \u2014 '+esc(def.label)+'</h4>'+scelle
    +'<label class="tdlm-fl">Ce que vous faites de ce que vous savez</label><select id="tdlh-branche">'+bs+'</select>'
    +'<label class="tdlm-fl">Ce que vous transmettez au hangar</label><textarea id="tdlh-transmis">'+esc(p.transmis)+'</textarea>'
    +'<div class="tdlm-prose tdlm-todo">Vendre à côté ferme la prime du hangar et laisse une trace au carnet. C\u2019est le prix du double jeu, pas un empêchement.</div>'
    +vente
    +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="posteok:'+idx+'">Enregistrer</button>'
    +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
}

/* ===================== ÉCRITURES ===================== */
function ecrirePostes(m,postes){ F.patch(m,{postes:postes}); }

function prendre(m,idx){
  var me=F.myPseudo();
  if(!me){toast("Connectez-vous pour prendre un poste.");return;}
  var postes=vt(m.postes), p=postes[idx];
  if(!p||p.etat!=="libre"){toast("Ce poste n\u2019est plus libre.");return;}
  if(POSTES[p.type].flottille&&!F.estFlottille(me)){toast("On ne monte pas sur un bateau de la Flottille sans en \u00eatre.");return;}
  if(!peutTenir(m,me)){toast("Vous tenez déjà un poste sur cette marée.");return;}
  if(!window.confirm("S\u2019inscrire à un poste, c\u2019est s\u2019engager. On ne se retire pas d\u2019une marée.\n\nPrendre « "+POSTES[p.type].label+" » ?"))return;
  p.qui=me; p.etat="pris"; p.de=tirerDe(); p.pris=new Date().toISOString();
  m.postes=postes; ecrirePostes(m,postes);
  if(m.statut==="en_attente"&&postes.some(function(x){return x.etat==="pris";})){
    /* la marée vit dès qu'un poste est tenu ; le créateur la fera partir */
  }
  toast(COUTS[p.de].label+" \u2014 "+COUTS[p.de].desc);
  F.renderAll();
}

function abandonner(m,idx){
  var postes=vt(m.postes), p=postes[idx];
  if(!p||p.etat!=="pris")return;
  if(!window.confirm("Marquer le poste de "+p.qui+" comme abandonné ?\nIl ne sera pas payé et prendra un faux au carnet. Le poste n\u2019est pas rouvert."))return;
  p.etat="abandonne";
  m.postes=postes; ecrirePostes(m,postes);
  noterCarnet(p.qui,NOTE_ABANDON);
  toast("Poste amputé. La marée continue sans.");
  F.renderAll();
}

function cloturerPoste(m,idx){
  var postes=vt(m.postes), p=postes[idx];
  if(!p)return;
  var rap=rapporte(p);
  var a=$("#tdlh-vacheteur"), px=$("#tdlh-vprix"), an=$("#tdlh-vannonce");
  var acheteur=a?a.value:"", prix=px?parseInt(String(px.value).replace(/[^\d]/g,""),10):0, annonce=an?String(an.value||"").trim():"";
  var vend=!!acheteur;

  if(rap){
    var b=$("#tdlh-branche"), t=$("#tdlh-transmis");
    var branche=b?b.value:"", transmis=t?String(t.value||"").trim():"";
    if(!BRANCHES[branche]){toast("Dis ce que tu fais de ce que tu sais.");return;}
    if(branche!=="rien"&&!transmis){toast("Écris ce que tu transmets au hangar.");return;}
    vend=BRANCHES[branche].vend;
    p.branche=branche; p.transmis=transmis;
  }
  if(vend){
    if(!acheteur){toast("Vendre à qui ?");return;}
    if(!prix||prix<=0){toast("Indique un prix.");return;}
    if(!annonce){toast("Écris l\u2019annonce : ce que tu vends, sans le dire.");return;}
    p.vente={acheteur:acheteur, prix:prix, annonce:annonce, statut:"proposee", date:new Date().toISOString()};
    try{if(window.EcoNotif)EcoNotif.a(acheteur,103,{nom:annonce},"vte"+m.id+p.k);}catch(e){}
  } else {
    p.vente=null;
  }
  m.postes=postes; ecrirePostes(m,postes);
  S.inline=null; S.drawer=null;
  toast(vend?"Enregistré. L\u2019offre part à l\u2019acheteur.":"Enregistré.");
  F.renderAll();
}

function noterPoste(m,idx,note){
  var postes=vt(m.postes), p=postes[idx];
  if(!p||!NOTES[note])return;
  p.note=note; m.postes=postes; ecrirePostes(m,postes);
}

/* ===================== CARNET ===================== */
/* transaction sur le nœud entier : deux clôtures simultanées ne s'écrasent pas */
/* le carnet ne recense QUE les postes notés : il mesure la fiabilité des
   signalements, pas la présence. Un écueil, une diversion, le chef n'y
   entrent pas. */
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
/* renvoie une promesse ; chaînée poste par poste pour ne pas noyer Firebase */
function payerMaree(m){
  var postes=vt(m.postes), suite=Promise.resolve(), total=0;
  postes.forEach(function(p){
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
      p.paye=true; total+=gain;
      return (gain>0?F.crediter(qui,gain):Promise.resolve()).then(function(){return noterCarnet(qui,carnet);});
    });
  });
  /* le créateur qui embarque touche sa part de bord et sa prime de chef ;
     celui qui reste à terre (staff) touche la part de créateur. */
  var embarque=postes.some(function(p){return p.chef&&p.qui===m.createur;});
  if(m.createur&&!m.createurPaye&&!embarque){
    suite=suite.then(function(){
      m.createurPaye=true; total+=PART_CREATEUR;
      return F.crediter(m.createur,PART_CREATEUR);
    });
  }
  if(embarque&&!m.createurPaye)m.createurPaye=true;
  return suite.then(function(){ ecrirePostes(m,postes); return total; });
}

/* ===================== REVENTE : CÔTÉ ACHETEUR ===================== */
function offresPourMoi(){
  var me=F.myPseudo(), out=[];
  if(!me)return out;
  F.liste().forEach(function(m){
    if(!m.postes)return;
    vt(m.postes).forEach(function(p,i){
      if(!p.vente||p.vente.acheteur!==me)return;
      if(p.vente.statut==="proposee"&&!offreVive(p.vente))return;
      out.push({m:m,p:p,i:i});
    });
  });
  return out;
}

function accepterOffre(m,idx){
  var me=F.myPseudo(), postes=vt(m.postes), p=postes[idx];
  if(!p||!p.vente||p.vente.acheteur!==me)return;
  if(!offreVive(p.vente)){toast("Cette offre a expiré.");return;}
  var prix=+p.vente.prix||0, vendeur=p.qui;
  if(F.solde(me)<prix){toast("Fonds insuffisants.");return;}
  if(!window.confirm("Payer "+money(prix)+" à "+vendeur+" pour cette information ?"))return;
  F.crediter(me,-prix).then(function(){return F.crediter(vendeur,prix);}).then(function(){
    p.vente.statut="acceptee"; p.vente.paye=new Date().toISOString();
    m.postes=postes; ecrirePostes(m,postes);
    toast("Information achetée.");F.renderAll();
  }).catch(function(){toast("Paiement impossible.");});
}
function refuserOffre(m,idx){
  var postes=vt(m.postes), p=postes[idx];
  if(!p||!p.vente)return;
  p.vente.statut="refusee"; m.postes=postes; ecrirePostes(m,postes);
  toast("Offre refusée.");F.renderAll();
}

/* vue annexe « Offres reçues » */
function vueOffres(){
  var l=offresPourMoi();
  var corps=l.length?l.map(function(x){
    var v=x.p.vente, vive=offreVive(v), pris=(v.statut==="acceptee");
    var bloc='<div class="tdlm-cadre"><div class="tdlm-cadre-hd">'
      +'<span class="tdlm-hsec" style="margin:0">'+esc(v.annonce)+'</span>'
      +'<span class="tdlm-r">'+money(v.prix)+'</span></div>'
      +'<div class="tdlm-prose tdlm-todo">Proposée par '+esc(x.p.qui)+' \u27e1 '+esc(ilya(v.date))+'</div>';
    if(pris)bloc+='<div class="tdlm-prose"><b>Ce que vous avez acheté :</b> '+esc(x.p.scelle||"—")+'</div>';
    else if(vive)bloc+='<div class="tdlm-row"><button class="tdlm-abtn prim" data-offre="oui:'+x.m.id+':'+x.i+'">Payer et lire</button>'
      +'<button class="tdlm-abtn warn" data-offre="non:'+x.m.id+':'+x.i+'">Refuser</button></div>';
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
        var b=el.getAttribute("data-offre").split(":");
        var m=null, l=F.liste();
        for(var i=0;i<l.length;i++)if(l[i].id===b[1])m=l[i];
        if(!m)return;
        if(b[0]==="oui")accepterOffre(m,+b[2]); else refuserOffre(m,+b[2]);
      };
    });
  }
});

/* ===================== EXPORT ===================== */
window.TDLPostes = {
  POSTES:POSTES, COUTS:COUTS, NOTES:NOTES, BRANCHES:BRANCHES, PART_CREATEUR:PART_CREATEUR,
  normPoste:normPoste, montantDe:montantDe, peutTenir:peutTenir, rapporte:rapporte, tirerDe:tirerDe,
  carte:carte, tiroirCloture:tiroirCloture,
  prendre:prendre, abandonner:abandonner, cloturerPoste:cloturerPoste, noterPoste:noterPoste,
  noterCarnet:noterCarnet, payerMaree:payerMaree
};

})(window.TDLFlot);
