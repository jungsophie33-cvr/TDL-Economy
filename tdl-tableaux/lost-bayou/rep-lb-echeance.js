/* THE DROWNED LANDS — TABLEAU DES SECRETS · LES ÉCHÉANCES
   Trois choses dorment dans ce tableau et doivent se réveiller seules : une
   fuite en sommeil, une séance que personne ne prend, une proposition que
   personne ne tranche. Elles sont rassemblées ici plutôt que dispersées dans
   les modules — une seule veille, un seul rythme.

   PAS DE CRON SUR FORUMACTIF : les échéances sont déclenchées par les sessions
   ouvertes, sous verrou, comme la réconciliation périodique du socle rattrape
   les entrées écrites sans sentinelle. Un seul client passe par échéance.

   CE QUI SE PÉRIME, ET CE QUI NE SE PÉRIME PAS. Une proposition ou une
   délibération ne meurt d'elle-même que si PERSONNE ne s'est prononcé. Dès
   qu'une voix existe, la machine suit l'avis exprimé s'il est unanime, et
   attend le staff s'il est partagé : fermer sur un désaccord reviendrait à
   trancher à la place de la bande.

   L'ARGENT. Une séance ou une proposition qui se périme RELÂCHE son offrande
   (voir rep-lb-argent) : la somme retourne au demandeur, le secret offert est
   effacé, la créance de service est fermée. Une délibération n'a rien à rendre.

   À CHARGER en DERNIER, après rep-lb-secrets. */
