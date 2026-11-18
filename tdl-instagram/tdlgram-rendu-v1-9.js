/* ============================================================
   tdlgram-v1-2k-rendu.js — FICHIER 2/4 : RENDU (STRUCTURE)
   Monte l'application TDLgram par-dessus le topic Forumactif :
   squelette HTML complet (barre latérale, profil, fil, fenêtres,
   composer, toast), bascule des vues et onglets, carrousels,
   fenêtre publication/story, repli d'images par le fond du
   forum (image cassée → masquée, le conteneur prend le fond
   --bgimgsb du CSS).

   Tous les textes et icônes du squelette viennent de
   CONFIG.TEXTES / CONFIG.ICONES, définis dans le fichier 1 —
   rien à chercher dans le code ici.

   Les CONTENUS dérivés des données (grilles du profil, fil,
   composer) sont dans tdlgram-v1-3-contenu.js, qui se branche
   ici : TDLG.contenu.brancher() est appelé au montage, et
   R.rendreProfil / R.rendreFil / R.ouvrirComposer viennent du
   fichier 3. Le staff reçoit les outils du propriétaire via
   R.actualiserRole (appelé par le fichier 4 à l'arrivée
   d'eco-core). Rien de tout ça ne touche Firebase : le fichier 4
   (actions) remplit TDLG.cache puis déclenche le rendu.

   Rendu sûr : jamais d'innerHTML avec du texte de membre —
   pseudos, légendes et commentaires passent par textContent
   ou esc().
   ============================================================ */
