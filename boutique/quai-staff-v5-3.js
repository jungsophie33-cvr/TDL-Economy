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
 *   (membres/<pseudo>/liens, en NŒUD À CLÉS depuis la v7 ; la « situation vis-à-vis
 *   de la Main » va dans le champ role, lu par le span concours du bottin).
 *
 * [MAJ v7] LES LIENS DE RÉSEAU PASSENT AUX CLÉS.
 *   ajouterLien lisait le tableau du membre, y poussait le nouveau lien et
 *   réécrivait le tout : un lien ajouté entre-temps par un onglet du bottin
 *   disparaissait. Et « Régler » faisait un splice(indice) — qui décalait tous
 *   les liens suivants, de sorte que le règlement d'après visait le mauvais
 *   contact, y compris à travers les deux réseaux (Main et Faiseuses partagent
 *   la même branche). Les deux passent désormais par l'API du socle, qui
 *   n'écrit qu'un chemin : membres/{pseudo}/liens/{clé}.
 *
 * [MAJ v5] CRÉATIONS SENTINELLÉES.
 *   creerDossierMain et creerTache passaient par firebasePush : la clé était
 *   générée par le serveur et AUCUNE sentinelle n'était bumpée. Conséquence :
 *   un dossier de la Main créé par une validation staff restait invisible des
 *   onglets déjà ouverts sur le tableau. Les deux passent désormais par
 *   TDLBase.ecrireEntree avec une clé générée en local — un seul aller-retour
 *   au lieu de deux, et {node}_rev/{id} bumpé dans le même PATCH.
 *   Le dossier de la Main naît en schema 2 : plus de conversion à refaire.
 *
 * [MAJ v6] L'entrée du hangar (disparition, opération) est elle aussi
 *   sentinellée, grâce au chemin de révision explicite de TDLBase.table :
 *   flottille/{sous}/{id} pour la donnée, flottille_rev/{sous}/{id} pour la
 *   révision. Plus aucune écriture croisée du forum n'est aveugle.
 *
 * [MAJ v5] LECTURES CIBLÉES.
 *   charger() relisait les 126 ko de la racine à CHAQUE action staff. Il lit
 *   maintenant boutique_demandes (~11 ko), membres (~3 ko, partagé par le
 *   socle) et, une seule fois par session, le catalogue boutique/barge
 *   (~12 ko) qui ne change qu'à l'édition d'un item.
 *   ajouterLien et regler visent une clé, sans lire ni réécrire la branche.
 *
 * DÉPEND DE : window.EcoCore (firebaseGet, firebaseUpdate, firebaseTransaction,
 *   firebasePush) et window.TDLBase (nouvelleCle, ecrireEntree, table, membres,
 *   liens, ecrireLien, supprimerLien).
 *   Ordre de chargement : eco-core → tdl-base → ce fichier.
 */
