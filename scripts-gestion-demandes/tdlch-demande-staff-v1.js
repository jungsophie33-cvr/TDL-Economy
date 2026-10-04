/*
 * tdlch-demande-staff.js — Panneau des demandes de chronologie (côté staff) · TDL
 *
 * CE QUE CE FICHIER FAIT : liste les demandes en attente, les affiche en cartes,
 * ouvre une modale de validation où la rédaction place l'événement dans la frise
 * (période, catégorie, retouches du texte), écrit dans le nœud « chrono » que
 * l'annexe Chronologie lit déjà, puis classe la demande.
 * CE QU'IL NE FAIT PAS : le formulaire membre (tdlch-demande.js).
 *
 * CARTE DES BLOCS :
 *   CONFIG     — nœuds Firebase et textes
 *   RENDER     — en-tête, panneau, carte de demande
 *   LISTE      — chargement et compteur
 *   MODALE     — validation avec placement dans la frise
 *   TRAITEMENT — écriture dans chrono, classement de la demande, refus
 *   INIT       — monté sur #chrono-staff, réservé au staff
 *
 * Réutilise le balisage du panneau multicompte : .mc-head, .sj-fiche,
 * .mc-sec-head, .mc-cpt, .mc-sub, .mc-dem, .mc-btn, .dc-overlay.
 * Aucune règle CSS nouvelle.
 *
 * Dépend de : tdlch-demande.js (window.TDLCHD), window.EcoCore.
 * À CHARGER : après tdlch-demande.js.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var CFG = {
    MONTAGE:       "#chrono-staff",
    NODE_DEMANDES: "chrono_demandes",
    NODE_AJOUTS:   "chrono",               /* lu par l'annexe Chronologie */
    NODE_CONFIG:   "chrono_config",
    APERCU:        3,
    RETRY_MS: 250, RETRY_MAX: 60
  };

  var T = {
    PANEL:      "Chronologie de la paroisse",
    PANEL_SOUS: "Demandes d'ajout déposées par les membres",
    SECTION:    "En attente", SECTION_SOUS: "Chaque demande validée entre aussitôt dans la frise.",
    CHARGEMENT: "Chargement…", AUCUNE: "Aucune demande en attente.",
    ERR_DONNEES:"Lecture impossible. Réessayez dans un instant.",
    VOIR_PLUS:  function(n){ return "Voir les " + n + " autres"; }, REDUIRE: "Réduire",
    MOTIF:      "Motif de la demande", PROPOSE: "Proposé pour",
    VALIDER:    "Valider", REFUSER: "Refuser",
    M_TITRE:    function(p){ return "Valider la demande de " + p; },
    M_INTRO:    "Placez l'événement dans la frise et retouchez le texte si nécessaire. "
              + "C'est cette version qui paraîtra.",
    M_PERIODE:  "Période *", M_CAT: "Catégorie *", M_D: "Date affichée", M_ISO: "Date de tri *",
    M_T:        "Titre *", M_X: "Texte *", M_A: "Aparté", M_IMG: "Image",
    M_OK:       "Inscrire dans la chronologie", M_ANNULE: "Annuler", M_ENVOI: "Enregistrement…",
    PROMPT_REFUS: "Motif du refus, transmis au membre :",
    ERR_CHAMPS: "Période, catégorie, date de tri, titre et texte sont obligatoires.",
    ERR_CONF:   "La structure de la frise n'a pas encore été publiée. Ouvrez l'annexe Chronologie une fois, en staff.",
    ERR_ECRIT:  "L'enregistrement a échoué. Rien n'a été modifié.",
    OK_VALID:   "Inscrit dans la chronologie.", OK_REFUS: "Demande refusée."
  };

  /* ===================== UTILS ===================== */
  var D = null, esc = null, vt = null, resultat = null;
  function E(){ return window.EcoCore; }
  function staff(){
    try { return typeof _userdata !== "undefined" && (_userdata.user_level === 1 || _userdata.user_level === 2); }
    catch(e){ return false; }
  }
  function initiales(n){
    return String(n).split(/\s+/).filter(Boolean).map(function(w){ return w[0]; }).slice(0, 2).join("").toUpperCase();
  }
  function opts(liste, v, lib){
    return vt(liste).map(function(x){
      return '<option value="' + esc(x.id) + '"' + (x.id === v ? " selected" : "") + '>' + esc(lib(x)) + '</option>';
    }).join("");
  }
  var CONF = {}, TOUT = false;

  /* ===================== RENDER ===================== */
  function creerEntete(){
    var d = document.createElement("div");
    d.className = "mc-head";
    d.innerHTML = "<h1>" + esc(T.PANEL) + "</h1><p>" + esc(T.PANEL_SOUS) + "</p>";
    return d;
  }
  function creerPanel(){
    var p = document.createElement("section");
    p.id = "tdlch-staff-panel";
    p.className = "sj-fiche";
    p.innerHTML = '<div class="mc-sec-head"><h2>' + esc(T.SECTION) + '</h2>'
      + '<span class="mc-cpt" id="tdlch-staff-nb">0</span></div>'
      + '<p class="mc-sub">' + esc(T.SECTION_SOUS) + '</p>'
      + '<div id="tdlch-staff-liste">' + esc(T.CHARGEMENT) + '</div>'
      + '<button class="mc-plus" id="tdlch-staff-plus" style="display:none"></button>';
    p.querySelector("#tdlch-staff-plus").addEventListener("click", function(){
      TOUT = !TOUT; charger(p.querySelector("#tdlch-staff-liste"));
    });
    return p;
  }
  function creerCarte(d){
    var c = document.createElement("article");
    c.className = "mc-dem";
    var place = [];
    if (d.p && CONF.periodes) { vt(CONF.periodes).forEach(function(x){ if (x.id === d.p) place.push(x.t); }); }
    if (d.c && CONF.cats) { vt(CONF.cats).forEach(function(x){ if (x.id === d.c) place.push(x.l); }); }
    c.innerHTML = '<div class="mc-id"><span class="mc-av">' + esc(initiales(d.pseudo)) + '</span>'
      + '<div class="mc-id-txt"><div class="mc-id-nom">' + esc(d.pseudo) + '</div>'
      + '<div class="mc-id-l"><i class="fi fi-tr-calendar-clock"></i>' + esc(d.d || d.iso) + '</div>'
      + '<div class="mc-id-l' + (place.length ? "" : " mc-attenue") + '">'
      + '<i class="fi fi-tr-bookmark"></i>' + esc(place.length ? place.join(" · ") : T.PROPOSE + " : à placer")
      + '</div></div></div>'
      + '<p class="mc-res"><b>' + esc(d.t) + '</b> — ' + esc(d.x) + '</p>'
      + '<p class="mc-sub"><b>' + esc(T.MOTIF) + "</b> : " + esc(d.motif || "—") + '</p>'
      + '<div class="mc-dem-act">'
      + '<button class="mc-btn ok lg" data-act="valider" data-id="' + esc(d.id) + '">'
      + '<i class="fi fi-tr-check"></i> ' + esc(T.VALIDER) + '</button>'
      + '<button class="mc-btn no lg" data-act="refuser" data-id="' + esc(d.id) + '">'
      + '<i class="fi fi-tr-cross-small"></i> ' + esc(T.REFUSER) + '</button></div>'
      + '<div class="dc-resultat"></div>';
    return c;
  }

  /* ===================== LISTE ===================== */
  var ENCOURS = {};
  async function charger(listeEl){
    var root;
    try { if (E().invalidateCache) E().invalidateCache(); root = await E().safeReadBin(); }
    catch(e){ root = null; }
    if (!root) { listeEl.textContent = T.ERR_DONNEES; return; }
    CONF = root[CFG.NODE_CONFIG] || {};

    var n = root[CFG.NODE_DEMANDES] || {}, dem = [];
    Object.keys(n).forEach(function(id){
      if (n[id] && n[id].statut === "en_attente") { var d = n[id]; d.id = id; dem.push(d); }
    });
    dem.sort(function(a, b){ return String(a.cree) < String(b.cree) ? -1 : 1; });
    ENCOURS = {}; dem.forEach(function(d){ ENCOURS[d.id] = d; });

    var cpt = document.getElementById("tdlch-staff-nb");
    if (cpt) cpt.textContent = dem.length;
    if (!dem.length) { listeEl.innerHTML = '<p class="mc-vide">' + esc(T.AUCUNE) + '</p>'; majPlus(0); return; }

    var vues = TOUT ? dem : dem.slice(0, CFG.APERCU);
    listeEl.innerHTML = "";
    vues.forEach(function(d){ listeEl.appendChild(creerCarte(d)); });
    brancher(listeEl);
    majPlus(dem.length - CFG.APERCU);
  }
  function majPlus(reste){
    var b = document.getElementById("tdlch-staff-plus");
    if (!b) return;
    b.style.display = reste > 0 ? "flex" : "none";
    b.innerHTML = TOUT ? '<span>' + esc(T.REDUIRE) + '</span><i class="fi fi-tr-angle-small-up"></i>'
                       : '<span>' + esc(T.VOIR_PLUS(reste)) + '</span><i class="fi fi-tr-angle-small-down"></i>';
  }
  function brancher(listeEl){
    listeEl.querySelectorAll("[data-act]").forEach(function(b){
      b.addEventListener("click", function(){
        var d = ENCOURS[b.getAttribute("data-id")];
        if (!d) return;
        if (b.getAttribute("data-act") === "valider") ouvrirModal(d, listeEl);
        else refuser(d, listeEl, b.closest(".mc-dem"));
      });
    });
  }

  /* ===================== MODALE DE VALIDATION ===================== */
  function ouvrirModal(d, listeEl){
    var vieux = document.getElementById("tdlch-modal-valid");
    if (vieux) vieux.remove();
    if (!vt(CONF.periodes).length || !vt(CONF.cats).length) { alert(T.ERR_CONF); return; }

    var m = document.createElement("div");
    m.id = "tdlch-modal-valid";
    m.className = "dc-overlay actif";
    m.innerHTML = '<div class="dc-boite fi-boite" style="max-width:720px">'
      + '<button class="dc-btn-fermer" data-act="fermer">✕</button>'
      + '<div class="dc-titre">' + esc(T.M_TITRE(d.pseudo)) + '</div>'
      + '<p class="mc-sub">' + esc(T.M_INTRO) + '</p>'
      + '<div class="fi-grid">'
      + '<div class="fi-field"><label class="fi-label">' + esc(T.M_PERIODE) + '</label>'
      +   '<select class="fi-select" data-v="p">' + opts(CONF.periodes, d.p, function(x){ return x.t + (x.d ? " — " + x.d : ""); }) + '</select></div>'
      + '<div class="fi-field"><label class="fi-label">' + esc(T.M_CAT) + '</label>'
      +   '<select class="fi-select" data-v="c">' + opts(CONF.cats, d.c, function(x){ return x.l; }) + '</select></div>'
      + '<div class="fi-field"><label class="fi-label">' + esc(T.M_ISO) + '</label>'
      +   '<input class="fi-input" type="date" data-v="iso" value="' + esc(d.iso || "") + '"></div>'
      + '<div class="fi-field"><label class="fi-label">' + esc(T.M_D) + '</label>'
      +   '<input class="fi-input" type="text" data-v="d" value="' + esc(d.d || "") + '"></div></div>'
      + '<div class="fi-field"><label class="fi-label">' + esc(T.M_T) + '</label>'
      +   '<input class="fi-input" type="text" data-v="t" value="' + esc(d.t || "") + '"></div>'
      + '<div class="fi-field"><label class="fi-label">' + esc(T.M_X) + '</label>'
      +   '<textarea class="fi-textarea" rows="6" data-v="x">' + esc(d.x || "") + '</textarea></div>'
      + '<div class="fi-field"><label class="fi-label">' + esc(T.M_A) + '</label>'
      +   '<input class="fi-input" type="text" data-v="a" value="' + esc(d.a || "") + '"></div>'
      + '<div class="fi-field"><label class="fi-label">' + esc(T.M_IMG) + '</label>'
      +   '<input class="fi-input" type="text" data-v="img" value="' + esc(d.img || "") + '"></div>'
      + '<div class="dc-actions"><button class="dc-btn-soumettre" data-act="ok">' + esc(T.M_OK) + '</button>'
      + '<button class="dc-btn-annuler" data-act="fermer">' + esc(T.M_ANNULE) + '</button></div>'
      + '<div class="fi-resultat" id="tdlch-modal-res"></div></div>';
    document.body.appendChild(m);
    document.body.style.overflow = "hidden";

    function fermer(){ m.remove(); document.body.style.overflow = ""; }
    m.addEventListener("click", function(ev){
      if (ev.target === m || ev.target.closest('[data-act="fermer"]')) { fermer(); return; }
      if (ev.target.closest('[data-act="ok"]')) valider(d, m, listeEl, fermer);
    });
  }

  /* ===================== TRAITEMENT ===================== */
  async function valider(d, m, listeEl, fermer){
    var v = {}, res = m.querySelector("#tdlch-modal-res"), btn = m.querySelector('[data-act="ok"]');
    m.querySelectorAll("[data-v]").forEach(function(x){ v[x.getAttribute("data-v")] = x.value.trim(); });
    if (!v.p || !v.c || !v.iso || !v.t || !v.x) { resultat(res, "erreur", T.ERR_CHAMPS); return; }

    btn.disabled = true; btn.textContent = T.M_ENVOI;
    var moi = null; try { moi = E().getPseudo(); } catch(e){}
    var ajout = { p:v.p, c:v.c, iso:v.iso, d:v.d || v.iso.slice(0, 4), t:v.t, x:v.x,
                  a:v.a || null, img:v.img || null,
                  uid:d.uid || null, pseudo:d.pseudo || null,
                  par:moi, cree:new Date().toISOString(), demande:d.id };
    var maj = {};
    maj[CFG.NODE_DEMANDES + "/" + d.id + "/statut"] = "validee";
    maj[CFG.NODE_DEMANDES + "/" + d.id + "/traite_par"] = moi;
    maj[CFG.NODE_DEMANDES + "/" + d.id + "/traite_le"] = ajout.cree;
    try {
      await E().firebasePush(CFG.NODE_AJOUTS, ajout);   /* d'abord l'inscription : rien ne se perd */
      await E().firebaseUpdate(maj);
    } catch(e){
      if (window.console) console.error("[Chrono] validation", e);
      resultat(res, "erreur", T.ERR_ECRIT);
      btn.disabled = false; btn.textContent = T.M_OK; return;
    }
    resultat(res, "succes", T.OK_VALID);
    setTimeout(function(){ fermer(); charger(listeEl); }, 1200);
  }

  async function refuser(d, listeEl, carte){
    var motif = window.prompt(T.PROMPT_REFUS, "");
    if (motif === null) return;
    var zone = carte && carte.querySelector(".dc-resultat");
    var moi = null; try { moi = E().getPseudo(); } catch(e){}
    var maj = {};
    maj[CFG.NODE_DEMANDES + "/" + d.id + "/statut"] = "refusee";
    maj[CFG.NODE_DEMANDES + "/" + d.id + "/motif_refus"] = motif.trim() || null;
    maj[CFG.NODE_DEMANDES + "/" + d.id + "/traite_par"] = moi;
    maj[CFG.NODE_DEMANDES + "/" + d.id + "/traite_le"] = new Date().toISOString();
    try { await E().firebaseUpdate(maj); }
    catch(e){ if (window.console) console.error("[Chrono] refus", e); resultat(zone, "erreur", T.ERR_ECRIT); return; }
    resultat(zone, "succes", T.OK_REFUS);
    setTimeout(function(){ charger(listeEl); }, 900);
  }

  /* ===================== INIT ===================== */
  function demarrer(n){
    n = n || 0;
    var mont = document.querySelector(CFG.MONTAGE);
    if (!mont || document.getElementById("tdlch-staff-panel")) return;
    if (!staff()) return;                                 /* invisible pour les membres */
    var pret = window.TDLCHD && E() && typeof E().safeReadBin === "function";
    if (!pret) {
      if (n > CFG.RETRY_MAX) { if (window.console) console.warn("[Chrono] staff : dépendances absentes."); return; }
      setTimeout(function(){ demarrer(n + 1); }, CFG.RETRY_MS); return;
    }
    D = window.TDLCHD; esc = D.esc; vt = D.versTableau; resultat = D.resultat;
    mont.appendChild(creerEntete());
    var panel = creerPanel();
    mont.appendChild(panel);
    charger(panel.querySelector("#tdlch-staff-liste"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ demarrer(); });
  else demarrer();
})();
