/* ============================================================
   TDL — BANDES HORS-LA-LOI · ONGLET LA MAIN DE LA PROVIDENCE
   (tdl-bohl-main.js) — à charger APRÈS tdl-bohl-core.js.

   Affiliation pleine (hors_la_loi) :
     · La Main (le Chef)  → { bande:"main", type:"main" }            (Jason, posé par le staff)
     · Cavalier           → { bande:"main", type:"cavalier", depuis }
     · Doigt              → { bande:"main", type:"doigt", doigt, role, depuis, chef }
   Réseau d'influence (liens, cumulables) :
     · { type:"reseau_main", categorie, role, statut }
   Contenu éditable (staff) : bandes/main (cav_texte, reseau_texte) et bandes/main/doigts/{key} (chef, chef_url).
   Réemploi CSS : .tdlb-flo-cap (Dirigé par) · .tdlb-flo-pilier (réseau) · .tdlb-bra-stack (membres).
   ============================================================ */
(function (BHL) {
  "use strict";
  var BANDE="main", CONF=window.BHL_CONFIG.bandes[BANDE];
  var DOIGTS=CONF.doigts, ORDRE=CONF.ordre_doigts, CAT=CONF.reseau_cat, STATUTS=CONF.statuts;
  var $=BHL.$, escH=BHL.escH, escA=BHL.escA, ini=BHL.initiales, vt=BHL.vt;

  var T = { membres:"Membres", doigts:"Doigts", reseau:"Réseau d'influence",
            chefLbl:"La Main", fondateur:"Fondateur & vision d'ensemble", aDefinir:"À définir",
            cavaliers:"Les Cavaliers", dirige:"Dirigé par", tous:"Tous", dette:"Dette / service",
            porteur:"Doigt", concours:"Situation vis-à-vis de la Main" };
  var memEdit=null;    // hors_la_loi : null | "new" | pseudo
  var doigtEdit=null;  // chef d'un Doigt (PL) : null | key
  var resEdit=null;    // réseau (lien) : null | "new" | "pseudo\u0001idx"
  var texteEdit=null;  // texte éditable : null | "cav" | "reseau"
  var filtre="tous";   // filtre du réseau

  /* ================= données ================= */
  function membres(){ return BHL.membresDeBande(BANDE); }
  function chef(){ return membres().filter(function(m){ return m.hll.type==="main"; })[0]||null; }
  function cavaliers(){ return membres().filter(function(m){ return m.hll.type==="cavalier"; }); }
  function doigtMembres(key){ return membres().filter(function(m){ return m.hll.type==="doigt" && m.hll.doigt===key; }); }
  function doigtChefReel(key){ return doigtMembres(key).filter(function(m){ return m.hll.chef; })[0]||null; }

  function ovMain(){ return (BHL.rec.bandes&&BHL.rec.bandes.main)||{}; }
  function texte(cle){ var o=ovMain(); return (o[cle]!=null)?o[cle]:(CONF[cle]||""); }
  function doigtData(key){
    var s=DOIGTS[key]||{}, o=(ovMain().doigts&&ovMain().doigts[key])||{};
    return { nom:s.nom, emoji:s.emoji||"", tagline:s.tagline||"",
      chef:(o.chef!=null?o.chef:(s.chef||"")), chef_url:(o.chef_url!=null?o.chef_url:(s.chef_url||"")) };
  }
  function tousReseau(){
    var ms=BHL.rec.membres||{}, out=[];
    Object.keys(ms).forEach(function(pseudo){
      var m=ms[pseudo]||{};
      vt(m.liens).forEach(function(l,idx){
        if(l && l.type==="reseau_main")
          out.push({ pseudo:pseudo, uid:m.uid||null, avatar:BHL.avatarDe(pseudo), couleur:BHL.couleurGroupe(m.group), idx:idx, lien:l });
      });
    });
    return out.sort(function(a,b){ return a.pseudo.localeCompare(b.pseudo,"fr"); });
  }
  function ecrireLiens(pseudo, arr){
    BHL.rec.membres[pseudo]=BHL.rec.membres[pseudo]||{};
    BHL.rec.membres[pseudo].liens = arr.length?arr:null;
    BHL.rendreOnglet();
    BHL.PERSIST.champ("membres/"+pseudo+"/liens", arr.length?arr:null).catch(function(){ BHL.toast(BHL.T.errEcriture); });
  }

  /* ================= helpers ================= */
  function avImg(m){ return m.avatar ? '<img src="'+escA(m.avatar)+'" alt="">' : escH(ini(m.nom||m.pseudo||"?")); }
  function lienProfil(m){ return m.uid ? ' <a class="tdlb-card-link" href="/u'+m.uid+'" title="Profil"><i class="fi fi-tr-arrow-up-right-from-square"></i></a>' : ""; }
  function optMembres(sel){ return '<option value="">'+BHL.T.choisir+'</option>'+BHL.tousMembres().map(function(p){ return '<option value="'+escA(p)+'"'+(p===sel?" selected":"")+'>'+escH(p)+'</option>'; }).join(""); }
  function optDoigts(sel){ return ORDRE.map(function(k){ return '<option value="'+k+'"'+(k===sel?" selected":"")+'>'+escH(DOIGTS[k].nom)+'</option>'; }).join(""); }
  function optCat(sel){ return Object.keys(CAT).map(function(k){ return '<option value="'+k+'"'+(k===sel?" selected":"")+'>'+escH(CAT[k])+'</option>'; }).join(""); }
  function optStatut(sel){ return '<option value="">— aucune —</option>'+Object.keys(STATUTS).map(function(k){ return '<option value="'+k+'"'+(k===sel?" selected":"")+'>'+escH(STATUTS[k])+'</option>'; }).join(""); }
  function membreHTML(m){
    var tip='<span class="tip"><b>'+escH(m.nom)+'</b><span>'+escH(m.hll.role||"Membre")+(m.hll.depuis?' · '+BHL.T.depuis+' '+escH(m.hll.depuis):'')+'</span>'
      + (BHL.S.admin ? '<span class="tipbtns"><button data-medit="'+escA(m.pseudo)+'">'+BHL.T.modifier+'</button><button data-mrm="'+escA(m.pseudo)+'">'+BHL.T.retirer+'</button></span>' : "")
      + '</span>';
    return '<div class="tdlb-bra-mwrap" style="--gc:'+m.couleur+'"><a class="tdlb-bra-mav" href="'+(m.uid?'/u'+m.uid:'#')+'" title="'+escA(m.nom)+'">'+avImg(m)+'</a>'+tip+'</div>';
  }
  function pen(data, titre){ return BHL.S.admin ? '<button class="tdlb-ic" '+data+' title="'+titre+'"><i class="fi fi-tr-pencil"></i></button>' : ""; }
  function actes(pseudo){ return '<div class="actes"><button class="tdlb-ic" data-medit="'+escA(pseudo)+'" title="'+BHL.T.modifier+'"><i class="fi fi-tr-pencil"></i></button>'
      + '<button class="tdlb-ic" data-mrm="'+escA(pseudo)+'" title="'+BHL.T.retirer+'"><i class="fi fi-tr-trash"></i></button></div>'; }

  /* ================= rendu : chef ================= */
  function chefBlock(){
    var c=chef();
    var interne = c
      ? '<span class="av">'+avImg(c)+'</span><div class="who"><span class="lbl">'+T.chefLbl+'</span>'
        + '<span class="nom">'+escH(c.nom)+' <i class="fi fi-sr-star"></i>'+lienProfil(c)+'</span>'
        + '<span class="sub">'+T.fondateur+'</span></div>'+(BHL.S.admin?actes(c.pseudo):"")
      : '<div class="who"><span class="lbl">'+T.chefLbl+'</span><span class="nom" style="color:var(--darkopa5)">'+T.aDefinir+'</span></div>';
    return '<div class="tdlb-main-chef"><div class="ident">'+interne+'</div>'
      + '<div class="cit">'+escH(CONF.citation).replace(/\.\s+/g,".<br>")+'</div></div>';
  }

  /* ================= rendu : cavaliers ================= */
  function cavCard(m){
    return '<div class="tdlb-main-cavcard" style="--gc:'+m.couleur+'">'
      + '<span class="av">'+avImg(m)+'</span>'
      + '<div class="info"><span class="nom">'+escH(m.nom)+lienProfil(m)+'</span>'
      +   '<span class="since">'+BHL.T.depuis+' '+escH(m.hll.depuis||"—")+'</span></div>'
      + (BHL.S.admin?actes(m.pseudo):"") + '</div>';
  }
  function cavSection(){
    var cav=cavaliers();
    var txt = texteEdit==="cav"
      ? '<div class="tdlb-main-tedit"><textarea class="tdlb-in" id="tdlb-main-cav" rows="6">'+escH(texte("cav_texte"))+'</textarea>'
        + '<div class="btns"><button class="tdlb-btn prim" data-tsave="cav">'+BHL.T.enregistrer+'</button><button class="tdlb-btn" data-tcancel="1">'+BHL.T.annuler+'</button></div></div>'
      : '<p class="tdlb-main-desc">'+escH(texte("cav_texte"))+'</p>';
    return '<section class="tdlb-main-cav"><div class="tdlb-main-h"><i class="fi fi-sr-chess-knight"></i><h3>'+T.cavaliers+'</h3>'
      + (texteEdit==="cav"?"":pen('data-tedit="cav"',"Modifier le texte"))+'</div>'
      + '<div class="tdlb-main-cavbody"><div class="tdlb-main-cavtxt">'+txt+'</div>'
      +   (cav.length?'<div class="tdlb-main-cavgrid">'+cav.map(cavCard).join("")+'</div>':'<div class="tdlb-empty">Aucun Cavalier recensé.</div>')
      + '</div></section>';
  }

  /* ================= rendu : Doigts ================= */
  function chefDoigtHTML(key){
    var reel=doigtChefReel(key), d=doigtData(key);
    if(reel){
      return '<div class="tdlb-flo-cap" style="--gc:'+reel.couleur+'"><span class="av">'+avImg(reel)+'</span>'
        + '<div class="info"><span class="lbl">'+T.dirige+'</span><span class="nom">'+escH(reel.nom)+lienProfil(reel)+'</span></div>'
        + (BHL.S.admin?pen('data-dedit="'+escA(key)+'"',"Éditer le porteur (PL)"):"")+'</div>';
    }
    var pl = d.chef ? '<span class="nom">'+escH(d.chef)+' <a class="tag-pl" href="'+escA(d.chef_url||"#")+'">PL</a></span>'
                    : '<span class="nom" style="color:var(--darkopa5)">'+T.aDefinir+'</span>';
    return '<div class="tdlb-flo-cap"><span class="av">'+(d.chef?escH(ini(d.chef)):'?')+'</span>'
      + '<div class="info"><span class="lbl">'+T.dirige+'</span>'+pl+'</div>'
      + (BHL.S.admin?pen('data-dedit="'+escA(key)+'"',"Éditer le porteur (PL)"):"")+'</div>';
  }
  function doigtEditForm(key){
    var d=doigtData(key);
    return '<div class="tdlb-flo-nedit"><label>Porteur (pré-lien)</label><input class="tdlb-in" id="tdlb-main-dchef" value="'+escA(d.chef)+'" placeholder="Nom du porteur">'
      + '<label>Lien du pré-lien (URL)</label><input class="tdlb-in" id="tdlb-main-durl" value="'+escA(d.chef_url)+'" placeholder="https://…">'
      + '<div class="btns"><button class="tdlb-btn prim" data-dsave="'+escA(key)+'">'+BHL.T.enregistrer+'</button><button class="tdlb-btn" data-dcancel="1">'+BHL.T.annuler+'</button></div></div>';
  }
  function doigtCard(key){
    var d=doigtData(key), mem=doigtMembres(key).filter(function(m){ return !m.hll.chef; });
    return '<article class="tdlb-main-doigt">'
      + '<div class="dtop"><span class="emoji">'+escH(d.emoji)+'</span><div><h3>'+escH(d.nom)+'</h3><p class="cit">'+escH(d.tagline)+'</p></div></div>'
      + (doigtEdit===key ? doigtEditForm(key) : chefDoigtHTML(key))
      + '<div class="dmembres"><div class="tdlb-bra-lbl">'+T.membres+' ('+mem.length+')</div>'
      +   '<div class="tdlb-bra-stack">'+ (mem.length?mem.map(membreHTML).join(""):'<span style="font-family:var(--font2);font-style:italic;color:var(--darkopa5)">—</span>') +'</div></div>'
      + '</article>';
  }

  /* ================= rendu : réseau ================= */
  function filtres(){
    var b='<button class="tdlb-main-rf'+(filtre==="tous"?" on":"")+'" data-filtre="tous">'+T.tous+'</button>';
    b += Object.keys(CAT).map(function(k){ return '<button class="tdlb-main-rf'+(filtre===k?" on":"")+'" data-filtre="'+k+'">'+escH(CAT[k])+'</button>'; }).join("");
    return b;
  }
  function reseauCard(p){
    var l=p.lien, key=p.pseudo+"\u0001"+p.idx;
    var dette = l.statut ? '<span class="tag-dette '+escA(l.statut)+'">'+escH(STATUTS[l.statut]||l.statut)+'</span>' : '';
    var ac = BHL.S.admin ? '<div class="actes"><button class="tdlb-ic" data-redit="'+escA(key)+'" title="'+BHL.T.modifier+'"><i class="fi fi-tr-pencil"></i></button>'
      + '<button class="tdlb-ic" data-rrm="'+escA(key)+'" title="'+BHL.T.retirer+'"><i class="fi fi-tr-trash"></i></button></div>' : "";
    return '<div class="tdlb-flo-pilier" style="--gc:'+p.couleur+'">'+ac
      + '<span class="av">'+(p.avatar?'<img src="'+escA(p.avatar)+'" alt="">':escH(ini(p.pseudo)))+'</span>'
      + '<div class="info"><span class="nom">'+escH(p.pseudo)+(p.uid?' <a class="tdlb-card-link" href="/u'+p.uid+'"><i class="fi fi-tr-arrow-up-right-from-square"></i></a>':'')+'</span>'
      +   '<span class="concours">'+escH(l.role||"—")+'</span>'
      +   (dette?'<div class="bas">'+dette+'</div>':'')
      + '</div></div>';
  }
  function reseauSection(){
    var res=tousReseau().filter(function(p){ return filtre==="tous" || p.lien.categorie===filtre; });
    var txt = texteEdit==="reseau"
      ? '<div class="tdlb-main-tedit"><textarea class="tdlb-in" id="tdlb-main-res" rows="2">'+escH(texte("reseau_texte"))+'</textarea>'
        + '<div class="btns"><button class="tdlb-btn prim" data-tsave="reseau">'+BHL.T.enregistrer+'</button><button class="tdlb-btn" data-tcancel="1">'+BHL.T.annuler+'</button></div></div>'
      : '<p class="tdlb-main-desc">'+escH(texte("reseau_texte"))+(texteEdit?"":' '+pen('data-tedit="reseau"',"Modifier le texte"))+'</p>';
    return '<section class="tdlb-main-reseau">'
      + '<div class="tdlb-main-rhead"><div class="rleft"><div class="tdlb-main-h"><i class="fi fi-tr-share"></i><h3>'+T.reseau+'</h3></div>'+txt+'</div>'
      +   '<div class="tdlb-main-rfiltres">'+filtres()+'</div></div>'
      + (res.length?'<div class="tdlb-flo-pgrid">'+res.map(reseauCard).join("")+'</div>':'<div class="tdlb-empty">Aucun contact dans cette catégorie.</div>')
      + '</section>';
  }

  /* ================= formulaires ================= */
  function ch(l,inner){ return '<div><label>'+l+'</label>'+inner+'</div>'; }
  function memForm(m){
    var neuf=!m, type=m?m.hll.type:"cavalier";
    return '<div class="tdlb-bra-form">'
      + (neuf?ch("Membre",'<select class="tdlb-in" data-f="pseudo">'+optMembres("")+'</select>'):'<div><label>Membre</label><div class="fixe">'+escH(m.nom)+'</div></div>')
      + ch("Position",'<select class="tdlb-in" data-f="type" id="tdlb-main-type"><option value="main"'+(type==="main"?" selected":"")+'>La Main (le Chef)</option><option value="cavalier"'+(type==="cavalier"?" selected":"")+'>Cavalier</option><option value="doigt"'+(type==="doigt"?" selected":"")+'>Doigt</option></select>')
      + '<div data-doigtonly style="display:'+(type==="doigt"?"contents":"none")+'">'
      +   ch("Doigt",'<select class="tdlb-in" data-f="doigt">'+optDoigts(m?m.hll.doigt:ORDRE[0])+'</select>')
      +   ch("Rôle",'<input class="tdlb-in" data-f="role" value="'+escA(m?m.hll.role:"")+'">')
      +   '<div class="chk"><label><input type="checkbox" data-f="chef" '+((m&&m.hll.chef)?"checked":"")+'> '+T.porteur+'</label></div>'
      + '</div>'
      + ch(BHL.T.depuis+" (année)",'<input class="tdlb-in" data-f="depuis" value="'+escA(m?m.hll.depuis:"")+'" placeholder="2020">')
      + '<div class="btns"><button class="tdlb-btn prim" data-msave="'+(neuf?"new":escA(m.pseudo))+'">'+BHL.T.enregistrer+'</button><button class="tdlb-btn" data-fcancel="1">'+BHL.T.annuler+'</button></div></div>';
  }
  function resForm(ref){
    var neuf=(ref==="new"), p=null;
    if(!neuf){ var pr=ref.split("\u0001"); tousReseau().forEach(function(x){ if(x.pseudo===pr[0]&&String(x.idx)===pr[1]) p=x; }); }
    var l=p?p.lien:{};
    return '<div class="tdlb-bra-form">'
      + (neuf?ch("Contact",'<select class="tdlb-in" data-f="pseudo">'+optMembres("")+'</select>'):'<div><label>Contact</label><div class="fixe">'+escH(p.pseudo)+'</div></div>')
      + ch("Catégorie",'<select class="tdlb-in" data-f="categorie">'+optCat(l.categorie||"entreprises")+'</select>')
      + ch(T.concours,'<input class="tdlb-in" data-f="role" value="'+escA(l.role||"")+'" placeholder="Fournisseur, informateur, commerce protégé…">')
      + ch(T.dette,'<select class="tdlb-in" data-f="statut">'+optStatut(l.statut||"")+'</select>')
      + '<div class="btns"><button class="tdlb-btn prim" data-rsave="'+(neuf?"new":escA(ref))+'">'+BHL.T.enregistrer+'</button><button class="tdlb-btn" data-fcancel="1">'+BHL.T.annuler+'</button></div></div>';
  }

  function render(host){
    var form="";
    if(memEdit) form=memForm(memEdit==="new"?null:membres().filter(function(m){return m.pseudo===memEdit;})[0]);
    else if(resEdit) form=resForm(resEdit);
    host.innerHTML = BHL.heroHTML(BANDE, { emblem:"fi-tr-hands-usd", stats:[
        { icon:"fi-tr-users-alt", label:T.membres, val:membres().length },
        { icon:"fi-tr-fingerprint", label:T.doigts, val:ORDRE.length },
        { icon:"fi-tr-share", label:T.reseau, val:tousReseau().length } ] })
      + '<div class="tdlb-body">'+form
      +   chefBlock() + cavSection()
      +   '<div class="tdlb-main-doigts">'+ORDRE.map(doigtCard).join("")+'</div>'
      +   reseauSection()
      + '</div>';
    brancher(host);
  }

  /* ================= events ================= */
  function fermer(){ memEdit=null; resEdit=null; doigtEdit=null; texteEdit=null; }
  function lireForm(host){ var o={}; host.querySelectorAll(".tdlb-bra-form [data-f]").forEach(function(el){ o[el.dataset.f]= el.type==="checkbox"?el.checked:el.value.trim(); }); return o; }
  function brancher(host){
    // bascule Doigt dans le formulaire membre
    var ts=$("tdlb-main-type");
    if(ts) ts.addEventListener("change", function(){ var w=host.querySelector("[data-doigtonly]"); if(w) w.style.display=(ts.value==="doigt")?"contents":"none"; });
    // membre (hors_la_loi)
    host.querySelectorAll("[data-medit]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); fermer(); memEdit=b.dataset.medit; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-mrm]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); if(window.confirm(BHL.T.confirmRetrait(b.dataset.mrm))) BHL.appliquer(b.dataset.mrm, null); }); });
    host.querySelectorAll("[data-msave]").forEach(function(b){ b.addEventListener("click", function(){
      var v=lireForm(host), neuf=b.dataset.msave==="new";
      var pseudo=neuf?((host.querySelector('[data-f="pseudo"]')||{}).value||""):b.dataset.msave; if(!pseudo) return;
      var hll={ bande:BANDE, type:v.type, depuis:v.depuis||"" };
      if(v.type==="doigt"){ hll.doigt=v.doigt; hll.role=v.role||""; hll.chef=!!v.chef; }
      fermer(); BHL.appliquer(pseudo, hll); BHL.renderActionbar();
    }); });
    // chef d'un Doigt (PL)
    host.querySelectorAll("[data-dedit]").forEach(function(b){ b.addEventListener("click", function(){ fermer(); doigtEdit=b.dataset.dedit; BHL.rendreOnglet(); }); });
    host.querySelectorAll("[data-dcancel]").forEach(function(b){ b.addEventListener("click", function(){ doigtEdit=null; BHL.rendreOnglet(); }); });
    host.querySelectorAll("[data-dsave]").forEach(function(b){ b.addEventListener("click", function(){
      var key=b.dataset.dsave, data={ chef:(($("tdlb-main-dchef")||{}).value||"").trim(), chef_url:(($("tdlb-main-durl")||{}).value||"").trim() };
      BHL.rec.bandes=BHL.rec.bandes||{}; var mm=BHL.rec.bandes.main=BHL.rec.bandes.main||{}; mm.doigts=mm.doigts||{};
      mm.doigts[key]=Object.assign({},mm.doigts[key],data); doigtEdit=null; BHL.rendreOnglet();
      BHL.PERSIST.champ("bandes/main/doigts/"+key, mm.doigts[key]).catch(function(){ BHL.toast(BHL.T.errEcriture); });
    }); });
    // textes éditables (cavaliers / réseau)
    host.querySelectorAll("[data-tedit]").forEach(function(b){ b.addEventListener("click", function(){ fermer(); texteEdit=b.dataset.tedit; BHL.rendreOnglet(); }); });
    host.querySelectorAll("[data-tcancel]").forEach(function(b){ b.addEventListener("click", function(){ texteEdit=null; BHL.rendreOnglet(); }); });
    host.querySelectorAll("[data-tsave]").forEach(function(b){ b.addEventListener("click", function(){
      var cle=b.dataset.tsave, champ=(cle==="cav"?"cav_texte":"reseau_texte");
      var val=(($(cle==="cav"?"tdlb-main-cav":"tdlb-main-res")||{}).value||"").trim();
      BHL.rec.bandes=BHL.rec.bandes||{}; var mm=BHL.rec.bandes.main=BHL.rec.bandes.main||{}; mm[champ]=val;
      texteEdit=null; BHL.rendreOnglet();
      BHL.PERSIST.champ("bandes/main/"+champ, val).catch(function(){ BHL.toast(BHL.T.errEcriture); });
    }); });
    // réseau (liens)
    host.querySelectorAll("[data-filtre]").forEach(function(b){ b.addEventListener("click", function(){ filtre=b.dataset.filtre; BHL.rendreOnglet(); }); });
    host.querySelectorAll("[data-redit]").forEach(function(b){ b.addEventListener("click", function(){ fermer(); resEdit=b.dataset.redit; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-rrm]").forEach(function(b){ b.addEventListener("click", function(){
      var pr=b.dataset.rrm.split("\u0001"), pseudo=pr[0], idx=+pr[1];
      if(!window.confirm("Retirer ce contact du réseau ?")) return;
      var arr=vt(BHL.rec.membres[pseudo].liens); arr.splice(idx,1); ecrireLiens(pseudo, arr);
    }); });
    host.querySelectorAll("[data-rsave]").forEach(function(b){ b.addEventListener("click", function(){
      var v=lireForm(host), neuf=b.dataset.rsave==="new";
      if(neuf){ var pseudo=(host.querySelector('[data-f="pseudo"]')||{}).value||""; if(!pseudo||!v.role) return;
        var arr=vt(BHL.rec.membres[pseudo]&&BHL.rec.membres[pseudo].liens);
        arr.push({ type:"reseau_main", categorie:v.categorie, role:v.role, statut:v.statut||null }); fermer(); ecrireLiens(pseudo, arr);
      } else { var pr=b.dataset.rsave.split("\u0001"), ps=pr[0], idx=+pr[1]; var a=vt(BHL.rec.membres[ps].liens);
        if(a[idx]) a[idx]=Object.assign({},a[idx],{ categorie:v.categorie, role:v.role, statut:v.statut||null }); fermer(); ecrireLiens(ps, a); }
      BHL.renderActionbar();
    }); });
    // annulation générique
    host.querySelectorAll("[data-fcancel]").forEach(function(b){ b.addEventListener("click", function(){ fermer(); BHL.rendreOnglet(); BHL.renderActionbar(); }); });
  }

  function bouton(bar,icone,texte,fn){ var b=document.createElement("button"); b.className="tdlb-btn"; b.innerHTML='<i class="fi '+icone+'"></i> '+texte; b.addEventListener("click",fn); bar.appendChild(b); }
  function renderActions(bar){
    if(memEdit||resEdit) return;
    bouton(bar,"fi-tr-user-add", BHL.T.ajouter, function(){ fermer(); memEdit="new"; BHL.rendreOnglet(); BHL.renderActionbar(); });
    bar.lastChild.classList.add("add");
    bouton(bar,"fi-tr-share", "Ajouter au réseau", function(){ fermer(); resEdit="new"; BHL.rendreOnglet(); BHL.renderActionbar(); });
  }

  BHL.enregistrerOnglet(BANDE, { render:render, renderActions:renderActions });

})(window.BHL);
