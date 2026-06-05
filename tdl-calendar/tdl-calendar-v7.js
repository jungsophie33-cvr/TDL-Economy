/* ============================================================
   THE DROWNED LANDS — Calendrier custom v10.3
   tdl-calendar.js
   ============================================================ */

(function () {
  'use strict';

  var TYPE_MAP = [
    { tag: '[INTRIGUE]',   cls: 'dot-intrigue',  label: 'Intrigue'   },
    { tag: '[EV. MEMBRE]', cls: 'dot-membre',    label: 'Év. Membre' },
    { tag: '[TRADITION]',  cls: 'dot-tradition', label: 'Tradition'  },
    { tag: '[LORE]',       cls: 'dot-lore',      label: 'Lore'       },
  ];

  function resolveTypeFromTitle(title) {
    var t = (title || '').toUpperCase();
    for (var i = 0; i < TYPE_MAP.length; i++) {
      if (t.indexOf(TYPE_MAP[i].tag) >= 0) return TYPE_MAP[i];
    }
    return null;
  }

  /* ----------------------------------------------------------
     CACHE /events
  ---------------------------------------------------------- */
  var eventsPromise = null;

  function loadEventsPage() {
    if (eventsPromise) return eventsPromise;
    eventsPromise = fetch('/events', { credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var cache = {};
        var rows = tmp.querySelectorAll('[class*="event"]');
        rows.forEach(function (row) {
          var a = row.querySelector('a[href*="/e"]');
          if (!a) return;
          var key = (a.getAttribute('href') || '').replace(/^https?:\/\/[^/]+/, '');
          var titleEl = row.querySelector('.event_title, h3, h2');
          if (titleEl && key) cache[key] = { title: titleEl.textContent.trim() };
        });
        return cache;
      })
      .catch(function () { return {}; });
    return eventsPromise;
  }

  /* ----------------------------------------------------------
     EXTRACTION DU HTML OVERVIEW
  ---------------------------------------------------------- */
  function extractOvHtml(anchor) {
    var ov = anchor.getAttribute('onmouseover') || '';
    var m = ov.match(/createTitle\s*\(\s*this\s*,\s*'([\s\S]+?)'\s*,\s*event/);
    if (!m) return null;
    return m[1].replace(/\\'/g, "'");
  }

  /* ----------------------------------------------------------
     PARSING HTML FA
  ---------------------------------------------------------- */
  function parseOvHtml(html) {
    if (!html) return null;
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var fullText = tmp.textContent || '';

    /* 1. Sujet lié */
    if (fullText.indexOf('Sujets li') >= 0) {
      /* Titre du topic */
      var aEl = tmp.querySelector('a');
      var topicTitle = '';
      if (aEl) topicTitle = aEl.textContent.trim();
      if (!topicTitle) {
        var pEl = tmp.querySelector('p');
        topicTitle = pEl ? pEl.textContent.trim() : '';
      }
      if (!topicTitle) {
        var spanEl = tmp.querySelector('span, strong');
        topicTitle = spanEl ? spanEl.textContent.trim() : '';
      }

      var dateEl = tmp.querySelector('i');

      /* Auteur : dans le HTML FA des sujets liés, le pseudo est en texte brut
         sur la ligne "Auteur: PseudoIci" sans balise autour.
         On travaille sur le HTML brut (avant querySelector) pour couper
         proprement à la balise <br> ou <p> suivante. */
      var author = '';

      /* Extraire depuis le HTML brut : "Auteur:" suivi du texte jusqu'au
         prochain <br>, <p, </ ou fin de chaîne */
      var rawAuthorM = html.match(/Auteur\s*:\s*([^<\r\n]+)/i);
      if (rawAuthorM) {
        author = rawAuthorM[1].trim();
      }

      /* Fallback : lien profil */
      if (!author) {
        var profileLinks = tmp.querySelectorAll('a[href*="/u"], a[href*="profile"], a[href*="member"]');
        if (profileLinks.length > 0) {
          author = profileLinks[profileLinks.length - 1].textContent.trim();
        }
      }

      /* Fallback : .usr_grp_clr */
      if (!author) {
        var usrEl = tmp.querySelector('.usr_grp_clr, .name_bold_color');
        if (usrEl) author = usrEl.textContent.trim();
      }

      return {
        type   : 'topic',
        title  : topicTitle,
        date   : dateEl ? dateEl.textContent.trim() : '',
        author : author
      };
    }

    /* 2. Anniversaire */
    if (tmp.querySelector('.title-overview')) {
      var nameEl = tmp.querySelector('.usr_grp_clr strong, strong');
      var imgEl  = tmp.querySelector('img');
      var ageM   = fullText.match(/Age\s*[:\-]?\s*(\d+)/i);
      return {
        type   : 'anniv',
        name   : nameEl ? nameEl.textContent.trim() : '',
        avatar : imgEl  ? imgEl.getAttribute('src') : '',
        age    : ageM   ? ageM[1] : ''
      };
    }

    /* 3. Événement FA standard */
    var titleEl = tmp.querySelector('.header_overview_event span:first-child');
    var catEl   = tmp.querySelector('[class*="EV_TagCategory"]');
    var dateEl2 = tmp.querySelector('p i');
    var descEl  = tmp.querySelector('.desc_overview_event p');
    var imgEvEl = tmp.querySelector('.img_overview_event img');
    return {
      type  : 'event',
      title : titleEl ? titleEl.textContent.trim() : '',
      cat   : catEl   ? catEl.textContent.trim()   : '',
      date  : dateEl2 ? dateEl2.textContent.trim()  : '',
      desc  : descEl  ? descEl.textContent.trim()  : '',
      img   : imgEvEl ? imgEvEl.getAttribute('src') : ''
    };
  }

  /* ----------------------------------------------------------
     RÉSOLUTION TYPE + CLASSE
     Pour les sujets liés : on cherche le tag dans TOUTES
     les sources disponibles dans l'ordre de priorité.
  ---------------------------------------------------------- */
  function resolveDot(href, rawTitle, ovData, eventsData) {
    /* Anniversaire — priorité absolue */
    if (ovData && ovData.type === 'anniv') {
      return { cls: 'dot-anniv', label: 'Anniversaire' };
    }

    /* Construire une liste de titres candidates à inspecter */
    var candidates = [];

    /* 1. data-title de l'élément source (passé depuis le template FA) */
    if (rawTitle) candidates.push(rawTitle);

    /* 2. Titre extrait du onmouseover */
    if (ovData && ovData.title) candidates.push(ovData.title);

    /* 3. Cache /events */
    var evKey = (href || '').replace(/^https?:\/\/[^/]+/, '');
    if (eventsData && eventsData[evKey] && eventsData[evKey].title) {
      candidates.push(eventsData[evKey].title);
    }

    /* Chercher un tag dans chaque candidat */
    for (var i = 0; i < candidates.length; i++) {
      var typeMatch = resolveTypeFromTitle(candidates[i]);
      if (typeMatch) return { cls: typeMatch.cls, label: typeMatch.label };
    }

    /* Sujet lié sans tag reconnu */
    if (ovData && ovData.type === 'topic') {
      return { cls: 'dot-other', label: 'Autre' };
    }

    return { cls: 'dot-other', label: 'Autre' };
  }

  /* ----------------------------------------------------------
     CONSTRUCTION HTML TOOLTIP
  ---------------------------------------------------------- */
  function buildTipHtml(ovData, dotInfo, fallbackTitle) {
    if (!ovData) {
      return '<div class="tt-ev-title">' + esc(fallbackTitle) + '</div>';
    }

    /* Anniversaire */
    if (ovData.type === 'anniv') {
      return (
        '<div class="tt-anniv-wrap">' +
          (ovData.avatar
            ? '<img src="' + ovData.avatar + '" class="tt-avatar" alt="' + esc(ovData.name) + '" />'
            : '<div class="tt-avatar-ph"></div>') +
          '<div class="tt-anniv-info">' +
            '<div class="tt-anniv-tag">Anniversaire</div>' +
            '<div class="tt-name">' + esc(ovData.name) + '</div>' +
            (ovData.age ? '<div class="tt-age">' + esc(ovData.age) + ' ans</div>' : '') +
          '</div>' +
        '</div>'
      );
    }

    /* Sujet lié — titre + type + auteur, centré */
    if (ovData.type === 'topic') {
      var typeLabel = dotInfo ? dotInfo.label : 'Autre';
      var typeCls   = dotInfo ? 'tt-type-' + dotInfo.cls.replace('dot-', '') : 'tt-type-other';
      return (
        '<div class="tt-centered">' +
          '<div class="tt-ev-title">' + esc(ovData.title || fallbackTitle) + '</div>' +
          '<div class="tt-ev-type ' + typeCls + '">' + esc(typeLabel) + '</div>' +
        '</div>' +
        (ovData.author ? '<div class="tt-author">par ' + esc(ovData.author) + '</div>' : '')
      );
    }

    /* Événement FA standard */
    var evTypeLabel = dotInfo ? dotInfo.label : (ovData.cat || 'Événement');
    var evTypeCls   = dotInfo ? 'tt-type-' + dotInfo.cls.replace('dot-', '') : 'tt-type-other';
    return (
      '<div class="tt-centered">' +
        '<div class="tt-ev-title">' + esc(ovData.title || fallbackTitle) + '</div>' +
        '<div class="tt-ev-type ' + evTypeCls + '">' + esc(evTypeLabel) + '</div>' +
      '</div>' +
      (ovData.date ? '<div class="tt-date">' + esc(ovData.date) + '</div>' : '') +
      ((ovData.img || ovData.desc)
        ? '<div class="tt-body">' +
            (ovData.img  ? '<img src="' + ovData.img  + '" class="tt-evimg" alt="" />' : '') +
            (ovData.desc ? '<div class="tt-desc">' + esc(ovData.desc) + '</div>' : '') +
          '</div>'
        : '')
    );
  }

  function esc(s) {
    return (s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function padDay(n) { return n < 10 ? '0' + n : '' + n; }

  /* ----------------------------------------------------------
     DÉTECTION DU MOIS AFFICHÉ
     Lire le select mois et année du formulaire FA pour savoir
     si le mois affiché est le mois courant.
  ---------------------------------------------------------- */
  function getCurrentMonthDay() {
    var now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear(), day: now.getDate() };
  }

  function getDisplayedMonthYear() {
    /* FA génère deux selects dans #tdl-cal-form :
       premier = mois (option value = 1-12)
       second  = année (option value = YYYY) */
    var form = document.getElementById('tdl-cal-form');
    if (!form) return null;
    var selects = form.querySelectorAll('select');
    if (selects.length < 2) return null;
    var month = parseInt(selects[0].value, 10);
    var year  = parseInt(selects[1].value, 10);
    if (!month || !year) return null;
    return { month: month, year: year };
  }

  /* ----------------------------------------------------------
     CONSTRUCTION DE LA GRILLE
  ---------------------------------------------------------- */
  function buildCalendar(eventsData) {
    var src = document.getElementById('tdl-fa-source');
    var dst = document.getElementById('tdl-calendar');
    if (!src || !dst) return;

    var ths  = src.querySelectorAll('thead th');
    var days = [];
    ths.forEach(function (th) { days.push(th.textContent.trim()); });

    var tds = src.querySelectorAll('tbody td');
    var html = '';

    /* Déterminer si on affiche le mois courant */
    var now      = getCurrentMonthDay();
    var displayed = getDisplayedMonthYear();
    var isCurrentMonth = displayed &&
      displayed.month === now.month &&
      displayed.year  === now.year;

    /* En-tête */
    html += '<div class="tdl-cal-header">';
    days.forEach(function (d) {
      html += '<div class="tdl-cal-hcell">' + d + '</div>';
    });
    html += '</div>';

    /* Grille */
    html += '<div class="tdl-cal-grid">';

    var colIndex = 0;
    var dayCount = 0;

    tds.forEach(function (td) {
      var isEmpty = td.getAttribute('data-empty') === '1';
      var isEdge  = (colIndex % 7) >= 5;
      colIndex++;

      if (isEmpty) {
        html += '<div class="tdl-cal-cell tdl-empty"></div>';
        return;
      }

      dayCount++;
      var isToday = isCurrentMonth && dayCount === now.day;
      var dayNum  = padDay(dayCount);
      var anchors = td.querySelectorAll('li[data-ev="1"] a');
      var dotsHtml = '';

      anchors.forEach(function (a) {
        var href     = a.getAttribute('href') || '#';
        /* rawTitle = data-title injecté dans le template depuis EVENT_TITLE */
        var rawTitle = (a.getAttribute('data-title') || a.textContent || '').trim();
        var ovHtml   = extractOvHtml(a);
        var ovData   = parseOvHtml(ovHtml);
        var dotInfo  = resolveDot(href, rawTitle, ovData, eventsData);
        var tipHtml  = buildTipHtml(ovData, dotInfo, rawTitle);

        var ttCls = 'tdl-tt' + (isEdge ? ' tdl-tt-edge' : '');
        var arCls = 'tdl-tt-arrow' + (isEdge ? ' tdl-tt-arrow-edge' : '');

        dotsHtml +=
          '<div class="tdl-ev-wrap">' +
            '<a href="' + href + '" class="tdl-dot ' + dotInfo.cls + '" aria-label="' + esc(rawTitle) + '"></a>' +
            '<div class="' + ttCls + '">' +
              '<div class="tdl-tt-inner">' + tipHtml + '</div>' +
              '<div class="' + arCls + '"></div>' +
            '</div>' +
          '</div>';
      });

      html +=
        '<div class="tdl-cal-cell' + (isToday ? ' tdl-today' : '') + '">' +
          '<span class="tdl-day-num">' + dayNum + '</span>' +
          (dotsHtml ? '<div class="tdl-dots">' + dotsHtml + '</div>' : '') +
        '</div>';
    });

    html += '</div>';

    /* Légende */
    html +=
      '<div class="tdl-legend">' +
        '<div class="tdl-leg"><div class="tdl-leg-dot dot-anniv"></div>Anniversaire</div>' +
        '<div class="tdl-leg"><div class="tdl-leg-dot dot-intrigue"></div>Intrigue</div>' +
        '<div class="tdl-leg"><div class="tdl-leg-dot dot-membre"></div>Év. Membre</div>' +
        '<div class="tdl-leg"><div class="tdl-leg-dot dot-tradition"></div>Tradition</div>' +
        '<div class="tdl-leg"><div class="tdl-leg-dot dot-lore"></div>Lore</div>' +
        '<div class="tdl-leg"><div class="tdl-leg-dot dot-other"></div>Autre</div>' +
      '</div>';

    dst.innerHTML = html;
  }

  /* ----------------------------------------------------------
     INIT
  ---------------------------------------------------------- */
  function init() {
    loadEventsPage().then(function (eventsData) {
      buildCalendar(eventsData);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
