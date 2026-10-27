/* THE DROWNED LANDS — LES ÉVÉNEMENTS · PANNEAU DE GESTION
   Réservé au staff. Trois sections : À traiter, Les fiches, Classées.

   LA FILE À TRAITER mêle quatre natures d'entrées, distinguées par un
   marqueur : les demandes appuyées, les évents en cours qui attendent leur
   clôture, les entrées de tableaux CLOSES dans leur tableau et sans
   conclusion — une mission qui se joue encore n'y figure jamais —, et les
   conclusions qui portent une jauge sans avoir été versées.
   Une seule liste, parce que ce qui les réunit est le même geste : décider.
   Les évents en cours y figurent TOUS : c'est la seule façon qu'aucun ne se
   perde, et le staff juge lesquels sont mûrs.

   JAUGES : la clôture écrit la conclusion, PUIS la verse aux jauges par
   tdlev-jauges.js. L'écriture part sans file de réessai : si elle échoue,
   rien n'est écrit ni versé et le staff recommence. Une conclusion écrite
   dont le versement n'a pas pu commencer revient en « Versement ».

   CE QUE LE PANNEAU NE FAIT PAS : poser un badge à la main (le catalogue
   décide), ni modifier les données d'une mission (elles appartiennent à son
   tableau). Seule la conclusion — jauges et réputation — se décide ici.

   Le panneau est en position:fixed et reparenté sur <body> — couche 9010,
   donc sous le volet, pour qu'une édition ouverte par-dessus reste visible.

   EXPOSE : window.TDLEvStaff
   DÉPEND DE : window.TDLEv, window.TDLEvUI, window.TDLEvVues,
               window.TDLEvJauges, window.TDLEvPublic, window.TDLBase

   CARTE DES BLOCS : CONFIG · COQUE · FILE · TRAVAIL · ÉVÉNEMENTS
                     · LECTURE · ÉCRITURE · INIT */

