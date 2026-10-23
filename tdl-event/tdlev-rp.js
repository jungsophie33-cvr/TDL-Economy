/* THE DROWNED LANDS — LES ÉVÉNEMENTS · SUJETS RATTACHÉS ET RAPPELS
   Trois gestes courts, qui n'avaient pas leur place dans le volet de demande :

     - rattacher un RP à une fiche qui l'autorise (intrigue, évent du staff) ;
     - rejoindre un sujet déjà rattaché ;
     - demander à être prévenu de l'ouverture d'un évent annoncé.

   Une fiche n'accepte de RP que si le staff a coché « permettre aux membres
   de contribuer via leurs topics RP », et seuls ses inscrits peuvent le faire :
   un sujet rattaché engage la fiche, il ne s'ajoute pas depuis l'extérieur.

   EXPOSE : window.TDLEvRp
   DÉPEND DE : window.TDLEv, window.TDLEvUI, window.TDLEvPublic, window.TDLBase
   À CHARGER : après tdlev-volet

   CARTE DES BLOCS : TEXTES · VOLET · ÉCRITURE · ÉVÉNEMENTS · INIT */

(function () {
"use strict";

var V = null, U = null, VOL = null, VEIL = null, CIBLE = null;

/* ===================== TEXTES ===================== */

var T = {
  TITRE:    "Joindre un RP",
  INTRO:    "Le sujet RP apparaîtra sur le descriptif de l'évent, ainsi que ses joueurs. "
          + "Les autres inscrits pourront s'y joindre.",
  F_TITRE:  "Titre du sujet",
  F_TITRE_A:"Tel qu'il s'affiche sur le forum.",
  F_URL:    "URL du sujet",
  F_URL_A:  "Collez l'adresse complète, elle doit commencer par https://",
  ANNULER:  "Annuler", VALIDER:"Joindre",
  E_TITRE:  "Donnez un titre au sujet.",
  E_URL:    "L'adresse du sujet n'est pas valide.",
  E_DEJA:   "Ce sujet est déjà rattaché à cet évent.",
  E_ECRIT:  "Écriture impossible. Réessayez dans un instant.",
  OK_RAT:   "Sujet joint.",
  OK_JOIN:  "Vous avez rejoint ce sujet.",
  OK_RAPPEL:"C'est noté : vous serez prévenu à l'ouverture.",
  DEJA_RAP: "Vous êtes déjà sur la liste des rappels.",
  E_FERME:  "Cet évent n'accepte pas de sujet joint.",
  E_INSCRIT:"Inscrivez-vous à l'événement avant d'y joindre un sujet."
};

/* ===================== VOLET ===================== */

function monter(){
  if (VOL) return;
  VEIL = document.createElement("div");
  VEIL.className = "tdlev-veil"; VEIL.hidden = true;
  VOL = document.createElement("aside");
  VOL.className = "tdlev-vol"; VOL.hidden = true;
  VOL.innerHTML =
      '<header class="tdlev-vol-h"><h2>' + T.TITRE + '</h2>'
    + '<button class="tdlev-vol-x" data-rp="fermer" title="Fermer">'
    + U.fit("cross-small") + '</button></header>'
    + '<div class="tdlev-vol-c" id="tdlev-rp-c"></div>'
    + '<footer class="tdlev-vol-p">'
    + '<button class="tdlev-btn est-fantome" data-rp="fermer">' + T.ANNULER + '</button>'
    + '<span class="tdlev-vol-p-txt"></span>'
    + '<button class="tdlev-btn" data-rp="valider">' + T.VALIDER + '</button></footer>';
  document.body.appendChild(VEIL);
  document.body.appendChild(VOL);
  VEIL.addEventListener("click", function(){ ouvrir(false); });
  VOL.addEventListener("click", surClic);
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && VOL && !VOL.hidden) ouvrir(false);
  });
}

function ouvrir(o){
  if (!VOL) return;
  if (o){
    VEIL.hidden = false; VOL.hidden = false;
    requestAnimationFrame(function(){
      VEIL.classList.add("est-ouvert"); VOL.classList.add("est-ouvert");
    });
  } else {
    VEIL.classList.remove("est-ouvert"); VOL.classList.remove("est-ouvert");
    setTimeout(function(){ VEIL.hidden = true; VOL.hidden = true; }, 300);
    CIBLE = null;
  }
}

