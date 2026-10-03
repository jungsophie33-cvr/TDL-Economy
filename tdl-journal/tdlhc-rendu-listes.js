/*
 * tdlhc-rendu-listes.js — Rubriques « Petites annonces », « État civil », « Avis légaux »
 * du journal The Houma Courier · TDL · lot 1
 *
 * CE QUE CE FICHIER FAIT :
 *   - enregistre trois vues de type « liste à onglets » auprès de tdlhc-core ;
 *   - petites annonces et pré-liens : lus dans Firebase (journal/annonces, journal/prelien),
 *     seuls les contenus non expirés s'affichent, pré-liens épinglés en tête ;
 *   - état civil et avis légaux : lus dans le sujet, numéro d'avis calculé.
 * CE QU'IL NE FAIT PAS : aucune écriture ; le bouton de dépôt n'apparaît
 *   que lorsque le volet de soumission (lot 2) est chargé.
 *
 * DÉPEND DE : window.Courier et window.Courier.rendu (tdlhc-core, tdlhc-rendu).
 * À CHARGER : après tdlhc-rendu.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var RUB_ANNONCE = {
    emploi:   { l:"Emploi",          ic:"briefcase" },
    logement: { l:"Logement",        ic:"cabin" },
    services: { l:"Services",        ic:"crossed-hammers" },
    vendre:   { l:"À vendre",        ic:"box" },
    perso:    { l:"Avis personnels", ic:"circle-user" }
  };
  var NATURE_PRELIEN = { famille:"Famille ou parenté", amitie:"Amitié ancienne", associe:"Associé ou employeur",
                         rancune:"Rancune ou dette", voisinage:"Voisinage", autre:"Autre" };
  var ICONE_CIVIL = { naissance:"baby-carriage", mariage:"church", deces:"cross-religion" };

  var TXT = {
    ANNONCES:"Petites annonces", CIVIL:"État civil", LEGAUX:"Avis légaux",
    ARIANE:"The Houma Courier", LEGAUX_ARIANE:"Avis légaux de la paroisse de Terrebonne",
    LEGAUX_NOTE:"Publiés par la rédaction",
    TOUS:"Tous", TOUTES:"Toutes", PRELIENS:"Pré-liens",
    PUBLIER:"Publier une annonce — 30 $", DEPOSER:"Déposer un avis — gratuit",
    ON_RECHERCHE:"On recherche", EPINGLE:"— annonces épinglées un mois",
    PRELIEN:"Pré-lien", VOIR:"Voir le pré-lien",
    ENCORE:function(j){ return j > 1 ? "encore " + j + " jours" : "dernier jour"; },
    CEREMONIE_RP:"Rejoindre la cérémonie",
    AVIS_REF:function(num, nat, d){ return (num ? "Avis n° " + num + " · " : "") + nat + " · publié le " + d; },
    VIDE_ANNONCES:"Aucune annonce dans cette rubrique pour le moment.",
    VIDE_CIVIL:"Aucun avis dans cette rubrique pour le moment.",
    VIDE_LEGAUX:"Aucun avis dans cette rubrique pour le moment."
  };

  /* ===================== UTILS ===================== */
  var A = null, R = null;
  function esc(s){ return A.esc(s); }
  function boucle(l, fn){ Array.prototype.forEach.call(l, fn); }
  function actifs(n){
    var now = Date.now();
    return Object.keys(n||{}).map(function(k){ return n[k]; })
      .filter(function(x){ return x && x.titre && (!x.expire || A.ms(x.expire) > now); })
      .sort(function(a,b){ return A.ms(b.publie) - A.ms(a.publie); });
  }
  function onglets(liste){        /* [[filtre, libellé], …] ; le premier est actif */
    return '<div class="tdlhc-onglets">' + liste.map(function(o, i){
      return '<div class="tdlhc-onglet' + (i ? "" : " on") + '" data-f="' + esc(o[0]) + '">' + esc(o[1]) + '</div>';
    }).join("") + '</div>';
  }
  function ariane(titre, droite){
    return '<div class="tdlhc-ariane-bar"><div class="tdlhc-ariane">' + esc(TXT.ARIANE) + ' · <b>' + esc(titre) + '</b></div>' + (droite||"") + '</div>';
  }
  function boutonDepot(type, libelle){
    return typeof A.soumettre==="function"
      ? '<button class="tdlhc-btn" type="button" data-soumettre="' + esc(type) + '"><i class="fi fi-tr-add"></i> ' + esc(libelle) + '</button>' : "";
  }
  function lignes(html, videTxt){
    return '<div class="tdlhc-rows' + (html ? "" : " vide") + '">' + html + '<p class="tdlhc-vide">' + esc(videTxt) + '</p></div>';
  }
  /* Paragraphes d'un contenu du sujet, réunis dans un seul <p> */
  function texteJoint(c){ return R.paras(c).map(function(p){ return p.html; }).join('<br class="tdlhc-br">'); }
  /* Une ancre reçue d'une notification : on fait défiler jusqu'à la ligne */
  function viser(sec, ancre){
    if (!ancre) return;
    var el = sec.querySelector('[data-ancre="' + ancre + '"]');
    if (el) el.scrollIntoView({ block:"center" });
  }

  /* ===================== RENDER : PETITES ANNONCES ET PRÉ-LIENS ===================== */
  function htmlPrelien(p){
    var jours = Math.max(1, Math.ceil((A.ms(p.expire) - Date.now()) / 86400000));
    var url = /^https?:\/\//i.test(p.url||"") ? p.url : "";
    return '<article class="tdlhc-prelien"><div class="tdlhc-prelien-type">' + esc(TXT.PRELIEN)
      + (NATURE_PRELIEN[p.nature] ? " · " + esc(NATURE_PRELIEN[p.nature]) : "") + '</div>'
      + '<h5>' + esc(p.titre) + '</h5><p>' + esc(p.texte) + '</p>'
      + '<div class="tdlhc-prelien-pied"><span><b>' + esc(p.signature||"") + '</b>' + esc(p.expire ? TXT.ENCORE(jours) : "") + '</span>'
      + (url ? '<a class="tdlhc-btn petit" href="' + esc(url) + '" data-ext><i class="fi fi-tr-arrow-up-right-from-square"></i> ' + esc(TXT.VOIR) + '</a>' : "")
      + '</div></article>';
  }
  function htmlAnnonce(a){
    var r = RUB_ANNONCE[a.rubrique] || RUB_ANNONCE.perso;
    return '<div class="tdlhc-row" data-cat="' + esc(a.rubrique||"perso") + '" style="--c:var(--gr1-color)">'
      + '<div class="tdlhc-ico"><i class="fi fi-tr-' + r.ic + '"></i></div>'
      + '<div class="tdlhc-row-txt"><h5>' + esc(a.titre) + '</h5><p>' + esc(a.texte)
      + (a.signature ? " — " + esc(a.signature) : "") + '</p></div>'
      + '<div class="tdlhc-row-meta"><b>' + esc(r.l) + '</b>' + esc(A.dateLisible(a.publie)) + '</div></div>';
  }
  async function afficherAnnonces(sec){
    if (sec.getAttribute("data-pret")) return;
    sec.innerHTML = R.chargement();
    var j = A.journal(await A.fb()), pre = actifs(j.prelien), ann = actifs(j.annonces);
    var tabs = [["*", TXT.TOUTES]].concat(Object.keys(RUB_ANNONCE).map(function(k){ return [k, RUB_ANNONCE[k].l]; }), [["prelien", TXT.PRELIENS]]);
    var html = (pre.length
        ? '<div class="tdlhc-prelis" data-cat="prelien"><p class="tdlhc-prelis-tete"><i class="fi fi-tr-address-card"></i> '
          + esc(TXT.ON_RECHERCHE) + ' <span>' + esc(TXT.EPINGLE) + '</span></p><div class="tdlhc-prelis-grille">'
          + pre.map(htmlPrelien).join("") + '</div></div>' : "")
      + ann.map(htmlAnnonce).join("");
    sec.innerHTML = '<div class="tdlhc-plein">' + ariane(TXT.ANNONCES, boutonDepot("annonce", TXT.PUBLIER))
      + onglets(tabs) + lignes(html, TXT.VIDE_ANNONCES) + '</div>';
    sec.setAttribute("data-pret", "1");
  }

  /* ===================== RENDER : ÉTAT CIVIL ===================== */
  function htmlCivil(c){
    var nat = c.cles.NATURE, rp = /^https?:\/\//i.test(c.cles.RP||"") ? c.cles.RP : "";
    var cer = c.cles.CEREMONIE
      ? '<p>' + esc(c.cles.CEREMONIE) + (rp ? ' · <a class="tdlhc-lien" href="' + esc(rp) + '" data-ext>' + esc(TXT.CEREMONIE_RP) + '</a>' : "") + '</p>' : "";
    return '<div class="tdlhc-row civil" data-cat="' + esc(nat) + '" data-ancre="' + esc(c.ancre) + '" style="--c:var('
      + (nat==="deces" ? "--gr6-color" : "--gr5-color") + ')"><div class="tdlhc-ico"><i class="fi fi-tr-' + (ICONE_CIVIL[nat]||"family") + '"></i></div>'
      + '<div class="tdlhc-row-txt"><h5>' + esc(c.cles.TITRE) + '</h5><p>' + texteJoint(c) + '</p>' + cer + '</div>'
      + '<div class="tdlhc-row-meta"><b>' + esc(R.NATURE_CIVIL[nat]||"") + '</b>' + esc(A.dateLisible(c.cles.DATE)) + '</div></div>';
  }
  async function afficherCivil(sec, api, opts){
    if (!sec.getAttribute("data-pret")) {
      sec.innerHTML = R.chargement();
      await R.preparer(sec, function(){ return A.chargerTout(); });
      var tabs = [["*", TXT.TOUS]].concat(Object.keys(R.NATURE_CIVIL).map(function(k){ return [k, R.NATURE_CIVIL[k]]; }));
      sec.innerHTML = '<div class="tdlhc-plein">' + ariane(TXT.CIVIL, boutonDepot("civil", TXT.DEPOSER))
        + onglets(tabs) + lignes(A.contenus("etat-civil").map(htmlCivil).join(""), TXT.VIDE_CIVIL) + '</div>';
      sec.setAttribute("data-pret", "1");
    }
    viser(sec, opts.ancre);
  }

  /* ===================== RENDER : AVIS LÉGAUX ===================== */
  function htmlAvis(c){
    var d = A.dateLisible(c.cles.DATE), nat = R.NATURE_AVIS[c.cles.NATURE] || c.cles.NATURE || "";
    return '<div class="tdlhc-row legale" data-cat="' + esc(c.cles.NATURE) + '" data-ancre="' + esc(c.ancre) + '">'
      + '<span class="tdlhc-ref">' + esc(TXT.AVIS_REF(A.numeroAvis(c), nat, d)) + '</span>'
      + '<h5>' + esc(c.cles.TITRE) + '</h5><p>' + texteJoint(c) + '</p></div>';
  }
  async function afficherLegaux(sec, api, opts){
    if (!sec.getAttribute("data-pret")) {
      sec.innerHTML = R.chargement();
      await R.preparer(sec, function(){ return A.chargerTout(); });
      var tabs = [["*", TXT.TOUS]].concat(Object.keys(R.NATURE_AVIS).map(function(k){ return [k, R.NATURE_AVIS[k]]; }));
      sec.innerHTML = '<div class="tdlhc-plein">'
        + ariane(TXT.LEGAUX_ARIANE, '<div class="tdlhc-cpt">' + esc(TXT.LEGAUX_NOTE) + '</div>')
        + onglets(tabs) + lignes(A.contenus("avis-legal").map(htmlAvis).join(""), TXT.VIDE_LEGAUX) + '</div>';
      sec.setAttribute("data-pret", "1");
    }
    viser(sec, opts.ancre);
  }

  /* ===================== INIT ===================== */
  function demarrer(){
    var C = window.Courier; A = C.api; R = C.rendu;
    C.vue({ nom:"annonces", ordre:30, label:TXT.ANNONCES, icone:"bullhorn", couleur:"var(--gr1-color)", afficher:afficherAnnonces });
    C.vue({ nom:"civil",    ordre:40, label:TXT.CIVIL,    icone:"family",   couleur:"var(--gr5-color)", afficher:afficherCivil });
    C.vue({ nom:"legaux",   ordre:60, label:TXT.LEGAUX,   icone:"bank",     couleur:"var(--gr2-color)", afficher:afficherLegaux });
  }
  (function attendre(n){
    if (window.Courier && window.Courier.rendu) { demarrer(); return; }
    if ((n||0) < 60) setTimeout(function(){ attendre((n||0)+1); }, 250);
  })();
})();
