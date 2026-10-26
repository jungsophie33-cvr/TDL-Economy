/* =============================================================
   SOS — Sophia OS · BLOC RELATIONS (sos-bloc-relations.js)
   -------------------------------------------------------------
   Ajoute le type « relations » au registre SOS.blocs : les liens
   d'un pré-lien INDIVIDUEL — onglets-images à gauche reliés par
   un rail --cntr, panneau texte à droite qui épouse son contenu,
   flèche qui désigne l'onglet actif.

   Pensé pour vivre dans un onglet de fiche (--- ONGLET --- d'un
   « === INDIVIDUEL »), JAMAIS en « === » : la fiche se ferme à la
   première ligne === FIN rencontrée, fût-elle celle du bloc.

   FORMAT DU BLOC :

     <div class="tdl-bloc">
     --- BLOC relations ---
     RELATION: Alice Liddell | pnj | amie d'enfance
     IMAGE: https://…           (facultatif — sinon initiales)
     ICONE: fi-sr-heart         (facultatif — du type de lien)
     TEXTE: Premier paragraphe — HTML inline admis.
     TEXTE: La clé répétée s'accumule : un paragraphe de plus.
     RELATION: Bob Marlowe | libre | rival de toujours
     TEXTE: Un seul paragraphe suffit aussi.
     </div>

   La ligne RELATION: accepte « Nom », « Nom | statut »,
   « Nom | statut | type de lien », voire « Nom | type | statut » :
   la première valeur reconnue comme statut (libre, pris(e),
   réservé(e), pnj, décédé(e)/mort) prend le rôle, le reste compose
   le type de lien. Sans statut reconnu : pas de pastille. Sans
   nom : la relation est ignorée (console), le bloc reste debout.

   Pas de === FIN : le <div> referme le bloc. S'emploie via
   sos-inline.js, dans une annexe comme dans un message.

   Un seul lien : la classe tdlrel-solo centre l'onglet face au
   panneau. Une relation sans IMAGE: affiche les initiales.

   Dépend de : sos-core.js, sos-blocs.js (SOS.h, SOS.util, grouper).
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { if (global.console) { console.error('sos-bloc-relations.js : sos-core.js doit être chargé avant.'); } return; }
  var h = SOS.h, U = SOS.util;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&(?![a-z#0-9]+;)/gi, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* -------- statuts : mêmes valeurs que sos-pl-core (T.litStatut) -------- */
  function slug(t) {
    return String(t || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function litStatut(t) {
    var v = slug(t);
    if (v === 'libre') return 'libre';
    if (v === 'pris' || v === 'prise') return 'pris';
    if (v === 'reserve' || v === 'reservee') return 'reserve';
    if (v === 'pnj') return 'pnj';
    if (v === 'dcd' || v === 'decede' || v === 'decedee' || v === 'mort' || v === 'morte') return 'dcd';
    return null;
  }

  var LIB = { libre: 'libre', pris: 'pris', reserve: 'réservé', pnj: 'pnj', dcd: 'décédé' };
  var ICONE_DEFAUT = 'fi-sr-link';

  /* ===================== LECTURE DU BLOC ===================== */

  function lire(bloc) {
    var liens = [];
    SOS.grouper(bloc, 'RELATION').forEach(function (g) {
      var parties = U.pipe(g.ouverture[0] || '');
      var nom = U.sansBalises(parties[0] || '');
      if (!nom) {
        if (global.console) { console.warn('[SOS relations] RELATION sans nom, ligne ignorée : « ' + (g.ouverture[0] || '') + ' »'); }
        return;
      }
      var e = { nom: nom, statut: null, type: '', image: '', icone: '', texte: '' };
      var typeParts = [];
      /* le statut est cherché parmi les valeurs qui suivent le nom :
         la première reconnue prend le rôle, le reste compose le type */
      parties.slice(1).forEach(function (p) {
        var st = e.statut ? null : litStatut(p);
        if (st) { e.statut = st; return; }
        typeParts.push(p);
      });
      e.type = typeParts.join(' | ');
      e.image = U.nu(g.champs.IMAGE || []);
      e.icone = U.sansBalises((g.champs.ICONE || [''])[0] || '') || ICONE_DEFAUT;
      e.texte = U.paragraphes(g.champs.TEXTE || []);
      liens.push(e);
    });
    return liens;
  }

  function initiales(nom) {
    var mots = String(nom || '').split(/\s+/).filter(Boolean);
    var s = (mots[0] || '?').charAt(0);
    if (mots[1]) { s += mots[1].charAt(0); }
    return s.toUpperCase();
  }

  /* ===================== RENDU ===================== */

  function rendreRelations(bloc) {
    var liens = lire(bloc);
    var racine = h('div', 'tdlrel');
    if (!liens.length) {
      if (global.console) { console.warn('[SOS relations] aucune relation exploitable : bloc vide'); }
      return racine;
    }
    if (liens.length === 1) { racine.classList.add('tdlrel-solo'); }

    var colonne = h('div', 'tdlrel-tabs');
    var fleche = h('div', 'tdlrel-arrow');
    colonne.appendChild(fleche);

    var contenu = h('div', 'tdlrel-content');

    liens.forEach(function (e, i) {
      var cle = 'r' + i;

      var onglet = h('button', 'tdlrel-tab' + (i === 0 ? ' active' : ''));
      onglet.setAttribute('type', 'button');
      onglet.setAttribute('data-rel', cle);
      onglet.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      if (e.image) {
        var img = h('img');
        img.setAttribute('src', e.image);
        img.setAttribute('alt', e.nom);
        onglet.appendChild(img);
      } else {
        onglet.classList.add('sans-img');
        onglet.appendChild(document.createTextNode(initiales(e.nom)));
      }
      colonne.appendChild(onglet);

      var pan = h('div', 'tdlrel-panel' + (i === 0 ? ' active' : ''));
      pan.setAttribute('data-rel', cle);
      pan.innerHTML =
        '<div class="tdlrel-tete">' +
          '<div class="tdlrel-entete">' +
            '<span class="tdlrel-nom">' + esc(e.nom) + '</span>' +
            (e.statut ? '<span class="tdlrel-stat st-' + e.statut + '">' + esc(LIB[e.statut]) + '</span>' : '') +
          '</div>' +
          (e.type ? '<p class="tdlrel-type"><i class="fi ' + esc(e.icone) + '"></i>' + esc(e.type) + '</p>' : '') +
        '</div>' +
        '<div class="tdlrel-texte">' + e.texte + '</div>';
      contenu.appendChild(pan);
    });

    racine.appendChild(colonne);
    racine.appendChild(contenu);
    brancher(racine);
    return racine;
  }

  /* ===================== LA FLÈCHE ET LES PANNÉAUX ===================== */

  function placerFleche(rel) {
    var fleche = rel.querySelector('.tdlrel-arrow');
    var onglet = rel.querySelector('.tdlrel-tab.active');
    var colonne = rel.querySelector('.tdlrel-tabs');
    if (!fleche || !onglet || !colonne) { return; }
    var base = colonne.getBoundingClientRect();
    var r = onglet.getBoundingClientRect();
    var centre = r.top + r.height / 2 - base.top;
    fleche.style.top = (centre - fleche.offsetHeight / 2) + 'px';
  }

  function brancher(rel) {
    var onglets = Array.prototype.slice.call(rel.querySelectorAll('.tdlrel-tab'));
    if (!onglets.length) { return; }

    /* verrou : un clic pendant la transition ne peut pas emmêler
       deux fondus */
    var occupe = false;

    onglets.forEach(function (onglet) {
      onglet.addEventListener('click', function () {
        if (occupe) { return; }
        var cle = onglet.getAttribute('data-rel');
        var cible = rel.querySelector('.tdlrel-panel[data-rel="' + cle + '"]');
        var courant = rel.querySelector('.tdlrel-panel.active');
        if (!cible || cible === courant) { return; }

        onglets.forEach(function (o) {
          o.classList.remove('active');
          o.setAttribute('aria-pressed', 'false');
        });
        onglet.classList.add('active');
        onglet.setAttribute('aria-pressed', 'true');

        placerFleche(rel);

        if (!courant) { cible.classList.add('active'); return; }

        occupe = true;
        courant.classList.remove('active');
        courant.classList.add('leaving');

        /* le retrait se fait à la fin RÉELLE de l'animation, pas sur
           un compte-à-rebours qui courrait après elle : le panneau
           sortant ne reparaît jamais en opacity 1, et le nouveau
           panneau est posé dans le même battement — pas de creux ni
           de saut de hauteur. (L'animation elle-même porte
           animation-fill-mode: forwards, voir le CSS.) */
        courant.addEventListener('animationend', function fin(ev) {
          if (ev.target !== courant || ev.animationName !== 'tdlrelOut') { return; }
          courant.removeEventListener('animationend', fin);
          courant.classList.remove('leaving');
          cible.classList.add('active');
          occupe = false;
        });
        /* filet : un panneau masqué, ou un navigateur en animation
           réduite, n'émet jamais animationend */
        global.setTimeout(function () {
          if (!cible.classList.contains('active')) {
            courant.classList.remove('leaving');
            cible.classList.add('active');
            occupe = false;
          }
        }, 450);
      });
    });

    placerFleche(rel);

    /* Un bloc monté dans un onglet de fiche est mesuré trop tôt, ou
       à hauteur nulle tant que l'onglet n'est pas visible. La fiche
       émet « sos:panneau » après chaque montage de panneau : on en
       profite, avec resize, le chargement complet et les polices. */
    document.addEventListener('sos:panneau', function () {
      if (!rel.isConnected) { return; }
      placerFleche(rel);
    });
    global.addEventListener('resize', function () { placerFleche(rel); });
    global.addEventListener('load', function () { placerFleche(rel); });
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () { placerFleche(rel); });
    }
    if (global.requestAnimationFrame) {
      global.requestAnimationFrame(function () { placerFleche(rel); });
    }
  }

  SOS.blocs.relations = rendreRelations;

})(window);
