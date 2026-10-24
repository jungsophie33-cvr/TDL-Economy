/*
 * tdl-article-achat.js — Achat d'un article de presse au Comptoir · TDL · v2
 *
 * Les trois articles mondains (coup de projecteur, sponsoring local, attirer
 * l'attention) ne créent PAS de demande staff : ils écrivent une soumission
 * dans le journal, qui atterrit dans « À relire » du bureau de rédaction comme
 * n'importe quelle autre. Appelé par quais-comptoir comme ACTE du pipeline.
 *
 * REMBOURSEMENT AU REFUS — assuré par le bureau (tdlhc-bureau-actions,
 *   refuser) : il rend meta.prix à l'auteur, y compris quand le refus vient de
 *   l'échéance de reprise. La caisse du journal n'en garde pas trace, puisque
 *   l'argent n'y est jamais entré.
 * montant:0 DANS LA SOUMISSION — l'argent part par la boutique ; inscrit ici,
 *   il ferait croire à la caisse qu'elle l'a encaissé.
 * PLANCHER DUR — le joueur paie de la place en colonnes, il doit la remplir.
 * CE QU'ON NE VÉRIFIE PAS ICI : qu'un même sujet RP n'est pas déjà couvert
 *   (motif de retouche « Sujet RP déjà couvert » au bureau).
 *
 * [MAJ v2] Débit par le socle (Quais.achat.retenir / rendre) ; valider()
 *   exposé, pour que le Comptoir refuse AVANT la confirmation ; l'item du
 *   catalogue n'est plus modifié ; plus de « projet visé » (les grands projets
 *   ne sont pas encore en jeu) ; tutoiement.
 *
 * DÉPEND DE : window.Quais (achat, pseudo), window.EcoCore (firebaseUpdate,
 *   getUserId, invalidateCache). window.EcoNotif est optionnel.
 * À CHARGER : après eco-core et quais-core, AVANT quais-comptoir.
 */
