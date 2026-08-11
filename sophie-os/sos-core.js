/* =============================================================
   SOS — Sophia OS · NOYAU (sos-core.js)
   -------------------------------------------------------------
   Rôle unique : transformer des posts ForumActif en enregistrements
   structurés. Le noyau ne connaît NI « annexes » NI le sens des
   blocs — il livre des données, le rendu (sos-annexe.js) s'en occupe.

   Sortie d'un post parsé :
     { meta:   { communaute, couleur, onglet:{num,libelle}, brut:{} },
       panneaux: [ { id, blocs: [ Bloc ] } ] }
     Bloc = { type, champs:{CLE:[lignes]}, entrees:[{cle,lignes}] }

   Voir « Contrat de format tdl-data » §9 pour la spécification.
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = {};

  /* ---------------------------------------------------------
     1. UTILITAIRES génériques (réutilisés par le rendu)
     --------------------------------------------------------- */
  var util = {
    // "a | b | c"  ->  ['a','b','c']
    pipe: function (s) {
      return String(s == null ? '' : s).split('|').map(function (x) { return x.trim(); });
    },
    // retire toute balise HTML (pour un champ NU)
    sansBalises: function (s) {
      return String(s == null ? '' : s).replace(/<[^>]*>/g, '').trim();
    },
    // lignes -> texte nu (une seule chaîne, sans balise)
    nu: function (lignes) {
      return util.sansBalises((lignes || []).join(' '));
    },
    // lignes -> paragraphes <p> (champ RICHE : balises inline conservées)
    paragraphes: function (lignes) {
      return (lignes || [])
        .map(function (l) { return l.trim(); })
        .filter(Boolean)
        .map(function (l) { return '<p>' + l + '</p>'; })
        .join('');
    }
  };
  SOS.util = util;

  /* ---------------------------------------------------------
     2. NORMALISATION ForumActif
     FA peut convertir les retours à la ligne en <br>, ou envelopper
     des lignes en <p>. On ramène tout à des \n pour un parsing fiable
     par lignes. Les balises INLINE de prose (<f4>, <i>, <tw>…) sont
     conservées telles quelles.
     --------------------------------------------------------- */
  function normaliser(html) {
    return String(html == null ? '' : html)
      .replace(/\r\n?/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/&nbsp;/gi, '\u00a0');
  }
  SOS.normaliser = normaliser;

  /* ---------------------------------------------------------
     3. PARSEUR : texte délimité -> enregistrement structuré
     --------------------------------------------------------- */
  var reP   = /^===\s*PANNEAU:\s*(.+?)\s*===\s*$/;
  var reFin = /^===\s*FIN\s*===\s*$/;
  var reB   = /^---\s*BLOC\s+([\w-]+)\s*---\s*$/;
  var reCle = /^([A-Z_]+):\s?(.*)$/;

  function interpMeta(m) {
    var out = { brut: m };
    if (m.COMMUNAUTE) { out.communaute = m.COMMUNAUTE.trim(); }
    if (m.COULEUR)    { out.couleur    = m.COULEUR.trim(); }
    if (m.ONGLET) {
      var p = util.pipe(m.ONGLET);
      out.onglet = { num: p[0] || '', libelle: p.slice(1).join(' | ') };
    }
    return out;
  }

  function parser(texte) {
    var lignes = normaliser(texte).split('\n');
    var meta = {}, panneaux = [];
    var panneau = null, bloc = null, champ = null, panneauVu = false;

    for (var i = 0; i < lignes.length; i++) {
      var ligne = lignes[i].replace(/\s+$/, ''); // rstrip
      var m;

      if (reFin.test(ligne)) { bloc = null; champ = null; continue; }

      if ((m = ligne.match(reP))) {
        panneau = { id: m[1].trim(), blocs: [] };
        panneaux.push(panneau);
        panneauVu = true; bloc = null; champ = null;
        continue;
      }

      if ((m = ligne.match(reB))) {
        if (!panneau) { panneau = { id: '_racine', blocs: [] }; panneaux.push(panneau); panneauVu = true; }
        bloc = { type: m[1], champs: {}, entrees: [] };
        panneau.blocs.push(bloc);
        champ = null;
        continue;
      }

      if ((m = ligne.match(reCle))) {
        var cle = m[1], reste = m[2];
        if (bloc) {
          var entree = { cle: cle, lignes: [] };
          if (reste.trim() !== '') { entree.lignes.push(reste); }
          bloc.entrees.push(entree);
          if (!(cle in bloc.champs)) { bloc.champs[cle] = entree.lignes; } // 1re occurrence
          champ = entree;
        } else if (!panneauVu) {
          meta[cle] = reste.trim();  // métadonnées (avant tout panneau)
          champ = null;
        }
        // clé hors bloc et après un panneau : ignorée
        continue;
      }

      // ligne de continuation (valeur multi-ligne) — lignes vides ignorées
      if (champ && ligne.trim() !== '') { champ.lignes.push(ligne); }
    }

    return { meta: interpMeta(meta), panneaux: panneaux };
  }
  SOS.parser = parser;

  /* ---------------------------------------------------------
     4. HELPERS de lecture (pour le rendu)
     --------------------------------------------------------- */
  // lignes de la 1re occurrence d'un champ dans un bloc
  SOS.champ = function (bloc, cle) {
    return (bloc && bloc.champs[cle]) ? bloc.champs[cle] : [];
  };

  // groupe les entrées répétables d'un bloc (ITEM, COLONNE…)
  // -> [ { ouverture:[lignes], champs:{CLE:[lignes]} } ]
  SOS.grouper = function (bloc, ouverture) {
    var groupes = [], cur = null;
    (bloc && bloc.entrees || []).forEach(function (e) {
      if (e.cle === ouverture) {
        cur = { ouverture: e.lignes.slice(), champs: {} };
        groupes.push(cur);
      } else if (cur && !(e.cle in cur.champs)) {
        cur.champs[e.cle] = e.lignes.slice();
      }
    });
    return groupes;
  };

  /* ---------------------------------------------------------
     5. SOURCES : localiser les blocs tdl-data
     --------------------------------------------------------- */
  // innerHTML conserve les balises inline de prose ; on parse ensuite.
  function lireSources(doc) {
    var els = (doc || document).querySelectorAll('.tdl-data');
    var out = [];
    Array.prototype.forEach.call(els, function (el) {
      out.push({ texte: el.innerHTML, el: el });
    });
    return out;
  }
  SOS.lireSources = lireSources;

  /* ---------------------------------------------------------
     6. PAGINATION : pages suivantes du sujet (fetch same-origin)
     Utile seulement si les posts-annexes débordent de la page 1.
     Détection best-effort : à ajuster au besoin selon l'instance FA.
     --------------------------------------------------------- */
  function detecterPages() {
    var sel = '.pagination a, .paging a, a.pag, span.pagination a, .pages a, #pagination a';
    var vus = {}, urls = [];
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (a) {
      var href = a.href;
      if (!href) { return; }
      try {
        var u = new URL(href, location.href);
        if (u.origin !== location.origin) { return; }
        if (u.href === location.href) { return; }
        if (vus[u.href]) { return; }
        vus[u.href] = 1; urls.push(u.href);
      } catch (e) { /* lien ignoré */ }
    });
    return urls;
  }
  SOS.detecterPages = detecterPages;

  function fetchTexte(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.text();
    });
  }

  /* ---------------------------------------------------------
     7. CHARGER : orchestration (DOM + pages) -> enregistrements
     --------------------------------------------------------- */
  function parserSources(textes) {
    var out = [];
    textes.forEach(function (t) {
      try { out.push(parser(t)); }
      catch (e) { console.warn('SOS: source ignorée', e); }
    });
    return out;
  }
  SOS.parserSources = parserSources;

  SOS.charger = function (opts) {
    opts = opts || {};
    var textes = lireSources(document).map(function (s) { return s.texte; });
    var urls = opts.urls || (opts.autoPages ? detecterPages() : []);

    if (!urls.length) {
      SOS.annexes = parserSources(textes);
      return Promise.resolve(SOS.annexes);
    }

    var jobs = urls.map(function (u) {
      return fetchTexte(u).then(function (html) {
        var d = new DOMParser().parseFromString(html, 'text/html');
        lireSources(d).forEach(function (s) { textes.push(s.texte); });
      }).catch(function (e) { console.warn('SOS: page non chargée', u, e); });
    });

    return Promise.all(jobs).then(function () {
      SOS.annexes = parserSources(textes);
      return SOS.annexes;
    });
  };

  /* ---------------------------------------------------------
     8. INITIALISATION (timing FA : window.load + filet readyState)
     Parse le DOM courant tout de suite (sync), expose SOS.annexes,
     et émet l'évènement « sos:pret » que le rendu peut écouter.
     Pour la pagination, le rendu appellera SOS.charger({autoPages:true}).
     --------------------------------------------------------- */
  function auChargement(cb) {
    var fait = false;
    function go() { if (fait) { return; } fait = true; cb(); }
    if (document.readyState === 'complete') { return go(); }
    global.addEventListener('load', go);
    var n = 0, t = setInterval(function () {
      if (document.readyState === 'complete' || n++ > 60) { clearInterval(t); go(); }
    }, 100);
  }

  SOS.annexes = [];

  auChargement(function () {
    try {
      SOS.annexes = parserSources(lireSources(document).map(function (s) { return s.texte; }));
    } catch (e) {
      console.warn('SOS: échec init', e);
      SOS.annexes = [];
    }
    try {
      global.dispatchEvent(new CustomEvent('sos:pret', { detail: { annexes: SOS.annexes } }));
    } catch (e) { /* CustomEvent indisponible : ignorer */ }
  });

  global.SOS = SOS;

})(window);
