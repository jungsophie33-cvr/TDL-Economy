/*
 * quais-comptoir.js — Module « Le Comptoir » (boutique personnelle) · TDL · v4
 *
 * TROIS CIRCUITS, UN SEUL PIPELINE (quais-core, soumettre)
 *   STAFF  — quatorze services : paiement comptant, dette lourde envers la
 *            Main, ou petite faveur (60 $ + dette légère). Demande au staff.
 *   DIRECT — six objets du Bayou : débit définitif, objet en inventaire, dé
 *            tiré à l'achat quand l'item en porte un. Moteur : TDLObjets.
 *   PRESSE — trois articles : le texte part au bureau du Courier, qui le relit
 *            et le rembourse s'il le refuse. Moteur : TDLArticle. Le Sponsoring
 *            local en « post MJ » repasse au circuit staff.
 *   Les deux moteurs sont des ACTES du module : ils héritent des contrôles, de
 *   la confirmation, du verrou anti-double-clic et du rafraîchissement du solde.
 *
 * [MAJ v4] LA STRUCTURE VIENT DU CODE (fusion), LE CONTENU DU CATALOGUE.
 *   migre() écrivait depuis le navigateur de chaque visiteur et ne couvrait pas
 *   les propriétés qui comptent : les services de la Main n'avaient plus de
 *   cagnotte en base, et leur paiement n'arrivait jamais à Providence. Plus
 *   aucune écriture au chargement ; la cagnotte, la dette, le circuit et la
 *   cible sont dictés par le code.
 * [MAJ v4] Contexte obligatoire sur tout le circuit staff ; zones conditionnelles
 *   en attribut hidden (le socle n'en lit pas les champs) ; listes de cibles
 *   sans le compte d'administration ni le demandeur ; Rendez-vous difficile
 *   ouvert aux PJ ; plus aucune mention de badge ni de grand projet ; tutoiement.
 *
 * DÉPEND DE : window.Quais (v7-2), window.TDLObjets, window.TDLArticle.
 * À CHARGER : après quais-core, tdl-objets et tdl-article-achat.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[Quais-comptoir] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, money = Q.money, esc = ui.esc;

  /* ===================== CONFIG ===================== */
  var CFG = { CAGNOTTE_MAIN:"Providence", CREANCIER_MAIN:"La Main de la Providence", PRIX_FAVEUR:60 };

  /* ===================== TEXTES ===================== */
  var FAV       = "La version « petite faveur » (60 $) te donne ce service à moindre coût, contre une dette narrative légère, notée par le staff et rappelée au moment opportun.";
  var MAIN_AS   = "Paie comptant, ou contracte une dette lourde envers la Main : elle s\u2019inscrit dès l\u2019envoi, compte dans ta limite des trois dettes, et se règle lors d\u2019un prochain service ou selon la décision de la Main.";
  var DIRECT_AS = "Aucune validation du staff : l\u2019objet rejoint ton inventaire dès le paiement. Tu l\u2019utilises quand tu le décides, depuis le formulaire de réponse, et la déclaration apparaît dans ton message.";
  var COMM_AS   = "Ton texte part directement au bureau de rédaction du Houma Courier. Il paraîtra sous la mention « Communiqué — publié à la demande de… », signé par la rédaction. Le journal publie sans prendre parti. S\u2019il est refusé, le prix t\u2019est rendu.";
  var TRIB_AS   = "Ton texte part directement au bureau de rédaction du Houma Courier. Il paraîtra en tribune libre, signé de ton personnage, sous la mention « les opinions exprimées n\u2019engagent que leur auteur ». S\u2019il est refusé, le prix t\u2019est rendu.";

  var T = {
    S_DEMANDE:    "Ta demande",
    S_COMMANDE:   "Ta commande",
    L_CONTEXTE:   "Contexte de ta demande *",
    PH_CONTEXTE:  "Pourquoi ton personnage a besoin de ce service, dans quel contexte narratif\u2026",
    L_LIEN:       "Lien du RP concerné (facultatif)",
    L_CIBLE_TYPE: "Qui est visé ? *",
    CIBLES:       [["pnj","Un PNJ (le staff s\u2019en charge)"],["pj","Un personnage joueur"]],
    L_CIBLE_PJ:   "Personnage visé *",
    L_CIBLE_PNJ:  "Le PNJ visé *",
    PH_CIBLE_PNJ: "Qui, où, quel lien avec ton personnage\u2026",
    CHOISIR_PJ:   "— Choisir un personnage —",
    AIDE_STAFF:   "Sois précis : ça aide le staff à valider ta demande.",

    L_TITRE_EV:   "Titre de l\u2019événement *",
    PH_TITRE_EV:  "Le bal du Chêne-Vert, la foire d\u2019automne\u2026",
    AIDE_TITRE_EV:"Ce titre ouvrira ta fiche dans le sujet de gestion des événements. Tu pourras la compléter ensuite.",
    ERR_TITRE_EV: "Donne un titre à ton événement.",

    L_LIEU:       "Lieu protégé *",
    PH_LIEU:      "La maison de Bayou Dularge, l\u2019atelier sur Main Street\u2026",

    L_FORME:      "Forme de la contrepartie",
    FORMES:       [["article","Un article dans le Houma Courier"],["mj","Un post MJ dans un évent"]],
    L_CTX_EVENT:  "Contexte de l\u2019évent *",
    PH_CTX_EVENT: "L\u2019initiative que tu soutiens, et ce que tu attends du post MJ\u2026",
    L_TITRE:      "Titre de l\u2019article *",
    PH_TITRE:     "Le souper des Dames de Sainte-Anne a nourri cent quatre-vingts personnes",
    L_RUBRIQUE:   "Rubrique",
    L_DATE:       "Date de parution souhaitée",
    L_CHAPO:      "Chapô",
    PH_CHAPO:     "Deux ou trois phrases qui résument l\u2019article.",
    L_IMAGE:      "Image",
    PH_IMAGE:     "https://zupimages.net/…",
    L_RP:         "Lien du sujet RP concerné",
    PH_RP:        "https://…/t000-sujet",
    L_AFFAIRE:    "Rattacher à une affaire du journal",
    PH_AFFAIRE:   "Nom de l\u2019affaire, si l\u2019article s\u2019y rattache",
    L_TEXTE:      "Ton article *",
    PH_TEXTE:     "Écris comme un journal : les faits d\u2019abord, les noms ensuite. Une ligne vide sépare deux paragraphes.",
    AIDE_PRESSE:  "La rédaction relit avant parution et peut te renvoyer le texte pour retouche.",
    SIGNES:       function (n) { return n + " signes"; },

    C_COMPTANT:   "Payer comptant",
    C_COMPTANT_D: "Règle le montant total en dollars.",
    C_PAYER:      "Payer maintenant",
    C_DIRECT_D:   "Règle le montant en dollars : l\u2019objet rejoint ton inventaire aussitôt.",
    C_DIRECT_N:   "Achat immédiat, sans validation du staff.",
    C_PRESSE_D:   "Règle le montant en dollars : ta contrepartie part aussitôt.",
    C_PRESSE_N:   "Un article est relu par la rédaction ; un post MJ, validé par le staff.",
    C_DETTE:      "Service contre une dette",
    C_DETTE_D:    "En échange d\u2019une dette d\u2019honneur lourde envers la Main.",
    C_DETTE_P:    "0 $ + dette",
    C_DETTE_N:    "Inscrite dès l\u2019envoi, effacée si le staff refuse.",
    C_FAVEUR:     "Petite faveur",
    C_FAVEUR_D:   "À moindre coût, contre une dette narrative légère.",
    C_FAVEUR_N:   "Dette notée par le staff, rappelée au moment opportun.",
    C_CONTRACTER: "Contracter",

    CONF_DIRECT:  "L\u2019achat est immédiat et définitif : aucun staff ne le valide.",
    CONF_DE:      "Le dé est lancé à l\u2019achat.",
    CONF_ARTICLE: "Ton article part au bureau de rédaction. S\u2019il est refusé, le prix t\u2019est rendu.",

    ERR_CIBLE_PJ: "Choisis le personnage visé.",
    ERR_CIBLE_PNJ:"Décris le PNJ visé.",
    ERR_LIEU:     "Précise le lieu à protéger.",
    ERR_CTX_EVENT:"Décris le contexte de l\u2019évent.",
    ERR_CONTEXTE: "Explique le contexte de ta demande.",
    NO_ENGINE:    "Achat indisponible : le moteur des objets n\u2019est pas chargé. Préviens le staff.",
    NO_PRESSE:    "Envoi indisponible : le moteur des articles n\u2019est pas chargé. Préviens le staff.",
    DE:           function (de, lab) { return " Dé : " + de + " — " + lab + "."; },

    F_DEFAUT:     "Remettre les textes du code ?\nLes textes de la fiche seront remplacés à l\u2019enregistrement. Le nom et le prix sont conservés.",
    F_TOUS:       "Remettre les textes du code sur TOUS les items du Comptoir ?\nNoms et prix sont conservés ; tous les autres textes sont remplacés tout de suite."
  };

  /* ===================== CATALOGUE ===================== */
  var DEFAUT = {
    pres:{cat:"presages",n:"Présage",ic:"crystal-ball",p:80,desc:"Rêve, signe, intuition : une interprétation, jamais une réponse absolue.",na:"Expérience narrative",fo:"MP ou post MJ dans le sujet",us:"Unique",li:"N\u2019offre qu\u2019une interprétation, pas une réponse absolue.",rp:true},
    mp:{cat:"presages",n:"Mauvais pressentiment",ic:"danger-sign",p:150,desc:"Éviter un danger imminent dans un RP.",na:"Protection narrative",fo:"Post MJ",us:"Unique ⟡ en évent, intrigue et enquête seulement",li:"N\u2019évite ni les catastrophes ni les conséquences de tes actions irréfléchies.",rp:true},
    grigri:{cat:"presages",n:"Gri-gri",ic:"clover-alt",p:120,desc:"Amulette vaudou — ou plus folklorique selon sa source — qui t\u2019accorde un hasard favorable.",na:"Relance d\u2019un dé ou annulation d\u2019un petit échec",fo:"Amulette dans ton inventaire",us:"Unique ⟡ à déclarer dans ton post",co:"Non rétroactif : si le dé est déjà lancé sans gri-gri, pas d\u2019annulation.",direct:true,obj:"amulette",ch:1},
    lecture:{cat:"presages",n:"Lecture des signes",ic:"book-open-cover",p:200,desc:"Vision partielle offerte par les esprits du Bayou sur un objet, une personne ou une situation.",na:"Vision symbolique ⟡ indice",fo:"MP",us:"Unique ⟡ en enquête et intrigue seulement",li:"Vision cryptique : ton interprétation ne sera pas une vérité.",rp:true},
    aide:{cat:"presages",n:"Aide inattendue",ic:"dove",p:180,desc:"Les saints sont de ton côté : une situation se désamorce, un objet est retrouvé, un inconnu providentiel intervient.",na:"Coïncidence heureuse",fo:"Médaille de Saint François dans ton inventaire",us:"Unique ⟡ à déclarer dans ton post",li:"Non rétroactif. Ne résout pas un conflit, ne sauve pas des vies.",direct:true,obj:"medaille",ch:1},
    effigie:{cat:"presages",n:"Effigie rituelle",ic:"dagger",gd:true,detteAuto:"karmique",creancier:"Karma",p:200,desc:"Le mauvais sort est invoqué contre un autre personnage.",na:"Mauvais sort sur un autre PJ",fo:"Poupée vaudou déposée dans l\u2019inventaire de la cible",us:"Unique ⟡ le dé est lancé à l\u2019achat ⟡ la cible est prévenue, pas toi",li:"Ouvre une dette karmique : un retour de bâton pourrait arriver.",roll:[["1","Complication sérieuse"],["2 – 3","Complication légère"],["4","Rien"]],pick:{l:"Boutique où tu l\u2019achètes",o:["Ti bon Ange","La Croisée","Lost Bayou"]},ciblePJ:true,direct:true,obj:"poupee"},
    protection:{cat:"presages",n:"Protection des ancêtres",ic:"cross-religion",p:150,desc:"Tes ancêtres t\u2019ont à la bonne et t\u2019accordent leur protection.",na:"Protection contre une effigie ou un événement défavorable",fo:"Dollar porte-bonheur dans ton inventaire",us:"Actif dès l\u2019achat ⟡ protège une fois, quand tu le déclares",li:"Non rétroactif. Ne protège ni des catastrophes ni de tes actions irréfléchies.",direct:true,obj:"dollar",ch:1},
    benediction:{cat:"presages",n:"Bénédiction des ancêtres",ic:"church",p:500,desc:"Tes ancêtres veillent ton chemin. Ils accordent leur faveur à ton foyer ou à ton groupe : une coïncidence favorable pour tous les participants d\u2019un sujet RP.",na:"Coïncidence favorable pour tous les participants d\u2019un sujet",fo:"Bougie de neuvaine dans ton inventaire",us:"Unique ⟡ à déclarer dans un sujet ⟡ la liste des bénéficiaires est figée à cet instant",li:"Non rétroactif. Ne protège ni des catastrophes ni de la colère des bandes hors-la-loi.",direct:true,obj:"bougie",ch:1},
    purif:{cat:"presages",n:"Purification du foyer",ic:"broom",p:200,desc:"Les Loas ou le Seigneur ont béni ta maison.",na:"Protection d\u2019un lieu (habitation ou commerce)",fo:"Poudre de brique rouge répandue sur le seuil",us:"Le dé est lancé à l\u2019achat : il fixe le degré de protection, qui joue lors d\u2019un aléa climatique",li:"Aucune protection contre les actions humaines.",roll:[["1","Protection totale"],["2 – 3","Protection partielle"],["4","Protection symbolique"]],direct:true,obj:"brique",ch:1,lieuLibre:true},
    memoire:{cat:"presages",n:"Mémoire du bayou",ic:"diary-clasp",p:250,desc:"Un Ancien raconte une vieille histoire oubliée : un lieu, un secret de famille, un événement historique.",na:"Fragment d\u2019un secret du lore",fo:"MP",us:"Unique",li:"Tu ne choisis pas la nature du secret.",rp:"ctx"},

    ami:{cat:"rendre",n:"Un ami qui…",ic:"comment-user",gd:true,p:100,desc:"Un contact arrive à point nommé : une information légère, une piste, un petit coup de main.",na:"PNJ unique",fo:"Post MJ",sv:"Petite info, piste, service",li:"Usage unique. Ton contact ne se mouillera pas pour te sauver.",rp:true,dette:"faveur",as:FAV},
    ancien:{cat:"rendre",n:"Ancien service rendu",ic:"clock",gd:true,p:200,desc:"Un retour d\u2019ascenseur pour un service important.",na:"PNJ de ton passé",fo:"Post MJ — à toi de proposer le PNJ",sv:"Prêt de matériel, cachette, accès fermé, info fiable",li:"Usage unique. Rien de criminel.",rp:true,dette:"faveur",as:FAV},
    rdv:{cat:"rendre",n:"RDV difficile à obtenir",ic:"calendar-check",gd:true,p:300,desc:"Un graissage de patte pour rencontrer un notable, un élu, un responsable d\u2019ordinaire inaccessible.",na:"Accès exceptionnel à un personnage important de Terrebonne",fo:"RP avec MJ ou PJ",sv:"Rendez-vous important (négociation, service particulier…)",li:"Un rendez-vous avec un PJ suppose l\u2019accord de son joueur.",rp:"ctx",targetPJ:true,dette:"faveur",as:FAV},
    info:{cat:"rendre",n:"L\u2019info qui circule",ic:"comment-info",gd:true,p:150,desc:"Les rumeurs ont parfois un fond de vérité et débloquent des situations.",na:"Rumeur crédible révélée",fo:"MP",us:"Unique par enquête ou évent",li:"Info vraie mais incomplète.",rp:true,dette:"faveur",as:FAV},
    jetais:{cat:"rendre",n:"J\u2019étais là",ic:"binoculars",p:60,desc:"Formalise un détail dont tu as été témoin dans un RP terminé.",na:"Confirmation de témoin ⟡ inscription au lore",fo:"MP",us:"Formalise un souvenir important",co:"Évent ou intrigue terminé",rp:true},
    mainprot:{cat:"rendre",n:"Main : protection ponctuelle",ic:"crossed-hands-reject",gd:true,p:350,desc:"La Main fait comprendre à ceux qui te nuisent qu\u2019il vaut mieux laisser tomber : pression sociale ou intervention indirecte.",na:"Pression sociale ⟡ intimidation",fo:"Post MJ possible",us:"Utilisable 1 fois",li:"Pas de violence physique.",targetPJ:true,rp:"ctx",dette:"main",cagnotte:CFG.CAGNOTTE_MAIN,creancier:CFG.CREANCIER_MAIN,as:MAIN_AS},
    maindisc:{cat:"rendre",n:"Main : discrétion assurée",ic:"eye-crossed",gd:true,p:350,desc:"La Main étouffe un incident : un témoin se tait, un dossier s\u2019égare, une rumeur naissante se détourne.",na:"Incident étouffé dans l\u2019œuf",fo:"Post MJ",us:"Utilisable 1 fois",li:"N\u2019efface ni une enquête qui te concerne ni tes problèmes avec d\u2019autres bandes.",targetPJ:true,rp:"ctx",dette:"main",cagnotte:CFG.CAGNOTTE_MAIN,creancier:CFG.CREANCIER_MAIN,as:MAIN_AS},
    mainint:{cat:"rendre",n:"Main : intervention rapide",ic:"bolt",gd:true,p:350,desc:"La Main sait agir vite quand la situation est urgente mais sans gravité (non criminelle).",na:"Action urgente",fo:"Post MJ",us:"Utilisable 1 fois",li:"Gravité minime : un délit possible, jamais un crime.",rp:"ctx",dette:"main",cagnotte:CFG.CAGNOTTE_MAIN,creancier:CFG.CREANCIER_MAIN,as:MAIN_AS},

    sponl:{cat:"mondaine",n:"Sponsoring local",ic:"donate",p:400,desc:"Participer financièrement à une initiative locale visible.",na:"Renforcement de réputation",fo:"Communiqué en une du Houma Courier, ou post MJ en évent",us:"Unique ⟡ 3 000 signes minimum pour l\u2019article",ja:"Climat social",po:"Communauté",presse:true,une:true,formePick:true,as:COMM_AS},
    initiative:{cat:"mondaine",n:"Initiative régionale",ic:"confetti",p:800,desc:"Participer financièrement à une initiative de la paroisse : foire, festival, grand rendez-vous de Terrebonne. Ouvre un évent membre important.",na:"Renforcement de réputation",fo:"Évent membre",ja:"Climat social (selon l\u2019issue de l\u2019évent)",po:"Paroisse",note:"Si l\u2019évent est réussi, il fait gagner un niveau de réputation.",rp:"ctx",ctxLabel:"Contexte de l\u2019événement *",titreEv:true,evAmpleur:true},
    orga:{cat:"mondaine",n:"Organisateur",ic:"cocktail",p:300,desc:"Créer un évent membre léger et social.",na:"Renforcement de réputation",fo:"Évent membre",ef:"PNJ ou événements inattendus injectés par le staff",li:"Initiative à petite échelle, sans effet sur les jauges.",rp:"ctx",ctxLabel:"Contexte de l\u2019événement *",titreEv:true,evAmpleur:false},
    projecteur:{cat:"mondaine",n:"Coup de projecteur",ic:"broadcast-tower",p:150,desc:"Une initiative, une réussite ou un engagement mérite d\u2019être relayé au-delà de ton cercle habituel. Une telle mise en lumière peut ouvrir de nouvelles rencontres, créer des opportunités… ou des oppositions.",na:"Mise en lumière publique",fo:"Communiqué dans le Houma Courier",us:"Unique ⟡ 2 000 signes minimum",li:"L\u2019article doit rester cohérent avec les faits joués en RP. La rédaction peut demander des ajustements. La démarche ne garantit ni adhésion ni succès.",presse:true,une:false,as:COMM_AS},
    attention:{cat:"mondaine",n:"Attirer l\u2019attention",ic:"bullhorn",p:800,desc:"Prendre publiquement position, pour ou contre une initiative, une décision, une personne ou une communauté. Ton personnage signe sa tribune : tout le monde saura qui a payé pour cette place.",na:"Position publique forte",fo:"Tribune libre en une du Houma Courier",us:"Unique ⟡ 3 000 signes minimum ⟡ lien RP obligatoire",ja:"Activité clandestine",po:"Paroisse",ef:"Une prise de parole publique a des conséquences : attends-toi à des réactions.",presse:true,une:true,tribune:true,rpObligatoire:true,affaire:true,as:TRIB_AS}
  };

  var CATS = [
    { k:"presages", l:"Présages & aides aux dés", ic:"fi fi-tr-crystal-ball", c:"var(--gr4-color)" },
    { k:"rendre",   l:"Services à rendre",        ic:"fi fi-tr-comment-user", c:"var(--gr6-color)" },
    { k:"mondaine", l:"Vie mondaine",             ic:"fi fi-tr-cocktail",      c:"var(--gr1-color)" }
  ];

  /* ordre et icônes des « Informations clés » */
  var INFOS = [
    ["na","Nature","fi fi-tr-diamond"],["fo","Forme","fi fi-tr-envelope"],["us","Usage","fi fi-tr-arrows-repeat"],
    ["ef","Effet","fi fi-tr-bolt"],["sv","Service","fi fi-tr-box"],["co","Condition","fi fi-tr-clipboard-check"],
    ["li","Limite","fi fi-tr-diamond-exclamation"],["po","Portée","fi fi-tr-bullseye"],["ja","Impact jauge","fi fi-tr-dashboard"]
  ];

  /* ===================== STRUCTURE ET CONTENU ===================== */
  /* COMPORTEMENT : dicté par le code. Tout le reste (nom, prix, textes) est du
     contenu, éditable par le staff. */
  var STRUCT = ["cat","dette","detteAuto","creancier","cagnotte","gd","rp","ctxLabel","titreEv","evAmpleur","targetPJ","ciblePJ","lieuLibre",
                "roll","pick","direct","obj","ch","presse","une","tribune","rpObligatoire","affaire","formePick"];
  var TEXTUELS = ["desc","na","fo","us","ef","sv","co","li","po","ja","note","as"];
  /* restes d'anciens circuits : ignorés à la lecture, effacés au prochain enregistrement */
  var OBSOLETES = ["badge","vo","article","linkLabel"];

  function copie(o){ var r = {}; for (var k in o) if (o.hasOwnProperty(k)) r[k] = o[k]; return r; }
  /* le catalogue n'attend qu'un nom d'icône : « fi fi-sr-hand-present » → « hand-present » */
  function nomIcone(ic){ return String(ic||"").trim().replace(/^.*\bfi-(?:sr|tr|rr|br|ss|ts|rs|bs)-/, "").replace(/^fi\s+/, ""); }

  function fusion(fb){
    var out = {};
    Object.keys(fb || {}).forEach(function(id){ if (fb[id]) out[id] = copie(fb[id]); });
    Object.keys(DEFAUT).forEach(function(id){
      var def = DEFAUT[id], it = copie(def), cur = out[id] || {};
      for (var k in cur) if (cur.hasOwnProperty(k)) it[k] = cur[k];
      STRUCT.forEach(function(s){ if (def[s]!==undefined) it[s] = def[s]; else delete it[s]; });
      out[id] = it;
    });
    Object.keys(out).forEach(function(id){
      OBSOLETES.forEach(function(k){ delete out[id][k]; });
      if (out[id].ic) out[id].ic = nomIcone(out[id].ic);
    });
    return out;
  }

  /* ===================== OUTILS ===================== */
  function circuit(a){ return a.direct ? "direct" : a.presse ? "presse" : "staff"; }
  function enArticle(a, c){ return !a.formePick || (c.forme || "article")==="article"; }
  function plein(v){ return String(v==null?"":v).trim().length > 0; }
  function cibles(api){ return api.pseudos().map(function(p){ return [p,p]; }); }
  function paires(liste){ return (liste||[]).map(function(x){ return [x,x]; }); }
  function rubriques(){
    var r = window.TDLArticle && window.TDLArticle.RUBRIQUES;
    return r && r.length ? r : [["nouvelles-des-bayous","Nouvelles des bayous"]];
  }
  function plancher(a){
    var p = window.TDLArticle && window.TDLArticle.PLANCHER;
    return p ? (p[a.une ? "commande-une" : "commande"] || 0) : 0;
  }
  function aujourdhui(){ return new Date().toISOString().slice(0,10); }

  /* ===================== RENDU DE FICHE ===================== */
  function infos(a){
    var kv = "";
    INFOS.forEach(function(f){ if (a[f[0]]) kv += '<div class="qb-kf"><div><div class="qb-kl"><i class="'+f[2]+'"></i>'+esc(f[1])+'</div><div class="qb-kv">'+esc(a[f[0]])+'</div></div></div>'; });
    var aSavoir = a.as || (a.direct ? DIRECT_AS : "");
    if (aSavoir) return ui.section("Informations clés", '<div class="qb-infos"><div class="qb-kg2">'+kv+'</div><div class="qb-asbox">'+ui.lab("À savoir")+'<p>'+esc(aSavoir)+'</p></div></div>');
    return ui.section("Informations clés", '<div class="qb-kg4">'+kv+'</div>');
  }

  function blocCible(api){
    return ui.rangee(
        ui.fld(T.L_CIBLE_TYPE, ui.sel("cible_type", T.CIBLES, null, { bascule:"cible" })),
        ui.zone("cible:pj", ui.fld(T.L_CIBLE_PJ, ui.sel("cible_pj", cibles(api), T.CHOISIR_PJ)))
      )
      + ui.zone("cible:pnj", ui.fld(T.L_CIBLE_PNJ, ui.ta("cible_pnj", T.PH_CIBLE_PNJ)));
  }

  /* objets : pas de contexte, personne ne lit la demande ; seules les saisies
     que le moteur écrit */
  function commandeDirecte(a, api){
    var cellules = [];
    if (a.ciblePJ)   cellules.push(ui.fld(T.L_CIBLE_PJ, ui.sel("cible_pj", cibles(api), T.CHOISIR_PJ)));
    if (a.lieuLibre) cellules.push(ui.fld(T.L_LIEU, ui.inp("lieu", T.PH_LIEU)));
    if (a.pick)      cellules.push(ui.fld(a.pick.l, ui.sel("boutique", paires(a.pick.o))));
    return cellules.length ? ui.section(T.S_COMMANDE, ui.rangee.apply(null, cellules)) : "";
  }

  function champsArticle(a){
    return ui.fld(T.L_TITRE, ui.inp("titre", T.PH_TITRE))
      + ui.rangee(
          ui.fld(T.L_RUBRIQUE, ui.sel("rubrique", rubriques())),
          ui.fld(T.L_DATE, '<input type="date" data-champ="date" value="'+esc(aujourdhui())+'">')
        )
      + ui.fld(T.L_CHAPO, ui.ta("chapo", T.PH_CHAPO))
      + ui.rangee(
          ui.fld(T.L_IMAGE, ui.inp("image", T.PH_IMAGE)),
          ui.fld(T.L_RP + (a.rpObligatoire ? " *" : ""), ui.inp("rp", T.PH_RP))
        )
      + (a.affaire ? ui.fld(T.L_AFFAIRE, ui.inp("affaire_nom", T.PH_AFFAIRE)) : "")
      + ui.fld(T.L_TEXTE, '<textarea data-champ="texte" id="qb-texte" rows="14" placeholder="'+esc(T.PH_TEXTE)+'"></textarea>')
      + '<div class="qb-helper"><span id="qb-compte">'+esc(T.SIGNES(0))+'</span> ⟡ minimum '+plancher(a)+' ⟡ '+esc(T.AIDE_PRESSE)+'</div>';
  }

  function commandePresse(a){
    if (!a.formePick) return ui.section(T.S_COMMANDE, champsArticle(a));
    return ui.section(T.S_COMMANDE,
        ui.rangee(ui.fld(T.L_FORME, ui.sel("forme", T.FORMES, null, { bascule:"forme" })))
      + ui.zone("forme:mj", ui.fld(T.L_CTX_EVENT, ui.ta("contexte", T.PH_CTX_EVENT)))
      + ui.zone("forme:article", champsArticle(a)));
  }

  /* circuit staff : le contexte est TOUJOURS demandé */
  function commandeStaff(a, api){
    return ui.section(T.S_DEMANDE,
        (a.titreEv ? ui.fld(T.L_TITRE_EV, ui.inp("titre_ev", T.PH_TITRE_EV)) + ui.aide(T.AIDE_TITRE_EV) : "")
      + ui.fld(a.ctxLabel || T.L_CONTEXTE, ui.ta("contexte", T.PH_CONTEXTE))
      + (a.rp===true ? ui.rangee(ui.fld(T.L_LIEN, ui.inp("lien", "https://"))) : "")
      + (a.targetPJ ? blocCible(api) : "")
      + ui.aide(T.AIDE_STAFF));
  }

  function carteComptant(a, desc, note, act){
    return ui.optcard({ ic:"fi fi-tr-dollar", titre:T.C_COMPTANT, desc:desc || T.C_COMPTANT_D, prix:money(a.p),
                        btn:T.C_PAYER, act:act || "comptant", montant:a.p, pay:true, note:note });
  }
  function options(a){
    if (a.direct) return ui.options(carteComptant(a, T.C_DIRECT_D, T.C_DIRECT_N, "direct"));
    if (a.presse) return ui.options(carteComptant(a, T.C_PRESSE_D, T.C_PRESSE_N, "presse"));
    if (a.dette==="main") return ui.options(carteComptant(a),
      ui.optcard({ ic:"fi fi-tr-balance-scale-left", titre:T.C_DETTE, desc:T.C_DETTE_D, prix:T.C_DETTE_P,
                   btn:T.C_CONTRACTER, act:"dette", dette:"lourde", montant:0, note:T.C_DETTE_N }));
    if (a.dette==="faveur") return ui.options(carteComptant(a),
      ui.optcard({ ic:"fi fi-tr-balance-scale-left", titre:T.C_FAVEUR, desc:T.C_FAVEUR_D, prix:money(CFG.PRIX_FAVEUR)+" + dette",
                   btn:T.C_CONTRACTER, act:"dette", dette:"legere", montant:CFG.PRIX_FAVEUR, note:T.C_FAVEUR_N }));
    return ui.options(carteComptant(a));
  }

  function detail(id, api){
    var a = api.item(id), c = api.cat(id) || {};
    var html = '<div class="qb-dhead"><span class="qb-dic"><i class="fi fi-tr-'+esc(a.ic)+'"></i></span>'
      + '<div class="qb-dmid"><div class="qb-dname">'+esc(a.n)+'</div><div class="qb-dtag">'+esc(c.l||"")+'</div><div class="qb-ddesc">'+esc(a.desc)+'</div></div>'
      + '<div class="qb-dprice">'+ui.lab("Prix")+'<div class="qb-v">'+money(a.p)+'</div></div></div>';
    html += infos(a);
    if (a.roll) html += ui.section("Résultat au lancer de dé", '<div class="qb-rolls">'+a.roll.map(function(r){ return '<div class="qb-rollrow"><span class="qb-rolldie">'+esc(r[0])+'</span><span>'+esc(r[1])+'</span></div>'; }).join("")+'</div>');
    if (a.note) html += ui.aide(a.note);
    var k = circuit(a);
    html += k==="direct" ? commandeDirecte(a, api) : k==="presse" ? commandePresse(a) : commandeStaff(a, api);
    return html + options(a);
  }

  /* ===================== CONTRÔLES ===================== */
  function avantAchat(a, c, act){
    var k = circuit(a);
    if (k==="direct") {
      if (a.ciblePJ && !plein(c.cible_pj)) return T.ERR_CIBLE_PJ;
      if (a.lieuLibre && !plein(c.lieu)) return T.ERR_LIEU;
      return null;
    }
    if (k==="presse") {
      if (!enArticle(a, c)) return plein(c.contexte) ? null : T.ERR_CTX_EVENT;
      if (!window.TDLArticle) return T.NO_PRESSE;
      return window.TDLArticle.valider ? window.TDLArticle.valider(a, c) : null;
    }
    if (a.titreEv && !plein(c.titre_ev)) return T.ERR_TITRE_EV;
    if (!plein(c.contexte)) return T.ERR_CONTEXTE;
    if (a.targetPJ && c.cible_type==="pj" && !plein(c.cible_pj)) return T.ERR_CIBLE_PJ;
    if (a.targetPJ && c.cible_type==="pnj" && !plein(c.cible_pnj)) return T.ERR_CIBLE_PNJ;
    return null;
  }

  function confirmer(a, act, c){
    if (act==="direct") return T.CONF_DIRECT + (a.roll ? " " + T.CONF_DE : "");
    if (act==="presse" && enArticle(a, c)) return T.CONF_ARTICLE;
    return null;
  }

  /* ===================== ACTES ===================== */
  /* Le socle a contrôlé, fait confirmer, verrouillé ; il rafraîchira le solde.
     Le moteur débite lui-même, et recrédite si son écriture échoue. */
  async function acteDirect(base, c, api){
    if (!window.TDLObjets) { alert(T.NO_ENGINE); return { ok:false }; }
    var a = api.item(base.itemId);
    try {
      var r = await window.TDLObjets.acheter({ id:base.itemId, item:a, champs:c });
      return { ok:true, message: (r && r.message || "") + (r && r.deLabel ? T.DE(r.de, r.deLabel) : "") };
    } catch(e){ alert((e && e.message) || T.NO_ENGINE); return { ok:false }; }
  }

  async function actePresse(base, c, api){
    var a = api.item(base.itemId);
    /* en post MJ, rien à publier : demande ordinaire au staff */
    if (!enArticle(a, c)) return Q.achat.executer("comptant", base, c);
    if (!window.TDLArticle) { alert(T.NO_PRESSE); return { ok:false }; }
    if (a.affaire && plein(c.affaire_nom)) c.affaire = "new";
    try {
      var r = await window.TDLArticle.acheter({ id:base.itemId, item:a, champs:c });
      return { ok:true, message: r && r.message };
    } catch(e){ alert((e && e.message) || T.NO_PRESSE); return { ok:false }; }
  }

  /* ===================== FORMULAIRE STAFF ===================== */
  /* nom, prix, icône et textes : la structure ne s'édite pas, elle vient du code */
  var CHAMPS = [
    ["n","Nom"],["ic","Icône Flaticon (nom seul, ex. crystal-ball)"],["p","Prix ($)"],["na","Nature"],["fo","Forme"],
    ["us","Usage"],["ef","Effet"],["sv","Service"],["co","Condition"],["li","Limite"],
    ["po","Portée"],["ja","Impact jauge"],["note","Note"]
  ];
  function inp(champ, v){ return '<input data-champ="'+champ+'" value="'+esc(v!=null?v:"")+'">'; }
  function form(item, api, id){
    var it = item || {}, cats = api.cats(), connu = !!(id && DEFAUT[id]);
    var html = '<span class="qb-lab qb-dhl">'+(id?"Éditer un item":"Ajouter un item")+' — Le Comptoir</span>'
      + '<input type="hidden" id="qb-formid" value="'+esc(id||"")+'"><div class="qb-staffgrid">';
    html += ui.fld("Sous-catégorie", '<select data-champ="cat"'+(connu?' disabled':'')+'>'+cats.map(function(c){ return '<option value="'+c.k+'"'+(it.cat===c.k?" selected":"")+'>'+esc(c.l)+'</option>'; }).join("")+'</select>');
    CHAMPS.forEach(function(f){ html += ui.fld(f[1], inp(f[0], it[f[0]])); });
    html += '</div>';
    html += ui.fld("Description", '<textarea data-champ="desc">'+esc(it.desc||"")+'</textarea>');
    html += ui.fld("À savoir", '<textarea data-champ="as">'+esc(it.as||"")+'</textarea>');
    if (it.direct) html += ui.aide("Achat direct (objet « "+(it.obj||"?")+" ») : le circuit et le dépôt en inventaire ne s\u2019éditent pas ici.");
    if (it.presse) html += ui.aide("Article de presse ("+(it.tribune?"tribune libre":"communiqué")+(it.une?", une":"")+") : le circuit de soumission ne s\u2019édite pas ici.");
    html += '<div class="qb-opts" style="margin-top:14px"><button class="qb-optbtn qb-pay" id="qb-save" style="flex:none">Enregistrer</button>'
      + (connu ? '<button class="qb-optbtn" id="qb-defaut" style="flex:none">Textes par défaut</button>' : '')
      + '<button class="qb-optbtn" id="qb-defaut-tous" style="flex:none">Tous les textes par défaut</button>'
      + '<button class="qb-optbtn" id="qb-cancel" style="flex:none">Annuler</button></div>';
    return html;
  }

  function nettoyer(id, item){
    OBSOLETES.forEach(function(k){ delete item[k]; });
    if (DEFAUT[id]) { STRUCT.forEach(function(s){ if (s!=="cat") delete item[s]; }); item.cat = DEFAUT[id].cat; }
    return item;
  }

  function wireStaff(det, api){
    var save = det.querySelector("#qb-save"); if (!save) return false;
    var idEl = det.querySelector("#qb-formid");
    var defaut = det.querySelector("#qb-defaut");
    if (defaut) defaut.onclick = function(){
      var def = DEFAUT[idEl.value]; if (!def || !window.confirm(T.F_DEFAUT)) return;
      TEXTUELS.concat(["desc"]).forEach(function(k){ var el = det.querySelector('[data-champ="'+k+'"]'); if (el) el.value = def[k] || ""; });
    };
    var tous = det.querySelector("#qb-defaut-tous");
    if (tous) tous.onclick = function(){
      if (!window.confirm(T.F_TOUS)) return;
      var lot = {};
      Object.keys(DEFAUT).forEach(function(k){
        var cur = copie(api.item(k) || {}), def = DEFAUT[k];
        TEXTUELS.forEach(function(t){ if (def[t]!==undefined) cur[t] = def[t]; else delete cur[t]; });
        lot[k] = nettoyer(k, cur);
      });
      api.enregistrerLot(lot);
    };
    save.onclick = function(){
      var c = {};
      Array.prototype.forEach.call(det.querySelectorAll("[data-champ]"), function(el){ c[el.getAttribute("data-champ")] = el.value; });
      var id = (idEl && idEl.value) || api.nouvelId();
      var item = copie(idEl && idEl.value ? api.item(id) : {});
      if (c.cat) item.cat = c.cat;
      item.desc = c.desc || "";
      if (plein(c.as)) item.as = c.as.trim(); else delete item.as;
      CHAMPS.forEach(function(f){
        var v = (c[f[0]]||"").trim();
        if (f[0]==="p") item.p = parseInt(v,10) || 0;
        else if (f[0]==="ic") { if (v) item.ic = nomIcone(v); else delete item.ic; }
        else if (v==="") delete item[f[0]];
        else item[f[0]] = v;
      });
      api.enregistrer(id, nettoyer(id, item));
    };
    var cancel = det.querySelector("#qb-cancel"); if (cancel) cancel.onclick = function(){ api.annulerForm(); };
    return true;
  }

  /* ===================== ACCROCHES ===================== */
  function wireDetail(det, api){
    if (wireStaff(det, api)) return;
    /* compteur de signes : le plancher est dur, autant qu'il se voie */
    var ta = det.querySelector("#qb-texte"), compte = det.querySelector("#qb-compte");
    if (ta && compte) {
      var a = api.item(api.selId()) || {}, min = plancher(a);
      ta.oninput = function(){
        var n = ta.value.trim().length;
        compte.textContent = T.SIGNES(n);
        compte.className = n >= min ? "qb-msg-ok" : "";
      };
    }
  }

  /* ===================== ENREGISTREMENT ===================== */
  Q.register({
    key:"comptoir", label:"Le Comptoir", sub:"boutique personnelle", icon:"fi fi-tr-marketplace-store",
    mode:"grid", leftW:"450px", cols:2, sousChemin:"comptoir",
    cats: CATS, data: DEFAUT, fusion: fusion,
    avantAchat: avantAchat, confirmer: confirmer,
    actes: { direct: acteDirect, presse: actePresse },
    cardPrice: function(a){ return typeof a.p==="number" ? money(a.p) : (a.p||""); },
    detail: detail, form: form, wireDetail: wireDetail
  });
})();
