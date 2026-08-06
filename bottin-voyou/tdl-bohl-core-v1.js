/* ============================================================
   TDL — BANDES HORS-LA-LOI · CORE (tdl-bohl-core.js)
   Squelette commun : header · onglets scrollables · hero PARTAGÉ & éditable
   (desc + mots-clés + image de fond) · barre d'action staff en bas ·
   lecture/écriture Firebase · aiguillage vers l'onglet actif.
   À charger APRÈS tdl-bohl-config.js et eco-core, AVANT les onglets.

   Deux nœuds Firebase :
     · membres/{pseudo}.hors_la_loi  → placement d'un personnage (par onglet) ;
     · bandes/{bande}                → contenu de présentation éditable (desc, motscles, image).

   Blocs : TEXTES · CONFIG · ÉTAT · UTILS · INDEX · DONNÉES · CONTENU
           · PERSISTANCE · ONGLETS · HERO · ACTIONBAR · RENDU · EVENTS · INIT · BOOT
   ============================================================ */
window.BHL = window.BHL || {};
(function (BHL) {
  "use strict";

  var CFG = window.BHL_CONFIG;

  /* ===================== TEXTES ===================== */
  BHL.T = {
    accueil:"Accueil", chargement:"Chargement…", vide:"Aucun membre recensé pour l'instant.",
    membres:"Membres", depuis:"Depuis", errEcriture:"Enregistrement échoué — réessayez.",
    ajouter:"Ajouter un membre", modifier:"Modifier", retirer:"Retirer",
    enregistrer:"Enregistrer", annuler:"Annuler", choisir:"— Choisir —",
    modifierBande:"Modifier cette bande",
    heroImg:"Image de fond (URL)", heroMc:"Mots-clés", heroDesc:"Description", mcAjout:"Nouveau mot-clé…",
    confirmRetrait:function (p){ return "Retirer "+p+" de cette bande ?"; },
  };

  /* ===================== CONFIG ===================== */
  BHL.CFG = {
    SEL:{ app:"tdlb-app", tabs:"tdlb-tabs", tab:"tdlb-tab", bar:"tdlb-actionbar", home:"tdlb-home", edit:"tdlb-edit" },
    HREF_ACCUEIL:"/",                              /* [MAJ] accueil du forum */
    NODE_MEMBRES:"membres", NODE_BANDES:"bandes",
  };

  /* ===================== ÉTAT ===================== */
  BHL.S = { tab:CFG.ordre[0], admin:false, heroEdit:null };
  BHL.rec = null; BHL.avatars = {}; BHL.monPseudo = null;
  BHL.TABS = {};                                   // { bande: { render, renderActions? } }
  var heroMC = [];                                 // copie de travail des mots-clés en édition

  /* ===================== UTILS ===================== */
  BHL.$    = function (id){ return document.getElementById(id); };
  BHL.escH = function (s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); };
  BHL.escA = function (s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;"); };
  BHL.vt   = function (v){ return !v ? [] : (Array.isArray(v)?v:Object.keys(v).map(function(k){return v[k];})); };
  BHL.initiales = function (n){ return String(n).split(/[\s_-]+/).map(function(w){return w[0];}).filter(Boolean).slice(0,2).join("").toUpperCase(); };

  BHL.estStaff = function (){
    try{ var u=window._userdata; if(u && (u.user_level===1||u.user_level===2)) return true; }catch(e){}
    var p = window.EcoCore && window.EcoCore.getPseudo && window.EcoCore.getPseudo();
    return !!(p && (window.EcoCore.ADMIN_USERS||[]).indexOf(p)!==-1);
  };
  function toast(msg){ var t=document.createElement("div"); t.className="tdlb-toast"; t.textContent=msg;
    document.body.appendChild(t); setTimeout(function(){ t.remove(); },3200); }
  BHL.toast = toast;

  /* ===================== INDEX (avatars) ===================== */
  function indexAvatars(rec){
    var fc=(rec&&rec.faceclaims)||{}, idx={};
    function score(c){ return (c.statut==="pris"?4:c.statut==="reserve"?1:0)+(c.image?2:0); }
    Object.keys(fc).forEach(function(cle){ var c=fc[cle]; if(!c||!c.pseudo) return;
      var a=idx[c.pseudo]; if(!a||score(c)>score(a)) idx[c.pseudo]=c; });
    return idx;
  }
  BHL.avatarDe = function (pseudo){ var c=BHL.avatars[pseudo]; return (c&&c.image)||""; };

  /* ===================== DONNÉES (lecture) ===================== */
  function ecoPret(){ return !!(window.EcoCore && typeof window.EcoCore.safeReadBin==="function"); }
  function attendreEco(ms){ return new Promise(function(res){ var n=0,t=setInterval(function(){ if(ecoPret()||++n>ms/100){ clearInterval(t); res(ecoPret()); } },100); }); }

  BHL.charger = function (){
    return attendreEco(8000).then(function(ok){
      if(!ok){ if(window.console) console.warn("[TDL bandes] EcoCore introuvable."); return; }
      return window.EcoCore.safeReadBin().then(function(rec){
        BHL.rec = rec || {}; BHL.avatars = indexAvatars(BHL.rec);
      }).catch(function(e){ if(window.console) console.error("[TDL bandes] lecture", e); });
    });
  };

  BHL.membresDeBande = function (bande){
    var membres=(BHL.rec&&BHL.rec.membres)||{}, out=[];
    Object.keys(membres).forEach(function(pseudo){
      var m=membres[pseudo]||{}, h=m.hors_la_loi;
      if(!h || h.bande!==bande) return;
      out.push({ pseudo:pseudo, nom:pseudo, uid:m.uid||null, avatar:BHL.avatarDe(pseudo), hll:h });
    });
    return out.sort(function(a,b){ return a.nom.localeCompare(b.nom,"fr"); });
  };
  BHL.tousMembres = function (){
    var membres=(BHL.rec&&BHL.rec.membres)||{};
    return Object.keys(membres).sort(function(a,b){ return a.localeCompare(b,"fr"); });
  };

  /* ===================== CONTENU (seed + surcharge Firebase) ===================== */
  BHL.contenu = function (bande){
    var seed = CFG.bandes[bande]||{}, ov = (BHL.rec && BHL.rec.bandes && BHL.rec.bandes[bande]) || {};
    var mc = BHL.vt(ov.motscles);
    return {
      nom: seed.nom,
      desc:  ("desc"  in ov) ? ov.desc  : (seed.desc||""),
      image: ("image" in ov) ? ov.image : (seed.image||""),
      motscles: mc.length ? mc : (seed.motscles||[]),
    };
  };

  /* ===================== PERSISTANCE (PATCH) ===================== */
  function up(updates){
    if(!window.EcoCore || typeof window.EcoCore.firebaseUpdate!=="function") return Promise.resolve({memoire:true});
    return window.EcoCore.firebaseUpdate(updates);
  }
  BHL.PERSIST = {
    definir:function (pseudo, hll){ var u={}; u[BHL.CFG.NODE_MEMBRES+"/"+pseudo+"/hors_la_loi"]=hll; return up(u); },
    retirer:function (pseudo){ var u={}; u[BHL.CFG.NODE_MEMBRES+"/"+pseudo+"/hors_la_loi"]=null; return up(u); },
    contenu:function (bande, data){ var u={}; u[BHL.CFG.NODE_BANDES+"/"+bande]=data; return up(u); },
  };
  BHL.appliquer = function (pseudo, hll){
    BHL.rec.membres = BHL.rec.membres || {};
    BHL.rec.membres[pseudo] = BHL.rec.membres[pseudo] || {};
    if(hll) BHL.rec.membres[pseudo].hors_la_loi = hll; else delete BHL.rec.membres[pseudo].hors_la_loi;
    BHL.rendreOnglet();
    (hll ? BHL.PERSIST.definir(pseudo, hll) : BHL.PERSIST.retirer(pseudo)).catch(function(){ toast(BHL.T.errEcriture); });
  };

  /* ===================== ONGLETS ===================== */
  BHL.enregistrerOnglet = function (bande, api){ BHL.TABS[bande] = api; };

  /* ===================== HERO (partagé, éditable) ===================== */
  function statsHTML(stats){
    if(!stats || !stats.length) return "";
    return '<div class="tdlb-hero-stats">' + stats.map(function(s){
      return '<div class="st"><i class="fi '+s.icon+'"></i><span>'+BHL.escH(s.label)+'</span><b>'+BHL.escH(String(s.val))+'</b></div>';
    }).join("") + '</div>';
  }
  function mcEditHTML(){
    return heroMC.map(function(m,i){ return '<span class="tag">'+BHL.escH(m)+'<button data-mc-x="'+i+'">✕</button></span>'; }).join("")
      + '<button class="tag-add" data-mc-add="1">+</button>';
  }
  // opts : { emblem:"fi-tr-…", stats:[{icon,label,val}] }
  BHL.heroHTML = function (bande, opts){
    opts = opts||{};
    var c = BHL.contenu(bande), editing = (BHL.S.heroEdit===bande);
    var emblem = opts.emblem || "fi-tr-skull";
    var fond = c.image ? '<div class="tdlb-hero-bg" style="background-image:url(\''+BHL.escA(c.image)+'\')"></div><div class="tdlb-hero-veil"></div>' : "";
    var cls = "tdlb-hero" + (c.image?" has-img":"") + (editing?" editing":"");
    var corps;
    if(editing){
      corps = '<div class="tdlb-hero-main">'
        + '<h2>'+BHL.escH(c.nom)+'</h2>'
        + '<div class="tdlb-hero-editor">'
        +   '<label>'+BHL.T.heroImg+'</label><input class="tdlb-in" id="tdlb-hero-img" value="'+BHL.escA(c.image)+'" placeholder="https://…">'
        +   '<label>'+BHL.T.heroMc+'</label><div class="tdlb-mc-edit" id="tdlb-hero-mc">'+mcEditHTML()+'</div>'
        +   '<label>'+BHL.T.heroDesc+'</label><textarea class="tdlb-in" id="tdlb-hero-desc" rows="4">'+BHL.escH(c.desc)+'</textarea>'
        + '</div></div>';
    }else{
      corps = '<div class="tdlb-hero-main"><h2>'+BHL.escH(c.nom)+'</h2>'
        + '<div class="tdlb-hero-mc">'+ c.motscles.map(function(m){return '<span>'+BHL.escH(m)+'</span>';}).join("") +'</div>'
        + '<p>'+BHL.escH(c.desc)+'</p></div>';
    }
    return '<div class="'+cls+'">'+fond
      + '<div class="tdlb-hero-emblem"><i class="fi '+emblem+'"></i></div>'
      + corps + statsHTML(opts.stats) + '</div>';
  };

  function brancherHeroEdit(){
    var mcbox = BHL.$("tdlb-hero-mc"); if(!mcbox) return;
    mcbox.addEventListener("click", function(e){
      var x=e.target.closest("[data-mc-x]"); if(x){ heroMC.splice(+x.dataset.mcX,1); mcbox.innerHTML=mcEditHTML(); return; }
      var add=e.target.closest("[data-mc-add]"); if(add){
        var inp=document.createElement("input"); inp.className="tdlb-in mc-in"; inp.placeholder=BHL.T.mcAjout;
        add.replaceWith(inp); inp.focus();
        var fin=function(ok){ var v=inp.value.trim(); if(ok&&v) heroMC.push(v); mcbox.innerHTML=mcEditHTML(); };
        inp.addEventListener("keydown",function(ev){ if(ev.key==="Enter") fin(true); else if(ev.key==="Escape") fin(false); });
        inp.addEventListener("blur",function(){ fin(true); });
      }
    });
  }
  BHL.sauverHero = function (bande){
    var img=(BHL.$("tdlb-hero-img")||{}).value||"", desc=(BHL.$("tdlb-hero-desc")||{}).value||"";
    var data={ desc:desc.trim(), motscles:heroMC.slice(), image:img.trim() };
    BHL.rec.bandes = BHL.rec.bandes || {};
    BHL.rec.bandes[bande] = Object.assign({}, BHL.rec.bandes[bande], data);
    BHL.S.heroEdit = null; BHL.render();
    BHL.PERSIST.contenu(bande, data).catch(function(){ toast(BHL.T.errEcriture); });
  };

  /* ===================== ACTIONBAR (bas, staff) ===================== */
  BHL.renderActionbar = function (){
    var bar=BHL.$(BHL.CFG.SEL.bar); if(!bar) return;
    if(!BHL.S.admin){ bar.innerHTML=""; bar.classList.add("vide"); return; }
    bar.classList.remove("vide");
    if(BHL.S.heroEdit===BHL.S.tab){
      bar.innerHTML = '<button class="tdlb-btn prim" id="tdlb-hero-save">'+BHL.T.enregistrer+'</button>'
        + '<button class="tdlb-btn" id="tdlb-hero-cancel">'+BHL.T.annuler+'</button>';
      BHL.$("tdlb-hero-save").addEventListener("click", function(){ BHL.sauverHero(BHL.S.tab); });
      BHL.$("tdlb-hero-cancel").addEventListener("click", function(){ BHL.S.heroEdit=null; BHL.render(); });
      return;
    }
    bar.innerHTML = '<button class="tdlb-btn" id="tdlb-hero-edit"><i class="fi fi-tr-pencil"></i> '+BHL.T.modifierBande+'</button>';
    BHL.$("tdlb-hero-edit").addEventListener("click", function(){
      heroMC = BHL.contenu(BHL.S.tab).motscles.slice(); BHL.S.heroEdit=BHL.S.tab; BHL.render();
    });
    var api=BHL.TABS[BHL.S.tab];
    if(api && api.renderActions) api.renderActions(bar);
  };

  /* ===================== RENDU ===================== */
  function renderOnglets(){
    var h="";
    CFG.ordre.forEach(function(cle){
      h += '<button data-tab="'+cle+'" aria-selected="'+(BHL.S.tab===cle)+'">'+BHL.escH(CFG.bandes[cle].nom)+'</button>';
    });
    BHL.$(BHL.CFG.SEL.tabs).innerHTML = h;
  }
  BHL.rendreOnglet = function (){
    var host=BHL.$(BHL.CFG.SEL.tab), api=BHL.TABS[BHL.S.tab]; if(!host) return;
    if(!api || !api.render){
      host.innerHTML = BHL.heroHTML(BHL.S.tab, {emblem:"fi-tr-skull"})
        + '<div class="tdlb-empty">Onglet « '+BHL.escH(CFG.bandes[BHL.S.tab].nom)+' » à venir.</div>';
    } else {
      api.render(host);
    }
    if(BHL.S.heroEdit===BHL.S.tab) brancherHeroEdit();
  };
  function render(){ renderOnglets(); BHL.rendreOnglet(); BHL.renderActionbar(); }
  BHL.render = render;

  /* ===================== EVENTS ===================== */
  function bindEvents(){
    BHL.$(BHL.CFG.SEL.tabs).addEventListener("click", function(e){
      var b=e.target.closest("button"); if(!b) return;
      if(BHL.S.tab!==b.dataset.tab){ BHL.S.heroEdit=null; BHL.S.tab=b.dataset.tab; render(); }
    });
  }

  /* ===================== INIT ===================== */
  function init(){
    var home=BHL.$(BHL.CFG.SEL.home); if(home) home.setAttribute("href", BHL.CFG.HREF_ACCUEIL);
    BHL.monPseudo = window.EcoCore && window.EcoCore.getPseudo && window.EcoCore.getPseudo() || null;
    BHL.S.admin = BHL.estStaff();
    if(BHL.S.admin){
      document.body.classList.add("tdlb-body-admin");
      var ed=BHL.$(BHL.CFG.SEL.edit), nat=document.querySelector('a[href*="mode=editpost"]');
      if(ed && nat) ed.setAttribute("href", nat.getAttribute("href"));
    }
    bindEvents();
    var host=BHL.$(BHL.CFG.SEL.tab); if(host) host.innerHTML='<div class="tdlb-empty">'+BHL.T.chargement+'</div>';
    BHL.charger().then(render);
  }

  /* ===================== BOOT ===================== */
  function boot(){
    var n=0,t=setInterval(function(){
      if(BHL.$(BHL.CFG.SEL.app) && BHL.$(BHL.CFG.SEL.tabs)){ clearInterval(t); init(); }
      else if(++n>60){ clearInterval(t); }
    },250);
  }
  if(document.readyState==="complete") boot();
  else window.addEventListener("load", boot);

})(window.BHL);
