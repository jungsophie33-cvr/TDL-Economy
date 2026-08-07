/*
 * fiche-habitation.js — Bloc « Habitation » du formulaire de validation · TDL
 *
 * CE QUE CE FICHIER FAIT : remplace les trois champs libres Habitation (lieu, numéro,
 * type) par une cascade branchée sur le Bottin des habitations (window.BH) :
 *   quartier → type de maison (liste dépendante du quartier) → numéro,
 * avec détection de doublon : si le N° est déjà occupé, on affiche les occupants,
 * le type est verrouillé sur celui de la maison, et une case « j'emménage avec eux »
 * doit être cochée pour lever le blocage (règle du bottin : mvExistTxt).
 * CE QU'IL NE FAIT PAS : rendu de la modale, logique staff.
 *
 * COMPATIBILITÉ : la demande continue de porter lieu_habitation / numero / type_logement
 * (le staff les écrit déjà via affecterHabitation, le bottin résout le quartier par son
 * nom d'affichage). Deux champs internes _hab_qk / _hab_cohab s'y ajoutent pour la validation.
 *
 * CARTE DES BLOCS :
 *   TEXTES     — chaînes ajoutées à FI.TEXTES
 *   RENDER     — HTML du fieldset
 *   EVENTS     — cascade quartier→type + détection de doublon
 *   LECTURE    — extraction des valeurs
 *   VALIDATION — champs obligatoires + confirmation de cohabitation
 *   RÉSUMÉ     — spans pour le BBCode de la demande
 *
 * Dépend de : fiche-config.js, fiche-utils.js, tdl-both-model.js (window.BH), window.EcoCore
 * À charger APRÈS fiche-utils.js et tdl-both-model.js, AVANT fiche-membre.js.
 */

