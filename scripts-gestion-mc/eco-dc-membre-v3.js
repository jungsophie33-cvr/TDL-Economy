/*
 * eco-dc-membre.js — Modale de demande multi-compte (côté membre) · TDL
 *
 * CE QUE CE FICHIER FAIT : crée le bouton déclencheur et la modale, vérifie les
 * conditions d'éligibilité en lisant le profil FA et la base, soumet la demande.
 * CE QU'IL NE FAIT PAS : validation staff, gestion des groupes.
 *
 * CARTE DES BLOCS :
 *   RENDER     — bouton d'appel et structure DOM de la modale
 *   EVENTS     — ouverture / fermeture / Échap
 *   CONDITIONS — règles métier et affichage des cartes de conditions
 *   SOUMISSION — écriture et pré-remplissage de la réponse FA
 *   INIT       — point d'entrée exposé sur window.DC
 *
 * [v2] Rendu refait sur les classes « mc- » : conditions affichées en cartes
 * chiffrées plutôt qu'en liste ✅/❌, séparateur tdl-separator, modale 800 px.
 * Les identifiants d'éléments sont inchangés pour ne rien casser ailleurs.
 *
 * Dépend de : eco-dc-config.js, eco-dc-utils.js, window.EcoCore
 */

(function (DC, CFG, T) {
  "use strict";

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  /* === RENDER === */

  function creerBouton() {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <button class="mc-cta" type="button" data-act="ouvrir">
        <i class="fi fi-tr-feather"></i>
        <span><b>${T.BTN_OUVRIR}</b><em>${T.BTN_OUVRIR_SOUS}</em></span>
        <i class="fi fi-tr-angle-small-right"></i>
      </button>`;
    return wrapper;
  }

  // La modale est insérée dans <body> pour s'affranchir du stacking context du forum.
  // [MAJ] Si ForumActif change son z-index global, ajuster .mc-ovl dans le CSS.
  function creerModal() {
    const overlay = document.createElement("div");
    overlay.id = "dc-overlay";
    overlay.className = "mc-ovl";
    overlay.innerHTML = `
      <div class="mc-modal">
        <button class="mc-x" type="button" data-act="fermer" title="Fermer">${T.BTN_FERMER}</button>
        <tdl-separator></tdl-separator>
        <h3>${T.TITRE_MODAL}</h3>

        <div id="dc-zone-info">${T.CHARGEMENT}</div>

        <div id="dc-champs" style="display:none">
          <div class="mc-champ">
            <label class="mc-lbl" for="dc-resume">${T.LABEL_RESUME}</label>
            <textarea id="dc-resume" placeholder="${esc(T.PH_RESUME)}"></textarea>
          </div>
          <div class="mc-champ">
            <label class="mc-lbl" for="dc-avatar">${T.LABEL_AVATAR}</label>
            <input class="mc-in" id="dc-avatar" type="text" placeholder="${esc(T.PH_AVATAR)}">
          </div>
          <div class="mc-modal-act">
            <button class="mc-btn lg" id="dc-btn-soumettre" type="button">${T.BTN_SOUMETTRE}</button>
            <button class="mc-btn lg" type="button" data-act="annuler">${T.BTN_ANNULER}</button>
          </div>
        </div>

        <div class="dc-resultat" id="dc-resultat"></div>
      </div>`;
    return overlay;
  }

  /* === EVENTS === */

  function bindFermeture(overlay) {
    const fermer = () => {
      overlay.classList.remove("actif");
      document.body.style.overflow = "";
    };
    overlay.querySelector('[data-act="fermer"]').addEventListener("click", fermer);
    overlay.querySelector('[data-act="annuler"]').addEventListener("click", fermer);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) fermer(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("actif")) fermer();
    });
  }

  function ouvrir(overlay, pseudo) {
    overlay.classList.add("actif");
    document.body.style.overflow = "hidden";
    // Chargement différé : on ne lit le profil que si le membre ouvre réellement la modale
    if (!overlay.dataset.initialise) {
      overlay.dataset.initialise = "1";
      chargerConditions(overlay, pseudo).catch((e) => {
        blocage(overlay, `❌ Erreur : ${esc(e.message)}`);
      });
    }
  }

  /* === CONDITIONS === */

  // Message bloquant : aucune carte de condition, pas de formulaire.
  function blocage(overlay, html) {
    overlay.querySelector("#dc-zone-info").innerHTML =
      `<div class="mc-verdict ko"><i class="fi fi-tr-triangle-warning"></i><span>${html}</span></div>`;
  }

  async function chargerConditions(overlay, pseudo) {
    const zone = overlay.querySelector("#dc-zone-info");
    zone.innerHTML = `<p class="mc-vide">${T.CHARGEMENT_PROFIL}</p>`;

    const rec = await window.EcoCore.safeReadBin();
    if (!rec) { blocage(overlay, T.ERR_DONNEES); return; }

    rec.doubles_comptes = rec.doubles_comptes || {};
    // Firebase retourne les tableaux comme objets {0:{…}, 1:{…}} — normalisation obligatoire
    rec.demandes_dc = DC.versTableau(rec.demandes_dc);

    const { racine, comptes, estNouveau } = DC.infosGroupe(rec, pseudo);
    const empeche = verifierEligibilite(pseudo, rec, racine, comptes, estNouveau);
    if (empeche) { blocage(overlay, empeche); return; }

    const numeroDC = comptes.length + 1;
    const paiementRequis = numeroDC >= 3;
    const solde = rec.membres?.[pseudo]?.dollars ?? 0;

    // fetchProfil a un timeout de 6 s — si dépassé, les deux valeurs seront null.
    const [dateInscription, nbRP] = await Promise.all([
      DC.lireDateInscription(),
      DC.lireNbRP(),
    ]);
    if (dateInscription === null && nbRP === null) { blocage(overlay, T.ERR_PROFIL); return; }

    const mois = dateInscription ? DC.ancienneteEnMois(dateInscription) : null;
    const toutOk = afficherConditions(zone, mois, nbRP, paiementRequis, solde);
    if (!toutOk) return;

    overlay.querySelector("#dc-champs").style.display = "block";
    overlay.querySelector("#dc-btn-soumettre")
      .addEventListener("click", () => soumettre(overlay, pseudo, racine, numeroDC, paiementRequis));
  }

  // Vérifie les règles métier (ordre des comptes, limite, demande existante).
  // Retourne un message HTML d'erreur, ou null si OK.
  function verifierEligibilite(pseudo, rec, racine, comptes, estNouveau) {
    const dernier = comptes[comptes.length - 1];
    if (!estNouveau && pseudo !== dernier) return T.ERR_COMPTE_RECENT(dernier);
    if (comptes.length >= CFG.MAX_COMPTES) return T.ERR_MAX_COMPTES(CFG.MAX_COMPTES);
    const enCours = rec.demandes_dc.find(
      (d) => d.compte_racine === racine && d.statut === "en_attente"
    );
    if (enCours) return T.ERR_DEMANDE_EN_COURS(new Date(enCours.date).toLocaleDateString("fr-FR"));
    return null;
  }

  // Une carte de condition : icône, libellé, valeur, minimum requis, état.
  function carteCondition(ic, lbl, valeur, min, ok, manque) {
    return `
      <div>
        <span class="ic"><i class="fi ${ic}"></i></span>
        <span class="val"><b>${lbl}</b><strong>${esc(valeur)}</strong><em>${esc(min)}</em></span>
        <span class="etat ${ok ? "ok" : "ko"}">
          <i class="fi ${ok ? "fi-tr-check-circle" : "fi-tr-cross-circle"}"></i>
          ${!ok && manque ? `<small>${esc(manque)}</small>` : ""}
        </span>
      </div>`;
  }

  // Affiche les cartes de conditions + le verdict. Retourne true si tout est rempli.
  function afficherConditions(zone, mois, nbRP, paiementRequis, solde) {
    const inconnu = T.COND_INCONNU;
    const inscOk  = mois !== null && mois >= CFG.MOIS_ANCIENNETE;
    const rpOk    = nbRP !== null && nbRP >= CFG.RP_MINIMUM;
    const soldeOk = !paiementRequis || solde >= CFG.COUT_DC;

    let cartes = carteCondition("fi-tr-hourglass-end", T.COND_ANCIENNETE,
      mois !== null ? T.COND_MOIS(mois) : inconnu,
      T.COND_MIN_MOIS(CFG.MOIS_ANCIENNETE), inscOk,
      mois !== null ? T.COND_MANQUE_MOIS(CFG.MOIS_ANCIENNETE - mois) : null);

    cartes += carteCondition("fi-tr-comment-alt", T.COND_RP,
      nbRP !== null ? String(nbRP) : inconnu,
      T.COND_MIN_RP(CFG.RP_MINIMUM), rpOk,
      nbRP !== null ? T.COND_MANQUE_RP(CFG.RP_MINIMUM - nbRP) : null);

    if (paiementRequis) {
      cartes += carteCondition("fi-tr-sack-dollar", T.COND_SOLDE,
        solde + " $", T.COND_MIN_SOLDE(CFG.COUT_DC), soldeOk,
        T.COND_MANQUE_SOLDE(CFG.COUT_DC - solde));
    }

    const ok = inscOk && rpOk && soldeOk;
    zone.innerHTML = `<div class="mc-cond">${cartes}</div>`
      + `<div class="mc-verdict ${ok ? "ok" : "ko"}">
           <i class="fi ${ok ? "fi-tr-check-circle" : "fi-tr-triangle-warning"}"></i>
           <span>${ok ? T.COND_OK : T.COND_KO}</span>
         </div>`;
    return ok;
  }

  /* === SOUMISSION === */

  async function soumettre(overlay, pseudo, racine, numeroDC, paiementRequis) {
    const resume   = overlay.querySelector("#dc-resume").value.trim();
    const avatar   = overlay.querySelector("#dc-avatar").value.trim();
    const resultat = overlay.querySelector("#dc-resultat");
    const btn      = overlay.querySelector("#dc-btn-soumettre");

    // Le faceclaim est facultatif : un membre peut demander son multi-compte
    // sans avoir encore arrêté son choix d'acteur. Seul le résumé est requis.
    if (resume.length < 30) { DC.afficherResultat(resultat, "erreur", T.ERR_RESUME_COURT); return; }

    btn.disabled    = true;
    btn.textContent = T.ENVOI_EN_COURS;

    try {
      const rec = await window.EcoCore.readBin();
      rec.doubles_comptes = rec.doubles_comptes || {};
      rec.demandes_dc     = DC.versTableau(rec.demandes_dc);

      const solde = rec.membres?.[pseudo]?.dollars ?? 0;
      if (paiementRequis && solde < CFG.COUT_DC) {
        DC.afficherResultat(resultat, "erreur", T.ERR_SOLDE(solde));
        btn.disabled = false; btn.textContent = T.BTN_SOUMETTRE;
        return;
      }
      if (avatar && avatarIndisponible(rec, avatar)) {
        DC.afficherResultat(resultat, "erreur", T.ERR_AVATAR_PRIS(avatar));
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
      DC.afficherResultat(resultat, "succes",
        T.CONFIRMATION(numeroDC, paiementRequis, CFG.COUT_DC, monnaie));
      overlay.querySelector("#dc-champs").style.display = "none";

    } catch (_) {
      DC.afficherResultat(resultat, "erreur", T.ERR_ENVOI);
      btn.disabled = false; btn.textContent = T.BTN_SOUMETTRE;
    }
  }

  // Renvoie true si l'acteur est indisponible : carte « pris », ou « reserve »
  // non expirée. Une carte « libre » (pré-lien) ou une réservation expirée ne bloque pas.
  function avatarIndisponible(rec, acteur) {
    const cle = DC.normaliserCleFC(acteur);
    const c = rec.faceclaims?.[cle];
    if (!c) return false;
    if (c.statut === "pris") return true;
    if (c.statut === "reserve") return !(c.expiration && c.expiration < Date.now());
    return false;   // « libre » (pré-lien) → réservable
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
    if (!DC.normaliserCleFC) {
      if (window.console) console.error("[eco-dc-membre] eco-dc-gestion.js doit être chargé avant ce fichier.");
      return;
    }
    const wrapper = creerBouton();
    const overlay = creerModal();

    ancrage.appendChild(wrapper);
    document.body.appendChild(overlay);

    bindFermeture(overlay);
    wrapper.querySelector('[data-act="ouvrir"]')
      .addEventListener("click", () => ouvrir(overlay, pseudo));
  };

})(window.DC, window.DC.CFG, window.DC.TEXTES);
