/*
 * barge-sorcieres.js — Bande « Les Sorcières du Baron » (marché noir) · TDL · v3
 *
 * OFFRANDE À TROIS MODES. Le prix des Lwas, L'empreinte des âmes et la Requête
 *   acceptent l'argent (400 $ minimum, retenus à l'envoi), un secret, ou une
 *   créance de service (deux au plus en cours). « Confier un secret » n'a pas
 *   de mode : le secret est à la fois l'objet et le prix.
 *
 * L'argent va à la cagnotte des Spectres, la communauté avec laquelle vivent
 *   les Sorcières. Pour la Requête et L'empreinte, il reste retenu jusqu'à ce
 *   que leur fiche se dénoue au tableau des secrets ; pour Le prix des Lwas,
 *   il est versé à la validation staff (aucune fiche n'est ouverte).
 *
 * [MAJ v3] Un seul bouton, contrôles déclarés dans regles : valider() et le
 *   filet avantAchat, qui portaient les mêmes règles en double et avaient
 *   déjà divergé, disparaissent.
 *
 * [MAJ v3-1] RÉSEAU DE CRÉANCES. Un service promis aux Sorcières n'ouvre plus
 *   de fiche au tableau des secrets : à la validation staff, ton personnage
 *   entre à leur réseau de créances, au bottin des hors-la-loi, jusqu'à ce
 *   qu'une Sorcière réclame son dû. Le plafond (deux services en cours) se
 *   compte sur ce réseau.
 *
 * À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-sorcieres] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, money = Q.money;

  /* ===================== CONFIG ===================== */
  var CFG = { CAGNOTTE:"Les Spectres", MIN_ARGENT:400, MAX_CREANCES:2, MIN_SECRET:80 };

  var MODES   = [["argent","Argent"],["secret","Un secret"],["creance","Un service dû"]];
  var NATURES = [["materiel","Matériel ou fourniture"],["transport","Transport ou passage"],["abri","Abri"],
                 ["acces","Accès à un lieu ou à un métier"],["silence","Silence ou témoignage"],
                 ["mainoeuvre","Main-d\u2019\u0153uvre"],["info","Information à ramener"]];

  /* ===================== TEXTES ===================== */
  var T = {
    HERO:          "Les Sorcières du Baron sont à l\u2019écoute les Lwas et pèsent les offrandes proposées. Les secrets sont leur monnaie et parfois consentent-elles à exaucer les prières.",
    L_REQUETE:     "Ta requête *",
    PH_REQUETE:    "Ce que recherche ton personnage, et pourquoi il s\u2019en remet aux Sorcières\u2026",
    L_CONTEXTE:    "Contexte de ta demande *",
    PH_CONTEXTE:   "Ce qui amène ton personnage jusqu\u2019à elles\u2026",
    L_MODE:        "Ton offrande *",
    L_MONTANT:     "Montant (400 $ min.)",
    AIDE_ARGENT:   "La somme est retenue à l\u2019envoi et rendue si les Sorcières refusent. Sur une requête, elle pèse dans leur décision.",
    L_TITRE:       "Titre du secret *",
    PH_TITRE:      "Ce qu\u2019on lira au tableau, sans rien dévoiler\u2026",
    AIDE_TITRE:    "L\u2019intitulé public du secret : il doit intriguer sans rien révéler.",
    L_SECRET:      "Le secret que tu offres *",
    L_SECRET_SEUL: "Le secret confié aux Lwas *",
    PH_SECRET:     "Ce que personne ne devrait savoir\u2026",
    AIDE_SECRET:   "Intime, et lié au jeu : un personnage, un PNJ d\u2019une famille influente, un lieu, un fait du lore. Une banalité sera refusée.",
    L_NATURE:      "Nature du service *",
    L_DETAIL:      "Ce que ton personnage offre *",
    PH_DETAIL:     "Ce qu\u2019il fournira, et dans quelles limites.",
    AIDE_CREANCE:  "Rien à payer maintenant. Si les Sorcières acceptent, ton personnage entre à leur réseau de créances, au bottin des hors-la-loi, jusqu\u2019à ce qu\u2019elles réclament leur dû.",
    RESTE:         function (n) { return n + " service" + (n>1?"s":"") + " déjà dû" + (n>1?"s":"") + " sur " + CFG.MAX_CREANCES + "."; },
    AIDE_JETON:    "En échange, les Sorcières te doivent un refus : tu pourras annuler une créance future, une seule fois, sans trace.",
    AVERTIR:       "Sous la Brume, on parle. Ce que tu diras pendant la nuit, les Sorcières le garderont.",

    ERR_REQUETE:   "Formule d\u2019abord ta requête.",
    ERR_MODE:      "Choisis ce que tu offres.",
    ERR_MONTANT:   "L\u2019offrande en argent commence à " + CFG.MIN_ARGENT + " $.",
    ERR_TITRE:     "Donne un titre à ton secret : c\u2019est ce que les Sorcières liront au tableau.",
    ERR_SECRET:    "Un secret se raconte. Développe : les Sorcières refuseront une phrase en l\u2019air.",
    ERR_NATURE:    "Précise la nature du service et ce que ton personnage offre.",
    ERR_PLAFOND:   "Tu dois déjà " + CFG.MAX_CREANCES + " services aux Sorcières. Acquitte-t\u2019en d\u2019un avant d\u2019en promettre un autre.",

    OK_ARGENT:     "Ton offrande est déposée auprès des Sorcières.",
    OK_SECRET:     "Ton secret est porté aux Sorcières.",
    OK_CREANCE:    "Ta promesse est portée aux Sorcières. Si le staff valide, ton personnage entre à leur réseau de créances.",
    OK_SECRET_SEUL:"Ton secret est brûlé pour les Lwas. Si le staff valide, les Sorcières en deviennent dépositaires."
  };

  /* ===================== CATALOGUE ===================== */
  var DATA = {
    prixlwas:{ flow:"offrande", n:"Le prix des Lwas",
      desc:"Demande ce dont tu as vraiment besoin : protéger un proche, jeter le mauvais \u0153il, échapper au fisc, renouer avec un ex. Les Lwas répondront — et demandent toujours quelque chose en échange." },
    empreinte:{ flow:"offrande", n:"L\u2019empreinte des âmes", avertir:true,
      desc:"Apporte un objet hérité qui a compté pour quelqu\u2019un. Une Sorcière traverse avec toi une nuit de sommeil rituel pour y décrypter ce qu\u2019il porte encore.",
      bullets:["La nuit se joue en RP avec la Sorcière qui prend la séance.",
               "Le staff y inscrit un fait que ton personnage ignorait : un nom, une date, une raison, un tort.",
               "L\u2019objet te revient marqué de ce qu\u2019on y a lu."] },
    requete:{ flow:"offrande", n:"Requête aux Sorcières",
      desc:"Les Sorcières n\u2019accordent pas leurs services à la légère. Explique ce que recherche ton personnage, ce qu\u2019il est prêt à offrir, et pourquoi il s\u2019en remet à elles.",
      examples:["Obtenir une entrevue avec le Baron","Être conduit jusqu\u2019à Lost Bayou",
                "Mettre une personne à l\u2019abri à Lost Bayou","Une préparation ou un remède exceptionnel",
                "Faire examiner un objet, une personne ou un lieu maudit","Interpréter un phénomène inexpliqué"] },
    secret:{ flow:"offrande", n:"Confier un secret aux Lwas", sansMode:true,
      desc:"Tu écris un secret avant de le brûler en l\u2019honneur des Lwas. Les Sorcières en deviennent dépositaires. Ce qu\u2019elles en feront ne tient qu\u2019à elles." }
  };

  function creancesOuvertes(api){ try { return api.creances().length; } catch(e){ return 0; } }

  /* ===================== CORPS ===================== */
  function champContexte(){ return ui.fld(T.L_CONTEXTE, ui.ta("contexte", T.PH_CONTEXTE)); }

  function blocSecret(libelle){
    return ui.fld(T.L_TITRE, ui.inp("offrande_secret_titre", T.PH_TITRE)) + ui.aide(T.AIDE_TITRE)
      + ui.fld(libelle, ui.ta("offrande_secret", T.PH_SECRET)) + ui.aide(T.AIDE_SECRET);
  }

  function corpsOffrande(item, api){
    var n = creancesOuvertes(api);
    return ui.section("Ta requête",
        ui.fld(T.L_REQUETE, ui.ta("requete", T.PH_REQUETE))
      + champContexte())
      + ui.section("Ton offrande",
        ui.rangee(
          ui.fld(T.L_MODE, ui.sel("offrande_mode", MODES, "— Choisir —", { bascule:"mode" })),
          ui.zone("mode:argent", ui.fld(T.L_MONTANT, ui.inp("offrande_montant", String(CFG.MIN_ARGENT), CFG.MIN_ARGENT)))
          + ui.zone("mode:creance", ui.fld(T.L_NATURE, ui.sel("offrande_creance_type", NATURES, "— Choisir —")))
        )
      + ui.zone("mode:argent", ui.aide(T.AIDE_ARGENT))
      + ui.zone("mode:secret", blocSecret(T.L_SECRET))
      + ui.zone("mode:creance", ui.fld(T.L_DETAIL, ui.ta("offrande_creance_detail", T.PH_DETAIL))
          + ui.aide(T.AIDE_CREANCE + (n ? " " + T.RESTE(n) : ""))
          + (n >= CFG.MAX_CREANCES ? ui.aide(T.ERR_PLAFOND) : "")))
      + ui.envoi();
  }

  function corpsSecret(){
    return ui.section("Ton secret", blocSecret(T.L_SECRET_SEUL) + champContexte() + ui.aide(T.AIDE_JETON))
      + ui.envoi();
  }

  function body(item, api){
    var b = "";
    if (item.bullets)  b += ui.puces("Ce que la séance produit", item.bullets);
    if (item.examples) b += ui.puces("Exemples de requêtes", item.examples);
    if (item.avertir)  b += ui.aide(T.AVERTIR);
    return b + (item.sansMode ? corpsSecret() : corpsOffrande(item, api));
  }

  /* ===================== RÈGLES ===================== */
  function mode(m){ return function(c){ return c.offrande_mode===m; }; }

  var regles = {
    secret: {
      resoudre: function(){ return { act:"demande", demandeType:"offrande", champs:{ offrande_mode:"secret" } }; },
      requis:  [ ["offrande_secret_titre", T.ERR_TITRE] ],
      msg: T.OK_SECRET_SEUL
    },
    offrande: {
      resoudre: function(c){
        if (c.offrande_mode==="argent") return { act:"comptant", montant: ui.montant(c.offrande_montant) };
        return { act:"demande", demandeType:"offrande" };
      },
      requis: [
        ["requete",                 T.ERR_REQUETE],
        ["offrande_mode",           T.ERR_MODE],
        ["offrande_secret_titre",   T.ERR_TITRE,  mode("secret")],
        ["offrande_creance_type",   T.ERR_NATURE, mode("creance")],
        ["offrande_creance_detail", T.ERR_NATURE, mode("creance")]
      ],
      minima: [ ["offrande_montant", CFG.MIN_ARGENT, T.ERR_MONTANT, mode("argent")] ],
      msg: function(c){ return c.offrande_mode==="argent" ? T.OK_ARGENT : c.offrande_mode==="secret" ? T.OK_SECRET : T.OK_CREANCE; }
    }
  };

  /* métier : longueur du secret, plafond des services dus */
  function controle(item, c, act, id, api){
    var secret = item.sansMode || c.offrande_mode==="secret";
    if (secret && String(c.offrande_secret||"").trim().length < CFG.MIN_SECRET) return T.ERR_SECRET;
    if (c.offrande_mode==="creance" && creancesOuvertes(api) >= CFG.MAX_CREANCES) return T.ERR_PLAFOND;
    return null;
  }

  /* ===================== DÉCLARATION ===================== */
  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"sorc", bohl:"sorcieres", ordre:5, l:"Les Sorcières du Baron",
    ic:"fi fi-tr-snake", c:"var(--gr4-color)", cagnotte:CFG.CAGNOTTE,
    hero:{ logo:"fi fi-tr-snake", desc:T.HERO },
    heroPrice: function(item){ return { l:"Offrande", v: item.sansMode ? "Un secret" : "Argent, secret ou service" }; },
    data: DATA, regles: regles, body: body, controle: controle
  });
})();
