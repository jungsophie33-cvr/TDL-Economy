/* =============================================================
   SOS — Sophia OS · SHELL D'ANNEXE (sos-annexe.js)
   -------------------------------------------------------------
   Construit l'overlay : barre d'onglets (agrégée depuis les métas
   de toutes les communautés), deck de panneaux, transitions façon
   « site », flèche/suite, sommaire du hero, accordéons, routage des
   liens (panneau:/post:/sujet:), thème, réduction de barre au scroll,
   navigation molette/clavier, et tracé SVG du zigzag mesuré au JS.

   Dépend de : sos-core.js, sos-blocs.js.
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { console.error('sos-annexe.js : sos-core.js doit être chargé avant.'); return; }
  var h = SOS.h;

  /* ---- état ---- */
  var app, tabsEl, dotsEl, deckEl;
  var communautes = [];   // annexes ayant un onglet
  var iCommu = -1;        // communauté active
  var panneaux = [];      // panneaux de la communauté active (DOM sections)
  var courant = 0, enTransit = false;

  /* =========================================================
     CONSTRUCTION DE L'OVERLAY
     ========================================================= */
  function construire(opts) {
    opts = opts || {};
    var toutes = SOS.annexes || [];
    communautes = toutes.filter(function (a) { return a.meta && a.meta.onglet; });
    if (!communautes.length) { communautes = toutes.filter(function (a) { return a.panneaux.length; }); }
    if (!communautes.length) { return; }
    communautes.sort(function (a, b) {
      return (a.meta.onglet ? a.meta.onglet.num : '').localeCompare(b.meta.onglet ? b.meta.onglet.num : '');
    });

    app = h('div', 'sos-app');
    app.setAttribute('data-theme', 'sombre');
    tabsEl = h('nav', 'sos-tabs');
    dotsEl = h('div', 'sos-dots');
    deckEl = h('div', 'sos-deck');
    app.appendChild(tabsEl);
    app.appendChild(dotsEl);
    app.appendChild(deckEl);
    (opts.mount || document.body).appendChild(app);

    construireOnglets();
    brancherEvenements();
    monterCommunaute(0);
  }

  function construireOnglets() {
    tabsEl.innerHTML = '';
    var home = h('a', 'sos-home');
    home.href = '/';
    home.title = 'Accueil';
    home.setAttribute('aria-label', 'Accueil');
    home.innerHTML = '<i class="fi fi-tr-house-flood"></i>';
    tabsEl.appendChild(home);

    communautes.forEach(function (a, i) {
      var o = a.meta.onglet || { num: '', libelle: a.meta.communaute || '' };
      var b = h('button', 'sos-tab');
      b.setAttribute('data-commu', i);
      b.innerHTML = '<span class="num">' + (o.num || '') + '</span>' + (o.libelle || '');
      tabsEl.appendChild(b);
    });
  }

  /* =========================================================
     MONTER UNE COMMUNAUTÉ (change --commu, reconstruit le deck)
     ========================================================= */
  function monterCommunaute(idx) {
    if (idx < 0 || idx >= communautes.length) { return; }
    iCommu = idx;
    var annexe = communautes[idx];

    // couleur de communauté (les variantes --commu40/20 se dérivent en CSS)
    if (annexe.meta.couleur) { app.style.setProperty('--commu', 'var(' + annexe.meta.couleur + ')'); }

    // onglet actif
    Array.prototype.forEach.call(tabsEl.querySelectorAll('.sos-tab'), function (t, i) {
      t.classList.toggle('actif', i === idx);
    });

    // deck
    deckEl.innerHTML = '';
    panneaux = [];
    var total = annexe.panneaux.length;
    annexe.panneaux.forEach(function (pan, i) {
      var sec = rendrePanneau(pan, i, total);
      deckEl.appendChild(sec);
      panneaux.push(sec);
    });

    // pastilles
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
     ROUTAGE DES LIENS (panneau: / post: / sujet:)
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
      // post N -> communauté correspondante (best-effort : index dans SOS.annexes)
      var n = parseInt(arg, 10);
      var visee = (SOS.annexes || [])[n - 1];
      var ic = communautes.indexOf(visee);
      if (ic >= 0) { basculerCommunaute(ic); } else { console.warn('SOS: post:' + arg + ' non résolu'); }
    } else if (type === 'sujet') {
      // autre topic FA : window.open (jamais location.href / <a> nu — piège FA)
      window.open(location.origin + '/' + arg.replace(/^\//, ''), '_blank');
    } else {
      console.warn('SOS: cible non préfixée «' + cible + '»');
    }
  }

  function basculerCommunaute(idx) {
    if (idx === iCommu) { return; }
    // fondu doux : on laisse monterCommunaute réinitialiser le deck
    monterCommunaute(idx);
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
     ÉVÉNEMENTS
     ========================================================= */
  function brancherEvenements() {
    // délégation des clics
    app.addEventListener('click', function (ev) {
      var g = ev.target.closest('[data-goto]');
      if (g) { aller(parseInt(g.getAttribute('data-goto'), 10)); return; }
      var c = ev.target.closest('[data-cible]');
      if (c) { router(c.getAttribute('data-cible')); return; }
      var t = ev.target.closest('[data-commu]');
      if (t) { basculerCommunaute(parseInt(t.getAttribute('data-commu'), 10)); return; }
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
     API + AUTO-MONTAGE
     ========================================================= */
  SOS.monter = construire;

  global.addEventListener('sos:pret', function () {
    if (!document.querySelector('.sos-app')) { construire(); }
    if (global.document.fonts) { global.document.fonts.ready.then(function () { tracer(panneaux[courant]); }); }
  });

})(window);
