/*
 * bottin-fc-v3.js — Bottin des faceclaims (RENDU) · The Drowned Lands
 *
 * REMPLACE bottin-fc-v2.js. Même rôle, même schéma lu, mêmes hooks : seul le
 * rendu change. La galerie nue (.bfc-barre + .bfc-grille dans le post) devient
 * un overlay plein écran calqué sur le bottin des métiers — en-tête, onglets,
 * barre de compteur, mur de cartes punaisées.
 *
 * CE QUE CE FICHIER FAIT : lit l'enregistrement Firebase via EcoCore, construit
 * l'overlay .bfc-rep et l'accroche à <body>, filtre les cartes par statut,
 * pose .bfc-membre / .bfc-admin selon l'utilisateur, et nettoie en arrière-plan
 * (best-effort) les réservations expirées (purge paresseuse, en lecture fraîche).
 * CE QU'IL NE FAIT PAS : aucune écriture de réservation, aucun formulaire, aucune
 * suppression admin — ces actions restent câblées aux hooks remplis par
 * bottin-fc-form.js et bottin-fc-admin.js.
 *
 * PRÉREQUIS : eco-core.js chargé AVANT (expose window.EcoCore + gère l'auth).
 * CSS : CSS-botfc-v1.css (remplace l'ancienne feuille .bfc-barre/.bfc-grille).
 *
 * POURQUOI L'OVERLAY EST DÉPLACÉ DANS <body> : la div d'ancrage vit dans un post,
 * donc sous des ancêtres ForumActif qui peuvent porter transform/filter/contain.
 * Un seul de ces trois suffit à faire d'un ancêtre le bloc contenant d'un
 * position:fixed, et l'overlay se retrouverait piégé dans le post. Même parade
 * que tdl-botm-ui (init → document.body.appendChild).
 *
 * SCHÉMA LU (clés de l'enregistrement racine) :
 *   faceclaims/{cle_acteur} = { acteur, statut, type?, uid?, pseudo?,
 *                               image?, nom_prelien?, prelien_lien?, expiration? }
 *   faceclaims_uid/{uid}    = [cle_acteur, ...]   (index inverse, pour la purge)
 *   uid_index/{uid}         = pseudo              (résolution d'affichage)
 *
 * HOOKS (définis par les autres modules) :
 *   BottinFC.ouvrirReservation()      → formulaire membre (bottin-fc-form)
 *   BottinFC.supprimerCarte(cle)      → suppression staff (bottin-fc-admin)
 *   BottinFC.renouvelerCarte(cle)     → renouvellement pré-lien (bottin-fc-form)
 *   BottinFC.ouvrirGestion()          → panneau de création staff (bottin-fc-admin)
 *
 * CARTE DES BLOCS : CONFIG · TEXTES · ÉTAT · UTILS · CHROME · RENDER
 *                   PURGE · EVENTS · INIT
 */

