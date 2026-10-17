/*
 * tdl-index-compteurs.js — Relevé des compteurs de l'accueil · The Drowned Lands
 *
 * CE QUE CE FICHIER FAIT : compte ce qu'un joueur peut encore rejoindre dans
 * les six tableaux du forum, et écrit le résultat dans « accueil/compteurs ».
 * La page d'accueil n'a plus qu'une fiche de 300 octets à lire.
 *
 * POURQUOI UN SEUL FICHIER PLUTÔT QUE CINQ PATCHS : un seul endroit où les
 * statuts sont interprétés, un seul moment d'écriture, et un compteur de plus
 * se branche en ajoutant une entrée au registre SOURCES. Les tableaux eux-mêmes
 * ne sont pas touchés.
 *
 * OÙ IL TOURNE : sur TOUTES les pages, mais pour le STAFF seulement. Le limiter
 * à l'accueil reviendrait à ne jamais le lancer, puisque le staff y passe moins
 * que sur les tableaux. Un relevé de moins d'une heure interrompt tout avant la
 * moindre lecture : le coût ordinaire est une seule lecture de 40 octets.
 *
 * LE STAFF-ONLY EST UNE CONVENTION, PAS UNE GARANTIE : les règles Firebase du
 * forum autorisent l'écriture à tout membre authentifié. Ce filtre évite les
 * écritures inutiles, il n'empêche personne de mal faire.
 *
 * CE QU'IL N'ÉCRIT PAS : evenements et projets, dont les modules n'existent pas
 * encore. L'accueil affiche 00 et désactive la case, ce qui est exact.
 *
 * SCHÉMA ÉCRIT
 *   accueil/compteurs/missions/{maringouins|main|faiseuses|operations|
 *                               disparitions|marees}
 *   accueil/compteurs/enquetes
 *   accueil/compteurs/maj          ISO du relevé
 *
 * PRÉREQUIS : eco-core chargé AVANT.
 *
 * CARTE DES BLOCS : CONFIG · UTILS · SOURCES · RELEVÉ · INIT
 */
