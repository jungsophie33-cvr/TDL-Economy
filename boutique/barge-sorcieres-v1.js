/*
 * barge-sorcieres.js — Bande « Les Sorcières du Baron » (marché noir) · TDL
 * Mécanique : OFFRANDE. Aucun dollar : l'acheteur soumet une requête et une
 * offrande (secret, objet, promesse, service). Transmis au staff, sans débit.
 * À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-sorcieres] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, esc = ui.esc;

  var DATA = {
    rever:{flow:"offrande",n:"Rêver sous l\u2019œil du Guédé",desc:"Les Sorcières vous font traverser une nuit de sommeil rituel. Au réveil, quelques-uns disent avoir reçu une réponse. D\u2019autres n\u2019en reviennent pas indemnes."},
    prixlwas:{flow:"offrande",n:"Le prix des Lwas",desc:"Demandez ce dont vous avez vraiment besoin : protéger un proche, jeter le mauvais œil, échapper au fisc, renouer avec un ex. Les Lwas répondront — et demandent toujours quelque chose en échange."},
    secret:{flow:"offrande",n:"Confier un secret aux Lwas",desc:"Vous écrivez un secret avant de le brûler en l\u2019honneur des Lwas. Les Sorcières en deviennent dépositaires. Ce qu\u2019elles en feront, demain ou dans trois mois, ne tient qu\u2019à elles."},
    empreinte:{flow:"offrande",n:"L\u2019empreinte des âmes",desc:"Apportez un objet hérité qui a compté pour quelqu\u2019un. Les Sorcières tenteront d\u2019y décrypter les émotions, blessures ou souvenirs qu\u2019il porte encore. Une piste pour se connaître à travers les âmes de nos aînés."},
    requete:{flow:"offrande",n:"Requête aux Sorcières",desc:"Les Sorcières n\u2019accordent pas leurs services à la légère. Expliquez ce que recherche votre personnage, ce qu\u2019il est prêt à offrir et pourquoi il s\u2019en remet aux Sorcières de Lost Bayou.",examples:["Obtenir une entrevue avec le Baron","Être conduit jusqu\u2019à Lost Bayou","Mettre une personne à l\u2019abri à Lost Bayou","Une préparation ou un remède exceptionnel","Faire examiner un objet, une personne ou un lieu maudit","Interpréter un phénomène étrange ou inexpliqué"]}
  };

  function body(item){
    var b = "";
    if (item.examples) b += '<div class="qb-sec">'+ui.lab("Exemples de demandes")+'<ul class="qb-bull">'+item.examples.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+'</ul></div>';
    b += '<div class="qb-rule"></div><div class="qb-sec">'+ui.lab("Formuler votre requête")
      + ui.fld("Votre requête *", ui.ta("requete","Ce que recherche votre personnage…"))
      + ui.fld("Votre offrande *", ui.ta("offrande","Un secret, du matériel, une promesse, un futur service…"))
      + '</div>' + ui.envoi("Soumettre aux Sorcières","offrande");
    return b;
  }

  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"sorc", bohl:"sorcieres", ordre:5, l:"Les Sorcières du Baron", ic:"fi fi-tr-paw", c:"var(--gr4-color)",
    hero:{ logo:"fi fi-tr-paw", desc:"Les Sorcières du Baron ne connaissent pas les dollars. Elles écoutent les Lwas et pèsent les offrandes." },
    data: DATA, body: body
  });
})();
