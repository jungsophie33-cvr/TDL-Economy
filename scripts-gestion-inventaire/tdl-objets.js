/*
 * tdl-objets.js — Moteur des objets du Bayou · TDL
 *
 * Exécute l'achat DIRECT des six items du Comptoir qui déposent un objet :
 * débit définitif, tirage du d4 quand l'item en porte un, dépôt dans un
 * inventaire, dette karmique et journal. Aucune demande staff n'est créée.
 *
 * ÉCRITURE COMPENSÉE — on débite par TRANSACTION (contrôle de fonds refait
 *   contre la valeur serveur), puis on écrit le reste en UN SEUL PATCH
 *   multi-chemins. Si ce PATCH échoue, on recrédite. On ne passe donc PAS par
 *   la file de réessai de TDLBase : un réessai déclenché après le recrédit
 *   rendrait l'objet gratuit. Même motif que barge-maringouins.
 *
 * CHEMINS BRUTS pour firebaseUpdate (PATCH à la racine), encodeURIComponent
 *   pour firebaseTransaction qui, lui, construit une URL. Un pseudo contenant
 *   un espace casse l'un ou l'autre si on inverse.
 *
 * L'ICÔNE N'EST PAS ÉCRITE : l'entrée ne porte que la clé d'objet (o), et
 *   c'est tdl-inventaire qui décide du rendu. Deux tables d'icônes finiraient
 *   par diverger.
 *
 * DÉPEND DE : window.EcoCore (getPseudo, firebaseTransaction, firebaseUpdate),
 *   window.TDLBase (nouvelleCle). window.EcoNotif est optionnel.
 * À CHARGER : après eco-core et tdl-base, AVANT quais-comptoir.
 */
