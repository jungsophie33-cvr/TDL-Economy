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
    preliens_or_gestion_reply: 2,
    houma_terrebonne_new: 15,
    houma_terrebonne_reply: 10,
    vote_topic_reply: 2
  };

  // ---------- BONUS PAR TAGS ----------
  const TAG_BONUS = {
    "#intrigue": 10,
    "#event": 5,
    "#enquete": 5,
    "#solve": 20,
    "#defi": 5,
    "#mintrigue": 5
  };

  const FORUM_IDS = {
    presentations: "/f5-presentations",
    preliens: "/f4-en-construction",
    gestionPersos: "/f6-gestion-des-personnages",
    voteTopicName: "/t22-vote-aux-top-sites"
  };

  const RP_ZONES = [
    "/f7-les-bayous-sauvages",
    "/f8-downtown-houma",
    "/f9-bayou-cane",
    "/f10-bayou-blue",
    "/f11-mandalay-national-wildlife-refuge",
    "/f12-terrebonne-bay"
  ];

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
  async function ecoCheckPostGain(info) {
    try {
      const s = info || JSON.parse(sessionStorage.getItem("ecoJustPosted") || "null");
      if (!s) return;

      // 🚫 Sécurité : si le submit provenait d'une édition ou d'une suppression, on n'attribue rien
      if (s.mode === "editpost" || s.mode === "delete") {
        console.log("[EcoV2][GAIN] Action ignorée (", s.mode, ") — aucun gain attribué.");
        sessionStorage.removeItem("ecoJustPosted");
        return;
      }

      const pseudo = getPseudo();
      if (!pseudo) return;

      // --- Ignorer toute page /post non liée à un envoi réel ---
      const href = location.href.toLowerCase();

      // Liste des cas où il NE FAUT PAS donner de gain
      const isPreview = href.includes("/post") && !href.includes("mode=newtopic") && !href.includes("mode=reply");
      const isEdit = href.includes("mode=editpost");
      const isDelete = href.includes("mode=delete");

      // 🧩 Si on est dans l'un de ces cas, on sort immédiatement
      if (isPreview || isEdit || isDelete) {
        const reason = isPreview ? "prévisualisation" : isEdit ? "édition" : "suppression";
        console.log(`[EcoV2][GAIN] Action ignorée (${reason}) — aucun gain attribué.`);
        sessionStorage.removeItem("ecoJustPosted"); // Nettoyage pour éviter les confusions
        return;
      }

      // 🕐 Attendre que la breadcrumb soit chargée (max 2s)
      await new Promise(resolve => {
        // Si la breadcrumb est déjà là → on continue direct
        if (document.querySelector(".sub-header-path")) return resolve();

        // Sinon on observe le DOM jusqu’à ce qu’elle apparaisse
        const obs = new MutationObserver(() => {
          if (document.querySelector(".sub-header-path")) {
            obs.disconnect();
            resolve();
          }
        });

        obs.observe(document.body, { childList: true, subtree: true });

        // Sécurité : si après 2 secondes elle n'est toujours pas là, on avance quand même
        setTimeout(() => {
          obs.disconnect();
          resolve();
        }, 2000);
      });

      const record = await safeReadBin();

      if (!record) return;
      const membres = record.membres || {};
      if (!membres[pseudo]) return;

      // 1) essayer de récupérer le forum complet depuis la breadcrumb
      let path = "";
      const bc = document.querySelector(".sub-header-path");
      if (bc) {
        const links = Array.from(bc.querySelectorAll('a[href*="/f"]'));
        const last = links.pop();
        if (last) path = last.getAttribute("href").toLowerCase(); // ex: /f8-downtown-houma
      }

      // 2) sinon : ce qu'on a sauvegardé avant envoi
      if (!path && s.fid) {
        path = String(s.fid).toLowerCase();
        // si c'est un numéro, on reconstruit /f8 (mieux que rien)
        if (/^\d+$/.test(path)) path = `/f${path}`;
      }

      // 3) fallback ultime : URL courante (souvent /t... donc peu utile)
      if (!path) path = location.pathname.toLowerCase();

      // --- Détermination fiable de isNew ---
      let isNew = false;

      // Si l’action d’origine ou le flag stocké en session indique une création, on le garde
      if (s.mode === "newtopic" || s.newTopic) {
        isNew = true;
      }

      // sécurité additionnelle : si on est clairement en édition/suppression, on force à false
      if (s.mode === "editpost" || s.mode === "delete") {
        isNew = false;
      }
      let gain = 0;

      // --- DÉTERMINATION DU GAIN SELON LA ZONE ---
      if (path.includes(FORUM_IDS.presentations)) {
        gain = isNew ? GAIN_RULES.presentation_new : GAIN_RULES.presentation_reply;
      }
      else if (path.includes(FORUM_IDS.preliens) || path.includes(FORUM_IDS.gestionPersos)) {
        gain = isNew ? GAIN_RULES.preliens_or_gestion_new : GAIN_RULES.preliens_or_gestion_reply;
      }
      else if (RP_ZONES.some(z => path.includes(z))) {
        gain = isNew ? GAIN_RULES.houma_terrebonne_new : GAIN_RULES.houma_terrebonne_reply;
      }
      else if (location.pathname.includes(FORUM_IDS.voteTopicName)) {
      // 💡 votes aux top-sites → uniquement pour les réponses (pas de nouveau sujet)
        if (!isNew) gain = GAIN_RULES.vote_topic_reply;
      }

      console.log("[EcoV2][gain-check] path=", path, "isNew=", isNew, "gain=", gain);

      // --- BONUS TAGS (ignore les citations ModernBB) ---
      try {
        const posts = Array.from(document.querySelectorAll(".sj-postmsg, .sj-post-msg"));
        if (posts.length > 0) {
          const lastPost = posts[posts.length - 1];

          // 🧩 On clone pour travailler sans toucher au DOM
          const clone = lastPost.cloneNode(true);

          // 🚫 Supprime les citations (ModernBB utilise <blockquote><cite>…</cite>)
          clone.querySelectorAll("blockquote, cite").forEach(el => el.remove());

          // 🧹 Texte propre du message (sans HTML ni citation)
          const text = clone.textContent.toLowerCase();

          let tagBonus = 0;
          for (const [tag, bonus] of Object.entries(TAG_BONUS)) {
            if (text.includes(tag)) {
                tagBonus += bonus;
                console.log(`[EcoV2][TAG BONUS] ${tag} détecté → +${bonus}`);

                // 🧾 Journal des tags utilisés
            if (!record.tags_usage) record.tags_usage = [];
              record.tags_usage.push({
              date: new Date().toISOString(),
              membre: pseudo,
              tag,
              montant: bonus,
              url: location.href
            });
          }
        }
          
          if (tagBonus > 0) {
            gain += tagBonus;
            console.log(`[EcoV2][TAG BONUS] total ajouté = +${tagBonus}, gain total = ${gain}`);
          } else {
            console.log("[EcoV2][TAG BONUS] aucun tag valide trouvé dans le message.");
          }
        } else {
          console.log("[EcoV2][TAG BONUS] aucun message trouvé pour analyse.");
        }
      } catch (e) {
        console.warn("[EcoV2] erreur détection tags", e);
      }

      // --- BONUS DE RÉACTIVITÉ (RP) ---
      try {
        if (RP_ZONES.some(z => path.includes(z))) {
          // attendre que les posts soient bien dans le DOM
          await new Promise(resolve => {
            let tries = 0;
            const iv = setInterval(() => {
              const posts = document.querySelectorAll(".post, .sj-postmsg");
              if (posts.length >= 2 || tries++ > 20) {
                clearInterval(iv);
                resolve();
              }
            }, 200);
          });

          const posts = Array.from(document.querySelectorAll(".post, .sj-postmsg"));
          if (posts.length >= 2) {
            const prevPost = posts[posts.length - 2];
            const dateEl = prevPost.querySelector(".sj-post-date span:last-child");
            if (!dateEl) {
              console.warn("[EcoV2][BONUS RP] ⚠️ Aucun élément .sj-post-date trouvé !");
            } else {
              const rawText = dateEl.textContent.trim();
              console.log("[EcoV2][BONUS RP] Texte trouvé :", rawText);

              const now = new Date();
              let prevDate = null;
              const matchHour = rawText.match(/(\d{1,2}):(\d{2})/);

              if (/Aujourd/i.test(rawText)) {
                prevDate = new Date(now);
                if (matchHour)
                  prevDate.setHours(parseInt(matchHour[1]), parseInt(matchHour[2]), 0, 0);
              } else if (/Hier/i.test(rawText)) {
                prevDate = new Date(now);
                prevDate.setDate(now.getDate() - 1);
                if (matchHour)
                  prevDate.setHours(parseInt(matchHour[1]), parseInt(matchHour[2]), 0, 0);
              } else {
                const clean = rawText
                  .replace(/à/g, "")
                  .replace(/[-–]/g, " ")
                  .replace(/\s{2,}/g, " ")
                  .trim();
                prevDate = new Date(clean);
              }

              console.log("[EcoV2][BONUS RP] Date interprétée :", prevDate);

              if (prevDate && !isNaN(prevDate)) {
                const hoursDiff = (Date.now() - prevDate.getTime()) / 36e5;
                let reactivityBonus = 0;
                if (hoursDiff < 24) reactivityBonus = 10;
                else if (hoursDiff < 48) reactivityBonus = 5;

                if (reactivityBonus > 0) {
                  gain += reactivityBonus;
                  console.log(`[EcoV2][BONUS RP] Réponse ${hoursDiff.toFixed(1)}h après → +${reactivityBonus}`);
                } else {
                  console.log(`[EcoV2][BONUS RP] Délai ${hoursDiff.toFixed(1)}h → aucun bonus`);
                }
              } else {
                console.warn("[EcoV2][BONUS RP] ⚠️ Date invalide :", rawText);
              }
            }
          } else {
            console.warn("[EcoV2][BONUS RP] Pas assez de messages détectés :", posts.length);
          }
        }
      } catch (e) {
        console.warn("[EcoV2][BONUS RP] erreur :", e);
      }

      // --- BONUS PALIERS DE MESSAGES ---
      try {
        const msgCount = getMessagesCount();
        const user = membres[pseudo];
        const lastAward = user.lastMessageThresholdAwarded || 0;

        // 🎯 Liste des paliers et des récompenses associées
        const MESSAGE_REWARDS = [
          { threshold: 100, reward: 5 },
          { threshold: 500, reward: 10 },
          { threshold: 1000, reward: 15 },
          { threshold: 1500, reward: 20 },
          { threshold: 2000, reward: 25 },
          { threshold: 3000, reward: 30 },
          { threshold: 4000, reward: 40 },
          { threshold: 5000, reward: 50 },
          { threshold: 6000, reward: 60 },
          { threshold: 7000, reward: 70 },
          { threshold: 8000, reward: 80 },
          { threshold: 9000, reward: 90 },
          { threshold: 10000, reward: 100 }
        ];

        // 🔎 Vérifie si un nouveau palier est atteint
        const nextReward = MESSAGE_REWARDS.find(r => msgCount >= r.threshold && r.threshold > lastAward);
        if (nextReward) {
          membres[pseudo].dollars = (membres[pseudo].dollars || 0) + nextReward.reward;
          user.lastMessageThresholdAwarded = nextReward.threshold;
          console.log(`[EcoV2][PALIER] ${pseudo} a atteint ${nextReward.threshold} messages → +${nextReward.reward}$`);

          // 🧾 Journal des récompenses de palier
          if (!record.rewards_messages) record.rewards_messages = [];
          record.rewards_messages.push({
            date: new Date().toISOString(),
            membre: pseudo,
            palier: nextReward.threshold,
            montant: nextReward.reward
          });

          showEcoGain(nextReward.reward);
        }
      } catch (e) {
        console.warn("[EcoV2] erreur bonus paliers messages", e);
      }

      // 🔁 mise à jour du compteur de messages FA
      membres[pseudo].messages = getMessagesCount();

      // 💰 appliquer le gain si applicable
      if (gain > 0) {
        membres[pseudo].dollars = (membres[pseudo].dollars || 0) + gain;

        // 🧾 Mise à jour visuelle immédiate
        const el1 = document.getElementById("sj-dollars");
        if (el1) el1.textContent = membres[pseudo].dollars;

        const el2 = document.querySelector(".field-dollars span:not(.label)");
        if (el2) el2.textContent = membres[pseudo].dollars;

        showEcoGain(gain);
        updatePostDollars();
        console.log(`[EcoV2] 💰 +${gain} ${window.EcoCore.MONNAIE_NAME} pour ${pseudo}`);
      }

// ✍️ Écriture unique dans le JSON (gain, compteur, paliers, etc.)
await writeBin(record);

// 🧹 Nettoyage du cache local (sinon affichera ancienne valeur)
sessionStorage.removeItem("eco_cache_record");
sessionStorage.removeItem("eco_cache_time");

// --- OBSERVATION DOM : met à jour le dollar visuel dès que le nouveau post apparaît ---
try {
  const observer = new MutationObserver((mutations, obs) => {
    if (document.querySelectorAll(".sj-post-proftop, .post, .postprofile").length > 0) {
      obs.disconnect();
      console.log("[EcoV2][DOM] Nouveau post détecté → mise à jour des dollars");
      updatePostDollars();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
} catch (e) {
  console.warn("[EcoV2] échec de l'observation DOM pour updatePostDollars :", e);
}

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
