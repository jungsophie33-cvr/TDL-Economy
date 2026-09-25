/* THE DROWNED LANDS — ÉMISSION DES NOTIFICATIONS · JS
   Écrit les notifications dans Firebase. La RÉCEPTION et l'affichage sont dans
   notiffi-fb.js. Dépend de window.EcoCore (safeReadBin, firebaseUpdate,
   firebaseTransaction).

   DEUX RÉGIMES DE DIFFUSION
   - fan-out  : une copie par destinataire dans  notifs/{uid}/{id}
                (1 seul firebaseUpdate multi-chemins, donc atomique).
                Pour 1 personne, une bande, le staff. Chemins BRUTS.
   - global   : une seule écriture dans  notifs_globales/{id}, lue par tous
                avec un curseur individuel. Pour « tous les membres ».

   CLÉ = UID, jamais le pseudo : un changement de pseudo ne perd rien.
   Un pseudo non résolu tombe dans  notifs_pseudo/{pseudo}  et sera récupéré
   par son propriétaire à sa prochaine connexion (voir notiffi-fb.js).

   AJOUTER UNE NOTIFICATION = une ligne dans le REGISTRE ci-dessous + un appel
   EcoNotif.a() / .bande() / .staff() / .tous() à l'endroit du clic. */
(function () {
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  NODE:        "notifs",           /* notifs/{uid}/{id} */
  NODE_PSEUDO: "notifs_pseudo",    /* repli si UID non résolu */
  NODE_GLOB:   "notifs_globales",  /* canal « tous les membres » */
  NODE_FAITS:  "notifs_faits",     /* verrous anti-double-émission */
  NODE_META:   "notifs_meta",      /* compteurs (dernier événement calendrier) */
  NODE_MEMBRES:"membres",
  NODE_UID:    "uid_index",        /* uid_index/{uid} = pseudo */
  EVENTS_URL:  "/events",          /* [MAJ] page des événements FA */
  EV_THROTTLE: 15 * 60000,         /* relecture de /events au plus tous les 1/4 h */
  EV_CLE:      "tdl_notif_ev_check"
};

/* [MAJ] sujets porteurs */
var U = {
  ENQUETES: "/t86-le-panneau-des-enquetes",
  DETTES:   "/t92-le-tableau-des-dettes",
  MISSIONS: "/t90-le-tableau-des-missions",
  TACHES:   "/t91-le-tableau-des-taches",
  STAFF:    "/t73-gestion-systeme-de-jeu#466"
};

/* classes CSS de module (couleur) — voir CSS-notiffi-tdl.css */
var C = { BOUT:"tdl_boutique", MIS:"tdl_mission", MAIN:"tdl_main",
          FAV:"tdl_faveur", ENQ:"tdl_enquete", CAL:"tdl_calendrier" };

/* ===================== REGISTRE =====================
   n  = classe CSS de module · ic = icône Flaticon (préfixe fi-sr- ajouté au
   rendu) · url = cible du clic · txt(d) = libellé composé à l'émission.
   [MAJ] noms d'icônes à confronter au catalogue Uicons avant mise en ligne. */
var NOTIFS = {
  /* --- Boutique « Les Quais du Bayou » --- */
  100:{n:C.BOUT, ic:"bags-shopping",  url:"",          txt:function(d){return "Votre achat &laquo;&nbsp;"+esc(d.nom)+"&nbsp;&raquo; a été validé.";}},
  101:{n:C.BOUT, ic:"cross-circle",   url:"",          txt:function(d){return "Votre demande &laquo;&nbsp;"+esc(d.nom)+"&nbsp;&raquo; a été annulée. "+(+d.montant||0)+" $ vous ont été recrédités.";}},
  102:{n:C.BOUT, ic:"file-signature", url:U.DETTES,    txt:function(d){return "Une dette a été inscrite à votre nom : "+esc(d.motif)+".";}},
  103:{n:C.BOUT, ic:"inbox-in",       url:U.STAFF,     txt:function(d){return "Nouvelle demande d'achat de "+esc(d.pseudo)+" : &laquo;&nbsp;"+esc(d.nom)+"&nbsp;&raquo;.";}},

  /* --- Missions des Maringouins --- */
  110:{n:C.MIS,  ic:"mosquito",       url:U.MISSIONS,  txt:function(d){return "Nouvelle mission ouverte : &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo; — prime "+(+d.prime||0)+" $.";}},
  111:{n:C.MIS,  ic:"user-check",     url:U.MISSIONS,  txt:function(d){return esc(d.chef)+" prend la tête de votre mission &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo;.";}},
  112:{n:C.MIS,  ic:"comment-dollar", url:U.MISSIONS,  txt:function(d){return "Renégociation de la prime sur &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo; : "+(+d.montant||0)+" $ demandés.";}},
  113:{n:C.MIS,  ic:"handshake",      url:U.MISSIONS,  txt:function(d){return "Votre renégociation sur &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo; a été "+(d.ok?"acceptée":"refusée")+".";}},
  114:{n:C.MIS,  ic:"inbox-in",       url:U.MISSIONS,  txt:function(d){return "La mission &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo; demande votre validation.";}},
  115:{n:C.MIS,  ic:"sack-dollar",    url:U.MISSIONS,  txt:function(d){return "Mission &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo; validée : "+(+d.montant||0)+" $ vous ont été versés.";}},
  116:{n:C.MIS,  ic:"rotate-left",    url:U.MISSIONS,  txt:function(d){return "Faute de cellule volontaire, &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo; est close. Votre prime vous est rendue.";}},

  /* --- Dossiers de la Main de la Providence ---
     Règle : la notification annonce, elle ne raconte pas. Aucun montant,
     aucun doigt, aucun motif — le tableau filtre déjà ce que chacun peut voir. */
  120:{n:C.MAIN, ic:"hands-usd",      url:U.DETTES,    txt:function(){return "La Main estime nécessaire de recouvrer la dette que vous avez contractée auprès d'elle. Veuillez consulter le tableau des dettes.";}},
  121:{n:C.MAIN, ic:"comment-check",  url:U.DETTES,    txt:function(d){return esc(d.pseudo)+" a "+(d.ok?"donné":"refusé")+" son accord sur un dossier.";}},
  122:{n:C.MAIN, ic:"folder-open",    url:U.DETTES,    txt:function(d){return "Nouveau dossier ouvert : &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo;.";}},
  123:{n:C.MAIN, ic:"user-shield",    url:U.DETTES,    txt:function(d){return "La Main s'est saisie du dossier &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo;.";}},
  124:{n:C.MAIN, ic:"lock",           url:U.DETTES,    txt:function(d){return "Une somme de "+(+d.montant||0)+" $ est retenue sur votre solde.";}},
  125:{n:C.MAIN, ic:"badge-check",    url:U.DETTES,    txt:function(){return "Votre dette envers la Main est acquittée.";}},
  126:{n:C.MAIN, ic:"shield-check",   url:U.DETTES,    txt:function(d){return esc(d.pseudo)+" fait appel à la protection de la Main.";}},

  /* --- Faiseuses d'Anges --- */
  130:{n:C.FAV,  ic:"hand-holding-heart", url:U.TACHES, txt:function(d){return "Une faveur est soumise au vote : &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo;.";}},
  131:{n:C.FAV,  ic:"comment-check",  url:U.TACHES,    txt:function(d){return "Votre demande de faveur a été "+(d.ok?"acceptée":"refusée")+".";}},
  132:{n:C.FAV,  ic:"comment-slash",  url:U.TACHES,    txt:function(){return "Un silence a été rompu. Le canal d'urgence est ouvert.";}},

  /* --- Panneau des enquêtes --- */
  140:{n:C.ENQ,  ic:"badge-sheriff",  url:U.ENQUETES,  txt:function(d){return "Nouvelle enquête ouverte : &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo;.";}},
  141:{n:C.ENQ,  ic:"user-add",       url:U.ENQUETES,  txt:function(d){return esc(d.pseudo)+" rejoint votre enquête &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo;.";}},
  142:{n:C.ENQ,  ic:"user-add",       url:U.ENQUETES,  txt:function(d){return esc(d.pseudo)+" s'inscrit à l'enquête &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo;.";}},
  143:{n:C.ENQ,  ic:"file-add",       url:U.ENQUETES,  txt:function(d){return "Un nouvel élément a été versé à &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo;.";}},
  144:{n:C.ENQ,  ic:"hourglass-end",  url:U.ENQUETES,  txt:function(d){return "L'enquête &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo; passe en instance de validation.";}},
  145:{n:C.ENQ,  ic:"inbox-in",       url:U.ENQUETES,  txt:function(d){return "L'enquête &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo; demande votre validation.";}},
  146:{n:C.ENQ,  ic:"sack-dollar",    url:U.ENQUETES,  txt:function(d){return "Enquête &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo; close : "+(+d.montant||0)+" $ vous ont été versés.";}},
  147:{n:C.ENQ,  ic:"user-crown",     url:U.ENQUETES,  txt:function(d){return esc(d.pseudo)+" demande à devenir référent de &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo;.";}},
   
  /* --- Calendrier --- */
  150:{n:C.CAL,  ic:"drama-masks",    url:"/calendar", txt:function(d){return "Nouvelle intrigue : &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo;.";}},
  151:{n:C.CAL,  ic:"calendar-star",  url:"/calendar", txt:function(d){return "Nouvel événement membre : &laquo;&nbsp;"+esc(d.titre)+"&nbsp;&raquo;.";}}
};

/* tags du calendrier → type de notification (miroir de TYPE_MAP dans tdl-calendar) */
var TAGS = [["[INTRIGUE]", 150], ["[EV. MEMBRE]", 151]];

/* ===================== UTILS ===================== */
function E() { return window.EcoCore; }
function ok() { return !!(E() && E().firebaseUpdate && E().safeReadBin); }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
/* clé Firebase valide : ni . $ # [ ] / */
function cle(s) { return String(s == null ? "" : s).replace(/[.$#\[\]\/]/g, "_"); }
function newId(ts) { return "tdl_" + ts + "_" + Math.random().toString(36).slice(2, 7); }
function monUid() { try { var u = parseInt(_userdata.user_id, 10); return u > 0 ? String(u) : null; } catch (e) { return null; } }
function monPseudo() { try { return _userdata.username ? String(_userdata.username).trim() : null; } catch (e) { return null; } }

/* ===================== INDEX ===================== */
var INV = null;   /* pseudo → uid */
var MEM = null;   /* snapshot membres */

function charger() {
  if (INV && MEM) return Promise.resolve();
  if (!ok()) return Promise.reject(new Error("EcoCore absent"));
  return Promise.resolve(E().safeReadBin()).then(function (rec) {
    rec = rec || {};
    MEM = rec[CFG.NODE_MEMBRES] || {};
    INV = {};
    var ix = rec[CFG.NODE_UID] || {};
    Object.keys(ix).forEach(function (uid) {
      var p = String(ix[uid] == null ? "" : ix[uid]).trim();
      if (p) INV[p] = String(uid);
    });
  });
}

/* pseudos → { uids, restes } ; l'émetteur ne se notifie jamais lui-même */
function resoudre(pseudos) {
  var moiU = monUid(), moiP = monPseudo(), uids = [], restes = [], vus = {};
  [].concat(pseudos || []).forEach(function (p) {
    p = String(p == null ? "" : p).trim();
    if (!p || p === moiP) return;
    var u = INV[p] || null;
    if (u) {
      if (u === moiU || vus["u" + u]) return;
      vus["u" + u] = 1; uids.push(u);
    } else {
      if (vus["p" + p]) return;
      vus["p" + p] = 1; restes.push(p);
    }
  });
  return { uids: uids, restes: restes };
}

function membresDe(bande) {
  return Object.keys(MEM || {}).filter(function (p) {
    var h = MEM[p] && MEM[p].hors_la_loi;
    return !!(h && h.bande === bande);
  });
}

/* ===================== ÉMISSION ===================== */
function paquet(type, d, ref) {
  var def = NOTIFS[type];
  d = d || {};
  return {
    t: type,
    txt: def.txt(d),
    url: d.url || def.url || "",
    ts: Date.now(),
    lu: false,
    ref: ref || ""
  };
}

/* fan-out : 1 PATCH multi-chemins, chemins BRUTS (jamais encodeURIComponent) */
function envoyer(pseudos, type, d, ref) {
  if (!NOTIFS[type] || !ok()) return Promise.resolve();
  return charger().then(function () {
    var cib = resoudre(pseudos);
    if (!cib.uids.length && !cib.restes.length) return;
    var n = paquet(type, d, ref), id = newId(n.ts), up = {};
    cib.uids.forEach(function (u) { up[CFG.NODE + "/" + u + "/" + id] = n; });
    cib.restes.forEach(function (p) { up[CFG.NODE_PSEUDO + "/" + cle(p) + "/" + id] = n; });
    return E().firebaseUpdate(up);
  }).catch(function (e) { if (window.console) console.error("[EcoNotif] envoi", e); });
}

/* canal global : une écriture unique, lue par tous via curseur individuel */
function global(type, d, ref) {
  if (!NOTIFS[type] || !ok()) return Promise.resolve();
  var n = paquet(type, d, ref), up = {};
  up[CFG.NODE_GLOB + "/" + newId(n.ts)] = n;
  return Promise.resolve(E().firebaseUpdate(up))
    .catch(function (e) { if (window.console) console.error("[EcoNotif] global", e); });
}

/* verrou : sur un événement CONSTATÉ (pas cliqué), un seul client émet.
   Même patron que le drapeau rembourse du tableau des missions. */
function uneFois(verrou, fn) {
  if (!ok() || !E().firebaseTransaction) return Promise.resolve();
  var path = CFG.NODE_FAITS + "/" + encodeURIComponent(cle(verrou));
  var pr;
  try {
    pr = E().firebaseTransaction(path, function (cur) {
      if (cur) throw new Error("DEJA");
      return Date.now();
    });
  } catch (e) { return Promise.resolve(); }
  return Promise.resolve(pr).then(fn).catch(function (e) {
    if (e && e.message === "DEJA") return;
    if (window.console) console.error("[EcoNotif] verrou", e);
  });
}

/* ===================== CALENDRIER =====================
   Aucun webhook sur FA : la détection se fait au passage d'un membre.
   /events est lu au plus tous les 1/4 h, et un seul client émet (transaction
   sur le compteur). Premier passage = amorçage silencieux. */
function typeDe(titre) {
  var t = String(titre || "").toUpperCase();
  for (var i = 0; i < TAGS.length; i++) if (t.indexOf(TAGS[i][0]) >= 0) return TAGS[i][1];
  return null;
}
function nettoyer(titre) {
  var t = String(titre || "");
  TAGS.forEach(function (x) { t = t.replace(new RegExp("\\" + x[0].replace(/[\[\]().]/g, "\\$&"), "gi"), ""); });
  return t.replace(/\s+/g, " ").trim();
}

function scanner(html) {
  var tmp = document.createElement("div");
  tmp.innerHTML = html;
  var out = [], vus = {};
  Array.prototype.forEach.call(tmp.querySelectorAll('a[href*="/e"]'), function (a) {
    var m = (a.getAttribute("href") || "").match(/\/e(\d+)-/);
    if (!m) return;
    var id = parseInt(m[1], 10);
    if (!id || vus[id]) return;
    var t = (a.getAttribute("title") || a.textContent || "").trim();
    if (!t) {
      var row = a.closest('[class*="event"]');
      var te = row && row.querySelector(".event_title, h3, h2");
      t = te ? te.textContent.trim() : "";
    }
    vus[id] = 1;
    out.push({ id: id, titre: t, href: a.getAttribute("href") });
  });
  return out;
}

function traiterEvents(evs) {
  if (!evs.length || !ok() || !E().firebaseTransaction) return;
  var max = 0;
  evs.forEach(function (e) { if (e.id > max) max = e.id; });
  var ancien = null, amorce = false, pr;
  try {
    pr = E().firebaseTransaction(CFG.NODE_META + "/dernier_event", function (cur) {
      ancien = (cur == null ? null : parseInt(cur, 10));
      amorce = (cur == null);
      if (!amorce && max <= ancien) throw new Error("DEJA");
      return max;
    });
  } catch (e) { return; }
  Promise.resolve(pr).then(function () {
    if (amorce) return;                       /* première fois : on n'inonde pas */
    evs.forEach(function (e) {
      if (e.id <= ancien) return;
      var t = typeDe(e.titre);
      if (t) global(t, { titre: nettoyer(e.titre), url: e.href }, "ev" + e.id);
    });
  }).catch(function () { /* DEJA : un autre client s'en est chargé */ });
}

function calendrier() {
  if (!monUid()) return;
  var last = 0;
  try { last = parseInt(localStorage.getItem(CFG.EV_CLE), 10) || 0; } catch (e) {}
  if (Date.now() - last < CFG.EV_THROTTLE) return;
  try { localStorage.setItem(CFG.EV_CLE, String(Date.now())); } catch (e) {}
  fetch(CFG.EVENTS_URL, { credentials: "same-origin" })
    .then(function (r) { return r.text(); })
    .then(function (html) { traiterEvents(scanner(html)); })
    .catch(function () {});
}

/* ===================== API ===================== */
window.EcoNotif = {
  CFG: CFG, URLS: U, REGISTRE: NOTIFS,

  /* un ou plusieurs pseudos */
  a: function (cible, type, d, ref) { return envoyer([].concat(cible), type, d, ref); },

  /* une bande hors-la-loi : main, maringouins, braconneurs, faiseuses, sorcieres, flottille */
  bande: function (b, type, d, ref) {
    return charger().then(function () { return envoyer(membresDe(b), type, d, ref); })
      .catch(function () {});
  },

  staff: function (type, d, ref) {
    var l = (E() && E().ADMIN_USERS) || [];
    return envoyer(l, type, d, ref);
  },

  /* tous les membres — canal global, jamais de fan-out */
  tous: function (type, d, ref) { return global(type, d, ref); },

  uneFois: uneFois,
  calendrier: calendrier,
  rafraichir: function () { INV = null; MEM = null; }
};

})();
