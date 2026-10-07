/*
 * fiche-membre.js — Formulaire de demande de validation de fiche · TDL
 *
 * CE QUE CE FICHIER FAIT : bouton déclencheur, modale avec les champs de la demande,
 * toggles conditionnels, vérification de doublon, validation des champs,
 * écriture de la demande et pré-remplissage du textarea.
 * CE QU'IL NE FAIT PAS : aucune logique staff, aucune action post-validation.
 *
 * [MAJ v2] PLUS DE readBin / writeBin.
 *   soumettre() lisait la racine entière, poussait la demande dans le tableau
 *   et réécrivait la branche demandes_fiche en bloc. Deux membres soumettant
 *   dans la même fenêtre : la seconde écriture effaçait la première.
 *   La demande part maintenant sous sa propre clé, en un seul chemin.
 *
 * [MAJ v2] demandes_fiche DEVIENT UN NŒUD À CLÉS, et la conversion se fait
 *   d'elle-même, atomiquement, au premier écrit qui rencontre un tableau : le
 *   tableau converti ET la nouvelle demande partent dans le MÊME PATCH, donc
 *   rien ne peut se perdre entre les deux.
 *   C'est ce qui permet à fiche-staff de viser une demande par sa clé — son
 *   refus filtrait le tableau, ce qui réindexait tout et déplaçait la cible
 *   d'une validation concurrente.
 *
 * [MAJ v2] LECTURES CIBLÉES : demandes_fiche pour le doublon, membres +
 *   faceclaims pour les listes, au lieu de la racine à chaque fois.
 *
 * CARTE DES BLOCS :
 *   RENDER BOUTON · RENDER OPTIONS · RENDER SECTIONS · RENDER MODAL
 *   EVENTS FERMETURE · EVENTS TOGGLES · CHARGEMENT · FACECLAIM
 *   LECTURE · VALIDATION · SOUMISSION · INIT
 *
 * Dépend de : fiche-config.js, fiche-utils.js, window.EcoCore, window.TDLBase.
 */

