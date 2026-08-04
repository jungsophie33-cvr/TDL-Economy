/*
 * eco-dc-staff.js — Panel de validation multi-compte (côté staff) · TDL
 *
 * CE QUE CE FICHIER FAIT : affiche les demandes en attente, permet au staff de
 * valider ou refuser, déclenche le débit de monnaie si requis, et crée la
 * réservation de faceclaim. C'est tout ce que la demande de MC produit.
 * CE QU'IL NE FAIT PAS : conditions membres (eco-dc-membre.js), groupes et
 * suppression d'un membre (eco-dc-gestion.js).
 *
 * CARTE DES BLOCS :
 *   RENDER       — en-tête, section des demandes, carte de demande
 *   EVENTS       — binding des boutons valider / refuser / voir plus
 *   TRAITEMENT   — logique de validation/refus (statut, paiement, groupe)
 *   FACECLAIM    — réservation de la carte multicompte
 *   INIT         — point d'entrée exposé sur window.DC
 *
 *
 * Dépend de : eco-dc-config.js, eco-dc-utils.js, eco-dc-gestion.js, window.EcoCore
 */

(function (DC, CFG, T) {
  "use strict";

  const APERCU = 2;   // demandes affichées avant le bouton « voir plus »
  let toutVoir = false;

  // Échappement local : le contenu des demandes est saisi par les membres et
  // réinjecté en innerHTML. Ne pas dépendre d'un utilitaire externe ici.
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  /* === RENDER === */

  function creerEntete() {
    const d = document.createElement("div");
    d.className = "mc-head";
    d.innerHTML = `<h1>${T.PANEL_TITRE}</h1><p>${T.PANEL_SOUS_TITRE}</p>`;
    return d;
  }

  function creerPanel() {
    const panel = document.createElement("section");
    panel.id = "dc-staff-panel";
    panel.className = "sj-fiche";
    panel.innerHTML = `
      <div class="mc-sec-head">
        <h2>${T.STAFF_TITRE}</h2>
        <span class="mc-cpt" id="dc-staff-nb">0</span>
      </div>
      <p class="mc-sub">${T.STAFF_SOUS_TITRE}</p>
      <div id="dc-staff-liste">${T.CHARGEMENT}</div>
      <button class="mc-plus" id="dc-staff-plus" style="display:none"></button>
    `;
    panel.querySelector("#dc-staff-plus").addEventListener("click", () => {
      toutVoir = !toutVoir;
      chargerListe(panel.querySelector("#dc-staff-liste"));
    });
    return panel;
  }

  // Index pseudo → carte faceclaim, pour illustrer chaque demande avec le
  // portrait du membre qui la dépose (jamais celui qu'il demande à réserver).
  // Une carte « pris » avec image l'emporte sur une simple réservation, sinon
  // un même pseudo portant plusieurs cartes (multicompte) renverrait la mauvaise.
  function indexAvatars(rec) {
    const fc = (rec && rec.faceclaims) || {};
    const idx = {};
    const score = (c) => (c.statut === "pris" ? 4 : c.statut === "reserve" ? 1 : 0) + (c.image ? 2 : 0);
    Object.keys(fc).forEach((cle) => {
      const c = fc[cle];
      if (!c || !c.pseudo) return;
      const a = idx[c.pseudo];
      if (!a || score(c) > score(a)) idx[c.pseudo] = c;
    });
    return idx;
  }

  let AVATARS = {};

  async function chargerListe(listeEl, recExistant) {
    const rec = recExistant || await window.EcoCore.safeReadBin();
    if (!rec) { listeEl.textContent = T.ERR_DONNEES; return; }
    AVATARS = indexAvatars(rec);

    const demandes = DC.versTableau(rec.demandes_dc).filter((d) => d.statut === "en_attente");
    const cpt = document.getElementById("dc-staff-nb");
    if (cpt) cpt.textContent = demandes.length;

    if (!demandes.length) {
      listeEl.innerHTML = `<p class="mc-vide">${T.STAFF_AUCUNE}</p>`;
      majBoutonPlus(0);
      return;
    }
    const vues = toutVoir ? demandes : demandes.slice(0, APERCU);
    listeEl.innerHTML = "";
    vues.forEach((d) => listeEl.appendChild(creerCarte(d)));
    bindBoutons(listeEl);
    majBoutonPlus(demandes.length - APERCU);
  }

  function majBoutonPlus(reste) {
    const b = document.getElementById("dc-staff-plus");
    if (!b) return;
    b.style.display = reste > 0 ? "flex" : "none";
    b.innerHTML = toutVoir
      ? `<span>${T.STAFF_REDUIRE}</span><i class="fi fi-tr-angle-small-up"></i>`
      : `<span>${T.STAFF_VOIR_PLUS(reste)}</span><i class="fi fi-tr-angle-small-down"></i>`;
  }

  function initiales(nom) {
    return String(nom).split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  }
  // pseudo = compte_demandeur, jamais avatar_reserve
  function avatarHTML(pseudo) {
    const c = AVATARS[pseudo];
    return c && c.image
      ? `<span class="mc-av"><img src="${esc(c.image)}" alt=""></span>`
      : `<span class="mc-av">${esc(initiales(pseudo))}</span>`;
  }

  function creerCarte(d) {
    const carte = document.createElement("article");
    carte.className = "mc-dem";
    carte.innerHTML = `
      <div class="mc-id">
        ${avatarHTML(d.compte_demandeur)}
        <div class="mc-id-txt">
          <div class="mc-id-nom">${esc(d.compte_demandeur)}</div>
          <div class="mc-id-l"><i class="fi fi-tr-users-alt"></i>${T.STAFF_RANG(d.numero_dc)}</div>
          <div class="mc-id-l${d.avatar_reserve ? "" : " mc-attenue"}">
            <i class="fi fi-tr-user-pen"></i>${d.avatar_reserve ? esc(d.avatar_reserve) : T.STAFF_SANS_FC}</div>
        </div>
      </div>
      <p class="mc-res">${esc(d.resume)}</p>
      <div class="mc-dem-act">
        <button class="mc-btn ok lg" data-act="valider" data-id="${esc(d.id)}">
          <i class="fi fi-tr-check"></i> ${T.STAFF_VALIDER}</button>
        <button class="mc-btn no lg" data-act="refuser" data-id="${esc(d.id)}">
          <i class="fi fi-tr-cross-small"></i> ${T.STAFF_REFUSER}</button>
      </div>
      <div class="dc-resultat"></div>
    `;
    return carte;
  }

  /* === EVENTS === */

  // Les accroches passent par data-act et non par des classes : dc-fi-gestion.css
  // style encore .dc-btn-valider / .dc-btn-refuser, qui entreraient en conflit
  // avec .mc-btn (même spécificité, dernière règle gagnante).
  function bindBoutons(listeEl) {
    const brancher = (sel, decision) =>
      listeEl.querySelectorAll(sel).forEach((btn) => btn.addEventListener("click", () => {
        // La carte est passée telle quelle : construire un sélecteur à partir de
        // l'id de la demande levait une SyntaxError dès que genId() contenait un
        // caractère interdit en CSS (un point, par exemple), ce qui tuait le clic.
        const carte = btn.closest(".mc-dem");
        traiter(btn.dataset.id, decision, listeEl, carte).catch((e) => {
          if (window.console) console.error("[eco-dc-staff] traiter", e);
          const z = carte && carte.querySelector(".dc-resultat");
          if (z) DC.afficherResultat(z, "erreur", T.SUPPR_ERR + ((e && e.message) || e));
        });
      }));
    brancher('[data-act="valider"]', "validee");
    brancher('[data-act="refuser"]', "refusee");
  }

  /* === TRAITEMENT === */

  async function traiter(id, decision, listeEl, carteEl) {
    const motif = decision === "refusee" ? prompt(T.STAFF_PROMPT_REFUS, "") : null;
    if (decision === "refusee" && motif === null) return;

    // Invalider le cache AVANT la lecture pour forcer un aller-retour Firebase :
    // sans ça, un admin pourrait lire une version mise en cache 30 s plus tôt
    // et écraser le changement de l'autre.
    if (window.EcoCore.invalidateCache) window.EcoCore.invalidateCache();

    // readBin() renvoie null en cas d'échec réseau ou de token expiré : sans ce
    // garde, la ligne suivante lève un TypeError et le clic meurt en silence.
    const rec = await window.EcoCore.readBin();
    if (!rec) {
      if (carteEl) {
        const z = carteEl.querySelector(".dc-resultat");
        if (z) DC.afficherResultat(z, "erreur", T.ERR_DONNEES);
      }
      return;
    }
    rec.doubles_comptes = rec.doubles_comptes || {};
    rec.demandes_dc = DC.versTableau(rec.demandes_dc);

    const idx = rec.demandes_dc.findIndex((d) => d.id === id);
    if (idx === -1) return;

    const resultatEl = carteEl ? carteEl.querySelector(".dc-resultat") : null;

    // La demande a-t-elle été traitée entre-temps par un autre admin ?
    if (rec.demandes_dc[idx].statut !== "en_attente") {
      if (resultatEl) DC.afficherResultat(resultatEl, "info",
        "⚠️ Cette demande a déjà été traitée par un autre admin. Actualisation en cours…");
      setTimeout(() => chargerListe(listeEl), 1500);
      return;
    }

    const demande     = rec.demandes_dc[idx];
    const staffPseudo = window.EcoCore.getPseudo();

    enregistrerDecision(rec, idx, decision, staffPseudo, motif);

    if (decision === "validee") {
      const erreur = tenterPaiement(rec, demande);
      if (erreur) { if (resultatEl) DC.afficherResultat(resultatEl, "erreur", erreur); return; }
      validerGroupe(rec, demande);
    } else {
      libererVerrou(rec, demande.compte_racine);
    }

    await window.EcoCore.writeBin(rec);
    if (window.EcoCore.invalidateCache) window.EcoCore.invalidateCache();

    // Carte faceclaim créée par transaction ciblée, hors writeBin.
    let avertFC = "";
    if (decision === "validee") {
      try {
        const r = await reserverFaceclaimMC(demande, rec);
        if (r && r.occupe) avertFC = " ⚠️ Faceclaim déjà pris ou réservé — carte non créée, à vérifier.";
      } catch (e) {
        avertFC = " ⚠️ Carte faceclaim non créée — à ajouter manuellement via le panneau admin.";
        if (window.console) console.error("[eco-dc-staff] reserverFaceclaimMC", e);
      }
    }

    const monnaie = window.EcoCore.MONNAIE_NAME;
    DC.preremplirReponse(DC.msgStaff(demande, decision, motif, staffPseudo, monnaie));

    if (resultatEl) DC.afficherResultat(resultatEl, "succes",
      decision === "validee"
        ? `✅ Demande validée.${demande.paiement_requis ? " Paiement débité." : ""}${avertFC}`
        : "✅ Demande refusée."
    );

    // Délai de 3 s : laisse Firebase propager l'écriture avant que l'autre admin
    // ne voie la liste actualisée, réduisant la fenêtre de race condition.
    setTimeout(() => chargerListe(listeEl), 3000);
  }

  function enregistrerDecision(rec, idx, decision, staffPseudo, motif) {
    Object.assign(rec.demandes_dc[idx], {
      statut:     decision,
      traite_par: staffPseudo,
      traite_le:  new Date().toISOString(),
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

  // slot_en_attente n'est plus consommé côté staff, mais fiche-membre s'en sert
  // pour proposer au nouveau compte la liste des comptes principaux en attente
  // de fiche. Ne pas le retirer.
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

  /* === FACECLAIM (carte multicompte) === */

  // Crée la carte « reserve / multicompte » par transaction ciblée (jamais de PUT global).
  // UID = compte racine du groupe ; réattribué au nouveau compte à la validation de sa fiche.
  // Ne crée rien si l'acteur est déjà occupé. Retourne { ok, occupe }.
  async function reserverFaceclaimMC(demande, rec) {
    const acteur = (demande.avatar_reserve || "").trim();
    if (!acteur) return { ok: false };
    const E = window.EcoCore;
    if (!E || typeof E.firebaseTransaction !== "function") return { ok: false };

    const cle = DC.normaliserCleFC(acteur);
    const racine = demande.compte_racine;
    const uidRacine = rec.membres?.[racine]?.uid ?? null;

    let occupe = false;
    await E.firebaseTransaction("faceclaims/" + cle, (current) => {
      if (current && typeof current === "object") {
        occupe = true; const e = new Error("OCCUPE"); e.code = "OCCUPE"; throw e;
      }
      const carte = { acteur, statut: "reserve", type: "multicompte", pseudo: racine };
      if (uidRacine != null) carte.uid = uidRacine;
      return carte;
    }).catch((e) => { if (e.code !== "OCCUPE") throw e; });

    if (occupe) return { ok: false, occupe: true };

    if (uidRacine != null) {
      await E.firebaseTransaction("faceclaims_uid/" + uidRacine, (cur) => {
        const l = DC.versTableau(cur);
        if (!l.includes(cle)) l.push(cle);
        return l;
      });
    }
    return { ok: true };
  }

  /* === INIT === */

  DC.initStaff = function (ancrage) {
    if (document.getElementById("dc-staff-panel")) return;
    if (!DC.creerSectionGestion || !DC.creerSectionSuppression) {
      if (window.console) console.error("[eco-dc-staff] eco-dc-gestion.js doit être chargé avant ce fichier.");
      return;
    }
    ancrage.appendChild(creerEntete());
    const panel = creerPanel();
    ancrage.appendChild(panel);

    const sectionGestion = DC.creerSectionGestion();
    ancrage.appendChild(sectionGestion);
    ancrage.appendChild(DC.creerSectionSuppression());

    // Une seule lecture partagée : évite trois appels Firebase simultanés.
    window.EcoCore.safeReadBin()
      .then((rec) => {
        chargerListe(panel.querySelector("#dc-staff-liste"), rec);
        DC.chargerGroupes(sectionGestion.querySelector("#dc-staff-groupes"), rec);
      })
      .catch((e) => {
        const listeEl = panel.querySelector("#dc-staff-liste");
        if (listeEl) listeEl.textContent = T.ERR_DONNEES + " (erreur : " + e.message + ")";
      });
  };

})(window.DC, window.DC.CFG, window.DC.TEXTES);
