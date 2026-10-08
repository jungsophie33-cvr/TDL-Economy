/*
 * recensement-absence.js — Panneau absences + formulaire de déclaration · TDL
 *
 * Résumé : Sur le sujet des absences, affiche (a) le panneau public des
 * absences en cours (3 sections : présence réduite, absence, suppression),
 * trié par date de fin la plus proche ; (b) le formulaire de déclaration membre
 * avec 3 types ; (c) le panel admin sur chaque carte (prendre des nouvelles,
 * prolonger, clôturer). 0 CSS inline — tout dans recensement-absence.css.
 *
 * [MAJ v2] absences DEVIENT UN NŒUD À CLÉS.
 *   C'était un TABLEAU réécrit en bloc par les trois écritures du fichier :
 *   readBin → find(id) → mutation → writeBin. Deux admins clôturant deux
 *   absences dans la même minute : la seconde écriture, partie d'un instantané
 *   antérieur, effaçait la première. Un membre déclarant son absence pendant
 *   qu'un admin en prolongeait une autre : même perte, dans un sens ou l'autre.
 *   Chaque absence porte désormais sa clé et s'écrit seule.
 *   La conversion se fait d'elle-même, atomiquement, au premier écrit qui
 *   rencontre encore un tableau.
 *
 * [MAJ v2] PLUS DE LECTURE DE RACINE. afficherPanneau appelait safeReadBin()
 *   pour deux branches qui pèsent ensemble moins de 2 ko.
 *
 * [MAJ v2] GARDE D'URL : sans elle, recensement-init boucle 30 s sur chaque
 *   page du forum avant d'abandonner.
 *
 * LECTURE AILLEURS : recensement-calcul lit absences par versTableau(), qui
 *   accepte les deux formes. Rien à y changer.
 *
 * CARTE DES BLOCS :
 *   GARDE    — restriction au sujet des absences
 *   UTILS    — versTableau, helpers date, absence active, DC comptes
 *   DONNÉES  — lecture bi-schéma, écritures ciblées, conversion
 *   SCEDITOR — preremplirReponse (délègue à DC si disponible)
 *   MESSAGES — messages staff → topic absence du membre
 *   PANEL    — rendu des 3 sections du panneau + cards
 *   ADMIN    — boutons de gestion par carte (staff)
 *   FORM     — formulaire de déclaration membre
 *   AFFICHAGE · INIT — window.RC.initAbsence
 *
 * Dépend de : recensement-config, recensement-calcul, window.EcoCore,
 *   window.TDLBase (génération des clés).
 */

