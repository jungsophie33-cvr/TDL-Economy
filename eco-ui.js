// === EcoV2 UI & ADMIN ===
console.log("[EcoV2] Chargement eco-ui.js");

(function(){
  const { log, warn, err, readBin, writeBin, safeReadBin,
          getPseudo, getUserId, getMessagesCount, fetchUserGroupFromProfile,
          insertAfter, createErrorBanner, showEcoGain,
          MONNAIE_NAME, GROUPS, ADMIN_USERS, DEFAULT_DOLLARS } = window.EcoCore;

  async function updatePostDollars(){
    try{
      const record = await safeReadBin();
      if(!record?.membres) return;
      document.querySelectorAll(".sj-post-proftop,.post,.postprofile").forEach(post=>{
        const pseudoEl = post.querySelector(".sj-post-pseudo strong,.postprofile-name strong,.username");
        if(!pseudoEl) return;
        const pseudo = pseudoEl.textContent.trim();
        const user = record.membres[pseudo];
        const val = post.querySelector(".field-dollars span:not(.label)");
        if(user && val) val.textContent = user.dollars ?? 0;
      });
    }catch(e){ err("updatePostDollars", e); }
  }

  async function coreInit(){
    log("Initialisation UI…");
    const menu = document.querySelector("body #sj-main .menu .sj-menu-top");
    if(!menu){ warn("Menu non trouvé"); return; }

    const loading = document.createElement("div");
    loading.id="eco-loading";
    loading.style.cssText="background:#fffbe6;padding:6px;text-align:center;border:1px solid #ffecb3;margin-top:6px;";
    loading.textContent="Initialisation économie…";
    insertAfter(menu, loading);

    const record = await safeReadBin();
    if(!record){ loading.replaceWith(createErrorBanner("Erreur lecture JSONBin.")); return; }
    record.membres ??= {};
    record.cagnottes ??= {};
    record.boutique ??= {};

    // Crée les cagnottes manquantes
    let newCagAdded = false;
    GROUPS.forEach(g=>{ if(record.cagnottes[g]===undefined){record.cagnottes[g]=0;newCagAdded=true;} });
    if(newCagAdded) await writeBin(record).catch(()=>null);

    const pseudo = getPseudo(), uid = getUserId();
    if(!pseudo || pseudo.toLowerCase()==="anonymous" || uid===-1){
      loading.replaceWith(createErrorBanner("Les invités n'ont pas accès à l'économie."));
      return;
    }

    // Création auto du membre si absent
    if(!record.membres[pseudo]){
      const g = await fetchUserGroupFromProfile(uid);
      record.membres[pseudo] = { dollars: DEFAULT_DOLLARS, messages:getMessagesCount(), group:g||null, lastMessageThresholdAwarded:0 };
      await writeBin(record).catch(()=>null);
    }

    // Assignation spéciale Providence
    if(pseudo==="Mami Wata" && record.membres[pseudo].group!=="Providence"){
      record.membres[pseudo].group="Providence"; await writeBin(record);
    }

    // MAJ affichages
    document.getElementById("sj-dollars")?.textContent = record.membres[pseudo].dollars;
    GROUPS.forEach(g=>{
      const el=document.getElementById(`eco-cag-${g.replace(/\s/g,"_")}`);
      if(el) el.textContent = record.cagnottes[g]||0;
    });

    // Affichage admin
    const adminSection=document.getElementById("eco-admin-section");
    if(adminSection){
      if(!ADMIN_USERS.includes(pseudo)) adminSection.remove();
      else adminSection.style.display="flex";
    }

    loading.remove();
    log("UI initialisée.");
    updatePostDollars();
  }

  window.EcoUI = { coreInit, updatePostDollars };
})();
