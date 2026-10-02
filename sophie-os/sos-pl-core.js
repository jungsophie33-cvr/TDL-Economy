/* ============================================================================
   TDL — PRÉ-LIENS : SOCLE COMMUN
   Fichier : tdlpl-core.js
   ----------------------------------------------------------------------------
   Regroupe tout ce que tdlpl-arbre.js et sos-pl-fiches.js partagent :
   configuration, utilitaires de texte, calcul d'âge, libellés de statut,
   et surtout l'accès au bottin des faceclaims.

   La lecture Firebase passe par EcoCore.firebaseGet (API REST), et non par le
   SDK : eco-core ne charge le SDK que pour les membres authentifiés, alors
   que les posts de pré-liens doivent fonctionner pour les invités.

   La requête est mutualisée : une seule lecture du nœud par page, même si
   l'arbre et les fiches sont dans le même sujet.

   ORDRE DE CHARGEMENT :  eco-core-v1-5.js  →  tdlpl-core.js  →  les deux autres
   ========================================================================== */

(function () {
  "use strict";
  if (window.TDLPL) return;

  /* ------------------------------------------------------------------ CONFIG */

  var CFG = {
    // Corps d'un message sur TDL.
    selecteurPost: '.sj-post-msg > div',
    // Contenus injectés par d'autres scripts, à retirer avant l'analyse.
    aIgnorer: '.post-wordcount',
    // null = année réelle. Une année fixe fige le calendrier RP.
    anneeRef: null,
    // Statut d'une personne absente du bottin et sans statut écrit.
    statutDefaut: 'pnj',
    cheminFB: 'faceclaims',
    // Attente maximale d'EcoCore : 60 × 150 ms = 9 secondes.
    essaisMax: 60
  };

  function annee() { return CFG.anneeRef || new Date().getFullYear(); }

  /* ------------------------------------------------------------- UTILITAIRES */

  function slug(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function echappe(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Fabrique une fonction d'avertissement préfixée. */
  function journal(prefixe) {
    return function (msg) {
      if (window.console) console.warn('[TDLPL ' + prefixe + '] ' + msg);
    };
  }
  var jrn = journal('core');

  /* Convertit le HTML d'un message FA en texte brut.
     Clone d'abord : on ne touche jamais au DOM réel. */
  function texteBrut(el) {
    var copie = el.cloneNode(true);
    if (CFG.aIgnorer) {
      Array.prototype.forEach.call(copie.querySelectorAll(CFG.aIgnorer), function (n) {
        n.parentNode.removeChild(n);
      });
    }
    var h = copie.innerHTML
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    var ta = document.createElement('textarea');
    ta.innerHTML = h;
    return ta.value.replace(/\u00a0/g, ' ');
  }

  /* { an, age, mort } — accepte 1973, 26/10/1970, 1919-1998. */
  function calculeAge(brut) {
    var v = String(brut || '').trim(), m;

    m = v.match(/^(\d{4})\s*[-–—]\s*(\d{4})$/);
    if (m) {
      var duree = +m[2] - +m[1];
      return { an: +m[1], mort: +m[2], age: duree > 0 ? duree : null };
    }
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      var d = new Date(), a = d.getFullYear() - +m[3];
      if (d.getMonth() + 1 < +m[2] || (d.getMonth() + 1 === +m[2] && d.getDate() < +m[1])) a--;
      return { an: +m[3], age: a, mort: null };
    }
    m = v.match(/^(\d{4})$/);
    if (m) return { an: +m[1], age: annee() - +m[1], mort: null };

    return null;
  }

  function texteDates(d) {
    if (!d) return '';
    if (d.mort) return d.an + ' — ' + d.mort + (d.age ? ' · ' + d.age + ' ans' : '');
    return d.an + ' · ' + d.age + ' ans';
  }

  /* ------------------------------------------------------------- STATUTS */

  function litStatut(t) {
    var v = slug(t);
    if (v === 'libre') return 'libre';
    if (v === 'pris' || v === 'prise') return 'pris';
    if (v === 'reserve' || v === 'reservee') return 'reserve';
    if (v === 'pnj') return 'pnj';
    if (v === 'dcd' || v === 'decede' || v === 'decedee' || v === 'mort') return 'dcd';
    return null;
  }

  // [masculin, féminin]
  var LIB = {
    libre: ['libre', 'libre'],
    pris: ['pris', 'prise'],
    reserve: ['réservé', 'réservée'],
    pnj: ['pnj', 'pnj'],
    dcd: ['décédé', 'décédée']
  };

  /* Accord sur le sexe quand il est connu, masculin par défaut. */
  function libelle(statut, sexe) {
    var l = LIB[statut];
    if (!l) return statut || '';
    return String(sexe || '').toUpperCase() === 'F' ? l[1] : l[0];
  }

  var STATUTS = ['libre', 'reserve', 'pris', 'pnj', 'dcd'];

  /* ------------------------------------------------------------- FACECLAIMS */

  function indexeFaceclaims(fc) {
    var idx = { cles: {}, noms: {}, acteurs: {} };
    Object.keys(fc || {}).forEach(function (k) {
      var e = fc[k];
      if (!e || typeof e !== 'object') return;
      idx.cles[k] = e;
      if (e.acteur) idx.acteurs[slug(e.acteur)] = e;
      // Le pseudo désigne le personnage joué quand le FC est pris ; sinon il
      // désigne le créateur du pré-lien, et c'est nom_prelien qui porte le
      // nom du personnage.
      var nom = String(e.statut || '').toLowerCase() === 'pris' ? e.pseudo : e.nom_prelien;
      if (nom) idx.noms[slug(nom)] = e;
    });
    return idx;
  }

  /* Recherche en trois passes : clé du bottin, nom d'acteur, nom de personnage. */
  function trouve(idx, fc, nom) {
    if (!idx) return null;
    if (fc) {
      var s = slug(fc);
      var e = idx.cles[s] || idx.acteurs[s];
      if (e) return e;
    }
    return nom ? (idx.noms[slug(nom)] || null) : null;
  }

  /* ------------------------------------------------------- ACCÈS À LA BASE */

  function attendEcoCore(cb, essai) {
    essai = essai || 0;
    if (window.EcoCore && typeof window.EcoCore.firebaseGet === 'function') { cb(true); return; }
    if (essai >= CFG.essaisMax) {
      jrn('EcoCore introuvable après ' + Math.round(CFG.essaisMax * 0.15) +
          ' s — est-il déclaré AVANT les scripts de pré-liens ?');
      cb(false);
      return;
    }
    setTimeout(function () { attendEcoCore(cb, essai + 1); }, 150);
  }

  var _lecture = null;   // promesse partagée : une seule requête par page

  function litFaceclaims() {
    if (_lecture) return _lecture;
    _lecture = new Promise(function (resoudre) {
      attendEcoCore(function (pret) {
        if (!pret) { resoudre(null); return; }
        // firebaseGet attend _authPromise, déjà résolue chez un invité : la
        // requête part alors sans paramètre auth, ce que les règles permettent.
        window.EcoCore.firebaseGet(CFG.cheminFB)
          .then(function (val) {
            val = val || {};
            if (!Object.keys(val).length) jrn('nœud « ' + CFG.cheminFB + ' » vide ou illisible');
            resoudre(val);
          })
          .catch(function (e) {
            jrn('lecture de « ' + CFG.cheminFB + ' » refusée : ' + e.message);
            resoudre(null);
          });
      });
    });
    return _lecture;
  }

  var _index = null;

  /* Rend l'index du bottin, ou null si la base est injoignable.
     L'index n'est construit qu'une fois, quel que soit le nombre d'appelants. */
  function litIndex(cb) {
    litFaceclaims().then(function (fc) {
      if (!fc) { cb(null); return; }
      if (!_index) _index = indexeFaceclaims(fc);
      cb(_index);
    });
  }

  /* ----------------------------------------------------------- AMORÇAGE DOM */

  /* Messages contenant le marqueur, hors ceux déjà transformés. */
  function postsAvec(marqueur, selDejaRendu) {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll(CFG.selecteurPost), function (el) {
      if (selDejaRendu && el.querySelector(selDejaRendu)) return;
      if (el.textContent.indexOf(marqueur) < 0) return;
      out.push(el);
    });
    return out;
  }

  function pret(fn) {
    if (document.readyState === 'complete') fn();
    else window.addEventListener('load', fn);
  }

  /* ----------------------------------------------------------- DIAGNOSTIC */

  function diagnostic() {
    var C = window.console;
    C.log('--- TDLPL diagnostic ---');
    C.log('EcoCore présent :', !!(window.EcoCore && window.EcoCore.firebaseGet));
    C.log('visiteur        :', (window._userdata && _userdata.username) || 'invité');
    C.log('SDK Firebase    :', window.firebase ? 'chargé (membre)' : 'absent (normal en invité)');
    C.log('posts arbre     :', postsAvec('=== ARBRE:').length);
    C.log('posts fiches    :', postsAvec('=== PRELIENS:').length);
    litIndex(function (idx) {
      if (!idx) { C.log('→ aucune donnée reçue du bottin'); return; }
      C.log('clés du bottin  :', Object.keys(idx.cles).length);
      C.log('noms indexés    :', Object.keys(idx.noms).length);
    });
  }

  /* -------------------------------------------------------------- EXPORT */

  window.TDLPL = {
    CFG: CFG,
    annee: annee,
    slug: slug,
    echappe: echappe,
    journal: journal,
    texteBrut: texteBrut,
    calculeAge: calculeAge,
    texteDates: texteDates,
    litStatut: litStatut,
    libelle: libelle,
    STATUTS: STATUTS,
    indexeFaceclaims: indexeFaceclaims,
    trouve: trouve,
    litFaceclaims: litFaceclaims,
    litIndex: litIndex,
    postsAvec: postsAvec,
    pret: pret,
    diagnostic: diagnostic
  };
})();
