// === EcoV2 CORE ===
// Base, configuration et outils partagés
console.log("[EcoV2] Chargement eco-core.js");

(function(){
  // ---------- CONFIG ----------
  const BIN_ID = "68f92d16d0ea881f40b3f36f";
  const API_KEY = "$2a$10$yVl9vTE.d/B4Hbmu8n6pyeHDM9PgPVHCBryetKJ3.wLHr7wa6ivyq";
  const JSONBIN_PROXY_BASE = "https://corsproxy.io/?url=https://api.jsonbin.io/v3/b/";
  const ADMIN_USERS = ["Mami Wata", "Jason Blackford"];
  const GROUPS = ["Les Goulipiats","Les Fardoches","Les Ashlanders","Les Spectres","Les Perles","Providence"];
  const MONNAIE_NAME = "Dollars";
  const DEFAULT_DOLLARS = 10;

  // ---------- LOGGING ----------
  window.addEventListener("error", e => console.error("[EcoV2] onerror:", e.error || e.message, e));
  window.addEventListener("unhandledrejection", e => console.error("[EcoV2] unhandled:", e.reason));
  const log  = (...a)=>{try{console.log("[EcoV2]",...a);}catch(e){}};
  const warn = (...a)=>{try{console.warn("[EcoV2]",...a);}catch(e){}};
  const err  = (...a)=>{try{console.error("[EcoV2]",...a);}catch(e){}};

  // ---------- JSONBin helpers ----------
  async function readBin(retries = 3) {
    const url = `${JSONBIN_PROXY_BASE}${BIN_ID}/latest`;
    for (let i = 0; i < retries; i++) {
      try {
        const r = await fetch(url, { headers: { "X-Master-Key": API_KEY } });
        if (r.ok) return (await r.json()).record || {};
        if ([425,429,500,502,503].includes(r.status)) { await new Promise(res=>setTimeout(res,1000)); continue; }
      } catch(e) { await new Promise(res=>setTimeout(res,1000)); }
    }
    err("readBin", "Échec après plusieurs tentatives");
    return null;
  }

  async function writeBin(record, retries = 3) {
    const url = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
    for (let i=0;i<retries;i++){
      try {
        const r = await fetch(url, {
          method:"PUT",
          headers:{
            "Content-Type":"application/json",
            "X-Master-Key":API_KEY,
            "X-Bin-Versioning":"false"
          },
          body: JSON.stringify(record)
        });
        if (r.ok) return await r.json();
        if ([425,429,500,502,503].includes(r.status)) { await new Promise(res=>setTimeout(res,1000)); continue; }
      } catch(e){ await new Promise(res=>setTimeout(res,1000)); }
    }
    err("writeBin","Échec après plusieurs tentatives");
  }

  async function safeReadBin(){
    const now = Date.now();
    const cached = sessionStorage.getItem("eco_cache_record");
    const cacheTime = sessionStorage.getItem("eco_cache_time");
    if(cached && cacheTime && now - parseInt(cacheTime) < 60000)
      return JSON.parse(cached);
    const record = await readBin();
    if(record){
      sessionStorage.setItem("eco_cache_record",JSON.stringify(record));
      sessionStorage.setItem("eco_cache_time",now.toString());
    }
    return record;
  }

  // ---------- EXTRACTORS ----------
  const getPseudo = ()=>_userdata?.username?.trim()||null;
  const getUserId = ()=>parseInt(_userdata?.user_id)||0;
  const getMessagesCount = ()=>parseInt(_userdata?.user_posts)||0;
  async function fetchUserGroupFromProfile(id){
    if(!id) return null;
    try{
      const r = await fetch(`/u${id}`); if(!r.ok) return null;
      const html = await r.text();
      const d = document.createElement("div"); d.innerHTML = html;
      const dd = d.querySelector("dd,.usergroup,.group,.user-level");
      if(dd && dd.textContent.trim()) return dd.textContent.trim();
      const m = html.match(/(Les [A-ZÀ-Ÿa-zà-ÿ0-9_\- ]{2,40})/);
      return m?m[1].trim():null;
    }catch(e){ err("fetchUserGroup", e); return null; }
  }

  // ---------- DOM HELPERS ----------
  const insertAfter = (t,e)=>{ if(!t||!t.parentNode)return false; t.parentNode.insertBefore(e,t.nextSibling); return true; };
  const createErrorBanner = (m)=>{ const b=document.createElement("div"); b.style.cssText="background:#ffdede;color:#600;border:2px solid #f99;padding:8px;text-align:center;margin:6px;"; b.textContent=m; return b; };

  // ---------- NOTIFICATION ----------
  function showEcoGain(gain){
    if(!gain||gain<=0)return;
    const n=document.createElement("div");
    n.textContent=`💰 +${gain} ${MONNAIE_NAME}`;
    n.style.cssText=`position:fixed;top:20px;left:50%;transform:translateX(-50%);
    background:#e6ffe6;color:#075e07;border:2px solid #6fd36f;border-radius:10px;
    padding:8px 16px;font-weight:600;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.2);
    opacity:0;transition:opacity .4s,transform .4s;z-index:999;`;
    document.body.appendChild(n);
    setTimeout(()=>{n.style.opacity="1";},50);
    setTimeout(()=>{n.style.opacity="0";setTimeout(()=>n.remove(),600);},2500);
  }

  // ---------- EXPORT ----------
  window.EcoCore = {
    log, warn, err,
    readBin, writeBin, safeReadBin,
    getPseudo, getUserId, getMessagesCount, fetchUserGroupFromProfile,
    insertAfter, createErrorBanner, showEcoGain,
    MONNAIE_NAME, GROUPS, ADMIN_USERS, DEFAULT_DOLLARS
  };
})();
