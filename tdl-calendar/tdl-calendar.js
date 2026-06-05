/* ============================================================
   THE DROWNED LANDS — Calendrier custom
   Fichier   : tdl-calendar.js
   Hébergement : GitHub + jsDelivr
   Appelé depuis : template _calendar_box (bas de page)

   Fonctionnement :
   1. Lit la table FA masquée (#tdl-fa-source)
   2. Parse chaque cellule : date, événements, données tooltip
   3. Reconstruit une grille CSS Grid dans #tdl-calendar
   4. Gère les tooltips en CSS pur (:hover sur .tdl-ev-wrap)
   5. Détermine la couleur de chaque pastille via le HTML
      encodé dans l'attribut onmouseover (données FA)
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     EXTRACTION DU HTML D'INFOBULLE FA
     FA génère : onmouseover="createTitle(this, '...HTML...', event.pageX, event.pageY);"
     On extrait le HTML encodé entre les guillemets simples.
  ---------------------------------------------------------- */
  function extractOvHtml(anchor) {
    var ov = anchor.getAttribute('onmouseover') || '';
    var m = ov.match(/createTitle\s*\(\s*this\s*,\s*'([\s\S]+?)'\s*,\s*event/);
    if (!m) return null;
    return m[1].replace(/\\'/g, "'");
  }

  /* ----------------------------------------------------------
     PARSING DU HTML FA — retourne un objet structuré
     Deux structures possibles selon le type d'événement :
       - Anniversaire : .title-overview présent
       - Événement standard : .calendar_overview_event
  ---------------------------------------------------------- */
  function parseOvHtml(html) {
    if (!html) return null;
    var tmp = document.createElement('div');
    tmp.innerHTML = html;

    var isAnniv = !!tmp.querySelector('.title-overview');

    if (isAnniv) {
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

    var titleEl = tmp.querySelector('.header_overview_event span:first-child');
    var catEl   = tmp.querySelector('[class*="EV_TagCategory"]');
    var dateEl  = tmp.querySelector('p i');
    var descEl  = tmp.querySelector('.desc_overview_event p');
    var imgEvEl = tmp.querySelector('.img_overview_event img');
    return {
      type  : 'event',
      title : titleEl ? titleEl.textContent.trim() : '',
      cat   : catEl   ? catEl.textContent.trim()   : '',
      date  : dateEl  ? dateEl.textContent.trim()  : '',
      desc  : descEl  ? descEl.textContent.trim()  : '',
      img   : imgEvEl ? imgEvEl.getAttribute('src'): ''
    };
  }

  /* ----------------------------------------------------------
     CONSTRUCTION DU HTML DE TOOLTIP
  ---------------------------------------------------------- */
  function buildTipHtml(data, fallbackTitle) {
    if (!data) {
      return '<div class="tt-title">' + fallbackTitle + '</div>';
    }

    if (data.type === 'anniv') {
      return (
        '<div class="tt-header">' +
          '<span class="tt-tag tt-anniv">Anniversaire</span>' +
        '</div>' +
        '<div class="tt-body-anniv">' +
          (data.avatar
            ? '<img src="' + data.avatar + '" class="tt-avatar" alt="' + data.name + '" />'
            : '') +
          '<div class="tt-info">' +
            '<div class="tt-name">' + data.name + '</div>' +
            (data.age ? '<div class="tt-age">' + data.age + ' ans</div>' : '') +
          '</div>' +
        '</div>'
      );
    }

    return (
      '<div class="tt-header">' +
        '<span class="tt-title">' + (data.title || fallbackTitle) + '</span>' +
        (data.cat ? '<span class="tt-tag tt-cat">' + data.cat + '</span>' : '') +
      '</div>' +
      (data.date ? '<div class="tt-date">' + data.date + '</div>' : '') +
      ((data.img || data.desc)
        ? '<div class="tt-body">' +
            (data.img  ? '<img src="' + data.img + '" class="tt-evimg" alt="" />' : '') +
            (data.desc ? '<div class="tt-desc">' + data.desc + '</div>' : '') +
          '</div>'
        : '')
    );
  }

  /* ----------------------------------------------------------
     COULEUR DE LA PASTILLE
     Priorité : type parsé depuis onmouseover > classe FA > fallback
  ---------------------------------------------------------- */
  function resolveDotClass(faClass, ovData) {
    if (ovData && ovData.type === 'anniv') return 'dot-anniv';
    if (!faClass) return 'dot-other';
    var c = faClass.toLowerCase();
    if (c.indexOf('birthday') >= 0 || c.indexOf('anniv') >= 0) return 'dot-anniv';
    if (c.indexOf('global')   >= 0) return 'dot-global';
    if (c.indexOf('fete')     >= 0) return 'dot-fete';
    if (c.indexOf('genmed')   >= 0) return 'dot-rp';
    /* Fallback : tout ce qui a un href mais classe inconnue */
    return 'dot-other';
  }

  /* ----------------------------------------------------------
     CONSTRUCTION DE LA GRILLE
  ---------------------------------------------------------- */
  function buildCalendar() {
    var src = document.getElementById('tdl-fa-source');
    var dst = document.getElementById('tdl-calendar');
    if (!src || !dst) return;

    /* Noms des jours depuis <thead> */
    var ths  = src.querySelectorAll('thead th');
    var days = [];
    ths.forEach(function (th) { days.push(th.textContent.trim()); });

    /* Toutes les <td> dans l'ordre du DOM */
    var tds = src.querySelectorAll('tbody td');

    var html = '';

    /* --- En-tête jours --- */
    html += '<div class="tdl-cal-header">';
    days.forEach(function (d) {
      html += '<div class="tdl-cal-hcell">' + d + '</div>';
    });
    html += '</div>';

    /* --- Grille --- */
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

      /* Numéro du jour — extraire uniquement les chiffres */
      var dateRaw = td.getAttribute('data-date') || '';
      var nums    = dateRaw.replace(/[^\d]/g, '');
      /* FA encode "Lun 01 Juin 2026" → on prend les 2 premiers chiffres */
      var dayNum  = nums.slice(0, 2) || '';

      /* Événements de cette case */
      var anchors  = td.querySelectorAll('li[data-ev="1"] a');
      var dotsHtml = '';

      anchors.forEach(function (a) {
        var href      = a.getAttribute('href') || '#';
        var faClass   = (a.getAttribute('class') || '').trim();
        var title     = (a.getAttribute('data-title') || a.textContent || '').trim();
        var ovHtml    = extractOvHtml(a);
        var ovData    = parseOvHtml(ovHtml);
        var dc        = resolveDotClass(faClass, ovData);
        var tipHtml   = buildTipHtml(ovData, title);
        var edgeCls   = isEdge ? ' dot-edge' : '';
        var ttEdgeCls = isEdge ? ' tdl-tt-edge' : '';
        var arEdgeCls = isEdge ? ' tdl-tt-arrow-edge' : '';

        dotsHtml +=
          '<div class="tdl-ev-wrap">' +
            '<a href="' + href + '" class="tdl-dot ' + dc + edgeCls + '" aria-label="' + title + '"></a>' +
            '<div class="tdl-tt' + ttEdgeCls + '">' +
              '<div class="tdl-tt-inner">' + tipHtml + '</div>' +
              '<div class="tdl-tt-arrow' + arEdgeCls + '"></div>' +
            '</div>' +
          '</div>';
      });

      html +=
        '<div class="tdl-cal-cell">' +
          '<span class="tdl-day-num">' + dayNum + '</span>' +
          (dotsHtml ? '<div class="tdl-dots">' + dotsHtml + '</div>' : '') +
        '</div>';
    });

    html += '</div>'; /* /tdl-cal-grid */

    /* --- Légende --- */
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

  /* ----------------------------------------------------------
     INITIALISATION
     DOMContentLoaded si le DOM n'est pas encore prêt,
     sinon exécution immédiate.
  ---------------------------------------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildCalendar);
  } else {
    buildCalendar();
  }

})();
