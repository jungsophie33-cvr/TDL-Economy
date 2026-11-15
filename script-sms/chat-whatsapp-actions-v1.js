/* ============================================================
   chat-whatsapp-actions-v2.js — FICHIER 4 : ACTIONS
   Réactions émoji, lignes système, icône de conversation.

   v2 : le "vu" quitte le menu des messages et rejoint la barre
   d'actions ; le bouton d'actions vit à DROITE du champ de saisie
   (icône fi-rr-menu-dots-vertical, qui existe dans la police —
   l'ancienne fi-rr-ellipsis-h ne s'affichait pas) ; l'icône de
   conversation est ancrée au titre en position absolue, elle ne
   décale jamais cw-head-title.

   CHARGEMENT (ordre strict) :
     1. chat-whatsapp-v11-1-commun.js
     2. chat-whatsapp-v11-2-envoi.js
     3. chat-whatsapp-v11-3-rendu.js
     4. chat-whatsapp-actions-v2.js   <- ce fichier
   Dépend du namespace window.CW11 et, pour Firebase, de
   EcoCore (eco-core-v2-2). Aucun style ici : tout va dans la
   page CSS dédiée du forum (section v2 du patch).

   TROIS MÉCANISMES :
   - Réactions émoji : nœud Firebase reactions/<tid>/<pid>/<pseudo>
     = émoji. Chaque membre n'écrit que sa propre entrée ; le
     personnel peut tout écrire. NETTOYAGE AUTOMATIQUE : la règle
     autorise n'importe quel membre connecté à SUPPRIMER une
     entrée dont le pseudo n'existe plus dans membres/ ; ce
     script détecte ces orphelins au chargement et les efface.
   - Lignes système : de vrais posts Forumactif au texte-marqueur,
     reconnus et restylés ici : (tdl:vu), (tdl:appel), (tdl:rejoint),
     (tdl:quitte), (tdl:icone), (tdl:position) texte libre. Envoyés
     par CW11.envoyer, affichés en pilule centrée grise, gras.
   - Icône de conversation : nœud Firebase icones/<tid> = URL.
     Par défaut le gif fourni. Tout membre connecté peut la
     changer (comme WhatsApp) ; le changement publie aussi la
     ligne "(tdl:icone)".
   ============================================================ */
