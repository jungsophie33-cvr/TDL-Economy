/*
 * fiche-membre.js — Formulaire de demande de validation de fiche · TDL
 *
 * CE QUE CE FICHIER FAIT : bouton déclencheur, modale avec les 14 champs de la demande,
 * toggles conditionnels, vérification de doublon, validation des champs,
 * écriture JSONBin et pré-remplissage du textarea.
 * CE QU'IL NE FAIT PAS : aucune logique staff, aucune action post-validation.
 *
 * CARTE DES BLOCS :
 *   RENDER BOUTON    — bouton déclencheur
 *   RENDER OPTIONS   — helpers pour les balises <option>
 *   RENDER SECTIONS  — HTML des deux sections du formulaire
 *   RENDER MODAL     — assemblage complet de la modale
 *   EVENTS FERMETURE — binding fermeture (✕, Annuler, Échap, overlay)
 *   EVENTS TOGGLES   — affichage conditionnel des sous-champs
 *   CHARGEMENT       — vérification doublon + chargement des listes membres
 *   LECTURE          — extraction des valeurs du formulaire
 *   VALIDATION       — vérification des champs obligatoires
 *   SOUMISSION       — écriture JSONBin et pré-remplissage
 *   INIT             — point d'entrée exposé sur window.FI
 *
 * Dépend de : fiche-config.js, fiche-utils.js, window.EcoCore
 */

