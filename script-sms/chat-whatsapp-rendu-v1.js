/* ============================================================
   chat-whatsapp.js — v11 · FICHIER 3/3 : RENDU
   Bulles, auteur du sujet, en-tête, pagination, barre de saisie,
   orchestration et init. Seul fichier qui déclenche l'application
   (et donc qui garantit qu'on ne touche à rien hors du forum chat).

   CHARGEMENT (ordre strict) :
     1. chat-whatsapp-v11-1-commun.js
     2. chat-whatsapp-v11-2-envoi.js
     3. chat-whatsapp-v11-3-rendu.js   <- ce fichier

   - Déplace les vrais noeuds (avatar, message, liens, réactions).
   - Auteur du sujet : localStorage + fetch de la page 1 en repli
     si arrivée directe en page >1, puis correction des côtés.
   - Barre : brouillon restauré, palette (fichier 1), envoi sans
     rechargement (fichier 2), défilement bas de fil.
   ============================================================ */
(function () {
  "use strict";

  var CW = window.CW11;
  var CONFIG = CW.CONFIG, TEXTES = CW.TEXTES;
  var $ = CW.$, $all = CW.$all;
  var estForumChat = CW.estForumChat, estPage1 = CW.estPage1;
  var topicId = CW.topicId;
  var decoupeDate = CW.decoupeDate, texteDate = CW.texteDate;
  var infoEmoji = CW.infoEmoji;

  /* ===== AUTEUR DU SUJET (bulles de droite) ===== */
  function idAuteurSujet(posts) {
    var cle = CONFIG.LS_PREFIX + topicId();
    var stocke = null;
    try { stocke = localStorage.getItem(cle); } catch (e) {}
    if (estPage1() && posts.length) {
      var av = $(".sj-post-avatar", posts[0]);
      var id = av ? av.getAttribute("data-id") : null;
      if (id) {
        try { localStorage.setItem(cle, id); } catch (e) {}
        return id;
      }
    }
    return stocke;
  }

  /* [v11] Arrivée directe en page >1 sans localStorage : on va
     chercher l'auteur sur la page 1, puis on corrige les côtés.
     Gère les URL modernes (/t79-slugp2) et classiques (/viewtopic?t=79). */
  function retablirAuteurAsynchrone() {
    if (estPage1()) return;
    var cle = CONFIG.LS_PREFIX + topicId();
    try { if (localStorage.getItem(cle)) return; } catch (e) {}
    var id = topicId();
    if (!id || !window.fetch || typeof DOMParser === "undefined") return;
    var urlPage1 = /\/viewtopic/.test(location.pathname)
      ? "/viewtopic?t=" + id
      : location.pathname.replace(/(\/t\d+)p\d+/, "$1");
    fetch(urlPage1, { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) {
        if (!html) return;
        var doc = new DOMParser().parseFromString(html, "text/html");
        var premier = doc.querySelector(".sj-post-avatar");
        var id = premier ? premier.getAttribute("data-id") : null;
        if (!id) return;
        try { localStorage.setItem(cle, id); } catch (e) {}
        retaillerCotes(id);
      })
      .catch(function () {});
  }

  function retaillerCotes(idAuteur) {
    if (!idAuteur) return;
    $all(".cw-row").forEach(function (row) {
      var av = $(".sj-post-avatar", row);
      var d = av ? av.getAttribute("data-id") : null;
      if (!d) return;
      var envoye = d === idAuteur;
      row.classList.toggle("cw-sent", envoye);
      row.classList.toggle("cw-received", !envoye);
      var ck = $(".cw-checks", row);
      if (ck) ck.style.display = envoye ? "" : "none";
    });
  }

  /* ===== RENDER : une bulle par post ===== */
  function construireBulle(post, idAuteur, premier) {
    var avatar  = $(".sj-post-avatar", post);
    var pseudo  = $(".sj-post-pseudo", post);
    var dateEl  = $(".sj-post-date", post);
    var contenu = $(".sj-post-msg", post);
    var btns    = $(".sj-post-btn", post);
    var feels   = $(".sj-post-feels", post);
    var enLigne = post.classList.contains("online");

    var dataId = avatar ? avatar.getAttribute("data-id") : null;
    var envoye = !!(dataId && idAuteur && dataId === idAuteur);
    var infos  = decoupeDate(texteDate(dateEl));
    var lien   = dateEl ? dateEl.querySelector("a[href]") : null;

    var row = document.createElement("div");
    row.className = "cw-row " + (envoye ? "cw-sent" : "cw-received");

    var avaWrap = document.createElement("div");
    avaWrap.className = "cw-avatar" + (enLigne ? " cw-online" : "");
    if (avatar) avaWrap.appendChild(avatar);
    var dot = document.createElement("span");
    dot.className = "cw-dot";
    avaWrap.appendChild(dot);

    var bubble = document.createElement("div");
    bubble.className = "cw-bubble";

    if (pseudo && (!envoye || premier)) {
      var p = document.createElement("div");
      p.className = "cw-pseudo";
      p.appendChild(pseudo);
      bubble.appendChild(p);
    }
    if (contenu) {
      contenu.classList.add("cw-content");
      bubble.appendChild(contenu);
      if (!contenu.querySelector("blockquote")) {
        var info = infoEmoji(contenu);
        if (info.seul && info.n >= 1 && info.n <= 3) bubble.classList.add("cw-jumbo");
      }
    }

    var meta = document.createElement("div");
    meta.className = "cw-meta";
    if (infos.heure) {
      var h;
      if (lien) { h = document.createElement("a"); h.href = lien.getAttribute("href"); }
      else      { h = document.createElement("span"); }
      h.className = "cw-time";
      h.textContent = infos.heure;
      meta.appendChild(h);
    }
    if (envoye) {
      var ck = document.createElement("span");
      ck.className = "cw-checks";
      ck.textContent = "\u2713\u2713";
      meta.appendChild(ck);
    }
    bubble.appendChild(meta);

    if (btns) {
      var menu = document.createElement("div");
      menu.className = "cw-menu";
      var trig = document.createElement("button");
      trig.className = "cw-menu-trig";
      trig.setAttribute("aria-label", "Actions");
      trig.innerHTML = '<i class="fi fi-rr-menu-dots-vertical"></i>';
      var pop = document.createElement("div");
      pop.className = "cw-menu-pop";
      pop.appendChild(btns);
      menu.appendChild(trig);
      menu.appendChild(pop);
      bubble.appendChild(menu);
      trig.addEventListener("click", function (e) {
        e.stopPropagation();
        var ouvert = menu.classList.toggle("cw-open");
        post.style.position = ouvert ? "relative" : "";
        post.style.zIndex   = ouvert ? "120" : "";
      });
    }

    var col = document.createElement("div");
    col.className = "cw-col";
    col.appendChild(bubble);
    if (feels) {
      feels.classList.add("cw-feels");
      col.appendChild(feels);
    }

    row.appendChild(avaWrap);
    row.appendChild(col);
    post.appendChild(row);

    return infos.jour;
  }

  /* ===== EN-TÊTE ===== */
  function injecterEntete(premierPost) {
    if ($(".cw-header")) return;
    var titre = $(".page-title");
    var fil   = $(".sub-header-path");
    var head = document.createElement("div");
    head.className = "cw-header";
    head.innerHTML =
      '<i class="fi fi-rr-angle-left cw-back"></i>' +
      '<div class="cw-head-txt">' +
        '<div class="cw-head-title">' + (titre ? titre.textContent.trim() : "") + '</div>' +
        '<div class="cw-head-sub"></div>' +
      '</div>';
    premierPost.parentNode.insertBefore(head, premierPost);
    var sub = $(".cw-head-sub", head);
    if (fil) { sub.appendChild(fil.cloneNode(true)); }
    else     { sub.textContent = TEXTES.sousTitre; }
    var back = $(".cw-back", head);
    if (back) back.addEventListener("click", function () { history.back(); });
  }

  /* Injecte les numéros de page (seuls) dans le header, à droite */
  function injecterPagination() {
    if ($(".cw-head-pag")) return;
    var pag = $all(".pagination").filter(function (p) {
      return p.textContent.replace(/\s/g, "") !== "";
    })[0];
    if (!pag) return;
    var head = $(".cw-header");
    if (!head) return;
    var items = pag.querySelectorAll("span > a:not(.pag-img), span > strong");
    if (!items.length) return;
    var box = document.createElement("div");
    box.className = "cw-head-pag";
    Array.prototype.forEach.call(items, function (it) {
      box.appendChild(it.cloneNode(true));
    });
    head.appendChild(box);
  }

  function estDernierePage() {
    var pag = $(".cw-head-pag");
    if (!pag) return true;
    var as = $all("a", pag);
    for (var i = 0; i < as.length; i++) {
      var txt = (as[i].textContent || "").toLowerCase();
      if (txt.indexOf("suiv") !== -1 || txt.indexOf("next") !== -1) return false;
    }
    return true;
  }

  function scrollBas() {
    window.scrollTo(0, document.body.scrollHeight);
  }

  /* ===== BARRE DE SAISIE ===== */
  function injecterBarre(dernierPost, idAuteur) {
    if ($(".cw-bar")) return;
    var bar = document.createElement("div");
    bar.className = "cw-bar";
    bar.innerHTML =
      '<button class="cw-emoji-btn" type="button" aria-label="\u00C9mojis"><i class="fi fi-rr-smile"></i></button>' +
      '<div class="cw-emoji-pop"></div>' +
      '<textarea class="cw-bar-input" rows="1" placeholder="' + TEXTES.placeholder + '"></textarea>' +
      '<i class="fi fi-rr-clip cw-bar-ico"></i>' +
      '<button class="cw-send" type="button" aria-label="Envoyer"><i class="fi fi-rr-paper-plane"></i></button>';
    dernierPost.parentNode.insertBefore(bar, dernierPost.nextSibling);

    var input = $(".cw-bar-input", bar);
    var btn   = $(".cw-send", bar);

    /* brouillon restauré */
    var brouillon = CW.lireBrouillon();
    if (brouillon) input.value = brouillon;

    CW.construirePalette(bar, input);

    function go() {
      CW.envoyer(input.value, bar, input, btn, idAuteur);
    }
    btn.addEventListener("click", go);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); }
    });
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 96) + "px";
      CW.sauverBrouillon(input.value);
    });
  }

  /* Masque le titre natif "Réponse rapide:" (le form #quick_reply est déjà masqué en CSS) */
  function masquerEncart() {
    var a = document.querySelector('a[name="quickreply"]');
    if (!a) return;
    var n = a.nextElementSibling;
    while (n && n.classList && n.classList.contains("h3")) {
      n.style.display = "none";
      n = n.nextElementSibling;
    }
  }

  /* ===== ORCHESTRATION ===== */
  var scrollFait = false;

  function appliquer() {
    var posts = $all(".sj-postmsg");
    if (!posts.length) return false;

    var idAuteur = idAuteurSujet(posts);
    retablirAuteurAsynchrone();

    injecterEntete(posts[0]); // AVANT la boucle : l'en-tête doit précéder le 1er séparateur

    var jourPrec = null;
    posts.forEach(function (post, index) {
      if (post.getAttribute("data-cw") === "1") return;
      var jour = construireBulle(post, idAuteur, index === 0);
      var cle = (jour || "").toLowerCase();
      if (cle && cle !== jourPrec) {
        var sep = document.createElement("div");
        sep.className = "cw-daysep";
        var s = document.createElement("span");
        s.textContent = jour;
        sep.appendChild(s);
        post.parentNode.insertBefore(sep, post);
      }
      if (cle) jourPrec = cle;
      post.setAttribute("data-cw", "1");
    });

    injecterBarre(posts[posts.length - 1], idAuteur);
    masquerEncart();
    injecterPagination();

    if (!scrollFait && !location.hash && estDernierePage()) {
      scrollFait = true;
      scrollBas();
    }
    return true;
  }

  document.addEventListener("click", function () {
    $all(".cw-menu.cw-open").forEach(function (m) {
      m.classList.remove("cw-open");
      var pm = m.closest(".sj-postmsg");
      if (pm) { pm.style.position = ""; pm.style.zIndex = ""; }
    });
    var ep = $(".cw-emoji-pop.cw-open");
    if (ep) ep.classList.remove("cw-open");
  });

  /* ===== INIT (polling) ===== */
  function init() {
    var essais = 0;
    var timer = setInterval(function () {
      essais++;
      if (!$(".sub-header-path") && essais < CONFIG.POLL_MAX) return;
      if (!estForumChat()) { clearInterval(timer); return; }
      document.body.classList.add("chat-mode");
      var ok = appliquer();
      if (ok || essais >= CONFIG.POLL_MAX) clearInterval(timer);
    }, CONFIG.POLL_INTERVAL);
  }

  /* ===== EXPORTS (utilisés par le fichier envoi à l'exécution) ===== */
  CW.construireBulle = construireBulle;
  CW.scrollBas = scrollBas;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