(function () {
  "use strict";

  window.RC = window.RC || {};
  const T   = () => window.RC.T;
  const CFG = () => window.RC.CFG;
  const TYPES = () => CFG().TYPES_ABSENCE;

  const NODE = "absences";
  const E = () => window.EcoCore;
  const B = () => window.TDLBase;

    /* === GARDE =====================
     Filtre partagé, défini dans recensement-config. initRender reste indéfini
     ailleurs : recensement-init ne l'appelle que sur ce sujet. */
  if (!window.RC.surLeSujet(window.RC.CFG && window.RC.CFG.TOPIC_ABSENCE_SLUG)) return;
  /* initAbsence reste indéfini ailleurs : recensement-init ne l'appelle que
     sur ce sujet, personne ne s'en plaint. */

  /* === UTILS === */

  function versTableau(v) {
    return window.RC.Calcul?.versTableau(v) ?? (!v ? [] : Array.isArray(v) ? v : Object.values(v));
  }

  function today() { return new Date().toISOString().slice(0, 10); }
  function genId()  { return "abs_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5); }

  function absenceActive(liste, pseudo) {
    return liste.find(a => a.pseudo === pseudo && a.statut === "en_cours") || null;
  }

  // Retourne les pseudos du groupe DC du membre (hors pseudo principal).
  // Utilisé pour les checkboxes de suppression partielle.
  function comptesMulti(groupes, pseudo) {
    groupes = groupes || {};
    // Chercher si pseudo est racine ou membre d'un groupe
    if (groupes[pseudo]) return versTableau(groupes[pseudo].comptes).filter(c => c !== pseudo);
    for (const [racine, g] of Object.entries(groupes)) {
      const comptes = versTableau(g && g.comptes);
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

  function estStaff() {
    return CFG().STAFF_USERS.includes(E()?.getPseudo?.() || "");
  }

  /* === DONNÉES =====================
     Lecture bi-schéma : rend [{_k, …absence}]. Un tableau v1 reçoit son indice
     comme clé de substitution, qui sert à l'affichage mais JAMAIS à une
     écriture — la conversion passe avant. */

  function listerAbsences(src) {
    if (!src) return [];
    if (Array.isArray(src)) {
      return src.map((a, i) => (a ? Object.assign({ _k: String(i), _v1: true }, a) : null)).filter(Boolean);
    }
    return Object.keys(src).map(k => (src[k] ? Object.assign({ _k: k }, src[k]) : null)).filter(Boolean);
  }

  /* Conversion tableau → nœud à clés, en UN PATCH atomique. Idempotente. */
  async function convertir(src) {
    const dst = {};
    src.forEach(a => { if (a) dst[B().nouvelleCle()] = a; });
    await E().firebaseUpdate({ [NODE]: Object.keys(dst).length ? dst : null });
    if (window.console) console.info("[recensement] absences converti en nœud à clés.");
  }

  async function lireAbsences() {
    let src = await E().firebaseGet(NODE);
    if (Array.isArray(src)) {
      await convertir(src);
      src = await E().firebaseGet(NODE);     // relu avec les vraies clés
    }
    return listerAbsences(src);
  }

  /* [MAJ v2] deux champs de LA seule absence visée. */
  async function prolongerAbsence(cle, nouvDate) {
    if (!cle) return false;
    try {
      await E().firebaseUpdate({
        [`${NODE}/${cle}/fin`]:       nouvDate,
        [`${NODE}/${cle}/prolongee`]: true,
      });
      return true;
    } catch (e) {
      if (window.console) console.error("[recensement] prolongation", e);
      return false;
    }
  }

  async function cloturerAbsence(cle) {
    if (!cle) return false;
    try {
      await E().firebaseUpdate({
        [`${NODE}/${cle}/statut`]:    "terminee",
        [`${NODE}/${cle}/retour_le`]: new Date().toISOString(),
      });
      return true;
    } catch (e) {
      if (window.console) console.error("[recensement] clôture", e);
      return false;
    }
  }

  /* La déclaration clôt l'absence active précédente du MÊME membre et crée la
     nouvelle — dans un seul PATCH, donc jamais l'une sans l'autre. Si la
     branche est encore un tableau, la conversion part dans le même PATCH. */
  async function soumettreDeclaration(data, zone, pseudo) {
    const nouvelle = Object.assign({}, data, {
      id: genId(), statut: "en_cours", cree_le: new Date().toISOString(),
    });
    const src = await E().firebaseGet(NODE);
    const k = B().nouvelleCle();
    const u = {};

    if (Array.isArray(src)) {
      const dst = {};
      src.forEach(a => {
        if (!a) return;
        const remplacee = a.pseudo === pseudo && a.statut === "en_cours";
        dst[B().nouvelleCle()] = remplacee ? Object.assign({}, a, { statut: "remplacee" }) : a;
      });
      dst[k] = nouvelle;
      u[NODE] = dst;
      if (window.console) console.info("[recensement] absences converti en nœud à clés.");
    } else {
      Object.keys(src || {}).forEach(kk => {
        const a = src[kk];
        if (a && a.pseudo === pseudo && a.statut === "en_cours") {
          u[`${NODE}/${kk}/statut`] = "remplacee";
        }
      });
      u[`${NODE}/${k}`] = nouvelle;
    }

    try { await E().firebaseUpdate(u); }
    catch (e) {
      if (window.console) console.error("[recensement] déclaration", e);
      alert("Enregistrement impossible — ta déclaration n'a pas été prise en compte.");
      return;
    }
    preremplirReponse(messageDeclaration(nouvelle));
    afficherPanneau(zone, pseudo);
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

  /* === MESSAGES === */

  /* Les valeurs viennent d'un formulaire membre et repartent dans un post. */
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function messageNouvelles(abs) {
    const typeLabel = {
      [TYPES().ABSENCE]:     "absence",
      [TYPES().REDUITE]:     "présence réduite",
      [TYPES().SUPPRESSION]: "demande de suppression",
    }[abs.type] || "absence";
    const finInfo = abs.fin ? `le ${esc(abs.fin)}` : "à une date indéfinie";
    return `<div class="sj-fiche"><div class="h1"><h1>À propos de ton ${esc(typeLabel)}</h1></div>
    <tw><span>@"${abs.pseudo}"</span></tw>
<div class="sj-formgen"><div class="sj-formcol"><f4>Nous venons aux nouvelles</f4>
Ton ${esc(typeLabel)} devait se terminer ${finInfo}. L'équipe paroissiale vient aux nouvelles :
es-tu de retour parmi nous, ou souhaites-tu prolonger ton absence ?
Merci de nous tenir informés
</div></div></div>`;
  }

  function messageDeclaration(data) {
    const typeLabel = {
      [TYPES().ABSENCE]:     "absence totale",
      [TYPES().REDUITE]:     "présence réduite",
      [TYPES().SUPPRESSION]: "demande de suppression",
    }[data.type] || data.type;

    const cols = [];
    cols.push(`<div class="sj-formcol"><f4>Membre</f4><span>@"${data.pseudo}"</span></div>`);
    cols.push(`<div class="sj-formcol"><f4>Début</f4><span>${esc(data.debut)}</span></div>`);

    if (data.fin) {
      cols.push(`<div class="sj-formcol"><f4>Fin estimée</f4><span>${esc(data.fin)}</span></div>`);
    }
    if (data.lien_sujet) {
      cols.push(`<div class="sj-formcol"><f4>Sujet d'absence</f4><span><a href="${esc(data.lien_sujet)}">Lire le sujet</a></span></div>`);
    }
    if (data.type === TYPES().SUPPRESSION) {
      const comptes = data.suppression_totale
        ? "Suppression totale (tous les comptes)"
        : `Comptes : ${esc((data.suppression_comptes || []).join(", "))}`;
      cols.push(`<div class="sj-formcol"><f4>Comptes</f4><span>${comptes}</span></div>`);
    }

    return `<div class="sj-fiche"><div class="h1"><h1>Déclaration — ${esc(typeLabel).toUpperCase()}</h1></div>`
         + `<div class="sj-formgen">${cols.join("")}</div></div>`;
  }

  /* === PANEL — RENDU DES CARDS === */

  function creerCard(abs, zone, pseudo) {
    const card = document.createElement("div");
    card.className = "abs-card" + (estExpire(abs) ? " abs-card--expire" : "");
    card.dataset.absId = abs.id || "";
    card.dataset.cle   = abs._k;          /* [MAJ v2] la clé, pour les écritures */

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
      lien.rel = "noopener";
      lien.textContent = "→ Voir le sujet";
      card.appendChild(lien);
    }

    // Admin : boutons de gestion
    if (estStaff()) card.appendChild(creerActionsAdmin(abs, zone, pseudo));

    return card;
  }

  /* === ADMIN — boutons par card === */

  function creerActionsAdmin(abs, zone, pseudo) {
    const wrap = document.createElement("div");
    wrap.className = "abs-admin";

    /* une absence restée en v1 n'a pas de clé : lecture seule jusqu'à la
       première déclaration, qui convertit la branche. */
    const figee = !!abs._v1;

    // "Prendre des nouvelles" : visible uniquement si la date de fin est dépassée
    if (estExpire(abs) && abs.lien_sujet) {
      const btnNew = document.createElement("button");
      btnNew.className = "abs-btn abs-btn--nouvelles";
      btnNew.textContent = T().BTN_NOUVELLES;
      btnNew.addEventListener("click", () => {
        preremplirReponse(messageNouvelles(abs));
        // Ouvre le sujet du membre dans un nouvel onglet pour faciliter le posting
        window.open(abs.lien_sujet, "_blank", "noopener");
      });
      wrap.appendChild(btnNew);
    }

    // "Prolonger" : formulaire inline de nouvelle date
    const btnProl = document.createElement("button");
    btnProl.className = "abs-btn abs-btn--prolonger";
    btnProl.textContent = T().BTN_PROLONGER;
    btnProl.disabled = figee;
    const zoneDate = document.createElement("div");
    zoneDate.className = "abs-prolonger-zone";
    zoneDate.hidden = true;
    zoneDate.innerHTML = `
      <input type="date" class="abs-input-date" value="${esc(abs.fin || today())}">
      <button class="abs-btn abs-btn--confirmer">${T().CONFIRMER_PROLONGATION}</button>`;
    btnProl.addEventListener("click", () => { zoneDate.hidden = !zoneDate.hidden; });
    zoneDate.querySelector(".abs-btn--confirmer").addEventListener("click", async (ev) => {
      const nouvDate = zoneDate.querySelector(".abs-input-date").value;
      if (!nouvDate) return;
      ev.target.disabled = true;
      const ok = await prolongerAbsence(abs._k, nouvDate);
      ev.target.disabled = false;
      if (!ok) { alert("Prolongation impossible — rien n'a été modifié."); return; }
      abs.fin = nouvDate; zoneDate.hidden = true;
      const card = wrap.closest(".abs-card");
      if (card) card.querySelector(".abs-card-dates").textContent = `${abs.debut} → ${nouvDate}`;
    });
    wrap.append(btnProl, zoneDate);

    // "Absence terminée" : toujours disponible
    const btnCloture = document.createElement("button");
    btnCloture.className = "abs-btn abs-btn--cloturer";
    btnCloture.textContent = T().BTN_CLOTURER;
    btnCloture.disabled = figee;
    btnCloture.addEventListener("click", async () => {
      btnCloture.disabled = true;
      const ok = await cloturerAbsence(abs._k);
      if (!ok) { btnCloture.disabled = false; alert("Clôture impossible — rien n'a été modifié."); return; }
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
    const head = document.createElement("div");
    head.className = "mc-head";
    head.innerHTML = `<h1>Toutes les ${titre}</h1>`
                   + `<p>${triees.length} ${titre.toLowerCase()} recensées</p>`;
    const grille = document.createElement("div");
    grille.className = "abs-grille";
    triees.forEach(abs => grille.appendChild(creerCard(abs, zone, pseudo)));
    section.append(head, grille);
    return section;
  }

  /* === FORM === */

  function creerFormulaire(groupes, pseudo, zone) {
    const form = document.createElement("div");
    form.className = "abs-form";

    /* innerHTML est posé AVANT tout appendChild : « += » reconstruit tous les
       enfants et effacerait leurs écouteurs. Le titre est donc dans le gabarit. */
    form.innerHTML = `
      <div class="mc-head"><h1>Déclarer une absence</h1><p>Choisir son formulaire</p></div>
      <div class="abs-form-field">
        <label class="abs-form-label">${T().LABEL_TYPE}</label>
        <div class="abs-types">
          ${[
            [TYPES().REDUITE,     T().TYPE_LABEL_REDUITE,     T().TYPE_DESC_REDUITE],
            [TYPES().ABSENCE,     T().TYPE_LABEL_ABSENCE,     T().TYPE_DESC_ABSENCE],
            [TYPES().SUPPRESSION, T().TYPE_LABEL_SUPPRESSION, T().TYPE_DESC_SUPPRESSION],
          ].map(([val, lbl, desc]) => `
            <label class="abs-type-option">
              <input type="radio" name="abs-type" value="${esc(val)}">
              <span class="abs-type-nom">${lbl}</span>
              <span class="abs-type-desc">${desc}</span>
            </label>`).join("")}
        </div>
      </div>
      <div class="abs-dates-row">
        <div class="abs-form-field">
          <label class="abs-form-label">${T().LABEL_DEBUT}</label>
          <input id="abs-debut" type="date" class="abs-input-date" value="${today()}">
        </div>
        <div class="abs-form-field">
          <label class="abs-form-label">${T().LABEL_FIN}</label>
          <input id="abs-fin" type="date" class="abs-input-date">
        </div>
      </div>
      <div class="abs-form-field">
        <label class="abs-form-label">${T().LABEL_LIEN}</label>
        <input id="abs-lien" type="url" class="abs-input-text" placeholder="https://…">
      </div>`;

    // Zone suppression DC (affichée uniquement pour type=suppression)
    const comptes = comptesMulti(groupes, pseudo);
    const zoneDC = document.createElement("div");
    zoneDC.className = "abs-form-field abs-dc-zone";
    zoneDC.hidden = true;
    if (comptes.length) {
      zoneDC.innerHTML = `<label class="abs-form-label">${T().LABEL_COMPTES}</label>
        <label class="abs-dc-option"><input type="radio" name="abs-suppr" value="totale" checked> Tous mes comptes</label>
        ${comptes.map(c => `<label class="abs-dc-option"><input type="checkbox" class="abs-dc-check" value="${esc(c)}"> ${esc(c)}</label>`).join("")}`;
    } else {
      zoneDC.innerHTML = `<p class="abs-form-note">Suppression totale (aucun multi-compte détecté).</p>`;
    }
    form.appendChild(zoneDC);

    // Afficher/masquer la section DC selon le type sélectionné
    form.querySelectorAll("[name='abs-type']").forEach(r =>
      r.addEventListener("change", () => { zoneDC.hidden = r.value !== TYPES().SUPPRESSION; })
    );

    const submitWrap = document.createElement("div");
    submitWrap.className = "abs-form-submit-wrap";
    const btnEnvoi = document.createElement("button");
    btnEnvoi.className = "abs-btn abs-btn--soumettre";
    btnEnvoi.textContent = T().BTN_SOUMETTRE;
    submitWrap.appendChild(btnEnvoi);
    btnEnvoi.addEventListener("click", () => {
      const type = form.querySelector("[name='abs-type']:checked")?.value;
      if (!type) return;
      const debut = form.querySelector("#abs-debut").value;
      const data = {
        pseudo, type, debut,
        fin:        form.querySelector("#abs-fin").value || null,
        lien_sujet: form.querySelector("#abs-lien").value.trim() || null,
        suppression_totale: type === TYPES().SUPPRESSION
          ? (!comptes.length || form.querySelector("[name='abs-suppr']:checked")?.value === "totale")
          : null,
        suppression_comptes: type === TYPES().SUPPRESSION
          ? [...form.querySelectorAll(".abs-dc-check:checked")].map(c => c.value)
          : null,
      };
      btnEnvoi.disabled = true;
      soumettreDeclaration(data, zone, pseudo).finally(() => { btnEnvoi.disabled = false; });
    });
    const result = document.createElement("div");
    result.className = "abs-result";
    form.append(submitWrap, result);
    return form;
  }

  /* === AFFICHAGE === */

  async function afficherPanneau(zone, pseudo) {
    zone.innerHTML = "<p class='rc-chargement'>Chargement…</p>";

    /* [MAJ v2] deux branches ciblées (moins de 2 ko) au lieu de la racine. */
    let absences, groupes;
    try {
      [absences, groupes] = await Promise.all([
        lireAbsences(),
        E().firebaseGet("doubles_comptes"),
      ]);
    } catch (e) {
      if (window.console) console.error("[recensement] lecture absences", e);
      zone.innerHTML = `<p class='rc-erreur'>${T().ERR_DONNEES}</p>`;
      return;
    }
    zone.innerHTML = "";

    const absActives = absences.filter(a => a.statut === "en_cours");

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
      zone.append(sep, creerFormulaire(groupes, pseudo, zone));
    }
  }

  /* === INIT === */

  window.RC.initAbsence = function (zone) {
    if (!B() || typeof B().nouvelleCle !== "function") {
      zone.innerHTML = "<p class='rc-erreur'>⚠️ tdl-base.js doit être chargé avant ce module.</p>";
      if (window.console) console.error("[recensement-absence] tdl-base absent.");
      return;
    }
    const pseudo = E()?.getPseudo?.();
    afficherPanneau(zone, pseudo || "");
  };

})();
