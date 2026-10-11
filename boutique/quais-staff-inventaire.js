/*
 * quais-staff-inventaire.js — Onglet « Inventaires » du panel staff · TDL
 *
 * S'enregistre auprès de window.QuaisStaff (point d'extension de quais-staff).
 * Permet au staff de consulter l'inventaire d'un membre, d'y ajouter ou d'en
 * retirer un objet, de lever un sort subi, et de restaurer un objet consommé
 * par un envoi de message qui a échoué.
 *
 * POURQUOI CET ONGLET EXISTE — les six objets du Bayou s'achètent et se
 *   consomment sans passer par le staff. Il n'y a donc aucune file où rattraper
 *   une erreur : ni un ciblage malheureux, ni un submit perdu, ni un lot d'évent
 *   à distribuer. C'est le seul endroit où l'inventaire se corrige à la main.
 *
 * TOUT GESTE EST TRACÉ dans consommations, avec r:"staff" et le pseudo de qui
 *   l'a fait. Sans ça, personne ne saura jamais pourquoi un joueur a trois
 *   amulettes.
 *
 * RESTAURATION : les consommations des 30 derniers jours seulement. Au-delà,
 *   restaurer un objet n'a plus de sens narratif — la scène est jouée.
 * PURGE : les entrées de plus de 90 jours sont effacées à l'ouverture de
 *   l'onglet, par paquets. Le nœud est lu en entier à chaque fois : sans purge
 *   il grossirait indéfiniment pour un journal que personne ne relit.
 *
 * DÉPEND DE : window.QuaisStaff (api, onglets, vues), window.EcoCore
 *   (firebaseGet, firebaseUpdate), window.TDLBase (nouvelleCle, membres),
 *   window.TDLObjets (table OBJETS).
 * À CHARGER : après quais-staff.js et tdl-objets.js.
 */
