/* THE DROWNED LANDS — SOCLE PARTAGÉ DES TABLEAUX FIREBASE · JS
   Remplace tdl-poll.js, dont il garde la signature suivre() à l'identique.

   CE QUE CE FICHIER FAIT
     - CLÉS     : push-ID générés en local, clés de pseudo assainies, lecture
                  d'un nœud à clés sous forme de liste triée.
     - ÉCRITURE : PATCH ciblé + bump de la sentinelle {node}_rev/{id} dans le
                  MÊME appel réseau, file de réessai en cas d'échec.
     - AVATARS  : index pseudo → faceclaim, et branche membres : chargés une
                  fois et partagés par tous les tableaux, au lieu d'un full read
                  racine chacun.
     - MIGRATION: convertit les listes d'un tableau (tableaux JS écrits en
                  bloc) vers des nœuds à clés, sur descripteur fourni par
                  l'appelant. Idempotente, une entrée par PATCH.
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

   CARTE DES BLOCS : CONFIG · ACTIVITÉ · CLÉS · ÉCRITURES · VEILLE · AVATARS
                     · MIGRATION · FABRIQUE · EXPORT */

(function () {
"use strict";

/* ===================== CONFIG ===================== */

var CADENCE_MS    = 15000;      /* cadence par défaut d'une veille            */
var INACTIVITE_MS = 600000;     /* 10 min sans action → on cesse de sonder    */
var FOCUS_GRACE_MS= 30000;      /* 30 s sans focus fenêtre → idem             */
var FENETRE_MS    = 15000;      /* délai après écriture avant de relire       */
var ABSENCE_MS    = 600000;     /* masqué plus longtemps → relecture complète */
var SEUIL_LOT     = 20;         /* au-delà, lecture complète du nœud          */
var RECONCILE_MS  = 300000;     /* 5 min : rattrape les écritures sans sentinelle */
var SUFFIXE_REV   = "_rev";     /* enquetes → enquetes_rev                    */

function journal() { try { console.warn.apply(console, ["[TDLBase]"].concat([].slice.call(arguments))); } catch (e) {} }

/* ===================== ACTIVITÉ ===================== */
/* Un onglet laissé ouvert en arrière-plan ne doit RIEN télécharger : c'est le
   premier poste de dépense du quota, bien avant la cadence elle-même. */

var _derniereAction = Date.now();
var _masqueDepuis   = 0;
var _perduFocus     = 0;

function marquerAction() { _derniereAction = Date.now(); _perduFocus = 0; }
["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (ev) {
  document.addEventListener(ev, marquerAction, true);
});
/* [MAJ v7] document.hidden ne suffit pas. Un onglet reste « visible » tant
   qu'il est l'onglet de premier plan de SA fenêtre, même si cette fenêtre est
   derrière une autre : deux fenêtres de navigateur ouvertes sur le forum, et
   celle de derrière continuait de sonder. On ajoute donc la perte de focus,
   avec un court délai pour ne pas couper la veille à chaque clic hors page. */
window.addEventListener("blur",  function () { if (!_perduFocus) _perduFocus = Date.now(); });
window.addEventListener("focus", marquerAction);

function inactif() {
  if (typeof document.hidden === "boolean" && document.hidden) return true;
  if (_perduFocus && Date.now() - _perduFocus > FOCUS_GRACE_MS) return true;
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

/* Chemin de la sentinelle. Par défaut {nœud}_rev, frère du nœud à la racine.
   opts.revPath le remplace, pour un nœud à DEUX niveaux : flottille/marees doit
   voir ses révisions en flottille_rev/marees — hors du nœud surveillé, sans
   quoi une branche de service se retrouverait mêlée aux données. */
function cheminRev(node, opts) {
  return (opts && opts.revPath) || (node + SUFFIXE_REV);
}

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
  return Promise.all(f.map(function (x) { return pousser(x.node, x.id, x.updates, x.libelle, { dejaRev: true, revPath: x.revPath }); }));
}

/* Cœur commun.
   opts.dejaRev  : ne pas re-bumper une révision déjà posée (réessai).
   opts.sansFile : en cas d'échec, NE PAS mettre en file de réessai — l'appelant
     gère lui-même. Indispensable pour une écriture COMPENSÉE : quand un appelant
     débite d'abord, écrit ensuite et recrédite si l'écriture rate, un réessai
     différé recréerait l'entrée APRÈS le recrédit. */
function pousser(node, id, updates, libelle, opts) {
  opts = opts || {};
  var cle = cheminRev(node, opts) + "/" + id;
  var rev = Date.now();
  if (!opts.dejaRev && updates[cle] === undefined) {
    updates[cle] = rev;
  } else {
    rev = updates[cle];
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
    journal("écriture refusée —", libelle || node, e);
    if (opts.sansFile) return false;          /* l'appelant compense lui-même */
    _enAttente.push({ node: node, id: id, updates: updates, libelle: libelle || "modification", revPath: opts.revPath });
    notifier();
    return false;
  });
}

