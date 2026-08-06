/* ============================================================
   TDL — BANDES HORS-LA-LOI · ONGLET LES SORCIÈRES DU BARON
   (tdl-bohl-sorcieres.js) — à charger APRÈS tdl-bohl-core.js.

   Structure plate : rôle rituel (→ catégorie dérivée), lieu d'ancrage, année.
   Donnée : membres/{pseudo}.hors_la_loi = { bande:"sorcieres", role, lieu, depuis }.
   ============================================================ */
(function (BHL) {
  "use strict";
  var BANDE="sorcieres", CONF=window.BHL_CONFIG.bandes[BANDE], ROLES=CONF.roles, LIEUX=CONF.lieux;
  var $=BHL.$, escH=BHL.escH, escA=BHL.escA, ini=BHL.initiales;

  // couleurs & icônes par rôle — [MAJ] uicons 4.0 / palette communautés, ajustables
  var RCOL={ houngan:"var(--dark2)", mambo:"var(--dark2)", guerisseur:"var(--gr5-color)", guerisseuse:"var(--gr5-color)",
             devin:"var(--gr4-color)", bokor:"var(--gr6-color)", hounsi:"var(--gr3-color)" };
  var RICON={ houngan:"fi-tr-praying-hands", mambo:"fi-tr-praying-hands", guerisseur:"fi-tr-hand", guerisseuse:"fi-tr-hand",
              devin:"fi-tr-eye", bokor:"fi-tr-skull", hounsi:"fi-tr-user" };

  var T = { membres:"Membres", pretrise:"Prêtrise", bokors:"Bokors", depuis:"Depuis",
            role:"Rôle rituel", lieu:"Officiant à", membre:"Membre" };
  var edit=null;   // null | "new" | pseudo

  /* ---------- helpers ---------- */
  function optRoles(sel){ return Object.keys(ROLES).map(function(k){ return '<option value="'+k+'"'+(k===sel?" selected":"")+'>'+escH(ROLES[k].nom)+'</option>'; }).join(""); }
  function optMembres(sel){
    var pris={}; BHL.membresDeBande(BANDE).forEach(function(m){ pris[m.pseudo]=1; });
    return '<option value="">'+BHL.T.choisir+'</option>' + BHL.tousMembres().map(function(p){
      var deja=pris[p]&&p!==sel; return '<option value="'+escA(p)+'"'+(p===sel?" selected":"")+'>'+escH(p)+(deja?" (déjà affilié)":"")+'</option>';
    }).join("");
  }
  function avImg(m){ return m.avatar ? '<img src="'+escA(m.avatar)+'" alt="">' : '<span class="ini">'+escH(ini(m.nom))+'</span>'; }

  /* ---------- rendu ---------- */
  function stats(list){
    var pretrise=list.filter(function(m){ return (ROLES[m.hll.role]||{}).cat==="pretres"; }).length;
    var bokors=list.filter(function(m){ return m.hll.role==="bokor"; }).length;
    return [
      { icon:"fi-tr-users-alt",     label:T.membres,  val:list.length },
      { icon:"fi-tr-hands-praying", label:T.pretrise, val:pretrise },
      { icon:"fi-tr-skull",         label:T.bokors,   val:bokors },
    ];
  }
  function carteHTML(m){
    if(edit===m.pseudo) return editeurHTML(m);
    var r=m.hll.role, role=ROLES[r]||{};
    var actes = BHL.S.admin
      ? '<div class="actes"><button class="tdlb-ic" data-edit="'+escA(m.pseudo)+'" title="'+BHL.T.modifier+'"><i class="fi fi-tr-pencil"></i></button>'
        + '<button class="tdlb-ic" data-rm="'+escA(m.pseudo)+'" title="'+BHL.T.retirer+'"><i class="fi fi-tr-trash"></i></button></div>' : "";
    var lien = m.uid ? ' <a class="tdlb-card-link" href="/u'+m.uid+'" title="Profil"><i class="fi fi-tr-arrow-up-right-from-square"></i></a>' : "";
    return '<article class="tdlb-sor-card" style="--gc:'+m.couleur+'">'+actes
      + '<div class="av">'+avImg(m)+'</div>'
      + '<div class="info">'
      +   '<div class="nom">'+escH(m.nom)+lien+'</div>'
      +   '<div class="tdlb-sor-role" style="--rc:'+(RCOL[r]||"var(--dark2)")+'"><i class="fi '+(RICON[r]||"fi-tr-star")+'"></i>'+escH(role.nom||"—")+'</div>'
      +   '<div class="tdlb-sor-line"><i class="fi fi-tr-marker"></i>'+escH(m.hll.lieu||"—")+'</div>'
      +   '<div class="tdlb-sor-line"><i class="fi fi-tr-calendar"></i>'+T.depuis+' '+escH(m.hll.depuis||"—")+'</div>'
      + '</div></article>';
  }
  function editeurHTML(m){
    var neuf=!m;
    return '<article class="tdlb-sor-card editing">'
      + (neuf ? '<label>'+T.membre+'</label><select class="tdlb-in" data-f="pseudo">'+optMembres("")+'</select>'
              : '<div class="nom">'+escH(m.nom)+'</div>')
      + '<label>'+T.role+'</label><select class="tdlb-in" data-f="role">'+optRoles(m?m.hll.role:"mambo")+'</select>'
      + '<label>'+T.lieu+'</label><input class="tdlb-in" data-f="lieu" list="tdlb-sor-lieux" value="'+escA(m?m.hll.lieu:"")+'" placeholder="Lost Bayou, Houma…">'
      + '<datalist id="tdlb-sor-lieux">'+LIEUX.map(function(l){return '<option value="'+escA(l)+'">';}).join("")+'</datalist>'
      + '<label>'+BHL.T.depuis+' (année)</label><input class="tdlb-in" data-f="depuis" value="'+escA(m?m.hll.depuis:"")+'" placeholder="2016">'
      + '<div class="tdlb-edit-btns"><button class="tdlb-btn prim" data-save="'+(neuf?"new":escA(m.pseudo))+'">'+BHL.T.enregistrer+'</button>'
      +   '<button class="tdlb-btn" data-cancel="1">'+BHL.T.annuler+'</button></div>'
      + '</article>';
  }
  function render(host){
    var list=BHL.membresDeBande(BANDE);
    var cartes=list.map(carteHTML).join("");
    if(edit==="new") cartes = editeurHTML(null) + cartes;
    host.innerHTML = BHL.heroHTML(BANDE, { emblem:"fi-tr-snake", stats:stats(list) })
      + '<div class="tdlb-body">'
      +   (cartes ? '<div class="tdlb-sor-grid">'+cartes+'</div>' : '<div class="tdlb-empty">'+BHL.T.vide+'</div>')
      + '</div>';
    brancher(host);
  }

  /* ---------- events ---------- */
  function lire(host){ var o={}; host.querySelectorAll(".editing [data-f]").forEach(function(el){ o[el.dataset.f]=el.value.trim(); }); return o; }
  function brancher(host){
    host.querySelectorAll("[data-edit]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); edit=b.dataset.edit; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-rm]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); if(window.confirm(BHL.T.confirmRetrait(b.dataset.rm))) BHL.appliquer(b.dataset.rm, null); }); });
    host.querySelectorAll("[data-cancel]").forEach(function(b){ b.addEventListener("click", function(){ edit=null; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-save]").forEach(function(b){ b.addEventListener("click", function(){
      var v=lire(host), neuf=b.dataset.save==="new";
      var pseudo=neuf ? ((host.querySelector('[data-f="pseudo"]')||{}).value||"") : b.dataset.save;
      if(!pseudo || !v.role) return; edit=null;
      BHL.appliquer(pseudo, { bande:BANDE, role:v.role, lieu:v.lieu||"", depuis:v.depuis||"" });
    }); });
  }
  function renderActions(bar){
    if(edit==="new") return;
    var b=document.createElement("button"); b.className="tdlb-btn add";
    b.innerHTML='<i class="fi fi-tr-plus"></i> '+BHL.T.ajouter;
    b.addEventListener("click", function(){ edit="new"; BHL.rendreOnglet(); BHL.renderActionbar(); });
    bar.appendChild(b);
  }

  BHL.enregistrerOnglet(BANDE, { render:render, renderActions:renderActions });

})(window.BHL);
