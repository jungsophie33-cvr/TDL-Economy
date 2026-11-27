/* ==================================================================
   THE DROWNED LANDS — PANNEAU DES ENQUÊTES · FICHIER 4/4 : ACTIONS
   ------------------------------------------------------------------
   Écritures (TDLBase), clôture à versement IDEMPOTENT (carte
   verses/ : on marque AVANT de créditer, on dé-marque si le crédit
   échoue → aucun double versement possible), archivage Sophie-OS
   (génération du post, envoi quick_reply, purge du nœud), veille,
   lecture des archives du topic, boot.
   ================================================================== */
(function(){
"use strict";

var CFG=window.TDLE_CFG, T=CFG.TEXTES, D=window.TDLE_DATA, R=window.TDLE_R;
var S=R.S, A=R.A;
var ACT={};

/* ===================== ÉCRITURES ===================== */
function persistFull(a){ return window.TDLBase.ecrireEntree(CFG.NODE, a.id, D.serialize(a), "création de "+(a.cote||a.titre)); }
function patch(a, champs){ return window.TDLBase.ecrire(CFG.NODE, a.id, champs, "modification de "+(a.cote||a.titre)); }
ACT.patch=patch;
/* Registre des écritures optimistes en attente : absorber() les
   ré-applique sur la version distante, sinon un refresh ferait
   « disparaître » une modification juste saisie avant que la file
   ne la rejoue. vidé dès que la file est vide. */
var PEND={};
ACT.ecr=function(a, champs){
  var p=PEND[a.id]=PEND[a.id]||{}, k;
  for(k in champs){ if(champs.hasOwnProperty(k)) p[k]=champs[k]; }
  return patch(a, champs);
};
function purgePendSiVide(){
  try{ if(window.TDLBase.enAttente()===0) PEND={}; }catch(e){}
}
function appliquerPend(a){
  var p=PEND[a.id]; if(!p) return;
  Object.keys(p).forEach(function(chemin){
    var val=p[chemin], parts=chemin.split("/");
    if(parts[0]==="sujets"&&parts.length===3&&parts[2]==="membres"||parts[0]==="valides"){
      var l=a[parts[0]]; if(!l) return;
      var cle=parts[2]||parts[1];
      if(val===null) a[parts[0]]=l.filter(function(x){ return x.k!==cle&&x!==cle; });
      return;
    }
    var champ=parts[0], cle=parts[1];
    if(!a[champ]) return;
    if(val===null) a[champ]=a[champ].filter(function(x){ return x.k!==cle; });
    else{
      var existe=a[champ].some(function(x){ return x.k===cle; });
      if(!existe){ var e=Object.assign({k:cle}, val); a[champ].push(e); }
    }
  });
}
function exigeV2(a){
  if(a&&a.schema===CFG.SCHEMA) return true;
  R.toast(T.toast.formatAncien);
  return false;
}
function staffNom(){ return D.myPseudo()||"Staff"; }

/* ===================== BANDEAU D'ÉCHEC ===================== */
function majBandeau(n){
  var el=document.getElementById("tdle-echec");
  if(!n){ if(el) el.remove(); purgePendSiVide(); return; }
  if(!el){ el=document.createElement("div"); el.id="tdle-echec"; el.className="tdle-echec"; document.body.appendChild(el); }
  var pl=(n>1)?"s":"", sg=(n>1)?"s":"";
  el.innerHTML='<span>'+T.echec1+n+T.echec2+pl+' non enregistrée'+sg+'. '+D.esc("Ne rechargez pas la page.")+'</span>'
    +'<button class="tdle-abtn prim" data-rejouer>'+T.echecBtn+'</button>';
  var b=el.querySelector("[data-rejouer]");
  b.onclick=function(){
    b.disabled=true; b.textContent=T.echecEnvoi;
    window.TDLBase.reessayer().then(function(){
      var reste=window.TDLBase.enAttente();
      majBandeau(reste);
      R.toast(reste?T.toast.resteEchec+reste+T.toast.resteEchec2:T.toast.ecrits);
    });
  };
}

/* ===================== LIENS BILATÉRAUX ===================== */
function ajouterLien(a,targetId,note){
  if(!a.liens.some(function(l){ return l.k===targetId; })) a.liens.push({k:targetId,note:note||"",par:""});
  var ch={}; ch["liens/"+targetId]={note:note||""}; ACT.ecr(a,ch);
  var b=R.parId(targetId);
  if(b&&!b.archive&&b.schema===CFG.SCHEMA){
    if(!b.liens.some(function(l){ return l.k===a.id; })) b.liens.push({k:a.id,note:note||"",par:""});
    var cb={}; cb["liens/"+a.id]={note:note||""}; ACT.ecr(b,cb);
  }
}

/* ===================== CÂBLAGE ===================== */
ACT.brancher=function(stage){
  stage=stage||R.$("#tdle-stage"); if(!stage) return;
  stage.querySelectorAll("[data-sel]").forEach(function(el){ el.onclick=function(){ S.sel=el.getAttribute("data-sel"); S.onglet="resume"; S.drawer=null; S.inline=null; S.mob="detail"; R.renderStage(); }; });
  stage.querySelectorAll("[data-open]").forEach(function(el){ el.onclick=function(){ S.sel=el.getAttribute("data-open"); S.onglet="resume"; S.drawer=null; S.inline=null; S.vue="dossiers"; S.mob="detail"; R.syncVue(); R.renderStage(); }; });
  stage.querySelectorAll("[data-tab]").forEach(function(el){ el.onclick=function(){ S.onglet=el.getAttribute("data-tab"); S.drawer=null; S.inline=null; R.renderStage(); }; });
  stage.querySelectorAll("[data-type]").forEach(function(el){ el.onclick=function(){ S.type=el.getAttribute("data-type"); if(S.statut==="demandes"&&!R.estStaffCourant()) S.statut="tous"; R.fixSel(); R.renderAll(); }; });
  stage.querySelectorAll("[data-goto]").forEach(function(el){ el.onclick=function(){
    var id=el.getAttribute("data-goto");
    if(!R.parId(id)){ R.toast(T.toast.introuvableLien); return; }
    S.sel=id; S.type="tous"; S.statut="tous"; S.onglet="resume"; R.renderAll(); }; });
  var back=stage.querySelector("[data-back]"); if(back) back.onclick=function(){ S.mob="liste"; R.renderStage(); };
  stage.querySelectorAll("[data-val]").forEach(function(el){ el.onchange=function(){
    var a=R.parId(S.sel), nm=el.getAttribute("data-val");
    if(!a||!exigeV2(a)){ el.checked=!el.checked; return; }
    var ch={}; ch["valides/"+D.cp(nm)]=el.checked?nm:null;
    if(el.checked){ if(a.valides.indexOf(nm)<0) a.valides.push(nm); }
    else a.valides=a.valides.filter(function(x){ return x!==nm; });
    ACT.ecr(a,ch); }; });
  function retirer(attr, champ, apres){
    stage.querySelectorAll("["+attr+"]").forEach(function(el){ el.onclick=function(){
      var a=R.parId(S.sel), k=el.getAttribute(attr);
      if(!a||!exigeV2(a)) return;
      if(apres&&apres.confirme&&!apres.confirme(a,k)) return;
      a[champ]=a[champ].filter(function(x){ return x.k!==k; });
      var ch={}; ch[champ+"/"+k]=null; ACT.ecr(a,ch);
      if(apres&&apres.message) R.toast(apres.message);
      R.renderStage(); }; });
  }
  retirer("data-delrole","roles");
  retirer("data-delpart","particularites");
  retirer("data-delel","elements");
  retirer("data-delchr","chrono");
  retirer("data-delsujet","sujets",{message:T.toast.sujetRetire,confirme:function(a,k){
    var s=a.sujets.filter(function(x){ return x.k===k; })[0];
    return !!s&&window.confirm(T.confirmes.retirerSujet+D.cleanTitre(s)+T.confirmes.retirerSujet2); }});
  stage.querySelectorAll("[data-dellien]").forEach(function(el){ el.onclick=function(){
    var a=R.parId(S.sel), tid=el.getAttribute("data-dellien");
    if(!a||!exigeV2(a)) return;
    a.liens=a.liens.filter(function(l){ return l.k!==tid; });
    var ch={}; ch["liens/"+tid]=null; ACT.ecr(a,ch);
    var b=R.parId(tid);
    if(b&&!b.archive&&b.schema===CFG.SCHEMA){ b.liens=b.liens.filter(function(l){ return l.k!==a.id; }); var cb={}; cb["liens/"+a.id]=null; ACT.ecr(b,cb); }
    R.toast(T.toast.lienRetire); R.renderStage(); }; });
  stage.querySelectorAll("[data-valref]").forEach(function(el){ el.onclick=function(){
    var a=R.parId(S.sel), m=el.getAttribute("data-valref");
    if(!a) return;
    a.referent=m; a.demandesReferent=[];
    patch(a,{referent:m, demandesReferent:null});
    R.toast(m+T.toast.refValide); R.renderAll(); }; });
  stage.querySelectorAll("[data-vallien]").forEach(function(el){ el.onclick=function(){
    var a=R.parId(S.sel), tid=el.getAttribute("data-vallien");
    if(!a||!exigeV2(a)) return;
    var dm=a.demandesLien.filter(function(l){ return l.k===tid; })[0];
    ajouterLien(a,tid,dm?dm.note:"");
    a.demandesLien=a.demandesLien.filter(function(l){ return l.k!==tid; });
    var ch={}; ch["demandesLien/"+tid]=null; ACT.ecr(a,ch);
    R.toast(T.toast.lienValide); R.renderStage(); }; });
  stage.querySelectorAll("[data-act]").forEach(function(el){ el.onclick=function(){ act(el.getAttribute("data-act")); }; });
  stage.querySelectorAll("[data-do]").forEach(function(el){ el.onclick=function(){ doo(el.getAttribute("data-do")); }; });
};

/* ===================== ACT (boutons de la barre) ===================== */
function notif(fn){ try{ if(window.EcoNotif) fn(window.EcoNotif); }catch(e){} }
function act(k){
  if(k==="migrer"){ lancerMigration(); return; }
  var a=R.parId(S.sel); if(!a&&k!=="new") return;
  if(k==="demander"){
    if(a.cloturee){ R.toast(T.toast.close); return; }
    var moi=D.myPseudo(); if(!moi){ R.toast(T.toast.connexionReq); return; }
    if(!exigeV2(a)) return;
    if(a.demandesReferent.indexOf(moi)<0) a.demandesReferent.push(moi);
    var chd={}; chd["demandesReferent/"+D.cp(moi)]=moi; ACT.ecr(a,chd);
    notif(function(N){ N.staff(CFG.NOTIFS.demandeReferent,{pseudo:moi,titre:a.titre},"ref"+a.id+"_"+moi); });
    R.toast(T.toast.demandeRefOk); R.renderStage();
  }
  else if(k==="rp"){ if(a.cloturee){ R.toast(T.toast.close); return; } if(!D.estMembre()){ R.toast(T.toast.connexionReq); return; } S.drawer="rp"; S.inline=null; R.renderStage(); }
  else if(k==="askclose"){
    if(a.cloturee){ R.toast(T.toast.close); return; }
    if(!a.valides.length){ R.toast(T.toast.clotureRefuse); return; }   /* garde : aucun participant validé */
    a.demandeCloture=true; patch(a,{demandeCloture:true});
    notif(function(N){
      var dc=R.participants(a).slice();
      if(a.referent&&dc.indexOf(a.referent)<0) dc.push(a.referent);
      N.a(dc,CFG.NOTIFS.clotureParticipants,{titre:a.titre},"val"+a.id);
      N.staff(CFG.NOTIFS.clotureStaff,{titre:a.titre},"vals"+a.id);
    });
    R.toast(T.toast.clotureOk); R.renderStage();
  }
  else if(k==="addel"){ S.inline=S.inline==="element"?null:"element"; R.renderStage(); }
  else if(k==="addpart"){ S.inline=S.inline==="particularite"?null:"particularite"; R.renderStage(); }
  else if(k==="addchr"){ S.inline=S.inline==="chrono"?null:"chrono"; R.renderStage(); }
  else if(k==="addrole"){ S.inline=S.inline==="role"?null:"role"; R.renderStage(); }
  else if(k==="addlien"){ S.inline=S.inline==="lien"?null:"lien"; R.renderStage(); }
  else if(k==="edit"){ S.drawer=S.drawer==="edit"?null:"edit"; S.inline=null; R.renderStage(); }
  else if(k==="cold"){ a.coldcase=!a.coldcase; patch(a,{coldcase:a.coldcase}); R.toast(a.coldcase?T.toast.coldOk:T.toast.coldKo); R.renderAll(); }
  else if(k==="intrigue"){
    a.intrigue=!a.intrigue; if(a.intrigue){ a.referent=null; a.demandesReferent=[]; }
    var chi={intrigue:a.intrigue}; if(a.intrigue){ chi.referent=null; chi.demandesReferent=null; }
    patch(a,chi); R.toast(a.intrigue?T.toast.intrOk:T.toast.intrKo); R.renderAll();
  }
  else if(k==="ref"){
    a.referent=a.referent?null:(D.myPseudo()||null); if(a.referent) a.demandesReferent=[];
    var chr={referent:a.referent}; if(a.referent) chr.demandesReferent=null;
    patch(a,chr); R.toast(a.referent?T.toast.refAssignOk:T.toast.refRetire); R.renderAll();
  }
  else if(k==="close"){ cloturer(a); }
  else if(k==="delete"){ supprimer(a); }
  else if(k==="archiver"){ archiver(a); }
  else if(k==="finaliser"){ finaliserArchive(a); }
  else if(k==="new"){ creerAffaire(); }
}

/* ===================== DOO (formulaires) ===================== */
function val(id){ return ((R.$(id)||{}).value||""); }
function doo(k){
  var a=R.parId(S.sel);
  if(k==="cancel"){ S.drawer=null; S.inline=null; R.renderStage(); return; }
  if(!a) return;
  if(k==="rpok"){
    var joins=[]; document.querySelectorAll("[data-joinurl]:checked").forEach(function(x){ joins.push(x.getAttribute("data-joinurl")); });
    var url=val("#tdle-rpurl").trim(), moi=D.myPseudo();
    if(!moi){ R.toast(T.toast.connexionReq); return; }
    if(!joins.length&&!url){ R.toast(T.toast.verifVide); return; }
    if(!exigeV2(a)) return;
    var chs={};
    joins.forEach(function(u){
      var s=a.sujets.filter(function(x){ return x.url===u; })[0];
      if(!s||!s.k) return;
      if(s.membres.indexOf(moi)<0) s.membres.push(moi);
      chs["sujets/"+s.k+"/membres/"+D.cp(moi)]=moi;
    });
    if(url){
      var ks=D.cle(), mb={}; mb[D.cp(moi)]=moi;
      var ti=D.cleanTitre({url:url});
      a.sujets.push({k:ks,url:url,titre:ti,membres:[moi]});
      chs["sujets/"+ks]={url:url,titre:ti,membres:mb};
    }
    ACT.ecr(a,chs);
    notif(function(N){
      if(a.referent) N.a(a.referent,CFG.NOTIFS.implication,{pseudo:moi,titre:a.titre},"insc"+a.id+"_"+moi);
      N.staff(CFG.NOTIFS.implicationStaff,{pseudo:moi,titre:a.titre},"inscs"+a.id+"_"+moi);
    });
    S.drawer=null; S.onglet="liens"; R.toast(T.toast.inscrit); R.renderStage();
  }
  if(k==="elok"){
    var t=val("#tdle-elin").trim(); if(!t){ R.toast(T.toast.rienAAjouter); return; } if(!exigeV2(a)) return;
    var ke=D.cle(), ve={txt:t,par:staffNom(),date:new Date().toISOString()};
    a.elements.push(Object.assign({k:ke},ve));
    var che={}; che["elements/"+ke]=ve; ACT.ecr(a,che);
    notif(function(N){ var dst=R.participants(a).slice();
      if(a.referent&&dst.indexOf(a.referent)<0) dst.push(a.referent);
      N.a(dst,CFG.NOTIFS.ajout,{titre:a.titre},"el"+a.id+"_"+ke); });
    S.inline=null; R.toast(T.toast.elAjoute); R.renderStage();
  }
  if(k==="partok"){
    var tp=val("#tdle-partin").trim(); if(!tp){ R.toast(T.toast.rienAAjouter); return; } if(!exigeV2(a)) return;
    var kp=D.cle(), vp={txt:tp,par:staffNom(),date:new Date().toISOString()};
    a.particularites.push(Object.assign({k:kp},vp));
    var chp={}; chp["particularites/"+kp]=vp; ACT.ecr(a,chp);
    S.inline=null; R.toast(T.toast.partAjoutee); R.renderStage();
  }
  if(k==="chok"){
    var dt=val("#tdle-chdate").trim(), tx=val("#tdle-chtxt").trim();
    if(!tx){ R.toast(T.toast.decrireEtape); return; } if(!exigeV2(a)) return;
    var kc=D.cle(), vc={par:staffNom(),dateRp:dt||"date RP ?",txt:tx};
    a.chrono.push(Object.assign({k:kc},vc));
    var chc={}; chc["chrono/"+kc]=vc; ACT.ecr(a,chc);
    notif(function(N){ var dst=R.participants(a).slice();
      if(a.referent&&dst.indexOf(a.referent)<0) dst.push(a.referent);
      N.a(dst,CFG.NOTIFS.ajout,{titre:a.titre},"chr"+a.id+"_"+kc); });
    S.inline=null; R.toast(T.toast.chrAjoute); R.renderStage();
  }
  if(k==="rlok"){
    var tr=val("#tdle-rlin").trim(); if(!tr||!exigeV2(a)) return;
    var kr=D.cle(); a.roles.push({k:kr,txt:tr,par:"",date:""});
    var chr2={}; chr2["roles/"+kr]={txt:tr}; ACT.ecr(a,chr2); R.renderStage();
  }
  if(k==="lienok"){
    var tid=val("#tdle-liensel").trim(); if(!tid){ R.toast(T.toast.aucuneAffaire); return; }
    var note=val("#tdle-liennote").trim(); if(!exigeV2(a)) return;
    if(R.role(a)==="staff"){ ajouterLien(a,tid,note); R.toast(T.toast.lienAjoute); }
    else{
      var moi=D.myPseudo()||"—";
      if(!a.demandesLien.some(function(l){ return l.k===tid; })) a.demandesLien.push({k:tid,note:note,par:moi});
      var chdl={}; chdl["demandesLien/"+tid]={note:note,par:moi}; ACT.ecr(a,chdl);
      R.toast(T.toast.lienDemande);
    }
    S.inline=null; R.renderStage();
  }
  if(k==="editok"){
    var rt=document.querySelector('input[name=tdle-etype]:checked'); if(rt) a.type=rt.value;
    a.dateISO=val("#tdle-edate")||a.dateISO;
    a.titre=val("#tdle-etitre").trim()||a.titre;
    a.victime=val("#tdle-evic").trim()||"—";
    a.lieu=val("#tdle-elieu").trim()||"—";
    a.enqueteur=val("#tdle-eenq").trim()||"—";
    a.synthese=val("#tdle-esyn").trim();
    a.statutTxt=val("#tdle-estatut").trim();
    a.rp=val("#tdle-erp").trim();
    R.renumeroter();
    patch(a,{type:a.type,dateISO:a.dateISO,titre:a.titre,victime:a.victime,lieu:a.lieu,
      enqueteur:a.enqueteur,synthese:a.synthese,statutTxt:a.statutTxt,rp:a.rp});
    notif(function(N){ N.uneFois("enq"+a.id,function(){ N.tous(CFG.NOTIFS.creation,{titre:a.titre},"enq"+a.id); }); });
    S.drawer=null; R.toast(T.toast.enregistre+a.cote); R.renderAll();
  }
}

/* ===================== CRÉATION / SUPPRESSION ===================== */
function creerAffaire(){
  var t=S.type!=="tous"?S.type:"AG";
  var na=D.normaliser({id:D.newId(),schema:CFG.SCHEMA,type:t,dateISO:new Date().toISOString().slice(0,10),
    enqueteur:"—",titre:"Nouvelle affaire",victime:"—",lieu:"—",statutTxt:"À compléter.",verses:{}});
  A.push(na); R.renumeroter(); persistFull(na);
  S.sel=na.id; S.vue="dossiers"; S.mob="detail"; S.onglet="resume"; S.drawer="edit"; S.inline=null;
  R.toast(T.toast.cree+na.cote+T.toast.cree2); R.renderAll();
}
function supprimer(a){
  if(!window.confirm(T.confirmes.supprimer+a.cote+" ("+a.titre+")"+T.confirmes.supprimer2)) return;
  A.forEach(function(x){ if(x===a||x.archive||x.schema!==CFG.SCHEMA) return;
    var ch=null;
    if(x.liens.some(function(l){ return l.k===a.id; })){ x.liens=x.liens.filter(function(l){ return l.k!==a.id; }); ch=ch||{}; ch["liens/"+a.id]=null; }
    if(x.demandesLien.some(function(l){ return l.k===a.id; })){ x.demandesLien=x.demandesLien.filter(function(l){ return l.k!==a.id; }); ch=ch||{}; ch["demandesLien/"+a.id]=null; }
    if(ch) ACT.ecr(x,ch);
  });
  window.TDLBase.supprimerEntree(CFG.NODE, a.id, "suppression de "+a.cote);
  var i=A.indexOf(a); if(i>=0) A.splice(i,1);
  R.renumeroter();
  var d=R.filtre(); S.sel=d[0]?d[0].id:(A[0]?A[0].id:null); S.drawer=null; S.inline=null; S.mob="liste";
  R.toast(T.toast.supprime); R.renderAll();
}

/* ===================== CLÔTURE : VERSEMENT IDEMPOTENT =====================
   Garde 1 : pas de clôture sans participant validé.
   Garde 2 : on marque verses/{cp}=true AVANT de créditer ; en cas d'échec du
   crédit on retire le marqueur. Un nouvel essai ne re-crédite donc jamais un
   participant déjà marqué : le double versement est impossible, et un échec
   se guérit en relançant la clôture. */
function crediterDollars(pseudo, delta){
  return window.EcoCore.firebaseTransaction("membres/"+encodeURIComponent(pseudo)+"/dollars",
    function(cur){ return Math.max(0,(cur||0)+delta); });
}
function cloturer(a){
  if(a.bonusVerse){ R.toast(T.toast.dejaVerse); return; }
  var vals=a.valides.slice();
  if(a.referent&&vals.indexOf(a.referent)<0) vals.push(a.referent);
  if(!vals.length){ R.toast(T.toast.clotureRefuse); return; }
  if(!window.confirm(T.confirmes.clôturer+a.cote+T.confirmes.clôturer2)) return;
  var i=0;
  function un(){
    if(i>=vals.length){
      a.cloturee=true; a.bonusVerse=true; a.demandeCloture=false;
      patch(a,{cloturee:true,bonusVerse:true,demandeCloture:false});
      notif(function(N){ vals.forEach(function(p){
        N.a(p,CFG.NOTIFS.bonus,{titre:a.titre,montant:CFG.BONUS.participant+((a.referent&&p===a.referent)?CFG.BONUS.referent:0)},"bonus"+a.id+"_"+p); }); });
      var tot=vals.length*CFG.BONUS.participant+(a.referent?CFG.BONUS.referent:0);
      R.toast(T.toast.clotureOkPart1+vals.length+" × "+CFG.BONUS.participant+"$"
        +(a.referent?T.toast.clotureReferentBonus+CFG.BONUS.referent+T.toast.clotureRefSuffix:"")+" = "+tot+"$");
      R.renderAll();
      return;
    }
    var p=vals[i++], cleP=D.cp(p);
    if(a.verses[cleP]){ un(); return; }         /* déjà versé : on saute */
    var chm={}; chm["verses/"+cleP]=true; ACT.ecr(a,chm); a.verses[cleP]=true;
    crediterDollars(p,CFG.BONUS.participant+((a.referent&&p===a.referent)?CFG.BONUS.referent:0))
      .then(un)
      .catch(function(){
        delete a.verses[cleP];
        var chd={}; chd["verses/"+cleP]=null; ACT.ecr(a,chd);
        R.toast(T.toast.clotureErreur);
      });
  }
  un();
}

/* ===================== ARCHIVAGE SOPHIE-OS =====================
   1. staff → « Archiver » : le markdown complet est généré puis POSTÉ
      automatiquement dans le topic via le quick reply (la page se
      recharge, le parseur relit l'affaire depuis le post).
   2. au rechargement, l'affaire vit ET en base ET en archive : le bouton
      « Finaliser » purge le nœud Firebase. Jamais de perte de données si
      le post échoue. */
function archiver(a){
  if(!a.cloturee){ R.toast(T.toast.archivRefuse); return; }
  if(!window.confirm(T.toast.archivConfirm)) return;
  var md=D.markdownAffaire(a);
  var qr=document.getElementById("quick_reply");
  if(!qr){ R.toast(T.toast.archivErreur); return; }
  var ta=qr.querySelector("textarea")||qr.querySelector("[name=message]");
  if(!ta){ R.toast(T.toast.archivErreur); return; }
  ta.value=md;
  qr.submit();
}
/* Finalisation : le nœud n'est pas détruit mais ALLÉGÉ — il ne garde que
   titre, référent, bonusVerse et la carte verses (audit d'idempotence),
   plus le fanion archive. Le panneau ne rend jamais un stub : l'affaire
   s'affiche depuis son post d'archive, et le stub prête son id pour que
   les liens d'autres affaires continuent de la désigner. */
function finaliserArchive(a){
  var stub={schema:CFG.SCHEMA, archive:true, titre:a.titre, referent:a.referent||null,
            bonusVerse:true, verses:a.verses||{}};
  window.TDLBase.ecrireEntree(CFG.NODE, a.id, stub, "archivage de "+a.cote)
    .then(function(){
      delete PEND[a.id];
      var arch=A.filter(function(x){ return x.archive&&x.cote===a.cote; })[0];
      if(arch) arch.id=a.id;                       /* alias : les liens visent l'id du stub */
      var i=A.indexOf(a); if(i>=0) A.splice(i,1);
      R.fixSel();
      R.toast(T.toast.finalise);
      R.renderAll();
    })
    .catch(function(){ R.toast(T.toast.finaliseErreur); });
}

/* ===================== MIGRATION v1 → v2 ===================== */
function lancerMigration(){
  if(!R.estStaffCourant()){ R.toast(T.toast.migrerRefuse); return; }
  var reste=R.nonMigrees().length;
  if(!reste){ R.toast(T.toast.rienAConvertir); return; }
  if(!window.confirm(T.confirmes.migrer1+reste+T.confirmes.migrer2)) return;
  var b=document.querySelector('[data-act="migrer"]');
  if(b){ b.disabled=true; b.textContent=T.migEnCours; }
  Promise.resolve(window.EcoCore.firebaseGet(CFG.NODE)).then(function(raw){
    return window.TDLBase.migrer({node:CFG.NODE, schema:CFG.SCHEMA, listes:D.PLAN, entrees:raw||{},
      surProgres:function(f,t){ var x=document.querySelector('[data-act="migrer"]'); if(x) x.textContent=T.migProg1+f+T.migProg2+t+T.migProg3; }});
  }).then(function(res){
    R.toast(res.erreurs.length?res.faits+T.confirmes.migrerPart1+res.erreurs.length+T.confirmes.migrerPart2
                            :res.faits+T.confirmes.migrerOk);
    loadData();
  }).catch(function(){
    R.toast(T.toast.migrImpossible); R.renderStage();
  });
}

/* ===================== LECTURE ===================== */
/* Lecture des archives : AUCUN sélecteur propre au template — on cherche
   le plus profond élément porteur du marqueur, puis on remonte jusqu'au
   conteneur qui couvre le post entier (contient marqueur ET une clé COTE:),
   en s'arrêtant dès que le parent engloberait deux marqueurs (deux posts)
   ou perdrait la clé. Tolère les échappements FA (\- , \===). */
function lireArchives(){
  var out=[], marqueur="--- BLOC "+CFG.ARCHIVE.bloc+" ---";
  var porteurs=[], elus=[], traites=[];
  document.querySelectorAll("div,article,td,dd").forEach(function(el){
    if((el.textContent||"").indexOf(marqueur)>=0) porteurs.push(el);
  });
  porteurs.forEach(function(el){
    var englobe=false;
    elus.forEach(function(g){ if(g.contains(el)) englobe=true; });
    if(!englobe) elus.push(el);
  });
  elus.forEach(function(el){
    var c=el;
    while(c.parentNode&&c.parentNode!==document.body){
      var p=c.parentNode, txt=p.textContent||"";
      if(txt.split(marqueur).length-1>1) break;   /* deux posts dans ce parent : trop large */
      if(txt.indexOf("COTE:")<0) break;           /* plus de clé : conteneur incomplet */
      c=p;
    }
    if(traites.indexOf(c)>=0) return;             /* même conteneur déjà parsé */
    traites.push(c);
    var o=D.parserArchive(c.innerHTML);
    if(o) out.push(o);
  });
  return out;
}
function loadData(){
  R.loading(T.chargement);
  var pr;
  try{ pr=window.EcoCore.firebaseGet(CFG.NODE); }catch(e){ R.loading(T.ecoIndispo); return; }
  Promise.resolve(pr).then(function(raw){
    raw=raw||{};
    A.length=0;
    var stubs={};
    Object.keys(raw).forEach(function(id){
      var o=raw[id]||{}; o.id=id;
      if(o.archive){ stubs[id]=o; return; }   /* nœud allégé : vit dans le topic */
      A.push(D.normaliser(o));
    });
    /* archives du topic : même format, figées, badge Archive */
    lireArchives().forEach(function(o){
      o.id="arch-"+(o.cote||A.length);
      /* stub correspondant (même titre, même référent) : l'archive hérite
         de son id pour que les liens et coteDe continuent de fonctionner */
      Object.keys(stubs).forEach(function(sid){
        var s=stubs[sid];
        if(s.titre===o.titre&&(s.referent||null)===(o.referent||null)) o.id=sid;
      });
      var doublon=A.filter(function(x){ return !x.archive&&x.cote===o.cote; })[0];
      if(doublon){ doublon.aArchive=true; o.aArchive=true; }
      A.push(o);
    });
    R.renumeroter(); R.fixSel(); R.renderAll();
    if(VEILLE&&VEILLE.caler) VEILLE.caler(raw);
    if(!A.length) R.loading(R.estStaffCourant()?T.videStaff:T.videMembre);
  }).catch(function(){ R.loading(T.loadErreur); });
}

/* ===================== VEILLE SENTINELLE ===================== */
var VEILLE=null;
function startAutoRefresh(){
  VEILLE=window.TDLBase.suivre({
    node:CFG.NODE, rev:true, ms:CFG.VEILLE_MS,
    occupe:function(){ return !!(S.drawer||S.inline); },
    onEntrees:absorber
  });
}
function absorber(majs, supprimes){
  var change=false, j;
  majs.forEach(function(m){
    var brut=m.brut||{};
    if(brut.archive){                      /* le nœud vient d'être allégé : la version du topic prime */
      for(j=0;j<A.length;j++){ if(A[j].id===m.id&&!A[j].archive) A.splice(j,1); }
      return;
    }
    var o=brut; o.id=m.id;
    var n=D.normaliser(o), i=-1;
    for(j=0;j<A.length;j++){ if(A[j].id===m.id){ i=j; break; } }
    appliquerPend(n);                 /* ré-applique les écritures en attente */
    if(i<0) A.push(n); else A[i]=n;
    change=true;
  });
  if(supprimes&&supprimes.length){ supprimes.forEach(function(id){ delete PEND[id]; });
    for(j=A.length-1;j>=0;j--){ if(supprimes.indexOf(A[j].id)>=0) A.splice(j,1); }
    change=true; }
  if(!change) return;
  purgePendSiVide();
  R.renumeroter(); R.fixSel(); R.renderAll();
}

/* ===================== INIT / BOOT ===================== */
function pret(){ return !!(window.EcoCore&&window.EcoCore.firebaseGet&&window.TDLBase&&window.TDLBase.suivre); }
function whenEco(cb){
  if(pret()){ cb(); return; }
  R.loading(T.connexionBase);
  var n=0, iv=setInterval(function(){
    if(pret()){ clearInterval(iv); cb(); }
    else if(++n>80){ clearInterval(iv); R.loading(T.introuvable); }
  },125);
}
function initApp(){
  var vue=R.$("#tdle-vue");
  if(vue) vue.querySelectorAll("button").forEach(function(b){ b.onclick=function(){ S.vue=b.getAttribute("data-v"); S.mob="liste"; S.drawer=null; S.inline=null; R.syncVue(); R.renderStage(); }; });
  R.syncVue();
  var ed=R.$("#tdle-edit");
  if(ed){ ed.onclick=function(ev){ ev.preventDefault(); window.open(CFG.EDIT_URL,"_blank","noopener"); }; if(R.estStaffCourant()) ed.classList.add("on"); }
  whenEco(function(){
    window.TDLBase.surEchec(majBandeau);
    window.TDLBase.avatars(function(){ if(!S.drawer&&!S.inline) R.renderAll(); });
    startAutoRefresh();
    loadData();
  });
}
var mounted=false;
function boot(){
  if(mounted) return true;
  var host=document.getElementById("tdl-enquete");
  if(!host){ host=document.querySelector(".tdle-bg"); }   /* compat ancienne capsule */
  if(!host) return false;
  mounted=true;
  host.insertAdjacentHTML("beforeend", R.coquille());
  var bg=host.querySelector(".tdle-bg");
  if(bg&&bg.parentNode!==document.body) document.body.appendChild(bg);
  var st=document.createElement("style");
  st.textContent="html#min-width,body,#wrap,#sj-main{min-width:0!important} html,body{overflow-x:hidden!important}";
  document.head.appendChild(st);
  if(!document.querySelector("meta[name=viewport]")){ var mv=document.createElement("meta"); mv.name="viewport"; mv.content="width=device-width, initial-scale=1"; document.head.appendChild(mv); }
  initApp();
  return true;
}
var tries=0, iv=setInterval(function(){ if(boot()||++tries>60) clearInterval(iv); },250);
window.addEventListener("load",boot);
if(document.readyState!=="loading") boot();

window.TDLE_ACT=ACT;
})();
