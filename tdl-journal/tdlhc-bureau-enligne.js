/*
 * tdlhc-bureau-enligne.js — Rubrique « En ligne » du bureau · The Houma Courier · TDL
 *
 * CE QUE CE FICHIER FAIT :
 *   - liste ce qui est publié dans Firebase : petites annonces, pré-liens, rumeurs ;
 *   - retire un élément au cas par cas, avec ou sans remboursement ; l'archive garde la
 *     trace (quota consommé, « Retirée » dans Mes soumissions) ;
 *   - réinitialise le journal nœud par nœud, pour les administrateurs seulement, après
 *     confirmation écrite ; les sommes retenues sur les soumissions en cours sont rendues ;
 *   - fait oublier au navigateur les pages du sujet gardées en cache de session.
 * CE QU'IL NE FAIT PAS : les articles, lettres, avis vivent dans le sujet t102 :
 *   on les retire en supprimant le message.
 *
 * DÉPEND DE : Courier.bureau et ses actions (ecrire, crediter).
 * À CHARGER : après tdlhc-bureau-outils.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var NOEUDS = [["annonces", "Petites annonces"], ["prelien", "Pré-liens"], ["rumeurs", "Rumeurs"]];
  var RESET = [
    ["publications", "Publications en ligne", "Petites annonces, pré-liens et rumeurs affichés dans le journal.", true],
    ["soumissions",  "Soumissions en cours",  "Tout ce qui attend dans le bureau. Les sommes retenues sont d'abord rendues aux membres.", false],
    ["archive",      "Archive",               "Efface les quotas du mois, le compte des correspondances et le contrôle « sujet déjà couvert ».", false],
    ["badges",       "Badges à attribuer",    "Les signalements de badge en attente.", false],
    ["caisse",       "Caisse",                "L'historique des mouvements d'argent. Ne touche à aucun solde.", false],
    ["affaires",     "Affaires",              "Les noms d'affaires. Les articles gardent leur clé DOSSIER.", false]
  ];
  var EN_ATTENTE = { relecture:1, retouche:1, marbre:1 };
  var MOT = "RÉINITIALISER";

  var TXT = {
    TITRE:"En ligne", SOUS:"Publié dans Firebase · les articles vivent dans le sujet", RESET:"Réinitialiser",
    VIDE:"Rien en ligne dans cette rubrique.",
    LIGNE:function(a, p, e){ return a + " · publié le " + p + (e ? " · expire le " + e : ""); },
    RETIRER:"Retirer", REMBOURSER:"Retirer et rembourser",
    CONF_RETIRER:function(t){ return "Retirer « " + t + " » du journal ?"; },
    CONF_REMB:function(t, n, p){ return "Retirer « " + t + " » et rendre " + n + " $ à " + p + " ?"; },
    OK_RETIRE:"Retiré du journal.", OK_REMB:function(n, p){ return "Retiré ; " + n + " $ rendus à " + p + "."; },
    ERR_REMB:"Retiré, mais le remboursement a échoué : à recréditer à la main.",
    RESET_INTRO:"Coche ce qui doit être effacé. Les articles, lettres et avis restent dans le sujet : pour les retirer, supprime leurs messages.",
    RESET_ADMIN:"La réinitialisation est réservée aux administrateurs.",
    RESET_BTN:"Réinitialiser la sélection", RESET_RIEN:"Rien n'est coché.",
    RESET_PROMPT:function(l){ return "Vont être effacés : " + l + ".\nPour confirmer, tape " + MOT + " :"; },
    RESET_ANNULE:"Réinitialisation annulée.",
    RESET_OK:function(l, r){ return "Effacé : " + l + "." + (r ? " " + r + " $ rendus au total." : ""); },
    CACHE:"Oublier le cache du journal",
    CACHE_AIDE:"Après la suppression d'un message ancien du sujet, le journal peut l'afficher jusqu'à la fin de la session. Ce bouton le force à tout relire.",
    ERR:"L'opération a échoué. Rien n'a été modifié."
  };

  /* ===================== UTILS ===================== */
  var A = null, Bu = null;
  function esc(s){ return A.esc(s); }
  function J(){ return Bu.J(); }
  function base(){ return A.CFG.NODE_JOURNAL + "/"; }
  function estAdmin(){ try { return typeof _userdata!=="undefined" && _userdata.user_level===1; } catch(e){ return false; } }
  function bouton(b, libelle, attrs, cls){
    return '<button class="tdlhc-btn ' + (cls || "creux petit") + '" type="button" data-b="' + b + '"' + (attrs || "") + '>' + esc(libelle) + '</button>';
  }
  /* somme retenue au dépôt pour cet élément, d'après l'archive */
  function payeDe(id){ var a = (J().archive || {})[id]; return a && a.montant < 0 ? -a.montant : 0; }

  /* ===================== RENDER ===================== */
  function lignes(n){
    var l = J()[n] || {}, ids = Object.keys(l).filter(function(k){ return l[k]; })
      .sort(function(a, b){ return A.ms(l[b].publie) - A.ms(l[a].publie); });
    if (!ids.length) return '<div class="tdlhc-chargement">' + esc(TXT.VIDE) + '</div>';
    return ids.map(function(k){
      var x = l[k], paye = payeDe(k), att = ' data-n="' + n + '" data-id="' + esc(k) + '"';
      return '<div class="tdlhc-row"><div class="tdlhc-row-txt"><h5>' + esc(x.titre || x.texte || "") + '</h5><p>'
        + esc(TXT.LIGNE(x.auteur || "", A.dateLisible(x.publie), x.expire ? A.dateLisible(x.expire) : "")) + '</p></div>'
        + '<div class="tdlhc-row-btns">' + bouton("hors-ligne", TXT.RETIRER, att)
        + (paye ? bouton("hors-ligne", TXT.REMBOURSER, att + ' data-remb="1"') : "") + '</div></div>';
    }).join("");
  }
  function panReset(){
    if (!estAdmin()) return '<div class="tdlhc-form"><p class="tdlhc-aide">' + esc(TXT.RESET_ADMIN) + '</p>'
      + bouton("cache", TXT.CACHE, "", "creux") + '<p class="tdlhc-aide">' + esc(TXT.CACHE_AIDE) + '</p></div>';
    return '<div class="tdlhc-form"><p class="tdlhc-act-txt">' + esc(TXT.RESET_INTRO) + '</p>'
      + RESET.map(function(r){
          return '<label class="tdlhc-coche"><input type="checkbox" data-reset="' + r[0] + '"' + (r[3] ? " checked" : "") + '>'
            + '<span><b>' + esc(r[1]) + '</b> — ' + esc(r[2]) + '</span></label>';
        }).join("")
      + bouton("reset", TXT.RESET_BTN, "", "creux danger")
      + '<div class="tdlhc-sep"></div>' + bouton("cache", TXT.CACHE, "", "creux") + '<p class="tdlhc-aide">' + esc(TXT.CACHE_AIDE) + '</p></div>';
  }
  function vue(sec){
    var tabs = NOEUDS.concat([["reset", TXT.RESET]]);
    sec.innerHTML = '<div class="tdlhc-plein"><div class="tdlhc-ariane-bar"><div class="tdlhc-ariane">Bureau · <b>' + esc(TXT.TITRE) + '</b></div>'
      + '<div class="tdlhc-cpt">' + esc(TXT.SOUS) + '</div></div><div class="tdlhc-onglets">' + tabs.map(function(t, i){
        return '<div class="tdlhc-onglet' + (i ? "" : " on") + '" data-pan="el-' + t[0] + '">' + esc(t[1]) + '</div>';
      }).join("") + '</div>'
      + NOEUDS.map(function(n, i){ return '<div class="tdlhc-pan" data-pan="el-' + n[0] + '"' + (i ? " hidden" : "") + '><div class="tdlhc-rows">' + lignes(n[0]) + '</div></div>'; }).join("")
      + '<div class="tdlhc-pan" data-pan="el-reset" hidden>' + panReset() + '</div></div>';
  }

  /* ===================== ACTIONS ===================== */
  async function horsLigne(id, b){
    var n = b.getAttribute("data-n"), k = b.getAttribute("data-id"), x = (J()[n] || {})[k]; if (!x) return;
    var remb = b.hasAttribute("data-remb") ? payeDe(k) : 0, titre = x.titre || x.texte || "";
    if (!window.confirm(remb ? TXT.CONF_REMB(titre, remb, x.auteur) : TXT.CONF_RETIRER(titre))) return;
    var m = {}; m[base() + n + "/" + k] = null;
    if ((J().archive || {})[k]) m[base() + "archive/" + k + "/retire"] = new Date().toISOString();
    if (remb) m[base() + "caisse/" + k + "-depot/etat"] = "rembourse";
    try { await Bu.ecrire(m); } catch(e){ A.toast(TXT.ERR); return; }
    var msg = TXT.OK_RETIRE;
    if (remb) {
      try { await Bu.crediter(x.auteur, remb); msg = TXT.OK_REMB(remb, x.auteur); }
      catch(e){ var r = {}; r[base() + "caisse/" + k + "-depot/etat"] = "a_rembourser"; Bu.ecrire(r).catch(function(){}); msg = TXT.ERR_REMB; }
    }
    A.toast(msg); await Bu.rafraichir();
  }
  async function reinitialiser(id, b){
    if (!estAdmin()) { A.toast(TXT.RESET_ADMIN); return; }
    var choix = {}, libelles = [];
    Array.prototype.forEach.call(b.closest(".tdlhc-form").querySelectorAll("[data-reset]:checked"), function(c){
      choix[c.getAttribute("data-reset")] = 1;
      RESET.forEach(function(r){ if (r[0]===c.getAttribute("data-reset")) libelles.push(r[1].toLowerCase()); });
    });
    if (!libelles.length) { A.toast(TXT.RESET_RIEN); return; }
    if ((window.prompt(TXT.RESET_PROMPT(libelles.join(", "))) || "").trim()!==MOT) { A.toast(TXT.RESET_ANNULE); return; }
    await Bu.lire();
    var j = J(), m = {}, rendre = {}, total = 0;
    if (choix.publications) ["annonces", "prelien", "rumeurs"].forEach(function(n){ m[base() + n] = null; });
    if (choix.soumissions) {
      Object.keys(j.soum_meta || {}).forEach(function(k){
        var s = j.soum_meta[k];
        if (!s || !(s.montant < 0) || !EN_ATTENTE[s.statut]) return;
        rendre[s.auteur] = (rendre[s.auteur] || 0) - s.montant; total -= s.montant;
        if (!choix.caisse) m[base() + "caisse/" + k + "-depot/etat"] = "rembourse";   /* pas de chemins imbriqués dans une même écriture */
      });
      m[base() + "soum_meta"] = null; m[base() + "soum_corps"] = null;
    }
    ["archive", "badges", "caisse", "affaires"].forEach(function(n){ if (choix[n]) m[base() + n] = null; });
    try { await Bu.ecrire(m); } catch(e){ if (window.console) console.error("[Courier] réinitialisation", e); A.toast(TXT.ERR); return; }
    for (var p in rendre) { if (rendre.hasOwnProperty(p)) { try { await Bu.crediter(p, rendre[p]); } catch(e){ total -= rendre[p]; } } }
    A.toast(TXT.RESET_OK(libelles.join(", "), total)); await Bu.rafraichir();
  }
  function oublierCache(){
    try { Object.keys(sessionStorage).forEach(function(k){ if (k.indexOf("tdlhc:")===0) sessionStorage.removeItem(k); }); } catch(e){}
    location.reload();
  }

  /* ===================== INIT ===================== */
  function demarrer(){
    var C = window.Courier; A = C.api; Bu = C.bureau;
    Bu.vues.enligne = vue;
    Bu.actions["hors-ligne"] = horsLigne;
    Bu.actions.reset = reinitialiser;
    Bu.actions.cache = oublierCache;
  }
  (function attendre(n){
    if (window.Courier && window.Courier.bureau && window.Courier.bureau.crediter) { demarrer(); return; }
    if ((n||0) < 60) setTimeout(function(){ attendre((n||0)+1); }, 250);
  })();
})();
