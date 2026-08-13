/* =============================================================
   SOS — Sophia OS · RENDU DES BLOCS (sos-blocs.js)
   -------------------------------------------------------------
   Une fonction par type de bloc. Chacune reçoit un bloc parsé
   ({type, champs, entrees}) et renvoie un élément DOM aux classes
   EXACTES de la maquette — le CSS (charte) fait le reste.

   Les liens (SECTIONS, RENVOI, CIBLE) ne portent AUCUNE logique de
   navigation ici : ils exposent data-cible="panneau:… / post:… /
   sujet:…". C'est le shell (sos-annexe.js) qui route au clic.

   Dépend de : sos-core.js (window.SOS : util, champ, grouper).
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { console.error('sos-blocs.js : sos-core.js doit être chargé avant.'); return; }

  var U = SOS.util;

  /* ---- petits helpers DOM ---- */
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (html != null) { e.innerHTML = html; }
    return e;
  }
  SOS.h = h;

  function champ(b, c) { return SOS.champ(b, c); }
  function para(lignes) { return U.paragraphes(lignes); }          // riche : un <p> par ligne
  function nu(lignes) { return U.nu(lignes); }                      // nu : texte sans balise
  function vers(lignes) {                                           // strophe : un seul <p>, <br>
    var v = (lignes || []).map(function (l) { return l.trim(); }).filter(Boolean);
    return v.length ? '<p>' + v.join('<br>') + '</p>' : '';
  }
  function existe(lignes) { return lignes && lignes.length; }

  var FLECHE = '<span class="rond"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
    'stroke-width="1.4"><path d="M12 4v15M6 13l6 6 6-6"/></svg></span>';

  /* =========================================================
     BLOCS
     ========================================================= */

  // hero — renvoie .hero-in (le shell l'insère dans .p-hero + ajoute la flèche)
  function rendreHero(bloc) {
    var wrap = h('div', 'hero-in');
    var main = h('div', 'hero-main');
    main.appendChild(h('h1', 'hero-titre', nu(champ(bloc, 'TITRE'))));
 
    var cit = champ(bloc, 'CITATION');
    if (existe(cit)) { main.appendChild(h('div', 'hero-cit', vers(cit))); }
    var intro = champ(bloc, 'INTRO');
    if (existe(intro)) { main.appendChild(h('div', 'hero-intro', para(intro))); }
    wrap.appendChild(main);
    var vibes = champ(bloc, 'VIBES');
    if (existe(vibes)) { wrap.appendChild(h('div', 'hero-vibes', para(vibes))); }

    var sections = champ(bloc, 'SECTIONS');
    if (existe(sections)) {
      var toc = h('aside', 'hero-toc');
      toc.appendChild(h('h4', null, 'Dans cette partie'));
      var ul = h('ul');
      sections.forEach(function (ligne) {
        var p = U.pipe(ligne);              // [libellé, cible]
        var li = h('li', null, U.sansBalises(p[0] || ''));
        if (p[1]) { li.setAttribute('data-cible', p[1]); }
        ul.appendChild(li);
      });
      toc.appendChild(ul);
      wrap.appendChild(toc);
    }
    return wrap;
  }

  // scene-photo — .ouv (pleine largeur). Le fond est injecté via --img-fond
  function rendreScenePhoto(bloc) {
    var ouv = h('div', 'ouv');
    var photo = h('div', 'photo');
    var url = nu(champ(bloc, 'IMAGE'));
    if (url) { photo.style.setProperty('--img-fond', "url('" + url + "')"); }
    ouv.appendChild(photo);
    ouv.appendChild(h('div', 'ouv-col', para(champ(bloc, 'TEXTE'))));
    return ouv;
  }

  // separateur — .sep (pleine largeur)
  function rendreSeparateur() {
    return h('div', 'sep', '<span class="fleur"></span>');
  }

  // keystone — .cle
  function rendreKeystone(bloc) {
    var cle = h('div', 'cle');
    var ic = nu(champ(bloc, 'ICONE'));
    if (ic) { cle.appendChild(h('i', 'fi ' + ic + ' bgic')); }
    cle.appendChild(h('h3', null, nu(champ(bloc, 'TITRE'))));
    cle.insertAdjacentHTML('beforeend', para(champ(bloc, 'TEXTE')));
    var n3 = champ(bloc, 'N3');
    if (existe(n3)) {
      var plus = h('span', 'plus', 'En savoir plus&nbsp;&rsaquo;');
      var boite = h('div', 'n3', '<div class="inner">' + para(n3) + '</div>');
      plus.addEventListener('click', function () { boite.classList.toggle('ouvert'); });
      cle.appendChild(plus);
      cle.appendChild(boite);
    }
    return cle;
  }

  // zigzag — .zz (svg tracé plus tard par le shell)
  function rendreZigzag(bloc) {
    var zz = h('div', 'zz');
    zz.innerHTML = '<svg class="zzline" xmlns="http://www.w3.org/2000/svg"></svg>';
    var items = SOS.grouper(bloc, 'ITEM');
    items.forEach(function (it, i) {
      var cote = (i % 2 === 0) ? 'g' : 'd';
      var dernier = (i === items.length - 1) ? ' last' : '';
      var meta = U.pipe(it.ouverture[0] || '');   // [icone, url]
      var icone = U.sansBalises(meta[0] || ''), url = U.sansBalises(meta[1] || '');
      var row = h('div', 'zz-row ' + cote + dernier);
      row.appendChild(h('img'));
      row.lastChild.src = url;
      row.lastChild.alt = '';
      var txt = h('div', 'txt');
      var titre = '<i class="fi ' + icone + '"></i>' + nu(it.champs.TITRE || []);
      txt.appendChild(h('h3', null, titre));
      txt.insertAdjacentHTML('beforeend', para(it.champs.TEXTE || []));
      if (existe(it.champs.RENVOI)) {
        var r = U.pipe(it.champs.RENVOI[0] || '');   // [libellé, cible]
        var lien = h('span', 'renvoi', '&rsaquo; ' + U.sansBalises(r[0] || ''));
        if (r[1]) { lien.setAttribute('data-cible', r[1]); }
        txt.appendChild(lien);
      }
      row.appendChild(txt);
      zz.appendChild(row);
    });
    return zz;
  }

  // duo — .duo (transition gauche + carte-scène droite, repliable)
  var GAP_DUO = 44;
  function rendreDuo(bloc) {
    var duo = h('div', 'duo');
    duo.appendChild(h('div', 'trans', para(champ(bloc, 'GAUCHE'))));

    var carte = h('div', 'narr-card replie');
    carte.appendChild(h('h4', null, nu(champ(bloc, 'TITRE_SCENE'))));
    var corps = h('div', 'narr-corps');
    corps.insertAdjacentHTML('beforeend', para(champ(bloc, 'SCENE')));
    carte.appendChild(corps);
    var btn = h('button', 'narr-plus', 'lire la suite&nbsp;&rsaquo;');
    carte.appendChild(btn);
    duo.appendChild(carte);

    function mobile() {
      return global.matchMedia && global.matchMedia('(max-width:960px)').matches;
    }
    function metriquesReplie() {
      var h4 = carte.querySelector('h4'), p1 = corps.querySelector('p');
      if (!h4) { return; }
      var padX = 0;
      try { var cs = getComputedStyle(carte); padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight); } catch (e) {}
      // largeur INTRINSÈQUE du titre (un <h4> bloc remplit la carte : on le
      // passe en inline-block + nowrap le temps de lire sa vraie largeur)
      var wsav = h4.style.whiteSpace, dsav = h4.style.display;
      h4.style.whiteSpace = 'nowrap';
      h4.style.display = 'inline-block';
      var titreW = h4.offsetWidth;
      h4.style.whiteSpace = wsav;
      h4.style.display = dsav;
      carte.style.width = Math.ceil(titreW + padX) + 'px';
      // hauteur du corps = 1er paragraphe, à cette largeur
      corps.style.maxHeight = ((p1 ? p1.offsetHeight : corps.scrollHeight)) + 'px';
    }
    function ouvrir() {
      var openW = Math.round((duo.clientWidth - GAP_DUO) * 0.65);
      carte.style.width = openW + 'px';
      corps.style.maxHeight = corps.scrollHeight + 'px';
      carte.classList.remove('replie');
      carte.classList.add('deplie');
    }
    btn.addEventListener('click', ouvrir);
    // libère le corps après l'ouverture (redevient responsive)
    corps.addEventListener('transitionend', function (ev) {
      if (ev.propertyName === 'max-height' && carte.classList.contains('deplie')) {
        corps.style.maxHeight = 'none';
      }
    });
    // mesure initiale (une fois inséré dans le DOM par le shell) + resize
    requestAnimationFrame(function () { if (!mobile()) { metriquesReplie(); } });
    var rz;
    global.addEventListener('resize', function () {
      clearTimeout(rz);
      rz = setTimeout(function () {
        if (mobile()) { carte.style.width = ''; corps.style.maxHeight = ''; return; }
        if (carte.classList.contains('deplie')) {
          carte.style.width = Math.round((duo.clientWidth - GAP_DUO) * 0.5) + 'px';
        } else { metriquesReplie(); }
      }, 150);
    });
    return duo;
  }

  // colonnes-verre — .essor (mouvements titrés)
  function rendreColonnes(bloc) {
    var essor = h('div', 'essor');
    var cols = h('div', 'essor-cols');
    SOS.grouper(bloc, 'COLONNE').forEach(function (c) {
      var mvt = h('div', 'mvt');
      mvt.appendChild(h('h4', 'mvt-t', U.sansBalises(c.ouverture[0] || '')));
      mvt.insertAdjacentHTML('beforeend', para(c.ouverture.slice(1)));
      cols.appendChild(mvt);
    });
    essor.appendChild(cols);
    return essor;
  }

  // citation — .pull
  function rendreCitation(bloc) {
    return h('div', 'pull', vers(champ(bloc, 'TEXTE')));
  }

  // conclusion — .concl
  function rendreConclusion(bloc) {
    var c = h('div', 'concl');
    var ic = nu(champ(bloc, 'ICONE'));
    if (ic) { c.appendChild(h('i', 'fi ' + ic + ' mark')); }
    var body = h('div', 'body');
    var sur = nu(champ(bloc, 'SURTITRE'));
    if (sur) { body.appendChild(h('span', 'eyebrow', sur)); }
    body.insertAdjacentHTML('beforeend', para(champ(bloc, 'TEXTE')));
    c.appendChild(body);
    return c;
  }

  // suite — .suite2 (bouton Continuer)
  function rendreSuite(bloc) {
    var s = h('div', 'suite2');
    var btn = h('button', 'btn-suite', FLECHE + '<span>' + nu(champ(bloc, 'LIBELLE')) + '</span>');
    var cible = nu(champ(bloc, 'CIBLE'));
    if (cible) { btn.setAttribute('data-cible', cible); }
    s.appendChild(btn);
    return s;
  }

