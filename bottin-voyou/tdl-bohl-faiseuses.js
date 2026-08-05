/* ============================================================
   TDL — BANDES HORS-LA-LOI · ONGLET FAISEUSES D'ANGES
   (tdl-bohl-faiseuses.js) — à charger APRÈS tdl-bohl-core.js.

   Structure plate : chaque membre a une catégorie (Intervention médicale /
   Soutien psychologique), une vocation (texte) et une année « depuis ».
   Donnée : membres/{pseudo}.hors_la_loi = { bande:"faiseuses", categorie, vocation, depuis }.
   ============================================================ */
(function (BHL) {
  "use strict";
  var BANDE = "faiseuses";
  var CONF  = window.BHL_CONFIG.bandes[BANDE];
  var CATS  = CONF.categories;                    // { medicale:"…", psycho:"…" }
  var $=BHL.$, escH=BHL.escH, escA=BHL.escA, ini=BHL.initiales;

  var T = {
    hero1:"Elles soignent, elles écoutent, elles accompagnent.",
    hero2:"Dans l'ombre, elles pansent les corps, recousent les âmes et offrent une issue là où d'autres n'en voient plus.",
    hero3:"Aucune ne pose de questions. Toutes méritent confiance.",
    quote:"Il n'y a pas de plus grand soin que celui donné sans attendre rien en retour.",
    actives:function(n){ return n+" membre"+(n>1?"s actives":" active"); },
    sousActives:"Chacune suit sa vocation. Ensemble, elles veillent sur ceux que le Bayou n'épargne pas.",
    pied:"Le Bayou guérit ceux qui savent tendre la main sans jamais chercher à se faire voir.",
    depuis:"Faiseuse depuis", vocation:"Vocation", categorie:"Catégorie", membre:"Membre",
  };

  // état local d'édition : null | "new" | pseudo
  var edit = null;

  /* ---------- helpers ---------- */
  function badge(catCle){
    var cls = catCle==="psycho" ? "psycho" : "medicale";
    return '<span class="tdlb-fai-badge '+cls+'"><i class="fi '+(catCle==="psycho"?"fi-tr-brain":"fi-tr-stethoscope")+'"></i>'+escH(CATS[catCle]||"")+'</span>';
  }
  function optionsCat(sel){
    return Object.keys(CATS).map(function(k){
      return '<option value="'+k+'"'+(k===sel?" selected":"")+'>'+escH(CATS[k])+'</option>';
    }).join("");
  }
  function optionsMembres(sel){
    var pris = {}; BHL.membresDeBande(BANDE).forEach(function(m){ pris[m.pseudo]=1; });
    return '<option value="">'+BHL.T.choisir+'</option>' + BHL.tousMembres().map(function(p){
      return '<option value="'+escA(p)+'"'+(p===sel?" selected":"")+(pris[p]&&p!==sel?" data-pris=1":"")+'>'+escH(p)+(pris[p]&&p!==sel?" (déjà affiliée)":"")+'</option>';
    }).join("");
  }

  /* ---------- rendu ---------- */
  function heroHTML(list){
    var nMed = list.filter(function(m){return m.hll.categorie==="medicale";}).length;
    var nPsy = list.filter(function(m){return m.hll.categorie==="psycho";}).length;
    return '<div class="tdlb-hero">'
      + '<div class="tdlb-hero-emblem"><i class="fi fi-tr-hand-holding-heart"></i></div>'
      + '<div class="tdlb-hero-main"><h2>'+escH(CONF.nom)+'</h2>'
      +   '<div class="tdlb-hero-devise">'+escH(CONF.devise)+'</div>'
      +   '<p>'+escH(T.hero1)+'<br>'+escH(T.hero2)+'<br>'+escH(T.hero3)+'</p></div>'
      + '<div class="tdlb-hero-stats">'
      +   '<div class="st"><i class="fi fi-tr-users-alt"></i><span>'+BHL.T.membres+'</span><b>'+list.length+'</b></div>'
      +   '<div class="st"><i class="fi fi-tr-stethoscope"></i><span>'+escH(CATS.medicale)+'</span><b>'+nMed+'</b></div>'
      +   '<div class="st"><i class="fi fi-tr-brain"></i><span>'+escH(CATS.psycho)+'</span><b>'+nPsy+'</b></div>'
      +   '<div class="tdlb-hero-quote">« '+escH(T.quote)+' »</div>'
      + '</div></div>';
  }

  function carteHTML(m){
    if(edit===m.pseudo) return editeurHTML(m);
    var av = m.avatar ? '<img src="'+escA(m.avatar)+'" alt="">' : escH(ini(m.nom));
    var admin = BHL.S.admin
      ? '<div class="tdlb-card-actions"><button class="tdlb-ic" data-edit="'+escA(m.pseudo)+'" title="'+BHL.T.modifier+'"><i class="fi fi-tr-pencil"></i></button>'
        + '<button class="tdlb-ic" data-rm="'+escA(m.pseudo)+'" title="'+BHL.T.retirer+'"><i class="fi fi-tr-trash"></i></button></div>' : "";
    var lien = m.uid ? '<a class="tdlb-card-link" href="/u'+m.uid+'" title="Profil"><i class="fi fi-tr-arrow-up-right-from-square"></i></a>' : "";
    return '<article class="tdlb-fai-card">'+admin
      + '<div class="tdlb-fai-av">'+av+'</div>'
      + '<div class="tdlb-fai-nom">'+escH(m.nom)+lien+'</div>'
      + '<div class="tdlb-fai-voc">'+escH(m.hll.vocation||"—")+'</div>'
      + badge(m.hll.categorie)
      + '<div class="tdlb-fai-since"><i class="fi fi-tr-calendar"></i>'+escH(T.depuis)+' '+escH(m.hll.depuis||"—")+'</div>'
      + '</article>';
  }

  function editeurHTML(m){
    var neuf = !m;
    return '<article class="tdlb-fai-card editing">'
      + (neuf ? '<label>'+T.membre+'</label><select class="tdlb-in" data-f="pseudo">'+optionsMembres("")+'</select>'
              : '<div class="tdlb-fai-nom">'+escH(m.nom)+'</div>')
      + '<label>'+T.categorie+'</label><select class="tdlb-in" data-f="categorie">'+optionsCat(m?m.hll.categorie:"medicale")+'</select>'
      + '<label>'+T.vocation+'</label><input class="tdlb-in" data-f="vocation" value="'+escA(m?m.hll.vocation:"")+'" placeholder="Sage-femme, infirmière…">'
      + '<label>'+BHL.T.depuis+' (année)</label><input class="tdlb-in" data-f="depuis" value="'+escA(m?m.hll.depuis:"")+'" placeholder="2021">'
      + '<div class="tdlb-edit-btns"><button class="tdlb-btn prim" data-save="'+(neuf?"new":escA(m.pseudo))+'">'+BHL.T.enregistrer+'</button>'
      +   '<button class="tdlb-btn" data-cancel="1">'+BHL.T.annuler+'</button></div>'
      + '</article>';
  }

  function render(host){
    var list = BHL.membresDeBande(BANDE);
    var cartes = list.map(carteHTML).join("");
    if(edit==="new") cartes = editeurHTML(null) + cartes;
    var ajout = (BHL.S.admin && edit!=="new")
      ? '<button class="tdlb-btn add" id="tdlb-fai-add"><i class="fi fi-tr-plus"></i> '+BHL.T.ajouter+'</button>' : "";
    host.innerHTML = heroHTML(list)
      + '<div class="tdlb-sec"><i class="fi fi-tr-arrow-right"></i><h3>'+T.actives(list.length)+'</h3>'+ajout+'</div>'
      + '<p class="tdlb-sec-sub">'+escH(T.sousActives)+'</p>'
      + (cartes ? '<div class="tdlb-fai-grid">'+cartes+'</div>' : '<div class="tdlb-empty">'+BHL.T.vide+'</div>')
      + '<div class="tdlb-pied">« '+escH(T.pied)+' »</div>';
    brancher(host);
  }

  /* ---------- events ---------- */
  function lire(host){
    var o={}; host.querySelectorAll(".editing [data-f]").forEach(function(el){ o[el.dataset.f]=el.value.trim(); });
    return o;
  }
  function brancher(host){
    var add=$("tdlb-fai-add"); if(add) add.addEventListener("click", function(){ edit="new"; render(host); });
    host.querySelectorAll("[data-edit]").forEach(function(b){ b.addEventListener("click", function(){ edit=b.dataset.edit; render(host); }); });
    host.querySelectorAll("[data-rm]").forEach(function(b){ b.addEventListener("click", function(){
      if(window.confirm(BHL.T.confirmRetrait(b.dataset.rm))) BHL.appliquer(b.dataset.rm, null);
    }); });
    host.querySelectorAll("[data-cancel]").forEach(function(b){ b.addEventListener("click", function(){ edit=null; render(host); }); });
    host.querySelectorAll("[data-save]").forEach(function(b){ b.addEventListener("click", function(){
      var v=lire(host), neuf=b.dataset.save==="new";
      var pseudo = neuf ? (host.querySelector('[data-f="pseudo"]')||{}).value : b.dataset.save;
      if(!pseudo || !v.categorie){ return; }
      edit=null;
      BHL.appliquer(pseudo, { bande:BANDE, categorie:v.categorie, vocation:v.vocation||"", depuis:v.depuis||"" });
    }); });
  }

  BHL.enregistrerOnglet(BANDE, { render:render });

})(window.BHL);
