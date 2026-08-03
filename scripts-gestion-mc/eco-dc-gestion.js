/*
 * eco-dc-gestion.js — Groupes multi-comptes & suppression d'un membre · TDL
 *
 * Extrait de eco-dc-staff.js, qui dépassait les 500 lignes. Ce fichier porte
 * les deux sections du panneau staff qui touchent aux comptes existants :
 * la gestion des groupes multicomptes et le départ définitif d'un membre.
 *
 * CARTE DES BLOCS :
 *   UTILS       — clé de faceclaim, réattribution de racine
 *   GESTION     — panneau des groupes multicomptes
 *   SUPPRESSION — départ définitif d'un membre (PATCH ciblé, multi-nœuds)
 *
 * Le départ d'un membre libère, en plus de ses données :
 *   · ses rôles dans le bottin des métiers → les postes se rouvrent
 *   · son statut de référent d'entreprise
 *   · ses cartes du bottin des avatars → le faceclaim redevient disponible
 *
 * Dépend de : eco-dc-config.js, eco-dc-utils.js, window.EcoCore
 */

(function (DC, CFG, T) {
  "use strict";

  /* === UTILS === */

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
    const section = document.createElement("div");
    section.id = "dc-staff-gestion";
    section.className = "dc-staff-panel";
    section.style.marginTop = "14px";
    section.innerHTML = `
      <h3 class="dc-staff-titre">${T.STAFF_GESTION_TITRE}</h3>
      <div id="dc-staff-groupes">Chargement…</div>
    `;
    return section;
  };

  // recExistant permet de réutiliser une lecture déjà faite par initStaff
  // et d'éviter un appel Firebase supplémentaire.
  DC.chargerGroupes = async function (groupesEl, recExistant) {
    if (!groupesEl) return;
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
  };

  function recharger() {
    DC.chargerGroupes(document.getElementById("dc-staff-groupes"));
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
      <button class="dc-btn-suppr-groupe" data-racine="${racine}">
        Supprimer tout le groupe
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

  function elResultat(carteEl, racine) {
    return carteEl.querySelector(`.dc-gestion-resultat-${racine.replace(/\s/g,'-')}`);
  }

  async function supprimerPseudo(racine, pseudo, carteEl) {
    if (!confirm(T.STAFF_CONFIRM_SUPPRESSION(pseudo))) return;
    const resultatEl = elResultat(carteEl, racine);

    try {
      const rec = await window.EcoCore.safeReadBin();
      const groupe = rec?.doubles_comptes?.[racine];
      if (!groupe) return;

      const updates = {};
      retirerDuGroupe(groupe, racine, pseudo, updates);
      await window.EcoCore.firebaseUpdate(updates);
      if (window.EcoCore.invalidateCache) window.EcoCore.invalidateCache();

      if (resultatEl) { resultatEl.style.color = "green"; resultatEl.textContent = T.STAFF_SUPPR_OK(pseudo); }
      window.DC.rafraichirBottin?.();
      setTimeout(recharger, 1200);
    } catch (_) {
      if (resultatEl) { resultatEl.style.color = "red"; resultatEl.textContent = T.STAFF_ERR_SUPPR; }
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

  async function supprimerGroupe(racine, carteEl) {
    if (!confirm(T.STAFF_CONFIRM_GROUPE(racine))) return;
    const resultatEl = elResultat(carteEl, racine);

    try {
      const updates = {};
      updates["doubles_comptes/" + racine] = null;
      await window.EcoCore.firebaseUpdate(updates);
      if (window.EcoCore.invalidateCache) window.EcoCore.invalidateCache();

      if (resultatEl) { resultatEl.style.color = "green"; resultatEl.textContent = T.STAFF_SUPPR_GROUPE_OK(racine); }
      window.DC.rafraichirBottin?.();
      setTimeout(recharger, 1200);
    } catch (_) {
      if (resultatEl) { resultatEl.style.color = "red"; resultatEl.textContent = T.STAFF_ERR_SUPPR; }
    }
  }

  /* === SUPPRESSION COMPLÈTE D'UN MEMBRE === */

  DC.creerSectionSuppression = function () {
    const section = document.createElement("div");
    section.id = "dc-staff-suppression";
    section.className = "dc-staff-panel";
    section.style.marginTop = "14px";
    section.innerHTML = `
      <h3 class="dc-staff-titre">Suppression complète d'un membre</h3>
      <p style="font-size:.9em;color:#555;margin:0 0 10px;">
        Supprime toutes les données du membre : économie, multi-comptes, index UID,
        faceclaims réservés et rôles occupés dans le bottin des métiers.
        À utiliser uniquement si le membre a définitivement quitté le forum.
      </p>
      <label class="dc-label">Pseudo exact du membre à supprimer :</label>
      <input id="dc-suppr-input" type="text" placeholder="Pseudo exact"
        style="border:1px solid #f99;border-radius:4px;padding:5px 8px;width:220px;margin-right:8px;">
      <button id="dc-suppr-btn" class="dc-suppr-btn1">Supprimer tout</button>
      <div id="dc-suppr-resultat" class="dc-resultat" style="margin-top:10px;"></div>
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

  // Groupes multicomptes : réattribution de la racine si nécessaire.
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

    if (!pseudo) { DC.afficherResultat(resultatEl, "erreur", "Pseudo vide."); return; }
    if (!confirm(`⚠️ Supprimer TOUTES les données de "${pseudo}" ?\n\n`
      + `Ses rôles seront libérés dans le bottin des métiers et ses faceclaims `
      + `rendus disponibles.\nCette action est irréversible.`)) return;

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
      DC.afficherResultat(resultatEl, "info", `"${pseudo}" introuvable dans la base.`);
      return;
    }

    try {
      await window.EcoCore.firebaseUpdate(updates);
    } catch (e) {
      DC.afficherResultat(resultatEl, "erreur",
        "❌ Échec de la suppression : " + ((e && e.message) || e));
      return;
    }
    if (window.EcoCore.invalidateCache) window.EcoCore.invalidateCache();

    window.DC.rafraichirBottin?.();
    DC.afficherResultat(resultatEl, "succes",
      `✅ "${pseudo}" supprimé (${actions.join(", ")}).`);
    section.querySelector("#dc-suppr-input").value = "";
    recharger();
  }

})(window.DC, window.DC.CFG, window.DC.TEXTES);
