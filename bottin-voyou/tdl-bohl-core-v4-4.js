/* ============================================================
   TDL — BANDES HORS-LA-LOI · CORE (tdl-bohl-core.js)
   Squelette commun : header · onglets scrollables · hero PARTAGÉ & éditable
   (desc + mots-clés + image de fond) · barre d'action staff en bas ·
   lecture/écriture Firebase · aiguillage vers l'onglet actif.
   À charger APRÈS tdl-bohl-config.js, eco-core ET tdl-base, AVANT les onglets.

   [MAJ v2] LECTURES CIBLÉES. charger() appelait safeReadBin() : 126 ko pour en
     utiliser 8,8. Il lit maintenant les trois seules branches nécessaires et
     reconstitue un « rec » PARTIEL — tout le reste du bottin continue de lire
     BHL.rec.membres et BHL.rec.bandes sans aucun changement.

   [MAJ v2] TDLBase EST DÉSORMAIS REQUIS. Les trois onglets qui portent un
     réseau de contacts (Main, Faiseuses, Flottille) passent par son API des
     liens, et la barre staff par migrerLiens(). ecoPret() l'exige donc au même
     titre qu'EcoCore : sans lui, les onglets rendraient puis lèveraient.

   Deux nœuds Firebase :
     · membres/{pseudo}.hors_la_loi  → placement d'un personnage (par onglet) ;
     · membres/{pseudo}/liens/{clé}  → réseaux de contacts, partagés par les
       trois onglets ET par quai-staff, rep-det-main et rep-tac-fais ;
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
    errLecture:"Lecture impossible — le bottin s'affiche vide.",
    heroImg:"Image de fond (URL)", heroMc:"Mots-clés", heroDesc:"Description", mcAjout:"Nouveau mot-clé…",
    confirmRetrait:function (p){ return "Retirer "+p+" de cette bande ?"; },
  };

  /* ===================== CONFIG ===================== */
  BHL.CFG = {
    SEL:{ app:"tdlb-app", tabs:"tdlb-tabs", tab:"tdlb-tab", bar:"tdlb-actionbar", home:"tdlb-home", edit:"tdlb-edit" },
    HREF_ACCUEIL:"/",                              /* [MAJ] accueil du forum */
    NODE_MEMBRES:"membres", NODE_BANDES:"bandes", NODE_FC:"faceclaims",
  };

  /* ===================== ÉTAT ===================== */
  BHL.S = { tab:CFG.ordre[0], admin:false, heroEdit:null, anim:true };
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

  /* ===================== COMMU (couleur de communauté → bordure d'avatar) ===================== */
  var COMMU = {};
  BHL.construireCOMMU = function (){
    var C = window.EcoCore && window.EcoCore.COMMUNAUTES; if(!C) return;
    Object.keys(C).forEach(function(id){ var c=C[id], n=parseInt(id,10)-2;
      if(c && c.court && n>=1 && n<=6) COMMU[c.court] = "var(--gr"+n+"-color)"; });
  };
  BHL.couleurGroupe = function (court){ return COMMU[court] || "var(--clair1)"; };

  /* ===================== DONNÉES (lecture) ===================== */
  /* [MAJ v2] tdl-base est exigé au même titre qu'eco-core : les trois onglets
     à réseau de contacts et la barre staff en dépendent. */
  function ecoPret(){
    return !!(window.EcoCore && typeof window.EcoCore.firebaseGet==="function"
           && window.TDLBase && typeof window.TDLBase.liens==="function");
  }
  function attendreEco(ms){ return new Promise(function(res){ var n=0,t=setInterval(function(){ if(ecoPret()||++n>ms/100){ clearInterval(t); res(ecoPret()); } },100); }); }

  /* [MAJ v2] trois branches ciblées (~8,8 ko) au lieu des 126 ko de la racine.
     Le « rec » reconstitué garde la forme attendue par tout le reste du bottin. */
  /* un rec VIDE mais bien formé : sans lui, un échec de lecture laissait
     BHL.rec à null et chaque onglet levait sur BHL.rec.membres au lieu
     d'afficher un bottin vide. */
  function recVide(){ return { membres:{}, bandes:{}, faceclaims:{} }; }

  BHL.charger = function (){
    return attendreEco(8000).then(function(ok){
      if(!ok){
        if(window.console) console.warn("[TDL bandes] EcoCore ou tdl-base introuvable — vérifiez l'ordre de chargement.");
        BHL.rec = BHL.rec || recVide();
        return;
      }
      return Promise.all([
        window.EcoCore.firebaseGet(BHL.CFG.NODE_MEMBRES),
        window.EcoCore.firebaseGet(BHL.CFG.NODE_BANDES),
        window.EcoCore.firebaseGet(BHL.CFG.NODE_FC)
      ]).then(function(r){
        BHL.rec = { membres:r[0]||{}, bandes:r[1]||{}, faceclaims:r[2]||{} };
        BHL.avatars = indexAvatars(BHL.rec);
        BHL.construireCOMMU();
      }).catch(function(e){
        if(window.console) console.error("[TDL bandes] lecture", e);
        BHL.rec = BHL.rec || recVide();
        toast(BHL.T.errLecture);
      });
    });
  };

  BHL.membresDeBande = function (bande){
    var membres=(BHL.rec&&BHL.rec.membres)||{}, out=[];
    Object.keys(membres).forEach(function(pseudo){
      var m=membres[pseudo]||{}, h=m.hors_la_loi;
      if(!h || h.bande!==bande) return;
      out.push({ pseudo:pseudo, nom:pseudo, uid:m.uid||null, avatar:BHL.avatarDe(pseudo),
                 groupe:m.group||null, couleur:BHL.couleurGroupe(m.group), hll:h });
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
    champ:function (path, data){ var u={}; u[path]=data; return up(u); },
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

  /* ===================== CONVERSION DES LIENS (staff) =====================
     Bouton visible tant qu'un membre porte ses liens en TABLEAU. Il disparaît
     de lui-même une fois le travail fait.
     ATTENTION : ne le cliquer qu'une fois les SIX écrivains déployés — les
     trois onglets de ce bottin, quai-staff, rep-det-main et rep-tac-fais.
     Un seul écrivain resté en ancienne version réécrit la branche en tableau
     et défait la conversion au premier contact créé. */
  BHL.liensAConvertir = function (){
    if(!window.TDLBase || !window.TDLBase.liensAConvertir) return 0;
    var ms=(BHL.rec&&BHL.rec.membres)||{}, n=0;
    Object.keys(ms).forEach(function(p){ if(window.TDLBase.liensAConvertir(ms[p])) n++; });
    return n;
  };
  function boutonConversion(bar){
    if(!BHL.S.admin || !window.TDLBase || !window.TDLBase.migrerLiens) return;
    var n = BHL.liensAConvertir(); if(!n) return;
    var b = document.createElement("button");
    b.className = "tdlb-btn";
    b.innerHTML = '<i class="fi fi-tr-wrench-simple"></i> Convertir les liens ('+n+')';
    b.addEventListener("click", function(){
      if(!window.confirm("Convertir les liens de "+n+" membre(s) au format à clés ?\n\n"
        + "Chaque lien recevra une clé propre : un retrait ne pourra plus viser le mauvais contact.\n"
        + "L'opération est sans risque et peut être relancée.")) return;
      b.disabled = true; b.textContent = "Conversion…";
      window.TDLBase.migrerLiens(BHL.rec.membres).then(function(r){
        toast(r.faits+" membre(s) convertis.");
        BHL.charger().then(BHL.render);
      }).catch(function(){ toast(BHL.T.errEcriture); b.disabled=false; });
    });
    bar.appendChild(b);
  }

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
    boutonConversion(bar);
    var api=BHL.TABS[BHL.S.tab];
    if(api && api.renderActions) api.renderActions(bar);
  };

  /* ===================== RENDU ===================== */
    function renderOnglets(){
    var box = BHL.$(BHL.CFG.SEL.tabs); if(!box) return;

    /* Construction UNE seule fois : les boutons doivent persister d'un
       render à l'autre, sinon la transition CSS du trait ne joue jamais. */
    if(box.children.length !== CFG.ordre.length){
      var h="";
      CFG.ordre.forEach(function(cle){
        h += '<button data-tab="'+cle+'" aria-selected="false">'+BHL.escH(CFG.bandes[cle].nom)+'</button>';
      });
      box.innerHTML = h;
    }

    /* Synchronisation seule : bascule d'attribut sur des noeuds existants. */
    Array.prototype.forEach.call(box.querySelectorAll("button"), function(b){
      b.setAttribute("aria-selected", String(b.dataset.tab === BHL.S.tab));
    });
  }
  BHL.rendreOnglet = function (){
    var host=BHL.$(BHL.CFG.SEL.tab), api=BHL.TABS[BHL.S.tab]; if(!host) return;
    host.classList.toggle("anim", !!BHL.S.anim);   /* armé au seul changement d'onglet */
    BHL.S.anim = false;
    if(!api || !api.render){
      host.innerHTML = BHL.heroHTML(BHL.S.tab, {emblem:"fi-tr-skull"})
        + '<div class="tdlb-body"><div class="tdlb-empty">Onglet « '+BHL.escH(CFG.bandes[BHL.S.tab].nom)+' » à venir.</div></div>';
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
      if(BHL.S.tab!==b.dataset.tab){ BHL.S.heroEdit=null; BHL.S.tab=b.dataset.tab; BHL.S.anim=true; render(); }
    });
  }

     /* ===================== MONTAGE (sortie du contexte FA) ===================== */
  /* Sur un sujet, l'overlay naît dans .postbody : un ancêtre en transform/filter
     piège le position:fixed, un ancêtre en overflow le rogne, et le post crée un
     contexte d'empilement qui enterre le z-index. On le reparente sur body.
     Même traitement que bm-rep (bottin des lieux) et tdlh-bg (tableau Flottille). */
  function monter(){
    var rep = document.querySelector(".tdlb-rep");
    if(rep && rep.parentNode !== document.body) document.body.appendChild(rep);

    if(!BHL.$("tdlb-fa-fix")){
      var st = document.createElement("style");
      st.id = "tdlb-fa-fix";
      st.textContent = "html#min-width,body,#wrap,#main-content,#sj-main{min-width:0!important}"
                     + "html,body{overflow-x:hidden!important}";
      document.head.appendChild(st);
    }
    if(!document.querySelector("meta[name=viewport]")){
      var mv = document.createElement("meta");
      mv.name = "viewport"; mv.content = "width=device-width, initial-scale=1";
      document.head.appendChild(mv);
    }
  }

  /* ===================== INIT ===================== */
   function init(){
    monter();
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
