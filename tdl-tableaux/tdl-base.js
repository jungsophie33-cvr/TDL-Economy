/* THE DROWNED LANDS — SOCLE PARTAGÉ DES TABLEAUX FIREBASE · JS
   Remplace tdl-poll.js, dont il garde la signature suivre() à l'identique.

   CE QUE CE FICHIER FAIT
     - CLÉS     : push-ID générés en local, clés de pseudo assainies, lecture
                  d'un nœud à clés sous forme de liste triée.
     - ÉCRITURE : PATCH ciblé + bump de la sentinelle {node}_rev/{id} dans le
                  MÊME appel réseau, file de réessai en cas d'échec.
     - VEILLE   : relit la sentinelle (quelques ko) au lieu du nœud entier, et
                  ne va chercher que les entrées réellement modifiées. Silence
                  total quand l'onglet est masqué ou l'utilisateur inactif.

   CE QU'IL NE FAIT PAS : aucun DOM, aucun CSS, aucune connaissance du schéma
   d'un tableau donné. Chaque tableau garde son normaliser() et son rendu.

   RÈGLE À TENIR : toute écriture d'un tableau passe par ce socle. Une écriture
   directe en EcoCore.firebaseUpdate ne bumperait pas la sentinelle et resterait
   invisible aux autres onglets.

   EXPOSE : window.TDLBase  (+ window.TDLPoll en alias de compatibilité)
   DÉPEND DE : window.EcoCore (firebaseGet, firebaseUpdate)

   CARTE DES BLOCS : CONFIG · ACTIVITÉ · CLÉS · ÉCRITURES · VEILLE · EXPORT */

