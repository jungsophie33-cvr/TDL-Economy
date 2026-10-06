/* ============================================================
   TDL — BANDES HORS-LA-LOI · ONGLET FAISEUSES D'ANGES
   (tdl-bohl-faiseuses.js) — à charger APRÈS tdl-bohl-core.js.
   Requiert aussi window.TDLBase (API des liens de réseau).

   [MAJ v2] LE RÉSEAU DE RESSOURCES PASSE AUX CLÉS.
     Chaque geste réécrivait le TABLEAU ENTIER des liens du membre :
     ecrireLiens(pseudo, arr) après un push, un Object.assign sur arr[idx], ou
     un splice(idx,1). Deux conséquences, toutes deux silencieuses.
     D'abord l'écrasement : un lien ajouté par un autre onglet entre notre
     lecture et notre écriture disparaissait. Ensuite, et c'est le pire, le
     RETRAIT PAR INDICE — splice décale tous les liens suivants, de sorte que
     la suppression d'après visait le mauvais contact. Un membre porte souvent
     plusieurs liens, dont certains appartiennent à la Main et non aux
     Faiseuses : le mauvais retrait traversait même les deux réseaux.
     Chaque lien porte désormais sa clé, et s'écrit seul :
       membres/{pseudo}/liens/{clé}
     La référence d'édition devient « pseudo\u0001clé » au lieu de
     « pseudo\u0001indice ».

   Structure plate : catégorie (Intervention médicale / Soutien psychologique),
   vocation (texte), année « depuis ». Hero partagé (core).
   Donnée : membres/{pseudo}.hors_la_loi = { bande:"faiseuses", categorie, vocation, depuis }.
   ============================================================ */
