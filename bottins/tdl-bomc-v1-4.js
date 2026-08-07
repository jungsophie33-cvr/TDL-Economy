/* ============================================================
   TDL — REGISTRE PAROISSIAL (bottin multi-comptes) · tdl-bomc.js
   Namespace window.BMC. Lecture SEULE (aucune écriture Firebase).
   À charger via le loader Sophia OS, dans bottins/, APRÈS eco-core.

   Un joueur = un groupe doubles_comptes (ou un membre solo). Chaque
   personnage (compte) est joint à ses données réparties dans le record :
     avatar    ← faceclaims[pseudo].image      (repli initiales)
     commu     ← membres[pseudo].group          (scotch --grN)
     poste/ent ← emplois[*].roles + lieux[id].nom
     référent  ← emplois[id].referent === pseudo (picto)
     lieu      ← membres[pseudo].habitation.quartier (ou demande validée)
     ombre     ← membres[pseudo].hors_la_loi (Membre) + .liens (Contact)
     présent.  ← demande validée : lien_fiche

   Blocs : TEXTES · CONFIG · COMMU · UTILS · INDEX · DONNÉES · RENDU · EVENTS · INIT · BOOT
   ============================================================ */
window.BMC = window.BMC || {};
(function (BMC) {
  "use strict";

  /* ===================== TEXTES ===================== */
  var T = {
    perso:function(n){return n>1?"personnages":"personnage";},
    ref:function(n){return n>1?"entreprises gérées":"entreprise gérée";},
    ombre:function(n){return n>1?"affiliations de l'ombre":"affiliation de l'ombre";},
    pasOmbre:"Pas d'affiliation de l'ombre", membre:"Membre", contact:"Contact",
    sansEmploi:"Sans emploi", tiret:"—",
    lire:"Lire la présentation", voirProfil:"Voir le profil",
    accueil:"Accueil", editer:"Éditer ce message",
    vide:"Aucun personnage recensé pour l'instant.",
    chargement:"Chargement du registre…",
  };

  /* ===================== CONFIG ===================== */
  var CFG = {
    SEL:{ app:"tdlm-app", main:"tdlm-main", home:"tdlm-home", edit:"tdlm-edit" },
    HREF_ACCUEIL:"/",                                  /* [MAJ] accueil du forum */
    EXCLUS_PSEUDO:["Mami Wata"],                        /* comptes système jamais recensés */
    EXCLUS_UID:[1],
  };

  /* ===================== COMMU (couleur communauté → --grN) =====================
     Dérivée de EcoCore.COMMUNAUTES : id de groupe FA (3→8) → --gr(id-2). */
  var COMMU = {};
  function construireCOMMU(){
    var C = window.EcoCore && window.EcoCore.COMMUNAUTES;
    if(!C) return;
    Object.keys(C).forEach(function(id){
      var c = C[id], n = parseInt(id,10)-2;
      if(c && c.court && n>=1 && n<=6) COMMU[c.court] = "var(--gr"+n+"-color)";
    });
  }

  /* ===================== UTILS ===================== */
  function $(id){ return document.getElementById(id); }
  function escA(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;"); }
  function escH(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function versTableau(v){ return !v ? [] : (Array.isArray(v)?v:Object.keys(v).map(function(k){return v[k];})); }
  function initiales(n){ return String(n).split(/[\s_-]+/).map(function(w){return w[0];}).filter(Boolean).slice(0,2).join("").toUpperCase(); }
  function couleur(court){ return COMMU[court] || "var(--cntr)"; }

  function estStaff(){
    try{ var u=window._userdata; if(u && (u.user_level===1||u.user_level===2)) return true; }catch(e){}
    var p = window.EcoCore && window.EcoCore.getPseudo && window.EcoCore.getPseudo();
    return !!(p && (window.EcoCore.ADMIN_USERS||[]).indexOf(p)!==-1);
  }
  // Un joueur « admin » = compte principal listé dans EcoCore.ADMIN_USERS.
  function estAdminPseudo(pseudo){
    return ((window.EcoCore && window.EcoCore.ADMIN_USERS) || []).indexOf(pseudo)!==-1;
  }
  // Comptes système à ne jamais afficher (par pseudo OU par UID).
  function estExclu(pseudo, m){
    if(CFG.EXCLUS_PSEUDO.indexOf(pseudo)!==-1) return true;
    var uid = m && m.uid;
    return uid!=null && CFG.EXCLUS_UID.indexOf(Number(uid))!==-1;
  }

  /* ===================== INDEX (helpers de jointure) ===================== */
  // Avatar : meilleure carte par pseudo (« pris » + image l'emportent). Cf. eco-dc-staff.indexAvatars.
  function indexAvatars(rec){
    var fc = (rec && rec.faceclaims) || {}, idx = {};
    function score(c){ return (c.statut==="pris"?4:c.statut==="reserve"?1:0)+(c.image?2:0); }
    Object.keys(fc).forEach(function(cle){
      var c = fc[cle]; if(!c || !c.pseudo) return;
      var a = idx[c.pseudo]; if(!a || score(c)>score(a)) idx[c.pseudo]=c;
    });
    return idx;
  }
  // Emplois : poste/entreprise par pseudo, et liste des entreprises dont il est référent.
  function indexEmplois(rec){
    var emplois=(rec&&rec.emplois)||{}, lieux=(rec&&rec.lieux)||{}, job={}, refDe={};
    Object.keys(emplois).forEach(function(id){
      var e = emplois[id]; if(!e) return;
      var nomEnt = (lieux[id] && lieux[id].nom) || "";
      versTableau(e.roles).forEach(function(r){
        if(!r || r.attente) return;
        if(r.nom && !job[r.nom]) job[r.nom] = { poste:r.poste||"", entreprise:nomEnt };
      });
      if(e.referent){ (refDe[e.referent] = refDe[e.referent] || []).push(id); }
    });
    return { job:job, refDe:refDe };
  }
  // Demandes de fiche validées, indexées par pseudo (dernière gagnante).
  function indexDemandes(rec){
    var idx = {};
    versTableau(rec.demandes_fiche).forEach(function(d){ if(d && d.statut==="validee") idx[d.pseudo]=d; });
    return idx;
  }
  // Quartier d'habitation : résout une clé via logements/quartiers, sinon renvoie le nom brut.
  function quartierNom(rec, pseudo, dem){
    var q = rec.logements && rec.logements.quartiers;
    var hab = (rec.membres[pseudo]||{}).habitation;
    var raw = (hab && hab.quartier) || (dem && dem.lieu_habitation) || "";
    if(!raw) return "";
    if(q && q[raw] && q[raw].nom) return q[raw].nom;
    return raw;
  }

  /* ===================== OMBRE (hors_la_loi + liens → lisible) ===================== */
  // Source unique de structure : window.BHL_CONFIG ; noms des cellules/navires créés
  // par le staff résolus via rec.bandes.{maringouins.cellules|flottille.navires}.
  function cfg(){ return window.BHL_CONFIG; }
  function cfgBande(k){ var C=cfg(); return (C && C.bandes && C.bandes[k]) || null; }
  function nomBande(k){ var b=cfgBande(k); return (b && b.nom) || k; }
  function nomDe(map,k){ return (map && map[k] && map[k].nom) || k; }
  function nomCelluleR(rec,k){
    var ov=rec.bandes&&rec.bandes.maringouins&&rec.bandes.maringouins.cellules&&rec.bandes.maringouins.cellules[k];
    if(ov&&ov.nom) return ov.nom; var b=cfgBande("maringouins"); return nomDe(b&&b.cellules,k);
  }
  function nomNavireR(rec,k){
    var ov=rec.bandes&&rec.bandes.flottille&&rec.bandes.flottille.navires&&rec.bandes.flottille.navires[k];
    if(ov&&ov.nom) return ov.nom; var b=cfgBande("flottille"); return nomDe(b&&b.navires,k);
  }
  function labelStatut(k){ var b=cfgBande("main"); return k ? ((b&&b.statuts&&b.statuts[k])||k) : ""; }

  // Affiliation pleine → { bande (nom), detail, depuis } ou null.
  function resumeHll(hll, rec){
    if(!hll || !hll.bande) return null;
    var b=hll.bande, detail="";
    if(b==="faiseuses"){ var cf=cfgBande("faiseuses");
      detail=(hll.vocation||"")+(hll.categorie?" ("+((cf&&cf.categories&&cf.categories[hll.categorie])||hll.categorie)+")":""); }
    else if(b==="braconneurs"){ var cb=cfgBande("braconneurs");
      detail=(hll.role||"")+(hll.spec?" ⟡ "+nomDe(cb&&cb.specialites,hll.spec):""); }
    else if(b==="maringouins"){
      detail=(hll.role||"")+(hll.cellule?" ⟡ "+nomCelluleR(rec,hll.cellule):""); }
    else if(b==="flottille"){
      detail=(hll.capitaine?"Capitaine — ":"")+(hll.role||"")+(hll.navire?" ⟡ "+nomNavireR(rec,hll.navire):""); }
    else if(b==="main"){ var cm=cfgBande("main");
      if(hll.type==="main") detail="Le Chef";
      else if(hll.type==="doigt") detail=nomDe(cm&&cm.doigts,hll.doigt)+(hll.role?" ⟡ "+hll.role:"")+(hll.chef?" (Porteur)":"");
      else detail="Cavalier"; }
    else if(b==="sorcieres"){ var cs=cfgBande("sorcieres");
      detail=nomDe(cs&&cs.roles,hll.role)+(hll.lieu?" ⟡ "+hll.lieu:""); }
    return { bande:nomBande(b), detail:detail, depuis:hll.depuis||"" };
  }
  // Liens (cumulables) → contacts [{ label, detail, statut }].
  function resumeLiens(liens, rec){
    var out=[], cm=cfgBande("main");
    versTableau(liens).forEach(function(l){
      if(!l) return;
      if(l.type==="reseau_main"){
        out.push({ label:"Réseau de la Main",
          detail:((cm&&cm.reseau_cat&&cm.reseau_cat[l.categorie])||l.categorie||"")+(l.role?" ⟡ "+l.role:""),
          statut:labelStatut(l.statut) });
      } else if(l.type==="pilier_flottille"){
        out.push({ label:"Pilier de la Flottille", detail:(l.concours||""), statut:labelStatut(l.statut) });
      }
    });
    return out;
  }

  /* ===================== DONNÉES (lecture + jointures) ===================== */
  function ecoPret(){ return !!(window.EcoCore && typeof window.EcoCore.safeReadBin==="function"); }
  function attendreEco(ms){
    return new Promise(function(res){
      var n=0, t=setInterval(function(){ if(ecoPret()||++n>ms/100){ clearInterval(t); res(ecoPret()); } },100);
    });
  }

  // Un personnage = un compte validé (a un groupe communauté OU une demande validée).
  function estPersonnage(m, d){ return !!((m && m.group) || d); }

  function construirePerso(pseudo, rec, av, job, refDe, dem){
    var m = rec.membres[pseudo] || {}, d = dem[pseudo], j = job[pseudo] || {};
    var sansEmploi = !!m.sans_emploi;
    var refIds = refDe[pseudo] || [];
    return {
      pseudo:pseudo, nom:pseudo, uid:m.uid || null,
      commu:m.group || (d && d.groupe) || null,
      avatar:(av[pseudo] && av[pseudo].image) || "",
      poste: sansEmploi ? T.sansEmploi : (j.poste || T.tiret),
      entreprise: sansEmploi ? "" : (j.entreprise || ""),
      referent: refIds.length>0, refIds:refIds,
      affiliation: resumeHll(m.hors_la_loi, rec),
      contacts:    resumeLiens(m.liens, rec),
      lieu: quartierNom(rec, pseudo, d),
      pres: (d && d.lien_fiche) || "",
    };
  }

  function construireJoueurs(rec){
    var membres = rec.membres || {}, groupes = rec.doubles_comptes || {};
    var av = indexAvatars(rec), em = indexEmplois(rec), dem = indexDemandes(rec);
    // pseudo → racine
    var racineDe = {};
    Object.keys(groupes).forEach(function(racine){
      versTableau(groupes[racine].comptes).forEach(function(p){ racineDe[p]=racine; });
    });
    // regroupement des membres validés par racine
    var joueurs = {};
    Object.keys(membres).forEach(function(pseudo){
      var m = membres[pseudo], d = dem[pseudo];
      if(estExclu(pseudo, m)) return;                           // écarte les comptes système (Mami Wata, UID 1…)
      if(!estPersonnage(m, d)) return;                          // écarte les comptes non validés
      var racine = racineDe[pseudo] || pseudo;
      if(!joueurs[racine]) joueurs[racine] = { principal:racine, chars:[] };
      joueurs[racine].chars.push(construirePerso(pseudo, rec, av, em.job, em.refDe, dem));
    });
    // finitions : tri (racine en tête), avatar du principal, compteurs
    return Object.keys(joueurs).map(function(racine){
      var j = joueurs[racine];
      j.chars.sort(function(a,b){
        if(a.pseudo===racine) return -1; if(b.pseudo===racine) return 1;
        return a.nom.localeCompare(b.nom,"fr");
      });
      j.avatar = (av[racine] && av[racine].image) || "";
      j.admin = estAdminPseudo(racine);
      var ids = {};
      j.chars.forEach(function(c){ c.refIds.forEach(function(id){ ids[id]=1; }); });
      j.nbRef = Object.keys(ids).length;                        // entreprises référentes distinctes
      j.nbOmbre = j.chars.filter(function(c){ return c.affiliation || (c.contacts && c.contacts.length); }).length;
      return j;
    }).sort(function(a,b){                                       // admins d'abord, puis alphabétique
      if(a.admin !== b.admin) return a.admin ? -1 : 1;
      return a.principal.localeCompare(b.principal,"fr");
    });
  }

  var JOUEURS = [];
  var DONNEES = {
    chargerTout: function(){
      return attendreEco(8000).then(function(ok){
        if(!ok){ if(window.console) console.warn("[TDL registre] EcoCore introuvable."); return; }
        return window.EcoCore.safeReadBin().then(function(rec){
          JOUEURS = construireJoueurs(rec || {});
        }).catch(function(e){ if(window.console) console.error("[TDL registre] lecture", e); });
      });
    }
  };

  /* ===================== RENDU ===================== */
  function jobHTML(c){
    var ref = c.referent ? ' <i class="fi fi-tr-bank ref" title="Référent d\'entreprise"></i>' : "";
    var av  = c.avatar ? '<img src="'+escA(c.avatar)+'" alt="">' : escH(initiales(c.nom));
    return '<div class="tdlm-crow"><span class="tdlm-cav">'+av+'</span>'
      + '<div class="tdlm-cjob"><b>'+escH(c.poste)+ref+'</b>'
      + (c.entreprise?'<span>'+escH(c.entreprise)+'</span>':'')+'</div></div>';
  }
  function ombreHTML(c){
    var parts=[];
    if(c.affiliation){
      parts.push('<div class="tdlm-ombre membre"><span class="tdlm-tag membre">'+T.membre+'</span> <span class="bande">'+escH(c.affiliation.bande)+'</span>'
        + (c.affiliation.detail?'<div class="role">'+escH(c.affiliation.detail)+'</div>':'')+'</div>');
    }
    (c.contacts||[]).forEach(function(ct){
      var d = escH(ct.detail||"") + (ct.statut?' · '+escH(ct.statut):'');
      parts.push('<div class="tdlm-ombre contact"><span class="tdlm-tag contact">'+T.contact+'</span> <span class="bande">'+escH(ct.label)+'</span>'
        + (d?'<div class="role">'+d+'</div>':'')+'</div>');
    });
    if(!parts.length) return '<div class="tdlm-ombre-none">'+T.pasOmbre+'</div>';
    return parts.join("");
  }
  function carteHTML(c){
    var profil = c.uid ? '/u'+c.uid : '#';
    var pres = c.pres
      ? '<a class="tdlm-cpres" href="'+escA(c.pres)+'">'+T.lire+' <i class="fi fi-tr-angle-small-right arr"></i></a>'
      : '<span class="tdlm-cpres off">'+T.lire+'</span>';
    return '<article class="tdlm-card" style="--sc:'+couleur(c.commu)+'">'
      + '<div class="tdlm-cname"><span class="n">'+escH(c.nom)+'</span>'
      + '<a class="tdlm-cprofile" href="'+escA(profil)+'" title="'+T.voirProfil+'"><i class="fi fi-tr-arrow-up-right-from-square"></i></a></div>'
      + jobHTML(c) + ombreHTML(c)
      + '<div class="tdlm-lieu"><i class="fi fi-tr-house-chimney"></i><span>'+escH(c.lieu||T.tiret)+'</span></div>'
      + pres + '</article>';
  }
  function joueurHTML(j, i){
    var nb = j.chars.length, cols = nb===5 ? 3 : nb, maxw = cols*320 + (cols-1)*18;
    var av = j.avatar ? '<img src="'+escA(j.avatar)+'" alt="">' : escH(initiales(j.principal));
    var star = j.admin ? '<i class="fi fi-tr-badge-sheriff tdlm-star" title="Équipe"></i>' : '';
    return '<div class="tdlm-player">'      
      + '<div class="tdlm-phead">'
      +   '<span class="tdlm-pav">'+av+'</span>'
      +   '<span class="tdlm-pname">'+star+escH(j.principal)+'</span>'
      +   '<span class="tdlm-psum">'
      +     '<span class="col"><i class="fi fi-tr-users-alt"></i><span class="txt"><b>'+nb+'</b> '+T.perso(nb)+'</span></span>'
      +     '<span class="col"><i class="fi fi-tr-bank"></i><span class="txt"><b>'+j.nbRef+'</b> '+T.ref(j.nbRef)+'</span></span>'
      +     '<span class="col"><i class="fi fi-tr-skull"></i><span class="txt"><b>'+j.nbOmbre+'</b> '+T.ombre(j.nbOmbre)+'</span></span>'
      +   '</span>'
      +   '<i class="tdlm-chev fi fi-tr-angle-small-down"></i>'
      + '</div>'
      + '<div class="tdlm-pbody"><div class="tdlm-cards" style="--cols:'+cols+';--maxw:'+maxw+'px">'
      +   j.chars.map(carteHTML).join("")
      + '</div></div></div>';
  }
  function render(){
    var main = $(CFG.SEL.main);
    if(!JOUEURS.length){ main.innerHTML = '<div class="tdlm-empty">'+T.vide+'</div>'; return; }
    main.innerHTML = JOUEURS.map(joueurHTML).join("");
  }

  /* ===================== EVENTS (un seul accordéon ouvert) ===================== */
  function bindEvents(){
    $(CFG.SEL.main).addEventListener("click", function(e){
      var h = e.target.closest(".tdlm-phead"); if(!h) return;
      var p = h.parentElement, ouvert = p.classList.contains("open");
      var mainEl = $(CFG.SEL.main);
      mainEl.querySelectorAll(".tdlm-player.open").forEach(function(x){ x.classList.remove("open"); });
      if(!ouvert) p.classList.add("open");
    });
  }

  /* ===================== INIT ===================== */
  function init(){
    var home = $(CFG.SEL.home); if(home) home.setAttribute("href", CFG.HREF_ACCUEIL);
    construireCOMMU();
    if(estStaff()){
      document.body.classList.add("tdlm-body-admin");
      var ed = $(CFG.SEL.edit), nat = document.querySelector('a[href*="mode=editpost"]');
      if(ed && nat) ed.setAttribute("href", nat.getAttribute("href"));
    }
    bindEvents();
    var main = $(CFG.SEL.main); if(main) main.innerHTML = '<div class="tdlm-empty">'+T.chargement+'</div>';
    DONNEES.chargerTout().then(render);
  }

  /* ===================== BOOT (FA : window.load + polling) ===================== */
  function boot(){
    var n=0, t=setInterval(function(){
      if($(CFG.SEL.app) && $(CFG.SEL.main)){ clearInterval(t); init(); }
      else if(++n>60){ clearInterval(t); }
    },250);
  }
  if(document.readyState==="complete") boot();
  else window.addEventListener("load", boot);

  BMC.render = render;   // exposé pour debug

})(window.BMC);
