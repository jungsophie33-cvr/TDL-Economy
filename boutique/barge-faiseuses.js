/*
 * barge-faiseuses.js — Bande « Les Faiseuses d'Anges » (marché noir) · TDL
 * Encore sans services : la bande apparaît dans la grille avec son hero et un
 * message « bientôt ». À compléter plus tard (data + body). À charger avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) return;
  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"faiseuses", ordre:4, l:"Les Faiseuses d\u2019Anges", ic:"fi fi-tr-hand-holding-heart", c:"#e060c4",
    hero:{ logo:"fi fi-tr-hand-holding-heart", desc:"Bientôt dévoilées." },
    data: {}
  });
})();
