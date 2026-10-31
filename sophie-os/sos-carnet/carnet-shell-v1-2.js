/* =============================================================
   CARNET — LA UNE / COQUILLE (carnet-shell.js)
   -------------------------------------------------------------
   [v3-1] Alignement dépôt : libellés centralisés dans CFG ; plus aucune
   couleur en JS (teinteDe rend des var(--grN-…) du :root du forum) ;
   substitut SVG remplacé par des états vides stylés par carnet.css ;
   fiches, vues et recherche déménagent dans carnet-fiches.js.
   Rôle : squelette de la une (hero, grille 2x2, pnjbar, post-it,
   roue, vol vide, toast, mini-lecteur), remplissage depuis
   CARNET.coquille/donnees, couches ouvrir/fermer + pile + Échap,
   flip des cases. Se monte sur « carnet:pret », sinon déclenche
   lui-même CARNET.charger() — et se tait sur un sujet sans carnet.
   Charge après carnet-core.js ; expose window.CARNETUI, socle des
   modules fiches / ajout / post / contrib.
   ============================================================= */
(function (global) {
'use strict';
var CARNET = global.CARNET;
if (!CARNET) {
  if (global.console) console.error('carnet-shell.js : carnet-core.js doit être chargé avant.');
  return;
}
/* ------------------------------------------------------- 1. CONFIG */
/* Tout libellé affiché vit ici — aucune chaîne dans les fonctions.
   Les couleurs ne figurent pas dans ce fichier : elles viennent du
   :root du forum via des var(--grN-color) rendues par teinteDe. */
var CFG = {
  stamp: 'https://www.aht.li/3994776/Pngtrelouisiana_bayou_and_alligator_oval_15502538.png',
  recherche: 'rechercher dans le carnet…',
  accueil: 'Accueil du forum',
  avatarAlt: 'Avatar',
  ajouter: 'Ajouter un fragment',
  publier: 'Publier',
  volAide: 'L\u2019interface écrit les marqueurs — le membre écrit le contenu.',
  playlistAttente: 'en attente d\u2019une playlist',
  replier: 'Replier',
  ouvrirRoue: 'Ouvrir la roue',
  retour: 'retour',
  laUne: 'la une',
  modifier: 'Modifier (page d\u2019édition FA)',
  supprimer: 'Supprimer (post FA)',
  fermer: 'Fermer',
  fermerRoue: 'fermer',
  aideRoue: 'Échap pour refermer',
  caseVide: 'Rien ici pour l\u2019instant — le carnet attend.',
  plusTot: 'Plus tôt',
  journal: 'journal intime',
  stats: { fragments: 'fragments', pnj: 'pnj', souvenirs: 'souvenirs', cartes: 'cartes' },
  cases: [
    { cat: 'recits', titre: 'Récits', icone: 'fi-sr-book-open-cover' },
    { cat: 'anecdotes', titre: 'Anecdotes', icone: 'fi-sr-theater-masks' },
    { cat: 'souvenirs', titre: 'Souvenirs', icone: 'fi-sr-time-past' }],
  roue: {
    noyau: 'moodboard',
    sats: [
      { vue: 'objets', lib: 'objets', ent: 'ce qui reste' },
      { vue: 'citations', lib: 'pensées', ent: 'le fil des jours' },
      { vue: 'poemes', lib: 'poèmes', ent: 'à voix basse' },
      { vue: 'cartes', lib: 'cartes reçues', ent: 'de loin' }]
  },
  pnjbarExplorer: 'découvrir tout l\u2019entourage',
  postitVide: 'Aucun post-it à épingler. Postez-en un.',
  postitToutes: 'tous les post-it ›',
  tableau: 'tableau',
  tableaux: 'tableaux',
  toastModule: 'Le module d\u2019ajout n\u2019est pas chargé.',
  ajoutBoutonIc: 'fi-sr-plus'
};
function journal(nom) { return function (m) { if (global.console) console.warn('[CARNET ' + nom + '] ' + m); }; }
var jrn = journal('shell');
/* ------------------------------------------------------- 2. OUTILS */
var $  = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
function initiales(n) {
  return String(n || '?').split(/\s+/).map(function (m) { return m.charAt(0); }).join('').slice(0, 2);
}
/* teinte d'un pseudo : les groupes connus rendent var(--grN-…),
   un pseudo inconnu hache vers l'un des six — la valeur reste
   une variable CSS, jamais une couleur en dur dans ce script. */
var GROUPE_TEINTE = { goulipiats: 'gr1', fardoches: 'gr2', ashlander: 'gr3', spectres: 'gr4', perles: 'gr5' };
function teinteDe(nom, suffixe, groupe) {
  var g = groupe && GROUPE_TEINTE[String(groupe).toLowerCase()];
  if (g) return 'var(--' + g + '-' + (suffixe || 'color') + ')';
  var h = 0; nom = String(nom || 'x');
  for (var i = 0; i < nom.length; i++) { h = (h * 31 + nom.charCodeAt(i)) % 997; }
  return 'var(--gr' + (h % 6 + 1) + '-' + (suffixe || 'color') + ')';
}
function teintePostit(t) { return /^(gr[1-6]-20)$/.test(String(t || '')) ? t : 'gr2-20'; }
function videSi(liste) { return liste.length ? '' : '<p class="cf-case-vide">' + CFG.caseVide + '</p>'; }

/* vues de données (partagées avec carnet-fiches.js) */
var O = null, D = null;               /* CARNET.outils / CARNET.donnees */
var PROPRIETAIRE = '', PROPRIO_VILLE = '', CONNECTE = false, moodBoard = 0;
var vueOuverte = null, lectureOuverte = null;
function parId(liste, id) {
  return liste.filter(function (f) { return String(f.post.id) === String(id); })[0] || null;
}
function anneeS(f) { var m = String(f.val('QUAND') || '').match(/(\d{4})/); return m ? +m[1] : 0; }
var MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function cleDate(f) {
  var q = String(f.val('QUAND') || '').toLowerCase(), a = q.match(/(\d{4})/), m = 0;
  if (a) return +a[1] * 100;
  MOIS.some(function (mo, i) { if (q.indexOf(mo) >= 0) { m = i + 1; return true; } return false; });
  return m;
}
function recitsChrono() { return D.recits.slice().sort(function (a, b) { return cleDate(a) - cleDate(b); }); }
function souvenirsRecents() { return D.souvenirs.slice().reverse(); } /* core : ancien → récent */
function titrePlaylist(f) { return f.val('TITRE') || f.val('HUMEUR') || 'Playlist'; }
function premierTexte(f) {
  var t = '';
  f.entrees.some(function (e) { if (e.c === 'TEXTE' && e.v) { t = e.v; return true; } return false; });
  return t;
}
function partagesDe(f) { return ((CARNETUI.contribs || {})[String(f.post.id)] || {}).partages || []; }
function commentairesDe(f) { return ((CARNETUI.contribs || {})[String(f.post.id)] || {}).commentaires || []; }
function cartesRecues() { return CARNETUI.cartes || []; }
function resoudre(s) { return O.resoudreRef(s, CARNET.registre); }
/* ------------------------------------------------------- 3. SQUELETTE */
function squelette() {
  var cases = CFG.cases.map(function (c) {
    return '<article class="cf-case cf-case-' + c.cat + '" data-cat="' + c.cat + '"><div class="cf-case-tete">' +
      '<i class="fi ' + c.icone + '"></i><h3>' + c.titre + '</h3><span class="cf-case-n"></span>' +
      '<button class="cf-case-replier" title="' + CFG.replier + '"><i class="fi fi-sr-cross-small"></i></button></div>' +
      '<div class="cf-apercu"></div><div class="cf-liste"' +
      (c.cat === 'souvenirs' ? '><div class="cf-souv-grid" id="cf-souv-grid"></div>' : '') + '</div></article>';
  }).join('');
  var sats = CFG.roue.sats.map(function (s, i) {
    var pos = [[131,-131],[131,131],[-131,131],[-131,-131]][i % 4];
    return '<button class="cf-sat" style="--i:' + (i + 1) + ';--dx:' + pos[0] + 'px;--dy:' + pos[1] +
      'px" data-vue="' + s.vue + '"><span class="cf-sat-nb"></span><span class="cf-sat-lib">' + s.lib +
      '</span><span class="cf-sat-ent">' + s.ent + '</span></button>';
  }).join('');
  return '<div class="cf-app" id="cf-app">' +
  '<section class="cf-hero"><div class="cf-hero-img" id="cf-hero-img"></div><div class="cf-hero-haut">' +
  '<button class="cf-home" data-accueil title="' + CFG.accueil + '"><i class="fi fi-tr-house-flood"></i></button>' +
  '<button class="cf-playlist" id="cf-playlist-btn"><i class="fi fi-sr-music-note"></i><span class="cf-playlist-t"></span></button>' +
  '<div class="cf-cherche"><input id="cf-cherche" type="search" placeholder="' + CFG.recherche + '" autocomplete="off">' +
  '<div class="cf-resultats" id="cf-resultats"></div></div></div>' +
  '<div class="cf-hero-bas"><div class="cf-hero-main">' +
  '<div class="cf-hero-emblem"><img id="cf-hero-emblem-img" src="" alt="' + CFG.avatarAlt + '" hidden></div>' +
  '<div class="cf-hero-id"><h2 id="cf-hero-nom"></h2><div class="cf-hero-mc" id="cf-hero-mc"></div></div></div>' +
  '<div class="cf-hero-d"><div class="cf-hero-stats" id="cf-stats"></div>' +
  '<button class="cf-add" id="cf-add"><i class="fi ' + CFG.ajoutBoutonIc + '"></i>' + CFG.ajouter + '</button></div></div></section>' +
  '<main class="cf-grille" id="cf-grille">' + cases +
  '<article class="cf-case cf-case-mood" data-cat="mood" title="Moodboard">' +
  '<div class="cf-mood-img cf-mood-img1"></div><div class="cf-mood-img cf-mood-img2"></div><div class="cf-mood-img cf-mood-img3"></div>' +
  '<button class="cf-mood-plus" title="' + CFG.ouvrirRoue + '"><i class="fi fi-sr-plus"></i></button></article></main>' +
  '<section class="cf-pnjbar" id="cf-pnjbar"></section><div class="cf-postit" id="cf-postit"></div></div>' +
  '<div class="cf-roue" id="cf-roue"><div class="cf-roue-voile" data-fermer="roue"></div><div class="cf-roue-scene">' +
  '<div class="cf-roue-ray" style="transform:rotate(-45deg)"></div><div class="cf-roue-ray" style="transform:rotate(45deg)"></div>' +
  '<div class="cf-roue-ray" style="transform:rotate(135deg)"></div><div class="cf-roue-ray" style="transform:rotate(225deg)"></div>' +
  '<button class="cf-roue-noyau" data-vue="mood"><span class="cf-roue-noyau-cle">' + CFG.roue.noyau + '</span>' +
  '<span class="cf-roue-noyau-nb"></span><span class="cf-roue-noyau-sous"></span></button>' + sats +
  '<button class="cf-roue-ferme" data-fermer="roue">' + CFG.fermerRoue + '</button><p class="cf-roue-aide">' + CFG.aideRoue + '</p></div></div>' +
  '<div class="cf-vue" id="cf-vue"><div class="cf-vuetop">' +
  '<button class="cf-retour" data-accueil title="' + CFG.accueil + '"><i class="fi fi-tr-house-flood"></i></button>' +
  '<button class="cf-retour" data-fermer="vue"><i class="fi fi-tr-angle-small-left"></i>' + CFG.retour + '</button>' +
  '<h2 id="cf-vue-titre"></h2><span class="cf-vuetop-n" id="cf-vue-n"></span></div>' +
  '<div class="cf-corps" id="cf-vue-corps"></div></div>' +
  '<div class="cf-lecture" id="cf-lecture"><div class="cf-lectop">' +
  '<div class="cf-lect-progres"><span class="cf-lect-progres-barre"></span></div>' +
  '<button class="cf-retour" data-accueil title="' + CFG.accueil + '"><i class="fi fi-tr-house-flood"></i></button>' +
  '<button class="cf-retour" data-fermer="lecture"><i class="fi fi-tr-angle-small-left"></i>' + CFG.retour + '</button>' +
  '<button class="cf-retour" id="cf-lect-une" style="display:none">' + CFG.laUne + '</button><h2 id="cf-lect-titre"></h2>' +
  '<div class="cf-actions"><button class="cf-ic" id="cf-edit" style="display:none" title="' + CFG.modifier + '"><i class="fi fi-tr-pen-field"></i></button>' +
  '<button class="cf-ic" id="cf-del" style="display:none" title="' + CFG.supprimer + '"><i class="fi fi-sr-trash"></i></button></div></div>' +
  '<div class="cf-corps" id="cf-lecture-corps"><article class="cf-art" id="cf-art"></article></div></div>' +
  '<div class="cf-voile" id="cf-voile" data-fermer="vol"></div>' +
  '<div class="cf-vol" id="cf-vol"><div class="cf-vol-h"><div style="display:flex;align-items:center;gap:10px">' +
  '<button class="cf-vol-retour" id="cf-vol-back" title="' + CFG.retour + '" style="display:none"><i class="fi fi-tr-angle-small-left"></i></button>' +
  '<h2 id="cf-vol-titre">' + CFG.ajouter + '</h2></div>' +
  '<button class="cf-vol-x" data-fermer="vol" title="' + CFG.fermer + '"><i class="fi fi-sr-cross-small"></i></button></div>' +
  '<div class="cf-vol-c" id="cf-vol-c"></div><div class="cf-vol-p" id="cf-vol-p" style="display:none">' +
  '<span class="cf-vol-p-txt">' + CFG.volAide + '</span>' +
  '<button class="cf-btn" id="cf-vol-publier"><i class="fi fi-sr-plus"></i>' + CFG.publier + '</button></div></div>' +
  '<div class="cf-toast" id="cf-toast"></div>' +
  '<div class="cf-musique" id="cf-musique" hidden><div class="cf-musique-tete">' +
  '<span class="cf-musique-t" id="cf-musique-t"></span>' +
  '<button type="button" class="cf-musique-stop" id="cf-musique-stop" title="Arrêter la musique"><i class="fi fi-sr-cross-small"></i></button></div>' +
  '<div class="cf-musique-cadre" id="cf-musique-cadre"></div></div>';
}
/* ------------------------------------------------------- 4. REMPLISSAGE */
function remplirHero() {
  var cq = CARNET.coquille;
  PROPRIETAIRE = cq.val('PROPRIETAIRE') || '';
  PROPRIO_VILLE = cq.val('VILLE') || '';
  $('#cf-hero-nom').textContent = PROPRIETAIRE;
  var mc = [];
  if (cq.val('AGE')) mc.push('<span>' + esc(cq.val('AGE')) + ' ans</span>');
  if (cq.val('METIER')) mc.push('<span>' + esc(cq.val('METIER')) + '</span>');
  if (cq.val('VILLE')) mc.push('<span>' + esc(cq.val('VILLE')) + '</span>');
  $('#cf-hero-mc').innerHTML = mc.join('');
    /* avatar du compte — jamais de SVG, jamais de repli initiales */
  var img = $('#cf-hero-emblem-img');
  if (cq.avatar) { img.src = cq.avatar; img.hidden = false; }
  if (cq.val('HERO')) $('#cf-hero-img').style.backgroundImage = 'url(\'' + cq.val('HERO') + '\')';
  var n = D.recits.length + D.anecdotes.length + D.souvenirs.length + D.poemes.length + D.objets.length + D.citations.length;
  $('#cf-stats').innerHTML =
    '<div class="cf-hero-s"><b class="cf-hero-s-nb">' + n + '</b><span class="cf-hero-s-lib">' + CFG.stats.fragments + '</span></div>' +
    '<div class="cf-hero-s"><b class="cf-hero-s-nb">' + D.pnjs.length + '</b><span class="cf-hero-s-lib">' + CFG.stats.pnj + '</span></div>' +
    '<div class="cf-hero-s"><b class="cf-hero-s-nb">' + D.souvenirs.length + '</b><span class="cf-hero-s-lib">' + CFG.stats.souvenirs + '</span></div>' +
    '<div class="cf-hero-s"><b class="cf-hero-s-nb">' + cartesRecues().length + '</b><span class="cf-hero-s-lib">' + CFG.stats.cartes + '</span></div>';
  var pl = D.playlists[0];
  $('#cf-playlist-btn').querySelector('.cf-playlist-t').textContent =
    pl ? titrePlaylist(pl) + ' · ' + (pl.val('N') || '?') + ' titres' : CFG.playlistAttente;
  if (!CONNECTE) { var a = $('#cf-add'); if (a) a.style.display = 'none'; }
}
function elListe(type, f) {
  var chips = '';
  if (type === 'anecdotes') chips = f.vals('PJ').map(function (p) { return '<span class="cf-el-pj">' + esc(p) + '</span>'; }).join('');
  chips += f.vals('PNJ').slice(0, 1).map(function (ref) {
    return '<span class="cf-el-pnj">' + esc(resoudre(ref).nom) + '</span>'; }).join('');
  return '<div class="cf-el" data-lect="' + type + '" data-id="' + f.post.id + '">' +
    '<div class="cf-el-t">' + esc(f.val('TITRE')) +
    (type === 'recits' && f.a('JOURNAL') ? ' <span style="font-style:italic;color:var(--darkopa6)">· ' + CFG.journal + '</span>' : '') + '</div>' +
    '<div class="cf-el-m"><span class="cf-el-quand">' + esc(f.val('QUAND')) + '</span>' + chips + '</div>' +
    '<div class="cf-el-prem">' + esc(premierTexte(f).slice(0, 90)) + '…</div></div>';
}
function lignesAvant(type, liste, dateFn) {
  if (!liste.length) return '';
  return '<div class="cf-apercu-avant"><span class="cf-fi-cle">' + CFG.plusTot + '</span>' + liste.map(function (f) {
    return '<button type="button" class="cf-apercu-ligne" data-lect="' + type + '" data-id="' + f.post.id + '">' +
      '<span class="cf-apercu-ligne-t">' + esc(f.val('TITRE')) + '</span>' +
      '<span class="cf-apercu-ligne-d">' + esc(dateFn(f)) + '</span></button>'; }).join('') + '</div>';
}
function apercuRecits() {
  if (!D.recits.length) return videSi(D.recits);
  var o = recitsChrono().reverse(), f = o[0];
  var vign = f.val('HERO') || f.vals('IMAGE')[0] || '';
  var html = '<button type="button" class="cf-apercu-une" data-lect="recits" data-id="' + f.post.id + '">' +
    '<span class="cf-apercu-vign" style="background-image:url(\'' + esc(vign) + '\')"></span><span class="cf-apercu-corps">' +
    '<span class="cf-apercu-titre">' + esc(f.val('TITRE')) + '</span>' +
    '<span class="cf-apercu-quand">' + esc(f.val('QUAND')) + ', ' + esc(f.val('LIEU')) + '</span>' +
    '<span class="cf-apercu-extrait">' + esc(premierTexte(f)) + '</span></span></button>';
  return html + lignesAvant('recits', o.slice(1, 3), function (x) { return x.val('QUAND') || ''; });
}
function apercuAnecdotes() {
  if (!D.anecdotes.length) return videSi(D.anecdotes);
  var a = D.anecdotes[0];
  var html = '<button type="button" class="cf-apercu-une" data-lect="anecdotes" data-id="' + a.post.id + '">' +
    '<span class="cf-apercu-vign cf-apercu-vign-anec"><i class="fi fi-tr-theater-masks"></i></span><span class="cf-apercu-corps">' +
    '<span class="cf-apercu-titre">' + esc(a.val('TITRE')) + '</span>' +
    '<span class="cf-apercu-quand">' + esc(a.val('QUAND')) + '</span>' +
    '<span class="cf-apercu-extrait">' + esc(premierTexte(a)) + '</span></span></button>';
  return html + lignesAvant('anecdotes', D.anecdotes.slice(1, 3), function (x) { return x.val('QUAND') || ''; });
}
function apercuSouvenirs() {
  if (!D.souvenirs.length) return videSi(D.souvenirs);
  var s = souvenirsRecents()[0];
  var u = s.val('IMAGE') || '';
  var html = '<button type="button" class="cf-apercu-une" data-lect="souvenirs" data-id="' + s.post.id + '">' +
    '<span class="cf-apercu-vign' + (u ? '' : ' cf-sans-img') + '" style="background-image:url(\'' + esc(u) + '\')"></span><span class="cf-apercu-corps">' +
    '<span class="cf-apercu-titre">' + esc(s.val('TITRE')) + '</span>' +
    '<span class="cf-apercu-quand">' + esc(s.val('QUAND')) + '</span>' +
    '<span class="cf-apercu-extrait">' + esc(premierTexte(s)) + '</span></span></button>';
  return html + lignesAvant('souvenirs', souvenirsRecents().slice(1, 3), function (x) { return String(anneeS(x) || ''); });
}
function remplirCases() {
  var cr = $('.cf-case-recits'), an = $('.cf-case-anecdotes'), sv = $('.cf-case-souvenirs'), md = $('.cf-case-mood');
  cr.querySelector('.cf-case-n').textContent = D.recits.length;
  an.querySelector('.cf-case-n').textContent = D.anecdotes.length; sv.querySelector('.cf-case-n').textContent = D.souvenirs.length;
  cr.querySelector('.cf-apercu').innerHTML = apercuRecits();
  an.querySelector('.cf-apercu').innerHTML = apercuAnecdotes();
  sv.querySelector('.cf-apercu').innerHTML = apercuSouvenirs();
  cr.querySelector('.cf-liste').innerHTML = D.recits.map(function (f) { return elListe('recits', f); }).join('') + videSi(D.recits);
  an.querySelector('.cf-liste').innerHTML = D.anecdotes.map(function (f) { return elListe('anecdotes', f); }).join('') + videSi(D.anecdotes);
  $('#cf-souv-grid').innerHTML = D.souvenirs.map(function (f) {
    var u = f.val('IMAGE') || '';
    return '<div class="cf-souv" data-id="' + f.post.id + '">' +
      '<div class="cf-souv-v' + (u ? '' : ' cf-sans-img') + '" style="background-image:url(\'' + esc(u) + '\')"></div>' +
      '<div class="cf-souv-t">' + esc(f.val('TITRE')) + '</div><div class="cf-souv-d">' + esc(f.val('QUAND')) + '</div>' +
      '<div class="cf-souv-txt" style="display:none">' + esc(premierTexte(f)) + '</div>' +
      '<button class="cf-souv-fermer" title="' + CFG.replier + '"><i class="fi fi-sr-cross-small"></i></button></div>'; }).join('') +
    videSi(D.souvenirs);
  var mb = D.moodboards[0] ? D.moodboards[0].vals('IMAGE').slice(-3) : [];   /* les 3 dernières images du 1er tableau */
  var cibles = [md.querySelector('.cf-mood-img1'), md.querySelector('.cf-mood-img2'), md.querySelector('.cf-mood-img3')];
  cibles.forEach(function (el, i) { if (el) el.style.backgroundImage = mb[i] ? 'url(\'' + mb[i] + '\')' : ''; });
}
function remplirPnjbar() {
  var bar = $('#cf-pnjbar'); bar.innerHTML = '';
  D.pnjs.slice(0, 2).forEach(function (f) {
    var d = document.createElement('div'); d.className = 'cf-pnj';
    d.innerHTML = '<div class="cf-pnj-av">' + (f.val('IMAGE') ? '<img src="' + esc(f.val('IMAGE')) + '" alt="">' : esc(initiales(f.val('NOM')))) + '</div>' +
      '<div class="cf-pnj-info"><div class="cf-pnj-nom">' + esc(f.val('NOM')) + '</div></div>';
    d.addEventListener('click', function () { CARNETUI.ouvrirLecture('pnjs', f.post.id); });
    bar.appendChild(d);
  });
  var ex = document.createElement('button'); ex.className = 'cf-pnjbar-explorer'; ex.dataset.vue = 'pnjs';
  ex.innerHTML = CFG.pnjbarExplorer + ' <i class="fi fi-tr-angle-small-right"></i>';
  bar.appendChild(ex);
}
function remplirPostit() {
  var f = CARNET.pensee, p = $('#cf-postit');
  if (!f) { p.innerHTML = '<span class="cf-postit-src">' + CFG.postitVide + '</span>'; return; }
  p.style.setProperty('--tint', 'var(--' + teintePostit(f.val('TEINTE')) + ')');
  p.innerHTML = esc(f.val('TEXTE')) + '<span class="cf-postit-src">— ' + esc(f.val('SOURCE')) + '</span>' +
    '<span class="cf-postit-plus">' + CFG.postitToutes + '</span>';
  p.onclick = function () { CARNETUI.ouvrirVue('citations'); };
}
function remplirRoue() {
  var total = D.moodboards.reduce(function (t, b) { return t + b.vals('IMAGE').length; }, 0);
  $('.cf-roue-noyau-nb').textContent = total;
  $('.cf-roue-noyau-sous').textContent = D.moodboards.length + ' ' +
    (D.moodboards.length > 1 ? CFG.tableaux : CFG.tableau);
  $$('.cf-sat').forEach(function (s) {
    var v = s.dataset.vue, n = 0;
    if (v === 'objets') n = D.objets.length;
    if (v === 'citations') n = D.citations.length;
    if (v === 'poemes') n = D.poemes.length;
    if (v === 'cartes') n = cartesRecues().length;
    s.querySelector('.cf-sat-nb').textContent = n;
  });
}
/* ------------------------------------------------------- 5. COUCHES */
var pile = [], caseOuverte = null;
function ouvrir(id) {
  if (id === 'vol') { $('#cf-voile').classList.add('cf-ouverte'); $('#cf-vol').classList.add('cf-ouverte'); }
  else $('#cf-' + id).classList.add('cf-ouverte');
  if (pile.indexOf(id) < 0) pile.push(id);
}
function fermer(id) {
  if (id === 'vol') { $('#cf-voile').classList.remove('cf-ouverte'); $('#cf-vol').classList.remove('cf-ouverte'); }
  else $('#cf-' + id).classList.remove('cf-ouverte');
  if (id === 'vue') vueOuverte = null;
  if (id === 'lecture') lectureOuverte = null;
  pile = pile.filter(function (x) { return x !== id; });
}
/* flip en place d'une case de la grille */
function flip(el, ouvrirCls) {
  var r1 = el.getBoundingClientRect();
  if (ouvrirCls) el.classList.add('cf-ouvert'); else el.classList.remove('cf-ouvert');
  var r2 = el.getBoundingClientRect();
  var dx = r1.left - r2.left, dy = r1.top - r2.top, sx = r1.width / r2.width, sy = r1.height / r2.height;
  el.style.transition = 'none';
  el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
  requestAnimationFrame(function () {
    el.style.transition = 'transform .32s cubic-bezier(.4,0,.2,1)';
    el.style.transform = '';
    setTimeout(function () { el.style.transition = ''; el.style.transform = ''; }, 360);
  });
}
function ouvrirCase(cat) {
  if (caseOuverte && caseOuverte !== cat) fermerCase();
  var el = $('#cf-grille').querySelector('.cf-case-' + cat);
  caseOuverte = cat;
  flip(el, true);
}
function fermerCase() {
  if (!caseOuverte) return;
  var el = $('#cf-grille').querySelector('.cf-case-' + caseOuverte);
  caseOuverte = null;
  if (el) flip(el, false);
  $$('.cf-souv').forEach(function (s) { s.classList.remove('cf-ouvert');
    var t = s.querySelector('.cf-souv-txt'), v = s.querySelector('.cf-souv-v');
    if (t) t.style.display = 'none'; if (v) v.style.display = ''; });
}
function voirSouvenirs() {
  if (D.souvenirs.length > 6) CARNETUI.ouvrirVue('souvenirs'); else ouvrirCase('souvenirs');
}
/* ------------------------------------------------------- 6. ÉVÉNEMENTS */
function brancher() {
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && pile.length) { fermer(pile[pile.length - 1]); if (!pile.length) fermerCase(); }
  });
  document.addEventListener('click', function (e) {
    var acc = e.target.closest('[data-accueil]');
    if (acc) { location.href = '/'; return; }
    var f = e.target.closest('[data-fermer]');
    if (f) { fermer(f.dataset.fermer); return; }
    var v = e.target.closest('[data-vue]');
    if (v) { CARNETUI.ouvrirVue(v.dataset.vue); fermer('roue'); return; }
    var mb = e.target.closest('[data-moodb]');
    if (mb) { moodBoard = +mb.dataset.moodb; CARNETUI.ouvrirVue('mood'); return; }
    var l = e.target.closest('#cf-vue [data-lect]');
    if (l) { CARNETUI.ouvrirLecture(l.dataset.lect, l.dataset.id); return; }
  });
  $$('.cf-case-tete').forEach(function (t) {
    t.addEventListener('click', function (e) {
      var cat = t.closest('.cf-case').dataset.cat;
      if (e.target.closest('.cf-case-replier')) { fermerCase(); return; }
      if (caseOuverte === cat) { fermerCase(); return; }
      if (cat === 'souvenirs') { voirSouvenirs(); return; }
      if (cat === 'mood') { ouvrir('roue'); return; }
      ouvrirCase(cat);
    });
  });
  $('#cf-grille').addEventListener('click', function (e) {
    if (e.target.closest('.cf-case-mood')) { ouvrir('roue'); return; }
    var el = e.target.closest('[data-lect]');
    if (!el) return;
    e.stopPropagation();
    CARNETUI.ouvrirLecture(el.dataset.lect, el.dataset.id);
  });
  $('#cf-souv-grid').addEventListener('click', function (e) {
    var btn = e.target.closest('.cf-souv-fermer');
    var el = e.target.closest('.cf-souv');
    if (!el) return;
    var t = el.querySelector('.cf-souv-txt'), v = el.querySelector('.cf-souv-v');
    if (btn || el.classList.contains('cf-ouvert')) {
      el.classList.remove('cf-ouvert'); if (t) t.style.display = 'none'; if (v) v.style.display = ''; return;
    }
    $$('.cf-souv').forEach(function (s) { s.classList.remove('cf-ouvert');
      var t2 = s.querySelector('.cf-souv-txt'), v2 = s.querySelector('.cf-souv-v');
      if (t2) t2.style.display = 'none'; if (v2) v2.style.display = ''; });
    el.classList.add('cf-ouvert'); if (t) t.style.display = 'block'; if (v) v.style.display = 'none';
  });
  $('#cf-art').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ouvre]'); if (!b) return;
    var v = b.dataset.ouvre.split(':'); CARNETUI.ouvrirLecture(v[0], v[1]);
  });
  $('#cf-vue-corps').addEventListener('click', function (e) {
    var c = e.target.closest('.cf-cp'); if (c) c.classList.toggle('cf-cp-retournee');
  });
  var lc = $('#cf-lecture-corps');
  lc.addEventListener('scroll', function () {
    var b = $('.cf-lect-progres-barre'); if (!b) return;
    var max = this.scrollHeight - this.clientHeight;
    b.style.width = (max > 0 ? this.scrollTop / max * 100 : 0) + '%';
  });
  $('#cf-lect-une').addEventListener('click', function () { fermer('lecture'); if (vueOuverte) fermer('vue'); });
  $('#cf-add').addEventListener('click', function () {
    if (CARNETUI.ajout && typeof CARNETUI.ajout.ouvrir === 'function') CARNETUI.ajout.ouvrir();
    else toast(CFG.toastModule);
  });
  /* rafraîchissement des contributions (carnet-contrib.js) */
  document.addEventListener('carnet:contrib', function () {
    remplirRoue(); remplirHero();
    if (lectureOuverte) CARNETUI.ouvrirLecture(lectureOuverte.type, lectureOuverte.id);
    if (vueOuverte === 'cartes' || vueOuverte === 'souvenirs') CARNETUI.ouvrirVue(vueOuverte);
  });
}
/* ------------------------------------------------------- 7. TOAST */
var toastT = null;
function toast(msg) {
  var t = $('#cf-toast'); if (!t) return;
  t.textContent = msg; t.classList.add('cf-visible');
  if (toastT) clearTimeout(toastT);
  toastT = setTimeout(function () { t.classList.remove('cf-visible'); }, 3200);
}
/* ------------------------------------------------------- 8. MONTAGE */
function monter() {
  if (document.getElementById('cf-app')) return;
  O = CARNET.outils; D = CARNET.donnees;
  CONNECTE = !!document.querySelector('#quick_reply');
  document.body.insertAdjacentHTML('beforeend', squelette());
  document.body.classList.add('cf-carnet');
  brancher();
  if (typeof CARNETUI.brancherFiches === 'function') CARNETUI.brancherFiches();
  remplirHero(); remplirCases(); remplirPnjbar(); remplirPostit(); remplirRoue();
  if (typeof CARNETUI.construireIndex === 'function') CARNETUI.construireIndex();
}
function rafraichir() {
  D = CARNET.donnees;
  remplirHero(); remplirCases(); remplirPnjbar(); remplirPostit(); remplirRoue();
  moodBoard = Math.min(moodBoard, Math.max(0, D.moodboards.length - 1));
  if (typeof CARNETUI.construireIndex === 'function') CARNETUI.construireIndex();
}
/* ------------------------------------------------------- 9. EXPORT */
var CARNETUI = {
  version: '3.1',
  CFG: CFG,
  contribs: null, cartes: null,   /* alimentés par carnet-contrib.js */
  ajout: null,                    /* posé par carnet-ajout.js : {ouvrir:fn} */
  ouvrir: ouvrir, fermer: fermer, voirSouvenirs: voirSouvenirs, fermerCase: fermerCase,
  rafraichir: rafraichir, toast: toast,
  _setVue: function (v) { vueOuverte = v; },
  _setLecture: function (o) { lectureOuverte = o; },
  dansPile: function (id) { return pile.indexOf(id) >= 0; },
  etat: function () { return { D: D, O: O, proprietaire: PROPRIETAIRE, ville: PROPRIO_VILLE,
    connecte: CONNECTE, mood: moodBoard, setMood: function (i) { moodBoard = i; } }; },
  socle: { esc: esc, trim: trim, initiales: initiales, teinteDe: teinteDe, teintePostit: teintePostit,
    videSi: videSi, parId: parId, anneeS: anneeS, recitsChrono: recitsChrono,
    souvenirsRecents: souvenirsRecents, titrePlaylist: titrePlaylist, premierTexte: premierTexte,
    partagesDe: partagesDe, commentairesDe: commentairesDe, cartesRecues: cartesRecues, resoudre: resoudre }
};

/* amorçage : si le core n'a pas encore chargé, c'est le shell qui le
   déclenche ; sinon il se monte directement. Sur un sujet sans carnet,
   silence : rien ne monte. */
function partir() {
  document.addEventListener('carnet:pret', monter);
  if (CARNET.fragments) { monter(); return; }
  if (typeof CARNET.charger === 'function') {
    CARNET.charger().then(monter).catch(function (e) {
      jrn('pas de carnet sur cette page (' + (e && e.message ? e.message : '?') + ')');
    });
  }
}
/* [v3-1] garde DOM-ready : le script est chargé en fin de page mais on ne
   part qu'une fois le DOM complet, sinon lirePage peut lire un post absent. */
function pret(fn){
  var parti=false;
  function go(){ if(parti)return; parti=true; fn(); }
  if(document.readyState==='complete'||document.readyState==='interactive')go();
  else{
    global.addEventListener('DOMContentLoaded',go);
    global.addEventListener('load',go);
  }
}
pret(partir);
CARNET.ui = CARNETUI;
global.CARNETUI = CARNETUI;
})(window);
