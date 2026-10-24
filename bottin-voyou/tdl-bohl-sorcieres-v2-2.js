/* ============================================================
   TDL — BANDES HORS-LA-LOI · ONGLET LES SORCIÈRES DU BARON
   (tdl-bohl-sorcieres.js) · v2 — à charger APRÈS tdl-bohl-core.js.
   Requiert aussi window.TDLBase (API des liens de réseau).

   DEUX sources :
     · membres de la bande → membres/{pseudo}.hors_la_loi
         = { bande:"sorcieres", role, lieu, depuis }
     · [MAJ v2] RÉSEAU DES CRÉANCES → membres/{pseudo}/liens/{clé}
         = { type:"creance_sorcieres", nature, detail, statut:"du",
             article, service, demandeId, date }
       Ceux qui ont promis un service aux Sorcières en paiement d'une
       offrande. Le lien est écrit par quai-staff à la validation de la
       demande ; le tableau des secrets s'y adossera quand une Sorcière
       réclamera son dû. Une créance honorée QUITTE le réseau (elle est
       supprimée, pas dépouillée de son statut comme un contact).
       Même branche que les réseaux de la Main, des Faiseuses et les piliers
       de la Flottille : chaque lien s'écrit SEUL, sous sa clé.
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

  /* [MAJ] MIROIR de barge-sorcieres NATURES : à aligner s'il change */
  var NATURES = { materiel:"Matériel ou fourniture", transport:"Transport ou passage", abri:"Abri",
                  acces:"Accès à un lieu ou à un métier", silence:"Silence ou témoignage",
                  mainoeuvre:"Main-d\u2019œuvre", info:"Information à ramener" };

  var T = { membres:"Membres", pretrise:"Prêtrise", bokors:"Bokors", depuis:"Depuis",
            role:"Rôle rituel", lieu:"Officiant à", membre:"Membre",
            creances:"Le réseau des créances", debiteurs:"Créances",
            creancesTxt:"Ils ne sont pas des leurs. Ils ont promis un service aux Lwas, et les Sorcières viendront le réclamer quand elles le jugeront bon.",
            creancesVide:"Personne ne doit rien aux Sorcières. Pour l\u2019instant.",
            du:"Service dû", nature:"Nature du service", detail:"Ce qui a été promis", contact:"Débiteur",
            ajouterCreance:"Ajouter une créance",
            confirmRegler:function(p){ return "Retirer la créance de "+p+" ? Elle quitte le réseau des Sorcières."; },
            aConvertir:"Liens au format ancien — lancez la conversion (bouton staff).",
            disparu:"Cette créance n\u2019existe plus." };
  var edit=null;     // membre : null | "new" | pseudo
  var creEdit=null;  // créance : null | "new" | "pseudo\u0001clé"

  /* ---------- helpers ---------- */
  function optRoles(sel){ return Object.keys(ROLES).map(function(k){ return '<option value="'+k+'"'+(k===sel?" selected":"")+'>'+escH(ROLES[k].nom)+'</option>'; }).join(""); }
  function optMembres(sel){
    var pris={}; BHL.membresDeBande(BANDE).forEach(function(m){ pris[m.pseudo]=1; });
    return '<option value="">'+BHL.T.choisir+'</option>' + BHL.tousMembres().map(function(p){
      var deja=pris[p]&&p!==sel; return '<option value="'+escA(p)+'"'+(p===sel?" selected":"")+'>'+escH(p)+(deja?" (déjà affilié)":"")+'</option>';
    }).join("");
  }
  function optTousMembres(sel){
    return '<option value="">'+BHL.T.choisir+'</option>' + BHL.tousMembres().map(function(p){
      return '<option value="'+escA(p)+'"'+(p===sel?" selected":"")+'>'+escH(p)+'</option>';
    }).join("");
  }
  function optNatures(sel){ return Object.keys(NATURES).map(function(k){ return '<option value="'+k+'"'+(k===sel?" selected":"")+'>'+escH(NATURES[k])+'</option>'; }).join(""); }
  function avImg(m){ return m.avatar ? '<img src="'+escA(m.avatar)+'" alt="">' : '<span class="ini">'+escH(ini(m.nom))+'</span>'; }

  /* ---------- réseau des créances (liens à clés) ---------- */
  /* Seules comptent les créances en cours : celles qui portent un statut. */
  function tousCreances(){
    var ms=BHL.rec.membres||{}, out=[];
    Object.keys(ms).forEach(function(pseudo){
      var m=ms[pseudo]||{};
      window.TDLBase.liens(m).forEach(function(l){
        if(l.type==="creance_sorcieres" && l.statut)
          out.push({ pseudo:pseudo, uid:m.uid||null, avatar:BHL.avatarDe(pseudo),
                     couleur:BHL.couleurGroupe(m.group), cle:l.k, lien:l });
      });
    });
    return out.sort(function(a,b){ return a.pseudo.localeCompare(b.pseudo,"fr") || String(a.lien.date||"").localeCompare(String(b.lien.date||"")); });
  }
  /* un membre dont les liens sont encore un tableau n'accepte aucune écriture
     ciblée : un PATCH par clé sur une branche-tableau produirait un nœud bâtard */
  function exigeCles(pseudo){
    if(!window.TDLBase.liensAConvertir(BHL.rec.membres[pseudo])) return true;
    BHL.toast(T.aConvertir);
    return false;
  }
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
  /* le lien tel qu'il est EN BASE : un champ écrit ailleurs (service, demande,
     date) ne doit pas disparaître à la modification */
  function lienEnBase(pseudo, cle){ return ((BHL.rec.membres[pseudo]||{}).liens||{})[cle] || null; }

  /* ---------- rendu ---------- */
  function stats(list){
    var pretrise=list.filter(function(m){ return (ROLES[m.hll.role]||{}).cat==="pretres"; }).length;
    var bokors=list.filter(function(m){ return m.hll.role==="bokor"; }).length;
    return [
      { icon:"fi-tr-users-alt",     label:T.membres,  val:list.length },
      { icon:"fi-tr-praying-hands", label:T.pretrise, val:pretrise },
      { icon:"fi-tr-skull",         label:T.bokors,   val:bokors },
      { icon:"fi-tr-file-signature", label:T.debiteurs, val:tousCreances().length },
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

  /* carte d'un débiteur : mêmes classes que les piliers de la Flottille et les
     ressources des Faiseuses, pour que les trois réseaux se lisent pareil */
  function creanceHTML(p){
    var l=p.lien, key=p.pseudo+"\u0001"+p.cle;
    var actes = BHL.S.admin ? '<div class="actes"><button class="tdlb-ic" data-cedit="'+escA(key)+'" title="'+BHL.T.modifier+'"><i class="fi fi-tr-pencil"></i></button>'
      + '<button class="tdlb-ic" data-crm="'+escA(key)+'" title="'+BHL.T.retirer+'"><i class="fi fi-tr-trash"></i></button></div>' : "";
    var lien = p.uid ? ' <a class="tdlb-card-link" href="/u'+p.uid+'"><i class="fi fi-tr-arrow-up-right-from-square"></i></a>' : "";
    var nature = NATURES[l.nature] || l.nature || "Service";
    return '<div class="tdlb-flo-pilier" style="--gc:'+p.couleur+'">'+actes
      + '<span class="av">'+(p.avatar?'<img src="'+escA(p.avatar)+'" alt="">':escH(ini(p.pseudo)))+'</span>'
      + '<div class="info"><span class="nom">'+escH(p.pseudo)+lien+'</span>'
      +   '<span class="concours">'+escH(nature)+'</span>'
      +   '<div class="bas"><span class="tag-dette du">'+escH(T.du)+'</span></div>'
      + '</div></div>';
  }
  function creancesSection(){
    var cr=tousCreances();
    return '<div class="tdlb-flo-psec"><div class="tdlb-main-h"><i class="fi fi-tr-share"></i><h3>'+escH(T.creances)+'</h3></div><p class="tdlb-main-desc">'+escH(T.creancesTxt)+'</p>'
      + (cr.length ? '<div class="tdlb-flo-pgrid">'+cr.map(creanceHTML).join("")+'</div>' : '<div class="tdlb-empty">'+escH(T.creancesVide)+'</div>')
      + '</div>';
  }
  /* la recherche se fait sur la CLÉ ; si le lien a disparu entre l'ouverture du
     formulaire et son rendu, on referme au lieu de planter */
  function creForm(ref){
    var neuf=(ref==="new"), p=null;
    if(!neuf){
      var parts=ref.split("\u0001");
      tousCreances().forEach(function(x){ if(x.pseudo===parts[0] && x.cle===parts[1]) p=x; });
      if(!p){ creEdit=null; return ""; }
    }
    var l=p?p.lien:{};
    return '<div class="tdlb-bra-form">'
      + (neuf ? '<div><label>'+T.contact+'</label><select class="tdlb-in" data-cf="pseudo">'+optTousMembres("")+'</select></div>'
              : '<div><label>'+T.contact+'</label><div class="fixe">'+escH(p.pseudo)+'</div></div>')
      + '<div><label>'+T.nature+'</label><select class="tdlb-in" data-cf="nature">'+optNatures(l.nature||"materiel")+'</select></div>'
      + '<div><label>'+T.detail+'</label><input class="tdlb-in" data-cf="detail" value="'+escA(l.detail||"")+'" placeholder="Ce qu\u2019il fournira, et dans quelles limites…"></div>'
      + '<div class="btns"><button class="tdlb-btn prim" data-csave="'+(neuf?"new":escA(ref))+'">'+BHL.T.enregistrer+'</button>'
      +   '<button class="tdlb-btn" data-ccancel="1">'+BHL.T.annuler+'</button></div></div>';
  }

  function render(host){
    var list=BHL.membresDeBande(BANDE);
    var cartes=list.map(carteHTML).join("");
    if(edit==="new") cartes = editeurHTML(null) + cartes;
    host.innerHTML = BHL.heroHTML(BANDE, { emblem:"fi-tr-snake", stats:stats(list) })
      + '<div class="tdlb-body">'
      +   (creEdit ? creForm(creEdit) : "")
      +   (cartes ? '<div class="tdlb-sor-grid">'+cartes+'</div>' : '<div class="tdlb-empty">'+BHL.T.vide+'</div>')
      +   creancesSection()
      + '</div>';
    brancher(host);
  }

  /* ---------- events ---------- */
  function lire(host){ var o={}; host.querySelectorAll(".editing [data-f]").forEach(function(el){ o[el.dataset.f]=el.value.trim(); }); return o; }
  function fermer(){ edit=null; creEdit=null; }
  function brancher(host){
    host.querySelectorAll("[data-edit]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); fermer(); edit=b.dataset.edit; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-rm]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); if(window.confirm(BHL.T.confirmRetrait(b.dataset.rm))) BHL.appliquer(b.dataset.rm, null); }); });
    host.querySelectorAll("[data-cancel]").forEach(function(b){ b.addEventListener("click", function(){ fermer(); BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-save]").forEach(function(b){ b.addEventListener("click", function(){
      var v=lire(host), neuf=b.dataset.save==="new";
      var pseudo=neuf ? ((host.querySelector('[data-f="pseudo"]')||{}).value||"") : b.dataset.save;
      if(!pseudo || !v.role) return; fermer();
      BHL.appliquer(pseudo, { bande:BANDE, role:v.role, lieu:v.lieu||"", depuis:v.depuis||"" });
    }); });

    /* créances */
    host.querySelectorAll("[data-cedit]").forEach(function(b){ b.addEventListener("click", function(){ fermer(); creEdit=b.dataset.cedit; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-ccancel]").forEach(function(b){ b.addEventListener("click", function(){ fermer(); BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-crm]").forEach(function(b){ b.addEventListener("click", function(){
      var parts=b.dataset.crm.split("\u0001"), pseudo=parts[0], cle=parts[1];
      if(!exigeCles(pseudo)) return;
      if(!window.confirm(T.confirmRegler(pseudo))) return;
      retirerLien(pseudo, cle);
    }); });
    host.querySelectorAll("[data-csave]").forEach(function(b){ b.addEventListener("click", function(){
      var v={}; host.querySelectorAll(".tdlb-bra-form [data-cf]").forEach(function(el){ v[el.dataset.cf]=el.value.trim(); });
      if(b.dataset.csave==="new"){
        var pseudo=v.pseudo||"";
        if(!pseudo || !v.detail) return;
        if(!exigeCles(pseudo)) return;
        fermer();
        majLien(pseudo, window.TDLBase.nouvelleCle(),
          { type:"creance_sorcieres", statut:"du", nature:v.nature||"materiel", detail:v.detail, date:new Date().toISOString() });
      } else {
        var parts=b.dataset.csave.split("\u0001"), ps=parts[0], cle=parts[1];
        if(!exigeCles(ps)) return;
        var anc=lienEnBase(ps, cle);
        if(!anc){ BHL.toast(T.disparu); fermer(); BHL.rendreOnglet(); BHL.renderActionbar(); return; }
        fermer();
        majLien(ps, cle, Object.assign({}, anc, { nature:v.nature||anc.nature, detail:v.detail||anc.detail }));
      }
      BHL.renderActionbar();
    }); });
  }
  function bouton(bar, icone, texte, fn, cls){
    var b=document.createElement("button"); b.className="tdlb-btn"+(cls?" "+cls:"");
    b.innerHTML='<i class="fi '+icone+'"></i> '+texte; b.addEventListener("click", fn); bar.appendChild(b);
  }
  function renderActions(bar){
    if(edit || creEdit) return;   // un formulaire est déjà ouvert
    bouton(bar, "fi-tr-plus", BHL.T.ajouter, function(){ fermer(); edit="new"; BHL.rendreOnglet(); BHL.renderActionbar(); }, "add");
    bouton(bar, "fi-tr-file-signature", T.ajouterCreance, function(){ fermer(); creEdit="new"; BHL.rendreOnglet(); BHL.renderActionbar(); });
  }

  BHL.enregistrerOnglet(BANDE, { render:render, renderActions:renderActions });

})(window.BHL);
