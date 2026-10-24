/*
 * barge-maringouins.js — Bande « Les Maringouins » (marché noir) · TDL · v5
 *
 * DEUX SERVICES, UNE MÊME MONNAIE : LA PRIME
 *   COUP DE MAIN — service ponctuel, de faible ampleur, sans mission au tableau.
 *                  La prime (100 $ min.) est retenue à l'envoi ; elle est
 *                  acquise à la validation staff, rendue au refus. Les
 *                  Maringouins n'ont pas de cagnotte : la somme quitte la
 *                  circulation.
 *   MISSION      — appel aux cellules. La prime (200 $ min.) est retenue à
 *                  l'ouverture et la mission s'écrit DIRECTEMENT dans
 *                  missions/{id}, sans passer par le staff. Le tableau des
 *                  missions gère la suite : chef, renégociation, refus
 *                  automatique et recrédit à 7 jours, versement.
 *
 * [MAJ v5] LA MISSION REPASSE PAR LE SOCLE.
 *   Elle réimplémentait le pseudo, le gel, le débit et le recrédit, et ne
 *   contrôlait pas l'objectif. Elle passe désormais par le pipeline commun
 *   (contrôles, confirmation, verrou anti-double-envoi) et ne garde en propre
 *   que son écriture, sous forme d'acte « mission ».
 *   GARDE-FOUS CONSERVÉS SUR L'ÉCRITURE : clé locale, sentinelle missions_rev
 *   bumpée dans le même PATCH (TDLBase.ecrireEntree), naissance en schéma 2,
 *   genre « mission » explicite, participants et valides omis (nœuds à clés en
 *   schéma 2, une branche vide ne s'écrit pas), et {sansFile:true} — écriture
 *   COMPENSÉE : si elle rate, la prime est rendue ici même ; un réessai
 *   différé recréerait la mission après le recrédit.
 *
 * À CHARGER avant barge-core.js, et après eco-core + tdl-base.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-maringouins] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, money = Q.money;

  /* ===================== CONFIG ===================== */
  var CFG = {
    NODE_MISSIONS:  "missions",
    SCHEMA_MISSION: 2,          /* doit suivre rep-mis-core */
    MIN_COUP:       100,
    MIN_MISSION:    200,
    NOTIF_MISSION:  110
  };

  /* clés = F.TYPES de rep-mis-core */
  var TYPES = [["recuperation","Récupération"],["contrebande","Contrebande"],["transport","Transport"],["sabotage","Sabotage"],["intimidation","Intimidation"]];
  var MANDS = [["joueur","En mon nom"],["entreprise","Une entreprise"],["famille","Une famille"],["pnj","Un PNJ"],["anonyme","Anonyme"]];

  /* ===================== TEXTES ===================== */
  var T = {
    HERO:          "Un réseau de cellules discrètes, soudées par l\u2019entraide. Leurs services ne sont pas à vendre : on sollicite leur attention.",
    L_CONTEXTE:    "Contexte de ta demande *",
    PH_CONTEXTE:   "Ce qui amène ton personnage à solliciter les Maringouins\u2026",
    L_AIDE:        "Le coup de main attendu *",
    PH_AIDE:       "Ce que tu attends d\u2019eux, où, et quand\u2026",
    L_PRIME_COUP:  "Prime * (100 $ min.)",
    L_PRIME_MIS:   "Prime * (200 $ min.)",
    PH_PRIME:      "$",
    AIDE_COUP:     "La prime est retenue à l\u2019envoi. Acquise aux Maringouins si le staff valide, rendue s\u2019il refuse.",
    L_TITRE:       "Titre de la mission *",
    PH_TITRE:      "Ex. : Récupérer une cargaison à Cocodrie",
    L_TYPE:        "Type de mission *",
    L_MANDTYPE:    "Commanditaire affiché",
    L_MAND:        "Nom affiché (sinon ton pseudo)",
    PH_MAND:       "Entreprise, famille, PNJ\u2026",
    L_OBJECTIF:    "Objectif *",
    PH_OBJECTIF:   "Ce que la cellule doit accomplir\u2026",
    L_CONTRAINTES: "Contraintes (une par ligne)",
    PH_CONTRAINTES:"Délai, discrétion, cible à ne pas toucher\u2026",
    AIDE_MISSION:  "La mission s\u2019affiche aussitôt au tableau des Maringouins. Le premier qui s\u2019en empare devient chef, et peut renégocier la prime avec toi.",

    ERR_AIDE:      "Décris le coup de main attendu.",
    ERR_PRIME:     function (m) { return "La prime commence à " + money(m) + "."; },
    ERR_TITRE:     "Donne un titre à la mission.",
    ERR_OBJ:       "Décris l\u2019objectif de la mission.",
    ERR_SOCLE:     "Le socle des tableaux est absent : mission non ouverte, rien n\u2019a été retenu.",
    ERR_ECRITURE:  "L\u2019ouverture de la mission a échoué : la prime t\u2019a été rendue.",
    ERR_FONDS:     "Ton solde ne couvre pas cette prime.",

    OK_COUP:       "Demande de coup de main transmise.",
    OK_MISSION:    function (m) { return "Mission ouverte au tableau des Maringouins. Ta prime de " + money(m) + " est retenue jusqu\u2019à l\u2019issue."; },
    CONF_MISSION:  "Sans cellule pour s\u2019en saisir sous sept jours, la prime te sera rendue."
  };

  /* ===================== CATALOGUE ===================== */
  var DATA = {
    coupmain:{ flow:"don", n:"Coup de main discret",
      desc:"« On te file un coup de main parce que t\u2019es des nôtres. » Ponctuel, clandestin, de faible ampleur.",
      bullets:["Protection ponctuelle d\u2019un commerce, d\u2019un atelier, d\u2019un embarcadère","Convoyage discret de marchandises non déclarées",
               "Une diversion de leur cru","Un hébergement clandestin d\u2019une nuit","La surveillance d\u2019un lieu"],
      helper:"La nature exacte de l\u2019aide se précise avec le staff." },
    mission:{ flow:"mission", n:"Mission de cellule",
      desc:"Appel à volontaires transmis aux cellules. Tu fixes l\u2019objectif et la prime ; à l\u2019issue, la prime revient à ceux qui ont mené la mission.",
      helper:"La prime est retenue à l\u2019ouverture. Sans preneur sous sept jours, la mission est refusée et la prime te revient." }
  };

  /* ===================== CORPS ===================== */
  function champContexte(){ return ui.fld(T.L_CONTEXTE, ui.ta("contexte", T.PH_CONTEXTE)); }

  function corpsCoup(item){
    return ui.puces("Ce que ça peut inclure", item.bullets)
      + ui.section("Solliciter les Maringouins",
          ui.duo(ui.fld(T.L_AIDE, ui.ta("aide", T.PH_AIDE)), champContexte())
        + ui.rangee(ui.fld(T.L_PRIME_COUP, ui.inp("prime", T.PH_PRIME)))
        + ui.aide(T.AIDE_COUP) + ui.aide(item.helper))
      + ui.envoi();
  }

  function corpsMission(item){
    return ui.section("Ouvrir une mission",
        ui.fld(T.L_TITRE, ui.inp("titre", T.PH_TITRE))
      + ui.rangee(
          ui.fld(T.L_TYPE, ui.sel("type_mission", TYPES)),
          ui.fld(T.L_PRIME_MIS, ui.inp("prime", T.PH_PRIME))
        )
      + ui.rangee(
          ui.fld(T.L_MANDTYPE, ui.sel("mandtype", MANDS)),
          ui.fld(T.L_MAND, ui.inp("mand", T.PH_MAND))
        )
      + ui.fld(T.L_OBJECTIF, ui.ta("objectif", T.PH_OBJECTIF))
      + ui.duo(ui.fld(T.L_CONTRAINTES, ui.ta("contraintes", T.PH_CONTRAINTES)), champContexte())
      + ui.aide(T.AIDE_MISSION) + ui.aide(item.helper))
      + ui.envoi();
  }

  function body(item){ return item.flow==="mission" ? corpsMission(item) : corpsCoup(item); }

  /* ===================== RÈGLES ===================== */
  var regles = {
    don: {
      resoudre: function(c){ return { act:"demande", demandeType:"don", montant: ui.montant(c.prime) }; },
      requis: [ ["aide", T.ERR_AIDE] ],
      minima: [ ["prime", CFG.MIN_COUP, T.ERR_PRIME(CFG.MIN_COUP)] ],
      msg: T.OK_COUP
    },
    mission: {
      resoudre: function(c){ return { act:"mission", montant: ui.montant(c.prime) }; },
      requis: [ ["titre", T.ERR_TITRE], ["objectif", T.ERR_OBJ] ],
      minima: [ ["prime", CFG.MIN_MISSION, T.ERR_PRIME(CFG.MIN_MISSION)] ],
      confirm: T.CONF_MISSION
    }
  };

  /* ===================== ACTE « MISSION » ===================== */
  /* Le socle a contrôlé, fait confirmer et verrouillé. Reste à retenir la
     prime et à écrire l'entrée, en compensant si l'écriture échoue. */
  async function acteMission(base, c){
    var B = window.TDLBase;
    if (!B || !B.ecrireEntree || !B.nouvelleCle) { alert(T.ERR_SOCLE); return { ok:false }; }
    var p = Q.pseudo(), prime = base.montant|0;
    try { await Q.achat.retenir(prime); }
    catch(e){
      alert(e && e.message==="GELE" ? Q.TXT.FONDS_GELE(Q.gele()) : T.ERR_FONDS);
      return { ok:false, fonds:true };
    }
    var mandtype = c.mandtype || "joueur";
    var id = B.nouvelleCle(), now = new Date().toISOString();
    var mission = {
      schema: CFG.SCHEMA_MISSION, genre:"mission",
      titre: String(c.titre||"").trim(), type: c.type_mission || "recuperation",
      mandataire: String(c.mand||"").trim() || (mandtype==="anonyme" ? "Anonyme" : p),
      mandataireType: mandtype,
      payeur: p, prime: prime, primeInitiale: prime,
      objectif: String(c.objectif||"").trim(), contexte: String(c.contexte||"").trim(),
      contraintes: String(c.contraintes||"").split("\n").map(function(x){ return x.trim(); }).filter(Boolean),
      statut:"en_attente", chef:null, nego:null,
      topic:"", resume:"", consequences:"", demandeValidation:false,
      cree: now, rembourse:false, primeVersee:false
    };
    var ok = false;
    try { ok = await B.ecrireEntree(CFG.NODE_MISSIONS, id, mission, "ouverture de mission", { sansFile:true }); } catch(e){ ok = false; }
    if (!ok) {
      await Q.achat.rendre(prime).catch(function(){});
      alert(T.ERR_ECRITURE); return { ok:false };
    }
    try { if (window.EcoNotif) EcoNotif.bande("maringouins", CFG.NOTIF_MISSION, { titre:mission.titre, prime:prime }, "mis"+id); } catch(e){}
    return { ok:true, message: T.OK_MISSION(prime) };
  }

  /* ===================== DÉCLARATION ===================== */
  /* PAS de cagnotte : les Maringouins n'en ont pas. */
  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"maring", bohl:"maringouins", ordre:2, l:"Les Maringouins",
    ic:"fi fi-tr-mosquito", c:"var(--gr2-color)",
    hero:{ logo:"fi fi-tr-mosquito", desc:T.HERO },
    data: DATA, regles: regles, body: body,
    actes: { mission: acteMission }
  });
})();
