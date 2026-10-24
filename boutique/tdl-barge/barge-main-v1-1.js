/*
 * barge-main.js — Bande « La Main de la Providence » (marché noir) · TDL · v3
 *
 * TROIS FORMES DE FICHE
 *   Services (protections, médiation, intimidation, vendetta) — prix indicatif
 *     ou négociation. La négociation se joue en RP ou aux dés ; elle porte une
 *     COMPENSATION (dette lourde ou réseau d'influence), qui est la contrepartie
 *     du rabais. Les protections (rpOnly) se négocient en RP seulement et
 *     inscrivent une dette longue au réseau à la validation.
 *   Aller à Confesse — demande libre, payée en monnaie, en dette lourde ou en
 *     réseau. Payée en monnaie, la somme est retenue à l'envoi ; à la
 *     validation elle va à la cagnotte Providence. Si la case RP est cochée,
 *     un dossier s'ouvre au tableau de la Main et la clôture reverse la prime
 *     aux participants, moins la commission (rep-det-main, CFG.COMMISSION).
 *   Prêt discret — remboursement en monnaie ou par dette lourde.
 *
 * [MAJ v3] LA COMPENSATION N'APPARTIENT QU'À LA NÉGOCIATION.
 *   Le panneau « Négocier » restait dans la page quand le joueur payait au prix
 *   indicatif, et ses valeurs par défaut partaient avec la demande : un
 *   paiement comptant inscrivait une dette lourde. Le panneau vit désormais
 *   dans une zone masquée (jamais lue par le socle), et la demande porte
 *   voie = "prix" | "nego" | "confesse", que quai-staff vérifie.
 *
 * [MAJ v3] LA DETTE LOURDE NAÎT À LA DEMANDE (detteLourde ci-dessous), et
 *   compte aussitôt dans le plafond des trois. Refusée, elle est effacée.
 *
 * [MAJ v3-1] CARTES D'OPTION RÉTABLIES. Chaque service à prix porte deux
 *   cartes : « Payer comptant » (soumet aussitôt) et « Négocier » (ouvre le
 *   volet de négociation, qui a son propre bouton). Le prêt a sa carte.
 *   Seule la Confesse garde le bouton centré « Soumettre ma demande ».
 *   Le style de la fenêtre du dé vit dans css-barge-de.css.
 *
 * [MAJ v3-2] Plus aucune mention de badge : l'accès aux services sera filtré
 *   plus tard, automatiquement, par le système de badges.
 *
 * À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-main] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, money = Q.money, esc = ui.esc;

  /* ===================== CONFIG ===================== */
  var CFG = {
    CAGNOTTE:   "Providence",
    RABAIS_MAX: 0.4,     /* le prix négocié ne descend pas sous 60 % de l'indicatif */
    COMMISSION: 0.2      /* MIROIR de rep-det-main CFG.COMMISSION — à aligner s'il change */
  };

  var CIBLES        = [["pj","Un personnage joueur"],["pnj","Un PNJ"],["famille","Une famille"],["groupe","Un groupe"],["entreprise","Une entreprise"]];
  var COMP_NEGO     = [["dette","Dette lourde"],["reseau","Réseau d\u2019influence"]];
  var COMP_CONFESSE = [["prix","Prix (payer la Main)"],["dette","Dette lourde"],["reseau","Réseau d\u2019influence"]];
  var RESEAUX       = [["autorites","Autorités corrompues"],["prestataires","Prestataires & Services"],["informateurs","Informateurs locaux"]];
  var METHODES      = [["rp","En RP"],["des","Avec les dés"]];
  var REMBOURSEMENT = [["remboursement","En monnaie"],["dette","Par une dette lourde"]];

  /* ===================== TEXTES ===================== */
  var T = {
    HERO:         "La paroisse du crime en Terrebonne. Empire de l\u2019information, cette organisation opère dans la région depuis vingt ans.",
    L_CONTEXTE:   "Contexte de ta demande *",
    PH_CONTEXTE:  "Quelle situation motive ta demande\u2026",
    L_CIBLE_TYPE: "Qui est visé ? *",
    L_CIBLE_PJ:   "Personnage visé *",
    L_CIBLE_NOM:  "Nom de la cible *",
    PH_CIBLE:     "Nom du PNJ, de la famille, du groupe\u2026",
    CIB_HINT:     "Un nom vague fait perdre du temps à la Main, et son temps se facture.",
    L_RP:         "Ce service a vocation à devenir un RP joué avec la Main",
    RP_LIBRE:     "Coché, ce service sera joué en RP avec un membre de la Main.",
    RP_MED:       "La médiation se joue toujours en RP : ton personnage est l\u2019une des deux parties.",
    RP_PJ:        "La cible est un personnage joueur : la scène sera jouée.",
    C_COMPTANT:   "Payer comptant",
    C_COMPTANT_D: "Règle le prix indicatif en dollars.",
    C_PAYER:      "Payer maintenant",
    C_NEGO:       "Négocier",
    C_NEGO_D:     "Propose un prix et une compensation à la Main.",
    C_NEGO_RP_D:  "Propose un prix : la négociation se joue en RP.",
    C_INDISPO:    "Négociation indisponible",
    C_PRET:       "Demander un prêt",
    C_PRET_D:     "La Main avance la somme ; tu la rembourses en monnaie ou par une dette lourde.",
    C_PRET_P:     "Selon la cagnotte",
    C_ENVOI:      "Soumettre ma demande",
    S_NEGO:       "Ta négociation",
    L_PRIX_NEGO:  "Prix proposé *",
    PH_PRIX_NEGO: "$",
    L_METHODE:    "Négociation",
    L_COMP:       "Compensation *",
    L_RESEAU:     "Catégorie du réseau",
    L_SITUATION:  "Ton rôle dans le réseau *",
    PH_SITUATION: "Ce que tu peux offrir : accès, informations, services, loyauté\u2026",
    AIDE_NEGO:    "Rabais de 40 % au plus. La compensation est le prix du rabais : une dette lourde t\u2019est inscrite dès l\u2019envoi, une entrée au réseau à la validation.",
    AIDE_RPONLY:  "Négociation en RP uniquement. À la validation, une dette longue t\u2019est attribuée au réseau de la Main : c\u2019est le prix permanent de la protection.",
    COOLDOWN:     function (d) { return "Tu as renoncé récemment : négociation possible à partir du " + d.toLocaleDateString("fr-FR") + "."; },

    L_ATTENTES:   "Ce que tu attends de la Main",
    PH_ATTENTES:  "Le service espéré\u2026",
    L_OFFRE:      "Ce que tu offres *",
    L_PRIX:       "Prix proposé *",
    L_ARGUMENT:   "Ce que tu offres à la Main *",
    PH_ARGUMENT:  "Le service conséquent, ou les services au long cours, que tu offres en échange\u2026",
    AIDE_CONF:    "Coche la case et ton affaire devient une mission au tableau de la Main : la prime est partagée entre les participants, la Main en garde " + Math.round(CFG.COMMISSION*100) + " %. Sans mission, elle revient entière à la Main.",

    L_SOMME:      "Somme demandée *",
    L_REMB:       "Remboursement",
    AIDE_PRET:    "L\u2019argent vient de la cagnotte de la Main. Les intérêts se règlent en services rendus, en RP.",

    ERR_CIBLE:    "Nomme la cible : la Main ne s\u2019engage pas à l\u2019aveugle.",
    ERR_PRIX:     function (m) { return "Prix trop bas : le minimum est " + money(m) + " (rabais de 40 % au plus)."; },
    ERR_CD:       "Négociation indisponible pour ce service pour le moment.",
    ERR_SITUATION:"Dis quel rôle ton personnage peut tenir dans le réseau.",
    ERR_ARGUMENT: "Dis ce que tu offres à la Main en échange.",
    ERR_OFFRE:    "Indique le prix que tu proposes à la Main.",
    ERR_SOMME:    "Indique la somme que tu demandes.",

    OK_PRIX:      "Demande envoyée à la Main.",
    OK_NEGO:      "Demande de négociation envoyée. Si le staff valide, elle s\u2019ouvre au tableau de la Main.",
    OK_DES:       "Négociation conclue aux dés : la Main attend la validation du staff.",
    OK_CONFESSE:  "Ta confession est transmise à la Main.",
    OK_PRET:      "Demande de prêt envoyée. Si le staff valide, la somme te sera versée.",

    DE_TITRE:     "Négociation avec la Main",
    DE_SOUS:      function (pi, p) { return "Prix de base " + money(pi) + " · ton offre " + money(p); },
    DE_INTRO:     "La Main pèse ta proposition. À toi de tenter le sort.",
    DE_LANCER:    "Lancer le dé",
    DE_OK:        "Confirmer et payer",
    DE_PAYER:     function (p) { return "Payer " + money(p); },
    DE_RENONCER:  "Renoncer",
    DE_WARN:      "Renoncer bloque la renégociation de ce service pendant une semaine.",
    DE_ISSUES: {
      cc: ["Réussite critique", "La Main est impressionnée : elle accepte ton prix."],
      rs: ["Réussite",          "La Main consent à un geste : rabais partiel."],
      es: ["Échec",             "La Main n\u2019accorde aucun rabais : prix plein."],
      ce: ["Échec critique",    "Tu as agacé la Main : une majoration s\u2019applique."]
    },
    DE_ABANDON:   "Négociation abandonnée. Tu ne pourras pas renégocier ce service avant une semaine."
  };

  /* ===================== CATALOGUE ===================== */
  var DATA = {
    pcom:{ flow:"nego", rpOnly:true, reseau_auto:"entreprises", qual:"Négociable", pi:800, n:"Protection d\u2019un commerce",
      desc:"Dissuasion des vols, médiation, intervention si quelqu\u2019un tente de nuire. Contribution financière régulière ou service rendu en échange.",
      infos:[["Contrepartie","Contribution financière ou service"],["Niveau","Protection active"],["Validation","Staff obligatoire"],["Note","Tarif selon négociation en RP"]] },
    pfam:{ flow:"nego", rpOnly:true, reseau_auto:"informateurs", qual:"Négociable", pi:1200, n:"Protection d\u2019une famille",
      desc:"Surveillance, présence armée, intimidation désignée. En échange : loyauté et disponibilité. La Main choisit ses obligations en retour.",
      infos:[["Contrepartie","Loyauté et disponibilité"],["Niveau","Protection armée"],["Validation","Staff obligatoire"],["Note","Tarif selon négociation en RP"]] },
    ploc:{ flow:"nego", qual:"Négociable", pi:1000, n:"Protection d\u2019un projet local",
      desc:"Un projet reçoit le soutien discret de la Main. En échange : une influence future sur ce projet. La Main n\u2019investit que dans ce qu\u2019elle juge utile.",
      infos:[["Contrepartie","Influence future sur le projet"],["Niveau","Soutien discret"],["Validation","Staff obligatoire"],["Note","Tarif selon négociation en RP"]] },
    pret:{ flow:"pret", qual:"Négociable", n:"Prêt discret",
      desc:"La Main prête de quoi lancer une activité ou sauver un commerce. Remboursement en monnaie ou dette de service ; les intérêts se paient en services rendus.",
      infos:[["Provenance","Cagnotte de la Main"],["Intérêts","Services rendus — en RP"],["Contrepartie","Remboursement ou dette lourde"],["Validation","Staff obligatoire"]] },
    med:{ flow:"nego", qual:"Justice officieuse", pi:1500, cible:true, rpForce:true, n:"Médiation forcée",
      desc:"Deux parties contraintes de trouver un accord. La Main est arbitre et garant. Résolution garantie, au prix que la Main juge approprié.",
      infos:[["Parties","2 personnages en conflit"],["Arbitre","La Main — décision finale"],["Validation","Staff obligatoire"],["Note","Peut imposer des concessions"]] },
    intim:{ flow:"nego", qual:"Avertissement", pi:1500, cible:true, n:"Intimidation sérieuse",
      desc:"Un avertissement très clair, au-delà du niveau de façade. La Main n\u2019avertit qu\u2019une fois.",
      infos:[["Niveau","Au-delà de la façade"],["Limite","Une seule fois — la Main n\u2019avertit pas deux fois"],["Validation","Staff obligatoire"],["Note","La suite, c\u2019est la Vendetta"]] },
    vend:{ flow:"nego", qual:"Réponse définitive", pi:3000, cible:true, n:"Vendetta",
      desc:"Réponse violente organisée. Décision exceptionnelle, conditions strictes, conséquences permanentes.",
      infos:[["Nature","Réponse violente organisée"],["Conditions","Injustice grave + équilibre menacé"],["Validation","Staff obligatoire — délai possible"],["Conséquences","Permanentes et irréversibles"]] },
    confesse:{ flow:"nego", qual:"Sur mesure", confesse:true, n:"Aller à Confesse",
      desc:"Tous les problèmes n\u2019entrent pas dans un menu. Expose ta situation, ce que tu attends de la Main et ce que tu peux lui accorder. Si ton affaire l\u2019intéresse, elle te fera une proposition.",
      helper:"La Main négocie toujours." }
  };

  var ICONES = { "Contrepartie":"fi fi-tr-arrows-repeat","Niveau":"fi fi-tr-dashboard","Condition":"fi fi-tr-clipboard-check","Note":"fi fi-tr-comment-info",
                 "Provenance":"fi fi-tr-sack-dollar","Intérêts":"fi fi-tr-coins","Parties":"fi fi-tr-comment-user","Arbitre":"fi fi-tr-balance-scale-left",
                 "Limite":"fi fi-tr-diamond-exclamation","Nature":"fi fi-tr-dagger","Conditions":"fi fi-tr-clipboard-check","Validation":"fi fi-tr-check",
                 "Conséquences":"fi fi-tr-danger-sign" };
  function icone(label){ return ICONES[label] || "fi fi-tr-diamond"; }

  function prixMin(item){ return Math.ceil((item.pi||0) * (1 - CFG.RABAIS_MAX)); }

  /* ===================== BRIQUES ===================== */
  function champContexte(){ return ui.fld(T.L_CONTEXTE, ui.ta("contexte", T.PH_CONTEXTE)); }

  /* Une seule valeur part : la liste des membres pour un PJ (le pseudo doit
     être exact, il ouvre l'accès au dossier), un champ libre sinon. */
  function blocCible(api){
    var ps = api.pseudos().map(function(p){ return [p,p]; });
    return ui.rangee(
      ui.fld(T.L_CIBLE_TYPE, ui.sel("cible_type", CIBLES, null, { bascule:"cible" })),
      ui.zone("cible:pj", ui.fld(T.L_CIBLE_PJ, ui.sel("cible_pj", ps, "— Choisir un membre —")))
      + ui.zone("cible:pnj cible:famille cible:groupe cible:entreprise", ui.fld(T.L_CIBLE_NOM, ui.inp("cible", T.PH_CIBLE)))
    ) + ui.aide(T.CIB_HINT);
  }

  function caseRp(item){
    return ui.caseACocher("rp_mission", T.L_RP, { id:"qb-rpmission", coche:!!item.rpForce, verrou:!!item.rpForce })
      + '<div class="qb-helper" id="qb-rphint" style="margin-top:4px">'+esc(item.rpForce ? T.RP_MED : T.RP_LIBRE)+'</div>';
  }

  function carteIndispo(cd){
    return '<div class="qb-optcard"><div class="qb-optcircle"><i class="fi fi-tr-hourglass-end"></i></div>'
      + '<div class="qb-optbody"><div class="qb-opttitle">'+esc(T.C_INDISPO)+'</div><div class="qb-optdesc">'+esc(T.COOLDOWN(cd))+'</div></div></div>';
  }

  function voletNego(item){
    var champs = item.rpOnly
      ? ui.rangee(ui.fld(T.L_PRIX_NEGO, ui.inp("prix_negocie", T.PH_PRIX_NEGO))) + ui.aide(T.AIDE_RPONLY)
      : ui.rangee(
          ui.fld(T.L_PRIX_NEGO, ui.inp("prix_negocie", T.PH_PRIX_NEGO)),
          ui.fld(T.L_METHODE, ui.sel("methode", METHODES)),
          ui.fld(T.L_COMP, ui.sel("compensation", COMP_NEGO, null, { bascule:"comp" }))
        )
        + ui.zone("comp:reseau", ui.rangee(
            ui.fld(T.L_RESEAU, ui.sel("reseau_cat", RESEAUX)),
            ui.fld(T.L_SITUATION, ui.ta("situation_main", T.PH_SITUATION))
          ))
        + ui.aide(T.AIDE_NEGO);
    return ui.zone("revele:nego", ui.section(T.S_NEGO, champs) + ui.envoi(T.C_ENVOI));
  }

  /* deux cartes : payer au prix indicatif, ou ouvrir la négociation */
  function blocPaiement(item, api, id){
    var cd = api.cooldownActif(id);
    return ui.options(
        ui.optcard({ ic:"fi fi-tr-dollar", titre:T.C_COMPTANT, desc:T.C_COMPTANT_D, prix:money(item.pi),
                     btn:T.C_PAYER, act:"comptant", montant:item.pi, pay:true }),
        cd ? carteIndispo(cd)
           : ui.optcard({ ic:"fi fi-tr-balance-scale-left", titre:T.C_NEGO, desc:item.rpOnly ? T.C_NEGO_RP_D : T.C_NEGO_D,
                          btn:T.C_NEGO, ouvre:"nego" })
      ) + (cd ? "" : voletNego(item));
  }

  /* ===================== CORPS ===================== */
  function corpsService(item, api, id){
    return ui.section("Ta demande", champContexte() + (item.cible ? blocCible(api) + caseRp(item) : ""))
      + blocPaiement(item, api, id);
  }

  function corpsConfesse(item){
    return ui.section("Aller à Confesse",
        ui.duo(champContexte(), ui.fld(T.L_ATTENTES, ui.ta("attentes", T.PH_ATTENTES)))
      + ui.rangee(
          ui.fld(T.L_OFFRE, ui.sel("compensation", COMP_CONFESSE, null, { bascule:"comp" })),
          ui.zone("comp:prix", ui.fld(T.L_PRIX, ui.inp("prix_offert", "$")))
        )
      + ui.zone("comp:dette", ui.fld(T.L_ARGUMENT, ui.ta("dette_argument", T.PH_ARGUMENT)))
      + ui.zone("comp:reseau", ui.rangee(
          ui.fld(T.L_RESEAU, ui.sel("reseau_cat", RESEAUX)),
          ui.fld(T.L_SITUATION, ui.ta("situation_main", T.PH_SITUATION))
        ))
      + ui.caseACocher("rp_mission", T.L_RP)
      + ui.aide(T.AIDE_CONF) + ui.aide(item.helper))
      + ui.envoi();
  }

  function corpsPret(){
    return ui.section("Demande de prêt",
        champContexte()
      + ui.rangee(
          ui.fld(T.L_SOMME, ui.inp("montant_souhaite", "$")),
          ui.fld(T.L_REMB, ui.sel("pret_contrepartie", REMBOURSEMENT))
        )
      + ui.aide(T.AIDE_PRET))
      + ui.options(ui.optcard({ ic:"fi fi-tr-sack-dollar", titre:T.C_PRET, desc:T.C_PRET_D, prix:T.C_PRET_P,
                                btn:T.C_ENVOI, act:"pret", pay:true }));
  }

  function body(item, api, id){
    var b = item.infos ? ui.infosCles(ui.versTableau(item.infos), icone) : "";
    if (item.confesse)       return b + corpsConfesse(item);
    if (item.flow==="pret")  return b + corpsPret();
    return b + corpsService(item, api, id);
  }

  /* ===================== RÈGLES ===================== */
  /* la carte « Payer comptant » soumet l'acte comptant ; tout autre envoi
     d'un service à prix vient du volet de négociation */
  function enNego(act){ return act!=="comptant"; }
  function cibleEstPj(c, a, item){ return !!item.cible && c.cible_type==="pj"; }
  function cibleAutre(c, a, item){ return !!item.cible && c.cible_type!=="pj"; }

  var regles = {
    confesse: {
      resoudre: function(c){
        return { act:"demande", demandeType:"nego", champs:{ voie:"confesse" },
                 montant: c.compensation==="prix" ? ui.montant(c.prix_offert) : 0 };
      },
      requis: [
        ["dette_argument", T.ERR_ARGUMENT,  function(c){ return c.compensation==="dette"; }],
        ["situation_main", T.ERR_SITUATION, function(c){ return c.compensation==="reseau"; }]
      ],
      minima: [ ["prix_offert", 1, T.ERR_OFFRE, function(c){ return c.compensation==="prix"; }] ],
      msg: T.OK_CONFESSE
    },
    pret: {
      resoudre: function(){ return { act:"pret" }; },
      minima: [ ["montant_souhaite", 1, T.ERR_SOMME] ],
      msg: T.OK_PRET
    },
    nego: {
      resoudre: function(c, item){
        if (!item.rpOnly && c.methode==="des") return { act:"des", champs:{ voie:"nego" } };
        return { act:"demande", demandeType:"nego", champs:{ voie:"nego" } };
      },
      requis: [
        ["cible_pj",       T.ERR_CIBLE,     cibleEstPj],
        ["cible",          T.ERR_CIBLE,     cibleAutre],
        ["situation_main", T.ERR_SITUATION, function(c, act, item){ return enNego(act) && !item.rpOnly && c.compensation==="reseau"; }]
      ],
      msg: function(c, act){ return act==="comptant" ? T.OK_PRIX : act==="des" ? T.OK_DES : T.OK_NEGO; }
    }
  };

  /* métier : plancher du rabais, renoncement récent */
  function controle(item, c, act, id, api){
    if (item.confesse || item.flow!=="nego" || !enNego(act)) return null;
    if (api.cooldownActif(id)) return T.ERR_CD;
    var p = ui.montant(c.prix_negocie), min = prixMin(item);
    if (p < min) return T.ERR_PRIX(min);
    return null;
  }

  /* dette lourde choisie par le joueur : inscrite dès l'envoi par le socle */
  function detteLourde(item, act, c){
    if (item.confesse && c.compensation==="dette") return { motif:item.n };
    if (item.flow==="pret" && c.pret_contrepartie==="dette") return { motif:item.n };
    if (item.flow==="nego" && !item.rpOnly && enNego(act) && c.compensation==="dette") return { motif:item.n + " (négociation)" };
    return null;
  }

  /* ===================== LE DÉ ===================== */
  /* Le style de la fenêtre vit dans css-barge-de.css (classes qm-). */

  /* Le dé est un acte : le socle a déjà contrôlé le formulaire, vérifié le
     plafond et fait confirmer la dette éventuelle. Le verrou d'envoi reste
     tenu tant que la fenêtre est ouverte. « Payer » vaut confirmation du
     débit ; « Renoncer » n'écrit rien d'autre que le délai. */
  function acteDes(base, champs, api){
    var item = api.item(base.itemId), pi = item.pi|0, propose = ui.montant(champs.prix_negocie);
    return new Promise(function(fin){
      var ov = document.createElement("div"); ov.className = "qm-ov";
      ov.innerHTML = '<div class="qm-box"><button class="qm-x" aria-label="Fermer">\u00D7</button>'
        + '<div class="qm-t">'+esc(T.DE_TITRE)+'</div>'
        + '<div class="qm-s">'+esc(T.DE_SOUS(pi, propose))+'</div>'
        + '<div id="qm-b"><p class="qm-p">'+esc(T.DE_INTRO)+'</p><button class="qm-roll" id="qm-roll">'+esc(T.DE_LANCER)+'</button></div></div>';
      document.body.appendChild(ov);
      function fermer(r){ ov.remove(); fin(r || { ok:false }); }
      ov.querySelector(".qm-x").onclick = function(){ fermer(); };
      ov.querySelector("#qm-roll").onclick = function(){
        var roll = 1 + Math.floor(Math.random()*100);
        var oc = roll<=10 ? "cc" : roll<=50 ? "rs" : roll<=90 ? "es" : "ce";
        var ecart = pi - propose;
        var prix = oc==="cc" ? propose : oc==="rs" ? (pi - Math.round(ecart/2)) : oc==="es" ? pi : Math.round(pi*1.1);
        var gagne = (oc==="cc" || oc==="rs"), issue = T.DE_ISSUES[oc];
        var bd = ov.querySelector("#qm-b");
        bd.innerHTML = '<p class="qm-p '+(gagne?"qm-win":"qm-lose")+'">'+esc(issue[1])+'</p><div class="qm-price">'+esc(money(prix))+'</div>'
          + '<div class="qm-acts"><button class="qm-roll" id="qm-ok">'+esc(gagne ? T.DE_OK : T.DE_PAYER(prix))+'</button>'
          + (gagne ? '' : '<button class="qm-alt" id="qm-no">'+esc(T.DE_RENONCER)+'</button>') + '</div>'
          + (gagne ? '' : '<p class="qm-warn">'+esc(T.DE_WARN)+'</p>');
        ov.querySelector(".qm-x").onclick = function(){ fermer(); };
        bd.querySelector("#qm-ok").onclick = function(){
          ov.remove();
          var b2 = {}; for (var k in base) b2[k] = base[k];
          b2.montant = prix; b2.cagnotte = item.cagnotte || CFG.CAGNOTTE;
          var c2 = {}; for (var j in champs) c2[j] = champs[j];
          c2.prix_final = prix; c2.dice = issue[0];
          Promise.resolve(Q.achat.executer("comptant", b2, c2)).then(fin, function(){ fin({ ok:false }); });
        };
        var no = bd.querySelector("#qm-no");
        if (no) no.onclick = function(){
          api.setCooldown(base.itemId);
          ov.remove(); alert(T.DE_ABANDON); fin({ ok:false });
        };
      };
    });
  }

  /* ===================== ACCROCHES ===================== */
  /* une cible PJ rend la scène obligatoire : la case se coche et se verrouille */
  function wireDetail(det, api, item){
    if (!item || !item.cible || item.rpForce) return;
    var ct = det.querySelector('[data-champ="cible_type"]'),
        box = det.querySelector("#qb-rpmission"), hint = det.querySelector("#qb-rphint");
    if (!ct || !box) return;
    function maj(){
      var pj = ct.value==="pj";
      box.disabled = pj; if (pj) box.checked = true;
      if (hint) hint.textContent = pj ? T.RP_PJ : T.RP_LIBRE;
    }
    ct.addEventListener("change", maj); maj();
  }

  /* ===================== DÉCLARATION ===================== */
  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"main", bohl:"main", ordre:1, l:"La Main de la Providence",
    ic:"fi fi-tr-hands-usd", c:"var(--gr6-color)", cagnotte:CFG.CAGNOTTE,
    hero:{ logo:"fi fi-tr-hands-usd", desc:T.HERO },
    data: DATA, regles: regles, body: body, wireDetail: wireDetail,
    controle: controle, detteLourde: detteLourde,
    actes: { des: acteDes }
  });
})();
