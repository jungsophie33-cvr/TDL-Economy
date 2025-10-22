// === ECONOMIE V2 – ModernBB (version stable) ===
// Auteur : ChatGPT x THE DROWNED LANDS
// Objectif : système d’économie complet via JSONBin + intégration ModernBB
// Héberger ce fichier sur Archive-Host, GitHub Gist, etc.
// Puis charger sur ton forum via : $.getScript("https://tonurl/eco-forum.js");
(function(){


// ---------- CONFIG ----------
const BIN_ID = "68f92d16d0ea881f40b3f36f"; // fourni
const API_KEY = "$2a$10$yVl9vTE.d/B4Hbmu8n6pyeHDM9PgPVHCBryetKJ3.wLHr7wa6ivyq"; // si tu possèdes une autre clé, change-la ici
const JSONBIN_PROXY_BASE = "https://corsproxy.io/?url=https://api.jsonbin.io/v3/b/"; // proxy pour contourner CORS
const ADMIN_USERS = ["Mami Wata", "Jason Blackford"];
const GROUPS = ["Les Goulipiats","Les Fardoches","Les Ashlanders","Les Spectres","Les Perles"];
const DEFAULT_DOLLARS = 10;
const MONNAIE_NAME = "Dollars";
const MENU_SELECTOR = "body #sj-main .menu .sj-menu-top";
const RETRY_INTERVAL_MS = 500;
const RETRY_MAX = 20;

// ---------- Helpers & logs ----------
window.addEventListener("error", e => console.error("[EcoV2] onerror:", e.error || e.message, e));
window.addEventListener("unhandledrejection", e => console.error("[EcoV2] unhandled:", e.reason));

function log(...args){ try{ console.log("[EcoV2]", ...args); }catch(e){} }
function warn(...args){ try{ console.warn("[EcoV2]", ...args); }catch(e){} }
function err(...args){ try{ console.error("[EcoV2]", ...args); }catch(e){} }

// ---------- JSONBin helpers (via proxy) ----------
async function readBin() {
  try {
    const url = `${JSONBIN_PROXY_BASE}${BIN_ID}/latest`;
    const r = await fetch(url, { method: "GET", headers: { "X-Master-Key": API_KEY }});
    if (!r.ok) { warn("readBin status", r.status); return null; }
    const j = await r.json();
    return j.record || {};
  } catch (e) {
    err("readBin error", e);
    return null;
  }
}
async function writeBin(record) {
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,
        "X-Bin-Versioning": "false"
      },
      body: JSON.stringify(record)
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("[EcoV2] writeBin error:", response.status, text);
      throw new Error("WriteBin failed");
    }
    return await response.json();
  } catch (e) {
    console.error("[EcoV2] writeBin exception:", e);
  }
}


// ---------- ModernBB extractors ----------
function getPseudo() {
  try { return (typeof _userdata !== "undefined" && _userdata.username) ? String(_userdata.username).trim() : null; }
  catch(e){ return null; }
}
function getUserId() {
  try { return (typeof _userdata !== "undefined" && _userdata.user_id) ? parseInt(_userdata.user_id) : 0; }
  catch(e){ return 0; }
}
function getMessagesCount() {
  try { return (typeof _userdata !== "undefined" && _userdata.user_posts) ? parseInt(_userdata.user_posts) : 0; }
  catch(e){ return 0; }
}
async function fetchUserGroupFromProfile(userId) {
  if (!userId) return null;
  try {
    const res = await fetch(`/u${userId}`);
    if (!res.ok) return null;
    const html = await res.text();
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const dd = tmp.querySelector("dd, .usergroup, .group, .user-level");
    if (dd && dd.textContent.trim()) return dd.textContent.trim();
    const m = html.match(/(Les [A-ZÀ-Ÿa-zà-ÿ0-9_\- ]{2,40})/);
    return m ? m[1].trim() : null;
  } catch(e){
    err("fetchUserGroupFromProfile error", e);
    return null;
  }
}

