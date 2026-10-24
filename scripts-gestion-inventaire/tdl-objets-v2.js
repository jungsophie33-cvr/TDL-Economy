/*
 * tdl-objets.js — Moteur des objets du Bayou · TDL · v2
 *
 * Exécute l'achat DIRECT des six items du Comptoir qui déposent un objet :
 * débit définitif, tirage du d4 quand l'item en porte un, dépôt dans un
 * inventaire, dette karmique et journal. Aucune demande staff n'est créée.
 * Appelé par quais-comptoir comme ACTE du pipeline : contrôles, confirmation,
 * verrou anti-double-clic et rafraîchissement du solde sont déjà faits.
 *
 * [MAJ v2] LE DÉBIT PASSE PAR LE SOCLE (Quais.achat.retenir / rendre) : même
 *   contrôle du gel de la Main, même transaction, plus de copie locale.
 * [MAJ v2] LA CIBLE EST CONTRÔLÉE ICI AUSSI : une cible vide aurait écrit sous
 *   membres//inventaire, et l'on ne s'envoûte pas soi-même.
 * [MAJ v2] La boutique choisie pour l'effigie était lue puis perdue : elle est
 *   désormais écrite sur la poupée et au journal, avec le dé.
 *
 * ÉCRITURE COMPENSÉE — on débite, puis on écrit le reste en UN SEUL PATCH
 *   multi-chemins ; si ce PATCH échoue, on recrédite. On ne passe PAS par la
 *   file de réessai de TDLBase : un réessai après le recrédit rendrait l'objet
 *   gratuit.
 * CHEMINS BRUTS pour firebaseUpdate (PATCH à la racine).
 * L'ICÔNE N'EST PAS ÉCRITE : l'entrée ne porte que la clé d'objet (o) ;
 *   tdl-inventaire décide du rendu.
 *
 * DÉPEND DE : window.Quais (achat, pseudo), window.EcoCore (firebaseUpdate),
 *   window.TDLBase (nouvelleCle). window.EcoNotif est optionnel.
 * À CHARGER : après eco-core, tdl-base et quais-core, AVANT quais-comptoir.
 */
