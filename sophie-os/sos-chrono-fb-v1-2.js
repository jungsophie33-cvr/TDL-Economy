/* =============================================================
   SOS — CHRONOLOGIE · BRANCHEMENT FIREBASE (sos-chrono-fb.js)
   -------------------------------------------------------------
   Greffe sur le bloc « chrono » trois choses que le post ne peut
   pas porter :

     1. LES ÉVÉNEMENTS DU JOURNAL — nœud « chrono_journal », écrit
        par le bureau de rédaction du Houma Courier au moment où la
        parution est confirmée. Rien à recopier à la main.
     2. LES AJOUTS DU STAFF — nœud « chrono », versés depuis cette
        page : événements de bandes hors-la-loi, demandes de joueurs
        dont la famille figure dans le lore. N'importe quelle période.
     3. LES ORPHELINS — un ajout rattaché à un membre dont l'uid a
        disparu de « uid_index » ressort en rouge, pour le staff seul,
        qui décide de le garder ou de le retirer.

   [MAJ v1-2] LECTURES CIBLÉES, FIN DE LA LECTURE DE RACINE.
     charger() appelait invalidateCache() + safeReadBin() : 126 ko
     tirés de la base sur CHAQUE page de chronologie, y compris pour
     les invités, et une invalidation qui vidait au passage le cache
     racine partagé par tous les autres modules. Désormais :
       • le public ne lit que « chrono » et « chrono_journal » ;
       • le staff lit en plus « uid_index » (annuaire des orphelins),
         avec « membres » en repli — l'annuaire ne sert à rien aux
         joueurs, qui ne voient jamais les orphelins ;
       • « chrono_config » n'est lu qu'au moment de publier la
         structure (déjà réservée au staff) ;
       • sans cache racine, chaque rafraîchissement est frais par
         nature : plus besoin d'invalider quoi que ce soit.
     Les écritures ne changent pas : firebasePush pour l'ajout,
     firebaseUpdate par chemin pour le retrait. Ce script n'utilise
     jamais writeBin : le socle de comparaison d'EcoCore n'entre
     pas en jeu, la migration est sans effet de bord.
     Un annuaire non chargé ne juge personne : orphelin() rend
     toujours faux pour le public — l'absence de donnée n'est pas
     un départ.
     [MAJ v1-2] remonter() : SOS.chronoFB.remonter() greffe les
     instances chrono montées APRÈS le passage de demarrer() — le
     cas d'une navigation in-page, où la coquille reconstruit une
     annexe sans recharger la page. Ajouter dans sos-nav.js, juste
     après s.reconstruire(records) :
       if (SOS.chronoFB && SOS.chronoFB.remonter) SOS.chronoFB.remonter();

   SANS ECOCORE, ce fichier ne fait rien et la chronologie continue
   de fonctionner sur le seul contenu du post.

   Contrat des entrées « chrono_journal » (écrites par
   tdlhc-bureau-actions, ligneChrono) : periode, cat, iso, d, titre,
   texte, ancre — plus chrono, soum, publie, ignorées ici.

   Dépend de : sos-bloc-chrono.js, window.EcoCore (v2 : firebaseGet,
   firebasePush, firebaseUpdate).
   À charger APRÈS sos-bloc-chrono.js.
   ============================================================= */
