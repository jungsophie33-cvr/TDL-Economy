/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU CARREFOUR · TYPE « CHASSE À PRIME »
   (tdlc-chasse.js) — à charger APRÈS tdlc-core.js.

   Une chasse est ouverte par un COMMANDITAIRE, qui n'y joue pas. Mode hardcore.
   3 participants minimum, 4 maximum. Prime de 300 $ minimum.

   L'ARGENT. La prime entière est gelée à l'ouverture (débit réel du
   commanditaire). Si la cible est livrée, elle est partagée en parts égales
   entre les participants qui ont joué ; si le commanditaire a tenu son rôle de
   référent, la moitié lui est RENDUE à la clôture — jamais à l'ouverture, sans
   quoi il suffirait d'écrire trois accroches bidon pour payer moitié prix.
   Si la cible échappe, le gel est intégralement rendu, et l'antagoniste non
   démasqué touche 75 % du montant affiché. Chasse institutionnelle : aucun gel,
   tout est créé.

   LE RÔLE SECRET. Le volontariat vit dans carrefour_prv, jamais dans la fiche
   légère : ni le commanditaire ni les autres participants ne doivent savoir qui
   s'est porté volontaire, ni même si le rôle a été attribué. Le tirage se fait
   à la clôture des inscriptions, UNE SEULE FOIS, sous verrou transactionnel, et
   par un client STAFF — le commanditaire ne peut pas le faire lui-même puisqu'il
   n'a pas le droit de lire la liste des volontaires.

   LES ACCROCHES. Trois faits fermés, écrits à l'ouverture, invisibles de tous
   sauf du commanditaire et du staff. Il les ouvre au fil de la chasse quand
   quelqu'un remplit la condition dans le sujet : le fait est alors recopié dans
   carrefour_txt, au nom de celui qui l'a obtenu, et devient public.
   ================================================================== */