(function () {
  "use strict";
  if (window.TDLICompteurs) return;

  /* ===================== CONFIG ===================== */
  var CFG = {
    NOEUD:   "accueil/compteurs",
    TTL_MS:  60 * 60 * 1000,   // un relevé par heure suffit largement
    DELAI:   4000,             // on laisse la page finir de se monter
    ATTENTE_MAX: 40, ATTENTE_PAS: 250
  };

  /* ===================== UTILS ===================== */

  function E() { return window.EcoCore; }
  function pret() { return !!(E() && typeof E().firebaseGet === "function"); }
  function jrn(m) { if (window.console) console.warn("[TDLI compteurs] " + m); }

  function estStaff() {
    try { var u = window._userdata; return !!(u && (u.user_level === 1 || u.user_level === 2)); }
    catch (e) { return false; }
  }

  /* Firebase rend un nœud à clés, parfois un tableau creux quand les clés sont
     numériques et contiguës : on filtre les trous dans les deux cas. */
  function entrees(n) {
    if (!n || typeof n !== "object") return [];
    return Object.keys(n).map(function (k) { return n[k]; })
                         .filter(function (x) { return x && typeof x === "object"; });
  }

  /* Les listes internes existent en deux schémas : tableau en v1, nœud à clés
     en v2. On ne compte que les entrées réelles, sans le sentinel « — » que
     roles portait avant la conversion. */
  function elements(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v !== "object") return [];
    return Object.keys(v).map(function (k) { return v[k]; }).filter(Boolean);
  }
  function aDesRoles(a) {
    return elements(a.roles).some(function (r) {
      var t = (typeof r === "string") ? r : (r && (r.txt || r.text || ""));
      return String(t || "").trim() && String(t).trim() !== "\u2014";
    });
  }

  /* ===================== SOURCES =====================
     Chaque entrée dit : où lire, sous quelle clé ranger le compte, et ce qui
     compte comme « rejoignable ». Un nouveau compteur s'ajoute ici et nulle
     part ailleurs.
     RÈGLE COMMUNE : est rejoignable ce qu'un joueur peut encore INTÉGRER.
     Tout ce qui est en validation, clos, classé ou refusé en est exclu — à ce
     stade il est trop tard pour entrer, et la case de l'accueil mentirait. */
  var SOURCES = [
    {
      cle: "maringouins", chemin: "missions", groupe: "missions",
      // rep-mis-marin : peutRejoindre teste exactement ces deux statuts
      garde: function (m) { return m.statut === "en_attente" || m.statut === "acceptee"; }
    },
    {
      cle: "main", chemin: "dossiers_main", groupe: "missions",
      /* rep-det-main : « ouvert » se saisit, « saisi » accepte encore des
         participants. « accord_attendu » est exclu : le dossier ne sort pas
         du cercle staff + Jason + personnage visé, l'annoncer serait une
         fuite. Les négociations ne prennent qu'un membre, mais elles naissent
         par la boutique et restent des entrées de jeu. */
      garde: function (m) { return m.statut === "ouvert" || m.statut === "saisi"; }
    },
    {
      cle: "faiseuses", chemin: "taches_faiseuses", groupe: "missions",
      /* rep-tac-fais : « en_vote » est exclu, la tâche est encore privée et
         peut être refusée. Les tâches publiques acceptent tous les volontaires,
         pas seulement les Faiseuses. */
      garde: function (m) { return m.statut === "en_attente" || m.statut === "acceptee"; }
    },
    /* Opérations et disparitions partagent la clé « hangar » : deux lectures,
       un seul compteur. Ce sont deux formes du même engagement — du travail
       pour les gens de la Flottille — et les distinguer sur l'accueil ferait
       deux chiffres à un chacun là où un seul se lit mieux. Les marées restent
       à part : elles sont la seule porte ouverte à tout le forum. */
    {
      cle: "hangar", chemin: "flottille/operations", groupe: "missions",
      // rep-flot-ops : l'équipage s'étoffe tant que l'opération n'est pas rendue
      garde: function (m) { return m.statut === "en_attente" || m.statut === "en_cours"; }
    },
    {
      cle: "hangar", chemin: "flottille/disparitions", groupe: "missions",
      /* rep-flot-disp : UN seul capitaine. Dès qu'il est désigné, le départ
         n'est plus à prendre — d'où le seul « en_attente ». */
      garde: function (m) { return m.statut === "en_attente" && !m.capitaine; }
    },
    {
      cle: "marees", chemin: "flottille/marees", groupe: "missions",
      /* rep-flot-marees : ce qui se rejoint n'est pas la marée mais le POSTE.
         Une marée dont tous les postes sont pris n'est plus une porte d'entrée.
         C'est pourtant la plus ouverte de toutes : inscription libre, aucune
         appartenance exigée. */
      garde: function (m) {
        if (m.statut !== "en_attente" && m.statut !== "en_cours") return false;
        return elements(m.postes).some(function (p) { return p && p.etat === "libre"; });
      }
    },
        {
      cle: "carrefour", chemin: "carrefour", groupe: "missions",
      /* rep-carr-core : chasses et missions partagent le nœud et les statuts,
         le type les distingue. Une chasse se ferme à la clôture des
         inscriptions — c'est là que le rôle secret est tiré — et elle est
         pleine à quatre. Une mission accueille toujours un intérêt de plus. */
      garde: function (m) {
        if (m.statut !== "ouverte" && m.statut !== "en_cours") return false;
        if (m.type !== "chasse") return true;
        if (m.inscriptionsCloses) return false;
        return elements(m.participants).length < 4;
      }
    },
    {
      cle: "secrets", chemin: "lost_bayou", groupe: "missions",
      /* rep-lb-* : quatre types de fiches, deux seulement se rejoignent.
         « ouverte » couvre deux phases à l'avant-poste — le vote, puis
         l'attente d'un répondant — et les deux sont des portes d'entrée.
         Les créances ne regardent que le PJ visé, et une délibération se vote
         sans qu'on y entre : ni l'une ni l'autre n'est « à rejoindre ». */
      garde: function (m) {
        if (m.type === "poste")  return m.statut === "ouverte";
        if (m.type === "seance") return m.statut === "ouverte" && !m.responsable && !m.pnj;
        return false;
      }
    },
    {
      cle: "enquetes", chemin: "enquetes", groupe: null,
      /* eco-rep-enquete : le statut est CALCULÉ, il n'est pas stocké.
            cloturee → classée · coldcase → non élucidée
            sinon : référent → en cours, pas de référent → en attente
         On exclut donc les deux premiers, plus les affaires d'intrigue, que le
         staff coordonne et qu'on ne rejoint pas librement.
         Le test sur les rôles est un choix : « à saisir » promet quelque chose
         à jouer, et une affaire sans rôle ouvert n'offre rien. Retirer
         aDesRoles(a) ci-dessous compterait toutes les affaires ouvertes. */
      garde: function (a) {
        return !a.cloturee && !a.coldcase && !a.intrigue && aDesRoles(a);
      }
    }
  ];

  /* ===================== RELEVÉ ===================== */

  function attendreEco() {
    return new Promise(function (ok) {
      var n = 0;
      (function boucle() {
        if (pret()) { ok(true); return; }
        if (++n > CFG.ATTENTE_MAX) { ok(false); return; }
        setTimeout(boucle, CFG.ATTENTE_PAS);
      })();
    });
  }

  function fraisAssez(maj) {
    var t = Date.parse(maj || "");
    return !isNaN(t) && (Date.now() - t) < CFG.TTL_MS;
  }

  function compter(source) {
    return Promise.resolve(E().firebaseGet(source.chemin))
      .then(function (brut) { return entrees(brut).filter(source.garde).length; })
      .catch(function (e) {
        jrn(source.chemin + " : " + e.message);
        return null;                       // null = on n'écrit pas cette feuille
      });
  }

  function relever() {
    return Promise.all(SOURCES.map(compter)).then(function (comptes) {
      /* Plusieurs sources peuvent viser la même clé — le hangar en additionne
         deux. Une lecture échouée ne doit alors pas rendre le total faux : on
         écarte la clé entière plutôt que d'écrire une somme amputée. */
      var totaux = {}, casses = {}, ordre = [];
      SOURCES.forEach(function (s, i) {
        var chemin = CFG.NOEUD + "/" + (s.groupe ? s.groupe + "/" : "") + s.cle;
        if (ordre.indexOf(chemin) < 0) ordre.push(chemin);
        if (comptes[i] == null) { casses[chemin] = true; return; }
        totaux[chemin] = (totaux[chemin] || 0) + comptes[i];
      });
      var maj = {}, ecrit = 0;
      ordre.forEach(function (chemin) {
        if (casses[chemin] || totaux[chemin] == null) return;   // on garde l'ancien chiffre
        maj[chemin] = totaux[chemin];      // chemins BRUTS : firebaseUpdate est un PATCH racine
        ecrit++;
      });
      if (!ecrit) { jrn("aucune source lisible — rien n'est écrit."); return; }
      maj[CFG.NOEUD + "/maj"] = new Date().toISOString();
      return E().firebaseUpdate(maj).then(function () {
        if (window.console && window.console.info) {
          console.info("[TDLI compteurs] relevé écrit : " + ecrit + " source(s).");
        }
      });
    }).catch(function (e) { jrn("relevé interrompu : " + e.message); });
  }

  /* ===================== INIT ===================== */

  function lancer(force) {
    if (!estStaff()) return Promise.resolve(false);
    return attendreEco().then(function (ok) {
      if (!ok) { jrn("EcoCore introuvable."); return false; }
      if (force) return relever().then(function () { return true; });
      // 40 octets lus : la sortie ordinaire ne coûte presque rien
      return Promise.resolve(E().firebaseGet(CFG.NOEUD + "/maj"))
        .catch(function () { return null; })
        .then(function (m) {
          if (fraisAssez(m)) return false;
          return relever().then(function () { return true; });
        });
    });
  }

  /* Exposé pour pouvoir forcer un relevé depuis la console après une
     modification de statut, sans attendre l'heure : TDLICompteurs.relever() */
  window.TDLICompteurs = {
    relever: function () { return lancer(true); },
    SOURCES: SOURCES
  };

  /* ForumActif déclenche DOMContentLoaded trop tôt. Et le relevé n'est jamais
     urgent : on le retarde pour laisser la page se monter d'abord. */
  function demarrer() { setTimeout(function () { lancer(false); }, CFG.DELAI); }
  if (document.readyState === "complete") demarrer();
  else window.addEventListener("load", demarrer);
})();