(function (FI, CFG, T) {
  "use strict";

  /* === RENDER BOUTON === */

  function creerBouton() {
    const w = document.createElement("div");
    w.style.textAlign = "center";
    w.innerHTML = `<button class="fi-btn-ouvrir">${T.BTN_OUVRIR}</button>`;
    return w;
  }

  /* === RENDER OPTIONS === */

  function opts(liste) {
    return liste.map((v) => `<option value="${v}">${v}</option>`).join("");
  }

  function optsAvecVide(liste) {
    return `<option value="">— Choisir —</option>` + opts(liste);
  }

  /* === RENDER SECTIONS === */

  function htmlSectionPrincipale() {
    return `
      <label class="fi-label">${T.L_LIEN_FICHE}</label>
      <input id="fi-lien-fiche" class="fi-input" type="url" placeholder="https://…">

      <div class="fi-rangee">
        <span class="fi-label">${T.L_PRE_LIEN}</span>
        <label><input type="radio" name="fi-prelien" value="non" checked> Non</label>
        <label><input type="radio" name="fi-prelien" value="oui"> Oui</label>
      </div>
      <div id="fi-prelien-detail" class="fi-conditionnel">
        <label class="fi-label">${T.L_LIEN_PRE_LIEN}</label>
        <input id="fi-lien-prelien" class="fi-input" type="url" placeholder="https://…">
      </div>

      <label class="fi-label">${T.L_PARRAIN}</label>
      <select id="fi-parrain" class="fi-select">
        <option value="Personne">Personne</option>
      </select>

      <div class="fi-rangee">
        <span class="fi-label">${T.L_MULTICOMPTE}</span>
        <label><input type="radio" name="fi-mc" value="non" checked> Non</label>
        <label><input type="radio" name="fi-mc" value="oui"> Oui</label>
      </div>
      <div id="fi-mc-detail" class="fi-conditionnel">
        <label class="fi-label">${T.L_PREMIER_COMPTE}</label>
        <select id="fi-premier-compte" class="fi-select">
          <option value="">Chargement…</option>
        </select>
      </div>

     <label class="fi-label">${T.L_FC_MODE}</label>
      <select id="fi-fc-mode" class="fi-select">
        <option value="sans">${T.FC_MODE_SANS}</option>
        <option value="sept">${T.FC_MODE_7J}</option>
        <option value="mc">${T.FC_MODE_MC}</option>
        <option value="prelien">${T.FC_MODE_PRELIEN}</option>
      </select>

      <div id="fi-fc-liste-wrap" class="fi-conditionnel">
        <label class="fi-label">${T.L_FC_CHOIX}</label>
        <select id="fi-fc-liste" class="fi-select"></select>
      </div>

      <label class="fi-label">${T.L_FACECLAIM}</label>
      <input id="fi-faceclaim" class="fi-input" type="text"
        placeholder="Nom du Faceclaim">

      <label class="fi-label">${T.L_GROUPE}</label>
      <select id="fi-groupe" class="fi-select">${optsAvecVide(CFG.LISTES.GROUPES)}</select>
    `;
  }

  function htmlSectionDetails() {
    return `
      <div class="fi-rangee">
        <span class="fi-label">${T.L_BANDE}</span>
        <label><input type="radio" name="fi-bande" value="non" checked> Non</label>
        <label><input type="radio" name="fi-bande" value="oui"> Oui</label>
      </div>
      <div id="fi-bande-detail" class="fi-conditionnel">
        <label class="fi-label">${T.L_NOM_BANDE}</label>
        <select id="fi-nom-bande" class="fi-select">${optsAvecVide(CFG.LISTES.BANDES)}</select>
        <label class="fi-label">${T.L_ROLE_BANDE}</label>
        <input id="fi-role-bande" class="fi-input" type="text"
          placeholder="Votre rôle dans la bande…">
      </div>

      <fieldset class="fi-fieldset">
        <legend>Métier</legend>
        <label class="fi-label">${T.L_LIEU_METIER}</label>
        <select id="fi-lieu-metier" class="fi-select">${optsAvecVide(CFG.LISTES.LIEUX_METIER)}</select>
        <label class="fi-label">${T.L_SOCIETE}</label>
        <input id="fi-societe" class="fi-input" type="text"
          placeholder="Nom de la société ou lieu de travail">
        <label class="fi-label">${T.L_EMPLOI}</label>
        <input id="fi-emploi" class="fi-input" type="text" placeholder="Intitulé du poste">
      </fieldset>

      <fieldset class="fi-fieldset">
        <legend>Habitation</legend>
        <label class="fi-label">${T.L_LIEU_HAB}</label>
        <select id="fi-lieu-habitation" class="fi-select">
          ${optsAvecVide(CFG.LISTES.LIEUX_HABITATION)}
        </select>
        <div class="fi-rangee">
          <div style="flex:1">
            <label class="fi-label">${T.L_NUMERO}</label>
            <input id="fi-numero" class="fi-input" type="text" placeholder="Ex : n°14">
          </div>
          <div style="flex:1">
            <label class="fi-label">${T.L_TYPE_LOGEMENT}</label>
            <input id="fi-type-logement" class="fi-input" type="text" placeholder="Vérifier dans le sujet bottin des logements">
          </div>
        </div>
      </fieldset>
    `;
  }

  /* === RENDER MODAL === */

  function creerModal() {
    const overlay = document.createElement("div");
    overlay.id = "fi-overlay";
    overlay.className = "dc-overlay";
    overlay.innerHTML = `
      <div class="dc-boite fi-boite">
        <button class="dc-btn-fermer">${T.BTN_FERMER}</button>
        <h3 class="dc-titre">${T.TITRE_MODAL}</h3>
        <div id="fi-info-doublon" class="dc-zone-info" style="display:none;"></div>
        <div id="fi-champs" class="fi-champs">
          ${htmlSectionPrincipale()}
          ${htmlSectionDetails()}
          <div class="dc-actions" style="margin-top:16px;">
            <button id="fi-btn-soumettre" class="dc-btn-soumettre">${T.BTN_SOUMETTRE}</button>
            <button class="fi-btn-annuler dc-btn-annuler">${T.BTN_ANNULER}</button>
          </div>
        </div>
        <div id="fi-resultat" class="fi-resultat"></div>
      </div>`;
    return overlay;
  }

  /* === EVENTS FERMETURE === */

  function bindFermeture(overlay) {
    const fermer = () => {
      overlay.classList.remove("actif");
      document.body.style.overflow = "";
    };
    overlay.querySelector(".dc-btn-fermer").addEventListener("click", fermer);
    overlay.querySelector(".fi-btn-annuler").addEventListener("click", fermer);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) fermer(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("actif")) fermer();
    });
  }

  /* === EVENTS TOGGLES === */

  function bindToggle(overlay, radioName, valeur, cibleId) {
    overlay.querySelectorAll(`[name="${radioName}"]`).forEach((r) => {
      r.addEventListener("change", () => {
        const actif = overlay.querySelector(`[name="${radioName}"]:checked`).value === valeur;
        overlay.querySelector(`#${cibleId}`).classList.toggle("fi-visible", actif);
      });
    });
  }

  function bindToggles(overlay) {
    bindToggle(overlay, "fi-prelien", "oui", "fi-prelien-detail");
    bindToggle(overlay, "fi-mc",      "oui", "fi-mc-detail");
    bindToggle(overlay, "fi-bande",   "oui", "fi-bande-detail");
  }

  /* === CHARGEMENT === */

  // Vérifie si une demande existe déjà pour ce membre (en_attente ou validee).
  // Retourne un message HTML ou null.
  async function verifierDoublon(pseudo) {
    const rec = await window.EcoCore.safeReadBin();
    if (!rec) return null;
    const demande = FI.versTableau(rec.demandes_fiche).find(
      (d) => d.pseudo === pseudo && (d.statut === "en_attente" || d.statut === "validee")
    );
    if (!demande) return null;
    return demande.statut === "en_attente"
      ? "⏳ Vous avez déjà une demande de validation en cours. Attendez la décision du staff."
      : "✅ Votre fiche a déjà été validée. Contactez un admin si vous avez besoin d'aide.";
  }

  async function chargerListesMembres(overlay, pseudo) {
    const doublon = await verifierDoublon(pseudo);
    if (doublon) {
      const info = overlay.querySelector("#fi-info-doublon");
      info.textContent = doublon;
      info.style.display = "block";
      overlay.querySelector("#fi-champs").style.display = "none";
      return;
    }

    const [membres, racinesDC] = await Promise.all([
      FI.chargerMembres(),
      FI.chargerRacinesDCEnAttente(),
    ]);

    overlay.querySelector("#fi-parrain").innerHTML =
      `<option value="Personne">Personne</option>` +
      membres.map((m) => `<option value="${m}">${m}</option>`).join("");

    const msgVide = racinesDC.length
      ? "— Sélectionne le compte principal —"
      : "Aucun multicompte en attente de fiche";
    overlay.querySelector("#fi-premier-compte").innerHTML =
      `<option value="">${msgVide}</option>` +
      racinesDC.map((m) => `<option value="${m}">${m}</option>`).join("");

    const recFC = await window.EcoCore.safeReadBin();
    chargerFaceclaims(recFC);
  }

  /* === FACECLAIM (modes de réservation) === */

  let _fcCartes = [];   // cartes du bottin faceclaims (lecture)
  let _fcMembres = {};  // rec.membres, pour résoudre premier_compte → uid

  function chargerFaceclaims(rec) {
    _fcMembres = (rec && rec.membres) || {};
    const fc = (rec && rec.faceclaims) || {};
    _fcCartes = Object.keys(fc)
      .map((cle) => Object.assign({ cle }, fc[cle]))
      .filter((c) => c && c.acteur);
  }

  function peuplerListeFC(overlay, mode) {
    const sel = overlay.querySelector("#fi-fc-liste");
    const uid = window._userdata?.user_id;
    let cartes = [], vide = "";

    if (mode === "sept") {
      cartes = _fcCartes.filter((c) => c.statut === "reserve" && c.type === "validation7j"
        && String(c.uid) === String(uid));
      vide = T.FC_VIDE_7J;
    } else if (mode === "mc") {
      const racine = overlay.querySelector("#fi-premier-compte")?.value;
      if (!racine) { sel.innerHTML = `<option value="">${T.FC_VIDE_MC}</option>`; return; }
      const uidRacine = _fcMembres[racine]?.uid;
      cartes = _fcCartes.filter((c) => c.statut === "reserve" && c.type === "multicompte"
        && String(c.uid) === String(uidRacine));
      vide = T.FC_VIDE_MC_AUCUNE;
    } else if (mode === "prelien") {
      cartes = _fcCartes.filter((c) => c.statut === "libre");
      vide = T.FC_VIDE_PRELIEN;
    }

    const options = cartes.map((c) => {
      const etq = c.nom_prelien ? `${c.acteur} — ${c.nom_prelien}` : c.acteur;
      return `<option value="${c.acteur}">${etq}</option>`;
    }).join("");

    sel.innerHTML = `<option value="">${T.FC_OPT_CHOISIR}</option>`
      + (cartes.length ? options : `<option value="" disabled>${vide}</option>`)
      + `<option value="__autre__">${T.FC_OPT_AUTRE}</option>`;
  }

  function appliquerModeFC(overlay) {
    const mode  = overlay.querySelector("#fi-fc-mode").value;
    const wrap  = overlay.querySelector("#fi-fc-liste-wrap");
    const input = overlay.querySelector("#fi-faceclaim");

    if (mode === "sans") {
      wrap.classList.remove("fi-visible");
      input.readOnly = false;
      input.value = "";
      return;
    }
    peuplerListeFC(overlay, mode);
    wrap.classList.add("fi-visible");
    input.readOnly = true;   // débloqué seulement via « Autre (saisie libre) »
    input.value = "";
  }

  function bindFaceclaimModes(overlay) {
    overlay.querySelector("#fi-fc-mode")
      .addEventListener("change", () => appliquerModeFC(overlay));

    overlay.querySelector("#fi-fc-liste").addEventListener("change", (e) => {
      const input = overlay.querySelector("#fi-faceclaim");
      if (e.target.value === "__autre__") { input.readOnly = false; input.value = ""; input.focus(); }
      else { input.readOnly = true; input.value = e.target.value; }
    });

    // recalcule la liste multicompte si le compte racine change
    overlay.querySelector("#fi-premier-compte")?.addEventListener("change", () => {
      if (overlay.querySelector("#fi-fc-mode").value === "mc") peuplerListeFC(overlay, "mc");
    });
  }

  /* === LECTURE === */

  function radio(overlay, name) {
    return overlay.querySelector(`[name="${name}"]:checked`)?.value || "non";
  }

  function lireDemande(overlay) {
    return {
      lien_fiche:      overlay.querySelector("#fi-lien-fiche").value.trim(),
      pre_lien:        radio(overlay, "fi-prelien") === "oui",
      lien_pre_lien:   overlay.querySelector("#fi-lien-prelien").value.trim(),
      parrain:         overlay.querySelector("#fi-parrain").value,
      multicompte:     radio(overlay, "fi-mc") === "oui",
      premier_compte:  overlay.querySelector("#fi-premier-compte").value,
      faceclaim:       overlay.querySelector("#fi-faceclaim").value.trim(),
      groupe:          overlay.querySelector("#fi-groupe").value,
      bande:           radio(overlay, "fi-bande") === "oui",
      nom_bande:       overlay.querySelector("#fi-nom-bande").value,
      role_bande:      overlay.querySelector("#fi-role-bande").value.trim(),
      lieu_metier:     overlay.querySelector("#fi-lieu-metier").value,
      societe:         overlay.querySelector("#fi-societe").value.trim(),
      emploi:          overlay.querySelector("#fi-emploi").value.trim(),
      lieu_habitation: overlay.querySelector("#fi-lieu-habitation").value,
      numero:          overlay.querySelector("#fi-numero").value.trim(),
      type_logement:   overlay.querySelector("#fi-type-logement").value.trim(),
    };
  }

  /* === VALIDATION === */

  function verifierChamps(d) {
    if (!d.lien_fiche)                      return T.ERR_LIEN_FICHE;
    if (d.pre_lien && !d.lien_pre_lien)     return T.ERR_LIEN_PRELIEN;
    if (d.multicompte && !d.premier_compte) return T.ERR_PREMIER_COMPTE;
    if (!d.faceclaim)                       return T.ERR_FACECLAIM;
    if (!d.groupe)                          return T.ERR_GROUPE;
    if (d.bande && !d.nom_bande)            return T.ERR_BANDE_NOM;
    if (d.bande && !d.role_bande)           return T.ERR_BANDE_ROLE;
    if (!d.lieu_metier)                     return T.ERR_LIEU_METIER;
    if (!d.societe)                         return T.ERR_SOCIETE;
    if (!d.emploi)                          return T.ERR_EMPLOI;
    if (!d.lieu_habitation)                 return T.ERR_LIEU_HAB;
    if (!d.numero)                          return T.ERR_NUMERO;
    if (!d.type_logement)                   return T.ERR_TYPE_LOGEMENT;
    return null;
  }

  /* === SOUMISSION === */

  async function soumettre(overlay, pseudo) {
    const d       = lireDemande(overlay);
    const erreur  = verifierChamps(d);
    const resultat = overlay.querySelector("#fi-resultat");
    const btn     = overlay.querySelector("#fi-btn-soumettre");

    if (erreur) { FI.afficherResultat(resultat, "erreur", erreur); return; }

    btn.disabled = true;
    btn.textContent = T.ENVOI_EN_COURS;

    try {
      const rec = await window.EcoCore.readBin();
      rec.demandes_fiche = FI.versTableau(rec.demandes_fiche);

      const demande = {
        id:     FI.genId(),
        date:   new Date().toISOString(),
        pseudo,
        uid:    window._userdata?.user_id || null,
        statut: "en_attente",
        ...d,
      };
      rec.demandes_fiche.push(demande);
      await window.EcoCore.writeBin(rec);

      FI.preremplirReponse(FI.bbcodeDemande(demande));
      FI.afficherResultat(resultat, "succes", T.CONFIRMATION);
      overlay.querySelector("#fi-champs").style.display = "none";

    } catch (_) {
      FI.afficherResultat(resultat, "erreur", T.ERR_ENVOI);
      btn.disabled = false;
      btn.textContent = T.BTN_SOUMETTRE;
    }
  }

  /* === INIT === */

  FI.initMembre = function (ancrage, pseudo) {
    if (document.getElementById("fi-overlay")) return;

    const bouton  = creerBouton();
    const overlay = creerModal();

    ancrage.appendChild(bouton);
    document.body.appendChild(overlay);

    bindFermeture(overlay);
    bindToggles(overlay);
    bindFaceclaimModes(overlay);

    bouton.querySelector(".fi-btn-ouvrir").addEventListener("click", () => {
      overlay.classList.add("actif");
      document.body.style.overflow = "hidden";
      if (!overlay.dataset.initialise) {
        overlay.dataset.initialise = "1";
        chargerListesMembres(overlay, pseudo);
      }
    });

    overlay.querySelector("#fi-btn-soumettre")
      .addEventListener("click", () => soumettre(overlay, pseudo));
  };

})(window.FI, window.FI.CFG, window.FI.TEXTES);
