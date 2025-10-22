// === ECONOMIE V2 – ModernBB (version stable) ===
// Auteur : ChatGPT x THE DROWNED LANDS
// Objectif : système d’économie complet via JSONBin + intégration ModernBB
// Héberger ce fichier sur Archive-Host, GitHub Gist, etc.
// Puis charger sur ton forum via : $.getScript("https://tonurl/eco-forum.js");
(function() {
  console.log("[EcoV2] Fichier eco-forum.js bien chargé !");

const BIN_ID = "68f89576d0ea881f40b2b27b";
const API_KEY = "$2a$10$yVl9vTE.d/B4Hbmu8n6pyeHDM9PgPVHCBryetKJ3.wLHr7wa6ivyq";
const ADMIN_USERS = ["Mami Wata", "Jason Blackford"];
const GROUPS = ["Les Goulipiats","Les Fardoches","Les Ashlanders","Les Spectres","Les Perles"];
const DEFAULT_DOLLARS = 10;
const MONNAIE_NAME = "Dollars";
const MENU_SELECTOR = "body #sj-main .menu .sj-menu-top";
const RETRY_INTERVAL_MS = 500;
const RETRY_MAX = 20;

// === Sécurité & logs ===
window.addEventListener("error", e => console.error("[EcoV2] onerror:", e.error || e.message, e));
window.addEventListener("unhandledrejection", e => console.error("[EcoV2] unhandled:", e.reason));

// === Fonctions JSONBin ===
async function readBin() {
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY }
    });
    if (!r.ok) { console.warn("[EcoV2] readBin status", r.status); return null; }
    const j = await r.json();
    return j.record || {};
  } catch (e) {
    console.error("[EcoV2] readBin error", e);
    return null;
  }
}
async function writeBin(record) {
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY
      },
      body: JSON.stringify(record)
    });
    if (!r.ok) { console.warn("[EcoV2] writeBin status", r.status); return null; }
    return await r.json();
  } catch (e) {
    console.error("[EcoV2] writeBin error", e);
    return null;
  }
}

// === Fonctions utilitaires ===
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
    const resp = await fetch(`/u${userId}`);
    if (!resp.ok) return null;
    const html = await resp.text();
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const dd = tmp.querySelector("dd, .usergroup, .group, .user-level");
    if (dd && dd.textContent.trim()) return dd.textContent.trim();
    const m = html.match(/(Les [A-ZÀ-Ÿa-zà-ÿ0-9_\- ]{2,40})/);
    return m ? m[1].trim() : null;
  } catch(e){
    console.error("[EcoV2] fetchUserGroupFromProfile error", e);
    return null;
  }
}
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

// === CORE INITIALISATION ===
async function coreInit() {
  console.log("[EcoV2] Initialisation...");
  const menu = document.querySelector(MENU_SELECTOR);
  if (!menu) { console.warn("[EcoV2] Menu non trouvé", MENU_SELECTOR); return; }

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

  if (!record.membres[pseudo]) {
    const group = await fetchUserGroupFromProfile(uid);
    record.membres[pseudo] = {
      dollars: DEFAULT_DOLLARS,
      messages: getMessagesCount(),
      group: group || null,
      lastMessageThresholdAwarded: 0
    };
    await writeBin(record);
    console.log("[EcoV2] Membre ajouté:", pseudo);
  } else {
    record.membres[pseudo].messages = getMessagesCount();
    if (!record.membres[pseudo].group) {
      const group = await fetchUserGroupFromProfile(uid);
      if (group) { record.membres[pseudo].group = group; await writeBin(record); }
    }
  }

  // --- Mise à jour du champ dollars dans le header ---
  try {
    const dollarsActuels = record.membres[pseudo].dollars;
    const sjDollars = document.querySelector("#sj-dollars");
    if (sjDollars) sjDollars.textContent = dollarsActuels;
  } catch(e) { console.error("[EcoV2] sync sj-dollars error:", e); }

  // --- Affichage des cagnottes ---
  try {
    const box = document.createElement("div");
    box.id = "eco-solde-box";
    let html = `${record.membres[pseudo].dollars} ${MONNAIE_NAME} — Cagnottes : `;
    GROUPS.forEach(g => {
      html += `<span style="margin-left:8px">${g}: <b id="eco-cag-${g.replace(/\s/g,'_')}">${record.cagnottes[g]||0}</b></span>`;
    });
    box.innerHTML = html;
    insertAfter(menu, box);
  } catch(e) { console.error("[EcoV2] afficher solde error:", e); }

  // --- Barre admin ---
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
        if (rec.membres[pseudo].dollars < montant) return alert("Fonds insuffisants !");
        rec.membres[pseudo].dollars -= montant;
        rec.cagnottes[grp] = (rec.cagnottes[grp]||0) + montant;
        await writeBin(rec);
        alert("✅ Don effectué !");
        const el = document.querySelector("#sj-dollars");
        if (el) el.textContent = rec.membres[pseudo].dollars;
        const cagEl = document.getElementById(`eco-cag-${grp.replace(/\s/g,'_')}`);
        if (cagEl) cagEl.textContent = rec.cagnottes[grp];
      });
    } catch(e){ console.error("[EcoV2] adminBar error:", e); }
  }

  // Fin du chargement
  const lb = document.getElementById("eco-loading");
  if (lb) lb.remove();
  console.log("[EcoV2] Initialisation terminée.");
}

