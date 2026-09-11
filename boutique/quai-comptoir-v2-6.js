/*
 * quais-comptoir.js — Module « Le Comptoir » (boutique personnelle) · TDL
 *
 * Enregistre le module auprès de window.Quais (quais-core). Fournit :
 *   - le catalogue PAR DÉFAUT (semé dans Firebase au premier chargement) ;
 *   - le rendu de fiche (en-tête + Informations clés + « Passer commande » + options) ;
 *   - le formulaire staff éditant TOUT le contenu de l'item, prix compris.
 * Achats délégués au moteur du core (comptant / dette lourde / petite faveur).
 *
 * ICÔNES : chaque item porte un NOM DE BASE Flaticon (item.ic, ex. "crystal-ball").
 *   La carte de gauche l'affiche en solide (fi-sr-…), la fiche de droite en thin (fi-tr-…).
 *   Catégories, informations clés et cartes d'option utilisent des classes fi-tr complètes.
 *
 * DÉPEND DE : window.Quais (register, ui, enregistrer, annulerForm, nouvelId).
 * À CHARGER : après quais-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[Quais-comptoir] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, money = Q.money, esc = ui.esc;

  /* ===================== CATALOGUE PAR DÉFAUT ===================== */
  var FAV  = "La version « petite faveur » (60 $) permet d'obtenir ce service à moindre coût, contre une dette narrative légère, notée par le staff et rappelée au moment opportun.";
  var MAINAS = "Payer comptant débloque le badge « Service demandé ». Contracter la dette lourde débloque « Rien n'est gratuit » — elle se règle lors d'un prochain service, ou selon la décision de la Main.";

  var DEFAUT = {
    pres:{cat:"presages",n:"Présage",ic:"crystal-ball",p:80,desc:"Rêve, signe, intuition : une interprétation, jamais une réponse absolue.",na:"Expérience narrative",fo:"MP ou post MJ dans le sujet",us:"Unique",li:"N'offre qu'une interprétation, pas une réponse absolue.",rp:true},
    mp:{cat:"presages",n:"Mauvais pressentiment",ic:"danger-sign",p:150,desc:"Éviter un danger imminent dans un RP.",na:"Protection narrative",fo:"Post MJ",us:"Unique ⟡ en évent, intrigue et enquête seulement",li:"N'évite ni les catastrophes ni les conséquences de vos actions irréfléchies.",rp:true},
    grigri:{cat:"presages",n:"Gri-gri",ic:"clover-alt",p:120,desc:"Amulette vaudou — ou plus folklorique selon sa source — qui vous accorde un hasard favorable.",na:"Relance d'un dé ou annulation d'un petit échec",fo:"Amulette dans l'inventaire",us:"Unique ⟡ à annoncer dans le post + tag admin",co:"Non rétroactif : si le dé est déjà lancé sans gri-gri, pas d'annulation.",rp:false},
    lecture:{cat:"presages",n:"Lecture des signes",ic:"book-open-cover",p:200,desc:"Vision partielle offerte par les esprits du Bayou sur un objet, une personne ou une situation.",na:"Vision symbolique ⟡ indice",fo:"MP",us:"Unique ⟡ en enquête et intrigue seulement",li:"Vision cryptique : votre interprétation ne sera pas une vérité.",rp:true},
    aide:{cat:"presages",n:"Aide inattendue",ic:"dove",p:180,desc:"Les saints sont de votre côté : une situation se désamorce, un objet est retrouvé, un inconnu providentiel intervient.",na:"Coïncidence heureuse",fo:"Médaille de St François dans l'inventaire",us:"Unique ⟡ à annoncer dans le post + tag admin",li:"Non rétroactif. Ne résout pas un conflit, ne sauve pas des vies.",rp:false},
    effigie:{cat:"presages",n:"Effigie rituelle",ic:"dagger",gd:true,detteAuto:"karmique",creancier:"Karma",p:200,desc:"Le mauvais sort est invoqué contre un autre PJ.",na:"Mauvais sort sur un autre PJ",fo:"Poupée vaudou dans l'inventaire",us:"Unique ⟡ sur tirage de dé + tag admin + tag du PJ visé",li:"Ouvre une dette karmique : un retour de bâton pourrait arriver. Notée par le staff.",roll:[["1","Complication sérieuse"],["2 – 3","Complication légère"],["4","Rien"]],pick:{l:"Choix de la boutique",o:["Ti bon Ange","La Croisée","Lost Bayou"]},targetPJ:true,rp:false},
    protection:{cat:"presages",n:"Protection des ancêtres",ic:"cross-religion",p:150,desc:"Vos ancêtres vous ont à la bonne et vous accordent leur protection.",na:"Protection contre une effigie ou un événement défavorable",fo:"Dollar porte-bonheur dans l'inventaire",us:"Actif dès l'achat ⟡ protège une fois, sur demande + tag admin",li:"Non rétroactif. Ne protège pas des catastrophes ni de vos actions irréfléchies.",rp:false},
    benediction:{cat:"presages",n:"Bénédiction des ancêtres",ic:"church",p:500,desc:"La version supérieure : trois protections accordées par vos ancêtres.",na:"Protection contre tout événement négatif ou mauvais sort",fo:"Objet dans l'inventaire (à déterminer)",us:"Actif dès l'achat ⟡ 3 protections sur demande + tag admin",li:"Non rétroactif. Ne protège pas des catastrophes ni de la colère des bandes hors-la-loi.",rp:false},
    purif:{cat:"presages",n:"Purification du foyer",ic:"broom",p:200,desc:"Les Loas ou le Seigneur ont béni votre maison.",na:"Protection de lieu (habitation ou commerce)",fo:"Objet dans l'inventaire",us:"S'active par lancer de dé lors d'un aléa climatique",li:"Aucune protection contre les actions humaines.",roll:[["1","Protection totale"],["2 – 3","Protection partielle"],["4","Protection symbolique"]],rp:false},
    memoire:{cat:"presages",n:"Mémoire du bayou",ic:"diary-clasp",p:250,desc:"Un Ancien raconte une vieille histoire oubliée : un lieu, un secret de famille, un événement historique.",na:"Fragment d'un secret du lore",fo:"MP",us:"Unique",li:"Vous ne choisissez pas la nature du secret.",rp:"ctx"},

    ami:{cat:"rendre",n:"Un ami qui…",ic:"comment-user",gd:true,p:100,desc:"Un contact arrive à point nommé : une information légère, une piste, un petit coup de main.",na:"PNJ one-shot",fo:"Post MJ",sv:"Petite info, piste, service",li:"Usage unique. Votre contact ne se mouillera pas pour vous sauver.",rp:true,dette:"faveur",as:FAV},
    ancien:{cat:"rendre",n:"Ancien service rendu",ic:"clock",gd:true,p:200,desc:"Un retour d'ascenseur pour un service premium.",na:"PNJ de votre passé",fo:"Post MJ — à vous de proposer le PNJ",sv:"Prêt de matériel, cachette, accès fermé, info fiable",li:"Usage unique. Rien de criminel.",rp:true,dette:"faveur",as:FAV},
    rdv:{cat:"rendre",n:"RDV difficile à obtenir",ic:"calendar-check",gd:true,p:300,desc:"Un graissage de patte pour rencontrer un notable, un élu, un responsable d'ordinaire inaccessible.",na:"Accès exceptionnel à un personnage important de Terrebonne",fo:"RP avec MJ ou PJ",sv:"Rendez-vous important (négociation, service particulier…)",li:"Accord du joueur nécessaire pour un RDV avec un PJ.",pick:{l:"Cible du rendez-vous",o:["— PNJ (staff) —","— Choisir un PJ dans la liste —"]},rp:"ctx",dette:"faveur",as:FAV},
    info:{cat:"rendre",n:"L'info qui circule",ic:"comment-info",gd:true,p:150,desc:"Les rumeurs ont parfois un fond de vérité et débloquent des situations.",na:"Rumeur crédible révélée",fo:"MP",us:"Unique par enquête ou évent",li:"Info vraie mais incomplète.",rp:true,dette:"faveur",as:FAV},
    jetais:{cat:"rendre",n:"J'étais là",ic:"binoculars",p:60,desc:"Formalise un détail dont vous avez été témoin dans un RP terminé.",na:"Confirmation de témoin ⟡ inscription au lore",fo:"MP",us:"Formalise un souvenir important",co:"Évent ou intrigue terminé",rp:true},
    mainprot:{cat:"rendre",n:"Main : protection ponctuelle",ic:"crossed-hands-reject",gd:true,p:350,desc:"La Main fait comprendre à ceux qui vous nuisent qu'il vaut mieux laisser tomber : pression sociale ou intervention indirecte.",na:"Pression sociale ⟡ intimidation",fo:"Post MJ possible",us:"Utilisable 1 fois",li:"Pas de violence physique.",badge:"Porte entrouverte",targetPJ:true,rp:"ctx",dette:"main",cagnotte:"Providence",creancier:"La Main de la Providence",as:MAINAS},
    maindisc:{cat:"rendre",n:"Main : discrétion assurée",ic:"eye-crossed",gd:true,p:350,desc:"La Main étouffe un incident : un témoin se tait, un dossier s'égare, une rumeur naissante se détourne.",na:"Incident étouffé dans l'œuf",fo:"Post MJ",us:"Utilisable 1 fois",li:"N'efface pas une enquête vous concernant ni vos problèmes avec d'autres bandes.",badge:"Porte entrouverte",targetPJ:true,rp:"ctx",dette:"main",cagnotte:"Providence",creancier:"La Main de la Providence",as:MAINAS},
    mainint:{cat:"rendre",n:"Main : intervention rapide",ic:"bolt",gd:true,p:350,desc:"La Main sait agir vite quand la situation est urgente mais sans gravité (non criminelle).",na:"Action urgente",fo:"Post MJ",us:"Utilisable 1 fois",li:"Gravité minime : un délit possible, jamais un crime.",badge:"Porte entrouverte",rp:"ctx",dette:"main",cagnotte:"Providence",creancier:"La Main de la Providence",as:MAINAS},

    sponl:{cat:"mondaine",n:"Sponsoring local",ic:"donate",p:400,desc:"Participer financièrement à une initiative locale visible.",na:"Renforcement de réputation",fo:"Article dans le journal / post MJ",ja:"Climat social",po:"Communauté",rp:"ctx"},
    initiative:{cat:"mondaine",n:"Initiative régionale",ic:"confetti",p:800,desc:"Participer financièrement à une initiative de la paroisse : foire, festival, grand projet de Terrebonne. Ouvre un évent membre important.",na:"Renforcement de réputation",fo:"Évent membre",ja:"Climat social (selon l'issue de l'évent)",po:"Paroisse",note:"Si l'évent est réussi, fait gagner un niveau de réputation.",rp:"ctx",ctxLabel:"Contexte de l'événement"},
    orga:{cat:"mondaine",n:"Organisateur",ic:"cocktail",p:300,desc:"Créateur d'un évent membre léger et social.",na:"Renforcement de réputation",fo:"Évent membre",ef:"PNJ ou événements inattendus injectés par le staff",li:"Initiative à petite échelle, pas d'impact sur les jauges.",rp:"ctx",ctxLabel:"Contexte de l'événement"},
    projecteur:{cat:"mondaine",n:"Coup de projecteur",ic:"broadcast-tower",p:150,desc:"Une initiative, une réussite ou un engagement mérite d'être relayé au-delà de votre cercle habituel. Une telle mise en lumière peut ouvrir de nouvelles rencontres, créer des opportunités… ou des oppositions.",na:"Mise en lumière publique",fo:"Article de presse rédigé par l'acheteur",us:"Unique",li:"L'article doit rester cohérent avec les faits joués en RP. Le staff peut demander des ajustements avant publication. La démarche ne garantit ni adhésion ni succès.",as:"Rédigez un article de presse racontant l'événement. Après validation du staff, il sera publié dans le Journal et deviendra une information officielle de la vie locale.",rp:"ctxlink",article:true,linkLabel:"Lien (RP, événement créé, publication Insta)"},
    attention:{cat:"mondaine",n:"Attirer l'attention",ic:"bullhorn",p:800,desc:"Aide individuelle / contrer un projet communautaire de votre choix (d'une communauté différente de la vôtre).",na:"Position publique forte",fo:"Article journal",ja:"Activité clandestine",po:"Paroisse",ef:"Peut contribuer aux objectifs d'étape d'un grand projet, ou lui mettre des bâtons dans les roues. Attention aux problèmes qui en découleront…",pick:{l:"Projet communautaire visé",o:["— Sélectionner un projet —"]},rp:"ctxlink",linkLabel:"Lien d'un RP terminé (obligatoire)"}
  };

  var CATS = [
    { k:"presages", l:"Présages & aides aux dés", ic:"fi fi-tr-crystal-ball", c:"var(--gr4-color)" },
    { k:"rendre",   l:"Services à rendre",        ic:"fi fi-tr-comment-user", c:"var(--gr6-color)" },
    { k:"mondaine", l:"Vie mondaine",             ic:"fi fi-tr-cocktail",      c:"var(--gr1-color)" }
  ];

  /* ordre + icônes (classes fi-tr complètes) des « Informations clés » */
  var INFOS = [
    ["na","Nature","fi fi-tr-diamond"],["fo","Forme","fi fi-tr-envelope"],["us","Usage","fi fi-tr-arrows-repeat"],
    ["ef","Effet","fi fi-tr-bolt"],["sv","Service","fi fi-tr-box"],["co","Condition","fi fi-tr-clipboard-check"],
    ["li","Limite","fi fi-tr-diamond-exclamation"],["po","Portée","fi fi-tr-bullseye"],["ja","Impact jauge","fi fi-tr-dashboard"],
    ["badge","Badge requis","fi fi-tr-badge"]
  ];

  /* ===================== RENDU DE FICHE ===================== */
  function detail(id, api){
    var a = api.item(id), c = api.cat(id) || {};
    var html = '<div class="qb-dhead"><span class="qb-dic"><i class="fi fi-tr-'+esc(a.ic)+'"></i></span>'
      + '<div class="qb-dmid"><div class="qb-dname">'+esc(a.n)+'</div><div class="qb-dtag">'+esc(c.l||"")+'</div><div class="qb-ddesc">'+esc(a.desc)+'</div></div>'
      + '<div class="qb-dprice">'+ui.lab("Prix")+'<div class="qb-v">'+money(a.p)+'</div></div></div><div class="qb-rule"></div>';

    var kv = "";
    INFOS.forEach(function(f){ if (a[f[0]]) kv += '<div class="qb-kf"><i class="'+f[2]+'"></i><div><div class="qb-kl">'+esc(f[1])+'</div><div class="qb-kv">'+esc(a[f[0]])+'</div></div></div>'; });
    html += '<div class="qb-sec">'+ui.lab("Informations clés");
    if (a.as) html += '<div class="qb-infos"><div class="qb-kg2">'+kv+'</div><div class="qb-asbox">'+ui.lab("À savoir")+'<p>'+esc(a.as)+'</p></div></div>';
    else html += '<div class="qb-kg4">'+kv+'</div>';
    html += '</div>';

    if (a.roll) html += '<div class="qb-sec">'+ui.lab("Résultat au lancer de dé")+'<div class="qb-rolls">'+a.roll.map(function(r){ return '<div class="qb-rollrow"><span class="qb-rolldie">'+esc(r[0])+'</span><span>'+esc(r[1])+'</span></div>'; }).join("")+'</div></div>';
    if (a.note) html += '<div class="qb-helper" style="margin-top:14px">'+esc(a.note)+'</div>';

    var need = a.rp && a.rp!==false, link = (a.rp===true || a.rp==="ctxlink");
    if (need || link || a.pick || a.targetPJ || a.article) {
      var blocs = "", sels = "";
      if (need)  blocs += ui.fld((a.ctxLabel||"Contexte RP de la demande")+" *", ui.ta("contexte","Expliquez pourquoi vous avez besoin de ce service, dans quel contexte narratif…"));
      if (a.article) blocs += ui.fld("Article de presse à publier", ui.ta("article","Rédigez ici l'article destiné au Journal…"));
      if (link)  sels += ui.fld(a.linkLabel||"Lien du RP concerné (si applicable)", ui.inp("lien","https://"));
      if (a.pick) sels += ui.fld(a.pick.l, ui.sel("cible", a.pick.o));
      if (a.targetPJ) {
        sels += ui.fld("Cible du service", '<select data-champ="cible_type" id="qb-cibletype"><option>— PNJ (staff) —</option><option>— Choisir un PJ —</option></select>');
        var opts = api.pseudos().map(function(p){ return '<option>'+esc(p)+'</option>'; }).join("");
        sels += '<div class="qb-fld" id="qb-pjwrap" style="display:none"><span class="qb-flab">Personnage ciblé</span><select data-champ="cible_pj"><option>— Sélectionner —</option>'+opts+'</select></div>';
      }
      html += '<div class="qb-sec">'+ui.lab("Passer commande")+blocs+(sels?'<div class="qb-selrow">'+sels+'</div>':"")+(a.targetPJ?'<div id="qb-pnjwrap">'+ui.fld("Description du PNJ ciblé", ui.ta("cible_pnj","Décrivez le personnage non-joueur visé : qui, où, quel lien avec vous…"))+'</div>':"")+'<div class="qb-helper">Merci d\'être précis. Cela aide le staff à valider votre demande.</div></div><div class="qb-rule"></div>';
    }

    html += '<div class="qb-opts">';
    if (a.dette==="main") {
      html += ui.optcard({ ic:"fi fi-tr-dollar", titre:"Payer comptant", desc:"Réglez le montant total en dollars.", prix:money(a.p), btn:"Payer maintenant", act:"comptant", montant:a.p, pay:true, note:"Débloque le badge « Service demandé »." })
            + ui.optcard({ ic:"fi fi-tr-balance-scale-left", titre:"Service contre une dette", desc:"En échange d'une dette d'honneur lourde envers la Main.", prix:"0 $ + dette", btn:"Contracter", act:"dette", dette:"lourde", montant:0, note:"Débloque le badge « Rien n'est gratuit »." });
    } else if (a.dette==="faveur") {
      html += ui.optcard({ ic:"fi fi-tr-dollar", titre:"Payer comptant", desc:"Réglez le montant total en dollars.", prix:money(a.p), btn:"Payer maintenant", act:"comptant", montant:a.p, pay:true })
            + ui.optcard({ ic:"fi fi-tr-balance-scale-left", titre:"Petite faveur", desc:"À moindre coût, contre une dette narrative légère.", prix:"60 $ + dette", btn:"Contracter", act:"dette", dette:"legere", montant:60, note:"Dette notée par le staff, rappelée au moment opportun." });
    } else {
      html += ui.optcard({ ic:"fi fi-tr-dollar", titre:"Payer comptant", desc:"Réglez le montant total en dollars.", prix:money(a.p), btn:"Payer maintenant", act:"comptant", montant:a.p, pay:true });
    }
    html += '</div>';
    return html;
  }

  /* ===================== FORMULAIRE STAFF ===================== */
  var CHAMPS = [
    ["n","Nom"],["ic","Icône Flaticon (ex. crystal-ball)"],["p","Prix ($)"],["na","Nature"],["fo","Forme"],
    ["us","Usage"],["ef","Effet"],["sv","Service"],["co","Condition"],["li","Limite"],
    ["po","Portée"],["ja","Impact jauge"],["badge","Badge requis"]
  ];
  function inp(champ, v){ return '<input data-champ="'+champ+'" value="'+esc(v!=null?v:"")+'">'; }
  function form(item, api, id){
    var it = item || {}, cats = api.cats();
    var html = '<span class="qb-lab qb-dhl">'+(id?"Éditer un item":"Ajouter un item")+' — Le Comptoir</span>'
      + '<input type="hidden" id="qb-formid" value="'+esc(id||"")+'">'
      + '<div class="qb-staffgrid">';
    html += ui.fld("Sous-catégorie", '<select data-champ="cat">'+cats.map(function(c){ return '<option value="'+c.k+'"'+(it.cat===c.k?" selected":"")+'>'+esc(c.l)+'</option>'; }).join("")+'</select>');
    CHAMPS.forEach(function(f){ html += ui.fld(f[1], inp(f[0], it[f[0]])); });
    html += ui.fld("Type de dette", '<select data-champ="dette"><option value="">— Aucune —</option><option value="main"'+(it.dette==="main"?" selected":"")+'>Dette lourde (Main)</option><option value="faveur"'+(it.dette==="faveur"?" selected":"")+'>Petite faveur</option></select>');
    html += '</div>';
    html += ui.fld("Description", '<textarea data-champ="desc">'+esc(it.desc||"")+'</textarea>');
    html += '<div class="qb-opts" style="margin-top:14px"><button class="qb-optbtn qb-pay" id="qb-save" style="flex:none">Enregistrer</button><button class="qb-optbtn" id="qb-cancel" style="flex:none">Annuler</button></div>';
    return html;
  }

  /* sauvegarde : fusionne les champs édités avec l'item d'origine (préserve
     roll / pick / rp / article / as… non exposés au formulaire) */
  function wireDetail(det, api){
    var save = det.querySelector("#qb-save"); if (save) save.onclick = function(){
      var champs = {}; Array.prototype.forEach.call(det.querySelectorAll("[data-champ]"), function(el){ champs[el.getAttribute("data-champ")] = el.value; });
      var idEl = det.querySelector("#qb-formid"); var id = (idEl && idEl.value) || api.nouvelId();
      var orig = idEl && idEl.value ? api.item(id) : {};
      var item = {}; for (var k in orig) if (orig.hasOwnProperty(k)) item[k] = orig[k];
      item.cat = champs.cat; item.desc = champs.desc || "";
      CHAMPS.forEach(function(f){
        var v = (champs[f[0]]||"").trim();
        if (f[0]==="p") { item.p = v===""?0:parseInt(v,10)||0; }
        else if (v==="") { delete item[f[0]]; }
        else item[f[0]] = v;
      });
      if (champs.dette) item.dette = champs.dette; else delete item.dette;
      api.enregistrer(id, item);
    };
    var cancel = det.querySelector("#qb-cancel"); if (cancel) cancel.onclick = function(){ api.annulerForm(); };
    var ct = det.querySelector("#qb-cibletype"), pw = det.querySelector("#qb-pjwrap"), pnw = det.querySelector("#qb-pnjwrap");
    if (ct) ct.onchange = function(){ var pj = /Choisir/.test(ct.value); if (pw) pw.style.display = pj ? "" : "none"; if (pnw) pnw.style.display = pj ? "none" : ""; };
  }

  /* ===================== MIGRATION ===================== */
  /* Resynchronise les items semés avant un changement : l'icône (ti- → Flaticon)
     et les champs de structure (detteAuto, creancier, dette). Le contenu édité
     (prix, description) est préservé. */
  function migre(catalogue){
    var patch = null;
    Object.keys(catalogue).forEach(function(id){
      var it = catalogue[id], def = DEFAUT[id]; if (!it) return;
      var copie = null;
      function set(k, v){ if (!copie){ copie = {}; for (var x in it) if (it.hasOwnProperty(x)) copie[x] = it[x]; } copie[k] = v; }
      if (typeof it.ic === "string" && it.ic.indexOf("ti-") === 0) set("ic", (def && def.ic) || it.ic.replace(/^ti-/, ""));
      if (def) {
        if (def.detteAuto && it.detteAuto !== def.detteAuto) set("detteAuto", def.detteAuto);
        if (def.creancier && !it.creancier) set("creancier", def.creancier);
        if (def.dette && it.dette !== def.dette) set("dette", def.dette);
      }
      if (copie) (patch || (patch = {}))[id] = copie;
    });
    return patch;
  }

  /* ===================== ENREGISTREMENT ===================== */
  Q.register({
    key:"comptoir", label:"Le Comptoir", sub:"boutique personnelle", icon:"fi fi-tr-marketplace-store",
    mode:"grid", leftW:"450px", cols:2, sousChemin:"comptoir",
    cats: CATS, data: DEFAUT, migre: migre,
    cardPrice: function(a){ return typeof a.p==="number" ? money(a.p) : (a.p||""); },
    detail: detail, form: form, wireDetail: wireDetail
  });
})();
