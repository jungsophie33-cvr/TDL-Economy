// === ECONOMIE V2 – ModernBB (version stable et complète) ===
// Auteur : ChatGPT x THE DROWNED LANDS
console.log("[EcoV2] >>> début du script");
(function(){

  // --- CONFIGS DE BASE ---
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

  // --- LOGGING ---
  window.addEventListener("error", e => console.error("[EcoV2] onerror:", e.error || e.message, e));
  window.addEventListener("unhandledrejection", e => console.error("[EcoV2] unhandled:", e.reason));
  const log = (...a)=>console.log("[EcoV2]",...a);
  const warn = (...a)=>console.warn("[EcoV2]",...a);
  const err = (...a)=>console.error("[EcoV2]",...a);

  // --- MODE INVITÉ : lecture seule ---
  if (typeof _userdata === "undefined" || !_userdata || _userdata.user_id == -1 || _userdata.username === "anonymous") {
    console.log("[EcoV2] invité détecté — lecture seule activée.");
    (async () => {
      try {
        const r = await fetch(`${JSONBIN_PROXY_BASE}${BIN_ID}/latest`, { headers: { "X-Master-Key": API_KEY }});
        if (!r.ok) return;
        const j = await r.json();
        const record = j.record || {};
        const membres = record.membres || {};

        // MàJ dollars dans profils de post
        document.querySelectorAll(".sj-post-proftop,.post,.postprofile").forEach(post=>{
          const pseudoEl = post.querySelector(".sj-post-pseudo strong,.postprofile-name strong,.username");
          if(!pseudoEl) return;
          const pseudo = pseudoEl.textContent.trim();
          const user = membres[pseudo];
          const val = post.querySelector(".field-dollars span:not(.label)");
          if(user && val) val.textContent = user.dollars ?? 0;
        });

        // MàJ cagnottes globales
        if (record.cagnottes) {
          Object.entries(record.cagnottes).forEach(([g,v])=>{
            const el=document.getElementById(`eco-cag-${g.replace(/\s/g,"_")}`);
            if(el) el.textContent=v;
          });
        }
      } catch(e){ console.warn("[EcoV2] invité: erreur lecture bin", e); }
    })();
    return;
  }

  // --- JSONBIN HELPERS ---
  async function readBin(retries = 3) {
    const url = `${JSONBIN_PROXY_BASE}${BIN_ID}/latest`;
    for (let i=0;i<retries;i++){
      try{
        await new Promise(r=>setTimeout(r,1000));
        const r = await fetch(url,{method:"GET",headers:{"X-Master-Key":API_KEY}});
        if(r.ok){const j=await r.json();return j.record||{};}
        if([425,429,500,502,503].includes(r.status)){await new Promise(res=>setTimeout(res,1000));continue;}
        break;
      }catch(e){await new Promise(res=>setTimeout(res,1000));}
    }
    err("readBin","Échec après plusieurs tentatives");return null;
  }

  async function writeBin(record,retries=3){
    const url=`https://api.jsonbin.io/v3/b/${BIN_ID}`;
    for(let i=0;i<retries;i++){
      try{
        await new Promise(r=>setTimeout(r,1000));
        const r=await fetch(url,{method:"PUT",headers:{"Content-Type":"application/json","X-Master-Key":API_KEY,"X-Bin-Versioning":"false"},body:JSON.stringify(record)});
        if(r.ok){log(`[EcoV2] writeBin succès (tentative ${i+1})`);return await r.json();}
        if([425,429,500,502,503].includes(r.status)){await new Promise(res=>setTimeout(res,1000));continue;}
        throw new Error(`writeBin status ${r.status}`);
      }catch(e){await new Promise(res=>setTimeout(res,1000));}
    }
    err("writeBin","Échec après plusieurs tentatives");
  }

  // --- UTILITAIRES ---
  const getPseudo=()=>_userdata?.username?.trim()||null;
  const getUserId=()=>parseInt(_userdata?.user_id)||0;
  const getMessagesCount=()=>parseInt(_userdata?.user_posts)||0;
  async function fetchUserGroupFromProfile(id){
    if(!id)return null;
    try{
      const r=await fetch(`/u${id}`);if(!r.ok)return null;
      const html=await r.text();const d=document.createElement("div");d.innerHTML=html;
      const dd=d.querySelector("dd,.usergroup,.group,.user-level");
      if(dd&&dd.textContent.trim())return dd.textContent.trim();
      const m=html.match(/(Les [A-ZÀ-Ÿa-zà-ÿ0-9_\- ]{2,40})/);
      return m?m[1].trim():null;
    }catch(e){err("fetchUserGroup",e);return null;}
  }

  // --- DOLLARS DANS LES POSTS ---
  async function updatePostDollars(){
    try{
      const record=await readBin();if(!record||!record.membres)return;
      document.querySelectorAll(".sj-post-proftop,.post,.postprofile").forEach(post=>{
        const pseudoEl=post.querySelector(".sj-post-pseudo strong,.postprofile-name strong,.username");
        if(!pseudoEl)return;
        const pseudo=pseudoEl.textContent.trim();
        const user=record.membres[pseudo];if(!user)return;
        const val=post.querySelector(".field-dollars span:not(.label)");
        if(val)val.textContent=user.dollars??0;
      });
      log("Màj champs dollars terminée");
    }catch(e){err("updatePostDollars",e);}
  }

  // --- GESTION GAINS AUTOMATIQUES ---
  const GAIN_RULES = {
    presentation_new: 20,
    presentation_reply: 5,
    preliens_or_gestion_new: 10,
    preliens_or_gestion_reply: 2,
    houma_terrebonne_new: 15,
    houma_terrebonne_reply: 10,
    vote_topic_reply: 2
  };
  const TAG_BONUS = {
    "#intrigue":10,
    "#event":5,
    "#enquete":5,
    "#solve":20,
    "#defi":5,
    "#mintrigue":5
  };
  const FORUM_IDS = {
    presentations: "/f5-presentations",
    preliens: "f4-en-construction",
    gestionPersos: "/f6-gestion-des-personnages",
    voteTopicName: "t22-vote-aux-top-sites"
  };
  const RP_ZONES = [
    "/f7-les-bayous-sauvages",
    "/f8-downtown-houma",
    "/f9-bayou-cane",
    "/f10-bayou-blue",
    "/f11-mandalay-national-wildlife-refuge",
    "/f12-terrebonne-bay"
  ];

  // --- CALCUL DU GAIN APRÈS POST ---
  async function ecoCheckPostGain(info){
    try{
      const s=info||JSON.parse(sessionStorage.getItem("ecoJustPosted")||"null");
      if(!s)return;
      const pseudo=getPseudo(); if(!pseudo)return;

      // Ignore prévisualisation / édition
      if(location.pathname.includes("/post")){
        console.log("[EcoV2][GAIN] Page /post détectée — aucun gain attribué.");
        return;
      }

      // Attente breadcrumb
      await new Promise(resolve=>{
        if(document.querySelector(".sub-header-path"))return resolve();
        const obs=new MutationObserver(()=>{
          if(document.querySelector(".sub-header-path")){obs.disconnect();resolve();}
        });
        obs.observe(document.body,{childList:true,subtree:true});
        setTimeout(()=>{obs.disconnect();resolve();},2000);
      });

      const record=await readBin();
      if(!record)return;
      const membres=record.membres||{};
      if(!membres[pseudo])return;

      // Chemin forum
      let path="";
      const bc=document.querySelector(".sub-header-path");
      if(bc){
        const links=Array.from(bc.querySelectorAll('a[href*="/f"]'));
        const last=links.pop();
        if(last)path=last.getAttribute("href").toLowerCase();
      }
      if(!path&&s.fid){path=String(s.fid).toLowerCase();if(/^\d+$/.test(path))path=`/f${path}`;}
      if(!path)path=location.pathname.toLowerCase();

      let isNew=!!s.newTopic;
      if(!location.href.includes("mode=newtopic"))isNew=false;

      let gain=0;
      if(path.includes(FORUM_IDS.presentations)){
        gain=isNew?GAIN_RULES.presentation_new:GAIN_RULES.presentation_reply;
      }else if(path.includes(FORUM_IDS.preliens)||path.includes(FORUM_IDS.gestionPersos)){
        gain=isNew?GAIN_RULES.preliens_or_gestion_new:GAIN_RULES.preliens_or_gestion_reply;
      }else if(RP_ZONES.some(z=>path.includes(z))){
        gain=isNew?GAIN_RULES.houma_terrebonne_new:GAIN_RULES.houma_terrebonne_reply;
      }else{
        const title=(document.querySelector(".topic-title,h1.topictitle,.page-title")?.textContent||"").toLowerCase();
        if(title.includes(FORUM_IDS.voteTopicName)&&!isNew)gain=GAIN_RULES.vote_topic_reply;
      }

      // BONUS TAGS
      let postText="";
      try{
        const posts=Array.from(document.querySelectorAll(".sj-post-msg,.postbody,.content,.post,.message"));
        if(posts.length>0)postText=posts[posts.length-1].textContent.toLowerCase();
        let tagBonus=0;
        for(const [tag,bonus] of Object.entries(TAG_BONUS)){
          if(postText.includes(tag)){tagBonus+=bonus;log(`[EcoV2][TAG BONUS] ${tag} +${bonus}`);}
        }
        if(tagBonus>0)gain+=tagBonus;
      }catch(e){warn("[EcoV2] erreur tags",e);}

      // BONUS DE RÉACTIVITÉ
      try{
        if(RP_ZONES.some(z=>path.includes(z))){
          const posts=Array.from(document.querySelectorAll(".post,.sj-post"));
          if(posts.length>=2){
            const prevPost=posts[posts.length-2];
            const dateEl=prevPost.querySelector(".sj-post-infotop .sj-post-date span:nth-child(2)");
            if(dateEl){
              const raw=dateEl.textContent.trim();
              const now=new Date();
              let prevDate=null;
              const match=raw.match(/(\d{1,2}):(\d{2})/);
              if(raw.includes("Aujourd")){
                prevDate=new Date(now);
                if(match)prevDate.setHours(parseInt(match[1]),parseInt(match[2]),0,0);
              }else if(raw.includes("Hier")){
                prevDate=new Date(now);prevDate.setDate(now.getDate()-1);
                if(match)prevDate.setHours(parseInt(match[1]),parseInt(match[2]),0,0);
              }else{
                const clean=raw.replace("à","").replace("-","").replace(/\s{2,}/g," ").trim();
                prevDate=new Date(clean);
              }
              if(prevDate&&!isNaN(prevDate)){
                const diff=(Date.now()-prevDate.getTime())/(1000*60*60);
                let bonus=0;
                if(diff<24)bonus=10;
                else if(diff<48)bonus=5;
                if(bonus>0){gain+=bonus;log(`[EcoV2][BONUS RP] ${diff.toFixed(1)}h → +${bonus}`);}
              }
            }
          }
        }
      }catch(e){warn("[EcoV2] erreur bonus RP",e);}

      // ATTRIBUTION
      if(gain>0){
        membres[pseudo].dollars=(membres[pseudo].dollars||0)+gain;
        await writeBin(record);
        showEcoGain(gain);
        updatePostDollars();
        log(`[EcoV2] 💰 +${gain} ${MONNAIE_NAME} pour ${pseudo}`);
      }
    }catch(e){err("ecoCheckPostGain",e);}
  }

  // --- DÉTECTION POST & RETOUR REDIRECTION ---
  function ecoAttachPostListeners(){
    const forms=document.querySelectorAll('form[name="post"],form#quick_reply,form[action*="post"],form[action*="posting"],form#qrform');
    if(!forms.length){warn("[EcoV2] Aucun formulaire de post trouvé.");return;}
    forms.forEach(f=>{
      if(f.__eco_listening)return;
      f.__eco_listening=true;
      log("Formulaire détecté :",f.action);
      const handler=()=>{
        try{
          const isNewTopic=location.href.includes("mode=newtopic");
          let forumId=null;
          const bc=document.querySelector(".sub-header-path");
          if(bc){
            const links=Array.from(bc.querySelectorAll('a[href*="/f"]'));
            const last=links.pop();
            if(last)forumId=last.getAttribute("href");
          }
          if(!forumId){
            const fInput=f.querySelector('input[name="f"]');
            forumId=fInput?fInput.value:null;
          }
          if(!forumId)forumId=location.pathname;
          const data={t:Date.now(),newTopic:isNewTopic,fid:forumId};
          sessionStorage.setItem("ecoJustPosted",JSON.stringify(data));
        }catch(e){err("ecoAttachPostListeners",e);}
      };
      f.addEventListener("submit",handler);
      const btn=f.querySelector('input[type="submit"],button[type="submit"]');
      if(btn)btn.addEventListener("click",handler);
    });
  }

  window.addEventListener("load",()=>{
    setTimeout(()=>ecoAttachPostListeners(),1500);
    setTimeout(()=>{
      const s=sessionStorage.getItem("ecoJustPosted");
      if(!s)return;
      const data=JSON.parse(s);
      const age=Date.now()-data.t;
      if(age>30000)return sessionStorage.removeItem("ecoJustPosted");
      ecoCheckPostGain(data);
      sessionStorage.removeItem("ecoJustPosted");
    },3500);
  });

  // --- GAIN VISUEL ---
  function showEcoGain(gain){
    if(!gain||gain<=0)return;
    const n=document.createElement("div");
    n.textContent=`💰 +${gain} ${MONNAIE_NAME}`;
    n.style.cssText=`position:fixed;top:20px;left:50%;transform:translateX(-50%);
    background:#e6ffe6;color:#075e07;border:2px solid #6fd36f;border-radius:10px;
    padding:8px 16px;font-weight:600;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.2);
    opacity:0;transition:opacity .4s,transform .4s;z-index:999;`;
    document.body.appendChild(n);
    setTimeout(()=>n.style.opacity="1",50);
    setTimeout(()=>{n.style.opacity="0";setTimeout(()=>n.remove(),600);},2500);
  }

  console.log("[EcoV2] <<< fin du script");
})();

