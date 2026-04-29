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

  async function chargerListe(listeEl, recExistant) {
    const rec = recExistant || await window.EcoCore.safeReadBin();
    if (!rec) { listeEl.textContent = T.ERR_DONNEES; return; }

    const demandes = DC.versTableau(rec.demandes_dc).filter((d) => d.statut === "en_attente");
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
    if (decision === "refusee" && motif === null) return;

    // Invalider le cache sessionStorage AVANT la lecture pour forcer un aller-retour Firebase.
    // Cela réduit la fenêtre de la race condition entre deux admins : sans ça, un admin
    // pourrait lire une version mise en cache 30s plus tôt et écraser le changement de l'autre.
    if (window.EcoCore.invalidateCache) window.EcoCore.invalidateCache();

    const rec = await window.EcoCore.readBin();
    rec.doubles_comptes = rec.doubles_comptes || {};
    rec.demandes_dc = DC.versTableau(rec.demandes_dc);

    const idx = rec.demandes_dc.findIndex((d) => d.id === id);
    if (idx === -1) return;

    // Vérifier que la demande est toujours en attente — un autre admin a peut-être agi entre-temps
    if (rec.demandes_dc[idx].statut !== "en_attente") {
      const resultatEl = listeEl.querySelector(`.dc-resultat-${id}`);
      if (resultatEl) DC.afficherResultat(resultatEl, "info",
        "⚠️ Cette demande a déjà été traitée par un autre admin. Actualisation en cours…");
      setTimeout(() => chargerListe(listeEl), 1500);
      return;
    }

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
    if (window.EcoCore.invalidateCache) window.EcoCore.invalidateCache();

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
      // Délai de 3s : laisse Firebase propager l'écriture avant que l'autre admin
      // ne voie la liste actualisée, réduisant la fenêtre de race condition.
      setTimeout(() => chargerListe(listeEl), 3000);
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
    rec.transactions_membres = DC.versTableau(rec.transactions_membres);
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

  // Formulaire affiché après validation pour associer le pseudo + UID du nouveau compte.
  // Inséré dans le panel (pas dans la carte) pour survivre aux rechargements de page.
  function afficherFormulaireAjout(panelEl, racine, numeroDC) {
    const cle = `ajout-${racine}-${numeroDC}`;
    if (document.querySelector(`[data-cle="${cle}"]`)) return;

    const div = document.createElement("div");
    div.className = "dc-ajout-pseudo";
    div.dataset.cle = cle;
    div.innerHTML = `
      <p style="margin:8px 0 6px;"><strong>➕ Nouveau compte validé pour le groupe de ${racine}</strong></p>
      <label class="dc-label">${T.STAFF_LABEL_AJOUT}</label>
      <input class="dc-input-pseudo" type="text" placeholder="Pseudo du nouveau compte"
        style="margin-bottom:8px;">
      <button class="dc-btn-enregistrer">${T.STAFF_BTN_AJOUT}</button>
      <span class="dc-ajout-resultat"></span>
      <div class="dc-ajout-uid-info" style="font-size:.85em;color:#666;margin-top:4px;">
        L'UID sera récupéré automatiquement à la première connexion du membre.
      </div>
    `;
    panelEl.appendChild(div);
    div.querySelector(".dc-btn-enregistrer")
       .addEventListener("click", () => enregistrerPseudo(div, racine));
  }

  async function enregistrerPseudo(div, racine) {
    const resultatSpan  = div.querySelector(".dc-ajout-resultat");
    const nouveauPseudo = div.querySelector(".dc-input-pseudo").value.trim();

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
    // Normalisation avant push — Firebase peut avoir converti comptes en objet
    const comptesCourants = DC.versTableau(rec.doubles_comptes[racine].comptes);
    comptesCourants.push(nouveauPseudo);
    rec.doubles_comptes[racine].comptes = comptesCourants;
    delete rec.doubles_comptes[racine].slot_en_attente;

    // L'UID est résolu automatiquement depuis uid_index (rempli par eco-ui.js au login du membre)
    // Si le membre ne s'est pas encore connecté depuis le patch, uid_index ne contiendra pas
    // encore son entrée — le bottin utilisera @"Pseudo" en attendant, puis basculera en mentiontag
    // automatiquement à la première connexion du nouveau compte.

    await window.EcoCore.writeBin(rec);
    window.DC.rafraichirBottin?.();
    resultatSpan.style.color = "green";
    resultatSpan.textContent = T.STAFF_AJOUT_OK(nouveauPseudo, racine);
  }

  /* === INIT === */

  DC.initStaff = function (ancrage) {
    if (document.getElementById("dc-staff-panel")) return;
    const panel = creerPanel();
    ancrage.appendChild(panel);

    const sectionGestion = creerSectionGestion();
    ancrage.appendChild(sectionGestion);
    ancrage.appendChild(creerSectionSuppression());

    // Une seule lecture JSONBin partagée : évite 3 appels Firebase simultanés.
    // Le catch explicite remplace le silence des erreurs dans les Promise async.
    window.EcoCore.safeReadBin()
      .then((rec) => {
        chargerListe(panel.querySelector("#dc-staff-liste"), rec);
        chargerSlotsEnAttente(panel, rec);
        chargerGroupes(sectionGestion.querySelector("#dc-staff-groupes"), rec);
      })
      .catch((e) => {
        const listeEl = panel.querySelector("#dc-staff-liste");
        if (listeEl) listeEl.textContent = T.ERR_DONNEES + " (erreur : " + e.message + ")";
      });
  };

  // Relit le JSONBin au chargement et réaffiche un formulaire d'ajout pour chaque
  // groupe dont la demande a été validée mais dont le nouveau pseudo n'est pas encore enregistré.
  // C'est ce mécanisme qui rend le formulaire persistant après rechargement de page.
  async function chargerSlotsEnAttente(panelEl, recExistant) {
    const rec = recExistant || await window.EcoCore.safeReadBin();
    if (!rec?.doubles_comptes) return;

    Object.entries(rec.doubles_comptes).forEach(([racine, groupe]) => {
      if (!groupe.slot_en_attente) return;

      // Extraire le numéro du DC depuis "NOUVEAU_COMPTE_3" → 3
      const numeroDC = parseInt(groupe.slot_en_attente.replace("NOUVEAU_COMPTE_", ""), 10);
      afficherFormulaireAjout(panelEl, racine, numeroDC);
    });
  }

  /* === GESTION DES GROUPES === */

  function creerSectionGestion() {
    const section = document.createElement("div");
    section.id = "dc-staff-gestion";
    section.className = "dc-staff-panel";
    section.style.marginTop = "14px";
    section.innerHTML = `
      <h3 class="dc-staff-titre">${T.STAFF_GESTION_TITRE}</h3>
      <div id="dc-staff-groupes">Chargement…</div>
    `;
    return section;
  }

  async function chargerGroupes(groupesEl, recExistant) {
    // recExistant permet de réutiliser une lecture déjà faite par initStaff
    // et d'éviter un appel Firebase supplémentaire.
    const rec = recExistant || await window.EcoCore.safeReadBin();
    if (!rec) { groupesEl.textContent = T.ERR_DONNEES; return; }

    // doubles_comptes absent = aucun DC validé, pas une erreur
    const entrees = Object.entries(rec.doubles_comptes || {})
      .sort(([a], [b]) => a.localeCompare(b, "fr"));

    if (!entrees.length) { groupesEl.innerHTML = `<em>${T.STAFF_GESTION_VIDE}</em>`; return; }

    groupesEl.innerHTML = "";
    entrees.forEach(([racine, groupe]) => {
      groupesEl.appendChild(creerCarteGroupe(racine, groupe.comptes));
    });
  }

  function creerCarteGroupe(racine, comptes) {
    const carte = document.createElement("div");
    carte.className = "dc-staff-carte";
    carte.dataset.racine = racine;

    const pseudosHTML = DC.versTableau(comptes).map((pseudo) => `
      <span class="dc-groupe-pseudo">
        ${pseudo === racine ? `<strong>${pseudo}</strong> (racine)` : pseudo}
        <button class="dc-btn-suppr-pseudo" data-pseudo="${pseudo}" data-racine="${racine}"
          title="Retirer ce pseudo du groupe">✕</button>
      </span>
    `).join(" · ");

    carte.innerHTML = `
      <div style="margin-bottom:8px;">${pseudosHTML}</div>
      <button class="dc-btn-suppr-groupe" data-racine="${racine}"
        style="background:#7b1f1f;color:#fff;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-size:.85em;">
        🗑 Supprimer tout le groupe
      </button>
      <span class="dc-gestion-resultat-${racine.replace(/\s/g,'-')}" style="margin-left:8px;font-size:.9em;"></span>
    `;

    carte.querySelectorAll(".dc-btn-suppr-pseudo").forEach((btn) =>
      btn.addEventListener("click", () =>
        supprimerPseudo(btn.dataset.racine, btn.dataset.pseudo, carte))
    );
    carte.querySelector(".dc-btn-suppr-groupe")
      .addEventListener("click", () => supprimerGroupe(racine, carte));

    return carte;
  }

  async function supprimerPseudo(racine, pseudo, carteEl) {
    if (!confirm(T.STAFF_CONFIRM_SUPPRESSION(pseudo))) return;

    const resultatSel = `.dc-gestion-resultat-${racine.replace(/\s/g,'-')}`;
    const resultatEl  = carteEl.querySelector(resultatSel);

    try {
      const rec = await window.EcoCore.readBin();
      const groupe = rec.doubles_comptes?.[racine];
      if (!groupe) return;

      // Normalisation : Firebase peut avoir converti comptes en objet
      const comptesNorm = DC.versTableau(groupe.comptes).filter((c) => c !== pseudo);
      groupe.comptes = comptesNorm;
      if (groupe.uids) delete groupe.uids[pseudo];

      if (comptesNorm.length <= 1) {
        delete rec.doubles_comptes[racine];
      } else if (pseudo === racine) {
        const nouvelleRacine = comptesNorm[0];
        rec.doubles_comptes[nouvelleRacine] = { ...groupe };
        delete rec.doubles_comptes[racine];
      }

      await window.EcoCore.writeBin(rec);
      if (resultatEl) resultatEl.style.color = "green", resultatEl.textContent = T.STAFF_SUPPR_OK(pseudo);
      window.DC.rafraichirBottin?.();
      // Recharger la section gestion pour refléter la nouvelle structure
      setTimeout(() => chargerGroupes(document.getElementById("dc-staff-groupes")), 1200);

    } catch (_) {
      if (resultatEl) resultatEl.style.color = "red", resultatEl.textContent = T.STAFF_ERR_SUPPR;
    }
  }

  async function supprimerGroupe(racine, carteEl) {
    if (!confirm(T.STAFF_CONFIRM_GROUPE(racine))) return;

    const resultatSel = `.dc-gestion-resultat-${racine.replace(/\s/g,'-')}`;
    const resultatEl  = carteEl.querySelector(resultatSel);

    try {
      const rec = await window.EcoCore.readBin();
      delete rec.doubles_comptes[racine];
      await window.EcoCore.writeBin(rec);
      if (resultatEl) resultatEl.style.color = "green", resultatEl.textContent = T.STAFF_SUPPR_GROUPE_OK(racine);
      window.DC.rafraichirBottin?.();
      setTimeout(() => chargerGroupes(document.getElementById("dc-staff-groupes")), 1200);

    } catch (_) {
      if (resultatEl) resultatEl.style.color = "red", resultatEl.textContent = T.STAFF_ERR_SUPPR;
    }
  }

  /* === SUPPRESSION COMPLETE D'UN MEMBRE === */

  function creerSectionSuppression() {
    const section = document.createElement("div");
    section.id = "dc-staff-suppression";
    section.className = "dc-staff-panel";
    section.style.marginTop = "14px";
    section.innerHTML = `
      <h3 class="dc-staff-titre" style="color:#7b1f1f;">🗑 Suppression complète d'un membre</h3>
      <p style="font-size:.9em;color:#555;margin:0 0 10px;">
        Supprime toutes les données du membre dans le JSONBin : économie, multi-comptes et index UID.
        À utiliser uniquement si le membre a définitivement quitté le forum.
      </p>
      <label class="dc-label">Pseudo exact du membre à supprimer :</label>
      <input id="dc-suppr-input" type="text" placeholder="Pseudo exact"
        style="border:1px solid #f99;border-radius:4px;padding:5px 8px;width:220px;margin-right:8px;">
      <button id="dc-suppr-btn"
        style="background:#7b1f1f;color:#fff;border:none;border-radius:4px;padding:7px 14px;cursor:pointer;font-weight:bold;">
        Supprimer tout
      </button>
      <div id="dc-suppr-resultat" class="dc-resultat" style="margin-top:10px;"></div>
    `;
    section.querySelector("#dc-suppr-btn")
      .addEventListener("click", () => supprimerMembreComplet(section));
    return section;
  }

  async function supprimerMembreComplet(section) {
    const pseudo     = section.querySelector("#dc-suppr-input").value.trim();
    const resultatEl = section.querySelector("#dc-suppr-resultat");

    if (!pseudo) { DC.afficherResultat(resultatEl, "erreur", "Pseudo vide."); return; }
    if (!confirm(`⚠️ Supprimer TOUTES les données de "${pseudo}" ? Cette action est irréversible.`)) return;

    const rec = await window.EcoCore.readBin();
    rec.demandes_dc = DC.versTableau(rec.demandes_dc);
    const uid = DC.uidDepuisPseudo(rec, pseudo);
    let actions = [];

    // Supprimer de membres
    if (rec.membres?.[pseudo]) {
      delete rec.membres[pseudo];
      actions.push("économie");
    }

    // Supprimer de uid_index
    if (uid && rec.uid_index?.[uid]) {
      delete rec.uid_index[uid];
      actions.push("index UID");
    }

    // Supprimer du groupe DC (clé racine ou membre d'un groupe)
    if (rec.doubles_comptes) {
      // Si c'est la racine d'un groupe
      if (rec.doubles_comptes[pseudo]) {
        delete rec.doubles_comptes[pseudo];
        actions.push("groupe DC (racine)");
      }
      // Si c'est un membre dans un groupe
      Object.entries(rec.doubles_comptes).forEach(([racine, groupe]) => {
        const comptesArr = DC.versTableau(groupe.comptes);
        const idx = comptesArr.indexOf(pseudo);
        if (idx === -1) return;
        comptesArr.splice(idx, 1);
        groupe.comptes = comptesArr;
        if (comptesArr.length <= 1) {
          delete rec.doubles_comptes[racine];
          actions.push("groupe DC (membre → groupe vidé)");
        } else {
          actions.push("groupe DC (membre retiré)");
        }
      });
    }

    if (!actions.length) {
      DC.afficherResultat(resultatEl, "info", `"${pseudo}" introuvable dans le JSONBin.`);
      return;
    }

    await window.EcoCore.writeBin(rec);
    window.DC.rafraichirBottin?.();
    DC.afficherResultat(resultatEl, "succes",
      `✅ "${pseudo}" supprimé (${actions.join(", ")}).`);
    section.querySelector("#dc-suppr-input").value = "";

    // Rafraîchir la section gestion des groupes
    const groupesEl = document.getElementById("dc-staff-groupes");
    if (groupesEl) chargerGroupes(groupesEl);
  }

})(window.DC, window.DC.CFG, window.DC.TEXTES);
