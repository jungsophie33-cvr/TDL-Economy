/* THE DROWNED LANDS — RÉCEPTION DES NOTIFICATIONS · JS
   Branche les notifications Firebase sur Notiffi sans modifier le plugin ni
   son HTML. À charger APRÈS Notiffi.init(). Dépend de window.EcoCore et de
   eco-notif.js (registre des types).

   TROIS ACCROCHES
   - displayNotifications : fusionne nos notifs avec celles de FA (la méthode
     d'origine écrase syncStore.notifs, on l'enveloppe donc, on ne l'alimente pas)
   - handleUnread         : additionne les deux compteurs
   - boutons              : « Marquer comme lu » et « Tout supprimer » couvrent TDL

   TEMPS RÉEL : EventSource (streaming REST Firebase, sans SDK) sur notifs/{uid}.
   Le canal global est relu toutes les 60 s — il ne porte que des annonces rares.
   Sans URL de base détectable, repli automatique sur EcoCore en interrogation.

   PIÈGE POTION : le morphing recopie tous les attributs SAUF @… et #…, donc un
   handler @click lié à une ligne réutilisée pointe encore l'ancien contexte.
   deleteNotif lit donc TOUJOURS l'id dans le DOM, jamais dans le closure. */
(function () {
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  /* [MAJ] miroir de FIREBASE_CONFIG.databaseURL dans eco-core. Le SDK et
     EcoCore.BASE_URL priment ; ceci n'est qu'un repli. */
  BASE:       "https://thedrownedlands-b35b4-default-rtdb.europe-west1.firebasedatabase.app",
  NODE:       "notifs",
  NODE_PSEUDO:"notifs_pseudo",
  NODE_GLOB:  "notifs_globales",
  NODE_ETAT:  "notifs_etat",
  POLL_GLOB:  60000,            /* relecture du canal global */
  POLL_DEG:   45000,            /* mode dégradé : tout relire via EcoCore */
  VIE:        120000,           /* contrôle de vitalité du flux */
  PLAFOND:    30,               /* notifs personnelles conservées */
  PURGE_J:    30,
  GLOB_MAX:   20,               /* annonces globales relues */
  CLE_TS:     "tdl_notif_fa_ts" /* horodatage local des notifs FA */
};

var ICONE = "fi fi-sr-";        /* préfixe Flaticon solide */

/* ===================== ÉTAT ===================== */
var S = {
  perso:  {},                   /* id → notif */
  glob:   {},                   /* id → notif */
  etat:   { curseur: 0, lues: {}, masquees: {} },
  ouvert: 0,                    /* horodatage d'ouverture de session */
  pret:   false,
  flux:   null,
  sdk:    false,
  vu:     0                     /* dernier signe de vie du flux */
};

/* ===================== UTILS ===================== */
function N()  { return window.Notiffi; }
function E()  { return window.EcoCore; }
function REG(){ return (window.EcoNotif && window.EcoNotif.REGISTRE) || {}; }
function uid(){ try { var u = parseInt(_userdata.user_id, 10); return u > 0 ? String(u) : null; } catch (e) { return null; } }
function pseudo() { try { return _userdata.username ? String(_userdata.username).trim() : null; } catch (e) { return null; } }
function cle(s) { return String(s == null ? "" : s).replace(/[.$#\[\]\/]/g, "_"); }
function tsDe(id) { var m = String(id || "").match(/^tdl_(\d+)_/); return m ? parseInt(m[1], 10) : 0; }

/* eco-core garde BASE_URL en const privée : si tu ajoutes BASE_URL à son
   export, il devient la source unique et CFG.BASE ne sert plus à rien. */
function base() {
  var e = E();
  var b = (e && typeof e.BASE_URL === "string" && e.BASE_URL) || CFG.BASE;
  return String(b || "").replace(/\/+$/, "");
}

function ecrire(map) {
  try { var p = E().firebaseUpdate(map); if (p && p.catch) p.catch(function () {}); } catch (e) {}
}

function ilya(ts) {
  var d = Date.now() - (+ts || 0);
  if (d < 60000) return "à l'instant";
  if (d < 3600000) return "il y a " + Math.floor(d / 60000) + " min";
  if (d < 86400000) return "il y a " + Math.floor(d / 3600000) + " h";
  var j = Math.floor(d / 86400000);
  if (j === 1) return "hier";
  if (j < 7) return "il y a " + j + " jours";
  var t = new Date(+ts);
  return ("0" + t.getDate()).slice(-2) + "/" + ("0" + (t.getMonth() + 1)).slice(-2) + "/" + t.getFullYear();
}

/* ===================== HORODATAGE FA =====================
   time vaut « Aujourd'hui à 20:52 » : intriable. On date nous-mêmes chaque
   notif FA à sa découverte. Au tout premier chargement, les notifs déjà
   présentes sont rétro-datées en cascade — leur ordre relatif est conservé et
   elles passent sous tout ce qui arrivera ensuite. */
function indexFA() {
  try { return JSON.parse(localStorage.getItem(CFG.CLE_TS)) || {}; } catch (e) { return {}; }
}
function horodater(store) {
  var idx = indexFA(), vierge = !Object.keys(idx).length, now = Date.now(), n = store.length;
  store.forEach(function (s, i) {
    var id = s && s.text && s.text.id;
    if (id == null) return;
    if (idx[id] == null) idx[id] = vierge ? now - (n - i) * 1000 : now;
  });
  var ids = Object.keys(idx);
  if (ids.length > 50) {
    ids.sort(function (a, b) { return idx[a] - idx[b]; }).slice(0, ids.length - 50)
       .forEach(function (k) { delete idx[k]; });
  }
  try { localStorage.setItem(CFG.CLE_TS, JSON.stringify(idx)); } catch (e) {}
  return idx;
}

/* ===================== RENDU =====================
   Forme imposée par le template all_notifs : id, type, read, avatar, icon,
   text, time. avatar reste vide (nos notifications n'ont pas de visage : c'est
   la Main qui réclame, pas Jason) ; l'icône porte l'identité. */
function ico(def) {
  return def && def.ic ? '<i class="' + ICONE + def.ic + '"></i>' : "";
}

function objet(id, n, src) {
  var def = REG()[n.t] || {};
  var lu = (src === "g") ? !!S.etat.lues[id] : !!n.lu;
  return {
    id: id,
    type: "tdl " + (def.n || "tdl_autre"),
    read: lu ? "" : "unread",
    avatar: ico(def),
    icon: "",
    text: n.txt || "",
    time: ilya(n.ts),
    _ts: +n.ts || 0,
    _src: src,
    _url: n.url || "",
    /* id relu dans le DOM — voir le piège Potion en tête de fichier */
    deleteNotif: function (ev) { supprimer(idDom(ev)); }
  };
}

function liste() {
  var out = [];
  Object.keys(S.perso).forEach(function (id) {
    var n = S.perso[id];
    if (n && typeof n === "object") out.push(objet(id, n, "u"));
  });
  Object.keys(S.glob).forEach(function (id) {
    var n = S.glob[id];
    if (!n || typeof n !== "object") return;
    if (S.etat.masquees[id]) return;
    if ((+n.ts || 0) <= S.etat.curseur) return;
    out.push(objet(id, n, "g"));
  });
  return out;
}

function nonLues() {
  var k = 0;
  Object.keys(S.perso).forEach(function (id) { if (S.perso[id] && !S.perso[id].lu) k++; });
  Object.keys(S.glob).forEach(function (id) {
    var n = S.glob[id];
    if (n && !S.etat.masquees[id] && !S.etat.lues[id] && (+n.ts || 0) > S.etat.curseur) k++;
  });
  return k;
}

/* ===================== PATCH NOTIFFI ===================== */
function patcher() {
  var n = N();
  if (!n || n.__tdl) return false;
  n.__tdl = true;

  n.displayNotifications = async function () {
    var idx = horodater(this.store || []);
    var fa = (this.store && this.store.length) ? await this.renderNotif(this.store) : [];
    fa.forEach(function (o) { o._ts = idx[o.id] || 0; });
    var tout = liste().concat(fa).sort(function (a, b) { return (b._ts || 0) - (a._ts || 0); });
    this.syncStore.notifs = tout;
    this.syncStore.isEmpty = !tout.length;
  };

  n.handleUnread = function () {
    var k = (this.store || []).filter(function (x) { return !x.read; }).length + nonLues();
    this.unread = k;
    this.syncUnread.count = k ? k : "";
  };
  return true;
}

function rafraichir() {
  var n = N();
  if (!n || !n.syncStore) return;
  try { n.displayNotifications(); n.handleUnread(); } catch (e) {}
}

/* ===================== ACTIONS ===================== */
function idDom(ev) {
  var el = ev && ev.target && ev.target.closest && ev.target.closest("[data-notif-id]");
  return el ? el.getAttribute("data-notif-id") : null;
}

function supprimer(id) {
  var u = uid();
  if (!id || !u) return;
  var up = {};
  if (Object.prototype.hasOwnProperty.call(S.perso, id)) {
    delete S.perso[id];
    up[CFG.NODE + "/" + u + "/" + id] = null;
  } else if (Object.prototype.hasOwnProperty.call(S.glob, id)) {
    S.etat.masquees[id] = true;
    up[CFG.NODE_ETAT + "/" + u + "/masquees/" + id] = true;
  } else return;
  ecrire(up);
  rafraichir();
}

function marquerLu(ids) {
  var u = uid();
  if (!u || !ids.length) return;
  var up = {}, n = 0;
  ids.forEach(function (id) {
    if (S.perso[id]) {
      if (S.perso[id].lu) return;
      S.perso[id].lu = true;
      up[CFG.NODE + "/" + u + "/" + id + "/lu"] = true; n++;
    } else if (S.glob[id] && !S.etat.lues[id]) {
      S.etat.lues[id] = true;
      up[CFG.NODE_ETAT + "/" + u + "/lues/" + id] = true; n++;
    }
  });
  if (n) { ecrire(up); rafraichir(); }
}

function toutSupprimer() {
  var u = uid();
  if (!u) return;
  var up = {};
  Object.keys(S.perso).forEach(function (id) { up[CFG.NODE + "/" + u + "/" + id] = null; });
  Object.keys(S.glob).forEach(function (id) {
    if (S.etat.masquees[id]) return;
    S.etat.masquees[id] = true;
    up[CFG.NODE_ETAT + "/" + u + "/masquees/" + id] = true;
  });
  S.perso = {};
  if (Object.keys(up).length) ecrire(up);
  rafraichir();
}

/* ===================== ÉVÉNEMENTS ===================== */
function brancher() {
  /* clic sur une notification TDL : le template ne porte aucun lien, on délègue.
     window.open + stopPropagation — location.href renvoie 404 sur FA. */
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest && ev.target.closest('.notification[data-notif-id^="tdl_"]');
    if (!el) return;
    if (ev.target.closest(".notif_close, .alert_close")) return;
    var id = el.getAttribute("data-notif-id");
    var n = S.perso[id] || S.glob[id];
    marquerLu([id]);
    if (n && n.url) { ev.preventDefault(); ev.stopPropagation(); window.open(n.url, "_self"); }
  }, true);

  var lu = document.querySelector("#notiffi_mark_as_read");
  if (lu) lu.addEventListener("click", function () {
    marquerLu(Object.keys(S.perso).concat(Object.keys(S.glob)));
  });

  var del = document.querySelector("#notiffi_delete_all");
  if (del) del.addEventListener("click", toutSupprimer);

  /* filet : le flux a pu mourir en veille ou sur coupure réseau */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") verifier();
  });
  setInterval(verifier, CFG.VIE);
}