(() => {
  'use strict';

  const TDLG = window.TDLG1;
  if (!TDLG || !TDLG.CONFIG) return;
  const { $, $$, esc, noeudTexteTags, nbLikes, depuis, datePost, CONFIG } = TDLG;
  const T = CONFIG.TEXTES;
  const I = CONFIG.ICONES;

  let racine = null;
  let cq = null;      /* coquille du mur */
  let pid1 = null;    /* pid du premier post (édition du profil) */
  const R = TDLG.rendu = {};
  const cache = TDLG.cache;

  /* Callbacks et points de branchement (fichiers 3 et 4) */
  R.onPublier = null; R.onAimer = null; R.onCommenter = null; R.onSuivre = null;

  /* ---------- Toast ---------- */
  let toastTimer = null;
  R.toast = (message) => {
    const el = $('#tdlgToast', racine);
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
  };

  /* ---------- Squelette de l'application ---------- */
  function squelette() {
    const moi = cache.moi;
    const proprio = moi && cq.pseudo && moi.pseudo === cq.pseudo;
    /* Pas d'image en dur : sans COUVERTURE du membre, le fond
       --bgprof du forum (posé par le CSS) reste visible. */
    const couverture = cq.couverture || '';
    return `
<aside class="tdlg-sidebar">
  <div class="tdlg-brand"><span class="tdlg-brand-mark"><i class="${I.marque}"></i></span><div><div class="tdlg-brand-name">${esc(T.marque)}</div><div class="tdlg-brand-sub">${esc(T.marqueSous)}</div></div></div>
  <nav class="tdlg-nav" aria-label="${esc(T.navAria)}">
    <button class="tdlg-nav-btn is-active" data-view="profile" type="button"><i class="${I.profil}"></i><span>${esc(T.navProfil)}</span></button>
    <button class="tdlg-nav-btn" data-view="feed" type="button"><i class="${I.fil}"></i><span>${esc(T.navFil)}</span></button>
    <a class="tdlg-nav-btn" href="/"><i class="${I.forum}"></i><span>${esc(T.navForum)}</span></a>
  </nav>
  <button class="tdlg-new-post ${proprio ? '' : 'tdlg-hidden'}" id="tdlgNewPost" type="button"><i class="${I.plus}"></i><span>${esc(T.boutonNouveau)}</span></button>
  <div class="tdlg-side-bottom">${moi && moi.avatar ? `<img src="${esc(moi.avatar)}" alt="">` : ''}<div><b>${esc(moi ? moi.pseudo : T.invite)}</b><span id="tdlgSideRole">${esc(proprio ? T.etatProprio : T.etatVisiteur)}</span></div></div>
</aside>
<main class="tdlg-workspace"><div class="tdlg-page">
  <section id="tdlgProfileView" class="tdlg-profile-shell">
    <div class="tdlg-cover">${couverture ? `<img src="${esc(couverture)}" alt="">` : ''}</div>
    <div class="tdlg-profile-main">
      <div class="tdlg-identity">
        <img class="tdlg-avatar-large" src="${esc(cq.avatar || '')}" alt="">
        <div class="tdlg-identity-copy">
          <div class="tdlg-handle-line"><h2 class="tdlg-handle">${esc(cq.handle)}</h2><i class="${I.verifie} tdlg-verified" title="${esc(T.compteVerifie)}"></i></div>
          <div class="tdlg-real-name">${esc(cq.nom || cq.pseudo || '')}</div>
          <div class="tdlg-stats"><div class="tdlg-stat"><b id="tdlgStatPubs">0</b><span>${esc(T.statPubs)}</span></div><div class="tdlg-stat"><b id="tdlgStatAbonnes">0</b><span>${esc(T.statAbonnes)}</span></div><div class="tdlg-stat"><b id="tdlgStatAbonnements">0</b><span>${esc(T.statAbonnements)}</span></div></div>
          <div class="tdlg-bio" id="tdlgBio"></div>
        </div>
        <div class="tdlg-action-column"><div class="tdlg-profile-tools">
          ${proprio
            ? `<button class="tdlg-btn tdlg-btn--primary" id="tdlgPublishProfile" type="button"><i class="${I.plus}"></i>&nbsp; ${esc(T.boutonPublier)}</button>
               <a class="tdlg-btn" href="/post?mode=editpost&p=${esc(pid1 || '')}"><i class="${I.reglages}"></i>&nbsp; ${esc(T.boutonModifier)}</a>
               <button class="tdlg-btn" data-view="feed" type="button"><i class="${I.fil}"></i>&nbsp; ${esc(T.boutonFil)}</button>`
            : `<button class="tdlg-btn tdlg-btn--primary tdlg-follow" data-suivre="${esc(TDLG.tidCourant || '')}" type="button">${esc(T.boutonSuivre)}</button>
               <button class="tdlg-btn" data-view="feed" type="button"><i class="${I.fil}"></i>&nbsp; ${esc(T.boutonFil)}</button>`}
        </div></div>
      </div>
    </div>
    <div class="tdlg-story-row" id="tdlgStoryRow" aria-label="${esc(T.storiesAria)}"></div>
    <div class="tdlg-tabs">
      <button class="tdlg-tab is-active" data-tab="publications" type="button"><i class="${I.grille}"></i> ${esc(T.ongletPublications)}</button>
      <button class="tdlg-tab" data-tab="identifications" type="button"><i class="${I.utilisateurs}"></i> ${esc(T.ongletIdentifications)}</button>
      <button class="tdlg-tab" data-tab="archives" type="button"><i class="${I.horloge}"></i> ${esc(T.ongletArchives)}</button>
    </div>
    <div class="tdlg-grid-toolbar"><h2 id="tdlgGridHeading">${esc(T.ongletPublications)}</h2><span id="tdlgGridCount"></span></div>
    <div class="tdlg-grid" id="tdlgPublicationGrid"></div>
    <div class="tdlg-grid tdlg-hidden" id="tdlgTaggedGrid"></div>
    <div class="tdlg-grid tdlg-hidden" id="tdlgArchivesGrid"></div>
  </section>

  <section id="tdlgFeedView" class="tdlg-feed-layout tdlg-hidden">
    <div class="tdlg-feed-main">
      <div class="tdlg-stories-strip" id="tdlgStrip"></div>
      <div class="tdlg-suivis tdlg-hidden" id="tdlgSuivisBox">
        <div class="tdlg-suivis-head"><h2>${esc(T.titreSuivis)}</h2><span class="tdlg-suivis-badge" id="tdlgSuivisBadge"></span></div>
        <div class="tdlg-suivis-row" id="tdlgSuivisRow"></div>
        <div class="tdlg-suivis-note">${esc(T.noteSuivis)}</div>
      </div>
      <div id="tdlgFeedPosts"></div>
    </div>
    <aside class="tdlg-feed-side">
      <div class="tdlg-side-card"><div class="tdlg-side-title">${esc(T.titreSuggestions)}</div><div id="tdlgSuggestions"></div></div>
      <div class="tdlg-side-card"><div class="tdlg-side-title">${esc(T.titreTendances)}</div><div id="tdlgTendances"></div></div>
    </aside>
  </section>
</div></main>

<div class="tdlg-modal" id="tdlgPostModal"><div class="tdlg-modal-card">
  <button class="tdlg-modal-close" data-close="tdlgPostModal" type="button">×</button>
  <div class="tdlg-modal-image"><img id="tdlgModalImg" src="" alt="${esc(T.altPublication)}">
    <button class="tdlg-modal-media-arrow tdlg-modal-media-arrow--prev" type="button" aria-label="${esc(T.imagePrecedente)}"><i class="${I.gauche}"></i></button>
    <button class="tdlg-modal-media-arrow tdlg-modal-media-arrow--next" type="button" aria-label="${esc(T.imageSuivante)}"><i class="${I.droite}"></i></button>
    <div class="tdlg-modal-media-dots"></div>
  </div>
  <div class="tdlg-modal-info">
    <div class="tdlg-modal-head"><div class="tdlg-modal-title" id="tdlgModalTitle"></div><div class="tdlg-modal-tools tdlg-hidden" id="tdlgModalTools"><button class="tdlg-icon-btn" id="tdlgEditBtn" type="button" aria-label="${esc(T.outilEditer)}" title="${esc(T.outilEditer)}"><i class="${I.crayon}"></i></button><button class="tdlg-icon-btn" id="tdlgDeleteBtn" type="button" aria-label="${esc(T.outilSupprimer)}" title="${esc(T.outilSupprimer)}" hidden><i class="${I.corbeille}"></i></button></div></div>
    <div class="tdlg-modal-caption" id="tdlgModalCaption"></div>
    <div class="tdlg-modal-comments" id="tdlgModalComments" data-comment-list data-tid="" data-pid=""></div>
    <form class="tdlg-comment-form" id="tdlgModalCommentForm" data-tid="" data-pid=""><input id="tdlgModalCommentInput" type="text" placeholder="${esc(T.commentairePh)}" aria-label="${esc(T.commentairePh)}"><button type="submit">${esc(T.publier)}</button></form>
    <div class="tdlg-modal-foot"><button class="tdlg-modal-like" id="tdlgModalLike" type="button" aria-label="${esc(T.jaime)}" aria-pressed="false"><i class="${I.coeur}"></i></button><span class="tdlg-likes" id="tdlgModalLikeCount" data-likes></span><span class="tdlg-modal-date" id="tdlgModalDate"></span></div>
  </div>
</div></div>

<div class="tdlg-modal" id="tdlgTagModal"><div class="tdlg-tag-view">
  <button class="tdlg-modal-close" data-close="tdlgTagModal" type="button">×</button><h2 id="tdlgTagTitle"></h2>
  <div class="tdlg-grid" id="tdlgTagGrid"></div><p class="tdlg-suivis-note tdlg-hidden" id="tdlgTagNote">${esc(T.noteTagVide)}</p>
</div></div>

<div class="tdlg-modal" id="tdlgComposerModal"><div class="tdlg-composer">
  <button class="tdlg-modal-close" data-close="tdlgComposerModal" type="button">×</button>
  <h2 id="tdlgComposerTitle">${esc(T.composer.post.titre)}</h2>
  <label class="tdlg-composer-label" for="tdlgImageUrl" id="tdlgPhotosLabel">${esc(T.composer.post.label)}</label>
  <div class="tdlg-photo-slots" id="tdlgPhotoSlots"></div>
  <div class="tdlg-composer-ajout"><input id="tdlgImageUrl" placeholder="${esc(T.composer.adressePh)}"><button class="tdlg-btn tdlg-btn--mini" id="tdlgAddPhoto" type="button"><i class="${I.plus}"></i>&nbsp;${esc(T.composer.ajouter)}</button></div>
  <div class="tdlg-photo-count" id="tdlgPhotoCount"></div>
  <label class="tdlg-composer-label" for="tdlgCaptionText">${esc(T.composer.legende)}</label>
  <textarea id="tdlgCaptionText" placeholder="${esc(T.composer.legendePh)}"></textarea>
  <div class="tdlg-tags-live" id="tdlgLiveTags"></div>
  <div id="tdlgPlaceField">
    <label class="tdlg-composer-label" for="tdlgPlaceText">${esc(T.composer.lieu)}</label>
    <input id="tdlgPlaceText" placeholder="${esc(T.composer.lieuPh)}">
  </div>
  <div id="tdlgTagsField">
    <label class="tdlg-composer-label" for="tdlgTagsText">${esc(T.composer.identifie)}</label>
    <input id="tdlgTagsText" placeholder="${esc(T.composer.identifiePh)}">
  </div>
  <div id="tdlgDateField">
    <label class="tdlg-composer-label" for="tdlgDateText">${esc(T.composer.date)}</label>
    <input id="tdlgDateText" placeholder="${esc(T.composer.datePh)}">
  </div>
  <div class="tdlg-composer-note" id="tdlgComposerNote"></div>
  <div class="tdlg-composer-actions"><button class="tdlg-btn" data-close="tdlgComposerModal" type="button">${esc(T.composer.annuler)}</button><button class="tdlg-btn" id="tdlgPreviewBtn" type="button">${esc(T.composer.previsualiser)}</button><button class="tdlg-btn tdlg-btn--primary" id="tdlgPublishBtn" type="button">${esc(T.composer.publier)}</button></div>
</div></div>

<div class="tdlg-toast" id="tdlgToast"></div>`;
  }

  /* ---------- Montage ---------- */
  R.monter = (coquille, pidPremier, tidCourant) => {
    cq = coquille; pid1 = pidPremier;
    R.coquille = cq;   /* le fichier 3 lit la coquille via TDLG.rendu.coquille */
    TDLG.tidCourant = tidCourant;
    document.body.classList.add('tdlg-on');
    racine = document.createElement('div');
    racine.className = 'tdlg-app';
    racine.innerHTML = squelette();
    document.body.prepend(racine);
    $('#tdlgBio').appendChild(noeudTexteTags(cq.bio || '', 'tdlg-bio-tags'));
    cabler();
    attacherReplis();
    TDLG.contenu?.brancher?.();
  };

  /* ---------- Rôle staff : outils du propriétaire dévoilés ---------- */
  /* Appelé par le fichier 4 quand eco-core est prêt : la liste
     ADMIN_USERS est alors chargée. Le staff obtient les mêmes
     outils que le propriétaire, quel que soit le pseudo du mur. */
  R.actualiserRole = () => {
    if (!TDLG.estStaff()) return;
    $('#tdlgNewPost', racine)?.classList.remove('tdlg-hidden');
    const proprio = !!(cache.moi && cq.pseudo && cache.moi.pseudo === cq.pseudo);
    const role = $('#tdlgSideRole', racine);
    if (role && !proprio) role.textContent = T.etatStaff;
    if (!proprio && !$('#tdlgStaffEdit', racine)) {
      const outils = $('.tdlg-profile-tools', racine);
      if (outils) {
        const a = document.createElement('a');
        a.className = 'tdlg-btn';
        a.id = 'tdlgStaffEdit';
        a.href = '/post?mode=editpost&p=' + (pid1 || '');
        a.innerHTML = `<i class="${I.reglages}"></i>&nbsp; ${esc(T.boutonModifier)}`;
        outils.appendChild(a);
      }
    }
  };

  /* ---------- Vues et onglets ---------- */
  function montrerVue(nom) {
    $('#tdlgProfileView').classList.toggle('tdlg-hidden', nom !== 'profile');
    $('#tdlgFeedView').classList.toggle('tdlg-hidden', nom !== 'feed');
    $$('.tdlg-nav-btn', racine).forEach(b => b.classList.toggle('is-active', b.dataset.view === nom));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function montrerOnglet(mode) {
    $$('.tdlg-tab', racine).forEach(t => t.classList.toggle('is-active', t.dataset.tab === mode));
    $('#tdlgPublicationGrid').classList.toggle('tdlg-hidden', mode !== 'publications');
    $('#tdlgTaggedGrid').classList.toggle('tdlg-hidden', mode !== 'identifications');
    $('#tdlgArchivesGrid').classList.toggle('tdlg-hidden', mode !== 'archives');
    $('#tdlgGridHeading').textContent = mode === 'identifications' ? T.ongletIdentifications
      : (mode === 'archives' ? T.ongletArchives : T.ongletPublications);
    $('#tdlgGridCount').textContent = mode === 'identifications' ? T.titreOngletIdentifications
      : (mode === 'archives' ? T.titreOngletArchives
        : T.titreOngletPublications + (cq ? cq.handle : ''));
  }
  R.montrerOnglet = montrerOnglet;

  /* ---------- Fenêtres ---------- */
  /* Une seule à la fois : la précédente se referme (filtre et
     publication se remplacent sans empilement). */
  const ouvrirModal = (id) => { $$('.tdlg-modal.is-open', racine).forEach(m => m.classList.remove('is-open')); $('#' + id).classList.add('is-open'); };
  const fermerModal = (id) => $('#' + id).classList.remove('is-open');
  R.ouvrirModal = ouvrirModal;
  R.fermerModal = fermerModal;

  /* ---------- Carrousels (délégation, data-images = url|url…) ---------- */
  function carouselAller(carousel, delta) {
    const urls = (carousel.dataset.images || '').split('|').filter(Boolean);
    if (!urls.length) return;
    const idx = (parseInt(carousel.dataset.idx || '0', 10) + delta + urls.length) % urls.length;
    carousel.dataset.idx = String(idx);
    const img = $('img', carousel);
    reinitImage(img);
    img.src = urls[idx];
    img.removeAttribute('srcset');
    $$('.tdlg-media-dots b', carousel).forEach((d, i) => d.classList.toggle('is-active', i === idx));
  }

  /* ---------- Images : repli par le fond du forum ---------- */
  function reinitImage(img) {
    img.classList.remove('tdlg-image-failed');
    img.closest('.tdlg-post-media,.tdlg-story-ring,.tdlg-tile,.tdlg-modal-image,.tdlg-cover,.tdlg-suivi-card')
      ?.classList.remove('tdlg-image-fallback');
  }
  function attacherRepli(img) {
    if (!img || img.dataset.fallbackBound) return;
    img.dataset.fallbackBound = '1';
    if (!img.loading) img.loading = 'lazy';
    img.decoding = 'async';
    /* image en échec : masquée, le conteneur prend le fond
       --bgimgsb du forum (classes gérées par le CSS) */
    img.addEventListener('error', () => {
      img.classList.add('tdlg-image-failed');
      img.closest('.tdlg-post-media,.tdlg-story-ring,.tdlg-tile,.tdlg-modal-image,.tdlg-cover,.tdlg-suivi-card')
        ?.classList.add('tdlg-image-fallback');
    });
    if (img.complete && img.naturalWidth === 0 && img.src) img.dispatchEvent(new Event('error'));
  }
  function attacherReplis() {
    $$('img', racine).forEach(attacherRepli);
    new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches?.('img')) attacherRepli(n);
      n.querySelectorAll?.('img').forEach(attacherRepli);
    }))).observe(racine, { childList: true, subtree: true });
  }

  /* ---------- Fenêtre publication / story ---------- */
  let mediaImages = [], mediaIndex = 0, modalPid = '';
  /* Lien « supprimer » du post Forumactif : dans .sj-post-btn,
     le <a> qui entoure le texte « supprimer » porte déjà le jeton
     tid de session. Aucun lien reconstruit à la main. */
  function lienSuppression(pid) {
    const post = $$('.sj-postmsg').filter(p => TDLG.pidPost(p) === pid)[0];
    if (!post) return null;
    const zone = $('.sj-post-btn', post) ||
      (post.parentElement ? $('.sj-post-btn', post.parentElement) : null);
    if (!zone) return null;
    const a = $$('a', zone).filter(x => /supprimer/i.test((x.textContent || '').trim()))[0];
    return a ? a.getAttribute('href') : null;
  }
  /* Outils réservés au propriétaire du mur ou au staff, sur le mur
     courant uniquement (aucun fetch inter-topics). L'aperçu du
     composer (pid vide) ne les affiche jamais. */
  function majOutils(tidX, pid) {
    const outils = $('#tdlgModalTools');
    if (!outils) return;
    const gestionnaire = !!(cache.moi && cq.pseudo &&
      (TDLG.estStaff() || cache.moi.pseudo === cq.pseudo));
    const ok = !!(pid && tidX && tidX === TDLG.tidCourant && gestionnaire);
    outils.classList.toggle('tdlg-hidden', !ok);
    const sup = $('#tdlgDeleteBtn');
    if (!ok || !sup) return;
    const lien = lienSuppression(pid);
    sup.hidden = !lien;
    if (lien) sup.dataset.href = lien;
  }
  function ouvrirEntree(p, tidX, pid) {
    mediaImages = p.images.slice(); mediaIndex = 0;
    const img = $('#tdlgModalImg');
    reinitImage(img);
    img.src = p.images[0];
    $('#tdlgModalTitle').textContent = p.handle + (p.type === 'story' ? T.suffixeStory : '');
    /* Date relative de publication — antidatage respecté (tVoulu || t),
       même affichage que le fil. */
    $('#tdlgModalDate').textContent = depuis(datePost(p));
    const cap = $('#tdlgModalCaption');
    cap.innerHTML = '';
    cap.appendChild(noeudTexteTags(p.legende || '', 'tdlg-hashtags'));
    if (p.lieu) {
      const lieu = document.createElement('div');
      lieu.className = 'tdlg-location';
      lieu.innerHTML = `<i class="${I.lieu}"></i> `;
      lieu.append(document.createTextNode(p.lieu));
      cap.appendChild(lieu);
    }
    const dots = $('.tdlg-modal-media-dots');
    dots.innerHTML = '';
    p.images.forEach((_, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.setAttribute('aria-label', T.imageNumero + (i + 1));
      if (i === 0) d.classList.add('is-active');
      dots.appendChild(d);
    });
    $('.tdlg-modal-media-arrow--prev').hidden = p.images.length < 2;
    $('.tdlg-modal-media-arrow--next').hidden = p.images.length < 2;
    dots.hidden = p.images.length < 2;
    $('#tdlgModalComments').dataset.tid = tidX || '';
    $('#tdlgModalComments').dataset.pid = pid || '';
    $('#tdlgModalCommentForm').dataset.tid = tidX || '';
    $('#tdlgModalCommentForm').dataset.pid = pid || '';
    $('#tdlgModalLike').dataset.tid = tidX || '';
    $('#tdlgModalLike').dataset.pid = pid || '';
    $('#tdlgModalLikeCount').dataset.tid = tidX || '';
    $('#tdlgModalLikeCount').dataset.pid = pid || '';
    $('#tdlgModalCommentInput').value = '';
    modalPid = pid || '';
    majOutils(tidX, pid);
    R.rafraichirInteractions();
    ouvrirModal('tdlgPostModal');
  }
  R.ouvrirPost = (tidX, pid) => {
    const p = (cache.miroir[tidX] || {})[pid];
    if (!p) return;
    ouvrirEntree(p, tidX, pid);
  };
  /* Aperçu local du composer (données synthétiques, sans tid) */
  R.ouvrirEntree = ouvrirEntree;
  function modalImage(delta) {
    if (!mediaImages.length) return;
    mediaIndex = (mediaIndex + delta + mediaImages.length) % mediaImages.length;
    const img = $('#tdlgModalImg');
    reinitImage(img);
    img.src = mediaImages[mediaIndex];
    $$('.tdlg-modal-media-dots button').forEach((d, i) => d.classList.toggle('is-active', i === mediaIndex));
  }

  /* ---------- J'aime et commentaires : rafraîchissement ---------- */
  R.rafraichirInteractions = () => {
    TDLG.majIdentites?.(racine); /* sélecteur de page bayougram (fichier 4) */
    $$('[data-likes]', racine).forEach(el => {
      const n = nbLikes(el.dataset.tid, el.dataset.pid);
      el.textContent = (n > 0 ? n : T.aucunJaime) + T.compteJaime;
    });
    $$('.tdlg-like, .tdlg-modal-like', racine).forEach(b => {
      const r = (cache.reactions[b.dataset.tid] || {})[b.dataset.pid] || {};
      const aime = !!(cache.moi && r[cache.moi.pseudo]);
      b.classList.toggle('is-liked', aime);
      b.setAttribute('aria-pressed', String(aime));
      b.innerHTML = `<i class="${aime ? I.coeurPlein : I.coeur}"></i>`;
    });
    $$('[data-comment-list]', racine).forEach(liste => {
      const branche = (cache.commentaires[liste.dataset.tid] || {})[liste.dataset.pid] || {};
      liste.innerHTML = '';
      Object.keys(branche).map(c => branche[c]).sort((a, b) => (a.t || 0) - (b.t || 0)).forEach(cm => {
        const p = document.createElement('p');
        const b = document.createElement('b');
        b.textContent = TDLG.nomComment?.(cm) || '';
        p.append(b, document.createTextNode(' ' + TDLG.texteEmojis(cm.texte || '')));
        liste.appendChild(p);
      });
    });
  };

  /* ---------- Câblage global (délégation) ---------- */
  function cabler() {
    racine.addEventListener('click', (e) => {
      const cible = e.target;
      if (cible.closest('[data-view]')) { montrerVue(cible.closest('[data-view]').dataset.view); return; }
      if (cible.closest('.tdlg-tab')) { montrerOnglet(cible.closest('.tdlg-tab').dataset.tab); return; }
      /* Mot-clé cliquable (légendes, bio, tendances) : R.onTagger
         (fichier 4) charge les interactions puis rend la grille. */
      const tagClic = cible.closest('.tdlg-hashtags, .tdlg-bio-tags, .tdlg-trend');
      if (tagClic) { const b = $('b', tagClic); R.onTagger?.(b ? b.textContent : tagClic.textContent); return; }
      if (cible.closest('[data-close]')) { fermerModal(cible.closest('[data-close]').dataset.close); return; }
      const gerer = cible.closest('[data-edit],[data-delete]');
      if (gerer) {
        const pidOutil = gerer.dataset.edit || gerer.dataset.delete;
        if (gerer.dataset.edit) window.location.href = '/post?mode=editpost&p=' + pidOutil;
        else R.onSupprimer?.(TDLG.tidCourant, pidOutil, lienSuppression(pidOutil) || '');
        return;
      }
      if (cible.closest('#tdlgEditBtn')) {
        if (modalPid) window.location.href = '/post?mode=editpost&p=' + modalPid;
        return;
      }
      if (cible.closest('#tdlgDeleteBtn')) {
        if (modalPid) R.onSupprimer?.(TDLG.tidCourant, modalPid, $('#tdlgDeleteBtn').dataset.href || '');
        return;
      }
      if (cible.closest('#tdlgNewPost, #tdlgPublishProfile')) { R.ouvrirComposer?.('post'); return; }
      if (cible.closest('.tdlg-story--add')) { R.ouvrirComposer?.('story'); return; }
      const fleche = cible.closest('.tdlg-media-arrow');
      if (fleche) {
        e.preventDefault();
        carouselAller(fleche.closest('[data-images]'), fleche.classList.contains('tdlg-media-arrow--prev') ? -1 : 1);
        return;
      }
      if (cible.closest('.tdlg-modal-media-arrow--prev')) { modalImage(-1); return; }
      if (cible.closest('.tdlg-modal-media-arrow--next')) { modalImage(1); return; }
      const point = cible.closest('.tdlg-modal-media-dots button');
      if (point) {
        mediaIndex = [...point.parentNode.children].indexOf(point);
        modalImage(0);
        return;
      }
      const tuilleClic = cible.closest('.tdlg-tile[data-pid], .tdlg-story[data-pid]');
      if (tuilleClic) { R.ouvrirPost(tuilleClic.dataset.tid, tuilleClic.dataset.pid); return; }
      /* Vignette « Nouveau chez vos suivis » : la publication
         s'ouvre dans la fenêtre (aucune navigation vers le topic),
         et le mur est marqué vu à hauteur de maintenant — au
         re-rendu la vignette quitte le rail. */
      const suiviClic = cible.closest('.tdlg-suivi-card[data-pid]');
      if (suiviClic) {
        try { localStorage.setItem(CONFIG.LS_VUE + suiviClic.dataset.tid, String(Date.now())); } catch (e) {}
        R.ouvrirPost(suiviClic.dataset.tid, suiviClic.dataset.pid);
        R.rendreFil?.();
        return;
      }
      if (cible.closest('[data-like]')) {
        const b = cible.closest('[data-like]');
        R.onAimer?.(b.dataset.tid, b.dataset.pid);
        return;
      }
      if (cible.closest('#tdlgModalLike')) {
        const b = $('#tdlgModalLike');
        R.onAimer?.(b.dataset.tid, b.dataset.pid);
        return;
      }
      if (cible.closest('[data-focus-comment]')) {
        $('input', cible.closest('.tdlg-feed-post').querySelector('.tdlg-comment-form'))?.focus();
        return;
      }
      if (cible.closest('[data-suivre]')) {
        R.onSuivre?.(cible.closest('[data-suivre]').dataset.suivre, cible.closest('[data-suivre]'));
        return;
      }
      if (cible.closest('[data-aller]')) {
        const tX = cible.closest('[data-aller]').dataset.aller;
        window.location.href = TDLG.urlMur ? TDLG.urlMur(tX) : '/t' + tX + '-';
        return;
      }
    });
    $$('.tdlg-modal', racine).forEach(m => m.addEventListener('click', e => {
      if (e.target === m) m.classList.remove('is-open');
    }));
    racine.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      $$('.tdlg-modal.is-open', racine).forEach(m => m.classList.remove('is-open'));
    });
    racine.addEventListener('submit', (e) => {
      const form = e.target;
      if (!form.classList.contains('tdlg-comment-form')) return;
      e.preventDefault();
      const input = $('input[type="text"]', form);
      const texte = (input.value || '').trim();
      if (texte && form.dataset.tid) R.onCommenter?.(form.dataset.tid, form.dataset.pid, texte, () => { input.value = ''; }, (($('select', form) || {}).value) || '');
    });
  }
})();
