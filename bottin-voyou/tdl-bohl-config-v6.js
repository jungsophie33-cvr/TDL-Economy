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
      // emoji = clin d'oeil « humour Blackford » (Unicode, pas Flaticon). chef = porteur canon (pré-lien) tant qu'aucun joueur ne le tient.
      doigts:{
        pouce:     { nom:"Le Pouce",      emoji:"\uD83D\uDC4D", tagline:"Il appuie où ça fait mal.",              chef:"JC",                   chef_url:"" },
        index:     { nom:"L'Index",       emoji:"\u261D\uFE0F", tagline:"Il désigne les deals et les dettes.",    chef:"Emyl Desrosiers",      chef_url:"" },
        majeur:    { nom:"Le Majeur",     emoji:"\uD83D\uDD95", tagline:"Il se lève quand la diplomatie échoue.", chef:"Galaad Blackford",     chef_url:"" },
        annulaire: { nom:"L'Annulaire",   emoji:"\uD83D\uDC8D", tagline:"Il fixe les alliances et les chaînes.",  chef:"Violet",               chef_url:"" },
        auriculaire:{nom:"L'Auriculaire", emoji:"\uD83E\uDD19", tagline:"Il murmure les histoires à retenir.",    chef:"Gareth Blackford Jr.", chef_url:"" },
      },
      citation:"Les Doigts gouvernent. Les Cavaliers exécutent. La Main demeure invisible.",
      cav_texte:"Lorsque les Doigts décident, les Cavaliers agissent. Ils n'appartiennent à aucun Doigt et opèrent partout où les intérêts de la Main l'exigent — messagers, protecteurs ou exécuteurs selon les circonstances. Ce sont les seuls autorisés à franchir les frontières entre les branches.",
      reseau_texte:"Personnages liés à la Main sans en être membres — par la dette ou le sentiment d'obligation.",
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
        houngan:    { nom:"Houngan",   cat:"pretres" },
        mambo:      { nom:"Mambo",   cat:"pretres" },
        guerisseur: { nom:"Guérisseur",          cat:"guerisseurs" },
        guerisseuse:{ nom:"Guérisseuse",         cat:"guerisseurs" },
        devin:      { nom:"Devin",               cat:"guerisseurs" },
        bokor:      { nom:"Bokor",               cat:"bokors" },
        hounsi:     { nom:"Hounsi",   cat:null },
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
      // 5 navires canon. cap = capitaine (pré-lien) affiché tant qu'aucun membre ne tient la barre.
      // cap_url = lien vers le pré-lien ([MAJ] à renseigner). zones/spec/image surchargeables (staff ou capitaine).
      navires:{
        marguerite:{ nom:"La Sainte Marguerite", spec:"Transit longue distance", equipage:true,  cap:"Dédé Chiasson",        cap_url:"", zones:["Golfe du Mexique","NOLA","Côte texane"] },
        grosbleu:  { nom:"Le Gros Bleu",         spec:"Extraction d'urgence",    equipage:true,  cap:"Roxanne « Rox » Hébert", cap_url:"", zones:["Réseau fluvial","Morgan City","Baton Rouge"] },
        inattendue:{ nom:"L'Inattendue",         spec:"Liaisons des bayous",     equipage:false, independant:true, cap:"Alcée Theriot", cap_url:"", zones:["Lost Bayou","Ashlanders","Maringouins"] },
        tetu:      { nom:"Le Têtu",              spec:"Logistique en volume",    equipage:true,  cap:"Rosario Galvez",       cap_url:"", zones:["Canaux principaux"] },
        tisserande:{ nom:"La Tisserande",        spec:"Extraction de personnes", equipage:true,  cap:"",                     cap_url:"", zones:["Terrebonne","Paroisses voisines"] },
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
