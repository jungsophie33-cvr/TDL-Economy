/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU CARREFOUR · TYPE « MISSION »
   (tdlc-mission.js) — à charger APRÈS tdlc-core.js.

   Une mission est un conflit d'intérêts, ouvert par un INITIATEUR qui y tient
   un intérêt comme les autres et ne possède rien du tout. Mode chill accepté.

   PERSONNE N'ÉCRIT L'HISTOIRE À L'AVANCE. L'initiateur pose les faits acquis,
   ce qu'il ne décidera pas, son propre intérêt, et un appel. Chaque joueur qui
   rejoint écrit le sien : position et enjeu publics, information privée. Le
   créateur ne voit PAS les informations des autres — contrairement au créateur
   d'une marée, qui voit les scellés de ses postes. C'est volontaire : il n'a
   aucun privilège sur une affaire qu'il ne possède pas.

   DEUX CONDITIONS DE LANCEMENT, recalculées à l'affichage et jamais stockées :
     - structurelle, non décochable : au moins un intérêt tenu par un ashlander
       ou un braconneur, parce que ce sont eux qui voient avant que ce soit
       officiel. C'est le verrou de lore du tableau.
     - facultative, cochée par l'initiateur : au moins un intérêt tenu par un
       hors-la-loi QUI N'EST PAS braconneur. Un même joueur ne peut pas remplir
       les deux, la seconde excluant explicitement les braconneurs.
   La mission bascule en cours d'elle-même dès qu'elles sont réunies.

   ARGENT : 50 $ par intérêt effectivement joué, 75 $ à l'initiateur, créés à la
   clôture, quelle que soit l'issue. L'initiateur touche 75 $ au TOTAL, pas en
   plus d'une part. Une mission retirée sans avoir tourné ne paie personne.
   ================================================================== */
