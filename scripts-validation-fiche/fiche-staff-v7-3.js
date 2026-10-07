/*
 * fiche-staff.js — Panel de validation de fiches (côté staff) · TDL
 *
 * CE QUE CE FICHIER FAIT : affiche les demandes en attente, ouvre une modale
 * de validation avec message personnalisé, poste dans la fiche du membre,
 * applique les actions automatiques (dollars, groupe, bande, habitation, DC).
 * CE QU'IL NE FAIT PAS : formulaire membre, gestion des listes de membres.
 *
 * [MAJ v2] PLUS AUCUN readBin / writeBin.
 *   writeBin est un patch différentiel AU NIVEAU DES BRANCHES RACINE :
 *   appliquerActions mutait rec.membres, donc la branche membres repartait EN
 *   ENTIER, reconstruite depuis un instantané lu quelques secondes plus tôt.
 *   Tout ce qui avait bougé entre-temps était effacé — et membres est l'endroit
 *   le plus actif du forum : un achat débité pendant la validation revenait, un
 *   lien ajouté depuis le bottin disparaissait, une prime versée était annulée.
 *   Chaque champ part désormais seul, et les montants passent par des
 *   transactions : deux validations simultanées ne peuvent plus s'annuler.
 *
 * [MAJ v2] LES LIENS DE RÉSEAU PASSENT PAR LE SOCLE.
 *   affecterBande faisait versTableau(m.liens).push(…) : la branche repartait
 *   en TABLEAU, ce qui annulait la conversion aux clés pour tout le forum à
 *   chaque fiche validée. Un seul chemin désormais : liens/{clé}.
 *
 * [MAJ v2] demandes_fiche DEVIENT UN NŒUD À CLÉS.
 *   refuser() filtrait le tableau, ce qui RÉINDEXE tout : refuser une demande
 *   pendant qu'un autre admin en valide une autre déplaçait sa cible. La
 *   conversion se fait d'elle-même, en un PATCH atomique, au premier écrit qui
 *   rencontre encore un tableau.
 *
 * CARTE DES BLOCS :
 *   RENDER PANEL · AVATARS · DEMANDES · CHARGEMENT · MODAL STAFF
 *   · VALIDATION · REFUS · ACTIONS CIBLÉES · FACECLAIM · FALLBACK · INIT
 *
 * Dépend de : fiche-config.js, fiche-utils.js, window.EcoCore, window.TDLBase.
 */

