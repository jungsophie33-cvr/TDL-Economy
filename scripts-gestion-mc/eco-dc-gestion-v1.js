/*
 * eco-dc-gestion.js — Groupes multi-comptes & suppression d'un membre · TDL
 *
 * Extrait de eco-dc-staff.js, qui dépassait les 500 lignes. Ce fichier porte
 * les deux sections du panneau staff qui touchent aux comptes existants.
 *
 * CARTE DES BLOCS :
 *   UTILS       — échappement, clé de faceclaim, réattribution de racine
 *   GESTION     — tableau des groupes multicomptes
 *   SUPPRESSION — départ définitif d'un membre (PATCH ciblé, multi-nœuds)
 *
 * Le départ d'un membre libère, en plus de ses données :
 *   · ses rôles dans le bottin des métiers → les postes se rouvrent
 *   · son statut de référent d'entreprise
 *   · ses cartes du bottin des avatars → le faceclaim redevient disponible
 * La libération est silencieuse : rien n'est signalé côté joueur.
 *
 * Toutes les écritures passent par firebaseUpdate (PATCH multi-chemins,
 * atomique) : un writeBin racine écraserait ce qu'un autre module aurait
 * écrit entre la lecture et l'enregistrement.
 *
 * Expose sur window.DC : normaliserCleFC, creerSectionGestion, chargerGroupes,
 * creerSectionSuppression. À charger AVANT eco-dc-staff.js.
 *
 * Dépend de : eco-dc-config.js, eco-dc-utils.js, window.EcoCore
 */

