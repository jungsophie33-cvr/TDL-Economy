/* ============================================================
   carnet/carnet-core.js — Carnet de fragments — phase 3
   [v3-1] correctif de lecture : le contenu du post était lu via
   textContent, qui colle les lignes sans retours à la ligne — aucun
   marqueur n était vu, charger() rejetait « pas un carnet ». Nouvelle
   lecture texteLignes() : <br> et fins de blocs deviennent des \n,
   les balises maison (i1, f4, d…) restent telles quelles dans le
   texte — le CSS du forum les stylise déjà partout dans la page.
   Collecte des posts du sujet (toutes pages), parse des marqueurs,
   normalisation, tri, tirage de la pensée du jour, registre des PNJ.
   Charge après sos-core ; expose window.CARNET.
   Le carnet ne charge ni sos-annexe ni sos-manifeste.
   ============================================================ */
(function(){
'use strict';

var CARNET={version:'3.0'};
var SEL={
  bloc:'.sj-postmsg',                                /* le post — l'id de l'élément est l'id du post (id="550") */
  avatar:'.sj-post-avatar img',                      /* avatar du compte (hero emblem) */
  edit:'a[href*="mode=editpost"]',                  /* /post?p={id}&mode=editpost */
  suppr:'a[href*="mode=delete"]',                    /* /post?p={id}&tid=…&mode=delete */
  pagination:'.sj-wrap .sub-header .pagination span a' /* /t{topic}p{page}-{slug} */
};

/* ============ 1. normalisation (charte v1-2) ============ */
function nfd(s){ return String(s==null?'':s).normalize('NFD'); }
function normCle(s){ return nfd(s).replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase(); }
function normTxt(s){ return nfd(s).replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function trim(s){ return String(s==null?'':s).replace(/^\s+|\s+$/g,''); }

/* ============ 2. grammaire des marqueurs (pur, testable) ============ */
var RE_CARNET=/^===\s*CARNET\s*(?:===)?\s*$/i;
var RE_FRAGMENT=/^===\s*FRAGMENT\s*:\s*([A-Za-z_][A-Za-z0-9_-]*)\s*(?:===)?\s*$/i;
var RE_FIN=/^===\s*FIN\s*(?:===)?\s*$/i;
var RE_CLE=/^([A-Za-z_][A-Za-z0-9_]*):(?:\s(.*))?$/;

/* extraire les blocs d'un texte : [{type, lignes[]}] ; sans FIN, jusqu'à la fin du texte.
   Tout ce qui précède la première entête, et tout ce qui suit un FIN, est ignoré. */
function extraireBlocs(txt){
  var out=[],lignes=String(txt||'').split(/\r?\n/),cour=null;
  for(var i=0;i<lignes.length;i++){
    var l=lignes[i];
    if(RE_CARNET.test(l)){ cour={type:'carnet',lignes:[]}; out.push(cour); continue; }
    var m=l.match(RE_FRAGMENT);
    if(m){ cour={type:m[1].toLowerCase(),lignes:[]}; out.push(cour); continue; }
    if(RE_FIN.test(l)){ cour=null; continue; }
    if(cour)cour.lignes.push(l);
  }
  return out;
}

/* clés insensibles à la casse et aux accents, normalisées en majuscules ;
   valeurs multi-lignes (lignes de continuation) ; clés répétées accumulées
   en préservant l'ordre d'écriture — c'est lui qui fait l'intercalage des images.
   Les lignes vides séparent les clés : leurs \n de queue ne polluent pas la valeur. */
function extraireEntrees(lignes){
  var out=[],cle=null,val='';
  function pousser(){ if(cle!==null)out.push({c:cle,v:val.replace(/\n+$/,'')}); }
  for(var i=0;i<lignes.length;i++){
    var l=lignes[i],m=l.match(RE_CLE);
    if(m){ pousser(); cle=normCle(m[1]); val=trim(m[2]||''); }
    else if(cle!==null){ val+=(val?'\n':'')+trim(l); }
  }
  pousser();
  return out;
}

/* modèle de fragment : entrées ordonnées + index des clés accumulées */
function fragmentDepuis(type,entrees,post){
  var f={type:type,post:post||{id:null,editUrl:null,supprUrl:null},entrees:entrees,props:{}};
  for(var i=0;i<entrees.length;i++){
    var e=entrees[i];
    (f.props[e.c]=f.props[e.c]||[]).push(e.v);
  }
  f.val=function(c){ var t=f.props[normCle(c)]; return t&&t.length?t[0]:''; };
  f.vals=function(c){ return f.props[normCle(c)]||[]; };
  f.a=function(c){ return (f.props[normCle(c)]||[]).length>0; };
  return f;
}

/* ============ 3. références {id} | {nom} (charte) ============ */
/* "12345 | Marcel Thibodeaux" — l'id d'abord (résolution fiable), le nom lisible en repli. */
function couperRef(s){
  s=String(s==null?'':s).replace(/&amp;/g,'&');
  var p=s.indexOf('|');
  if(p<0)return {id:null,nom:trim(s)};
  var id=trim(s.slice(0,p)),nom=trim(s.slice(p+1));
  return {id:/^\d+$/.test(id)?id:null,nom:nom};
}
/* registre attendu : {parId:{id:{nom}},parNom:{nomNorm:{id,nom}}} */
function resoudreRef(s,registre){
  var r=couperRef(s);
  if(!registre)return r.nom?{nom:r.nom,lien:null}:{nom:'',lien:null};
  if(r.id&&registre.parId[r.id])return {nom:registre.parId[r.id].nom,lien:r.id};
  var k=normTxt(r.nom);
  if(k&&registre.parNom[k])return {nom:registre.parNom[k].nom,lien:registre.parNom[k].id};
  return {nom:r.nom,lien:null}; /* post supprimé ou inconnu : nom affiché, sans lien */
}

/* ============ 4. registres, tri, tirage ============ */
function annee(f){
  var m=String(f.val('QUAND')||'').match(/(\d{4})/);
  return m?+m[1]:Infinity; /* sans année lisible : en fin de frise */
}
function registrePNJ(fragments){
  var r={parId:{},parNom:{}};
  for(var i=0;i<fragments.length;i++){
    var f=fragments[i];
    if(f.type!=='pnj')continue;
    var nom=f.val('NOM')||('PNJ '+f.post.id);
    var e={id:f.post.id,nom:nom};
    if(e.id)r.parId[e.id]=e;
    r.parNom[normTxt(nom)]=e;
  }
  return r;
}
function triChrono(liste){ return liste.slice().sort(function(a,b){ return annee(a)-annee(b); }); }
function tirage(liste){ return liste.length?liste[Math.floor(Math.random()*liste.length)]:null; }

/* ============ 5. lecteur de liens (sanitizer : origines autorisées) ============ */
function urlLecteur(l){
  var m;
  if(!l)return '';
  l=String(l).replace(/&amp;/g,'&'); /* lien collé depuis un code d'intégration */
  if((m=l.match(/[?&]list=([\w-]+)/))&&/youtu\.?be/i.test(l))return 'https://www.youtube.com/embed/videoseries?list='+m[1];
  if(m=l.match(/youtu\.be\/([\w-]+)/))return 'https://www.youtube.com/embed/'+m[1];
  if(m=l.match(/[?&]v=([\w-]+)/))return 'https://www.youtube.com/embed/'+m[1];
  if(m=l.match(/open\.spotify\.com\/playlist\/(\w+)/))return 'https://open.spotify.com/embed/playlist/'+m[1];
  return '';
}
function urlPage(l){
  var m;
  if(!l)return '';
  l=String(l).replace(/&amp;/g,'&');
  if((m=l.match(/[?&]list=([\w-]+)/))&&/youtu\.?be/i.test(l))return 'https://www.youtube.com/playlist?list='+m[1];
  if(m=l.match(/youtu\.be\/([\w-]+)/))return 'https://www.youtube.com/watch?v='+m[1];
  if(m=l.match(/[?&]v=([\w-]+)/))return 'https://www.youtube.com/watch?v='+m[1];
  if(m=l.match(/open\.spotify\.com\/playlist\/(\w+)/))return 'https://open.spotify.com/playlist/'+m[1];
  return '';
}

/* ============ 6. catégories (documentation vivante, validation douce) ============ */
/* Une clé inconnue n'est jamais jetée : elle reste dans f.entrees. */
CARNET.CATS={
  carnet:    {cles:['PROPRIETAIRE','AGE','METIER','VILLE','HERO'],fixe:true},
  recit:     {cles:['TITRE','QUAND','LIEU','PNJ','TEXTE','IMAGE','NOTE']},
  anecdote:  {cles:['TITRE','QUAND','LIEU','LIEN','PJ','PNJ','TEXTE','IMAGE','NOTE']},
  souvenir:  {cles:['TITRE','QUAND','LIEU','PJ','TEXTE','IMAGE','NOTE']},
  poeme:     {cles:['TITRE','TEXTE','NOTE']},
  pnj:       {cles:['NOM','AGE','IMAGE','METIER','RENCONTRE','RELATION','TEMPERAMENT','DESCRIPTION']},
  objet:     {cles:['TITRE','IMAGE','TEXTE','DEPUIS','LIE_A']},
  citation:  {cles:['TEXTE','SOURCE']},
  moodboard: {cles:['TITRE','IMAGE','LEGENDE']},
  playlist:  {cles:['LIEN','HUMEUR','TEXTE']}
};

/* --- lecture texte avec vraies lignes -------------------------------
   Sur ForumActif, les retours à la ligne sont des <br> : textContent
   colle tout en une seule ligne et les marqueurs deviennent illisibles.
   On convertit donc le HTML en texte ligne par ligne. Les balises maison
   (i1, f4, d…) sont CONSERVÉES telles quelles : le CSS de référence du
   forum stylise déjà ces éléments dans toute la page, coquille comprise.
   Tout autre tag (liens auto, smileys <img>, conteneurs FA) est retiré. */
var BALISES=('i1 i2 i3 i4 b1 b2 b3 b4 u1 u2 u3 u4 s1 s2 s3 f f1 f2 f3 f4 '+
  'fb fb1 fb2 fb3 d d1 d2 d3 t t1 t2 t3 t4 b i u s strike').split(' ');
function texteLignes(el){
  var c=el.cloneNode(true);
  Array.prototype.forEach.call(c.querySelectorAll('code, .cont_code, blockquote, .quote, .post-wordcount'),function(n){
    if(n.parentNode)n.parentNode.removeChild(n);
  });
  var h=c.innerHTML
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|ul|ol)>/gi,'\n')
    .replace(/<(\/?)([a-z0-9]+)(?:\s[^>]*)?>/gi,function(m,ferme,nom){
      nom=String(nom).toLowerCase();
      return BALISES.indexOf(nom)>=0 ? '<'+ferme+nom+'>' : '';
    });
  /* décodage des entités HTML sans passer par un <textarea> (son contenu
     RCDATA n'est pas fiable hors navigateur) */
  return h.replace(/&nbsp;/gi,' ')
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"').replace(/&#0?39;/g,"'")
    .replace(/&amp;/gi,'&')
    .replace(/\u00a0/g,' ');
}

/* ============ 7. lecture du DOM réel ============ */
function idDepuisUrl(u){
  var m=String(u||'').match(/[?&]p=(\d+)/);
  return m?m[1]:null;
}
function lirePost(bloc){
  /* .sj-postmsg porte l'id du post : id="550" */
  var id=(bloc.getAttribute&&bloc.getAttribute('id'))||(bloc.id!=null?String(bloc.id):null);
  if(id&&!/^\d+$/.test(id))id=null;
  var racine=bloc.parentNode||bloc;                 /* conteneur du post : avatar + liens natifs */
  var edit=racine.querySelector(SEL.edit);
  var suppr=racine.querySelector(SEL.suppr);
  var editUrl=edit?edit.getAttribute('href'):null;
  var supprUrl=suppr?suppr.getAttribute('href'):null;
  var av=racine.querySelector(SEL.avatar);
  if(!id)id=idDepuisUrl(editUrl);                   /* repli : paramètre p du lien d'édition */
  return {
    id:id,
    contenu:texteLignes(bloc),
    avatar:av?av.getAttribute('src'):null,
    editUrl:editUrl,
    supprUrl:supprUrl,
    bloc:bloc
  };
}
function lirePage(doc){
  var blocs=doc.querySelectorAll(SEL.bloc),posts=[];
  for(var i=0;i<blocs.length;i++){
    var p=lirePost(blocs[i]);
    if(p)posts.push(p);
  }
  return posts;
}

/* ============ 8. pagination (repli local ; brancher SOS.detecterPages/charger si dispo) ============ */
function pagesDispo(doc,courante){
  var urls={},as=doc.querySelectorAll(SEL.pagination);
  for(var i=0;i<as.length;i++){
    var href=as[i].getAttribute&&as[i].getAttribute('href');
    if(!href)continue;
    var m=href.match(/\/t(\d+)(?:p(\d+))?/);
    if(!m)continue;
    var u=href.indexOf('http')===0?href:location.origin+href;
    if(u===courante)continue;
    urls[u]=1;
  }
  return Object.keys(urls);
}
function chargerPage(url){
  return fetch(url,{credentials:'same-origin'}).then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.text();
  }).then(function(t){
    return new DOMParser().parseFromString(t,'text/html');
  });
}

