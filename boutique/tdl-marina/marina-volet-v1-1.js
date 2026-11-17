/* THE DROWNED LANDS — LA MARINA · SOCLE + ONGLET PUBLIC · v1
 *
 * CE QUE CE FICHIER FAIT
 *   - CONTRAT : la forme d'une fiche du nœud racine marina_fiches ;
 *   - LECTURE : marina_fiches, membres (communauté, effectifs), cagnottes ;
 *   - DROITS  : staff FA, auteur, co-auteur, membre d'une communauté ;
 *   - DÉRIVÉS : voix par option, opposition par communauté, quorum,
 *              engagement (gel de cagnotte des fiches en vote), quota mensuel ;
 *   - RENDU   : délégué à marina-public (module enregistré auprès de quais-core).
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
 *         marina-config → ce fichier → marina-public → marina-volet → marina-staff.
 */
(function () {
"use strict";

var T0 = Date.now();   /* repère pour la grâce d'enregistrement (onglet n°3) */

/* ===================== CONFIG (window.MarinaConfig) ===================== */

var MC = window.MarinaConfig;
var CFG = MC.CFG, COMMU = MC.COMMU, BANDES_KEY = MC.BANDES_KEY,
    TYPES = MC.TYPES, ST = MC.ST, TXT = MC.TEXTES.CORE,
    ICONES = MC.ICONES;
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
function commuOf(f){ return COMMU[f && f.com] || MC.COMMU_DEFAUT; }

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

/* Conséquences : nœud séparé marina_conseq, filtré CÔTÉ SERVEUR par les
   règles (paroisse pour tous, sa communauté pour un membre, tout pour le
   staff). Les lectures refusées (case d'un autre groupe) sont silencieuses. */
function chargerConseq(){
  var node = CFG.NODE_CONSEQ;
  if (estStaff()){
    return Promise.resolve(E().firebaseGet(node)).catch(function(){ return {}; })
      .then(function(t){ return t || {}; });
  }
  var ma = maCommu();
  var cles = ["paroisse"].concat(ma ? [ma] : []).concat([BANDES_KEY]);
  var ids = Object.keys(D.fiches);
  return Promise.all(ids.map(function(id){
    return Promise.all(cles.map(function(k){
      return Promise.resolve(E().firebaseGet(node + "/" + id + "/" + k))
        .catch(function(){ return null; })
        .then(function(v){ return v==null ? null : [k, v]; });
    })).then(function(pairs){
      var o = {};
      pairs.forEach(function(p){ if (p) o[p[0]] = p[1]; });
      return [id, o];
    });
  })).then(function(entries){
    var out = {};
    entries.forEach(function(e){ out[e[0]] = e[1]; });
    return out;
  });
}

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
    return chargerConseq();
  }).then(function(cons){
    Object.keys(D.fiches).forEach(function(id){
      D.fiches[id].conseq = cons[id] || {};
    });
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
/* rendu délégué : marina-public tient la colonne gauche et la cagnotte */
function rendre(){
  if (window.MarinaPublic && MarinaPublic.rendre) MarinaPublic.rendre();
}

function reprendre(){
  charger().then(function(){ rendre(); if (window.MarinaStaff) MarinaStaff.absorber(); }).catch(function(){});
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
var NOTIF = MC.NOTIF;
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
  /* la Marina s'enregistre en DERNIER (onglet n°3) : barge-core pose
     window.QuaisBarge à son chargement et s'enregistre aussitôt. On attend
     ce signal, avec une grâce de 10 s si le marché noir n'est pas sur la
     page — sinon la Marina ne s'enregistrerait jamais. */
  if (!window.QuaisBarge && (Date.now() - T0 < 10000)) return false;
  window.Quais.register({
    key:"marina", label:"La Marina", sub:"boutique communautaire",
    icon:"fi fi-tr-anchor", mode:"grid", leftW:"450px", cols:2,
    cats: [
      { k:"solo", l:"Internes",  ic:"fi fi-tr-house-flood" },
      { k:"inter",l:"Inter",     ic:"fi fi-tr-arrows-repeat" },
      { k:"done", l:"Terminées", ic:"fi fi-tr-clipboard-check" }
    ],
    data:{},
    detail: function(id){ return window.MarinaPublic ? MarinaPublic.detailHTML(fiche(S.sel || id)) : ""; },
    emptyDetail: function(){ return window.MarinaPublic ? MarinaPublic.detailHTML(fiche(S.sel)) : ""; },
    wire: function(){
      /* la coque vient de se rendre : la Marina reprend la main sur la
         colonne gauche, la fiche, la cagnotte et ses deux boutons.
         La barre d'onglets reste CELLE DE QUAIS-CORE, intacte (flex centré).
         Les deux boutons sont ajoutés DANS #qb-tabs et sortis du flux par
         position:absolute (cf. CSS-marina) : jamais de restructure ici, les
         handlers suivent les nœuds déplacés, jamais d'innerHTML sur les onglets. */
      var tabs = document.querySelector("#qb-tabs");
      if (tabs && !tabs.querySelector("#qbm-propose")){
        tabs.insertAdjacentHTML("beforeend",
          '<button class="tdlev-txt-btn est-plein" id="qbm-propose" type="button"><i class="fi '+ICONES.ajouter+'"></i><span>'+esc(TXT.PROPOSER)+'</span></button>');
      }
      var tgl = document.querySelector("#qb-stafftgl");
      if (tabs && tgl && tgl.parentElement !== tabs) tabs.insertBefore(tgl, tabs.firstChild);
      rendre();
      /* le toggle staff de la coque ouvre le panneau Marina, pas l'édition
         d'items de la boutique : on garde notre propre vue, la coque garde
         la sienne (elle ne rend que des cartes d'items) */
      if (tgl && !tgl._marina){
        tgl._marina = true;
        tgl.addEventListener("click", function(){
          setTimeout(function(){
            if (window.MarinaStaff){
              if (!MarinaStaff.SS.ouvert) MarinaStaff.ouvrir();
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
  var obs = new MutationObserver(function(){ if (window.MarinaPublic) MarinaPublic.ajusterBoutons(root); });
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
  ICONES:ICONES, TXT:TXT, CHAMPS_VOLET:window.MarinaConfig.CHAMPS_VOLET, CHAMPS_STAFF:window.MarinaConfig.CHAMPS_STAFF,
  normaliser:normaliser, listeFiches:listeFiches, fichesOf:fichesOf, fiche:fiche, active:active,
  voixDe:voixDe, oppositionDe:oppositionDe, quorumDe:quorumDe, effDe:effDe,
  engagementDe:engagementDe, cagnotteDe:cagnotteDe, cagnotteNette:cagnotteNette,
  quotaDe:quotaDe, creerEvenement:creerEvenement,
  notifier:notifier, NOTIF:NOTIF,
  reprendre:reprendre, rendre:rendre, S:S, D:D
};

if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", demarrer); else demarrer();

})();