(function () {
  "use strict";
  if (!window.EcoCore) { if (window.console) console.warn("[tdl-objets] eco-core absent."); return; }

  /* ===================== CONFIG ===================== */

  var CFG = {
    NODE_MEMBRES: "membres",
    SOUS_INV:     "inventaire",
    SOUS_DETTES:  "dettes",
    NODE_JOURNAL: "consommations",
        /* notifications de la plage boutique (sos-emi-notif) */
    NOTIF_EFFIGIE: 106,   /* la cible : un sort la frappe, sans sa source */
    NOTIF_DETTE:   102    /* l'acheteur : dette karmique inscrite */
  };

  /* Durées de complication, en jours. Portée : ce que la cible doit tenir. */
  var EFFIGIE = {
    1: { lab:"Complication sérieuse", por:"tous",      jours:21, depose:true },
    2: { lab:"Complication légère",   por:"courants",  jours:7,  depose:true },
    3: { lab:"Complication légère",   por:"courants",  jours:7,  depose:true },
    4: { lab:"Rien",                  por:null,        jours:0,  depose:false }
  };

  var PURIF = {
    1: { lab:"Protection totale" },
    2: { lab:"Protection partielle" },
    3: { lab:"Protection partielle" },
    4: { lab:"Protection symbolique" }
  };

  var TEXTES = {
    NO_PSEUDO:  "Connectez-vous pour acheter.",
    NO_OBJET:   "Cet article ne dépose aucun objet : prévenez le staff.",
    NO_SOCLE:   "Socle indisponible : réessayez dans un instant.",
    FONDS:      "Fonds insuffisants.",
    ECHEC:      "L'achat a échoué, votre solde est inchangé.",
    OK:         "Objet déposé dans votre inventaire.",
    OK_EFFIGIE: "Le sort est jeté. La poupée est chez sa destinataire.",
    OK_RIEN:    "Le rituel n'a rien donné. La dette karmique, elle, est bien ouverte.",
    DETTE:      "Effigie rituelle lancée contre un autre personnage",
    NOTIF:      "Quelqu'un vous veut du mal. Un objet est apparu dans votre inventaire."
  };

  /* ===================== UTILS ===================== */

  function pseudo() {
    try {
      if (window.EcoCore.getPseudo) {
        var p = window.EcoCore.getPseudo();
        if (p) return String(p);
      }
    } catch (e) { /* le socle n'est pas prêt : on retombe sur FA */ }
    var u = window._userdata;
    return (u && u.username) ? String(u.username) : "";
  }

  function enc(s) { return encodeURIComponent(String(s == null ? "" : s)); }

  function jour(decalage) {
    var d = new Date();
    if (decalage) d.setDate(d.getDate() + decalage);
    return d.toISOString().slice(0, 10);
  }
  function jourFR(iso) {
    var p = String(iso).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
  }

  function d4() { return 1 + Math.floor(Math.random() * 4); }

  function echec(msg) { return Promise.reject(new Error(msg)); }

  /* ===================== MOUVEMENT D'ARGENT ===================== */

  /* Le contrôle de fonds est REFAIT dans la transaction, contre la valeur
     serveur : l'instantané affiché par la boutique peut avoir deux minutes. */
  function debiter(p, montant) {
    if (!montant) return Promise.resolve();
    return Promise.resolve(window.EcoCore.firebaseTransaction(
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
    return Promise.resolve(window.EcoCore.firebaseTransaction(
      CFG.NODE_MEMBRES + "/" + enc(p) + "/dollars",
      function (cur) { return (cur || 0) + montant; }
    )).catch(function (e) {
      /* le joueur a payé sans rien recevoir : il faut que ça se voie. */
      if (window.console) console.error("[tdl-objets] RECRÉDIT ÉCHOUÉ pour " + p + " : " + montant, e);
    });
  }

  /* ===================== CONSTRUCTION DU PATCH ===================== */

  function entree(item, c, de) {
    var e = { o: item.obj, src: item.id, t: jour(0), st: "actif" };
    if (item.ch) e.ch = item.ch;
    if (c.lieu) e.lieu = String(c.lieu).trim();
    if (c.boutique) e.boutique = c.boutique;
    if (de) e.de = de;
    return e;
  }

  function entreeSubie(item, de) {
    var r = EFFIGIE[de];
    return {
      o: item.obj, src: item.id, t: jour(0), st: "subi",
      de: de, por: r.por, exp: jour(r.jours)
    };
  }

  function dette(item, cible) {
    return {
      type: item.detteAuto || "karmique",
      creancier: item.creancier || "Karma",
      motif: TEXTES.DETTE + (cible ? " (" + cible + ")" : ""),
      montant: 0,
      statut: "active",
      date: new Date().toISOString()
    };
  }

  function journal(p, item, cible) {
    return { p: p, o: item.obj, src: item.id, r: "achat", t: new Date().toISOString(), cible: cible || "" };
  }

  /* ===================== ACHAT ===================== */

  function acheter(req) {
    var item = req && req.item, c = (req && req.champs) || {};
    var p = pseudo();

    if (!p) return echec(TEXTES.NO_PSEUDO);
    if (!item || !item.obj) return echec(TEXTES.NO_OBJET);
    if (!window.TDLBase || !window.TDLBase.nouvelleCle) return echec(TEXTES.NO_SOCLE);

    item = Object.assign ? Object.assign({ id: req.id }, item) : item;
    if (!item.id) item.id = req.id;

    var montant = parseInt(item.p, 10) || 0;
    var cible = item.ciblePJ ? String(c.cible_pj || "").trim() : "";
    var effigie = !!item.ciblePJ;
    var de = (effigie || item.obj === "brique") ? d4() : 0;

    return debiter(p, montant)
      .catch(function (e) {
        throw new Error(e && e.message === "FONDS" ? TEXTES.FONDS : TEXTES.ECHEC);
      })
      .then(function () {
        var patch = {};
        var cle = window.TDLBase.nouvelleCle();

        if (effigie) {
          /* le 4 ne dépose rien : la dette, elle, est due quoi qu'il arrive. */
          if (EFFIGIE[de].depose) {
            patch[CFG.NODE_MEMBRES + "/" + cible + "/" + CFG.SOUS_INV + "/" + cle] = entreeSubie(item, de);
          }
          patch[CFG.NODE_MEMBRES + "/" + p + "/" + CFG.SOUS_DETTES + "/" + window.TDLBase.nouvelleCle()] = dette(item, cible);
        } else {
          patch[CFG.NODE_MEMBRES + "/" + p + "/" + CFG.SOUS_INV + "/" + cle] = entree(item, c, de);
        }

        patch[CFG.NODE_JOURNAL + "/" + window.TDLBase.nouvelleCle()] = journal(p, item, cible);

        return Promise.resolve(window.EcoCore.firebaseUpdate(patch));
      })
      .catch(function (e) {
        if (e && (e.message === TEXTES.FONDS || e.message === TEXTES.ECHEC)) throw e;
        return recrediter(p, montant).then(function () { throw new Error(TEXTES.ECHEC); });
      })
      .then(function () {
        if (effigie) notifier(p, EFFIGIE[de].depose ? cible : "", de, item);
        return resultat(item, de, effigie);
      });
  }

  function resultat(item, de, effigie) {
    var out = { message: TEXTES.OK };
    if (effigie) {
      out.de = de;
      out.deLabel = EFFIGIE[de].lab;
      out.message = EFFIGIE[de].depose ? TEXTES.OK_EFFIGIE : TEXTES.OK_RIEN;
    } else if (de) {
      out.de = de;
      out.deLabel = (PURIF[de] || {}).lab || "";
    }
    return out;
  }

    /* La source reste anonyme : la cible apprend qu'elle est visée, jamais par qui.
     L'échec d'une notification ne remonte pas — l'achat, lui, a eu lieu. */
  function notifier(acheteur, cible, de, item) {
    if (!window.EcoNotif) return;
    try {
      if (cible) {
        var r = EFFIGIE[de];
        window.EcoNotif.a(cible, CFG.NOTIF_EFFIGIE, {
          jusqu: jourFR(jour(r.jours)),
          portee: r.por === "tous" ? "tous vos sujets" : "vos sujets en cours, hors intrigue et événement"
        });
      }
      window.EcoNotif.a(acheteur, CFG.NOTIF_DETTE, { motif: dette(item, "").motif });
    } catch (e) {
      if (window.console) console.warn("[tdl-objets] notification impossible :", e);
    }
  }

  /* ===================== EXPOSITION ===================== */

  window.TDLObjets = { acheter: acheter, EFFIGIE: EFFIGIE, PURIF: PURIF };

})();
