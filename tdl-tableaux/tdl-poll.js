/* THE DROWNED LANDS — POLLING CIBLÉ PARTAGÉ · JS
   Relit un seul nœud Firebase à cadence rapide, au lieu de toute la base.
   Ne passe pas par safeReadBin (cache 60 s) : lecture directe par chemin via
   EcoCore.firebaseGet. Ne notifie que si le contenu a réellement changé.
   Les gardes d'édition (champ au focus, drawer ouvert, écriture récente) sont
   centralisées ici ; chaque tableau ne fournit que son propre « occupe() ».
   EXPOSE : window.TDLPoll.suivre(opts) → { arreter(), forcer() }
   DÉPEND DE : window.EcoCore (firebaseGet). */
(function(){
"use strict";

var DEFAUT_MS = 5000;

function champActif(){
  var ae=document.activeElement;
  return !!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName));
}

/* opts = {
     node      : chemin Firebase à surveiller (ex. "taches_faiseuses")
     onDonnees : function(brut) — appelée seulement quand le nœud a changé
     occupe    : function() → true si l'interface ne doit pas être redessinée
     ms        : cadence en ms (défaut 5000)
   } */
function suivre(opts){
  if(!opts||!opts.node||typeof opts.onDonnees!=="function")return null;
  var ms=opts.ms||DEFAUT_MS, derniere=null, enCours=false, iv=null, mort=false;

  function tick(force){
    if(mort||enCours)return;
    if(!window.EcoCore||!window.EcoCore.firebaseGet)return;
    if(!force){
      if(champActif())return;
      if(opts.occupe&&opts.occupe())return;
    }
    var pr;
    try{ pr=window.EcoCore.firebaseGet(opts.node); }catch(e){ return; }
    enCours=true;
    Promise.resolve(pr).then(function(brut){
      enCours=false;
      if(mort)return;
      if(!force&&opts.occupe&&opts.occupe())return;   /* l'état a pu changer pendant l'aller-retour */
      var sig=JSON.stringify(brut||{});
      if(sig===derniere)return;
      derniere=sig;
      opts.onDonnees(brut||{});
    }).catch(function(){ enCours=false; });
  }

  iv=setInterval(tick,ms);
  return {
    arreter:function(){ mort=true; clearInterval(iv); },
    forcer: function(){ tick(true); },
    /* à appeler après un chargement complet, pour ne pas redessiner inutilement */
    caler:  function(brut){ derniere=JSON.stringify(brut||{}); }
  };
}

window.TDLPoll={ suivre:suivre };

})();
