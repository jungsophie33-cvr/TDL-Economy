/* ============================================================================
   TDL — PRÉ-LIENS : FICHES D'UNE BRANCHE
   Fichier : sos-pl-fiches.js
   ----------------------------------------------------------------------------
   Lit le format texte « === PRELIENS: » posé dans un message et le transforme
   en parcours à trois niveaux : frise des générations, onglets de personnages,
   rubriques de la fiche.

   Ciblage : un lien « ?fiche=slug » venant de l'arbre ouvre directement la
   bonne fiche. Si elle est déjà dans la page, aucun rechargement.

   Dépendances : eco-core-v1-5.js, puis tdlpl-core.js. Dans cet ordre.
   ========================================================================== */

(function () {
  "use strict";

  var T = window.TDLPL;
  if (!T) {
    if (window.console) console.error('[TDLPL fiches] tdlpl-core.js doit être chargé avant ce script.');
    return;
  }

  var CFG = T.CFG;
  var alerte = T.journal('fiches');
  var slug = T.slug, echappe = T.echappe, texteDates = T.texteDates;

  var LIB_GEN = [
    'Les fondateurs', 'Leurs enfants', 'Leurs petits-enfants', 'Leurs arrière-petits-enfants'
  ];
  var NOM_RUB = { histoire: 'Histoire', liens: 'Liens', informations: 'Informations' };
  var ORDRE_RUB = ['histoire', 'liens', 'informations'];

  /* --------------------------------------------------------------- ANALYSEUR */

  var CLES = {
    GEN: 'gen', FC: 'fc', NAISSANCE: 'naissance', METIER: 'metier',
    CARACTERE: 'caractere', IMAGE: 'image', BANNIERE: 'banniere',
    STATUT: 'statut', SEXE: 'sexe'
  };

  function analyse(txt) {
    var modele = { famille: '', branche: '', arbre: '', fiches: [] };
    var dedans = false, f = null, rub = null;

    txt.split('\n').forEach(function (ligne) {
      var l = ligne.replace(/\s+$/, ''), t = l.trim(), m;

      if ((m = t.match(/^===\s*PRELIENS\s*:\s*(.+)$/i))) {
        dedans = true; modele.famille = m[1].trim(); return;
      }
      if (!dedans) return;
      if (/^===\s*FIN/i.test(t)) { dedans = false; return; }

      if ((m = t.match(/^---\s*FICHE\s*:?\s*(.*?)\s*---\s*$/i))) {
        f = {
          nom: m[1].trim(), slug: slug(m[1]), gen: null, fc: '', naissance: null,
          metier: '', caractere: [], image: '', banniere: '', statut: '', sexe: '',
          statutForce: false, uid: null, rub: {}
        };
        modele.fiches.push(f); rub = null; return;
      }

      if (!f) {
        if ((m = t.match(/^BRANCHE\s*:\s*(.+)$/i))) { modele.branche = m[1].trim(); return; }
        if ((m = t.match(/^ARBRE\s*:\s*(.+)$/i))) { modele.arbre = m[1].trim(); return; }
        return;
      }

      // Ouverture d'une rubrique : mot-clé connu, deux points, rien derrière.
      if ((m = t.match(/^(HISTOIRE|LIENS|INFORMATIONS)\s*:\s*$/i))) {
        rub = m[1].toLowerCase();
        f.rub[rub] = (rub === 'liens') ? [] : '';
        return;
      }

      // Clés de métadonnées (hors rubrique uniquement).
      if (rub === null && (m = t.match(/^([A-ZÉÈ]+)\s*:\s*(.+)$/))) {
        var cle = CLES[m[1].toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
        var val = m[2].trim();
        if (cle === 'gen') { f.gen = parseInt(val, 10); return; }
        if (cle === 'naissance') { f.naissance = T.calculeAge(val); return; }
        if (cle === 'sexe') { f.sexe = val.charAt(0).toUpperCase(); return; }
        if (cle === 'caractere') {
          f.caractere = val.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
          return;
        }
        if (cle === 'statut') {
          var s = T.litStatut(val);
          if (s) { f.statut = s; f.statutForce = true; }
          else alerte('statut inconnu « ' + val + ' » sur ' + f.nom);
          return;
        }
        if (cle) { f[cle] = val; return; }
      }

      if (rub === null) {
        if (t) alerte('ligne hors rubrique ignorée sur ' + f.nom + ' : « ' + t + ' »');
        return;
      }

      // Contenu d'une rubrique.
      if (rub === 'liens') {
        if (/^[-–•]\s+/.test(t)) {
          var bouts = t.replace(/^[-–•]\s+/, '').split('|');
          f.rub.liens.push({ titre: (bouts[0] || '').trim(), texte: (bouts[1] || '').trim() });
        } else if (t && f.rub.liens.length) {
          f.rub.liens[f.rub.liens.length - 1].texte += ' ' + t;   // ligne de continuation
        }
        return;
      }
      f.rub[rub] += (f.rub[rub] ? '\n' : '') + l;
    });

    modele.fiches.forEach(function (x) {
      if (x.gen === null || isNaN(x.gen)) { alerte('fiche sans GEN : ' + x.nom + ' (placée en 0)'); x.gen = 0; }
      if (!Object.keys(x.rub).length) alerte('aucune rubrique trouvée sur ' + x.nom);
      if (!x.statut) x.statut = CFG.statutDefaut;
    });

    return modele.famille && modele.fiches.length ? modele : null;
  }

  function enParagraphes(txt) {
    return String(txt || '').split(/\n{2,}/)
      .map(function (b) { return b.trim(); }).filter(Boolean)
      .map(function (b) { return '<p>' + echappe(b).replace(/\n/g, '<br>') + '</p>'; })
      .join('');
  }

    function enrichit(modele, idx) {
    modele.fiches.forEach(function (f) {
      var e = T.trouve(idx, f.fc, f.nom);
      if (!e) {
        if (!f.statutForce) alerte('introuvable dans le bottin : ' + f.nom + ' (préciser FC:)');
        return;
      }
      if (e.image) f.image = e.image;
      if (!f.fc && e.acteur) f.fc = e.acteur;

      if (String(e.statut || '').toLowerCase() === 'pris') {
        f.uid = e.uid || null;
        if (f.statut !== 'dcd') f.statut = 'pris';
      } else if (!f.statutForce) f.statut = 'libre';
    });
  }

  /* ------------------------------------------------------------- COMPOSANT */

  function Composant(el, modele) {
    this.el = el;
    this.modele = modele;
    this.gens = [];
    modele.fiches.forEach(function (f) { if (this.gens.indexOf(f.gen) < 0) this.gens.push(f.gen); }, this);
    this.gens.sort(function (a, b) { return a - b; });
    this.gen = this.gens[0];
    this.courant = this.parGen(this.gen)[0].slug;
    this.rub = 'histoire';
    this.squelette();
  }

  Composant.prototype.parGen = function (g) {
    return this.modele.fiches.filter(function (f) { return f.gen === g; });
  };
  Composant.prototype.fiche = function (s) {
    var r = null;
    this.modele.fiches.forEach(function (f) { if (f.slug === s) r = f; });
    return r;
  };

  Composant.prototype.squelette = function () {
    var m = this.modele, h = '<div class="tdlplf annexe">';

    h += '<div class="tdlplf-hero"><div class="tdlplf-hero-in">';
    h += '<h1 class="tdlplf-fam">' + echappe(m.famille) + '</h1>';
    if (m.branche) h += '<p class="tdlplf-sous">' + echappe(m.branche) + '</p>';
    if (m.arbre) {
      h += '<a class="tdlplf-retour" href="' + echappe(m.arbre) + '">' +
        '<i class="fi fi-tr-arrow-small-left"></i>retour à l\'arbre</a>';
    }
    h += '</div><div class="tdlplf-frise"></div></div>';
    h += '<div class="tdlplf-onglets"></div>';
    h += '<div class="tdlplf-fiche">' +
      '<aside class="tdlplf-aside">' +
      '<div class="tdlplf-portrait"></div>' +
      '<nav class="tdlplf-rubs" hidden></nav>' +
      '<div class="tdlplf-meta"><dl></dl></div>' +
      '</aside>' +
      '<main class="tdlplf-col2">' +
      '<div class="tdlplf-bandeau"></div>' +
      '<div class="tdlplf-corps"></div>' +
      '</main></div></div>';

    this.el.innerHTML = h;
    this.$frise = this.el.querySelector('.tdlplf-frise');
    this.$onglets = this.el.querySelector('.tdlplf-onglets');
    this.$aside = this.el.querySelector('.tdlplf-aside');
    this.$portrait = this.el.querySelector('.tdlplf-portrait');
    this.$rubs = this.el.querySelector('.tdlplf-rubs');
    this.$meta = this.el.querySelector('.tdlplf-meta dl');
    this.$bandeau = this.el.querySelector('.tdlplf-bandeau');
    this.$corps = this.el.querySelector('.tdlplf-corps');

    this.rendFrise();
    this.rendOnglets(true);
    this.rendFiche(true);
  };

  Composant.prototype.rendFrise = function () {
    var self = this;
    if (!this.$frise.childElementCount) {
      this.gens.forEach(function (g) {
        var b = document.createElement('button');
        b.className = 'tdlplf-jalon';
        b.dataset.gen = g;
        b.innerHTML = '<span class="tdlplf-bulle"></span><span class="tdlplf-lib">' +
          echappe(LIB_GEN[g] || 'Génération ' + g) + '</span>';
        b.onclick = function () {
          if (g === self.gen) return;
          self.gen = g;
          self.courant = self.parGen(g)[0].slug;
          self.rub = 'histoire';
          self.rendFrise(); self.rendOnglets(true); self.rendFiche(true);
        };
        self.$frise.appendChild(b);
      });
    }
    Array.prototype.forEach.call(this.$frise.children, function (b) {
      var g = +b.dataset.gen;
      b.classList.toggle('tdlplf-on', g === self.gen);
      b.classList.toggle('tdlplf-fait', g < self.gen);
    });
    var n = this.gens.length;
    this.$frise.style.setProperty('--k', n > 1 ? (this.gens.indexOf(this.gen) / (n - 1)) : 0);
  };

  Composant.prototype.majOnglets = function () {
    var self = this;
    Array.prototype.forEach.call(this.$onglets.children, function (b) {
      b.classList.toggle('tdlplf-on', b.dataset.slug === self.courant);
    });
  };

  Composant.prototype.rendOnglets = function (animer) {
    var self = this;
    this.$onglets.innerHTML = '';
    this.parGen(this.gen).forEach(function (f, i) {
      var b = document.createElement('button');
      b.className = 'tdlplf-ong' + (animer ? ' tdlplf-entre' : '');
      b.dataset.slug = f.slug;
      if (animer) b.style.animationDelay = (i * 85) + 'ms';
      b.textContent = f.nom.split(/\s+/)[0];
      b.onclick = function () {
        if (f.slug === self.courant) return;
        self.courant = f.slug; self.rub = 'histoire';
        self.majOnglets(); self.rendFiche(true);
      };
      self.$onglets.appendChild(b);
    });
    // La bordure doit partir de scaleX(0) : on pose la classe au cycle suivant.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { self.majOnglets(); });
    });
  };

  Composant.prototype.rendFiche = function (changementPerso) {
    var self = this, f = this.fiche(this.courant);
    if (!f) return;

    // Portrait
    if (f.image) {
      this.$portrait.innerHTML = '<img src="' + echappe(f.image) + '" alt="">';
      this.$portrait.classList.remove('tdlplf-vide');
    } else {
      var mots = f.nom.split(/\s+/);
      this.$portrait.textContent = ((mots[0] || '?').charAt(0) +
        (mots.length > 1 ? mots[mots.length - 1].charAt(0) : '')).toUpperCase();
      this.$portrait.classList.add('tdlplf-vide');
    }

    // Métadonnées
    var dl = '';
    if (f.fc) dl += '<dt><f4>Faceclaim proposé</f4></dt><dd>' + echappe(f.fc) + '</dd>';
    if (f.naissance) dl += '<dt><f4>Naissance</f4></dt><dd>' + texteDates(f.naissance) + '</dd>';
    if (f.metier) dl += '<dt><f4>Métier</f4></dt><dd>' + echappe(f.metier) + '</dd>';
    if (f.caractere.length) {
      dl += '<dt><f4>Caractère</f4></dt><dd>' + f.caractere.map(function (t) {
        return '<span class="tdlplf-trait">' + echappe(t) + '</span>';
      }).join('') + '</dd>';
    }
    this.$meta.innerHTML = dl;

    // Bandeau
    this.$bandeau.style.setProperty('--tdlplf-img', f.banniere ? "url('" + f.banniere + "')" : '');
    var lienProfil = (f.statut === 'pris' && f.uid)
      ? '<a class="tdlplf-profil" href="/u' + f.uid + '" title="Profil du joueur">' +
        '<i class="fi fi-tr-user"></i></a>' : '';
    this.$bandeau.innerHTML =
      '<div class="tdlplf-band-txt"><h2 class="tdlplf-band-nom">' + echappe(f.nom) + '</h2></div>' +
      lienProfil +
      '<span class="tdlplf-tampon tdlplf-' + f.statut + '">' +
      T.libelle(f.statut, f.sexe) + '</span>';

    if (changementPerso) {
      [this.$bandeau, this.$aside].forEach(function (n) {
        n.classList.remove('tdlplf-entre');
        void n.offsetWidth;                       // force la relance de l'animation
        n.classList.add('tdlplf-entre');
      });
    }

    // Rubriques disponibles
    var dispo = ORDRE_RUB.filter(function (r) {
      var v = f.rub[r];
      return v && (typeof v === 'string' ? v.trim() : v.length);
    });
    if (dispo.indexOf(this.rub) < 0) this.rub = dispo[0];
    this.$rubs.hidden = dispo.length < 2;
    this.$rubs.innerHTML = '';
    dispo.forEach(function (r) {
      var b = document.createElement('button');
      b.className = 'tdlplf-rub' + (r === self.rub ? ' tdlplf-on' : '');
      b.innerHTML = '<span class="tdlplf-puce"></span>' + NOM_RUB[r];
      b.onclick = function () {
        if (r === self.rub) return;
        self.rub = r; self.rendFiche(false);
      };
      self.$rubs.appendChild(b);
    });

    // Panneau
    if (!dispo.length) { this.$corps.innerHTML = ''; return; }
    var num = ('0' + (dispo.indexOf(this.rub) + 1)).slice(-2);
    var h = '<div class="h3"><h3><span class="tdlplf-num">' + num + '.</span>' +
      NOM_RUB[this.rub] + '</h3></div>';
    if (this.rub === 'liens') {
      h += '<div class="tdlplf-liens">' + f.rub.liens.map(function (x) {
        return '<div class="tdlplf-lien-c"><f4>' + echappe(x.titre) + '</f4>' +
          echappe(x.texte) + '</div>';
      }).join('') + '</div>';
    } else {
      h += '<div class="tdlplf-texte">' + enParagraphes(f.rub[this.rub]) + '</div>';
    }
    this.$corps.innerHTML = '<div class="tdlplf-panneau' +
      (changementPerso ? ' tdlplf-depuis-bas' : '') + '">' + h + '</div>';
  };

  Composant.prototype.ouvre = function (s, defiler) {
    var f = this.fiche(s);
    if (!f) return false;
    this.gen = f.gen; this.courant = s; this.rub = 'histoire';
    this.rendFrise(); this.rendOnglets(true); this.rendFiche(true);
    if (defiler) this.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  };

  /* --------------------------------------------------------------- AMORÇAGE */

  var instances = [];

  function slugDemande() {
    var m = location.search.match(/[?&]fiche=([^&#]+)/);
    return m ? slug(decodeURIComponent(m[1])) : '';
  }

  function interception() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href*="fiche="]') : null;
      if (!a) return;
      var m = (a.getAttribute('href') || '').match(/[?&]fiche=([^&#]+)/);
      if (!m) return;
      var s = slug(decodeURIComponent(m[1])), ok = false;
      instances.forEach(function (c) { if (!ok && c.fiche(s)) ok = c.ouvre(s, true); });
      // Fiche absente de cette page : on laisse ForumActif naviguer normalement.
      if (ok) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  function demarre() {
    var cibles = T.postsAvec('=== PRELIENS:', '.tdlplf');
    if (!cibles.length) return;

    cibles.forEach(function (el) {
      var modele = analyse(T.texteBrut(el));
      if (!modele) return;
      var c = new Composant(el, modele);            // 1. rendu immédiat
      instances.push(c);
      T.litIndex(function (idx) {                   // 2. enrichissement
        if (!idx) return;
        enrichit(modele, idx);
        c.rendFiche(false);
      });
    });

    interception();
    var demande = slugDemande();
    if (demande) {
      instances.forEach(function (c) { if (c.fiche(demande)) c.ouvre(demande, true); });
    }
  }

  T.pret(demarre);

  window.TDLPL_FICHES = { relancer: demarre, instances: instances, analyse: analyse };
})();
