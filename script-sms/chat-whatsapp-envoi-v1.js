/* ============================================================
   chat-whatsapp.js — v11 · FICHIER 2/3 : ENVOI
   Envoi réel sans rechargement, brouillon, replis.

   CHARGEMENT (ordre strict) :
     1. chat-whatsapp-v11-1-commun.js
     2. chat-whatsapp-v11-2-envoi.js   <- ce fichier
     3. chat-whatsapp-v11-3-rendu.js
   Dépend du namespace window.CW11 (fichier 1) et, à l'exécution,
   de CW11.construireBulle / CW11.scrollBas (fichier 3).

   Principe de l'envoi invisible :
   1. POST fetch (champs cachés natifs tid/lt + message) — la
      page de confirmation FA n'est jamais affichée.
   2. Récupération de la page du sujet (redirection ou meta refresh).
   3. Extraction des nouveaux posts de l'utilisateur, insertion
      dans le fil, remplacement de la bulle optimiste.
   4. Repli : rechargement direct si le message est introuvable,
      submit classique si fetch indisponible ou invité.
   ============================================================ */
(function () {
  "use strict";

  var CW = window.CW11;
  var CONFIG = CW.CONFIG, TEXTES = CW.TEXTES;
  var $ = CW.$, $all = CW.$all;
  var topicId = CW.topicId, urlReponse = CW.urlReponse;
  var heureCourante = CW.heureCourante, clePost = CW.clePost;

  /* ===== BROUILLON ===== */
  function sauverBrouillon(texte) {
    try {
      if (texte) localStorage.setItem(CONFIG.LS_DRAFT + topicId(), texte);
      else localStorage.removeItem(CONFIG.LS_DRAFT + topicId());
    } catch (e) {}
  }
  function lireBrouillon() {
    try { return localStorage.getItem(CONFIG.LS_DRAFT + topicId()) || ""; } catch (e) { return ""; }
  }

  /* Corps du POST : recopie les champs cachés natifs (tid, t, lt…),
     sans doublon, + message + post=1. Identique au form natif. */
  function corpsEnvoye(text) {
    var src = document.getElementById("quick_reply");
    var params = [];
    var vus = {};
    $all("input", src).forEach(function (inp) {
      if (inp.type === "submit" || inp.type === "button") return;
      if (!inp.name || inp.name === "message" || vus[inp.name]) return;
      vus[inp.name] = 1;
      params.push(encodeURIComponent(inp.name) + "=" + encodeURIComponent(inp.value || ""));
    });
    [["mode", "reply"], ["t", topicId()]].forEach(function (pa) {
      if (!vus[pa[0]]) { vus[pa[0]] = 1; params.push(encodeURIComponent(pa[0]) + "=" + encodeURIComponent(pa[1])); }
    });
    params.push("message=" + encodeURIComponent(text));
    if (!vus["post"]) params.push("post=1");
    return params.join("&");
  }

  /* Repli : submit classique (invités, fetch indisponible). */
  function envoyerClassique(text) {
    var src = document.getElementById("quick_reply");
    if (!src) { window.location.href = urlReponse(); return; }
    var f = document.createElement("form");
    f.method = "post";
    f.action = src.getAttribute("action") || "/post";
    f.style.display = "none";
    $all("input", src).forEach(function (inp) {
      if (inp.type === "submit" || inp.type === "button" || inp.name === "message") return;
      var c = document.createElement("input");
      c.type = "hidden"; c.name = inp.name; c.value = inp.value;
      f.appendChild(c);
    });
    [["mode", "reply"], ["t", topicId()], ["post", "1"]].forEach(function (pa) {
      if (!f.querySelector('[name="' + pa[0] + '"]')) {
        var i = document.createElement("input");
        i.type = "hidden"; i.name = pa[0]; i.value = pa[1];
        f.appendChild(i);
      }
    });
    var msg = document.createElement("input");
    msg.type = "hidden"; msg.name = "message"; msg.value = text;
    f.appendChild(msg);
    document.body.appendChild(f);
    f.submit();
  }

  /* Bulle optimiste en attente, insérée avant la barre. */
  function bulleOptimiste(text) {
    var bar = $(".cw-bar");
    var post = document.createElement("div");
    post.className = "sj-postmsg cw-optimiste";
    var row = document.createElement("div");
    row.className = "cw-row cw-sent";
    var col = document.createElement("div");
    col.className = "cw-col";
    var bulle = document.createElement("div");
    bulle.className = "cw-bubble cw-pending";
    var contenu = document.createElement("div");
    contenu.className = "cw-content";
    contenu.textContent = text;
    bulle.appendChild(contenu);
    var meta = document.createElement("div");
    meta.className = "cw-meta";
    var t = document.createElement("span");
    t.className = "cw-time";
    t.textContent = heureCourante();
    meta.appendChild(t);
    var ck = document.createElement("span");
    ck.className = "cw-checks cw-clock";
    ck.textContent = "\u23F3";
    meta.appendChild(ck);
    bulle.appendChild(meta);
    col.appendChild(bulle);
    row.appendChild(col);
    post.appendChild(row);
    if (bar && bar.parentNode) bar.parentNode.insertBefore(post, bar);
    else $(".sj-postmsg").parentNode.appendChild(post);
    return post;
  }

  /* Extrait du doc distant les posts de l'utilisateur courant
     absents du DOM courant (max 5). Évite d'avaler une page
     entière si FA redirige vers une autre page du sujet. */
  function extraireNouveaux(doc) {
    var cles = {};
    $all(".sj-postmsg").forEach(function (p) {
      var c = clePost(p);
      if (c) cles[c] = 1;
    });
    var moi = "0";
    try { moi = String(parseInt(window._userdata && window._userdata.user_id) || 0); } catch (e) {}
    var res = [];
    $all(".sj-postmsg", doc).forEach(function (p) {
      var c = clePost(p);
      var av = p.querySelector(".sj-post-avatar");
      var id = av ? av.getAttribute("data-id") : null;
      if (c && !cles[c] && id && id === moi && res.length < 5) res.push(document.importNode(p, true));
    });
    return res;
  }

  /* Rafraîchit les champs cachés du #quick_reply DOM (tid/lt
     renouvelés par FA après publication). */
  function rafraichirQuickReply(doc) {
    var neuf = doc.querySelector("#quick_reply");
    var src = document.getElementById("quick_reply");
    if (!neuf || !src) return;
    $all("input", neuf).forEach(function (inp) {
      if (!inp.name || inp.type === "submit" || inp.type === "button") return;
      var loc = src.querySelector('[name="' + inp.name + '"]');
      if (loc) loc.value = inp.value;
      else {
        var i = document.createElement("input");
        i.type = "hidden"; i.name = inp.name; i.value = inp.value;
        src.appendChild(i);
      }
    });
  }

  /* Message d'erreur éphémère dans la barre. */
  var timerErr = null;
  function erreurBarre(bar, message) {
    var err = $(".cw-bar-err", bar);
    if (!err) {
      err = document.createElement("div");
      err.className = "cw-bar-err";
      bar.appendChild(err);
    }
    err.textContent = message;
    err.classList.add("cw-visible");
    if (timerErr) clearTimeout(timerErr);
    timerErr = setTimeout(function () { err.classList.remove("cw-visible"); }, 6000);
  }

  /* ===== ENVOI PRINCIPAL ===== */
  var enCours = false;
  var cibleRetenue = null;

  function envoyer(text, bar, input, btn, idAuteur) {
    text = (text || "").trim();
    if (!text || enCours) return;

    var src = document.getElementById("quick_reply");
    if (!src) { window.location.href = urlReponse(); return; }
    if (!window.fetch || typeof DOMParser === "undefined") {
      envoyerClassique(text);
      return;
    }

    enCours = true;
    cibleRetenue = null;
    if (btn) btn.disabled = true;
    bar.classList.add("cw-busy");

    var pend = bulleOptimiste(text);
    CW.scrollBas();

    fetch(src.getAttribute("action") || "/post", {
      method: "POST",
      credentials: "same-origin",
      redirect: "follow",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: corpsEnvoye(text)
    })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text().then(function (html) {
        return { url: r.url, html: html, statut: r.status };
      });
    })
    .then(function (res) {
      if (CONFIG.DEBUG) console.log("[CW11] POST termin\u00E9 \u2014 statut:", res.statut, "| URL finale:", res.url);

      /* Une URL de sujet peut prendre deux formes sur FA :
         moderne (/t79-slug) ou classique (/viewtopic?t=79). */
      function urlSujetValide(u) {
        return !!u && (/\/t\d+/.test(u) || /\/viewtopic/.test(u) || /[?&]t=\d/.test(u));
      }

      /* Où est la page du sujet ? Trois formes possibles chez FA :
         1. redirection -> l'URL finale est déjà le sujet ;
         2. page de confirmation avec meta refresh (content="1;url=…") ;
         3. page de confirmation avec simple lien href ("voir votre message"). */
      var cible = null;
      if (urlSujetValide(res.url)) cible = res.url;
      else {
        var m = res.html.match(/url=([^"'>\s]+)/i);
        if (m) cible = m[1].replace(/&amp;/g, "&");
        else {
          var l = res.html.match(/href="([^"]*(?:\/t\d+|\/viewtopic)[^"]*)"/i);
          if (l) cible = l[1].replace(/&amp;/g, "&");
        }
      }
      cibleRetenue = cible;
      if (CONFIG.DEBUG) console.log("[CW11] cible retenue:", cible);

      if (!urlSujetValide(cible)) {
        if (CONFIG.DEBUG) {
          console.log("[CW11] REJET \u2014 analyse de la page renvoy\u00E9e :");
          console.log("  titre :", (res.html.match(/<title>([^<]*)<\/title>/i) || [])[1]);
          console.log("  meta refresh :", (res.html.match(/<meta[^>]+refresh[^>]*>/i) || ["aucune"])[0]);
          console.log("  extraits (600) :", res.html.replace(/\s+/g, " ").slice(0, 600));
        }
        /* Derni\u00E8re chance : FA annonce parfois la r\u00E9ussite sans donner d'URL
           exploitable. Dans ce cas : rechargement direct du sujet. */
        if (/enregistr\u00E9|succ\u00E8s|successfully|succesfully/i.test(res.html)) {
          pend.remove();
          sauverBrouillon("");
          window.location.replace(cibleRetenue || (location.pathname + location.search));
          return;
        }
        throw new Error("REJET");
      }

      /* La réponse contient-elle déjà le sujet ? */
      if (urlSujetValide(res.url)) return res.html;
      /* Sinon : la page de confirmation pointe vers le sujet. */
      return fetch(cible, { credentials: "same-origin" }).then(function (r2) { return r2.text(); });
    })
    .then(function (pageHtml) {
      var doc = new DOMParser().parseFromString(pageHtml, "text/html");
      var nouveaux = extraireNouveaux(doc);

      pend.remove();

      if (!nouveaux.length) {
        /* Publié mais introuvable (modération, pagination exotique) :
           rechargement direct du sujet, sans page de confirmation. */
        window.location.replace(cibleRetenue || (location.pathname + location.search));
        return;
      }

      var bar2 = $(".cw-bar");
      nouveaux.forEach(function (p) {
        if (bar2 && bar2.parentNode) bar2.parentNode.insertBefore(p, bar2);
        CW.construireBulle(p, idAuteur, false);
        p.setAttribute("data-cw", "1");
      });
      rafraichirQuickReply(doc);
      sauverBrouillon("");
      CW.scrollBas();
    })
    .catch(function (e) {
      pend.remove();
      if (input) { input.value = text; sauverBrouillon(text); }
      erreurBarre(bar, e && e.message === "REJET" ? TEXTES.errEnvoi : TEXTES.errReseau);
    })
    .then(function () {
      enCours = false;
      if (btn) btn.disabled = false;
      bar.classList.remove("cw-busy");
      if (input) input.focus();
    });
  }

  /* ===== EXPORTS ===== */
  CW.envoyer = envoyer;
  CW.lireBrouillon = lireBrouillon;
  CW.sauverBrouillon = sauverBrouillon;
})();