(function () {
"use strict";

/* ===================== CONFIG ===================== */

var CADENCE_MS    = 15000;      /* cadence par défaut d'une veille            */
var INACTIVITE_MS = 600000;     /* 10 min sans action → on cesse de sonder    */
var FENETRE_MS    = 15000;      /* délai après écriture avant de relire       */
var ABSENCE_MS    = 600000;     /* masqué plus longtemps → relecture complète */
var SEUIL_LOT     = 20;         /* au-delà, lecture complète du nœud          */
var SUFFIXE_REV   = "_rev";     /* enquetes → enquetes_rev                    */

function journal() { try { console.warn.apply(console, ["[TDLBase]"].concat([].slice.call(arguments))); } catch (e) {} }

/* ===================== ACTIVITÉ ===================== */
/* Un onglet laissé ouvert en arrière-plan ne doit RIEN télécharger : c'est le
   premier poste de dépense du quota, bien avant la cadence elle-même. */

var _derniereAction = Date.now();
var _masqueDepuis   = 0;

function marquerAction() { _derniereAction = Date.now(); }
["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (ev) {
  document.addEventListener(ev, marquerAction, true);
});

function inactif() {
  if (typeof document.hidden === "boolean" && document.hidden) return true;
  return Date.now() - _derniereAction > INACTIVITE_MS;
}

/* ===================== CLÉS ===================== */

/* Push-ID Firebase, fabriqué en LOCAL : on connaît la clé avant d'écrire, donc
   on peut afficher l'entrée immédiatement et grouper plusieurs ajouts dans un
   seul PATCH. Horodaté et monotone → le tri lexicographique est chronologique. */
var CARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
var _dernierT = 0;
var _alea = [];

function nouvelleCle() {
  var t = Date.now(), meme = (t === _dernierT), i;
  _dernierT = t;
  var horo = new Array(8);
  for (i = 7; i >= 0; i--) { horo[i] = CARS.charAt(t % 64); t = Math.floor(t / 64); }
  var cle = horo.join("");
  if (!meme) {
    for (i = 0; i < 12; i++) _alea[i] = Math.floor(Math.random() * 64);
  } else {
    for (i = 11; i >= 0 && _alea[i] === 63; i--) _alea[i] = 0;
    if (i >= 0) _alea[i]++;
  }
  for (i = 0; i < 12; i++) cle += CARS.charAt(_alea[i]);
  return cle;
}

/* Firebase interdit . $ # [ ] / et les codes de contrôle dans une clé.
   La VALEUR stocke toujours le pseudo réel : c'est elle qu'on affiche. */
var INTERDITS = /[.$#\[\]\/\u0000-\u001F\u007F]/g;
function clePseudo(p) { return String(p == null ? "" : p).trim().replace(INTERDITS, "_"); }

/* Un nœud à clés devient [{k,v}] trié par clé. Un ancien tableau JS garde son
   ordre. Les trous sont filtrés : Firebase rend des tableaux creux avec un null
   en tête quand les clés sont numériques et contiguës à partir de 1. */
function versListe(v) {
  if (v == null) return [];
  var out = [];
  if (Array.isArray(v)) {
    v.forEach(function (x, i) { if (x != null) out.push({ k: String(i), v: x }); });
    return out;
  }
  if (typeof v !== "object") return [];
  Object.keys(v).sort().forEach(function (k) { if (v[k] != null) out.push({ k: k, v: v[k] }); });
  return out;
}
function versTableau(v) { return versListe(v).map(function (e) { return e.v; }); }

/* ===================== ÉCRITURES ===================== */

var _enVol = 0;
var _enAttente = [];
var _derniereEcriture = {};     /* par nœud */
var _ecouteurs = [];            /* notifiés à chaque changement de la file */

function surEchec(fn) { if (typeof fn === "function") _ecouteurs.push(fn); }
function notifier() { _ecouteurs.forEach(function (f) { try { f(_enAttente.length); } catch (e) {} }); }
function enAttente() { return _enAttente.length; }
function enVol() { return _enVol; }

/* Rejoue tout ce qui a échoué. Les PATCH sont idempotents : rejouer est sûr. */
function reessayer() {
  var f = _enAttente.splice(0);
  notifier();
  return Promise.all(f.map(function (x) { return pousser(x.node, x.id, x.updates, x.libelle, true); }));
}

/* Cœur commun. `dejaRev` évite de re-bumper une révision déjà posée (réessai). */
function pousser(node, id, updates, libelle, dejaRev) {
  var rev = Date.now();
  if (!dejaRev && updates[node + SUFFIXE_REV + "/" + id] === undefined) {
    updates[node + SUFFIXE_REV + "/" + id] = rev;
  } else {
    rev = updates[node + SUFFIXE_REV + "/" + id];
  }
  _derniereEcriture[node] = Date.now();
  _enVol++;
  var p;
  try { p = window.EcoCore.firebaseUpdate(updates); }
  catch (e) { p = Promise.reject(e); }
  return Promise.resolve(p).then(function () {
    _derniereEcriture[node] = Date.now();
    caler(node, id, rev);                       /* ne jamais relire sa propre écriture */
    _enVol--;
    return true;
  }, function (e) {
    _enVol--;
    _enAttente.push({ node: node, id: id, updates: updates, libelle: libelle || "modification" });
    journal("écriture refusée —", libelle || node, e);
    notifier();
    return false;
  });
}

/* Champs ciblés d'une entrée : ecrire("enquetes", id, {titre:…, statut:…}) */
function ecrire(node, id, champs, libelle) {
  var updates = {}, k;
  for (k in champs) { if (champs.hasOwnProperty(k)) updates[node + "/" + id + "/" + k] = champs[k]; }
  return pousser(node, id, updates, libelle);
}

/* Entrée entière — création. Un PATCH, pas un PUT : la sentinelle part avec. */
function ecrireEntree(node, id, objet, libelle) {
  var updates = {};
  updates[node + "/" + id] = objet;
  return pousser(node, id, updates, libelle);
}

/* Suppression : l'entrée ET sa sentinelle, pour que les autres onglets voient
   la disparition au tick suivant. */
function supprimerEntree(node, id, libelle) {
  var updates = {};
  updates[node + "/" + id] = null;
  updates[node + SUFFIXE_REV + "/" + id] = null;
  return pousser(node, id, updates, libelle, true);
}

/* ===================== VEILLE ===================== */

var _veilles = [];

/* Cale la révision connue d'une entrée dans toutes les veilles de ce nœud. */
function caler(node, id, rev) {
  _veilles.forEach(function (v) {
    if (v.node !== node) return;
    if (rev == null) delete v.revs[id];
    else v.revs[id] = rev;
  });
}

/* opts = {
     node      : nœud surveillé (ex. "enquetes")
     rev       : true → mode sentinelle (recommandé)
     onEntrees : function(majs, supprimes) — mode sentinelle.
                 majs = [{id, brut}], supprimes = [id]
     onDonnees : function(brut) — mode hérité, nœud entier
     occupe    : function() → true si l'interface ne doit pas être redessinée
     ms        : cadence (défaut 15 000)
   } */
function suivre(opts) {
  if (!opts || !opts.node) return null;
  var modeRev = !!opts.rev && typeof opts.onEntrees === "function";
  if (!modeRev && typeof opts.onDonnees !== "function") return null;

  var v = {
    node: opts.node,
    revs: {},
    ms: opts.ms || CADENCE_MS,
    derniere: null,
    enCours: false,
    mort: false,
    iv: null
  };
  _veilles.push(v);

  function bloque(force) {
    if (v.mort || v.enCours) return true;
    if (!window.EcoCore || !window.EcoCore.firebaseGet) return true;
    if (force) return false;
    if (inactif()) return true;
    var ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return true;
    if (_enVol > 0 || _enAttente.length) return true;
    if (Date.now() - (_derniereEcriture[v.node] || 0) < FENETRE_MS) return true;
    return !!(opts.occupe && opts.occupe());
  }

  function lire(chemin) {
    try { return Promise.resolve(window.EcoCore.firebaseGet(chemin)); }
    catch (e) { return Promise.reject(e); }
  }

  /* Mode hérité : le nœud entier, notifié seulement s'il a changé. */
  function tickComplet(force) {
    v.enCours = true;
    return lire(v.node).then(function (brut) {
      v.enCours = false;
      if (v.mort) return;
      if (!force && opts.occupe && opts.occupe()) return;
      var sig = JSON.stringify(brut || {});
      if (sig === v.derniere) return;
      v.derniere = sig;
      if (modeRev) {
        var majs = [], r = brut || {};
        Object.keys(r).forEach(function (id) { v.revs[id] = v.revs[id] || 0; majs.push({ id: id, brut: r[id] }); });
        opts.onEntrees(majs, []);
      } else {
        opts.onDonnees(brut || {});
      }
    }, function (e) { v.enCours = false; journal("lecture", v.node, e); });
  }

  /* Mode sentinelle : on ne lit que les révisions, puis les entrées bougées. */
  function tickRev(force) {
    v.enCours = true;
    return lire(v.node + SUFFIXE_REV).then(function (r) {
      r = r || {};
      var neufs = [], supprimes = [];
      Object.keys(r).forEach(function (id) { if (v.revs[id] !== r[id]) neufs.push(id); });
      Object.keys(v.revs).forEach(function (id) { if (r[id] == null) supprimes.push(id); });
      if (!neufs.length && !supprimes.length) { v.enCours = false; return; }
      if (neufs.length > SEUIL_LOT) {           /* lot massif → une seule requête */
        v.enCours = false;
        Object.keys(r).forEach(function (id) { v.revs[id] = r[id]; });
        supprimes.forEach(function (id) { delete v.revs[id]; });
        return tickComplet(force);
      }
      return Promise.all(neufs.map(function (id) {
        return lire(v.node + "/" + id).then(function (o) { return { id: id, brut: o }; });
      })).then(function (majs) {
        v.enCours = false;
        if (v.mort) return;
        if (!force && opts.occupe && opts.occupe()) return;   /* l'état a pu changer pendant l'aller-retour */
        neufs.forEach(function (id) { v.revs[id] = r[id]; });
        supprimes.forEach(function (id) { delete v.revs[id]; });
        majs = majs.filter(function (m) { return m.brut != null; });
        if (majs.length || supprimes.length) opts.onEntrees(majs, supprimes);
      });
    }, function (e) { v.enCours = false; journal("sentinelle", v.node, e); });
  }

  function tick(force) {
    if (bloque(force)) return;
    if (modeRev) tickRev(force); else tickComplet(force);
  }

  v.iv = setInterval(function () { tick(false); }, v.ms);

  return {
    arreter: function () { v.mort = true; clearInterval(v.iv); _veilles = _veilles.filter(function (x) { return x !== v; }); },
    forcer:  function () { tick(true); },
    /* À appeler après le chargement initial, avec le nœud brut déjà lu, pour
       ne pas redessiner inutilement au premier tick. */
    caler: function (brut) {
      v.derniere = JSON.stringify(brut || {});
      if (!modeRev) return Promise.resolve();
      return lire(v.node + SUFFIXE_REV).then(function (r) {
        r = r || {};
        Object.keys(r).forEach(function (id) { v.revs[id] = r[id]; });
        Object.keys(brut || {}).forEach(function (id) { if (v.revs[id] === undefined) v.revs[id] = 0; });
      }, function () {});
    }
  };
}

/* Retour d'un onglet masqué : on se resynchronise une fois, proprement. */
document.addEventListener("visibilitychange", function () {
  if (document.hidden) { _masqueDepuis = Date.now(); return; }
  marquerAction();
  var longue = _masqueDepuis && (Date.now() - _masqueDepuis > ABSENCE_MS);
  _masqueDepuis = 0;
  _veilles.forEach(function (v) {
    if (longue) v.revs = {};        /* on repart de zéro : tout sera relu */
    v.enCours = false;
  });
});

/* ===================== EXPORT ===================== */

window.TDLBase = {
  /* clés */
  nouvelleCle: nouvelleCle, clePseudo: clePseudo, versListe: versListe, versTableau: versTableau,
  /* écritures */
  ecrire: ecrire, ecrireEntree: ecrireEntree, supprimerEntree: supprimerEntree,
  reessayer: reessayer, enAttente: enAttente, enVol: enVol, surEchec: surEchec,
  /* veille */
  suivre: suivre,
  /* réglages, lisibles par les tableaux */
  CADENCE_MS: CADENCE_MS, SUFFIXE_REV: SUFFIXE_REV
};

/* Compatibilité : les quatre tableaux qui appellent déjà TDLPoll.suivre()
   continuent de fonctionner sans modification. */
window.TDLPoll = window.TDLBase;

})();
