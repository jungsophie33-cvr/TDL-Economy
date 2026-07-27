/* ============================================================
   TDL — RÉPERTOIRE DES LIEUX · logique
   Classes/ids préfixés « tdlr- » (anti-conflit CSS forum).
   Blocs : TEXTES · CONFIG · DONNÉES · PERSISTANCE · ÉTAT
           UTILS · RENDER · EVENTS · INIT
   Persistance : EcoCore/Firebase (nœud racine 'lieux').
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
  chAdresse:'Adresse', chEmploi:'Emploi possible', chInfluence:'Influence',
  emploiOui:'Oui : vos personnages peuvent y travailler.', emploiNon:'Non',
  emploiCase:'Les personnages peuvent y être employés', sansFaction:'Aucune influence particulière',
  okSave:'Lieu enregistré.', okDel:'Lieu supprimé.', memSave:'Enregistré (mémoire — non sauvegardé)',
  memDel:'Retiré (mémoire — non sauvegardé)', errSave:"Échec de l'enregistrement : ", errDel:'Échec de la suppression : ',
  lbl:{nom:'Nom',type:'Type',adresse:'Adresse',zone:'Zone',categorie:'Catégorie',
       icone:'Icône (classe Flaticon ou URL)',image:'Image (URL, facultatif)',
       influences:'Influences présentes',emploi:'Emploi',ambiance:"Phrase d'ambiance"},
  ph:{nom:'Ex. City Hall',type:'Ex. Hôpital',rue:'Ex. Main Street',
      icone:'fi-tr-flask ou https://…',img:'https://…',amb:'Une ligne qui donne le ton du lieu…'}
};

/* ===================== CONFIG ===================== */
/* [MAJ] identifiants d'éléments du HTML (préfixés) */
const SEL = {zones:'tdlr-zones', cats:'tdlr-cats', facs:'tdlr-facs', liste:'tdlr-liste', panneau:'tdlr-detail',
             compteur:'tdlr-compteur', ajouter:'tdlr-add', admin:'tdlr-admin-toggle', home:'tdlr-home',
             lAccueil:'tdlr-l-accueil', lEntete:'tdlr-l-eyebrow', lLieux:'tdlr-l-lieux', lInfluence:'tdlr-l-influence'};
const FAC_VISIBLES = 5;
const HREF_ACCUEIL = '/';          /* [MAJ] accueil du forum */
const FORCER_ADMIN = false;        /* [MAJ] true UNIQUEMENT pour un aperçu admin en local (jamais en prod) */
const ICONS = { gov:'<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-7h6v7"/><path d="M4 9h16"/>' };

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
let LIEUX = [
  {id:"l1",nom:"City Hall", type:"Administration municipale", rue:"Main Street", zone:"houma", cat:"institutions", ic:"fi-tr-government-flag", facs:["goulipiats"], emploi:true, amb:"Les formulaires d'un côté. Le pouvoir de l'autre. Rarement dans le même bureau."},
  {id:"l2",nom:"Council Office", type:"Gouvernance paroissiale & municipale", rue:"Barrow Street", zone:"houma", cat:"institutions", ic:"fi-tr-government-flag", facs:["main"], emploi:false, amb:"Là où les décisions qui affectent toute la paroisse se prennent — et où les grandes familles exercent une influence qui ne figure sur aucun ordre du jour."},
  {id:"l3",nom:"Terrebonne Court of Justice", type:"Tribunal de district", rue:"Barrow Street", zone:"houma", cat:"institutions", ic:"fi-tr-balance-scale-right", facs:["main"], emploi:true, amb:"Les affaires se jugent ici. Ou se règlent avant d'y arriver."},
  {id:"l4",nom:"Terrebonne General Health System", type:"Hôpital", rue:"Corporate Drive", zone:"houma", cat:"sante", ic:"fi-ts-marker-hospital", facs:[], emploi:true, amb:"Le seul hôpital de la paroisse. Il voit passer tout le monde, tôt ou tard."},
  {id:"l5",nom:"Bureau du Shérif", type:"Law Enforcement Center", rue:"Barrow Street", zone:"houma", cat:"institutions", ic:"fi-ts-badge-sheriff", facs:["goulipiats","maringouins","main"], emploi:true, amb:"Juridiction sur toute la paroisse, du centre-ville aux bayous les plus reculés."},
  {id:"l6",nom:"Bureau du Coroner & Crime Lab", type:"Antenne LDWF", rue:"Main Street", zone:"houma", cat:"institutions", ic:"fi-tr-flask", facs:[], emploi:true, amb:"Les morts arrivent ici avec leurs secrets. Ils n'en ressortent pas toujours avec."},
  {id:"l7",nom:"Terrebonne Parish Fire Department", type:"Station 1", rue:"Tunnel Boulevard", zone:"houma", cat:"institutions", ic:"fi-ts-fire-shield", facs:[], emploi:true, amb:"Souvent les premiers sur place — pour sauver des vies ou comprendre qu'arriver trop tard n'est pas nécessairement une question de timing."}
];
/* --- exemples de démonstration : retirer genererExemples() en prod --- */
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
/* genererExemples();  ← retire cette ligne en prod */

