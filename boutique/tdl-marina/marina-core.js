/* THE DROWNED LANDS — LA MARINA · SOCLE + ONGLET PUBLIC · v1
 *
 * CE QUE CE FICHIER FAIT
 *   - CONTRAT : la forme d'une fiche du nœud racine marina_fiches ;
 *   - LECTURE : marina_fiches, membres (communauté, effectifs), cagnottes ;
 *   - DROITS  : staff FA, auteur, co-auteur, membre d'une communauté ;
 *   - DÉRIVÉS : voix par option, opposition par communauté, quorum,
 *              engagement (gel de cagnotte des fiches en vote), quota mensuel ;
 *   - RENDU   : l'onglet « La Marina » de la coque des Quais (colonne gauche
 *              + fiche détaillée), en module enregistré auprès de quais-core ;
 *   - VOTE    : une voix par membre, opposition par communauté ;
 *   - BARRE   : la cagnotte de la communauté du membre, nette des engagements.
 *
 * GEL (motif rep-det-main) : une fiche « en vote » engage son montant sur la
 * cagnotte de sa communauté (moitié de chaque côté pour une inter). Rien
 * n'est débité : la somme est affichée en moins, et le débit réel n'a lieu
 * qu'à la clôture du vote (marina-staff), par transaction.
 *
 * QUOTA (motif tdlhc-envoi) : rien ne se stocke par membre. On compte les
 * fiches du mois calendaire (YYYY-MM de f.cree) portant le pseudo comme
 * auteur et non classées sans suite.
 *
 * ÉVÉNEMENT : le passage « en jeu » crée la fiche dans evenements/
 * (contrat tdlev-core, schéma 2), origine "boutique", lien « Fiche boutique ».
 *
 * EXPOSE : window.Marina
 * DÉPEND DE : window.EcoCore, window.Quais (quais-core), window.TDLBase.
 * ORDRE : eco-core → tdl-base → quais-core → quais-comptoir/barge →
 *         ce fichier → marina-volet → marina-staff.
 */
