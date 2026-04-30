/*
 * recensement-absence.js — Panneau absences + formulaire de déclaration · TDL
 *
 * Résumé : Sur /t68-, affiche (a) le panneau public des absences en cours
 * (3 sections : présence réduite, absence, suppression), trié par date de fin
 * la plus proche ; (b) le formulaire de déclaration membre avec 3 types ;
 * (c) le panel admin sur chaque carte (prendre des nouvelles, prolonger, clôturer).
 * 0 CSS inline — tout dans recensement-absence.css. Firebase : versTableau partout.
 *
 * CARTE DES BLOCS :
 *   UTILS    — versTableau, helpers date, absence active, DC comptes
 *   SCEDITOR — preremplirReponse (délègue à DC si disponible)
 *   BBCODE   — messages staff → topic absence du membre
 *   PANEL    — rendu des 3 sections du panneau + cards
 *   ADMIN    — boutons de gestion par carte (staff)
 *   FORM     — formulaire de déclaration membre
 *   EVENTS   — soumissions, prolongation, clôture
 *   INIT     — window.RC.initAbsence
 */

(function () {
  "use strict";

  window.RC = window.RC || {};
  const T   = () => window.RC.T;
  const CFG = () => window.RC.CFG;
  const TYPES = () => CFG().TYPES_ABSENCE;

  /* === UTILS === */

  function versTableau(v) {
    return window.RC.Calcul?.versTableau(v) ?? (!v ? [] : Array.isArray(v) ? v : Object.values(v));
  }

  function today() { return new Date().toISOString().slice(0, 10); }
  function genId()  { return "abs_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5); }

  function absenceActive(rec, pseudo) {
    return versTableau(rec.absences)
      .find(a => a.pseudo === pseudo && a.statut === "en_cours") || null;
  }

  // Retourne les pseudos du groupe DC du membre (hors pseudo principal).
  // Utilisé pour les checkboxes de suppression partielle.
  function comptesMulti(rec, pseudo) {
    const groupes = rec.doubles_comptes || {};
    // Chercher si pseudo est racine ou membre d'un groupe
    if (groupes[pseudo]) return versTableau(groupes[pseudo].comptes).filter(c => c !== pseudo);
    for (const [racine, g] of Object.entries(groupes)) {
      const comptes = versTableau(g.comptes);
      if (comptes.includes(pseudo)) return comptes.filter(c => c !== pseudo).concat(racine === pseudo ? [] : [racine]);
    }
    return [];
  }

  function estExpire(abs) {
    if (!abs.fin) return false;
    const finDate = new Date(abs.fin);
    finDate.setDate(finDate.getDate() + (CFG().ALERTE_FIN_JOURS || 1));
    return new Date() >= finDate;
  }

  /* === SCEDITOR === */

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

  function bbcodeNouvellesAbsence(abs) {
    const typeLabel = {
      [TYPES().ABSENCE]:     "absence",
      [TYPES().REDUITE]:     "présence réduite",
      [TYPES().SUPPRESSION]: "demande de suppression",
    }[abs.type] || "absence";
    const finInfo = abs.fin ? `le ${abs.fin}` : "à une date indéfinie";
    return [
      `@"${abs.pseudo}"`,
      "",
      `[b]The Drowned Lands — nouvelles de ton ${typeLabel}[/b]`,
      "",
      `Ton ${typeLabel} devait se terminer ${finInfo}. L'équipe de TDL vient aux nouvelles :`,
      "es-tu de retour parmi nous, ou souhaites-tu prolonger ton absence ?",
      "",
      "Merci de nous tenir informés 🌿",
      "",
      "[size=85][i]— L'équipe de The Drowned Lands[/i][/size]",
    ].join("\n");
  }

  function bbcodeDeclaration(data) {
    const typeLabel = {
      [TYPES().ABSENCE]:     "absence totale",
      [TYPES().REDUITE]:     "présence réduite",
      [TYPES().SUPPRESSION]: "demande de suppression",
    }[data.type] || data.type;
    const lines = [
      `[b]━━━ Déclaration — ${typeLabel.toUpperCase()} ━━━[/b]`,
      `[b]Membre :[/b] @"${data.pseudo}"`,
      `[b]Début :[/b] ${data.debut}`,
    ];
    if (data.fin)        lines.push(`[b]Fin estimée :[/b] ${data.fin}`);
    if (data.lien_sujet) lines.push(`[b]Sujet d'absence :[/b] [url=${data.lien_sujet}]Lire le sujet[/url]`);
    if (data.type === TYPES().SUPPRESSION) {
      const comptes = data.suppression_totale
        ? "Suppression totale (tous les comptes)"
        : `Comptes : ${(data.suppression_comptes || []).join(", ")}`;
      lines.push(`[b]Suppression :[/b] ${comptes}`);
    }
    return lines.join("\n");
  }

  /* === PANEL — RENDU DES CARDS === */

  function creerCard(abs, zone, pseudo) {
    const card = document.createElement("div");
    card.className = "abs-card" + (estExpire(abs) ? " abs-card--expire" : "");
    card.dataset.absId = abs.id;

    const pseudoEl = document.createElement("strong");
    pseudoEl.className = "abs-card-pseudo";
    pseudoEl.textContent = abs.pseudo;

    const datesEl = document.createElement("span");
    datesEl.className = "abs-card-dates";
    datesEl.textContent = abs.fin ? `${abs.debut} → ${abs.fin}` : `Depuis le ${abs.debut}`;

    card.append(pseudoEl, datesEl);

    if (abs.lien_sujet) {
      const lien = document.createElement("a");
      lien.className = "abs-card-lien";
      lien.href = abs.lien_sujet;
      lien.target = "_blank";
      lien.textContent = "→ Voir le sujet";
      card.appendChild(lien);
    }

    // Admin : boutons de gestion
    if (estStaff()) card.appendChild(creerActionsAdmin(abs, zone, pseudo));

    return card;
  }

  function estStaff() {
    return CFG().STAFF_USERS.includes(window.EcoCore?.getPseudo?.() || "");
  }

  /* === ADMIN — boutons par card === */

  function creerActionsAdmin(abs, zone, pseudo) {
    const wrap = document.createElement("div");
    wrap.className = "abs-admin";

    // "Prendre des nouvelles" : visible uniquement si la date de fin est dépassée
    if (estExpire(abs) && abs.lien_sujet) {
      const btnNew = document.createElement("button");
      btnNew.className = "abs-btn abs-btn--nouvelles";
      btnNew.textContent = T().BTN_NOUVELLES;
      btnNew.addEventListener("click", () => {
        preremplirReponse(bbcodeNouvellesAbsence(abs));
        // Ouvre le sujet du membre dans un nouvel onglet pour faciliter le posting
        window.open(abs.lien_sujet, "_blank");
      });
      wrap.appendChild(btnNew);
    }

    // "Prolonger" : formulaire inline de nouvelle date
    const btnProl = document.createElement("button");
    btnProl.className = "abs-btn abs-btn--prolonger";
    btnProl.textContent = T().BTN_PROLONGER;
    const zoneDate = document.createElement("div");
    zoneDate.className = "abs-prolonger-zone";
    zoneDate.hidden = true;
    zoneDate.innerHTML = `
      <input type="date" class="abs-input-date" value="${abs.fin || today()}">
      <button class="abs-btn abs-btn--confirmer">${T().CONFIRMER_PROLONGATION}</button>`;
    btnProl.addEventListener("click", () => { zoneDate.hidden = !zoneDate.hidden; });
    zoneDate.querySelector(".abs-btn--confirmer").addEventListener("click", async () => {
      const nouvDate = zoneDate.querySelector(".abs-input-date").value;
      if (!nouvDate) return;
      await prolongerAbsence(abs.id, nouvDate, rec => {
        abs.fin = nouvDate; zoneDate.hidden = true;
        const card = wrap.closest(".abs-card");
        if (card) card.querySelector(".abs-card-dates").textContent = `${abs.debut} → ${nouvDate}`;
      });
    });
    wrap.append(btnProl, zoneDate);

    // "Absence terminée" : toujours disponible
    const btnCloture = document.createElement("button");
    btnCloture.className = "abs-btn abs-btn--cloturer";
    btnCloture.textContent = T().BTN_CLOTURER;
    btnCloture.addEventListener("click", async () => {
      await cloturerAbsence(abs.id);
      afficherPanneau(zone, pseudo);
    });
    wrap.appendChild(btnCloture);

    return wrap;
  }

  function creerSection(titre, absList, modCss, zone, pseudo) {
    if (!absList.length) return null;
    // Tri par date de fin la plus proche (indéfinie en dernier)
    const triees = [...absList].sort((a, b) => {
      if (!a.fin) return 1;
      if (!b.fin) return -1;
      return new Date(a.fin) - new Date(b.fin);
    });
    const section = document.createElement("section");
    section.className = `abs-section abs-section--${modCss}`;
    const h = document.createElement("h3");
    h.className = "abs-section-titre";
    h.textContent = `${titre} (${triees.length})`;
    const grille = document.createElement("div");
    grille.className = "abs-grille";
    triees.forEach(abs => grille.appendChild(creerCard(abs, zone, pseudo)));
    section.append(h, grille);
    return section;
  }

  /* === EVENTS — persistance Firebase === */

  async function prolongerAbsence(absId, nouvDate, onSuccess) {
    const rec      = await window.EcoCore.readBin();
    const absences = versTableau(rec.absences);
    const abs      = absences.find(a => a.id === absId);
    if (abs) { abs.fin = nouvDate; abs.prolongee = true; }
    rec.absences = absences;
    await window.EcoCore.writeBin(rec);
    onSuccess?.();
  }

  async function cloturerAbsence(absId) {
    const rec      = await window.EcoCore.readBin();
    const absences = versTableau(rec.absences);
    const abs      = absences.find(a => a.id === absId);
    if (abs) { abs.statut = "terminee"; abs.retour_le = new Date().toISOString(); }
    rec.absences = absences;
    await window.EcoCore.writeBin(rec);
  }

  async function soumettreDeclaration(data, zone, pseudo) {
    const rec = await window.EcoCore.readBin();
    const absences = versTableau(rec.absences);
    // Clore l'absence active précédente du même pseudo
    absences.forEach(a => {
      if (a.pseudo === pseudo && a.statut === "en_cours") a.statut = "remplacee";
    });
    absences.push({ ...data, id: genId(), statut: "en_cours", cree_le: new Date().toISOString() });
    rec.absences = absences;
    await window.EcoCore.writeBin(rec);
    preremplirReponse(bbcodeDeclaration(data));
    afficherPanneau(zone, pseudo);
  }

  /* === FORM === */

  function creerFormulaire(rec, pseudo, zone) {
    const form = document.createElement("div");
    form.className = "abs-form";

    const titre = document.createElement("h3");
    titre.className = "abs-form-titre";
    titre.textContent = "Déclarer une absence";
    form.appendChild(titre);

    // Sélecteur de type
    form.innerHTML += `
      <div class="abs-form-field">
        <label class="abs-form-label">${T().LABEL_TYPE}</label>
        <div class="abs-types">
          ${[
            [TYPES().REDUITE,     T().TYPE_LABEL_REDUITE,     T().TYPE_DESC_REDUITE],
            [TYPES().ABSENCE,     T().TYPE_LABEL_ABSENCE,     T().TYPE_DESC_ABSENCE],
            [TYPES().SUPPRESSION, T().TYPE_LABEL_SUPPRESSION, T().TYPE_DESC_SUPPRESSION],
          ].map(([val, lbl, desc]) => `
            <label class="abs-type-option">
              <input type="radio" name="abs-type" value="${val}">
              <span class="abs-type-nom">${lbl}</span>
              <span class="abs-type-desc">${desc}</span>
            </label>`).join("")}
        </div>
      </div>
      <div class="abs-form-field">
        <label class="abs-form-label">${T().LABEL_DEBUT}</label>
        <input id="abs-debut" type="date" class="abs-input-date" value="${today()}">
      </div>
      <div class="abs-form-field">
        <label class="abs-form-label">${T().LABEL_FIN}</label>
        <input id="abs-fin" type="date" class="abs-input-date">
      </div>
      <div class="abs-form-field">
        <label class="abs-form-label">${T().LABEL_LIEN}</label>
        <input id="abs-lien" type="url" class="abs-input-text" placeholder="https://…">
      </div>`;

    // Zone suppression DC (affichée uniquement pour type=suppression)
    const comptes = comptesMulti(rec, pseudo);
    const zoneDC = document.createElement("div");
    zoneDC.className = "abs-form-field abs-dc-zone";
    zoneDC.hidden = true;
    if (comptes.length) {
      zoneDC.innerHTML = `<label class="abs-form-label">${T().LABEL_COMPTES}</label>
        <label class="abs-dc-option"><input type="radio" name="abs-suppr" value="totale" checked> Tous mes comptes</label>
        ${comptes.map(c => `<label class="abs-dc-option"><input type="checkbox" class="abs-dc-check" value="${c}"> ${c}</label>`).join("")}`;
    } else {
      zoneDC.innerHTML = `<p class="abs-form-note">Suppression totale (aucun multi-compte détecté).</p>`;
    }
    form.appendChild(zoneDC);

    // Afficher/masquer la section DC selon le type sélectionné
    form.querySelectorAll("[name='abs-type']").forEach(r =>
      r.addEventListener("change", () => { zoneDC.hidden = r.value !== TYPES().SUPPRESSION; })
    );

    const btnEnvoi = document.createElement("button");
    btnEnvoi.className = "abs-btn abs-btn--soumettre";
    btnEnvoi.textContent = T().BTN_SOUMETTRE;
    btnEnvoi.addEventListener("click", () => {
      const type = form.querySelector("[name='abs-type']:checked")?.value;
      if (!type) return;
      const debut = form.querySelector("#abs-debut").value;
      const data = {
        pseudo,
        type,
        debut,
        fin:        form.querySelector("#abs-fin").value || null,
        lien_sujet: form.querySelector("#abs-lien").value.trim() || null,
        suppression_totale: type === TYPES().SUPPRESSION
          ? (!comptes.length || form.querySelector("[name='abs-suppr']:checked")?.value === "totale")
          : null,
        suppression_comptes: type === TYPES().SUPPRESSION
          ? [...form.querySelectorAll(".abs-dc-check:checked")].map(c => c.value)
          : null,
      };
      soumettreDeclaration(data, zone, pseudo);
    });

    const result = document.createElement("div");
    result.className = "abs-result";
    form.append(btnEnvoi, result);
    return form;
  }

  /* === AFFICHAGE === */

  async function afficherPanneau(zone, pseudo) {
    zone.innerHTML = "<p class='rc-chargement'>Chargement…</p>";
    const rec = await window.EcoCore.safeReadBin();
    if (!rec) { zone.innerHTML = `<p class='rc-erreur'>${T().ERR_DONNEES}</p>`; return; }
    zone.innerHTML = "";

    const absActives = versTableau(rec.absences)
      .filter(a => a.statut === "en_cours");

    const sectionData = [
      ["Présences réduites",        absActives.filter(a => a.type === TYPES().REDUITE),     "reduite"],
      ["Absences",                  absActives.filter(a => a.type === TYPES().ABSENCE),     "absence"],
      ["Demandes de suppression",   absActives.filter(a => a.type === TYPES().SUPPRESSION), "suppression"],
    ];

    sectionData.forEach(([titre, liste, mod]) => {
      const sec = creerSection(titre, liste, mod, zone, pseudo);
      if (sec) zone.appendChild(sec);
    });

    if (!absActives.length) {
      const vide = document.createElement("p");
      vide.className = "abs-vide";
      vide.textContent = "Aucune absence en cours. ✨";
      zone.appendChild(vide);
    }

    // Formulaire de déclaration — accessible à tout membre connecté
    if (pseudo && pseudo.toLowerCase() !== "anonymous") {
      const sep = document.createElement("hr");
      sep.className = "abs-separateur";
      zone.append(sep, creerFormulaire(rec, pseudo, zone));
    }
  }

  /* === INIT === */

  window.RC.initAbsence = function (zone) {
    const pseudo = window.EcoCore?.getPseudo?.();
    afficherPanneau(zone, pseudo || "");
  };

})();