(function (global) {
  'use strict';

  /* ===================== CONFIG ===================== */
  var CFG = {
    NODE_AJOUTS:  'chrono',            /* [MAJ] ajouts du staff */
    NODE_CONFIG:  'chrono_config',     /* périodes et catégories, publiées ici pour le formulaire de demande */
    NODE_JOURNAL: 'chrono_journal',    /* [MAJ] écrit par le bureau du Courier */
    NODE_UID:     'uid_index',         /* uid → pseudo ; un uid absent = membre parti */
    NODE_MEMBRES: 'membres',           /* repli de l'annuaire si uid_index est vide */
    SUJET_COURIER: '/t102-the-houma-courier',   /* [MAJ] sujet du journal */
    RETRY_MS: 250, RETRY_MAX: 60
  };

  var TXT = {
    STAFF_AJOUT: '+ Ajouter', ORPHELINS: function (n) { return 'Orphelins · ' + n; },
    PARTI: 'Membre parti', RETIRER: 'Retirer', LIRE: 'Lire l\u2019article du Courier',
    EN_JEU: 'En jeu',
    PAR: function (p, parti) { return 'Inscrit à la demande de ' + p + (parti ? ', qui a quitté le forum.' : '.'); },
    F_TITRE: 'Ajouter un événement',
    F_AIDE: 'Versé dans la base, pas dans le post : la chronologie le reprend sans édition. '
          + 'Il se place à son millésime dans la période choisie, et reste retirable à tout moment.',
    F_PER: 'Période', F_CAT: 'Catégorie', F_ISO: 'Date de tri',
    F_D: 'Date affichée', F_D_AIDE: 'ex. v. 1840', F_UID: 'À la demande de', F_UID_AIDE: 'optionnel',
    F_PERSONNE: 'Personne en particulier', F_T: 'Titre', F_X: 'Texte',
    F_A: 'Aparté', F_A_AIDE: 'optionnel, en italique sous le texte', F_IMG: 'Image', F_IMG_AIDE: 'optionnel',
    F_OK: 'Ajouter', F_ANNULE: 'Annuler',
    ERR_CHAMPS: 'Titre, texte et date de tri sont obligatoires.',
    ERR_ECRIT: 'L\u2019enregistrement a échoué. Rien n\u2019a été modifié.',
    CONF_SUP: function (t) { return 'Retirer « ' + t + ' » de la chronologie ?'; }
  };

  /* ===================== UTILS ===================== */
  var C = null, esc = null, MEMBRES = {}, ANNUAIRE = false;
  function E() { return global.EcoCore; }
  function staff() {
    try { return typeof _userdata !== 'undefined' && (_userdata.user_level === 1 || _userdata.user_level === 2); }
    catch (e) { return false; }
  }
  /* L'annuaire n'est chargé que pour le staff. Pour tout le monde
     il est vide et NON chargé : vivant() rend vrai pour chacun —
     jamais de « membre parti » inventé sur une donnée absente. */
  function vivant(uid) {
    return uid == null || uid === '' || !ANNUAIRE
        || MEMBRES.hasOwnProperty(String(uid));
  }
  /* uid_index peut contenir des lignes sans pseudo : elles ne sont pas des membres,
     et une entrée vide polluerait la liste du formulaire. */
  function nomme(n) {
    var out = {};
    Object.keys(n || {}).forEach(function (u) {
      var v = n[u];
      if (typeof v === 'string' && v.trim()) { out[u] = v.trim(); }
    });
    return out;
  }
  function orphelin(e) { return !!(e.source === 'ajout' && e.uid && !vivant(e.uid)); }
  function h(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (html != null) { n.innerHTML = html; }
    return n;
  }

  /* ===================== LECTURE (ciblée) ===================== */
  /* Une entrée du journal et un ajout du staff prennent la même forme que les
     événements du post : le rendu ne fait aucune différence entre les trois. */
  function depuisJournal(id, j) {
    return { id: id, source: 'journal', p: j.periode || 'jeu', c: j.cat || '', d: j.d || '',
             iso: j.iso || null, t: j.titre || '', resume: j.texte || '', corps: [j.texte || ''],
             a: '', img: '', legende: '', marque: TXT.EN_JEU,
             lienLib: TXT.LIRE, lienUrl: j.ancre ? CFG.SUJET_COURIER + '#hc=art-' + j.ancre : '' };
  }
  function depuisAjout(id, a) {
    return { id: id, source: 'ajout', p: a.p || '', c: a.c || '', d: a.d || '', iso: a.iso || null,
             t: a.t || '', resume: a.x || '', corps: String(a.x || '').split('\n').filter(Boolean),
             a: a.a || '', img: a.img || '', legende: a.legende || '',
             marque: '', lienLib: '', lienUrl: '',
             uid: a.uid || null, pseudo: a.pseudo || '' };
  }

  /* Lecture ciblée d'un nœud : une branche, un aller-retour, une
     panne de branche n'emporte pas les autres. Les appels
     simultanés au même chemin sont mutualisés par EcoCore. */
  function lire(noeud) {
    return E().firebaseGet(noeud).then(null, function (e) {
      if (global.console) { console.warn('[Chrono] lecture « ' + noeud + ' » refusée', e); }
      return null;
    });
  }

  async function charger() {
    var jobs = [lire(CFG.NODE_AJOUTS), lire(CFG.NODE_JOURNAL)];
    if (staff()) { jobs.push(lire(CFG.NODE_UID)); }
    var vals = await Promise.all(jobs);
    var na = vals[0] || {}, nj = vals[1] || {};

    /* Annuaire : staff seulement (orphelins, formulaire « à la demande de »). */
    if (staff()) {
      var noms = nomme(vals[2] || {});
      if (Object.keys(noms).length) {
        MEMBRES = noms;
      } else {
        /* repli : l'annuaire des pseudos, inversé depuis « membres » */
        var m = await lire(CFG.NODE_MEMBRES), inv = {};
        Object.keys(m || {}).forEach(function (p) {
          if (m[p] && m[p].uid != null && String(p).trim()) { inv[m[p].uid] = String(p).trim(); }
        });
        MEMBRES = inv;
      }
      ANNUAIRE = true;
    } else {
      MEMBRES = {}; ANNUAIRE = false;
    }

    var out = [];
    Object.keys(nj).forEach(function (id) { if (nj[id] && nj[id].titre) { out.push(depuisJournal(id, nj[id])); } });
    Object.keys(na).forEach(function (id) { if (na[id] && na[id].t) { out.push(depuisAjout(id, na[id])); } });
    return out;
  }

  /* ===================== PUBLICATION DE LA STRUCTURE =====================
     Le formulaire de demande vit dans un autre sujet et ne lit pas le post de
     l'annexe. Plutôt que d'y recopier les périodes et les catégories, la
     chronologie les publie : une seule source, aucune dérive possible.
     Écrit par le staff seulement, et seulement si quelque chose a changé.
     La comparaison lit « chrono_config » SEUL : la branche fait quelques
     octets, la racine n'a plus rien à faire ici. */
  async function publierConfig(api) {
    if (!staff()) { return; }
    var d = api.d;
    var conf = {
      periodes: d.periodes.map(function (p) { return { id: p.id, t: p.t, d: p.d }; }),
      cats: d.ordreCats.map(function (k) { return { id: k, l: d.cats[k].l, c: d.cats[k].c }; })
    };
    var avant = await lire(CFG.NODE_CONFIG);
    if (avant && JSON.stringify(avant.periodes) === JSON.stringify(conf.periodes)
             && JSON.stringify(avant.cats) === JSON.stringify(conf.cats)) { return; }
    conf.maj = new Date().toISOString();
    var m = {}; m[CFG.NODE_CONFIG] = conf;
    try { await E().firebaseUpdate(m); }
    catch (e) { if (global.console) { console.warn('[Chrono] publication de la structure', e); } }
  }

  /* ===================== CROCHETS DE RENDU ===================== */
  function poserCrochets(api) {
    var etat = api.etat;
    etat.staff = staff(); etat.orph = false;

    api.gardeSup = function (e) { return !etat.orph || orphelin(e); };
    api.classesSup = function (e) {
      return (e.source === 'ajout' ? ' manuel' : '') + (e.source === 'journal' ? ' jeu' : '')
           + (orphelin(e) ? ' orphelin' : '');
    };
    api.marquesSup = function (e) {
      return orphelin(e) ? '<span class="tdlch-parti">' + esc(TXT.PARTI) + '</span>' : '';
    };
    api.boutonsSup = function (e) {
      return e.source ? '<button class="tdlch-sup" type="button" data-sup="' + esc(e.source + ':' + e.id)
        + '">' + esc(TXT.RETIRER) + '</button>' : '';
    };
    api.piedSup = function (e) {
      return (e.source === 'ajout' && e.pseudo)
        ? '<p class="tdlch-ev-par">' + esc(TXT.PAR(e.pseudo, orphelin(e))) + '</p>' : '';
    };
    api.apresRendu = function () { majStaff(api); };
    api.clicSup = function (t) {
      var x;
      if ((x = t.closest('[data-sup]'))) { supprimer(api, x.getAttribute('data-sup')); return true; }
      if ((x = t.closest('[data-chrono-ajout]'))) { ouvrirForm(api); return true; }
      if ((x = t.closest('[data-chrono-orph]'))) {
        etat.orph = !etat.orph;
        if (etat.orph && api.d.toutes) { etat.periode = '*'; }   /* un orphelin peut être n'importe où */
        C.peindre(api, { anime: true }); return true;
      }
      return false;
    };
  }

  /* ===================== BOUTONS DU STAFF ===================== */
  function majStaff(api) {
    var r = api.racine, etat = api.etat;
    r.classList.toggle('staff', !!etat.staff);
    var slot = r.querySelector('.tdlch-staff-slot');
    if (!slot) { return; }
    if (!etat.staff) { slot.innerHTML = ''; return; }
    if (!slot.firstChild) {
      slot.innerHTML = '<button class="tdlch-bstaff" type="button" data-chrono-ajout>' + esc(TXT.STAFF_AJOUT)
        + '</button><button class="tdlch-bstaff alerte" type="button" data-chrono-orph hidden></button>';
    }
    var n = api.ajouts.filter(orphelin).length, b = slot.querySelector('[data-chrono-orph]');
    b.hidden = !n && !etat.orph;
    b.textContent = TXT.ORPHELINS(n);
    b.classList.toggle('on', !!etat.orph);
  }

  /* ===================== FORMULAIRE ===================== */
  function champ(label, inner, aide, large) {
    return '<div class="tdlch-champ' + (large ? ' large' : '') + '"><label>' + esc(label)
      + (aide ? ' <span>— ' + esc(aide) + '</span>' : '') + '</label>' + inner + '</div>';
  }
  function ouvrirForm(api) {
    var f = api.racine.querySelector('.tdlch-form');
    if (!f.hidden) { f.hidden = true; f.innerHTML = ''; return; }
    var d = api.d;
    f.innerHTML = '<h4>' + esc(TXT.F_TITRE) + '</h4><p class="tdlch-aide">' + esc(TXT.F_AIDE) + '</p>'
      + '<div class="tdlch-grille">'
      + champ(TXT.F_PER, '<select data-f="p">' + d.periodes.map(function (x) {
          return '<option value="' + esc(x.id) + '"' + (x.id === api.etat.periode ? ' selected' : '')
            + '>' + esc(x.t) + ' — ' + esc(x.d) + '</option>'; }).join('') + '</select>')
      + champ(TXT.F_CAT, '<select data-f="c">' + d.ordreCats.map(function (k) {
          return '<option value="' + esc(k) + '">' + esc(d.cats[k].l) + '</option>'; }).join('') + '</select>')
      + champ(TXT.F_ISO, '<input type="date" data-f="iso" value="' + new Date().toISOString().slice(0, 10) + '">')
      + champ(TXT.F_D, '<input type="text" data-f="d">', TXT.F_D_AIDE)
      + champ(TXT.F_UID, '<select data-f="uid"><option value="">' + esc(TXT.F_PERSONNE) + '</option>'
          + Object.keys(MEMBRES).sort(function (a, b) {
              return String(MEMBRES[a]).localeCompare(String(MEMBRES[b]), 'fr'); })
            .map(function (u) { return '<option value="' + esc(u) + '">' + esc(MEMBRES[u]) + '</option>'; }).join('')
          + '</select>', TXT.F_UID_AIDE)
      + champ(TXT.F_T, '<input type="text" data-f="t">', '', true)
      + champ(TXT.F_X, '<textarea data-f="x"></textarea>', '', true)
      + champ(TXT.F_A, '<input type="text" data-f="a">', TXT.F_A_AIDE, true)
      + champ(TXT.F_IMG, '<input type="text" data-f="img" placeholder="https://…">', TXT.F_IMG_AIDE, true)
      + '</div><div class="tdlch-form-pied"><button class="tdlch-btn" type="submit">' + esc(TXT.F_OK) + '</button>'
      + '<button class="tdlch-btn creux" type="button" data-annule>' + esc(TXT.F_ANNULE) + '</button>'
      + '<span class="tdlch-erreur" data-err></span></div>';
    f.hidden = false;
  }

  /* ===================== ÉCRITURES =====================
     Inchangées : l'ajout pousse dans sa branche, le retrait annule
     le chemin précis. Rien ne touche la racine. */
  async function envoyer(api, f) {
    var v = {}, err = f.querySelector('[data-err]');
    Array.prototype.forEach.call(f.querySelectorAll('[data-f]'), function (x) { v[x.getAttribute('data-f')] = x.value.trim(); });
    if (!v.t || !v.x || !v.iso) { err.textContent = TXT.ERR_CHAMPS; return; }
    var obj = { p: v.p, c: v.c, iso: v.iso, d: v.d || v.iso.slice(0, 4), t: v.t, x: v.x,
                a: v.a || null, img: v.img || null,
                uid: v.uid || null, pseudo: v.uid ? (MEMBRES[v.uid] || null) : null,
                par: (function () { try { return E().getPseudo(); } catch (e) { return null; } })(),
                cree: new Date().toISOString() };
    Object.keys(obj).forEach(function (k) { if (obj[k] === undefined) { delete obj[k]; } });
    try { await E().firebasePush(CFG.NODE_AJOUTS, obj); }
    catch (e) { if (global.console) { console.error('[Chrono] ajout', e); } err.textContent = TXT.ERR_ECRIT; return; }
    f.hidden = true; f.innerHTML = '';
    api.etat.periode = v.p;
    await rafraichir(api, { anime: true });
  }
  async function supprimer(api, ref) {
    var sep = ref.indexOf(':'), source = ref.slice(0, sep), id = ref.slice(sep + 1);
    var e = api.ajouts.filter(function (x) { return x.id === id && x.source === source; })[0];
    if (!e || !global.confirm(TXT.CONF_SUP(e.t))) { return; }
    var maj = {};
    maj[(source === 'ajout' ? CFG.NODE_AJOUTS : CFG.NODE_JOURNAL) + '/' + id] = null;
    try { await E().firebaseUpdate(maj); }
    catch (err) { if (global.console) { console.error('[Chrono] retrait', err); } global.alert(TXT.ERR_ECRIT); return; }
    await rafraichir(api);
  }
  async function rafraichir(api, opts) {
    api.ajouts = await charger();
    C.peindre(api, opts);
  }

  /* ===================== MONTAGE ===================== */
  function monter(api) {
    if (api._fb) { return; }
    api._fb = true;
    poserCrochets(api);

    var f = h('form', 'tdlch-form');
    f.hidden = true;
    api.racine.querySelector('.tdlch-haut').appendChild(f);
    f.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-annule]')) { f.hidden = true; f.innerHTML = ''; }
    });
    f.addEventListener('submit', function (ev) { ev.preventDefault(); envoyer(api, f); });

    rafraichir(api).then(function () { publierConfig(api); });
  }

  function pret() {
    return !!(global.SOS && SOS.chrono && SOS.chrono.instances
           && SOS.chrono.instances.length);
  }
  function ecoPret() {
    return !!(E() && typeof E().firebaseGet === 'function'
           && typeof E().firebaseUpdate === 'function'
           && typeof E().firebasePush === 'function');
  }

  /* Greffe toutes les instances PAS ENCORE montées. Appelée au boot
     (demarrer) et à la demande (remonter) : idempotente grâce au
     garde api._fb. */
  function greffer() {
    C = SOS.chrono; esc = C.esc;
    SOS.chrono.instances.forEach(monter);
  }

  function demarrer(n) {
    n = n || 0;
    if (pret() && ecoPret()) { greffer(); return; }
    if (n > CFG.RETRY_MAX) {
      if (global.console && pret()) {
        console.warn('[Chrono] EcoCore introuvable : la chronologie reste limitée au contenu du post.');
      }
      return;
    }
    setTimeout(function () { demarrer(n + 1); }, CFG.RETRY_MS);
  }
  demarrer();

  /* API : remonter les instances nées après le boot — le cas d'une
     navigation in-page, où sos-nav reconstruit l'annexe sans recharger.
     Brancher dans sos-nav.js juste après s.reconstruire(records) :
       if (SOS.chronoFB && SOS.chronoFB.remonter) SOS.chronoFB.remonter(); */
  SOS.chronoFB = {
    remonter: function () {
      if (pret() && ecoPret()) { greffer(); }
    }
  };

})(window);
