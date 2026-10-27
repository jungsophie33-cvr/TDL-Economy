/* === JAUGES DE TERREBONNE — MOTEUR ===
   Auteur : Claude x THE DROWNED LANDS

   CE QUE CE FICHIER FAIT
     - VERSEMENT : verse la conclusion d'un évent dans une ou deux jauges.
                   Le verrou de la conclusion passe de rien à true par
                   transaction AVANT tout mouvement : deux clics, ou deux
                   membres du staff sur la même conclusion, ne versent qu'une
                   fois. Compromis assumé (même règle que pour l'argent) : si
                   un versement échoue après la prise du verrou, la conclusion
                   reste marquée versée — le message le dit, et la jauge se
                   corrige depuis le panneau staff.
     - RÉGLAGE   : le réglage direct du panneau staff, avec motif.
     - JOURNAL   : une entrée par mouvement, dans jauges_journal, purgée
                   au-delà de JOURS_JOURNAL.

   Chaque mouvement de jauge est une firebaseTransaction sur jauges/{clé}
   seule : le calcul (décrue, charge, plafond) se fait sur la valeur SERVEUR,
   jamais sur un instantané de page. Aucune lecture de la racine.

   CE QU'IL NE FAIT PAS : il ne connaît ni les évents ni leurs poids. Il
   reçoit une jauge, un sens, des points, une éventuelle bascule.

   EXPOSE : window.TDLJaugesMoteur
   DÉPEND DE : window.TDLJauges (jauges-core), window.EcoCore, window.TDLBase
   À CHARGER : après jauges-core et tdl-base

   CARTE DES BLOCS : CONFIG · OUTILS · LECTURE · JOURNAL · VERSEMENT
                     · RÉGLAGE · EXPORT */

