/* THE DROWNED LANDS — TABLEAU DES SECRETS · LE REGISTRE
   Une VUE à part, sur le modèle exact de l'ardoise du tableau des dettes : pas
   une fiche, une liste. Elle n'est offerte qu'aux Sorcières et au staff, et le
   socle ne lit même pas le nœud secrets pour les autres.

   CE QUI SE LIT, ET PAR QUI :
   - au POT : toutes les Sorcières. Un secret recueilli par une mambo PNJ y va
     directement — personne ne le détient, donc tout le monde le lit.
   - PRIVÉ : la seule Sorcière qui l'a recueilli. Les autres voient qu'il
     existe, chez qui, et rien de plus.
   - CONSOMMÉ (employé, monnayé, lâché) : ouvert à toutes, quelle que soit son
     origine. Un secret qui a servi n'a plus de valeur à protéger, et la bande a
     besoin de se souvenir de ce qu'elle a fait.
   Le staff lit tout, toujours.

   DEUX GESTES SEULEMENT. Verser au pot est personnel et sans vote. Se servir
   d'un secret passe par une délibération et trois voix — ce module n'y touche
   pas, il envoie vers rep-lb-delib.

   À CHARGER après rep-lb-core. */
(function(){
"use strict";
var REG = (window.TDLBayou = window.TDLBayou || { types: [], registre: null });

/* ===================== CONFIG ===================== */
var USAGES = {
  dormant:          {label:"Dormant",         c:"var(--cntr)"},
  en_deliberation:  {label:"En délibération",  c:"var(--gr3-color)"},
  employe:          {label:"Employé",          c:"var(--gr1-color)"},
  monnaye:          {label:"Monnayé",          c:"var(--gr4-color)"},
  lache:            {label:"Lâché",            c:"var(--gr6-color)"}
};
var ORIGINES = {
  boutique:"Confié aux Lwas", seance:"Recueilli en séance",
  seance_aveu:"Échappé sous la Brume", consultation:"Entendu en consultation",
  tableau:"Versé au registre"
};
var CONSOMME = { employe:1, monnaye:1, lache:1 };

var T = {
  TITRE:"Le registre des secrets",
  INTRO:"Les Sorcières conservent les secrets. Un secret versé au pot se lit de toutes ; gardé pour soi, il reste illisible des autres \u2014 et inutilisable, puisqu\u2019il faut trois voix pour s\u2019en servir.",
  VIDE:"Le registre est vide.",
  VIDE_FILTRE:"Aucun secret pour ce filtre.",
  TOUS:"Tous", POT:"Au pot", MIEN:"À moi", RIEN:"—",
  SCELLE:function(p){ return "Scellé \u2014 chez "+(p||"une Sorcière")+"."; },
  SCELLE_SANS:"Scellé.",
  VOIR:"Lire", MASQUER:"Masquer",
  VERSER:"Verser au pot", VERSE:"au pot", PRIVE:"privé",
  CONF_VERSER:"Verser ce secret au pot ?\nToutes les Sorcières le liront, et vous ne pourrez pas revenir dessus.",
  OK_VERSER:"Secret versé au pot.",
  DEPOSE:"Déposé", PAR:"Recueilli par", DEPOSANT:"Confié par",
  RUMEUR:"Rumeur parue", INTITULE_VIDE:"Sans intitulé \u2014 le staff peut en écrire un.",
  INTIT_BTN:"Écrire l\u2019intitulé", INTIT_TITRE:"Intitulé public",
  INTIT_AIDE:"Une ligne, sans rien livrer : c\u2019est tout ce que les Spectres liront lors d\u2019une délibération.",
  OK_INTIT:"Intitulé enregistré.",
  DELIB:"Pour vous en servir, ouvrez une délibération depuis le bouton du tableau."
};

/* ===================== ÉTAT LOCAL ===================== */
var F = { filtre:"tous", ouverts:{} };     /* ouverts : contenus dépliés */

/* ===================== DROITS DE LECTURE ===================== */
function consomme(s){ return !!CONSOMME[s.usage]; }
function peutLire(s, api){
  if(api.staff())return true;
  if(consomme(s))return true;
  if(s.etat==="pot")return true;
  return !!api.moi()&&s.recueilliPar===api.moi();
}
function peutVerser(s, api){
  return s.etat!=="pot"&&!consomme(s)&&!!api.moi()&&s.recueilliPar===api.moi();
}

/* ===================== FILTRES ===================== */
function liste(api){
  var me=api.moi();
  return api.secrets().filter(function(s){
    if(F.filtre==="tous")return true;
    if(F.filtre==="pot")return s.etat==="pot";
    if(F.filtre==="mien")return s.recueilliPar===me;
    return s.usage===F.filtre;
  });
}
function chips(api){
  var tous=api.secrets(), me=api.moi();
  var out=[{id:"tous",label:T.TOUS,c:"var(--cntr)",n:tous.length},
           {id:"pot",label:T.POT,c:"var(--gr2-color)",n:tous.filter(function(s){return s.etat==="pot";}).length},
           {id:"mien",label:T.MIEN,c:"var(--gr5-color)",n:tous.filter(function(s){return s.recueilliPar===me;}).length}];
  Object.keys(USAGES).forEach(function(u){
    out.push({id:u,label:USAGES[u].label,c:USAGES[u].c,n:tous.filter(function(s){return s.usage===u;}).length});
  });
  return out.map(function(c){
    return '<button class="tdlm-stf" data-act="f:'+api.escAttr(c.id)+'" aria-pressed="'+(c.id===F.filtre)+'" style="--sc:'+c.c+'">'
      +'<span class="tdlm-fdot"></span>'+api.esc(c.label)+' <b>'+c.n+'</b></button>';
  }).join("");
}

/* ===================== RENDU D'UN SECRET ===================== */
function carte(s, api){
  var esc=api.esc, lit=peutLire(s, api), ouvert=!!F.ouverts[s.id];
  var u=USAGES[s.usage]||USAGES.dormant;

  var tags='<span class="tdlm-req" style="background:'+u.c+'">'+esc(u.label)+'</span>'
    +'<span class="tdlm-req" style="background:var(--cntr)">'+(s.etat==="pot"?T.VERSE:T.PRIVE)+'</span>';

  var meta='<span class="tdlm-todo">'+esc(ORIGINES[s.origine]||s.origine||T.RIEN)
    +' \u00b7 '+T.DEPOSE+' '+esc(api.ilya(s.cree));
  if(s.recueilliPar)meta+=' \u00b7 '+T.PAR+' '+esc(s.recueilliPar);
  else if(s.deposant&&api.staff())meta+=' \u00b7 '+T.DEPOSANT+' '+esc(s.deposant);
  meta+='</span>';

  var corps;
  if(!lit)corps='<div class="tdlm-prose"><span class="tdlm-todo">'
    +esc(s.recueilliPar?T.SCELLE(s.recueilliPar):T.SCELLE_SANS)+'</span></div>';
  else if(ouvert)corps='<div class="tdlm-prose">'+esc(s.contenu||T.RIEN)+'</div>';
  else corps="";

  var btns="";
  if(lit)btns+='<button class="tdlm-abtn" data-act="v:'+api.escAttr(s.id)+'">'+(ouvert?T.MASQUER:T.VOIR)+'</button>';
  if(peutVerser(s, api))btns+='<button class="tdlm-abtn prim" data-act="p:'+api.escAttr(s.id)+'">'+T.VERSER+'</button>';
  if(api.staff())btns+='<button class="tdlm-abtn" data-act="i:'+api.escAttr(s.id)+'">'+T.INTIT_BTN+'</button>';

  var titre=s.intitule?esc(s.intitule)
    :(api.staff()?'<span class="tdlm-todo">'+T.INTITULE_VIDE+'</span>':'<span class="tdlm-todo">'+T.RIEN+'</span>');

  var rumeur="";
  if(s.rumeur&&s.rumeur.texte){
    rumeur='<div class="tdlm-negobox" style="margin-top:8px"><p class="tdlm-hsec">'+T.RUMEUR+'</p>'
      +'<div class="tdlm-negorow"><span>'+esc(s.rumeur.texte)+'</span></div>'
      +(s.rumeur.date?'<div class="tdlm-negorow"><span class="tdlm-todo">'+esc(api.dateFr(s.rumeur.date))+'</span></div>':"")
      +'</div>';
  }

  return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd">'
    +'<span class="tdlm-hsec" style="margin:0">'+titre+'</span>'+btns+'</div>'
    +'<div class="tdlm-drow-tags">'+tags+'</div>'
    +'<div style="padding:4px 0">'+meta+'</div>'
    +corps+rumeur
    +(F.edit===s.id?editIntitule(s, api):"")
    +'</div>';
}
function editIntitule(s, api){
  return '<div class="tdlm-drawer on"><h4>'+T.INTIT_TITRE+'</h4>'
    +'<p class="tdlm-todo" style="margin:0 0 8px">'+api.esc(T.INTIT_AIDE)+'</p>'
    +'<input type="text" id="tdlb-sec-intit" value="'+api.escAttr(s.intitule)+'">'
    +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="intitok">Enregistrer</button>'
    +'<button class="tdlm-abtn" data-do="intitcancel">Annuler</button></div></div>';
}

/* ===================== VUE ===================== */
function registre(api){
  var d=liste(api);
  var corps=d.length
    ? d.map(function(s){ return carte(s, api); }).join("")
    : '<div class="tdlm-empty">'+(api.secrets().length?T.VIDE_FILTRE:T.VIDE)+'</div>';
  return '<div class="tdlm-dpanel">'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">'+T.TITRE+'</span></div>'
    +'<div class="tdlm-dp-body">'
    +'<div class="tdlm-sec"><div class="tdlm-prose">'+api.esc(T.INTRO)+'</div>'
    +'<p class="tdlm-todo" style="margin:6px 0 0">'+api.esc(T.DELIB)+'</p></div>'
    +'<div class="tdlm-sec" style="padding-bottom:0">'+chips(api)+'</div>'
    +corps+'</div></div>';
}

/* ===================== ACTIONS ===================== */
/* Les clés portent leur cible : « v:id » lire, « p:id » verser, « i:id »
   intitulé, « f:clé » filtrer. Le socle relaie tel quel. */
function acte(k, api){
  var i=k.indexOf(":"); if(i<0)return;
  var quoi=k.slice(0,i), id=k.slice(i+1);
  if(quoi==="f"){ F.filtre=id; F.edit=null; api.rendreStage(); return; }
  var s=api.secret(id); if(!s)return;
  if(quoi==="v"){ F.ouverts[id]=!F.ouverts[id]; api.rendreStage(); return; }
  if(quoi==="i"){ F.edit=(F.edit===id)?null:id; api.rendreStage(); return; }
  if(quoi==="p"){
    if(!peutVerser(s, api))return;
    if(!window.confirm(T.CONF_VERSER))return;
    s.etat="pot";
    api.patchSecret(s,{etat:"pot"});
    try{ if(window.EcoNotif)EcoNotif.bande("sorcieres",230,{},"pot"+id); }catch(e){}
    api.toast(T.OK_VERSER); api.rendre(); return;
  }
}
function faire(k, api){
  if(k==="intitcancel"){ F.edit=null; api.rendreStage(); return; }
  if(k==="intitok"){
    var s=api.secret(F.edit); if(!s){F.edit=null;api.rendreStage();return;}
    var el=document.getElementById("tdlb-sec-intit");
    s.intitule=el?String(el.value||"").trim():"";
    api.patchSecret(s,{intitule:s.intitule});
    F.edit=null; api.toast(T.OK_INTIT); api.rendre(); return;
  }
}

/* ===================== ENREGISTREMENT ===================== */
REG.registre=registre;
REG.acte=acte;
REG.faire=faire;
})();
