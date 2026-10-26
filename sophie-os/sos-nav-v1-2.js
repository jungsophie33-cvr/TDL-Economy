/* =============================================================
   SOS — Sophia OS · NAVIGATION INTER-ANNEXE (sos-nav.js)
   -------------------------------------------------------------
   La couche qui masque ForumActif : elle fait passer d'un topic
   d'annexe à un autre SANS recharger le document, pour que rien
   d'intégré à la coquille (à venir : le lecteur audio) ne soit
   interrompu. Trois responsabilités :

     1. SOMMAIRE — « Guidebook du Bayou », une vue de cartes lues
        dans SOS.manifeste, montée dans le deck via
        SOS.shell.monterSection (thème clair).
     2. CHARGEMENT IN-PAGE — fetch same-origin du topic cible, extrait
        ses données tdl-data, demande à la coquille de se reconstruire
        (SOS.shell.reconstruire), puis met à jour l'URL (pushState).
        Retour/avance (popstate) rejouent le chargement.
     3. VOILE DE CHARGEMENT — feedback discret, affiché seulement si la
        latence dépasse 180 ms (pas de flash sur connexion rapide).

   [MAJ v1-2] ANNEXES MULTIPAGES ET ÉCHEC DOUX.
     · Un topic d'annexe qui déborde sur /t38p25-… était chargé pour sa
       seule première page : les panneaux des pages suivantes étaient
       perdus, sans erreur. chargerTopic sonde désormais la pagination
       du topic fetché (SOS.detecterPages, [MAJ v1-2] du noyau) et
       charge toutes ses pages (jusqu'à 12) avant de reconstruire.
     · L'échec d'un chargement ne RECHARGE PLUS la page : le repli
       location.href coupait la musique et l'ambiance, précisément ce
       que cette couche existe pour préserver. On reste sur l'annexe
       courante, avec un avis discret et un avertissement console.
     · Le marqueur « vous êtes ici » du sommaire compare l'ID du sujet
       (/t38), pas le préfixe de l'URL : un renommage ou une pagination
       ne provoquera plus de faux positifs (ancien bug : /t38-033
       marqué courant pour l'annexe /t38-03).

   Couche OPTIONNELLE : si ce fichier n'est pas chargé, la coquille
   fonctionne seule (navigation intra-annexe, « sujet: » en nouvel
   onglet, pas de bouton sommaire).

   Dépend de : sos-core.js, sos-blocs.js (SOS.h), sos-annexe.js
   (SOS.shell). À charger EN DERNIER.
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { console.error('sos-nav.js : sos-core.js doit être chargé avant.'); return; }
  var h = SOS.h;

  /* (l'ancien repli GUIDE — rechargement complet — est retiré en
     v1-2 : il coupait le lecteur audio. On reste désormais en place.) */

  function shell() { return SOS.shell || {}; }
  function normPath(p) { return String(p || '').replace(/\/+$/, ''); }
  /* [MAJ v1-2] ID de sujet (/t38), indépendant du slug et de la page. */
  function sujetId(p) { var m = String(p || '').match(/^\/t(\d+)/); return m ? m[1] : ''; }
  function absolu(url) {
    try { return new URL(url, location.href).href; } catch (e) { return url; }
  }

  /* =========================================================
     VOILE DE CHARGEMENT (créé à la volée dans .sos-app)
     ========================================================= */
  var chargeEl;
  function veil() {
    if (chargeEl) { return chargeEl; }
    var app = shell().app;
    if (!app) { return null; }
    chargeEl = h('div', 'sos-chargement');
    chargeEl.innerHTML = '<div class="sos-orbite"><span class="sos-bille"></span></div>';
    app.appendChild(chargeEl);
    return chargeEl;
  }
  function montrerCharge(on) {
    var v = veil();
    if (v) { v.classList.toggle('actif', !!on); }
  }

  /* =========================================================
     SOMMAIRE — « Guidebook du Bayou » (cartes lues dans SOS.manifeste)
     ========================================================= */
  function rendreSommaire() {
    var sec = h('section', 'sos-panneau p-somm');
    sec.setAttribute('data-theme', 'clair');

    var wrap = h('div', 'somm-wrap');
    var head = h('div', 'somm-head');
    head.appendChild(h('h1', 'somm-titre', 'Guidebook du Bayou'));
    head.appendChild(h('p', 'somm-intro', 'Choisissez une annexe à parcourir.'));
    head.appendChild(h('div', 'sep', '<span class="fleur"></span>'));
    wrap.appendChild(head);

    var man = SOS.manifeste || [];
    if (!man.length) {
      wrap.appendChild(h('p', 'somm-vide', 'Aucune annexe déclarée pour le moment.'));
    } else {
      var grille = h('div', 'somm-grille');
      var ici = normPath(location.pathname);
      man.forEach(function (e) {
        if (!e || !e.url) { return; }
        var carte = h('a', 'somm-carte');
        carte.href = e.url;                        // vraie URL : repli si JS off / clic milieu
        carte.setAttribute('data-annexe', e.url);  // hook navigation in-page (géré par la coquille)
        /* [MAJ v1-2] « courant » par ID de sujet : page (p25) et
           renommage du slug ne provoquent plus de faux positifs. */
        var idCible = sujetId(normPath(e.url.replace(/^https?:\/\/[^\/]+/, '')));
        if (sujetId(ici) && idCible && sujetId(ici) === idCible) { carte.classList.add('courant'); }
        var ic = (e.icone || '').trim();
        if (ic) { carte.appendChild(h('i', 'somm-ic fi ' + ic)); }
        carte.appendChild(h('h3', 'somm-nom', e.titre || ''));
        if (e.soustitre) { carte.appendChild(h('p', 'somm-sous', e.soustitre)); }
        grille.appendChild(carte);
      });
      wrap.appendChild(grille);
    }
    sec.appendChild(wrap);
    return sec;
  }

  function monterSommaire() {
    var s = shell();
    if (!s.app || !s.monterSection) { return; }
    s.app.style.setProperty('--commu', 'var(--dark)');   // accent hors-annexe
    s.monterSection(rendreSommaire(), { ongletSomm: true, theme: 'clair' });
  }

  /* =========================================================
     CHARGEMENT IN-PAGE D'UN TOPIC (le cœur de la fluidité)
     ========================================================= */
  /* Avis discret d'échec — styles inline : aucune dépendance CSS,
     retiré tout seul. On ne recharge JAMAIS la page (voir en-tête). */
  function avisEchec(msg) {
    var app = shell().app;
    if (!app) { return; }
    var d = document.createElement('div');
    d.setAttribute('role', 'status');
    d.style.cssText = 'position:absolute;left:50%;bottom:76px;transform:translateX(-50%);'
      + 'padding:10px 22px;border-radius:6px;background:rgba(20,16,12,.88);color:#f3ead9;'
      + 'font-size:13px;letter-spacing:.06em;z-index:60;pointer-events:none;';
    d.textContent = msg;
    app.appendChild(d);
    setTimeout(function () { d.remove(); }, 4200);
  }

  /* [MAJ v1-2] pages suivantes d'un topic annexe, déduites de SON
     document (pas du nôtre). Même ID de sujet, page > 1, sans query
     (?sid=… créerait des doublons), plafonné à 12. */
  function pagesDuTopic(doc, url) {
    var id = sujetId(normPath(url.replace(/^https?:\/\/[^\/]+/, '')));
    var vus = {}, urls = [];
    (SOS.detecterPages ? SOS.detecterPages(doc) : []).forEach(function (u) {
      try {
        var p = new URL(u, location.href);
        if (p.origin !== location.origin) { return; }
        var m = p.pathname.match(/^\/t(\d+)(?:p(\d+))?/);
        if (!m || m[1] !== id || !(m[2] && +m[2] > 1)) { return; }
        var propre = p.origin + p.pathname;           // query écartée
        if (vus[propre]) { return; }
        vus[propre] = 1; urls.push(propre);
      } catch (e) { /* lien ignoré */ }
    });
    return urls.slice(0, 12);
  }

  function chargerTopic(url, opts) {
    opts = opts || {};
    var s = shell();
    if (!s.app || !s.reconstruire || !url) { return; }
    var abs = absolu(url);

    // Voile seulement si la latence est réelle (>180 ms) : pas de flash.
    var minuteur = setTimeout(function () { montrerCharge(true); }, 180);

    fetch(abs, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var textes = SOS.lireSources(doc).map(function (src) { return src.texte; });

        /* [MAJ v1-2] le topic déborde ? on charge ses pages suivantes
           avant de reconstruire : une annexe longue n'est plus tronquée. */
        var suite = pagesDuTopic(doc, abs).map(function (u) {
          return fetch(u, { credentials: 'same-origin' })
            .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.text(); })
            .then(function (h2) {
              var d2 = new DOMParser().parseFromString(h2, 'text/html');
              SOS.lireSources(d2).forEach(function (src) { textes.push(src.texte); });
            })
            .catch(function (e) { console.warn('SOS: page suivante non chargée', u, e); });
        });
        return Promise.all(suite).then(function () { return textes; });
      })
      .then(function (textes) {
        var records = SOS.parserSources(textes);
        if (!s.filtrerVolets(records).length) { throw new Error('aucune donnée tdl-data'); }

        SOS.annexes = records;         // l'état reflète désormais le topic affiché
        s.reconstruire(records);

        if (opts.push !== false) {
          try { history.pushState({ sos: true, url: abs }, '', abs); } catch (e) {}
        }
        clearTimeout(minuteur);
        montrerCharge(false);
      })
      .catch(function (e) {
        clearTimeout(minuteur);
        montrerCharge(false);
        console.warn('SOS: chargement du topic échoué', abs, e);
        /* [MAJ v1-2] échec doux : on garde l'annexe affichée, la musique
           continue, l'utilisatrice sait ce qui s'est passé. */
        avisEchec('Impossible de charger cette annexe — la page courante est conservée.');
      });
  }

  /* =========================================================
     API + HISTORIQUE
     ========================================================= */
  SOS.nav = {
    sommaire: monterSommaire,
    charger: chargerTopic
  };

  // retour / avance : rejoue le chargement in-page sans re-pusher l'URL
  global.addEventListener('popstate', function (ev) {
    if (!shell().app) { return; }
    if (ev.state && ev.state.sos) { chargerTopic(location.href, { push: false }); }
  });

  // Ouvre le sommaire au boot s'il est demandé — soit par #sommaire dans l'URL,
  // soit par le drapeau posé au clic du bouton (robuste même si FA mange le #).
  function ouvrirSommaireSiDemande() {
    if (!shell().app) { return; }
    var demande = (location.hash === '#sommaire');
    try { if (sessionStorage.getItem('sos_sommaire') === '1') { demande = true; } } catch (e) {}
    if (demande) {
      try { sessionStorage.removeItem('sos_sommaire'); } catch (e) {}
      monterSommaire();
    }
  }

  // Au boot : marque l'entrée d'historique comme pilotée par SOS, puis ouvre le
  // sommaire si demandé. Différé (setTimeout 0) pour s'exécuter APRÈS le montage
  // de la coquille, quel que soit l'ordre de chargement des scripts.
  global.addEventListener('sos:pret', function () {
    setTimeout(function () {
      if (!shell().app) {
        // page sans SOS : on ne laisse pas traîner un drapeau non consommé
        try { sessionStorage.removeItem('sos_sommaire'); } catch (e) {}
        return;
      }
      try { history.replaceState({ sos: true, url: location.href }, '', location.href); } catch (e) {}
      ouvrirSommaireSiDemande();
    }, 0);
  });

  // Bouton « Guidebook » posé n'importe où dans le forum (id="tdl-guidebook") :
  //  - sur une page SOS  -> ouvre le sommaire in-page (pas de rechargement) ;
  //  - ailleurs (SOS absent) -> pose un drapeau, laisse le lien suivre son href,
  //    et la page-annexe cible ouvre le sommaire à son boot.
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('#tdl-guidebook') : null;
    if (!b) { return; }
    if (shell().app) { ev.preventDefault(); monterSommaire(); }
    else { try { sessionStorage.setItem('sos_sommaire', '1'); } catch (e) {} }
  });

})(window);
