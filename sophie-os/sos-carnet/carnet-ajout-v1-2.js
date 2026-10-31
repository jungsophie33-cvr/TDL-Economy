/* =============================================================
   CARNET — FORMULAIRE D'AJOUT (carnet-ajout-v1-2.js)
   -------------------------------------------------------------
   [v1-3] Reproduction exacte de la maquette v5 (voletForm) :
   ordre des catégories, icônes, libellés et descriptions de
   l'écran de choix ; formulaires catégorie par catégorie —
   fTrio 2fr/1fr/1fr et fDuo de la maquette, champ Trigger
   warnings, PNJ en pastilles cochables, journal intime avec
   son aide, zones de texte libellées (Récit, Anecdote, Souvenir,
   Vers, Pensée, Note) avec placeholders et aides de la maquette,
   images contextuelles (label + aide + max par champ), champ
   « Image du hero » séparé (clé HERO:), playlist sans champ N.
   corpsEnvoye écrit désormais TW: et HERO: (lus par ficheRecit).
   [v1-2] Gabarits maquette : cf-opts/cf-opt, cf-champ/cf-aide,
   cf-palette/cf-pal/cf-pal-cache, cf-imgrows/cf-imgrow,
   cf-teinte, cf-pnj-tete/cf-pnjs-cache, cf-chips/cf-chip.
   [v1-1] Sélecteur réponse rapide double (form#quick_reply,
   #quick_reply form).
   Rôle : le vol d'ajout. Choix de catégorie (9), formulaire ;
   l'interface écrit les marqueurs (=== FRAGMENT: type … === FIN)
   et publie par la réponse rapide via carnet-post.js. Brouillons
   en localStorage, anti-flood 10 s, repli classique si le moteur
   échoue. Moodboard : un tableau existant s'édite par sa page FA
   native, un nouveau se publie comme un post.
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
  /* cats : ordre, icônes, libellés et descriptions de la maquette v5 */
  cats: {
    recit:     { titre: 'Récit', ic: 'fi-sr-book-open-cover', ent: 'Un RP narratif solo ou une page de journal intime.' },
    anecdote:  { titre: 'Anecdote', ic: 'fi-sr-theater-masks', ent: 'Ce qui s\u2019est passé sur un RP, et qui était là.' },
    souvenir:  { titre: 'Souvenir', ic: 'fi-sr-time-past', ent: 'Un événement passé, en quelques lignes.' },
    poeme:     { titre: 'Poème', ic: 'fi-sr-quill-pen-story', ent: 'Un texte en vers.' },
    pnj:       { titre: 'PNJ', ic: 'fi-sr-users-alt', ent: 'Un personnage récurrent de sa vie.' },
    objet:     { titre: 'Objet', ic: 'fi-sr-box-open', ent: 'Un objet qui compte, et pourquoi.' },
    citation:  { titre: 'Pensée', ic: 'fi-sr-block-quote', ent: 'Une citation, un post-it de pensée.' },
    moodboard: { titre: 'Image du moodboard', ic: 'fi-sr-picture', ent: 'Une ambiance, une image de plus dans un tableau.' },
    playlist:  { titre: 'Playlist', ic: 'fi-sr-music-note', ent: 'Une playlist, une humeur.' }
  },
  maxImages: { recit: 3, anecdote: 3, souvenir: 1, objet: 1, pnj: 1, moodboard: 30, hero: 1 },
  plusBalises: '+ balises',
  teintes: ['gr1-20', 'gr2-20', 'gr3-20', 'gr4-20', 'gr5-20', 'gr6-20'],
  ph: { /* placeholders de la maquette v5 */
    titre: 'La nuit du chenal…', date: 'mars 1926', lieu: 'Houma…',
    tw: 'alcoolisme, violence…', pj: 'Alma Ledoux, …', lienRp: 'https://… / /t300-…',
    recit: 'Il était une fois, sur le chenal…', anecdote: 'Ce qui s\u2019est passé sur un RP, et qui était là…',
    souvenir: 'Père m\u2019a emmené voir la première cheminée de la Company…',
    poeme: 'Marée basse…', vers: 'L\u2019eau se retire, polie, comme une dette payée…',
    nom: 'Iryna Blackford…', age: '17', rencontre: '1909', metier: '—', relation: 'sa fille…',
    temperament: 'Curieuse, têtue…', description: 'Elle veut apprendre le métier depuis ses dix ans…',
    objetTitre: 'La montre en gousset de Richard…', depuis: '1889', lieA: 'la lignée des Blackford…',
    texteObjet: 'Elle retarde de quatre minutes…',
    pensee: 'Le fleuve ne dit rien. C\u2019est bien là son métier…', source: 'carnet, 1926…',
    plTitre: 'Blackford Nights…', plLien: 'https://open.spotify.com/…', plHumeur: 'après comité…',
    plNote: 'Pour les fins de comité, quand le fleuve fait le silence.',
    img: 'Collez l\u2019URL de l\u2019image…'
  },
  aides: { /* aides de la maquette v5 */
    tw: 'Séparez par des virgules — laissez vide s\u2019il n\u2019y en a aucun.',
    journal: 'Papier réglé, marge rouge — la date s\u2019écrit à la main en tête du texte.',
    recit: 'Palette usuelle + balises maison.',
    imgsRecit: 'Jusqu\u2019à 3 images — elles s\u2019intercalent entre les paragraphes, mode « carré ».',
    hero: 'Remplace le fond de la fiche de lecture — laissez vide pour l\u2019image de base.',
    lienRp: 'Collez l\u2019adresse du sujet — la clé LIEN: est écrite automatiquement.',
    pj: 'Séparez les pseudos par des virgules.',
    anecdote: 'Les versions partagées des autres joueurs s\u2019ajoutent après publication.',
    imgsAnecdote: 'Jusqu\u2019à 3 images — elles s\u2019intercalent entre les paragraphes, comme dans un récit.',
    souvenir: 'Un souvenir est court : quelques lignes suffisent.',
    imgSouvenir: 'Une seule image — elle remplit le tirage photographique, légendé par la date.',
    vers: 'Un vers par ligne — les retours à la ligne sont conservés.',
    pnj: 'Tirés de la liste des PNJ déclarés dans ce carnet — la clé PNJ: est écrite automatiquement.',
    pnjVide: 'Aucun PNJ déclaré dans ce carnet pour l\u2019instant.',
    imgPnj: 'Associer une image au PNJ.',
    imgObjet: 'Une seule image — l\u2019objet dans sa vitrine.',
    plLien: 'Lecteur embed Spotify ou YouTube — la clé LIEN: est écrite automatiquement.',
    mood: 'Un tableau vit dans son propre sujet : ajouter ici revient à modifier le message unique du tableau — ou à ouvrir le sujet d\u2019un nouveau tableau.',
    imgsMood: 'Une URL par ligne — jusqu\u2019à 30 images pour ce tableau.'
  },
  messages: {
    obligatoire: 'Il manque un titre ou du texte — le fragment resterait muet.',
    publie: 'Fragment publié — le carnet se rafraîchit…',
    modifie: 'Tableau mis à jour.',
    flood: 'Trop rapide — ForumActif demande d\u2019attendre un instant.',
    erreur: 'Le forum a refusé — repli sur la réponse classique, rien ne se perd.',
    reseau: 'Le forum n\u2019a pas répondu — repli sur la réponse classique.',
    rafraichi: 'Carnet à jour.',
    invHors: 'Réponse rapide introuvable sur cette page — vérifiez la connexion et le fil du sujet.',
    maxImages: 'Nombre maximum d\u2019images atteint pour ce fragment.'
  },
  brouillonPrefixe: 'cf-brouillon-'
};
/* les 33 balises maison — identiques à la liste blanche de carnet-fiches.js */
var MAISON = ('i1 i2 i3 i4 b1 b2 b3 b4 u1 u2 u3 u4 s1 s2 s3 f f1 f2 f3 f4 ' +
  'fb fb1 fb2 fb3 d d1 d2 d3 t t1 t2 t3 t4').split(' ');

