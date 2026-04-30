/*
 * recensement-render.js — Rendu du recensement et panel staff · TDL
 *
 * Résumé : S'injecte dans .zone-recensement sur /t66-. Affiche 4 colonnes live,
 * overrides staff (boutons ↑↓), génère le BBCode "en danger le 25" et le préremplit
 * automatiquement dans la réponse rapide SCEditor (même pattern que DC/fiche).
 * La liste reste dynamique après le 25 : tout RP jusqu'au 30/31 est comptabilisé.
 *
 * CARTE DES BLOCS :
 *   UTILS        — estStaff, tri, moisLabel
 *   SCEDITOR     — preremplirReponse (API SCEditor + fallback natif)
 *   BBCODE       — génération du bloc @mentions "en danger le 25"
 *   RENDER       — colonnes, boutons overrides
 *   EVENTS       — snapshot du 25, liste finale du 1er, overrides
 *   AFFICHAGE    — orchestration principale
 *   INIT         — point d'entrée window.RC.initRender
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
   * Préremplit le textarea SCEditor de la réponse rapide avec le BBCode.
   * Même implémentation que DC.preremplirReponse (eco-dc-utils.js) :
   * délègue à DC si disponible pour éviter toute duplication.
   * [MAJ] Sélecteur TEXTAREA_REPONSE et API sceditor fragiles aux mises à jour FA.
   */
  function preremplirReponse(texte) {
    if (window.DC?.preremplirReponse) { window.DC.preremplirReponse(texte); return; }

    const ta = document.querySelector(CFG().SEL.TEXTAREA_REPONSE);
    if (!ta) return;

    // Méthode 1 : API SCEditor — synchronise l'état interne de l'éditeur WYSIWYG [MAJ]
    if (window.sceditor) {
      const inst = window.sceditor.instance(ta);
      if (inst) {
        inst.val(texte);
        ta.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    // Méthode 2 : écriture native + events — fallback si SCEditor n'est pas chargé
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, texte);
    ta.dispatchEvent(new Event("input",  { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    ta.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* === BBCODE === */

  function genBBCodeDanger(pseudos, labelDate) {
    const lignes = trier(pseudos).map(p => `  • @"${p}"`).join("\n");
    return [
      `[b]━━━ ⚠️ MEMBRES EN DANGER — snapshot du ${labelDate} ━━━[/b]`,
      "",
      "[color=#b34700]Ces membres n'ont pas posté de RP entre le 1er et le 25 du mois.",
      "Vous avez jusqu'au dernier jour du mois pour régulariser votre situation.[/color]",
      "",
      lignes || "  (aucun)",
      "",
      "[size=85][i]Le staff vérifiera la liste définitive le 1er du mois prochain.[/i][/size]",
    ].join("\n");
  }

  /* === RENDER === */

  function creerColonne(titre, pseudos, couleur) {
    const div = document.createElement("div");
    div.className = "rc-col";
    div.style.cssText = `flex:1;min-width:175px;border-left:3px solid ${couleur};padding:0 12px 12px;`;
    const h = document.createElement("h4");
    h.style.cssText = `color:${couleur};margin:0 0 8px;font-size:.93em;`;
    h.textContent = `${titre} (${pseudos.length})`;
    const ul = document.createElement("ul");
    ul.style.cssText = "list-style:none;padding:0;margin:0;font-size:.9em;";
    trier(pseudos).forEach(p => {
      const li = document.createElement("li");
      li.dataset.pseudo = p;
      li.style.cssText = "display:flex;align-items:center;gap:5px;padding:2px 0;";
      li.innerHTML = `<span>${p}</span>`;
      ul.appendChild(li);
    });
    div.append(h, ul);
    return div;
  }

  function ajouterBtnOverride(colonne, cibleOverride, rec, moisKey, zone) {
    if (!estStaff()) return;
    const label = cibleOverride === "recense" ? T().BTN_VERS_RECENSE : T().BTN_VERS_DANGER;
    colonne.querySelectorAll("li[data-pseudo]").forEach(li => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.style.cssText = "font-size:.7em;padding:1px 4px;cursor:pointer;opacity:.65;";
      btn.addEventListener("click", async () => {
        const r   = await window.EcoCore.readBin();
        const snp = (r.recensement = r.recensement || {})[moisKey] =
          r.recensement[moisKey] || {};
        (snp.overrides_staff = snp.overrides_staff || {})[li.dataset.pseudo] = cibleOverride;
        await window.EcoCore.writeBin(r);
        afficherRecensement(zone); // re-render complet après override
      });
      li.appendChild(btn);
    });
  }

  /* === EVENTS === */

  async function genererSnapshot(rec, moisKey, listes, zone) {
    const snp = (rec.recensement = rec.recensement || {})[moisKey] =
      rec.recensement[moisKey] || {};
    const now = new Date();

    // Snapshot figé : arrays stockés comme tableaux vrais (Firebase les re-sérialisera,
    // versTableau() les normalisera à la relecture — cf. recensement-calcul.js)
    snp.genere_le       = now.toISOString();
    snp.genere_le_label = now.toLocaleDateString("fr-FR");
    snp.recenses        = [...listes.recenses];
    snp.en_danger_25    = [...listes.danger];
    snp.absents         = [...listes.absents];

    await window.EcoCore.writeBin(rec);

    // Préremplissage automatique de la réponse rapide SCEditor avec le BBCode
    const bbcode = genBBCodeDanger(snp.en_danger_25, snp.genere_le_label);
    preremplirReponse(bbcode);

    afficherRecensement(zone);
  }

  async function finaliserListe(rec, moisKey, listes, zone) {
    rec.recensement[moisKey].liste_finale_1er = [...listes.danger];
    rec.recensement[moisKey].finalise_le      = new Date().toISOString();
    await window.EcoCore.writeBin(rec);
    afficherRecensement(zone);
  }

  function creerPanelStaff(rec, moisKey, listes, zone) {
    const panel = document.createElement("div");
    panel.style.cssText =
      "border:1px solid #ccc;padding:12px;margin-top:16px;background:#f9f9f9;border-radius:4px;";
    panel.innerHTML = "<h4 style='margin:0 0 10px;'>🔐 Actions staff — Recensement</h4>";

    const jourd = new Date().getDate();
    const snp   = rec.recensement?.[moisKey];

    if (jourd === CFG().JOUR_RECENSEMENT && !snp?.genere_le) {
      const btn = document.createElement("button");
      btn.textContent = T().BTN_GENERER;
      btn.style.cssText = "padding:6px 12px;cursor:pointer;";
      btn.addEventListener("click", () => genererSnapshot(rec, moisKey, listes, zone));
      panel.appendChild(btn);
      panel.innerHTML += `<p style="font-size:.82em;color:#666;margin:6px 0 0;">
        Le BBCode sera automatiquement copié dans la réponse rapide ci-dessous.</p>`;
    } else if (snp?.genere_le) {
      panel.innerHTML += `<p style="color:#2a7a2a;font-size:.9em;">${T().DEJA_GENERE(snp.genere_le_label)}</p>`;
    } else {
      panel.innerHTML += `<p style="color:#999;font-size:.85em;">${T().PAS_LE_25}</p>`;
    }

    // Bouton liste finale — disponible uniquement le 1er du mois suivant
    if (jourd === 1 && snp?.en_danger_25 && !snp?.liste_finale_1er) {
      const btn2 = document.createElement("button");
      btn2.textContent = T().BTN_FINALISER;
      btn2.style.cssText = "padding:6px 12px;cursor:pointer;margin-top:8px;display:block;";
      btn2.addEventListener("click", () => finaliserListe(rec, moisKey, listes, zone));
      panel.appendChild(btn2);
    }

    return panel;
  }

  /* === AFFICHAGE === */

  async function afficherRecensement(zone) {
    zone.innerHTML = "<p style='color:#888;font-size:.9em;'>Chargement du recensement…</p>";
    const rec = await window.EcoCore.safeReadBin();
    if (!rec) { zone.innerHTML = `<p>${T().ERR_DONNEES}</p>`; return; }

    const now     = new Date();
    const moisKey = window.RC.Calcul.cleMois(now);
    const snp     = rec.recensement?.[moisKey];

    zone.innerHTML = `<h3 style="margin:0 0 12px;">Recensement — ${moisLabel(now)}</h3>`;

    // Listes calculées en live (intègre les RPs postés jusqu'au dernier jour du mois)
    let listes = window.RC.Calcul.calculerListes(rec, now);
    if (snp?.overrides_staff) {
      listes = window.RC.Calcul.appliquerOverrides(listes, snp.overrides_staff);
    }

    const grille = document.createElement("div");
    grille.style.cssText = "display:flex;flex-wrap:wrap;gap:14px;margin-bottom:14px;";

    const colR = creerColonne(T().TITRE_RECENSES, listes.recenses, "#2a7a2a");
    const colD = creerColonne(T().TITRE_DANGER,   listes.danger,   "#b34700");
    const colA = creerColonne(T().TITRE_ABSENTS,  listes.absents,  "#666");
    const colN = creerColonne(T().TITRE_NOUVEAUX, listes.nouveaux, "#1a5fa8");

    // Les overrides staff ne s'appliquent qu'entre Recensés ↔ En danger
    ajouterBtnOverride(colD, "recense", rec, moisKey, zone);
    ajouterBtnOverride(colR, "danger",  rec, moisKey, zone);

    grille.append(colR, colD, colA, colN);
    zone.appendChild(grille);

    if (estStaff()) zone.appendChild(creerPanelStaff(rec, moisKey, listes, zone));
  }

  /* === INIT === */

  window.RC.initRender = function (zone) { afficherRecensement(zone); };

})();
