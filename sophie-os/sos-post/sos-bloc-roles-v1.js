/* =============================================================
   SOS — Sophia OS · BLOCS RÔLES (sos-bloc-roles.js)
   -------------------------------------------------------------
   Ajoute quatre types au registre SOS.blocs :
     roles    — grades ET divisions (même objet, même mise en page)
     echelle  — hiérarchie ou progression de carrière
     encart   — une règle qui commente ce qui précède
     faits    — les « faits intéressants » d'une annexe

   PRINCIPE DE LECTURE : l'ORDRE D'ÉCRITURE EST L'ORDRE DE RENDU.
   Chaque clé ouvre une section ou alimente la section courante ;
   on parcourt bloc.entrees, pas bloc.champs, parce que champs perd
   l'ordre et fusionne les clés répétées.

   Seule exception : les INFO sont ramassées où qu'elles soient et
   rendues en fiche à la fin du rôle, puisque c'est leur place dans
   la mise en page.

   FORMAT — bloc roles (tout est facultatif sauf ROLE) :

     --- BLOC roles ---
     ROLE: Water Patrol | Bayous, marais et zone côtière
     TEXTE: Là où les routes s'arrêtent, c'est elle qui continue.

     LISTE: Moyens
     CLE: Patrouilleurs | Surveillance quotidienne des bayous
     CLE: Hydroglisseur | Eaux trop peu profondes pour une hélice

     LISTE: Missions
     ITEM: Surveillance et remontée de filière

     RUBRIQUE: Signalements
     TEXTE: Les habitants peuvent signaler de façon anonyme.

     JETONS: Collaboration
     INTERNE: Patrol Division | K-9
     EXTERNE: Coast Guard | Louisiana State Police
     GLOSE: Le Coast Guard prend le relais en zone côtière.

     INFO: Tenue | Uniforme adapté
     INFO: Terrain | Permanent

   ITEM: donne la liste à pastille, CLE: la liste à clé. Les
   mélanger dans une même LISTE est sans effet : le premier type
   rencontré impose le rendu, l'autre est ignoré et signalé en
   console.

   GARDE-FOU ÉDITORIAL : une INFO dont la valeur dépasse SEUIL_INFO
   mots ne rentre pas dans la fiche — elle devient une rubrique
   portant sa clé en libellé. Le contenu long est ainsi rendu là où
   il est lisible, au lieu de déformer la grille. C'est volontaire :
   la consigne de rédaction ne tient pas toute seule, le rendu, si.

   FORMAT — bloc echelle :
     RANG: Corporal | env. 3 ans      (le second champ est facultatif)
     TEXTE: Deputy confirmé : appuie l'encadrement.

   FORMAT — bloc encart :
     TITRE: Une affectation n'est pas un grade
     TEXTE: Detective, K-9, Narcotics…   (répétable)

   FORMAT — bloc faits :
     FAIT: Beaucoup de monde sur les ondes
     TEXTE: La Louisiane est l'État qui…       (répétable)
     CHIFFRE: 5 | agents / pour 1 000 habitants | fi-sr-users
     NOTE: À Terrebonne, une trentaine de deputies par shift…
     CITATION: Un deputy peut patrouiller le matin…

   Dans CHIFFRE, la barre oblique entourée d'espaces coupe la ligne
   de l'unité. Le troisième champ est une classe Flaticon de la
   famille fi-sr, facultative. CITATION et CHIFFRE occupent la même
   place : si les deux sont donnés, le chiffre gagne et la citation
   est ignorée — une seule chose dans la colonne.

   Dépend de : sos-core.js, sos-blocs.js (SOS.h, SOS.util).
   À charger APRÈS sos-blocs.js, AVANT sos-annexe.js.
   Feuille associée : CSS-roles.css
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { console.error('sos-bloc-roles.js : sos-core.js doit être chargé avant.'); return; }
  var h = SOS.h, U = SOS.util;

  /* Au-delà de ce nombre de mots, une valeur d'INFO n'est plus une
     valeur de fiche : elle bascule en rubrique. Dix mots, c'est déjà
     une phrase ; une fiche tient en deux à cinq mots. */
  var SEUIL_INFO = 10;

  /* ===================== UTILS ===================== */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&(?![a-z#0-9]+;)/gi, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Texte nu d'une entrée (balises retirées, lignes recollées). */
  function nu(e) { return U.nu(e.lignes || []).trim(); }

  /* Paragraphes riches : une ligne = un <p>, les balises sont gardées
     (liens, gras, italiques écrits à la main dans le post). */
  function para(e) { return U.paragraphes(e.lignes || []); }

  /* Découpe sur les barres verticales, vides retirés. */
  function coupe(s) {
    return String(s == null ? '' : s).split('|').map(function (x) { return x.trim(); })
      .filter(function (x) { return x; });
  }

  function mots(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; }

  /* ===================== LECTURE : BLOC ROLES ===================== */
  function lireRoles(bloc) {
    var roles = [], role = null, sect = null;

    function ouvrir(s) { sect = s; if (role) { role.sections.push(s); } }

    (bloc.entrees || []).forEach(function (e) {
      var v = nu(e);

      if (e.cle === 'ROLE') {
        var p = coupe(v);
        role = { nom: p[0] || '', sous: p.slice(1).join(' | '), chapo: [], sections: [], infos: [] };
        roles.push(role);
        sect = null;
        return;
      }
      if (!role) { return; }                    /* avant le premier ROLE : ignoré */

      switch (e.cle) {
        case 'TEXTE':
          /* dans une rubrique, le texte lui appartient ; sinon c'est le chapô */
          if (sect && sect.type === 'rub') { sect.paras.push(para(e)); }
          else { role.chapo.push(para(e)); }
          break;

        case 'LISTE':
          ouvrir({ type: 'liste', lbl: v, mode: null, items: [] });
          break;

        case 'ITEM':
          if (!sect || sect.type !== 'liste') { break; }
          if (!sect.mode) { sect.mode = 'item'; }
          if (sect.mode !== 'item') {
            console.warn('SOS roles : ITEM ignoré dans une liste à clé — «' + v + '»');
            break;
          }
          sect.items.push({ txt: v });
          break;

        case 'CLE':
          if (!sect || sect.type !== 'liste') { break; }
          if (!sect.mode) { sect.mode = 'cle'; }
          if (sect.mode !== 'cle') {
            console.warn('SOS roles : CLE ignorée dans une liste à pastille — «' + v + '»');
            break;
          }
          var c = coupe(v);
          sect.items.push({ cle: c[0] || '', txt: c.slice(1).join(' | ') });
          break;

        case 'RUBRIQUE':
          ouvrir({ type: 'rub', lbl: v, paras: [] });
          break;

        case 'JETONS':
          ouvrir({ type: 'jet', lbl: v, interne: [], externe: [], glose: '' });
          break;

        case 'INTERNE':
        case 'EXTERNE':
          if (!sect || sect.type !== 'jet') { break; }
          var cible = (e.cle === 'INTERNE') ? sect.interne : sect.externe;
          coupe(v).forEach(function (n) { cible.push(n); });
          break;

        case 'GLOSE':
          if (sect && sect.type === 'jet') { sect.glose = v; }
          break;

        case 'INFO':
          var i = coupe(v);
          if (i.length) { role.infos.push({ cle: i[0], val: i.slice(1).join(' | ') }); }
          break;
      }
    });

    /* garde-fou : les valeurs trop longues quittent la fiche */
    roles.forEach(function (r) {
      var courtes = [];
      r.infos.forEach(function (info) {
        if (mots(info.val) > SEUIL_INFO) {
          r.sections.push({ type: 'rub', lbl: info.cle, paras: ['<p>' + esc(info.val) + '</p>'] });
        } else {
          courtes.push(info);
        }
      });
      r.infos = courtes;
    });

    return roles;
  }

  /* ===================== RENDU : BLOC ROLES ===================== */
  function htmlListe(s) {
    var cle = (s.mode === 'cle');
    var out = '<ul class="tdlrol-liste' + (cle ? ' tdlrol-cle' : '') + '">';
    s.items.forEach(function (it) {
      out += '<li>' + (cle ? '<b>' + esc(it.cle) + '</b><span>' + esc(it.txt) + '</span>'
                           : esc(it.txt)) + '</li>';
    });
    return out + '</ul>';
  }

  function htmlJetons(s) {
    var out = '<div class="tdlrol-jet">';
    s.interne.forEach(function (n) { out += '<span class="interne">' + esc(n) + '</span>'; });
    s.externe.forEach(function (n) { out += '<span>' + esc(n) + '</span>'; });
    out += '</div>';
    if (s.glose) { out += '<p class="tdlrol-jet-glose">' + esc(s.glose) + '</p>'; }
    return out;
  }

  function htmlRole(r) {
    var out = '<div class="tdlrol-head">'
      + '<p class="tdlrol-titre" role="heading" aria-level="3">' + esc(r.nom) + '</p>'
      + (r.sous ? '<p class="tdlrol-sous">' + esc(r.sous) + '</p>' : '')
      + '</div>';

    r.chapo.forEach(function (p) {
      out += String(p).replace(/<p/g, '<p class="tdlrol-def"');
    });

    r.sections.forEach(function (s) {
      if (s.lbl) { out += '<p class="tdlrol-lbl">' + esc(s.lbl) + '</p>'; }
      if (s.type === 'liste') { out += htmlListe(s); }
      else if (s.type === 'jet') { out += htmlJetons(s); }
      else if (s.type === 'rub') { out += '<div class="tdlrol-rub">' + s.paras.join('') + '</div>'; }
    });

    if (r.infos.length) {
      out += '<dl class="tdlrol-fiche">';
      r.infos.forEach(function (i) {
        out += '<div><dt>' + esc(i.cle) + '</dt><dd>' + esc(i.val) + '</dd></div>';
      });
      out += '</dl>';
    }
    return out;
  }

  function rendreRoles(bloc) {
    var liste = lireRoles(bloc);
    var racine = h('div', 'tdlrol-lot');
    liste.forEach(function (r) {
      racine.appendChild(h('article', 'tdlrol', htmlRole(r)));
    });
    return racine;
  }

  /* ===================== BLOC ECHELLE ===================== */
  function rendreEchelle(bloc) {
    var out = '', ouvert = false;

    (bloc.entrees || []).forEach(function (e) {
      var v = nu(e);
      if (e.cle === 'RANG') {
        if (ouvert) { out += '</div>'; }
        var p = coupe(v);
        out += '<div class="tdlech-ligne"><span class="tdlech-cle">' + esc(p[0] || '') + '</span>'
          + (p.length > 1 ? '<i class="tdlech-note">' + esc(p.slice(1).join(' | ')) + '</i>' : '');
        ouvert = true;
      } else if (e.cle === 'TEXTE' && ouvert) {
        out += '<p class="tdlech-txt">' + esc(v) + '</p>';
      }
    });
    if (ouvert) { out += '</div>'; }

    return h('div', 'tdlech', out);
  }

  /* ===================== BLOC ENCART ===================== */
  function rendreEncart(bloc) {
    var titre = '', corps = '';
    (bloc.entrees || []).forEach(function (e) {
      if (e.cle === 'TITRE') { titre = nu(e); }
      else if (e.cle === 'TEXTE') { corps += para(e); }
    });
    return h('div', 'tdlenc', (titre ? '<b>' + esc(titre) + '</b>' : '') + corps);
  }

  /* ===================== BLOC FAITS ===================== */
  function htmlChiffre(val) {
    var p = coupe(val);
    if (!p.length) { return ''; }
    var nb = p[0];
    var uni = (p[1] || '').split(/\s+\/\s+/).map(esc).join('<br>');
    var ico = p[2] || '';
    return '<div class="tdlfait-chiffre"><div class="tdlfait-ch-val">'
      + (ico ? '<i class="fi ' + esc(ico) + '" aria-hidden="true"></i>' : '')
      + '<span class="tdlfait-ch-nb">' + esc(nb) + '</span>'
      + (uni ? '<p class="tdlfait-ch-uni">' + uni + '</p>' : '')
      + '</div>';          /* refermé par htmlFait, après la NOTE éventuelle */
  }

  function rendreFaits(bloc) {
    var racine = h('div', 'tdlfait-lot');
    var f = null;

    function poser() {
      if (!f) { return; }
      var out = '<p class="tdlfait-titre" role="heading" aria-level="3">' + esc(f.titre) + '</p>';
      if (f.chiffre) {
        out += htmlChiffre(f.chiffre)
          + (f.note ? '<p class="tdlfait-ch-note">' + esc(f.note) + '</p>' : '')
          + '</div>';
      }
      out += f.paras.join('');
      /* la citation ne sort que si le chiffre n'occupe pas la place */
      if (f.cite && !f.chiffre) {
        out += '<p class="tdlfait-cite">' + esc(f.cite) + '</p>';
      } else if (f.cite && f.chiffre) {
        console.warn('SOS faits : CITATION ignorée, le CHIFFRE occupe déjà la place — «' + f.titre + '»');
      }
      racine.appendChild(h('div', 'tdlfait', out));
      f = null;
    }

    (bloc.entrees || []).forEach(function (e) {
      var v = nu(e);
      switch (e.cle) {
        case 'FAIT':
          poser();
          f = { titre: v, paras: [], cite: '', chiffre: '', note: '' };
          break;
        case 'TEXTE':   if (f) { f.paras.push(para(e)); } break;
        case 'CITATION':if (f) { f.cite = v; } break;
        case 'CHIFFRE': if (f) { f.chiffre = v; } break;
        case 'NOTE':    if (f) { f.note = v; } break;
      }
    });
    poser();

    return racine;
  }

  /* ===================== ENREGISTREMENT ===================== */
  SOS.blocs.roles   = rendreRoles;
  SOS.blocs.echelle = rendreEchelle;
  SOS.blocs.encart  = rendreEncart;
  SOS.blocs.faits   = rendreFaits;

})(window);
