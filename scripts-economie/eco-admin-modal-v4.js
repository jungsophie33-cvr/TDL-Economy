// === ECO ADMIN MODAL — AUTONOME ===
// Auteur : Claude x THE DROWNED LANDS
// Flaticon CDN déjà chargé dans <head> — aucun chargement dynamique ici.
// HTML injecté immédiatement dans l'IIFE (pas de callback).

(function () {
  "use strict";

  var MODULE     = "[EcoAdminModal]";
  var TRIGGER_ID = "eco-admin-modal-trigger";
  var OVERLAY_ID = "eco-admin-modal-overlay";

  // ── HTML DU MODAL ────────────────────────────────────────────────
  var ARR = '<i class="fi fi-rr-angle-double-small-right eam-arrow" aria-hidden="true"></i>';

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

            '<f4 class="eam-section-title">Globale</f4>',
            '<div class="eam-row" id="eco-admin-giveall">',
              '<input type="number" id="eco-giveall-amount" class="eam-input" min="1" value="10"/>',
              '<button id="eco-giveall-btn" class="eam-btn eam-btn-primary">Distribuer à tous</button>',
            '</div>',

            '<f4 class="eam-section-title">Individuelle</f4>',
            '<div class="eam-row" id="eco-adjust-box">',
              '<select id="eco-adjust-member" class="eam-select"></select>',
              '<input id="eco-adjust-amount" type="number" class="eam-input" placeholder="Montant (+ ou -)"/>',
              '<button id="eco-adjust-btn" class="eam-btn eam-btn-primary">Valider</button>',
            '</div>',
            '<p class="eam-hint">Positif pour ajouter, négatif pour retirer.</p>',

          '</div>',

          // ── RÉINITIALISATIONS ──
          '<div class="eam-panel eam-panel-hidden" data-panel="reinit">',

            '<f4 class="eam-section-title">Membres</f4>',
            '<div class="eam-row" id="eco-reset-panel">',
              '<select id="eco-member-select" class="eam-select eam-select-wide"></select>',
              '<button id="eco-reset-member" class="eam-btn">Réinit. membre</button>',
              '<button id="eco-reset-all-members" class="eam-btn eam-btn-danger">Tous</button>',
            '</div>',

            '<f4 class="eam-section-title">Cagnottes</f4>',
            '<div class="eam-row">',
              '<select id="eco-cag-select" class="eam-select eam-select-wide"></select>',
              '<button id="eco-reset-cagnotte" class="eam-btn">Réinit. cagnotte</button>',
              '<button id="eco-reset-all-cagnottes" class="eam-btn eam-btn-danger">Toutes</button>',
            '</div>',

          '</div>',

          // ── TRANSFERTS ──
          '<div class="eam-panel eam-panel-hidden" data-panel="transferts">',

            '<f4 class="eam-section-title">Entre cagnottes</f4>',
            '<div class="eam-row" id="eco-transfer-box">',
              '<select id="eco-transfer-from" class="eam-select"></select>',
              ARR,
              '<select id="eco-transfer-to" class="eam-select"></select>',
              '<input id="eco-transfer-amount" type="number" class="eam-input" placeholder="Montant"/>',
              '<button id="eco-transfer-btn" class="eam-btn eam-btn-primary">Transférer</button>',
            '</div>',

            '<f4 class="eam-section-title">Entre membres</f4>',
            '<div class="eam-row" id="eco-transfer-member-panel">',
              '<select id="eco-transfer-from-member" class="eam-select"></select>',
              ARR,
              '<select id="eco-transfer-to-member" class="eam-select"></select>',
              '<input id="eco-transfer-amount-member" type="number" class="eam-input" min="1" placeholder="Montant"/>',
              '<button id="eco-transfer-btn-member" class="eam-btn eam-btn-primary">Transférer</button>',
            '</div>',

            '<f4 class="eam-section-title">Cagnotte &#8594; Membre</f4>',
            '<div class="eam-row" id="eco-transfer-cag-member">',
              '<select id="eco-transfer-cag-to-member-from" class="eam-select"></select>',
              ARR,
              '<select id="eco-transfer-cag-to-member-to" class="eam-select"></select>',
              '<input type="number" id="eco-transfer-cag-to-member-amount" class="eam-input" placeholder="Montant"/>',
              '<button id="eco-transfer-cag-to-member-btn" class="eam-btn eam-btn-primary">Transférer</button>',
            '</div>',

          '</div>',

        '</div>',
      '</div>',
    '</div>'
  ].join("");

  // ── INJECTION ────────────────────────────────────────────────────
  function creerModal() {
    if (document.getElementById(OVERLAY_ID)) return;
    var tmp = document.createElement("div");
    tmp.innerHTML = MODAL_HTML;
    document.body.appendChild(tmp.firstChild);
    console.log(MODULE, "Overlay injecté sur body.");
  }

  // ── OUVERTURE ────────────────────────────────────────────────────
  function ouvrir() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    if (overlay.parentNode !== document.body) document.body.appendChild(overlay);
    overlay.classList.add("active");
    document.documentElement.style.overflow = "hidden";
    populerSelects();
  }

  // ── FERMETURE ────────────────────────────────────────────────────
  function fermer() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.remove("active");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  // ── ONGLETS ──────────────────────────────────────────────────────
  function activerOnglet(tabName) {
    document.querySelectorAll(".eam-tab").forEach(function (btn) {
      var actif = btn.getAttribute("data-tab") === tabName;
      btn.classList.toggle("eam-tab-active", actif);
      btn.setAttribute("aria-selected", String(actif));
    });
    document.querySelectorAll(".eam-panel").forEach(function (panel) {
      panel.classList.toggle("eam-panel-hidden", panel.getAttribute("data-panel") !== tabName);
    });
  }

  // ── POPULATION DES SELECTS ────────────────────────────────────────
  function populerSelects() {
    var core = window.EcoCore;
    if (!core || !core.safeReadBin) return;
    core.safeReadBin().then(function (rec) {
      if (!rec) return;
      var membres = Object.keys(rec.membres || {}).sort();
      var groupes = Object.keys(rec.cagnottes || {});

      function remplir(id, items) {
        var sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = items.map(function (v) {
          return '<option value="' + v + '">' + v + '</option>';
        }).join("");
      }

      ["eco-adjust-member", "eco-member-select",
       "eco-transfer-from-member", "eco-transfer-to-member",
       "eco-transfer-cag-to-member-to"].forEach(function (id) { remplir(id, membres); });

      ["eco-cag-select", "eco-transfer-from",
       "eco-transfer-to", "eco-transfer-cag-to-member-from"].forEach(function (id) { remplir(id, groupes); });

    }).catch(function (e) { console.warn(MODULE, "populerSelects :", e); });
  }

  // ── LISTENERS BOUTONS ADMIN ───────────────────────────────────────
  function bindBoutonsAdmin() {
    var c = function () { return window.EcoCore; };

    var giveAll = document.getElementById("eco-giveall-btn");
    if (giveAll) {
      giveAll.addEventListener("click", async function () {
        var val = parseInt(document.getElementById("eco-giveall-amount")?.value, 10);
        if (isNaN(val) || val <= 0) return alert("Montant invalide.");
        var core = c(); if (!core) return;
        if (!confirm("Ajouter " + val + " " + core.MONNAIE_NAME + " à tous ?")) return;
        var rec = await core.readBin(); var count = 0;
        for (var n in rec.membres) { rec.membres[n].dollars = (rec.membres[n].dollars || 0) + val; count++; }
        await core.writeBin(rec);
        if (core.showEcoGain) core.showEcoGain(val);
        if (window.EcoUI?.updatePostDollars) window.EcoUI.updatePostDollars();
        alert(val + " " + core.MONNAIE_NAME + " ajoutés à " + count + " membres.");
      });
    }

    var adjustBtn = document.getElementById("eco-adjust-btn");
    if (adjustBtn) {
      adjustBtn.addEventListener("click", async function () {
        var membre  = document.getElementById("eco-adjust-member")?.value;
        var montant = parseInt(document.getElementById("eco-adjust-amount")?.value, 10);
        if (!membre) return alert("Aucun membre sélectionné.");
        if (isNaN(montant) || montant === 0) return alert("Montant invalide.");
        if (!confirm((montant > 0 ? "Ajouter " : "Retirer ") + Math.abs(montant) + " à " + membre + " ?")) return;
        var core = c(); if (!core) return;
        var rec = await core.readBin();
        if (!rec.membres[membre]) return alert("Membre inconnu.");
        rec.membres[membre].dollars = Math.max(0, (rec.membres[membre].dollars || 0) + montant);
        await core.writeBin(rec);
        alert("✅ Solde de " + membre + " mis à jour (" + (montant > 0 ? "+" : "") + montant + ").");
      });
    }

    document.getElementById("eco-reset-member")?.addEventListener("click", async function () {
      var choix = document.getElementById("eco-member-select")?.value;
      if (!choix) return alert("Aucun membre sélectionné.");
      if (!confirm("Remettre " + choix + " à 0 ?")) return;
      var core = c(); if (!core) return;
      var rec = await core.readBin();
      if (!rec.membres[choix]) return alert("Membre inconnu.");
      rec.membres[choix].dollars = 0;
      await core.writeBin(rec);
      alert(choix + " réinitialisé.");
    });

    document.getElementById("eco-reset-all-members")?.addEventListener("click", async function () {
      if (!confirm("⚠️ Réinitialiser TOUS les membres ?")) return;
      var core = c(); if (!core) return;
      var rec = await core.readBin();
      for (var m in rec.membres) rec.membres[m].dollars = 0;
      await core.writeBin(rec);
      alert("Tous les membres remis à 0.");
    });

    document.getElementById("eco-reset-cagnotte")?.addEventListener("click", async function () {
      var choix = document.getElementById("eco-cag-select")?.value;
      if (!choix) return alert("Aucune cagnotte sélectionnée.");
      if (!confirm("Remettre " + choix + " à 0 ?")) return;
      var core = c(); if (!core) return;
      var rec = await core.readBin();
      rec.cagnottes[choix] = 0;
      await core.writeBin(rec);
      alert("Cagnotte " + choix + " réinitialisée.");
    });

    document.getElementById("eco-reset-all-cagnottes")?.addEventListener("click", async function () {
      if (!confirm("⚠️ Remettre toutes les cagnottes à 0 ?")) return;
      var core = c(); if (!core) return;
      var rec = await core.readBin();
      for (var g in rec.cagnottes) rec.cagnottes[g] = 0;
      await core.writeBin(rec);
      alert("Toutes les cagnottes remises à 0.");
    });

    document.getElementById("eco-transfer-btn")?.addEventListener("click", async function () {
      var from    = document.getElementById("eco-transfer-from")?.value;
      var to      = document.getElementById("eco-transfer-to")?.value;
      var montant = parseInt(document.getElementById("eco-transfer-amount")?.value, 10);
      if (!from || !to || from === to) return alert("Sélection invalide (groupes identiques ?)");
      if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");
      var core = c(); if (!core) return;
      var rec = await core.readBin();
      if ((rec.cagnottes[from] || 0) < montant) return alert("Fonds insuffisants dans " + from + ".");
      if (!confirm("Transférer " + montant + " de " + from + " → " + to + " ?")) return;
      rec.cagnottes[from] -= montant;
      rec.cagnottes[to] = (rec.cagnottes[to] || 0) + montant;
      if (!rec.transactions_cagnottes) rec.transactions_cagnottes = [];
      rec.transactions_cagnottes.push({ date: new Date().toISOString(), de: from, vers: to, montant: montant, effectué_par: core.getPseudo() });
      await core.writeBin(rec);
      alert("✅ " + montant + " transférés de " + from + " vers " + to + ".");
      var elF = document.getElementById("eco-cag-" + from.replace(/\s/g, "_"));
      var elT = document.getElementById("eco-cag-" + to.replace(/\s/g, "_"));
      if (elF) elF.textContent = rec.cagnottes[from];
      if (elT) elT.textContent = rec.cagnottes[to];
    });

    document.getElementById("eco-transfer-btn-member")?.addEventListener("click", async function () {
      var from    = document.getElementById("eco-transfer-from-member")?.value;
      var to      = document.getElementById("eco-transfer-to-member")?.value;
      var montant = parseInt(document.getElementById("eco-transfer-amount-member")?.value, 10);
      if (!from || !to || from === to) return alert("Sélection invalide (mêmes membres ?)");
      if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");
      var core = c(); if (!core) return;
      var rec = await core.readBin();
      if (!rec.membres[from] || !rec.membres[to]) return alert("Membre inconnu.");
      if ((rec.membres[from].dollars || 0) < montant) return alert(from + " n'a pas assez de fonds.");
      if (!confirm("Transférer " + montant + " de " + from + " → " + to + " ?")) return;
      rec.membres[from].dollars -= montant;
      rec.membres[to].dollars = (rec.membres[to].dollars || 0) + montant;
      if (!rec.transactions_membres) rec.transactions_membres = [];
      rec.transactions_membres.push({ date: new Date().toISOString(), de: from, vers: to, montant: montant, effectué_par: core.getPseudo() });
      await core.writeBin(rec);
      alert("✅ " + montant + " transférés de " + from + " à " + to + ".");
      if (window.EcoUI?.updatePostDollars) window.EcoUI.updatePostDollars();
    });

    document.getElementById("eco-transfer-cag-to-member-btn")?.addEventListener("click", async function () {
      var from    = document.getElementById("eco-transfer-cag-to-member-from")?.value;
      var to      = document.getElementById("eco-transfer-cag-to-member-to")?.value;
      var montant = parseInt(document.getElementById("eco-transfer-cag-to-member-amount")?.value, 10);
      if (!from || !to) return alert("Sélection invalide.");
      if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");
      var core = c(); if (!core) return;
      var rec = await core.readBin();
      if ((rec.cagnottes[from] || 0) < montant) return alert("Fonds insuffisants dans la cagnotte " + from + ".");
      if (!rec.membres[to]) return alert("Membre inconnu.");
      if (!confirm("Transférer " + montant + " de " + from + " vers " + to + " ?")) return;
      rec.cagnottes[from] -= montant;
      rec.membres[to].dollars = (rec.membres[to].dollars || 0) + montant;
      if (!rec.transactions_cagnotte_membre) rec.transactions_cagnotte_membre = [];
      rec.transactions_cagnotte_membre.push({ date: new Date().toISOString(), de: from, vers: to, montant: montant, effectué_par: core.getPseudo() });
      await core.writeBin(rec);
      alert("✅ " + montant + " transférés de " + from + " à " + to + ".");
      var elF = document.getElementById("eco-cag-" + from.replace(/\s/g, "_"));
      if (elF) elF.textContent = rec.cagnottes[from];
      if (window.EcoUI?.updatePostDollars) window.EcoUI.updatePostDollars();
    });

    console.log(MODULE, "Boutons admin câblés.");
  }

  // ── EVENTS MODAL ──────────────────────────────────────────────────
  function bindEvents() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    document.getElementById("eco-admin-modal-close")
      ?.addEventListener("click", fermer);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) fermer();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("active")) fermer();
    });

    overlay.querySelector(".eam-tabs")
      ?.addEventListener("click", function (e) {
        var btn = e.target.closest(".eam-tab");
        if (btn) activerOnglet(btn.getAttribute("data-tab"));
      });

    document.addEventListener("click", function (e) {
      if (e.target.closest("#" + TRIGGER_ID)) ouvrir();
    });
  }

  // ── INIT IMMÉDIAT ────────────────────────────────────────────────
  creerModal();
  bindEvents();
  bindBoutonsAdmin();
  console.log(MODULE, "Prêt.");

  window.EcoAdminModal = { ouvrir: ouvrir, fermer: fermer };

})();