(function () {
  "use strict";

  var QS = (window.QuaisStaff = window.QuaisStaff || { onglets: [], vues: {} });

  /* ===================== CONFIG ===================== */

  var CFG = {
    CLE:           "inventaires",
    NODE_MEMBRES:  "membres",
    SOUS_INV:      "inventaire",
    NODE_JOURNAL:  "consommations",
    JOURS_RESTAURE: 30,
    JOURS_PURGE:    90,
    PURGE_MAX:      200      /* par passage : un PATCH énorme serait refusé */
  };

  var TEXTES = {
    ONGLET:     "Inventaires",
    SOUS:       "Inventaire d'un membre. Tout geste est inscrit au journal, avec votre pseudo.",
    CHOISIR:    "Choisir un membre",
    CHARGE:     "Lecture de l'inventaire…",
    VIDE:       "Inventaire vide.",
    POSSEDE:    "Objets possédés",
    SUBI:       "Sorts subis",
    AJOUT:      "Ajouter un objet",
    AJOUTER:    "Ajouter",
    OBJET:      "Objet",
    CHARGES:    "Charges",
    LIEU:       "Lieu (purification seulement)",
    RETIRER:    "Retirer",
    LEVER:      "Lever le sort",
    JOURNAL:    "Journal des 30 derniers jours",
    JOURNAL_V:  "Aucun mouvement sur les trente derniers jours.",
    RESTAURER:  "Restaurer",
    RESTAURE:   "Restauré",
    EXPIRE:     "expire le",
    RECU:       "reçu le",
    OBTENU:     "obtenu le",
    C_RETIRER:  function (n, p) { return "Retirer « " + n + " » de l'inventaire de " + p + " ?"; },
    C_LEVER:    function (n, p) { return "Lever « " + n + " » qui frappe " + p + " ? L'objet disparaît de son inventaire."; },
    C_RESTAURE: function (n, p) { return "Rendre « " + n + " » à " + p + " ?"; },
    ERR:        "Opération impossible.",
    ERR_LIRE:   "Lecture impossible.",
    R: { use:"Utilisé", leve:"Sort levé", achat:"Acheté", staff:"Geste du staff" }
  };

  /* ===================== UTILS ===================== */

  var A = null;                       /* helpers de quais-staff */
  var st = { pseudo: "", inv: [], conso: [], charge: false, erreur: "" };

  function E() { return window.EcoCore; }
  function B() { return window.TDLBase; }
  function esc(s) { return A.esc(s); }
  function table() { return (window.TDLObjets && window.TDLObjets.OBJETS) || {}; }
  function meta(o) { return table()[o] || { n: o, ic: "box-open" }; }
  function moi() { var u = window._userdata; return (u && u.username) ? String(u.username) : "staff"; }

  function versListe(src) {
    if (!src) return [];
    var out = [];
    if (Array.isArray(src)) { src.forEach(function (v, i) { if (v) out.push({ k: String(i), d: v }); }); return out; }
    Object.keys(src).forEach(function (k) { if (src[k]) out.push({ k: k, d: src[k] }); });
    return out;
  }

  function jourFR(iso) {
    if (!iso) return "—";
    var p = String(iso).slice(0, 10).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
  }

  function depuisJours(n) { return new Date(Date.now() - n * 86400000).toISOString(); }

  /* ===================== LECTURE ===================== */

  /* Le journal est lu en entier : il est petit, et le filtrer côté serveur
     demanderait un index que Firebase n'a pas ici. La purge le garde petit. */
  function charger(pseudo) {
    st.pseudo = pseudo; st.charge = true; st.erreur = ""; st.inv = []; st.conso = [];
    A.render();
    return Promise.all([
      E().firebaseGet(CFG.NODE_MEMBRES + "/" + encodeURIComponent(pseudo) + "/" + CFG.SOUS_INV),
      E().firebaseGet(CFG.NODE_JOURNAL)
    ]).then(function (r) {
      st.inv = versListe(r[0]);
      var limite = depuisJours(CFG.JOURS_RESTAURE);
      st.conso = versListe(r[1])
        .filter(function (x) { return x.d.p === pseudo && String(x.d.t || "") >= limite; })
        .sort(function (a, b) { return String(b.d.t || "").localeCompare(String(a.d.t || "")); });
      st.charge = false;
      A.render();
      return purger(r[1]);
    }).catch(function (e) {
      st.charge = false; st.erreur = TEXTES.ERR_LIRE;
      if (window.console) console.warn("[quais-staff-inventaire] lecture", e);
      A.render();
    });
  }

  /* Purge silencieuse : elle ne doit jamais faire échouer l'affichage. */
  function purger(journal) {
    var limite = depuisJours(CFG.JOURS_PURGE), patch = {}, n = 0;
    versListe(journal).forEach(function (x) {
      if (n >= CFG.PURGE_MAX) return;
      if (String(x.d.t || "") < limite) { patch[CFG.NODE_JOURNAL + "/" + x.k] = null; n++; }
    });
    if (!n) return Promise.resolve();
    return Promise.resolve(E().firebaseUpdate(patch)).catch(function (e) {
      if (window.console) console.warn("[quais-staff-inventaire] purge", e);
    });
  }

  /* ===================== ÉCRITURES ===================== */

  function tracer(patch, o, raison, detail) {
    patch[CFG.NODE_JOURNAL + "/" + B().nouvelleCle()] = {
      p: st.pseudo, o: o, r: "staff", geste: raison,
      par: moi(), detail: detail || "", t: new Date().toISOString()
    };
  }

  function chemin(cle) {
    /* chemin BRUT : firebaseUpdate est un PATCH à la racine */
    return CFG.NODE_MEMBRES + "/" + st.pseudo + "/" + CFG.SOUS_INV + "/" + cle;
  }

  function appliquer(patch) {
    return Promise.resolve(E().firebaseUpdate(patch))
      .then(function () { return charger(st.pseudo); })
      .catch(function (e) {
        if (window.console) console.error("[quais-staff-inventaire]", e);
        alert(TEXTES.ERR);
      });
  }

  function ajouter(o, ch, lieu) {
    if (!o || !table()[o]) return;
    var patch = {}, e = { o: o, src: "staff", t: new Date().toISOString().slice(0, 10), st: "actif", ch: ch || 1 };
    if (lieu) e.lieu = lieu;
    patch[chemin(B().nouvelleCle())] = e;
    tracer(patch, o, "ajout", lieu || "");
    return appliquer(patch);
  }

  function retirer(x, leve) {
    var m = meta(x.d.o);
    if (!confirm((leve ? TEXTES.C_LEVER : TEXTES.C_RETIRER)(m.n, st.pseudo))) return;
    var patch = {};
    patch[chemin(x.k)] = null;
    tracer(patch, x.d.o, leve ? "levee" : "retrait", "");
    return appliquer(patch);
  }

  /* Restauration : on recrée l'objet ET on marque la consommation, sinon le
     même incident serait réparé deux fois par deux membres du staff. */
  function restaurer(x) {
    var m = meta(x.d.o);
    if (!confirm(TEXTES.C_RESTAURE(m.n, st.pseudo))) return;
    var patch = {};
    patch[chemin(B().nouvelleCle())] = { o: x.d.o, src: x.d.src || "staff", t: new Date().toISOString().slice(0, 10), st: "actif", ch: 1 };
    patch[CFG.NODE_JOURNAL + "/" + x.k + "/rest"] = new Date().toISOString();
    patch[CFG.NODE_JOURNAL + "/" + x.k + "/rest_par"] = moi();
    tracer(patch, x.d.o, "restauration", x.k);
    return appliquer(patch);
  }

  /* ===================== RENDER ===================== */

  function selMembres() {
    var noms = st.noms || [];
    return '<select class="qsi-pseudo"><option value="">' + esc(TEXTES.CHOISIR) + '</option>'
      + noms.map(function (p) { return '<option value="' + esc(p) + '"' + (p === st.pseudo ? " selected" : "") + '>' + esc(p) + '</option>'; }).join("")
      + '</select>';
  }

  function ligneObjet(x, subi) {
    var m = meta(x.d.o), d = x.d;
    var detail = subi
      ? (TEXTES.RECU + " " + jourFR(d.t) + (d.exp ? " · " + TEXTES.EXPIRE + " " + jourFR(d.exp) : "") + (d.por ? " · " + esc(d.por) : ""))
      : (TEXTES.OBTENU + " " + jourFR(d.t) + (d.lieu ? " · " + d.lieu : "") + (d.ch > 1 ? " · " + d.ch + " charges" : ""));
    return '<div class="qsd-drow"><span class="qsd-st qsd-st-' + (subi ? "refusee" : "validee") + '">'
      + '<i class="fi fi-sr-' + esc(m.ic) + '"></i> ' + esc(m.n) + '</span>'
      + '<div class="m">' + esc(detail) + '</div>'
      + '<button class="' + (subi ? "dc-btn-valider" : "qsd-btn") + '" data-inv="' + esc(x.k) + '" data-leve="' + (subi ? "1" : "") + '">'
      + esc(subi ? TEXTES.LEVER : TEXTES.RETIRER) + '</button></div>';
  }

  function blocAjout() {
    var opts = Object.keys(table()).map(function (o) {
      return '<option value="' + esc(o) + '">' + esc(meta(o).n) + '</option>';
    }).join("");
    return '<div class="qsd-grp"><div class="qsd-grphead"><span class="nom">' + esc(TEXTES.AJOUT) + '</span></div>'
      + '<div class="fi-carte-grille">'
      + '<span>' + esc(TEXTES.OBJET) + '</span><span><select class="qsi-objet">' + opts + '</select></span>'
      + '<span>' + esc(TEXTES.CHARGES) + '</span><span><input class="qsi-ch" type="number" min="1" max="9" value="1"></span>'
      + '<span>' + esc(TEXTES.LIEU) + '</span><span><input class="qsi-lieu" type="text"></span>'
      + '</div><div class="dc-staff-actions"><button class="dc-btn-valider qsi-ajouter">' + esc(TEXTES.AJOUTER) + '</button></div></div>';
  }

  function ligneConso(x) {
    var m = meta(x.d.o), d = x.d;
    var quoi = TEXTES.R[d.r] || d.r || "—";
    if (d.geste) quoi += " · " + d.geste;
    var bouton = (d.r === "use" || d.r === "leve")
      ? (d.rest ? '<span class="qsd-st qsd-st-traitee">' + esc(TEXTES.RESTAURE) + '</span>'
                : '<button class="qsd-btn" data-conso="' + esc(x.k) + '">' + esc(TEXTES.RESTAURER) + '</button>')
      : "";
    return '<div class="qsd-drow"><span class="qsd-st qsd-st-en_attente">' + esc(quoi) + '</span>'
      + '<div class="m">' + esc(m.n) + (d.s ? " — " + esc(d.s) : "") + (d.par ? " — " + esc(d.par) : "") + '</div>'
      + '<span class="dt">' + esc(A.dateFr(d.t)) + '</span>' + bouton + '</div>';
  }

  function html(titre) {
    var entete = '<section class="sj-fiche"><div class="mc-sec-head"><h2>' + esc(titre) + '</h2>'
      + '<span class="mc-cpt">' + (st.pseudo ? st.inv.length : 0) + '</span></div>'
      + '<p class="mc-sub">' + esc(TEXTES.SOUS) + '</p>'
      + '<div class="qsi-barre">' + selMembres() + '</div>';

    if (st.erreur) return entete + '<p class="mc-sub">' + esc(st.erreur) + '</p></section>';
    if (!st.pseudo) return entete + '</section>';
    if (st.charge) return entete + '<p class="mc-sub">' + esc(TEXTES.CHARGE) + '</p></section>';

    var possedes = st.inv.filter(function (x) { return x.d.st !== "subi"; });
    var subis = st.inv.filter(function (x) { return x.d.st === "subi"; });

    var corps = '<div class="qsd-grp"><div class="qsd-grphead"><span class="nom">' + esc(TEXTES.POSSEDE) + '</span>'
      + '<span class="n">' + possedes.length + '</span></div>'
      + (possedes.length ? possedes.map(function (x) { return ligneObjet(x, false); }).join("")
                         : '<p class="mc-sub">' + esc(TEXTES.VIDE) + '</p>') + '</div>';

    if (subis.length) {
      corps += '<div class="qsd-grp"><div class="qsd-grphead"><span class="nom">' + esc(TEXTES.SUBI) + '</span>'
        + '<span class="n">' + subis.length + '</span></div>'
        + subis.map(function (x) { return ligneObjet(x, true); }).join("") + '</div>';
    }

    corps += blocAjout();
    corps += '<div class="qsd-grp"><div class="qsd-grphead"><span class="nom">' + esc(TEXTES.JOURNAL) + '</span>'
      + '<span class="n">' + st.conso.length + '</span></div>'
      + (st.conso.length ? st.conso.map(ligneConso).join("")
                         : '<p class="mc-sub">' + esc(TEXTES.JOURNAL_V) + '</p>') + '</div>';

    return entete + corps + '</section>';
  }

  /* ===================== WIRING ===================== */

  function wire(root) {
    var sel = root.querySelector(".qsi-pseudo");
    if (sel) sel.onchange = function () { if (sel.value) charger(sel.value); };

    Array.prototype.forEach.call(root.querySelectorAll("[data-inv]"), function (b) {
      b.onclick = function () {
        var x = st.inv.filter(function (y) { return y.k === b.getAttribute("data-inv"); })[0];
        if (x) retirer(x, !!b.getAttribute("data-leve"));
      };
    });

    Array.prototype.forEach.call(root.querySelectorAll("[data-conso]"), function (b) {
      b.onclick = function () {
        var x = st.conso.filter(function (y) { return y.k === b.getAttribute("data-conso"); })[0];
        if (x) restaurer(x);
      };
    });

    var add = root.querySelector(".qsi-ajouter");
    if (add) add.onclick = function () {
      var o = root.querySelector(".qsi-objet").value;
      var ch = parseInt(root.querySelector(".qsi-ch").value, 10) || 1;
      var lieu = root.querySelector(".qsi-lieu").value.trim();
      ajouter(o, ch, lieu);
    };
  }

  /* ===================== ENREGISTREMENT ===================== */

  function demarrer() {
    A = QS.api;
    QS.onglets.push([CFG.CLE, TEXTES.ONGLET]);
    QS.vues[CFG.CLE] = { html: html, wire: wire, compte: function () { return st.pseudo ? st.inv.length : 0; } };
    /* la liste des pseudos vient du socle, déjà chargée pour les dettes */
    Promise.resolve(B().membres()).then(function (m) {
      st.noms = Object.keys(m || {}).sort(function (a, b) { return String(a).localeCompare(String(b), "fr"); });
    }).catch(function () { st.noms = []; });
  }

  (function attendre(n) {
    if (QS.api && window.TDLBase && window.EcoCore) { demarrer(); return; }
    if ((n || 0) < 100) setTimeout(function () { attendre((n || 0) + 1); }, 300);
  })();

})();