// cadre-admin — .cdre (bloc de document : règlement, contexte…)
  function rendreCadreAdmin(bloc) {
    var c = h('div', 'cdre');
    var titre = nu(champ(bloc, 'TITRE'));
    if (titre) { c.appendChild(h('h4', null, titre)); }
    var imgs = [];
    (bloc.entrees || []).forEach(function (e) {
      if (e.cle === 'IMAGE') { var u = nu(e.lignes); if (u) { imgs.push(u); } }
    });
    if (imgs.length) {
      var box = h('div', 'cdre-imgs');
      imgs.forEach(function (u) { var im = h('img'); im.src = u; im.alt = ''; box.appendChild(im); });
      c.appendChild(box);
    }
    champ(bloc, 'CORPS').forEach(function (l) {
      l = l.trim();
      if (!l) { return; }
      var estBloc = /^<(ul|ol|li|blockquote|div|h[1-6]|table|figure|dl|section|aside|p)\b/i.test(l)
                 || /^<[a-z][^>]*style=["'][^"']*display\s*:\s*block/i.test(l);
      if (estBloc) { c.insertAdjacentHTML('beforeend', l); }
      else { c.appendChild(h('p', null, l)); }
    });
    return c;
  }
   
 // duo-image — .duoimg (texte gauche + image droite, pleine largeur)
  function rendreDuoImage(bloc) {
    var d = h('div', 'duoimg');
    var txt = h('div', 'duoimg-txt');
    var titre = nu(champ(bloc, 'TITRE'));
    if (titre) { txt.appendChild(h('h4', null, titre)); }
    txt.insertAdjacentHTML('beforeend', para(champ(bloc, 'TEXTE')));
    d.appendChild(txt);
    var url = nu(champ(bloc, 'IMAGE'));
    if (url) {
      var fig = h('div', 'duoimg-img');
      var im = h('img'); im.src = url; im.alt = '';
      fig.appendChild(im);
      d.appendChild(fig);
    }
    return d;
  }
  /* ---- registre + méta ---- */
  SOS.blocs = {
    'hero': rendreHero,
    'scene-photo': rendreScenePhoto,
    'separateur': rendreSeparateur,
    'keystone': rendreKeystone,
    'zigzag': rendreZigzag,
    'duo': rendreDuo,
    'colonnes-verre': rendreColonnes,
    'citation': rendreCitation,
    'conclusion': rendreConclusion,
    'suite': rendreSuite,
    'cadre-admin': rendreCadreAdmin,
    'duo-image': rendreDuoImage
  }; 
  // blocs pleine largeur (hors .e2wrap)
  SOS.blocsPleineLargeur = { 'scene-photo': 1, 'separateur': 1, 'duo-image': 1 };
  SOS.FLECHE = FLECHE;

  // rendu sécurisé d'un bloc (try/catch : un bloc raté n'abat pas le panneau)
  SOS.rendreBloc = function (bloc) {
    var f = SOS.blocs[bloc.type];
    if (!f) { console.warn('SOS: type de bloc inconnu «' + bloc.type + '»'); return null; }
    try { return f(bloc); }
    catch (e) { console.warn('SOS: rendu du bloc «' + bloc.type + '» échoué', e); return null; }
  };

})(window);
