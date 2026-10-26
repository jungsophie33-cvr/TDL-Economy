/* =============================================================
   SOS — Sophia OS · ENTÊTE PNJ / MJ D'ÉVENT (sos-bloc-pnj.js)
   -------------------------------------------------------------
   Le MJ écrit, en tête de son message de RP :

     === PNJ: Marcel Thibodeaux
     QUALITE: PNJ                    PNJ ou MJ D'EVENEMENT
     ROLE: adjoint du shérif
     AVATAR: https://…               (facultatif — image du PNJ)
     TEMPERAMENT: Franc, méfiant, protecteur, à l'humour sec.
     REPUTATION: Un bon flic. Brutal parfois, mais juste.
     PERCU: Certains le trouvent difficile et trop direct…
     === FIN

   L'entête REMPLACE ces lignes dans le message ; le reste du post
   (RP, inserts html, bbcode) reste en place, dessous, intact.
   Conventions des fiches de pré-liens : classe « annexe » posée à
   la création de la div du bloc (le profil ForumActif du posteur
   est masqué), clés insensibles à la casse et aux accents, valeur
   d'une clé sur plusieurs lignes acceptée (ligne de continuation).

   === FIN EST OBLIGATOIRE — unique exception à la règle commune
   de la charte : ce bloc vit dans un post qui CONTINUE après lui,
   et c'est FIN qui dit où s'arrêter. Sans FIN, rien n'est retiré :
   le message reste tel quel et la console explique pourquoi.

   « Joué par … » est rempli automatiquement : le pseudo est lu
   dans .sj-post-pseudo du post, par textContent — insensible au
   balisage interne (span, strong…).

   Aucune lecture Firebase : tout vient du message. Un post édité
   six mois plus tard raconte toujours la même chose.

   Feuille associée : CSS-pnj.css (sos-post/).
   ============================================================= */