(function (BHL) {
  "use strict";
  var BANDE="faiseuses", CONF=window.BHL_CONFIG.bandes[BANDE], CATS=CONF.categories;
  var $=BHL.$, escH=BHL.escH, escA=BHL.escA, ini=BHL.initiales, vt=BHL.vt;
  var DISPO={ disponible:"Disponible", ponctuel:"Ponctuel", indisponible:"Indisponible" };

  var T = {
    membres:function(n){ return n+" membre"+(n>1?"s":""); },
        depuis:"Depuis", vocation:"Vocation", categorie:"Catégorie", membre:"Membre",
    reseau:"Réseau de ressources", tous:"Tous", contact:"Contact",
    activite:"Activité", apport:"Ce qu'il apporte au réseau", statut:"Disponibilité",
    reseauTxt:"Elles ne paient personne et ne sont payées par personne. Ce qu'elles ont, elles le doivent à ceux qui laissent une porte entrouverte \u2014 une pharmacie, un entrepôt, un nom murmuré au bon moment.",
    reseauVide:"Aucune ressource recensée pour cette disponibilité.",
    aConvertir:"Liens au format ancien — lancez la conversion (bouton staff).",
  };
  var edit = null;      // membre : null | "new" | pseudo
  var resEdit = null;   // ressource (lien) : null | "new" | "pseudo\u0001cle"
  var filtreRes = "tous";

  /* ---------- helpers ---------- */
  function badge(cat){
    var cls = cat==="psycho" ? "psycho" : "medicale";
    return '<span class="tdlb-fai-badge '+cls+'"><i class="fi '+(cat==="psycho"?"fi-tr-brain":"fi-tr-stethoscope")+'"></i>'+escH(CATS[cat]||"")+'</span>';
  }
  function optionsCat(sel){ return Object.keys(CATS).map(function(k){ return '<option value="'+k+'"'+(k===sel?" selected":"")+'>'+escH(CATS[k])+'</option>'; }).join(""); }
  function optionsMembres(sel){
    var pris={}; BHL.membresDeBande(BANDE).forEach(function(m){ pris[m.pseudo]=1; });
    return '<option value="">'+BHL.T.choisir+'</option>' + BHL.tousMembres().map(function(p){
      var deja = pris[p] && p!==sel;
      return '<option value="'+escA(p)+'"'+(p===sel?" selected":"")+'>'+escH(p)+(deja?" (déjà affiliée)":"")+'</option>';
    }).join("");
  }
     /* ---------- réseau de ressources (liens cumulables) ---------- */
  /* [MAJ v2] la clé du lien remplace son indice. TDLBase.liens lit les deux
     formats : un membre non converti reçoit des clés de substitution, qui
     servent à l'affichage mais jamais à une écriture — exigeCles() barre la
     route avant. */
  function tousReseau(){
    var ms=BHL.rec.membres||{}, out=[];
    Object.keys(ms).forEach(function(pseudo){
      var m=ms[pseudo]||{};
      window.TDLBase.liens(m).forEach(function(l){
        if(l.type==="reseau_faiseuses")
          out.push({ pseudo:pseudo, uid:m.uid||null, avatar:BHL.avatarDe(pseudo),
                     couleur:BHL.couleurGroupe(m.group), cle:l.k, lien:l });
      });
    });
    return out.sort(function(a,b){ return a.pseudo.localeCompare(b.pseudo,"fr"); });
  }
  /* un membre dont les liens sont encore un tableau n'accepte aucune écriture
     ciblée : un PATCH par clé sur une branche-tableau produirait un nœud bâtard */
  function exigeCles(pseudo){
    if(!window.TDLBase.liensAConvertir(BHL.rec.membres[pseudo])) return true;
    BHL.toast(T.aConvertir);
    return false;
  }
  /* [MAJ v2] un lien s'écrit SEUL : plus de réécriture du tableau du membre,
     donc plus d'écrasement d'un lien voisin ajouté entre-temps — y compris un
     lien de la Main, qui vit dans la même branche. */
  function majLien(pseudo, cle, lien){
    var m=BHL.rec.membres[pseudo]=BHL.rec.membres[pseudo]||{};
    m.liens=m.liens||{}; m.liens[cle]=lien;
    BHL.rendreOnglet();
    window.TDLBase.ecrireLien(pseudo, cle, lien).then(function(ok){ if(!ok) BHL.toast(BHL.T.errEcriture); });
  }
  function retirerLien(pseudo, cle){
    var m=BHL.rec.membres[pseudo]||{};
    if(m.liens) delete m.liens[cle];
    BHL.rendreOnglet();
    window.TDLBase.supprimerLien(pseudo, cle).then(function(ok){ if(!ok) BHL.toast(BHL.T.errEcriture); });
  }
  function optTousMembres(sel){
    return '<option value="">'+BHL.T.choisir+'</option>' + BHL.tousMembres().map(function(p){
      return '<option value="'+escA(p)+'"'+(p===sel?" selected":"")+'>'+escH(p)+'</option>';
    }).join("");
  }
  function optDispo(sel){
    return Object.keys(DISPO).map(function(k){
      return '<option value="'+k+'"'+(k===sel?" selected":"")+'>'+escH(DISPO[k])+'</option>';
    }).join("");
  }

  /* ---------- rendu ---------- */
  function stats(list){
    var nMed=list.filter(function(m){return m.hll.categorie==="medicale";}).length;
    var nPsy=list.filter(function(m){return m.hll.categorie==="psycho";}).length;
    return [
      { icon:"fi-tr-users-alt",   label:BHL.T.membres,  val:list.length },
      { icon:"fi-tr-stethoscope", label:CATS.medicale, val:nMed },
      { icon:"fi-tr-brain",       label:CATS.psycho,   val:nPsy },
      { icon:"fi-tr-share",       label:T.reseau,      val:tousReseau().length },
    ];
  }
  function carteHTML(m){
    if(edit===m.pseudo) return editeurHTML(m);
    var av = m.avatar ? '<img src="'+escA(m.avatar)+'" alt="">' : escH(ini(m.nom));
    var admin = BHL.S.admin
      ? '<div class="tdlb-card-actions"><button class="tdlb-ic" data-edit="'+escA(m.pseudo)+'" title="'+BHL.T.modifier+'"><i class="fi fi-tr-pencil"></i></button>'
        + '<button class="tdlb-ic" data-rm="'+escA(m.pseudo)+'" title="'+BHL.T.retirer+'"><i class="fi fi-tr-trash"></i></button></div>' : "";
    var lien = m.uid ? '<a class="tdlb-card-link" href="/u'+m.uid+'" title="Profil"><i class="fi fi-tr-arrow-up-right-from-square"></i></a>' : "";
    return '<article class="tdlb-fai-card">'+admin
      + '<div class="tdlb-fai-av" style="--gc:'+m.couleur+'">'+av+'</div>'
      + '<div class="tdlb-fai-nom">'+escH(m.nom)+lien+'</div>'
      + '<div class="tdlb-fai-voc">'+escH(m.hll.vocation||"—")+'</div>'
      + badge(m.hll.categorie)
      + '<div class="tdlb-fai-since"><i class="fi fi-tr-calendar"></i>'+escH(T.depuis)+' '+escH(m.hll.depuis||"—")+'</div>'
      + '</article>';
  }
  function editeurHTML(m){
    var neuf=!m;
    return '<article class="tdlb-fai-card editing">'
      + (neuf ? '<label>'+T.membre+'</label><select class="tdlb-in" data-f="pseudo">'+optionsMembres("")+'</select>'
              : '<div class="tdlb-fai-nom">'+escH(m.nom)+'</div>')
      + '<label>'+T.categorie+'</label><select class="tdlb-in" data-f="categorie">'+optionsCat(m?m.hll.categorie:"medicale")+'</select>'
      + '<label>'+T.vocation+'</label><input class="tdlb-in" data-f="vocation" value="'+escA(m?m.hll.vocation:"")+'" placeholder="Sage-femme, infirmier…">'
      + '<label>'+BHL.T.depuis+' (année)</label><input class="tdlb-in" data-f="depuis" value="'+escA(m?m.hll.depuis:"")+'" placeholder="2021">'
      + '<div class="tdlb-edit-btns"><button class="tdlb-btn prim" data-save="'+(neuf?"new":escA(m.pseudo))+'">'+BHL.T.enregistrer+'</button>'
      +   '<button class="tdlb-btn" data-cancel="1">'+BHL.T.annuler+'</button></div>'
      + '</article>';
  }

  function filtresRes(){
    var b='<button class="tdlb-main-rf'+(filtreRes==="tous"?" on":"")+'" data-rfiltre="tous">'+T.tous+'</button>';
    return b + Object.keys(DISPO).map(function(k){
      return '<button class="tdlb-main-rf'+(filtreRes===k?" on":"")+'" data-rfiltre="'+k+'">'+escH(DISPO[k])+'</button>';
    }).join("");
  }
  function resCard(p){
    var l=p.lien, key=p.pseudo+"\u0001"+p.cle;
    var st=l.statut||"disponible";
    var tag='<span class="tag-dispo '+escA(st)+'">'+escH(DISPO[st]||st)+'</span>';
    var ac = BHL.S.admin
      ? '<div class="actes"><button class="tdlb-ic" data-redit="'+escA(key)+'" title="'+BHL.T.modifier+'"><i class="fi fi-tr-pencil"></i></button>'
        + '<button class="tdlb-ic" data-rrm="'+escA(key)+'" title="'+BHL.T.retirer+'"><i class="fi fi-tr-trash"></i></button></div>' : "";
    var nom = escH(p.pseudo) + (l.activite?' <span class="tdlb-fai-act">'+escH(l.activite)+'</span>':'')
            + (p.uid?' <a class="tdlb-card-link" href="/u'+p.uid+'"><i class="fi fi-tr-arrow-up-right-from-square"></i></a>':'');
    return '<div class="tdlb-flo-pilier" style="--gc:'+p.couleur+'">'+ac
      + '<span class="av">'+(p.avatar?'<img src="'+escA(p.avatar)+'" alt="">':escH(ini(p.pseudo)))+'</span>'
      + '<div class="info"><span class="nom">'+nom+'</span>'
      +   '<span class="concours">'+escH(l.role||"—")+'</span>'
      +   '<div class="bas">'+tag+'</div>'
      + '</div></div>';
  }
  function reseauSection(){
    var res=tousReseau().filter(function(p){ return filtreRes==="tous" || (p.lien.statut||"disponible")===filtreRes; });
    return '<section class="tdlb-main-reseau">'
      + '<div class="tdlb-main-rhead"><div class="rleft">'
      +   '<div class="tdlb-main-h"><i class="fi fi-tr-share"></i><h3>'+escH(T.reseau)+'</h3></div>'
      +   '<p class="tdlb-main-desc">'+escH(T.reseauTxt)+'</p></div>'
      +   '<div class="tdlb-main-rfiltres">'+filtresRes()+'</div></div>'
      + (res.length?'<div class="tdlb-flo-pgrid tdlb-fai-rgrid">'+res.map(resCard).join("")+'</div>'
                   :'<div class="tdlb-empty">'+escH(T.reseauVide)+'</div>')
      + '</section>';
  }
  /* la recherche se fait désormais sur la CLÉ ; si le lien a disparu entre
     l'ouverture du formulaire et son rendu, on referme au lieu de planter */
  function resForm(ref){
    var neuf=(ref==="new"), p=null;
    if(!neuf){
      var parts=ref.split("\u0001");
      tousReseau().forEach(function(x){ if(x.pseudo===parts[0] && x.cle===parts[1]) p=x; });
      if(!p){ resEdit=null; return ""; }
    }
    var l=p?p.lien:{};
    return '<div class="tdlb-bra-form">'
      + (neuf ? '<div><label>'+T.contact+'</label><select class="tdlb-in" data-rf="pseudo">'+optTousMembres("")+'</select></div>'
              : '<div><label>'+T.contact+'</label><div class="fixe">'+escH(p.pseudo)+'</div></div>')
      + '<div><label>'+T.activite+'</label><input class="tdlb-in" data-rf="activite" value="'+escA(l.activite||"")+'" placeholder="Pharmacienne, chauffeur, aide-soignant…"></div>'
      + '<div><label>'+T.apport+'</label><input class="tdlb-in" data-rf="role" value="'+escA(l.role||"")+'" placeholder="Accès à la réserve, transport de nuit…"></div>'
      + '<div><label>'+T.statut+'</label><select class="tdlb-in" data-rf="statut">'+optDispo(l.statut||"disponible")+'</select></div>'
      + '<div class="btns"><button class="tdlb-btn prim" data-rsave="'+(neuf?"new":escA(ref))+'">'+BHL.T.enregistrer+'</button>'
      +   '<button class="tdlb-btn" data-rcancel="1">'+BHL.T.annuler+'</button></div></div>';
  }
   
  function render(host){
    var list=BHL.membresDeBande(BANDE);
    var cartes=list.map(carteHTML).join("");
    if(edit==="new") cartes = editeurHTML(null) + cartes;
    host.innerHTML = BHL.heroHTML(BANDE, { emblem:"fi-tr-hand-holding-heart", stats:stats(list) })
      + '<div class="tdlb-body">'
      +   (resEdit ? resForm(resEdit) : "")
      +   (cartes ? '<div class="tdlb-fai-grid">'+cartes+'</div>' : '<div class="tdlb-empty">'+BHL.T.vide+'</div>')
      +   reseauSection()
      + '</div>';
    brancher(host);
  }

  /* ---------- events ---------- */
  function lire(host){ var o={}; host.querySelectorAll(".editing [data-f]").forEach(function(el){ o[el.dataset.f]=el.value.trim(); }); return o; }
  function brancher(host){
    host.querySelectorAll("[data-edit]").forEach(function(b){ b.addEventListener("click", function(){ edit=b.dataset.edit; resEdit=null; BHL.rendreOnglet(); BHL.renderActionbar(); }); });    host.querySelectorAll("[data-rm]").forEach(function(b){ b.addEventListener("click", function(){ if(window.confirm(BHL.T.confirmRetrait(b.dataset.rm))) BHL.appliquer(b.dataset.rm, null); }); });
    host.querySelectorAll("[data-cancel]").forEach(function(b){ b.addEventListener("click", function(){ edit=null; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-save]").forEach(function(b){ b.addEventListener("click", function(){
      var v=lire(host), neuf=b.dataset.save==="new";
      var pseudo = neuf ? ((host.querySelector('[data-f="pseudo"]')||{}).value||"") : b.dataset.save;
      if(!pseudo || !v.categorie) return;
      edit=null;
      BHL.appliquer(pseudo, { bande:BANDE, categorie:v.categorie, vocation:v.vocation||"", depuis:v.depuis||"" });
    }); });
         host.querySelectorAll("[data-rfiltre]").forEach(function(b){ b.addEventListener("click", function(){ filtreRes=b.dataset.rfiltre; BHL.rendreOnglet(); }); });
    host.querySelectorAll("[data-redit]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); edit=null; resEdit=b.dataset.redit; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-rcancel]").forEach(function(b){ b.addEventListener("click", function(){ resEdit=null; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    /* [MAJ v2] le retrait vise une CLÉ : il ne peut plus décaler les liens
       suivants ni emporter un contact de la Main logé dans la même branche. */
    host.querySelectorAll("[data-rrm]").forEach(function(b){ b.addEventListener("click", function(e){
      e.preventDefault();
      var pr=b.dataset.rrm.split("\u0001"), pseudo=pr[0], cle=pr[1];
      if(!exigeCles(pseudo)) return;
      if(!window.confirm("Retirer "+pseudo+" du réseau des Faiseuses ?")) return;
      retirerLien(pseudo, cle);
    }); });
    host.querySelectorAll("[data-rsave]").forEach(function(b){ b.addEventListener("click", function(){
      var v={}; host.querySelectorAll(".tdlb-bra-form [data-rf]").forEach(function(el){ v[el.dataset.rf]=el.value.trim(); });
      if(b.dataset.rsave==="new"){
        var pseudo=(host.querySelector('[data-rf="pseudo"]')||{}).value||"";
        if(!pseudo || !v.role) return;
        if(!exigeCles(pseudo)) return;
        resEdit=null;
        majLien(pseudo, window.TDLBase.nouvelleCle(),
          { type:"reseau_faiseuses", categorie:"faiseuses", activite:v.activite||"",
            role:v.role, statut:v.statut||"disponible" });
      } else {
        var pp=b.dataset.rsave.split("\u0001"), ps=pp[0], cle=pp[1];
        if(!exigeCles(ps)) return;
        /* on repart du lien tel qu'il est en base : les champs qu'on n'édite
           pas ici (date, type…) ne doivent pas disparaître */
        var anc=((BHL.rec.membres[ps]||{}).liens||{})[cle];
        if(!anc){ BHL.toast("Ce contact n\u2019existe plus."); resEdit=null; BHL.rendreOnglet(); return; }
        resEdit=null;
        majLien(ps, cle, Object.assign({}, anc,
          { activite:v.activite||"", role:v.role, statut:v.statut||"disponible" }));
      }
      BHL.renderActionbar();
    }); });
  }

  // bouton « Ajouter un membre » dans la barre d'action staff
    function renderActions(bar){
    if(edit==="new"||resEdit) return;
    var b=document.createElement("button"); b.className="tdlb-btn add";
    b.innerHTML='<i class="fi fi-tr-plus"></i> '+BHL.T.ajouter;
    b.addEventListener("click", function(){ resEdit=null; edit="new"; BHL.rendreOnglet(); BHL.renderActionbar(); });
    bar.appendChild(b);
    var r=document.createElement("button"); r.className="tdlb-btn";
    r.innerHTML='<i class="fi fi-tr-share"></i> Ajouter une ressource';
    r.addEventListener("click", function(){ edit=null; resEdit="new"; BHL.rendreOnglet(); BHL.renderActionbar(); });
    bar.appendChild(r);
  }

  BHL.enregistrerOnglet(BANDE, { render:render, renderActions:renderActions });

})(window.BHL);
