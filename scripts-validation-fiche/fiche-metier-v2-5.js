/*
 * fiche-metier.js — Bloc « Métier » du formulaire de validation · TDL
 *
 * CE QUE CE FICHIER FAIT : remplace les trois champs libres Métier par trois
 * listes en cascade branchées sur le Bottin des métiers (zone → entreprise →
 * poste), plus trois échappatoires : créer son poste dans une entreprise
 * existante, créer son activité, ou se déclarer sans emploi.
 * Il réserve le poste au dépôt de la demande et crée le rôle à la validation.
 * CE QU'IL NE FAIT PAS : rendu de la modale, logique staff générale.
 *
 * [MAJ v2] ÉCRITURES CIBLÉES SUR LES RÔLES.
 *   Les trois écritures de ce fichier — réservation, libération, attribution —
 *   réécrivaient emplois/{id}/roles EN BLOC, depuis une copie relue juste
 *   avant. Deux fiches validées à quelques secondes d'écart sur la même
 *   entreprise, et le rôle de l'une écrasait celui de l'autre : un membre
 *   sans poste, sans erreur, sans trace. C'est le cas le plus probable du
 *   forum, puisque les validations se font par lots.
 *   On n'écrit plus que emplois/{id}/roles/{clé}.
 *
 *   COMPATIBILITÉ : une entreprise encore au format v1 (tableau) continue
 *   d'être servie par l'ancien chemin. Une fiche déposée avant que le staff
 *   n'ait converti le bottin ne doit pas échouer — c'est un formulaire de
 *   membre, pas un panneau d'administration.
 *
 * CARTE DES BLOCS :
 *   TEXTES · DONNÉES · RENDER · EVENTS · LECTURE · VALIDATION
 *   · RÉSERVATION · LIBÉRATION · ATTRIBUTION
 *
 * COMPATIBILITÉ : la demande continue de porter lieu_metier / societe / emploi
 * pour que le BBCode et la carte staff restent inchangés. Les champs
 * structurés (metier_*) s'y ajoutent.
 *
 * Dépend de : fiche-config.js, fiche-utils.js, tdl-zcats.js, window.EcoCore,
 *   window.TDLBase (génération des clés).
 * À charger APRÈS fiche-utils.js et AVANT fiche-membre.js.
 */

