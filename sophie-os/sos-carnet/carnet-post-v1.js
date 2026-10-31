/* =============================================================
   CARNET — MOTEUR DE PUBLICATION (carnet-post.js)
   -------------------------------------------------------------
   Le seul fichier qui parle à ForumActif en écriture. Publie un
   fragment par la réponse rapide (POST /post en urlencoded, les
   champs tid/lt… recopiés depuis le formulaire #quick_reply),
   édite un tableau de moodboard par sa page d'édition native,
   rafraîchit le carnet sans recharger la page (la musique du
   mini-lecteur continue), arme l'anti-flood (10 s) et, en repli,
   rend la réponse classique si le moteur échoue.
   Analyse du retour : message d'erreur FA, meta refresh, ou
   redirection vers le sujet publié.
   Dépendances : carnet-core.js puis carnet-shell.js (CARNETUI),
   chargés avant. Expose window.CARNETPOST, utilisé par
   carnet-ajout.js — jamais l'inverse.
   ============================================================= */
(function (global) {
'use strict';

var CARNET = global.CARNET, UI = global.CARNETUI;
if (!CARNET || !UI) {
  if (global.console) console.error('carnet-post.js : carnet-core.js puis carnet-shell.js doivent être chargés avant.');
  return;
}
function journal(nom) { return function (m) { if (global.console) console.warn('[CARNET ' + nom + '] ' + m); }; }
var jrn = journal('post');

/* ------------------------------------------------------- 1. CONFIG */
var CFG = {
  formReponse: 'form#quick_reply, #quick_reply form',  /* ta template : le form porte l'id lui-même */
  actionRepli: '/post',
  boutonPublier: '#cf-vol-publier',
  delaiFlood: 10,                        /* secondes — confirmé sur le forum */
  messages: {
    publie: 'Fragment publié — le carnet se rafraîchit…',
    flood: 'Trop rapide — ForumActif demande d\u2019attendre un instant.',
    erreur: 'Publication refusée par le forum — repli sur la réponse classique.',
    reseau: 'Le forum n\u2019a pas répondu — repli sur la réponse classique.',
    rafraichi: 'Carnet à jour.'
  }
};

/* ------------------------------------------------------- 2. CHAMPS */
/* Le formulaire de réponse rapide porte tous les champs requis
   (tid, lt, mode…) : on les recopie tels quels, on n'en invente
   aucun. La valeur de publication s'appelle « post » chez FA. */
function champsReponse() {
  var form = document.querySelector(CFG.formReponse);
  if (!form) return null;
  var champs = {};
  Array.prototype.forEach.call(form.querySelectorAll('input, select'), function (e) {
    if (!e.name || e.name === 'message' || e.name === 'post') return;
    if ((e.type === 'checkbox' || e.type === 'radio') && !e.checked) return;
    champs[e.name] = e.value;
  });
  return { action: form.getAttribute('action') || CFG.actionRepli, champs: champs };
}
function urlencoder(paires) {
  return Object.keys(paires).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(paires[k]);
  }).join('&');
}
function postUrlencode(url, paires) {
  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: urlencoder(paires)
  }).then(function (r) { return r.text().then(function (t) { return { texte: t, url: r.url, statut: r.status }; }); });
}

/* ------------------------------------------------------- 3. ANALYSE DU RETOUR */
/* Trois formes de retour côté FA : un message d'erreur (flood,
   champ manquant), un meta refresh vers le sujet, ou une
   redirection déjà suivie. Aucun rechargement au moindre prix :
   c'est l'appelant qui décide du repli. */