// ---------- DOM helpers ----------
function insertAfter(target, el) {
  if (!target || !target.parentNode) return false;
  target.parentNode.insertBefore(el, target.nextSibling);
  return true;
}
function createErrorBanner(msg) {
  const b = document.createElement("div");
  b.style.cssText = "background:#ffdede;color:#600;border:2px solid #f99;padding:8px;text-align:center;margin:6px;";
  b.textContent = msg;
  return b;
}
function createAdminBar() {
  const bar = document.createElement("div");
  bar.id = "eco-admin-bar";
  bar.innerHTML = `
    <strong style="margin-right:8px">Admin Économie</strong>
    <button id="eco-btn-cag">Voir cagnottes</button>
    <button id="eco-btn-shop">Voir boutique</button>
    <button id="eco-btn-don">Don à cagnotte</button>
    <span id="eco-admin-msg" style="margin-left:12px;font-weight:600;"></span>`;
  return bar;
}

// ---------- CORE INIT ----------
async function coreInit() {
  log("Initialisation...");
  const menu = document.querySelector(MENU_SELECTOR);
  if (!menu) { warn("Menu non trouvé", MENU_SELECTOR); return; }

  const loadingBox = document.createElement("div");
  loadingBox.id = "eco-loading";
  loadingBox.style.cssText = "background:#fffbe6;padding:6px;text-align:center;border:1px solid #ffecb3;margin-top:6px;";
  loadingBox.textContent = "Initialisation économie…";
  insertAfter(menu, loadingBox);

  const record = await readBin();
  if (!record) {
    loadingBox.replaceWith(createErrorBanner("Erreur : lecture JSONBin impossible."));
    return;
  }

  // ensure structure
  record.membres = record.membres || {};
  record.cagnottes = record.cagnottes || {};
  GROUPS.forEach(g => { if (record.cagnottes[g] === undefined) record.cagnottes[g] = 0; });
  record.boutique = record.boutique || {};
  await writeBin(record).catch(()=>null);

  const pseudo = getPseudo();
  const uid = getUserId();
  if (!pseudo) {
    loadingBox.replaceWith(createErrorBanner("Connecte-toi pour initialiser l'économie."));
    return;
  }

  // create or update member
  if (!record.membres[pseudo]) {
    const group = await fetchUserGroupFromProfile(uid);
    record.membres[pseudo] = {
      dollars: DEFAULT_DOLLARS,
      messages: getMessagesCount(),
      group: group || null,
      lastMessageThresholdAwarded: 0
    };
    await writeBin(record).catch(()=>null);
    log("Membre ajouté:", pseudo);
  } else {
    record.membres[pseudo].messages = getMessagesCount();
    if (!record.membres[pseudo].group) {
      const group = await fetchUserGroupFromProfile(uid);
      if (group) { record.membres[pseudo].group = group; await writeBin(record).catch(()=>null); }
    }
  }

  // sync #sj-dollars
  try {
    const dollarsActuels = record.membres[pseudo].dollars || 0;
    const sjDollars = document.querySelector("#sj-dollars");
    if (sjDollars) sjDollars.textContent = dollarsActuels;
  } catch(e) { err("sync sj-dollars error", e); }

  // display cagnottes
  try {
    const box = document.createElement("div");
    box.id = "eco-solde-box";
    let html = `${record.membres[pseudo].dollars || 0} ${MONNAIE_NAME} — Cagnottes : `;
    GROUPS.forEach(g => {
      html += `<span style="margin-left:8px">${g}: <b id="eco-cag-${g.replace(/\s/g,'_')}">${record.cagnottes[g]||0}</b></span>`;
    });
    box.innerHTML = html;
    insertAfter(menu, box);
  } catch(e) { err("afficher solde error", e); }

  // admin bar
  if (ADMIN_USERS.includes(pseudo)) {
    try {
      const adminBar = createAdminBar();
      document.body.prepend(adminBar);

      document.getElementById("eco-btn-cag").addEventListener("click", async ()=>{
        const rec = await readBin();
        alert("Cagnottes:\n" + JSON.stringify(rec.cagnottes,null,2));
      });

      document.getElementById("eco-btn-shop").addEventListener("click", async ()=>{
        const rec = await readBin();
        alert("Boutique:\n" + JSON.stringify(rec.boutique||{},null,2));
      });

      document.getElementById("eco-btn-don").addEventListener("click", async ()=>{
        const montant = parseInt(prompt("Montant du don :","0"));
        if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");
        const rec = await readBin();
        const grp = rec.membres[pseudo]?.group;
        if (!grp) return alert("Ton groupe est inconnu.");
        if ((rec.membres[pseudo]?.dollars || 0) < montant) return alert("Fonds insuffisants !");
        rec.membres[pseudo].dollars = (rec.membres[pseudo].dollars || 0) - montant;
        rec.cagnottes[grp] = (rec.cagnottes[grp]||0) + montant;
        await writeBin(rec);
        alert("✅ Don effectué !");
        const el = document.querySelector("#sj-dollars");
        if (el) el.textContent = rec.membres[pseudo].dollars;
        const cagEl = document.getElementById(`eco-cag-${grp.replace(/\s/g,'_')}`);
        if (cagEl) cagEl.textContent = rec.cagnottes[grp];
      });
    } catch(e){ err("adminBar error", e); }
  }

  // remove loading
  const lb = document.getElementById("eco-loading");
  if (lb) lb.remove();
  log("Initialisation terminée.");
} // coreInit end

