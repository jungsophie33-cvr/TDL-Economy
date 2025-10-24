// === ECONOMIE V2 – ModernBB (version stable) ===
// Auteur : ChatGPT x THE DROWNED LANDS
console.log("[EcoV2] >>> début du script");
(function(){

  // ---------- CONFIG ----------
  const BIN_ID = "68f92d16d0ea881f40b3f36f";
  const API_KEY = "$2a$10$yVl9vTE.d/B4Hbmu8n6pyeHDM9PgPVHCBryetKJ3.wLHr7wa6ivyq";
  const JSONBIN_PROXY_BASE = "https://corsproxy.io/?url=https://api.jsonbin.io/v3/b/";
  const ADMIN_USERS = ["Mami Wata", "Jason Blackford"];
  const GROUPS = ["Les Goulipiats","Les Fardoches","Les Ashlanders","Les Spectres","Les Perles"];
  const DEFAULT_DOLLARS = 10;
  const MONNAIE_NAME = "Dollars";
  const MENU_SELECTOR = "body #sj-main .menu .sj-menu-top";
  const RETRY_INTERVAL_MS = 500;
  const RETRY_MAX = 20;

  // ---------- Logs ----------
  window.addEventListener("error", e => console.error("[EcoV2] onerror:", e.error || e.message, e));
  window.addEventListener("unhandledrejection", e => console.error("[EcoV2] unhandled:", e.reason));
  function log(...a){try{console.log("[EcoV2]",...a);}catch(e){}}
  function warn(...a){try{console.warn("[EcoV2]",...a);}catch(e){}}
  function err(...a){try{console.error("[EcoV2]",...a);}catch(e){}}
  // ---------- VISITEUR ----------
  if(typeof _userdata==="undefined"||!_userdata||_userdata.user_id==-1||_userdata.username==="anonymous"){
  console.log("[EcoV2] invité lecture seule");
  (async()=>{
    try{
      const r=await fetch(`${JSONBIN_PROXY_BASE}${BIN_ID}/latest`,{headers:{"X-Master-Key":API_KEY}});
      if(!r.ok) return console.warn("[EcoV2] échec lecture JSONBin invité");
      const j=await r.json();const record=j.record||{};
      const membres=record.membres||{};
      // --- MàJ dollars dans les posts ---
        document.querySelectorAll(".sj-post-proftop,.post,.postprofile").forEach(post=>{
          const pseudoEl = post.querySelector(".sj-post-pseudo strong,.postprofile-name strong,.username");
          if(!pseudoEl) return;
          const pseudo = pseudoEl.textContent.trim();
          const user = membres[pseudo]; if(!user) return;
          const val = post.querySelector(".field-dollars span:not(.label)");
          if(val) val.textContent = user.dollars ?? 0;
        });
        // --- MàJ cagnottes ---
        if(record.cagnottes){
          Object.entries(record.cagnottes).forEach(([g,v])=>{
            const el = document.getElementById(`eco-cag-${g.replace(/\s/g,"_")}`);
            if(el) el.textContent = v;
          });
        }
      }catch(e){console.warn("[EcoV2] erreur affichage invité",e);}
    })();
    // on ne continue PAS le reste du script
    return;
  }
  
 // ---------- JSONBin helpers (version robuste avec retry & gestion CORS) ----------
async function readBin(retries = 3) {
  const url = `${JSONBIN_PROXY_BASE}${BIN_ID}/latest`;

  for (let i = 0; i < retries; i++) {
    try {
      await new Promise(r => setTimeout(r, 1500));
      const r = await fetch(url, {
        method: "GET",
        headers: {
          "X-Master-Key": API_KEY
        }
      });

      if (r.ok) {
        const j = await r.json();
        return j.record || {};
      }

      // Si serveur encore occupé ou erreur temporaire
      if ([425, 429, 500, 502, 503].includes(r.status)) {
        console.warn(`[EcoV2] readBin tentative ${i + 1}/${retries} échouée (${r.status}), nouvelle tentative dans 1s...`);
        await new Promise(res => setTimeout(res, 1000));
        continue;
      }
      break;

    } catch (e) {
      console.warn(`[EcoV2] readBin tentative ${i + 1}/${retries} erreur réseau, retry...`, e);
      await new Promise(res => setTimeout(res, 1000));
    }
  }

  err("readBin", "Échec après plusieurs tentatives");
  return null;
}

async function writeBin(record, retries = 3) {
  const url = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

  for (let i = 0; i < retries; i++) {
    try {
      await new Promise(r => setTimeout(r, 1500));
      const r = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": API_KEY,
          "X-Bin-Versioning": "false"
        },
        body: JSON.stringify(record)
      });

      if (r.ok) {
        log(`[EcoV2] writeBin succès (tentative ${i + 1})`);
        return await r.json();
      }

      if ([425, 429, 500, 502, 503].includes(r.status)) {
        console.warn(`[EcoV2] writeBin tentative ${i + 1}/${retries} échouée (${r.status}), retry dans 1s...`);
        await new Promise(res => setTimeout(res, 1000));
        continue;
      }

      throw new Error(`writeBin status ${r.status}`);

    } catch (e) {
      console.warn(`[EcoV2] writeBin tentative ${i + 1}/${retries} erreur, retry...`, e);
      await new Promise(res => setTimeout(res, 1000));
    }
  }

  err("writeBin", "Échec après plusieurs tentatives");
}

  // ---------- Extractors ----------
  function getPseudo(){ try{ return _userdata?.username?.trim() || null; }catch(e){ return null; } }
  function getUserId(){ try{ return parseInt(_userdata?.user_id) || 0; }catch(e){ return 0; } }
  function getMessagesCount(){ try{ return parseInt(_userdata?.user_posts) || 0; }catch(e){ return 0; } }
  async function fetchUserGroupFromProfile(id){
    if(!id) return null;
    try{
      const r = await fetch(`/u${id}`); if(!r.ok) return null;
      const html = await r.text(); const d = document.createElement("div"); d.innerHTML = html;
      const dd = d.querySelector("dd,.usergroup,.group,.user-level");
      if(dd && dd.textContent.trim()) return dd.textContent.trim();
      const m = html.match(/(Les [A-ZÀ-Ÿa-zà-ÿ0-9_\- ]{2,40})/);
      return m ? m[1].trim() : null;
    }catch(e){ err("fetchUserGroup", e); return null; }
  }
  
  // ---------- DOM helpers ----------
  function insertAfter(t,e){ if(!t||!t.parentNode) return false; t.parentNode.insertBefore(e,t.nextSibling); return true; }
  function createErrorBanner(m){ const b=document.createElement("div"); b.style.cssText="background:#ffdede;color:#600;border:2px solid #f99;padding:8px;text-align:center;margin:6px;"; b.textContent=m; return b; }

  // ---------- UPDATE DOLLARS DANS LES POSTS ----------
  async function updatePostDollars(){
    try{
      const record = await readBin(); if(!record || !record.membres) return;
      document.querySelectorAll(".sj-post-proftop,.post,.postprofile").forEach(post=>{
        const pseudoEl = post.querySelector(".sj-post-pseudo strong,.postprofile-name strong,.username");
        if(!pseudoEl) return;
        const pseudo = pseudoEl.textContent.trim();
        const user = record.membres[pseudo]; if(!user) return;
        const val = post.querySelector(".field-dollars span:not(.label)");
        if(val) val.textContent = user.dollars ?? 0;
      });
      log("Màj champs dollars terminée");
    }catch(e){ err("updatePostDollars", e); }
  }

  // ---------- CORE INIT ----------
  async function coreInit(){
    log("Initialisation...");
    const menu = document.querySelector(MENU_SELECTOR);
    if(!menu){ warn("Menu non trouvé"); return; }

    const loading = document.createElement("div");
    loading.id = "eco-loading";
    loading.style.cssText = "background:#fffbe6;padding:6px;text-align:center;border:1px solid #ffecb3;margin-top:6px;";
    loading.textContent = "Initialisation économie…";
    insertAfter(menu, loading);

    const record = await readBin();
    if(!record){ loading.replaceWith(createErrorBanner("Erreur : lecture JSONBin impossible.")); return; }
    record.membres = record.membres || {};
    record.cagnottes = record.cagnottes || {};
    GROUPS.forEach(g=>{ if(record.cagnottes[g] === undefined) record.cagnottes[g] = 0; });
    record.boutique = record.boutique || {};

    const pseudo = getPseudo(), uid = getUserId();

    // protection invités / anonymous
    if (!pseudo || pseudo.toLowerCase() === "anonymous" || uid === -1) {
      loading.replaceWith(createErrorBanner("Les invités n'ont pas accès à l'économie."));
      console.warn("[EcoV2] Ignoré : utilisateur invité (anonymous)");
      return;
    }

    if(!record.membres[pseudo]){
      const g = await fetchUserGroupFromProfile(uid);
      record.membres[pseudo] = { dollars: DEFAULT_DOLLARS, messages: getMessagesCount(), group: g || null, lastMessageThresholdAwarded: 0 };
      await writeBin(record).catch(()=>null);
    }else{
      record.membres[pseudo].messages = getMessagesCount();
      if(!record.membres[pseudo].group){
        const g = await fetchUserGroupFromProfile(uid);
        if(g){ record.membres[pseudo].group = g; await writeBin(record).catch(()=>null); }
      }
    }

    try{
      const sj = document.querySelector("#sj-dollars");
      if(sj) sj.textContent = record.membres[pseudo].dollars;
    }catch(e){ err("sync sj-dollars", e); }

  try {
    GROUPS.forEach(g => {
      const el = document.getElementById(`eco-cag-${g.replace(/\s/g,"_")}`);
      if (el) el.textContent = record.cagnottes[g] || 0;
    });
  } catch (e) {
    err("update eco-solde-box", e);
  }

    // --- ADMIN BAR (pilotée par le template) ---
    const adminBar=document.getElementById("eco-admin-bar");
    const adminSection=document.getElementById("eco-admin-section");
    if(adminBar)adminBar.style.display="flex";
    if(adminSection){if(ADMIN_USERS.includes(pseudo))adminSection.style.display="flex";else adminSection.remove();}

    try{
      document.getElementById("eco-btn-cag")?.addEventListener("click", async()=>{
        const rec = await readBin(); alert("Cagnottes:\n"+JSON.stringify(rec.cagnottes,null,2));
      });
      document.getElementById("eco-btn-shop")?.addEventListener("click", async()=>{
        const rec = await readBin(); alert("Boutique:\n"+JSON.stringify(rec.boutique||{},null,2));
      });
      document.getElementById("eco-btn-don")?.addEventListener("click", async()=>{
  const montant = parseInt(prompt("Montant du don :", "0"));
  if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");

  const rec = await readBin();
  const grp = rec.membres[pseudo]?.group;
  if (!grp) return alert("Ton groupe est inconnu.");
  if ((rec.membres[pseudo]?.dollars || 0) < montant) return alert("Fonds insuffisants !");

  // 💰 Débit et ajout à la cagnotte
  rec.membres[pseudo].dollars -= montant;
  rec.cagnottes[grp] = (rec.cagnottes[grp] || 0) + montant;

  // 🧾 Journal du don
  if (!rec.donations) rec.donations = [];
  rec.donations.push({
    date: new Date().toISOString(),
    membre: pseudo,
    groupe: grp,
    montant
  });

  await writeBin(rec);

  alert("✅ Don effectué !");
  const el = document.querySelector("#sj-dollars");
  if (el) el.textContent = rec.membres[pseudo].dollars;
  const cag = document.getElementById(`eco-cag-${grp.replace(/\s/g,"_")}`);
  if (cag) cag.textContent = rec.cagnottes[grp];
});

    }catch(e){ err("adminBar", e); }

    // --- PANEL ADMIN ---
    const toggle = document.getElementById("eco-reset-toggle");
    if(toggle){
      toggle.addEventListener("click",()=>{
        const p = document.getElementById("eco-reset-panel");
        const opened = p.style.display === "block";
        p.style.display = opened ? "none" : "block";
        toggle.textContent = opened ? "▶ Réinitialisations" : "▼ Réinitialisations";
      });
    }

  async function populateSelects() {
  const rec = await readBin();
  if (!rec) return;

  // --- Membres ---
  const membres = Object.keys(rec.membres || {}).sort();
  const memberSelectIds = [
    "eco-member-select",
    "eco-adjust-member",
    "eco-transfer-from-member",
    "eco-transfer-to-member"
  ];

  memberSelectIds.forEach(id => {
    const sel = document.getElementById(id);
    if (sel) {
      sel.innerHTML = "";
      membres.forEach(n => {
        const o = document.createElement("option");
        o.value = n;
        o.textContent = n;
        sel.appendChild(o);
      });
    }
  });

  // --- Cagnottes ---
  const groupes = Object.keys(rec.cagnottes || {});
  const cagnotteSelectIds = [
    "eco-cag-select",
    "eco-transfer-from",
    "eco-transfer-to"
  ];

  cagnotteSelectIds.forEach(id => {
    const sel = document.getElementById(id);
    if (sel) {
      sel.innerHTML = "";
      groupes.forEach(g => {
        const o = document.createElement("option");
        o.value = g;
        o.textContent = g;
        sel.appendChild(o);
      });
    }
  });
}
    // --- AJUSTEMENT D’UN SOLDE MEMBRE ---
const adjustBtn = document.getElementById("eco-adjust-btn");
if (adjustBtn) {
  adjustBtn.addEventListener("click", async () => {
    const msel = document.getElementById("eco-adjust-member");
    const valInput = document.getElementById("eco-adjust-amount");
    const membre = msel?.value;
    const montant = parseInt(valInput?.value, 10);

    if (!membre) return alert("Aucun membre sélectionné !");
    if (isNaN(montant) || montant === 0) return alert("Montant invalide.");

    if (!confirm(`${montant > 0 ? "Ajouter" : "Retirer"} ${Math.abs(montant)} Dollars à ${membre} ?`))
      return;

    const rec = await readBin();
    if (!rec.membres[membre]) return alert("Membre inconnu !");
    rec.membres[membre].dollars = (rec.membres[membre].dollars || 0) + montant;
    if (rec.membres[membre].dollars < 0) rec.membres[membre].dollars = 0; // pas de solde négatif
    await writeBin(rec);
    alert(`✅ Solde de ${membre} mis à jour (${montant > 0 ? "+" : ""}${montant} Dollars).`);
  });
}

    // --- TRANSFERT ENTRE CAGNOTTES ---
const transferBtn = document.getElementById("eco-transfer-btn");
if (transferBtn) {
  transferBtn.addEventListener("click", async () => {
    const from = document.getElementById("eco-transfer-from")?.value;
    const to = document.getElementById("eco-transfer-to")?.value;
    const montant = parseInt(document.getElementById("eco-transfer-amount")?.value, 10);

    if (!from || !to || from === to) return alert("Sélection invalide (groupes identiques ?)");
    if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");

    const rec = await readBin();
    const cagnottes = rec.cagnottes || {};
    if ((cagnottes[from] || 0) < montant) return alert(`Fonds insuffisants dans ${from} !`);

    if (!confirm(`Transférer ${montant} Dollars de ${from} → ${to} ?`)) return;

    cagnottes[from] -= montant;
    cagnottes[to] = (cagnottes[to] || 0) + montant;
    await writeBin(rec);

    alert(`✅ ${montant} Dollars transférés de ${from} vers ${to}.`);
    const elFrom = document.getElementById(`eco-cag-${from.replace(/\s/g,"_")}`);
    const elTo = document.getElementById(`eco-cag-${to.replace(/\s/g,"_")}`);
    if (elFrom) elFrom.textContent = cagnottes[from];
    if (elTo) elTo.textContent = cagnottes[to];
  });
}

    // --- TRANSFERT ENTRE MEMBRES (réservé admins) ---
const transferMemberBtn = document.getElementById("eco-transfer-btn-member");
if (transferMemberBtn) {
  transferMemberBtn.addEventListener("click", async () => {
    const from = document.getElementById("eco-transfer-from-member")?.value;
    const to = document.getElementById("eco-transfer-to-member")?.value;
    const montant = parseInt(document.getElementById("eco-transfer-amount-member")?.value, 10);

    if (!from || !to || from === to) return alert("Sélection invalide (mêmes membres ?)");
    if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");

    const rec = await readBin();
    const membres = rec.membres || {};
    if (!membres[from] || !membres[to]) return alert("Membre inconnu !");
    if ((membres[from].dollars || 0) < montant)
      return alert(`${from} n’a pas assez de fonds !`);

    if (!confirm(`Transférer ${montant} Dollars de ${from} → ${to} ?`)) return;

    membres[from].dollars -= montant;
    membres[to].dollars = (membres[to].dollars || 0) + montant;

    await writeBin(rec);
    alert(`✅ ${montant} Dollars transférés de ${from} à ${to}.`);

    // Mise à jour visuelle si l’un des deux est sur la page
    const elFrom = document.querySelector(".username strong:contains('" + from + "')");
    const elTo = document.querySelector(".username strong:contains('" + to + "')");
    if (elFrom || elTo) updatePostDollars();
  });
}

    // Réinitialisations
    document.getElementById("eco-reset-member")?.addEventListener("click", async()=>{
      const choix = document.getElementById("eco-member-select")?.value;
      if(!choix) return alert("Aucun membre sélectionné !");
      if(!confirm(`Remettre ${choix} à 0 ${MONNAIE_NAME} ?`)) return;
      const rec = await readBin(); if(!rec.membres[choix]) return alert("Membre inconnu !");
      rec.membres[choix].dollars = 0; await writeBin(rec); alert(`${choix} a été réinitialisé.`);
    });
    document.getElementById("eco-reset-all-members")?.addEventListener("click", async()=>{
      if(!confirm("⚠️ Réinitialiser TOUS les membres ?")) return;
      const rec = await readBin(); for(const m in rec.membres) rec.membres[m].dollars = 0;
      await writeBin(rec); alert("Tous les membres ont été remis à 0.");
    });
    document.getElementById("eco-reset-cagnotte")?.addEventListener("click", async()=>{
      const choix = document.getElementById("eco-cag-select")?.value;
      if(!choix) return alert("Aucune cagnotte sélectionnée !");
      if(!confirm(`Remettre ${choix} à 0 ?`)) return;
      const rec = await readBin(); rec.cagnottes[choix] = 0; await writeBin(rec); alert(`Cagnotte ${choix} réinitialisée.`);
    });
    document.getElementById("eco-reset-all-cagnottes")?.addEventListener("click", async()=>{
      if(!confirm("⚠️ Tout remettre à 0 ?")) return;
      const rec = await readBin(); for(const g in rec.cagnottes) rec.cagnottes[g] = 0;
      await writeBin(rec); alert("Toutes les cagnottes remises à 0.");
    });

    // Distribution globale
    const giveAll = document.getElementById("eco-giveall-btn");
    if(giveAll){
      giveAll.addEventListener("click", async()=>{
        const val = parseInt(document.getElementById("eco-giveall-amount").value,10);
        if(isNaN(val) || val <= 0) return alert("Montant invalide.");
        if(!confirm(`Ajouter ${val} ${MONNAIE_NAME} à tous ?`)) return;
        const rec = await readBin(); let count=0;
        for(const n in rec.membres){ rec.membres[n].dollars = (rec.membres[n].dollars||0) + val; count++; }
        await writeBin(rec); showEcoGain(val); updatePostDollars();
        alert(`${val} ${MONNAIE_NAME} ajoutés à ${count} membres.`);
      });
    }
    
    await populateSelects();
    loading.remove();
    log("Initialisation terminée.");
    updatePostDollars();
  } // coreInit end

  // ---------- BOOT (wait menu) ----------
  let tries = 0;
  const timer = setInterval(async () => {
    tries++;
    const menu = document.querySelector(MENU_SELECTOR);
    if (menu) {
      clearInterval(timer);
      try { await coreInit(); } catch (e) { err("coreInit", e); }
    } else if (tries >= RETRY_MAX) {
      clearInterval(timer);
      warn("menu not found");
      document.body.prepend(createErrorBanner("Initialisation économie : menu introuvable."));
    }
  }, RETRY_INTERVAL_MS);

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
    const isNewTopic = location.href.includes("mode=newtopic");

    // 1) essayer la breadcrumb (forum complet avec slug)
    let forumId = null;
    const bc = document.querySelector(".sub-header-path");
    if (bc) {
      const links = Array.from(bc.querySelectorAll('a[href*="/f"]'));
      const last = links.pop();
      if (last) forumId = last.getAttribute("href"); // ex: /f8-downtown-houma
    }

    // 2) sinon champ caché "f"
    if (!forumId) {
      const fInput = f.querySelector('input[name="f"]');
      forumId = fInput ? fInput.value : null;          // ex: "8"
    }

    // 3) fallback final
    if (!forumId) forumId = location.pathname;         // ex: /post...

    const data = { t: Date.now(), newTopic: isNewTopic, fid: forumId };
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

    // petite pause pour laisser FA peindre la breadcrumb
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

    const record = await readBin();
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

    let isNew = !!s.newTopic;
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

    if (gain > 0) {
      membres[pseudo].dollars = (membres[pseudo].dollars || 0) + gain;
      await writeBin(record);
      showEcoGain(gain);
      updatePostDollars();
      console.log(`[EcoV2] 💰 +${gain} ${MONNAIE_NAME} pour ${pseudo}`);
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

    const isNewTopic = !!form.querySelector("input[name='subject']");
    let fid = form.querySelector("input[name='f']")?.value || location.pathname;
    const data = { t: Date.now(), newTopic: isNewTopic, fid };

    sessionStorage.setItem("ecoJustPosted", JSON.stringify(data));
    console.log("[EcoV2][GLOBAL-FALLBACK] 💾 Post intercepté juste avant envoi :", data);
  } catch (err) {
    console.error("[EcoV2][GLOBAL-FALLBACK] erreur interception submit", err);
  }
}, true); // ⚠️ capture phase = true pour être déclenché AVANT la soumission réelle

  // ---------- NOTIFICATION ----------
  function showEcoGain(gain){
    if(!gain || gain <= 0) return;
    const n = document.createElement("div");
    n.textContent = `💰 +${gain} ${MONNAIE_NAME}`;
    n.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);
      background:#e6ffe6;color:#075e07;border:2px solid #6fd36f;border-radius:10px;
      padding:8px 16px;font-weight:600;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.2);
      opacity:0;transition:opacity .4s,transform .4s;z-index:999;`;
    document.body.appendChild(n);
    setTimeout(()=>{ n.style.opacity="1"; },50);
    setTimeout(()=>{ n.style.opacity="0"; setTimeout(()=>n.remove(),600); },2500);
  }

  console.log("[EcoV2] <<< fin du script");
})();
