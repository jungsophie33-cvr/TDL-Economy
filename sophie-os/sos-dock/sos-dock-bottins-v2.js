/* =============================================================
   SOS — DOCK DES BOTTINS (dock-bottins.js)
   -------------------------------------------------------------
   Le dock vertical des bottins (faceclaims, registre, métiers…),
   collé au bord gauche de la page. Effet loupe au survol, à la
   manière des docks d'OS, mesuré sur les centres réels des items
   — jamais sur leur index : ajouter ou retirer une entrée ne
   casse rien.

   RÈGLES (alignées sur les autres scripts du dossier) :
     • DÉSACTIVÉ sur tactile (téléphones ET tablettes) et sur
       petit écran : aucun nœud monté, aucun écouteur posé. La
       feuille CSS masque le conteneur de son côté, la garde JS
       ne fait qu'éviter de travailler pour rien.
     • Montage différé : le script attend son conteneur (filet
       readyState + sondage court), quel que soit l'endroit du
       document où ForumActif l'injecte.
     • L'animation est lissée par requestAnimationFrame et ne
       démarre pas du tout si prefers-reduced-motion est demandé.
     • Le HTML de config est échappé, comme partout ailleurs.

   Dépendances :
     - dock-bottins.css
     - Feuille Flaticon Solid Rounded (classes fi-sr-*)
   ============================================================= */
(function (global) {
  'use strict';

  /* ===================== CONFIG — à éditer à la main =====================
     Pour AJOUTER un bottin : copie une ligne { … } et complète.
     L'ordre du tableau = l'ordre du dock, de haut en bas.
     'id' doit correspondre au data-page="…" posé sur le conteneur
     par la page courante pour marquer le bottin actif. */
  var CFG = {
    sel: '#dock-bottin',
    items: [
      { id: 'faceclaim',  titre: 'Bottin des Faceclaims',   icone: 'theater-masks',  url: '/t101-01-le-bottin-des-faceclaims' },
      { id: 'registre',   titre: 'Registre paroissial',     icone: 'address-book',   url: '/t100-05-le-registre-paroissial' },
      { id: 'metiers',    titre: 'Répertoire des métiers',  icone: 'briefcase',      url: '/t98-02-le-repertoire-des-metiers' },
      { id: 'cadastre',   titre: 'Cadastre de Terrebonne',  icone: 'house-chimney', url: '/t99-04-la-cadastre-de-terrebonne' },
      { id: 'lieux',      titre: 'Répertoire des lieux',    icone: 'marker',        url: '/t87-03-le-repertoire-des-lieux' },
      { id: 'horslaloi',  titre: 'Annuaire des hors-la-loi', icone: 'mask-carnival', url: '/t97-06-l-annuaire-des-hors-la-loi' }
    ],
    /* Effet loupe : rayon d'influence en px, échelle maximale du
       voisin le plus proche, élévation en px. */
    options: { rayon: 90, echelleMax: 1.45, eleve: 6 },
    attenteMs: 100,
    essaisMax: 100          /* 10 s avant de renoncer, en silence */
  };

  /* ===================== OUTILS ===================== */
  function tactile() {
    return !!(global.matchMedia && (
      global.matchMedia('(pointer: coarse)').matches ||
      global.matchMedia('(hover: none)').matches
    ));
  }
  function etroit() {
    return !!(global.matchMedia && global.matchMedia('(max-width: 720px)').matches);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&(?![a-z#0-9]+;)/gi, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ===================== CONSTRUCTION ===================== */
  function construire(conteneur) {
    var courant = (conteneur.getAttribute('data-page') || '').trim();
    var html = '<nav class="bot-dock" aria-label="Accès aux bottins">';
    CFG.items.forEach(function (it) {
      html += '<a class="item' + (it.id === courant ? ' active' : '') + '"'
        + ' href="' + esc(it.url) + '"'
        + ' aria-label="' + esc(it.titre) + '">'
        + '<span class="icon"><i class="fi-sr-' + esc(it.icone) + '" aria-hidden="true"></i></span>'
        + '<span class="tooltip">' + esc(it.titre) + '</span>'
        + '</a>';
    });
    conteneur.innerHTML = html + '</nav>';
  }

  /* ===================== ANIMATION ===================== */
  function animer(conteneur) {
    var dock = conteneur.querySelector('.bot-dock');
    if (!dock) { return; }

    var items = Array.prototype.slice.call(dock.querySelectorAll('.item'));
    if (!items.length) { return; }

    /* Icônes mises en cache : le mousemove ne refait jamais de querySelector. */
    var icones = items.map(function (it) { return it.querySelector('.icon'); });
    var centres = [];

    function mesurer() {
      centres = items.map(function (it) {
        var r = it.getBoundingClientRect();
        return r.top + r.height / 2;
      });
    }

    /* Animation refusée : on ne pose AUCUN écouteur de pointeur.
       Le dock reste pleinement utilisable, simplement sans effet. */
    var doux = !!(global.matchMedia && !global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!doux) { return; }

    var attente = false;
    function poser(e) {
      if (attente) { return; }
      attente = true;
      requestAnimationFrame(function () {
        attente = false;
        items.forEach(function (it, i) {
          var d = Math.abs(e.clientY - centres[i]);
          var t = Math.max(0, 1 - d / CFG.options.rayon);
          var echelle = 1 + (CFG.options.echelleMax - 1) * (t * t);
          var eleve = CFG.options.eleve * t;
          icones[i].style.transform =
            'translateY(' + (-eleve) + 'px) scale(' + echelle + ')';
        });
      });
    }
    function reposer() {
      icones.forEach(function (ic) { ic.style.transform = ''; });
    }

    /* Les centres sont relevés au survol (le dock a pu bouger depuis
       le montage : scroll, bannière qui se replie…) et au
       redimensionnement. Coût : six getBoundingClientRect par mesure. */
    dock.addEventListener('mouseenter', mesurer);
    dock.addEventListener('mousemove', poser);
    dock.addEventListener('mouseleave', reposer);
    global.addEventListener('resize', function () {
      if (conteneur.isConnected) { mesurer(); }
    });
  }

  /* ===================== MONTAGE ===================== */
  function monter() {
    if (tactile() || etroit()) { return true; }   /* pas de dock ici : on n'insiste pas */
    var cibles = document.querySelectorAll(CFG.sel);
    if (!cibles.length) { return false; }         /* conteneur pas encore là : on réessaie */
    Array.prototype.forEach.call(cibles, function (c) {
      construire(c);
      animer(c);
    });
    return true;
  }

  function demarrer(n) {
    n = n || 0;
    if (monter()) { return; }
    if (n > CFG.essaisMax) {
      if (global.console) {
        console.warn('[Dock bottins] conteneur #' + CFG.sel.replace('#', '') + ' introuvable.');
      }
      return;
    }
    setTimeout(function () { demarrer(n + 1); }, CFG.attenteMs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { demarrer(); });
  } else { demarrer(); }

  /* API debug, dans l'esprit des autres modules (relancer après un
     montage dynamique du conteneur : aperçu, édition, AJAX FA…). */
  global.DockBottins = { relancer: monter };

})(window);
