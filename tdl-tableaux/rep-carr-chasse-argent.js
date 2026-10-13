/* ==================================================================
   THE DROWNED LANDS — TABLEAU DU CARREFOUR · ARGENT DES CHASSES
   (tdlc-chasse-argent.js) — à charger APRÈS tdlc-chasse.js, dont il reprend
   les réglages par window.TDLCarrChasse, et qu'il garnit en retour de
   rendreGel() et regler(). Fichier séparé pour la seule raison que le moteur,
   le formulaire et les versements ensemble dépassaient les 500 lignes.

   TOUT CE QUI DÉPLACE DE L'ARGENT EST ICI : l'immobilisation à l'ouverture, la
   restitution, et le règlement en quatre branches.

   L'IMMOBILISATION. Un particulier paie de sa poche, par debiterDollars, qui
   LÈVE si le compte ne couvre pas — jamais par un crédit négatif, qui
   plafonnerait à zéro et créerait la différence. La Main paie sur sa cagnotte,
   par une transaction qui lève CAG si elle est à sec. Les institutions ne
   paient rien : l'argent est créé au versement.
   Si l'écriture de l'entrée échoue ensuite, la somme est rendue et l'écriture
   n'est PAS remise en file de réessai : elle recréerait la chasse après coup.
   ================================================================== */
