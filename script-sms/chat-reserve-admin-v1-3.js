/* ============================================================
   chat-reserve-admin.js — v1
   Panneau staff : réserve le sujet WhatsApp courant à un ou
   plusieurs groupes (communautés et/ou bandes), en cochant,
   sans toucher à la console Firebase.

   AFFICHAGE : bouton "Réserver" dans l'en-tête du chat (cw-header,
   juste après la flèche retour), uniquement pour le staff :
   - pré-filtre Forumactif (_userdata.user_level >= 1) ;
   - confirmation par Firebase : lecture de la sentinelle
     chrono_journal (nœud staff-seulement dont la règle est EN
     PRODUCTION : le staff lit -> 200, même si le nœud est vide ;
     un non-staff reçoit 403). Ce test ne dépend PAS du
     déploiement des règles acces_reserves. Le bouton ne
     s'affiche qu'après.
   Même si un non-staff forçait l'affichage du bouton, les règles
   RTDB refuseraient ses écritures (write = staff uniquement).

   ÉCRITURES (via EcoCore, token du pont) — portillons d'abord,
   sujet en dernier (point de commit) :
   - acces_reserves/<cle> = { "ouverture": true } pour chaque case
     cochée -> le portillon que les règles ouvrent aux membres
     du groupe (claims tdl_communautes / tdl_bandes) ;
   - sujets_reserves/<tid> = { actif, groupes: [cles], libelles }
     -> lu par chat-reserve v3 pour trancher l'accès.
     Chaque writeField est atomique (un PUT, un nœud) ; la
     séquence ne l'est pas : un échec en cours laisse au pire
     le sujet public, jamais un sujet verrouillé sans portillon.
     Un nouvel appui sur Enregistrer répare.

   DÉSACTIVATION : le nœud reçoit { actif: false, groupes: [] }
   (pas de suppression nécessaire ; chat-reserve v3 traite
   actif:false comme "sujet public"). Les portillons restent en
   place : ils sont inoffensifs tant qu'aucun sujet actif ne
   référence la clé.

   CATALOGUE : les listes COMMUNAUTES et BANDES ci-dessous doivent
   reprendre EXACTEMENT les clés des claims du pont : pour une
   communauté, la valeur de membres/<pseudo>.group (ex. "Les
   Goulipiats") ; pour une bande, la clé machine de hors_la_loi
   (ex. "sorcieres"). Les libellés, eux, sont libres.

   CHARGEMENT (ordre strict) :
     1. chat-whatsapp-v11-1-commun.js
     2. chat-whatsapp-v11-2-envoi.js
     3. chat-reserve-v3.js
     4. chat-reserve-admin.js        <- ce fichier
     5. chat-whatsapp-v11-3-rendu.js

   STYLES : aucune règle CSS ici ; tout est dans la page CSS
   dédiée du forum (cw-admin-bouton, cw-admin-fond,
   cw-admin-panneau...).
   ============================================================ */
