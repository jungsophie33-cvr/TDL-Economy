// === JAUGES DE TERREBONNE — AFFICHAGE PAGE D'ACCUEIL ===
// Auteur : Claude x THE DROWNED LANDS
// Widget lecture seule — affichage dynamique des trois jauges collectives.
// Rafraîchissement automatique toutes les 60 secondes.
// Dépendances : jauges-core.js, eco-core2.js (window.EcoCore)
// Ancrage DOM : <div id="tdl-jauges-accueil"></div>

(function () {
  "use strict";

  const MODULE       = "[JaugesAccueil]";
  const CONTAINER_ID = "tdl-jauges-accueil";
  const REFRESH_MS   = 60000; // Rafraîchissement toutes les 60 secondes

  let _tooltip       = null;
  let _refreshTimer  = null;

  // ---------- INIT (pattern eco-dc-init.js) ----------

  function toutPret() {
    return !!(
      window.EcoCore &&
      window.EcoCore.safeReadBin &&
      window.TDLJauges &&
      window.TDLJauges.CFG
    );
  }

  const _poll = setInterval(function () {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    if (!toutPret())  return;
    clearInterval(_poll);
    setTimeout(function () {
      creerTooltip();
      render(container);
      chargerDonnees(container);
      _refreshTimer = setInterval(function () {
        chargerDonnees(container);
      }, REFRESH_MS);
    }, 600);
  }, 200);

  // ---------- FIREBASE (lecture publique) ----------

  function chargerDonnees(container) {
    window.EcoCore.safeReadBin()
      .then(function (rec) {
        const data = (rec && rec.jauges) ? rec.jauges : {};
        mettreAJourAffichage(data);
      })
      .catch(function (e) {
        console.error(MODULE, "Lecture Firebase :", e);
      });
  }

  // ---------- RENDER (structure statique posée une seule fois) ----------

  function render(container) {
    const keys = window.TDLJauges.KEYS;
    const cfg  = window.TDLJauges.CFG;

    let html = '<div class="tdl-ja-wrapper">';
    html    += '<div class="tdl-ja-title">Équilibres de Terrebonne</div>';
    html    += '<div class="tdl-ja-gauges">';

    keys.forEach(function (key) {
      const c = cfg[key];
      html += '<div class="tdl-ja-row">';

      // Nom de la jauge
      html += '<div class="tdl-ja-label">' + c.label + '</div>';

      // Barre de segments
      html += '<div class="tdl-ja-bar-wrap">';
      html += '<div class="tdl-ja-segments">';
      for (let i = 1; i <= 5; i++) {
        html += '<div class="tdl-ja-segment"'
              + ' id="ja-seg-' + key + '-' + i + '"'
              + ' data-key="' + key + '"'
              + ' data-n="' + i + '"'
              + ' role="img"'
              + ' aria-label="Niveau ' + i + '">'
              + '</div>';
      }
      html += '</div>'; // .tdl-ja-segments
      html += '</div>'; // .tdl-ja-bar-wrap

      // Indicateur numérique
      html += '<div class="tdl-ja-niveau" id="ja-niv-' + key + '">—</div>';

      html += '</div>'; // .tdl-ja-row
    });

    html += '</div>'; // .tdl-ja-gauges
    html += '</div>'; // .tdl-ja-wrapper

    container.innerHTML = html;

    // Délégation événements pour tooltip au survol
    container.addEventListener("mouseover",  deleguerSurvol);
    container.addEventListener("mouseout",   deleguerSortie);
    container.addEventListener("mousemove",  deleguerDeplacement);
  }

  // ---------- MISE À JOUR SEGMENTS ----------

  function mettreAJourAffichage(data) {
    const keys = window.TDLJauges.KEYS;
    const cfg  = window.TDLJauges.CFG;

    keys.forEach(function (key) {
      const entry = data[key] || {};
      const n     = Math.min(5, Math.max(1, parseInt(entry.niveau) || 1));
      const c     = cfg[key];

      // Couleur des segments
      for (let i = 1; i <= 5; i++) {
        const seg = document.getElementById("ja-seg-" + key + "-" + i);
        if (!seg) continue;
        if (i <= n) {
          seg.style.backgroundColor = c.color;
          seg.classList.add("tdl-ja-seg-active");
        } else {
          seg.style.backgroundColor = "";
          seg.classList.remove("tdl-ja-seg-active");
        }
        // Stocker le niveau courant pour le tooltip
        seg.setAttribute("data-niveau-actif", n);
      }

      // Indicateur numérique
      const niv = document.getElementById("ja-niv-" + key);
      if (niv) niv.textContent = n + " / 5";
    });
  }

  // ---------- DÉLÉGATION ÉVÉNEMENTS ----------

  function deleguerSurvol(e) {
    const seg = e.target.closest(".tdl-ja-segment");
    if (!seg) return;
    const key  = seg.getAttribute("data-key");
    const n    = parseInt(seg.getAttribute("data-n"), 10);
    const nAct = parseInt(seg.getAttribute("data-niveau-actif") || "1", 10);
    afficherTooltip(e, key, n, nAct);
  }

  function deleguerSortie(e) {
    if (!e.target.closest(".tdl-ja-segment")) return;
    cacherTooltip();
  }

  function deleguerDeplacement(e) {
    if (!e.target.closest(".tdl-ja-segment")) return;
    deplacerTooltip(e);
  }

  // ---------- TOOLTIP (déplacé sur body) ----------

  function creerTooltip() {
    if (_tooltip) return;
    _tooltip = document.createElement("div");
    _tooltip.className     = "tdl-js-tooltip"; // classe partagée avec jauges-staff.js
    _tooltip.style.display = "none";
    document.body.appendChild(_tooltip); // escape stacking context ForumActif
  }

  function afficherTooltip(e, key, n, nAct) {
    if (!_tooltip) return;
    _tooltip.innerHTML     = window.TDLJauges.construireTooltip(key, n, nAct);
    _tooltip.style.display = "block";
    deplacerTooltip(e);
  }

  function deplacerTooltip(e) {
    if (!_tooltip) return;
    _tooltip.style.left = (e.pageX + 14) + "px";
    _tooltip.style.top  = (e.pageY - 36) + "px";
  }

  function cacherTooltip() {
    if (_tooltip) _tooltip.style.display = "none";
  }

  console.log("[TDLJauges] Accueil module chargé.");

})();
