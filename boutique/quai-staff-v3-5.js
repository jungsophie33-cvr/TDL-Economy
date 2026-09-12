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
  var FIELDS = [["contexte","Contexte RP"],["situation","Situation"],["attentes","Attentes"],["remuneration","Rémunération"],["prix_negocie","Prix négocié"],["prix_offert","Prix proposé"],["methode","Méthode"],["compensation","Compensation"],["dette_argument","Ce qu'il offre à la Main"],["situation_main","Situation vis-à-vis de la Main"],["pret_contrepartie","Remboursement du prêt"],["aide","Nature de l'aide"],["don","Don"],["demande","Demande / mission"],["prime","Prime"],["requete","Requête"],["offrande","Offrande"],["cible","Cible"],["cible_type","Type de cible"],["cible_pj","PJ ciblé"],["cible_pnj","PNJ ciblé"],["montant_souhaite","Somme demandée"],["lien","Lien"],["article","Article"]];
  var VMAP = { methode:{ rp:"En RP", des:"Avec les dés" }, compensation:{ prix:"Prix", dette:"Dette lourde", reseau:"Réseau d'influence" }, pret_contrepartie:{ remboursement:"Remboursement en monnaie", dette:"Compensation par dette lourde" }, reseau_cat:RESEAU_LIB };
  var ONGLETS = [["en_attente","En attente"],["traitees","Traitées"],["toutes","Toutes"],["dettes","Gestion des dettes"]];

  var st = { filtre:"en_attente" };
  var root, demandes = [], dettesList = [];

  function chip(t){ return '<span class="qsd-chip">'+esc(TYPES[t]||t||"—")+'</span>'; }
  function stChip(s){ return '<span class="qsd-st qsd-st-'+esc(s||"en_attente")+'">'+esc(STATUTS[s]||s||"—")+'</span>'; }
  function detteChip(t){ var cls = { lourde:"refusee", legere:"en_attente", karmique:"traitee", longue:"validee", du:"traitee", prioritaire:"refusee" }[t] || "en_attente"; return '<span class="qsd-st qsd-st-'+cls+'">'+esc(DETTE_LIB[t]||t)+'</span>'; }
  function ligne(l, v){ return '<span>'+esc(l)+'</span><span>'+esc(v)+'</span>'; }

  function detteAInscrire(d){
    if (d.dette_type) return { type:d.dette_type, creancier:d.creancier||d.bande||"", motif:d.motif||d.nom||"" };
    if (d.compensation==="dette") return { type:"lourde", creancier:d.bande||d.creancier||"La Main de la Providence", motif:d.dette_argument||d.nom||"" };
    if (d.pret_contrepartie==="dette") return { type:"lourde", creancier:d.bande||"La Main de la Providence", motif:"Prêt : "+(d.nom||"") };
    return null;
  }
  function reseauAInscrire(d){
    if (d.reseau_auto) return { categorie:d.reseau_auto, statut:"longue", role:d.nom||"", fixe:true };
    if (d.compensation==="reseau" && d.reseau_cat) return { categorie:d.reseau_cat, statut:null, role:d.situation_main||"", fixe:false };
    return null;
  }

  function champs(d){
    var out = "";
    if (typeof d.montant==="number" && d.montant>0) out += ligne("Montant", money(d.montant));
    if (d.type==="dette" && d.dette_num) out += ligne("Rang dette lourde", "n°"+d.dette_num);
    var di = detteAInscrire(d); if (di) out += ligne("Dette à inscrire", (DETTE_LIB[di.type]||di.type)+(di.creancier?" · "+di.creancier:""));
    var ri = reseauAInscrire(d); if (ri) out += ligne("Réseau à inscrire", (RESEAU_LIB[ri.categorie]||ri.categorie)+" · "+(ri.statut?(STATUT_RES[ri.statut]||ri.statut):"statut à préciser par le staff"));
    FIELDS.forEach(function(f){ var v=d[f[0]]; if (v!=null && String(v).trim()!=="") { if (VMAP[f[0]] && VMAP[f[0]][v]) v=VMAP[f[0]][v]; out += ligne(f[1], v); } });
    return out ? '<div class="fi-carte-grille">'+out+'</div>' : "";
  }
  /* si le réseau doit être inscrit et que le staff doit fixer le statut, on affiche un menu */
  function statutBloc(d){
    var ri = reseauAInscrire(d); if (!ri || ri.fixe) return "";
    return '<div class="qsd-restatut-wrap"><span class="qsd-restatut-lbl">Nature de la dette réseau</span><select class="qsd-restatut" data-id="'+esc(d.id)+'"><option value="du">Service dû</option><option value="longue">Dette longue</option><option value="prioritaire">Dette prioritaire</option></select></div>';
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
      + '<div class="qsd-accbody" style="display:none"><div class="qsd-accmeta">'+dateFr(d.date)+(d.bande?" · "+esc(d.bande):"")+'</div>'
      + champs(d) + statutBloc(d) + actions(d) + '</div></div>';
  }

  function reglerBtn(x){
    if (x.source==="pret") return '<button class="qsd-regler" data-source="pret" data-pseudo="'+esc(x.pseudo)+'" data-key="'+esc(x.key)+'" data-montant="'+(x.montant|0)+'" data-cag="'+esc(x.cagnotte||"Providence")+'">Procéder au remboursement</button>';
    return '<button class="qsd-regler" data-source="'+x.source+'" data-pseudo="'+esc(x.pseudo)+'"'
      + (x.source==="dette"?' data-key="'+esc(x.key)+'"':' data-idx="'+x.idx+'"')+'>Régler</button>';
  }
  function detteRow(x){
    var puce, label;
    if (x.source==="pret") { puce = '<span class="qsd-st qsd-st-validee">Prêt à rembourser</span>'; label = money(x.montant)+(x.motif?" · "+x.motif:""); }
    else if (x.source==="lien") { puce = detteChip(x.type); label = (RESEAU_LIB[x.categorie]||x.categorie||"Réseau")+(x.motif?" — "+x.motif:""); }
    else { puce = detteChip(x.type); label = (x.motif || x.creancier || "—")+(x.creancier?" · "+x.creancier:""); }
    return '<div class="qsd-drow">'+puce+'<div class="m">'+esc(label)+'</div><span class="dt">'+dateFr(x.date)+'</span>'+reglerBtn(x)+'</div>';
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
    Array.prototype.forEach.call(root.querySelectorAll(".qsd-regler"), function(b){ b.onclick = function(){ regler(b.getAttribute("data-source"), b.getAttribute("data-pseudo"), b.getAttribute("data-key"), b.getAttribute("data-idx"), b.getAttribute("data-montant"), b.getAttribute("data-cag")); }; });
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
            if (d.pret_contrepartie==="remboursement") { try { await E().firebasePush(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/prets", { montant:d.montant|0, cagnotte:cible, nom:d.nom||"Prêt", date:new Date().toISOString() }); } catch(e){ if (window.console) console.error("[quais-staff] prêt", e); } }
          } else if (d.type==="comptant" && d.cagnotte && d.montant){
            try { await E().firebaseTransaction(CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(d.cagnotte), function(cur){ return (cur||0)+(d.montant|0); }); }
            catch(e){ if (window.console) console.error(e); alert("Crédit de la cagnotte impossible."); return; }
          }
        }
        /* Confesse payée en monnaie : on débite le membre vers la cagnotte de la Main */
        if (d.compensation==="prix" && d.prix_offert){
          var px = parseInt(d.prix_offert,10)||0, cagP = d.cagnotte||"Providence";
          if (px>0){
            try {
              await E().firebaseTransaction(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dollars", function(cur){ var c=cur||0; if (c < px) throw new Error("FONDS"); return c - px; });
              await E().firebaseTransaction(CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(cagP), function(cur){ return (cur||0)+px; });
            } catch(e){ if (e&&e.message==="FONDS"){ alert(d.pseudo+" n'a pas les fonds pour payer "+money(px)+"."); return; } if (window.console) console.error(e); alert("Débit impossible."); return; }
          }
        }
        var di = detteAInscrire(d);
        if (di) { try { await E().firebasePush(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dettes", { creancier:di.creancier, type:di.type, motif:di.motif, statut:"active", date:new Date().toISOString() }); } catch(e){ if (window.console) console.error("[quais-staff] dette", e); } }
        var ri = reseauAInscrire(d);
        if (ri) {
          var statutRes = ri.statut;
          if (!statutRes) { var selR = root.querySelector('.qsd-restatut[data-id="'+id+'"]'); statutRes = (selR && selR.value) || "du"; }
          try { await ajouterLien(d.pseudo, { type:"reseau_main", categorie:ri.categorie, role:ri.role, statut:statutRes }); } catch(e){ if (window.console) console.error("[quais-staff] réseau", e); }
        }
        o[base+"/statut"] = act==="valider" ? "validee" : "traitee"; await E().firebaseUpdate(o);
      }
      else { o[base+"/statut"] = act==="refuser"?"refusee":"en_attente"; await E().firebaseUpdate(o); }
    } catch(e){ if (window.console) console.error("[quais-staff]", e); alert("Action impossible."); return; }
    E().invalidateCache(); await charger(); render();
  }

  async function regler(source, pseudo, key, idx, montant, cag){
    if (source==="pret") {
      montant = parseInt(montant,10)||0;
      if (!confirm("Procéder au remboursement de "+money(montant)+" par "+pseudo+" ? (débité de son solde, recrédité à la cagnotte « "+cag+" »)")) return;
      try {
        await E().firebaseTransaction(CFG.NODE_MEMBRES+"/"+encodeURIComponent(pseudo)+"/dollars", function(cur){ var c=cur||0; if (c < montant) throw new Error("FONDS"); return c - montant; });
        await E().firebaseTransaction(CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(cag||"Providence"), function(cur){ return (cur||0)+montant; });
        var op = {}; op[CFG.NODE_MEMBRES+"/"+pseudo+"/prets/"+key] = null; await E().firebaseUpdate(op);
      } catch(e){ if (e&&e.message==="FONDS"){ alert(pseudo+" n'a pas les fonds pour rembourser ("+money(montant)+")."); return; } if (window.console) console.error("[quais-staff] remboursement", e); alert("Remboursement impossible."); return; }
      dettesList = dettesList.filter(function(x){ return !(x.source==="pret" && x.pseudo===pseudo && x.key===key); });
      render(); E().invalidateCache(); charger().then(render); return;
    }
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
        var prets = m.prets;
        if (prets && typeof prets==="object") Object.keys(prets).forEach(function(key){ var e = prets[key]; if (e && typeof e==="object") dettesList.push({ pseudo:p, source:"pret", key:key, montant:e.montant, cagnotte:e.cagnotte, motif:e.nom, date:e.date }); });
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
    root = m;
    if (!isStaff()){ root.innerHTML = ""; return; }
    charger().then(render);
  }

  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
