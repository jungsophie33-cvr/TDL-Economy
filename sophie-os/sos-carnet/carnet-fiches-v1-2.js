/* =============================================================
   CARNET — FICHES, VUES, RECHERCHE (carnet-fiches.js)
   -------------------------------------------------------------
   [v1-2] Chaque retour à la ligne crée un paragraphe (plus besoin
   de sauter une ligne) ; la balise maison <color=#hex>…</color> est
   rendue en couleur (hexadécimal validé, sinon échappé).
   [v1-1] Alignement maquette : corpsFiche produit un <p> par
   paragraphe (lignes vides) et rend les images en figure.cf-rec-img
   (classe stylée par carnet.css, alternance cf-rec-img-g) — l'ancien
   cf-fi-img n'était stylé nulle part et un seul <p> par bloc TEXTE
   cassait les paragraphes, dont la marge du journal intime.
   [v3-1] Déménagement depuis carnet-shell.js (règle < 500 lignes).
   Contient : enrichir (43 balises en liste blanche, tout le reste échappé), les
   7 fiches de lecture, les vues en cartes et l'index de recherche. Aucune image
   pour le poème ; sans clé IMAGE, états vides .cf-sans-img stylés par carnet.css.
   Charge après carnet-shell.js ; cf-obj-ficelle : le seul SVG du carnet.
   ============================================================= */
