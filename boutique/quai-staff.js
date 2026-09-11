/*
 * quais-staff.js — Tableau de bord staff « Les Quais du Bayou » · TDL
 *
 * S'affiche DANS un message (topic zone staff), pas en overlay. Se monte sur
 * #quais-staff, réservé au staff (la zone l'est déjà ; garde-fou _userdata).
 * Réutilise les classes des panels existants (mc-head, sj-fiche, mc-sec-head,
 * mc-cpt, mc-sub, dc-staff-carte, dc-staff-actions, dc-btn-valider/refuser,
 * fi-carte-grille) — on n'injecte que les onglets et les pastilles de statut.
 *
 * Organisé par onglets : En attente / Traitées / Toutes. Actions par demande :
 *   comptant → Valider (garde le débit) / Annuler & rembourser (recrédit) ;
 *   dette    → Marquer traitée (n° de dette affiché) ;
 *   autres   → Marquer traitée / Refuser ; traitées → Rouvrir / Supprimer.
 *
 * DÉPEND DE : window.EcoCore (safeReadBin, firebaseUpdate, firebaseTransaction, invalidateCache).
 */
(function () {
  "use strict";
  var CFG = { MOUNT:"#quais-staff", NODE_DEMANDES:"boutique_demandes", NODE_MEMBRES:"membres", MONNAIE:"$", RETRY_MS:300, RETRY_MAX:100 };
  function E(){ return window.EcoCore; }
  function isStaff(){ try { return typeof _userdata!=="undefined" && (_userdata.user_level===1||_userdata.user_level===2); } catch(e){ return false; } }
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function money(n){ return (typeof n==="number"?n.toLocaleString("fr-FR").replace(/\u202f/g," "):n)+" "+CFG.MONNAIE; }
  function dateFr(iso){ if(!iso) return "—"; var d=new Date(iso); return isNaN(d.getTime())?String(iso):d.toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}); }

  var TYPES = { comptant:"Paiement comptant", dette:"Dette", nego:"Négociation", don:"Don", mission:"Mission", offrande:"Offrande", braconneurs:"Braconneurs", demande:"Demande" };
  var STATUTS = { en_attente:"En attente", validee:"Validée", annulee:"Annulée / remboursée", traitee:"Traitée", refusee:"Refusée" };
  var FIELDS = [["contexte","Contexte RP"],["situation","Situation"],["attentes","Attentes"],["remuneration","Rémunération"],["aide","Nature de l'aide"],["don","Don"],["demande","Demande / mission"],["prime","Prime"],["requete","Requête"],["offrande","Offrande"],["cible","Cible"],["cible_type","Type de cible"],["cible_pj","PJ ciblé"],["cible_pnj","PNJ ciblé"],["montant_souhaite","Montant souhaité"],["lien","Lien"],["article","Article"]];
  var ONGLETS = [["en_attente","En attente"],["traitees","Traitées"],["toutes","Toutes"]];

  var st = { filtre:"en_attente" };
  var root, demandes = [];

  /* seule injection : onglets + pastilles (le reste vient des classes du forum) */
  function styles(){
    if (document.getElementById("qsd-style")) return;
    var s = document.createElement("style"); s.id = "qsd-style";
    s.textContent = ""
    + "#quais-staff .qsd-tabs{display:flex;gap:24px;flex-wrap:wrap;margin:0 0 18px;border-bottom:1px solid var(--cntr6)}"
    + "#quais-staff .qsd-tab{background:none;border:none;padding:6px 2px 9px;border-bottom:3px solid transparent;color:var(--darkopa6);text-transform:uppercase;letter-spacing:.06em;font-size:13px;font-family:var(--txt3);cursor:pointer;display:flex;align-items:center;gap:7px}"
    + "#quais-staff .qsd-tab.qsd-on{border-bottom-color:var(--dark2);color:var(--txt)}"
    + "#quais-staff .qsd-tab .qsd-n{font-size:12px;background:var(--cntr3);border-radius:10px;padding:0 8px;color:var(--darkopa6)}"
    + "#quais-staff .qsd-chead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:8px}"
    + "#quais-staff .qsd-nom{font-family:var(--font2);font-size:17px;text-transform:uppercase;letter-spacing:.01em}"
    + "#quais-staff .qsd-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}"
    + "#quais-staff .qsd-meta{font-size:12px;color:var(--darkopa6);text-align:right;white-space:nowrap;line-height:1.5}"
    + "#quais-staff .qsd-chip{font-family:var(--txt3);text-transform:uppercase;letter-spacing:.05em;font-size:11px;padding:3px 9px;border-radius:4px;background:var(--cntr3);color:var(--dark)}"
    + "#quais-staff .qsd-st{font-family:var(--txt3);text-transform:uppercase;letter-spacing:.05em;font-size:11px;padding:3px 9px;border-radius:4px;color:var(--clair1)}"
    + "#quais-staff .qsd-st-en_attente{background:var(--gr1-color)}#quais-staff .qsd-st-validee{background:var(--gr2-color)}#quais-staff .qsd-st-traitee{background:var(--gr3-color)}#quais-staff .qsd-st-refusee{background:var(--dark2)}#quais-staff .qsd-st-annulee{background:var(--darkopa5)}"
    + "#quais-staff .qsd-btn{font-family:var(--txt3);text-transform:uppercase;letter-spacing:.05em;font-size:12px;padding:7px 14px;border-radius:4px;border:1px solid var(--cntr6);background:none;color:var(--darkopa6);cursor:pointer}";
    document.head.appendChild(s);
  }

  function chip(t){ return '<span class="qsd-chip">'+esc(TYPES[t]||t||"—")+'</span>'; }
  function stChip(s){ return '<span class="qsd-st qsd-st-'+esc(s||"en_attente")+'">'+esc(STATUTS[s]||s||"—")+'</span>'; }
  function ligne(l, v){ return '<span>'+esc(l)+'</span><span>'+esc(v)+'</span>'; }
  function champs(d){
    var out = "";
    if (typeof d.montant==="number" && d.montant>0) out += ligne("Montant", money(d.montant)+(d.type==="dette"?" + dette":""));
    if (d.type==="dette" && d.dette_num) out += ligne("Dette", "Lourde n°"+d.dette_num);
    FIELDS.forEach(function(f){ var v=d[f[0]]; if (v!=null && String(v).trim()!=="") out += ligne(f[1], v); });
    return out ? '<div class="fi-carte-grille">'+out+'</div>' : "";
  }
  function btn(id, act, label, cls){ return '<button class="'+cls+'" data-id="'+esc(id)+'" data-act="'+act+'">'+label+'</button>'; }
  function actions(d){
    var a = "";
    if (d.statut==="en_attente"){
      if (d.type==="comptant") a += btn(d.id,"valider","Valider","dc-btn-valider") + btn(d.id,"annuler","Annuler & rembourser","dc-btn-refuser");
      else if (d.type==="dette") a += btn(d.id,"traiter","Marquer traitée","dc-btn-valider");
      else a += btn(d.id,"traiter","Marquer traitée","dc-btn-valider") + btn(d.id,"refuser","Refuser","dc-btn-refuser");
    } else {
      a += btn(d.id,"rouvrir","Rouvrir","qsd-btn") + btn(d.id,"supprimer","Supprimer","qsd-btn");
    }
    return '<div class="dc-staff-actions">'+a+'</div>';
  }
  function carte(d){
    return '<div class="dc-staff-carte"><div class="qsd-chead"><div><div class="qsd-nom">'+esc(d.nom||d.itemId||"—")+'</div>'
      + '<div class="qsd-chips">'+chip(d.type)+stChip(d.statut)+(d.bande?'<span class="qsd-chip">'+esc(d.bande)+'</span>':"")+'</div></div>'
      + '<div class="qsd-meta">'+esc(d.pseudo||"?")+'<br>'+dateFr(d.date)+'</div></div>'
      + champs(d) + actions(d) + '</div>';
  }

  function filtree(){ var f=st.filtre; return demandes.filter(function(d){ if(f==="toutes")return true; if(f==="en_attente")return d.statut==="en_attente"; return d.statut!=="en_attente"; }); }
  function compte(f){ return demandes.filter(function(d){ if(f==="toutes")return true; if(f==="en_attente")return d.statut==="en_attente"; return d.statut!=="en_attente"; }).length; }

  function render(){
    var list = filtree();
    var sub = { en_attente:"Demandes en attente de traitement par le staff.", traitees:"Demandes déjà traitées, validées, annulées ou refusées.", toutes:"Toutes les demandes de la boutique." }[st.filtre];
    root.innerHTML =
        '<div class="mc-head"><h1>Demandes — Les Quais du Bayou</h1><p>Panel staff</p></div>'
      + '<div class="qsd-tabs">'+ONGLETS.map(function(o){ return '<button class="qsd-tab'+(st.filtre===o[0]?" qsd-on":"")+'" data-f="'+o[0]+'">'+o[1]+'<span class="qsd-n">'+compte(o[0])+'</span></button>'; }).join("")+'</div>'
      + '<section class="sj-fiche">'
      +   '<div class="mc-sec-head"><h2>'+ONGLETS.filter(function(o){return o[0]===st.filtre;})[0][1]+'</h2><span class="mc-cpt">'+list.length+'</span></div>'
      +   '<p class="mc-sub">'+sub+'</p>'
      +   (list.length ? list.map(carte).join("") : '<p class="mc-sub">Aucune demande.</p>')
      + '</section>';
    wire();
  }
  function wire(){
    Array.prototype.forEach.call(root.querySelectorAll(".qsd-tab"), function(b){ b.onclick = function(){ st.filtre = b.getAttribute("data-f"); render(); }; });
    Array.prototype.forEach.call(root.querySelectorAll("[data-act]"), function(b){ b.onclick = function(){ action(b.getAttribute("data-id"), b.getAttribute("data-act")); }; });
  }

  async function action(id, act){
    var d = demandes.filter(function(x){ return x.id===id; })[0]; if (!d) return;
    if (act==="annuler" && !confirm("Rembourser "+money(d.montant||0)+" à "+(d.pseudo||"?")+" et annuler la demande ?")) return;
    if (act==="supprimer" && !confirm("Supprimer définitivement cette demande ?")) return;
    var base = CFG.NODE_DEMANDES+"/"+id, o = {};
    try {
      if (act==="annuler"){
        if (d.pseudo && d.montant) await E().firebaseTransaction(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dollars", function(cur){ return (cur||0)+(d.montant|0); });
        o[base+"/statut"]="annulee"; await E().firebaseUpdate(o);
      } else if (act==="supprimer"){ o[base]=null; await E().firebaseUpdate(o); }
      else { o[base+"/statut"] = act==="valider"?"validee":act==="traiter"?"traitee":act==="refuser"?"refusee":"en_attente"; await E().firebaseUpdate(o); }
    } catch(e){ if (window.console) console.error("[quais-staff]", e); alert("Action impossible."); return; }
    E().invalidateCache(); await charger(); render();
  }

  async function charger(){
    try {
      var r = await E().safeReadBin();
      var node = (r && r[CFG.NODE_DEMANDES]) || {};
      demandes = Object.keys(node).map(function(id){ var d = node[id]||{}; d.id = id; return d; })
        .sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });
    } catch(e){ demandes = []; }
  }

  function boot(){
    var n = 0;
    (function wait(){
      var m = document.querySelector(CFG.MOUNT);
      var eco = window.EcoCore && typeof EcoCore.safeReadBin==="function";
      if (m && eco){ demarrer(m); return; }
      if (n++ > CFG.RETRY_MAX) return;
      setTimeout(wait, CFG.RETRY_MS);
    })();
  }
  function demarrer(m){
    root = m; styles();
    if (!isStaff()){ root.innerHTML = ""; return; }
    charger().then(render);
  }

  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
