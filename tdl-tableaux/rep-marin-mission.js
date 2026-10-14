/* THE DROWNED LANDS — MISSIONS MARINGOUINS · TYPE « MISSION DE CELLULE »
   (rep-mis-mission.js) — à charger APRÈS rep-mis-core.js.

   [MAJ v4] Contenu repris de rep-mis-marin v3-2 SANS CHANGEMENT DE RÈGLE : même
     cycle, même argent, mêmes verrous, mêmes libellés. Seule la plomberie
     change — le fichier se déclare comme un type auprès du socle au lieu de
     porter lui-même la liste et le montage.

   Une mission naît dans la BOUTIQUE (barge-maringouins, « mission de
   cellule ») : un commanditaire fixe l'objectif et la prime, qui est retenue
   dès l'ouverture. Ce fichier gère tout ce qui suit.

   CYCLE   en_attente → acceptee → en_validation → terminee, ou refusee.
   CHEF    le premier Maringouin qui s'inscrit, pas le commanditaire.
   ARGENT  prime débitée du payeur à la création ; 7 j sans chef → refus auto et
           recrédit ; négociation → ajustement du delta ; validation staff →
           prime en parts égales aux validés + 50 $ de bonus au chef.
   ACCÈS   inscription réservée aux Maringouins, consultation ouverte à tous. */
