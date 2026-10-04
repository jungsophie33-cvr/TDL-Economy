/* =============================================================
   SOS — Sophia OS · BLOCS EN LIGNE (sos-inline.js)
   -------------------------------------------------------------
   Permet d'employer le markdown maison DANS UN MESSAGE ORDINAIRE,
   sans transformer le post en annexe et sans monter la coquille.

   USAGE — n'importe où dans un message :

     <div class="tdl-bloc">
     --- BLOC chronofam ---
     TITRE: Événements importants
     EVENEMENT: 1903
     TEXTE: Création de la société…
     </div>

   Le reste du message n'est pas touché. Tout type enregistré dans
   SOS.blocs fonctionne ici, pas seulement la frise familiale.

   POURQUOI UNE AUTRE CLASSE QUE .tdl-data : sos-annexe scanne les
   .tdl-data et prend la page en plein écran dès qu'il y trouve un
   volet. .tdl-bloc lui est invisible.

   ANTI-FOUC : la feuille cache .tdl-bloc, ce fichier la révèle une
   fois le rendu fait. Si SOS n'arrive jamais, le filet de sécurité
   la révèle quand même, avec son texte brut : rien ne disparaît.

   Dépend de : sos-core.js, sos-blocs.js, et du fichier du type de
   bloc employé. À charger APRÈS eux.
   ============================================================= */
(function (global) {
  'use strict';

  var SEL = '.tdl-bloc';
  var PRET = 'tdl-bloc-pret';
  var RETRY_MS = 200, RETRY_MAX = 50;      /* 10 s avant de renoncer */

  function pret(el) { el.classList.add(PRET); }

  function rendre(el) {
    var SOS = global.SOS;
    var rec = SOS.parser(el.innerHTML);
    var frag = document.createDocumentFragment(), n = 0;
    rec.panneaux.forEach(function (pan) {
      pan.blocs.forEach(function (b) {
        var noeud = SOS.rendreBloc(b);
        if (noeud) { frag.appendChild(noeud); n++; }
      });
    });
    if (!n) { pret(el); return; }           /* aucun bloc reconnu : on laisse le texte */
    el.textContent = '';
    el.appendChild(frag);
    pret(el);
  }

  function passer() {
    Array.prototype.forEach.call(document.querySelectorAll(SEL), function (el) {
      if (el.classList.contains(PRET)) { return; }
      try { rendre(el); }
      catch (e) {
        if (global.console) { console.warn('[SOS inline] rendu impossible', e); }
        pret(el);                           /* on révèle plutôt que de masquer une erreur */
      }
    });
  }

  function demarrer(n) {
    n = n || 0;
    if (!document.querySelector(SEL)) { return; }   /* aucun bloc ici */
    var ok = global.SOS && SOS.parser && SOS.rendreBloc && SOS.blocs;
    if (ok) { passer(); return; }
    if (n > RETRY_MAX) {
      if (global.console) { console.warn('[SOS inline] SOS introuvable : blocs laissés en clair.'); }
      Array.prototype.forEach.call(document.querySelectorAll(SEL), pret);
      return;
    }
    setTimeout(function () { demarrer(n + 1); }, RETRY_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { demarrer(); });
  } else { demarrer(); }

  /* Rendre à la demande, si un message arrive après coup (aperçu, édition…). */
  if (global.SOS) { global.SOS.inline = passer; }

})(window);
