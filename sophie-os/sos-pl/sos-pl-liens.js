/* ============================================================================
   SOS — FICHE DE LIENS : RECHERCHES, RÉPERTOIRE DES RP, RÉPERTOIRE DES LIENS
   Fichier : sos-pl-liens.js
   ----------------------------------------------------------------------------
   Trois blocs texte posés dans les posts d'un sujet — la « fiche de liens »
   d'un membre. La présentation vit dans un post libre (modèle === PRESENTATION
   ou prose brute : ce script n'y touche pas) ; les répertoires vivent dans le
   même post ou dans les posts suivants, comme le membre l'organise :

     === RECHERCHES
     RECHERCHE:
     CATEGORIE: amitié
     une complice de longue date, croisée chaque samedi au marché…
     (texte libre ; une ligne vide ouvre un nouveau paragraphe)

     === RPS
     RP: Titre du RP | https://… | AVEC: Prénom Nom, Prénom Nom | DATE: 12 septembre 2026 | LIEU: Les Noyers | STATUT: en cours
     RESUME: court résumé optionnel, plusieurs lignes admises
     (une ligne vide ouvre un nouveau paragraphe)
     RP: Autre RP | https://… | DATE: octobre 2026 | STATUT: terminé

     === LIENS
     LIEN: Alice Liddell | famille | cousine éloignée | TAGS: féminin
     RESUME: brève histoire du lien, plusieurs paragraphes admis
     IMAGE: https://…          (facultatif — sinon avatar du bottin, par pseudo)
     === FIN

   RÈGLES COMMUNES (charte du format) :
   · « === FIN » est facultatif et insensible à la casse ; sans lui, les
     lignes se rattachent au bloc courant jusqu'au marqueur suivant.
   · Les marqueurs sont insensibles à la casse ; les blocs répétés
     s'ACCUMULENT (deux === LIENS dans un post = une seule section, remplie
     par les deux). Chaque section n'apparaît que si son bloc est présent.
   · Les clés sont insensibles à la casse et aux accents, dans un bloc comme
     dans les segments d'une ligne « RP: a | b | c ». Un segment nu est admis
     pour l'URL (http…) ; tout le reste attend une clé.
   · La DATE est écrite libre (« 12 septembre 2026 » ou « octobre 2026 ») ;
     elle s'affiche TELLE QUE, mais le tri la normalise en coulisse
     (année × 10000 + mois × 100 + jour).
   · Le STATUT tolère « en cours / terminé(s) / fini / abandonné(s) / arrêté » ;
     manquant ou inconnu → « en cours », signalé en console.
   · La CATEGORIE d'un lien tolère les variantes (amitié/amis, hostile/
     ennemi/rival…) ; manquante ou inconnue → « autre », signalé en console.
   Les catégories affichées, dans cet ordre : famille, amour, amitié,
   professionnel, hostilité, autre. Les TAGS sont libres (féminin, masculin,
   port, digue…) et alimentent les filtres du répertoire des liens.

   Ce que le script fait seul : tri des RP (statut, puis du plus récent au
   plus ancien), regroupement des liens par catégorie puis tri alphabétique,
   vignettes d'avatar lues dans le bottin des faceclaims PAR PSEUDO (une
   seule lecture du nœud par page, mutualisée avec l'arbre et les fiches),
   filtres de tags, accordéon du résumé, et communication entre posts :
   le bouton « voir les rp » d'un lien filtre le répertoire des RP, même
   rendu dans un autre post du sujet.

   Aucune écriture Firebase : lecture seule, fonctionne pour les invités.
   La classe « annexe » est posée sur le conteneur (profil FA masqué).

   Feuille associée : CSS-pl-liens.css (sos-pl/).
   Dépendances : eco-core-v2.js, puis sos-pl-core.js. Dans cet ordre.
   ========================================================================== */

