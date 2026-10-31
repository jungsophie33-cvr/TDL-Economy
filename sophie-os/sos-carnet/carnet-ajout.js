/* =============================================================
   CARNET — FORMULAIRE D'AJOUT (carnet-ajout.js)
   -------------------------------------------------------------
   [v2] Réécriture alignée dépôt : libellés centralisés dans CFG,
   header boîte, sections numérotées, export en pied. Moins de
   500 lignes, aucun SVG, aucune couleur en JS.
   Rôle : le vol d'ajout. Le membre choisit une catégorie (9),
   remplit le formulaire ; l'interface écrit les marqueurs
   (=== FRAGMENT: type … === FIN) et publie par la réponse rapide
   via carnet-post.js. Brouillons en localStorage, anti-flood 10 s
   armé avant l'envoi, repli sur la réponse classique si le moteur
   échoue. Moodboard : un tableau existant s'édite par sa page
   FA native (editerTableau), un nouveau se publie comme un post.
   Charge après carnet-post.js ; pose CARNETUI.ajout = {ouvrir}.
   ============================================================= */
(function (global) {
'use strict';
var CARNET = global.CARNET, UI = global.CARNETUI, POST = global.CARNETPOST;
if (!CARNET || !UI || !POST) {
  if (global.console) console.error('carnet-ajout.js : carnet-core.js, carnet-shell.js puis carnet-post.js doivent être chargés avant.');
  return;
}
function journal(nom) { return function (m) { if (global.console) console.warn('[CARNET ' + nom + '] ' + m); }; }
var jrn = journal('ajout');

/* ------------------------------------------------------- 1. CONFIG */
var CFG = {
  volTitre: 'Ajouter un fragment',
  champs: {
    titre: 'Titre', nom: 'Nom', quand: 'Quand (date ou année)', lieu: 'Lieu',
    texte: 'Texte', description: 'Description', source: 'De qui', lien: 'Lien (YouTube ou Spotify)',
    humeur: 'Humeur', n: 'Nombre de titres', depuis: 'Depuis', lieA: 'Lié à', legende: 'Légende',
    age: 'Âge', metier: 'Métier', rencontre: 'Rencontre', relation: 'Relation', temperament: 'Tempérament',
    image: 'Images (une adresse par ajout)', pnj: 'PNJ présents', pj: 'En compagnie de (libre)',
    journal: 'Journal intime — fragment discret', hero: 'Première image en fond de fiche'
  },
  cats: {
    recit: { titre: 'Récit', ic: 'fi-sr-book-open-cover', ent: 'un chapitre vécu' },
    anecdote: { titre: 'Anecdote', ic: 'fi-sr-theater-masks', ent: 'une scène en marge' },
    souvenir: { titre: 'Souvenir', ic: 'fi-sr-time-past', ent: 'une page épinglée' },
    objet: { titre: 'Objet', ic: 'fi-sr-cube', ent: 'ce qui reste' },
    citation: { titre: 'Pensée', ic: 'fi-sr-comment-quote', ent: 'à épingler sur le mur' },
    poeme: { titre: 'Poème', ic: 'fi-sr-feather', ent: 'à voix basse' },
    pnj: { titre: 'PNJ', ic: 'fi-sr-user', ent: 'une figure de l\u2019entourage' },
    moodboard: { titre: 'Moodboard', ic: 'fi-sr-pictures', ent: 'un tableau d\u2019images' },
    playlist: { titre: 'Playlist', ic: 'fi-sr-music-note', ent: 'la bande-son' }
  },
  maxImages: { recit: 3, anecdote: 3, souvenir: 1, objet: 1, pnj: 1, moodboard: 30 },
  palette: [
    { tag: 'b', lib: 'B' }, { tag: 'i', lib: 'I' }, { tag: 'u', lib: 'U' }, { tag: 'strike', lib: ' barré' },
    { tag: 'list', lib: 'liste' }, { tag: 'nlist', lib: 'liste numérotée' },
    { tag: 'left', lib: 'gauche' }, { tag: 'center', lib: 'centre' }, { tag: 'right', lib: 'droite' }, { tag: 'justify', lib: 'justifier' }],
  plusBalises: '+ balises',
  teintes: ['gr1-20', 'gr2-20', 'gr3-20', 'gr4-20', 'gr5-20', 'gr6-20'],
  messages: {
    obligatoire: 'Il manque un titre ou du texte — le fragment resterait muet.',
    publie: 'Fragment publié — le carnet se rafraîchit…',
    modifie: 'Tableau mis à jour.',
    flood: 'Trop rapide — ForumActif demande d\u2019attendre un instant.', /* coquille corrigée au dépôt si besoin */
    erreur: 'Le forum a refusé — repli sur la réponse classique, rien ne se perd.',
    reseau: 'Le forum n\u2019a pas répondu — repli sur la réponse classique.',
    rafraichi: 'Carnet à jour.',
    invHors: 'Seul le propriétaire du compte ajoute ici.',
    maxImages: 'Nombre maximum d\u2019images atteint pour ce fragment.'
  },
  brouillonPrefixe: 'cf-brouillon-'
};
/* les 33 balises maison — identiques à la liste blanche de carnet-fiches.js */
var MAISON = ('i1 i2 i3 i4 b1 b2 b3 b4 u1 u2 u3 u4 s1 s2 s3 f f1 f2 f3 f4 ' +
  'fb fb1 fb2 fb3 d d1 d2 d3 t t1 t2 t3 t4').split(' ');

/* ------------------------------------------------------- 2. OUTILS */
function $  (s) { return document.querySelector(s); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
var enCours = null;   /* {cat, v, editUrl} */
function D() { return CARNET.donnees || { pnjs: [], moodboards: [] }; }
function champ(k, lib, ph) {
  return '<label class="cf-aj-champ"><span class="cf-aj-lib">' + lib + '</span>' +
    '<input type="text" data-k="' + k + '" placeholder="' + esc(ph || '') + '"></label>';
}
function champM(l) { return l.join(''); }
function caseACocher(k, lib) {
  return '<label class="cf-aj-check"><input type="checkbox" data-k="' + k + '"><span>' + lib + '</span></label>';
}
function zoneTexte(k, lib) {
  return '<div class="cf-aj-zone"><span class="cf-aj-lib">' + lib + '</span>' +
    '<div class="cf-pal">' + CFG.palette.map(function (p) { return paletBouton(p); }).join('') +
    '<button type="button" class="cf-pal-plus">' + CFG.plusBalises + '</button></div>' +
    '<div class="cf-pal-maison" hidden>' + MAISON.map(function (t) { return paletBouton({ tag: t, lib: t }); }).join('') + '</div>' +
    '<textarea data-k="' + k + '" rows="8"></textarea></div>';
}
function paletBouton(p) {
  return '<button type="button" class="cf-pal-b" data-tag="' + esc(p.tag) + '">' + esc(p.lib) + '</button>';
}
function zoneImages(k, max) {
  return '<div class="cf-aj-zone"><span class="cf-aj-lib">' + CFG.champs.image + '</span>' +
    '<div class="cf-aj-imgs" data-k="' + k + '"></div>' +
    '<div class="cf-aj-img-aj"><input type="text" data-img="' + k + '" placeholder="https://…">' +
    '<button type="button" data-ajimg="' + k + '">+</button></div>' +
    (max ? '<span class="cf-aj-max" data-max="' + k + '">' + max + '</span>' : '') + '</div>';
}
function zoneChips(k, lib, aide) {
  return '<div class="cf-aj-zone"><span class="cf-aj-lib">' + lib + '</span>' +
    '<div class="cf-aj-chips" data-k="' + k + '"></div>' +
    '<input type="text" data-chip="' + k + '" placeholder="' + esc(aide || '') + '"></div>';
}
function zoneTeinte() {
  return '<label class="cf-aj-champ"><span class="cf-aj-lib">Teinte</span><select data-k="TEINTE">' +
    CFG.teintes.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('') + '</select></label>';
}
function zonePnj() {
  var liste = D().pnjs.map(function (f) {
    return '<button type="button" class="cf-aj-pnj-pick" data-ref="' + esc(f.post.id + ' | ' + f.val('NOM')) + '">' +
      esc(f.val('NOM')) + '</button>'; }).join('');
  return zoneChips('PNJ', CFG.champs.pnj, 'nom libre ou entrée') +
    (liste ? '<details class="cf-aj-pnj-liste"><summary>' + CFG.champs.pnj + '</summary>' + liste + '</details>' : '');
}

/* ------------------------------------------------------- 3. FORMULAIRES */
function FIELDS() {
  var f = {
    recit: champM([champ('TITRE', CFG.champs.titre), champ('QUAND', CFG.champs.quand), champ('LIEU', CFG.champs.lieu)]) +
      zoneTexte('TEXTE', CFG.champs.texte) + caseACocher('JOURNAL', CFG.champs.journal) +
      caseACocher('HERO', CFG.champs.hero) + zoneImages('IMAGE', CFG.maxImages.recit),
    anecdote: champM([champ('TITRE', CFG.champs.titre), champ('QUAND', CFG.champs.quand), champ('LIEU', CFG.champs.lieu)]) +
      zoneTexte('TEXTE', CFG.champs.texte) + zonePnj() + zoneChips('PJ', CFG.champs.pj, 'prénom, surnom…') +
      champ('LIEN', 'Lien vers le RP', 'https://…') + zoneImages('IMAGE', CFG.maxImages.anecdote),
    souvenir: champM([champ('TITRE', CFG.champs.titre), champ('QUAND', CFG.champs.quand)]) +
      zoneTexte('TEXTE', CFG.champs.texte) + zoneChips('PJ', CFG.champs.pj, 'prénom, surnom…') +
      zoneImages('IMAGE', CFG.maxImages.souvenir),
    objet: champ('TITRE', CFG.champs.titre) + zoneTexte('TEXTE', CFG.champs.texte) +
      zoneImages('IMAGE', CFG.maxImages.objet) + champM([champ('DEPUIS', CFG.champs.depuis), champ('LIE_A', CFG.champs.lieA)]),
    citation: zoneTexte('TEXTE', CFG.champs.texte) + champ('SOURCE', CFG.champs.source) + zoneTeinte(),
    poeme: champ('TITRE', CFG.champs.titre) + zoneTexte('TEXTE', CFG.champs.texte),
    pnj: champ('NOM', CFG.champs.nom) + champM([champ('AGE', CFG.champs.age), champ('METIER', CFG.champs.metier)]) +
      champM([champ('RENCONTRE', CFG.champs.rencontre), champ('RELATION', CFG.champs.relation)]) +
      champ('TEMPERAMENT', CFG.champs.temperament) + zoneTexte('DESCRIPTION', CFG.champs.description) +
      zoneImages('IMAGE', CFG.maxImages.pnj),
    playlist: champ('TITRE', CFG.champs.titre) + champM([champ('LIEN', CFG.champs.lien, 'https://…'), champ('HUMEUR', CFG.champs.humeur)]) +
      champ('N', CFG.champs.n, '12'),
    moodboard: champ('TITRE', CFG.champs.titre) + champ('LEGENDE', CFG.champs.legende) +
      zoneImages('IMAGE', CFG.maxImages.moodboard)
  };
  return f;
}
/* moodboard existant : chips de sélection, édition par page FA */
function zoneMoodExistants() {
  var boards = D().moodboards || [];
  if (!boards.length) return '';
  return '<div class="cf-aj-zone"><span class="cf-aj-lib">Modifier un tableau existant</span>' +
    boards.map(function (f) {
      return '<button type="button" class="cf-aj-pnj-pick" data-mood="' + esc(f.post.id) + '"' +
        (f.post.editUrl ? '' : ' disabled') + '>' + esc(f.val('TITRE') || CFG.cats.moodboard.titre) + '</button>';
    }).join('') + '</div>';
}

/* ------------------------------------------------------- 4. LE VOL */
function ouvrir() {
  if (!document.querySelector('#quick_reply form')) { UI.toast(CFG.messages.invHors); return; }
  UI.ouvrir('vol');
  $('#cf-vol-back').style.display = 'none';
  $('#cf-vol-p').style.display = 'none';
  $('#cf-vol-titre').textContent = CFG.volTitre;
  $('#cf-vol-c').innerHTML = Object.keys(CFG.cats).map(function (cat) {
    return '<button type="button" class="cf-aj-cat" data-cat="' + cat + '"><i class="fi ' + CFG.cats[cat].ic + '"></i>' +
      '<span class="cf-aj-cat-t">' + CFG.cats[cat].titre + '</span><span class="cf-aj-cat-e">' + CFG.cats[cat].ent + '</span></button>';
  }).join('');
}
function formulaire(cat, fragment, editUrl) {
  var html = (FIELDS()[cat] || '') + (cat === 'moodboard' ? zoneMoodExistants() : '');
  $('#cf-vol-c').innerHTML = html;
  $('#cf-vol-titre').textContent = CFG.cats[cat].titre || CFG.volTitre;
  $('#cf-vol-back').style.display = '';
  $('#cf-vol-p').style.display = '';
  enCours = { cat: cat, v: restaurer(cat), editUrl: editUrl || null };
  if (fragment) {                                     /* édition d'un tableau existant */
    enCours.v.TITRE = fragment.val('TITRE') || '';
    enCours.v.LEGENDE = fragment.val('LEGENDE') || '';
    enCours.v.IMAGE = fragment.vals('IMAGE').slice();
  }
  peindreChamps();
}
function peindreChamps() {
  var v = enCours.v;
  $$('#cf-vol-c [data-k]').forEach(function (e) {
    if (e.type === 'checkbox') e.checked = !!v[e.dataset.k];
    else if (e.tagName === 'SELECT' && v[e.dataset.k]) e.value = v[e.dataset.k];
    else if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') e.value = v[e.dataset.k] || '';
  });
  ['IMAGE', 'PNJ', 'PJ'].forEach(function (k) {
    var z = $('#cf-vol-c .cf-aj-chips[data-k="' + k + '"], #cf-vol-c .cf-aj-imgs[data-k="' + k + '"]');
    if (z) z.innerHTML = (v[k] || []).map(puce).join('');
  });
}
function puce(val, i, liste) {
  var k = enCours.cat;
  return '<span class="cf-aj-puce" data-puce="' + esc(val) + '">' + esc(val) +
    ' <button type="button" data-retire="' + esc(val) + '">×</button></span>';
}
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

/* ------------------------------------------------------- 5. INTERACTIONS */
function retirerPuce(k, val) {
  var v = enCours.v;
  v[k] = (v[k] || []).filter(function (x) { return x !== val; });
  peindreChamps(); brouillon(enCours.cat, v);
}
function ajouterPuce(k, val) {
  var v = enCours.v, max = CFG.maxImages[enCours.cat];
  val = trim(val);
  if (!val) return;
  if (k === 'IMAGE' && max && (v[k] || []).length >= max) { UI.toast(CFG.messages.maxImages); return; }
  v[k] = (v[k] || []).indexOf(val) < 0 ? (v[k] || []).concat([val]) : v[k];
  peindreChamps(); brouillon(enCours.cat, v);
}
function majValeur(e) {
  var t = e.target;
  if (!t || !t.dataset || !enCours) return;
  var k = t.dataset.k;
  if (!k) return;
  enCours.v[k] = t.type === 'checkbox' ? (t.checked ? 'oui' : '') : t.value;
  brouillon(enCours.cat, enCours.v);
}
function brancheClicks() {
  $('#cf-vol-c').addEventListener('click', function (e) {
    var t = e.target;
    var cat = t.closest ? t.closest('[data-cat]') : null;
    if (cat) { formulaire(cat.dataset.cat); return; }
    var mood = t.closest ? t.closest('[data-mood]') : null;
    if (mood) {
      var f = parId(D().moodboards, mood.dataset.mood);
      if (f && f.post.editUrl) formulaire('moodboard', f, f.post.editUrl);
      return;
    }
    var pick = t.closest ? t.closest('[data-ref]') : null;
    if (pick) { ajouterPuce('PNJ', pick.dataset.ref); return; }
    var ajimg = t.closest ? t.closest('[data-ajimg]') : null;
    if (ajimg) { var i = $('[data-img="' + ajimg.dataset.ajimg + '"]'); if (i) { ajouterPuce(ajimg.dataset.ajimg, i.value); i.value = ''; } return; }
    var retire = t.closest ? t.closest('[data-retire]') : null;
    if (retire) {
      ['IMAGE', 'PNJ', 'PJ'].forEach(function (k) { if ((enCours.v[k] || []).indexOf(retire.dataset.retire) >= 0) retirerPuce(k, retire.dataset.retire); });
      return;
    }
    var plus = t.closest ? t.closest('.cf-pal-plus') : null;
    if (plus) { var m = $('.cf-pal-maison'); if (m) m.hidden = !m.hidden; return; }
    var bal = t.closest ? t.closest('.cf-pal-b') : null;
    if (bal) { entourer(bal.dataset.tag); return; }
  });
  $('#cf-vol-c').addEventListener('input', majValeur);
  $('#cf-vol-c').addEventListener('change', majValeur);
  $('#cf-vol-c').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.dataset || !e.target.dataset.chip && !e.target.dataset.img) return;
    var k = e.target.dataset.chip || e.target.dataset.img;
    ajouterPuce(k, e.target.value); e.target.value = '';
  });
  $('#cf-vol-back').addEventListener('click', function () { ouvrir(); enCours = null; });
  $('#cf-vol-publier').addEventListener('click', publier);
}
function parId(liste, id) { return (liste || []).filter(function (f) { return String(f.post.id) === String(id); })[0] || null; }
/* la palette écrit des balises pointées autour de la sélection */
function entourer(tag) {
  var ta = $('#cf-vol-c textarea[data-k="TEXTE"], #cf-vol-c textarea[data-k="DESCRIPTION"]')[0];
  if (!ta) return;
  var a = ta.selectionStart || 0, b = ta.selectionEnd || 0;
  var sel = ta.value.slice(a, b);
  var corps = tag === 'list' || tag === 'nlist' ? sel.replace(/\n/g, '<br>') : sel;
  ta.value = ta.value.slice(0, a) + '<' + tag + '>' + corps + '</' + tag + '>' + ta.value.slice(b);
  ta.selectionStart = a + tag.length + 2; ta.selectionEnd = ta.selectionStart + corps.length;
  majValeur({ target: ta });
  ta.focus();
}