(function (FI, CFG, T) {
  "use strict";

  const NODE = "demandes_fiche";
  const E = () => window.EcoCore;
  const B = () => window.TDLBase;
  const enc = (s) => encodeURIComponent(s);

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

  /* Conversion tableau → nœud à clés, en UN PATCH atomique. Idempotente :
     rend la carte des clés dans les deux cas, pour que l'appelant puisse
     écrire par clé juste après. */
  async function convertir(src) {
    if (!Array.isArray(src)) return { converti: false };
    const dst = {};
    src.forEach((d) => { if (d) dst[B().nouvelleCle()] = d; });
    await E().firebaseUpdate({ [NODE]: Object.keys(dst).length ? dst : null });
    if (window.console) console.info("[fiche-staff] demandes_fiche converti en nœud à clés.");
    return { converti: true };
  }

  async function lireDemandes() {
    let src = await E().firebaseGet(NODE);
    if (Array.isArray(src)) {
      await convertir(src);
      src = await E().firebaseGet(NODE);      // relu avec les vraies clés
    }
    return listerDemandes(src);
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
    /* [MAJ v2] une branche ciblée (~1 ko) au lieu des 189 ko de la racine */
    let toutes;
    try { toutes = await lireDemandes(); }
    catch (e) { listeEl.textContent = T.ERR_DONNEES; if (window.console) console.error(e); return; }

    // Index reconstruit à chaque rendu : la page a pu être paginée entre-temps.
    AVATARS = indexAvatars();

    const demandes = toutes.filter((d) => d.statut === "en_attente");
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
      <div class="dc-boite fi-boite">
        <button class="dc-btn-fermer">✕</button>
        <div class="dc-titre">${T.STAFF_TITRE_MODAL(demande.pseudo)}</div>
        <label class="fi-label">${T.STAFF_LABEL_MSG}</label>
        <textarea id="fi-msg-perso" class="fi-textarea" rows="6"
          placeholder="Votre message personnalisé…"></textarea>
        <div class="dc-actions">
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
    const topicId     = FI.extraireTopicId(demande.lien_fiche);
    const staffPseudo = E().getPseudo();

    const bbcode = FI.bbcodeValidation(demande, msgPerso, staffPseudo);
    try {
      if (!topicId) throw new Error("ID de sujet introuvable dans l'URL de la fiche.");
      await FI.posterDansSujet(topicId, bbcode);
    } catch (e) {
      if (e.message === "FALLBACK_NEEDED") {
        // ForumActif injecte le formulaire via JS : le posting automatique est impossible.
        // On affiche le BBCode dans un textarea pour que le staff le colle manuellement.
        afficherFallbackPosting(resultatEl, bbcode, demande.lien_fiche);
        // On continue quand même pour mettre à jour le statut
      } else {
        FI.afficherResultat(resultatEl, "erreur",
          `${T.STAFF_ERR_POSTING}<br><small>${e.message}</small>`);
        return false;
      }
    }

    /* [MAJ v2] trois champs de LA demande visée, par sa clé. */
    try {
      await E().firebaseUpdate({
        [`${NODE}/${demande._k}/statut`]:     "validee",
        [`${NODE}/${demande._k}/traite_par`]: staffPseudo,
        [`${NODE}/${demande._k}/traite_le`]:  new Date().toISOString(),
      });
    } catch (e) {
      FI.afficherResultat(resultatEl, "erreur",
        `${T.ERR_DONNEES}<br><small>${(e && e.message) || e}</small>`);
      return false;
    }

    /* [MAJ v2] actions sur le membre : écritures ciblées, jamais la branche. */
    let avertAct = "";
    try { await appliquerActions(demande); }
    catch (e) {
      avertAct = `<br><small>⚠️ Une action automatique a échoué — vérifiez le solde et l'affiliation.</small>`;
      if (window.console) console.error("[fiche-staff] appliquerActions", e);
    }

    // Bascule la carte faceclaim en « pris » par transaction ciblée.
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

    FI.afficherResultat(resultatEl, "succes",
      T.STAFF_OK(demande.pseudo) + avertAct + avertFC + avertMet);
    setTimeout(() => chargerDemandes(listeEl), 2000);
    return true;
  }

  /* === REFUS ===
     Aucun message posté : le refus se règle en MP. La demande est effacée de
     la base, et surtout le poste réservé est libéré — sans ça il resterait
     bloqué indéfiniment dans le bottin des métiers.
     [MAJ v2] l'ordre n'est plus contraint : il n'y a plus de writeBin pour
     écraser quoi que ce soit, et la demande part par sa clé — refuser pendant
     qu'un collègue valide ne déplace plus sa cible. */

  async function refuser(demande, carteEl, listeEl) {
    if (!confirm(T.STAFF_CONFIRM_REFUS(demande.pseudo))) return;
    const resultatEl = carteEl.querySelector(".fi-resultat");

    let avert = "";
    try {
      const r = await FI.metierLiberer(demande);
      if (r && r.supprime)         avert = `<br><small>${T.STAFF_REFUS_ACTIVITE}</small>`;
      else if (r && r.introuvable) avert = `<br><small>${T.STAFF_REFUS_INTROUVABLE}</small>`;
    } catch (e) {
      avert = `<br><small>${T.STAFF_REFUS_METIER_ECHEC}</small>`;
      if (window.console) console.error("[fiche-staff] metierLiberer", e);
    }

    try {
      await E().firebaseUpdate({ [`${NODE}/${demande._k}`]: null });
    } catch (e) {
      FI.afficherResultat(resultatEl, "erreur",
        `${T.STAFF_REFUS_ECHEC}<br><small>${(e && e.message) || e}</small>`);
      return;
    }

    FI.afficherResultat(resultatEl, "succes", T.STAFF_REFUS_OK(demande.pseudo) + avert);
    setTimeout(() => chargerDemandes(listeEl), 2000);
  }

  /* === ACTIONS CIBLÉES =====================
     Chaque effet part seul. Les montants passent par une transaction : deux
     validations simultanées s'additionnent au lieu de s'écraser. */

  async function appliquerActions(d) {
    await crediterMembre(d);
    await crediterParrain(d);
    await affecterProfil(d);      // groupe + bande + habitation, un seul PATCH
    await affecterLien(d);
    await completerGroupeDC(d);
  }

  /* Le membre peut ne pas exister encore (eco-ui jamais chargé) : on pose
     l'entrée minimale AVANT de créditer, et seulement si elle manque — un
     PATCH inconditionnel écraserait un solde déjà constitué. */
  async function assurerMembre(d) {
    const cur = await E().firebaseGet(`membres/${enc(d.pseudo)}`);
    if (cur && typeof cur === "object") return;
    await E().firebaseUpdate({
      [`membres/${d.pseudo}`]: {
        uid: d.uid || null, dollars: 0, group: null,
        messages: 0, lastMessageThresholdAwarded: 0,
      },
    });
  }

  async function crediterMembre(d) {
    if (!d.pre_lien) return;
    await assurerMembre(d);
    await E().crediterDollars(d.pseudo, CFG.PRIME_PRE_LIEN);
  }

  async function crediterParrain(d) {
    if (!d.parrain || d.parrain === "Personne") return;
    // Les 10 $ vont directement au membre parrain, pas à sa cagnotte de groupe.
    const cur = await E().firebaseGet(`membres/${enc(d.parrain)}`);
    if (!cur || typeof cur !== "object") return;      // parrain inconnu : on ne crée rien
    await E().crediterDollars(d.parrain, CFG.PRIME_PARRAIN);
  }

  /* Groupe, affiliation hors-la-loi et habitation : trois feuilles distinctes
     du même membre, donc un seul PATCH — atomique, et sans toucher au solde. */
  async function affecterProfil(d) {
    const u = {};
    u[`membres/${d.pseudo}/group`] = d.groupe;
    if (d.hll) u[`membres/${d.pseudo}/hors_la_loi`] = d.hll;   // clés identiques aux onglets du bottin
    u[`membres/${d.pseudo}/habitation`] = {
      quartier: d.lieu_habitation,   // nom d'affichage — le bottin le résout en clé
      numero:   d.numero,
      type:     d.type_logement,
      depuis:   d.date || new Date().toISOString(),
    };
    await E().firebaseUpdate(u);
  }

  /* [MAJ v2] le lien de réseau passe par le socle : un seul chemin, sous sa
     propre clé. L'ancien push réécrivait la branche en tableau et annulait la
     conversion pour tout le forum. */
  async function affecterLien(d) {
    if (!d.lien) return;
    const ok = await B().ecrireLien(d.pseudo, B().nouvelleCle(), d.lien);  // statut:null — la dette reste au staff
    if (!ok) throw new Error("écriture du lien refusée : " + d.pseudo);
  }

  /* Complète la 2e étape de la demande DC : ajoute le nouveau pseudo au groupe
     et supprime le slot. La liste des comptes reste un tableau — elle n'est
     lue et réécrite que par ce chemin, dans le même geste. */
  async function completerGroupeDC(d) {
    if (!d.multicompte || !d.premier_compte) return;
    const groupe = await E().firebaseGet(`doubles_comptes/${enc(d.premier_compte)}`);
    if (!groupe || !groupe.slot_en_attente) return;
    const comptes = FI.versTableau(groupe.comptes);
    if (!comptes.includes(d.pseudo)) comptes.push(d.pseudo);
    await E().firebaseUpdate({
      [`doubles_comptes/${d.premier_compte}/comptes`]:         comptes,
      [`doubles_comptes/${d.premier_compte}/slot_en_attente`]: null,
    });
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
  // réattribution d'UID pour un multicompte. Écritures ciblées uniquement.
  // Retourne { conflit } si la carte écrasée appartenait à un autre membre (hors transfert MC).
  async function reclamerFaceclaim(d) {
    const cle = normaliserCleFC(d.faceclaim);
    if (!cle) return { conflit: false };
    if (!E() || typeof E().firebaseTransaction !== "function") return { conflit: false };

    const image = d.uid ? await recupererAvatarFC(d.uid) : null;

    let ancienUid = null, ancienType = null;
    await E().firebaseTransaction("faceclaims/" + cle, (current) => {
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
      await E().firebaseTransaction("faceclaims_uid/" + d.uid, (cur) => {
        const l = FI.versTableau(cur);
        if (!l.includes(cle)) l.push(cle);
        return l;
      });
    }
    // Multicompte : retrait de l'ancien UID (compte principal → compte validé).
    if (ancienUid != null && String(ancienUid) !== String(d.uid)) {
      await E().firebaseTransaction("faceclaims_uid/" + ancienUid, (cur) =>
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
    const pseudo = E().getPseudo();
    const estStaff = (E().ADMIN_USERS || []).includes(pseudo)
      || CFG.STAFF_USERS.includes(pseudo);
    if (!estStaff) return;
    if (!B() || typeof B().ecrireLien !== "function") {
      if (window.console) console.error("[fiche-staff] tdl-base.js doit être chargé avant ce script.");
      return;
    }

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
