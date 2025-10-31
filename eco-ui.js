// === ECONOMIE V2 – UI & ADMIN ===
// Auteur : ChatGPT x THE DROWNED LANDS
console.log("[EcoV2] >>> eco-ui chargé");

(function(){

  const {
    log, warn, err,
    readBin, writeBin, safeReadBin,
    getPseudo, getUserId, getMessagesCount, fetchUserGroupFromProfile,
    insertAfter, createErrorBanner, showEcoGain,
    MONNAIE_NAME, GROUPS, ADMIN_USERS, DEFAULT_DOLLARS
  } = window.EcoCore;

  // ---------- UPDATE DOLLARS DANS LES POSTS ----------
  async function updatePostDollars(){
    try{
      const record = await safeReadBin();
      if(!record || !record.membres) return;
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
    const menu = document.querySelector(window.EcoCore.MENU_SELECTOR);
    if(!menu){ warn("Menu non trouvé"); return; }

    const loading = document.createElement("div");
    loading.id = "eco-loading";
    loading.style.cssText = "background:#fffbe6;padding:6px;text-align:center;border:1px solid #ffecb3;margin-top:6px;";
    loading.textContent = "Initialisation économie…";
    insertAfter(menu, loading);

    const record = await safeReadBin();
    if(!record){ loading.replaceWith(createErrorBanner("Erreur : lecture JSONBin impossible.")); return; }
    record.membres = record.membres || {};
    record.cagnottes = record.cagnottes || {};
    record.boutique = record.boutique || {};

    // --- Crée les cagnottes manquantes ---
    let newCagAdded = false;
    GROUPS.forEach(g => {
      if (record.cagnottes[g] === undefined) {
        record.cagnottes[g] = 0;
        newCagAdded = true;
        console.log(`[EcoV2] 🪙 Cagnotte créée : ${g}`);
      }
    });

    // 🧾 Si on a ajouté au moins une cagnotte → on sauvegarde
    if (newCagAdded) {
      try {
        await writeBin(record);
        console.log("[EcoV2] ✅ Nouvelle(s) cagnotte(s) sauvegardée(s).");
      } catch (e) {
        console.warn("[EcoV2] ⚠️ Impossible d’écrire les nouvelles cagnottes :", e);
      }
    }

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

    // --- Assignation forcée de Mami Wata au groupe Providence ---
    if (pseudo === "Mami Wata") {
      if (record.membres[pseudo].group !== "Providence") {
        record.membres[pseudo].group = "Providence";
        console.log("[EcoV2] 🔮 Mami Wata assignée de force à la Providence.");
        await writeBin(record).catch(()=>null);
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
        rec.membres[pseudo].dollars -= montant;
        rec.cagnottes[grp] = (rec.cagnottes[grp] || 0) + montant;
        if (!rec.donations) rec.donations = [];
        rec.donations.push({ date: new Date().toISOString(), membre: pseudo, groupe: grp, montant });
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
      const membres = Object.keys(rec.membres || {}).sort();
      const memberSelectIds = ["eco-member-select","eco-adjust-member","eco-transfer-from-member","eco-transfer-to-member"];
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

      const groupes = Object.keys(rec.cagnottes || {});
      const cagnotteSelectIds = ["eco-cag-select","eco-transfer-from","eco-transfer-to"];
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

      const cagToMemberFrom = document.getElementById("eco-transfer-cag-to-member-from");
      if (cagToMemberFrom) {
        cagToMemberFrom.innerHTML = "";
        Object.keys(rec.cagnottes || {}).forEach(g => {
          const o = document.createElement("option");
          o.value = g;
          o.textContent = g;
          cagToMemberFrom.appendChild(o);
        });
      }

      const cagToMemberTo = document.getElementById("eco-transfer-cag-to-member-to");
      if (cagToMemberTo) {
        cagToMemberTo.innerHTML = "";
        Object.keys(rec.membres || {}).sort().forEach(n => {
          const o = document.createElement("option");
          o.value = n;
          o.textContent = n;
          cagToMemberTo.appendChild(o);
        });
      }
    }

    // === AJUSTEMENT D’UN SOLDE MEMBRE ===
    document.getElementById("eco-adjust-btn")?.addEventListener("click", async () => {
      const msel = document.getElementById("eco-adjust-member");
      const valInput = document.getElementById("eco-adjust-amount");
      const membre = msel?.value;
      const montant = parseInt(valInput?.value, 10);
      if (!membre) return alert("Aucun membre sélectionné !");
      if (isNaN(montant) || montant === 0) return alert("Montant invalide.");
      if (!confirm(`${montant > 0 ? "Ajouter" : "Retirer"} ${Math.abs(montant)} Dollars à ${membre} ?`)) return;
      const rec = await readBin();
      if (!rec.membres[membre]) return alert("Membre inconnu !");
      rec.membres[membre].dollars = (rec.membres[membre].dollars || 0) + montant;
      if (rec.membres[membre].dollars < 0) rec.membres[membre].dollars = 0;
      await writeBin(rec);
      alert(`✅ Solde de ${membre} mis à jour (${montant > 0 ? "+" : ""}${montant} Dollars).`);
    });

    // === TRANSFERT ENTRE CAGNOTTES ===
    document.getElementById("eco-transfer-btn")?.addEventListener("click", async () => {
      const from = document.getElementById("eco-transfer-from")?.value;
      const to = document.getElementById("eco-transfer-to")?.value;
      const montant = parseInt(document.getElementById("eco-transfer-amount")?.value, 10);
      if (!from || !to || from === to) return alert("Sélection invalide");
      if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");
      const rec = await readBin();
      const cagnottes = rec.cagnottes || {};
      if ((cagnottes[from] || 0) < montant) return alert(`Fonds insuffisants dans ${from} !`);
      if (!confirm(`Transférer ${montant} Dollars de ${from} → ${to} ?`)) return;
      cagnottes[from] -= montant;
      cagnottes[to] = (cagnottes[to] || 0) + montant;
      if (!rec.transactions_cagnottes) rec.transactions_cagnottes = [];
      rec.transactions_cagnottes.push({ date: new Date().toISOString(), de: from, vers: to, montant, effectué_par: pseudo });
      await writeBin(rec);
      alert(`✅ ${montant} Dollars transférés de ${from} vers ${to}.`);
      const elFrom = document.getElementById(`eco-cag-${from.replace(/\s/g,"_")}`);
      const elTo = document.getElementById(`eco-cag-${to.replace(/\s/g,"_")}`);
      if (elFrom) elFrom.textContent = cagnottes[from];
      if (elTo) elTo.textContent = cagnottes[to];
    });

    // === TRANSFERT ENTRE MEMBRES ===
    document.getElementById("eco-transfer-btn-member")?.addEventListener("click", async () => {
      const from = document.getElementById("eco-transfer-from-member")?.value;
      const to = document.getElementById("eco-transfer-to-member")?.value;
      const montant = parseInt(document.getElementById("eco-transfer-amount-member")?.value, 10);
      if (!from || !to || from === to) return alert("Sélection invalide");
      if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");
      const rec = await readBin();
      const membres = rec.membres || {};
      if (!membres[from] || !membres[to]) return alert("Membre inconnu !");
      if ((membres[from].dollars || 0) < montant) return alert(`${from} n’a pas assez de fonds !`);
      if (!confirm(`Transférer ${montant} Dollars de ${from} → ${to} ?`)) return;
      membres[from].dollars -= montant;
      membres[to].dollars = (membres[to].dollars || 0) + montant;
      if (!rec.transactions_membres) rec.transactions_membres = [];
      rec.transactions_membres.push({ date: new Date().toISOString(), de: from, vers: to, montant, effectué_par: pseudo });
      await writeBin(rec);
      alert(`✅ ${montant} Dollars transférés de ${from} à ${to}.`);
      updatePostDollars();
    });

    // === TRANSFERT CAGNOTTE → MEMBRE ===
    const transferCagToMemberBtn = document.getElementById("eco-transfer-cag-to-member-btn");
    if (transferCagToMemberBtn && ADMIN_USERS.includes(pseudo)) {
      transferCagToMemberBtn.addEventListener("click", async () => {
        const from = document.getElementById("eco-transfer-cag-to-member-from")?.value;
        const to = document.getElementById("eco-transfer-cag-to-member-to")?.value;
        const montant = parseInt(document.getElementById("eco-transfer-cag-to-member-amount")?.value, 10);
        if (!from || !to) return alert("Sélection invalide");
        if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");
        const rec = await readBin();
        const cagnottes = rec.cagnottes || {};
        const membres = rec.membres || {};
        if ((cagnottes[from] || 0) < montant) return alert(`Fonds insuffisants dans ${from} !`);
        if (!membres[to]) return alert("Membre inconnu !");
        if (!confirm(`Transférer ${montant} Dollars de la cagnotte ${from} vers ${to} ?`)) return;
        cagnottes[from] -= montant;
        membres[to].dollars = (membres[to].dollars || 0) + montant;
        if (!rec.transactions_cagnotte_membre) rec.transactions_cagnotte_membre = [];
        rec.transactions_cagnotte_membre.push({ date: new Date().toISOString(), de: from, vers: to, montant, effectué_par: pseudo });
        await writeBin(rec);
        alert(`✅ ${montant} Dollars transférés de ${from} à ${to}.`);
        updatePostDollars();
      });
    } else if (transferCagToMemberBtn) {
      document.getElementById("eco-transfer-cag-member")?.remove();
    }

    // === RÉINITIALISATIONS ===
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

    // === DISTRIBUTION GLOBALE ===
    document.getElementById("eco-giveall-btn")?.addEventListener("click", async()=>{
      const val = parseInt(document.getElementById("eco-giveall-amount").value,10);
      if(isNaN(val) || val <= 0) return alert("Montant invalide.");
      if(!confirm(`Ajouter ${val} ${MONNAIE_NAME} à tous ?`)) return;
      const rec = await readBin(); let count=0;
      for(const n in rec.membres){ rec.membres[n].dollars = (rec.membres[n].dollars||0) + val; count++; }
      await writeBin(rec); showEcoGain(val); updatePostDollars();
      alert(`${val} ${MONNAIE_NAME} ajoutés à ${count} membres.`);
    });

    await populateSelects();
    loading.remove();
    log("Initialisation terminée.");
    updatePostDollars();
  }

  window.EcoUI = { coreInit, updatePostDollars };

})();
