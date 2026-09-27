/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU HANGAR · TYPE « MARÉE »
   (rep-flot-marees.js) — à charger APRÈS rep-flot-core.js ET
   rep-flot-postes.js, dont il utilise le moteur.

   Une marée est une sortie de travail de la Flottille, ouverte par un membre
   qui a un navire, ou par le staff au nom d'un navire canon ou du hangar.
   Elle n'est pas achetée en boutique : personne ne la paie, le hangar règle
   les postes à la clôture.

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
  extraction:  {label:"Extraction",          desc:"Sortir quelqu\u2019un de là où on le tient."},
  depose:      {label:"Dépose en zone fermée",desc:"Amener quelqu\u2019un là où on ne l\u2019attend pas."},
  remise:      {label:"Remise en main propre",desc:"Un échange sur un terrain qui n\u2019est à personne."},
  recuperation:{label:"Récupération",         desc:"Aller chercher ce qui a coulé, été jeté ou oublié."},
  recherche:   {label:"Recherche sur l\u2019eau",desc:"Trouver quelqu\u2019un qui ne veut pas forcément l\u2019être."}
};
var MIN_POSTES=2, MAX_POSTES=5;

var T={
  NON_NAV:"Ouvrir une marée demande un navire : réservé à la Flottille.",
  ADMISSION:"Une marée doit ouvrir au moins un poste qui ne soit pas « à bord ». Sinon tout le monde à bord est payé pour être là, et il ne se passe rien.",
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
function sub(m){
  return { sub:SORTIES[m.sortie].label+(m.lieu?" \u00b7 "+m.lieu:""), qui:m.createur, quand:"ouverte "+ilya(m.cree) };
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

  var cartes=vt(m.postes).map(function(p,i){return P.carte(m,p,i,vu);}).join("")
    || '<div class="tdlm-empty">Aucun poste.</div>';

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
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Ce qu\u2019on sait</p><div class="tdlm-prose">'+(m.contexte?esc(m.contexte):'<span class="tdlm-todo">—</span>')+'</div>'
      +'<div class="tdlm-prose tdlm-todo">'+esc(SORTIES[m.sortie].desc)+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Les postes</p></div>'
      +cartes+bilan+drawer(m)
    +'</div>'
    +actionbar(m);
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
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles.join(" \u00b7 ")+'</span>'+btns+'</div>';
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

function brancher(stage){
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
  postes.forEach(function(p){ if(p.etat==="pris"&&!p.note){p.note="non_transmise";aNoter++;} });
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
  return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Poste '+(i+1)+'</span></div>'
    +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Nature</label><select id="tdlh-nt'+i+'">'+ts+'</select></div>'
    +'<div style="flex:2"><label class="tdlm-fl">Intitulé</label><input type="text" id="tdlh-ni'+i+'" placeholder="Tenir le quai nord, bloquer le chenal…"></div></div>'
    +'<label class="tdlm-fl">Consigne visible de tous</label><input type="text" id="tdlh-nc'+i+'" placeholder="Ce qu\u2019on demande, sans dire pourquoi…">'
    +'<label class="tdlm-fl">Scellé \u2014 ce qu\u2019il y a réellement à voir ou à trouver</label>'
    +'<textarea id="tdlh-ns'+i+'" placeholder="Révélé au titulaire seul, au moment où il prend le poste…"></textarea></div>';
}
function formOuverture(){
  var me=F.myPseudo();
  var ss=Object.keys(SORTIES).map(function(k){return '<option value="'+k+'">'+esc(SORTIES[k].label)+'</option>';}).join("");
  var rows=""; for(var i=0;i<MAX_POSTES;i++)rows+=champPoste(i);
  return '<div class="tdlm-dpanel">'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">Ouvrir une marée</span></div>'
    +'<div class="tdlm-dp-body">'
      +'<div class="tdlm-sec"><div class="tdlm-prose">'+esc(T.ADMISSION)+'</div></div>'
      +'<div class="tdlm-drawer on">'
      +'<label class="tdlm-fl">Titre</label><input type="text" id="tdlh-ntitre" placeholder="Ex. : Relever quelqu\u2019un au ponton Dumas">'
      +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Nature de la sortie</label><select id="tdlh-nsortie">'+ss+'</select></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Au nom de</label><input type="text" id="tdlh-nnavire" value="'+escAttr(F.navireDe(me)||"Le hangar")+'"></div></div>'
      +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Où</label><input type="text" id="tdlh-nlieu" placeholder="Chenal, ponton, bras de bayou…"></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Quand</label><input type="text" id="tdlh-nquand" placeholder="Une nuit de mars, à la marée basse…"></div></div>'
      +'<label class="tdlm-fl">Ce qu\u2019on sait \u2014 visible de tous</label><textarea id="tdlh-nctx"></textarea>'
      +'</div>'
      +rows
      +'<div class="tdlm-row" style="margin:0 24px 20px"><button class="tdlm-abtn prim" data-neuf="ok">Afficher la marée</button>'
      +'<button class="tdlm-abtn" data-neuf="cancel">Annuler</button></div>'
    +'</div></div>';
}
function creer(){
  var g=function(id){var e=$(id);return e?String(e.value||"").trim():"";};
  var titre=g("#tdlh-ntitre");
  if(!titre){toast("Donne un titre à la marée.");return;}
  var postes=[];
  for(var i=0;i<MAX_POSTES;i++){
    var t=g("#tdlh-nt"+i); if(!P.POSTES[t])continue;
    postes.push(P.normPoste({k:"p"+i+Date.now().toString(36).slice(-3), type:t,
      titre:g("#tdlh-ni"+i)||P.POSTES[t].label, consigne:g("#tdlh-nc"+i), scelle:g("#tdlh-ns"+i)},i));
  }
  if(postes.length<MIN_POSTES){toast("Il faut au moins "+MIN_POSTES+" postes.");return;}
  if(!postes.some(function(p){return p.type!=="bord";})){toast(T.ADMISSION);return;}

  var o={ titre:titre, createur:F.myPseudo(), navire:g("#tdlh-nnavire")||"Le hangar",
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
  }
});

/* ===================== DÉCLARATION ===================== */
F.type({
  k:"marees", sous:SOUS, label:"Marée", ic:"fi-tr-ship",
  normaliser:normaliser, sub:sub, tags:tags, panel:panel,
  act:act, doo:doo, brancher:brancher
});

})(window.TDLFlot, window.TDLPostes);