(function(){
"use strict";
var REG = (window.TDLBayou = window.TDLBayou || { types: [], registre: null });

/* ===================== CONFIG ===================== */
var CFG = {
  DELAI_SEANCE:7,       /* jours sans volontaire avant péremption    */
  DELAI_VOIX:7,         /* jours sans décision sur un vote           */
  QUORUM:3, APPOINT_MAX:1,
  NODE_MAIN:"dossiers_main",
  SCHEMA_MAIN:2,        /* doit suivre rep-det-main                  */
  FUITE_MS:60000,       /* cadence de la veille                      */
  DEMARRAGE_MS:8000     /* on laisse le tableau se monter d'abord    */
};

/* ===================== UTILS ===================== */
function echu(iso, delai){
  var t=new Date(iso).getTime();
  if(isNaN(t))return false;
  return (Date.now()-t)/86400000 >= delai;
}
/* Décompte à appoint plafonné, identique à celui des modules : les voix de
   Sorcières comptent toutes, celles des Spectres et du staff pour UNE au plus. */
function compter(m, api, choix){
  var V=m.votes||{}, sorc=0, appoint=0;
  Object.keys(V).forEach(function(p){
    var v=V[p]; if(!v||v.choix!==choix)return;
    if(api.estSorciere(v.pseudo||p))sorc++; else appoint++;
  });
  return sorc+Math.min(appoint, CFG.APPOINT_MAX);
}
/* Ce que l'échéance doit faire d'un vote resté ouvert :
     rien du tout      → personne ne s'est prononcé, la fiche se périme ;
     que des « pour »  → la machine se lance ;
     que des « contre »→ le refus est acté ;
     avis partagés     → on ne tranche pas, le staff le fera. */
function verdict(m, api){
  var oui=compter(m, api, "oui"), non=compter(m, api, "non");
  if(!oui&&!non)return "perime";
  if(oui&&!non)return "acceptee";
  if(non&&!oui)return "refusee";
  return null;
}

/* ===================== LA FUITE ===================== */
/* Le dossier de la Main : aucun demandeur, aucune cible jouable — la règle de
   visibilité de rep-det-main laisserait sinon le PJ visé lire son propre
   dossier, donc le secret. Le nom va dans evoquees. */
function ouvrirMurmure(api, m, secret){
  var now=new Date().toISOString(), id=api.nouvelId();
  var o={
    schema:CFG.SCHEMA_MAIN, type:"murmure", origine:"sorcieres",
    titre:"Un murmure remonté du bayou", service:"", doigt:null, ouvertTous:true,
    demandeur:null, cible_type:"aucune", cible:"", protege:"",
    contexte:(secret&&secret.contenu)||"", objectif:"", evoquees:(m.cible||""),
    contraintes:[], montant:0, dette:null, accord:null, defaut:null,
    certitude:null, urgence:"",
    prixIndicatif:0, prixPropose:0, issue:null, prixFinal:null,
    prime:0, primeVersee:false, phase:null, phaseService:false, phase1:null,
    statut:"ouvert", responsable:null,
    sujet:"", resume:"", consequences:"", conclusion:null,
    demandeValidation:false, verse:false,
    cree:now, ouverte:now, clos:null
  };
  return Promise.resolve(window.TDLBase.ecrireEntree(CFG.NODE_MAIN, id, o, "murmure remonté à la Main"))
    .then(function(ok){
      if(!ok)return null;
      try{ if(window.EcoNotif)EcoNotif.bande("main",221,{},"mur"+id); }catch(e){}
      return id;
    });
}
/* L'avis à la bande ne dit jamais QUEL secret est sorti : l'anonymat vaut pour
   la dépositaire comme pour les autres. */
function fuites(api){
  if(!(api.estSorciere()||api.staff()))return;
  api.fiches().forEach(function(m){
    if(m.type!=="delib"||!m.fuite||m.fuite.faite)return;
    if(new Date(m.fuite.du).getTime()>Date.now())return;
    api.verrou(api.NODE, m.id, "fuiteFaite").then(function(){
      return ouvrirMurmure(api, m, api.secret(m.secretId));
    }).then(function(idm){
      m.fuite.faite=true; m.murmureId=idm||null;
      api.patch(m,{fuite:m.fuite, murmureId:m.murmureId});
      try{ if(window.EcoNotif)EcoNotif.bande("sorcieres",222,{},"fui"+m.id); }catch(e){}
      api.rendre();
    }).catch(function(){ /* un autre onglet s'en est chargé, ou le réseau a lâché */ });
  });
}

/* ===================== LES SÉANCES ===================== */
/* Sept jours sans volontaire : la demande n'a trouvé personne, et le joueur a
   payé pour rien. On rend tout. Le staff garde la main avant l'échéance : le
   bouton « Reprendre en mambo PNJ » existe pour sauver une séance plutôt que
   de la rendre. */
function seances(api){
  if(!api.staff())return;                 /* un seul rôle purge, pour ne pas multiplier les tentatives */
  api.fiches().forEach(function(m){
    if(m.type!=="seance"||m.statut!=="ouverte")return;
    if(m.responsable||m.pnj||m.solde)return;
    if(!echu(m.ouverte, CFG.DELAI_SEANCE))return;
    REG.argent.annuler(api, m).then(function(ok){
      if(!ok)return;
      m.statut="classee"; m.clos=new Date().toISOString();
      api.patch(m,{statut:"classee", clos:m.clos});
      try{ if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,216,{},"per"+m.id); }catch(e){}
      api.rendre();
    });
  });
}

/* ===================== LES PROPOSITIONS ===================== */
/* Seule une proposition SANS AUCUNE VOIX se périme. Une voix unanime tranche
   dans son sens ; des avis partagés remontent au staff par le drapeau de
   validation, et rien ne se décide tout seul. */
function propositions(api){
  if(!api.staff())return;
  api.fiches().forEach(function(m){
    if(m.type!=="poste"||m.statut!=="ouverte"||m.decide||m.tranche)return;
    if(m.sousType==="invitation")return;              /* une invitation ne se vote pas */
    if(!echu(m.ouverte, CFG.DELAI_VOIX))return;
    var v=verdict(m, api);
    if(!v){                                           /* avis partagés : au staff de trancher */
      if(!m.demandeValidation){ m.demandeValidation=true; api.patch(m,{demandeValidation:true}); api.rendre(); }
      return;
    }
    if(v==="acceptee"){
      api.verrou(api.NODE, m.id, "tranche").then(function(){
        m.decide={choix:"acceptee", date:new Date().toISOString(), oui:compter(m, api, "oui")};
        api.patch(m,{decide:m.decide, tranche:true});
        api.rendre();
      }).catch(function(){});
      return;
    }
    /* périmée ou refusée : dans les deux cas l'offrande est rendue */
    api.verrou(api.NODE, m.id, "tranche").then(function(){
      return REG.argent.annuler(api, m);
    }).then(function(ok){
      if(!ok)return;
      m.statut="classee";
      m.decide={choix:"refusee", date:new Date().toISOString(), oui:0, perime:(v==="perime")};
      m.clos=m.decide.date;
      api.patch(m,{statut:"classee", decide:m.decide, clos:m.clos, tranche:true});
      try{ if(window.EcoNotif&&m.demandeur)EcoNotif.a(m.demandeur,216,{},"per"+m.id); }catch(e){}
      api.rendre();
    }).catch(function(){});
  });
}

/* ===================== LES DÉLIBÉRATIONS ===================== */
/* Même règle, sans argent à rendre : le secret retourne dormant et redevient
   disponible pour une autre délibération. */
function deliberations(api){
  if(!api.staff())return;
  api.fiches().forEach(function(m){
    if(m.type!=="delib"||m.statut!=="ouverte"||m.decide||m.tranche)return;
    if(!echu(m.ouverte, CFG.DELAI_VOIX))return;
    var v=verdict(m, api);
    if(!v){
      if(!m.demandeValidation){ m.demandeValidation=true; api.patch(m,{demandeValidation:true}); api.rendre(); }
      return;
    }
    api.verrou(api.NODE, m.id, "tranche").then(function(){
      var s=api.secret(m.secretId), accepte=(v==="acceptee");
      m.statut=accepte?"close":"classee";
      m.decide={choix:accepte?"acceptee":"refusee", date:new Date().toISOString(),
                oui:compter(m, api, "oui"), perime:(v==="perime")};
      m.clos=m.decide.date;
      api.patch(m,{statut:m.statut, decide:m.decide, clos:m.clos, tranche:true});
      if(s){
        /* refus ou péremption : le secret redevient jouable ; accepté : il
           prend l'usage décidé, que seul le module de délibération connaît */
        var u=accepte?((REG.usageDe&&REG.usageDe(m.acte))||"employe"):"dormant";
        s.usage=u; api.patchSecret(s,{usage:u});
      }
      api.rendre();
    }).catch(function(){});
  });
}

/* ===================== VEILLE ===================== */
function tour(api){
  try{ fuites(api); }catch(e){}
  try{ seances(api); }catch(e){}
  try{ propositions(api); }catch(e){}
  try{ deliberations(api); }catch(e){}
}
setTimeout(function(){
  var api=REG.api; if(!api||!REG.argent)return;
  tour(api);
  setInterval(function(){ tour(api); }, CFG.FUITE_MS);
}, CFG.DEMARRAGE_MS);
})();
