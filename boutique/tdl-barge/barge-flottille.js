/*
 * barge-flottille.js — Bande « La Flottille » (marché noir) · TDL · v3
 *
 * TROIS SERVICES, UN SEUL CIRCUIT : boutique_demandes puis validation staff.
 *   PASSAGE      — prix fixe (item.p), payé comptant OU par un service dû.
 *                  Le service dû n'est jamais de l'argent : à la validation,
 *                  quai-staff inscrit le personnage aux piliers de la Flottille
 *                  au bottin, avec le concours promis et le statut « service dû ».
 *                  Refusé si un recouvrement de la Main gèle le solde.
 *   DISPARITION  — 500 $ minimum, retenus à l'envoi. Validée, elle descend au
 *                  tableau du hangar (flottille/disparitions).
 *   OPÉRATION    — 800 $ minimum, retenus à l'envoi. Validée, elle descend au
 *                  tableau du hangar (flottille/operations).
 *
 * [MAJ v3] Plus de bouton propre ni de garde-fou maison : un seul bouton
 *   « Soumettre ma demande », les contrôles sont déclarés dans regles et
 *   appliqués par barge-core, la confirmation par le socle.
 *
 * À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-flottille] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, money = Q.money;

  /* ===================== CONFIG ===================== */
  var CFG = { PRIX_PASSAGE:300, MIN_DISP:500, MIN_OP:800 };

  var PAIEMENTS = [["comptant","Comptant"],["service","Un service dû"]];
  var DUREES    = [["1","1 mois"],["2","2 mois"],["3","3 mois"]];
  var DESTINS   = [["texas","Texas"],["arkansas","Arkansas"],["mississippi","Mississippi"],
                   ["alabama","Alabama et sa côte"],["floride","Floride"],["indifferent","Peu importe"]];
  var MOTIFS    = [["dette","Se soustraire à une dette"],["enquete","Échapper à une enquête"],["perso","Raisons personnelles"]];
  var MANDS     = [["joueur","En mon nom"],["entreprise","Une entreprise"],["famille","Une famille"],["pnj","Un PNJ"],["anonyme","Anonyme"]];
  var VERROUS   = [["distance","La distance"],["incompatibilite","L\u2019incompatibilité entre les parties"],["invisibilite","L\u2019invisibilité nécessaire"]];

  /* ===================== TEXTES ===================== */
  var T = {
    HERO:          "La Flottille transporte, cache ou fait passer. Ce qu\u2019on lui confie reste entre elle et les bayous… jusqu\u2019à ce que ça n\u2019y reste plus.",
    L_CONTEXTE:    "Contexte de ta demande *",
    PH_CONTEXTE:   "Ce qui pousse ton personnage à faire appel à la Flottille\u2026",

    L_LIEU:        "Lieu ou communauté visée *",
    PH_LIEU:       "Un campement, un village, un ponton, une bande\u2026",
    L_VERROU_ACC:  "Ce qui rend l\u2019accès impossible autrement *",
    PH_VERROU_ACC: "Distance, méfiance, hostilité, absence de route\u2026",
    L_BUT:         "Ce que ton personnage compte y faire *",
    PH_BUT:        "Rencontrer, négocier, observer, se cacher\u2026",
    L_PAIEMENT:    "Paiement *",
    L_CONCOURS:    "Le service que tu devras *",
    PH_CONCOURS:   "Un savoir-faire, un accès, une paire de bras, un silence\u2026",
    AIDE_SERVICE:  "Pas d\u2019argent : un service dû. Il s\u2019affiche au bottin des hors-la-loi, parmi les piliers de la Flottille, jusqu\u2019à ce qu\u2019un capitaine vienne le réclamer.",
    AIDE_ACCUEIL:  "La Flottille garantit ton arrivée, pas l\u2019accueil qu\u2019on te réserve.",

    L_DUREE:       "Durée d\u2019absence *",
    L_DESTIN:      "Destination",
    L_PRIME_DISP:  "Prime * (500 $ min.)",
    L_PRIME_OP:    "Prime * (800 $ min.)",
    PH_PRIME:      "$",
    L_MOTIF:       "Motif du départ *",
    L_DETTE:       "Dette que tu fuis *",
    L_ENQUETE:     "Affaire que tu fuis *",
    SANS_DETTE:    "Aucune dette active à ton nom.",
    SANS_ENQUETE:  "Aucune affaire ouverte au panneau des enquêtes.",
    L_RESTENT:     "Personne laissée derrière *",
    L_RESTENT_PNJ: "Autres proches concernés",
    PH_RESTENT_PNJ:"Famille, associés, voisins\u2026",
    AIDE_DISP:     "Disparaître déplace le problème, ça ne l\u2019efface pas : ceux que tu laisses derrière en paieront le prix.",

    L_TITRE:       "Titre de l\u2019opération *",
    PH_TITRE:      "Ex. : La rencontre du chenal de Dulac",
    L_VERROU:      "Pourquoi la Flottille *",
    L_PARTIES:     "Qui doit se retrouver là *",
    PH_PARTIES:    "Communautés, bandes, familles, PNJ\u2026",
    L_OBJECTIF:    "Objectif *",
    PH_OBJECTIF:   "Ce que l\u2019opération doit produire\u2026",
    L_CONTRAINTES: "Contraintes (une par ligne)",
    PH_CONTRAINTES:"Délai, discrétion, lieu imposé\u2026",
    L_MANDTYPE:    "Commanditaire affiché",
    L_MAND:        "Nom affiché (sinon ton pseudo)",
    PH_MAND:       "Entreprise, famille, PNJ\u2026",
    AIDE_OP:       "Les capitaines peuvent demander à renégocier la prime à la hausse.",

    GEL:           "La Main a ouvert un recouvrement à ton nom : aucun capitaine ne te prendra pour un trajet ordinaire. Ce qu\u2019il te faut, c\u2019est une Disparition.",
    ERR_LIEU:      "Indique le lieu ou la communauté que ton personnage veut atteindre.",
    ERR_VERROU:    "Explique ce qui rend cet accès impossible autrement.",
    ERR_BUT:       "Dis ce que ton personnage compte faire sur place.",
    ERR_CONCOURS:  "Dis quel service ton personnage devra en retour.",
    ERR_RESTE:     "Désigne le personnage qui reste derrière : c\u2019est chez lui que la Main ira chercher.",
    ERR_DETTE:     "Choisis la dette que ton personnage fuit.",
    ERR_ENQUETE:   "Choisis l\u2019affaire que ton personnage fuit.",
    ERR_PRIME:     function (m) { return "La prime commence à " + money(m) + "."; },
    ERR_TITRE:     "Donne un titre à l\u2019opération.",
    ERR_PARTIES:   "Dis qui doit se retrouver là.",
    ERR_OBJ:       "Décris l\u2019objectif de l\u2019opération.",

    OK_PASSAGE:    "Demande de passage envoyée.",
    OK_SERVICE:    "Demande de passage envoyée. Si le staff valide, ton personnage rejoint les piliers de la Flottille au bottin, avec le service qu\u2019il doit.",
    OK_DISP:       "Demande de départ envoyée. Si le staff valide, elle s\u2019affiche au tableau du hangar.",
    OK_OP:         "Opération envoyée. Si le staff valide, elle s\u2019affiche au tableau du hangar.",
    CONF_14J:      "Sans preneur sous quatorze jours, la prime te sera rendue."
  };

  /* ===================== CATALOGUE ===================== */
  var DATA = {
    flot_passage: {
      flow:"prix", ic:"route", p:CFG.PRIX_PASSAGE, n:"Passage",
      desc:"Toutes les portes ne s\u2019atteignent pas depuis la route. Les campements se déplacent, certains villages ne reçoivent pas d\u2019étrangers, des bandes ne s\u2019approchent pas sans être annoncé. La Flottille connaît les chenaux et ceux qui vivent au bout.",
      bullets:[
        "Atteindre une communauté fermée, isolée ou hostile aux inconnus",
        "Se présenter devant une bande qui ne reçoit pas n\u2019importe qui",
        "Rejoindre un lieu que les cartes ignorent",
        "Arriver quelque part sans que personne n\u2019ait vu par où"
      ],
      helper:"Ce qu\u2019elle vend, ce n\u2019est pas la traversée : c\u2019est d\u2019arriver là où ton personnage n\u2019aurait eu ni raison ni moyen de se trouver. Terrebonne et ses abords uniquement."
    },
    flot_disparition: {
      flow:"disparition", ic:"fog", n:"Disparition temporaire",
      desc:"Sortir de Louisiane, et ne plus figurer nulle part pendant un temps. La Flottille sait faire. Ce qu\u2019elle ne sait pas faire, c\u2019est empêcher ceux que tu laisses derrière de payer à ta place.",
      helper:"De un à trois mois. Au retour, rien n\u2019aura été effacé : la dette aura seulement changé de mains."
    },
    flot_operation: {
      flow:"operation", ic:"anchor", n:"Opération",
      desc:"Ce que tu veux faire demande plus de monde que tu n\u2019en connais, et ces gens-là ne se parlent pas. La Flottille fournit le point de rencontre et les moyens du déplacement, rien d\u2019autre.",
      helper:"Ce qui se décide sur place ne la regarde pas. Elle réunit, elle déplace, elle s\u2019en va."
    }
  };

  /* ===================== LISTES DU MEMBRE ===================== */
  /* dettes actives ET prêts : [valeur, libellé], valeur = "dettes:clé" ou "prets:clé" */
  function listeDettes(api){
    var out = [];
    api.dus().forEach(function(x){
      var d = x.d || {};
      if (x.source==="dettes" && d.statut && d.statut!=="active") return;
      var titre = d.motif || d.nom || (x.source==="prets" ? "Prêt" : "Dette");
      out.push([x.key, (x.source==="prets" ? "Prêt de " + money(+d.montant||0) + " — " + titre : titre)
                       + (d.creancier ? " \u27e1 " + d.creancier : "")]);
    });
    return out;
  }
  function listeEnquetes(api){
    return api.enquetes().map(function(a){ return [a.id, (a.type ? a.type + " \u00b7 " : "") + a.titre]; });
  }
  function libDe(list, val){
    for (var i=0;i<list.length;i++) if (String(list[i][0])===String(val)) return list[i][1];
    return "";
  }

  /* ===================== CORPS ===================== */
  function champContexte(){ return ui.fld(T.L_CONTEXTE, ui.ta("contexte", T.PH_CONTEXTE)); }

  function corpsPassage(item){
    var prix = typeof item.p==="number" ? item.p : CFG.PRIX_PASSAGE;
    return ui.puces("Ce que le passage peut ouvrir", item.bullets)
      + ui.section("Ta demande",
          ui.fld(T.L_LIEU, ui.inp("lieu_vise", T.PH_LIEU))
        + ui.duo(ui.fld(T.L_VERROU_ACC, ui.ta("verrou_acces", T.PH_VERROU_ACC)),
                 ui.fld(T.L_BUT, ui.ta("but_passage", T.PH_BUT)))
        + champContexte()
        + ui.aide(T.AIDE_ACCUEIL) + ui.aide(item.helper))
      + ui.section("Paiement",
          ui.rangee(
            ui.fld(T.L_PAIEMENT, ui.sel("paiement", [["comptant","Comptant — " + money(prix)], PAIEMENTS[1]], null, { bascule:"paiement" })),
            ui.zone("paiement:service", ui.fld(T.L_CONCOURS, ui.inp("concours", T.PH_CONCOURS)))
          )
        + ui.zone("paiement:service", ui.aide(T.AIDE_SERVICE)))
      + ui.envoi();
  }

  function corpsDisparition(item, api){
    var dettes = listeDettes(api), enqs = listeEnquetes(api);
    var pjs = api.pseudos().map(function(p){ return [p,p]; });
    return ui.section("Organiser le départ",
        ui.rangee(
          ui.fld(T.L_DUREE, ui.sel("duree", DUREES)),
          ui.fld(T.L_DESTIN, ui.sel("destination", DESTINS)),
          ui.fld(T.L_PRIME_DISP, ui.inp("prime", T.PH_PRIME))
        )
      + ui.rangee(
          ui.fld(T.L_MOTIF, ui.sel("motif", MOTIFS, null, { bascule:"motif" })),
          ui.zone("motif:dette", ui.fld(T.L_DETTE, dettes.length ? ui.sel("dette_key", dettes, "— Choisir —") : ui.aide(T.SANS_DETTE)))
          + ui.zone("motif:enquete", ui.fld(T.L_ENQUETE, enqs.length ? ui.sel("enquete_id", enqs, "— Choisir —") : ui.aide(T.SANS_ENQUETE)))
        )
      + ui.rangee(
          ui.fld(T.L_RESTENT, ui.sel("restent", pjs, "— Choisir un personnage —")),
          ui.fld(T.L_RESTENT_PNJ, ui.inp("restent_pnj", T.PH_RESTENT_PNJ))
        )
      + champContexte()
      + ui.aide(T.AIDE_DISP) + ui.aide(item.helper))
      + ui.envoi();
  }

  function corpsOperation(item){
    return ui.section("Ouvrir une opération",
        ui.fld(T.L_TITRE, ui.inp("titre", T.PH_TITRE))
      + ui.rangee(
          ui.fld(T.L_VERROU, ui.sel("verrou", VERROUS)),
          ui.fld(T.L_PRIME_OP, ui.inp("prime", T.PH_PRIME))
        )
      + ui.fld(T.L_PARTIES, ui.ta("parties", T.PH_PARTIES))
      + ui.duo(ui.fld(T.L_OBJECTIF, ui.ta("objectif", T.PH_OBJECTIF)),
               ui.fld(T.L_CONTRAINTES, ui.ta("contraintes", T.PH_CONTRAINTES)))
      + champContexte()
      + ui.rangee(
          ui.fld(T.L_MANDTYPE, ui.sel("mandtype", MANDS)),
          ui.fld(T.L_MAND, ui.inp("mand", T.PH_MAND))
        )
      + ui.aide(T.AIDE_OP) + ui.aide(item.helper))
      + ui.envoi();
  }

  function body(item, api){
    if (item.flow==="prix")        return corpsPassage(item);
    if (item.flow==="disparition") return corpsDisparition(item, api);
    if (item.flow==="operation")   return corpsOperation(item);
    return "";
  }

  /* ===================== RÈGLES ===================== */
  function service(c){ return c.paiement==="service"; }

  var regles = {
    flot_passage: {
      resoudre: function(c, item){
        if (service(c)) return { act:"dette", detteType:"service" };
        return { act:"comptant", montant: typeof item.p==="number" ? item.p : CFG.PRIX_PASSAGE };
      },
      requis: [
        ["lieu_vise",    T.ERR_LIEU],
        ["verrou_acces", T.ERR_VERROU],
        ["but_passage",  T.ERR_BUT],
        ["concours",     T.ERR_CONCOURS, service]
      ],
      msg: function(c){ return service(c) ? T.OK_SERVICE : T.OK_PASSAGE; }
    },
    flot_disparition: {
      /* les libellés sont figés dans la demande : le tableau du hangar les
         affiche tels quels, sans relire les listes */
      resoudre: function(c, item, api){
        return { act:"comptant", montant: ui.montant(c.prime), champs:{
          prime: ui.montant(c.prime),
          duree_libelle: libDe(DUREES, c.duree),
          destination:   libDe(DESTINS, c.destination),
          motif_libelle: libDe(MOTIFS, c.motif),
          dette_libelle: c.dette_key ? libDe(listeDettes(api), c.dette_key) : "",
          enquete_titre: c.enquete_id ? libDe(listeEnquetes(api), c.enquete_id) : ""
        } };
      },
      requis: [
        ["restent",    T.ERR_RESTE],
        ["dette_key",  T.ERR_DETTE,   function(c){ return c.motif==="dette"; }],
        ["enquete_id", T.ERR_ENQUETE, function(c){ return c.motif==="enquete"; }]
      ],
      minima: [ ["prime", CFG.MIN_DISP, T.ERR_PRIME(CFG.MIN_DISP)] ],
      msg: T.OK_DISP,
      confirm: T.CONF_14J
    },
    flot_operation: {
      resoudre: function(c){
        return { act:"comptant", montant: ui.montant(c.prime), champs:{
          prime: ui.montant(c.prime),
          verrou_libelle:   libDe(VERROUS, c.verrou),
          mandtype_libelle: libDe(MANDS, c.mandtype)
        } };
      },
      requis: [
        ["titre",    T.ERR_TITRE],
        ["parties",  T.ERR_PARTIES],
        ["objectif", T.ERR_OBJ]
      ],
      minima: [ ["prime", CFG.MIN_OP, T.ERR_PRIME(CFG.MIN_OP)] ],
      msg: T.OK_OP,
      confirm: T.CONF_14J
    }
  };

  /* métier : un recouvrement de la Main interdit le trajet ordinaire */
  function controle(item){
    if (item.flow==="prix" && Q.gele() > 0) return T.GEL;
    return null;
  }

  /* ===================== DÉCLARATION ===================== */
  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"flot", bohl:"flottille", ordre:6, l:"La Flottille",
    ic:"fi fi-tr-anchor", c:"var(--gr5-color)",
    hero:{ logo:"fi fi-tr-anchor", desc:T.HERO },
    data: DATA, regles: regles, body: body, controle: controle
  });
})();
