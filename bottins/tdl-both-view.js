/* ============================================================
   TDL — BOTTIN DES HABITATIONS · 2/2 VUE
   À charger APRÈS bh-habitations-modele.js (et EcoCore).
   Blocs : RENDU (onglets, panneau, typestrip, mur, actionbar)
           ÉDITION en place · MODALES (déménager, ma maison)
           EVENTS · INIT · BOOT
   Écritures optimistes : mutation locale + render, puis PATCH async
   (toast si échec), à la manière du panneau des enquêtes.
   ============================================================ */
(function (BH) {
  "use strict";
  const { $, escA, escH, initiales, cle, cleNum, occupants, lead, moi, numerosType, compteType } = BH;
  const T = BH.TEXTES, SEL = BH.CFG.SEL, COMMU = BH.COMMU;

  function toast(msg){
    const t=document.createElement("div"); t.className="tdlh-toast"; t.textContent=msg;
    document.body.appendChild(t); setTimeout(()=>t.remove(),3200);
  }

  /* ===================== RENDU : onglets / compteur / bascule ===================== */
  function renderOnglets(){
    let h = `<button class="all" data-tab="all" aria-selected="${BH.S.tab==='all'}">${T.tous}</button>`;
    BH.ORDRE.forEach(k=>{ h += `<button data-tab="${k}" aria-selected="${BH.S.tab===k}">${escH(BH.QUARTIERS[k].nom)}</button>`; });
    $(SEL.tabs).innerHTML = h;
  }
  function renderSousbarre(){
    const vue = $(SEL.vue), cnt = $(SEL.count);
    if(BH.S.tab==="all"){
      vue.classList.add("tdlh-hidden");
      cnt.innerHTML = `<b>${BH.HABITANTS.length}</b><span>${T.recensesTotal}</span>`;
    }else{
      vue.classList.remove("tdlh-hidden");
      vue.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.mode===BH.S.mode));
      const n = BH.HABITANTS.filter(m=>m.quartier===BH.S.tab).length;
      cnt.innerHTML = `<b>${n}</b><span>${n>1?T.habitants:T.habitant}</span>`;
    }
  }

  /* ===================== RENDU : PANNEAU quartier ===================== */
  function renderPanneau(){
    const q = BH.QUARTIERS[BH.S.tab];
    if(!q.types.includes(BH.S.type)) BH.S.type = q.types[0] || null;
    const ed = BH.S.editing;
    const img = q.image ? `background-image:url('${escA(q.image)}')` : "";
    const head = ed ? `
        <div class="tdlh-qeyebrow">${escH(q.zone)}</div>
        <input class="tdlh-edit-title" id="edNom" value="${escA(q.nom)}">
        <div class="tdlh-edit-hrow">
          <input class="tdlh-ein" id="edImg" placeholder="URL de l'image d'en-tête" value="${escA(q.image||"")}">
          <input class="tdlh-ein short" id="edPrix" placeholder="Prix" value="${escA(q.prix)}">
        </div>
        <div class="tdlh-tags">${tagsEditHTML("amb")}</div>
        <div class="tdlh-tags">${tagsEditHTML("com")}</div>`
      : `
        <div class="tdlh-qeyebrow">${escH(q.zone)}</div>
        <h2>${escH(q.nom)}</h2>
        <div class="tdlh-tags">
          ${q.amb.map(a=>`<span class="tag-amb">${escH(a)}</span>`).join("")}
          ${q.com.map(c=>`<span class="tag-com">${escH(c)}</span>`).join("")}
        </div>`;
    const vois = ed
      ? `<div class="tdlh-sec"><div class="tdlh-vois"><span class="lbl">${T.voisinage}</span><input class="tdlh-ein" id="edVois" value="${escA(q.vois)}"></div></div>`
      : `<div class="tdlh-sec"><div class="tdlh-vois"><span class="lbl">${T.voisinage}</span><span class="val">${escH(q.vois)}</span></div></div>`;
    const desc = ed
      ? `<div class="tdlh-sec"><textarea class="tdlh-ein" id="edDesc" rows="5">${escH(q.desc)}</textarea></div>`
      : `<div class="tdlh-sec"><p class="tdlh-desc">${escH(q.desc)}</p></div>`;
    $(SEL.panneau).innerHTML = `
      <div class="tdlh-hero">
        <div class="qimg" style="${img}"></div><div class="qveil"></div>
        ${q.draft?`<div class="tdlh-draft">${T.brouillon}</div>`:""}
        ${ed?"":`<div class="tdlh-price">${escH(q.prix)}</div>`}
        <div class="tdlh-qhead">${head}</div>
      </div>
      ${vois}${desc}
      <div class="tdlh-hsec"><span>${T.typesTitre}</span><hr></div>
      <div class="tdlh-typestrip" id="tdlh-typestrip">${typestripHTML(q,ed)}</div>
      <div class="tdlh-typepane" id="tdlh-typepane"></div>`;
    renderTypePane(false);
  }
  function typestripHTML(q, ed){
    let s = q.types.map(t=>{
      const c = compteType(BH.S.tab,t);
      const rm = ed ? (c>0
        ? `<span class="tdlh-tplock" title="${T.typeHabiteLock}">🔒</span>`
        : `<button class="tdlh-tpx" data-type="${escA(t)}" title="${T.supprimerType}">✕</button>`) : "";
      return `<button class="tdlh-tp" data-type="${escA(t)}" aria-selected="${t===BH.S.type}"><span class="lbl">${escH(t)}</span><span class="cnt ${c?"":"zero"}">${c}</span>${rm}</button>`;
    }).join("");
    if(ed) s += `<button class="tdlh-tpadd" id="tdlh-tpadd">${T.ajouterType}</button>`;
    return s;
  }
  function renderTypePane(anim){
    const pane = $("tdlh-typepane");
    let h = `<div class="tdlh-houses">`;
    numerosType(BH.S.tab,BH.S.type).forEach(n=>{
      const occ = occupants(BH.S.tab,n), lea = occ[0];
      const noms = occ.map(m=>`<span class="${m.pseudo===lea.pseudo?"lead":""}">${escH(m.nom)}</span>`).join(", ");
      const mk = BH.MAISONS[cle(BH.S.tab, cleNum(n))] || BH.MAISONS[cle(BH.S.tab,n)]; let more="";
      if(mk && (mk.description||mk.image)){
        more = `<div class="tdlh-hmore">${mk.image?`<img src="${escA(mk.image)}" alt="">`:`<div class="noimg">${icoMaison(24)}</div>`}<p>${escH(mk.description||"")}</p></div>`;
      }
      h += `<div class="tdlh-house"><span class="tdlh-hnum">N° ${escH(n)}</span><div class="tdlh-occ">${noms}</div>${more}</div>`;
    });
    h += `<div class="tdlh-house free"><span class="tdlh-hnum">N° —</span><div class="tdlh-free-txt">${T.parcelleLibre}</div></div>`;
    pane.innerHTML = h + `</div>`;
    if(anim){ pane.classList.remove("anim"); void pane.offsetWidth; pane.classList.add("anim"); }
  }

  /* ===================== RENDU : MUR habitants ===================== */
  function renderMur(){
    const el = $(SEL.mur), all = BH.S.tab==="all";
    const list = all ? BH.HABITANTS : BH.HABITANTS.filter(m=>m.quartier===BH.S.tab);
    if(!list.length){ el.innerHTML = `<div class="tdlh-empty">${T.murVide}</div>`; return; }
    let h = `<div class="tdlh-grid">`;
    list.forEach(m=>{
      const co = COMMU[m.commu] || {color:"var(--cntr)"};
      const nb = occupants(m.quartier,m.numero).length;
      const meta = all ? `${escH(BH.QUARTIERS[m.quartier].nom)} · ${escH(m.type)}` : escH(m.type);
      const av = m.avatar ? `<img src="${escA(m.avatar)}" alt="">` : initiales(m.nom);
      h += `<div class="tdlh-fc" style="--sc:${co.color}" data-pseudo="${escA(m.pseudo)}">
        <div class="tdlh-av">${av}</div>
        <div class="tdlh-nm">${escH(m.nom)}</div>
        <div class="tdlh-meta">${meta}</div>
        <div class="tdlh-chip"><span class="num">N° ${escH(m.numero)}</span>${nb>1?`<span class="plus">+${nb-1}</span>`:""}</div>
      </div>`;
    });
    el.innerHTML = h + `</div>`;
  }

  /* ===================== RENDU : barre d'actions ===================== */
  function renderActionbar(){
    const bar = $(SEL.actionbar);
    if(BH.S.editing){
      bar.innerHTML = `<button class="tdlh-abtn prim" id="tdlh-editSave">${T.enregistrer}</button>`
        + `<button class="tdlh-abtn" id="tdlh-editCancel">${T.annuler}</button>`
        + `<span class="sep"></span><span class="tdlh-edithint">${T.editHint}</span>`;
      return;
    }
    const M = moi(), isLead = M && lead(M.quartier,M.numero)?.pseudo===M.pseudo;
    let h = `<button class="tdlh-abtn prim" id="tdlh-btnMove" ${M?"":`disabled title="${T.maMaisonLead}"`}>${icoMove()} ${T.jeDemenage}</button>`;
    h += `<button class="tdlh-abtn" id="tdlh-btnHouse" ${isLead?"":`disabled title="${T.maMaisonLead}"`}>${icoPen()} ${T.maMaison}</button>`;
    h += `<span class="sep"></span>`;
    if(BH.S.staff){
      h += `<button class="tdlh-abtn" id="tdlh-btnQCreate">${T.creerQuartier}</button>`;
      h += `<button class="tdlh-abtn" id="tdlh-btnQEdit">${icoPen()} ${T.modifierQuartier}</button>`;
      h += `<button class="tdlh-abtn" id="tdlh-btnMoveAny">${icoMove()} ${T.demenagerMembre}</button>`;
    }
    bar.innerHTML = h;
  }

  function render(){
    renderOnglets(); renderSousbarre(); renderActionbar();
    const mur = BH.S.tab==="all" || BH.S.mode==="mur";
    $(SEL.panneau).classList.toggle("tdlh-hidden", mur);
    $(SEL.mur).classList.toggle("tdlh-hidden", !mur);
    if(mur) renderMur(); else renderPanneau();
  }
  BH.render = render;

  /* icônes neutres — [MAJ] Flaticon fi-tr- */
  function icoMaison(s=20){return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>`;}
  function icoMove(){return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l-4 4 4 4"/><path d="M3 11h14"/><path d="M17 17l4-4-4-4"/><path d="M21 13H7"/></svg>`;}
  function icoPen(){return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>`;}

  /* ===================== ÉDITION en place (staff) ===================== */
  function tagsEditHTML(grp){
    const arr = BH.QUARTIERS[BH.S.tab][grp], cls = grp==="amb"?"tag-amb":"tag-com";
    return arr.map((t,i)=>`<span class="${cls} tdlh-tagedit"><span>${escH(t)}</span><button class="tdlh-tagx" data-grp="${grp}" data-i="${i}" title="${T.supprimer}">✕</button></span>`).join("")
      + `<button class="tdlh-tagadd" data-grp="${grp}" title="${T.ajouter}">+</button>`;
  }
  function enterEdit(){
    if(BH.S.tab==="all") return;
    BH._snap = JSON.parse(JSON.stringify(BH.QUARTIERS[BH.S.tab])); BH._createKey=null;
    BH.S.mode="panneau"; BH.S.editing=true; render();
  }
  function createQuartier(){
    let base="quartier", k=base, i=1; while(BH.QUARTIERS[k]) k=base+(++i);
    BH.QUARTIERS[k] = {nom:T.nouveauQuartier, zone:BH.BAYOU, prix:"$ à $$", amb:[], com:[], vois:"", desc:"", types:[T.typeParDefaut]};
    BH.ORDRE.push(k); BH._createKey=k; BH._snap=null;
    BH.S.tab=k; BH.S.mode="panneau"; BH.S.type=null; BH.S.editing=true; render();
  }
  function exitEdit(save){
    if(save){
      BH.PERSISTANCE.sauverQuartier(BH.S.tab, BH.QUARTIERS[BH.S.tab]).catch(()=>toast(T.errEcriture));
    }else{
      if(BH._createKey){ delete BH.QUARTIERS[BH._createKey]; const i=BH.ORDRE.indexOf(BH._createKey); if(i>=0) BH.ORDRE.splice(i,1); BH.S.tab=BH.ORDRE[0]; }
      else if(BH._snap){ BH.QUARTIERS[BH.S.tab]=BH._snap; }
    }
    BH._snap=null; BH._createKey=null; BH.S.editing=false; BH.S.type=null; render();
  }
  function removeType(t){
    if(compteType(BH.S.tab,t)>0) return;
    const arr=BH.QUARTIERS[BH.S.tab].types, i=arr.indexOf(t); if(i>=0) arr.splice(i,1);
    if(BH.S.type===t) BH.S.type=arr[0]||null;
    renderPanneau();
  }
  function startInline(anchor, ph, commit){
    const inp=document.createElement("input");
    inp.className="tdlh-inlinein"; inp.placeholder=ph;
    anchor.replaceWith(inp); inp.focus();
    let done=false;
    const fin=(add)=>{ if(done)return; done=true; const v=inp.value.trim(); if(add&&v) commit(v); renderPanneau(); };
    inp.addEventListener("keydown",ev=>{ if(ev.key==="Enter") fin(true); else if(ev.key==="Escape") fin(false); });
    inp.addEventListener("blur",()=>fin(true));
  }

  /* ===================== MODALE : JE DÉMÉNAGE ===================== */
  function openMove(byStaff){
    $("tdlh-mvMemberFld").classList.toggle("tdlh-hidden", !byStaff);
    $("tdlh-mvTitle").textContent = byStaff?T.mvTitreStaff:T.mvTitre;
    $("tdlh-mvHint").textContent  = byStaff?T.mvHintStaff:T.mvHint;
    const sm = $("tdlh-mvMember");
    sm.innerHTML = BH.HABITANTS.map(m=>`<option value="${escA(m.pseudo)}">${escH(m.nom)} — ${escH(BH.QUARTIERS[m.quartier].nom)} N°${escH(m.numero)}</option>`).join("");
    sm.value = byStaff ? (BH.HABITANTS[0]?.pseudo||"") : BH.monPseudo;
    const sq = $("tdlh-mvQuartier");
    sq.innerHTML = BH.ORDRE.map(k=>`<option value="${k}">${escH(BH.QUARTIERS[k].nom)}</option>`).join("");
    sq.value = (byStaff ? BH.HABITANTS[0] : moi())?.quartier || BH.ORDRE[0];
    $("tdlh-mvNum").value = "";
    resolveMove();
    $(SEL.ovMove).classList.add("on");
  }
  function movingMember(){
    const byStaff = !$("tdlh-mvMemberFld").classList.contains("tdlh-hidden");
    return byStaff ? BH.HABITANTS.find(m=>m.pseudo===$("tdlh-mvMember").value) : moi();
  }
  function resolveMove(){
    const q=$("tdlh-mvQuartier").value, num=$("tdlh-mvNum").value.trim();
    const box=$("tdlh-mvResolve"), typeFld=$("tdlh-mvTypeFld"), leaveBox=$("tdlh-mvLeave"), M=movingMember();
    $("tdlh-mvType").innerHTML = BH.QUARTIERS[q].types.map(t=>`<option>${escH(t)}</option>`).join("");
    if(!num){ box.innerHTML=""; typeFld.classList.add("tdlh-hidden"); leaveBox.innerHTML=""; return; }
    const occ = occupants(q,num);
    if(occ.length){
      typeFld.classList.add("tdlh-hidden");
      box.innerHTML = `<div class="tdlh-preview"><div class="pl">${T.mvExistante}</div><div class="pt">${T.mvExistTxt(escH(num),escH(occ[0].type),occ.map(o=>escH(o.nom)).join(", "))}</div></div>`;
    }else{
      typeFld.classList.remove("tdlh-hidden");
      box.innerHTML = `<div class="tdlh-preview"><div class="pl">${T.mvNouvelle}</div><div class="pt">${T.mvNouvTxt(escH(num),escH(BH.QUARTIERS[q].nom))}</div></div>`;
    }
    if(M){
      const reste = occupants(M.quartier,M.numero).filter(o=>o.pseudo!==M.pseudo).length;
      const change = !(M.quartier===q && M.numero===num);
      leaveBox.innerHTML = (change && reste===0)
        ? `<div class="tdlh-preview warn"><div class="pl">${T.mvDepart}</div><div class="pt">${T.mvDepartTxt(escH(M.numero),escH(BH.QUARTIERS[M.quartier].nom))}</div></div>` : "";
    }
  }
  function confirmMove(){
    const M=movingMember(); if(!M) return;
    const q=$("tdlh-mvQuartier").value, num=$("tdlh-mvNum").value.trim();
    if(!num){ $("tdlh-mvNum").focus(); return; }
    const occ=occupants(q,num);
    const type = occ.length ? occ[0].type : $("tdlh-mvType").value;
    const from = {q:M.quartier, n:M.numero};
    // optimiste : maj locale + render, puis PATCH
    M.quartier=q; M.numero=num; M.type=type; M.ordre=new Date().toISOString();
    let quitte = null;
    if(!(from.q===q && from.n===num) && occupants(from.q,from.n).length===0){
      quitte = from; delete BH.MAISONS[cle(from.q,cleNum(from.n))]; delete BH.MAISONS[cle(from.q,from.n)];
    }
    $(SEL.ovMove).classList.remove("on");
    BH.S.type = type; render();
    BH.PERSISTANCE.demenager(M.pseudo, q, num, type, quitte).catch(()=>toast(T.errEcriture));
  }

  /* ===================== MODALE : MA MAISON ===================== */
  function openHouse(){
    const M=moi(); if(!M) return;
    const lea=lead(M.quartier,M.numero); if(!lea || lea.pseudo!==M.pseudo) return;
    const cur = BH.MAISONS[cle(M.quartier,cleNum(M.numero))] || BH.MAISONS[cle(M.quartier,M.numero)] || {description:"",image:""};
    $("tdlh-mhHint").innerHTML = T.mhHint(escH(M.numero), escH(BH.QUARTIERS[M.quartier].nom));
    $("tdlh-mhImg").value = cur.image||"";
    $("tdlh-mhDesc").value = cur.description||"";
    updateHousePreview();
    $(SEL.ovHouse).dataset.q = M.quartier; $(SEL.ovHouse).dataset.n = M.numero;
    $(SEL.ovHouse).classList.add("on");
  }
  function updateHousePreview(){
    const d=$("tdlh-mhDesc").value, img=$("tdlh-mhImg").value.trim();
    $("tdlh-mhCC").textContent = d.length;
    $("tdlh-mhPrevTxt").innerHTML = d ? escH(d) : `<span style="color:var(--darkopa6);font-style:italic">${T.mhApercuVide}</span>`;
    const box=$("tdlh-mhPrevImg");
    if(img){ box.textContent=""; box.style.background=`center/cover no-repeat url('${escA(img)}')`; }
    else{ box.style.background="var(--cntr4)"; box.textContent=T.mhImgVide; }
  }
  function saveHouse(){
    const ov=$(SEL.ovHouse), q=ov.dataset.q, n=ov.dataset.n;
    const description=$("tdlh-mhDesc").value.trim(), image=$("tdlh-mhImg").value.trim();
    if(description||image) BH.MAISONS[cle(q,cleNum(n))]={description,image}; else delete BH.MAISONS[cle(q,cleNum(n))];
    ov.classList.remove("on"); render();
    BH.PERSISTANCE.sauverMaison(q, n, description, image).catch(()=>toast(T.errEcriture));
  }

  /* ===================== EVENTS ===================== */
  function bindEvents(){
    $(SEL.tabs).addEventListener("click",e=>{
      const b=e.target.closest("button"); if(!b) return;
      BH.S.tab=b.dataset.tab; BH.S.type=null; if(BH.S.tab==="all") BH.S.mode="mur"; render();
    });
    $(SEL.vue).addEventListener("click",e=>{
      const b=e.target.closest("button"); if(!b) return; BH.S.mode=b.dataset.mode; render();
    });
    $(SEL.panneau).addEventListener("click",e=>{
      const tagx=e.target.closest(".tdlh-tagx");
      if(tagx){ BH.QUARTIERS[BH.S.tab][tagx.dataset.grp].splice(+tagx.dataset.i,1); renderPanneau(); return; }
      const tagadd=e.target.closest(".tdlh-tagadd");
      if(tagadd){ const g=tagadd.dataset.grp; startInline(tagadd,T.nouveauTag,v=>BH.QUARTIERS[BH.S.tab][g].push(v)); return; }
      const tpx=e.target.closest(".tdlh-tpx");
      if(tpx){ removeType(tpx.dataset.type); return; }
      const tpadd=e.target.closest("#tdlh-tpadd");
      if(tpadd){ startInline(tpadd,T.nouveauType,v=>{ BH.QUARTIERS[BH.S.tab].types.push(v); BH.S.type=v; }); return; }
      const tp=e.target.closest(".tdlh-tp");
      if(tp){ BH.S.type=tp.dataset.type;
        document.querySelectorAll("#tdlh-typestrip .tdlh-tp").forEach(x=>x.setAttribute("aria-selected", x.dataset.type===BH.S.type));
        renderTypePane(true); }
    });
    $(SEL.panneau).addEventListener("input",e=>{
      if(!BH.S.editing) return; const q=BH.QUARTIERS[BH.S.tab], t=e.target;
      if(t.id==="edNom"){ q.nom=t.value; const b=document.querySelector(`#${SEL.tabs} button[data-tab="${BH.S.tab}"]`); if(b) b.textContent=t.value; }
      else if(t.id==="edImg"){ q.image=t.value; const im=document.querySelector(".tdlh-hero .qimg"); if(im) im.style.backgroundImage=t.value?`url('${t.value}')`:""; }
      else if(t.id==="edPrix") q.prix=t.value;
      else if(t.id==="edVois") q.vois=t.value;
      else if(t.id==="edDesc") q.desc=t.value;
    });
    $(SEL.mur).addEventListener("click",e=>{
      const fc=e.target.closest(".tdlh-fc"); if(!fc) return;
      const m=BH.HABITANTS.find(x=>x.pseudo===fc.dataset.pseudo); if(!m) return;
      BH.S.tab=m.quartier; BH.S.mode="panneau"; BH.S.type=m.type; render();
      setTimeout(()=>{ const s=$("tdlh-typestrip"); if(s) s.scrollIntoView({behavior:"smooth",block:"center"}); },40);
    });
    const sb=$(SEL.staffBtn);
    if(sb) sb.addEventListener("click",ev=>{
      BH.S.staff=!BH.S.staff; ev.currentTarget.setAttribute("aria-pressed",BH.S.staff);
      document.body.classList.toggle("tdlh-body-admin",BH.S.staff); renderActionbar();
    });
    $(SEL.actionbar).addEventListener("click",e=>{
      if(e.target.closest("#tdlh-btnMove"))     openMove(false);
      if(e.target.closest("#tdlh-btnHouse"))    openHouse();
      if(e.target.closest("#tdlh-btnMoveAny"))  openMove(true);
      if(e.target.closest("#tdlh-btnQEdit"))    enterEdit();
      if(e.target.closest("#tdlh-btnQCreate"))  createQuartier();
      if(e.target.closest("#tdlh-editSave"))    exitEdit(true);
      if(e.target.closest("#tdlh-editCancel"))  exitEdit(false);
    });
    $("tdlh-mvQuartier").addEventListener("change",resolveMove);
    $("tdlh-mvNum").addEventListener("input",resolveMove);
    $("tdlh-mvMember").addEventListener("change",resolveMove);
    $("tdlh-mvConfirm").addEventListener("click",confirmMove);
    $("tdlh-mhDesc").addEventListener("input",updateHousePreview);
    $("tdlh-mhImg").addEventListener("input",updateHousePreview);
    $("tdlh-mhSave").addEventListener("click",saveHouse);
    document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).classList.remove("on")));
    document.querySelectorAll(".tdlh-ov").forEach(ov=>ov.addEventListener("click",e=>{ if(e.target===ov) ov.classList.remove("on"); }));
  }

  /* ===================== INIT ===================== */
  async function init(){
    const home=$(SEL.home); if(home) home.setAttribute("href",BH.CFG.HREF_ACCUEIL);
    document.querySelectorAll(".tdlh-ov").forEach(ov=>{ if(ov.parentElement!==document.body) document.body.appendChild(ov); });
    BH.monPseudo = window.EcoCore?.getPseudo?.() || null;
    if(!BH.estStaff()){ const b=$(SEL.staffBtn); if(b) b.style.display="none"; }
    bindEvents();
    render();                                   // rendu immédiat (seed) le temps du chargement
    try{ await BH.DONNEES.chargerTout(); }catch(e){ if(window.console) console.error(e); }
    render();
  }

  /* ===================== BOOT (FA : window.load + polling) ===================== */
  function boot(){
    let n=0; const t=setInterval(()=>{
      if($(SEL.app) && $(SEL.tabs)){ clearInterval(t); init(); }
      else if(++n>60){ clearInterval(t); }
    },250);
  }
  if(document.readyState==="complete") boot();
  else window.addEventListener("load",boot);

})(window.BH);
