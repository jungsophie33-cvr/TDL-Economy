/*
 * eco-dc-gestion.js — Groupes multi-comptes & suppression d'un membre · TDL
 *
 * Extrait de eco-dc-staff.js, qui dépassait les 500 lignes. Ce fichier porte
 * les deux sections du panneau staff qui touchent aux comptes existants.
 *
 * [MAJ v2] LES RÔLES SE RETIRENT PAR CLÉ.
 *   nettoyerRolesEmplois réécrivait emplois/{id}/roles EN TABLEAU pour chaque
 *   entreprise où le membre figurait. Depuis que le bottin des métiers range
 *   ses rôles en nœud à clés, cette écriture ANNULAIT la conversion — et
 *   rouvrait, pour toutes ces entreprises, le défaut qu'on venait d'y fermer :
 *   deux fiches validées coup sur coup dont l'une écrase le rôle de l'autre.
 *   On efface maintenant chaque rôle visé à son propre chemin. Le repli
 *   tableau reste là pour les fiches pas encore converties.
 *
 * [MAJ v2] LECTURES CIBLÉES et plus aucun invalidateCache — il vidait le
 *   cache partagé de toute la page à chaque suppression.
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

  const E = () => window.EcoCore;
  const enc = (s) => encodeURIComponent(s);

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

  // groupesExistants permet de réutiliser une lecture déjà faite par initStaff.
  // [MAJ v2] une seule branche (~1 ko) au lieu de la racine.
  DC.chargerGroupes = async function (corpsEl, groupesExistants) {
    if (!corpsEl) return;
    let groupes;
    try { groupes = groupesExistants || await E().firebaseGet("doubles_comptes"); }
    catch (e) { corpsEl.innerHTML = `<tr><td colspan="3">${T.ERR_DONNEES}</td></tr>`; return; }

    // doubles_comptes absent = aucun DC validé, pas une erreur
    const entrees = Object.entries(groupes || {})
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
      /* [MAJ v2] le seul groupe concerné, pas la racine entière */
      const groupe = await E().firebaseGet("doubles_comptes/" + enc(racine));
      if (!groupe) return;

      const updates = {};
      retirerDuGroupe(groupe, racine, pseudo, updates);
      await E().firebaseUpdate(updates);

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
      await E().firebaseUpdate(updates);

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

  /* Lecture bi-schéma des rôles d'une entreprise : rend [{k, r}].
     En schéma 2 (nœud à clés), k est la clé Firebase ; en schéma 1 (tableau),
     c'est l'indice, qui ne sert qu'au repli ci-dessous. */
  function listerRoles(e) {
    const r = e && e.roles;
    if (!r) return [];
    if (Array.isArray(r)) return r.map((x, i) => ({ k: i, r: x })).filter((o) => !!o.r);
    return Object.keys(r).map((k) => ({ k: k, r: r[k] })).filter((o) => !!o.r);
  }

  // Rôles à retirer dans emplois/* : on cible d'abord l'uid — identité stable,
  // insensible aux renommages — avec repli sur le pseudo pour les rôles saisis
  // avant l'introduction de l'uid. PNJ et pré-liens ne sont jamais touchés.
  //
  // [MAJ v2] En schéma 2, chaque rôle visé est effacé À SA CLÉ : les rôles
  // voisins ne sont pas réécrits, et la fiche reste en nœud à clés. L'ancienne
  // version réécrivait la liste entière en tableau, ce qui annulait la
  // conversion du bottin des métiers pour chaque entreprise touchée.
  function nettoyerRolesEmplois(rec, pseudo, uid, updates) {
    const emplois = rec.emplois || {};
    let postes = 0, referents = 0;
    Object.keys(emplois).forEach((id) => {
      const e = emplois[id];
      if (!e) return;
      const tous = listerRoles(e);
      const aRetirer = tous.filter((o) => {
        const r = o.r;
        if (uid != null && r.uid != null) return String(r.uid) === String(uid);
        return r.type === "pj" && r.nom === pseudo;
      });
      if (aRetirer.length) {
        if (e.schema === 2) {
          aRetirer.forEach((o) => { updates["emplois/" + id + "/roles/" + o.k] = null; });
        } else {
          /* repli schéma 1 : la liste est un tableau, il n'y a pas de clé à
             viser — on la réécrit, comme avant. */
          const restants = tous.filter((o) => aRetirer.indexOf(o) === -1).map((o) => o.r);
          updates["emplois/" + id + "/roles"] = restants.length ? restants : null;
        }
        postes += aRetirer.length;
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

    /* [MAJ v2] six branches ciblées (~15 ko) au lieu des 190 ko de la racine.
       Ce sont réellement les six dont la suppression a besoin. */
    let rec;
    try {
      const r = await Promise.all([
        E().firebaseGet("membres"),
        E().firebaseGet("uid_index"),
        E().firebaseGet("doubles_comptes"),
        E().firebaseGet("faceclaims"),
        E().firebaseGet("faceclaims_uid"),
        E().firebaseGet("emplois"),
      ]);
      rec = { membres: r[0] || {}, uid_index: r[1] || {}, doubles_comptes: r[2] || {},
              faceclaims: r[3] || {}, faceclaims_uid: r[4] || {}, emplois: r[5] || {} };
    } catch (e) {
      DC.afficherResultat(resultatEl, "erreur", T.ERR_DONNEES);
      if (window.console) console.error("[eco-dc-gestion] lecture", e);
      return;
    }

    const uid = DC.uidDepuisPseudo(rec, pseudo);
    const updates = {}, actions = [];

    if (rec.membres[pseudo]) {
      updates["membres/" + pseudo] = null;
      actions.push("économie");
    }
    if (uid != null && rec.uid_index[uid]) {
      updates["uid_index/" + uid] = null;
      actions.push("index UID");
    }
    nettoyerGroupes(rec, pseudo, updates, actions);

    const cartes = cartesFCDuMembre(rec, pseudo, uid);
    cartes.forEach((cle) => { updates["faceclaims/" + cle] = null; });
    if (uid != null && rec.faceclaims_uid[uid]) {
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
      await E().firebaseUpdate(updates);
    } catch (e) {
      DC.afficherResultat(resultatEl, "erreur", T.SUPPR_ERR + ((e && e.message) || e));
      return;
    }

    window.DC.rafraichirBottin?.();
    DC.afficherResultat(resultatEl, "succes", T.SUPPR_OK(pseudo, actions.join(", ")));
    section.querySelector("#dc-suppr-input").value = "";
    recharger();
  }

})(window.DC, window.DC.CFG, window.DC.TEXTES);
