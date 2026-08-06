/* ============================================================
   TDL — BANDES HORS-LA-LOI · ONGLET MARINGOUINS
   (tdl-bohl-maringouins.js) — à charger APRÈS tdl-bohl-core.js.

   3 cellules (config). Membre : cellule + role + depuis + figure (de confiance).
   Donnée : membres/{pseudo}.hors_la_loi = { bande:"maringouins", cellule, role, depuis, figure }.
   Contenu éditable (staff) par cellule : bandes/maringouins/cellules/{key} = { zones:[], devise:"" }.
   Figure de confiance & membres : même modèle que l'Ancien des Braconneurs (classes .tdlb-bra-*).
   ============================================================ */
(function (BHL) {
  "use strict";
  var BANDE="maringouins", CONF=window.BHL_CONFIG.bandes[BANDE], CELLULES=CONF.cellules;
  var ORDRE=Object.keys(CELLULES);
  var $=BHL.$, escH=BHL.escH, escA=BHL.escA, ini=BHL.initiales;

  // icônes solides par cellule — [MAJ] uicons-solid-rounded 4.0, ajustables
  var ICON={ salespattes:"fi-sr-paw", cypresmorts:"fi-sr-tree", rouilles:"fi-sr-key" };

  var T = { figure:"Figure de confiance", vacant:"Rôle à pourvoir", membres:"Membres", cellules:"Cellules",
            cellule:"Cellule", role:"Rôle / métier", estFigure:"Figure de confiance de la cellule",
            territoires:"Territoires", citation:"Citation", majContenu:"Modifier territoires & citation" };
  var edit=null;         // membre : null | "new" | pseudo
  var contentEdit=null;  // contenu cellule : null | key
  var zonesWork=[];      // territoires en cours d'édition

  /* ---------- overrides de contenu ---------- */
  function ov(key){ var b=BHL.rec&&BHL.rec.bandes&&BHL.rec.bandes.maringouins&&BHL.rec.bandes.maringouins.cellules; return (b&&b[key])||null; }
  function cellZones(key){ var o=ov(key); return (o&&o.zones) ? BHL.vt(o.zones) : (CELLULES[key].zones||[]); }
  function cellDevise(key){ var o=ov(key); return (o&&o.devise!=null) ? o.devise : (CELLULES[key].devise||""); }

  /* ---------- helpers ---------- */
  function optionsCell(sel){ return ORDRE.map(function(k){ return '<option value="'+k+'"'+(k===sel?" selected":"")+'>'+escH(CELLULES[k].nom)+'</option>'; }).join(""); }
  function optionsMembres(sel){
    var pris={}; BHL.membresDeBande(BANDE).forEach(function(m){ pris[m.pseudo]=1; });
    return '<option value="">'+BHL.T.choisir+'</option>' + BHL.tousMembres().map(function(p){
      var deja=pris[p]&&p!==sel; return '<option value="'+escA(p)+'"'+(p===sel?" selected":"")+'>'+escH(p)+(deja?" (déjà affilié)":"")+'</option>';
    }).join("");
  }
  function avImg(m){ return m.avatar ? '<img src="'+escA(m.avatar)+'" alt="">' : escH(ini(m.nom)); }
  function lienProfil(m){ return m.uid ? ' <a class="tdlb-card-link" href="/u'+m.uid+'" title="Profil"><i class="fi fi-tr-arrow-up-right-from-square"></i></a>' : ""; }

  /* ---------- rendu ---------- */
  function stats(list){
    return [
      { icon:"fi-tr-users-alt", label:BHL.T.membres, val:list.length },
      { icon:"fi-tr-crown",     label:T.cellules,    val:ORDRE.length },
    ];
  }
  function headHTML(key){
    var ic='<i class="tdlb-mar-ico fi '+(ICON[key]||"fi-sr-bug")+'"></i>';
    var pen = (BHL.S.admin && contentEdit!==key) ? '<button class="tdlb-ic" data-cedit="'+escA(key)+'" title="'+T.majContenu+'"><i class="fi fi-tr-pencil"></i></button>' : "";
    return ic+'<div class="tdlb-mar-head">'+pen+'<h3>'+escH(CELLULES[key].nom)+'</h3></div>';
  }
  function zonesTagsEdit(){
    return zonesWork.map(function(z,i){ return '<span class="tag">'+escH(z)+'<button data-zx="'+i+'">✕</button></span>'; }).join("")
      + '<button class="tag-add" data-zadd="1">+</button>';
  }
  function contenuHTML(key){
    if(contentEdit===key){
      return '<div class="tdlb-mar-cedit">'
        + '<label>'+T.territoires+'</label><div class="tdlb-mc-edit" id="tdlb-mar-zones">'+zonesTagsEdit()+'</div>'
        + '<label>'+T.citation+'</label><input class="tdlb-in" id="tdlb-mar-cite" value="'+escA(cellDevise(key))+'">'
        + '<div class="btns"><button class="tdlb-btn prim" data-csave="'+escA(key)+'">'+BHL.T.enregistrer+'</button>'
        +   '<button class="tdlb-btn" data-ccancel="1">'+BHL.T.annuler+'</button></div></div>';
    }
    var zones = cellZones(key).map(function(z){ return '<span class="tdlb-mar-zone">'+escH(z)+'</span>'; }).join("");
    var cite = cellDevise(key);
    return '<div class="tdlb-mar-zones">'+zones+'</div>'
      + '<hr class="tdlb-mar-sep">'
      + (cite ? '<div class="tdlb-mar-cite">« '+escH(cite)+' »</div>' : '');
  }
  // figure de confiance — même modèle que l'Ancien des Braconneurs
  function figureHTML(m){
    if(!m){
      return '<div class="tdlb-bra-ancien vacant"><div class="info"><div class="l1">'
        + '<span class="nom">'+T.vacant+'</span><span class="tag-ancien">'+T.figure+'</span></div></div></div>';
    }
    var actes='<div class="actes"><button class="tdlb-ic" data-edit="'+escA(m.pseudo)+'" title="'+BHL.T.modifier+'"><i class="fi fi-tr-pencil"></i></button>'
      + '<button class="tdlb-ic" data-rm="'+escA(m.pseudo)+'" title="'+BHL.T.retirer+'"><i class="fi fi-tr-trash"></i></button></div>';
    return '<div class="tdlb-bra-ancien" style="--gc:'+m.couleur+'">'
      + '<span class="av">'+avImg(m)+'</span>'
      + '<div class="info">'
      +   '<div class="l1"><span class="nom">'+escH(m.nom)+lienProfil(m)+'</span><span class="tag-ancien">'+T.figure+'</span></div>'
      +   '<div class="l2"><span class="meta">'+escH(m.hll.role||"—")+'</span>'
      +     '<span class="since"><i class="fi fi-tr-calendar"></i>'+BHL.T.depuis+' '+escH(m.hll.depuis||"—")+'</span></div>'
      + '</div>' + actes + '</div>';
  }
  function membreHTML(m){
    var tip='<span class="tip"><b>'+escH(m.nom)+'</b><span>'+BHL.T.depuis+' '+escH(m.hll.depuis||"—")+'</span>'
      + (BHL.S.admin ? '<span class="tipbtns"><button data-edit="'+escA(m.pseudo)+'">'+BHL.T.modifier+'</button><button data-rm="'+escA(m.pseudo)+'">'+BHL.T.retirer+'</button></span>' : "")
      + '</span>';
    var href=m.uid ? '/u'+m.uid : '#';
    return '<div class="tdlb-bra-mwrap" style="--gc:'+m.couleur+'"><a class="tdlb-bra-mav" href="'+escA(href)+'" title="'+escA(m.nom)+'">'+avImg(m)+'</a>'+tip+'</div>';
  }
  function carteCell(key, list){
    var mem=list.filter(function(m){ return m.hll.cellule===key; });
    var figure=mem.filter(function(m){ return m.hll.figure; })[0]||null;
    var autres=mem.filter(function(m){ return !(figure&&m.pseudo===figure.pseudo); });
    return '<article class="tdlb-mar-card">'
      + headHTML(key)
      + contenuHTML(key)
      + figureHTML(figure)
      + '<div class="tdlb-bra-lbl">'+T.membres+' ('+autres.length+')</div>'
      + '<div class="tdlb-bra-stack">'+ (autres.length ? autres.map(membreHTML).join("") : '<span style="font-family:var(--font2);font-style:italic;color:var(--darkopa5)">—</span>') +'</div>'
      + '</article>';
  }

  function formHTML(m){
    var neuf=!m;
    return '<div class="tdlb-bra-form">'
      + (neuf ? '<div><label>Membre</label><select class="tdlb-in" data-f="pseudo">'+optionsMembres("")+'</select></div>'
              : '<div><label>Membre</label><div class="fixe">'+escH(m.nom)+'</div></div>')
      + '<div><label>'+T.cellule+'</label><select class="tdlb-in" data-f="cellule">'+optionsCell(m?m.hll.cellule:ORDRE[0])+'</select></div>'
      + '<div><label>'+T.role+'</label><input class="tdlb-in" data-f="role" value="'+escA(m?m.hll.role:"")+'" placeholder="Mécanicien, navigatrice…"></div>'
      + '<div><label>'+BHL.T.depuis+' (année)</label><input class="tdlb-in" data-f="depuis" value="'+escA(m?m.hll.depuis:"")+'" placeholder="2019"></div>'
      + '<div class="chk"><label><input type="checkbox" data-f="figure" '+((m&&m.hll.figure)?"checked":"")+'> '+T.estFigure+'</label></div>'
      + '<div class="btns"><button class="tdlb-btn prim" data-save="'+(neuf?"new":escA(m.pseudo))+'">'+BHL.T.enregistrer+'</button>'
      +   '<button class="tdlb-btn" data-cancel="1">'+BHL.T.annuler+'</button></div>'
      + '</div>';
  }

  function render(host){
    var list=BHL.membresDeBande(BANDE);
    var cible=(edit && edit!=="new") ? list.filter(function(m){return m.pseudo===edit;})[0] : null;
    host.innerHTML = BHL.heroHTML(BANDE, { emblem:"fi-tr-mosquito", stats:stats(list) })
      + '<div class="tdlb-body">'
      +   (edit ? formHTML(edit==="new"?null:cible) : "")
      +   '<div class="tdlb-mar-grid">'+ORDRE.map(function(k){ return carteCell(k, list); }).join("")+'</div>'
      + '</div>';
    brancher(host);
  }

  /* ---------- events ---------- */
  function lire(host){ var o={}; host.querySelectorAll(".tdlb-bra-form [data-f]").forEach(function(el){ o[el.dataset.f]= el.type==="checkbox"?el.checked:el.value.trim(); }); return o; }
  function brancher(host){
    // membre
    host.querySelectorAll("[data-edit]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); edit=b.dataset.edit; contentEdit=null; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-rm]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); if(window.confirm(BHL.T.confirmRetrait(b.dataset.rm))) BHL.appliquer(b.dataset.rm, null); }); });
    host.querySelectorAll("[data-cancel]").forEach(function(b){ b.addEventListener("click", function(){ edit=null; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-save]").forEach(function(b){ b.addEventListener("click", function(){
      var v=lire(host), neuf=b.dataset.save==="new";
      var pseudo=neuf ? ((host.querySelector('[data-f="pseudo"]')||{}).value||"") : b.dataset.save;
      if(!pseudo || !v.cellule) return; edit=null;
      BHL.appliquer(pseudo, { bande:BANDE, cellule:v.cellule, role:v.role||"", depuis:v.depuis||"", figure:!!v.figure });
    }); });
    // contenu cellule (territoires + citation)
    host.querySelectorAll("[data-cedit]").forEach(function(b){ b.addEventListener("click", function(){ contentEdit=b.dataset.cedit; edit=null; zonesWork=cellZones(contentEdit).slice(); BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-ccancel]").forEach(function(b){ b.addEventListener("click", function(){ contentEdit=null; BHL.rendreOnglet(); }); });
    var zbox=$("tdlb-mar-zones");
    if(zbox) zbox.addEventListener("click", function(e){
      var x=e.target.closest("[data-zx]"); if(x){ zonesWork.splice(+x.dataset.zx,1); zbox.innerHTML=zonesTagsEdit(); return; }
      var add=e.target.closest("[data-zadd]"); if(add){
        var inp=document.createElement("input"); inp.className="tdlb-in mc-in"; inp.placeholder="Nouveau territoire…";
        add.replaceWith(inp); inp.focus();
        var fin=function(ok){ var v=inp.value.trim(); if(ok&&v) zonesWork.push(v); zbox.innerHTML=zonesTagsEdit(); };
        inp.addEventListener("keydown",function(ev){ if(ev.key==="Enter") fin(true); else if(ev.key==="Escape") fin(false); });
        inp.addEventListener("blur",function(){ fin(true); });
      }
    });
    host.querySelectorAll("[data-csave]").forEach(function(b){ b.addEventListener("click", function(){
      var key=b.dataset.csave, cite=($("tdlb-mar-cite")||{}).value||"";
      var data={ zones:zonesWork.slice(), devise:cite.trim() };
      BHL.rec.bandes=BHL.rec.bandes||{}; var mm=BHL.rec.bandes.maringouins=BHL.rec.bandes.maringouins||{};
      mm.cellules=mm.cellules||{}; mm.cellules[key]=Object.assign({},mm.cellules[key],data);
      contentEdit=null; BHL.rendreOnglet();
      BHL.PERSIST.champ("bandes/maringouins/cellules/"+key, data).catch(function(){ BHL.toast(BHL.T.errEcriture); });
    }); });
  }

  function renderActions(bar){
    if(edit==="new") return;
    var b=document.createElement("button"); b.className="tdlb-btn add";
    b.innerHTML='<i class="fi fi-tr-plus"></i> '+BHL.T.ajouter;
    b.addEventListener("click", function(){ edit="new"; contentEdit=null; BHL.rendreOnglet(); BHL.renderActionbar(); });
    bar.appendChild(b);
  }

  BHL.enregistrerOnglet(BANDE, { render:render, renderActions:renderActions });

})(window.BHL);
