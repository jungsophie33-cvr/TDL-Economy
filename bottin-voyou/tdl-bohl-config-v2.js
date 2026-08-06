/* ============================================================
   TDL — BANDES HORS-LA-LOI · CONFIG PARTAGÉE (tdl-bohl-config.js)
   Source UNIQUE de la structure fixe des 6 bandes. Lue par le bottin
   (tdl-bohl-*) ET, à terme, par le formulaire de validation de fiche.
   À charger EN PREMIER. Valeurs = canon des lore.

   Deux natures de contenu :
     · structure fixe (doigts, cellules, spécialités, navires…) — non éditable ;
     · contenu de présentation par bande : motscles (tags) + desc + image —
       valeurs par défaut ici, surchargeables en staff (nœud bandes/{bande}).
   Le placement d'un personnage vit sur membres/{pseudo}.hors_la_loi.
   ============================================================ */
window.BHL_CONFIG = (function () {
  "use strict";

  var BANDES = {

    /* ---------- LA MAIN DE LA PROVIDENCE ---------- */
    main: {
      nom:"La Main de la Providence",
      motscles:["Discrétion","Influence","Contrôle"],
      desc:"Organisation criminelle structurée opérant à Terrebonne et au-delà. Ses cinq Doigts étendent leur emprise sur le territoire, tandis que les Cavaliers exécutent les missions les plus sensibles et veillent à la loyauté envers le Chef.",
      image:"",
      types:{ cavalier:"Cavalier", doigt:"Doigt", reseau:"Réseau d'influence" },
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
      statuts:{ du:"Service dû", prioritaire:"Dette prioritaire", longue:"Dette longue" },
    },

    /* ---------- LES MARINGOUINS ---------- */
    maringouins: {
      nom:"Les Maringouins",
      motscles:["Débrouillards","Solidaires","Indépendants"],
      desc:"Les Maringouins ne cherchent ni pouvoir ni richesse. Ils défendent le Bayou, leurs gens et leur liberté. Clandestins et imprévisibles, ils agissent dans l'ombre là où d'autres ferment les yeux.",
      image:"",
      cellules:{
        salespattes:{ nom:"Les Sales Pattes", zones:["Houma & périphérie","Bayou Cane","Bayou Blue"], devise:"On agit vite avant qu'il soit trop tard." },
        cypresmorts:{ nom:"Les Cyprès Morts", zones:["Dulac","Cocodrie","Pointe-aux-Chênes"],          devise:"On ne nous voit jamais." },
        rouilles:   { nom:"Les Rouilles",     zones:["Ashland","Bourg","Montegut & environs"],          devise:"On observe longtemps." },
      },
    },

    /* ---------- LES BRACONNEURS ---------- */
    braconneurs: {
      nom:"Les Braconneurs",
      motscles:["Discrets","Expérimentés","Indispensables"],
      desc:"Les Braconneurs ne chassent pas pour le sport. Ils vivent d'un savoir que la loi préfère ignorer. Leurs spécialités se transmettent de bouche à oreille, loin des regards et des promesses.",
      image:"",
      specialites:{
        trappeurs:   { nom:"Les Trappeurs de fond", desc:"Mammifères & fourrures" },
        reptiliens:  { nom:"Les Reptiliens",        desc:"Serpents, alligators, tortues" },
        preparateurs:{ nom:"Les Préparateurs",      desc:"Traitement, tannage, extraction" },
        vivandiers:  { nom:"Les Vivandiers",        desc:"Transport & animaux vivants" },
      },
    },

    /* ---------- LES FAISEUSES D'ANGES ---------- */
    faiseuses: {
      nom:"Les Faiseuses d'Anges",
      motscles:["Bienveillantes","Discrètes","Indispensables"],
      desc:"Elles soignent, elles écoutent, elles accompagnent. Dans l'ombre, ils pansent les corps, recousent les âmes et offrent une issue là où d'autres n'en voient plus. Aucun ne pose de questions. Tous méritent confiance.",
      image:"",
      categories:{ medicale:"Intervention médicale", psycho:"Soutien psychologique" },
    },

    /* ---------- LES SORCIÈRES DU BARON ---------- */
    sorcieres: {
      nom:"Les Sorcières du Baron",
      motscles:["Anciens chemins","Savoirs vivants"],
      desc:"Certains les appellent sorcières. Eux parlent simplement de ceux qui connaissent encore les anciens chemins. Entre le bayou et la ville, ils veillent, guérissent, préservent. Et se souviennent.",
      image:"",
      roles:{
        houngan:    { nom:"Prêtre (Houngan)",   cat:"pretres" },
        mambo:      { nom:"Prêtresse (Mambo)",   cat:"pretres" },
        guerisseur: { nom:"Guérisseur",          cat:"guerisseurs" },
        guerisseuse:{ nom:"Guérisseuse",         cat:"guerisseurs" },
        devin:      { nom:"Devin",               cat:"guerisseurs" },
        bokor:      { nom:"Bokor",               cat:"bokors" },
        hounsi:     { nom:"Hounsi (initié·e)",   cat:null },
      },
      categories:{ pretres:"Prêtres & Prêtresses", guerisseurs:"Guérisseurs & Devins", bokors:"Bokors" },
      lieux:["Lost Bayou","Houma","La Croisée","Autre"],
    },

    /* ---------- LA FLOTTILLE ---------- */
    flottille: {
      nom:"La Flottille",
      motscles:["Sur l'eau","Libres","Solidaires"],
      desc:"Ils ne naviguent pas tous sous le même pavillon. Mais lorsqu'un bateau appelle à l'aide, il y a toujours quelqu'un pour répondre. Pêcheurs, bateliers, guides, réparateurs. Indépendants mais unis par le Bayou et les siens.",
      image:"",
      types:{ equipage:"Équipage d'un navire", independant:"Navire indépendant", contact:"Contact à quai" },
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
    liste:function (chemin) {
      var p = chemin.split("."), o = BANDES;
      for (var i=0;i<p.length;i++){ o = o && o[p[i]]; }
      if (!o) return [];
      return Object.keys(o).map(function (k){ return [k, (o[k] && o[k].nom) || o[k]]; });
    },
  };
})();
