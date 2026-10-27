/* === JAUGES DE TERREBONNE — CORE ===
   Auteur : Claude x THE DROWNED LANDS

   CE QUE CE FICHIER FAIT
     - CONFIG   : les trois jauges, leurs niveaux, et les réglages du moteur.
     - ÉTAT     : calcule l'état RÉEL d'une jauge à partir de ce qui est stocké
                  et de la date du jour — retour au calme et passage différé
                  compris. Toute page qui affiche une jauge passe par etat(),
                  pour que l'accueil, le panneau staff et la clôture d'un évent
                  montrent toujours le même niveau.
     - CALCULS  : verser() et regler() rendent le nouvel état à écrire, sans
                  rien écrire eux-mêmes. jauges-moteur.js les appelle DANS une
                  transaction ; la clôture d'un évent les appelle pour l'aperçu.

   CE QU'IL NE FAIT PAS : aucune lecture ni écriture Firebase, aucun DOM.

   FORME STOCKÉE : jauges/{clé} = {
     niveau, updated_at,  (inchangés)
     charge,              entier signé en points : > 0 côté aggravation,
                          < 0 côté apaisement. Jamais montré aux joueurs.
     calmeDepuis,         repère du retour au calme : remis à l'instant par
                          tout mouvement « aggrave », avancé d'une période à
                          chaque décrue appliquée.
     dernierPassage       dernier franchissement de niveau, pour le plafond.
   }
   Une jauge écrite avant le moteur n'a ni charge ni repère : charge 0, et
   updated_at sert de repère — le dernier réglage à la main.

   EXPOSE : window.TDLJauges
   DÉPENDANCES : aucune.

   CARTE DES BLOCS : CONFIG · NIVEAUX · OUTILS · ÉTAT · CALCULS · TEXTES
                     · FLATICON · TOOLTIP */