/* ------------------------------------------------------- 2. OUTILS */
function $  (s) { return document.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
var enCours = null;   /* {cat, v, editUrl} */
function D() { return CARNET.donnees || { pnjs: [], moodboards: [] }; }

/* gabarits maquette v5 : fTxt, fTxtB, fDuo, fTrio, fZone, fPaletteZone, fImgs */
function aide(txt) { return txt ? '<span class="cf-aide">' + txt + '</span>' : ''; }
function fTxt(k, lb, ph, aid) {
  return '<div class="cf-champ"><label>' + lb + '</label>' +
    '<input type="text" data-k="' + k + '" placeholder="' + esc(ph || '') + '">' + aide(aid) + '</div>';
}
function fTxtB(k, lb, ph) { return '<div><label>' + lb + '</label><input type="text" data-k="' + k + '" placeholder="' + esc(ph || '') + '"></div>'; }
function fDuo(a, b) {
  return '<div class="cf-champ"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' + a + b + '</div></div>';
}
function fTrio(a, b, c) {
  return '<div class="cf-champ"><div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px">' + a + b + c + '</div></div>';
}
function fZone(k, lb, ph, h, aid) {
  return '<div class="cf-champ"><label>' + lb + '</label><textarea data-k="' + k + '" placeholder="' + esc(ph || '') +
    '" style="min-height:' + (h || 130) + 'px"></textarea>' + aide(aid) + '</div>';
}
/* palette : l'effet de chaque balise se voit dans la case (maquette) */
var PAL_EFFET = {
  b: '<b>G</b>', i: '<i>I</i>', u: '<u>u</u>', strike: '<strike>b</strike>',
  left: 'gauche', center: 'centre', right: 'droite', justify: 'justifié',
  list: '\u2022 liste', nlist: '1. liste'
};
var PAL_TITRE = {
  b: 'Gras', i: 'Italique', u: 'Souligné', strike: 'Barré',
  left: 'Aligner à gauche', center: 'Centrer', right: 'Aligner à droite', justify: 'Justifier',
  list: 'Liste à puces', nlist: 'Liste numérotée'
};
function palBouton(tag, maison) {
  var effet = maison ? '<' + tag + '>' + tag + '</' + tag + '>' : (PAL_EFFET[tag] || tag);
  return '<button type="button" class="cf-pal' + ((maison || !PAL_EFFET[tag]) ? ' cf-pal-maison' : '') +
    '" data-tag="' + esc(tag) + '" title="' + esc(PAL_TITRE[tag] || 'Balise ' + tag) + '">' + effet + '</button>';
}
function fPaletteZone(k, lb, ph, h, aid) {
  return '<div class="cf-champ"><label>' + lb + '</label>' +
    '<div class="cf-palette">' + Object.keys(PAL_EFFET).map(function (t) { return palBouton(t); }).join('') +
    '<button type="button" class="cf-pal cf-pal-plus" data-palplus aria-expanded="false" title="Plus de balises">' +
    CFG.plusBalises + '<i class="fi fi-tr-angle-small-down"></i></button>' +
    '<span class="cf-pal-cache" hidden>' + MAISON.map(function (t) { return palBouton(t, true); }).join('') + '</span></div>' +
    '<textarea data-k="' + k + '" placeholder="' + esc(ph || '') + '" style="min-height:' + (h || 130) + 'px"></textarea>' +
    aide(aid) + '</div>';
}
/* images : lignes, une URL par ligne, bouton « + » (maquette fImgs) */
function lignesImages(v, k, max) {
  var src = v[k];
  var arr = Array.isArray(src) ? src.slice() : (src ? [src] : ['']);
  max = max || 1;
  var plus = (max > 1 && arr.length < max) ?
    '<button type="button" class="cf-img-add" data-addrow="' + k + '" title="Ajouter une image"><i class="fi fi-sr-plus"></i></button>' : '';
  var rows = arr.map(function (u, i) {
    var dernier = i === arr.length - 1;
    return '<div class="cf-imgrow"><input type="text" class="cf-img-url" data-k="' + k +
      '" data-i="' + i + '" placeholder="' + esc(CFG.ph.img) + '" value="' + esc(u || '') + '">' +
      (dernier ? plus : '') + '</div>';
  }).join('');
  return '<div class="cf-imgrows' + (arr.length >= max ? ' plein' : '') + '" data-k="' + k + '" data-max="' + max + '">' + rows + '</div>';
}
function fImgs(lb, aid, max, k) {
  return '<div class="cf-champ"><label>' + lb + '</label>' + lignesImages({}, k, max) + aide(aid) + '</div>';
}
function fTeintes() {
  return '<div class="cf-champ"><label>Voile du post-it</label><div class="cf-chips">' +
    CFG.teintes.map(function (t) {
      return '<button type="button" class="cf-teinte" data-k="TEINTE" data-teinte="' + t +
        '" style="--tint:var(--' + t + ')" title="' + t + '" aria-pressed="false"></button>';
    }).join('') + '</div><span class="cf-aide">Fond crème, voile de couleur au choix du joueur.</span></div>';
}
/* PNJ déclarés : pastilles cochables derrière un « + » (maquette fPnjChips) */
function fPnjChips() {
  var chips = D().pnjs.map(function (f) {
    var ref = f.post.id + ' | ' + f.val('NOM');
    return '<button type="button" class="cf-chip" data-ref="' + esc(ref) + '">' + esc(f.val('NOM')) + '</button>';
  }).join('');
  return '<div class="cf-champ"><div class="cf-pnj-tete"><label>Mentionner des PNJ</label>' +
    (chips ? '<button type="button" class="cf-img-add cf-pnj-add" data-pnjadd aria-expanded="false" title="Déplier la liste des PNJ"><i class="fi fi-sr-plus"></i></button>' : '') +
    '</div>' +
    (chips ? '<div class="cf-pnjs-cache" hidden><div class="cf-chips">' + chips + '</div>' + aide(CFG.aides.pnj) + '</div>'
           : aide(CFG.aides.pnjVide)) + '</div>';
}
/* moodboard existant : chips de sélection, édition par page FA */
function zoneMoodExistants() {
  var boards = D().moodboards || [];
  if (!boards.length) return '';
  return '<div class="cf-champ"><label>Tableau</label><div class="cf-chips">' +
    boards.map(function (f) {
      return '<button type="button" class="cf-chip" data-mood="' + esc(f.post.id) + '"' +
        (f.post.editUrl ? '' : ' disabled') + '>' + esc(f.val('TITRE') || CFG.cats.moodboard.titre) + '</button>';
    }).join('') + '</div>' + aide(CFG.aides.mood) + '</div>';
}

/* ------------------------------------------------------- 3. FORMULAIRES (maquette voletForm) */
function FIELDS() {
  var P = CFG.ph;
  return {
    recit:
      fTrio(fTxtB('TITRE', 'Titre', P.titre), fTxtB('QUAND', 'Date', P.date), fTxtB('LIEU', 'Lieu', P.lieu)) +
      fTxt('TW', 'Trigger warnings', P.tw, CFG.aides.tw) +
      fPnjChips() +
      '<div class="cf-champ"><label class="cf-check"><input type="checkbox" data-k="JOURNAL"><span>Journal intime</span></label>' +
      aide(CFG.aides.journal) + '</div>' +
      fPaletteZone('TEXTE', 'Récit', P.recit, 150, CFG.aides.recit) +
      fImgs('Images du récit', CFG.aides.imgsRecit, CFG.maxImages.recit, 'IMAGE') +
      fImgs('Image du hero', CFG.aides.hero, CFG.maxImages.hero, 'HERO'),
    anecdote:
      fTrio(fTxtB('TITRE', 'Titre', P.titre), fTxtB('QUAND', 'Date', P.date), fTxtB('LIEU', 'Lieu', P.lieu)) +
      fTxt('LIEN', 'Lien du RP', P.lienRp, CFG.aides.lienRp) +
      fTxt('PJ', 'PJ présents', P.pj, CFG.aides.pj) +
      fPnjChips() +
      fPaletteZone('TEXTE', 'Anecdote', P.anecdote, 150, CFG.aides.anecdote) +
      fImgs('Images de l\u2019anecdote', CFG.aides.imgsAnecdote, CFG.maxImages.anecdote, 'IMAGE'),
    souvenir:
      fDuo(fTxtB('TITRE', 'Titre', P.titre), fTxtB('QUAND', 'Date', P.date)) +
      fPaletteZone('TEXTE', 'Souvenir', P.souvenir, 110, CFG.aides.souvenir) +
      fImgs('Image du souvenir', CFG.aides.imgSouvenir, CFG.maxImages.souvenir, 'IMAGE'),
    poeme:
      fTxt('TITRE', 'Titre', P.poeme) +
      fPaletteZone('TEXTE', 'Vers', P.vers, 150, CFG.aides.vers),
    pnj:
      fTxt('NOM', 'Nom', P.nom) +
      fDuo(fTxtB('AGE', '\u00c2ge', P.age), fTxtB('RENCONTRE', 'Rencontré en', P.rencontre)) +
      fDuo(fTxtB('METIER', 'Métier', P.metier), fTxtB('RELATION', 'Relation', P.relation)) +
      fZone('TEMPERAMENT', 'Tempérament', P.temperament, 80) +
      fZone('DESCRIPTION', 'Description', P.description, 120) +
      fImgs('Image du PNJ', CFG.aides.imgPnj, CFG.maxImages.pnj, 'IMAGE'),
    objet:
      fTxt('TITRE', 'Titre', P.objetTitre) +
      fDuo(fTxtB('DEPUIS', 'Depuis', P.depuis), fTxtB('LIE_A', 'Lié à', P.lieA)) +
      fPaletteZone('TEXTE', 'Texte', P.texteObjet, 110) +
      fImgs('Image de l\u2019objet', CFG.aides.imgObjet, CFG.maxImages.objet, 'IMAGE'),
    citation:
      fPaletteZone('TEXTE', 'Pensée', P.pensee, 90) +
      fTxt('SOURCE', 'Source', P.source) +
      fTeintes(),
    moodboard:
      zoneMoodExistants() +
      fTxt('TITRE', 'Titre du tableau', P.titre) +
      fTxt('LEGENDE', 'Légende', '') +
      fImgs('Images du tableau', CFG.aides.imgsMood, CFG.maxImages.moodboard, 'IMAGE'),
    playlist:
      fTxt('TITRE', 'Titre', P.plTitre) +
      fTxt('LIEN', 'Lien', P.plLien, CFG.aides.plLien) +
      fTxt('HUMEUR', 'Humeur', P.plHumeur) +
      fZone('TEXTE', 'Note', P.plNote, 80)
  };
}

/* ------------------------------------------------------- 4. LE VOL */
function ouvrir() {
  if (!document.querySelector('form#quick_reply, #quick_reply form')) { UI.toast(CFG.messages.invHors); return; }
  UI.ouvrir('vol');
  $('#cf-vol-back').style.display = 'none';
  $('#cf-vol-p').style.display = 'none';
  $('#cf-vol-titre').textContent = CFG.volTitre;
  $('#cf-vol-c').innerHTML = '<div class="cf-opts">' + Object.keys(CFG.cats).map(function (cat) {
    var c = CFG.cats[cat];
    return '<button type="button" class="cf-opt" data-cat="' + cat + '"><i class="fi ' + c.ic + '"></i>' +
      '<span><span class="cf-opt-n">' + c.titre + '</span><span class="cf-opt-d">' + c.ent + '</span></span></button>';
  }).join('') + '</div>';
}
function formulaire(cat, fragment, editUrl) {
  $('#cf-vol-c').innerHTML = (FIELDS()[cat] || '');
  $('#cf-vol-titre').textContent = 'Ajouter — ' + (CFG.cats[cat].titre || CFG.volTitre);
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
    if (e.classList.contains('cf-teinte')) {
      e.setAttribute('aria-pressed', e.dataset.teinte === v.TEINTE ? 'true' : 'false'); return;
    }
    if (e.dataset.i != null) return;                   /* lignes d'images : repeintes en bloc */
    if (e.dataset.k === 'PJ') { e.value = (v.PJ || []).join(', '); return; }
    if (e.type === 'checkbox') e.checked = !!v[e.dataset.k];
    else if (e.tagName === 'SELECT' && v[e.dataset.k]) e.value = v[e.dataset.k];
    else if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') e.value = v[e.dataset.k] || '';
  });
  $$('#cf-vol-c .cf-chip[data-ref]').forEach(function (b) {
    b.setAttribute('aria-pressed', (v.PNJ || []).indexOf(b.dataset.ref) >= 0 ? 'true' : 'false');
  });
  $$('#cf-vol-c .cf-imgrows').forEach(function (z) {
    z.outerHTML = lignesImages(v, z.dataset.k, +z.dataset.max || 1);
  });
}

