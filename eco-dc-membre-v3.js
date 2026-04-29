/*
 * eco-dc-membre.js — Modal de demande multi-compte (côté membre) · TDL
 *
 * CE QUE CE FICHIER FAIT : crée le bouton déclencheur et la modale, vérifie les
 * conditions d'éligibilité en lisant le profil FA et le JSONBin, soumet la demande.
 * CE QU'IL NE FAIT PAS : validation staff, ajout de pseudo après création de compte.
 *
 * CARTE DES BLOCS :
 *   RENDER     — création du bouton et de la structure DOM de la modale
 *   EVENTS     — binding ouverture / fermeture / Échap
 *   CONDITIONS — vérification des règles métier et affichage du récap
 *   SOUMISSION — écriture JSONBin et pré-remplissage de la réponse FA
 *   INIT       — point d'entrée exposé sur window.DC
 *
 * Dépend de : eco-dc-config.js, eco-dc-utils.js, window.EcoCore
 */

(function (DC, CFG, T) {
  "use strict";

  /* === RENDER === */

  function creerBouton() {
    const wrapper = document.createElement("div");
    wrapper.style.textAlign = "center"; // centrage uniquement — pas de classe pour ça
    wrapper.innerHTML = `<button class="dc-btn-ouvrir">${T.BTN_OUVRIR}</button>`;
    return wrapper;
  }

  // La modale est insérée dans <body> pour s'affranchir du stacking context du forum.
  // [MAJ] Si ForumActif change son z-index global, ajuster .dc-overlay dans le CSS.
  function creerModal(monnaie) {
    const overlay = document.createElement("div");
    overlay.id = "dc-overlay";
    overlay.className = "dc-overlay";
    overlay.innerHTML = `
      <div class="dc-boite">
        <button class="dc-btn-fermer" title="Fermer">${T.BTN_FERMER}</button>
        <h3 class="dc-titre">${T.TITRE_MODAL}</h3>

        <div id="dc-zone-info" class="dc-zone-info">${T.CHARGEMENT}</div>

        <div id="dc-champs" class="dc-champs">
          <label class="dc-label">${T.LABEL_RESUME}</label>
          <textarea id="dc-resume" class="dc-textarea" rows="6"
            placeholder="${T.PH_RESUME}"></textarea>

          <label class="dc-label">${T.LABEL_AVATAR}</label>
          <textarea id="dc-avatar" class="dc-textarea" rows="3"
            placeholder="${T.PH_AVATAR}"></textarea>

          <div id="dc-avert-paiement" class="dc-avertissement-paiement">
            ⚠️ À partir du 3e compte, un paiement de
            <strong>${CFG.COUT_DC} ${monnaie}</strong>
            sera débité automatiquement à la validation.<br>
            Votre solde : <span id="dc-solde">?</span> ${monnaie}.
          </div>

          <div class="dc-actions">
            <button id="dc-btn-soumettre" class="dc-btn-soumettre">${T.BTN_SOUMETTRE}</button>
            <button class="dc-btn-annuler">${T.BTN_ANNULER}</button>
          </div>
        </div>

        <div id="dc-resultat" class="dc-resultat"></div>
      </div>
    `;
    return overlay;
  }

  /* === EVENTS === */

  function bindFermeture(overlay) {
    const fermer = () => {
      overlay.classList.remove("actif");
      document.body.style.overflow = "";
    };
    overlay.querySelector(".dc-btn-fermer").addEventListener("click", fermer);
    overlay.querySelector(".dc-btn-annuler").addEventListener("click", fermer);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) fermer(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("actif")) fermer();
    });
  }

  function ouvrir(overlay, pseudo) {
    overlay.classList.add("actif");
    document.body.style.overflow = "hidden";
    // Chargement différé : fetch profil seulement si le membre ouvre réellement la modale
    if (!overlay.dataset.initialise) {
      overlay.dataset.initialise = "1";
      chargerConditions(overlay, pseudo).catch((e) => {
        const z = overlay.querySelector("#dc-zone-info");
        if (z) z.innerHTML = `<span style="color:red">❌ Erreur : ${e.message}</span>`;
      });
    }
  }

  /* === CONDITIONS === */

  async function chargerConditions(overlay, pseudo) {
    const zoneInfo = overlay.querySelector("#dc-zone-info");
    zoneInfo.textContent = T.CHARGEMENT_PROFIL;

    const rec = await window.EcoCore.safeReadBin();
    if (!rec) { zoneInfo.innerHTML = T.ERR_DONNEES; return; }

    rec.doubles_comptes = rec.doubles_comptes || {};
    rec.demandes_dc     = rec.demandes_dc     || [];

    const { racine, comptes, estNouveau } = DC.infosGroupe(rec, pseudo);
    const blocage = verifierEligibilite(pseudo, rec, racine, comptes, estNouveau);
    if (blocage) { zoneInfo.innerHTML = blocage; return; }

    const numeroDC = comptes.length + 1;
    const paiementRequis = numeroDC >= 3;
    const solde = rec.membres?.[pseudo]?.dollars ?? 0;

    // fetchProfil a un timeout de 6s — si dépassé, les deux valeurs seront null.
    const [dateInscription, nbRP] = await Promise.all([
      DC.lireDateInscription(),
      DC.lireNbRP(),
    ]);

    // Si les deux sont null, c'est un échec réseau (profil introuvable ou timeout)
    if (dateInscription === null && nbRP === null) {
      zoneInfo.innerHTML = "<span style=\"color:#b87700;\">⚠️ Impossible de lire votre profil (délai dépassé ou erreur réseau).<br>Rechargez la page et réessayez. Si le problème persiste, contactez un admin.</span>";
      return;
    }

    const ancienneteMois = dateInscription ? DC.ancienneteEnMois(dateInscription) : null;
    const toutOk = afficherRecapConditions(zoneInfo, ancienneteMois, nbRP, paiementRequis, solde, numeroDC);
    if (!toutOk) return;

    afficherChamps(overlay, paiementRequis, solde);
    overlay.querySelector("#dc-btn-soumettre")
      .addEventListener("click", () => soumettre(overlay, pseudo, racine, numeroDC, paiementRequis));
  }

  // Vérifie les règles métier (ordre des comptes, limite, demande existante).
  // Retourne un message HTML d'erreur, ou null si OK.
  function verifierEligibilite(pseudo, rec, racine, comptes, estNouveau) {
    const dernier = comptes[comptes.length - 1];
    if (!estNouveau && pseudo !== dernier)  return T.ERR_COMPTE_RECENT(dernier);
    if (comptes.length >= CFG.MAX_COMPTES) return T.ERR_MAX_COMPTES(CFG.MAX_COMPTES);
    const enCours = rec.demandes_dc.find(
      (d) => d.compte_racine === racine && d.statut === "en_attente"
    );
    if (enCours) return T.ERR_DEMANDE_EN_COURS(new Date(enCours.date).toLocaleDateString("fr-FR"));
    return null;
  }

  // Affiche le récapitulatif ✅/❌ des conditions dans la zone info.
  // Retourne true si toutes les conditions sont remplies.
  function afficherRecapConditions(zoneInfo, ancienneteMois, nbRP, paiementRequis, solde, numeroDC) {
    const ligne = (ok, txt) => `<li>${ok ? "✅" : "❌"} ${txt}</li>`;
    const inscOk  = ancienneteMois !== null && ancienneteMois >= CFG.MOIS_ANCIENNETE;
    const rpOk    = nbRP !== null && nbRP >= CFG.RP_MINIMUM;
    const soldeOk = !paiementRequis || solde >= CFG.COUT_DC;

    zoneInfo.innerHTML = `
      <ul>
        ${ligne(inscOk,  `Ancienneté : <strong>${ancienneteMois ?? "?"} mois</strong> (min. ${CFG.MOIS_ANCIENNETE})`)}
        ${ligne(rpOk,    `Posts RP : <strong>${nbRP ?? "?"}</strong> (min. ${CFG.RP_MINIMUM})`)}
        ${paiementRequis ? ligne(soldeOk, `Solde : <strong>${solde} $</strong> (min. ${CFG.COUT_DC} pour le ${numeroDC}e compte)`) : ""}
      </ul>`;

    if (!inscOk || !rpOk || !soldeOk) {
      zoneInfo.innerHTML += `<div class="dc-resultat erreur">${T.ERR_CONDITIONS}</div>`;
      return false;
    }
    return true;
  }

  function afficherChamps(overlay, paiementRequis, solde) {
    overlay.querySelector("#dc-champs").style.display = "block";
    if (paiementRequis) {
      overlay.querySelector("#dc-avert-paiement").style.display = "block";
      overlay.querySelector("#dc-solde").textContent = solde;
    }
  }

  /* === SOUMISSION === */

  async function soumettre(overlay, pseudo, racine, numeroDC, paiementRequis) {
    const resume   = overlay.querySelector("#dc-resume").value.trim();
    const avatar   = overlay.querySelector("#dc-avatar").value.trim();
    const resultat = overlay.querySelector("#dc-resultat");
    const btn      = overlay.querySelector("#dc-btn-soumettre");

    if (resume.length < 30) { DC.afficherResultat(resultat, "erreur", T.ERR_RESUME_COURT); return; }
    if (avatar.length < 5)  { DC.afficherResultat(resultat, "erreur", T.ERR_AVATAR_VIDE);  return; }

    btn.disabled    = true;
    btn.textContent = T.ENVOI_EN_COURS;

    try {
      const rec = await window.EcoCore.readBin();
      rec.doubles_comptes = rec.doubles_comptes || {};
      rec.demandes_dc     = rec.demandes_dc     || [];

      const solde = rec.membres?.[pseudo]?.dollars ?? 0;
      if (paiementRequis && solde < CFG.COUT_DC) {
        DC.afficherResultat(resultat, "erreur", T.ERR_SOLDE(solde));
        btn.disabled = false; btn.textContent = T.BTN_SOUMETTRE;
        return;
      }

      const demande = construireDemande(pseudo, racine, numeroDC, paiementRequis, solde, resume, avatar);
      rec.demandes_dc.push(demande);

      if (!rec.doubles_comptes[racine]) {
        rec.doubles_comptes[racine] = { comptes: [racine], demande_en_cours: false };
      }
      rec.doubles_comptes[racine].demande_en_cours = true;

      await window.EcoCore.writeBin(rec);

      const monnaie = window.EcoCore.MONNAIE_NAME;
      DC.preremplirReponse(DC.msgMembre(demande, monnaie));
      DC.afficherResultat(resultat, "succes", T.CONFIRMATION(numeroDC, paiementRequis, CFG.COUT_DC, monnaie));
      overlay.querySelector("#dc-champs").style.display = "none";

    } catch (_) {
      DC.afficherResultat(resultat, "erreur", T.ERR_ENVOI);
      btn.disabled = false; btn.textContent = T.BTN_SOUMETTRE;
    }
  }

  function construireDemande(pseudo, racine, numeroDC, paiementRequis, solde, resume, avatar) {
    return {
      id:               DC.genId(),
      date:             new Date().toISOString(),
      compte_demandeur: pseudo,
      compte_racine:    racine,
      numero_dc:        numeroDC,
      paiement_requis:  paiementRequis,
      solde_avant:      solde,
      resume,
      avatar_reserve:   avatar,
      statut:           "en_attente",
    };
  }

  /* === INIT === */

  DC.initMembre = function (ancrage, pseudo) {
    if (document.getElementById("dc-overlay")) return;
    const monnaie = window.EcoCore.MONNAIE_NAME;
    const wrapper = creerBouton();
    const overlay = creerModal(monnaie);

    ancrage.appendChild(wrapper);
    document.body.appendChild(overlay);

    bindFermeture(overlay);
    wrapper.querySelector(".dc-btn-ouvrir")
      .addEventListener("click", () => ouvrir(overlay, pseudo));
  };

})(window.DC, window.DC.CFG, window.DC.TEXTES);
