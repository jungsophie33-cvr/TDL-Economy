/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU HANGAR · TYPE « MARÉE »
   (rep-flot-marees.js) — à charger APRÈS rep-flot-core.js ET
   rep-flot-postes.js, dont il utilise le moteur.

   Une marée est une sortie de travail de la Flottille, ouverte par un membre
   qui a un navire, ou par le staff au nom d'un navire canon ou du hangar.
   Elle n'est pas achetée en boutique : personne ne la paie, le hangar règle
   les postes à la clôture.

   LES ACCROCHES — deux ou trois faits attachés à la MARÉE, pas à un poste,
   chacun avec sa condition. Invisibles sauf du créateur et du staff. Quand un
   joueur remplit la condition DANS LE SUJET, l'un des deux ouvre l'accroche :
   elle devient publique, au nom de celui qui l'a obtenue. On n'atteint rien
   sans l'écrire là où les autres le lisent.

   RÈGLE D'ADMISSION — au moins un poste qui ne soit pas « à bord ». Si tous
   les présents sont payés par la Flottille, ce n'est pas une marée, c'est un
   RP entre capitaines. Deux postes minimum, cinq maximum.

   CYCLE   en_attente (postes à pourvoir, le créateur fait partir quand il
           veut) → en_cours → en_validation → clos.
   ARGENT  fonds du hangar : à bord 100 $, les autres postes 75 $, créateur
           100 $, modulés par la note du créateur. Aucune prime retenue, donc
           aucun remboursement : annuler une marée ne rend rien à personne.
   ACCÈS   ouverture réservée à la Flottille avec navire (ou staff) ;
           INSCRIPTION OUVERTE À TOUS, c'est la porte d'entrée du réseau.
   ================================================================== */
