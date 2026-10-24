/*
 * quais-staff.js — Tableau de bord staff « Les Quais du Bayou » · TDL · v7
 *
 * S'affiche DANS un message (topic zone staff) sur #quais-staff, réservé au
 * staff. Réutilise les classes des panels (mc-, sj-, dc-, fi-) et les siennes (qsd-).
 *
 * ONGLETS : En attente / Traitées / Toutes (demandes en accordéon) +
 *   Gestion des dettes : TOUTES les dettes, en un seul récapitulatif, groupées
 *   par membre — grand livre (lourdes, légères, karmiques…), dettes de réseau
 *   de la Main, services dus aux piliers de la Flottille, prêts.
 *
 * [MAJ v7-2] RÉSEAU DE CRÉANCES DES SORCIÈRES. Une offrande payée par un service
 *   dû n'ouvre plus de fiche au tableau des secrets : elle inscrit un lien
 *   { type:"creance_sorcieres", nature, detail, statut:"du" } au bottin des
 *   hors-la-loi. La fiche naîtra au tableau quand une Sorcière réclamera son
 *   dû. La validation est refusée si le membre doit déjà le maximum de services.
 *   « Régler » une créance la retire du réseau : honorée, elle n'existe plus.
 * [MAJ v7-2] FAISEUSES : le bottin affiche la ressource ou l'accès proposé
 *   (role), plus ce que ça leur apporte ; ce dernier est gardé à part (apport).
 *
 * [MAJ v7-1] Champs du Comptoir rétablis à l'affichage (lien du RP, PNJ visé,
 *   forme de la contrepartie), perdus à la réécriture de la liste.
 *
 * [MAJ v7] DEUX ACTIONS, UN VOCABULAIRE. Une demande en attente se valide ou se
 *   refuse ; elle finit « Validée » ou « Refusée ». « Marquer traitée »,
 *   « Annuler & rembourser » et « Rouvrir » disparaissent : rouvrir une demande
 *   validée pouvait réinscrire ses liens et recréditer sa cagnotte.
 *   Les anciens statuts « traitee » et « annulee » s'affichent comme
 *   « Validée » et « Refusée ».
 *
 * [MAJ v7] LA DETTE LOURDE EXISTE DÉJÀ. quais-core l'écrit à la demande, en
 *   statut en_attente, et pose sa clé sur la demande (dette_cle). Valider
 *   l'active, refuser l'efface. Plus aucune dette lourde n'est créée ici.
 *
 * [MAJ v7] LA COMPENSATION NE VAUT QUE POUR UNE NÉGOCIATION. Une entrée au
 *   réseau d'influence n'est inscrite que si la demande porte voie = "nego"
 *   ou "confesse". Un paiement au prix indicatif n'en inscrit plus.
 *
 * [MAJ v7] ACQUITTER UN LIEN NE LE SUPPRIME PLUS. « Régler » sur une dette de
 *   réseau ou un service dû retire son statut ; le contact reste au bottin,
 *   comme à la clôture d'un dossier de la Main (rep-det-main, acquitter).
 *
 * [MAJ v7] L'ENTRÉE DU HANGAR NAÎT EN SCHÉMA 2, sans liste participants : le
 *   tableau de la Flottille la tenait pour une entrée à convertir.
 *
 * ARGENT — rappel des règles appliquées à la validation :
 *   prêt          : cagnotte → membre, une seule fois (pretVerse) ;
 *   somme retenue : versée à la cagnotte de la demande s'il y en a une, une
 *                   seule fois (verseeCagnotte) ; sans cagnotte, elle quitte
 *                   la circulation ; Requête et Empreinte des Sorcières gardent
 *                   la somme jusqu'au dénouement de leur fiche.
 *   Confesse      : versée entière à Providence ; si un dossier s'ouvre, sa
 *                   clôture reverse la prime aux participants moins la
 *                   commission de la Main (rep-det-main).
 *   Au refus, toute somme retenue et non versée est rendue (rembourse).
 *
 * DÉPEND DE : window.EcoCore (firebaseGet, firebaseUpdate, firebaseTransaction,
 *   firebasePush, writeField) et window.TDLBase (nouvelleCle, ecrireEntree,
 *   table, membres, rafraichirMembres, liens, ecrireLien, ecrireChampLien,
 *   supprimerLien). Ordre de chargement : eco-core → tdl-base → ce fichier.
 */
