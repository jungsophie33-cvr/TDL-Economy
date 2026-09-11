/*
 * quais-staff.js — Tableau de bord staff « Les Quais du Bayou » · TDL
 *
 * S'affiche DANS un message (topic zone staff), pas en overlay. Se monte sur
 * #quais-staff, réservé au staff. Réutilise les classes des panels (mc-head,
 * sj-fiche, mc-sec-head, mc-cpt, mc-sub, dc-staff-carte/actions, dc-btn-*,
 * fi-carte-grille) ; injecte seulement les onglets, accordéon, pastilles et groupes.
 *
 * ONGLETS : En attente / Traitées / Toutes (demandes en ACCORDÉON, repliées sur
 *   titre + pseudo) + Gestion des dettes (dettes + liens réseau, REGROUPÉES par membre).
 *
 * À la validation (ou « Marquer traitée ») : mouvements d'argent (cagnotte/prêt),
 *   inscription des dettes (membres/<pseudo>/dettes) et des liens réseau d'influence
 *   (membres/<pseudo>/liens, en TABLEAU comme le bottin ; la « situation vis-à-vis de
 *   la Main » va dans le champ role, lu par le span concours du bottin).
 *
 * DÉPEND DE : window.EcoCore (safeReadBin, firebaseUpdate, firebaseTransaction,
 *   firebasePush, writeField, invalidateCache).
 */