/* ============ 9. assemblage : charger le carnet entier ============ */
function sujetCourant(){
  var m=location.pathname.match(/\/t(\d+)/);
  return m?+m[1]:null;
}
function fragmentsDe(posts){
  var out=[];
  for(var i=0;i<posts.length;i++){
    var blocs=extraireBlocs(posts[i].contenu);
    for(var j=0;j<blocs.length;j++){
      var type=blocs[j].type;
      if(type==='carnet')continue;                 /* la coquille se traite à part */
      if(!CARNET.CATS[type])continue;              /* type inconnu : ignoré, jamais deviné */
      out.push(fragmentDepuis(type,extraireEntrees(blocs[j].lignes),posts[i]));
    }
  }
  return out;
}
function coquilleDe(post){
  var blocs=extraireBlocs(post.contenu);
  for(var i=0;i<blocs.length;i++){
    if(blocs[i].type==='carnet')return fragmentDepuis('carnet',extraireEntrees(blocs[i].lignes),post);
  }
  return null;
}
/* moodboard : un tableau = un post du sujet du carnet, toutes ses images
   dans un seul message (clé IMAGE répétée) — un message par tableau,
   jamais un message par photo ; tous les fragments du carnet vivent dans
   le même topic, celui ouvert avec la coquille. */