(function (DC, CFG, T) {
  "use strict";

  /* === UTILS === */

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  // Clé Firebase d'un faceclaim : partagée avec eco-dc-staff et fiche-staff.
  DC.normaliserCleFC = function (acteur) {
    return String(acteur || "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[.#$\[\]\/]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  // Le tableau comptes est chronologique : [racine, 2e compte, 3e compte…].
  // Le premier compte restant est donc le plus ancien, et devient la racine.
  function nouvelleRacine(restants) { return restants[0]; }

  /* === GESTION DES GROUPES === */

  DC.creerSectionGestion = function () {
    const section = document.createElement("section");
    section.id = "dc-staff-gestion";
    section.className = "sj-fiche";
    section.innerHTML = `
      <div class="mc-sec-head"><h2>${T.STAFF_GESTION_TITRE}</h2></div>
      <p class="mc-sub">${T.STAFF_GESTION_SOUS}</p>
      <table class="mc-tbl">
        <thead><tr>
          <th style="width:28%">${T.STAFF_COL_RACINE}</th>
          <th>${T.STAFF_COL_COMPTES}</th>
          <th style="width:44px"></th>
        </tr></thead>
        <tbody id="dc-staff-groupes"><tr><td colspan="3">${T.CHARGEMENT}</td></tr></tbody>
      </table>
      <div class="dc-resultat" id="dc-gestion-resultat"></div>
    `;
    return section;
  };

  // recExistant permet de réutiliser une lecture déjà faite par initStaff
  // et d'éviter un appel Firebase supplémentaire.
  DC.chargerGroupes = async function (corpsEl, recExistant) {
    if (!corpsEl) return;
    const rec = recExistant || await window.EcoCore.safeReadBin();
    if (!rec) { corpsEl.innerHTML = `<tr><td colspan="3">${T.ERR_DONNEES}</td></tr>`; return; }

    // doubles_comptes absent = aucun DC validé, pas une erreur
    const entrees = Object.entries(rec.doubles_comptes || {})
      .sort(([a], [b]) => a.localeCompare(b, "fr"));

    if (!entrees.length) {
      corpsEl.innerHTML = `<tr><td colspan="3"><p class="mc-vide">${T.STAFF_GESTION_VIDE}</p></td></tr>`;
      return;
    }
    corpsEl.innerHTML = entrees.map(([racine, groupe]) => ligneGroupe(racine, groupe.comptes)).join("");
    brancherLignes(corpsEl);
  };

  function recharger() {
    DC.chargerGroupes(document.getElementById("dc-staff-groupes"));
  }

  function ligneGroupe(racine, comptes) {
    const tags = DC.versTableau(comptes).map((p) => `
      <span class="mc-cpte${p === racine ? " racine" : ""}">
        ${p === racine ? '<i class="fi fi-tr-star star"></i>' : ""}${esc(p)}
        <button class="rm" data-act="rm-pseudo" data-pseudo="${esc(p)}" data-racine="${esc(racine)}"
          title="${T.STAFF_RETIRER}">✕</button>
      </span>`).join("");

    return `<tr data-racine="${esc(racine)}">
      <td><div class="mc-grp-nom">${esc(racine)}</div></td>
      <td><div class="mc-comptes">${tags}</div></td>
      <td>
        <div class="mc-menu">
          <button class="mc-menu-btn" type="button">⋮</button>
          <div class="mc-menu-list">
            <button class="dgr" data-act="rm-groupe" data-racine="${esc(racine)}">${T.STAFF_SUPPR_GROUPE}</button>
          </div>
        </div>
      </td>
    </tr>`;
  }

  function brancherLignes(corpsEl) {
    corpsEl.querySelectorAll('[data-act="rm-pseudo"]').forEach((b) =>
      b.addEventListener("click", () => supprimerPseudo(b.dataset.racine, b.dataset.pseudo)));
    corpsEl.querySelectorAll('[data-act="rm-groupe"]').forEach((b) =>
      b.addEventListener("click", () => supprimerGroupe(b.dataset.racine)));
  }

  // Un seul écouteur global pour ouvrir/fermer les menus ⋮.
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest(".mc-menu-btn");
    document.querySelectorAll(".mc-menu.on").forEach((m) => {
      if (!b || m !== b.parentElement) m.classList.remove("on");
    });
    if (b) b.parentElement.classList.toggle("on");
  });

  function resultatGestion() { return document.getElementById("dc-gestion-resultat"); }

  async function supprimerPseudo(racine, pseudo) {
    if (!confirm(T.STAFF_CONFIRM_SUPPRESSION(pseudo))) return;
    const el = resultatGestion();
    try {
      const rec = await window.EcoCore.safeReadBin();
      const groupe = rec && rec.doubles_comptes && rec.doubles_comptes[racine];
      if (!groupe) return;

      const updates = {};
      retirerDuGroupe(groupe, racine, pseudo, updates);
      await window.EcoCore.firebaseUpdate(updates);
      if (window.EcoCore.invalidateCache) window.EcoCore.invalidateCache();

      if (el) DC.afficherResultat(el, "succes", T.STAFF_SUPPR_OK(pseudo));
      window.DC.rafraichirBottin?.();
      setTimeout(recharger, 1200);
    } catch (_) {
      if (el) DC.afficherResultat(el, "erreur", T.STAFF_ERR_SUPPR);
    }
  }

  // Retire un pseudo d'un groupe et alimente `updates`.
  // Si le pseudo retiré était la racine, le groupe est réattribué au compte
  // restant le plus ancien plutôt que d'être dissous.
  function retirerDuGroupe(groupe, racine, pseudo, updates) {
    const comptes  = DC.versTableau(groupe.comptes);
    const restants = comptes.filter((c) => c !== pseudo);

    if (restants.length <= 1) {                       // un groupe d'un seul compte n'a pas de sens
      updates["doubles_comptes/" + racine] = null;
      return "dissous";
    }
    if (racine === pseudo) {                          // transfert de racine
      const cible = nouvelleRacine(restants);
      const nouveau = Object.assign({}, groupe, { comptes: restants });
      if (nouveau.uids) { nouveau.uids = Object.assign({}, nouveau.uids); delete nouveau.uids[pseudo]; }
      updates["doubles_comptes/" + racine] = null;
      updates["doubles_comptes/" + cible]  = nouveau;
      return "racine → " + cible;
    }
    updates["doubles_comptes/" + racine + "/comptes"] = restants;
    if (groupe.uids && groupe.uids[pseudo] !== undefined) {
      updates["doubles_comptes/" + racine + "/uids/" + pseudo] = null;
    }
    return "retiré";
  }

  async function supprimerGroupe(racine) {
    if (!confirm(T.STAFF_CONFIRM_GROUPE(racine))) return;
    const el = resultatGestion();
    try {
      const updates = {};
      updates["doubles_comptes/" + racine] = null;
      await window.EcoCore.firebaseUpdate(updates);
      if (window.EcoCore.invalidateCache) window.EcoCore.invalidateCache();

      if (el) DC.afficherResultat(el, "succes", T.STAFF_SUPPR_GROUPE_OK(racine));
      window.DC.rafraichirBottin?.();
      setTimeout(recharger, 1200);
    } catch (_) {
      if (el) DC.afficherResultat(el, "erreur", T.STAFF_ERR_SUPPR);
    }
  }

  /* === SUPPRESSION COMPLÈTE D'UN MEMBRE === */

  DC.creerSectionSuppression = function () {
    const section = document.createElement("section");
    section.id = "dc-staff-suppression";
    section.className = "sj-fiche";
    section.innerHTML = `
      <div class="mc-sec-head"><h2>${T.SUPPR_TITRE}</h2></div>
      <div class="mc-supp">
        <div>
          <p>${T.SUPPR_TEXTE}</p>
          <label class="mc-lbl" for="dc-suppr-input">${T.SUPPR_LABEL}</label>
          <div class="mc-ligne">
            <input class="mc-in" id="dc-suppr-input" type="text" placeholder="${T.SUPPR_PH}">
            <button class="mc-btn no lg" id="dc-suppr-btn">
              <i class="fi fi-tr-trash"></i> ${T.SUPPR_BTN}</button>
          </div>
        </div>
        <div class="mc-alerte">
          <i class="fi fi-tr-exclamation"></i>
          <div><b>${T.SUPPR_ALERTE_T}</b><span>${T.SUPPR_ALERTE}</span></div>
        </div>
      </div>
      <div class="dc-resultat" id="dc-suppr-resultat"></div>
    `;
    section.querySelector("#dc-suppr-btn")
      .addEventListener("click", () => supprimerMembreComplet(section));
    return section;
  };

  // Cartes faceclaim appartenant au membre (par pseudo ou par uid).
  // Le départ d'un joueur libère son avatar : la carte est supprimée, l'acteur
  // redevient disponible. Si le personnage était issu d'un pré-lien, son
  // créateur devra repasser par la réservation habituelle.
  function cartesFCDuMembre(rec, pseudo, uid) {
    const fc = rec.faceclaims || {};
    return Object.keys(fc).filter((cle) => {
      const c = fc[cle];
      if (!c) return false;
      if (c.pseudo === pseudo) return true;
      return uid != null && c.uid != null && String(c.uid) === String(uid);
    });
  }

  // Rôles à retirer dans emplois/* : on cible d'abord l'uid — identité stable,
  // insensible aux renommages — avec repli sur le pseudo pour les rôles saisis
  // avant l'introduction de l'uid. PNJ et pré-liens ne sont jamais touchés.
  function nettoyerRolesEmplois(rec, pseudo, uid, updates) {
    const emplois = rec.emplois || {};
    let postes = 0, referents = 0;
    Object.keys(emplois).forEach((id) => {
      const e = emplois[id];
      if (!e) return;
      const roles = DC.versTableau(e.roles);
      const restants = roles.filter((r) => {
        if (!r) return false;
        if (uid != null && r.uid != null) return String(r.uid) !== String(uid);
        return !(r.type === "pj" && r.nom === pseudo);
      });
      if (restants.length !== roles.length) {
        updates["emplois/" + id + "/roles"] = restants;
        postes += roles.length - restants.length;
      }
      if (e.referent === pseudo) {
        updates["emplois/" + id + "/referent"] = null;
        referents += 1;
      }
    });
    return { postes, referents };
  }

  function nettoyerGroupes(rec, pseudo, updates, actions) {
    const groupes = rec.doubles_comptes || {};
    Object.keys(groupes).forEach((racine) => {
      const groupe = groupes[racine] || {};
      const comptes = DC.versTableau(groupe.comptes);
      if (racine !== pseudo && comptes.indexOf(pseudo) === -1) return;
      actions.push("groupe DC (" + retirerDuGroupe(groupe, racine, pseudo, updates) + ")");
    });
  }

  async function supprimerMembreComplet(section) {
    const pseudo     = section.querySelector("#dc-suppr-input").value.trim();
    const resultatEl = section.querySelector("#dc-suppr-resultat");

    if (!pseudo) { DC.afficherResultat(resultatEl, "erreur", T.SUPPR_VIDE); return; }
    if (!confirm(T.SUPPR_CONFIRM(pseudo))) return;

    if (window.EcoCore.invalidateCache) window.EcoCore.invalidateCache();
    const rec = await window.EcoCore.safeReadBin();
    if (!rec) { DC.afficherResultat(resultatEl, "erreur", T.ERR_DONNEES); return; }

    const uid = DC.uidDepuisPseudo(rec, pseudo);
    const updates = {}, actions = [];

    if (rec.membres && rec.membres[pseudo]) {
      updates["membres/" + pseudo] = null;
      actions.push("économie");
    }
    if (uid != null && rec.uid_index && rec.uid_index[uid]) {
      updates["uid_index/" + uid] = null;
      actions.push("index UID");
    }
    nettoyerGroupes(rec, pseudo, updates, actions);

    const cartes = cartesFCDuMembre(rec, pseudo, uid);
    cartes.forEach((cle) => { updates["faceclaims/" + cle] = null; });
    if (uid != null && rec.faceclaims_uid && rec.faceclaims_uid[uid]) {
      updates["faceclaims_uid/" + uid] = null;
    }
    if (cartes.length) actions.push(`faceclaim${cartes.length > 1 ? "s" : ""} (${cartes.length})`);

    const bilan = nettoyerRolesEmplois(rec, pseudo, uid, updates);
    if (bilan.postes)    actions.push(`poste${bilan.postes > 1 ? "s" : ""} libéré${bilan.postes > 1 ? "s" : ""} (${bilan.postes})`);
    if (bilan.referents) actions.push(`référent d'entreprise (${bilan.referents})`);

    if (!actions.length) {
      DC.afficherResultat(resultatEl, "info", T.SUPPR_INTROUVABLE(pseudo));
      return;
    }

    try {
      await window.EcoCore.firebaseUpdate(updates);
    } catch (e) {
      DC.afficherResultat(resultatEl, "erreur", T.SUPPR_ERR + ((e && e.message) || e));
      return;
    }
    if (window.EcoCore.invalidateCache) window.EcoCore.invalidateCache();

    window.DC.rafraichirBottin?.();
    DC.afficherResultat(resultatEl, "succes", T.SUPPR_OK(pseudo, actions.join(", ")));
    section.querySelector("#dc-suppr-input").value = "";
    recharger();
  }

})(window.DC, window.DC.CFG, window.DC.TEXTES);
