/*
 * tdl-inventaire.js — Rendu de l'inventaire sur le profil · TDL
 *
 * Remplace le contenu du champ profil .field-inventaire par une grille de
 * pastilles-icônes. Détail au CLIC, dans une infobulle reparentée sur
 * document.body (les contextes d'empilement FA coupent un position:fixed
 * monté dans le profil).
 *
 * SOURCE : membres/{pseudo}/inventaire/{id}, lu HORS CACHE (lireFrais) — un
 *   dépôt venu d'un autre onglet ne doit pas être masqué par un instantané.
 *   Le pseudo du profil visité est résolu par uid_index/{uid} depuis l'URL /u{n},
 *   comme le fait eco-ui pour le solde.
 *
 * PURGE PARESSEUSE : une entrée dont exp est dépassée est masquée pour tout le
 *   monde, mais n'est EFFACÉE que lorsque le propriétaire regarde son propre
 *   profil — écrire dans l'inventaire d'autrui en simple lecture serait une
 *   écriture non sollicitée, et deux visiteurs simultanés se marcheraient dessus.
 *
 * DÉPEND DE : window.EcoCore (firebaseGet, lireFrais, firebaseUpdate).
 * À CHARGER : après eco-core.js. CSS : CSS-inventaire.css.
 */
(function () {
  "use strict";
  if (!window.EcoCore) { if (window.console) console.warn("[tdl-inventaire] eco-core absent."); return; }

  /* ===================== CONFIG ===================== */

  var SEL = {
    /* [MAJ] champ profil FA qui accueille la grille */
    CHAMP: ".sj-prinventory .field-inventaire",
    /* [MAJ] valeur affichée du champ texte, à vider */
    VALEUR: ".field_uneditable"
  };

  var OBJETS = (window.TDLObjets && window.TDLObjets.OBJETS) || {};

  var NODE = "membres";
  var SOUS = "inventaire";

  var FALLBACK_IC = "box-open";

  var PORTEES = {
    courants: "Sujets en cours, hors intrigue et événement",
    tous:     "Tous sujets confondus"
  };

  var TEXTES = {
    VIDE:        "Inventaire vide.",
    ERREUR:      "Inventaire indisponible.",
    OBTENU:      "Obtenu le",
    SUBI:        "Reçu le",
    CHARGES:     "Charges",
    EXPIRE:      "Jusqu'au",
    PORTEE:      "Portée",
    LIEU:        "Lieu protégé",
    DE:          "Résultat du dé",
    SOURCE:      "Origine inconnue",
    FERMER:      "Fermer"
  };

  /* Libellés du d4, alignés sur ceux de la boutique. */
  var DES = {
    effigie: { 1: "Complication sérieuse", 2: "Complication légère", 3: "Complication légère", 4: "Rien" },
    purif:   { 1: "Protection totale", 2: "Protection partielle", 3: "Protection partielle", 4: "Protection symbolique" }
  };

  /* ===================== UTILS ===================== */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function enc(s) { return encodeURIComponent(String(s == null ? "" : s)); }

  /* Firebase rend un nœud à clés numériques contiguës comme un TABLEAU creux
     (null à l'indice 0) : on filtre avant d'itérer. */
  function versListe(src) {
    if (!src) return [];
    var out = [];
    if (Array.isArray(src)) {
      src.forEach(function (v, i) { if (v) out.push({ _k: String(i), d: v }); });
      return out;
    }
    Object.keys(src).forEach(function (k) { if (src[k]) out.push({ _k: k, d: src[k] }); });
    return out;
  }

  function aujourdhui() { return new Date().toISOString().slice(0, 10); }

  function expiree(e) { return !!(e.exp && e.exp < aujourdhui()); }

  function jourFR(iso) {
    if (!iso) return "—";
    var p = String(iso).slice(0, 10).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
  }

  function meta(e) {
    var o = OBJETS[e.o] || {};
    return {
      nom: o.n || e.o || "Objet",
      amb: o.amb || "",
      ic: e.ic || o.ic || FALLBACK_IC,
      subi: e.st === "subi"
    };
  }

  function moi() {
    /* [MAJ] pseudo du visiteur, fourni par ForumActif */
    var u = window._userdata;
    return (u && u.username) ? String(u.username) : "";
  }

  function pseudoDuProfil() {
    var m = location.pathname.match(/^\/u(\d+)/);
    if (!m) return Promise.resolve("");
    return Promise.resolve(window.EcoCore.firebaseGet("uid_index/" + m[1]))
      .then(function (p) { return p || ""; })
      .catch(function () { return ""; });
  }

  /* ===================== RENDER ===================== */

  var bulle = null;

  function fermerBulle() {
    if (bulle) { bulle.remove(); bulle = null; }
  }

  function ligne(l, v) {
    return '<span class="tdli-l">' + esc(l) + '</span><span class="tdli-v">' + esc(v) + '</span>';
  }

  function corpsBulle(e) {
    var m = meta(e), out = "";
    out += '<p class="tdli-nom">' + esc(m.nom) + '</p>';
    if (m.amb) out += '<p class="tdli-amb">' + esc(m.amb) + '</p>';
    out += '<div class="tdli-grid">';
    out += ligne(m.subi ? TEXTES.SUBI : TEXTES.OBTENU, jourFR(e.t));
    if (e.de && DES[e.src]) out += ligne(TEXTES.DE, DES[e.src][e.de] || String(e.de));
    if (e.por) out += ligne(TEXTES.PORTEE, PORTEES[e.por] || e.por);
    if (e.exp) out += ligne(TEXTES.EXPIRE, jourFR(e.exp));
    if (e.lieu) out += ligne(TEXTES.LIEU, e.lieu);
    if (!m.subi && e.ch != null) out += ligne(TEXTES.CHARGES, String(e.ch));
    out += '</div>';
    return out;
  }

  function ouvrirBulle(e, ancre) {
    fermerBulle();
    var b = document.createElement("div");
    b.className = "tdli-bulle" + (meta(e).subi ? " tdli-bulle-subi" : "");
    b.innerHTML = '<button class="tdli-x" type="button" aria-label="' + esc(TEXTES.FERMER) + '">&times;</button>'
                + corpsBulle(e);
    document.body.appendChild(b);        /* hors du profil : FA piège le fixed */
    bulle = b;

    var r = ancre.getBoundingClientRect();
    var larg = b.offsetWidth, haut = b.offsetHeight;
    var x = Math.min(Math.max(8, r.left + r.width / 2 - larg / 2), window.innerWidth - larg - 8);
    var y = (r.top - haut - 10 < 8) ? (r.bottom + 10) : (r.top - haut - 10);
    b.style.left = Math.round(x) + "px";
    b.style.top = Math.round(y) + "px";

    b.querySelector(".tdli-x").addEventListener("click", fermerBulle);
  }

  function pastille(entree) {
    var e = entree.d, m = meta(e);
    var s = document.createElement("button");
    s.type = "button";
    s.className = "tdli-case" + (m.subi ? " tdli-subi" : "");
    s.setAttribute("aria-label", m.nom);
    s.innerHTML = '<i class="fi fi-sr-' + esc(m.ic) + '"></i>';
    s.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (bulle && bulle.dataset.k === entree._k) { fermerBulle(); return; }
      ouvrirBulle(e, s);
      if (bulle) bulle.dataset.k = entree._k;
    });
    return s;
  }

  function rendre(hote, liste) {
    hote.innerHTML = "";
    if (!liste.length) {
      hote.innerHTML = '<p class="tdli-vide">' + esc(TEXTES.VIDE) + '</p>';
      return;
    }
    var g = document.createElement("div");
    g.className = "tdli-grille";
    liste.forEach(function (entree) { g.appendChild(pastille(entree)); });
    hote.appendChild(g);
  }

  /* ===================== INIT ===================== */

  function hote() {
    var champ = document.querySelector(SEL.CHAMP);
    if (!champ) return null;
    var v = champ.querySelector(SEL.VALEUR);
    var cible = v || champ;
    cible.classList.add("tdli-hote");
    return cible;
  }

  /* Efface les entrées périmées, et seulement chez leur propriétaire. */
  function purger(pseudo, perimees) {
    if (!perimees.length || pseudo !== moi()) return Promise.resolve();
    var patch = {};
    perimees.forEach(function (x) {
      /* chemin BRUT : firebaseUpdate est un PATCH à la racine */
      patch[NODE + "/" + pseudo + "/" + SOUS + "/" + x._k] = null;
    });
    return Promise.resolve(window.EcoCore.firebaseUpdate(patch)).catch(function (err) {
      if (window.console) console.warn("[tdl-inventaire] purge impossible :", err);
    });
  }

  function demarrer() {
    var h = hote();
    if (!h) return;
    pseudoDuProfil().then(function (pseudo) {
      if (!pseudo) { rendre(h, []); return; }
      return Promise.resolve(window.EcoCore.lireFrais(NODE + "/" + enc(pseudo) + "/" + SOUS))
        .then(function (src) {
          var tout = versListe(src);
          var perimees = tout.filter(function (x) { return expiree(x.d); });
          var vivantes = tout.filter(function (x) { return !expiree(x.d); });
          vivantes.sort(function (a, b) { return String(b.d.t || "").localeCompare(String(a.d.t || "")); });
          rendre(h, vivantes);
          return purger(pseudo, perimees);
        });
    }).catch(function (err) {
      if (window.console) console.warn("[tdl-inventaire] lecture impossible :", err);
      h.innerHTML = '<p class="tdli-vide">' + esc(TEXTES.ERREUR) + '</p>';
    });
  }

  /* ===================== EVENTS ===================== */

  document.addEventListener("click", function (ev) {
    if (bulle && !bulle.contains(ev.target)) fermerBulle();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") fermerBulle();
  });
  window.addEventListener("resize", fermerBulle);
  window.addEventListener("scroll", fermerBulle, true);

  /* DOMContentLoaded part trop tôt sur FA : on attend load. */
  if (document.readyState === "complete") demarrer();
  else window.addEventListener("load", demarrer);

  window.TDLInventaire = { rafraichir: demarrer };

})();
