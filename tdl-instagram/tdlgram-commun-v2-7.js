/* ============================================================
   tdlgram-v1-1m-commun.js — FICHIER 1/4 : COMMUN
   TDLgram — le réseau du bayou (The Drowned Lands)

   Un personnage = un compte Forumactif = un topic TDLgram, source
   de vérité = les posts Forumactif du topic.
   - Coquille (1er post) : === INSTA === puis PSEUDO (handle requis),
     NOM, BIO (multi-lignes), AVATAR, COUVERTURE.
   - Fragment : === FRAGMENT: PHOTO|STORY === puis IMAGE (répétée =
     carrousel), LEGENDE (répétée = multi-lignes), LIEU (photo),
     DATE (photo seulement : antidatage jj/mm/aaaa), IDENTIFIE
     (pseudo FA, répétable). Story : 72 h à sa date réelle, jamais antidatable.

   Firebase (règles dédiées, canvas database-rules) :
     reactions/<tid>/<pid>/<pseudo> (j'aime WhatsApp) · commentaires/<tid>/<pid>/<cle> ·
     identifications/<cible>/<cle> · abonnements/<pseudo>/<tid> true · tdlgram_posts/<tid>/<pid> = miroir (le fil).

   CHARGEMENT (ordre strict) :
     1. tdlgram-v1-1m-commun.js   2. tdlgram-v1-2h-rendu.js
     3. tdlgram-v1-3i-contenu.js  4. tdlgram-v1-4g-actions.js
     Styles : tdlgram-v2-5.css (CSS dédié GitHub, jamais de style
     dans le JS). Dépend d'EcoCore (eco-core-v2-2) : sans lui, repli
     lecture seule. Jamais dans f2-whatsapp (conflit de posts sj-).
   ============================================================ */
