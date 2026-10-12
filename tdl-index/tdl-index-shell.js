/*
 * tdl-index-shell.js — Structure de la page d'accueil · The Drowned Lands
 *
 * POURQUOI CE FICHIER EXISTE : l'éditeur du message d'accueil ForumActif
 * repasse le HTML dans son nettoyeur à chaque enregistrement — il réécrit les
 * <br>, referme des balises, réordonne des attributs. Un gabarit fait l'erreur
 * inverse : il ne convertit plus rien, donc les sauts de ligne du bloc de
 * données disparaissent et le parseur SOS ne voit qu'une seule ligne. Dans les
 * deux cas la coquille finit cassée. Elle vit donc ici, hors de portée.
 *
 * CE QU'IL FAUT LAISSER DANS LE MESSAGE D'ACCUEIL : rien, ou cette seule ligne,
 * que l'éditeur ne peut pas abîmer :
 *     <div id="tdli-racine"></div>
 * Si elle est absente, ce fichier monte le conteneur lui-même avant la liste
 * des forums.
 *
 * CE QU'IL NE CONTIENT PAS : les données. Elles sont dans tdl-index-data.js,
 * le seul fichier que le staff édite.
 *
 * TEXTES ÉDITORIAUX : l'accroche et le corps de « Une paroisse qui évolue »
 * sont dans l'objet TXT ci-dessous. C'est le seul endroit de ce fichier qu'on
 * ouvre pour autre chose qu'une évolution de structure.
 *
 * ORDRE DE CHARGEMENT : eco-core → tdl-index-data → tdl-index-shell
 *                       → tdl-index-core → habitants → meteo
 */

