/* THE DROWNED LANDS — MISSIONS MARINGOUINS · TYPE « COUP »
   (rep-mis-coup.js) — à charger APRÈS rep-mis-core.js.

   Un coup est une intervention que les Maringouins montent EUX-MÊMES, dans le
   tableau et non dans la boutique. Personne ne le commandite, donc personne ne
   retient de prime : la bande agit pour elle.

   LA RÈGLE QUI FAIT TOUT. Un coup doit ouvrir au jeu le camp d'en face : un
   rôle adverse au minimum, deux pour un coup d'envergure, jamais tenus par un
   Maringouin. C'est ce qui empêche un coup d'être un RP entre soi.

   LE CHEF. Le créateur l'est d'office, sauf s'il coche « je ne serai pas le
   chef » ; le rôle revient alors au premier Maringouin inscrit, et un créateur
   qui ne joue pas ne touche rien. Le chef peut à tout moment ajouter des rôles
   ou compléter les informations.

   L'INFILTRÉ. Même mécanique que l'antagoniste du Carrefour. Le volontariat
   vit dans missions_prv, jamais dans l'entrée : ni le chef ni les autres ne
   doivent savoir qui s'est proposé, ni même si le rôle a été attribué. Tirage
   UNE SEULE FOIS à la clôture, sous verrou transactionnel, par un client STAFF
   — le chef n'a pas le droit de lire les volontaires, et il est exclu du
   tirage : un chef infiltré contrôlerait tout.

   ARGENT : rien n'est retenu, tout est créé à la validation. 50 $ par joueur
   validé, rôles adverses et sympathisants compris puisqu'ils rendent le même
   service au jeu ; 75 $ au chef, 100 $ si le coup est d'envergure.

   Le formulaire d'ouverture vit dans rep-mis-coup-neuf, séparé pour la seule
   raison que les deux ensemble dépassaient les 500 lignes.

   CYCLE   en_attente (pas de chef, ou rôles adverses non pourvus) → acceptee
           → en_validation → terminee, ou refusee. Pas de refus auto : aucune
           prime à rendre, donc un coup sans preneur reste affiché jusqu'à ce
           que le staff le retire. */
