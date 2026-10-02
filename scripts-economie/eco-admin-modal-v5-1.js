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
        core.invalidateCache();
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
        core.invalidateCache();
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
        core.invalidateCache();
      alert(choix + " réinitialisé.");
    });

    document.getElementById("eco-reset-all-members")?.addEventListener("click", async function () {
      if (!confirm("⚠️ Réinitialiser TOUS les membres ?")) return;
      var core = c(); if (!core) return;
      var rec = await core.readBin();
      for (var m in rec.membres) rec.membres[m].dollars = 0;
      await core.writeBin(rec);
        core.invalidateCache();
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
        core.invalidateCache();
      alert("Cagnotte " + choix + " réinitialisée.");
    });

    document.getElementById("eco-reset-all-cagnottes")?.addEventListener("click", async function () {
      if (!confirm("⚠️ Remettre toutes les cagnottes à 0 ?")) return;
      var core = c(); if (!core) return;
      var rec = await core.readBin();
      for (var g in rec.cagnottes) rec.cagnottes[g] = 0;
      await core.writeBin(rec);
        core.invalidateCache();
      alert("Toutes les cagnottes remises à 0.");
    });

      /* Transfert atomique entre deux chemins numériques, puis journal.
     [MAJ] Remplace le motif readBin → mutation → writeBin, qui relisait et
     réécrivait la racine pour ajouter une ligne, et qui est devenu impossible
     depuis que les journaux mêlent clés numériques et clés push.
     Débit d'abord (contrôle de fonds refait côté serveur), crédit ensuite ;
     si le crédit échoue, le débit est repris — l'argent ne disparaît jamais. */
  async function transferer(o) {
    var core = c(); if (!core) throw new Error("ECOCORE");
    var m = o.montant | 0;
    await core.firebaseTransaction(o.cheminDe, function (cur) {
      var s = cur || 0; if (s < m) throw new Error("FONDS"); return s - m;
    });
    try {
      await core.firebaseTransaction(o.cheminVers, function (cur) { return (cur || 0) + m; });
    } catch (e) {
      await core.firebaseTransaction(o.cheminDe, function (cur) { return (cur || 0) + m; }).catch(function () {});
      throw new Error("CREDIT");
    }
    core.firebasePush(o.journal, {
      date: new Date().toISOString(), type: "transfert",
      de: o.de, vers: o.vers, montant: m, motif: "",
      "effectué_par": core.getPseudo()
    }).catch(function () {});   // le journal ne doit jamais faire échouer le transfert
  }

  function messageErreur(e, source) {
    if (e && e.message === "FONDS")  return "Fonds insuffisants dans " + source + ".";
    if (e && e.message === "CREDIT") return "Crédit impossible — transfert annulé, rien n'a bougé.";
    return "Transfert impossible.";
  }

  function majCagnotteAffichee(nom) {
    var core = c(); if (!core || !core.lireFrais) return;
    core.lireFrais("cagnottes/" + encodeURIComponent(nom)).then(function (v) {
      var el = document.getElementById("eco-cag-" + nom.replace(/\s/g, "_"));
      if (el) el.textContent = v || 0;
    }).catch(function () {});
  }
    
    document.getElementById("eco-transfer-btn")?.addEventListener("click", async function () {
      var from = document.getElementById("eco-transfer-from")?.value;
      var to   = document.getElementById("eco-transfer-to")?.value;
      var montant = parseInt(document.getElementById("eco-transfer-amount")?.value, 10);
      if (!from || !to || from === to) return alert("Sélection invalide (groupes identiques ?)");
      if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");
      if (!confirm("Transférer " + montant + " de " + from + " → " + to + " ?")) return;
      try {
        await transferer({
          cheminDe:   "cagnottes/" + encodeURIComponent(from),
          cheminVers: "cagnottes/" + encodeURIComponent(to),
          montant: montant, de: from, vers: to, journal: "transactions_cagnottes"
        });
      } catch (e) { console.error(e); return alert(messageErreur(e, from)); }
      alert("✅ " + montant + " transférés de " + from + " vers " + to + ".");
      majCagnotteAffichee(from); majCagnotteAffichee(to);
    });

    document.getElementById("eco-transfer-btn-member")?.addEventListener("click", async function () {
      var from = document.getElementById("eco-transfer-from-member")?.value;
      var to   = document.getElementById("eco-transfer-to-member")?.value;
      var montant = parseInt(document.getElementById("eco-transfer-amount-member")?.value, 10);
      if (!from || !to || from === to) return alert("Sélection invalide (mêmes membres ?)");
      if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");
      if (!confirm("Transférer " + montant + " de " + from + " → " + to + " ?")) return;
      try {
        await transferer({
          cheminDe:   "membres/" + encodeURIComponent(from) + "/dollars",
          cheminVers: "membres/" + encodeURIComponent(to)   + "/dollars",
          montant: montant, de: from, vers: to, journal: "transactions_membres"
        });
      } catch (e) { console.error(e); return alert(messageErreur(e, from)); }
      alert("✅ " + montant + " transférés de " + from + " à " + to + ".");
      if (window.EcoUI?.updatePostDollars) window.EcoUI.updatePostDollars();
    });

    document.getElementById("eco-transfer-cag-to-member-btn")?.addEventListener("click", async function () {
      var from = document.getElementById("eco-transfer-cag-to-member-from")?.value;
      var to   = document.getElementById("eco-transfer-cag-to-member-to")?.value;
      var montant = parseInt(document.getElementById("eco-transfer-cag-to-member-amount")?.value, 10);
      if (!from || !to) return alert("Sélection invalide.");
      if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");
      if (!confirm("Transférer " + montant + " de la cagnotte " + from + " → " + to + " ?")) return;
      try {
        await transferer({
          cheminDe:   "cagnottes/" + encodeURIComponent(from),
          cheminVers: "membres/"   + encodeURIComponent(to) + "/dollars",
          montant: montant, de: from, vers: to, journal: "transactions_cagnotte_membre"
        });
      } catch (e) { console.error(e); return alert(messageErreur(e, from)); }
      alert("✅ " + montant + " transférés de la cagnotte " + from + " à " + to + ".");
      majCagnotteAffichee(from);
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