// ---------- MODULE GAINS AUTOMATIQUES ----------
/* règles et mapping */
const GAIN_RULES = {
  presentation_new: 20,
  presentation_reply: 5,
  preliens_or_gestion_new: 10,
  preliens_or_gestion_reply: 2,
  houma_terrebonne_new: 15,
  houma_terrebonne_reply: 10,
  vote_topic_reply: 2
};
const FORUM_IDS = {
  presentations: "/f5-presentations",
  preliens: "/f3-pre-liens",
  gestionPersos: "/f6-gestion-des-personnages",
  houma: "Houma_20Metropolitan_20Area",
  terrebonne: "Terrebonne_20Parish",
  voteTopicName: "vote aux top-sites"
};

// Détection d’un envoi de post
function ecoAttachPostListeners() {
  const forms = document.querySelectorAll("form[name='post'], form#quick_reply, form[action*='post'], form[action*='posting']");
  forms.forEach(f => {
    if (f.__eco_listening) return;
    f.__eco_listening = true;

    log("Formulaire de post détecté :", f.action);

   f.addEventListener("submit", () => {
  try {
    const isNewTopic = !!f.querySelector("input[name='subject']");
    let forumId = null;

    // 1️⃣ priorité : champ caché dans le formulaire
    const forumIdField = f.querySelector("input[name='f']");
    if (forumIdField) forumId = forumIdField.value;

    // 2️⃣ sinon : essayer de le déduire depuis la breadcrumb
    if (!forumId) {
      const breadcrumb = document.querySelector(".sub-header-path");
      if (breadcrumb) {
        const forumLink = Array.from(breadcrumb.querySelectorAll("a[href*='/f']")).pop();
        if (forumLink) forumId = forumLink.getAttribute("href");
      }
    }

    // 3️⃣ fallback final
    if (!forumId) forumId = location.pathname;

    // on stocke tout ça
    sessionStorage.setItem("ecoJustPosted", JSON.stringify({
      t: Date.now(),
      newTopic: isNewTopic,
      fid: forumId
    }));

    console.log("[EcoV2] ➕ Post intercepté : forum =", forumId, "isNew =", isNewTopic);
  } catch(e) {
    console.error("[EcoV2] ecoAttachPostListeners error", e);
  }
});

  });
}

