/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU CARREFOUR · OUVERTURE D'UNE CHASSE
   (tdlc-chasse-neuf.js) — à charger APRÈS tdlc-chasse.js, dont il reprend les
   réglages par window.TDLCarrChasse. Fichier séparé pour la seule raison que
   le formulaire et le moteur ensemble dépassaient les 500 lignes.

   LE GEL. La prime entière est débitée du commanditaire à l'affichage, par
   debiterDollars, qui LÈVE si le compte ne couvre pas — jamais par un crédit
   négatif, qui plafonnerait à zéro et créerait la différence. Si l'écriture de
   l'entrée échoue ensuite, le gel est recrédité et l'écriture n'est PAS remise
   en file de réessai : elle recréerait la chasse après le recrédit.
   ================================================================== */
(function(F,K){
"use strict";
if(!F||!K){ if(window.console) console.warn("[tdlc-chasse-neuf] socle ou type chasse absent."); return; }
var esc=F.esc, money=F.money, $=F.$, S=F.S, toast=F.toast;
var PRIME_MIN=K.PRIME_MIN, ACCROCHES=K.ACCROCHES, T=K.T;

function champAccroche(i){
  return '<div class="tdlm-cadre"><div class="tdlm-cadre-hd"><span class="tdlm-hsec" style="margin:0">Indice '+(i+1)+'</span></div>'
    +'<label class="tdlm-fl">Un fait à découvrir</label><textarea id="tdlc-af'+i+'" placeholder="Le pick-up garé derrière la station a des plaques du Mississippi\u2026"></textarea>'
    +'<label class="tdlm-fl">Que faut-il faire pour l\u2019obtenir ?</label>'
    +'<input type="text" id="tdlc-ac'+i+'" placeholder="Interroger le gérant de la station, ou passer derrière le bâtiment de nuit\u2026"></div>';
}
function formOuverture(){
  var staff=F.isStaff(), me=F.myPseudo();
  var accs=""; for(var i=0;i<ACCROCHES;i++)accs+=champAccroche(i);
  return '<div class="tdlm-dpanel">'
    +'<button class="tdlm-dret" data-neuf="cancel">\u2190 Retour au tableau</button>'
    +'<div class="tdlm-dp-title"><span class="tdlm-type">Ouvrir une chasse à prime</span></div>'
    +'<div class="tdlm-dp-body"><div class="tdlm-drawer on" style="border-top:none">'
      +'<div class="tdlm-prose">'+esc(T.REGLE)+'</div>'
      +'<div class="tdlm-prose tdlm-todo">'+esc(T.REFERENT)+'</div>'
      +'<label class="tdlm-fl">Titre</label><input type="text" id="tdlc-ntitre" placeholder="Ex. : Dernier signalement">'
      +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Zone</label>'
      +'<input type="text" id="tdlc-nzone" placeholder="Bas de la paroisse, routes de Montegut\u2026"></div>'
      +'<div style="flex:1"><label class="tdlm-fl">Prime ('+PRIME_MIN+' $ minimum)</label>'
      +'<input type="text" id="tdlc-nprime" value="'+PRIME_MIN+'"></div></div>'
      +'<label class="tdlm-fl">Qui ou quoi est recherché</label>'
      +'<input type="text" id="tdlc-ncible" placeholder="Un homme signalé près d\u2019un ancien débarcadère\u2026">'
      +(staff?('<label class="tdlm-fl tdlm-chkline"><input type="checkbox" id="tdlc-ninst"> Le commanditaire est une institution (l\u2019argent est créé)</label>'
        +'<div class="tdlm-row"><div style="flex:1"><label class="tdlm-fl">Nom affiché</label>'
        +'<input type="text" id="tdlc-ninstnom" placeholder="Bureau du shérif, la Main, les Dumas\u2026"></div>'
        +'<div style="flex:1"><label class="tdlm-fl">Affaire rattachée (facultatif)</label>'
        +'<input type="text" id="tdlc-naffaire" placeholder="Référence de l\u2019enquête\u2026"></div></div>'):'')
      +'<label class="tdlm-fl">Ce que tout le monde sait</label><textarea id="tdlc-nctx"></textarea>'
      +'<label class="tdlm-fl">Ce qui compte comme résultat obtenu</label><textarea id="tdlc-ncond"></textarea>'
      +'<div class="tdlm-prose">Les trois indices ci-dessous sont facultatifs, invisibles de tous sauf de vous et du staff. Les remplir vous engage à suivre votre affaire, et vous rend la moitié de la prime à la clôture.</div>'
      +accs
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-neuf="ok">Afficher la chasse</button>'
      +'<button class="tdlm-abtn" data-neuf="cancel">Annuler</button></div>'
      +(me?'<div class="tdlm-prose tdlm-todo">Votre solde : '+money(F.solde(me))+'</div>':'')
    +'</div></div></div>';
}

function creer(){
  var g=function(id){var e=$(id);return e?String(e.value||"").trim():"";};
  var me=F.myPseudo(), staff=F.isStaff();
  if(!me){toast("Connectez-vous.");return;}
  var titre=g("#tdlc-ntitre");
  if(!titre){toast("Donnez un titre à la chasse.");return;}
  var prime=Math.round(+g("#tdlc-nprime")||0);
  if(prime<PRIME_MIN){toast("La prime ne peut pas descendre sous "+money(PRIME_MIN)+".");return;}
  var inst=(staff&&$("#tdlc-ninst")&&$("#tdlc-ninst").checked)?g("#tdlc-ninstnom"):"";
  if(staff&&$("#tdlc-ninst")&&$("#tdlc-ninst").checked&&!inst){toast("Nommez l\u2019institution.");return;}

  var accs={}, n=0, sceau=Date.now().toString(36).slice(-4);
  for(var i=0;i<ACCROCHES;i++){
    var fait=g("#tdlc-af"+i); if(!fait)continue;
    var k="a"+i+sceau;
    accs[k]={k:k, ordre:i, fait:fait, condition:g("#tdlc-ac"+i), ouverte:false, par:"", date:""};
    n++;
  }
  var complet=(n>=ACCROCHES);
  var gel=inst?0:prime;
  if(!inst&&F.solde(me)<prime){toast("Votre solde ne couvre pas la prime ("+money(prime)+").");return;}

  var id=F.newId("ch");
  var fiche={ type:"chasse", titre:titre, zone:g("#tdlc-nzone"), auteur:me,
    institution:inst, affaire:staff?g("#tdlc-naffaire"):"",
    cible:g("#tdlc-ncible"), prime:prime, gel:gel, aAccroches:complet, ouvertes:0,
    participants:{}, inscriptionsCloses:false, tirageFait:false,
    livree:false, demasque:false, motif:"", justif:"", resume:"",
    primeVersee:false, statut:"ouverte", sujet:"", cree:new Date().toISOString() };
  var texte={ contexte:g("#tdlc-nctx"), conditions:g("#tdlc-ncond") };
  var prive=n?{accroches:accs}:{};

  var geler=gel?F.debiter(me,gel):Promise.resolve();
  Promise.resolve(geler).then(function(){
    return F.creerEntree(id, fiche, texte, prive);
  }).then(function(ok){
    if(!ok){
      /* écriture compensée : le gel est rendu, et surtout PAS remis dans la file
         de réessai, qui recréerait l'entrée après le recrédit */
      if(gel)F.crediter(me,gel);
      toast("Ouverture échouée \u2014 votre prime vous est rendue.");
      return;
    }
    S.statut="tous"; S.sel=id;
    try{if(window.EcoNotif)EcoNotif.tous(201,{titre:titre,prime:prime},"ch"+id);}catch(e){}
    toast("Chasse affichée."+(gel?(" "+money(gel)+" immobilisés."):""));
    F.renderAll();
  }).catch(function(){
    toast("Fonds insuffisants \u2014 la chasse n\u2019a pas été affichée.");
  });
}

F.vue({
  k:"nouvelle-chasse", label:"\u2691 Ouvrir une chasse",
  visible:function(){return F.estConnecte();},
  compte:function(){return null;},
  render:formOuverture,
  brancher:function(stage){
    stage.querySelectorAll("[data-neuf]").forEach(function(el){
      el.onclick=function(){
        if(el.getAttribute("data-neuf")==="ok")creer();
        else {S.statut="tous";F.renderAll();}
      };
    });
  }
});


})(window.TDLCarr, window.TDLCarrChasse);
