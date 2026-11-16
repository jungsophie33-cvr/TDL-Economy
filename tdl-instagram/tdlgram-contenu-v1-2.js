/* ============================================================
   tdlgram-v1-3d-contenu.js — FICHIER 3/4 : CONTENUS
   Tout ce qui se remplit avec les données du cache :
   - rendreProfil() : stories actives, grilles Publications /
     Identifications / Archives, compteurs du mur ;
   - rendreFil() : stories du rail, « Nouveau chez vos suivis »,
     publications agrégées des murs suivis, suggestions de
     comptes, Tendances (hashtags comptés sur tout le miroir) ;
   - le composer (mode publication 4 images / mode story
     1 image, expiration 72 h) et son branchement.

   Le cache vient du miroir Firebase tdlgram_posts (rempli par
   la synchronisation du fichier 4). Aucun accès direct à
   Firebase ici. Les textes de membres passent par textContent
   ou esc(), jamais par innerHTML.
   ============================================================ */
(() => {
  'use strict';

  const TDLG = window.TDLG1;
  if (!TDLG || !TDLG.rendu) return;
  const { $, $$, esc, depuis, noeudTexteTags, postsDu, parRecent, expiree,
    nbLikes, extraireHashtags, CONFIG } = TDLG;
  const T = CONFIG.TEXTES;
  const I = CONFIG.ICONES;
  const R = TDLG.rendu;
  const cache = TDLG.cache;
  const C = TDLG.contenu = {};

  /* ---------- Profil ---------- */
  R.rendreProfil = () => {
    const tid = TDLG.tidCourant;
    const cq = TDLG.rendu.coquille;
    const posts = postsDu(tid).sort(parRecent);
    const pubs = posts.filter(p => p.type === 'photo');
    const stories = posts.filter(p => p.type === 'story');
    const actives = stories.filter(p => !expiree(p));
    const archives = stories.filter(expiree);

    $('#tdlgStatPubs').textContent = String(pubs.length);
    let abonnes = 0;
    Object.keys(cache.abonnements).forEach(ps => { if (cache.abonnements[ps][tid]) abonnes++; });
    $('#tdlgStatAbonnes').textContent = String(abonnes);
    $('#tdlgStatAbonnements').textContent = String(cache.moi
      ? Object.keys(cache.abonnements[encodeURIComponent(cache.moi.pseudo)] || {}).length : 0);

    /* état initial du bouton Suivre (visiteur) */
    const btnFollow = $('.tdlg-follow');
    if (btnFollow) {
      const suivi = !!(cache.moi && (cache.abonnements[encodeURIComponent(cache.moi.pseudo)] || {})[tid]);
      btnFollow.classList.toggle('is-following', suivi);
      btnFollow.textContent = suivi ? T.boutonSuivi : T.boutonSuivre;
    }

    /* rangée des stories actives + bouton Nouveau du propriétaire
       (ou du staff : outils d'édition ouverts sur tout mur) */
    const row = $('#tdlgStoryRow');
    row.innerHTML = '';
    if ((cache.moi && cq && cq.pseudo === cache.moi.pseudo) || TDLG.estStaff()) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'tdlg-story tdlg-story--add';
      add.innerHTML = `<span class="tdlg-story-ring"><i class="${I.plus}"></i></span>${esc(T.storyNouveau)}`;
      row.appendChild(add);
    }
    actives.forEach(p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tdlg-story';
      b.dataset.tid = tid; b.dataset.pid = p.pid;
      b.innerHTML = `<span class="tdlg-story-ring"><img src="${esc(p.images[0])}" alt=""></span>${esc(courtDate(p.t))}`;
      row.appendChild(b);
    });
    if (!row.children.length) {
      const note = document.createElement('span');
      note.className = 'tdlg-suivis-note';
      note.textContent = T.noteStoryVide;
      row.appendChild(note);
    }

    /* grilles */
    $('#tdlgPublicationGrid').innerHTML = '';
    pubs.forEach(p => $('#tdlgPublicationGrid').appendChild(tuille(p, tid)));
    $('#tdlgArchivesGrid').innerHTML = '';
    archives.forEach(p => $('#tdlgArchivesGrid').appendChild(tuille(p, tid, T.prefixeArchive + courtDate(p.t))));

    /* identifications reçues par ce personnage */
    $('#tdlgTaggedGrid').innerHTML = '';
    const idents = Object.keys(cache.identifications).map(cle => ({ cle, ...cache.identifications[cle] }))
      .sort(parRecent);
    idents.forEach(i => {
      const a = document.createElement('a');
      a.className = 'tdlg-tile';
      a.href = '/t' + i.tid + '#' + i.pid;
      a.innerHTML = `<img src="${esc(i.img || '')}" alt=""><span class="tdlg-tile-badges"><i class="${I.utilisateurs}"></i></span><span class="tdlg-tile-meta"><span>${esc(T.parPrefixe)}${esc(i.par)}</span><span>${esc(T.voirPublication)}</span></span>`;
      $('#tdlgTaggedGrid').appendChild(a);
    });
    if (!idents.length) {
      const note = document.createElement('span');
      note.className = 'tdlg-suivis-note';
      note.textContent = T.noteIdentifications;
      $('#tdlgTaggedGrid').appendChild(note);
    }
    R.montrerOnglet('publications');
    R.rafraichirInteractions();
  };

  function courtDate(t) {
    return t ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
  }

  function tuille(p, tidX, compte) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tdlg-tile';
    b.dataset.tid = tidX; b.dataset.pid = p.pid;
    b.innerHTML = `<img src="${esc(p.images[0])}" alt="">` +
      (compte ? `<span class="tdlg-tile-count">${esc(compte)}</span>` : '') +
      (p.images.length > 1 ? `<span class="tdlg-tile-badges"><i class="${I.galerie}"></i></span>` : '') +
      `<span class="tdlg-tile-meta"><span>❤ ${nbLikes(tidX, p.pid)}</span><span>${esc(T.voirPublication)}</span></span>`;
    return b;
  }

  /* ---------- Fil ---------- */
  R.rendreFil = () => {
    const moi = cache.moi;
    const tid = TDLG.tidCourant;
    const cq = TDLG.rendu.coquille;
    const mesSuivis = moi ? Object.keys(cache.abonnements[encodeURIComponent(moi.pseudo)] || {}) : [];
    const tous = Object.keys(cache.miroir);

    /* stories du rail : mes actives + celles des suivis */
    const strip = $('#tdlgStrip');
    strip.innerHTML = '';
    if ((moi && cq && cq.pseudo === moi.pseudo) || TDLG.estStaff()) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'tdlg-story tdlg-story--add';
      add.innerHTML = `<span class="tdlg-story-ring"><i class="${I.plus}"></i></span>${esc(T.storyVotre)}`;
      strip.appendChild(add);
    }
    [tid, ...mesSuivis.filter(t => t !== tid)].forEach(tX => {
      postsDu(tX).filter(p => p.type === 'story' && !expiree(p))
        .sort(parRecent).slice(0, 2).forEach(p => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'tdlg-story';
          b.dataset.tid = tX; b.dataset.pid = p.pid;
          b.innerHTML = `<span class="tdlg-story-ring"><img src="${esc(p.images[0])}" alt=""></span>${esc(p.handle)}`;
          strip.appendChild(b);
        });
    });

    /* rail « non vues » des murs suivis */
    const box = $('#tdlgSuivisBox');
    const row = $('#tdlgSuivisRow');
    row.innerHTML = '';
    let nonVues = 0;
    mesSuivis.forEach(tX => {
      const dernier = postsDu(tX).sort(parRecent)[0];
      if (!dernier) return;
      let vue = 0;
      try { vue = parseInt(localStorage.getItem(CONFIG.LS_VUE + tX) || '0', 10); } catch (e) {}
      const frais = dernier.t > vue;
      if (frais) nonVues++;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tdlg-suivi-card';
      b.dataset.aller = tX;
      b.innerHTML = `${frais ? '<span class="tdlg-suivi-dot"></span>' : ''}<img src="${esc(dernier.images[0])}" alt="">` +
        `<span class="tdlg-suivi-meta"><img src="${esc(dernier.avatar || '')}" alt=""><span class="x"><b>${esc(dernier.handle)}</b><span>${esc(depuis(dernier.t))}</span></span></span>`;
      row.appendChild(b);
    });
    box.classList.toggle('tdlg-hidden', !mesSuivis.length);
    const badge = $('#tdlgSuivisBadge');
    badge.textContent = nonVues === 1 ? T.badgeNonVue1 : nonVues + T.badgeNonVues;
    badge.classList.toggle('tdlg-hidden', nonVues <= 0);

    /* publications du mur courant + des suivis, plus récentes d'abord */
    const feed = $('#tdlgFeedPosts');
    feed.innerHTML = '';
    const filTids = [tid, ...mesSuivis.filter(t => t !== tid)];
    const filPosts = filTids.flatMap(tX => postsDu(tX).map(p => ({ ...p, tid: tX })))
      .sort(parRecent).slice(0, 24);
    filPosts.forEach(p => feed.appendChild(carteFil(p)));
    if (!filPosts.length) {
      const note = document.createElement('p');
      note.className = 'tdlg-suivis-note';
      note.textContent = T.noteFilVide;
      feed.appendChild(note);
    }

    /* suggestions : comptes TDLgram non suivis, hors mur courant */
    const sugg = $('#tdlgSuggestions');
    sugg.innerHTML = '';
    tous.filter(tX => tX !== tid && !mesSuivis.includes(tX)).forEach(tX => {
      const un = postsDu(tX)[0];
      if (!un) return;
      const d = document.createElement('div');
      d.className = 'tdlg-suggestion';
      d.innerHTML = `<img src="${esc(un.avatar || '')}" alt=""><div><b>${esc(un.handle)}</b></div><button class="tdlg-suivre-btn" data-suivre="${esc(tX)}" type="button">${esc(T.boutonSuivre)}</button>`;
      sugg.appendChild(d);
    });

    /* tendances : hashtags de tous les murs */
    const compte = {};
    tous.forEach(tX => postsDu(tX).forEach(p =>
      extraireHashtags((p.legende || '') + ' ' + (p.lieu || ''))
        .forEach(h => { compte[h] = (compte[h] || 0) + 1; })));
    const tendances = $('#tdlgTendances');
    tendances.innerHTML = '';
    Object.keys(compte).sort((a, b) => compte[b] - compte[a]).slice(0, 5).forEach(h => {
      const t = document.createElement('div');
      t.className = 'tdlg-trend';
      t.innerHTML = `<b>${esc(h)}</b><small>${compte[h]}${esc(compte[h] > 1 ? T.tendancePlusieurs : T.tendanceUne)}</small>`;
      tendances.appendChild(t);
    });
    R.rafraichirInteractions();
  };

  function carteFil(p) {
    const art = document.createElement('article');
    art.className = 'tdlg-feed-post';
    art.dataset.tid = p.tid; art.dataset.pid = p.pid;
    /* Outils de gestion dans l'en-tête : mur courant uniquement
       (le lien de suppression se scrape dans le DOM du sujet) et
       propriétaire du mur ou staff. */
    const gere = !!(p.tid && p.tid === TDLG.tidCourant && cache.moi &&
      TDLG.rendu.coquille &&
      (TDLG.estStaff() || TDLG.rendu.coquille.pseudo === cache.moi.pseudo));
    const outils = gere ? `<div class="tdlg-post-tools"><button class="tdlg-post-edit" data-edit="${esc(p.pid)}" type="button" aria-label="${esc(T.outilEditer)}" title="${esc(T.outilEditer)}"><i class="${I.crayon}"></i></button><button class="tdlg-post-del" data-delete="${esc(p.pid)}" type="button" aria-label="${esc(T.outilSupprimer)}" title="${esc(T.outilSupprimer)}"><i class="${I.corbeille}"></i></button></div>` : '';
    const multi = p.images.length > 1;
    art.innerHTML = `
<header class="tdlg-post-head"><img class="tdlg-post-avatar" src="${esc(p.avatar || '')}" alt=""><div><div class="tdlg-post-author">${esc(p.handle)}</div>${p.lieu ? `<div class="tdlg-post-place"><i class="${I.lieu}"></i> ${esc(p.lieu)}</div>` : ''}</div>${outils}</header>
<div class="tdlg-post-media" data-images="${esc(p.images.join('|'))}" data-idx="0"><img src="${esc(p.images[0])}" alt="">
  ${multi ? `<button class="tdlg-media-arrow tdlg-media-arrow--prev" type="button" aria-label="${esc(T.imagePrecedente)}"><i class="${I.gauche}"></i></button><button class="tdlg-media-arrow tdlg-media-arrow--next" type="button" aria-label="${esc(T.imageSuivante)}"><i class="${I.droite}"></i></button><div class="tdlg-media-dots">${p.images.map(() => '<b></b>').join('')}</div>` : ''}
</div>
<div class="tdlg-post-actions"><button class="tdlg-like" data-like data-tid="${esc(p.tid)}" data-pid="${esc(p.pid)}" type="button" aria-label="${esc(T.jaime)}"><i class="${I.coeur}"></i></button><button data-focus-comment type="button" aria-label="${esc(T.ariaCommenter)}"><i class="${I.commentaire}"></i></button></div>
<div class="tdlg-likes" data-likes data-tid="${esc(p.tid)}" data-pid="${esc(p.pid)}"></div>
<div class="tdlg-caption"></div>
<div class="tdlg-comment-list" data-comment-list data-tid="${esc(p.tid)}" data-pid="${esc(p.pid)}"></div>
<form class="tdlg-comment-form" data-tid="${esc(p.tid)}" data-pid="${esc(p.pid)}"><input type="text" placeholder="${esc(T.commentairePh)}" aria-label="${esc(T.commentairePh)}"><button type="submit">${esc(T.publier)}</button></form>
<div class="tdlg-post-date">${esc(depuis(p.t))}</div>`;
    const cap = $('.tdlg-caption', art);
    const b = document.createElement('b');
    b.textContent = p.handle;
    cap.append(b, document.createTextNode(' '), noeudTexteTags(p.legende || '', 'tdlg-hashtags'));
    return art;
  }

  /* ---------- Composer ---------- */
  const LIMITES = { post: 4, story: 1 };
  let photos = [];
  let modeComposer = 'post';

  function rendreCases() {
    const limite = LIMITES[modeComposer];
    const slots = $('#tdlgPhotoSlots');
    slots.innerHTML = '';
    for (let i = 0; i < limite; i++) {
      const s = document.createElement('div');
      s.className = 'tdlg-photo-slot' + (photos[i] ? ' is-filled' : '');
      if (photos[i]) {
        s.innerHTML = `<img src="${esc(photos[i])}" alt="${esc(T.imageNumero)}${i + 1}"><button class="tdlg-photo-remove" type="button" aria-label="${esc(T.retirerImage)}${i + 1}">×</button>`;
        $('.tdlg-photo-remove', s).addEventListener('click', () => { photos.splice(i, 1); rendreCases(); });
      } else {
        s.innerHTML = `<div class="tdlg-photo-empty"><i class="${I.image}"></i></div>`;
      }
      slots.appendChild(s);
    }
    $('#tdlgPhotoCount').textContent = photos.length +
      (photos.length > 1 ? T.plusieursImagesSur : T.uneImageSur) + limite;
  }

  R.ouvrirComposer = (mode) => {
    modeComposer = mode === 'story' ? 'story' : 'post';
    const t = T.composer[modeComposer];
    $('#tdlgComposerTitle').textContent = t.titre;
    $('#tdlgPhotosLabel').textContent = t.label;
    $('#tdlgComposerNote').textContent = t.note;
    $('#tdlgPlaceField').classList.toggle('tdlg-hidden', modeComposer === 'story');
    $('#tdlgTagsField').classList.toggle('tdlg-hidden', modeComposer === 'story');
    photos = [];
    $('#tdlgImageUrl').value = '';
    $('#tdlgCaptionText').value = '';
    $('#tdlgPlaceText').value = '';
    $('#tdlgTagsText').value = '';
    $('#tdlgLiveTags').innerHTML = '';
    $('#tdlgPublishBtn').disabled = false;
    rendreCases();
    R.ouvrirModal('tdlgComposerModal');
  };

  function tagsEnDirect() {
    const zone = $('#tdlgLiveTags');
    zone.innerHTML = '';
    extraireHashtags($('#tdlgCaptionText').value).forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tdlg-tag-chip';
      chip.textContent = tag;
      zone.appendChild(chip);
    });
  }

  /* Branchement du composer (appelé par le rendu au montage) */
  C.brancher = function () {
    if (C.brancher.fait) return;
    C.brancher.fait = true;
    $('#tdlgAddPhoto').addEventListener('click', () => {
      const url = $('#tdlgImageUrl').value.trim();
      if (!url) return;
      if (photos.length >= LIMITES[modeComposer]) { R.toast(T.composer[modeComposer].plein); return; }
      photos.push(url);
      $('#tdlgImageUrl').value = '';
      rendreCases();
    });
    $('#tdlgImageUrl').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#tdlgAddPhoto').click(); }
    });
    $('#tdlgCaptionText').addEventListener('input', tagsEnDirect);
    $('#tdlgPreviewBtn').addEventListener('click', () => {
      if (!photos.length) { R.toast(T.toastApercuImage); return; }
      R.ouvrirEntree({
        handle: modeComposer === 'story' ? T.apercuStory : T.apercuPublication,
        images: photos.slice(),
        legende: $('#tdlgCaptionText').value || T.sansLegende,
        lieu: modeComposer === 'story' ? '' : $('#tdlgPlaceText').value.trim(),
        type: modeComposer
      }, '', '');
      const liste = $('#tdlgModalComments');
      liste.innerHTML = '';
      const p = document.createElement('p');
      const b = document.createElement('b');
      b.textContent = T.apercuTitre;
      p.append(b, document.createTextNode(T.apercuDetail));
      liste.appendChild(p);
      R.fermerModal('tdlgComposerModal');
      R.ouvrirModal('tdlgPostModal');
    });
    $('#tdlgPublishBtn').addEventListener('click', () => {
      if (!photos.length) { R.toast(T.toastImageManquante); return; }
      const identifie = modeComposer === 'story'
        ? []
        : $('#tdlgTagsText').value.split(',').map(s => s.trim()).filter(Boolean);
      const fragment = TDLG.construireFragment(
        modeComposer, photos, $('#tdlgCaptionText').value,
        $('#tdlgPlaceText').value, identifie);
      R.onPublier?.(fragment);
    });
  };
})();