/* Champs ciblés d'une entrée : ecrire("enquetes", id, {titre:…, statut:…})
   opts facultatif : voir pousser(). */
function ecrire(node, id, champs, libelle, opts) {
  var updates = {}, k;
  for (k in champs) { if (champs.hasOwnProperty(k)) updates[node + "/" + id + "/" + k] = champs[k]; }
  return pousser(node, id, updates, libelle, opts);
}

/* Entrée entière — création. Un PATCH, pas un PUT : la sentinelle part avec.
   Pour une création COMPENSÉE (débit préalable à recréditer si ça rate),
   passer {sansFile:true} et traiter le false rendu. */
function ecrireEntree(node, id, objet, libelle, opts) {
  var updates = {};
  updates[node + "/" + id] = objet;
  return pousser(node, id, updates, libelle, opts);
}

/* Suppression : l'entrée ET sa sentinelle, pour que les autres onglets voient
   la disparition au tick suivant. */
function supprimerEntree(node, id, libelle, opts) {
  var updates = {};
  updates[node + "/" + id] = null;
  updates[cheminRev(node, opts) + "/" + id] = null;
  return pousser(node, id, updates, libelle, { dejaRev: true, revPath: opts && opts.revPath });
}

/* ===================== VEILLE ===================== */

var _veilles = [];

