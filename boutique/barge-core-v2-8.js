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
  bandes.forEach(function(b){ if (b.data) Object.keys(b.data).forEach(function(id){ var it=b.data[id]; it.cat=b.k; if (b.cagnotte && !it.cagnotte) it.cagnotte=b.cagnotte; if (b.l && !it.creancier) it.creancier=b.l; DATA[id]=it; }); });

  /* ---------- HERO (commun à toutes les bandes) ---------- */
  function heroPrix(b, item){
    if (b.heroPrice) return b.heroPrice(item);
    if (typeof item.pi==="number") return { l:"Prix indicatif", v:money(item.pi) };
    if (typeof item.p==="number")  return { l:"Prix", v:money(item.p) };
    var mod = { nego:"Sur proposition", prix:"À définir", pret:"Prêt de la Main", don:"Sur don", mission:"Appel à volontaires", offrande:"Sans tarif ⟡ offrande" };
    return { l:"Modalité", v: mod[item.flow] || "À négocier" };
  }
  function hero(b, sur, titre, desc, prix, api){
    var info = api && api.bandeInfo ? api.bandeInfo(b.bohl || b.k) : null;
    var img = info && info.image;
    var style = img ? ' style="background:linear-gradient(120deg,var(--darkopa8),var(--dark2opa6)), url('+img+') center/cover"' : '';
    return '<div class="qb-hero"'+style+'><div class="qb-heroin">'
      + '<div class="qb-herologo"><i class="'+esc((b.hero&&b.hero.logo)||b.ic)+'"></i></div>'
      + '<div class="qb-heromid"><div class="qb-herosub">'+esc(sur)+'</div><div class="qb-heroname">'+esc(titre)+'</div><div class="qb-herodesc">'+esc(desc)+'</div></div>'
      + (prix ? '<div class="qb-heroprice"><div class="qb-lab">'+esc(prix.l)+'</div><div class="qb-v" style="font-size:'+(/\d/.test(prix.v)&&prix.v.length<10?"26px":"18px")+'">'+esc(prix.v)+'</div></div>' : "")
      + '</div></div>';
  }

  /* ---------- FICHE ---------- */
  function detail(id, api){
    var item = api.item(id), b = bande(item.cat);
    if (!b) return '<div class="qb-bargebody"><div class="qb-empty">Bande inconnue.</div></div>';
    var h = hero(b, b.l, item.n, item.desc, heroPrix(b, item), api);
    var corps = b.body ? b.body(item, api, id) : "";
    return h + '<div class="qb-bargebody">' + corps + '</div>';
  }

  /* bande sélectionnée mais sans service : on montre quand même son hero */
  function emptyDetail(api){
    var b = bande(api.band());
    if (!b) return '<div class="qb-empty">'+Q.TXT.BIENTOT+'</div>';
    return hero(b, "Marché noir", b.l, (b.hero&&b.hero.desc)||"", null, api)
      + '<div class="qb-bargebody"><div class="qb-helper">Cette bande n\u2019a pas encore de services disponibles.</div></div>';
  }

  function cardPrice(a){
    if (a.flow==="nego")     return typeof a.pi==="number" ? money(a.pi) : "à négocier";
    if (a.flow==="prix")     return typeof a.p==="number" ? money(a.p) : "à définir";
    if (a.flow==="pret")     return "prêt";
    if (a.flow==="don")      return "don";
    if (a.flow==="mission")  return "mission";
    if (a.flow==="offrande") return "offrande";
    return "";
  }

  /* ---------- FORMULAIRE STAFF ---------- */
  var FLOWS = ["nego","prix","don","mission","offrande"];
  function inp(champ, v){ return '<input data-champ="'+champ+'" value="'+esc(v!=null?v:"")+'">'; }
  function form(item, api, id){
    var it = item || {}, cats = api.cats();
    var curB = it.cat || api.band() || (cats[0] && cats[0].k);
    var html = '<span class="qb-lab qb-dhl">'+(id?"Éditer un service":"Ajouter un service")+' — La Barge</span>'
      + '<input type="hidden" id="qb-formid" value="'+esc(id||"")+'"><div class="qb-staffgrid">';
    html += ui.fld("Bande", '<select data-champ="cat">'+cats.map(function(c){ return '<option value="'+c.k+'"'+(curB===c.k?" selected":"")+'>'+esc(c.l)+'</option>'; }).join("")+'</select>');
    html += ui.fld("Nom", inp("n", it.n));
    html += ui.fld("Icône Flaticon (carte, optionnel)", inp("ic", it.ic));
    html += ui.fld("Type de flux", '<select data-champ="flow">'+FLOWS.map(function(f){ return '<option'+(f===(it.flow||"nego")?" selected":"")+'>'+f+'</option>'; }).join("")+'</select>');
    html += ui.fld("Prix indicatif (négociation)", inp("pi", typeof it.pi==="number"?it.pi:""));
    html += ui.fld("Prix comptant (flux prix)", inp("p", typeof it.p==="number"?it.p:""));
    html += ui.fld("Qualificatif", inp("qual", it.qual));
    html += ui.fld("Étiquette (tags)", inp("tags", it.tags));
    html += ui.fld("Note", inp("note", it.note));
    html += ui.fld("Texte d\u2019aide", inp("helper", it.helper));
    html += '</div>' + ui.fld("Description", '<textarea data-champ="desc">'+esc(it.desc||"")+'</textarea>');
    var infos = it.infos || [];
    html += '<div class="qb-sec">'+ui.lab("Informations clés (flux négociation)")+'<div class="qb-pcgrid">';
    for (var i=0;i<4;i++){
      html += ui.fld("Label "+(i+1), '<input data-champ="ilabel'+i+'" value="'+esc((infos[i]&&infos[i][0])||"")+'">')
            + ui.fld("Valeur "+(i+1), '<input data-champ="ivalue'+i+'" value="'+esc((infos[i]&&infos[i][1])||"")+'">');
    }
    html += '</div></div>';
    html += '<div class="qb-opts" style="margin-top:14px"><button class="qb-optbtn qb-pay" id="qb-save" style="flex:none">Enregistrer</button><button class="qb-optbtn" id="qb-cancel" style="flex:none">Annuler</button></div>';
    return html;
  }
  function wireDetail(det, api){
    var save = det.querySelector("#qb-save");
    if (save) save.onclick = function(){
      var champs = {}; Array.prototype.forEach.call(det.querySelectorAll("[data-champ]"), function(el){ champs[el.getAttribute("data-champ")] = el.value; });
      var idEl = det.querySelector("#qb-formid"); var id = (idEl && idEl.value) || api.nouvelId();
      var orig = idEl && idEl.value ? api.item(id) : {};
      var item = {}; for (var k in orig) if (orig.hasOwnProperty(k)) item[k] = orig[k];
      item.cat = champs.cat; item.n = champs.n || ""; item.desc = champs.desc || ""; item.flow = champs.flow || "nego";
      var pis = (champs.pi||"").trim(); item.pi = pis===""?null:(parseInt(pis,10)); if (isNaN(item.pi)) item.pi = null;
      var ps = (champs.p||"").trim(); if (ps==="") delete item.p; else { var pv=parseInt(ps,10); if (isNaN(pv)) delete item.p; else item.p=pv; }
      ["qual","tags","note","helper","ic"].forEach(function(f){ var v=(champs[f]||"").trim(); if (v==="") delete item[f]; else item[f]=v; });
      var infos=[]; for (var i=0;i<4;i++){ var l=(champs["ilabel"+i]||"").trim(), v=(champs["ivalue"+i]||"").trim(); if (l&&v) infos.push([l,v]); }
      if (infos.length) item.infos=infos; else delete item.infos;
      api.enregistrer(id, item);
    };
    var cancel = det.querySelector("#qb-cancel"); if (cancel) cancel.onclick = function(){ api.annulerForm(); };
    var comp = det.querySelector("#qb-compensation"), sit = det.querySelector("#qb-situationwrap");
    if (comp && sit) comp.onchange = function(){ sit.style.display = comp.value==="reseau" ? "" : "none"; };
    var sel = api.selId ? api.selId() : null;
    if (sel) { var it = api.item(sel), bb = it && bande(it.cat); if (bb && bb.wireDetail) bb.wireDetail(det, api, it); }
  }

  /* Migration : resynchronise les champs de structure (flow, cagnotte, rpOnly)
     des items connus avec les défauts courants — corrige les catalogues semés
     avant un changement de flux. Le contenu (nom, desc, prix, infos) est préservé. */
  function migre(catalogue){
    var patch = null;
    Object.keys(catalogue).forEach(function(id){
      var cur = catalogue[id], def = DATA[id]; if (!cur || !def) return;
      var copie = {}, changed = false; for (var k in cur) if (cur.hasOwnProperty(k)) copie[k]=cur[k];
      if (def.flow && cur.flow !== def.flow) { copie.flow = def.flow; changed = true; }
      if (def.cagnotte && !cur.cagnotte) { copie.cagnotte = def.cagnotte; changed = true; }
      if (def.rpOnly && !cur.rpOnly) { copie.rpOnly = true; changed = true; }
      if (def.reseau_auto && cur.reseau_auto !== def.reseau_auto) { copie.reseau_auto = def.reseau_auto; changed = true; }
      if (def.creancier && !cur.creancier) { copie.creancier = def.creancier; changed = true; }
      if (changed) (patch || (patch = {}))[id] = copie;
    });
    return patch;
  }

  Q.register({
    key:"barge", label:"La Barge abandonnée", sub:"marché noir", icon:"fi fi-tr-ship",
    mode:"grid", detailFlush:true, itemsLabel:"Services", leftW:"450px", cols:2, sousChemin:"barge",
    cats: CATS, data: DATA, migre: migre,
    cardPrice: cardPrice, detail: detail, emptyDetail: emptyDetail, form: form, wireDetail: wireDetail
  });
})();
