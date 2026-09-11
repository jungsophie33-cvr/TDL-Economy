/*
 * barge-core.js — Coordinateur du marché noir « La Barge abandonnée » · TDL
 *
 * Agrège les bandes déclarées dans window.QuaisBarge.bandes (poussées par les
 * fichiers barge-<bande>.js) et enregistre UN module « barge » auprès de quais-core :
 *   - grille des six bandes (mode:'grid'), hero pleine largeur (detailFlush) ;
 *   - le hero (bandeau bande + service + prix) est rendu ici, commun à toutes ;
 *   - le CORPS de la fiche (formulaire + options) est délégué à band.body(item, api),
 *     car chaque bande a sa propre mécanique (négociation, prix, don, mission, offrande).
 *
 * ORDRE DE CHARGEMENT : quais-core → (barge-<bande>.js …) → barge-core.js EN DERNIER.
 *   Chaque bande fait  (window.QuaisBarge=window.QuaisBarge||{bandes:[]}).bandes.push(def).
 *
 * SCHÉMA CATALOGUE : à plat sous boutique/barge/<serviceId>, chaque item portant
 *   cat = clé de bande (comme le Comptoir). Le staff édite via le même formulaire.
 *
 * DÉPEND DE : window.Quais (register, ui, money). À CHARGER après quais-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-core] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, money = Q.money, esc = ui.esc;

  var REG = (window.QuaisBarge = window.QuaisBarge || { bandes: [] });
  var bandes = REG.bandes.slice().sort(function(a,b){ return (a.ordre||99)-(b.ordre||99); });
  if (!bandes.length) { if (window.console) console.warn("[barge-core] aucune bande déclarée — charge les fichiers barge-<bande>.js AVANT barge-core.js."); return; }

  function bande(k){ for (var i=0;i<bandes.length;i++) if (bandes[i].k===k) return bandes[i]; return null; }

  /* cats de la grille + catalogue fusionné (chaque item porte cat = clé de bande) */
  var CATS = bandes.map(function(b){ return { k:b.k, l:b.l, ic:b.ic, c:b.c }; });
  var DATA = {};
  bandes.forEach(function(b){ if (b.data) Object.keys(b.data).forEach(function(id){ var it=b.data[id]; it.cat=b.k; DATA[id]=it; }); });

  /* ---------- HERO (commun à toutes les bandes) ---------- */
  function heroPrix(b, item){
    if (b.heroPrice) return b.heroPrice(item);
    if (typeof item.pi==="number") return { l:"Prix indicatif", v:money(item.pi) };
    if (typeof item.p==="number")  return { l:"Prix", v:money(item.p) };
    var mod = { nego:"Sur proposition", prix:"À définir", don:"Sur don", mission:"Appel à volontaires", offrande:"Sans tarif ⟡ offrande" };
    return { l:"Modalité", v: mod[item.flow] || "À négocier" };
  }
  function hero(b, sur, titre, desc, prix){
    return '<div class="qb-hero"><div class="qb-heroin">'
      + '<div class="qb-herologo"><i class="'+esc(b.hero&&b.hero.logo||b.ic)+'"></i></div>'
      + '<div class="qb-heromid"><div class="qb-herosub">'+esc(sur)+'</div><div class="qb-heroname">'+esc(titre)+'</div><div class="qb-herodesc">'+esc(desc)+'</div></div>'
      + (prix ? '<div class="qb-heroprice"><div class="qb-lab">'+esc(prix.l)+'</div><div class="qb-v" style="font-size:'+(/\d/.test(prix.v)&&prix.v.length<10?"26px":"18px")+'">'+esc(prix.v)+'</div></div>' : "")
      + '</div></div>';
  }

  /* ---------- FICHE ---------- */
  function detail(id, api){
    var item = api.item(id), b = bande(item.cat);
    if (!b) return '<div class="qb-bargebody"><div class="qb-empty">Bande inconnue.</div></div>';
    var h = hero(b, b.l, item.n, item.desc, heroPrix(b, item));
    var corps = b.body ? b.body(item, api) : "";
    return h + '<div class="qb-bargebody">' + corps + '</div>';
  }

  /* bande sélectionnée mais sans service : on montre quand même son hero */
  function emptyDetail(api){
    var b = bande(api.band());
    if (!b) return '<div class="qb-empty">'+Q.TXT.BIENTOT+'</div>';
    return hero(b, "Marché noir", b.l, (b.hero&&b.hero.desc)||"", null)
      + '<div class="qb-bargebody"><div class="qb-helper">Cette bande n\u2019a pas encore de services disponibles.</div></div>';
  }

  function cardPrice(a){
    if (a.flow==="nego")     return typeof a.pi==="number" ? money(a.pi) : "à négocier";
    if (a.flow==="prix")     return typeof a.p==="number" ? money(a.p) : "à définir";
    if (a.flow==="don")      return "don";
    if (a.flow==="mission")  return "mission";
    if (a.flow==="offrande") return "offrande";
    return "";
  }

  Q.register({
    key:"barge", label:"La Barge abandonnée", sub:"marché noir", icon:"fi fi-tr-ship",
    mode:"grid", detailFlush:true, itemsLabel:"Services", leftW:"450px", cols:2, sousChemin:"barge",
    cats: CATS, data: DATA,
    cardPrice: cardPrice, detail: detail, emptyDetail: emptyDetail
  });
})();