(function () {
  "use strict";

  if (window.TDLPL_LIENS) return;

  var T = window.TDLPL;
  if (!T) {
    if (window.console) console.error('[TDLPL liens] sos-pl-core.js doit être chargé avant ce script.');
    return;
  }

  var CFG = T.CFG;
  var alerte = T.journal('liens');
  var slug = T.slug, echappe = T.echappe;

  /* ------------------------------------------------------------- CONSTANTES */

  var MARQUEURS  = ['RECHERCHES', 'RPS', 'LIENS'];
  var CATS_LIENS = ['famille', 'intime', 'amitié', 'professionnel', 'hostilité', 'autre'];
  var STATUTS_RP = ['en cours', 'terminé', 'abandonné'];

  var MOIS = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5,
               juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9,
               octobre: 10, novembre: 11, decembre: 12, décembre: 12 };

  /* Marqueurs : « === RPS », « === RPS: », « === RPS === », toute casse. */
  var RE_MARQUEUR = /^===\s*(RECHERCHES|RPS|LIENS)\s*:?\s*(?:===\s*)?$/i;
  var RE_FIN      = /^===\s*FIN(?:\s*===)?\s*$/i;
  var RE_CLE      = /^([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9_]*)\s*:\s?(.*)$/i;
  /* N'importe lequel de nos marqueurs, pour repérer les posts à transformer
     sans dépendre de la casse (postsAvec est un indexOf strict). */
  var RE_UN_MARQUEUR = /===\s*(RECHERCHES|RPS|LIENS)\b/i;

  /* Clés normalisées (casse + accents retirés) de chaque bloc. */
  var CLES_REC  = { RECHERCHE: 1, CATEGORIE: 1, CAT: 1 };
  var CLES_RP   = { RP: 1, AVEC: 1, PARTICIPANTS: 1, DATE: 1, LIEU: 1,
                    STATUT: 1, URL: 1, RESUME: 1 };
  var CLES_LIEN = { LIEN: 1, PSEUDO: 1, NOM: 1, CATEGORIE: 1, CAT: 1,
                    TYPE: 1, TAGS: 1, IMAGE: 1, RESUME: 1 };

  /* ------------------------------------------------------------- UTILITAIRES */

  function normCle(s) {
    return String(s || '').toUpperCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function sansBalises(s) {
    return String(s == null ? '' : s).replace(/<[^>]*>/g, '').trim();
  }

  function premierMot(s) {
    return String(s || '').trim().split(/\s+/)[0] || '';
  }

  /* Lignes (avec marqueurs '' de paragraphe) -> <p>…</p> : une ligne vide
     ouvre un nouveau paragraphe, les lignes d'un paragraphe se rejoignent
     par une espace. */
  function paragraphes(lignes) {
    var pars = [], cur = [];
    (lignes || []).forEach(function (l) {
      if (l === '') { if (cur.length) { pars.push(cur); cur = []; } return; }
      cur.push(l);
    });
    if (cur.length) pars.push(cur);
    return pars.map(function (p) { return '<p>' + echappe(p.join(' ')) + '</p>'; }).join('');
  }

  /* « 12 septembre 2026 » comme « octobre 2026 » -> clé numérique
     décroissante. Sans mois reconnu, l'année seule ; sans rien, 0. */
  function cleDate(v) {
    var s = String(v || '').toLowerCase();
    var m = s.match(/(?:(\d{1,2})\s+)?(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(\d{4})/);
    if (m) return (+m[3]) * 10000 + (MOIS[m[2]] || 0) * 100 + (+(m[1] || 0));
    var y = s.match(/(\d{4})/);
    return y ? (+y[1]) * 10000 : 0;
  }

  function litStatutRp(v) {
    var s = slug(v);
    if (!s) return null;
    if (s === 'en-cours' || s === 'encours' || s === 'cours') return 'en cours';
    if (s === 'termine' || s === 'terminee' || s === 'fini' || s === 'fin') return 'terminé';
    if (s.indexOf('abandon') === 0 || s === 'stoppe' || s === 'arrete') return 'abandonné';
    return null;
  }

  function litCatLien(v) {
    var s = slug(v);
    if (!s) return null;
    if (s === 'famille') return 'famille';
    if (s === 'amour' || s === 'romantique' || s === 'coeur') return 'amour';
    if (s === 'amitie' || s.indexOf('ami') === 0) return 'amitié';
    if (s.indexOf('prof') === 0 || s.indexOf('metier') === 0 || s === 'travail') return 'professionnel';
    if (s.indexOf('hostil') === 0 || s.indexOf('ennem') === 0 || s === 'rival') return 'hostilité';
    return 'autre';
  }

  /* Le personnage « avec » du RP matche-t-il ce pseudo ? Tolérant dans les
     deux sens : pseudo complet, prénom seul, ou premier mot du participant. */
  function aPart(avec, pseudo) {
    var pl = slug(pseudo), pr = slug(premierMot(pseudo));
    return String(avec || '').split(',').some(function (p) {
      var s = slug(p);
      return s === pl || s === pr || slug(premierMot(p)) === pr;
    });
  }

  function initiales(pseudo) {
    var mots = String(pseudo || '').trim().split(/\s+/).filter(Boolean);
    if (!mots.length) return '?';
    var ini = mots[0].charAt(0) + (mots.length > 1 ? mots[mots.length - 1].charAt(0) : '');
    return ini.toUpperCase();
  }

  /* ---------------------------------------------------------------- ANALYSE */

  /* « RP: Titre | https://… | AVEC: … | DATE: … | LIEU: … | STATUT: … » */
  function rpDepuisLigne(reste) {
    var rp = { titre: '', url: '', avec: '', date: '', lieu: '', statut: '', resume: [] };
    var segs = String(reste || '').split('|');
    segs.forEach(function (seg, i) {
      var s = seg.trim();
      if (!s) return;
      if (i === 0) { rp.titre = s; return; }
      /* l'URL est testée AVANT la clé : « https://… » matche la regex de
         clé (HTTPS:) et serait avalée comme clé inconnue */
      if (/^https?:\/\//i.test(s)) { rp.url = s; return; }   // URL en clair
      var m = s.match(RE_CLE);
      if (m) {
        var cle = normCle(m[1]), v = m[2].trim();
        if (!CLES_RP[cle]) { alerte('clé « ' + m[1] + ' » inconnue dans un RP: — segment ignoré'); return; }
        if (cle === 'RP') { alerte('« RP: » imbriqué dans « ' + rp.titre + ' » — segment ignoré'); return; }
        if (cle === 'AVEC' || cle === 'PARTICIPANTS') { rp.avec = v; return; }
        if (cle === 'DATE')  { rp.date = v; return; }
        if (cle === 'LIEU')  { rp.lieu = v; return; }
        if (cle === 'STATUT'){ rp.statut = v; return; }
        if (cle === 'URL')   { rp.url = sansBalises(v); return; }
        if (cle === 'RESUME'){ rp.resume.push(v); return; }
        return;
      }
      var st = litStatutRp(s);
      if (st) { rp.statut = s; return; }
      alerte('segment « ' + s + ' » sans clé dans un RP: — ignoré');
    });
    if (!rp.titre) { alerte('RP: sans titre — entrée ignorée'); return null; }
    return rp;
  }

  /* « LIEN: Pseudo | catégorie | type | TAGS: a, b » */
  function lienDepuisLigne(reste) {
    var l = { pseudo: '', cat: '', type: '', tags: [], image: '', resume: [] };
    var segs = String(reste || '').split('|');
    var nus = 0;
    segs.forEach(function (seg, i) {
      var s = seg.trim();
      if (!s) return;
      if (i === 0) { l.pseudo = s; return; }
      /* URL nue : c'est l'image (testée avant la clé — cf. rpDepuisLigne) */
      if (/^https?:\/\//i.test(s)) { l.image = s; return; }
      var m = s.match(RE_CLE);
      if (m) {
        var cle = normCle(m[1]), v = m[2].trim();
        if (!CLES_LIEN[cle]) { alerte('clé « ' + m[1] + ' » inconnue dans un LIEN: — segment ignoré'); return; }
        if (cle === 'LIEN') { alerte('« LIEN: » imbriqué dans « ' + l.pseudo + ' » — segment ignoré'); return; }
        if (cle === 'PSEUDO' || cle === 'NOM') { l.pseudo = v; return; }
        if (cle === 'CATEGORIE' || cle === 'CAT') { l.cat = v; return; }
        if (cle === 'TYPE') { l.type = v; return; }
        if (cle === 'TAGS') {
          l.tags = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
          return;
        }
        if (cle === 'IMAGE') { l.image = sansBalises(v); return; }
        if (cle === 'RESUME'){ l.resume.push(v); return; }
        return;
      }
      nus++;   // segment nu : positionnel — 2e = catégorie, 3e = type
      if (nus === 1)      { l.cat = s; return; }
      if (nus === 2)      { l.type = s; return; }
      alerte('segment « ' + s + ' » sans clé dans un LIEN: — ignoré');
    });
    if (!l.pseudo) { alerte('LIEN: sans pseudo — entrée ignorée'); return null; }
    return l;
  }

  /* Un post entier -> { recherches, rps, liens }. Les marqueurs d'autres
     blocs (=== PRESENTATION…) referment le bloc courant en silence : la
     présentation libre cohabite avec les répertoires dans le même post. */
  function analysePost(texte) {
    var d = { recherches: [], rps: [], liens: [] };
    var bloc = null, entree = null, champLong = null;

    function fermerEntree() { entree = null; champLong = null; }

    String(texte || '').split('\n').forEach(function (brute) {
      var t = String(brute || '').replace(/\s+$/, '').trim();
      var m;

      if (!t) {                                   // ligne vide : paragraphe
        if (champLong) champLong.push('');
        else if (bloc === 'RECHERCHES' && entree) entree.lignes.push('');
        return;
      }

      if (RE_FIN.test(t)) { bloc = null; fermerEntree(); return; }

      if ((m = t.match(RE_MARQUEUR))) {
        bloc = m[1].toUpperCase(); fermerEntree(); return;
      }

      if (/^===/.test(t)) { fermerEntree(); bloc = null; return; }

      if ((m = t.match(RE_CLE))) {
        var cle = normCle(m[1]), reste = m[2].trim();

        /* --- === RECHERCHES : prose libre, une clé ouvre/renseigne --- */
        if (bloc === 'RECHERCHES') {
          if (cle === 'RECHERCHE') {
            entree = { cat: '', lignes: reste ? [reste] : [] };
            d.recherches.push(entree);
            champLong = entree.lignes;
            return;
          }
          if (entree) {
            if (cle === 'CATEGORIE' || cle === 'CAT') { entree.cat = reste; return; }
            entree.lignes.push(t);            // « Quelque chose: … » reste de la prose
            return;
          }
          alerte('clé « ' + m[1] + ': » hors RECHERCHE: — ignorée');
          return;
        }

        /* --- === RPS --- */
        if (bloc === 'RPS') {
          if (cle === 'RP') {
            entree = rpDepuisLigne(reste);
            if (entree) d.rps.push(entree);
            champLong = null;
            return;
          }
          if (!entree) { alerte('clé « ' + m[1] + ': » avant tout RP: — ignorée'); return; }
          if (cle === 'RESUME') { entree.resume.push(reste); champLong = entree.resume; return; }
          if (cle === 'AVEC' || cle === 'PARTICIPANTS') { entree.avec = reste; champLong = null; return; }
          if (cle === 'DATE')   { entree.date = reste;  champLong = null; return; }
          if (cle === 'LIEU')   { entree.lieu = reste;  champLong = null; return; }
          if (cle === 'STATUT') { entree.statut = reste; champLong = null; return; }
          if (cle === 'URL')    { entree.url = sansBalises(reste); champLong = null; return; }
          if (champLong) { champLong.push(t); return; }   // prose du résumé
          alerte('clé « ' + m[1] + ': » inconnue dans === RPS — ignorée');
          return;
        }

        /* --- === LIENS --- */
        if (bloc === 'LIENS') {
          if (cle === 'LIEN') {
            entree = lienDepuisLigne(reste);
            if (entree) d.liens.push(entree);
            champLong = null;
            return;
          }
          if (!entree) { alerte('clé « ' + m[1] + ': » avant tout LIEN: — ignorée'); return; }
          if (cle === 'RESUME') { entree.resume.push(reste); champLong = entree.resume; return; }
          if (cle === 'PSEUDO' || cle === 'NOM') { entree.pseudo = reste; champLong = null; return; }
          if (cle === 'CATEGORIE' || cle === 'CAT') { entree.cat = reste; champLong = null; return; }
          if (cle === 'TYPE') { entree.type = reste; champLong = null; return; }
          if (cle === 'TAGS') {
            entree.tags = reste.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
            champLong = null;
            return;
          }
          if (cle === 'IMAGE') { entree.image = sansBalises(reste); champLong = null; return; }
          if (champLong) { champLong.push(t); return; }   // prose du résumé
          alerte('clé « ' + m[1] + ': » inconnue dans === LIENS — ignorée');
          return;
        }

        return;   // clé hors de tout bloc (prose libre du post) : silence
      }

      /* ligne sans clé */
      if (champLong) { champLong.push(t); return; }
      if (bloc === 'RECHERCHES' && entree) { entree.lignes.push(t); return; }
      if (bloc) alerte('ligne ignorée dans === ' + bloc + ' : « ' + t + ' »');
    });

    return d;
  }

  /* ------------------------------------------------------- PRÉPARATION / TRI */

  function preparer(d) {
    d.recherches = d.recherches.filter(function (r) {
      if (!r.lignes.length) { alerte('RECHERCHE: vide — entrée ignorée'); return false; }
      return true;
    });

    d.rps.forEach(function (rp) {
      var st = rp.statut ? litStatutRp(rp.statut) : null;
      if (!st) {
        alerte((rp.statut ? 'statut « ' + rp.statut + ' » non reconnu' : 'sans STATUT:') +
               ' sur « ' + rp.titre + ' » — rangé « en cours »');
      }
      rp.statutNorm = st || 'en cours';
      rp.dateCle = cleDate(rp.date);
    });
    d.rps.sort(function (a, b) {
      var ia = STATUTS_RP.indexOf(a.statutNorm), ib = STATUTS_RP.indexOf(b.statutNorm);
      return (ia - ib) || (b.dateCle - a.dateCle);
    });

    d.liens.forEach(function (l) {
      var c = l.cat ? litCatLien(l.cat) : null;
      if (!c) {
        alerte((l.cat ? 'catégorie « ' + l.cat + ' » non reconnue' : 'sans catégorie') +
               ' sur ' + l.pseudo + ' — rangé dans « autre »');
      }
      l.catNorm = c || 'autre';
    });
    d.liens.sort(function (a, b) {
      return String(a.pseudo).localeCompare(String(b.pseudo), 'fr');
    });

    return d;
  }

  /* ------------------------------------------------------------------ RENDU */

  function htmlHead(titre, sous, tagsHtml) {
    return '<div class="tdlplf-hero"><div class="tdlplf-hero-in">' +
      '<h2 class="tdlrol-titre">' + echappe(titre) + '</h2>' +
      '<p class="tdlrol-sous">' + echappe(sous) + '</p></div>' +
      (tagsHtml || '') + '</div>';
  }

  function htmlSecRec(liste) {
    var h = '<div class="tdlfl-sec tdlfl-rec">';
    h += htmlHead('Recherche de liens rapide';
    h += '<div class="srec-grid">';
    liste.forEach(function (r) {
      h += '<div class="srec-card">' +
        (r.cat ? '<span class="srec-cat">' + echappe(r.cat) + '</span>' : '') +
        '<div class="srec-txt">' + paragraphes(r.lignes) + '</div></div>';
    });
    return h + '</div></div>';
  }

  function htmlRpRow(rp) {
    var h = '<div class="srp-row" data-avec="' + echappe(rp.avec) + '">';
    h += '<div class="srp-line">';
    h += '<span class="srp-nom-wrap"><span class="srp-nom" title="' + echappe(rp.titre) + '">' +
      echappe(rp.titre) + '</span>';
    if (rp.url) {
      h += '<a class="srp-ic" href="' + echappe(rp.url) + '" title="ouvrir le sujet">' +
        '<i class="fi fi-tr-arrow-up-right-from-square"></i></a>';
    }
    h += '</span>';
    h += '<span class="srp-lieu">' +
      (rp.lieu ? '<i class="fi fi-sr-marker"></i><span class="srp-lieu-txt">' + echappe(rp.lieu) + '</span>' : '') +
      '</span>';
    h += '<span class="srp-meta">' + echappe(rp.avec) + '</span>';
    h += '<span class="srp-date">' + echappe(rp.date) + '</span>';
    h += '</div>';
    if (rp.resume.length) {
      h += '<div class="srp-resume"><div class="srp-resume-inner">' +
        paragraphes(rp.resume) + '</div></div>';
    }
    return h + '</div>';
  }

  function htmlSecRps(liste) {
    var h = '<div class="tdlfl-sec tdlfl-rps">';
    h += htmlHead('Listing des sujets rp';
    h += '<div class="srp-filtre"><span>sujets rp avec <b class="srp-filtre-qui"></b></span>' +
      '<button type="button" class="srp-filtre-reset">réinitialiser</button></div>';
    var cur = null, ouvert = false;
    liste.forEach(function (rp) {
      if (rp.statutNorm !== cur) {
        if (ouvert) h += '</div>';
        cur = rp.statutNorm; ouvert = true;
        var n = 0;
        liste.forEach(function (x) { if (x.statutNorm === cur) n++; });
        h += '<div class="srp-group" data-statut="' + echappe(cur) + '">' +
          '<div class="srp-head"><h3 class="srp-titre">' + echappe(cur) + '</h3>' +
          '<p class="srp-sous">' + n + ' sujet' + (n > 1 ? 's' : '') + '</p></div>';
      }
      h += htmlRpRow(rp);
    });
    if (ouvert) h += '</div>';
    return h + '</div>';
  }

  function htmlCarteLien(l, ctx) {
    var img = l.image || (ctx.avatars ? avatarDe(ctx.avatars, l.pseudo) : '');
    var av = img
      ? '<div class="sli-avatar"><img src="' + echappe(img) + '" alt="' + echappe(l.pseudo) + '"></div>'
      : '<div class="sli-avatar">' + echappe(initiales(l.pseudo)) + '</div>';
    var n = 0;
    (ctx.rpsPage || []).forEach(function (rp) { if (aPart(rp.avec, l.pseudo)) n++; });
    var btn = '';
    if (ctx.rpsPage && ctx.rpsPage.length) {
      btn = n > 0
        ? '<button type="button" class="sli-rpbtn" data-pseudo="' + echappe(l.pseudo) +
          '" title="voir les sujets rp avec ce personnage">voir les rp (' + n + ')</button>'
        : '<span class="sli-rpbtn vide">aucun rp</span>';
    }
    var h = '<div class="sli-card" data-tags="' + l.tags.map(echappe).join('|') + '">' + av +
      '<div class="sli-body"><div class="sli-entete">' +
      '<span class="sli-name" title="' + echappe(l.pseudo) + '">' + echappe(l.pseudo) + '</span>' +
      '<span class="sli-filet"></span>' +
      (l.type ? '<span class="sli-type">' + echappe(l.type) + '</span>' : '') +
      '</div>';
    if (l.resume.length) h += '<div class="sli-resume">' + paragraphes(l.resume) + '</div>';
    h += '<div class="sli-tags">' +
      l.tags.map(function (t) { return '<span class="sli-tag">' + echappe(t) + '</span>'; }).join('') +
      btn + '</div></div></div>';
    return h;
  }

  function htmlSecLiens(liste, ctx) {
    /* filtres : union des tags de la section, triée */
    var vus = {};
    var tags = [];
    liste.forEach(function (l) {
      l.tags.forEach(function (t) { if (!vus[t]) { vus[t] = 1; tags.push(t); } });
    });
    tags.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    var filtres = '<div class="tdlrol-tags">' +
      '<button type="button" class="tdlrol-tag actif" data-tag="*">tous</button>' +
      tags.map(function (t) {
        return '<button type="button" class="tdlrol-tag" data-tag="' + echappe(t) + '">' +
          echappe(t) + '</button>';
      }).join('') + '</div>';

    var h = '<div class="tdlfl-sec tdlfl-liens">';
    h += htmlHead('Répertoire des liens',
      filtres);
    CATS_LIENS.forEach(function (cat) {
      var items = liste.filter(function (l) { return l.catNorm === cat; });
      if (!items.length) return;
      h += '<div class="sli-cat" data-cat="' + echappe(cat) + '">' +
        '<div class="sli-cat-head"><h3 class="sli-cat-titre">' + echappe(cat) + '</h3>' +
        '<p class="sli-cat-sous">' + items.length + ' lien' + (items.length > 1 ? 's' : '') + '</p></div>' +
        '<div class="sli-list">';
      items.forEach(function (l) { h += htmlCarteLien(l, ctx); });
      h += '</div></div>';
    });
    return h + '</div>';
  }

  /* Un post transformé : sections dans l'ordre canonique, seulement
     celles qui ont des entrées. */
  function htmlPost(d, ctx) {
    var h = '<div class="tdlfl annexe">';
    if (d.recherches.length) h += htmlSecRec(d.recherches);
    if (d.rps.length)        h += htmlSecRps(d.rps);
    if (d.liens.length)      h += htmlSecLiens(d.liens, ctx);
    return h + '</div>';
  }

  /* Avatar du bottin par pseudo : passe par l'index du socle (clé du
     bottin, nom d'acteur, puis nom de personnage). */
  function avatarDe(idx, pseudo) {
    var e = T.trouve(idx, pseudo, pseudo);
    return (e && e.image) ? String(e.image) : '';
  }

  /* --------------------------------------------------------- INTERACTIONS */

  function basculeRp(row) {
    var res = row.querySelector('.srp-resume');
    if (!res) return;
    if (row.classList.contains('open')) {
      row.classList.remove('open');
      res.style.maxHeight = '0px';
    } else {
      row.classList.add('open');
      /* hauteur réelle mesurée à l'ouverture : l'animation part toujours
         du bon endroit, quelle que soit la longueur du résumé */
      res.style.maxHeight = res.scrollHeight + 'px';
    }
  }

  function plusProche(el, sel) {
    while (el && el.nodeType === 1) {
      if (el.matches && el.matches(sel)) return el;
      el = el.parentNode;
    }
    return null;
  }

  /* Filtre « voir les rp avec ce personnage » : agit sur TOUTES les
     sections rp de la page — le répertoire peut vivre dans un autre post
     du sujet. Requête vivante : survit aux repeintes. */
  function voirRp(pseudo) {
    var secs = document.querySelectorAll('.tdlfl-rps');
    if (!secs.length) { alerte('aucun répertoire rp sur la page — bouton sans effet'); return; }
    Array.prototype.forEach.call(secs, function (sec) {
      var filtre = sec.querySelector('.srp-filtre');
      if (filtre) filtre.classList.add('actif');
      var qui = sec.querySelector('.srp-filtre-qui');
      if (qui) qui.textContent = premierMot(pseudo);
      Array.prototype.forEach.call(sec.querySelectorAll('.srp-row'), function (row) {
        row.style.display = aPart(row.getAttribute('data-avec') || '', pseudo) ? '' : 'none';
      });
      Array.prototype.forEach.call(sec.querySelectorAll('.srp-group'), function (g) {
        var vis = Array.prototype.some.call(g.querySelectorAll('.srp-row'),
          function (r) { return r.style.display !== 'none'; });
        g.style.display = vis ? '' : 'none';
      });
    });
    secs[0].scrollIntoView({ behavior: 'smooth' });
  }

  function reinitFiltre() {
    Array.prototype.forEach.call(document.querySelectorAll('.tdlfl-rps'), function (sec) {
      var filtre = sec.querySelector('.srp-filtre');
      if (filtre) filtre.classList.remove('actif');
      Array.prototype.forEach.call(sec.querySelectorAll('.srp-row'), function (r) { r.style.display = ''; });
      Array.prototype.forEach.call(sec.querySelectorAll('.srp-group'), function (g) { g.style.display = ''; });
    });
  }

  function filtrerTags(wrap, bouton) {
    var barre = bouton.parentElement;
    Array.prototype.forEach.call(barre.querySelectorAll('.tdlrol-tag'), function (b) {
      b.classList.remove('actif');
    });
    bouton.classList.add('actif');
    var t = bouton.getAttribute('data-tag');
    Array.prototype.forEach.call(wrap.querySelectorAll('.sli-card'), function (carte) {
      var tags = (carte.getAttribute('data-tags') || '').split('|');
      carte.classList.toggle('off', !(t === '*' || tags.indexOf(t) >= 0));
    });
    Array.prototype.forEach.call(wrap.querySelectorAll('.sli-cat'), function (cat) {
      var vis = Array.prototype.some.call(cat.querySelectorAll('.sli-card'),
        function (c) { return !c.classList.contains('off'); });
      cat.style.display = vis ? '' : 'none';
    });
  }

  /* Un seul écouteur délégué par post : il survit aux repeintes (l'élément
     post n'est jamais remplacé, seulement son innerHTML). */
  function brancher(el) {
    el.addEventListener('click', function (ev) {
      var cible = ev.target;
      if (!cible || cible.nodeType !== 1) return;

      if (plusProche(cible, '.srp-ic')) return;              // lien du rp : suivre l'url
      if (plusProche(cible, '.srp-filtre-reset')) { reinitFiltre(); return; }
      var btn = plusProche(cible, '.sli-rpbtn');
      if (btn && btn.getAttribute('data-pseudo')) { voirRp(btn.getAttribute('data-pseudo')); return; }
      var tag = plusProche(cible, '.tdlrol-tags .tdlrol-tag');
      if (tag) {
        var wrap = plusProche(tag, '.tdlfl');
        if (wrap) filtrerTags(wrap, tag);
        return;
      }
      var line = plusProche(cible, '.srp-line');
      if (line) basculeRp(line.parentElement);
    });
  }

  /* --------------------------------------------------------------- AMORÇAGE */

  /* Posts porteurs d'un marqueur, hors déjà transformés. Scan maison,
     insensible à la casse (postsAvec est un indexOf strict). */
  function postsMarques() {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll(CFG.selecteurPost), function (el) {
      if (el.querySelector('.tdlfl')) return;
      if (!RE_UN_MARQUEUR.test(el.textContent)) return;
      out.push(el);
    });
    return out;
  }

  function peindre(r, ctx) {
    r.el.innerHTML = htmlPost(r.d, ctx);
    if (!r.branche) { brancher(r.el); r.branche = true; }
  }

  function demarrer() {
    var posts = postsMarques();
    if (!posts.length) return;

    var rendus = [];
    var rpsPage = [];   // rp fusionnés de toute la page (counts + filtre)

    posts.forEach(function (el) {
      var d = preparer(analysePost(T.texteBrut(el)));
      if (!d.recherches.length && !d.rps.length && !d.liens.length) {
        alerte('post marqué mais sans entrée exploitable — laissé tel quel');
        return;
      }
      rendus.push({ el: el, d: d, branche: false });
      rpsPage = rpsPage.concat(d.rps);
    });
    if (!rendus.length) return;

    /* 1. rendu immédiat (vignettes à initiales si la base tarde ou tombe) */
    var ctx = { rpsPage: rpsPage, avatars: null };
    rendus.forEach(function (r) { peindre(r, ctx); });

    /* 2. enrichissement : avatars du bottin, une seule lecture du nœud
          (promesse partagée du socle — déjà servie si l'arbre est passé) */
    T.litIndex(function (idx) {
      if (!idx) return;
      ctx.avatars = idx;
      rendus.forEach(function (r) { if (r.d.liens.length) peindre(r, ctx); });
    });
  }

  function diagnostic() {
    var C = window.console;
    C.log('--- TDLPL liens diagnostic ---');
    C.log('EcoCore présent :', !!(window.EcoCore && window.EcoCore.firebaseGet));
    C.log('visiteur        :', (window._userdata && _userdata.username) || 'invité');
    var posts = postsMarques();
    C.log('posts fiche     :', posts.length);
    var n = { rec: 0, rp: 0, lien: 0 };
    posts.forEach(function (el) {
      var d = analysePost(T.texteBrut(el));
      n.rec += d.recherches.length;
      n.rp += d.rps.length;
      n.lien += d.liens.length;
    });
    C.log('recherches / rp / liens :', n.rec, '/', n.rp, '/', n.lien);
  }

  T.pret(demarrer);

  window.TDLPL_LIENS = {
    relancer: demarrer,
    voirRp: voirRp,
    diagnostic: diagnostic
  };

})();
