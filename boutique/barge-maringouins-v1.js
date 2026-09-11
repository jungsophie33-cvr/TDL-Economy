/*
 * barge-maringouins.js — Bande « Les Maringouins » (marché noir) · TDL
 * Deux mécaniques : DON (coup de main, on sollicite + on propose un don) et
 * MISSION (appel à volontaires → mission ouverte dans le Tableau des missions).
 * Aucun débit : la demande part au staff. À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-maringouins] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, esc = ui.esc;

  var DATA = {
    coupmain:{flow:"don",n:"Coup de main discret",desc:"« On te file un coup de main parce que t\u2019es des nôtres. » Ponctuel, clandestin, de faible ampleur.",bullets:["Protection ponctuelle d\u2019un commerce, atelier, embarcadère, distillerie…","Convoyage discret de marchandises non déclarées","Une diversion de leur cru","Un hébergement clandestin d\u2019une nuit","La surveillance d\u2019un lieu"],helper:"La nature exacte de l\u2019aide est à définir avec le staff."},
    mission:{flow:"mission",n:"Mission de cellule",desc:"Appel à volontaires. La demande est transmise à toutes les cellules Maringouins. Si l\u2019une accepte et qu\u2019un ou plusieurs joueurs s\u2019en emparent, une mission est ouverte ; la récompense est versée aux participants à l\u2019issue.",helper:"Si aucune cellule n\u2019est intéressée, la demande est annulée et les dollars ne sont pas débités. Les Maringouins peuvent venir négocier."}
  };

  function body(item){
    var b = "";
    if (item.bullets) b += '<div class="qb-sec">'+ui.lab("Ce que ça peut inclure")+'<ul class="qb-bull">'+item.bullets.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+'</ul></div>';
    b += '<div class="qb-rule"></div>';
    if (item.flow==="don") {
      b += '<div class="qb-sec">'+ui.lab("Solliciter les Maringouins")
        + '<div class="qb-pcgrid"><div>'+ui.fld("Nature de l\u2019aide souhaitée *", ui.ta("aide","Décrivez le coup de main attendu…"))+'</div>'
        + '<div>'+ui.fld("Montant du don", ui.inp("don","$"))+'</div></div>'
        + (item.helper?'<div class="qb-helper">'+esc(item.helper)+'</div>':"")
        + '</div>' + ui.envoi("Solliciter les Maringouins","don");
    } else {
      b += '<div class="qb-sec">'+ui.lab("Ouvrir une mission")
        + '<div class="qb-pcgrid"><div>'+ui.fld("Décrivez votre demande *", ui.ta("demande","La mission à confier aux cellules…"))+'</div>'
        + '<div>'+ui.fld("Prime offerte", ui.inp("prime","$ (ordre de grandeur libre)"))+'</div></div>'
        + '<div class="qb-helper">Une mission sera créée dans le Tableau des missions des Maringouins.</div>'
        + (item.helper?'<div class="qb-helper">'+esc(item.helper)+'</div>':"")
        + '</div>' + ui.envoi("Ouvrir la mission","mission");
    }
    return b;
  }

  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"maring", bohl:"maringouins", ordre:2, l:"Les Maringouins", ic:"fi fi-tr-mosquito", c:"var(--gr2-color)",
    hero:{ logo:"fi fi-tr-mosquito", desc:"Un réseau de cellules discrètes, soudées par l\u2019entraide. On ne les achète pas : on sollicite leur attention." },
    data: DATA, body: body
  });
})();
