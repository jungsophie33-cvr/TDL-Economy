/* THE DROWNED LANDS — LES ÉVÉNEMENTS · VERSEMENT AUX JAUGES
   Le pont entre une conclusion d'évent et le moteur des jauges.

   CE QUE CE FICHIER FAIT
     - LIGNES  : traduit une conclusion en une ou deux lignes de versement
                 { jauge, sens, points, bascule, motif }. Le poids vient de
                 TDLEv.poids() : le staff choisit la jauge et le sens, jamais
                 le poids.
     - VERROU  : le chemin du drapeau `versee` de la conclusion, propre à son
                 origine (fiche native ou entrée de tableau reprise).
     - APERÇU  : la phrase affichée sous chaque ligne du formulaire de
                 clôture, recalculée à chaque changement, sur l'état RÉEL des
                 jauges (décrue et passage différé compris).
     - LECTURE : lit les lignes de jauge du formulaire de clôture et refuse
                 une bascule sans motif ou une secondaire incohérente.
     - VERSER  : appelle le moteur et rend le bilan lisible.

   Une conclusion qui porte une jauge mais aucun drapeau `versee` n'a jamais
   été versée — le verrou n'a pas pu être pris, ou la page s'est fermée entre
   l'écriture et le versement. Elle revient dans « À traiter », marquée
   « Versement ».

   EXPOSE : window.TDLEvJauges
   DÉPEND DE : window.TDLEv, window.TDLEvUI, window.TDLJauges,
               window.TDLJaugesMoteur
   À CHARGER : après tdlev-staff-vues, avant tdlev-staff

   CARTE DES BLOCS : TEXTES · OUTILS · LIGNES · APERÇU · LECTURE · VERSEMENT
                     · EXPORT */