(function (FI, CFG, T) {
  "use strict";

  const NODE = "demandes_fiche";
  const E = () => window.EcoCore;
  const B = () => window.TDLBase;

  /* === RENDER BOUTON === */

  function creerBouton() {
    const w = document.createElement("div");
    // .mc-cta occupe toute la largeur : plus besoin de centrer le conteneur.
    // Accroche par data-act, la classe .fi-btn-ouvrir portant encore l'ancien style.
    w.innerHTML = `
      <button class="mc-cta" type="button" data-act="ouvrir">
        <i class="fi fi-tr-feather"></i>
        <span><b>${T.BTN_OUVRIR}</b><em>${T.BTN_OUVRIR_SOUS}</em></span>
        <i class="fi fi-tr-angle-small-right"></i>
      </button>`;
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
      <div class="fi-grid">
        <div class="fi-field">
          <label class="fi-label" for="fi-lien-fiche">${T.L_LIEN_FICHE}</label>
          <input id="fi-lien-fiche" class="fi-input" type="url" placeholder="https://…">
        </div>
        <div class="fi-field">
          <label class="fi-label" for="fi-groupe">${T.L_GROUPE}</label>
          <select id="fi-groupe" class="fi-select">${FI.optionsGroupes()}</select>
        </div>
      </div>

      <div class="fi-grid">
        <div class="fi-field">
          <span class="fi-label">${T.L_PRE_LIEN}</span>
          <div class="fi-inline-row">
            <div class="fi-radios">
              <label><input type="radio" name="fi-prelien" value="non" checked> Non</label>
              <label><input type="radio" name="fi-prelien" value="oui"> Oui</label>
            </div>
            <div id="fi-prelien-detail" class="fi-conditionnel">
              <input id="fi-lien-prelien" class="fi-input" type="url" placeholder="Lien du pré-lien https://…">
            </div>
          </div>
        </div>
        <div class="fi-field">
          <label class="fi-label" for="fi-parrain">${T.L_PARRAIN}</label>
          <select id="fi-parrain" class="fi-select"><option value="Personne">Personne</option></select>
        </div>
      </div>

      <div class="fi-field">
        <span class="fi-label">${T.L_MULTICOMPTE}</span>
        <div class="fi-inline-row">
          <div class="fi-radios">
            <label><input type="radio" name="fi-mc" value="non" checked> Non</label>
            <label><input type="radio" name="fi-mc" value="oui"> Oui</label>
          </div>
          <div id="fi-mc-detail" class="fi-conditionnel">
            <select id="fi-premier-compte" class="fi-select"><option value="">Chargement…</option></select>
          </div>
        </div>
      </div>

      <div class="fi-grid">
        <div class="fi-field">
          <label class="fi-label" for="fi-fc-mode">${T.L_FC_MODE}</label>
          <select id="fi-fc-mode" class="fi-select">
            <option value="sans">${T.FC_MODE_SANS}</option>
            <option value="sept">${T.FC_MODE_7J}</option>
            <option value="mc">${T.FC_MODE_MC}</option>
            <option value="prelien">${T.FC_MODE_PRELIEN}</option>
          </select>
        </div>
        <div class="fi-field">
          <label class="fi-label" for="fi-faceclaim">${T.L_FACECLAIM}</label>
          <input id="fi-faceclaim" class="fi-input" type="text" placeholder="Nom du Faceclaim">
        </div>
      </div>

      <div id="fi-fc-liste-wrap" class="fi-conditionnel">
        <label class="fi-label" for="fi-fc-liste">${T.L_FC_CHOIX}</label>
        <select id="fi-fc-liste" class="fi-select"></select>
      </div>
    `;
  }

  function htmlSectionDetails() {
    return `
      ${FI.hllHTML()}

      ${FI.metierHTML()}

      ${FI.habitationHTML()}
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
        <tdl-separator></tdl-separator>
        <h3 class="dc-titre">${T.TITRE_MODAL}</h3>
        <div class="fi-progress">
          <div class="fi-progress-track"><div class="fi-progress-bar" id="fi-progress-bar"></div></div>
          <span class="fi-progress-pct" id="fi-progress-pct">0 %</span>
        </div>
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
  }

  /* === CHARGEMENT === */

  // Vérifie si une demande existe déjà pour ce membre (en_attente ou validee).
  // Retourne un message HTML ou null.
  // [MAJ v2] une branche ciblée, et une lecture bi-schéma : le tableau et le
  // nœud à clés se lisent de la même façon.
  async function verifierDoublon(pseudo) {
    const src = await E().firebaseGet(NODE);
    const demande = FI.versTableau(src).find(
      (d) => d && d.pseudo === pseudo && (d.statut === "en_attente" || d.statut === "validee")
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

    /* [MAJ v2] deux branches ciblées au lieu de la racine */
    const [recMembres, recFC] = await Promise.all([
      E().firebaseGet("membres"),
      E().firebaseGet("faceclaims"),
    ]);
    chargerFaceclaims({ membres: recMembres, faceclaims: recFC });
  }

  /* === FACECLAIM (modes de réservation) === */

  let _fcCartes = [];   // cartes du bottin faceclaims (lecture)
  let _fcMembres = {};  // membres, pour résoudre premier_compte → uid

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
      ...FI.hllLecture(overlay),
      ...FI.metierLecture(overlay),
      ...FI.habitationLecture(overlay),
    };
  }

  /* === VALIDATION === */

  function verifierChamps(d) {
    if (!d.lien_fiche)                      return T.ERR_LIEN_FICHE;
    if (d.pre_lien && !d.lien_pre_lien)     return T.ERR_LIEN_PRELIEN;
    if (d.multicompte && !d.premier_compte) return T.ERR_PREMIER_COMPTE;
    if (!d.faceclaim)                       return T.ERR_FACECLAIM;
    if (!d.groupe)                          return T.ERR_GROUPE;
    const errHll = FI.hllVerifier(d);
    if (errHll)                             return errHll;
    const errMetier = FI.metierVerifier(d);
    if (errMetier)                          return errMetier;
    const errHab = FI.habitationVerifier(d);
    if (errHab)                             return errHab;
    return null;
  }

  /* === SOUMISSION =====================
     [MAJ v2] un seul chemin : demandes_fiche/{clé}.
     Si la branche est encore un tableau, la conversion et la nouvelle demande
     partent dans le MÊME PATCH — Firebase l'applique en tout ou rien, donc
     aucune demande ne peut se perdre entre les deux. */

  async function ecrireDemande(demande) {
    const src = await E().firebaseGet(NODE);
    const k = B().nouvelleCle();
    if (Array.isArray(src)) {
      const dst = {};
      src.forEach((x) => { if (x) dst[B().nouvelleCle()] = x; });
      dst[k] = demande;
      await E().firebaseUpdate({ [NODE]: dst });
      if (window.console) console.info("[fiche-membre] demandes_fiche converti en nœud à clés.");
    } else {
      await E().firebaseUpdate({ [`${NODE}/${k}`]: demande });
    }
    return k;
  }

  async function soumettre(overlay, pseudo) {
    const d        = lireDemande(overlay);
    const erreur   = verifierChamps(d);
    const resultat = overlay.querySelector("#fi-resultat");
    const btn      = overlay.querySelector("#fi-btn-soumettre");

    if (erreur) { FI.afficherResultat(resultat, "erreur", erreur); return; }

    btn.disabled = true;
    btn.textContent = T.ENVOI_EN_COURS;

    try {
      const demande = {
        id:     FI.genId(),
        date:   new Date().toISOString(),
        pseudo,
        uid:    window._userdata?.user_id || null,
        statut: "en_attente",
        ...d,
      };
      await ecrireDemande(demande);

      // Réserve le poste : rôle inscrit avec attente:true, visible dans le bottin.
      let avertMetier = "";
      try {
        const r = await FI.metierReserver(demande, pseudo, demande.uid);
        if (r && r.complet) avertMetier = "<br><small>" + T.ERR_MET_COMPLET + "</small>";
      } catch (e) {
        avertMetier = "<br><small>⚠️ Poste non réservé — signalez-le au staff.</small>";
        if (window.console) console.error("[fiche-membre] metierReserver", e);
      }

      FI.preremplirReponse(FI.bbcodeDemande(demande));
      FI.afficherResultat(resultat, "succes", T.CONFIRMATION + avertMetier);
      overlay.querySelector("#fi-champs").style.display = "none";

    } catch (e) {
      if (window.console) console.error("[fiche-membre] soumettre", e);
      FI.afficherResultat(resultat, "erreur", T.ERR_ENVOI);
      btn.disabled = false;
      btn.textContent = T.BTN_SOUMETTRE;
    }
  }

  /* === INIT === */

  FI.initMembre = function (ancrage, pseudo) {
    if (document.getElementById("fi-overlay")) return;
    if (!B() || typeof B().nouvelleCle !== "function") {
      if (window.console) console.error("[fiche-membre] tdl-base.js doit être chargé avant ce script.");
      return;
    }

    const bouton  = creerBouton();
    const overlay = creerModal();

    ancrage.appendChild(bouton);
    document.body.appendChild(overlay);

    bindFermeture(overlay);
    bindToggles(overlay);
    bindFaceclaimModes(overlay);
    FI.progressInit(overlay);

  bouton.querySelector('[data-act="ouvrir"]').addEventListener("click", () => {
  overlay.classList.add("actif");
      document.body.style.overflow = "hidden";
      if (FI.progressMaj) FI.progressMaj();
      if (!overlay.dataset.initialise) {
        overlay.dataset.initialise = "1";
        chargerListesMembres(overlay, pseudo);
        // listes zone → entreprise → poste, lues dans le bottin des métiers
        FI.metierBrancher(overlay);
        FI.habitationBrancher(overlay);
        FI.hllBrancher(overlay);
      }
    });

    overlay.querySelector("#fi-btn-soumettre")
      .addEventListener("click", () => soumettre(overlay, pseudo));
  };

})(window.FI, window.FI.CFG, window.FI.TEXTES);
