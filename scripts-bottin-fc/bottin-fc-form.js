/*
 * bottin-fc-form.js — Formulaire de réservation membre · The Drowned Lands
 *
 * CE QUE CE FICHIER FAIT : définit BottinFC.ouvrirReservation(), le hook appelé
 * par le bouton « Réserver un faceclaim » du bottin. Ouvre une modale à deux
 * étapes : choix du motif, puis le formulaire correspondant.
 *   - « Je construis ma fiche » → réservation 7 jours, GRATUITE.
 *   - « Je réserve un pré-lien » → création d'une carte libre, PAYANTE
 *     (100 $/mois, 1 à 3 mois), qui crée la carte (elle n'existe pas encore).
 *
 * PAIEMENT (motif éprouvé du bouton « don ») :
 *   1) lecture du solde ; 2) création de la carte par transaction (échoue AVANT
 *   tout débit si l'acteur est déjà pris) ; 3) débit par firebaseTransaction sur
 *   membres/{pseudo}/dollars avec re-contrôle des fonds ; 4) annulation de la
 *   carte si le débit échoue. L'occupation ne touche donc jamais à l'argent.
 *
 * PRÉREQUIS : eco-core-v1-1.js puis bottin-fc.js chargés AVANT (pour
 *   EcoCore.* et BottinFC.rafraichir). CSS : bottin-fc-form.css.
 *
 * CARTE DES BLOCS : CONFIG · TEXTES · UTILS · DONNÉES · MODALE · ÉCRANS · SOUMISSION
 */

