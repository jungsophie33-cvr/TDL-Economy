/*
 * barge-faiseuses.js — Bande « Les Faiseuses d'Anges » (marché noir) · TDL · v3
 *
 * DEUX MÉCANIQUES, AUCUN DOLLAR
 *   FAVEUR     — demande gratuite au réseau clandestin de soins. Validée par le
 *                staff, elle devient une TÂCHE (taches_faiseuses) soumise au
 *                vote des Faiseuses.
 *   DON_RESEAU — un accès offert au réseau. Validé, il inscrit un lien
 *                reseau_faiseuses au bottin (membres/{pseudo}/liens).
 *
 * [MAJ v3] Champs obligatoires enfin contrôlés (déclarés dans regles), un seul
 *   bouton, tutoiement.
 *
 * À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-faiseuses] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui;

  var DISPO = [["disponible","Disponible : on peut compter dessus"],
               ["ponctuel","Ponctuel : de temps en temps"],
               ["indisponible","Pas pour l\u2019instant : en réserve"]];

  /* ===================== TEXTES ===================== */
  var T = {
    HERO:          "Sages-femmes, infirmières, médecins. Elles ne demandent pas d\u2019argent : elles agissent en échange du silence.",
    L_CONTEXTE:    "Contexte de ta demande *",
    PH_CONTEXTE_F: "Pourquoi ton personnage s\u2019adresse à elles, et comment il a eu leur nom\u2026",
    PH_CONTEXTE_D: "Pourquoi ton personnage prend ce risque, et ce qu\u2019il sait d\u2019elles\u2026",
    CADRE:         "La demande doit relever de leur métier : un réseau clandestin de soins, de gens du milieu médical et de ressources médicales.",
    L_DEMANDE:     "Ce que demande ton personnage *",
    PH_DEMANDE:    "Que te faut-il, pour qui, et pour quand\u2026",
    L_DON:         "Don en nature (facultatif)",
    PH_DON:        "Que vas-tu offrir en remerciement, sans rien exiger en retour\u2026",
    L_RP:          "Cette faveur a vocation à devenir une mission jouée en RP",
    AIDE_RP:       "Décochée, la faveur se règle en coulisses. Cochée, une Faiseuse la prend en charge et un sujet sera ouvert.",
    SUITE_FAVEUR:  "Ta demande est relue par le staff, puis soumise aux Faiseuses, qui acceptent, refusent ou reportent.",
    L_RESSOURCE:   "Ressource ou accès proposé *",
    PH_RESSOURCE:  "Une pharmacie, un entrepôt, une camionnette, un nom\u2026",
    L_APPORT:      "Ce que ça leur apporte *",
    PH_APPORT:     "Ce qu\u2019elles pourront en faire, concrètement\u2026",
    L_ACTIVITE:    "Activité de ton personnage",
    PH_ACTIVITE:   "Pharmacienne, chauffeur, aide-soignant\u2026",
    L_DISPO:       "Disponibilité",
    SUITE_DON:     "Si le don est retenu, ton personnage entre dans leur réseau de ressources et figure à leur bottin. Elles pourront faire appel à lui.",

    ERR_DEMANDE:   "Dis ce que ton personnage demande aux Faiseuses.",
    ERR_RESSOURCE: "Nomme la ressource ou l\u2019accès que ton personnage ouvre.",
    ERR_APPORT:    "Dis ce que les Faiseuses pourront en faire.",

    OK_FAVEUR:     "Demande transmise. Le staff la relit, puis les Faiseuses tranchent entre elles. Tu ne paies rien, sauf le silence.",
    OK_DON:        "Don proposé aux Faiseuses. S\u2019il est retenu, ton personnage figurera à leur bottin."
  };

  /* ===================== CATALOGUE ===================== */
  var DATA = {
    fa_faveur:{ flow:"faveur", ic:"comments-question", n:"Demander une faveur",
      desc:"Inutile de payer les Faiseuses d\u2019Anges : elles exigent un silence absolu. Dis ce dont ton personnage a besoin ; elles regarderont si leur réseau peut y répondre.",
      bullets:["Obtenir un renseignement issu de leur réseau","Accéder ponctuellement à une ressource médicale",
               "Solliciter une personne de leur réseau","Obtenir une information sur une situation médicale ou sanitaire",
               "Faire jouer une relation pour obtenir ce qui est hors d\u2019atteinte"],
      helper:"Le silence est la seule contrepartie exigée. Un don en nature sera apprécié, mais n\u2019assure pas une réponse favorable." },
    fa_don:{ flow:"don_reseau", ic:"key", reseau_auto:"faiseuses", n:"Faire un don",
      desc:"Les Faiseuses vivent d\u2019accès, pas d\u2019argent. Ton personnage leur ouvre une porte dont elles ont besoin, et devient une ressource de leur réseau.",
      bullets:["Un accès privilégié à une pharmacie","Un contact dans un établissement de santé",
               "L\u2019utilisation temporaire d\u2019un équipement","L\u2019accès à une source d\u2019approvisionnement",
               "Un accès ponctuel à un véhicule ou à un lieu utile"],
      helper:"Un don aux Faiseuses n\u2019est jamais de l\u2019argent, mais une ressource qu\u2019elles peuvent exploiter." }
  };

  /* ===================== CORPS ===================== */
  function corpsFaveur(item){
    return ui.puces("Ce que leur réseau peut faire", item.bullets) + ui.aide(T.CADRE)
      + ui.section("Ta demande",
          ui.fld(T.L_DEMANDE, ui.ta("demande", T.PH_DEMANDE))
        + ui.duo(ui.fld(T.L_CONTEXTE, ui.ta("contexte", T.PH_CONTEXTE_F)),
                 ui.fld(T.L_DON, ui.ta("don", T.PH_DON)))
        + ui.caseACocher("rp_mission", T.L_RP) + ui.aide(T.AIDE_RP)
        + ui.aide(item.helper) + ui.aide(T.SUITE_FAVEUR))
      + ui.envoi();
  }

  function corpsDon(item){
    return ui.puces("Ce qui leur est utile", item.bullets)
      + ui.section("Ton accès",
          ui.duo(ui.fld(T.L_RESSOURCE, ui.ta("ressource", T.PH_RESSOURCE)),
                 ui.fld(T.L_APPORT, ui.ta("apport", T.PH_APPORT)))
        + ui.rangee(ui.fld(T.L_ACTIVITE, ui.inp("activite", T.PH_ACTIVITE)),
                    ui.fld(T.L_DISPO, ui.sel("dispo", DISPO)))
        + ui.fld(T.L_CONTEXTE, ui.ta("contexte", T.PH_CONTEXTE_D))
        + ui.aide(item.helper) + ui.aide(T.SUITE_DON))
      + ui.envoi();
  }

  function body(item){ return item.flow==="don_reseau" ? corpsDon(item) : corpsFaveur(item); }

  /* ===================== RÈGLES ===================== */
  var regles = {
    faveur: {
      resoudre: function(){ return { act:"demande", demandeType:"faveur" }; },
      requis: [ ["demande", T.ERR_DEMANDE] ],
      msg: T.OK_FAVEUR
    },
    don_reseau: {
      resoudre: function(){ return { act:"demande", demandeType:"don_reseau" }; },
      requis: [ ["ressource", T.ERR_RESSOURCE], ["apport", T.ERR_APPORT] ],
      msg: T.OK_DON
    }
  };

  /* ===================== DÉCLARATION ===================== */
  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"faiseuses", bohl:"faiseuses", ordre:4, l:"Les Faiseuses d\u2019Anges",
    ic:"fi fi-tr-hand-holding-heart", c:"var(--gr1-color)",
    hero:{ logo:"fi fi-tr-hand-holding-heart", desc:T.HERO },
    heroPrice: function(item){ return { l:"Modalité", v: item.flow==="don_reseau" ? "Don en nature" : "Sans tarif ⟡ silence" }; },
    data: DATA, regles: regles, body: body
  });
})();