(function(F,K){
"use strict";
if(!F||!K){ if(window.console) console.warn("[tdlc-chasse-argent] socle ou type chasse absent."); return; }
var esc=F.esc, escAttr=F.escAttr, money=F.money, $=F.$, S=F.S, toast=F.toast, patch=F.patch;
var PRIME_MIN=K.PRIME_MIN, ACCROCHES=K.ACCROCHES, T=K.T, SOURCES=K.SOURCES;

/* ---- règlement ----
   Verrou AVANT tout mouvement. COMPROMIS ASSUMÉ, le même que partout ailleurs :
   si un crédit échoue après la prise du verrou, la chasse reste marquée réglée
   sans que l'argent ait bougé — c'est visible et le staff le reprend à la main,
   alors qu'un double versement serait silencieux. */
function rendreGel(m){
  if(!m.gel||m.primeVersee)return Promise.resolve(false);
  return F.verrou(F.cheminEntree(m)+"/primeVersee").then(function(){
    m.primeVersee=true;
    return K.rembourser(m, m.gel);
  }).then(function(){
    patch(m,{primeVersee:true});
    try{if(window.EcoNotif&&m.source!=="main")EcoNotif.a(m.auteur,208,{titre:m.titre,montant:m.gel},"deg"+m.id);}catch(e){}
    return true;
  }).catch(function(e){
    if(F.estDeja(e)){m.primeVersee=true;return false;}
    toast("La restitution a échoué \u2014 vérifiez le solde ou la cagnotte.");
    return false;
  });
}

function regler(m){
  if(m.primeVersee){toast("Chasse déjà réglée.");return;}
  if(!F.exigeV2(m))return;
  var pv=F.prv(m);
  if(pv===null){toast("Lecture du privé en cours, réessayez dans un instant.");return;}
  var livree=!!($("#tdlc-livree")&&$("#tdlc-livree").checked);
  var motif=($("#tdlc-motif")&&$("#tdlc-motif").value)||"";
  var justif=($("#tdlc-justif")&&String($("#tdlc-justif").value||"").trim())||"";
  var resume=($("#tdlc-resume")&&String($("#tdlc-resume").value||"").trim())||"";
  var moitie=!!($("#tdlc-moitie")&&$("#tdlc-moitie").checked);
  var demasque=!!motif;
  if(demasque&&!justif){toast("Dites sur quoi vous vous appuyez pour le démasquage.");return;}

  var joues=[];
  document.querySelectorAll(".tdlc-joue").forEach(function(el){
    if(el.checked)joues.push(el.getAttribute("data-p"));
  });
  var antago=pv.antago||"";
  var benef=joues.filter(function(p){ return !(demasque&&antago&&p===antago); });
  var part=benef.length?Math.floor(m.prime/benef.length):0;
  var rendu=(m.gel&&moitie)?Math.floor(m.prime/2):0;
  var gain75=Math.floor(m.prime*K.PART_ANTAGO);

  var recap=livree
    ? (benef.length+" participant(s) à "+money(part)+(rendu?(", "+money(rendu)+" rendus à "+K.aQui(m)):"")+".")
    : ((m.gel?money(m.gel)+" rendus à "+K.aQui(m)+". ":"")+((!demasque&&antago)?(money(gain75)+" à l\u2019antagoniste."):"Personne n\u2019est payé."));
  if(!window.confirm("Clore et payer ?\n"+recap+"\nIrréversible."))return;

  F.verrou(F.cheminEntree(m)+"/primeVersee").then(function(){
    m.primeVersee=true;
    var op=Promise.resolve();
    if(livree){
      benef.forEach(function(p){ op=op.then(function(){return F.crediter(p, part);}); });
      if(rendu)op=op.then(function(){return K.rembourser(m, rendu);});
    }else{
      if(m.gel)op=op.then(function(){return K.rembourser(m, m.gel);});
      if(!demasque&&antago)op=op.then(function(){return F.crediter(antago, gain75);});
    }
    return op;
  }).then(function(){
    var ch={statut:"close", primeVersee:true, livree:livree, demasque:demasque,
            motif:motif, justif:justif, resume:resume};
    joues.forEach(function(p){ ch["participants/"+F.cp(p)+"/joue"]=true; });
    m.statut="close"; m.livree=livree; m.demasque=demasque; m.resume=resume;
    patch(m,ch);
    try{
      if(window.EcoNotif)joues.forEach(function(p){
        EcoNotif.a(p,206,{titre:m.titre},"reg"+m.id+F.cp(p));
      });
    }catch(e){}
    S.drawer=null;
    toast("Chasse close. "+recap);
    F.renderAll();
  }).catch(function(e){
    if(F.estDeja(e)){m.primeVersee=true;toast("Chasse déjà réglée ailleurs \u2014 rien n\u2019a été versé deux fois.");F.renderAll();return;}
    toast("Versement incomplet \u2014 la chasse est marquée réglée, vérifiez les soldes.");
    F.renderAll();
  });
}


/* ===================== OUVERTURE ===================== */
/* Les indices sont trois au minimum, et autant de plus qu'on veut : le bouton
   en ajoute un à la volée, et creer() balaie tous ceux qui existent. */
var NB_IND=ACCROCHES;

function champAccroche(i){
  return '<div class="tdlm-cadre" data-ind="'+i+'"><div class="tdlm-cadre-hd">'
    +'<span class="tdlm-hsec" style="margin:0">Indice '+(i+1)+'</span>'
    +(i>=ACCROCHES?'<span class="tdlm-todo">en plus</span>':'')+'</div>'
    +'<label class="tdlm-fl">Un fait à découvrir</label>'
    +'<textarea id="tdlc-af'+i+'" placeholder="Le pick-up garé derrière la station a des plaques du Mississippi\u2026"></textarea>'
    +'<label class="tdlm-fl">Que faut-il faire pour l\u2019obtenir ?</label>'
    +'<input type="text" id="tdlc-ac'+i+'" placeholder="Interroger le gérant de la station, ou passer derrière le bâtiment de nuit\u2026"></div>';
}

/* Qui a le droit de choisir autre chose que « un particulier » : le staff pour
   tout, un membre de la Main pour sa cagnotte. */
function sourcesOuvertes(){
  var me=F.myPseudo(), out=["joueur"];
  if(F.isStaff())return ["joueur","main","sherif","autre"];
  if(me&&F.bandeDe(me)==="main")out.push("main");
  return out;
}

function formOuverture(){
  var me=F.myPseudo(), dispo=sourcesOuvertes();
  var accs=""; for(var i=0;i<NB_IND;i++)accs+=champAccroche(i);
  var opts=dispo.map(function(k){
    return '<option value="'+k+'">'+esc(SOURCES[k].label)+'</option>';
  }).join("");
  var choixSource=(dispo.length>1)
    ? ('<label class="tdlm-fl">Qui commandite</label><select id="tdlc-nsrc">'+opts+'</select>'
       +'<div class="tdlm-prose tdlm-todo">Un particulier et la Main immobilisent la somme (poche ou cagnotte) et la récupèrent si la chasse échoue. Une institution ne paie rien d\u2019avance, et n\u2019ouvre pas droit à la moitié rendue.</div>')
    : '<input type="hidden" id="tdlc-nsrc" value="joueur">';

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
      +choixSource
      +'<label class="tdlm-fl">Nom affiché (facultatif)</label>'
      +'<input type="text" id="tdlc-naff" placeholder="Laissez vide pour afficher votre pseudo, ou écrivez le nom sous lequel la chasse circule\u2026">'
      +'<div id="tdlc-naffwrap" style="display:none"><label class="tdlm-fl">Affaire rattachée</label>'
      +'<select id="tdlc-naffaire"><option value="">\u2014 aucune \u2014</option></select></div>'
      +'<label class="tdlm-fl">Qui ou quoi est recherché</label>'
      +'<input type="text" id="tdlc-ncible" placeholder="Un homme signalé près d\u2019un ancien débarcadère\u2026">'
      +'<label class="tdlm-fl">Contexte connu</label><textarea id="tdlc-nctx"></textarea>'
      +'<label class="tdlm-fl">Ce que vous attendez exactement</label><textarea id="tdlc-ncond"></textarea>'
      +'<div class="tdlm-prose tdlm-todo">À quoi reconnaîtrez-vous que le contrat est rempli ? Savoir où elle se trouve suffit-il, ou faut-il vous l\u2019amener ? Vivante ? Un objet rapporté, une preuve, un nom ? C\u2019est cette phrase que le staff lira pour trancher à la clôture.</div>'
      +'<div class="tdlm-prose">Les '+ACCROCHES+' indices ci-dessous sont facultatifs, invisibles de tous sauf de vous et du staff. Les remplir vous engage à suivre votre affaire, et vous rend la moitié de la prime à la clôture. Vous pouvez en ajouter autant que vous voulez.</div>'
      +'<div id="tdlc-inds">'+accs+'</div>'
      +'<div class="tdlm-row"><button class="tdlm-abtn" data-neuf="plus">+ Ajouter un indice</button></div>'
      +'<div class="tdlm-row"><button class="tdlm-abtn prim" data-neuf="ok">Afficher la chasse</button>'
      +'<button class="tdlm-abtn" data-neuf="cancel">Annuler</button></div>'
      +(me?'<div class="tdlm-prose tdlm-todo">Votre solde : '+money(F.solde(me))+'</div>':'')
    +'</div></div></div>';
}

/* La liste des affaires n'est lue QUE si le shérif est choisi, et une seule
   fois : le nœud des enquêtes est gros, il n'a rien à faire dans le coût
   d'ouverture du tableau. */
var AFFAIRES=null;
function remplirAffaires(sel){
  if(AFFAIRES){ poser(sel); return; }
  Promise.resolve(window.EcoCore.firebaseGet("enquetes")).then(function(raw){
    AFFAIRES=[];
    Object.keys(raw||{}).forEach(function(id){
      var a=raw[id]||{};
      if(a.cloturee)return;
      AFFAIRES.push({id:id, lib:((a.cote?a.cote+" \u2014 ":"")+(a.titre||id))});
    });
    AFFAIRES.sort(function(x,y){return x.lib.localeCompare(y.lib);});
    poser(sel);
  }).catch(function(){ AFFAIRES=[]; poser(sel); });
  function poser(s){
    if(!s)return;
    s.innerHTML='<option value="">\u2014 aucune \u2014</option>'+AFFAIRES.map(function(a){
      return '<option value="'+escAttr(a.lib)+'">'+esc(a.lib)+'</option>';
    }).join("");
  }
}

function creer(){
  var g=function(id){var e=$(id);return e?String(e.value||"").trim():"";};
  var me=F.myPseudo();
  if(!me){toast("Connectez-vous.");return;}
  var titre=g("#tdlc-ntitre");
  if(!titre){toast("Donnez un titre à la chasse.");return;}
  var prime=Math.round(+g("#tdlc-nprime")||0);
  if(prime<PRIME_MIN){toast("La prime ne peut pas descendre sous "+money(PRIME_MIN)+".");return;}
  var src=g("#tdlc-nsrc")||"joueur";
  if(!SOURCES[src]||sourcesOuvertes().indexOf(src)<0){toast("Commanditaire non autorisé.");return;}
  var aff=g("#tdlc-naff");
  if(src==="main"&&!aff)aff=SOURCES.main.label;
  if(src==="sherif"&&!aff)aff=SOURCES.sherif.label;
  if(src==="autre"&&!aff){toast("Nommez l\u2019institution qui commandite.");return;}

  var accs={}, n=0, sceau=Date.now().toString(36).slice(-4);
  for(var i=0;i<NB_IND;i++){
    var fait=g("#tdlc-af"+i); if(!fait)continue;
    var k="a"+i+sceau;
    accs[k]={k:k, ordre:i, fait:fait, condition:g("#tdlc-ac"+i), ouverte:false, par:"", date:""};
    n++;
  }
  var complet=(n>=ACCROCHES);
  var gel=SOURCES[src].gel?prime:0;
  if(src==="joueur"&&gel&&F.solde(me)<prime){toast("Votre solde ne couvre pas la prime ("+money(prime)+").");return;}

  var id=F.newId("ch");
  var fiche={ type:"chasse", titre:titre, zone:g("#tdlc-nzone"), auteur:me,
    source:src, affiche:aff, affaire:(src==="sherif")?g("#tdlc-naffaire"):"",
    cible:g("#tdlc-ncible"), prime:prime, gel:gel, aAccroches:complet, ouvertes:0,
    participants:{}, inscriptionsCloses:false, tirageFait:false,
    livree:false, demasque:false, motif:"", justif:"", resume:"",
    primeVersee:false, statut:"ouverte", sujet:"", cree:new Date().toISOString() };
  var texte={ contexte:g("#tdlc-nctx"), conditions:g("#tdlc-ncond") };
  var prive=n?{accroches:accs}:{};

  immobiliser(me, src, gel).then(function(){
    return F.creerEntree(id, fiche, texte, prive);
  }).then(function(ok){
    if(!ok){
      /* écriture compensée : la somme est rendue, et surtout PAS remise dans la
         file de réessai, qui recréerait l'entrée après le recrédit */
      if(gel)K.rembourser(fiche, gel);
      toast("Ouverture échouée \u2014 la somme immobilisée est rendue.");
      return;
    }
    S.statut="tous"; S.sel=id;
    try{if(window.EcoNotif)EcoNotif.tous(201,{titre:titre,prime:prime},"ch"+id);}catch(e){}
    toast("Chasse affichée."+(gel?(" "+money(gel)+" immobilisés."):""));
    F.renderAll();
  }).catch(function(e){
    if(e&&e.message==="CAG"){toast("La cagnotte "+K.CAGNOTTE_MAIN+" ne couvre pas cette prime.");return;}
    toast("Fonds insuffisants \u2014 la chasse n\u2019a pas été affichée.");
  });
}

function immobiliser(me, src, gel){
  if(!gel)return Promise.resolve();
  if(src==="main"){
    return Promise.resolve(window.EcoCore.firebaseTransaction(
      K.NODE_CAGNOTTES+"/"+encodeURIComponent(K.CAGNOTTE_MAIN),
      function(cur){ var c=cur||0; if(c<gel)throw new Error("CAG"); return c-gel; }));
  }
  return F.debiter(me, gel);
}

F.vue({
  k:"nouvelle-chasse", label:"\u2691 Ouvrir une chasse",
  visible:function(){return F.estConnecte();},
  compte:function(){return null;},
  render:formOuverture,
  brancher:function(stage){
    stage.querySelectorAll("[data-neuf]").forEach(function(el){
      el.onclick=function(){
        var a=el.getAttribute("data-neuf");
        if(a==="ok"){creer();return;}
        if(a==="plus"){
          var box=stage.querySelector("#tdlc-inds");
          if(box){ box.insertAdjacentHTML("beforeend", champAccroche(NB_IND)); NB_IND++; }
          return;
        }
        NB_IND=ACCROCHES; S.statut="tous"; F.renderAll();
      };
    });
    var src=stage.querySelector("#tdlc-nsrc");
    if(src&&src.tagName==="SELECT"){
      src.onchange=function(){
        var wrap=stage.querySelector("#tdlc-naffwrap");
        var on=(src.value==="sherif");
        if(wrap)wrap.style.display=on?"":"none";
        if(on)remplirAffaires(stage.querySelector("#tdlc-naffaire"));
      };
      src.onchange();
    }
  }
});

/* ===================== GARNISSAGE DU TYPE ===================== */
K.rendreGel=rendreGel;
K.regler=regler;

})(window.TDLCarr, window.TDLCarrChasse);
