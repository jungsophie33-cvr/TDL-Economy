/*
 * eco-dc-bottin.js — Répertoire public des multi-comptes · TDL
 *
 * CE QUE CE FICHIER FAIT : lit rec.doubles_comptes dans le JSONBin et affiche
 * la liste des groupes de multi-comptes dans la div .affichage-dc du sujet bottin.
 * Expose DC.rafraichirBottin() pour que le panel staff puisse mettre à jour
 * l'affichage en temps réel après une suppression, sans rechargement de page.
 * CE QU'IL NE FAIT PAS : aucune écriture JSONBin, aucune logique staff.
 *
 * CARTE DES BLOCS :
 *   RENDER  — génération du HTML de la liste depuis rec.doubles_comptes
 *   INIT    — point d'entrée exposé sur window.DC
 *
 * Dépend de : eco-dc-config.js, window.EcoCore
 */

(function (DC, CFG) {
  "use strict";

  /* === RENDER === */

  // Formate un groupe en ligne d'affichage :
  // @"Compte1" a pour multi-comptes : @"Compte2", @"Compte3"
  function formaterLigne(racine, comptes) {
    const autresComptes = comptes.filter((c) => c !== racine);

    // Un groupe sans autre compte ne s'affiche pas (slot validé mais pseudo pas encore inscrit)
    if (!autresComptes.length) return null;

    const formatPseudo = (p) => `@"${p}"`;
    return `${formatPseudo(racine)} a pour multi-comptes : ${autresComptes.map(formatPseudo).join(", ")}`;
  }

  function construireHTML(doubles_comptes) {
    if (!doubles_comptes || !Object.keys(doubles_comptes).length) {
      return "<em>Aucun multi-compte enregistré.</em>";
    }

    const lignes = Object.entries(doubles_comptes)
      .sort(([a], [b]) => a.localeCompare(b, "fr"))   // tri alphabétique par compte racine
      .map(([racine, groupe]) => formaterLigne(racine, groupe.comptes))
      .filter(Boolean);                                 // exclure les groupes sans multi-compte

    if (!lignes.length) return "<em>Aucun multi-compte enregistré.</em>";

    return lignes
      .map((ligne) => `<p class="dc-bottin-ligne">${ligne}</p>`)
      .join("");
  }

  async function afficherBottin(zoneEl) {
    zoneEl.textContent = "Chargement du répertoire…";

    const rec = await window.EcoCore.safeReadBin();
    if (!rec) {
      zoneEl.innerHTML = "<em>Impossible de charger les données.</em>";
      return;
    }

    zoneEl.innerHTML = construireHTML(rec.doubles_comptes);
  }

  /* === INIT === */

  DC.initBottin = function (zoneEl) {
    afficherBottin(zoneEl);
  };

  // Permet au panel staff de rafraîchir l'affichage immédiatement après une modification,
  // si le bottin et le panel sont sur la même page (cas peu probable mais prévu).
  DC.rafraichirBottin = function () {
    const zone = document.querySelector(CFG.SEL.ZONE_BOTTIN);
    if (zone) afficherBottin(zone);
  };

})(window.DC, window.DC.CFG);
