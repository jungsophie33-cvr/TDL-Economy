/*
 * tdl-article-achat.js — Achat d'un article de presse au Comptoir · TDL
 *
 * Les trois articles mondains (coup de projecteur, sponsoring local, attirer
 * l'attention) ne créent PAS de demande staff : ils écrivent directement une
 * soumission dans le journal, qui atterrit dans « À relire » du bureau de
 * rédaction comme n'importe quelle autre. Le staff peaufine et publie là-bas.
 *
 * POURQUOI NE PAS PASSER PAR boutique_demandes — le staff aurait eu deux files
 *   à traiter pour un seul objet, et le texte serait resté hors du bureau, donc
 *   sans retouche, sans accord, sans génération de post.
 *
 * montant:0 DANS LA CAISSE DU JOURNAL — l'argent part par le circuit de la
 *   boutique, pas par celle du Courier. Si on inscrivait le prix ici, un refus
 *   au bureau recréditerait une somme que le journal n'a jamais encaissée. Le
 *   refus d'un article acheté se règle donc à la main, délibérément.
 *
 * PLANCHER DUR — à la différence d'une correspondance, où le plancher ne joue
 *   que sur la rémunération, celui d'un article acheté bloque l'envoi : le
 *   joueur paie pour de la place en colonnes, il doit la remplir.
 *
 * CE QU'ON NE VÉRIFIE PAS ICI : qu'un même sujet RP n'est pas déjà couvert.
 *   Le contrôle vit dans tdlhc-envoi et suppose la base du journal chargée ;
 *   le bureau a le motif de retouche « Sujet RP déjà couvert » pour ça.
 *
 * DÉPEND DE : window.EcoCore (firebaseTransaction, firebaseUpdate, getPseudo,
 *   getUserId). window.Quais (gel), window.EcoNotif : facultatifs.
 * À CHARGER : après eco-core, AVANT quais-comptoir.
 */