(function () {
"use strict";

function V(){ return window.TDLEv; }
function U(){ return window.TDLEvUI; }
function J(){ return window.TDLJauges; }
function M(){ return window.TDLJaugesMoteur; }

/* ===================== TEXTES ===================== */

var T = {
  POIDS:    "Impact de cet évent : ",
  POIDS2:   "Jauge secondaire, moitié de la valeur d'impact de la jauge principale : ",
  BASCULE:  "Bascule : l'impact est ignoré. ",
  DEJA:     "Cette conclusion avait déjà été versée aux jauges : rien n'a bougé.",
  ECHEC:    "Le versement de « {j} » a échoué après la prise du verrou : la conclusion "
          + "est marquée versée, corrigez la jauge depuis le panneau des jauges.",
  VERROU:   "Le versement aux jauges n'a pas pu commencer : rien n'a bougé. "
          + "La conclusion reste dans « À traiter », marquée « Versement ».",
  ABSENT:   "Le moteur des jauges n'est pas chargé sur cette page.",
  E_MOTIF:  "Une bascule demande un motif.",
  E_SEC:    "Choisissez d'abord la jauge principale.",
  E_DOUBLE: "La jauge secondaire doit être différente de la principale.",
  /* une jauge choisie sur un évent sans poids : erreur de configuration
     (diff de tdlev-core ou de tdlev-sources absent), jamais un choix */
  E_POIDS:  "« {j} » est choisie, mais ce type d'évent n'a aucun impact déclaré "
          + "(tdlev-core ou tdlev-sources). Rien n'a été écrit.",
  E_POIDS_V:"Versement impossible : ce type d'évent n'a aucun impact déclaré "
          + "(tdlev-core ou tdlev-sources)."
};

/* ===================== OUTILS ===================== */

var _etats = {};          /* jauges/ brut, tel que lu ; recalculé à l'aperçu */

function pret(){
  return !!(V() && typeof V().poids === "function" && J() && J().verser && M() && M().pret());
}

/* Une lecture ciblée de la branche jauges, à l'ouverture du panneau et après
   chaque versement. */
function charger(){
  if (!pret()) return Promise.resolve(_etats);
  return M().lireBrut().then(function (j) { _etats = j; return j; },
                             function () { return _etats; });
}

/* ===================== LIGNES ===================== */

function ligne(c, ev, s){
  var j = c["jauge" + s];
  if (!j || j === "aucune") return null;
  var l = { jauge: j, sens: c["sens" + s] || "aggrave",
            points: V().poids(ev, s === "2"), bascule: !!c["bascule" + s],
            motif: c["motif" + s] || "" };
  return l;
}

/* Une ligne qui ne pèse rien sans bascule : le poids manque à la config. */
function sansPoids(c, ev){
  var l = lignes(c, ev).filter(function (x) { return !x.bascule && !(x.points > 0); })[0];
  return l ? T.E_POIDS.replace("{j}", (J().CFG[l.jauge] || {}).label || l.jauge) : "";
}

function lignes(c, ev){
  if (!c || c.classee) return [];
  return [ligne(c, ev, ""), ligne(c, ev, "2")].filter(Boolean);
}

/* firebaseTransaction construit une URL : identifiant encodé. */
function verrou(ev){
  var id = encodeURIComponent(ev.id);
  return (ev.origine === "tableau")
    ? V().CFG.NODE_CONCL + "/" + id + "/versee"
    : V().CFG.NODE + "/" + id + "/conclusion/versee";
}

/* Conclue, porteuse d'au moins une ligne, jamais versée. */
function aVerser(ev){
  var c = ev && ev.conclusion;
  if (!pret()) return false;
  if (!c || c.classee || c.versee === true) return false;
  if (ev.origine !== "tableau" && ev.statut !== "cloture") return false;
  return lignes(c, ev).length > 0;
}

/* ===================== APERÇU ===================== */

function texte(l, secondaire){
  if (!pret()) return T.ABSENT;
  if (!l.bascule && !(l.points > 0)) return T.E_POIDS_V;
  var r = J().verser(_etats[l.jauge], l);
  return (l.bascule ? T.BASCULE : (secondaire ? T.POIDS2 : T.POIDS) + J().fraction(l.points) + ". ")
    + J().decrire(l.jauge, r);
}

/* Les deux lignes d'une conclusion déjà enregistrée, pour la file. */
function resume(ev){
  var c = ev.conclusion || {};
  if (!pret()) return [T.ABSENT];
  return lignes(c, ev).map(function (l, i) { return texte(l, i === 1); });
}

/* Branche le formulaire de clôture : le motif suit la case de bascule, et
   l'aperçu suit la jauge, le sens et la bascule de sa ligne. */
function brancher(racine, ev){
  ["", "2"].forEach(function (s) {
    var j = racine.querySelector("#tdlev-c-jauge" + s);
    var ap = racine.querySelector("#tdlev-c-apercu" + s);
    if (!j || !ap) return;
    var sens = racine.querySelector("#tdlev-c-sens" + s);
    var basc = racine.querySelector("#tdlev-c-basc" + s);
    var bloc = racine.querySelector("#tdlev-c-motif-bloc" + s);

    function maj(){
      if (bloc && basc) bloc.hidden = !basc.checked;
      var l = { jauge: j.value, sens: sens ? sens.value : "aggrave",
                points: pret() ? V().poids(ev, s === "2") : 0,
                bascule: !!(basc && basc.checked) };
      if (!l.jauge || l.jauge === "aucune") {
        ap.textContent = (s === "2" ? T.POIDS2 : T.POIDS) + (pret() ? J().fraction(l.points) : "—") + ".";
        return;
      }
      ap.textContent = texte(l, s === "2");
    }
    [j, sens, basc].forEach(function (x) { if (x) x.addEventListener("change", maj); });
    maj();
  });
}

/* ===================== LECTURE ===================== */

function lireLigne(c, s){
  var j = U().val("tdlev-c-jauge" + s) || "aucune";
  c["jauge" + s] = j;
  if (j === "aucune") return "";
  c["sens" + s] = U().val("tdlev-c-sens" + s) || "aggrave";
  if (!U().coche("tdlev-c-basc" + s)) return "";
  c["bascule" + s] = true;
  c["motif" + s] = String(U().val("tdlev-c-motif" + s) || "").trim();
  return c["motif" + s] ? "" : T.E_MOTIF;
}

/* Remplit les champs de jauge de la conclusion c depuis le formulaire.
   opts = { sansJauge, double }. → "" si tout va bien, sinon l'erreur. */
function lire(c, opts){
  opts = opts || {};
  c.jauge = "aucune";
  if (opts.sansJauge) return "";
  var e = lireLigne(c, "");
  if (e) return e;
  var j2 = U().val("tdlev-c-jauge2") || "aucune";
  if (!opts.double || j2 === "aucune") return "";
  if (c.jauge === "aucune") return T.E_SEC;
  if (j2 === c.jauge) return T.E_DOUBLE;
  return lireLigne(c, "2");
}

/* ===================== VERSEMENT ===================== */

/* → Promise<string> : le bilan à afficher. Ne rejette jamais : un échec se
   dit dans le bilan. */
function verser(ev, c){
  if (!pret()) return Promise.resolve(T.ABSENT);
  var ls = lignes(c, ev);
  if (!ls.length) return Promise.resolve("");
  if (sansPoids(c, ev)) return Promise.resolve(T.E_POIDS_V);
  /* une exception avant la prise du verrou ne doit pas se perdre en silence */
  return Promise.resolve().then(function () {
    return M().verserConclusion(verrou(ev), { id: ev.id, titre: ev.titre }, ls);
  })
    .then(function (b) {
      if (b.deja) return T.DEJA;
      return charger().then(function () {
        return b.resultats.map(function (x) {
          return x.erreur ? T.ECHEC.replace("{j}", (J().CFG[x.jauge] || {}).label || x.jauge)
                          : J().decrire(x.jauge, x.res);
        }).join(" ");
      });
    }, function () { return T.VERROU; });
}

/* ===================== EXPORT ===================== */

window.TDLEvJauges = {
  T: T, pret: pret, charger: charger,
  lignes: lignes, verrou: verrou, aVerser: aVerser,
  resume: resume, brancher: brancher, lire: lire, verser: verser,
  sansPoids: sansPoids
};

})();
