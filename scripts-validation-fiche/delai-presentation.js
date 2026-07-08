/* =============================================================================
   TDL — Délai de finalisation des fiches de présentation
   -----------------------------------------------------------------------------
   Deux comportements selon la page :
     • /f5-presentations (liste) .... affiche le délai + boutons staff
     • /t{id}-… (sujet) ............. capture la date de création dans Firebase
                                      (ou supprime l'entrée si la fiche a migré)

   Modèle de données Firebase :
     presentations/{topicId} = { creation:<ms>, bonus:<jours> }
     echeance = creation + (delaiBaseJours + bonus) jours   (recalculée à chaque affichage)

   Dépendance : le SDK Firebase (compat) doit être chargé AVANT ce script.
   Si eco-core.js initialise déjà l'app Firebase, laisser CONFIG_FIREBASE vide :
   ce module réutilise l'app existante.
   ========================================================================== */

/* --- CONFIG_FIREBASE [MAJ] ---------------------------------------------------
   À renseigner UNIQUEMENT si ce script tourne sans eco-core.js.
   Sinon laisser tel quel : l'app par défaut est réutilisée.                  */
const CONFIG_FIREBASE = {
  // apiKey:      '',
  // databaseURL: '',
};

/* --- CFG — réglages métier -------------------------------------------------- */
const CFG = {
  cheminFirebase     : 'presentations',
  delaiBaseJours     : 15,   // délai standard
  bonusJours         : 7,    // montant d'un clic « +7j » (cumulable)
  seuilUrgenceJours  : 3,    // 3 derniers jours (inclusif) → style d'urgence
  nettoyerSurListe   : true, // réconcilie/supprime les fiches migrées (page liste)
  nettoyerSurVueSujet: false,// supprime l'entrée si on ouvre une fiche déjà migrée
  idsExclus          : [],   // [MAJ] IDs d'annonces à ne jamais capturer, ex. ['39']
};

/* --- TEXTES — toutes les chaînes visibles ----------------------------------- */
const TEXTES = {
  jusqua      : "délai jusqu'au {date}",
  prolonge    : "(prolongé)",
  depasse     : "délai dépassé",
  btnPlus     : "+7j",
  btnAnnuler  : "annuler",
  titrePlus   : "Accorder 7 jours supplémentaires",
  titreAnnuler: "Réinitialiser la prolongation",
};

/* --- SEL — sélecteurs ForumActif [MAJ] -------------------------------------- */
const SEL = {
  // Contexte forum présentations (présent sur la liste ET sur les sujets)
  ariane        : '.sub-header-path a[href*="/f5-presentations"]',
  idWrapListe   : 'Présentations',            // id de la .sj-wrap sur la page liste
  // Page liste
  ligneSujet    : '.sj-topic-list',
  titreLien     : 'a.topictitle',
  auteur        : '.topic-author',
  pagination    : '.pagination',
  // Page sujet — date du 1er message (1re occurrence dans la page)
  datePost      : '.sj-postdate',
};

/* --- MOIS_FR — abréviations ForumActif [MAJ] -------------------------------- */
const MOIS_FR = {
  Jan:0, Fév:1, Fev:1, Mar:2, Avr:3, Mai:4, Juin:5,
  Juil:6, Aoû:7, Aou:7, Sep:8, Oct:9, Nov:10, Déc:11, Dec:11,
};

/* =============================================================================
   ADAPTATEUR FIREBASE (compat) — réutilise l'app existante ou l'initialise
   ========================================================================== */
const DB = (function () {
  function base() {
    if (typeof firebase === 'undefined' || !firebase.database) return null;
    if (!firebase.apps.length) {
      if (!CONFIG_FIREBASE.databaseURL) return null; // ni app, ni config → abandon
      firebase.initializeApp(CONFIG_FIREBASE);
    }
    return firebase.database();
  }
  const nul = () => Promise.resolve(null);
  const rien = () => Promise.resolve();
  return {
    lire        : (c)    => { const b = base(); return b ? b.ref(c).once('value').then(s => s.val()) : nul(); },
    incrementer : (c, n) => { const b = base(); return b ? b.ref(c).transaction(v => (v || 0) + n) : rien(); },
    fixer       : (c, v) => { const b = base(); return b ? b.ref(c).set(v) : rien(); },
    supprimer   : (c)    => { const b = base(); return b ? b.ref(c).remove() : rien(); },
    ecrireSiAbsent: (c, v) => { const b = base(); return b ? b.ref(c).transaction(x => x === null ? v : undefined) : rien(); },
  };
})();