/* ------------------------------------------------------- 6. BROUILLONS */
function cleBrouillon(cat) { return CFG.brouillonPrefixe + cat; }
function brouillon(cat, v) {
  try { localStorage.setItem(cleBrouillon(cat), JSON.stringify(v)); } catch (e) { jrn('brouillon impossible : ' + (e && e.message)); }
}
function restaurer(cat) {
  try { return JSON.parse(localStorage.getItem(cleBrouillon(cat)) || '{}') || {}; } catch (e) { return {}; }
}
function viderBrouillon(cat) { try { localStorage.removeItem(cleBrouillon(cat)); } catch (e) {} }

/* ------------------------------------------------------- 7. CORPS DU MESSAGE */
/* images réparties dans les interstices ENTRE paragraphes — jamais
   avant le premier : TEXTE et IMAGE alternent dans l'ordre d'écriture. */
function corpsIntercale(texte, images) {
  var paras = String(texte || '').split(/\n[ \t]*\n+/).map(function (s) { return trim(s); })
    .filter(function (s) { return s !== ''; });
  if (!paras.length) paras = [''];
  var n = paras.length, m = images.length, out = [];
  for (var i = 0; i < n; i++) {
    out.push('TEXTE:\n' + paras[i]);
    for (var j = 0; j < m; j++) {
      if (Math.min(n, Math.max(1, Math.round(((j + 1) * n) / m))) === i + 1) out.push('IMAGE: ' + images[j]);
    }
  }
  return out.join('\n\n');
}
function corpsEnvoye(cat, v) {
  var L = ['=== FRAGMENT: ' + cat + ' ==='];
  var simples = ['TITRE', 'NOM', 'QUAND', 'LIEU', 'AGE', 'METIER', 'RENCONTRE', 'RELATION',
    'TEMPERAMENT', 'SOURCE', 'TEINTE', 'LIEN', 'HUMEUR', 'N', 'DEPUIS', 'LIE_A'];
  simples.forEach(function (k) { if (v[k]) L.push(k + ': ' + v[k]); });
  if (v.JOURNAL) L.push('JOURNAL: oui');
  if (v.HERO && (v.IMAGE || [])[0]) L.push('HERO: ' + v.IMAGE[0]);
  (v.PNJ || []).forEach(function (r) { L.push('PNJ: ' + r); });
  (v.PJ || []).forEach(function (r) { L.push('PJ: ' + r); });
  var texte = cat === 'pnj' ? (v.DESCRIPTION || '') : (v.TEXTE || '');
  var cleTxt = cat === 'pnj' ? 'DESCRIPTION' : 'TEXTE';
  var imgs = v.IMAGE || [];
  if (cat === 'moodboard') {
    imgs.forEach(function (u) { L.push('IMAGE: ' + u); });
    if (v.LEGENDE) L.push('LEGENDE: ' + v.LEGENDE);
  } else if ((cat === 'recit' || cat === 'anecdote') && texte && imgs.length) {
    L.push(corpsIntercale(texte, imgs));
  } else {
    if (texte) L.push(cleTxt + ':\n' + texte);
    imgs.forEach(function (u) { L.push('IMAGE: ' + u); });
    if (v.LEGENDE) L.push('LEGENDE: ' + v.LEGENDE);
  }
  L.push('=== FIN ===');
  return L.join('\n\n');
}

