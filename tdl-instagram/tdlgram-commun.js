/* ============================================================
   tdlgram-v1-1-commun.js — FICHIER 1/4 : COMMUN
   TDLgram — le réseau du bayou (The Drowned Lands)

   Un personnage = un compte Forumactif = un topic TDLgram.
   Source de vérité : les posts Forumactif du topic.
     - Coquille (premier post) :
         === INSTA ===
         PSEUDO: handle instagram (ex. alyssa.desrosiers)
         NOM: nom affiché
         BIO: une ligne
         AVATAR: url de l'image
         COUVERTURE: url (optionnelle, repli --bgprof du forum)
     - Fragment photo (une publication, IMAGE répétée = carrousel) :
         === FRAGMENT: PHOTO ===
         IMAGE: url
         LEGENDE: texte
         LIEU: texte (optionnel)
         IDENTIFIE: pseudo FA (optionnel, répétable)
     - Fragment story (expire après 72 h, puis onglet Archives) :
         === FRAGMENT: STORY ===
         IMAGE: url
         LEGENDE: texte courte

   Firebase (règles dédiées, canvas database-rules) :
     reactions/<tid>/<pid>/<pseudo>   j'aime (nœud WhatsApp existant)
     commentaires/<tid>/<pid>/<cle>   { pseudo, texte, t }
     identifications/<cible>/<cle>    { par, tid, pid, img }
     abonnements/<pseudo>/<tid>       true
     tdlgram_posts/<tid>/<pid>        miroir des fragments (le fil)

   CHARGEMENT (ordre strict) :
     1. tdlgram-v1-1-commun.js
     2. tdlgram-v1-2-rendu.js
     3. tdlgram-v1-3-contenu.js
     4. tdlgram-v1-4-actions.js
     Styles : tdlgram-v1.css (page CSS dédiée GitHub, jamais de
     style dans le JS). Polices et icônes fi- déjà chargées par
     le forum. Dépend, pour Firebase, d'EcoCore (eco-core-v2-2) :
     sans lui, repli lecture seule de la coquille.

   Les topics TDLgram ne doivent PAS vivre dans le forum
   WhatsApp (f2-whatsapp) : les deux moteurs se disputeraient
   les mêmes posts sj-.
   ============================================================ */
