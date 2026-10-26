/* ============================================================
   TDL — BOTTIN DES HABITATIONS · 1/2 MODÈLE
   Namespace window.BH. À charger EN PREMIER, APRÈS eco-core (EcoCore).
   Blocs : TEXTES · CONFIG · QUARTIERS · ÉTAT · UTILS · DONNÉES · PERSISTANCE

   [MAJ v1-4] LORE AU CATALOGUE : desc, vois et image des quartiers ne
     sont plus lus ni écrits dans Firebase. Le catalogue JS ci-dessous en
     est l'unique source ; logements/quartiers ne porte que le structurel.
     Conséquence assumée : un quartier créé en admin naît sans lore —
     rare événement en jeu, elle se rédige ici.

   Occupation DÉRIVÉE, jamais dupliquée :
     · un habitant = un membre encore présent dans membres/{pseudo}
       (supprimé au recensement ⇒ disparaît du bottin) ;
     · son domicile = membres/{pseudo}.habitation s'il a déménagé,
       sinon sa demande de fiche validée (lieu_habitation/numero/type_logement) ;
     · sa communauté = membres/{pseudo}.group (nom court).
   Seul store net-new : logements/maisons/{quartier}/{numero} = {description,image}
   Config quartiers (staff) : logements/quartiers/{cle} — structurel seulement
   (nom, zone, prix, amb, com, types). Lore (desc, vois, image) : catalogue JS.

   Dépend de window.EcoCore : firebaseUpdate, getPseudo,
   ADMIN_USERS. [MAJ] à charger après eco-core*.js.
   ============================================================ */
