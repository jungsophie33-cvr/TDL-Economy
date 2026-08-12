/* =============================================================
   SOS — Sophia OS · LECTEUR D'AMBIANCE (sos-audio.js)
   -------------------------------------------------------------
   Pose un lecteur audio discret dans la coquille permanente
   (.sos-app). Comme la coquille n'est jamais détruite entre deux
   annexes, la musique traverse toutes les navigations sans coupure.

   Règles (validées) :
     • DÉSACTIVÉ sur tactile : `(pointer: coarse)` -> aucun lecteur,
       aucun nœud <audio> créé (téléphones ET tablettes).
     • Démarrage automatique : on tente play() ; si le navigateur le
       refuse (politique anti-autoplay), on démarre au premier geste.
     • Volume bas fixe + icône mute/unmute (pas de curseur en v1).
     • Enchaînement automatique de la playlist, en boucle.
     • Reprise de position (currentTime) — dépend d'un hôte qui
       répond aux requêtes Range ; sinon le morceau repart de 0.
     • Persistance localStorage : actif, muet, piste, temps.

   Couche OPTIONNELLE : si ce fichier n'est pas chargé, tout le reste
   fonctionne à l'identique. À charger APRÈS sos-annexe.js.
   Dépend de : sos-core.js (rien de plus que SOS.h + SOS.shell.app).
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { console.error('sos-audio.js : sos-core.js doit être chargé avant.'); return; }
  var h = SOS.h;

  /* =========================================================
     CONFIG — à éditer à la main
     ========================================================= */
  // Playlist : un objet { titre, url } par morceau. L'url doit pointer
  // le FICHIER audio directement (pas une page-lecteur), même origine
  // non requise, mais hotlink autorisé + bon Content-Type audio.
  var PLAYLIST = [
    { titre: 'Midnight Covennant', url: 'https://www.aht.li/3984403/01_Midnight_covennant.m4a' },
    { titre: "Bayou's Lament",     url: 'https://www.aht.li/3984291/01_Bayous_Lament.m4a' },
    { titre: 'Bottle Tree',        url: 'https://www.aht.li/3984401/01_Bottle_Tree.m4a' },
    { titre: 'The Guardian',       url: 'https://www.aht.li/3984402/01_The_Guardian.m4a' }
  ];

  var VOLUME = 0.18;   // volume bas fixe (subliminal)

  // Icônes Flaticon (à ajuster si un glyphe n'existe pas dans ta feuille)
  var ICO = { play: 'fi-sr-play', pause: 'fi-sr-pause', son: 'fi-tr-volume', muet: 'fi-tr-volume-slash' };

  // Clés localStorage
  var K = { actif: 'tdl_audio_actif', muet: 'tdl_audio_muet', piste: 'tdl_audio_piste', temps: 'tdl_audio_temps' };

  /* =========================================================
     OUTILS
     ========================================================= */
  function tactile() { return !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches); }
  function shell() { return SOS.shell || {}; }
  function lire(cle, defaut) { try { var v = localStorage.getItem(cle); return v === null ? defaut : v; } catch (e) { return defaut; } }
  function ecrire(cle, val) { try { localStorage.setItem(cle, val); } catch (e) {} }
  function borne(i) { i = parseInt(i, 10); return (isNaN(i) || i < 0 || i >= PLAYLIST.length) ? 0 : i; }

  /* =========================================================
     ÉTAT
     ========================================================= */
  var audio, lecteur, btn, icoVol, barre, titreEl;
  var iPiste = 0, dernierSave = 0, pannes = 0, gesteArme = false;

  /* =========================================================
     CONSTRUCTION
     ========================================================= */
  function construire() {
    var app = shell().app;
    if (!app || tactile() || !PLAYLIST.length) { return; }   // pas de lecteur sur tactile
    if (lecteur) { return; }                                  // déjà monté

    audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.volume = VOLUME;
    audio.muted = (lire(K.muet, '0') === '1');

    lecteur = h('div', 'sos-lecteur');
    lecteur.innerHTML =
      '<button class="lec-btn" aria-label="Lecture / pause"><i class="fi ' + ICO.play + '"></i></button>' +
      '<div class="lec-info"><span class="lec-titre"></span>' +
      '<span class="lec-barre"><span></span></span></div>' +
      '<i class="lec-vol fi ' + ICO.son + '" role="button" tabindex="0" aria-label="Couper le son"></i>';
    app.appendChild(lecteur);
    app.appendChild(audio);

    btn     = lecteur.querySelector('.lec-btn');
    icoVol  = lecteur.querySelector('.lec-vol');
    barre   = lecteur.querySelector('.lec-barre > span');
    titreEl = lecteur.querySelector('.lec-titre');

    chargerPiste(borne(lire(K.piste, '0')), parseFloat(lire(K.temps, '0')) || 0);
    brancher();
    majBouton();
    majMuet();

    // démarrage auto (sauf si l'utilisateur avait mis en pause au dernier passage)
    if (lire(K.actif, '1') !== '0') { demarrer(); }
  }

  /* =========================================================
     PISTES
     ========================================================= */
  function chargerPiste(i, temps) {
    iPiste = borne(i);
    var p = PLAYLIST[iPiste];
    if (audio.getAttribute('src') !== p.url) { audio.src = p.url; }
    if (titreEl) { titreEl.textContent = p.titre; }
    ecrire(K.piste, String(iPiste));
    if (temps && temps > 0) { seekVers(temps); }
  }

  function seekVers(temps) {
    var appliquer = function () { try { audio.currentTime = temps; } catch (e) {} };
    if (audio.readyState >= 1) { appliquer(); }
    else {
      var once = function () { appliquer(); audio.removeEventListener('loadedmetadata', once); };
      audio.addEventListener('loadedmetadata', once);
    }
  }

  function pisteSuivante() { chargerPiste(iPiste + 1 >= PLAYLIST.length ? 0 : iPiste + 1, 0); }

  /* =========================================================
     LECTURE / DÉMARRAGE
     ========================================================= */
  function demarrer() {
    var pr = audio.play();
    if (pr && pr.then) { pr.then(majBouton).catch(armerGeste); }
    else { majBouton(); }
  }

  // Si l'autoplay est bloqué : on démarre au tout premier geste utilisateur.
  function armerGeste() {
    majBouton();
    if (gesteArme) { return; }
    gesteArme = true;
    var evts = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    var go = function () {
      retirer();
      audio.play().then(majBouton).catch(function () {});
    };
    function retirer() {
      gesteArme = false;
      evts.forEach(function (ev) { global.removeEventListener(ev, go, true); });
    }
    evts.forEach(function (ev) { global.addEventListener(ev, go, true); });
  }

  /* =========================================================
     ÉVÉNEMENTS
     ========================================================= */
  function brancher() {
    btn.addEventListener('click', function () {
      if (audio.paused) { audio.play().catch(function () {}); ecrire(K.actif, '1'); }
      else { audio.pause(); ecrire(K.actif, '0'); }
    });

    var basculeMuet = function () {
      audio.muted = !audio.muted;
      ecrire(K.muet, audio.muted ? '1' : '0');
      majMuet();
    };
    icoVol.addEventListener('click', basculeMuet);
    icoVol.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); basculeMuet(); }
    });

    audio.addEventListener('play', majBouton);
    audio.addEventListener('pause', majBouton);
    audio.addEventListener('playing', function () { pannes = 0; });
    audio.addEventListener('ended', function () { pisteSuivante(); audio.play().catch(function () {}); });

    audio.addEventListener('timeupdate', function () {
      if (barre && audio.duration) {
        barre.style.width = (audio.currentTime / audio.duration * 100).toFixed(1) + '%';
      }
      var now = Date.now();
      if (now - dernierSave > 4000) { dernierSave = now; ecrire(K.temps, String(Math.floor(audio.currentTime))); }
    });

    // fichier illisible (hôte, format, réseau) : on saute au suivant,
    // mais on s'arrête après un tour complet pour éviter la boucle folle.
    audio.addEventListener('error', function () {
      pannes++;
      console.warn('SOS audio : lecture impossible de «' + PLAYLIST[iPiste].titre + '»');
      if (pannes < PLAYLIST.length) { pisteSuivante(); audio.play().catch(function () {}); }
    });

    global.addEventListener('pagehide', function () { ecrire(K.temps, String(Math.floor(audio.currentTime || 0))); });
  }

  /* =========================================================
     RENDU UI
     ========================================================= */
  function majBouton() {
    var ic = btn && btn.querySelector('i');
    if (ic) { ic.className = 'fi ' + (audio.paused ? ICO.play : ICO.pause); }
  }
  function majMuet() {
    if (icoVol) { icoVol.className = 'lec-vol fi ' + (audio.muted ? ICO.muet : ICO.son); }
  }

  /* =========================================================
     API (debug) + MONTAGE
     ========================================================= */
  SOS.audio = {
    lecteur: function () { return lecteur; },
    element: function () { return audio; }
  };

  global.addEventListener('sos:pret', function () { if (shell().app) { construire(); } });

})(window);
