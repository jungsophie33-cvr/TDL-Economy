/* THE DROWNED LANDS — LA MARINA · RENDU PUBLIC · v1
 *
 * Le pinceau du socle : colonne gauche (bandgrid + liste), fiche détaillée
 * (hero tdlev, informations clés, pavés, options), cagnotte dans la barre,
 * visibilité des deux boutons. Toutes les données, les dérivés et l'état
 * vivent dans marina-core (window.Marina) ; tous les textes, couleurs et
 * icônes vivent dans marina-config (window.MarinaConfig).
 *
 * DÉPEND DE : window.Marina (marina-core), window.MarinaConfig.
 * EXPOSE : window.MarinaPublic.
 */
(function () {
"use strict";

function M(){ return window.Marina; }
function m(){ return window.Marina; }
var MC = window.MarinaConfig;
var CFG = MC.CFG, COMMU = MC.COMMU, BANDES_KEY = MC.BANDES_KEY,
    ST = MC.ST, TXT = MC.TEXTES.CORE, IC = MC.ICONES;

/* ===================== COLONNE GAUCHE ===================== */

function bands(){
  var defs = Object.keys(IC.cats).map(function(k){
    return { k:k, ic:IC.cats[k].ic, lab:IC.cats[k].lab, c:IC.cats[k].c };
  });
  return '<div class="qb-bandgrid qbm-bands">' + defs.map(function(d){
    return '<button class="qb-bandcell'+(M().S.cat===d.k?" qb-on":"")+'" data-cat="'+d.k+'" style="--c:'+d.c+'" type="button">'
      + '<i class="fi '+d.ic+'"></i><span class="qb-bcell"><span>'+m().esc(d.lab)+'</span><em class="qbm-bn">'+m().fichesOf(d.k).length+'</em></span></button>';
  }).join("") + '</div>';
}

function row(f){
  var st = ST[f.statut], j = f.statut==="en_vote" ? m().joursRestants(f.fin) : null;
  return '<button class="tdlev-e qbm-e" aria-current="'+(M().S.sel===f.id)+'" style="--c:'+m().commuOf(f).c+'" data-f="'+f.id+'" type="button">'
    + '<span class="qbm-eimg"'+(f.img?' style="background-image:url(\''+m().esc(f.img)+'\')"':'')+'>'
    + (f.img?'':'<i class="fi '+m().commuOf(f).icon+'"></i>')+'</span>'
    + '<span>'
    + '<span class="qbm-eline"><span class="tdlev-marq" style="background:'+st.c+'">'+st.t+'</span>'
    + '<span class="tdlev-e-t">'+m().esc(f.nom)+'</span></span>'
    + (j!=null && j>=0 ? '<span class="qbm-emeta"><span class="qbm-ej">J-'+j+'</span></span>' : '')
    + '</span>'
    + '<span class="qb-cp">'+m().money(f.montant)+'</span>'
    + '</button>';
}

function renderLeft(root){
  var left = root.querySelector("#qb-left"); if (!left) return;
  var list = m().fichesOf(M().S.cat);
  left.innerHTML = bands()
    + (list.length ? '<div class="tdlev-liste qbm-u-liste">' + list.map(row).join("") + '</div>'
                   : '<div class="tdlev-vide">'+m().esc(TXT.VIDE)+'</div>');
}

/* ===================== FICHE DÉTAILLÉE ===================== */

function elem(icon, k, v){
  return '<div><span class="tdlev-elem-k"><i class="fi '+icon+'"></i>'+m().esc(k)+'</span><p class="tdlev-elem-v">'+m().esc(v)+'</p></div>';
}
function pave(icon, titre, corps){
  var ico = icon.indexOf("fi-sr-")===0 ? icon : icon.replace("fi-tr-","fi-sr-");
  return '<section class="tdlev-pave"><i class="fi '+ico+' tdlev-pave-ico"></i>'
    + '<div class="tdlev-pave-tete"><h4 class="tdlev-pave-h">'+m().esc(titre)+'</h4></div>'
    + '<div class="tdlev-pave-c">'+corps+'</div></section>';
}
function voteInfo(f){
  var j = m().joursRestants(f.fin);
  if (f.statut==="en_vote")    return TXT.OUVERT+(j!=null && j>=0 ? TXT.CLOS_DANS+j+TXT.JOURS : "");
  if (f.statut==="attente_co")  return TXT.ATTENTE_CO_INFO;
  if (f.statut==="publiee")     return TXT.ATTENTE_REVUE;
  if (f.statut==="en_jeu")      return TXT.EN_JEU;
  return "clos";
}

function heroHead(f){
  var st = ST[f.statut], j = f.statut==="en_vote" ? m().joursRestants(f.fin) : null;
  var p = m().pseudo();
  var auteur = f.auteurs && Object.keys(f.auteurs).some(function(k){ return f.auteurs[k]===p; });
  var tags = '<span class="tdlev-tag est-etat">'+st.t+'</span>'
    + (j!=null && j>=0 ? '<span class="tdlev-tag qbm-ej-tag">J-'+j+'</span>' : "")
    + (f.avec ? '<span class="tdlev-tag qbm-avec" style="--sc:'+m().commuOf({com:f.avec}).c+'">× '+m().esc(m().commuOf({com:f.avec}).nom)+'</span>' : "");
  var stats = Object.keys(f.auteurs).map(function(k){
    return '<div class="tdlev-hero-s"><i class="fi '+IC.auteur+'"></i><b>'+m().esc(TXT.AUTEUR)+'</b><em>'+m().esc(f.auteurs[k])+'</em></div>';
  }).join("");
  var edit = (auteur && f.statut==="publiee")
    ? '<button class="tdlev-hero-cta est-second" data-act="editer" type="button">'+m().esc(TXT.EDITER_FICHE)+'</button>' : "";
  return '<div class="tdlev-hero est-fiche'+(f.img?" est-image":"")+'">'
    + (f.img ? '<div class="tdlev-hero-img" style="background-image:url(\''+m().esc(f.img)+'\')"></div>' : "")
    + '<div class="tdlev-hero-c">'
    + '<h2 class="tdlev-hero-titre">'+m().esc(f.nom)+'</h2>'
    + '<p class="tdlev-hero-sous">'+m().esc(TXT.DEPOSEE)+m().esc(m().ilya(f.cree))+'</p>'
    + '<div class="tdlev-hero-tags">'+tags+'</div>'
    + '</div>'
    + '<div class="tdlev-hero-d">'+edit+'<div class="tdlev-hero-stats">'+stats+'</div></div>'
    + '</div>';
}

function optRow(f, k, votable){
  var o = f.options[k], v = m().voixDe(f), total = v.tot || 1;
  var moi = m().pseudo() ? f.votes[m().cle(m().pseudo())] : null;
  var arm = M().S.arm[f.id+k];
  var right = '<span class="tdlev-opt-p">'+(v[k]||0)+' '+TXT.VOIX+'</span>';
  if (votable){
    right += moi
      ? '<span class="tdlev-etat est-ok">'+TXT.VOIX_CONSIGNEE+'</span>'
      : '<button class="tdlev-btn'+(arm?" est-second":"")+' qbm-vbtn" data-vote="'+f.id+':'+k+'" type="button">'+(arm?TXT.BTN_CONFIRMER:TXT.BTN_VOTER)+'</button>';
  }
  return '<div class="tdlev-opt qbm-opt" style="--c:'+m().commuOf(f).c+'">'
    + '<i class="fi '+IC.option+'"></i>'
    + '<span class="qbm-opttxt"><span class="tdlev-opt-n">Option '+k+' — '+m().esc(o.t)+'</span>'
    + '<span class="tdlev-opt-d">'+m().esc(o.d||"")+'</span>'
    + '<span class="qbm-vbar"><span class="qbm-vfill" style="width:'+Math.round(100*(v[k]||0)/total)+'%"></span></span></span>'
    + '<span class="qbm-optright">'+right+'</span>'
    + '</div>';
}

function oppRow(f){
  var opp = m().oppositionDe(f), moi = m().pseudo() ? f.votes[m().cle(m().pseudo())] : null;
  var counts = Object.keys(opp).map(function(k){ return m().esc(m().commuOf({com:k}).nom)+" "+opp[k]; }).join(" · ");
  var right = '<span class="tdlev-opt-p">'+(counts||TXT.AUCUNE_OPPOSITION)+'</span>';
  right += moi
    ? '<span class="tdlev-etat est-ok">'+TXT.OPPOSITION_CONSIGNEE+'</span>'
    : '<button class="tdlev-btn qbm-vbtn" data-vote="'+f.id+':opp" type="button">'+m().esc(TXT.BTN_VOTER)+'</button>';
  return '<div class="tdlev-opt qbm-opt qbm-opt-neutre">'
    + '<i class="fi '+IC.opposition+'"></i>'
    + '<span class="qbm-opttxt"><span class="tdlev-opt-n">'+m().esc(TXT.OPPOSITION)+'</span>'
    + '<span class="tdlev-opt-d">'+m().esc(TXT.OPPOSITION_D)+'</span></span>'
    + '<span class="qbm-optright">'+right+'</span>'
    + '</div>';
}

function consBlock(f){
  var cq = f.conseq || {};
  var nom = function(k){ return k==="paroisse" ? TXT.CONSEQ_PAROISSE : (k===BANDES_KEY ? IC.bande.nom : (COMMU[k] ? COMMU[k].nom : k)); };
  var ma = m().maCommu();
  var tabs = [];
  if (cq.paroisse) tabs.push("paroisse");
  if (ma && cq[ma]!==undefined) tabs.push(ma);
  if (m().estStaff()) Object.keys(cq).forEach(function(k){ if (k!=="paroisse" && tabs.indexOf(k)<0) tabs.push(k); });
  if (!tabs.length){
    return '<div class="qb-sec"><div class="qb-lab">'+m().esc(TXT.CONSEQ_TITRE)+'</div>'
      + '<div class="qb-empty">'+m().esc(TXT.CONSEQ_VIDE)+'</div></div>';
  }
  var cur = M().S.pov[f.id];
  if (tabs.indexOf(cur)<0) cur = tabs[0];
  var border = cur==="paroisse" || cur===BANDES_KEY ? "var(--dark2)" : m().commuOf({com:cur}).c;
  return '<div class="qb-sec"><div class="qb-lab">'+m().esc(TXT.CONSEQ_TITRE)+'</div>'
    + '<div class="tdlm-ptabs qbm-u-m04">'
    + tabs.map(function(k){ return '<button class="tdlm-ptab'+(k===cur?" on":"")+'" data-pov="'+f.id+':'+k+'" type="button">'+m().esc(nom(k))+'</button>'; }).join("")
    + '</div>'
    + '<div class="qb-asbox qbm-couche" style="--sc:'+border+'"><span class="qb-lab">'+m().esc(TXT.CONSEQ_TITRE)+' — '+m().esc(nom(cur))+'</span><p>'+m().esc(cq[cur]||"—")+'</p></div>'
    + (f.statut==="en_jeu" ? '<p class="qbm-note">'+m().esc(TXT.NOTE_CONSEQ_JEU)+'</p>' : "")
    + '</div>';
}

function detailHTML(f){
  if (!f) return '<button class="qbm-ret" data-act="ret" type="button">'+m().esc(TXT.RETOUR_LISTE)+'</button><div class="qb-empty">'+m().esc(TXT.CHOISIR)+'</div>';
  var h = '<button class="qbm-ret" data-act="ret" type="button">'+m().esc(TXT.RETOUR_LISTE)+'</button>' + heroHead(f);
  h += '<div class="qbm-fcorps">';
  h += '<div class="qb-sec qbm-u-mt20"><div class="tdlev-elem">'
    + elem(IC.cles.benef, TXT.VOIX && "Bénéficiaires", f.benef||"—")
    + elem(IC.cles.conflit, "Conflit d'intérêts", f.conflit||"—")
    + elem(IC.cles.abandon, "Abandon", f.abandon||"—")
    + '</div></div>';
  if (f.precisions && (f.statut==="publiee" || f.statut==="attente_co")){
    h += '<div class="qb-sec"><div class="qb-lab">'+m().esc(TXT.PRECISIONS_TITRE)+'</div>'
      + '<div class="qb-asbox qbm-u-avis"><p>'+m().esc(f.precisions)+'</p></div></div>';
  }
  h += '<div class="qb-sec"><div class="qb-lab">'+m().esc(TXT.CONTEXTES_TITRE)+'</div>'
    + pave(IC.paves.contexte, "Contexte", '<p class="tdlev-f-p">'+m().esc(f.probleme||"")+'</p>')
    + '<div class="qbm-pavgrid">'
    + pave(IC.paves.objectif, "Objectifs", '<ul class="tdlev-obj"><li>'+m().esc(f.objectif||"")+'</li></ul>')
    + pave(IC.paves.risque, "Risques", '<p class="tdlev-f-p">'+m().esc(f.risque||"")+'</p>')
    + '</div></div>';
  var votable = (f.statut==="en_vote");
  h += '<div class="qb-sec"><div class="qb-lab">'+m().esc(TXT.OPTIONS_TITRE)+'</div><div class="tdlev-opts">'
    + Object.keys(f.options).sort().map(function(k){ return optRow(f, k, votable); }).join("")
    + (f.avec && votable ? oppRow(f) : "")
    + '</div></div>';
  /* co-auteur d'une inter : confirmation sur la fiche même */
  if (f.statut==="attente_co"){
    var p = m().pseudo();
    var attends = p && Object.keys(f.auteurs).some(function(k){ return f.auteurs[k]===p; }) && !f.coConfirme;
    var expire = new Date(f.cree).getTime() + CFG.CO_JOURS*86400000 < Date.now();
    h += '<div class="qb-sec"><div class="qb-lab">'+m().esc(TXT.CO_TITRE)+'</div><div class="qb-asbox"><p>'
      + (attends && !expire
          ? m().esc(TXT.ATTEND_CO)
            + '<div class="qbm-u-mt10"><button class="tdlev-btn" data-act="coconfirme" type="button">'+m().esc(TXT.BTN_CONFIRME)+'</button></div>'
          : expire ? m().esc(TXT.CO_EXPIRE) : m().esc(TXT.CONFIRMATION))
      + '</p></div></div>';
  }
  if (f.resultat){
    h += '<div class="qb-sec"><div class="qb-lab">'+m().esc(TXT.RESOLU)+'</div><div class="qb-asbox"><p>'+m().esc(f.resultat)+'</p></div></div>';
  }
  if (f.statut==="en_jeu" || f.statut==="cloturee" || f.statut==="non_tranchee") h += consBlock(f);
  h += '</div>';
  return h;
}

/* ===================== BARRE ET BOUTONS ===================== */

function rendre(){
  var root = document.querySelector("#quais-app"); if (!root) return;
  renderLeft(root);
  var det = root.querySelector("#qb-detail");
  if (det) det.innerHTML = detailHTML(m().fiche(M().S.sel));
  poserCagnotte(root);
  ajusterBoutons(root);
}

function poserCagnotte(root){
  var bar = root.querySelector(".qb-bar"); if (!bar) return;
  var old = bar.querySelector(".qbm-cag"); if (old) old.remove();
  var com = m().maCommu(); if (!com) return;
  var eng = m().engagementDe(com);
  bar.querySelector(".qb-accueil").insertAdjacentHTML("afterend",
    '<span class="qbm-cag qbm-cagnotte"><i class="fi '+IC.cagnotte+'"></i>'
    + '<span class="qb-lab">'+m().esc(TXT.CAGNOTTE)+' '+m().esc(COMMU[com].nom)+'</span>'
    + '<b>'+m().money(m().cagnotteDe(com))+(eng?' <span class="qbm-u-petit">'+m().esc(TXT.ENGAGES)+' '+m().money(eng)+' '+m().esc(TXT.ENGAGES_SUITE)+'</span>':"")+'</b>'
    + '</span>');
}

/* « Gestion staff » et « Proposer une initiative » n'existent que sur La Marina */
function ajusterBoutons(root){
  var tgl = root.querySelector("#qb-stafftgl");
  var prop = root.querySelector("#qbm-propose");
  var on = root.querySelector(".qb-tab.qb-on");
  var surMarina = !!(on && on.getAttribute("data-tab")==="marina");
  if (tgl) tgl.hidden = !surMarina || !m().estStaff();
  if (prop) prop.hidden = !surMarina;
}

/* ===================== EXPORT ===================== */

window.MarinaPublic = {
  rendre:rendre, renderLeft:renderLeft, detailHTML:detailHTML,
  poserCagnotte:poserCagnotte, ajusterBoutons:ajusterBoutons, voteInfo:voteInfo,
  elem:elem, pave:pave
};

})();
