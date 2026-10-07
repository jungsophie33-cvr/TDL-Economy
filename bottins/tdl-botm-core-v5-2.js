/* ============================================================
   TDL — BOTTIN DES MÉTIERS · noyau (1/3)
   Blocs : TEXTES · CONFIG · ÉTAT · UTILS · LISTES · PERSISTANCE · MIGRATION · FILTRES
   Expose window.BM, complété par tdl-botm-render puis tdl-botm-ui.
   Dépend de : tdl-zcats.js, window.EcoCore, window.TDLBase (clés).

   MODÈLE DE DONNÉES — une entreprise = un lieu qui embauche.
   Aucun champ n'est stocké deux fois :
     · lieux/{id}   → identité partagée avec le Répertoire des lieux
                      (nom, type, rue, zone, cat, ic, img, facs, emploi, amb)
     · emplois/{id} → extension propre au bottin
                      (effectif, fondee, rayonnement, desc, accroche,
                       culture, partenaires, rivaux, verrou, complet,
                       referent, brouillon, roles, postes)

   [MAJ v2] SCHÉMA 2 — roles, postes, culture, partenaires et rivaux passent
     aux NŒUDS À CLÉS. C'étaient des tableaux réécrits en bloc par cinq
     chemins : enregistrer ou retirer un rôle, un poste, une étiquette, et
     côté fiche-metier la réservation, la libération et l'attribution.
     DEUX défauts, tous deux silencieux.
     Le premier : deux fiches validées à quelques secondes d'écart sur la même
     entreprise, et le rôle de l'une écrase celui de l'autre — un membre sans
     poste, sans erreur, sans trace.
     Le second : les retraits se faisaient par splice(indice). Retirer un rôle
     ou un poste à la main décalait tous les suivants, de sorte que le ✕
     d'après visait la mauvaise ligne.
     Chaque élément porte désormais sa clé et s'écrit seul.

   La correspondance rôle → poste reste ce qu'elle était : le LIBELLÉ. Elle ne
   vaut que pour les rôles nés d'un poste listé, créés par fiche-metier, qui
   recopie l'intitulé lui-même depuis la liste — la correspondance est donc
   garantie par construction. Les autres rôles (direction, PNJ, pré-lien)
   portent une fonction libre et n'occupent aucune place : c'est voulu, postes
   à pourvoir et gens en place sont deux listes distinctes.

   Un rôle vaut {nom, poste, depuis, type, lien, dir} et, pour les seuls
   rôles de type 'pj', un 'uid' capté à l'enregistrement depuis la carte
   faceclaim. Cet uid est la seule identité stable d'un compte : il survit
   à un changement de pseudo.

   Les avatars des rôles occupés ne sont pas stockés ici : ils sont résolus à
   la lecture depuis le nœud 'faceclaims', lu en branche ciblée au même titre
   que lieux et emplois.
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
  errBase:"Socle manquant : chargez tdl-base.js avant ce script.",
  memo:'Enregistré en mémoire — EcoCore indisponible.',
  aConvertir:'Fiche au format ancien — lancez la conversion (bandeau staff).',
  migTitre:function(n){ return '⚙ '+n+' fiche'+(n>1?'s':'')+' au format ancien.'; },
  migTexte:"Les rôles, postes et étiquettes y sont encore des listes réécrites en bloc : deux validations simultanées peuvent s'y écraser.",
  migBtn:'Convertir maintenant', migCours:'Conversion…',
  migFait:function(n){ return n+' fiche(s) converties.'; },
  migEchec:'Conversion impossible — rien n\u2019a été modifié.',
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
  NODE_FC:      'faceclaims',
  NODE_UIDX:    'uid_index',
  HREF_ACCUEIL: '/',            /* [MAJ] accueil du forum */
  /* [MAJ] lien d'édition du sujet portant ce panneau */
  EDIT_URL: 'https://thedrownedlands.forumactif.com/post?p=477&mode=editpost',
  FORCER_ADMIN: false,          /* [MAJ] true UNIQUEMENT pour un aperçu local */
  MAX_ROLES: 4, MAX_POSTES: 4,  /* éléments affichés avant « voir plus » */
  ICONES: ['fi-tr-truck-side','fi-tr-government-flag','fi-ts-badge-sheriff','fi-ts-marker-hospital',
    'fi-tr-marketplace-store','fi-ts-drink','fi-tr-tree-alt','fi-ts-sailboat','fi-ts-fire-shield',
    'fi-tr-flask','fi-tr-sack-dollar','fi-tr-wheat-awn','fi-ts-pig-face','fi-tr-plane-alt']
};
BM.SCHEMA = 2;
/* listes de l'entreprise passées aux clés en schéma 2 */
BM.LISTES = ['roles','postes','culture','partenaires','rivaux'];
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
BM.FC = {parPseudo:{}, parPrelien:{}, parUid:{}};
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
BM.cle = () => window.TDLBase.nouvelleCle();