function verifier() {
  if (!S.flux) return;
  if (Date.now() - S.vu > CFG.VIE) { try { S.flux.close(); } catch (e) {} S.flux = null; flux(); }
}

/* ===================== ALERTE =====================
   Potion n'est pas exporté par le bundle : on rejoue le template alert_notif
   à la main. Il ne consomme pas [alert.icon] — l'icône prend donc la place de
   l'avatar, ce qui convient à des notifications sans visage. */
function alerte(id, n) {
  var tpl = document.querySelector('template[data-name="alert_notif"]');
  if (!tpl) return;
  var def = REG()[n.t] || {};
  var d = { type: "tdl " + (def.n || "tdl_autre"), avatar: ico(def), text: n.txt || "", icon: ico(def) };
  var h = tpl.innerHTML
    .replace(/\[alert\.([a-z0-9_]+)\]([\s\S]*?)\[\/alert\.\1\]/gi, function (m, k, inner) { return d[k] ? inner : ""; })
    .replace(/\[alert\.([a-z0-9_]+)\]/gi, function (m, k) { return d[k] == null ? "" : d[k]; });

  var el = new DOMParser().parseFromString(h, "text/html").body.firstElementChild;
  if (!el) return;
  el.setAttribute("data-notif-id", id);
  document.body.appendChild(el);          /* jamais dans le panneau : position:fixed piégé par FA */
  el.getBoundingClientRect();
  requestAnimationFrame(function () { el.classList.add("up"); });
  var t = (N() && N().__timeout) || 5000;
  var fermer = function () { el.classList.remove("up"); setTimeout(function () { el.remove(); }, 1000); };
  setTimeout(fermer, t);
  el.addEventListener("click", function (ev) {
    if (ev.target.closest("#alert_dismiss, .alert_close")) { ev.stopPropagation(); fermer(); return; }
    marquerLu([id]);
    if (n.url) { ev.preventDefault(); window.open(n.url, "_self"); }
  });
}

