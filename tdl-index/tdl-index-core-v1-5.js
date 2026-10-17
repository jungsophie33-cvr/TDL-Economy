/*
 * tdl-index-core.js — Socle de la page d'accueil · The Drowned Lands
 *
 * CE QUE CE FICHIER FAIT
 *   · nettoie les <br> que ForumActif insère dans le message d'accueil ;
 *   · lit le nœud « accueil » (vitrine, ~2 ko) en UNE requête et en déduit
 *     la une du Courier et les quatre compteurs ;
 *   · analyse le bloc de données #tdli-data (grammaire SOS) et l'expose aux
 *     autres modules — il n'en consomme lui-même aucune clé ;
 *   · construit le menu radial des missions dans <body> ;
 *   · affiche la période de jeu, calculée sur l'horloge de HOUMA.
 *
 * CE QU'IL NE FAIT PAS
 *   · les habitants et le staff   → tdl-index-habitants.js
 *   · la météo et les marées      → tdl-index-meteo.js
 *   · il n'ÉCRIT jamais dans Firebase. Les compteurs sont alimentés par les
 *     tableaux eux-mêmes (rep-mis-marin, rep-det-main, rep-tac-fais,
 *     rep-flot-core, eco-rep-enquete), qui ont déjà leurs données en mémoire.
 *     L'accueil est la page la plus visitée du forum : elle ne recalcule rien.
 *
 * SCHÉMA LU
 *   accueil/une        = { rubrique, groupe, titre, chapo, lien, image,
 *                          secondaires: [ { rubrique, groupe, titre, lien } ] }
 *   accueil/compteurs  = { missions: { maringouins, main, faiseuses,
 *                                      operations, disparitions },
 *                          enquetes, evenements, projets }
 *   Chaque tableau n'écrit QUE sa propre feuille : pas de concurrence, la
 *   somme est faite ici, à l'affichage.
 *
 * POURQUOI L'OVERLAY EST DÉPLACÉ DANS <body> : la grille vit dans un message,
 * donc sous des ancêtres ForumActif susceptibles de porter transform, filter
 * ou contain. Un seul de ces trois fait de l'ancêtre le bloc contenant d'un
 * position:fixed, et l'overlay resterait piégé dans le message. Même parade
 * que tdl-botm-ui et bottin-fc.
 *
 * PRÉREQUIS : eco-core chargé AVANT (lecture REST, fonctionne pour un invité).
 * CSS : CSS-tdl-index.css. Icônes : uicons-thin-rounded.
 *
 * CARTE DES BLOCS : CONFIG · TEXTES · UTILS · TEMPS · PARSEUR · DONNÉES
 *                   COURIER · COMPTEURS · RADIAL · INIT
 */