/* =============================================================================
   UTILITAIRES
   ========================================================================== */
function estStaff() {
  try { return typeof _userdata !== 'undefined' && (_userdata.user_level === 1 || _userdata.user_level === 2); }
  catch (e) { return false; }
}

function idDepuisHref(href) {
  const m = String(href || '').match(/\/?t(\d+)-/);
  return m ? m[1] : null;
}

function formaterJJMM(date) {
  const jj = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return jj + '/' + mm;
}

/* Parse une date ForumActif FR : « Aujourd'hui à HH:MM », « Hier à HH:MM »
   ou « Mar 23 Juin 2026 - 17:54 » (le jour de semaine est ignoré). */
function parserDateFA(txt) {
  txt = String(txt || '');
  let m = txt.match(/Aujourd'hui.*?(\d{1,2})[:h](\d{2})/i);
  if (m) { const d = new Date(); d.setHours(+m[1], +m[2], 0, 0); return d.getTime(); }
  m = txt.match(/Hier.*?(\d{1,2})[:h](\d{2})/i);
  if (m) { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(+m[1], +m[2], 0, 0); return d.getTime(); }
  m = txt.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\.?\s+(\d{4})\s*[-–]\s*(\d{1,2})[:h](\d{2})/);
  if (m) {
    const mois = MOIS_FR[m[2]];
    if (mois === undefined) return null;
    return new Date(+m[3], mois, +m[1], +m[4], +m[5]).getTime();
  }
  return null;
}

/* =============================================================================
   CALCUL D'ÉTAT — texte + urgence à partir des données Firebase
   ========================================================================== */
function calcEtat(data) {
  const creation = Number((data && data.creation) || 0);
  if (!creation) return null;                       // pas encore capturée
  const bonus    = Number((data && data.bonus) || 0);
  const echeance = creation + (CFG.delaiBaseJours + bonus) * 86400000;
  const reste    = echeance - Date.now();

  if (reste <= 0) return { texte: TEXTES.depasse, urgent: true, bonus };

  const jours  = Math.ceil(reste / 86400000);
  const urgent = jours <= CFG.seuilUrgenceJours;
  let texte    = TEXTES.jusqua.replace('{date}', formaterJJMM(new Date(echeance)));
  if (bonus > 0) texte += ' ' + TEXTES.prolonge;
  return { texte, urgent, bonus };
}

/* =============================================================================
   RENDU (page liste) — span, boutons, boucle, réconciliation
   ========================================================================== */
function obtenirSpan(ligne) {
  let span = ligne.querySelector('.sj-topic-delay');
  if (span) return span;
  const auteur = ligne.querySelector(SEL.auteur);
  if (!auteur) return null;                         // pas d'ancrage → on saute
  span = document.createElement('span');
  span.className = 'sj-topic-delay';
  auteur.insertAdjacentElement('afterend', span);   // frère, hors du nœud auteur
  return span;
}

function peindre(span, id, etat) {
  span.textContent = etat.texte;
  span.classList.toggle('sj-topic-delay--urgent', !!etat.urgent);
  if (estStaff()) ajouterBoutons(span, id, etat);
}

function ajouterBoutons(span, id, etat) {
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'sj-topic-delay__btn';
  plus.textContent = TEXTES.btnPlus;
  plus.title = TEXTES.titrePlus;
  plus.addEventListener('click', () => prolonger(id, span));
  span.appendChild(plus);

  if (etat.bonus > 0) {
    const ann = document.createElement('button');
    ann.type = 'button';
    ann.className = 'sj-topic-delay__btn sj-topic-delay__btn--annuler';
    ann.textContent = TEXTES.btnAnnuler;
    ann.title = TEXTES.titreAnnuler;
    ann.addEventListener('click', () => annuler(id, span));
    span.appendChild(ann);
  }
}

function rafraichir(id, span) {
  DB.lire(CFG.cheminFirebase + '/' + id).then(data => {
    span.innerHTML = '';
    span.classList.remove('sj-topic-delay--urgent');
    const etat = calcEtat(data);
    if (etat) peindre(span, id, etat);
  });
}