/* ===================== FLUX SDK =====================
   eco-core charge déjà firebase-database-compat et fait initializeApp : le SDK
   est donc disponible. Il multiplexe TOUTES les écoutes sur une seule
   websocket — perso + canal global pour une connexion au lieu de deux — et
   gère seul la reconnexion. On le préfère à EventSource quand il est là.
   Les enfants déjà présents déclenchent child_added à l'attache : le filtre
   ts > S.ouvert suffit à ne pas rejouer l'historique en alertes. */
function arrive(id, n, src) {
  if (!n || typeof n !== "object") return;
  var neuf = !(src === "g" ? S.glob[id] : S.perso[id]);
  if (src === "g") S.glob[id] = n; else S.perso[id] = n;
  rafraichir();
  if (neuf && (+n.ts || 0) > S.ouvert && !(src === "g" && S.etat.masquees[id])) alerte(id, n);
}

function fluxSDK() {
  var u = uid(), db;
  if (!u || !window.firebase || !firebase.apps || !firebase.apps.length) return false;
  try { db = firebase.database(); } catch (e) { return false; }
  if (!db) return false;
  try {
    var rp = db.ref(CFG.NODE + "/" + u);
    rp.on("child_added",   function (s) { arrive(s.key, s.val(), "u"); });
    rp.on("child_changed", function (s) { S.perso[s.key] = s.val(); rafraichir(); });
    rp.on("child_removed", function (s) { delete S.perso[s.key]; rafraichir(); });

    var rg = db.ref(CFG.NODE_GLOB).orderByKey().limitToLast(CFG.GLOB_MAX);
    rg.on("child_added",   function (s) { arrive(s.key, s.val(), "g"); });
  } catch (e) { return false; }
  S.sdk = true;
  return true;
}

