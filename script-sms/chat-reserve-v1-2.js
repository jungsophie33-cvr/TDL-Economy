/* ============================================================
   chat-reserve.js — v3
   Réserve la lecture d'un sujet du forum WhatsApp à un ou
   plusieurs groupes (communautés ET/OU bandes), cochés par le
   staff via chat-reserve-admin.js.

   PRINCIPE : le sujet (et ses messages) RESTENT dans le forum
   WhatsApp ouvert, sur Forumactif. Ce script contrôle qui les voit :
   - Firebase est le juge de paix : le nœud acces_reserves/<clé>
     n'est lisible (règles RTDB) que du staff et des membres des
     groupes concernés, identité vérifiée par le pont fa-bridge
     (claims tdl_communautes / tdl_bandes). Personne ne peut se
     faire passer pour un Goulipiat depuis la console.
   - Déroulé sur chaque sujet WhatsApp :
       1. pré-masquage immédiat du fil (pas de flash de contenu) ;
       2. lecture de sujets_reserves/<idDuSujet> (.read public) ;
          absent ou actif:false -> sujet normal, on relâche tout ;
       3. présent -> tentative de lecture acces_reserves/<clé> AVEC
          le token EcoCore, pour CHAQUE clé du sujet, jusqu'à la
          première qui passe :
          - Firebase accepte -> membre d'au moins un groupe -> relâche ;
          - Firebase refuse partout (403) -> avertissement, posts retirés.
   - Le staff lit tout acces_reserves par règle : il voit donc
     TOUJOURS les sujets réservés.
   - Fermeture sur échec : en cas d'erreur réseau ou d'absence
     d'EcoCore (pas de token), un sujet réservé affiche
     l'avertissement. Mieux vaut un faux refus qu'une fuite.

   LIMITES ASSUMÉES (verrou d'affichage, pas de cryptage) :
   le HTML servi par FA contient les messages ; ils restent
   atteignables via la source, la recherche du forum, le flux RSS
   ou le profil "voir les messages" par un membre motivé.

   CHARGEMENT (ordre strict) :
     1. chat-whatsapp-v11-1-commun.js
     2. chat-whatsapp-v11-2-envoi.js
     3. chat-reserve-v3.js           <- ce fichier
     4. chat-reserve-admin.js        (panneau staff, optionnel)
     5. chat-whatsapp-v11-3-rendu.js  (inchangé : lit les drapeaux
        CW.reserveEnAttente / CW.reserveVerrouille)

   MÉTADONNÉES FIREBASE :
     sujets_reserves/<idSujet> = {
       "actif": true,                               // actif:false = désactivé
       "groupes": ["Les Goulipiats", "sorcieres"],  // clés de claims
       "libelles": { "Les Goulipiats": "Les Goulipiats", ... }
     }                                        // .read true, .write staff
     acces_reserves/<cle>     = { "ouverture": true }
                                               // .read = staff OU claims
                                               //   tdl_communautes /
                                               //   tdl_bandes pour <cle>,
                                               // .write staff
     Compatible avec l'ancien format v2 { communaute, cle }.

   CLÉS DE GROUPES : <cle> doit être EXACTEMENT une clé de claim
   du pont fa-bridge :
     - communauté : la valeur de membres/<pseudo>.group (le pont
       en fait une clé de tdl_communautes, ex. "Les Goulipiats") ;
     - bande : la clé machine de membres/<pseudo>.hors_la_loi
       (braconneurs, faiseuses, flottille, main, maringouins,
       sorcieres).

   AVERTISSEMENT : affiché dans .sj-wrap (classe du forum), en
   repli #sj-main puis body.

   STYLES : aucune règle CSS ici ; tout est dans la page CSS
   dédiée du forum (cw-reserve-attente, cw-reserve-warn).
   ============================================================ */
