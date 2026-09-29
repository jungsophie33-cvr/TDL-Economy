/*
 * bottin-fc-admin-v2.js — Outil admin du bottin des faceclaims · The Drowned Lands
 *
 * REMPLACE bottin-fc-admin-v1.js. Seul le mode d'ouverture change : le panneau
 * n'est plus injecté dans une div .bfc-admin-panel posée dans un sujet staff,
 * il devient le contenu d'une modale ouverte par le bouton « Gestion staff »
 * de la barre du bottin (bottin-fc-v3.js, hook BottinFC.ouvrirGestion).
 * → La div .bfc-admin-panel n'est plus lue ; elle peut être retirée du sujet.
 *
 * CE QUE CE FICHIER FAIT :
 *   - définit BottinFC.supprimerCarte(cle) (anime les corbeilles du bottin) ;
 *   - définit BottinFC.ouvrirGestion() : modale de création des cinq types de
 *     cartes (pris / réservé 7j / multicompte / pré-lien libre / staff) ;
 *   - création par firebaseTransaction sur faceclaims/{acteur} (refus propre si
 *     occupé) + mise à jour de l'index inverse faceclaims_uid ;
 *   - pour les cartes « pris », récupère automatiquement l'URL d'avatar depuis
 *     le profil FA via l'UID.
 *
 * PRÉREQUIS : eco-core-v1-1.js puis bottin-fc-v3.js chargés AVANT.
 * SÉCURITÉ : toutes les actions sont gardées par EcoCore.ADMIN_USERS. Le bouton
 *   du bottin n'est masqué qu'en CSS aux non-staff — estAdmin() est donc
 *   revérifié ici, à l'ouverture comme à la soumission.
 * CSS : réutilise les classes existantes .fi-label / .fi-input / .fi-select /
 *       .fi-btn-ouvrir pour les champs, et le chrome de modale .bfc-form-*
 *       (déjà chargé pour la modale de réservation). Aucun style nouveau.
 *
 * CARTE DES BLOCS : CONFIG · TEXTES · UTILS · AVATAR · DONNÉES · UI
 *                   MODALE · EVENTS · HOOK
 */

