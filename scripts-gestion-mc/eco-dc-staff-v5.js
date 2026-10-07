/*
 * eco-dc-staff.js — Panel de validation multi-compte (côté staff) · TDL
 *
 * CE QUE CE FICHIER FAIT : affiche les demandes en attente, permet au staff de
 * valider ou refuser, déclenche le débit de monnaie si requis, et crée la
 * réservation de faceclaim. C'est tout ce que la demande de MC produit.
 * CE QU'IL NE FAIT PAS : conditions membres (eco-dc-membre.js), groupes et
 * suppression d'un membre (eco-dc-gestion.js).
 *
 * [MAJ v2] PLUS AUCUN readBin / writeBin.
 *   traiter() mutait rec.membres[x].dollars puis écrivait — or writeBin est un
 *   patch différentiel PAR BRANCHE : membres repartait en entier, depuis un
 *   instantané. Tout mouvement d'argent survenu entre les deux était annulé,
 *   et un membre inscrit entre-temps était purement supprimé.
 *
 * [MAJ v2] LE PAIEMENT DC EST UNE TRANSACTION.
 *   « rec.membres[x].dollars -= COUT_DC » après un simple test de solde lu à
 *   l'écran : deux validations rapprochées pouvaient débiter deux fois le même
 *   montant, ou passer sur un solde devenu insuffisant. EcoCore.debiterDollars
 *   refait le contrôle côté serveur et lève FONDS.
 *
 * [MAJ v2] transactions_membres RESTE INDEXÉ.
 *   versTableau(rec.transactions_membres).push(…) aplatissait un nœud à clés
 *   push en TABLEAU. Le journal passe par firebasePush, du même geste que
 *   eco-admin-modal, seul autre écrivain de ce nœud.
 *
 * [MAJ v2] demandes_dc DEVIENT UN NŒUD À CLÉS, converti de lui-même au premier
 *   écrit. findIndex sur un tableau que le membre peut faire grandir entre la
 *   lecture et l'écriture visait la mauvaise demande.
 *
 * CARTE DES BLOCS :
 *   RENDER · DEMANDES · EVENTS · TRAITEMENT · ACTIONS CIBLÉES · FACECLAIM · INIT
 *
 * Dépend de : eco-dc-config.js, eco-dc-utils.js, eco-dc-gestion.js, window.EcoCore,
 *   window.TDLBase (génération des clés).
 */

