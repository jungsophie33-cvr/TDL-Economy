/*
 * tdlhc-core.js — Socle du journal « The Houma Courier » · TDL · lot 1
 *
 * CE QUE CE FICHIER FAIT :
 *   - monte l'interface depuis le premier message du sujet t102 (#tdlhc-app) ;
 *   - lit les pages du sujet, parse les enveloppes .tdlhc-data (contrat d'en-tête),
 *     garde le résultat en sessionStorage, page par page ;
 *   - rend la coquille (mastic, colonne des rubriques) et délègue chaque rubrique
 *     aux VUES enregistrées (tdlhc-rendu, tdlhc-rendu-listes) ;
 *   - gère la navigation, les onglets filtrants, le retour mobile, les liens
 *     externes et les ancres #hc=… des notifications.
 * CE QU'IL NE FAIT PAS : aucune écriture Firebase (lots 2 et 3).
 *
 * DÉPEND DE : window.EcoCore (safeReadBin, getPseudo).
 * EXPOSE : window.Courier (vue, ancre, api, boot).
 * À CHARGER : après eco-core, AVANT tdlhc-rendu et tdlhc-rendu-listes.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var CFG = {
    MONTAGE:        "#tdlhc-app",           /* [MAJ] conteneur du premier message */
    SEL_MSG:        ".sj-post-msg > div",   /* [MAJ] corps d'un message FA */
    SEL_MSG_RACINE: ".sj-post-msg",         /* [MAJ] un message, pour isoler son ancre */
    SUJET_ID:       102,
    SUJET_SLUG:     "the-houma-courier",
    PAR_PAGE:       25,
    FORUM_HOME:     "https://thedrownedlands.forumactif.com/",
    NODE_JOURNAL:   "journal",
    NODE_ENQUETES:  "enquetes",
    AVIS_BASE:      { "2026": 380 },        /* numéro du premier avis de l'année = base + 1 */
    UNE_ARTICLES:   4,                      /* un dominant + trois secondaires */
    UNE_AVIS:       6,
    RAIL_MAX:       20,
    CACHE:          "tdlhc:",
    RETRY_MS:       250,
    RETRY_MAX:      60
  };
  var TYPES    = { "article":1, "lettre":1, "avis-legal":1, "etat-civil":1 };
  var CLES_URL = { IMAGE:1, RP:1 };
  var VUE_DU_TYPE = { "article":"articles", "lettre":"courrier", "etat-civil":"civil", "avis-legal":"legaux" };
  var MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

  var TXT = {
    FOLIO_G:    "Terrebonne Parish",
    FOLIO_D:    "Louisiana",
    TITRE:      "The Houma Courier",
    DEVISE:     "Fondé en 1878 · Le Courrier de Houma",
    ACCUEIL:    "Accueil",
    CHARGEMENT: "Le Courier sort des presses…",
    ERR_PAGE:   "Une page du journal n'a pas pu être lue. Réessaie dans un instant.",
    ERR_VUE:    "Cette rubrique n'a pas pu s'afficher.",
    ERR_ECO:    "EcoCore introuvable — vérifie l'ordre de chargement (eco-core avant tdlhc-core).",
    ERR_VUES:   "Aucune rubrique chargée — tdlhc-rendu.js est-il bien inclus après tdlhc-core.js ?",
    HIER:       "hier",
    IL_Y_A:     function (n, u) { return "il y a " + n + " " + u; }
  };

  /* ===================== UTILS ===================== */
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function desc(s){ return String(s==null?"":s).replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g," ").replace(/&amp;/g,"&"); }
  function versTableau(v){ return Array.isArray(v)?v:(v?Object.keys(v).map(function(k){return v[k];}):[]); }
  function texteBrut(html){ return desc(String(html||"").replace(/<[^>]*>/g,"")); }
  function E(){ return window.EcoCore; }
  /* Seule la page du sujet monte le journal : « Poster une réponse » affiche aussi le premier
     message dans la revue du sujet, avec son #tdlhc-app. */
  function estPageJournal(){ return new RegExp("^/t" + CFG.SUJET_ID + "(?:p\\d+)?-").test(location.pathname); }
  function pseudo(){ try { return E().getPseudo(); } catch(e){ return null; } }
  function isStaff(){ try { return typeof _userdata!=="undefined" && (_userdata.user_level===1||_userdata.user_level===2); } catch(e){ return false; } }
  function ms(v){ return typeof v==="number" ? v : (Date.parse(v||"") || 0); }
  function numAncre(a){ var m=/(\d+)/.exec(a||""); return m?parseInt(m[1],10):0; }
  function tidDe(url){ var m=/\/t(\d+)(?:p\d+)?-/.exec(url||""); return m?parseInt(m[1],10):0; }
  function boucle(liste, fn){ Array.prototype.forEach.call(liste, fn); }

  /* « 2026-05-28 » ou une date ISO → « 28 mai 2026 » ; sans fuseau, pas de jour décalé */
  function dateLisible(v){
    var s = typeof v==="number" ? new Date(v).toISOString() : String(v||"");
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (!m) return "";
    return parseInt(m[3],10) + " " + MOIS[parseInt(m[2],10)-1] + " " + m[1];
  }
  function dateDuJour(){
    var t = new Date().toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function depuis(v){
    var d = (Date.now() - ms(v)) / 3600000;
    if (d < 1)  return TXT.IL_Y_A(Math.max(1, Math.round(d*60)), "min");
    if (d < 24) return TXT.IL_Y_A(Math.round(d), "h");
    if (d < 48) return TXT.HIER;
    return TXT.IL_Y_A(Math.floor(d/24), "j");
  }

  /* ===================== PARSEUR : enveloppe → contenu ===================== */
  /* Sérialise le DOM d'un message en HTML sûr : texte échappé, <br> → \n, blocs → \n,
     gras / italique / souligné / liens http(s) conservés, smileys FA rendus par leur alt. */
  var INLINE = { B:"b", STRONG:"b", I:"i", EM:"i", U:"u" };
  var BLOC   = /^(DIV|P|LI|BLOCKQUOTE|TR|H[1-6])$/;
  function serialiser(node){
    var out = "";
    boucle(node.childNodes, function(c){
      if (c.nodeType===3) { out += esc(c.nodeValue.replace(/\s*\n\s*/g," ")); return; }
      if (c.nodeType!==1) return;
      var t = c.tagName;
      if (t==="BR") out += "\n";
      else if (t==="IMG") out += esc(c.getAttribute("alt")||"");
      else if (INLINE[t]) out += "<"+INLINE[t]+">" + serialiser(c) + "</"+INLINE[t]+">";
      else if (t==="A") { var h = c.getAttribute("href")||"";
        out += /^https?:\/\//i.test(h) ? '<a href="'+esc(h)+'" data-ext>'+serialiser(c)+'</a>' : serialiser(c); }
      else if (t==="SCRIPT" || t==="STYLE") return;
      else if (BLOC.test(t)) out += "\n" + serialiser(c) + "\n";
      else out += serialiser(c);
    });
    return out;
  }
  /* FA raccourcit l'affichage des URL longues : on prend le href quand il existe */
  function urlDe(ligne){ var m=/href="([^"]+)"/.exec(ligne); return desc(m ? m[1] : texteBrut(ligne)).trim(); }
  var RE_CLE = /^([A-Z_]+)\s*:\s*(.*)$/;

  function parser(env){
    var lignes = serialiser(env).split("\n"), cles = {}, corpsL = null, i;
    for (i=0; i<lignes.length; i++) {
      var brut = texteBrut(lignes[i]).trim(), m = RE_CLE.exec(brut);
      if (!m) continue;
      if (m[1]==="CORPS") { corpsL = [lignes[i].replace(/^[\s\S]*?CORPS\s*:/,"")].concat(lignes.slice(i+1)); break; }
      cles[m[1]] = CLES_URL[m[1]] ? urlDe(lignes[i]) : m[2].trim();
    }
    var type = (cles.TYPE||"").toLowerCase();
    if (!TYPES[type] || !/^\d{4}-\d{2}-\d{2}$/.test(cles.DATE||"") || !cles.TITRE || !corpsL) {
      if (window.console) console.warn("[Courier] enveloppe ignorée (TYPE, DATE, TITRE ou CORPS manquant)", cles);
      return null;
    }
    ["RUBRIQUE","STATUT","CHRONO","NATURE"].forEach(function(k){ if (cles[k]) cles[k] = cles[k].toLowerCase(); });
    if (cles.IMAGE && !/^https?:\/\//i.test(cles.IMAGE)) delete cles.IMAGE;
    return { type:type, cles:cles, corps:parserCorps(corpsL), tid:tidDe(cles.RP) };
  }

  function parserCorps(lignes){
    var blocs = [], para = [], cit = null;
    function fermer(){ if (para.length) { blocs.push({ t:"p", html:para.join(" ") }); para = []; } }
    lignes.forEach(function(l){
      var brut = texteBrut(l).trim();
      if (/^-{3,}\s*CITATION\s*-{3,}$/i.test(brut)) { fermer(); cit = {}; return; }
      if (cit) {
        if (/^-{3,}\s*FIN\s*-{3,}$/i.test(brut)) { blocs.push({ t:"cit", texte:cit.TEXTE||"", auteur:cit.AUTEUR||"", qualite:cit.QUALITE||"" }); cit = null; return; }
        var m = RE_CLE.exec(brut); if (m) cit[m[1]] = m[2].trim();
        return;
      }
      if (!brut) { fermer(); return; }
      para.push(l.trim());
    });
    fermer();
    if (cit && cit.TEXTE) blocs.push({ t:"cit", texte:cit.TEXTE, auteur:cit.AUTEUR||"", qualite:cit.QUALITE||"" });
    return blocs;
  }

  /* L'ancre d'un message : id « p1234 » d'un ancêtre, sinon a[name] ou lien #1234
     dans le plus grand ancêtre qui ne contient que ce message. [MAJ] selon le gabarit. */
  function ancreDe(msg){
    for (var n=msg, i=0; n && n.tagName!=="BODY" && i<12; n=n.parentElement, i++) {
      if (/^p\d+$/.test(n.id||"")) return n.id;
      if (n.querySelectorAll(CFG.SEL_MSG_RACINE).length===1) {
        var a = n.querySelector("a[name]");
        if (a && /^\d+$/.test(a.getAttribute("name"))) return "p" + a.getAttribute("name");
        var l = n.querySelector('a[href*="#"]'), m = l && /#(\d+)$/.exec(l.getAttribute("href")||"");
        if (m) return "p" + m[1];
      }
    }
    return null;
  }

  /* ===================== DONNÉES : pages du sujet ===================== */
  var DATA = { nbPages:1, pages:{}, parAncre:{}, tout:false, fb:null };
  var CLE_CACHE = CFG.CACHE + CFG.SUJET_ID + ":";

  function urlPage(n){ return "/t" + CFG.SUJET_ID + (n>1 ? "p" + ((n-1)*CFG.PAR_PAGE) : "") + "-" + CFG.SUJET_SLUG; }
  function compterPages(doc){
    var re = new RegExp("/t" + CFG.SUJET_ID + "p(\\d+)-"), max = 0;
    boucle(doc.querySelectorAll("a[href]"), function(a){ var m = re.exec(a.getAttribute("href")); if (m) max = Math.max(max, parseInt(m[1],10)); });
    return Math.floor(max / CFG.PAR_PAGE) + 1;
  }
  async function docPage(n){
    if (n===1) return document;
    var r = await fetch(urlPage(n), { credentials:"same-origin" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    var m = /charset=([\w-]+)/i.exec(r.headers.get("content-type")||"");
    var txt = new TextDecoder(m ? m[1] : "utf-8").decode(await r.arrayBuffer());
    return new DOMParser().parseFromString(txt, "text/html");
  }
  function lireDoc(doc, n){
    var out = [];
    boucle(doc.querySelectorAll(CFG.SEL_MSG), function(msg, i){
      var env = msg.querySelector(".tdlhc-data"); if (!env) return;
      var c = parser(env); if (!c) return;
      c.ancre = ancreDe(msg) || ("x" + n + "-" + i);
      c.page = n; out.push(c);
    });
    return out;
  }

  function cacheLire(k){ try { var v = sessionStorage.getItem(CLE_CACHE + k); return v ? JSON.parse(v) : null; } catch(e){ return null; } }
  function cacheEcrire(k, v){ try { sessionStorage.setItem(CLE_CACHE + k, JSON.stringify(v)); } catch(e){} }
  function cacheVider(){ try { Object.keys(sessionStorage).forEach(function(k){ if (k.indexOf(CLE_CACHE)===0) sessionStorage.removeItem(k); }); } catch(e){} }

  function ranger(n, liste){ DATA.pages[n] = liste; liste.forEach(function(c){ DATA.parAncre[c.ancre] = c; }); }
  async function chargerPage(n){
    if (DATA.pages[n]) return DATA.pages[n];
    var l = cacheLire(n);
    if (!l) { l = lireDoc(await docPage(n), n); cacheEcrire(n, l); }
    ranger(n, l); return l;
  }
  /* Page 1 = le document courant. La dernière page est toujours relue : si le nombre
     de pages ou son dernier message a changé, tout le cache de la session est jeté. */
  async function initDonnees(){
    DATA.nbPages = compterPages(document);
    ranger(1, lireDoc(document, 1));
    var der = DATA.nbPages, sig = String(der);
    if (der > 1) {
      var l = lireDoc(await docPage(der), der);
      sig += ":" + (l.length ? l[l.length-1].ancre : "");
      if (cacheLire("sig") !== sig) cacheVider();
      cacheEcrire(der, l); ranger(der, l);
    }
    cacheEcrire("sig", sig);
    DATA.tout = der===1;
  }
  async function chargerJusqua(assez){
    for (var n = DATA.nbPages; n >= 1; n--) { await chargerPage(n); if (assez && assez()) return; }
    DATA.tout = true;
  }
  var enCours = null;
  function chargerTout(){
    if (DATA.tout) return Promise.resolve();
    if (!enCours) enCours = chargerJusqua(null).finally(function(){ enCours = null; });
    return enCours;
  }
  function contenus(type){
    return Object.keys(DATA.parAncre).map(function(k){ return DATA.parAncre[k]; })
      .filter(function(c){ return !type || c.type===type; })
      .sort(function(a,b){ return a.cles.DATE===b.cles.DATE ? numAncre(b.ancre)-numAncre(a.ancre) : (a.cles.DATE<b.cles.DATE ? 1 : -1); });
  }
  /* Numéro d'un avis : base de l'année + rang par date. Exige toutes les pages. */
  function numeroAvis(c){
    if (!DATA.tout || !c) return null;
    var an = c.cles.DATE.slice(0,4);
    var rang = contenus("avis-legal").filter(function(x){ return x.cles.DATE.slice(0,4)===an; }).reverse().indexOf(c);
    return rang < 0 ? null : an + "-" + ("000" + ((CFG.AVIS_BASE[an]||0) + rang + 1)).slice(-4);
  }
  async function fb(){
    if (DATA.fb) return DATA.fb;
    try { DATA.fb = (await E().safeReadBin()) || {}; } catch(e){ DATA.fb = {}; }
    return DATA.fb;
  }
  function journal(root){ return (root && root[CFG.NODE_JOURNAL]) || {}; }

  /* ===================== VUES, COQUILLE, NAVIGATION ===================== */
  var VUES = [], ANCRES = [], mounted = false, root = null;

  function vue(def){
    VUES.push(def); VUES.sort(function(a,b){ return (a.ordre||0)-(b.ordre||0); });
    if (mounted) ajouterVue(def);
  }
  function ajouterVue(def){
    var nav = root.querySelector(".tdlhc-catcol"), corps = root.querySelector(".tdlhc-corps");
    if (corps.querySelector('.tdlhc-vue[data-nom="' + def.nom + '"]')) return;
    var cat = document.createElement("div");
    cat.className = "tdlhc-cat"; cat.setAttribute("data-vue", def.nom); cat.style.setProperty("--c", def.couleur);
    cat.innerHTML = '<i class="fi fi-sr-' + esc(def.icone) + '"></i><span>' + esc(def.label) + '</span>';
    var avant = null;
    for (var i = VUES.indexOf(def)+1; i < VUES.length && !avant; i++) avant = nav.querySelector('[data-vue="' + VUES[i].nom + '"]');
    nav.insertBefore(cat, avant);
    var sec = document.createElement("section");
    sec.className = "tdlhc-vue"; sec.setAttribute("data-nom", def.nom);
    corps.appendChild(sec); def.section = sec;
  }
  function construire(){
    root.innerHTML = '<header class="tdlhc-mastic"><div class="tdlhc-mastic-haut">'
      + '<div class="tdlhc-folio"><a class="tdlhc-accueil" href="' + CFG.FORUM_HOME + '" title="' + esc(TXT.ACCUEIL) + '" aria-label="'
      +   esc(TXT.ACCUEIL) + '"><i class="fi fi-tr-house-flood"></i></a><span class="tdlhc-folio-txt">' + esc(TXT.FOLIO_G) + '</span></div>'
      + '<div class="tdlhc-titre">' + esc(TXT.TITRE) + '</div>'
      + '<div class="tdlhc-folio d"><span class="tdlhc-folio-txt">' + esc(TXT.FOLIO_D) + ' · ' + esc(dateDuJour()) + '</span></div></div>'
      + '<div class="tdlhc-mastic-bas"><div class="tdlhc-mastic-cote"><span class="tdlhc-slot" id="tdlhc-slot-g"></span><div class="tdlhc-filet"></div></div>'
      + '<div class="tdlhc-devise">' + esc(TXT.DEVISE) + '</div>'
      + '<div class="tdlhc-mastic-cote"><div class="tdlhc-filet"></div><span class="tdlhc-slot" id="tdlhc-slot-d"></span></div></div></header>'
      + '<div class="tdlhc-corps"><nav class="tdlhc-catcol"></nav><div class="tdlhc-chargement" id="tdlhc-init">' + esc(TXT.CHARGEMENT) + '</div></div>';
    VUES.forEach(ajouterVue);
  }
  function defDe(nom){ for (var i=0; i<VUES.length; i++) if (VUES[i].nom===nom) return VUES[i]; return null; }
  function montre(nom, opts){
    var def = defDe(nom); if (!def) return;
    boucle(root.querySelectorAll(".tdlhc-catcol .tdlhc-cat"), function(c){ c.classList.toggle("on", c.getAttribute("data-vue")===nom); });
    boucle(root.querySelectorAll(".tdlhc-corps > .tdlhc-vue"), function(s){
      var on = s===def.section; s.classList.toggle("on", on); if (!on) s.classList.remove("mob");
    });
    Promise.resolve().then(function(){ return def.afficher(def.section, API, opts||{}); }).catch(function(e){
      if (window.console) console.error("[Courier] vue " + nom, e);
      def.section.innerHTML = '<div class="tdlhc-plein"><div class="tdlhc-erreur">' + esc(TXT.ERR_VUE) + '</div></div>';
    });
  }
  function anime(el, cls){
    if (!el) return;
    el.classList.remove("tdlhc-anim-d", "tdlhc-anim-g"); void el.offsetWidth; el.classList.add(cls);
  }
  /* Onglets : bordure animée par le CSS, filtre des [data-cat] du conteneur frère, glissement */
  function onglet(o){
    var grp = o.parentNode, rows = grp.parentNode.querySelector(".tdlhc-rows"), f = o.getAttribute("data-f") || "*", n = 0;
    boucle(grp.querySelectorAll(".tdlhc-onglet"), function(x){ x.classList.toggle("on", x===o); });
    if (!rows) return;
    boucle(rows.querySelectorAll("[data-cat]"), function(r){
      var ok = f==="*" || r.getAttribute("data-cat")===f; r.hidden = !ok; if (ok) n++;
    });
    rows.classList.toggle("vide", n===0); rows.scrollTop = 0; anime(rows, "tdlhc-anim-d");
  }

  /* ===================== EVENTS : délégation unique sur la racine ===================== */
  function brancher(){
    root.addEventListener("click", function(e){
      var t = e.target, x;
      if ((x = t.closest("a[data-ext]"))) { e.preventDefault(); e.stopPropagation(); window.open(x.getAttribute("href"), "_blank"); return; }
      if ((x = t.closest(".tdlhc-catcol .tdlhc-cat"))) { montre(x.getAttribute("data-vue")); return; }
      if ((x = t.closest(".tdlhc-onglet"))) { onglet(x); return; }
      if ((x = t.closest(".tdlhc-retour"))) { var v = x.closest(".tdlhc-vue"); if (v) v.classList.remove("mob"); return; }
      if ((x = t.closest("[data-art]"))) { ouvrirContenu(x.getAttribute("data-art")); return; }
      if ((x = t.closest("[data-vue-lien]"))) { montre(x.getAttribute("data-vue-lien")); return; }
      if ((x = t.closest("[data-soumettre]")) && typeof API.soumettre==="function") { API.soumettre(x.getAttribute("data-soumettre")); }
    });
  }
  /* Ouvre un contenu du sujet dans sa rubrique, où qu'il soit dans les pages */
  async function ouvrirContenu(a){
    if (!DATA.parAncre[a]) await chargerTout();
    var c = DATA.parAncre[a];
    montre(c ? VUE_DU_TYPE[c.type] : "une", c ? { ancre:a } : {});
  }
  function marquer(a){
    try { history.replaceState(null, "", location.pathname + location.search + "#hc=art-" + a); } catch(e){}
  }
  function ancre(prefixe, fn){ ANCRES.push({ p:prefixe, fn:fn }); }
  function lireHash(){
    var m = /hc=([\w-]+)/.exec(location.hash||""); if (!m) return false;
    for (var i=0; i<ANCRES.length; i++) if (m[1].indexOf(ANCRES[i].p)===0) { ANCRES[i].fn(m[1].slice(ANCRES[i].p.length)); return true; }
    return false;
  }
  ancre("art-", ouvrirContenu);

  var toastEl = null, toastT = null;
  function toast(msg){
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "tdlhc-toast"; toastEl.setAttribute("role","status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function(){ toastEl.classList.remove("on"); }, 3800);
  }

  /* ===================== INIT ===================== */
  function monter(mount){
    if (mount.parentNode !== document.body) document.body.appendChild(mount);
    document.documentElement.style.overflow = "hidden";   /* iOS Safari : sur <html>, pas <body> */
    root = mount; root.classList.add("tdlhc");
  }
  function quandPret(cb, n){
    n = n||0;
    var mount = document.querySelector(CFG.MONTAGE);
    if (!mount || !estPageJournal()) return;               /* pas la page du journal : on ne fait rien */
    var eco = window.EcoCore && typeof EcoCore.safeReadBin==="function";
    if (eco && VUES.length) { cb(mount); return; }
    if (n > CFG.RETRY_MAX) {
      if (window.console) console.warn("[Courier] démarrage impossible — eco:" + !!eco + " vues:" + VUES.length);
      mount.innerHTML = '<div class="tdlhc-erreur">' + esc(!eco ? TXT.ERR_ECO : TXT.ERR_VUES) + '</div>';
      return;
    }
    setTimeout(function(){ quandPret(cb, n+1); }, CFG.RETRY_MS);
  }
  function boot(){
    quandPret(async function(mount){
      if (mounted) return;
      monter(mount); construire(); brancher(); mounted = true;
      try { await initDonnees(); }
      catch(e){ if (window.console) console.warn("[Courier] lecture du sujet", e); toast(TXT.ERR_PAGE); }
      var init = root.querySelector("#tdlhc-init"); if (init) init.remove();
      if (!lireHash()) montre(VUES[0].nom);
      window.addEventListener("hashchange", lireHash);
    });
  }

  /* ===================== EXPORT ===================== */
  var API = {
    CFG:CFG, esc:esc, desc:desc, texteBrut:texteBrut, versTableau:versTableau, ms:ms,
    dateLisible:dateLisible, depuis:depuis, anime:anime, montre:montre, toast:toast, marquer:marquer,
    contenus:contenus, chargerJusqua:chargerJusqua, chargerTout:chargerTout,
    toutCharge:function(){ return DATA.tout; },
    parAncre:function(a){ return DATA.parAncre[a] || null; },
    numeroAvis:numeroAvis, fb:fb, journal:journal,
    fbInvalider:function(){ DATA.fb = null; },
    pseudo:pseudo, isStaff:isStaff, estPageJournal:estPageJournal,
    slot:function(cote){ return root && root.querySelector("#tdlhc-slot-" + cote); },
    racine:function(){ return root; },
    soumettre:null                                         /* posé par le volet (lot 2) */
  };
  window.Courier = { vue:vue, ancre:ancre, api:API, boot:boot };

  if (document.readyState==="complete") boot(); else window.addEventListener("load", boot);
})();