window.TDLI = window.TDLI || {};
(function (NS) {
  "use strict";
  if (NS._core) return;
  NS._core = true;

  /* === CONFIG === */
  var CFG = {
    SEL_RACINE: "#tdli-racine",
    SEL_DATA:   "#tdli-data",
    NOEUD:      "accueil",
    TZ:         "America/Chicago",      // fuseau de Houma, pas celui du lecteur
    ATTENTE_MAX: 60,                    // 60 × 250 ms = 15 s
    ATTENTE_PAS: 250,
    // [MAJ] cibles des compteurs et du journal
    SUJETS: {
      maringouins:  "/t90-le-tableau-des-missions",
      main:         "/t92-le-tableau-des-dettes",
      faiseuses:    "/t91-le-tableau-des-taches",
      hangar:       "/t96-le-tableau-du-hangar",
      marees:       "/t96-le-tableau-du-hangar",
      carrefour:    "/t107-le-tableau-du-carrefour",
      secrets:      "/t108-le-tableau-des-secrets",
      enquetes:     "/t86-le-panneau-des-enquetes",
      evenements:   "/calendar",
      projets:      "#",
      courier:      "/t102-the-houma-courier"
    }
  };

  // Sous-tableaux agrégés par le compteur « missions ouvertes ».
  /* Opérations et disparitions sont regroupées sous « hangar » : même public,
     même engagement. Les marées gardent leur branche, parce qu'elles sont les
     seules ouvertes à qui n'appartient à aucune bande. */
 var SOUS = [
    { cle: "maringouins", lib: "Missions",  ent: "Les Maringouins" },
    { cle: "main",        lib: "Dettes",    ent: "La Main" },
    { cle: "secrets",     lib: "Secrets",   ent: "Les Sorcières" },
    { cle: "faiseuses",   lib: "Tâches",    ent: "Les Faiseuses" },
    { cle: "hangar",      lib: "Hangar",    ent: "La Flottille" },
    { cle: "carrefour",   lib: "Carrefour", ent: "Chasses & missions" },
    { cle: "marees",      lib: "Marées",    ent: "Ouvertes à tous" }
  ];

  var ICONES = {
    missions:   "fi fi-tr-two-swords",
    enquetes:   "fi fi-tr-search",
    evenements: "fi fi-tr-people",
    projets:    "fi fi-tr-seedling"
  };

  /* === TEXTES === */
  var T = {
    MISSIONS:   "Missions<br>ouvertes",
    ENQUETES:   "Enquêtes<br>à saisir",
    EVENEMENTS: "Événements<br>membres",
    PROJETS:    "Projets<br>communautaires",
    VOIR:       "voir →",
    BIENTOT:    "bientôt",
    RADIAL_CLE: "Missions",
    RADIAL_SUB: "à rejoindre",
    FERMER:     "Fermer ✕",
    LIRE:       "Lire l'article",
    TOUS:       "Tous les articles",
    EN_JEU:     "En jeu"
  };

  /* === UTILS === */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function slug(s) {
    return String(s || "").toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  function dd(n) { n = +n || 0; return (n < 10 ? "0" : "") + n; }
  function versTableau(v) { return !v ? [] : (Array.isArray(v) ? v : Object.keys(v).map(function (k) { return v[k]; })); }
  function el(sel) { return document.querySelector(sel); }
  function jrn(msg) { if (window.console) console.warn("[TDLI] " + msg); }

  /* Une URL part parfois dans un attribut style="…" : on l'assainit au lieu de
     la citer. Un guillemet dans url("…") refermerait l'attribut et le
     navigateur jetterait toute la déclaration, image ET repli. */
  function urlSure(u) { return String(u || "").replace(/["'()\s<>]/g, ""); }

  /* Couleur de rubrique : seules les six teintes du root sont acceptées. */
  function couleur(groupe) {
    var g = /^gr[1-6]$/.test(String(groupe || "")) ? groupe : "gr1";
    return "var(--" + g + "-color)";
  }

  /* ForumActif déclenche DOMContentLoaded avant d'avoir fini de bâtir la page :
     on attend « load », avec le repli readyState si l'événement est déjà passé
     quand ce fichier arrive. */
  function pret(fn) {
    if (document.readyState === "complete") fn();
    else window.addEventListener("load", fn);
  }

  /* === TEMPS (Houma) ===
     Tout ce qui est daté sur cette page l'est à l'heure de la paroisse, jamais
     à celle du lecteur : un joueur canadien et un joueur français doivent lire
     la même chose. Intl gère le passage à l'heure d'hiver tout seul. */
  function maintenantHouma() {
    var p = {};
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: CFG.TZ, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return {
      jour:    p.year + "-" + p.month + "-" + p.day,
      annee:   +p.year,
      mois:    +p.month,
      minutes: (+p.hour === 24 ? 0 : +p.hour) * 60 + (+p.minute)
    };
  }

  function periodeTexte() {
    var h = maintenantHouma();
    var d = new Date(Date.UTC(h.annee, h.mois - 1, 15));   // 15 : jamais de bascule
    var m = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
    return m.charAt(0).toUpperCase() + m.slice(1);
  }

  /* === PARSEUR (grammaire SOS) ===
     === PANNEAU: <nom>   ·   --- BLOC <type> ---   ·   CLÉ: valeur
     Les clés répétables (PL) s'empilent dans bloc.pl. */

  /* ForumActif réécrit les sauts de ligne en <br> à chaque enregistrement du
     message : on repasse en texte brut avant d'analyser. */
  function texteBrut(noeud) {
    var copie = noeud.cloneNode(true);
    var h = copie.innerHTML
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "");
    var ta = document.createElement("textarea");
    ta.innerHTML = h;
    return ta.value.replace(/\u00a0/g, " ");
  }

  function parser(txt) {
    var res = {}, panneau = null, bloc = null;
    String(txt || "").split(/\r?\n/).forEach(function (ligne) {
      var l = ligne.trim(), m;
      if (!l) return;
      if ((m = l.match(/^===\s*PANNEAU:\s*(.+)$/i))) {
        panneau = slug(m[1]); res[panneau] = []; bloc = null; return;
      }
      if ((m = l.match(/^---\s*BLOC\s+(\S+)\s*---$/i))) {
        bloc = { _type: slug(m[1]), pl: [] };
        if (panneau) res[panneau].push(bloc);
        return;
      }
      if (!bloc) return;
      if ((m = l.match(/^([A-ZÉÈÀÎÔÛ_]+):\s*(.*)$/))) {
        var cle = slug(m[1]).replace(/-/g, "_"), val = m[2].trim();
        if (cle === "pl") {
          var p = val.split("⟡").map(function (x) { return x.trim(); });
          bloc.pl.push({ nom: p[0] || "", role: p[1] || "", url: p[2] || "", img: p[3] || "" });
        } else {
          bloc[cle] = val;
        }
      }
    });
    return res;
  }

  /* === DONNÉES === */

  function ecoPret() {
    return !!(window.EcoCore && typeof window.EcoCore.firebaseGet === "function");
  }
  function attendreEco() {
    return new Promise(function (resoudre) {
      var n = 0;
      (function boucle() {
        if (ecoPret()) { resoudre(true); return; }
        if (++n > CFG.ATTENTE_MAX) { jrn("EcoCore introuvable — vitrine ignorée."); resoudre(false); return; }
        setTimeout(boucle, CFG.ATTENTE_PAS);
      })();
    });
  }

  /* Une seule lecture par page, partagée avec les autres modules. */
  var _vitrine = null;
  function lireVitrine() {
    if (_vitrine) return _vitrine;
    _vitrine = attendreEco().then(function (ok) {
      if (!ok) return null;
      return window.EcoCore.firebaseGet(CFG.NOEUD).catch(function (e) {
        jrn("lecture de « " + CFG.NOEUD + " » refusée : " + e.message);
        return null;
      });
    });
    return _vitrine;
  }

  /* === 1. COURIER === */

  function rendreCourier(une) {
    // Pas de une publiée : la coquille garde son état d'attente, intact.
    if (!une || !une.titre) return;
    var cour = el("#tdli-cour");
    if (!cour) return;

    var photo = cour.querySelector(".tdli-une");
    if (photo && une.image) {
      // background-image seul : le raccourci background remettrait
      // background-size à auto et l'image cesserait d'être en cover.
      photo.style.backgroundImage = "url(" + urlSure(une.image) + ")";
    }
    var h = "";
    if (une.rubrique) {
      h += '<span class="tdli-rub" style="color:' + couleur(une.groupe) + '">' +
           esc(une.rubrique) + "</span>";
    }
    // title : le CSS coupe à deux lignes, l'infobulle rend le texte entier.
    h += '<div class="tdli-une-texte">' +
         '<h2 class="tdli-titre-une" title="' + esc(une.titre) + '">' + esc(une.titre) + "</h2>" +
         (une.chapo ? '<p class="tdli-chapo" title="' + esc(une.chapo) + '">' +
                      esc(une.chapo) + "</p>" : "") +
         (une.lien ? '<a class="tdli-lien" href="' + esc(une.lien) + '">' + T.LIRE +
                     ' <span class="tdli-fleche">&rarr;</span></a>' : "") +
         "</div>";
    photo.innerHTML = h;

    var secs = versTableau(une.secondaires).slice(0, 3), s = "";
    secs.forEach(function (x) {
      if (!x || !x.titre) return;
      s += '<div class="tdli-sec" style="--tdli-rub:' + couleur(x.groupe) + '">' +
           (x.rubrique ? '<div class="tdli-sec-rub">' + esc(x.rubrique) + "</div>" : "") +
           '<div class="tdli-sec-titre" title="' + esc(x.titre) + '"' +
           (x.lien ? ' data-href="' + esc(x.lien) + '"' : "") +
           ">" + esc(x.titre) + "</div></div>";
    });
    s += '<a class="tdli-lien" href="' + esc(CFG.SUJETS.courier) + '">' + T.TOUS +
         ' <span class="tdli-fleche">&rarr;</span></a>';
    cour.querySelector(".tdli-secs").innerHTML = s;

    cour.querySelectorAll(".tdli-sec-titre[data-href]").forEach(function (n) {
      n.addEventListener("click", function () { location.href = n.getAttribute("data-href"); });
    });
  }

  /* === 2. COMPTEURS === */

  var CPT = { missions: {}, enquetes: 0, evenements: 0, projets: 0 };

  function totalMissions() {
    var t = 0;
    SOUS.forEach(function (s) { t += (+CPT.missions[s.cle] || 0); });
    return t;
  }

  function rendreCompteurs() {
    var hote = el("#tdli-cpts");
    if (!hote) return;
    var items = [
      { cle: "missions",   nb: totalMissions(),  lib: T.MISSIONS,   radial: true },
      { cle: "enquetes",   nb: +CPT.enquetes   || 0, lib: T.ENQUETES,   url: CFG.SUJETS.enquetes },
      { cle: "evenements", nb: +CPT.evenements || 0, lib: T.EVENEMENTS, url: CFG.SUJETS.evenements },
      { cle: "projets",    nb: +CPT.projets    || 0, lib: T.PROJETS,    url: CFG.SUJETS.projets }
    ];
    hote.innerHTML = items.map(function (it) {
      var off = (it.nb === 0 && !it.radial);
      return '<button type="button" class="tdli-cpt" data-cpt="' + it.cle + '"' +
             (off ? " disabled" : "") + ">" +
             '<span class="tdli-cpt-fond"><i class="' + ICONES[it.cle] + '"></i></span>' +
             '<span class="tdli-cpt-nb">' + dd(it.nb) + "</span>" +
             '<span class="tdli-cpt-lib">' + it.lib +
             '<span class="tdli-cpt-voir">' + (off ? T.BIENTOT : T.VOIR) + "</span>" +
             "</span></button>";
    }).join("");

    hote.querySelectorAll(".tdli-cpt").forEach(function (b) {
      b.addEventListener("click", function () {
        var cle = b.getAttribute("data-cpt");
        if (cle === "missions") { ouvrirRadial(); return; }
        var cible = CFG.SUJETS[cle];
        if (cible && cible !== "#") location.href = cible;
      });
    });
  }

  /* === 3. MENU RADIAL === */

  var ovl = null, rad = null, tmr = null;

  function monterOverlay() {
    if (ovl) return;
    ovl = document.createElement("div");
    ovl.className = "tdli-ovl";
    ovl.id = "tdli-ovl";
    ovl.setAttribute("role", "dialog");
    ovl.setAttribute("aria-modal", "true");
    ovl.innerHTML = '<button type="button" class="tdli-close">' + T.FERMER + "</button>" +
                    '<div class="tdli-radial"></div>';
    document.body.appendChild(ovl);          // hors du message : voir l'en-tête
    rad = ovl.querySelector(".tdli-radial");
    ovl.querySelector(".tdli-close").addEventListener("click", fermerRadial);
    ovl.addEventListener("click", function (e) { if (e.target === ovl) fermerRadial(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") fermerRadial(); });
    window.addEventListener("resize", function () {
      if (ovl.classList.contains("tdli-visible")) placer(true);
    });
  }

  function garnirRadial() {
    var h = '<div class="tdli-noyau">' +
            '<span class="tdli-noyau-cle">' + T.RADIAL_CLE + "</span>" +
            '<span class="tdli-noyau-nb">' + dd(totalMissions()) + "</span>" +
            '<span class="tdli-noyau-sous">' + T.RADIAL_SUB + "</span></div>";
    SOUS.forEach(function (s) {
      h += '<div class="tdli-ray"></div>' +
           '<a class="tdli-sat" href="' + esc(CFG.SUJETS[s.cle] || "#") + '">' +
           '<span class="tdli-sat-nb">' + dd(CPT.missions[s.cle]) + "</span>" +
           '<span class="tdli-sat-lib">' + esc(s.lib) + "</span>" +
           '<span class="tdli-sat-ent">' + esc(s.ent) + "</span></a>";
    });
    rad.innerHTML = h;
  }

  /* Positions calculées en pixels sur la taille mesurée du conteneur : un
     rayon en CSS demanderait une valeur par point de rupture. */
  function placer(deploye) {
    var w = rad.offsetWidth, hh = rad.offsetHeight;
    var cx = w / 2, cy = hh / 2;
    /* Le rayon suit le nombre de cartes : à cinq, 0.355 les posait bien ; à
       sept, elles se touchent. On écarte sans sortir du conteneur. */
    var r = Math.min(w, hh) * (SOUS.length > 6 ? 0.415 : 0.355);
    var rays = rad.querySelectorAll(".tdli-ray");
    var sats = rad.querySelectorAll(".tdli-sat");
    SOUS.forEach(function (s, i) {
      var deg = -90 + i * (360 / SOUS.length);
      var a = deg * Math.PI / 180, x = Math.cos(a) * r, y = Math.sin(a) * r;
      var ray = rays[i];
      ray.style.width = r + "px";
      ray.style.transform = "rotate(" + deg + "deg)";
      ray.style.transitionDelay = (deploye ? 0.10 + i * 0.04 : 0) + "s";
      var sat = sats[i], sw = sat.offsetWidth || 152, sh = sat.offsetHeight || 70;
      sat.style.left = (cx + x - sw / 2) + "px";
      sat.style.top  = (cy + y - sh / 2) + "px";
      sat.style.transitionDelay = (deploye ? 0.08 + i * 0.05 : (SOUS.length - 1 - i) * 0.03) + "s";
      sat.style.opacity = deploye ? 1 : 0;
      sat.style.transform = deploye ? "none"
        : "translate(" + (-x * 0.62) + "px," + (-y * 0.62) + "px) scale(.72)";
    });
  }

  function ouvrirRadial() {
    monterOverlay();
    clearTimeout(tmr);
    garnirRadial();
    ovl.classList.add("tdli-monte");
    document.documentElement.style.overflow = "hidden";
    placer(false);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { ovl.classList.add("tdli-visible"); placer(true); });
    });
  }

  function fermerRadial() {
    if (!ovl || !ovl.classList.contains("tdli-monte")) return;
    placer(false);
    ovl.classList.remove("tdli-visible");
    document.documentElement.style.overflow = "";
    tmr = setTimeout(function () { ovl.classList.remove("tdli-monte"); }, 340);
  }

  /* === INIT === */

  /* ForumActif réinjecte des <br> entre les éléments du message à chaque
     enregistrement. Le CSS les masque ; on les retire quand même, sinon ils
     comptent comme enfants et faussent les sélecteurs :nth-child. */
  function nettoyerBr(racine) {
    racine.querySelectorAll("br").forEach(function (b) {
      if (b.closest(".tdli-une-texte, .tdli-cpt-lib")) return;   // ceux-là sont à nous
      b.parentNode.removeChild(b);
    });
  }

  function init() {
    if (typeof NS.monterShell === "function") NS.monterShell();   // idempotent
    var racine = el(CFG.SEL_RACINE);
    if (!racine) return;                       // page sans accueil : on ne fait rien
    nettoyerBr(racine);

    /* Les données viennent de tdl-index-data.js. L'élément #tdli-data du
       message d'accueil reste accepté en second : ni l'éditeur ForumActif ni
       un gabarit ne savent préserver un bloc de texte multiligne, mais une
       installation ancienne doit continuer de tourner. */
    var brut = (typeof window.TDLI_DATA === "string") ? window.TDLI_DATA : null;
    if (!brut) {
      var noeudData = el(CFG.SEL_DATA);
      brut = noeudData ? texteBrut(noeudData) : "";
    }
    NS.DATA = parser(brut);
    if (!NS.DATA.habitants) jrn("aucune donnée : tdl-index-data.js est-il chargé avant le core ?");

    var per = document.getElementById("tdli-periode");
    if (per) per.textContent = periodeTexte();

    rendreCompteurs();                         // zéros affichés tout de suite

    lireVitrine().then(function (rec) {
      if (!rec) return;
      if (rec.compteurs) {
        CPT.missions   = rec.compteurs.missions || {};
        CPT.enquetes   = rec.compteurs.enquetes;
        CPT.evenements = rec.compteurs.evenements;
        CPT.projets    = rec.compteurs.projets;
        rendreCompteurs();
      }
      rendreCourier(rec.une);
    });

    if (typeof NS.initHabitants === "function") NS.initHabitants();
    if (typeof NS.initMeteo === "function")     NS.initMeteo();
  }

  /* === EXPORT === */
  NS.CFG = CFG;
  NS.esc = esc;
  NS.slug = slug;
  NS.dd = dd;
  NS.versTableau = versTableau;
  NS.urlSure = urlSure;
  NS.couleur = couleur;
  NS.jrn = jrn;
  NS.el = el;
  NS.pret = pret;
  NS.parser = parser;
  NS.texteBrut = texteBrut;
  NS.maintenantHouma = maintenantHouma;
  NS.attendreEco = attendreEco;
  NS.lireVitrine = lireVitrine;
  NS.DATA = {};

  pret(init);
})(window.TDLI);
