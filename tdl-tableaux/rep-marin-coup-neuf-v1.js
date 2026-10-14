/* THE DROWNED LANDS — MISSIONS MARINGOUINS · OUVERTURE D'UN COUP
   (rep-mis-coup-neuf.js) — à charger APRÈS rep-mis-coup.js, dont il reprend
   les réglages et le champ de rôle par window.TDLMisCoup. Fichier séparé pour
   la seule raison que le moteur et le formulaire ensemble dépassaient les 500
   lignes.

   RIEN N'EST RETENU À L'OUVERTURE : un coup ne coûte rien à personne, tout est
   créé à la validation. Il n'y a donc aucune écriture compensée à prévoir ici,
   contrairement aux missions de cellule et aux chasses du Carrefour.
   ================================================================== */
(function(F,K){
"use strict";
if(!F||!K){ if(window.console) console.warn("[rep-mis-coup-neuf] socle ou type coup absent."); return; }
var esc=F.esc, escAttr=F.escAttr, $=F.$, S=F.S, toast=F.toast, TYPES=F.TYPES;
var CAMPS=K.CAMPS, champRole=K.champRole, MIN_ADV=K.MIN_ADV, MIN_ADV_ENV=K.MIN_ADV_ENV;
var N_OUVERT=K.N_OUVERT, patch=F.patch;

var NB_NEUF=2;
function formOuverture(){
  var me=F.myPseudo();
  var ts=TYPES.map(function(t){return '<option value="'+t.id+'">'+esc(t.label)+'</option>';}).join("");
  var cs='<option value="">Toutes les cellules</option>'+F.cellules().map(function(c){
    return '<option value="'+escAttr(c)+'"'+(c===F.celluleDe(me)?' selected':'')+'>'
      +esc(F.celluleLabel(c))+'</option>';
  }).join("");
  var rs=""; for(var i=0;i<NB_NEUF;i++)rs+=champRole(i,null);
  return '<div class="tdlm-dpanel">'
    +'<button class="tdlm-dret" data-neuf="cancel">\u2190 Retour à la liste</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">Organiser un coup</span></div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-drawer on" style="border-top:none">'
      +'<div class="tdlm-prose">Un coup se monte entre vous : personne ne le commandite et personne ne retient de prime. En échange, vous devez ouvrir le camp d\u2019en face au jeu \u2014 un rôle adverse au minimum, deux pour un coup d\u2019envergure. Sans quoi ce n\u2019est pas un coup, c\u2019est un RP entre soi.</div>'
      +'<label class="tdlm-fl">Titre</label><input type="text" id="tdlc-ntitre" placeholder="Ex. : Vider le hangar de la 57 avant l\u2019inventaire">'
      +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Nature</label><select id="tdlc-ntype">'+ts+'</select></div>'
      +'<div style="flex:1"><label class="tdlm-fl">S\u2019adresse à</label><select id="tdlc-ncell">'+cs+'</select></div></div>'
      +'<label class="tdlm-fl tdlm-chkline"><input type="checkbox" id="tdlc-nenv"> Coup d\u2019envergure \u2014 deux rôles adverses au minimum</label>'
      +'<div class="tdlm-prose tdlm-todo">Un coup adressé à toutes les cellules est d\u2019envergure par construction : la case se coche alors toute seule et ne se décoche plus.</div>'
      +'<label class="tdlm-fl">Objectif</label><textarea id="tdlc-nobj"></textarea>'
      +'<label class="tdlm-fl">Contraintes (une par ligne)</label><textarea id="tdlc-ncontr"></textarea>'
      +'<label class="tdlm-fl">Contexte</label><textarea id="tdlc-nctx"></textarea>'
      +'<label class="tdlm-fl tdlm-chkline"><input type="checkbox" id="tdlc-npc"> Je ne serai pas le chef du coup</label>'
      +'<div class="tdlm-prose tdlm-todo">Le rôle reviendra alors au premier Maringouin inscrit. Un créateur qui ne joue pas ne touche rien.</div>'
      +'<div class="tdlm-prose tdlm-todo">Sachez que tout coup peut cacher un infiltré : quelqu\u2019un qui travaille contre vous de l\u2019intérieur, pour la Main, pour la police, pour qui l\u2019emploie. Un extérieur comme un gars de la bande. Vous ne saurez jamais qui, ni même si quelqu\u2019un a été tiré \u2014 et c\u2019est ce qui en fait tout le sel.</div>'
      +'<div id="tdlc-newroles">'+rs+'</div>'
      +'<div class="tdlm-row"><button class="tdlm-abtn" data-neuf="plus">+ Un rôle de plus</button></div>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-neuf="ok">Afficher le coup</button>'
      +'<button class="tdlm-abtn" data-neuf="cancel">Annuler</button></div>'
    +'</div></div></div>';
}

function creer(){
  var g=function(id){var e=$(id);return e?String(e.value||"").trim():"";};
  var me=F.myPseudo();
  if(!me){toast("Connectez-vous.");return;}
  var titre=g("#tdlc-ntitre");
  if(!titre){toast("Donnez un titre au coup.");return;}
  var obj=g("#tdlc-nobj");
  if(!obj){toast("Écrivez l\u2019objectif : c\u2019est ce que les autres vont lire en premier.");return;}
  var cell=g("#tdlc-ncell");
  /* toutes les cellules = envergure, quoi qu'ait fait la case */
  var env=!cell||!!($("#tdlc-nenv")&&$("#tdlc-nenv").checked);
  var pasChef=!!($("#tdlc-npc")&&$("#tdlc-npc").checked);

  var rs={}, nadv=0, n=0, sceau=Date.now().toString(36).slice(-4);
  for(var i=0;i<NB_NEUF;i++){
    var it=g("#tdlc-ri"+i); if(!it)continue;
    var camp=(($("#tdlc-rc"+i)||{}).value||"adverse");
    var k="r"+n+sceau;
    rs[k]={k:k, ordre:n, intitule:it, camp:(CAMPS[camp]?camp:"adverse"),
      consigne:g("#tdlc-rs"+i), qui:null, date:""};
    if(rs[k].camp==="adverse")nadv++;
    n++;
  }
  var mini=env?MIN_ADV_ENV:MIN_ADV;
  if(nadv<mini){toast("Il faut "+mini+" rôle(s) du camp adverse au minimum.");return;}

  var chef=pasChef?null:(F.estMaringouin(me)?me:null);
  if(!pasChef&&!chef){toast("Seul un Maringouin peut être chef \u2014 cochez \u00ab je ne serai pas le chef \u00bb.");return;}
  var parts={}; if(chef)parts[F.cp(chef)]=chef;

  var id=F.newId("cp");
  var o={ genre:"coup", titre:titre, type:g("#tdlc-ntype")||"recuperation",
    createur:me, cellule:cell, envergure:env,
    objectif:obj, contexte:g("#tdlc-nctx"),
    contraintes:(($("#tdlc-ncontr")||{}).value||"").split("\n").map(function(x){return x.trim();}).filter(Boolean),
    roles:rs, chef:chef, statut:"en_attente",
    insCloses:false, tirageFait:false,
    topic:"", resume:"", consequences:"", demandeValidation:false,
    primeVersee:false, cree:new Date().toISOString() };
  if(chef)o.participants=parts;

  F.creerEntree(id, o, {}).then(function(ok){
    if(!ok){toast("Ouverture échouée.");return;}
    NB_NEUF=2; S.statut="tous"; S.sel=id;
    try{ if(window.EcoNotif) EcoNotif.bande("maringouins",N_OUVERT,{titre:titre,cellule:o.cellule||"toutes"},"cp"+id); }catch(e){}
    toast("Coup affiché. Il partira quand le camp d\u2019en face sera pourvu.");
    F.renderAll();
  });
}

F.vue({
  k:"nouveau-coup", label:"\u2691 Organiser un coup",
  visible:function(){return F.isStaff()||F.estMaringouin(F.myPseudo());},
  render:formOuverture,
  brancher:function(stage){
    var cel=stage.querySelector("#tdlc-ncell"), env=stage.querySelector("#tdlc-nenv");
    if(cel&&env){
      cel.onchange=function(){
        var toutes=!cel.value;
        if(toutes)env.checked=true;
        env.disabled=toutes;
      };
      cel.onchange();
    }
    stage.querySelectorAll("[data-neuf]").forEach(function(el){
      el.onclick=function(){
        var a=el.getAttribute("data-neuf");
        if(a==="ok"){creer();return;}
        if(a==="plus"){
          var box=stage.querySelector("#tdlc-newroles");
          if(box){box.insertAdjacentHTML("beforeend",champRole(NB_NEUF,null));NB_NEUF++;}
          return;
        }
        NB_NEUF=2; S.statut="tous"; F.renderAll();
      };
    });
  }
});


/* ---- édition par le chef ou le staff ---- */
function editer(m, NB_EDIT){
  var g=function(id){var e=$(id);return e?String(e.value||"").trim():"";};
  m.objectif=g("#tdlm-eobj");
  m.contraintes=(($("#tdlm-econtr")||{}).value||"").split("\n").map(function(x){return x.trim();}).filter(Boolean);
  m.contexte=g("#tdlm-ectx");
  var ch={objectif:m.objectif,contraintes:m.contraintes,contexte:m.contexte};
  var base=K.roles(m).length, sceau=Date.now().toString(36).slice(-4), n=0;
  for(var i=0;i<NB_EDIT;i++){
    var it=g("#tdlc-ri"+i); if(!it)continue;
    if(base+n>=K.MAX_ROLES){toast("Six rôles au maximum.");break;}
    var k="r"+(base+n)+sceau;
    var r={k:k, ordre:base+n, intitule:it, camp:(($("#tdlc-rc"+i)||{}).value||"adverse"),
      consigne:g("#tdlc-rs"+i), qui:null, date:""};
    ch["roles/"+k]=r; m.roles[k]=r; n++;
  }
  patch(m,ch); S.drawer=null;
  toast(n?(n+" rôle(s) ajouté(s)."):"Informations enregistrées.");
  F.renderAll();
}


/* ===================== GARNISSAGE DU TYPE ===================== */
K.editer=editer;

})(window.TDLMis, window.TDLMisCoup);
