/*
 * barge-braconneurs.js — Bande « Les Braconneurs » (marché noir) · TDL
 * Mécanique : PRIX (terrain). Tant qu'aucun prix numérique n'est fixé, c'est une
 * demande au staff (contexte + cible). Dès que p est un nombre, la fiche propose
 * Payer comptant / Négocier automatiquement. À CHARGER avant barge-core.js.
 */
(function () {
  "use strict";
  if (!window.Quais) { if (window.console) console.warn("[barge-braconneurs] quais-core absent."); return; }
  var Q = window.Quais, ui = Q.ui, money = Q.money, esc = ui.esc;

  var DATA = {
    sabo:{flow:"prix",p:null,tags:"évent ⟡ intrigue",n:"Saboter une zone naturelle",desc:"Sans violence : pièges retirés, embarcadère rendu inutilisable, petit canal volontairement encombré, balisage modifié."},
    piste:{flow:"prix",p:null,n:"Retrouver une piste",desc:"Quelqu\u2019un a disparu dans le bayou, s\u2019est enfui à travers champs et marais ? Les Braconneurs remontent une piste : direction de fuite, objet abandonné, indices sur d\u2019éventuelles blessures."},
    fausse:{flow:"prix",p:null,tags:"enquête",n:"Créer une fausse piste",desc:"Peut modifier une enquête en cours (premier RP), même dans le passé : douilles déplacées, traces de pneus, vêtements abandonnés, empreintes mélangées, piste interrompue."},
    manteau:{flow:"prix",p:null,tags:"évent ⟡ intrigue",n:"Commande sous le manteau",desc:"Les Braconneurs acceptent une commande particulière et offrent leur aide ponctuelle sur le terrain du bayou."},
    temoins:{flow:"prix",p:null,tags:"intrigue Rougarou",n:"Témoins de la nuit",desc:"Pendant le solstice, un Braconneur affirme avoir observé quelque chose dans le bayou. Le staff fournit un fait inédit lié à la nuit — piste capitale ou détail insignifiant.",note:"PJ obligatoire ⟡ peut déclencher un évent de bande."}
  };

  function body(item){
    var b = "";
    if (item.tags) b += '<div class="qb-dtag">'+esc(item.tags)+'</div>';
    if (item.note) b += '<div class="qb-helper" style="margin-top:6px">'+esc(item.note)+'</div>';
    b += '<div class="qb-sec">'+ui.lab("Passer commande")
      + '<div class="qb-pcgrid"><div>'+ui.fld("Contexte RP de la demande *", ui.ta("contexte","Expliquez le contexte narratif…"))+'</div>'
      + '<div>'+ui.fld("Cible ou objet concerné", ui.inp("cible","Nom, lieu, objet…"))+'</div></div>'
      + '</div><div class="qb-rule"></div>';
    if (typeof item.p==="number") {
      b += '<div class="qb-opts">'
        + ui.optcard({ ic:"fi fi-tr-dollar", titre:"Payer comptant", desc:"Réglez le montant en dollars.", prix:money(item.p), btn:"Payer maintenant", act:"comptant", montant:item.p, pay:true })
        + ui.optcard({ ic:"fi fi-tr-balance-scale-left", titre:"Négocier", desc:"Proposez un autre tarif ou contractez une dette.", btn:"Négocier", act:"demande", type:"braconneurs" })
        + '</div>';
    } else {
      b += ui.envoi("Envoyer la demande aux Braconneurs", "braconneurs");
    }
    return b;
  }

  (window.QuaisBarge = window.QuaisBarge || { bandes: [] }).bandes.push({
    k:"braco", ordre:3, l:"Les Braconneurs", ic:"fi fi-tr-paw", c:"var(--gr3-color)",
    hero:{ logo:"fi fi-tr-paw", desc:"Pisteurs, saboteurs et hommes de terrain, ils opèrent là où personne d\u2019autre ne s\u2019aventure." },
    data: DATA, body: body
  });
})();