function rendre(ev){
  CIBLE = ev;
  document.getElementById("tdlev-rp-c").innerHTML =
      '<p class="tdlev-vol-h2">' + V.esc(ev.titre) + '</p>'
    + '<p class="tdlev-vol-note" style="margin-top:0">' + T.INTRO + '</p>'
    + U.champ(T.F_TITRE, V.esc(T.F_TITRE_A), U.texte("tdlev-rp-titre"))
    + U.champ(T.F_URL, V.esc(T.F_URL_A),
        U.texte("tdlev-rp-url", "", "https://thedrownedlands.forumactif.com/t000-..."));
  ouvrir(true);
}

/* ===================== ÉCRITURE ===================== */

function inscrit(ev){
  var p = V.monPseudo();
  return !!(p && ev && ev.participants && ev.participants[V.cle(p)]);
}

function rattacher(){
  var ev = CIBLE; if (!ev) return;
  var titre = U.val("tdlev-rp-titre"), url = U.val("tdlev-rp-url");
  if (!titre){ U.toast(T.E_TITRE); return; }
  if (!/^https?:\/\/\S+$/.test(url)){ U.toast(T.E_URL); return; }

  var deja = V.cles(ev.rps).some(function(k){ return (ev.rps[k] || {}).url === url; });
  if (deja){ U.toast(T.E_DEJA); return; }

  var p = V.monPseudo(), id = V.nouvelId(), champs = {};
  champs["rps/" + id] = {
    titre:titre, url:url, par:p, le:V.maintenant(),
    participants:U.versNoeud([p])
  };
  window.TDLBase.ecrire(V.CFG.NODE, ev.id, champs, "sujet rattaché à " + ev.titre)
    .then(function(ok){
      if (!ok){ U.toast(T.E_ECRIT); return; }
      /* le référent est prévenu : c'est son arc qui s'enrichit */
      if (ev.referent && ev.referent !== p)
        U.notifier(ev.referent, V.NOTIF.RP, { titre:ev.titre, pseudo:p });
      U.toast(T.OK_RAT); ouvrir(false); window.TDLEvPublic.rafraichir();
    });
}

function rejoindre(ev, cle){
  var p = V.monPseudo(); if (!p || !ev || !cle) return;
  var champs = {};
  champs["rps/" + cle + "/participants/" + V.cle(p)] = { nom:p };
  window.TDLBase.ecrire(V.CFG.NODE, ev.id, champs, "jonction d'un sujet de " + ev.titre)
    .then(function(ok){
      U.toast(ok ? T.OK_JOIN : T.E_ECRIT);
      if (ok) window.TDLEvPublic.rafraichir();
    });
}

/* Le rappel est une simple feuille : à l'ouverture, le panneau de gestion
   parcourt la liste et notifie. Rien de périodique, rien à surveiller. */
function rappel(ev){
  var p = V.monPseudo(); if (!p || !ev) return;
  if (ev.rappels && ev.rappels[V.cle(p)]){ U.toast(T.DEJA_RAP); return; }
  var champs = {};
  champs["rappels/" + V.cle(p)] = { nom:p, le:V.maintenant() };
  window.TDLBase.ecrire(V.CFG.NODE, ev.id, champs, "rappel sur " + ev.titre)
    .then(function(ok){
      U.toast(ok ? T.OK_RAPPEL : T.E_ECRIT);
      if (ok) window.TDLEvPublic.rafraichir();
    });
}

/* ===================== ÉVÉNEMENTS ===================== */

function surClic(e){
  var b = e.target.closest ? e.target.closest("button") : null;
  if (!b || !VOL.contains(b)) return;
  if (b.dataset.rp === "fermer"){ ouvrir(false); return; }
  if (b.dataset.rp === "valider") rattacher();
}

/* ===================== INIT ===================== */

function demarrer(){
  V = window.TDLEv; U = window.TDLEvUI;
  if (!V || !U || !window.TDLEvPublic || !window.TDLEvPublic.racine()){
    setTimeout(demarrer, 300); return;
  }
  monter();
  document.addEventListener("tdlev:action", function(e){
    var d = e.detail || {}, ev = d.evenement;
    if (!ev) return;
    if (d.act === "rattacher"){
      if (!ev.rpOuvert){ U.toast(T.E_FERME); return; }
      if (!inscrit(ev)){ U.toast(T.E_INSCRIT); return; }
      rendre(ev);
    } else if (d.act === "rejoindreRp"){
      if (!inscrit(ev)){ U.toast(T.E_INSCRIT); return; }
      rejoindre(ev, d.arg);
    } else if (d.act === "rappel"){
      rappel(ev);
    }
  });
}

if (document.readyState === "complete") setTimeout(demarrer, 0);
else window.addEventListener("load", function(){ setTimeout(demarrer, 0); });

window.TDLEvRp = { rattacher:rendre, rejoindre:rejoindre, rappel:rappel };

})();
