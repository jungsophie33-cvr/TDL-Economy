/* ============================================================
   TDL — To do list personnelle (réutilise EcoCore / Firebase REST)
   Note privée par membre, à la RACINE sous notes/<uid>.
   Clé = UID (stable au renommage). Invisible pour les invités.

   PRÉREQUIS :
   - eco-core2.js chargé AVANT (expose window.EcoCore + gère l'auth).
     eco-notes attend EcoCore, donc tolérant à un léger désordre.
   - Règle Firebase sur le nœud "notes" (voir message).

   Stockage : notes/<uid> = { text, maj }
   Lecture  : via EcoCore.safeReadBin() (racine, avec cache 60s).
   Écriture : via EcoCore.writeField('notes/<uid>', {…}).
   ============================================================ */

(function ($) {
  if (!$) { return; }

  var MAX = 5000;   /* doit rester aligné avec le maxlength du textarea */

  /* --- attendre que EcoCore soit prêt --- */
  function quandPret(cb, n) {
    n = n || 0;
    if (window.EcoCore &&
        typeof EcoCore.writeField === 'function' &&
        typeof EcoCore.safeReadBin === 'function') { cb(); return; }
    if (n > 40) {
      if (window.console && console.warn) {
        console.warn('[TDL todo] EcoCore introuvable — charger eco-notes.js après eco-core2.js');
      }
      return;
    }
    setTimeout(function () { quandPret(cb, n + 1); }, 250);
  }

  /* --- injection du bloc dans la colonne droite --- */
  function injecter() {
    var $right = $('.sj-menu-right');
    if (!$right.length) { return false; }
    if ($right.find('.sj-todo').length) { return true; }   /* déjà là */

    var html =
      '<div class="sj-todo">' +
        '<div class="h4">To do list</div>' +
        '<textarea class="sj-todo-area" maxlength="' + MAX + '" ' +
                  'placeholder="Tes notes personnelles…"></textarea>' +
        '<div class="sj-todo-foot">' +
          '<span class="sj-todo-status">Enregistré</span>' +
          '<span class="sj-todo-count">0 / ' + MAX + '</span>' +
        '</div>' +
      '</div>';

    var $eco = $right.find('#eco-admin-bar');
    if ($eco.length) { $eco.after(html); } else { $right.append(html); }
    return true;
  }

  /* --- branchement lecture / sauvegarde --- */
  function bind(uid) {
    var $area = $('.sj-todo .sj-todo-area');
    if (!$area.length || $area.data('bound')) { return; }
    $area.data('bound', true);

    var $status = $('.sj-todo .sj-todo-status');
    var $count  = $('.sj-todo .sj-todo-count');
    var chemin  = 'notes/' + uid;            /* racine, clé = UID */
    var timer   = null;

    function majCompteur() { $count.text($area.val().length + ' / ' + MAX); }

    /* lecture initiale : réutilise le cache 60s d'EcoCore (lit la racine) */
    EcoCore.safeReadBin().then(function (root) {
      var note = (root && root.notes) ? root.notes[uid] : null;
      if (note && typeof note.text === 'string') { $area.val(note.text); }
      majCompteur();
    }).catch(function (e) { EcoCore.warn && EcoCore.warn('[TDL todo] lecture', e); majCompteur(); });

    /* sauvegarde auto débrayée (écrit uniquement notes/<uid>) */
    $area.on('input', function () {
      majCompteur();
      $status.text('Saisie…');
      clearTimeout(timer);
      timer = setTimeout(function () {
        EcoCore.writeField(chemin, { text: $area.val(), maj: Date.now() })
          .then(function () { $status.text('Enregistré'); })
          .catch(function () { $status.text('Erreur'); });
      }, 700);
    });
  }

  /* --- orchestration --- */
  function go() {
    var uid = EcoCore.getUserId();
    if (uid <= 0) { return; }                /* invités : rien */
    var cle = String(uid);

    function tenter() { if (injecter()) { bind(cle); } }
    tenter();
    $(window).on('load', tenter);            /* filet si le menu arrive tard */
  }

  $(document).ready(function () { quandPret(go); });

})(window.jQuery);