(function (DC, CFG, T) {
  "use strict";

  const APERCU = 2;   // demandes affichées avant le bouton « voir plus »
  let toutVoir = false;

  const NODE = "demandes_dc";
  const E = () => window.EcoCore;
  const B = () => window.TDLBase;
  const enc = (s) => encodeURIComponent(s);

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
  function indexAvatars(faceclaims) {
    const fc = faceclaims || {};
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

  /* === DEMANDES : lecture et écriture par clé =====================
     Lecture bi-schéma : rend [{_k, …demande}]. Un tableau v1 reçoit son indice
     comme clé de substitution, qui sert à l'affichage mais JAMAIS à une
     écriture — convertir() passe avant. */
  function listerDemandes(src) {
    if (!src) return [];
    if (Array.isArray(src)) {
      return src.map((d, i) => (d ? Object.assign({ _k: String(i) }, d) : null)).filter(Boolean);
    }
    return Object.keys(src).map((k) => (src[k] ? Object.assign({ _k: k }, src[k]) : null)).filter(Boolean);
  }

  /* Conversion tableau → nœud à clés, en UN PATCH atomique. */
  async function convertir(src) {
    const dst = {};
    src.forEach((d) => { if (d) dst[B().nouvelleCle()] = d; });
    await E().firebaseUpdate({ [NODE]: Object.keys(dst).length ? dst : null });
    if (window.console) console.info("[eco-dc-staff] demandes_dc converti en nœud à clés.");
  }

  async function lireDemandes() {
    let src = await E().firebaseGet(NODE);
    if (Array.isArray(src)) {
      await convertir(src);
      src = await E().firebaseGet(NODE);      // relu avec les vraies clés
    }
    return listerDemandes(src);
  }

  /* [MAJ v2] deux branches ciblées (~2 ko) au lieu de la racine (~190 ko). */
  async function chargerListe(listeEl, prechargé) {
    let toutes, faceclaims;
    try {
      if (prechargé) { toutes = prechargé.demandes; faceclaims = prechargé.faceclaims; }
      else {
        const r = await Promise.all([lireDemandes(), E().firebaseGet("faceclaims")]);
        toutes = r[0]; faceclaims = r[1];
      }
    } catch (e) {
      listeEl.textContent = T.ERR_DONNEES;
      if (window.console) console.error("[eco-dc-staff] chargerListe", e);
      return;
    }
    AVATARS = indexAvatars(faceclaims);

    const demandes = toutes.filter((d) => d.statut === "en_attente");
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
    bindBoutons(listeEl, vues);
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
    carte.dataset.cle = d._k;
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
        <button class="mc-btn ok lg" data-act="valider">
          <i class="fi fi-tr-check"></i> ${T.STAFF_VALIDER}</button>
        <button class="mc-btn no lg" data-act="refuser">
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
  // [MAJ v2] la demande est retrouvée par sa CLÉ, portée par la carte.
  function bindBoutons(listeEl, vues) {
    const parCle = {};
    vues.forEach((d) => { parCle[d._k] = d; });
    const brancher = (sel, decision) =>
      listeEl.querySelectorAll(sel).forEach((btn) => btn.addEventListener("click", () => {
        const carte = btn.closest(".mc-dem");
        const demande = carte && parCle[carte.dataset.cle];
        if (!demande) return;
        traiter(demande, decision, listeEl, carte).catch((e) => {
          if (window.console) console.error("[eco-dc-staff] traiter", e);
          const z = carte && carte.querySelector(".dc-resultat");
          if (z) DC.afficherResultat(z, "erreur", T.SUPPR_ERR + ((e && e.message) || e));
        });
      }));
    brancher('[data-act="valider"]', "validee");
    brancher('[data-act="refuser"]', "refusee");
  }

  /* === TRAITEMENT === */

  async function traiter(demande, decision, listeEl, carteEl) {
    const motif = decision === "refusee" ? prompt(T.STAFF_PROMPT_REFUS, "") : null;
    if (decision === "refusee" && motif === null) return;

    const resultatEl = carteEl ? carteEl.querySelector(".dc-resultat") : null;

    /* La demande a-t-elle été traitée entre-temps par un autre admin ?
       On relit SA SEULE feuille, pas la racine. */
    let frais;
    try { frais = await E().firebaseGet(NODE + "/" + enc(demande._k)); }
    catch (e) {
      if (resultatEl) DC.afficherResultat(resultatEl, "erreur", T.ERR_DONNEES);
      return;
    }
    if (!frais) {
      if (resultatEl) DC.afficherResultat(resultatEl, "info",
        "⚠️ Cette demande n'existe plus. Actualisation en cours…");
      setTimeout(() => chargerListe(listeEl), 1500);
      return;
    }
    if (frais.statut !== "en_attente") {
      if (resultatEl) DC.afficherResultat(resultatEl, "info",
        "⚠️ Cette demande a déjà été traitée par un autre admin. Actualisation en cours…");
      setTimeout(() => chargerListe(listeEl), 1500);
      return;
    }

    const staffPseudo = E().getPseudo();

    /* Le paiement AVANT le changement de statut : s'il échoue, la demande
       reste en attente et le staff peut réessayer. L'ordre inverse laisserait
       une demande validée sans débit. */
    if (decision === "validee" && demande.paiement_requis) {
      try {
        await E().debiterDollars(demande.compte_demandeur, CFG.COUT_DC);
      } catch (e) {
        if (e && e.message === "FONDS") {
          const solde = (await E().firebaseGet(
            "membres/" + enc(demande.compte_demandeur) + "/dollars")) || 0;
          if (resultatEl) DC.afficherResultat(resultatEl, "erreur",
            T.STAFF_ERR_SOLDE(demande.compte_demandeur, solde));
        } else {
          if (window.console) console.error("[eco-dc-staff] débit", e);
          if (resultatEl) DC.afficherResultat(resultatEl, "erreur", "Débit impossible — demande inchangée.");
        }
        return;
      }
      /* journal : même nœud et même forme que eco-admin-modal, par push */
      E().firebasePush("transactions_membres", {
        date: new Date().toISOString(), type: "frais_dc",
        de: demande.compte_demandeur, vers: "Frais DC",
        montant: CFG.COUT_DC,
        motif: `Paiement création compte n°${demande.numero_dc}`,
        "effectué_par": staffPseudo,
      }).catch(() => {});
    }

    /* Statut de la demande, puis état du groupe : deux PATCH ciblés. */
    const u = {};
    u[`${NODE}/${demande._k}/statut`]     = decision;
    u[`${NODE}/${demande._k}/traite_par`] = staffPseudo;
    u[`${NODE}/${demande._k}/traite_le`]  = new Date().toISOString();
    if (motif) u[`${NODE}/${demande._k}/motif_refus`] = motif;

    const racine = demande.compte_racine;
    if (decision === "validee") {
      /* slot_en_attente n'est plus consommé côté staff, mais fiche-membre s'en
         sert pour proposer au nouveau compte la liste des comptes principaux
         en attente de fiche. Ne pas le retirer. */
      u[`doubles_comptes/${racine}/demande_en_cours`] = false;
      u[`doubles_comptes/${racine}/slot_en_attente`]  = `NOUVEAU_COMPTE_${demande.numero_dc}`;
      /* le groupe peut ne pas exister si la demande vient d'un compte seul */
      const grp = await E().firebaseGet("doubles_comptes/" + enc(racine));
      if (!grp) u[`doubles_comptes/${racine}/comptes`] = [racine];
    } else {
      u[`doubles_comptes/${racine}/demande_en_cours`] = false;
    }

    try { await E().firebaseUpdate(u); }
    catch (e) {
      if (window.console) console.error("[eco-dc-staff] écriture", e);
      if (resultatEl) DC.afficherResultat(resultatEl, "erreur",
        "Enregistrement impossible" + (demande.paiement_requis && decision === "validee"
          ? " — ATTENTION : le débit a eu lieu, vérifiez le solde." : "."));
      return;
    }

    // Carte faceclaim créée par transaction ciblée.
    let avertFC = "";
    if (decision === "validee") {
      try {
        const r = await reserverFaceclaimMC(demande);
        if (r && r.occupe) avertFC = " ⚠️ Faceclaim déjà pris ou réservé — carte non créée, à vérifier.";
      } catch (e) {
        avertFC = " ⚠️ Carte faceclaim non créée — à ajouter manuellement via le panneau admin.";
        if (window.console) console.error("[eco-dc-staff] reserverFaceclaimMC", e);
      }
    }

    const monnaie = E().MONNAIE_NAME;
    DC.preremplirReponse(DC.msgStaff(demande, decision, motif, staffPseudo, monnaie));

    if (resultatEl) DC.afficherResultat(resultatEl, "succes",
      decision === "validee"
        ? `✅ Demande validée.${demande.paiement_requis ? " Paiement débité." : ""}${avertFC}`
        : "✅ Demande refusée."
    );

    if (window.EcoUI && window.EcoUI.updatePostDollars) window.EcoUI.updatePostDollars();
    setTimeout(() => chargerListe(listeEl), 1500);
  }

  /* === FACECLAIM (carte multicompte) === */

  // Crée la carte « reserve / multicompte » par transaction ciblée (jamais de PUT global).
  // UID = compte racine du groupe ; réattribué au nouveau compte à la validation de sa fiche.
  // Ne crée rien si l'acteur est déjà occupé. Retourne { ok, occupe }.
  async function reserverFaceclaimMC(demande) {
    const acteur = (demande.avatar_reserve || "").trim();
    if (!acteur) return { ok: false };
    if (!E() || typeof E().firebaseTransaction !== "function") return { ok: false };

    const cle = DC.normaliserCleFC(acteur);
    const racine = demande.compte_racine;
    /* [MAJ v2] une feuille, pas la racine */
    const uidRacine = (await E().firebaseGet("membres/" + enc(racine) + "/uid")) ?? null;

    let occupe = false;
    await E().firebaseTransaction("faceclaims/" + cle, (current) => {
      if (current && typeof current === "object") {
        occupe = true; const e = new Error("OCCUPE"); e.code = "OCCUPE"; throw e;
      }
      const carte = { acteur, statut: "reserve", type: "multicompte", pseudo: racine };
      if (uidRacine != null) carte.uid = uidRacine;
      return carte;
    }).catch((e) => { if (e.code !== "OCCUPE") throw e; });

    if (occupe) return { ok: false, occupe: true };

    if (uidRacine != null) {
      await E().firebaseTransaction("faceclaims_uid/" + uidRacine, (cur) => {
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
    if (!B() || typeof B().nouvelleCle !== "function") {
      if (window.console) console.error("[eco-dc-staff] tdl-base.js doit être chargé avant ce fichier.");
      return;
    }
    ancrage.appendChild(creerEntete());
    const panel = creerPanel();
    ancrage.appendChild(panel);

    const sectionGestion = DC.creerSectionGestion();
    ancrage.appendChild(sectionGestion);
    ancrage.appendChild(DC.creerSectionSuppression());

    /* [MAJ v2] trois branches ciblées, partagées entre les deux sections. */
    Promise.all([lireDemandes(), E().firebaseGet("faceclaims"), E().firebaseGet("doubles_comptes")])
      .then((r) => {
        chargerListe(panel.querySelector("#dc-staff-liste"), { demandes: r[0], faceclaims: r[1] });
        DC.chargerGroupes(sectionGestion.querySelector("#dc-staff-groupes"), r[2]);
      })
      .catch((e) => {
        const listeEl = panel.querySelector("#dc-staff-liste");
        if (listeEl) listeEl.textContent = T.ERR_DONNEES + " (erreur : " + e.message + ")";
      });
  };

})(window.DC, window.DC.CFG, window.DC.TEXTES);