(function () {
  "use strict";

  var CW = window.CW11;
  if (!CW) return; /* fichiers chat absents : rien à faire */

  var CONFIG = CW.CONFIG;
  var $ = CW.$, $all = CW.$all;
  var estForumChat = CW.estForumChat, topicId = CW.topicId;

  /* URL de la base — même valeur que FIREBASE_CONFIG d'eco-core
     (non exportée). Lecture seule des métadonnées publiques,
     en repli sans token. */
  var DATABASE_URL = "https://thedrownedlands-b35b4-default-rtdb.europe-west1.firebasedatabase.app";

  /* Cible du bouton de retour affiché dans l'avertissement. */
  var URL_RETOUR = "https://thedrownedlands.forumactif.com/f2-whatsapp";

  /* Drapeaux lus par le fichier rendu :
     - reserveEnAttente : suspend le rendu chat le temps de trancher ;
     - reserveVerrouille : accès refusé — ni bulles, ni barre d'envoi. */
  CW.reserveEnAttente = false;
  CW.reserveVerrouille = false;

  var DEBUG = !!CONFIG.DEBUG;

  /* ===== RELÂCHER / VERROUILLER ===== */
  function relacher() {
    CW.reserveEnAttente = false;
    document.body.classList.remove("cw-reserve-attente");
  }

  function verrouiller(noms) {
    CW.reserveVerrouille = true;
    CW.reserveEnAttente = false;
    document.body.classList.remove("cw-reserve-attente");
    /* les posts sont retirés du DOM : le fil affiche l'avertissement */
    $all(".sj-postmsg").forEach(function (p) { p.remove(); });
    var w = document.createElement("div");
    w.className = "cw-reserve-warn";
    var icone = document.createElement("i");
    icone.className = "fi fi-rr-lock";
    w.appendChild(icone);
    w.appendChild(document.createTextNode(
      "Ce sujet est réservé à : " +
      (noms && noms.length ? noms.join(", ") : "un groupe restreint") + "."
    ));
    var retour = document.createElement("a");
    retour.className = "cw-reserve-retour";
    retour.href = URL_RETOUR;
    var icoRetour = document.createElement("i");
    icoRetour.className = "fi fi-rr-angle-left";
    retour.appendChild(icoRetour);
    retour.appendChild(document.createTextNode("Retour aux sujets WhatsApp"));
    w.appendChild(retour);
    (document.querySelector(".sj-wrap") ||
     document.querySelector("#sj-main") ||
     document.body).appendChild(w);
    if (DEBUG) console.log("[CW-reserve] accès refusé — avertissement affiché");
  }

  /* ===== LECTURES FIREBASE ===== */

  /* Métadonnées publiques : fonctionne avec ou sans token. */
  function lireSujetReserve(tid) {
    if (window.EcoCore && typeof window.EcoCore.firebaseGet === "function") {
      return window.EcoCore.firebaseGet("sujets_reserves/" + tid)
        .catch(function () { return lireRest("sujets_reserves/" + tid); });
    }
    return lireRest("sujets_reserves/" + tid);
  }

  function lireRest(chemin) {
    return fetch(DATABASE_URL + "/" + chemin + ".json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* Normalise les deux formats :
     - v3 : { actif, groupes: [cles], libelles }
     - v2 : { communaute, cle }   (ancien, un seul groupe)
     Renvoie null quand le sujet n'est PAS réservé (y compris
     actif:false : désactivation sans suppression du nœud). */
  function normaliser(res) {
    if (!res || res.actif === false) return null;
    var groupes = (Array.isArray(res.groupes) && res.groupes.length)
      ? res.groupes
      : (res.cle ? [res.cle] : []);
    if (!groupes.length) return null;
    var libelles = res.libelles || {};
    var noms = groupes.map(function (cle) {
      if (libelles[cle]) return libelles[cle];
      if (res.cle === cle && res.communaute) return res.communaute; /* v2 */
      return cle;
    });
    return { groupes: groupes, noms: noms };
  }

  /* LE contrôle d'accès : doit passer par EcoCore (token du pont).
     On essaie chaque clé du sujet jusqu'à la première acceptée.
     Les règles RTDB de acces_reserves tranchent selon les claims :
     - lecture OK -> membre d'au moins un groupe ;
     - 403 partout -> pas membre ;
     - pas de token / pas d'EcoCore -> fail-closed (refus). */
  /* eco-core peut se charger APRÈS ce script (ordre des balises) :
     on l'attend, borné, avant de trancher — un refus sans même
     avoir tenté le portillon serait un faux refus pour un membre
     légitime. Sans eco-core au bout du délai : fail-closed. */
  function attendreEcoCore(maxEssais) {
    return new Promise(function (resoudre) {
      var essais = 0;
      var timer = setInterval(function () {
        essais++;
        var ok = !!(window.EcoCore &&
          typeof window.EcoCore.firebaseGet === "function");
        if (ok || essais >= maxEssais) {
          clearInterval(timer);
          resoudre(ok);
        }
      }, CONFIG.POLL_INTERVAL);
    });
  }

  function testerAcces(cles) {
    return attendreEcoCore(15).then(function (pret) {
      if (!pret) {
        if (DEBUG) console.warn("[CW-reserve] eco-core jamais chargé — fail-closed");
        return false;
      }
      return tenterCles(cles);
    });
  }

  function tenterCles(cles) {
    var index = 0;
    function suivant() {
      if (index >= cles.length) return Promise.resolve(false);
      var cle = cles[index++];
      return window.EcoCore.firebaseGet("acces_reserves/" + cle)
        .then(function () { return true; })
        .catch(function (e) {
          if (DEBUG) {
            console.warn("[CW-reserve] acces_reserves/" + cle + " refusé :",
              e && e.message);
          }
          return suivant();
        });
    }
    return suivant();
  }

  /* ===== PILOTAGE ===== */
  function trancher(tid) {
    lireSujetReserve(tid).then(function (res) {
      var info = normaliser(res);
      /* pas un sujet réservé : chat normal, relâchement immédiat */
      if (!info) {
        relacher();
        return;
      }
      if (DEBUG) console.log("[CW-reserve] sujet réservé :", info.groupes.join(", "));
      testerAcces(info.groupes).then(function (membre) {
        if (membre) {
          relacher();
          if (DEBUG) console.log("[CW-reserve] membre — conversation affichée");
        } else {
          verrouiller(info.noms);
        }
      });
    }).catch(function (e) {
      /* métadonnées illisibles : on ne peut pas savoir. Le sujet
         n'est pas confirmé réservé -> chat normal. */
      if (DEBUG) console.warn("[CW-reserve] lecture métadonnées échouée :", e);
      relacher();
    });
  }

  /* ===== INIT ===== */
  function activer() {
    var tid = topicId();
    if (!tid) return;
    /* pré-masquage immédiat, AVANT toute requête : personne ne voit
       le fil pendant la décision, membre ou pas. */
    CW.reserveEnAttente = true;
    document.body.classList.add("cw-reserve-attente");
    trancher(tid);
  }

  function init() {
    /* attendre le fil d'Ariane, comme le fichier rendu ; intervalle
       court pour masquer le plus tôt possible. */
    var essais = 0;
    var timer = setInterval(function () {
      essais++;
      if (!$(".sub-header-path") && essais < CONFIG.POLL_MAX) return;
      clearInterval(timer);
      if (!estForumChat()) return;
      activer();
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
