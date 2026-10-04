/* =============================================================
   SOS — Sophia OS · BLOC CHRONOLOGIE (sos-bloc-chrono.js)
   -------------------------------------------------------------
   Ajoute le type de bloc « chrono » au registre SOS.blocs. Le bloc
   se lit dans le post comme n'importe quel autre, mais il rend une
   interface complète : frise des périodes, légende filtrante,
   recherche, accordéons.

   LE PANNEAU NE DÉFILE PAS : il tient la hauteur de l'écran et
   seule la liste des événements défile. Deux règles de la feuille
   CSS s'en chargent, via :has(.tdlch) sur .sos-panneau.

   FORMAT DU BLOC — voir le gabarit livré avec ce fichier :
     CATEGORIE: cle | libellé | --var-couleur
     PERIODE:   cle | titre | dates [| drapeaux]
                drapeaux : « annees » (sépare les millésimes),
                           « recent » (trie du plus récent au plus vieux)
     TOUTES:    libellé | dates          (étape « tout voir », facultative)
     EVENEMENT: periode | categorie | date affichée [| date de tri]
       TITRE:   …
       TEXTE:   une ligne = un paragraphe
       APARTE:  … (facultatif, en italique sous le texte)
       IMAGE:   url [| légende]          (facultatif)
       LIEN:    libellé | url            (facultatif)
       MARQUE:  … (facultatif, ex. « En jeu »)

   Les ajouts versés dans Firebase par le staff arrivent au lot
   suivant : ce fichier expose SOS.chrono.ajouter() pour eux.

   Dépend de : sos-core.js, sos-blocs.js (SOS.h, SOS.util, grouper).
   À charger APRÈS sos-blocs.js, AVANT sos-annexe.js.
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { console.error('sos-bloc-chrono.js : sos-core.js doit être chargé avant.'); return; }
  var h = SOS.h, U = SOS.util;

  /* ===================== TEXTES ===================== */
  var TXT = {
    RECHERCHE: 'Chercher un nom, un lieu…',
    VIDE:      'Aucun événement ne correspond.',
    SANS_BLOC: 'Chronologie vide : aucun événement déclaré dans le bloc.'
  };
  var SOURCES = [];                 /* les instances montées, pour les ajouts du lot suivant */

  /* ===================== UTILS ===================== */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&(?![a-z#0-9]+;)/gi, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function sansAccent(s) {
    return String(s || '').replace(/&nbsp;|\u00a0/g, ' ').replace(/<[^>]*>/g, '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  /* toutes les occurrences d'une clé, avant le premier EVENEMENT */
  function entrees(bloc, cle) {
    var out = [];
    (bloc && bloc.entrees || []).some(function (e) {
      if (e.cle === 'EVENEMENT') { return true; }
      if (e.cle === cle) { out.push(e.lignes.join(' ')); }
      return false;
    });
    return out;
  }
  /* millésime de tri : la date ISO si elle est donnée, sinon le premier
     nombre à quatre chiffres du libellé (« 1928–1930 », « v. 1840 »…) */
  function annee(e) {
    if (e.iso) { return parseInt(e.iso.slice(0, 4), 10); }
    var m = /\d{4}/.exec(e.d || '');
    return m ? parseInt(m[0], 10) : 0;
  }
  function quand(e) { return e.iso || (annee(e) + '-01-01'); }

  /* ===================== LECTURE DU BLOC ===================== */
  function lire(bloc) {
    var d = { cats: {}, ordreCats: [], periodes: [], toutes: null, events: [] };

    entrees(bloc, 'CATEGORIE').forEach(function (l) {
      var p = U.pipe(U.sansBalises(l));
      if (!p[0]) { return; }
      d.cats[p[0]] = { l: p[1] || p[0], c: p[2] || '--dark2' };
      d.ordreCats.push(p[0]);
    });
    entrees(bloc, 'PERIODE').forEach(function (l) {
      var p = U.pipe(U.sansBalises(l));
      if (!p[0]) { return; }
      var f = ' ' + (p[3] || '') + ' ';
      d.periodes.push({ id: p[0], t: p[1] || p[0], d: p[2] || '',
                        annees: f.indexOf(' annees ') >= 0, recent: f.indexOf(' recent ') >= 0 });
    });
    var tt = entrees(bloc, 'TOUTES')[0];
    if (tt) {
      var q = U.pipe(U.sansBalises(tt));
      d.toutes = { id: '*', t: q[0] || 'Toutes les périodes', d: q[1] || '' };
    }

    SOS.grouper(bloc, 'EVENEMENT').forEach(function (g) {
      var p = U.pipe(U.sansBalises(g.ouverture[0] || ''));
      var img = U.pipe(U.sansBalises((g.champs.IMAGE || [])[0] || ''));
      var lien = U.pipe(U.sansBalises((g.champs.LIEN || [])[0] || ''));
      var titre = U.nu(g.champs.TITRE || []);
      if (!p[0] || !titre) { return; }                     /* période et titre obligatoires */
      d.events.push({
        p: p[0], c: p[1] || d.ordreCats[0], d: p[2] || '', iso: p[3] || null,
        t: titre,
        corps: g.champs.TEXTE || [],
        resume: U.nu(g.champs.TEXTE || []),
        a: U.nu(g.champs.APARTE || []),
        img: /^https?:\/\//i.test(img[0] || '') ? img[0] : '',
        legende: img[1] || '',
        lienLib: lien[0] || '', lienUrl: lien[1] || '',
        marque: U.nu(g.champs.MARQUE || [])
      });
    });
    return d;
  }

  /* ===================== DONNÉES ===================== */
  /* Chaque instance porte son état : plusieurs chronologies peuvent coexister. */
  function faireApi(d) {
    var etat = { periode: null, cats: {}, q: '' }, api = { d: d, etat: etat, ajouts: [] };

    api.periode = function (id) {
      if (id === '*') { return d.toutes; }
      for (var i = 0; i < d.periodes.length; i++) { if (d.periodes[i].id === id) { return d.periodes[i]; } }
      return null;
    };
    api.actifs = function () {
      return Object.keys(etat.cats).filter(function (k) { return etat.cats[k]; });
    };
    api.garde = function (e) {
      var f = api.actifs();
      if (f.length && f.indexOf(e.c) < 0) { return false; }
      if (etat.q) {
        var foin = sansAccent([e.d, e.t, e.resume, e.a].join(' '));
        if (foin.indexOf(sansAccent(etat.q)) < 0) { return false; }
      }
      return api.gardeSup ? api.gardeSup(e) : true;        /* crochet du lot suivant */
    };
    /* Une période garde l'ordre déclaré du post ; les ajouts de Firebase s'y
       glissent à leur millésime. Une période « recent » est triée à l'envers. */
    api.liste = function (id) {
      if (id === '*') {
        return d.periodes.reduce(function (acc, p) { return acc.concat(api.liste(p.id)); }, []);
      }
      var per = api.periode(id), base = d.events.filter(function (e) { return e.p === id; }).slice();
      api.ajouts.filter(function (e) { return e.p === id; }).forEach(function (a) {
        var i = 0;
        while (i < base.length && annee(base[i]) <= annee(a)) { i++; }
        base.splice(i, 0, a);
      });
      if (per && per.recent) {
        base.sort(function (x, y) { return quand(y) < quand(x) ? -1 : 1; });
      }
      return base.filter(api.garde);
    };
    return api;
  }

  /* ===================== RENDU : FRISE ET OUTILS ===================== */
  function htmlRail(api) {
    var d = api.d, etat = api.etat, filtre = api.actifs().length || etat.q;
    var etapes = d.periodes.concat(d.toutes ? [d.toutes] : []);
    var iP = 0;
    etapes.forEach(function (p, i) { if (p.id === etat.periode) { iP = i; } });
    var pas = etapes.length > 1 ? 90 / (etapes.length - 1) : 0;

    return '<div class="tdlch-rail-wrap"><div class="tdlch-rail" style="--avance:'
      + (etat.periode === '*' ? 90 : iP * pas) + '%;min-width:' + (etapes.length * 132) + 'px">'
      + etapes.map(function (p, i) {
          var n = filtre ? api.liste(p.id).length : 0;
          return '<button class="tdlch-per' + (p.id === etat.periode ? ' on' : '') + (i < iP ? ' fait' : '')
            + (filtre && !n ? ' vide' : '') + '" type="button" data-p="' + esc(p.id) + '">'
            + '<span class="tdlch-per-titre">' + esc(p.t) + '</span><span class="tdlch-pastille"></span>'
            + '<span class="tdlch-per-date">' + esc(p.d) + (filtre ? ' · <b>' + n + '</b>' : '')
            + '</span></button>';
        }).join('') + '</div></div>';
  }
  function htmlOutils(api) {
    var d = api.d, etat = api.etat;
    return '<div class="tdlch-outils"><div class="tdlch-cats' + (api.actifs().length ? ' filtre' : '') + '">'
      + d.ordreCats.map(function (k) {
          return '<button class="tdlch-cat' + (etat.cats[k] ? ' on' : '') + '" type="button" data-c="' + esc(k)
            + '" style="--c:var(' + esc(d.cats[k].c) + ');--c20:color-mix(in srgb,var(' + esc(d.cats[k].c)
            + ') 13%,transparent)">' + esc(d.cats[k].l) + '</button>';
        }).join('')
      + '</div><div class="tdlch-staff"><div class="tdlch-recherche"><i class="fi fi-tr-search"></i>'
      + '<input type="search" placeholder="' + esc(TXT.RECHERCHE) + '" value="' + esc(etat.q) + '"></div>'
      + '<span class="tdlch-staff-slot"></span></div></div>';
  }

  /* ===================== RENDU : UN ÉVÉNEMENT ===================== */
  function surligne(api, txt) {
    var q = api.etat.q;
    if (!q || /[<&]/.test(txt)) { return txt; }           /* jamais au milieu de balises */
    var plat = sansAccent(txt), cible = sansAccent(q), out = '', i = 0, j;
    while ((j = plat.indexOf(cible, i)) >= 0) {
      out += txt.slice(i, j) + '<mark>' + txt.slice(j, j + cible.length) + '</mark>';
      i = j + cible.length;
    }
    return out + txt.slice(i);
  }
  function htmlEvenement(api, e) {
    var C = api.d.cats[e.c] || { c: '--dark2' };
    var style = '--c:var(' + esc(C.c) + ');--c20:color-mix(in srgb,var(' + esc(C.c) + ') 13%,transparent)';
    var fig = e.img
      ? '<figure class="tdlch-ev-fig"><img class="tdlch-ev-img" alt="" loading="lazy" src="' + esc(e.img) + '">'
        + (e.legende ? '<figcaption>' + esc(e.legende) + '</figcaption>' : '') + '</figure>'
      : '';
    var corps = U.paragraphes(e.corps);
    if (api.etat.q) {
      corps = e.corps.map(function (l) { return '<p>' + surligne(api, l.trim()) + '</p>'; }).join('');
    }
    return '<article class="tdlch-ev' + (api.classesSup ? api.classesSup(e) : '') + '" style="' + style
      + '" data-id="' + esc(e.id || '') + '">'
      + '<button class="tdlch-ev-tete" type="button">'
      + '<span class="tdlch-ev-date">' + surligne(api, esc(e.d)) + '</span>'
      + '<span class="tdlch-ev-txt"><h3>' + surligne(api, esc(e.t))
      + (e.marque ? '<span class="tdlch-marque">' + esc(e.marque) + '</span>' : '')
      + (api.marquesSup ? api.marquesSup(e) : '') + '</h3>'
      + '<p>' + esc(e.resume) + '</p></span>'
      + '<i class="tdlch-chev fi fi-tr-angle-small-down"></i></button>'
      + (api.boutonsSup ? api.boutonsSup(e) : '')
      + '<div class="tdlch-ev-corps"><div class="tdlch-ev-pli">'
      + '<div class="tdlch-ev-contenu' + (fig ? ' avec-img' : '') + '"><div>' + corps
      + (e.a ? '<p class="tdlch-aparte">' + surligne(api, esc(e.a)) + '</p>' : '')
      + (e.lienUrl ? '<a class="tdlch-lire" href="' + esc(e.lienUrl) + '" data-ext>'
          + esc(e.lienLib || 'En savoir plus') + '</a>' : '')
      + (api.piedSup ? api.piedSup(e) : '')
      + '</div>' + fig + '</div></div></div></article>';
  }

  /* ===================== RENDU : LA LISTE ===================== */
  function htmlListe(api) {
    var etat = api.etat, L = api.liste(etat.periode);
    if (!L.length) { return '<p class="tdlch-vide-liste">' + esc(TXT.VIDE) + '</p>'; }
    var per = api.periode(etat.periode), coupe = null, out = '';
    L.forEach(function (e, i) {
      if (etat.periode === '*') {
        if (e.p !== coupe) {
          coupe = e.p;
          var p = api.periode(e.p);
          out += '<p class="tdlch-periode">' + esc(p ? p.t : e.p) + '</p>';
        }
      } else if (per && per.annees) {
        var an = annee(e);
        if (an !== coupe) { if (i) { out += '<div class="tdlch-coupe"></div>'; } coupe = an; }
      }
      out += htmlEvenement(api, e);
    });
    return out;
  }

  function peindre(api, opts) {
    var r = api.racine;
    r.querySelector('.tdlch-haut').innerHTML = htmlOutils(api) + htmlRail(api);
    var liste = r.querySelector('.tdlch-liste');
    liste.innerHTML = htmlListe(api);
    liste.scrollTop = 0;
    if (opts && opts.anime) {                              /* le contenu monte, au changement d'onglet */
      liste.classList.remove('anime'); void liste.offsetWidth; liste.classList.add('anime');
    }
    if (api.apresRendu) { api.apresRendu(); }               /* crochet du lot suivant */
  }

  /* ===================== ÉVÉNEMENTS ===================== */
  function brancher(api) {
    var r = api.racine, etat = api.etat;

    r.addEventListener('click', function (ev) {
      var t = ev.target, x;
      if ((x = t.closest('a[data-ext]'))) {
        ev.preventDefault(); ev.stopPropagation();
        global.open(x.getAttribute('href'), '_blank');
        return;
      }
      if ((x = t.closest('.tdlch-per'))) {
        etat.periode = x.getAttribute('data-p'); peindre(api, { anime: true }); return;
      }
      if ((x = t.closest('.tdlch-cat'))) {
        var k = x.getAttribute('data-c'); etat.cats[k] = !etat.cats[k]; peindre(api); return;
      }
      if (api.clicSup && api.clicSup(t)) { return; }        /* crochet du lot suivant */
      if ((x = t.closest('.tdlch-ev-tete'))) {
        var art = x.parentNode, ouvert = art.classList.contains('ouvert');
        Array.prototype.forEach.call(r.querySelectorAll('.tdlch-ev.ouvert'), function (o) {
          o.classList.remove('ouvert');                     /* un seul déplié à la fois */
        });
        if (!ouvert) { art.classList.add('ouvert'); }
      }
    });

    r.addEventListener('input', function (ev) {
      if (ev.target.type !== 'search') { return; }
      etat.q = ev.target.value.trim();
      var pos = ev.target.selectionStart;
      peindre(api);
      var n = r.querySelector('input[type="search"]');
      if (n) { n.focus(); n.setSelectionRange(pos, pos); }
    });

    /* La coquille change de panneau à la molette : tant que la liste peut
       défiler, elle garde l'événement pour elle. */
    r.addEventListener('wheel', function (ev) {
      var liste = ev.target.closest('.tdlch-liste, .tdlch-rail-wrap');
      if (!liste) { return; }
      var bas = liste.scrollTop + liste.clientHeight >= liste.scrollHeight - 1;
      var haut = liste.scrollTop <= 0;
      if ((ev.deltaY > 0 && !bas) || (ev.deltaY < 0 && !haut)) { ev.stopPropagation(); }
    }, true);
  }

  /* ===================== LE BLOC ===================== */
  function rendreChrono(bloc) {
    var d = lire(bloc);
    var racine = h('div', 'tdlch');
    if (!d.events.length) {
      racine.innerHTML = '<p class="tdlch-vide-liste">' + esc(TXT.SANS_BLOC) + '</p>';
      return racine;
    }
    var api = faireApi(d);
    api.racine = racine;
    api.etat.periode = d.periodes.length ? d.periodes[0].id : '*';
    d.ordreCats.forEach(function (k) { api.etat.cats[k] = false; });
    api.peindre = peindre;

    racine.innerHTML = '<div class="tdlch-haut"></div><div class="tdlch-liste"></div>';
    brancher(api);
    peindre(api);
    SOURCES.push(api);
    return racine;
  }

  /* ===================== ENREGISTREMENT ===================== */
  SOS.blocs.chrono = rendreChrono;
  SOS.blocsPleineLargeur.chrono = 1;        /* hors .e2wrap : la frise va bord à bord */

  /* Point d'accroche du lot suivant (ajouts manuels, orphelins, staff). */
  SOS.chrono = {
    instances: SOURCES,
    annee: annee,
    quand: quand,
    esc: esc,
    peindre: function (api, opts) { peindre(api, opts); }
  };

})(window);
