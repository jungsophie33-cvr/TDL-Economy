/*
 * barge-core.js — Coordinateur du marché noir « La Barge abandonnée » · TDL · v4
 *
 * Agrège les bandes déclarées dans window.QuaisBarge.bandes et enregistre UN
 * module « barge » auprès de quais-core. Rend le hero commun, délègue le corps
 * de fiche à la bande, et applique ses RÈGLES.
 *
 * [MAJ v4] RÈGLES DÉCLARATIVES.
 *   Une bande ne réécrit plus ses contrôles, ses messages ni ses montants :
 *   elle les déclare, par identifiant d'item ou par flux, et ce fichier les
 *   applique pour toutes.
 *     regles: { <id ou flow>: {
 *       resoudre(champs, item, api) → { act, montant, demandeType, detteType, champs },
 *       requis : [ [champ, message, si(champs, act, item)?], … ],
 *       minima : [ [champ, minimum, message, si(champs, act, item)?], … ],
 *       msg    : texte | function(champs, act, item),
 *       confirm: texte | function(champs, act, item)   — ajouté à la confirmation
 *       sansContexte : true  — exception à la règle générale (aucune aujourd'hui)
 *     } }
 *   Restent en code, dans la bande, les seules règles métier :
 *     controle(item, champs, act, id, api) → message | null
 *     detteLourde(item, act, champs, id)   → { motif } | null
 *     actes : { nom: function(base, champs, api) }
 *
 * [MAJ v4] LE CONTEXTE EST OBLIGATOIRE PARTOUT, contrôlé ici une fois pour
 *   toutes. Chaque fiche porte un champ data-champ="contexte".
 *
 * [MAJ v4] LA STRUCTURE VIENT DU CODE, LE CONTENU DU CATALOGUE.
 *   La fiche affichait l'item Firebase, et migre() n'en resynchronisait que
 *   sept propriétés : un drapeau ajouté au code (sansMode, avertir, confesse…)
 *   pouvait ne jamais atteindre le forum. fusion() reconstruit chaque item en
 *   mémoire : code par défaut, puis contenu édité par le staff, puis structure
 *   imposée par le code. Rien n'est écrit, plus aucune migration n'est lancée
 *   depuis le navigateur des joueurs.
 *
 * [MAJ v4-1] TEXTES PAR DÉFAUT. Le bouton du formulaire staff reprend aussi les
 *   « informations clés » ; un second bouton remet à neuf les textes de TOUS
 *   les services en un seul PATCH (noms et prix conservés).
 *
 * ORDRE DE CHARGEMENT : quais-core → barge-<bande>.js … → barge-core.js EN DERNIER.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-core] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, money = Q.money, esc = ui.esc;

  var REG = (window.QuaisBarge = window.QuaisBarge || { bandes: [] });
  var bandes = REG.bandes.slice().sort(function(a,b){ return (a.ordre||99)-(b.ordre||99); });
  if (!bandes.length) { if (window.console) console.warn("[barge-core] aucune bande déclarée — charge les fichiers barge-<bande>.js AVANT barge-core.js."); return; }

  var T = {
    CONTEXTE: "Explique le contexte de ta demande.",
    VIDE:     "Cette bande n\u2019a pas encore de services disponibles.",
    INCONNUE: "Bande inconnue.",
    RESET:    "Remettre les textes du code ?\nDescription, aide, puces, exemples et informations clés seront remplacés à l\u2019enregistrement.",
    RESET_TOUS: "Remettre les textes du code sur TOUS les services de la Barge ?\nNoms et prix sont conservés. Description, aide, puces, exemples, note, étiquette et informations clés sont remplacés tout de suite."
  };

  /* Propriétés de COMPORTEMENT : toujours dictées par le code. Tout le reste
     (nom, description, puces, aide, prix…) est du contenu éditable. */
  var STRUCT = ["flow","cat","cagnotte","creancier","rpOnly","rpForce","cible","confesse","sansMode","avertir","reseau_auto","pj"];
  var TEXTUELS = ["desc","helper","bullets","examples","note","tags","infos"];

  function bande(k){ for (var i=0;i<bandes.length;i++) if (bandes[i].k===k) return bandes[i]; return null; }
  function plein(v){ return String(v==null?"":v).trim().length > 0; }

  /* catalogue du code, chaque item portant cat, cagnotte et créancier de sa bande */
  var CATS = bandes.map(function(b){ return { k:b.k, l:b.l, ic:b.ic, c:b.c }; });
  var DATA = {};
  bandes.forEach(function(b){
    if (!b.data) return;
    Object.keys(b.data).forEach(function(id){
      var it = b.data[id];
      it.cat = b.k;
      if (b.cagnotte && it.cagnotte===undefined) it.cagnotte = b.cagnotte;
      if (b.l && !it.creancier) it.creancier = b.l;
      DATA[id] = it;
    });
  });

  function copie(o){ var r = {}; for (var k in o) if (o.hasOwnProperty(k)) r[k] = o[k]; return r; }

  function fusion(fb){
    var out = {};
    Object.keys(fb || {}).forEach(function(id){ if (fb[id]) out[id] = copie(fb[id]); });
    Object.keys(DATA).forEach(function(id){
      var def = DATA[id], it = copie(def), cur = out[id] || {};
      for (var k in cur) if (cur.hasOwnProperty(k)) it[k] = cur[k];
      STRUCT.forEach(function(s){ if (def[s]!==undefined) it[s] = def[s]; else delete it[s]; });
      out[id] = it;
    });
    return out;
  }

  /* ---------- RÈGLES ---------- */
  function regleDe(item, id){
    var b = bande(item && item.cat);
    if (!b || !b.regles) return {};
    return b.regles[id] || b.regles[item.flow] || {};
  }
  function vaut(x, champs, act, item){ return typeof x==="function" ? x(champs, act, item) : x; }
  function actif(cond, champs, act, item){ return !cond || !!cond(champs, act, item); }

  function resoudre(item, champs, id, api){
    var r = regleDe(item, id);
    return r.resoudre ? r.resoudre(champs, item, api) : { act:"demande", demandeType:item.flow };
  }

  function avantAchat(item, champs, act, id, api){
    var b = bande(item && item.cat), r = regleDe(item, id), i, x;
    if (!r.sansContexte && !plein(champs.contexte)) return T.CONTEXTE;
    var req = r.requis || [];
    for (i=0;i<req.length;i++) { x = req[i]; if (actif(x[2], champs, act, item) && !plein(champs[x[0]])) return x[1]; }
    var mins = r.minima || [];
    for (i=0;i<mins.length;i++) { x = mins[i]; if (actif(x[3], champs, act, item) && ui.montant(champs[x[0]]) < x[1]) return x[2]; }
    if (b && b.controle) { var e = b.controle(item, champs, act, id, api); if (e) return e; }
    return null;
  }
  function msgOk(item, act, champs, id){ var r = regleDe(item, id); return r.msg ? vaut(r.msg, champs, act, item) : null; }
  function confirmer(item, act, champs, id){ var r = regleDe(item, id); return r.confirm ? vaut(r.confirm, champs, act, item) : null; }
  function detteLourde(item, act, champs, id){
    var b = bande(item && item.cat);
    return (b && b.detteLourde) ? b.detteLourde(item, act, champs, id) : null;
  }
  var ACTES = {};
  bandes.forEach(function(b){ if (b.actes) Object.keys(b.actes).forEach(function(k){ ACTES[k] = b.actes[k]; }); });

  /* ---------- HERO ---------- */
  var MODALITES = { nego:"Sur proposition", prix:"À définir", pret:"Prêt de la Main", don:"Sur prime",
                    mission:"Appel à volontaires", offrande:"Offrande", faveur:"Sans tarif ⟡ contre le silence",
                    don_reseau:"Don en nature", disparition:"500 $ minimum", operation:"800 $ minimum" };
  function heroPrix(b, item){
    if (b.heroPrice) return b.heroPrice(item);
    if (typeof item.pi==="number") return { l:"Prix indicatif", v:money(item.pi) };
    if (typeof item.p==="number")  return { l:"Prix", v:money(item.p) };
    return { l:"Modalité", v: MODALITES[item.flow] || "À négocier" };
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

  function detail(id, api){
    var item = api.item(id), b = bande(item.cat);
    if (!b) return '<div class="qb-bargebody"><div class="qb-empty">'+T.INCONNUE+'</div></div>';
    return hero(b, b.l, item.n, item.desc, heroPrix(b, item), api)
      + '<div class="qb-bargebody">' + (b.body ? b.body(item, api, id) : "") + '</div>';
  }
  function emptyDetail(api){
    var b = bande(api.band());
    if (!b) return '<div class="qb-empty">'+Q.TXT.BIENTOT+'</div>';
    return hero(b, "Marché noir", b.l, (b.hero&&b.hero.desc)||"", null, api)
      + '<div class="qb-bargebody">'+ui.aide(T.VIDE)+'</div>';
  }

  function cardPrice(a){
    if (typeof a.pi==="number") return money(a.pi);
    if (typeof a.p==="number")  return money(a.p);
    var c = { nego:"à négocier", prix:"à définir", pret:"prêt", don:"prime", mission:"mission",
              disparition:"500 $ min.", operation:"800 $ min.", offrande:"offrande", faveur:"faveur", don_reseau:"don" };
    return c[a.flow] || "";
  }

  /* ---------- FORMULAIRE STAFF ---------- */
  /* Le flux et les drapeaux de comportement ne s'éditent plus ici : ils
     viennent du code et seraient de toute façon écrasés par fusion(). */
  function vtc(v){ return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]); }
  function inp(champ, v){ return '<input data-champ="'+champ+'" value="'+esc(v!=null?v:"")+'">'; }
  function form(item, api, id){
    var it = item || {}, cats = api.cats();
    var curB = it.cat || api.band() || (cats[0] && cats[0].k);
    var html = '<span class="qb-lab qb-dhl">'+(id?"Éditer un service":"Ajouter un service")+' — La Barge</span>'
      + '<input type="hidden" id="qb-formid" value="'+esc(id||"")+'"><div class="qb-staffgrid">';
    html += ui.fld("Bande", '<select data-champ="cat"'+(id&&DATA[id]?' disabled':'')+'>'+cats.map(function(c){ return '<option value="'+c.k+'"'+(curB===c.k?" selected":"")+'>'+esc(c.l)+'</option>'; }).join("")+'</select>');
    html += ui.fld("Nom", inp("n", it.n));
    html += ui.fld("Icône Flaticon (carte)", inp("ic", it.ic));
    html += ui.fld("Prix indicatif (négociation)", inp("pi", typeof it.pi==="number"?it.pi:""));
    html += ui.fld("Prix fixe", inp("p", typeof it.p==="number"?it.p:""));
    html += ui.fld("Qualificatif", inp("qual", it.qual));
    html += ui.fld("Étiquette", inp("tags", it.tags));
    html += ui.fld("Note", inp("note", it.note));
    html += ui.fld("Texte d\u2019aide", inp("helper", it.helper));
    html += '</div>' + ui.fld("Description", '<textarea data-champ="desc">'+esc(it.desc||"")+'</textarea>');
    html += ui.fld("Puces de la fiche (une par ligne)", '<textarea data-champ="bullets">'+esc(vtc(it.bullets).join("\n"))+'</textarea>');
    var infos = vtc(it.infos);
    html += '<div class="qb-sec">'+ui.lab("Informations clés")+'<div class="qb-pcgrid">';
    for (var i=0;i<4;i++){
      html += ui.fld("Label "+(i+1), '<input data-champ="ilabel'+i+'" value="'+esc((infos[i]&&infos[i][0])||"")+'">')
            + ui.fld("Valeur "+(i+1), '<input data-champ="ivalue'+i+'" value="'+esc((infos[i]&&infos[i][1])||"")+'">');
    }
    html += '</div></div>';
    html += '<div class="qb-opts" style="margin-top:14px"><button class="qb-optbtn qb-pay" id="qb-save" style="flex:none">Enregistrer</button>'
      + (id && DATA[id] ? '<button class="qb-optbtn" id="qb-reset" style="flex:none">Textes par défaut</button>' : '')
      + '<button class="qb-optbtn" id="qb-reset-tous" style="flex:none">Tous les textes par défaut</button>'
      + '<button class="qb-optbtn" id="qb-cancel" style="flex:none">Annuler</button></div>';
    return html;
  }

  function brancherForm(det, api){
    var save = det.querySelector("#qb-save");
    if (!save) return false;
    var idEl = det.querySelector("#qb-formid");
    var reset = det.querySelector("#qb-reset");
    if (reset) reset.onclick = function(){
      var def = DATA[idEl.value]; if (!def || !window.confirm(T.RESET)) return;
      var d = det.querySelector('[data-champ="desc"]'), h = det.querySelector('[data-champ="helper"]'), bl = det.querySelector('[data-champ="bullets"]');
      if (d) d.value = def.desc || ""; if (h) h.value = def.helper || ""; if (bl) bl.value = vtc(def.bullets).join("\n");
      var infos = vtc(def.infos);
      for (var i=0;i<4;i++){
        var l = det.querySelector('[data-champ="ilabel'+i+'"]'), v = det.querySelector('[data-champ="ivalue'+i+'"]');
        if (l) l.value = (infos[i] && infos[i][0]) || ""; if (v) v.value = (infos[i] && infos[i][1]) || "";
      }
      det.setAttribute("data-reset", "1");
    };
    var tous = det.querySelector("#qb-reset-tous");
    if (tous) tous.onclick = function(){
      if (!window.confirm(T.RESET_TOUS)) return;
      var lot = {};
      Object.keys(DATA).forEach(function(k){
        var cur = copie(api.item(k) || {}), def = DATA[k];
        TEXTUELS.forEach(function(t){ if (def[t]!==undefined) cur[t] = def[t]; else delete cur[t]; });
        STRUCT.forEach(function(s){ if (s!=="cat") delete cur[s]; });
        cur.cat = def.cat;
        lot[k] = cur;
      });
      api.enregistrerLot(lot);
    };
    save.onclick = function(){
      var champs = {}; Array.prototype.forEach.call(det.querySelectorAll("[data-champ]"), function(el){ champs[el.getAttribute("data-champ")] = el.value; });
      var id = (idEl && idEl.value) || api.nouvelId();
      var item = copie(idEl && idEl.value ? api.item(id) : {});
      if (champs.cat) item.cat = champs.cat;
      item.n = champs.n || ""; item.desc = champs.desc || "";
      function nombre(k){ var s = (champs[k]||"").trim(); if (s==="") { delete item[k]; return; } var v = parseInt(s,10); if (isNaN(v)) delete item[k]; else item[k] = v; }
      nombre("pi"); nombre("p");
      ["qual","tags","note","helper","ic"].forEach(function(f){ var v=(champs[f]||"").trim(); if (v==="") delete item[f]; else item[f]=v; });
      var bl = (champs.bullets||"").split("\n").map(function(s){ return s.trim(); }).filter(Boolean);
      if (bl.length) item.bullets = bl; else delete item.bullets;
      var infos=[]; for (var i=0;i<4;i++){ var l=(champs["ilabel"+i]||"").trim(), v=(champs["ivalue"+i]||"").trim(); if (l&&v) infos.push([l,v]); }
      if (infos.length) item.infos=infos; else delete item.infos;
      if (det.getAttribute("data-reset") && DATA[id] && DATA[id].examples) item.examples = DATA[id].examples;
      /* la structure n'est pas stockée : fusion() la reprend du code */
      if (DATA[id]) STRUCT.forEach(function(s){ if (s!=="cat") delete item[s]; });
      api.enregistrer(id, item);
    };
    var cancel = det.querySelector("#qb-cancel"); if (cancel) cancel.onclick = function(){ api.annulerForm(); };
    return true;
  }

  function wireDetail(det, api){
    if (brancherForm(det, api)) return;
    var sel = api.selId ? api.selId() : null;
    if (!sel) return;
    var it = api.item(sel), b = it && bande(it.cat);
    if (b && b.wireDetail) b.wireDetail(det, api, it, sel);
  }

  Q.register({
    key:"barge", label:"La Barge abandonnée", sub:"marché noir", icon:"fi fi-tr-ship",
    mode:"grid", detailFlush:true, itemsLabel:"Services", leftW:"450px", cols:2, sousChemin:"barge",
    cats: CATS, data: DATA, fusion: fusion,
    resoudre: resoudre, avantAchat: avantAchat, msgOk: msgOk, confirmer: confirmer,
    detteLourde: detteLourde, actes: ACTES,
    cardPrice: cardPrice, detail: detail, emptyDetail: emptyDetail, form: form, wireDetail: wireDetail
  });
})();
