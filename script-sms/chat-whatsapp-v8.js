/* ============================================================
   chat-whatsapp.js
   Affichage "conversation" du sous-forum WhatsApp + envoi réel.

   - Ne touche à RIEN hors de CONFIG.FORUM_SLUG.
   - Déplace les vrais noeuds (avatar, message, liens, réactions).
   - Envoi : clone les champs cachés du form natif #quick_reply
     (jeton tid inclus) et soumet -> contourne SCEditor.
   - Injection asynchrone gérée par polling.
   ============================================================ */
(function () {
  "use strict";

  /* ===== CONFIG ===== */
  var CONFIG = {
    FORUM_SLUG:    "f2-whatsapp",   // [MAJ] segment du lien forum dans .sub-header-path
    POLL_INTERVAL: 400,
    POLL_MAX:      25,
    LS_PREFIX:     "tdlChatAuteur_"
  };

  /* ===== TEXTES ===== */
  var TEXTES = {
    sousTitre:   "The Drowned Lands \u00B7 WhatsApp",
    placeholder: "Message"
  };

  /* Palette d'émojis : bloc Emoticons complet + extras thématiques */
  var EMOJIS = (function () {
    var liste = [];
    for (var cp = 0x1F600; cp <= 0x1F64F; cp++) liste.push(String.fromCodePoint(cp));
    var extra = [
      "\u2764\uFE0F","\uD83E\uDE76","\uD83D\uDC94","\uD83D\uDC8B","\uD83D\uDCAF","\u2728","\uD83D\uDCAB",
      "\uD83D\uDC4D","\uD83D\uDC4E","\uD83D\uDC4C","\u270C\uFE0F","\uD83E\uDD1E","\uD83D\uDC4A","\u270A",
      "\uD83D\uDE4C","\uD83D\uDC4F","\uD83E\uDD1D","\uD83D\uDCAA","\u270B","\uD83D\uDD90\uFE0F","\uD83D\uDC4B",
      "\uD83D\uDC3A","\uD83D\uDC0D","\uD83D\uDC22","\uD83D\uDC0E","\uD83E\uDD8C","\uD83D\uDC1F","\uD83D\uDD4A\uFE0F",
      "\uD83C\uDF19","\u2600\uFE0F","\u2B50","\uD83C\uDF2A\uFE0F","\uD83C\uDF0A","\uD83D\uDD25","\uD83C\uDF32",
      "\uD83E\uDD43","\u2615","\uD83C\uDF77","\uD83C\uDF7B","\uD83D\uDEAC","\uD83C\uDF82","\uD83C\uDF7E",
      "\uD83D\uDC80","\u2620\uFE0F","\u26B0\uFE0F","\uD83D\uDD2A","\uD83D\uDD2B","\uD83E\uDE78","\u26D3\uFE0F",
      "\uD83C\uDFB2","\uD83C\uDCCF","\uD83D\uDCB0","\uD83D\uDD11","\uD83D\uDD52","\uD83D\uDCF1","\uD83D\uDCE9",
      "\u2049\uFE0F","\u2753","\u2755","\uD83D\uDCA2","\uD83D\uDCAC","\uD83D\uDC41\uFE0F","\uD83D\uDC42"
    ];
    return liste.concat(extra);
  })();

  /* ===== UTILS ===== */
  function $(sel, ctx)    { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function estForumChat() {
    var liens = $all(".sub-header-path a.nav");
    if (!liens.length) return false;
    var dernier = liens[liens.length - 1];
    return (dernier.getAttribute("href") || "").indexOf(CONFIG.FORUM_SLUG) !== -1;
  }

  function topicId() {
    var m = location.pathname.match(/\/t(\d+)/);
    return m ? m[1] : null;
  }

  function estPage1() {
    if (/\/t\d+p[1-9]/.test(location.pathname)) return false;
    var m = location.search.match(/[?&]start=(\d+)/);
    if (m && parseInt(m[1], 10) > 0) return false;
    return true;
  }

  function urlReponse() {
    var as = $all(".sj-btn-new a");
    for (var i = 0; i < as.length; i++) {
      var h = as[i].getAttribute("href") || "";
      if (/mode=reply/.test(h)) return h;
    }
    return "/post?t=" + topicId() + "&mode=reply";
  }

  /* "Aujourd'hui à 20:49" -> { jour:"Aujourd'hui", heure:"20:49" } */
  function decoupeDate(texte) {
    var t = (texte || "").replace(/\s+/g, " ").trim();
    var m = t.match(/(\d{1,2})\s*[:hH]\s*(\d{2})\s*$/);
    var heure = "", jour = t;
    if (m) {
      heure = (m[1].length === 1 ? "0" + m[1] : m[1]) + ":" + m[2];
      jour  = t.slice(0, m.index);
    }
    jour = jour.replace(/[\s\u00A0]*(?:\u00E0|-)[\s\u00A0]*$/i, "").trim();
    return { jour: jour, heure: heure };
  }

  function texteDate(dateEl) {
    if (!dateEl) return "";
    var spans = dateEl.querySelectorAll("span");
    return spans.length ? spans[spans.length - 1].textContent : dateEl.textContent;
  }

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

  /* Plage de codepoints émoji-texte (sans \p, compatible tous navigateurs) */
  function estEmoji(cp) {
    if (cp >= 0x1F000 && cp <= 0x1FAFF) return true; // plan emoji principal
    if (cp >= 0x2600  && cp <= 0x27BF)  return true; // symboles divers + dingbats
    if (cp >= 0x2300  && cp <= 0x23FF)  return true; // symboles techniques (⌛ ⏰ …)
    if (cp === 0x2B50 || cp === 0x2B55 || cp === 0x2B1B || cp === 0x2B1C) return true;
    if (cp === 0x2764 || cp === 0x2620 || cp === 0x2049 || cp === 0x203C) return true;
    if (cp === 0x00A9 || cp === 0x00AE || cp === 0x2122) return true;
    return false;
  }

  /* Message composé uniquement d'émojis (FA les rend en <img class="emojione">) */
  function infoEmoji(contenu) {
    if (!contenu) return { seul: false, n: 0 };
    var c = contenu.cloneNode(true);
    var jeter = c.querySelectorAll(".post-wordcount, blockquote, .signature_div, .sj-awards, .award_more");
    Array.prototype.forEach.call(jeter, function (el) { el.remove(); });

    var imgsEmoji = c.querySelectorAll("img.emojione"); // [MAJ] classe des émojis FA
    var nImg = imgsEmoji.length;
    Array.prototype.forEach.call(imgsEmoji, function (el) { el.remove(); });

    if (c.querySelector("img")) return { seul: false, n: nImg }; // autre image => pas un message émoji

    var reste = c.textContent.replace(/\s/g, "");
    var nTexte = 0;
    for (var i = 0; i < reste.length; ) {
      var cp = reste.codePointAt(i);
      i += (cp > 0xFFFF ? 2 : 1);
      if (cp === 0x200D || cp === 0xFE0F || cp === 0xFE0E || cp === 0x20E3 ||
          (cp >= 0x1F3FB && cp <= 0x1F3FF) ||
          (cp >= 0x1F1E6 && cp <= 0x1F1FF)) {
        continue;
      }
      if (estEmoji(cp)) { nTexte++; }
      else { return { seul: false, n: nImg + nTexte }; }
    }
    var n = nImg + nTexte;
    return { seul: n > 0, n: n };
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
    var head = document.createElement("div");
    head.className = "cw-header";
    head.innerHTML =
      '<i class="fi fi-rr-angle-left cw-back"></i>' +
      '<div class="cw-head-txt">' +
        '<div class="cw-head-title">' + (titre ? titre.textContent.trim() : "") + '</div>' +
        '<div class="cw-head-sub">' + TEXTES.sousTitre + '</div>' +
      '</div>';
    premierPost.parentNode.insertBefore(head, premierPost);
    var back = $(".cw-back", head);
    if (back) back.addEventListener("click", function () { history.back(); });
  }

  /* ===== ENVOI RÉEL (contourne SCEditor) ===== */
  function envoyer(text) {
    text = (text || "").trim();
    if (!text) return;
    var src = document.getElementById("quick_reply"); // [MAJ] form natif de réponse rapide
    if (!src) { window.location.href = urlReponse(); return; } // repli (invités, etc.)

    var f = document.createElement("form");
    f.method = "post";
    f.action = src.getAttribute("action") || "/post";
    f.style.display = "none";

    /* on recopie tous les champs cachés natifs (jeton tid, t, mode, lt...) sauf le message */
    $all("input", src).forEach(function (inp) {
      if (inp.type === "submit" || inp.type === "button") return;
      if (inp.name === "message") return;
      var c = document.createElement("input");
      c.type = "hidden"; c.name = inp.name; c.value = inp.value;
      f.appendChild(c);
    });

    function ajoute(nom, val) {
      if (f.querySelector('[name="' + nom + '"]')) return;
      var i = document.createElement("input");
      i.type = "hidden"; i.name = nom; i.value = val;
      f.appendChild(i);
    }
    ajoute("mode", "reply");
    ajoute("t", topicId());

    var msg = document.createElement("input");
    msg.type = "hidden"; msg.name = "message"; msg.value = text;
    f.appendChild(msg);

    ajoute("post", "1"); // déclenche l'action d'envoi côté FA

    document.body.appendChild(f);
    f.submit();
  }

  /* Insère un émoji à la position du curseur dans le champ */
  function insererEmoji(input, emoji) {
    var s = input.selectionStart || 0, e = input.selectionEnd || 0;
    var v = input.value;
    input.value = v.slice(0, s) + emoji + v.slice(e);
    var pos = s + emoji.length;
    input.selectionStart = input.selectionEnd = pos;
    input.focus();
    input.dispatchEvent(new Event("input"));
  }

  /* ===== BARRE DE SAISIE ===== */
  function injecterBarre(dernierPost) {
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

    var input    = $(".cw-bar-input", bar);
    var btn      = $(".cw-send", bar);
    var emojiBtn = $(".cw-emoji-btn", bar);
    var pop      = $(".cw-emoji-pop", bar);

    EMOJIS.forEach(function (em) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cw-emoji";
      b.textContent = em;
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        insererEmoji(input, em);
      });
      pop.appendChild(b);
    });

    emojiBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      pop.classList.toggle("cw-open");
    });
    pop.addEventListener("click", function (e) { e.stopPropagation(); });

    function go() { envoyer(input.value); }
    btn.addEventListener("click", go);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); }
    });
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 96) + "px";
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
  function appliquer() {
    var posts = $all(".sj-postmsg");
    if (!posts.length) return false;

    var idAuteur = idAuteurSujet(posts);

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

    injecterBarre(posts[posts.length - 1]);
    masquerEncart();
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
