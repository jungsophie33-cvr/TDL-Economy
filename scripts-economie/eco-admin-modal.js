// === ECO ADMIN MODAL ===
// Auteur : Claude x THE DROWNED LANDS
// Pattern aligné sur fl-modal (DOMContentLoaded, classList.active, double overflow reset).
// Modal injecté sur document.body — escape stacking context ForumActif.
// Dépendances : eco-admin-modal.css, Flaticon UIcons CDN.
// Tous les IDs de eco-ui.js sont préservés sans modification.

(function () {
  "use strict";

  var MODULE     = "[EcoAdminModal]";
  var TRIGGER_ID = "eco-admin-modal-trigger";
  var OVERLAY_ID = "eco-admin-modal-overlay";

  // ── FLATICON CDN (chargé une seule fois, même guard que jauges-core.js) ──
  function chargerFlaticon() {
    var CDN_ID  = "tdl-flaticon-css";
    var CDN_URL = "https://cdn-uicons.flaticon.com/2.6.0/uicons-solid-straight/css/uicons-solid-straight.css";
    if (document.getElementById(CDN_ID)) return;
    var link  = document.createElement("link");
    link.id   = CDN_ID;
    link.rel  = "stylesheet";
    link.href = CDN_URL;
    document.head.appendChild(link);
  }

  // ── HTML DU MODAL ─────────────────────────────────────────────
  // Tous les IDs existants (selects, inputs, boutons) sont conservés
  // pour compatibilité totale avec eco-ui.js sans aucune modification.

  var MODAL_HTML = [
    '<div id="', OVERLAY_ID, '" class="eam-overlay" role="dialog" aria-modal="true" aria-label="Administration Économie">',
      '<div class="eam-modal">',

        '<div class="eam-header">',
          '<span class="eam-title">Administration · Économie</span>',
          '<button class="eam-close" id="eco-admin-modal-close" aria-label="Fermer">&#10005;</button>',
        '</div>',

        '<div class="eam-tabs" role="tablist">',
          '<button class="eam-tab eam-tab-active" data-tab="distribution" role="tab" aria-selected="true">',
            '<i class="fi fi-ss-coin" aria-hidden="true"></i> Distribution',
          '</button>',
          '<button class="eam-tab" data-tab="reinit" role="tab" aria-selected="false">',
            '<i class="fi fi-ss-rotate-right" aria-hidden="true"></i> Réinitialisations',
          '</button>',
          '<button class="eam-tab" data-tab="transferts" role="tab" aria-selected="false">',
            '<i class="fi fi-ss-arrows-repeat" aria-hidden="true"></i> Transferts',
          '</button>',
        '</div>',

        '<div class="eam-body">',

          // ── DISTRIBUTION ──
          '<div class="eam-panel" data-panel="distribution">',
            '<div class="eam-section-title">Globale</div>',
            '<div class="eam-row" id="eco-admin-giveall">',
              '<label class="eam-label">Montant :</label>',
              '<input type="number" id="eco-giveall-amount" class="eam-input" min="1" value="10"/>',
              '<button id="eco-giveall-btn" class="eam-btn eam-btn-primary">Distribuer à tous</button>',
            '</div>',
            '<div class="eam-section-title">Individuelle</div>',
            '<div class="eam-row" id="eco-adjust-box">',
              '<select id="eco-adjust-member" class="eam-select"></select>',
              '<input id="eco-adjust-amount" type="number" class="eam-input" placeholder="Montant (+ ou -)"/>',
              '<button id="eco-adjust-btn" class="eam-btn eam-btn-primary">Valider</button>',
            '</div>',
            '<p class="eam-hint">Positif pour ajouter, négatif pour retirer.</p>',
          '</div>',

          // ── RÉINITIALISATIONS ──
          '<div class="eam-panel eam-panel-hidden" data-panel="reinit">',
            '<div class="eam-section-title">Membres</div>',
            '<div class="eam-row" id="eco-reset-panel">',
              '<select id="eco-member-select" class="eam-select"></select>',
              '<button id="eco-reset-member" class="eam-btn">Réinit. membre</button>',
              '<button id="eco-reset-all-members" class="eam-btn eam-btn-danger">Tous</button>',
            '</div>',
            '<div class="eam-section-title">Cagnottes</div>',
            '<div class="eam-row">',
              '<select id="eco-cag-select" class="eam-select"></select>',
              '<button id="eco-reset-cagnotte" class="eam-btn">Réinit. cagnotte</button>',
              '<button id="eco-reset-all-cagnottes" class="eam-btn eam-btn-danger">Toutes</button>',
            '</div>',
          '</div>',

          // ── TRANSFERTS ──
          '<div class="eam-panel eam-panel-hidden" data-panel="transferts">',
            '<div class="eam-section-title">Entre cagnottes</div>',
            '<div class="eam-row" id="eco-transfer-box">',
              '<label class="eam-label">Débiter :</label>',
              '<select id="eco-transfer-from" class="eam-select"></select>',
              '<span class="eam-arrow">&#8594;</span>',
              '<label class="eam-label">Créditer :</label>',
              '<select id="eco-transfer-to" class="eam-select"></select>',
              '<input id="eco-transfer-amount" type="number" class="eam-input" placeholder="Montant"/>',
              '<button id="eco-transfer-btn" class="eam-btn eam-btn-primary">Transférer</button>',
            '</div>',
            '<div class="eam-section-title">Entre membres</div>',
            '<div class="eam-row" id="eco-transfer-member-panel">',
              '<label class="eam-label">De :</label>',
              '<select id="eco-transfer-from-member" class="eam-select"></select>',
              '<span class="eam-arrow">&#8594;</span>',
              '<label class="eam-label">Vers :</label>',
              '<select id="eco-transfer-to-member" class="eam-select"></select>',
              '<input id="eco-transfer-amount-member" type="number" class="eam-input" min="1" placeholder="Montant"/>',
              '<button id="eco-transfer-btn-member" class="eam-btn eam-btn-primary">Transférer</button>',
            '</div>',
            '<div class="eam-section-title">Cagnotte &#8594; Membre</div>',
            '<div class="eam-row" id="eco-transfer-cag-member">',
              '<label class="eam-label">Cagnotte :</label>',
              '<select id="eco-transfer-cag-to-member-from" class="eam-select"></select>',
              '<span class="eam-arrow">&#8594;</span>',
              '<label class="eam-label">Membre :</label>',
              '<select id="eco-transfer-cag-to-member-to" class="eam-select"></select>',
              '<input type="number" id="eco-transfer-cag-to-member-amount" class="eam-input" value="0"/>',
              '<button id="eco-transfer-cag-to-member-btn" class="eam-btn eam-btn-primary">Transférer</button>',
            '</div>',
          '</div>',

        '</div>',
      '</div>',
    '</div>'
  ].join("");

  // ── INJECTION ─────────────────────────────────────────────────
  // Même pattern que fl-modal : vérification parentNode avant déplacement.

  function creerModal() {
    if (document.getElementById(OVERLAY_ID)) return;
    var tmp = document.createElement("div");
    tmp.innerHTML = MODAL_HTML;
    var overlay = tmp.firstChild;
    document.body.appendChild(overlay);
    console.log(MODULE, "Overlay injecté sur body.");
  }

  // ── OUVERTURE / FERMETURE ─────────────────────────────────────
  // classList.add/remove('active') — aligné sur fl-modal.

  function ouvrir() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    // Sécurité : s'assurer que l'overlay est bien sur body
    if (overlay.parentNode !== document.body) {
      document.body.appendChild(overlay);
    }
    overlay.classList.add("active");
    document.documentElement.style.overflow = "hidden";
  }

  function fermer() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.remove("active");
    // Double reset — couvre tous les navigateurs (Correction 2 fl-modal)
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  // ── ONGLETS ───────────────────────────────────────────────────

  function activerOnglet(tabName) {
    document.querySelectorAll(".eam-tab").forEach(function (btn) {
      var actif = btn.getAttribute("data-tab") === tabName;
      btn.classList.toggle("eam-tab-active", actif);
      btn.setAttribute("aria-selected", actif ? "true" : "false");
    });
    document.querySelectorAll(".eam-panel").forEach(function (panel) {
      panel.classList.toggle("eam-panel-hidden", panel.getAttribute("data-panel") !== tabName);
    });
  }

  // ── ÉVÉNEMENTS ───────────────────────────────────────────────

  function bindEvents() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    // Fermer via ✕
    var closeBtn = document.getElementById("eco-admin-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", fermer);

    // Fermer via clic overlay (hors modal)
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) fermer();
    });

    // Fermer via Echap
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("active")) fermer();
    });

    // Onglets — délégation sur la barre
    var tabsBar = overlay.querySelector(".eam-tabs");
    if (tabsBar) {
      tabsBar.addEventListener("click", function (e) {
        var btn = e.target.closest(".eam-tab");
        if (btn) activerOnglet(btn.getAttribute("data-tab"));
      });
    }

    // Bouton déclencheur — délégation sur document (résiste aux re-rendus FA)
    document.addEventListener("click", function (e) {
      if (e.target.closest("#" + TRIGGER_ID)) ouvrir();
    });
  }

  // ── INIT ─────────────────────────────────────────────────────
  // DOMContentLoaded — aligné sur fl-modal.

  function init() {
    chargerFlaticon();
    creerModal();
    bindEvents();
    console.log(MODULE, "Prêt.");
  }

  document.addEventListener("DOMContentLoaded", init);

  // API publique
  window.EcoAdminModal = { ouvrir: ouvrir, fermer: fermer };

})();
