// === ECONOMIE V2 – CORE (Firebase) ===
// Auteur : Claude x THE DROWNED LANDS
console.log("[EcoV2] >>> eco-core chargé (Firebase)");

(function(){

  // ---------- CONFIG FIREBASE ----------
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBVCTA5amCjMoa0EzWZ6SC6jmoyTW8oNxA",
    databaseURL: "https://thedrownedlands-b35b4-default-rtdb.europe-west1.firebasedatabase.app"
  };

  // ---------- CONFIG FORUM ----------
  const ADMIN_USERS       = ["Mami Wata", "Jason Blackford", "Alyssa Desrosiers"];

  // ---------- COMMUNAUTÉS — SOURCE UNIQUE ----------
  // [MAJ] Clé = ID de groupe ForumActif (visible dans l'admin : /gN-nom).
  //   court : libellé utilisé PARTOUT dans l'économie (membres[].group, clés de
  //           record.cagnottes). NE PAS modifier sans migration des cagnottes.
  //   long  : libellé affiché dans le formulaire de fiche (fiche-config peut le
  //           lire via window.EcoCore.COMMUNAUTES pour rester synchronisé).
  // group-8 = la Main / compte fondateur (transactions avec la Providence) :
  //           ce n'est pas une communauté qu'un joueur rejoint à l'inscription.
  //   jouable : true = communauté qu'un joueur peut choisir à la validation de
  //             fiche (proposée dans le select #fi-groupe). false = groupe FA
  //             réservé (la Main / compte fondateur), exclu du formulaire.
  const COMMUNAUTES = {
    3: { court: "Les Goulipiats", long: "Les Goulipiats",                jouable: true  },
    4: { court: "Les Fardoches",  long: "Les Fardoches",                 jouable: true  },
    5: { court: "Les Ashlanders", long: "Les Ashlanders",                jouable: true  },
    6: { court: "Les Spectres",   long: "Les Spectres de Baron Samdi",   jouable: true  },
    7: { court: "Les Perles",     long: "Les Perles de Cocodrie",        jouable: true  },
    8: { court: "Providence",     long: "Main de la Providence",         jouable: false }
  };

  // GROUPS dérivée — identique à l'ancienne constante (ordre 3→8), clés de cagnotte.
  const GROUPS = Object.values(COMMUNAUTES).map(c => c.court);

  // GROUPES_FA : id de groupe FA → libellé court. Utilisé par la détection group-N.
  const GROUPES_FA = Object.fromEntries(
    Object.entries(COMMUNAUTES).map(([id, c]) => [id, c.court])
  );

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

// ---------- LECTURE (avec déduplication des appels concurrents) ----------
// Deux modules qui demandent le même chemin en même temps partagent un seul
// aller-retour réseau. La promesse est retirée dès qu'elle est résolue : seuls
// les appels SIMULTANÉS sont mutualisés, jamais deux lectures espacées.
const _enVol = Object.create(null);

function firebaseGet(path) {
  const cle = String(path);
  if (_enVol[cle]) return _enVol[cle];
  const p = (async () => {
    await _authPromise;
    const authParam = _authToken ? `?auth=${_authToken}` : "";
    const r = await fetch(`${BASE_URL}/${cle}.json${authParam}`);
    if (!r.ok) throw new Error(`Firebase GET ${r.status}`);
    return await r.json();
  })().finally(() => { delete _enVol[cle]; });
  _enVol[cle] = p;
  return p;
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
        headers: { "Content-Type": "application/json", "if-match": etag },
        body: JSON.stringify(next)
      });
            // La valeur écrite est connue : on la pose dans le cache plutôt que de le
      // jeter. Sans ça, chaque transaction force la relecture des 117 ko racine.
      if (putR.ok) {
        appliquerAuCache({ [path]: next });
        return await putR.json();
      }
      if (putR.status === 412) {
        warn(`Transaction conflit sur ${path}, retry ${i+1}/5`);
        await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
        continue;
      }
      throw new Error(`Transaction PUT ${putR.status}`);
    }
    throw new Error("Transaction échouée après 5 tentatives");
  }

  // POST : ajoute un enfant à clé unique générée par le serveur
  async function firebasePush(path, data) {
    await _authPromise;
    if (!_authToken) throw new Error("Pas de token Firebase — push refusé");
    const url = `${BASE_URL}/${path}.json?auth=${_authToken}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(`Firebase POST ${r.status}`);
    const res = await r.json();                       // { name: "-N..." }
    if (res && res.name) appliquerAuCache({ [path + "/" + res.name]: data });
    return res;
  }

  // PATCH multi-chemins à la racine. null supprime le chemin.
  async function firebaseUpdate(updates) {
    await _authPromise;
    if (!_authToken) throw new Error("Pas de token Firebase — update refusé");
    const url = `${BASE_URL}/.json?auth=${_authToken}`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    if (!r.ok) throw new Error(`Firebase PATCH ${r.status}`);
    appliquerAuCache(updates);                        // au lieu de jeter le cache
    return await r.json();
  }

  // ---------- CACHE SESSION ----------
  const CACHE_TTL    = 60000;   // 60 secondes
  const BRANCHES_MAX = 6;       // garde-fou writeBin (voir plus bas)

  // Socle : empreinte par branche de premier niveau du dernier état LU.
  // Sert de base de comparaison à writeBin. Volatile — remis à zéro à chaque page.
  let _socle = null;

  function memoriserSocle(record) {
    try {
      _socle = {};
      Object.keys(record || {}).forEach(k => { _socle[k] = JSON.stringify(record[k]); });
    } catch(e) { _socle = null; }
  }

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

  // Pose une valeur à un chemin "a/b/c" dans un objet. null supprime la feuille.
  // Les segments sont décodés : les chemins partent encodés (pseudo avec espace).
  function poserChemin(obj, chemin, valeur) {
    const seg = String(chemin).split("/").filter(Boolean).map(s => {
      try { return decodeURIComponent(s); } catch(e) { return s; }
    });
    if (!seg.length) return;
    let n = obj;
    for (let i = 0; i < seg.length - 1; i++) {
      if (n[seg[i]] == null || typeof n[seg[i]] !== "object") n[seg[i]] = {};
      n = n[seg[i]];
    }
    if (valeur === null) delete n[seg[seg.length - 1]];
    else n[seg[seg.length - 1]] = valeur;
  }

  // Répercute sur le cache les écritures qui viennent de partir, au lieu de le
  // jeter : sans ça, chaque écriture force la relecture des 116 ko de la racine.
  function appliquerAuCache(updates) {
    const rec = getCached();
    if (!rec) return;
    try {
      Object.keys(updates).forEach(c => poserChemin(rec, c, updates[c]));
      setCached(rec);
    } catch(e) { invalidateCache(); }   // au moindre doute, on jette
  }

  // ---------- API PUBLIQUE ----------
  // readBin → lit tout le record (racine)
  async function readBin() {
    try {
      const brut = await firebaseGet("");
      // Copie : la déduplication fait partager une même promesse à plusieurs
      // appelants, qui ne doivent pas muter le même objet.
      const record = brut ? JSON.parse(JSON.stringify(brut)) : {};
      memoriserSocle(record);
      return record;
    } catch(e) {
      err("readBin Firebase", e);
      return null;
    }
  }

  // safeReadBin → avec cache 60s
  async function safeReadBin() {
    const cached = getCached();
    if (cached) { memoriserSocle(cached); return cached; }
    const record = await readBin();
    if (record) setCached(record);
    return record;
  }

  // writeBin → n'écrit QUE les branches de premier niveau réellement modifiées.
  //
  // [MAJ] L'ancienne version faisait un PUT sur la racine : elle remplaçait la
  // base entière, effaçait toute écriture concurrente et supprimait toute
  // branche absente du record. D'où les contraintes d'ordonnancement
  // « avant / après le writeBin » dans fiche-staff, fiche-membre et
  // fiche-metier — devenues inutiles.
  //
  // Une branche absente du record n'est plus jamais supprimée : la suppression
  // d'un nœud entier passe par firebaseUpdate({chemin: null}), explicitement.
  async function writeBin(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error("writeBin : record invalide");
    }
    const updates = {};
    Object.keys(record).forEach(k => {
      const apres = JSON.stringify(record[k]);
      if (!_socle || _socle[k] !== apres) updates[k] = record[k];
    });
    const branches = Object.keys(updates);

    if (!branches.length) { log("writeBin : aucune modification"); return; }
    // Les appels légitimes touchent 1 à 4 branches. Au-delà, c'est un record
    // reconstruit de travers ou un appel hostile : on refuse.
    if (branches.length > BRANCHES_MAX) {
      throw new Error(`writeBin refusé : ${branches.length} branches modifiées (max ${BRANCHES_MAX}) — ${branches.join(", ")}`);
    }

    log("writeBin →", branches.join(", "));
    await firebaseUpdate(updates);
    setCached(record);
    memoriserSocle(record);
  }

  // writeField → écriture ciblée d'un seul champ
  async function writeField(path, data) {
    try {
      await firebasePut(path, data);
      appliquerAuCache({ [path]: data });
    } catch(e) {
      err(`writeField ${path}`, e);
      throw e;
    }
  }

    // Lecture ciblée, toujours fraîche : court-circuite le cache racine pour une
  // feuille dont l'exactitude compte à l'affichage (le solde). 
  async function lireFrais(chemin) {
    const v = await firebaseGet(chemin);
    appliquerAuCache({ [chemin]: v });
    return v;
  }

  // [MAJ] transactDollars a été SUPPRIMÉE : fonction morte (aucun appelant) qui
  // pointait encore vers le chemin obsolète `eco/membres/...` (préfixe abandonné
  // depuis le passage des collections à la racine). Les débits/crédits passent
  // par firebaseTransaction("membres/<pseudo>/dollars", …) en direct.

  // ---------- Extractors ----------
  function getPseudo(){ try{ return _userdata?.username?.trim()||null; }catch(e){ return null; } }
  function getUserId(){ try{ return parseInt(_userdata?.user_id)||0; }catch(e){ return 0; } }
  function getMessagesCount(){ try{ return parseInt(_userdata?.user_posts)||0; }catch(e){ return 0; } }

  // [MAJ] fetchUserGroupFromProfile a été RETIRÉE.

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
    ADMIN_USERS, GROUPS, COMMUNAUTES, GROUPES_FA, DEFAULT_DOLLARS, MONNAIE_NAME,
    MENU_SELECTOR, RETRY_INTERVAL_MS, RETRY_MAX,
    // Logs
    log, warn, err,
    // API données (même noms qu'avant)
    readBin, safeReadBin, writeBin,
     // Nouvelles API Firebase
    writeField, lireFrais, invalidateCache,
    firebaseGet, firebaseTransaction, firebasePush, firebaseUpdate,
    // Extractors & helpers
    getPseudo, getUserId, getMessagesCount,
    insertAfter, createErrorBanner, showEcoGain
  };

  log("eco-core Firebase prêt.");

})();
