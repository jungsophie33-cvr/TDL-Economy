/*
 * tdlhc-suivi.js — Suivi des soumissions côté membre · The Houma Courier · TDL · lot 2
 *
 * CE QUE CE FICHIER FAIT :
 *   - remplit l'étape de choix du volet : « À votre attention » (accords demandés au membre)
 *     en tête, « Mes soumissions » en pied ;
 *   - affiche une demande d'accord (type, titre, chapô, auteur, sujet RP — jamais le texte
 *     d'un article) et enregistre la réponse, horodatée ; le silence ne vaut jamais accord ;
 *   - rouvre une soumission renvoyée en retouche, pré-remplie, avec la demande de la rédaction ;
 *   - tient la pastille du bouton « Soumettre au Courier » ;
 *   - répond aux ancres #hc=soum-…, #hc=accord-…, #hc=rub-….
 * CE QU'IL NE FAIT PAS : décider d'une retouche, d'un refus ou d'une publication (lot 3).
 *
 * DÉPEND DE : window.Courier, Courier.volet, Courier.envoi, window.EcoCore (firebaseUpdate).
 * À CHARGER : après tdlhc-envoi.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var CFG = { MAX_MES:8, N_ACCORD_REFUSE:197 };
  var VOLET_DU_TYPE = { "annonce":"annonce", "etat-civil":"civil", "rumeur":"rumeur", "lettre":"lettre", "prelien":"prelien", "article":"article" };
  var RUBRIQUE_DU_TYPE = { "annonce":"annonces", "prelien":"annonces", "rumeur":"une" };
  var STATUT = { relecture:"En relecture", retouche:"Retouche demandée", marbre:"Au marbre", publiee:"Publiée", refusee:"Refusée", retiree:"Retirée" };
  var ATTENDU = { relecture:1, retouche:1, marbre:1 };
  var SOUS_ARTICLE = { correspondant:"Correspondance", pigiste:"Pige" };

  var TXT = {
    ATTENTION:"À votre attention", MES:"Mes soumissions", ACCORD_DEMANDE:"Accord demandé", REPONDRE:"Répondre",
    CITE:"Un contenu à paraître cite votre personnage.",
    DE:function(t, a){ return t + " de " + a; },
    RETENUS:function(n){ return n + " $ retenus"; },
    MARBRE:"Retenu pour une parution ultérieure",
    RETOUCHE:function(n, j){ return "Retouche " + n + " sur 2 · " + (j > 0 ? j + (j>1 ? " jours" : " jour") + " pour reprendre" : "délai dépassé"); },
    REDACTION:"La rédaction", REPRENDRE:"Reprendre", LIRE:"Lire", VOIR:"Voir",
    ACCORD_TITRE:"Demande d'accord", ACCORD_COUT:"Aucune somme en jeu",
    ENC_ACCORD:["Votre personnage est cité dans un contenu à paraître",
      "Comme dans n'importe quel journal, vous ne lisez pas l'article avant sa parution. Vous voyez ce qui permet de décider : qui l'écrit, sur quel sujet RP, et ce qu'en dit le chapô.",
      "Sans réponse de votre part, rien ne paraît. Le silence ne vaut jamais accord.",
      "Si vous refusez, l'auteur est invité à retirer votre personnage de son texte."],
    AUTEUR:"Auteur", SUJET:"Sujet RP", OUVRIR:"Ouvrir le sujet",
    RAISON:"Si vous refusez, pourquoi ?", RAISON_NOTE:"optionnel, transmis à la rédaction",
    OUI:"Donner mon accord", NON:"Refuser",
    OK_OUI:"Accord transmis à la rédaction.", OK_NON:"Refus transmis. L'auteur sera invité à retirer votre personnage.",
    PLUS_ATTENTE:"Cette demande n'attend plus de réponse.", ERR:"La réponse n'a pas pu être enregistrée. Réessaie.",
    REPRISE_CLOSE:"Cette soumission ne peut plus être reprise."
  };

  /* ===================== UTILS ===================== */
  var A = null, V = null, accordTitre = "";
  function esc(s){ return A.esc(s); }
  function E(){ return window.EcoCore; }
  function J(root){ return A.journal(root); }
  function typeLabel(m){
    var t = V.TYPES[VOLET_DU_TYPE[m.type]];
    return m.type==="article" ? (SOUS_ARTICLE[m.sous_type] || "Article") : (t ? t.t : m.type);
  }
  function joursAvant(v){ return v ? Math.ceil((A.ms(v) - Date.now()) / 86400000) : 0; }
  function dernier(m){ var l = A.versTableau(m.echanges); return l.length ? l[l.length-1] : null; }

  /* ===================== DONNÉES ===================== */
  function aRepondre(root, p){
    var n = J(root).soum_meta || {};
    return Object.keys(n).filter(function(id){
      var m = n[id]; return m && ATTENDU[m.statut] && m.cites && m.cites[p] && m.cites[p].choix==="attente";
    }).map(function(id){ return { id:id, m:n[id] }; });
  }
  function mesSoumissions(root, p){
    var j = J(root), out = [];
    Object.keys(j.soum_meta || {}).forEach(function(id){ var m = j.soum_meta[id]; if (m && m.auteur===p) out.push({ id:id, m:m, quand:A.ms(m.maj || m.cree) }); });
    Object.keys(j.archive || {}).forEach(function(id){ var a = j.archive[id]; if (a && a.auteur===p) out.push({ id:id, a:a, quand:A.ms(a.publie) }); });
    return out.sort(function(x, y){ return y.quand - x.quand; }).slice(0, CFG.MAX_MES);
  }

  /* ===================== RENDER ===================== */
  function tete(statut, quand){
    return '<div class="tdlhc-mes-tete"><span class="tdlhc-statut ' + statut + '">' + esc(STATUT[statut] || TXT.ACCORD_DEMANDE)
      + '</span><span class="tdlhc-mes-date">' + esc(A.depuis(quand)) + '</span></div>';
  }
  function htmlAttention(l){
    return '<p class="tdlhc-legende">' + esc(TXT.ATTENTION) + '</p>' + l.map(function(x){
      return '<div class="tdlhc-mes-item accord"><div class="tdlhc-mes-tete"><span class="tdlhc-statut accord">' + esc(TXT.ACCORD_DEMANDE)
        + '</span><span class="tdlhc-mes-date">' + esc(A.depuis(x.m.cree)) + '</span></div><h5>' + esc(x.m.titre) + '</h5>'
        + '<div class="tdlhc-mes-type">' + esc(TXT.DE(typeLabel(x.m), x.m.auteur)) + '</div>'
        + '<div class="tdlhc-mes-pied"><span>' + esc(TXT.CITE) + '</span><button class="tdlhc-btn petit" type="button" data-action="accord" data-id="'
        + esc(x.id) + '">' + esc(TXT.REPONDRE) + '</button></div></div>';
    }).join("");
  }
  function htmlArchive(x){
    var a = x.a, cible = a.ancre ? ' data-ancre="' + esc(a.ancre) + '"' : ' data-rub="' + esc(RUBRIQUE_DU_TYPE[a.type] || "une") + '"';
      return '<div class="tdlhc-mes-item" data-id="' + esc(x.id) + '">' + tete(a.retire ? "retiree" : "publiee", a.retire || a.publie) + '<h5>' + esc(a.titre || "") + '</h5>'
      + '<div class="tdlhc-mes-pied"><span>' + esc(typeLabel(a)) + '</span>' + (a.retire ? "" : '<button class="tdlhc-sup" type="button" data-action="voir"' + cible + '>'
      + esc(a.ancre ? TXT.LIRE : TXT.VOIR) + '</button>') + '</div></div>';
  }
  function htmlMeta(x){
    var m = x.m, s = m.statut, e = dernier(m), corps = "", pied = typeLabel(m);
    if (s==="relecture" && m.montant < 0) pied += " · " + TXT.RETENUS(-m.montant);
    if (s==="marbre") pied += " · " + TXT.MARBRE;
    if (s==="refusee" && m.refus) corps = '<div class="tdlhc-mes-com"><b>' + esc(TXT.REDACTION) + '</b>' + esc(m.refus.motif || "")
      + (m.refus.texte ? " — " + esc(m.refus.texte) : "") + '</div>';
    if (s==="retouche") {
      corps = e ? '<div class="tdlhc-mes-com"><b>' + esc(TXT.REDACTION) + '</b>' + esc(A.versTableau(e.motifs).join(" · "))
        + (e.texte ? (e.motifs ? " — " : "") + esc(e.texte) : "") + '</div>' : "";
      var j = joursAvant(m.reprise_avant);
      return '<div class="tdlhc-mes-item retouche" data-id="' + esc(x.id) + '">' + tete(s, m.maj) + '<h5>' + esc(m.titre) + '</h5>'
        + '<div class="tdlhc-mes-type">' + esc(typeLabel(m)) + '</div>' + corps
        + '<div class="tdlhc-mes-pied"><span>' + esc(TXT.RETOUCHE(m.retouches || 1, j)) + '</span>'
        + (j > 0 ? '<button class="tdlhc-btn petit" type="button" data-action="reprendre" data-id="' + esc(x.id) + '">' + esc(TXT.REPRENDRE) + '</button>' : "")
        + '</div></div>';
    }
    return '<div class="tdlhc-mes-item" data-id="' + esc(x.id) + '">' + tete(s, m.maj || m.cree) + '<h5>' + esc(m.titre) + '</h5>' + corps
      + '<div class="tdlhc-mes-pied"><span>' + esc(pied) + '</span></div></div>';
  }
  async function remplirChoix(corps){
    var p = A.pseudo(); if (!p) return;
    var root = await A.fb(), att = corps.querySelector('[data-zone="attention"]'), mes = corps.querySelector('[data-zone="mes"]');
    if (!att || !mes || !att.isConnected) return;               /* le volet a changé d'étape entre-temps */
    var l = aRepondre(root, p), s = mesSoumissions(root, p);
    att.innerHTML = l.length ? htmlAttention(l) : ""; att.hidden = !l.length;
    mes.innerHTML = s.length ? '<p class="tdlhc-legende">' + esc(TXT.MES) + '</p>'
      + s.map(function(x){ return x.a ? htmlArchive(x) : htmlMeta(x); }).join("") : "";
    mes.hidden = !s.length;
    poserPastille(l.length);
  }

  /* ===================== ACCORD ===================== */
  async function ouvrirAccord(id){
    var p = A.pseudo(), root = await A.envoi.lireFrais() || {}, j = J(root), m = j.soum_meta && j.soum_meta[id];
    if (!p || !m || !ATTENDU[m.statut] || !m.cites || !m.cites[p] || m.cites[p].choix!=="attente") { A.toast(TXT.PLUS_ATTENTE); V.etapeChoix(); return; }
    var c = (j.soum_corps && j.soum_corps[id]) || {};
    accordTitre = m.titre;
    var resume = m.type==="article" ? (c.chapo || "") : (c.texte || "");          /* jamais le texte d'un article */
    var rp = /^https?:\/\//i.test(c.rp||"") ? c.rp : "";
    V.etapeLibre(TXT.ACCORD_TITRE,
      '<div class="tdlhc-encart"><h5><i class="fi fi-tr-comment-quote"></i> ' + esc(TXT.ENC_ACCORD[0]) + '</h5><ul>'
      + TXT.ENC_ACCORD.slice(1).map(function(x){ return "<li>" + esc(x) + "</li>"; }).join("") + '</ul></div>'
      + '<div class="tdlhc-fiche-accord"><div class="tdlhc-surtitre" style="--c:var(--gr2-color)">' + esc(typeLabel(m)) + '</div>'
      + '<h4>' + esc(m.titre) + '</h4>' + (resume ? '<p class="tdlhc-chapo">' + esc(resume) + '</p>' : "")
      + '<div class="tdlhc-meta"><div><span>' + esc(TXT.AUTEUR) + '</span>' + esc(c.signature || m.auteur) + '</div>'
      + (rp ? '<div><span>' + esc(TXT.SUJET) + '</span><button class="tdlhc-sup" type="button" data-action="lien" data-url="' + esc(rp) + '">'
           + esc(TXT.OUVRIR) + '</button></div>' : "") + '</div></div>'
      + '<div class="tdlhc-champ tdlhc-espace"><label>' + esc(TXT.RAISON) + ' <span>— ' + esc(TXT.RAISON_NOTE) + '</span></label>'
      + '<textarea class="tdlhc-ta-court" data-zone="raison"></textarea></div>'
      + '<div class="tdlhc-act-btns"><button class="tdlhc-btn" type="button" data-action="accord-oui" data-id="' + esc(id) + '"><i class="fi fi-tr-check"></i> '
      + esc(TXT.OUI) + '</button><button class="tdlhc-btn creux danger" type="button" data-action="accord-non" data-id="' + esc(id) + '"><i class="fi fi-tr-cross-small"></i> '
      + esc(TXT.NON) + '</button></div>', TXT.ACCORD_COUT);
  }
  async function repondre(id, oui){
    var p = A.pseudo(), z = V.corps().querySelector('[data-zone="raison"]'), maj = {};
    maj[A.CFG.NODE_JOURNAL + "/soum_meta/" + id + "/cites/" + p] = { choix:oui ? "oui" : "non", date:new Date().toISOString(),
                                                                      raison:(!oui && z && z.value.trim()) || null };
    try { await E().firebaseUpdate(maj); }
    catch(e){ if (window.console) console.error("[Courier] accord", e); A.toast(TXT.ERR); return; }
    if (!oui) A.envoi.notifier(CFG.N_ACCORD_REFUSE, "staff", { pseudo:p, titre:accordTitre, url:A.envoi.lien("bureau-" + id) }, "hc-refus-accord-" + id + "-" + p);
    A.fbInvalider(); V.ferme(); A.toast(oui ? TXT.OK_OUI : TXT.OK_NON); majPastille();
  }

  /* ===================== REPRISE ===================== */
  async function reprendre(id){
    var p = A.pseudo(), root = await A.envoi.lireFrais() || {}, j = J(root), m = j.soum_meta && j.soum_meta[id];
    if (!m || m.auteur!==p || m.statut!=="retouche" || joursAvant(m.reprise_avant) <= 0) { A.toast(TXT.REPRISE_CLOSE); return; }
    var e = dernier(m) || {}, valeurs = {};
    var c = (j.soum_corps && j.soum_corps[id]) || {};
    Object.keys(c).forEach(function(k){ valeurs[k] = c[k]; });
    valeurs.citations = A.versTableau(c.citations);
    valeurs.reprise = id;
    valeurs._banniere = { n:m.retouches || 1, motifs:A.versTableau(e.motifs).join(" · "), texte:e.texte || "", limite:A.dateLisible(m.reprise_avant) };
    V.ouvre(VOLET_DU_TYPE[m.type], valeurs);
  }

  /* ===================== PASTILLE, ACTIONS, ANCRES ===================== */
  function poserPastille(n){
    var b = V.pastille(); if (!b) return;
    b.textContent = n; b.hidden = !n;
  }
  async function majPastille(){
    var p = A.pseudo(); if (!p) return;
    poserPastille(aRepondre(await A.fb(), p).length);
  }
  function action(a, x){
    var id = x.getAttribute("data-id");
    if (a==="accord") ouvrirAccord(id);
    else if (a==="accord-oui") repondre(id, true);
    else if (a==="accord-non") repondre(id, false);
    else if (a==="reprendre") reprendre(id);
    else if (a==="lien") window.open(x.getAttribute("data-url"), "_blank");
    else if (a==="voir") {                                       /* FA intercepte les liens : on ouvre nous-mêmes */
      V.ferme();
      if (x.getAttribute("data-ancre")) A.ouvrirContenu(x.getAttribute("data-ancre")); else A.montre(x.getAttribute("data-rub"));
    }
  }
  async function viserSoumission(id){
    V.ouvre(null);
    for (var i = 0; i < 20; i++) {                               /* la liste se remplit après une lecture */
      var it = V.corps().querySelector('.tdlhc-mes-item[data-id="' + id + '"]');
      if (it) { it.scrollIntoView({ block:"center" }); return; }
      await new Promise(function(r){ setTimeout(r, 150); });
    }
  }

  /* ===================== INIT ===================== */
  function demarrer(){
    var C = window.Courier; A = C.api; V = C.volet; A.envoi = C.envoi;
    V.hooks.choix = remplirChoix; V.hooks.action = action;
    V.hooks.pret = majPastille; V.hooks.apres = function(){ A.fbInvalider(); majPastille(); };
    C.ancre("soum-", viserSoumission);
    C.ancre("accord-", function(id){ V.ouvre(null); ouvrirAccord(id); });
    C.ancre("rub-", function(nom){ A.montre(nom); });
  }
  (function attendre(n){
    if (window.Courier && window.Courier.volet && window.Courier.envoi) { demarrer(); return; }
    if ((n||0) < 60) setTimeout(function(){ attendre((n||0)+1); }, 250);
  })();
})();
