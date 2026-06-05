/* ============================================================
   THE DROWNED LANDS — Calendrier custom v9.1
   tdl-calendar.js
   ============================================================ */

(function () {
  'use strict';

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
     PARSING DU HTML FA — trois structures possibles :
     1. Anniversaire     : .title-overview présent
     2. Événement global : .calendar_overview_event / .header_overview_event
     3. Sujet lié        : <strong>Sujets liés:</strong>
  ---------------------------------------------------------- */
  function parseOvHtml(html) {
    if (!html) return null;
    var tmp = document.createElement('div');
    tmp.innerHTML = html;

    /* --- Anniversaire --- */
    if (tmp.querySelector('.title-overview')) {
      var nameEl = tmp.querySelector('.usr_grp_clr strong, strong');
      var imgEl  = tmp.querySelector('img');
      var full   = tmp.textContent || '';
      var ageM   = full.match(/Age\s*[:\-]?\s*(\d+)/i);
      return {
        type   : 'anniv',
        name   : nameEl ? nameEl.textContent.trim() : '',
        avatar : imgEl  ? imgEl.getAttribute('src') : '',
        age    : ageM   ? ageM[1] : ''
      };
    }

    /* --- Sujet lié : contient "Sujets liés" --- */
    var fullText = tmp.textContent || '';
    if (fullText.indexOf('Sujets li') >= 0) {
      /* Titre : texte après "Sujets liés:" */
      var titleNode = tmp.querySelector('.title-overview, p.title-overview, p');
      /* Chercher dans tout le texte */
      var raw   = tmp.innerHTML;
      /* Extraire le titre du topic — souvent dans un <a> ou après le label */
      var aEl   = tmp.querySelector('a');
      var topicTitle = aEl ? aEl.textContent.trim() : '';
      /* Date */
      var dateEl = tmp.querySelector('i');
      var date   = dateEl ? dateEl.textContent.trim() : '';
      /* Auteur */
      var authorMatch = fullText.match(/Auteur\s*[:\-]?\s*([^\n<]+)/i);
      var author = authorMatch ? authorMatch[1].trim() : '';
      return {
        type   : 'topic',
        title  : topicTitle,
        date   : date,
        author : author
      };
    }

    /* --- Événement standard --- */
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
     CONSTRUCTION DU HTML DE TOOLTIP
  ---------------------------------------------------------- */
  function buildTipHtml(data, fallbackTitle) {
    if (!data) {
      return '<div class="tt-title">' + esc(fallbackTitle) + '</div>';
    }

    if (data.type === 'anniv') {
      return (
        '<div class="tt-anniv-wrap">' +
          (data.avatar
            ? '<img src="' + data.avatar + '" class="tt-avatar" alt="' + esc(data.name) + '" />'
            : '<div class="tt-avatar-placeholder"></div>') +
          '<div class="tt-anniv-info">' +
            '<div class="tt-anniv-tag">Anniversaire</div>' +
            '<div class="tt-name">' + esc(data.name) + '</div>' +
            (data.age ? '<div class="tt-age">' + esc(data.age) + ' ans</div>' : '') +
          '</div>' +
        '</div>'
      );
    }

    if (data.type === 'topic') {
      return (
        '<div class="tt-ev-title">' + esc(data.title || fallbackTitle) + '</div>' +
        '<div class="tt-ev-type">Sujet lié</div>' +
        (data.date   ? '<div class="tt-date">' + esc(data.date) + '</div>'   : '') +
        (data.author ? '<div class="tt-author">par ' + esc(data.author) + '</div>' : '')
      );
    }

    /* event */
    return (
      '<div class="tt-ev-title">' + esc(data.title || fallbackTitle) + '</div>' +
      (data.cat  ? '<div class="tt-ev-type">' + esc(data.cat) + '</div>'  : '') +
      (data.date ? '<div class="tt-date">' + esc(data.date) + '</div>'    : '') +
      ((data.img || data.desc)
        ? '<div class="tt-body">' +
            (data.img  ? '<img src="' + data.img + '" class="tt-evimg" alt="" />' : '') +
            (data.desc ? '<div class="tt-desc">' + esc(data.desc) + '</div>' : '') +
          '</div>'
        : '')
    );
  }

  /* Échappement HTML basique */
  function esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ----------------------------------------------------------
     COULEUR DE PASTILLE
  ---------------------------------------------------------- */
  function resolveDotClass(faClass, ovData) {
    if (ovData && ovData.type === 'anniv')  return 'dot-anniv';
    if (ovData && ovData.type === 'topic')  return 'dot-rp';
    if (!faClass) return 'dot-other';
    var c = faClass.toLowerCase();
    if (c.indexOf('birthday') >= 0 || c.indexOf('anniv') >= 0) return 'dot-anniv';
    if (c.indexOf('global')   >= 0) return 'dot-global';
    if (c.indexOf('fete')     >= 0) return 'dot-fete';
    if (c.indexOf('genmed')   >= 0) return 'dot-rp';
    return 'dot-other';
  }

  /* ----------------------------------------------------------
     EXTRACTION DU NUMÉRO DE JOUR
     FA génère "Lun 01 Juin 2026" ou "Dim 7 Juin 2026"
     On veut uniquement "01" ou "07"
  ---------------------------------------------------------- */
  function extractDayNum(dateRaw) {
    /* Chercher 1 ou 2 chiffres isolés (pas partie de l'année 4 chiffres) */
    var m = dateRaw.match(/\b(\d{1,2})\b/);
    if (!m) return '';
    var n = parseInt(m[1], 10);
    /* Sanity check : jour valide 1-31 */
    if (n < 1 || n > 31) return '';
    return n < 10 ? '0' + n : '' + n;
  }

  /* ----------------------------------------------------------
     CONSTRUCTION DE LA GRILLE
  ---------------------------------------------------------- */
  function buildCalendar() {
    var src = document.getElementById('tdl-fa-source');
    var dst = document.getElementById('tdl-calendar');
    if (!src || !dst) return;

    /* Noms des jours */
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
        var dc      = resolveDotClass(faClass, ovData);
        var tipHtml = buildTipHtml(ovData, title);

        var ttCls = 'tdl-tt' + (isEdge ? ' tdl-tt-edge' : '');
        var arCls = 'tdl-tt-arrow' + (isEdge ? ' tdl-tt-arrow-edge' : '');

        dotsHtml +=
          '<div class="tdl-ev-wrap">' +
            '<a href="' + href + '" class="tdl-dot ' + dc + '" aria-label="' + esc(title) + '"></a>' +
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
        '<div class="tdl-leg"><div class="tdl-leg-dot dot-rp"></div>Événement RP</div>' +
        '<div class="tdl-leg"><div class="tdl-leg-dot dot-fete"></div>Fête locale</div>' +
        '<div class="tdl-leg"><div class="tdl-leg-dot dot-global"></div>Événement staff</div>' +
        '<div class="tdl-leg"><div class="tdl-leg-dot dot-other"></div>Autre</div>' +
      '</div>';

    dst.innerHTML = html;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildCalendar);
  } else {
    buildCalendar();
  }

})();