(() => {
  'use strict';

  const TDLG = window.TDLG1 = window.TDLG1 || {};

  /* ===== CONFIG ===== */
  const CONFIG = TDLG.CONFIG = {
    POLL_INTERVAL: 400,
    POLL_MAX: 25,                 // attente des posts sj- au chargement
    STORY_H: 72,                  // expiration des stories en heures
    LS_SHELL: 'tdlgShell_',       // cache de la coquille par tid
    LS_VUE: 'tdlgVue_',           // dernière visite d'un mur, par tid
    IMG_SECOURS: 'https://zupimages.net/up/26/32/enlt.png',
    DEBUG: false                  // true : logs console [TDLG]
  };

  const RE_INSTA = /===\s*INSTA\s*===/;
  const RE_FRAGMENT = /===\s*FRAGMENT:\s*(PHOTO|STORY)\s*===/;
  const RE_CLE = /^([A-ZÀ-Ÿ_]+)\s*:\s*(.*)$/;

  /* ===== UTILS ===== */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function log() { if (CONFIG.DEBUG) console.log('[TDLG]', ...arguments); }

  /* ===== IDENTITÉ (null pour un invité Forumactif) ===== */
  const MOI = (() => {
    try {
      const p = ((window._userdata && window._userdata.username) || '').trim();
      const id = parseInt((window._userdata && window._userdata.user_id) || 0, 10);
      if (!p || p.toLowerCase() === 'anonymous' || id <= 0) return null;
      return { pseudo: p, id };
    } catch (e) { return null; }
  })();

  /* ===== PAGE ===== */
  function topicId() {
    let m = location.pathname.match(/\/t(\d+)/);
    if (m) return m[1];
    m = location.search.match(/[?&]t=(\d+)/);
    return m ? m[1] : null;
  }

  function urlReponse() {
    const as = $$('.sj-btn-new a');
    for (const a of as) {
      if (/mode=reply/.test(a.getAttribute('href') || '')) return a.getAttribute('href');
    }
    return '/post?t=' + topicId() + '&mode=reply';
  }

  /* Attend les posts sj- du template, borné dans le temps */
  function attendrePosts(cb) {
    let n = 0;
    const t = setInterval(() => {
      const posts = $$('.sj-postmsg');
      if (posts.length) { clearInterval(t); cb(posts); return; }
      if (++n >= CONFIG.POLL_MAX) { clearInterval(t); cb(null); }
    }, CONFIG.POLL_INTERVAL);
  }

  /* ===== LECTURE D'UN POST ===== */

  /* Texte nettoyé : sans compteur de mots, citations, signature */
  function textePost(post) {
    const src = $('.sj-post-msg', post);
    if (!src) return '';
    const c = src.cloneNode(true);
    $$('.post-wordcount, blockquote, .signature_div, .sj-awards, .award_more', c)
      .forEach(el => el.remove());
    /* 160 = espace insécable, sans séquence d'échappement */
    return (c.textContent || '').split(String.fromCharCode(160)).join(' ');
  }

  /* id numérique du post : ancre de sa date (#1234) */
  function pidPost(post) {
    const a = $('.sj-post-date a[href]', post);
    const m = a ? (a.getAttribute('href') || '').match(/#(\d+)/) : null;
    return m ? m[1] : null;
  }

  function pseudoPost(post) {
    const el = $('.sj-post-pseudo', post);
    return el ? el.textContent.trim() : '';
  }

  function texteDate(post) {
    const el = $('.sj-post-date', post);
    if (!el) return '';
    const spans = el.querySelectorAll('span');
    return (spans.length ? spans[spans.length - 1] : el).textContent;
  }

  /* ===== DATES FA → epoch (approximation maîtrisée) ===== */
  const MOIS = { jan: 0, 'fév': 1, feb: 1, mar: 2, avr: 3, apr: 3, mai: 4,
    juin: 5, juil: 6, jul: 6, 'aoû': 7, aug: 7, sep: 8, oct: 9, nov: 10, 'déc': 11, dec: 11 };

  function epoqueDate(texte) {
    const t = (texte || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const hm = t.match(/(\d{1,2})[:h](\d{2})/);
    const hh = hm ? +hm[1] : 12, mm = hm ? +hm[2] : 0;
    const maintenant = new Date();
    if (/aujourd/.test(t))
      return new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate(), hh, mm).getTime();
    if (/hier/.test(t))
      return new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - 1, hh, mm).getTime();
    const m = t.match(/(\d{1,2})\s+([a-zéû]+)(?:\s+(\d{4}))?/);
    if (!m || !(m[2] in MOIS)) return 0;
    const annee = m[3] ? +m[3] : maintenant.getFullYear();
    let d = new Date(annee, MOIS[m[2]], +m[1], hh, mm).getTime();
    /* pas d'année affichée = année en cours ; si la date tombe dans le
       futur, c'était l'année précédente (tournant de janvier) */
    if (!m[3] && d > Date.now() + 432e5)
      d = new Date(annee - 1, MOIS[m[2]], +m[1], hh, mm).getTime();
    return d;
  }

  function epoquePost(post) {
    return epoqueDate(texteDate(post));
  }

  /* Temps affiché relatif : « Il y a 2 h », « Hier », « 12 octobre » */
  function depuis(t) {
    if (!t) return '';
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'à l’instant';
    if (s < 3600) return 'Il y a ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'Il y a ' + Math.floor(s / 3600) + ' h';
    const j = Math.floor(s / 86400);
    if (j < 2) return 'Hier';
    if (j < 7) return 'Il y a ' + j + ' jours';
    const d = new Date(t);
    const base = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    return j > 300 ? base + ' ' + d.getFullYear() : base;
  }

  /* ===== PARSEURS ===== */

  /* « CLE: valeur » ligne par ligne, ordre conservé */
  function lireCles(texte, apres) {
    const lignes = texte.split('\n');
    const sortie = [];
    let depart = 0;
    if (apres) {
      const idx = lignes.findIndex(l => RE_FRAGMENT.test(l) || RE_INSTA.test(l));
      if (idx !== -1) depart = idx + 1;
    }
    for (let i = depart; i < lignes.length; i++) {
      const m = lignes[i].trim().match(RE_CLE);
      if (m) sortie.push([m[1].toUpperCase(), m[2].trim()]);
    }
    return sortie;
  }

  /* Coquille du premier post : handle requis, le reste optionnel */
  function parseCoquille(texte) {
    if (!RE_INSTA.test(texte)) return null;
    const cq = { handle: '', nom: '', bio: '', avatar: '', couverture: '' };
    for (const [cle, val] of lireCles(texte, true)) {
      if (cle === 'PSEUDO' && val) cq.handle = val;
      else if (cle === 'NOM') cq.nom = val;
      else if (cle === 'BIO') cq.bio = val;
      else if (cle === 'AVATAR' && val) cq.avatar = val;
      else if (cle === 'COUVERTURE' && val) cq.couverture = val;
    }
    return cq.handle ? cq : null;
  }

  /* Fragment PHOTO ou STORY d'un post quelconque du topic */
  function parseFragment(texte) {
    const m = texte.match(RE_FRAGMENT);
    if (!m) return null;
    const frag = { type: m[1].toLowerCase(), images: [], legende: '', lieu: '', identifie: [] };
    for (const [cle, val] of lireCles(texte, true)) {
      if (cle === 'IMAGE' && val) frag.images.push(val);
      else if (cle === 'LEGENDE') frag.legende = frag.legende ? frag.legende + '\n' + val : val;
      else if (cle === 'LIEU') frag.lieu = val;
      else if (cle === 'IDENTIFIE' && val) frag.identifie.push(val);
    }
    return frag.images.length ? frag : null;
  }

  /* Légende multi-lignes : LEGENDE répétée = lignes concaténées */

  /* Le topic est-il un mur TDLgram ? (coquille dans le premier post) */
  function estTDLgram(posts) {
    if (!posts || !posts.length) return false;
    return !!parseCoquille(textePost(posts[0]));
  }

  /* ===== COMPOSER : génération du fragment à publier ===== */
  function construireFragment(mode, images, legende, lieu, identifie) {
    const lignes = ['=== FRAGMENT: ' + (mode === 'story' ? 'STORY' : 'PHOTO') + ' ==='];
    (images || []).forEach(u => lignes.push('IMAGE: ' + u));
    if (legende && legende.trim())
      legende.trim().split('\n').forEach(l => lignes.push('LEGENDE: ' + l));
    if (mode !== 'story' && lieu && lieu.trim()) lignes.push('LIEU: ' + lieu.trim());
    (identifie || []).forEach(p => p && lignes.push('IDENTIFIE: ' + p));
    return lignes.join('\n');
  }

  function extraireHashtags(texte) {
    return [...new Set((texte || '').match(/#[A-Za-zÀ-ÿ0-9_]+/g) || [])];
  }

  /* ===== FIREBASE (dépendance douce) ===== */
  function attendreEcoCore(cb) {
    let n = 0;
    const t = setInterval(() => {
      if (window.EcoCore && typeof window.EcoCore.firebaseGet === 'function') {
        clearInterval(t); cb(); return;
      }
      if (++n >= CONFIG.POLL_MAX) {
        clearInterval(t);
        log('eco-core jamais chargé — lecture seule');
      }
    }, CONFIG.POLL_INTERVAL);
  }

  /* Message de refus selon la cause : token absent ou règles non déployées */
  function refusMessage(e) {
    const m = (e && e.message) || '';
    if (m.indexOf('Pas de token') !== -1) return 'Session TDL absente — recharge la page.';
    if (m.indexOf('401') !== -1 || m.indexOf('403') !== -1)
      return 'Écriture refusée : déploie les règles TDLgram — firebase deploy --only database.';
    return 'Écriture impossible — erreur réseau ?';
  }

  /* ===== DONNÉES DÉRIVÉES DU CACHE (miroir, réactions) ===== */
  TDLG.cache = {
    moi: MOI, miroir: {}, reactions: {}, commentaires: {},
    abonnements: {}, identifications: {}, vues: {}
  };
  const cache = TDLG.cache;

  /* Texte + hashtags colorés, SANS innerHTML de contenu membre */
  function noeudTexteTags(texte, classe) {
    const frag = document.createDocumentFragment();
    const re = /#[A-Za-zÀ-ÿ0-9_]+/g;
    let dernier = 0, m;
    while ((m = re.exec(texte)) !== null) {
      if (m.index > dernier) frag.appendChild(document.createTextNode(texte.slice(dernier, m.index)));
      const s = document.createElement('span');
      s.className = classe;
      s.textContent = m[0];
      frag.appendChild(s);
      dernier = m.index + m[0].length;
    }
    if (dernier < texte.length) frag.appendChild(document.createTextNode(texte.slice(dernier)));
    return frag;
  }

  /* Entrées du miroir pour un mur, triées données prêtes */
  function postsDu(tidX) {
    const branche = cache.miroir[tidX] || {};
    return Object.keys(branche).map(pid => ({ pid, ...branche[pid] }))
      .filter(p => p.t && p.images && p.images.length);
  }
  const parRecent = (a, b) => (b.t || 0) - (a.t || 0);
  const expiree = (p) => p.t && (Date.now() - p.t) > CONFIG.STORY_H * 3600e3;
  const nbLikes = (tidX, pid) => Object.keys((cache.reactions[tidX] || {})[pid] || {}).length;

  /* ===== CACHE PARTAGÉ (rempli par le fichier actions) ===== */

  /* ===== EXPORTS ===== */
  TDLG.$ = $; TDLG.$$ = $$; TDLG.esc = esc; TDLG.log = log;
  TDLG.MOI = MOI; TDLG.topicId = topicId; TDLG.urlReponse = urlReponse;
  TDLG.attendrePosts = attendrePosts; TDLG.textePost = textePost;
  TDLG.pidPost = pidPost; TDLG.pseudoPost = pseudoPost;
  TDLG.epoquePost = epoquePost; TDLG.depuis = depuis;
  TDLG.parseCoquille = parseCoquille; TDLG.parseFragment = parseFragment;
  TDLG.estTDLgram = estTDLgram; TDLG.construireFragment = construireFragment;
  TDLG.extraireHashtags = extraireHashtags;
  TDLG.noeudTexteTags = noeudTexteTags; TDLG.postsDu = postsDu;
  TDLG.parRecent = parRecent; TDLG.expiree = expiree; TDLG.nbLikes = nbLikes;
  TDLG.attendreEcoCore = attendreEcoCore; TDLG.refusMessage = refusMessage;
})();
