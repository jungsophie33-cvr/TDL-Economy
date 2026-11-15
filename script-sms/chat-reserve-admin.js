/* ============================================================
   chat-reserve-admin.js — v1
   Panneau staff : réserve le sujet WhatsApp courant à un ou
   plusieurs groupes (communautés et/ou bandes), en cochant,
   sans toucher à la console Firebase.

   AFFICHAGE : bouton flottant "Réserver" en haut à droite des
   sujets WhatsApp, uniquement pour le staff :
   - pré-filtre Forumactif (_userdata.user_level >= 1) ;
   - confirmation par Firebase : lecture de la sentinelle
     acces_reserves/__staff__ (les règles accordent au staff la
     lecture de tout enfant du nœud, même inexistant -> null ;
     un non-staff reçoit 403). Le bouton ne s'affiche qu'après.
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
  var COMMUNAUTES = [
    { cle: "Les Goulipiats", libelle: "Les Goulipiats" },
    { cle: "Les Fardoches", libelle: "Les Fardoches" }
  ];
  var BANDES = [
    { cle: "braconneurs", libelle: "Braconneurs" },
    { cle: "faiseuses", libelle: "Faiseuses" },
    { cle: "flottille", libelle: "Flottille" },
    { cle: "main", libelle: "La Main" },
    { cle: "maringouins", libelle: "Maringouins" },
    { cle: "sorcieres", libelle: "Sorci\u00E8res" }
  ];

  var SENTINELLE = "acces_reserves/__staff__";
  var bouton = null, panneau = null, champActif = null, statut = null;
  var cases = {}; /* cle -> case \u00E0 cocher */

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

  /* ===== BOUTON FLOTTANT ===== */
  function construireBouton() {
    bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "cw-admin-bouton";
    var icone = document.createElement("i");
    icone.className = "fi fi-rr-lock";
    var texte = document.createElement("span");
    texte.textContent = "R\u00E9server";
    bouton.appendChild(icone);
    bouton.appendChild(texte);
    bouton.addEventListener("click", ouvrir);
    document.body.appendChild(bouton);
  }

  function majBouton(reserve) {
    if (!bouton) return;
    var texte = bouton.querySelector("span");
    if (reserve) {
      bouton.setAttribute("data-actif", "1");
      texte.textContent = "Sujet r\u00E9serv\u00E9";
    } else {
      bouton.removeAttribute("data-actif");
      texte.textContent = "R\u00E9server";
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

    var h = document.createElement("h3");
    h.textContent = "R\u00E9servation du sujet";
    var sujet = document.createElement("div");
    sujet.className = "cw-sujet";
    sujet.textContent = "Sujet n\u00B0" + tid + " \u2014 cochez qui peut le lire.";

    var actifLabel = document.createElement("label");
    champActif = document.createElement("input");
    champActif.type = "checkbox";
    actifLabel.appendChild(champActif);
    actifLabel.appendChild(document.createTextNode("R\u00E9server ce sujet"));

    statut = document.createElement("div");
    statut.className = "cw-admin-statut";

    var bas = document.createElement("div");
    bas.className = "cw-admin-bas";
    var valider = document.createElement("button");
    valider.type = "button";
    valider.className = "cw-admin-valider";
    valider.textContent = "Enregistrer";
    valider.addEventListener("click", enregistrer);
    var fermerBtn = document.createElement("button");
    fermerBtn.type = "button";
    fermerBtn.className = "cw-admin-fermer";
    fermerBtn.textContent = "Fermer";
    fermerBtn.addEventListener("click", fermer);
    bas.appendChild(valider);
    bas.appendChild(fermerBtn);

    p.appendChild(h);
    p.appendChild(sujet);
    p.appendChild(actifLabel);
    p.appendChild(section("Communaut\u00E9s", COMMUNAUTES));
    p.appendChild(section("Bandes hors-la-loi", BANDES));
    p.appendChild(statut);
    p.appendChild(bas);
    fond.appendChild(p);
    document.body.appendChild(fond);
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
    statut.textContent = "Chargement\u2026";
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
      if (DEBUG) console.log("[CW-admin] \u00E9tat charg\u00E9 :", res);
    }).catch(function (e) {
      statut.textContent = "Lecture impossible.";
      if (DEBUG) console.warn("[CW-admin] lecture \u00E9tat :", e && e.message);
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
        "Cochez au moins un groupe, ou d\u00E9cochez \u00AB R\u00E9server ce sujet \u00BB.";
      return;
    }

    statut.textContent = "Enregistrement\u2026";

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
      statut.textContent = "Enregistr\u00E9.";
      majBouton(actif);
      if (DEBUG) console.log("[CW-admin] enregistr\u00E9 \u2014 actif =", actif, coches);
      setTimeout(fermer, 700);
    }).catch(function (e) {
      statut.textContent = "\u00C9chec : " + ((e && e.message) || "\u00E9criture refus\u00E9e");
      if (DEBUG) console.warn("[CW-admin] \u00E9criture :", e);
    });
  }

  /* ===== STAFF ===== */
  function estStaffFA() {
    return window._userdata && Number(window._userdata.user_level || 0) >= 1;
  }

  /* Confirmation c\u00F4t\u00E9 Firebase : les règles de acces_reserves
     laissent le staff lire n'importe quel enfant (même inexistant
     -> null) ; un non-staff reçoit 403. */
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
      if (!$(".sub-header-path") && essais < CONFIG.POLL_MAX) return;
      clearInterval(timer);
      /* uniquement sur les sujets du forum WhatsApp */
      if (!estForumChat() || !topicId()) return;
      /* double filtre staff : FA d'abord (pas de requête inutile),
         puis confirmation par les règles Firebase. */
      if (!estStaffFA()) return;
      if (!window.EcoCore || typeof window.EcoCore.firebaseGet !== "function") {
        if (DEBUG) console.warn("[CW-admin] EcoCore absent : panneau ignor\u00E9");
        return;
      }
      verifierStaff().then(function (staff) {
        if (staff) {
          construireBouton();
          if (DEBUG) console.log("[CW-admin] staff \u2014 bouton affich\u00E9");
        } else if (DEBUG) {
          console.log("[CW-admin] staff non confirm\u00E9 par Firebase");
        }
      });
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
