/* ============================================================
   TDL — BANDES HORS-LA-LOI · ONGLET FAISEUSES D'ANGES
   (tdl-bohl-faiseuses.js) — à charger APRÈS tdl-bohl-core.js.

   Structure plate : catégorie (Intervention médicale / Soutien psychologique),
   vocation (texte), année « depuis ». Hero partagé (core).
   Donnée : membres/{pseudo}.hors_la_loi = { bande:"faiseuses", categorie, vocation, depuis }.
   ============================================================ */
(function (BHL) {
  "use strict";
  var BANDE="faiseuses", CONF=window.BHL_CONFIG.bandes[BANDE], CATS=CONF.categories;
  var $=BHL.$, escH=BHL.escH, escA=BHL.escA, ini=BHL.initiales;

  var T = {
    membres:function(n){ return n+" membre"+(n>1?"s":""); },
    depuis:"Depuis", vocation:"Vocation", categorie:"Catégorie", membre:"Membre",
  };
  var edit = null;   // null | "new" | pseudo

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

  /* ---------- rendu ---------- */
  function stats(list){
    var nMed=list.filter(function(m){return m.hll.categorie==="medicale";}).length;
    var nPsy=list.filter(function(m){return m.hll.categorie==="psycho";}).length;
    return [
      { icon:"fi-tr-users-alt",   label:BHL.T.membres,  val:list.length },
      { icon:"fi-tr-stethoscope", label:CATS.medicale, val:nMed },
      { icon:"fi-tr-brain",       label:CATS.psycho,   val:nPsy },
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

  function render(host){
    var list=BHL.membresDeBande(BANDE);
    var cartes=list.map(carteHTML).join("");
    if(edit==="new") cartes = editeurHTML(null) + cartes;
    host.innerHTML = BHL.heroHTML(BANDE, { emblem:"fi-tr-hand-holding-heart", stats:stats(list) })
      + '<div class="tdlb-body">'
      +   (cartes ? '<div class="tdlb-fai-grid">'+cartes+'</div>' : '<div class="tdlb-empty">'+BHL.T.vide+'</div>')
      + '</div>';
    brancher(host);
  }

  /* ---------- events ---------- */
  function lire(host){ var o={}; host.querySelectorAll(".editing [data-f]").forEach(function(el){ o[el.dataset.f]=el.value.trim(); }); return o; }
  function brancher(host){
    host.querySelectorAll("[data-edit]").forEach(function(b){ b.addEventListener("click", function(){ edit=b.dataset.edit; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-rm]").forEach(function(b){ b.addEventListener("click", function(){ if(window.confirm(BHL.T.confirmRetrait(b.dataset.rm))) BHL.appliquer(b.dataset.rm, null); }); });
    host.querySelectorAll("[data-cancel]").forEach(function(b){ b.addEventListener("click", function(){ edit=null; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-save]").forEach(function(b){ b.addEventListener("click", function(){
      var v=lire(host), neuf=b.dataset.save==="new";
      var pseudo = neuf ? ((host.querySelector('[data-f="pseudo"]')||{}).value||"") : b.dataset.save;
      if(!pseudo || !v.categorie) return;
      edit=null;
      BHL.appliquer(pseudo, { bande:BANDE, categorie:v.categorie, vocation:v.vocation||"", depuis:v.depuis||"" });
    }); });
  }

  // bouton « Ajouter un membre » dans la barre d'action staff
  function renderActions(bar){
    if(edit==="new") return;
    var b=document.createElement("button"); b.className="tdlb-btn add";
    b.innerHTML='<i class="fi fi-tr-plus"></i> '+BHL.T.ajouter;
    b.addEventListener("click", function(){ edit="new"; BHL.rendreOnglet(); BHL.renderActionbar(); });
    bar.appendChild(b);
  }

  BHL.enregistrerOnglet(BANDE, { render:render, renderActions:renderActions });

})(window.BHL);
