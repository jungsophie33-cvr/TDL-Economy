/* ============================================================
   TDL — BANDES HORS-LA-LOI · ONGLET BRACONNEURS
   (tdl-bohl-braconneurs.js) — à charger APRÈS tdl-bohl-core.js.

   4 spécialités (config). Membre : spec + role + depuis + ancien.
   Donnée : membres/{pseudo}.hors_la_loi = { bande:"braconneurs", spec, role, depuis, ancien }.
   Descriptions de spécialité éditables (staff) : bandes/braconneurs/specialites/{key}/desc.
   ============================================================ */
(function (BHL) {
  "use strict";
  var BANDE="braconneurs", CONF=window.BHL_CONFIG.bandes[BANDE], SPECS=CONF.specialites;
  var ORDRE=Object.keys(SPECS);
  var $=BHL.$, escH=BHL.escH, escA=BHL.escA, ini=BHL.initiales;

  // icônes solides par spécialité — [MAJ] uicons-solid-rounded 4.0, ajustables
  var ICON={ trappeurs:"fi-sr-squirrel", reptiliens:"fi-sr-snake", preparateurs:"fi-sr-flask", vivandiers:"fi-sr-truck-side" };

  var T = { ancien:"L'Ancien", vacant:"Rôle à pourvoir", membres:"Membres", specialites:"Spécialités",
            spec:"Spécialité", role:"Rôle / métier", estAncien:"Reconnu comme l'Ancien de la spécialité",
            majDesc:"Modifier la description" };
  var edit = null;      // ajout/édition membre : null | "new" | pseudo
  var descEdit = null;  // édition desc spécialité : null | key

  /* ---------- helpers ---------- */
  function descSpec(key){
    var ov = BHL.rec && BHL.rec.bandes && BHL.rec.bandes.braconneurs && BHL.rec.bandes.braconneurs.specialites;
    var d = ov && ov[key] && ov[key].desc;
    return (d!=null) ? d : (SPECS[key].desc||"");
  }
  function optionsSpec(sel){ return ORDRE.map(function(k){ return '<option value="'+k+'"'+(k===sel?" selected":"")+'>'+escH(SPECS[k].nom)+'</option>'; }).join(""); }
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
      { icon:"fi-tr-users-alt", label:BHL.T.membres,  val:list.length },
      { icon:"fi-tr-crown",     label:T.specialites,  val:ORDRE.length },
    ];
  }
  function headHTML(key){
    var sp=SPECS[key], ic='<i class="tdlb-bra-ico fi '+(ICON[key]||"fi-sr-paw")+'"></i>';
    if(descEdit===key){
      return ic+'<div class="tdlb-bra-head"><h3>'+escH(sp.nom)+'</h3>'
        + '<div class="tdlb-bra-descedit"><textarea class="tdlb-in" data-dk="'+escA(key)+'" rows="3">'+escH(descSpec(key))+'</textarea>'
        + '<div class="btns"><button class="tdlb-btn prim" data-dsave="'+escA(key)+'">'+BHL.T.enregistrer+'</button>'
        +   '<button class="tdlb-btn" data-dcancel="1">'+BHL.T.annuler+'</button></div></div></div>';
    }
    var pen = BHL.S.admin ? '<button class="tdlb-ic" data-dedit="'+escA(key)+'" title="'+T.majDesc+'"><i class="fi fi-tr-pencil"></i></button>' : "";
    return ic+'<div class="tdlb-bra-head">'+pen+'<h3>'+escH(sp.nom)+'</h3><p>'+escH(descSpec(key))+'</p></div>';
  }
  function ancienHTML(m){
    if(!m){
      return '<div class="tdlb-bra-ancien vacant"><div class="info"><div class="l1">'
        + '<span class="nom">'+T.vacant+'</span><span class="tag-ancien">'+T.ancien+'</span></div></div></div>';
    }
    var actes = '<div class="actes"><button class="tdlb-ic" data-edit="'+escA(m.pseudo)+'" title="'+BHL.T.modifier+'"><i class="fi fi-tr-pencil"></i></button>'
      + '<button class="tdlb-ic" data-rm="'+escA(m.pseudo)+'" title="'+BHL.T.retirer+'"><i class="fi fi-tr-trash"></i></button></div>';
    return '<div class="tdlb-bra-ancien" style="--gc:'+m.couleur+'">'
      + '<span class="av">'+avImg(m)+'</span>'
      + '<div class="info">'
      +   '<div class="l1"><span class="nom">'+escH(m.nom)+lienProfil(m)+'</span><span class="tag-ancien">'+T.ancien+'</span></div>'
      +   '<div class="l2"><span class="meta">'+escH(m.hll.role||"—")+'</span>'
      +     '<span class="since"><i class="fi fi-tr-calendar"></i>'+BHL.T.depuis+' '+escH(m.hll.depuis||"—")+'</span></div>'
      + '</div>' + actes + '</div>';
  }
  function membreHTML(m){
    var tip = '<span class="tip"><b>'+escH(m.nom)+'</b><span>'+BHL.T.depuis+' '+escH(m.hll.depuis||"—")+'</span>'
      + (BHL.S.admin ? '<span class="tipbtns"><button data-edit="'+escA(m.pseudo)+'">'+BHL.T.modifier+'</button><button data-rm="'+escA(m.pseudo)+'">'+BHL.T.retirer+'</button></span>' : "")
      + '</span>';
    var href = m.uid ? '/u'+m.uid : '#';
    return '<div class="tdlb-bra-mwrap" style="--gc:'+m.couleur+'"><a class="tdlb-bra-mav" href="'+escA(href)+'" title="'+escA(m.nom)+'">'+avImg(m)+'</a>'+tip+'</div>';
  }
  function carteSpec(key, list){
    var mem=list.filter(function(m){ return m.hll.spec===key; });
    var ancien=mem.filter(function(m){ return m.hll.ancien; })[0]||null;
    var autres=mem.filter(function(m){ return !(ancien&&m.pseudo===ancien.pseudo); });
    return '<article class="tdlb-bra-card">'
      + headHTML(key)
      + ancienHTML(ancien)
      + '<div class="tdlb-bra-lbl">'+T.membres+' ('+autres.length+')</div>'
      + '<div class="tdlb-bra-stack">'+ (autres.length ? autres.map(membreHTML).join("") : '<span class="tdlb-bra-vacant" style="font-family:var(--font2);font-style:italic;color:var(--darkopa5)">—</span>') +'</div>'
      + '</article>';
  }

  function formHTML(m){
    var neuf=!m;
    return '<div class="tdlb-bra-form">'
      + (neuf ? '<div><label>Membre</label><select class="tdlb-in" data-f="pseudo">'+optionsMembres("")+'</select></div>'
              : '<div><label>Membre</label><div class="fixe">'+escH(m.nom)+'</div></div>')
      + '<div><label>'+T.spec+'</label><select class="tdlb-in" data-f="spec">'+optionsSpec(m?m.hll.spec:ORDRE[0])+'</select></div>'
      + '<div><label>'+T.role+'</label><input class="tdlb-in" data-f="role" value="'+escA(m?m.hll.role:"")+'" placeholder="Trappeur, chasseur…"></div>'
      + '<div><label>'+BHL.T.depuis+' (année)</label><input class="tdlb-in" data-f="depuis" value="'+escA(m?m.hll.depuis:"")+'" placeholder="2003"></div>'
      + '<div class="chk"><label><input type="checkbox" data-f="ancien" '+((m&&m.hll.ancien)?"checked":"")+'> '+T.estAncien+'</label></div>'
      + '<div class="btns"><button class="tdlb-btn prim" data-save="'+(neuf?"new":escA(m.pseudo))+'">'+BHL.T.enregistrer+'</button>'
      +   '<button class="tdlb-btn" data-cancel="1">'+BHL.T.annuler+'</button></div>'
      + '</div>';
  }

  function render(host){
    var list=BHL.membresDeBande(BANDE);
    var cible=(edit && edit!=="new") ? list.filter(function(m){return m.pseudo===edit;})[0] : null;
    host.innerHTML = BHL.heroHTML(BANDE, { emblem:"fi-tr-paw", stats:stats(list) })
      + '<div class="tdlb-body">'
      +   (edit ? formHTML(edit==="new"?null:cible) : "")
      +   '<div class="tdlb-bra-grid">'+ORDRE.map(function(k){ return carteSpec(k, list); }).join("")+'</div>'
      + '</div>';
    brancher(host);
  }

  /* ---------- events ---------- */
  function lire(host){ var o={}; host.querySelectorAll(".tdlb-bra-form [data-f]").forEach(function(el){ o[el.dataset.f]= el.type==="checkbox"?el.checked:el.value.trim(); }); return o; }
  function brancher(host){
    // membre : édition / retrait / annuler / enregistrer
    host.querySelectorAll("[data-edit]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); edit=b.dataset.edit; descEdit=null; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-rm]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); if(window.confirm(BHL.T.confirmRetrait(b.dataset.rm))) BHL.appliquer(b.dataset.rm, null); }); });
    host.querySelectorAll("[data-cancel]").forEach(function(b){ b.addEventListener("click", function(){ edit=null; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-save]").forEach(function(b){ b.addEventListener("click", function(){
      var v=lire(host), neuf=b.dataset.save==="new";
      var pseudo=neuf ? ((host.querySelector('[data-f="pseudo"]')||{}).value||"") : b.dataset.save;
      if(!pseudo || !v.spec) return; edit=null;
      BHL.appliquer(pseudo, { bande:BANDE, spec:v.spec, role:v.role||"", depuis:v.depuis||"", ancien:!!v.ancien });
    }); });
    // description de spécialité : édition / enregistrer / annuler
    host.querySelectorAll("[data-dedit]").forEach(function(b){ b.addEventListener("click", function(){ descEdit=b.dataset.dedit; edit=null; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-dcancel]").forEach(function(b){ b.addEventListener("click", function(){ descEdit=null; BHL.rendreOnglet(); }); });
    host.querySelectorAll("[data-dsave]").forEach(function(b){ b.addEventListener("click", function(){
      var key=b.dataset.dsave, ta=host.querySelector('[data-dk="'+key+'"]'); if(!ta) return;
      var val=ta.value.trim();
      BHL.rec.bandes=BHL.rec.bandes||{}; var bb=BHL.rec.bandes.braconneurs=BHL.rec.bandes.braconneurs||{};
      bb.specialites=bb.specialites||{}; bb.specialites[key]=Object.assign({},bb.specialites[key],{desc:val});
      descEdit=null; BHL.rendreOnglet();
      BHL.PERSIST.champ("bandes/braconneurs/specialites/"+key+"/desc", val).catch(function(){ BHL.toast(BHL.T.errEcriture); });
    }); });
  }

  function renderActions(bar){
    if(edit==="new") return;
    var b=document.createElement("button"); b.className="tdlb-btn add";
    b.innerHTML='<i class="fi fi-tr-plus"></i> '+BHL.T.ajouter;
    b.addEventListener("click", function(){ edit="new"; descEdit=null; BHL.rendreOnglet(); BHL.renderActionbar(); });
    bar.appendChild(b);
  }

  BHL.enregistrerOnglet(BANDE, { render:render, renderActions:renderActions });

})(window.BHL);