(function(F){
"use strict";
if(!F){ if(window.console) console.warn("[rep-mis-mission] socle absent."); return; }
var esc=F.esc, escAttr=F.escAttr, money=F.money, ilya=F.ilya, av=F.av, $=F.$;
var S=F.S, patch=F.patch, ecr=F.ecr, toast=F.toast, STATUTS=F.STATUTS, TYPES=F.TYPES;
var CHEF_BONUS=F.CHEF_BONUS, DELAI_REFUS=F.DELAI_REFUS;

var MANDANT = {joueur:"", entreprise:"entreprise", famille:"famille", pnj:"PNJ", anonyme:"anonyme"};

/* ===================== NORMALISATION ===================== */
function normaliser(o){
  o.mandataire=o.mandataire||"\u2014"; o.mandataireType=o.mandataireType||"joueur";
  o.payeur=o.payeur||null;
  o.prime=+o.prime||0;
  o.primeInitiale=(o.primeInitiale!=null)?(+o.primeInitiale):o.prime;
  o.nego=(o.nego&&o.nego.montant!=null)?o.nego:null;
  o.rembourse=!!o.rembourse;
  return o;
}
function sub(m){ return { sub:esc(m.mandataire)+" \u00b7 "+money(m.prime), qui:m.chef }; }
function tags(){ return []; }

/* ===================== PANNEAU ===================== */
function panel(m){
  var me=F.myPseudo(), staff=F.isStaff();
  var mandLabel=esc(m.mandataire)+(MANDANT[m.mandataireType]?' <span class="tdlm-todo">('+MANDANT[m.mandataireType]+')</span>':'');
  var primeLabel=money(m.prime)+(m.prime!==m.primeInitiale?' <span class="tdlm-todo">(négociée, init. '+money(m.primeInitiale)+')</span>':'');

  var banner="";
  if(staff&&m.demandeValidation){
    banner='<div class="tdlm-reqbanner"><p class="tdlm-hsec">\u2691 Le chef demande la validation</p>'
      +'<div class="tdlm-reqrow"><span>Coche les participants réellement impliqués, puis valide pour verser la prime.</span></div></div>';
  }

  var negoBox="";
  if(m.nego){
    var estPayeur=(me&&me===m.payeur);
    negoBox='<div class="tdlm-negobox"><p class="tdlm-hsec">Négociation de prime</p>'
      +'<div class="tdlm-negorow"><span>Le chef propose <b>'+money(m.nego.montant)+'</b> (actuelle : '+money(m.prime)+').</span>'
      +(estPayeur?'<span class="tdlm-negoact"><button class="tdlm-abtn prim" data-act="negoyes">Accepter</button><button class="tdlm-abtn warn" data-act="negono">Refuser</button></span>':'')
      +'</div></div>';
  }

  var editVal=(staff&&m.statut==="en_validation");
  var pList=m.participants.length?m.participants.map(function(p){
    var chk=editVal?'<label class="tdlm-chk"><input type="checkbox" data-val="'+escAttr(p)+'" '+(m.valides.indexOf(p)>=0?'checked':'')+'> validé</label>':'';
    var chefLbl=(p===m.chef)?'<span class="tdlm-r">chef de mission</span>':'';
    return '<div class="tdlm-person'+(p===m.chef?' chef':'')+'">'+av(p)+'<span class="tdlm-pname">'+esc(p)+'</span>'+chefLbl+chk+'</div>';
  }).join(""):'<p class="tdlm-todo" style="margin:0">Aucun Maringouin inscrit pour l\'instant.</p>';
  var peutRejoindre=(F.estMaringouin(me)&&m.participants.indexOf(me)<0&&(m.statut==="en_attente"||m.statut==="acceptee"));
  var joinBtn=peutRejoindre?'<button class="tdlm-abtn prim" data-act="join">Je participe</button>':'';
  var cadre='<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Participants</span>'+joinBtn+'</div>'+pList+'</div>';

  var bilan="";
  if(m.resume||m.consequences||m.statut==="en_validation"||m.statut==="terminee"){
    bilan='<div class="tdlm-sec"><p class="tdlm-hsec">Résumé</p><div class="tdlm-prose">'+(m.resume?esc(m.resume):'<span class="tdlm-todo">\u2014</span>')+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Conséquences</p><div class="tdlm-prose">'+(m.consequences?esc(m.consequences):'<span class="tdlm-todo">\u2014</span>')+'</div></div>';
  }
  var topicLine=m.topic?'<div class="tdlm-m"><span class="tdlm-k">Sujet RP</span><span class="tdlm-v"><a class="tdlm-lien" href="'+escAttr(m.topic)+'" target="_blank" rel="noopener">Ouvrir le sujet \u2192</a></span></div>':'';
  var contraintes=m.contraintes.length
    ? '<ul class="tdlm-clean">'+m.contraintes.map(function(c){return '<li class="tdlm-puce">'+esc(c)+'</li>';}).join("")+'</ul>'
    : '<span class="tdlm-todo">\u2014</span>';

  return ''
    +'<button class="tdlm-dret" data-back>\u2190 Retour à la liste</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">'+esc(m.titre)+'</span>'+F.stamp(m)+'</div>'
    +'<div class="tdlm-dp-body">'
      +'<div class="tdlm-dp-hd"><div class="tdlm-dp-meta">'
        +'<div class="tdlm-m"><span class="tdlm-k">Commanditaire</span><span class="tdlm-v">'+mandLabel+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Type de mission</span><span class="tdlm-v"><i class="fi '+F.typeIcon(m.type)+'"></i> '+F.typeLabel(m.type)+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Prime proposée</span><span class="tdlm-v"><b>'+primeLabel+'</b></span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Chef de mission</span><span class="tdlm-v">'+(m.chef?esc(m.chef):'<span class="tdlm-todo">à pourvoir</span>')+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Publiée</span><span class="tdlm-v">'+ilya(m.cree)+'</span></div>'
        +topicLine
      +'</div>'+banner+'</div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Objectif</p><div class="tdlm-prose">'+(m.objectif?esc(m.objectif):'<span class="tdlm-todo">\u2014</span>')+'</div></div>'
      +'<div class="tdlm-duo">'
        +'<div class="tdlm-sec"><p class="tdlm-hsec">Contraintes</p>'+contraintes+'</div>'
        +'<div class="tdlm-sec"><p class="tdlm-hsec">Contexte</p><div class="tdlm-prose">'+(m.contexte?esc(m.contexte):'<span class="tdlm-todo">\u2014</span>')+'</div></div>'
      +'</div>'
      +negoBox+cadre+bilan+drawer(m)
    +'</div>'
    +actionbar(m);
}

/* Les rôles se CUMULENT : un chef de mission qui est aussi administrateur doit
   garder ses boutons de chef, sinon celui qui joue un personnage et tient le
   staff ne peut jamais rien conclure. */
function actionbar(m){
  var me=F.myPseudo(), staff=F.isStaff(), payeur=(me&&me===m.payeur), chef=(me&&me===m.chef);
  var roles=[], btns="";
  if(chef&&(m.statut==="acceptee"||m.statut==="en_validation")){
    roles.push("Chef de mission");
    btns+='<button class="tdlm-abtn" data-act="topic">'+(m.topic?"Modifier le sujet RP":"Renseigner le sujet RP")+'</button>';
    if(m.statut==="acceptee"&&!m.topic)btns+='<button class="tdlm-abtn" data-act="nego">Négocier la prime</button>';
    btns+='<button class="tdlm-abtn prim" data-act="bilan">'+(m.statut==="en_validation"?"Modifier le bilan":"Bilan &amp; passer en validation")+'</button>';
  }
  if(payeur&&m.statut==="en_attente"){
    roles.push("Commanditaire");
    btns+='<button class="tdlm-abtn warn" data-act="retirer">Retirer ma mission</button>';
  }
  if(staff){
    roles.push("Staff");
    if(m.statut==="en_validation")btns+='<button class="tdlm-abtn prim" data-act="valider">Valider &amp; verser la prime</button>';
    btns+='<button class="tdlm-abtn" data-act="edit">Modifier les termes</button>';
    if(m.statut!=="terminee"&&m.statut!=="refusee")btns+='<button class="tdlm-abtn warn" data-act="refuser">Refuser &amp; rembourser</button>';
    btns+='<button class="tdlm-abtn warn" data-act="delete">Supprimer</button>';
  }
  if(!btns){
    if(payeur){roles.push("Commanditaire");btns='<span class="tdlm-idle">En attente du chef de mission.</span>';}
    else if(!F.estConnecte()){roles.push("Invité");btns='<span class="tdlm-idle">Connectez-vous pour interagir.</span>';}
    else if(F.estMaringouin(me)){roles.push("Maringouin");btns='<span class="tdlm-idle">Utilisez \u00ab Je participe \u00bb ci-dessus.</span>';}
    else {roles.push("Visiteur");btns='<span class="tdlm-idle">Table consultable \u2014 inscription réservée aux Maringouins.</span>';}
  }
  if(!roles.length)roles.push("Visiteur");
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles.join(" \u00b7 ")+'</span>'+btns+'</div>';
}

/* ---- drawers / formulaires ---- */
function drawer(m){
  if(S.drawer==="edit"){
    var opts=TYPES.map(function(t){return '<option value="'+t.id+'"'+(t.id===m.type?' selected':'')+'>'+t.label+'</option>';}).join("");
    var mand=Object.keys(MANDANT).map(function(k){return '<option value="'+k+'"'+(k===m.mandataireType?' selected':'')+'>'+(k==="joueur"?"joueur":MANDANT[k])+'</option>';}).join("");
    return '<div class="tdlm-drawer on"><h4>Modifier les termes (staff)</h4>'
      +'<label class="tdlm-fl">Titre</label><input type="text" id="tdlm-etitre" value="'+escAttr(m.titre)+'">'
      +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Type</label><select id="tdlm-etype">'+opts+'</select></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Prime ($)</label><input type="text" id="tdlm-eprime" value="'+escAttr(m.prime)+'"></div></div>'
      +'<div class="tdlm-row"><div style="flex:2"><label class="tdlm-fl">Commanditaire (libellé)</label><input type="text" id="tdlm-emand" value="'+escAttr(m.mandataire)+'"></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Au nom de</label><select id="tdlm-emandt">'+mand+'</select></div></div>'
      +'<label class="tdlm-fl">Objectif</label><textarea id="tdlm-eobj">'+esc(m.objectif)+'</textarea>'
      +'<label class="tdlm-fl">Contraintes (une par ligne)</label><textarea id="tdlm-econtr">'+esc(m.contraintes.join("\n"))+'</textarea>'
      +'<label class="tdlm-fl">Contexte</label><textarea id="tdlm-ectx">'+esc(m.contexte)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="editok">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="bilan"){
    return '<div class="tdlm-drawer on"><h4>Bilan de mission</h4>'
      +'<label class="tdlm-fl">Résumé</label><textarea id="tdlm-bresume">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Conséquences</label><textarea id="tdlm-bconseq">'+esc(m.consequences)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="bilanok">'+(m.statut==="en_validation"?"Enregistrer":"Envoyer en validation")+'</button>'
      +(m.statut!=="en_validation"?'<button class="tdlm-abtn" data-do="bilansave">Enregistrer sans envoyer</button>':'')
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline==="topic"){
    return '<div class="tdlm-drawer on"><h4>Sujet RP de la mission</h4>'
      +'<input type="text" id="tdlm-topic" value="'+escAttr(m.topic)+'" placeholder="https://thedrownedlands.forumactif.com/t...">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="topicok">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline==="nego"){
    return '<div class="tdlm-drawer on"><h4>Proposer une nouvelle prime</h4>'
      +'<input type="text" id="tdlm-negom" placeholder="Montant en $" value="'+escAttr(m.nego?m.nego.montant:"")+'">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="negook">Proposer au commanditaire</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

/* ===================== ACTIONS ===================== */
function act(k,m){
  if(!m)return;
  var me=F.myPseudo();
  if(k==="join"){
    if(!F.estMaringouin(me)){toast("Inscription réservée aux Maringouins.");return;}
    if(m.statut!=="en_attente"&&m.statut!=="acceptee"){toast("Mission fermée à l'inscription.");return;}
    if(m.participants.indexOf(me)>=0){toast("Déjà inscrit\u00b7e.");return;}
    if(!F.exigeV2(m))return;
    m.participants.push(me);
    /* on n'écrit QUE sa propre clé : deux inscriptions simultanées ne
       s'écrasent plus. */
    var champs={}; champs["participants/"+F.cp(me)]=me;
    if(!m.chef){m.chef=me;m.statut="acceptee";champs.chef=me;champs.statut="acceptee";}
    ecr(m,champs);
    toast(m.chef===me?"Inscrit\u00b7e \u2014 vous êtes chef de mission.":"Inscrit\u00b7e à la mission.");
    F.renderAll();
    try{ if(window.EcoNotif && m.payeur && m.chef===me) EcoNotif.a(m.payeur,111,{titre:m.titre,chef:me},"chef"+m.id); }catch(e){}
    return;
  }
  if(k==="topic"){S.inline=(S.inline==="topic")?null:"topic";S.drawer=null;F.renderStage();return;}
  if(k==="nego"){S.inline=(S.inline==="nego")?null:"nego";S.drawer=null;F.renderStage();return;}
  if(k==="bilan"){S.drawer=(S.drawer==="bilan")?null:"bilan";S.inline=null;F.renderStage();return;}
  if(k==="edit"){S.drawer=(S.drawer==="edit")?null:"edit";S.inline=null;F.renderStage();return;}
  if(k==="negoyes"){accepterNego(m);return;}
  if(k==="negono"){
    var nm=m.nego?m.nego.montant:0; m.nego=null; patch(m,{nego:null});
    try{ if(window.EcoNotif && m.chef) EcoNotif.a(m.chef,113,{titre:m.titre,ok:false},"negor"+m.id+"_"+nm); }catch(e){}
    toast("Proposition refusée."); F.renderStage(); return;
  }
  if(k==="retirer"){retirer(m);return;}
  if(k==="refuser"){refuserStaff(m);return;}
  if(k==="valider"){valider(m);return;}
  if(k==="delete"){supprimer(m);return;}
}

function doo(k,m){
  if(k==="cancel"){S.drawer=null;S.inline=null;F.renderStage();return;}
  if(k==="topicok"){
    var u=(($("#tdlm-topic")||{}).value||"").trim();
    m.topic=u; var champs={topic:u};
    if(u&&m.nego){m.nego=null;champs.nego=null;}
    patch(m,champs); S.inline=null;
    toast(u?"Sujet RP enregistré \u2014 la prime n'est plus négociable.":"Sujet RP retiré.");
    F.renderStage(); return;
  }
  if(k==="negook"){
    var v=parseInt((($("#tdlm-negom")||{}).value||"").replace(/[^\d]/g,""),10);
    if(!v||v<0){toast("Montant invalide.");return;}
    m.nego={montant:v,statut:"en_cours",par:F.myPseudo()||m.chef};
    patch(m,{nego:m.nego});
    try{ if(window.EcoNotif && m.payeur) EcoNotif.a(m.payeur,112,{titre:m.titre,montant:v},"nego"+m.id+"_"+v); }catch(e){}
    S.inline=null; toast("Proposition envoyée au commanditaire."); F.renderStage(); return;
  }
  if(k==="bilanok"||k==="bilansave"){
    m.resume=(($("#tdlm-bresume")||{}).value||"").trim();
    m.consequences=(($("#tdlm-bconseq")||{}).value||"").trim();
    var ch={resume:m.resume,consequences:m.consequences};
    if(k==="bilanok"&&m.statut!=="en_validation"){
      if(!m.resume){toast("Renseigne au moins le résumé.");return;}
      m.statut="en_validation";m.demandeValidation=true;
      ch.statut="en_validation";ch.demandeValidation=true;
    }
    patch(m,ch);
    try{ if(window.EcoNotif && ch.statut==="en_validation") EcoNotif.staff(114,{titre:m.titre},"val"+m.id); }catch(e){}
    S.drawer=null;
    toast((k==="bilanok"&&ch.statut==="en_validation")?"Mission envoyée en validation.":"Bilan enregistré.");
    F.renderAll(); return;
  }
  if(k==="editok"){
    m.titre=(($("#tdlm-etitre")||{}).value||"").trim()||m.titre;
    var rt=$("#tdlm-etype"); if(rt)m.type=rt.value;
    var pr=parseInt((($("#tdlm-eprime")||{}).value||"").replace(/[^\d]/g,""),10);
    m.prime=isNaN(pr)?m.prime:pr;
    m.mandataire=(($("#tdlm-emand")||{}).value||"").trim()||m.mandataire;
    var mt=$("#tdlm-emandt"); if(mt)m.mandataireType=mt.value;
    m.objectif=(($("#tdlm-eobj")||{}).value||"").trim();
    m.contraintes=(($("#tdlm-econtr")||{}).value||"").split("\n").map(function(x){return x.trim();}).filter(Boolean);
    m.contexte=(($("#tdlm-ectx")||{}).value||"").trim();
    patch(m,{titre:m.titre,type:m.type,prime:m.prime,mandataire:m.mandataire,
      mandataireType:m.mandataireType,objectif:m.objectif,contraintes:m.contraintes,contexte:m.contexte});
    S.drawer=null; toast("Termes enregistrés."); F.renderAll(); return;
  }
}

/* une case cochée n'écrit QUE sa propre clé */
function brancher(stage){
  stage.querySelectorAll("[data-val]").forEach(function(el){
    el.onchange=function(){
      var m=F.parId(S.sel), n=el.getAttribute("data-val");
      if(!m||!F.exigeV2(m)){el.checked=!el.checked;return;}
      if(el.checked){if(m.valides.indexOf(n)<0)m.valides.push(n);}
      else m.valides=m.valides.filter(function(x){return x!==n;});
      var ch={}; ch["valides/"+F.cp(n)]=el.checked?n:null; ecr(m,ch);
    };
  });
}

/* ===================== ARGENT ===================== */
/* La négociation n'a pas de drapeau à verrouiller : on efface donc nego AVANT
   d'ajuster l'argent. Un second clic ne trouve plus rien à accepter. Si
   l'ajustement échoue ensuite, la proposition est perdue et le chef doit la
   refaire — visible, contrairement à un double débit. */
var _negoEnVol={};
function accepterNego(m){
  if(!m.nego||_negoEnVol[m.id])return;
  var montant=m.nego.montant, delta=montant-m.prime;
  if(delta>0&&F.solde(m.payeur)<delta){toast("Fonds insuffisants pour couvrir la hausse de prime ("+money(delta)+" manquants).");return;}
  _negoEnVol[m.id]=true;
  var ancienne=m.prime;
  m.nego=null; m.prime=montant;
  patch(m,{prime:montant,nego:null});
  var op=(delta!==0)?F.crediter(m.payeur,-delta):Promise.resolve();
  op.then(function(){
    try{ if(window.EcoNotif && m.chef) EcoNotif.a(m.chef,113,{titre:m.titre,ok:true},"negor"+m.id+"_"+montant); }catch(e){}
    toast("Prime ajustée à "+money(montant)+".");
    return F.rafraichir();
  }).catch(function(e){
    /* le débit a été refusé : la prime affichée doit revenir en arrière, sinon
       le tableau promettrait un montant qui n'a pas été retenu. */
    m.prime=ancienne; patch(m,{prime:ancienne});
    toast((e&&e.message==="FONDS")
      ? "Fonds insuffisants au moment du prélèvement \u2014 prime inchangée, la proposition est annulée."
      : "Ajustement de la prime échoué \u2014 prime inchangée, la proposition est annulée.");
    F.renderAll();
  }).then(function(){ delete _negoEnVol[m.id]; });
}

function retirer(m){
  if(m.statut!=="en_attente"){toast("Retrait possible seulement tant qu'aucun chef n'est inscrit.");return;}
  if(m.rembourse){toast("Déjà remboursée.");return;}
  if(!window.confirm("Retirer la mission \u00ab "+m.titre+" \u00bb ? La prime ("+money(m.prime)+") vous sera recréditée."))return;
  rembourser(m,"Mission retirée, prime recréditée.");
}
function refuserStaff(m){
  if(!window.confirm("Refuser la mission \u00ab "+m.titre+" \u00bb et rembourser le commanditaire ?"))return;
  rembourser(m,"Mission refusée, commanditaire remboursé.");
}
function rembourser(m, msgOk){
  F.verrou(m,"rembourse").then(function(){
    m.rembourse=true;
    var credit=(m.payeur&&m.prime>0)?F.crediter(m.payeur,m.prime):Promise.resolve();
    return Promise.resolve(credit).then(function(){
      m.statut="refusee";m.demandeValidation=false;
      patch(m,{statut:"refusee",demandeValidation:false});
      toast(msgOk);
      return F.rafraichir();
    });
  }).catch(function(e){
    if(F.estDeja(e)){
      m.rembourse=true;m.statut="refusee";
      patch(m,{statut:"refusee",demandeValidation:false});
      toast("Déjà remboursée ailleurs \u2014 aucun second recrédit."); F.renderAll(); return;
    }
    toast("Remboursement échoué \u2014 mission inchangée.");
  });
}

function valider(m){
  if(m.primeVersee){toast("Prime déjà versée.");return;}
  var vals=m.valides.slice();
  if(!vals.length){toast("Coche au moins un participant.");return;}
  var n=vals.length, part=Math.floor(m.prime/n), reste=m.prime-part*n;
  if(!window.confirm("Valider \u00ab "+m.titre+" \u00bb ?\n"+n+" participant(s) : "+money(part)+" chacun"
    +(reste?(" (+"+money(reste)+" au chef)"):"")+" + "+money(CHEF_BONUS)+" bonus chef. Irréversible."))return;
  /* verrou AVANT tout crédit : deux validations simultanées ne versaient pas
     l'une après l'autre, elles versaient DEUX FOIS. */
  F.verrou(m,"primeVersee").then(function(){
    m.primeVersee=true;
    var chain=Promise.resolve();
    vals.forEach(function(p){chain=chain.then(function(){return F.crediter(p,part);});});
    if(m.chef&&vals.indexOf(m.chef)>=0){chain=chain.then(function(){return F.crediter(m.chef,reste+CHEF_BONUS);});}
    else if(reste){chain=chain.then(function(){return F.crediter(vals[0],reste);});}
    return chain.then(function(){
      m.statut="terminee";m.demandeValidation=false;
      patch(m,{statut:"terminee",demandeValidation:false});
      try{ if(window.EcoNotif) vals.forEach(function(p){
        var g=part+((m.chef&&p===m.chef)?(reste+CHEF_BONUS):0);
        EcoNotif.a(p,115,{titre:m.titre,montant:g},"prime"+m.id+"_"+p);
      }); }catch(e){}
      toast("Mission validée. "+n+" \u00d7 "+money(part)+(m.chef?(" + "+money(CHEF_BONUS)+" chef"):"")+" versés.");
      return F.rafraichir();
    });
  }).catch(function(e){
    if(F.estDeja(e)){m.primeVersee=true;toast("Prime déjà versée ailleurs \u2014 rien n\u2019a été versé une seconde fois.");F.renderAll();return;}
    toast("Versement incomplet \u2014 la mission reste marquée payée, vérifiez les soldes avant de reverser.");
    F.renderAll();
  });
}

function supprimer(m){
  if(!window.confirm("Supprimer définitivement la mission \u00ab "+m.titre+" \u00bb ?\nAucun remboursement automatique \u2014 utilisez \u00ab Refuser & rembourser \u00bb si nécessaire."))return;
  F.supprimer(m); toast("Mission supprimée."); F.renderAll();
}

/* ---- refus auto (7 j sans chef), évaluation paresseuse au chargement ----
   Même verrou que les chemins manuels : seul le client qui fait passer
   rembourse false→true verse ; les autres referment localement. */
function auto(list){
  var now=Date.now();
  list.forEach(function(m){
    if(m.genre!=="mission")return;
    if(m.statut!=="en_attente"||m.chef||m.rembourse)return;
    if(now-new Date(m.cree).getTime()<DELAI_REFUS)return;
    F.verrou(m,"rembourse").then(function(){
      m.rembourse=true;m.statut="refusee";
      var credit=(m.payeur&&m.prime>0)?F.crediter(m.payeur,m.prime):Promise.resolve();
      return Promise.resolve(credit).then(function(){
        try{ if(window.EcoNotif && m.payeur) EcoNotif.a(m.payeur,116,{titre:m.titre},"auto"+m.id); }catch(e){}
        patch(m,{statut:"refusee"}); F.renderAll();
      });
    }).catch(function(e){
      if(F.estDeja(e)){m.rembourse=true;m.statut="refusee";patch(m,{statut:"refusee"});F.renderAll();}
    });
  });
}

/* ===================== DÉCLARATION ===================== */
F.type({
  k:"mission", label:"Mission de cellule", ic:"fi-tr-briefcase",
  normaliser:normaliser, sub:sub, tags:tags, panel:panel,
  act:act, doo:doo, brancher:brancher, auto:auto
});

})(window.TDLMis);
