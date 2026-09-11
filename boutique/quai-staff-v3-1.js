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
  var CFG = { MOUNT:"#quais-staff", NODE_DEMANDES:"boutique_demandes", NODE_MEMBRES:"membres", NODE_CAGNOTTES:"cagnottes", MONNAIE:"$", RETRY_MS:300, RETRY_MAX:100 };
  function E(){ return window.EcoCore; }
  function isStaff(){ try { return typeof _userdata!=="undefined" && (_userdata.user_level===1||_userdata.user_level===2); } catch(e){ return false; } }
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function money(n){ return (typeof n==="number"?n.toLocaleString("fr-FR").replace(/\u202f/g," "):n)+" "+CFG.MONNAIE; }
  function dateFr(iso){ if(!iso) return "—"; var d=new Date(iso); return isNaN(d.getTime())?String(iso):d.toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}); }

  var TYPES = { comptant:"Paiement comptant", dette:"Dette", pret:"Prêt", nego:"Négociation", don:"Don", mission:"Mission", offrande:"Offrande", braconneurs:"Braconneurs", demande:"Demande" };
  var STATUTS = { en_attente:"En attente", validee:"Validée", annulee:"Annulée / remboursée", traitee:"Traitée", refusee:"Refusée" };
  var FIELDS = [["contexte","Contexte RP"],["situation","Situation"],["attentes","Attentes"],["remuneration","Rémunération"],["prix_negocie","Prix négocié"],["methode","Méthode"],["compensation","Compensation"],["situation_main","Situation vis-à-vis de la Main"],["pret_contrepartie","Remboursement du prêt"],["aide","Nature de l'aide"],["don","Don"],["demande","Demande / mission"],["prime","Prime"],["requete","Requête"],["offrande","Offrande"],["cible","Cible"],["cible_type","Type de cible"],["cible_pj","PJ ciblé"],["cible_pnj","PNJ ciblé"],["montant_souhaite","Somme demandée"],["lien","Lien"],["article","Article"]];
  var VMAP = { methode:{ rp:"En RP", des:"Avec les dés" }, compensation:{ dette:"Dette lourde", reseau:"Réseau d'influence" }, pret_contrepartie:{ remboursement:"Remboursement en monnaie", dette:"Compensation par dette lourde" } };
  var ONGLETS = [["en_attente","En attente"],["traitees","Traitées"],["toutes","Toutes"],["dettes","Gestion des dettes"]];
  var DETTE_LIB = { lourde:"Dette lourde", legere:"Dette légère", karmique:"Dette karmique", longue:"Dette longue" };

  var st = { filtre:"en_attente" };
  var root, demandes = [], dettesList = [];

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
    if (typeof d.montant==="number" && d.montant>0) out += ligne("Montant", money(d.montant));
    if (d.type==="dette" && d.dette_num) out += ligne("Rang dette lourde", "n°"+d.dette_num);
    var di = detteAInscrire(d); if (di) out += ligne("Dette à inscrire", (DETTE_LIB[di.type]||di.type)+(di.creancier?" · "+di.creancier:""));
    FIELDS.forEach(function(f){ var v=d[f[0]]; if (v!=null && String(v).trim()!=="") { if (VMAP[f[0]] && VMAP[f[0]][v]) v=VMAP[f[0]][v]; out += ligne(f[1], v); } });
    return out ? '<div class="fi-carte-grille">'+out+'</div>' : "";
  }
  function btn(id, act, label, cls){ return '<button class="'+cls+'" data-id="'+esc(id)+'" data-act="'+act+'">'+label+'</button>'; }
  function actions(d){
    var a = "";
    if (d.statut==="en_attente"){
      if (d.type==="comptant") a += btn(d.id,"valider","Valider","dc-btn-valider") + btn(d.id,"annuler","Annuler & rembourser","dc-btn-refuser");
      else if (d.type==="pret") a += btn(d.id,"valider","Valider le prêt","dc-btn-valider") + btn(d.id,"refuser","Refuser","dc-btn-refuser");
      else if (d.type==="dette") a += btn(d.id,"valider","Valider","dc-btn-valider") + btn(d.id,"refuser","Refuser","dc-btn-refuser");
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

  /* dette à inscrire à la validation, selon la demande */
  function detteAInscrire(d){
    if (d.dette_type) return { type:d.dette_type, creancier:d.creancier||d.bande||"", motif:d.motif||d.nom||"" };
    if (d.compensation==="dette") return { type:"lourde", creancier:d.bande||d.creancier||"La Main de la Providence", motif:d.nom||"" };
    if (d.pret_contrepartie==="dette") return { type:"lourde", creancier:d.bande||"La Main de la Providence", motif:"Prêt : "+(d.nom||"") };
    return null;
  }
  function detteChip(t){ var cls = { lourde:"refusee", legere:"en_attente", karmique:"traitee", longue:"validee" }[t] || "en_attente"; return '<span class="qsd-st qsd-st-'+cls+'">'+esc(DETTE_LIB[t]||t)+'</span>'; }
  function carteDette(d){
    return '<div class="dc-staff-carte"><div class="qsd-chead"><div><div class="qsd-nom">'+esc(d.pseudo)+'</div>'
      + '<div class="qsd-chips">'+detteChip(d.type)+(d.creancier?'<span class="qsd-chip">'+esc(d.creancier)+'</span>':"")+'</div></div>'
      + '<div class="qsd-meta">'+dateFr(d.date)+'</div></div>'
      + (d.motif?'<div class="fi-carte-grille"><span>Motif</span><span>'+esc(d.motif)+'</span></div>':"")
      + '<div class="dc-staff-actions"><button class="dc-btn-refuser" data-detpseudo="'+esc(d.pseudo)+'" data-detkey="'+esc(d.key)+'">Régler la dette</button></div></div>';
  }
  async function reglerDette(pseudo, key){
    if (!confirm("Régler et retirer cette dette de "+pseudo+" ? (à faire quand elle a été honorée en RP)")) return;
    var o = {}; o[CFG.NODE_MEMBRES+"/"+pseudo+"/dettes/"+key] = null;   /* chemin BRUT : firebaseUpdate est un PATCH racine, pas une URL */
    try { await E().firebaseUpdate(o); }
    catch(e){ if (window.console) console.error("[quais-staff] régler dette", e); alert("Impossible de régler la dette."); return; }
    dettesList = dettesList.filter(function(x){ return !(x.pseudo===pseudo && x.key===key); });  /* retrait optimiste : l'UI réagit tout de suite */
    render();
    E().invalidateCache(); charger().then(render);
  }

  function filtree(){ var f=st.filtre; return demandes.filter(function(d){ if(f==="toutes")return true; if(f==="en_attente")return d.statut==="en_attente"; return d.statut!=="en_attente"; }); }
  function compte(f){ if (f==="dettes") return dettesList.length; return demandes.filter(function(d){ if(f==="toutes")return true; if(f==="en_attente")return d.statut==="en_attente"; return d.statut!=="en_attente"; }).length; }

  function render(){
    var titre = ONGLETS.filter(function(o){return o[0]===st.filtre;})[0][1];
    var tabs = '<div class="mc-head"><h1>Demandes — Les Quais du Bayou</h1><p>Panel staff</p></div>'
      + '<div class="qsd-tabs">'+ONGLETS.map(function(o){ return '<button class="qsd-tab'+(st.filtre===o[0]?" qsd-on":"")+'" data-f="'+o[0]+'">'+o[1]+'<span class="qsd-n">'+compte(o[0])+'</span></button>'; }).join("")+'</div>';
    if (st.filtre==="dettes") {
      root.innerHTML = tabs + '<section class="sj-fiche"><div class="mc-sec-head"><h2>'+titre+'</h2><span class="mc-cpt">'+dettesList.length+'</span></div>'
        + '<p class="mc-sub">Dettes en cours des membres. « Régler » retire la dette du cumul (à faire une fois qu\'elle a été honorée en RP).</p>'
        + (dettesList.length ? dettesList.map(carteDette).join("") : '<p class="mc-sub">Aucune dette en cours.</p>')
        + '</section>';
      wire(); return;
    }
    var list = filtree();
    var sub = { en_attente:"Demandes en attente de traitement par le staff.", traitees:"Demandes déjà traitées, validées, annulées ou refusées.", toutes:"Toutes les demandes de la boutique." }[st.filtre];
    root.innerHTML = tabs + '<section class="sj-fiche">'
      +   '<div class="mc-sec-head"><h2>'+titre+'</h2><span class="mc-cpt">'+list.length+'</span></div>'
      +   '<p class="mc-sub">'+sub+'</p>'
      +   (list.length ? list.map(carte).join("") : '<p class="mc-sub">Aucune demande.</p>')
      + '</section>';
    wire();
  }
  function wire(){
    Array.prototype.forEach.call(root.querySelectorAll(".qsd-tab"), function(b){ b.onclick = function(){ st.filtre = b.getAttribute("data-f"); render(); }; });
    Array.prototype.forEach.call(root.querySelectorAll("[data-act]"), function(b){ b.onclick = function(){ action(b.getAttribute("data-id"), b.getAttribute("data-act")); }; });
    Array.prototype.forEach.call(root.querySelectorAll("[data-detkey]"), function(b){ b.onclick = function(){ reglerDette(b.getAttribute("data-detpseudo"), b.getAttribute("data-detkey")); }; });
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
      else if (act==="valider"){
        if (d.type==="pret" && d.montant){
          var cible = d.cagnotte || "Providence";
          try {
            await E().firebaseTransaction(CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(cible), function(cur){ var c=cur||0; if (c < d.montant) throw new Error("CAG"); return c - d.montant; });
            await E().firebaseTransaction(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dollars", function(cur){ return (cur||0)+(d.montant|0); });
          } catch(e){ if (e&&e.message==="CAG"){ alert("La cagnotte « "+cible+" » est insuffisante pour ce prêt ("+money(d.montant)+")."); return; } if (window.console) console.error(e); alert("Transfert impossible."); return; }
        } else if (d.type==="comptant" && d.cagnotte && d.montant){
          try { await E().firebaseTransaction(CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(d.cagnotte), function(cur){ return (cur||0)+(d.montant|0); }); }
          catch(e){ if (window.console) console.error(e); alert("Crédit de la cagnotte impossible."); return; }
        }
        var di = detteAInscrire(d);
        if (di) { try { await E().firebasePush(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dettes", { creancier:di.creancier, type:di.type, motif:di.motif, statut:"active", date:new Date().toISOString() }); } catch(e){ if (window.console) console.error("[quais-staff] inscription dette", e); } }
        o[base+"/statut"]="validee"; await E().firebaseUpdate(o);
      }
      else { o[base+"/statut"] = act==="traiter"?"traitee":act==="refuser"?"refusee":"en_attente"; await E().firebaseUpdate(o); }
    } catch(e){ if (window.console) console.error("[quais-staff]", e); alert("Action impossible."); return; }
    E().invalidateCache(); await charger(); render();
  }

  async function charger(){
    try {
      var r = await E().safeReadBin();
      var node = (r && r[CFG.NODE_DEMANDES]) || {};
      demandes = Object.keys(node).map(function(id){ var d = node[id]||{}; d.id = id; return d; })
        .sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });
      var membres = (r && r[CFG.NODE_MEMBRES]) || {};
      dettesList = [];
      Object.keys(membres).forEach(function(p){
        var dts = membres[p] && membres[p].dettes;
        if (dts && typeof dts==="object") Object.keys(dts).forEach(function(key){ var e = dts[key]; if (e && typeof e==="object") dettesList.push({ pseudo:p, key:key, creancier:e.creancier, type:e.type, motif:e.motif, statut:e.statut, date:e.date }); });
      });
      dettesList.sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });
    } catch(e){ demandes = []; dettesList = []; }
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