// === Attente du DOM / menu ===
let tries = 0;
const timer = setInterval(async () => {
  tries++;
  const menu = document.querySelector(MENU_SELECTOR);
  if (menu) {
    clearInterval(timer);
    coreInit().catch(e => console.error("[EcoV2] coreInit threw:", e));
  } else if (tries >= RETRY_MAX) {
    clearInterval(timer);
    console.warn("[EcoV2] menu not found after retries. Aborting init.");
    const existing = document.body.querySelector("#eco-error-banner");
    if (!existing) document.body.prepend(createErrorBanner("Initialisation économie : menu introuvable. Contacter l'admin."));
  }
}, RETRY_INTERVAL_MS);

  //-----------------------------------------------------------//
//  MODULE : GAINS AUTOMATIQUES SUR LES POSTS                //
//-----------------------------------------------------------//
console.log("[EcoV2] Module de gains automatiques chargé !");

const GAIN_RULES = {
  presentation_new: 20,
  presentation_reply: 5,
  preliens_or_gestion_new: 10,
  preliens_or_gestion_reply: 2,
  houma_terrebonne_new: 15,
  houma_terrebonne_reply: 10,
  vote_topic_reply: 2
};

// correspondances des forums
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

    console.log("[EcoV2] Formulaire de post détecté :", f.action);

    f.addEventListener("submit", () => {
      try {
        const isNewTopic = !!f.querySelector("input[name='subject']");
        const forumIdField = f.querySelector("input[name='f']");
        const forumId = forumIdField ? forumIdField.value : location.pathname;
        sessionStorage.setItem("ecoJustPosted", JSON.stringify({ 
          t: Date.now(), 
          newTopic: isNewTopic, 
          fid: forumId 
        }));
      } catch(e){ console.error("[EcoV2] ecoAttachPostListeners", e); }
    });
  });
}

// Vérifie après le chargement de page si un post vient d’être fait
async function ecoCheckPostGain() {
  const data = sessionStorage.getItem("ecoJustPosted");
  if (!data) return;
  const info = JSON.parse(data);
  sessionStorage.removeItem("ecoJustPosted");

  if (Date.now() - info.t > 15000) return; // vieux

  const pseudo = getPseudo();
  if (!pseudo) return;

  try {
    const record = await readBin();
    const membres = record.membres || {};
    if (!membres[pseudo]) return;

    const path = String(info.fid).toLowerCase();
    const isNew = info.newTopic;
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
      if (topicTitle.includes(FORUM_IDS.voteTopicName) && !isNew) {
        gain = GAIN_RULES.vote_topic_reply;
      }
    }

    if (gain > 0) {
      membres[pseudo].dollars = (membres[pseudo].dollars || 0) + gain;
      await writeBin(record);
      console.log(`[EcoV2] +${gain} ${MONNAIE_NAME} pour ${pseudo}`);
      const el = document.querySelector("#sj-dollars");
      if (el) el.textContent = membres[pseudo].dollars;
      const box = document.querySelector("#eco-solde-box");
      if (box) box.querySelector("div, span, b")?.replaceChildren(`${membres[pseudo].dollars}`);
    }

  } catch(e){
    console.error("[EcoV2] ecoCheckPostGain", e);
  }
}

// Lancer les écouteurs
ecoAttachPostListeners();
window.addEventListener("load", ecoCheckPostGain);

  })();


// === FIN DU SCRIPT ===
