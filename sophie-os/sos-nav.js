/* =============================================================
   SOS — Sophia OS · NAVIGATION INTER-ANNEXE (sos-nav.js)
   -------------------------------------------------------------
   La couche qui masque ForumActif : elle fait passer d'un topic
   d'annexe à un autre SANS recharger le document, pour que rien
   d'intégré à la coquille (à venir : le lecteur audio) ne soit
   interrompu. Trois responsabilités :

     1. SOMMAIRE — une vue de cartes lues dans SOS.manifeste, montée
        dans le deck via SOS.shell.monterSection.
     2. CHARGEMENT IN-PAGE — fetch same-origin du topic cible, extrait
        ses données tdl-data, demande à la coquille de se reconstruire
        (SOS.shell.reconstruire), puis met à jour l'URL (pushState).
        Retour/avance (popstate) rejouent le chargement.
     3. VOILE DE CHARGEMENT — feedback discret, affiché seulement si la
        latence dépasse 180 ms (pas de flash sur connexion rapide).

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

  /* URL de repli si un chargement in-page échoue (fetch KO ou aucune
     donnée tdl-data dans le topic cible). */
  var GUIDE = 'https://thedrownedlands.forumactif.com/f1-guidebook';

  function shell() { return SOS.shell || {}; }
  function normPath(p) { return String(p || '').replace(/\/+$/, ''); }
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
    chargeEl.innerHTML = '<div class="sos-orbite"><div class="sos-bille"></div></div>';
    app.appendChild(chargeEl);
    return chargeEl;
  }
  function montrerCharge(on) {
    var v = veil();
    if (v) { v.classList.toggle('actif', !!on); }
  }

  /* =========================================================
     SOMMAIRE (cartes lues dans SOS.manifeste)
     ========================================================= */
  function rendreSommaire() {
    var sec = h('section', 'sos-panneau p-somm');
    sec.setAttribute('data-theme', 'sombre');

    var wrap = h('div', 'somm-wrap');
    var head = h('div', 'somm-head');
    head.appendChild(h('h1', 'somm-titre', 'Les Annexes'));
    head.appendChild(h('p', 'somm-intro', 'Choisissez un grand sujet à parcourir.'));
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
        var cible = normPath(e.url.replace(/^https?:\/\/[^\/]+/, ''));
        if (ici && cible && ici.indexOf(cible) === 0) { carte.classList.add('courant'); }
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
    s.app.style.setProperty('--commu', 'var(--clair2)');   // teinte globale, hors annexe
    s.monterSection(rendreSommaire(), { ongletSomm: true, theme: 'sombre' });
  }

  /* =========================================================
     CHARGEMENT IN-PAGE D'UN TOPIC (le cœur de la fluidité)
     ========================================================= */
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
        location.href = GUIDE;         // repli : guidebook
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

  // marque l'entrée d'historique du boot comme pilotée par SOS, pour que
  // le premier « retour » sache qu'il doit rejouer un chargement.
  global.addEventListener('sos:pret', function () {
    if (shell().app) {
      try { history.replaceState({ sos: true, url: location.href }, '', location.href); } catch (e) {}
    }
  });

})(window);
