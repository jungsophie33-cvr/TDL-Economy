/* =============================================================
   SOS — Sophia OS · BLOC FRISE FAMILIALE (sos-bloc-chronofam.js)
   -------------------------------------------------------------
   Ajoute le type « chronofam » au registre SOS.blocs : la frise des
   événements d'une famille, conçue pour des chronologies longues.
   Un fil vertical se remplit au défilement, du doré au grenat, et
   chaque pastille prend la teinte du fil à sa hauteur.

   FORMAT DU BLOC :

     --- BLOC chronofam ---
     NOTE: Les dates d'avant 1960…         (facultatif, en pied de frise)
     EVENEMENT: 1903
     TEXTE: Création de la société <i>Blackford &amp; Sons</i>…
     EVENEMENT: 1920 – 1933
     TITRE: Prohibition era                (facultatif)
     TEXTE: Contrebande de carburant…
     TEXTE peut tenir sur plusieurs lignes : une ligne = un paragraphe.

   Le bloc ne rend NI cadre NI en-tête : il s'intègre dans un message
   ForumActif qui porte déjà les siens. Le titre de la frise se pose
   au-dessus du bloc, avec tes propres classes.

   S'emploie dans une annexe comme dans un message ordinaire, via
   sos-inline.js et <div class="tdl-bloc">.

   Dépend de : sos-core.js, sos-blocs.js (SOS.h, SOS.util, grouper).
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { console.error('sos-bloc-chronofam.js : sos-core.js doit être chargé avant.'); return; }
  var h = SOS.h, U = SOS.util;

  /* La ligne de lecture, en part de la hauteur de l'écran : une pastille
     s'allume quand elle la franchit, un peu avant le milieu. */
  var LECTURE = 0.58;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&(?![a-z#0-9]+;)/gi, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ===================== LECTURE DU BLOC ===================== */
  function lire(bloc) {
    var events = [];
    SOS.grouper(bloc, 'EVENEMENT').forEach(function (g) {
      var date = U.sansBalises((g.ouverture[0] || '')).trim();
      var corps = g.champs.TEXTE || [];
      if (!date && !corps.length) { return; }
      events.push({ d: date, t: U.nu(g.champs.TITRE || []), corps: corps });
    });
    /* La NOTE est celle du bloc : on ne la cherche qu'avant le premier
       EVENEMENT, pour ne pas ramasser une clé du même nom dans un groupe. */
    var premierEv = (bloc.entrees || []).findIndex(function (e) { return e.cle === 'EVENEMENT'; });
    var avant = premierEv < 0 ? (bloc.entrees || []) : (bloc.entrees || []).slice(0, premierEv);
    var note = [];
    avant.forEach(function (e) { if (e.cle === 'NOTE' && !note.length) { note = e.lignes; } });
    return { note: U.nu(note), events: events };
  }

  /* ===================== RENDU ===================== */
  function rendreChronofam(bloc) {
    var d = lire(bloc);
    var racine = h('div', 'cf');
    if (!d.events.length) { return racine; }

    var out = '<div class="cf-liste">' + d.events.map(function (e) {
      return '<div class="cf-ev"><span class="cf-pt"></span>'
        + '<div class="cf-ligne"><span class="cf-date">' + esc(e.d) + '</span>'
        + (e.t ? '<span class="cf-titre">' + esc(e.t) + '</span>' : '') + '</div>'
        + '<div class="cf-txt">' + U.paragraphes(e.corps) + '</div></div>';
    }).join('') + '</div>';
    if (d.note) { out += '<p class="cf-note">' + esc(d.note) + '</p>'; }
    racine.innerHTML = out;

    animer(racine);
    return racine;
  }

  /* ===================== LE FIL QUI SE REMPLIT =====================
     Pas de animation-timeline : Firefox ne la gère pas encore. Un
     écouteur de défilement lissé par requestAnimationFrame donne le
     même résultat partout. L'écoute est posée en capture sur le
     document, pour attraper aussi le défilement d'un panneau SOS. */
  function animer(racine) {
    var liste = racine.querySelector('.cf-liste');
    var evs = Array.prototype.slice.call(liste.querySelectorAll('.cf-ev'));
    if (!evs.length) { return; }
    var doux = !global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var centres = [], debut = 0, fin = 0, attend = false;

    /* chaque pastille prend la couleur du fil à sa hauteur : du doré au grenat */
    function teinter() {
      var n = evs.length;
      evs.forEach(function (ev, i) {
        var pc = n > 1 ? Math.round(i / (n - 1) * 100) : 100;
        ev.style.setProperty('--c', 'color-mix(in srgb, var(--dark2) ' + pc + '%, var(--clair2))');
      });
    }
    /* positions des pastilles : relevées au montage, puis au redimensionnement
       et une fois les polices chargées, qui décalent les hauteurs */
    function mesurer() {
      var rl = liste.getBoundingClientRect();
      centres = evs.map(function (ev) {
        var r = ev.querySelector('.cf-pt').getBoundingClientRect();
        return r.top - rl.top + r.height / 2;
      });
      debut = centres[0];
      fin = centres[centres.length - 1];
      liste.style.setProperty('--debut', debut + 'px');
      liste.style.setProperty('--fin', fin + 'px');
    }
    function maj() {
      attend = false;
      if (!doux) {                                   /* animation refusée : tout est plein */
        liste.style.setProperty('--rempli', (fin - debut) + 'px');
        evs.forEach(function (ev) { ev.classList.add('passe'); });
        return;
      }
      var rl = liste.getBoundingClientRect();
      var lecture = global.innerHeight * LECTURE - rl.top;
      var r = Math.max(0, Math.min(fin - debut, lecture - debut));
      liste.style.setProperty('--rempli', r + 'px');
      evs.forEach(function (ev, i) { ev.classList.toggle('passe', centres[i] <= lecture); });
    }
    function demander() { if (!attend) { attend = true; requestAnimationFrame(maj); } }

    teinter(); mesurer(); maj();
    document.addEventListener('scroll', demander, true);   /* capture : aussi les panneaux SOS */
    global.addEventListener('resize', function () { mesurer(); demander(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { mesurer(); maj(); });
    }
  }

  /* ===================== ENREGISTREMENT ===================== */
  SOS.blocs.chronofam = rendreChronofam;

})(window);
