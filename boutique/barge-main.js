/*
 * barge-main.js — Bande « La Main de la Providence » (marché noir) · TDL
 * Mécanique : NÉGOCIATION. Prix indicatif + grille d'informations ; l'acheteur
 * paie comptant l'indicatif OU clique « Négocier » (champ rémunération révélé →
 * requête au staff, sans débit). « Aller à Confesse » = négociation libre.
 * Se déclare dans window.QuaisBarge.bandes ; À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-main] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, money = Q.money, esc = ui.esc;

  var DATA = {
    pcom:{flow:"nego",qual:"Négociable",pi:800,n:"Protection d\u2019un commerce",desc:"Dissuasion des vols, médiation, intervention si quelqu\u2019un tente de nuire. Contribution financière régulière ou service rendu en échange. Tarif selon négociation en RP.",infos:[["Contrepartie","Contribution financière ou service"],["Niveau","Protection active"],["Condition","Badge + validation staff"],["Note","Tarif selon négociation en RP"]]},
    pfam:{flow:"nego",qual:"Négociable",pi:1200,n:"Protection d\u2019une famille",desc:"Surveillance, présence armée, intimidation désignée. En échange : loyauté et disponibilité. La Main choisit ses obligations en retour.",infos:[["Contrepartie","Loyauté et disponibilité"],["Niveau","Protection armée"],["Condition","Badge + validation staff"],["Note","Tarif selon négociation en RP"]]},
    ploc:{flow:"nego",qual:"Négociable",pi:1000,n:"Protection d\u2019un projet local",desc:"Un projet reçoit le soutien discret de la Main. En échange : influence future sur ce projet. La Main n\u2019investit que dans ce qu\u2019elle juge utile.",infos:[["Contrepartie","Influence future sur le projet"],["Niveau","Soutien discret"],["Condition","Badge + validation staff"],["Note","Tarif selon négociation en RP"]]},
    pret:{flow:"nego",qual:"Négociable",pi:null,n:"Prêt discret",desc:"Argent prêté pour lancer une activité, sauver un commerce. Remboursement ou dette de service. Les intérêts prennent la forme de services à rendre.",infos:[["Contrepartie","Remboursement ou service futur"],["Intérêts","Forme de service — pas d\u2019argent"],["Condition","Badge + validation staff"],["Note","Tarif selon négociation en RP"]]},
    med:{flow:"nego",qual:"Justice officieuse",pi:1500,n:"Médiation forcée",desc:"Deux parties contraintes de trouver un accord. La Main est arbitre et garant. Résolution garantie — au prix que la Main juge approprié.",infos:[["Parties","2 personnages en conflit"],["Arbitre","La Main — décision finale"],["Condition","Badge + validation staff"],["Note","Peut imposer des concessions"]]},
    intim:{flow:"nego",qual:"Avertissement",pi:1500,n:"Intimidation sérieuse",desc:"Avertissement très clair, au-delà du niveau façade. La Main n\u2019avertit qu\u2019une fois. Tarif indicatif — la négociation peut réduire ou augmenter.",infos:[["Niveau","Au-delà de la façade"],["Limite","Une seule fois — la Main n\u2019avertit pas deux fois"],["Condition","Badge + validation staff"],["Note","La suite, c\u2019est la Vendetta"]]},
    vend:{flow:"nego",qual:"Réponse définitive",pi:3000,n:"Vendetta",desc:"Réponse violente organisée. Décision exceptionnelle. Conditions strictes. Quasi-inaccessible sans dette pour un joueur moyen. Conséquences permanentes garanties.",infos:[["Nature","Réponse violente organisée"],["Conditions","Injustice grave + équilibre menacé"],["Validation","Staff obligatoire — délai possible"],["Conséquences","Permanentes et irréversibles"]]},
    confesse:{flow:"nego",qual:"Sur mesure",pi:null,confesse:true,n:"Aller à Confesse",desc:"Tous les problèmes n\u2019entrent pas dans un menu. Exposez votre situation, ce que vous attendez de la Main et la rémunération que vous êtes prêt à accorder. Si votre affaire l\u2019intéresse, elle vous fera parvenir une proposition.",helper:"La Main négocie toujours."}
  };

  function iconMain(label){
    var m = { "Contrepartie":"fi fi-tr-arrows-repeat","Niveau":"fi fi-tr-dashboard","Condition":"fi fi-tr-clipboard-check","Note":"fi fi-tr-comment-info","Intérêts":"fi fi-tr-coins","Parties":"fi fi-tr-comment-user","Arbitre":"fi fi-tr-balance-scale-left","Limite":"fi fi-tr-diamond-exclamation","Nature":"fi fi-tr-dagger","Conditions":"fi fi-tr-clipboard-check","Validation":"fi fi-tr-check","Conséquences":"fi fi-tr-danger-sign" };
    return m[label] || "fi fi-tr-diamond";
  }
  var RETRO = "Ce que vous proposez : dollars, service rendu, dette envers la Main…";
  function negoCard(){
    return '<div class="qb-optcard"><div class="qb-optcircle"><i class="fi fi-tr-balance-scale-left"></i></div>'
      + '<div class="qb-optbody"><div class="qb-opttitle">Négocier</div><div class="qb-optdesc">Proposez votre rémunération : dollars, service rendu ou dette envers la Main.</div></div>'
      + '<div class="qb-optright"><button class="qb-optbtn" id="qb-negobtn">Négocier</button></div></div>';
  }
  function negoReveal(){
    return '<div id="qb-negoreveal" style="display:none;margin-top:14px">'
      + ui.fld("Rémunération proposée *", ui.ta("remuneration", RETRO))
      + ui.envoi("Envoyer la requête à la Main", "nego") + '</div>';
  }

  function body(item){
    var b = "";
    if (item.infos) b += ui.infosCles(item.infos, iconMain);
    b += '<div class="qb-rule"></div>';
    if (item.confesse) {
      b += '<div class="qb-sec">'+ui.lab("Aller à Confesse")
        + ui.fld("Votre situation *", ui.ta("situation","Exposez votre problème, le contexte RP…"))
        + '<div class="qb-pcgrid"><div>'+ui.fld("Ce que vous attendez de la Main", ui.ta("attentes","Le service espéré…"))+'</div>'
        + '<div>'+ui.fld("Rémunération proposée *", ui.ta("remuneration","Dollars, service rendu, dette envers la Main…"))+'</div></div>'
        + (item.helper?'<div class="qb-helper">'+esc(item.helper)+'</div>':"")
        + '</div>' + ui.envoi("Envoyer la requête à la Main","nego");
    } else if (typeof item.pi==="number") {
      b += '<div class="qb-opts">'
        + ui.optcard({ ic:"fi fi-tr-dollar", titre:"Payer comptant", desc:"Réglez le prix indicatif en dollars.", prix:money(item.pi), btn:"Payer maintenant", act:"comptant", montant:item.pi, pay:true })
        + negoCard() + '</div>' + negoReveal();
    } else {
      b += '<div class="qb-sec">'+ui.lab("Négocier avec la Main")
        + '<div class="qb-pcgrid"><div>'+ui.fld("Montant souhaité", ui.inp("montant_souhaite","$"))+'</div>'
        + '<div>'+ui.fld("Contrepartie proposée *", ui.ta("remuneration","Remboursement, service futur…"))+'</div></div>'
        + '</div>' + ui.envoi("Envoyer la requête à la Main","nego");
    }
    return b;
  }

  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"main", ordre:1, l:"La Main de la Providence", ic:"fi fi-tr-hands-usd", c:"var(--gr6-color)",
    hero:{ logo:"fi fi-tr-hands-usd", desc:"La paroisse du crime en Terrebonne. Empire de l\u2019information, cette organisation opère dans la région depuis 20 ans." },
    data: DATA, body: body
  });
})();
