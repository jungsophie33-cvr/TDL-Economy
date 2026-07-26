/* ============================================================
   TDL — RÉPERTOIRE DES LIEUX · logique
   Blocs : TEXTES · CONFIG · DONNÉES · PERSISTANCE · ÉTAT
           UTILS · RENDER · EVENTS · INIT
   Persistance : EN MÉMOIRE (prototype). Le bloc PERSISTANCE
   isole les 3 points où brancher Firebase (voir commentaires).
   ============================================================ */
(function(){
"use strict";

/* ===================== TEXTES ===================== */
const TEXTES = {
  accueil:'Accueil',
  entete:'Répertoire des lieux',
  modeAdmin:'Administrer',
  lieux:'lieux',
  ajouter:'+ Ajouter',
  sousInfluence:'Sous influence',
  moins:'−',
  modifier:'Modifier ce lieu', supprimer:'Supprimer',
  confSupp:'Supprimer définitivement ?', supprOui:'Oui, supprimer', annuler:'Annuler',
  edition:'Édition', nouveau:'Nouveau lieu', creerLieu:'Créer un lieu', sansNom:'Sans nom',
  enregistrer:'Enregistrer', creer:'Créer le lieu',
  aucun:'Aucun lieu pour ce filtre.',
  chAdresse:'Adresse', chEmploi:'Emploi possible', chInfluence:'Influence',
  emploiOui:'Oui — vos personnages peuvent y travailler.', emploiNon:'Non',
  emploiCase:'Les personnages peuvent y être employés',
  sansFaction:'Aucune influence communautaire ou de bande',
  lbl:{nom:'Nom',type:'Type',adresse:'Adresse',zone:'Zone',categorie:'Catégorie',
       icone:'Icône (classe Flaticon ou URL)',image:'Image (URL, facultatif)',
       influences:'Influences présentes',emploi:'Emploi',ambiance:"Phrase d'ambiance"},
  ph:{nom:'Ex. City Hall',type:'Ex. Hôpital',rue:'Ex. Main Street',
      icone:'fi-tr-flask ou https://…',img:'https://…',amb:'Une ligne qui donne le ton du lieu…'}
};

/* ===================== CONFIG ===================== */
/* [MAJ] identifiants d'éléments du HTML */
const SEL = {tabs:'tabs', cats:'cattabs', facs:'chips-fac', liste:'idx-list', panneau:'panneau',
             compteur:'compteur', ajouter:'add', admin:'adminToggle',
             lAccueil:'lbl-accueil', lEntete:'lbl-eyebrow', lLieux:'lbl-lieux',
             lInfluence:'lbl-influence'};

const FAC_VISIBLES = 5;               /* nb d'influences affichées avant le « + » */
const HREF_ACCUEIL = '/';             /* [MAJ] accueil du forum */

/* Icône SVG de repli (si une valeur n'est ni Flaticon ni URL) */
const ICONS = { gov:'<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-7h6v7"/><path d="M4 9h16"/>' };

/* Influences → libellé + couleur (var forum). 5 premières visibles, reste sous « + ». */
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

const ZONES = [
  {id:'houma',titre:'Houma'},{id:'bayou_cane',titre:'Bayou Cane'},{id:'bayou_blue',titre:'Bayou Blue'},
  {id:'bourg',titre:'Bourg'},{id:'ashland',titre:'Ashland'},{id:'montegut',titre:'Montegut'},
  {id:'lost_bayou',titre:'Lost Bayou'},{id:'terrebonne_bay',titre:'Terrebonne Bay'}
];

/* Catégories → libellé · icône Flaticon · couleur + variante (var forum) */
const CATS = [
  {id:'institutions', label:'Institutions',   ic:'fi-tr-government-flag',   c:'var(--gr3-color)', soft:'var(--gr3-20)'},
  {id:'sante',        label:'Santé',          ic:'fi-ts-marker-hospital',   c:'var(--gr6-color)', soft:'var(--gr6-20)'},
  {id:'services',     label:'Services',       ic:'fi-tr-marketplace-store', c:'var(--gr1-color)', soft:'var(--gr1-20)'},
  {id:'loisirs',      label:'Loisirs',        ic:'fi-ts-drink',             c:'var(--gr4-color)', soft:'var(--gr4-20)'},
  {id:'nature',       label:'Nature',         ic:'fi-tr-tree-alt',          c:'var(--gr2-color)', soft:'var(--gr2-20)'},
  {id:'fermes',       label:'Fermes',         ic:'fi-tr-wheat-awn',         c:'var(--clair2)',    soft:'var(--clair2opa2)'},
  {id:'peche',        label:"Au fil de l'eau", ic:'fi-ts-sailboat',         c:'var(--gr5-color)', soft:'var(--gr5-20)'}
];
const CAT = Object.fromEntries(CATS.map(c=>[c.id,c]));
const catIndex = id => CATS.findIndex(c=>c.id===id);

/* ===================== DONNÉES ===================== */
/* Jeu de départ (7 lieux réels de Houma) + exemples de démonstration.
   Icône par lieu = classe Flaticon (fi-tr-… / fi-ts-…). */
let LIEUX = [
  {id:"l1",nom:"City Hall", type:"Administration municipale", rue:"Main Street", zone:"houma", cat:"institutions", ic:"fi-tr-government-flag", facs:["goulipiats"], emploi:true, amb:"Les formulaires d'un côté. Le pouvoir de l'autre. Rarement dans le même bureau."},
  {id:"l2",nom:"Council Office", type:"Gouvernance paroissiale & municipale", rue:"Barrow Street", zone:"houma", cat:"institutions", ic:"fi-tr-government-flag", facs:["main"], emploi:false, amb:"Là où les décisions qui affectent toute la paroisse se prennent — et où les grandes familles exercent une influence qui ne figure sur aucun ordre du jour."},
  {id:"l3",nom:"Terrebonne Court of Justice", type:"Tribunal de district", rue:"Barrow Street", zone:"houma", cat:"institutions", ic:"fi-tr-balance-scale-right", facs:["main"], emploi:true, amb:"Les affaires se jugent ici. Ou se règlent avant d'y arriver."},
  {id:"l4",nom:"Terrebonne General Health System", type:"Hôpital", rue:"Corporate Drive", zone:"houma", cat:"sante", ic:"fi-ts-marker-hospital", facs:[], emploi:true, amb:"Le seul hôpital de la paroisse. Il voit passer tout le monde, tôt ou tard."},
  {id:"l5",nom:"Bureau du Shérif", type:"Law Enforcement Center", rue:"Barrow Street", zone:"houma", cat:"institutions", ic:"fi-ts-badge-sheriff", facs:["goulipiats","maringouins","main"], emploi:true, amb:"Juridiction sur toute la paroisse, du centre-ville aux bayous les plus reculés."},
  {id:"l6",nom:"Bureau du Coroner & Crime Lab", type:"Antenne LDWF", rue:"Main Street", zone:"houma", cat:"institutions", ic:"fi-tr-flask", facs:[], emploi:true, amb:"Les morts arrivent ici avec leurs secrets. Ils n'en ressortent pas toujours avec."},
  {id:"l7",nom:"Terrebonne Parish Fire Department", type:"Station 1", rue:"Tunnel Boulevard", zone:"houma", cat:"institutions", ic:"fi-ts-fire-shield", facs:[], emploi:true, amb:"Souvent les premiers sur place — pour sauver des vies ou comprendre qu'arriver trop tard n'est pas nécessairement une question de timing."}
];
/* --- exemples de démonstration : à retirer en prod (ligne genererExemples()) --- */
function genererExemples(){
  const noms=["Almanach","Brasserie Bourbon","Chapelle Sainte-Croix","Diner du Canal","Épicerie générale","Ferronnerie Landry","Garage Naquin","Halle aux poissons","Imprimerie paroissiale","Jardin public","Kiosque du marché","Librairie Fontenot","Mercerie","Négoce du fleuve","Officine Dahl","Pharmacie centrale","Quincaillerie","Réserve d'appâts","Salle des ventes","Taverne du port","Usine à glace","Vieux comptoir","Woodshop Martens","Yard de ferraille","Zinc du canal","Atelier de couture","Banque locale","Café des platanes","Débarcadère est","Foyer municipal"];
  const cats=["services","loisirs","peche","services","institutions","loisirs","peche","nature","services","peche"];
  const ic={services:"fi-tr-marketplace-store",loisirs:"fi-ts-drink",peche:"fi-ts-sailboat",nature:"fi-tr-tree-alt",institutions:"fi-tr-government-flag"};
  const zs=["houma","bayou_cane","bayou_blue","bourg","ashland","montegut","lost_bayou","terrebonne_bay"];
  const facs=[[],[],["maringouins"],["braconneurs"],["flottille"],["spectres"],["perles"],[]];
  noms.forEach((n,i)=>{
    let cat=cats[i%cats.length], ico=ic[cat];
    if(n==="Pharmacie centrale"){cat="sante";ico="fi-tr-pharmacy-symbol";}
    else if(n==="Banque locale"){cat="services";ico="fi-tr-sack-dollar";}
    else if(["Halle aux poissons","Réserve d'appâts","Négoce du fleuve","Débarcadère est"].includes(n)){cat="peche";ico="fi-ts-sailboat";}
    LIEUX.push({id:"f"+i,nom:n,type:"Lieu",rue:"— exemple —",zone:zs[i%zs.length],cat,ic:ico,facs:facs[i%facs.length],emploi:i%3!==0,exemple:true,amb:"Description d'ambiance à écrire pour ce lieu."});
  });
  LIEUX.push({id:"fa1",nom:"Plantation sucrière",type:"Plantation de canne",rue:"— exemple —",zone:"bayou_blue",cat:"fermes",ic:"fi-tr-wheat-awn",facs:["goulipiats"],emploi:true,exemple:true,amb:"Description d'ambiance à écrire pour ce lieu."});
  LIEUX.push({id:"fa2",nom:"Ferme d'élevage",type:"Élevage",rue:"— exemple —",zone:"montegut",cat:"fermes",ic:"fi-ts-pig-face",facs:[],emploi:true,exemple:true,amb:"Description d'ambiance à écrire pour ce lieu."});
  LIEUX.push({id:"fa3",nom:"Domaine agricole",type:"Exploitation",rue:"— exemple —",zone:"bourg",cat:"fermes",ic:"fi-tr-wheat-awn",facs:["fardoches"],emploi:true,exemple:true,amb:"Description d'ambiance à écrire pour ce lieu."});
}
/* genererExemples();  ← retire cette ligne pour ne garder que le lore réel */

/* ===================== PERSISTANCE (EcoCore / Firebase) ===================== */
/* Utilise window.EcoCore (eco-core-v1-4.js) s'il est chargé ; sinon repli mémoire.
   Collection racine : 'lieux' → chaque lieu sous  lieux/<id>.
     charger     → EcoCore.safeReadBin()  puis  LIEUX = valeurs de root.lieux
     enregistrer → EcoCore.writeField('lieux/'+id, lieu)         (PUT ciblé, création/modif)
     retirer     → EcoCore.firebaseUpdate({ 'lieux/'+id: null }) (null = suppression)
   Auth gérée par EcoCore (anonyme ; invités en lecture seule).
   Règle Firebase : le nœud 'lieux' hérite de la racine (.read:true / .write:auth!=null). */
const CHEMIN_LIEUX = 'lieux';

function ecoPret(cb, n){
  n = n || 0;
  if(window.EcoCore && typeof EcoCore.safeReadBin==='function' && typeof EcoCore.writeField==='function'){ cb(EcoCore); return; }
  if(n > 40){ if(window.console) console.warn('[TDL lieux] EcoCore introuvable — mode mémoire (aucune sauvegarde). Charger eco-core avant tdl-repertoire.js.'); cb(null); return; }
  setTimeout(()=>ecoPret(cb, n+1), 250);   /* attend l'init d'EcoCore (injection FA asynchrone) */
}
/* 1re utilisation (base vide) : sème le jeu de départ dans Firebase (staff uniquement). */
function semerSiVide(eco){
  const updates = {};
  LIEUX.forEach(l => { updates[CHEMIN_LIEUX+'/'+l.id] = l; });
  eco.firebaseUpdate(updates).catch(e=>window.console&&console.error('[TDL lieux] semer', e));
}
const Store = {
  charger(rendre){
    ecoPret(eco=>{
      if(!eco){ rendre(); return; }                         /* repli mémoire : garde les DONNÉES */
      eco.safeReadBin().then(root=>{
        const brut = root && root.lieux;
        if(brut && Object.keys(brut).length){
          LIEUX = Object.entries(brut).map(([id,l])=>Object.assign({id}, l));  /* clé = id fiable */
        } else if(S.admin){
          semerSiVide(eco);                                 /* base vide + staff → amorçage */
        }
        rendre();
      }).catch(e=>{ if(window.console) console.error('[TDL lieux] charger', e); rendre(); });
    });
  },
  enregistrer(l){
    if(window.EcoCore && EcoCore.writeField)
      EcoCore.writeField(CHEMIN_LIEUX+'/'+l.id, l).catch(e=>window.console&&console.error('[TDL lieux] enregistrer', e));
  },
  retirer(id){
    if(window.EcoCore && EcoCore.firebaseUpdate)
      EcoCore.firebaseUpdate({ [CHEMIN_LIEUX+'/'+id]: null }).catch(e=>window.console&&console.error('[TDL lieux] retirer', e));
  }
};

/* ===================== ÉTAT ===================== */
const STAFF = !!(window._userdata && (window._userdata.user_level===1 || window._userdata.user_level===2));
const S = {zone:'houma', cat:'tous', fac:null, sel:null, admin:STAFF, confirmDel:null, editing:null};
const $ = id => document.getElementById(id);
let elListe, elPanneau;

/* ===================== UTILS ===================== */
function icon(val,size){
  if(!val) return '';
  if(/^https?:/.test(val)) return `<img src="${val}" width="${size}" height="${size}" alt="" style="object-fit:contain">`;
  if(/^fi[\s-]/.test(val)){ const cls=val.startsWith('fi ')?val:('fi '+val); return `<i class="${cls}" style="font-size:${size}px;line-height:1;display:inline-flex"></i>`; }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[val]||ICONS.gov}</svg>`;
}
const bag  = ()=>`<svg class="emploi" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
const bagP = ()=>`<svg class="emploi-p" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
const dots = f => f.length ? `<span class="mini-facs">${f.map(x=>FAC[x]?`<span class="dot" style="background:${FAC[x].c}"></span>`:'').join('')}</span>` : '';
const nomsFacs = f => f.length ? f.map(x=>FAC[x]?FAC[x].label:x).join(', ') : TEXTES.sansFaction;
const esc  = s => (s||'').replace(/"/g,'&quot;');
const parZone = () => LIEUX.filter(l=>l.zone===S.zone);
function filtre(){
  return parZone().filter(l => (S.cat==='tous'||l.cat===S.cat) && (!S.fac||l.facs.includes(S.fac)))
    .sort((a,b)=> catIndex(a.cat)-catIndex(b.cat) || a.nom.localeCompare(b.nom,'fr'));
}

/* ===================== RENDER ===================== */
function renderCatCol(){
  const zoneItems = parZone();
  const tabs = [{id:'tous',label:'Tous',ic:'fi-tr-marker',c:'var(--dark)',soft:'var(--darkopa2)'}].concat(CATS);
  $(SEL.cats).innerHTML = tabs.map(t=>{
    const dispo = t.id==='tous' || zoneItems.some(l=>l.cat===t.id);
    return `<button class="cat" role="tab" data-c="${t.id}" style="--c:${t.c};--soft:${t.soft}" aria-selected="${t.id===S.cat}" ${dispo?'':'disabled'}><span class="ci">${icon(t.ic,26)}</span><span class="cl">${t.label}</span></button>`;
  }).join('');
  $(SEL.cats).querySelectorAll('.cat').forEach(b=>b.addEventListener('click',()=>{
    if(b.disabled) return; S.cat=b.dataset.c; S.sel=null; S.editing=null;
    $(SEL.cats).querySelectorAll('.cat').forEach(x=>x.setAttribute('aria-selected',x.dataset.c===S.cat));
    renderList();
  }));
}
function rowHTML(l){const c=CAT[l.cat];
  return `<div class="row" data-id="${l.id}" aria-current="${l.id===S.sel}" style="--c:${c.c};--soft:${c.soft}">
    <span class="r-ic">${icon(l.ic,18)}</span>
    <span class="r-txt"><span class="r-nom">${l.nom}${l.exemple?'<span class="exq">exemple</span>':''}${l.emploi?bag():''}</span><span class="r-meta">${l.type}</span></span>
    ${dots(l.facs)}
    <svg class="r-chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 6 6 6-6 6"/></svg>
  </div>`;
}
function renderList(){
  const data = filtre();
  $(SEL.compteur).textContent = data.length;
  if(!data.find(l=>l.id===S.sel)) S.sel = data[0]?data[0].id:null;
  elListe.innerHTML = data.length ? data.map(rowHTML).join('')
    : `<div style="padding:40px 20px;color:var(--darkopa5);font-style:italic">${TEXTES.aucun}</div>`;
  elListe.querySelectorAll('.row').forEach(r=>r.addEventListener('click',()=>{
    S.sel=r.dataset.id; S.confirmDel=null; S.editing=null;
    elListe.querySelectorAll('.row').forEach(x=>x.setAttribute('aria-current',x.dataset.id===S.sel));
    renderPanneau();
  }));
  renderPanneau();
}
function renderPanneau(){
  if(S.editing) return renderForm();
  const l = LIEUX.find(x=>x.id===S.sel);
  if(!l){ elPanneau.innerHTML=''; return; }
  const c = CAT[l.cat];
  const visuel = size => l.img ? `<img src="${l.img}" alt="${l.nom}">` : `<div class="ph">${icon(l.ic,size)}</div>`;
  const admin = S.admin ? `<div class="p-admin">${
    S.confirmDel===l.id
      ? `<span class="cq">${TEXTES.confSupp}</span><button class="btn danger" data-act="delyes">${TEXTES.supprOui}</button><button class="btn" data-act="delno">${TEXTES.annuler}</button>`
      : `<button class="btn" data-act="edit">${TEXTES.modifier}</button><button class="btn danger" data-act="del">${TEXTES.supprimer}</button>`
  }</div>` : '';
  elPanneau.innerHTML = `
    <div class="p-banner" style="--c:${c.c};--soft:${c.soft}">${visuel(56)}</div>
    <div class="p-body">
      <div class="p-head">
        <div class="p-titleblock">
          <p class="p-eyebrow">${ZONES.find(z=>z.id===l.zone).titre} ⟡ ${c.label}</p>
          <h2>${l.nom}${l.emploi?bagP():''}</h2>
          <div class="p-meta">${l.type}</div>
        </div>
        <div class="p-avatar" style="--c:${c.c};--soft:${c.soft}">${visuel(52)}</div>
      </div>
      <p class="p-amb">${l.amb}</p>
      <div class="p-field"><b>${TEXTES.chAdresse}</b><span>${l.rue}</span></div>
      <div class="p-field"><b>${TEXTES.chEmploi}</b><span>${l.emploi?TEXTES.emploiOui:TEXTES.emploiNon}</span></div>
      <div class="p-field"><b>${TEXTES.chInfluence}</b><span>${nomsFacs(l.facs)}</span></div>
      ${admin}
    </div>`;
  elPanneau.querySelectorAll('.p-admin [data-act]').forEach(b=>b.addEventListener('click',()=>{
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
    <div class="p-body">
      <p class="p-eyebrow">${neuf?TEXTES.nouveau:TEXTES.edition}</p>
      <h2>${neuf?TEXTES.creerLieu:(l.nom||TEXTES.sansNom)}</h2>
      <div class="p-form">
        <div class="field full"><label>${T.nom}</label><input id="f-nom" value="${esc(l.nom)}" placeholder="${P.nom}"></div>
        <div class="field"><label>${T.type}</label><input id="f-type" value="${esc(l.type)}" placeholder="${P.type}"></div>
        <div class="field"><label>${T.adresse}</label><input id="f-rue" value="${esc(l.rue)}" placeholder="${P.rue}"></div>
        <div class="field"><label>${T.zone}</label><select id="f-zone">${opt(ZONES,l.zone,z=>z.titre)}</select></div>
        <div class="field"><label>${T.categorie}</label><select id="f-cat">${opt(CATS,l.cat,c=>c.label)}</select></div>
        <div class="field"><label>${T.icone}</label><input id="f-ic" list="icones" value="${esc(l.ic)}" placeholder="${P.icone}"><datalist id="icones">${datalist}</datalist></div>
        <div class="field"><label>${T.image}</label><input id="f-img" value="${esc(l.img)}" placeholder="${P.img}"></div>
        <div class="field full"><label>${T.influences}</label><div class="checks">${Object.entries(FAC).map(([k,v])=>`<label><input type="checkbox" class="f-fac" value="${k}" ${l.facs.includes(k)?'checked':''}> ${v.label}</label>`).join('')}</div></div>
        <div class="field full"><label>${T.emploi}</label><div class="checks"><label><input type="checkbox" id="f-emploi" ${l.emploi?'checked':''}> ${TEXTES.emploiCase}</label></div></div>
        <div class="field full"><label>${T.ambiance}</label><textarea id="f-amb" placeholder="${P.amb}">${l.amb||''}</textarea></div>
      </div>
      <div class="p-admin">
        <button class="btn primary" data-act="save">${neuf?TEXTES.creer:TEXTES.enregistrer}</button>
        <button class="btn" data-act="cancel">${TEXTES.annuler}</button>
      </div>
    </div>`;
  elPanneau.querySelector('[data-act="cancel"]').addEventListener('click',()=>{S.editing=null;renderList();});
  elPanneau.querySelector('[data-act="save"]').addEventListener('click',()=>sauver(neuf?null:l.id));
}

/* ===================== EVENTS (actions données) ===================== */
function sauver(existingId){
  const nom=$('f-nom').value.trim();
  if(!nom){$('f-nom').style.borderColor='var(--gr6-color)';$('f-nom').focus();return;}
  const cat=$('f-cat').value;
  const data={nom, type:$('f-type').value.trim(), rue:$('f-rue').value.trim()||'—', zone:$('f-zone').value, cat,
    ic:$('f-ic').value.trim(), img:$('f-img').value.trim(),
    facs:[...elPanneau.querySelectorAll('.f-fac:checked')].map(c=>c.value),
    emploi:$('f-emploi').checked, amb:$('f-amb').value.trim()||'—'};
  let cible;
  if(existingId){ cible=LIEUX.find(x=>x.id===existingId); Object.assign(cible,data); }
  else { data.id='lieu_'+Date.now().toString(36); LIEUX.push(data); cible=data; }
  Store.enregistrer(cible);
  S.sel=cible.id; S.zone=data.zone; S.cat='tous'; S.fac=null; S.editing=null; S.confirmDel=null;
  syncControles(); renderCatCol(); renderList();
}
function supprimerLieu(id){
  LIEUX = LIEUX.filter(l=>l.id!==id);
  Store.retirer(id);
  S.sel=null; S.confirmDel=null; S.editing=null;
  renderCatCol(); renderList();
}

/* ===================== EVENTS (contrôles) ===================== */
function syncControles(){
  $(SEL.tabs).querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected',x.dataset.z===S.zone));
  $(SEL.facs).querySelectorAll('.chip[data-f]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.f===S.fac));
}
function construireZones(){
  $(SEL.tabs).innerHTML = ZONES.map(z=>`<button role="tab" data-z="${z.id}" aria-selected="${z.id===S.zone}">${z.titre}</button>`).join('');
  $(SEL.tabs).querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    S.zone=b.dataset.z; S.cat='tous'; S.sel=null; S.confirmDel=null; S.editing=null;
    syncControles(); renderCatCol(); renderList();
  }));
}
function construireInfluences(){
  const entries=Object.entries(FAC);
  $(SEL.facs).innerHTML =
    entries.map(([k,v],i)=>`<button class="chip${i>=FAC_VISIBLES?' extra':''}" data-f="${k}" style="--fc:${v.c}" aria-pressed="false">${v.label}</button>`).join('')
    + `<button class="chip more" data-more aria-expanded="false">+${entries.length-FAC_VISIBLES}</button>`;
  $(SEL.facs).querySelectorAll('.chip[data-f]').forEach(b=>b.addEventListener('click',()=>{
    S.fac=(S.fac===b.dataset.f)?null:b.dataset.f;
    $(SEL.facs).querySelectorAll('.chip[data-f]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.f===S.fac));
    S.editing=null; renderList();
  }));
  const more=$(SEL.facs).querySelector('[data-more]');
  more.addEventListener('click',()=>{
    const open=$(SEL.facs).classList.toggle('open');
    more.textContent = open ? TEXTES.moins : '+'+(entries.length-FAC_VISIBLES);
    more.setAttribute('aria-expanded',open);
  });
}
function appliquerAdmin(){ document.body.classList.toggle('is-admin',S.admin); if(!S.admin) S.editing=null; renderPanneau(); }

/* ===================== INIT ===================== */
function init(){
  elListe = $(SEL.liste); elPanneau = $(SEL.panneau);
  /* textes fixes */
  const acc=$('accueil-link'); if(acc) acc.setAttribute('href',HREF_ACCUEIL);
  $(SEL.lAccueil).textContent   = TEXTES.accueil;
  $(SEL.lEntete).textContent    = TEXTES.entete;
  $(SEL.lLieux).textContent     = TEXTES.lieux;
  $(SEL.lInfluence).textContent = TEXTES.sousInfluence;
  $(SEL.ajouter).textContent    = TEXTES.ajouter;
  $(SEL.admin).textContent      = TEXTES.modeAdmin;
  /* contrôles */
  construireZones();
  construireInfluences();
  $(SEL.ajouter).addEventListener('click',()=>{S.editing='new';S.confirmDel=null;renderPanneau();});
  const at=$(SEL.admin);
  if(STAFF){ at.style.display='none'; }
  at.addEventListener('click',()=>{S.admin=!S.admin;at.setAttribute('aria-pressed',S.admin);appliquerAdmin();});
  /* rendu */
  appliquerAdmin();
  renderCatCol();
  Store.charger(renderList);
}
window.addEventListener('load', init);   /* timing FA : « load » plutôt que DOMContentLoaded */

})();