(function () {
  "use strict";

  var CW = window.CW11;
  if (!CW) return; /* fichiers chat absents : rien à faire */

  var CONFIG = CW.CONFIG;
  var $ = CW.$;
  var estForumChat = CW.estForumChat, topicId = CW.topicId;
  var DEBUG = !!CONFIG.DEBUG;

  /* ===== CATALOGUE DES GROUPES =====
     La clé DOIT être exactement une clé de claim du pont :
     - communauté : la valeur de membres/<pseudo>.group (le pont
       en fait une clé de tdl_communautes, ex. "Les Goulipiats") ;
     - bande : la clé machine de membres/<pseudo>.hors_la_loi
       (celles des règles, ex. tdl_bandes.sorcieres).
     Vérifiable via EcoCore.firebaseGet("membres/<pseudo>"). */
  /* même liste que COMMUNAUTES d'eco-core (clé = nom court,
     libellé = nom long). Providence n'est pas jouable : un sujet
     qui la coche ne sera lisible que du staff tant que personne
     n'a ce groupe — mais tout est prêt d'avance. */
  var COMMUNAUTES = [
    { cle: "Les Goulipiats", libelle: "Les Goulipiats" },
    { cle: "Les Fardoches", libelle: "Les Fardoches" },
    { cle: "Les Ashlanders", libelle: "Les Ashlanders" },
    { cle: "Les Spectres", libelle: "Les Spectres de Baron Samdi" },
    { cle: "Les Perles", libelle: "Les Perles de Cocodrie" },
    { cle: "Providence", libelle: "Main de la Providence" }
  ];
  var BANDES = [
    { cle: "braconneurs", libelle: "Braconneurs" },
    { cle: "faiseuses", libelle: "Faiseuses" },
    { cle: "flottille", libelle: "Flottille" },
    { cle: "main", libelle: "La Main" },
    { cle: "maringouins", libelle: "Maringouins" },
    { cle: "sorcieres", libelle: "Sorcières" }
  ];

  /* sentinelle STAFF : nœud lisible par le staff uniquement,
     déjà régi par les règles en production (chrono_journal).
     firebaseGet résout (données ou null) si les règles
     acceptent, rejette sur 403 sinon. Ne dépend PAS des
     nouvelles règles acces_reserves : le bouton apparaît
     même avant leur déploiement. */
  var SENTINELLE = "chrono_journal";
  var bouton = null, panneau = null, champActif = null, statut = null;
  var cases = {}; /* cle -> case à cocher */

  /* ===== PETITS OUTILS ===== */
  function libelleDe(cle) {
    var tous = COMMUNAUTES.concat(BANDES);
    for (var i = 0; i < tous.length; i++) {
      if (tous[i].cle === cle) return tous[i].libelle;
    }
    return cle; /* clé hors catalogue : on l'affiche telle quelle */
  }

  function fabriqueCase(groupe) {
    var l = document.createElement("label");
    var i = document.createElement("input");
    i.type = "checkbox";
    i.value = groupe.cle;
    l.appendChild(i);
    l.appendChild(document.createTextNode(groupe.libelle));
    cases[groupe.cle] = i;
    return l;
  }

  function section(titre, groupes) {
    var bloc = document.createElement("div");
    var h = document.createElement("div");
    h.className = "cw-section";
    h.textContent = titre;
    var grille = document.createElement("div");
    grille.className = "cw-grille";
    groupes.forEach(function (g) { grille.appendChild(fabriqueCase(g)); });
    bloc.appendChild(h);
    bloc.appendChild(grille);
    return bloc;
  }

  /* ===== BOUTON DANS L'EN-TÊTE DU CHAT ===== */
  function construireBouton(back) {
    bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "cw-admin-bouton";
    var icone = document.createElement("i");
    icone.className = "fi fi-rr-lock";
    var texte = document.createElement("span");
    texte.textContent = "Réserver";
    bouton.appendChild(icone);
    bouton.appendChild(texte);
    bouton.addEventListener("click", ouvrir);
    /* juste après la flèche retour */
    back.parentNode.insertBefore(bouton, back.nextSibling);
  }

  /* l'en-tête est construit par le fichier rendu (chargé après
     ce script) : on guette la flèche retour, puis on s'insère. */
  function placerBouton() {
    var essais = 0;
    var timer = setInterval(function () {
      essais++;
      var back = $(".cw-header .cw-back");
      if (back) {
        clearInterval(timer);
        construireBouton(back);
      } else if (essais >= CONFIG.POLL_MAX) {
        clearInterval(timer);
      }
    }, CONFIG.POLL_INTERVAL);
  }

  function majBouton(reserve) {
    if (!bouton) return;
    var texte = bouton.querySelector("span");
    if (reserve) {
      bouton.setAttribute("data-actif", "1");
      texte.textContent = "Sujet réservé";
    } else {
      bouton.removeAttribute("data-actif");
      texte.textContent = "Réserver";
    }
  }

  /* ===== PANNEAU ===== */
  function construirePanneau(tid) {
    var fond = document.createElement("div");
    fond.className = "cw-admin-fond";
    fond.hidden = true;
    fond.addEventListener("click", function (e) {
      if (e.target === fond) fermer(); /* clic hors panneau */
    });

    var p = document.createElement("div");
    p.className = "cw-admin-panneau";

    /* en-tête : titre + croix (à la manière de .eam-close) */
    var entete = document.createElement("div");
    entete.className = "cw-admin-entete";
    var h = document.createElement("h3");
    h.className = "cw-admin-titre";
    h.textContent = "Réservation du sujet";
    var croix = document.createElement("button");
    croix.type = "button";
    croix.className = "cw-admin-croix";
    croix.setAttribute("aria-label", "Fermer");
    croix.innerHTML = "&#10005;";
    croix.addEventListener("click", fermer);
    entete.appendChild(h);
    entete.appendChild(croix);

    var sujet = document.createElement("div");
    sujet.className = "cw-sujet";
    sujet.textContent = "Sujet n°" + tid + " — cochez qui peut le lire.";

    var actifLabel = document.createElement("label");
    champActif = document.createElement("input");
    champActif.type = "checkbox";
    actifLabel.appendChild(champActif);
    actifLabel.appendChild(document.createTextNode("Réserver ce sujet"));

    statut = document.createElement("div");
    statut.className = "cw-admin-statut";

    var bas = document.createElement("div");
    bas.className = "cw-admin-bas";
    var valider = document.createElement("button");
    valider.type = "button";
    valider.className = "cw-admin-valider";
    valider.textContent = "Enregistrer";
    valider.addEventListener("click", enregistrer);
    bas.appendChild(valider);

    p.appendChild(entete);
    p.appendChild(sujet);
    p.appendChild(actifLabel);
    p.appendChild(section("Communautés", COMMUNAUTES));
    p.appendChild(section("Bandes hors-la-loi", BANDES));
    p.appendChild(statut);
    p.appendChild(bas);
    fond.appendChild(p);
    document.body.appendChild(fond);
    /* Échap ferme aussi la fenêtre */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panneau && !panneau.hidden) fermer();
    });
    panneau = fond;
  }

  function ouvrir() {
    var tid = topicId();
    if (!tid) return;
    if (!panneau) construirePanneau(tid);
    panneau.hidden = false;
    chargerEtat(tid);
  }

  function fermer() {
    if (panneau) panneau.hidden = true;
  }

  /* ===== ÉTAT COURANT ===== */
  function chargerEtat(tid) {
    Object.keys(cases).forEach(function (c) { cases[c].checked = false; });
    champActif.checked = false;
    statut.textContent = "Chargement…";
    window.EcoCore.firebaseGet("sujets_reserves/" + tid).then(function (res) {
      var actif = !!(res && res.actif !== false &&
        ((Array.isArray(res.groupes) && res.groupes.length) || res.cle));
      if (actif) {
        var groupes = (Array.isArray(res.groupes) && res.groupes.length)
          ? res.groupes
          : (res.cle ? [res.cle] : []); /* ancien format v2 */
        groupes.forEach(function (c) {
          if (cases[c]) {
            cases[c].checked = true;
          } else if (DEBUG) {
            console.warn("[CW-admin] groupe hors catalogue :", c);
          }
        });
      }
      champActif.checked = actif;
      statut.textContent = "";
      majBouton(actif);
      if (DEBUG) console.log("[CW-admin] état chargé :", res);
    }).catch(function (e) {
      statut.textContent = "Lecture impossible.";
      if (DEBUG) console.warn("[CW-admin] lecture état :", e && e.message);
    });
  }

  /* ===== ENREGISTREMENT ===== */
  function enregistrer() {
    var tid = topicId();
    if (!tid || !window.EcoCore) return;
    var coches = Object.keys(cases).filter(function (c) { return cases[c].checked; });
    var actif = champActif.checked && coches.length > 0;

    if (champActif.checked && coches.length === 0) {
      statut.textContent =
        "Cochez au moins un groupe, ou décochez « Réserver ce sujet ».";
      return;
    }

    statut.textContent = "Enregistrement…";

    /* désactivation -> pierre tombale, pas de suppression */
    var ecriture;
    if (!actif) {
      /* désactivation : une seule écriture, atomique */
      ecriture = window.EcoCore.writeField("sujets_reserves/" + tid,
        { actif: false, groupes: [] });
    } else {
      var libelles = {};
      coches.forEach(function (c) { libelles[c] = libelleDe(c); });
      /* portillons d'abord (idempotents, inoffensifs tant que
         rien ne les référence), sujet en dernier = commit */
      var portillons = coches.map(function (c) {
        return window.EcoCore.writeField("acces_reserves/" + c,
          { ouverture: true });
      });
      ecriture = Promise.all(portillons).then(function () {
        return window.EcoCore.writeField("sujets_reserves/" + tid, {
          actif: true,
          groupes: coches,
          libelles: libelles
        });
      });
    }

    ecriture.then(function () {
      statut.textContent = "Enregistré.";
      majBouton(actif);
      if (DEBUG) console.log("[CW-admin] enregistré — actif =", actif, coches);
      setTimeout(fermer, 700);
    }).catch(function (e) {
      statut.textContent = "Échec : " + ((e && e.message) || "écriture refusée");
      if (DEBUG) console.warn("[CW-admin] écriture :", e);
    });
  }

  /* ===== STAFF ===== */
  function estStaffFA() {
    return window._userdata && Number(window._userdata.user_level || 0) >= 1;
  }

  /* Confirmation côté Firebase : la sentinelle est un nœud
     staff-seulement déjà régi par les règles en production.
     Le staff passe (200, données ou null), un non-staff
     reçoit 403. */
  function verifierStaff() {
    return window.EcoCore.firebaseGet(SENTINELLE)
      .then(function () { return true; })
      .catch(function () { return false; });
  }

  /* ===== INIT ===== */
  function init() {
    var essais = 0;
    var timer = setInterval(function () {
      essais++;
      /* le fil d'Ariane ET eco-core peuvent tous deux arriver après
         nous selon l'ordre des balises script : on attend les deux,
         avec le même budget de polling que le rendu du chat. */
      if ((!$(".sub-header-path") || !window.EcoCore) && essais < CONFIG.POLL_MAX) return;
      clearInterval(timer);
      /* uniquement sur les sujets du forum WhatsApp */
      if (!estForumChat() || !topicId()) return;
      /* filtre staff FA d'abord : pas de requête Firebase inutile */
      if (!estStaffFA()) {
        if (DEBUG) console.log("[CW-admin] hors staff FA — bouton ignoré");
        return;
      }
      if (!window.EcoCore || typeof window.EcoCore.firebaseGet !== "function") {
        console.warn("[CW-admin] eco-core jamais chargé sur cette page — bouton ignoré : ajoutez la balise eco-core au template de ces pages");
        return;
      }
      /* puis confirmation par les règles Firebase */
      verifierStaff().then(function (staff) {
        if (staff) {
          placerBouton();
          if (DEBUG) console.log("[CW-admin] staff confirmé — bouton branché sur l'en-tête");
        } else if (DEBUG) {
          console.warn("[CW-admin] staff NON confirmé par Firebase — sentinelle chrono_journal refusée (token du pont présent ?)");
        }
      });
    }, CONFIG.POLL_INTERVAL);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
