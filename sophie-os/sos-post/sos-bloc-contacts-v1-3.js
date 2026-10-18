/* =============================================================
   SOS — Sophia OS · BLOC CONTACTS (sos-bloc-contacts.js)
   -------------------------------------------------------------
   Ajoute le type « contacts » au registre SOS.blocs : une série
   de pré-liens courts, parcourus par une piste de cartes, chacun
   affichant sa fiche déroulée en dessous.

   Pensé pour tout type d'organisation — bandes hors-la-loi,
   communautés, bureau du shérif, groupes créés par les membres.

   FORMAT DU BLOC :

     --- BLOC contacts ---
     BREF: oui                      (facultatif — variante compacte)

     CONTACT: Le Brasseur
     TYPE: Affaires
     STATUT: LIBRE                  LIBRE / PRIS / RESERVE / PNJ
     ROLE: Gérant d'une micro-brasserie
     PROFIL: (h) 35 ans et plus — FC libre
     IMAGE: https://…
     TEXTE: premier paragraphe
     TEXTE: second paragraphe
     UTILITE: ce que ce contact apporte à l'organisation
     PISTES: les pistes de jeu ouvertes par ce rôle
     INFO: Secteur | Zone industrielle d'Houma      (répétable)
     NOTE: le mot griffonné en marge                (le post-it)
     SIGNE: Emyl                                    (facultatif)
     FICHE: ?fiche=galaad-blackford                 (renvoi)
     RENVOI: Sa fiche dans la famille Blackford

   Tout est facultatif sauf CONTACT. Un contact sans IMAGE retombe
   sur l'illustration générique de la charte.

   Le bloc réutilise le bandeau des fiches de pré-liens
   (.tdlplf-bandeau) : même grammaire visuelle, aucun doublon.

   Dépend de : sos-core.js, sos-blocs.js (SOS.h, SOS.util, grouper).
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { console.error('sos-bloc-contacts.js : sos-core.js doit être chargé avant.'); return; }
  var h = SOS.h, U = SOS.util;

  /* Au-delà de ce nombre d'entrées, le compteur de rôles libres s'affiche.
     En dessous, l'offre se compte d'un coup d'œil et il serait bavard. */
  var SEUIL_COMPTEUR = 3;

  var LIB = { UTILITE: "Ce qu'il apporte", PISTES: 'Pistes de jeu' };
  var ORDRE = ['UTILITE', 'PISTES'];
  var LIB_STATUT = { libre: 'libre', pris: 'pris', reserve: 'réservé', pnj: 'pnj' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&(?![a-z#0-9]+;)/gi, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function litStatut(v) {
    var t = String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (t === 'pris' || t === 'prise') return 'pris';
    if (t === 'reserve' || t === 'reservee') return 'reserve';
    if (t === 'pnj') return 'pnj';
    return 'libre';
  }

  /* ===================== LECTURE ===================== */
  function lire(bloc) {
    var liste = [];
    SOS.grouper(bloc, 'CONTACT').forEach(function (g) {
      var nom = U.sansBalises(g.ouverture[0] || '').trim();
      if (!nom) return;
      var infos = [];
      (g.champs.INFO || []).forEach(function (l) {
        var b = U.nu([l]).split('|');
        if (b.length > 1) infos.push({ lib: b[0].trim(), val: b.slice(1).join('|').trim() });
      });
      liste.push({
        nom: nom,
        type: U.nu(g.champs.TYPE || []),
        statut: litStatut(U.nu(g.champs.STATUT || [])),
        role: U.nu(g.champs.ROLE || []),
        profil: U.nu(g.champs.PROFIL || []),
        img: U.sansBalises(U.nu(g.champs.IMAGE || [])).trim(),
        corps: g.champs.TEXTE || [],
        champs: {
          UTILITE: U.nu(g.champs.UTILITE || []),
          PISTES: U.nu(g.champs.PISTES || [])
        },
        infos: infos,
        note: U.nu(g.champs.NOTE || []),
        signe: U.nu(g.champs.SIGNE || []),
        fiche: U.sansBalises(U.nu(g.champs.FICHE || [])).trim(),
        renvoi: U.nu(g.champs.RENVOI || [])
      });
    });
    return liste;
  }

  /* ===================== RENDU ===================== */

  /* Le compteur cherche le titre de section le plus proche pour s'y loger à
     droite. Rien trouvé : il se pose au-dessus de la piste. */
  function titreProche(el) {
    var p = el;
    for (var i = 0; i < 4 && p; i++) {
      p = p.parentNode;
      if (!p || !p.querySelector) return null;
      var t = p.querySelector('.h3 h3');
      if (t) return t;
    }
    return null;
  }

  function htmlFiche(c) {
    var out = '<div class="ctc-fiche">';

    /* Bandeau : classes des fiches de pré-liens, réutilisées telles quelles. */
    out += '<div class="tdlplf-bandeau"' +
      (c.img ? ' style="--tdlplf-img:url(\'' + esc(c.img) + '\')"' : '') + '>' +
      '<div class="tdlplf-band-txt">' +
        '<h1 class="tdlplf-band-nom">' + esc(c.nom) + '</h1>' +
        (c.role ? '<span class="tdlplf-band-sous">' + esc(c.role) + '</span>' : '') +
        (c.profil ? '<span class="tdlplf-band-profil">' + esc(c.profil) + '</span>' : '') +
      '</div>' +
      '<span class="tdlplf-tampon tdlplf-' + c.statut + '">' +
        (LIB_STATUT[c.statut] || c.statut) + '</span></div>';

    /* Le post-it est écrit AVANT les paragraphes : le texte l'habille. */
    out += '<div class="ctc-corps">';
    if (c.note) {
      out += '<aside class="ctc-note"><p>' + esc(c.note) + '</p>' +
        (c.signe ? '<cite>— ' + esc(c.signe) + '</cite>' : '') + '</aside>';
    }
    out += U.paragraphes(c.corps) + '</div>';

    if (c.fiche) {
      out += '<a class="ctc-renvoi" href="' + esc(c.fiche) + '">' +
        esc(c.renvoi || 'Voir la fiche') + ' &#8594;</a>';
    }

    var champs = ORDRE.filter(function (k) { return c.champs[k]; });
    if (champs.length || c.infos.length) {
      out += '<div class="ctc-champs">';
      champs.forEach(function (k) {
        out += '<div class="ctc-champ"><f4>' + esc(LIB[k]) + '</f4><span>' +
          esc(c.champs[k]) + '</span></div>';
      });
      c.infos.forEach(function (x) {
        out += '<div class="ctc-champ"><f4>' + esc(x.lib) + '</f4><span>' +
          esc(x.val) + '</span></div>';
      });
      out += '</div>';
    }
    return out + '</div>';
  }

  function rendreContacts(bloc) {
    var liste = lire(bloc);
    var racine = h('div', 'ctc');
    if (!liste.length) { return racine; }

    var bref = /^(oui|yes|true)$/i.test(U.nu(bloc.champs && bloc.champs.BREF || []) || '');
    if (bref) racine.className += ' ctc--bref';

    racine.innerHTML =
      '<div class="ctc-piste">' +
        '<button class="ctc-fleche" data-sens="-1" aria-label="Précédent">&#8249;</button>' +
        '<div class="ctc-rail"><div class="ctc-train"></div></div>' +
        '<button class="ctc-fleche" data-sens="1" aria-label="Suivant">&#8250;</button>' +
      '</div><div class="ctc-detail"></div>';

    var train = racine.querySelector('.ctc-train');
    var rail = racine.querySelector('.ctc-rail');
    var detail = racine.querySelector('.ctc-detail');
    var courant = 0;

    liste.forEach(function (c, i) {
      var b = document.createElement('button');
      b.className = 'ctc-carte ctc-' + c.statut;
      if (c.img) b.style.setProperty('--ctc-img', "url('" + c.img + "')");
      b.title = LIB_STATUT[c.statut] || c.statut;
      b.innerHTML = '<div class="ctc-vign"></div><div class="ctc-txt">' +
        '<div class="ctc-nom-c">' + esc(c.nom) + '</div>' +
        (c.type ? '<span class="ctc-type-c">' + esc(c.type) + '</span>' : '') +
        '</div>';
      b.onclick = function () { if (i !== courant) { courant = i; rendre(); } };
      train.appendChild(b);
    });

    function majFleches() {
      var max = rail.scrollWidth - rail.clientWidth - 2;
      racine.querySelector('[data-sens="-1"]').disabled = rail.scrollLeft <= 2;
      racine.querySelector('[data-sens="1"]').disabled = rail.scrollLeft >= max;
    }

    function rendre() {
      placerCompteur();          // le panneau a pu être reconstruit entre-temps
      Array.prototype.forEach.call(train.children, function (b, i) {
        b.classList.toggle('ctc-on', i === courant);
      });
      var act = train.children[courant];
      if (act && rail.clientWidth) {
        rail.scrollTo({
          left: act.offsetLeft - rail.clientWidth / 2 + act.offsetWidth / 2,
          behavior: 'smooth'
        });
      }
      detail.innerHTML = htmlFiche(liste[courant]);
      majFleches();
    }

    Array.prototype.forEach.call(racine.querySelectorAll('.ctc-fleche'), function (f) {
      f.onclick = function () {
        rail.scrollBy({ left: (+f.dataset.sens) * (rail.clientWidth - 40), behavior: 'smooth' });
        setTimeout(majFleches, 420);
      };
    });
    rail.addEventListener('scroll', majFleches);

    detail.innerHTML = htmlFiche(liste[0]);
    train.children[0].classList.add('ctc-on');

    /* ----- le compteur -----
       Il cherche à se loger dans le titre de section. Mais sos-inline monte
       les blocs sur DOMContentLoaded, alors que tdlpl-fiche.js attend load :
       au premier regard, le bloc est encore dans le message brut et aucun
       titre n'existe à proximité. On réessaie donc après coup, et le
       compteur migre de son emplacement de secours vers le titre dès qu'il
       apparaît.

       Et surtout : un onglet inactif a ses nœuds DÉTACHÉS du document. Un
       bloc posé dans le troisième onglet n'a donc aucun parent tant qu'on
       n'a pas cliqué dessus, et aucune remontée ne peut aboutir. D'où
       l'observateur de visibilité, qui rejoue le placement à chaque fois
       que le bloc réapparaît — le titre étant reconstruit à chaque
       changement d'onglet, le compteur doit s'y raccrocher chaque fois. */
    var cpt = null;

    function placerCompteur() {
      if (!cpt || !racine.isConnected) return;
      var titre = titreProche(racine);
      if (titre && cpt.parentNode !== titre) titre.appendChild(cpt);
    }

    requestAnimationFrame(function () {
      majFleches();
      if (liste.length <= SEUIL_COMPTEUR) return;
      var libres = liste.filter(function (c) { return c.statut === 'libre'; }).length;
      var res = liste.filter(function (c) { return c.statut === 'reserve'; }).length;
      var txt = '<em>' + libres + (libres > 1 ? ' rôles libres' : ' rôle libre') +
                ' sur ' + liste.length + '</em>';
      if (res) txt += ' · ' + res + (res > 1 ? ' réservés' : ' réservé');
      cpt = document.createElement('span');
      cpt.className = 'ctc-compte';
      cpt.innerHTML = txt;
      racine.insertBefore(cpt, racine.firstChild);   // emplacement de secours
      placerCompteur();
      window.addEventListener('load', placerCompteur);
      setTimeout(placerCompteur, 600);

      if (window.IntersectionObserver) {
        // Pas de disconnect : à chaque retour sur l'onglet, le titre est neuf.
        new IntersectionObserver(function (entrees) {
          entrees.forEach(function (e) { if (e.isIntersecting) placerCompteur(); });
        }).observe(racine);
      }
    });

    return racine;
  }

  /* ===================== ENREGISTREMENT ===================== */
  SOS.blocs.contacts = rendreContacts;

})(window);