(function () {
  "use strict";
  var CFG = { MOUNT:"#quais-staff", NODE_DEMANDES:"boutique_demandes", NODE_MEMBRES:"membres", NODE_CAGNOTTES:"cagnottes",
              NODE_TACHES:"taches_faiseuses", NODE_DOSSIERS:"dossiers_main", NODE_FLOT:"flottille", NODE_LOSTBAYOU:"lost_bayou",
              NODE_SECRETS:"secrets", NODE_CATALOGUE:"boutique/barge", MONNAIE:"$", RETRY_MS:300, RETRY_MAX:100 };
  var SCHEMA_DOSSIER = 2;      /* doit suivre rep-det-main */
  var SCHEMA_TACHE   = 2;      /* doit suivre rep-tac-fais */
  var SCHEMA_LB      = 2;      /* lost_bayou et secrets */
  var SCHEMA_FLOT    = 2;      /* doit suivre rep-flot-core */
  var RACINE_FLOT_REV= "flottille_rev";
  var MAX_CREANCES   = 2;      /* MIROIR de barge-sorcieres CFG.MAX_CREANCES */

  function E(){ return window.EcoCore; }
  function B(){ return window.TDLBase; }
  function isStaff(){ try { return typeof _userdata!=="undefined" && (_userdata.user_level===1||_userdata.user_level===2); } catch(e){ return false; } }
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function money(n){ return (typeof n==="number"?n.toLocaleString("fr-FR").replace(/\u202f/g," "):n)+" "+CFG.MONNAIE; }
  function dateFr(iso){ if(!iso) return "—"; var d=new Date(iso); return isNaN(d.getTime())?String(iso):d.toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}); }
  function plein(v){ return String(v==null?"":v).trim().length > 0; }

  /* TDLBase.ecrireEntree rend false au lieu de lever : on lève, pour que
     les appelants affichent leur alerte. */
  function ecrireEntree(node, id, data, libelle){
    return Promise.resolve(B().ecrireEntree(node, id, data, libelle)).then(function(ok){
      if (!ok) throw new Error("écriture refusée : "+node+"/"+id);
      return id;
    });
  }

  /* ===================== LIBELLÉS ===================== */
  var TYPES = { comptant:"Paiement comptant", dette:"Dette", pret:"Prêt", nego:"Négociation — Main", don:"Coup de main — Maringouins",
                offrande:"Offrande — Sorcières", braconneurs:"Braconneurs", demande:"Demande",
                faveur:"Faveur — Faiseuses", don_reseau:"Don au réseau — Faiseuses" };
  var STATUTS = { en_attente:"En attente", en_cours:"Traitement interrompu", validee:"Validée", refusee:"Refusée", traitee:"Validée", annulee:"Refusée" };
  var STATUT_CLASSE = { traitee:"validee", annulee:"refusee", en_cours:"en_attente" };
  var DETTE_LIB = { lourde:"Dette lourde", legere:"Dette légère", karmique:"Dette karmique", longue:"Dette longue",
                    du:"Service dû", prioritaire:"Dette prioritaire", service:"Service dû" };
  var RESEAU_LIB = { entreprises:"Entreprises & Commerçants", autorites:"Autorités corrompues", prestataires:"Prestataires & Services", informateurs:"Informateurs locaux" };
  var STATUT_RES = { du:"Service dû", prioritaire:"Dette prioritaire", longue:"Dette longue" };
  var DISPO_LIB = { disponible:"Disponible", ponctuel:"Ponctuel", indisponible:"Indisponible" };
  var CIBLE_LIB = { pj:"Un personnage joueur", pnj:"Un PNJ", famille:"Une famille", groupe:"Un groupe", entreprise:"Une entreprise" };
  var OFFRANDE_MODE = { argent:"Argent", secret:"Un secret", creance:"Un service dû" };
  var CREANCE_NATURE = { materiel:"Matériel ou fourniture", transport:"Transport ou passage", abri:"Abri",
                         acces:"Accès à un lieu ou à un métier", silence:"Silence ou témoignage",
                         mainoeuvre:"Main-d\u2019œuvre", info:"Information à ramener" };
  /* ordre d'affichage des champs d'une demande */
  var FIELDS = [
    ["contexte","Contexte"],["requete","Requête"],["demande","Demande"],["attentes","Attentes"],["aide","Coup de main attendu"],
    ["paiement","Paiement"],["prix_negocie","Prix proposé (négociation)"],["methode","Méthode"],["prix_final","Prix final"],["dice","Dé"],
    ["compensation","Compensation"],["prix_offert","Prix proposé"],["dette_argument","Ce qu'il offre à la Main"],
    ["reseau_cat","Catégorie du réseau"],["situation_main","Rôle dans le réseau"],["pret_contrepartie","Remboursement du prêt"],["montant_souhaite","Somme demandée"],
    ["cible_type","Type de cible"],["cible_pj","PJ concerné"],["cible","Cible"],["cible_pnj","PNJ visé"],["rp_mission","Vocation RP"],
    ["lien","Lien du RP"],["forme","Forme de la contrepartie"],
    ["lieu_vise","Lieu ou communauté visée"],["verrou_acces","Ce qui rend l'accès impossible"],["but_passage","Ce que le personnage va y faire"],["concours","Service dû à la Flottille"],
    ["duree_libelle","Durée d'absence"],["destination","Destination"],["motif_libelle","Motif du départ"],["dette_libelle","Dette fuie"],["enquete_titre","Affaire fuie"],
    ["restent","Reste derrière (PJ)"],["restent_pnj","Autres proches"],
    ["titre","Titre"],["verrou_libelle","Pourquoi la Flottille"],["parties","Qui doit se retrouver là"],["objectif","Objectif"],["contraintes","Contraintes"],
    ["mandtype_libelle","Commanditaire affiché"],["mand","Nom du commanditaire"],["prime","Prime"],
    ["ressource","Ressource ou accès proposé"],["apport","Ce que ça apporte au réseau"],["activite","Activité du personnage"],["dispo","Disponibilité"],["don","Don en nature"],
    ["offrande_mode","Offrande"],["offrande_secret_titre","Titre du secret"],["offrande_secret","Secret confié"],
    ["offrande_creance_type","Nature du service"],["offrande_creance_detail","Ce que le personnage offre"]
  ];
  var VMAP = { methode:{ rp:"En RP", des:"Avec les dés" }, compensation:{ prix:"Prix", dette:"Dette lourde", reseau:"Réseau d'influence" },
               paiement:{ prix:"Prix indicatif", nego:"Négociation", comptant:"Comptant", service:"Service dû" },
               forme:{ article:"Un article dans le Houma Courier", mj:"Un post MJ dans un évent" },
               pret_contrepartie:{ remboursement:"En monnaie", dette:"Par une dette lourde" }, reseau_cat:RESEAU_LIB, dispo:DISPO_LIB,
               cible_type:CIBLE_LIB, rp_mission:{ oui:"Oui — à jouer en RP" }, offrande_mode:OFFRANDE_MODE, offrande_creance_type:CREANCE_NATURE };
  var ONGLETS = [["en_attente","En attente"],["traitees","Traitées"],["toutes","Toutes"],["dettes","Gestion des dettes"]];

  /* Point d'extension : un module tiers pousse son onglet et sa vue ici. */
  var EXT = (window.QuaisStaff = window.QuaisStaff || { onglets:[], vues:{} });
  function onglets(){ return ONGLETS.concat(EXT.onglets); }

  var st = { filtre:"en_attente" };
  var root, demandes = [], dettesList = [], MEMBRES = {}, CATALOGUE = {}, catalogueLu = false;

  /* ===================== RÈGLES DE TRAITEMENT ===================== */
  /* Le service acheté ouvre une fiche au tableau des secrets ; Le prix des
     Lwas n'en ouvre aucune. Pour ces deux articles, l'argent payé reste
     retenu jusqu'au dénouement de la fiche. */
  var FICHE_ARTICLE = { requete:"poste", empreinte:"seance" };
  var QUOI = { poste:"une requête attend votre décision", seance:"une séance cherche une Sorcière" };

  /* pour l'affichage : l'instantané des membres suffit */
  function detteMembre(d){
    var m = MEMBRES[d.pseudo] || {};
    return (d.dette_cle && m.dettes && m.dettes[d.dette_cle]) || null;
  }
  /* pour agir : relue à l'instant, l'instantané peut dater d'avant la demande */
  async function lireDette(d){
    if (!d.dette_cle || !d.pseudo) return null;
    try { return await E().firebaseGet(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dettes/"+encodeURIComponent(d.dette_cle)); }
    catch(e){ return null; }
  }
  /* dettes que la VALIDATION inscrit : ni la lourde (déjà écrite), ni le
     service dû (c'est un pilier, pas une dette au grand livre) */
  function detteAInscrire(d){
    if (d.dette_cle) return null;
    if (d.dette_type && d.dette_type!=="lourde" && d.dette_type!=="service")
      return { type:d.dette_type, creancier:d.creancier||d.bande||"", motif:d.motif||d.nom||"" };
    return null;
  }
  function voieNego(d){ return d.voie==="nego" || d.voie==="confesse"; }
  function reseauAInscrire(d){
    if (d.itemId==="flot_passage" && d.dette_type==="service" && plein(d.concours))
      return { reseau:"flottille", concours:String(d.concours).trim(), statut:"du", fixe:true };
    if (d.reseau_auto==="faiseuses")
      return { reseau:"faiseuses", statut:d.dispo||"disponible", role:d.ressource||d.apport||d.nom||"", apport:d.apport||"", activite:d.activite||"", fixe:false };
    if (d.reseau_auto)
      return { categorie:d.reseau_auto, statut:"longue", role:d.nom||"", fixe:true };
    if (voieNego(d) && d.compensation==="reseau" && d.reseau_cat)
      return { categorie:d.reseau_cat, statut:null, role:d.situation_main||"", fixe:false };
    return null;
  }
  /* Une négociation jouée en RP ouvre la phase 1 d'un dossier de la Main ;
     la case RP ouvre la phase 2. La Confesse n'a jamais de phase 1. */
  function phaseNego(d){
    if (d.type!=="nego" || d.voie!=="nego" || d.itemId==="confesse") return false;
    if (d.methode==="des") return false;
    return d.methode==="rp" || (!d.methode && plein(d.prix_negocie));
  }
  function phaseService(d){ return d.rp_mission==="oui"; }
  function depotSecret(d){ return d.itemId==="secret" || d.offrande_mode==="secret"; }
  function creanceService(d){ return d.offrande_mode==="creance" && plein(d.offrande_creance_type); }
  function argentDiffere(d){ return !!FICHE_ARTICLE[d.itemId]; }
  function sommeRetenue(d){ return (d.type!=="pret" && (d.montant|0) > 0) ? (d.montant|0) : 0; }

  /* ===================== RENDU ===================== */
  function chip(t){ return '<span class="qsd-chip">'+esc(TYPES[t]||t||"—")+'</span>'; }
  function stChip(s){ return '<span class="qsd-st qsd-st-'+esc(STATUT_CLASSE[s]||s||"en_attente")+'">'+esc(STATUTS[s]||s||"—")+'</span>'; }
  function detteChip(t, attente){
    var cls = { lourde:"refusee", legere:"en_attente", karmique:"validee", longue:"validee", du:"validee", prioritaire:"refusee" }[t] || "en_attente";
    return '<span class="qsd-st qsd-st-'+cls+'">'+esc(DETTE_LIB[t]||t)+(attente?" · en attente":"")+'</span>';
  }
  function ligne(l, v){ return '<span>'+esc(l)+'</span><span>'+esc(v)+'</span>'; }

  function champs(d){
    var out = "";
    var r = sommeRetenue(d);
    if (d.type==="pret" && d.montant) out += ligne("Somme demandée", money(d.montant));
    else if (r) out += ligne("Montant retenu", money(r) + (d.rembourse?" · rendu":d.verseeCagnotte?" · versé à "+(d.cagnotte||"la cagnotte"):""));
    if (d.dette_cle) {
      var dm = detteMembre(d);
      out += ligne("Dette lourde", "n°"+(d.dette_num||"?")+" · "+(dm ? (dm.statut==="active"?"active":"inscrite en attente") : "absente du grand livre"));
    }
    var di = detteAInscrire(d); if (di) out += ligne("Dette à inscrire", (DETTE_LIB[di.type]||di.type)+(di.creancier?" · "+di.creancier:""));
    if (d.itemId==="flot_disparition") out += ligne("Entrée à créer", "Tableau du hangar \u00b7 disparition");
    if (d.itemId==="flot_operation")   out += ligne("Entrée à créer", "Tableau du hangar \u00b7 opération");
    if (depotSecret(d))  out += ligne("Entrée à créer", "Tableau des secrets \u00b7 dépôt au pot commun");
    if (creanceService(d)) out += ligne("Réseau à inscrire", "Sorcières du Baron \u00b7 créance de service \u00b7 "+creancesDe(d.pseudo)+" / "+MAX_CREANCES+" en cours");
    if (FICHE_ARTICLE[d.itemId]) out += ligne("Entrée à créer", "Tableau des secrets \u00b7 "+(FICHE_ARTICLE[d.itemId]==="poste"?"requête":"séance"));
    if (d.itemId==="secret") out += ligne("À inscrire", "Jeton de refus pour "+(d.pseudo||"?"));
    var pn = phaseNego(d), ps = phaseService(d);
    if (pn || ps) out += ligne("Dossier à ouvrir", "Tableau de la Main · " + (pn&&ps ? "négociation puis service" : (pn ? "négociation en RP" : "service à rendre")));
    var ri = reseauAInscrire(d);
    if (ri && ri.reseau==="flottille") out += ligne("Réseau à inscrire", "Flottille \u00b7 pilier \u00b7 service dû");
    else if (ri && ri.reseau==="faiseuses") out += ligne("Réseau à inscrire", "Faiseuses d\u2019Anges · "+(DISPO_LIB[ri.statut]||ri.statut));
    else if (ri) out += ligne("Réseau à inscrire", (RESEAU_LIB[ri.categorie]||ri.categorie)+" · "+(ri.statut?(STATUT_RES[ri.statut]||ri.statut):"statut à préciser"));
    FIELDS.forEach(function(f){ var v=d[f[0]]; if (v!=null && String(v).trim()!=="") { if (VMAP[f[0]] && VMAP[f[0]][v]) v=VMAP[f[0]][v]; out += ligne(f[1], v); } });
    return out ? '<div class="fi-carte-grille">'+out+'</div>' : "";
  }

  /* menu de statut quand le staff doit fixer la nature du lien réseau */
  function statutBloc(d){
    if (d.statut!=="en_attente") return "";
    var ri = reseauAInscrire(d); if (!ri || ri.fixe) return "";
    if (ri.reseau==="faiseuses") {
      return '<div class="qsd-restatut-wrap"><span class="qsd-restatut-lbl">Disponibilité du contact</span><select class="qsd-restatut" data-id="'+esc(d.id)+'">'
        + Object.keys(DISPO_LIB).map(function(k){ return '<option value="'+k+'"'+(k===ri.statut?" selected":"")+'>'+esc(DISPO_LIB[k])+'</option>'; }).join("")
        + '</select></div>';
    }
    return '<div class="qsd-restatut-wrap"><span class="qsd-restatut-lbl">Nature de la dette réseau</span><select class="qsd-restatut" data-id="'+esc(d.id)+'">'
      + '<option value="du">Service dû</option><option value="longue">Dette longue</option><option value="prioritaire">Dette prioritaire</option></select></div>';
  }
  function btn(id, act, label, cls){ return '<button class="'+cls+'" data-id="'+esc(id)+'" data-act="'+act+'">'+label+'</button>'; }
  function actions(d){
    if (d.statut==="en_cours") return '<p class="mc-sub">Le traitement s\u2019est interrompu en cours de route. Vérifie l\u2019argent, les dettes et les tableaux avant de corriger la demande à la main.</p>';
    var a = d.statut==="en_attente"
      ? btn(d.id,"valider","Valider","dc-btn-valider") + btn(d.id,"refuser","Refuser","dc-btn-refuser")
      : btn(d.id,"supprimer","Supprimer","qsd-btn");
    return '<div class="dc-staff-actions">'+a+'</div>';
  }
  function accDemande(d){
    return '<div class="qsd-acc" data-acc="'+esc(d.id)+'"><button class="qsd-accbar"><span class="qsd-accnom">'+esc(d.nom||d.itemId||"—")+'</span>'
      + '<span class="qsd-accps">'+esc(d.pseudo||"?")+'</span>'
      + '<span class="qsd-accchips">'+chip(d.type)+stChip(d.statut)+'</span><span class="qsd-chev">\u203A</span></button>'
      + '<div class="qsd-accbody" style="display:none"><div class="qsd-accmeta">'+dateFr(d.date)+(d.bande?" · "+esc(d.bande):"")+'</div>'
      + champs(d) + statutBloc(d) + actions(d) + '</div></div>';
  }

  /* ---------- récapitulatif des dettes ---------- */
  function reglerBtn(x){
    if (x.source==="pret") return '<button class="qsd-regler" data-source="pret" data-pseudo="'+esc(x.pseudo)+'" data-key="'+esc(x.key)+'" data-montant="'+(x.montant|0)+'" data-cag="'+esc(x.cagnotte||"Providence")+'">Procéder au remboursement</button>';
    if (x.source==="lien" && x.typeLien==="creance_sorcieres") return '<button class="qsd-regler" data-source="creance" data-pseudo="'+esc(x.pseudo)+'" data-cle="'+esc(x.cle)+'">Régler</button>';
    if (x.source==="lien") return '<button class="qsd-regler" data-source="lien" data-pseudo="'+esc(x.pseudo)+'" data-cle="'+esc(x.cle)+'">Acquitter</button>';
    return '<button class="qsd-regler" data-source="dette" data-pseudo="'+esc(x.pseudo)+'" data-key="'+esc(x.key)+'">Régler</button>';
  }
  function detteRow(x){
    var puce, label;
    if (x.source==="pret") { puce = '<span class="qsd-st qsd-st-validee">Prêt à rembourser</span>'; label = money(x.montant)+(x.motif?" · "+x.motif:""); }
    else if (x.source==="lien" && x.typeLien==="pilier_flottille") { puce = detteChip(x.type); label = "La Flottille — "+(x.motif||"—"); }
    else if (x.source==="lien" && x.typeLien==="creance_sorcieres") { puce = detteChip(x.type); label = "Les Sorcières — "+(CREANCE_NATURE[x.nature]||x.nature||"service")+(x.motif?" : "+x.motif:"")+(x.service?" · "+x.service:""); }
    else if (x.source==="lien") { puce = detteChip(x.type); label = "Réseau de la Main · "+(RESEAU_LIB[x.categorie]||x.categorie||"—")+(x.motif?" — "+x.motif:""); }
    else { puce = detteChip(x.type, x.statut==="en_attente"); label = (x.motif || "—")+(x.creancier?" · "+x.creancier:""); }
    return '<div class="qsd-drow">'+puce+'<div class="m">'+esc(label)+'</div><span class="dt">'+dateFr(x.date)+'</span>'+reglerBtn(x)+'</div>';
  }

  function filtree(f){ return demandes.filter(function(d){ if(f==="toutes")return true; if(f==="en_attente")return d.statut==="en_attente"; return d.statut!=="en_attente"; }); }
  function compte(f){
    if (EXT.vues[f]) return EXT.vues[f].compte ? EXT.vues[f].compte() : 0;
    if (f==="dettes") return dettesList.length;
    return filtree(f).length;
  }

  function render(){
    var tous = onglets();
    var titre = (tous.filter(function(o){return o[0]===st.filtre;})[0]||["",""])[1];
    var tabs = '<div class="mc-head"><h1>Demandes — Les Quais du Bayou</h1><p>Panel staff</p></div>'
      + '<div class="qsd-tabs">'+tous.map(function(o){ return '<button class="qsd-tab'+(st.filtre===o[0]?" qsd-on":"")+'" data-f="'+o[0]+'">'+o[1]+'<span class="qsd-n">'+compte(o[0])+'</span></button>'; }).join("")+'</div>';

    if (EXT.vues[st.filtre]) {
      root.innerHTML = tabs + EXT.vues[st.filtre].html(titre);
      wire();
      if (EXT.vues[st.filtre].wire) EXT.vues[st.filtre].wire(root);
      return;
    }
    if (st.filtre==="dettes") {
      var groupes = {}; dettesList.forEach(function(x){ (groupes[x.pseudo] = groupes[x.pseudo] || []).push(x); });
      var pseudos = Object.keys(groupes).sort(function(a,b){ return a.localeCompare(b,"fr"); });
      var corps = pseudos.length ? pseudos.map(function(p){
        return '<div class="qsd-grp"><div class="qsd-grphead"><span class="nom">'+esc(p)+'</span><span class="n">'+groupes[p].length+'</span></div>'
          + groupes[p].map(detteRow).join("") + '</div>';
      }).join("") : '<p class="mc-sub">Aucune dette en cours.</p>';
      root.innerHTML = tabs + '<section class="sj-fiche"><div class="mc-sec-head"><h2>'+titre+'</h2><span class="mc-cpt">'+dettesList.length+'</span></div>'
        + '<p class="mc-sub">Toutes les dettes des membres, groupées par joueur. « Régler » retire une dette du grand livre ; « Acquitter » retire le statut d\'un lien, le contact reste au bottin.</p>'
        + corps + '</section>';
      wire(); return;
    }

    var list = filtree(st.filtre);
    var sub = { en_attente:"Demandes en attente. Clique une ligne pour la déplier.", traitees:"Demandes validées ou refusées.", toutes:"Toutes les demandes de la boutique." }[st.filtre];
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
    Array.prototype.forEach.call(root.querySelectorAll("[data-act]"), function(b){ b.onclick = function(){ action(b.getAttribute("data-id"), b.getAttribute("data-act"), b); }; });
    Array.prototype.forEach.call(root.querySelectorAll(".qsd-regler"), function(b){ b.onclick = function(){ regler(b.getAttribute("data-source"), b.getAttribute("data-pseudo"), b.getAttribute("data-key"), b.getAttribute("data-cle"), b.getAttribute("data-montant"), b.getAttribute("data-cag")); }; });
  }

  /* ===================== CRÉATIONS DANS LES TABLEAUX ===================== */
  /* Toutes : clé locale, sentinelle {node}_rev/{id} bumpée dans le même PATCH
     (TDLBase.ecrireEntree), naissance dans le schéma courant du tableau,
     aucune liste vide écrite. */

  async function ajouterLien(pseudo, lien){
    var ok = await B().ecrireLien(pseudo, B().nouvelleCle(), lien);
    if (!ok) throw new Error("écriture du lien refusée : "+pseudo);
  }

  function creerTache(d){
    var now = new Date().toISOString(), id = B().nouvelleCle();
    return ecrireEntree(CFG.NODE_TACHES, id, {
      schema: SCHEMA_TACHE,
      origine:"faveur", demandeId:d.id||"", demandeur:d.pseudo||"",
      titre:d.nom||"Faveur demandée", categorie:"faveur",
      demande:d.demande||"", contexte:d.contexte||"", don:d.don||"",
      versRp: d.rp_mission==="oui",
      statut:"en_vote", sujet:"", cree:now, ouverte:now
    }, "faveur transmise aux Faiseuses").then(function(r){
      try{ if(window.EcoNotif) EcoNotif.bande("faiseuses",130,{titre:d.nom||"Faveur demandée"},"fav"+(d.id||"")); }catch(e){}
      return r;
    });
  }

  /* La prime est FIGÉE ici : elle a quitté le demandeur à l'envoi ; le tableau
     la versera au capitaine à la clôture, ou la rendra à quatorze jours. */
  function creerEntreeFlottille(d){
    var dispa = d.itemId==="flot_disparition", sous = dispa ? "disparitions" : "operations";
    var now = new Date().toISOString();
    var o = {
      schema: SCHEMA_FLOT,
      origine:"boutique", demandeId:d.id||"", demandeur:d.pseudo||"",
      prime:(d.montant|0), primeInitiale:(d.montant|0),
      statut:"en_attente",
      contexte:d.contexte||"", sujet:"", resume:"", consequences:"",
      demandeValidation:false, rembourse:false, primeVersee:false,
      cree:now, ouverte:now
    };
    if (dispa) {
      o.titre = "Disparition de " + (d.pseudo||"?");
      o.duree = parseInt(d.duree,10)||1;
      o.destination = d.destination||"";
      o.motif = d.motif||"perso";
      o.dette_key = d.dette_key||""; o.dette_libelle = d.dette_libelle||"";
      o.enquete_id = d.enquete_id||""; o.enquete_titre = d.enquete_titre||"";
      o.restent = d.restent||""; o.restent_pnj = d.restent_pnj||"";
      o.lavee_par = "";
    } else {
      o.titre = d.titre||"Opération";
      o.verrou = d.verrou||""; o.parties = d.parties||"";
      o.objectif = d.objectif||"";
      o.contraintes = String(d.contraintes||"").split("\n").map(function(x){return x.trim();}).filter(Boolean);
      o.mandataire = d.mand || (d.mandtype==="anonyme" ? "Anonyme" : (d.pseudo||"?"));
      o.mandataireType = d.mandtype||"joueur";
    }
    var tab = B().table({ node: CFG.NODE_FLOT+"/"+sous, revPath: RACINE_FLOT_REV+"/"+sous });
    var id = B().nouvelleCle();
    return Promise.resolve(tab.ecrireEntree(id, o, "entrée du hangar ("+sous+")"))
      .then(function(ok){ if(!ok) throw new Error("écriture refusée : "+sous+"/"+id); return id; });
  }

  /* Le secret entre au POT COMMUN : aucune Sorcière ne le détient encore. */
  function creerSecret(d){
    var now = new Date().toISOString(), id = B().nouvelleCle();
    return ecrireEntree(CFG.NODE_SECRETS, id, {
      schema: SCHEMA_LB,
      origine:"boutique", demandeId:d.id||"", deposant:d.pseudo||"",
      article:d.itemId||"", intitule:(d.offrande_secret_titre||""),
      contenu:(d.offrande_secret||""),
      recueilliPar:null, etat:(d.itemId==="secret"?"pot":"attente"), usage:"dormant",
      deOuvert:false, fuite:null, rumeur:null, cree:now
    }, "secret déposé").then(function(r){
      if (d.itemId==="secret") { try{ if(window.EcoNotif)EcoNotif.bande("sorcieres",212,{},"sec"+(d.id||"")); }catch(e){} }
      return r;
    });
  }

  /* Créance PROPOSÉE par le joueur en paiement : elle entre au réseau des
     Sorcières, au bottin. Le tableau des secrets ouvrira la fiche quand une
     Sorcière réclamera son dû. */
  function creancesDe(pseudo){
    return B().liens(MEMBRES[pseudo] || {}).filter(function(l){ return l.type==="creance_sorcieres" && l.statut; }).length;
  }
  function creerLienCreance(d){
    return ajouterLien(d.pseudo, {
      type:"creance_sorcieres", statut:"du",
      nature:d.offrande_creance_type||"", detail:d.offrande_creance_detail||"",
      article:d.itemId||"", service:d.nom||"", demandeId:d.id||"", date:new Date().toISOString()
    }).then(function(){
      try{ if(window.EcoNotif)EcoNotif.a(d.pseudo,210,{},"cre"+(d.id||"")); }catch(e){}
    });
  }

  /* Le SERVICE acheté, distinct de l'offrande qui l'a payé. */
  function creerFicheSorcieres(d){
    var kind = FICHE_ARTICLE[d.itemId]; if (!kind) return Promise.resolve(null);
    var now = new Date().toISOString(), id = B().nouvelleCle();
    var o = {
      schema: SCHEMA_LB, type: kind, origine:"boutique",
      demandeId:d.id||"", demandeur:d.pseudo||"",
      titre:d.nom||"Service des Sorcières", article:d.itemId||"",
      demande:d.requete||"", contexte:d.contexte||"",
      offrandeMode:d.offrande_mode||"", offrandeMontant:(d.montant|0),
      responsable:null, sujet:"", resume:"", consequences:"",
      demandeValidation:false, cree:now, ouverte:now, clos:null
    };
    if (kind==="poste") { o.statut = "proposee"; o.repondant = null; }
    else { o.statut = "en_attente"; o.de = null; o.fait = ""; o.secretId = null; }
    return ecrireEntree(CFG.NODE_LOSTBAYOU, id, o, "fiche des Sorcières ouverte").then(function(r){
      try{ if(window.EcoNotif)EcoNotif.bande("sorcieres",211,{quoi:QUOI[kind],titre:o.titre},"lb"+(d.id||"")); }catch(e){}
      return r;
    });
  }

  /* participants et valides OMIS : nœuds à clés en schéma 2. La prime est
     FIGÉE ici : celle de la Confesse vient d'être versée à Providence, que la
     clôture du dossier débitera. */
  function creerDossierMain(d, nego, service){
    var it = CATALOGUE[d.itemId] || {};
    var cible = (d.cible_type==="pj") ? (d.cible_pj||"") : (d.cible||"");
    var prime = (d.itemId==="confesse" && d.compensation==="prix") ? (d.montant|0) : 0;
    var now = new Date().toISOString(), id = B().nouvelleCle();
    return ecrireEntree(CFG.NODE_DOSSIERS, id, {
      schema: SCHEMA_DOSSIER,
      type: service ? "service" : "negociation",
      origine:"boutique", demandeId:d.id||"", demandeur:d.pseudo||"",
      titre:d.nom||"Service de la Main", service:d.itemId||"",
      doigt:null, ouvertTous:true,
      cible_type:d.cible_type||"aucune", cible:cible, protege:"",
      contexte:d.contexte||"", objectif:d.attentes||"",
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
      cree:now, ouverte:now, clos:null
    }, "dossier de la Main ouvert").then(function(r){
      try{ if(window.EcoNotif){
        if(nego) EcoNotif.bande("main",160,{titre:d.nom||"Service de la Main",prix:parseInt(d.prix_negocie,10)||0},"dm"+(d.id||""));
        else     EcoNotif.bande("main",162,{titre:d.nom||"Service de la Main"},"ds"+(d.id||""));
      } }catch(e){}
      return r;
    });
  }

  /* ===================== ACTIONS ===================== */
  var EN_COURS = false;

  /* VERROU : une demande ne se traite qu'une fois, même si deux membres du
     staff cliquent en même temps. Le statut passe en_attente → en_cours par
     TRANSACTION avant tout mouvement ; un seul client y parvient.
     COMPROMIS ASSUMÉ (celui des tableaux) : si le traitement s'interrompt,
     la demande reste « Traitement interrompu », visible, à vérifier à la
     main — plutôt qu'une cagnotte créditée deux fois en silence. */
  async function verrouiller(d){
    try {
      await E().firebaseTransaction(CFG.NODE_DEMANDES+"/"+encodeURIComponent(d.id)+"/statut", function(cur){
        if (cur!=="en_attente") throw new Error("DEJA"); return "en_cours";
      });
      return true;
    } catch(e){
      if (e && e.message==="DEJA") alert("Cette demande vient d\u2019être traitée ailleurs.");
      else { if (window.console) console.error("[quais-staff] verrou", e); alert("Action impossible."); }
      return false;
    }
  }
  /* rend la main quand le traitement s'arrête AVANT tout mouvement */
  function deverrouiller(d){
    var o = {}; o[CFG.NODE_DEMANDES+"/"+d.id+"/statut"] = "en_attente";
    return Promise.resolve(E().firebaseUpdate(o)).catch(function(){});
  }

  async function action(id, act, bouton){
    var d = demandes.filter(function(x){ return x.id===id; })[0]; if (!d || EN_COURS) return;
    if (act==="supprimer") {
      if (d.statut==="en_attente" || !confirm("Supprimer définitivement cette demande ?")) return;
      var o = {}; o[CFG.NODE_DEMANDES+"/"+id] = null;
      try { await E().firebaseUpdate(o); } catch(e){ alert("Suppression impossible."); return; }
      await charger(); render(); return;
    }
    if (d.statut!=="en_attente") return;
    EN_COURS = true; if (bouton) bouton.disabled = true;
    try {
      if (act==="valider") await valider(d);
      else if (act==="refuser") await refuser(d);
    } catch(e){ if (window.console) console.error("[quais-staff]", e); alert("Action impossible."); }
    finally { EN_COURS = false; }
    await charger(); render();
  }

  /* Les écritures annexes (tableaux) qui échouent n'empêchent pas la
     validation : le staff est prévenu et refait l'entrée à la main. */
  async function valider(d){
    var base = CFG.NODE_DEMANDES+"/"+d.id, o = {};
    if (creanceService(d) && !d.entreeCreance && creancesDe(d.pseudo) >= MAX_CREANCES) {
      alert(d.pseudo+" doit déjà "+MAX_CREANCES+" services aux Sorcières : refuse la demande, ou attends qu\u2019il s\u2019en acquitte.");
      return false;
    }
    if (!await verrouiller(d)) return false;

    /* 1. argent */
    if (d.type==="pret" && d.montant && !d.pretVerse) {
      var cible = d.cagnotte || "Providence";
      try {
        await E().firebaseTransaction(CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(cible), function(cur){ var c=cur||0; if (c < d.montant) throw new Error("CAG"); return c - d.montant; });
        await E().firebaseTransaction(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dollars", function(cur){ return (cur||0)+(d.montant|0); });
        o[base+"/pretVerse"] = true;
      } catch(e){
        if (e && e.message==="CAG") { alert("La cagnotte « "+cible+" » ne couvre pas ce prêt ("+money(d.montant)+")."); await deverrouiller(d); }
        else alert("Transfert interrompu : vérifie la cagnotte et le solde avant de reprendre la demande.");
        return false;
      }
      if (d.pret_contrepartie==="remboursement") {
        try { await E().firebasePush(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/prets", { montant:d.montant|0, cagnotte:cible, nom:d.nom||"Prêt", date:new Date().toISOString() }); }
        catch(e){ if (window.console) console.error("[quais-staff] prêt", e); }
      }
    } else {
      var r = sommeRetenue(d);
      if (r && d.cagnotte && !d.verseeCagnotte && !d.rembourse && !argentDiffere(d)) {
        try { await E().firebaseTransaction(CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(d.cagnotte), function(cur){ return (cur||0)+r; }); o[base+"/verseeCagnotte"] = true; }
        catch(e){ if (window.console) console.error(e); alert("Crédit de la cagnotte impossible : la demande reste en attente."); await deverrouiller(d); return false; }
      }
    }

    /* 2. dettes */
    if (d.dette_cle) {
      if (await lireDette(d)) o[CFG.NODE_MEMBRES+"/"+d.pseudo+"/dettes/"+d.dette_cle+"/statut"] = "active";
      else alert("La dette lourde rattachée n\u2019existe plus au grand livre : elle n\u2019a pas été réactivée.");
    }
    var di = detteAInscrire(d);
    if (di) { try { await E().firebasePush(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dettes", { creancier:di.creancier, type:di.type, motif:di.motif, statut:"active", date:new Date().toISOString() }); } catch(e){ if (window.console) console.error("[quais-staff] dette", e); } }

    /* 3. réseau */
    var ri = reseauAInscrire(d);
    if (ri) {
      var statutRes = ri.statut;
      if (!statutRes) { var selR = root.querySelector('.qsd-restatut[data-id="'+d.id+'"]'); statutRes = (selR && selR.value) || "du"; }
      var lien;
      if (ri.reseau==="flottille")      lien = { type:"pilier_flottille", concours:ri.concours, statut:statutRes };
      else if (ri.reseau==="faiseuses") { lien = { type:"reseau_faiseuses", categorie:"faiseuses", role:ri.role, activite:ri.activite, statut:statutRes }; if (ri.apport) lien.apport = ri.apport; }
      else                              lien = { type:"reseau_main", categorie:ri.categorie, role:ri.role, statut:statutRes };
      try { await ajouterLien(d.pseudo, lien); } catch(e){ if (window.console) console.error("[quais-staff] réseau", e); alert("Validée, mais le lien au bottin n\u2019a pas pu être inscrit."); }
    }

    /* 4. entrées des tableaux — chacune protégée par son drapeau */
    async function etape(drapeau, quand, faire, echec){
      if (d[drapeau] || !quand) return;
      try { await faire(); o[base+"/"+drapeau] = true; }
      catch(e){ if (window.console) console.error("[quais-staff] "+drapeau, e); alert("Validée, mais "+echec); }
    }
    await etape("tacheCreee", d.type==="faveur", function(){ return creerTache(d); }, "la tâche des Faiseuses n\u2019a pas pu être créée.");
    await etape("entreeFlottille", d.itemId==="flot_disparition" || d.itemId==="flot_operation", function(){ return creerEntreeFlottille(d); }, "l\u2019entrée du tableau du hangar n\u2019a pas pu être créée.");
    await etape("entreeSecret", depotSecret(d), function(){ return creerSecret(d); }, "le secret n\u2019a pas pu être déposé.");
    await etape("entreeCreance", creanceService(d), function(){ return creerLienCreance(d); }, "la créance n\u2019a pas pu être inscrite au réseau des Sorcières.");
    await etape("jetonPose", d.itemId==="secret", function(){ return E().writeField(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/jeton_sorcieres", true); }, "le jeton de refus n\u2019a pas pu être posé.");
    await etape("ficheSorcieres", !!FICHE_ARTICLE[d.itemId], function(){ return creerFicheSorcieres(d); }, "la fiche du tableau des secrets n\u2019a pas pu être créée.");
    var pn = phaseNego(d), ps = phaseService(d);
    await etape("dossierCree", pn || ps, function(){ return creerDossierMain(d, pn, ps); }, "le dossier de la Main n\u2019a pas pu être créé.");

    o[base+"/statut"] = "validee";
    await E().firebaseUpdate(o);

    try {
      if (window.EcoNotif) {
        if (d.type==="pret" && d.montant) {
          EcoNotif.a(d.pseudo, 104, { montant:d.montant }, "pret"+d.id);
          if (d.pret_contrepartie==="remboursement") EcoNotif.a(d.pseudo, 105, { montant:d.montant }, "remb"+d.id);
        } else EcoNotif.a(d.pseudo, 100, { nom:d.nom }, "achat"+d.id);
        if (d.dette_cle || di) EcoNotif.a(d.pseudo, 102, { motif:(di&&di.motif) || d.nom }, "dette"+d.id);
      }
    } catch(e){}
    return true;
  }

  /* Un refus rend ce qui a été retenu et pas encore versé, et efface la dette
     lourde inscrite à la demande. Le drapeau rembourse interdit le double
     recrédit si deux onglets refusent en même temps. */
  async function refuser(d){
    var base = CFG.NODE_DEMANDES+"/"+d.id, o = {};
    var rendu = (!d.rembourse && !d.verseeCagnotte) ? sommeRetenue(d) : 0;
    var dm = await lireDette(d), effacer = !!(dm && dm.statut==="en_attente");
    var texte = "Refuser « "+(d.nom||"?")+" » de "+(d.pseudo||"?")+" ?"
      + (rendu ? "\n"+money(rendu)+" lui seront rendus." : "")
      + (effacer ? "\nSa dette lourde n°"+(d.dette_num||"?")+" sera effacée." : "");
    if (!confirm(texte)) return false;
    if (!await verrouiller(d)) return false;
    if (rendu) {
      await E().firebaseTransaction(CFG.NODE_MEMBRES+"/"+encodeURIComponent(d.pseudo)+"/dollars", function(cur){ return (cur||0)+rendu; });
      o[base+"/rembourse"] = true;
    }
    if (effacer) o[CFG.NODE_MEMBRES+"/"+d.pseudo+"/dettes/"+d.dette_cle] = null;
    o[base+"/statut"] = "refusee";
    await E().firebaseUpdate(o);
    try { if (window.EcoNotif) EcoNotif.a(d.pseudo, 101, { nom:d.nom, montant:rendu }, "refus"+d.id); } catch(e){}
    return true;
  }

  /* ===================== RÈGLEMENT DES DETTES ===================== */
  async function regler(source, pseudo, key, cle, montant, cag){
    if (source==="pret") {
      montant = parseInt(montant,10)||0;
      if (!confirm("Procéder au remboursement de "+money(montant)+" par "+pseudo+" ?\nDébité de son solde, recrédité à la cagnotte « "+cag+" ».")) return;
      try {
        await E().firebaseTransaction(CFG.NODE_MEMBRES+"/"+encodeURIComponent(pseudo)+"/dollars", function(cur){ var c=cur||0; if (c < montant) throw new Error("FONDS"); return c - montant; });
        await E().firebaseTransaction(CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(cag||"Providence"), function(cur){ return (cur||0)+montant; });
        var op = {}; op[CFG.NODE_MEMBRES+"/"+pseudo+"/prets/"+key] = null; await E().firebaseUpdate(op);
      } catch(e){ if (e&&e.message==="FONDS"){ alert(pseudo+" n'a pas les fonds pour rembourser ("+money(montant)+")."); return; } if (window.console) console.error("[quais-staff] remboursement", e); alert("Remboursement impossible."); return; }
    } else if (source==="creance") {
      /* une créance honorée n'a plus de raison d'être : elle quitte le réseau */
      if (!confirm("Régler la créance de "+pseudo+" envers les Sorcières ?\nElle quitte leur réseau au bottin.")) return;
      var okc = await B().supprimerLien(pseudo, cle);
      if (!okc) { alert("Impossible de régler la créance."); return; }
    } else if (source==="lien") {
      /* le statut part, le contact reste : on s'acquitte d'une dette, on ne
         cesse pas d'être un contact */
      if (!confirm("Acquitter cette dette de "+pseudo+" ?\nLe contact reste au bottin, sans statut de dette.")) return;
      var ok = await B().ecrireChampLien(pseudo, cle, "statut", null);
      if (!ok) { alert("Impossible d'acquitter le lien."); return; }
    } else {
      if (!confirm("Régler et retirer cette dette de "+pseudo+" ? (à faire quand elle a été honorée en RP)")) return;
      try { var o = {}; o[CFG.NODE_MEMBRES+"/"+pseudo+"/dettes/"+key] = null; await E().firebaseUpdate(o); }
      catch(e){ if (window.console) console.error("[quais-staff] régler", e); alert("Impossible de régler la dette."); return; }
    }
    await charger(); render();
  }

  /* ===================== CHARGEMENT ===================== */
  /* Trois lectures ciblées ; le catalogue, qui ne bouge qu'à l'édition d'un
     item, une seule fois par session. */
  async function charger(){
    try {
      var r = await Promise.all([
        E().firebaseGet(CFG.NODE_DEMANDES),
        B().rafraichirMembres(),   /* le récapitulatif des dettes doit être exact */
        catalogueLu ? Promise.resolve(CATALOGUE) : E().firebaseGet(CFG.NODE_CATALOGUE)
      ]);
      var node = r[0] || {};
      demandes = Object.keys(node).map(function(id){ var d = node[id]||{}; d.id = id; return d; })
        .sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });
      MEMBRES = r[1] || {};
      CATALOGUE = r[2] || {}; catalogueLu = true;
      dettesList = [];
      Object.keys(MEMBRES).forEach(function(p){
        var m = MEMBRES[p] || {};
        var dts = m.dettes;
        if (dts && typeof dts==="object") Object.keys(dts).forEach(function(key){
          var e = dts[key]; if (e && typeof e==="object")
            dettesList.push({ pseudo:p, source:"dette", key:key, type:e.type, statut:e.statut, motif:e.motif, creancier:e.creancier, date:e.date });
        });
        B().liens(m).forEach(function(l){
          if (!l.statut) return;
          if (l.type==="reseau_main")      dettesList.push({ pseudo:p, source:"lien", typeLien:l.type, cle:l.k, type:l.statut, categorie:l.categorie, motif:l.role, date:l.date });
          if (l.type==="pilier_flottille") dettesList.push({ pseudo:p, source:"lien", typeLien:l.type, cle:l.k, type:l.statut, motif:l.concours, date:l.date });
          if (l.type==="creance_sorcieres") dettesList.push({ pseudo:p, source:"lien", typeLien:l.type, cle:l.k, type:l.statut, nature:l.nature, motif:l.detail, service:l.service, date:l.date });
        });
        var prets = m.prets;
        if (prets && typeof prets==="object") Object.keys(prets).forEach(function(key){
          var e = prets[key]; if (e && typeof e==="object")
            dettesList.push({ pseudo:p, source:"pret", key:key, montant:e.montant, cagnotte:e.cagnotte, motif:e.nom, date:e.date });
        });
      });
      dettesList.sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });
    } catch(e){ if (window.console) console.error("[quais-staff] chargement", e); demandes = []; dettesList = []; }
  }

  /* Helpers partagés avec les modules d'extension. */
  EXT.api = { esc:esc, money:money, dateFr:dateFr, isStaff:isStaff,
              root:function(){ return root; }, render:render };

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
