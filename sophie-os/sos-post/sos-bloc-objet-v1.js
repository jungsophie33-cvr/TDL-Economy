/* =============================================================
   SOS — Sophia OS · BLOC OBJET (sos-bloc-objet.js)
   -------------------------------------------------------------
   Déclare l'usage d'un objet d'inventaire dans un message. Inséré
   par tdl-objets-post.js, jamais écrit à la main en pratique.

   FORMAT :
     --- BLOC objet ---
     ARTICLE: Gri-gri
     OBJET:   amulette
     EFFET:   Relance d'un dé, ou annulation d'un petit échec.
     LIEU:    La maison de Bayou Dularge      (purification)
     DE:      2                               (purification)
     BENEFICIAIRES: Pseudo | Pseudo | Pseudo  (bénédiction)

   Le bloc ne lit rien dans Firebase : il affiche ce que le message
   porte. Un post édité six mois plus tard raconte donc toujours la
   même chose, même si l'inventaire a changé — c'est voulu.

   Dépend de : sos-core.js, sos-blocs.js. À charger APRÈS eux.
   ============================================================= */
(function (global) {
  'use strict';

  var SOS = global.SOS;
  if (!SOS) { if (global.console) console.error('sos-bloc-objet.js : sos-core.js doit être chargé avant.'); return; }

  var h = SOS.h, U = SOS.util;

  var TXT = {
    EYEBROW: 'Objet utilisé',
    LIEU:    'Lieu protégé',
    DE:      'Résultat du dé',
    BENEF:   'Bénéficiaires',
    LEVE: 'Sort levé'
  };

  /* Libellés du d4 de la purification — seul dé qu'un bloc affiche.
     Celui de l'effigie n'est jamais déclaré par la cible. */
  var PURIF = { 1: 'Protection totale', 2: 'Protection partielle',
                3: 'Protection partielle', 4: 'Protection symbolique' };

  /* Icônes connues ; un objet inconnu retombe sur le coffre. */
  function icone(o) {
    var t = (global.TDLObjets && global.TDLObjets.OBJETS) || {};
    return (t[o] && t[o].ic) || 'box-open';
  }

  function nu(bloc, cle) { return U.nu(SOS.champ(bloc, cle)); }

  function rendreObjet(bloc) {
    var article = nu(bloc, 'ARTICLE');
    var objet   = nu(bloc, 'OBJET');
    var effet   = nu(bloc, 'EFFET');
    var lieu    = nu(bloc, 'LIEU');
    var de      = parseInt(nu(bloc, 'DE'), 10) || 0;
    var benef   = U.pipe(nu(bloc, 'BENEFICIAIRES')).filter(Boolean);
    var leve    = nu(bloc, 'LEVE');
    var note    = nu(bloc, 'NOTE');

    var d = h('div', 'tdlob');
    d.appendChild(h('i', 'fi fi-sr-' + icone(objet) + ' tdlob-ic'));

    var corps = h('div', 'tdlob-corps');
    corps.appendChild(h('p', 'tdlob-eyebrow', TXT.EYEBROW));
    if (article) corps.appendChild(h('h4', 'tdlob-nom', article));
    if (effet)   corps.appendChild(h('p', 'tdlob-eff', effet));

    var lignes = [];
    if (lieu) lignes.push([TXT.LIEU, lieu]);
    if (de)   lignes.push([TXT.DE, (PURIF[de] || String(de))]);
    if (benef.length) lignes.push([TXT.BENEF, benef.join(', ')]);
    if (benef.length) lignes.push([TXT.BENEF, benef.join(', ')]);
    if (leve) lignes.push([TXT.LEVE, leve]);

    if (lignes.length) {
      var g = h('div', 'tdlob-grid');
      lignes.forEach(function (l) {
        g.appendChild(h('span', 'tdlob-l', l[0]));
        g.appendChild(h('span', 'tdlob-v', l[1]));
      });
      corps.appendChild(g);
    }
    if (note) corps.appendChild(h('p', 'tdlob-note', note));
    d.appendChild(corps);
    return d;
  }

  SOS.blocs['objet'] = rendreObjet;

})(window);
