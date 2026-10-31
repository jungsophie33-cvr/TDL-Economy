/* ============================================================
   carnet/carnet-contrib.js — Carnet de fragments — phase 3
   Contributions des visiteurs via EcoCore (Firebase) :
   commentaires des récits, versions partagées des anecdotes et
   souvenirs, cartes postales reçues. Nœud carnet_contrib, entrées
   {topic, post, type, uid, pseudo, t, x, img, cree, groupe}.
   Purge des orphelins au fil de l'eau (plafonnée à 20 par visite),
   retraits manuels, dégradation propre sans EcoCore.
   Charge en dernier ; alimente CARNETUI.contribs / CARNETUI.cartes
   puis émet carnet:contrib — la une et la fiche ouverte se
   rafraîchissent seules (le shell écoute déjà cet événement).

   GREFFON ECOCORE : l'adaptateur ECO ci-dessous cherche les
   méthodes usuelles d'EcoCore v2 (firebasePush, firebaseUpdate,
   lecture). Au dépôt, aligner les noms réels sur ces quatre
   fonctions — rien d'autre dans ce fichier ne change.
   ============================================================ */
(function(){
'use strict';
var UI=window.CARNETUI;
if(!UI)return;
var C=window.CARNET;
if(!C)return;

var PLAFOND_PURGE=20;
var NOEUD='carnet_contrib';

/* ============ 1. adaptateur EcoCore (greffon documenté) ============ */
var ECO=(function(){
  var E=window.EcoCore;
  if(!E)return {dispo:false};
  var lireMethode=['firebaseOnValue','firebaseLire','firebaseGet','firebaseOnce']
    .filter(function(n){ return typeof E[n]==='function'; })[0];
  var pushOk=typeof E.firebasePush==='function';
  var majOk=typeof E.firebaseUpdate==='function';
  /* pseudo du membre connecté :	EcoCore garde l'identité de session */
  var moiMethode=['moi','utilisateurCourant','session','firebaseAuth']
    .filter(function(n){ return typeof E[n]==='function'; })[0];
  return {
    dispo:!!(lireMethode&&pushOk&&majOk),
    lire:function(chemin){ return new Promise(function(res,rej){
      try{ E[lireMethode](chemin,function(v){ res(v); },rej); }catch(e){ rej(e); } }); },
    pousser:function(chemin,valeur){ return Promise.resolve(E.firebasePush(chemin,valeur)); },
    retirer:function(maj){ return Promise.resolve(E.firebaseUpdate(maj)); },
    moi:function(){ return moiMethode?E[moiMethode]():null; }
  };
})();

/* ============ 2. mise en forme des entrées ============ */
function normId(v){ return String(v==null?'':v); }
/* t = texte, x = incrément discret, img = image de carte, cree = timestamp */
function entréeValide(e){
  return e&&normId(e.topic)===String(C.sujet)&&(e.t||e.img)&&
    (e.type==='partage'||e.type==='commentaire'||e.type==='carte');
}
function dateCourte(ts){
  var d=new Date(+ts||Date.now());
  if(isNaN(d.getTime()))return '';
  return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
}
function ranger(entrees){
  var contribs={},cartes=[];
  Object.keys(entrees||{}).forEach(function(cle){
    var e=entrees[cle];
    if(!entréeValide(e))return;
    var p={pseudo:e.pseudo||'?',groupe:e.groupe||null,quand:dateCourte(e.cree),txt:e.t||'',
      img:e.img||'',cle:e.cle||e.id||null};
    if(e.type==='carte'){ cartes.push({pseudo:p.pseudo,groupe:p.groupe,img:p.img,txt:p.txt}); return; }
    var k=normId(e.post);
    contribs[k]=contribs[k]||{partages:[],commentaires:[]};
    if(e.type==='partage')contribs[k].partages.push(p);
    else contribs[k].commentaires.push(p);
  });
  return {contribs:contribs,cartes:cartes};
}

/* ============ 3. purge des orphelins (plafonnée, au fil de l'eau) ============ */
/* les entrées d'un uid disparu de l'annuaire partent à la première visite ;
   20 par passage, le reste attend le suivant — jamais d'écriture en rafale */
function purger(entrees,annuaire){
  if(!annuaire||!ECO.dispo)return [];
  var maj={},n=0;
  Object.keys(entrees||{}).some(function(cle){
    var e=entrees[cle];
    if(e&&e.uid&&!annuaire[e.uid]&&entréeValide(e)){
      maj[NOEUD+'/'+cle]=null; n++;
      if(n>=PLAFOND_PURGE)return true;
    }
    return false;
  });
  if(!n)return [];
  ECO.retirer(maj).catch(function(){});
  return Object.keys(maj).map(function(k){ return k.split('/').pop(); });
}

/* ============ 4. chargement ============ */
function charger(){
  if(!ECO.dispo){ UI.contribs=UI.contribs||{}; UI.cartes=UI.cartes||[]; return Promise.resolve(0); }
  return ECO.lire(NOEUD).then(function(brut){
    var entrees=brut||{};
    /* annuaire des uid : sans lui, pas de purge — on affiche, on n'efface pas */
    var lireAnnuaire=ECO.lire('uid_index').catch(function(){ return null; });
    return lireAnnuaire.then(function(annuaire){
      var purgées=purger(entrees,annuaire);
      if(!purgées.length)return entrees;
      var net={};
      Object.keys(entrees).forEach(function(cle){
        if(purgées.indexOf(cle)>=0)return;
        net[cle]=entrees[cle];
      });
      return net;
    });
  }).then(function(entrees){
    var r=ranger(entrees);
    UI.contribs=r.contribs;
    UI.cartes=r.cartes;
    document.dispatchEvent(new CustomEvent('carnet:contrib',{detail:{carnet:C}}));
    return r.cartes.length+Object.keys(r.contribs).length;
  }).catch(function(){ UI.contribs=UI.contribs||{}; UI.cartes=UI.cartes||[]; return 0; });
}

/* ============ 5. écriture (membres connectés seulement) ============ */
function connecte(){
  return !!(document.querySelector('#quick_reply form')||document.querySelector('#quick_reply'));
}
function profilCourant(){
  var m=ECO.dispo?ECO.moi():null;
  return m&&typeof m==='object'?m:null;
}
function ecrire(type,postId,texte,img){
  if(!connecte()){ UI.toast('Connectez-vous pour participer.'); return; }
  if(!ECO.dispo){ UI.toast('Les contributions ne sont pas actives ici.'); return; }
  texte=String(texte||'').replace(/^\s+|\s+$/g,'');
  if(!texte&&!img){ UI.toast('Écrivez d\'abord quelque chose.'); return; }
  var p=profilCourant()||{};
  var entree={
    topic:String(C.sujet),post:normId(postId),type:type,
    uid:p.uid||p.id||'',pseudo:p.pseudo||p.nom||'?',
    t:texte,x:0,img:img||'',cree:Date.now(),
    groupe:p.groupe||p.communaute||p.communaute||'' /* greffon : nom du champ à aligner */
  };
  ECO.pousser(NOEUD,entree).then(function(){
    /* affichage immédiat : pas d'attente du réseau pour le contributeur */
    var k=normId(postId);
    if(type==='carte'){ UI.cartes=(UI.cartes||[]).concat([{pseudo:entree.pseudo,groupe:entree.groupe,img:entree.img,txt:entree.t}]); }
    else{
      UI.contribs=UI.contribs||{}; UI.contribs[k]=UI.contribs[k]||{partages:[],commentaires:[]};
      var cible=type==='partage'?'partages':'commentaires';
      UI.contribs[k][cible].push({pseudo:entree.pseudo,groupe:entree.groupe,quand:dateCourte(entree.cree),txt:entree.t});
    }
    document.dispatchEvent(new CustomEvent('carnet:contrib',{detail:{carnet:C}}));
    UI.toast(type==='carte'?'Carte envoyée.':(type==='partage'?'Version partagée.':'Commentaire publié.'));
  }).catch(function(){ UI.toast('Échec de l\'enregistrement — réessayez.'); });
}

/* ============ 6. petit modal de saisie (sans dépendance au volet d'ajout) ============ */
var MODAL_ID='cf-contrib-modal';
function ouvrirSaisie(titre,envoyer){
  fermerSaisie();
  var d=document.createElement('div');
  d.id=MODAL_ID; d.className='cf-voile cf-ouverte';
  d.innerHTML='<div class="cf-contrib-box"><h3>'+titre+'</h3>'+
    '<textarea class="cf-contrib-txt" placeholder="Votre texte…"></textarea>'+
    '<div class="cf-contrib-boutons"><button type="button" class="cf-btn" data-cenvoyer>Envoyer</button>'+
    '<button type="button" class="cf-btn cf-btn-vert" data-cfermer>Annuler</button></div></div>';
  d.addEventListener('click',function(e){
    if(e.target===d||e.target.closest('[data-cfermer]')){ fermerSaisie(); return; }
    if(e.target.closest('[data-cenvoyer]')){
      var ta=d.querySelector('.cf-contrib-txt');
      envoyer(ta?ta.value:'');
      fermerSaisie();
    }
  });
  document.body.appendChild(d);
}
function fermerSaisie(){ var d=document.getElementById(MODAL_ID); if(d&&d.parentNode)d.parentNode.removeChild(d); }

/* ============ 7. branchements ============ */
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-contrib]');
  if(!b)return;
  var v=String(b.dataset.contrib||'').split(':');
  var type=v[0],postId=v[1]||'';
  if(type==='commentaire'){ ouvrirSaisie('Commenter',function(t){ ecrire('commentaire',postId,t,''); }); }
  else if(type==='partage'){ ouvrirSaisie('Ajouter ma version',function(t){ ecrire('partage',postId,t,''); }); }
},true);

/* ============ 8. amorçage ============ */
UI.contrib={ecrire:ecrire,charger:charger,
  retirer:function(cle){ /* retrait manuel : author, propriétaire, staff */
    if(!ECO.dispo||!cle)return Promise.resolve(false);
    var maj={}; maj[NOEUD+'/'+cle]=null;
    return ECO.retirer(maj).then(function(){ return charger(); }).catch(function(){ return false; });
  }};
charger();
})();
