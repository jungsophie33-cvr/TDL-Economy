/*
 * fiche-progress.js — Barre de progression du formulaire de validation · TDL
 *
 * CE QUE CE FICHIER FAIT : calcule un pourcentage de complétion = champs requis
 * REMPLIS / champs requis VISIBLES, et met à jour la barre. Le dénominateur est
 * dynamique : un champ conditionnel masqué (offsetParent null) n'est pas compté ;
 * dès qu'on coche « Oui » (bande, multicompte, pré-lien) ou qu'on choisit une
 * bande/un secteur, ses champs deviennent visibles et rejoignent le décompte.
 * CE QU'IL NE FAIT PAS : validation (c'est verifierChamps qui bloque l'envoi).
 *
 * Autonome : aucun champ à taguer. La liste des IDs requis est ici ; on ne
 * garde que ceux réellement visibles à l'instant T. À charger APRÈS fiche-utils,
 * n'importe où avant/après les blocs — il n'expose que FI.progressInit / FI.progressMaj.
 *
 * Dépend de : window.FI
 */

(function (FI) {
  "use strict";

  // Champs requis de la fiche (hors radios, qui ont toujours une valeur par défaut).
  // Les champs conditionnels y figurent : ils ne comptent que lorsqu'ils sont visibles.
  var REQUIS = [
    // — infos générales —
    "fi-lien-fiche", "fi-faceclaim", "fi-groupe",
    "fi-lien-prelien",        // si pré-lien = oui
    "fi-premier-compte",      // si multicompte = oui
    // — hors-la-loi (si « Oui ») : bande + champs de la bande visible —
    "fi-hll-bande",
    "fi-hll-fai-cat", "fi-hll-fai-voc",
    "fi-hll-bra-spec", "fi-hll-bra-role",
    "fi-hll-mar-cellule", "fi-hll-mar-role",
    "fi-hll-flo-navire", "fi-hll-flo-role",
    "fi-hll-main-type", "fi-hll-main-doigt", "fi-hll-main-role",
    "fi-hll-sor-role",
    // — métier (masqué si « sans emploi ») —
    "fi-met-zone", "fi-met-entreprise", "fi-met-poste",
    // — habitation —
    "fi-hab-quartier", "fi-hab-type", "fi-hab-numero",
  ];

  function visible(el) { return !!(el && el.offsetParent !== null); }
  function rempli(el) {
    if (!el) return false;
    return !!String(el.value == null ? "" : el.value).trim();
  }

  function calcul(overlay) {
    var total = 0, ok = 0;
    for (var i = 0; i < REQUIS.length; i++) {
      var el = overlay.querySelector("#" + REQUIS[i]);
      if (!visible(el)) continue;      // champ conditionnel masqué → hors décompte
      total++;
      if (rempli(el)) ok++;
    }
    var pct = total ? Math.round((ok / total) * 100) : 0;
    var bar = overlay.querySelector("#fi-progress-bar");
    var lbl = overlay.querySelector("#fi-progress-pct");
    if (bar) bar.style.width = pct + "%";
    if (lbl) lbl.textContent = pct + " %";
  }

  FI.progressInit = function (overlay) {
    var champs = overlay.querySelector("#fi-champs");
    if (!champs) return;
    // input : saisie texte ; change : selects, radios, cases — après que les
    // toggles conditionnels aient appliqué leur visibilité (ils écoutent la cible directe).
    champs.addEventListener("input", function () { calcul(overlay); });
    champs.addEventListener("change", function () { calcul(overlay); });
    FI.progressMaj = function () { calcul(overlay); };
    calcul(overlay);
  };

})(window.FI);
