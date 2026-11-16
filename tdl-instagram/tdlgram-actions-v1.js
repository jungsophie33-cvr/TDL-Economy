/* ============================================================
   tdlgram-v1-4b-actions.js — FICHIER 4/4 : ACTIONS
   Firebase + publication + abonnements. Dernier fichier chargé,
   il démarre l'application dès que les posts sj- arrivent.

   - Charge le cache partagé : tdlgram_posts (miroir des
     fragments), abonnements, identifications du propriétaire,
     puis reactions/ et commentaires/ du mur courant et des
     murs suivis. Le fichier 2 rend tout depuis ce cache.
   - SYNCHRONISATION : quand le propriétaire OU UN MEMBRE DU STAFF
     visite le mur, chaque fragment de la page est recopié dans
     tdlgram_posts/<tid>/<pid> (pseudo du propriétaire dans
     l'entrée — c'est la règle d'écriture ; le staff passe par sa
     clause staff, même si son pseudo n'est pas celui du mur).
     Les clés IDENTIFIE créent les entrées identifications/<cible>,
     signées par l'auteur du fragment (le propriétaire du mur).
     Un simple visiteur ne synchronise rien : lecture seule.
   - ENVOI SILENCIEUX : le composer publie le fragment par le
     form #quick_reply natif (champs cachés recopiés), puis
     la page du mur se recharge — le fragment fraîchement
     posté est synchronisé au passage. Repli : fragment copié
     dans le presse-papier + page Répondre.
   - Suivre = ?watch=topic Forumactif (notifications natives,
     nouvel onglet) + abonnements/<pseudo>/<tid> = true.
   ============================================================ */
