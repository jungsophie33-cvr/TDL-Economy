// === JAUGES DE TERREBONNE — PANNEAU STAFF ===
// Auteur : Claude x THE DROWNED LANDS
// Panneau de gestion des jauges collectives — usage staff uniquement.
// Dépendances : jauges-core.js, eco-core2.js (window.EcoCore)
// Ancrage DOM : <div id="tdl-jauges-staff"></div>

(function () {
  "use strict";

  const MODULE = "[JaugesStaff]";
  const CONTAINER_ID = "tdl-jauges-staff";

  // Elements globaux déplacés sur document.body (escape stacking context FA)
  let _tooltip        = null;
  let _confirmOverlay = null;

  // Cache local des données lues depuis Firebase
  let _data = {};

  // ---------- INIT (pattern eco-dc-init.js : poll 200ms + délai 600ms) ----------

  function toutPret() {
    return !!(
      window.EcoCore &&
      window.EcoCore.safeReadBin &&
      window.EcoCore.writeField &&
      window.EcoCore.getPseudo &&
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
      verifierAcces(container);
    }, 600);
  }, 200);

  // ---------- ACCÈS STAFF ----------

  function verifierAcces(container) {
    const pseudo = window.EcoCore.getPseudo();
    const admins = window.EcoCore.ADMIN_USERS || [];
    if (!pseudo || !admins.includes(pseudo)) {
      container.innerHTML = '<p class="tdl-js-access-denied">Accès réservé au staff.</p>';
      return;
    }
    render(container);
    chargerDonnees(container);
  }

  // ---------- FIREBASE ----------

  function chargerDonnees(container) {
    window.EcoCore.safeReadBin()
      .then(function (rec) {
        _data = (rec && rec.jauges) ? rec.jauges : {};
        mettreAJourAffichage();
      })
      .catch(function (e) {
        console.error(MODULE, "Lecture Firebase :", e);
        container.querySelector(".tdl-js-loading") &&
          (container.querySelector(".tdl-js-loading").textContent = "Erreur de chargement.");
      });
  }

  function ecrireNiveau(key, nouveau) {
    const payload = {
      niveau    : nouveau,
      updated_at: new Date().toISOString()
    };
    window.EcoCore.writeField("jauges/" + key, payload)
      .then(function () {
        _data[key] = payload;
        mettreAJourAffichage();
        console.log(MODULE, "Jauge mise à jour :", key, "→", nouveau);
      })
      .catch(function (e) {
        console.error(MODULE, "Écriture Firebase :", e);
        alert("Erreur lors de la sauvegarde. Vérifiez la console.");
      });
  }

  // ---------- RENDER ----------

  function render(container) {
    const keys = window.TDLJauges.KEYS;
    const cfg  = window.TDLJauges.CFG;

    let html = '<div class="tdl-js-panel">';
    html    += '<h3 class="tdl-js-title">⚖ Équilibres de Terrebonne</h3>';
    html    += '<p class="tdl-js-subtitle">Panneau staff · mise à jour des jauges collectives</p>';

    keys.forEach(function (key) {
      const c = cfg[key];
      html += '<div class="tdl-js-bloc" data-key="' + key + '">';

      // En-tête : nom + libellé du niveau actuel
      html += '<div class="tdl-js-bloc-header">';
      html += '<span class="tdl-js-bloc-label" style="color:' + c.color + '">' + c.label + '</span>';
      html += '<span class="tdl-js-bloc-info" id="js-info-' + key + '">Chargement…</span>';
      html += '</div>';

      // Contrôles : bouton − · segments · bouton +
      html += '<div class="tdl-js-bloc-controls">';
      html += '<button class="tdl-js-btn" data-key="' + key + '" data-delta="-1" aria-label="Baisser">−</button>';
      html += '<div class="tdl-js-segments">';
      for (let i = 1; i <= 5; i++) {
        html += '<div class="tdl-js-segment" id="js-seg-' + key + '-' + i + '"'
              + ' data-key="' + key + '" data-n="' + i + '"'
              + ' role="img" aria-label="Niveau ' + i + '"></div>';
      }
      html += '</div>';
      html += '<button class="tdl-js-btn" data-key="' + key + '" data-delta="1" aria-label="Monter">+</button>';
      html += '</div>';

      // Horodatage
      html += '<div class="tdl-js-last" id="js-last-' + key + '"></div>';
      html += '</div>'; // .tdl-js-bloc
    });

    html += '</div>'; // .tdl-js-panel
    container.innerHTML = html;

    // Délégation événements — data-* uniquement (pas d'onclick inline)
    container.addEventListener("click",     deleguerClic);
    container.addEventListener("mouseover", deleguerSurvol);
    container.addEventListener("mouseout",  deleguerSortie);
    container.addEventListener("mousemove", deleguerDeplacement);
  }

  function mettreAJourAffichage() {
    const keys = window.TDLJauges.KEYS;
    const cfg  = window.TDLJauges.CFG;

    keys.forEach(function (key) {
      const entry = _data[key] || {};
      const n     = Math.min(5, Math.max(1, parseInt(entry.niveau) || 1));
      const c     = cfg[key];
      const nDef  = c.niveaux[n - 1];

      // Label info
      const info = document.getElementById("js-info-" + key);
      if (info) info.textContent = "Niveau " + n + " — " + nDef.label;

      // Segments
      for (let i = 1; i <= 5; i++) {
        const seg = document.getElementById("js-seg-" + key + "-" + i);
        if (!seg) continue;
        if (i <= n) {
          seg.style.backgroundColor = c.color;
          seg.classList.add("tdl-js-seg-active");
        } else {
          seg.style.backgroundColor = "";
          seg.classList.remove("tdl-js-seg-active");
        }
      }

      // Horodatage
      const last = document.getElementById("js-last-" + key);
      if (last) {
        if (entry.updated_at) {
          const d = new Date(entry.updated_at);
          last.textContent = "Dernière modification : "
            + d.toLocaleDateString("fr-FR")
            + " à "
            + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        } else {
          last.textContent = "Aucune modification enregistrée.";
        }
      }
    });
  }

  // ---------- DÉLÉGATION ÉVÉNEMENTS ----------

  function deleguerClic(e) {
    const btn = e.target.closest("[data-delta]");
    if (!btn) return;
    const key   = btn.getAttribute("data-key");
    const delta = parseInt(btn.getAttribute("data-delta"), 10);
    const entry = _data[key] || {};
    const actuel = Math.min(5, Math.max(1, parseInt(entry.niveau) || 1));
    const suivant = Math.min(5, Math.max(1, actuel + delta));
    if (suivant === actuel) return;

    const cfg  = window.TDLJauges.CFG[key];
    const dir  = delta > 0 ? "monter" : "descendre";
    const texte = cfg.label + " : " + dir + " au niveau " + suivant
                + " (" + cfg.niveaux[suivant - 1].label + ")";

    afficherConfirmation(texte, function () {
      ecrireNiveau(key, suivant);
    });
  }

  function deleguerSurvol(e) {
    const seg = e.target.closest(".tdl-js-segment");
    if (!seg) return;
    const key  = seg.getAttribute("data-key");
    const n    = parseInt(seg.getAttribute("data-n"), 10);
    const nDef = window.TDLJauges.CFG[key].niveaux[n - 1];
    afficherTooltip(e, "Niveau " + n + " — " + nDef.label + " : " + nDef.desc);
  }

  function deleguerSortie(e) {
    if (!e.target.closest(".tdl-js-segment")) return;
    cacherTooltip();
  }

  function deleguerDeplacement(e) {
    if (!e.target.closest(".tdl-js-segment")) return;
    deplacerTooltip(e);
  }

  // ---------- TOOLTIP ----------

  function creerTooltip() {
    if (_tooltip) return;
    _tooltip = document.createElement("div");
    _tooltip.className    = "tdl-js-tooltip";
    _tooltip.style.display = "none";
    document.body.appendChild(_tooltip); // escape stacking context ForumActif
  }

  function afficherTooltip(e, texte) {
    if (!_tooltip) return;
    _tooltip.textContent   = texte;
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

  // ---------- CONFIRMATION (déplacée sur body) ----------

  function afficherConfirmation(message, onOk) {
    if (_confirmOverlay) _confirmOverlay.remove();

    _confirmOverlay = document.createElement("div");
    _confirmOverlay.className = "tdl-js-overlay";

    const boite = document.createElement("div");
    boite.className = "tdl-js-confirm-box";

    const msg = document.createElement("p");
    msg.className   = "tdl-js-confirm-msg";
    msg.textContent = message;

    const btnOk = document.createElement("button");
    btnOk.className   = "tdl-js-confirm-btn tdl-js-confirm-ok";
    btnOk.textContent = "Confirmer";

    const btnAnnuler = document.createElement("button");
    btnAnnuler.className   = "tdl-js-confirm-btn tdl-js-confirm-cancel";
    btnAnnuler.textContent = "Annuler";

    btnOk.addEventListener("click", function () {
      onOk();
      _confirmOverlay.remove();
      _confirmOverlay = null;
    });

    btnAnnuler.addEventListener("click", function () {
      _confirmOverlay.remove();
      _confirmOverlay = null;
    });

    boite.appendChild(msg);
    boite.appendChild(btnOk);
    boite.appendChild(btnAnnuler);
    _confirmOverlay.appendChild(boite);
    document.body.appendChild(_confirmOverlay); // escape stacking context ForumActif
  }

  console.log("[TDLJauges] Staff module chargé.");

})();
