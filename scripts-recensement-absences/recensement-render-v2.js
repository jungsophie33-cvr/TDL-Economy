/*
 * recensement-render.js — Rendu du recensement et panel staff · TDL
 *
 * Résumé : Affiche 5 colonnes live sur /t66-. Overrides staff (↑↓),
 * colonne "Futurs repas du Doyen" (suppressions), snapshot du 25 avec
 * préremplissage SCEditor automatique. 0 CSS inline — voir recensement.css.
 *
 * CARTE DES BLOCS :
 *   UTILS    — estStaff, tri, moisLabel
 *   SCEDITOR — preremplirReponse (API SCEditor + fallback natif)
 *   BBCODE   — génération du bloc @mentions "menacés le 25"
 *   RENDER   — colonnes, boutons overrides
 *   EVENTS   — snapshot du 25, liste finale du 1er
 *   AFFICHAGE — orchestration principale
 *   INIT     — window.RC.initRender
 */

(function () {
  "use strict";

  window.RC = window.RC || {};
  const CFG  = () => window.RC.CFG;
  const T    = () => window.RC.T;
  const trier = arr => [...arr].sort((a, b) => a.localeCompare(b, "fr"));

  /* === UTILS === */

  function estStaff() {
    return CFG().STAFF_USERS.includes(window.EcoCore?.getPseudo?.() || "");
  }

  function moisLabel(date) {
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }

  /* === SCEDITOR === */

  /*
   * Même pattern que DC.preremplirReponse (eco-dc-utils.js) — délègue si disponible.
   * [MAJ] Sélecteur TEXTAREA_REPONSE et API sceditor fragiles aux mises à jour FA.
   */
  function preremplirReponse(texte) {
    if (window.DC?.preremplirReponse) { window.DC.preremplirReponse(texte); return; }
    const ta = document.querySelector(CFG().SEL.TEXTAREA_REPONSE);
    if (!ta) return;
    if (window.sceditor) {
      const inst = window.sceditor.instance(ta);
      if (inst) { inst.val(texte); ta.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, texte);
    ta.dispatchEvent(new Event("input",  { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    ta.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* === BBCODE === */

  function genBBCodeMenaces(pseudos, labelDate) {
    const lignes = trier(pseudos).map(p => `  • @"${p}"`).join("\n");
    return [
      `[b]━━━ ⚠️ MENACÉS PAR LE DOYEN — snapshot du ${labelDate} ━━━[/b]`,
      "",
      "[color=#7b1f1f]Ces membres n'ont pas posté de RP entre le 1er et le 25 du mois.",
      "Vous avez jusqu'au dernier jour du mois pour régulariser votre situation.[/color]",
      "",
      lignes || "  (aucun)",
      "",
      "[size=85][i]Liste définitive publiée le 1er du mois prochain.[/i][/size]",
    ].join("\n");
  }

  /* === RENDER === */

  function creerColonne(titre, pseudos, modCss) {
    const div = document.createElement("div");
    div.className = `rc-col rc-col--${modCss}`;
    const h = document.createElement("p");
    h.className = `rc-col-titre rc-col-titre--${modCss}`;
    h.textContent = `${titre} (${pseudos.length})`;
    const ul = document.createElement("div");
    ul.className = "rc-col-liste";
    trier(pseudos).forEach(p => {
      const li = document.createElement("span");
      li.className = "rc-col-item";
      li.dataset.pseudo = p;
      li.textContent = p;
      ul.appendChild(li);
    });
    div.append(h, ul);
    return div;
  }

  function ajouterBtnOverride(colonne, cibleOverride, rec, moisKey, zone) {
    if (!estStaff()) return;
    const label = cibleOverride === "recense" ? T().BTN_VERS_RECENSE : T().BTN_VERS_MENACE;
    colonne.querySelectorAll(".rc-col-item[data-pseudo]").forEach(item => {
      const btn = document.createElement("button");
      btn.className = "rc-btn-override";
      btn.textContent = label;
      btn.addEventListener("click", async () => {
        const r   = await window.EcoCore.readBin();
        const snp = (r.recensement = r.recensement || {})[moisKey] =
          r.recensement[moisKey] || {};
        (snp.overrides_staff = snp.overrides_staff || {})[item.dataset.pseudo] = cibleOverride;
        await window.EcoCore.writeBin(r);
        afficherRecensement(zone);
      });
      item.appendChild(btn);
    });
  }

  /* === EVENTS === */

  async function genererSnapshot(rec, moisKey, listes, zone) {
    const snp = (rec.recensement = rec.recensement || {})[moisKey] =
      rec.recensement[moisKey] || {};
    const now = new Date();
    Object.assign(snp, {
      genere_le:       now.toISOString(),
      genere_le_label: now.toLocaleDateString("fr-FR"),
      recenses:        [...listes.recenses],
      menaces_25:      [...listes.menaces],   // Anciennement en_danger_25
      absents:         [...listes.absents],
      suppressions:    [...listes.suppressions],
    });
    await window.EcoCore.writeBin(rec);
    preremplirReponse(genBBCodeMenaces(snp.menaces_25, snp.genere_le_label));
    afficherRecensement(zone);
  }

  async function finaliserListe(rec, moisKey, listes, zone) {
    rec.recensement[moisKey].liste_finale_1er = [...listes.menaces];
    rec.recensement[moisKey].finalise_le      = new Date().toISOString();
    await window.EcoCore.writeBin(rec);
    afficherRecensement(zone);
  }

  function creerPanelStaff(rec, moisKey, listes, zone) {
    const panel = document.createElement("div");
    panel.className = "rc-staff-panel";

    const titre = document.createElement("p");
    titre.className = "rc-staff-titre";
    titre.textContent = "🔐 Actions staff — Recensement";
    panel.appendChild(titre);

    const jourd = new Date().getDate();
    const snp   = rec.recensement?.[moisKey];

    if (jourd === CFG().JOUR_RECENSEMENT && !snp?.genere_le) {
      const btn = document.createElement("button");
      btn.className = "rc-btn-action";
      btn.textContent = T().BTN_GENERER;
      btn.addEventListener("click", () => genererSnapshot(rec, moisKey, listes, zone));
      const note = document.createElement("p");
      note.className = "rc-staff-note";
      note.textContent = "Le BBCode sera automatiquement inséré dans la réponse rapide.";
      panel.append(btn, note);
    } else if (snp?.genere_le) {
      const info = document.createElement("p");
      info.className = "rc-staff-ok";
      info.textContent = T().DEJA_GENERE(snp.genere_le_label);
      panel.appendChild(info);
    } else {
      const info = document.createElement("p");
      info.className = "rc-staff-note";
      info.textContent = T().PAS_LE_25;
      panel.appendChild(info);
    }

    if (jourd === 1 && snp?.menaces_25 && !snp?.liste_finale_1er) {
      const btn2 = document.createElement("button");
      btn2.className = "rc-btn-action";
      btn2.textContent = T().BTN_FINALISER;
      btn2.addEventListener("click", () => finaliserListe(rec, moisKey, listes, zone));
      panel.appendChild(btn2);
    }
    return panel;
  }

  /* === AFFICHAGE === */

  // Invalidate le cache avant une relecture pour avoir des données fraîches.
  // safeReadBin() utilise un cache sessionStorage 60s — on le vide pour le polling.
  function lireFrais() {
    window.EcoCore.invalidateCache?.();
    return window.EcoCore.readBin();
  }

  async function afficherRecensement(zone) {
    // Préserver la barre de statut si elle existe déjà (évite le flash au refresh)
    const ancienStatut = zone.querySelector(".rc-statut");
    if (!ancienStatut) zone.innerHTML = "<p class='rc-chargement'>Chargement du recensement…</p>";

    const rec = await lireFrais();
    if (!rec) { zone.innerHTML = `<p class='rc-erreur'>${T().ERR_DONNEES}</p>`; return; }

    const now     = new Date();
    const moisKey = window.RC.Calcul.cleMois(now);
    const snp     = rec.recensement?.[moisKey];

    zone.innerHTML = "";

    // En-tête : titre + horodatage + bouton de rafraîchissement manuel
    const entete = document.createElement("div");
    entete.className = "rc-entete";

    const titre = document.createElement("h3");
    titre.className = "rc-titre-mois";
    titre.textContent = `Recensement — ${moisLabel(now)}`;

    const statut = document.createElement("span");
    statut.className = "rc-statut";
    statut.textContent = `Mis à jour à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

    const btnRefresh = document.createElement("button");
    btnRefresh.className = "rc-btn-refresh";
    btnRefresh.title = "Rafraîchir maintenant";
    btnRefresh.textContent = "↻";
    // Rafraîchissement manuel — utile entre deux cycles de polling
    btnRefresh.addEventListener("click", () => afficherRecensement(zone));

    entete.append(titre, statut, btnRefresh);
    zone.appendChild(entete);

    let listes = window.RC.Calcul.calculerListes(rec, now);
    if (snp?.overrides_staff) listes = window.RC.Calcul.appliquerOverrides(listes, snp.overrides_staff);

    const grille = document.createElement("div");
    grille.className = "rc-grille";

    const colR = creerColonne(T().TITRE_RECENSES,    listes.recenses,    "recenses");
    const colM = creerColonne(T().TITRE_MENACES,     listes.menaces,     "menaces");
    const colA = creerColonne(T().TITRE_ABSENTS,     listes.absents,     "absents");
    const colN = creerColonne(T().TITRE_NOUVEAUX,    listes.nouveaux,    "nouveaux");
    const colS = creerColonne(T().TITRE_SUPPRESSION, listes.suppressions,"suppression");

    ajouterBtnOverride(colM, "recense", rec, moisKey, zone);
    ajouterBtnOverride(colR, "menace",  rec, moisKey, zone);

    grille.append(colR, colM, colA, colN, colS);
    zone.appendChild(grille);

    if (estStaff()) zone.appendChild(creerPanelStaff(rec, moisKey, listes, zone));
  }

  /* === INIT === */

  // POLL_INTERVAL : rafraîchissement automatique toutes les 5 minutes.
  // Garantit que la liste reste à jour même si la page est laissée ouverte.
  // La liste s'actualise aussi à chaque chargement de page (comportement de base).
  const POLL_INTERVAL_MS = 5 * 60 * 1000;

  window.RC.initRender = function (zone) {
    afficherRecensement(zone);
    // Le polling est lancé une seule fois par session de page
    setInterval(() => afficherRecensement(zone), POLL_INTERVAL_MS);
  };

})();