window.TDLI = window.TDLI || {};
(function (NS) {
  "use strict";
  if (NS._shell) return;
  NS._shell = true;

  /* ===================== CONFIG ===================== */
  var CFG = {
    ID_RACINE: "tdli-racine",
    /* [MAJ] points de montage, dans l'ordre d'essai */
    HOTES: [".panel.introduction", "#page-body"],
    CONTACT: "/f55-questions-suggestions"
  };

  /* ===================== TEXTES ===================== */
  var TXT = {
    COURIER:   "The Houma Courier",
    EN_JEU:    "En jeu",
    ATTENTE_T: "Le prochain numéro est sous presse",
    ATTENTE_C: "La rédaction boucle son édition.",
    JOUER:     "À vous de jouer",
    PAROISSE:  "Une paroisse qui évolue",
    ACCROCHE:  "Vos histoires&nbsp;; vos choix. Des conséquences.",
    CORPS:     "À Terrebonne, vos RP laissent une trace dans la trame globale&nbsp;: " +
               "les habitants colportent des rumeurs, les affaires évoluent, les communautés " +
               "s'organisent, des services se rendent puis se retournent, des dettes sont " +
               "rappelées et les secrets ne restent pas enterrés. Vous n'écrivez pas dans votre " +
               "coin&nbsp;; vous contribuez à l'évolution de Terrebonne et aux péripéties des " +
               "autres, même indirectement.",
    HABITER:   "Habiter Terrebonne",
    ONGLETS:   [["familles", "Familles"], ["communautes", "Communautés"], ["horslaloi", "Hors-la-loi"]],
    PREC:      "Entité précédente",
    SUIV:      "Entité suivante",
    METEO:     "Météo &middot; Houma",
    STAFF:     "Responsables de la Paroisse",
    CONTACT_T: "Une question ? Une idée ? Un problème ?",
    CONTACT_C: "La paroisse est entre de bonnes mains. N'hésitez pas à nous contacter.",
    ECRIRE:    "Nous écrire"
  };

  /* ===================== GABARIT ===================== */

  function tete(titre, droite, sombre) {
    return '<div class="tdli-head">' +
      (sombre ? '<span class="tdli-head-filet"></span>' : '<span class="tdli-head-tiret"></span>') +
      '<span class="tdli-head-titre">' + titre + "</span>" +
      '<span class="tdli-head-filet"></span>' + (droite || "") + "</div>";
  }

  /* Les deux couches décoratives de la météo : un lavis de ciel teinté par le
     JS, et un horizon de bayou. Les vagues s'étirent sur toute la largeur — la
     distorsion ne se voit pas sur une courbe — tandis que les cyprès gardent
     leurs proportions et restent ancrés aux deux bords. */
  function horizon() {
    return '<span class="tdli-met-voile"></span><span class="tdli-met-horizon">' +
      '<svg class="tdli-horizon-eau" viewBox="0 0 600 58" preserveAspectRatio="none" aria-hidden="true">' +
        '<path d="M0 37 Q 60 32 120 37 T 240 37 T 360 37 T 480 37 T 600 37 L600 58 L0 58 Z" fill="rgba(94,61,62,.16)"/>' +
        '<path d="M0 45 Q 70 40 140 45 T 280 45 T 420 45 T 560 45 T 700 45 L700 58 L0 58 Z" fill="rgba(94,61,62,.26)"/>' +
      "</svg>" +
      '<svg class="tdli-horizon-arbres tdli-horizon-gauche" viewBox="0 0 96 58" aria-hidden="true">' +
        '<g stroke="rgba(94,61,62,.55)" fill="none" stroke-width="1.6" stroke-linecap="round">' +
        '<path d="M28 40V11M28 17l-8-4M28 17l8-4M28 24l-10-4M28 24l10-4M28 31l-12-4M28 31l12-4"/>' +
        '<path d="M58 40V21M58 26l-6-3M58 26l6-3M58 32l-8-3M58 32l8-3"/></g></svg>' +
      '<svg class="tdli-horizon-arbres tdli-horizon-droite" viewBox="0 0 76 58" aria-hidden="true">' +
        '<g stroke="rgba(94,61,62,.55)" fill="none" stroke-width="1.6" stroke-linecap="round">' +
        '<path d="M22 40V15M22 21l-7-4M22 21l7-4M22 28l-9-4M22 28l9-4"/>' +
        '<path d="M50 40V25M50 30l-6-3M50 30l6-3"/></g></svg></span>';
  }

  function gabarit() {
    var periode = '<span class="tdli-periode"><i class="fi fi-tr-calendar-day"></i> ' +
                  TXT.EN_JEU + ' <b id="tdli-periode">&mdash;</b></span>';
    return '<div class="tdli-grid">' +

      /* 1. Courier — rempli par le core depuis accueil/une */
      '<section class="tdli-card tdli-c8">' + tete(TXT.COURIER, periode) +
        '<div class="tdli-cour" id="tdli-cour"><div class="tdli-une"><div class="tdli-une-texte">' +
          '<h2 class="tdli-titre-une">' + TXT.ATTENTE_T + "</h2>" +
          '<p class="tdli-chapo">' + TXT.ATTENTE_C + "</p>" +
        '</div></div><div class="tdli-secs"></div></div></section>' +

      /* 2. À vous de jouer — rempli par le core depuis accueil/compteurs */
      '<section class="tdli-card tdli-sombre tdli-c4 tdli-jouer">' + tete(TXT.JOUER, "", true) +
        '<div class="tdli-cpts" id="tdli-cpts"></div></section>' +

      /* 3. Paroisse — éditorial, voir TXT */
      '<section class="tdli-card tdli-c4 tdli-par">' + tete(TXT.PAROISSE) +
        '<p class="tdli-par-accroche">' + TXT.ACCROCHE + "</p>" +
        '<p class="tdli-par-corps">' + TXT.CORPS + "</p></section>" +

      /* 4. Habiter Terrebonne — rempli par tdl-index-habitants */
      '<section class="tdli-card tdli-c8"><div class="tdli-tabs">' +
        '<span class="tdli-tabs-titre">' + TXT.HABITER + "</span>" +
        TXT.ONGLETS.map(function (o, i) {
          return '<button class="tdli-tab" type="button" data-onglet="' + o[0] +
                 '" aria-selected="' + (i === 0 ? "true" : "false") + '">' + o[1] + "</button>";
        }).join("") +
        '<span class="tdli-pos" id="tdli-pos"></span><span class="tdli-nav">' +
        '<button id="tdli-prev" type="button" aria-label="' + TXT.PREC + '">&lsaquo;</button>' +
        '<button id="tdli-next" type="button" aria-label="' + TXT.SUIV + '">&rsaquo;</button>' +
        '</span></div><div class="tdli-ent" id="tdli-ent"></div></section>' +

      /* 5. Météo — remplie par tdl-index-meteo */
      '<section class="tdli-card tdli-c5 tdli-met" id="tdli-met">' + horizon() + tete(TXT.METEO) +
        '<div class="tdli-met-corps" id="tdli-met-corps"></div></section>' +

      /* 6. Staff — rempli par tdl-index-habitants */
      '<section class="tdli-card tdli-c7">' + tete(TXT.STAFF) +
        '<div class="tdli-staff"><div class="tdli-volets" id="tdli-eq"></div>' +
        '<div class="tdli-contact"><div class="tdli-contact-titre">' + TXT.CONTACT_T + "</div>" +
        "<p>" + TXT.CONTACT_C + "</p>" +
        '<a class="tdli-btn" href="' + CFG.CONTACT + '">' + TXT.ECRIRE +
        ' <span class="tdli-fleche">&rarr;</span></a></div></div></section>' +

      "</div>";
  }

  /* ===================== MONTAGE ===================== */

  /* La ligne laissée dans le message d'accueil a priorité ; sans elle, on
     fabrique le conteneur en tête du premier hôte disponible. On ne monte que
     sur l'index : ailleurs, .panel.introduction n'existe pas. */
  function racine() {
    var r = document.getElementById(CFG.ID_RACINE);
    if (r) return r;
    var hote = null, i;
    for (i = 0; i < CFG.HOTES.length && !hote; i++) hote = document.querySelector(CFG.HOTES[i]);
    if (!hote) return null;
    r = document.createElement("div");
    r.id = CFG.ID_RACINE;
    hote.insertBefore(r, hote.firstChild);
    return r;
  }

  function monter() {
    var r = racine();
    if (!r || r.getAttribute("data-monte")) return;
    r.className = "tdli";
    r.innerHTML = gabarit();
    r.setAttribute("data-monte", "1");
  }

  NS.monterShell = monter;

  /* FA déclenche DOMContentLoaded trop tôt : on attend load, avec le repli
     readyState pour le cas où ce fichier arrive après l'événement. */
  if (document.readyState === "complete") monter();
  else window.addEventListener("load", monter);
})(window.TDLI);
