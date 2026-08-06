/* ============================================================
   TDL — BANDES HORS-LA-LOI · ONGLET FLOTTILLE
   (tdl-bohl-flottille.js) — à charger APRÈS tdl-bohl-core.js.

   DEUX sources :
     · navires (équipage / indépendant) → membres/{pseudo}.hors_la_loi
         = { bande:"flottille", navire, capitaine, role, depuis }
     · piliers de la terre ferme → membres/{pseudo}.liens[] (cumulables)
         = { type:"pilier_flottille", concours, statut }
   Contenu navire éditable (staff OU capitaine) : bandes/flottille/navires/{key} = { image, spec, zones, … }.
   Capitaine canon affiché en pré-lien (tag PL) tant qu'aucun membre ne tient la barre.
   ============================================================ */
(function (BHL) {
  "use strict";
  var BANDE="flottille", CONF=window.BHL_CONFIG.bandes[BANDE], NAV=CONF.navires;
  var STATUTS=window.BHL_CONFIG.bandes.main.statuts;   // service dû / dette prioritaire / dette longue
  var $=BHL.$, escH=BHL.escH, escA=BHL.escA, ini=BHL.initiales, vt=BHL.vt;

  var T = { membres:"Membres", navires:"Navires", contacts:"Contacts", capitaine:"Capitaine",
            equipage:"Équipage", independant:"Indépendant", zones:"Zones naviguées", spec:"Spécialité",
            piliers:"Les Piliers de la terre ferme",
            piliersTxt:"Ils ne sont pas membres de la Flottille, mais en sont des contacts indispensables.",
            concours:"Concours apporté", dette:"Dette / service", aDefinir:"À définir",
            creerNavire:"Créer un navire", nomNavire:"Nom du navire", image:"Image (URL)" };
  // états d'édition (un formulaire à la fois)
  var memEdit=null;    // membre équipage/indépendant : null | "new" | pseudo
  var navEdit=null;    // contenu navire : null | key
  var navCreate=false; // création de navire
  var pilEdit=null;    // pilier : null | "new" | "pseudo\u0001idx"
  var zonesWork=[];    // zones en cours d'édition

  /* ================= données navires ================= */
  function ovNav(key){ var b=BHL.rec.bandes&&BHL.rec.bandes.flottille&&BHL.rec.bandes.flottille.navires; return (b&&b[key])||null; }
  function navData(key){
    var s=NAV[key]||{}, o=ovNav(key)||{};
    return { key:key, nom:o.nom||s.nom||key, spec:(o.spec!=null?o.spec:s.spec)||"",
      zones:(o.zones? vt(o.zones):(s.zones||[])), image:(o.image!=null?o.image:(s.image||"")),
      independant:(o.independant!=null?!!o.independant:!!s.independant),
      cap:(o.cap!=null?o.cap:(s.cap||"")), cap_url:(o.cap_url!=null?o.cap_url:(s.cap_url||"")), cree:!NAV[key] };
  }
  function tousNavires(){
    var keys={}; Object.keys(NAV).forEach(function(k){keys[k]=1;});
    var o=BHL.rec.bandes&&BHL.rec.bandes.flottille&&BHL.rec.bandes.flottille.navires;
    if(o) Object.keys(o).forEach(function(k){keys[k]=1;});
    return Object.keys(keys).map(navData);
  }
  function membresNavire(key){ return BHL.membresDeBande(BANDE).filter(function(m){ return m.hll.navire===key; }); }
  function capReel(key){ return membresNavire(key).filter(function(m){ return m.hll.capitaine; })[0]||null; }
  function peutEditerNavire(key){ var c=capReel(key); return BHL.S.admin || !!(c && c.pseudo===BHL.monPseudo); }

  /* ================= données piliers (liens) ================= */
  function tousPiliers(){
    var membres=BHL.rec.membres||{}, out=[];
    Object.keys(membres).forEach(function(pseudo){
      var m=membres[pseudo]||{};
      vt(m.liens).forEach(function(l,idx){
        if(l && l.type==="pilier_flottille")
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
  function optionsMembres(sel){
    return '<option value="">'+BHL.T.choisir+'</option>' + BHL.tousMembres().map(function(p){
      return '<option value="'+escA(p)+'"'+(p===sel?" selected":"")+'>'+escH(p)+'</option>';
    }).join("");
  }
  function optionsNavires(sel){ return tousNavires().map(function(n){ return '<option value="'+escA(n.key)+'"'+(n.key===sel?" selected":"")+'>'+escH(n.nom)+'</option>'; }).join(""); }
  function optionsStatut(sel){ return '<option value="">— aucune —</option>'+Object.keys(STATUTS).map(function(k){ return '<option value="'+k+'"'+(k===sel?" selected":"")+'>'+escH(STATUTS[k])+'</option>'; }).join(""); }
  function membreHTML(m){
    var tip='<span class="tip"><b>'+escH(m.nom)+'</b><span>'+escH(m.hll.role||"Équipier")+(m.hll.depuis?' · '+BHL.T.depuis+' '+escH(m.hll.depuis):'')+'</span>'
      + (BHL.S.admin ? '<span class="tipbtns"><button data-medit="'+escA(m.pseudo)+'">'+BHL.T.modifier+'</button><button data-mrm="'+escA(m.pseudo)+'">'+BHL.T.retirer+'</button></span>' : "")
      + '</span>';
    var href=m.uid?'/u'+m.uid:'#';
    return '<div class="tdlb-bra-mwrap" style="--gc:'+m.couleur+'"><a class="tdlb-bra-mav" href="'+escA(href)+'" title="'+escA(m.nom)+'">'+avImg(m)+'</a>'+tip+'</div>';
  }

  /* ================= rendu ================= */
  function stats(){
    return [
      { icon:"fi-tr-users-alt", label:T.membres,  val:BHL.membresDeBande(BANDE).length },
      { icon:"fi-tr-sailboat",  label:T.navires,  val:tousNavires().length },
      { icon:"fi-tr-handshake",  label:T.contacts, val:tousPiliers().length },
    ];
  }
  function capitaineHTML(nav){
    var reel=capReel(nav.key), indep=nav.independant;
    var tagIndep = indep ? '<span class="tag-indep">'+T.independant+'</span>' : '';
    if(reel){
      return '<div class="tdlb-flo-cap" style="--gc:'+reel.couleur+'"><span class="av">'+avImg(reel)+'</span>'
        + '<div class="info"><span class="lbl">'+T.capitaine+'</span>'
        +   '<span class="nom">'+escH(reel.nom)+lienProfil(reel)+'</span>'+tagIndep+'</div></div>';
    }
    if(!nav.cap){
      return '<div class="tdlb-flo-cap"><div class="info"><span class="lbl">'+T.capitaine+'</span>'
        + '<span class="nom" style="color:var(--darkopa5)">'+T.aDefinir+'</span>'+tagIndep+'</div></div>';
    }
    var pl='<a class="tag-pl" href="'+escA(nav.cap_url||"#")+'">PL</a>';
    return '<div class="tdlb-flo-cap"><span class="av">'+escH(ini(nav.cap))+'</span>'
      + '<div class="info"><span class="lbl">'+T.capitaine+'</span>'
      +   '<span class="nom">'+escH(nav.cap)+' '+pl+'</span>'+tagIndep+'</div></div>';
  }
  function crewHTML(nav){
    var crew=membresNavire(nav.key).filter(function(m){ return !m.hll.capitaine; });
    return '<div class="tdlb-flo-crew"><div class="tdlb-flo-crewlbl">'+T.equipage+' ('+crew.length+')</div>'
      + '<div class="tdlb-bra-stack">'+ (crew.length?crew.map(membreHTML).join(""):'<span style="font-family:var(--font2);font-style:italic;color:var(--darkopa5)">—</span>') +'</div></div>';
  }
  function navEditForm(nav){
    return '<div class="tdlb-flo-nedit">'
      + '<label>'+T.image+'</label><input class="tdlb-in" id="tdlb-flo-img" value="'+escA(nav.image)+'" placeholder="https://…">'
      + '<label>'+T.spec+'</label><input class="tdlb-in" id="tdlb-flo-spec" value="'+escA(nav.spec)+'">'
      + '<label>'+T.zones+'</label><div class="tdlb-mc-edit" id="tdlb-flo-zones">'+zonesTags()+'</div>'
      + '<label>Capitaine (pré-lien)</label><input class="tdlb-in" id="tdlb-flo-cap" value="'+escA(nav.cap)+'" placeholder="Nom du pré-lien">'
      + '<label>Lien du pré-lien (URL)</label><input class="tdlb-in" id="tdlb-flo-capurl" value="'+escA(nav.cap_url)+'" placeholder="https://…">'
      + '<div class="btns"><button class="tdlb-btn prim" data-nsave="'+escA(nav.key)+'">'+BHL.T.enregistrer+'</button>'
      +   '<button class="tdlb-btn" data-ncancel="1">'+BHL.T.annuler+'</button></div></div>';
  }
  function zonesTags(){
    return zonesWork.map(function(z,i){ return '<span class="tag">'+escH(z)+'<button data-zx="'+i+'">✕</button></span>'; }).join("")
      + '<button class="tag-add" data-zadd="1">+</button>';
  }
  function carteNavire(nav){
    var editable=peutEditerNavire(nav.key);
    var editBtn = (editable && navEdit!==nav.key) ? '<button class="tdlb-ic tdlb-flo-editbtn" data-nedit="'+escA(nav.key)+'" title="Modifier le navire"><i class="fi fi-tr-pencil"></i></button>' : "";
    var visuel = nav.image
      ? '<div class="tdlb-flo-imgwrap"><img class="tdlb-flo-img" src="'+escA(nav.image)+'" alt="">'+editBtn+'</div>'
      : '<div class="tdlb-flo-imgwrap"><div class="tdlb-flo-noimg" data-ar="1.6"><i class="fi fi-tr-anchor"></i></div>'+editBtn+'</div>';
    var body;
    if(navEdit===nav.key){
      body = '<div class="tdlb-flo-name"><i class="fi fi-tr-anchor"></i>'+escH(nav.nom)+'</div>'+navEditForm(nav);
    } else {
      body = '<div class="tdlb-flo-name"><i class="fi fi-tr-anchor"></i>'+escH(nav.nom)+'</div>'
        + (nav.spec?'<span class="tdlb-flo-spec">'+escH(nav.spec)+'</span>':'')
        + (nav.zones.length?'<div class="tdlb-flo-zones">'+nav.zones.map(function(z){return '<span class="tdlb-flo-zone">'+escH(z)+'</span>';}).join("")+'</div>':'')
        + capitaineHTML(nav)
        + (nav.independant?'':crewHTML(nav));
    }
    return '<article class="tdlb-flo-card">'+visuel+'<div class="tdlb-flo-body">'+body+'</div></article>';
  }

  function pilierHTML(p){
    var l=p.lien, key=p.pseudo+"\u0001"+p.idx;
    var dette = l.statut ? '<span class="tag-dette '+escA(l.statut)+'">'+escH(STATUTS[l.statut]||l.statut)+'</span>' : '';
    var actes = BHL.S.admin ? '<div class="actes"><button class="tdlb-ic" data-pedit="'+escA(key)+'" title="'+BHL.T.modifier+'"><i class="fi fi-tr-pencil"></i></button>'
      + '<button class="tdlb-ic" data-prm="'+escA(key)+'" title="'+BHL.T.retirer+'"><i class="fi fi-tr-trash"></i></button></div>' : "";
    var lien = p.uid ? ' <a class="tdlb-card-link" href="/u'+p.uid+'"><i class="fi fi-tr-arrow-up-right-from-square"></i></a>' : "";
    return '<div class="tdlb-flo-pilier" style="--gc:'+p.couleur+'">'+actes
      + '<span class="av">'+(p.avatar?'<img src="'+escA(p.avatar)+'" alt="">':escH(ini(p.pseudo)))+'</span>'
      + '<div class="info"><span class="nom">'+escH(p.pseudo)+lien+'</span>'
      +   '<span class="concours">'+escH(l.concours||"—")+'</span>'
      +   (dette?'<div class="bas">'+dette+'</div>':'')
      + '</div></div>';
  }
  function piliersSection(){
    var pil=tousPiliers();
    return '<div class="tdlb-flo-psec"><div class="tdlb-flo-phead"><h3>'+escH(T.piliers)+'</h3><p>'+escH(T.piliersTxt)+'</p></div>'
      + (pil.length ? '<div class="tdlb-flo-pgrid">'+pil.map(pilierHTML).join("")+'</div>' : '<div class="tdlb-empty">Aucun contact recensé.</div>')
      + '</div>';
  }

  /* ---- formulaires (haut du body) ---- */
  function champ(l,inner){ return '<div><label>'+l+'</label>'+inner+'</div>'; }
  function navCreateForm(){
    return '<div class="tdlb-bra-form">'
      + champ(T.nomNavire,'<input class="tdlb-in" data-f="nom" placeholder="Le Nom">')
      + champ(T.spec,'<input class="tdlb-in" data-f="spec" placeholder="Extraction, transit…">')
      + champ(T.image,'<input class="tdlb-in" data-f="image" placeholder="https://…">')
      + '<div class="chk"><label><input type="checkbox" data-f="independant"> '+T.independant+' (solo)</label></div>'
      + '<div class="btns"><button class="tdlb-btn prim" data-ncreate="1">'+BHL.T.enregistrer+'</button>'
      +   '<button class="tdlb-btn" data-fcancel="1">'+BHL.T.annuler+'</button></div></div>';
  }
  function memForm(m){
    var neuf=!m;
    return '<div class="tdlb-bra-form">'
      + (neuf ? champ("Membre",'<select class="tdlb-in" data-f="pseudo">'+optionsMembres("")+'</select>')
              : '<div><label>Membre</label><div class="fixe">'+escH(m.nom)+'</div></div>')
      + champ("Navire",'<select class="tdlb-in" data-f="navire">'+optionsNavires(m?m.hll.navire:"")+'</select>')
      + champ("Rôle à bord",'<input class="tdlb-in" data-f="role" value="'+escA(m?m.hll.role:"")+'" placeholder="Mécanicien, guide…">')
      + champ(BHL.T.depuis+" (année)",'<input class="tdlb-in" data-f="depuis" value="'+escA(m?m.hll.depuis:"")+'" placeholder="2019">')
      + '<div class="chk"><label><input type="checkbox" data-f="capitaine" '+((m&&m.hll.capitaine)?"checked":"")+'> '+T.capitaine+'</label></div>'
      + '<div class="btns"><button class="tdlb-btn prim" data-msave="'+(neuf?"new":escA(m.pseudo))+'">'+BHL.T.enregistrer+'</button>'
      +   '<button class="tdlb-btn" data-fcancel="1">'+BHL.T.annuler+'</button></div></div>';
  }
  function pilForm(ref){
    var neuf=(ref==="new"), p=null;
    if(!neuf){ var parts=ref.split("\u0001"); tousPiliers().forEach(function(x){ if(x.pseudo===parts[0]&&String(x.idx)===parts[1]) p=x; }); }
    var l=p?p.lien:{};
    return '<div class="tdlb-bra-form">'
      + (neuf ? champ("Contact",'<select class="tdlb-in" data-f="pseudo">'+optionsMembres("")+'</select>')
              : '<div><label>Contact</label><div class="fixe">'+escH(p.pseudo)+'</div></div>')
      + champ(T.concours,'<input class="tdlb-in" data-f="concours" value="'+escA(l.concours||"")+'" placeholder="bacs de glace, faux papiers, contact radio…">')
      + champ(T.dette,'<select class="tdlb-in" data-f="statut">'+optionsStatut(l.statut||"")+'</select>')
      + '<div class="btns"><button class="tdlb-btn prim" data-psave="'+(neuf?"new":escA(ref))+'">'+BHL.T.enregistrer+'</button>'
      +   '<button class="tdlb-btn" data-fcancel="1">'+BHL.T.annuler+'</button></div></div>';
  }

  function render(host){
    var form="";
    if(navCreate) form=navCreateForm();
    else if(memEdit) form=memForm(memEdit==="new"?null:BHL.membresDeBande(BANDE).filter(function(m){return m.pseudo===memEdit;})[0]);
    else if(pilEdit) form=pilForm(pilEdit);
    host.innerHTML = BHL.heroHTML(BANDE, { emblem:"fi-tr-anchor", stats:stats() })
      + '<div class="tdlb-body">'+form
      +   '<div class="tdlb-flo-grid">'+tousNavires().map(carteNavire).join("")+'</div>'
      +   piliersSection()
      + '</div>';
    brancher(host);
    justifier(host);
  }

  /* ---- rangée justifiée : flex-grow ∝ ratio d'image ---- */
  function justifier(host){
    host.querySelectorAll(".tdlb-flo-card").forEach(function(card){
      var img=card.querySelector(".tdlb-flo-img"), noimg=card.querySelector(".tdlb-flo-noimg");
      function set(ar){ if(!ar||!isFinite(ar)) ar=1.6; card.style.flexGrow=ar; card.style.flexBasis=(ar*210)+"px"; }
      if(img){
        if(img.complete && img.naturalWidth) set(img.naturalWidth/img.naturalHeight);
        else { set(1.6); img.addEventListener("load", function(){ set(img.naturalWidth/img.naturalHeight); }); }
      } else if(noimg){ set(parseFloat(noimg.dataset.ar)); }
    });
  }

  /* ================= events ================= */
  function fermer(){ memEdit=null; navCreate=false; pilEdit=null; navEdit=null; }
  function slug(s){ return (s||"nav").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"").slice(0,16) || "nav"; }
  function lireForm(host){ var o={}; host.querySelectorAll(".tdlb-bra-form [data-f]").forEach(function(el){ o[el.dataset.f]= el.type==="checkbox"?el.checked:el.value.trim(); }); return o; }

  function brancher(host){
    // navire : édition contenu
    host.querySelectorAll("[data-nedit]").forEach(function(b){ b.addEventListener("click", function(){ fermer(); navEdit=b.dataset.nedit; zonesWork=navData(navEdit).zones.slice(); BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-ncancel]").forEach(function(b){ b.addEventListener("click", function(){ navEdit=null; BHL.rendreOnglet(); }); });
    var zbox=$("tdlb-flo-zones");
    if(zbox) zbox.addEventListener("click", function(e){
      var x=e.target.closest("[data-zx]"); if(x){ zonesWork.splice(+x.dataset.zx,1); zbox.innerHTML=zonesTags(); return; }
      if(e.target.closest("[data-zadd]")){ var inp=document.createElement("input"); inp.className="tdlb-in mc-in"; inp.placeholder="Nouvelle zone…";
        e.target.closest("[data-zadd]").replaceWith(inp); inp.focus();
        var fin=function(ok){ var v=inp.value.trim(); if(ok&&v) zonesWork.push(v); zbox.innerHTML=zonesTags(); };
        inp.addEventListener("keydown",function(ev){ if(ev.key==="Enter")fin(true); else if(ev.key==="Escape")fin(false); });
        inp.addEventListener("blur",function(){ fin(true); }); }
    });
    host.querySelectorAll("[data-nsave]").forEach(function(b){ b.addEventListener("click", function(){
      var key=b.dataset.nsave, data={ image:(($("tdlb-flo-img")||{}).value||"").trim(), spec:(($("tdlb-flo-spec")||{}).value||"").trim(), zones:zonesWork.slice(),
        cap:(($("tdlb-flo-cap")||{}).value||"").trim(), cap_url:(($("tdlb-flo-capurl")||{}).value||"").trim() };
      BHL.rec.bandes=BHL.rec.bandes||{}; var ff=BHL.rec.bandes.flottille=BHL.rec.bandes.flottille||{}; ff.navires=ff.navires||{};
      ff.navires[key]=Object.assign({}, ff.navires[key], data);
      navEdit=null; BHL.rendreOnglet();
      BHL.PERSIST.champ("bandes/flottille/navires/"+key, ff.navires[key]).catch(function(){ BHL.toast(BHL.T.errEcriture); });
    }); });

    // création de navire
    host.querySelectorAll("[data-ncreate]").forEach(function(b){ b.addEventListener("click", function(){
      var v=lireForm(host); if(!v.nom) return;
      var key=slug(v.nom)+Math.random().toString(36).slice(2,5);
      var data={ nom:v.nom, spec:v.spec||"", image:v.image||"", zones:[], independant:!!v.independant, cree:true };
      BHL.rec.bandes=BHL.rec.bandes||{}; var ff=BHL.rec.bandes.flottille=BHL.rec.bandes.flottille||{}; ff.navires=ff.navires||{}; ff.navires[key]=data;
      fermer(); BHL.rendreOnglet(); BHL.renderActionbar();
      BHL.PERSIST.champ("bandes/flottille/navires/"+key, data).catch(function(){ BHL.toast(BHL.T.errEcriture); });
    }); });

    // membre équipage/indépendant
    host.querySelectorAll("[data-medit]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); fermer(); memEdit=b.dataset.medit; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-mrm]").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); if(window.confirm(BHL.T.confirmRetrait(b.dataset.mrm))) BHL.appliquer(b.dataset.mrm, null); }); });
    host.querySelectorAll("[data-msave]").forEach(function(b){ b.addEventListener("click", function(){
      var v=lireForm(host), neuf=b.dataset.msave==="new";
      var pseudo=neuf ? ((host.querySelector('[data-f="pseudo"]')||{}).value||"") : b.dataset.msave;
      if(!pseudo || !v.navire) return; fermer();
      BHL.appliquer(pseudo, { bande:BANDE, navire:v.navire, capitaine:!!v.capitaine, role:v.role||"", depuis:v.depuis||"" });
      BHL.renderActionbar();
    }); });

    // pilier (lien)
    host.querySelectorAll("[data-pedit]").forEach(function(b){ b.addEventListener("click", function(){ fermer(); pilEdit=b.dataset.pedit; BHL.rendreOnglet(); BHL.renderActionbar(); }); });
    host.querySelectorAll("[data-prm]").forEach(function(b){ b.addEventListener("click", function(){
      var parts=b.dataset.prm.split("\u0001"), pseudo=parts[0], idx=+parts[1];
      if(!window.confirm("Retirer ce contact de la Flottille ?")) return;
      var arr=vt(BHL.rec.membres[pseudo].liens); arr.splice(idx,1); ecrireLiens(pseudo, arr);
    }); });
    host.querySelectorAll("[data-psave]").forEach(function(b){ b.addEventListener("click", function(){
      var v=lireForm(host), neuf=b.dataset.psave==="new";
      if(neuf){
        var pseudo=(host.querySelector('[data-f="pseudo"]')||{}).value||""; if(!pseudo||!v.concours) return;
        var arr=vt(BHL.rec.membres[pseudo]&&BHL.rec.membres[pseudo].liens);
        arr.push({ type:"pilier_flottille", concours:v.concours, statut:v.statut||null }); fermer(); ecrireLiens(pseudo, arr);
      } else {
        var parts=b.dataset.psave.split("\u0001"), ps=parts[0], idx=+parts[1];
        var a=vt(BHL.rec.membres[ps].liens); if(a[idx]){ a[idx]=Object.assign({},a[idx],{ concours:v.concours, statut:v.statut||null }); } fermer(); ecrireLiens(ps, a);
      }
      BHL.renderActionbar();
    }); });

    // annulation générique
    host.querySelectorAll("[data-fcancel]").forEach(function(b){ b.addEventListener("click", function(){ fermer(); BHL.rendreOnglet(); BHL.renderActionbar(); }); });
  }

  function bouton(bar,icone,texte,fn){ var b=document.createElement("button"); b.className="tdlb-btn"; b.innerHTML='<i class="fi '+icone+'"></i> '+texte; b.addEventListener("click",fn); bar.appendChild(b); }
  function renderActions(bar){
    if(navCreate||memEdit||pilEdit||navEdit) return;         // un formulaire est déjà ouvert
    bouton(bar,"fi-tr-sailboat", T.creerNavire, function(){ fermer(); navCreate=true; BHL.rendreOnglet(); BHL.renderActionbar(); });
    bouton(bar,"fi-tr-user-add", BHL.T.ajouter, function(){ fermer(); memEdit="new"; BHL.rendreOnglet(); BHL.renderActionbar(); });
    var b=bar.lastChild; b.classList.add("add");
    bouton(bar,"fi-tr-link", "Ajouter un contact", function(){ fermer(); pilEdit="new"; BHL.rendreOnglet(); BHL.renderActionbar(); });
  }

  BHL.enregistrerOnglet(BANDE, { render:render, renderActions:renderActions });

})(window.BHL);
