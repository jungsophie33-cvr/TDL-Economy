/* THE DROWNED LANDS — MOLETTE HORIZONTALE DES BOTTINS · v1
   Windows : ni la molette ni le pad ne font défiler horizontalement une
   barre d'onglets — Mac s'en tire grâce au trackpad, la faute revient au
   système, pas au CSS (qui masque volontairement la scrollbar). Ce petit
   script traduit le défilement vertical de la molette en scrollLeft, mais
   UNIQUEMENT quand la barre peut bouger : aux deux extrémités, la page
   reprend la main normalement. Shift+molette reste natif (deltaX déjà
   horizontal). Un geste horizontal de trackpad n'est pas volé non plus.

   À charger sur les pages des bottins à onglets, après n'importe quel
   autre script — il s'attache aux barres existantes et rattrape celles
   que le template FA injecterait plus tard (sondage 30 s).
   Couvre : tdlh (habitations), bm (métiers), tdlb (voyou), tdlr (lieux),
   bfc (avatars). */
(function () {
"use strict";
var SELECTEUR = ".tdlh-zonebar, .bm-zonebar, .tdlb-zonebar, .tdlr-zonebar, .bfc-zonebar";
function brancher() {
  var bars = document.querySelectorAll(SELECTEUR);
  for (var i = 0; i < bars.length; i++) {
    var z = bars[i];
    if (z.getAttribute("data-tdl-molette")) continue;   /* déjà branchée */
    z.setAttribute("data-tdl-molette", "1");
    (function (el) {
      el.addEventListener("wheel", function (e) {
        if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;   /* geste déjà horizontal */
        if (el.scrollWidth <= el.clientWidth) return;           /* rien à faire défiler */
        var avant = el.scrollLeft;
        el.scrollLeft = avant + e.deltaY;
        if (el.scrollLeft !== avant) e.preventDefault();  /* la barre a bougé : on garde la molette */
      }, { passive: false });
    })(z);
  }
}
var n = 0, t = setInterval(function () { brancher(); if (++n > 60) clearInterval(t); }, 500);
if (document.readyState === "complete") brancher();
else window.addEventListener("load", brancher);
})();
