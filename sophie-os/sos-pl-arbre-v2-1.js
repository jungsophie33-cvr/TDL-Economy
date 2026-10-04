/* ============================================================================
   TDL — PRÉ-LIENS : ARBRE GÉNÉALOGIQUE
   Fichier : tdlpl-arbre.js
   ----------------------------------------------------------------------------
   Lit le format texte « === ARBRE: » posé dans un message et le transforme en
   arbre généalogique, puis enrichit chaque personne avec le portrait et le
   statut lus dans le bottin des faceclaims.

   Rendu D'ABORD depuis le texte, enrichissement ENSUITE : si la base tarde ou
   tombe, la lignée reste lisible.

   Dépendances : eco-core-v1-5.js, puis tdlpl-core.js. Dans cet ordre.
   ========================================================================== */

(function () {
  "use strict";

  var T = window.TDLPL;
  if (!T) {
    if (window.console) console.error('[TDLPL arbre] tdlpl-core.js doit être chargé avant ce script.');
    return;
  }

  var CFG = T.CFG;
  var alerte = T.journal('arbre');
  var slug = T.slug, echappe = T.echappe, texteDates = T.texteDates;

  /* --------------------------------------------------------------- ANALYSEUR */

  var RE = {
    annee: /^\d{4}$/,
    plage: /^\d{4}\s*[-–—]\s*\d{4}$/,
    date: /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    sexe: /^[hf]$/i,
    nee: /^n[ée]e?\s+(.+)$/i,
    img: /^img\s*:\s*(.+)$/i,
    fc: /^fc\s*:\s*(.+)$/i
  };

  /* Analyse le segment décrivant UNE personne. */
  function litPersonne(seg) {
    var champs = seg.split(';').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!champs.length) return null;

    var p = {
      nomComplet: '', prenomLibre: false, nee: '', dates: null, sexe: '',
      statut: '', statutForce: false, img: '', fc: '', uid: null, slug: ''
    };

    var nom = champs.shift();
    if (/^\?\s*/.test(nom)) { p.prenomLibre = true; nom = nom.replace(/^\?\s*/, ''); }
    p.nomComplet = nom;
    p.slug = slug(nom);

    champs.forEach(function (c) {
      var m, st;
      if (RE.plage.test(c) || RE.date.test(c) || RE.annee.test(c)) { p.dates = T.calculeAge(c); return; }
      if (RE.sexe.test(c)) { p.sexe = c.toUpperCase(); return; }
      if ((m = c.match(RE.nee))) { p.nee = m[1]; return; }
      if ((m = c.match(RE.img))) { p.img = m[1]; return; }
      if ((m = c.match(RE.fc))) { p.fc = m[1]; return; }
      if ((st = T.litStatut(c))) { p.statut = st; p.statutForce = true; return; }
      alerte('champ non reconnu « ' + c + ' » sur ' + p.nomComplet);
    });

    if (p.dates && p.dates.mort && !p.statutForce) { p.statut = 'dcd'; p.statutForce = true; }
    return p;
  }

  /* Un segment peut décrire un couple : « A ; 1946 ; H & B ; 1948 ; F ». */
  function litPersonnes(seg) {
    return seg.split(/\s[&+]\s/).map(litPersonne).filter(Boolean);
  }

  function analyse(txt) {
    // Fusion des lignes de continuation (celles qui commencent par & ou +).
    var lignes = [];
    txt.split('\n').forEach(function (l) {
      var t = l.trim();
      if (!t) return;
      if (/^[&+]\s*/.test(t) && lignes.length) {
        lignes[lignes.length - 1] += ' & ' + t.replace(/^[&+]\s*/, '');
      } else lignes.push(t);
    });

    var modele = { famille: '', tronc: [], fiches: '', branches: [] };
    var dedans = false, branche = null, dernier = {};

    lignes.forEach(function (l) {
      var m;

      if ((m = l.match(/^===\s*ARBRE\s*:\s*(.+)$/i))) {
        dedans = true; modele.famille = m[1].trim(); return;
      }
      if (!dedans) return;
      if (/^===\s*FIN/i.test(l)) { dedans = false; return; }

      if ((m = l.match(/^TRONC\s*:\s*(.+)$/i))) { modele.tronc = litPersonnes(m[1]); return; }
      if ((m = l.match(/^FICHES\s*:\s*(.+)$/i))) { modele.fiches = m[1].trim(); return; }

      if ((m = l.match(/^---\s*BRANCHE\s*:?\s*(.*?)\s*---\s*$/i))) {
        branche = { titre: m[1].trim(), souche: [], enfants: [] };
        modele.branches.push(branche); dernier = {}; return;
      }

      if ((m = l.match(/^SOUCHE\s*:\s*(.+)$/i))) {
        if (!branche) { branche = { titre: '', souche: [], enfants: [] }; modele.branches.push(branche); }
        branche.souche = litPersonnes(m[1]); return;
      }

      if ((m = l.match(/^G([123])\s*:\s*(.+)$/i))) {
        var n = +m[1], noeud = { membres: litPersonnes(m[2]), enfants: [] };
        if (!noeud.membres.length) return;
        if (n === 1) {
          if (!branche) { branche = { titre: '', souche: [], enfants: [] }; modele.branches.push(branche); }
          branche.enfants.push(noeud);
        } else {
          var parent = dernier[n - 1];
          if (!parent) {
            alerte('G' + n + ' sans G' + (n - 1) + ' au-dessus : ' +
                   noeud.membres[0].nomComplet + ' est ignoré');
            return;
          }
          parent.enfants.push(noeud);
        }
        dernier[n] = noeud;
        for (var k = n + 1; k <= 3; k++) delete dernier[k];
        return;
      }

      alerte('ligne ignorée : « ' + l + ' »');
    });

    return modele.famille ? modele : null;
  }

  function parcours(modele, fn) {
    function noeud(n) { n.membres.forEach(fn); n.enfants.forEach(noeud); }
    modele.tronc.forEach(fn);
    modele.branches.forEach(function (b) {
      b.souche.forEach(fn);
      b.enfants.forEach(noeud);
    });
  }

    function enrichit(modele, idx) {
    parcours(modele, function (p) {
      var e = T.trouve(idx, p.fc, p.nomComplet);
      if (!e) {
        if (!p.statutForce) {
          alerte('introuvable dans le bottin : ' + p.nomComplet + ' (ajouter « fc: Prénom Nom »)');
        }
        return;
      }
      // L'image du bottin fait foi dès que l'entrée existe : img: n'est qu'un
      // repli pour les personnes absentes du bottin (ancêtres, défunts, décor).
      if (e.image) p.img = e.image;

      if (String(e.statut || '').toLowerCase() === 'pris') {
        p.uid = e.uid || null;
        // Un fait l'emporte sur une prévision écrite à la main — sauf la mort,
        // qu'aucune validation de fiche ne doit pouvoir annuler.
        if (p.statut !== 'dcd') p.statut = 'pris';
      } else if (!p.statutForce) {
        p.statut = 'libre';
      }
    });
  }
   
  /* ----------------------------------------------------------------- RENDU */

  function urlFiche(p, base) {
    if (!base) return '#' + p.slug;
    var parts = base.split('#');
    return parts[0] + '?fiche=' + p.slug + (parts[1] ? '#' + parts[1] : '');
  }

  function htmlLien(p, base) {
    if (p.statut === 'dcd') return '';
    if (p.statut === 'pris' && p.uid) {
      return '<a class="tdlpl-lien" href="/u' + p.uid + '" title="Profil du joueur">' +
        '<i class="fi fi-tr-user"></i></a>';
    }
    return '<a class="tdlpl-lien" href="' + echappe(urlFiche(p, base)) + '" title="Voir la fiche">' +
      '<i class="fi fi-tr-link-alt"></i></a>';
  }

  function htmlPortrait(p, cls) {
    var c = 'tdlpl-ph' + (cls ? ' ' + cls : '') + (p.img ? '' : ' tdlpl-ph-vide');
    if (p.img) return '<div class="' + c + '"><img src="' + echappe(p.img) + '" alt=""></div>';
    if (p.statut === 'dcd') return '<div class="' + c + '">&#10013;</div>';
    if (p.prenomLibre) return '<div class="' + c + '">?</div>';
    var mots = p.nomComplet.split(/\s+/);
    var ini = (mots[0] || '?').charAt(0) + (mots.length > 1 ? mots[mots.length - 1].charAt(0) : '');
    return '<div class="' + c + '">' + echappe(ini.toUpperCase()) + '</div>';
  }

  function htmlPastille(p) {
    return '<span class="tdlpl-pastille tdlpl-' + p.statut + '">' +
      T.libelle(p.statut, p.sexe) + '</span>';
  }

  function htmlIdentite(p) {
    var h = '<div class="tdlpl-ident">';
    h += '<div class="tdlpl-nom">' + echappe(p.nomComplet) + '</div>';
    if (p.nee) h += '<div class="tdlpl-nee">née ' + echappe(p.nee) + '</div>';
    if (p.prenomLibre) {
      h += '<div class="tdlpl-anon">prénom au choix' +
        (p.sexe ? ' · ' + (p.sexe === 'F' ? 'femme' : 'homme') : '') + '</div>';
    }
    if (p.dates) h += '<div class="tdlpl-dates">' + texteDates(p.dates) + '</div>';
    return h + '</div>';
  }

  function htmlPersonne(p, base, tailleP) {
    return '<div class="tdlpl-pers">' + htmlPortrait(p, tailleP) + htmlIdentite(p) +
      '<div class="tdlpl-statut">' + htmlPastille(p) + htmlLien(p, base) + '</div></div>';
  }

  function htmlG3(liste) {
    if (!liste.length) return '';
    var h = '<div class="tdlpl-g3">';
    liste.forEach(function (n) {
      n.membres.forEach(function (p) {
        h += '<div class="tdlpl-g3-ligne">' + htmlPortrait(p, 'tdlpl-ph-sm') +
          '<span class="tdlpl-g3-nom">' + echappe(p.nomComplet) + '</span>' +
          '<span class="tdlpl-g3-an">' + texteDates(p.dates) + '</span>' +
          '<span class="tdlpl-point tdlpl-' + p.statut + '"></span></div>';
      });
    });
    return h + '</div>';
  }

  function htmlCarte(n, base) {
    var p = n.membres[0], large = n.enfants.length > 0;
    var h = '<div class="tdlpl-carte' + (large ? ' tdlpl-large' : '') +
      (p.statut === 'dcd' ? ' tdlpl-eteint' : '') + '">';
    h += htmlPortrait(p);
    h += '<div class="tdlpl-carte-corps">' + htmlIdentite(p) +
      '<div class="tdlpl-statut">' + htmlPastille(p) + htmlLien(p, base) + '</div></div>';
    h += htmlG3(n.enfants);
    return h + '</div>';
  }

  function htmlBloc(n, base) {
    var solo = n.membres.length < 2;
    var h = '<div class="tdlpl-bloc"><div class="tdlpl-parent' + (solo ? ' tdlpl-solo' : '') + '">';
    h += n.membres.map(function (p) { return htmlPersonne(p, base); })
      .join('<div class="tdlpl-infini">&#8734;</div>');
    h += '</div>';
    if (n.enfants.length) {
      h += '<div class="tdlpl-enfants">' +
        n.enfants.map(function (e) { return htmlCarte(e, base); }).join('') + '</div>';
    }
    return h + '</div>';
  }

  function htmlCompteur(modele) {
    var c = { libre: 0, reserve: 0, total: 0 };
    parcours(modele, function (p) {
      c.total++;
      if (p.statut === 'libre') c.libre++;
      if (p.statut === 'reserve') c.reserve++;
    });
    var bouts = ['<em>' + c.libre + (c.libre > 1 ? ' rôles libres' : ' rôle libre') + '</em>'];
    if (c.reserve) bouts.push(c.reserve + (c.reserve > 1 ? ' réservés' : ' réservé'));
    bouts.push(c.total + ' personnages');
    return '<span class="tdlpl-compte">' + bouts.join(' · ') + '</span>';
  }

  function rendu(modele) {
    var base = modele.fiches, h = '<div class="tdlpl annexe">';

    h += '<div class="tdlpl-hero"><div class="tdlpl-hero-in">';
    h += '<h1 class="tdlpl-fam">' + echappe(modele.famille) + '</h1>';
    if (modele.tronc.length) {
      h += '<p class="tdlpl-tronc">Issus de ' + modele.tronc.map(function (p) {
        var d = p.dates ? ' (' + p.dates.an + (p.dates.mort ? ' — ' + p.dates.mort : '') + ')' : '';
        return '<b>' + echappe(p.nomComplet) + '</b>' + d;
      }).join(' &amp; ') + '</p>';
    }
    h += '</div></div>';

    h += '<div class="tdlpl-legende">';
    T.STATUTS.forEach(function (s) {
      h += '<span class="tdlpl-pastille tdlpl-' + s + '">' + T.libelle(s) + '</span>';
    });
    h += htmlCompteur(modele) + '</div>';

    modele.branches.forEach(function (b) {
      h += '<div class="tdlpl-branche">';
      if (b.titre) {
        var bouts = b.titre.split(/\s*[—–-]\s*/);
        h += '<div class="h3"><h3>' + echappe(bouts[0]) +
          (bouts[1] ? '<span>' + echappe(bouts.slice(1).join(' — ')) + '</span>' : '') + '</h3></div>';
      }
      if (b.souche.length) {
        h += '<div class="tdlpl-souche">' + b.souche.map(function (p) {
          return htmlPersonne(p, base);
        }).join('<div class="tdlpl-infini">&#8734;</div>') + '</div>';
      }
      if (b.enfants.length) {
        h += '<div class="tdlpl-col">' +
          b.enfants.map(function (n) { return htmlBloc(n, base); }).join('') + '</div>';
      }
      h += '</div>';
    });

    return h + '</div>';
  }

  /* --------------------------------------------------------------- AMORÇAGE */

  function demarre() {
    var cibles = T.postsAvec('=== ARBRE:', '.tdlpl');
    if (!cibles.length) return;

    cibles.forEach(function (el) {
      var modele = analyse(T.texteBrut(el));
      if (!modele) return;

      // Sans ça, une personne sans jeton de statut écrit garde une chaîne vide
      // et sa pastille s'affiche sans libellé ni couleur pendant le temps que
      // met la base à répondre.
      parcours(modele, function (p) { if (!p.statut) p.statut = CFG.statutDefaut; });

      el.innerHTML = rendu(modele);                 // 1. rendu immédiat
      T.litIndex(function (idx) {                   // 2. enrichissement
        if (!idx) return;
        enrichit(modele, idx);
        el.innerHTML = rendu(modele);
      });
    });
  }

  T.pret(demarre);

  window.TDLPL_ARBRE = { relancer: demarre, analyse: analyse };
})();