(() => {
  'use strict';

  const TDLG = window.TDLG1 = window.TDLG1 || {};

  /* ===== CONFIG ===== */
  /* Aucune image en dur : replis via le CSS du forum (--bgprof, --bgimgsb). */
  const CONFIG = TDLG.CONFIG = {
    POLL_INTERVAL: 400,
    POLL_MAX: 25,                  // attente des posts sj- au chargement
    STORY_H: 72,                   // expiration des stories en heures
    LS_SHELL: 'tdlgShell_',        // cache de la coquille par tid
    LS_VUE: 'tdlgVue_',            // dernière visite d'un mur, par tid
    DEBUG: false,                  // true : logs console [TDLG]

    /* Textes du squelette : tout se règle ici, rien dans le code. */
    TEXTES: {
      marque: 'Bayougram',
      marqueSous: 'Le réseau du bayou',
      navAria: 'Navigation Bayougram',
      navProfil: 'Profil',
      navFil: 'Fil d’actualité',
      navForum: 'Retour au forum',
      boutonNouveau: 'Nouvelle publication',
      invite: 'Invité',
      etatProprio: 'Compte du personnage',
      etatVisiteur: 'Visiteur du mur',
      etatStaff: 'Staff',
      compteVerifie: 'Compte vérifié',
      statPubs: 'publications',
      statAbonnes: 'abonnés',
      statAbonnements: 'abonnements',
      boutonPublier: 'Publier une photo',
      boutonModifier: 'Modifier le profil',
      boutonFil: 'Voir le fil',
      boutonSuivre: 'Suivre',
      boutonSuivi: 'Abonné ✓',
      storiesAria: 'Stories à la une',
      ongletPublications: 'Publications',
      ongletIdentifications: 'Identifications',
      ongletArchives: 'Archives',
      titreOngletPublications: 'Moments partagés par ',
      titreOngletIdentifications: 'Publications où ce personnage apparaît',
      titreOngletArchives: 'Stories conservées après 72 heures',
      titreSuivis: 'Nouveau chez vos suivis',
      noteSuivis: 'Publications récentes',
      titreSuggestions: 'Comptes à suivre',
      titreTendances: 'Tendances du bayou',
      altPublication: 'Publication',
      imagePrecedente: 'Image précédente',
      imageSuivante: 'Image suivante',
      imageNumero: 'Image ',
      commentairePh: 'Ajouter un commentaire…',
      publier: 'Publier',
      jaime: 'J’aime',
      aucunJaime: 'Aucun',
      compteJaime: ' J’aime',
      suffixeStory: ' · story',
      prefixeArchive: 'Story · ',
      voirPublication: 'Voir la publication',
      parPrefixe: 'par ',
      ariaVoirForum: 'Voir sur le forum',
      ariaCommenter: 'Commenter',
      ariaPartager: 'Partager sur le forum',
      outilEditer: 'Modifier',
      outilSupprimer: 'Supprimer',
      toastSuppression: 'Lien de suppression introuvable.',
      badgeNonVue1: '1 non vue',
      badgeNonVues: ' non vues',
      tendanceUne: ' publication',
      tendancePlusieurs: ' publications',
      storyNouveau: 'Nouveau',
      storyVotre: 'Votre story',
      noteStoryVide: 'Aucune story en ligne : elles expirent après 72 heures.',
      noteIdentifications: 'Aucune identification pour l’instant.',
      noteFilVide: 'Suivez un mur depuis son profil : ses publications arriveront ici.',
      uneImageSur: ' image sur ',
      plusieursImagesSur: ' images sur ',
      retirerImage: 'Retirer l’image ',
      sansLegende: 'Sans légende… pour l’instant.',
      apercuStory: 'Aperçu de votre story',
      apercuPublication: 'Aperçu de votre publication',
      apercuTitre: 'Prévisualisation locale',
      apercuDetail: ' : rien n’est encore publié.',
      toastApercuImage: 'Ajoutez au moins une image pour prévisualiser.',
      toastImageManquante: 'Ajoutez au moins une image.',
      toastDateInvalide: 'Date non reconnue — formats acceptés : 14/07/2023 ou « 14 juillet 2023 ».',
      composer: {
        annuler: 'Annuler',
        previsualiser: 'Prévisualiser',
        publier: 'Publier',
        ajouter: 'Ajouter',
        legende: 'Légende',
        lieu: 'Lieu',
        date: 'Date du moment (antidatage optionnel)',
        identifie: 'Personnes identifiés : pseudos Forumactif, séparés par des virgules',
        adressePh: 'Adresse de l’image (https://…)',
        legendePh: 'Racontez votre moment… Les # restent cliquables sur le forum.',
        lieuPh: 'Lieu de votre publication',
        datePh: 'ex. 14/07/2023 ou 14 juillet 2023 — vide = date réelle',
        identifiePh: 'ex. Alyssa Desrosiers, Perles de Cocodrie',
        post: {
          titre: 'Nouvelle publication',
          label: 'Images',
          plein: 'Maximum : 4 images par publication.',
          note: 'La publication est automatiquement postée dans un message sur le topic.'
        },
        story: {
          titre: 'Nouvelle story',
          label: 'Image de la story',
          plein: 'Une story ne prend qu’une image.',
          note: 'Une story expire après 72 heures (date du post) puis rejoint l’onglet Archives du mur.'
        }
      }
    },

    /* Icônes (classes fi- chargées par le forum). */
    ICONES: {
      marque: 'fi fi-sr-sparkles',
      profil: 'fi fi-tr-user',
      fil: 'fi fi-tr-house-blank',
      forum: 'fi fi-tr-arrow-left',
      plus: 'fi fi-tr-plus',
      reglages: 'fi fi-tr-settings',
      verifie: 'fi fi-sr-badge-check',
      grille: 'fi fi-tr-grid',
      utilisateurs: 'fi fi-tr-users-alt',
      horloge: 'fi fi-tr-time-past',
      coeur: 'fi fi-tr-heart',
      coeurPlein: 'fi fi-sr-heart',
      commentaire: 'fi fi-tr-comment-alt',
      envoyer: 'fi fi-tr-paper-plane',
      crayon: 'fi fi-tr-pencil',
      corbeille: 'fi fi-tr-trash',
      lieu: 'fi fi-tr-marker',
      gauche: 'fi fi-tr-angle-left',
      droite: 'fi fi-tr-angle-right',
      image: 'fi fi-tr-image',
      galerie: 'fi fi-tr-gallery'
    },

    /* Smileys texte → emoji unicode ; convertis en <img> → marqueur MARQ (noeudTexteTags). */
    SMILEYS: { ':)': '🙂', ':(': '🙁', ':D': '😄', ';)': '😉', ';D': '😁',
      ':p': '😛', ':P': '😛', ':o': '😮', ":'(": '😢', ':heart:': '❤',
      ':star:': '⭐', ':cool:': '😎', ':sleep:': '😴', ':zzz:': '😴' }
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
      /* _userdata.avatar = balise <img> : on n'en garde que l'URL (avatar du navigateur). */
      const av = ((window._userdata && window._userdata.avatar) || '')
        .match(/src=['"]([^'"]+)['"]/);
      return { pseudo: p, id, avatar: av ? av[1] : '' };
    } catch (e) { return null; }
  })();

  /* Staff : liste de référence EcoCore.ADMIN_USERS, à appeler APRÈS
     le chargement d'eco-core ; les règles tranchent côté serveur. */
  function estStaff() {
    const eco = window.EcoCore;
    return !!(TDLG.MOI && eco && eco.ADMIN_USERS &&
      eco.ADMIN_USERS.indexOf(TDLG.MOI.pseudo) !== -1);
  }

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

  /* Attend les posts sj- du template, borné dans le temps */  function attendrePosts(cb) {
    let n = 0;
    const t = setInterval(() => {
      const posts = $$('.sj-postmsg');
      if (posts.length) { clearInterval(t); cb(posts); return; }
      if (++n >= CONFIG.POLL_MAX) { clearInterval(t); cb(null); }
    }, CONFIG.POLL_INTERVAL);
  }

  /* ===== LECTURE D'UN POST ===== */
  const MARQ = String.fromCharCode(1); /* délimite une image inline */

  /* Texte nettoyé : compteur de mots, citations, signature retirés.
     Normalisation Sophie-OS : <br>/<p> FA → \n, smileys et images FA →
     marqueurs MARQ, bbcode non converti réduit (rendu par noeudTexteTags). */
  function textePost(post) {
    const src = $('.sj-post-msg', post);
    if (!src) return '';
    const c = src.cloneNode(true);
    $$('.post-wordcount, blockquote, .signature_div, .sj-awards, .award_more', c)
      .forEach(el => el.remove());
    const html = c.innerHTML
      .replace(/\r\n?/g, '\n')
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<\/(p|div|li)\s*>/gi, '\n')
      .replace(/<(p|div|li)[^>]*>/gi, '')
      .replace(/\[url[^\]]*\]([\s\S]*?)\[\/url\]/gi, '$1')
      .replace(/\[img\]([\s\S]*?)\[\/img\]/gi, MARQ + '$1' + MARQ)
      .replace(/\[\/?(b|i|u|s)\]/gi, '')
      .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, MARQ + '$1' + MARQ)
      .replace(/<img[^>]*>/gi, '');
    const holder = document.createElement('div');
    holder.innerHTML = html;
    /* 160 = espace insécable, sans séquence d'échappement */
    return (holder.textContent || '').split(String.fromCharCode(160)).join(' ');
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
  const MOIS = { jan: 0, janvier: 0, 'fév': 1, 'février': 1, feb: 1, mar: 2, mars: 2, avr: 3, avril: 3, apr: 3, mai: 4, juin: 5,
    juil: 6, juillet: 6, jul: 6, 'aoû': 7, 'août': 7, aug: 7, sep: 8, septembre: 8, oct: 9, octobre: 9, nov: 10, novembre: 10, 'déc': 11, 'décembre': 11, dec: 11 };

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
    /* pas d'année affichée = année en cours ; future = année précédente (janvier) */
    if (!m[3] && d > Date.now() + 432e5)
      d = new Date(annee - 1, MOIS[m[2]], +m[1], hh, mm).getTime();
    return d;
  }

  function epoquePost(post) {
    return epoqueDate(texteDate(post));
  }

  /* Champ DATE (antidatage) : jj/mm/aaaa (aussi jj-mm, jj.mm) ou « 14 juillet 2023 » ; 0 = date réelle. */
  function epoqueChampDate(texte) {
    const m = String(texte || '').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], 12).getTime();
    return epoqueDate(String(texte || '').trim());
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

  /* Coquille du 1er post : handle requis. BIO multi-lignes : les lignes
     qui suivent « BIO: » sans autre clé (ni vides) la prolongent. */
  function parseCoquille(texte) {
    if (!RE_INSTA.test(texte)) return null;
    const cq = { handle: '', nom: '', bio: '', avatar: '', couverture: '' };
    let dansBio = false;
    texte.split('\n').forEach(ligne => {
      const m = ligne.trim().match(RE_CLE);
      if (m) {
        const cle = m[1].toUpperCase();
        const val = m[2].trim();
        dansBio = false;
        if (cle === 'BIO') {
          cq.bio = cq.bio ? cq.bio + '\n' + val : val;
          dansBio = true;
        } else if (cle === 'PSEUDO' && val) cq.handle = val;
        else if (cle === 'NOM') cq.nom = val;
        else if (cle === 'AVATAR' && val) cq.avatar = val;
        else if (cle === 'COUVERTURE' && val) cq.couverture = val;
      } else if (dansBio && ligne.trim()) {
        cq.bio += '\n' + ligne.trim();
      }
    });
    return cq.handle ? cq : null;
  }

  /* Fragment PHOTO ou STORY d'un post quelconque du topic */
  function parseFragment(texte) {
    const m = texte.match(RE_FRAGMENT);
    if (!m) return null;
    const frag = { type: m[1].toLowerCase(), images: [], legende: '', lieu: '', identifie: [], date: '', tVoulu: 0 };
    for (const [cle, val] of lireCles(texte, true)) {
      if (cle === 'IMAGE' && val) frag.images.push(val);
      else if (cle === 'LEGENDE') frag.legende = frag.legende ? frag.legende + '\n' + val : val;
      else if (cle === 'LIEU') frag.lieu = val;
      else if (cle === 'IDENTIFIE' && val) frag.identifie.push(val);
      else if (cle === 'DATE' && val && frag.type === 'photo') { frag.date = val; frag.tVoulu = epoqueChampDate(val) || 0; }
    }
    return frag.images.length ? frag : null;
  }

  /* Le topic est-il un mur TDLgram ? (coquille dans le premier post) */
  function estTDLgram(posts) {
    if (!posts || !posts.length) return false;
    return !!parseCoquille(textePost(posts[0]));
  }

  /* ===== COMPOSER : génération du fragment à publier ===== */
  function construireFragment(mode, images, legende, lieu, identifie, date) {
    const lignes = ['=== FRAGMENT: ' + (mode === 'story' ? 'STORY' : 'PHOTO') + ' ==='];
    (images || []).forEach(u => lignes.push('IMAGE: ' + u));
    if (legende && legende.trim())
      legende.trim().split('\n').forEach(l => lignes.push('LEGENDE: ' + l));
    if (mode !== 'story' && lieu && lieu.trim()) lignes.push('LIEU: ' + lieu.trim());
    if (mode !== 'story' && date && date.trim()) lignes.push('DATE: ' + date.trim());
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

  /* Message de refus : token absent ou règles non déployées */
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

  /* Texte + hashtags + émotes, SANS innerHTML de contenu membre :
     segments MARQ → <img>, # → spans, reste en noeuds texte. */
  function noeudTexteTags(texte, classe) {
    const frag = document.createDocumentFragment();
    const re = /#[A-Za-zÀ-ÿ0-9_]+/g;
    String(texte || '').split(MARQ).forEach((segment, i) => {
      if (i % 2 === 1) { /* image inline : smiley ou [img] FA */
        const img = document.createElement('img');
        img.className = 'tdlg-emoji';
        img.src = segment;
        img.alt = '';
        frag.appendChild(img);
        return;
      }
      let dernier = 0, m;
      segment = texteEmojis(segment);
      while ((m = re.exec(segment)) !== null) {
        if (m.index > dernier) frag.appendChild(document.createTextNode(segment.slice(dernier, m.index)));
        const s = document.createElement('span');
        s.className = classe;
        s.textContent = m[0];
        frag.appendChild(s);
        dernier = m.index + m[0].length;
      }
      if (dernier < segment.length) frag.appendChild(document.createTextNode(segment.slice(dernier)));
    });
    return frag;
  }

  /* Smileys restés en texte : mapping CONFIG.SMILEYS vers l'emoji */
  function texteEmojis(s) {
    const map = CONFIG.SMILEYS;
    Object.keys(map).forEach(k => { s = s.split(k).join(map[k]); });
    return s;
  }

  /* Entrées du miroir pour un mur, triées données prêtes */
  function postsDu(tidX) {
    const branche = cache.miroir[tidX] || {};
    return Object.keys(branche).map(pid => ({ pid, ...branche[pid] }))
      .filter(p => p.t && p.images && p.images.length);
  }
  /* Date affichée et de tri : l'antidatage DATE (publications seulement) l'emporte ; stories = date réelle. */
  const datePost = (p) => (p.tVoulu || p.t || 0);
  const parRecent = (a, b) => datePost(b) - datePost(a);
  const expiree = (p) => p.t && (Date.now() - p.t) > CONFIG.STORY_H * 3600e3;
  const nbLikes = (tidX, pid) => Object.keys((cache.reactions[tidX] || {})[pid] || {}).length;

  /* ===== EXPORTS ===== */
  TDLG.$ = $; TDLG.$$ = $$; TDLG.esc = esc; TDLG.log = log;
  TDLG.MOI = MOI; TDLG.topicId = topicId; TDLG.urlReponse = urlReponse;
  TDLG.attendrePosts = attendrePosts; TDLG.textePost = textePost;
  TDLG.pidPost = pidPost; TDLG.pseudoPost = pseudoPost;
  TDLG.epoquePost = epoquePost; TDLG.depuis = depuis;
  TDLG.parseCoquille = parseCoquille; TDLG.parseFragment = parseFragment;
  TDLG.estTDLgram = estTDLgram; TDLG.construireFragment = construireFragment;
  TDLG.extraireHashtags = extraireHashtags; TDLG.texteEmojis = texteEmojis;
  TDLG.noeudTexteTags = noeudTexteTags; TDLG.postsDu = postsDu;
  TDLG.parRecent = parRecent; TDLG.expiree = expiree; TDLG.nbLikes = nbLikes;
  TDLG.datePost = datePost; TDLG.epoqueChampDate = epoqueChampDate;
  TDLG.attendreEcoCore = attendreEcoCore; TDLG.refusMessage = refusMessage;
  TDLG.estStaff = estStaff;
})();