BM.icone = function(val){
  if(!val) return '<i class="fi fi-tr-briefcase"></i>';
  if(/^https?:/.test(val)) return '<img src="'+BM.esc(val)+'" alt="">';
  const cls = val.indexOf('fi ')===0 ? val : ('fi '+val);
  return '<i class="'+BM.esc(cls)+'"></i>';
};

/* ===================== LISTES (lecture bi-schéma) =====================
   Rendent toujours [{k, …}] : un tableau v1 reçoit des clés de substitution
   « x<indice> », qui servent à l'affichage mais JAMAIS à une écriture —
   BM.exigeV2() barre la route avant. */
function liste(v){
  const out = [];
  if(v == null) return out;
  const pose = (o,k) => { if(o==null) return; out.push(typeof o==='object' ? Object.assign({},o,{k:k}) : {k:k, v:o}); };
  if(Array.isArray(v)) v.forEach((o,i)=>pose(o,'x'+i));
  else if(typeof v==='object') Object.keys(v).forEach(k=>pose(v[k],k));
  out.sort((a,b)=>String(a.k).localeCompare(String(b.k)));
  return out;
}
BM.roles  = e => liste(e && e.roles);
BM.postes = e => liste(e && e.postes);
/* les étiquettes sont des chaînes : on rend [{k, t}] */
BM.tags   = (e,champ) => liste(e && e[champ]).map(o => ({k:o.k, t:(typeof o.v==='string'?o.v:(o.t||''))}));

BM.aConvertir = e => !!e && e.schema !== BM.SCHEMA;
BM.exigeV2 = function(e){
  if(!BM.aConvertir(e)) return true;
  BM.toast(BM.T.aConvertir, true);
  return false;
};

/* places libres d'un poste = total − rôles portant cet intitulé.
   Inchangé par rapport à la v1 : seule la façon de PARCOURIR les deux listes
   diffère, puisqu'elles sont devenues des nœuds à clés. */
function occupe(e, p){
  return BM.roles(e).filter(r => !!r.poste && r.poste===p.t).length;
}
BM.libresPoste = (e,p) => Math.max(0,(Number(p.n)||0)-occupe(e,p));
BM.libres = e => BM.postes(e).reduce((s,p)=>s+BM.libresPoste(e,p),0);
BM.directionLibre = e => BM.postes(e).some(p=>p.dir&&BM.libresPoste(e,p)>0);
BM.estComplet = e => !!e.complet || (BM.postes(e).length>0 && BM.libres(e)===0);
BM.editable = e => BM.S.admin || (!!e.referent && e.referent===BM.S.moi);
BM.visible = e => !e.brouillon || BM.S.admin || (!!e.referent && e.referent===BM.S.moi);
BM.dirDabord = (a,b) => (b.dir?1:0)-(a.dir?1:0);
BM.ent = id => BM.E.find(x=>x.id===id);

/* ---------- RAPPROCHEMENT AVEC LE BOTTIN DES AVATARS ---------- */
BM.normPseudo = s => String(s||'').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^@/,'');