(function () {
  "use strict";

  window.TDLJauges = window.TDLJauges || {};
  var J = window.TDLJauges;

  /* ===================== CONFIG ===================== */

  /* [MAJ] Réglages du moteur. Les poids des évents sont exprimés en points
     sur cette base (tdlev-core et tdlev-sources) : changer POINTS_CRAN
     impose de revoir les poids. */
  J.MOTEUR = {
    POINTS_CRAN:   8,     /* un cran ; 1/8 de cran = 1 point             */
    JOURS_CALME:   28,    /* sans mouvement « aggrave » : un niveau de moins */
    JOURS_PLAFOND: 7,     /* un franchissement par jauge sur cette durée,
                             bascule et réglage direct exceptés          */
    JOURS_JOURNAL: 365    /* au-delà, les entrées du journal sont purgées */
  };

  J.KEYS = ["climat_social", "activite_clandestine", "pression_bayou"];

  /* ===================== NIVEAUX ===================== */

  J.CFG = {
    climat_social: {
      label  : "Climat Social",
      color  : "#C97F10",
      fbPath : "jauges/climat_social",
      niveaux: [
        { n: 1, label: "Harmonie relative",  desc: "La cohabitation est paisible entre les communautés." },
        { n: 2, label: "Murmures",           desc: "Des rumeurs et tensions commencent à circuler." },
        { n: 3, label: "Frictions",          desc: "Conflits locaux et rivalités visibles entre groupes." },
        { n: 4, label: "Crise sociale",      desc: "Manifestations, boycotts, sabotages des initiatives communautaires." },
        { n: 5, label: "Rupture",            desc: "Le conflit devient ouvert entre les communautés de Terrebonne." }
      ]
    },
    activite_clandestine: {
      label  : "Activité Clandestine",
      color  : "#8F565F",
      fbPath : "jauges/activite_clandestine",
      niveaux: [
        { n: 1, label: "Discrétion",              desc: "Les activités illégales sont rarement évoquées." },
        { n: 2, label: "Rumeurs",                 desc: "On parle d'activités clandestines proches de chez nous." },
        { n: 3, label: "Mouvement",               desc: "Les réseaux créent du remous, sentiment d'insécurité croissant." },
        { n: 4, label: "Escalade",                desc: "Actions et intimidations se multiplient ; le bureau du shérif est débordé." },
        { n: 5, label: "Guerre hors de l'ombre",  desc: "Les bandes en conflit agissent ouvertement dans Terrebonne." }
      ]
    },
    pression_bayou: {
      label  : "Pression du Bayou",
      color  : "#579C8E",
      fbPath : "jauges/pression_bayou",
      niveaux: [
        { n: 1, label: "Équilibre",          desc: "La région est stable." },
        { n: 2, label: "Instabilité",        desc: "Des tensions apparaissent à plusieurs niveaux." },
        { n: 3, label: "Pression",           desc: "Plusieurs crises s'accumulent dans la région." },
        { n: 4, label: "Tempête imminente",  desc: "La situation devient explosive ; une crise majeure approche." },
        { n: 5, label: "Ouragan",            desc: "Crise majeure touchant toute la paroisse de Terrebonne." }
      ]
    }
  };

  /* ===================== OUTILS ===================== */

  var JOUR = 86400000;
  function cran()    { return J.MOTEUR.POINTS_CRAN; }
  function calme()   { return J.MOTEUR.JOURS_CALME * JOUR; }
  function plafond() { return J.MOTEUR.JOURS_PLAFOND * JOUR; }

  function borne(n) { return Math.min(5, Math.max(1, n)); }
  /* une date ISO, un nombre ou rien → millisecondes, ou null */
  function ms(v) {
    if (v == null || v === "") return null;
    var t = (typeof v === "number") ? v : new Date(v).getTime();
    return isNaN(t) ? null : t;
  }
  function iso(t) { return (t == null) ? null : new Date(t).toISOString(); }

  /* Une jauge au bout de son échelle n'accumule plus de ce côté-là : rien
     au-dessus de 5, rien en dessous de 1. Une charge pleine attend au plus
     un cran, jamais davantage. */
  function saturer(s) {
    if (s.niveau >= 5 && s.charge > 0) s.charge = 0;
    if (s.niveau <= 1 && s.charge < 0) s.charge = 0;
    s.charge = Math.max(-cran(), Math.min(cran(), s.charge));
  }

  function lire(brut) {
    var b = brut || {};
    var s = {
      niveau:  borne(parseInt(b.niveau, 10) || 1),
      charge:  Math.round(+b.charge || 0),
      calme:   ms(b.calmeDepuis) != null ? ms(b.calmeDepuis) : ms(b.updated_at),
      passage: ms(b.dernierPassage)
    };
    saturer(s);
    return s;
  }

  function stocker(s, t) {
    return { niveau: s.niveau, charge: s.charge, calmeDepuis: iso(s.calme),
             dernierPassage: iso(s.passage), updated_at: iso(t) };
  }

  /* ===================== ÉTAT ===================== */

  /* Rejoue dans l'ordre chronologique ce qui s'est produit depuis la dernière
     écriture : passage différé d'une charge pleine (fin du plafond), et
     décrues successives (une par période sans aggravation). Les deux
     peuvent s'enchaîner : une décrue remet la charge à zéro, donc annule un
     passage qui n'avait pas encore eu lieu. */
  function avancer(s, t) {
    for (var garde = 0; garde < 40; garde++) {
      var tc = null, td = null;
      if (Math.abs(s.charge) >= cran())
        tc = (s.passage == null) ? t : s.passage + plafond();
      if (s.calme != null && (s.niveau > 1 || s.charge !== 0))
        td = s.calme + calme();

      var prochain = (tc != null && (td == null || tc <= td)) ? "passage" : (td != null ? "decrue" : null);
      var quand = prochain === "passage" ? tc : td;
      if (!prochain || quand > t) return s;

      if (prochain === "passage") {
        s.niveau = borne(s.niveau + (s.charge > 0 ? 1 : -1));
        s.charge = 0;
        s.passage = quand;
      } else {
        s.niveau = Math.max(1, s.niveau - 1);
        s.charge = 0;
        s.calme = td;
      }
      saturer(s);
    }
    return s;
  }

  /* État réel à l'instant `quand` (maintenant par défaut). */
  J.etat = function (brut, quand) {
    var t = ms(quand); if (t == null) t = Date.now();
    var s = avancer(lire(brut), t);
    var attente = Math.abs(s.charge) >= cran();
    return {
      niveau: s.niveau,
      charge: s.charge,
      attente: attente,
      /* le changement différé, quand la charge est pleine */
      passageLe: attente ? iso(s.passage + plafond()) : null,
      /* prochaine décrue si rien ne vient aggraver d'ici là */
      decrueLe: (s.calme != null && (s.niveau > 1 || s.charge !== 0)) ? iso(s.calme + calme()) : null,
      /* fin du plafond en cours, s'il y en a un */
      plafondJusqua: (s.passage != null && t - s.passage < plafond()) ? iso(s.passage + plafond()) : null
    };
  };

  /* ===================== CALCULS ===================== */

  /* m = { points, sens:"aggrave"|"apaise", bascule }
     Rend { avant, apres, franchi (-1|0|1), attente, passageLe, butee,
            points, sens, bascule, stocke } — stocke vaut null s'il n'y a
     rien à écrire (aucun poids, aucune bascule). */
  J.verser = function (brut, m, quand) {
    var t = ms(quand); if (t == null) t = Date.now();
    var s = avancer(lire(brut), t);
    var signe = (m && m.sens === "apaise") ? -1 : 1;
    var pts = Math.max(0, Math.round(+(m && m.points) || 0));
    var r = { avant: { niveau: s.niveau, charge: s.charge }, franchi: 0, attente: false,
              passageLe: null, butee: false, points: pts,
              sens: signe > 0 ? "aggrave" : "apaise", bascule: !!(m && m.bascule) };

    if (!r.bascule && !pts) { r.apres = r.avant; r.stocke = null; return r; }

    /* seule une aggravation relance le compte à rebours du retour au calme */
    if (signe > 0) s.calme = t;

    if (r.bascule) {
      var n = borne(s.niveau + signe);
      if (n === s.niveau) r.butee = true;
      else { r.franchi = signe; s.niveau = n; s.passage = t; }
      s.charge = 0;
    } else {
      s.charge += signe * pts;
      saturer(s);
      if (Math.abs(s.charge) >= cran()) {
        if (s.passage == null || t - s.passage >= plafond()) {
          r.franchi = s.charge > 0 ? 1 : -1;
          s.niveau = borne(s.niveau + r.franchi);
          s.charge = 0;                       /* le surplus est perdu */
          s.passage = t;
        } else {
          r.attente = true;                   /* différé, pas perdu */
          r.passageLe = iso(s.passage + plafond());
        }
      }
    }
    saturer(s);
    r.apres = { niveau: s.niveau, charge: s.charge };
    r.stocke = stocker(s, t);
    return r;
  };

  /* Réglage direct du panneau staff : un niveau, charge remise à zéro, hors
     plafond (le repère du plafond n'est pas touché). */
  J.regler = function (brut, delta, quand) {
    var t = ms(quand); if (t == null) t = Date.now();
    var s = avancer(lire(brut), t);
    var signe = delta > 0 ? 1 : -1;
    var r = { avant: { niveau: s.niveau, charge: s.charge }, points: 0,
              sens: signe > 0 ? "aggrave" : "apaise", bascule: false, attente: false };
    var n = borne(s.niveau + signe);
    r.franchi = n - s.niveau;
    r.butee = (r.franchi === 0);
    if (signe > 0) s.calme = t;
    s.niveau = n;
    s.charge = 0;
    r.apres = { niveau: s.niveau, charge: s.charge };
    r.stocke = stocker(s, t);
    return r;
  };

  /* ===================== TEXTES ===================== */

  function pgcd(a, b) { return b ? pgcd(b, a % b) : a; }

  /* 2 points → « 1/4 de cran » ; 8 → « 1 cran ». */
  J.fraction = function (points) {
    var p = Math.abs(Math.round(+points || 0)), c = cran();
    if (!p) return "aucun poids";
    if (p % c === 0) return (p / c) + (p / c > 1 ? " crans" : " cran");
    if (p * 2 === c) return "un demi-cran";
    var g = pgcd(p, c);
    return (p / g) + "/" + (c / g) + " de cran";
  };

  J.charge = function (charge) {
    if (!charge) return "charge neutre";
    return "charge de " + J.fraction(charge) + (charge > 0 ? " côté aggravation" : " côté apaisement");
  };

  function jour(isoD) {
    if (!isoD) return "";
    try { return new Date(isoD).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); }
    catch (e) { return String(isoD).slice(0, 10); }
  }
  J.jour = jour;

  function nomNiveau(cle, n) {
    var c = J.CFG[cle];
    return "niveau " + n + (c ? " (" + c.niveaux[n - 1].label + ")" : "");
  }

  /* Une phrase lisible par le staff, à partir d'un résultat de verser() ou
     de regler(). */
  J.decrire = function (cle, r) {
    var nom = (J.CFG[cle] || {}).label || cle;
    if (!r) return nom + " : rien ne bouge.";
    if (r.butee) return nom + " : déjà au " + nomNiveau(cle, r.avant.niveau) + ", la jauge ne peut pas aller plus loin.";
    if (r.franchi) return nom + " : passe du " + nomNiveau(cle, r.avant.niveau)
      + " au " + nomNiveau(cle, r.apres.niveau) + ".";
    if (r.attente) return nom + " : la charge est pleine, le niveau changera le "
      + jour(r.passageLe) + " (plafond hebdomadaire).";
    if (!r.points && !r.bascule) return nom + " : ce type d'évent ne pèse sur aucune jauge.";
    return nom + " : reste au " + nomNiveau(cle, r.apres.niveau) + ", " + J.charge(r.apres.charge) + ".";
  };

  /* ===================== FLATICON ===================== */
  /* Insère la feuille UIcons une seule fois dans <head>. */

  J.chargerFlaticon = function () {
    var CDN_ID  = "tdl-flaticon-css";
    var CDN_URL = "https://cdn-uicons.flaticon.com/2.6.0/uicons-solid-straight/css/uicons-solid-straight.css";
    if (document.getElementById(CDN_ID)) return;
    var link = document.createElement("link");
    link.id = CDN_ID; link.rel = "stylesheet"; link.href = CDN_URL;
    document.head.appendChild(link);
  };
  J.chargerFlaticon();

  /* ===================== TOOLTIP ===================== */
  /* HTML interne du tooltip d'un niveau. nActif : niveau réel de la jauge. */

  J.construireTooltip = function (key, n, nActif) {
    var cfg = J.CFG[key];
    var nDef = cfg.niveaux[n - 1];
    var fontTag = (n >= 4) ? "f4" : "f3";
    var iconActuel = (n === nActif)
      ? '<i class="fi fi-ss-map-marker tdl-tt-pin" style="color:' + cfg.color + '" aria-hidden="true"></i>'
      : "";
    return '<div class="tdl-tt-top">'
         +   '<span class="tdl-tt-niveau">[NIVEAU ' + n + ']</span>'
         +   '<' + fontTag + ' class="tdl-tt-label">' + nDef.label + '</' + fontTag + '>'
         +   iconActuel
         + '</div>'
         + '<div class="tdl-tt-desc">' + nDef.desc + '</div>';
  };

  console.log("[TDLJauges] Core chargé.");

})();
