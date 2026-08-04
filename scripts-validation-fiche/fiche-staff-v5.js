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

  function creerEntete() {
    const d = document.createElement("div");
    d.className = "mc-head";
    d.innerHTML = `<h1>${T.PANEL_TITRE}</h1><p>${T.PANEL_SOUS_TITRE}</p>`;
    return d;
  }

  function creerPanel() {
    const panel = document.createElement("section");
    panel.id = "fi-staff-panel";
    panel.className = "sj-fiche";
    panel.innerHTML = `
      <div class="mc-sec-head">
        <h2>${T.STAFF_TITRE}</h2>
        <span class="mc-cpt" id="fi-staff-nb">0</span>
      </div>
      <p class="mc-sub">${T.STAFF_SOUS_TITRE}</p>
      <div id="fi-staff-liste">${T.CHARGEMENT || "Chargement…"}</div>`;
    return panel;
  }

  /* === AVATARS ===
     Le membre poste lui-même sa demande dans ce sujet : son avatar est donc
     déjà dans la page. On l'y lit plutôt que d'aller le chercher sur le
     réseau ou dans le bottin des faceclaims — lequel n'a pas encore de carte
     pour une fiche non validée.
     [MAJ] sélecteurs dépendants du thème sj-* : .sj-postmsg et .sj-post-avatar */
  function normPseudo(s) {
    return String(s || "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function indexAvatars() {
    const idx = { parUid: {}, parNom: {} };
    document.querySelectorAll(".sj-postmsg").forEach((post) => {
      const img = post.querySelector(".sj-post-avatar img");
      if (!img || !img.getAttribute("src")) return;
      const lien = post.querySelector('a[href*="/u"]');
      if (!lien) return;
      const src = img.getAttribute("src");
      const m = /\/u(\d+)/.exec(lien.getAttribute("href") || "");
      if (m) idx.parUid[m[1]] = src;
      const nom = (lien.textContent || "").trim();
      if (nom) idx.parNom[normPseudo(nom)] = src;
    });
    return idx;
  }

  let AVATARS = { parUid: {}, parNom: {} };

  function avatarHTML(d) {
    // l'uid est plus fiable que le pseudo : il survit à un renommage
    const src = (d.uid != null && AVATARS.parUid[String(d.uid)])
      || AVATARS.parNom[normPseudo(d.pseudo)];
    if (src) return `<span class="mc-av"><img src="${src}" alt=""></span>`;
    const ini = String(d.pseudo).split(/\s+/).filter(Boolean)
      .map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    return `<span class="mc-av">${ini}</span>`;
  }

  function creerCarte(d) {
    const esc = (s) => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const carte = document.createElement("article");
    carte.className = "mc-dem mc-dem-fiche";

    const prelien = d.pre_lien
      ? `<a href="${esc(d.lien_pre_lien)}" target="_blank" rel="noopener">${T.STAFF_VOIR_PRELIEN}</a>
         <em>+${CFG.PRIME_PRE_LIEN} $</em>`
      : T.NON;
    const mc = d.multicompte
      ? `${T.OUI} — <strong>${esc(d.premier_compte)}</strong>` : T.NON;
    const bande = d.bande
      ? `${esc(d.nom_bande)} — ${esc(d.role_bande)}` : T.AUCUNE;
    const metier = d.sans_emploi
      ? T.SANS_EMPLOI
      : `${esc(d.societe)} — ${esc(d.emploi)}`;
    const habitation = `${esc(d.lieu_habitation)} — ${esc(d.type_logement)} n°${esc(d.numero)}`;

    const ligne = (ic, cle, val) =>
      `<span class="k"><i class="fi ${ic}"></i>${cle}</span><span class="v">${val}</span>`;

    // Le parrainage n'apparaît que s'il y en a un, plutôt qu'une ligne « Personne ».
    const parrain = (d.parrain && d.parrain !== "Personne")
      ? `<div class="mc-id-l"><i class="fi fi-tr-users-alt"></i>${T.STAFF_PARRAINE(esc(d.parrain))}</div>`
      : "";

    carte.innerHTML = `
      <div class="mc-id">
        ${avatarHTML(d)}
        <div class="mc-id-txt">
          <div class="mc-id-nom">${esc(d.pseudo)}</div>
          <div class="mc-id-l"><i class="fi fi-tr-calendar"></i>${
            T.STAFF_DEPOSEE(new Date(d.date).toLocaleDateString("fr-FR"))}</div>
          ${parrain}
        </div>
      </div>
      <div class="mc-fiche-grille">
        ${ligne("fi-tr-link-alt",        T.C_PRELIEN,     prelien)}
        ${ligne("fi-tr-users-alt",       T.C_MULTICOMPTE, mc)}
        ${ligne("fi-tr-user-pen",        T.C_FACECLAIM,   esc(d.faceclaim))}
        ${ligne("fi-tr-shield",          T.C_COMMUNAUTE,  esc(FI.communauteLong(d.groupe)))}
        ${ligne("fi-tr-briefcase",       T.C_METIER,      metier)}
        ${ligne("fi-tr-house-blank",     T.C_HABITATION,  habitation)}
        ${ligne("fi-ts-badge-sheriff",   T.C_BANDE,       bande)}
      </div>
      <div class="mc-dem-act">
        <a class="mc-btn lg" href="${esc(d.lien_fiche)}" target="_blank" rel="noopener">
          <i class="fi fi-ts-circle-book-open"></i> ${T.STAFF_BTN_VOIR}</a>
        <button class="mc-btn ok lg" data-act="valider" data-id="${esc(d.id)}">
          <i class="fi fi-tr-check"></i> ${T.STAFF_BTN_VALIDER}</button>
        <button class="mc-btn no lg" data-act="refuser" data-id="${esc(d.id)}">
          <i class="fi fi-tr-cross-small"></i> ${T.STAFF_BTN_REFUSER}</button>
      </div>
      <div class="fi-resultat fi-resultat-${esc(d.id)}"></div>`;
    return carte;
  }

  /* === CHARGEMENT === */

  async function chargerDemandes(listeEl) {
    const rec = await window.EcoCore.safeReadBin();
    if (!rec) { listeEl.textContent = T.ERR_DONNEES; return; }

    // Index reconstruit à chaque rendu : la page a pu être paginée entre-temps.
    AVATARS = indexAvatars();

    const demandes = FI.versTableau(rec.demandes_fiche).filter((d) => d.statut === "en_attente");
    const cpt = document.getElementById("fi-staff-nb");
    if (cpt) cpt.textContent = demandes.length;

    if (!demandes.length) {
      listeEl.innerHTML = `<p class="mc-vide">${T.STAFF_AUCUNE}</p>`;
      return;
    }
    listeEl.innerHTML = "";
    demandes.forEach((d) => {
      const carte = creerCarte(d);
      // accroches par data-act : les classes dc-btn-* portent encore du style
      carte.querySelector('[data-act="valider"]')
        .addEventListener("click", () => ouvrirModalValidation(d, listeEl));
      carte.querySelector('[data-act="refuser"]')
        .addEventListener("click", () => refuser(d, carte, listeEl));
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
        <div class="dc-titre">${T.STAFF_TITRE_MODAL(demande.pseudo)}</div>
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

    const bbcode = FI.bbcodeValidation(demande, msgPerso, staffPseudo);
    try {
      if (!topicId) throw new Error("ID de sujet introuvable dans l'URL de la fiche.");
      await FI.posterDansSujet(topicId, bbcode);
    } catch (e) {
      if (e.message === "FALLBACK_NEEDED") {
        // ForumActif injecte le formulaire via JS : le posting automatique est impossible.
        // On affiche le BBCode dans un textarea pour que le staff le colle manuellement.
        afficherFallbackPosting(resultatEl, bbcode, demande.lien_fiche);
        // On continue quand même pour mettre à jour le statut dans le JSONBin
      } else {
        FI.afficherResultat(resultatEl, "erreur",
          `${T.STAFF_ERR_POSTING}<br><small>${e.message}</small>`);
        return false;
      }
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

    // Bascule la carte faceclaim en « pris » par transaction ciblée, HORS du writeBin,
    // pour ne jamais écraser une réservation concurrente posée via le bottin.
    let avertFC = "";
    try {
      const r = await reclamerFaceclaim(demande);
      if (r && r.conflit) avertFC = `<br><small>${T.STAFF_FC_CONFLIT}</small>`;
    } catch (e) {
      avertFC = `<br><small>${T.STAFF_FC_ECHEC}</small>`;
      if (window.console) console.error("[fiche-staff] reclamerFaceclaim", e);
    }

    // Confirme le rôle réservé dans le bottin des métiers : le drapeau attente
    // tombe, et le poste de direction confère le statut de référent.
    let avertMet = "";
    try {
      const m = await FI.metierAppliquer(demande);
      if (m && m.introuvable) avertMet = `<br><small>${T.STAFF_MET_INTROUVABLE}</small>`;
      else if (m && m.referent) avertMet = `<br><small>${T.STAFF_MET_REFERENT(demande.societe)}</small>`;
    } catch (e) {
      avertMet = `<br><small>${T.STAFF_MET_ECHEC}</small>`;
      if (window.console) console.error("[fiche-staff] metierAppliquer", e);
    }

    FI.afficherResultat(resultatEl, "succes", T.STAFF_OK(demande.pseudo) + avertFC + avertMet);
    setTimeout(() => chargerDemandes(listeEl), 2000);
    return true;
  }

  /* === REFUS ===
     Aucun message posté : le refus se règle en MP. La demande est effacée de
     la base, et surtout le poste réservé est libéré — sans ça il resterait
     bloqué indéfiniment dans le bottin des métiers. */

  async function refuser(demande, carteEl, listeEl) {
    if (!confirm(T.STAFF_CONFIRM_REFUS(demande.pseudo))) return;
    const resultatEl = carteEl.querySelector(".fi-resultat");

    // Libération d'abord : writeBin réécrit toute la racine et effacerait
    // cette écriture si elle venait après.
    let avert = "";
    try {
      const r = await FI.metierLiberer(demande);
      if (r && r.supprime)    avert = `<br><small>${T.STAFF_REFUS_ACTIVITE}</small>`;
      else if (r && r.introuvable) avert = `<br><small>${T.STAFF_REFUS_INTROUVABLE}</small>`;
    } catch (e) {
      avert = `<br><small>${T.STAFF_REFUS_METIER_ECHEC}</small>`;
      if (window.console) console.error("[fiche-staff] metierLiberer", e);
    }

    try {
      if (window.EcoCore.invalidateCache) window.EcoCore.invalidateCache();
      const rec = await window.EcoCore.readBin();
      if (!rec) { FI.afficherResultat(resultatEl, "erreur", T.ERR_DONNEES); return; }
      rec.demandes_fiche = FI.versTableau(rec.demandes_fiche)
        .filter((x) => x.id !== demande.id);
      await window.EcoCore.writeBin(rec);
    } catch (e) {
      FI.afficherResultat(resultatEl, "erreur",
        `${T.STAFF_REFUS_ECHEC}<br><small>${(e && e.message) || e}</small>`);
      return;
    }

    FI.afficherResultat(resultatEl, "succes", T.STAFF_REFUS_OK(demande.pseudo) + avert);
    setTimeout(() => chargerDemandes(listeEl), 2000);
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

  /* === FACECLAIM (bascule en « pris ») === */

  function normaliserCleFC(acteur) {
    return String(acteur || "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[.#$\[\]\/]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function recupererAvatarFC(uid) {
    return fetch("/u" + uid)
      .then((r) => (r.ok ? r.text() : null))
      .then((html) => {
        if (!html) return null;
        const doc = new DOMParser().parseFromString(html, "text/html");
        const img = doc.querySelector("#avatar_membre > img");   // [MAJ] avatar profil TDL
        return (img && img.getAttribute("src")) || null;
      })
      .catch(() => null);
  }

  // Bascule la carte de l'acteur en « pris » : UID du compte validé, avatar capturé,
  // réattribution d'UID pour un multicompte. Écritures ciblées uniquement (pas de PUT global).
  // Retourne { conflit } si la carte écrasée appartenait à un autre membre (hors transfert MC).
  async function reclamerFaceclaim(d) {
    const cle = normaliserCleFC(d.faceclaim);
    if (!cle) return { conflit: false };
    const E = window.EcoCore;
    if (!E || typeof E.firebaseTransaction !== "function") return { conflit: false };

    const image = d.uid ? await recupererAvatarFC(d.uid) : null;

    let ancienUid = null, ancienType = null;
    await E.firebaseTransaction("faceclaims/" + cle, (current) => {
      if (current && typeof current === "object") {
        ancienUid = (current.uid != null) ? current.uid : null;
        ancienType = current.type || null;
      }
      const carte = { acteur: d.faceclaim, statut: "pris", uid: d.uid || null, pseudo: d.pseudo };
      if (image) carte.image = image;
      return carte;
    });

    // Index inverse : ajout sous le nouvel UID.
    if (d.uid != null) {
      await E.firebaseTransaction("faceclaims_uid/" + d.uid, (cur) => {
        const l = FI.versTableau(cur);
        if (!l.includes(cle)) l.push(cle);
        return l;
      });
    }
    // Multicompte : retrait de l'ancien UID (compte principal → compte validé).
    if (ancienUid != null && String(ancienUid) !== String(d.uid)) {
      await E.firebaseTransaction("faceclaims_uid/" + ancienUid, (cur) =>
        FI.versTableau(cur).filter((k) => k !== cle));
    }

    const transfertMC = d.multicompte && ancienType === "multicompte";
    const conflit = ancienUid != null && String(ancienUid) !== String(d.uid) && !transfertMC;
    return { conflit };
  }
  
  /* === FALLBACK POSTING === */

  // Affiché quand le posting automatique échoue (form introuvable).
  // Le staff voit le BBCode et l'URL de la fiche pour coller manuellement.
  function afficherFallbackPosting(conteneurEl, bbcode, lienFiche) {
    conteneurEl.className = "fi-resultat info";
    conteneurEl.style.display = "block";
    conteneurEl.innerHTML = `
      <p style="margin:0 0 8px;">
        ⚠️ Le posting automatique n'a pas fonctionné (formulaire FA non accessible via fetch).<br>
        <strong><a href="${lienFiche}" target="_blank">Ouvrez la fiche ici</a></strong>
        et collez le message ci-dessous dans la réponse rapide :
      </p>
      <textarea style="width:100%;box-sizing:border-box;height:180px;font-size:.85em;
        border:1px solid #90caf9;border-radius:4px;padding:6px;" readonly>${bbcode}</textarea>`;
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
    ancrage.prepend(creerEntete());
    chargerDemandes(panel.querySelector("#fi-staff-liste"))
      .catch((e) => {
        const el = panel.querySelector("#fi-staff-liste");
        if (el) el.textContent = T.ERR_DONNEES + " (" + e.message + ")";
      });
  };

})(window.FI, window.FI.CFG, window.FI.TEXTES);