function scoreFC(c){
  let s = 0;
  if(c.statut === 'pris') s += 4;
  else if(c.statut === 'reserve') s += 1;
  if(c.image) s += 2;
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
BM.nomDe = function(r){
  if(r && r.uid != null && BM.UIDX[String(r.uid)]) return BM.UIDX[String(r.uid)];
  return (r && r.nom) || '';
};
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
BM.uidDe = function(r){
  if(!r || r.type!=='pj') return null;
  const m = /\/u(\d+)/.exec(r.lien||'');
  if(m) return Number(m[1]);
  const c = BM.carteFC(r);
  return (c && c.uid != null) ? c.uid : null;
};
BM.avatarDe = function(r){
  const c = BM.carteFC(r);
  return (c && c.image) || '';
};
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
  const ok = window.EcoCore && typeof window.EcoCore.firebaseGet==='function'
          && typeof window.EcoCore.firebaseUpdate==='function'
          && window.TDLBase && typeof window.TDLBase.nouvelleCle==='function';
  if(ok){ cb(EcoCore); return; }
  if(n > 40){ if(window.console) console.warn('[TDL bottin] EcoCore ou tdl-base introuvable — mode mémoire.'); cb(null); return; }
  setTimeout(()=>ecoPret(cb, n+1), 250);
}
/* fusion lieu + extension métier. [MAJ v2] seuls les facs (qui appartiennent au
   LIEU et restent un tableau) sont normalisés : aplatir roles/postes/tags
   perdrait justement les clés qu'on vient de leur donner. */