window.BottinFC = window.BottinFC || {};
(function (NS) {
  "use strict";

  /* === CONFIG === */
  var CFG = {
    SEL_ANCRE:    ".bottin-faceclaims", // [MAJ] div d'ancrage dans le post faceclaims
    PROFIL_URL:   "/u",                 // [MAJ] préfixe profil ForumActif : /u{uid}
    HREF_ACCUEIL: "/",                  // [MAJ] cible du bouton « Accueil »
    EDIT_URL:     "https://thedrownedlands.forumactif.com/post?p=480&mode=editpost",                   // [MAJ] sujet staff du panneau de gestion ; vide = bouton masqué
    ATTENTE_MAX:  60,                   // tentatives d'attente EcoCore (× ATTENTE_PAS)
    ATTENTE_PAS:  250,                  // ms entre deux tentatives
    PURGE_ACTIVE: true,                 // nettoyage paresseux des cartes expirées
  };

  // [MAJ] Classes d'icônes (familles uicons chargées sur le forum)
  var ICONES = {
    accueil: "fi fi-rr-home",
    edit:    "fi fi-rr-edit",
    gestion: "fi fi-rr-settings-sliders",
    profil:  "fi fi-rr-id-badge",
    prelien: "fi fi-rr-link",
    horloge: "fi fi-rr-clock",
    suppr:   "fi fi-rr-trash",
    avatar:  "fi fi-rr-user",
  };

  /* === TEXTES === */
  var TEXTES = {
    TITRE:        "Bottin des faceclaims",
    ACCUEIL:      "Accueil",
    EDIT_TITRE:   "Panneau de gestion staff",
    BTN_RESERVER: "Réserver un faceclaim",
    BTN_GESTION:  "Gestion staff",
    UNITE_UN:     "faceclaim",
    UNITE_N:      "faceclaims",
    LEG_PRIS:     "pris",
    LEG_RESERVE:  "réservé",
    LEG_LIBRE:    "pré-lien libre",
    COTE_PRIS:    "Pris",
    COTE_RESERVE: "Réservé",
    COTE_LIBRE:   "Pré-lien",
    MC:           "MC",
    SUPPR_TITRE:  "Supprimer cette carte",
    RENOUV_TITRE: "Renouveler la réservation (+1 mois)",
    CHARGEMENT:   "Chargement du bottin…",
    VIDE:         "Aucun faceclaim enregistré pour le moment.",
    VIDE_ONGLET:  "Aucun faceclaim dans cette catégorie.",
    ERREUR:       "Impossible de charger le bottin des faceclaims.",
  };

  // Onglets = statuts. « tous » d'abord, puis l'ordre de lecture du bottin.
  var ONGLETS = [
    { id: "tous",    label: "Tous" },
    { id: "pris",    label: "Pris" },
    { id: "reserve", label: "Réservés" },
    { id: "libre",   label: "Pré-liens libres" },
  ];

  /* === ÉTAT === */
  var S = {
    onglet: "tous",
    rec:    null,   // dernier enregistrement lu
    u:      null,   // contexte utilisateur
    rep:    null,   // racine .bfc-rep (dans <body>)
  };

  /* === UTILS === */

  // Firebase sérialise les tableaux en objets indexés : on renormalise.
  function versTableau(v) {
    if (Array.isArray(v)) return v.slice();
    if (v && typeof v === "object") return Object.keys(v).map(function (k) { return v[k]; });
    return [];
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // N'autorise que des liens internes (/...) ou http(s) — neutralise javascript: etc.
  function lienSur(url) {
    if (!url || typeof url !== "string") return null;
    url = url.trim();
    if (url.charAt(0) === "/" || /^https?:\/\//i.test(url)) return esc(url);
    return null;
  }

  function initiales(nom) {
    var mots = String(nom || "").trim().split(/\s+/).filter(Boolean);
    if (!mots.length) return "?";
    var a = mots[0].charAt(0);
    var b = mots.length > 1 ? mots[mots.length - 1].charAt(0) : "";
    return (a + b).toUpperCase();
  }

  function estExpire(carte, now) {
    return !!carte.expiration && carte.expiration < now;
  }

  function joursRestants(expiration, now) {
    var d = Math.ceil((expiration - now) / 86400000);
    return d < 1 ? 1 : d;
  }

  // Statut normalisé : tout ce qui n'est ni « pris » ni « libre » est une réservation.
  function statutDe(c) {
    var s = c.statut || "reserve";
    return (s === "pris" || s === "libre") ? s : "reserve";
  }

  function resoudrePseudo(rec, carte) {
    var idx = (rec && rec.uid_index) || {};
    var p = (carte.uid != null) ? idx[String(carte.uid)] : null;
    return p || carte.pseudo || null;
  }

  function infosUtilisateur() {
    var E = window.EcoCore || {};
    var pseudo = (typeof E.getPseudo === "function")
      ? E.getPseudo()
      : ((window._userdata && _userdata.username) || "").trim();
    var uid = (typeof E.getUserId === "function")
      ? E.getUserId()
      : (parseInt(window._userdata && _userdata.user_id) || 0);
    var invite = !pseudo || pseudo.toLowerCase() === "anonymous" || uid <= 0;
    var admins = E.ADMIN_USERS || [];
    return { pseudo: pseudo, uid: uid, invite: invite, admin: !invite && admins.indexOf(pseudo) !== -1 };
  }

  function $(id) { return S.rep ? S.rep.querySelector("#" + id) : null; }

  /* === CHROME (structure fixe, construite une seule fois) === */

  function construireChrome() {
    var lienEdit = lienSur(CFG.EDIT_URL);
    return ''
      + '<div class="bfc-app">'

      /* --- en-tête --- */
      +   '<div class="bfc-topbar">'
      +     '<a class="bfc-accueil" id="bfc-home" href="' + esc(CFG.HREF_ACCUEIL) + '">'
      +       '<i class="' + ICONES.accueil + '"></i><span>' + TEXTES.ACCUEIL + '</span></a>'
      +     '<p class="bfc-eyebrow">' + TEXTES.TITRE + '</p>'
      +     (lienEdit
            ? '<a class="bfc-edit" id="bfc-edit" href="' + lienEdit + '" title="' + TEXTES.EDIT_TITRE + '">'
              + '<i class="' + ICONES.edit + '"></i></a>'
            : '<span class="bfc-edit-vide"></span>')
      +   '</div>'

      /* --- onglets de statut --- */
      +   '<div class="bfc-zonebar"><div class="bfc-tabs" id="bfc-tabs" role="tablist"></div></div>'

      /* --- compteur · actions --- */
      +   '<div class="bfc-statusrow">'
      +     '<div class="bfc-left">'
      +       '<span class="bfc-count"><b id="bfc-compteur">0</b><span id="bfc-unite">'
      +         TEXTES.UNITE_N + '</span></span>'
      +       '<button class="bfc-bouton" id="bfc-reserver" type="button">+ '
      +         TEXTES.BTN_RESERVER + '</button>'
      +       '<button class="bfc-bouton bfc-bouton--staff" id="bfc-gestion" type="button">'
      +         '<i class="' + ICONES.gestion + '"></i>' + TEXTES.BTN_GESTION + '</button>'
      +     '</div>'
      +   '</div>'

      /* --- scène --- */
      +   '<div class="bfc-stage" id="bfc-stage"></div>'
      + '</div>';
  }

  /* === RENDER === */

  // Cartes vivantes triées par nom d'acteur ; renvoie aussi les clés à purger.
  function cartesVivantes(rec, now) {
    var fc = (rec && rec.faceclaims) || {};
    var expirees = [];
    var vivants = Object.keys(fc)
      .map(function (cle) { return [cle, fc[cle]]; })
      .filter(function (e) { return e[1] && typeof e[1] === "object"; })
      .filter(function (e) {
        if (estExpire(e[1], now)) { expirees.push(e); return false; }
        return true;
      });

    vivants.sort(function (a, b) {
      return String(a[1].acteur || a[0]).localeCompare(String(b[1].acteur || b[0]), "fr");
    });
    return { vivants: vivants, expirees: expirees };
  }

  function filtrer(vivants) {
    if (S.onglet === "tous") return vivants;
    return vivants.filter(function (e) { return statutDe(e[1]) === S.onglet; });
  }

  function renderOnglets() {
    var el = $("bfc-tabs");
    if (!el) return;
    el.innerHTML = ONGLETS.map(function (o) {
      return '<button role="tab" data-o="' + o.id + '" aria-selected="'
           + (S.onglet === o.id) + '">' + esc(o.label) + '</button>';
    }).join("");
  }

  function renderBarre(n) {
    var c = $("bfc-compteur"), u = $("bfc-unite");
    if (c) c.textContent = n;
    if (u) u.textContent = (n > 1) ? TEXTES.UNITE_N : TEXTES.UNITE_UN;
  }

  function construireCarte(cle, c, rec, now, u) {
    var statut = statutDe(c);
    var classeStatut = "bfc-carte--" + statut;
    var nomActeur = esc(c.acteur || cle);
    var cote = statut === "pris" ? TEXTES.COTE_PRIS
             : statut === "libre" ? TEXTES.COTE_LIBRE
             : TEXTES.COTE_RESERVE;

    // Carte pré-lien renouvelable : détenteur (même UID) ou admin.
    var renouvelable = statut === "libre" && u && !u.invite
      && (u.admin || (c.uid != null && String(c.uid) === String(u.uid)));

    // --- photo : avatar capturé (pris) sinon pastille d'initiales ---
    var photo;
    if (c.image) {
      photo = '<img class="bfc-avatar" src="' + esc(c.image) + '" alt="' + nomActeur + '">';
    } else {
      var modeRond = (statut === "libre") ? "bfc-initiales--libre" : "bfc-initiales--reserve";
      photo = '<div class="bfc-initiales ' + modeRond + '">' + esc(initiales(c.acteur || cle)) + '</div>';
    }

    // --- décompte : tampon en haut de carte (uniquement cartes à échéance) ---
    var tampon = c.expiration
      ? '<span class="bfc-stamp" style="--sc:var(--clair2)"><i class="' + ICONES.horloge + '"></i>'
        + joursRestants(c.expiration, now) + ' j</span>'
      : "";

    // --- meta : libellé + lien ---
    var meta;
    if (statut === "libre") {
      var lp = lienSur(c.prelien_lien);
      meta = esc(c.nom_prelien || "—")
           + (lp ? ' <a class="bfc-lien" href="' + lp + '"><i class="' + ICONES.prelien + '"></i></a>' : "");
    } else {
      var pseudo = resoudrePseudo(rec, c);
      var mc = (c.type === "multicompte") ? ' <span class="bfc-mc">' + TEXTES.MC + '</span>' : "";
      var profil = (c.uid != null)
        ? ' <a class="bfc-lien" href="' + CFG.PROFIL_URL + (parseInt(c.uid) || 0) + '"><i class="' + ICONES.profil + '"></i></a>'
        : "";
      meta = esc(pseudo || "—") + mc + profil;
    }

    // data-cle sur la carte entière : lu par le hook de renouvellement.
    return '<article class="bfc-carte ' + classeStatut
         +   (renouvelable ? ' bfc-carte--renouvelable' : '')
         +   '" data-cle="' + esc(cle) + '"'
         +   (renouvelable ? ' title="' + TEXTES.RENOUV_TITRE + '"' : '') + '>'
         +   '<button class="bfc-suppr" type="button" data-cle="' + esc(cle) + '" title="'
         +     TEXTES.SUPPR_TITRE + '"><i class="' + ICONES.suppr + '"></i></button>'
         +   '<div class="bfc-carte-top"><span class="bfc-cote">' + cote + '</span>' + tampon + '</div>'
         +   '<p class="bfc-nom">' + nomActeur + '</p>'
         +   '<div class="bfc-photo">' + photo + '</div>'
         +   '<div class="bfc-foot"><span class="bfc-meta">' + meta + '</span></div>'
         + '</article>';
  }

  function renderStage(vivants, rec, now, u) {
    var el = $("bfc-stage");
    if (!el) return;

    var vus = filtrer(vivants);
    renderBarre(vus.length);

    var corps;
    if (!vivants.length) corps = '<div class="bfc-message">' + TEXTES.VIDE + '</div>';
    else if (!vus.length) corps = '<div class="bfc-message">' + TEXTES.VIDE_ONGLET + '</div>';
    else corps = '<div class="bfc-board">' + vus.map(function (e) {
      return construireCarte(e[0], e[1], rec, now, u);
    }).join("") + '</div>';

    el.innerHTML = '<div class="bfc-boardwrap"><div class="bfc-boardscroll">' + corps + '</div></div>';
  }

  function rendre(rec) {
    S.rec = rec;
    S.u = infosUtilisateur();

    S.rep.classList.toggle("bfc-membre", !S.u.invite);
    S.rep.classList.toggle("bfc-admin", !!S.u.admin);

    var now = Date.now();
    var d = cartesVivantes(rec, now);

    renderOnglets();
    renderStage(d.vivants, rec, now, S.u);

    if (CFG.PURGE_ACTIVE && !S.u.invite && d.expirees.length) purgerExpires(d.expirees);
  }

  // Re-rendu léger sur changement d'onglet : aucune relecture Firebase.
  function rendreOnglet() {
    var now = Date.now();
    var d = cartesVivantes(S.rec, now);
    renderOnglets();
    renderStage(d.vivants, S.rec, now, S.u);
  }

  /* === PURGE (paresseuse, best-effort, en lecture fraîche) === */
  function purgerExpires(clesExpirees) {
    var E = window.EcoCore;
    if (!E || typeof E.firebaseUpdate !== "function" || typeof E.readBin !== "function") return;

    // Lecture FRAÎCHE : on ne supprime jamais une carte renouvelée dans la fenêtre de cache 60 s.
    if (typeof E.invalidateCache === "function") E.invalidateCache();

    E.readBin().then(function (rec) {
      if (!rec) return;
      var fc = rec.faceclaims || {};
      var idx = rec.faceclaims_uid || {};
      var now = Date.now();
      var updates = {};
      var touche = false;

      clesExpirees.forEach(function (e) {
        var cle = e[0];
        var c = fc[cle];
        if (!c || !estExpire(c, now)) return;        // déjà partie ou renouvelée → on ne touche pas
        updates["faceclaims/" + cle] = null;
        touche = true;
        if (c.uid != null) {                          // retrait de l'index inverse
          var u = String(c.uid);
          var liste = versTableau(idx[u]).filter(function (k) { return k !== cle; });
          updates["faceclaims_uid/" + u] = liste.length ? liste : null;
        }
      });

      if (touche) {
        E.firebaseUpdate(updates).catch(function (err) {
          if (window.console) console.warn("[BottinFC] purge expirés échouée (sans gravité)", err);
        });
      }
    }).catch(function () { /* lecture échouée → on réessaiera au prochain chargement */ });
  }

  /* === EVENTS ===
     Délégation sur .bfc-rep : le mur est réécrit à chaque changement d'onglet,
     rebrancher carte par carte multiplierait les écouteurs sur un DOM jetable. */
  function brancherEvenements() {
    S.rep.addEventListener("click", function (ev) {

      // onglet de statut
      var tab = ev.target.closest("[data-o]");
      if (tab) { S.onglet = tab.dataset.o; rendreOnglet(); return; }

      // bouton « Réserver un faceclaim »
      if (ev.target.closest("#bfc-reserver")) {
        if (typeof NS.ouvrirReservation === "function") NS.ouvrirReservation();
        else if (window.console) console.warn("[BottinFC] ouvrirReservation pas branché (bottin-fc-form absent ?).");
        return;
      }

      // bouton « Gestion staff » — masqué en CSS hors staff, mais bottin-fc-admin
      // revérifie estAdmin() de son côté : un display:none ne protège rien.
      if (ev.target.closest("#bfc-gestion")) {
        if (typeof NS.ouvrirGestion === "function") NS.ouvrirGestion();
        else if (window.console) console.warn("[BottinFC] ouvrirGestion pas branché (bottin-fc-admin absent ?).");
        return;
      }

      // corbeille staff — avant la carte, sinon le clic déclencherait le renouvellement
      var sup = ev.target.closest(".bfc-suppr");
      if (sup) {
        ev.stopPropagation();
        if (typeof NS.supprimerCarte === "function") NS.supprimerCarte(sup.getAttribute("data-cle"));
        else if (window.console) console.warn("[BottinFC] supprimerCarte pas branché (bottin-fc-admin absent ?).");
        return;
      }

      if (ev.target.closest(".bfc-lien")) return;   // lien profil / pré-lien : on laisse naviguer

      var carte = ev.target.closest(".bfc-carte--renouvelable");
      if (carte) {
        if (typeof NS.renouvelerCarte === "function") NS.renouvelerCarte(carte.getAttribute("data-cle"));
        else if (window.console) console.warn("[BottinFC] renouvelerCarte pas branché (bottin-fc-form absent ?).");
      }
    });
  }

  /* === INIT === */

  // Attend que l'ancre existe (FA injecte le DOM tardivement) ET qu'EcoCore soit prêt.
  function quandPret(cb, n) {
    n = n || 0;
    var ancre = document.querySelector(CFG.SEL_ANCRE);
    var coeurPret = window.EcoCore && typeof EcoCore.safeReadBin === "function";
    if (ancre && coeurPret) { cb(ancre); return; }
    if (n > CFG.ATTENTE_MAX) {
      if (window.console) console.warn("[BottinFC] ancre ou EcoCore introuvable — vérifier l'ordre de chargement (après eco-core).");
      return;
    }
    setTimeout(function () { quandPret(cb, n + 1); }, CFG.ATTENTE_PAS);
  }

  // L'overlay est créé une seule fois ; les appels suivants le réutilisent.
  function monterOverlay() {
    if (S.rep && S.rep.isConnected) return S.rep;
    var rep = document.createElement("div");
    rep.className = "bfc-rep";
    rep.innerHTML = construireChrome();
    document.body.appendChild(rep);          // cf. en-tête : échappe aux ancêtres du post
    S.rep = rep;
    brancherEvenements();
    return rep;
  }

  function message(txt, classe) {
    var el = $("bfc-stage");
    if (el) el.innerHTML = '<div class="' + (classe || "bfc-message") + '">' + txt + '</div>';
  }

  function demarrer() {
    quandPret(function () {
      monterOverlay();
      message(TEXTES.CHARGEMENT);
      EcoCore.safeReadBin().then(function (rec) {
        if (!rec) { message(TEXTES.ERREUR, "bfc-erreur"); return; }
        rendre(rec);
      }).catch(function (err) {
        message(TEXTES.ERREUR, "bfc-erreur");
        if (window.console) console.error("[BottinFC]", err);
      });
    });
  }

  /* === EXPORT === */
  NS.CFG = CFG;
  NS.TEXTES = TEXTES;
  NS.ICONES = ICONES;
  NS.rafraichir = demarrer;   // rappelé par les modules form / admin après écriture

  if (document.readyState === "complete") demarrer();
  else window.addEventListener("load", demarrer);

})(window.BottinFC);
