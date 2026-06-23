/*
 * bottin-fc.js — Bottin des faceclaims (RENDU) · The Drowned Lands
 *
 * CE QUE CE FICHIER FAIT : lit l'enregistrement Firebase via EcoCore, construit
 * et affiche la galerie des faceclaims dans la div .bottin-faceclaims, pose les
 * classes .bfc-membre / .bfc-admin selon l'utilisateur, et nettoie en arrière-plan
 * (best-effort) les réservations expirées (purge paresseuse, en lecture fraîche).
 * CE QU'IL NE FAIT PAS : aucune écriture de réservation, aucun formulaire, aucune
 * suppression admin — ces actions sont câblées à des points d'accroche (hooks)
 * que les modules à venir (formulaire, admin) rempliront.
 *
 * PRÉREQUIS : eco-core-v1-1.js chargé AVANT (expose window.EcoCore + gère l'auth).
 *
 * SCHÉMA LU (clés de l'enregistrement racine) :
 *   faceclaims/{cle_acteur} = { acteur, statut, type?, uid?, pseudo?,
 *                               image?, nom_prelien?, prelien_lien?, expiration? }
 *   faceclaims_uid/{uid}    = [cle_acteur, ...]   (index inverse, pour la purge)
 *   uid_index/{uid}         = pseudo              (résolution d'affichage)
 *
 * HOOKS (définis par les modules à venir) :
 *   BottinFC.ouvrirReservation()      → ouvre le formulaire (module formulaire)
 *   BottinFC.supprimerCarte(cle)      → suppression admin d'une carte (module admin)
 *
 * CARTE DES BLOCS : CONFIG · TEXTES · UTILS · RENDER · PURGE · EVENTS · INIT
 */