(function (global) {
'use strict';
var UI = global.CARNETUI;
if (!UI) {
  if (global.console) console.error('carnet-fiches.js : carnet-shell.js doit être chargé avant.');
  return;
}
var S = UI.socle;
function journal(nom) { return function (m) { if (global.console) console.warn('[CARNET ' + nom + '] ' + m); }; }
var jrn = journal('fiches');
var esc = S.esc, trim = S.trim, initiales = S.initiales, teinteDe = S.teinteDe, teintePostit = S.teintePostit,
    videSi = S.videSi, parId = S.parId, anneeS = S.anneeS, recitsChrono = S.recitsChrono,
    souvenirsRecents = S.souvenirsRecents, titrePlaylist = S.titrePlaylist, premierTexte = S.premierTexte,
    partagesDe = S.partagesDe, commentairesDe = S.commentairesDe, cartesRecues = S.cartesRecues, resoudre = S.resoudre;
var $ = function (s) { return document.querySelector(s); };
function etat() { return UI.etat(); }

/* ------------------------------------------------------- 1. CONFIG */
var CFG = {
  typesLect: { recits: 'Récit', anecdotes: 'Anecdote', poemes: 'Poème', pnjs: 'PNJ',
    objets: 'Objet', souvenirs: 'Souvenir', playlists: 'Playlist' },
  meta: { date: 'Date', lieu: 'Lieu', lecture: 'Lecture', presents: 'Présents' },
  voix: { autres: 'Versions des autres participants', souvenir: 'D\u2019autres s\u2019en souviennent',
    ajouter: 'Ajouter ma version', aideVide: 'Personne n\u2019a encore raconté la sienne.',
    commentaires: 'Commentaires', placeholder: 'Laisser un commentaire…', commenter: 'Commenter' },
  suite: { precedent: 'précédent', suivant: 'suivant' },
  anec: { marge: 'En marge du RP', lire: 'Lire le RP', pnj: 'pnj' },
  souv: { partage: 'souvenir partagé avec', frise: 'Souvenirs dans l\u2019ordre chronologique' },
  obj: { depuis: 'Depuis', lieA: 'Lié à', fiche: 'Fiche de ' },
  pnj: { age: 'Âge', ans: ' ans', metier: 'Métier', rencontre: 'Rencontre', temperament: 'Tempérament',
    description: 'Description', anecdotes: 'Anecdotes', apparait: 'Apparaît dans', note: 'note perso' },
  play: { humeur: 'Humeur', titres: ' titres',
    aide: 'La musique vit dans le petit lecteur du carnet — elle continue pendant que vous tournez les pages.',
    ouvrirSur: 'ouvrir sur ', vide: 'Aucun lien pour cette playlist.' },
  vues: { objets: 'Objets', citations: 'Pensées & citations', poemes: 'Poèmes', cartes: 'Cartes postales reçues',
    pnjs: 'L\u2019entourage', playlists: 'Playlists', mood: 'Moodboard', souvenirs: 'Souvenirs' },
  aide: { cartes: 'Cliquez sur une carte pour la retourner.',
    cartesVide: 'Aucune carte reçue pour l\u2019instant — les autres membres peuvent en envoyer depuis un fragment du carnet.',
    moodVide: 'Aucun tableau — ajoutez-en un depuis le bouton d\u2019ajout.',
    souvenirsVide: 'Aucune souvenir — le premier viendra bien assez tôt.', versDePlus: ' vers de plus' },
  album: { decennie: 'Années ', sansDate: 'Sans date', partage: 'partagé' },
  recherche: { min: 2, max: 6, filtres: { recit: 'récit', anecdote: 'anecdote', souvenir: 'souvenir', poeme: 'poème',
    pnj: 'pnj', objet: 'objet', citation: 'pensée', playlist: 'playlist', moodboard: 'moodboard' } }
};

/* ------------------------------------------------------- 2. TEXTE RICHE */
/* La palette de carnet-ajout écrit des balises pointées (<b>…</b>,
   <i1>…</i1>) ; tout le reste est échappé. Les balises maison
   deviennent des spans cf-bb-* stylés par carnet.css d'après le CSS
   de référence du forum. */
var BAL_SIMPLE = { b: 'strong', i: 'em', u: 'u', strike: 's' };
var BAL_MAISON = ('i1 i2 i3 i4 b1 b2 b3 b4 u1 u2 u3 u4 s1 s2 s3 f f1 f2 f3 f4 ' +
  'fb fb1 fb2 fb3 d d1 d2 d3 t t1 t2 t3 t4').split(' ');
var BAL_ALIGN = { left: 'left', center: 'center', right: 'right', justify: 'justify' };
function htmlTxt(s) { return esc(s).replace(/\n/g, '<br>'); }
/* [v1-2] balise couleur du carnet : <color=#DC143C>…</color> écrite par
   la palette du formulaire. La valeur doit être un code hexadécimal,
   sinon la balise est échappée comme n'importe quel texte. */
var RE_COUL = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
function enrichir(t) {
  t = String(t == null ? '' : t);
  var out = '', last = 0, re = /<(\/?)([a-z0-9]+)(=[^<>]*)?>/gi, m;
  while ((m = re.exec(t))) {
    out += htmlTxt(t.slice(last, m.index));
    var ferme = m[1] === '/', nom = String(m[2]).toLowerCase(), val = (m[3] || '').slice(1);
    if (nom === 'color' && (ferme || RE_COUL.test(val))) out += ferme ? '</span>' : '<span style="color:' + val + '">';
    else if (BAL_SIMPLE[nom]) out += ferme ? '</' + BAL_SIMPLE[nom] + '>' : '<' + BAL_SIMPLE[nom] + '>';
    else if (BAL_MAISON.indexOf(nom) >= 0) out += ferme ? '</' + nom + '>' : '<' + nom + '>';
    else if (BAL_ALIGN[nom]) out += ferme ? '</span>' : '<span class="cf-al-' + BAL_ALIGN[nom] + '">';
    else if (nom === 'list' || nom === 'nlist') out += ferme ? '</' + (nom === 'list' ? 'ul' : 'ol') + '>' : '<' + (nom === 'list' ? 'ul' : 'ol') + ' class="cf-bb-list">';
    else out += htmlTxt(m[0]);
    last = re.lastIndex;
  }
  out += htmlTxt(t.slice(last));
  /* listes : les lignes deviennent des <li> */
  out = out.replace(/(<(ul|ol) class="cf-bb-list">)([\s\S]*?)(<\/\2>)/g,
    function (_, o, tag, corps, f) {
      var items = corps.split(/<br\s*\/?>/).filter(function (x) { return trim(x.replace(/<[^>]*>/g, '')) !== ''; });
      return o + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + f;
    });
  return out;
}

/* ------------------------------------------------------- 3. FICHES */
function D() { return etat().D; }
function metaEl(cle, val, simple) {
  return '<div class="cf-meta-el"><span class="cf-fi-cle">' + cle + '</span><span class="cf-meta-v' +
    (simple ? ' cf-meta-v-simple' : '') + '">' + val + '</span></div>';
}
/* corps d'une fiche : TEXTE et IMAGE dans l'ordre d'écriture —
   c'est lui qui fait l'intercalage des images.
   [v1-2] Chaque retour à la ligne crée un paragraphe : plus besoin
   de sauter une ligne (les lignes vides sont simplement ignorées).
   Les images portent les classes maquette figure.cf-rec-img /
   img.cf-rec-img-img, alternées droite / gauche (cf-rec-img-g). */
function parasTxt(t, cls) {
  return String(t == null ? '' : t).split(/\n/).map(function (p) { return trim(p); })
    .filter(function (p) { return p !== ''; })
    .map(function (p) { return '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + enrichir(p) + '</p>'; }).join('');
}
function corpsFiche(f) {
  var html = '', nimg = 0;
  f.entrees.forEach(function (e) {
    if (e.c === 'TEXTE') html += parasTxt(e.v);
    else if (e.c === 'IMAGE' && e.v) {
      nimg++;
      html += '<figure class="cf-rec-img' + (nimg % 2 ? '' : ' cf-rec-img-g') +
        '"><img class="cf-rec-img-img" src="' + esc(e.v) + '" alt="" loading="lazy"></figure>';
    }
  });
  return html;
}
function dureeLecture(f) {
  var mots = (corpsFiche(f).replace(/<[^>]*>/g, ' ').match(/\S+/g) || []).length;
  return Math.max(1, Math.round(mots / 200)) + ' min';
}
function imgObjet(f) { return f.val('IMAGE') || ''; }
function tirage(f, legende) {
  var u = f.val('IMAGE') || '';
  return '<figure class="cf-tirage"><div class="cf-tirage-img' + (u ? '' : ' cf-sans-img') + '" style="background-image:url(\'' + esc(u) + '\')"></div>' +
    (legende !== '' ? '<figcaption class="cf-tirage-leg">' + esc(legende) + '</figcaption>' : '') +
    '<span class="cf-tirage-coins cf-tirage-coins-haut"></span><span class="cf-tirage-coins cf-tirage-coins-bas"></span></figure>';
}
function medaillon(f) {
  var img = f.val('IMAGE'), nom = f.val('NOM') || 'PNJ';
  return '<div class="cf-medaillon">' + (img ? '<img class="cf-medaillon-img" src="' + esc(img) + '" alt="">' : '<span class="cf-medaillon-init">' + esc(initiales(nom)) + '</span>') + '</div>';
}
function voix(liste, libelle, postId, type) {
  return '<section class="cf-voix"><div class="cf-voix-tete"><span class="cf-fi-cle">' + libelle + '</span>' +
    (liste.length ? '<span class="cf-voix-n">' + liste.length + '</span>' : '') + '</div><div class="cf-voix-liste">' +
    liste.map(function (p) {
      return '<div class="cf-voix-el" style="--voix:' + teinteDe(p.pseudo, 'color', p.groupe) + '"><div class="cf-voix-qui">' +
        '<span class="cf-voix-av">' + esc(initiales(p.pseudo)) + '</span><span class="cf-voix-nom">' + esc(p.pseudo) + '</span></div>' +
        '<p class="cf-voix-txt">' + enrichir(p.txt) + '</p></div>'; }).join('') +
    (etat().connecte ? '<button type="button" class="cf-voix-ajout" data-contrib="' + type + ':' + postId + '"><i class="fi fi-sr-plus"></i>' +
      '<span class="cf-voix-ajout-lib">' + CFG.voix.ajouter + '</span>' +
      (liste.length ? '' : '<span class="cf-voix-ajout-aide">' + CFG.voix.aideVide + '</span>') + '</button>' : '') + '</div></section>';
}
function suite(type, liste, k) {
  function pas(x, cls, ic) {
    if (!x) return '<span></span>';
    var t = x.val('TITRE') || x.val('NOM') || '—';
    return '<button type="button" class="cf-suite-pas ' + cls + '" data-ouvre="' + type + ':' + x.post.id +
      '"><i class="fi fi-tr-angle-small-' + ic + '"></i>' +
      '<span class="cf-suite-txt"><span class="cf-fi-cle">' + (cls === 'cf-suite-prec' ? CFG.suite.precedent : CFG.suite.suivant) +
      '</span><span class="cf-suite-t">' + esc(t) + '</span></span></button>';
  }
  if (liste.length < 2) return '';
  return '<nav class="cf-suite">' + pas(liste[k - 1], 'cf-suite-prec', 'left') + pas(liste[k + 1], 'cf-suite-suiv', 'right') + '</nav>';
}
function noteDe(f) { return f.a('NOTE') ? parasTxt(f.val('NOTE'), 'cf-fi-note') : ''; }
function commentaires(f) {
  var l = commentairesDe(f);
  return '<section class="cf-coms"><div class="cf-voix-tete"><span class="cf-fi-cle">' + CFG.voix.commentaires + '</span>' +
    (l.length ? '<span class="cf-voix-n">' + l.length + '</span>' : '') + '</div>' +
    l.map(function (c) {
      return '<div class="cf-com"><div class="cf-com-av" style="--voix:' + teinteDe(c.pseudo, 'color', c.groupe) + '">' + esc(initiales(c.pseudo)) + '</div>' +
        '<div><div class="cf-com-tete"><span class="cf-com-pseudo">' + esc(c.pseudo) + '</span><span class="cf-com-date">' + esc(c.quand || '') + '</span></div>' +
        '<div class="cf-com-txt">' + enrichir(c.txt) + '</div></div></div>'; }).join('') +
    (etat().connecte ? '<div class="cf-com-ajout"><div class="cf-com-champ" data-contrib="commentaire:' + f.post.id + '">' + CFG.voix.placeholder +
      '</div><button type="button" class="cf-btn" data-contrib="commentaire:' + f.post.id + '"><i class="fi fi-tr-paper-plane"></i>' +
      CFG.voix.commenter + '</button></div>' : '') + '</section>';
}
/* ---------- RÉCIT ---------- */
function ficheRecit(f) {
  var journal = f.a('JOURNAL');
  var avec = f.vals('PNJ').map(resoudre);
  var avecHtml = avec.length ? '<div class="cf-rhero-pnj">' + avec.map(function (r) {
    return '<span class="cf-avec">' + (r.lien ? '<button type="button" class="cf-avec-lien" data-ouvre="pnjs:' + r.lien + '">' : '<span class="cf-avec-lien">') +
      '<i class="fi fi-sr-user"></i>avec ' + esc(r.nom) + (r.lien ? '</button>' : '</span>') + '</span>'; }).join('') + '</div>' : '';
  var tw = f.val('TW') ? '<tw>' + esc(f.val('TW')) + '</tw>' : '';
  var meta = '<div class="cf-meta">' + (journal ? '' : metaEl(CFG.meta.date, esc(f.val('QUAND')))) +
    metaEl(CFG.meta.lieu, esc(f.val('LIEU'))) + metaEl(CFG.meta.lecture, dureeLecture(f), true) + '</div>';
  var corps = corpsFiche(f) + noteDe(f);
  if (journal) corps = '<span class="cf-rec-jdate">' + esc(f.val('QUAND')) + '</span><div class="cf-rec-journal">' + corps + '</div>';
  var hero = f.val('HERO');
  var ordre = recitsChrono(), k = ordre.indexOf(f);
  return '<div class="cf-rhero"' + (hero ? ' style="--hero:url(\'' + esc(hero) + '\')"' : '') + '>' +
    '<div class="cf-rhero-in"><h1>' + esc(f.val('TITRE')) + '</h1>' + tw + '</div>' + avecHtml + '</div>' + meta + corps +
    commentaires(f) + suite('recits', ordre, k);
}
/* ---------- ANECDOTE ---------- */
function presents(f) {
  var html = [etat().proprietaire].concat(f.vals('PJ')).map(function (n) {
    return '<span class="cf-anec-pres"><span class="cf-anec-pres-av" style="--voix:' + teinteDe(n) + '">' + esc(initiales(n)) + '</span>' + esc(n) + '</span>'; }).join('');
  html += f.vals('PNJ').map(function (ref) { var r = resoudre(ref);
    return '<button type="button" class="cf-anec-pres cf-anec-pres-pnj"' + (r.lien ? ' data-ouvre="pnjs:' + r.lien + '" title="Ouvrir la fiche"' : '') + '>' +
      '<span class="cf-anec-pres-av">' + esc(initiales(r.nom)) + '</span>' + esc(r.nom) + '<span class="cf-anec-pres-type">' + CFG.anec.pnj + '</span></button>'; }).join('');
  return html;
}
function ficheAnecdote(f) {
  var lien = f.val('LIEN'), rp = f.val('RP');
  return '<div class="cf-anec-renvoi"><span class="cf-trombone"></span>' +
    '<div class="cf-anec-src"><span class="cf-anec-rp">' + esc(rp || 'RP') + '</span><span class="cf-fi-cle">' + CFG.anec.marge + '</span></div>' +
    (lien ? '<a class="cf-btn cf-anec-rp-btn" href="' + esc(lien) + '" target="_blank" rel="noopener"><i class="fi fi-tr-arrow-up-right-from-square"></i>' + CFG.anec.lire + '</a>' : '<span></span>') +
    '<div class="cf-meta cf-anec-meta">' + metaEl(CFG.meta.date, esc(f.val('QUAND'))) + (f.a('LIEU') ? metaEl(CFG.meta.lieu, esc(f.val('LIEU'))) : '') +
    '<div class="cf-meta-el cf-anec-meta-pres"><span class="cf-fi-cle">' + CFG.meta.presents + '</span><div class="cf-anec-pres-liste">' + presents(f) + '</div></div></div></div>' +
    '<div class="cf-anec-tete"><h1 class="cf-fi-titre">' + esc(f.val('TITRE')) + '</h1></div><div class="cf-fi-texte">' + corpsFiche(f) + noteDe(f) + '</div>' +
    voix(partagesDe(f), CFG.voix.autres, f.post.id, 'partage');
}
/* ---------- SOUVENIR ---------- */
function pasFrise(x, sens) {
  if (!x) return '<span class="cf-frise-vide"></span>';
  return '<button type="button" class="cf-frise-pas' + (sens === 'suiv' ? ' cf-frise-pas-suiv' : '') +
    '" data-ouvre="souvenirs:' + x.post.id + '">' +
    '<i class="fi fi-tr-angle-small-' + (sens === 'suiv' ? 'right' : 'left') + '"></i><span class="cf-frise-pas-txt">' +
    '<span class="cf-fi-cle">' + (anneeS(x) || '—') + '</span><span class="cf-frise-pas-t">' + esc(x.val('TITRE')) + '</span></span></button>';
}
function frise(ordre, k) {
  var a0 = anneeS(ordre[0]), a1 = anneeS(ordre[ordre.length - 1]), et = Math.max(1, a1 - a0);
  function pos(x) { return ((anneeS(x) - a0) / et * 100).toFixed(2); }
  var cur = ordre[k];
  var pts = ordre.map(function (x, i) {
    return '<button type="button" class="cf-frise-pt' + (i === k ? ' cf-frise-pt-actif' : '') + '" style="left:' + pos(x) +
      '%" data-ouvre="souvenirs:' + x.post.id + '" title="' + esc((anneeS(x) || '?') + ' — ' + x.val('TITRE')) + '"></button>'; }).join('');
  var ans = '<span class="cf-frise-an cf-frise-an-actif" style="left:' + pos(cur) + '%">' + anneeS(cur) + '</span>' +
    (k > 0 ? '<span class="cf-frise-an cf-frise-an-bas" style="left:0%">' + a0 + '</span>' : '') +
    (k < ordre.length - 1 ? '<span class="cf-frise-an cf-frise-an-bas" style="left:100%">' + a1 + '</span>' : '');
  return '<nav class="cf-frise" aria-label="' + CFG.souv.frise + '">' + pasFrise(ordre[k - 1], 'prec') +
    '<div class="cf-frise-axe">' + pts + ans + '</div>' + pasFrise(ordre[k + 1], 'suiv') + '</nav>';
}
function ficheSouvenir(f) {
  var ordre = D().souvenirs, k = ordre.indexOf(f), partages = partagesDe(f), pj = f.vals('PJ');
  return '<div class="cf-souvfi"><div class="cf-souvfi-tirage">' + tirage(f, f.val('QUAND')) + '</div>' +
    '<div class="cf-souvfi-corps"><h1 class="cf-fi-titre">' + esc(f.val('TITRE')) + '</h1>' +
    (pj.length ? '<span class="cf-souvfi-part"><i class="fi fi-tr-users"></i>' + CFG.souv.partage + ' ' + esc(pj.join(', ')) + '</span>' : '') +
    '<div class="cf-fi-texte">' + corpsFiche(f) + noteDe(f) + '</div></div></div>' +
    (partages.length ? voix(partages, CFG.voix.souvenir, f.post.id, 'partage') : '') + frise(ordre, k);
}
/* ---------- OBJET ---------- */
function ficheObjet(f) {
  var r = resoudre(f.val('LIE_A'));
  var u = imgObjet(f);
  return '<div class="cf-obj-vitrine"><div class="cf-obj-scene">' +
    (u ? '<img class="cf-obj-img" src="' + esc(u) + '" alt="" loading="lazy">' : '<div class="cf-obj-img cf-sans-img"></div>') +
    '<svg class="cf-obj-ficelle" viewBox="0 0 56 44" aria-hidden="true"><circle cx="3" cy="4" r="2.5"/>' +
    '<path d="M3 4 C 22 2, 36 18, 51 40"/></svg>' +
    '<div class="cf-obj-etiq-ombre"><div class="cf-obj-etiq">' +
    '<span class="cf-fi-cle">' + CFG.obj.depuis + '</span><span class="cf-obj-etiq-val">' + esc(f.val('DEPUIS')) + '</span>' +
    '<span class="cf-fi-cle">' + CFG.obj.lieA + '</span><span class="cf-obj-etiq-lie">' + esc(f.val('LIE_A')) + '</span></div></div></div></div>' +
    '<div class="cf-obj-cartel"><h1 class="cf-fi-titre">' + esc(f.val('TITRE')) + '</h1>' +
    '<div class="cf-fi-texte">' + corpsFiche(f) + noteDe(f) + '</div>' +
    (r && r.lien ? '<button type="button" class="cf-obj-lien" data-ouvre="pnjs:' + r.lien + '"><i class="fi fi-tr-user"></i>' +
      '<span class="cf-obj-lien-t">' + CFG.obj.fiche + esc(r.nom) + '</span></button>' : '') + '</div>';
}
/* ---------- PNJ ---------- */
function apparitions(f) {
  var l = [], nom = etat().O.normTxt(f.val('NOM')), id = String(f.post.id);
  function cite(liste, type, libelle) { liste.forEach(function (x) {
    if (x.vals('PNJ').some(function (ref) { var r = resoudre(ref); return r.lien === id || etat().O.normTxt(r.nom) === nom; }))
      l.push([type, libelle, x]); }); }
  cite(D().recits, 'recits', 'récit'); cite(D().anecdotes, 'anecdotes', 'anecdote');
  D().objets.forEach(function (o) { var r = resoudre(o.val('LIE_A'));
    if (r.lien === id || etat().O.normTxt(r.nom) === nom) l.push(['objets', 'objet', o]); });
  return l;
}
function fichePnj(f) {
  var ap = apparitions(f), anecs = f.vals('ANECDOTE');
  return '<div class="cf-pnjfi"><div class="cf-pnjfi-id">' + medaillon(f) +
    '<h1 class="cf-pnjfi-nom">' + esc(f.val('NOM')) + '</h1><span class="cf-pnjfi-rel">' + esc(f.val('RELATION')) + '</span>' +
    '<dl class="cf-pnjfi-faits"><dt class="cf-fi-cle">' + CFG.pnj.age + '</dt><dd>' + esc(f.val('AGE')) + (f.a('AGE') ? CFG.pnj.ans : '') + '</dd>' +
    '<dt class="cf-fi-cle">' + CFG.pnj.metier + '</dt><dd>' + esc(f.val('METIER')) + '</dd>' +
    '<dt class="cf-fi-cle">' + CFG.pnj.rencontre + '</dt><dd>' + esc(f.val('RENCONTRE')) + '</dd></dl></div>' +
    '<div class="cf-pnjfi-corps"><div class="cf-pnjfi-temp"><span class="cf-pnjfi-temp-lib">' + CFG.pnj.temperament + '</span>' +
    '<p class="cf-pnjfi-temp-t">' + enrichir(f.val('TEMPERAMENT')) + '</p></div>' +
    '<div class="cf-pnjfi-desc"><span class="cf-fi-cle">' + CFG.pnj.description + '</span><div class="cf-fi-texte">' + parasTxt(f.val('DESCRIPTION')) + '</div></div>' +
    '<div class="cf-pnjfi-bas"><div>' +
    (anecs.length ? '<span class="cf-fi-cle">' + CFG.pnj.anecdotes + '</span><ul class="cf-pnjfi-anecs">' +
      anecs.map(function (a) { return '<li>' + enrichir(a) + '</li>'; }).join('') + '</ul>' : '') +
    (ap.length ? '<div class="cf-pnjfi-sec"><span class="cf-fi-cle">' + CFG.pnj.apparait + '</span><div class="cf-pnjfi-liens">' +
      ap.map(function (x) { return '<button type="button" class="cf-pnjfi-lien" data-ouvre="' + x[0] + ':' + x[2].post.id + '">' +
        '<span class="cf-pnjfi-lien-type">' + x[1] + '</span><span class="cf-pnjfi-lien-t">' + esc(x[2].val('TITRE')) + '</span></button>'; }).join('') + '</div></div>' : '') + '</div>' +
    (f.a('NOTE') ? '<div class="cf-pnjfi-note"><span class="cf-pnjfi-note-lib">' + CFG.pnj.note + '</span>' + enrichir(f.val('NOTE')) + '</div>' : '<span></span>') +
    '</div></div></div>';
}
/* ---------- POÈME (feuillet nu, jamais d'image) ---------- */
function ficheP(f) {
  var k = D().poemes.indexOf(f);
  var vers = String(f.val('TEXTE') || '').split('\n');
  return '<div class="cf-feuillet-ombre"><div class="cf-feuillet"><h1 class="cf-fi-titre">' + esc(f.val('TITRE')) + '</h1>' +
    '<div class="cf-feuillet-filet"></div><div class="cf-poeme-vers">' +
    vers.map(function (v) { return trim(v) === '' ? '<div class="cf-poeme-strophe"></div>' : '<div>' + enrichir(v) + '</div>'; }).join('') +
    '</div>' + noteDe(f) + '</div></div>' + suite('poemes', D().poemes, k);
/* feuillet nu : le poème n'a jamais d'image, jamais de voile */
}
/* ---------- PLAYLIST ---------- */
function pochette(f, tag) {
  return '<div class="cf-pochette" style="--poch:' + teinteDe(titrePlaylist(f), '40') + '"><div class="cf-pochette-disque"></div>' +
    (tag && f.val('HUMEUR') ? '<span class="cf-pochette-tag">' + esc(f.val('HUMEUR')) + '</span>' : '') +
    '<div class="cf-pochette-sleeve"><span class="cf-pochette-t">' + esc(titrePlaylist(f)) + '</span>' +
    '<span class="cf-pochette-n">' + esc(f.val('N') || '?') + CFG.play.titres + '</span></div></div>';
}
var MUSIQUE_ID = null;
function lancerMusique(f) {
  var u = etat().O.urlLecteur(f.val('LIEN'));
  if (!u) return;
  if (MUSIQUE_ID === String(f.post.id)) { var m = $('#cf-musique'); if (m) m.hidden = false; return; }
  var cadre = $('#cf-musique-cadre'); if (!cadre) return;
  cadre.innerHTML = '';
  var fr = document.createElement('iframe');
  fr.src = u; fr.title = 'Lecteur — ' + titrePlaylist(f);
  fr.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
  fr.setAttribute('allowfullscreen', '');
  cadre.appendChild(fr);
  var t = $('#cf-musique-t'); if (t) t.textContent = titrePlaylist(f);
  var b = $('#cf-musique'); if (b) b.hidden = false;
  MUSIQUE_ID = String(f.post.id);
}
function lienLecteur(l) {
  var p = etat().O.urlPage(l);
  return p ? '<a class="cf-lecteur-lien" href="' + esc(p) + '" target="_blank" rel="noopener">' + CFG.play.ouvrirSur +
    (p.indexOf('spotify') >= 0 ? 'Spotify' : 'YouTube') + '<i class="fi fi-tr-arrow-up-right-from-square"></i></a>' : '';
}
function fichePlaylist(f) {
  var u = etat().O.urlLecteur(f.val('LIEN'));
  return '<div class="cf-playfi">' + pochette(f) + '<div><h1 class="cf-fi-titre">' + esc(titrePlaylist(f)) + '</h1>' +
    (f.val('HUMEUR') ? '<div class="cf-playfi-hum"><span class="cf-fi-cle">' + CFG.play.humeur + '</span><span class="cf-playfi-hum-v">' + esc(f.val('HUMEUR')) + '</span></div>' : '') +
    (f.a('TEXTE') ? '<div class="cf-fi-texte">' + corpsFiche(f) + '</div>' : '') +
    (u ? '<span class="cf-aide">' + CFG.play.aide + '</span>' + lienLecteur(f.val('LIEN')) :
      '<div class="cf-lecteur cf-lecteur-vide"><i class="fi fi-sr-music-note"></i><span class="cf-lecteur-t">' + CFG.play.vide + '</span></div>') + '</div></div>';
}

/* ------------------------------------------------------- 4. VUES EN CARTES */
function VUES() {
  var d = D(), st = etat();
  return {
  objets: { t: CFG.vues.objets, corps: function () {
    return videSi(d.objets) + '<div class="cf-objwall">' + d.objets.map(function (f) {
      var u = imgObjet(f);
      return '<button type="button" class="cf-objcard" data-lect="objets" data-id="' + f.post.id + '">' +
      '<div class="cf-objcard-vitrine"><div class="cf-objcard-img' + (u ? '' : ' cf-sans-img') + '" style="background-image:url(\'' + esc(u) + '\')"></div></div>' +
      '<div class="cf-objcard-etiq-ombre"><div class="cf-objcard-etiq"><span class="cf-objcard-t">' + esc(f.val('TITRE')) + '</span><span class="cf-objcard-d">' +
      CFG.obj.depuis + ' ' + esc(f.val('DEPUIS')) + '</span></div></div></button>'; }).join('') + '</div>'; } },
  citations: { t: CFG.vues.citations, corps: function () { return '<div class="cf-postits" id="cf-postitwall"></div>'; } },
  poemes: { t: CFG.vues.poemes, corps: function () {
    return videSi(d.poemes) + '<div class="cf-feuillets">' + d.poemes.map(function (f) {
      var vers = String(f.val('TEXTE') || '').split('\n').filter(function (v) { return trim(v) !== ''; });
      return '<button type="button" class="cf-feuillet-el" data-lect="poemes" data-id="' + f.post.id + '"><div class="cf-feuillet-ombre"><div class="cf-feuillet">' +
      '<span class="cf-feuillet-t">' + esc(f.val('TITRE')) + '</span><span class="cf-feuillet-x">' +
      vers.slice(0, 4).map(function (v) { return '<span class="cf-feuillet-v">' + esc(v) + '</span>'; }).join('') +
      (vers.length > 4 ? '<span class="cf-feuillet-suite">' + (vers.length - 4) + CFG.aide.versDePlus + '</span>' : '') + '</div></div></button>'; }).join('') + '</div>'; } },
  cartes: { t: CFG.vues.cartes, corps: function () {
    var ks = cartesRecues();
    if (!ks.length) return '<p class="cf-cp-aide">' + CFG.aide.cartesVide + '</p>';
    return '<p class="cf-cp-aide">' + CFG.aide.cartes + '</p><div class="cf-cpwall">' + ks.map(function (k) {
      return '<button type="button" class="cf-cp" aria-label="Carte de ' + esc(k.pseudo || k.de) + ', retourner"><div class="cf-cp-in">' +
      '<div class="cf-cp-face cf-cp-recto"><div class="cf-cp-photo" style="background-image:url(\'' + esc(k.img) + '\')"></div>' +
      '<span class="cf-cp-tourne"><i class="fi fi-tr-refresh"></i></span></div>' +
      '<div class="cf-cp-face cf-cp-verso"><div class="cf-cp-msg">' + esc(k.txt) + '<span class="cf-cp-sign">' + esc(k.pseudo || k.de) + '</span></div>' +
      '<div class="cf-cp-droite"><div class="cf-cp-timbre"><div class="cf-cp-timbre-in">USA</div></div>' +
      '<img class="cf-cp-tampon" src="' + UI.CFG.stamp + '" alt="">' + '<div class="cf-cp-adr"><span class="cf-cp-adr-l">' + esc(st.proprietaire) + '</span>' +
      '<span class="cf-cp-adr-l">' + esc(st.ville) + '</span><span class="cf-cp-adr-l"></span></div></div>' +
      '<span class="cf-cp-tourne"><i class="fi fi-tr-refresh"></i></span></div></div></button>'; }).join('') + '</div>'; } },
  pnjs: { t: CFG.vues.pnjs, corps: function () {
    return videSi(d.pnjs) + '<div class="cf-portraits">' + d.pnjs.map(function (f) {
      return '<button type="button" class="cf-portrait" data-lect="pnjs" data-id="' + f.post.id + '">' + medaillon(f) + '<span class="cf-plaque">' +
      '<span class="cf-portrait-nom">' + esc(f.val('NOM')) + '</span><span class="cf-portrait-rel">' + esc(f.val('RELATION')) + '</span></span></button>'; }).join('') + '</div>'; } },
  playlists: { t: CFG.vues.playlists, corps: function () {
    return videSi(d.playlists) + '<div class="cf-disques">' + d.playlists.map(function (f) {
      return '<button type="button" class="cf-disque-el" data-lect="playlists" data-id="' + f.post.id + '">' + pochette(f, true) + '</button>'; }).join('') + '</div>'; } },
  mood: { t: CFG.vues.mood, corps: function () {
    if (!d.moodboards.length) return '<p class="cf-cp-aide">' + CFG.aide.moodVide + '</p>';
    return '<div class="cf-chips">' + d.moodboards.map(function (b, i) {
      return '<button type="button" class="cf-chip" data-moodb="' + i + '"' + (i === st.mood ? ' aria-pressed="true"' : '') + '>' + esc(b.val('TITRE')) +
      '<span class="cf-chip-n">' + b.vals('IMAGE').length + '</span></button>'; }).join('') + '</div>' +
      '<div class="cf-masonry" id="cf-moodwall"></div>'; } },
  souvenirs: { t: CFG.vues.souvenirs, corps: function () {
    if (!d.souvenirs.length) return '<p class="cf-cp-aide">' + CFG.aide.souvenirsVide + '</p>';
    var decs = [], par = {};
    souvenirsRecents().forEach(function (f) { var a = anneeS(f), dd = a ? Math.floor(a / 10) * 10 : 0;
      if (!par[dd]) { par[dd] = []; decs.push(dd); } par[dd].push(f); });
    return '<div class="cf-album">' + decs.map(function (dd) {
      return '<section class="cf-album-dec"><span class="cf-album-dec-t">' + (dd ? CFG.album.decennie + dd : CFG.album.sansDate) + '</span>' +
      '<div class="cf-album-grille">' + par[dd].map(function (f) {
        return '<button type="button" class="cf-album-el" data-lect="souvenirs" data-id="' + f.post.id + '">' + tirage(f, f.val('TITRE')) +
        '<span class="cf-album-d">' + esc(f.val('QUAND')) + (partagesDe(f).length ? '<span class="cf-album-part">' + CFG.album.partage + '</span>' : '') +
        '</span></button>'; }).join('') + '</div></section>'; }).join('') + '</div>'; } }
  };
}
function nombreDe(v) {
  var d = D();
  var n = { objets: d.objets, citations: d.citations, poemes: d.poemes, pnjs: d.pnjs,
    playlists: d.playlists, souvenirs: d.souvenirs }[v];
  if (n) return n.length;
  if (v === 'cartes') return cartesRecues().length;
  if (v === 'mood') return d.moodboards.reduce(function (t, b) { return t + b.vals('IMAGE').length; }, 0);
  return 0;
}
function masonry(el, items, minW, gap, pad) {
  if (!el) return;
  el.innerHTML = '';
  var W = (el.clientWidth || 1200) - (pad || 0);
  var n = Math.max(1, Math.floor((W + gap) / (minW + gap)));
  var cols = [], i;
  for (i = 0; i < n; i++) { var c = document.createElement('div'); c.className = 'cf-mcol'; el.appendChild(c); cols.push(c); }
  items.forEach(function (h, j) { cols[j % n].insertAdjacentHTML('beforeend', h); });
}
function masonryMood() {
  var b = D().moodboards[etat().mood]; if (!b) return;
  masonry($('#cf-moodwall'), b.vals('IMAGE').map(function (u) {
    return '<figure class="cf-mood-item"><img src="' + esc(u) + '" alt="" loading="lazy"></figure>'; }), 230, 10, 60);
}
function masonryPostits() {
  masonry($('#cf-postitwall'), D().citations.map(function (f) {
    return '<div class="cf-postit-v" style="--tint:var(--' + teintePostit(f.val('TEINTE')) + ')">' + esc(f.val('TEXTE')) +
      '<span class="cf-postit-v-src">— ' + esc(f.val('SOURCE')) + '</span></div>'; }), 230, 20);
}
function ouvrirVue(v) {
  var d = VUES()[v]; if (!d) return;
  $('#cf-vue-titre').textContent = d.t;
  $('#cf-vue-n').textContent = nombreDe(v);
  $('#cf-vue-corps').innerHTML = d.corps();
  UI._setVue(v);
  UI.ouvrir('vue');
  $('#cf-vue-corps').scrollTop = 0;
  if (v === 'mood') masonryMood();
  if (v === 'citations') masonryPostits();
}

/* ------------------------------------------------------- 5. VUE LECTURE */
function ficheDe(type, id) {
  var d = D();
  var cible = { recits: d.recits, anecdotes: d.anecdotes, poemes: d.poemes, pnjs: d.pnjs,
    objets: d.objets, souvenirs: d.souvenirs, playlists: d.playlists }[type];
  return cible ? parId(cible, id) : null;
}
function ouvrirLecture(type, id) {
  var f = ficheDe(type, id); if (!f) return;
  var R = { recits: ficheRecit, anecdotes: ficheAnecdote, poemes: ficheP, pnjs: fichePnj, objets: ficheObjet,
    souvenirs: ficheSouvenir, playlists: fichePlaylist };
  var html = R[type] ? R[type](f) : '';
  if (html === '') return;
  UI._setLecture({ type: type, id: id });
  $('#cf-lect-titre').textContent = CFG.typesLect[type] || '';
  $('#cf-lect-une').style.display = UI.dansPile('vue') ? 'inline-flex' : 'none';
  var art = $('#cf-art');
  art.className = 'cf-art cf-art-' + type;
  $('#cf-lecture').classList.toggle('cf-lecture-recit', type === 'recits');
  var b = $('.cf-lect-progres-barre'); if (b) b.style.width = '0';
  art.innerHTML = html;
  var corps = $('#cf-lecture-corps'); if (corps) corps.scrollTop = 0;
  /* édition / suppression : le gating ForumActif fait foi — les liens
     natifs n'existent dans le post que si le membre en a le droit */
  var be = $('#cf-edit'), bd = $('#cf-del');
  if (be) be.style.display = f.post.editUrl ? '' : 'none';
  if (bd) bd.style.display = f.post.supprUrl ? '' : 'none';
  if (be && f.post.editUrl) be.onclick = function () { window.open(f.post.editUrl, '_blank'); };
  if (bd && f.post.supprUrl) bd.onclick = function () { window.open(f.post.supprUrl, '_blank'); };
  if (type === 'playlists') lancerMusique(f);
  UI.ouvrir('lecture');
}

/* ------------------------------------------------------- 6. RECHERCHE */
var INDEX = [];
var CATSLECT = { recit: 'recits', anecdote: 'anecdotes', souvenir: 'souvenirs', poeme: 'poemes',
  pnj: 'pnjs', objet: 'objets', citation: 'citations', playlist: 'playlists', moodboard: 'mood' };
function construireIndex() {
  INDEX = [];
  global.CARNET.fragments.forEach(function (f) {
    var t = '', x = '';
    if (f.type === 'pnj') { t = f.val('NOM'); x = (f.val('RELATION') || '') + ' · ' + (f.val('TEMPERAMENT') || ''); }
    else if (f.type === 'citation') { t = f.val('TEXTE'); x = f.val('SOURCE'); }
    else if (f.type === 'moodboard') { t = f.val('TITRE'); x = f.vals('IMAGE').length + ' images'; }
    else { t = f.val('TITRE') || titrePlaylist(f); x = premierTexte(f); }
    INDEX.push({ type: CFG.recherche.filtres[f.type] || f.type, cat: CATSLECT[f.type] || null, id: f.post.id, t: t, x: x });
  });
}
function norm(s) { var O = etat().O; return O ? O.normTxt(s) : String(s || '').toLowerCase(); }
function brancherRecherche() {
  var champ = $('#cf-cherche'), res = $('#cf-resultats');
  champ.addEventListener('input', function () {
    var q = norm(champ.value).trim();
    if (q.length < CFG.recherche.min) { res.classList.remove('cf-ouverte'); return; }
    var hits = INDEX.filter(function (i) { return norm(i.t + ' ' + i.x).indexOf(q) >= 0; }).slice(0, CFG.recherche.max);
    if (!hits.length) { res.classList.remove('cf-ouverte'); return; }
    res.innerHTML = hits.map(function (h) {
      return '<div class="cf-res" data-cat="' + h.cat + '" data-id="' + h.id + '"><span class="cf-res-cat">' + esc(h.type) + '</span>' +
        '<span class="cf-res-t">' + esc(h.t) + '</span><span class="cf-res-x">' + esc(String(h.x).slice(0, 60)) + '…</span></div>'; }).join('');
    res.classList.add('cf-ouverte');
  });
  res.addEventListener('click', function (e) {
    var r = e.target.closest ? e.target.closest('.cf-res') : null; if (!r) return;
    res.classList.remove('cf-ouverte'); champ.value = '';
    var cat = r.dataset.cat;
    if (cat === 'souvenirs') UI.voirSouvenirs();
    else if (cat) ouvrirLecture(cat, r.dataset.id);
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.cf-cherche')) res.classList.remove('cf-ouverte');
  });
}

/* ------------------------------------------------------- 7. EXPORT */
UI.enrichir = enrichir;
UI.ouvrirVue = ouvrirVue;
UI.ouvrirLecture = ouvrirLecture;
UI.construireIndex = construireIndex;
UI.brancherFiches = function () {
  brancherRecherche();
  var stop = $('#cf-musique-stop');
  if (stop) stop.addEventListener('click', function () {
    $('#cf-musique-cadre').innerHTML = ''; $('#cf-musique').hidden = true; MUSIQUE_ID = null;
  });
};
UI._t = { ficheRecit: ficheRecit, ficheAnecdote: ficheAnecdote, ficheSouvenir: ficheSouvenir, ficheObjet: ficheObjet,
  fichePnj: fichePnj, ficheP: ficheP, fichePlaylist: fichePlaylist, enrichir: enrichir,
  construireIndex: construireIndex, INDEX: function () { return INDEX; }, ouvrirVue: ouvrirVue, ouvrirLecture: ouvrirLecture };
})(window);
