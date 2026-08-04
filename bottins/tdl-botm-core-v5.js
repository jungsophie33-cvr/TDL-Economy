/* ============================================================
   TDL — BOTTIN DES MÉTIERS · noyau (1/3)
   Blocs : TEXTES · CONFIG · ÉTAT · UTILS · PERSISTANCE · FILTRES
   Expose window.BM, complété par tdl-botm-render puis tdl-botm-ui.

   MODÈLE DE DONNÉES — une entreprise = un lieu qui embauche.
   Aucun champ n'est stocké deux fois :
     · lieux/{id}   → identité partagée avec le Répertoire des lieux
                      (nom, type, rue, zone, cat, ic, img, facs, emploi, amb)
     · emplois/{id} → extension propre au bottin
                      (effectif, fondee, rayonnement, desc, accroche,
                       culture, partenaires, rivaux, verrou, complet,
                       referent, brouillon, roles, postes)

   Un rôle vaut {nom, poste, depuis, type, lien, dir} et, pour les seuls
   rôles de type 'pj', un 'uid' capté à l'enregistrement depuis la carte
   faceclaim. Cet uid est la seule identité stable d'un compte : il survit
   à un changement de pseudo et permet à la suppression d'un membre de
   libérer ses postes. Un PNJ ou un pré-lien n'a évidemment pas d'uid.

   Les avatars des rôles occupés ne sont pas stockés ici : ils sont
   résolus à la lecture depuis le nœud 'faceclaims' du Bottin des avatars.
   safeReadBin() renvoyant déjà la racine complète, ce rapprochement ne
   coûte aucune requête supplémentaire.

   Dépend de : tdl-zcats.js (window.TDLZonesCats), window.EcoCore
   ============================================================ */
