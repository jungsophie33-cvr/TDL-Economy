/*
 * barge-faiseuses.js — Bande « Les Faiseuses d'Anges » (marché noir) · TDL
 * Deux mécaniques, AUCUN dollar :
 *   FAVEUR     — demande gratuite au réseau clandestin de soins. Part en
 *                boutique_demandes (type "faveur"). À la validation staff, une
 *                TÂCHE est créée dans  taches_faiseuses/{id}  en statut en_vote :
 *                seules les Faiseuses (et le staff) la voient et votent.
 *   DON_RESEAU — don en nature / accès à une ressource. À la validation staff,
 *                un lien { type:"reseau_faiseuses", … } est inscrit dans
 *                membres/{pseudo}/liens et s'affiche au bottin.
 * Aucun débit, aucune cagnotte, aucune dette monétaire.
 * DÉPEND DE : window.Quais. À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-faiseuses] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, esc = ui.esc;

  /* ===================== TEXTES ===================== */
  var T = {
    HERO: "Sage-femmes, infirmières, médecins. Elles ne prennent pas d\u2019argent : elles prennent le silence. Ce qu\u2019on leur doit ne se rembourse jamais en dollars.",
    FAV_HELPER: "Les Faiseuses ne facturent rien. Elles travaillent contre le silence et le secret gardé \u2014 c\u2019est la seule contrepartie exigée. Un don en nature, en remerciement, reste possible mais n\u2019achète rien.",
    FAV_CADRE: "La demande doit relever de leur c\u0153ur de métier : un réseau clandestin de soins, de gens du milieu médical et de ressources médicales. Hors de ce cadre, elles ne répondront pas.",
    FAV_SUITE: "Votre demande est d\u2019abord relue par le staff, puis soumise aux Faiseuses elles-mêmes, qui décident collégialement d\u2019accepter, de refuser ou de reporter. Rien ne vous est garanti.",
    DON_HELPER: "Un don aux Faiseuses n\u2019est jamais de l\u2019argent : c\u2019est un accès. Une porte qu\u2019on laisse entrouverte, une clé qu\u2019on prête, un nom qu\u2019on souffle.",
    DON_SUITE: "Si le don est retenu, votre personnage entre dans le réseau de ressources des Faiseuses et apparaît à leur bottin. Elles pourront faire appel à lui \u2014 et ce sera à lui de répondre, ou pas.",
    DISPO: [["disponible","Disponible \u2014 on peut compter dessus régulièrement"],
            ["ponctuel","Ponctuel \u2014 une fois de temps en temps, selon les circonstances"],
            ["indisponible","Pas pour l\u2019instant \u2014 à garder en réserve"]]
  };

  /* ===================== CATALOGUE ===================== */
  var DATA = {
    fa_faveur:{
      flow:"faveur", ic:"comments-question", rpOnly:false,
      n:"Demander une faveur",
      desc:"Vous ne payez pas les Faiseuses : vous vous taisez. Formulez ce dont votre personnage a besoin \u2014 elles regarderont si leur réseau peut y répondre. Parfois oui. Parfois non. Parfois pas tout de suite.",
      bullets:[
        "Obtenir un renseignement issu de leur réseau",
        "Accéder ponctuellement à une ressource médicale",
        "Solliciter une personne de leur réseau",
        "Obtenir une information sur une situation médicale ou sanitaire",
        "Faire jouer une relation pour obtenir ce qui est normalement hors d\u2019atteinte"
      ],
      helper:T.FAV_HELPER
    },
    fa_don:{
      flow:"don_reseau", ic:"key", reseau_auto:"faiseuses",
      n:"Faire un don",
      desc:"Les Faiseuses ne vivent pas d\u2019argent mais d\u2019accès. Votre personnage leur ouvre temporairement une porte dont elles ont besoin \u2014 et devient, de fait, une ressource de leur réseau.",
      bullets:[
        "Un accès privilégié à une pharmacie",
        "Un contact dans un établissement de santé",
        "L\u2019utilisation temporaire d\u2019un équipement",
        "L\u2019accès à une source d\u2019approvisionnement",
        "Un accès ponctuel à un véhicule ou à un lieu utile à leur activité"
      ],
      helper:T.DON_HELPER
    }
  };

  /* ===================== RENDU ===================== */
    function vt(v){ return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]); }
  function bullets(titre, arr){
    arr = vt(arr); if (!arr.length) return "";
    return '<div class="qb-sec">'+ui.lab(titre)+'<ul class="qb-bull">'
      + arr.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("") + '</ul></div>';
  }
  function select(champ, opts){
    return '<select data-champ="'+champ+'">'
      + opts.map(function(o){ return '<option value="'+esc(o[0])+'">'+esc(o[1])+'</option>'; }).join("")
      + '</select>';
  }

  function corpsFaveur(item){
    return bullets("Ce que leur réseau peut faire", item.bullets)
      + '<div class="qb-helper" style="margin-top:6px">'+esc(T.FAV_CADRE)+'</div>'
      + '<div class="qb-rule"></div>'
      + '<div class="qb-sec">'+ui.lab("Formuler votre demande")
        + ui.fld("Ce que demande votre personnage *", ui.ta("demande","Soyez précis : ce qu\u2019il lui faut, pour qui, et pour quand\u2026"))
        + '<div class="qb-pcgrid">'
          + '<div>'+ui.fld("Contexte RP *", ui.ta("contexte","Pourquoi il s\u2019adresse à elles, et comment il a eu le nom\u2026"))+'</div>'
          + '<div>'+ui.fld("Don en nature proposé (optionnel)", ui.ta("don","Ce qu\u2019il offre en remerciement \u2014 sans rien exiger en retour\u2026"))+'</div>'
        + '</div>'
      + '</div>'
      + '<div class="qb-helper">'+esc(item.helper)+'</div>'
      + '<div class="qb-helper" style="margin-top:6px">'+esc(T.FAV_SUITE)+'</div>'
      + ui.envoi("Transmettre aux Faiseuses","faveur");
  }

  function corpsDon(item){
    return bullets("Ce qui leur est utile", item.bullets)
      + '<div class="qb-rule"></div>'
      + '<div class="qb-sec">'+ui.lab("Proposer votre accès")
        + '<div class="qb-pcgrid">'
          + '<div>'+ui.fld("Ressource ou accès proposé *", ui.ta("ressource","Une pharmacie, un entrepôt, une camionnette, un nom\u2026"))+'</div>'
          + '<div>'+ui.fld("Ce que ça leur apporte *", ui.ta("apport","Concrètement, ce qu\u2019elles pourront en faire\u2026"))+'</div>'
        + '</div>'
        + '<div class="qb-pcgrid">'
          + '<div>'+ui.fld("Activité de votre personnage", ui.inp("activite","Pharmacienne, chauffeur, aide-soignant\u2026"))+'</div>'
          + '<div>'+ui.fld("Disponibilité", select("dispo", T.DISPO))+'</div>'
        + '</div>'
        + ui.fld("Contexte RP", ui.ta("contexte","Pourquoi il prend ce risque, et ce qu\u2019il sait d\u2019elles\u2026"))
      + '</div>'
      + '<div class="qb-helper">'+esc(item.helper)+'</div>'
      + '<div class="qb-helper" style="margin-top:6px">'+esc(T.DON_SUITE)+'</div>'
      + ui.envoi("Proposer ce don aux Faiseuses","don_reseau");
  }

  function body(item){
    return item.flow==="don_reseau" ? corpsDon(item) : corpsFaveur(item);
  }

  /* le hero n'affiche jamais de prix pour cette bande */
  function heroPrice(item){
    return item.flow==="don_reseau"
      ? { l:"Modalité", v:"Don en nature \u22a1 aucun dollar" }
      : { l:"Modalité", v:"Sans tarif \u22a1 contre le silence" };
  }

  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"faiseuses", bohl:"faiseuses", ordre:4, l:"Les Faiseuses d\u2019Anges",
    ic:"fi fi-tr-hand-holding-heart", c:"var(--gr1-color)",
    hero:{ logo:"fi fi-tr-hand-holding-heart", desc:T.HERO },
    data: DATA, body: body, heroPrice: heroPrice
  });
})();