CARNET.charger=function(){
  return new Promise(function(resoudre,rejeter){
    var idSujet=sujetCourant();
    if(idSujet===null){ rejeter(new Error('pas un sujet')); return; }
    CARNET.sujet=idSujet;

    /* page courante */
    var posts=lirePage(document);
    if(!posts.length){ rejeter(new Error('aucun post lu')); return; }
    var coquille=coquilleDe(posts[0]);
    if(!coquille){ rejeter(new Error('pas un carnet')); return; } /* le script ne monte rien hors sujet carnet */

    /* pages suivantes du sujet (multi-pages) */
    var promesses=pagesDispo(document,location.href).map(function(u){
      return chargerPage(u).then(function(doc){ return fragmentsDe(lirePage(doc)); })
        .catch(function(){ return []; });
    });

    Promise.all(promesses).then(function(pack){
      var fragments=[].concat.apply(fragmentsDe(posts),pack);
      var pnj=registrePNJ(fragments);
      var par=function(t){ return fragments.filter(function(f){ return f.type===t; }); };
      var mur=par('citation');
      CARNET.coquille=coquille;
      CARNET.coquille.avatar=posts[0].avatar;     /* hero emblem : .sj-post-avatar img du premier post */
      CARNET.fragments=fragments;
      CARNET.registre=pnj;
      CARNET.donnees={
        recits:par('recit'), anecdotes:par('anecdote'), souvenirs:triChrono(par('souvenir')),
        poemes:par('poeme'), pnjs:par('pnj'), objets:par('objet'), citations:mur,
        playlists:par('playlist'), moodboards:par('moodboard')
      };
      CARNET.pensee=tirage(mur);                 /* pensée du jour, tirée à chaque visite */
      document.dispatchEvent(new CustomEvent('carnet:pret',{detail:{carnet:CARNET}}));
      resoudre(CARNET);
    }).catch(rejeter);
  });
};