function analyseRetour(retour) {
  var t = retour.texte || '';
  if (/<meta[^>]+http-equiv=["']?refresh/i.test(t)) {
    var m = t.match(/content=["']?\d+;\s*url=([^"'>]+)/i);
    if (m) return { ok: true, type: 'refresh', url: m[1] };
  }
  if (/(Vous devez patienter|patientez avant|flood|trop rapide)/i.test(t)) return { ok: false, type: 'flood' };
  if (/id=["']?error|class=["'][^"']*error/i.test(t)) return { ok: false, type: 'erreur' };
  if (retour.url && /\/t\d+/.test(retour.url) && retour.statut < 400) return { ok: true, type: 'redirection' };
  if (/\/t\d+[^"']*/.test(t)) return { ok: true, type: 'lien' };
  return { ok: false, type: 'inconnu' };
}

/* ------------------------------------------------------- 4. PUBLIER */
function envoyer(corps) {
  var c = champsReponse();
  if (!c) return Promise.resolve({ ok: false, type: 'pasconnecte' });
  var paires = {};
  Object.keys(c.champs).forEach(function (k) { paires[k] = c.champs[k]; });
  paires.message = corps;
  paires.post = 'Envoyer';
  return postUrlencode(c.action, paires).then(function (r) {
    var a = analyseRetour(r);
    return a;
  }).catch(function (e) {
    jrn('envoi impossible : ' + (e && e.message));
    return { ok: false, type: 'reseau' };
  });
}

/* ------------------------------------------------------- 5. ÉDITER UN POST */
/* Le moodboard existant se modifie par SA page d'édition native :
   on fetch le formulaire, on recopie ses champs, on remplace le
   message, on renvoie. Le gating FA fait foi : sans editUrl dans
   le post, la fonction refuse. */
function editerTableau(editUrl, message) {
  if (!editUrl) return Promise.resolve({ ok: false, type: 'interdit' });
  return fetch(editUrl, { credentials: 'same-origin' }).then(function (r) { return r.text(); })
  .then(function (html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var form = doc.querySelector('form[action*="/post"]');
    if (!form) return { ok: false, type: 'erreur' };
    var paires = {};
    Array.prototype.forEach.call(form.querySelectorAll('input, select'), function (e) {
      if (!e.name || e.name === 'message') return;
      if ((e.type === 'checkbox' || e.type === 'radio') && !e.checked) return;
      paires[e.name] = e.value;
    });
    paires.message = message;
    var submit = form.querySelector('input[type="submit"]');
    if (submit && submit.name) paires[submit.name] = submit.value;
    return postUrlencode(form.getAttribute('action') || '/post', paires).then(function (r) { return analyseRetour(r); });
  }).catch(function (e) {
    jrn('édition impossible : ' + (e && e.message));
    return { ok: false, type: 'reseau' };
  });
}

/* ------------------------------------------------------- 6. ANTI-FLOOD */
/* 10 secondes, confirmées : le bouton publier se refroidit avec
   un compte à rebours — le membre voit pourquoi. */
var floodT = null;
function armerFlood(apres) {
  var b = document.querySelector(CFG.boutonPublier);
  if (!b) return;
  var reste = CFG.delaiFlood;
  b.disabled = true;
  var libelle = b.textContent;
  if (floodT) clearInterval(floodT);
  floodT = setInterval(function () {
    reste--;
    if (reste <= 0) { clearInterval(floodT); floodT = null; b.disabled = false; b.textContent = libelle; if (apres) apres(); return; }
    b.textContent = reste + ' s';
  }, 1000);
}

/* ------------------------------------------------------- 7. RAFRAÎCHIR */
/* Relecture complète du sujet (page + pagination), reconstruction
   des fragments, refaire() — jamais location.reload : la musique
   du mini-lecteur continuerait pas sinon. Le diff d'ids ne sert
   qu'au compte rendu. */
function rafraichirApresPost() {
  var O = CARNET.outils;
  return fetch(location.href, { credentials: 'same-origin' }).then(function (r) { return r.text(); })
  .then(function (html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var posts = O.lirePage(doc);
    var anciens = {};
    (CARNET.fragments || []).forEach(function (f) { anciens[String(f.post.id) + '/' + f.type] = 1; });
    var fragments = O.fragmentsDe(posts);
    var urls = {};
    Array.prototype.forEach.call(doc.querySelectorAll('.sj-wrap .sub-header .pagination span a'), function (a) {
      var href = a.getAttribute('href'); if (!href) return;
      var u = href.indexOf('http') === 0 ? href : location.origin + href;
      if (u !== location.href) urls[u] = 1;
    });
    var jobs = Object.keys(urls).map(function (u) {
      return fetch(u, { credentials: 'same-origin' }).then(function (r) { return r.text(); })
      .then(function (h) { return O.fragmentsDe(O.lirePage(new DOMParser().parseFromString(h, 'text/html'))); })
      .catch(function () { return []; });
    });
    return Promise.all(jobs).then(function (pack) {
      var tous = fragments.concat([].concat.apply([], pack));
      CARNET.refaire(CARNET.coquille, tous, posts[0] && posts[0].avatar);
      var nouveaux = tous.filter(function (f) { return !anciens[String(f.post.id) + '/' + f.type]; }).length;
      UI.rafraichir();
      return nouveaux;
    });
  }).catch(function (e) {
    jrn('rafraîchissement impossible : ' + (e && e.message));
    return -1;
  });
}

/* ------------------------------------------------------- 8. REPLI CLASSIQUE */
/* Le moteur a échoué : on rend la réponse classique au membre,
   avec le corps déjà écrit dedans — rien ne se perd. */
function ouvrirReponseClassique(corps) {
  document.body.classList.add('cf-repli');
  var qr = document.querySelector(CFG.formReponse);
  if (qr) {
    var ta = qr.querySelector('textarea[name="message"]') || qr.querySelector('textarea');
    if (ta) ta.value = corps;
  }
  if (qr && qr.scrollIntoView) qr.scrollIntoView({ behavior: 'smooth' });
}

/* ------------------------------------------------------- 9. EXPORT */
global.CARNETPOST = {
  CFG: CFG,
  envoyer: envoyer,
  editerTableau: editerTableau,
  armerFlood: armerFlood,
  rafraichirApresPost: rafraichirApresPost,
  ouvrirReponseClassique: ouvrirReponseClassique,
  _t: { champsReponse: champsReponse, analyseRetour: analyseRetour, urlencoder: urlencoder }
};

})(window);