window.BottinFC = window.BottinFC || {};
(function (NS) {
  "use strict";

  /* === CONFIG === */
  var CFG = {
    PROFIL_URL: "/u",                   // [MAJ] préfixe profil FA
    JOUR_MS: 86400000,
    // [MAJ] avatar sur la page de profil FA (/u{uid}) — id unique du thème TDL.
    SEL_AVATAR: ["#avatar_membre > img"],
  };

  // [MAJ] icône de fermeture de la modale (même que bottin-fc-form)
  var IC = { croix: "fi fi-rr-cross-small" };

  /* === TEXTES === */
  var T = {
    TITRE: "Bottin faceclaims — gestion staff",
    L_ACTEUR: "Nom complet du faceclaim",
    L_TYPE: "Type de carte",
    L_MEMBRE: "Membre associé",
    L_PRELIEN_NOM: "Nom du pré-lien (affiché)",
    L_PRELIEN_LIEN: "Lien vers la fiche du pré-lien",
    L_IMAGE: "Image d'illustration (URL, facultatif)",
    ERR_IMAGE: "⚠️ L'URL de l'image doit commencer par http.",
    L_DUREE: "Durée (jours, vide = sans échéance)",
    OPT_VIDE: "— choisir —",
    BTN: "Créer la carte",
    EN_COURS: "Création en cours…",
    CHARGEMENT: "Chargement…",
    OK: function (a) { return "✅ Carte « " + a + " » créée."; },
    ERR_ACTEUR: "⚠️ Le nom du faceclaim est requis.",
    ERR_MEMBRE: "⚠️ Sélectionne le membre associé.",
    ERR_UID: "⚠️ Impossible de résoudre l'UID de ce membre (il ne s'est peut-être jamais connecté).",
    ERR_PRELIEN: "⚠️ Le nom du pré-lien est requis.",
    ERR_OCCUPE: function (a) { return "⛔ Le faceclaim « " + a + " » est déjà pris ou réservé."; },
    ERR_GEN: "❌ Erreur lors de la création. Réessaie.",
    ERR_LECTURE: "❌ Lecture impossible. Ferme et réessaie.",
    CONFIRM_SUPPR: function (a) { return "Supprimer la carte « " + a + " » ?"; },
    NON_ADMIN: "Action réservée au staff.",
  };

  // Définition des types : libellé + champs requis
  var TYPES = {
    pris:         { label: "Pris (fiche validée)", membre: true,  prelien: false, duree: "aucune", avatar: true },
    validation7j: { label: "Réservé — 7 jours",    membre: true,  prelien: false, duree: 7,        avatar: false },
    multicompte:  { label: "Réservé — multicompte", membre: true, prelien: false, duree: "aucune", avatar: false },
    prelien:      { label: "Pré-lien libre",       membre: false, prelien: true,  duree: 30,       avatar: false },
    staff:        { label: "Réservation staff",    membre: false, prelien: false, duree: "libre",  avatar: false },
  };

  /* === UTILS === */
  function versTableau(v) {
    if (Array.isArray(v)) return v.slice();
    if (v && typeof v === "object") return Object.keys(v).map(function (k) { return v[k]; });
    return [];
  }

  // Clé normalisée : minuscules, accents retirés, caractères interdits Firebase éliminés.
  function normaliserCle(acteur) {
    return String(acteur || "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[.#$\[\]\/]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function estAdmin() {
    var E = window.EcoCore || {};
    var pseudo = (typeof E.getPseudo === "function") ? E.getPseudo() : null;
    var admins = E.ADMIN_USERS || [];
    return !!pseudo && admins.indexOf(pseudo) !== -1;
  }

  function membresTries(rec) {
    var m = (rec && rec.membres) || {};
    return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, "fr"); });
  }

  function uidDeMembre(rec, pseudo) {
    var m = (rec && rec.membres) || {};
    return (m[pseudo] && m[pseudo].uid != null) ? m[pseudo].uid : null;
  }

  /* === AVATAR (récupération auto via le profil FA) === */
  function recupererAvatar(uid) {
    return fetch(CFG.PROFIL_URL + uid).then(function (r) {
      if (!r.ok) return null;
      return r.text();
    }).then(function (html) {
      if (!html) return null;
      var doc = new DOMParser().parseFromString(html, "text/html"); // ne charge pas les images
      for (var i = 0; i < CFG.SEL_AVATAR.length; i++) {
        var img = doc.querySelector(CFG.SEL_AVATAR[i]);
        if (img && img.getAttribute("src")) return img.getAttribute("src");
      }
      return null;
    }).catch(function () { return null; });
  }

  /* === DONNÉES (écritures Firebase) === */

  // Crée une carte de façon atomique : refuse si l'acteur est déjà occupé.
  function creerCarte(cle, carteData) {
    return EcoCore.firebaseTransaction("faceclaims/" + cle, function (current) {
      if (current && typeof current === "object") {
        var e = new Error("OCCUPE"); e.code = "OCCUPE"; throw e;
      }
      return carteData;
    }).then(function () {
      if (carteData.uid == null) return;
      // Ajout à l'index inverse faceclaims_uid/{uid} (transaction d'append).
      return EcoCore.firebaseTransaction("faceclaims_uid/" + carteData.uid, function (current) {
        var liste = versTableau(current);
        if (liste.indexOf(cle) === -1) liste.push(cle);
        return liste;
      });
    });
  }

  // Suppression d'une carte + nettoyage de l'index inverse (PATCH multi-chemins).
  function supprimerCarte(cle) {
    if (!estAdmin()) { if (window.console) console.warn("[BottinFC-admin] " + T.NON_ADMIN); return; }
    EcoCore.invalidateCache && EcoCore.invalidateCache();
    return EcoCore.readBin().then(function (rec) {
      if (!rec) return;
      var c = (rec.faceclaims || {})[cle];
      if (!c) { NS.rafraichir && NS.rafraichir(); return; }
      if (!window.confirm(T.CONFIRM_SUPPR(c.acteur || cle))) return;

      var updates = {}; updates["faceclaims/" + cle] = null;
      if (c.uid != null) {
        var u = String(c.uid);
        var liste = versTableau((rec.faceclaims_uid || {})[u]).filter(function (k) { return k !== cle; });
        updates["faceclaims_uid/" + u] = liste.length ? liste : null;
      }
      return EcoCore.firebaseUpdate(updates).then(function () {
        NS.rafraichir && NS.rafraichir();
      });
    }).catch(function (err) { if (window.console) console.error("[BottinFC-admin] suppression", err); });
  }

  NS.supprimerCarte = supprimerCarte;   // hook utilisé par les corbeilles du bottin

  /* === UI (formulaire de création) ===
     Rendu dans .bfc-form-contenu : la modale fournit déjà la boîte, le titre
     reprend donc la classe de titre du formulaire de réservation. */
  function html(rec) {
    var opts = membresTries(rec).map(function (p) {
      return '<option value="' + p.replace(/"/g, "&quot;") + '">' + p + '</option>';
    }).join("");
    var typeOpts = Object.keys(TYPES).map(function (k) {
      return '<option value="' + k + '">' + TYPES[k].label + '</option>';
    }).join("");

    return ''
      + '<div class="bfc-adm">'
      +   '<p class="bfc-form-titre">' + T.TITRE + '</p>'
      +   '<label class="fi-label">' + T.L_ACTEUR + '</label>'
      +   '<input id="bfc-adm-acteur" class="fi-input" type="text" placeholder="Jeffrey Dean Morgan">'
      +   '<label class="fi-label">' + T.L_TYPE + '</label>'
      +   '<select id="bfc-adm-type" class="fi-select">' + typeOpts + '</select>'
      +   '<div id="bfc-adm-r-membre" class="fi-conditionnel">'
      +     '<label class="fi-label">' + T.L_MEMBRE + '</label>'
      +     '<select id="bfc-adm-membre" class="fi-select"><option value="">' + T.OPT_VIDE + '</option>' + opts + '</select>'
      +   '</div>'
      +   '<div id="bfc-adm-r-prenom" class="fi-conditionnel" style="display:none">'
      +     '<label class="fi-label">' + T.L_PRELIEN_NOM + '</label>'
      +     '<input id="bfc-adm-prenom" class="fi-input" type="text">'
      +     '<label class="fi-label">' + T.L_PRELIEN_LIEN + '</label>'
      +     '<input id="bfc-adm-prelien-lien" class="fi-input" type="text" placeholder="/t512-...">'
      +     '<label class="fi-label">' + T.L_IMAGE + '</label>'
      +     '<input id="bfc-adm-image" class="fi-input" type="text" placeholder="https://...">'
      +   '</div>'
      +   '<div id="bfc-adm-r-duree" class="fi-conditionnel" style="display:none">'
      +     '<label class="fi-label">' + T.L_DUREE + '</label>'
      +     '<input id="bfc-adm-duree" class="fi-input" type="number" min="1">'
      +   '</div>'
      +   '<button id="bfc-adm-creer" class="fi-btn-ouvrir" type="button">' + T.BTN + '</button>'
      +   '<div id="bfc-adm-resultat" style="margin-top:8px"></div>'
      + '</div>';
  }

  function majChamps(panel) {
    var t = TYPES[panel.querySelector("#bfc-adm-type").value] || TYPES.pris;
    panel.querySelector("#bfc-adm-r-membre").style.display = (t.membre || t === TYPES.staff || t.prelien) ? "block" : "block";
    // membre : requis pour pris/7j/mc, optionnel pour pré-lien/staff → toujours affiché
    panel.querySelector("#bfc-adm-r-prenom").style.display = t.prelien ? "block" : "none";
    var rDuree = panel.querySelector("#bfc-adm-r-duree");
    var champDuree = panel.querySelector("#bfc-adm-duree");
    if (t.duree === "aucune") { rDuree.style.display = "none"; }
    else if (t.duree === 7) { rDuree.style.display = "block"; champDuree.value = 7; champDuree.readOnly = true; }
    else if (t.duree === "libre") { rDuree.style.display = "block"; champDuree.readOnly = false; champDuree.value = ""; }
    else { rDuree.style.display = "block"; champDuree.readOnly = false; champDuree.value = t.duree; }
  }

  /* === EVENTS === */
  function afficherResultat(panel, msg, ok) {
    var el = panel.querySelector("#bfc-adm-resultat");
    el.textContent = msg;
    el.style.color = ok ? "green" : "var(--dark2)";
  }

  function soumettre(panel, rec) {
    if (!estAdmin()) { afficherResultat(panel, T.NON_ADMIN); return; }

    var typeKey = panel.querySelector("#bfc-adm-type").value;
    var t = TYPES[typeKey];
    var acteur = panel.querySelector("#bfc-adm-acteur").value.trim();
    var pseudo = panel.querySelector("#bfc-adm-membre").value;
    var dureeRaw = panel.querySelector("#bfc-adm-duree").value;

    if (!acteur) { afficherResultat(panel, T.ERR_ACTEUR); return; }
    var cle = normaliserCle(acteur);

    // résolution UID si un membre est sélectionné (obligatoire pour pris/7j/mc)
    var uid = null;
    if (pseudo) {
      uid = uidDeMembre(rec, pseudo);
      if (uid == null) { afficherResultat(panel, T.ERR_UID); return; }
    } else if (t.membre) {
      afficherResultat(panel, T.ERR_MEMBRE); return;
    }

    var carte = { acteur: acteur };
    if (typeKey === "pris") { carte.statut = "pris"; }
    else if (typeKey === "prelien") {
      var nom = panel.querySelector("#bfc-adm-prenom").value.trim();
      if (!nom) { afficherResultat(panel, T.ERR_PRELIEN); return; }
      carte.statut = "libre"; carte.nom_prelien = nom;
      var lien = panel.querySelector("#bfc-adm-prelien-lien").value.trim();
      if (lien) carte.prelien_lien = lien;
      var imagePrelien = panel.querySelector("#bfc-adm-image").value.trim();
      if (imagePrelien && !/^https?:\/\//i.test(imagePrelien)) { afficherResultat(panel, T.ERR_IMAGE); return; }
      if (imagePrelien) carte.image = imagePrelien;
    }
    else { carte.statut = "reserve"; carte.type = typeKey; }

    if (uid != null) { carte.uid = uid; if (pseudo) carte.pseudo = pseudo; }

    // échéance
    var jours = (t.duree === 7) ? 7 : (parseInt(dureeRaw) || null);
    if (t.duree !== "aucune" && jours) carte.expiration = Date.now() + jours * CFG.JOUR_MS;

    var btn = panel.querySelector("#bfc-adm-creer");
    btn.disabled = true; btn.textContent = T.EN_COURS;

    // avatar auto pour « pris », puis création atomique
    var avant = (typeKey === "pris" && uid != null)
      ? recupererAvatar(uid).then(function (url) { if (url) carte.image = url; })
      : Promise.resolve();

    avant.then(function () { return creerCarte(cle, carte); })
      .then(function () {
        afficherResultat(panel, T.OK(acteur), true);
        panel.querySelector("#bfc-adm-acteur").value = "";
        if (EcoCore.invalidateCache) EcoCore.invalidateCache();
        // Rafraîchit le bottin DERRIÈRE la modale : celle-ci reste ouverte pour
        // enchaîner plusieurs créations sans avoir à la rouvrir à chaque carte.
        NS.rafraichir && NS.rafraichir();
      })
      .catch(function (err) {
        afficherResultat(panel, (err && err.code === "OCCUPE") ? T.ERR_OCCUPE(acteur) : T.ERR_GEN);
        if (err && err.code !== "OCCUPE" && window.console) console.error("[BottinFC-admin]", err);
      })
      .then(function () { btn.disabled = false; btn.textContent = T.BTN; });
  }

  /* === MODALE ===
     Même chrome que la modale de réservation (.bfc-form-overlay / -modal /
     -close / -contenu), reconstruit ici plutôt qu'importé de bottin-fc-form :
     les deux modules sont indépendants et l'un peut être chargé sans l'autre.
     Une trentaine de lignes dupliquées valent mieux qu'un ordre de chargement
     implicite entre deux fichiers qui ne se connaissent pas. */
  var overlayActif = null;

  function onEsc(e) { if (e.key === "Escape" && overlayActif) fermerModale(); }

  function ouvrirModale() {
    var ov = document.createElement("div");
    ov.className = "bfc-form-overlay";
    ov.innerHTML = '<div class="bfc-form-modal">'
      + '<button class="bfc-form-close" type="button" aria-label="Fermer"><i class="' + IC.croix + '"></i></button>'
      + '<div class="bfc-form-contenu"></div></div>';
    ov.addEventListener("click", function (e) { if (e.target === ov) fermerModale(); });
    ov.querySelector(".bfc-form-close").addEventListener("click", fermerModale);
    document.body.appendChild(ov);
    document.documentElement.style.overflow = "hidden";   // verrou sur <html> (iOS)
    document.addEventListener("keydown", onEsc);
    overlayActif = ov;
    return ov;
  }

  function fermerModale() {
    if (!overlayActif) return;
    document.documentElement.style.overflow = "";
    document.removeEventListener("keydown", onEsc);
    overlayActif.remove();
    overlayActif = null;
  }

  function remplir(zone, rec) {
    zone.innerHTML = html(rec);
    majChamps(zone);
    zone.querySelector("#bfc-adm-type").addEventListener("change", function () { majChamps(zone); });
    zone.querySelector("#bfc-adm-creer").addEventListener("click", function () { soumettre(zone, rec); });
  }

  /* === HOOK PUBLIC === */
  // Appelé par le bouton « Gestion staff » du bottin (bottin-fc-v3.js).
  // rec est relu à chaque ouverture : la liste des membres reste figée le temps
  // d'une session de modale, ce qui est sans risque — la création passe par
  // firebaseTransaction, qui refuse proprement un acteur déjà occupé.
  NS.ouvrirGestion = function () {
    if (!estAdmin()) return;
    if (overlayActif) return;                       // pas de double ouverture
    if (!window.EcoCore || typeof EcoCore.firebaseTransaction !== "function") {
      if (window.console) console.warn("[BottinFC-admin] EcoCore indisponible.");
      return;
    }

    var ov = ouvrirModale();
    var zone = ov.querySelector(".bfc-form-contenu");
    zone.innerHTML = '<p class="bfc-form-msg">' + T.CHARGEMENT + '</p>';

    EcoCore.safeReadBin()
      .then(function (rec) {
        if (!overlayActif) return;                  // fermée pendant la lecture
        remplir(zone, rec || {});
      })
      .catch(function (err) {
        if (overlayActif) zone.innerHTML = '<p class="bfc-form-msg err">' + T.ERR_LECTURE + '</p>';
        if (window.console) console.error("[BottinFC-admin] lecture", err);
      });
  };

})(window.BottinFC);
