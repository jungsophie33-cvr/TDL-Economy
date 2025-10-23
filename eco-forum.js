// === ECONOMIE V2 – ModernBB (version stable) ===
// Auteur : ChatGPT x THE DROWNED LANDS
console.log("[EcoV2] >>> début du script");
(function(){

  // Stop complet si invité
if (typeof _userdata === "undefined" || !_userdata || _userdata.user_id == -1 || _userdata.username === "anonymous") {
  console.log("[EcoV2] invité détecté — économie désactivée.");
  return;
}


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

// ---------- Helpers & logs ----------
window.addEventListener("error", e => console.error("[EcoV2] onerror:", e.error || e.message, e));
window.addEventListener("unhandledrejection", e => console.error("[EcoV2] unhandled:", e.reason));
function log(...a){try{console.log("[EcoV2]",...a);}catch(e){}}
function warn(...a){try{console.warn("[EcoV2]",...a);}catch(e){}}
function err(...a){try{console.error("[EcoV2]",...a);}catch(e){}}

// ---------- JSONBin helpers ----------
async function readBin(){
  try{
    const url=`${JSONBIN_PROXY_BASE}${BIN_ID}/latest`;
    const r=await fetch(url,{method:"GET",headers:{"X-Master-Key":API_KEY}});
    if(!r.ok){warn("readBin status",r.status);return null;}
    const j=await r.json();
    return j.record||{};
  }catch(e){err("readBin",e);return null;}
}
async function writeBin(record){
  try{
    const r=await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`,{
      method:"PUT",
      headers:{
        "Content-Type":"application/json",
        "X-Master-Key":API_KEY,
        "X-Bin-Versioning":"false"
      },
      body:JSON.stringify(record)
    });
    if(!r.ok)throw new Error("Write failed");
    return await r.json();
  }catch(e){err("writeBin",e);}
}

// ---------- Extractors ----------
function getPseudo(){try{return _userdata?.username?.trim()||null;}catch(e){return null;}}
function getUserId(){try{return parseInt(_userdata?.user_id)||0;}catch(e){return 0;}}
function getMessagesCount(){try{return parseInt(_userdata?.user_posts)||0;}catch(e){return 0;}}
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

// ---------- DOM helpers ----------
function insertAfter(t,e){if(!t||!t.parentNode)return false;t.parentNode.insertBefore(e,t.nextSibling);return true;}
function createErrorBanner(m){const b=document.createElement("div");b.style.cssText="background:#ffdede;color:#600;border:2px solid #f99;padding:8px;text-align:center;margin:6px;";b.textContent=m;return b;}

// ---------- UPDATE DOLLARS DANS LES POSTS ----------
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

// ---------- CORE INIT ----------
async function coreInit(){
  log("Initialisation...");
  const menu=document.querySelector(MENU_SELECTOR);
  if(!menu){warn("Menu non trouvé");return;}

  const loading=document.createElement("div");
  loading.id="eco-loading";
  loading.style.cssText="background:#fffbe6;padding:6px;text-align:center;border:1px solid #ffecb3;margin-top:6px;";
  loading.textContent="Initialisation économie…";
  insertAfter(menu,loading);

  const record=await readBin();
  if(!record){loading.replaceWith(createErrorBanner("Erreur : lecture JSONBin impossible."));return;}
  record.membres=record.membres||{};
  record.cagnottes=record.cagnottes||{};
  GROUPS.forEach(g=>{if(record.cagnottes[g]===undefined)record.cagnottes[g]=0;});
  record.boutique=record.boutique||{};
  await writeBin(record).catch(()=>null);

const pseudo = getPseudo(), uid = getUserId();

// --- Protection contre les invités / anonymous ---
if (!pseudo || pseudo.toLowerCase() === "anonymous" || uid === -1) {
  loading.replaceWith(createErrorBanner("Les invités n'ont pas accès à l'économie."));
  console.warn("[EcoV2] Ignoré : utilisateur invité (anonymous)");
  return;
}

// --- Si jamais pseudo vide (bug temporaire de Forumactif) ---
if (!pseudo) {
  loading.replaceWith(createErrorBanner("Connecte-toi pour initialiser l'économie."));
  return;
}


  if(!record.membres[pseudo]){
    const g=await fetchUserGroupFromProfile(uid);
    record.membres[pseudo]={dollars:DEFAULT_DOLLARS,messages:getMessagesCount(),group:g||null,lastMessageThresholdAwarded:0};
    await writeBin(record).catch(()=>null);
  }else{
    record.membres[pseudo].messages=getMessagesCount();
    if(!record.membres[pseudo].group){
      const g=await fetchUserGroupFromProfile(uid);
      if(g){record.membres[pseudo].group=g;await writeBin(record).catch(()=>null);}
    }
  }

  try{
    const sj=document.querySelector("#sj-dollars");
    if(sj)sj.textContent=record.membres[pseudo].dollars;
  }catch(e){err("sync sj-dollars",e);}

  setTimeout(()=>{
    try{
      const box=document.createElement("div");
      box.id="eco-solde-box";
      let html=`<span id="eco-solde">${record.membres[pseudo].dollars}</span> ${MONNAIE_NAME} — Cagnottes : `;
      GROUPS.forEach(g=>html+=`<span style="margin-left:8px">${g}: <b id="eco-cag-${g.replace(/\s/g,"_")}">${record.cagnottes[g]||0}</b></span>`);
      box.innerHTML=html;insertAfter(menu,box);
    }catch(e){err("afficher solde",e);}
  },600);

  // --- ADMIN BAR ---
  const adminBar=document.getElementById("eco-admin-bar");
  if(!adminBar)return;
  const adminSection=document.getElementById("eco-admin-section");
  if(ADMIN_USERS.includes(pseudo)){if(adminSection)adminSection.style.display="block";}
  else if(adminSection)adminSection.remove();

  try{
    document.getElementById("eco-btn-cag")?.addEventListener("click",async()=>{
      const rec=await readBin();alert("Cagnottes:\n"+JSON.stringify(rec.cagnottes,null,2));
    });
    document.getElementById("eco-btn-shop")?.addEventListener("click",async()=>{
      const rec=await readBin();alert("Boutique:\n"+JSON.stringify(rec.boutique||{},null,2));
    });
    document.getElementById("eco-btn-don")?.addEventListener("click",async()=>{
      const montant=parseInt(prompt("Montant du don :","0"));
      if(isNaN(montant)||montant<=0)return alert("Montant invalide.");
      const rec=await readBin();const grp=rec.membres[pseudo]?.group;
      if(!grp)return alert("Ton groupe est inconnu.");
      if((rec.membres[pseudo]?.dollars||0)<montant)return alert("Fonds insuffisants !");
      rec.membres[pseudo].dollars-=montant;
      rec.cagnottes[grp]=(rec.cagnottes[grp]||0)+montant;
      await writeBin(rec);alert("✅ Don effectué !");
      const el=document.querySelector("#sj-dollars");if(el)el.textContent=rec.membres[pseudo].dollars;
      const cag=document.getElementById(`eco-cag-${grp.replace(/\s/g,"_")}`);if(cag)cag.textContent=rec.cagnottes[grp];
    });
  }catch(e){err("adminBar",e);}

  // --- PANEL ADMIN ---
  const toggle=document.getElementById("eco-reset-toggle");
  if(toggle){
    toggle.addEventListener("click",()=>{
      const p=document.getElementById("eco-reset-panel");
      const opened=p.style.display==="block";
      p.style.display=opened?"none":"block";
      toggle.textContent=opened?"▶ Réinitialisations":"▼ Réinitialisations";
    });
  }

  (async function populateSelects(){
    const rec=await readBin();if(!rec)return;
    const msel=document.getElementById("eco-member-select");
    const csel=document.getElementById("eco-cag-select");
    if(msel){msel.innerHTML="";Object.keys(rec.membres||{}).sort().forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;msel.appendChild(o);});}
    if(csel){csel.innerHTML="";Object.keys(rec.cagnottes||{}).forEach(g=>{const o=document.createElement("option");o.value=g;o.textContent=g;csel.appendChild(o);});}
  })();

  // --- RÉINITIALISATIONS ---
  document.getElementById("eco-reset-member")?.addEventListener("click",async()=>{
    const choix=document.getElementById("eco-member-select")?.value;
    if(!choix)return alert("Aucun membre sélectionné !");
    if(!confirm(`Remettre ${choix} à 0 ${MONNAIE_NAME} ?`))return;
    const rec=await readBin();if(!rec.membres[choix])return alert("Membre inconnu !");
    rec.membres[choix].dollars=0;await writeBin(rec);alert(`${choix} a été réinitialisé.`);
  });

  document.getElementById("eco-reset-all-members")?.addEventListener("click",async()=>{
    if(!confirm("⚠️ Réinitialiser TOUS les membres ?"))return;
    const rec=await readBin();for(const m in rec.membres)rec.membres[m].dollars=0;
    await writeBin(rec);alert("Tous les membres ont été remis à 0.");
  });

  document.getElementById("eco-reset-cagnotte")?.addEventListener("click",async()=>{
    const choix=document.getElementById("eco-cag-select")?.value;
    if(!choix)return alert("Aucune cagnotte sélectionnée !");
    if(!confirm(`Remettre ${choix} à 0 ?`))return;
    const rec=await readBin();rec.cagnottes[choix]=0;await writeBin(rec);alert(`Cagnotte ${choix} réinitialisée.`);
  });

  document.getElementById("eco-reset-all-cagnottes")?.addEventListener("click",async()=>{
    if(!confirm("⚠️ Tout remettre à 0 ?"))return;
    const rec=await readBin();for(const g in rec.cagnottes)rec.cagnottes[g]=0;
    await writeBin(rec);alert("Toutes les cagnottes remises à 0.");
  });

  // --- DISTRIBUTION GLOBALE ---
  const giveAll=document.getElementById("eco-giveall-btn");
  if(giveAll){
    giveAll.addEventListener("click",async()=>{
      const val=parseInt(document.getElementById("eco-giveall-amount").value,10);
      if(isNaN(val)||val<=0)return alert("Montant invalide.");
      if(!confirm(`Ajouter ${val} ${MONNAIE_NAME} à tous ?`))return;
      const rec=await readBin();let count=0;
      for(const n in rec.membres){rec.membres[n].dollars=(rec.membres[n].dollars||0)+val;count++;}
      await writeBin(rec);showEcoGain(val);updatePostDollars();
      alert(`${val} ${MONNAIE_NAME} ajoutés à ${count} membres.`);
    });
  }

  // remove loading
  loading.remove();
  log("Initialisation terminée.");
  updatePostDollars(); // <-- affiche les bons montants dans les profils
} // coreInit end

// ---------- GAINS AUTOMATIQUES ----------
const GAIN_RULES={presentation_new:20,presentation_reply:5,preliens_or_gestion_new:10,preliens_or_gestion_reply:2,houma_terrebonne_new:15,houma_terrebonne_reply:10,vote_topic_reply:2};
const FORUM_IDS={presentations:"/f5-presentations",preliens:"/f3-pre-liens",gestionPersos:"/f6-gestion-des-personnages",voteTopicName:"vote aux top-sites"};
const RP_ZONES=["/f7-les-bayous-sauvages","/f8-downtown-houma","/f9-bayou-cane","/f10-bayou-blue","/f11-mandalay-national-wildlife-refuge","/f12-terrebonne-bay"];

function ecoAttachPostListeners() {
  // On cherche tous les formulaires de post (nouveau sujet ou réponse rapide)
  const forms = document.querySelectorAll(
    'form[name="post"], form[id*="post"], form[action*="post"], form[action*="posting"], form#quick_reply, form#qrform'
  );

  if (!forms.length) {
    console.warn("[EcoV2] Aucun formulaire de post trouvé.");
    return;
  }

  forms.forEach(f => {
    if (f.__eco_listening) return;
    f.__eco_listening = true;

    log("Formulaire de post détecté :", f.action || "(aucune action)");

    f.addEventListener("submit", () => {
      try {
        const isNewTopic = !!f.querySelector('input[name="subject"]');
        let forumId = null;

        // 1️⃣ priorité : champ caché dans le formulaire
        const forumIdField = f.querySelector('input[name="f"]');
        if (forumIdField) forumId = forumIdField.value;

        // 2️⃣ sinon : essayer de le déduire depuis la breadcrumb
        if (!forumId) {
          const breadcrumb = document.querySelector(".sub-header-path");
          if (breadcrumb) {
            const forumLink = Array.from(breadcrumb.querySelectorAll('a[href*="/f"]')).pop();
            if (forumLink) forumId = forumLink.getAttribute("href");
          }
        }

        // 3️⃣ fallback final : URL courante
        if (!forumId) forumId = location.pathname;

        // On stocke l’info pour la relance après redirection
        sessionStorage.setItem(
          "ecoJustPosted",
          JSON.stringify({ t: Date.now(), newTopic: isNewTopic, fid: forumId })
        );

        console.log("[EcoV2] ➕ Post intercepté :", forumId, "isNew =", isNewTopic);
      } catch (e) {
        console.error("[EcoV2] ecoAttachPostListeners error", e);
      }
    });
  });
}


async function ecoCheckPostGain(info){
  try{
    const s=info||JSON.parse(sessionStorage.getItem("ecoJustPosted")||"null");
    if(!s)return;
    const pseudo=getPseudo();if(!pseudo)return;
    const record=await readBin();if(!record)return;
    const membres=record.membres;if(!membres[pseudo])return;
    let path=location.pathname.toLowerCase();
    const isNew=!!s.newTopic;let gain=0;
    if(path.includes(FORUM_IDS.presentations))gain=isNew?GAIN_RULES.presentation_new:GAIN_RULES.presentation_reply;
    else if(path.includes(FORUM_IDS.preliens)||path.includes(FORUM_IDS.gestionPersos))gain=isNew?GAIN_RULES.preliens_or_gestion_new:GAIN_RULES.preliens_or_gestion_reply;
    else if(RP_ZONES.some(z=>path.includes(z)))gain=isNew?GAIN_RULES.houma_terrebonne_new:GAIN_RULES.houma_terrebonne_reply;
    else{
      const title=document.querySelector(".topic-title,h1.topictitle,.page-title")?.textContent.toLowerCase()||"";
      if(title.includes(FORUM_IDS.voteTopicName)&&!isNew)gain=GAIN_RULES.vote_topic_reply;
    }
    if(gain>0){
      membres[pseudo].dollars=(membres[pseudo].dollars||0)+gain;
      await writeBin(record);showEcoGain(gain);updatePostDollars();
    }
  }catch(e){err("ecoCheckPostGain",e);}
}

ecoAttachPostListeners();

// ---------- BOOT ----------
let tries=0;
const timer=setInterval(async()=>{
  tries++;
  const menu=document.querySelector(MENU_SELECTOR);
  if(menu){clearInterval(timer);try{await coreInit();}catch(e){err("coreInit",e);}}
  else if(tries>=RETRY_MAX){clearInterval(timer);warn("menu not found");document.body.prepend(createErrorBanner("Initialisation économie : menu introuvable."));}
},RETRY_INTERVAL_MS);

// ---------- POST DELAY ----------
window.addEventListener("load",()=>{
  setTimeout(async()=>{
    const s=sessionStorage.getItem("ecoJustPosted");if(!s)return;
    const data=JSON.parse(s);if(Date.now()-data.t>30000)return sessionStorage.removeItem("ecoJustPosted");
    await ecoCheckPostGain(data);sessionStorage.removeItem("ecoJustPosted");
  },2500);
});

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

console.log("[EcoV2] <<< fin du script");
})();