/* ===================== FLUX REST (repli) ===================== */
function appliquer(chemin, data, premier) {
  var neuf = [];
  if (chemin === "/") {
    S.perso = (data && typeof data === "object") ? data : {};
  } else {
    var id = String(chemin || "").replace(/^\//, "").split("/")[0];
    if (!id) return neuf;
    if (data === null) delete S.perso[id];
    else if (chemin.indexOf("/", 1) > 0) {                   /* écriture d'un champ */
      if (S.perso[id]) S.perso[id][chemin.split("/").pop()] = data;
    } else {
      S.perso[id] = data;
      if (!premier && (+data.ts || 0) > S.ouvert) neuf.push([id, data]);
    }
  }
  return neuf;
}

function flux() {
  var u = uid(), b = base();
  if (!u || !b || typeof EventSource === "undefined") return false;
  var premier = true;
  try { S.flux = new EventSource(b + "/" + CFG.NODE + "/" + encodeURIComponent(u) + ".json"); }
  catch (e) { return false; }
  S.vu = Date.now();

  var gerer = function (ev) {
    S.vu = Date.now();
    var m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (!m) return;
    var neuf = appliquer(m.path, m.data, premier);
    premier = false;
    rafraichir();
    neuf.forEach(function (x) { alerte(x[0], x[1]); });
  };
  S.flux.addEventListener("put", gerer);
  S.flux.addEventListener("patch", gerer);
  S.flux.addEventListener("keep-alive", function () { S.vu = Date.now(); });
  S.flux.onerror = function () { S.vu = 0; };
  return true;
}

/* canal global : une annonce rare, une relecture légère */
function globales(premier) {
  var b = base();
  if (!b) return;
  fetch(b + "/" + CFG.NODE_GLOB + '.json?orderBy="$key"&limitToLast=' + CFG.GLOB_MAX)
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var neuf = [];
      Object.keys(d || {}).forEach(function (id) {
        if (S.glob[id]) return;
        S.glob[id] = d[id];
        if (!premier && (+d[id].ts || 0) > S.ouvert && !S.etat.masquees[id]) neuf.push([id, d[id]]);
      });
      if (Object.keys(d || {}).length) rafraichir();
      neuf.forEach(function (x) { alerte(x[0], x[1]); });
    })
    .catch(function () {});
}

