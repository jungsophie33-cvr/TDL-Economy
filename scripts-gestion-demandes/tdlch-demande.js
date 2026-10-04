/*
 * tdlch-demande.js — Demande d'ajout à la chronologie (côté membre) · TDL
 *
 * CE QUE CE FICHIER FAIT : bouton déclencheur et modale, lecture de la structure
 * de la frise publiée par l'annexe (chrono_config), validation des champs,
 * écriture de la demande dans chrono_demandes.
 * CE QU'IL NE FAIT PAS : aucune logique staff (tdlch-demande-staff.js),
 * aucune écriture dans la chronologie elle-même.
 *
 * CARTE DES BLOCS :
 *   CONFIG     — nœuds Firebase et textes
 *   UTILS      — échappement, accès EcoCore, résultat
 *   RENDER     — bouton d'appel et structure de la modale
 *   CHARGEMENT — périodes et catégories lues dans chrono_config
 *   EVENTS     — ouverture, fermeture, Échap, overlay
 *   LECTURE    — extraction des valeurs
 *   VALIDATION — champs obligatoires
 *   SOUMISSION — écriture de la demande
 *   INIT       — point d'entrée, monté sur #chrono-demande
 *
 * Réutilise le balisage des demandes de fiche et de multicompte : .mc-cta pour
 * le bouton, .dc-overlay / .dc-boite pour la modale, .fi-* pour les champs.
 * Aucune règle CSS nouvelle.
 *
 * Dépend de : window.EcoCore (safeReadBin, firebasePush, getPseudo, getUserId).
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var CFG = {
    MONTAGE:       "#chrono-demande",
    NODE_DEMANDES: "chrono_demandes",
    NODE_CONFIG:   "chrono_config",        /* publié par l'annexe Chronologie */
    MAX_TEXTE:     900,
    RETRY_MS: 250, RETRY_MAX: 60
  };

  var T = {
    BTN:        "Proposer un événement",
    BTN_SOUS:   "pour la chronologie de la paroisse",
    TITRE:      "Proposer un événement pour la chronologie",
    INTRO:      "La chronologie présente les événements qui ont façonné Terrebonne. Vous pouvez y faire inscrire "
              + "un épisode qui concerne votre personnage ou sa famille, si elle figure dans le lore. "
              + "Le staff décide de la période et de la catégorie, et peut retoucher la formulation.",
    L_DATE:     "Date de l'événement *", A_DATE: "sert au classement dans la frise",
    L_AFFICHE:  "Date affichée", A_AFFICHE: "ex. « v. 1840 », « été 1931 » ; par défaut, l'année",
    L_PERIODE:  "Période", A_PERIODE: "le staff peut la corriger",
    L_CAT:      "Catégorie", A_CAT: "le staff peut la corriger",
    L_TITRE:    "Titre *", A_TITRE: "une phrase courte, comme un titre de chapitre",
    L_TEXTE:    "Texte *", A_TEXTE: "une ligne vide sépare deux paragraphes",
    L_APARTE:   "Aparté", A_APARTE: "une remarque en italique sous le texte",
    L_IMAGE:    "Image", A_IMAGE: "lien d'une image d'illustration",
    L_MOTIF:    "Pourquoi cet ajout *", A_MOTIF: "lu par la rédaction seulement, ne paraît pas",
    BTN_ENVOI:  "Envoyer la demande", BTN_ANNULE: "Annuler", BTN_FERMER: "✕",
    CHARGEMENT: "Chargement…",
    ERR_CHAMPS: "Date, titre, texte et motif sont obligatoires.",
    ERR_IMAGE:  "L'image doit être un lien commençant par https://.",
    ERR_CONNEXION: "Connectez-vous pour proposer un événement.",
    ERR_ENVOI:  "L'envoi a échoué. Rien n'a été enregistré.",
    ERR_DOUBLON: "Vous avez déjà une demande en attente. Attendez la réponse de la rédaction.",
    OK:         "Demande envoyée. La rédaction répondra dans ce sujet."
  };

  /* ===================== UTILS ===================== */
  function E(){ return window.EcoCore; }
  function esc(s){
    return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function pseudo(){ try { return E().getPseudo(); } catch(e){ return null; } }
  function uid(){ try { var u = E().getUserId(); return u ? String(u) : null; } catch(e){ return null; } }
  function versTableau(v){ return Array.isArray(v) ? v.filter(Boolean) : (v ? Object.keys(v).map(function(k){ return v[k]; }).filter(Boolean) : []); }
  function resultat(el, type, msg){
    if (!el) return;
    el.className = "fi-resultat " + type;
    el.innerHTML = msg;
  }
  function champ(label, aide, inner, large){
    return '<div class="fi-field' + (large ? " fi-full" : "") + '"><label class="fi-label">' + esc(label)
      + (aide ? ' <span class="fi-aide">— ' + esc(aide) + '</span>' : "") + '</label>' + inner + '</div>';
  }

  /* ===================== RENDER ===================== */
  function creerBouton(){
    var w = document.createElement("div");
    w.innerHTML = '<button class="mc-cta" type="button" data-act="ouvrir">'
      + '<i class="fi fi-tr-time-past"></i>'
      + '<span><b>' + esc(T.BTN) + '</b><em>' + esc(T.BTN_SOUS) + '</em></span>'
      + '<i class="fi fi-tr-angle-small-right"></i></button>';
    return w;
  }
  function creerModal(){
    var o = document.createElement("div");
    o.id = "tdlch-overlay";
    o.className = "dc-overlay";
    o.innerHTML = '<div class="dc-boite fi-boite">'
      + '<button class="dc-btn-fermer" data-act="fermer">' + T.BTN_FERMER + '</button>'
      + '<tdl-separator></tdl-separator>'
      + '<h3 class="dc-titre">' + esc(T.TITRE) + '</h3>'
      + '<p class="mc-sub">' + esc(T.INTRO) + '</p>'
      + '<div id="tdlch-champs"><div class="fi-grid">'
      +   champ(T.L_DATE, T.A_DATE, '<input class="fi-input" type="date" data-f="iso">')
      +   champ(T.L_AFFICHE, T.A_AFFICHE, '<input class="fi-input" type="text" data-f="d">')
      +   champ(T.L_PERIODE, T.A_PERIODE, '<select class="fi-select" data-f="p"><option>' + esc(T.CHARGEMENT) + '</option></select>')
      +   champ(T.L_CAT, T.A_CAT, '<select class="fi-select" data-f="c"><option>' + esc(T.CHARGEMENT) + '</option></select>')
      + '</div>'
      + champ(T.L_TITRE, T.A_TITRE, '<input class="fi-input" type="text" data-f="t">', true)
      + champ(T.L_TEXTE, T.A_TEXTE, '<textarea class="fi-textarea" rows="6" maxlength="' + CFG.MAX_TEXTE + '" data-f="x"></textarea>', true)
      + champ(T.L_APARTE, T.A_APARTE, '<input class="fi-input" type="text" data-f="a">', true)
      + champ(T.L_IMAGE, T.A_IMAGE, '<input class="fi-input" type="text" data-f="img" placeholder="https://…">', true)
      + champ(T.L_MOTIF, T.A_MOTIF, '<textarea class="fi-textarea" rows="3" data-f="motif"></textarea>', true)
      + '<div class="dc-actions">'
      +   '<button class="dc-btn-soumettre" type="button" data-act="envoyer">' + esc(T.BTN_ENVOI) + '</button>'
      +   '<button class="dc-btn-annuler" type="button" data-act="fermer">' + esc(T.BTN_ANNULE) + '</button>'
      + '</div></div>'
      + '<div class="fi-resultat" id="tdlch-resultat"></div></div>';
    return o;
  }

  /* ===================== CHARGEMENT ===================== */
  /* Périodes et catégories viennent de chrono_config, publié par l'annexe.
     Sans ce nœud, les deux listes disparaissent : la rédaction placera
     l'événement elle-même à la validation. */
  async function charger(o){
    var p = pseudo();
    var root;
    try { root = (await E().safeReadBin()) || {}; } catch(e){ root = {}; }
    var conf = root[CFG.NODE_CONFIG] || {};
    var selP = o.querySelector('[data-f="p"]'), selC = o.querySelector('[data-f="c"]');

    function remplir(sel, liste, lib){
      var items = versTableau(liste);
      if (!items.length) { sel.closest(".fi-field").hidden = true; sel.disabled = true; return; }
      sel.innerHTML = items.map(function(x){
        return '<option value="' + esc(x.id) + '">' + esc(lib(x)) + '</option>';
      }).join("");
    }
    remplir(selP, conf.periodes, function(x){ return x.t + (x.d ? " — " + x.d : ""); });
    remplir(selC, conf.cats, function(x){ return x.l; });

    /* une seule demande en attente par membre : la file reste lisible */
    o.dataset.doublon = versTableau(root[CFG.NODE_DEMANDES]).some(function(d){
      return d && d.pseudo === p && d.statut === "en_attente";
    }) ? "1" : "";
  }

  /* ===================== LECTURE ET VALIDATION ===================== */
  function lire(o){
    var v = {};
    Array.prototype.forEach.call(o.querySelectorAll("[data-f]"), function(x){
      if (!x.disabled) v[x.getAttribute("data-f")] = x.value.trim();
    });
    return v;
  }
  function valider(v){
    if (!v.iso || !v.t || !v.x || !v.motif) return T.ERR_CHAMPS;
    if (v.img && !/^https:\/\//i.test(v.img)) return T.ERR_IMAGE;
    return null;
  }

  /* ===================== SOUMISSION ===================== */
  async function envoyer(o){
    var res = o.querySelector("#tdlch-resultat"), btn = o.querySelector('[data-act="envoyer"]');
    var p = pseudo();
    if (!p) { resultat(res, "erreur", T.ERR_CONNEXION); return; }
    if (o.dataset.doublon) { resultat(res, "erreur", T.ERR_DOUBLON); return; }
    var v = lire(o), err = valider(v);
    if (err) { resultat(res, "erreur", err); return; }

    btn.disabled = true;
    var d = { statut:"en_attente", pseudo:p, uid:uid(),
              p:v.p || null, c:v.c || null, iso:v.iso, d:v.d || v.iso.slice(0, 4),
              t:v.t, x:v.x, a:v.a || null, img:v.img || null, motif:v.motif,
              cree:new Date().toISOString() };
    Object.keys(d).forEach(function(k){ if (d[k] === undefined) delete d[k]; });
    try { await E().firebasePush(CFG.NODE_DEMANDES, d); }
    catch(e){
      if (window.console) console.error("[Chrono] demande", e);
      resultat(res, "erreur", T.ERR_ENVOI); btn.disabled = false; return;
    }
    resultat(res, "succes", T.OK);   /* le staff suit le sujet : les notifications FA suffisent */
    o.querySelector("#tdlch-champs").style.display = "none";
    o.dataset.doublon = "1";
  }

  /* ===================== EVENTS ===================== */
  function brancher(bouton, o){
    function fermer(){ o.classList.remove("actif"); document.body.style.overflow = ""; }
    function ouvrir(){
      o.classList.add("actif");
      document.body.style.overflow = "hidden";
      if (!o.dataset.initialise) { o.dataset.initialise = "1"; charger(o); }
    }
    bouton.querySelector('[data-act="ouvrir"]').addEventListener("click", ouvrir);
    o.addEventListener("click", function(ev){
      if (ev.target === o || ev.target.closest('[data-act="fermer"]')) { fermer(); return; }
      if (ev.target.closest('[data-act="envoyer"]')) envoyer(o);
    });
    document.addEventListener("keydown", function(ev){
      if (ev.key === "Escape" && o.classList.contains("actif")) fermer();
    });
  }

  /* ===================== INIT ===================== */
  function demarrer(n){
    n = n || 0;
    var mont = document.querySelector(CFG.MONTAGE);
    if (!mont) return;                                    /* pas le bon sujet : on ne fait rien */
    if (document.getElementById("tdlch-overlay")) return;
    var eco = E() && typeof E().safeReadBin === "function" && typeof E().firebasePush === "function";
    if (!eco) {
      if (n > CFG.RETRY_MAX) { if (window.console) console.warn("[Chrono] EcoCore introuvable."); return; }
      setTimeout(function(){ demarrer(n + 1); }, CFG.RETRY_MS); return;
    }
    var bouton = creerBouton(), o = creerModal();
    mont.appendChild(bouton);
    document.body.appendChild(o);
    brancher(bouton, o);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ demarrer(); });
  else demarrer();

  window.TDLCHD = { CFG:CFG, T:T, esc:esc, versTableau:versTableau, resultat:resultat };
})();