window.BottinFC = window.BottinFC || {};
(function (NS) {
  "use strict";

  /* === CONFIG === */
  var CFG = {
    SEL_ANCRE:   ".bottin-faceclaims",  // [MAJ] div d'ancrage dans le post faceclaims
    PROFIL_URL:  "/u",                  // [MAJ] préfixe profil ForumActif : /u{uid}
    ATTENTE_MAX: 60,                    // tentatives d'attente EcoCore (× ATTENTE_PAS)
    ATTENTE_PAS: 250,                   // ms entre deux tentatives
    PURGE_ACTIVE: true,                 // nettoyage paresseux des cartes expirées
  };

  // [MAJ] Classes d'icônes (familles uicons chargées sur le forum)
  var ICONES = {
    profil:  "fi fi-rr-id-badge",
    prelien: "fi fi-rr-link",
    horloge: "fi fi-rr-clock",
    suppr:   "fi fi-rr-trash",
    avatar:  "fi fi-rr-user",
  };

  /* === TEXTES === */
  var TEXTES = {
    BTN_RESERVER: "Réserver un faceclaim",
    LEG_PRIS:     "pris",
    LEG_RESERVE:  "réservé",
    LEG_LIBRE:    "pré-lien libre",
    MC:           "MC",
    SUPPR_TITRE:  "Supprimer cette carte",
    RENOUV_TITRE: "Renouveler la réservation (+1 mois)",
    CHARGEMENT:   "Chargement du bottin…",
    VIDE:         "Aucun faceclaim enregistré pour le moment.",
    ERREUR:       "Impossible de charger le bottin des faceclaims.",
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

  function resoudrePseudo(rec, carte) {
    var idx = rec.uid_index || {};
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

  /* === RENDER === */

  function construireCarte(cle, c, rec, now, u) {
    var statut = c.statut || "reserve";
    var classeStatut = statut === "pris" ? "bfc-carte--pris"
                     : statut === "libre" ? "bfc-carte--libre"
                     : "bfc-carte--reserve";
    var nomActeur = esc(c.acteur || cle);

    // Carte pré-lien renouvelable : détenteur (même UID) ou admin.
    var renouvelable = statut === "libre" && u && !u.invite
      && (u.admin || (c.uid != null && String(c.uid) === String(u.uid)));

    // --- photo : avatar capturé (pris) sinon pastille d'initiales ---
    var photo;
    if (statut === "pris" && c.image) {
      photo = '<img class="bfc-avatar" src="' + esc(c.image) + '" alt="' + nomActeur + '">';
    } else {
      var modeRond = (statut === "libre") ? "bfc-initiales--libre" : "bfc-initiales--reserve";
      photo = '<div class="bfc-initiales ' + modeRond + '">' + esc(initiales(c.acteur || cle)) + '</div>';
    }

    // --- overlay décompte (uniquement cartes à échéance) ---
    var overlay = c.expiration
      ? '<div class="bfc-overlay"><i class="' + ICONES.horloge + '"></i>' + joursRestants(c.expiration, now) + 'j</div>'
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

    var attrRenouv = renouvelable
      ? ' bfc-carte--renouvelable" data-cle="' + esc(cle) + '" title="' + TEXTES.RENOUV_TITRE + '"'
      : '"';

    return '<div class="bfc-carte ' + classeStatut + attrRenouv + '>'
         +   '<button class="bfc-suppr" type="button" data-cle="' + esc(cle) + '" title="' + TEXTES.SUPPR_TITRE + '"><i class="' + ICONES.suppr + '"></i></button>'
         +   '<p class="bfc-nom">' + nomActeur + '</p>'
         +   '<div class="bfc-bas">'
         +     '<div class="bfc-photo">' + photo + overlay + '</div>'
         +     '<div class="bfc-meta">' + meta + '</div>'
         +   '</div>'
         + '</div>';
  }

  function construireBarre() {
    return '<div class="bfc-barre">'
         +   '<button class="bfc-bouton" type="button">' + TEXTES.BTN_RESERVER + '</button>'
         +   '<div class="bfc-legende">'
         +     '<span><span class="bfc-pastille bfc-pastille--pris"></span> ' + TEXTES.LEG_PRIS + '</span>'
         +     '<span><span class="bfc-pastille bfc-pastille--reserve"></span> ' + TEXTES.LEG_RESERVE + '</span>'
         +     '<span><span class="bfc-pastille bfc-pastille--libre"></span> ' + TEXTES.LEG_LIBRE + '</span>'
         +   '</div>'
         + '</div>';
  }

  // Construit la galerie ; renvoie le HTML et les clés expirées à purger.
  function construireBottin(rec, now, u) {
    var fc = (rec && rec.faceclaims) || {};
    var entrees = Object.keys(fc)
      .map(function (cle) { return [cle, fc[cle]]; })
      .filter(function (e) { return e[1] && typeof e[1] === "object"; });

    var expirees = [];
    var vivants = entrees.filter(function (e) {
      if (estExpire(e[1], now)) { expirees.push(e); return false; }
      return true;
    });

    vivants.sort(function (a, b) {
      return String(a[1].acteur || a[0]).localeCompare(String(b[1].acteur || b[0]), "fr");
    });

    var grille = vivants.length
      ? '<div class="bfc-grille">' + vivants.map(function (e) { return construireCarte(e[0], e[1], rec, now, u); }).join("") + '</div>'
      : '<div class="bfc-message">' + TEXTES.VIDE + '</div>';

    return { html: construireBarre() + grille, clesExpirees: expirees };
  }

  function rendre(ancre, rec) {
    var u = infosUtilisateur();
    ancre.classList.toggle("bfc-membre", !u.invite);
    ancre.classList.toggle("bfc-admin", !!u.admin);

    var resultat = construireBottin(rec, Date.now(), u);
    ancre.innerHTML = resultat.html;
    brancherEvenements(ancre);

    if (CFG.PURGE_ACTIVE && !u.invite && resultat.clesExpirees.length) {
      purgerExpires(resultat.clesExpirees);
    }
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

  /* === EVENTS === */
  function brancherEvenements(ancre) {
    var btn = ancre.querySelector(".bfc-bouton");
    if (btn) btn.addEventListener("click", function () {
      if (typeof NS.ouvrirReservation === "function") NS.ouvrirReservation();
      else if (window.console) console.warn("[BottinFC] ouvrirReservation pas encore branché (module formulaire à venir).");
    });

    var supprs = ancre.querySelectorAll(".bfc-suppr");
    [].forEach.call(supprs, function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();   // ne pas déclencher le renouvellement de la carte
        var cle = b.getAttribute("data-cle");
        if (typeof NS.supprimerCarte === "function") NS.supprimerCarte(cle);
        else if (window.console) console.warn("[BottinFC] supprimerCarte pas encore branché (module admin à venir).");
      });
    });

    var renouv = ancre.querySelectorAll(".bfc-carte--renouvelable");
    [].forEach.call(renouv, function (carte) {
      carte.addEventListener("click", function (e) {
        if (e.target.closest(".bfc-lien")) return;   // clic sur le lien pré-lien → navigation
        var cle = carte.getAttribute("data-cle");
        if (typeof NS.renouvelerCarte === "function") NS.renouvelerCarte(cle);
        else if (window.console) console.warn("[BottinFC] renouvelerCarte pas encore branché (module formulaire à venir).");
      });
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

  function demarrer() {
    quandPret(function (ancre) {
      ancre.innerHTML = '<div class="bfc-message">' + TEXTES.CHARGEMENT + '</div>';
      EcoCore.safeReadBin().then(function (rec) {
        if (!rec) { ancre.innerHTML = '<div class="bfc-message">' + TEXTES.ERREUR + '</div>'; return; }
        rendre(ancre, rec);
      }).catch(function (err) {
        ancre.innerHTML = '<div class="bfc-message">' + TEXTES.ERREUR + '</div>';
        if (window.console) console.error("[BottinFC]", err);
      });
    });
  }

  /* === EXPORT === */
  NS.CFG = CFG;
  NS.TEXTES = TEXTES;
  NS.ICONES = ICONES;
  NS.rafraichir = demarrer;   // à rappeler après une écriture (modules à venir)

  if (document.readyState === "complete") demarrer();
  else window.addEventListener("load", demarrer);

})(window.BottinFC);
