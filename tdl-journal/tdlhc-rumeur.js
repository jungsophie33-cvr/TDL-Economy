/*
 * tdlhc-rumeur.js — Passerelle « secret lâché » → rumeur · The Houma Courier · TDL
 *
 * CE QUE CE FICHIER FAIT :
 *   - écoute l'ancre #hc=rumeur-<id> posée par le tableau des secrets ;
 *   - relit la délibération dans lost_bayou, vérifie qu'elle a bien été acceptée
 *     pour un « lâcher » et que la rumeur est écrite, puis ouvre le volet du
 *     Courier pré-rempli ;
 *   - une fois la soumission partie, marque la délibération.
 * CE QU'IL NE FAIT PAS : aucun contrôle de quota ni de solde — tdlhc-envoi s'en
 *   charge, et c'est bien pour ça que la rumeur passe par le volet plutôt que
 *   d'être écrite depuis le tableau. Le quota hebdomadaire est donc consommé
 *   comme pour n'importe quelle rumeur : c'est le prix d'un secret lâché.
 *
 * POURQUOI UNE ANCRE ET PAS LE TEXTE DANS L'URL : lireHash n'accepte que des
 *   caractères de mot, et une rumeur n'en est pas faite. On passe l'identifiant,
 *   on relit la source — qui est de toute façon la seule version qui fasse foi.
 *
 * DÉPEND DE : window.Courier (core + volet + envoi), window.EcoCore.
 * À CHARGER : sur la page du journal, APRÈS tdlhc-envoi.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var CFG = {
    NODE: "lost_bayou",
    NODE_REV: "lost_bayou_rev",
    RETRY_MS: 250,
    RETRY_MAX: 80
  };
  var TXT = {
    INTROUVABLE: "Cette délibération est introuvable.",
    PAS_PRETE:   "Cette délibération n'autorise pas encore de rumeur.",
    DEJA:        "Cette rumeur a déjà été soumise au Courier.",
    PAS_VOUS:    "Seule la Sorcière qui a mené la délibération peut en soumettre la rumeur.",
    ERR:         "Impossible de lire la délibération pour l'instant."
  };

  var A = null, V = null;
  /* L'identifiant ne peut pas voyager dans le formulaire : collecter() ne lit
     que les [data-champ]. On le garde ici, le temps d'un envoi. */
  var enAttente = null;

  function E(){ return window.EcoCore; }

  /* ===================== OUVERTURE DEPUIS L'ANCRE ===================== */
  async function ouvrir(id){
    if (!id) return;
    var p = A.pseudo();
    if (!p) { A.toast(TXT.PAS_VOUS); return; }
    var d;
    try { d = await E().firebaseGet(CFG.NODE + "/" + encodeURIComponent(id)); }
    catch(e){ A.toast(TXT.ERR); return; }
    if (!d || d.type !== "delib") { A.toast(TXT.INTROUVABLE); return; }
    if (d.acte !== "lacher" || !d.decide || d.decide.choix !== "acceptee" || !d.rumeur) { A.toast(TXT.PAS_PRETE); return; }
    if (d.rumeurSoum) { A.toast(TXT.DEJA); return; }
    if (d.responsable && d.responsable !== p && !A.isStaff()) { A.toast(TXT.PAS_VOUS); return; }

    enAttente = id;
    V.ouvre("rumeur", { texte: d.rumeur, secteur: d.secteur || "" });
  }

  /* ===================== MARQUAGE APRÈS ENVOI ===================== */
  /* Écriture croisée vers un nœud surveillé, SANS tdl-base : il n'est pas chargé
     sur la page du journal. On bumpe donc la sentinelle à la main, dans le même
     PATCH — sinon les onglets déjà ouverts sur le tableau ne verraient rien
     avant la réconciliation. */
  function marquer(id){
    var maj = {};
    maj[CFG.NODE + "/" + id + "/rumeurSoum"] = new Date().toISOString();
    maj[CFG.NODE_REV + "/" + id] = Date.now();
    return Promise.resolve(E().firebaseUpdate(maj)).catch(function(e){
      if (window.console) console.warn("[Courier] marquage de la délibération", e);
    });
  }

  /* ===================== INIT ===================== */
  function demarrer(){
    var C = window.Courier;
    A = C.api; V = C.volet;
    C.ancre("rumeur-", ouvrir);

    /* On enveloppe le hook plutôt que de le remplacer : tous les contrôles de
       tdlhc-envoi restent en place, on n'ajoute qu'une trace après coup. */
    var origine = V.hooks.envoyer;
    V.hooks.envoyer = async function(type, v){
      var res = await origine(type, v);
      if (res && res.ok && type === "rumeur" && enAttente) { var id = enAttente; enAttente = null; await marquer(id); }
      return res;
    };
    /* Le volet refermé sans envoi ne doit pas marquer la délibération suivante. */
    var origFerme = V.ferme;
    V.ferme = function(){ enAttente = null; return origFerme.apply(this, arguments); };
  }

  (function attendre(n){
    var C = window.Courier;
    if (C && C.api && C.api.estPageJournal && C.api.estPageJournal() && C.volet && C.volet.hooks && C.volet.hooks.envoyer) { demarrer(); return; }
    if ((n||0) < CFG.RETRY_MAX) setTimeout(function(){ attendre((n||0)+1); }, CFG.RETRY_MS);
  })();
})();