/* ===================== PERSISTANCE (EcoCore / Firebase) ===================== */
const CHEMIN_LIEUX = 'lieux';
function ecoPret(cb, n){
  n = n || 0;
  if(window.EcoCore && typeof EcoCore.safeReadBin==='function' && typeof EcoCore.writeField==='function'){ cb(EcoCore); return; }
  if(n > 40){ if(window.console) console.warn('[TDL lieux] EcoCore introuvable — mode mémoire.'); cb(null); return; }
  setTimeout(()=>ecoPret(cb, n+1), 250);
}
function semerSiVide(eco){
  const updates = {};
  LIEUX.forEach(l => { updates[CHEMIN_LIEUX+'/'+l.id] = l; });
  eco.firebaseUpdate(updates).catch(e=>window.console&&console.error('[TDL lieux] semer', e));
}
const Store = {
  charger(rendre){
    ecoPret(eco=>{
      if(!eco){ rendre(); return; }
      eco.safeReadBin().then(root=>{
        const brut = root && root.lieux;
        if(brut && Object.keys(brut).length){
          LIEUX = Object.entries(brut).map(([id,l])=>{
            const o=Object.assign({id}, l);
            o.facs = versTableau(o.facs);   /* Firebase omet les tableaux vides / les rend en objets */
            return o;
          });
        } else if(S.admin){
          semerSiVide(eco);
        }
        rendre();
      }).catch(e=>{ if(window.console) console.error('[TDL lieux] charger', e); rendre(); });
    });
  },
  enregistrer(l){
    if(window.EcoCore && typeof EcoCore.writeField==='function') return EcoCore.writeField(CHEMIN_LIEUX+'/'+l.id, l);
    return Promise.resolve({memoire:true});
  },
  retirer(id){
    if(window.EcoCore && typeof EcoCore.firebaseUpdate==='function') return EcoCore.firebaseUpdate({ [CHEMIN_LIEUX+'/'+id]: null });
    return Promise.resolve({memoire:true});
  }
};

/* ===================== ÉTAT ===================== */
const STAFF = !!(window._userdata && (window._userdata.user_level===1 || window._userdata.user_level===2));
const S = {zone:'houma', cat:'tous', fac:null, sel:null, admin:(STAFF||FORCER_ADMIN), confirmDel:null, editing:null, vue:'liste'};
let elListe, elPanneau, elApp;
function appliquerVue(){ if(elApp) elApp.classList.toggle('tdlr-vue-detail', S.vue==='detail'); }
const $ = id => document.getElementById(id);