(() => {
  'use strict';

  const TDLG = window.TDLG1;
  if (!TDLG || !TDLG.rendu) return;
  const { $$, CONFIG } = TDLG;
  const T = CONFIG.TEXTES;
  const R = TDLG.rendu;
  const cache = TDLG.cache;

  let tid = null;
  let cq = null;   /* coquille du mur (avec .pseudo = propriétaire FA) */
  let infoSession = false;

  /* ===== INITIALISATION ===== */
  function init() {
    TDLG.attendrePosts((posts) => {
      if (!posts || !TDLG.estTDLgram(posts)) return;
      tid = TDLG.topicId();
      if (!tid) return;
      const texte1 = TDLG.textePost(posts[0]);
      let coquille = TDLG.parseCoquille(texte1);
      if (coquille) {
        coquille.pseudo = TDLG.pseudoPost(posts[0]);
        ecrireShell(coquille);
      } else {
        coquille = lireShell();
        if (!coquille) { recupererCoquille(posts); return; } /* page > 1 */
      }
      demarrer(coquille, posts, posts[0]);
    });
  }

  function ecrireShell(c) {
    try { localStorage.setItem(CONFIG.LS_SHELL + tid, JSON.stringify(c)); } catch (e) {}
  }
  function lireShell() {
    try { return JSON.parse(localStorage.getItem(CONFIG.LS_SHELL + tid) || 'null'); } catch (e) { return null; }
  }

  /* Arrivée directe en page > 1 sans coquille en cache : on va la
     chercher sur la page 1 (une seule requête, comme chat-whatsapp). */
  function recupererCoquille(postsCourants) {
    if (!window.fetch || typeof DOMParser === 'undefined') return;
    const url = /\/viewtopic/.test(location.pathname)
      ? '/viewtopic?t=' + tid
      : location.pathname.replace(/(\/t\d+)p\d+/, '$1');
    fetch(url, { credentials: 'same-origin' })
      .then(r => (r.ok ? r.text() : null))
      .then(html => {
        if (!html) return;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const premier = doc.querySelector('.sj-postmsg');
        if (!premier) return;
        const coquille = TDLG.parseCoquille(TDLG.textePost(premier));
        if (!coquille) return;
        coquille.pseudo = TDLG.pseudoPost(premier);
        ecrireShell(coquille);
        demarrer(coquille, postsCourants, premier);
      })
      .catch(() => {});
  }

  function demarrer(coquille, posts, premier) {
    cq = coquille;
    R.monter(cq, TDLG.pidPost(premier), tid);
    try { localStorage.setItem(CONFIG.LS_VUE + tid, String(Date.now())); } catch (e) {}

    TDLG.attendreEcoCore(() => {
      R.actualiserRole?.();
      charger().then(() => {
        if (TDLG.MOI && cq.pseudo &&
            (TDLG.MOI.pseudo === cq.pseudo || TDLG.estStaff()))
          synchroniser(posts);
      });
    });
    /* invité ou pont absent : un seul message, pas de spam */
    if (!infoSession) {
      infoSession = true;
      setTimeout(() => {
        if (!window.EcoCore || !TDLG.MOI)
          R.toast('Lecture naturelle du mur — connecte-toi pour les publications, j’aime et commentaires.');
      }, (CONFIG.POLL_MAX + 2) * CONFIG.POLL_INTERVAL);
    }
  }

  /* ===== CHARGEMENT DU CACHE ===== */
  function charger() {
    const Eco = window.EcoCore;
    return Eco.firebaseGet('tdlgram_posts').then(m => {
      cache.miroir = m || {};
      return Eco.firebaseGet('abonnements');
    }).then(ab => {
      cache.abonnements = ab || {};
      return chargerInteractions();
    }).then(() => {
      return Eco.firebaseGet('identifications/' + encodeURIComponent(cq.pseudo || ''));
    }).then(i => {
      cache.identifications = i || {};
      R.rendreProfil();
      R.rendreFil();
    }).catch(e => {
      TDLG.log('lecture refusée', e);
      R.toast('Lecture TDLgram refusée — règles déployées ?');
    });
  }

  function chargerInteractions() {
    const Eco = window.EcoCore;
    const suivis = cache.moi
      ? Object.keys((cache.abonnements[encodeURIComponent(cache.moi.pseudo)] || {}))
      : [];
    const tids = [...new Set([tid, ...suivis])];
    return Promise.all(tids.flatMap(tX => [
      Eco.firebaseGet('reactions/' + tX)
        .then(r => { cache.reactions[tX] = r || {}; })
        .catch(() => { cache.reactions[tX] = {}; }),
      Eco.firebaseGet('commentaires/' + tX)
        .then(c => { cache.commentaires[tX] = c || {}; })
        .catch(() => { cache.commentaires[tX] = {}; })
    ]));
  }

  /* ===== SYNCHRONISATION DU MIROIR (propriétaire seulement) ===== */
  function synchroniser(posts) {
    const Eco = window.EcoCore;
    const existants = cache.miroir[tid] || {};
    posts.forEach(post => {
      const frag = TDLG.parseFragment(TDLG.textePost(post));
      const pid = TDLG.pidPost(post);
      if (!frag || !pid) return;
      const entree = {
        pseudo: cq.pseudo,
        handle: cq.handle,
        avatar: cq.avatar || '',
        images: frag.images,
        legende: frag.legende,
        lieu: frag.lieu,
        type: frag.type,
        t: TDLG.epoquePost(post) || Date.now()
      };
      const ancien = existants[pid];
      const inchange = ancien && JSON.stringify(ancien) === JSON.stringify(entree);
      if (!inchange) {
        Eco.writeField('tdlgram_posts/' + tid + '/' + pid, entree)
          .then(() => { TDLG.log('miroir synchronisé', pid); })
          .catch(e => R.toast(TDLG.refusMessage(e)));
      }
      frag.identifie.forEach(p => {
        Eco.writeField('identifications/' + encodeURIComponent(p) + '/' + tid + '_' + pid,
          { par: cq.pseudo, tid: tid, pid: pid, img: frag.images[0] || '' })
          .catch(() => {}); /* existe déjà : la règle refuse, c'est voulu */
      });
    });
  }

  /* ===== ENVOI SILENCIEUX (emprunté à chat-whatsapp-v11) ===== */
  function corpsEnvoye(texte) {
    const src = document.getElementById('quick_reply');
    const params = [];
    const vus = new Set();
    $$('input', src).forEach(inp => {
      if (inp.type === 'submit' || inp.type === 'button') return;
      if (!inp.name || inp.name === 'message' || vus.has(inp.name)) return;
      vus.add(inp.name);
      params.push(encodeURIComponent(inp.name) + '=' + encodeURIComponent(inp.value || ''));
    });
    [['mode', 'reply'], ['t', tid]].forEach(([n, v]) => {
      if (!vus.has(n)) { vus.add(n); params.push(n + '=' + v); }
    });
    params.push('message=' + encodeURIComponent(texte));
    if (!vus.has('post')) params.push('post=1');
    return params.join('&');
  }

  const urlSujet = (u) => !!u && (/\/t\d+/.test(u) || /\/viewtopic/.test(u) || /[?&]t=\d/.test(u));

  function publierFragment(texte) {
    const src = document.getElementById('quick_reply');
    if (!src || !window.fetch) { repliPressePapier(texte); return; }
    R.toast('Publication en cours…');
    fetch(src.getAttribute('action') || '/post', {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: corpsEnvoye(texte)
    })
      .then(r => r.text().then(html => ({ url: r.url, html })))
      .then(({ url, html }) => {
        let cible = urlSujet(url) ? url : null;
        if (!cible) {
          const m = html.match(/url=([^"'>\s]+)/i);
          if (m) cible = m[1].replace(/&amp;/g, '&');
        }
        if (urlSujet(cible) || /enregistré|succès|successfully/i.test(html)) {
          R.toast('Publication enregistrée — rechargement du mur…');
          window.location.replace(location.pathname + location.search);
          return;
        }
        throw new Error('REJET');
      })
      .catch(() => R.toast('Envoi refusé (flood ? jeton périmé ?) — réessaie dans un instant.'));
  }

  function repliPressePapier(texte) {
    try { navigator.clipboard?.writeText(texte); } catch (e) {}
    R.toast('Fragment copié — colle-le dans la page Répondre.');
    window.location.href = TDLG.urlReponse();
  }

  /* ===== J'AIME (nœud reactions du WhatsApp) ===== */
  R.onAimer = (tidX, pid) => {
    if (!cache.moi) { R.toast('Connecte-toi pour aimer.'); return; }
    if (!tidX || !pid) return;
    const r = (cache.reactions[tidX] = cache.reactions[tidX] || {});
    r[pid] = r[pid] || {};
    const deja = !!r[pid][cache.moi.pseudo];
    const futur = deja ? null : '❤';
    if (futur) r[pid][cache.moi.pseudo] = futur;
    else delete r[pid][cache.moi.pseudo];
    R.rafraichirInteractions();
    window.EcoCore.writeField('reactions/' + tidX + '/' + pid + '/' + encodeURIComponent(cache.moi.pseudo), futur)
      .catch(e => {
        if (futur) delete r[pid][cache.moi.pseudo];
        else r[pid][cache.moi.pseudo] = '❤';
        R.rafraichirInteractions();
        R.toast(TDLG.refusMessage(e));
      });
  };

  /* ===== COMMENTAIRES ===== */
  R.onCommenter = (tidX, pid, texte, fait) => {
    if (!cache.moi) { R.toast('Connecte-toi pour commenter.'); return; }
    if (!tidX || !pid || !texte) return;
    const cle = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    window.EcoCore.writeField('commentaires/' + tidX + '/' + pid + '/' + cle, {
      pseudo: cache.moi.pseudo, texte: texte, t: Date.now()
    })
      .then(() => {
        const branche = (cache.commentaires[tidX] = cache.commentaires[tidX] || {});
        (branche[pid] = branche[pid] || {})[cle] = { pseudo: cache.moi.pseudo, texte: texte, t: Date.now() };
        R.rafraichirInteractions();
        if (typeof fait === 'function') fait();
      })
      .catch(e => R.toast(TDLG.refusMessage(e)));
  };

  /* ===== SUIVRE : ?watch=topic Forumactif + abonnements Firebase ===== */
  R.onSuivre = (tidX, bouton) => {
    if (!cache.moi) { R.toast('Connecte-toi pour suivre un mur.'); return; }
    if (!tidX) return;
    const maBranche = (cache.abonnements[encodeURIComponent(cache.moi.pseudo)] =
      cache.abonnements[encodeURIComponent(cache.moi.pseudo)] || {});
    const deja = !!maBranche[tidX];
    const futur = deja ? null : true;
    if (futur) maBranche[tidX] = true; else delete maBranche[tidX];
    majSuivre(tidX, futur);
    window.EcoCore.writeField('abonnements/' + encodeURIComponent(cache.moi.pseudo) + '/' + tidX, futur)
      .then(() => {
        if (futur) {
          window.open('/t' + tidX + '?watch=topic', '_blank'); /* notifications FA natives */
          R.toast('Mur suivi : notifications Forumactif activées.');
        } else {
          R.toast('Plus suivi.');
        }
      })
      .catch(e => {
        if (deja) maBranche[tidX] = true; else delete maBranche[tidX];
        majSuivre(tidX, deja);
        R.toast(TDLG.refusMessage(e));
      });
  };

  function majSuivre(tidX, suivi) {
    $$('[data-suivre="' + tidX + '"]', document).forEach(b => {
      b.classList.toggle('is-following', suivi);
      b.textContent = suivi ? T.boutonSuivi : T.boutonSuivre;
    });
  }

  /* ===== COMPOSER ===== */
  R.onPublier = publierFragment;

  /* ===== DÉMARRAGE ===== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
