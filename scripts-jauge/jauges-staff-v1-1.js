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

  // ---------- INIT ----------

  function toutPret() {
    return !!(
      window.EcoCore &&
      window.EcoCore.firebaseGet &&
      window.EcoCore.writeField &&
      window.EcoCore.getPseudo &&
      window.TDLJauges &&
      window.TDLJauges.CFG
    );
  }

   /* [MAJ] Sans garde, le poll tourne 20 s sur chaque page. Renseigne le NUMÉRO
     du sujet du panneau staff ; 0 = aucune garde. */
  var TOPIC = 73;                        // ← à renseigner
  function demarrerPoll() {
    if (TOPIC && !new RegExp("/t" + TOPIC + "(p\\d+)?[-/]").test(location.pathname)) return;
    
    var tentatives = 0;
    var MAX = 100;

    var _poll = setInterval(function () {
      tentatives++;
      if (tentatives > MAX) {
        clearInterval(_poll);
        console.warn(MODULE, "Timeout — container ou dépendances introuvables.");
        return;
      }

      var container = document.getElementById(CONTAINER_ID);
      if (!container) return;
      if (!toutPret())  return;

      clearInterval(_poll);
      setTimeout(function () {
        creerTooltip();
        verifierAcces(container);
      }, 300);
    }, 200);
  }

  if (document.readyState === "complete") {
    demarrerPoll();
  } else {
    window.addEventListener("load", demarrerPoll);
  }

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
    /* [MAJ] la seule branche jauges (~400 o) au lieu de la racine. */
    window.EcoCore.firebaseGet("jauges")
      .then(function (j) {
        _data = j || {};
        mettreAJourAffichage();
      })
      .catch(function (e) {
        console.error(MODULE, "Lecture Firebase :", e);
        var el = container.querySelector(".tdl-js-loading");
        if (el) el.textContent = "Erreur de chargement.";
      });
  }
    /* [MAJ] Transaction sur le delta, pas écriture d'une valeur absolue.
     _data est un instantané du chargement de page, et la confirmation peut
     rester ouverte plusieurs minutes : écrire « niveau 3 » écrasait sans
     bruit un passage à 4 décidé entre-temps par un collègue.
     On applique ±1 à la valeur SERVEUR, bornée à 1–5. */
  function ecrireNiveau(key, delta, annonce) {
    var obtenu = null;
    window.EcoCore.firebaseTransaction("jauges/" + key, function (cur) {
      var actuel = Math.min(5, Math.max(1, parseInt(cur && cur.niveau) || 1));
      obtenu = Math.min(5, Math.max(1, actuel + delta));
      return { niveau: obtenu, updated_at: new Date().toISOString() };
    })
      .then(function () {
        _data[key] = { niveau: obtenu, updated_at: new Date().toISOString() };
        mettreAJourAffichage();
        console.log(MODULE, "Jauge mise à jour :", key, "→", obtenu);
        if (annonce != null && obtenu !== annonce) {
          alert("La jauge était déjà à un autre niveau : elle est maintenant à "
              + obtenu + " (et non " + annonce + ").");
        }
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

    let html  = '<div class="mc-head"><h1>Équilibres de Terrebonne</h1>'
              + '<p>Panneau staff – mise à jour des jauges collectives</p></div>';
    html     += '<div class="sj-fiche tdl-js-panel">';

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
      ecrireNiveau(key, delta, suivant);
    });
  }

  function deleguerSurvol(e) {
    const seg = e.target.closest(".tdl-js-segment");
    if (!seg) return;
    const key  = seg.getAttribute("data-key");
    const n    = parseInt(seg.getAttribute("data-n"), 10);
    const entry = _data[key] || {};
    const nAct  = Math.min(5, Math.max(1, parseInt(entry.niveau) || 1));
    afficherTooltip(e, key, n, nAct);
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

  function afficherTooltip(e, key, n, nAct) {
    if (!_tooltip) return;
    _tooltip.innerHTML     = window.TDLJauges.construireTooltip(key, n, nAct);
    _tooltip.style.display = "block";
    deplacerTooltip(e);
  }

  function deplacerTooltip(e) {
    if (!_tooltip) return;
    _tooltip.style.left = (e.pageX + 14) + "px";
    _tooltip.style.top  = (e.pageY - 10) + "px";
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