/* ===================== UTILS ===================== */
function icon(val,size){
  if(!val) return '';
  if(/^https?:/.test(val)) return `<img src="${val}" width="${size}" height="${size}" alt="" style="object-fit:contain">`;
  if(/^fi[\s-]/.test(val)){ const cls=val.startsWith('fi ')?val:('fi '+val); return `<i class="${cls}" style="font-size:${size}px;line-height:1;display:inline-flex"></i>`; }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[val]||ICONS.gov}</svg>`;
}
const bag  = ()=>`<svg class="tdlr-emploi" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
const bagP = ()=>`<svg class="tdlr-emploip" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
/* Firebase ne stocke pas les tableaux/objets vides et sérialise les tableaux
   en objets {0:…,1:…} → on normalise toujours en vrai tableau. */
const versTableau = v => Array.isArray(v) ? v : (v ? Object.values(v) : []);
const dots = f => { f=versTableau(f); return f.length ? `<span class="tdlr-minifacs">${f.map(x=>FAC[x]?`<span class="tdlr-dot" style="background:${FAC[x].c}"></span>`:'').join('')}</span>` : ''; };
const nomsFacs = f => { f=versTableau(f); return f.length ? f.map(x=>FAC[x]?FAC[x].label:x).join(', ') : TEXTES.sansFaction; };
const esc  = s => (s||'').replace(/"/g,'&quot;');
function toast(msg, erreur){
  const t=document.createElement('div');
  t.textContent=msg;
  t.style.cssText='position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:99999;'
    +'font-family:var(--title1);font-size:12px;letter-spacing:.05em;padding:10px 16px;border-radius:8px;'
    +'box-shadow:0 4px 18px var(--darkopa5);max-width:80%;text-align:center;'
    +(erreur?'background:var(--gr6-color);color:var(--clair1);':'background:var(--dark);color:var(--clair1);');
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .4s'; t.style.opacity='0'; setTimeout(()=>t.remove(),400); }, erreur?5000:1800);
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
    return `<button class="tdlr-cat" role="tab" data-c="${t.id}" style="--c:${t.c};--soft:${t.soft}" aria-selected="${t.id===S.cat}" ${dispo?'':'disabled'}><span class="tdlr-ci">${icon(t.ic,26)}</span><span class="tdlr-cl">${t.label}</span></button>`;
  }).join('');
  $(SEL.cats).querySelectorAll('.tdlr-cat').forEach(b=>b.addEventListener('click',()=>{
    if(b.disabled) return; S.cat=b.dataset.c; S.sel=null; S.editing=null; S.vue='liste';
    $(SEL.cats).querySelectorAll('.tdlr-cat').forEach(x=>x.setAttribute('aria-selected',x.dataset.c===S.cat));
    renderList(); appliquerVue();
  }));
}
function rowHTML(l){const c=CAT[l.cat];
  return `<div class="tdlr-row" data-id="${l.id}" aria-current="${l.id===S.sel}" style="--c:${c.c};--soft:${c.soft}">
    <span class="tdlr-ric">${icon(l.ic,18)}</span>
    <span class="tdlr-rtxt"><span class="tdlr-rnom">${l.nom}${l.exemple?'<span class="tdlr-exq">exemple</span>':''}${l.emploi?bag():''}</span><span class="tdlr-rmeta">${l.type}</span></span>
    ${dots(l.facs)}
    <svg class="tdlr-rchev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 6 6 6-6 6"/></svg>
  </div>`;
}
function renderList(){
  const data = filtre();
  $(SEL.compteur).textContent = data.length;
  if(!data.find(l=>l.id===S.sel)) S.sel = data[0]?data[0].id:null;
  elListe.innerHTML = data.length ? data.map(rowHTML).join('')
    : `<div style="padding:40px 20px;color:var(--darkopa5);font-style:italic">${TEXTES.aucun}</div>`;
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
  const c = CAT[l.cat];
  const visuel = size => l.img ? `<img src="${l.img}" alt="${l.nom}">` : `<div class="tdlr-ph">${icon(l.ic,size)}</div>`;
  const admin = S.admin ? `<div class="tdlr-padmin">${
    S.confirmDel===l.id
      ? `<span class="tdlr-cq">${TEXTES.confSupp}</span><button class="tdlr-btn tdlr-danger" data-act="delyes">${TEXTES.supprOui}</button><button class="tdlr-btn" data-act="delno">${TEXTES.annuler}</button>`
      : `<button class="tdlr-btn" data-act="edit">${TEXTES.modifier}</button><button class="tdlr-btn tdlr-danger" data-act="del">${TEXTES.supprimer}</button>`
  }</div>` : '';
  elPanneau.innerHTML = `
    <button class="tdlr-retour" data-act="retour">← Retour à la liste</button>
    <div class="tdlr-pbanner" style="--c:${c.c};--soft:${c.soft}">${visuel(56)}</div>
    <div class="tdlr-pbody">
      <div class="tdlr-phead">
        <div class="tdlr-pavatar" style="--c:${c.c};--soft:${c.soft}">${visuel(52)}</div>
        <div class="tdlr-ptitle">
          <p class="tdlr-peyebrow">${ZONES.find(z=>z.id===l.zone).titre} ⟡ ${c.label}</p>
          <h2>${l.nom}${l.emploi?bagP():''}</h2>
          <div class="tdlr-pmeta">${l.type}</div>
        </div>
      </div>
      <p class="tdlr-pamb">${l.amb}</p>
      <div class="tdlr-pfield"><b>${TEXTES.chAdresse}</b><span>${l.rue}</span></div>
      <div class="tdlr-pfield"><b>${TEXTES.chEmploi}</b><span>${l.emploi?TEXTES.emploiOui:TEXTES.emploiNon}</span></div>
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
  let cible;
  if(existingId){ cible=LIEUX.find(x=>x.id===existingId); Object.assign(cible,data); }
  else { data.id='lieu_'+Date.now().toString(36); LIEUX.push(data); cible=data; }
  Store.enregistrer(cible)
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
  $(SEL.facs).innerHTML =
    entries.map(([k,v],i)=>`<button class="tdlr-chip${i>=FAC_VISIBLES?' tdlr-extra':''}" data-f="${k}" style="--fc:${v.c}" aria-pressed="false">${v.label}</button>`).join('')
    + `<button class="tdlr-chip tdlr-more" data-more aria-expanded="false">+${entries.length-FAC_VISIBLES}</button>`;
  $(SEL.facs).querySelectorAll('.tdlr-chip[data-f]').forEach(b=>b.addEventListener('click',()=>{
    S.fac=(S.fac===b.dataset.f)?null:b.dataset.f;
    $(SEL.facs).querySelectorAll('.tdlr-chip[data-f]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.f===S.fac));
    S.editing=null; S.vue='liste'; renderList(); appliquerVue();
  }));
  const more=$(SEL.facs).querySelector('[data-more]');
  more.addEventListener('click',()=>{
    const open=$(SEL.facs).classList.toggle('tdlr-open');
    more.textContent = open ? TEXTES.moins : '+'+(entries.length-FAC_VISIBLES);
    more.setAttribute('aria-expanded',open);
  });
}
function appliquerAdmin(){ document.body.classList.toggle('tdlr-body-admin',S.admin); if(!S.admin) S.editing=null; renderPanneau(); }

/* ===================== INIT ===================== */
function init(){
  if(!document.querySelector('meta[name="viewport"]')){
    const mv=document.createElement('meta'); mv.name='viewport'; mv.content='width=device-width, initial-scale=1';
    document.head.appendChild(mv);
  }
  elListe = $(SEL.liste); elPanneau = $(SEL.panneau); elApp = document.querySelector('.tdlr-app');
  if(!elListe || !elPanneau) return;              /* structure absente → on sort */
  const home=$(SEL.home); if(home) home.setAttribute('href',HREF_ACCUEIL);
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
