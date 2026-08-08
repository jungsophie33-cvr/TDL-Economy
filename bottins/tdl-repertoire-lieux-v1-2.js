/* ============================================================
   TDL — RÉPERTOIRE DES LIEUX · logique
   Classes/ids préfixés « tdlr- » (anti-conflit CSS forum).
   Blocs : TEXTES · CONFIG · DONNÉES · PERSISTANCE · ÉTAT
           UTILS · RENDER · EVENTS · INIT

   Persistance : EcoCore/Firebase, nœuds racine 'lieux' et 'emplois'.
   Toutes les écritures passent par firebaseUpdate (PATCH multi-chemins,
   atomique, n'affecte jamais les nœuds frères). writeField n'est plus
   utilisé : un PUT ne sait écrire qu'un seul chemin, ce qui interdisait
   d'enregistrer le lieu et sa fiche métier en une seule opération.

   Couplé au Bottin des métiers : un lieu coché « emploi possible »
   possède une extension emplois/{id} portant rôles, postes et
   informations d'entreprise. Les deux modules partagent l'identité du
   lieu (nom, type, rue, zone, cat, ic, img, amb) sans jamais la
   dupliquer.

   Dépend de : tdl-zcats.js (window.TDLZonesCats), window.EcoCore
   ============================================================ */
