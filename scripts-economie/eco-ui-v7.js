// === ECONOMIE V2 – UI ===
// Auteur : ChatGPT x THE DROWNED LANDS
// Modifié : Claude x THE DROWNED LANDS
// La section admin (selects, boutons, transferts, réinitialisations) a été
// extraite vers eco-admin-modal.js qui gère le panneau admin de façon autonome.
//
// [MAJ 2026-06]
//   1. Affichage du solde : résolution du membre par UID (lien profil /u{id})
//      plutôt que par le pseudo gratté — le <strong> du pseudo n'existe que si
//      un groupe est attribué, ce qui privait les nouveaux inscrits d'affichage.
//   2. Groupe-communauté : plus de devinette à l'inscription (group: null).
//      Le groupe est posé à la validation de fiche, puis MAINTENU automatiquement
//      par detecterGroupeFA() qui lit la classe group-N de FA sur le pseudo du
//      membre courant et la mappe via window.EcoCore.GROUPES_FA.
console.log("[EcoV2] >>> eco-ui chargé");

(function(){

  const {
    log, warn, err,
    readBin, writeBin, safeReadBin,
    getPseudo, getUserId, getMessagesCount,
    insertAfter, createErrorBanner, showEcoGain,
    MONNAIE_NAME, GROUPS, ADMIN_USERS, DEFAULT_DOLLARS,
    BIN_ID, API_KEY, JSONBIN_BASE
  } = window.EcoCore;

  // ---------- RÉSOLUTION MEMBRE PAR UID ----------
  // [MAJ] Le lien profil /u{id} existe dans le mini-profil avec OU SANS groupe ;
  // le <strong> du pseudo, lui, n'apparaît qu'une fois un groupe attribué. On
  // résout donc d'abord par UID (robuste), avec repli sur le nom gratté.
  // Retourne { pseudo, membre } ou null.
  function resoudreMembre(post, record){
    if(!post || !record) return null;
    const idx     = record.uid_index || {};
    const membres = record.membres   || {};
    // On restreint la recherche à la zone pseudo pour éviter d'attraper
    // d'éventuels autres liens /u (avatar, signature, citations).
    const zone = post.querySelector(".sj-post-pseudo, .postprofile-name") || post;

    // 1) UID depuis un lien profil /u{id}
    for(const a of zone.querySelectorAll('a[href*="/u"]')){
      const m = (a.getAttribute("href") || "").match(/\/u(\d+)/);
      if(m){
        const pseudo = idx[m[1]];
        if(pseudo && membres[pseudo]) return { pseudo, membre: membres[pseudo] };
      }
    }

    // 2) Repli : nom gratté (strong si groupe, sinon premier lien-nom ≠ "@")
    let nom = null;
    const strongEl = zone.querySelector("strong");
    if(strongEl) nom = strongEl.textContent.trim();
    if(!nom){
      const noms = [...zone.querySelectorAll('a[href*="/u"]')]
        .map(a => a.textContent.trim())
        .filter(t => t && t !== "@" && t.length > 1);
      nom = noms[0] || null;
    }
    return (nom && membres[nom]) ? { pseudo: nom, membre: membres[nom] } : null;
  }

  // ---------- DÉTECTION DU GROUPE-COMMUNAUTÉ (classe group-N de FA) ----------
  // [MAJ] FA n'écrit pas le nom du groupe en texte : seul un <span class="group-N …">
  // enfant du lien profil /u{uid} le porte (et donne sa couleur au pseudo). On lit
  // cette classe pour le MEMBRE COURANT sur la page en cours (mini-profils de ses
  // posts, page /u, bloc "qui est en ligne"…), on la mappe via GROUPES_FA, et on
  // met à jour Firebase UNIQUEMENT si elle diffère du groupe stocké.
  // Garde-fous :
  //   1. aucune classe group-N trouvée → on ne touche à RIEN (jamais d'écrasement
  //      vers null : une page sans mini-profil ne doit pas effacer un groupe valide) ;
  //   2. ID hors de GROUPES_FA (staff, etc.) → ignoré (on n'invente pas).
  // Détection opportuniste : elle ne tourne que là où le pseudo du membre apparaît.
  // Pas de correction immédiate requise → pas de fetch /u{id} de secours.
  async function detecterGroupeFA(uid, pseudo, record){
    if(!uid || !pseudo) return;
    const idTable = window.EcoCore.GROUPES_FA || {};

    let idDetecte = null;
    for(const a of document.querySelectorAll('a[href*="/u"]')){
      const m = (a.getAttribute("href") || "").match(/\/u(\d+)/);
      if(!m || m[1] !== String(uid)) continue;           // seulement MON profil
      const grpEl = a.querySelector('[class*="group-"]')
                 || (a.matches('[class*="group-"]') ? a : null);
      if(!grpEl) continue;
      const g = (grpEl.className || "").match(/group-(\d+)/);
      if(g){ idDetecte = g[1]; break; }
    }

    if(idDetecte === null) return;                       // garde-fou 1
    const communaute = idTable[idDetecte];
    if(!communaute) return;                              // garde-fou 2

    const actuel = record.membres?.[pseudo]?.group;
    if(actuel === communaute) return;                    // déjà à jour

    try{
      await window.EcoCore.writeField(
        "membres/" + encodeURIComponent(pseudo) + "/group", communaute
      );
      if(record.membres?.[pseudo]) record.membres[pseudo].group = communaute;
      log(`[groupe] ${pseudo} : "${actuel ?? "(aucun)"}" → "${communaute}" (group-${idDetecte})`);
    }catch(e){ warn("[groupe] écriture échouée", e); }
  }

  // ---------- VISITEUR ----------
  if(typeof _userdata==="undefined"||!_userdata||_userdata.user_id==-1||_userdata.username==="anonymous"){
    console.log("[EcoV2] invité lecture seule");
    (async()=>{
      try{
        const record = await safeReadBin();
        if(!record) return console.warn("[EcoV2] échec lecture Firebase invité");
        document.querySelectorAll(".sj-post-proftop,.post,.postprofile").forEach(post=>{
          const res = resoudreMembre(post, record);
          if(!res) return;
          const val = post.querySelector(".field-dollars span:not(.label)");
          if(val) val.textContent = res.membre.dollars ?? 0;
        });
        if(record.cagnottes){
          Object.entries(record.cagnottes).forEach(([g,v])=>{
            const el = document.getElementById(`eco-cag-${g.replace(/\s/g,"_")}`);
            if(el) el.textContent = v;
          });
        }
      }catch(e){ console.warn("[EcoV2] erreur affichage invité",e); }
    })();
    return;
  }

  // ---------- UPDATE DOLLARS DANS LES POSTS ----------
  async function updatePostDollars(){
    try{
      const record = await safeReadBin();
      if(!record || !record.membres) return;
      document.querySelectorAll(".sj-post-proftop,.post,.postprofile").forEach(post=>{
        const res = resoudreMembre(post, record);
        if(!res) return;
        const val = post.querySelector(".field-dollars span:not(.label)");
        if(val) val.textContent = res.membre.dollars ?? 0;
      });
      log("Màj champs dollars terminée");
    }catch(e){ err("updatePostDollars", e); }
  }

// ---------- CORE INIT (écritures ciblées, plus aucun PUT racine) ----------
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
    if(!record){ loading.replaceWith(createErrorBanner("Erreur : lecture Firebase impossible.")); return; }
    record.membres   = record.membres   || {};
    record.cagnottes = record.cagnottes || {};
    record.boutique  = record.boutique  || {};

    // --- Cagnottes manquantes : init ciblée, sans écraser une valeur existante ---
    const cagManquantes = [];
    GROUPS.forEach(g => {
      if(record.cagnottes[g] === undefined){ record.cagnottes[g] = 0; cagManquantes.push(g); }
    });
    if(cagManquantes.length){
      try{
        await Promise.all(cagManquantes.map(g =>
          window.EcoCore.firebaseTransaction(
            "cagnottes/" + encodeURIComponent(g),
            cur => (cur == null ? 0 : cur)   // ne crée que si absente
          )
        ));
        console.log("[EcoV2] ✅ Cagnotte(s) initialisée(s) :", cagManquantes.join(", "));
      }catch(e){ console.warn("[EcoV2] ⚠️ init cagnottes :", e); }
    }

    const pseudo = getPseudo(), uid = getUserId();

    if(!pseudo || pseudo.toLowerCase() === "anonymous" || uid === -1){
      loading.replaceWith(createErrorBanner("Les invités n'ont pas accès à l'économie."));
      console.warn("[EcoV2] Ignoré : utilisateur invité (anonymous)");
      return;
    }

    // --- Sync changement de pseudo (PATCH multi-chemins atomique) ---
    record.uid_index = record.uid_index || {};
    const ancienPseudo = record.uid_index[uid];
    const pseudoChange = ancienPseudo && ancienPseudo !== pseudo && record.membres[ancienPseudo];

    if(pseudoChange){
      // mutations locales (pour l'affichage qui suit)
      record.membres[pseudo] = record.membres[ancienPseudo];
      delete record.membres[ancienPseudo];
      record.uid_index[uid] = pseudo;

      const updates = {};
      updates["membres/" + pseudo]        = record.membres[pseudo];
      updates["membres/" + ancienPseudo]  = null;            // suppression
      updates["uid_index/" + uid]         = pseudo;

      if(record.doubles_comptes){
        const cles = new Set();
        if(record.doubles_comptes[ancienPseudo]){
          record.doubles_comptes[pseudo] = record.doubles_comptes[ancienPseudo];
          delete record.doubles_comptes[ancienPseudo];
          cles.add(pseudo); cles.add(ancienPseudo);
        }
        Object.entries(record.doubles_comptes).forEach(([gkey, groupe]) => {
          const arr = Array.isArray(groupe.comptes) ? groupe.comptes : Object.values(groupe.comptes || {});
          const idx = arr.indexOf(ancienPseudo);
          if(idx !== -1){ arr[idx] = pseudo; groupe.comptes = arr; cles.add(gkey); }
        });
        cles.forEach(k => {
          updates["doubles_comptes/" + k] = (k === ancienPseudo) ? null : record.doubles_comptes[k];
        });
      }

     try{
        await window.EcoCore.firebaseUpdate(updates);
        log(`[uid-sync] Pseudo renommé : ${ancienPseudo} → ${pseudo}`);
      }catch(e){
        err("[uid-sync] échec PATCH renommage — coreInit interrompu, réessai au prochain chargement", e);
        loading.remove();
        return;   // on n'écrit RIEN d'autre tant que la migration n'a pas abouti
      }
    }

    // --- Création ou mise à jour du membre (ciblée) ---
    // [MAJ] À la création, group = null (honnête : un non-validé n'a pas de
    // communauté). Le groupe sera posé par fiche-staff à la validation, puis
    // maintenu par detecterGroupeFA. Plus aucun fetchUserGroupFromProfile.
    if(!record.membres[pseudo]){
      record.membres[pseudo] = {
        uid,
        dollars: DEFAULT_DOLLARS,
        messages: getMessagesCount(),
        group: null,
        lastMessageThresholdAwarded: 0,
      };
      record.uid_index[uid] = pseudo;
      const updates = {};
      updates["membres/" + pseudo]  = record.membres[pseudo];
      updates["uid_index/" + uid]   = pseudo;
      await window.EcoCore.firebaseUpdate(updates).catch(e => err("création membre", e));
    } else {
      const m = record.membres[pseudo];
      // compteur de messages — toujours
      m.messages = getMessagesCount();
      await window.EcoCore.writeField("membres/" + encodeURIComponent(pseudo) + "/messages", m.messages).catch(()=>{});
      // uid manquant
      if(!m.uid){
        m.uid = uid; record.uid_index[uid] = pseudo;
        await window.EcoCore.firebaseUpdate({
          ["membres/" + pseudo + "/uid"]: uid,
          ["uid_index/" + uid]: pseudo
        }).catch(()=>{});
      }
      // [MAJ] Bloc de re-fetch du groupe SUPPRIMÉ : la détection group-N
      // (detecterGroupeFA, plus bas) s'en charge de manière fiable.
    }

    // --- Détection / maintien du groupe-communauté via la classe group-N ---
    // [MAJ] Skippée pour Mami Wata : son groupe est fixé par la règle métier
    // ci-dessous (force-assign Providence), pas par FA.
    if(pseudo !== "Mami Wata"){
      await detecterGroupeFA(uid, pseudo, record);
    }

    // --- Assignation forcée Mami Wata (ciblée) ---
    if(pseudo === "Mami Wata" && record.membres[pseudo].group !== "Providence"){
      record.membres[pseudo].group = "Providence";
      console.log("[EcoV2] 🔮 Mami Wata assignée de force à la Providence.");
      await window.EcoCore.writeField("membres/" + encodeURIComponent(pseudo) + "/group", "Providence").catch(()=>{});
    }

    // --- Affichage solde courant ---
    try{
      const sj = document.querySelector("#sj-dollars");
      if(sj) sj.textContent = record.membres[pseudo].dollars;
    }catch(e){ err("sync sj-dollars", e); }

    // --- Affichage cagnottes ---
    try{
      GROUPS.forEach(g => {
        const el = document.getElementById(`eco-cag-${g.replace(/\s/g,"_")}`);
        if(el) el.textContent = record.cagnottes[g] || 0;
      });
    }catch(e){ err("update eco-solde-box", e); }

    // --- Admin bar & trigger modal ---
    const adminBar     = document.getElementById("eco-admin-bar");
    const adminSection = document.getElementById("eco-admin-section");
    if(adminBar) adminBar.style.display = "flex";
    if(adminSection){
      if(ADMIN_USERS.includes(pseudo)) adminSection.style.display = "flex";
      else adminSection.remove();
    }

    // --- Boutons barre membre (non-admin) ---
    try{
      document.getElementById("eco-btn-cag")?.addEventListener("click", async()=>{
        const rec = await readBin();
        alert("Cagnottes:\n" + JSON.stringify(rec.cagnottes, null, 2));
      });
      document.getElementById("eco-btn-shop")?.addEventListener("click", ()=>{
        location.href = "https://thedrownedlands.forumactif.com/h2-boutique-tdl";
      });

      // --- DON vers la cagnotte du groupe (écritures ciblées, anti-collision) ---
      document.getElementById("eco-btn-don")?.addEventListener("click", async () => {
        const montant = parseInt(prompt("Montant du don :", "0"));
        if (isNaN(montant) || montant <= 0) return alert("Montant invalide.");

        const rec = await readBin();
        const membre = rec?.membres?.[pseudo];
        const grp = membre?.group;
        if (!grp) return alert("Ton groupe est inconnu.");
        const soldeAvant = membre.dollars || 0;
        const cagAvant   = rec?.cagnottes?.[grp] || 0;
        if (soldeAvant < montant) return alert("Fonds insuffisants !");

        const P    = encodeURIComponent(pseudo);
        const Pgrp = encodeURIComponent(grp);

        // 1) Débit atomique — contrôle de fonds REFAIT contre la valeur serveur
        try {
          await window.EcoCore.firebaseTransaction(
            "membres/" + P + "/dollars",
            cur => { const s = cur || 0; if (s < montant) throw new Error("FONDS_INSUFFISANTS"); return s - montant; }
          );
        } catch (e) {
          if (e && e.message === "FONDS_INSUFFISANTS") return alert("Fonds insuffisants !");
          console.error("[EcoV2][DON] échec débit", e);
          return alert("Erreur lors du débit — don non effectué.");
        }

        // 2) Crédit cagnotte + journal ; remboursement si échec
        try {
          await window.EcoCore.firebaseTransaction("cagnottes/" + Pgrp, cur => (cur || 0) + montant);
          await window.EcoCore.firebasePush("donations", { date: new Date().toISOString(), membre: pseudo, groupe: grp, montant });
        } catch (e) {
          console.error("[EcoV2][DON] crédit échoué — remboursement", e);
          await window.EcoCore.firebaseTransaction("membres/" + P + "/dollars", cur => (cur || 0) + montant).catch(()=>{});
          return alert("Erreur : don annulé, ton solde est inchangé.");
        }

        sessionStorage.removeItem("eco_cache_record");
        sessionStorage.removeItem("eco_cache_time");
        alert("✅ Don effectué !");

        const el = document.querySelector("#sj-dollars");
        if (el) el.textContent = soldeAvant - montant;
        const cag = document.getElementById(`eco-cag-${grp.replace(/\s/g, "_")}`);
        if (cag) cag.textContent = cagAvant + montant;
      });
    }catch(e){ err("adminBar", e); }

    // --- Affichage dollars page profil (résolution par UID depuis l'URL /u{id}) ---
    // [MAJ] On ne gratte plus .sj-prpsd > span > strong (absent sans groupe) :
    // l'UID est déjà dans l'URL, on le résout via uid_index.
    try{
      const mUid = location.pathname.match(/^\/u(\d+)/);
      if(mUid){
        const profilField = document.querySelector(".sj-profil .field-dollars > dd > .field_uneditable");
        if(profilField){
          const rec    = await window.EcoCore.readBin();
          const idx    = (rec && rec.uid_index) ? rec.uid_index : {};
          const p      = idx[mUid[1]];
          const membre = (p && rec.membres) ? rec.membres[p] : null;
          profilField.textContent = membre ? (membre.dollars ?? 0) : "0";
          if(membre) console.log(`[EcoV2][Profil] u${mUid[1]} → ${p} → ${membre.dollars} ${MONNAIE_NAME}`);
          else console.warn("[EcoV2][Profil] UID non indexé dans uid_index :", mUid[1]);
        }
      }
    }catch(e){ console.warn("[EcoV2][Profil] erreur :", e); }

    loading.remove();
    log("Initialisation terminée.");
    updatePostDollars();
  }

  window.EcoUI = { coreInit, updatePostDollars };

})();
