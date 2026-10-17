/* THE DROWNED LANDS — TABLEAU DES SECRETS · L'OFFRANDE EN ATTENTE
   Rien n'est acquis tant que la fiche n'est pas dénouée.

   POURQUOI. Une fiche des Sorcières naît d'un achat, mais le service n'est pas
   rendu pour autant : une séance peut n'intéresser personne, une proposition
   être refusée. L'offrande reste donc EN SUSPENS jusqu'au dénouement, comme la
   prime d'une mission des Maringouins.
     - argent  : le joueur est débité à l'achat (c'est le gel), mais la cagnotte
                 des Spectres n'est créditée qu'à la clôture. quais-staff ne
                 crédite plus pour ces trois articles.
     - secret  : il entre au registre en état « attente », invisible des
                 Sorcières, visible du staff seul. Il passe au pot ou chez la
                 Sorcière au dénouement.
     - créance : la fiche s'ouvre, mais elle est supprimée si rien n'aboutit.

   DEUX SENS, UN SEUL VERROU. aboutir() et annuler() posent le même drapeau
   « solde » : une fiche ne peut pas être à la fois soldée et rendue, et deux
   clics ne versent pas deux fois.

   LE LIEN EST demandeId. Le secret offert et la créance de service portent le
   même demandeId que la fiche qu'ils ont payée : c'est par lui qu'on les
   retrouve, sans rien ajouter au schéma.

   EXPOSE : window.TDLBayou.argent.
   À CHARGER après rep-lb-core, AVANT les modules de fiche. */
(function(){
"use strict";
var REG = (window.TDLBayou = window.TDLBayou || { types: [], registre: null });

/* ===================== CONFIG ===================== */
var CFG = {
  CAGNOTTE: "Les Spectres",        /* [MAJ] libellé exact du nœud cagnottes */
  NODE_CAGNOTTES: "cagnottes",
  NODE_MEMBRES: "membres",
  NODE_SECRETS: "secrets"
};
var T = {
  OK_VERSE:function(n){ return n+" $ versés à la cagnotte des Spectres."; },
  OK_RENDU:function(n){ return n+" $ rendus au demandeur."; },
  ERR:"Le mouvement d\u2019argent n\u2019a pas abouti \u2014 vérifiez la cagnotte.",
  DEJA:"L\u2019offrande a déjà été dénouée ailleurs."
};

/* ===================== UTILS ===================== */
function E(){ return window.EcoCore; }
function montant(m){ return (m.offrandeMode==="argent")?(m.offrandeMontant|0):0; }

/* Le secret offert en paiement : même demandeId, et toujours en attente tant
   que la fiche n'est pas dénouée. */
function secretOffert(api, m){
  if(m.offrandeMode!=="secret"||!m.demandeId)return null;
  var l=api.secrets();
  for(var i=0;i<l.length;i++){
    if(l[i].demandeId===m.demandeId&&l[i].etat==="attente")return l[i];
  }
  return null;
}
/* La créance de service ouverte en paiement : même demandeId, origine propose. */
function creanceOfferte(api, m){
  if(m.offrandeMode!=="creance"||!m.demandeId)return null;
  var l=api.fiches();
  for(var i=0;i<l.length;i++){
    var f=l[i];
    /* f.id!==m.id : « Le prix des Lwas » ouvre LUI-MÊME une créance et porte le
       même demandeId. Sans cette garde, annuler une créance la supprimerait
       elle-même, et le verrou « solde » serait posé sur une fiche effacée. */
    if(f.id!==m.id&&f.type==="creance"&&f.origine==="propose"&&f.demandeId===m.demandeId
       &&f.statut!=="close"&&f.statut!=="classee")return f;
  }
  return null;
}

function crediterCagnotte(n){
  return Promise.resolve(E().firebaseTransaction(
    CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(CFG.CAGNOTTE),
    function(cur){ return (cur||0)+n; }));
}
function crediterMembre(p, n){
  return Promise.resolve(E().firebaseTransaction(
    CFG.NODE_MEMBRES+"/"+encodeURIComponent(p)+"/dollars",
    function(cur){ return (cur||0)+n; }));
}

/* ===================== DÉNOUEMENT ===================== */
/* La fiche a produit du jeu : l'offrande est acquise aux Sorcières. */
function aboutir(api, m){
  var n=montant(m), s=secretOffert(api, m);
  return api.verrou(api.NODE, m.id, "solde").then(function(){
    if(n)return crediterCagnotte(n);
    return null;
  }).then(function(){
    /* le secret sort de l'attente : au pot, puisque personne ne l'a recueilli */
    if(s){ s.etat="pot"; api.patchSecret(s,{etat:"pot"});
           try{ if(window.EcoNotif)EcoNotif.bande("sorcieres",212,{},"pot"+s.id); }catch(e){} }
    api.patch(m,{solde:true});
    if(n)api.toast(T.OK_VERSE(n));
    return true;
  }).catch(function(e){
    if(api.estDeja(e))return true;                 /* un autre onglet l'a soldée */
    api.toast(T.ERR);
    return false;
  });
}

/* Rien n'a abouti : on rend ce qui a été donné, et on efface ce qui n'avait pas
   encore servi. Le secret en attente n'a jamais été lu d'une Sorcière : le
   supprimer ne retire rien à personne. */
function annuler(api, m){
  var n=montant(m), s=secretOffert(api, m), c=creanceOfferte(api, m);
  return api.verrou(api.NODE, m.id, "solde").then(function(){
    if(n&&m.demandeur)return crediterMembre(m.demandeur, n);
    return null;
  }).then(function(){
    /* écriture directe : le socle n'expose pas de suppression de secret, et ce
       cas est le seul qui en ait besoin */
    if(s){
      window.TDLBase.supprimerEntree(CFG.NODE_SECRETS, s.id, "offrande annulée");
      var l=api.secrets();
      for(var i=l.length-1;i>=0;i--)if(l[i].id===s.id)l.splice(i,1);
    }
    if(c)api.supprimer(c);
    api.patch(m,{solde:true, annulee:true});
    if(n)api.toast(T.OK_RENDU(n));
    return true;
  }).catch(function(e){
    if(api.estDeja(e))return true;
    api.toast(T.ERR);
    return false;
  });
}

/* ===================== EXPORT ===================== */
REG.argent = {
  CAGNOTTE:CFG.CAGNOTTE,
  montant:montant, secretOffert:secretOffert, creanceOfferte:creanceOfferte,
  aboutir:aboutir, annuler:annuler
};
})();