(function (global) {
  'use strict';

  var MARQUEUR = /^===\s*PNJ\s*:\s*(.*?)\s*$/i;
  var RE_FIN   = /^===\s*FIN(?:\s*===)?\s*$/i;
  var RE_CLE   = /^([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9_]*)\s*:\s*(.*)$/i;

  /* PERÇU: se lit PERCU une fois les accents retirés. */
  var CLES = {
    QUALITE: 'QUALITE', ROLE: 'ROLE', AVATAR: 'AVATAR',
    TEMPERAMENT: 'TEMPERAMENT', REPUTATION: 'REPUTATION', PERCU: 'PERCU'
  };

  var RUBS = [
    ['TEMPERAMENT', 'fi-sr-star',  'Tempérament'],
    ['REPUTATION',  'fi-sr-users', 'Réputation'],
    ['PERCU',       'fi-sr-eye',   'Comment est-il perçu']
  ];

  function normaliseCle(s) {
    return String(s || '').toUpperCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function slug(s) {
    return String(s || '').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function sansBalises(s) {
    return String(s == null ? '' : s).replace(/<[^>]*>/g, '').trim();
  }

  function echappe(s) {
    return String(s == null ? '' : s)
      .replace(/&(?![a-z#0-9]+;)/gi, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var alerte = global.console
    ? function (m) { global.console.warn('[SOS pnj] ' + m); }
    : function () {};

  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ------------------------------------------------------- LE POST, EN LIGNES
     ForumActif rend chaque ligne écrite en clair comme un nœud
     texte séparé par des <br>. On ramène le corps du message à des
     LIGNES : une ligne = les nœuds entre deux <br>. Le textContent
     d'une ligne traverse les liens auto (une URL tapée en clair
     devient <a> : son texte reste l'URL, le format reste lisible). */
  function lignes(conteneur) {
    var out = [], cur = { noeuds: [], texte: '' };
    function pousser() {
      if (cur.noeuds.length) { out.push(cur); cur = { noeuds: [], texte: '' }; }
    }
    Array.prototype.forEach.call(conteneur.childNodes, function (n) {
      if (n.nodeType === 1 && n.tagName === 'BR') {
        pousser();
        out.push({ br: true, noeud: n });
        return;
      }
      cur.noeuds.push(n);
      cur.texte += (n.nodeType === 3 ? n.data : n.textContent);
    });
    pousser();
    return out;
  }

  /* Cherche le couple marqueur/FIN — la PAIRE COMPLÈTE, à un niveau
     donné, avant de descendre dans les enveloppes (p, div…) : un
     élément qui contient tout le bloc expose au niveau supérieur un
     texte collé sans ses <br> — un marqueur isolé y ressemblerait
     sans que FIN y soit visible. Rien n'est touché tant que la
     paire n'est pas trouvée. */
  function chercher(conteneur, profondeur, etat) {
    profondeur = profondeur || 0;
    etat = etat || { partiel: false };

    var r = niveau(conteneur, etat);
    if (r) return r;

    if (profondeur < 3) {
      for (var j = 0; j < conteneur.childNodes.length; j++) {
        var n = conteneur.childNodes[j];
        if (n.nodeType === 1 && n.tagName !== 'BR') {
          var s = chercher(n, profondeur + 1, etat);
          if (s) return s;
        }
      }
    }
    if (profondeur === 0 && etat.partiel) {
      alerte('=== FIN manquant : bloc PNJ non transformé, le message reste tel quel. ' +
             'Le bloc vit dans un post qui continue après lui — FIN est obligatoire.');
    }
    return null;
  }

  function niveau(conteneur, etat) {
    var ls = lignes(conteneur), i0 = -1, nom = '', i1 = -1;
    for (var i = 0; i < ls.length; i++) {
      var L = ls[i];
      if (!L || L.br) continue;
      var t = L.texte.trim();
      var m = t.match(MARQUEUR);
      if (m && i0 < 0) { i0 = i; nom = m[1]; continue; }
      if (RE_FIN.test(t) && i0 >= 0) { i1 = i; break; }
    }
    if (i0 < 0 || i1 < 0) {
      if (i0 >= 0) etat.partiel = true;    /* marqueur vu, FIN non */
      return null;
    }
    return { conteneur: conteneur, ls: ls, i0: i0, i1: i1, nom: nom };
  }

  /* --------------------------------------------------------------- ANALYSE */
  /* Clés dont la valeur peut filer sur plusieurs lignes (suite du
     texte à la ligne). Les autres (QUALITE, AVATAR) sont d'un seul
     tenant : une ligne parasite est signalée, jamais avalée. */
  var TEXTE_LONG = { ROLE: 1, TEMPERAMENT: 1, REPUTATION: 1, PERCU: 1 };

  function analyser(t) {
    var m = { nom: t.nom, QUALITE: '', ROLE: '', AVATAR: '',
              TEMPERAMENT: '', REPUTATION: '', PERCU: '' };
    var dernier = null;
    for (var i = t.i0 + 1; i < t.i1; i++) {
      var L = t.ls[i];
      if (!L || L.br) continue;
      var s = L.texte.trim();
      if (!s) continue;
      var mm = s.match(RE_CLE);
      if (mm) {
        var cle = CLES[normaliseCle(mm[1])];
        if (cle) {
          var val = cle === 'AVATAR' ? sansBalises(mm[2]) : mm[2].trim();
          m[cle] = m[cle] ? m[cle] + ' ' + val : val;
          dernier = cle;
          continue;
        }
        alerte('clé inconnue « ' + mm[1] + ' » ignorée dans le bloc PNJ.');
        dernier = null;
        continue;
      }
      if (dernier && TEXTE_LONG[dernier]) { m[dernier] += ' ' + s; continue; }
      alerte('ligne ignorée dans le bloc PNJ : « ' + s + ' »');
    }
    return m;
  }

  function litQualite(v) {
    var s = slug(v);
    if (s.indexOf('mj') === 0) return { mj: true, libelle: "MJ d'évent" };
    if (s === 'pnj' || !s)     return { mj: false, libelle: 'PNJ' };
    alerte('qualité inconnue « ' + v + ' » — affichée telle quelle (PNJ ou MJ D\'EVENEMENT attendu).');
    return { mj: false, libelle: v.toUpperCase() };
  }

  /* Le pseudo du posteur, par le premier ancêtre qui porte un
     .sj-post-pseudo : le post nous appartient. textContent, donc
     insensible au balisage interne. */
  function pseudoDuPosteur(noeud) {
    var p = noeud;
    while (p && p.nodeType === 1) {
      var n = p.querySelector('.sj-post-pseudo');
      if (n) return n.textContent.trim();
      p = p.parentNode;
    }
    return '';
  }

  /* ---------------------------------------------------------------- RENDU */
  function rendre(m) {
    var hero = h('div', 'tdlpnj-hero annexe' + (m.AVATAR ? '' : ' sans-av'));

    if (m.AVATAR) {
      var av = h('img', 'tdlpnj-av');
      av.src = sansBalises(m.AVATAR);
      av.alt = '';
      hero.appendChild(av);
    }

    var corps = h('div', 'tdlpnj-corps');
    corps.appendChild(h('h1', 'tdlpnj-nom', echappe(m.nom || 'PNJ')));

    var q = litQualite(m.QUALITE);
    var ligne2 = h('div', 'tdlpnj-ligne2');
    var gauche = h('p', 'tdlpnj-qualite');
    gauche.appendChild(h('span', 'tdlpnj-chip' + (q.mj ? ' mj' : ''), echappe(q.libelle)));
    if (m.ROLE) gauche.appendChild(h('span', 'tdlpnj-role', echappe(m.ROLE)));
    ligne2.appendChild(gauche);

    if (m.pseudo) {
      ligne2.appendChild(h('p', 'tdlpnj-joue',
        '<i class="fi fi-sr-user"></i>joué par <b>' + echappe(m.pseudo) + '</b>'));
    }
    corps.appendChild(ligne2);

    var nb = 0;
    var rubs = h('div', 'tdlpnj-rubriques');
    RUBS.forEach(function (r) {
      if (!m[r[0]]) return;
      var d = h('div', 'tdlpnj-rub');
      d.appendChild(h('span', 'tdlpnj-lbl',
        '<i class="fi ' + r[1] + '"></i>' + r[2]));
      d.appendChild(h('p', null, echappe(m[r[0]])));
      rubs.appendChild(d);
      nb++;
    });
    if (nb) corps.appendChild(rubs);

    hero.appendChild(corps);
    return hero;
  }

  /* --------------------------------------------------------- RETRAIT / POSE
     On retire les nœuds des lignes consommées — et les <br> entre
     elles, plus celui qui suit FIN : le RP repart à la ligne juste
     sous l'entête. Rien d'autre n'est touché : les autres scripts
     montés dans le message traversent l'opération. */
  function retirer(t) {
    var parent = t.conteneur, morts = [];
    for (var i = t.i0; i <= t.i1; i++) {
      var L = t.ls[i];
      if (!L) continue;
      if (L.br) morts.push(L.noeud);
      else Array.prototype.push.apply(morts, L.noeuds);
    }
    var apres = t.ls[t.i1 + 1];
    if (apres && apres.br) morts.push(apres.noeud);

    var ref = morts.length ? morts[morts.length - 1].nextSibling : null;
    morts.forEach(function (n) {
      if (n.parentNode === parent) parent.removeChild(n);
    });
    return ref;
  }

  function transformer(corpsPost) {
    var t = chercher(corpsPost, 0);
    if (!t) return;
    var m = analyser(t);
    m.pseudo = pseudoDuPosteur(corpsPost);
    var entete = rendre(m);
    var ref = retirer(t);
    t.conteneur.insertBefore(entete, ref);
  }

  /* --------------------------------------------------------------- AMORÇAGE */
  var SELECTEUR = '.sj-post-msg > div';   /* même cible que tdlpl-core */

  function passer() {
    Array.prototype.forEach.call(document.querySelectorAll(SELECTEUR), function (el) {
      if (el.textContent.indexOf('=== PNJ') < 0) return;
      if (el.querySelector('.tdlpnj-hero')) return;   /* déjà transformé */
      try { transformer(el); }
      catch (e) { alerte('rendu impossible : ' + (e && e.message)); }
    });
  }

  function demarrer() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', passer);
    } else { passer(); }
  }
  demarrer();

  global.SOS_PNJ = { relancer: passer };

})(window);