(function () {
"use strict";

/* ===================== CONFIG ===================== */

var CFG = {
  NODE:         "jauges",
  NODE_JOURNAL: "jauges_journal",
  PURGE_MAX:    50              /* entrées purgées par passage, au plus */
};

/* ===================== OUTILS ===================== */

function E(){ return window.EcoCore; }
function B(){ return window.TDLBase; }
function J(){ return window.TDLJauges; }

function journal(){ try { console.warn.apply(console, ["[TDLJaugesMoteur]"].concat([].slice.call(arguments))); } catch (e) {} }
function moi(){ try { return E().getPseudo() || ""; } catch (e) { return ""; } }

/* firebaseTransaction construit une URL : segment dynamique encodé. */
function cheminJauge(cle){ return CFG.NODE + "/" + encodeURIComponent(cle); }

function pret(){
  return !!(E() && E().firebaseTransaction && E().firebaseUpdate && E().firebaseGet
            && B() && B().nouvelleCle && J() && J().verser);
}

/* ===================== LECTURE ===================== */

/* La seule branche jauges, quelques centaines d'octets. */
function lireBrut(){
  return Promise.resolve(E().firebaseGet(CFG.NODE)).then(function (j) { return j || {}; });
}

/* ===================== JOURNAL ===================== */

/* PATCH ciblé sur une seule entrée neuve. Le nœud n'est pas surveillé par une
   veille : aucune sentinelle à bumper. Un journal qui échoue n'annule pas le
   mouvement déjà écrit — il le signale en console. */
function tracer(cle, type, r, extra){
  extra = extra || {};
  var e = {
    jauge: cle, type: type,
    sens: r.sens || null, points: r.points || 0,
    franchi: r.franchi || 0, attente: !!r.attente,
    avant: r.avant || null, apres: r.apres || null,
    ev: extra.ev || null, titre: extra.titre || null, motif: extra.motif || null,
    par: moi(), le: new Date().toISOString()
  };
  var up = {};
  up[CFG.NODE_JOURNAL + "/" + B().nouvelleCle()] = e;     /* chemin BRUT : PATCH racine */
  return Promise.resolve(E().firebaseUpdate(up)).then(function () { return true; },
    function (err) { journal("journal non écrit", cle, err); return false; });
}

/* Les entrées les plus récentes d'abord. Les clés sont des push-ID, donc
   chronologiques. La purge part en tâche de fond, sans bloquer la lecture. */
function lireJournal(n){
  return Promise.resolve(E().firebaseGet(CFG.NODE_JOURNAL)).then(function (j) {
    var liste = B().versListe(j).reverse();
    purger(liste);
    return liste.slice(0, n || 20);
  });
}

function purger(liste){
  var limite = Date.now() - J().MOTEUR.JOURS_JOURNAL * 86400000, up = {}, k = 0;
  for (var i = liste.length - 1; i >= 0 && k < CFG.PURGE_MAX; i--) {
    var t = new Date((liste[i].v || {}).le).getTime();
    if (isNaN(t) || t >= limite) continue;
    up[CFG.NODE_JOURNAL + "/" + liste[i].k] = null; k++;
  }
  if (!k) return;
  Promise.resolve(E().firebaseUpdate(up)).catch(function (e) { journal("purge", e); });
}

/* ===================== VERSEMENT ===================== */

/* Une ligne = { jauge, sens, points, bascule, motif }. Le résultat de
   J().verser() est capturé à chaque passage de la fonction de transaction :
   seule la dernière exécution, celle qui a réussi, compte. */
function verserUne(l, ev, t){
  var r = null;
  return E().firebaseTransaction(cheminJauge(l.jauge), function (cur) {
    r = J().verser(cur, l, t);
    return r.stocke;
  }).then(function () {
    return tracer(l.jauge, l.bascule ? "bascule" : "versement", r,
      { ev: ev && ev.id, titre: ev && ev.titre, motif: l.motif })
      .then(function () { return { jauge: l.jauge, res: r }; });
  }, function (e) {
    journal("versement refusé", l.jauge, e);
    return { jauge: l.jauge, erreur: true };
  });
}

/* verrou : chemin COMPLET du drapeau, segments dynamiques déjà encodés par
   l'appelant (ex. evenements_conclusions/<id>/versee).
   → Promise<{ rien } | { deja } | { resultats:[{jauge, res}|{jauge, erreur}] }>
   Rejette si le verrou n'a pas pu être pris : rien n'a bougé. */
function verserConclusion(verrou, ev, lignes){
  if (!pret()) return Promise.reject(new Error("MOTEUR"));
  var utiles = (lignes || []).filter(function (l) {
    return l && J().CFG[l.jauge] && (l.bascule || (+l.points > 0));
  });
  if (!utiles.length) return Promise.resolve({ rien: true, resultats: [] });

  var t = Date.now();
  return E().firebaseTransaction(verrou, function (cur) {
    if (cur === true) throw new Error("DEJA");
    return true;
  }).then(function () {
    var out = [];
    /* en série : deux jauges différentes, mais un seul aller-retour à la fois */
    return utiles.reduce(function (p, l) {
      return p.then(function () { return verserUne(l, ev, t).then(function (x) { out.push(x); }); });
    }, Promise.resolve()).then(function () { return { resultats: out }; });
  }, function (e) {
    if (e && e.message === "DEJA") return { deja: true, resultats: [] };
    throw e;
  });
}

/* ===================== RÉGLAGE ===================== */

/* Réglage direct du panneau staff : un niveau, motif obligatoire. */
function regler(cle, delta, motif){
  if (!pret()) return Promise.reject(new Error("MOTEUR"));
  if (!J().CFG[cle]) return Promise.reject(new Error("JAUGE"));
  var t = Date.now(), r = null;
  return E().firebaseTransaction(cheminJauge(cle), function (cur) {
    r = J().regler(cur, delta, t);
    return r.stocke;
  }).then(function () {
    return tracer(cle, "reglage", r, { motif: motif }).then(function () { return r; });
  });
}

/* ===================== EXPORT ===================== */

window.TDLJaugesMoteur = {
  CFG: CFG,
  pret: pret,
  lireBrut: lireBrut,
  lireJournal: lireJournal,
  verserConclusion: verserConclusion,
  regler: regler
};

})();
