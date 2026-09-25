/* THE DROWNED LANDS — TABLEAU DES DETTES (LA MAIN DE LA PROVIDENCE) · JS
   Moulé sur rep-tac-fais-v1.js, dont il réutilise le CSS (classes tdlm-).
   Dépend de window.EcoCore. Données : dossiers_main/{id}.

   Ce que la Main doit, ce qu'on lui doit. TROIS types de dossiers :
   - recouvrement : une dette contractée auprès de la Main que le débiteur
                    refuse de régler. Seul type à porter un montant, donc un GEL.
   - protection   : la Main s'acquitte d'un deal. Ouverte par la Main, ou
                    APPELÉE par un contact porteur d'un lien reseau_main.
   - silence      : canal d'urgence des Faiseuses d'Anges (créé par leur
                    tableau, pas ici — voir rep-tac-fais).

   ACCÈS : lecture réservée aux membres de la Main et au staff. Le demandeur
   et le PJ ciblé voient leur seul dossier.
   ACCORD : viser un PJ exige son accord horodaté ici, jamais ailleurs. Jason
   et le staff seuls peuvent passer outre, par DÉFAUT CARACTÉRISÉ (constat
   calculé + motif), et uniquement sur une créance tracée.
   GEL : un recouvrement avec montant fige la somme dès l'ouverture. Le gel vit
   dans le dossier ; quais-core le lit et le déduit du solde dépensable.
   CLÔTURE : transfert vers la cagnotte Providence, refus de clore si le compte
   n'y est pas, puis la dette rattachée est acquittée — supprimée du grand
   livre, ou dépouillée de son statut s'il s'agit d'un lien réseau. */