(function(){
"use strict";
const BM = window.BM = window.BM || {};

/* ===================== TEXTES ===================== */
BM.T = {
  entreprises:'entreprises', creer:'Créer une entreprise',
  retour:'← Retour aux entreprises',
  legDir:'Direction à pourvoir', legComplet:'Complet',
  aucune:'Aucune entreprise dans cette catégorie.',
  choisir:'Choisissez une entreprise dans la liste.',
  culture:"Culture d'entreprise", partenaires:'Partenaires', tensions:'Tensions',
  roles:'Rôles occupés', postes:'Postes à pourvoir',
  aucunRole:'Aucun rôle occupé.', aucunTag:'Aucun.', nonRenseigne:'Non renseigné.',
  aucunPoste:'Aucun poste ouvert pour le moment.',
  ouvertProp:'Aucun poste listé — les propositions restent bienvenues.',
  sansDesc:'Aucune description pour ce poste.',
  voirRoles:'Voir les {n} autres rôles occupés', voirPostes:'Voir tous les postes disponibles',
  reduire:'Réduire',
  modifier:'Modifier la fiche', publier:'Publier', retirer:'Retirer du bottin',
  confRetirer:'Confirmer le retrait', annuler:'Annuler', enregistrer:'Enregistrer', ajouter:'Ajouter',
  brouillon:'Brouillon', complet:'complet', enAttente:'En attente', aValider:'À valider',
  soumettre:'Soumettre au staff', dejaSoumis:'Envoyée au staff',
  okSoumis:' est soumise au staff pour publication.', nouvelle:'Nouvelle entreprise', edition:'Édition',
  sansNom:'Sans nom', referentPrefixe:' · Référent : ', depuis:'Depuis ',
  okSave:'Fiche enregistrée.', okRole:'Rôle enregistré.', okPoste:'Poste enregistré.',
  okTag:'Ajouté.', okPublie:' est publiée.',
  okRoleDel:'Rôle retiré — sa place est de nouveau libre.',
  okRetire:" a été retirée du bottin (le lieu, lui, est conservé).",
  errNom:'Le nom est requis.', errPoste:"L'intitulé est requis.",
  errSave:"Échec de l'enregistrement : ",
  errCfg:"Configuration manquante : chargez tdl-zcats.js avant ce script.",
  memo:'Enregistré en mémoire — EcoCore indisponible.',
  hintLieu:"Ces champs sont partagés avec le Répertoire des lieux : les modifier ici les modifie là-bas, et créer une entreprise crée le lieu correspondant.",
  hintRole:"Le pseudo doit être écrit exactement comme dans le bottin des avatars : c'est lui qui ramène l'avatar et le lien du profil. Le champ lien ne sert qu'aux pré-liens, dont le sujet n'est pas connu du bottin des avatars.",
  voirProfil:'Voir le profil', voirPrelien:'Voir la fiche de pré-lien',
  lbl:{nom:'Nom', zone:'Zone', categorie:'Catégorie', type:'Type / secteur',
       icone:'Icône (classe Flaticon ou URL)', rue:'Siège (adresse)', effectif:'Effectif',
       fondee:'Fondée en', rayonnement:'Rayonnement',
       image:'Image (URL) — sans image, un dégradé discret est appliqué',
       amb:"Phrase d'ambiance (bandeau)", desc:'Présentation',
       accroche:"Résumé de la culture d'entreprise", dispo:'Disponibilité', staff:'Réservé au staff',
       referent:'Référent'},
  ph:{complet:'Entreprise complète (aucun rôle recherché pour le moment)',
      verrou:'Verrouillée (le poste de direction ne confère pas le statut de référent)',
      role:'Poste de direction', posteDir:'Poste de direction (confère le statut de référent)',
      nomRole:'Nom / pseudo', fonction:"Fonction (doit reprendre l'intitulé du poste)",
      annee:'Depuis (année)', lien:'Lien (facultatif)',
      intitule:'Intitulé du poste', catPoste:'Catégorie', icPoste:'Icône (fi-tr-…)',
      places:'Places au total', resume:'Résumé du métier'}
};

/* ===================== CONFIG ===================== */
BM.CFG = {
  NODE_LIEUX:   'lieux',        /* [MAJ] nœud Firebase du répertoire des lieux */
  NODE_EMPLOIS: 'emplois',      /* [MAJ] nœud Firebase de l'extension métier   */
  HREF_ACCUEIL: '/',            /* [MAJ] accueil du forum */
  /* [MAJ] lien d'édition du sujet portant ce panneau */
  EDIT_URL: 'https://thedrownedlands.forumactif.com/post?p=000&mode=editpost',
  FORCER_ADMIN: false,          /* [MAJ] true UNIQUEMENT pour un aperçu local */
  MAX_ROLES: 4, MAX_POSTES: 4,  /* éléments affichés avant « voir plus » */
  ICONES: ['fi-tr-truck-side','fi-tr-government-flag','fi-ts-badge-sheriff','fi-ts-marker-hospital',
    'fi-tr-marketplace-store','fi-ts-drink','fi-tr-tree-alt','fi-ts-sailboat','fi-ts-fire-shield',
    'fi-tr-flask','fi-tr-sack-dollar','fi-tr-wheat-awn','fi-ts-pig-face','fi-tr-plane-alt']
};
/* champs appartenant au lieu — tout le reste part dans emplois/ */
/* « masque » appartient au lieu : il le cache du Répertoire des lieux tant que
   l'activité créée par un membre n'est pas publiée. À ne pas confondre avec
   « brouillon », qui appartient à l'entreprise. */
BM.CHAMPS_LIEU = ['nom','type','rue','zone','cat','ic','img','facs','emploi','amb','masque'];
BM.TYPES_ROLE = [{id:'pj',label:'Joueur'},{id:'pnj',label:'PNJ'},{id:'pl',label:'Pré-lien'}];

/* ===================== ÉTAT =====================
   BM.E n'est JAMAIS réassigné (les autres fichiers en gardent la référence) :
   on le vide et le remplit en place. */
BM.E = [];
BM.ZC = null; BM.ZONES = []; BM.CATS = [];
/* index du bottin des avatars, reconstruit à chaque chargement */
BM.FC = {parPseudo:{}, parPrelien:{}, parUid:{}};
/* uid → pseudo courant : permet à un rôle de suivre un changement de pseudo */
BM.UIDX = {};
BM.S = {
  zone:'houma', cat:'tous', vue:'mur', sel:null, mob:'liste',
  mode:'lecture', draft:null, inline:null,
  editRoles:false, editPostes:false, roleEdit:null, posteEdit:null,
  ouvertPoste:null, confirmDel:null, plusRoles:false, plusPostes:false,
  admin:false, moi:''
};

/* ===================== UTILS ===================== */
BM.$ = id => document.getElementById(id);
BM.q = s => document.querySelector(s);
BM.esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
BM.clone = o => JSON.parse(JSON.stringify(o));
BM.ini = n => String(n).split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
/* Firebase sérialise les tableaux JS en objets indexés → toujours normaliser */
BM.versTableau = v => Array.isArray(v) ? v : (v ? Object.values(v) : []);

/* Aucune taille en ligne : c'est la feuille de style qui dimensionne l'icône
   selon son conteneur (.bm-ric i, .bm-pcard-head > i…). Un style inline
   l'emporterait sur la feuille et rendrait ces règles inopérantes. */
BM.icone = function(val){
  if(!val) return '<i class="fi fi-tr-briefcase"></i>';
  if(/^https?:/.test(val)) return '<img src="'+BM.esc(val)+'" alt="">';
  const cls = val.indexOf('fi ')===0 ? val : ('fi '+val);
  return '<i class="'+BM.esc(cls)+'"></i>';
};
/* places libres d'un poste = total − rôles portant cet intitulé */
BM.libresPoste = (e,p) => Math.max(0,(Number(p.n)||0)-BM.versTableau(e.roles).filter(r=>r.poste===p.t).length);
BM.libres = e => BM.versTableau(e.postes).reduce((s,p)=>s+BM.libresPoste(e,p),0);
BM.directionLibre = e => BM.versTableau(e.postes).some(p=>p.dir&&BM.libresPoste(e,p)>0);
BM.estComplet = e => !!e.complet || (BM.versTableau(e.postes).length>0 && BM.libres(e)===0);
BM.editable = e => BM.S.admin || (!!e.referent && e.referent===BM.S.moi);
BM.visible = e => !e.brouillon || BM.S.admin || (!!e.referent && e.referent===BM.S.moi);
BM.dirDabord = (a,b) => (b.dir?1:0)-(a.dir?1:0);
BM.ent = id => BM.E.find(x=>x.id===id);

/* ---------- RAPPROCHEMENT AVEC LE BOTTIN DES AVATARS ----------
   Une carte faceclaim vaut {acteur, statut, uid, pseudo, image, nom_prelien}.
   On l'indexe sur trois clés, par ordre de fiabilité décroissante :
     · pseudo      → rôle joué par un membre (les pseudos sont identiques
                     dans les deux bottins, c'est la clé de référence)
     · nom_prelien → rôle marqué « pré-lien »
     · uid         → repli si le rôle porte un lien /u123
   Aucune donnée n'est recopiée : si le membre change de faceclaim, son
   avatar suit ici automatiquement. */
BM.normPseudo = s => String(s||'').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^@/,'');

/* Un même pseudo peut porter plusieurs cartes : une réservation multicompte
   est posée au nom du compte racine, en plus de la carte du personnage déjà
   validé. On départage donc au lieu de laisser la dernière lue l'emporter —
   Firebase renvoie les clés par ordre alphabétique, ce qui n'a aucun sens ici. */
function scoreFC(c){
  let s = 0;
  if(c.statut === 'pris') s += 4;          /* fiche validée : carte de référence */
  else if(c.statut === 'reserve') s += 1;  /* simple réservation : par défaut */
  if(c.image) s += 2;                      /* une carte sans image n'apporte rien */
  return s;
}
function poser(map, cle, c){
  if(!cle) return;
  const actuelle = map[cle];
  if(!actuelle || scoreFC(c) > scoreFC(actuelle)) map[cle] = c;
}
BM.indexerFaceclaims = function(root){
  const fc = (root && root.faceclaims) || {};
  const idx = {parPseudo:{}, parPrelien:{}, parUid:{}};
  Object.keys(fc).forEach(cle=>{
    const c = fc[cle]; if(!c) return;
    if(c.pseudo)      poser(idx.parPseudo,  BM.normPseudo(c.pseudo), c);
    if(c.nom_prelien) poser(idx.parPrelien, BM.normPseudo(c.nom_prelien), c);
    if(c.uid != null) poser(idx.parUid,     String(c.uid), c);
  });
  BM.FC = idx;
};
/* pseudo affiché : l'uid fait foi, le nom stocké n'est qu'un repli.
   Un membre renommé garde ainsi son rôle sans intervention. */
BM.nomDe = function(r){
  if(r && r.uid != null && BM.UIDX[String(r.uid)]) return BM.UIDX[String(r.uid)];
  return (r && r.nom) || '';
};
/* carte faceclaim correspondant à un rôle, ou null */
BM.carteFC = function(r){
  if(!r) return null;
  if(r.uid != null && BM.FC.parUid[String(r.uid)]) return BM.FC.parUid[String(r.uid)];
  const n = BM.normPseudo(BM.nomDe(r));
  if(r.type==='pl' && BM.FC.parPrelien[n]) return BM.FC.parPrelien[n];
  if(BM.FC.parPseudo[n]) return BM.FC.parPseudo[n];
  const m = /\/u(\d+)/.exec(r.lien||'');
  if(m && BM.FC.parUid[m[1]]) return BM.FC.parUid[m[1]];
  return null;
};
/* uid d'un rôle joué : depuis le lien saisi, sinon depuis la carte faceclaim */
BM.uidDe = function(r){
  if(!r || r.type!=='pj') return null;
  const m = /\/u(\d+)/.exec(r.lien||'');
  if(m) return Number(m[1]);
  const c = BM.carteFC(r);
  return (c && c.uid != null) ? c.uid : null;
};
/* l'avatar vient exclusivement du bottin des avatars : aucune saisie ici */
BM.avatarDe = function(r){
  const c = BM.carteFC(r);
  return (c && c.image) || '';
};
/* lien du rôle : saisi à la main, sinon déduit de l'uid de la carte.
   Un pré-lien pointe vers son sujet, que le bottin des avatars ne connaît
   pas : dans ce cas, seule la saisie manuelle fait foi. */
BM.lienDe = function(r){
  if(r && r.lien) return r.lien;
  if(r && r.type==='pl') return '';
  if(r && r.uid != null) return '/u'+r.uid;
  const c = BM.carteFC(r);
  return (c && c.uid != null) ? ('/u'+c.uid) : '';
};

BM.toast = function(msg, erreur){
  const t = BM.$('bm-toast'); if(!t) return;
  t.textContent = msg; t.className = 'bm-toast on'+(erreur?' err':'');
  clearTimeout(BM.toast._h);
  BM.toast._h = setTimeout(()=>{ t.className='bm-toast'; }, erreur?5000:2800);
};
/* conservation du défilement d'un rendu à l'autre */
BM.memScroll = function(){
  const l=BM.q('.bm-list'), p=BM.q('.bm-pbody'), b=BM.q('.bm-boardscroll');
  return {l:l?l.scrollTop:0, p:p?p.scrollTop:0, b:b?b.scrollTop:0};
};
BM.poseScroll = function(m, reset){
  const l=BM.q('.bm-list'), p=BM.q('.bm-pbody'), b=BM.q('.bm-boardscroll');
  if(l) l.scrollTop=m.l;
  if(b) b.scrollTop=m.b;
  if(p) p.scrollTop = reset ? 0 : m.p;
};

/* ===================== PERSISTANCE ===================== */
function ecoPret(cb, n){
  n = n || 0;
  if(window.EcoCore && typeof EcoCore.safeReadBin==='function' && typeof EcoCore.firebaseUpdate==='function'){ cb(EcoCore); return; }
  if(n > 40){ if(window.console) console.warn('[TDL bottin] EcoCore introuvable — mode mémoire.'); cb(null); return; }
  setTimeout(()=>ecoPret(cb, n+1), 250);
}
/* fusion lieu + extension métier ; l'extension peut être absente (lieu marqué
   « emploi » avant l'existence du bottin) → fiche vide, à compléter */
function fusionner(id, lieu, emploi){
  const e = Object.assign({id:id}, lieu, emploi||{});
  ['facs','culture','partenaires','rivaux','roles','postes'].forEach(k=>{ e[k] = BM.versTableau(e[k]); });
  return e;
}
BM.charger = function(rendre){
  ecoPret(eco=>{
    if(!eco){ rendre(); return; }
    eco.safeReadBin().then(root=>{
      const lieux = (root && root.lieux) || {};
      const emplois = (root && root.emplois) || {};
      BM.indexerFaceclaims(root);
      BM.UIDX = (root && root.uid_index) || {};
      const liste = Object.keys(lieux)
        .filter(id => lieux[id] && lieux[id].emploi === true)
        .map(id => fusionner(id, lieux[id], emplois[id]));
      BM.E.length = 0;
      liste.forEach(x=>BM.E.push(x));
      rendre();
    }).catch(err=>{
      if(window.console) console.error('[TDL bottin] charger', err);
      rendre();
    });
  });
};
/* écriture par champ ciblé sur les deux nœuds — jamais de writeBin racine.
   champs = {cle:valeur} ; chaque clé part vers lieux/ ou emplois/ selon son
   appartenance, en un seul firebaseUpdate atomique. */
BM.patch = function(e, champs){
  Object.assign(e, champs);
  if(!(window.EcoCore && typeof EcoCore.firebaseUpdate==='function')){
    BM.toast(BM.T.memo, true); return Promise.resolve({memoire:true});
  }
  const u = {};
  Object.keys(champs).forEach(k=>{
    const base = BM.CHAMPS_LIEU.indexOf(k)>=0 ? BM.CFG.NODE_LIEUX : BM.CFG.NODE_EMPLOIS;
    u[base+'/'+e.id+'/'+k] = champs[k];
  });
  return EcoCore.firebaseUpdate(u).catch(err=>{
    BM.toast(BM.T.errSave+((err&&err.message)||err), true);
    throw err;
  });
};
/* Le référent signale que sa fiche est prête : le staff la voit passer de
   « Brouillon » à « À valider ». Il ne publie jamais lui-même. */
BM.soumettreEntreprise = function(e){
  return BM.patch(e, {soumis:true});
};
/* Publication d'un brouillon : les deux nœuds sont concernés. Lever le seul
   drapeau de l'entreprise laisserait le lieu masqué dans le Répertoire. */
BM.publierEntreprise = function(e){
  e.brouillon = false; e.soumis = false; delete e.masque;
  if(!(window.EcoCore && typeof EcoCore.firebaseUpdate==='function')){
    BM.toast(BM.T.memo, true); return Promise.resolve({memoire:true});
  }
  const u = {};
  u[BM.CFG.NODE_EMPLOIS+'/'+e.id+'/brouillon'] = false;
  u[BM.CFG.NODE_EMPLOIS+'/'+e.id+'/soumis'] = null;
  u[BM.CFG.NODE_LIEUX+'/'+e.id+'/masque'] = null;   /* null supprime la clé */
  return EcoCore.firebaseUpdate(u);
};
/* Retrait du bottin : on ne supprime pas le lieu… sauf s'il n'existait que pour
   porter cette activité (créée par un membre, jamais publiée), auquel cas le
   garder laisserait un lieu fantôme invisible dans le répertoire. */
BM.retirerDuBottin = function(e){
  if(!(window.EcoCore && typeof EcoCore.firebaseUpdate==='function')) return Promise.resolve({memoire:true});
  const u = {};
  if(e.masque) u[BM.CFG.NODE_LIEUX+'/'+e.id] = null;
  else         u[BM.CFG.NODE_LIEUX+'/'+e.id+'/emploi'] = false;
  u[BM.CFG.NODE_EMPLOIS+'/'+e.id] = null;
  return EcoCore.firebaseUpdate(u);
};
/* création : le lieu ET son extension, en une écriture atomique.
   Le lieu apparaît donc immédiatement dans le Répertoire des lieux. */
BM.creerEntreprise = function(e){
  if(!(window.EcoCore && typeof EcoCore.firebaseUpdate==='function')) return Promise.resolve({memoire:true});
  const lieu = {}, emploi = {};
  Object.keys(e).forEach(k=>{
    if(k==='id') return;
    (BM.CHAMPS_LIEU.indexOf(k)>=0 ? lieu : emploi)[k] = e[k];
  });
  const u = {};
  u[BM.CFG.NODE_LIEUX+'/'+e.id] = lieu;
  u[BM.CFG.NODE_EMPLOIS+'/'+e.id] = emploi;
  return EcoCore.firebaseUpdate(u);
};

/* ===================== FILTRES ===================== */
BM.baseZone = () => BM.E.filter(e=>BM.visible(e) && e.zone===BM.S.zone && (BM.S.cat==='tous'||e.cat===BM.S.cat));
BM.filtre = () => BM.baseZone().sort((x,y)=>String(x.nom).localeCompare(String(y.nom),'fr'));
BM.catActive = id => BM.E.some(e=>BM.visible(e) && e.zone===BM.S.zone && e.cat===id);

})();