(function () {
  "use strict";
  var CFG = { MOUNT:"#quais-staff", NODE_DEMANDES:"boutique_demandes", NODE_MEMBRES:"membres", NODE_CAGNOTTES:"cagnottes", MONNAIE:"$", RETRY_MS:300, RETRY_MAX:100 };
  function E(){ return window.EcoCore; }
  function isStaff(){ try { return typeof _userdata!=="undefined" && (_userdata.user_level===1||_userdata.user_level===2); } catch(e){ return false; } }
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function money(n){ return (typeof n==="number"?n.toLocaleString("fr-FR").replace(/\u202f/g," "):n)+" "+CFG.MONNAIE; }
  function dateFr(iso){ if(!iso) return "—"; var d=new Date(iso); return isNaN(d.getTime())?String(iso):d.toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}); }
  function vt(v){ return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]); }

  var TYPES = { comptant:"Paiement comptant", dette:"Dette", pret:"Prêt", nego:"Négociation", don:"Don", mission:"Mission", offrande:"Offrande", braconneurs:"Braconneurs", demande:"Demande" };
  var STATUTS = { en_attente:"En attente", validee:"Validée", annulee:"Annulée / remboursée", traitee:"Traitée", refusee:"Refusée" };
  var DETTE_LIB = { lourde:"Dette lourde", legere:"Dette légère", karmique:"Dette karmique", longue:"Dette longue", du:"Service dû", prioritaire:"Dette prioritaire" };
  var RESEAU_LIB = { entreprises:"Entreprises & Commerçants", autorites:"Autorités corrompues", prestataires:"Prestataires & Services", informateurs:"Informateurs locaux" };
  var STATUT_RES = { du:"Service dû", prioritaire:"Dette prioritaire", longue:"Dette longue" };
  var FIELDS = [["contexte","Contexte RP"],["situation","Situation"],["attentes","Attentes"],["remuneration","Rémunération"],["prix_negocie","Prix négocié"],["methode","Méthode"],["compensation","Compensation"],["situation_main","Situation vis-à-vis de la Main"],["pret_contrepartie","Remboursement du prêt"],["aide","Nature de l'aide"],["don","Don"],["demande","Demande / mission"],["prime","Prime"],["requete","Requête"],["offrande","Offrande"],["cible","Cible"],["cible_type","Type de cible"],["cible_pj","PJ ciblé"],["cible_pnj","PNJ ciblé"],["montant_souhaite","Somme demandée"],["lien","Lien"],["article","Article"]];
  var VMAP = { methode:{ rp:"En RP", des:"Avec les dés" }, compensation:{ dette:"Dette lourde", reseau:"Réseau d'influence" }, pret_contrepartie:{ remboursement:"Remboursement en monnaie", dette:"Compensation par dette lourde" }, reseau_cat:RESEAU_LIB };
  var ONGLETS = [["en_attente","En attente"],["traitees","Traitées"],["toutes","Toutes"],["dettes","Gestion des dettes"]];

  var st = { filtre:"en_attente" };
  var root, demandes = [], dettesList = [];

  function styles(){
    if (document.getElementById("qsd-style")) return;
    var s = document.createElement("style"); s.id = "qsd-style";
    s.textContent = ""
    + "#quais-staff .qsd-tabs{display:flex;gap:24px;flex-wrap:wrap;margin:0 0 18px;border-bottom:1px solid var(--cntr6)}"
    + "#quais-staff .qsd-tab{background:none;border:none;padding:6px 2px 9px;border-bottom:3px solid transparent;color:var(--darkopa6);text-transform:uppercase;letter-spacing:.06em;font-size:13px;font-family:var(--txt3);cursor:pointer;display:flex;align-items:center;gap:7px}"
    + "#quais-staff .qsd-tab.qsd-on{border-bottom-color:var(--dark2);color:var(--txt)}"
    + "#quais-staff .qsd-tab .qsd-n{font-size:12px;background:var(--cntr3);border-radius:10px;padding:0 8px;color:var(--darkopa6)}"
    + "#quais-staff .qsd-chip{font-family:var(--txt3);text-transform:uppercase;letter-spacing:.05em;font-size:11px;padding:3px 9px;border-radius:4px;background:var(--cntr3);color:var(--dark)}"
    + "#quais-staff .qsd-st{font-family:var(--txt3);text-transform:uppercase;letter-spacing:.05em;font-size:11px;padding:3px 9px;border-radius:4px;color:var(--clair1)}"
    + "#quais-staff .qsd-st-en_attente{background:var(--gr1-color)}#quais-staff .qsd-st-validee{background:var(--gr2-color)}#quais-staff .qsd-st-traitee{background:var(--gr3-color)}#quais-staff .qsd-st-refusee{background:var(--dark2)}#quais-staff .qsd-st-annulee{background:var(--darkopa5)}"
    /* accordéon des demandes */
    + "#quais-staff .qsd-acc{border:1px solid var(--cntr6);border-radius:6px;margin-bottom:8px;overflow:hidden;background:var(--clair1)}"
    + "#quais-staff .qsd-accbar{width:100%;display:flex;align-items:center;gap:12px;padding:11px 14px;background:none;border:0;text-align:left;cursor:pointer;color:var(--txt)}"
    + "#quais-staff .qsd-accnom{font-family:var(--font2);font-size:16px;text-transform:uppercase;letter-spacing:.01em}"
    + "#quais-staff .qsd-accps{font-family:var(--txt3);font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--darkopa6)}"
    + "#quais-staff .qsd-accchips{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}"
    + "#quais-staff .qsd-chev{font-size:18px;color:var(--darkopa6);transition:transform .25s;flex:none}"
    + "#quais-staff .qsd-acc.qsd-open .qsd-chev{transform:rotate(90deg)}"
    + "#quais-staff .qsd-accbody{padding:2px 14px 14px}"
    /* groupes de dettes par membre */
    + "#quais-staff .qsd-grp{margin-bottom:20px}"
    + "#quais-staff .qsd-grphead{display:flex;align-items:center;gap:10px;padding:6px 2px 8px;border-bottom:1px solid var(--cntr4);margin-bottom:6px}"
    + "#quais-staff .qsd-grphead .nom{font-family:var(--font2);font-size:17px;text-transform:uppercase}"
    + "#quais-staff .qsd-grphead .n{font-family:var(--txt3);font-size:12px;background:var(--cntr3);border-radius:10px;padding:1px 9px;color:var(--darkopa6)}"
    + "#quais-staff .qsd-drow{display:flex;align-items:center;gap:12px;padding:9px 2px;border-top:1px solid var(--cntr2)}"
    + "#quais-staff .qsd-drow:first-of-type{border-top:0}"
    + "#quais-staff .qsd-drow .m{flex:1;font-family:var(--txt1);font-size:15px;line-height:1.35}"
    + "#quais-staff .qsd-drow .dt{font-size:12px;color:var(--darkopa6);white-space:nowrap}"
    + "#quais-staff .qsd-regler{font-family:var(--txt3);text-transform:uppercase;letter-spacing:.05em;font-size:11px;padding:6px 12px;border-radius:4px;border:1px solid var(--dark2);background:none;color:var(--dark2);cursor:pointer;white-space:nowrap}"
    + "#quais-staff .qsd-gate{margin:auto;font-family:var(--font2);font-size:18px;color:var(--darkopa6)}";
    document.head.appendChild(s);
  }

  function chip(t){ return '<span class="qsd-chip">'+esc(TYPES[t]||t||"—")+'</span>'; }
  function stChip(s){ return '<span class="qsd-st qsd-st-'+esc(s||"en_attente")+'">'+esc(STATUTS[s]||s||"—")+'</span>'; }
  function detteChip(t){ var cls = { lourde:"refusee", legere:"en_attente", karmique:"traitee", longue:"validee", du:"traitee", prioritaire:"refusee" }[t] || "en_attente"; return '<span class="qsd-st qsd-st-'+cls+'">'+esc(DETTE_LIB[t]||t)+'</span>'; }
  function ligne(l, v){ return '<span>'+esc(l)+'</span><span>'+esc(v)+'</span>'; }

  function detteAInscrire(d){
    if (d.dette_type) return { type:d.dette_type, creancier:d.creancier||d.bande||"", motif:d.motif||d.nom||"" };
    if (d.compensation==="dette") return { type:"lourde", creancier:d.bande||d.creancier||"La Main de la Providence", motif:d.nom||"" };
    if (d.pret_contrepartie==="dette") return { type:"lourde", creancier:d.bande||"La Main de la Providence", motif:"Prêt : "+(d.nom||"") };
    return null;
  }
  function reseauAInscrire(d){
    if (d.reseau_auto) return { categorie:d.reseau_auto, statut:"longue", role:d.situation_main||d.contexte||d.nom||"" };
    if (d.compensation==="reseau" && d.reseau_cat) return { categorie:d.reseau_cat, statut:"du", role:d.situation_main||d.nom||"" };
    return null;
  }

  function champs(d){
    var out = "";
    if (typeof d.montant==="number" && d.montant>0) out += ligne("Montant", money(d.montant));
    if (d.type==="dette" && d.dette_num) out += ligne("Rang dette lourde", "n°"+d.dette_num);
    var di = detteAInscrire(d); if (di) out += ligne("Dette à inscrire", (DETTE_LIB[di.type]||di.type)+(di.creancier?" · "+di.creancier:""));
    var ri = reseauAInscrire(d); if (ri) out += ligne("Réseau à inscrire", (RESEAU_LIB[ri.categorie]||ri.categorie)+" · "+(STATUT_RES[ri.statut]||ri.statut));
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
  /* demande repliée : titre + pseudo + pastilles ; dépliée : détails + actions */
  function accDemande(d){
    return '<div class="qsd-acc" data-acc="'+esc(d.id)+'"><button class="qsd-accbar"><span class="qsd-accnom">'+esc(d.nom||d.itemId||"—")+'</span>'
      + '<span class="qsd-accps">'+esc(d.pseudo||"?")+'</span>'
      + '<span class="qsd-accchips">'+chip(d.type)+stChip(d.statut)+'</span><span class="qsd-chev">\u203A</span></button>'
      + '<div class="qsd-accbody" style="display:none"><div class="qsd-accmeta" style="font-size:12px;color:var(--darkopa6);margin:2px 0 4px">'+dateFr(d.date)+(d.bande?" · "+esc(d.bande):"")+'</div>'
      + champs(d) + actions(d) + '</div></div>';
  }

  function reglerBtn(x){
    return '<button class="qsd-regler" data-source="'+x.source+'" data-pseudo="'+esc(x.pseudo)+'"'
      + (x.source==="dette"?' data-key="'+esc(x.key)+'"':' data-idx="'+x.idx+'"')+'>Régler</button>';
  }
  function detteRow(x){
    var label = (x.source==="lien")
      ? (RESEAU_LIB[x.categorie]||x.categorie||"Réseau")+(x.motif?" — "+x.motif:"")
      : (x.motif || x.creancier || "—");
    return '<div class="qsd-drow">'+detteChip(x.type)+'<div class="m">'+esc(label)+(x.creancier&&x.source==="dette"?' <span style="color:var(--darkopa6)">· '+esc(x.creancier)+'</span>':"")+'</div>'
      + '<span class="dt">'+dateFr(x.date)+'</span>'+reglerBtn(x)+'</div>';
  }

  function filtree(){ var f=st.filtre; return demandes.filter(function(d){ if(f==="toutes")return true; if(f==="en_attente")return d.statut==="en_attente"; return d.statut!=="en_attente"; }); }
  function compte(f){ if (f==="dettes") return dettesList.length; return demandes.filter(function(d){ if(f==="toutes")return true; if(f==="en_attente")return d.statut==="en_attente"; return d.statut!=="en_attente"; }).length; }

  function render(){
    var titre = ONGLETS.filter(function(o){return o[0]===st.filtre;})[0][1];
    var tabs = '<div class="mc-head"><h1>Demandes — Les Quais du Bayou</h1><p>Panel staff</p></div>'
      + '<div class="qsd-tabs">'+ONGLETS.map(function(o){ return '<button class="qsd-tab'+(st.filtre===o[0]?" qsd-on":"")+'" data-f="'+o[0]+'">'+o[1]+'<span class="qsd-n">'+compte(o[0])+'</span></button>'; }).join("")+'</div>';

    if (st.filtre==="dettes") {
      var groupes = {}; dettesList.forEach(function(x){ (groupes[x.pseudo] = groupes[x.pseudo] || []).push(x); });
      var pseudos = Object.keys(groupes).sort(function(a,b){ return a.localeCompare(b,"fr"); });
      var corps = pseudos.length ? pseudos.map(function(p){
        return '<div class="qsd-grp"><div class="qsd-grphead"><span class="nom">'+esc(p)+'</span><span class="n">'+groupes[p].length+'</span></div>'
          + groupes[p].map(detteRow).join("") + '</div>';
      }).join("") : '<p class="mc-sub">Aucune dette en cours.</p>';
      root.innerHTML = tabs + '<section class="sj-fiche"><div class="mc-sec-head"><h2>'+titre+'</h2><span class="mc-cpt">'+dettesList.length+'</span></div>'
        + '<p class="mc-sub">Dettes et engagements réseau des membres, regroupés par joueur. « Régler » retire l\'entrée (à faire quand elle a été honorée en RP).</p>'
        + corps + '</section>';
      wire(); return;
    }

    var list = filtree();
    var sub = { en_attente:"Demandes en attente. Cliquez une ligne pour la déplier.", traitees:"Demandes déjà traitées, validées, annulées ou refusées.", toutes:"Toutes les demandes de la boutique." }[st.filtre];
    root.innerHTML = tabs + '<section class="sj-fiche">'
      +   '<div class="mc-sec-head"><h2>'+titre+'</h2><span class="mc-cpt">'+list.length+'</span></div>'
      +   '<p class="mc-sub">'+sub+'</p>'
      +   (list.length ? list.map(accDemande).join("") : '<p class="mc-sub">Aucune demande.</p>')
      + '</section>';
    wire();
  }
  function wire(){
    Array.prototype.forEach.call(root.querySelectorAll(".qsd-tab"), function(b){ b.onclick = function(){ st.filtre = b.getAttribute("data-f"); render(); }; });
    Array.prototype.forEach.call(root.querySelectorAll(".qsd-accbar"), function(b){ b.onclick = function(){ var acc=b.parentElement, bd=b.nextElementSibling; var open=acc.classList.toggle("qsd-open"); bd.style.display = open?"":"none"; }; });
    Array.prototype.forEach.call(root.querySelectorAll("[data-act]"), function(b){ b.onclick = function(){ action(b.getAttribute("data-id"), b.getAttribute("data-act")); }; });
    Array.prototype.forEach.call(root.querySelectorAll(".qsd-regler"), function(b){ b.onclick = function(){ regler(b.getAttribute("data-source"), b.getAttribute("data-pseudo"), b.getAttribute("data-key"), b.getAttribute("data-idx")); }; });
  }

  async function ajouterLien(pseudo, lien){
    var r = await E().safeReadBin();
    var arr = vt(r && r[CFG.NODE_MEMBRES] && r[CFG.NODE_MEMBRES][pseudo] && r[CFG.NODE_MEMBRES][pseudo].liens);
    arr.push(lien);
    await E().writeField(CFG.NODE_MEMBRES+"/"+encodeURIComponent(pseudo)+"/liens", arr);
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
      else if (act==="valider" || act==="traiter"){
        if (act==="valider"){
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
        }
        var di = detteAInscrire(d);
        if (di) { try { await E().firebasePush(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dettes", { creancier:di.creancier, type:di.type, motif:di.motif, statut:"active", date:new Date().toISOString() }); } catch(e){ if (window.console) console.error("[quais-staff] dette", e); } }
        var ri = reseauAInscrire(d);
        if (ri) { try { await ajouterLien(d.pseudo, { type:"reseau_main", categorie:ri.categorie, role:ri.role, statut:ri.statut }); } catch(e){ if (window.console) console.error("[quais-staff] réseau", e); } }
        o[base+"/statut"] = act==="valider" ? "validee" : "traitee"; await E().firebaseUpdate(o);
      }
      else { o[base+"/statut"] = act==="refuser"?"refusee":"en_attente"; await E().firebaseUpdate(o); }
    } catch(e){ if (window.console) console.error("[quais-staff]", e); alert("Action impossible."); return; }
    E().invalidateCache(); await charger(); render();
  }

  async function regler(source, pseudo, key, idx){
    if (!confirm("Régler et retirer cette entrée de "+pseudo+" ? (à faire quand elle a été honorée en RP)")) return;
    try {
      if (source==="lien") {
        var r = await E().safeReadBin();
        var arr = vt(r && r[CFG.NODE_MEMBRES] && r[CFG.NODE_MEMBRES][pseudo] && r[CFG.NODE_MEMBRES][pseudo].liens);
        arr.splice(parseInt(idx,10), 1);
        await E().writeField(CFG.NODE_MEMBRES+"/"+encodeURIComponent(pseudo)+"/liens", arr.length?arr:null);
      } else {
        var o = {}; o[CFG.NODE_MEMBRES+"/"+pseudo+"/dettes/"+key] = null;   /* chemin brut : PATCH racine */
        await E().firebaseUpdate(o);
      }
    } catch(e){ if (window.console) console.error("[quais-staff] régler", e); alert("Impossible de régler l'entrée."); return; }
    dettesList = dettesList.filter(function(x){ return !(x.pseudo===pseudo && ((source==="dette"&&x.key===key) || (source==="lien"&&String(x.idx)===String(idx)))); });
    render();
    E().invalidateCache(); charger().then(render);
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
        var m = membres[p] || {};
        var dts = m.dettes;
        if (dts && typeof dts==="object") Object.keys(dts).forEach(function(key){ var e = dts[key]; if (e && typeof e==="object") dettesList.push({ pseudo:p, source:"dette", key:key, type:e.type, motif:e.motif, creancier:e.creancier, date:e.date }); });
        vt(m.liens).forEach(function(l, idx){ if (l && l.type==="reseau_main" && l.statut) dettesList.push({ pseudo:p, source:"lien", idx:idx, type:l.statut, categorie:l.categorie, motif:l.role, date:l.date }); });
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