/* Cale la révision connue d'une entrée dans toutes les veilles de ce nœud. */
function caler(node, id, rev) {
  _veilles.forEach(function (v) {
    if (v.node !== node) return;
    if (rev == null) { delete v.revs[id]; delete v.sansRev[id]; }
    else { v.revs[id] = rev; delete v.sansRev[id]; }
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
     revPath   : chemin de la sentinelle (défaut {nœud}_rev) — à préciser pour
                 un nœud à deux niveaux, voir cheminRev()
     reconcile : période de relecture complète du nœud (défaut 300 000, 0 = jamais)
   } */
function suivre(opts) {
  if (!opts || !opts.node) return null;
  var modeRev = !!opts.rev && typeof opts.onEntrees === "function";
  if (!modeRev && typeof opts.onDonnees !== "function") return null;

  var v = {
    node: opts.node,
    revPath: cheminRev(opts.node, opts),
    revs: {},
    /* [MAJ v7] ids connus SANS sentinelle (jamais réécrits depuis que la
       sentinelle existe, ou écrits par un module tiers). Leur absence de la
       carte des révisions ne vaut PAS suppression : seule la réconciliation,
       qui lit le nœud lui-même, peut trancher leur sort. */
    sansRev: {},
    ms: opts.ms || CADENCE_MS,
    derniere: null,
    enCours: false,
    mort: false,
    iv: null,
    reconcile: (opts.reconcile === 0 ? 0 : (opts.reconcile || RECONCILE_MS)),
    dernierComplet: Date.now()
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
      opts.onDonnees(brut || {});
    }, function (e) { v.enCours = false; journal("lecture", v.node, e); });
  }

  /* Filet : relecture complète du nœud ET des révisions. Rattrape les entrées
     écrites par un module qui ne bumpe pas la sentinelle (un firebasePush venu
     d'ailleurs, par exemple), que le tick sentinelle ne peut pas voir. */
  function tickReconcile(force) {
    v.enCours = true;
    return Promise.all([lire(v.node), lire(v.revPath)]).then(function (res) {
      var brut = res[0] || {}, rev = res[1] || {};
      v.enCours = false; v.dernierComplet = Date.now();
      if (v.mort) return;
      if (!force && opts.occupe && opts.occupe()) return;
      var majs = [], supprimes = [];
      Object.keys(brut).forEach(function (id) {
        var rv = rev[id];
        if (rv == null) { v.sansRev[id] = true; rv = 0; } else { delete v.sansRev[id]; }
        if (v.revs[id] !== rv) majs.push({ id: id, brut: brut[id] });
        v.revs[id] = rv;
      });
      /* ici la suppression est certaine : on a lu le nœud, pas seulement ses révisions */
      Object.keys(v.revs).forEach(function (id) {
        if (brut[id] == null) { supprimes.push(id); delete v.revs[id]; delete v.sansRev[id]; }
      });
      if (majs.length || supprimes.length) opts.onEntrees(majs, supprimes);
    }, function (e) { v.enCours = false; v.dernierComplet = Date.now(); journal("réconciliation", v.node, e); });
  }

  /* Mode sentinelle : on ne lit que les révisions, puis les entrées bougées. */
  function tickRev(force) {
    v.enCours = true;
    return lire(v.revPath).then(function (r) {
      r = r || {};
      var neufs = [], supprimes = [];
      Object.keys(r).forEach(function (id) { if (v.revs[id] !== r[id]) neufs.push(id); });
      Object.keys(v.revs).forEach(function (id) {
        if (r[id] != null) return;
        if (v.sansRev[id]) return;        /* n'a jamais eu de révision : pas une suppression */
        supprimes.push(id);
      });
      if (!neufs.length && !supprimes.length) { v.enCours = false; return; }
      if (neufs.length > SEUIL_LOT) {           /* lot massif → une seule requête */
        v.enCours = false;
        return tickReconcile(force);
      }
      neufs.forEach(function (id) { delete v.sansRev[id]; });   /* elles en ont une maintenant */
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
    if (!modeRev) { tickComplet(force); return; }
    if (v.reconcile && Date.now() - v.dernierComplet > v.reconcile) tickReconcile(force);
    else tickRev(force);
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
      return lire(v.revPath).then(function (r) {
        r = r || {};
        Object.keys(r).forEach(function (id) { v.revs[id] = r[id]; delete v.sansRev[id]; });
        Object.keys(brut || {}).forEach(function (id) {
          if (v.revs[id] === undefined) { v.revs[id] = 0; v.sansRev[id] = true; }
        });
        v.dernierComplet = Date.now();
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
    if (longue) { v.revs = {}; v.sansRev = {}; }   /* on repart de zéro : tout sera relu */
    v.enCours = false;
  });
});

/* ===================== AVATARS ===================== */
/* Index pseudo → fiche de faceclaim, PARTAGÉ par tous les tableaux. Avant, chacun
   relisait la racine entière (126 ko) toutes les 60 s pour reconstruire le même
   index ; la branche faceclaims pèse ~1,5 ko et ne bouge que de loin en loin. */

var AVATARS_TTL = 600000;          /* 10 min : un faceclaim change deux fois par mois */
var _av = null, _avT = 0, _avEnVol = null, _avAbonnes = [];

/* un pseudo peut apparaître sur plusieurs cartes : on garde la plus engageante */
function scoreFc(c) {
  return (c.statut === "pris" ? 4 : (c.statut === "reserve" ? 1 : 0)) + (c.image ? 2 : 0);
}
function indexerFc(fc) {
  var idx = {};
  Object.keys(fc || {}).forEach(function (k) {
    var c = fc[k];
    if (!c || !c.pseudo) return;
    var a = idx[c.pseudo];
    if (!a || scoreFc(c) > scoreFc(a)) idx[c.pseudo] = c;
  });
  return idx;
}

/* avatars(cb) : rend une Promise de l'index, et rappelle cb à chaque
   rafraîchissement. Les appels concurrents partagent un seul aller-retour. */
function avatars(cb) {
  if (cb && _avAbonnes.indexOf(cb) < 0) _avAbonnes.push(cb);
  if (_av && Date.now() - _avT < AVATARS_TTL) {
    if (cb) { try { cb(_av); } catch (e) {} }
    return Promise.resolve(_av);
  }
  if (_avEnVol) return _avEnVol;
  if (!window.EcoCore || !window.EcoCore.firebaseGet) return Promise.resolve(_av || {});
  _avEnVol = Promise.resolve(window.EcoCore.firebaseGet("faceclaims")).then(function (fc) {
    _av = indexerFc(fc); _avT = Date.now(); _avEnVol = null;
    _avAbonnes.forEach(function (f) { try { f(_av); } catch (e) {} });
    return _av;
  }, function (e) {
    _avEnVol = null; journal("faceclaims", e);
    return _av || {};
  });
  return _avEnVol;
}

/* Lecture synchrone, pour le rendu : null tant que l'index n'est pas chargé.
   Les tableaux affichent alors leurs initiales et se redessinent au rappel. */
function avatar(pseudo) { return (_av && _av[pseudo]) || null; }

/* ---- branche membres, partagée elle aussi ----
   Soldes, dettes, prêts, liens, hors_la_loi : plusieurs tableaux en ont besoin,
   et chacun relisait la racine entière pour l'obtenir. La branche fait ~3 ko. */
var MEMBRES_TTL = 120000;
var _mb = null, _mbT = 0, _mbEnVol = null, _mbAbonnes = [];

function membres(cb, forcer) {
  if (cb && _mbAbonnes.indexOf(cb) < 0) _mbAbonnes.push(cb);
  if (!forcer && _mb && Date.now() - _mbT < MEMBRES_TTL) {
    if (cb) { try { cb(_mb); } catch (e) {} }
    return Promise.resolve(_mb);
  }
  if (_mbEnVol) return _mbEnVol;
  if (!window.EcoCore || !window.EcoCore.firebaseGet) return Promise.resolve(_mb || {});
  _mbEnVol = Promise.resolve(window.EcoCore.firebaseGet("membres")).then(function (m) {
    _mb = m || {}; _mbT = Date.now(); _mbEnVol = null;
    _mbAbonnes.forEach(function (f) { try { f(_mb); } catch (e) {} });
    return _mb;
  }, function (e) {
    _mbEnVol = null; journal("membres", e);
    return _mb || {};
  });
  return _mbEnVol;
}
/* À appeler après un mouvement d'argent : le solde affiché doit suivre. */
function rafraichirMembres() { return membres(null, true); }

/* ===================== MIGRATION ===================== */
/* Convertit les listes d'un tableau — tableaux JS écrits en bloc — vers des
   nœuds à clés, où chaque entrée s'écrit et se supprime seule. Le descripteur
   est fourni par le tableau appelant ; le socle ne connaît aucun schéma.

   plan = { <champ> : {
       mode : "auto"   → clé = push-ID local (défaut)
              "pseudo" → clé = clePseudo(valeur convertie)
              "ref"    → clé donnée par cle()
       conv : function(x, i) → la valeur v2, ou null pour écarter l'entrée
       cle  : function(x, i) → la clé, calculée sur la valeur D'ORIGINE
   } }

   Une liste vide après conversion rend null : la branche n'est pas écrite.
   Un champ absent du plan est recopié tel quel. */

function convertirListe(v, def) {
  var src = versTableau(v), dst = {}, n = 0;
  src.forEach(function (x, i) {
    var val = def.conv ? def.conv(x, i) : x;
    if (val == null) return;
    var cle = def.cle ? def.cle(x, i)
            : (def.mode === "pseudo" ? clePseudo(val) : nouvelleCle());
    if (cle == null || cle === "") return;
    dst[String(cle)] = val; n++;
  });
  return n ? dst : null;
}

function convertirEntree(o, plan, schema) {
  var out = {}, k;
  for (k in o) {
    if (!o.hasOwnProperty(k)) continue;
    out[k] = plan[k] ? convertirListe(o[k], plan[k]) : o[k];
  }
  out.schema = schema;
  return out;
}

/* Les ids dont le schéma n'est pas à jour. */
function aMigrer(brut, schema) {
  var out = [], b = brut || {};
  Object.keys(b).forEach(function (id) {
    var o = b[id];
    if (o && typeof o === "object" && o.schema !== schema) out.push(id);
  });
  return out;
}

/* Une entrée à la fois, en série : chaque affaire part dans son propre PATCH,
   donc une conversion ratée n'entraîne pas les autres et sera simplement
   retentée au prochain lancement (l'opération est idempotente).
   opts = { node, schema, listes, entrees, ids?, surProgres? }
   → Promise<{faits, total, erreurs:[id]}> */
function migrer(opts) {
  var node   = opts.node;
  var schema = opts.schema || 2;
  var plan   = opts.listes || {};
  var brut   = opts.entrees || {};
  var ids    = opts.ids || aMigrer(brut, schema);
  var faits = 0, erreurs = [];
  var chaine = Promise.resolve();
  ids.forEach(function (id) {
    chaine = chaine.then(function () {
      var o = brut[id];
      if (!o || typeof o !== "object") { erreurs.push(id); return; }
      var v2;
      try { v2 = convertirEntree(o, plan, schema); }
      catch (e) { journal("conversion", id, e); erreurs.push(id); return; }
      return ecrireEntree(node, id, v2, "migration de " + id, { revPath: opts.revPath }).then(function (ok) {
        if (ok) faits++; else erreurs.push(id);
        if (opts.surProgres) { try { opts.surProgres(faits + erreurs.length, ids.length); } catch (e) {} }
      });
    });
  });
  return chaine.then(function () {
    return { faits: faits, total: ids.length, erreurs: erreurs };
  });
}

/* ===================== FABRIQUE ===================== */
/* Lie un nœud et son chemin de sentinelle une fois pour toutes, au lieu de
   répéter revPath à chaque appel. Indispensable dès qu'un tableau surveille
   plusieurs nœuds — la flottille en a trois : disparitions, operations, marees.
     var T = TDLBase.table({node:"flottille/marees", revPath:"flottille_rev/marees"});
     T.ecrire(id, {statut:"close"});  T.suivre({rev:true, onEntrees:…});
   Un tableau à un seul nœud plat n'en a pas besoin : les fonctions nues
   gardent exactement leur comportement. */
function table(conf) {
  var node = conf.node, revPath = conf.revPath || (node + SUFFIXE_REV);
  function avecRev(extra) {
    var o = { revPath: revPath }, k;
    if (extra) for (k in extra) { if (extra.hasOwnProperty(k)) o[k] = extra[k]; }
    return o;
  }
  return {
    node: node, revPath: revPath,
    ecrire:          function (id, champs, libelle, extra) { return ecrire(node, id, champs, libelle, avecRev(extra)); },
    ecrireEntree:    function (id, objet, libelle, extra)  { return ecrireEntree(node, id, objet, libelle, avecRev(extra)); },
    supprimerEntree: function (id, libelle)                { return supprimerEntree(node, id, libelle, avecRev()); },
    suivre: function (o) {
      o = o || {}; o.node = node; o.revPath = revPath;
      return suivre(o);
    },
    migrer: function (o) {
      o = o || {}; o.node = node; o.revPath = revPath;
      return migrer(o);
    },
    aMigrer: function (brut, schema) { return aMigrer(brut, schema); }
  };
}

/* ===================== EXPORT ===================== */

window.TDLBase = {
  /* clés */
  nouvelleCle: nouvelleCle, clePseudo: clePseudo, versListe: versListe, versTableau: versTableau,
  /* écritures */
  ecrire: ecrire, ecrireEntree: ecrireEntree, supprimerEntree: supprimerEntree,
  reessayer: reessayer, enAttente: enAttente, enVol: enVol, surEchec: surEchec,
  /* veille */
  suivre: suivre,
  /* avatars */
  avatars: avatars, avatar: avatar,
  /* membres */
  membres: membres, rafraichirMembres: rafraichirMembres,
  /* migration */
  migrer: migrer, aMigrer: aMigrer,
  /* fabrique (nœuds à deux niveaux) */
  table: table,
  /* réglages, lisibles par les tableaux */
  CADENCE_MS: CADENCE_MS, SUFFIXE_REV: SUFFIXE_REV
};

/* Compatibilité : les quatre tableaux qui appellent déjà TDLPoll.suivre()
   continuent de fonctionner sans modification. */
window.TDLPoll = window.TDLBase;

})();
