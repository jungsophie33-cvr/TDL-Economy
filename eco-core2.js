// === ECONOMIE V2 – CORE (Firebase) ===
// Auteur : Claude x THE DROWNED LANDS
console.log("[EcoV2] >>> eco-core chargé (Firebase)");

(function(){

  // ---------- CONFIG FIREBASE ----------
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBVCTA5amCjMoa0EzWZ6SC6jmoyTW8oNxA",
    databaseURL: "https://thedrownedlands-b35b4-default-rtdb.europe-west1.firebasedatabase.app"
  };
  const DB_PATH = "https://thedrownedlands-b35b4.firebaseio.com"; // même que databaseURL

  // ---------- CONFIG FORUM ----------
  const ADMIN_USERS       = ["Mami Wata", "Jason Blackford"];
  const GROUPS            = ["Les Goulipiats","Les Fardoches","Les Ashlanders","Les Spectres","Les Perles","Providence"];
  const DEFAULT_DOLLARS   = 10;
  const MONNAIE_NAME      = "Dollars";
  const MENU_SELECTOR     = "body #sj-main .menu .sj-menu-top";
  const RETRY_INTERVAL_MS = 500;
  const RETRY_MAX         = 20;

  // ---------- Logs ----------
  window.addEventListener("error", e => console.error("[EcoV2] onerror:", e.error || e.message, e));
  window.addEventListener("unhandledrejection", e => console.error("[EcoV2] unhandled:", e.reason));
  function log(...a)  { try { console.log("[EcoV2]",  ...a); } catch(e){} }
  function warn(...a) { try { console.warn("[EcoV2]", ...a); } catch(e){} }
  function err(...a)  { try { console.error("[EcoV2]",...a); } catch(e){} }

  // ---------- AUTH FIREBASE (token anonyme) ----------
  // On charge le SDK Firebase via le CDN compat (v9 compat = même API que v8)
  let _authToken = null;
  let _authReady = false;
  let _authResolve = null;
  const _authPromise = new Promise(r => { _authResolve = r; });

  function loadFirebaseSDK() {
    return new Promise((resolve) => {
      if (window._firebaseAuthLoaded) { resolve(); return; }
      const scripts = [
        "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
        "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js",
        "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"
      ];
      let loaded = 0;
      scripts.forEach(src => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => { if (++loaded === scripts.length) { window._firebaseAuthLoaded = true; resolve(); } };
        document.head.appendChild(s);
      });
    });
  }

  async function initFirebase() {
    await loadFirebaseSDK();
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    const auth = firebase.auth();
    // Si déjà connecté (session persistée), on récupère le token directement
    auth.onAuthStateChanged(async user => {
      if (user) {
        _authToken = await user.getIdToken();
        _authReady = true;
        _authResolve();
        log("Auth Firebase OK (uid:", user.uid, ")");
      } else {
        // Première visite ou session expirée → token anonyme
        try {
          const cred = await auth.signInAnonymously();
          _authToken = await cred.user.getIdToken();
          _authReady = true;
          _authResolve();
          log("Auth anonyme Firebase OK");
        } catch(e) {
          err("signInAnonymously échoué", e);
          _authReady = true; // on continue quand même en lecture
          _authResolve();
        }
      }
    });
  }

  // Lance l'init Firebase dès le chargement du script,
  // MAIS seulement si l'utilisateur n'est pas un invité FA
  async function maybeInitAuth() {
    try {
      const uid = parseInt(_userdata?.user_id) || 0;
      const pseudo = _userdata?.username?.trim();
      if (!pseudo || pseudo.toLowerCase() === "anonymous" || uid <= 0) {
        // Invité → lecture seule sans token
        _authReady = true;
        _authResolve();
        return;
      }
      await initFirebase();
    } catch(e) {
      _authReady = true;
      _authResolve();
    }
  }
  maybeInitAuth();

  // ---------- HELPERS FIREBASE REST ----------
  // On utilise l'API REST Firebase plutôt que le SDK pour garder
  // la même structure fetch() qu'avant → compatibilité totale
  const BASE_URL = FIREBASE_CONFIG.databaseURL;