/* ------------------------------------------------------- 8. PUBLICATION */
function publier() {
  if (!enCours) return;
  var cat = enCours.cat, v = enCours.v;
  var nom = v.TITRE || v.NOM || v.SOURCE;
  if (!nom && !v.TEXTE && !v.DESCRIPTION) { UI.toast(CFG.messages.obligatoire); return; }
  var corps = corpsEnvoye(cat, v);
  var editUrl = enCours.editUrl;
  var envoi = editUrl ? POST.editerTableau(editUrl, corps) : POST.envoyer(corps);
  POST.armerFlood(function () {});
  envoi.then(function (r) {
    if (r && r.ok) {
      var modifie = !!editUrl;                          /* édition d'un tableau existant */
      viderBrouillon(cat);
      UI.fermer('vol'); enCours = null;
      UI.toast(modifie ? CFG.messages.modifie : CFG.messages.publie);
      return POST.rafraichirApresPost().then(function () { UI.toast(CFG.messages.rafraichi); });
    }
    UI.toast(r && r.type === 'flood' ? CFG.messages.flood :
      (r && r.type === 'reseau' ? CFG.messages.reseau : CFG.messages.erreur));
    POST.ouvrirReponseClassique(corps);
    UI.fermer('vol');
  }).catch(function (e) {
    jrn('publication perdue : ' + (e && e.message));
    UI.toast(CFG.messages.reseau);
    POST.ouvrirReponseClassique(corps);
  });
}

/* ------------------------------------------------------- 9. EXPORT */
UI.ajout = { ouvrir: ouvrir };
global.CARNETAJOUT = { CFG: CFG, ouvrir: ouvrir, corpsEnvoye: corpsEnvoye, corpsIntercale: corpsIntercale,
  _t: { corpsEnvoye: corpsEnvoye, corpsIntercale: corpsIntercale, ajouterPuce: ajouterPuce,
    restaurer: restaurer, brouillon: brouillon, viderBrouillon: viderBrouillon, cats: Object.keys(CFG.cats) } };

/* amorçage : le vol n'existe qu'une fois la une montée */
function partir() {
  if (document.getElementById('cf-app')) { brancheClicks(); return; }
  document.addEventListener('carnet:pret', brancheClicks);
}
partir();
})(window);