(function(F){
"use strict";
if(!F){ if(window.console) console.warn("[rep-mis-coup] socle absent."); return; }
var esc=F.esc, escAttr=F.escAttr, money=F.money, ilya=F.ilya, av=F.av, $=F.$;
var S=F.S, patch=F.patch, ecr=F.ecr, toast=F.toast, TYPES=F.TYPES;

/* ===================== CONFIG ===================== */
var PART=50, CHEF=75, CHEF_ENV=100;
var MIN_ADV=1, MIN_ADV_ENV=2, MAX_ROLES=6;
/* [MAJ] codes de notification — 110 à 116 sont pris par les missions */
var N_OUVERT=117, N_ROLE=118, N_SECRET=119;

var CAMPS={
  adverse:     {label:"Camp adverse",  aide:"Celui qui a quelque chose à perdre si le coup réussit."},
  sympathisant:{label:"Sympathisant",  aide:"Un extérieur qui donne un coup de main, pour ses propres raisons."}
};

/* ===================== NORMALISATION ===================== */
function normaliser(o){
  o.createur=o.createur||null;
  o.cellule=o.cellule||"";          /* vide = toutes les cellules */
  o.envergure=!!o.envergure;
  o.infiltre=!!o.infiltre;
  o.roles=o.roles||{};
  o.insCloses=!!o.insCloses;
  o.tirageFait=!!o.tirageFait;
  return o;
}
function roles(m){
  var out=[], v=m.roles;
  if(v)Object.keys(v).forEach(function(k){
    var r=v[k]; if(!r)return;
    out.push({k:k, ordre:(r.ordre==null?999:r.ordre), intitule:r.intitule||"Rôle",
      camp:CAMPS[r.camp]?r.camp:"adverse", consigne:r.consigne||"",
      qui:r.qui||null, date:r.date||""});
  });
  out.sort(function(a,b){ return (a.ordre-b.ordre)||String(a.k).localeCompare(String(b.k)); });
  return out;
}
function minAdv(m){return m.envergure?MIN_ADV_ENV:MIN_ADV;}
function advPourvus(m){
  var n=0; roles(m).forEach(function(r){if(r.camp==="adverse"&&r.qui)n++;});
  return n;
}
function peutDemarrer(m){ return !!m.chef && advPourvus(m)>=minAdv(m); }
function tientRole(m,p){ return roles(m).some(function(r){return r.qui===p;}); }
/* tout le monde qui joue : Maringouins inscrits + tenants de rôles */
function tousJoueurs(m){
  var out=m.participants.slice();
  roles(m).forEach(function(r){ if(r.qui&&out.indexOf(r.qui)<0)out.push(r.qui); });
  return out;
}
function partChef(m){ return m.envergure?CHEF_ENV:CHEF; }
/* un coup de cellule n'accepte que les Maringouins de cette cellule ; un seul
   suffit à le faire vivre, les autres places sont pour des extérieurs */
function celluleOk(m,p){ return !m.cellule || F.celluleDe(p)===m.cellule; }

function sub(m){
  return { sub:(m.cellule?("cellule "+m.cellule):"toutes les cellules"), qui:m.chef };
}
function tags(m){
  var out=[];
  if(m.envergure)out.push("envergure");
  if(m.statut==="en_attente"){
    var manque=minAdv(m)-advPourvus(m);
    if(manque>0)out.push(manque+" rôle"+(manque>1?"s":"")+" adverse"+(manque>1?"s":"")+" à pourvoir");
  }
  return out;
}

/* ===================== PANNEAU ===================== */
function panel(m){
  var me=F.myPseudo(), staff=F.isStaff(), chef=(me&&me===m.chef);
  var pv=(me&&(m.participants.indexOf(me)>=0||tientRole(m,me)))||staff?F.prv(m):{};

  var banner="";
  if(staff&&m.demandeValidation){
    banner='<div class="tdlm-reqbanner"><p class="tdlm-hsec">\u2691 Le chef demande la validation</p>'
      +'<div class="tdlm-reqrow"><span>Coche ceux qui ont réellement joué, puis valide pour verser.</span></div></div>';
  }
  var secret=(pv&&pv.role&&me&&pv.role[F.cp(me)]==="infiltre")
    ? '<div class="tdlm-reqbanner"><p class="tdlm-hsec">\u2691 Votre rôle</p>'
      +'<div class="tdlm-reqrow">Vous travaillez contre ce coup, pour ceux qui vous emploient. Personne d\u2019autre que le staff ne le sait.</div></div>'
    : "";

  var topicLine=m.topic?'<div class="tdlm-m"><span class="tdlm-k">Sujet RP</span><span class="tdlm-v"><a class="tdlm-lien" href="'+escAttr(m.topic)+'" target="_blank" rel="noopener">Ouvrir le sujet \u2192</a></span></div>':'';
  var contraintes=m.contraintes.length
    ? '<ul class="tdlm-clean">'+m.contraintes.map(function(c){return '<li class="tdlm-puce">'+esc(c)+'</li>';}).join("")+'</ul>'
    : '<span class="tdlm-todo">\u2014</span>';

  return ''
    +'<button class="tdlm-dret" data-back>\u2190 Retour à la liste</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">'+esc(m.titre)+'</span>'+F.stamp(m)+'</div>'
    +'<div class="tdlm-dp-body">'
      +'<div class="tdlm-dp-hd"><div class="tdlm-dp-meta">'
        +'<div class="tdlm-m"><span class="tdlm-k">Monté par</span><span class="tdlm-v">'+esc(m.createur||"\u2014")+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">S\u2019adresse à</span><span class="tdlm-v">'+(m.cellule?esc(m.cellule):"toutes les cellules")+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Nature</span><span class="tdlm-v"><i class="fi '+F.typeIcon(m.type)+'"></i> '+F.typeLabel(m.type)+(m.envergure?' <span class="tdlm-todo">(envergure)</span>':'')+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Chef</span><span class="tdlm-v">'+(m.chef?esc(m.chef):'<span class="tdlm-todo">à pourvoir</span>')+'</span></div>'
        +'<div class="tdlm-m"><span class="tdlm-k">Ouvert</span><span class="tdlm-v">'+ilya(m.cree)+'</span></div>'
        +topicLine
      +'</div>'+banner+'</div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Objectif</p><div class="tdlm-prose">'+(m.objectif?esc(m.objectif):'<span class="tdlm-todo">\u2014</span>')+'</div></div>'
      +'<div class="tdlm-duo">'
        +'<div class="tdlm-sec"><p class="tdlm-hsec">Contraintes</p>'+contraintes+'</div>'
        +'<div class="tdlm-sec"><p class="tdlm-hsec">Contexte</p><div class="tdlm-prose">'+(m.contexte?esc(m.contexte):'<span class="tdlm-todo">\u2014</span>')+'</div></div>'
      +'</div>'
      +blocRoles(m,me,staff)
      +blocParticipants(m,me,staff)
      +secret
      +blocBilan(m)
      +drawer(m,chef,staff)
    +'</div>'
    +actionbar(m,me,staff,chef);
}

function blocRoles(m,me,staff){
  var l=roles(m), editVal=(staff&&m.statut==="en_validation");
  var libre=(m.statut==="en_attente"||m.statut==="acceptee")&&!m.insCloses;
  var corps=l.length?l.map(function(r){
    var prendre=(libre&&!r.qui&&me&&!F.estMaringouin(me)&&!tientRole(m,me))
      ? '<button class="tdlm-abtn prim" data-role="prendre:'+escAttr(r.k)+'">Je prends ce rôle</button>' : '';
    var chk=(editVal&&r.qui)?'<label class="tdlm-chk"><input type="checkbox" data-val="'+escAttr(r.qui)+'" '+(m.valides.indexOf(r.qui)>=0?'checked':'')+'> a joué</label>':'';
    return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd">'
      +'<span class="tdlm-hsec" style="margin:0">'+esc(r.intitule)+'</span>'
      +'<span class="tdlm-r">'+esc(CAMPS[r.camp].label)+'</span>'+prendre+'</div>'
      +(r.consigne?'<div class="tdlm-prose">'+esc(r.consigne)+'</div>':'')
      +(r.qui?('<div class="tdlm-person">'+av(r.qui)+'<span class="tdlm-pname">'+esc(r.qui)+'</span>'+chk+'</div>')
             :'<div class="tdlm-prose tdlm-todo">Libre.</div>')
      +'</div>';
  }).join(""):'<div class="tdlm-sec"><div class="tdlm-prose tdlm-todo">Aucun rôle ouvert.</div></div>';
  var manque=minAdv(m)-advPourvus(m);
  var note=(m.statut==="en_attente"&&manque>0)
    ? '<div class="tdlm-prose tdlm-todo">Le coup ne part pas tant qu\u2019il manque '+manque+' rôle'+(manque>1?'s':'')+' du camp adverse. Ils sont ouverts à tout le monde, sauf aux Maringouins.</div>'
    : '';
  return '<div class="tdlm-sec"><p class="tdlm-hsec">Le camp d\u2019en face</p>'+note+'</div>'+corps;
}

function blocParticipants(m,me,staff){
  var editVal=(staff&&m.statut==="en_validation");
  var pList=m.participants.length?m.participants.map(function(p){
    var chk=editVal?'<label class="tdlm-chk"><input type="checkbox" data-val="'+escAttr(p)+'" '+(m.valides.indexOf(p)>=0?'checked':'')+'> a joué</label>':'';
    var chefLbl=(p===m.chef)?'<span class="tdlm-r">chef</span>':'';
    return '<div class="tdlm-person'+(p===m.chef?' chef':'')+'">'+av(p)+'<span class="tdlm-pname">'+esc(p)+'</span>'+chefLbl+chk+'</div>';
  }).join(""):'<p class="tdlm-todo" style="margin:0">Aucun Maringouin inscrit pour l\'instant.</p>';
  var peut=(F.estMaringouin(me)&&m.participants.indexOf(me)<0&&!m.insCloses
    &&(m.statut==="en_attente"||m.statut==="acceptee")&&celluleOk(m,me));
  var btn=peut?'<button class="tdlm-abtn prim" data-act="join">Je participe</button>':'';
  var hors=(F.estMaringouin(me)&&!celluleOk(m,me))
    ? '<div class="tdlm-prose tdlm-todo">Ce coup est réservé à la cellule '+esc(m.cellule)+'.</div>' : '';
  return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd">'
    +'<span class="tdlm-hsec" style="margin:0">Les Maringouins</span>'+btn+'</div>'+pList+hors+'</div>';
}

function blocBilan(m){
  if(!(m.resume||m.consequences||m.statut==="en_validation"||m.statut==="terminee"))return "";
  return '<div class="tdlm-sec"><p class="tdlm-hsec">Résumé</p><div class="tdlm-prose">'+(m.resume?esc(m.resume):'<span class="tdlm-todo">\u2014</span>')+'</div></div>'
    +'<div class="tdlm-sec"><p class="tdlm-hsec">Conséquences</p><div class="tdlm-prose">'+(m.consequences?esc(m.consequences):'<span class="tdlm-todo">\u2014</span>')+'</div></div>';
}

/* ---- barre d'action : les rôles se CUMULENT ---- */
function actionbar(m,me,staff,chef){
  var roles2=[], btns="";
  var vivant=(m.statut==="en_attente"||m.statut==="acceptee");
  if(chef&&m.statut!=="terminee"&&m.statut!=="refusee"){
    roles2.push("Chef du coup");
    btns+='<button class="tdlm-abtn" data-act="edit">Rôles &amp; informations</button>';
    btns+='<button class="tdlm-abtn" data-act="topic">'+(m.topic?"Modifier le sujet RP":"Renseigner le sujet RP")+'</button>';
    if(vivant&&!m.insCloses)btns+='<button class="tdlm-abtn" data-act="clore">Clore les inscriptions</button>';
    if(m.statut!=="en_attente")btns+='<button class="tdlm-abtn prim" data-act="bilan">'+(m.statut==="en_validation"?"Modifier le bilan":"Bilan &amp; passer en validation")+'</button>';
  }
  if(staff){
    roles2.push("Staff");
    if(!chef)btns+='<button class="tdlm-abtn" data-act="edit">Rôles &amp; informations</button>';
    if(vivant&&!m.insCloses&&!chef)btns+='<button class="tdlm-abtn" data-act="clore">Clore les inscriptions</button>';
    if(m.statut==="en_validation")btns+='<button class="tdlm-abtn prim" data-act="valider">Valider &amp; payer</button>';
    if(m.statut!=="terminee"&&m.statut!=="refusee")btns+='<button class="tdlm-abtn warn" data-act="retirer">Retirer le coup</button>';
    btns+='<button class="tdlm-abtn warn" data-act="delete">Supprimer</button>';
  }
  if(!btns){
    if(!F.estConnecte()){roles2.push("Invité");btns='<span class="tdlm-idle">Connectez-vous pour interagir.</span>';}
    else if(F.estMaringouin(me)){roles2.push("Maringouin");btns='<span class="tdlm-idle">Utilisez \u00ab Je participe \u00bb ci-dessus.</span>';}
    else if(tientRole(m,me)){roles2.push("Dans la partie");btns='<span class="tdlm-idle">Vous tenez un rôle sur ce coup.</span>';}
    else {roles2.push("Visiteur");btns='<span class="tdlm-idle">Prenez un rôle du camp d\u2019en face ci-dessus.</span>';}
  }
  if(!roles2.length)roles2.push("Visiteur");
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles2.join(" \u00b7 ")+'</span>'+btns+'</div>';
}

/* ---- tiroirs ---- */
function champRole(i,r){
  r=r||{};
  var opts=Object.keys(CAMPS).map(function(k){
    return '<option value="'+k+'"'+(k===r.camp?' selected':'')+'>'+esc(CAMPS[k].label)+'</option>';
  }).join("");
  return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Rôle '+(i+1)+'</span></div>'
    +'<label class="tdlm-fl">Intitulé</label><input type="text" id="tdlc-ri'+i+'" value="'+escAttr(r.intitule||"")+'" placeholder="Le gardien de nuit, le contremaître, le deputy de permanence\u2026">'
    +'<label class="tdlm-fl">Camp</label><select id="tdlc-rc'+i+'">'+opts+'</select>'
    +'<label class="tdlm-fl">Ce qu\u2019on attend de lui</label><textarea id="tdlc-rs'+i+'">'+esc(r.consigne||"")+'</textarea></div>';
}
var NB_EDIT=1;
function drawer(m,chef,staff){
  if(S.inline==="topic"){
    return '<div class="tdlm-drawer on"><h4>Sujet RP du coup</h4>'
      +'<input type="text" id="tdlm-topic" value="'+escAttr(m.topic)+'" placeholder="https://thedrownedlands.forumactif.com/t...">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="topicok">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="bilan"){
    return '<div class="tdlm-drawer on"><h4>Bilan du coup</h4>'
      +'<label class="tdlm-fl">Résumé</label><textarea id="tdlm-bresume">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Conséquences</label><textarea id="tdlm-bconseq">'+esc(m.consequences)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="bilanok">'+(m.statut==="en_validation"?"Enregistrer":"Envoyer en validation")+'</button>'
      +(m.statut!=="en_validation"?'<button class="tdlm-abtn" data-do="bilansave">Enregistrer sans envoyer</button>':'')
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="edit"&&(chef||staff)){
    var neufs=""; for(var i=0;i<NB_EDIT;i++)neufs+=champRole(i,null);
    return '<div class="tdlm-drawer on"><h4>Rôles &amp; informations</h4>'
      +'<label class="tdlm-fl">Objectif</label><textarea id="tdlm-eobj">'+esc(m.objectif)+'</textarea>'
      +'<label class="tdlm-fl">Contraintes (une par ligne)</label><textarea id="tdlm-econtr">'+esc(m.contraintes.join("\n"))+'</textarea>'
      +'<label class="tdlm-fl">Contexte</label><textarea id="tdlm-ectx">'+esc(m.contexte)+'</textarea>'
      +'<div class="tdlm-prose tdlm-todo">Les rôles déjà pourvus ne sont pas modifiables ici. Ajoutez-en autant que le coup en demande.</div>'
      +'<div id="tdlc-newroles">'+neufs+'</div>'
      +'<div class="tdlm-row"><button class="tdlm-abtn" data-do="plusrole">+ Un rôle de plus</button></div>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="editok">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="join"){
    return '<div class="tdlm-drawer on"><h4>Participer au coup</h4>'+caseInfiltre(m)
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="joinok">Je participe</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline&&S.inline.indexOf("role:")===0){
    var k=S.inline.slice(5), r=null;
    roles(m).forEach(function(x){if(x.k===k)r=x;});
    if(r)return '<div class="tdlm-drawer on"><h4>'+esc(r.intitule)+'</h4>'
      +(r.consigne?'<div class="tdlm-prose">'+esc(r.consigne)+'</div>':'')
      +caseInfiltre(m)
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="roleok:'+escAttr(k)+'">Je prends ce rôle</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}
function caseInfiltre(m){
  if(!m.infiltre)return "";
  return '<label class="tdlm-fl tdlm-chkline"><input type="checkbox" id="tdlc-vol"> Je souhaite pouvoir jouer l\u2019infiltré</label>'
    +'<div class="tdlm-prose tdlm-todo">L\u2019infiltré travaille contre le coup pour ceux qui l\u2019emploient. Le rôle est tiré au sort à la clôture des inscriptions, parmi ceux qui ont coché. Personne ne saura si un rôle a été attribué, ni à qui.</div>';
}

/* ===================== ACTIONS ===================== */
function act(k,m){
  if(!m)return;
  var me=F.myPseudo();
  if(k==="join"){
    if(!F.estMaringouin(me)){toast("Réservé aux Maringouins.");return;}
    if(!celluleOk(m,me)){toast("Ce coup est réservé à la cellule "+m.cellule+".");return;}
    if(m.insCloses){toast("Les inscriptions sont closes.");return;}
    if(m.infiltre){S.drawer="join";S.inline=null;F.renderStage();return;}
    inscrire(m,false); return;
  }
  if(k==="topic"){S.inline=(S.inline==="topic")?null:"topic";S.drawer=null;F.renderStage();return;}
  if(k==="bilan"){S.drawer=(S.drawer==="bilan")?null:"bilan";S.inline=null;F.renderStage();return;}
  if(k==="edit"){NB_EDIT=1;S.drawer=(S.drawer==="edit")?null:"edit";S.inline=null;F.renderStage();return;}
  if(k==="clore"){clore(m);return;}
  if(k==="valider"){valider(m);return;}
  if(k==="retirer"){
    if(!window.confirm("Retirer le coup \u00ab "+m.titre+" \u00bb ?\nAucun argent n\u2019a été retenu : personne n\u2019est remboursé."))return;
    m.statut="refusee"; patch(m,{statut:"refusee",demandeValidation:false});
    toast("Coup retiré."); F.renderAll(); return;
  }
  if(k==="delete"){
    if(!window.confirm("Supprimer définitivement \u00ab "+m.titre+" \u00bb ?"))return;
    F.supprimer(m); toast("Coup supprimé."); F.renderAll(); return;
  }
}

function doo(k,m){
  if(k==="cancel"){S.drawer=null;S.inline=null;F.renderStage();return;}
  if(k==="joinok"){inscrire(m,!!($("#tdlc-vol")&&$("#tdlc-vol").checked));return;}
  if(k&&k.indexOf("roleok:")===0){prendreRole(m,k.slice(7));return;}
  if(k==="plusrole"){
    var box=$("#tdlc-newroles");
    if(box){box.insertAdjacentHTML("beforeend",champRole(NB_EDIT,null));NB_EDIT++;}
    return;
  }
  if(k==="topicok"){
    var u=(($("#tdlm-topic")||{}).value||"").trim();
    m.topic=u; patch(m,{topic:u}); S.inline=null;
    toast(u?"Sujet RP enregistré.":"Sujet RP retiré."); F.renderStage(); return;
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
    toast((ch.statut==="en_validation")?"Coup envoyé en validation.":"Bilan enregistré.");
    F.renderAll(); return;
  }
  if(k==="editok"){
    var K=window.TDLMisCoup||{};
    if(K.editer)K.editer(m,NB_EDIT); else toast("rep-mis-coup-neuf n\u2019est pas chargé.");
    return;
  }
}

function brancher(stage){
  stage.querySelectorAll("[data-role]").forEach(function(el){
    el.onclick=function(){
      var raw=el.getAttribute("data-role"), i=raw.indexOf(":");
      if(raw.slice(0,i)==="prendre"){S.inline="role:"+raw.slice(i+1);S.drawer=null;F.renderStage();}
    };
  });
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

/* ---- inscriptions ---- */
function inscrire(m,vol){
  var me=F.myPseudo();
  if(!F.exigeV2(m))return;
  if(m.participants.indexOf(me)>=0){toast("Déjà inscrit\u00b7e.");return;}
  m.participants.push(me);
  var ch={}; ch["participants/"+F.cp(me)]=me;
  if(!m.chef){m.chef=me;ch.chef=me;}
  if(m.statut==="en_attente"&&peutDemarrer(m)){m.statut="acceptee";ch.statut="acceptee";}
  ecr(m,ch);
  /* le volontariat ne touche JAMAIS l'entrée elle-même */
  if(vol&&me!==m.chef){var p={};p["vol/"+F.cp(me)]=true;F.patchPrv(m,p);}
  S.drawer=null;
  toast(m.chef===me?"Inscrit\u00b7e \u2014 vous êtes chef du coup.":"Inscrit\u00b7e au coup.");
  F.renderAll();
}
function prendreRole(m,k){
  var me=F.myPseudo();
  if(!me){toast("Connectez-vous.");return;}
  if(!F.exigeV2(m))return;
  if(F.estMaringouin(me)){toast("Les rôles du camp d\u2019en face ne se tiennent pas par un Maringouin.");return;}
  if(tientRole(m,me)){toast("Vous tenez déjà un rôle sur ce coup.");return;}
  if(m.insCloses){toast("Les inscriptions sont closes.");return;}
  var r=null; roles(m).forEach(function(x){if(x.k===k)r=x;});
  if(!r||r.qui){toast("Ce rôle n\u2019est plus libre.");return;}
  var vol=!!($("#tdlc-vol")&&$("#tdlc-vol").checked);
  var date=new Date().toISOString(), ch={};
  ch["roles/"+k+"/qui"]=me; ch["roles/"+k+"/date"]=date;
  m.roles[k].qui=me; m.roles[k].date=date;
  if(m.statut==="en_attente"&&peutDemarrer(m)){m.statut="acceptee";ch.statut="acceptee";}
  ecr(m,ch);
  if(vol){var p={};p["vol/"+F.cp(me)]=true;F.patchPrv(m,p);}
  S.inline=null;
  try{ if(window.EcoNotif && m.chef) EcoNotif.a(m.chef,N_ROLE,{titre:m.titre,pseudo:me},"rol"+m.id+k); }catch(e){}
  toast("Rôle pris."); F.renderAll();
}

/* ---- clôture des inscriptions ----
   Le message est toujours le même, qu'un rôle secret soit attribué ou non.
   Le tirage est déclenché par un client staff, puisque le chef n'a pas le
   droit de lire la liste des volontaires. */
function clore(m){
  if(m.insCloses){toast("Déjà fait.");return;}
  if(!m.chef){toast("Il faut un chef avant de clore.");return;}
  if(advPourvus(m)<minAdv(m)){toast("Il manque encore "+(minAdv(m)-advPourvus(m))+" rôle(s) du camp adverse.");return;}
  if(!window.confirm("Clore les inscriptions ?\nPlus personne ne pourra rejoindre le coup."))return;
  m.insCloses=true;
  var ch={insCloses:true};
  if(m.statut==="en_attente"){m.statut="acceptee";ch.statut="acceptee";}
  patch(m,ch);
  toast("Inscriptions closes. Le coup peut partir.");
  F.renderAll();
  if(F.isStaff())tirer(m);
}

/* UNE SEULE FOIS : le verrou sur tirageFait ne laisse passer qu'un client. */
function tirer(m){
  if(m.tirageFait||!m.infiltre)return;
  F.verrou(m,"tirageFait").then(function(){
    m.tirageFait=true;
    return Promise.resolve(window.EcoCore.firebaseGet(
      F.CFG.NODE_PRV+"/"+encodeURIComponent(m.id)+"/vol"));
  }).then(function(vol){
    var inscrits={}; tousJoueurs(m).forEach(function(p){inscrits[F.cp(p)]=p;});
    var cles=Object.keys(vol||{}).filter(function(c){
      return vol[c]&&inscrits[c]&&inscrits[c]!==m.chef;   /* le chef est exclu */
    });
    if(!cles.length)return null;
    var c=cles[Math.floor(Math.random()*cles.length)], qui=inscrits[c];
    var ch={}; ch["infiltre"]=qui; ch["role/"+c]="infiltre";
    return F.patchPrv(m,ch).then(function(){
      try{ if(window.EcoNotif) EcoNotif.a(qui,N_SECRET,{titre:m.titre},"inf"+m.id); }catch(e){}
      return qui;
    });
  }).catch(function(e){
    if(F.estDeja(e)){m.tirageFait=true;return;}
    if(window.console)console.error("[rep-mis-coup] tirage",e);
  });
}
function auto(list){
  if(!F.isStaff())return;
  list.forEach(function(m){
    if(m.genre==="coup"&&m.infiltre&&m.insCloses&&!m.tirageFait)tirer(m);
  });
}

/* ---- validation : tout est créé, rien n'a été retenu ---- */
function valider(m){
  if(m.primeVersee){toast("Déjà payé.");return;}
  var vals=m.valides.slice();
  if(!vals.length){toast("Coche au moins un joueur.");return;}
  var chefDedans=(m.chef&&vals.indexOf(m.chef)>=0);
  var autres=vals.filter(function(p){return p!==m.chef;});
  var total=autres.length*PART+(chefDedans?partChef(m):0);
  if(!window.confirm("Valider \u00ab "+m.titre+" \u00bb ?\n"+autres.length+" joueur(s) à "+money(PART)
    +(chefDedans?(", "+money(partChef(m))+" au chef"):"")+" \u2014 "+money(total)+" au total.\nIrréversible."))return;
  /* verrou AVANT tout crédit : deux validations paieraient deux fois */
  F.verrou(m,"primeVersee").then(function(){
    m.primeVersee=true;
    var chain=Promise.resolve();
    autres.forEach(function(p){chain=chain.then(function(){return F.crediter(p,PART);});});
    if(chefDedans)chain=chain.then(function(){return F.crediter(m.chef,partChef(m));});
    return chain.then(function(){
      m.statut="terminee";m.demandeValidation=false;
      patch(m,{statut:"terminee",demandeValidation:false});
      try{ if(window.EcoNotif) vals.forEach(function(p){
        EcoNotif.a(p,115,{titre:m.titre,montant:(p===m.chef?partChef(m):PART)},"coup"+m.id+"_"+p);
      }); }catch(e){}
      toast("Coup validé. "+money(total)+" versés.");
      return F.rafraichir();
    });
  }).catch(function(e){
    if(F.estDeja(e)){m.primeVersee=true;toast("Déjà payé ailleurs \u2014 rien n\u2019a été versé deux fois.");F.renderAll();return;}
    toast("Versement incomplet \u2014 le coup reste marqué payé, vérifiez les soldes.");
    F.renderAll();
  });
}

/* ===================== EXPORT (pour rep-mis-coup-neuf) ===================== */
window.TDLMisCoup = { CAMPS:CAMPS, champRole:champRole, roles:roles,
  MIN_ADV:MIN_ADV, MIN_ADV_ENV:MIN_ADV_ENV, MAX_ROLES:MAX_ROLES,
  N_OUVERT:N_OUVERT /* editer est garni par rep-mis-coup-neuf */ };

/* ===================== DÉCLARATION ===================== */
F.type({
  k:"coup", label:"Coup", ic:"fi-tr-hand-fist",
  normaliser:normaliser, sub:sub, tags:tags, panel:panel,
  act:act, doo:doo, brancher:brancher, auto:auto
});

})(window.TDLMis);