(function(F){
"use strict";
if(!F){ if(window.console) console.warn("[tdlc-chasse] socle absent."); return; }
var esc=F.esc, escAttr=F.escAttr, money=F.money, ilya=F.ilya, av=F.av, $=F.$;
var S=F.S, patch=F.patch, toast=F.toast;

/* ===================== CONFIG ===================== */
var MIN_PART=3, MAX_PART=4, PRIME_MIN=300, ACCROCHES=3, OUVERTURES_MIN=2;
var PART_ANTAGO=0.75;

var T={
  REGLE:"Une chasse à prime se joue en mode hardcore. Trois participants minimum, quatre maximum, et la prime est immobilisée dès l\u2019affichage : elle sera versée quoi qu\u2019il arrive, à ceux qui ramènent le résultat ou à celui qui l\u2019a fait échouer.",
  REFERENT:"Si vous préparez trois indices fermés et que vous suivez votre affaire en les ouvrant au fil du jeu, la moitié de la prime vous est rendue à la clôture. Sinon vous payez plein pot et le staff guide les joueurs à votre place.",
  CLOS:"Inscriptions closes. La chasse peut commencer.",
  SECRET:"Personne ne saura si un rôle secret a été attribué, ni à qui."
};

/* ===================== NORMALISATION ===================== */
function lstPart(v){
  var out=[];
  if(!v)return out;
  Object.keys(v).forEach(function(k){
    var p=v[k]; if(!p)return;
    out.push({k:k, pseudo:p.pseudo||String(k), date:p.date||"", joue:!!p.joue});
  });
  out.sort(function(a,b){return String(a.date).localeCompare(String(b.date));});
  return out;
}
function normaliser(o){
  o.cible=o.cible||"";
  o.prime=+o.prime||0;
  o.gel=+o.gel||0;
  o.institution=o.institution||"";
  o.affaire=o.affaire||"";
  o.aAccroches=!!o.aAccroches;
  o.ouvertes=+o.ouvertes||0;
  o.participants=o.participants||{};
  o.inscriptionsCloses=!!o.inscriptionsCloses;
  o.tirageFait=!!o.tirageFait;
  o.livree=!!o.livree; o.demasque=!!o.demasque;
  o.motif=o.motif||""; o.justif=o.justif||"";
  o.primeVersee=!!o.primeVersee;
  o.resume=o.resume||"";
  return o;
}
function parts(m){return lstPart(m.participants);}
function estInscrit(m,me){return !!(me&&m.participants&&m.participants[F.cp(me)]);}
function referent(m){return m.institution?null:m.auteur;}
function estReferent(m,me){return !!(me&&referent(m)===me);}

/* ===================== RANGÉE ===================== */
function sub(m){
  return { sub:(m.institution||m.auteur||"\u2014"), qui:m.auteur, quand:"affichée "+ilya(m.cree) };
}
function tags(m){
  var n=parts(m).length, out=[money(m.prime)];
  if(m.statut==="ouverte")out.push(n+"/"+MAX_PART+" inscrits");
  if(m.zone)out.push(m.zone);
  return out;
}

/* ===================== PANNEAU ===================== */
function panel(m){
  var me=F.myPseudo(), staff=F.isStaff(), ref=estReferent(m,me);
  var tx=F.txt(m), pv=(ref||staff||estInscrit(m,me))?F.prv(m):{};
  var vu={me:me, staff:staff, ref:ref};

  var meta=''
    +'<div class="tdlm-m"><span class="tdlm-k">Commanditaire</span><span class="tdlm-v">'+esc(m.institution||m.auteur||"\u2014")+'</span></div>'
    +(m.affaire?'<div class="tdlm-m"><span class="tdlm-k">Affaire</span><span class="tdlm-v">'+esc(m.affaire)+'</span></div>':'')
    +'<div class="tdlm-m"><span class="tdlm-k">Zone</span><span class="tdlm-v">'+esc(m.zone||"\u2014")+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">Recherché</span><span class="tdlm-v">'+esc(m.cible||"\u2014")+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">Prime</span><span class="tdlm-v"><b>'+money(m.prime)+'</b></span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">Participants</span><span class="tdlm-v">'+parts(m).length+' / '+MAX_PART+'</span></div>'
    +(m.sujet?'<div class="tdlm-m"><span class="tdlm-k">Sujet RP</span><span class="tdlm-v"><a class="tdlm-lien" href="'+escAttr(m.sujet)+'" target="_blank" rel="noopener">Ouvrir le sujet \u2192</a></span></div>':'');

  var ctx=(tx===null)
    ? '<span class="tdlm-todo">Chargement\u2026</span>'
    : (tx.contexte?esc(tx.contexte):'<span class="tdlm-todo">\u2014</span>');
  var cond=(tx&&tx.conditions)?'<div class="tdlm-sec"><p class="tdlm-hsec">Conditions de résolution</p><div class="tdlm-prose">'+esc(tx.conditions)+'</div></div>':'';

  return ''
    +'<button class="tdlm-dret" data-back>\u2190 Retour au tableau</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">'+esc(m.titre)+'</span>'+F.stamp(m)+'</div>'
    +'<div class="tdlm-dp-body">'
      +'<div class="tdlm-dp-hd"><div class="tdlm-dp-meta">'+meta+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Ce qu\u2019on sait</p><div class="tdlm-prose">'+ctx+'</div></div>'
      +cond
      +blocOuvertes(tx)
      +blocAccroches(m,pv,vu)
      +blocParticipants(m,pv,vu)
      +blocBilan(m)
      +drawer(m,pv,vu)
    +'</div>'
    +actionbar(m,vu);
}

/* ---- indices rendus publics ---- */
function blocOuvertes(tx){
  if(!tx||!tx.ouvertes)return "";
  var ks=Object.keys(tx.ouvertes); if(!ks.length)return "";
  var corps=ks.map(function(k){
    var a=tx.ouvertes[k]||{};
    return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd">'
      +'<span class="tdlm-hsec" style="margin:0">Découvert</span>'
      +(a.par?'<span class="tdlm-r">'+esc(a.par)+'</span>':'')
      +(a.date?'<span class="tdlm-todo">'+esc(ilya(a.date))+'</span>':'')+'</div>'
      +'<div class="tdlm-prose">'+esc(a.fait||"")+'</div></div>';
  }).join("");
  return '<div class="tdlm-sec"><p class="tdlm-hsec">Ce qui a été trouvé</p></div>'+corps;
}

/* ---- indices fermés : commanditaire et staff seulement ---- */
function blocAccroches(m,pv,vu){
  if(!(vu.ref||vu.staff))return "";
  if(pv===null)return '<div class="tdlm-sec"><p class="tdlm-hsec">Vos indices</p><div class="tdlm-prose tdlm-todo">Chargement\u2026</div></div>';
  var acc=pv.accroches||{}, ks=Object.keys(acc);
  if(!ks.length)return "";
  var corps=ks.map(function(k){
    var a=acc[k]||{};
    if(a.ouverte)return "";
    return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd">'
      +'<span class="tdlm-hsec" style="margin:0">Fermé</span>'
      +(m.statut==="close"?'':'<button class="tdlm-abtn" data-acc="'+escAttr(k)+'">Ouvrir à quelqu\u2019un</button>')+'</div>'
      +'<div class="tdlm-prose">'+esc(a.fait||"")+'</div>'
      +'<div class="tdlm-prose tdlm-todo"><b>Condition :</b> '+esc(a.condition||"\u2014")+'</div></div>';
  }).join("");
  if(!corps)return "";
  return '<div class="tdlm-sec"><p class="tdlm-hsec">Vos indices</p>'
    +'<div class="tdlm-prose tdlm-todo">Ouvrez-en un quand quelqu\u2019un remplit sa condition dans le sujet. Il devient public, à son nom.</div></div>'+corps;
}

/* ---- participants ---- */
function blocParticipants(m,pv,vu){
  var l=parts(m);
  var moi=(pv&&pv.role&&vu.me)?pv.role[F.cp(vu.me)]:null;
  var secret=(moi==="antagoniste")
    ? '<div class="tdlm-reqbanner"><p class="tdlm-hsec">\u2691 Votre rôle</p>'
      +'<div class="tdlm-reqrow">Vous aidez la cible à échapper à cette chasse sans être démasqué. Personne d\u2019autre que le staff ne le sait.</div></div>'
    : "";
  var corps=l.length?l.map(function(p){
    return '<div class="tdlm-person">'+av(p.pseudo)+'<span class="tdlm-pname">'+esc(p.pseudo)+'</span>'
      +(m.statut==="close"?'<span class="tdlm-r">'+(p.joue?"a joué":"absent")+'</span>':'')+'</div>';
  }).join(""):'<div class="tdlm-prose tdlm-todo">Personne pour l\u2019instant.</div>';
  return '<div class="tdlm-sec"><p class="tdlm-hsec">Les chasseurs</p></div>'
    +'<div class="tdlm-cadre">'+corps+'</div>'+secret;
}

function blocBilan(m){
  if(m.statut!=="close")return "";
  var issue=(m.livree?"La cible a été livrée.":"La cible a échappé à la chasse.")
    +" "+(m.demasque?"L\u2019antagoniste a été démasqué.":"Aucun antagoniste n\u2019a été démasqué.");
  return '<div class="tdlm-sec"><p class="tdlm-hsec">Issue</p><div class="tdlm-prose">'+esc(issue)+'</div></div>'
    +(m.resume?'<div class="tdlm-sec"><p class="tdlm-hsec">Ce qui s\u2019est passé</p><div class="tdlm-prose">'+esc(m.resume)+'</div></div>':'');
}

/* ---- barre d'action ---- */
function actionbar(m,vu){
  var roles=[], btns="";
  var ouvert=(m.statut==="ouverte"), vivant=(m.statut==="ouverte"||m.statut==="en_cours");
  if(vu.ref&&vivant){
    roles.push("Référent");
    if(ouvert&&parts(m).length>=MIN_PART)btns+='<button class="tdlm-abtn prim" data-act="clore">Clore les inscriptions</button>';
    btns+='<button class="tdlm-abtn" data-act="sujet">'+(m.sujet?"Modifier le sujet RP":"Renseigner le sujet RP")+'</button>';
  }
  if(vu.staff){
    roles.push("Staff");
    if(ouvert&&parts(m).length>=MIN_PART&&!vu.ref)btns+='<button class="tdlm-abtn prim" data-act="clore">Clore les inscriptions</button>';
    if(m.statut==="en_cours")btns+='<button class="tdlm-abtn prim" data-act="regler">Régler la chasse</button>';
    if(vivant)btns+='<button class="tdlm-abtn warn" data-act="retirer">Retirer</button>';
    btns+='<button class="tdlm-abtn warn" data-act="delete">Supprimer</button>';
  }
  if(!F.estConnecte()){roles.push("Invité");btns=btns||'<span class="tdlm-idle">Connectez-vous pour vous inscrire.</span>';}
  else if(vu.me&&estInscrit(m,vu.me)){
    roles.push("Chasseur");
    if(ouvert)btns+='<button class="tdlm-abtn" data-act="quitter">Me retirer</button>';
  }
  else if(ouvert&&!vu.ref&&vu.me){
    if(parts(m).length>=MAX_PART)btns+='<span class="tdlm-idle">Complet.</span>';
    else btns+='<button class="tdlm-abtn prim" data-act="inscrire">Je m\u2019inscris</button>';
  }
  if(!roles.length)roles.push("Visiteur");
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles.join(" \u27e1 ")+'</span>'+btns+'</div>';
}

/* ---- tiroirs ---- */
function drawer(m,pv,vu){
  if(S.inline==="sujet"){
    return '<div class="tdlm-drawer on"><h4>Sujet RP de la chasse</h4>'
      +'<input type="text" id="tdlc-sujet" value="'+escAttr(m.sujet)+'" placeholder="https://thedrownedlands.forumactif.com/t\u2026">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="sujetok">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="inscrire"){
    return '<div class="tdlm-drawer on"><h4>S\u2019inscrire à la chasse</h4>'
      +'<label class="tdlm-fl tdlm-chkline"><input type="checkbox" id="tdlc-vol"> Je souhaite pouvoir jouer l\u2019antagoniste de cette chasse</label>'
      +'<div class="tdlm-prose tdlm-todo">L\u2019antagoniste aide la cible à échapper au contrat sans se faire démasquer. Le rôle est tiré au sort à la clôture des inscriptions, parmi ceux qui ont coché. '+esc(T.SECRET)+'</div>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="inscrireok">Je m\u2019inscris</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.inline&&S.inline.indexOf("acc:")===0&&pv&&pv.accroches){
    var ka=S.inline.slice(4), a=pv.accroches[ka];
    if(a){
      var opts=parts(m).map(function(p){return '<option value="'+escAttr(p.pseudo)+'">'+esc(p.pseudo)+'</option>';}).join("");
      return '<div class="tdlm-drawer on"><h4>Ouvrir un indice</h4>'
        +'<div class="tdlm-prose">'+esc(a.fait||"")+'</div>'
        +'<div class="tdlm-prose tdlm-todo"><b>Condition :</b> '+esc(a.condition||"\u2014")+'</div>'
        +'<label class="tdlm-fl">Qui l\u2019a obtenu</label><select id="tdlc-accqui">'+opts+'</select>'
        +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="accok:'+escAttr(ka)+'">Rendre public</button>'
        +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
    }
  }
  if(S.drawer==="regler"&&vu.staff){
    var lignes=parts(m).map(function(p){
      return '<label class="tdlm-chk"><input type="checkbox" class="tdlc-joue" data-p="'+escAttr(p.pseudo)+'" checked> '+esc(p.pseudo)+'</label>';
    }).join("");
    var assez=(m.ouvertes>=OUVERTURES_MIN);
    return '<div class="tdlm-drawer on"><h4>Régler la chasse</h4>'
      +'<label class="tdlm-fl tdlm-chkline"><input type="checkbox" id="tdlc-livree"> La cible a été livrée au commanditaire</label>'
      +'<label class="tdlm-fl">L\u2019antagoniste a-t-il été démasqué ?</label>'
      +'<select id="tdlc-motif">'
        +'<option value="">Non démasqué</option>'
        +'<option value="flagrant">Pris en flagrant délit</option>'
        +'<option value="faisceau">Faisceau d\u2019indices concordants</option>'
        +'<option value="confrontation">Confrontation : il s\u2019est trahi ou a avoué</option>'
      +'</select>'
      +'<div class="tdlm-prose tdlm-todo">Une accusation lancée en RP ne suffit pas. Il faut du joué : un flagrant délit, plusieurs éléments concordants, ou une confrontation à laquelle ses explications ne résistent pas.</div>'
      +'<label class="tdlm-fl">Sur quoi vous vous appuyez</label><textarea id="tdlc-justif"></textarea>'
      +'<label class="tdlm-fl">Ce qui s\u2019est passé (public)</label><textarea id="tdlc-resume">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Qui a joué</label><div class="tdlm-row">'+(lignes||'<span class="tdlm-idle">Personne.</span>')+'</div>'
      +(m.gel?('<label class="tdlm-fl tdlm-chkline"><input type="checkbox" id="tdlc-moitie"'+(m.aAccroches&&assez?' checked':'')+'> Le référent a tenu son rôle : lui rendre '+money(Math.floor(m.prime/2))+'</label>'
        +'<div class="tdlm-prose tdlm-todo">'+(m.aAccroches?(m.ouvertes+' indice(s) ouvert(s) sur '+ACCROCHES+'.'):'Aucun indice n\u2019avait été préparé à l\u2019ouverture.')+'</div>'):'')
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="reglerok">Clore et payer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

/* ===================== ACTIONS ===================== */
function act(k,m){
  if(k==="sujet"){S.inline="sujet";S.drawer=null;F.renderStage();return;}
  if(k==="inscrire"){S.drawer="inscrire";S.inline=null;F.renderStage();return;}
  if(k==="regler"){S.drawer="regler";S.inline=null;F.renderStage();return;}
  if(k==="quitter"){quitter(m);return;}
  if(k==="clore"){clorelnscriptions(m);return;}
  if(k==="retirer"){
    if(!window.confirm("Retirer cette chasse ?\nLa prime gelée est rendue au commanditaire."))return;
    rendreGel(m).then(function(){
      m.statut="retiree"; patch(m,{statut:"retiree"});
      toast("Chasse retirée."); F.renderAll();
    });
    return;
  }
  if(k==="delete"){
    if(!window.confirm("Supprimer définitivement \u00ab "+m.titre+" \u00bb ?"))return;
    F.supprimer(m); toast("Chasse supprimée."); F.renderAll(); return;
  }
}
function doo(k,m){
  if(k==="cancel"){S.drawer=null;S.inline=null;F.renderStage();return;}
  if(k==="inscrireok"){inscrire(m);return;}
  if(k==="sujetok"){
    var el=$("#tdlc-sujet"), url=el?String(el.value||"").trim():"";
    m.sujet=url; patch(m,{sujet:url}); S.inline=null;
    toast("Sujet enregistré."); F.renderStage(); return;
  }
  if(k&&k.indexOf("accok:")===0){ouvrirAccroche(m,k.slice(6));return;}
  if(k==="reglerok"){regler(m);return;}
}
function brancher(stage){
  stage.querySelectorAll("[data-acc]").forEach(function(el){
    el.onclick=function(){S.inline="acc:"+el.getAttribute("data-acc");S.drawer=null;F.renderStage();};
  });
}

/* ---- inscription ---- */
function inscrire(m){
  var me=F.myPseudo();
  if(!me){toast("Connectez-vous.");return;}
  if(!F.exigeV2(m))return;
  if(estInscrit(m,me)){toast("Vous êtes déjà inscrit.");return;}
  if(parts(m).length>=MAX_PART){toast("La chasse est complète.");return;}
  if(estReferent(m,me)){toast("Le commanditaire ne joue pas sa propre chasse.");return;}
  var vol=$("#tdlc-vol"), veut=!!(vol&&vol.checked);
  var cle=F.cp(me), ch={};
  ch["participants/"+cle]={pseudo:me, date:new Date().toISOString(), joue:false};
  patch(m,ch);
  m.participants[cle]={pseudo:me,date:new Date().toISOString(),joue:false};
  /* le volontariat ne touche JAMAIS la fiche légère */
  if(veut){ var p={}; p["vol/"+cle]=true; F.patchPrv(m,p); }
  S.drawer=null;
  try{if(window.EcoNotif&&m.auteur)EcoNotif.a(m.auteur,202,{titre:m.titre,pseudo:me},"ins"+m.id+cle);}catch(e){}
  toast("Vous êtes inscrit."+(veut?" Votre demande de rôle secret est enregistrée.":""));
  F.renderAll();
}
function quitter(m){
  var me=F.myPseudo(), cle=F.cp(me);
  if(!estInscrit(m,me))return;
  if(m.inscriptionsCloses){toast("Les inscriptions sont closes.");return;}
  var ch={}; ch["participants/"+cle]=null; patch(m,ch);
  delete m.participants[cle];
  var p={}; p["vol/"+cle]=null; F.patchPrv(m,p);
  toast("Vous vous êtes retiré."); F.renderAll();
}

/* ---- clôture des inscriptions ----
   Le bouton dit toujours la même chose, qu\u2019un rôle soit attribué ou non :
   c\u2019est la règle du secret. Le tirage lui-même est fait par un client staff
   (voir auto()), puisque le commanditaire n\u2019a pas le droit de lire la liste
   des volontaires. */
function clorelnscriptions(m){
  if(m.inscriptionsCloses){toast("Déjà fait.");return;}
  if(parts(m).length<MIN_PART){toast("Il faut "+MIN_PART+" participants au minimum.");return;}
  if(!window.confirm("Clore les inscriptions ?\nPlus personne ne pourra rejoindre la chasse."))return;
  m.inscriptionsCloses=true; m.statut="en_cours";
  patch(m,{inscriptionsCloses:true, statut:"en_cours"});
  try{
    if(window.EcoNotif)parts(m).forEach(function(p){
      EcoNotif.a(p.pseudo,203,{titre:m.titre},"clo"+m.id+p.k);
    });
  }catch(e){}
  toast(T.CLOS);
  F.renderAll();
  if(F.isStaff())tirer(m);
}

/* ---- tirage du rôle secret ----
   UNE SEULE FOIS : le verrou transactionnel sur tirageFait ne laisse passer
   qu\u2019un client, même si deux membres du staff ouvrent le tableau ensemble. */
function tirer(m){
  if(m.tirageFait)return;
  F.verrou(F.cheminEntree(m)+"/tirageFait").then(function(){
    m.tirageFait=true;
    return Promise.resolve(window.EcoCore.firebaseGet(F.cheminPrive(m)+"/vol"));
  }).then(function(vol){
    var cles=Object.keys(vol||{}).filter(function(c){
      return vol[c]&&m.participants&&m.participants[c];
    });
    if(!cles.length)return null;
    var c=cles[Math.floor(Math.random()*cles.length)];
    var qui=m.participants[c].pseudo;
    var ch={}; ch["antago"]=qui; ch["role/"+c]="antagoniste";
    return F.patchPrv(m,ch).then(function(){
      try{if(window.EcoNotif)EcoNotif.a(qui,204,{titre:m.titre},"ant"+m.id);}catch(e){}
      return qui;
    });
  }).catch(function(e){
    if(F.estDeja(e)){m.tirageFait=true;return;}
    if(window.console)console.error("[tdlc-chasse] tirage",e);
  });
}
/* à chaque chargement, un client staff rattrape les tirages en attente */
function auto(list){
  if(!F.isStaff())return;
  list.forEach(function(m){
    if(m.type==="chasse"&&m.inscriptionsCloses&&!m.tirageFait)tirer(m);
  });
}

/* ---- ouverture d'un indice ---- */
function ouvrirAccroche(m,k){
  var pv=F.prv(m)||{}, a=(pv.accroches||{})[k];
  if(!a)return;
  var sel=$("#tdlc-accqui"), qui=sel?sel.value:"";
  if(!qui){toast("Dites qui l\u2019a obtenu.");return;}
  var date=new Date().toISOString();
  var pp={}; pp["accroches/"+k+"/ouverte"]=true; pp["accroches/"+k+"/par"]=qui; pp["accroches/"+k+"/date"]=date;
  var tt={}; tt["ouvertes/"+k]={fait:a.fait, par:qui, date:date};
  F.patchPrv(m,pp); F.patchTxt(m,tt);
  m.ouvertes=(+m.ouvertes||0)+1; patch(m,{ouvertes:m.ouvertes});
  S.inline=null;
  try{if(window.EcoNotif)EcoNotif.a(qui,205,{titre:m.titre},"acc"+m.id+k);}catch(e){}
  toast("Indice ouvert. Tout le monde le voit maintenant.");
  F.renderAll();
}

/* ---- règlement ----
   Verrou AVANT tout mouvement. COMPROMIS ASSUMÉ, le même que partout ailleurs :
   si un crédit échoue après la prise du verrou, la chasse reste marquée réglée
   sans que l'argent ait bougé — c'est visible et le staff le reprend à la main,
   alors qu'un double versement serait silencieux. */
function rendreGel(m){
  if(!m.gel||m.primeVersee)return Promise.resolve(false);
  return F.verrou(F.cheminEntree(m)+"/primeVersee").then(function(){
    m.primeVersee=true;
    return F.crediter(m.auteur, m.gel);
  }).then(function(){
    patch(m,{primeVersee:true});
    try{if(window.EcoNotif)EcoNotif.a(m.auteur,208,{titre:m.titre,montant:m.gel},"deg"+m.id);}catch(e){}
    return true;
  }).catch(function(e){
    if(F.estDeja(e)){m.primeVersee=true;return false;}
    toast("Le dégel a échoué \u2014 vérifiez le solde du commanditaire.");
    return false;
  });
}

function regler(m){
  if(m.primeVersee){toast("Chasse déjà réglée.");return;}
  if(!F.exigeV2(m))return;
  var pv=F.prv(m);
  if(pv===null){toast("Lecture du privé en cours, réessayez dans un instant.");return;}
  var livree=!!($("#tdlc-livree")&&$("#tdlc-livree").checked);
  var motif=($("#tdlc-motif")&&$("#tdlc-motif").value)||"";
  var justif=($("#tdlc-justif")&&String($("#tdlc-justif").value||"").trim())||"";
  var resume=($("#tdlc-resume")&&String($("#tdlc-resume").value||"").trim())||"";
  var moitie=!!($("#tdlc-moitie")&&$("#tdlc-moitie").checked);
  var demasque=!!motif;
  if(demasque&&!justif){toast("Dites sur quoi vous vous appuyez pour le démasquage.");return;}

  var joues=[];
  document.querySelectorAll(".tdlc-joue").forEach(function(el){
    if(el.checked)joues.push(el.getAttribute("data-p"));
  });
  var antago=pv.antago||"";
  var benef=joues.filter(function(p){ return !(demasque&&antago&&p===antago); });
  var part=benef.length?Math.floor(m.prime/benef.length):0;
  var rendu=(m.gel&&moitie)?Math.floor(m.prime/2):0;
  var gain75=Math.floor(m.prime*PART_ANTAGO);

  var recap=livree
    ? (benef.length+" participant(s) à "+money(part)+(rendu?(", "+money(rendu)+" rendus au référent"):"")+".")
    : ((m.gel?money(m.gel)+" rendus au commanditaire. ":"")+((!demasque&&antago)?(money(gain75)+" à l\u2019antagoniste."):"Personne n\u2019est payé."));
  if(!window.confirm("Clore et payer ?\n"+recap+"\nIrréversible."))return;

  F.verrou(F.cheminEntree(m)+"/primeVersee").then(function(){
    m.primeVersee=true;
    var op=Promise.resolve();
    if(livree){
      benef.forEach(function(p){ op=op.then(function(){return F.crediter(p, part);}); });
      if(rendu)op=op.then(function(){return F.crediter(m.auteur, rendu);});
    }else{
      if(m.gel)op=op.then(function(){return F.crediter(m.auteur, m.gel);});
      if(!demasque&&antago)op=op.then(function(){return F.crediter(antago, gain75);});
    }
    return op;
  }).then(function(){
    var ch={statut:"close", primeVersee:true, livree:livree, demasque:demasque,
            motif:motif, justif:justif, resume:resume};
    joues.forEach(function(p){ ch["participants/"+F.cp(p)+"/joue"]=true; });
    m.statut="close"; m.livree=livree; m.demasque=demasque; m.resume=resume;
    patch(m,ch);
    try{
      if(window.EcoNotif)joues.forEach(function(p){
        EcoNotif.a(p,206,{titre:m.titre},"reg"+m.id+F.cp(p));
      });
    }catch(e){}
    S.drawer=null;
    toast("Chasse close. "+recap);
    F.renderAll();
  }).catch(function(e){
    if(F.estDeja(e)){m.primeVersee=true;toast("Chasse déjà réglée ailleurs \u2014 rien n\u2019a été versé deux fois.");F.renderAll();return;}
    toast("Versement incomplet \u2014 la chasse est marquée réglée, vérifiez les soldes.");
    F.renderAll();
  });
}

/* ===================== EXPORT (pour tdlc-chasse-neuf) ===================== */
window.TDLCarrChasse = { PRIME_MIN:PRIME_MIN, ACCROCHES:ACCROCHES, MIN_PART:MIN_PART, MAX_PART:MAX_PART, T:T };

/* ===================== DÉCLARATION ===================== */
F.type({
  k:"chasse", label:"Chasse à prime", ic:"fi-tr-crosshairs",
  normaliser:normaliser, sub:sub, tags:tags, panel:panel,
  act:act, doo:doo, brancher:brancher, auto:auto
});

})(window.TDLCarr);
