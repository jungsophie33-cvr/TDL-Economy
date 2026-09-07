/*
 * quais-core.js — Socle de la boutique « Les Quais du Bayou » · TDL
 *
 * CE QUE CE FICHIER FAIT :
 *   - attend EcoCore (auth + API Firebase) et le point de montage de la page dédiée ;
 *   - lit / sème / sauvegarde le catalogue sous  boutique/<sousChemin>/<id> ;
 *   - lit le solde et les dettes du membre (membres/<pseudo>/dollars | /dettes) ;
 *   - expose le MOTEUR D'ACHAT (les trois cas validés) :
 *       comptant → débit atomique immédiat + demande en_attente (annulable = recrédit),
 *       dette    → pas de débit, contrôle du plafond (3 lourdes), inscription + alerte staff,
 *       demande  → simple demande de négociation, sans débit ;
 *   - rend la coquille (barre, onglets, colonnes) et délègue le contenu aux MODULES
 *     de boutique enregistrés (comptoir, marina, barge-*).
 * CE QU'IL NE FAIT PAS : le rendu des items (chaque module s'en charge via son detail()),
 *   ni le panneau staff de traitement des demandes (module séparé).
 *
 * DÉPEND DE : window.EcoCore (readBin/safeReadBin, writeField, firebaseUpdate,
 *   firebaseTransaction, firebasePush, getPseudo/getUserId, invalidateCache).
 * EXPOSE : window.Quais (register, ui, achat, catalogue, membre, refresh).
 * À CHARGER : après eco-core, AVANT quais-comptoir / quais-marina / barge-*.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var CFG = {
    MONTAGE:        "#quais-app",          /* [MAJ] conteneur sur la page dédiée */
    NODE_BOUTIQUE:  "boutique",            /* [MAJ] racine catalogue */
    NODE_DEMANDES:  "boutique_demandes",   /* [MAJ] file des demandes pour le staff */
    NODE_MEMBRES:   "membres",             /* [MAJ] membres/<pseudo>/dollars | /dettes */
    MAX_DETTES_LOURDES: 3,
    FORUM_HOME:     "https://thedrownedlands.forumactif.com/",
    EDIT_URL:       "https://thedrownedlands.forumactif.com/post?p=465&mode=editpost", /* [MAJ] édition du 1er post du sujet */
    MONNAIE:        "$",
    RETRY_MS:       250,
    RETRY_MAX:      60
  };

  var TXT = {
    TITRE:            "Les Quais du Bayou",
    ACCUEIL:          "Accueil",
    SOLDE:            "Solde",
    DETTES:           "Dettes",
    SERVICES:         "Services",
    BIENTOT:          "Bientôt disponible.",
    STAFF_TITRE:      "Éditer les items",
    EDIT_TOPIC:       "Éditer le sujet",
    NON_CONNECTE:     "Connecte-toi pour effectuer un achat.",
    FONDS:            "Fonds insuffisants.",
    ERR_ACHAT:        "Erreur lors de l'opération — rien n'a été débité.",
    OK_COMPTANT:      "Demande envoyée. Le montant est retenu ; le staff validera ou te le recréditera.",
    OK_DEMANDE:       "Requête transmise à la Main. Réponse en RP.",
    DETTE_PLAFOND:    "Plafond atteint : 3 dettes lourdes en cours. Règle-en une avant d'en contracter une autre.",
    OK_DETTE:         function (n) { return "Dette lourde n°" + n + " enregistrée. En attente d'attribution du badge par le staff."; },
    OK_FAVEUR:        "Petite faveur enregistrée. Dette légère notée par le staff, rappelée au moment opportun."
  };

  /* ===================== UTILS ===================== */
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function versTableau(v){ return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]); }
  function money(n){ return (typeof n==="number"?n.toLocaleString("fr-FR").replace(/\u202f/g," "):n)+" "+CFG.MONNAIE; }
  function E(){ return window.EcoCore; }
  function pseudo(){ try { return E().getPseudo(); } catch(e){ return null; } }
  function isStaff(){ try { return typeof _userdata!=="undefined" && (_userdata.user_level===1||_userdata.user_level===2); } catch(e){ return false; } }

  function quandPret(cb, n){
    n = n||0;
    var mount = document.querySelector(CFG.MONTAGE);
    var eco = window.EcoCore && typeof EcoCore.safeReadBin==="function" && typeof EcoCore.firebaseTransaction==="function";
    if (mount && eco && registre.length) { cb(mount); return; }
    if (n > CFG.RETRY_MAX) {
      if (window.console) console.warn("[Quais] démarrage impossible — eco:"+!!eco+" conteneur:"+!!mount+" modules:"+registre.length);
      if (mount) { monter(mount); mount.innerHTML = '<div class="qb-empty" style="padding:24px">'
        + (!eco ? "EcoCore introuvable — vérifie l'ordre de chargement (eco-core avant quais-core)."
                : !registre.length ? "Aucun module de boutique chargé — quais-comptoir.js est-il bien inclus après quais-core.js ?"
                : "Conteneur "+CFG.MONTAGE+" introuvable.") + '</div>'; }
      return;
    }
    setTimeout(function(){ quandPret(cb, n+1); }, CFG.RETRY_MS);
  }

  /* ===================== CATALOGUE (Firebase) ===================== */
  /* Chemin complet : boutique/<sousChemin>/<id>. sousChemin = "comptoir",
     "marina", "barge/main"… Semis au premier chargement si le nœud est vide. */
  var catalogue = {
    async lire(sousChemin, defaut){
      var root = await E().safeReadBin();
      var node = root && root[CFG.NODE_BOUTIQUE];
      var cur = node;
      sousChemin.split("/").forEach(function(seg){ cur = cur && cur[seg]; });
      if (cur && Object.keys(cur).length) return cur;
      if (defaut && Object.keys(defaut).length) {
        try { await E().writeField(CFG.NODE_BOUTIQUE + "/" + sousChemin, defaut); } catch(e){ if(window.console) console.warn("[Quais] semis échoué", e); }
        return defaut;
      }
      return {};
    },
    async sauverItem(sousChemin, id, item){
      var maj = {}; maj[CFG.NODE_BOUTIQUE + "/" + sousChemin + "/" + id] = item;
      return E().firebaseUpdate(maj);
    },
    async supprimerItem(sousChemin, id){
      var maj = {}; maj[CFG.NODE_BOUTIQUE + "/" + sousChemin + "/" + id] = null;
      return E().firebaseUpdate(maj);
    }
  };

  /* ===================== MEMBRE (solde + dettes) ===================== */
  var membre = {
    async lire(){
      var p = pseudo(); if (!p) return { pseudo:null, solde:0, dettes:[] };
      var root = await E().safeReadBin();
      var m = root && root[CFG.NODE_MEMBRES] && root[CFG.NODE_MEMBRES][p];
      return { pseudo:p, solde:(m && m.dollars)||0, dettes: versTableau(m && m.dettes) };
    },
    dettesLourdesActives(dettes){
      return versTableau(dettes).filter(function(d){
        return d && d.type==="lourde" && (d.statut==="active" || d.statut==="en_attente");
      });
    }
  };

  /* ===================== MOTEUR D'ACHAT ===================== */
  /* base = { sousChemin, itemId, nom, montant?, boutique, bande? } ; champs = valeurs libres du formulaire */
  function demandeBase(base, champs){
    var p = pseudo();
    var uid = 0; try { uid = E().getUserId(); } catch(e){}
    var d = { date:new Date().toISOString(), pseudo:p, uid:uid, statut:"en_attente",
              boutique:base.boutique||"", bande:base.bande||"", itemId:base.itemId||"", nom:base.nom||"" };
    if (champs) for (var k in champs) if (champs.hasOwnProperty(k) && champs[k]!=null && champs[k]!=="") d[k]=champs[k];
    return d;
  }

  var achat = {
    /* Débit provisoire immédiat + demande annulable (recrédit à l'annulation staff). */
    async comptant(base, champs){
      var p = pseudo(); if (!p) { alert(TXT.NON_CONNECTE); return { ok:false }; }
      var montant = base.montant|0;
      try {
        await E().firebaseTransaction(CFG.NODE_MEMBRES + "/" + encodeURIComponent(p) + "/dollars", function(cur){
          var s = cur||0; if (s < montant) throw new Error("FONDS"); return s - montant;
        });
      } catch(e){
        if (e && e.message==="FONDS") { alert(TXT.FONDS); return { ok:false, fonds:true }; }
        if (window.console) console.error("[Quais] débit", e); alert(TXT.ERR_ACHAT); return { ok:false };
      }
      try {
        var d = demandeBase(base, champs); d.type="comptant"; d.montant=montant;
        await E().firebasePush(CFG.NODE_DEMANDES, d);
      } catch(e){
        /* demande non enregistrée → on rembourse pour ne pas retenir sans trace */
        await E().firebaseTransaction(CFG.NODE_MEMBRES + "/" + encodeURIComponent(p) + "/dollars", function(cur){ return (cur||0)+montant; }).catch(function(){});
        if (window.console) console.error("[Quais] demande comptant", e); alert(TXT.ERR_ACHAT); return { ok:false };
      }
      return { ok:true, message:TXT.OK_COMPTANT };
    },

    /* Dette lourde (0 $, plafond de 3, alerte staff numérotée pour le badge) OU
       petite faveur (dette légère, hors plafond, avec débit préalable — ex. 60 $). */
    async dette(base, champs){
      var p = pseudo(); if (!p) { alert(TXT.NON_CONNECTE); return { ok:false }; }
      var type = base.detteType==="legere" ? "legere" : "lourde";
      var montant = base.montant|0;
      var P = encodeURIComponent(p);
      var numero = 0;
      if (type==="lourde") {
        var etat = await membre.lire();
        var lourdes = membre.dettesLourdesActives(etat.dettes).length;
        if (lourdes >= CFG.MAX_DETTES_LOURDES) { alert(TXT.DETTE_PLAFOND); return { ok:false, plafond:true }; }
        numero = lourdes + 1;
      }
      if (montant > 0) {
        try {
          await E().firebaseTransaction(CFG.NODE_MEMBRES + "/" + P + "/dollars", function(cur){
            var s = cur||0; if (s < montant) throw new Error("FONDS"); return s - montant;
          });
        } catch(e){
          if (e && e.message==="FONDS") { alert(TXT.FONDS); return { ok:false, fonds:true }; }
          if (window.console) console.error("[Quais] débit faveur", e); alert(TXT.ERR_ACHAT); return { ok:false };
        }
      }
      try {
        await E().firebasePush(CFG.NODE_MEMBRES + "/" + P + "/dettes", {
          creancier: base.bande||"", type:type, motif: base.nom||"", statut:"en_attente", date:new Date().toISOString()
        });
        var d = demandeBase(base, champs); d.type="dette"; d.dette_type=type;
        if (numero) d.dette_num=numero; if (montant) d.montant=montant;
        await E().firebasePush(CFG.NODE_DEMANDES, d);
      } catch(e){
        if (montant > 0) await E().firebaseTransaction(CFG.NODE_MEMBRES + "/" + P + "/dollars", function(cur){ return (cur||0)+montant; }).catch(function(){});
        if (window.console) console.error("[Quais] dette", e); alert(TXT.ERR_ACHAT); return { ok:false };
      }
      return { ok:true, message: type==="lourde" ? TXT.OK_DETTE(numero) : TXT.OK_FAVEUR };
    },

    /* Négociation / requête : simple demande, sans débit. */
    async demande(base, champs){
      var p = pseudo(); if (!p) { alert(TXT.NON_CONNECTE); return { ok:false }; }
      try {
        var d = demandeBase(base, champs); d.type = base.demandeType || "demande";
        await E().firebasePush(CFG.NODE_DEMANDES, d);
      } catch(e){ if (window.console) console.error("[Quais] demande", e); alert(TXT.ERR_ACHAT); return { ok:false }; }
      return { ok:true, message:TXT.OK_DEMANDE };
    }
  };

  /* ===================== HELPERS UI (partagés par les modules) ===================== */
  var ui = {
    money: money, esc: esc, versTableau: versTableau,
    lab:  function(t){ return '<span class="qb-lab">'+esc(t)+'</span>'; },
    fld:  function(label, inner){ return '<div class="qb-fld"><span class="qb-flab">'+esc(label)+'</span>'+inner+'</div>'; },
    ta:   function(champ, ph){ return '<textarea data-champ="'+esc(champ)+'" placeholder="'+esc(ph||"")+'"></textarea>'; },
    inp:  function(champ, ph){ return '<input data-champ="'+esc(champ)+'" placeholder="'+esc(ph||"")+'">'; },
    sel:  function(champ, opts){ return '<select data-champ="'+esc(champ)+'"><option>— Sélectionner —</option>'+opts.map(function(o){return '<option>'+esc(o)+'</option>';}).join("")+'</select>'; },
    /* carte d'option (payer comptant / dette). act ∈ comptant|dette|demande ; montant en $ */
    optcard: function(o){
      return '<div class="qb-optcard'+(o.pay?" qb-pay":"")+'"><div class="qb-optcircle"><i class="'+esc(o.ic)+'"></i></div>'
        + '<div class="qb-optbody"><div class="qb-opttitle">'+esc(o.titre)+'</div><div class="qb-optdesc">'+esc(o.desc)+'</div>'
        + (o.note?'<div class="qb-optnote">'+esc(o.note)+'</div>':"")+'</div>'
        + '<div class="qb-optright">'+(o.prix?'<div class="qb-optprice">'+esc(o.prix)+'</div>':"")
        + '<button class="qb-optbtn'+(o.pay?" qb-pay":"")+' qb-act" data-act="'+esc(o.act)+'"'
        + (o.montant!=null?' data-montant="'+(o.montant|0)+'"':"")+(o.type?' data-type="'+esc(o.type)+'"':"")+(o.dette?' data-dette="'+esc(o.dette)+'"':"")+(o.id?' id="'+esc(o.id)+'"':"")
        + '>'+esc(o.btn)+'</button></div></div>';
    },
    /* bouton d'envoi centré (négociation, demandes) */
    envoi: function(label, type){ return '<div class="qb-opts qb-center"><button class="qb-optbtn qb-pay qb-act" data-act="demande"'+(type?' data-type="'+esc(type)+'"':"")+' style="flex:none">'+esc(label)+'</button></div>'; },
    /* grille « Informations clés » façon Comptoir : liste [label, valeur] + carte icône */
    infosCles: function(paires, iconOf){
      return '<div class="qb-sec">'+ui.lab("Informations clés")+'<div class="qb-kg4">'
        + paires.map(function(f){ return '<div class="qb-kf"><i class="'+esc((iconOf&&iconOf(f[0]))||"fi fi-tr-diamond")+'"></i><div><div class="qb-kl">'+esc(f[0])+'</div><div class="qb-kv">'+esc(f[1])+'</div></div></div>'; }).join("")
        + '</div></div>';
    }
  };

  /* ===================== REGISTRE DES MODULES ===================== */
  /* Un module fournit : { key,label,sub,icon,mode('accordion'|'grid'),leftW,
       sousChemin(fn id→path OU string), data(defaut), cats,
       detail(id, api)→html, form?(item, api)→html } */
  var registre = [];
  var mounted = false;
  function register(mod){
    registre.push(mod);
    if (mounted) chargerModule(mod).then(function(){ render(); });  /* module arrivé après le montage (chargeur séquentiel) */
  }
  function modByKey(k){ for (var i=0;i<registre.length;i++) if (registre[i].key===k) return registre[i]; return null; }

  /* état + catalogues chargés */
  var st = { tab:null, open:null, band:null, sel:null, staff:false, formMode:false, formItem:null, dirty:false };
  var cat = {};      /* cat[key] = catalogue chargé du module (id→item) */
  var etatMembre = { pseudo:null, solde:0, dettes:[] };

  /* ===================== RENDU COQUILLE ===================== */
  var root; /* conteneur monté */
  function h(html){ return html; }

  function renderBar(){
    var lourdes = membre.dettesLourdesActives(etatMembre.dettes).length;
    var dots=""; for (var i=0;i<CFG.MAX_DETTES_LOURDES;i++) dots += '<span class="qb-dot'+(i<lourdes?" qb-on":"")+'"></span>';
    return '<div class="qb-bar">'
      + '<a class="qb-accueil" href="'+CFG.FORUM_HOME+'"><i class="fi fi-tr-house-flood"></i> '+TXT.ACCUEIL+'</a>'
      + '<div class="qb-title">'+esc(TXT.TITRE)+'</div>'
      + '<div class="qb-user">'
      +   '<span class="qb-uname">'+esc(etatMembre.pseudo||"Invité")+'</span>'
      +   '<div class="qb-ublock"><span class="qb-lab">'+TXT.SOLDE+'</span><span class="qb-usolde">'+money(etatMembre.solde)+'</span></div>'
      +   '<div class="qb-ublock"><span class="qb-lab">'+TXT.DETTES+'</span><span class="qb-dots">'+dots+'</span></div>'
      +   (isStaff()?'<button class="qb-stafftgl" id="qb-edittopic" title="'+TXT.EDIT_TOPIC+'"><i class="fi fi-tr-edit"></i></button>':"")
      +   (isStaff()?'<button class="qb-stafftgl'+(st.staff?" qb-on":"")+'" id="qb-stafftgl" title="'+TXT.STAFF_TITRE+'"><i class="fi fi-tr-customize-edit"></i></button>':"")
      + '</div></div>';
  }
  function renderTabs(){
    return '<div class="qb-tabs" id="qb-tabs">'+registre.map(function(m){
      return '<button class="qb-tab'+(m.key===st.tab?" qb-on":"")+'" data-tab="'+m.key+'"><span class="qb-tl"><i class="'+esc(m.icon)+'"></i> '+esc(m.label)+'</span><span class="qb-tsub">'+esc(m.sub||"")+'</span></button>';
    }).join("")+'</div>';
  }

  function itemData(mod, id){ return (cat[mod.key] && cat[mod.key][id]) || (mod.data && mod.data[id]) || {}; }
  function catalogueDe(mod){ return cat[mod.key] || mod.data || {}; }
  /* Liste des items d'une sous-catégorie : dérivée du catalogue via item.cat
     (une liste statique cat.it reste possible en secours). */
  function itemsOfCat(mod, c){
    if (c.it) return c.it;
    var d = catalogueDe(mod);
    return Object.keys(d).filter(function(id){ return d[id] && d[id].cat===c.k; });
  }
  function firstItem(mod){ for (var i=0;i<mod.cats.length;i++){ var ids=itemsOfCat(mod,mod.cats[i]); if (ids.length) return ids[0]; } return null; }
  function catOf(mod, id){ var it=itemData(mod,id); var i; for (i=0;i<mod.cats.length;i++) if (mod.cats[i].k===it.cat) return mod.cats[i]; for (i=0;i<mod.cats.length;i++) if (itemsOfCat(mod,mod.cats[i]).indexOf(id)>=0) return mod.cats[i]; return null; }

  var api = {
    ui: ui, cfg: CFG,
    item: function(id){ return itemData(modByKey(st.tab), id); },
    cat:  function(id){ return catOf(modByKey(st.tab), id); },
    cats: function(){ var m=modByKey(st.tab); return m?m.cats:[]; },
    staff: function(){ return st.staff; },
    membre: function(){ return etatMembre; },
    nouvelId: function(){ return "it" + Date.now().toString(36) + Math.random().toString(36).slice(2,5); },
    /* écrit l'item complet dans le catalogue Firebase, met à jour la mémoire, réaffiche */
    enregistrer: async function(id, item){
      var mod = modByKey(st.tab);
      var chemin = typeof mod.sousChemin==="string" ? mod.sousChemin : (mod.sousChemin?mod.sousChemin(id, null):mod.key);
      if (!cat[mod.key]) cat[mod.key] = {};
      cat[mod.key][id] = item;
      try { await catalogue.sauverItem(chemin, id, item); }
      catch(e){ if (window.console) console.error("[Quais] enregistrer", e); alert("Sauvegarde échouée."); return false; }
      st.formMode=false; st.sel=id; render(); return true;
    },
    annulerForm: function(){ st.formMode=false; render(); }
  };

  function renderLeftAccordion(mod){
    var html="";
    mod.cats.forEach(function(c){
      var op = st.open===c.k, ids = itemsOfCat(mod, c);
      html += '<div class="qb-acc'+(op?" qb-open":"")+'" data-c="'+c.k+'"><button class="qb-accbar"><i class="'+esc(c.ic)+' qb-h"></i><span class="qb-an">'+esc(c.l)+'</span><span class="qb-ct">'+ids.length+'</span><span class="qb-chev">›</span></button><div class="qb-cardswrap"><div class="qb-cards qb-c'+(mod.cols||3)+'">';
      if (!ids.length) html += '<div class="qb-empty" style="grid-column:1/-1">'+TXT.BIENTOT+'</div>';
      else ids.forEach(function(id){ html += cardHTML(mod, id); });
      html += '</div></div></div>';
    });
    if (st.staff) html += '<button class="qb-addbtn" id="qb-addbtn"><i class="fi fi-tr-add"></i> Ajouter un item</button>';
    return html;
  }
  function renderLeftGrid(mod){
    var html = '<div class="qb-bandgrid">'+mod.cats.map(function(c){
      return '<button class="qb-bandcell'+(c.k===st.band?" qb-on":"")+'" data-b="'+c.k+'" style="--c:'+(c.c||"var(--dark2)")+'"><i class="'+esc(c.ic)+'"></i><span>'+esc(c.l)+'</span></button>';
    }).join("")+'</div><div class="qb-leftbody">'+ui.lab(TXT.SERVICES);
    var band = mod.cats.filter(function(c){return c.k===st.band;})[0];
    var ids = band ? itemsOfCat(mod, band) : [];
    if (!ids.length) html += '<div class="qb-empty">'+TXT.BIENTOT+'</div>';
    else html += '<div class="qb-cards qb-c2">'+ids.map(function(id){ return cardHTML(mod, id); }).join("")+'</div>';
    if (st.staff) html += '<button class="qb-addbtn" id="qb-addbtn"><i class="fi fi-tr-add"></i> Ajouter un item</button>';
    return html + '</div>';
  }
  function cardHTML(mod, id){
    var a = itemData(mod, id);
    var prix = mod.cardPrice ? mod.cardPrice(a) : (typeof a.p==="number"?money(a.p):(a.p||""));
    return '<button class="qb-card'+(id===st.sel?" qb-on":"")+'" data-k="'+id+'"><i class="fi fi-sr-'+esc(a.ic)+' qb-bgic"></i>'
      + (st.staff?'<i class="fi fi-tr-edit qb-editm"></i>':(a.gd?'<span class="qb-gdmark" title="Génère une dette"></span>':""))
      + '<span class="qb-cn">'+esc(a.n)+'</span><span class="qb-cp">'+esc(prix)+'</span></button>';
  }
  function renderLeft(mod){ return mod.mode==="grid" ? renderLeftGrid(mod) : renderLeftAccordion(mod); }

  function renderDetail(mod){
    if (st.formMode) return mod.form ? mod.form(st.formItem?itemData(mod,st.formItem):null, api, st.formItem) : '<div class="qb-empty">Édition indisponible.</div>';
    if (!st.sel) return '<div class="qb-empty">'+TXT.BIENTOT+'</div>';
    return mod.detail(st.sel, api);
  }

  function render(){
    var mod = modByKey(st.tab); if (!mod) return;
    var isGrid = mod.mode==="grid";
    root.innerHTML = renderBar() + renderTabs()
      + '<div class="qb-main" style="grid-template-columns:'+(mod.leftW||"440px")+' 1fr">'
      +   '<div class="qb-col qb-left'+(isGrid?" qb-flush":"")+'" id="qb-left">'+renderLeft(mod)+'</div>'
      +   '<div class="qb-col qb-detail'+(isGrid&&!st.formMode?" qb-flush":"")+'" id="qb-detail">'+renderDetail(mod)+'</div>'
      + '</div>';
    wire(mod);
  }

  /* ===================== WIRING ===================== */
  function wire(mod){
    var tabs = root.querySelectorAll(".qb-tab");
    Array.prototype.forEach.call(tabs, function(b){ b.onclick = function(){ selectTab(b.getAttribute("data-tab")); }; });
    var tgl = root.querySelector("#qb-stafftgl"); if (tgl) tgl.onclick = function(){ st.staff=!st.staff; st.formMode=false; render(); };
    var edt = root.querySelector("#qb-edittopic"); if (edt) edt.onclick = function(e){ e.stopPropagation(); window.open(CFG.EDIT_URL, "_blank"); };

    Array.prototype.forEach.call(root.querySelectorAll(".qb-accbar"), function(b){
      b.onclick = function(){ var it=b.parentElement, was=it.classList.contains("qb-open");
        Array.prototype.forEach.call(root.querySelectorAll(".qb-acc"), function(x){x.classList.remove("qb-open");});
        st.open = was?null:it.getAttribute("data-c"); if(!was) it.classList.add("qb-open"); };
    });
    Array.prototype.forEach.call(root.querySelectorAll(".qb-bandcell"), function(b){
      b.onclick = function(){ st.band=b.getAttribute("data-b"); var band=mod.cats.filter(function(c){return c.k===st.band;})[0];
        var ids = band ? itemsOfCat(mod, band) : []; st.sel = ids[0]||null; st.formMode=false; render(); };
    });
    Array.prototype.forEach.call(root.querySelectorAll(".qb-card"), function(b){
      b.onclick = function(){ selectItem(mod, b.getAttribute("data-k")); };
    });
    var add = root.querySelector("#qb-addbtn"); if (add) add.onclick = function(){ st.formMode=true; st.formItem=null; render(); };
    wireDetail(mod);
    if (mod.wire) mod.wire(root, api);   /* accroche facultative propre au module (staff save, toggles…) */
  }

  function selectTab(k){
    st.tab=k; var mod=modByKey(k); st.open=mod.cats[0].k; st.band=mod.cats[0].k; st.sel=firstItem(mod); st.formMode=false; render();
  }
  function selectItem(mod, id){
    st.sel=id;
    if (st.staff) { st.formMode=true; st.formItem=id; render(); return; }
    Array.prototype.forEach.call(root.querySelectorAll(".qb-card"), function(c){ c.classList.toggle("qb-on", c.getAttribute("data-k")===id); });
    var det = root.querySelector("#qb-detail"); det.innerHTML = renderDetail(mod); wireDetail(mod);
  }

  /* boutons d'achat + révélation « Négocier » */
  function wireDetail(mod){
    var det = root.querySelector("#qb-detail"); if (!det) return;
    var nb = det.querySelector("#qb-negobtn"), nr = det.querySelector("#qb-negoreveal");
    if (nb && nr) nb.onclick = function(){ var open=nr.style.display!=="none"; nr.style.display=open?"none":"block"; nb.textContent=open?"Négocier":"Fermer"; };
    Array.prototype.forEach.call(det.querySelectorAll(".qb-act"), function(b){
      b.onclick = function(){ lancerAchat(mod, b); };
    });
    if (mod.wireDetail) mod.wireDetail(det, api);
  }

  function collecterChamps(scope){
    var c = {};
    Array.prototype.forEach.call(scope.querySelectorAll("[data-champ]"), function(el){ c[el.getAttribute("data-champ")] = el.value; });
    return c;
  }

  async function lancerAchat(mod, btn){
    var act = btn.getAttribute("data-act");
    var det = root.querySelector("#qb-detail");
    var champs = collecterChamps(det);
    var a = itemData(mod, st.sel), c = catOf(mod, st.sel);
    var base = {
      boutique: mod.key,
      bande: mod.mode==="grid" ? (c&&c.l||"") : "",
      sousChemin: typeof mod.sousChemin==="function" ? mod.sousChemin(st.sel, c) : mod.sousChemin,
      itemId: st.sel, nom: a.n,
      montant: btn.getAttribute("data-montant")!=null ? parseInt(btn.getAttribute("data-montant"),10) : undefined,
      demandeType: btn.getAttribute("data-type") || undefined,
      detteType: btn.getAttribute("data-dette") || undefined
    };
    btn.disabled = true;
    var res = act==="comptant" ? await achat.comptant(base, champs)
            : act==="dette"    ? await achat.dette(base, champs)
            :                    await achat.demande(base, champs);
    btn.disabled = false;
    if (res && res.ok) { if (res.message) alert(res.message); await refresh(); }
  }

  /* ===================== BOOT / REFRESH ===================== */
  async function chargerModule(m){
    var chemin = typeof m.sousChemin==="string" ? m.sousChemin : m.key;
    try { cat[m.key] = await catalogue.lire(chemin, m.data||null); } catch(e){ cat[m.key] = m.data||{}; }
  }
  async function chargerCatalogues(){ for (var i=0;i<registre.length;i++) await chargerModule(registre[i]); }
  async function refresh(){
    E().invalidateCache();
    etatMembre = await membre.lire();
    render();
  }

  /* réparente le conteneur vers <body> (échappe aux contextes d'empilement FA) + fige le fond */
  function monter(mount){
    if (mount.parentNode !== document.body) document.body.appendChild(mount);
    document.documentElement.style.overflow = "hidden";   /* iOS Safari : sur <html>, pas <body> */
    root = mount; root.classList.add("qb");
  }

  function boot(){
    quandPret(async function(mount){
      if (mounted) return;
      monter(mount); mounted = true;
      st.tab = registre[0].key;
      etatMembre = await membre.lire();
      await chargerCatalogues();
      selectTab(st.tab);
    });
  }

  /* ===================== EXPORT ===================== */
  window.Quais = {
    CFG: CFG, TXT: TXT, ui: ui,
    register: register,
    catalogue: catalogue, membre: membre, achat: achat,
    refresh: refresh, boot: boot,
    versTableau: versTableau, money: money
  };

  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
