/* === JAUGES DE TERREBONNE — PANNEAU STAFF ===
   Auteur : Claude x THE DROWNED LANDS

   Montre l'état RÉEL des trois jauges (retour au calme et passage différé
   compris), la charge accumulée et les échéances, et le journal des derniers
   mouvements. Le réglage direct d'un niveau reste possible, pour ce qui n'est
   pas un évent : il exige un motif, remet la charge à zéro, n'entre pas dans
   le plafond hebdomadaire, et s'écrit au journal.

   Lectures : jauges/ et jauges_journal/, rien d'autre. Écritures : par le
   moteur seul, en transaction sur la jauge visée.

   DÉPEND DE : jauges-core (TDLJauges), jauges-moteur (TDLJaugesMoteur),
               eco-core (EcoCore), tdl-base (TDLBase)
   ANCRAGE : <div id="tdl-jauges-staff"></div>
   CSS : jauges.css (bloc PANNEAU STAFF)

   CARTE DES BLOCS : CONFIG · TEXTES · INIT · DONNÉES · RENDU · JOURNAL
                     · ÉVÉNEMENTS · TOOLTIP · CONFIRMATION */

(function () {
  "use strict";

  /* ===================== CONFIG ===================== */

  var MODULE = "[JaugesStaff]";
  var CONTAINER_ID = "tdl-jauges-staff";
  /* [MAJ] NUMÉRO du sujet du panneau staff ; 0 = aucune garde. */
  var TOPIC = 73;
  var NB_JOURNAL = 15;

  var _tooltip = null, _confirm = null, _data = {}, _container = null;

  function J() { return window.TDLJauges; }
  function M() { return window.TDLJaugesMoteur; }

  /* ===================== TEXTES ===================== */

  var T = {
    TITRE:     "Équilibres de Terrebonne",
    SOUS:      "Panneau staff de gestion",
    REFUS:     "Accès réservé au staff.",
    CHARGE:    "Chargement…",
    ERREUR:    "Erreur de chargement.",
    NIVEAU:    "Niveau ",
    SUIVANT:   "Niveau suivant le ",
    CALME:     "Retour au calme le ",
    PLAFOND:   "Plafond hebdomadaire jusqu'au ",
    AUCUN_MVT: "Aucune modification enregistrée.",
    DERNIERE:  "Dernière modification : ",
    JOURNAL:   "Derniers mouvements",
    JOURNAL_V: "Aucun mouvement au journal.",
    TYPES:     { versement: "Versement", bascule: "Bascule", reglage: "Réglage direct" },
    MONTER:    "monter", DESCENDRE: "descendre",
    MOTIF:     "Motif du réglage",
    MOTIF_A:   "Obligatoire. Il reste au journal des jauges.",
    MOTIF_E:   "Indiquez un motif.",
    OK:        "Confirmer", ANNULER: "Annuler",
    DEJA:      function (n) { return "La jauge avait déjà évolué entre-temps : elle est maintenant au niveau " + n + "."; },
    ECHEC:     "Le réglage n'a pas été enregistré. Vérifiez la console."
  };

  /* ===================== INIT ===================== */

  function toutPret() {
    return !!(window.EcoCore && window.EcoCore.firebaseGet && window.EcoCore.getPseudo
      && window.TDLBase && J() && J().etat && M() && M().pret());
  }

  function demarrerPoll() {
    if (TOPIC && !new RegExp("/t" + TOPIC + "(p\\d+)?[-/]").test(location.pathname)) return;
    var tentatives = 0;
    var poll = setInterval(function () {
      if (++tentatives > 100) { clearInterval(poll); console.warn(MODULE, "Timeout — container ou dépendances introuvables."); return; }
      var c = document.getElementById(CONTAINER_ID);
      if (!c || !toutPret()) return;
      clearInterval(poll);
      _container = c;
      creerTooltip();
      verifierAcces();
    }, 200);
  }

  if (document.readyState === "complete") demarrerPoll();
  else window.addEventListener("load", demarrerPoll);

  function verifierAcces() {
    var pseudo = window.EcoCore.getPseudo();
    var admins = window.EcoCore.ADMIN_USERS || [];
    if (!pseudo || admins.indexOf(pseudo) < 0) {
      _container.innerHTML = '<p class="tdl-js-access-denied">' + T.REFUS + '</p>';
      return;
    }
    render();
    charger();
  }

  /* ===================== DONNÉES ===================== */

  function charger() {
    return Promise.all([M().lireBrut(), M().lireJournal(NB_JOURNAL)])
      .then(function (r) {
        _data = r[0] || {};
        mettreAJour();
        rendJournal(r[1] || []);
      })
      .catch(function (e) {
        console.error(MODULE, "Lecture Firebase :", e);
        var el = _container.querySelector(".tdl-js-journal-liste");
        if (el) el.textContent = T.ERREUR;
      });
  }

  function regler(key, delta, attendu, motif) {
    M().regler(key, delta, motif).then(function (r) {
      if (r && r.apres && r.apres.niveau !== attendu) alert(T.DEJA(r.apres.niveau));
      return charger();
    }).catch(function (e) {
      console.error(MODULE, "Réglage :", e);
      alert(T.ECHEC);
    });
  }

  /* ===================== RENDU ===================== */

  function render() {
    var html = '<div class="mc-head"><h1>' + T.TITRE + '</h1><p>' + T.SOUS + '</p></div>'
             + '<div class="sj-fiche tdl-js-panel">';

    J().KEYS.forEach(function (key) {
      var c = J().CFG[key];
      html += '<div class="tdl-js-bloc" data-key="' + key + '">'
        + '<div class="tdl-js-bloc-header">'
        +   '<span class="tdl-js-bloc-label" style="color:' + c.color + '">' + c.label + '</span>'
        +   '<span class="tdl-js-bloc-info" id="js-info-' + key + '">' + T.CHARGE + '</span>'
        + '</div>'
        + '<div class="tdl-js-bloc-controls">'
        +   '<button class="tdl-js-btn" data-key="' + key + '" data-delta="-1" aria-label="Baisser">−</button>'
        +   '<div class="tdl-js-segments">';
      for (var i = 1; i <= 5; i++) {
        html += '<div class="tdl-js-segment" id="js-seg-' + key + '-' + i + '"'
              + ' data-key="' + key + '" data-n="' + i + '" role="img" aria-label="Niveau ' + i + '"></div>';
      }
      html += '</div>'
        +   '<button class="tdl-js-btn" data-key="' + key + '" data-delta="1" aria-label="Monter">+</button>'
        + '</div>'
        + '<div class="tdl-js-etat" id="js-etat-' + key + '"></div>'
        + '<div class="tdl-js-last" id="js-last-' + key + '"></div>'
        + '</div>';
    });

    html += '<div class="tdl-js-journal"><p class="tdl-js-journal-h">' + T.JOURNAL + '</p>'
          + '<div class="tdl-js-journal-liste">' + T.CHARGE + '</div></div>'
          + '</div>';
    _container.innerHTML = html;

    _container.addEventListener("click",     deleguerClic);
    _container.addEventListener("mouseover", deleguerSurvol);
    _container.addEventListener("mouseout",  deleguerSortie);
    _container.addEventListener("mousemove", deleguerDeplacement);
  }

  function niveauReel(key) { return J().etat(_data[key]).niveau; }

  function mettreAJour() {
    J().KEYS.forEach(function (key) {
      var entry = _data[key] || {}, e = J().etat(entry), c = J().CFG[key];

      var info = document.getElementById("js-info-" + key);
      if (info) info.textContent = T.NIVEAU + e.niveau + " — " + c.niveaux[e.niveau - 1].label;

      for (var i = 1; i <= 5; i++) {
        var seg = document.getElementById("js-seg-" + key + "-" + i);
        if (!seg) continue;
        seg.style.backgroundColor = (i <= e.niveau) ? c.color : "";
        seg.classList.toggle("tdl-js-seg-active", i <= e.niveau);
      }

      var lignes = [J().charge(e.charge)];
      if (e.attente)       lignes.push(T.SUIVANT + J().jour(e.passageLe));
      if (e.decrueLe)      lignes.push(T.CALME + J().jour(e.decrueLe));
      if (e.plafondJusqua) lignes.push(T.PLAFOND + J().jour(e.plafondJusqua));
      var et = document.getElementById("js-etat-" + key);
      if (et) et.innerHTML = lignes.map(function (l) {
        return '<span class="tdl-js-etat-i">' + l + '</span>';
      }).join("");

      var last = document.getElementById("js-last-" + key);
      if (last) {
        if (entry.updated_at) {
          var d = new Date(entry.updated_at);
          last.textContent = T.DERNIERE + d.toLocaleDateString("fr-FR") + " à "
            + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        } else last.textContent = T.AUCUN_MVT;
      }
    });
  }

  /* ===================== JOURNAL ===================== */

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function ligneJournal(x) {
    var e = x.v || {}, c = J().CFG[e.jauge] || {};
    var quoi = (T.TYPES[e.type] || e.type)
      + (e.type === "versement" ? " de " + J().fraction(e.points) + (e.sens === "apaise" ? " en apaisement" : " en aggravation") : "")
      + (e.titre ? ", « " + e.titre + " »" : "");
    var effet = (e.avant && e.apres)
      ? (e.franchi ? "niveau " + e.avant.niveau + " → " + e.apres.niveau
                   : "niveau " + e.apres.niveau + ", " + J().charge(e.apres.charge))
      : "";
    return '<div class="tdl-js-jl">'
      + '<span class="tdl-js-jl-date">' + esc(J().jour(e.le)) + '</span>'
      + '<span class="tdl-js-jl-jauge">' + esc(c.label || e.jauge) + '</span>'
      + '<span class="tdl-js-jl-quoi">' + esc(quoi)
      + (e.motif ? '<span class="tdl-js-jl-motif">' + esc(e.motif) + '</span>' : '') + '</span>'
      + '<span class="tdl-js-jl-effet">' + esc(effet) + '</span>'
      + '<span class="tdl-js-jl-par">' + esc(e.par || "") + '</span>'
      + '</div>';
  }

  function rendJournal(liste) {
    var box = _container.querySelector(".tdl-js-journal-liste");
    if (!box) return;
    box.innerHTML = liste.length
      ? liste.map(ligneJournal).join("")
      : '<p class="tdl-js-journal-v">' + T.JOURNAL_V + '</p>';
  }

  /* ===================== ÉVÉNEMENTS ===================== */

  function deleguerClic(e) {
    var btn = e.target.closest("[data-delta]");
    if (!btn) return;
    var key = btn.getAttribute("data-key");
    var delta = parseInt(btn.getAttribute("data-delta"), 10);
    var actuel = niveauReel(key);
    var suivant = Math.min(5, Math.max(1, actuel + delta));
    if (suivant === actuel) return;
    var cfg = J().CFG[key];
    var texte = cfg.label + " : " + (delta > 0 ? T.MONTER : T.DESCENDRE) + " au niveau "
              + suivant + " (" + cfg.niveaux[suivant - 1].label + ")";
    afficherConfirmation(texte, function (motif) { regler(key, delta, suivant, motif); });
  }

  function deleguerSurvol(e) {
    var seg = e.target.closest(".tdl-js-segment");
    if (!seg) return;
    var key = seg.getAttribute("data-key");
    afficherTooltip(e, key, parseInt(seg.getAttribute("data-n"), 10), niveauReel(key));
  }
  function deleguerSortie(e) { if (e.target.closest(".tdl-js-segment")) cacherTooltip(); }
  function deleguerDeplacement(e) { if (e.target.closest(".tdl-js-segment")) deplacerTooltip(e); }

  /* ===================== TOOLTIP ===================== */

  function creerTooltip() {
    if (_tooltip) return;
    _tooltip = document.createElement("div");
    _tooltip.className = "tdl-js-tooltip";
    _tooltip.style.display = "none";
    document.body.appendChild(_tooltip);          /* contexte d'empilement FA */
  }
  function afficherTooltip(e, key, n, nAct) {
    if (!_tooltip) return;
    _tooltip.innerHTML = J().construireTooltip(key, n, nAct);
    _tooltip.style.display = "block";
    deplacerTooltip(e);
  }
  function deplacerTooltip(e) {
    if (!_tooltip) return;
    _tooltip.style.left = (e.pageX + 14) + "px";
    _tooltip.style.top  = (e.pageY - 10) + "px";
  }
  function cacherTooltip() { if (_tooltip) _tooltip.style.display = "none"; }

  /* ===================== CONFIRMATION ===================== */
  /* Reparentée sur <body>. Le motif est obligatoire : sans lui, Confirmer
     ne part pas. */

  function fermerConfirmation() {
    if (_confirm) _confirm.remove();
    _confirm = null;
    document.documentElement.style.overflow = "";
  }

  function afficherConfirmation(message, onOk) {
    fermerConfirmation();
    _confirm = document.createElement("div");
    _confirm.className = "tdl-js-overlay";
    _confirm.innerHTML =
        '<div class="tdl-js-confirm-box">'
      +   '<p class="tdl-js-confirm-msg">' + esc(message) + '</p>'
      +   '<label class="tdl-js-motif-l" for="tdl-js-motif">' + T.MOTIF + '</label>'
      +   '<textarea class="tdl-js-motif" id="tdl-js-motif" rows="3"></textarea>'
      +   '<p class="tdl-js-motif-a" id="tdl-js-motif-a">' + T.MOTIF_A + '</p>'
      +   '<button class="tdl-js-confirm-btn tdl-js-confirm-ok" data-c="ok">' + T.OK + '</button>'
      +   '<button class="tdl-js-confirm-btn tdl-js-confirm-cancel" data-c="non">' + T.ANNULER + '</button>'
      + '</div>';
    document.body.appendChild(_confirm);
    document.documentElement.style.overflow = "hidden";   /* iOS : sur <html> */

    _confirm.addEventListener("click", function (e) {
      var b = e.target.closest("[data-c]");
      if (!b) return;
      if (b.getAttribute("data-c") === "non") { fermerConfirmation(); return; }
      var motif = String(document.getElementById("tdl-js-motif").value || "").trim();
      if (!motif) {
        var a = document.getElementById("tdl-js-motif-a");
        a.textContent = T.MOTIF_E;
        a.classList.add("est-erreur");
        return;
      }
      fermerConfirmation();
      onOk(motif);
    });
    var champ = document.getElementById("tdl-js-motif");
    if (champ) champ.focus();
  }

  console.log("[TDLJauges] Panneau staff chargé.");

})();
