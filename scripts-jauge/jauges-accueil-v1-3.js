// === JAUGES DE TERREBONNE — AFFICHAGE PAGE D'ACCUEIL ===
// Auteur : Claude x THE DROWNED LANDS
// Widget lecture seule des trois jauges collectives, rafraîchi toutes les 60 s.
//
// [MAJ v2] Le niveau affiché est le niveau RÉEL (TDLJauges.etat : retour au
//   calme et passage différé compris), et la charge accumulée se voit dans la
//   barre : côté aggravation, le segment suivant se remplit par huitièmes ;
//   côté apaisement, le segment courant se vide. Chaque segment porte un
//   remplissage intérieur (.tdl-ja-seg-fill) dont seule la largeur bouge.
//
// Dépendances : jauges-core.js (TDLJauges), eco-core (EcoCore)
// Ancrage DOM : <div id="tdl-jauges-accueil"></div>
// Lecture : jauges/ seule, quelques centaines d'octets.

(function () {
  "use strict";

  var MODULE       = "[JaugesAccueil]";
  var CONTAINER_ID = "tdl-jauges-accueil";
  var REFRESH_MS   = 60000;

  var _tooltip = null;

  // ---------- INIT ----------
  // On attend window « load » : FA réécrit le DOM après DOMContentLoaded.

  function toutPret() {
    return !!(window.EcoCore && window.EcoCore.firebaseGet
      && window.TDLJauges && window.TDLJauges.CFG
      && window.TDLJauges.etat && window.TDLJauges.remplissage);
  }

  function demarrerPoll() {
    var tentatives = 0;
    var poll = setInterval(function () {
      if (++tentatives > 100) { clearInterval(poll); console.warn(MODULE, "Timeout — container ou dépendances introuvables."); return; }
      var container = document.getElementById(CONTAINER_ID);
      if (!container || !toutPret()) return;
      clearInterval(poll);
      setTimeout(function () {
        creerTooltip();
        render(container);
        chargerDonnees();
        setInterval(chargerDonnees, REFRESH_MS);
      }, 300);
    }, 200);
  }

  if (document.readyState === "complete") demarrerPoll();
  else window.addEventListener("load", demarrerPoll);

  // ---------- FIREBASE (lecture publique ciblée) ----------

  function chargerDonnees() {
    window.EcoCore.firebaseGet("jauges")
      .then(function (data) { mettreAJourAffichage(data || {}); })
      .catch(function (e) { console.error(MODULE, "Lecture Firebase :", e); });
  }

  // ---------- RENDER (structure posée une seule fois) ----------

  function render(container) {
    var keys = window.TDLJauges.KEYS, cfg = window.TDLJauges.CFG;
    var html = '<div class="tdl-ja-wrapper">'
             + '<div class="tdl-ja-title"><f4>Équilibres de Terrebonne</f4></div>'
             + '<div class="tdl-ja-gauges">';

    keys.forEach(function (key) {
      html += '<div class="tdl-ja-row">'
            + '<div class="tdl-ja-label">' + cfg[key].label + '</div>'
            + '<div class="tdl-ja-niveau" id="ja-niv-' + key + '">—</div>'
            + '<div class="tdl-ja-bar-wrap"><div class="tdl-ja-segments">';
      for (var i = 1; i <= 5; i++) {
        html += '<div class="tdl-ja-segment" id="ja-seg-' + key + '-' + i + '"'
              + ' data-key="' + key + '" data-n="' + i + '" role="img" aria-label="Niveau ' + i + '">'
              + '<span class="tdl-ja-seg-fill"></span></div>';
      }
      html += '</div></div></div>';
    });

    html += '</div></div>';
    container.innerHTML = html;

    container.addEventListener("mouseover", deleguerSurvol);
    container.addEventListener("mouseout",  deleguerSortie);
    container.addEventListener("mousemove", deleguerDeplacement);
  }

  // ---------- MISE À JOUR ----------

  function mettreAJourAffichage(data) {
    var J = window.TDLJauges;
    J.KEYS.forEach(function (key) {
      var e = J.etat(data[key]), parts = J.remplissage(e), c = J.CFG[key];

      parts.forEach(function (p, idx) {
        var seg = document.getElementById("ja-seg-" + key + "-" + (idx + 1));
        if (!seg) return;
        var fill = seg.firstChild;
        fill.style.width = Math.round(p.part * 100) + "%";
        fill.style.backgroundColor = c.color;
        seg.classList.toggle("tdl-ja-seg-active", p.part === 1 && !p.partiel);
        seg.classList.toggle("est-partiel", p.partiel);
        seg.classList.toggle("est-attente", p.attente);
        seg.setAttribute("data-niveau-actif", e.niveau);
      });

      var niv = document.getElementById("ja-niv-" + key);
      if (niv) niv.textContent = e.niveau + " / 5";
    });
  }

  // ---------- DÉLÉGATION ÉVÉNEMENTS ----------

  function deleguerSurvol(e) {
    var seg = e.target.closest(".tdl-ja-segment");
    if (!seg) return;
    afficherTooltip(e, seg.getAttribute("data-key"),
      parseInt(seg.getAttribute("data-n"), 10),
      parseInt(seg.getAttribute("data-niveau-actif") || "1", 10));
  }
  function deleguerSortie(e) { if (e.target.closest(".tdl-ja-segment")) cacherTooltip(); }
  function deleguerDeplacement(e) { if (e.target.closest(".tdl-ja-segment")) deplacerTooltip(e); }

  // ---------- TOOLTIP (reparenté sur body) ----------

  function creerTooltip() {
    if (_tooltip) return;
    _tooltip = document.createElement("div");
    _tooltip.className = "tdl-js-tooltip";        // classe partagée avec jauges-staff
    _tooltip.style.display = "none";
    document.body.appendChild(_tooltip);          // contexte d'empilement FA
  }
  function afficherTooltip(e, key, n, nAct) {
    if (!_tooltip) return;
    _tooltip.innerHTML = window.TDLJauges.construireTooltip(key, n, nAct);
    _tooltip.style.display = "block";
    deplacerTooltip(e);
  }
  // Pointe de la flèche à curseur + 5 px ; la flèche est à top:10px dans la boîte.
  function deplacerTooltip(e) {
    if (!_tooltip) return;
    _tooltip.style.left = (e.pageX + 14) + "px";
    _tooltip.style.top  = (e.pageY - 10) + "px";
  }
  function cacherTooltip() { if (_tooltip) _tooltip.style.display = "none"; }

  console.log("[TDLJauges] Accueil chargé.");

})();