(function (FI, CFG, T) {
  "use strict";

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const BH  = () => window.BH;
  const vt  = (v) => (window.BH ? window.BH.versTableau(v) : (!v ? [] : (Array.isArray(v) ? v : Object.values(v))));
  // Comparaison tolérante des numéros : « n°14 », « N° 14 », « 14 » → « 14 »
  const normNum = (n) => String(n == null ? "" : n).replace(/^n[°ºo]\s*/i, "").trim().toLowerCase();

  /* === TEXTES === */
  Object.assign(T, {
    L_HAB_QUARTIER: "Quartier *",
    L_HAB_TYPE:     "Type de logement *",
    L_HAB_NUMERO:   "N° de logement *",
    HAB_CHOISIR:    "— Choisir —",
    HAB_CHOISIR_T:  "— Choisir un quartier d'abord —",
    HAB_AUCUN_TYPE: "Aucun type défini pour ce quartier",
    HAB_DEJA:       "Déjà habité par :",
    HAB_TYPE_MAISON:"Type de la maison :",
    HAB_TYPE_PRIME: " — c'est ce type qui s'appliquera.",
    HAB_COHAB:      "J'emménage quand même avec eux.",
    ERR_HAB_QUARTIER: "⚠️ Le quartier d'habitation est requis.",
    ERR_HAB_NUMERO:   "⚠️ Le numéro de logement est requis.",
    ERR_HAB_TYPE:     "⚠️ Le type de logement est requis.",
    ERR_HAB_COHAB:    (qui) => `⚠️ Le N° est déjà occupé par ${qui}. Cochez « ${T.HAB_COHAB} » pour confirmer.`,
  });

  /* === RENDER === */
  FI.habitationHTML = function () {
    return `
      <fieldset class="fi-fieldset">
        <legend>Habitation</legend>
        <label class="fi-label">${T.L_HAB_QUARTIER}</label>
        <select id="fi-hab-quartier" class="fi-select">
          <option value="">${T.HAB_CHOISIR}</option>
        </select>
        <div class="fi-rangee">
          <div style="flex:1">
            <label class="fi-label">${T.L_HAB_TYPE}</label>
            <select id="fi-hab-type" class="fi-select">
              <option value="">${T.HAB_CHOISIR_T}</option>
            </select>
          </div>
          <div style="flex:1">
            <label class="fi-label">${T.L_HAB_NUMERO}</label>
            <input id="fi-hab-numero" class="fi-input" type="text" placeholder="Ex : 14">
          </div>
        </div>
        <div id="fi-hab-occ" class="fi-conditionnel"></div>
      </fieldset>
    `;
  };

  /* === EVENTS === */
  function remplirTypes(selQ, selT) {
    const q = BH() && BH().QUARTIERS[selQ.value];
    if (!q) { selT.innerHTML = `<option value="">${T.HAB_CHOISIR_T}</option>`; return; }
    const types = vt(q.types);
    selT.innerHTML = types.length
      ? types.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")
      : `<option value="">${T.HAB_AUCUN_TYPE}</option>`;
  }

  function occupants(qk, numero) {
    const cible = normNum(numero);
    return (BH() && BH().HABITANTS ? BH().HABITANTS : [])
      .filter((m) => m.quartier === qk && normNum(m.numero) === cible);
  }

  function verifOccupation(selQ, inpN, selT, zone) {
    const qk = selQ.value, num = inpN.value.trim();
    zone.classList.remove("fi-visible"); zone.innerHTML = "";
    const deverrouiller = () => { if (selT.disabled) { selT.disabled = false; remplirTypes(selQ, selT); } };
    if (!qk || !num) { deverrouiller(); return; }

    const occ = occupants(qk, num);
    if (!occ.length) { deverrouiller(); return; }   // N° libre → le joueur choisit le type

    // N° occupé : type verrouillé sur celui de la maison + confirmation de cohabitation
    const typeMaison = occ[0].type || "";
    if (typeMaison) {
      selT.innerHTML = `<option value="${esc(typeMaison)}" selected>${esc(typeMaison)}</option>`;
      selT.disabled = true;
    }
    zone.innerHTML = `
      <div class="fi-hab-occ">
        <div><b>${T.HAB_DEJA}</b> ${occ.map((m) => esc(m.nom)).join(", ")}.</div>
        <div>${T.HAB_TYPE_MAISON} <b>${esc(typeMaison || "—")}</b>${T.HAB_TYPE_PRIME}</div>
        <label class="fi-hab-cohab"><input type="checkbox" id="fi-hab-cohab"> ${T.HAB_COHAB}</label>
      </div>`;
    zone.classList.add("fi-visible");
  }

  // Appelé à la première ouverture de la modale (comme FI.metierBrancher).
  FI.habitationBrancher = async function (overlay) {
    const selQ = overlay.querySelector("#fi-hab-quartier");
    const selT = overlay.querySelector("#fi-hab-type");
    const inpN = overlay.querySelector("#fi-hab-numero");
    const zone = overlay.querySelector("#fi-hab-occ");
    if (!selQ || !BH()) return;

    // Charge le modèle (overrides quartiers Firebase + liste des habitants pour la détection).
    try { if (BH().DONNEES) await BH().DONNEES.chargerTout(); } catch (e) { if (window.console) console.warn("[fiche-habitation] chargerTout", e); }

    selQ.innerHTML = `<option value="">${T.HAB_CHOISIR}</option>` + BH().ORDRE.map((k) => {
      const q = BH().QUARTIERS[k]; if (!q) return "";
      return `<option value="${esc(k)}">${esc(q.nom)}</option>`;
    }).join("");

    selQ.addEventListener("change", () => { remplirTypes(selQ, selT); verifOccupation(selQ, inpN, selT, zone); });
    inpN.addEventListener("input", () => verifOccupation(selQ, inpN, selT, zone));
  };

  /* === LECTURE === */
  FI.habitationLecture = function (overlay) {
    const qk = overlay.querySelector("#fi-hab-quartier")?.value || "";
    const q  = BH() && BH().QUARTIERS[qk];
    return {
      lieu_habitation: q ? q.nom : "",                                  // nom d'affichage (résolu par le bottin)
      numero:          (overlay.querySelector("#fi-hab-numero")?.value || "").trim(),
      type_logement:   overlay.querySelector("#fi-hab-type")?.value || "",
      _hab_qk:         qk,
      _hab_cohab:      !!overlay.querySelector("#fi-hab-cohab")?.checked,
    };
  };

  /* === VALIDATION === */
  FI.habitationVerifier = function (d) {
    if (!d.lieu_habitation) return T.ERR_HAB_QUARTIER;
    if (!d.numero)          return T.ERR_HAB_NUMERO;
    if (!d.type_logement)   return T.ERR_HAB_TYPE;
    const occ = occupants(d._hab_qk, d.numero);
    if (occ.length && !d._hab_cohab) return T.ERR_HAB_COHAB(occ.map((m) => m.nom).join(", "));
    return null;
  };

  /* === RÉSUMÉ (BBCode de la demande) === */
  FI.habitationResume = function (d) {
    return `<span>${esc(d.lieu_habitation)}</span> <span>${esc(d.numero)}</span> <span>${esc(d.type_logement)}</span>`;
  };

})(window.FI, window.FI.CFG, window.FI.TEXTES);