(function(){
"use strict";

/* ===================== CONFIG ===================== */
var CFG = {
  NODE: "dossiers_main",
  NODE_MEMBRES: "membres",
  NODE_CAGNOTTES: "cagnottes",
  CAGNOTTE: "Providence",
  BANDE: "main",
  EDIT_URL: "https://thedrownedlands.forumactif.com/post?p=000&mode=editpost" /* [MAJ] sujet porteur */
};

var STATUTS = {
  accord_attendu:{label:"Accord attendu", c:"var(--clair2)"},
  ouvert:        {label:"Ouvert",         c:"var(--gr3-color)"},
  saisi:         {label:"Saisi",          c:"var(--gr1-color)"},
  en_validation: {label:"En validation",  c:"var(--gr5-color)"},
  close:         {label:"Clos",           c:"var(--gr2-color)"},
  classee:       {label:"Classé",         c:"var(--gr6-color)"}
};
var GEL_STATUTS = {ouvert:1, saisi:1, en_validation:1};

var TYPES = {
  recouvrement:{label:"Recouvrement", ic:"fi-tr-hands-usd"},
  protection:  {label:"Protection",   ic:"fi-tr-shield-check"},
  silence:     {label:"Silence rompu",ic:"fi-tr-comment-slash"}
};
/* miroir de BHL_CONFIG.bandes.main.doigts — [MAJ] si la structure y change */
var DOIGTS = {pouce:"Le Pouce", index:"L'Index", majeur:"Le Majeur",
              annulaire:"L'Annulaire", auriculaire:"L'Auriculaire"};
var CIBLES = {aucune:"Aucune", pj:"Un personnage joueur", pnj:"Un PNJ", famille:"Une famille"};
var CERTITUDE = {certitude:"Certitude", indices:"Faisceau d'indices", soupcon:"Simple soupçon"};
var CONCLUSIONS = {confirmee:"Menace confirmée", neutralisee:"Menace neutralisée",
                   non_identifiee:"Source non identifiée", fausse:"Fausse alerte"};

/* ===================== UTILS ===================== */
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escAttr(s){return String(s==null?"":s).replace(/"/g,"&quot;");}
function vt(v){return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]);}
function newId(){return "d"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function nbJours(iso){var t=new Date(iso).getTime();if(isNaN(t))return null;return Math.floor((Date.now()-t)/86400000);}
function ilya(iso){var d=nbJours(iso);if(d==null)return"—";return d<=0?"aujourd'hui":("il y a "+d+" j");}
function money(n){return (+n||0)+" $";}
function typeLabel(k){return (TYPES[k]&&TYPES[k].label)||k;}
function typeIcon(k){return (TYPES[k]&&TYPES[k].ic)||"fi-tr-folder";}

function isStaff(){try{return typeof _userdata!=="undefined"&&(_userdata.user_level===1||_userdata.user_level===2);}catch(e){return false;}}
function estConnecte(){try{return typeof _userdata!=="undefined"&&parseInt(_userdata.user_id,10)>0;}catch(e){return false;}}
function myPseudo(){try{if(typeof _userdata!=="undefined"&&_userdata.username)return String(_userdata.username).trim();}catch(e){}return null;}

/* ===================== DONNÉES ===================== */
var D = [];        /* dossiers en mémoire */
var MEMBRES = {};  /* snapshot membres */

function hll(p){var m=MEMBRES[p];return (m&&m.hors_la_loi)||null;}
function estMain(p){var h=hll(p);return !!(h&&h.bande===CFG.BANDE);}
function estJason(p){var h=hll(p);return !!(h&&h.bande===CFG.BANDE&&h.type==="main");}
function estCavalier(p){var h=hll(p);return !!(h&&h.bande===CFG.BANDE&&h.type==="cavalier");}
function estPorteur(p){var h=hll(p);return !!(h&&h.bande===CFG.BANDE&&h.type==="doigt"&&h.chef);}
function doigtDe(p){var h=hll(p);return (h&&h.doigt)||null;}
function aucunPorteur(){var n=0;Object.keys(MEMBRES).forEach(function(p){if(estPorteur(p))n++;});return n===0;}
function aLienMain(p){
  var m=MEMBRES[p]; if(!m) return false;
  return vt(m.liens).some(function(l){return l&&l.type==="reseau_main";});
}
function solde(p){var m=MEMBRES[p];return (m&&+m.dollars)||0;}

/* créances traçables d'un membre, pour le rattachement d'un recouvrement */
function creances(p){
  var m=MEMBRES[p]||{}, out=[];
  var dts=m.dettes;
  if(dts&&typeof dts==="object")Object.keys(dts).forEach(function(k){
    var e=dts[k]; if(!e||typeof e!=="object")return;
    out.push({source:"dette",key:k,libelle:(e.type||"dette")+(e.motif?" — "+e.motif:""),date:e.date,montant:0});
  });
  var prs=m.prets;
  if(prs&&typeof prs==="object")Object.keys(prs).forEach(function(k){
    var e=prs[k]; if(!e||typeof e!=="object")return;
    out.push({source:"pret",key:k,libelle:"prêt de "+money(e.montant)+(e.nom?" — "+e.nom:""),date:e.date,montant:+e.montant||0});
  });
  vt(m.liens).forEach(function(l,idx){
    if(l&&l.type==="reseau_main"&&l.statut)
      out.push({source:"lien",idx:idx,libelle:"réseau — "+(l.role||l.categorie||"lien"),date:l.date,montant:0});
  });
  return out;
}
function creanceDe(d){
  if(!d.dette||!d.dette.pseudo)return null;
  var list=creances(d.dette.pseudo);
  for(var i=0;i<list.length;i++){
    var c=list[i];
    if(c.source!==d.dette.source)continue;
    if(c.source==="lien"){ if(String(c.idx)===String(d.dette.idx))return c; }
    else if(c.key===d.dette.key)return c;
  }
  return null;
}

function normaliser(o){
  o.titre=o.titre||"Dossier";
  o.type=TYPES[o.type]?o.type:"recouvrement";
  o.origine=o.origine||"main";
  o.doigt=o.doigt||null;
  o.demandeur=o.demandeur||null;
  o.cible_type=CIBLES[o.cible_type]?o.cible_type:"aucune";
  o.cible=o.cible||"";
  o.accord=(o.accord&&o.accord.choix)?o.accord:null;
  o.defaut=(o.defaut&&o.defaut.constat)?o.defaut:null;
  o.dette=(o.dette&&o.dette.pseudo)?o.dette:null;
  o.montant=+o.montant||0;
  o.contexte=o.contexte||""; o.objectif=o.objectif||"";
  o.contraintes=vt(o.contraintes);
  o.certitude=CERTITUDE[o.certitude]?o.certitude:null;
  o.evoquees=o.evoquees||""; o.urgence=o.urgence||"";
  o.statut=STATUTS[o.statut]?o.statut:"ouvert";
  o.responsable=o.responsable||null;
  o.participants=vt(o.participants);
  o.sujet=o.sujet||""; o.resume=o.resume||""; o.consequences=o.consequences||"";
  o.conclusion=CONCLUSIONS[o.conclusion]?o.conclusion:null;
  o.demandeValidation=!!o.demandeValidation;
  o.verse=!!o.verse;
  o.cree=o.cree||new Date().toISOString();
  o.ouverte=o.ouverte||o.cree; o.clos=o.clos||null;
  return o;
}
function serialize(m){var o={};for(var k in m){if(m.hasOwnProperty(k)&&k!=="id")o[k]=m[k];}return o;}

var _lastWrite=0;
function patch(m, champs){
  _lastWrite=Date.now();
  var up={}; for(var k in champs){if(champs.hasOwnProperty(k))up[CFG.NODE+"/"+m.id+"/"+k]=champs[k];}
  try{var p=window.EcoCore.firebaseUpdate(up);if(p&&p.catch)p.catch(function(){toast("Sauvegarde échouée — réessaie.");});}
  catch(e){toast("Sauvegarde échouée.");}
}
function parId(id){for(var i=0;i<D.length;i++){if(D[i].id===id)return D[i];}return null;}

/* ===================== GEL (lu aussi par quais-core) ===================== */
function gelDe(pseudo){
  var t=0;
  D.forEach(function(m){
    if(m.type!=="recouvrement"||!m.montant)return;
    if(!GEL_STATUTS[m.statut])return;
    if(m.dette&&m.dette.pseudo===pseudo)t+=m.montant;
  });
  return t;
}
window.DossiersMain={ gelDe:gelDe };

/* ===================== DROITS ===================== */
function peutOuvrir(){var me=myPseudo();return isStaff()||estJason(me)||estPorteur(me);}
function peutCibler(){var me=myPseudo();return isStaff()||estJason(me);}
function peutAppeler(){var me=myPseudo();return !!me&&aLienMain(me);}
function peutSaisir(m){
  var me=myPseudo();
  if(!me||!estMain(me))return false;
  if(m.statut!=="ouvert")return false;
  if(estCavalier(me)||estJason(me))return true;
  if(aucunPorteur())return true;                       /* forum jeune : personne n'est bloqué */
  return !!m.doigt&&doigtDe(me)===m.doigt;
}
function estCible(m){var me=myPseudo();return m.cible_type==="pj"&&!!me&&me===m.cible;}
function visible(m){
  var me=myPseudo();
  return isStaff()||estMain(me)||(!!me&&me===m.demandeur)||estCible(m);
}

/* compteurs d'appels : un demandeur qui tire sur la corde, ça se voit */
function compteurs(pseudo){
  var n=0,sans=0;
  D.forEach(function(m){
    if(m.demandeur!==pseudo)return;
    n++;
    if(m.statut==="classee"||m.conclusion==="fausse")sans++;
  });
  return {appels:n, sans:sans};
}

/* ===================== ÉTAT / FILTRAGE ===================== */
var S={statut:"tous", sel:null, mob:"liste", drawer:null, inline:null, creation:false};
function $(s,ctx){return (ctx||document).querySelector(s);}
function av(n){return '<span class="tdlm-avatar">'+esc(String(n||"?").replace(/[@.\s]/g,"").slice(0,2).toUpperCase())+'</span>';}
function aTraiter(m){return m.demandeValidation||m.statut==="accord_attendu";}
function filtre(){return D.filter(function(m){
  if(!visible(m))return false;
  if(S.statut==="demandes")return aTraiter(m);
  return S.statut==="tous"||m.statut===S.statut;
});}
function fixSel(){var d=filtre(),ok=false;d.forEach(function(m){if(m.id===S.sel)ok=true;});if(!ok)S.sel=d[0]?d[0].id:null;}

/* ===================== FILTRES STATUT ===================== */
function renderStatutFilters(){
  var vis=D.filter(visible);
  var chips=[{id:"tous",label:"Tous",c:"var(--cntr)"}];
  Object.keys(STATUTS).forEach(function(id){chips.push({id:id,label:STATUTS[id].label,c:STATUTS[id].c});});
  var html=chips.map(function(s){
    var n=s.id==="tous"?vis.length:vis.filter(function(m){return m.statut===s.id;}).length;
    return '<button class="tdlm-stf" data-st="'+s.id+'" aria-pressed="'+(s.id===S.statut)+'" style="--sc:'+s.c+'"><span class="tdlm-fdot"></span>'+s.label+' <b>'+n+'</b></button>';
  }).join("");
  if(isStaff()||estMain(myPseudo())){
    var nd=vis.filter(aTraiter).length;
    html+='<button class="tdlm-stf tdlm-req-chip" data-st="demandes" aria-pressed="'+(S.statut==="demandes")+'">⚑ À traiter <b>'+nd+'</b></button>';
  }
  var el=$("#tdld-stf");
  if(el){el.innerHTML=html;el.querySelectorAll(".tdlm-stf").forEach(function(b){b.onclick=function(){S.statut=b.getAttribute("data-st");fixSel();renderStage();renderStatutFilters();};});}
}

/* ===================== RENDER ===================== */
function stamp(m){var v=STATUTS[m.statut];return '<span class="tdlm-stamp" style="--sc:'+v.c+'">'+v.label+'</span>';}
function renderAll(){renderStatutFilters();renderStage();}
function loading(msg){var el=$("#tdld-stage");if(el)el.innerHTML='<div class="tdlm-empty">'+esc(msg||"Chargement…")+'</div>';}

var _lastSel=null;
function renderStage(){
  var el=$("#tdld-stage"); if(!el)return;
  var pl=el.querySelector(".tdlm-dlist-rows"); var scl=pl?pl.scrollTop:0;
  var pb=el.querySelector(".tdlm-dp-body"); var scb=pb?pb.scrollTop:0;
  var same=(_lastSel===S.sel);
  el.innerHTML=S.creation?formCreation():viewDossier();
  var nl=el.querySelector(".tdlm-dlist-rows"); if(nl)nl.scrollTop=scl;
  if(same){var nb=el.querySelector(".tdlm-dp-body"); if(nb)nb.scrollTop=scb;}
  _lastSel=S.sel;
  brancher();
}

function viewDossier(){
  var d=filtre();
  var rows=d.length?d.map(function(m){
    var tags="";
    if(m.statut==="accord_attendu")tags+='<span class="tdlm-req">⚑ accord</span>';
    if(m.defaut)tags+='<span class="tdlm-req" style="background:var(--gr6-color)">défaut</span>';
    if(m.montant)tags+='<span class="tdlm-req" style="background:var(--gr1-color)">'+money(m.montant)+'</span>';
    if(m.demandeValidation)tags+='<span class="tdlm-req">⚑ validation</span>';
    var sub=typeLabel(m.type)+(m.cible?' · '+m.cible:(m.demandeur?' · '+m.demandeur:''));
    return '<div class="tdlm-drow" data-sel="'+m.id+'" aria-current="'+(m.id===S.sel)+'">'
      +'<span class="tdlm-ddot" style="--sc:'+STATUTS[m.statut].c+'"></span>'
      +'<div style="min-width:0">'
        +'<div class="tdlm-drow-head"><span class="tdlm-type">'+esc(m.titre)+'</span></div>'
        +'<div class="tdlm-drow-sub">'+esc(sub)+'</div>'
        +(tags?'<div class="tdlm-drow-tags">'+tags+'</div>':'')
      +'</div>'
      +'<div class="tdlm-drow-right">'+(m.responsable?av(m.responsable):'')+'<div class="tdlm-posted">ouvert '+ilya(m.cree)+'</div></div>'
    +'</div>';
  }).join(""):'<div class="tdlm-empty">Aucun dossier pour ce filtre.</div>';
  var sel=parId(S.sel)||d[0];
  return '<div class="tdlm-dossier'+(S.mob==="detail"?" detail":"")+'">'
    +'<div class="tdlm-dlist"><div class="tdlm-dlist-rows">'+rows+'</div></div>'
    +'<div class="tdlm-dpanel">'+(sel?panel(sel):'<div class="tdlm-empty">—</div>')+'</div></div>';
}

function panel(m){
  var me=myPseudo(), staff=isStaff();

  var meta='<div class="tdlm-dp-meta">'
    +'<div class="tdlm-m"><span class="tdlm-k">Nature</span><span class="tdlm-v"><i class="fi '+typeIcon(m.type)+'"></i>'+esc(typeLabel(m.type))+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">Doigt</span><span class="tdlm-v">'+(m.doigt?esc(DOIGTS[m.doigt]||m.doigt):'<span class="tdlm-todo">non rattaché</span>')+'</span></div>'
    +'<div class="tdlm-m"><span class="tdlm-k">Responsable</span><span class="tdlm-v">'+(m.responsable?esc(m.responsable):'<span class="tdlm-todo">à désigner</span>')+'</span></div>'
    +(m.cible_type!=="aucune"?'<div class="tdlm-m"><span class="tdlm-k">Cible</span><span class="tdlm-v">'+esc(m.cible||"—")+' <span class="tdlm-todo">('+esc(CIBLES[m.cible_type])+')</span></span></div>':'')
    +(m.demandeur?'<div class="tdlm-m"><span class="tdlm-k">Demandeur</span><span class="tdlm-v">'+esc(m.demandeur)+'</span></div>':'')
    +(m.montant?'<div class="tdlm-m"><span class="tdlm-k">Somme gelée</span><span class="tdlm-v"><b>'+money(m.montant)+'</b></span></div>':'')
    +(m.certitude?'<div class="tdlm-m"><span class="tdlm-k">Degré de certitude</span><span class="tdlm-v">'+esc(CERTITUDE[m.certitude])+'</span></div>':'')
    +(m.urgence?'<div class="tdlm-m"><span class="tdlm-k">Urgence</span><span class="tdlm-v">'+esc(m.urgence)+'</span></div>':'')
    +(m.sujet?'<div class="tdlm-m"><span class="tdlm-k">Sujet RP</span><span class="tdlm-v"><a class="tdlm-lien" href="'+escAttr(m.sujet)+'" target="_blank" rel="noopener">Ouvrir le sujet →</a></span></div>':'')
    +'</div>';

  /* bandeaux */
  var bandeaux="";
  if(m.statut==="accord_attendu"){
    var mien=estCible(m);
    bandeaux+='<div class="tdlm-reqbanner"><p class="tdlm-hsec">⚑ Accord du personnage visé</p><div class="tdlm-reqrow"><span>'
      +(mien?'La Main souhaite ouvrir ce dossier contre votre personnage. Rien ne sera jouable sans votre accord.'
            :'Le dossier attend l\u2019accord de '+esc(m.cible)+'. Il reste invisible pour les autres.')
      +'</span>'
      +(mien?'<span class="tdlm-negoact"><button class="tdlm-abtn prim" data-act="accord-oui">J\u2019accepte</button><button class="tdlm-abtn warn" data-act="accord-non">Je refuse</button></span>':'')
      +'</div></div>';
  }
  if(m.accord){
    bandeaux+='<div class="tdlm-negobox"><p class="tdlm-hsec">Accord consigné</p><div class="tdlm-negorow"><span>'
      +esc(m.accord.par)+' — <b>'+(m.accord.choix==="accepte"?"accepté":"refusé")+'</b> le '+esc(new Date(m.accord.date).toLocaleDateString("fr-FR"))
      +(m.accord.raison?' <span class="tdlm-todo">('+esc(m.accord.raison)+')</span>':'')+'</span></div></div>';
  }
  if(m.defaut){
    bandeaux+='<div class="tdlm-reqbanner"><p class="tdlm-hsec">Défaut caractérisé</p>'
      +'<div class="tdlm-reqrow"><span>'+esc(m.defaut.constat)+'</span></div>'
      +(m.defaut.motif?'<div class="tdlm-reqrow"><span>'+esc(m.defaut.motif)+'</span></div>':'')
      +'<div class="tdlm-reqrow"><span class="tdlm-todo">Consigné par '+esc(m.defaut.par)+' le '+esc(new Date(m.defaut.date).toLocaleDateString("fr-FR"))+'.</span></div></div>';
  }
  if(m.demandeur&&(m.type==="silence"||m.origine==="contact")){
    var c=compteurs(m.demandeur);
    bandeaux+='<div class="tdlm-negobox"><p class="tdlm-hsec">Recours au protecteur</p><div class="tdlm-negorow"><span>'
      +'<b>'+c.appels+'</b> appel'+(c.appels>1?'s':'')+' à ce jour · <b>'+c.sans+'</b> sans suite ou fausse alerte.</span></div></div>';
  }
  if(staff&&m.demandeValidation){
    bandeaux+='<div class="tdlm-reqbanner"><p class="tdlm-hsec">⚑ Le responsable demande la validation</p><div class="tdlm-reqrow"><span>'
      +(m.montant?'La clôture prélèvera '+money(m.montant)+' sur le solde de '+esc(m.dette?m.dette.pseudo:"?")+' au profit de la cagnotte « '+esc(CFG.CAGNOTTE)+' ».'
                 :'Relis le bilan, puis clos le dossier.')
      +'</span></div></div>';
  }

  /* corps */
  var corps='<div class="tdlm-sec"><p class="tdlm-hsec">'+(m.type==="silence"?"Ce que nous savons":"Contexte")+'</p>'
    +'<div class="tdlm-prose">'+(m.contexte?esc(m.contexte):'<span class="tdlm-todo">—</span>')+'</div></div>';
  if(m.evoquees)corps+='<div class="tdlm-sec"><p class="tdlm-hsec">Personnes évoquées</p><div class="tdlm-prose">'+esc(m.evoquees)+'</div>'
    +'<p class="tdlm-todo" style="margin:6px 0 0">Évoquées, pas accusées. Rien n\u2019est établi.</p></div>';
  if(m.objectif)corps+='<div class="tdlm-sec"><p class="tdlm-hsec">Objectif</p><div class="tdlm-prose">'+esc(m.objectif)+'</div></div>';
  if(m.contraintes.length)corps+='<div class="tdlm-sec"><p class="tdlm-hsec">Contraintes</p><ul class="tdlm-clean">'
    +m.contraintes.map(function(x){return '<li class="tdlm-puce">'+esc(x)+'</li>';}).join("")+'</ul></div>';

  /* participants */
  var pList=m.participants.length?m.participants.map(function(p){
    return '<div class="tdlm-person'+(p===m.responsable?' chef':'')+'">'+av(p)+'<span class="tdlm-pname">'+esc(p)+'</span>'
      +(p===m.responsable?'<span class="tdlm-r">responsable</span>':'')+'</div>';
  }).join(""):'<p class="tdlm-todo" style="margin:0">Personne ne s\u2019en est encore saisi.</p>';
  var joinBtn=peutSaisir(m)&&m.participants.indexOf(me)<0?'<button class="tdlm-abtn prim" data-act="saisir">Je m\u2019en saisis</button>':'';
  var rejoin=(m.statut==="saisi"&&estMain(me)&&m.participants.indexOf(me)<0)?'<button class="tdlm-abtn" data-act="join">Je participe</button>':'';
  var cadre=(m.statut==="accord_attendu")?"":'<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Sur le dossier</span>'+joinBtn+rejoin+'</div>'+pList+'</div>';

  /* bilan */
  var bilan="";
  if(m.resume||m.consequences||m.statut==="en_validation"||m.statut==="close"){
    bilan='<div class="tdlm-sec"><p class="tdlm-hsec">Résumé</p><div class="tdlm-prose">'+(m.resume?esc(m.resume):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +'<div class="tdlm-sec"><p class="tdlm-hsec">Conséquences</p><div class="tdlm-prose">'+(m.consequences?esc(m.consequences):'<span class="tdlm-todo">—</span>')+'</div></div>'
      +(m.conclusion?'<div class="tdlm-sec"><p class="tdlm-hsec">Conclusion</p><div class="tdlm-prose">'+esc(CONCLUSIONS[m.conclusion])+'</div></div>':'');
  }

  return '<button class="tdlm-dret" data-back="1">‹ Retour</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">'+esc(m.titre)+'</span>'+stamp(m)+'</div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-dp-hd">'+meta+bandeaux+'</div>'
    +corps+cadre+bilan+drawer(m)+'</div>'
    +actionbar(m);
}

function actionbar(m){
  var me=myPseudo(), staff=isStaff(), resp=(me&&me===m.responsable), label, btns="";
  if(staff){
    label="Staff";
    if(m.statut==="en_validation")btns+='<button class="tdlm-abtn prim" data-act="clore">Clore le dossier</button>';
    btns+='<button class="tdlm-abtn" data-act="edit">Modifier les termes</button>';
    if(m.statut!=="close"&&m.statut!=="classee")btns+='<button class="tdlm-abtn warn" data-act="classer">Classer sans suite</button>';
    btns+='<button class="tdlm-abtn warn" data-act="delete">Supprimer</button>';
  }else if(resp&&(m.statut==="saisi"||m.statut==="en_validation")){
    label="Responsable";
    btns+='<button class="tdlm-abtn" data-act="sujet">'+(m.sujet?"Modifier le sujet RP":"Renseigner le sujet RP")+'</button>';
    btns+='<button class="tdlm-abtn prim" data-act="bilan">'+(m.statut==="en_validation"?"Modifier le bilan":"Bilan &amp; validation")+'</button>';
  }else if(estCible(m)&&m.statut==="accord_attendu"){
    label="Personnage visé"; btns='<span class="tdlm-idle">Votre réponse est attendue ci-dessus.</span>';
  }else if(me&&me===m.demandeur){
    label="Demandeur"; btns='<span class="tdlm-idle">Dossier transmis à la Main — statut : '+STATUTS[m.statut].label.toLowerCase()+'.</span>';
  }else if(estMain(me)){
    label=estJason(me)?"La Main":(estCavalier(me)?"Cavalier":"Membre de la Main");
    btns='<span class="tdlm-idle">'+(peutSaisir(m)?"Saisissez-vous du dossier ci-dessus.":"Rien à faire pour l\u2019instant.")+'</span>';
  }else if(!estConnecte()){
    label="Invité"; btns='<span class="tdlm-idle">Connectez-vous.</span>';
  }else{
    label="Visiteur"; btns='<span class="tdlm-idle">Ce registre ne vous concerne pas.</span>';
  }
  return '<div class="tdlm-actionbar"><span class="tdlm-ab-role">Vous : '+label+'</span>'+btns+'</div>';
}

/* ---- drawers ---- */
function drawer(m){
  if(S.inline==="sujet"){
    return '<div class="tdlm-drawer on"><h4>Sujet RP du dossier</h4>'
      +'<input type="text" id="tdld-sujet" value="'+escAttr(m.sujet)+'" placeholder="https://thedrownedlands.forumactif.com/t...">'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="sujetok">Enregistrer</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="bilan"){
    var co=m.type==="silence"
      ? '<label class="tdlm-fl">Conclusion</label><select id="tdld-bconc">'
        +Object.keys(CONCLUSIONS).map(function(k){return '<option value="'+k+'"'+(k===m.conclusion?' selected':'')+'>'+CONCLUSIONS[k]+'</option>';}).join("")+'</select>'
      : '';
    return '<div class="tdlm-drawer on"><h4>Bilan du dossier</h4>'
      +'<label class="tdlm-fl">Résumé</label><textarea id="tdld-bresume">'+esc(m.resume)+'</textarea>'
      +'<label class="tdlm-fl">Conséquences</label><textarea id="tdld-bconseq" placeholder="Ce que ça laisse derrière : une réputation, une rancune, une leçon\u2026">'+esc(m.consequences)+'</textarea>'
      +co
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="bilanok">'+(m.statut==="en_validation"?"Enregistrer":"Envoyer en validation")+'</button>'
      +(m.statut!=="en_validation"?'<button class="tdlm-abtn" data-do="bilansave">Enregistrer sans envoyer</button>':'')
      +'<button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  if(S.drawer==="edit"){
    var dg='<option value="">— non rattaché —</option>'+Object.keys(DOIGTS).map(function(k){return '<option value="'+k+'"'+(k===m.doigt?' selected':'')+'>'+DOIGTS[k]+'</option>';}).join("");
    return '<div class="tdlm-drawer on"><h4>Modifier les termes (staff)</h4>'
      +'<label class="tdlm-fl">Titre</label><input type="text" id="tdld-etitre" value="'+escAttr(m.titre)+'">'
      +'<label class="tdlm-fl">Doigt rattaché</label><select id="tdld-edoigt">'+dg+'</select>'
      +'<label class="tdlm-fl">Objectif</label><textarea id="tdld-eobj">'+esc(m.objectif)+'</textarea>'
      +'<label class="tdlm-fl">Contraintes (une par ligne)</label><textarea id="tdld-econtr">'+esc(m.contraintes.join("\n"))+'</textarea>'
      +'<label class="tdlm-fl">Contexte</label><textarea id="tdld-ectx">'+esc(m.contexte)+'</textarea>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="editok">Enregistrer</button><button class="tdlm-abtn" data-do="cancel">Annuler</button></div></div>';
  }
  return "";
}

/* ---- formulaire d'ouverture ---- */
function optMembres(){
  return '<option value="">— choisir —</option>'+Object.keys(MEMBRES).sort(function(a,b){return a.localeCompare(b,"fr");})
    .map(function(p){return '<option value="'+escAttr(p)+'">'+esc(p)+'</option>';}).join("");
}
function optCreances(p){
  var list=p?creances(p):[];
  if(!list.length)return '<option value="">— aucune créance tracée —</option>';
  return '<option value="">— choisir —</option>'+list.map(function(c,i){
    return '<option value="'+i+'">'+esc(c.libelle)+(c.date?" · "+ilya(c.date):"")+'</option>';
  }).join("");
}
function formCreation(){
  var me=myPseudo(), main=peutOuvrir(), appel=!main&&peutAppeler();
  var types=main?Object.keys(TYPES).filter(function(k){return k!=="silence";}):["protection"];
  var dg='<option value="">— non rattaché —</option>'+Object.keys(DOIGTS).map(function(k){return '<option value="'+k+'">'+DOIGTS[k]+'</option>';}).join("");
  var cb=Object.keys(CIBLES).map(function(k){return '<option value="'+k+'">'+CIBLES[k]+'</option>';}).join("");
  var intro=main
    ? "Un dossier ne s\u2019ouvre que lorsque quelqu\u2019un refuse de s\u2019exécuter, ou qu\u2019une menace pèse sur un protégé. La bonne foi se règle ailleurs."
    : "Vous faites partie du réseau de la Main. Ce n\u2019est pas un service que vous achetez : c\u2019est un dû que vous invoquez.";
  return '<div class="tdlm-dpanel"><div class="tdlm-dp-title"><span class="tdlm-type">Ouvrir un dossier</span></div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-sec"><p class="tdlm-hsec">Avant d\u2019écrire</p><div class="tdlm-prose">'+esc(intro)+'</div></div>'
    +'<div class="tdlm-drawer on" style="margin:0 24px 20px">'
    +'<label class="tdlm-fl">Nature</label><select id="tdld-ntype">'+types.map(function(k){return '<option value="'+k+'">'+TYPES[k].label+'</option>';}).join("")+'</select>'
    +'<label class="tdlm-fl">Titre</label><input type="text" id="tdld-ntitre" placeholder="Ce que voient les autres en un coup d\u2019\u0153il">'
    +(main?'<label class="tdlm-fl">Doigt rattaché</label><select id="tdld-ndoigt">'+dg+'</select>':'')
    +'<div id="tdld-nrecouv" style="display:none">'
      +'<label class="tdlm-fl">Débiteur</label><select id="tdld-ndeb">'+optMembres()+'</select>'
      +'<label class="tdlm-fl">Créance</label><select id="tdld-ncre"><option value="">— choisir un débiteur d\u2019abord —</option></select>'
      +'<label class="tdlm-fl">Somme à geler ($, 0 si la dette n\u2019est pas monétaire)</label><input type="text" id="tdld-nmontant" value="0">'
    +'</div>'
    +(main?'<div id="tdld-ncible">'
      +'<label class="tdlm-fl">Cible</label><select id="tdld-nctype">'+cb+'</select>'
      +'<label class="tdlm-fl">Nom de la cible</label><input type="text" id="tdld-ncible-nom" placeholder="Pseudo du PJ, nom du PNJ ou de la famille">'
      +(peutCibler()?'<label class="tdlm-fl" style="margin-top:8px"><input type="checkbox" id="tdld-ndefaut"> Défaut caractérisé — ouvrir sans l\u2019accord du PJ visé</label>'
        +'<input type="text" id="tdld-ndmotif" placeholder="Motif : refus en RP, dette laissée courir\u2026">':'')
    +'</div>':'')
    +(appel?'<label class="tdlm-fl">Urgence</label><input type="text" id="tdld-nurg" placeholder="Immédiate, dans les jours qui viennent\u2026">':'')
    +'<label class="tdlm-fl">Contexte</label><textarea id="tdld-nctx" placeholder="Ce qui a mené jusque-là\u2026"></textarea>'
    +'<label class="tdlm-fl">Objectif</label><textarea id="tdld-nobj" placeholder="Ce que la Main doit obtenir\u2026"></textarea>'
    +'<label class="tdlm-fl">Contraintes (une par ligne)</label><textarea id="tdld-ncontr"></textarea>'
    +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-do="newok">Ouvrir le dossier</button><button class="tdlm-abtn" data-do="newcancel">Annuler</button></div></div></div></div>';
}

/* ===================== ÉVÉNEMENTS ===================== */
function toast(msg){var t=document.createElement("div");t.className="tdlm-toast";t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.style.transition="opacity .4s";t.style.opacity="0";setTimeout(function(){t.remove();},400);},3600);}

function brancher(){
  var stage=$("#tdld-stage"); if(!stage)return;
  stage.querySelectorAll("[data-sel]").forEach(function(el){el.onclick=function(){S.sel=el.getAttribute("data-sel");S.drawer=null;S.inline=null;S.mob="detail";renderStage();};});
  var back=stage.querySelector("[data-back]"); if(back)back.onclick=function(){S.mob="liste";renderStage();};
  stage.querySelectorAll("[data-act]").forEach(function(el){el.onclick=function(){act(el.getAttribute("data-act"));};});
  stage.querySelectorAll("[data-do]").forEach(function(el){el.onclick=function(){doo(el.getAttribute("data-do"));};});
  var ty=$("#tdld-ntype"), rec=$("#tdld-nrecouv"), cib=$("#tdld-ncible");
  if(ty){
    var maj=function(){ if(rec)rec.style.display=(ty.value==="recouvrement")?"":"none";
                        if(cib)cib.style.display=(ty.value==="recouvrement")?"":"none"; };
    ty.onchange=maj; maj();
  }
  var deb=$("#tdld-ndeb");
  if(deb)deb.onchange=function(){
    var cre=$("#tdld-ncre"); if(cre)cre.innerHTML=optCreances(deb.value);
    var mt=$("#tdld-nmontant"); if(mt)mt.value="0";
    var cn=$("#tdld-ncible-nom"), ct=$("#tdld-nctype");
    if(cn&&!cn.value)cn.value=deb.value;                 /* le débiteur est la cible par défaut */
    if(ct&&deb.value)ct.value="pj";
  };
  var cre=$("#tdld-ncre");
  if(cre)cre.onchange=function(){
    var d=$("#tdld-ndeb"), mt=$("#tdld-nmontant");
    if(!d||!mt||cre.value==="")return;
    var c=creances(d.value)[+cre.value];
    if(c)mt.value=String(c.montant||0);
  };
}

function act(k){
  var m=parId(S.sel); if(!m)return;
  var me=myPseudo();
  if(k==="accord-oui"||k==="accord-non"){repondre(m,k==="accord-oui");return;}
  if(k==="saisir"){
    if(!peutSaisir(m)){toast("Ce dossier ne vous est pas ouvert.");return;}
    m.responsable=me;m.statut="saisi";
    if(m.participants.indexOf(me)<0)m.participants.push(me);
    patch(m,{responsable:me,statut:"saisi",participants:m.participants});
    toast("Dossier saisi — vous en êtes responsable.");renderAll();return;
  }
  if(k==="join"){
    if(!estMain(me)){toast("Réservé aux membres de la Main.");return;}
    if(m.participants.indexOf(me)>=0)return;
    m.participants.push(me);patch(m,{participants:m.participants});
    toast("Inscrit·e au dossier.");renderAll();return;
  }
  if(k==="sujet"){S.inline=S.inline==="sujet"?null:"sujet";S.drawer=null;renderStage();return;}
  if(k==="bilan"){S.drawer=S.drawer==="bilan"?null:"bilan";S.inline=null;renderStage();return;}
  if(k==="edit"){S.drawer=S.drawer==="edit"?null:"edit";S.inline=null;renderStage();return;}
  if(k==="clore"){clore(m);return;}
  if(k==="classer"){classer(m);return;}
  if(k==="delete"){supprimer(m);return;}
}

function doo(k){
  if(k==="newcancel"){S.creation=false;renderStage();return;}
  if(k==="newok"){creer();return;}
  var m=parId(S.sel); if(!m)return;
  if(k==="cancel"){S.drawer=null;S.inline=null;renderStage();return;}
  if(k==="sujetok"){
    var u=(($("#tdld-sujet")||{}).value||"").trim();
    m.sujet=u;patch(m,{sujet:u});S.inline=null;
    toast(u?"Sujet RP enregistré.":"Sujet RP retiré.");renderStage();return;
  }
  if(k==="bilanok"||k==="bilansave"){
    m.resume=(($("#tdld-bresume")||{}).value||"").trim();
    m.consequences=(($("#tdld-bconseq")||{}).value||"").trim();
    var champs={resume:m.resume,consequences:m.consequences};
    var cc=$("#tdld-bconc"); if(cc){m.conclusion=cc.value;champs.conclusion=cc.value;}
    if(k==="bilanok"&&m.statut!=="en_validation"){
      if(!m.resume){toast("Renseigne au moins le résumé.");return;}
      m.statut="en_validation";m.demandeValidation=true;
      champs.statut="en_validation";champs.demandeValidation=true;
    }
    patch(m,champs);S.drawer=null;
    toast(champs.statut==="en_validation"?"Dossier envoyé en validation.":"Bilan enregistré.");
    renderAll();return;
  }
  if(k==="editok"){
    m.titre=(($("#tdld-etitre")||{}).value||"").trim()||m.titre;
    var dd=$("#tdld-edoigt"); if(dd)m.doigt=dd.value||null;
    m.objectif=(($("#tdld-eobj")||{}).value||"").trim();
    m.contraintes=(($("#tdld-econtr")||{}).value||"").split("\n").map(function(x){return x.trim();}).filter(Boolean);
    m.contexte=(($("#tdld-ectx")||{}).value||"").trim();
    patch(m,{titre:m.titre,doigt:m.doigt,objectif:m.objectif,contraintes:m.contraintes,contexte:m.contexte});
    S.drawer=null;toast("Termes enregistrés.");renderAll();return;
  }
}

/* ===================== ACCORD ===================== */
function repondre(m, oui){
  var me=myPseudo();
  if(!estCible(m)){toast("Vous n\u2019êtes pas le personnage visé.");return;}
  var raison="";
  if(!oui){ raison=window.prompt("Pour le staff : en quelques mots, pourquoi refusez-vous ?","")||""; }
  else if(!window.confirm("Accepter que votre personnage soit visé par ce dossier ?\nIl deviendra visible des membres de la Main.")) return;
  m.accord={choix:oui?"accepte":"refuse", par:me, date:new Date().toISOString(), raison:raison};
  m.statut=oui?"ouvert":"classee";
  if(oui)m.ouverte=new Date().toISOString();
  patch(m,{accord:m.accord,statut:m.statut,ouverte:m.ouverte});
  toast(oui?"Accord consigné — le dossier est ouvert.":"Refus consigné, dossier classé.");
  renderAll();
}

/* ===================== CLÔTURE / ARGENT ===================== */
function clore(m){
  if(m.montant&&!m.verse){
    var p=m.dette&&m.dette.pseudo;
    if(!p){toast("Dossier monétaire sans débiteur rattaché.");return;}
    if(solde(p)<m.montant){toast("Solde insuffisant ("+money(solde(p))+") — le dossier reste ouvert.");return;}
    if(!window.confirm("Clore « "+m.titre+" » ?\n"+money(m.montant)+" seront prélevés sur le solde de "+p+" et versés à la cagnotte « "+CFG.CAGNOTTE+" ». Irréversible."))return;
    window.EcoCore.firebaseTransaction(CFG.NODE_MEMBRES+"/"+encodeURIComponent(p)+"/dollars",function(cur){
      var c=cur||0; if(c<m.montant)throw new Error("FONDS"); return c-m.montant;
    }).then(function(){
      return window.EcoCore.firebaseTransaction(CFG.NODE_CAGNOTTES+"/"+encodeURIComponent(CFG.CAGNOTTE),function(cur){return (cur||0)+m.montant;});
    }).then(function(){
      m.verse=true;patch(m,{verse:true});
      return acquitter(m);
    }).then(function(){ finaliser(m); })
      .catch(function(e){
        if(e&&e.message==="FONDS"){toast("Solde devenu insuffisant — rien n\u2019a été prélevé.");return;}
        toast("Prélèvement échoué — dossier non clos.");
      });
    return;
  }
  if(!window.confirm("Clore « "+m.titre+" » ?"+(m.dette?"\nLa créance rattachée sera acquittée.":"")))return;
  Promise.resolve(acquitter(m)).then(function(){ finaliser(m); }).catch(function(){ toast("Acquittement échoué — dossier non clos."); });
}
/* la créance disparaît du grand livre ; un LIEN réseau perd son statut de
   dette mais reste au bottin — on s'acquitte d'une dette, on ne cesse pas
   d'être un contact. */
function acquitter(m){
  if(!m.dette||!m.dette.pseudo)return Promise.resolve();
  var p=m.dette.pseudo, E=window.EcoCore;
  if(m.dette.source==="lien"){
    return Promise.resolve(E.safeReadBin()).then(function(r){
      var arr=vt(r&&r[CFG.NODE_MEMBRES]&&r[CFG.NODE_MEMBRES][p]&&r[CFG.NODE_MEMBRES][p].liens);
      var ix=+m.dette.idx;
      if(arr[ix]){var l={};for(var k in arr[ix])if(arr[ix].hasOwnProperty(k))l[k]=arr[ix][k];l.statut=null;arr[ix]=l;}
      return E.writeField(CFG.NODE_MEMBRES+"/"+encodeURIComponent(p)+"/liens",arr.length?arr:null);
    });
  }
  var o={}; o[CFG.NODE_MEMBRES+"/"+p+"/"+(m.dette.source==="pret"?"prets":"dettes")+"/"+m.dette.key]=null;
  return E.firebaseUpdate(o);
}
function finaliser(m){
  m.statut="close";m.demandeValidation=false;m.clos=new Date().toISOString();
  patch(m,{statut:"close",demandeValidation:false,clos:m.clos});
  toast("Dossier clos.");E.invalider();renderAll();
}
function classer(m){
  if(!window.confirm("Classer « "+m.titre+" » sans suite ?"+(m.montant?"\nLa somme gelée sera libérée.":"")))return;
  m.statut="classee";m.demandeValidation=false;m.clos=new Date().toISOString();
  patch(m,{statut:"classee",demandeValidation:false,clos:m.clos});
  toast("Dossier classé sans suite.");renderAll();
}
function supprimer(m){
  if(!window.confirm("Supprimer définitivement « "+m.titre+" » ?\nAucun mouvement d\u2019argent n\u2019est effectué."))return;
  var up={};up[CFG.NODE+"/"+m.id]=null;
  try{var p=window.EcoCore.firebaseUpdate(up);if(p&&p.catch)p.catch(function(){toast("Suppression Firebase échouée.");});}catch(e){toast("Suppression échouée.");}
  D=D.filter(function(x){return x!==m;});
  var d=filtre();S.sel=d[0]?d[0].id:null;S.drawer=null;S.inline=null;S.mob="liste";
  toast("Dossier supprimé.");renderAll();
}
var E={invalider:function(){try{if(window.EcoCore.invalidateCache)window.EcoCore.invalidateCache();}catch(e){}}};

/* ===================== CRÉATION ===================== */
function creer(){
  var me=myPseudo(), main=peutOuvrir(), appel=!main&&peutAppeler();
  if(!main&&!appel){toast("Vous n\u2019êtes pas habilité à ouvrir un dossier.");return;}
  var titre=(($("#tdld-ntitre")||{}).value||"").trim();
  if(!titre){toast("Donne un titre au dossier.");return;}
  var type=main?(($("#tdld-ntype")||{}).value||"recouvrement"):"protection";

  var o={ type:type, origine:main?"main":"contact", titre:titre,
          doigt:main?((($("#tdld-ndoigt")||{}).value)||null):null,
          demandeur:main?null:me, cible_type:"aucune", cible:"",
          accord:null, defaut:null, dette:null, montant:0,
          contexte:(($("#tdld-nctx")||{}).value||"").trim(),
          objectif:(($("#tdld-nobj")||{}).value||"").trim(),
          contraintes:(($("#tdld-ncontr")||{}).value||"").split("\n").map(function(x){return x.trim();}).filter(Boolean),
          certitude:null, evoquees:"", urgence:(($("#tdld-nurg")||{}).value||"").trim(),
          statut:"ouvert", responsable:null, participants:[],
          sujet:"", resume:"", consequences:"", conclusion:null,
          demandeValidation:false, verse:false,
          cree:new Date().toISOString(), ouverte:new Date().toISOString(), clos:null };

  if(type==="recouvrement"){
    var deb=(($("#tdld-ndeb")||{}).value||"");
    var ci=(($("#tdld-ncre")||{}).value||"");
    if(!deb||ci===""){toast("Choisis un débiteur et la créance concernée.");return;}
    var c=creances(deb)[+ci];
    if(!c){toast("Créance introuvable.");return;}
    o.dette=(c.source==="lien")?{pseudo:deb,source:"lien",idx:c.idx}:{pseudo:deb,source:c.source,key:c.key};
    o.montant=parseInt((($("#tdld-nmontant")||{}).value||"0").replace(/[^\d]/g,""),10)||0;
    if(o.montant&&solde(deb)<o.montant){toast("Le solde de "+deb+" ("+money(solde(deb))+") ne couvre pas la somme — inutile d\u2019ouvrir.");return;}
  }
  if(main){
    o.cible_type=(($("#tdld-nctype")||{}).value||"aucune");
    o.cible=(($("#tdld-ncible-nom")||{}).value||"").trim();
    if(o.cible_type!=="aucune"&&!o.cible){toast("Nomme la cible.");return;}
    if(o.cible_type==="pj"){
      var df=$("#tdld-ndefaut"), forcer=!!(df&&df.checked&&peutCibler());
      if(forcer){
        if(!o.dette){toast("Le défaut caractérisé exige une créance tracée.");return;}
        var cc=creanceDe(o), anc=cc&&cc.date?nbJours(cc.date):null;
        o.defaut={ constat:(anc!=null?("créance ouverte depuis "+anc+" jours · "):"")
                     +"solde du débiteur : "+money(solde(o.dette.pseudo))
                     +(cc?" · "+cc.libelle:""),
                   motif:(($("#tdld-ndmotif")||{}).value||"").trim(), par:me, date:new Date().toISOString() };
        if(!window.confirm("Ouvrir sans l\u2019accord de "+o.cible+" ?\nLe joueur doit avoir été prévenu au préalable. Le constat sera consigné et visible."))return;
      } else {
        o.statut="accord_attendu";
      }
    }
  }

  var id=newId();
  _lastWrite=Date.now();
  Promise.resolve(window.EcoCore.writeField(CFG.NODE+"/"+id,o)).then(function(){
    o.id=id;D.unshift(normaliser(o));S.creation=false;S.sel=id;S.mob="detail";
    toast(o.statut==="accord_attendu"?"Dossier créé — en attente de l\u2019accord de "+o.cible+"."
         :(o.montant?"Dossier ouvert — "+money(o.montant)+" gelés.":"Dossier ouvert."));
    renderAll();
  }).catch(function(){toast("Ouverture échouée.");});
}

/* ===================== CHARGEMENT ===================== */
function loadData(){
  loading("Chargement des dossiers…");
  var pr;try{pr=window.EcoCore.safeReadBin();}catch(e){loading("EcoCore indisponible.");return;}
  Promise.resolve(pr).then(function(rec){
    MEMBRES=(rec&&rec[CFG.NODE_MEMBRES])||{};
    var raw=(rec&&rec[CFG.NODE])?rec[CFG.NODE]:{};
    D=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliser(o);});
    D.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
    fixSel();renderAll();
    if(!D.length)loading("Aucun dossier ouvert.");
  }).catch(function(){loading("Impossible de charger les dossiers.");});
}
function whenEco(cb){
  if(window.EcoCore&&window.EcoCore.safeReadBin){cb();return;}
  loading("Connexion à la base…");
  var n=0,iv=setInterval(function(){
    if(window.EcoCore&&window.EcoCore.safeReadBin){clearInterval(iv);cb();}
    else if(++n>80){clearInterval(iv);loading("EcoCore introuvable — vérifiez que le script économie est chargé.");}
  },125);
}
var REFRESH_MS=60000;
function signature(list){return list.map(function(o){return o.id+":"+JSON.stringify(serialize(o));}).sort().join("|");}
function tickRefresh(){
  if(!window.EcoCore||!window.EcoCore.safeReadBin)return;
  if(S.drawer||S.inline||S.creation)return;
  if(Date.now()-_lastWrite<5000)return;
  var ae=document.activeElement; if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))return;
  E.invalider();
  var pr;try{pr=window.EcoCore.safeReadBin();}catch(e){return;}
  Promise.resolve(pr).then(function(rec){
    if(S.drawer||S.inline||S.creation||Date.now()-_lastWrite<5000)return;
    MEMBRES=(rec&&rec[CFG.NODE_MEMBRES])||MEMBRES;
    var raw=(rec&&rec[CFG.NODE])?rec[CFG.NODE]:{};
    var next=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliser(o);});
    next.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
    if(signature(next)===signature(D))return;
    D=next;fixSel();renderAll();
  }).catch(function(){});
}

