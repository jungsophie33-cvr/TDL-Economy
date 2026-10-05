/* =============================================================
   SOS — Sophia OS · BLOC ANCÊTRES (sos-bloc-ancetres.js)
   -------------------------------------------------------------
   Ajoute le type « ancetres » au registre SOS.blocs : une galerie
   d'aïeux, chacun ramené à sa vie en deux dates, sa parenté et un
   court portrait. L'âge au décès est calculé, jamais saisi.

   FORMAT DU BLOC :

     --- BLOC ancetres ---
     ANCETRE: 1893 - 1978
     NOM: Alasdair Blackford
     PARENTE: Grand-père de Jason, Galaad et Gareth
     TEXTE: Mère décédée des suites de son accouchement…
     TEXTE: Une fois libre, il rendit visite à son demi-frère…
     CITATION: Je ne prie pas pour que les choses s'arrangent.
     SOURCE: rapporté par Samuel          (facultatif)

     ANCETRE: 1921 - 1996
     NOM: Gareth Blackford Sr
     …

   ANCETRE accepte « 1893 - 1978 », « 1893 » seul, ou rien du tout :
   la colonne de dates s'adapte. TEXTE peut être répété, une ligne
   donnant un paragraphe, et accepte les balises en ligne.

   Le bloc ne rend NI cadre NI en-tête : il s'intègre là où on le
   pose. S'emploie dans une annexe comme dans un message ordinaire,
   via sos-inline.js et <div class="tdl-bloc">.

   Dépend de : sos-core.js, sos-blocs.js (SOS.h, SOS.util, grouper).
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { console.error('sos-bloc-ancetres.js : sos-core.js doit être chargé avant.'); return; }
  var h = SOS.h, U = SOS.util;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&(?![a-z#0-9]+;)/gi, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* « 1893 - 1978 » → naissance, mort, durée de vie.
     Les trois tirets usuels sont acceptés : - – — */
  function dates(brut) {
    var v = String(brut || '').trim(), m;
    m = v.match(/(\d{4})\s*[-–—]\s*(\d{4})/);
    if (m) {
      var duree = +m[2] - +m[1];
      return { ne: m[1], mo: m[2], age: duree > 0 ? duree : null };
    }
    m = v.match(/(\d{4})/);
    return m ? { ne: m[1], mo: '', age: null } : { ne: '', mo: '', age: null };
  }

  /* ===================== LECTURE DU BLOC ===================== */
  function lire(bloc) {
    var liste = [];
    SOS.grouper(bloc, 'ANCETRE').forEach(function (g) {
      var d = dates(U.sansBalises(g.ouverture[0] || ''));
      var nom = U.nu(g.champs.NOM || []);
      var corps = g.champs.TEXTE || [];
      if (!nom && !d.ne && !corps.length) { return; }
      liste.push({
        d: d,
        nom: nom,
        parente: U.nu(g.champs.PARENTE || []),
        corps: corps,
        cit: U.nu(g.champs.CITATION || []),
        src: U.nu(g.champs.SOURCE || [])
      });
    });
    return liste;
  }

  /* ===================== RENDU ===================== */
  function unAncetre(e) {
    var vie = '';
    if (e.d.ne) {
      vie += '<span class="anc-an">' + esc(e.d.ne) + '</span>';
      if (e.d.mo) {
        vie += '<span class="anc-trait"></span>'
            +  '<span class="anc-an anc-fin">' + esc(e.d.mo) + '</span>';
      }
      if (e.d.age) { vie += '<span class="anc-age">' + e.d.age + ' ans</span>'; }
    }

    var corps = '';
    if (e.nom) { corps += '<h5 class="anc-nom">' + esc(e.nom) + '</h5>'; }
    if (e.parente) { corps += '<span class="anc-parente">' + esc(e.parente) + '</span>'; }
    if (e.corps.length) { corps += '<div class="anc-txt">' + U.paragraphes(e.corps) + '</div>'; }
    if (e.cit) {
      corps += '<div class="anc-cit"><q>' + esc(e.cit) + '</q>'
            +  (e.src ? '<cite>' + esc(e.src) + '</cite>' : '') + '</div>';
    }

    return '<article class="anc">'
      + '<div class="anc-vie">' + vie + '</div>'
      + '<div class="anc-corps">' + corps + '</div></article>';
  }

  function rendreAncetres(bloc) {
    var liste = lire(bloc);
    var racine = h('div', 'anc-liste');
    if (!liste.length) { return racine; }
    racine.innerHTML = liste.map(unAncetre).join('');
    return racine;
  }

  /* ===================== ENREGISTREMENT ===================== */
  SOS.blocs.ancetres = rendreAncetres;

})(window);