window.BottinFC = window.BottinFC || {};
(function (NS) {
  "use strict";

  /* === CONFIG === */
  var CFG = {
    COUT_MENSUEL: 100,     // $ par mois de réservation pré-lien
    MAX_MOIS: 3,           // durée maximale de réservation pré-lien
    JOURS_7J: 7,
    JOURS_MOIS: 30,        // 1 « mois » = 30 jours (cohérent avec le renouvellement)
    JOUR_MS: 86400000,
  };

  // [MAJ] icônes uicons
  var IC = { horloge: "fi fi-rr-clock", coins: "fi fi-rr-coins", croix: "fi fi-rr-cross-small" };

  /* === TEXTES === */
  var T = {
    TITRE: "Réserver un faceclaim",
    M7_TITRE: "Je construis ma fiche",
    M7_SOUS: "Réservation 7 jours (gratuite)",
    MP_TITRE: "Je réserve un pré-lien",
    MP_SOUS: "1 mois renouvelable (100 $/mois)",
    L_ACTEUR: "Faceclaim (nom complet)",
    L_NOM: "Nom du pré-lien (personnage affiché)",
    L_LIEN: "Lien vers la fiche du pré-lien",
    L_DUREE: "Durée",
    COUT_LIB: "Coût (100 $ / mois)",
    SOLDE: "Ton solde :",
    S_TITRE: "Réservation 7 jours",
    S_INFO: "Réservation gratuite de 7 jours pendant la rédaction de ta fiche. Au-delà, l'avatar redevient disponible.",
    S_BTN: "Réserver 7 jours",
    P_TITRE: "Réserver un pré-lien",
    P_BTN: "Payer et réserver",
    EN_COURS: "Traitement…",
    CHARGEMENT: "Chargement…",
    MOIS: function (n) { return n + (n > 1 ? " mois" : " mois"); },
    OK_7J: function (a) { return "✅ « " + a + " » réservé 7 jours."; },
    OK_PRELIEN: function (a, m) { return "✅ Pré-lien « " + a + " » réservé (−" + m + " $)."; },
    ERR_ACTEUR: "⚠️ Le nom du faceclaim est requis.",
    ERR_NOM: "⚠️ Le nom du pré-lien est requis.",
    ERR_OCCUPE: function (a) { return "⛔ « " + a + " » est déjà pris ou réservé."; },
    ERR_FONDS: "⛔ Fonds insuffisants.",
    ERR_GEN: "❌ Erreur. Réessaie.",
  };

  /* === UTILS === */
  function versTableau(v) {
    if (Array.isArray(v)) return v.slice();
    if (v && typeof v === "object") return Object.keys(v).map(function (k) { return v[k]; });
    return [];
  }

  function normaliserCle(acteur) {
    return String(acteur || "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[.#$\[\]\/]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function utilisateur() {
    var E = window.EcoCore || {};
    return {
      pseudo: (typeof E.getPseudo === "function") ? E.getPseudo() : null,
      uid: (typeof E.getUserId === "function") ? E.getUserId() : 0,
    };
  }

  /* === DONNÉES (lectures / écritures Firebase) === */
  function lireSolde(pseudo) {
    return EcoCore.readBin().then(function (rec) {
      return (rec && rec.membres && rec.membres[pseudo] && rec.membres[pseudo].dollars) || 0;
    });
  }

  // Création atomique : refuse si l'acteur est déjà occupé, puis indexe l'UID.
  function creerCarte(cle, carte) {
    return EcoCore.firebaseTransaction("faceclaims/" + cle, function (current) {
      if (current && typeof current === "object") {
        var e = new Error("OCCUPE"); e.code = "OCCUPE"; throw e;
      }
      return carte;
    }).then(function () {
      if (carte.uid == null) return;
      return EcoCore.firebaseTransaction("faceclaims_uid/" + carte.uid, function (current) {
        var l = versTableau(current);
        if (l.indexOf(cle) === -1) l.push(cle);
        return l;
      });
    });
  }

  // Annulation (rollback) : suppression de la carte + retrait de l'index inverse.
  function annulerCarte(cle, uid) {
    var u = {}; u["faceclaims/" + cle] = null;
    var p1 = EcoCore.firebaseUpdate(u);
    var p2 = (uid != null)
      ? EcoCore.firebaseTransaction("faceclaims_uid/" + uid, function (cur) {
          return versTableau(cur).filter(function (k) { return k !== cle; });
        })
      : Promise.resolve();
    return Promise.all([p1, p2]);
  }

  // Débit atomique avec re-contrôle des fonds côté serveur (motif « don »).
  function debiter(pseudo, montant) {
    return EcoCore.firebaseTransaction(
      "membres/" + encodeURIComponent(pseudo) + "/dollars",
      function (cur) {
        var s = cur || 0;
        if (s < montant) { var e = new Error("FONDS"); e.code = "FONDS"; throw e; }
        return s - montant;
      }
    );
  }

  function journaliser(pseudo, montant, acteur) {
    try {
      EcoCore.firebasePush("transactions_membres", {
        date: new Date().toISOString(), de: pseudo, vers: "Réservation pré-lien",
        montant: montant, motif: "Pré-lien " + acteur,
      }).catch(function () {});
    } catch (e) { /* journalisation best-effort */ }
  }

  function majSoldeAffiche() {
    var el = document.querySelector("#sj-dollars");   // [MAJ] affichage du solde
    if (!el) return;
    lireSolde(utilisateur().pseudo).then(function (s) { el.textContent = s; }).catch(function () {});
  }

  /* === MODALE (création, verrou, fermeture) === */
  var overlayActif = null;

  function onEsc(e) { if (e.key === "Escape" && overlayActif) fermer(); }

  function ouvrir() {
    var ov = document.createElement("div");
    ov.className = "bfc-form-overlay";
    ov.innerHTML = '<div class="bfc-form-modal">'
      + '<button class="bfc-form-close" type="button" aria-label="Fermer"><i class="' + IC.croix + '"></i></button>'
      + '<div class="bfc-form-contenu"></div></div>';
    ov.addEventListener("click", function (e) { if (e.target === ov) fermer(); });
    ov.querySelector(".bfc-form-close").addEventListener("click", fermer);
    document.body.appendChild(ov);
    document.documentElement.style.overflow = "hidden";   // verrou sur <html> (iOS)
    document.addEventListener("keydown", onEsc);
    overlayActif = ov;
    return ov;
  }

  function fermer() {
    if (!overlayActif) return;
    document.documentElement.style.overflow = "";
    document.removeEventListener("keydown", onEsc);
    overlayActif.remove();
    overlayActif = null;
  }

  function contenu(ov) { return ov.querySelector(".bfc-form-contenu"); }
  function champ(ov, sel) { var el = ov.querySelector(sel); return el ? el.value.trim() : ""; }

  function message(ov, texte, cls) {
    var el = ov.querySelector("#bfc-f-msg");
    if (el) { el.textContent = texte; el.className = "bfc-form-msg " + (cls || ""); }
  }

  function bloquer(ov, b) {
    var btn = ov.querySelector("#bfc-f-go");
    if (!btn) return;
    btn.disabled = b;
    if (b) { btn.dataset._t = btn.textContent; btn.textContent = T.EN_COURS; }
    else if (btn.dataset._t) { btn.textContent = btn.dataset._t; }
  }

  function succes(ov, texte) {
    message(ov, texte, "ok");
    if (EcoCore.invalidateCache) EcoCore.invalidateCache();
    majSoldeAffiche();
    setTimeout(function () { fermer(); if (NS.rafraichir) NS.rafraichir(); }, 1400);
  }

  /* === ÉCRANS === */
  function optionsMois() {
    var o = "";
    for (var i = 1; i <= CFG.MAX_MOIS; i++) o += '<option value="' + i + '">' + T.MOIS(i) + "</option>";
    return o;
  }

  function ecranMotif(ov) {
    contenu(ov).innerHTML =
        '<p class="bfc-form-titre">' + T.TITRE + '</p>'
      + '<button class="bfc-form-choix" data-m="sept"><b>' + T.M7_TITRE + '</b><span><i class="' + IC.horloge + '"></i> ' + T.M7_SOUS + '</span></button>'
      + '<button class="bfc-form-choix" data-m="prelien"><b>' + T.MP_TITRE + '</b><span><i class="' + IC.coins + '"></i> ' + T.MP_SOUS + '</span></button>';
    [].forEach.call(contenu(ov).querySelectorAll(".bfc-form-choix"), function (b) {
      b.addEventListener("click", function () {
        if (b.getAttribute("data-m") === "sept") ecranSept(ov);
        else ecranPrelienAttente(ov);
      });
    });
  }

  function ecranSept(ov) {
    contenu(ov).innerHTML =
        '<p class="bfc-form-titre">' + T.S_TITRE + '</p>'
      + '<p class="bfc-form-info">' + T.S_INFO + '</p>'
      + '<label class="bfc-form-label">' + T.L_ACTEUR + '</label>'
      + '<input class="bfc-form-input" id="bfc-f-acteur" type="text" placeholder="Nom du Faceclaim">'
      + '<button class="bfc-form-go" id="bfc-f-go" type="button">' + T.S_BTN + '</button>'
      + '<div class="bfc-form-msg" id="bfc-f-msg"></div>';
    ov.querySelector("#bfc-f-go").addEventListener("click", function () { soumettreSept(ov); });
  }

  function ecranPrelienAttente(ov) {
    contenu(ov).innerHTML = '<p class="bfc-form-msg">' + T.CHARGEMENT + '</p>';
    lireSolde(utilisateur().pseudo).then(function (solde) { ecranPrelien(ov, solde); })
      .catch(function () { ecranPrelien(ov, 0); });
  }

  function ecranPrelien(ov, solde) {
    contenu(ov).innerHTML =
        '<p class="bfc-form-titre">' + T.P_TITRE + '</p>'
      + '<label class="bfc-form-label">' + T.L_ACTEUR + '</label>'
      + '<input class="bfc-form-input" id="bfc-f-acteur" type="text" placeholder="Nom du Faceclaim">'
      + '<label class="bfc-form-label">' + T.L_NOM + '</label>'
      + '<input class="bfc-form-input" id="bfc-f-nom" type="text" placeholder="Nom du PL">'
      + '<label class="bfc-form-label">' + T.L_LIEN + '</label>'
      + '<input class="bfc-form-input" id="bfc-f-lien" type="text" placeholder="/t512-...">'
      + '<label class="bfc-form-label">' + T.L_DUREE + '</label>'
      + '<select class="bfc-form-select" id="bfc-f-mois">' + optionsMois() + '</select>'
      + '<div class="bfc-form-cout"><span class="bfc-form-cout-lib">' + T.COUT_LIB + '</span><span class="bfc-form-cout-val" id="bfc-f-cout">' + CFG.COUT_MENSUEL + ' $</span></div>'
      + '<div class="bfc-form-solde">' + T.SOLDE + ' ' + solde + ' $</div>'
      + '<button class="bfc-form-go" id="bfc-f-go" type="button">' + T.P_BTN + '</button>'
      + '<div class="bfc-form-msg" id="bfc-f-msg"></div>';

    var sel = ov.querySelector("#bfc-f-mois");
    var btn = ov.querySelector("#bfc-f-go");
    function maj() {
      var mois = parseInt(sel.value) || 1;
      var cout = mois * CFG.COUT_MENSUEL;
      ov.querySelector("#bfc-f-cout").textContent = cout + " $";
      btn.disabled = solde < cout;
    }
    sel.addEventListener("change", maj);
    maj();
    btn.addEventListener("click", function () { soumettrePrelien(ov); });
  }

  /* === SOUMISSION === */
  function soumettreSept(ov) {
    var u = utilisateur();
    var acteur = champ(ov, "#bfc-f-acteur");
    if (!acteur) { message(ov, T.ERR_ACTEUR, "err"); return; }

    var carte = {
      acteur: acteur, statut: "reserve", type: "validation7j",
      uid: u.uid, pseudo: u.pseudo,
      expiration: Date.now() + CFG.JOURS_7J * CFG.JOUR_MS,
    };
    bloquer(ov, true);
    creerCarte(normaliserCle(acteur), carte)
      .then(function () { succes(ov, T.OK_7J(acteur)); })
      .catch(function (err) {
        bloquer(ov, false);
        message(ov, (err && err.code === "OCCUPE") ? T.ERR_OCCUPE(acteur) : T.ERR_GEN, "err");
      });
  }

  function soumettrePrelien(ov) {
    var u = utilisateur();
    var acteur = champ(ov, "#bfc-f-acteur");
    var nom = champ(ov, "#bfc-f-nom");
    var lien = champ(ov, "#bfc-f-lien");
    var mois = parseInt(champ(ov, "#bfc-f-mois")) || 1;
    if (!acteur) { message(ov, T.ERR_ACTEUR, "err"); return; }
    if (!nom) { message(ov, T.ERR_NOM, "err"); return; }

    var montant = mois * CFG.COUT_MENSUEL;
    var cle = normaliserCle(acteur);
    var carte = {
      acteur: acteur, statut: "libre", uid: u.uid, pseudo: u.pseudo,
      nom_prelien: nom, expiration: Date.now() + mois * CFG.JOURS_MOIS * CFG.JOUR_MS,
    };
    if (lien) carte.prelien_lien = lien;

    bloquer(ov, true);
    creerCarte(cle, carte)
      .then(function () {
        // débit ; si échec, on annule la carte pour ne rien laisser d'incohérent
        return debiter(u.pseudo, montant).catch(function (err) {
          return annulerCarte(cle, u.uid).then(function () { throw err; });
        });
      })
      .then(function () {
        journaliser(u.pseudo, montant, acteur);
        succes(ov, T.OK_PRELIEN(acteur, montant));
      })
      .catch(function (err) {
        bloquer(ov, false);
        var m = (err && err.code === "OCCUPE") ? T.ERR_OCCUPE(acteur)
              : (err && err.code === "FONDS") ? T.ERR_FONDS : T.ERR_GEN;
        message(ov, m, "err");
      });
  }

  /* === HOOK PUBLIC === */
  NS.ouvrirReservation = function () {
    var u = utilisateur();
    if (!u.pseudo || u.uid <= 0) return;          // invité : rien (bouton déjà masqué)
    if (!window.EcoCore || typeof EcoCore.firebaseTransaction !== "function") {
      if (window.console) console.warn("[BottinFC-form] EcoCore indisponible.");
      return;
    }
    ecranMotif(ouvrir());
  };

})(window.BottinFC);