/* ===================== INIT / MONTAGE ===================== */
function initApp(){
  var edit=$("#tdld-edit");
  if(edit){edit.href=CFG.EDIT_URL||"#";if(isStaff())edit.classList.add("on");}
  var neuf=$("#tdld-new");
  if(neuf){
    neuf.style.display="none";
    neuf.onclick=function(){S.creation=true;S.drawer=null;S.inline=null;renderStage();};
  }
  whenEco(function(){
    loadData();
    setInterval(tickRefresh,REFRESH_MS);
    if(window.TDLPoll)window.TDLPoll.suivre({
      node: CFG.NODE,
      occupe: function(){ return !!(S.drawer||S.inline||S.creation)||Date.now()-_lastWrite<3000; },
      onDonnees: function(raw){
        D=Object.keys(raw).map(function(id){var o=raw[id]||{};o.id=id;return normaliser(o);});
        D.sort(function(a,b){return (b.cree||"").localeCompare(a.cree||"");});
        fixSel();renderAll();
      }
    });
    setTimeout(function(){ if(neuf&&(peutOuvrir()||peutAppeler()))neuf.style.display=""; },1200);
  });
}

var mounted=false;
function boot(){
  if(mounted)return true;
  var bg=document.querySelector(".tdlm-bg");
  if(!bg||!document.querySelector("#tdld-stage"))return false;
  mounted=true;
  document.body.appendChild(bg);
  var st=document.createElement("style");
  st.textContent="html#min-width,body,#wrap,#sj-main{min-width:0!important} html,body{overflow-x:hidden!important}";
  document.head.appendChild(st);
  if(!document.querySelector("meta[name=viewport]")){var mv=document.createElement("meta");mv.name="viewport";mv.content="width=device-width, initial-scale=1";document.head.appendChild(mv);}
  initApp();
  return true;
}
var tries=0, iv=setInterval(function(){if(boot()||++tries>60)clearInterval(iv);},250);
window.addEventListener("load",boot);
if(document.readyState!=="loading")boot();

})();