function prolonger(id, span) {
  DB.incrementer(CFG.cheminFirebase + '/' + id + '/bonus', CFG.bonusJours)
    .then(() => rafraichir(id, span));
}
function annuler(id, span) {
  DB.fixer(CFG.cheminFirebase + '/' + id + '/bonus', 0)
    .then(() => rafraichir(id, span));
}

function initListe() {
  const toutes = [...document.querySelectorAll(SEL.ligneSujet)];
  const estAnnonce = l => l.classList.contains('folder_announce') || l.classList.contains('folder_global');
  const lignes = toutes.filter(l => !estAnnonce(l));
  if (!lignes.length) return;

  // IDs d'annonces présentes → à préserver lors de la réconciliation
  const exclus = toutes.filter(estAnnonce)
    .map(l => idDepuisHref((l.querySelector(SEL.titreLien) || {}).getAttribute?.('href')))
    .filter(Boolean);

  DB.lire(CFG.cheminFirebase).then(tout => {
    tout = tout || {};
    const presents = [];
    lignes.forEach(ligne => {
      const lien = ligne.querySelector(SEL.titreLien);
      const id = idDepuisHref(lien && lien.getAttribute('href'));
      if (!id) return;
      presents.push(id);
      const etat = calcEtat(tout[id]);
      if (!etat) return;                            // pas encore capturée → rien
      const span = obtenirSpan(ligne);
      if (span) { span.innerHTML = ''; peindre(span, id, etat); }
    });
    reconcilier(tout, presents, exclus);
  });
}

/* Supprime les entrées Firebase des fiches ayant quitté le forum.
   Sécurité pagination : on ne réconcilie que sur une liste mono-page. */
function reconcilier(tout, presents, exclus) {
  if (!CFG.nettoyerSurListe) return;
  const pag = document.querySelector(SEL.pagination);
  if (pag && pag.querySelector('a, strong')) return; // plusieurs pages → on s'abstient
  const proteges = presents.concat(exclus, CFG.idsExclus);
  Object.keys(tout).forEach(id => {
    if (!proteges.includes(id)) DB.supprimer(CFG.cheminFirebase + '/' + id);
  });
}

/* =============================================================================
   CAPTURE (page sujet) — écrit la date de création, ou nettoie si migrée
   ========================================================================== */
function dateCreationDepuisPage() {
  const date = document.querySelector(SEL.datePost); // 1re occurrence = 1er post
  if (!date) { console.warn('[délai] date du 1er post introuvable — vérifier SEL.datePost'); return null; }
  const ts = parserDateFA(date.textContent);
  if (!ts) console.warn('[délai] date du 1er post non reconnue — vérifier MOIS_FR / format FA');
  return ts;
}

function initSujet() {
  const id = idDepuisHref(location.pathname);
  if (!id) return;
  const enPresentation = !!document.querySelector(SEL.ariane);

  if (!enPresentation) {                            // fiche hors présentations
    if (CFG.nettoyerSurVueSujet) {
      DB.lire(CFG.cheminFirebase + '/' + id).then(d => {
        if (d) DB.supprimer(CFG.cheminFirebase + '/' + id);
      });
    }
    return;
  }
  if (CFG.idsExclus.includes(id)) return;           // annonce → non suivie
  const ts = dateCreationDepuisPage();
  if (ts) DB.ecrireSiAbsent(CFG.cheminFirebase + '/' + id + '/creation', ts);
}

/* =============================================================================
   AMORÇAGE — pas de DOMContentLoaded (trop tôt sur FA), polling + load
   ========================================================================== */
let dejaAmorce = false;
function amorcer() {
  if (dejaAmorce) return true;
  if (typeof firebase === 'undefined') return false; // SDK pas encore prêt
  const path = location.pathname;
  const enForum = () => !!document.getElementById(SEL.idWrapListe)
                     || !!document.querySelector(SEL.ariane);
  const surListe = /^\/f\d+-/.test(path) && enForum();
  const surSujet = /^\/t\d+-/.test(path);
  if (!surListe && !surSujet) return true;          // page hors périmètre → stop poll
  dejaAmorce = true;
  if (surListe) initListe();
  else if (surSujet) initSujet();
  return true;
}

let essais = 0;
const minuteur = setInterval(() => {
  if (amorcer() || ++essais > 40) clearInterval(minuteur);
}, 250);
window.addEventListener('load', amorcer);