window.BH = window.BH || {};
(function (BH) {
  "use strict";

  /* ===================== TEXTES ===================== */
  BH.TEXTES = {
    tous:"Tous", panneau:"Panneau", mur:"Mur",
    habitant:"habitant", habitants:"habitants", recensesTotal:"habitants recensés",
    voisinage:"Le voisinage :", typesTitre:"Types d'habitation dans ce quartier",
    parcelleLibre:"Parcelle libre — proposez votre numéro à l'installation.",
    brouillon:"Brouillon", murVide:"Aucun habitant recensé pour l'instant. Le mur se remplira au fil des validations.",
    jeDemenage:"Je déménage", maMaison:"Ma maison", maMaisonLead:"Réservé au premier occupant",
    creerQuartier:"+ Créer un quartier", modifierQuartier:"Modifier ce quartier",
    demenagerMembre:"Déménager un membre", enregistrer:"Enregistrer", annuler:"Annuler",
    editHint:"Édition en place — titre et prix dans l'en-tête ; tags et types via + / ✕ ; voisinage et description vivent dans le catalogue JS.",
    typeHabiteLock:"Type habité — à vider avant suppression",
    ajouterType:"+ Ajouter un type", nouveauType:"Nouveau type…", nouveauTag:"Nouveau tag…",
    supprimerType:"Supprimer ce type", supprimer:"Supprimer", ajouter:"Ajouter",
    mvTitre:"Je déménage", mvTitreStaff:"Déménager un membre",
    mvHint:"Indiquez votre nouveau quartier et le numéro de résidence.",
    mvHintStaff:"Choisissez le membre, puis son nouveau quartier et numéro.",
    mvExistante:"Résidence existante", mvNouvelle:"Nouvelle résidence", mvDepart:"À votre départ",
    mvExistTxt:(n,t,who)=>`N° ${n} — <b>${t}</b>, occupée par ${who}. Vous emménagez ici ; le type est celui de la maison.`,
    mvNouvTxt:(n,q)=>`Le N° ${n} n'existe pas encore à ${q}. Vous créez cette résidence en choisissant son type ci-dessous.`,
    mvDepartTxt:(n,q)=>`Vous êtes le dernier occupant du N° ${n} (${q}) : cette maison disparaîtra du bottin.`,
    mhApercuVide:"La description apparaîtra ici.", mhImgVide:"image",
    mhHint:(n,q)=>`N° ${n} — ${q}. Vous êtes le premier occupant : vous rédigez la fiche partagée de la maison.`,
    nouveauQuartier:"Nouveau quartier", typeParDefaut:"Habitation type",
    errEcriture:"Enregistrement échoué — réessayez.",
  };

  /* ===================== CONFIG ===================== */
  BH.CFG = {
    SEL:{ app:"tdlh-app", tabs:"tdlh-tabs", count:"tdlh-count", vue:"tdlh-vue",
      panneau:"tdlh-panneau", mur:"tdlh-mur", actionbar:"tdlh-actionbar",
      edit:"tdlh-edit", home:"tdlh-home", ovMove:"tdlh-ovMove", ovHouse:"tdlh-ovHouse" },
    HREF_ACCUEIL:"/",                              /* [MAJ] accueil du forum */
    NODE_MAISONS:"logements/maisons",
    NODE_QUARTIERS:"logements/quartiers",
    NODE_MEMBRES:"membres",
  };
  // Communauté (membres/{pseudo}.group = nom "court") → couleur --grN.
  // Dérivée de EcoCore.COMMUNAUTES : clé = id de groupe FA (3→8), couleur = --gr(id-2)
  // ⇒ group-3 Goulipiats→gr1 … group-7 Perles→gr5, group-8 Providence→gr6.
  BH.COMMU = {};
  BH.construireCOMMU = function(){
    const C = window.EcoCore && window.EcoCore.COMMUNAUTES;
    Object.keys(BH.COMMU).forEach(k=>delete BH.COMMU[k]);   // vide en place (ref conservée)
    if(!C) return;
    Object.entries(C).forEach(([id,c])=>{ const n=parseInt(id,10)-2;
      if(c && c.court && n>=1 && n<=6) BH.COMMU[c.court]={color:`var(--gr${n}-color)`}; });
  };
  BH.AGGLO = "Agglomération de Houma";
  BH.BAYOU = "Bayous de Terrebonne";

  /* ===================== QUARTIERS (catalogue éditorial) =====================
     [MAJ v1-4] LE CATALOGUE EST LA SOURCE DE LA LORE. desc, vois et image
     vivent ICI, plus dans la base : ~9,3 ko de textes figés sortis de
     logements/quartiers, qui ne garde que le structurel (nom, zone, prix,
     amb, com, types) — le seul qu'un admin a à toucher. Un nouveau quartier
     se crée sans lore ; sa description s'ajoute ici, au prochain dépôt.
     La base complète/écrase les champs structurels, jamais la lore. */
  const A = BH.AGGLO, B = BH.BAYOU;
  BH.QUARTIERS = {
    downtown:{ nom:"Downtown Houma", zone:A, prix:"$$ à $$$",
      amb:["Style victorien & colonial","Centre animé","Commerces & affaires"], com:["Petites Mains de la Providence"],
      image:"https://zupimages.net/up/26/32/san2.jpeg",
      vois:"commerçants, enseignants, ouvriers, petites classes moyennes créoles ou afro-américaines.",
      desc:"Les rues du centre-ville pulsent d’une vie foisonnante et le voisinage s’échine à prendre soin des façades des vieilles demeures victoriennes – et centenaires – qui s’affichent fièrement ou se font plus discrètes derrière de grands chênes courbés. Les vieilles familles créoles et cajuns se côtoient là depuis des générations, à l’abri des volets claqués et des ornements boisés. Les planchers grincent des décennies de cent-pas entamés, les moulures des plafonds hauts se fissurent parfois et les greniers poussiéreux cachent des secrets qu’on préfère taire. Sur les terrasses aux balustres de fer forgé, l’on préfère causer histoires de pêche ou recettes de jambalaya, parfois en français, souvent avec conviction.",
      types:["Maisons du centre historique","Cottages modestes"] },
    oldhouma:{ nom:"Old Houma", zone:A, prix:"$ à $$",
      amb:["Vétuste","Communauté vaudou","Criminalité en hausse"], com:["Spectres","Sorcières"],
      image:"https://www.schnitzel.kiwi/wp-content/uploads/2021/12/211122-094642_3200-scaled.jpg",
      vois:"ouvriers, artisans, fortes concentrations de communautés afro-américaines, familles créoles et minorités.",
      desc:"Vieux bungalows aux toits de tôle ondulée et trailers au milieu de ruines de planches et tuiles brisées hantent cette zone austère d'Houma. Si le pétrole abonde dans la région, il n'inonde pas équitablement les familles de Terrebonne, et ici le Dieu-argent n'est qu'un spectre parmi d'autres lwas. Les vieilles tempêtes y laissent des cicatrices profondes et marquent la précarité de la population, qui se contente de se loger de bric et de broc que s'entêter à reconstruire encore. De nombreuses propriétés ont été saisies par les vautours créanciers et l'on murmure que les propriétaires sur la paille ont disparu loin de la ville, avalés par les brumes du bayou.",
      types:["Bungalows insalubres","Trailers sur terrains en ruines"] },
    eastcity:{ nom:"East City", zone:A, prix:"$ à $$",
      amb:["Style cajun ancien","Multiculturel & solidaire","Familial"], com:["Fardoches","Maringouins","Sorcières"],
      image:"https://us1-photo.nextdoor.com/post_photos/e8/03/e80344291d3e158b9c7f5c04338f0c7c",
      vois:"ouvriers peu qualifiés, petits commerçants, pêcheurs, cajuns et nouveaux arrivants.",
      desc:"Quartier modeste longtemps laissé à la désuétude et aux caprices des tempêtes, les façades de bois décolorées et les pilotis bas et branlants rassemblent les communautés ouvrières de la région. Musique afro-américaine endiablée se mêle aux conversations des cajuns aux mains usées, dans les rassemblements devenus traditions de quartier. Les petites cours encombrées et les clôtures tremblantes des bungalows cachent une solidarité qu'on tente de maintenir malgré l'appel de la jeunesse vers la délinquance. La commune commence à revitaliser le quartier mais cela reste insuffisant aux yeux des habitants.",
      types:["Vieux bungalows","Maisons sur pilotis"] },
    southcity:{ nom:"South City", zone:A, prix:"$$$$ à $$$$$",
      amb:["Fastes résidences","Ambiance calme & cloisonnée","Commodités premium"], com:["Goulipiats"],
      image:"https://img.partyslate.com/companies-cover-image/27149/image-eaec36a7-060b-46f2-a2fd-b21255fed0a2.jpg?tr=w-3840",
      vois:"vieille élite locale, cadres haut-placés, chefs d'entreprises, médecins ou avocats éminents…",
      desc:"Au sud-ouest d'Houma, ce quartier huppé propose des résidences modernes et luxueuses, prêtes à défier les tempêtes. La proximité avec le centre, la possibilité d'avoir un terrain donnant directement sur Bayou Black et d'y aménager un ponton pour son bateau, et la présence des écoles les plus réputées attirent les plus aisés de la région. Demeures coloniales modernes aux colonnes imposantes, belles maisons à étages et aux vastes terrains verdoyants, imposent une patine de prestige et de calme au détriment, sans doute, d'une véritable proximité de quartier.",
      types:["Villas avec accès au bayou","Maisons modernes à étage"] },
    bayoucane:{ nom:"Bayou Cane", zone:A, prix:"$$ à $$$$",
      amb:["Banlieue résidentielle","Dynamique & loisirs","Espaces verts","Commerces"], com:["Apprentis Goulipiats","Fardoches"],
      image:"https://us1-photo.nextdoor.com/post_photos/73/2c/732c771cc2eac85b55040f4c80edce6c",
      vois:"classe moyenne, ingénieurs et techniciens des plateformes pétrolières, entrepreneurs, commerçants, soignants…",
      desc:"La banlieue dynamique au nord d'Houma s'étend le long de la LA-24 et propose à ses habitants et familles tout le confort de proximité. Les propriétés se juxtaposent dans la plus classique des banlieues américaines du sud : façades accolées de leur garage qui se répètent. On y croise cependant toute la pétillante variété de la Louisiane, et ses nombreux lotissements et sous-quartiers marquent les influences cajuns, espagnoles, africaines et plus récemment asiatiques dans les accents chantants et les odeurs qui s'échappent des barbecues l'été. Les cottages suburbains les plus anciens succèdent à des résidences plus modernes à patio arrière ou à douce fontaine, symboles d'une économie florissante... qui peut néanmoins basculer très vite.",
      types:["Cottages rénovés","Pavillons modernes","Appartements"] },
    bayoublue:{ nom:"Bayou Blue", zone:A, prix:"$$ à $$$",
      amb:["Années 70 en désuétude","Quelques commerces","Convivial"], com:["Petites Mains de la Providence"],
      image:"https://us1-photo.nextdoor.com/post_photos/06/9c/069cf37a7032676657c947de74a652f8",
      vois:"classe moyenne travailleuse, manuelle ou agricole, petits entrepreneurs, pêcheurs.",
      desc:"Une communauté plus rurale se glisse le long de Bayou Blue, restant toutefois proche des commodités de la ville. Petites maisons en bois aux porches abritant les célèbres rocking chairs, habitations donnant quelques fois sur les canaux capricieux qui débordent certaines années. On vit ici plus simplement, sans doute bercé par le rythme des saisons et un fort héritage de débrouillardise. De grands bungalows familiaux se mélangent aux maisons typiques de plein pied dans un patchwork où le bon-vivre n'est pas synonyme de richesse pécuniaire.",
      types:["Ranchs modestes","Bungalows modernes"] },
    bourg:{ nom:"Bourg", zone:B, prix:"$ à $$$",
      amb:["Village cajun","Activités artisanales & rurales"], com:["Maringouins","Ashlanders"],
      image:"https://media-production.lp-cdn.com/cdn-cgi/image/format=auto,quality=85,fit=scale-down,width=1280/https://media-production.lp-cdn.com/media/5447fd05-60d8-46b0-8ad9-f9fc8d589142",
      vois:"communauté majoritairement cajun ; fermiers et petits ranchers traditionnels, artisans.",
      desc:"Village de 2 600 âmes près de la LA-24, avec des maisons sur pilotis, principalement des bungalows modestes en bois peint ou brique rouge, aux toits en tôle ondulée. Les porches fonctionnels, ornés de chaises en osier, donnent sur la marina ou Bourg Supermarket. Quelques rues anciennes sont toujours imprégnées de vie cajun et l'on peut entendre sur les places ou les jardins, des chants en français les soirs de fête. Les ouvriers ici se mêlent aux petits propriétaires, mais on vit surtout de l'agriculture. Autour de Bourg, de nombreuses exploitations élèvent leurs bêtes près des marais, et des artisans locaux font vivre les lieux d'une assourdissante cacophonie.",
      types:["Maisons sur pilotis","Bungalows fatigués","Fermes"] },
    ashland:{ nom:"Ashland", zone:B, prix:"$ à $$",
      amb:["Pauvre","Dortoir entre-soi sudiste","Écrevisses & maïs"], com:["Ashlanders","Braconneurs","Flottille"],
      image:"https://i0.wp.com/abandonedsoutheast.com/wp-content/uploads/2019/07/48310760501_19c33d2555_k.jpg?fit=1200%2C800&ssl=1",
      vois:"pêcheurs du bayou, chasseurs, ouvriers agricoles, saisonniers.",
      desc:"Zone isolée le long du Bayou Terrebonne, avec des cabanes rustiques en bois sur pilotis, souvent vieilles, aux façades patinées par l’humidité et aux toits en tôle rouillée. Quelques trailers mobiles, en aluminium, complètent le paysage. Les cours, boueuses, abritent des cordes à linge ou des filets de pêche abandonnés. On y vit sobrement, souvent grâce à la nature, et s'il n'y a presque rien à faire à Ashland - hormis passer à côté de la prison de la Paroisse de Terrebonne -, Dieu n'oublie pas ses fidèles ouailles et les accueille chaque dimanche dans sa petite église baptiste, où résonnent des prêches d'une mentalité sudiste qu'on pensait désormais éteinte.",
      types:["Cabanes rustiques","Trailers"] },
    montegut:{ nom:"Montegut", zone:B, prix:"$ à $$",
      amb:["Lieu-dit rural","Histoire de vieilles plantations"], com:["Fardoches","Petites Mains de la Providence"],
      image:"https://us1-photo.nextdoor.com/post_photos/11/79/1179eef7b27ea7fa033d940f7680a7b1",
      vois:"agriculteurs, petits planteurs, petits commerçants.",
      desc:"Communauté de 1 500 habitants le long du Bayou Terrebonne, avec des fermes modestes et des vestiges de plantations sucrières, reconvertis en cottages ou bungalows sur pilotis. Les façades, en bois peint ou brique usée, arborent des porches ombragés sous des toits en pente douce. Parfois de vieilles histoires de maisons hantées par des esprits d'esclaves refont surface, surtout à l'Halloween. Ici, tout le monde se connait et les nouvelles têtes sont mal acceptées. Et pour cause, on se dispute pour quelques lopins de terre, un bateau, ou un vieux hangar donnant sur le bayou.",
      types:["Fermes","Plantations","Bungalows familiaux"] },
    cocodrie:{ nom:"Cocodrie", zone:B, prix:"$ à $$",
      amb:["Entre marais et mer","Bout du monde","Restaurant de crevettes"], com:["Perles","Flottille"],
      image:"https://www.adventuresnsunsets.com/wp-content/uploads/Houma-ThingstoDo-48.jpg",
      vois:"pêcheurs, ouvriers de marine, saisonniers de Port Fourchon.",
      desc:"Village côtier de 600 habitants sur la pointe sud de la LA-56, avec des camps sur pilotis, principalement des cabanes en bois aux toits en tôle ondulée, battues par les vents salins. Quelques trailers robustes, en aluminium, sont perchés sur des fondations élevées. Se succèdent des porches encombrés de filets de pêche ou au capharnaüm organisé sous les pilotis. L'eau monte régulièrement ici et même si l'on n'est pas soi-même pêcheur, il est impensable de s'installer sans avoir de quoi naviguer",
      types:["Cabanes sur hauts pilotis","Trailers"] },
    lostbayou:{ nom:"Lost Bayou", zone:B, prix:"Sur invitation",
      amb:["Village clandestin","Refuge des dépossédés","De bric et de broc"], com:["Spectres","Sorcières"],
      image:"https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/8d808678-7d80-4000-b1ff-5d8d9bfc61d5/dg0td1-e27e76dd-86a9-4dac-b044-3acf65a6365b.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi84ZDgwODY3OC03ZDgwLTQwMDAtYjFmZi01ZDhkOWJmYzYxZDUvZGcwdGQxLWUyN2U3NmRkLTg2YTktNGRhYy1iMDQ0LTNhY2Y2NWE2MzY1Yi5qcGcifV1dLCJhdWQiOlsidXJuOnNlcnZpY2U6ZmlsZS5kb3dubG9hZCJdfQ.I00edS9P3aiZloxLWTI2fKA7puBt8R5Pgi61C3lHQfI",
      vois:"familles créoles et afro-américaines, dépossédés des ouragans, semi-résidents qui font l'interface avec la ville.",
      desc:"Au cœur des marais du Mandalay National Wildlife Refuge, une douzaine de cabanes sur pilotis se relient par des passerelles de bois craquelé autour d'un péristyle à ciel ouvert, invisible depuis les berges navigables comme depuis le ciel. Bâti là où nul n'est censé habiter, Lost Bayou est né à l'automne 2021. On y échoue parce que les ouragans ont tout emporté, ou qu'ailleurs n'est plus possible. Les vendredis soir, le créole haïtien monte du péristyle au rythme des cérémonies du Baron Samedi ; le reste du temps, on guette les canaux depuis les cimes de veille, et l'on ne prononce jamais, devant un étranger, le nom de qui vit ici.",
      types:["Camps sur pilotis","Cabanes isolées"] },
  };
  BH.ORDRE = ["downtown","oldhouma","eastcity","southcity","bayoucane","bayoublue","bourg","ashland","montegut","cocodrie","lostbayou"];

  /* ===================== ÉTAT ===================== */
  BH.S = { tab:"downtown", mode:"panneau", type:null, staff:false, editing:false };
  BH._snap = null; BH._createKey = null;
  BH.monPseudo = null;                              // posé à l'init (EcoCore.getPseudo)
  BH.HABITANTS = [];                                // dérivé (voir DONNÉES)
  BH.MAISONS   = {};                                // { "quartier/numero": {description,image} }

  /* ===================== UTILS ===================== */
  BH.$    = (id) => document.getElementById(id);
  BH.escA = (s) => String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;");
  BH.escH = (s) => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  BH.initiales = (nom) => nom.split(/[\s_-]+/).map(w=>w[0]).filter(Boolean).slice(0,2).join("").toUpperCase();
  BH.versTableau = (v) => !v ? [] : (Array.isArray(v)?v:Object.values(v));
  BH.cle   = (q,n) => q+"/"+n;
  BH.cleNum= (n) => String(n).replace(/[.#$\[\]\/]/g,"_").trim();       // segment Firebase sûr
  BH.quartierParNom = (nom) => { for(const k of BH.ORDRE){ if(BH.QUARTIERS[k] && BH.QUARTIERS[k].nom===nom) return k; } return null; };

  BH.occupants   = (q,n) => BH.HABITANTS.filter(m=>m.quartier===q && m.numero===String(n)).sort((a,b)=>String(a.ordre).localeCompare(String(b.ordre)));
  BH.lead        = (q,n) => BH.occupants(q,n)[0] || null;
  BH.moi         = ()    => BH.HABITANTS.find(m=>m.pseudo===BH.monPseudo) || null;
  BH.numeros     = (q)   => [...new Set(BH.HABITANTS.filter(m=>m.quartier===q).map(m=>m.numero))].sort((a,b)=>(+a||0)-(+b||0)||String(a).localeCompare(String(b)));
  BH.numerosType = (q,t) => BH.numeros(q).filter(n=>BH.occupants(q,n)[0]?.type===t);
  BH.compteType  = (q,t) => BH.numerosType(q,t).reduce((s,n)=>s+BH.occupants(q,n).length,0);

  BH.estStaff = () => {
    try{ const u=window._userdata; if(u && (u.user_level===1||u.user_level===2)) return true; }catch(e){}
    const p = window.EcoCore?.getPseudo?.();
    return !!(p && (window.EcoCore?.ADMIN_USERS||[]).includes(p));
  };

  /* ===================== DONNÉES (lecture) ===================== */
  function ecoPret(){ return !!(window.EcoCore && typeof window.EcoCore.firebaseGet==="function"); }
  async function attendreEco(ms){ let n=0; while(!ecoPret() && n<ms/100){ await new Promise(r=>setTimeout(r,100)); n++; } return ecoPret(); }
  function normQuartier(q){ const o=Object.assign({},q); o.amb=BH.versTableau(o.amb); o.com=BH.versTableau(o.com); o.types=BH.versTableau(o.types); return o; }

     /* Avatar : meilleure carte du bottin des avatars pour un pseudo donné.
     Un même pseudo peut porter plusieurs cartes — une réservation multicompte
     posée au nom du compte racine coexiste avec la carte du personnage validé.
     On départage au lieu de laisser la dernière lue l'emporter : Firebase rend
     les clés par ordre alphabétique, ce qui n'a aucun sens ici.
     Même barème que le bottin des métiers et le registre paroissial. */
  function indexAvatars(faceclaims){
    const fc = faceclaims || {}, idx = {};
    const score = c => (c.statut==="pris" ? 4 : c.statut==="reserve" ? 1 : 0) + (c.image ? 2 : 0);
    Object.keys(fc).forEach(cle=>{
      const c = fc[cle];
      if(!c || !c.pseudo) return;
      const a = idx[c.pseudo];
      if(!a || score(c) > score(a)) idx[c.pseudo] = c;
    });
    return idx;
  }
   
  // Construit les habitants : membres présents, logés (habitation ou demande validée).
  function construireHabitants(rec, avatars){
    const membres = rec.membres || {};
    const parPseudo = {};
    BH.versTableau(rec.demandes_fiche).forEach(d=>{ if(d && d.statut==="validee") parPseudo[d.pseudo]=d; });
    const out = [];
    Object.keys(membres).forEach(pseudo=>{
      const m = membres[pseudo] || {}, d = parPseudo[pseudo];
      let src = null;
      if(m.habitation && m.habitation.quartier) src = {q:m.habitation.quartier, n:m.habitation.numero, t:m.habitation.type, o:m.habitation.depuis};
      else if(d)                                src = {q:d.lieu_habitation,      n:d.numero,           t:d.type_logement,  o:d.date};
      if(!src || !src.q || !src.n || !src.t) return;                       // non logé → absent du bottin
      const quartier = BH.QUARTIERS[src.q] ? src.q : BH.quartierParNom(src.q);   // clé OU nom d'affichage
      if(!quartier) return;
      const court = m.group || (d && d.groupe) || null;
            out.push({ pseudo, nom:pseudo, commu:court, quartier, numero:String(src.n), type:src.t,
                 ordre:src.o||pseudo,
                 avatar:(avatars[pseudo] && avatars[pseudo].image) || "" });
    });
    return out;
  }

    BH.DONNEES = {
    async chargerTout(){
      if(!await attendreEco(8000)){ if(window.console) console.warn("[TDL habitations] EcoCore introuvable."); return; }
      /* [MAJ] trois branches ciblées (~17 ko) au lieu des 189 ko de la racine.
         Ce chargement sert AUSSI au formulaire de validation de fiche
         (fiche-habitation), donc à chaque ouverture de la modale. */
      let membres, demandes, logements, faceclaims;
      try{
        [membres, demandes, logements, faceclaims] = await Promise.all([
          window.EcoCore.firebaseGet("membres"),
          window.EcoCore.firebaseGet("demandes_fiche"),
          window.EcoCore.firebaseGet("logements"),
          window.EcoCore.firebaseGet("faceclaims")
        ]);
      }
      catch(e){ if(window.console) console.error("[TDL habitations] lecture", e); return; }
      const rec = { membres: membres||{}, demandes_fiche: demandes||[], logements: logements||{} };
      // quartiers (config staff) — complète les structurels ; la lore
      // (desc/vois/image) est FORCÉE depuis le catalogue, quoi qu'il arrive.
      const qs = rec.logements.quartiers;
      if(qs && Object.keys(qs).length){
        Object.entries(qs).forEach(([k,q])=>{
          const cat = BH.QUARTIERS[k] || {};
          const lore = { desc:cat.desc||"", vois:cat.vois||"", image:cat.image||"" };
          BH.QUARTIERS[k] = normQuartier(Object.assign({}, cat, q, lore));
          if(!BH.ORDRE.includes(k)) BH.ORDRE.push(k);
        });
      }
      // maisons
      BH.MAISONS = {};
      const ms = rec.logements.maisons;
      if(ms) Object.entries(ms).forEach(([qk,byNum])=> Object.entries(byNum||{}).forEach(([nk,v])=>{ BH.MAISONS[qk+"/"+nk]=v; }));
      // habitants
      BH.HABITANTS = construireHabitants(rec, indexAvatars(faceclaims));
    },
  };

  /* ===================== PERSISTANCE (écriture PATCH) ===================== */
  function up(updates){
    if(!window.EcoCore || typeof window.EcoCore.firebaseUpdate!=="function") return Promise.resolve({memoire:true});
    return window.EcoCore.firebaseUpdate(updates);
  }
  BH.PERSISTANCE = {
    // Déménagement : surcouche habitation sur le membre + nettoyage maison quittée.
    demenager(pseudo, quartier, numero, type, quitte){
      const u = {};
      u[`${BH.CFG.NODE_MEMBRES}/${pseudo}/habitation`] = { quartier, numero, type, depuis:new Date().toISOString() };
      if(quitte) u[`${BH.CFG.NODE_MAISONS}/${quitte.q}/${BH.cleNum(quitte.n)}`] = null;
      return up(u);
    },
    // Fiche de maison (lead) : description + image (vide ⇒ suppression du nœud).
    sauverMaison(q, n, description, image){
      const path = `${BH.CFG.NODE_MAISONS}/${q}/${BH.cleNum(n)}`;
      return up({ [path]: (description||image) ? {description,image} : null });
    },
    // Quartier (staff) — structurel uniquement : la lore (desc, vois, image)
    // reste au catalogue JS et ne doit jamais retourner dans la base.
    sauverQuartier(cle, quartier){
      const q = Object.assign({}, quartier);
      delete q.desc; delete q.vois; delete q.image;
      return up({ [`${BH.CFG.NODE_QUARTIERS}/${cle}`]: q });
    },
    supprimerQuartier(cle){ return up({ [`${BH.CFG.NODE_QUARTIERS}/${cle}`]: null }); },
  };

})(window.BH);
