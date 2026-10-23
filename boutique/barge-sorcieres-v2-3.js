/*
 * barge-sorcieres.js — Bande « Les Sorcières du Baron » (marché noir) · TDL · v2
 *
 * MÉCANIQUE : OFFRANDE À TROIS MODES. Trois services acceptent l'argent
 *   (400 $ minimum), un secret, ou une créance de service. « Confier un secret »
 *   n'a pas de mode : le secret est à la fois l'objet et le prix.
 *
 * [MAJ v2] L'ACHAT NE PASSE PLUS PAR LE BOUTON STANDARD.
 *   lancerAchat lit le montant dans data-montant, une valeur FIGÉE : impossible
 *   pour une somme saisie. On passe par api.acheter(), le point d'extension
 *   prévu par quais-core (même chemin que le dé de la Flottille).
 *   CONSÉQUENCE : api.acheter n'appelle PAS avantAchat — ce hook n'existe que
 *   dans lancerAchat. Les trois contrôles (montant, secret non vide, plafond
 *   des créances) sont donc faits ici, dans valider(), avant tout débit.
 *   avantAchat reste déclaré en filet, au cas où un bouton standard reviendrait.
 *
 * [MAJ v2] « Rêver sous l'œil du Guédé » est supprimé, absorbé par
 *   « L'empreinte des âmes ». migre() n'efface jamais : l'entrée rever a été
 *   retirée à la main dans boutique/barge.
 *
 * DÉPEND DE : window.Quais ; api.creances() (quais-core, pour le plafond).
 * À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-sorcieres] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, money = Q.money, esc = ui.esc;

  /* ===================== CONFIG ===================== */
  var CFG = {
    CAGNOTTE:     "Les Spectres",
    MIN_ARGENT:   400,
    MAX_CREANCES: 2,
    MIN_SECRET:   80          /* un secret d'une ligne n'en est pas un */
  };

  var MODES = [
    ["argent",  "Argent"],
    ["secret",  "Un secret"],
    ["creance", "Une créance de service"]
  ];
  var NATURES = [
    ["materiel",   "Matériel ou fourniture"],
    ["transport",  "Transport ou passage"],
    ["abri",       "Abri"],
    ["acces",      "Accès à un lieu ou à un métier"],
    ["silence",    "Silence ou témoignage"],
    ["mainoeuvre", "Main-d\u2019\u0153uvre"],
    ["info",       "Information à ramener"]
  ];

  var TEXTES = {
    MODALITE:     "Offrande",
    HERO_TROIS:   "Argent, secret ou service",
    HERO_SECRET:  "Un secret",
    L_REQUETE:    "Votre requête *",
    PH_REQUETE:   "Ce que recherche votre personnage, et pourquoi il s\u2019en remet aux Sorcières\u2026",
    L_MODE:       "Votre offrande *",
    L_MONTANT:    "Montant offert ($)",
    AIDE_MONTANT: "Minimum " + CFG.MIN_ARGENT + " $, sans maximum. La somme est retenue dès l\u2019envoi et versée à la cagnotte des Spectres à la validation. Sur une requête, elle pèse dans la décision des Sorcières.",
    L_SECRET:     "Le secret que vous offrez",
    PH_SECRET:    "Ce que personne ne devrait savoir\u2026",
    AIDE_SECRET:  "Il doit être intime et concerner quelqu\u2019un ou quelque chose du jeu : un autre personnage, un PNJ d\u2019une famille influente, un prédéfini partagé, un lieu, un fait du lore. Une banalité sera refusée.",
    L_NATURE:     "Nature du service promis",
    L_DETAIL:     "Ce que votre personnage offre",
    PH_DETAIL:    "En une phrase : ce qu\u2019il fournira, et dans quelles limites.",
    AIDE_CREANCE: "Vous ne payez rien maintenant. Les Sorcières réclameront ce service quand elles le jugeront bon.",
    L_SECRET_SEUL:"Le secret confié aux Lwas",
    L_TITRE:      "Titre du secret *",
    PH_TITRE:     "Intitulé lisible dans le pot des secrets des Sorcière, sans rien dévoiler\u2026",
    AIDE_TITRE:   "C\u2019est l\u2019intitulé public du secret au tableau des Sorcières : il doit intriguer sans rien révéler. \u00ab Ce que le père Thibodeaux a enterré \u00bb, pas le contenu.",
    ERR_TITRE:    "Donnez un titre au secret : c\u2019est ce que les Sorcières liront au tableau.",
    AIDE_JETON:   "En échange, les Sorcières vous doivent un refus : vous pourrez annuler une créance future, une seule fois, sans trace.",
    AVERTIR:      "Sous la Brume, on parle. Ce que vous direz pendant la nuit, les Sorcières le garderont.",
    BTN:          "Soumettre aux Sorcières",
    ERR_REQUETE:  "Formulez d\u2019abord votre requête.",
    ERR_MODE:     "Choisissez ce que vous offrez.",
    ERR_MONTANT:  "L\u2019offrande en argent commence à " + CFG.MIN_ARGENT + " $.",
    ERR_FONDS:    "Votre solde ne couvre pas cette offrande.",
    ERR_SECRET:   "Un secret se raconte. Développez : les Sorcières refuseront une phrase en l\u2019air.",
    ERR_NATURE:   "Précisez la nature du service et ce que votre personnage offre.",
    ERR_PLAFOND:  "Vous avez déjà " + CFG.MAX_CREANCES + " services dus aux Sorcières. Acquittez-en un avant d\u2019en promettre un autre.",
    OK_ARGENT:   "Offrande déposée. La somme est retenue jusqu\u2019à ce que les Sorcières se prononcent ; elle vous sera rendue si elles refusent.",
    OK_OFFRANDE: "Votre requête est portée aux Sorcières. Elles délibéreront, et vous répondront en RP.",
    RESTE:        function (n) { return n + " service" + (n > 1 ? "s" : "") + " déjà dû" + (n > 1 ? "s" : "") + " sur " + CFG.MAX_CREANCES + "."; }
  };

  /* ===================== CATALOGUE ===================== */
  var DATA = {
    prixlwas:{ flow:"offrande", n:"Le prix des Lwas",
      desc:"Demandez ce dont vous avez vraiment besoin : protéger un proche, jeter le mauvais \u0153il, échapper au fisc, renouer avec un ex. Les Lwas répondront \u2014 et demandent toujours quelque chose en échange." },

    empreinte:{ flow:"offrande", n:"L\u2019empreinte des âmes",
      desc:"Apportez un objet hérité qui a compté pour quelqu\u2019un \u2014 de votre lignée ou d\u2019une autre famille. Une Sorcière traverse avec vous une nuit de sommeil rituel pour y décrypter ce qu\u2019il porte encore.",
      bullets:["La nuit se joue en RP avec la Sorcière qui prend la séance.",
               "Le staff y inscrit un fait que votre personnage ignorait : un nom, une date, une raison, un tort.",
               "L\u2019objet vous revient marqué de ce qu\u2019on y a lu."],
      avertir:true },

    requete:{ flow:"offrande", n:"Requête aux Sorcières",
      desc:"Les Sorcières n\u2019accordent pas leurs services à la légère. Expliquez ce que recherche votre personnage, ce qu\u2019il est prêt à offrir et pourquoi il s\u2019en remet aux Sorcières de Lost Bayou.",
      examples:["Obtenir une entrevue avec le Baron","Être conduit jusqu\u2019à Lost Bayou",
                "Mettre une personne à l\u2019abri à Lost Bayou","Une préparation ou un remède exceptionnel",
                "Faire examiner un objet, une personne ou un lieu maudit","Interpréter un phénomène étrange ou inexpliqué"] },

    secret:{ flow:"offrande", n:"Confier un secret aux Lwas", sansMode:true,
      desc:"Vous écrivez un secret avant de le brûler en l\u2019honneur des Lwas. Les Sorcières en deviennent dépositaires. Ce qu\u2019elles en feront, demain ou dans trois mois, ne tient qu\u2019à elles." }
  };

  /* ===================== UTILS ===================== */
  function creancesOuvertes(api){
    try { return api.creances ? api.creances().length : 0; } catch(e){ return 0; }
  }
  function champ(det, nom){
    var el = det.querySelector('[data-champ="' + nom + '"]');
    return el ? String(el.value || "").trim() : "";
  }
  function vider(det, noms){
    noms.forEach(function(n){
      var el = det.querySelector('[data-champ="' + n + '"]');
      if (el) el.value = "";
    });
  }
  function zone(det, nom){ return det.querySelector('[data-zone="' + nom + '"]'); }

  /* ===================== RENDER ===================== */
  function heroPrice(item){
    return { l:TEXTES.MODALITE, v: item.sansMode ? TEXTES.HERO_SECRET : TEXTES.HERO_TROIS };
  }

  function selMode(){
    return '<select data-champ="offrande_mode"><option value="">\u2014 Choisir \u2014</option>'
      + MODES.map(function(m){ return '<option value="' + m[0] + '">' + esc(m[1]) + '</option>'; }).join("")
      + '</select>';
  }
  function selNature(){
    return '<select data-champ="offrande_creance_type"><option value="">\u2014 Choisir \u2014</option>'
      + NATURES.map(function(n){ return '<option value="' + n[0] + '">' + esc(n[1]) + '</option>'; }).join("")
      + '</select>';
  }
  function aide(t){ return '<div class="qb-helper">' + esc(t) + '</div>'; }

    /* colonne de droite : le premier champ du mode choisi */
  function branchesDuo(api){
    return '<div data-zone="argent" style="display:none">'
      +   ui.fld(TEXTES.L_MONTANT, ui.inp("offrande_montant", String(CFG.MIN_ARGENT)))
      + '</div>'
      + '<div data-zone="creance" style="display:none">'
      +   ui.fld(TEXTES.L_NATURE, selNature())
      + '</div>';
  }

  /* pleine largeur : les textes longs et les aides */
  function branchesFull(api){
    var n = creancesOuvertes(api), plein = n >= CFG.MAX_CREANCES;
    return '<div data-zone="argent2" class="qb-sorc-full" style="display:none">'
      +   aide(TEXTES.AIDE_MONTANT)
      + '</div>'
      + '<div data-zone="secret" class="qb-sorc-full" style="display:none">'
      +   ui.fld(TEXTES.L_TITRE, ui.inp("offrande_secret_titre", TEXTES.PH_TITRE))
      +   aide(TEXTES.AIDE_TITRE)
      +   ui.fld(TEXTES.L_SECRET, ui.ta("offrande_secret", TEXTES.PH_SECRET))
      +   aide(TEXTES.AIDE_SECRET)
      + '</div>'
      + '<div data-zone="creance2" class="qb-sorc-full" style="display:none">'
      +   ui.fld(TEXTES.L_DETAIL, ui.ta("offrande_creance_detail", TEXTES.PH_DETAIL))
      +   aide(TEXTES.AIDE_CREANCE + (n ? " " + TEXTES.RESTE(n) : ""))
      +   (plein ? aide(TEXTES.ERR_PLAFOND) : "")
      + '</div>';
  }

  function bouton(){
    return '<div class="qb-opts qb-center">'
      + '<button class="qb-optbtn qb-pay" id="qb-sorc-envoi" style="flex:none">' + esc(TEXTES.BTN) + '</button>'
      + '</div>';
  }

  function body(item, api){
    var b = "";
    if (item.bullets) b += '<div class="qb-sec">' + ui.lab("Ce que la séance produit")
      + '<ul class="qb-bull">' + item.bullets.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>';
    if (item.examples) b += '<div class="qb-sec">' + ui.lab("Exemples de demandes")
      + '<ul class="qb-bull">' + item.examples.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>';
    if (item.avertir) b += '<div class="qb-sec">' + aide(TEXTES.AVERTIR) + '</div>';

    b += '<div class="qb-rule"></div><div class="qb-sec">' + ui.lab("Formuler votre requête");

    if (item.sansMode) {
      b += ui.fld(TEXTES.L_TITRE, ui.inp("offrande_secret_titre", TEXTES.PH_TITRE))
        +  aide(TEXTES.AIDE_TITRE)
        +  ui.fld(TEXTES.L_SECRET_SEUL, ui.ta("offrande_secret", TEXTES.PH_SECRET))
        +  aide(TEXTES.AIDE_SECRET) + aide(TEXTES.AIDE_JETON);
    } else {
            b += ui.fld(TEXTES.L_REQUETE, ui.ta("requete", TEXTES.PH_REQUETE))
        +  '<div class="qb-sorc-duo">'
        +    ui.fld(TEXTES.L_MODE, selMode())
        +    branchesDuo(api)
        +  '</div>'
        +  branchesFull(api);
    }
    return b + '</div>' + bouton();
  }

  /* ===================== CONTRÔLES ===================== */
  /* Rendus AVANT tout débit. api.acheter ne passe pas par avantAchat : si ces
     contrôles sautent, le débit part sans filet. */
  function valider(det, item, api){
    if (item.sansMode) {
      if (!champ(det, "offrande_secret_titre")) return TEXTES.ERR_TITRE;
      if (champ(det, "offrande_secret").length < CFG.MIN_SECRET) return TEXTES.ERR_SECRET;
      return null;
    }
    if (!champ(det, "requete")) return TEXTES.ERR_REQUETE;
    var mode = champ(det, "offrande_mode");
    if (!mode) return TEXTES.ERR_MODE;

    if (mode === "argent") {
      var m = parseInt(champ(det, "offrande_montant").replace(/[^\d]/g, ""), 10) || 0;
      if (m < CFG.MIN_ARGENT) return TEXTES.ERR_MONTANT;
      if (Q.dispo() < m) return TEXTES.ERR_FONDS;   /* tient compte des sommes gelées par la Main */
      return null;
    }
    if (mode === "secret") {
      if (!champ(det, "offrande_secret_titre")) return TEXTES.ERR_TITRE;
      if (champ(det, "offrande_secret").length < CFG.MIN_SECRET) return TEXTES.ERR_SECRET;
      return null;
    }
    if (creancesOuvertes(api) >= CFG.MAX_CREANCES) return TEXTES.ERR_PLAFOND;
    if (!champ(det, "offrande_creance_type") || !champ(det, "offrande_creance_detail")) return TEXTES.ERR_NATURE;
    return null;
  }

  /* ===================== EVENTS ===================== */
  function wireDetail(det, api, item){
    var sel = det.querySelector('[data-champ="offrande_mode"]');
    var ZONES = { argent:["argent","argent2"], secret:["secret"], creance:["creance","creance2"] };
    if (sel) sel.onchange = function(){
      var v = sel.value;
      ["argent","argent2","secret","creance","creance2"].forEach(function(k){
        var z = zone(det, k); if (z) z.style.display = "none";
      });
      (ZONES[v] || []).forEach(function(k){
        var z = zone(det, k); if (z) z.style.display = "";
      });
      if (v !== "argent")  vider(det, ["offrande_montant"]);
      if (v !== "secret")  vider(det, ["offrande_secret", "offrande_secret_titre"]);
      if (v !== "creance") vider(det, ["offrande_creance_type", "offrande_creance_detail"]);
      if (v === "argent") {
        var mt = det.querySelector('[data-champ="offrande_montant"]');
        if (mt && !mt.value) mt.value = String(CFG.MIN_ARGENT);
      }
    };

    var btn = det.querySelector("#qb-sorc-envoi");
    if (!btn) return;
    btn.onclick = async function(){
      var refus = valider(det, item, api);
      if (refus) { alert(refus); return; }

      var mode = item.sansMode ? "secret" : champ(det, "offrande_mode");
      var opts = { champs:{ offrande_mode: mode }, silent:true };

      if (mode === "argent") {
        opts.act = "comptant";
        opts.montant = parseInt(champ(det, "offrande_montant").replace(/[^\d]/g, ""), 10) || 0;
      } else {
        opts.act = "demande";
        opts.demandeType = "offrande";
      }

      btn.disabled = true;
      try {
        var res = await api.acheter(opts);
        if (res && res.ok) alert(mode === "argent" ? TEXTES.OK_ARGENT : TEXTES.OK_OFFRANDE);
      } finally { btn.disabled = false; }
    };
  }

  /* Filet : api.acheter court-circuite ce hook, mais un bouton .qb-act ajouté
     plus tard repasserait par lancerAchat. Les règles restent au même endroit. */
  function avantAchat(item, champs, act){
    if (item.sansMode) {
      if (!String(champs.offrande_secret_titre || "").trim()) return TEXTES.ERR_TITRE;
      return (String(champs.offrande_secret || "").trim().length < CFG.MIN_SECRET) ? TEXTES.ERR_SECRET : null;
    }
    if (!String(champs.requete || "").trim()) return TEXTES.ERR_REQUETE;
    if (!champs.offrande_mode) return TEXTES.ERR_MODE;
    if (champs.offrande_mode === "argent" && act !== "comptant") return TEXTES.ERR_MONTANT;
    return null;
  }

  /* ===================== REGISTRE ===================== */
  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"sorc", bohl:"sorcieres", ordre:5, l:"Les Sorcières du Baron",
    ic:"fi fi-tr-snake", c:"var(--gr4-color)",
    cagnotte: CFG.CAGNOTTE,
    hero:{ logo:"fi fi-tr-snake", desc:"Les Sorcières du Baron ne connaissent pas les dollars. Elles écoutent les Lwas et pèsent les offrandes." },
    data: DATA, body: body, heroPrice: heroPrice, wireDetail: wireDetail, avantAchat: avantAchat
  });
})();
