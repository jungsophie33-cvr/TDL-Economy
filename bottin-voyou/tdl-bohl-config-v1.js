/* ============================================================
   TDL — BANDES HORS-LA-LOI · CONFIG PARTAGÉE (tdl-bohl-config.js)
   Source UNIQUE de la structure fixe des 6 bandes. Lue par le bottin
   (tdl-bohl-*) ET, à terme, par le formulaire de validation de fiche.
   À charger EN PREMIER. Valeurs = canon des lore.

   Ce fichier ne décrit QUE la structure fixe (config). Le placement d'un
   personnage vit sur membres/{pseudo}.hors_la_loi, écrit par le bottin
   (outils staff) et, plus tard, par affecterBande à la validation.
   ============================================================ */
window.BHL_CONFIG = (function () {
  "use strict";

  var BANDES = {

    /* ---------- LA MAIN DE LA PROVIDENCE ---------- */
    main: {
      nom:"La Main de la Providence", devise:"Discrétion · Influence · Contrôle",
      // types joueur (la position « La Main / le Chef » se pose en staff, hors liste)
      types:{ cavalier:"Cavalier", doigt:"Doigt", reseau:"Réseau d'influence" },
      // 5 Doigts — porteurs & domaines CANON (Blackford_Dossier_Secret §5.2)
      doigts:{
        pouce:     { nom:"Le Pouce",      domaine:"Espionnage & renseignement",  tagline:"Le doigt qui donne son accord." },
        index:     { nom:"L'Index",       domaine:"Diplomatie & intimidation",   tagline:"Le doigt qui montre la cible." },
        majeur:    { nom:"Le Majeur",     domaine:"Protection & représailles",   tagline:"Le doigt qu'on lève quand la diplomatie ne suffit plus." },
        annulaire: { nom:"L'Annulaire",   domaine:"Finances & blanchiment",      tagline:"Le doigt qui scelle les serments." },
        auriculaire:{nom:"L'Auriculaire", domaine:"Couverture & presse",         tagline:"Le doigt dont personne ne se méfie." },
      },
      ordre_doigts:["pouce","index","majeur","annulaire","auriculaire"],
      reseau_cat:{ entreprises:"Entreprises & Commerçants", autorites:"Autorités corrompues",
                   prestataires:"Prestataires & Services", informateurs:"Informateurs locaux" },
      // statut dette/service posé par le staff (hors formulaire) — [MAJ] aligner sur le système de dettes
      statuts:{ du:"Service dû", prioritaire:"Dette prioritaire", longue:"Dette longue" },
    },

    /* ---------- LES MARINGOUINS ---------- */
    maringouins: {
      nom:"Les Maringouins", devise:"Débrouillards · Solidaires · Indépendants",
      // cellules : éditables en staff (ajout/retrait de zones = tags) ; nouvelles cellules en brouillon
      cellules:{
        salespattes:{ nom:"Les Sales Pattes", zones:["Houma & périphérie","Bayou Cane","Bayou Blue"], devise:"On agit vite avant qu'il soit trop tard." },
        cypresmorts:{ nom:"Les Cyprès Morts", zones:["Dulac","Cocodrie","Pointe-aux-Chênes"],          devise:"On ne nous voit jamais." },
        rouilles:   { nom:"Les Rouilles",     zones:["Ashland","Bourg","Montegut & environs"],          devise:"On observe longtemps." },
      },
    },

    /* ---------- LES BRACONNEURS ---------- */
    braconneurs: {
      nom:"Les Braconneurs", devise:"Discrets · Expérimentés · Indispensables",
      // 4 spécialités — libellés CANON (lore Braconneurs)
      specialites:{
        trappeurs:   { nom:"Les Trappeurs de fond", desc:"Mammifères & fourrures" },
        reptiliens:  { nom:"Les Reptiliens",        desc:"Serpents, alligators, tortues" },
        preparateurs:{ nom:"Les Préparateurs",      desc:"Traitement, tannage, extraction" },
        vivandiers:  { nom:"Les Vivandiers",        desc:"Transport & animaux vivants" },
      },
    },

    /* ---------- LES FAISEUSES D'ANGES ---------- */
    faiseuses: {
      nom:"Les Faiseuses d'Anges", devise:"Bienveillantes · Discrètes · Indispensables",
      categories:{ medicale:"Intervention médicale", psycho:"Soutien psychologique" },
    },

    /* ---------- LES SORCIÈRES DU BARON ---------- */
    sorcieres: {
      nom:"Les Sorcières du Baron", devise:"Anciens chemins · Savoirs vivants",
      // rôle rituel → catégorie de bandeau dérivée (cat)
      roles:{
        houngan:    { nom:"Prêtre (Houngan)",   cat:"pretres" },
        mambo:      { nom:"Prêtresse (Mambo)",   cat:"pretres" },
        guerisseur: { nom:"Guérisseur",          cat:"guerisseurs" },
        guerisseuse:{ nom:"Guérisseuse",         cat:"guerisseurs" },
        devin:      { nom:"Devin",               cat:"guerisseurs" },
        bokor:      { nom:"Bokor",               cat:"bokors" },
        hounsi:     { nom:"Hounsi (initié·e)",   cat:null },     // [MAJ] pas de compteur dédié
      },
      categories:{ pretres:"Prêtres & Prêtresses", guerisseurs:"Guérisseurs & Devins", bokors:"Bokors" },
      lieux:["Lost Bayou","Houma","La Croisée","Autre"],           // « Officiant à »
    },

    /* ---------- LA FLOTTILLE ---------- */
    flottille: {
      nom:"La Flottille", devise:"Sur l'eau · Libres · Solidaires",
      types:{ equipage:"Équipage d'un navire", independant:"Navire indépendant", contact:"Contact à quai" },
      // 5 navires canon : 4 à équipage + L'Inattendue (seul indépendant prédéfini)
      navires:{
        marguerite:{ nom:"La Sainte Marguerite", spec:"Transit longue distance", equipage:true },
        grosbleu:  { nom:"Le Gros Bleu",         spec:"Extraction d'urgence",    equipage:true },
        tetu:      { nom:"Le Têtu",              spec:"Logistique en volume",    equipage:true },
        tisserande:{ nom:"La Tisserande",        spec:"Extraction de personnes", equipage:true },
        inattendue:{ nom:"L'Inattendue",         spec:"Liaisons des bayous",     equipage:false, independant:true },
      },
    },

  };

  return {
    ordre:["main","maringouins","braconneurs","faiseuses","sorcieres","flottille"],
    bandes:BANDES,
    // helper commun : liste [valeur,label] d'un sous-ensemble, pour formulaire et bottin
    liste:function (chemin) {              // ex. liste("faiseuses.categories")
      var p = chemin.split("."), o = BANDES;
      for (var i=0;i<p.length;i++){ o = o && o[p[i]]; }
      if (!o) return [];
      return Object.keys(o).map(function (k){ return [k, (o[k] && o[k].nom) || o[k]]; });
    },
  };
})();