(function () {
  "use strict";

  var CW = window.CW11;
  if (!CW) return; /* fichiers chat absents : rien à faire */

  var CONFIG = CW.CONFIG;
  var $ = CW.$, $all = CW.$all;
  var estForumChat = CW.estForumChat, topicId = CW.topicId, clePost = CW.clePost;

  var DEBUG = !!CONFIG.DEBUG;

  /* ===== IDENTITÉ (null pour un invité Forumactif) ===== */
  var MOI = (function () {
    try {
      var p = ((window._userdata && window._userdata.username) || "").trim();
      var id = parseInt((window._userdata && window._userdata.user_id) || 0, 10);
      if (!p || p.toLowerCase() === "anonymous" || id <= 0) return null;
      return { pseudo: p, id: id };
    } catch (e) { return null; }
  })();

  /* ===== CONSTANTES ===== */
  var EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
  var ICONE_DEFAUT = "https://64.media.tumblr.com/0e405c697bb9908e98021cf68d42f6a5/a54513cb500624cd-a5/s540x810/ee5b6e7c29e7c1d85dec103ea7bdcefc9910f13e.gif";
  var RE_MARQUEUR = /^\(tdl:(vu|appel|rejoint|quitte|icone|position)\)\s*([\s\S]*)$/i;

  var tid = null;          /* id du sujet */
  var cacheReactions = null; /* { pid: { pseudo: émoji } } ou {} */
  var iconeImg = null;     /* <img> de l'en-tête */
  var iconePerso = null;   /* URL personnalisée, si définie */

  /* ===== TEXTES DES LIGNES SYSTÈME ===== */
  function texteSysteme(cle, pseudo) {
    if (cle === "vu")      return pseudo + " a laissé un vu";
    if (cle === "appel")   return "Appel manqué de " + pseudo;
    if (cle === "rejoint") return pseudo + " a rejoint le groupe";
    if (cle === "quitte")  return pseudo + " a quitté le groupe";
    if (cle === "icone")   return pseudo + " a changé l'icône du groupe";
    return "";
  }

  /* ===== PETITS HELPERS ===== */

  /* id numérique d'un post : ancre de sa date (#1234) */
  function pidPost(post) {
    var cle = clePost(post);
    if (!cle) return null;
    var m = cle.match(/#(\d+)/);
    return m ? m[1] : null;
  }

  /* Message éphémère dans la barre de saisie (réutilise .cw-bar-err) */
  function notice(msg) {
    var bar = $(".cw-bar");
    if (!bar) { if (DEBUG) console.log("[CW-actions]", msg); return; }
    var err = $(".cw-bar-err", bar);
    if (!err) {
      err = document.createElement("div");
      err.className = "cw-bar-err";
      bar.appendChild(err);
    }
    err.textContent = msg;
    err.classList.add("cw-visible");
    clearTimeout(notice._t);
    notice._t = setTimeout(function () { err.classList.remove("cw-visible"); }, 5000);
  }

  /* Attend eco-core de façon bornée (comme chat-reserve) */
  function attendreEcoCore(cb) {
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (window.EcoCore && typeof window.EcoCore.firebaseGet === "function") {
        clearInterval(t);
        cb();
        return;
      }
      if (n >= CONFIG.POLL_MAX) {
        clearInterval(t);
        if (DEBUG) console.log("[CW-actions] eco-core jamais chargé — réactions et icône personnalisée en repli");
      }
    }, CONFIG.POLL_INTERVAL);
  }

  /* Envoie un post système par le canal d'envoi normal */
  function envoyerSysteme(texte) {
    if (!MOI) { notice("Connecte-toi pour cette action."); return; }
    var bar = $(".cw-bar");
    if (!bar || typeof CW.envoyer !== "function") return;
    CW.envoyer(texte, bar, null, null, MOI.id);
    if (DEBUG) console.log("[CW-actions] post système envoyé :", texte);
  }

  /* ===== LIGNES SYSTÈME : DÉTECTION + TRANSFORMATION ===== */

  /* Le contenu d'un post est-il un marqueur système ? */
  function lireMarqueur(contenu) {
    var c = contenu.cloneNode(true);
    var jeter = c.querySelectorAll(".post-wordcount, blockquote, .signature_div, .sj-awards, .award_more");
    Array.prototype.forEach.call(jeter, function (el) { el.remove(); });
    var texte = (c.textContent || "").replace(/\s+/g, " ").trim();
    var m = texte.match(RE_MARQUEUR);
    if (!m) return null;
    return { cle: m[1].toLowerCase(), reste: (m[2] || "").trim() };
  }

  /* Remplace la bulle par une pilule système centrée */
  function systemiser(post) {
    var contenu = $(".cw-content", post);
    if (!contenu) return false;
    var marque = lireMarqueur(contenu);
    if (!marque) return false;

    var pseudo = $(".sj-post-pseudo", post);
    pseudo = pseudo ? pseudo.textContent.trim() : "";
    var heure = $(".cw-time", post);
    heure = heure ? heure.textContent.trim() : "";

    var row = $(".cw-row", post);
    if (row) row.remove();

    var ligne = document.createElement("div");
    ligne.className = "cw-sysline";
    var txt = document.createElement("span");
    txt.className = "cw-sys-txt";
    if (marque.cle === "position") {
      txt.textContent = "📍 " + (marque.reste || "position partagée");
    } else {
      txt.textContent = texteSysteme(marque.cle, pseudo);
    }
    ligne.appendChild(txt);
    if (heure) {
      var h = document.createElement("span");
      h.className = "cw-sys-heure";
      h.textContent = heure;
      ligne.appendChild(h);
    }
    post.appendChild(ligne);
    post.setAttribute("data-cwsys", marque.cle);
    return true;
  }

  /* ===== RÉACTIONS ÉMOJI ===== */

  function chargerReactions() {
    if (!tid) return;
    window.EcoCore.firebaseGet("reactions/" + tid).then(function (obj) {
      cacheReactions = (obj && typeof obj === "object") ? obj : {};
      if (DEBUG) console.log("[CW-actions] réactions chargées :", cacheReactions);
      afficherReactions();
      nettoyerOrphelins();
    }).catch(function () {
      cacheReactions = {};
      if (DEBUG) console.log("[CW-actions] lecture reactions refusée (invité ou session absente)");
    });
  }

  /* Supprime les réactions des pseudos absents de membres/.
     La règle RTDB n'autorise cette écriture QUE pour un pseudo
     qui n'existe plus dans membres/ : c'est le nettoyage
     automatique en cas de suppression d'un membre. */
  function nettoyerOrphelins() {
    if (!MOI || !window.EcoCore || !cacheReactions) return;
    window.EcoCore.firebaseGet("membres").then(function (m) {
      if (!m || typeof m !== "object") return;
      Object.keys(cacheReactions).forEach(function (pid) {
        Object.keys(cacheReactions[pid]).forEach(function (pseudo) {
          if (m[pseudo]) return;
          var chemin = "reactions/" + tid + "/" + pid + "/" + encodeURIComponent(pseudo);
          window.EcoCore.writeField(chemin, null).then(function () {
            delete cacheReactions[pid][pseudo];
            afficherReactions();
            if (DEBUG) console.log("[CW-actions] réaction orpheline nettoyée :", pseudo);
          }).catch(function () {});
        });
      });
    }).catch(function () {});
  }

  /* Pose, remplace ou retire MA réaction sur un post */
  function basculerReaction(pid, emoji) {
    if (!MOI) { notice("Connecte-toi pour réagir."); return; }
    if (!window.EcoCore || !cacheReactions) { notice("Outils TDL indisponibles — réaction refusée."); return; }
    var parPost = cacheReactions[pid] = cacheReactions[pid] || {};
    var ancien = parPost[MOI.pseudo];
    var futur = (ancien === emoji) ? null : emoji;
    var chemin = "reactions/" + tid + "/" + pid + "/" + encodeURIComponent(MOI.pseudo);
    window.EcoCore.writeField(chemin, futur).then(function () {
      if (futur) parPost[MOI.pseudo] = futur;
      else delete parPost[MOI.pseudo];
      afficherReactions();
      if (DEBUG) console.log("[CW-actions] réaction", futur || "retirée", "— post", pid);
    }).catch(function (e) {
      if (DEBUG) console.log("[CW-actions] écriture refusée :", e);
      notice("Réaction refusée (session expirée ?).");
    });
  }

  /* Affiche les réactions sous chaque bulle, groupées par émoji */
  function afficherReactions() {
    if (!cacheReactions) return;
    $all('.sj-postmsg[data-cw="1"]').forEach(function (post) {
      if (post.classList.contains("cw-optimiste")) return;
      var pid = pidPost(post);
      var entrees = pid ? cacheReactions[pid] : null;
      var box = $(".cw-reacts", post);
      var col = $(".cw-col", post);
      if (!entrees || !Object.keys(entrees).length) {
        if (box) box.remove();
        return;
      }
      if (!col) return;
      if (!box) {
        box = document.createElement("div");
        box.className = "cw-reacts";
        col.appendChild(box);
      }
      var groupes = {};
      Object.keys(entrees).forEach(function (p) {
        var e = entrees[p];
        if (!e) return;
        (groupes[e] = groupes[e] || []).push(p);
      });
      box.innerHTML = "";
      Object.keys(groupes).forEach(function (e) {
        var item = document.createElement("span");
        item.className = "cw-react-item";
        item.setAttribute("data-e", e);
        item.title = "Réagir avec " + e;
        var em = document.createElement("span");
        em.className = "cw-react-emoji";
        em.textContent = e;
        var noms = document.createElement("span");
        noms.className = "cw-react-noms";
        noms.textContent = groupes[e].join(", ");
        item.appendChild(em);
        item.appendChild(noms);
        box.appendChild(item);
      });
    });
  }

  /* ===== ICÔNE DE CONVERSATION ===== */

  /* Insère l'icône DANS le titre, en absolu : le titre garde
     exactement sa place, l'icône flotte à sa gauche (écart de
     15px réglé en CSS depuis l'extrémité de la bordure basse). */
  function initIcone() {
    var titre = $(".cw-head-title");
    if (!titre || iconeImg) return;
    var img = document.createElement("img");
    img.className = "cw-head-icone";
    img.alt = "";
    img.src = iconePerso || ICONE_DEFAUT;
    titre.appendChild(img);
    iconeImg = img;
  }

  function chargerIcone() {
    if (!tid) return;
    window.EcoCore.firebaseGet("icones/" + tid).then(function (u) {
      if (typeof u === "string" && u) {
        iconePerso = u;
        if (iconeImg) iconeImg.src = u;
      }
    }).catch(function () {});
  }

  function changerIcone() {
    if (!MOI) { notice("Connecte-toi pour changer l'icône."); return; }
    if (!window.EcoCore) { notice("Outils TDL indisponibles."); return; }
    var courant = iconePerso || "";
    var url = window.prompt("Adresse de l'image (gif, jpg, png) :", courant || ICONE_DEFAUT);
    if (url === null) return;
    url = url.trim();
    if (!url) return;
    window.EcoCore.writeField("icones/" + tid, url).then(function () {
      iconePerso = url;
      if (iconeImg) iconeImg.src = url;
      envoyerSysteme("(tdl:icone)");
    }).catch(function () {
      notice("Changement d'icône refusé (session expirée ?).");
    });
  }

  /* ===== BARRE DE BOUTONS D'ACTIONS ===== */

  function partagerPosition() {
    var t = window.prompt("Ta position :");
    if (t && t.trim()) envoyerSysteme("(tdl:position) " + t.trim());
  }

  var ACTIONS = [
    { libelle: "Laisser un vu",         faire: function () { envoyerSysteme("(tdl:vu)"); } },
    { libelle: "Appel manqué",           faire: function () { envoyerSysteme("(tdl:appel)"); } },
    { libelle: "Position partagée",     faire: partagerPosition },
    { libelle: "A rejoint le groupe",    faire: function () { envoyerSysteme("(tdl:rejoint)"); } },
    { libelle: "A quitté le groupe",    faire: function () { envoyerSysteme("(tdl:quitte)"); } },
    { libelle: "Icône du groupe",        faire: changerIcone }
  ];

  function decorerBarre() {
    var bar = $(".cw-bar");
    if (!bar || $(".cw-actions-wrap", bar)) return;
    var input = $(".cw-bar-input", bar);
    if (!input) return;
    var wrap = document.createElement("div");
    wrap.className = "cw-actions-wrap";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cw-actions-btn";
    btn.setAttribute("aria-label", "Actions");
    btn.innerHTML = '<i class="fi fi-rr-menu-dots-vertical"></i>';
    var pop = document.createElement("div");
    pop.className = "cw-actions-pop";
    ACTIONS.forEach(function (a) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cw-actions-item";
      b.textContent = a.libelle;
      b.addEventListener("click", function () {
        pop.classList.remove("cw-open");
        a.faire();
      });
      pop.appendChild(b);
    });
    wrap.appendChild(btn);
    wrap.appendChild(pop);
    /* juste à droite du champ de saisie */
    bar.insertBefore(wrap, input.nextSibling);
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      pop.classList.toggle("cw-open");
    });
  }

  /* ===== MENU D'UN MESSAGE : rangée de réactions ===== */

  function fermerMenu(pop) {
    var menu = pop.closest(".cw-menu");
    if (menu) menu.classList.remove("cw-open");
  }

  function decorerMenus() {
    $all(".cw-menu-pop").forEach(function (pop) {
      if (pop.getAttribute("data-cwact") === "1") return;
      pop.setAttribute("data-cwact", "1");

      var rangee = document.createElement("div");
      rangee.className = "cw-react-row";
      EMOJIS.forEach(function (e) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "cw-react-opt";
        b.textContent = e;
        b.setAttribute("data-e", e);
        b.title = "Réagir avec " + e;
        rangee.appendChild(b);
      });
      rangee.addEventListener("click", function (ev) {
        var b = ev.target.closest(".cw-react-opt");
        if (!b) return;
        var post = pop.closest(".sj-postmsg");
        var pid = post ? pidPost(post) : null;
        if (pid) basculerReaction(pid, b.getAttribute("data-e"));
        fermerMenu(pop);
      });
      pop.insertBefore(rangee, pop.firstChild);
    });
  }

  /* ===== DÉLÉGATION GLOBALE ===== */
  document.addEventListener("click", function (ev) {
    /* réagir en cliquant une réaction affichée */
    var item = ev.target.closest(".cw-react-item");
    if (item) {
      var post = item.closest(".sj-postmsg");
      var pid = post ? pidPost(post) : null;
      if (pid) basculerReaction(pid, item.getAttribute("data-e"));
      return;
    }
    /* fermer le menu d'actions si clic ailleurs */
    if (!ev.target.closest(".cw-actions-pop") &&
        !ev.target.closest(".cw-actions-btn")) {
      var pop = $(".cw-actions-pop.cw-open");
      if (pop) pop.classList.remove("cw-open");
    }
  });

  /* ===== BOUCLE DE SCAN ===== */
  /* Légère et permanente : transforme les nouvelles lignes
     système (post envoyé sans rechargement), décore les
     nouveaux menus, rafraîchit l'affichage des réactions. */
  function scan() {
    if (CW.reserveVerrouille) return;
    initIcone();
    decorerBarre();
    var posts = $all('.sj-postmsg[data-cw="1"]:not([data-cwsys])');
    for (var i = 0; i < posts.length; i++) {
      if (!systemiser(posts[i])) posts[i].setAttribute("data-cwsys", "non");
    }
    decorerMenus();
    if (cacheReactions) afficherReactions();
  }

  /* ===== INIT ===== */
  function init() {
    var essais = 0;
    var timer = setInterval(function () {
      essais++;
      if (!$(".sub-header-path") && essais < CONFIG.POLL_MAX) return;
      clearInterval(timer);
      if (!estForumChat()) return; /* hors du forum chat : rien */
      if (CW.reserveVerrouille) return;
      tid = topicId();
      if (!tid) return;
      attendreEcoCore(function () {
        chargerReactions();
        chargerIcone();
      });
      setInterval(scan, 1000);
      scan();
    }, CONFIG.POLL_INTERVAL);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