(function (FI, CFG, T) {
  "use strict";

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const vt = (v) => FI.versTableau(v);
  const anneeCourante = () => String(new Date().getFullYear());
  const SCHEMA = 2;
  const cle = () => window.TDLBase.nouvelleCle();

  /* === TEXTES === */
  Object.assign(T, {
    L_SANS_EMPLOI:   "Mon personnage est sans emploi",
    L_MET_ZONE:      "Zone du lieu de travail *",
    L_MET_ENTREPRISE:"Entreprise *",
    L_MET_POSTE:     "Poste occupé *",
    L_MET_DEPUIS:    "Depuis (année)",
    L_MET_TITRE:     "Intitulé de votre poste *",
    L_MET_ENT_NOM:   "Nom de votre activité *",
    L_MET_ENT_TYPE:  "Secteur d'activité *",
    L_MET_ENT_CAT:   "Catégorie *",
    BTN_NEW_POSTE:   "Créer mon poste",
    BTN_NEW_ACTIVITE:"Créer mon activité",
    BTN_ANNULER_MET: "Revenir à la liste",
    MET_CHOISIR:     "— Choisir —",
    MET_ZONE_VIDE:   "Choisissez d'abord une zone",
    MET_AUCUNE_ENT:  "Aucune entreprise dans cette zone",
    MET_ENT_VIDE:    "Choisissez d'abord une entreprise",
    MET_AUCUN_POSTE: "Aucun poste ouvert — utilisez « Créer mon poste »",
    MET_SANS_EMPLOI: "Sans emploi",
    MET_AIDE_ACTIVITE:"Votre activité sera créée en brouillon dans le bottin des "
                     + "métiers : vous pourrez la compléter, et le staff la publiera.",
    ERR_MET_ZONE:    "⚠️ La zone du lieu de travail est requise.",
    ERR_MET_ENT:     "⚠️ Sélectionnez une entreprise, ou créez votre activité.",
    ERR_MET_POSTE:   "⚠️ Sélectionnez un poste, ou créez le vôtre.",
    ERR_MET_TITRE:   "⚠️ L'intitulé de votre poste est requis.",
    ERR_MET_ENT_NOM: "⚠️ Le nom de votre activité est requis.",
    ERR_MET_ENT_TYPE:"⚠️ Le secteur d'activité est requis.",
    ERR_MET_COMPLET: "⚠️ Ce poste vient d'être pourvu. Choisissez-en un autre.",
    ERR_MET_ZCATS:   "❌ Configuration des zones indisponible (tdl-zcats.js non chargé).",
    MET_HORS_BOTTIN: "Hors bottin",
  });

  /* === DONNÉES ===
     Une entreprise = un lieu qui embauche : lieux/{id} porte l'identité,
     emplois/{id} l'extension métier. On ne lit qu'une fois par ouverture. */
  let ENT = [];

  function libresPoste(e, p) {
    const pris = vt(e.roles).filter((r) => r && r.poste === p.t).length;
    return Math.max(0, (Number(p.n) || 0) - pris);
  }

  FI.metierCharger = async function () {
    /* [MAJ] deux branches ciblées : ~17 ko au lieu de 126. */
    const [lieux, emplois] = await Promise.all([
      window.EcoCore.firebaseGet("lieux"),
      window.EcoCore.firebaseGet("emplois")
    ]);
    ENT = Object.keys(lieux || {})
      .filter((id) => lieux[id] && lieux[id].emploi === true && !lieux[id].masque)
      .map((id) => {
        const e = Object.assign({ id }, lieux[id], (emplois || {})[id] || {});
        /* vt() aplatit pour la LECTURE (comptage des places). Les écritures,
           elles, visent une clé — voir ecrireRole ci-dessous. */
        e.roles  = vt(e.roles);
        e.postes = vt(e.postes);
        return e;
      })
      // brouillon non publié et entreprise déclarée complète : hors liste
      .filter((e) => !e.brouillon && !e.complet)
      .sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr"));
    return ENT;
  };

  const zonesDispo = () => {
    const Z = window.TDLZonesCats;
    if (!Z) return [];
    return Z.ZONES.filter((z) => ENT.some((e) => e.zone === z.id));
  };
  const entDeZone = (zone) => ENT.filter((e) => e.zone === zone);
  const entParId  = (id) => ENT.find((e) => e.id === id) || null;
  const postesLibres = (e) => vt(e.postes)
    .filter((p) => libresPoste(e, p) > 0)
    .sort((a, b) => (b.dir ? 1 : 0) - (a.dir ? 1 : 0));

  /* ---------- ACCÈS AUX RÔLES, DEUX FORMATS ----------
     v2 : emplois/{id}/roles/{clé}  → écriture d'un seul chemin.
     v1 : emplois/{id}/roles[]      → l'ancien bloc, conservé pour qu'une fiche
          déposée avant la conversion du bottin n'échoue pas. */
  const estV2 = (src) => !!src && src.schema === SCHEMA;
  /* rend [{k, r}] : k est une clé en v2, un indice en v1 */
  function listerRoles(src) {
    const r = src && src.roles;
    if (!r) return [];
    if (Array.isArray(r)) return r.map((x, i) => ({ k: i, r: x })).filter((o) => !!o.r);
    return Object.keys(r).map((k) => ({ k: k, r: r[k] })).filter((o) => !!o.r);
  }
  /* le rôle réservé par CETTE demande : uid d'abord, pseudo en repli */
  function trouverRole(src, d, attenteSeulement) {
    const l = listerRoles(src);
    for (const o of l) {
      const r = o.r;
      const cible = (d.uid != null && r.uid != null)
        ? String(r.uid) === String(d.uid)
        : r.nom === d.pseudo;
      if (!cible || r.poste !== d.metier_poste) continue;
      if (attenteSeulement && !r.attente) continue;
      return o;
    }
    return null;
  }

  /* === RENDER === */

  function optionsCats() {
    const Z = window.TDLZonesCats;
    if (!Z) return "";
    return Z.CATS.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("");
  }

  FI.metierHTML = function () {
    return `
      <fieldset class="fi-fieldset" id="fi-met-fieldset">
        <legend>Métier</legend>

        <label class="fi-check"><input type="checkbox" id="fi-sans-emploi">
          ${T.L_SANS_EMPLOI}</label>

        <div id="fi-met-bloc">
          <div class="fi-row">
            <div class="fi-field">
              <label class="fi-label">${T.L_MET_ZONE}</label>
              <select id="fi-met-zone" class="fi-select"></select>
            </div>
            <div id="fi-met-entwrap" class="fi-field">
              <label class="fi-label">${T.L_MET_ENTREPRISE}</label>
              <select id="fi-met-entreprise" class="fi-select"></select>
            </div>
            <div id="fi-met-postewrap" class="fi-field">
              <label class="fi-label">${T.L_MET_POSTE}</label>
              <select id="fi-met-poste" class="fi-select"></select>
            </div>
          </div>

          <div class="fi-met-ligne">
            <div class="fi-field">
              <label class="fi-label">${T.L_MET_DEPUIS}</label>
              <input id="fi-met-depuis" class="fi-input" type="text" placeholder="2026">
            </div>
            <div class="fi-rangee fi-met-actions">
              <button type="button" class="fi-met-lien" id="fi-met-newposte">+ ${T.BTN_NEW_POSTE}</button>
              <button type="button" class="fi-met-lien" id="fi-met-newactivite">+ ${T.BTN_NEW_ACTIVITE}</button>
            </div>
          </div>

          <div id="fi-met-posteneuf" class="fi-conditionnel">
            <label class="fi-label">${T.L_MET_TITRE}</label>
            <input id="fi-met-titre" class="fi-input" type="text" placeholder="Ex : Chauffeur de nuit">
          </div>

          <div id="fi-met-activiteneuve" class="fi-conditionnel">
            <p class="fi-aide">${T.MET_AIDE_ACTIVITE}</p>
            <label class="fi-label">${T.L_MET_ENT_NOM}</label>
            <input id="fi-met-ent-nom" class="fi-input" type="text" placeholder="Ex : Chantier naval du Bayou">
            <label class="fi-label">${T.L_MET_ENT_TYPE}</label>
            <input id="fi-met-ent-type" class="fi-input" type="text" placeholder="Ex : Construction navale">
            <label class="fi-label">${T.L_MET_ENT_CAT}</label>
            <select id="fi-met-ent-cat" class="fi-select">${optionsCats()}</select>
          </div>
        </div>
      </fieldset>`;
  };

  /* === EVENTS === */

  const $ = (o, s) => o.querySelector(s);
  const setOpts = (sel, html) => { sel.innerHTML = html; };
  const vide = (txt) => `<option value="">${esc(txt)}</option>`;

  function majZones(overlay) {
    const zs = zonesDispo();
    setOpts($(overlay, "#fi-met-zone"),
      vide(T.MET_CHOISIR) + zs.map((z) => `<option value="${z.id}">${esc(z.titre)}</option>`).join(""));
    majEntreprises(overlay);
  }
  function majEntreprises(overlay) {
    const zone = $(overlay, "#fi-met-zone").value;
    const sel  = $(overlay, "#fi-met-entreprise");
    if (!zone) { setOpts(sel, vide(T.MET_ZONE_VIDE)); majPostes(overlay); return; }
    const liste = entDeZone(zone);
    setOpts(sel, liste.length
      ? vide(T.MET_CHOISIR) + liste.map((e) => `<option value="${esc(e.id)}">${esc(e.nom)}</option>`).join("")
      : vide(T.MET_AUCUNE_ENT));
    majPostes(overlay);
  }
  /* l'intitulé du poste est RECOPIÉ depuis la liste, jamais saisi : la
     correspondance rôle → poste est donc garantie par construction. */
  function majPostes(overlay) {
    const e   = entParId($(overlay, "#fi-met-entreprise").value);
    const sel = $(overlay, "#fi-met-poste");
    if (!e) { setOpts(sel, vide(T.MET_ENT_VIDE)); return; }
    const ps = postesLibres(e);
    setOpts(sel, ps.length
      ? vide(T.MET_CHOISIR) + ps.map((p) =>
          `<option value="${esc(p.t)}">${esc(p.t)}${p.dir ? " — direction" : ""}</option>`).join("")
      : vide(T.MET_AUCUN_POSTE));
  }

  // Trois modes exclusifs : liste, poste créé, activité créée.
  function mode(overlay, m) {
    overlay.dataset.metMode = m;
    const bascule = (id, on) => $(overlay, id).classList.toggle("fi-visible", on);
    bascule("#fi-met-posteneuf",    m === "poste");
    bascule("#fi-met-activiteneuve", m === "activite");
    $(overlay, "#fi-met-postewrap").style.display = (m === "liste") ? "" : "none";
    // en création d'activité, la zone reste utile (elle situe le lieu), pas l'entreprise
    $(overlay, "#fi-met-entwrap").style.display = (m === "activite") ? "none" : "";
    $(overlay, "#fi-met-newposte").textContent =
      (m === "poste") ? "← " + T.BTN_ANNULER_MET : "+ " + T.BTN_NEW_POSTE;
    $(overlay, "#fi-met-newactivite").textContent =
      (m === "activite") ? "← " + T.BTN_ANNULER_MET : "+ " + T.BTN_NEW_ACTIVITE;
  }

  FI.metierBrancher = async function (overlay) {
    if (!window.TDLZonesCats) {
      const f = $(overlay, "#fi-met-fieldset");
      if (f) f.innerHTML = `<legend>Métier</legend><p class="fi-aide">${T.ERR_MET_ZCATS}</p>`;
      if (window.console) console.error("[fiche-metier] " + T.ERR_MET_ZCATS);
      return;
    }
    await FI.metierCharger();
    majZones(overlay);
    mode(overlay, "liste");

    $(overlay, "#fi-met-zone").addEventListener("change", () => majEntreprises(overlay));
    $(overlay, "#fi-met-entreprise").addEventListener("change", () => majPostes(overlay));

    $(overlay, "#fi-met-newposte").addEventListener("click", () =>
      mode(overlay, overlay.dataset.metMode === "poste" ? "liste" : "poste"));
    $(overlay, "#fi-met-newactivite").addEventListener("click", () =>
      mode(overlay, overlay.dataset.metMode === "activite" ? "liste" : "activite"));

    $(overlay, "#fi-sans-emploi").addEventListener("change", (ev) => {
      $(overlay, "#fi-met-bloc").style.display = ev.target.checked ? "none" : "";
    });
  };

  /* === LECTURE === */

  FI.metierLecture = function (overlay) {
    const val = (s) => { const el = $(overlay, s); return el ? el.value.trim() : ""; };
    const Z = window.TDLZonesCats;
    const sansEmploi = !!($(overlay, "#fi-sans-emploi") || {}).checked;
    const m = overlay.dataset.metMode || "liste";

    if (sansEmploi) {
      return { sans_emploi: true, metier_mode: "aucun",
        metier_zone: "", metier_entreprise: "", metier_poste: "", metier_depuis: "",
        lieu_metier: "—", societe: T.MET_SANS_EMPLOI, emploi: "—" };
    }

    const zone   = val("#fi-met-zone");
    const depuis = val("#fi-met-depuis") || anneeCourante();
    const zTitre = Z ? Z.titreZone(zone) : zone;

    if (m === "activite") {
      const nom = val("#fi-met-ent-nom");
      return { sans_emploi: false, metier_mode: "activite",
        metier_zone: zone, metier_entreprise: "", metier_poste: val("#fi-met-titre") || "Fondateur",
        metier_depuis: depuis,
        metier_activite: { nom, type: val("#fi-met-ent-type"), cat: val("#fi-met-ent-cat") },
        lieu_metier: zTitre, societe: nom, emploi: val("#fi-met-titre") || "Fondateur" };
    }

    const id = val("#fi-met-entreprise");
    const e  = entParId(id);
    const poste = (m === "poste") ? val("#fi-met-titre") : val("#fi-met-poste");
    return { sans_emploi: false, metier_mode: m === "poste" ? "poste_neuf" : "liste",
      metier_zone: zone, metier_entreprise: id, metier_poste: poste, metier_depuis: depuis,
      lieu_metier: zTitre, societe: e ? e.nom : "", emploi: poste };
  };

  /* === VALIDATION === */

  FI.metierVerifier = function (d) {
    if (d.sans_emploi) return null;
    if (!d.metier_zone) return T.ERR_MET_ZONE;
    if (d.metier_mode === "activite") {
      const a = d.metier_activite || {};
      if (!a.nom)  return T.ERR_MET_ENT_NOM;
      if (!a.type) return T.ERR_MET_ENT_TYPE;
      return null;
    }
    if (!d.metier_entreprise) return T.ERR_MET_ENT;
    if (!d.metier_poste) return d.metier_mode === "poste_neuf" ? T.ERR_MET_TITRE : T.ERR_MET_POSTE;
    return null;
  };

  /* === RÉSERVATION (au dépôt de la demande) ===
     Le rôle est inscrit immédiatement avec attente:true. Le poste est donc
     bloqué dans le bottin, et la réservation y est VISIBLE : le staff peut la
     retirer d'un clic si la fiche n'aboutit pas. */
  FI.metierReserver = async function (d, pseudo, uid) {
    if (d.sans_emploi) return { ok: true };
    const E = window.EcoCore;
    if (!E || typeof E.firebaseUpdate !== "function") return { ok: false };

    const role = { nom: pseudo, poste: d.metier_poste, depuis: d.metier_depuis,
      type: "pj", lien: "", dir: false, attente: true };
    if (uid != null) role.uid = uid;

    if (d.metier_mode === "activite") {
      const a  = d.metier_activite || {};
      const id = "lieu_" + Date.now().toString(36);
      const k  = cle();
      role.dir = true; role.k = k;
      const u = {};
      // Le lieu porte « masque » et non « brouillon » : les deux nœuds sont
      // fusionnés à la lecture du bottin (Object.assign), et deux champs de même
      // nom s'écraseraient — impossible alors de distinguer un lieu masqué d'une
      // entreprise en brouillon. Sans ce drapeau, l'activité apparaîtrait
      // publiquement dans le Répertoire des lieux avant validation du staff.
      u["lieux/" + id] = { nom: a.nom, type: a.type, rue: "—", zone: d.metier_zone,
        cat: a.cat || "services", ic: "", img: "", facs: [], emploi: true, amb: "—", masque: true };
      /* [MAJ v2] naissance directe en schéma 2 : roles est un nœud à clés, et
         les listes vides ne s'écrivent pas du tout. */
      u["emplois/" + id] = { schema: SCHEMA,
        effectif: "", fondee: "", rayonnement: "", desc: "", accroche: "",
        verrou: false, complet: false, referent: pseudo, brouillon: true,
        roles: { [k]: role } };
      await E.firebaseUpdate(u);
      return { ok: true, entreprise: id, role: k };
    }

    await FI.metierCharger();
    const e = entParId(d.metier_entreprise);
    if (!e) return { ok: false };
    // Le poste a-t-il encore une place ? Un autre membre a pu être validé entre-temps.
    if (d.metier_mode === "liste") {
      const p = vt(e.postes).find((x) => x.t === d.metier_poste);
      if (!p || libresPoste(e, p) <= 0) return { ok: false, complet: true };
      role.dir = !!p.dir;
    }
    const u = {};
    if (estV2(e)) {
      /* [MAJ v2] un seul chemin : aucune réservation concurrente n'est écrasée */
      const k = cle(); role.k = k;
      u["emplois/" + e.id + "/roles/" + k] = role;
      await E.firebaseUpdate(u);
      return { ok: true, entreprise: e.id, role: k };
    }
    /* repli v1 : entreprise non encore convertie par le staff */
    const roles = vt(e.roles).slice();
    roles.push(role);
    u["emplois/" + e.id + "/roles"] = roles;
    await E.firebaseUpdate(u);
    return { ok: true, entreprise: e.id };
  };

  /* === RÉSUMÉ (affichage BBCode et carte staff) ===
     Évite la ligne « — — Sans emploi — — » qu'un simple assemblage produirait. */
  FI.metierResume = function (d) {
    if (d.sans_emploi) return T.MET_SANS_EMPLOI;
    return `<span>${esc(d.lieu_metier)}</span> <span>${esc(d.societe)}</span> <span>${esc(d.emploi)}</span>` || T.MET_HORS_BOTTIN;
  };

  /* === LIBÉRATION (refus ou abandon de la demande) ===
     Retire le rôle réservé — et lui seul : un rôle déjà confirmé n'est jamais
     touché. Une activité créée pour cette demande et jamais publiée est
     supprimée en entier, lieu compris : elle n'a pas d'existence propre. */
  FI.metierLiberer = async function (d) {
    if (d.sans_emploi) return { ok: true };
    const E = window.EcoCore;
    if (!E || typeof E.firebaseUpdate !== "function") return { ok: false };

    const [lieux, emplois] = await Promise.all([
      E.firebaseGet("lieux"), E.firebaseGet("emplois")
    ]);
    const L = lieux || {}, M = emplois || {};

    let id = d.metier_entreprise;
    if (!id && d.metier_mode === "activite") {
      id = Object.keys(M).find((k) => M[k].referent === d.pseudo
        && listerRoles(M[k]).some((o) => o.r.nom === d.pseudo && o.r.attente));
    }
    if (!id || !M[id]) return { ok: false, introuvable: true };

    const u = {};
    if (d.metier_mode === "activite" && L[id] && L[id].masque) {
      u["lieux/" + id]   = null;
      u["emplois/" + id] = null;
      await E.firebaseUpdate(u);
      return { ok: true, supprime: true };
    }
    const cible = trouverRole(M[id], d, true);
    if (!cible) return { ok: false, introuvable: true };

    if (estV2(M[id])) {
      /* [MAJ v2] on n'efface QUE la réservation visée */
      u["emplois/" + id + "/roles/" + cible.k] = null;
    } else {
      const roles = vt(M[id].roles).filter((r, i) => i !== cible.k);
      u["emplois/" + id + "/roles"] = roles.length ? roles : null;
    }
    await E.firebaseUpdate(u);
    return { ok: true };
  };

  /* === ATTRIBUTION (à la validation de la fiche) ===
     Le rôle réservé perd son drapeau attente. Le poste de direction confère le
     statut de référent, sauf entreprise verrouillée ou référent déjà en place. */
  FI.metierAppliquer = async function (d) {
    const E = window.EcoCore;
    if (!E || typeof E.firebaseUpdate !== "function") return { ok: false };
    const u = {};

    if (d.sans_emploi) {
      u["membres/" + d.pseudo + "/sans_emploi"] = true;
      await E.firebaseUpdate(u);
      return { ok: true, sansEmploi: true };
    }

    const M = (await E.firebaseGet("emplois")) || {};

    // L'activité créée porte son id ; sinon on retrouve l'entreprise choisie.
    let id = d.metier_entreprise;
    if (!id && d.metier_mode === "activite") {
      id = Object.keys(M).find((k) => M[k].referent === d.pseudo
        && listerRoles(M[k]).some((o) => o.r.nom === d.pseudo && o.r.poste === d.metier_poste));
    }
    if (!id || !M[id]) return { ok: false, introuvable: true };

    const src = M[id];
    const cible = trouverRole(src, d, false);
    if (!cible) return { ok: false, introuvable: true };
    const monRole = cible.r;

    if (estV2(src)) {
      /* [MAJ v2] un seul champ : le drapeau de CETTE réservation */
      u["emplois/" + id + "/roles/" + cible.k + "/attente"] = null;
    } else {
      const roles = vt(src.roles).map((r, i) => {
        if (i !== cible.k || !r) return r;
        const copie = Object.assign({}, r);
        delete copie.attente;
        return copie;
      });
      u["emplois/" + id + "/roles"] = roles;
    }

    // Référent : poste de direction, entreprise non verrouillée, place vacante.
    let referent = false;
    if (monRole && monRole.dir && !src.verrou && !src.referent) {
      u["emplois/" + id + "/referent"] = d.pseudo;
      referent = true;
    }
    // Un poste inventé est ajouté à la liste des postes, sinon il n'existerait
    // que par le rôle et le bottin afficherait une entreprise sans ce métier.
    if (d.metier_mode === "poste_neuf") {
      const dejaLa = (src.postes && !Array.isArray(src.postes))
        ? Object.keys(src.postes).some((k) => src.postes[k] && src.postes[k].t === d.metier_poste)
        : vt(src.postes).some((p) => p && p.t === d.metier_poste);
      if (!dejaLa) {
        const neuf = { t: d.metier_poste, c: "", ic: "fi-tr-briefcase", dir: false, n: 1, d: "" };
        if (estV2(src)) {
          const k = cle(); neuf.k = k;
          u["emplois/" + id + "/postes/" + k] = neuf;
        } else {
          const postes = vt(src.postes).slice();
          postes.push(neuf);
          u["emplois/" + id + "/postes"] = postes;
        }
      }
    }
    // Un brouillon d'activité reste brouillon jusqu'à sa publication par le staff
    // depuis le bottin : la validation de fiche ne le publie pas.
    await E.firebaseUpdate(u);
    return { ok: true, referent, entreprise: id };
  };

})(window.FI, window.FI.CFG, window.FI.TEXTES);
