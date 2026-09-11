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
    pcom:{flow:"nego",rpOnly:true,qual:"Négociable",pi:800,n:"Protection d\u2019un commerce",desc:"Dissuasion des vols, médiation, intervention si quelqu\u2019un tente de nuire. Contribution financière régulière ou service rendu en échange. Tarif selon négociation en RP.",infos:[["Contrepartie","Contribution financière ou service"],["Niveau","Protection active"],["Condition","Badge + validation staff"],["Note","Tarif selon négociation en RP"]]},
    pfam:{flow:"nego",rpOnly:true,qual:"Négociable",pi:1200,n:"Protection d\u2019une famille",desc:"Surveillance, présence armée, intimidation désignée. En échange : loyauté et disponibilité. La Main choisit ses obligations en retour.",infos:[["Contrepartie","Loyauté et disponibilité"],["Niveau","Protection armée"],["Condition","Badge + validation staff"],["Note","Tarif selon négociation en RP"]]},
    ploc:{flow:"nego",qual:"Négociable",pi:1000,n:"Protection d\u2019un projet local",desc:"Un projet reçoit le soutien discret de la Main. En échange : influence future sur ce projet. La Main n\u2019investit que dans ce qu\u2019elle juge utile.",infos:[["Contrepartie","Influence future sur le projet"],["Niveau","Soutien discret"],["Condition","Badge + validation staff"],["Note","Tarif selon négociation en RP"]]},
    pret:{flow:"pret",qual:"Négociable",pi:null,n:"Prêt discret",desc:"Argent prêté par la Main pour lancer une activité, sauver un commerce. Remboursement ou dette de service. Les intérêts prennent la forme de services à rendre.",infos:[["Provenance","Cagnotte de la Main"],["Intérêts","Services rendus — en RP"],["Contrepartie","Remboursement ou dette lourde"],["Validation","Staff obligatoire"]]},
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
      + '<div class="qb-optbody"><div class="qb-opttitle">Négocier</div><div class="qb-optdesc">Proposez un prix et une compensation à la Main.</div></div>'
      + '<div class="qb-optright"><button class="qb-optbtn" id="qb-negobtn">Négocier</button></div></div>';
  }
  function negoReveal(item){
    var min = Math.ceil((item.pi||0) * 0.6);   /* rabais plafonné à 40 % */
    var b = '<div id="qb-negoreveal" style="display:none;margin-top:14px">', envoi;
    if (item.rpOnly) {
      b += '<div class="qb-selrow">'+ui.fld("Prix négocié *", ui.inp("prix_negocie","$ (rabais max 40 %)"))+'</div>'
        + '<div class="qb-helper">Négociation en RP uniquement. Une <b>dette longue</b> vous sera attribuée : c\u2019est le prix permanent de la protection, un lien de loyauté durable envers la Main (visible au bottin des hors-la-loi).</div>';
      envoi = '<div class="qb-opts qb-center"><button class="qb-optbtn qb-pay qb-act" data-act="demande" data-type="nego" data-min="'+min+'" data-minchamp="prix_negocie" style="flex:none">Envoyer la requête à la Main</button></div>';
    } else {
      b += '<div class="qb-selrow">'
        +   ui.fld("Prix négocié *", ui.inp("prix_negocie","$ (rabais max 40 %)"))
        +   ui.fld("Méthode de négociation", '<select data-champ="methode"><option value="rp">En RP</option><option value="des">Avec les dés</option></select>')
        +   ui.fld("Compensation", '<select data-champ="compensation" id="qb-compensation"><option value="dette">Dette lourde</option><option value="reseau">Réseau d\u2019influence</option></select>')
        + '</div>'
        + '<div id="qb-situationwrap" style="display:none">'+ui.fld("Situation vis-à-vis de la Main", ui.ta("situation_main","Ce que vous pouvez offrir : accès, informations, services, loyauté… (entrée au réseau d\u2019influence si le deal est accepté)"))+'</div>';
      envoi = '<div class="qb-opts qb-center"><button class="qb-optbtn qb-pay" id="qb-nego-envoi" data-min="'+min+'" style="flex:none">Envoyer la requête à la Main</button></div>';
    }
    return b + envoi + '</div>';
  }

  function body(item, api, id){
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
    } else if (item.flow==="pret") {
      b += '<div class="qb-sec">'+ui.lab("Demande de prêt")
        + ui.fld("Contexte de votre demande *", ui.ta("contexte","Pourquoi ce prêt ? Quel commerce à sauver, quelle activité à lancer…"))
        + '<div class="qb-pcgrid"><div>'+ui.fld("Somme demandée *", ui.inp("montant_souhaite","$"))+'</div>'
        + '<div>'+ui.fld("Remboursement", '<select data-champ="pret_contrepartie"><option value="remboursement">Remboursement en monnaie</option><option value="dette">Compensation par dette lourde</option></select>')+'</div></div>'
        + '<div class="qb-helper">L\u2019argent provient de la cagnotte de la Main. En cas de remboursement, les intérêts se règlent en services rendus, en RP. Seule la Main peut lever une dette.</div>'
        + '</div>' + '<div class="qb-opts qb-center"><button class="qb-optbtn qb-pay qb-act" data-act="pret" style="flex:none">Envoyer la requête à la Main</button></div>';
    } else {
      b += '<div class="qb-sec">'+ui.lab("Contexte")+ui.fld("Contexte de votre demande *", ui.ta("contexte","Exposez la situation qui motive votre demande…"))+'</div>';
      var cd = (api && api.cooldownActif) ? api.cooldownActif(id) : null;
      b += '<div class="qb-opts">'
        + ui.optcard({ ic:"fi fi-tr-dollar", titre:"Payer comptant", desc:"Réglez le prix indicatif en dollars.", prix:money(item.pi), btn:"Payer maintenant", act:"comptant", montant:item.pi, pay:true })
        + (cd ? '<div class="qb-optcard"><div class="qb-optcircle"><i class="fi fi-tr-hourglass-end"></i></div><div class="qb-optbody"><div class="qb-opttitle">Négociation indisponible</div><div class="qb-optdesc">Vous avez renoncé récemment. Renégociable à partir du '+cd.toLocaleDateString("fr-FR")+'.</div></div></div>' : negoCard())
        + '</div>' + (cd ? '' : negoReveal(item));
    }
    return b;
  }

  /* ---------- OVERLAY DE DÉ ---------- */
  function styleDe(){
    if (document.getElementById("qm-style")) return;
    var s = document.createElement("style"); s.id = "qm-style";
    s.textContent = ""
    + ".qm-ov{position:fixed;inset:0;z-index:9500;background:rgba(20,16,14,.55);display:flex;align-items:center;justify-content:center;padding:20px;font-family:var(--txt3)}"
    + ".qm-box{position:relative;background:var(--clair1);border-radius:12px;max-width:440px;width:100%;padding:26px 28px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)}"
    + ".qm-x{position:absolute;top:10px;right:14px;background:none;border:0;font-size:22px;color:var(--darkopa5);cursor:pointer;line-height:1}"
    + ".qm-t{font-family:var(--font2);font-size:22px;text-transform:uppercase;letter-spacing:.02em;color:var(--dark);margin-bottom:4px}"
    + ".qm-s{font-family:var(--txt3);font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--darkopa6);margin-bottom:18px}"
    + ".qm-p{font-family:var(--txt1);font-size:17px;line-height:1.45;margin:6px 0 14px;color:var(--txt)}"
    + ".qm-win{color:var(--gr2-color)}.qm-lose{color:var(--dark2)}"
    + ".qm-price{font-family:var(--font2);font-size:30px;color:var(--dark);margin:6px 0 16px}"
    + ".qm-acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}"
    + ".qm-roll{font-family:var(--txt3);text-transform:uppercase;letter-spacing:.06em;font-size:13px;background:var(--dark2);color:var(--clair1);border:none;border-radius:6px;padding:11px 22px;cursor:pointer}"
    + ".qm-alt{font-family:var(--txt3);text-transform:uppercase;letter-spacing:.06em;font-size:13px;background:none;color:var(--darkopa6);border:1px solid var(--cntr6);border-radius:6px;padding:11px 22px;cursor:pointer}"
    + ".qm-warn{font-family:var(--txt1);font-style:italic;font-size:13px;color:var(--darkopa6);margin:14px 0 0}";
    document.head.appendChild(s);
  }
  function ouvrirDe(item, api, id, proposed){
    styleDe();
    var pi = item.pi;
    var ov = document.createElement("div"); ov.className = "qm-ov";
    ov.innerHTML = '<div class="qm-box"><button class="qm-x">\u00D7</button>'
      + '<div class="qm-t">Négociation avec la Main</div>'
      + '<div class="qm-s">Prix de base '+money(pi)+' · votre offre '+money(proposed)+'</div>'
      + '<div id="qm-b"><p class="qm-p">La Main pèse votre proposition. À vous de tenter le sort.</p>'
      + '<button class="qm-roll" id="qm-roll">Lancer le dé</button></div></div>';
    document.body.appendChild(ov);
    function close(){ ov.remove(); }
    ov.querySelector(".qm-x").onclick = close;
    ov.querySelector("#qm-roll").onclick = function(){
      var roll = 1 + Math.floor(Math.random()*100);
      var oc = roll<=10 ? "cc" : roll<=50 ? "rs" : roll<=90 ? "es" : "ce";
      var dd = pi - proposed;
      var price = oc==="cc" ? proposed : oc==="rs" ? (pi - Math.round(dd/2)) : oc==="es" ? pi : Math.round(pi*1.1);
      var win = (oc==="cc" || oc==="rs");
      var msg = { cc:"La Main est impressionnée : elle accepte votre prix.", rs:"La Main consent à un geste. Rabais partiel accordé.", es:"La Main n'accorde aucun rabais. Prix plein.", ce:"Vous avez agacé la Main. Une majoration s'applique." }[oc];
      var lab = { cc:"Réussite critique", rs:"Réussite", es:"Échec", ce:"Échec critique" }[oc];
      var bd = ov.querySelector("#qm-b");
      bd.innerHTML = '<p class="qm-p '+(win?"qm-win":"qm-lose")+'">'+msg+'</p><div class="qm-price">'+money(price)+'</div>'
        + '<div class="qm-acts">'
        + (win ? '<button class="qm-roll" id="qm-ok">Confirmer et payer</button>'
               : '<button class="qm-roll" id="qm-ok">Payer '+money(price)+'</button><button class="qm-alt" id="qm-no">Renoncer</button>')
        + '</div>' + (win ? "" : '<p class="qm-warn">Renoncer bloque la renégociation de ce service pendant une semaine.</p>');
      bd.querySelector("#qm-ok").onclick = function(){
        close();
        api.acheter({ act:"comptant", montant:price, cagnotte:item.cagnotte, champs:{ prix_final:price, dice:lab } });
      };
      var no = bd.querySelector("#qm-no");
      if (no) no.onclick = function(){ close(); if (api.setCooldown) api.setCooldown(id); alert("Négociation abandonnée. Tu ne pourras pas renégocier ce service avant une semaine."); };
    };
  }

  function wireDetail(det, api, item){
    var env = det.querySelector("#qb-nego-envoi"); if (!env) return;
    env.onclick = function(){
      var champs = {}; Array.prototype.forEach.call(det.querySelectorAll("[data-champ]"), function(el){ champs[el.getAttribute("data-champ")] = el.value; });
      var min = parseInt(env.getAttribute("data-min"),10), prop = parseInt(champs.prix_negocie,10);
      if (!prop || prop < min) { alert("Prix proposé trop bas — le minimum autorisé est " + money(min) + " (rabais plafonné à 40 %)."); return; }
      var id = api.selId();
      var cd = api.cooldownActif && api.cooldownActif(id);
      if (cd) { alert("Négociation indisponible pour ce service jusqu'au " + cd.toLocaleDateString("fr-FR") + "."); return; }
      if (champs.methode === "des") ouvrirDe(item, api, id, prop);
      else api.acheter({ act:"demande", demandeType:"nego" });
    };
  }

  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"main", bohl:"main", ordre:1, l:"La Main de la Providence", ic:"fi fi-tr-hands-usd", c:"var(--gr6-color)", cagnotte:"Providence",
    hero:{ logo:"fi fi-tr-hands-usd", desc:"La paroisse du crime en Terrebonne. Empire de l\u2019information, cette organisation opère dans la région depuis 20 ans." },
    data: DATA, body: body, wireDetail: wireDetail
  });
})();
