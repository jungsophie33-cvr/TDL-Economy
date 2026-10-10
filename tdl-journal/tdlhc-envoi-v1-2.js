/*
 * tdlhc-envoi.js — Contrôles et écriture des soumissions · The Houma Courier · TDL · lot 2
 *
 * CE QUE CE FICHIER FAIT :
 *   - prépare le contexte d'un formulaire (pigiste ?, articles, affaires, enquêtes classées) ;
 *   - affiche le quota restant et prévient d'un solde insuffisant dès l'ouverture ;
 *   - valide les champs, puis contrôle : connexion, quota, solde moins la somme gelée par
 *     la Main, sujet RP déjà couvert, statut de pigiste, pseudos des joueurs cités ;
 *   - retient l'argent (annonce, pré-lien) par transaction, puis écrit en une seule mise à
 *     jour soum_meta, soum_corps et la ligne de caisse ; rembourse si l'écriture échoue ;
 *   - gère la reprise d'une soumission renvoyée en retouche.
 * CE QU'IL NE FAIT PAS : aucune publication, aucun versement (lot 3).
 *
 * DÉPEND DE : window.Courier, window.Courier.volet, window.EcoCore
 *   (safeReadBin, invalidateCache, firebaseUpdate, firebaseTransaction, getPseudo, getUserId).
 * À CHARGER : après tdlhc-volet.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var CFG = {
    NODE_MEMBRES:  "membres",           /* [MAJ] membres/<pseudo>/dollars */
    NODE_DOSSIERS: "dossiers_main",     /* [MAJ] recouvrements de la Main : somme gelée */
    NODE_EMPLOIS:  "emplois",           /* [MAJ] emplois/<lieu>/roles */
    LIEU_COURIER:  "lieu_muckgpoh",     /* [MAJ] The Houma Courier dans le bottin des métiers */
    PRIX:          { annonce:30, prelien:50 },
    REMUNERATION:  { correspondant:50, pigiste:80, commande:0, "commande-une":0 },
    PLANCHER:      { correspondant:2500, pigiste:4000, commande:2000, "commande-une":3000 },
    QUOTAS:        { annonce:{ n:2, p:"mois" }, rumeur:{ n:1, p:"semaine" }, lettre:{ n:1, p:"mois" }, correspondant:{ n:2, p:"mois" } },
    TYPE_FB:       { annonce:"annonce", civil:"etat-civil", rumeur:"rumeur", lettre:"lettre", prelien:"prelien", article:"article" },
    NOTIFS:        true,                /* codes 190 à 200 inscrits dans sos-emi-notif */
    N_SOUMISSION:  190, N_REPRISE:191, N_ACCORD:196
  };
  var GEL_STATUTS = { ouvert:1, saisi:1, en_validation:1 };

  var TXT = {
    NON_CONNECTE:"Connecte-toi pour soumettre au Courier.",
    ERR_LECTURE:"Impossible de lire la base pour l'instant. Réessaie dans un instant.",
    ERR_ECRITURE:"L'envoi a échoué — rien n'a été retenu sur ton solde.",
    REQUIS:function(c){ return "Champ obligatoire : " + c + "."; },
    URL:function(c){ return c + " : un lien vers un sujet du forum est attendu."; },
    IMAGE:"Image : un lien commençant par https:// est attendu.",
    DATE:"Date : format attendu jour/mois/année.",
    CIT:function(i){ return "Citation " + i + " : le propos et la personne qui parle sont obligatoires."; },
    QUOTA:function(n, p){ return "Quota atteint : " + n + " par " + p + ". Réessaie " + (p==="semaine" ? "lundi" : "le mois prochain") + "."; },
    QUOTA_RESTE:function(r, n, p){ return r > 0 ? "Il vous en reste " + r + " sur " + n + " " + (p==="semaine" ? "cette semaine" : "ce mois-ci") + "."
                                                : "Quota atteint pour " + (p==="semaine" ? "cette semaine" : "ce mois-ci") + "."; },
    FONDS:function(prix, dispo){ return "Solde insuffisant : cette parution coûte " + prix + " $ et vous disposez de " + dispo + " $."; },
    FONDS_GELE:function(g){ return " Dont " + g + " $ retenus par la Main."; },
    RP_PRIS:"Ce sujet RP a déjà un article, publié ou en relecture. Un seul article par événement.",
    PIGE_NON:"Le statut de pigiste est réservé aux personnages journalistes au Houma Courier.",
    INCONNUS:function(l){ return "Pseudos introuvables : " + l.join(", ") + ". Vérifie l'orthographe exacte."; },
    SOI:"Inutile de vous citer vous-même.",
    PLANCHER:function(n, min){ return "Votre texte fait " + n + " signes, sous le minimum de " + min + ". Il pourra paraître, mais ne sera pas rémunéré. Envoyer quand même ?"; },
    REPRISE_CLOSE:"Cette soumission ne peut plus être reprise.",
    OK:"Envoyé à la rédaction. Suivez-le dans Mes soumissions.",
    OK_RETENU:function(p){ return "Envoyé à la rédaction. " + p + " $ sont retenus jusqu'à sa décision."; },
    OK_REPRISE:"Renvoyé à la rédaction.",
    LIBELLE:function(t, titre){ return t + " · " + titre; },
    CHAMPS:{ titre:"titre", texte:"texte", signature:"signature", famille:"nom de la famille", personnes:"personnes concernées",
             date:"date", url:"lien du pré-lien", rp:"lien du sujet RP" }
  };

  /* ===================== UTILS ===================== */
  var A = null, V = null;
  function E(){ return window.EcoCore; }
  function vt(v){ return A.versTableau(v); }
  function J(root){ return A.journal(root); }
  async function lireFrais(){
    try { if (E().invalidateCache) E().invalidateCache(); return (await E().safeReadBin()) || {}; } catch(e){ return null; }
  }
  function nouvelId(){ return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function mois(d){ var x = new Date(d); return x.getFullYear() + "-" + ("0" + (x.getMonth()+1)).slice(-2); }
  /* semaine ISO, lundi → dimanche : « 2026-W40 » */
  function semaine(d){
    var x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
    var j1 = new Date(x.getFullYear(), 0, 4);
    return x.getFullYear() + "-W" + ("0" + (1 + Math.round(((x - j1) / 86400000 - 3 + ((j1.getDay() + 6) % 7)) / 7))).slice(-2);
  }
  function tid(url){ var m = /\/t(\d+)(?:p\d+)?-/.exec(url||""); return m ? parseInt(m[1],10) : 0; }
  function listePseudos(s){
    var vus = {};
    return String(s||"").split(",").map(function(x){ return x.trim(); }).filter(function(x){ var k = x.toLowerCase(); if (!x || vus[k]) return false; vus[k] = 1; return true; });
  }
  function membreCanon(root, nom){
    var m = (root && root[CFG.NODE_MEMBRES]) || {}, bas = nom.toLowerCase();
    for (var k in m) if (m.hasOwnProperty(k) && k.toLowerCase()===bas) return k;
    return null;
  }
  /* Firebase refuse toute écriture qui contient undefined : on les retire partout */
  function sansUndefined(o){
    if (Array.isArray(o)) return o.filter(function(x){ return x!==undefined; }).map(sansUndefined);
    if (o && typeof o==="object") {
      var r = {}; Object.keys(o).forEach(function(k){ if (o[k]!==undefined) r[k] = sansUndefined(o[k]); }); return r;
    }
    return o;
  }
  function quotaCle(type, v){ return type==="article" ? (v.statut==="pigiste" ? null : "correspondant") : (CFG.QUOTAS[type] ? type : null); }

  /* ===================== CONTRÔLES MÉTIER ===================== */
  function gel(root, p){
    var n = (root && root[CFG.NODE_DOSSIERS]) || {}, t = 0;
    Object.keys(n).forEach(function(id){
      var d = n[id] || {};
      if (d.type==="recouvrement" && d.montant && GEL_STATUTS[d.statut] && d.dette && d.dette.pseudo===p) t += (d.montant|0);
    });
    return t;
  }
  function solde(root, p){ var m = root && root[CFG.NODE_MEMBRES] && root[CFG.NODE_MEMBRES][p]; return (m && m.dollars) || 0; }
  /* Un pigiste : un rôle « pj » du Houma Courier au nom du membre, réservation en attente exclue */
  function estPigiste(root, p){
    var e = root && root[CFG.NODE_EMPLOIS] && root[CFG.NODE_EMPLOIS][CFG.LIEU_COURIER];
    return !!e && vt(e.roles).some(function(r){ return r && r.type==="pj" && r.nom===p && !r.attente; });
  }
  /* Quota : soumissions non refusées de la période + publications archivées de la période */
  function compter(root, p, cle, ignorer){
    var q = CFG.QUOTAS[cle], now = Date.now(), per = q.p==="mois" ? mois(now) : semaine(now), j = J(root), n = 0;
    var vise = function(type, st){ return cle==="correspondant" ? (type==="article" && st==="correspondant") : type===CFG.TYPE_FB[cle]; };
    Object.keys(j.soum_meta || {}).forEach(function(id){
      var m = j.soum_meta[id];
      if (!m || id===ignorer || m.auteur!==p || m.statut==="refusee" || m.statut==="publiee" || !vise(m.type, m.sous_type)) return;
      if ((q.p==="mois" ? mois(m.cree) : semaine(m.cree))===per) n++;
    });
    Object.keys(j.archive || {}).forEach(function(id){
      var a = j.archive[id];
      if (a && a.auteur===p && vise(a.type, a.sous_type) && (q.p==="mois" ? a.mois : a.semaine)===per) n++;
    });
    return { n:n, max:q.n, p:q.p };
  }
  function rpPris(root, t, ignorer){
    var j = J(root);
    var enCours = Object.keys(j.soum_meta || {}).some(function(id){
      var m = j.soum_meta[id]; return m && id!==ignorer && m.type==="article" && m.tid===t && m.statut!=="refusee";
    });
    return enCours || Object.keys(j.archive || {}).some(function(id){ var a = j.archive[id]; return a && a.type==="article" && a.tid===t; });
  }

  /* ===================== VALIDATION DES CHAMPS ===================== */
  var REQUIS = { annonce:["titre","texte","signature"], civil:["famille","personnes","texte","date"], rumeur:["texte"],
                 lettre:["titre","texte","signature"], prelien:["titre","url","texte","signature"], article:["titre","rp","texte","date"] };
  function valider(type, v){
    var err = [];
    (REQUIS[type] || []).forEach(function(k){ if (!v[k]) err.push(TXT.REQUIS(TXT.CHAMPS[k] || k)); });
    if (v.date && !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) err.push(TXT.DATE);
    if (type==="prelien" && v.url && !tid(v.url)) err.push(TXT.URL("Lien du pré-lien"));
    if ((type==="article" || (type==="civil" && v.rp_ouvert) || type==="rumeur") && v.rp && !tid(v.rp)) err.push(TXT.URL("Lien du sujet RP"));
    if (type==="civil" && v.rp_ouvert && !v.rp) err.push(TXT.REQUIS(TXT.CHAMPS.rp));
    if (type==="article" && v.image && !/^https?:\/\//i.test(v.image)) err.push(TXT.IMAGE);
    if (type==="article" && v.statut==="pigiste") v.citations.forEach(function(c, i){ if (!c.texte || !c.auteur) err.push(TXT.CIT(i+1)); });
    return err;
  }

  /* ===================== ÉCRITURE ===================== */
  function construire(type, v, p, id, root){
    var now = new Date().toISOString(), cites = {}, ancien = v.reprise && J(root).soum_meta && J(root).soum_meta[id];
    listePseudos(v.cites).forEach(function(c){
      var k = membreCanon(root, c); if (!k) return;
      cites[k] = (ancien && ancien.cites && ancien.cites[k]) || { choix:"attente" };
    });
    var st = type==="article" ? v.statut : (v.rubrique || v.nature || v.secteur || "");
    var montant = CFG.PRIX[type] ? -CFG.PRIX[type] : (type==="article" ? CFG.REMUNERATION[v.statut] : 0);
    var meta = { type:CFG.TYPE_FB[type], sous_type:st, statut:"relecture", auteur:p,
                 titre:v.titre || String(v.texte||"").slice(0, 60), maj:now, montant:montant,
                 tid:tid(v.rp) || null, cites:Object.keys(cites).length ? cites : null };
    if (!ancien) {
      meta.cree = now; meta.retouches = 0;
      try { var uid = E().getUserId(); if (uid!=null && uid!=="") meta.uid = uid; } catch(e){}
    }
    if (type==="article") meta.remunere = String(v.texte).length >= CFG.PLANCHER[v.statut];
    var corps = {}; Object.keys(v).forEach(function(k){ if (k!=="reprise" && k.charAt(0)!=="_") corps[k] = v[k]; });
    if (type!=="article" || v.statut!=="pigiste") delete corps.citations;
    return { meta:meta, corps:corps, montant:montant, citesNeufs:Object.keys(cites).filter(function(k){ return cites[k].choix==="attente"; }) };
  }
  async function debiter(p, prix, g){
    await E().firebaseTransaction(CFG.NODE_MEMBRES + "/" + encodeURIComponent(p) + "/dollars", function(cur){
      var s = cur || 0; if (s - g < prix) throw new Error("FONDS"); return s - prix;
    });
  }
  async function recrediter(p, prix){
    await E().firebaseTransaction(CFG.NODE_MEMBRES + "/" + encodeURIComponent(p) + "/dollars", function(cur){ return (cur||0) + prix; }).catch(function(){});
  }
  /* dest : pseudo(s), « staff » (ou null), « tous » ; ref : clé anti-doublon de l'émetteur */
  function notifier(code, dest, vars, ref){
    if (!CFG.NOTIFS || !window.EcoNotif) return;
    try {
      if (dest==="tous") EcoNotif.tous(code, vars, ref);
      else if (!dest || dest==="staff") EcoNotif.staff(code, vars, ref);
      else EcoNotif.a(dest, code, vars, ref);
    } catch(e){}
  }
  /* lien direct vers un objet du journal, ouvert par Notiffi */
  function lien(h){ return "/t" + A.CFG.SUJET_ID + "-" + A.CFG.SUJET_SLUG + "#hc=" + h; }

  /* ===================== HOOKS DU VOLET ===================== */
  async function envoyer(type, v){
    var p = A.pseudo(); if (!p) return { erreurs:[TXT.NON_CONNECTE] };
    var err = valider(type, v); if (err.length) return { erreurs:err };
    var root = await lireFrais(); if (!root) return { erreurs:[TXT.ERR_LECTURE] };
    var reprise = v.reprise || null, id = reprise || nouvelId(), J0 = J(root);
    if (reprise) { var m0 = J0.soum_meta && J0.soum_meta[reprise]; if (!m0 || m0.auteur!==p || m0.statut!=="retouche") return { erreurs:[TXT.REPRISE_CLOSE] }; }

    var qc = quotaCle(type, v);
    if (qc && !reprise) { var q = compter(root, p, qc); if (q.n >= q.max) return { erreurs:[TXT.QUOTA(q.max, q.p)] }; }
    if (type==="article" && v.statut==="pigiste" && !estPigiste(root, p)) return { erreurs:[TXT.PIGE_NON] };
    if (type==="article" && rpPris(root, tid(v.rp), reprise)) return { erreurs:[TXT.RP_PRIS] };
    var cites = listePseudos(v.cites);
    if (cites.some(function(c){ return c.toLowerCase()===p.toLowerCase(); })) return { erreurs:[TXT.SOI] };
    var inconnus = cites.filter(function(c){ return !membreCanon(root, c); });
    if (inconnus.length) return { erreurs:[TXT.INCONNUS(inconnus)] };
    if (type==="article" && String(v.texte).length < CFG.PLANCHER[v.statut]
        && !window.confirm(TXT.PLANCHER(String(v.texte).length, CFG.PLANCHER[v.statut]))) return { erreurs:null };

    var b = construire(type, v, p, id, root), prix = reprise ? 0 : (CFG.PRIX[type] || 0), g = gel(root, p);
    if (prix && solde(root, p) - g < prix) return { erreurs:[TXT.FONDS(prix, Math.max(0, solde(root, p) - g)) + (g ? TXT.FONDS_GELE(g) : "")] };
    if (prix) {
      try { await debiter(p, prix, g); }
      catch(e){ return { erreurs:[e && e.message==="FONDS" ? TXT.FONDS(prix, Math.max(0, solde(root, p) - g)) : TXT.ERR_ECRITURE] }; }
    }
    var base = A.CFG.NODE_JOURNAL + "/", maj = {};
    if (reprise) {
      Object.keys(b.meta).forEach(function(k){ if (b.meta[k]!==undefined) maj[base + "soum_meta/" + id + "/" + k] = b.meta[k]; });
    } else maj[base + "soum_meta/" + id] = b.meta;
    maj[base + "soum_corps/" + id] = b.corps;
    if (prix) maj[base + "caisse/" + id + "-depot"] = { date:b.meta.maj, pseudo:p, libelle:TXT.LIBELLE(V.TYPES[type].t, b.meta.titre),
                                                         montant:-prix, etat:"retenu", soum:id };
    Object.keys(maj).forEach(function(k){ if (maj[k]===undefined) delete maj[k]; else maj[k] = sansUndefined(maj[k]); });
    try { await E().firebaseUpdate(maj); }
    catch(e){ if (prix) await recrediter(p, prix); if (window.console) console.error("[Courier] envoi", e); return { erreurs:[TXT.ERR_ECRITURE] }; }

    A.fbInvalider();
    notifier(reprise ? CFG.N_REPRISE : CFG.N_SOUMISSION, "staff", { pseudo:p, titre:b.meta.titre, url:lien("bureau-" + id) },
             "hc-soum-" + id + "-" + (reprise ? Date.now() : 0));
    b.citesNeufs.forEach(function(c){ notifier(CFG.N_ACCORD, c, { titre:b.meta.titre, url:lien("accord-" + id) }, "hc-accord-" + id + "-" + c); });
    return { ok:true, message: reprise ? TXT.OK_REPRISE : (prix ? TXT.OK_RETENU(prix) : TXT.OK) };
  }

  async function contexte(type){
    var root = await A.fb(), p = A.pseudo(), j = J(root), ctx = { pseudo:p || "", articles:[], affaires:[], enquetes:[], pigiste:false };
    if (type==="lettre") { await A.chargerTout(); ctx.articles = A.contenus("article"); }
    if (type==="article") {
      ctx.pigiste = !!p && estPigiste(root, p);
      ctx.affaires = Object.keys(j.affaires || {}).filter(function(s){ return j.affaires[s] && j.affaires[s].statut!=="close"; })
        .map(function(s){ return { slug:s, nom:j.affaires[s].nom || s }; });
      var en = (root && root[A.CFG.NODE_ENQUETES]) || {};
      ctx.enquetes = Object.keys(en).filter(function(id){ return en[id] && en[id].cloturee; })
        .map(function(id){ return { id:id, titre:en[id].titre || id }; })
        .sort(function(a,b){ return String(a.titre).localeCompare(String(b.titre), "fr"); });
    }
    return ctx;
  }
  /* À l'ouverture d'un formulaire : quota restant, solde insuffisant signalé d'avance */
  async function preparer(type, corps, v){
    var p = A.pseudo(); if (!p) { V.alerte(TXT.NON_CONNECTE); return; }
    var root = await A.fb(), ligne = corps.querySelector("[data-quota]"), qc = quotaCle(type, v.statut ? v : { statut:"correspondant" });
    if (ligne && qc && !v.reprise) {
      var q = compter(root, p, qc);
      ligne.innerHTML = '<i class="fi fi-tr-calendar-clock"></i> ' + A.esc(TXT.QUOTA_RESTE(q.max - q.n, q.max, q.p));
      ligne.hidden = false;
    }
    var prix = CFG.PRIX[type] || 0, g = gel(root, p), dispo = solde(root, p) - g;
    if (prix && !v.reprise && dispo < prix) V.alerte(TXT.FONDS(prix, Math.max(0, dispo)) + (g ? TXT.FONDS_GELE(g) : ""));
  }

  /* ===================== INIT ===================== */
  function demarrer(){
    var C = window.Courier; A = C.api; V = C.volet;
    V.hooks.envoyer = envoyer; V.hooks.contexte = contexte; V.hooks.preparer = preparer;
    C.envoi = { CFG:CFG, gel:gel, solde:solde, estPigiste:estPigiste, compter:compter, notifier:notifier, lien:lien, lireFrais:lireFrais };
  }
  (function attendre(n){
    if (window.Courier && window.Courier.volet) { demarrer(); return; }
    if ((n||0) < 60) setTimeout(function(){ attendre((n||0)+1); }, 250);
  })();
})();