(function () {
"use strict";

/* ===================== CONFIG ===================== */

var V = null, U = null, W = null, X = null, T = null, GEST = null;
var S = { sect:"traiter", sel:null, portees:[], visi:[], neuve:false };

/* ===================== COQUE ===================== */

function monter(){
  if (GEST) return;
  GEST = document.createElement("section");
  GEST.className = "tdlev-gest"; GEST.hidden = true;
  GEST.setAttribute("aria-label", T.TITRE);
  GEST.innerHTML =
      '<header class="tdlev-g-mastic">'
    +   '<div><button class="tdlev-txt-btn" data-g="fermer">' + U.fit("angle-left")
    +     '<span>' + T.RETOUR + '</span></button></div>'
    +   '<h2>' + T.TITRE + '</h2>'
    +   '<div style="justify-self:end"><button class="tdlev-txt-btn est-plein" data-g="neuve">'
    +     U.fit("plus-small") + '<span>' + T.NOUVELLE + '</span></button></div>'
    + '</header>'
    + '<div class="tdlev-g-corps">'
    +   '<nav class="tdlev-g-nav" id="tdlev-g-nav"></nav>'
    +   '<div class="tdlev-g-col">'
    +     '<div class="tdlev-g-col-h"><b id="tdlev-g-nom"></b>'
    +       '<span class="tdlev-g-e-d" id="tdlev-g-nb"></span></div>'
    +     '<div class="tdlev-g-liste" id="tdlev-g-liste"></div>'
    +   '</div>'
    +   '<div class="tdlev-g-trav">'
    +     '<div class="tdlev-g-trav-c" id="tdlev-g-trav"></div>'
    +     '<div class="tdlev-g-trav-p" id="tdlev-g-pied"></div>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(GEST);
  GEST.addEventListener("click", surClic);
}
function $(id){ return document.getElementById(id); }

/* ===================== FILE ===================== */

function items(sect){
  var out = [], s = sect || S.sect;
  if (s === "traiter"){
    V.D.demandes.forEach(function(d){
      if (d.statut !== "file" && d.statut !== "precisions") return;
      out.push({ nature:"demande", id:"d:" + d.id, obj:d, titre:d.titre,
        src:(V.CATEGORIES[d.categorie] || {}).nom + " · " + d.demandeur,
        date:V.ilya(d.cree), tri:d.cree });
    });
    V.D.evenements.forEach(function(e){
      if (e.statut === "cloture" || e.doublon) return;
      out.push({ nature:"cloture", id:"e:" + e.id, obj:e, titre:e.titre,
        src:(V.CATEGORIES[e.categorie] || {}).nom + (e.referent ? " · " + e.referent : "")
          + (e.aClore ? " · " + T.CLORE_DEM : ""),
        date:V.ilya(e.cree), tri:e.cree, urgent:!!e.aClore });
    });
    /* Une entrée de tableau n'entre dans la file qu'une fois CLOSE chez elle
       et sans conclusion : tant qu'elle se joue, le staff n'a rien à décider. */
    V.D.reprises.forEach(function(r){
      if (!r.aConclure) return;
      out.push({ nature:"tableau", id:"r:" + r.id, obj:r, titre:r.titre,
        src:r.source, date:V.ilya(r.cree), tri:r.cree });
    });
    /* Une conclusion qui porte une jauge et n'a jamais été versée. */
    if (X) V.D.evenements.concat(V.D.reprises).forEach(function(e){
      if (e.doublon || !X.aVerser(e)) return;
      out.push({ nature:"versement", id:"v:" + e.id, obj:e, titre:e.titre,
        src:e.source || (V.CATEGORIES[e.categorie] || {}).nom,
        date:V.ilya(e.conclusion.le), tri:e.conclusion.le, urgent:true });
    });
  } else if (s === "fiches"){
    V.D.evenements.forEach(function(e){
      out.push({ nature:"fiche", id:"e:" + e.id, obj:e, titre:e.titre,
        src:e.doublon ? T.DOUBLON
          : (V.CATEGORIES[e.categorie] || {}).nom + (e.statut === "cloture" ? " · terminé" : ""),
        date:V.ilya(e.modifie || e.cree), tri:e.modifie || e.cree });
    });
  } else {
    V.D.reprises.forEach(function(r){
      if (!r.classee) return;
      out.push({ nature:"tableau", id:"r:" + r.id, obj:r, titre:r.titre,
        src:r.source, date:"", tri:"" });
    });
  }
  /* du plus récent au plus ancien, dans les trois sections */
  out.sort(function(a, b){
    if (!!a.urgent !== !!b.urgent) return a.urgent ? -1 : 1;
    return String(b.tri || "").localeCompare(String(a.tri || ""));
  });
  return out;
}
function parId(id){
  var l = items();
  for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
  return null;
}

function rendNav(){
  $("tdlev-g-nav").innerHTML = T.SECTIONS.map(function(x){
    return '<button class="tdlev-g-sect" data-sect="' + x.id + '"'
      + ' aria-pressed="' + (S.sect === x.id) + '">'
      + U.fit(x.ico) + '<b>' + x.nom + '</b><em>' + items(x.id).length + '</em></button>';
  }).join("");
}

function rendListe(){
  rendNav();
  var l = items(), box = $("tdlev-g-liste");
  $("tdlev-g-nom").textContent = T.SECTIONS.filter(function(x){ return x.id === S.sect; })[0].nom;
  $("tdlev-g-nb").textContent = l.length + " " + (l.length > 1 ? T.ENTREES : T.ENTREE);

  if (!l.length){
    box.innerHTML = '<p class="tdlev-vide">' + T.RIEN + '</p>';
    if (!S.neuve) travail(null);
    return;
  }
  if (!S.neuve && (!S.sel || !parId(S.sel))) S.sel = l[0].id;

  box.innerHTML = l.map(function(i){
    return '<button class="tdlev-g-e" data-gid="' + V.esc(i.id) + '"'
      + ' aria-current="' + (!S.neuve && i.id === S.sel) + '">'
      + '<span class="tdlev-marq est-' + i.nature + '">' + T.MARQ[i.nature] + '</span>'
      + '<span class="tdlev-g-e-t">' + V.esc(i.titre) + '</span>'
      + '<span class="tdlev-g-e-d">' + V.esc(i.src) + '</span></button>';
  }).join("");
  if (!S.neuve) travail(parId(S.sel));
}

/* ===================== TRAVAIL ===================== */

function tete(i){
  return '<div class="tdlev-g-tete">'
    + '<span class="tdlev-marq est-' + i.nature + '">' + T.MARQ[i.nature] + '</span>'
    + '<span class="tdlev-g-e-d">' + V.esc(i.src) + '</span>'
    + (i.date ? '<span class="tdlev-g-e-d">' + V.esc(i.date) + '</span>' : '')
    + '<h3>' + V.esc(i.titre) + '</h3></div>';
}
function bouton(act, lib, creux){
  return '<button class="tdlev-btn' + (creux ? " est-fantome" : "") + '" data-g="' + act + '">'
    + lib + '</button>';
}
/* Ce que le formulaire de clôture propose : aucune jauge pour un
   Organisateur, une jauge secondaire pour une intrigue seulement. */
function optsDe(i){
  var o = i && i.obj;
  if (!o || i.nature !== "cloture") return {};
  return { sansJauge:o.ampleur === false, double:o.categorie === "intrigue" };
}

function remplir(i){
  if (S.neuve) return { h:W.fiche(null, S.portees, S.visi),
    p:'<span class="tdlev-vol-p-txt"></span>' + bouton("creer", T.CREER) };

  var o = i.obj;
  if (i.nature === "demande") return { h:W.dossierDemande(o),
    p:bouton("refuser", T.REFUSER, 1) + bouton("precisions", T.PRECISIONS, 1)
      + '<span class="tdlev-vol-p-txt"></span>' + bouton("accepter", T.ACCEPTER) };

  if (i.nature === "cloture") return {
    h: W.liens(V.cles(o.rps).map(function(k){ var r = o.rps[k] || {}; return [r.titre, r.url]; }))
     + W.participants(o, T.PARTS, T.PARTS_N, false)
     + W.conclusion(o.conclusion, optsDe(i)),
    p: '<span class="tdlev-vol-p-txt">' + T.CLOT_NOTE + '</span>'
     + bouton("liberer", T.LIBERER, 1) + bouton("cloturer", T.CLOTURER) };

  if (i.nature === "versement") return {
    h: '<p class="tdlev-f-h">' + T.VERS_H + '</p>'
     + '<p class="tdlev-g-note">' + T.VERS_N + '</p>'
     + X.resume(o).map(function(t){ return '<p class="tdlev-g-note">' + V.esc(t) + '</p>'; }).join(""),
    p: '<span class="tdlev-vol-p-txt"></span>' + bouton("verser", T.VERSER) };

  if (i.nature === "tableau" && S.sect === "classees") return {
    h: W.dossierReprise(o) + '<p class="tdlev-g-note">' + T.CLASSEE_N + '</p>',
    p: '<span class="tdlev-vol-p-txt"></span>' + bouton("reprendre", T.REPRENDRE) };

  if (i.nature === "tableau") return {
    h: W.dossierReprise(o)
     + '<p class="tdlev-f-h">' + T.REPERC + '</p>'
     + '<p class="tdlev-g-note">' + T.REPERC_N + '</p>'
     + W.participants(o, T.PARTS_T, T.PARTS_TN, true) + W.conclusion(o.conclusion, {}),
    p: bouton("classer", T.CLASSER, 1) + '<span class="tdlev-vol-p-txt"></span>'
     + bouton("conclure", T.ENREG_CONCL) };

  return { h:W.fiche(o, S.portees, S.visi),
    p:bouton("supprimer", T.SUPPRIMER, 1) + '<span class="tdlev-vol-p-txt"></span>'
      + bouton("enregistrer", T.ENREGISTRER) };
}

function travail(i){
  var c = $("tdlev-g-trav"), pied = $("tdlev-g-pied");
  if (!i && !S.neuve){
    c.innerHTML = '<p class="tdlev-g-vide">' + T.VIDE + '</p>'; pied.innerHTML = ""; return;
  }
  /* les pastilles sont lues depuis la fiche avant son rendu */
  if (S.neuve || (i && i.nature === "fiche")){
    var e = S.neuve ? V.normaliser({}) : i.obj;
    S.portees = W.noms(e.portees);
    S.visi    = W.noms(e.visibleA);
  }
  var r = remplir(i);
  c.innerHTML = (S.neuve ? "" : tete(i)) + r.h;
  pied.innerHTML = r.p;
  c.scrollTop = 0;
  brancher(c, i);
}

/* ===================== ÉVÉNEMENTS ===================== */

/* « Nommé » suit la case publique ; la note de jauge ne paraît que pour la
   Pression du Bayou ; l'aperçu des jauges, la bascule, les pastilles et le
   bloc de visibilité se branchent ici. */
function brancher(c, i){
  var pub = $("tdlev-c-public");
  if (pub){
    var maj = function(){
      c.querySelectorAll(".tdlev-nomme").forEach(function(x){
        x.disabled = !pub.checked;
        if (!pub.checked) x.checked = false;
      });
    };
    pub.addEventListener("change", maj); maj();
  }
  /* un sélecteur désactivé (Organisateur) garde sa note propre, toujours visible */
  var j = $("tdlev-c-jauge"), note = $("tdlev-c-note");
  if (j && note && !j.disabled){
    var majJ = function(){ note.hidden = (j.value !== V.JAUGE_SANS_REPUTATION); };
    j.addEventListener("change", majJ); majJ();
  }
  if (X && i && (i.nature === "cloture" || i.nature === "tableau")) X.brancher(c, i.obj);
  U.brancherChips(c, { gcomm:S.portees, gbandes:S.portees, gvisi:S.visi });
  var vi = $("tdlev-f-visi"), bloc = $("tdlev-f-visi-bloc");
  if (vi && bloc){
    var majV = function(){ bloc.hidden = (vi.value !== "bandes"); };
    vi.addEventListener("change", majV); majV();
  }
}

function surClic(e){
  var b = e.target.closest ? e.target.closest("button") : null;
  if (!b || !GEST.contains(b)) return;
  if (b.dataset.sect){ S.sect = b.dataset.sect; S.sel = null; S.neuve = false; rendListe(); return; }
  if (b.dataset.gid){ S.sel = b.dataset.gid; S.neuve = false; rendListe(); return; }
  if (b.dataset.url){ e.stopPropagation(); U.ouvrirLien(b.dataset.url); return; }
  if (b.dataset.g) agir(b.dataset.g);
}

/* ===================== LECTURE ===================== */

/* Le tableau des participants : les retenus, et les nommés parmi eux. */
function lireRetenus(){
  var out = {};
  GEST.querySelectorAll("[data-ret]").forEach(function(x){
    if (!x.checked) return;
    var n = GEST.querySelector('[data-nom-de="' + x.dataset.ret + '"]');
    out[x.dataset.ret] = { nom:x.dataset.nom, nomme:!!(n && n.checked) };
  });
  return out;
}
/* → la conclusion, ou { erreur } si le formulaire n'est pas cohérent. Les
   lignes de jauge (jauge, sens, bascule, motif) sont lues par tdlev-jauges,
   qui tient aussi leur aperçu. */
function lireConclusion(opts){
  var c = { issue:U.val("tdlev-c-issue") || "mitigee", jauge:"aucune",
            public:U.coche("tdlev-c-public"), texte:U.val("tdlev-c-texte"),
            le:V.maintenant(), par:V.monPseudo() };
  var err = X ? X.lire(c, opts) : "";
  return err ? { erreur:err } : c;
}
/* « libellé ; valeur » par ligne → nœud à clés */
function lireNoeud(id, champs){
  var o = {};
  U.lignes(id).forEach(function(l){
    var p = l.split(";").map(function(x){ return x.trim(); }), e = {};
    champs.forEach(function(c, i){ e[c] = p[i] || ""; });
    o[V.nouvelId()] = e;
  });
  return o;
}
function lireFiche(){
  var visi = U.val("tdlev-f-visi") || "publique";
  return {
    schema:V.SCHEMA,
    titre:U.val("tdlev-f-titre"), sous:U.val("tdlev-f-sous"),
    categorie:U.val("tdlev-f-cat") || "communautaire", periode:U.val("tdlev-f-per"),
    contexte:U.lignes("tdlev-f-ctx"), objectifs:U.lignes("tdlev-f-obj"),
    elements:lireNoeud("tdlev-f-elem", ["libelle","valeur"]),
    liens:lireNoeud("tdlev-f-liens", ["libelle","titre","url"]),
    rps:lireNoeud("tdlev-f-rps", ["titre","url"]),
    portees:U.versNoeud(S.portees), vignette:U.val("tdlev-f-vig"),
    debut:U.val("tdlev-f-debut") || null, ouvert:U.coche("tdlev-f-ouvert"),
    aLaUne:parseInt(U.val("tdlev-f-une"), 10) || null,
    rpOuvert:U.coche("tdlev-f-rp"),
    visibilite:visi, visibleA:(visi === "bandes") ? U.versNoeud(S.visi) : null,
    modifie:V.maintenant()
  };
}

/* ===================== ÉCRITURE ===================== */

function fin(ok, msg){
  U.toast(ok ? msg : T.E_ECRIT);
  if (ok) window.TDLEvPublic.rafraichir().then(rendListe);
}

/* Une conclusion qui doit bouger une jauge exige le moteur sur la page :
   sans lui, on n'écrit rien plutôt que d'écrire une conclusion inerte. */
function verifier(c, o){
  if (c.erreur){ U.toast(c.erreur); return false; }
  var choisie = (U.val("tdlev-c-jauge") || "aucune") !== "aucune";
  if (choisie && (!X || !X.pret())){ U.toast(T.E_MOTEUR); return false; }
  return true;
}
/* Écriture d'abord, sans file de réessai ; versement ensuite. */
function conclureEtVerser(ecriture, o, c, msgOk, apres){
  ecriture.then(function(ok){
    if (!ok){ U.toast(T.E_ECRIT); return; }
    if (apres) apres();
    var v = (X && !c.classee) ? X.verser(o, c) : Promise.resolve("");
    return v.then(function(bilan){ fin(true, msgOk + (bilan ? " " + bilan : "")); });
  });
}

function accepter(d, B){
  var f = { schema:V.SCHEMA, origine:"demande", categorie:d.categorie,
    titre:d.titre, sous:d.sous, contexte:d.contexte, objectifs:d.objectifs,
    portees:d.portees, projet:d.projet || null,
    referent:(d.role === "idee") ? null : d.demandeur,
    mj:(d.role === "mj") ? d.demandeur : null,
    statut:"en_cours", ouvert:true, visibilite:"publique",
    cree:V.maintenant(), modifie:V.maintenant() };
  B.ecrireEntree(V.CFG.NODE, V.nouvelId(), f, "fiche depuis " + d.titre).then(function(ok){
    if (!ok){ U.toast(T.E_ECRIT); return; }
    B.ecrire(V.CFG.NODE_DEM, d.id, { statut:"acceptee", mot:U.val("tdlev-g-mot") },
      "acceptation de " + d.titre);
    U.notifier(d.demandeur, V.NOTIF.DECISION, { titre:d.titre, etat:"acceptée" });
    fin(true, T.OK_ACC);
  });
}

function agir(act){
  var B = window.TDLBase, i = S.neuve ? null : parId(S.sel), o = i ? i.obj : null;
  if (act === "fermer"){ GEST.hidden = true; return; }
  if (act === "neuve"){
    S.sect = "fiches"; S.neuve = true; S.sel = null; rendListe(); travail(null); return;
  }
  if (act === "creer"){
    var neuve = lireFiche();
    neuve.origine = "staff";
    neuve.statut  = "en_cours";
    neuve.cree    = V.maintenant();   /* sans elle, la fiche n'a pas de rang */
    B.ecrireEntree(V.CFG.NODE, V.nouvelId(), neuve, "création de fiche")
      .then(function(ok){ S.neuve = false; fin(ok, T.OK_FICHE); });
    return;
  }
  if (!o) return;

  switch (act){
    case "accepter": accepter(o, B); break;

    case "refuser": case "precisions":
      B.ecrire(V.CFG.NODE_DEM, o.id, {
        statut:(act === "refuser") ? "refusee" : "precisions", mot:U.val("tdlev-g-mot")
      }, "réponse à " + o.titre).then(function(ok){
        if (ok) U.notifier(o.demandeur, V.NOTIF.DECISION,
          { titre:o.titre, etat:(act === "refuser") ? "refusée" : "à préciser" });
        fin(ok, (act === "refuser") ? T.OK_REF : T.OK_PREC);
      });
      break;

    case "cloturer":
      var c1 = lireConclusion(optsDe(i));
      if (!verifier(c1, o)) return;
      var ret = lireRetenus();
      conclureEtVerser(
        B.ecrire(V.CFG.NODE, o.id, { statut:"cloture", ouvert:false, retenus:ret, conclusion:c1 },
          "clôture de " + o.titre, { sansFile:true }),
        o, c1, T.OK_CLOT,
        function(){ V.cles(ret).forEach(function(k){
          U.notifier(ret[k].nom || k, V.NOTIF.CLOTURE, { titre:o.titre });
        }); });
      break;

    case "liberer":
      B.ecrire(V.CFG.NODE, o.id, { quotaLibere:true }, "quota libéré")
        .then(function(ok){ fin(ok, T.OK_FICHE); });
      break;

    case "conclure": case "classer":
      /* classée : ni jauge ni réputation, quoi que dise le formulaire */
      var c2 = (act === "classer")
        ? { issue:U.val("tdlev-c-issue") || "mitigee", jauge:"aucune", public:false,
            texte:U.val("tdlev-c-texte") || "", le:V.maintenant(), par:V.monPseudo(),
            classee:true }
        : lireConclusion({});
      if (act !== "classer" && !verifier(c2, o)) return;
      c2.retenus = lireRetenus();
      conclureEtVerser(
        B.ecrireEntree(V.CFG.NODE_CONCL, o.id, c2, "conclusion de " + o.titre, { sansFile:true }),
        o, c2, (act === "classer") ? T.OK_CLASS : T.OK_CONCL);
      break;

    case "verser":
      if (!X || !X.pret()){ U.toast(T.E_MOTEUR); return; }
      X.verser(o, o.conclusion).then(function(bilan){ fin(true, bilan || T.OK_VERS); });
      break;

    case "reprendre":
      B.supprimerEntree(V.CFG.NODE_CONCL, o.id, "reprise de " + o.titre)
        .then(function(ok){ fin(ok, T.OK_REPR); });
      break;

    case "enregistrer":
      var maj = lireFiche();
      /* une fiche qui s'ouvre prévient ceux qui avaient demandé à l'être */
      var sOuvre = maj.ouvert && !o.ouvert;
      B.ecrire(V.CFG.NODE, o.id, maj, "édition de " + o.titre).then(function(ok){
        if (ok && sOuvre) V.cles(o.rappels).forEach(function(k){
          U.notifier(o.rappels[k].nom || k, V.NOTIF.OUVERTURE, { titre:o.titre });
        });
        fin(ok, T.OK_FICHE);
      });
      break;

    case "supprimer":
      if (!window.confirm(T.C_SUPP)) return;
      B.supprimerEntree(V.CFG.NODE, o.id, "suppression de " + o.titre)
        .then(function(ok){ S.sel = null; fin(ok, T.OK_SUPP); });
      break;
  }
}

/* ===================== INIT ===================== */

/* L'état des jauges est lu AVANT le premier rendu : l'aperçu du formulaire
   de clôture en dépend. Une seule lecture ciblée de jauges/. */
function ouvrir(){
  if (!V.estStaff()) return;
  monter();
  S.neuve = false;
  var pret = X ? X.charger() : Promise.resolve();
  pret.then(function(){ GEST.hidden = false; rendListe(); });
}

function demarrer(){
  V = window.TDLEv; U = window.TDLEvUI; W = window.TDLEvVues;
  if (!V || !U || !W || !window.TDLEvPublic || !window.TDLEvPublic.racine()){
    setTimeout(demarrer, 300); return;
  }
  X = window.TDLEvJauges || null;
  T = W.T;
  if (!V.estStaff()) return;
  var b = document.getElementById("tdlev-gestion");
  if (b) b.addEventListener("click", ouvrir);
}

if (document.readyState === "complete") setTimeout(demarrer, 0);
else window.addEventListener("load", function(){ setTimeout(demarrer, 0); });

window.TDLEvStaff = { ouvrir:ouvrir };

})();
