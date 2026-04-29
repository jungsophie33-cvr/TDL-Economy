/*
 * eco-dc-staff.js — Panel de validation multi-compte (côté staff) · TDL
 *
 * CE QUE CE FICHIER FAIT : affiche la liste des demandes en attente, permet au
 * staff de valider ou refuser, déclenche le débit de monnaie si requis, et fournit
 * un formulaire pour enregistrer le pseudo du nouveau compte une fois créé.
 * CE QU'IL NE FAIT PAS : vérification des conditions membres (voir eco-dc-membre.js).
 *
 * CARTE DES BLOCS :
 *   RENDER      — création du panel et des cartes de demande
 *   EVENTS      — binding des boutons valider / refuser
 *   TRAITEMENT  — logique de validation/refus (statut, paiement, groupe)
 *   AJOUT PSEUDO — formulaire post-validation pour lier le nouveau compte
 *   INIT        — point d'entrée exposé sur window.DC
 *
 * Dépend de : eco-dc-config.js, eco-dc-utils.js, window.EcoCore
 */

(function (DC, CFG, T) {
  "use strict";

  /* === RENDER === */

  function creerPanel() {
    const panel = document.createElement("div");
    panel.id = "dc-staff-panel";
    panel.className = "dc-staff-panel";
    panel.innerHTML = `
      <h3 class="dc-staff-titre">${T.STAFF_TITRE}</h3>
      <div id="dc-staff-liste">${T.CHARGEMENT}</div>
    `;
    return panel;
  }

  async function chargerListe(listeEl) {
    const rec = await window.EcoCore.safeReadBin();
    if (!rec) { listeEl.textContent = T.ERR_DONNEES; return; }

    const demandes = (rec.demandes_dc || []).filter((d) => d.statut === "en_attente");
    if (!demandes.length) { listeEl.innerHTML = `<em>${T.STAFF_AUCUNE}</em>`; return; }

    listeEl.innerHTML = "";
    demandes.forEach((d) => listeEl.appendChild(creerCarte(d)));
    bindBoutons(listeEl);
  }

  function creerCarte(d) {
    const monnaie = window.EcoCore.MONNAIE_NAME;
    const carte = document.createElement("div");
    carte.className = "dc-staff-carte";
    carte.innerHTML = `
      <div>
        <strong>${d.compte_demandeur}</strong> → <strong>${d.numero_dc}e compte</strong>
        <span class="dc-staff-carte-meta">${new Date(d.date).toLocaleDateString("fr-FR")}</span>
      </div>
      <div><em>Résumé :</em> ${d.resume.slice(0, 150)}${d.resume.length > 150 ? "…" : ""}</div>
      <div><em>Avatar :</em> ${d.avatar_reserve}</div>
      ${d.paiement_requis
        ? `<div class="dc-staff-carte-paiement">💰 Paiement de ${CFG.COUT_DC} ${monnaie} requis (solde au dépôt : ${d.solde_avant} ${monnaie})</div>`
        : ""}
      <div class="dc-staff-carte-ref">Réf. : ${d.id}</div>
      <div class="dc-staff-actions">
        <button class="dc-btn-valider" data-id="${d.id}">✅ Valider</button>
        <button class="dc-btn-refuser"  data-id="${d.id}">❌ Refuser</button>
      </div>
      <div class="dc-resultat dc-resultat-${d.id}"></div>
    `;
    return carte;
  }

  /* === EVENTS === */

  function bindBoutons(listeEl) {
    listeEl.querySelectorAll(".dc-btn-valider").forEach((btn) =>
      btn.addEventListener("click", () => traiter(btn.dataset.id, "validee", listeEl))
    );
    listeEl.querySelectorAll(".dc-btn-refuser").forEach((btn) =>
      btn.addEventListener("click", () => traiter(btn.dataset.id, "refusee", listeEl))
    );
  }

  /* === TRAITEMENT === */

  async function traiter(id, decision, listeEl) {
    const motif = decision === "refusee" ? prompt(T.STAFF_PROMPT_REFUS, "") : null;
    // L'utilisateur a annulé la saisie du motif via "Annuler" dans prompt()
    if (decision === "refusee" && motif === null) return;

    const rec = await window.EcoCore.readBin();
    rec.doubles_comptes = rec.doubles_comptes || {};
    rec.demandes_dc     = rec.demandes_dc     || [];

    const idx = rec.demandes_dc.findIndex((d) => d.id === id);
    if (idx === -1) return;

    const demande      = rec.demandes_dc[idx];
    const staffPseudo  = window.EcoCore.getPseudo();
    const resultatEl   = listeEl.querySelector(`.dc-resultat-${id}`);

    enregistrerDecision(rec, idx, decision, staffPseudo, motif);

    if (decision === "validee") {
      const erreur = tenterPaiement(rec, demande);
      if (erreur) { DC.afficherResultat(resultatEl, "erreur", erreur); return; }
      validerGroupe(rec, demande);
    } else {
      libererVerrou(rec, demande.compte_racine);
    }

    await window.EcoCore.writeBin(rec);

    const monnaie = window.EcoCore.MONNAIE_NAME;
    DC.preremplirReponse(DC.msgStaff(demande, decision, motif, staffPseudo, monnaie));

    DC.afficherResultat(resultatEl, "succes",
      decision === "validee"
        ? `✅ Demande validée.${demande.paiement_requis ? " Paiement débité." : ""}`
        : "✅ Demande refusée."
    );

    if (decision === "validee") {
      // Le formulaire d'ajout est ancré dans le panel (pas dans la carte) pour survivre
      // au rechargement de la liste — la carte disparaît, le formulaire reste.
      const panelEl = listeEl.closest("#dc-staff-panel") || listeEl.parentElement;
      afficherFormulaireAjout(panelEl, demande.compte_racine, demande.numero_dc);

      // On retire seulement la carte traitée sans reconstruire toute la liste,
      // ce qui détruirait le formulaire d'ajout qu'on vient d'insérer.
      const carte = listeEl.querySelector(`.dc-resultat-${id}`)?.closest(".dc-staff-carte");
      if (carte) setTimeout(() => carte.remove(), 1500);

    } else {
      // Pour un refus, aucun formulaire persistant : on peut relancer la liste proprement.
      setTimeout(() => chargerListe(listeEl), 2000);
    }
  }

  function enregistrerDecision(rec, idx, decision, staffPseudo, motif) {
    Object.assign(rec.demandes_dc[idx], {
      statut:    decision,
      traite_par: staffPseudo,
      traite_le: new Date().toISOString(),
      ...(motif ? { motif_refus: motif } : {}),
    });
  }

  // Effectue le débit si requis. Retourne un message d'erreur ou null si OK.
  function tenterPaiement(rec, demande) {
    if (!demande.paiement_requis) return null;
    const { compte_demandeur, numero_dc } = demande;
    const solde = rec.membres?.[compte_demandeur]?.dollars ?? 0;
    if (solde < CFG.COUT_DC) return T.STAFF_ERR_SOLDE(compte_demandeur, solde);

    rec.membres[compte_demandeur].dollars -= CFG.COUT_DC;
    rec.transactions_membres = rec.transactions_membres || [];
    rec.transactions_membres.push({
      date:    new Date().toISOString(),
      de:      compte_demandeur,
      vers:    "Frais DC",
      montant: CFG.COUT_DC,
      motif:   `Paiement création compte n°${numero_dc}`,
    });
    return null;
  }

  function validerGroupe(rec, demande) {
    const { compte_racine, numero_dc } = demande;
    if (!rec.doubles_comptes[compte_racine]) {
      rec.doubles_comptes[compte_racine] = { comptes: [compte_racine] };
    }
    Object.assign(rec.doubles_comptes[compte_racine], {
      demande_en_cours: false,
      slot_en_attente:  `NOUVEAU_COMPTE_${numero_dc}`,
    });
  }

  function libererVerrou(rec, racine) {
    if (rec.doubles_comptes[racine]) {
      rec.doubles_comptes[racine].demande_en_cours = false;
    }
  }

  /* === AJOUT PSEUDO === */

  // Formulaire affiché après validation pour associer le pseudo du nouveau compte créé.
  // Inséré directement dans le panel (pas dans la carte) pour survivre au rechargement.
  function afficherFormulaireAjout(panelEl, racine, numeroDC) {
    const cle = `ajout-${racine}-${numeroDC}`;
    // Guard global : si ce formulaire existe déjà n'importe où dans le panel, on ne recrée pas
    if (document.querySelector(`[data-cle="${cle}"]`)) return;

    const div = document.createElement("div");
    div.className = "dc-ajout-pseudo";
    div.dataset.cle = cle;
    div.innerHTML = `
      <p style="margin:8px 0 4px;"><strong>➕ Nouveau compte validé pour le groupe de ${racine}</strong></p>
      <label class="dc-label">${T.STAFF_LABEL_AJOUT}</label>
      <input type="text" placeholder="Pseudo du nouveau compte">
      <button class="dc-btn-enregistrer">${T.STAFF_BTN_AJOUT}</button>
      <span class="dc-ajout-resultat"></span>
    `;
    panelEl.appendChild(div);
    div.querySelector(".dc-btn-enregistrer")
       .addEventListener("click", () => enregistrerPseudo(div, racine));
  }

  async function enregistrerPseudo(div, racine) {
    const input        = div.querySelector("input");
    const resultatSpan = div.querySelector(".dc-ajout-resultat");
    const nouveauPseudo = input.value.trim();

    if (!nouveauPseudo) { resultatSpan.textContent = T.STAFF_ERR_PSEUDO_VIDE; return; }

    const rec = await window.EcoCore.readBin();
    rec.doubles_comptes = rec.doubles_comptes || {};

    const dejaLie = DC.trouverGroupe(rec, nouveauPseudo);
    if (dejaLie) {
      resultatSpan.style.color = "red";
      resultatSpan.textContent = T.STAFF_ERR_DEJA_LIE(dejaLie);
      return;
    }

    if (!rec.doubles_comptes[racine]) {
      rec.doubles_comptes[racine] = { comptes: [racine] };
    }
    rec.doubles_comptes[racine].comptes.push(nouveauPseudo);
    delete rec.doubles_comptes[racine].slot_en_attente;

    await window.EcoCore.writeBin(rec);
    resultatSpan.style.color = "green";
    resultatSpan.textContent = T.STAFF_AJOUT_OK(nouveauPseudo, racine);
  }

  /* === INIT === */

  DC.initStaff = function (ancrage) {
    if (document.getElementById("dc-staff-panel")) return;
    const panel = creerPanel();
    ancrage.appendChild(panel);
    // Les deux chargements sont indépendants : les demandes en attente d'un côté,
    // les slots en attente d'ajout de pseudo de l'autre (survivent aux rechargements de page).
    chargerListe(panel.querySelector("#dc-staff-liste"));
    chargerSlotsEnAttente(panel);
  };

  // Relit le JSONBin au chargement et réaffiche un formulaire d'ajout pour chaque
  // groupe dont la demande a été validée mais dont le nouveau pseudo n'est pas encore enregistré.
  // C'est ce mécanisme qui rend le formulaire persistant après rechargement de page.
  async function chargerSlotsEnAttente(panelEl) {
    const rec = await window.EcoCore.safeReadBin();
    if (!rec?.doubles_comptes) return;

    Object.entries(rec.doubles_comptes).forEach(([racine, groupe]) => {
      if (!groupe.slot_en_attente) return;

      // Extraire le numéro du DC depuis "NOUVEAU_COMPTE_3" → 3
      const numeroDC = parseInt(groupe.slot_en_attente.replace("NOUVEAU_COMPTE_", ""), 10);
      afficherFormulaireAjout(panelEl, racine, numeroDC);
    });
  }

})(window.DC, window.DC.CFG, window.DC.TEXTES);
