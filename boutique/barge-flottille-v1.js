/*
 * barge-flottille.js — Bande « La Flottille » (marché noir) · TDL
 * Encore sans services : apparaît dans la grille avec son hero et « bientôt ».
 * À compléter plus tard (data + body). À charger avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) return;
  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"flot", bohl:"flottille", ordre:6, l:"La Flottille", ic:"fi fi-tr-anchor", c:"var(--gr5-color)",
    hero:{ logo:"fi fi-tr-anchor", desc:"Bientôt dévoilée." },
    data: {}
  });
})();