function fusionner(id, lieu, emploi){
  const e = Object.assign({id:id}, lieu, emploi||{});
  e.facs = BM.versTableau(e.facs);
  return e;
}
/* [MAJ] quatre branches ciblées (~18 ko) au lieu des 126 ko de la racine. */
BM.charger = function(rendre){
  ecoPret(eco=>{
    if(!eco){ rendre(); return; }
    Promise.all([
      eco.firebaseGet(BM.CFG.NODE_LIEUX),
      eco.firebaseGet(BM.CFG.NODE_EMPLOIS),
      eco.firebaseGet(BM.CFG.NODE_FC),
      eco.firebaseGet(BM.CFG.NODE_UIDX)
    ]).then(r=>{
      const lieux = r[0]||{}, emplois = r[1]||{};
      BM.indexerFaceclaims({ faceclaims: r[2]||{} });
      BM.UIDX = r[3] || {};
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
/* écriture par champ ciblé sur les deux nœuds — jamais de writeBin racine. */
BM.patch = function(e, champs){
  Object.assign(e, champs);
  if(!(window.EcoCore && typeof window.EcoCore.firebaseUpdate==='function')){
    BM.toast(BM.T.memo, true); return Promise.resolve({memoire:true});
  }
  const u = {};
  Object.keys(champs).forEach(k=>{
    const base = BM.CHAMPS_LIEU.indexOf(k)>=0 ? BM.CFG.NODE_LIEUX : BM.CFG.NODE_EMPLOIS;
    u[base+'/'+e.id+'/'+k] = champs[k];
  });
  return window.EcoCore.firebaseUpdate(u).catch(err=>{
    BM.toast(BM.T.errSave+((err&&err.message)||err), true);
    throw err;
  });
};

/* [MAJ v2] écriture d'UN élément de liste : emplois/{id}/{champ}/{clé}.
   N'écrase aucun voisin, et un retrait ne décale plus rien. */
BM.ecrireItem = function(e, champ, cle, valeur){
  if(!(window.EcoCore && typeof window.EcoCore.firebaseUpdate==='function')){
    BM.toast(BM.T.memo, true); return Promise.resolve({memoire:true});
  }
  e[champ] = e[champ] || {};
  if(valeur == null) delete e[champ][cle]; else e[champ][cle] = valeur;
  const u = {}; u[BM.CFG.NODE_EMPLOIS+'/'+e.id+'/'+champ+'/'+cle] = valeur;
  return window.EcoCore.firebaseUpdate(u).catch(err=>{
    BM.toast(BM.T.errSave+((err&&err.message)||err), true);
    throw err;
  });
};
BM.supprimerItem = (e, champ, cle) => BM.ecrireItem(e, champ, cle, null);

BM.soumettreEntreprise = function(e){ return BM.patch(e, {soumis:true}); };
BM.publierEntreprise = function(e){
  e.brouillon = false; e.soumis = false; delete e.masque;
  if(!(window.EcoCore && typeof window.EcoCore.firebaseUpdate==='function')){
    BM.toast(BM.T.memo, true); return Promise.resolve({memoire:true});
  }
  const u = {};
  u[BM.CFG.NODE_EMPLOIS+'/'+e.id+'/brouillon'] = false;
  u[BM.CFG.NODE_EMPLOIS+'/'+e.id+'/soumis'] = null;
  u[BM.CFG.NODE_LIEUX+'/'+e.id+'/masque'] = null;   /* null supprime la clé */
  return window.EcoCore.firebaseUpdate(u);
};
BM.retirerDuBottin = function(e){
  if(!(window.EcoCore && typeof window.EcoCore.firebaseUpdate==='function')) return Promise.resolve({memoire:true});
  const u = {};
  if(e.masque) u[BM.CFG.NODE_LIEUX+'/'+e.id] = null;
  else         u[BM.CFG.NODE_LIEUX+'/'+e.id+'/emploi'] = false;
  u[BM.CFG.NODE_EMPLOIS+'/'+e.id] = null;
  return window.EcoCore.firebaseUpdate(u);
};
/* création : le lieu ET son extension, en une écriture atomique.
   [MAJ v2] naissance directe en schéma 2 : les listes sont des nœuds, et une
   branche vide ne s'écrit pas du tout. */
BM.creerEntreprise = function(e){
  if(!(window.EcoCore && typeof window.EcoCore.firebaseUpdate==='function')) return Promise.resolve({memoire:true});
  const lieu = {}, emploi = {};
  Object.keys(e).forEach(k=>{
    if(k==='id') return;
    if(BM.LISTES.indexOf(k)>=0) return;           /* jamais de liste vide à la création */
    (BM.CHAMPS_LIEU.indexOf(k)>=0 ? lieu : emploi)[k] = e[k];
  });
  emploi.schema = BM.SCHEMA;
  e.schema = BM.SCHEMA;
  BM.LISTES.forEach(k=>{ delete e[k]; });
  const u = {};
  u[BM.CFG.NODE_LIEUX+'/'+e.id] = lieu;
  u[BM.CFG.NODE_EMPLOIS+'/'+e.id] = emploi;
  return window.EcoCore.firebaseUpdate(u);
};

/* ===================== MIGRATION v1 → v2 =====================
   Relit la branche emplois BRUTE — la version en mémoire est fusionnée avec le
   lieu, donc impropre à servir de source. Tout part en UN SEUL PATCH : Firebase
   l'applique en tout ou rien. Idempotente. */
BM.aMigrer = () => BM.E.filter(BM.aConvertir).length;

BM.migrer = function(){
  if(!(window.EcoCore && window.TDLBase)) return Promise.reject(new Error('socle absent'));
  return Promise.resolve(window.EcoCore.firebaseGet(BM.CFG.NODE_EMPLOIS)).then(brut=>{
    brut = brut || {};
    const N = BM.CFG.NODE_EMPLOIS, u = {};
    let n = 0;
    BM.E.forEach(ent=>{
      if(!BM.aConvertir(ent)) return;
      const src = brut[ent.id] || {};
      /* conversion pure : aucun champ n'est ajouté ni réinterprété, chaque
         élément reçoit seulement une clé. */
      const postes = {}, roles = {};
      BM.versTableau(src.postes).forEach(p=>{
        if(!p || typeof p!=='object') return;
        const k = BM.cle(); postes[k] = Object.assign({}, p, {k:k});
      });
      BM.versTableau(src.roles).forEach(r=>{
        if(!r || typeof r!=='object') return;
        const k = BM.cle(); roles[k] = Object.assign({}, r, {k:k});
      });
      u[N+'/'+ent.id+'/postes'] = Object.keys(postes).length ? postes : null;
      u[N+'/'+ent.id+'/roles']  = Object.keys(roles).length  ? roles  : null;
      ['culture','partenaires','rivaux'].forEach(c=>{
        const dst = {};
        BM.versTableau(src[c]).forEach(t=>{ if(t) dst[BM.cle()] = t; });
        u[N+'/'+ent.id+'/'+c] = Object.keys(dst).length ? dst : null;
      });
      u[N+'/'+ent.id+'/schema'] = BM.SCHEMA;
      n++;
    });
    if(!n) return {faits:0};
    return Promise.resolve(window.EcoCore.firebaseUpdate(u)).then(()=>({faits:n}));
  });
};

/* ===================== FILTRES ===================== */
BM.baseZone = () => BM.E.filter(e=>BM.visible(e) && e.zone===BM.S.zone && (BM.S.cat==='tous'||e.cat===BM.S.cat));
BM.filtre = () => BM.baseZone().sort((x,y)=>String(x.nom).localeCompare(String(y.nom),'fr'));
BM.catActive = id => BM.E.some(e=>BM.visible(e) && e.zone===BM.S.zone && e.cat===id);

})();
