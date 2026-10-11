/*
 * tdlhc-vitrine.js — Vitrine du Courier sur la page d'accueil · TDL
 *
 * CE QUE CE FICHIER FAIT : recopie dans « accueil/une » le dominant et les trois
 * secondaires que tdlhc-rendu vient de calculer pour la rubrique « À la une ».
 * La page d'accueil n'a alors qu'une fiche prête à afficher, et ne lit jamais
 * les posts du journal.
 *
 * CE QU'IL NE FAIT PAS : il ne choisit rien. L'arbitrage du bureau — une une
 * posée en dominant, le repli sur l'article avec image, puis sur le plus
 * récent — appartient à tdlhc-rendu et n'est pas dupliqué ici. Ce fichier
 * recopie, il ne décide pas.
 *
 * QUAND IL ÉCRIT : à l'ouverture de « À la une » par un membre du staff, et
 * seulement si la fiche a changé. Un visiteur ne déclenche rien, et deux
 * ouvertures d'affilée n'écrivent qu'une fois.
 *
 * POURQUOI PAS UNIQUEMENT À LA PUBLICATION : un patch posé au moment de la
 * parution ne connaîtrait que les articles publiés APRÈS sa pose, et ne verrait
 * jamais un article supprimé à la main. Ici, la première ouverture de la une
 * par le staff reprend tout l'historique, et chaque ouverture suivante corrige
 * les écarts. L'accueil se répare tout seul.
 *
 * LE STAFF-ONLY EST UNE CONVENTION, PAS UNE GARANTIE : les règles Firebase du
 * forum autorisent l'écriture à tout membre authentifié. Le filtre est côté JS,
 * comme ailleurs sur le forum. Il évite les écritures inutiles, il n'empêche
 * personne de mal faire.
 *
 * DÉPEND DE : window.Courier (api + rendu), window.EcoCore.
 * À CHARGER : après tdlhc-rendu.
 * HOOK À POSER dans tdlhc-rendu.js, à la fin de afficherUne(), juste avant
 *   sec.setAttribute("data-pret", "1") :
 *
 *     if (window.Courier.vitrine) window.Courier.vitrine.ecrire(dom, secs);
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var CFG = {
    NOEUD:     "accueil/une",
    SECS_MAX:  3,
    CHAPO_MAX: 220              // au-delà, l'accueil tronque de toute façon
  };

  var A = null;                 // api du cœur, posée au démarrage

  /* ===================== UTILS ===================== */
  function E() { return window.EcoCore; }

  function estStaff() {
    try { var u = window._userdata; if (u && (u.user_level === 1 || u.user_level === 2)) return true; }
    catch (e) { /* _userdata absent hors ForumActif */ }
    var p = E() && typeof E().getPseudo === "function" ? E().getPseudo() : null;
    return !!(p && (E().ADMIN_USERS || []).indexOf(p) !== -1);
  }

  /* La table des rubriques vit dans tdlhc-rendu : on la lit, on ne la recopie
     pas. « --gr3-color » devient « gr3 », que l'accueil rend en var(--gr3-color). */
  function rubrique(cle) {
    var R = (window.Courier.rendu || {}).RUB || {};
    var r = R[cle];
    return { libelle: r ? r.l : (cle || ""), groupe: r ? r.c.replace("--", "").replace("-color", "") : "gr1" };
  }

  function lienArticle(ancre) {
    var env = window.Courier.envoi;
    if (env && typeof env.lien === "function") return env.lien("art-" + ancre);
    return "/t102-the-houma-courier#" + ancre;     /* [MAJ] filet si envoi n'est pas chargé */
  }

  /* Un article sans chapô en emprunte un à son premier paragraphe, exactement
     comme le fait le journal — même fonction, pas une seconde implémentation. */
  function chapoDe(a) {
    if (a.cles.CHAPO) return a.cles.CHAPO;
    var ext = (window.Courier.rendu || {}).extrait;
    return ext ? ext(a, CFG.CHAPO_MAX) : "";
  }

  function fichePrincipale(a) {
    var r = rubrique(a.cles.RUBRIQUE);
    return {
      rubrique: r.libelle,
      groupe:   r.groupe,
      titre:    a.cles.TITRE || "",
      chapo:    chapoDe(a),
      image:    a.cles.IMAGE || "",
      lien:     lienArticle(a.ancre),
      ancre:    a.ancre
    };
  }

  /* Un secondaire n'affiche ni chapô ni image : inutile de les stocker. */
  function ficheSecondaire(a) {
    var r = rubrique(a.cles.RUBRIQUE);
    return { rubrique: r.libelle, groupe: r.groupe, titre: a.cles.TITRE || "",
             lien: lienArticle(a.ancre), ancre: a.ancre };
  }

  /* Signature de la fiche : évite une écriture à chaque ouverture de la une.
     Seules les ancres comptent — un titre corrigé dans le post passera à la
     parution suivante, ce qui est sans conséquence sur l'accueil. */
  function signature(f) {
    return [f.ancre].concat((f.secondaires || []).map(function (s) { return s.ancre; })).join("|");
  }

  /* ===================== ÉCRITURE ===================== */
  var derniere = null;

  function ecrire(dom, secs) {
    if (!dom || !dom.cles || !estStaff()) return;
    if (!E() || typeof E().firebaseUpdate !== "function") return;

    var f = fichePrincipale(dom);
    f.secondaires = (secs || []).slice(0, CFG.SECS_MAX).map(ficheSecondaire);
    f.maj = new Date().toISOString();

    var sig = signature(f);
    if (sig === derniere) return;                 // déjà à jour dans cette session

    var maj = {};
    maj[CFG.NOEUD] = f;
    E().firebaseUpdate(maj).then(function () {
      derniere = sig;
    }).catch(function (e) {
      if (window.console) console.warn("[Courier vitrine] écriture refusée : " + e.message);
    });
  }

  /* ===================== INIT ===================== */
  function demarrer() {
    var C = window.Courier;
    A = C.api;
    C.vitrine = { ecrire: ecrire };
  }
  (function attendre(n) {
    if (window.Courier && window.Courier.api) { demarrer(); return; }
    if ((n || 0) < 60) setTimeout(function () { attendre((n || 0) + 1); }, 250);
  })();
})();
