// === ECONOMIE V2 – GAIN SYSTEM ===
// Auteur : ChatGPT x THE DROWNED LANDS
console.log("[EcoV2] >>> eco-gain chargé");

(function(){

  const {
    log, warn, err,
    safeReadBin, writeBin,
    getPseudo, getMessagesCount, showEcoGain
  } = window.EcoCore;

  const { updatePostDollars } = window.EcoUI;

  // ---------- GAINS AUTOMATIQUES ----------
  const GAIN_RULES = {
    presentation_new: 20,
    presentation_reply: 5,
    preliens_or_gestion_new: 10,
    preliens_or_gestion_reply: 5,
    houma_terrebonne_new: 15,
    houma_terrebonne_reply: 10,
    vote_topic_reply: 2
  };

  // ---------- BONUS PAR TAGS ----------
  const TAG_BONUS = {
    "#intrigue": 10,
    "#event": 5,
    "#enquete": 5,
    "#solve": 60,
    "#defi": 5,
    "#mintrigue": 5,
    "#sujet-terminé": 50
  };

  const FORUM_IDS = {
    presentations: "/f5-presentations",
    preliens: "/f4-en-construction",
    gestionPersos: "/f33-fiches-de-liens",
    journalPersos: "/f34-journaux-de-personnages",
    voteTopicName: "/t22-vote-aux-top-sites"
  };

  const RP_ZONES = [
    "/f7-les-bayous-sauvages",
    "/f8-downtown-houma",
    "/f9-bayou-cane",
    "/f10-bayou-blue",
    "/f11-mandalay-national-wildlife-refuge",
    "/f12-terrebonne-bay",
    "/f46-cocodrie",
    "/f47-chauvin-lacs",
    "/f36-la-louisiane",
    "/f37-la-nouvelle-orleans",
    "/f45-baton-rouge",
    "/f29-bourg",
    "/f30-ashland",
    "/f31-montegut",
    "/f38-le-reste-du-monde"
  ];
  window.EcoCore.RP_ZONES = RP_ZONES;

  function countWordsFromElement(el) {
  if (!el) return 0;

  // Clone pour nettoyer sans toucher au DOM
  const clone = el.cloneNode(true);

  // Supprimer citations et éléments non pertinents
  clone.querySelectorAll("blockquote, cite, .quote, .codebox, .spoiler").forEach(node => node.remove());

  const text = (clone.textContent || "")
    .replace(/\[.*?\]/g, " ")
    .replace(/<.*?>/g, " ")
    .replace(/[\x00-\x40\x5b-\x60\x7b-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

return (text.match(/\p{L}[\p{L}\p{N}]*/gu) || []).length;
}

function getWordCountBonus(words) {
  if (words > 3000) return 20;
  if (words > 2000) return 15;
  if (words > 1000) return 10;
  return 0;
}

  // --- DÉTECTION DES POSTS (nouveau + correctif newtopic direct) ---
  function ecoAttachPostListeners() {
    const forms = document.querySelectorAll(
      'form[name="post"], form#quick_reply, form[action*="post"], form[action*="posting"], form#qrform'
    );

    if (!forms.length) {
      console.warn("[EcoV2] Aucun formulaire de post trouvé (attente DOM).");
      return;
    }

    forms.forEach(f => {
      if (f.__eco_listening) return;
      f.__eco_listening = true;

      log("Formulaire de post détecté :", f.action || "(aucune action)");

      const handler = () => {
        try {
          // Détecter le mode à partir de l'URL d'action (ou d'un input caché "mode")
          const urlObj = new URL(f.action || location.href, location.origin);
          const mode = (urlObj.searchParams.get("mode") || f.querySelector('input[name="mode"]')?.value || "").toLowerCase();

          // ❌ Ne rien enregistrer pour édition/suppression
          if (mode === "editpost" || mode === "delete") {
            sessionStorage.removeItem("ecoJustPosted");
            console.log("[EcoV2] submit ignoré (", mode, ") — aucun gain.");
            return;
          }

          const isNewTopic = location.href.includes("mode=newtopic"); // ou !!f.querySelector('input[name="subject"]')
          // ForumId : breadcrumb > input hidden f > fallback
          let forumId = null;
          const bc = document.querySelector(".sub-header-path");
          if (bc) {
            const links = Array.from(bc.querySelectorAll('a[href*="/f"]'));
            const last = links.pop();
            if (last) forumId = last.getAttribute("href");
          }
          if (!forumId) {
            const fInput = f.querySelector('input[name="f"]');
            forumId = fInput ? fInput.value : null;
          }
          if (!forumId) forumId = location.pathname;

          // On enregistre aussi le "mode" pour que le check ultérieur sache quoi faire
          const data = { t: Date.now(), newTopic: isNewTopic, fid: forumId, mode };
          sessionStorage.setItem("ecoJustPosted", JSON.stringify(data));
          console.log("[EcoV2] 🧩 ecoJustPosted enregistré :", data);
        } catch (e) {
          console.error("[EcoV2] ecoAttachPostListeners error", e);
        }
      };

      // Capture standard (réponses)
      f.addEventListener("submit", handler);

      // Capture sur clic bouton envoyer
      const btn = f.querySelector('input[type="submit"], button[type="submit"]');
      if (btn) btn.addEventListener("click", handler);

      // --- Cas spécial : création directe d’un nouveau sujet (sans prévisualisation) ---
      if (location.href.includes("mode=newtopic")) {
        const sendBtn = f.querySelector('input[type="submit"], button[type="submit"], input[name="post"]');
        if (sendBtn) {
          // 🧩 capture avant que la page quitte
          sendBtn.addEventListener("mousedown", () => {
            try {
              const fid = f.querySelector("input[name='f']")?.value || location.pathname;
              const data = { t: Date.now(), newTopic: true, fid };
              sessionStorage.setItem("ecoJustPosted", JSON.stringify(data));
              console.log("[EcoV2] 🖱️ mousedown enregistré avant envoi :", data);
            } catch (e) {
              console.error("[EcoV2] newtopic mousedown error", e);
            }
          });

          // 🔹 Sécurité ultime : beforeunload si le navigateur le permet
          window.addEventListener("beforeunload", () => {
            try {
              const fid = f.querySelector("input[name='f']")?.value || location.pathname;
              const data = { t: Date.now(), newTopic: true, fid };
              sessionStorage.setItem("ecoJustPosted", JSON.stringify(data));
              console.log("[EcoV2] 💾 beforeunload newtopic enregistré (fallback):", data);
            } catch (e) {
              console.error("[EcoV2] beforeunload newtopic error", e);
            }
          });
        }
      }
    });
  }

  // Installer les écouteurs AU CHARGEMENT, après un petit délai (FA injecte parfois tard)
  window.addEventListener("load", () => {
    setTimeout(() => { ecoAttachPostListeners(); }, 1500);
  });

  // Relance légère si rien n’a été intercepté
  setTimeout(() => {
    if (!sessionStorage.getItem("ecoJustPosted")) ecoAttachPostListeners();
  }, 3000);

  // Fallback ultime : avant de quitter la page de création de sujet
  if (location.href.includes("/post") && location.href.includes("mode=newtopic")) {
    window.addEventListener("beforeunload", () => {
      try {
        const fInput = document.querySelector('input[name="f"]');
        const fid = fInput ? fInput.value : location.pathname;
        const data = { t: Date.now(), newTopic: true, fid };
        sessionStorage.setItem("ecoJustPosted", JSON.stringify(data));
      } catch (e) { console.error("[EcoV2] beforeunload error", e); }
    });
  }

  // --- VÉRIFICATION APRÈS REDIRECTION ---
// --- VÉRIFICATION APRÈS REDIRECTION (écriture atomique par sous-chemins) ---
  async function ecoCheckPostGain(info) {
    try {
      const s = info || JSON.parse(sessionStorage.getItem("ecoJustPosted") || "null");
      if (!s) return;

      if (s.mode === "editpost" || s.mode === "delete") {
        console.log("[EcoV2][GAIN] Action ignorée (", s.mode, ") — aucun gain.");
        sessionStorage.removeItem("ecoJustPosted");
        return;
      }

      const pseudo = getPseudo();
      if (!pseudo) return;

      const href = location.href.toLowerCase();
      const isPreview = href.includes("/post") && !href.includes("mode=newtopic") && !href.includes("mode=reply");
      const isEdit = href.includes("mode=editpost");
      const isDelete = href.includes("mode=delete");
      if (isPreview || isEdit || isDelete) {
        const reason = isPreview ? "prévisualisation" : isEdit ? "édition" : "suppression";
        console.log(`[EcoV2][GAIN] Action ignorée (${reason}) — aucun gain.`);
        sessionStorage.removeItem("ecoJustPosted");
        return;
      }

      // attendre la breadcrumb (max 2s)
      await new Promise(resolve => {
        if (document.querySelector(".sub-header-path")) return resolve();
        const obs = new MutationObserver(() => {
          if (document.querySelector(".sub-header-path")) { obs.disconnect(); resolve(); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { obs.disconnect(); resolve(); }, 2000);
      });

      const record = await safeReadBin();
      if (!record) return;
      const membres = record.membres || {};
      if (!membres[pseudo]) return;

      // ====== ACCUMULATEURS (rien n'est écrit avant la fin) ======
      const P          = encodeURIComponent(pseudo);  // segment d'URL ; FA décode -> clé brute
      let   deltaDollars = 0;                          // somme à appliquer en UNE transaction
      let   nouveauPalier = null;                      // seuil de message à enregistrer, si franchi
      const journaux   = [];                           // [ [noeud, entrée], … ] -> push (POST)

      // ---- Détermination du chemin forum ----
      let path = "";
      const bc = document.querySelector(".sub-header-path");
      if (bc) {
        const links = Array.from(bc.querySelectorAll('a[href*="/f"]'));
        const last = links.pop();
        if (last) path = last.getAttribute("href").toLowerCase();
      }
      if (!path && s.fid) {
        path = String(s.fid).toLowerCase();
        if (/^\d+$/.test(path)) path = `/f${path}`;
      }
      if (!path) path = location.pathname.toLowerCase();

      const dansRP = RP_ZONES.some(z => path.includes(z));

      // ---- isNew ----
      let isNew = false;
      if (s.mode === "newtopic" || s.newTopic) isNew = true;
      if (s.mode === "editpost" || s.mode === "delete") isNew = false;

      // ---- GAIN DE BASE PAR ZONE ----
      let gain = 0;
      if (path.includes(FORUM_IDS.presentations)) {
        gain = isNew ? GAIN_RULES.presentation_new : GAIN_RULES.presentation_reply;
      } else if (path.includes(FORUM_IDS.preliens) || path.includes(FORUM_IDS.gestionPersos) || path.includes(FORUM_IDS.journalPersos)) {
        gain = isNew ? GAIN_RULES.preliens_or_gestion_new : GAIN_RULES.preliens_or_gestion_reply;
      } else if (dansRP) {
        gain = isNew ? GAIN_RULES.houma_terrebonne_new : GAIN_RULES.houma_terrebonne_reply;
      } else if (location.pathname.includes(FORUM_IDS.voteTopicName)) {
        if (!isNew) gain = GAIN_RULES.vote_topic_reply;
      }
      console.log("[EcoV2][gain-check] path=", path, "isNew=", isNew, "gain=", gain);

      // ---- BONUS TAGS ----
      try {
        const posts = Array.from(document.querySelectorAll(".sj-postmsg, .sj-post-msg"));
        if (posts.length > 0) {
          const clone = posts[posts.length - 1].cloneNode(true);
          clone.querySelectorAll("blockquote, cite").forEach(el => el.remove());
          const text = clone.textContent.toLowerCase();
          let tagBonus = 0;
          for (const [tag, bonus] of Object.entries(TAG_BONUS)) {
            if (text.includes(tag)) {
              tagBonus += bonus;
              console.log(`[EcoV2][TAG BONUS] ${tag} détecté → +${bonus}`);
              journaux.push(["tags_usage", { date: new Date().toISOString(), membre: pseudo, tag, montant: bonus, url: location.href }]);
            }
          }
          if (tagBonus > 0) { gain += tagBonus; console.log(`[EcoV2][TAG BONUS] total +${tagBonus}, gain ${gain}`); }
          else console.log("[EcoV2][TAG BONUS] aucun tag valide.");
        } else console.log("[EcoV2][TAG BONUS] aucun message trouvé.");
      } catch (e) { console.warn("[EcoV2] erreur tags", e); }

      // ---- BONUS RÉACTIVITÉ (RP) ----
      try {
        if (dansRP) {
          await new Promise(resolve => {
            let tries = 0;
            const iv = setInterval(() => {
              const p = document.querySelectorAll(".post, .sj-postmsg");
              if (p.length >= 2 || tries++ > 20) { clearInterval(iv); resolve(); }
            }, 200);
          });
          const posts = Array.from(document.querySelectorAll(".post, .sj-postmsg"));
          if (posts.length >= 2) {
            const prevPost = posts[posts.length - 2];
            const dateEl = prevPost.querySelector(".sj-post-date span:last-child");
            if (dateEl) {
              const rawText = dateEl.textContent.trim();
              const now = new Date();
              let prevDate = null;
              const matchHour = rawText.match(/(\d{1,2}):(\d{2})/);
              if (/Aujourd/i.test(rawText)) {
                prevDate = new Date(now);
                if (matchHour) prevDate.setHours(parseInt(matchHour[1]), parseInt(matchHour[2]), 0, 0);
              } else if (/Hier/i.test(rawText)) {
                prevDate = new Date(now); prevDate.setDate(now.getDate() - 1);
                if (matchHour) prevDate.setHours(parseInt(matchHour[1]), parseInt(matchHour[2]), 0, 0);
              } else {
                const clean = rawText.replace(/à/g, "").replace(/[-–]/g, " ").replace(/\s{2,}/g, " ").trim();
                prevDate = new Date(clean);
              }
              if (prevDate && !isNaN(prevDate)) {
                const hoursDiff = (Date.now() - prevDate.getTime()) / 36e5;
                let reactivityBonus = 0;
                if (hoursDiff < 24) reactivityBonus = 10;
                else if (hoursDiff < 48) reactivityBonus = 5;
                if (reactivityBonus > 0) { gain += reactivityBonus; console.log(`[EcoV2][BONUS RP] ${hoursDiff.toFixed(1)}h → +${reactivityBonus}`); }
              }
            }
          }
        }
      } catch (e) { console.warn("[EcoV2][BONUS RP] erreur", e); }

      // ---- BONUS LONGUEUR (RP) ----
      try {
        if (dansRP) {
          await new Promise(resolve => {
            let tries = 0;
            const iv = setInterval(() => {
              const p = document.querySelectorAll(".sj-postmsg, .sj-post-msg, .postbody, .content-message");
              if (p.length > 0 || tries++ > 20) { clearInterval(iv); resolve(); }
            }, 200);
          });
          const postBodies = Array.from(document.querySelectorAll(".sj-postmsg, .sj-post-msg, .postbody, .content-message"));
          if (postBodies.length > 0) {
            const wordCount = countWordsFromElement(postBodies[postBodies.length - 1]);
            const lengthBonus = getWordCountBonus(wordCount);
            console.log(`[EcoV2][BONUS LONGUEUR] ${wordCount} mots`);
            if (lengthBonus > 0) { gain += lengthBonus; console.log(`[EcoV2][BONUS LONGUEUR] +${lengthBonus}`); }
            journaux.push(["rewards_wordcount", { date: new Date().toISOString(), membre: pseudo, mots: wordCount, montant: lengthBonus, url: location.href }]);
          }
        }
      } catch (e) { console.warn("[EcoV2][BONUS LONGUEUR] erreur", e); }

      // ---- PALIERS DE MESSAGES ----
      try {
        const msgCount = getMessagesCount();
        const lastAward = membres[pseudo].lastMessageThresholdAwarded || 0;
        const MESSAGE_REWARDS = [
          { threshold: 100, reward: 5 }, { threshold: 500, reward: 10 }, { threshold: 1000, reward: 15 },
          { threshold: 1500, reward: 20 }, { threshold: 2000, reward: 25 }, { threshold: 3000, reward: 30 },
          { threshold: 4000, reward: 40 }, { threshold: 5000, reward: 50 }, { threshold: 6000, reward: 60 },
          { threshold: 7000, reward: 70 }, { threshold: 8000, reward: 80 }, { threshold: 9000, reward: 90 },
          { threshold: 10000, reward: 100 }
        ];
        const nextReward = MESSAGE_REWARDS.find(r => msgCount >= r.threshold && r.threshold > lastAward);
        if (nextReward) {
          deltaDollars += nextReward.reward;
          nouveauPalier = nextReward.threshold;
          console.log(`[EcoV2][PALIER] ${pseudo} → ${nextReward.threshold} msg → +${nextReward.reward}$`);
          journaux.push(["rewards_messages", { date: new Date().toISOString(), membre: pseudo, palier: nextReward.threshold, montant: nextReward.reward }]);
          showEcoGain(nextReward.reward);
        }
      } catch (e) { console.warn("[EcoV2] erreur paliers", e); }

      // ---- Appliquer le gain de post ----
      if (gain > 0) {
        deltaDollars += gain;
        showEcoGain(gain);
        console.log(`[EcoV2] 💰 +${gain} ${window.EcoCore.MONNAIE_NAME} pour ${pseudo}`);
      }

      // ====== ÉCRITURES CIBLÉES (chemins disjoints entre membres) ======
      const ecritures = [];

      // dollars : transaction atomique (palier + gain combinés)
      if (deltaDollars !== 0) {
        ecritures.push(
          window.EcoCore.firebaseTransaction(
            "membres/" + P + "/dollars",
            cur => Math.max(0, (cur || 0) + deltaDollars)
          )
        );
        // affichage optimiste immédiat (le serveur calculera la même valeur)
        const soldeAffiche = (membres[pseudo].dollars || 0) + deltaDollars;
        const el1 = document.getElementById("sj-dollars");           if (el1) el1.textContent = soldeAffiche;
        const el2 = document.querySelector(".field-dollars span:not(.label)"); if (el2) el2.textContent = soldeAffiche;
      }

      // compteur de messages FA
      ecritures.push(window.EcoCore.writeField("membres/" + P + "/messages", getMessagesCount()));

      // seuil de palier (si franchi)
      if (nouveauPalier !== null) {
        ecritures.push(window.EcoCore.writeField("membres/" + P + "/lastMessageThresholdAwarded", nouveauPalier));
      }

      // recensement RP mensuel
      if (dansRP) {
        const moisCle = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
        ecritures.push(
          window.EcoCore.firebaseTransaction(
            "membres/" + P + "/rp_par_mois/" + moisCle,
            cur => (cur || 0) + 1
          )
        );
        ecritures.push(window.EcoCore.writeField("membres/" + P + "/dernier_rp", new Date().toISOString()));
      }

      // journaux (append concurrent-safe)
      journaux.forEach(([noeud, data]) => ecritures.push(window.EcoCore.firebasePush(noeud, data)));

      // tout en parallèle ; un échec isolé n'annule pas les autres
      try {
        await Promise.all(ecritures.map(p => p.catch(e => warn("écriture gain", e))));
        log("Gains écrits (ciblé/atomique).");
      } catch (e) { err("écriture gains", e); }

      // cache local invalidé pour refléter les nouvelles valeurs
      sessionStorage.removeItem("eco_cache_record");
      sessionStorage.removeItem("eco_cache_time");
      updatePostDollars();

      // mise à jour visuelle dès que le nouveau post apparaît
      try {
        const observer = new MutationObserver((m, obs) => {
          if (document.querySelectorAll(".sj-post-proftop, .post, .postprofile").length > 0) {
            obs.disconnect();
            console.log("[EcoV2][DOM] Nouveau post → màj dollars");
            updatePostDollars();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) { console.warn("[EcoV2] échec observation DOM", e); }

    } catch (e) {
      err("ecoCheckPostGain", e);
    }
  }

  // --- POST-DELAY (après redirection Forumactif) ---
  window.addEventListener("load", () => {
    setTimeout(async () => {
      const s = sessionStorage.getItem("ecoJustPosted");
      if (!s) return;
      const data = JSON.parse(s);
      const age = Date.now() - data.t;
      if (age > 30000) return sessionStorage.removeItem("ecoJustPosted");
      await ecoCheckPostGain(data);
      sessionStorage.removeItem("ecoJustPosted");
    }, 3500);
  });

  // ---------- FALLBACK GLOBAL (intercepte TOUS les posts avant envoi) ----------
  document.addEventListener("submit", e => {
    try {
      const form = e.target;
      if (!form || !form.action) return;
      if (!form.action.includes("/post")) return; // seulement les formulaires de post Forumactif

      // Détecter le mode depuis l'URL ou un input caché
      const urlObj = new URL(form.action, location.origin);
      const mode = (urlObj.searchParams.get("mode") || form.querySelector('input[name="mode"]')?.value || "").toLowerCase();

      // ❌ Ignorer édition / suppression
      if (mode === "editpost" || mode === "delete") {
        sessionStorage.removeItem("ecoJustPosted");
        console.log("[EcoV2][GLOBAL-FALLBACK] submit ignoré (", mode, ") — aucun gain.");
        return;
      }

      const isNewTopic = !!form.querySelector("input[name='subject']");
      let fid = form.querySelector("input[name='f']")?.value || location.pathname;

      const data = { t: Date.now(), newTopic: isNewTopic, fid, mode };
      sessionStorage.setItem("ecoJustPosted", JSON.stringify(data));
      console.log("[EcoV2][GLOBAL-FALLBACK] 💾 Post intercepté juste avant envoi :", data);
    } catch (err) {
      console.error("[EcoV2][GLOBAL-FALLBACK] erreur interception submit", err);
    }
  }, true);

})();
