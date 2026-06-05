/* ============================================================
   THE DROWNED LANDS — Calendrier custom v10
   tdl-calendar.js
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     MAPPING TYPES → CLASSES CSS
     Lire le titre de l'événement pour détecter le tag.
     Tags définis par S&L : [INTRIGUE] [EV. MEMBRE] [TRADITION] [LORE]
     Anniversaires : détectés via structure HTML FA
  ---------------------------------------------------------- */
  var TYPE_MAP = [
    { tag: '[INTRIGUE]',   cls: 'dot-intrigue',  label: 'Intrigue'    },
    { tag: '[EV. MEMBRE]', cls: 'dot-membre',    label: 'Év. Membre'  },
    { tag: '[TRADITION]',  cls: 'dot-tradition', label: 'Tradition'   },
    { tag: '[LORE]',       cls: 'dot-lore',      label: 'Lore'        },
  ];

  function resolveTypeFromTitle(title) {
    var t = (title || '').toUpperCase();
    for (var i = 0; i < TYPE_MAP.length; i++) {
      if (t.indexOf(TYPE_MAP[i].tag) >= 0) return TYPE_MAP[i];
    }
    return null;
  }

  /* ----------------------------------------------------------
     CACHE DES DONNÉES /events
     Fetché une fois, stocké en mémoire pour le reste de la session.
     Clé : href de l'événement → { title, cat, desc, img, date }
  ---------------------------------------------------------- */
  var eventsCache = null;  /* null = pas encore chargé */
  var eventsPromise = null;

  function loadEventsPage() {
    if (eventsPromise) return eventsPromise;
    eventsPromise = fetch('/events', { credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var cache = {};

        /* FA liste les événements dans des liens de type /eXXXXXX-slug */
        var links = tmp.querySelectorAll('a[href*="/e"]');
        links.forEach(function (a) {
          var href = a.getAttribute('href') || '';
          if (!href.match(/\/e\d+/)) return;
          /* Normaliser l'URL en chemin absolu */
          var key = href.replace(/^https?:\/\/[^/]+/, '');
          if (!cache[key]) cache[key] = { href: href };
        });

        /* Chercher les blocs d'événements — structure FA /events */
        var rows = tmp.querySelectorAll('.event_row, .event-item, [class*="event"]');
        rows.forEach(function (row) {
          var a = row.querySelector('a[href*="/e"]');
          if (!a) return;
          var key = (a.getAttribute('href') || '').replace(/^https?:\/\/[^/]+/, '');
          var titleEl = row.querySelector('.event_title, .title, h3, h2');
          var descEl  = row.querySelector('.event_desc, .description, p');
          var imgEl   = row.querySelector('img');
          var dateEl  = row.querySelector('.event_date, .date, time');
          cache[key] = {
            href  : a.getAttribute('href'),
            title : titleEl ? titleEl.textContent.trim() : '',
            desc  : descEl  ? descEl.textContent.trim()  : '',
            img   : imgEl   ? imgEl.getAttribute('src')  : '',
            date  : dateEl  ? dateEl.textContent.trim()  : ''
          };
        });

        eventsCache = cache;
        return cache;
      })
      .catch(function () {
        eventsCache = {};
        return {};
      });
    return eventsPromise;
  }

  /* ----------------------------------------------------------
     EXTRACTION DU HTML OVERVIEW depuis onmouseover FA
  ---------------------------------------------------------- */
  function extractOvHtml(anchor) {
    var ov = anchor.getAttribute('onmouseover') || '';
    var m = ov.match(/createTitle\s*\(\s*this\s*,\s*'([\s\S]+?)'\s*,\s*event/);
    if (!m) return null;
    return m[1].replace(/\\'/g, "'");
  }

  /* ----------------------------------------------------------
     PARSING DU HTML FA
     Trois structures :
       1. Anniversaire    : .title-overview ET PAS "Sujets liés"
       2. Sujet lié       : contient "Sujets li" dans le texte
       3. Événement FA    : .header_overview_event
  ---------------------------------------------------------- */
  function parseOvHtml(html) {
    if (!html) return null;
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var fullText = tmp.textContent || '';

    /* --- Priorité 1 : Sujet lié --- */
    if (fullText.indexOf('Sujets li') >= 0) {
      var aEl    = tmp.querySelector('a');
      var dateEl = tmp.querySelector('i');
      /* Auteur : texte après "Auteur" ou après le <br> */
      var authorM = fullText.match(/Auteur\s*[:\-]?\s*([^\n<\r]+)/i);
      /* Titre du sujet : dans le <a> ou la balise title */
      var topicTitle = '';
      if (aEl) {
        topicTitle = aEl.textContent.trim();
      } else {
        /* Chercher le texte précédant "Sujets liés" */
        var titleM = fullText.match(/^([^\n]+)/);
        topicTitle = titleM ? titleM[1].trim() : '';
      }
      return {
        type   : 'topic',
        title  : topicTitle,
        date   : dateEl ? dateEl.textContent.trim() : '',
        author : authorM ? authorM[1].trim() : ''
      };
    }

    /* --- Priorité 2 : Anniversaire --- */
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

    /* --- Priorité 3 : Événement FA standard --- */
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
     RÉSOLUTION DU TYPE ET DE LA CLASSE CSS D'UNE PASTILLE
  ---------------------------------------------------------- */
  function resolveDot(href, faClass, ovData, eventsData) {
    /* Anniversaire en priorité absolue */
    if (ovData && ovData.type === 'anniv') {
      return { cls: 'dot-anniv', label: 'Anniversaire' };
    }

    /* Chercher le tag dans le titre disponible */
    var title = '';
    if (ovData && ovData.title) title = ovData.title;

    /* Enrichir depuis le cache /events si disponible */
    var evKey = (href || '').replace(/^https?:\/\/[^/]+/, '');
    if (eventsData && eventsData[evKey] && eventsData[evKey].title) {
      title = eventsData[evKey].title;
    }

    var typeMatch = resolveTypeFromTitle(title);
    if (typeMatch) return { cls: typeMatch.cls, label: typeMatch.label };

    /* Sujet lié */
    if (ovData && ovData.type === 'topic') {
      return { cls: 'dot-topic', label: 'Sujet lié' };
    }

    return { cls: 'dot-other', label: 'Autre' };
  }

  /* ----------------------------------------------------------
     CONSTRUCTION DU HTML DE TOOLTIP
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

    /* Sujet lié */
    if (ovData.type === 'topic') {
      return (
        '<div class="tt-ev-title">' + esc(ovData.title || fallbackTitle) + '</div>' +
        '<div class="tt-ev-type tt-type-topic">Sujet lié</div>' +
        (ovData.date   ? '<div class="tt-date">' + esc(ovData.date)   + '</div>' : '') +
        (ovData.author ? '<div class="tt-author">par ' + esc(ovData.author) + '</div>' : '')
      );
    }

    /* Événement FA standard */
    var typeLabel = dotInfo ? dotInfo.label : (ovData.cat || 'Événement');
    var typeCls   = dotInfo ? 'tt-type-' + dotInfo.cls.replace('dot-', '') : 'tt-type-other';
    return (
      '<div class="tt-ev-title">' + esc(ovData.title || fallbackTitle) + '</div>' +
      '<div class="tt-ev-type ' + typeCls + '">' + esc(typeLabel) + '</div>' +
      (ovData.date ? '<div class="tt-date">' + esc(ovData.date) + '</div>' : '') +
      ((ovData.img || ovData.desc)
        ? '<div class="tt-body">' +
            (ovData.img  ? '<img src="' + ovData.img  + '" class="tt-evimg" alt="" />' : '') +
            (ovData.desc ? '<div class="tt-desc">' + esc(ovData.desc) + '</div>' : '') +
          '</div>'
        : '')
    );
  }

  /* Échappement HTML */
  function esc(s) {
    return (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ----------------------------------------------------------
     EXTRACTION DU NUMÉRO DE JOUR
     FA génère "Lun 01 Juin 2026" ou "Dim 7 Juin 2026"
  ---------------------------------------------------------- */
  function extractDayNum(dateRaw) {
    /* Premier nombre 1-31 dans la chaîne */
    var m = dateRaw.match(/\b(\d{1,2})\b/);
    if (!m) return '';
    var n = parseInt(m[1], 10);
    if (n < 1 || n > 31) return '';
    return n < 10 ? '0' + n : '' + n;
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

    /* En-tête */
    html += '<div class="tdl-cal-header">';
    days.forEach(function (d) {
      html += '<div class="tdl-cal-hcell">' + d + '</div>';
    });
    html += '</div>';

    /* Grille */
    html += '<div class="tdl-cal-grid">';
    var colIndex = 0;

    tds.forEach(function (td) {
      var isEmpty = td.getAttribute('data-empty') === '1';
      var isEdge  = (colIndex % 7) >= 5;
      colIndex++;

      if (isEmpty) {
        html += '<div class="tdl-cal-cell tdl-empty"></div>';
        return;
      }

      var dateRaw = td.getAttribute('data-date') || '';
      var dayNum  = extractDayNum(dateRaw);

      var anchors  = td.querySelectorAll('li[data-ev="1"] a');
      var dotsHtml = '';

      anchors.forEach(function (a) {
        var href    = a.getAttribute('href') || '#';
        var faClass = (a.getAttribute('class') || '').trim();
        var title   = (a.getAttribute('data-title') || a.textContent || '').trim();
        var ovHtml  = extractOvHtml(a);
        var ovData  = parseOvHtml(ovHtml);
        var dotInfo = resolveDot(href, faClass, ovData, eventsData);
        var tipHtml = buildTipHtml(ovData, dotInfo, title);

        var ttCls = 'tdl-tt' + (isEdge ? ' tdl-tt-edge' : '');
        var arCls = 'tdl-tt-arrow' + (isEdge ? ' tdl-tt-arrow-edge' : '');

        dotsHtml +=
          '<div class="tdl-ev-wrap">' +
            '<a href="' + href + '" class="tdl-dot ' + dotInfo.cls + '" aria-label="' + esc(title) + '"></a>' +
            '<div class="' + ttCls + '">' +
              '<div class="tdl-tt-inner">' + tipHtml + '</div>' +
              '<div class="' + arCls + '"></div>' +
            '</div>' +
          '</div>';
      });

      html +=
        '<div class="tdl-cal-cell">' +
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
        '<div class="tdl-leg"><div class="tdl-leg-dot dot-topic"></div>Sujet lié</div>' +
        '<div class="tdl-leg"><div class="tdl-leg-dot dot-other"></div>Autre</div>' +
      '</div>';

    dst.innerHTML = html;
  }

  /* ----------------------------------------------------------
     INIT — charger /events puis construire
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