/* ------------------------------------------------------- 5. INTERACTIONS */
function majValeur(e) {
  var t = e.target;
  if (!t || !t.dataset || !enCours) return;
  var k = t.dataset.k;
  if (!k) return;
  var v = enCours.v;
  if (t.dataset.i != null) {                          /* ligne d'image : tableau par index */
    var arr = v[k] || (v[k] = []);
    arr[+t.dataset.i] = t.value;
  } else if (k === 'PJ') {
    v.PJ = t.value.split(',').map(trim).filter(function (x) { return x !== ''; });
  } else {
    v[k] = t.type === 'checkbox' ? (t.checked ? 'oui' : '') : t.value;
  }
  brouillon(enCours.cat, v);
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
    var plus = t.closest ? t.closest('[data-palplus]') : null;
    if (plus) {
      var cache = plus.parentElement ? plus.parentElement.querySelector('.cf-pal-cache') : null;
      if (cache) { cache.hidden = !cache.hidden; plus.setAttribute('aria-expanded', cache.hidden ? 'false' : 'true'); }
      return;
    }
    var bal = t.closest ? t.closest('.cf-pal[data-tag]') : null;
    if (bal) { entourer(bal.dataset.tag); return; }
    var pnjadd = t.closest ? t.closest('[data-pnjadd]') : null;
    if (pnjadd) {
      var champP = pnjadd.closest('.cf-champ');
      var cacheP = champP ? champP.querySelector('.cf-pnjs-cache') : null;
      if (cacheP) { cacheP.hidden = !cacheP.hidden; pnjadd.setAttribute('aria-expanded', cacheP.hidden ? 'false' : 'true'); }
      return;
    }
    var ref = t.closest ? t.closest('.cf-chip[data-ref]') : null;
    if (ref && enCours) {                             /* pastille PNJ : coche ou décoche */
      var liste = enCours.v.PNJ || (enCours.v.PNJ = []);
      var i = liste.indexOf(ref.dataset.ref);
      if (i >= 0) liste.splice(i, 1); else liste.push(ref.dataset.ref);
      ref.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true');
      brouillon(enCours.cat, enCours.v);
      return;
    }
    var teinte = t.closest ? t.closest('.cf-teinte') : null;
    if (teinte && enCours) {
      enCours.v.TEINTE = teinte.dataset.teinte;
      $$('#cf-vol-c .cf-teinte').forEach(function (b) {
        b.setAttribute('aria-pressed', b === teinte ? 'true' : 'false');
      });
      brouillon(enCours.cat, enCours.v);
      return;
    }
    var addRow = t.closest ? t.closest('[data-addrow]') : null;
    if (addRow && enCours) {                          /* + : une ligne d'image de plus */
      var kk = addRow.dataset.addrow;
      var vv = enCours.v;
      var arr = (vv[kk] || []).map(trim).filter(function (x) { return x !== ''; });
      var zr = addRow.closest('.cf-imgrows');
      var max = (zr && +zr.dataset.max) || 1;
      if (max && arr.length >= max) { UI.toast(CFG.messages.maxImages); return; }
      arr.push('');
      vv[kk] = arr;
      if (zr) zr.outerHTML = lignesImages(vv, kk, max);
      var last = $('#cf-vol-c .cf-imgrows[data-k="' + kk + '"] .cf-imgrow:last-child input');
      if (last && last.focus) last.focus();
      return;
    }
  });
  $('#cf-vol-c').addEventListener('input', majValeur);
  $('#cf-vol-c').addEventListener('change', majValeur);
  $('#cf-vol-back').addEventListener('click', function () { ouvrir(); enCours = null; });
  $('#cf-vol-publier').addEventListener('click', publier);
}
function parId(liste, id) { return (liste || []).filter(function (f) { return String(f.post.id) === String(id); })[0] || null; }
/* la palette écrit des balises pointées autour de la sélection */
function entourer(tag) {
  var ta = $('#cf-vol-c textarea[data-k="TEXTE"], #cf-vol-c textarea[data-k="DESCRIPTION"], #cf-vol-c textarea[data-k="TEMPERAMENT"]');
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
  var simples = ['TITRE', 'NOM', 'QUAND', 'LIEU', 'TW', 'AGE', 'METIER', 'RENCONTRE', 'RELATION',
    'TEMPERAMENT', 'SOURCE', 'TEINTE', 'LIEN', 'HUMEUR', 'N', 'DEPUIS', 'LIE_A', 'LEGENDE'];
  simples.forEach(function (k) { if (v[k]) L.push(k + ': ' + v[k]); });
  if (v.JOURNAL) L.push('JOURNAL: oui');
  if (v.HERO && v.HERO[0]) L.push('HERO: ' + v.HERO[0]);
  (v.PNJ || []).forEach(function (r) { L.push('PNJ: ' + r); });
  (v.PJ || []).forEach(function (r) { L.push('PJ: ' + r); });
  var texte = cat === 'pnj' ? (v.DESCRIPTION || '') : (v.TEXTE || '');
  var cleTxt = cat === 'pnj' ? 'DESCRIPTION' : 'TEXTE';
  var imgs = v.IMAGE || [];
  if (cat === 'moodboard') {
    imgs.forEach(function (u) { L.push('IMAGE: ' + u); });
  } else if ((cat === 'recit' || cat === 'anecdote') && texte && imgs.length) {
    L.push(corpsIntercale(texte, imgs));
  } else {
    if (texte) L.push(cleTxt + ':\n' + texte);
    imgs.forEach(function (u) { L.push('IMAGE: ' + u); });
  }
  L.push('=== FIN ===');
  return L.join('\n\n');
}

/* ------------------------------------------------------- 8. PUBLICATION */
function publier() {
  if (!enCours) return;
  var cat = enCours.cat, v = enCours.v;
  ['IMAGE', 'HERO'].forEach(function (k) {            /* lignes vides ignorées */
    v[k] = (v[k] || []).map(trim).filter(function (x) { return x !== ''; });
  });
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
  _t: { corpsEnvoye: corpsEnvoye, corpsIntercale: corpsIntercale, peindreChamps: peindreChamps,
    lignesImages: lignesImages, FIELDS: FIELDS, restaurer: restaurer, brouillon: brouillon, viderBrouillon: viderBrouillon, cats: Object.keys(CFG.cats) } };

/* amorçage : le vol n'existe qu'une fois la une montée */
function partir() {
  if (document.getElementById('cf-app')) { brancheClicks(); return; }
  document.addEventListener('carnet:pret', brancheClicks);
}
partir();
})(window);
