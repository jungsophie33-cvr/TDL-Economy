/*
 * eco-dc-bottin.js — Répertoire public des multi-comptes · TDL
 *
 * CE QUE CE FICHIER FAIT : lit rec.doubles_comptes et affiche la liste des groupes
 * dans .affichage-dc. Si les UIDs sont stockés, génère de vrais liens mentiontag
 * avec tooltip (même rendu que @"Pseudo" posté en BBCode). Sinon, affichage texte.
 * CE QU'IL NE FAIT PAS : aucune écriture JSONBin, aucune logique staff.
 *
 * CARTE DES BLOCS :
 *   MENTION  — génération HTML des liens mention avec ou sans UID
 *   RENDER   — construction de la liste depuis rec.doubles_comptes
 *   INIT     — points d'entrée exposés sur window.DC
 *
 * Dépend de : eco-dc-config.js, window.EcoCore
 */

(function (DC, CFG) {
  "use strict";

  /* === MENTION === */

  /*
   * Formate un pseudo en lien mention ForumActif si son UID est connu.
   * Le HTML produit est identique à ce que le parser BBCode génère pour @"Pseudo" :
   *   <a href="/u{uid}" rel="nofollow" data-id="{uid}" class="mentiontag">@Pseudo</a>
   * [MAJ] Si ForumActif change la structure HTML des mentions, mettre à jour ici.
   */
  function formaterMention(pseudo, uid) {
    if (!uid) return `@"${pseudo}"`;
    return `<a href="/u${uid}" rel="nofollow" data-id="${uid}" class="mentiontag dc-mention">@${pseudo}</a>`;
  }

  /*
   * ForumActif initialise Tooltipster sur .mentiontag via jQuery au chargement.
   * Nos éléments étant injectés après coup, on tente de les initialiser manuellement.
   * Si Tooltipster ou jQuery n'est pas disponible, les liens restent fonctionnels
   * mais sans tooltip — comportement dégradé acceptable.
   * [MAJ] Si ForumActif change sa configuration Tooltipster, ce bloc peut échouer silencieusement.
   */
  function initialiserTooltips(zoneEl) {
    if (!window.$ || !$.fn.tooltipster) return;
    try {
      $(zoneEl).find(".dc-mention:not(.tooltipstered)").tooltipster({
        theme:     "tooltipster-shadow",
        animation: "fade",
        delay:     100,
        content:   $("<span>Chargement…</span>"),
        // ForumActif charge le contenu du tooltip en AJAX au survol
        // [MAJ] Le callback functionBefore est spécifique à la conf FA — peut évoluer
        functionBefore: function (instance, helper) {
          const uid = helper.origin.dataset.id;
          if (uid && !helper.origin.dataset.loaded) {
            $.get("/u" + uid + "?view=mini", function (html) {
              instance.content($(html).find(".sj-profil, .mini-profil, .profile-mini").first());
              helper.origin.dataset.loaded = "1";
            });
          }
        },
      });
    } catch (_) { /* Tooltipster indisponible ou mal configuré — dégradation silencieuse */ }
  }

  /* === RENDER === */

  function formaterLigne(racine, groupe, uid_index) {
    // Normalisation : Firebase peut avoir converti comptes en objet {0:…, 1:…}
    const autres = DC.versTableau(groupe.comptes).filter((c) => c !== racine);
    if (!autres.length) return null;

    // L'UID est résolu depuis uid_index (rempli automatiquement par eco-ui.js au login)
    const uid = (pseudo) => DC.uidDepuisPseudo({ uid_index }, pseudo);

    const mentionRacine  = formaterMention(racine, uid(racine));
    const mentionsAutres = autres.map((p) => formaterMention(p, uid(p))).join(", ");
    return `${mentionRacine} a pour multi-comptes : ${mentionsAutres}`;
  }

  function construireHTML(doubles_comptes, uid_index) {
    if (!doubles_comptes || !Object.keys(doubles_comptes).length) {
      return "<em>Aucun multi-compte enregistré.</em>";
    }

    const lignes = Object.entries(doubles_comptes)
      .sort(([a], [b]) => a.localeCompare(b, "fr"))
      .map(([racine, groupe]) => formaterLigne(racine, groupe, uid_index))
      .filter(Boolean);

    if (!lignes.length) return "<em>Aucun multi-compte enregistré.</em>";

    return lignes.map((l) => `<p class="dc-bottin-ligne">${l}</p>`).join("");
  }

  async function afficherBottin(zoneEl) {
    zoneEl.textContent = "Chargement du répertoire…";

    const rec = await window.EcoCore.safeReadBin();
    if (!rec) { zoneEl.innerHTML = "<em>Impossible de charger les données.</em>"; return; }

    zoneEl.innerHTML = construireHTML(rec.doubles_comptes, rec.uid_index || {});
    initialiserTooltips(zoneEl);
  }

  /* === INIT === */

  DC.initBottin = function (zoneEl) {
    afficherBottin(zoneEl);
  };

  DC.rafraichirBottin = function () {
    const zone = document.querySelector(CFG.SEL.ZONE_BOTTIN);
    if (zone) afficherBottin(zone);
  };

})(window.DC, window.DC.CFG);
