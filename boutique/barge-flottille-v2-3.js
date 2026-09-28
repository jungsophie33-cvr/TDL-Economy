/*
 * barge-flottille.js — Bande « La Flottille » (marché noir) · TDL
 *
 * TROIS SERVICES, UN SEUL CIRCUIT : tout passe par boutique_demandes et la
 * validation staff. Aucune écriture directe dans un tableau depuis ce fichier.
 *
 *   PASSAGE      — flow "prix", 300 $. Comptant OU dette envers la Flottille
 *                  (dette légère : hors plafond des trois dettes lourdes de la
 *                  Main). Refusé si un recouvrement chiffré gèle le solde :
 *                  ce cas-là s'appelle une Disparition.
 *   DISPARITION  — flow "disparition", 500 $ minimum, comptant seul. À la
 *                  validation, quai-staff crée  flottille/disparitions/{id}.
 *   OPÉRATION    — flow "operation", 1 000 $ minimum, comptant seul. À la
 *                  validation, quai-staff crée  flottille/operations/{id}.
 *
 * Les deux derniers utilisent un bouton PROPRE (pas .qb-act) : le montant est
 * saisi par le joueur, donc il ne peut pas vivre dans un data-montant figé au
 * rendu. On passe par api.acheter({act:"comptant", montant:…}).
 *
 * DÉPEND DE : window.Quais (rendu + moteur d'achat), api.dettes(), api.enquetes().
 * À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-flottille] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, esc = ui.esc, money = Q.money;

  /* ===================== CONFIG ===================== */
  var PRIX_PASSAGE = 300, MIN_DISP = 500, MIN_OP = 1000;

  var DUREES  = [["1","1 mois"],["2","2 mois"],["3","3 mois"]];
  var DESTINS = [["texas","Texas"],["arkansas","Arkansas"],["mississippi","Mississippi"],
                 ["alabama","Alabama et sa côte"],["floride","Floride"],["indifferent","Peu importe"]];
  var MOTIFS  = [["dette","Se soustraire à une dette"],
                 ["enquete","Échapper à une enquête ou aux forces de l\u2019ordre"],
                 ["perso","Raisons personnelles"]];
  var MANDS   = [["joueur","En mon nom (joueur)"],["entreprise","Une entreprise"],
                 ["famille","Une famille"],["pnj","Un PNJ"],["anonyme","Anonyme"]];
  var VERROUS = [["distance","La distance"],
                 ["incompatibilite","L\u2019incompatibilité entre les parties"],
                 ["invisibilite","L\u2019invisibilité nécessaire"]];

  /* ===================== TEXTES ===================== */
  var T = {
    HERO: "La Flottille transporte, cache ou fait passer. Ce qu\u2019on lui confie reste entre elle et les bayous... jusqu\u2019à ce que ça n\u2019y reste plus.",

    PASSAGE_ACCUEIL: "La Flottille garantit votre arrivée, pas l\u2019accueil qu\u2019on vous réserve. Être déposé à destination ne signifie pas y être reçu avec bienveillance.",
    PASSAGE_DETTE:   "Une dette envers la Flottille n\u2019est écrite nulle part. Elle vit dans la mémoire d\u2019un capitaine, et elle sera rappelée au moment qui vous arrange le moins. Ce ne sera pas de l\u2019argent.",
    PASSAGE_GEL:     "La Main a ouvert un recouvrement à votre nom. Aucun capitaine ne vous fera monter à bord pour un trajet ordinaire tant que cette histoire n\u2019est pas réglée : le déplacement se verrait, et personne n\u2019a envie d\u2019expliquer pourquoi vous étiez sur son pont. Ce que vous cherchez s\u2019appelle une Disparition, et ça ne se négocie pas au même prix.",

    DISP_GEL:    "Un personnage dont les fonds sont gelés par la Main ne peut pas payer son propre départ. Il faudra que quelqu\u2019un paie pour lui.",
    DISP_MEMOIRE:"La Main a une mémoire longue. Disparaître déplace le problème, ça ne l\u2019efface pas.",
    DISP_SUITE:  "La demande part au staff. Une fois validée, elle s\u2019affiche au tableau du hangar et attend qu\u2019un capitaine la prenne. Sans preneur sous quatorze jours, la prime vous est rendue.",
    DISP_CONFIRM:function(p, d){ return "Demander à disparaître pendant "+d+" ?\nLa prime de "+money(p)+" est retenue dès maintenant, et rendue si le staff refuse ou si aucun capitaine ne prend le départ."; },

    OP_SUITE:   "La prime est retenue dès l\u2019envoi et vous est rendue si le staff refuse, ou si personne ne s\u2019en empare sous quatorze jours. Les capitaines peuvent demander à la renégocier à la hausse selon ce que l\u2019opération exige.",
    OP_CONFIRM: function(p){ return "Ouvrir cette opération ?\nLa prime de "+money(p)+" est retenue dès maintenant."; },

    ERR_LIEU:    "Indiquer le lieu ou la communauté que votre personnage veut atteindre.",
    ERR_VERROU:  "Expliquer ce qui rend cet accès impossible autrement : c\u2019est ce que la Flottille vend.",
    ERR_BUT:     "Dire ce que le personnage compte faire une fois sur place.",
    ERR_PRIME:   function(m){ return "Indiquez une prime d\u2019au moins "+money(m)+"."; },
    ERR_RESTE:   "Désigner le personnage joueur qui reste derrière : c\u2019est chez lui que la Main ira chercher.",
    ERR_DETTE:   "Choisir la dette que le personnage fuit.",
    ERR_ENQUETE: "Choisir l\u2019affaire que le personnage fuit.",
    ERR_TITRE:   "Donnez un titre à l\u2019opération.",
    ERR_PARTIES: "Dire qui doit se retrouver là : communautés, bandes, familles, PNJ.",
    ERR_OBJ:     "Décrire l\u2019objectif de l\u2019opération.",
    ERR_BASE:    "Base indisponible \u2014 rien n\u2019a été retenu."
  };

  /* ===================== CATALOGUE ===================== */
  var DATA = {
    flot_passage: {
      flow:"prix", ic:"route", p:PRIX_PASSAGE, n:"Passage",
      desc:"Toutes les portes ne s\u2019atteignent pas depuis la route. Les campement se déplacent, un certain village ne reçoit pas d\u2019étrangers, des bandes ne s\u2019approchent pas sans être annoncé. La Flottille connaît les chenaux et ceux qui vivent au bout.",
      bullets:[
        "Atteindre une communauté fermée, isolée ou hostile aux inconnus",
        "Se présenter devant une bande qui ne reçoit pas n\u2019importe qui",
        "Rejoindre un lieu que les cartes ignorent et que les routes n\u2019atteignent pas",
        "Arriver quelque part sans que personne n\u2019ait vu par où"
      ],
      helper:"Ce qu\u2019elle vend n\u2019est pas la traversée : c\u2019est le fait d\u2019arriver quelque part où votre personnage n\u2019aurait eu ni raison ni moyen de se trouver. Terrebonne et ses abords uniquement."
    },
    flot_disparition: {
      flow:"disparition", ic:"fog", n:"Disparition temporaire",
      desc:"Sortir de Louisiane, et ne plus figurer nulle part pendant un temps. La Flottille sait faire. Ce qu\u2019elle ne sait pas faire, c\u2019est empêcher à ceux que vous laissez derrière de payer à votre place.",
      helper:"De un à trois mois. Au retour, rien n\u2019aura été effacé : la dette aura seulement changé de mains."
    },
    flot_operation: {
      flow:"operation", ic:"anchor", n:"Opération",
      desc:"Ce que vous voulez faire demande plus de monde que vous n\u2019en connaissez, et ces gens-là ne se parlent pas. La Flottille fournit le point de rencontre, les moyens du déplacement et rien d\u2019autre.",
      helper:"Ce qui se décide sur place ne la regarde pas. Elle réunit, elle déplace, elle s\u2019en va."
    }
  };

  /* ===================== HELPERS DE RENDU ===================== */
  function vt(v){ return Array.isArray(v) ? v : (v ? Object.keys(v).map(function(k){ return v[k]; }) : []); }
  function opts(list){ return list.map(function(o){ return '<option value="'+esc(o[0])+'">'+esc(o[1])+'</option>'; }).join(""); }
  function sel(champ, list){ return '<select data-champ="'+esc(champ)+'">'+opts(list)+'</select>'; }
  function selVide(champ, list, vide){
    return '<select data-champ="'+esc(champ)+'"><option value="">'+esc(vide)+'</option>'+opts(list)+'</select>';
  }
  function bullets(titre, arr){
    arr = vt(arr); if (!arr.length) return "";
    return '<div class="qb-sec">'+ui.lab(titre)+'<ul class="qb-bull">'
      + arr.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("") + '</ul></div>';
  }
  function helper(t){ return '<div class="qb-helper">'+esc(t)+'</div>'; }
  function bouton(id, label){
    return '<div class="qb-opts qb-center"><button class="qb-optbtn qb-pay" id="'+id+'" style="flex:none">'+esc(label)+'</button></div>';
  }
   /* dettes ET prêts : [valeur, libellé], valeur = "dettes:clé" ou "prets:clé" */
  function listeDettes(api){
    var out = [];
    if (!api || !api.dus) return out;
    api.dus().forEach(function(x){
      var d = x.d || {};
      if (x.source === "dettes" && d.statut && d.statut !== "active") return;
      var titre = d.motif || d.nom || d.objet || (x.source === "prets" ? "Prêt" : "Dette");
      var lib = (x.source === "prets" ? "Prêt de " + (+d.montant||0) + " $ \u2014 " + titre : titre)
              + (d.creancier ? " \u27e1 " + d.creancier : "");
      out.push([x.key, lib]);
    });
    return out;
  }
  function listeEnquetes(api){
    var out = [];
    if (!api || !api.enquetes) return out;
    api.enquetes().forEach(function(a){
      out.push([a.id, (a.type ? a.type + " \u00b7 " : "") + a.titre]);
    });
    return out;
  }
  /* libellé associé à une valeur, pour figer le texte dans la demande */
  function libDe(list, val){
    for (var i=0;i<list.length;i++) if (String(list[i][0])===String(val)) return list[i][1];
    return "";
  }

  /* ===================== CORPS DES FICHES ===================== */
  function corpsPassage(item){
    return bullets("Ce que le passage peut ouvrir", item.bullets)
      + '<div class="qb-sec">'+ui.lab("Votre demande")
      +   ui.fld("Lieu ou communauté visée *", ui.inp("lieu_vise","Un campement, un village, un ponton, une bande…"))
      +   '<div class="qb-pcgrid">'
      +     '<div>'+ui.fld("Ce qui rend l\u2019accès impossible autrement *", ui.ta("verrou_acces","Distance, méfiance, hostilité, absence de route, absence de raison d\u2019y aller…"))+'</div>'
      +     '<div>'+ui.fld("Ce que votre personnage compte y faire *", ui.ta("but_passage","Rencontrer, négocier, demander, observer, se cacher…"))+'</div>'
      +   '</div>'
      +   helper(T.PASSAGE_ACCUEIL)
      + '</div>'
      + '<div class="qb-opts">'
      +   ui.optcard({ ic:"fi fi-tr-dollar", titre:"Payer comptant", desc:"Le tarif ne se discute pas pour un trajet ordinaire.",
                       prix:money(PRIX_PASSAGE), btn:"Payer maintenant", act:"comptant", montant:PRIX_PASSAGE, pay:true })
      +   ui.optcard({ ic:"fi fi-tr-anchor", titre:"Contracter une dette", desc:"Le capitaine avance le service. Vous rendrez autre chose, plus tard.",
                       prix:"0 $ + dette", btn:"Contracter", act:"dette", dette:"legere", montant:0,
                       note:"Dette notée par le staff, rappelée au moment opportun." })
      + '</div>'
      + helper(T.PASSAGE_DETTE);
  }

  function corpsDisparition(item, api){
    var dettes = listeDettes(api), enqs = listeEnquetes(api);
    var pjs = (api && api.pseudos) ? api.pseudos().map(function(p){ return [p,p]; }) : [];
    return '<div class="qb-sec">'+ui.lab("Organiser le départ")
      +   '<div class="qb-pcgrid">'
      +     '<div>'+ui.fld("Durée d\u2019absence *", sel("duree", DUREES))+'</div>'
      +     '<div>'+ui.fld("Destination", sel("destination", DESTINS))+'</div>'
      +   ui.fld("Motif du départ *", sel("motif", MOTIFS))
      +   '<div id="qbf-motif-dette">'
      +     ui.fld("Dette que vous fuyez *", dettes.length
                  ? selVide("dette_key", dettes, "\u2014 Choisir \u2014")
                  : '<div class="qb-helper">Aucune dette active à votre nom.</div>')
      +   '</div>'
      +   '<div id="qbf-motif-enq" style="display:none">'
      +     ui.fld("Affaire que vous fuyez *", enqs.length
                  ? selVide("enquete_id", enqs, "\u2014 Choisir \u2014")
                  : '<div class="qb-helper">Aucune affaire ouverte au panneau des enquêtes.</div>')
      +   '</div>'
      +     '<div>'+ui.fld("Personne importante laissée derrière *", selVide("restent", pjs, "\u2014 Choisir un personnage \u2014"))+'</div>'
      +     '<div>'+ui.fld("Autres proches concernés", ui.inp("restent_pnj","PNJ : famille, associés, voisins…"))+'</div>'
      +   '</div>'
      +   ui.fld("Contexte du départ", ui.ta("contexte","Ce qui pousse votre personnage à partir, ce qu\u2019il laisse en plan…"))
      +   ui.fld("Prime proposée * (minimum "+money(MIN_DISP)+")", ui.inp("prime","$ \u2014 retenue dès l\u2019envoi"))
      +   helper(T.DISP_GEL)
      +   helper(T.DISP_MEMOIRE)
      +   (item.helper ? helper(item.helper) : "")
      + '</div>'
      + bouton("qbf-disp-go", "Demander à disparaître")
      + helper(T.DISP_SUITE);
  }

  function corpsOperation(item){
    return '<div class="qb-sec">'+ui.lab("Ouvrir une opération")
      +   ui.fld("Titre de l\u2019opération *", ui.inp("titre","Ex. : La rencontre du chenal de Dulac"))
      +   '<div class="qb-pcgrid">'
      +     '<div>'+ui.fld("Pourquoi la Flottille *", sel("verrou", VERROUS))+'</div>'
      +     '<div>'+ui.fld("Prime offerte * (minimum "+money(MIN_OP)+")", ui.inp("prime","$ \u2014 retenue dès l\u2019envoi"))+'</div>'
      +   '</div>'
      +   ui.fld("Qui doit se retrouver là *", ui.ta("parties","Communautés, bandes, familles, PNJ, personnes venues de loin…"))
      +   '<div class="qb-pcgrid">'
      +     '<div>'+ui.fld("Objectif *", ui.ta("objectif","Ce que l\u2019opération doit produire…"))+'</div>'
      +     '<div>'+ui.fld("Contraintes (une par ligne)", ui.ta("contraintes","Délai, discrétion, lieu imposé, personne à tenir à l\u2019écart…"))+'</div>'
      +   '</div>'
      +   ui.fld("Contexte", ui.ta("contexte","Le contexte narratif de la demande…"))
      +   '<div class="qb-pcgrid">'
      +     '<div>'+ui.fld("Commanditaire affiché", sel("mandtype", MANDS))+'</div>'
      +     '<div>'+ui.fld("Libellé (si autre que votre pseudo)", ui.inp("mand","Nom d\u2019entreprise, de famille, de PNJ…"))+'</div>'
      +   '</div>'
      +   (item.helper ? helper(item.helper) : "")
      + '</div>'
      + bouton("qbf-op-go", "Ouvrir l\u2019opération")
      + helper(T.OP_SUITE);
  }

  function body(item, api){
    var b = "";
    if (item.flow === "prix")        b = corpsPassage(item);
    else if (item.flow === "disparition") b = corpsDisparition(item, api);
    else if (item.flow === "operation")   b = corpsOperation(item);
    return '<div class="qb-rule"></div>' + b;
  }

  /* ===================== GARDE-FOU AVANT ACHAT ===================== */
  /* Appelé par le core pour les boutons .qb-act — donc pour le Passage seul.
     Les deux autres services ont leur bouton propre et vérifient eux-mêmes. */
  function avantAchat(item, champs){
    if (item.flow !== "prix") return null;
    try { if (Q.gele && Q.gele() > 0) return T.PASSAGE_GEL; } catch(e){}
    if (!String(champs.lieu_vise||"").trim())    return T.ERR_LIEU;
    if (!String(champs.verrou_acces||"").trim()) return T.ERR_VERROU;
    if (!String(champs.but_passage||"").trim())  return T.ERR_BUT;
    return null;
  }

  /* ===================== ENVOI DES DEUX GROS SERVICES ===================== */
  function lire(det, champ){
    var el = det.querySelector('[data-champ="'+champ+'"]');
    return el ? String(el.value||"").trim() : "";
  }
  function montantDe(det, champ){
    return parseInt(lire(det, champ).replace(/[^\d]/g,""), 10) || 0;
  }

  function envoyerDisparition(det, api){
    var duree = lire(det,"duree") || "1",
        motif = lire(det,"motif") || "perso",
        restent = lire(det,"restent"),
        prime = montantDe(det,"prime");

    if (prime < MIN_DISP) { alert(T.ERR_PRIME(MIN_DISP)); return; }
    if (!restent) { alert(T.ERR_RESTE); return; }

    var dettes = listeDettes(api), enqs = listeEnquetes(api);
    var detteKey = "", enqId = "";
    if (motif === "dette") {
      detteKey = lire(det,"dette_key");
      if (!detteKey) { alert(T.ERR_DETTE); return; }
    } else if (motif === "enquete") {
      enqId = lire(det,"enquete_id");
      if (!enqId) { alert(T.ERR_ENQUETE); return; }
    }

    var dureeLib = libDe(DUREES, duree);
    if (!window.confirm(T.DISP_CONFIRM(prime, dureeLib))) return;

    api.acheter({
      act:"comptant", montant:prime,
      champs:{
        duree: duree, duree_libelle: dureeLib,
        destination: libDe(DESTINS, lire(det,"destination")),
        motif: motif, motif_libelle: libDe(MOTIFS, motif),
        dette_key: detteKey, dette_libelle: detteKey ? libDe(dettes, detteKey) : "",
        enquete_id: enqId, enquete_titre: enqId ? libDe(enqs, enqId) : "",
        prime: prime
      }
    });
  }

  function envoyerOperation(det, api){
    var titre = lire(det,"titre"), prime = montantDe(det,"prime");
    if (!titre) { alert(T.ERR_TITRE); return; }
    if (prime < MIN_OP) { alert(T.ERR_PRIME(MIN_OP)); return; }
    if (!String(lire(det,"parties")).trim())  { alert(T.ERR_PARTIES); return; }
    if (!String(lire(det,"objectif")).trim()) { alert(T.ERR_OBJ); return; }

    if (!window.confirm(T.OP_CONFIRM(prime))) return;

    var mandtype = lire(det,"mandtype") || "joueur";
    api.acheter({
      act:"comptant", montant:prime,
      champs:{
        titre: titre, prime: prime,
        verrou: lire(det,"verrou"), verrou_libelle: libDe(VERROUS, lire(det,"verrou")),
        mandtype: mandtype, mandtype_libelle: libDe(MANDS, mandtype)
      }
    });
  }

  /* ===================== ACCROCHES ===================== */
  /* Les deux blocs conditionnels du motif sont hors grille : un simple ""
     suffit, pas besoin de display:"contents". */
  function wireDetail(det, api, it){
    if (!it) return;

    if (it.flow === "disparition") {
      var m = det.querySelector('[data-champ="motif"]'),
          bd = det.querySelector("#qbf-motif-dette"),
          be = det.querySelector("#qbf-motif-enq");
      if (m) m.onchange = function(){
        if (bd) bd.style.display = (m.value === "dette")   ? "" : "none";
        if (be) be.style.display = (m.value === "enquete") ? "" : "none";
      };
      var gd = det.querySelector("#qbf-disp-go");
      if (gd) gd.onclick = function(){ envoyerDisparition(det, api); };
    }

    if (it.flow === "operation") {
      var go = det.querySelector("#qbf-op-go");
      if (go) go.onclick = function(){ envoyerOperation(det, api); };
    }
  }

  /* ===================== DÉCLARATION ===================== */
  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"flot", bohl:"flottille", ordre:6, l:"La Flottille",
    ic:"fi fi-tr-anchor", c:"var(--gr5-color)",
    hero:{ logo:"fi fi-tr-anchor", desc:T.HERO },
    data: DATA, body: body, wireDetail: wireDetail, avantAchat: avantAchat
  });
})();
