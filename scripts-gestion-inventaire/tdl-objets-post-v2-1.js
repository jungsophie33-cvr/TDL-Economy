/*
 * tdl-objets-post.js — Utiliser un objet depuis le formulaire de post · TDL
 *
 * Ajoute un bouton « Utiliser un objet » au-dessus du champ de rédaction.
 * Le joueur choisit dans son inventaire ; un bloc SOS est inséré dans le
 * message, et l'objet n'est consommé QU'À L'ENVOI du formulaire.
 *
 * [MAJ v4] LE SCRIPT N'ABANDONNE PLUS SI EcoCore MANQUE AU DÉMARRAGE. Sur la
 *   page /post, l'ordre de chargement n'est pas celui d'une page de sujet :
 *   un return sec en tête de fichier tuait le module avant même qu'il cherche
 *   l'éditeur. Le bouton se monte maintenant quoi qu'il arrive, et c'est à
 *   l'ouverture du panneau qu'on attend le socle — avec un message clair s'il
 *   ne vient jamais, au lieu d'un bouton muet.
 *
 * [MAJ v4] POINTS D'ACCROCHE. Page pleine (nouveau sujet, réponse complète) :
 *   l'éditeur vit dans #message-box. Réponse rapide : .sceditor-container.
 *   Sans sceditor : le textarea nu. On essaie les trois dans cet ordre, et le
 *   formulaire est retrouvé par closest(), puis par le document, puis par la
 *   propriété form du champ — FA ne nomme pas toujours son formulaire pareil.
 *
 * [MAJ v3] LEVÉE D'EFFIGIE. Un objet marqué  leve:true  (le dollar porte-
 *   bonheur) ouvre une étape de plus quand le joueur porte une effigie subie :
 *   lever ce sort, ou se protéger d'autre chose. La levée efface l'effigie
 *   dans le MÊME PATCH que la consommation de la protection.
 *   Ce n'est pas rétroactif : ce qui a déjà été joué reste joué, le bloc le dit.
 *
 * [MAJ v2] ON N'ÉCRIT PLUS DANS LE TEXTAREA D'ORIGINE : sceditor le masque et
 *   travaille dans une iframe (WYSIWYG) ou son propre textarea (mode source).
 *   Le bloc existe donc en deux sérialisations, <br> et \n, que le parseur SOS
 *   normalise de la même façon.
 *
 * POURQUOI CONSOMMER À L'ENVOI — insérer le bloc ne prouve rien : un message
 *   abandonné brûlerait l'objet. On intercepte le clic sur « Envoyer », on
 *   écrit, puis on relance l'envoi, en bornant l'attente.
 *
 * DÉPEND DE : window.EcoCore (lireFrais, firebaseUpdate), window.TDLBase
 *   (nouvelleCle) et window.TDLObjets (table OBJETS).
 * À CHARGER : après eco-core, tdl-base et tdl-objets. CSS : CSS-objets-post.css.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */

  var SEL = {
    /* [MAJ] page de post complète : conteneur de l'éditeur */
    BOITE:    "#message-box",
    /* [MAJ] réponse rapide : conteneur sceditor */
    EDITEUR:  ".sceditor-container",
    /* [MAJ] champ d'origine — secours, et repli si sceditor est absent */
    TEXTAREA: 'textarea[name="message"]',
    /* [MAJ] formulaire et bouton d'envoi : FA poste la valeur du bouton */
    FORM:     'form[name="post"]',
    ENVOI:    'input[name="post"]',
    /* [MAJ] gabarit TDL : un message et le lien profil de son auteur */
    POST:     ".sj-postmsg",
    AUTEUR:   'a[href^="/u"]'
  };

  var CFG = {
    NODE_MEMBRES: "membres",
    SOUS_INV:     "inventaire",
    NODE_JOURNAL: "consommations",
    MAX_PAGES:    3,       /* 75 messages : au-delà, on s'en tient à ce qu'on a */
    DELAI_MS:     4000,    /* au-delà, le message part sans attendre l'écriture */
    SCANS:        20,      /* repasses à la recherche de l'éditeur */
    SCAN_MS:      400,
    SOCLE_MS:     300,     /* cadence d'attente d'EcoCore */
    SOCLE_MAX:    20       /* 6 s, puis on le dit */
  };

  var TEXTES = {
    BOUTON:     "Utiliser un objet",
    TITRE:      "Votre inventaire",
    VIDE:       "Aucun objet utilisable.",
    FERMER:     "Fermer",
    CHARGE:     "Lecture de l'inventaire…",
    INSERE:     "Déclaration insérée dans le message. L'objet sera consommé à l'envoi.",
    DEJA:       "Un objet est déjà déclaré dans ce message.",
    ERREUR:     "Inventaire indisponible.",
    SANS_SOCLE: "Inventaire injoignable sur cette page. Rechargez, ou passez par la réponse rapide.",
    ECHEC:      "Insertion impossible : cliquez d'abord dans le champ de rédaction.",
    SANS_LISTE: "participants du sujet au moment de l'usage",
    USAGE:      "À quoi sert cette protection ?",
    LEVER:      "Lever ce sort",
    AUTRE:      "Protéger d'autre chose",
    AUTRE_D:    "Un événement défavorable que vous annoncez dans ce message.",
    RECUE:      "reçue le",
    RETOUR:     "Retour",
    NON_RETRO:  "Le sort est levé à compter de ce message ; ce qui a déjà été joué reste joué."
  };

  var EN_ATTENTE = null;   /* { cle, o, src, ch, leveCle } — déclaré, pas consommé */
  var INVENTAIRE = [];     /* dernier inventaire lu, objets subis compris */

  /* ===================== UTILS ===================== */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  function moi() {
    var u = window._userdata;
    return (u && u.username) ? String(u.username) : "";
  }

  function E() { return window.EcoCore; }

  /* Le socle peut arriver après nous sur /post : on l'attend au lieu de
     désactiver le module pour toute la page. */
  function socle(n) {
    n = n || 0;
    if (E() && E().lireFrais && E().firebaseUpdate) return Promise.resolve(E());
    if (n > CFG.SOCLE_MAX) return Promise.reject(new Error("ECO"));
    return new Promise(function (r) { setTimeout(r, CFG.SOCLE_MS); })
      .then(function () { return socle(n + 1); });
  }

  function table() { return (window.TDLObjets && window.TDLObjets.OBJETS) || {}; }

  function meta(o) { return table()[o] || { n: o, ic: "box-open", eff: "" }; }

  function jourFR(iso) {
    if (!iso) return "";
    var p = String(iso).slice(0, 10).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
  }

  function versListe(src) {
    if (!src) return [];
    var out = [];
    if (Array.isArray(src)) { src.forEach(function (v, i) { if (v) out.push({ _k: String(i), d: v }); }); return out; }
    Object.keys(src).forEach(function (k) { if (src[k]) out.push({ _k: k, d: src[k] }); });
    return out;
  }

  function sujetId() {
    var m = location.search.match(/[?&]t=(\d+)/);
    return m ? m[1] : "";
  }

  function subis() {
    return INVENTAIRE.filter(function (x) { return x.d && x.d.st === "subi"; });
  }

  function utilisable(x) {
    return x.d && x.d.st !== "subi" && table()[x.d.o];
  }

  /* ===================== BÉNÉFICIAIRES ===================== */

  /* Relève les auteurs du sujet, page après page, en s'arrêtant tôt. Un échec
     n'empêche pas l'usage : le bloc le dit alors en toutes lettres. */
  function beneficiaires() {
    var t = sujetId();
    if (!t) return Promise.resolve([]);
    var noms = [], vus = {};

    function page(n) {
      var url = "/t" + t + (n ? "p" + (n * 25) : "");
      return fetch(url, { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.text() : ""; })
        .then(function (html) {
          if (!html) return false;
          var doc = new DOMParser().parseFromString(html, "text/html");
          var posts = doc.querySelectorAll(SEL.POST);
          if (!posts.length) return false;
          Array.prototype.forEach.call(posts, function (p) {
            var a = p.querySelector(SEL.AUTEUR);
            var nom = a ? String(a.textContent || "").trim() : "";
            if (nom && !vus[nom]) { vus[nom] = 1; noms.push(nom); }
          });
          return posts.length >= 25;    /* page pleine : il y en a peut-être une autre */
        })
        .catch(function () { return false; });
    }

    function suite(n) {
      if (n >= CFG.MAX_PAGES) return Promise.resolve(noms);
      return page(n).then(function (encore) { return encore ? suite(n + 1) : noms; });
    }
    return suite(0);
  }

  /* ===================== BLOC SOS ===================== */

  function bloc(e, benef, leve) {
    var m = meta(e.o);
    var l = ["--- BLOC objet ---", "ARTICLE: " + m.art, "OBJET: " + e.o];
    if (m.eff) l.push("EFFET: " + m.eff);
    if (e.lieu) l.push("LIEU: " + e.lieu);
    if (e.de) l.push("DE: " + e.de);
    if (m.collectif) l.push("BENEFICIAIRES: " + (benef && benef.length ? benef.join(" | ") : TEXTES.SANS_LISTE));
    if (leve) {
      l.push("LEVE: " + meta(leve.d.o).n + " (" + TEXTES.RECUE + " " + jourFR(leve.d.t) + ")");
      l.push("NOTE: " + TEXTES.NON_RETRO);
    }
    return l;
  }

  function blocHTML(l) { return '<div class="tdl-bloc">' + l.join("<br>") + "</div>"; }
  function blocTexte(l) { return '\n<div class="tdl-bloc">\n' + l.join("\n") + "\n</div>\n"; }

  /* ===================== INSERTION ===================== */

  /* Plusieurs éditeurs peuvent coexister sur une page : on prend le visible. */
  function editeur() {
    var c = document.querySelectorAll(SEL.EDITEUR);
    for (var i = 0; i < c.length; i++) if (c[i].offsetHeight > 0) return c[i];
    return c[0] || null;
  }

  function dansTextarea(ta, texte) {
    var p = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
    ta.value = ta.value.slice(0, p) + texte + ta.value.slice(p);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function dansIframe(ifr, lignes) {
    var doc = ifr.contentDocument || (ifr.contentWindow && ifr.contentWindow.document);
    if (!doc || !doc.body) return false;
    doc.body.focus();
    var sel = doc.getSelection();
    /* sans sélection dans l'iframe, insertHTML n'a nulle part où écrire :
       on se place en fin de contenu plutôt que d'échouer. */
    if (!sel.rangeCount || !doc.body.contains(sel.anchorNode)) {
      var r = doc.createRange();
      r.selectNodeContents(doc.body);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    if (doc.execCommand("insertHTML", false, blocHTML(lignes) + "<br>")) return true;
    doc.body.insertAdjacentHTML("beforeend", blocHTML(lignes));
    return true;
  }

  function inserer(lignes) {
    var c = editeur();
    if (c) {
      var src = c.querySelector("textarea");
      if (src && src.offsetHeight > 0) return dansTextarea(src, blocTexte(lignes));
      var ifr = c.querySelector("iframe");
      if (ifr && dansIframe(ifr, lignes)) return true;
    }
    var ta = document.querySelector(SEL.TEXTAREA);
    return ta ? dansTextarea(ta, blocTexte(lignes)) : false;
  }

  /* ===================== CONSOMMATION ===================== */

  function consommer(e) {
    var p = moi();
    if (!p || !window.TDLBase || !E()) return Promise.resolve();
    var base = CFG.NODE_MEMBRES + "/" + p + "/" + CFG.SOUS_INV + "/";   /* RAW : PATCH racine */
    var chemin = base + e.cle;
    var reste = (parseInt(e.ch, 10) || 1) - 1;
    var patch = {};
    /* une charge restante : on ne touche QUE le compteur, pas l'entrée.
       Plus aucune : l'objet quitte l'inventaire. */
    if (reste > 0) patch[chemin + "/ch"] = reste;
    else patch[chemin] = null;
    /* la levée part dans le même PATCH : jamais une protection dépensée sans
       que le sort tombe, jamais un sort levé sans qu'elle soit dépensée. */
    if (e.leveCle) patch[base + e.leveCle] = null;
    patch[CFG.NODE_JOURNAL + "/" + window.TDLBase.nouvelleCle()] = {
      p: p, o: e.o, src: e.src, r: e.leveCle ? "leve" : "use",
      s: sujetId() ? "t" + sujetId() : "",
      t: new Date().toISOString()
    };
    return Promise.resolve(E().firebaseUpdate(patch));
  }

  function consommerBorne(e) {
    return Promise.race([
      consommer(e).catch(function (err) {
        if (window.console) console.warn("[tdl-objets-post] consommation échouée :", err);
      }),
      new Promise(function (r) { setTimeout(r, CFG.DELAI_MS); })
    ]);
  }

  /* ===================== PANNEAU ===================== */

  var panneau = null;

  function fermer() { if (panneau) { panneau.remove(); panneau = null; } }

  function corps() { return panneau ? panneau.querySelector(".tdlo-corps") : null; }

  function dire(txt) {
    var c = corps();
    if (c) c.innerHTML = '<p class="tdlo-vide">' + esc(txt) + '</p>';
  }

  function bouton(ic, nom, detail, badge) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tdlo-ligne";
    b.innerHTML = '<i class="fi fi-sr-' + esc(ic) + '"></i>'
                + '<span class="tdlo-n">' + esc(nom) + '</span>'
                + '<span class="tdlo-e">' + esc(detail || "") + '</span>'
                + (badge ? '<span class="tdlo-ch">' + esc(badge) + '</span>' : "");
    return b;
  }

  function listerInventaire(liste) {
    var c = corps(); if (!c) return;
    c.innerHTML = "";
    if (!liste.length) { dire(TEXTES.VIDE); return; }
    liste.forEach(function (x) {
      var m = meta(x.d.o);
      var b = bouton(m.ic, m.n, x.d.lieu || m.eff || "", (x.d.ch > 1) ? String(x.d.ch) : "");
      b.addEventListener("click", function () { choisir(x); });
      c.appendChild(b);
    });
  }

  /* Deuxième écran : la protection peut lever un sort subi, ou servir ailleurs. */
  function listerUsages(x, sorts) {
    var c = corps(); if (!c) return;
    c.innerHTML = '<p class="tdlo-sous">' + esc(TEXTES.USAGE) + '</p>';
    sorts.forEach(function (s) {
      var m = meta(s.d.o);
      var b = bouton(m.ic, TEXTES.LEVER, m.n + " — " + TEXTES.RECUE + " " + jourFR(s.d.t));
      b.addEventListener("click", function () { finaliser(x, s); });
      c.appendChild(b);
    });
    var autre = bouton("shield-check", TEXTES.AUTRE, TEXTES.AUTRE_D);
    autre.addEventListener("click", function () { finaliser(x, null); });
    c.appendChild(autre);

    var retour = bouton("arrow-left", TEXTES.RETOUR, "");
    retour.addEventListener("click", function () {
      listerInventaire(INVENTAIRE.filter(utilisable));
    });
    c.appendChild(retour);
  }

  function choisir(x) {
    if (EN_ATTENTE) { alert(TEXTES.DEJA); return; }
    var sorts = subis();
    if (meta(x.d.o).leve && sorts.length) { listerUsages(x, sorts); return; }
    finaliser(x, null);
  }

  function finaliser(x, leve) {
    var e = x.d, m = meta(e.o);
    var prepare = m.collectif ? beneficiaires() : Promise.resolve([]);
    prepare.then(function (benef) {
      if (!inserer(bloc(e, benef, leve))) { alert(TEXTES.ECHEC); return; }
      EN_ATTENTE = { cle: x._k, o: e.o, src: e.src, ch: e.ch, leveCle: leve ? leve._k : "" };
      fermer();
      alert(TEXTES.INSERE);
    });
  }

  function ouvrir(ancre) {
    if (panneau) { fermer(); return; }
    var p = document.createElement("div");
    p.className = "tdlo-panneau";
    p.innerHTML = '<div class="tdlo-tete"><span>' + esc(TEXTES.TITRE) + '</span>'
                + '<button type="button" class="tdlo-x" aria-label="' + esc(TEXTES.FERMER) + '">&times;</button></div>'
                + '<div class="tdlo-corps"></div>';
    document.body.appendChild(p);       /* FA piège le fixed monté dans le formulaire */
    panneau = p;

    var r = ancre.getBoundingClientRect();
    p.style.left = Math.round(Math.min(r.left, window.innerWidth - p.offsetWidth - 8)) + "px";
    p.style.top = Math.round(r.bottom + 6) + "px";
    p.querySelector(".tdlo-x").addEventListener("click", fermer);
    dire(TEXTES.CHARGE);

    socle()
      .then(function (eco) {
        return eco.lireFrais(CFG.NODE_MEMBRES + "/" + encodeURIComponent(moi()) + "/" + CFG.SOUS_INV);
      })
      .then(function (src) {
        INVENTAIRE = versListe(src);
        listerInventaire(INVENTAIRE.filter(utilisable));
      })
      .catch(function (err) {
        dire(err && err.message === "ECO" ? TEXTES.SANS_SOCLE : TEXTES.ERREUR);
        if (window.console) console.warn("[tdl-objets-post] inventaire :", err);
      });
  }

  /* ===================== MONTAGE ===================== */

  /* FA ne nomme pas toujours son formulaire de la même façon selon la page :
     trois tentatives plutôt qu'un sélecteur unique qui échoue en silence. */
  function formulaireDe(el) {
    return (el.closest && el.closest("form"))
        || document.querySelector(SEL.FORM)
        || (el.form || null);
  }

  function poser(ancrage) {
    var prec = ancrage.previousElementSibling;
    if (prec && prec.classList && prec.classList.contains("tdlo-btn")) return;   /* déjà posé */
    if (!ancrage.parentNode) return;

    var b = document.createElement("button");
    b.type = "button";
    b.className = "tdlo-btn";
    b.innerHTML = '<i class="fi fi-sr-box-open"></i> ' + esc(TEXTES.BOUTON);
    b.addEventListener("click", function (ev) { ev.preventDefault(); ouvrir(b); });
    ancrage.parentNode.insertBefore(b, ancrage);

    var form = formulaireDe(ancrage);
    var envoi = form ? form.querySelector(SEL.ENVOI) : document.querySelector(SEL.ENVOI);
    if (!envoi || envoi.dataset.tdlo) return;
    envoi.dataset.tdlo = "1";           /* une seule interception par bouton */

    var relance = false;
    envoi.addEventListener("click", function (ev) {
      if (relance || !EN_ATTENTE) return;
      ev.preventDefault();
      ev.stopPropagation();
      var e = EN_ATTENTE;
      EN_ATTENTE = null;
      envoi.disabled = true;
      consommerBorne(e).then(function () {
        relance = true;
        envoi.disabled = false;
        envoi.click();
      });
    }, true);
  }

  /* Page pleine : #message-box. Réponse rapide : .sceditor-container.
     Sans sceditor : le textarea nu. */
  function ancrages() {
    var out = [];
    var boite = document.querySelector(SEL.BOITE);
    if (boite) out.push(boite);
    Array.prototype.forEach.call(document.querySelectorAll(SEL.EDITEUR), function (c) {
      if (!boite || !boite.contains(c)) out.push(c);
    });
    if (!out.length) {
      var ta = document.querySelector(SEL.TEXTAREA);
      if (ta) out.push(ta);
    }
    return out;
  }

  function monter() {
    if (!moi()) return;
    ancrages().forEach(poser);
  }

  /* L'éditeur se monte parfois après le load : on repasse quelques secondes,
     puis on s'arrête — pas de boucle permanente sur toutes les pages du forum.
     poser() refuse de doubler le bouton, donc repasser est sans conséquence. */
  function demarrer(n) {
    monter();
    if (n < CFG.SCANS) setTimeout(function () { demarrer(n + 1); }, CFG.SCAN_MS);
  }

  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") fermer(); });

  if (document.readyState === "complete") demarrer(0);
  else window.addEventListener("load", function () { demarrer(0); });

})();
