/*
 * quais-core.js — Socle de la boutique « Les Quais du Bayou » · TDL · v7
 *
 * CE QUE FAIT CE FICHIER
 *   - monte la coquille (barre, onglets, colonnes) et délègue le contenu aux
 *     modules enregistrés (comptoir, barge) ;
 *   - lit le catalogue boutique/<sousChemin>, le membre courant et les annexes ;
 *   - porte LE pipeline d'achat : soumettre(). Il n'y en a pas d'autre.
 *
 * [MAJ v7] UN SEUL PIPELINE.
 *   lancerAchat (bouton .qb-act) et api.acheter (appel d'un module) faisaient
 *   chacun une partie du travail ; seul le premier appelait avantAchat. Ce ne
 *   sont plus que deux portes d'entrée vers soumettre(), qui enchaîne, pour
 *   tout le monde et dans cet ordre :
 *     verrou anti-double-envoi → champs visibles → résolution de l'acte →
 *     contrôles du module → solde → plafond des dettes lourdes →
 *     confirmation → débit → inscription → message → rafraîchissement.
 *
 * [MAJ v7] LA DETTE LOURDE NAÎT À LA DEMANDE.
 *   Elle s'écrit en statut « en_attente » dans le MÊME PATCH que la demande,
 *   et compte aussitôt dans le plafond des trois. Le staff l'active à la
 *   validation, l'efface au refus. Plus de demandes en série sur dettes
 *   lourdes : la quatrième est bloquée avant même d'exister.
 *
 * [MAJ v7] SEULS LES CHAMPS VISIBLES PARTENT.
 *   Un champ placé dans une zone masquée (attribut hidden) n'est plus lu. Un
 *   paiement au prix indicatif n'emporte plus les valeurs par défaut du
 *   panneau de négociation resté caché.
 *
 * [MAJ v7] PLUS AUCUN safeReadBin. Le prêt lit la seule cagnotte visée.
 *
 * [MAJ v7-1] CARTES D'OPTION À RÉVÉLATION. Une carte peut ouvrir un volet
 *   (ui.optcard({ ouvre:"nom" }) + ui.zone("revele:nom", …)) au lieu de
 *   soumettre. Un bouton d'achat placé HORS de tout volet referme d'abord les
 *   volets ouverts : leurs champs ne partent donc jamais avec un paiement
 *   au prix affiché.
 *
 * CONTRAT D'UN MODULE (tous les crochets sont facultatifs)
 *   key, label, sub, icon, mode, leftW, cols, sousChemin, data, cats,
 *   detail(id, api), emptyDetail(api), form(item, api, id), wire, wireDetail,
 *   cardPrice(item), migre(catalogue)            — écrit des corrections
 *   fusion(catalogue) → catalogue                — en mémoire, n'écrit rien
 *   resoudre(item, champs, id, api) → spec       — acte d'un bouton « auto »
 *   avantAchat(item, champs, act, id, api) → message d'erreur | null
 *   detteLourde(item, act, champs, id) → { motif, creancier? } | null
 *   msgOk(item, act, champs, id) → texte | null
 *   confirmer(item, act, champs, id) → texte ajouté à la confirmation | null
 *   actes : { nom: function(base, champs, api) → Promise<{ok, message?}> }
 *
 * DÉPEND DE : window.EcoCore (firebaseGet, firebaseUpdate, firebaseTransaction,
 *   writeField, getPseudo, getUserId). window.TDLBase est utilisé s'il est
 *   présent (clés locales), jamais exigé.
 * EXPOSE : window.Quais.
 * À CHARGER : après eco-core, AVANT quais-comptoir et les fichiers barge-*.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var CFG = {
    MONTAGE:        "#quais-app",          /* [MAJ] conteneur sur la page dédiée */
    TOPIC:          89,                    /* [MAJ] numéro du sujet ; 0 = aucune garde d'URL */
    NODE_BOUTIQUE:  "boutique",
    NODE_DEMANDES:  "boutique_demandes",
    NODE_MEMBRES:   "membres",
    NODE_CAGNOTTES: "cagnottes",
    NODE_BANDES:    "bandes",
    NODE_DOSSIERS:  "dossiers_main",
    NODE_ENQUETES:  "enquetes",
    NODE_LOSTBAYOU: "lost_bayou",
    MAX_DETTES_LOURDES: 3,
    COOLDOWN_JOURS: 7,
    CREANCIER_DEFAUT: "La Main de la Providence",
    FORUM_HOME:     "https://thedrownedlands.forumactif.com/",
    EDIT_URL:       "https://thedrownedlands.forumactif.com/post?p=465&mode=editpost", /* [MAJ] */
    MONNAIE:        "$",
    RETRY_MS:       250,
    RETRY_MAX:      60
  };

  var TXT = {
    TITRE:         "Les Quais du Bayou",
    ACCUEIL:       "Accueil",
    SOLDE:         "Solde",
    DETTES:        "Dettes",
    BIENTOT:       "Bientôt disponible.",
    STAFF_TITRE:   "Éditer les items",
    EDIT_TOPIC:    "Éditer le sujet",
    ENVOI:         "Soumettre ma demande",
    FERMER:        "Fermer",

    NON_CONNECTE:  "Connecte-toi pour faire une demande.",
    FONDS:         "Ton solde ne couvre pas cette somme.",
    FONDS_GELE:    function (g) { return "Ton solde ne couvre pas cette somme : " + money(g) + " sont retenus par la Main."; },
    ERR_PRIX:      "Ce service n'a pas de prix : préviens le staff.",
    ERR_ACHAT:     "L'envoi a échoué — rien n'a été débité.",
    ERR_PRET_SOMME:"Indique la somme que tu demandes.",
    ERR_PRET_CAG:  function (c) { return "La Main n'a pas cette somme en ce moment (cagnotte : " + money(c) + "). Demande moins, ou reviens plus tard."; },
    PLAFOND:       "Tu as déjà trois dettes lourdes en cours. Règles-en une avant d'en contracter une autre.",

    CONFIRMER:     "Confirmer l'envoi de ta demande ?",
    CONF_RETENU:   function (m) { return money(m) + " seront retenus sur ton solde jusqu'à la décision du staff, et rendus en cas de refus."; },
    CONF_RETENU_ACTE: function (m) { return money(m) + " seront retenus sur ton solde."; },
    CONF_DETTE:    function (n) { return "Une dette lourde (n°" + n + " sur " + CFG.MAX_DETTES_LOURDES + ") sera inscrite à ton nom dès maintenant. Elle sera effacée si le staff refuse."; },

    OK: {
      comptant: "Demande envoyée.",
      demande:  "Demande envoyée.",
      dette:    "Demande envoyée.",
      pret:     "Demande de prêt envoyée. Si le staff valide, la somme te sera versée."
    },
    OK_FAVEUR:     "Petite faveur enregistrée : la dette légère sera notée à la validation.",
    OK_RETENU:     function (m) { return money(m) + " sont retenus jusqu'à la décision du staff, et te seront rendus en cas de refus."; },
    OK_DETTE:      function (n) { return "Dette lourde n°" + n + " inscrite à ton nom, en attente : elle sera effacée si le staff refuse."; }
  };

  /* ===================== UTILS ===================== */
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function versTableau(v){ return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]); }
  function money(n){ return (typeof n==="number"?n.toLocaleString("fr-FR").replace(/\u202f/g," "):n)+" "+CFG.MONNAIE; }
  function montantDe(v){ return parseInt(String(v==null?"":v).replace(/[^\d]/g,""), 10) || 0; }
  function plein(v){ return String(v==null?"":v).trim().length > 0; }
  function E(){ return window.EcoCore; }
  function noop(){}

  /* Un seul résolveur de pseudo : EcoCore d'abord, _userdata en secours. */
  function pseudo(){
    try { var p = E().getPseudo(); if (p) return String(p).trim(); } catch(e){}
    try { if (typeof _userdata!=="undefined" && _userdata.username) return String(_userdata.username).trim(); } catch(e){}
    return null;
  }
  function isStaff(){ try { return typeof _userdata!=="undefined" && (_userdata.user_level===1||_userdata.user_level===2); } catch(e){ return false; } }

  /* Clé générée en local : la demande et sa dette partent dans le MÊME PATCH,
     il faut donc connaître la clé de la demande avant d'écrire. */
  function cle(){
    try { if (window.TDLBase && TDLBase.nouvelleCle) return TDLBase.nouvelleCle(); } catch(e){}
    return "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  /* Sans garde, quandPret boucle 15 s sur CHAQUE page du forum. On filtre sur
     le NUMÉRO du sujet, jamais sur le slug : /t89-slug, /t89p25-slug. */
  function surLeSujet(){
    if (!CFG.TOPIC) return true;
    return new RegExp("/t" + CFG.TOPIC + "(p\\d+)?[-/]").test(location.pathname);
  }

  function quandPret(cb, n){
    n = n||0;
    var mount = document.querySelector(CFG.MONTAGE);
    var eco = window.EcoCore && typeof EcoCore.firebaseGet==="function" && typeof EcoCore.firebaseTransaction==="function";
    if (mount && eco && registre.length) { cb(mount); return; }
    if (n > CFG.RETRY_MAX) {
      if (window.console) console.warn("[Quais] démarrage impossible — eco:"+!!eco+" conteneur:"+!!mount+" modules:"+registre.length);
      if (mount) { monter(mount); mount.innerHTML = '<div class="qb-empty" style="padding:24px">'
        + (!eco ? "EcoCore introuvable — vérifie l'ordre de chargement (eco-core avant quais-core)."
                : !registre.length ? "Aucun module de boutique chargé — vérifie que les modules sont inclus après quais-core."
                : "Conteneur "+CFG.MONTAGE+" introuvable.") + '</div>'; }
      return;
    }
    setTimeout(function(){ quandPret(cb, n+1); }, CFG.RETRY_MS);
  }

  /* ===================== CATALOGUE ===================== */
  /* boutique/<sousChemin>/<id>. Lecture de la seule sous-branche ; chemins de
     lecture encodés, chemins d'écriture BRUTS (firebaseUpdate est un PATCH racine). */
  var catalogue = {
    async lire(sousChemin, defaut){
      var cur = await E().firebaseGet(CFG.NODE_BOUTIQUE + "/" + sousChemin.split("/").map(encodeURIComponent).join("/"));
      if (cur && Object.keys(cur).length) return cur;
      if (defaut && Object.keys(defaut).length) {
        try { await E().writeField(CFG.NODE_BOUTIQUE + "/" + sousChemin, defaut); } catch(e){ if (window.console) console.warn("[Quais] semis échoué", e); }
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

  /* ===================== MEMBRE ===================== */
  /* La seule feuille du membre. firebaseGet ignore le cache de session : le
     solde affiché après un achat est le vrai. Les branches brutes sont
     gardées, parce que leurs CLÉS servent (Disparition, recouvrements). */
  var membre = {
    async lire(){
      var p = pseudo(); if (!p) return { pseudo:null, solde:0, dettes:[], dettesBrut:{}, pretsBrut:{}, cooldowns:{} };
      var m = await E().firebaseGet(CFG.NODE_MEMBRES + "/" + encodeURIComponent(p)) || {};
      return { pseudo:p, solde:m.dollars||0, dettes:versTableau(m.dettes),
               dettesBrut:m.dettes||{}, pretsBrut:m.prets||{}, cooldowns:m.nego_cd||{} };
    },
    /* en_attente compte : c'est ce qui rend le plafond tenable */
    dettesLourdesActives(dettes){
      return versTableau(dettes).filter(function(d){
        return d && d.type==="lourde" && (d.statut==="active" || d.statut==="en_attente");
      });
    }
  };

  /* dettes ET prêts du membre, avec leur clé préfixée : "dettes:k" / "prets:k" */
  function dusDe(etat){
    var out = [];
    function pousser(src, coin){
      if (!src) return;
      if (Array.isArray(src)) src.forEach(function(x,i){ if (x) out.push({ key:coin+":"+i, source:coin, d:x }); });
      else Object.keys(src).forEach(function(k){ if (src[k]) out.push({ key:coin+":"+k, source:coin, d:src[k] }); });
    }
    pousser(etat.dettesBrut, "dettes"); pousser(etat.pretsBrut, "prets");
    return out;
  }

  /* ===================== ARGENT ===================== */
  /* Débit strict : jamais de solde négatif, et la somme gelée par un
     recouvrement de la Main n'est pas dépensable. */
  var argent = {
    async retenir(montant){
      var p = pseudo(); if (!p) throw new Error("CONNEXION");
      montant = montant|0; if (montant <= 0) return;
      if (GELE > 0 && dispo() < montant) throw new Error("GELE");
      await E().firebaseTransaction(CFG.NODE_MEMBRES + "/" + encodeURIComponent(p) + "/dollars", function(cur){
        var s = cur||0; if (s < montant) throw new Error("FONDS"); return s - montant;
      });
    },
    async rendre(montant){
      var p = pseudo(); montant = montant|0; if (!p || montant <= 0) return;
      await E().firebaseTransaction(CFG.NODE_MEMBRES + "/" + encodeURIComponent(p) + "/dollars", function(cur){ return (cur||0) + montant; });
    }
  };
  function alerteArgent(e){
    if (e && e.message==="GELE")      alert(TXT.FONDS_GELE(GELE));
    else if (e && e.message==="FONDS") alert(TXT.FONDS);
    else if (e && e.message==="CONNEXION") alert(TXT.NON_CONNECTE);
    else { if (window.console) console.error("[Quais] débit", e); alert(TXT.ERR_ACHAT); }
  }

  /* ===================== MOTEUR ===================== */
  /* base = { boutique, bande, sousChemin, itemId, nom, montant, demandeType,
              detteType, cagnotte, creancier, detteAuto, reseau_auto,
              msgOk, detteLourde:{motif, creancier, num} } */
  function demandeBase(base, champs){
    var uid = 0; try { uid = E().getUserId(); } catch(e){}
    var d = { date:new Date().toISOString(), pseudo:pseudo(), uid:uid, statut:"en_attente",
              boutique:base.boutique||"", bande:base.bande||"", itemId:base.itemId||"", nom:base.nom||"" };
    if (champs) for (var k in champs) if (champs.hasOwnProperty(k) && champs[k]!=null && champs[k]!=="") d[k]=champs[k];
    return d;
  }

  /* La demande, et sa dette lourde s'il y en a une, en UN SEUL PATCH :
     Firebase l'applique en tout ou rien. */
  async function inscrire(d, lourde, base){
    var id = cle(), up = {}, p = d.pseudo;
    if (lourde) {
      var k = cle();
      d.dette_cle = k; d.dette_num = lourde.num;
      up[CFG.NODE_MEMBRES + "/" + p + "/dettes/" + k] = {
        type:"lourde", statut:"en_attente",
        creancier: lourde.creancier || base.creancier || CFG.CREANCIER_DEFAUT,
        motif: lourde.motif || base.nom || "",
        date: new Date().toISOString(), demandeId:id
      };
    }
    up[CFG.NODE_DEMANDES + "/" + id] = d;
    await E().firebaseUpdate(up);
    try { if (window.EcoNotif) EcoNotif.staff(103, { pseudo:p, nom:base.nom }); } catch(e){}
    return id;
  }

  function composer(act, base, retenue, lourde){
    var t = [];
    t.push(base.msgOk || (act==="dette" && base.detteType==="legere" ? TXT.OK_FAVEUR : (TXT.OK[act] || TXT.OK.demande)));
    if (retenue > 0) t.push(TXT.OK_RETENU(retenue));
    if (lourde) t.push(TXT.OK_DETTE(lourde.num));
    return t.join(" ");
  }

  /* Exécute un acte du socle. Aucun contrôle ici : soumettre() les a faits.
     Exposé pour les rares modules qui reprennent la main en cours de route
     (le dé de la Main), jamais pour contourner la confirmation. */
  async function executer(act, base, champs){
    var lourde = base.detteLourde || null;
    var retenue = (act==="pret") ? 0 : (base.montant|0);
    var d = demandeBase(base, champs);

    if (act==="pret") {
      var somme = montantDe(champs.montant_souhaite);
      if (somme <= 0) { alert(TXT.ERR_PRET_SOMME); return { ok:false }; }
      var cible = base.cagnotte || "Providence", cag = 0;
      try { cag = (await E().firebaseGet(CFG.NODE_CAGNOTTES + "/" + encodeURIComponent(cible))) || 0; } catch(e){}
      if (cag < somme) { alert(TXT.ERR_PRET_CAG(cag)); return { ok:false, fonds:true }; }
      d.type = "pret"; d.montant = somme; d.cagnotte = cible;
    } else if (act==="comptant") {
      d.type = "comptant"; d.montant = retenue;
      if (base.cagnotte) d.cagnotte = base.cagnotte;
      if (base.detteAuto && base.detteAuto!=="lourde") { d.dette_type = base.detteAuto; d.creancier = base.creancier || ""; d.motif = base.nom || ""; }
    } else if (act==="dette") {
      d.type = "dette"; d.dette_type = base.detteType || "lourde";
      d.creancier = base.creancier || base.bande || ""; d.motif = base.nom || "";
      if (retenue > 0) d.montant = retenue;
    } else {
      d.type = base.demandeType || "demande";
      if (retenue > 0) { d.montant = retenue; if (base.cagnotte) d.cagnotte = base.cagnotte; }
    }
    if (base.reseau_auto) d.reseau_auto = base.reseau_auto;

    if (retenue > 0) {
      try { await argent.retenir(retenue); } catch(e){ alerteArgent(e); return { ok:false, fonds:true }; }
    }
    try { await inscrire(d, lourde, base); }
    catch(e){
      if (retenue > 0) await argent.rendre(retenue).catch(noop);
      if (window.console) console.error("[Quais] inscription", e);
      alert(TXT.ERR_ACHAT); return { ok:false };
    }
    return { ok:true, message: composer(act, base, retenue, lourde) };
  }

  /* Plafond des dettes lourdes, relu au moment même : rend le rang de la
     prochaine dette, ou -1 si le plafond est atteint. */
  async function rangLourde(){
    var etat = await membre.lire();
    var n = membre.dettesLourdesActives(etat.dettes).length;
    return n >= CFG.MAX_DETTES_LOURDES ? -1 : n + 1;
  }

  function texteConfirmation(act, retenue, lourde, extra){
    var l = [TXT.CONFIRMER];
    if (retenue > 0) l.push(ACTES_SOCLE[act] ? TXT.CONF_RETENU(retenue) : TXT.CONF_RETENU_ACTE(retenue));
    if (lourde) l.push(TXT.CONF_DETTE(lourde.num));
    if (extra) l.push(extra);
    return l.join("\n\n");
  }

  var ACTES_SOCLE = { comptant:1, dette:1, demande:1, pret:1 };
  var ENVOI = false;   /* verrou global : un seul envoi à la fois, tous boutons confondus */

  async function soumettre(mod, spec, btn){
    if (ENVOI) return { ok:false, occupe:true };
    ENVOI = true; if (btn) btn.disabled = true;
    try { return await soumettreSousVerrou(mod, spec || {}); }
    finally { ENVOI = false; if (btn) btn.disabled = false; }
  }

  async function soumettreSousVerrou(mod, spec){
    if (!pseudo()) { alert(TXT.NON_CONNECTE); return { ok:false }; }
    var det = root.querySelector("#qb-detail");
    var id = st.sel, a = itemData(mod, id), c = catOf(mod, id);
    var champs = det ? collecterChamps(det) : {};

    /* résolution : un bouton « auto » laisse le module dire ce qu'il fait */
    var s = {}, k;
    if (!spec.act || spec.act==="auto") {
      var r = (mod.resoudre && mod.resoudre(a, champs, id, api)) || { act:"demande" };
      for (k in r) s[k] = r[k];
    }
    for (k in spec) if (spec.hasOwnProperty(k) && k!=="act" && spec[k]!==undefined) s[k] = spec[k];
    if (spec.act && spec.act!=="auto") s.act = spec.act;
    var act = s.act || "demande";
    if (s.champs) for (k in s.champs) champs[k] = s.champs[k];

    if (mod.avantAchat) {
      var refus = mod.avantAchat(a, champs, act, id, api);
      if (refus) { alert(refus); return { ok:false }; }
    }

    var base = {
      boutique: mod.key,
      bande: mod.mode==="grid" ? (c && c.l || "") : "",
      sousChemin: typeof mod.sousChemin==="function" ? mod.sousChemin(id, c) : mod.sousChemin,
      itemId: id, nom: a.n,
      montant: (s.montant!==undefined && s.montant!==null) ? (s.montant|0) : 0,
      demandeType: s.demandeType, detteType: s.detteType,
      cagnotte: s.cagnotte!==undefined ? s.cagnotte : a.cagnotte,
      creancier: a.creancier,
      detteAuto: s.detteAuto!==undefined ? s.detteAuto : a.detteAuto,
      reseau_auto: a.reseau_auto
    };
    base.msgOk = s.msgOk || (mod.msgOk ? mod.msgOk(a, act, champs, id) : null);

    if (act==="comptant" && !(base.montant > 0)) { alert(TXT.ERR_PRIX); return { ok:false }; }

    /* dette lourde : celle d'un acte « dette » (hors faveur légère et service
       dû), celle d'un achat qui l'emporte d'office, ou celle que le module
       déclare (compensation choisie par le joueur) */
    var lourde = null;
    if (act==="dette" && base.detteType!=="legere" && base.detteType!=="service") lourde = { motif:base.nom };
    else if (base.detteAuto==="lourde") lourde = { motif:base.nom };
    else if (mod.detteLourde) lourde = mod.detteLourde(a, act, champs, id) || null;

    var retenue = (act==="pret") ? 0 : base.montant;
    if (retenue > 0 && dispo() < retenue) { alert(GELE > 0 ? TXT.FONDS_GELE(GELE) : TXT.FONDS); return { ok:false, fonds:true }; }

    if (lourde) {
      var n = await rangLourde();
      if (n < 0) { alert(TXT.PLAFOND); return { ok:false, plafond:true }; }
      lourde.num = n;
      base.detteLourde = lourde;
    }

    if ((retenue > 0 || lourde) && !s.confirme) {
      var extra = mod.confirmer ? mod.confirmer(a, act, champs, id) : null;
      if (!window.confirm(texteConfirmation(act, retenue, lourde, extra))) return { ok:false, annule:true };
    }

    var res;
    if (ACTES_SOCLE[act]) res = await executer(act, base, champs);
    else if (mod.actes && typeof mod.actes[act]==="function") res = await mod.actes[act](base, champs, api);
    else { if (window.console) console.warn("[Quais] acte inconnu : "+act); res = { ok:false }; }

    if (res && res.ok) {
      var msg = res.message!==undefined ? res.message : base.msgOk;
      if (msg && !s.silent) alert(msg);
      await refresh();
    }
    return res;
  }

  /* compatibilité : appels directs des modules existants */
  var achat = {
    comptant: function(base, champs){ return executer("comptant", base, champs); },
    dette:    function(base, champs){ return executer("dette", base, champs); },
    demande:  function(base, champs){ return executer("demande", base, champs); },
    pret:     function(base, champs){ return executer("pret", base, champs); },
    executer: executer,
    retenir:  argent.retenir,
    rendre:   argent.rendre
  };

  /* ===================== HELPERS UI ===================== */
  /* Une liste déroulante accepte des paires [valeur, libellé] — le cas
     courant — ou, pour les modules anciens, de simples libellés.
     extra = { bascule:"groupe", id:"…" } */
  function sel(champ, opts, vide, extra){
    extra = extra || {};
    var paires = opts.length && Array.isArray(opts[0]);
    var html = '<select data-champ="'+esc(champ)+'"'
      + (extra.bascule ? ' data-bascule="'+esc(extra.bascule)+'"' : "")
      + (extra.id ? ' id="'+esc(extra.id)+'"' : "") + '>';
    if (paires) {
      if (vide) html += '<option value="">'+esc(vide)+'</option>';
      html += opts.map(function(o){ return '<option value="'+esc(o[0])+'">'+esc(o[1])+'</option>'; }).join("");
    } else {
      html += '<option>'+esc(vide || "— Sélectionner —")+'</option>'
        + opts.map(function(o){ return '<option>'+esc(o)+'</option>'; }).join("");
    }
    return html + '</select>';
  }

  var ui = {
    money: money, esc: esc, versTableau: versTableau, montant: montantDe, plein: plein,
    lab:  function(t){ return '<span class="qb-lab">'+esc(t)+'</span>'; },
    fld:  function(label, inner){ return '<div class="qb-fld"><span class="qb-flab">'+esc(label)+'</span>'+inner+'</div>'; },
    ta:   function(champ, ph){ return '<textarea data-champ="'+esc(champ)+'" placeholder="'+esc(ph||"")+'"></textarea>'; },
    inp:  function(champ, ph, val){ return '<input data-champ="'+esc(champ)+'" placeholder="'+esc(ph||"")+'"'+(val!=null?' value="'+esc(val)+'"':"")+'>'; },
    sel:  sel,
    aide: function(t){ return t ? '<div class="qb-helper">'+esc(t)+'</div>' : ""; },
    puces: function(titre, arr){
      arr = versTableau(arr); if (!arr.length) return "";
      return '<div class="qb-sec">'+ui.lab(titre)+'<ul class="qb-bull">'+arr.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+'</ul></div>';
    },
    section: function(titre, html){ return '<div class="qb-sec">'+ui.lab(titre)+html+'</div>'; },
    /* deux colonnes égales (empilées sous 1100 px) */
    duo: function(a, b){ return '<div class="qb-pcgrid"><div>'+(a||"")+'</div><div>'+(b||"")+'</div></div>'; },
    /* rangée souple : chaque cellule tient au moins 190 px, aucune liste ne
       prend seule toute la largeur de la fiche */
    rangee: function(){
      return '<div class="qb-selrow">'+Array.prototype.slice.call(arguments).filter(Boolean).map(function(x){ return '<div>'+x+'</div>'; }).join("")+'</div>';
    },
    /* zone conditionnelle : visible quand la liste data-bascule du groupe vaut
       l'une des valeurs déclarées. Ses champs ne sont lus que si elle est
       visible. noms = "groupe:valeur" ou "groupe:v1 groupe:v2" */
    zone: function(noms, html){ return '<div data-zone="'+esc(noms)+'" hidden>'+html+'</div>'; },
    caseACocher: function(champ, libelle, o){
      o = o || {};
      return '<label class="qb-check"><input type="checkbox" data-champ="'+esc(champ)+'" data-on="oui"'
        + (o.id ? ' id="'+esc(o.id)+'"' : "") + (o.coche ? " checked" : "") + (o.verrou ? " disabled" : "") + '>'
        + '<div>'+esc(libelle)+'</div></label>';
    },
    /* le seul bouton d'envoi des fiches. type fourni = acte « demande » fixe
       (compatibilité) ; sinon le module résout l'acte d'après le formulaire */
    envoi: function(label, type){
      return '<div class="qb-opts qb-center"><button class="qb-optbtn qb-pay qb-act" style="flex:none" '
        + (type ? 'data-act="demande" data-type="'+esc(type)+'"' : 'data-act="auto"')
        + '>'+esc(label || TXT.ENVOI)+'</button></div>';
    },
    /* carte d'option. o.act → le bouton soumet ; o.ouvre → il ouvre le volet
       ui.zone("revele:"+o.ouvre, …) ; ni l'un ni l'autre → carte sans bouton */
    optcard: function(o){
      var bouton = "";
      if (o.ouvre) bouton = '<button class="qb-optbtn'+(o.pay?" qb-pay":"")+'" data-ouvre="'+esc(o.ouvre)+'">'+esc(o.btn)+'</button>';
      else if (o.act) bouton = '<button class="qb-optbtn'+(o.pay?" qb-pay":"")+' qb-act" data-act="'+esc(o.act)+'"'
        + (o.montant!=null?' data-montant="'+(o.montant|0)+'"':"")+(o.type?' data-type="'+esc(o.type)+'"':"")+(o.dette?' data-dette="'+esc(o.dette)+'"':"")+(o.id?' id="'+esc(o.id)+'"':"")
        + '>'+esc(o.btn)+'</button>';
      return '<div class="qb-optcard'+(o.pay?" qb-pay":"")+'"><div class="qb-optcircle"><i class="'+esc(o.ic)+'"></i></div>'
        + '<div class="qb-optbody"><div class="qb-opttitle">'+esc(o.titre)+'</div><div class="qb-optdesc">'+esc(o.desc)+'</div>'
        + (o.note?'<div class="qb-optnote">'+esc(o.note)+'</div>':"")+'</div>'
        + '<div class="qb-optright">'+(o.prix?'<div class="qb-optprice">'+esc(o.prix)+'</div>':"")+bouton+'</div></div>';
    },
    /* rangée de cartes d'option */
    options: function(){ return '<div class="qb-opts">'+Array.prototype.slice.call(arguments).filter(Boolean).join("")+'</div>'; },
    infosCles: function(paires, iconOf){
      return '<div class="qb-sec">'+ui.lab("Informations clés")+'<div class="qb-kg4">'
        + paires.map(function(f){ return '<div class="qb-kf"><div><div class="qb-kl"><i class="'+esc((iconOf&&iconOf(f[0]))||"fi fi-tr-diamond")+'"></i>'+esc(f[0])+'</div><div class="qb-kv">'+esc(f[1])+'</div></div></div>'; }).join("")
        + '</div></div>';
    }
  };

  /* ===================== REGISTRE ===================== */
  var registre = [];
  var mounted = false;
  function register(mod){
    registre.push(mod);
    if (mounted) chargerModule(mod).then(function(){ render(); });
  }
  function modByKey(k){ for (var i=0;i<registre.length;i++) if (registre[i].key===k) return registre[i]; return null; }

  var st = { tab:null, open:null, band:null, sel:null, staff:false, formMode:false, formItem:null };
  var cat = {};
  var etatMembre = { pseudo:null, solde:0, dettes:[], dettesBrut:{}, pretsBrut:{}, cooldowns:{} };
  var PSEUDOS = [];
  var BANDES_INFO = {};
  var ENQUETES = [];
  var GELE = 0;
  var CREANCES = [];
  var DUS = [];

  /* Un recouvrement ouvert de la Main fige sa somme : elle reste au solde mais
     devient indépensable. Le gel vit dans dossiers_main, pas chez le membre. */
  var GEL_STATUTS = { ouvert:1, saisi:1, en_validation:1 };
  function calculerGel(dossiers){
    var p = pseudo(); if (!p) return 0;
    var t = 0;
    Object.keys(dossiers || {}).forEach(function(id){
      var d = dossiers[id] || {};
      if (d.type!=="recouvrement" || !d.montant || !GEL_STATUTS[d.statut]) return;
      if (d.dette && d.dette.pseudo===p) t += (d.montant|0);
    });
    return t;
  }
  /* Affaires ouvertes du panneau des enquêtes (ni classées ni verrouillées). */
  function lireEnquetes(n){
    var out = [];
    Object.keys(n || {}).forEach(function(id){
      var a = n[id] || {};
      if (a.cloturee || a.intrigue) return;
      out.push({ id:id, type:a.type||"", titre:a.titre||"(sans titre)" });
    });
    out.sort(function(x,y){ return String(x.titre).localeCompare(String(y.titre),"fr"); });
    return out;
  }
  /* Créances de service que le membre a PROPOSÉES aux Sorcières (plafond). */
  var CREANCE_OUVERTE = { due:1, en_cours:1, en_validation:1 };
  function lireCreances(n){
    var p = pseudo(); if (!p) return [];
    var out = [];
    Object.keys(n || {}).forEach(function(id){
      var f = n[id] || {};
      if (f.type!=="creance" || f.origine!=="propose") return;
      if (f.debiteur!==p || !CREANCE_OUVERTE[f.statut]) return;
      out.push({ id:id, titre:f.titre||"", nature:f.nature||"", statut:f.statut });
    });
    return out;
  }

  function dispo(){ return Math.max(0, (etatMembre.solde|0) - GELE); }

  /* ===================== RENDU ===================== */
  var root;

  function renderBar(){
    var lourdes = membre.dettesLourdesActives(etatMembre.dettes).length;
    var dots = ""; for (var i=0;i<CFG.MAX_DETTES_LOURDES;i++) dots += '<span class="qb-dot'+(i<lourdes?" qb-on":"")+'"></span>';
    return '<div class="qb-bar">'
      + '<a class="qb-accueil" href="'+CFG.FORUM_HOME+'"><i class="fi fi-tr-house-flood"></i> '+TXT.ACCUEIL+'</a>'
      + '<div class="qb-title">'+esc(TXT.TITRE)+'</div>'
      + '<div class="qb-user">'
      +   '<span class="qb-uname">'+esc(etatMembre.pseudo||"Invité")+'</span>'
      +   '<div class="qb-ublock"><span class="qb-lab">'+TXT.SOLDE+'</span><span class="qb-usolde">'+money(etatMembre.solde)
      +     (GELE>0?' <span class="qb-gele">dont '+money(GELE)+' retenus</span>':'')+'</span></div>'
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
  function itemsOfCat(mod, c){
    if (c.it) return c.it;
    var d = catalogueDe(mod);
    return Object.keys(d).filter(function(id){ return d[id] && d[id].cat===c.k; });
  }
  function firstItem(mod){ for (var i=0;i<mod.cats.length;i++){ var ids=itemsOfCat(mod,mod.cats[i]); if (ids.length) return ids[0]; } return null; }
  function catOf(mod, id){
    var it = itemData(mod,id), i;
    for (i=0;i<mod.cats.length;i++) if (mod.cats[i].k===it.cat) return mod.cats[i];
    for (i=0;i<mod.cats.length;i++) if (itemsOfCat(mod,mod.cats[i]).indexOf(id)>=0) return mod.cats[i];
    return null;
  }

  var api = {
    ui: ui, cfg: CFG,
    item: function(id){ return itemData(modByKey(st.tab), id); },
    cat:  function(id){ return catOf(modByKey(st.tab), id); },
    cats: function(){ var m=modByKey(st.tab); return m?m.cats:[]; },
    band: function(){ return st.band; },
    selId: function(){ return st.sel; },
    /* champs visibles de la fiche ouverte, tels que soumettre() les lira */
    champs: function(){ var det = root && root.querySelector("#qb-detail"); return det ? collecterChamps(det) : {}; },
    /* porte d'entrée des modules : même pipeline que les boutons */
    acheter: function(opts){ var mod = modByKey(st.tab); return mod ? soumettre(mod, opts || {}, null) : Promise.resolve({ ok:false }); },
    cooldownActif: function(id){
      var iso = etatMembre.cooldowns && etatMembre.cooldowns[id]; if (!iso) return null;
      var t = new Date(iso).getTime(); if (isNaN(t)) return null;
      var fin = t + CFG.COOLDOWN_JOURS*86400000;
      return Date.now() < fin ? new Date(fin) : null;
    },
    setCooldown: async function(id){
      var p = etatMembre.pseudo; if (!p) return;
      var iso = new Date().toISOString();
      if (!etatMembre.cooldowns) etatMembre.cooldowns = {}; etatMembre.cooldowns[id] = iso;
      try { await E().writeField(CFG.NODE_MEMBRES+"/"+encodeURIComponent(p)+"/nego_cd/"+id, iso); } catch(e){}
    },
    pseudos: function(){ return PSEUDOS; },
    /* dettes du membre avec leur VRAIE clé Firebase : [{ key, d }] */
    dettes: function(){
      var src = etatMembre.dettesBrut, out = [];
      if (Array.isArray(src)) src.forEach(function(x,i){ if (x) out.push({ key:String(i), d:x }); });
      else if (src) Object.keys(src).forEach(function(k){ if (src[k]) out.push({ key:k, d:src[k] }); });
      return out;
    },
    dus: function(){ return DUS; },
    creances: function(){ return CREANCES; },
    enquetes: function(){ return ENQUETES; },
    bandeInfo: function(key){ return BANDES_INFO[key] || null; },
    staff: function(){ return st.staff; },
    membre: function(){ return etatMembre; },
    nouvelId: function(){ return "it" + Date.now().toString(36) + Math.random().toString(36).slice(2,5); },
    enregistrer: async function(id, item){
      var mod = modByKey(st.tab);
      var chemin = typeof mod.sousChemin==="string" ? mod.sousChemin : (mod.sousChemin?mod.sousChemin(id, null):mod.key);
      if (!cat[mod.key]) cat[mod.key] = {};
      try { await catalogue.sauverItem(chemin, id, item); }
      catch(e){ if (window.console) console.error("[Quais] enregistrer", e); alert("Sauvegarde échouée."); return false; }
      cat[mod.key][id] = mod.fusion ? (mod.fusion((function(){ var o={}; o[id]=item; return o; })())[id] || item) : item;
      if (item.cat) { st.band = item.cat; st.open = item.cat; }
      st.formMode=false; st.sel=id; render(); return true;
    },
    annulerForm: function(){ st.formMode=false; render(); }
  };

  function renderLeftAccordion(mod){
    var html = "";
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
    var band = mod.cats.filter(function(c){return c.k===st.band;})[0];
    var couleur = (band && band.c) || "var(--dark2)";
    var html = '<div class="qb-bandgrid">'+mod.cats.map(function(c){
      return '<button class="qb-bandcell'+(c.k===st.band?" qb-on":"")+'" data-b="'+c.k+'" style="--c:'+(c.c||"var(--dark2)")+'"><i class="'+esc(c.ic)+'"></i><span>'+esc(c.l)+'</span></button>';
    }).join("")+'</div><div class="qb-leftbody" style="--c:'+couleur+'">'+(mod.itemsLabel?ui.lab(mod.itemsLabel):"");
    var ids = band ? itemsOfCat(mod, band) : [];
    if (!ids.length) html += '<div class="qb-empty">'+TXT.BIENTOT+'</div>';
    else html += '<div class="qb-cards qb-c'+(mod.cols||2)+'">'+ids.map(function(id){ return cardHTML(mod, id); }).join("")+'</div>';
    if (st.staff) html += '<button class="qb-addbtn" id="qb-addbtn"><i class="fi fi-tr-add"></i> Ajouter un item</button>';
    return html + '</div>';
  }
  function cardHTML(mod, id){
    var a = itemData(mod, id);
    var prix = mod.cardPrice ? mod.cardPrice(a) : (typeof a.p==="number"?money(a.p):(a.p||""));
    return '<button class="qb-card'+(id===st.sel?" qb-on":"")+'" data-k="'+id+'">'+(a.ic?'<i class="fi fi-sr-'+esc(a.ic)+' qb-bgic"></i>':"")
      + (st.staff?'<i class="fi fi-tr-edit qb-editm"></i>':(a.gd?'<span class="qb-gdmark" title="Génère une dette"></span>':""))
      + '<span class="qb-cn">'+esc(a.n)+'</span><span class="qb-cp">'+esc(prix)+'</span></button>';
  }
  function renderLeft(mod){ return mod.mode==="grid" ? renderLeftGrid(mod) : renderLeftAccordion(mod); }

  function renderDetail(mod){
    if (st.formMode) return mod.form ? mod.form(st.formItem?itemData(mod,st.formItem):null, api, st.formItem) : '<div class="qb-empty">Édition indisponible.</div>';
    if (!st.sel) return mod.emptyDetail ? mod.emptyDetail(api) : '<div class="qb-empty">'+TXT.BIENTOT+'</div>';
    return mod.detail(st.sel, api);
  }

  function render(){
    var mod = modByKey(st.tab); if (!mod) return;
    var isGrid = mod.mode==="grid";
    root.innerHTML = renderBar() + renderTabs()
      + '<div class="qb-main" style="grid-template-columns:'+(mod.leftW||"440px")+' 1fr">'
      +   '<div class="qb-col qb-left'+(isGrid?" qb-flush":"")+'" id="qb-left">'+renderLeft(mod)+'</div>'
      +   '<div class="qb-col qb-detail'+(mod.detailFlush&&!st.formMode?" qb-flush":"")+'" id="qb-detail">'+renderDetail(mod)+'</div>'
      + '</div>';
    wire(mod);
  }

  /* ===================== WIRING ===================== */
  function wire(mod){
    Array.prototype.forEach.call(root.querySelectorAll(".qb-tab"), function(b){ b.onclick = function(){ selectTab(b.getAttribute("data-tab")); }; });
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
    if (mod.wire) mod.wire(root, api);
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

  /* Zones conditionnelles : une liste data-bascule="g" montre les zones
     dont un nom vaut "g:<valeur choisie>" et masque les autres du groupe. */
  function brancherBascules(det){
    Array.prototype.forEach.call(det.querySelectorAll("select[data-bascule]"), function(s){
      var g = s.getAttribute("data-bascule");
      function appliquer(){
        Array.prototype.forEach.call(det.querySelectorAll("[data-zone]"), function(z){
          var noms = z.getAttribute("data-zone").split(/\s+/);
          if (!noms.some(function(n){ return n.indexOf(g+":")===0; })) return;
          z.hidden = noms.indexOf(g+":"+s.value) < 0;
        });
      }
      s.addEventListener("change", appliquer); appliquer();
    });
  }

  /* Volets ouverts par une carte d'option. Un seul ouvert à la fois. */
  function volets(det, nom){
    return Array.prototype.filter.call(det.querySelectorAll("[data-zone]"), function(z){
      var noms = z.getAttribute("data-zone").split(/\s+/);
      return nom ? noms.indexOf("revele:"+nom) >= 0 : noms.some(function(n){ return n.indexOf("revele:")===0; });
    });
  }
  function fermerVolets(det){
    volets(det).forEach(function(z){ z.hidden = true; });
    Array.prototype.forEach.call(det.querySelectorAll("[data-ouvre]"), function(b){
      if (b.getAttribute("data-lib")) b.textContent = b.getAttribute("data-lib");
    });
  }
  function brancherVolets(det){
    Array.prototype.forEach.call(det.querySelectorAll("[data-ouvre]"), function(b){
      b.setAttribute("data-lib", b.textContent);
      b.onclick = function(){
        var zs = volets(det, b.getAttribute("data-ouvre"));
        var ouvrir = zs.length && zs[0].hidden;
        fermerVolets(det);
        if (!ouvrir) return;
        zs.forEach(function(z){ z.hidden = false; });
        b.textContent = TXT.FERMER;
      };
    });
  }

  function wireDetail(mod){
    var det = root.querySelector("#qb-detail"); if (!det) return;
    brancherBascules(det);
    brancherVolets(det);
    Array.prototype.forEach.call(det.querySelectorAll(".qb-act"), function(b){
      b.onclick = function(){ depuisBouton(mod, b); };
    });
    if (mod.wireDetail) mod.wireDetail(det, api);
  }

  /* un champ d'une zone masquée n'existe pas pour l'envoi */
  function collecterChamps(scope){
    var c = {};
    Array.prototype.forEach.call(scope.querySelectorAll("[data-champ]"), function(el){
      if (el.closest("[hidden]")) return;
      c[el.getAttribute("data-champ")] = el.type==="checkbox" ? (el.checked ? (el.getAttribute("data-on")||"oui") : "") : el.value;
    });
    return c;
  }

  function depuisBouton(mod, btn){
    /* un paiement au prix affiché n'emporte pas les champs d'un volet ouvert */
    var det = root.querySelector("#qb-detail");
    if (det && !btn.closest('[data-zone^="revele:"], [data-zone*=" revele:"]')) fermerVolets(det);
    var m = btn.getAttribute("data-montant");
    return soumettre(mod, {
      act: btn.getAttribute("data-act") || "auto",
      montant: m!=null ? parseInt(m,10) : undefined,
      demandeType: btn.getAttribute("data-type") || undefined,
      detteType: btn.getAttribute("data-dette") || undefined
    }, btn);
  }

  /* ===================== CHARGEMENT ===================== */
  /* Un module qui fournit fusion() garde sa structure dans le code : le
     catalogue Firebase n'apporte que le contenu éditable, et rien n'est
     écrit pour autant. migre() reste pour les modules qui en ont besoin. */
  async function chargerModule(m){
    var chemin = typeof m.sousChemin==="string" ? m.sousChemin : m.key;
    var brut;
    try { brut = await catalogue.lire(chemin, m.fusion ? null : (m.data||null)); } catch(e){ brut = null; }
    if (m.fusion) { cat[m.key] = m.fusion(brut || {}); return; }
    cat[m.key] = brut || m.data || {};
    if (m.migre) { try { await appliquerMigration(m, chemin); } catch(e){ if (window.console) console.warn("[Quais] migration "+chemin, e); } }
  }
  async function appliquerMigration(m, chemin){
    var patch = m.migre(cat[m.key]); if (!patch) return;
    var ids = Object.keys(patch); if (!ids.length) return;
    var maj = {};
    ids.forEach(function(id){ maj[CFG.NODE_BOUTIQUE+"/"+chemin+"/"+id] = patch[id]; cat[m.key][id] = patch[id]; });
    await E().firebaseUpdate(maj);
    if (window.console) console.log("[Quais] migration "+chemin+" : "+ids.length+" item(s) corrigé(s).");
  }
  async function chargerCatalogues(){ for (var i=0;i<registre.length;i++) await chargerModule(registre[i]); }

  /* Cinq branches ciblées. membres sert à la liste des pseudos ; enquetes
     pèse le plus lourd : c'est elle qu'il faudra différer si l'ouverture
     devient lente. */
  async function chargerAnnexes(){
    try {
      var r = await Promise.all([
        E().firebaseGet(CFG.NODE_MEMBRES),
        E().firebaseGet(CFG.NODE_BANDES),
        E().firebaseGet(CFG.NODE_ENQUETES),
        E().firebaseGet(CFG.NODE_DOSSIERS),
        E().firebaseGet(CFG.NODE_LOSTBAYOU)
      ]);
      PSEUDOS = Object.keys(r[0] || {}).sort(function(a,b){ return String(a).localeCompare(String(b),"fr"); });
      BANDES_INFO = r[1] || {};
      ENQUETES = lireEnquetes(r[2]);
      GELE = calculerGel(r[3]);
      CREANCES = lireCreances(r[4]);
    } catch(e){ PSEUDOS = []; BANDES_INFO = {}; ENQUETES = []; GELE = 0; CREANCES = []; }
  }
  async function refresh(){
    etatMembre = await membre.lire();
    DUS = dusDe(etatMembre);
    render();
  }

  /* réparente le conteneur vers <body> (contextes d'empilement FA) + fige le fond */
  function monter(mount){
    if (mount.parentNode !== document.body) document.body.appendChild(mount);
    document.documentElement.style.overflow = "hidden";
    root = mount; root.classList.add("qb");
  }

  function boot(){
    if (!surLeSujet()) return;
    quandPret(async function(mount){
      if (mounted) return;
      monter(mount); mounted = true;
      st.tab = registre[0].key;
      etatMembre = await membre.lire();
      DUS = dusDe(etatMembre);
      await chargerAnnexes();
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
    versTableau: versTableau, money: money, pseudo: pseudo,
    gele: function(){ return GELE; },
    dispo: dispo
  };

  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
