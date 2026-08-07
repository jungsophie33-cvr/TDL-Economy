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
 * CARTE DES BLOCS :
 *   TEXTES     — chaînes ajoutées à FI.TEXTES
 *   DONNÉES    — lecture du bottin (lieux + emplois)
 *   RENDER     — HTML du fieldset
 *   EVENTS     — cascade des listes et bascules
 *   LECTURE    — extraction des valeurs
 *   VALIDATION — champs obligatoires
 *   RÉSERVATION — écriture au dépôt de la demande
 *   ATTRIBUTION — écriture à la validation de la fiche
 *
 * COMPATIBILITÉ : la demande continue de porter lieu_metier / societe / emploi
 * pour que le BBCode et la carte staff restent inchangés. Les champs
 * structurés (metier_*) s'y ajoutent.
 *
 * Dépend de : fiche-config.js, fiche-utils.js, tdl-zcats.js, window.EcoCore
 * À charger APRÈS fiche-utils.js et AVANT fiche-membre.js.
 */

(function (FI, CFG, T) {
  "use strict";

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const vt = (v) => FI.versTableau(v);
  const anneeCourante = () => String(new Date().getFullYear());

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
    const rec = await window.EcoCore.safeReadBin();
    const lieux   = (rec && rec.lieux)   || {};
    const emplois = (rec && rec.emplois) || {};
    ENT = Object.keys(lieux)
      .filter((id) => lieux[id] && lieux[id].emploi === true && !lieux[id].masque)
      .map((id) => {
        const e = Object.assign({ id }, lieux[id], emplois[id] || {});
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
     retirer d'un clic si la fiche n'aboutit pas. Appelé APRÈS le writeBin de
     soumettre() — un writeBin réécrit toute la racine et effacerait sinon
     cette écriture. */
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
      role.dir = true;
      const u = {};
      // Le lieu porte « masque » et non « brouillon » : les deux nœuds sont
      // fusionnés à la lecture du bottin (Object.assign), et deux champs de même
      // nom s'écraseraient — impossible alors de distinguer un lieu masqué d'une
      // entreprise en brouillon. Sans ce drapeau, l'activité apparaîtrait
      // publiquement dans le Répertoire des lieux avant validation du staff.
      u["lieux/" + id] = { nom: a.nom, type: a.type, rue: "—", zone: d.metier_zone,
        cat: a.cat || "services", ic: "", img: "", facs: [], emploi: true, amb: "—", masque: true };
      u["emplois/" + id] = { effectif: "", fondee: "", rayonnement: "", desc: "", accroche: "",
        culture: [], partenaires: [], rivaux: [], verrou: false, complet: false,
        referent: pseudo, brouillon: true, roles: [role], postes: [] };
      await E.firebaseUpdate(u);
      return { ok: true, entreprise: id };
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
    const roles = vt(e.roles).slice();
    roles.push(role);
    const u = {}; u["emplois/" + e.id + "/roles"] = roles;
    await E.firebaseUpdate(u);
    return { ok: true, entreprise: e.id };
  };

  /* === RÉSUMÉ (affichage BBCode et carte staff) ===
     Évite la ligne « — — Sans emploi — — » qu'un simple assemblage produirait. */
  FI.metierResume = function (d) {
    if (d.sans_emploi) return T.MET_SANS_EMPLOI;
    const bouts = [d.lieu_metier, d.societe, d.emploi].filter((x) => x && x !== "—");
    return bouts.join(" — ") || T.MET_HORS_BOTTIN;
  };

  /* === LIBÉRATION (refus ou abandon de la demande) ===
     Retire le rôle réservé — et lui seul : un rôle déjà confirmé n'est jamais
     touché. Une activité créée pour cette demande et jamais publiée est
     supprimée en entier, lieu compris : elle n'a pas d'existence propre. */
  FI.metierLiberer = async function (d) {
    if (d.sans_emploi) return { ok: true };
    const E = window.EcoCore;
    if (!E || typeof E.firebaseUpdate !== "function") return { ok: false };

    const rec = await E.safeReadBin();
    const emplois = (rec && rec.emplois) || {};
    const lieux   = (rec && rec.lieux)   || {};

    let id = d.metier_entreprise;
    if (!id && d.metier_mode === "activite") {
      id = Object.keys(emplois).find((k) => emplois[k].referent === d.pseudo
        && vt(emplois[k].roles).some((x) => x && x.nom === d.pseudo && x.attente));
    }
    if (!id || !emplois[id]) return { ok: false, introuvable: true };

    const u = {};
    if (d.metier_mode === "activite" && lieux[id] && lieux[id].masque) {
      u["lieux/" + id]   = null;
      u["emplois/" + id] = null;
      await E.firebaseUpdate(u);
      return { ok: true, supprime: true };
    }
    const roles = vt(emplois[id].roles).filter((r) => {
      if (!r) return false;
      const cible = (d.uid != null && r.uid != null)
        ? String(r.uid) === String(d.uid)
        : r.nom === d.pseudo;
      return !(cible && r.poste === d.metier_poste && r.attente);
    });
    u["emplois/" + id + "/roles"] = roles;
    await E.firebaseUpdate(u);
    return { ok: true };
  };

  /* === ATTRIBUTION (à la validation de la fiche) ===
     Le rôle réservé perd son drapeau attente. Le poste de direction confère le
     statut de référent, sauf entreprise verrouillée ou référent déjà en place.
     Appelé APRÈS le writeBin de valider(), comme reclamerFaceclaim. */
  FI.metierAppliquer = async function (d) {
    const E = window.EcoCore;
    if (!E || typeof E.firebaseUpdate !== "function") return { ok: false };
    const u = {};

    if (d.sans_emploi) {
      u["membres/" + d.pseudo + "/sans_emploi"] = true;
      await E.firebaseUpdate(u);
      return { ok: true, sansEmploi: true };
    }

    const rec = await E.safeReadBin();
    const emplois = (rec && rec.emplois) || {};

    // L'activité créée porte son id ; sinon on retrouve l'entreprise choisie.
    let id = d.metier_entreprise;
    if (!id && d.metier_mode === "activite") {
      id = Object.keys(emplois).find((k) => {
        const r = vt(emplois[k].roles);
        return emplois[k].referent === d.pseudo
          && r.some((x) => x && x.nom === d.pseudo && x.poste === d.metier_poste);
      });
    }
    if (!id || !emplois[id]) return { ok: false, introuvable: true };

    const e = emplois[id];
    const roles = vt(e.roles).map((r) => {
      if (!r) return r;
      const cible = (d.uid != null && r.uid != null)
        ? String(r.uid) === String(d.uid)
        : r.nom === d.pseudo;
      if (!cible || r.poste !== d.metier_poste) return r;
      const copie = Object.assign({}, r);
      delete copie.attente;
      return copie;
    });
    u["emplois/" + id + "/roles"] = roles;

    // Référent : poste de direction, entreprise non verrouillée, place vacante.
    const monRole = roles.find((r) => r && r.poste === d.metier_poste
      && (r.nom === d.pseudo || (d.uid != null && String(r.uid) === String(d.uid))));
    let referent = false;
    if (monRole && monRole.dir && !e.verrou && !e.referent) {
      u["emplois/" + id + "/referent"] = d.pseudo;
      referent = true;
    }
    // Un poste inventé est ajouté à la liste des postes, sinon il n'existerait
    // que par le rôle et le bottin afficherait une entreprise sans ce métier.
    if (d.metier_mode === "poste_neuf") {
      const postes = vt(e.postes).slice();
      if (!postes.some((p) => p && p.t === d.metier_poste)) {
        postes.push({ t: d.metier_poste, c: "", ic: "fi-tr-briefcase", dir: false, n: 1, d: "" });
        u["emplois/" + id + "/postes"] = postes;
      }
    }
    // Un brouillon d'activité reste brouillon jusqu'à sa publication par le staff
    // depuis le bottin : la validation de fiche ne le publie pas.
    await E.firebaseUpdate(u);
    return { ok: true, referent, entreprise: id };
  };

})(window.FI, window.FI.CFG, window.FI.TEXTES);