/* mode dégradé : sans URL de base, tout passe par EcoCore */
function degrade() {
  setInterval(function () {
    try { if (E().invalidateCache) E().invalidateCache(); } catch (e) {}
    lire(false);
  }, CFG.POLL_DEG);
}

/* ===================== CHARGEMENT ===================== */
function lire(premier) {
  var u = uid();
  if (!u || !E() || !E().safeReadBin) return Promise.resolve();
  return Promise.resolve(E().safeReadBin()).then(function (rec) {
    rec = rec || {};
    var neuf = [];
    var p = (rec[CFG.NODE] || {})[u] || {};
    var g = rec[CFG.NODE_GLOB] || {};
    var e = (rec[CFG.NODE_ETAT] || {})[u] || {};

    S.etat.lues = e.lues || {};
    S.etat.masquees = e.masquees || {};
    if (e.curseur == null) {
      /* première connexion : on n'affiche pas l'historique des annonces */
      S.etat.curseur = Date.now();
      var up = {}; up[CFG.NODE_ETAT + "/" + u + "/curseur"] = S.etat.curseur;
      ecrire(up);
    } else S.etat.curseur = +e.curseur || 0;

    if (premier) { S.perso = p; S.glob = g; }
    else {
      Object.keys(p).forEach(function (id) {
        if (!S.perso[id] && (+p[id].ts || 0) > S.ouvert) neuf.push([id, p[id]]);
        S.perso[id] = p[id];
      });
      Object.keys(g).forEach(function (id) {
        if (!S.glob[id] && (+g[id].ts || 0) > S.ouvert && !S.etat.masquees[id]) neuf.push([id, g[id]]);
        S.glob[id] = g[id];
      });
    }
    reconcilier(rec, u);
    rafraichir();
    neuf.forEach(function (x) { alerte(x[0], x[1]); });
  }).catch(function () {});
}

/* notifs déposées sous un pseudo non résolu : on les rapatrie sous notre UID */
function reconcilier(rec, u) {
  var k = cle(pseudo());
  var src = (rec[CFG.NODE_PSEUDO] || {})[k];
  if (!src || !Object.keys(src).length) return;
  var up = {};
  Object.keys(src).forEach(function (id) {
    S.perso[id] = src[id];
    up[CFG.NODE + "/" + u + "/" + id] = src[id];
  });
  up[CFG.NODE_PSEUDO + "/" + k] = null;
  ecrire(up);
}

/* plafond et ancienneté — seul le propriétaire purge son nœud */
function purger(u) {
  var ids = Object.keys(S.perso).sort(function (a, b) { return tsDe(a) - tsDe(b); });
  var limite = Date.now() - CFG.PURGE_J * 86400000, up = {}, n = 0;
  ids.forEach(function (id, i) {
    if (tsDe(id) < limite || i < ids.length - CFG.PLAFOND) {
      delete S.perso[id];
      up[CFG.NODE + "/" + u + "/" + id] = null; n++;
    }
  });
  if (n) ecrire(up);
}

/* ===================== INIT ===================== */
function demarrer() {
  var u = uid();
  if (!u) return;
  S.ouvert = Date.now();
  patcher();
  brancher();
  lire(true).then(function () {
    purger(u);
    S.pret = true;
    rafraichir();
    if (!fluxSDK()) {
      if (flux()) { globales(true); setInterval(function () { globales(false); }, CFG.POLL_GLOB); }
      else degrade();
    }
    if (window.EcoNotif && window.EcoNotif.calendrier) window.EcoNotif.calendrier();
  });
}

function attendre() {
  var n = 0;
  var iv = setInterval(function () {
    if (N() && N().syncStore && E() && E().safeReadBin) { clearInterval(iv); demarrer(); }
    else if (++n > 80) { clearInterval(iv); if (window.console) console.warn("[NotiffiFB] Notiffi ou EcoCore introuvable."); }
  }, 250);
}

if (document.readyState === "complete") attendre();
else window.addEventListener("load", attendre);

window.NotiffiFB = { etat: S, rafraichir: rafraichir, lire: lire };

})();