(function(){
"use strict";

/* ===================== TEXTES ===================== */
const TEXTES = {
  accueil:'Accueil', entete:'Répertoire des lieux', modeAdmin:'Administrer',
  lieux:'lieux', ajouter:'+ Créer un lieu', sousInfluence:'Filtrer par influence', moins:'−',
  modifier:'Modifier ce lieu', supprimer:'Supprimer',
  confSupp:'Supprimer définitivement ?', supprOui:'Oui, supprimer', annuler:'Annuler',
  edition:'Édition', nouveau:'Nouveau lieu', creerLieu:'Créer un lieu', sansNom:'Sans nom',
  enregistrer:'Enregistrer', creer:'Créer le lieu', aucun:'Aucun lieu pour ce filtre.',
  retourListe:'← Retour à la liste',
  masque:'en attente',
  chAdresse:'Adresse', chEmploi:'Emploi possible', chInfluence:'Influence',
  emploiOui:'Oui : vos personnages peuvent y travailler.', emploiNon:'Non',
  lienBottin:'Voir les postes à pourvoir →',
  emploiCase:'Les personnages peuvent y être employés', sansFaction:'Aucune influence particulière ici.',
  okSave:'Lieu enregistré.', okDel:'Lieu supprimé.', memSave:'Enregistré (mémoire — non sauvegardé)',
  memDel:'Retiré (mémoire — non sauvegardé)', errSave:"Échec de l'enregistrement : ",
  errDel:'Échec de la suppression : ',
  errCfg:'tdl-zcats.js doit être chargé avant ce script.',
  lbl:{nom:'Nom',type:'Type',adresse:'Adresse',zone:'Zone',categorie:'Catégorie',
       icone:'Icône (classe Flaticon ou URL)',image:'Image (URL, facultatif)',
       influences:'Influences présentes',emploi:'Emploi',ambiance:"Phrase d'ambiance"},
  ph:{nom:'Ex. City Hall',type:'Ex. Hôpital',rue:'Ex. Main Street',
      icone:'fi-tr-flask ou https://…',img:'https://…',amb:'Une ligne qui donne le ton du lieu…'}
};

/* ===================== CONFIG ===================== */
/* [MAJ] identifiants d'éléments du HTML (préfixés) */
const SEL = {zones:'tdlr-zones', cats:'tdlr-cats', facs:'tdlr-facs', liste:'tdlr-liste', panneau:'tdlr-detail',
             compteur:'tdlr-compteur', ajouter:'tdlr-add', admin:'tdlr-admin-toggle', home:'tdlr-home', edit:'tdlr-edit',
             lAccueil:'tdlr-l-accueil', lEntete:'tdlr-l-eyebrow', lLieux:'tdlr-l-lieux', lInfluence:'tdlr-l-influence'};
const FAC_VISIBLES = 5;
const HREF_ACCUEIL = '/';          /* [MAJ] accueil du forum */
const EDIT_URL = 'https://thedrownedlands.forumactif.com/post?p=453&mode=editpost'; /* [MAJ] lien d'édition du sujet portant ce panneau */
const URL_BOTTIN = 'https://thedrownedlands.forumactif.com/t000-bottin-des-metiers'; /* [MAJ] sujet du bottin des métiers */
const FORCER_ADMIN = false;        /* [MAJ] true UNIQUEMENT pour un aperçu admin en local (jamais en prod) */
/* [MAJ] false pour ne JAMAIS réécrire les lieux canoniques ci-dessous si la
   base est vidée. Laisser true garde un filet de sécurité au premier démarrage. */
const SEMER_SI_VIDE = true;
const ICONS = { gov:'<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-7h6v7"/><path d="M4 9h16"/>' };

/* zones et catégories : source unique partagée avec le bottin des métiers */
const ZC = window.TDLZonesCats;
if(!ZC){ if(window.console) console.error('[TDL lieux] '+TEXTES.errCfg); return; }
const ZONES = ZC.ZONES;
const CATS  = ZC.CATS;
const CAT = Object.fromEntries(CATS.map(c=>[c.id,c]));
const catIndex = id => CATS.findIndex(c=>c.id===id);

const FAC = {
  goulipiats:{label:'Goulipiats',        c:'var(--gr1-color)'},
  fardoches:{label:'Fardoches',          c:'var(--gr2-color)'},
  spectres:{label:'Spectres',            c:'var(--gr4-color)'},
  ashlanders:{label:'Ashlanders',        c:'var(--gr3-color)'},
  perles:{label:'Perles',                c:'var(--gr5-color)'},
  main:{label:'La Main',                 c:'var(--gr6-color)'},
  maringouins:{label:'Maringouins',      c:'var(--gr2-color)'},
  braconneurs:{label:'Braconneurs',      c:'var(--gr3-color)'},
  faiseuses:{label:"Faiseuses d'Anges",  c:'var(--gr6-color)'},
  sorcieres:{label:'Sorcières',          c:'var(--gr4-color)'},
  flottille:{label:'Flottille',          c:'var(--gr5-color)'}
};

/* Firebase ne stocke pas les tableaux/objets vides et sérialise les tableaux
   en objets {0:…,1:…} → on normalise toujours en vrai tableau.
   Déclaré ici car la persistance s'en sert. */
const versTableau = v => Array.isArray(v) ? v : (v ? Object.values(v) : []);

/* ===================== DONNÉES =====================
   Jeu canonique minimal, utilisé UNIQUEMENT au premier démarrage si le
   nœud 'lieux' est vide (voir SEMER_SI_VIDE). Tout le reste se crée
   depuis l'interface. */
let LIEUX = [
  {id:"l1",nom:"City Hall", type:"Administration municipale", rue:"Main Street", zone:"houma", cat:"institutions", ic:"fi-tr-government-flag", facs:["goulipiats"], emploi:true, amb:"Les formulaires d'un côté. Le pouvoir de l'autre. Rarement dans le même bureau."},
  {id:"l2",nom:"Council Office", type:"Gouvernance paroissiale & municipale", rue:"Barrow Street", zone:"houma", cat:"institutions", ic:"fi-tr-government-flag", facs:["main"], emploi:false, amb:"Là où les décisions qui affectent toute la paroisse se prennent — et où les grandes familles exercent une influence qui ne figure sur aucun ordre du jour."},
  {id:"l3",nom:"Terrebonne Court of Justice", type:"Tribunal de district", rue:"Barrow Street", zone:"houma", cat:"institutions", ic:"fi-tr-balance-scale-right", facs:["main"], emploi:true, amb:"Les affaires se jugent ici. Ou se règlent avant d'y arriver."},
  {id:"l4",nom:"Terrebonne General Health System", type:"Hôpital", rue:"Corporate Drive", zone:"houma", cat:"sante", ic:"fi-ts-marker-hospital", facs:[], emploi:true, amb:"Le seul hôpital de la paroisse. Il voit passer tout le monde, tôt ou tard."},
  {id:"l5",nom:"Bureau du Shérif", type:"Law Enforcement Center", rue:"Barrow Street", zone:"houma", cat:"institutions", ic:"fi-ts-badge-sheriff", facs:["goulipiats","maringouins","main"], emploi:true, amb:"Juridiction sur toute la paroisse, du centre-ville aux bayous les plus reculés."},
  {id:"l6",nom:"Bureau du Coroner & Crime Lab", type:"Antenne LDWF", rue:"Main Street", zone:"houma", cat:"institutions", ic:"fi-tr-flask", facs:[], emploi:true, amb:"Les morts arrivent ici avec leurs secrets. Ils n'en ressortent pas toujours avec."},
  {id:"l7",nom:"Terrebonne Parish Fire Department", type:"Station 1", rue:"Tunnel Boulevard", zone:"houma", cat:"institutions", ic:"fi-ts-fire-shield", facs:[], emploi:true, amb:"Souvent les premiers sur place — pour sauver des vies ou comprendre qu'arriver trop tard n'est pas nécessairement une question de timing."}
];

/* ===================== PERSISTANCE (EcoCore / Firebase) ===================== */
const CHEMIN_LIEUX   = 'lieux';
const CHEMIN_EMPLOIS = 'emplois';

/* Squelette de fiche métier : créé dès qu'un lieu est coché « emploi ».
   Le Bottin des métiers le complète ensuite (rôles, postes, culture…). */
function squeletteEmploi(){
  return {effectif:'', fondee:'', rayonnement:'', desc:'', accroche:'',
    culture:[], partenaires:[], rivaux:[],
    verrou:false, complet:false, referent:null, brouillon:false,
    roles:[], postes:[]};
}
/* l'id sert de clé Firebase : inutile de le stocker aussi dans le nœud */
function noeudLieu(l){ const o = Object.assign({}, l); delete o.id; return o; }

function ecoPret(cb, n){
  n = n || 0;
  if(window.EcoCore && typeof EcoCore.safeReadBin==='function' && typeof EcoCore.firebaseUpdate==='function'){ cb(EcoCore); return; }
  if(n > 40){ if(window.console) console.warn('[TDL lieux] EcoCore introuvable — mode mémoire.'); cb(null); return; }
  setTimeout(()=>ecoPret(cb, n+1), 250);
}
function semerSiVide(eco){
  const u = {};
  LIEUX.forEach(l => {
    u[CHEMIN_LIEUX+'/'+l.id] = noeudLieu(l);
    if(l.emploi) u[CHEMIN_EMPLOIS+'/'+l.id] = squeletteEmploi();
  });
  eco.firebaseUpdate(u).catch(e=>window.console&&console.error('[TDL lieux] semer', e));
}
const Store = {
  charger(rendre){
    ecoPret(eco=>{
      if(!eco){ rendre(); return; }
      eco.safeReadBin().then(root=>{
        const brut = root && root.lieux;
        if(brut && Object.keys(brut).length){
          LIEUX = Object.entries(brut)
            /* « masque » : lieu créé par le formulaire de validation de fiche pour
               porter une activité de membre, tant qu'elle n'est pas publiée dans
               le Bottin des métiers. Le membre la complète depuis le bottin, pas
               d'ici : seul le staff voit ces lieux en attente. */
            .filter(([,l]) => !l.masque || S.admin)
            .map(([id,l])=>{
              const o = Object.assign({id}, l);
              o.facs = versTableau(o.facs);
              return o;
            });
        } else if(S.admin && SEMER_SI_VIDE){
          semerSiVide(eco);
        } else if(!S.admin){
          LIEUX = [];                 /* base vide : ne rien inventer côté visiteur */
        }
        rendre();
      }).catch(e=>{ if(window.console) console.error('[TDL lieux] charger', e); rendre(); });
    });
  },
  /* Le lieu et sa fiche métier partent ensemble, en un seul PATCH atomique.
     etaitEmploi = valeur de l.emploi AVANT modification (lue dans sauver). */
  enregistrer(l, etaitEmploi){
    if(!(window.EcoCore && typeof EcoCore.firebaseUpdate==='function')) return Promise.resolve({memoire:true});
    const u = {};
    u[CHEMIN_LIEUX+'/'+l.id] = noeudLieu(l);
    if(l.emploi && !etaitEmploi)  u[CHEMIN_EMPLOIS+'/'+l.id] = squeletteEmploi();
    /* décocher « emploi » retire la fiche métier — mais jamais le lieu */
    if(!l.emploi && etaitEmploi)  u[CHEMIN_EMPLOIS+'/'+l.id] = null;
    return EcoCore.firebaseUpdate(u);
  },
  /* supprimer un lieu emporte sa fiche métier : sinon elle resterait orpheline */
  retirer(id){
    if(!(window.EcoCore && typeof EcoCore.firebaseUpdate==='function')) return Promise.resolve({memoire:true});
    const u = {};
    u[CHEMIN_LIEUX+'/'+id]   = null;
    u[CHEMIN_EMPLOIS+'/'+id] = null;
    return EcoCore.firebaseUpdate(u);
  }
};

/* ===================== ÉTAT ===================== */
const STAFF = !!(window._userdata && (window._userdata.user_level===1 || window._userdata.user_level===2));
const S = {zone:'houma', cat:'tous', fac:null, sel:null, admin:(STAFF||FORCER_ADMIN), confirmDel:null, editing:null, vue:'liste'};
let elListe, elPanneau, elApp;
function appliquerVue(){ if(elApp) elApp.classList.toggle('tdlr-vue-detail', S.vue==='detail'); }
const $ = id => document.getElementById(id);

/* ===================== UTILS ===================== */
/* Rendu polymorphe de l'icône d'un lieu : URL → <img>, classe Flaticon → <i>,
   sinon SVG de repli. Aucune dimension en ligne : c'est la feuille de style
   qui dimensionne selon le conteneur (.tdlr-ci i, .tdlr-ric i, .tdlr-ph i…),
   sinon un style inline l'emporterait et rendrait ces règles inopérantes. */
function icon(val){
  if(!val) return '';
  if(/^https?:/.test(val)) return `<img src="${val}" alt="">`;
  if(/^fi[\s-]/.test(val)){ const cls=val.startsWith('fi ')?val:('fi '+val); return `<i class="${cls}"></i>`; }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[val]||ICONS.gov}</svg>`;
}
/* mallette « ce lieu embauche » : même icône Flaticon dans la liste et dans
   le panneau, seule la classe change (l'ancien SVG inline faisait doublon) */
const bag  = ()=>`<i class="fi fi-tr-briefcase tdlr-emploi"></i>`;
const bagP = ()=>`<i class="fi fi-tr-briefcase tdlr-emploip"></i>`;
const dots = f => { f=versTableau(f); return f.length ? `<span class="tdlr-minifacs">${f.map(x=>FAC[x]?`<span class="tdlr-dot" style="background:${FAC[x].c}"></span>`:'').join('')}</span>` : ''; };
const nomsFacs = f => { f=versTableau(f); return f.length ? f.map(x=>FAC[x]?FAC[x].label:x).join(', ') : TEXTES.sansFaction; };
const esc  = s => (s||'').replace(/"/g,'&quot;');
/* catégorie de repli : les données viennent de Firebase, une clé inconnue
   ne doit pas casser le rendu */
const catDe = id => CAT[id] || {id:id, label:'—', c:'var(--dark)', soft:'var(--darkopa2)'};
/* L'apparence vit dans la feuille : .tdlr-toast et .tdlr-toast.tdlr-err.
   Le JS ne fait que poser la classe et gérer le cycle de vie. */
function toast(msg, erreur){
  const t=document.createElement('div');
  t.className='tdlr-toast'+(erreur?' tdlr-err':'');
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>{ t.classList.add('tdlr-out'); setTimeout(()=>t.remove(),400); }, erreur?5000:1800);
}
const parZone = () => LIEUX.filter(l=>l.zone===S.zone);
function filtre(){
  return parZone().filter(l => (S.cat==='tous'||l.cat===S.cat) && (!S.fac || versTableau(l.facs).includes(S.fac)))
    .sort((a,b)=> catIndex(a.cat)-catIndex(b.cat) || a.nom.localeCompare(b.nom,'fr'));
}

/* ===================== RENDER ===================== */
function renderCatCol(){
  const zoneItems = parZone();
  const tabs = [{id:'tous',label:'Tous',ic:'fi-tr-marker',c:'var(--dark)',soft:'var(--darkopa2)'}].concat(CATS);
  $(SEL.cats).innerHTML = tabs.map(t=>{
    const dispo = t.id==='tous' || zoneItems.some(l=>l.cat===t.id);
    return `<button class="tdlr-cat" role="tab" data-c="${t.id}" style="--c:${t.c};--soft:${t.soft}" aria-selected="${t.id===S.cat}" ${dispo?'':'disabled'}><span class="tdlr-ci">${icon(t.ic)}</span><span class="tdlr-cl">${t.label}</span></button>`;
  }).join('');
  $(SEL.cats).querySelectorAll('.tdlr-cat').forEach(b=>b.addEventListener('click',()=>{
    if(b.disabled) return; S.cat=b.dataset.c; S.sel=null; S.editing=null; S.vue='liste';
    $(SEL.cats).querySelectorAll('.tdlr-cat').forEach(x=>x.setAttribute('aria-selected',x.dataset.c===S.cat));
    renderList(); appliquerVue();
  }));
}
function rowHTML(l){const c=catDe(l.cat);
  return `<div class="tdlr-row" data-id="${l.id}" aria-current="${l.id===S.sel}" style="--c:${c.c};--soft:${c.soft}">
    <span class="tdlr-ric">${icon(l.ic)}</span>
    <span class="tdlr-rtxt"><span class="tdlr-rnom">${l.nom}${l.emploi?bag():''}${
      l.masque?`<span class="tdlr-masque">${TEXTES.masque}</span>`:''}</span><span class="tdlr-rmeta">${l.type}</span></span>
    ${dots(l.facs)}
    <svg class="tdlr-rchev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 6 6 6-6 6"/></svg>
  </div>`;
}
function renderList(){
  const data = filtre();
  $(SEL.compteur).textContent = data.length;
  if(!data.find(l=>l.id===S.sel)) S.sel = data[0]?data[0].id:null;
  elListe.innerHTML = data.length ? data.map(rowHTML).join('')
    : `<div class="tdlr-vide">${TEXTES.aucun}</div>`;
  elListe.querySelectorAll('.tdlr-row').forEach(r=>r.addEventListener('click',()=>{
    S.sel=r.dataset.id; S.confirmDel=null; S.editing=null; S.vue='detail';
    elListe.querySelectorAll('.tdlr-row').forEach(x=>x.setAttribute('aria-current',x.dataset.id===S.sel));
    renderPanneau(); appliquerVue();
  }));
  renderPanneau();
}
function renderPanneau(){
  if(S.editing) return renderForm();
  const l = LIEUX.find(x=>x.id===S.sel);
  if(!l){ elPanneau.innerHTML=''; return; }
  const c = catDe(l.cat);
  const visuel = () => l.img ? `<img src="${l.img}" alt="${esc(l.nom)}">` : `<div class="tdlr-ph">${icon(l.ic)}</div>`;
  /* le lien vers le bottin est visible de tous, pas seulement du staff */
  const emploiTxt = l.emploi
    ? `${TEXTES.emploiOui} <a class="tdlr-lienbottin" href="${URL_BOTTIN}#bm-${l.id}">${TEXTES.lienBottin}</a>`
    : TEXTES.emploiNon;
  const admin = S.admin ? `<div class="tdlr-padmin">${
    S.confirmDel===l.id
      ? `<span class="tdlr-cq">${TEXTES.confSupp}</span><button class="tdlr-btn tdlr-danger" data-act="delyes">${TEXTES.supprOui}</button><button class="tdlr-btn" data-act="delno">${TEXTES.annuler}</button>`
      : `<button class="tdlr-btn" data-act="edit">${TEXTES.modifier}</button><button class="tdlr-btn tdlr-danger" data-act="del">${TEXTES.supprimer}</button>`
  }</div>` : '';
  elPanneau.innerHTML = `
    <button class="tdlr-retour" data-act="retour">${TEXTES.retourListe}</button>
    <div class="tdlr-pbanner" style="--c:${c.c};--soft:${c.soft}">${visuel()}</div>
    <div class="tdlr-pbody">
      <div class="tdlr-phead">
        <div class="tdlr-pavatar" style="--c:${c.c};--soft:${c.soft}">${visuel()}</div>
        <div class="tdlr-ptitle">
          <p class="tdlr-peyebrow">${ZC.titreZone(l.zone)} · ${c.label}</p>
          <h2>${l.nom}${l.emploi?bagP():''}</h2>
          <div class="tdlr-pmeta">${l.type}</div>
        </div>
      </div>
      <p class="tdlr-pamb">${l.amb}</p>
      <div class="tdlr-pfield"><b>${TEXTES.chAdresse}</b><span>${l.rue}</span></div>
      <div class="tdlr-pfield"><b>${TEXTES.chEmploi}</b><span>${emploiTxt}</span></div>
      <div class="tdlr-pfield"><b>${TEXTES.chInfluence}</b><span>${nomsFacs(l.facs)}</span></div>
      ${admin}
    </div>`;
  const ret=elPanneau.querySelector('[data-act="retour"]'); if(ret) ret.addEventListener('click',()=>{S.vue='liste';appliquerVue();});
  elPanneau.querySelectorAll('.tdlr-padmin [data-act]').forEach(b=>b.addEventListener('click',()=>{
    const a=b.dataset.act;
    if(a==='edit'){S.editing=l.id;renderPanneau();}
    else if(a==='del'){S.confirmDel=l.id;renderPanneau();}
    else if(a==='delno'){S.confirmDel=null;renderPanneau();}
    else if(a==='delyes'){supprimerLieu(l.id);}
  }));
}
function renderForm(){
  const neuf = S.editing==='new';
  const l = neuf ? {id:null,nom:'',type:'',rue:'',zone:S.zone,cat:(S.cat!=='tous'?S.cat:'institutions'),ic:'',facs:[],emploi:false,img:'',amb:''} : LIEUX.find(x=>x.id===S.editing);
  const opt = (arr,val,txt)=>arr.map(o=>`<option value="${o.id}" ${o.id===val?'selected':''}>${txt(o)}</option>`).join('');
  const T=TEXTES.lbl, P=TEXTES.ph;
  const datalist = ['fi-tr-marker','fi-tr-government-flag','fi-ts-shield-check','fi-ts-marker-hospital','fi-tr-marketplace-store','fi-ts-drink','fi-tr-tree-alt','fi-ts-sailboat','fi-ts-fire-shield','fi-tr-balance-scale-right','fi-tr-pharmacy-symbol','fi-ts-badge-sheriff','fi-tr-sack-dollar','fi-tr-wheat-awn','fi-ts-pig-face','fi-tr-flask'].map(v=>`<option value="${v}">`).join('');
  elPanneau.innerHTML = `
    <div class="tdlr-pbody">
      <p class="tdlr-peyebrow">${neuf?TEXTES.nouveau:TEXTES.edition}</p>
      <h2>${neuf?TEXTES.creerLieu:(l.nom||TEXTES.sansNom)}</h2>
      <div class="tdlr-pform">
        <div class="tdlr-field tdlr-full"><label>${T.nom}</label><input id="tdlr-f-nom" value="${esc(l.nom)}" placeholder="${P.nom}"></div>
        <div class="tdlr-field"><label>${T.type}</label><input id="tdlr-f-type" value="${esc(l.type)}" placeholder="${P.type}"></div>
        <div class="tdlr-field"><label>${T.adresse}</label><input id="tdlr-f-rue" value="${esc(l.rue)}" placeholder="${P.rue}"></div>
        <div class="tdlr-field"><label>${T.zone}</label><select id="tdlr-f-zone">${opt(ZONES,l.zone,z=>z.titre)}</select></div>
        <div class="tdlr-field"><label>${T.categorie}</label><select id="tdlr-f-cat">${opt(CATS,l.cat,c=>c.label)}</select></div>
        <div class="tdlr-field"><label>${T.icone}</label><input id="tdlr-f-ic" list="tdlr-icones" value="${esc(l.ic)}" placeholder="${P.icone}"><datalist id="tdlr-icones">${datalist}</datalist></div>
        <div class="tdlr-field"><label>${T.image}</label><input id="tdlr-f-img" value="${esc(l.img)}" placeholder="${P.img}"></div>
        <div class="tdlr-field tdlr-full"><label>${T.influences}</label><div class="tdlr-checks">${Object.entries(FAC).map(([k,v])=>`<label><input type="checkbox" class="tdlr-f-fac" value="${k}" ${versTableau(l.facs).includes(k)?'checked':''}> ${v.label}</label>`).join('')}</div></div>
        <div class="tdlr-field tdlr-full"><label>${T.emploi}</label><div class="tdlr-checks"><label><input type="checkbox" id="tdlr-f-emploi" ${l.emploi?'checked':''}> ${TEXTES.emploiCase}</label></div></div>
        <div class="tdlr-field tdlr-full"><label>${T.ambiance}</label><textarea id="tdlr-f-amb" placeholder="${P.amb}">${l.amb||''}</textarea></div>
      </div>
      <div class="tdlr-padmin">
        <button class="tdlr-btn tdlr-primary" data-act="save">${neuf?TEXTES.creer:TEXTES.enregistrer}</button>
        <button class="tdlr-btn" data-act="cancel">${TEXTES.annuler}</button>
      </div>
    </div>`;
  elPanneau.querySelector('[data-act="cancel"]').addEventListener('click',()=>{S.editing=null;S.vue='liste';renderList();appliquerVue();});
  elPanneau.querySelector('[data-act="save"]').addEventListener('click',()=>sauver(neuf?null:l.id));
}

/* ===================== EVENTS (données) ===================== */
function sauver(existingId){
  const nom=$('tdlr-f-nom').value.trim();
  if(!nom){$('tdlr-f-nom').style.borderColor='var(--gr6-color)';$('tdlr-f-nom').focus();return;}
  const cat=$('tdlr-f-cat').value;
  const data={nom, type:$('tdlr-f-type').value.trim(), rue:$('tdlr-f-rue').value.trim()||'—', zone:$('tdlr-f-zone').value, cat,
    ic:$('tdlr-f-ic').value.trim(), img:$('tdlr-f-img').value.trim(),
    facs:[...elPanneau.querySelectorAll('.tdlr-f-fac:checked')].map(c=>c.value),
    emploi:$('tdlr-f-emploi').checked, amb:$('tdlr-f-amb').value.trim()||'—'};
  let cible, etaitEmploi = false;
  if(existingId){
    cible = LIEUX.find(x=>x.id===existingId);
    etaitEmploi = !!(cible && cible.emploi);       /* lu AVANT l'écrasement */
    /* on repart d'un objet propre : les champs hérités d'anciennes versions
       (ex. le drapeau « exemple ») disparaissent à l'enregistrement */
    Object.keys(cible).forEach(k=>{ if(k!=='id') delete cible[k]; });
    Object.assign(cible, data);
  }
  else { data.id='lieu_'+Date.now().toString(36); LIEUX.push(data); cible=data; }
  Store.enregistrer(cible, etaitEmploi)
    .then(r=>toast(r&&r.memoire?TEXTES.memSave:TEXTES.okSave))
    .catch(e=>toast(TEXTES.errSave+((e&&e.message)||e), true));
  S.sel=cible.id; S.zone=data.zone; S.cat='tous'; S.fac=null; S.editing=null; S.confirmDel=null; S.vue='detail';
  syncControles(); renderCatCol(); renderList(); appliquerVue();
}
function supprimerLieu(id){
  LIEUX = LIEUX.filter(l=>l.id!==id);
  Store.retirer(id)
    .then(r=>toast(r&&r.memoire?TEXTES.memDel:TEXTES.okDel))
    .catch(e=>toast(TEXTES.errDel+((e&&e.message)||e), true));
  S.sel=null; S.confirmDel=null; S.editing=null; S.vue='liste';
  renderCatCol(); renderList(); appliquerVue();
}

/* ===================== EVENTS (contrôles) ===================== */
function syncControles(){
  $(SEL.zones).querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected',x.dataset.z===S.zone));
  $(SEL.facs).querySelectorAll('.tdlr-chip[data-f]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.f===S.fac));
}
function construireZones(){
  $(SEL.zones).innerHTML = ZONES.map(z=>`<button role="tab" data-z="${z.id}" aria-selected="${z.id===S.zone}">${z.titre}</button>`).join('');
  $(SEL.zones).querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    S.zone=b.dataset.z; S.cat='tous'; S.sel=null; S.confirmDel=null; S.editing=null; S.vue='liste';
    syncControles(); renderCatCol(); renderList(); appliquerVue();
  }));
}
function construireInfluences(){
  const entries=Object.entries(FAC);
  const facs=$(SEL.facs);
  facs.innerHTML =
    entries.map(([k,v])=>`<button class="tdlr-chip" data-f="${k}" style="--fc:${v.c}" aria-pressed="false">${v.label}</button>`).join('')
    + `<button class="tdlr-chip tdlr-more" data-more aria-expanded="false"></button>`;
  const more=facs.querySelector('[data-more]');
  const compact=()=>window.matchMedia('(max-width:820px)').matches;      /* sous 820px : tout replié */
  const nCaches=()=>compact()?entries.length:(entries.length-FAC_VISIBLES);
  function majVisibilite(){
    const c=compact();
    facs.querySelectorAll('.tdlr-chip[data-f]').forEach((chip,i)=>chip.classList.toggle('tdlr-extra', c ? true : i>=FAC_VISIBLES));
    if(!facs.classList.contains('tdlr-open')) more.textContent='+'+nCaches();
  }
  facs.querySelectorAll('.tdlr-chip[data-f]').forEach(b=>b.addEventListener('click',()=>{
    S.fac=(S.fac===b.dataset.f)?null:b.dataset.f;
    facs.querySelectorAll('.tdlr-chip[data-f]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.f===S.fac));
    S.editing=null; S.vue='liste'; renderList(); appliquerVue();
  }));
  more.addEventListener('click',()=>{
    const open=facs.classList.toggle('tdlr-open');
    more.textContent = open ? TEXTES.moins : '+'+nCaches();
    more.setAttribute('aria-expanded',open);
  });
  window.addEventListener('resize', majVisibilite);
  majVisibilite();
}
function appliquerAdmin(){ document.body.classList.toggle('tdlr-body-admin',S.admin); if(!S.admin) S.editing=null; renderPanneau(); }

/* ===================== INIT ===================== */
function init(){
  if(!document.querySelector('meta[name="viewport"]')){
    const mv=document.createElement('meta'); mv.name='viewport'; mv.content='width=device-width, initial-scale=1';
    document.head.appendChild(mv);
  }
  /* Sort l'overlay du contexte du forum (#sj-main/#wrap) : évite que la largeur mini
     ou un transform d'un ancêtre ne piège le position:fixed et ne dézoome la page. */
  const rep=document.querySelector('.tdlr-rep');
  if(rep && rep.parentNode!==document.body) document.body.appendChild(rep);
  elListe = $(SEL.liste); elPanneau = $(SEL.panneau); elApp = document.querySelector('.tdlr-app');
  if(!elListe || !elPanneau) return;              /* structure absente → on sort */
  const home=$(SEL.home); if(home) home.setAttribute('href',HREF_ACCUEIL);
  const edit=$(SEL.edit); 
   if(edit){
    edit.setAttribute('href',EDIT_URL);
    edit.addEventListener("click", function(ev){
      ev.preventDefault(); ev.stopPropagation();
      window.location.href = CFG.EDIT_URL;
     });  
   }
  $(SEL.lAccueil).textContent   = TEXTES.accueil;
  $(SEL.lEntete).textContent    = TEXTES.entete;
  $(SEL.lLieux).textContent     = TEXTES.lieux;
  $(SEL.lInfluence).textContent = TEXTES.sousInfluence;
  $(SEL.ajouter).textContent    = TEXTES.ajouter;
  construireZones();
  construireInfluences();
  $(SEL.ajouter).addEventListener('click',()=>{S.editing='new';S.confirmDel=null;S.vue='detail';renderPanneau();appliquerVue();});
  const at=$(SEL.admin); if(at) at.remove();   /* pas de bouton « mode admin » : l'accès dépend UNIQUEMENT du staff */
  appliquerAdmin();
  renderCatCol();
  Store.charger(renderList);
}
/* la structure #tdlr-liste peut être injectée après le load (template FA) → on attend */
(function attendreDOM(n){
  n=n||0;
  if(document.getElementById(SEL.liste)){ init(); return; }
  if(n>60) return;
  setTimeout(()=>attendreDOM(n+1), 250);
})();
window.addEventListener('load', ()=>{ if(document.getElementById(SEL.liste) && !elListe) init(); });

})();
