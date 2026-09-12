/*
 * barge-maringouins.js — Bande « Les Maringouins » (marché noir) · TDL
 * Deux mécaniques :
 *   DON     — « coup de main » : on sollicite, on propose un don. Aucun débit,
 *             la demande part au staff (moteur du core, act "don").
 *   MISSION — « mission de cellule » : le commanditaire fixe l'objectif et la
 *             prime ; la prime est RETENUE à l'ouverture (débit provisoire) et
 *             une mission est écrite directement dans  missions/{id}  en_attente,
 *             puis gérée par le Tableau des missions (chef, négociation, refus
 *             auto à 7 j, versement). AUCUN boutique_demandes, aucun gate staff.
 * DÉPEND DE : window.Quais (rendu) + window.EcoCore (débit + écriture mission).
 * À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-maringouins] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, esc = ui.esc;

  var TYPES = [["recuperation","Récupération"],["contrebande","Contrebande"],["transport","Transport"],["sabotage","Sabotage"],["intimidation","Intimidation"]];
  var MANDS = [["joueur","En mon nom (joueur)"],["entreprise","Une entreprise"],["famille","Une famille"],["pnj","Un PNJ"],["anonyme","Anonyme"]];

  var DATA = {
    coupmain:{flow:"don",n:"Coup de main discret",desc:"« On te file un coup de main parce que t\u2019es des nôtres. » Ponctuel, clandestin, de faible ampleur.",bullets:["Protection ponctuelle d\u2019un commerce, atelier, embarcadère, distillerie…","Convoyage discret de marchandises non déclarées","Une diversion de leur cru","Un hébergement clandestin d\u2019une nuit","La surveillance d\u2019un lieu"],helper:"La nature exacte de l\u2019aide est à définir avec le staff."},
    mission:{flow:"mission",n:"Mission de cellule",desc:"Appel à volontaires transmis aux cellules Maringouins. Vous fixez l\u2019objectif et la prime ; la prime est retenue dès l\u2019ouverture. Le premier Maringouin qui s\u2019en empare devient chef de mission ; à l\u2019issue, la prime revient aux participants.",helper:"La prime est retenue à l\u2019ouverture et vous est recréditée si aucune cellule ne s\u2019empare de la mission sous 7 jours. Le chef de mission peut renégocier la prime avec vous."}
  };

  /* ---------- RENDU DE LA FICHE ---------- */
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
      return b;
    }

    /* --- mission de cellule --- */
    var typeOpts = TYPES.map(function(o){ return '<option value="'+o[0]+'">'+o[1]+'</option>'; }).join("");
    var mandOpts = MANDS.map(function(o){ return '<option value="'+o[0]+'">'+o[1]+'</option>'; }).join("");
    b += '<div class="qb-sec">'+ui.lab("Ouvrir une mission")
      + ui.fld("Titre de la mission *", ui.inp("mtitre","Ex. : Récupérer une cargaison à Cocodrie"))
      + '<div class="qb-pcgrid">'
      +   '<div>'+ui.fld("Type de mission *", '<select data-champ="mtype">'+typeOpts+'</select>')+'</div>'
      +   '<div>'+ui.fld("Prime offerte * ($)", ui.inp("mprime","Montant retenu à l\u2019ouverture"))+'</div>'
      + '</div>'
      + '<div class="qb-pcgrid">'
      +   '<div>'+ui.fld("Commanditaire affiché", '<select data-champ="mandtype">'+mandOpts+'</select>')+'</div>'
      +   '<div>'+ui.fld("Libellé (si autre que votre pseudo)", ui.inp("mand","Nom d\u2019entreprise, de famille, de PNJ…"))+'</div>'
      + '</div>'
      + ui.fld("Objectif *", ui.ta("mobj","Ce que la cellule doit accomplir…"))
      + ui.fld("Contraintes (une par ligne)", ui.ta("mcontr","Délai, discrétion, cible à ne pas toucher…"))
      + ui.fld("Contexte", ui.ta("mctx","Le contexte narratif de la demande…"))
      + (item.helper?'<div class="qb-helper">'+esc(item.helper)+'</div>':"")
      + '</div>'
      + '<div class="qb-opts qb-center"><button class="qb-optbtn qb-pay" id="qbm-go" style="flex:none">Ouvrir la mission</button></div>';
    return b;
  }

  /* ---------- OUVERTURE DE MISSION (débit + écriture) ---------- */
  function ouvrirMission(det){
    var E = window.EcoCore;
    if (!E || !E.firebaseTransaction || !E.writeField) { alert("Base indisponible — mission non ouverte."); return; }
    var p = (E.getPseudo && E.getPseudo()) || (window._userdata && window._userdata.username);
    p = p ? String(p).trim() : "";
    if (!p) { alert("Connecte-toi pour ouvrir une mission."); return; }

    var g = function(c){ var el = det.querySelector('[data-champ="'+c+'"]'); return el ? String(el.value||"").trim() : ""; };
    var titre = g("mtitre"), type = g("mtype")||"recuperation",
        mandType = g("mandtype")||"joueur", mandLbl = g("mand"),
        objectif = g("mobj"), contexte = g("mctx"),
        contraintes = g("mcontr").split("\n").map(function(x){ return x.trim(); }).filter(Boolean),
        prime = parseInt(g("mprime").replace(/[^\d]/g,""), 10);

    if (!titre) { alert("Donne un titre à la mission."); return; }
    if (!prime || prime <= 0) { alert("Indique une prime valide (en dollars)."); return; }
    var mand = mandLbl || (mandType==="anonyme" ? "Anonyme" : p);

    if (!window.confirm("Ouvrir la mission « "+titre+" » ?\nLa prime de "+prime+" $ sera retenue immédiatement (recréditée si aucune cellule ne s\u2019en empare sous 7 jours).")) return;

    var P = encodeURIComponent(p);
    /* 1. débit provisoire atomique */
    E.firebaseTransaction("membres/"+P+"/dollars", function(cur){
      var s = cur||0; if (s < prime) throw new Error("FONDS"); return s - prime;
    }).then(function(){
      /* 2. écriture de la mission */
      var id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
      var mission = {
        titre:titre, type:type, mandataire:mand, mandataireType:mandType,
        payeur:p, prime:prime, primeInitiale:prime,
        objectif:objectif, contraintes:contraintes, contexte:contexte,
        statut:"en_attente", chef:null, participants:[], valides:[], nego:null,
        topic:"", resume:"", consequences:"", demandeValidation:false,
        cree:new Date().toISOString(), rembourse:false, primeVersee:false
      };
      return E.writeField("missions/"+id, mission).catch(function(e){
        /* écriture échouée → recrédit pour ne pas retenir sans trace */
        E.firebaseTransaction("membres/"+P+"/dollars", function(cur){ return (cur||0)+prime; }).catch(function(){});
        throw e;
      });
    }).then(function(){
      alert("Mission ouverte ! La prime de "+prime+" $ est retenue jusqu\u2019à l\u2019issue. Suivez-la dans le Tableau des missions des Maringouins.");
      try { if (Q.refresh) Q.refresh(); } catch(e){}
    }).catch(function(e){
      if (e && e.message==="FONDS") { alert("Fonds insuffisants — prime non retenue."); return; }
      if (window.console) console.error("[barge-maringouins] ouverture mission", e);
      alert("Ouverture de la mission échouée — aucun montant n\u2019a été retenu.");
    });
  }

  /* accroche propre à la bande : le bouton mission n'est PAS .qb-act (le core
     ne le touche pas) — on le câble ici, uniquement pour l'item mission. */
  function wireDetail(det, api, it){
    if (!it || it.flow!=="mission") return;
    var btn = det.querySelector("#qbm-go");
    if (btn) btn.onclick = function(){ ouvrirMission(det); };
  }

  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"maring", bohl:"maringouins", ordre:2, l:"Les Maringouins", ic:"fi fi-tr-mosquito", c:"var(--gr2-color)",
    hero:{ logo:"fi fi-tr-mosquito", desc:"Un réseau de cellules discrètes, soudées par l\u2019entraide. On ne les achète pas : on sollicite leur attention." },
    data: DATA, body: body, wireDetail: wireDetail
  });
})();