// Vérification/gain après redirection
async function ecoCheckPostGain(info) {
  try {
    // info peut être fourni par l'appelant (lecture de sessionStorage) ou non
    let data = info || null;
    if (!data) {
      const s = sessionStorage.getItem("ecoJustPosted");
      if (!s) return;
      data = JSON.parse(s);
    }
    const pseudo = getPseudo();
    if (!pseudo) return;
    const record = await readBin();
    if (!record) return;
    const membres = record.membres || {};
    if (!membres[pseudo]) return;

// Détermination du forum courant (depuis la breadcrumb personnalisée)
let path = "";

// essaie de trouver la breadcrumb dans ton forum (sub-header-path)
const breadcrumb = document.querySelector(".sub-header-path");
if (breadcrumb) {
  // cherche le dernier lien qui contient un href vers /f
  const forumLink = Array.from(breadcrumb.querySelectorAll("a[href*='/f']")).pop();
  if (forumLink) path = forumLink.getAttribute("href").toLowerCase();
}

// fallback : si rien trouvé, utilise ce qu’on a stocké avant envoi
if (!path && data.fid) path = String(data.fid).toLowerCase();
if (!path) path = location.pathname.toLowerCase();
    
    const isNew = !!data.newTopic;
    let gain = 0;

    if (path.includes(FORUM_IDS.presentations)) {
      gain = isNew ? GAIN_RULES.presentation_new : GAIN_RULES.presentation_reply;
    } else if (path.includes(FORUM_IDS.preliens) || path.includes(FORUM_IDS.gestionPersos)) {
      gain = isNew ? GAIN_RULES.preliens_or_gestion_new : GAIN_RULES.preliens_or_gestion_reply;
    } else if (path.includes(FORUM_IDS.houma) || path.includes(FORUM_IDS.terrebonne)) {
      gain = isNew ? GAIN_RULES.houma_terrebonne_new : GAIN_RULES.houma_terrebonne_reply;
    } else {
      const topicTitleEl = document.querySelector(".topic-title, h1.topictitle, .page-title");
      const topicTitle = topicTitleEl ? topicTitleEl.textContent.toLowerCase() : "";
      if (topicTitle.includes(FORUM_IDS.voteTopicName) && !isNew) gain = GAIN_RULES.vote_topic_reply;
    }

    log("Vérification gain : path =", path, "isNew =", isNew, "gain =", gain);

    if (gain > 0) {
      membres[pseudo].dollars = (membres[pseudo].dollars || 0) + gain;
      await writeBin(record);
      log(`+${gain} ${MONNAIE_NAME} pour ${pseudo}`);
      const el = document.querySelector("#sj-dollars");
      if (el) el.textContent = membres[pseudo].dollars;
      const box = document.querySelector("#eco-solde-box");
      if (box) {
        // replace the number inside the box: find the first text node and update safely
        const firstBold = box.querySelector("b");
        if (firstBold) firstBold.textContent = membres[pseudo].dollars;
      }
    }
  } catch(e){
    err("ecoCheckPostGain", e);
  }
}

// Lancer écouteurs
ecoAttachPostListeners();

// Vérification après chargement si post récent (lecture du sessionStorage)
window.addEventListener("load", async () => {
  const justPosted = sessionStorage.getItem("ecoJustPosted");
  if (!justPosted) return;
  try {
    const data = JSON.parse(justPosted);
    const age = Date.now() - data.t;
    if (age > 30000) { sessionStorage.removeItem("ecoJustPosted"); return; }
    log("Détection d'un post récent :", data);
    await ecoCheckPostGain(data);
    sessionStorage.removeItem("ecoJustPosted");
  } catch(e){
    err("Erreur lecture ecoJustPosted :", e);
    sessionStorage.removeItem("ecoJustPosted");
  }
});

// ---------- Wait-for-menu & boot ----------
let tries = 0;
const timer = setInterval(async () => {
  tries++;
  const menu = document.querySelector(MENU_SELECTOR);
  if (menu) {
    clearInterval(timer);
    try { await coreInit(); } catch(e){ err("coreInit threw:", e); }
  } else if (tries >= RETRY_MAX) {
    clearInterval(timer);
    warn("menu not found after retries. Aborting init.");
    const existing = document.body.querySelector("#eco-error-banner");
    if (!existing) document.body.prepend(createErrorBanner("Initialisation économie : menu introuvable. Contacter l'admin."));
  }
}, RETRY_INTERVAL_MS);

// ---------- END IIFE ----------
})();
