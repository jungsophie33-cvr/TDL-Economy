/* ============================================================================
   TDL — PRÉ-LIENS : PRÉSENTATION DE FAMILLE
   Fichier : tdlpl-famille.js
   ----------------------------------------------------------------------------
   Lit le format texte « === FAMILLE: » posé dans un message et le transforme
   en parcours à deux niveaux : onglets libres, et sous-rubriques optionnelles
   dans la colonne de gauche.

   DIFFÉRENCE MAJEURE avec l'arbre et les fiches : ici le contenu n'est pas
   réécrit, il est DÉPLACÉ. Les nœuds d'origine sont rattachés aux panneaux,
   jamais recréés. Tout ce qu'un autre script a monté — un bloc SOS, une
   chronologie, des images — traverse l'opération intact, qu'il soit passé
   avant ou après nous. L'ordre de chargement cesse d'être un piège.

   Aucune lecture Firebase : une famille n'a ni statut ni faceclaim.

   Dépendances : tdlpl-core.js. Et tdlpl-fiches.css, dont ce module réutilise
   la coque ; tdlpl-famille.css n'en est que le delta.
   ========================================================================== */

(function () {
  "use strict";

  var T = window.TDLPL;
  if (!T) {
    if (window.console) console.error('[TDLPL famille] tdlpl-core.js doit être chargé avant ce script.');
    return;
  }

  var alerte = T.journal('famille');

  var RE_BLOC   = /^===\s*FAMILLE\s*:\s*(.+)$/i;
  var RE_FIN    = /^===\s*FIN/i;
  var RE_ONGLET = /^---\s*ONGLET\s*:?\s*(.*?)\s*---$/i;
  var RE_RUB    = /^--\s*(.*?)\s*--$/;
  var RE_CLE    = /^([A-ZÉÈ0-9]+)\s*:\s*(.*)$/;   // les chiffres comptent : IMG1, IMG2…
  var RE_CIT    = /^CITATION\s*:\s*(.*)$/i;       // utilisable DANS un onglet
  var RE_SRC    = /^SOURCE\s*:\s*(.+)$/i;

  var CLES = ['soustitre', 'secteur', 'tw', 'image', 'referent', 'credits'];

  function estMarqueur(t) {
    return RE_BLOC.test(t) || RE_FIN.test(t) || RE_ONGLET.test(t) ||
           RE_RUB.test(t) || RE_CLE.test(t);
  }

  /* ----------------------------------------------------------- ANALYSEUR */

  /* ForumActif sépare les lignes par des <br>, mais un copier-coller peut
     laisser plusieurs lignes dans un seul nœud texte. On les isole d'abord,
     sinon retirer un marqueur emporterait le texte voisin. */
  function decoupe(el) {
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType !== 3 || n.data.indexOf('\n') < 0) return;
      var lignes = n.data.split('\n');
      if (!lignes.some(function (l) { return estMarqueur(l.trim()); })) return;
      var frag = document.createDocumentFragment();
      lignes.forEach(function (l, i) {
        if (i) frag.appendChild(document.createTextNode('\n'));
        frag.appendChild(document.createTextNode(l));
      });
      n.parentNode.replaceChild(frag, n);
    });
  }

  /* ForumActif transforme une URL écrite en clair en lien cliquable : la
     valeur de la clé arrive vide, l'adresse étant partie dans un <a> voisin.
     On va la chercher jusqu'au saut de ligne suivant, et on consomme les
     nœuds qui la portaient pour qu'ils ne finissent pas dans un onglet. */
  function urlVoisine(n) {
    var pris = [], x = n.nextSibling, url = '';
    while (x && !(x.nodeType === 1 && x.tagName === 'BR')) {
      pris.push(x);
      if (x.nodeType === 1) {
        var img = x.tagName === 'IMG' ? x : (x.querySelector ? x.querySelector('img[src]') : null);
        if (img && !url) url = img.getAttribute('src');
        var a = x.tagName === 'A' ? x : (x.querySelector ? x.querySelector('a[href]') : null);
        if (a && !url) url = a.getAttribute('href');
      } else if (x.nodeType === 3 && !url && /^\s*https?:\/\/\S+\s*$/.test(x.data)) {
        url = x.data.trim();
      }
      x = x.nextSibling;
    }
    if (url) {
      pris.forEach(function (p) {
        p.__tdlplPris = true;
        if (p.parentNode) p.parentNode.removeChild(p);
      });
    }
    return url;
  }

  /* « Laelyss | 2 », « Laelyss | /u2 », « Laelyss | https://… » : on accepte
     les trois écritures et on normalise vers une adresse utilisable. */
  function versProfil(v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (/^\d+$/.test(v)) return '/u' + v;
    if (/^u\d+$/i.test(v)) return '/' + v;
    return v;
  }

  function analyse(el) {
    decoupe(el);

    var m = {
      nom: '', soustitre: '', secteur: '', tw: '', image: '',
      referent: '', referentLien: '', credits: '', imgs: [], onglets: []
    };
    var actif = false, onglet = null, rub = null;
    /* cit : la citation en cours de remplissage, ouverte par CITATION: et
       refermée par le <br> suivant. dernierCit : la dernière posée, pour
       qu'un SOURCE: placé juste après vienne s'y accrocher. */
    var cit = null, dernierCit = null;

    function ranger(noeud) {
      (rub ? rub.noeuds : onglet.noeuds).push(noeud);
    }

    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.__tdlplPris) return;            // nœud déjà consommé par une clé
      var t = (n.textContent || '').trim(), r;
      var estLigne = n.nodeType === 3 || (n.nodeType === 1 && !n.children.length);

      /* Une citation ouverte avale tout jusqu'au saut de ligne : c'est ce qui
         permet d'y écrire des italiques ou du gras sans rien casser. */
      if (cit) {
        if (n.nodeType === 1 && n.tagName === 'BR') { cit = null; n.remove(); return; }
        if (!(estLigne && estMarqueur(t))) { cit.appendChild(n); return; }
        cit = null;
      }

      if (estLigne) {
        if ((r = t.match(RE_BLOC))) { actif = true; m.nom = r[1].trim(); n.remove(); return; }
        if (!actif) return;
        if (RE_FIN.test(t)) { actif = false; n.remove(); return; }

        if ((r = t.match(RE_ONGLET))) {
          onglet = { titre: r[1], noeuds: [], rubs: [] };
          m.onglets.push(onglet); rub = null; dernierCit = null; n.remove(); return;
        }
        if (onglet && (r = t.match(RE_RUB))) {
          rub = { titre: r[1], noeuds: [] };
          onglet.rubs.push(rub); dernierCit = null; n.remove(); return;
        }
        if (onglet && (r = t.match(RE_CIT))) {
          cit = document.createElement('div');
          cit.className = 'cit-bloc';
          if (r[1]) cit.appendChild(document.createTextNode(r[1]));
          ranger(cit); dernierCit = cit; n.remove(); return;
        }
        if (onglet && dernierCit && (r = t.match(RE_SRC))) {
          var c = document.createElement('cite');
          c.textContent = r[1];
          dernierCit.appendChild(c);
          n.remove(); return;
        }
        if (!onglet && (r = t.match(RE_CLE))) {
          var cle = r[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          var val = r[2].trim();
          if (cle === 'referent') {
            var bouts = val.split('|');
            m.referent = (bouts[0] || '').trim();
            // Pas de lien écrit ? FA a peut-être transformé l'adresse en <a>.
            m.referentLien = versProfil((bouts[1] || '').trim() || urlVoisine(n));
            n.remove(); return;
          }
          if (CLES.indexOf(cle) >= 0) {
            m[cle] = (cle === 'image' && !val) ? urlVoisine(n) : val;
            if (cle === 'image' && !m.image) alerte('IMAGE: aucune adresse trouvée sur cette ligne');
            n.remove(); return;
          }
          if (/^img[1-9]$/.test(cle)) {
            var rang = +cle.charAt(3) - 1;
            m.imgs[rang] = val || urlVoisine(n);
            if (!m.imgs[rang]) alerte(cle.toUpperCase() + ' : aucune adresse trouvée sur cette ligne');
            n.remove(); return;
          }
          // Une clé inconnue avant le premier onglet disparaîtrait en silence.
          alerte('clé non reconnue, ligne ignorée : « ' + t + ' »');
          n.remove(); return;
        }
      }

      if (!actif) return;
      if (!onglet) {
        // Du contenu posé avant le premier --- ONGLET --- n'a nulle part où aller.
        // On montre le nœud : c'est souvent là qu'une URL transformée atterrit.
        if (t || n.nodeType === 1) {
          alerte('avant le premier onglet, ignoré : ' +
                 (n.nodeType === 1 ? n.outerHTML.slice(0, 160) : '« ' + t + ' »'));
        }
        return;
      }
      if (n.nodeType === 3 && !t) return;                     // lignes vides
      if (n.nodeType === 1 && n.tagName === 'BR') { n.remove(); return; }
      dernierCit = null;                                      // un SOURCE: tardif n'a plus de cible
      ranger(n);                                              // à déplacer plus tard
    });

    if (!m.nom) return null;
    if (!m.onglets.length) { alerte('aucun onglet déclaré : rien à afficher'); return null; }
    return m;
  }

  /* ----------------------------------------------------------- COMPOSANT */

  function Famille(el, modele, source) {
    this.el = el;
    this.m = modele;
    this.src = source || '';      // le HTML d'origine, pour diagnostic
    this.i = 0;
    this.j = 0;
    this.monte();
  }

  Famille.prototype.monte = function () {
    var m = this.m, self = this;

    var racine = document.createElement('div');
    racine.className = 'tdlplf tdlplf--famille annexe';
    racine.innerHTML =
      '<div class="tdlplf-hero"><div class="tdlplf-hero-in">' +
        '<h1 class="tdlplf-fam">Famille ' + T.echappe(m.nom) + '</h1>' +
        (m.tw ? '<tw>' + T.echappe(m.tw) + '</tw>' : '') +
      '</div></div>' +
      '<div class="tdlplf-onglets"></div>' +
      '<div class="tdlplf-fiche">' +
        '<aside class="tdlplf-aside">' +
          '<div class="tdlplf-ident-fam"></div>' +
          '<div class="tdlplf-portrait"></div>' +
          '<nav class="tdlplf-rubs" hidden></nav>' +
          '<div class="tdlplf-meta"></div>' +
        '</aside>' +
        '<main class="tdlplf-corps">' +
          '<div class="tdlplf-images"></div>' +
          '<div class="tdlplf-panneaux"></div>' +
        '</main>' +
      '</div>';

    this.el.innerHTML = '';
    this.el.appendChild(racine);

    this.$ong   = racine.querySelector('.tdlplf-onglets');
    this.$ident = racine.querySelector('.tdlplf-ident-fam');
    this.$port  = racine.querySelector('.tdlplf-portrait');
    this.$rubs  = racine.querySelector('.tdlplf-rubs');
    this.$meta  = racine.querySelector('.tdlplf-meta');
    this.$imgs  = racine.querySelector('.tdlplf-images');
    this.$pan   = racine.querySelector('.tdlplf-panneaux');

    /* La colonne de gauche et le bandeau d'images sont montés UNE FOIS.
       Ils ne sont jamais retouchés : rien ne clignote au changement d'onglet. */
    this.$ident.innerHTML =
      (m.secteur ? '<span class="tdlplf-secteur">' + T.echappe(m.secteur) + '</span>' : '') +
      (m.soustitre ? '<span class="tdlplf-dynastie">' + T.echappe(m.soustitre) + '</span>' : '');
    if (!m.secteur && !m.soustitre) this.$ident.remove();

    this.$port.innerHTML = m.image
      ? '<img src="' + T.echappe(m.image) + '" alt="">'
      : T.echappe(m.nom.charAt(0).toUpperCase());

    var nomRef = T.echappe(m.referent);
    if (m.referent && m.referentLien) {
      nomRef = '<a href="' + T.echappe(m.referentLien) + '">' + nomRef + '</a>';
    }
    this.$meta.innerHTML =
      (m.referent ? '<div class="tdlplf-referent"><b>Référent</b>' + nomRef +
         '<span>à contacter pour toute question sur la famille</span></div>' : '') +
      (m.credits ? '<div class="tdlplf-credits"><b>Crédits</b>' + T.echappe(m.credits) + '</div>' : '');

    var imgs = m.imgs.filter(Boolean);
    if (imgs.length) {
      this.$imgs.innerHTML = imgs.map(function (u) {
        return '<img src="' + T.echappe(u) + '" alt="">';
      }).join('');
    } else {
      this.$imgs.remove();
    }

    m.onglets.forEach(function (o, i) {
      var b = document.createElement('button');
      b.className = 'tdlplf-ong tdlplf-entre';
      b.style.animationDelay = (i * 85) + 'ms';
      b.textContent = o.titre;
      b.onclick = function () {
        if (i === self.i) return;
        self.i = i; self.j = 0; self.rend(true);
      };
      self.$ong.appendChild(b);
    });

    this.rend(true);
  };

  Famille.prototype.rend = function (changementOnglet) {
    var self = this, o = this.m.onglets[this.i];

    Array.prototype.forEach.call(this.$ong.children, function (b, i) {
      b.classList.toggle('tdlplf-on', i === self.i);
    });

    var avait = !this.$rubs.hidden;
    this.$rubs.hidden = o.rubs.length < 2;
    this.$rubs.innerHTML = '';
    o.rubs.forEach(function (r, j) {
      var b = document.createElement('button');
      b.className = 'tdlplf-rub' + (j === self.j ? ' tdlplf-on' : '');
      b.innerHTML = '<span class="tdlplf-puce"></span>' + T.echappe(r.titre);
      b.onclick = function () {
        if (j === self.j) return;
        self.j = j; self.rend(false);
      };
      self.$rubs.appendChild(b);
    });

    /* Titre numéroté : la sous-rubrique quand il y en a, l'onglet sinon. */
    var titre, num;
    if (o.rubs.length) { titre = o.rubs[this.j].titre; num = this.j + 1; }
    else { titre = o.titre; num = this.i + 1; }

    var pan = document.createElement('div');
    pan.className = 'tdlplf-panneau' + (changementOnglet ? ' tdlplf-depuis-bas' : '');
    pan.innerHTML = '<div class="h3"><h3><span class="tdlplf-num">' +
      ('0' + num).slice(-2) + '.</span>' + T.echappe(titre) + '</h3></div>';

    /* LE DÉPLACEMENT : appendChild détache le nœud de sa position actuelle et
       le rattache ici. Rien n'est sérialisé, rien n'est reconstruit. */
    var source = o.rubs.length ? o.rubs[this.j].noeuds : o.noeuds;
    source.forEach(function (n) { pan.appendChild(n); });

    this.$pan.innerHTML = '';
    this.$pan.appendChild(pan);

    /* La navigation ne s'anime qu'à son apparition, pas à chaque clic. */
    if (changementOnglet && !this.$rubs.hidden && !avait) {
      this.$rubs.classList.remove('tdlplf-entre');
      void this.$rubs.offsetWidth;
      this.$rubs.classList.add('tdlplf-entre');
    }

    reveiller();
  };

  /* Un bloc monté dans un onglet masqué a été mesuré à hauteur zéro — c'est
     le cas de la frise chronofam, qui calcule la position de ses pastilles.
     On lui redonne l'occasion de se mesurer une fois le panneau visible. */
  function reveiller() {
    requestAnimationFrame(function () {
      try {
        window.dispatchEvent(new Event('resize'));
        document.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('scroll'));
      } catch (e) { /* navigateurs anciens : sans effet, sans dégât */ }
    });
  }

  /* ----------------------------------------------------------- AMORÇAGE */

  var instances = [];

  function demarre() {
    var cibles = T.postsAvec('=== FAMILLE:', '.tdlplf');
    if (!cibles.length) return;
    cibles.forEach(function (el) {
      // analyse() détruit le source : on en garde une copie AVANT.
      var source = el.innerHTML;
      var modele = analyse(el);
      if (modele) instances.push(new Famille(el, modele, source));
    });
  }

  T.pret(demarre);

  /* analyse() est destructive : elle retire les marqueurs du DOM. La rappeler
     après coup renvoie toujours null. Pour vérifier ce qui a été lu, passer
     par le modèle conservé dans instances :
       TDLPL_FAMILLE.instances[0].m.image
       TDLPL_FAMILLE.instances[0].m.imgs                                     */
  /* TDLPL_FAMILLE.source() : le début du HTML d'origine, tel que ForumActif
     l'a produit. C'est le seul moyen de voir ce qu'est devenue une URL. */
  function source(i) {
    var inst = instances[i || 0];
    if (!inst) { return '(aucune instance)'; }
    return inst.src.slice(0, 2000);
  }

  window.TDLPL_FAMILLE = {
    relancer: demarre, analyse: analyse, instances: instances, source: source
  };
})();
