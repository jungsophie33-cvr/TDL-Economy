/*
 * barge-braconneurs.js — Bande « Les Braconneurs » (marché noir) · TDL · v2
 *
 * Mécanique : PRIX FIXE, payé comptant, ni dette ni négociation. La somme est
 *   retenue à l'envoi, acquise à la validation staff, rendue au refus. Les
 *   Braconneurs n'ont pas de cagnotte.
 *
 * [MAJ v2] Tarif PROVISOIRE de 300 $ par service, en attendant la grille
 *   définitive. Le staff peut le modifier fiche par fiche (champ « Prix fixe »)
 *   sans toucher au code. Si un prix est vidé, la fiche repasse en simple
 *   demande au staff.
 *
 * À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-braconneurs] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui;

  var PRIX_PROVISOIRE = 300;   /* [MAJ] grille définitive à venir */

  var T = {
    HERO:        "Pisteurs, saboteurs et hommes de terrain, ils opèrent là où personne d\u2019autre ne s\u2019aventure.",
    L_CONTEXTE:  "Contexte de ta demande *",
    PH_CONTEXTE: "Le contexte narratif de ta commande\u2026",
    L_CIBLE:     "Cible ou objet concerné",
    PH_CIBLE:    "Nom, lieu, objet\u2026",
    L_PJ:        "Personnage joueur concerné *",
    ERR_PJ:      "Ce service exige un personnage joueur : choisis-le.",
    OK:          "Commande passée aux Braconneurs."
  };

  var DATA = {
    sabo:{ flow:"prix", p:PRIX_PROVISOIRE, tags:"évent ⟡ intrigue", n:"Saboter une zone naturelle",
      desc:"Sans violence : pièges retirés, embarcadère rendu inutilisable, canal encombré, balisage modifié." },
    piste:{ flow:"prix", p:PRIX_PROVISOIRE, n:"Retrouver une piste",
      desc:"Quelqu\u2019un a disparu dans le bayou, s\u2019est enfui à travers champs et marais ? Les Braconneurs remontent la piste : direction de fuite, objet abandonné, indices de blessures." },
    fausse:{ flow:"prix", p:PRIX_PROVISOIRE, tags:"enquête", n:"Créer une fausse piste",
      desc:"Modifie une enquête en cours, même dans le passé : douilles déplacées, traces de pneus, vêtements abandonnés, empreintes mélangées, piste interrompue." },
    manteau:{ flow:"prix", p:PRIX_PROVISOIRE, tags:"évent ⟡ intrigue", n:"Commande sous le manteau",
      desc:"Les Braconneurs acceptent une commande particulière et prêtent main-forte sur le terrain du bayou." },
    temoins:{ flow:"prix", p:PRIX_PROVISOIRE, tags:"intrigue Rougarou", pj:true, n:"Témoins de la nuit",
      desc:"Pendant le solstice, un Braconneur affirme avoir observé quelque chose dans le bayou. Le staff fournit un fait inédit lié à la nuit : piste capitale ou détail insignifiant.",
      note:"Peut déclencher un évent de bande." }
  };

  function body(item, api){
    var pjs = api.pseudos().map(function(p){ return [p,p]; });
    return (item.tags ? '<div class="qb-dtag">'+ui.esc(item.tags)+'</div>' : "")
      + ui.aide(item.note)
      + ui.section("Passer commande",
          ui.fld(T.L_CONTEXTE, ui.ta("contexte", T.PH_CONTEXTE))
        + ui.rangee(item.pj
            ? ui.fld(T.L_PJ, ui.sel("cible_pj", pjs, "— Choisir un personnage —"))
            : ui.fld(T.L_CIBLE, ui.inp("cible", T.PH_CIBLE))))
      + ui.envoi();
  }

  var regles = {
    prix: {
      resoudre: function(c, item){
        return typeof item.p==="number" && item.p > 0
          ? { act:"comptant", montant:item.p }
          : { act:"demande", demandeType:"braconneurs" };
      },
      requis: [ ["cible_pj", T.ERR_PJ, function(c, a, item){ return !!item.pj; }] ],
      msg: T.OK
    }
  };

  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"braco", bohl:"braconneurs", ordre:3, l:"Les Braconneurs",
    ic:"fi fi-tr-paw", c:"var(--gr3-color)",
    hero:{ logo:"fi fi-tr-paw", desc:T.HERO },
    data: DATA, regles: regles, body: body
  });
})();