(function(F){
"use strict";
if(!F){ if(window.console) console.warn("[tdlc-mission] socle absent."); return; }
var esc=F.esc, escAttr=F.escAttr, money=F.money, ilya=F.ilya, av=F.av, $=F.$;
var S=F.S, patch=F.patch, toast=F.toast;

/* ===================== CONFIG ===================== */
var PART=50, PART_INIT=75, MAX_APPELS=4;

var T={
  REGLE:"Une mission est une situation où plusieurs intérêts s\u2019opposent. Vous posez les faits et votre propre position. Ce que savent les autres, ce sont eux qui l\u2019écrivent.",
  INFO:"Une information est sur par votre personnage et inconnue des autres. L'affaire n'avance qu'en recoupant les informations du groupe. Vous la lâchez en RP si vous voulez, quand vous voulez, voire jamais.",
  GARDE:"Trois règles : elle ne contredit pas les faits acquis, elle reste plausible pour votre personnage, et elle n\u2019engage que lui \u2014 jamais sa famille ni sa bande entière.",
  BAYOU:"Cette mission attend encore quelqu\u2019un du bayou : un ashlander ou un braconneur, qui a vu les choses avant qu\u2019elles deviennent officielles.",
  OMBRE:"Cette mission attend encore quelqu\u2019un de l\u2019ombre."
};

/* ===================== NORMALISATION ===================== */
function lstInt(v){
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
  o.interets=o.interets||{};
  o.besoinOmbre=!!o.besoinOmbre;
  o.payee=!!o.payee;
  o.resume=o.resume||""; o.consequences=o.consequences||"";
  return o;
}
function ints(m){return lstInt(m.interets);}
function tient(m,me){return !!(me&&m.interets&&m.interets[F.cp(me)]);}

/* ---- conditions de lancement, calculées, jamais stockées ---- */
function aBayou(m){return ints(m).some(function(p){return F.estBayou(p.pseudo);});}
function aOmbre(m){return ints(m).some(function(p){return F.estOmbre(p.pseudo);});}
function pretALancer(m){return aBayou(m)&&(!m.besoinOmbre||aOmbre(m));}

/* ===================== RANGÉE ===================== */
function sub(m){ return { sub:(m.zone||"Terrebonne"), qui:m.auteur, quand:"ouverte "+ilya(m.cree) }; }
function tags(m){
  var out=[ints(m).length+" intérêt"+(ints(m).length>1?"s":"")];
  if(m.statut==="ouverte"){
    if(!aBayou(m))out.push("attend le bayou");
    else if(m.besoinOmbre&&!aOmbre(m))out.push("attend l\u2019ombre");
  }
  return out;
}

/* ===================== PANNEAU ===================== */
function panel(m){
  var me=F.myPseudo(), staff=F.isStaff();
  var tx=F.txt(m), pv=(me&&tient(m,me))||staff?F.prv(m):{};
  var vu={me:me, staff:staff, init:(me&&me===m.auteur)};

  var meta=''
    +'<div class="tdlm-m"><span class="tdlm-k">Ouverte par</span><span class="tdlm-v">'+esc(m.auteur||"\u2014")+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">Zone</span><span class="tdlm-v">'+esc(m.zone||"\u2014")+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">Intérêts tenus</span><span class="tdlm-v">'+ints(m).length+'</span></div>'
    +(m.sujet?'<div class="tdlm-m"><span class="tdlm-k">Sujet RP</span><span class="tdlm-v"><a class="tdlm-lien" href="'+escAttr(m.sujet)+'" target="_blank" rel="noopener">Ouvrir le sujet \u2192</a></span></div>':'');

  var attente="";
  if(m.statut==="ouverte"){
    var quoi=!aBayou(m)?T.BAYOU:((m.besoinOmbre&&!aOmbre(m))?T.OMBRE:"");
    if(quoi)attente='<div class="tdlm-reqbanner"><p class="tdlm-hsec">\u2691 Pas encore lancée</p>'
      +'<div class="tdlm-reqrow">'+esc(quoi)+'</div></div>';
  }

  return ''
    +'<button class="tdlm-dret" data-back>\u2190 Retour au tableau</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">'+esc(m.titre)+'</span>'+F.stamp(m)+'</div>'
    +'<div class="tdlm-dp-body">'
      +'<div class="tdlm-dp-hd"><div class="tdlm-dp-meta">'+meta+'</div>'+attente+'</div>'
      +blocContexte(tx)
      +blocInterets(m,tx,pv,vu)
      +blocAppel(m,tx)
      +blocBilan(m)
      +drawer(m,vu)
    +'</div>'
    +actionbar(m,vu);
}

function bloc(titre,corps){
  if(!corps)return "";
  return '<div class="tdlm-sec"><p class="tdlm-hsec">'+esc(titre)+'</p><div class="tdlm-prose">'+corps+'</div></div>';
}
function blocContexte(tx){
  if(tx===null)return bloc("Le contexte",'<span class="tdlm-todo">Chargement\u2026</span>');
  return bloc("Le contexte", tx.contexte?esc(tx.contexte):'<span class="tdlm-todo">\u2014</span>')
    +bloc("Les acteurs", tx.acteurs?esc(tx.acteurs):"")
    +bloc("Ce qui est acquis", tx.faits?esc(tx.faits):"")
    +bloc("Les intérêts affichés", tx.officiels?esc(tx.officiels):"")
    +bloc("Ce que l\u2019initiateur ne décidera pas", tx.ouvert?esc(tx.ouvert):"");
}

/* ---- les intérêts : position et enjeu publics, information privée ---- */
function blocInterets(m,tx,pv,vu){
  var l=ints(m);
  if(!l.length)return '<div class="tdlm-sec"><p class="tdlm-hsec">Les intérêts en présence</p>'
    +'<div class="tdlm-prose tdlm-todo">Personne pour l\u2019instant.</div></div>';
  var pub=(tx&&tx.interets)||{};
  var corps=l.map(function(p){
    var d=pub[p.k]||{};
    var mien=(vu.me&&p.pseudo===vu.me);
    var info="";
    if((mien||vu.staff)&&pv&&pv.info&&pv.info[p.k]){
      info='<div class="tdlm-prose tdlm-todo"><b>'+(mien?"Votre information":"Information (staff)")+' :</b> '+esc(pv.info[p.k])+'</div>';
    }
    return '<div class="tdlm-cadre">'
      +'<div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">'+esc(p.pseudo)+'</span>'
      +(m.statut==="close"?'<span class="tdlm-r">'+(p.joue?"a joué":"absent")+'</span>':'')+'</div>'
      +'<div class="tdlm-person">'+av(p.pseudo)+'<span class="tdlm-pname">'+esc(d.position||"\u2014")+'</span></div>'
      +(d.enjeu?'<div class="tdlm-prose"><b>Ce qu\u2019il veut :</b> '+esc(d.enjeu)+'</div>':'')
      +info+'</div>';
  }).join("");
  return '<div class="tdlm-sec"><p class="tdlm-hsec">Les intérêts en présence</p></div>'+corps;
}

function blocAppel(m,tx){
  if(m.statut==="close"||m.statut==="retiree")return "";
  var a=(tx&&tx.appel)?F.vt(tx.appel):[];
  if(!a.length)return "";
  var corps='<ul class="tdlm-clean">'+a.map(function(x){
    return '<li class="tdlm-puce">'+esc(x)+'</li>';
  }).join("")+'</ul>';
  return '<div class="tdlm-sec"><p class="tdlm-hsec">On cherche encore</p>'
    +'<div class="tdlm-prose tdlm-todo">Ce ne sont pas des rôles à tenir : c\u2019est une place qu\u2019on vous laisse. Qui est votre personnage et ce qu\u2019il sait, c\u2019est vous qui l\u2019écrivez.</div>'
    +corps+'</div>';
}

function blocBilan(m){
  if(m.statut!=="close")return "";
  return bloc("Ce qui s\u2019est passé", m.resume?esc(m.resume):'<span class="tdlm-todo">\u2014</span>')
    +bloc("Ce que ça déplace", m.consequences?esc(m.consequences):'<span class="tdlm-todo">\u2014</span>');
}

/* ---- barre d'action ---- */
function actionbar(m,vu){
  var roles=[], btns="";
  var vivant=(m.statut==="ouverte"||m.statut==="en_cours");
  if(vu.init&&vivant){
    roles.push("Initiateur");
    btns+='<button class="tdlm-abtn" data-act="sujet">'+(m.sujet?"Modifier le sujet RP":"Renseigner le sujet RP")+'</button>';
  }
  if(vu.staff){
    roles.push("Staff");
    if(m.statut==="en_cours")btns+='<button class="tdlm-abtn prim" data-act="clore">Clore et payer</button>';
    if(vivant)btns+='<button class="tdlm-abtn warn" data-act="retirer">Retirer</button>';
    btns+='<button class="tdlm-abtn warn" data-act="delete">Supprimer</button>';
  }
  if(!F.estConnecte()){roles.push("Invité");btns=btns||'<span class="tdlm-idle">Connectez-vous pour tenir un intérêt.</span>';}
  else if(vu.me&&tient(m,vu.me)){
    if(!vu.init)roles.push("Partie prenante");
    if(m.statut==="ouverte"&&!vu.init)btns+='<button class="tdlm-abtn" data-act="quitter">Me retirer</button>';
  }
  else if(vivant&&vu.me){
    roles.push("Visiteur");
    btns+='<button class="tdlm-abtn prim" data-act="rejoindre">Tenir un intérêt</button>';
  }
  if(!roles.length)roles.push("Visiteur");
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+roles.join(" \u27e1 ")+'</span>'+btns+'</div>';
}

/* ---- tiroirs ---- */
function drawer(m,vu){
  if(S.inline==="sujet"){
    return '<div class="tdlm-drawer on"><h4>Sujet RP de la mission</h4>'
      +'<input type="text" id="tdlc-msujet" value="'+escAttr(m.sujet)+'" placeholder="https://thedrownedlands.forumactif.com/t\u2026">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="msujetok">Enregistrer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="rejoindre"){
    return '<div class="tdlm-drawer on"><h4>Tenir un intérêt</h4>'
      +'<label class="tdlm-fl">Votre position \u2014 qui est votre personnage ici (visible de tous)</label>'
      +'<input type="text" id="tdlc-mpos" placeholder="Le neveu des Trinh, le capitaine qui accostait là\u2026">'
      +'<label class="tdlm-fl">Votre enjeu \u2014 ce qu\u2019il veut ou ce qu\u2019il risque de perdre (visible de tous)</label>'
      +'<textarea id="tdlc-menj"></textarea>'
      +'<label class="tdlm-fl">Votre information \u2014 ce qu\u2019il sait et que les autres ignorent (privée)</label>'
      +'<textarea id="tdlc-minf"></textarea>'
      +'<div class="tdlm-prose tdlm-todo">'+esc(T.INFO)+'</div>'
      +'<div class="tdlm-prose tdlm-todo">'+esc(T.GARDE)+'</div>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="rejoindreok">Rejoindre</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="clore"&&vu.staff){
    var lignes=ints(m).map(function(p){
      return '<label class="tdlm-chk"><input type="checkbox" class="tdlc-mjoue" data-p="'+escAttr(p.pseudo)+'" checked> '+esc(p.pseudo)+'</label>';
    }).join("");
    return '<div class="tdlm-drawer on"><h4>Clore la mission</h4>'
      +'<label class="tdlm-fl">Ce qui s\u2019est passé</label><textarea id="tdlc-mres">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Ce que ça déplace (jauge, projet, famille, relation)</label>'
      +'<textarea id="tdlc-mcons">'+esc(m.consequences)+'</textarea>'
      +'<label class="tdlm-fl">Qui a joué</label><div class="tdlm-row">'+(lignes||'<span class="tdlm-idle">Personne.</span>')+'</div>'
      +'<div class="tdlm-prose tdlm-todo">Les informations que les joueurs ont choisi de garder pour eux restent privées : se taire est un choix de jeu.</div>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="cloreok">Clore et payer</button>'
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

/* ===================== ACTIONS ===================== */
function act(k,m){
  if(k==="sujet"){S.inline="sujet";S.drawer=null;F.renderStage();return;}
  if(k==="rejoindre"){S.drawer="rejoindre";S.inline=null;F.renderStage();return;}
  if(k==="clore"){S.drawer="clore";S.inline=null;F.renderStage();return;}
  if(k==="quitter"){quitter(m);return;}
  if(k==="retirer"){
    if(!window.confirm("Retirer cette mission ?\nPersonne n\u2019est payé si elle n\u2019a pas tourné."))return;
    m.statut="retiree"; patch(m,{statut:"retiree"});
    toast("Mission retirée."); F.renderAll(); return;
  }
  if(k==="delete"){
    if(!window.confirm("Supprimer définitivement \u00ab "+m.titre+" \u00bb ?"))return;
    F.supprimer(m); toast("Mission supprimée."); F.renderAll(); return;
  }
}
function doo(k,m){
  if(k==="cancel"){S.drawer=null;S.inline=null;F.renderStage();return;}
  if(k==="rejoindreok"){rejoindre(m);return;}
  if(k==="msujetok"){
    var el=$("#tdlc-msujet"), url=el?String(el.value||"").trim():"";
    m.sujet=url; patch(m,{sujet:url}); S.inline=null;
    toast("Sujet enregistré."); F.renderStage(); return;
  }
  if(k==="cloreok"){clore(m);return;}
}

/* ---- rejoindre ----
   L'intérêt naît en trois morceaux, dans les trois nœuds : la ligne légère, la
   partie publique dans le texte, l'information dans le privé. Les trois bumpent
   la même sentinelle, donc les autres onglets voient arriver l'intérêt sans
   rechargement. */
function rejoindre(m){
  var me=F.myPseudo();
  if(!me){toast("Connectez-vous.");return;}
  if(!F.exigeV2(m))return;
  if(tient(m,me)){toast("Vous tenez déjà un intérêt ici.");return;}
  var pos=($("#tdlc-mpos")&&String($("#tdlc-mpos").value||"").trim())||"";
  var enj=($("#tdlc-menj")&&String($("#tdlc-menj").value||"").trim())||"";
  var inf=($("#tdlc-minf")&&String($("#tdlc-minf").value||"").trim())||"";
  if(!pos||!enj){toast("Il faut au moins une position et un enjeu.");return;}

  var cle=F.cp(me), date=new Date().toISOString();
  var ch={}; ch["interets/"+cle]={pseudo:me, date:date, joue:false};
  var tt={}; tt["interets/"+cle]={position:pos, enjeu:enj};
  var pp={}; if(inf)pp["info/"+cle]=inf;

  m.interets[cle]={pseudo:me,date:date,joue:false};
  /* la bascule en cours est calculée MAINTENANT, avec le nouvel intérêt */
  if(m.statut==="ouverte"&&pretALancer(m)){ ch.statut="en_cours"; m.statut="en_cours"; }
  patch(m,ch); F.patchTxt(m,tt); if(inf)F.patchPrv(m,pp);

  S.drawer=null;
  try{
    if(window.EcoNotif){
      if(m.auteur&&m.auteur!==me)EcoNotif.a(m.auteur,208,{titre:m.titre,pseudo:me},"int"+m.id+cle);
      if(ch.statut==="en_cours")ints(m).forEach(function(p){
        EcoNotif.a(p.pseudo,207,{titre:m.titre},"lan"+m.id+p.k);
      });
    }
  }catch(e){}
  toast(ch.statut==="en_cours"?"Vous rejoignez la mission \u2014 elle est lancée.":"Vous rejoignez la mission.");
  F.renderAll();
}
function quitter(m){
  var me=F.myPseudo(), cle=F.cp(me);
  if(!tient(m,me))return;
  if(m.statut!=="ouverte"){toast("La mission est lancée : on ne se retire plus du tableau, on le joue en RP.");return;}
  var ch={}; ch["interets/"+cle]=null; patch(m,ch);
  var tt={}; tt["interets/"+cle]=null; F.patchTxt(m,tt);
  var pp={}; pp["info/"+cle]=null; F.patchPrv(m,pp);
  delete m.interets[cle];
  toast("Vous vous êtes retiré."); F.renderAll();
}

/* ---- clôture et paie ---- */
function clore(m){
  if(m.payee){toast("Mission déjà réglée.");return;}
  if(!F.exigeV2(m))return;
  var res=($("#tdlc-mres")&&String($("#tdlc-mres").value||"").trim())||"";
  var cons=($("#tdlc-mcons")&&String($("#tdlc-mcons").value||"").trim())||"";
  if(!res){toast("Écrivez au moins ce qui s\u2019est passé.");return;}

  var joues=[];
  document.querySelectorAll(".tdlc-mjoue").forEach(function(el){
    if(el.checked)joues.push(el.getAttribute("data-p"));
  });
  var initJoue=(m.auteur&&joues.indexOf(m.auteur)>=0);
  var autres=joues.filter(function(p){return p!==m.auteur;});
  var total=autres.length*PART+(initJoue?PART_INIT:0);
  if(!window.confirm("Clore et payer ?\n"+autres.length+" participant(s) à "+money(PART)
    +(initJoue?(", "+money(PART_INIT)+" à l\u2019initiateur"):"")+" \u2014 "+money(total)+" au total.\nIrréversible."))return;

  /* verrou AVANT tout crédit : deux clôtures simultanées paieraient deux fois */
  F.verrou(F.cheminEntree(m)+"/payee").then(function(){
    m.payee=true;
    var op=Promise.resolve();
    autres.forEach(function(p){ op=op.then(function(){return F.crediter(p, PART);}); });
    if(initJoue)op=op.then(function(){return F.crediter(m.auteur, PART_INIT);});
    return op;
  }).then(function(){
    var ch={statut:"close", payee:true, resume:res, consequences:cons};
    joues.forEach(function(p){ ch["interets/"+F.cp(p)+"/joue"]=true; });
    m.statut="close"; m.resume=res; m.consequences=cons;
    patch(m,ch);
    try{
      if(window.EcoNotif)joues.forEach(function(p){
        var g=(p===m.auteur)?PART_INIT:PART;
        EcoNotif.a(p,209,{titre:m.titre,montant:g},"mcl"+m.id+F.cp(p));
      });
    }catch(e){}
    S.drawer=null;
    toast("Mission close. "+money(total)+" distribués.");
    F.renderAll();
  }).catch(function(e){
    if(F.estDeja(e)){m.payee=true;toast("Mission déjà réglée ailleurs \u2014 rien n\u2019a été versé deux fois.");F.renderAll();return;}
    toast("Versement incomplet \u2014 la mission est marquée payée, vérifiez les soldes.");
    F.renderAll();
  });
}

/* ===================== OUVERTURE ===================== */
function formOuverture(){
  var me=F.myPseudo();
  var appels="";
  for(var i=0;i<MAX_APPELS;i++){
    appels+='<label class="tdlm-fl">Appel '+(i+1)+(i<2?'':' (facultatif)')+'</label>'
      +'<input type="text" id="tdlc-nap'+i+'" placeholder="Une personne utilisant ce quai naguère et qui va le perdre\u2026">';
  }
  return '<div class="tdlm-dpanel">'
    +'<button class="tdlm-dret" data-mneuf="cancel">\u2190 Retour au tableau</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">Ouvrir une mission</span></div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-drawer on" style="border-top:none">'
      +'<div class="tdlm-prose">'+esc(T.REGLE)+'</div>'
      +'<label class="tdlm-fl">Titre</label><input type="text" id="tdlc-mtitre" placeholder="Ex. : Le quai des Trinh">'
      +'<label class="tdlm-fl">Zone (une zone, pas une adresse)</label>'
      +'<input type="text" id="tdlc-mzone" placeholder="Cocodrie et le bas de la route">'
      +'<label class="tdlm-fl">Le contexte : la situation et sa problématique</label><textarea id="tdlc-mctx"></textarea>'
      +'<label class="tdlm-fl">Les acteurs en présence</label><textarea id="tdlc-mact"></textarea>'
      +'<label class="tdlm-fl">Les faits connus de tous</label><textarea id="tdlc-mfaits"></textarea>'
      +'<label class="tdlm-fl">Les intérêts officiellement affichés par chacun</label><textarea id="tdlc-moff"></textarea>'
      +'<label class="tdlm-fl">Ce que vous ne déciderez pas</label><textarea id="tdlc-mouv" placeholder="Qui est derrière la société. Pourquoi ils ont vendu. Ce que devient le quai."></textarea>'
      +'<div class="tdlm-prose">Votre propre intérêt dans l\u2019affaire. Vous le tenez comme les autres : vous ne possédez pas la mission.</div>'
      +'<label class="tdlm-fl">Votre position</label><input type="text" id="tdlc-mipos">'
      +'<label class="tdlm-fl">Votre enjeu</label><textarea id="tdlc-mienj"></textarea>'
      +'<label class="tdlm-fl">Votre information (cachée)</label><textarea id="tdlc-miinf"></textarea>'
      +'<div class="tdlm-prose">L\u2019appel : exemples d\u2019intérêts concernés par cette affaire. Les joueurs sont libres d\u2019en proposer d\u2019autres.</div>'
      +appels
      +'<label class="tdlm-fl tdlm-chkline"><input type="checkbox" id="tdlc-mombre"> Cette affaire a besoin d\u2019un hors-la-loi.</label>'
      +'<div class="tdlm-prose tdlm-todo">Un hors-la-loi qui ne soit pas braconneur. La mission attendra qu\u2019un tel intérêt soit tenu pour être lancée \u2014 en plus de l\u2019ashlander ou du braconneur, toujours requis.</div>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-mneuf="ok">Afficher la mission</button>'
      +'<button class="tdlm-abtn" data-mneuf="cancel">Annuler</button></div>'
      +(me?'':'<div class="tdlm-prose tdlm-todo">Connectez-vous pour ouvrir une mission.</div>')
    +'</div></div></div>';
}

function creer(){
  var g=function(id){var e=$(id);return e?String(e.value||"").trim():"";};
  var me=F.myPseudo();
  if(!me){toast("Connectez-vous.");return;}
  var titre=g("#tdlc-mtitre");
  if(!titre){toast("Donnez un titre à la mission.");return;}
  var ctx=g("#tdlc-mctx");
  if(!ctx){toast("Écrivez le contexte : c\u2019est ce qui donne aux autres une raison d\u2019entrer.");return;}
  var pos=g("#tdlc-mipos"), enj=g("#tdlc-mienj"), inf=g("#tdlc-miinf");
  if(!pos||!enj){toast("Votre propre intérêt a besoin d\u2019une position et d\u2019un enjeu.");return;}

  var appel=[];
  for(var i=0;i<MAX_APPELS;i++){ var a=g("#tdlc-nap"+i); if(a)appel.push(a); }
  if(appel.length<2){toast("Laissez au moins deux appels : une mission sans place pour les autres n\u2019en est pas une.");return;}

  var cle=F.cp(me), date=new Date().toISOString();
  var ombre=!!($("#tdlc-mombre")&&$("#tdlc-mombre").checked);
  var id=F.newId("mi");
  var inter={}; inter[cle]={pseudo:me, date:date, joue:false};
  var fiche={ type:"mission", titre:titre, zone:g("#tdlc-mzone"), auteur:me,
    interets:inter, besoinOmbre:ombre, payee:false,
    resume:"", consequences:"", statut:"ouverte", sujet:"", cree:date };
  var tint={}; tint[cle]={position:pos, enjeu:enj};
  var texte={ contexte:ctx, acteurs:g("#tdlc-mact"), faits:g("#tdlc-mfaits"),
    officiels:g("#tdlc-moff"), ouvert:g("#tdlc-mouv"), appel:appel, interets:tint };
  var prive=inf?{info:(function(){var o={};o[cle]=inf;return o;})()}:{};

  F.creerEntree(id, fiche, texte, prive).then(function(ok){
    if(!ok){toast("Ouverture échouée.");return;}
    S.statut="tous"; S.sel=id;
    try{if(window.EcoNotif)EcoNotif.tous(207,{titre:titre},"mi"+id);}catch(e){}
    toast("Mission affichée. Elle sera lancée dès qu\u2019un ashlander ou un braconneur y tiendra un intérêt.");
    F.renderAll();
  });
}

F.vue({
  k:"nouvelle-mission", label:"\u271a Ouvrir une mission",
  visible:function(){return F.estConnecte();},
  compte:function(){return null;},
  render:formOuverture,
  brancher:function(stage){
    stage.querySelectorAll("[data-mneuf]").forEach(function(el){
      el.onclick=function(){
        if(el.getAttribute("data-mneuf")==="ok")creer();
        else {S.statut="tous";F.renderAll();}
      };
    });
  }
});

/* ===================== DÉCLARATION ===================== */
F.type({
  k:"mission", label:"Mission", ic:"fi-tr-users-alt",
  normaliser:normaliser, sub:sub, tags:tags, panel:panel,
  act:act, doo:doo
});

})(window.TDLCarr);