/* greffage sos-core : si la mécanique detecterPages/charger existe côté dépôt,
   la brancher en remplacement de pagesDispo/chargerPage (mêmes entrées/sorties) ;
   SOS.util suffit, ni sos-annexe ni sos-manifeste ne sont chargés. */

/* refaire : réassembler le carnet après intégration de nouveaux posts
   (publication, édition) sans recharger la page — la musique du
   mini-lecteur continue. Aucune promotion : la une se rafraîchit via
   CARNETUI.rafraichir, pas via un nouveau carnet:pret. */
CARNET.refaire=function(coquille,fragments,avatar){
  var pnj=registrePNJ(fragments);
  var par=function(t){ return fragments.filter(function(f){ return f.type===t; }); };
  var mur=par('citation');
  CARNET.coquille=coquille||CARNET.coquille;
  if(avatar)CARNET.coquille.avatar=avatar;else if(CARNET.coquille)CARNET.coquille.avatar=CARNET.coquille.avatar||null;
  CARNET.fragments=fragments;
  CARNET.registre=pnj;
  CARNET.donnees={
    recits:par('recit'), anecdotes:par('anecdote'), souvenirs:triChrono(par('souvenir')),
    poemes:par('poeme'), pnjs:par('pnj'), objets:par('objet'), citations:mur,
    playlists:par('playlist'), moodboards:par('moodboard')
  };
  CARNET.pensee=tirage(mur);
  return CARNET;
};

CARNET.outils={normCle:normCle,normTxt:normTxt,extraireBlocs:extraireBlocs,
  extraireEntrees:extraireEntrees,fragmentDepuis:fragmentDepuis,couperRef:couperRef,
  resoudreRef:resoudreRef,annee:annee,registrePNJ:registrePNJ,triChrono:triChrono,
  tirage:tirage,urlLecteur:urlLecteur,urlPage:urlPage,
  lirePage:lirePage,fragmentsDe:fragmentsDe,coquilleDe:coquilleDe};

window.CARNET=CARNET;
})();