(function () {
  "use strict";
  if (!window.EcoCore) { if (window.console) console.warn("[tdl-article] eco-core absent."); return; }

  /* ===================== CONFIG ===================== */
  var CFG = {
    NODE_JOURNAL: "journal",               /* [MAJ] même racine que tdlhc-core */
    SUJET_ID:     102,
    SUJET_SLUG:   "the-houma-courier",     /* [MAJ] slug du sujet du journal */
    N_SOUMISSION: 190,                     /* notification staff, plage du Courier */
    PLANCHER:     { commande: 2000, "commande-une": 3000 }
  };

  /* [MAJ] MIROIR des rubriques de tdlhc-volet : à aligner s'il change */
  var RUBRIQUES = [
    ["nouvelles-des-bayous", "Nouvelles des bayous"],
    ["paroisse", "Vie de la paroisse"],
    ["economie", "Économie"],
    ["environnement", "Environnement"],
    ["securite", "Sécurité"],
    ["culture", "Culture"]
  ];

  var TEXTES = {
    NO_PSEUDO:  "Connecte-toi pour acheter.",
    NO_SOCLE:   "Socle indisponible : réessaie dans un instant.",
    FONDS:      "Ton solde ne couvre pas cet article.",
    FONDS_GELE: function (g) { return "Ton solde ne couvre pas cet article : " + g + " $ sont retenus par la Main."; },
    ECHEC:      "L\u2019envoi a échoué : ton solde est inchangé.",
    TITRE:      "Donne un titre à l\u2019article.",
    TEXTE:      "L\u2019article est vide.",
    RP:         "Le lien du sujet RP est obligatoire.",
    RP_FORME:   "Le lien doit pointer vers un sujet du forum (…/t000-…).",
    IMAGE:      "L\u2019image doit être un lien commençant par https://.",
    COURT:      function (n, p) { return "Article trop court : " + n + " signes sur les " + p + " attendus."; },
    OK:         "Article transmis à la rédaction. Il paraîtra après relecture ; s\u2019il est refusé, le prix te sera rendu."
  };

  /* ===================== UTILS ===================== */
  function Q(){ return window.Quais; }
  function E(){ return window.EcoCore; }
  function nouvelId(){ return "hc" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function tid(url){ var m = /\/t(\d+)(?:p\d+)?-/.exec(String(url || "")); return m ? parseInt(m[1], 10) : null; }
  function jour(){ return new Date().toISOString().slice(0, 10); }
  function sousType(item){ return item.une ? "commande-une" : "commande"; }
  function messageArgent(e){
    if (e && e.message === "GELE")  return TEXTES.FONDS_GELE(Q().gele());
    if (e && e.message === "FONDS") return TEXTES.FONDS;
    if (e && e.message === "CONNEXION") return TEXTES.NO_PSEUDO;
    return TEXTES.ECHEC;
  }

  /* ===================== VALIDATION ===================== */
  function valider(item, c){
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

  /* ===================== SOUMISSION ===================== */
  function construire(id, item, c, p, prix){
    var now = new Date().toISOString(), st = sousType(item), titre = String(c.titre || "").trim();
    var meta = {
      type:"article", sous_type:st, statut:"relecture",
      auteur:p, titre:titre, cree:now, maj:now, retouches:0,
      montant:0,                 /* la caisse du journal ne voit pas cet argent */
      prix:prix,                 /* rendu au refus par le bureau ; sert aussi au classement en une */
      mention: item.tribune ? "tribune" : "communique",
      achat:id, tid:tid(c.rp) || null, remunere:false
    };
    try { var uid = E().getUserId(); if (uid != null && uid !== "") meta.uid = uid; } catch(e){}
    var corps = {
      statut:st, titre:titre,
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
    return { meta:meta, corps:corps };
  }

  function notifier(p, titre, id){
    try {
      if (!window.EcoNotif) return;
      var url = "/t" + CFG.SUJET_ID + "-" + CFG.SUJET_SLUG + "#hc=bureau-" + id;
      window.EcoNotif.staff(CFG.N_SOUMISSION, { pseudo:p, titre:titre, url:url }, "hc-soum-" + id + "-0");
    } catch(e){ if (window.console) console.warn("[tdl-article] notification impossible :", e); }
  }

  /* ===================== ACHAT ===================== */
  async function acheter(req){
    var item = req && req.item, c = (req && req.champs) || {};
    if (!Q() || !Q().achat) throw new Error(TEXTES.NO_SOCLE);
    var p = Q().pseudo();
    if (!p) throw new Error(TEXTES.NO_PSEUDO);
    if (!item) throw new Error(TEXTES.ECHEC);
    var err = valider(item, c);
    if (err) throw new Error(err);

    var prix = parseInt(item.p, 10) || 0, id = nouvelId();
    var b = construire(req.id || "", item, c, p, prix);

    try { await Q().achat.retenir(prix); }
    catch(e){ throw new Error(messageArgent(e)); }

    var base = CFG.NODE_JOURNAL + "/", patch = {};      /* chemins BRUTS : PATCH racine */
    patch[base + "soum_meta/" + id] = b.meta;
    patch[base + "soum_corps/" + id] = b.corps;
    try { await E().firebaseUpdate(patch); }
    catch(e){
      try { await Q().achat.rendre(prix); }
      catch(e2){ if (window.console) console.error("[tdl-article] RECRÉDIT ÉCHOUÉ pour " + p + " : " + prix, e2); }
      throw new Error(TEXTES.ECHEC);
    }
    if (E().invalidateCache) { try { E().invalidateCache(); } catch(e){} }
    notifier(p, b.meta.titre, id);
    return { message:TEXTES.OK, id:id };
  }

  /* ===================== EXPOSITION ===================== */
  window.TDLArticle = { acheter:acheter, valider:valider, RUBRIQUES:RUBRIQUES, PLANCHER:CFG.PLANCHER };
})();
