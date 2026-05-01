// === ECONOMIE V2 – UI & ADMIN ===
// Auteur : ChatGPT x THE DROWNED LANDS
console.log("[EcoV2] >>> eco-ui chargé");

(function(){

  const {
    log, warn, err,
    readBin, writeBin, safeReadBin,
    getPseudo, getUserId, getMessagesCount, fetchUserGroupFromProfile,
    insertAfter, createErrorBanner, showEcoGain,
    MONNAIE_NAME, GROUPS, ADMIN_USERS, DEFAULT_DOLLARS,
    BIN_ID, API_KEY, JSONBIN_BASE
  } = window.EcoCore;

  // ---------- VISITEUR ----------
  if(typeof _userdata==="undefined"||!_userdata||_userdata.user_id==-1||_userdata.username==="anonymous"){
  console.log("[EcoV2] invité lecture seule");
  (async()=>{
    try{
      // APRÈS — safeReadBin est déjà destructuré en haut du fichier
      const record = await safeReadBin();
      if(!record) return console.warn("[EcoV2] échec lecture Firebase invité");
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

    // --- Crée les cagnottes manquantes (y compris Providence) ---
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

// ---------- PATCH : gestion UID + sync changement de pseudo ----------
// À insérer dans coreInit(), après `const pseudo = getPseudo(), uid = getUserId();`
// et avant le bloc de création/mise à jour du membre.
 
record.uid_index = record.uid_index || {};
 
// Détecte un changement de pseudo : l'UID connu pointe vers un ancien pseudo
const ancienPseudo = record.uid_index[uid];
const pseudoChange = ancienPseudo && ancienPseudo !== pseudo && record.membres[ancienPseudo];
 
if (pseudoChange) {
  // Renommage transparent : on migre toutes les données sous le nouveau pseudo
  record.membres[pseudo] = record.membres[ancienPseudo];
  delete record.membres[ancienPseudo];
  record.uid_index[uid] = pseudo;
 
  // Propager le nouveau pseudo dans doubles_comptes
  if (record.doubles_comptes) {
    // La clé racine du groupe
    if (record.doubles_comptes[ancienPseudo]) {
      record.doubles_comptes[pseudo] = record.doubles_comptes[ancienPseudo];
      delete record.doubles_comptes[ancienPseudo];
    }
    // Le pseudo dans les tableaux comptes des autres groupes
    // versTableau inline : Firebase peut avoir converti comptes en objet
    Object.values(record.doubles_comptes).forEach(groupe => {
      const arr = Array.isArray(groupe.comptes)
        ? groupe.comptes : Object.values(groupe.comptes || {});
      const idx = arr.indexOf(ancienPseudo);
      if (idx !== -1) { arr[idx] = pseudo; groupe.comptes = arr; }
    });
  }
 
  await writeBin(record).catch(() => null);
  log(`[uid-sync] Pseudo renommé : ${ancienPseudo} → ${pseudo}`);
}
 
// ---------- Création ou mise à jour standard du membre ----------
if (!record.membres[pseudo]) {
  const g = await fetchUserGroupFromProfile(uid);
  record.membres[pseudo] = {
    uid,                                          // ← stocké dès la création
    dollars: DEFAULT_DOLLARS,
    messages: getMessagesCount(),
    group: g || null,
    lastMessageThresholdAwarded: 0,
  };
  record.uid_index[uid] = pseudo;
  await writeBin(record).catch(() => null);
 
} else {
  record.membres[pseudo].messages = getMessagesCount();
 
  // Enrichir les entrées existantes qui n'ont pas encore d'uid
  if (!record.membres[pseudo].uid) {
    record.membres[pseudo].uid = uid;
    record.uid_index[uid] = pseudo;
  }
 
  if (!record.membres[pseudo].group) {
    const g = await fetchUserGroupFromProfile(uid);
    if (g) { record.membres[pseudo].group = g; }
  }
 
  await writeBin(record).catch(() => null);
}
// ---------- FIN DU PATCH ----------
    
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
      document.getElementById("eco-btn-shop")?.addEventListener("click", () => {
        location.href = "https://thedrownedlands.forumactif.com/h2-boutique-tdl";
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
    // --- Cagnotte → Membre ---
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
    // 🧾 Journal des transferts entre cagnottes
if (!rec.transactions_cagnottes) rec.transactions_cagnottes = [];
rec.transactions_cagnottes.push({
  date: new Date().toISOString(),
  de: from,
  vers: to,
  montant,
  effectué_par: pseudo
});

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
// 🧾 Journal des transactions entre membres
if (!rec.transactions_membres) rec.transactions_membres = [];
rec.transactions_membres.push({
  date: new Date().toISOString(),
  de: from,
  vers: to,
  montant,
  effectué_par: pseudo // qui a initié la transaction
});

    await writeBin(rec);
    alert(`✅ ${montant} Dollars transférés de ${from} à ${to}.`);

    // Mise à jour visuelle si l’un des deux est sur la page
    const elFrom = document.querySelector(".username strong:contains('" + from + "')");
    const elTo = document.querySelector(".username strong:contains('" + to + "')");
    if (elFrom || elTo) updatePostDollars();
  });
}
    // --- TRANSFERT CAGNOTTE → MEMBRE (réservé admins) ---
const transferCagToMemberBtn = document.getElementById("eco-transfer-cag-to-member-btn");
if (transferCagToMemberBtn && ADMIN_USERS.includes(pseudo)) {
  transferCagToMemberBtn.addEventListener("click", async () => {
    const from = document.getElementById("eco-transfer-cag-to-member-from")?.value;
    const to = document.getElementById("eco-transfer-cag-to-member-to")?.value;
    const montant = parseInt(document.getElementById("eco-transfer-cag-to-member-amount")?.value, 10);

    if (!from || !to) return alert("Sélection invalide (cagnotte ou membre manquant)");
    if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");

    const rec = await readBin();
    const cagnottes = rec.cagnottes || {};
    const membres = rec.membres || {};

    if ((cagnottes[from] || 0) < montant)
      return alert(`Fonds insuffisants dans la cagnotte ${from} !`);
    if (!membres[to]) return alert("Membre inconnu !");

    if (!confirm(`Transférer ${montant} Dollars de la cagnotte ${from} vers ${to} ?`)) return;

    // 💰 Effectue la transaction
    cagnottes[from] -= montant;
    membres[to].dollars = (membres[to].dollars || 0) + montant;

    // 🧾 Journal du transfert cagnotte → membre
    if (!rec.transactions_cagnotte_membre) rec.transactions_cagnotte_membre = [];
    rec.transactions_cagnotte_membre.push({
      date: new Date().toISOString(),
      de: from,
      vers: to,
      montant,
      effectué_par: pseudo
    });

    await writeBin(rec);

    alert(`✅ ${montant} Dollars transférés de ${from} à ${to}.`);
    const elFrom = document.getElementById(`eco-cag-${from.replace(/\s/g,"_")}`);
    if (elFrom) elFrom.textContent = cagnottes[from];
    updatePostDollars();
  });
} else if (transferCagToMemberBtn) {
  // Si non-admin → on cache le module
  document.getElementById("eco-transfer-cag-member")?.remove();
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

    // ---------- PROFIL UTILISATEUR : afficher les dollars ----------
try {
  // Vérifie qu’on est bien sur une page de profil (ex: /u13-Mami-Wata)
  if (location.pathname.match(/^\/u\d+/)) {
    const profilField = document.querySelector(".sj-profil .field-dollars > dd > .field_uneditable");
    const pseudoEl = document.querySelector(".sj-profil .sj-prpsd > span > strong");
    if (profilField && pseudoEl) {
      const pseudo = pseudoEl.textContent.trim();
      console.log("[EcoV2][Profil] Chargement du solde pour :", pseudo);

      // Lecture des données JSONBin
      const record = await window.EcoCore.readBin();
      if (record && record.membres && record.membres[pseudo]) {
        const dollars = record.membres[pseudo].dollars ?? 0;
        profilField.textContent = dollars;
        console.log(`[EcoV2][Profil] ${pseudo} → ${dollars} ${window.EcoCore.MONNAIE_NAME}`);
      } else {
        profilField.textContent = "0";
        console.warn("[EcoV2][Profil] Membre non trouvé dans le JSON :", pseudo);
      }
    }
  }
} catch (e) {
  console.warn("[EcoV2][Profil] erreur affichage dollars :", e);
}

    loading.remove();
    log("Initialisation terminée.");
    updatePostDollars();
  } // coreInit end

  window.EcoUI = { coreInit, updatePostDollars };

})();