(function () {
  "use strict";
  if (!window.EcoCore) { if (window.console) console.warn("[tdl-article] eco-core absent."); return; }

  /* ===================== CONFIG ===================== */

  var CFG = {
    NODE_MEMBRES: "membres",
    NODE_JOURNAL: "journal",      /* [MAJ] même racine que tdlhc-core */
    SUJET_ID:     102,
    SUJET_SLUG:   "the-houma-courier",   /* [MAJ] slug du sujet du journal */
    N_SOUMISSION: 190,            /* notification staff, plage du Courier */
    PLANCHER:     { commande: 2000, "commande-une": 3000 }
  };

  /* Rubriques du journal, reprises telles quelles de tdlhc-volet. */
  var RUBRIQUES = [
    ["nouvelles-des-bayous", "Nouvelles des bayous"],
    ["paroisse", "Vie de la paroisse"],
    ["economie", "Économie"],
    ["environnement", "Environnement"],
    ["securite", "Sécurité"],
    ["culture", "Culture"]
  ];

  var TEXTES = {
    NO_PSEUDO: "Connectez-vous pour acheter.",
    FONDS:     "Fonds insuffisants.",
    FONDS_GELE: function (g) { return "Fonds insuffisants : " + g + " $ de votre solde sont retenus par la Main."; },
    ECHEC:     "L'envoi a échoué, votre solde est inchangé.",
    TITRE:     "Donnez un titre à l'article.",
    TEXTE:     "L'article est vide.",
    RP:        "Le lien du sujet RP est obligatoire.",
    RP_FORME:  "Le lien doit pointer vers un sujet du forum (…/t000-…).",
    IMAGE:     "L'image doit être un lien commençant par https://.",
    COURT:     function (n, p) { return "Article trop court : " + n + " signes sur les " + p + " attendus."; },
    OK:        "Article transmis à la rédaction. Il paraîtra après relecture."
  };

  /* ===================== UTILS ===================== */

  function E() { return window.EcoCore; }

  function pseudo() {
    try { if (E().getPseudo) { var p = E().getPseudo(); if (p) return String(p); } } catch (e) { /* socle non prêt */ }
    var u = window._userdata;
    return (u && u.username) ? String(u.username) : "";
  }

  function enc(s) { return encodeURIComponent(String(s == null ? "" : s)); }

  function nouvelId() { return "hc" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function tid(url) { var m = /\/t(\d+)(?:p\d+)?-/.exec(String(url || "")); return m ? parseInt(m[1], 10) : null; }

  function jour() { return new Date().toISOString().slice(0, 10); }

  function echec(msg) { return Promise.reject(new Error(msg)); }

  function sousType(item) { return item.une ? "commande-une" : "commande"; }

  /* Un recouvrement ouvert de la Main fige une partie du solde. quais-core le
     calcule déjà : on s'y branche plutôt que de refaire la formule. */
  function gelBloquant(montant) {
    try {
      if (!window.Quais || !window.Quais.gele || !window.Quais.dispo) return 0;
      var g = window.Quais.gele() | 0;
      if (g > 0 && window.Quais.dispo() < montant) return g;
    } catch (e) { /* socle boutique indisponible */ }
    return 0;
  }

  /* ===================== VALIDATION ===================== */

  function valider(item, c) {
    if (!String(c.titre || "").trim()) return TEXTES.TITRE;
    var texte = String(c.texte || "").trim();
    if (!texte) return TEXTES.TEXTE;
    var p = CFG.PLANCHER[sousType(item)] || 0;
    if (texte.length < p) return TEXTES.COURT(texte.length, p);
    var rp = String(c.rp || "").trim();
    if (item.rpObligatoire && !rp) return TEXTES.RP;
    if (rp && !tid(rp)) return TEXTES.RP_FORME;
    var img = String(c.image || "").trim();
    if (img && img.indexOf("https://") !== 0) return TEXTES.IMAGE;
    return null;
  }

  /* ===================== MOUVEMENT D'ARGENT ===================== */

  function debiter(p, montant) {
    if (!montant) return Promise.resolve();
    return Promise.resolve(E().firebaseTransaction(
      CFG.NODE_MEMBRES + "/" + enc(p) + "/dollars",
      function (cur) {
        var s = cur || 0;
        if (s < montant) throw new Error("FONDS");
        return s - montant;
      }
    ));
  }

  function recrediter(p, montant) {
    if (!montant) return Promise.resolve();
    return Promise.resolve(E().firebaseTransaction(
      CFG.NODE_MEMBRES + "/" + enc(p) + "/dollars",
      function (cur) { return (cur || 0) + montant; }
    )).catch(function (e) {
      /* payé sans rien recevoir : il faut que ça se voie. */
      if (window.console) console.error("[tdl-article] RECRÉDIT ÉCHOUÉ pour " + p + " : " + montant, e);
    });
  }

  /* ===================== SOUMISSION ===================== */

  function construire(item, c, p, prix) {
    var st = sousType(item), now = new Date().toISOString();
    var titre = String(c.titre || "").trim();

    var meta = {
      type: "article", sous_type: st, statut: "relecture",
      auteur: p, titre: titre, cree: now, maj: now, retouches: 0,
      montant: 0,                 /* la caisse du journal ne voit pas cet argent */
      prix: prix,                 /* sert au classement en Une par le bureau */
      mention: item.tribune ? "tribune" : "communique",
      achat: item.id || "",
      tid: tid(c.rp) || null,
      remunere: false
    };
    try { var uid = E().getUserId(); if (uid != null && uid !== "") meta.uid = uid; } catch (e) { /* non connecté côté FA */ }

    var corps = {
      statut: st,
      titre: titre,
      rubrique: c.rubrique || RUBRIQUES[0][0],
      date: c.date || jour(),
      chapo: String(c.chapo || "").trim(),
      image: String(c.image || "").trim(),
      rp: String(c.rp || "").trim(),
      texte: String(c.texte || "")
    };
    /* le rattachement à une affaire n'est ouvert qu'à « attirer l'attention » */
    if (item.affaire && c.affaire) {
      corps.affaire = c.affaire;
      if (c.affaire === "new" && c.affaire_nom) corps.affaire_nom = String(c.affaire_nom).trim();
    }
    /* le projet communautaire visé n'est pas une clé du journal : il part dans
       le chapô de travail du bureau plutôt que de se perdre. */
    if (c.projet) corps.projet = c.projet;

    return { meta: meta, corps: corps };
  }

  function notifier(p, titre, id) {
    try {
      if (!window.EcoNotif) return;
      var url = "/t" + CFG.SUJET_ID + "-" + CFG.SUJET_SLUG + "#hc=bureau-" + id;
      window.EcoNotif.staff(CFG.N_SOUMISSION, { pseudo: p, titre: titre, url: url }, "hc-soum-" + id + "-0");
    } catch (e) {
      if (window.console) console.warn("[tdl-article] notification impossible :", e);
    }
  }

  /* ===================== ACHAT ===================== */

  function acheter(req) {
    var item = req && req.item, c = (req && req.champs) || {};
    var p = pseudo();
    if (!p) return echec(TEXTES.NO_PSEUDO);
    if (!item) return echec(TEXTES.ECHEC);
    if (!item.id) item.id = req.id;

    var err = valider(item, c);
    if (err) return echec(err);

    var prix = parseInt(item.p, 10) || 0;
    var gele = gelBloquant(prix);
    if (gele) return echec(TEXTES.FONDS_GELE(gele));

    var id = nouvelId();
    var b = construire(item, c, p, prix);

    return debiter(p, prix)
      .catch(function (e) {
        throw new Error(e && e.message === "FONDS" ? TEXTES.FONDS : TEXTES.ECHEC);
      })
      .then(function () {
        var base = CFG.NODE_JOURNAL + "/";     /* chemins BRUTS : PATCH racine */
        var patch = {};
        patch[base + "soum_meta/" + id] = b.meta;
        patch[base + "soum_corps/" + id] = b.corps;
        return Promise.resolve(E().firebaseUpdate(patch));
      })
      .catch(function (e) {
        if (e && (e.message === TEXTES.FONDS || e.message === TEXTES.ECHEC)) throw e;
        return recrediter(p, prix).then(function () { throw new Error(TEXTES.ECHEC); });
      })
      .then(function () {
        if (E().invalidateCache) { try { E().invalidateCache(); } catch (e) { /* cache facultatif */ } }
        notifier(p, b.meta.titre, id);
        return { message: TEXTES.OK, id: id };
      });
  }

  /* ===================== EXPOSITION ===================== */

  window.TDLArticle = { acheter: acheter, RUBRIQUES: RUBRIQUES, PLANCHER: CFG.PLANCHER };

})();
