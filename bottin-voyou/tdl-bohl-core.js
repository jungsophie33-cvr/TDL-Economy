/* ============================================================
   TDL — BANDES HORS-LA-LOI · CORE (tdl-bohl-core.js)
   Squelette commun : header · onglets · lecture/écriture Firebase ·
   admin auto par rang · aiguillage vers l'onglet actif.
   À charger APRÈS tdl-bohl-config.js et eco-core, AVANT les onglets.

   Donnée d'affiliation : membres/{pseudo}.hors_la_loi = { bande, … }.
   Le bottin lit et écrit directement là (outils staff), comme le bottin
   des métiers. Chaque onglet s'enregistre via BHL.enregistrerOnglet.

   Blocs : TEXTES · CONFIG · ÉTAT · UTILS · INDEX · DONNÉES · PERSISTANCE
           · ONGLETS · RENDU · EVENTS · INIT · BOOT
   ============================================================ */
window.BHL = window.BHL || {};
(function (BHL) {
  "use strict";

  var CFG = window.BHL_CONFIG;

  /* ===================== TEXTES ===================== */
  BHL.T = {
    titre:"Annuaire des hors-la-loi",
    accueil:"Accueil", editer:"Éditer ce message",
    chargement:"Chargement…", vide:"Aucun membre recensé pour l'instant.",
    membres:"Membres", depuis:"Depuis", errEcriture:"Enregistrement échoué — réessayez.",
    ajouter:"Ajouter un membre", modifier:"Modifier", retirer:"Retirer",
    enregistrer:"Enregistrer", annuler:"Annuler", choisir:"— Choisir —",
    confirmRetrait:function (p){ return "Retirer "+p+" de cette bande ?"; },
  };

  /* ===================== CONFIG ===================== */
  BHL.CFG = {
    SEL:{ app:"tdlb-app", tabs:"tdlb-tabs", tab:"tdlb-tab", home:"tdlb-home", edit:"tdlb-edit" },
    HREF_ACCUEIL:"/",                              /* [MAJ] accueil du forum */
    NODE_MEMBRES:"membres",
  };

  /* ===================== ÉTAT ===================== */
  BHL.S = { tab:CFG.ordre[0], admin:false };
  BHL.rec = null;
  BHL.avatars = {};
  BHL.monPseudo = null;
  BHL.TABS = {};                                   // { bande: { render:fn } }

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

  function toast(msg){
    var t=document.createElement("div"); t.className="tdlb-toast"; t.textContent=msg;
    document.body.appendChild(t); setTimeout(function(){ t.remove(); },3200);
  }
  BHL.toast = toast;

  /* ===================== INDEX (avatars) ===================== */
  // Avatar depuis rec.faceclaims (« pris » + image l'emportent) — cf. eco-dc-staff.indexAvatars.
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

  // Membres d'une bande : { pseudo, nom, uid, avatar, hll } — hll = objet hors_la_loi.
  BHL.membresDeBande = function (bande){
    var membres=(BHL.rec&&BHL.rec.membres)||{}, out=[];
    Object.keys(membres).forEach(function(pseudo){
      var m=membres[pseudo]||{}, h=m.hors_la_loi;
      if(!h || h.bande!==bande) return;
      out.push({ pseudo:pseudo, nom:pseudo, uid:m.uid||null, avatar:BHL.avatarDe(pseudo), hll:h });
    });
    return out.sort(function(a,b){ return a.nom.localeCompare(b.nom,"fr"); });
  };
  // Tous les membres (pour le sélecteur staff) : ceux sans affiliation d'abord.
  BHL.tousMembres = function (){
    var membres=(BHL.rec&&BHL.rec.membres)||{};
    return Object.keys(membres).sort(function(a,b){ return a.localeCompare(b,"fr"); });
  };

  /* ===================== PERSISTANCE (écriture PATCH) ===================== */
  function up(updates){
    if(!window.EcoCore || typeof window.EcoCore.firebaseUpdate!=="function") return Promise.resolve({memoire:true});
    return window.EcoCore.firebaseUpdate(updates);
  }
  BHL.PERSIST = {
    // Pose/écrase l'affiliation d'un membre.
    definir:function (pseudo, hll){ var u={}; u[BHL.CFG.NODE_MEMBRES+"/"+pseudo+"/hors_la_loi"]=hll; return up(u); },
    // Retire l'affiliation (le membre reste, sans bande).
    retirer:function (pseudo){ var u={}; u[BHL.CFG.NODE_MEMBRES+"/"+pseudo+"/hors_la_loi"]=null; return up(u); },
  };
  // Écriture optimiste : mute rec en local, rend, puis PATCH (toast si échec).
  BHL.appliquer = function (pseudo, hll){
    BHL.rec.membres = BHL.rec.membres || {};
    BHL.rec.membres[pseudo] = BHL.rec.membres[pseudo] || {};
    if(hll) BHL.rec.membres[pseudo].hors_la_loi = hll;
    else delete BHL.rec.membres[pseudo].hors_la_loi;
    BHL.rendreOnglet();
    var p = hll ? BHL.PERSIST.definir(pseudo, hll) : BHL.PERSIST.retirer(pseudo);
    p.catch(function(){ toast(BHL.T.errEcriture); });
  };

  /* ===================== ONGLETS (enregistrement) ===================== */
  BHL.enregistrerOnglet = function (bande, api){ BHL.TABS[bande] = api; };

  /* ===================== RENDU ===================== */
  function renderOnglets(){
    var h="";
    CFG.ordre.forEach(function(cle){
      var b=CFG.bandes[cle];
      h += '<button data-tab="'+cle+'" aria-selected="'+(BHL.S.tab===cle)+'">'+BHL.escH(b.nom)+'</button>';
    });
    BHL.$(BHL.CFG.SEL.tabs).innerHTML = h;
  }
  BHL.rendreOnglet = function (){
    var host = BHL.$(BHL.CFG.SEL.tab), api = BHL.TABS[BHL.S.tab];
    if(!host) return;
    if(!api || !api.render){ host.innerHTML = '<div class="tdlb-empty">Onglet « '+BHL.escH(CFG.bandes[BHL.S.tab].nom)+' » à venir.</div>'; return; }
    api.render(host);
  };
  function render(){ renderOnglets(); BHL.rendreOnglet(); }
  BHL.render = render;

  /* ===================== EVENTS ===================== */
  function bindEvents(){
    BHL.$(BHL.CFG.SEL.tabs).addEventListener("click", function(e){
      var b=e.target.closest("button"); if(!b) return;
      BHL.S.tab=b.dataset.tab; render();
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

  /* ===================== BOOT (FA : window.load + polling) ===================== */
  function boot(){
    var n=0,t=setInterval(function(){
      if(BHL.$(BHL.CFG.SEL.app) && BHL.$(BHL.CFG.SEL.tabs)){ clearInterval(t); init(); }
      else if(++n>60){ clearInterval(t); }
    },250);
  }
  if(document.readyState==="complete") boot();
  else window.addEventListener("load", boot);

})(window.BHL);
