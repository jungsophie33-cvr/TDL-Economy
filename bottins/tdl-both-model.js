/* ============================================================
   TDL — BOTTIN DES HABITATIONS · 1/2 MODÈLE
   Namespace window.BH. À charger EN PREMIER, APRÈS eco-core (EcoCore).
   Blocs : TEXTES · CONFIG · QUARTIERS · ÉTAT · UTILS · DONNÉES · PERSISTANCE

   Occupation DÉRIVÉE, jamais dupliquée :
     · un habitant = un membre encore présent dans membres/{pseudo}
       (supprimé au recensement ⇒ disparaît du bottin) ;
     · son domicile = membres/{pseudo}.habitation s'il a déménagé,
       sinon sa demande de fiche validée (lieu_habitation/numero/type_logement) ;
     · sa communauté = membres/{pseudo}.group (nom court).
   Seul store net-new : logements/maisons/{quartier}/{numero} = {description,image}
   Config quartiers (staff) : logements/quartiers/{cle}.

   Dépend de window.EcoCore : safeReadBin, firebaseUpdate, getPseudo,
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
    editHint:"Édition en place — titre, image et prix dans l'en-tête ; tags et types via + / ✕.",
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

  /* ===================== QUARTIERS (seed éditorial) =====================
     Semé si logements/quartiers est vide. Sinon écrasé par Firebase. */
  const A = BH.AGGLO, B = BH.BAYOU;
  BH.QUARTIERS = {
    downtown:{ nom:"Downtown Houma", zone:A, prix:"$$ à $$$",
      amb:["Style victorien & colonial","Centre animé","Commerces & affaires"], com:["Petites Mains de la Providence"],
      vois:"commerçants, enseignants, ouvriers, petites classes moyennes créoles ou afro-américaines.",
      desc:"Les rues du centre-ville pulsent d'une vie foisonnante et le voisinage s'échine à prendre soin des façades des vieilles demeures victoriennes – et centenaires – qui s'affichent fièrement ou se font plus discrètes derrière de grands chênes courbés. Les vieilles familles créoles et cajuns se côtoient là depuis des générations, à l'abri des volets claqués et des ornements boisés.",
      types:["Maisons du centre historique","Cottages modestes"] },
    oldhouma:{ nom:"Old Houma", zone:A, prix:"$ à $$",
      amb:["Vétuste","Communauté vaudou","Criminalité en hausse"], com:["Spectres","Sorcières"],
      vois:"ouvriers, artisans, fortes concentrations de communautés afro-américaines, familles créoles et minorités.",
      desc:"Vieux bungalows aux toits de tôle ondulée et trailers au milieu de ruines de planches et tuiles brisées hantent cette zone austère d'Houma. Les vieilles tempêtes y laissent des cicatrices profondes et marquent la précarité de la population. De nombreuses propriétés ont été saisies par les vautours créanciers.",
      types:["Bungalows insalubres","Trailers sur terrains en ruines"] },
    eastcity:{ nom:"East City", zone:A, prix:"$ à $$",
      amb:["Style cajun ancien","Multiculturel & solidaire","Familial"], com:["Fardoches","Maringouins","Sorcières"],
      vois:"ouvriers peu qualifiés, petits commerçants, pêcheurs, cajuns et nouveaux arrivants.",
      desc:"Quartier modeste longtemps laissé à la désuétude et aux caprices des tempêtes. Les petites cours encombrées et les clôtures tremblantes des bungalows cachent une solidarité qu'on tente de maintenir malgré l'appel de la jeunesse vers la délinquance. La commune commence à revitaliser le quartier mais cela reste insuffisant aux yeux des habitants.",
      types:["Vieux bungalows","Maisons sur pilotis"] },
    southcity:{ nom:"South City", zone:A, prix:"$$$$ à $$$$$",
      amb:["Fastes résidences","Ambiance calme & cloisonnée","Commodités premium"], com:["Goulipiats"],
      vois:"vieille élite locale, cadres haut-placés, chefs d'entreprises, médecins ou avocats éminents…",
      desc:"Au sud-ouest d'Houma, ce quartier huppé propose des résidences modernes et luxueuses, prêtes à défier les tempêtes. Demeures coloniales modernes aux colonnes imposantes, belles maisons à étages et vastes terrains verdoyants imposent une patine de prestige et de calme au détriment, sans doute, d'une véritable proximité de quartier.",
      types:["Villas avec accès au bayou","Maisons modernes à étage"] },
    bayoucane:{ nom:"Bayou Cane", zone:A, prix:"$$ à $$$$",
      amb:["Banlieue résidentielle","Dynamique & loisirs","Espaces verts","Commerces"], com:["Apprentis Goulipiats","Fardoches"],
      vois:"classe moyenne, ingénieurs et techniciens des plateformes pétrolières, entrepreneurs, commerçants, soignants…",
      desc:"La banlieue dynamique au nord d'Houma s'étend le long de la LA-24. On y croise toute la pétillante variété de la Louisiane, et ses lotissements marquent les influences cajuns, espagnoles, africaines et asiatiques. Les cottages suburbains les plus anciens succèdent à des résidences plus modernes… symboles d'une économie florissante qui peut basculer très vite.",
      types:["Cottages rénovés","Pavillons modernes","Appartements"] },
    bayoublue:{ nom:"Bayou Blue", zone:A, prix:"$$ à $$$",
      amb:["Années 70 en désuétude","Quelques commerces","Convivial"], com:["Petites Mains de la Providence"],
      vois:"classe moyenne travailleuse, manuelle ou agricole, petits entrepreneurs, pêcheurs.",
      desc:"Une communauté plus rurale se glisse le long de Bayou Blue, restant proche des commodités de la ville. Petites maisons en bois aux porches abritant les célèbres rocking chairs. On vit ici plus simplement, bercé par le rythme des saisons et un fort héritage de débrouillardise.",
      types:["Ranchs modestes","Bungalows modernes"] },
    bourg:{ nom:"Bourg", zone:B, prix:"$ à $$$",
      amb:["Village cajun","Activités artisanales & rurales"], com:["Maringouins","Ashlanders"],
      vois:"communauté majoritairement cajun ; fermiers et petits ranchers traditionnels, artisans.",
      desc:"Village de 2 600 âmes près de la LA-24, avec des maisons sur pilotis, bungalows modestes en bois peint ou brique rouge. Les porches donnent sur la marina ou Bourg Supermarket. Les ouvriers se mêlent aux petits propriétaires, mais on vit surtout de l'agriculture, près des marais.",
      types:["Maisons sur pilotis","Bungalows fatigués","Fermes"] },
    ashland:{ nom:"Ashland", zone:B, prix:"$ à $$",
      amb:["Pauvre","Dortoir entre-soi sudiste","Écrevisses & maïs"], com:["Ashlanders","Braconneurs","Flottille"],
      vois:"pêcheurs du bayou, chasseurs, ouvriers agricoles, saisonniers.",
      desc:"Zone isolée le long du Bayou Terrebonne, avec des cabanes rustiques en bois sur pilotis, aux toits en tôle rouillée. On y vit sobrement, souvent grâce à la nature. Dieu n'oublie pas ses ouailles et les accueille chaque dimanche dans sa petite église baptiste.",
      types:["Cabanes rustiques","Trailers"] },
    montegut:{ nom:"Montegut", zone:B, prix:"$ à $$",
      amb:["Lieu-dit rural","Histoire de vieilles plantations"], com:["Fardoches","Petites Mains de la Providence"],
      vois:"agriculteurs, petits planteurs, petits commerçants.",
      desc:"Communauté de 1 500 habitants le long du Bayou Terrebonne, avec des fermes modestes et des vestiges de plantations sucrières reconvertis en cottages. Ici, tout le monde se connaît et les nouvelles têtes sont mal acceptées : on se dispute pour quelques lopins de terre, un bateau, ou un vieux hangar donnant sur le bayou.",
      types:["Fermes","Plantations","Bungalows familiaux"] },
    cocodrie:{ nom:"Cocodrie", zone:B, prix:"$ à $$",
      amb:["Entre marais et mer","Bout du monde","Restaurant de crevettes"], com:["Perles","Flottille"],
      vois:"pêcheurs, ouvriers de marine, saisonniers de Port Fourchon.",
      desc:"Village côtier de 600 habitants sur la pointe sud de la LA-56, avec des camps sur pilotis, cabanes en bois battues par les vents salins. L'eau monte régulièrement ici et même sans être pêcheur, il est impensable de s'installer sans avoir de quoi naviguer.",
      types:["Cabanes sur hauts pilotis","Trailers"] },
    lostbayou:{ nom:"Lost Bayou", zone:B, prix:"$ à $$", draft:true,
      amb:["Isolé","Ancrage spectre","Bout de terre oublié"], com:["Spectres"],
      vois:"à écrire — fief des Spectres.",
      desc:"[BROUILLON — à rédiger] Bras d'eau reculé où les Spectres se sont établis à l'écart d'Old Houma. Cabanes dispersées, accès difficile, forte cohésion communautaire.",
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
  function ecoPret(){ return !!(window.EcoCore && typeof window.EcoCore.safeReadBin==="function"); }
  async function attendreEco(ms){ let n=0; while(!ecoPret() && n<ms/100){ await new Promise(r=>setTimeout(r,100)); n++; } return ecoPret(); }
  function normQuartier(q){ const o=Object.assign({},q); o.amb=BH.versTableau(o.amb); o.com=BH.versTableau(o.com); o.types=BH.versTableau(o.types); return o; }

  // Construit les habitants : membres présents, logés (habitation ou demande validée).
  function construireHabitants(rec){
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
      out.push({ pseudo, nom:pseudo, commu:court, quartier, numero:String(src.n), type:src.t, ordre:src.o||pseudo });
    });
    return out;
  }

  BH.DONNEES = {
    async chargerTout(){
      if(!await attendreEco(8000)){ if(window.console) console.warn("[TDL habitations] EcoCore introuvable."); return; }
      let rec;
      try{ rec = await window.EcoCore.safeReadBin() || {}; }
      catch(e){ if(window.console) console.error("[TDL habitations] lecture", e); return; }
      // quartiers (config staff) — écrase / complète le seed
      const qs = rec.logements && rec.logements.quartiers;
      if(qs && Object.keys(qs).length){
        Object.entries(qs).forEach(([k,q])=>{ BH.QUARTIERS[k]=normQuartier(q); if(!BH.ORDRE.includes(k)) BH.ORDRE.push(k); });
      }
      // maisons
      BH.MAISONS = {};
      const ms = rec.logements && rec.logements.maisons;
      if(ms) Object.entries(ms).forEach(([qk,byNum])=> Object.entries(byNum||{}).forEach(([nk,v])=>{ BH.MAISONS[qk+"/"+nk]=v; }));
      // habitants
      BH.HABITANTS = construireHabitants(rec);
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
    // Quartier (staff).
    sauverQuartier(cle, quartier){ return up({ [`${BH.CFG.NODE_QUARTIERS}/${cle}`]: quartier }); },
    supprimerQuartier(cle){ return up({ [`${BH.CFG.NODE_QUARTIERS}/${cle}`]: null }); },
  };

})(window.BH);