(function () {
  "use strict";
  if (!window.EcoCore) { if (window.console) console.warn("[tdl-objets] eco-core absent."); return; }

  /* ===================== CONFIG ===================== */
  var CFG = {
    NODE_MEMBRES:  "membres",
    SOUS_INV:      "inventaire",
    SOUS_DETTES:   "dettes",
    NODE_JOURNAL:  "consommations",
    NOTIF_EFFIGIE: 106,   /* la cible : un sort la frappe, sans sa source */
    NOTIF_DETTE:   102    /* l'acheteur : dette karmique inscrite */
  };

  /* Table canonique des objets. tdl-inventaire, le module de post, le bloc SOS
     et l'onglet Inventaires du staff la lisent tous ici. */
  var OBJETS = {
    medaille:{n:"Médaille de Saint François", ic:"medal",           art:"Aide inattendue",          eff:"Une coïncidence heureuse survient."},
    poupee:  {n:"Poupée vaudou",              ic:"needle",          art:"Effigie rituelle", subi:true, eff:"Un mauvais sort te frappe."},
    amulette:{n:"Amulette",                   ic:"clover-alt",      art:"Gri-gri",                  eff:"Relance d\u2019un dé, ou annulation d\u2019un petit échec."},
    dollar:  {n:"Dollar porte-bonheur",       ic:"money-bill-wave", art:"Protection des ancêtres", leve:true, eff:"Une effigie ou un événement défavorable est écarté."},
    bougie:  {n:"Bougie de neuvaine",         ic:"candle-holder",   art:"Bénédiction des ancêtres", collectif:true, eff:"Une coïncidence favorable pour tous les participants du sujet."},
    brique:  {n:"Poudre de brique rouge",     ic:"block-brick",     art:"Purification du foyer", lieu:true, eff:"Le lieu est protégé d\u2019un aléa climatique."}
  };

  /* Durées de complication, en jours. Portée : ce que la cible doit tenir. */
  var EFFIGIE = {
    1: { lab:"Complication sérieuse", por:"tous",     jours:21, depose:true },
    2: { lab:"Complication légère",   por:"courants", jours:7,  depose:true },
    3: { lab:"Complication légère",   por:"courants", jours:7,  depose:true },
    4: { lab:"Rien",                  por:null,       jours:0,  depose:false }
  };
  var PURIF = {
    1: { lab:"Protection totale" },
    2: { lab:"Protection partielle" },
    3: { lab:"Protection partielle" },
    4: { lab:"Protection symbolique" }
  };

  var TEXTES = {
    NO_PSEUDO:  "Connecte-toi pour acheter.",
    NO_OBJET:   "Cet article ne dépose aucun objet : préviens le staff.",
    NO_SOCLE:   "Socle indisponible : réessaie dans un instant.",
    NO_CIBLE:   "Choisis le personnage visé.",
    NO_SOI:     "On ne s\u2019envoûte pas soi-même.",
    FONDS:      "Ton solde ne couvre pas cet achat.",
    FONDS_GELE: function (g) { return "Ton solde ne couvre pas cet achat : " + g + " $ sont retenus par la Main."; },
    ECHEC:      "L\u2019achat a échoué : ton solde est inchangé.",
    OK:         "Objet déposé dans ton inventaire.",
    OK_EFFIGIE: "Le sort est jeté : la poupée est déposée chez ta cible.",
    OK_RIEN:    "Le rituel n\u2019a rien donné. La dette karmique, elle, est bien ouverte.",
    DETTE:      "Effigie rituelle lancée contre un autre personnage"
  };

  /* ===================== UTILS ===================== */
  function Q(){ return window.Quais; }
  function jour(decalage){ var d = new Date(); if (decalage) d.setDate(d.getDate() + decalage); return d.toISOString().slice(0, 10); }
  function jourFR(iso){ var p = String(iso).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso; }
  function d4(){ return 1 + Math.floor(Math.random() * 4); }
  function echec(msg){ return Promise.reject(new Error(msg)); }
  function messageArgent(e){
    if (e && e.message === "GELE")  return TEXTES.FONDS_GELE(Q().gele());
    if (e && e.message === "FONDS") return TEXTES.FONDS;
    if (e && e.message === "CONNEXION") return TEXTES.NO_PSEUDO;
    return TEXTES.ECHEC;
  }

  /* ===================== CONSTRUCTION DU PATCH ===================== */
  function entree(item, c, de){
    var e = { o:item.obj, src:item.id, t:jour(0), st:"actif" };
    if (item.ch) e.ch = item.ch;
    if (c.lieu) e.lieu = String(c.lieu).trim();
    if (de) e.de = de;
    return e;
  }
  function entreeSubie(item, c, de){
    var r = EFFIGIE[de];
    var e = { o:item.obj, src:item.id, t:jour(0), st:"subi", de:de, por:r.por, exp:jour(r.jours) };
    if (c.boutique) e.boutique = c.boutique;
    return e;
  }
  function dette(item, cible){
    return { type:item.detteAuto || "karmique", creancier:item.creancier || "Karma",
             motif:TEXTES.DETTE + (cible ? " (" + cible + ")" : ""), montant:0, statut:"active", date:new Date().toISOString() };
  }
  function journal(p, item, cible, c, de){
    var j = { p:p, o:item.obj, src:item.id, r:"achat", t:new Date().toISOString(), cible:cible || "" };
    if (de) j.de = de;
    if (c.boutique) j.boutique = c.boutique;
    return j;
  }

  /* ===================== ACHAT ===================== */
  async function acheter(req){
    var item = req && req.item, c = (req && req.champs) || {};
    if (!Q() || !Q().achat || !window.TDLBase || !window.TDLBase.nouvelleCle) throw new Error(TEXTES.NO_SOCLE);
    var p = Q().pseudo();
    if (!p) throw new Error(TEXTES.NO_PSEUDO);
    if (!item || !item.obj) throw new Error(TEXTES.NO_OBJET);

    item = Object.assign({ id:req.id }, item);
    var montant = parseInt(item.p, 10) || 0;
    var effigie = !!item.ciblePJ;
    var cible = effigie ? String(c.cible_pj || "").trim() : "";
    if (effigie && !cible) throw new Error(TEXTES.NO_CIBLE);
    if (effigie && cible === p) throw new Error(TEXTES.NO_SOI);
    var de = (effigie || item.obj === "brique") ? d4() : 0;

    try { await Q().achat.retenir(montant); }
    catch(e){ throw new Error(messageArgent(e)); }

    var B = window.TDLBase, patch = {};
    if (effigie) {
      /* le 4 ne dépose rien : la dette, elle, est due quoi qu'il arrive */
      if (EFFIGIE[de].depose) patch[CFG.NODE_MEMBRES + "/" + cible + "/" + CFG.SOUS_INV + "/" + B.nouvelleCle()] = entreeSubie(item, c, de);
      patch[CFG.NODE_MEMBRES + "/" + p + "/" + CFG.SOUS_DETTES + "/" + B.nouvelleCle()] = dette(item, cible);
    } else {
      patch[CFG.NODE_MEMBRES + "/" + p + "/" + CFG.SOUS_INV + "/" + B.nouvelleCle()] = entree(item, c, de);
    }
    patch[CFG.NODE_JOURNAL + "/" + B.nouvelleCle()] = journal(p, item, cible, c, de);

    try { await window.EcoCore.firebaseUpdate(patch); }
    catch(e){
      try { await Q().achat.rendre(montant); }
      catch(e2){ if (window.console) console.error("[tdl-objets] RECRÉDIT ÉCHOUÉ pour " + p + " : " + montant, e2); }
      throw new Error(TEXTES.ECHEC);
    }
    if (effigie) notifier(p, EFFIGIE[de].depose ? cible : "", de, item);
    return resultat(de, effigie);
  }

  function resultat(de, effigie){
    var out = { message:TEXTES.OK };
    if (effigie) { out.de = de; out.deLabel = EFFIGIE[de].lab; out.message = EFFIGIE[de].depose ? TEXTES.OK_EFFIGIE : TEXTES.OK_RIEN; }
    else if (de) { out.de = de; out.deLabel = (PURIF[de] || {}).lab || ""; }
    return out;
  }

  /* La source reste anonyme : la cible apprend qu'elle est visée, jamais par
     qui. L'échec d'une notification ne remonte pas : l'achat, lui, a eu lieu. */
  function notifier(acheteur, cible, de, item){
    if (!window.EcoNotif) return;
    try {
      if (cible) {
        var r = EFFIGIE[de];
        window.EcoNotif.a(cible, CFG.NOTIF_EFFIGIE, {
          jusqu: jourFR(jour(r.jours)),
          portee: r.por === "tous" ? "tous tes sujets" : "tes sujets en cours, hors intrigue et événement"
        });
      }
      window.EcoNotif.a(acheteur, CFG.NOTIF_DETTE, { motif: dette(item, "").motif });
    } catch(e){ if (window.console) console.warn("[tdl-objets] notification impossible :", e); }
  }

  /* ===================== EXPOSITION ===================== */
  window.TDLObjets = { acheter: acheter, OBJETS: OBJETS, EFFIGIE: EFFIGIE, PURIF: PURIF };
})();
