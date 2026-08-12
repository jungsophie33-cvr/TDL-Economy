/* =============================================================
   SOS — Sophia OS · COQUILLE D'ANNEXE (sos-annexe.js)
   -------------------------------------------------------------
   LA COQUILLE, et elle seule : barre d'onglets (agrégée depuis les
   métas des VOLETS du topic courant), deck de panneaux, transitions,
   flèche/suite, sommaire du hero, accordéons, routage des liens
   INTERNES (panneau:/post:), thème, réduction de barre au scroll,
   navigation molette/clavier, tracé SVG du zigzag mesuré au JS.

   La navigation ENTRE annexes (sommaire, chargement in-page d'un
   autre topic, pushState/popstate, voile de chargement) vit dans
   sos-nav.js. La coquille lui expose SOS.shell (reconstruire,
   filtrerVolets, monterSection). Si sos-nav.js est absent, la
   coquille fonctionne quand même : navigation intra-annexe intacte,
   « sujet: » retombe sur l'ouverture d'onglet, pas de bouton sommaire.

   VOCABULAIRE :
     annexe  = grand sujet (une entrée du manifeste / un topic FA)
     volet   = un post à onglet dans une annexe (ex. une communauté)
     panneau = une section défilante d'un volet

   Dépend de : sos-core.js, sos-blocs.js.
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { console.error('sos-annexe.js : sos-core.js doit être chargé avant.'); return; }
  var h = SOS.h;

  /* ---- état ---- */
  var app, tabsEl, dotsEl, deckEl, editBtn;
  var volets = [];        // volets (posts à onglet) du topic courant
  var iVolet = -1;        // volet actif
  var panneaux = [];      // panneaux du volet actif (DOM sections)
  var courant = 0, enTransit = false;
  var mode = 'contenu';   // 'contenu' | 'special' (vue montée par la nav)

  /* Interface offerte à sos-nav.js (couche inter-annexe). */
  var shell = SOS.shell = SOS.shell || {};

  /* =========================================================
     CONSTRUCTION DE L'OVERLAY (une seule fois)
     ========================================================= */
  function construire(opts) {
    opts = opts || {};
    // Pas d'annexe sur cette page -> on ne pose aucun overlay.
    if (!filtrerVolets(SOS.annexes).length) { return; }

    app = h('div', 'sos-app');
    app.setAttribute('data-theme', 'sombre');
    tabsEl = h('nav', 'sos-tabs');
    dotsEl = h('div', 'sos-dots');
    deckEl = h('div', 'sos-deck');
    app.appendChild(tabsEl);
    app.appendChild(dotsEl);
    app.appendChild(deckEl);
    (opts.mount || document.body).appendChild(app);

    shell.app = app;   // la nav y accroche son voile, et s'y réfère

    brancherEvenements();               // écouteurs : une seule fois
    reconstruireDepuis(SOS.annexes);    // premier remplissage
  }

  /* Filtre + trie les enregistrements en volets affichables. */
  function filtrerVolets(records) {
    var toutes = records || [];
    var v = toutes.filter(function (a) { return a.meta && a.meta.onglet; });
    if (!v.length) { v = toutes.filter(function (a) { return a.panneaux.length; }); }
    v.sort(function (a, b) {
      return (a.meta.onglet ? a.meta.onglet.num : '').localeCompare(b.meta.onglet ? b.meta.onglet.num : '');
    });
    return v;
  }

  /* Reconstruit tabs + deck à partir d'un jeu d'enregistrements.
     Utilisé au boot ET après un chargement in-page (via la nav) :
     « chargé directement » et « navigué vers » passent par le même
     chemin. */
  function reconstruireDepuis(records) {
    volets = filtrerVolets(records);
    construireOnglets();
    mode = 'contenu';
    monterVolet(0);
  }

  function construireOnglets() {
    tabsEl.innerHTML = '';

    var home = h('a', 'sos-home');
    home.href = '/';
    home.title = 'Accueil';
    home.setAttribute('aria-label', 'Accueil');
    home.innerHTML = '<i class="fi fi-tr-house-flood"></i>';
    tabsEl.appendChild(home);

    // Bouton sommaire : seulement si la couche nav est présente.
    if (SOS.nav) {
      var somm = h('button', 'sos-somm');
      somm.title = 'Sommaire des annexes';
      somm.setAttribute('aria-label', 'Sommaire des annexes');
      somm.setAttribute('data-somm', '1');
      somm.innerHTML = '<i class="fi fi-tr-cardinal-compass"></i>';
      tabsEl.appendChild(somm);
    }

    volets.forEach(function (a, i) {
      var o = a.meta.onglet || { num: '', libelle: a.meta.communaute || '' };
      var b = h('button', 'sos-tab');
      b.setAttribute('data-commu', i);
      b.innerHTML = '<span class="num">' + (o.num || '') + '</span>' + (o.libelle || '');
      tabsEl.appendChild(b);
    });

    // bouton d'édition (réutilise tes classes de bottin : style + gating admin)
    editBtn = h('a', 'sos-edit');
    editBtn.href = '#';
    editBtn.title = 'Éditer ce message';
    editBtn.setAttribute('aria-label', 'Éditer ce message');
    editBtn.innerHTML = '<i class="fi fi-tr-pen-field"></i>';
    editBtn.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      var url = editBtn.getAttribute('data-edit');
      if (url) { window.open(url, '_blank', 'noopener'); }
    });
    tabsEl.appendChild(editBtn);
  }

  // URL d'édition FA depuis la métadonnée EDIT (id de post OU url complète).
  // On rétablit les & que FA/innerHTML encode en &amp; (sinon param « amp; » cassé).
  function urlEdition(v) {
    if (!v) { return ''; }
    v = v.replace(/&amp;/gi, '&');
    if (/^https?:/i.test(v)) { return v; }
    return location.origin + '/post?p=' + encodeURIComponent(v) + '&mode=editpost';
  }

  /* =========================================================
     MONTER UN VOLET (change --commu, reconstruit le deck)
     ========================================================= */
  function monterVolet(idx) {
    if (idx < 0 || idx >= volets.length) { return; }
    mode = 'contenu';
    iVolet = idx;
    var volet = volets[idx];

    // couleur du volet (les variantes --commu40/20 se dérivent en CSS)
    if (volet.meta.couleur) { app.style.setProperty('--commu', 'var(' + volet.meta.couleur + ')'); }

    // bouton d'édition : URL du post de CE volet
    if (editBtn) {
      var urlE = urlEdition(volet.meta.edit);
      if (urlE) { editBtn.setAttribute('data-edit', urlE); editBtn.style.display = ''; }
      else { editBtn.removeAttribute('data-edit'); editBtn.style.display = 'none'; }
    }

    // bouton sommaire inactif, onglet actif
    var sb = tabsEl.querySelector('.sos-somm');
    if (sb) { sb.classList.remove('actif'); }
    Array.prototype.forEach.call(tabsEl.querySelectorAll('.sos-tab'), function (t, i) {
      t.classList.toggle('actif', i === idx);
    });

    // deck
    deckEl.innerHTML = '';
    panneaux = [];
    var total = volet.panneaux.length;
    volet.panneaux.forEach(function (pan, i) {
      var sec = rendrePanneau(pan, i, total);
      deckEl.appendChild(sec);
      panneaux.push(sec);
    });

    // pastilles
    dotsEl.style.display = '';
    dotsEl.innerHTML = '';
    panneaux.forEach(function (_, i) {
      var d = h('button', 'sos-dot');
      d.setAttribute('data-goto', i);
      dotsEl.appendChild(d);
    });

    courant = 0; enTransit = false;
    if (panneaux[0]) {
      panneaux[0].classList.add('actif');
      app.setAttribute('data-theme', panneaux[0].getAttribute('data-theme') || 'sombre');
    }
    if (dotsEl.firstChild) { dotsEl.firstChild.classList.add('actif'); }
    app.classList.remove('reduit');
    tracer(panneaux[0]);
  }

  /* Monte une section arbitraire (non-volet) dans le deck : primitive
     utilisée par la nav pour afficher le sommaire. */
  function monterSection(el, o) {
    o = o || {};
    if (!app || !el) { return; }
    mode = 'special';
    iVolet = -1;
    app.classList.remove('reduit');
    app.setAttribute('data-theme', o.theme || 'sombre');

    Array.prototype.forEach.call(tabsEl.querySelectorAll('.sos-tab'), function (t) {
      t.classList.remove('actif');
    });
    var sb = tabsEl.querySelector('.sos-somm');
    if (sb) { sb.classList.toggle('actif', !!o.ongletSomm); }
    if (editBtn) { editBtn.style.display = 'none'; }

    dotsEl.innerHTML = '';
    dotsEl.style.display = 'none';

    deckEl.innerHTML = '';
    deckEl.appendChild(el);
    panneaux = [el];
    courant = 0; enTransit = false;
    el.classList.add('actif');
  }

  /* =========================================================
     RENDU D'UN PANNEAU
     ========================================================= */
  function rendrePanneau(pan, index, total) {
    var estHero = pan.blocs.some(function (b) { return b.type === 'hero'; });
    var sec = h('section', 'sos-panneau ' + (estHero ? 'p-hero' : 'p-edito'));
    sec.setAttribute('data-theme', estHero ? 'sombre' : 'clair');
    sec.setAttribute('data-panneau', pan.id);

    if (estHero) {
      pan.blocs.forEach(function (b) { var n = SOS.rendreBloc(b); if (n) { sec.appendChild(n); } });
      if (index < total - 1) {
        var fl = h('button', 'btn-suite hero-suite', SOS.FLECHE + '<span>Découvrir la suite</span>');
        fl.setAttribute('data-goto', index + 1);
        sec.appendChild(fl);
      }
      return sec;
    }

    sec.appendChild(h('div', 'e2top'));
    var wrap = null;
    pan.blocs.forEach(function (b) {
      var noeud = SOS.rendreBloc(b);
      if (!noeud) { return; }
      if (SOS.blocsPleineLargeur[b.type]) {
        wrap = null; sec.appendChild(noeud);
      } else {
        if (!wrap) { wrap = h('div', 'e2wrap'); sec.appendChild(wrap); }
        wrap.appendChild(noeud);
      }
    });
    return sec;
  }

  /* =========================================================
     NAVIGATION ENTRE PANNEAUX
     ========================================================= */
  function aller(i) {
    if (i === courant || i < 0 || i >= panneaux.length || enTransit) { return; }
    enTransit = true;
    var s = panneaux[courant], e = panneaux[i];
    s.classList.remove('actif');
    s.classList.toggle('avant', i > courant);
    e.classList.add('actif');
    e.classList.remove('avant');
    app.setAttribute('data-theme', e.getAttribute('data-theme') || 'sombre');
    Array.prototype.forEach.call(dotsEl.children, function (d, k) { d.classList.toggle('actif', k === i); });
    e.scrollTop = 0;
    app.classList.remove('reduit');
    courant = i;
    setTimeout(function () { enTransit = false; tracer(e); }, 60);
  }

  function panneauParId(id) {
    for (var i = 0; i < panneaux.length; i++) {
      if (panneaux[i].getAttribute('data-panneau') === id) { return i; }
    }
    return -1;
  }

  /* =========================================================
     ROUTAGE DES LIENS INTERNES (panneau: / post:)
     Le préfixe « sujet: » (inter-topic) est délégué à la nav.
     ========================================================= */
  function router(cible) {
    if (!cible) { return; }
    var sep = cible.indexOf(':');
    var type = sep < 0 ? '' : cible.slice(0, sep).trim();
    var arg = sep < 0 ? cible.trim() : cible.slice(sep + 1).trim();

    if (type === 'panneau') {
      var idx = panneauParId(arg);
      if (idx >= 0) { aller(idx); } else { console.warn('SOS: panneau introuvable «' + arg + '»'); }
    } else if (type === 'post') {
      // post N -> volet correspondant dans le topic courant (index dans SOS.annexes)
      var n = parseInt(arg, 10);
      var visee = (SOS.annexes || [])[n - 1];
      var ic = volets.indexOf(visee);
      if (ic >= 0) { basculerVolet(ic); } else { console.warn('SOS: post:' + arg + ' non résolu'); }
    } else if (type === 'sujet') {
      // autre topic FA : in-page si la nav est là, sinon nouvel onglet
      var url = '/' + arg.replace(/^\//, '');
      if (SOS.nav && SOS.nav.charger) { SOS.nav.charger(url); }
      else { window.open(location.origin + url, '_blank'); }
    } else {
      console.warn('SOS: cible non préfixée «' + cible + '»');
    }
  }

  function basculerVolet(idx) {
    if (idx === iVolet && mode === 'contenu') { return; }
    monterVolet(idx);
  }

  /* =========================================================
     TRACÉ SVG DU ZIGZAG (mesuré après layout)
     ========================================================= */
  var OUT = 26, R = 24, NODE = 8;
  function tracer(panneau) {
    if (!panneau) { return; }
    var mobile = global.matchMedia && global.matchMedia('(max-width:960px)').matches;
    Array.prototype.forEach.call(panneau.querySelectorAll('.zz'), function (zz) {
      var svg = zz.querySelector('.zzline');
      if (!svg) { return; }
      if (mobile) { svg.style.display = 'none'; return; }
      svg.style.display = '';
      var rows = zz.querySelectorAll('.zz-row');
      if (!rows.length) { return; }
      var W = zz.clientWidth, H = zz.offsetHeight;
      if (W < 10) { return; }
      var pts = Array.prototype.map.call(rows, function (r) {
        var g = r.classList.contains('g');
        return { x: g ? OUT : (W - OUT), y: r.offsetTop + r.offsetHeight / 2 };
      });
      var d = 'M' + pts[0].x + ',' + pts[0].y;
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        var gy = (rows[i].offsetTop + rows[i].offsetHeight + rows[i + 1].offsetTop) / 2;
        var dir = (b.x > a.x) ? 1 : -1;
        d += ' L' + a.x + ',' + (gy - R);
        d += ' Q' + a.x + ',' + gy + ' ' + (a.x + dir * R) + ',' + gy;
        d += ' L' + (b.x - dir * R) + ',' + gy;
        d += ' Q' + b.x + ',' + gy + ' ' + b.x + ',' + (gy + R);
        d += ' L' + b.x + ',' + b.y;
      }
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var NS = 'http://www.w3.org/2000/svg';
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      var path = document.createElementNS(NS, 'path'); path.setAttribute('d', d); svg.appendChild(path);
      pts.forEach(function (p) {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', NODE);
        svg.appendChild(c);
      });
    });
  }

  /* =========================================================
     ÉVÉNEMENTS (branchés une seule fois, sur la coquille permanente)
     ========================================================= */
  function brancherEvenements() {
    // délégation des clics
    app.addEventListener('click', function (ev) {
      var g = ev.target.closest('[data-goto]');
      if (g) { aller(parseInt(g.getAttribute('data-goto'), 10)); return; }

      // carte du sommaire -> chargement in-page (délégué à la nav)
      var an = ev.target.closest('[data-annexe]');
      if (an) {
        // clic gauche simple -> in-page ; modificateurs -> nouvel onglet natif
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button === 1) { return; }
        if (SOS.nav && SOS.nav.charger) { ev.preventDefault(); SOS.nav.charger(an.getAttribute('data-annexe')); }
        return;
      }

      // bouton sommaire (délégué à la nav)
      var s = ev.target.closest('[data-somm]');
      if (s) { if (SOS.nav && SOS.nav.sommaire) { SOS.nav.sommaire(); } return; }

      var c = ev.target.closest('[data-cible]');
      if (c) { router(c.getAttribute('data-cible')); return; }

      var t = ev.target.closest('[data-commu]');
      if (t) { basculerVolet(parseInt(t.getAttribute('data-commu'), 10)); return; }
    });

    // réduction de la barre au scroll (panneaux éditoriaux)
    deckEl.addEventListener('scroll', function (ev) {
      var p = ev.target;
      if (p.classList && p.classList.contains('sos-panneau') && p === panneaux[courant]) {
        app.classList.toggle('reduit', p.scrollTop > 40);
      }
    }, true);

    // molette : n'avance que si le panneau courant n'a plus de scroll
    var wt;
    global.addEventListener('wheel', function (ev) {
      var p = panneaux[courant]; if (!p) { return; }
      var scrollable = p.scrollHeight > p.clientHeight + 4;
      if (scrollable) {
        var bas = p.scrollTop + p.clientHeight >= p.scrollHeight - 4, haut = p.scrollTop <= 0;
        if (ev.deltaY > 0 && !bas) { return; }
        if (ev.deltaY < 0 && !haut) { return; }
      }
      clearTimeout(wt);
      wt = setTimeout(function () {
        if (ev.deltaY > 18) { aller(courant + 1); } else if (ev.deltaY < -18) { aller(courant - 1); }
      }, 40);
    }, { passive: true });

    // clavier
    global.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { aller(courant + 1); }
      if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { aller(courant - 1); }
    });

    // redimensionnement -> retracer
    var rt;
    global.addEventListener('resize', function () {
      clearTimeout(rt); rt = setTimeout(function () { tracer(panneaux[courant]); }, 120);
    });

    // images du deck -> retracer quand elles arrivent
    deckEl.addEventListener('load', function (ev) {
      if (ev.target && ev.target.tagName === 'IMG') { tracer(panneaux[courant]); }
    }, true);
  }

  /* =========================================================
     INTERFACE POUR LA NAV + API + AUTO-MONTAGE
     ========================================================= */
  shell.reconstruire   = reconstruireDepuis;  // rebâtir tabs+deck depuis des records
  shell.filtrerVolets  = filtrerVolets;       // valider qu'un topic a des données
  shell.monterSection  = monterSection;       // afficher une vue arbitraire (sommaire)

  SOS.monter = construire;

  global.addEventListener('sos:pret', function () {
    if (!document.querySelector('.sos-app')) { construire(); }
    if (global.document.fonts) { global.document.fonts.ready.then(function () { tracer(panneaux[courant]); }); }
  });

})(window);