async function firebaseGet(path) {
  await _authPromise;
  const authParam = _authToken ? `?auth=${_authToken}` : "";
  const url = `${BASE_URL}/${path}.json${authParam}`; // donne BASE_URL/.json ✓
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Firebase GET ${r.status}`);
  return await r.json();
}

  async function firebasePut(path, data) {
    await _authPromise;
    if (!_authToken) throw new Error("Pas de token Firebase — écriture refusée");
    const url = `${BASE_URL}/${path}.json?auth=${_authToken}`;
    const r = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(`Firebase PUT ${r.status}`);
    return await r.json();
  }

  // Transaction atomique sur un chemin numérique (évite les collisions)
  async function firebaseTransaction(path, updateFn) {
    await _authPromise;
    if (!_authToken) throw new Error("Pas de token");
    // Firebase REST ne supporte pas les vraies transactions,
    // mais on utilise les ETags pour optimistic locking
    const url = `${BASE_URL}/${path}.json`;
    for (let i = 0; i < 5; i++) {
      const getR = await fetch(`${url}?auth=${_authToken}&_=${Date.now()}`, {
        headers: { "X-Firebase-ETag": "true" }
      });
      const etag = getR.headers.get("ETag");
      const current = await getR.json();
      const next = updateFn(current);
      const putR = await fetch(`${url}?auth=${_authToken}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "if-match": etag
        },
        body: JSON.stringify(next)
      });
      if (putR.ok) return await putR.json();
      if (putR.status === 412) {
        // Conflit — une autre écriture a eu lieu, on réessaie
        warn(`Transaction conflit sur ${path}, retry ${i+1}/5`);
        await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
        continue;
      }
      throw new Error(`Transaction PUT ${putR.status}`);
    }
    throw new Error("Transaction échouée après 5 tentatives");
  }

  // ---------- CACHE SESSION ----------
  const CACHE_TTL = 60000; // 60 secondes

  function getCached() {
    try {
      const d = sessionStorage.getItem("eco_cache_record");
      const t = sessionStorage.getItem("eco_cache_time");
      if (d && t && Date.now() - parseInt(t) < CACHE_TTL) return JSON.parse(d);
    } catch(e) {}
    return null;
  }

  function setCached(record) {
    try {
      sessionStorage.setItem("eco_cache_record", JSON.stringify(record));
      sessionStorage.setItem("eco_cache_time", Date.now().toString());
    } catch(e) {}
  }

  function invalidateCache() {
    sessionStorage.removeItem("eco_cache_record");
    sessionStorage.removeItem("eco_cache_time");
  }

  // ---------- API PUBLIQUE (compatible avec eco-ui.js et eco-gain.js) ----------
  // readBin → lit tout le record
async function readBin() {
  try {
    const record = await firebaseGet(""); // ← racine, pas "eco"
    return record || {};
  } catch(e) {
    err("readBin Firebase", e);
    return null;
  }
}

  // safeReadBin → avec cache 60s
  async function safeReadBin() {
    const cached = getCached();
    if (cached) return cached;
    const record = await readBin();
    if (record) setCached(record);
    return record;
  }

  // writeBin → écrit tout le record (compatible API existante)
async function writeBin(record) {
  try {
    invalidateCache();
    await firebasePut("", record); // ← racine
    setCached(record);
    log("writeBin Firebase OK");
  } catch(e) {
    err("writeBin Firebase", e);
    throw e;
  }
}

  // writeField → écriture atomique d'un seul champ (pour les dépenses boutique)
async function writeField(path, data) {
  try {
    invalidateCache();
    await firebasePut(path, data); // ← déjà correct, pas de "eco/" à enlever
  } catch(e) {
    err(`writeField ${path}`, e);
    throw e;
  }
}

  // transactDollars → débit/crédit atomique anti-collision
  async function transactDollars(pseudo, delta) {
    return firebaseTransaction(
      `eco/membres/${encodeURIComponent(pseudo)}/dollars`,
      current => Math.max(0, (current || 0) + delta)
    );
  }

  // ---------- Extractors ----------
  function getPseudo(){ try{ return _userdata?.username?.trim()||null; }catch(e){ return null; } }
  function getUserId(){ try{ return parseInt(_userdata?.user_id)||0; }catch(e){ return 0; } }
  function getMessagesCount(){ try{ return parseInt(_userdata?.user_posts)||0; }catch(e){ return 0; } }

  async function fetchUserGroupFromProfile(id){
    if(!id) return null;
    try{
      const r = await fetch(`/u${id}`); if(!r.ok) return null;
      const html = await r.text();
      const d = document.createElement("div"); d.innerHTML = html;
      const dd = d.querySelector("dd,.usergroup,.group,.user-level");
      if(dd && dd.textContent.trim()) return dd.textContent.trim();
      const m = html.match(/(Les [A-ZÀ-Ÿa-zà-ÿ0-9_\- ]{2,40})/);
      return m ? m[1].trim() : null;
    }catch(e){ err("fetchUserGroup", e); return null; }
  }

  // ---------- DOM helpers ----------
  function insertAfter(t,e){ if(!t||!t.parentNode) return false; t.parentNode.insertBefore(e,t.nextSibling); return true; }
  function createErrorBanner(m){ const b=document.createElement("div"); b.style.cssText="background:#ffdede;color:#600;border:2px solid #f99;padding:8px;text-align:center;margin:6px;"; b.textContent=m; return b; }

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

  // ---------- EXPORT ----------
  window.EcoCore = {
    // Config (gardée pour compatibilité avec eco-ui.js qui les lit)
    BIN_ID: null, API_KEY: null, JSONBIN_BASE: null,
    ADMIN_USERS, GROUPS, DEFAULT_DOLLARS, MONNAIE_NAME,
    MENU_SELECTOR, RETRY_INTERVAL_MS, RETRY_MAX,
    // Logs
    log, warn, err,
    // API données (même noms qu'avant)
    readBin, safeReadBin, writeBin,
    // Nouvelles API Firebase
    writeField, transactDollars, invalidateCache,
    // Extractors & helpers
    getPseudo, getUserId, getMessagesCount, fetchUserGroupFromProfile,
    insertAfter, createErrorBanner, showEcoGain
  };

  log("eco-core Firebase prêt.");

})();
