/*
 * fiche-staff.js — Panel de validation de fiches (côté staff) · TDL
 *
 * CE QUE CE FICHIER FAIT : affiche les demandes en attente, ouvre une modale
 * de validation avec message personnalisé, poste dans la fiche du membre,
 * applique les actions automatiques (dollars, cagnotte, groupe, DC).
 * CE QU'IL NE FAIT PAS : formulaire membre, gestion des listes de membres.
 *
 * CARTE DES BLOCS :
 *   RENDER PANEL    — création du panel et des cartes de demande
 *   CHARGEMENT      — lecture JSONBin et rendu des cartes
 *   MODAL STAFF     — modale avec textarea de message personnalisé
 *   VALIDATION      — post dans la fiche + mise à jour statut
 *   ACTIONS         — dollars, cagnotte, groupe, complétion DC
 *   INIT            — point d'entrée exposé sur window.FI
 *
 * Dépend de : fiche-config.js, fiche-utils.js, window.EcoCore
 */

(function (FI, CFG, T) {
  "use strict";

  /* === RENDER PANEL === */

  function creerPanel() {
    const panel = document.createElement("div");
    panel.id = "fi-staff-panel";
    panel.className = "dc-staff-panel";
    panel.innerHTML = `
      <h3 class="dc-staff-titre">${T.STAFF_TITRE}</h3>
      <div id="fi-staff-liste">Chargement…</div>`;
    return panel;
  }

  function creerCarte(d) {
    const carte = document.createElement("div");
    carte.className = "dc-staff-carte fi-carte";
    const prelienHtml = d.pre_lien
      ? `<a href="${d.lien_pre_lien}" target="_blank">Voir le pré-lien</a>
         <em>(+${CFG.PRIME_PRE_LIEN}$ au membre)</em>`
      : "Non";
    const parrainHtml = d.parrain && d.parrain !== "Personne"
      ? `@"${d.parrain}" <em>(+${CFG.PRIME_PARRAIN}$ versés à ce membre)</em>`
      : "Personne";
    const dcHtml = d.multicompte
      ? `Oui — compte racine : <strong>${d.premier_compte}</strong>` : "Non";
    const bandeHtml = d.bande ? `${d.nom_bande} — ${d.role_bande}` : "Non";

    carte.innerHTML = `
      <div class="fi-carte-entete">
        <strong>${d.pseudo}</strong>
        <span class="dc-staff-carte-meta">${new Date(d.date).toLocaleDateString("fr-FR")}</span>
        — <a href="${d.lien_fiche}" target="_blank">📄 Voir la fiche</a>
      </div>
      <div class="fi-carte-grille">
        <span><em>Pré-lien</em></span>       <span>${prelienHtml}</span>
        <span><em>Parrain</em></span>         <span>${parrainHtml}</span>
        <span><em>Multi-compte</em></span>    <span>${dcHtml}</span>
        <span><em>Faceclaim</em></span>       <span>${d.faceclaim}</span>
        <span><em>Groupe</em></span>          <span>${d.groupe}</span>
        <span><em>Bande</em></span>           <span>${bandeHtml}</span>
        <span><em>Métier</em></span>          <span>${d.lieu_metier} — ${d.societe} — ${d.emploi}</span>
        <span><em>Habitation</em></span>      <span>${d.lieu_habitation} — ${d.logement}</span>
      </div>
      <div class="dc-staff-carte-ref">Réf. : ${d.id}</div>
      <div class="dc-staff-actions">
        <button class="fi-btn-valider dc-btn-valider" data-id="${d.id}">
          ${T.STAFF_BTN_VALIDER}
        </button>
      </div>
      <div class="fi-resultat fi-resultat-${d.id}"></div>`;
    return carte;
  }

  /* === CHARGEMENT === */

  async function chargerDemandes(listeEl) {
    const rec = await window.EcoCore.safeReadBin();
    if (!rec) { listeEl.textContent = T.ERR_DONNEES; return; }

    const demandes = FI.versTableau(rec.demandes_fiche).filter((d) => d.statut === "en_attente");
    if (!demandes.length) { listeEl.innerHTML = `<em>${T.STAFF_AUCUNE}</em>`; return; }

    listeEl.innerHTML = "";
    demandes.forEach((d) => {
      const carte = creerCarte(d);
      carte.querySelector(".fi-btn-valider")
        .addEventListener("click", () => ouvrirModalValidation(d, listeEl));
      listeEl.appendChild(carte);
    });
  }

  /* === MODAL STAFF === */

  function ouvrirModalValidation(demande, listeEl) {
    document.getElementById("fi-modal-validation")?.remove();

    const modal = document.createElement("div");
    modal.id = "fi-modal-validation";
    modal.className = "dc-overlay actif";
    modal.innerHTML = `
      <div class="dc-boite" style="max-width:540px;">
        <button class="dc-btn-fermer">✕</button>
        <h3 class="dc-titre">${T.STAFF_TITRE_MODAL(demande.pseudo)}</h3>
        <label class="fi-label">${T.STAFF_LABEL_MSG}</label>
        <textarea id="fi-msg-perso" class="fi-textarea" rows="6"
          placeholder="Votre message personnalisé…"></textarea>
        <div class="dc-actions" style="margin-top:12px;">
          <button id="fi-btn-confirmer" class="dc-btn-soumettre">${T.STAFF_BTN_CONFIRMER}</button>
          <button class="fi-btn-annuler-validation dc-btn-annuler">${T.STAFF_BTN_ANNULER}</button>
        </div>
        <div id="fi-modal-resultat" class="fi-resultat"></div>
      </div>`;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const fermer = () => { modal.remove(); document.body.style.overflow = ""; };
    modal.querySelector(".dc-btn-fermer").addEventListener("click", fermer);
    modal.querySelector(".fi-btn-annuler-validation").addEventListener("click", fermer);
    modal.addEventListener("click", (e) => { if (e.target === modal) fermer(); });

    modal.querySelector("#fi-btn-confirmer").addEventListener("click", async () => {
      const msgPerso   = modal.querySelector("#fi-msg-perso").value.trim();
      const resultatEl = modal.querySelector("#fi-modal-resultat");
      const btn        = modal.querySelector("#fi-btn-confirmer");
      btn.disabled = true;
      btn.textContent = "Envoi en cours…";

      const ok = await valider(demande, msgPerso, listeEl, resultatEl);
      if (ok) setTimeout(fermer, 2000);
      else { btn.disabled = false; btn.textContent = T.STAFF_BTN_CONFIRMER; }
    });
  }

  /* === VALIDATION === */

  async function valider(demande, msgPerso, listeEl, resultatEl) {
    const topicId    = FI.extraireTopicId(demande.lien_fiche);
    const staffPseudo = window.EcoCore.getPseudo();

    try {
      if (!topicId) throw new Error("ID de sujet introuvable dans l'URL de la fiche.");
      await FI.posterDansSujet(topicId, FI.bbcodeValidation(demande, msgPerso, staffPseudo));
    } catch (e) {
      FI.afficherResultat(resultatEl, "erreur",
        `${T.STAFF_ERR_POSTING}<br><small>${e.message}</small>`);
      return false;
    }

    const rec = await window.EcoCore.readBin();
    // Normalisation avant findIndex : si Firebase a converti en objet {0:…, 6:…},
    // l'index retourné par findIndex ne correspond pas aux clés de l'objet original.
    // On réécrit rec.demandes_fiche comme vrai tableau pour que rec.demandes_fiche[idx] fonctionne.
    rec.demandes_fiche = FI.versTableau(rec.demandes_fiche);
    const idx = rec.demandes_fiche.findIndex((d) => d.id === demande.id);
    if (idx !== -1) {
      Object.assign(rec.demandes_fiche[idx], {
        statut:    "validee",
        traite_par: staffPseudo,
        traite_le: new Date().toISOString(),
      });
    }

    appliquerActions(rec, demande);
    await window.EcoCore.writeBin(rec);

    FI.afficherResultat(resultatEl, "succes", T.STAFF_OK(demande.pseudo));
    setTimeout(() => chargerDemandes(listeEl), 2000);
    return true;
  }

  /* === ACTIONS === */

  // Centralise toutes les mutations du JSONBin post-validation dans une seule fonction.
  // Aucun writeBin ici : on mutue `rec` en place, le writeBin est fait dans valider().
  function appliquerActions(rec, d) {
    rec.membres   = rec.membres   || {};
    rec.cagnottes = rec.cagnottes || {};

    crediterMembre(rec, d);
    crediterParrain(rec, d);
    affecterGroupe(rec, d);
    completerGroupeDC(rec, d);
  }

  function crediterMembre(rec, d) {
    if (!d.pre_lien) return;
    // Crée une entrée minimale si le membre n'a pas encore chargé eco-ui.js
    if (!rec.membres[d.pseudo]) {
      rec.membres[d.pseudo] = { uid: d.uid || null, dollars: 0, group: null, messages: 0, lastMessageThresholdAwarded: 0 };
    }
    rec.membres[d.pseudo].dollars = (rec.membres[d.pseudo].dollars || 0) + CFG.PRIME_PRE_LIEN;
  }

  function crediterParrain(rec, d) {
    if (!d.parrain || d.parrain === "Personne") return;
    // Les 10$ sont versés directement au membre parrain, pas à sa cagnotte de groupe
    if (!rec.membres[d.parrain]) return;
    rec.membres[d.parrain].dollars = (rec.membres[d.parrain].dollars || 0) + CFG.PRIME_PARRAIN;
  }

  function affecterGroupe(rec, d) {
    if (!rec.membres[d.pseudo]) return;
    rec.membres[d.pseudo].group = d.groupe;
  }

  // Complète la 2e étape de la demande DC : ajoute le nouveau pseudo au groupe et supprime le slot.
  function completerGroupeDC(rec, d) {
    if (!d.multicompte || !d.premier_compte) return;
    const groupe = rec.doubles_comptes?.[d.premier_compte];
    if (!groupe?.slot_en_attente) return;
    // Normalisation Firebase : comptes peut être un objet {0:…, 1:…}
    const comptes = FI.versTableau(groupe.comptes);
    if (!comptes.includes(d.pseudo)) comptes.push(d.pseudo);
    groupe.comptes = comptes;
    delete groupe.slot_en_attente;
  }

  /* === INIT === */

  FI.initStaff = function (ancrage) {
    if (document.getElementById("fi-staff-panel")) return;
    // Vérification staff en double sécurité (initStaff est aussi conditionnel dans fiche-init.js)
    const pseudo = window.EcoCore.getPseudo();
    const estStaff = (window.EcoCore.ADMIN_USERS || []).includes(pseudo)
      || CFG.STAFF_USERS.includes(pseudo);
    if (!estStaff) return;

    const panel = creerPanel();
    ancrage.prepend(panel);
    chargerDemandes(panel.querySelector("#fi-staff-liste"))
      .catch((e) => {
        const el = panel.querySelector("#fi-staff-liste");
        if (el) el.textContent = T.ERR_DONNEES + " (" + e.message + ")";
      });
  };

})(window.FI, window.FI.CFG, window.FI.TEXTES);