(function(F,P){
"use strict";
if(!F||!P){ if(window.console) console.warn("[rep-flot-marees] socle ou moteur des postes absent."); return; }
var esc=F.esc, escAttr=F.escAttr, vt=F.vt, money=F.money, ilya=F.ilya, av=F.av, $=F.$;
var S=F.S, patch=F.patch, toast=F.toast, STATUTS=F.STATUTS;

/* ===================== CONFIG ===================== */
var SOUS="marees";
var SORTIES={
  extraction:  {label:"Extraction", desc:"Sortir quelqu\u2019un de l'endroit où on le retient, vite et sans laisser de trace. Ceux qui le cherchent entrent aussi dans la partie."},
  depose:      {label:"Dépose en zone fermée", desc:"Amener quelqu\u2019un là où on ne l\u2019attend pas : un campement, un village qui ne reçoit pas d\u2019étrangers. La communauté d\u2019accueil n\u2019a pas été prévenue, et elle a son mot à dire."},
  remise:      {label:"Remise en main propre", desc:"Un échange sur un terrain qui n\u2019est à personne, entre deux parties qui ne vont jamais chez l\u2019autre. L\u2019autre partie, ses gens, le propriétaire du lieu : tout le monde est là."},
  recuperation:{label:"Récupération", desc:"Aller chercher ce qui a coulé, été jeté ou oublié. Celui à qui ça appartenait n\u2019a pas forcément renoncé, et celui qui l\u2019a mis là avait ses raisons."},
  recherche:   {label:"Recherche sur l\u2019eau", desc:"Trouver quelqu\u2019un qui ne veut pas forcément l\u2019être. Ceux qui préfèrent qu\u2019on ne le trouve pas sont sur l\u2019eau aussi."}
};
var MIN_POSTES=2, MAX_POSTES=5, MAX_ACCROCHES=3;

var T={
  ADMISSION:"Une marée est une mission d'équipage que vous pouvez monter sur mesure. Une véritable expédition de Flottille où vous devez non seulement proposer un objectif clair à votre équipe, mais aussi prévoir les difficultés auxquelles vous pourriez faire face, en intégrant un rôle d'antagoniste. Une marée doit ouvrir au moins un poste qui ne soit pas « à bord ». Les indices et informations scellées que vous concoctez, ainsi que le déroulement irp de la marée, sont là pour le sel de l'imprévu. N'est-ce pas plus excitant de prendre la mer quand l'horizon se noie dans la brume ?",
  CONNECT:"Connectez-vous pour prendre un poste.",
  OUVERT:"Marée affichée. Les postes se remplissent un par un."
};

/* ===================== NORMALISATION ===================== */
function normaliser(o){
  o.titre=o.titre||"Marée";
  o.createur=o.createur||null;
  o.navire=o.navire||"Le hangar";
  o.sortie=SORTIES[o.sortie]?o.sortie:"extraction";
  o.lieu=o.lieu||""; o.quand=o.quand||"";
  o.contexte=o.contexte||"";
  o.postes=vt(o.postes).map(P.normPoste);
  o.accroches=vt(o.accroches).map(function(a,i){
    a=a||{}; a.k=a.k||("a"+i); a.fait=a.fait||""; a.condition=a.condition||"";
    a.ouverte=!!a.ouverte; a.par=a.par||""; a.date=a.date||"";
    return a;
  });
  o.statut=STATUTS[o.statut]?o.statut:"en_attente";
  o.sujet=o.sujet||"";
  o.resume=o.resume||""; o.consequences=o.consequences||"";
  o.demandeValidation=!!o.demandeValidation;
  o.cree=o.cree||new Date().toISOString();
  o.createurPaye=!!o.createurPaye; o.primeVersee=!!o.primeVersee;
  return o;
}

/* ===================== RANGÉE ===================== */
function pourvus(m){var n=0;vt(m.postes).forEach(function(p){if(p.etat==="pris"||p.etat==="clos")n++;});return n;}
/* ordre horaire : la marée se lit comme une nuit, pas comme quatre fils.
   Les postes sans heure passent en dernier ; écrire HH:MM les range seuls. */
function parHeure(m){
  return vt(m.postes).map(function(p,i){return {p:p,i:i};}).sort(function(a,b){
    var x=a.p.heure||"~", y=b.p.heure||"~";
    return x===y ? a.i-b.i : (x<y?-1:1);
  });
}
function sub(m){
  return { sub:SORTIES[m.sortie].label+(m.lieu?" \u27e1 "+m.lieu:""), qui:m.createur, quand:"ouverte "+ilya(m.cree) };
}
function tags(m){
  var libres=vt(m.postes).filter(function(p){return p.etat==="libre";}).length;
  return [ m.navire, libres?(libres+" poste"+(libres>1?"s":"")+" libre"+(libres>1?"s":"")):"" ];
}

/* ===================== PANNEAU ===================== */
function panel(m){
  var me=F.myPseudo(), staff=F.isStaff(), createur=(me&&me===m.createur);
  var vu={me:me, staff:staff, createur:createur||staff};

  var banner="";
  if(staff&&m.demandeValidation){
    banner='<div class="tdlm-reqbanner"><p class="tdlm-hsec">⚑ Le créateur demande la clôture</p>'
      +'<div class="tdlm-reqrow"><span>Les postes non notés seront réglés comme non transmis.</span></div></div>';
  }

  var cartes=parHeure(m).map(function(x){return P.carte(m,x.p,x.i,vu);}).join("")
    || '<div class="tdlm-empty">Aucun poste.</div>';
  var accroches=blocAccroches(m,vu);

  var bilan="";
  if(m.resume||m.consequences||m.statut==="en_validation"||m.statut==="close"){
    bilan='<div class="tdlm-sec"><p class="tdlm-hsec">Résumé</p><div class="tdlm-prose">'+(m.resume?esc(m.resume):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Conséquences</p><div class="tdlm-prose">'+(m.consequences?esc(m.consequences):'<span class="tdlm-todo">—</span>')+'</div></div>';
  }
  var sujetLine=m.sujet?'<div class="tdlm-m"><span class="tdlm-k">Sujet RP</span><span class="tdlm-v"><a class="tdlm-lien" href="'+escAttr(m.sujet)+'" target="_blank" rel="noopener">Ouvrir le sujet →</a></span></div>':'';

  return ''
    +'<button class="tdlm-dret" data-back>← Retour à la liste</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">'+esc(m.titre)+'</span>'+F.stamp(m)+'</div>'
    +'<div class="tdlm-dp-body">'
      +'<div class="tdlm-dp-hd"><div class="tdlm-dp-meta">'
        +'<div class="tdlm-m"><span class="tdlm-k">Au nom de</span><span class="tdlm-v">'+esc(m.navire)+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Sortie</span><span class="tdlm-v">'+esc(SORTIES[m.sortie].label)+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Où</span><span class="tdlm-v">'+esc(m.lieu||"—")+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Quand</span><span class="tdlm-v">'+esc(m.quand||"—")+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Postes</span><span class="tdlm-v">'+pourvus(m)+' / '+vt(m.postes).length+'</span></div>'
        +sujetLine
      +'</div>'+banner+'</div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Le contexte</p><div class="tdlm-prose">'+(m.contexte?esc(m.contexte):'<span class="tdlm-todo">—</span>')+'</div>'
      +'<div class="tdlm-prose tdlm-todo">'+esc(SORTIES[m.sortie].desc)+'</div></div>'
      +accroches
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Les postes</p></div>'
      +cartes+bilan+drawer(m)
    +'</div>'
    +actionbar(m);
}

/* ---- accroches ---- */
function blocAccroches(m,vu){
  var acc=vt(m.accroches);
  if(!acc.length)return "";
  var maitre=(vu.createur||vu.staff);
  var ouvertes=acc.filter(function(a){return a.ouverte;});
  if(!maitre&&!ouvertes.length)return "";

  var corps=acc.map(function(a,i){
    if(a.ouverte){
      return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd">'
        +'<span class="tdlm-hsec" style="margin:0">Découvert</span>'
        +(a.par?'<span class="tdlm-r">'+esc(a.par)+'</span>':'')
        +(a.date?'<span class="tdlm-todo">'+esc(ilya(a.date))+'</span>':'')+'</div>'
        +'<div class="tdlm-prose">'+esc(a.fait)+'</div></div>';
    }
    if(!maitre)return "";
    return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd">'
      +'<span class="tdlm-hsec" style="margin:0">Fermée</span>'
      +'<button class="tdlm-abtn" data-acc="'+i+'">Ouvrir à quelqu\u2019un</button></div>'
      +'<div class="tdlm-prose">'+esc(a.fait)+'</div>'
      +'<div class="tdlm-prose tdlm-todo"><b>Condition :</b> '+esc(a.condition||"—")+'</div></div>';
  }).join("");

  var titre=maitre?"Les indices à découvrir":"Les indices obtenus";
  var note=maitre
    ? "Faites apparaitre une accroche quand un joueur remplit sa condition dans le rp. Elle devient publique, à son nom."
    : "Ce que quelqu\u2019un a trouvé pendant la sortie. Tout le monde peut s\u2019en servir désormais.";
  return '<div class="tdlm-sec"><p class="tdlm-hsec">'+esc(titre)+'</p>'
    +'<div class="tdlm-prose tdlm-todo">'+esc(note)+'</div></div>'+corps;
}

/* ---- barre d'action (rôles cumulés) ---- */
function actionbar(m){
  var me=F.myPseudo(), staff=F.isStaff(), createur=(me&&me===m.createur);
  var roles=[], btns="";

  if(createur&&m.statut!=="close"&&m.statut!=="refusee"){
    roles.push("À la manœuvre");
    if(m.statut==="en_attente")btns+='<button class="tdlm-abtn prim" data-act="partir">La marée part</button>';
    btns+='<button class="tdlm-abtn" data-act="sujet">'+(m.sujet?"Modifier le sujet RP":"Renseigner le sujet RP")+'</button>';
    if(m.statut!=="en_attente")btns+='<button class="tdlm-abtn prim" data-act="bilan">'+(m.statut==="en_validation"?"Modifier le bilan":"Bilan &amp; demander la clôture")+'</button>';
  }
  if(staff){
    roles.push("Staff");
    if(m.statut==="en_validation")btns+='<button class="tdlm-abtn prim" data-act="valider">Clore &amp; payer les postes</button>';
    if(m.statut!=="close"&&m.statut!=="refusee")btns+='<button class="tdlm-abtn warn" data-act="annuler">Annuler la marée</button>';
    btns+='<button class="tdlm-abtn warn" data-act="delete">Supprimer</button>';
  }
  if(!btns){
    if(!F.estConnecte()){roles.push("Invité");btns='<span class="tdlm-idle">'+T.CONNECT+'</span>';}
    else if(!P.peutTenir(m,me)){roles.push("Sur le pont");btns='<span class="tdlm-idle">Vous tenez un poste sur cette marée.</span>';}
    else {roles.push("Visiteur");btns='<span class="tdlm-idle">Prenez un poste ci-dessus : c\u2019est ouvert à tout le monde.</span>';}
  }
  if(!roles.length)roles.push("Visiteur");
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles.join(" \u27e1 ")+'</span>'+btns+'</div>';
}

/* ---- tiroirs ---- */
function drawer(m){
  if(S.drawer==="bilan"){
    return '<div class="tdlm-drawer on"><h4>Bilan de la marée</h4>'
      +'<label class="tdlm-fl">Résumé</label><textarea id="tdlh-bresume">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Conséquences</label><textarea id="tdlh-bconseq">'+esc(m.consequences)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="bilanok">'+(m.statut==="en_validation"?"Enregistrer":"Demander la clôture")+'</button>'
      +(m.statut!=="en_validation"?'<button class="tdlm-abtn" data-do="bilansave">Enregistrer sans envoyer</button>':'')
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline==="sujet"){
    return '<div class="tdlm-drawer on"><h4>Sujet RP de la marée</h4>'
      +'<input type="text" id="tdlh-sujet" value="'+escAttr(m.sujet)+'" placeholder="https://thedrownedlands.forumactif.com/t...">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="sujetok">Enregistrer</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline&&S.inline.indexOf("acc:")===0){
    var ia=+S.inline.split(":")[1], a=vt(m.accroches)[ia];
    if(a){
      var tenants=vt(m.postes).filter(function(p){return p.qui&&p.etat!=="abandonne";})
        .map(function(p){return '<option value="'+escAttr(p.qui)+'">'+esc(p.qui)+' \u2014 '+esc(P.POSTES[p.type].label)+'</option>';}).join("");
      return '<div class="tdlm-drawer on"><h4>Ouvrir une accroche</h4>'
        +'<div class="tdlm-prose">'+esc(a.fait)+'</div>'
        +'<div class="tdlm-prose tdlm-todo"><b>Condition :</b> '+esc(a.condition||"—")+'</div>'
        +'<label class="tdlm-fl">Qui l\u2019a obtenue</label><select id="tdlh-accqui">'+tenants+'</select>'
        +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="accok:'+ia+'">Rendre publique</button>'
        +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
    }
  }
  if(S.inline&&S.inline.indexOf("poste:")===0){
    var i=+S.inline.split(":")[1], p=vt(m.postes)[i];
    if(p)return P.tiroirCloture(m,p,i);
  }
  return "";
}

/* ===================== ACTIONS ===================== */
function act(k,m){
  if(k==="sujet"){S.inline="sujet";S.drawer=null;F.renderStage();return;}
  if(k==="bilan"){S.drawer="bilan";S.inline=null;F.renderStage();return;}

  if(k==="partir"){
    if(!vt(m.postes).some(function(p){return p.etat==="pris";})){toast("Personne à bord ni à terre : attends au moins un poste pourvu.");return;}
    m.statut="en_cours";patch(m,{statut:"en_cours"});
    toast("La marée part. Les postes vacants restent affichés en creux.");F.renderAll();return;
  }
  if(k==="valider"){clore(m);return;}
  if(k==="annuler"){
    if(!window.confirm("Annuler cette marée ?\nAucun argent n\u2019a été retenu : personne n\u2019est remboursé, personne n\u2019est payé."))return;
    m.statut="refusee";patch(m,{statut:"refusee"});toast("Marée annulée.");F.renderAll();return;
  }
  if(k==="delete"){
    if(!window.confirm("Supprimer définitivement « "+m.titre+" » ?"))return;
    F.supprimer(m);toast("Marée supprimée.");F.renderAll();return;
  }
}

function doo(k,m){
  if(k==="cancel"){S.drawer=null;S.inline=null;F.renderStage();return;}
  if(k&&k.indexOf("posteok:")===0){P.cloturerPoste(m,+k.split(":")[1]);return;}
  if(k&&k.indexOf("accok:")===0){ouvrirAccroche(m,+k.split(":")[1]);return;}
  if(k==="sujetok"){
    var el=$("#tdlh-sujet"), url=el?String(el.value||"").trim():"";
    m.sujet=url;patch(m,{sujet:url});S.inline=null;toast("Sujet enregistré.");F.renderStage();return;
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
}

function ouvrirAccroche(m,i){
  var acc=vt(m.accroches), a=acc[i]; if(!a)return;
  var sel=$("#tdlh-accqui"), qui=sel?sel.value:"";
  if(!qui){toast("Dis qui l\u2019a obtenue.");return;}
  a.ouverte=true; a.par=qui; a.date=new Date().toISOString();
  m.accroches=acc; patch(m,{accroches:acc});
  S.inline=null;
  try{if(window.EcoNotif)EcoNotif.a(qui,100,{nom:m.titre},"acc"+m.id+a.k);}catch(e){}
  toast("Accroche ouverte. Tout le monde la voit maintenant.");
  F.renderAll();
}

function brancher(stage){
  stage.querySelectorAll("[data-acc]").forEach(function(el){
    el.onclick=function(){S.inline="acc:"+el.getAttribute("data-acc");S.drawer=null;F.renderStage();};
  });
  stage.querySelectorAll("[data-poste]").forEach(function(el){
    el.onclick=function(){
      var m=F.parId(S.sel); if(!m)return;
      var b=el.getAttribute("data-poste").split(":"), i=+b[1];
      if(b[0]==="prendre")P.prendre(m,i);
      else if(b[0]==="abandon")P.abandonner(m,i);
      else if(b[0]==="cloturer"){S.inline="poste:"+i;S.drawer=null;F.renderStage();}
    };
  });
  stage.querySelectorAll("[data-note]").forEach(function(el){
    el.onchange=function(){
      var m=F.parId(S.sel); if(!m||!el.value)return;
      P.noterPoste(m,+el.getAttribute("data-note"),el.value);
      toast("Poste noté.");F.renderStage();
    };
  });
}

/* ===================== CLÔTURE ===================== */
function clore(m){
  if(m.primeVersee){toast("Marée déjà réglée.");return;}
  var postes=vt(m.postes), aNoter=0;
  postes.forEach(function(p){
    if(p.etat!=="pris"||!P.POSTES[p.type].rapporte)return;   /* diversion et écueil : part due, pas de note */
    if(!p.note){p.note="non_transmise";aNoter++;}
  });
  if(!window.confirm("Clore la marée et régler les postes ?"
      +(aNoter?"\n"+aNoter+" poste(s) sans note seront réglés comme non transmis.":"")))return;
  m.postes=postes;
  P.payerMaree(m).then(function(total){
    m.primeVersee=true;m.statut="close";m.demandeValidation=false;
    patch(m,{primeVersee:true,createurPaye:true,statut:"close",demandeValidation:false,postes:m.postes});
    postes.forEach(function(p){
      if(!p.qui||p.etat!=="pris")return;
      try{if(window.EcoNotif)EcoNotif.a(p.qui,100,{nom:m.titre},"vma"+m.id+p.k);}catch(e){}
    });
    toast("Marée close. "+money(total)+" distribués.");F.renderAll();
  }).catch(function(){toast("Règlement interrompu \u2014 vérifie avant de recommencer.");});
}

/* ===================== OUVERTURE ===================== */
function peutOuvrir(){
  var me=F.myPseudo();
  return F.isStaff()||(F.estFlottille(me)&&!!F.navireDe(me));
}
function champPoste(i){
  var ts='<option value="">— aucun —</option>'+Object.keys(P.POSTES).map(function(k){
    return '<option value="'+k+'">'+esc(P.POSTES[k].label)+' ('+P.POSTES[k].montant+' $)</option>';}).join("");
  return '<div class="tdlm-cadre">'
    +'<div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Poste '+(i+1)+'</span>'
    +'<span class="tdlm-todo" id="tdlh-nh'+i+'">facultatif</span></div>'
    +'<label class="tdlm-fl">Nature</label><select id="tdlh-nt'+i+'">'+ts+'</select>'
    +'<label class="tdlm-fl">Intitulé</label><input type="text" id="tdlh-ni'+i+'" placeholder="Tenir le quai nord, bloquer le chenal…">'
    +'<label class="tdlm-fl">Heure (HH:MM, pour l\u2019ordre du sujet)</label>'
    +'<input type="text" id="tdlh-nhr'+i+'" placeholder="02:30">'
    +'<label class="tdlm-fl">Consigne visible de tous</label>'
    +'<input type="text" id="tdlh-nc'+i+'" placeholder="Ce qu\u2019on demande, sans dire pourquoi…">'
    /* le scellé est hors grille : un simple "" suffit à le réafficher */
    +'<div id="tdlh-nsw'+i+'" style="display:none">'
    +'<label class="tdlm-fl">Scellé \u2014 action qui se produit sous ses yeux</label>'
    +'<textarea id="tdlh-ns'+i+'" placeholder="Un pick-up remonte le chemin sans phares à 2h40…"></textarea>'
    +'<div class="tdlm-prose tdlm-todo">Écrivez un fait, pas une conclusion : ce qui se produit, jamais ce que le personnage en déduit. Il reçoit la perception, il garde l\u2019interprétation.</div>'
    +'</div></div>';
}

/* mémos du formulaire : natures de sortie, puis postes */
function memo(titre,map,pied){
  return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">'+esc(titre)+'</span></div>'
    + Object.keys(map).map(function(k){
        var d=map[k], suf=(d.montant!=null)?(' <span class="tdlm-r">'+d.montant+' $</span> <span class="tdlm-todo">'+esc(d.legal)+'</span>'):'';
        return '<div class="tdlm-sec" style="margin:0 0 10px"><p class="tdlm-hsec" style="margin:0">'+esc(d.label)+suf+'</p>'
          +'<div class="tdlm-prose">'+esc(d.desc)+'</div></div>';
      }).join("")
    +(pied?'<div class="tdlm-prose tdlm-todo">'+esc(pied)+'</div>':'')+'</div>';
}
function memoSorties(){
  return memo("La nature des sorties",SORTIES,
    "Toutes doivent amener au moins une personne qui n\u2019est pas payée pour être là. C\u2019est ce qui sépare une marée d\u2019un RP entre capitaines.");
}

function memoPostes(){
  return memo("Les quatre postes",P.POSTES,
    "« À bord » est réservé à la Flottille. Les trois autres sont ouverts à tout le monde.");
}

function champAccroche(i){
  return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Accroche '+(i+1)+'</span>'
    +'<span class="tdlm-todo">facultative</span></div>'
    +'<label class="tdlm-fl">Un indice à découvrir</label>'
    +'<textarea id="tdlh-af'+i+'" placeholder="La coque a été repeinte, et un nom transparaît sous le bleu-noir…"></textarea>'
    +'<label class="tdlm-fl">Que faire pour l\u2019obtenir ?</label>'
    +'<input type="text" id="tdlh-ac'+i+'" placeholder="Approcher du bateau de face, à quelques mètres, avec une lumière…">'
    +'</div>';
}

function formOuverture(){
  var me=F.myPseudo();
  var ss=Object.keys(SORTIES).map(function(k){return '<option value="'+k+'">'+esc(SORTIES[k].label)+'</option>';}).join("");
  var accs="";
  for(var j=0;j<MAX_ACCROCHES;j+=2){
    accs+='<div class="tdlm-duo">'+champAccroche(j)
      +(j+1<MAX_ACCROCHES?champAccroche(j+1):'<div></div>')+'</div>';
  }
  var cartes="";
  for(var i=0;i<MAX_POSTES;i+=2){
    cartes+='<div class="tdlm-duo">'+champPoste(i)
      +(i+1<MAX_POSTES?champPoste(i+1):'<div></div>')+'</div>';
  }
  return '<div class="tdlm-dpanel">'
    +'<button class="tdlm-dret" data-neuf="cancel">← Retour au registre</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">Ouvrir une marée</span></div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-drawer on" style="border-top:none">'
      +memoSorties()
      +'<label class="tdlm-fl">Titre</label><input type="text" id="tdlh-ntitre" placeholder="Ex. : Relever quelqu\u2019un au ponton Dumas">'
      +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Nature de la sortie</label><select id="tdlh-nsortie">'+ss+'</select></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Au nom de</label><input type="text" id="tdlh-nnavire" value="'+escAttr(F.navireDe(me)||"Le hangar")+'"></div></div>'
      +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Où</label><input type="text" id="tdlh-nlieu" placeholder="Chenal, ponton, bras de bayou…"></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Quand</label><input type="text" id="tdlh-nquand" placeholder="Une nuit de mars, à la marée basse…"></div></div>'
      +'<label class="tdlm-fl">Le contexte et informations connues (visible de tous)</label><textarea id="tdlh-nctx"></textarea>'
      +memoPostes()
      +cartes
      +'<div class="tdlm-prose">Les accroches ne sont attachées à aucun poste. Elles sont invisibles de tous sauf de vous et du staff, et vous les ouvrez en cours de RP quand quelqu\u2019un remplit la condition de découverte, dans le sujet rp.</div>'
      +accs
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-neuf="ok">Afficher la marée</button>'
      +'<button class="tdlm-abtn" data-neuf="cancel">Annuler</button></div>'
    +'</div></div></div>';
}

function creer(){
  var g=function(id){var e=$(id);return e?String(e.value||"").trim():"";};
  var titre=g("#tdlh-ntitre");
  if(!titre){toast("Donne un titre à la marée.");return;}
  var postes=[];
  for(var i=0;i<MAX_POSTES;i++){
    var t=g("#tdlh-nt"+i); if(!P.POSTES[t])continue;
    postes.push(P.normPoste({k:"p"+i+Date.now().toString(36).slice(-3), type:t,
      titre:g("#tdlh-ni"+i)||P.POSTES[t].label, heure:g("#tdlh-nhr"+i),
      consigne:g("#tdlh-nc"+i), scelle:g("#tdlh-ns"+i)},i));
  }
  if(postes.length<MIN_POSTES){toast("Il faut au moins "+MIN_POSTES+" postes.");return;}
  /* le capitaine qui monte la sortie embarque, sinon il ouvre une marée à
     laquelle il ne peut pas participer. Le staff, lui, reste dehors. */
  var moi=$("#tdlh-nmoi"), me2=F.myPseudo();
  if(moi&&moi.checked&&F.estFlottille(me2)){
    for(var b=0;b<postes.length;b++){
      if(postes[b].type!=="bord")continue;
      postes[b].qui=me2; postes[b].etat="pris"; postes[b].de=1+Math.floor(Math.random()*4);
      postes[b].pris=new Date().toISOString(); break;
    }
  }
  if(!postes.some(function(p){return p.type!=="bord";})){toast(T.ADMISSION);return;}

  var accroches=[];
  for(var j=0;j<MAX_ACCROCHES;j++){
    var fait=g("#tdlh-af"+j); if(!fait)continue;
    accroches.push({k:"a"+j+Date.now().toString(36).slice(-3), fait:fait,
      condition:g("#tdlh-ac"+j), ouverte:false, par:"", date:""});
  }

  var o={ titre:titre, createur:F.myPseudo(), accroches:accroches, navire:g("#tdlh-nnavire")||"Le hangar",
          sortie:g("#tdlh-nsortie")||"extraction", lieu:g("#tdlh-nlieu"), quand:g("#tdlh-nquand"),
          contexte:g("#tdlh-nctx"), postes:postes, statut:"en_attente",
          sujet:"", resume:"", consequences:"", demandeValidation:false,
          createurPaye:false, primeVersee:false, cree:new Date().toISOString() };
  var id=F.newId("ma");
  try{
    var pr=window.EcoCore.writeField(F.CFG.RACINE+"/"+SOUS+"/"+id,o);
    Promise.resolve(pr).then(function(){
      S.statut="tous";S.sel=id;toast(T.OUVERT);
      try{if(window.EcoNotif)EcoNotif.bande("flottille",110,{titre:titre},"ma"+id);}catch(e){}
      F.renderAll();
    }).catch(function(){toast("Ouverture échouée.");});
  }catch(e){toast("Ouverture échouée.");}
}

F.vue({
  k:"nouvelle", label:"⚓ Ouvrir une marée",
  visible:peutOuvrir, compte:function(){return null;},
  render:formOuverture,
  brancher:function(stage){
    stage.querySelectorAll("[data-neuf]").forEach(function(el){
      el.onclick=function(){
        if(el.getAttribute("data-neuf")==="ok")creer();
        else {S.statut="tous";F.renderAll();}
      };
    });
    /* la diversion n'a pas de scellé : on ne voit rien quand on ne sait pas
       pourquoi on est là. Les trois autres postes perçoivent quelque chose. */
    for(var i=0;i<MAX_POSTES;i++)(function(i){
      var sel=stage.querySelector("#tdlh-nt"+i),
          wrap=stage.querySelector("#tdlh-nsw"+i),
          aide=stage.querySelector("#tdlh-nh"+i);
      if(!sel)return;
      sel.onchange=function(){
        var d=P.POSTES[sel.value];
        if(wrap)wrap.style.display=(d&&d.scelle)?"":"none";
        if(aide)aide.textContent=d?(d.montant+" $ \u27e1 "+d.legal):"facultatif";
      };
      sel.onchange();
    })(i);
  }
});

/* ===================== DÉCLARATION ===================== */
F.type({
  k:"marees", sous:SOUS, label:"Marée", ic:"fi-tr-ship",
  normaliser:normaliser, sub:sub, tags:tags, panel:panel,
  act:act, doo:doo, brancher:brancher
});

})(window.TDLFlot, window.TDLPostes);