(function () {
  "use strict";
  var CFG = { MOUNT:"#quais-staff", NODE_DEMANDES:"boutique_demandes", NODE_MEMBRES:"membres", NODE_CAGNOTTES:"cagnottes", NODE_TACHES:"taches_faiseuses", NODE_DOSSIERS:"dossiers_main", NODE_FLOT:"flottille", NODE_CATALOGUE:"boutique/barge", MONNAIE:"$", RETRY_MS:300, RETRY_MAX:100 };
  var SCHEMA_DOSSIER = 2;      /* doit suivre rep-det-main   */
  var SCHEMA_TACHE   = 2;      /* doit suivre rep-tac-fais    */
  var RACINE_FLOT_REV= "flottille_rev";   /* sentinelle du hangar, hors du nœud */
  function E(){ return window.EcoCore; }
  function B(){ return window.TDLBase; }
  function isStaff(){ try { return typeof _userdata!=="undefined" && (_userdata.user_level===1||_userdata.user_level===2); } catch(e){ return false; } }
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function money(n){ return (typeof n==="number"?n.toLocaleString("fr-FR").replace(/\u202f/g," "):n)+" "+CFG.MONNAIE; }
  function dateFr(iso){ if(!iso) return "—"; var d=new Date(iso); return isNaN(d.getTime())?String(iso):d.toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}); }

  /* [MAJ v5] TDLBase.ecrireEntree rend false au lieu de lever : les appelants
     ci-dessous comptent sur une exception pour afficher leur alerte. */
  function ecrireEntree(node, id, data, libelle){
    return Promise.resolve(B().ecrireEntree(node, id, data, libelle)).then(function(ok){
      if (!ok) throw new Error("écriture refusée : "+node+"/"+id);
      return id;
    });
  }

  var TYPES = { comptant:"Paiement comptant", dette:"Dette", pret:"Prêt", nego:"Négociation", don:"Don", mission:"Mission", offrande:"Offrande", braconneurs:"Braconneurs", demande:"Demande", faveur:"Faveur — Faiseuses", don_reseau:"Don au réseau — Faiseuses" };
  var STATUTS = { en_attente:"En attente", validee:"Validée", annulee:"Annulée / remboursée", traitee:"Traitée", refusee:"Refusée" };
  var DETTE_LIB = { lourde:"Dette lourde", legere:"Dette légère", karmique:"Dette karmique", longue:"Dette longue", du:"Service dû", prioritaire:"Dette prioritaire" };
  var RESEAU_LIB = { entreprises:"Entreprises & Commerçants", autorites:"Autorités corrompues", prestataires:"Prestataires & Services", informateurs:"Informateurs locaux" };
  var STATUT_RES = { du:"Service dû", prioritaire:"Dette prioritaire", longue:"Dette longue" };
  var DISPO_LIB = { disponible:"Disponible", ponctuel:"Ponctuel", indisponible:"Indisponible" };
  var CIBLE_LIB = { pj:"Un personnage joueur", pnj:"Un PNJ", famille:"Une famille", groupe:"Un groupe", entreprise:"Une entreprise" };
  var FIELDS = [["lieu_vise","Lieu ou communauté visée"],["verrou_acces","Ce qui rend l'accès impossible"],["but_passage","Ce que le personnage va y faire"],["titre","Titre de l'opération"],["verrou_libelle","Pourquoi la Flottille"],["parties","Qui doit se retrouver là"],["objectif","Objectif"],
                  ["contraintes","Contraintes"],["mandtype_libelle","Commanditaire affiché"],["mand","Libellé du commanditaire"],["duree_libelle","Durée d'absence"],["destination","Destination"],["motif_libelle","Motif du départ"],["dette_libelle","Dette fuie"],["enquete_titre","Affaire fuie"],
                  ["restent","Reste derrière (PJ)"],["restent_pnj","Autres proches"],["contexte","Contexte RP"],["situation","Situation"],["attentes","Attentes"],["remuneration","Rémunération"],["prix_negocie","Prix négocié"],["prix_offert","Prix proposé"],["methode","Méthode"],
                  ["compensation","Compensation"],["dette_argument","Ce qu'il offre à la Main"],["situation_main","Situation vis-à-vis de la Main"],["pret_contrepartie","Remboursement du prêt"],["aide","Nature de l'aide"],["don","Don"],
                ["demande","Demande / mission"],["prime","Prime"],["requete","Requête"],["offrande","Offrande"],["cible","Cible"],["cible_type","Type de cible"],["cible_pj","PJ ciblé"],["cible_pnj","PNJ ciblé"],["montant_souhaite","Somme demandée"],["lien","Lien"],["article","Article"],
                ["ressource","Ressource ou accès proposé"],["apport","Ce que ça apporte au réseau"],["activite","Activité du personnage"],["dispo","Disponibilité"],["rp_mission","Vocation à devenir une mission RP"]];
  var VMAP = { methode:{ rp:"En RP", des:"Avec les dés" }, compensation:{ prix:"Prix", dette:"Dette lourde", reseau:"Réseau d'influence" }, pret_contrepartie:{ remboursement:"Remboursement en monnaie", dette:"Compensation par dette lourde" }, reseau_cat:RESEAU_LIB, dispo:DISPO_LIB, cible_type:CIBLE_LIB, rp_mission:{ oui:"Oui — à jouer en RP" } };
  var ONGLETS = [["en_attente","En attente"],["traitees","Traitées"],["toutes","Toutes"],["dettes","Gestion des dettes"]];

  var st = { filtre:"en_attente" };
  var root, demandes = [], dettesList = [], CATALOGUE = {}, catalogueLu = false;

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
    if (d.reseau_auto==="faiseuses") return { reseau:"faiseuses", categorie:"faiseuses", statut:d.dispo||"disponible", role:d.apport||d.ressource||d.nom||"", activite:d.activite||"", fixe:false };
    if (d.reseau_auto) return { categorie:d.reseau_auto, statut:"longue", role:d.nom||"", fixe:true };
    if (d.compensation==="reseau" && d.reseau_cat) return { categorie:d.reseau_cat, statut:null, role:d.situation_main||"", fixe:false };
    return null;
  }

  function champs(d){
    var out = "";
    if (typeof d.montant==="number" && d.montant>0) out += ligne("Montant", money(d.montant));
    if (d.type==="dette" && d.dette_num) out += ligne("Rang dette lourde", "n°"+d.dette_num);
    var di = detteAInscrire(d); if (di) out += ligne("Dette à inscrire", (DETTE_LIB[di.type]||di.type)+(di.creancier?" · "+di.creancier:""));
    if (d.itemId==="flot_disparition") out += ligne("Entrée à créer", "Tableau du hangar \u00b7 disparition");
    if (d.itemId==="flot_operation")   out += ligne("Entrée à créer", "Tableau du hangar \u00b7 opération");
    var pn = phaseNego(d), ps = phaseService(d);
    if (pn || ps) out += ligne("Dossier à ouvrir", "Tableau de la Main · " + (pn&&ps ? "négociation puis service" : (pn ? "négociation en RP" : "service à rendre")));
    var ri = reseauAInscrire(d);
    if (ri && ri.reseau==="faiseuses") out += ligne("Réseau à inscrire", "Faiseuses d\u2019Anges · "+(DISPO_LIB[ri.statut]||ri.statut));
    else if (ri) out += ligne("Réseau à inscrire", (RESEAU_LIB[ri.categorie]||ri.categorie)+" · "+(ri.statut?(STATUT_RES[ri.statut]||ri.statut):"statut à préciser par le staff"));
    FIELDS.forEach(function(f){ var v=d[f[0]]; if (v!=null && String(v).trim()!=="") { if (VMAP[f[0]] && VMAP[f[0]][v]) v=VMAP[f[0]][v]; out += ligne(f[1], v); } });
    return out ? '<div class="fi-carte-grille">'+out+'</div>' : "";
  }
     /* si le réseau doit être inscrit et que le staff doit fixer le statut, on affiche un menu */
  function statutBloc(d){
    var ri = reseauAInscrire(d); if (!ri || ri.fixe) return "";
    if (ri.reseau==="faiseuses") {
      return '<div class="qsd-restatut-wrap"><span class="qsd-restatut-lbl">Disponibilité du contact</span><select class="qsd-restatut" data-id="'+esc(d.id)+'">'
        + Object.keys(DISPO_LIB).map(function(k){ return '<option value="'+k+'"'+(k===ri.statut?" selected":"")+'>'+esc(DISPO_LIB[k])+'</option>'; }).join("")
        + '</select></div>';
    }
    return '<div class="qsd-restatut-wrap"><span class="qsd-restatut-lbl">Nature de la dette réseau</span><select class="qsd-restatut" data-id="'+esc(d.id)+'"><option value="du">Service dû</option><option value="longue">Dette longue</option><option value="prioritaire">Dette prioritaire</option></select></div>';
  }
  function btn(id, act, label, cls){ return '<button class="'+cls+'" data-id="'+esc(id)+'" data-act="'+act+'">'+label+'</button>'; }
  function actions(d){
    var a = "";
    if (d.statut==="en_attente"){
      if (d.type==="comptant") a += btn(d.id,"valider","Valider","dc-btn-valider") + btn(d.id,"annuler","Annuler & rembourser","dc-btn-refuser");
      else if (d.type==="pret") a += btn(d.id,"valider","Valider le prêt","dc-btn-valider") + btn(d.id,"refuser","Refuser","dc-btn-refuser");
      else if (d.type==="dette") a += btn(d.id,"valider","Valider","dc-btn-valider") + btn(d.id,"refuser","Refuser","dc-btn-refuser");
      else if (d.type==="faveur") a += btn(d.id,"traiter","Transmettre aux Faiseuses","dc-btn-valider") + btn(d.id,"refuser","Refuser","dc-btn-refuser");
      else if (d.type==="don_reseau") a += btn(d.id,"traiter","Valider le don","dc-btn-valider") + btn(d.id,"refuser","Refuser","dc-btn-refuser");
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
      + (x.source==="dette"?' data-key="'+esc(x.key)+'"':' data-cle="'+esc(x.cle)+'"')+'>Régler</button>';
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
    Array.prototype.forEach.call(root.querySelectorAll(".qsd-regler"), function(b){ b.onclick = function(){ regler(b.getAttribute("data-source"), b.getAttribute("data-pseudo"), b.getAttribute("data-key"), b.getAttribute("data-cle"), b.getAttribute("data-montant"), b.getAttribute("data-cag")); }; });
  }

  /* [MAJ v7] un lien s'écrit SEUL, sous sa propre clé : plus de lecture-puis-
     réécriture du tableau du membre, donc plus d'écrasement d'un lien ajouté
     entre-temps par un onglet du bottin. */
  async function ajouterLien(pseudo, lien){
    var ok = await B().ecrireLien(pseudo, B().nouvelleCle(), lien);
    if (!ok) throw new Error("écriture du lien refusée : "+pseudo);
  }

  /* [MAJ v5] clé générée en local + sentinelle bumpée dans le même PATCH. */
  function creerTache(d){
    var now = new Date().toISOString();
    var id = B().nouvelleCle();
    return ecrireEntree(CFG.NODE_TACHES, id, {
      schema: SCHEMA_TACHE,
      origine:"faveur", demandeId:d.id||"", demandeur:d.pseudo||"",
      titre:d.nom||"Faveur demandée", categorie:"faveur",
      demande:d.demande||"", contexte:d.contexte||"", don:d.don||"",
      versRp: d.rp_mission==="oui",
      statut:"en_vote", votes:{}, sujet:"",
      cree:now, ouverte:now
    }, "faveur transmise aux Faiseuses").then(function(r){
      try{ if(window.EcoNotif) EcoNotif.bande("faiseuses",130,{titre:d.nom||"Faveur demandée"},"fav"+(d.id||"")); }catch(e){}
      return r;
    });
  }

    /* Une demande « nego » ouvre un dossier au tableau de la Main dans deux cas,
     éventuellement les deux à la fois :
       - la négociation se joue en RP (methode « rp », ou service rpOnly qui n'a
         pas de sélecteur de méthode mais porte un prix négocié) → phase 1 ;
       - le service a vocation à devenir un RP (case rp_mission) → phase 2.
     La Confesse n'a pas de prix négocié : elle n'ouvre jamais de phase 1. */
  function phaseNego(d){
    if (d.type!=="nego" || d.situation) return false;
    if (d.methode==="des") return false;
    return d.methode==="rp" || (!d.methode && !!d.prix_negocie);
  }
  function phaseService(d){ return d.rp_mission==="oui"; }

  /* Une disparition ou une opération validée descend au tableau du hangar.
     La prime est FIGÉE ici : elle a déjà quitté le demandeur au moment de
     l'achat, et le tableau la versera au capitaine à la clôture.

     [MAJ v6] SENTINELLE À DEUX NIVEAUX. Le nœud flottille range ses entrées en
     flottille/{sous}/{id} : la convention {node}_rev/{id} y produirait une
     branche de service à l'intérieur même du nœud surveillé. TDLBase.table
     accepte désormais un chemin de révision EXPLICITE — les révisions du hangar
     vivent en flottille_rev/{sous}/{id}, dans un arbre parallèle. L'entrée
     apparaît donc au tableau du hangar sans rechargement, au lieu d'attendre
     la réconciliation de cinq minutes. */
  function creerEntreeFlottille(d){
    var dispa = d.itemId==="flot_disparition";
    var sous  = dispa ? "disparitions" : "operations";
    var o = {
      origine:"boutique", demandeId:d.id||"", demandeur:d.pseudo||"",
      prime:(d.montant|0), primeInitiale:(d.montant|0),
      statut:"en_attente", capitaine:null, participants:[],
      contexte:d.contexte||"", sujet:"", resume:"", consequences:"",
      demandeValidation:false, rembourse:false, primeVersee:false,
      cree:new Date().toISOString(), ouverte:new Date().toISOString(), clos:null
    };
    if (dispa) {
      o.titre = "Disparition de " + (d.pseudo||"?");
      o.duree = parseInt(d.duree,10)||1;
      o.destination = d.destination||"";
      o.motif = d.motif||"perso";
      o.dette_key = d.dette_key||""; o.dette_libelle = d.dette_libelle||"";
      o.enquete_id = d.enquete_id||""; o.enquete_titre = d.enquete_titre||"";
      o.restent = d.restent||""; o.restent_pnj = d.restent_pnj||"";
      o.pression = null; o.denouement = null; o.lavee_par = "";
    } else {
      o.titre = d.titre||"Opération";
      o.verrou = d.verrou||""; o.parties = d.parties||"";
      o.objectif = d.objectif||"";
      o.contraintes = String(d.contraintes||"").split("\n").map(function(x){return x.trim();}).filter(Boolean);
      o.mandataire = d.mand || (d.mandtype==="anonyme" ? "Anonyme" : (d.pseudo||"?"));
      o.mandataireType = d.mandtype||"joueur";
      o.chef = null; o.nego = null;
    }
    var tab = B().table({ node: CFG.NODE_FLOT+"/"+sous, revPath: RACINE_FLOT_REV+"/"+sous });
    var id  = B().nouvelleCle();
    return Promise.resolve(tab.ecrireEntree(id, o, "entrée du hangar ("+sous+")"))
      .then(function(ok){ if(!ok) throw new Error("écriture refusée : "+sous+"/"+id); return id; });
  }

  /* [MAJ v5] clé locale + sentinelle, et naissance directe en schema 2 :
     le dossier n'aura jamais à passer par la conversion de rep-det-main.
     participants et valides sont OMIS : en schema 2 ce sont des nœuds à clés,
     et une branche vide ne s'écrit pas. */
  function creerDossierMain(d, nego, service){
    var it = CATALOGUE[d.itemId] || {};
    var cible = (d.cible_type==="pj") ? (d.cible_pj||"") : (d.cible||"");
    /* la prime est FIGÉE ici : l'argent vient d'être encaissé par la cagnotte,
       relire la demande plus tard exposerait à une modification entre-temps. */
    var prime = (d.compensation==="prix") ? (parseInt(d.prix_offert,10)||0) : 0;
    var id = B().nouvelleCle();
    return ecrireEntree(CFG.NODE_DOSSIERS, id, {
      schema: SCHEMA_DOSSIER,
      type: service ? "service" : "negociation",
      origine:"boutique", demandeId:d.id||"", demandeur:d.pseudo||"",
      titre:d.nom||"Service de la Main", service:d.itemId||"",
      doigt:null, ouvertTous:true,
      cible_type:d.cible_type||"aucune", cible:cible, protege:"",
      contexte:d.contexte||d.situation||"", objectif:d.attentes||"",
      contraintes:[], montant:0, dette:null, accord:null, defaut:null,
      prixIndicatif:(typeof it.pi==="number"?it.pi:0),
      prixPropose:parseInt(d.prix_negocie,10)||0,
      issue:null, prixFinal:null,
      prime:prime, primeVersee:false,
      phase: nego ? "nego" : "service",
      phaseService: !!service, phase1:null,
      statut:"ouvert", responsable:null,
      sujet:"", resume:"", consequences:"", conclusion:null,
      demandeValidation:false, verse:false,
            cree:new Date().toISOString(), ouverte:new Date().toISOString(), clos:null
    }, "dossier de la Main ouvert").then(function(r){
      try{ if(window.EcoNotif){
        if(nego) EcoNotif.bande("main",160,{titre:d.nom||"Service de la Main",prix:parseInt(d.prix_negocie,10)||0},"dm"+(d.id||""));
        else     EcoNotif.bande("main",162,{titre:d.nom||"Service de la Main"},"ds"+(d.id||""));
      } }catch(e){}
      return r;
    });
  }

  
  async function action(id, act){
    var d = demandes.filter(function(x){ return x.id===id; })[0]; if (!d) return;
    if (act==="annuler" && !confirm("Rembourser "+money(d.montant||0)+" à "+(d.pseudo||"?")+" et annuler la demande ?")) return;
    if (act==="supprimer" && !confirm("Supprimer définitivement cette demande ?")) return;
    var base = CFG.NODE_DEMANDES+"/"+id, o = {};
    var argentBouge = false;
    try {
      if (act==="annuler"){
        if (d.pseudo && d.montant) { await E().firebaseTransaction(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dollars", function(cur){ return (cur||0)+(d.montant|0); }); argentBouge = true; }
        o[base+"/statut"]="annulee"; await E().firebaseUpdate(o);
      } else if (act==="supprimer"){ o[base]=null; await E().firebaseUpdate(o); }
      else if (act==="valider" || act==="traiter"){
        if (act==="valider"){
          if (d.type==="pret" && d.montant){
            var cible = d.cagnotte || "Providence";
            try {
              await E().firebaseTransaction(CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(cible), function(cur){ var c=cur||0; if (c < d.montant) throw new Error("CAG"); return c - d.montant; });
              await E().firebaseTransaction(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dollars", function(cur){ return (cur||0)+(d.montant|0); });
              argentBouge = true;
            } catch(e){ if (e&&e.message==="CAG"){ alert("La cagnotte « "+cible+" » est insuffisante pour ce prêt ("+money(d.montant)+")."); return; } if (window.console) console.error(e); alert("Transfert impossible."); return; }
            if (d.pret_contrepartie==="remboursement") { try { await E().firebasePush(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/prets", { montant:d.montant|0, cagnotte:cible, nom:d.nom||"Prêt", date:new Date().toISOString() }); } catch(e){ if (window.console) console.error("[quais-staff] prêt", e); } }
          } else if (d.type==="comptant" && d.cagnotte && d.montant){
            try { await E().firebaseTransaction(CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(d.cagnotte), function(cur){ return (cur||0)+(d.montant|0); }); argentBouge = true; }
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
              argentBouge = true;
            } catch(e){ if (e&&e.message==="FONDS"){ alert(d.pseudo+" n'a pas les fonds pour payer "+money(px)+"."); return; } if (window.console) console.error(e); alert("Débit impossible."); return; }
          }
        }
        var di = detteAInscrire(d);
        if (di) { try { await E().firebasePush(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dettes", { creancier:di.creancier, type:di.type, motif:di.motif, statut:"active", date:new Date().toISOString() }); } catch(e){ if (window.console) console.error("[quais-staff] dette", e); } }
        var ri = reseauAInscrire(d);
        if (ri) {
          var statutRes = ri.statut;
          if (!statutRes) { var selR = root.querySelector('.qsd-restatut[data-id="'+id+'"]'); statutRes = (selR && selR.value) || "du"; }
                    var lien = ri.reseau==="faiseuses"
            ? { type:"reseau_faiseuses", categorie:"faiseuses", role:ri.role, activite:ri.activite, statut:statutRes }
            : { type:"reseau_main", categorie:ri.categorie, role:ri.role, statut:statutRes };
          try { await ajouterLien(d.pseudo, lien); } catch(e){ if (window.console) console.error("[quais-staff] réseau", e); }
        }
        if (d.type==="faveur" && !d.tacheCreee) {
          try { await creerTache(d); o[base+"/tacheCreee"] = true; }
          catch(e){ if (window.console) console.error("[quais-staff] tâche faiseuses", e); alert("Demande validée, mais la tâche n\u2019a pas pu être créée."); }
        }
        if (act==="valider" && !d.entreeFlottille && (d.itemId==="flot_disparition" || d.itemId==="flot_operation")) {
          try { await creerEntreeFlottille(d); o[base+"/entreeFlottille"] = true; }
          catch(e){ if (window.console) console.error("[quais-staff] entrée flottille", e); alert("Demande validée, mais l\u2019entrée du tableau du hangar n\u2019a pas pu être créée."); }
        }
        if (!d.dossierCree) {
          var pn = phaseNego(d), ps = phaseService(d);
          if (pn || ps) {
            try { await creerDossierMain(d, pn, ps); o[base+"/dossierCree"] = true; }
            catch(e){ if (window.console) console.error("[quais-staff] dossier main", e); alert("Demande validée, mais le dossier de la Main n\u2019a pas pu être créé."); }
          }
        }
        o[base+"/statut"] = act==="valider" ? "validee" : "traitee"; await E().firebaseUpdate(o);
      }
      else { o[base+"/statut"] = act==="refuser"?"refusee":"en_attente"; await E().firebaseUpdate(o); }
    } catch(e){ if (window.console) console.error("[quais-staff]", e); alert("Action impossible."); return; }
        /* [NOTIF] après le catch : l'écriture Firebase a réussi, aucun cas d'échec ici */
        try {
      if (window.EcoNotif) {
        if (act==="valider" || act==="traiter") {
          if (d.type==="pret" && d.montant) {
            EcoNotif.a(d.pseudo, 104, { montant:d.montant }, "pret"+d.id);
            if (d.pret_contrepartie==="remboursement")
              EcoNotif.a(d.pseudo, 105, { montant:d.montant }, "remb"+d.id);
          } else {
            EcoNotif.a(d.pseudo, 100, { nom:d.nom }, "achat"+d.id);
          }
          var dn = detteAInscrire(d);
          if (dn) EcoNotif.a(d.pseudo, 102, { motif:dn.motif || d.nom }, "dette"+d.id);
        } else if (act==="annuler") {
          EcoNotif.a(d.pseudo, 101, { nom:d.nom, montant:d.montant||0 }, "annul"+d.id);
        } else if (act==="refuser") {
          EcoNotif.a(d.pseudo, 101, { nom:d.nom, montant:0 }, "refus"+d.id);
        }
      }
    } catch(e){}
    await charger(argentBouge); render();
  }

  async function regler(source, pseudo, key, cle, montant, cag){
    if (source==="pret") {
      montant = parseInt(montant,10)||0;
      if (!confirm("Procéder au remboursement de "+money(montant)+" par "+pseudo+" ? (débité de son solde, recrédité à la cagnotte « "+cag+" »)")) return;
      try {
        await E().firebaseTransaction(CFG.NODE_MEMBRES+"/"+encodeURIComponent(pseudo)+"/dollars", function(cur){ var c=cur||0; if (c < montant) throw new Error("FONDS"); return c - montant; });
        await E().firebaseTransaction(CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(cag||"Providence"), function(cur){ return (cur||0)+montant; });
        var op = {}; op[CFG.NODE_MEMBRES+"/"+pseudo+"/prets/"+key] = null; await E().firebaseUpdate(op);
      } catch(e){ if (e&&e.message==="FONDS"){ alert(pseudo+" n'a pas les fonds pour rembourser ("+money(montant)+")."); return; } if (window.console) console.error("[quais-staff] remboursement", e); alert("Remboursement impossible."); return; }
      dettesList = dettesList.filter(function(x){ return !(x.source==="pret" && x.pseudo===pseudo && x.key===key); });
      render(); charger(true).then(render); return;
    }
    if (!confirm("Régler et retirer cette entrée de "+pseudo+" ? (à faire quand elle a été honorée en RP)")) return;
    try {
      if (source==="lien") {
        /* [MAJ v7] le retrait vise une CLÉ : il ne peut plus décaler les liens
           suivants ni emporter un contact de l'autre réseau. */
        var ok = await B().supprimerLien(pseudo, cle);
        if (!ok) throw new Error("retrait du lien refusé");
      } else {
        var o = {}; o[CFG.NODE_MEMBRES+"/"+pseudo+"/dettes/"+key] = null;   /* chemin brut : PATCH racine */
        await E().firebaseUpdate(o);
      }
    } catch(e){ if (window.console) console.error("[quais-staff] régler", e); alert("Impossible de régler l'entrée."); return; }
    dettesList = dettesList.filter(function(x){ return !(x.pseudo===pseudo && ((source==="dette"&&x.key===key) || (source==="lien"&&x.cle===cle))); });
    render();
    charger(true).then(render);
  }

  /* [MAJ v5] trois lectures ciblées (~26 ko) au lieu des 126 ko de la racine,
     à chaque action staff. Le catalogue ne bouge qu'à l'édition d'un item de
     boutique : une seule lecture par session suffit.
     fraisMembres force la relecture des soldes après un mouvement d'argent. */
  async function charger(fraisMembres){
    try {
      var taches = [ E().firebaseGet(CFG.NODE_DEMANDES),
                     fraisMembres ? B().rafraichirMembres() : B().membres(),
                     catalogueLu ? Promise.resolve(CATALOGUE) : E().firebaseGet(CFG.NODE_CATALOGUE) ];
      var r = await Promise.all(taches);
      var node = r[0] || {};
      demandes = Object.keys(node).map(function(id){ var d = node[id]||{}; d.id = id; return d; })
        .sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });
      var membres = r[1] || {};
      CATALOGUE = r[2] || {}; catalogueLu = true;
      dettesList = [];
      Object.keys(membres).forEach(function(p){
        var m = membres[p] || {};
        var dts = m.dettes;
        if (dts && typeof dts==="object") Object.keys(dts).forEach(function(key){ var e = dts[key]; if (e && typeof e==="object") dettesList.push({ pseudo:p, source:"dette", key:key, type:e.type, motif:e.motif, creancier:e.creancier, date:e.date }); });
        /* [MAJ v7] lecture bi-schéma par le socle : chaque lien porte sa clé */
        B().liens(m).forEach(function(l){ if (l.type==="reseau_main" && l.statut) dettesList.push({ pseudo:p, source:"lien", cle:l.k, type:l.statut, categorie:l.categorie, motif:l.role, date:l.date }); });
        var prets = m.prets;
        if (prets && typeof prets==="object") Object.keys(prets).forEach(function(key){ var e = prets[key]; if (e && typeof e==="object") dettesList.push({ pseudo:p, source:"pret", key:key, montant:e.montant, cagnotte:e.cagnotte, motif:e.nom, date:e.date }); });
      });
      dettesList.sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });
    } catch(e){ if (window.console) console.error("[quais-staff] chargement", e); demandes = []; dettesList = []; }
  }

  function boot(){
    var n = 0;
    (function wait(){
      var m = document.querySelector(CFG.MOUNT);
      var pret = window.EcoCore && typeof EcoCore.firebaseGet==="function"
              && window.TDLBase && typeof window.TDLBase.ecrireEntree==="function";
      if (m && pret){ demarrer(m); return; }
      if (n++ > CFG.RETRY_MAX) {
        if (m && window.console) console.warn("[quais-staff] EcoCore ou tdl-base introuvable — vérifiez l'ordre de chargement.");
        return;
      }
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