(function () {
"use strict";

/* ===================== CONFIG ===================== */

var CFG = {
  NODE:        "marina_fiches",
  NODE_MEMBRES:"membres",
  NODE_CAGNOTTES:"cagnottes",
  NODE_EVENTS: "evenements",
  VOTE_JOURS:  7,
  CO_JOURS:    3,          /* confirmation du co-auteur d'une inter */
  PLAFOND:     0.5,        /* jamais plus de 50 % de la cagnotte nette */
  VEILLE_MS:  15000
};

/* Clés = libellés courts EcoCore (membres/<pseudo>/group, clés de cagnottes).
   NE PAS renommer sans migration des cagnottes. */
var COMMU = {
  "Les Goulipiats":  { nom:"Goulipiats", c:"var(--gr1-color)", icon:"fi-tr-house-flood" },
  "Les Fardoches":   { nom:"Fardoches",  c:"var(--gr2-color)", icon:"fi-tr-bolt" },
  "Les Ashlanders":  { nom:"Ashlanders", c:"var(--gr3-color)", icon:"fi-tr-crystal-ball" },
  "Les Spectres":    { nom:"Spectres de Baron Samedi", c:"var(--gr4-color)", icon:"fi-tr-cocktail" },
  "Les Perles":      { nom:"Perles de Cocodrie", c:"var(--gr5-color)", icon:"fi-tr-box" }
};
var BANDES_KEY = "bandes";   /* case « Bandes hors la loi » des conséquences */

var TYPES = {
  faveur:  { lab:"Petite faveur",         m:500,  ic:"fi-tr-cocktail" },
  dossier: { lab:"Dossier communautaire", m:1000, ic:"fi-tr-marketplace-store" },
  oeuvre:  { lab:"Grand œuvre",           m:2000, ic:"fi-tr-ship" },
  inter:   { lab:"Intercommunautaire",    m:2000, ic:"fi-tr-arrows-repeat", split:1000 }
};

var ST = {
  attente_co:    { t:"En attente de co-auteur", c:"var(--gr4-color)" },
  publiee:       { t:"En attente",             c:"var(--gr3-color)" },
  en_vote:       { t:"En vote",                c:"var(--gr1-color)" },
  en_jeu:        { t:"En jeu",                 c:"var(--gr5-color)" },
  cloturee:      { t:"Clôturée",               c:"var(--gr2-color)" },
  non_tranchee:  { t:"Non tranchée",           c:"var(--dark2)" }
};

var TXT = {
  VIDE:      "Rien par ici — l'eau est calme.",
  CHOISIR:   "Choisissez une initiative dans la colonne de gauche.",
  VOTE_OK:   "Voix consignée. Égalité : un dé tranche, tiré en public.",
  OPP_OK:    "Opposition consignée — une seule communauté majoritairement opposée bloque tout.",
  DEJA:      "Vous avez déjà voté sur cette initiative.",
  CONFIRMEE: "Co-authorat confirmé — la fiche part en relecture staff.",
  CO_EXPIRE: "Le délai de confirmation de 3 jours est dépassé."
};

/* ===================== UTILS ===================== */

function E(){ return window.EcoCore; }
function B(){ return window.TDLBase; }
function Q(){ return window.Quais; }

function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
function money(n){ return (typeof n==="number"?n.toLocaleString("fr-FR").replace(/\u202f/g," "):n)+" $"; }
function cle(s){ return B() && B().clePseudo ? B().clePseudo(s) : String(s||"").replace(/[.$#\[\]\/]/g,"_"); }
function vt(v){ return !v ? [] : (Array.isArray(v) ? v : Object.keys(v).map(function(k){ return v[k]; })); }
function cles(v){ return (v && typeof v==="object") ? Object.keys(v) : []; }
function mois(d){ var x = new Date(d); return x.getFullYear() + "-" + ("0"+(x.getMonth()+1)).slice(-2); }
function ilya(iso){
  if (!iso) return "";
  var j = Math.floor((Date.now() - new Date(iso).getTime())/86400000);
  if (j <= 0) return "à l'instant";
  if (j === 1) return "hier";
  return "il y a " + j + " jours";
}
function joursRestants(iso){ return iso ? Math.ceil((new Date(iso).getTime()-Date.now())/86400000) : null; }
function plein(v){ return String(v==null?"":v).trim().length > 0; }

function pseudo(){
  try { return E() && E().getPseudo ? E().getPseudo() : null; } catch(e){ return null; }
}
function estStaff(){
  try { var g = window._userdata && window._userdata.user_level; return g===1 || g===2; } catch(e){ return false; }
}

function toast(msg){
  var t = document.querySelector("#marina-toast");
  if (!t){
    t = document.createElement("div"); t.id = "marina-toast"; t.className = "tdlhc-toast";
    document.body.appendChild(t);
  }
  t.textContent = msg; t.classList.add("on");
  clearTimeout(toast._h);
  toast._h = setTimeout(function(){ t.classList.remove("on"); }, 3000);
}

/* ===================== ÉTAT ===================== */

var D = { fiches:{}, membres:{}, cagnottes:{} };   /* brut firebase */
var S = { cat:"solo", sel:null, pov:{}, arm:{} };  /* rendu public */

function fiche(id){ return D.fiches[id] || null; }
function commuOf(f){ return COMMU[f && f.com] || { nom:"—", c:"var(--dark2)", icon:"fi-tr-anchor" }; }

/* ===================== NORMALISATION ===================== */

var SCHEMA = 1;

function normaliser(o){
  o = o || {};
  o.schema   = SCHEMA;
  o.type     = TYPES[o.type] ? o.type : "dossier";
  o.nom      = o.nom || "(sans titre)";
  o.com      = COMMU[o.com] ? o.com : "";
  o.avec     = COMMU[o.avec] ? o.avec : null;
  o.montant  = (o.montant|0) || TYPES[o.type].m;
  o.img      = o.img || "";
  o.auteurs  = o.auteurs || {};                      /* nœud à clés : clePseudo → pseudo */
  o.statut   = ST[o.statut] ? o.statut : "publiee";
  o.cree     = o.cree || "";
  o.ouverte  = o.ouverte || "";
  o.fin      = o.fin || "";
  o.votes    = o.votes || {};                        /* clePseudo → 'A'/'B'/'C'/'opp' */
  o.options  = o.options || {};                      /* 'A'/'B'/'C' → {t, d, v?} */
  if (!cles(o.options).length) o.options = { A:{t:"",d:""}, B:{t:"",d:""} };
  o.conseq   = o.conseq || {};
  o.resultat = o.resultat || "";
  o.precisions = o.precisions || "";
  o.event    = o.event || "";                        /* id de la fiche evenements/ */
  return o;
}

/* ===================== DÉRIVÉS ===================== */

function listeFiches(){
  return cles(D.fiches).map(function(id){ var o = normaliser(D.fiches[id]); o.id = id; return o; })
    .sort(function(a,b){ return String(b.cree).localeCompare(String(a.cree)); });
}
function active(f){ return f.statut!=="cloturee" && f.statut!=="non_tranchee"; }
function fichesOf(cat){
  return listeFiches().filter(function(f){
    if (cat==="done")   return !active(f);
    if (cat==="inter")  return !!f.avec && active(f);
    return !f.avec && active(f);
  });
}

/* effetifs d'une communauté : membres dont le groupe porte le libellé court */
function effDe(com){
  var n = 0;
  Object.keys(D.membres || {}).forEach(function(p){
    var g = String((D.membres[p]||{}).group || "");
    if (com && g.indexOf(com) > -1) n++;
  });
  return n;
}
function maCommu(){
  var p = pseudo(); if (!p) return null;
  var g = String(((D.membres||{})[p]||{}).group || "");
  var trouve = null;
  Object.keys(COMMU).forEach(function(k){ if (g.indexOf(k) > -1) trouve = k; });
  return trouve;
}

/* voix par option : issues du nœud votes, jamais stockées */
function voixDe(f){
  var v = { tot:0 };
  cles(f.options).forEach(function(k){ v[k] = 0; });
  cles(f.votes).forEach(function(p){
    var x = f.votes[p];
    if (v[x] !== undefined){ v[x]++; v.tot++; }
  });
  return v;
}
function oppositionDe(f){
  var opp = {};
  cles(f.votes).forEach(function(p){
    if (f.votes[p]!=="opp") return;
    var g = String(((D.membres||{})[p]||{}).group || "");
    Object.keys(COMMU).forEach(function(k){ if (g.indexOf(k) > -1) opp[k] = (opp[k]||0)+1; });
  });
  return opp;
}
function quorumDe(f){
  var eff = f.avec ? Math.max(effDe(f.com), 1) : effDe(f.com);
  if (f.avec) eff = Math.max(eff, effDe(f.avec));   /* inter : côté le plus fourni */
  return eff < 7 ? 3 : Math.ceil(eff/2);
}

/* engagement (gel) : ce que les fiches en vote retiennent sur une cagnotte */
function engagementDe(com){
  var t = 0;
  listeFiches().forEach(function(f){
    if (f.statut!=="en_vote") return;
    if (f.avec) { if (f.com===com || f.avec===com) t += (f.montant/2)|0; }
    else if (f.com===com) t += f.montant|0;
  });
  return t;
}
function cagnotteDe(com){ return ((D.cagnottes||{})[com]|0) || 0; }
function cagnotteNette(com){ return Math.max(0, cagnotteDe(com) - engagementDe(com)); }

/* quota du mois calendaire : compté, jamais stocké (motif tdlhc-envoi) */
function quotaDe(p){
  var per = mois(Date.now()), n = 0;
  listeFiches().forEach(function(f){
    if (f.statut==="non_tranchee") return;
    if (mois(f.cree)!==per) return;
    if (Object.keys(f.auteurs).some(function(k){ return f.auteurs[k]===p; })) n++;
  });
  return { n:n, max:1 };
}

/* ===================== CHARGEMENT / VEILLE ===================== */

var VEILLE = null;

function charger(){
  return Promise.all([
    Promise.resolve(E().firebaseGet(CFG.NODE)).catch(function(){ return {}; }),
    Promise.resolve(E().firebaseGet(CFG.NODE_MEMBRES)).catch(function(){ return {}; }),
    Promise.resolve(E().firebaseGet(CFG.NODE_CAGNOTTES)).catch(function(){ return {}; })
  ]).then(function(r){
    D.fiches = r[0] || {}; D.membres = r[1] || {}; D.cagnottes = r[2] || {};
    if (!S.sel || !D.fiches[S.sel]){
      var l = fichesOf(S.cat);
      S.sel = l.length ? l[0].id : null;
    }
  });
}

function veiller(){
  if (!B() || !B().suivre || VEILLE) return;
  VEILLE = B().suivre({
    node: CFG.NODE, rev: true, ms: CFG.VEILLE_MS,
    occupe: function(){ return !!(document.querySelector("#marina-volet.on") || document.querySelector("#marina-staff:not([hidden])")); },
    onEntrees: function(){ reprendre(); }
  });
}
function reprendre(){
  charger().then(function(){ rendre(); if (window.MarinaStaff) MarinaStaff.absorber(); }).catch(function(){});
}

/* ===================== RENDU : COLONNE GAUCHE ===================== */

function bands(){
  var defs = [
    { k:"solo", icon:"fi-tr-house-flood",   lab:"Internes",   c:"var(--gr2-color)" },
    { k:"inter",icon:"fi-tr-arrows-repeat", lab:"Inter",      c:"var(--gr5-color)" },
    { k:"done", icon:"fi-tr-clipboard-check",lab:"Terminées", c:"var(--darkopa6)" }
  ];
  return '<div class="qb-bandgrid qbm-bands">' + defs.map(function(d){
    return '<button class="qb-bandcell'+(S.cat===d.k?" qb-on":"")+'" data-cat="'+d.k+'" style="--c:'+d.c+'" type="button">'
      + '<i class="fi '+d.icon+'"></i><span class="qb-bcell"><span>'+d.lab+'</span><em class="qbm-bn">'+fichesOf(d.k).length+'</em></span></button>';
  }).join("") + '</div>';
}

function row(f){
  var st = ST[f.statut], j = f.statut==="en_vote" ? joursRestants(f.fin) : null;
  return '<button class="tdlev-e qbm-e" aria-current="'+(S.sel===f.id)+'" style="--c:'+commuOf(f).c+'" data-f="'+f.id+'" type="button">'
    + '<span class="qbm-eimg"'+(f.img?' style="background-image:url(\''+esc(f.img)+'\')"':'')+'>'
    + (f.img?'':'<i class="fi '+commuOf(f).icon+'"></i>')+'</span>'
    + '<span>'
    + '<span class="qbm-eline"><span class="tdlev-marq" style="background:'+st.c+'">'+st.t+'</span>'
    + '<span class="tdlev-e-t">'+esc(f.nom)+'</span></span>'
    + (j!=null && j>=0 ? '<span class="qbm-emeta"><span class="qbm-ej">J-'+j+'</span></span>' : '')
    + '</span>'
    + '<span class="qb-cp">'+money(f.montant)+'</span>'
    + '</button>';
}

function renderLeft(root){
  var left = root.querySelector("#qb-left"); if (!left) return;
  var list = fichesOf(S.cat);
  left.innerHTML = bands()
    + (list.length ? '<div class="tdlev-liste" style="overflow:visible">' + list.map(row).join("") + '</div>'
                   : '<div class="tdlev-vide">'+TXT.VIDE+'</div>');
}

/* ===================== RENDU : FICHE DÉTAILLÉE ===================== */

function elem(icon, k, v){
  return '<div><span class="tdlev-elem-k"><i class="fi '+icon+'"></i>'+esc(k)+'</span><p class="tdlev-elem-v">'+esc(v)+'</p></div>';
}
function pave(icon, titre, corps){
  var ico = icon.indexOf("fi-sr-")===0 ? icon : icon.replace("fi-tr-","fi-sr-");
  return '<section class="tdlev-pave"><i class="fi '+ico+' tdlev-pave-ico"></i>'
    + '<div class="tdlev-pave-tete"><h4 class="tdlev-pave-h">'+esc(titre)+'</h4></div>'
    + '<div class="tdlev-pave-c">'+corps+'</div></section>';
}
function voteInfo(f){
  var j = joursRestants(f.fin);
  if (f.statut==="en_vote")   return "ouvert"+(j!=null && j>=0 ? " — clos dans "+j+" jours" : "");
  if (f.statut==="attente_co") return "en attente du co-auteur";
  if (f.statut==="publiee")    return "ouvre après revue du staff";
  if (f.statut==="en_jeu")     return "résolu — fonds engagés";
  return "clos";
}

function heroHead(f){
  var st = ST[f.statut], j = f.statut==="en_vote" ? joursRestants(f.fin) : null;
  var p = pseudo();
  var auteur = f.auteurs && Object.keys(f.auteurs).some(function(k){ return f.auteurs[k]===p; });
  var tags = '<span class="tdlev-tag est-etat">'+st.t+'</span>'
    + (j!=null && j>=0 ? '<span class="tdlev-tag qbm-ej-tag">J-'+j+'</span>' : '')
    + (f.avec ? '<span class="tdlev-tag qbm-avec" style="--sc:'+commuOf({com:f.avec}).c+'">× '+commuOf({com:f.avec}).nom+'</span>' : '');
  var stats = Object.keys(f.auteurs).map(function(k){
    return '<div class="tdlev-hero-s"><i class="fi fi-tr-comment-user"></i><b>Auteur</b><em>'+esc(f.auteurs[k])+'</em></div>';
  }).join("");
  var edit = (auteur && f.statut==="publiee")
    ? '<button class="tdlev-hero-cta est-second" data-act="editer" type="button">Éditer la fiche</button>' : "";
  return '<div class="tdlev-hero est-fiche'+(f.img?" est-image":"")+'">'
    + (f.img ? '<div class="tdlev-hero-img" style="background-image:url(\''+esc(f.img)+'\')"></div>' : "")
    + '<div class="tdlev-hero-c">'
    + '<h2 class="tdlev-hero-titre">'+esc(f.nom)+'</h2>'
    + '<p class="tdlev-hero-sous">Déposée '+esc(ilya(f.cree))+'</p>'
    + '<div class="tdlev-hero-tags">'+tags+'</div>'
    + '</div>'
    + '<div class="tdlev-hero-d">'+edit+'<div class="tdlev-hero-stats">'+stats+'</div></div>'
    + '</div>';
}

function optRow(f, k, votable){
  var o = f.options[k], v = voixDe(f), total = v.tot || 1;
  var moi = pseudo() ? f.votes[cle(pseudo())] : null;
  var arm = S.arm[f.id+k];
  var right = '<span class="tdlev-opt-p">'+(v[k]||0)+' voix</span>';
  if (votable){
    right += moi
      ? '<span class="tdlev-etat est-ok">voix consignée</span>'
      : '<button class="tdlev-btn'+(arm?" est-second":"")+' qbm-vbtn" data-vote="'+f.id+':'+k+'" type="button">'+(arm?"Confirmer ?":"Voter")+'</button>';
  }
  return '<div class="tdlev-opt qbm-opt" style="--c:'+commuOf(f).c+'">'
    + '<i class="fi fi-tr-box"></i>'
    + '<span class="qbm-opttxt"><span class="tdlev-opt-n">Option '+k+' — '+esc(o.t)+'</span>'
    + '<span class="tdlev-opt-d">'+esc(o.d||"")+'</span>'
    + '<span class="qbm-vbar"><span class="qbm-vfill" style="width:'+Math.round(100*(v[k]||0)/total)+'%"></span></span></span>'
    + '<span class="qbm-optright">'+right+'</span>'
    + '</div>';
}

function oppRow(f){
  var opp = oppositionDe(f), moi = pseudo() ? f.votes[cle(pseudo())] : null;
  var counts = Object.keys(opp).map(function(k){ return commuOf({com:k}).nom+" "+opp[k]; }).join(" · ");
  var right = '<span class="tdlev-opt-p">'+(counts||"aucune")+'</span>';
  right += moi
    ? '<span class="tdlev-etat est-ok">opposition consignée</span>'
    : '<button class="tdlev-btn qbm-vbtn" data-vote="'+f.id+':opp" type="button">Voter</button>';
  return '<div class="tdlev-opt qbm-opt" style="--c:var(--dark2)">'
    + '<i class="fi fi-tr-diamond-exclamation"></i>'
    + '<span class="qbm-opttxt"><span class="tdlev-opt-n">S\'y opposer</span>'
    + '<span class="tdlev-opt-d">Ne finance rien : bloque le lancement. Comptée par communauté.</span></span>'
    + '<span class="qbm-optright">'+right+'</span>'
    + '</div>';
}

function consBlock(f){
  var cq = f.conseq || {};
  var nom = function(k){ return k==="paroisse" ? "Par toute la paroisse" : (k===BANDES_KEY ? "Bandes hors la loi" : (COMMU[k] ? COMMU[k].nom : k)); };
  var ma = maCommu();
  var tabs = [];
  if (cq.paroisse) tabs.push("paroisse");
  if (ma && cq[ma]!==undefined) tabs.push(ma);
  if (estStaff()) cles(cq).forEach(function(k){ if (k!=="paroisse" && tabs.indexOf(k)<0) tabs.push(k); });
  if (!tabs.length){
    return '<div class="qb-sec"><div class="qb-lab">Conséquences connues</div>'
      + '<div class="qb-empty">Les conséquences se rédigent à la clôture — selon qui doit les savoir.</div></div>';
  }
  var cur = S.pov[f.id];
  if (tabs.indexOf(cur)<0) cur = tabs[0];
  var border = cur==="paroisse" || cur===BANDES_KEY ? "var(--dark2)" : commuOf({com:cur}).c;
  return '<div class="qb-sec"><div class="qb-lab">Conséquences connues</div>'
    + '<div class="tdlm-ptabs" style="margin:0 0 4px">'
    + tabs.map(function(k){ return '<button class="tdlm-ptab'+(k===cur?" on":"")+'" data-pov="'+f.id+':'+k+'" type="button">'+esc(nom(k))+'</button>'; }).join("")
    + '</div>'
    + '<div class="qb-asbox qbm-couche" style="--sc:'+border+'"><span class="qb-lab">Conséquences connues — '+esc(nom(cur))+'</span><p>'+esc(cq[cur]||"—")+'</p></div>'
    + (f.statut==="en_jeu" ? '<p class="qbm-note">Conséquences générales publiées 7 à 10 jours après le vote. Les suites s\'éditeront quand les RP rattachés se clôtureront.</p>' : "")
    + '</div>';
}

function detailHTML(f){
  if (!f) return '<button class="qbm-ret" data-act="ret" type="button">← Les initiatives</button><div class="qb-empty">'+TXT.CHOISIR+'</div>';
  var h = '<button class="qbm-ret" data-act="ret" type="button">← Les initiatives</button>' + heroHead(f);
  h += '<div class="qbm-fcorps">';
  h += '<div class="qb-sec" style="margin-top:20px"><div class="tdlev-elem">'
    + elem("fi-sr-hand-present","Bénéficiaires", f.benef||"—")
    + elem("fi-tr-balance-scale-left","Conflit d'intérêts", f.conflit||"—")
    + elem("fi-tr-diamond-exclamation","Abandon", f.abandon||"—")
    + '</div></div>';
  if (f.precisions && (f.statut==="publiee" || f.statut==="attente_co")){
    h += '<div class="qb-sec"><div class="qb-lab">Précisions demandées par le staff</div>'
      + '<div class="qb-asbox" style="border-left:3px solid var(--gr1-color)"><p>'+esc(f.precisions)+'</p></div></div>';
  }
  h += '<div class="qb-sec"><div class="qb-lab">Contexte de l\'initiative</div>'
    + pave("fi-tr-house-flood","Contexte",'<p class="tdlev-f-p">'+esc(f.probleme||"")+'</p>')
    + '<div class="qbm-pavgrid">'
    + pave("fi-tr-bullseye","Objectifs",'<ul class="tdlev-obj"><li>'+esc(f.objectif||"")+'</li></ul>')
    + pave("fi-tr-diamond-exclamation","Risques",'<p class="tdlev-f-p">'+esc(f.risque||"")+'</p>')
    + '</div></div>';
  var votable = (f.statut==="en_vote");
  h += '<div class="qb-sec"><div class="qb-lab">Les options soumises au vote</div><div class="tdlev-opts">'
    + cles(f.options).sort().map(function(k){ return optRow(f, k, votable); }).join("")
    + (f.avec && votable ? oppRow(f) : "")
    + '</div></div>';
  /* co-auteur d'une inter : confirmation sur la fiche même */
  if (f.statut==="attente_co"){
    var p = pseudo();
    var attends = p && Object.keys(f.auteurs).some(function(k){ return f.auteurs[k]===p; }) && !f.coConfirme;
    var expire = new Date(f.cree).getTime() + CFG.CO_JOURS*86400000 < Date.now();
    h += '<div class="qb-sec"><div class="qb-lab">Co-authorat</div><div class="qb-asbox"><p>'
      + (attends && !expire
          ? 'La fiche attend votre confirmation de co-auteur.'
            + '<div style="margin-top:10px"><button class="tdlev-btn" data-act="coconfirme" type="button">Confirmer le co-authorat</button></div>'
          : expire ? TXT.CO_EXPIRE : 'Confirmation attendue du co-auteur — délai de '+CFG.CO_JOURS+' jours.')
      + '</p></div></div>';
  }
  if (f.resultat){
    h += '<div class="qb-sec"><div class="qb-lab">Résolu</div><div class="qb-asbox"><p>'+esc(f.resultat)+'</p></div></div>';
  }
  if (f.statut==="en_jeu" || f.statut==="cloturee" || f.statut==="non_tranchee") h += consBlock(f);
  h += '</div>';
  return h;
}

/* ===================== VOTE ===================== */

function tryVote(fid, key){
  var f = fiche(fid); if (!f) return;
  var p = pseudo();
  if (!p){ toast("Connecte-toi pour voter."); return; }
  if (f.statut!=="en_vote"){ toast("Le vote n'est pas ouvert."); return; }
  var k = cle(p);
  if (f.votes && f.votes[k] && f.votes[k]!==key){ toast(TXT.DEJA); return; }
  var maj = {}; maj[CFG.NODE+"/"+fid+"/votes/"+k] = key;
  Promise.resolve(E().firebaseUpdate(maj)).then(function(){
    toast(key==="opp" ? TXT.OPP_OK : TXT.VOTE_OK);
    reprendre();
  }).catch(function(){ toast("L'envoi a échoué — réessaie."); });
}

function confirmerCo(fid){
  var p = pseudo(); if (!p) return;
  var maj = {};
  maj[CFG.NODE+"/"+fid+"/coConfirme"] = new Date().toISOString();
  maj[CFG.NODE+"/"+fid+"/statut"] = "publiee";
  Promise.resolve(E().firebaseUpdate(maj)).then(function(){ toast(TXT.CONFIRMEE); reprendre(); })
    .catch(function(){ toast("L'envoi a échoué."); });
}

/* ===================== MODULE QUAIS ===================== */

function rendre(){
  var root = document.querySelector("#quais-app"); if (!root) return;
  renderLeft(root);
  var det = root.querySelector("#qb-detail");
  if (det) det.innerHTML = detailHTML(fiche(S.sel));
  poserCagnotte(root);
  ajusterBoutons(root);
}

function poserCagnotte(root){
  var bar = root.querySelector(".qb-bar"); if (!bar) return;
  var old = bar.querySelector(".qbm-cag"); if (old) old.remove();
  var com = maCommu(); if (!com) return;
  var eng = engagementDe(com);
  bar.querySelector(".qb-accueil").insertAdjacentHTML("afterend",
    '<span class="qbm-cag qbm-cagnotte"><i class="fi fi-sr-hand-present"></i>'
    + '<span class="qb-lab">Cagnotte '+esc(COMMU[com].nom)+'</span>'
    + '<b>'+money(cagnotteDe(com))+(eng?' <span style="font-size:11px;color:var(--darkopa6)">dont '+money(eng)+' engagés</span>':"")+'</b>'
    + '</span>');
}

/* « Gestion staff » et « Proposer une initiative » n'existent que sur La Marina */
function ajusterBoutons(root){
  var tgl = root.querySelector("#qb-stafftgl");
  var prop = root.querySelector("#qbm-propose");
  /* l'onglet actif se lit dans la coque : bouton .qb-tab.qb-on */
  var on = root.querySelector(".qb-tab.qb-on");
  var surMarina = !!(on && on.getAttribute("data-tab")==="marina");
  if (tgl) tgl.hidden = !surMarina || !estStaff();
  if (prop) prop.hidden = !surMarina;
}

/* ===================== ÉVÉNEMENT (bascule en jeu) ===================== */

/* Crée la fiche evenements/ du contrat tdlev (schéma 2), origine boutique.
   Le lien « Fiche boutique » pose l'id Marina : son affichage côté tdlev
   demandera la petite modif prévue par ailleurs. */
function creerEvenement(f){
  var id = B() && B().nouvelleCle ? B().nouvelleCle() : ("ev"+Date.now().toString(36));
  var ev = {
    schema: 2,
    origine: "boutique",
    categorie: "communautaire",
    titre: f.nom,
    sous: "Initiative votée à la Marina",
    periode: "",
    contexte: [f.probleme||""],
    objectifs: [f.objectif||""],
    portees: (function(){ var p = {}; p[cle(f.com)] = { nom:f.com }; if (f.avec) p[cle(f.avec)] = { nom:f.avec }; return p; })(),
    statut: "en_cours",
    ouvert: false,
    visibilite: "publique",
    elements: {}, faits: {},
    ampleur: true,
    consequences: [],
    liens: { fiche_boutique: { id: f.id, label: "Fiche boutique" } },
    rps: {}, participants: {}, retenus: {}, rappels: {},
    referent: Object.keys(f.auteurs)[0] ? f.auteurs[Object.keys(f.auteurs)[0]] : "",
    cree: new Date().toISOString()
  };
  var maj = {};
  maj[CFG.NODE_EVENTS+"/"+id] = ev;
  maj[CFG.NODE+"/"+f.id+"/event"] = id;
  return Promise.resolve(E().firebaseUpdate(maj)).then(function(){ return id; });
}

/* Notifications sos-emi-notif — plage 240+, à déclarer dans sos-emi-notif :
   240 nouvelle fiche (staff) · 241 vote ouvert (auteurs) · 242 précisions
   demandées (auteurs) · 243 clôture (auteurs) · 244 co-authorat à confirmer. */
var NOTIF = { NOUVELLE:240, VOTE:241, PRECISIONS:242, CLOTURE:243, CO:244 };
function notifier(code, dest, vars, ref){
  try {
    if (!window.EcoNotif) return;
    if (!dest || dest==="staff") EcoNotif.staff(code, vars, ref);
    else EcoNotif.a(dest, code, vars, ref);
  } catch(e){}
}

/* ===================== ACCROCHES DOM ===================== */

function brancher(){
  document.addEventListener("click", function(e){
    var t = e.target, el;
    if ((el = t.closest("[data-vote]"))){
      var p = el.getAttribute("data-vote").split(":");
      var f = fiche(p[0]);
      if (p[1]==="opp"){
        tryVote(p[0], "opp");
      } else if (!S.arm[p[0]+p[1]]){
        S.arm[p[0]+p[1]] = true;
        rendre();
        setTimeout(function(){
          if (S.arm[p[0]+p[1]]){ delete S.arm[p[0]+p[1]]; rendre(); }
        }, 3500);
      } else {
        delete S.arm[p[0]+p[1]];
        tryVote(p[0], p[1]);
      }
      return;
    }
    if ((el = t.closest("[data-cat]"))){
      S.cat = el.getAttribute("data-cat");
      var l = fichesOf(S.cat);
      if (!l.some(function(f){ return f.id===S.sel; })) S.sel = l.length ? l[0].id : null;
      rendre();
      return;
    }
    if ((el = t.closest("[data-f]"))){ S.sel = el.getAttribute("data-f"); rendre(); return; }
    if ((el = t.closest("[data-pov]"))){
      var q = el.getAttribute("data-pov").split(":");
      S.pov[q[0]] = q[1]; rendre(); return;
    }
    if (t.closest('[data-act="coconfirme"]')){ confirmerCo(S.sel); return; }
    if (t.closest('[data-act="editer"]')){
      if (window.MarinaVolet) MarinaVolet.ouvrir(S.sel);
      return;
    }
    if (t.closest("#qbm-propose")){
      if (window.MarinaVolet) MarinaVolet.ouvrir(null);
      return;
    }
    if (t.closest('[data-act="ret"]')){
      var root = document.querySelector("#quais-app");
      if (root) root.querySelector("#qb-main").classList.remove("qbm-focus");
      rendre(); return;
    }
  });
}

/* ===================== ENREGISTREMENT AUPRÈS DE QUAIS-CORE ===================== */

function quandQuais(){
  if (!(window.Quais && window.Quais.register && window.EcoCore && window.EcoCore.firebaseGet)) return false;
  window.Quais.register({
    key:"marina", label:"La Marina", sub:"boutique communautaire",
    icon:"fi fi-tr-anchor", mode:"grid", leftW:"450px", cols:2,
    cats: [
      { k:"solo", l:"Internes",  ic:"fi fi-tr-house-flood" },
      { k:"inter",l:"Inter",     ic:"fi fi-tr-arrows-repeat" },
      { k:"done", l:"Terminées", ic:"fi fi-tr-clipboard-check" }
    ],
    data:{},
    detail: function(id){ return detailHTML(fiche(S.sel || id)); },
    emptyDetail: function(){ return detailHTML(fiche(S.sel)); },
    wire: function(){
      /* la coque vient de se rendre : la Marina reprend la main sur la
         colonne gauche, la fiche, la cagnotte et ses deux boutons */
      if (!document.querySelector("#qbm-propose")){
        var tabs = document.querySelector("#qb-tabs");
        if (tabs) tabs.insertAdjacentHTML("beforeend",
          '<button class="tdlev-txt-btn est-plein" id="qbm-propose" type="button"><i class="fi fi-tr-add"></i><span>Proposer une initiative</span></button>');
      }
      rendre();
      /* le toggle staff de la coque ouvre le panneau Marina, pas l'édition
         d'items de la boutique : on garde notre propre vue, la coque garde
         la sienne (elle ne rend que des cartes d'items) */
      var tgl = document.querySelector("#qb-stafftgl");
      if (tgl && !tgl._marina){
        tgl._marina = true;
        tgl.addEventListener("click", function(){
          setTimeout(function(){
            if (window.MarinaStaff){
              if (!MarinaStaff.S.ouvert) MarinaStaff.ouvrir();
              else MarinaStaff.fermer();
            }
          }, 0);
        });
      }
    }
  });
  return true;
}

/* La coque se re-rend à chaque achat ou changement d'onglet : les deux boutons
   de la Marina doivent disparaître quand un autre onglet est actif. */
function observerBoutons(){
  var root = document.querySelector("#quais-app"); if (!root) return false;
  var obs = new MutationObserver(function(){ ajusterBoutons(root); });
  obs.observe(root, { childList:true, subtree:true });
  return true;
}

function demarrer(){
  var n = 0;
  (function attendre(){
    if (quandQuais()){
      brancher();
      charger().then(function(){ veiller(); rendre(); }).catch(function(){});
      var m = 0;
      (function attendreRoot(){
        if (observerBoutons()) return;
        if (++m > 60) return;
        setTimeout(attendreRoot, 250);
      })();
      return;
    }
    if (++n > 80){ if (window.console) console.warn("[Marina] quais-core ou eco-core absent."); return; }
    setTimeout(attendre, 250);
  })();
}

/* ===================== EXPORT ===================== */

window.Marina = {
  CFG:CFG, TYPES:TYPES, COMMU:COMMU, ST:ST, BANDES_KEY:BANDES_KEY,
  esc:esc, money:money, cle:cle, ilya:ilya, joursRestants:joursRestants, toast:toast,
  estStaff:estStaff, pseudo:pseudo, maCommu:maCommu, commuOf:commuOf,
  elem:elem, pave:pave,
  normaliser:normaliser, listeFiches:listeFiches, fichesOf:fichesOf, fiche:fiche, active:active,
  voixDe:voixDe, oppositionDe:oppositionDe, quorumDe:quorumDe, effDe:effDe,
  engagementDe:engagementDe, cagnotteDe:cagnotteDe, cagnotteNette:cagnotteNette,
  quotaDe:quotaDe, creerEvenement:creerEvenement,
  notifier:notifier, NOTIF:NOTIF,
  reprendre:reprendre, rendre:rendre, detailHTML:detailHTML, S:S, D:D
};

if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", demarrer); else demarrer();

})();
