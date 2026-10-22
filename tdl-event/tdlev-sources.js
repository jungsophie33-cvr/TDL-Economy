/* THE DROWNED LANDS — LES ÉVÉNEMENTS · LES TABLEAUX REPRIS
   Traduit une entrée de tableau en fiche d'événement, en LECTURE seule.
   Aucune fiche miroir n'est jamais écrite : seule la CONCLUSION vit chez nous,
   sous la clé {sourceType}_{sourceId}.

   CE FICHIER EST LE SEUL À CONNAÎTRE le vocabulaire de chaque tableau. Chaque
   source dit : où lire, ce qui est un évent, ce qui est clos chez elle, où
   sont son contexte et ses participants, et vers quel sujet renvoyer.
   Un tableau renommé ou un statut qui change se corrige ici, nulle part ailleurs.

   CE QUI ENTRE DANS LA FILE DU STAFF : uniquement ce qui est CLOS dans son
   tableau et sans conclusion. Tant qu'une mission se joue, elle n'a rien à y
   faire.

   EXPOSE : window.TDLEvSources
   DÉPEND DE : window.TDLEv, window.EcoCore
   À CHARGER : après tdlev-core, avant tdlev-public

   CARTE DES BLOCS : OUTILS · SOURCES · TRADUCTION · LECTURE */

(function () {
"use strict";

function V(){ return window.TDLEv; }
function E(){ return window.EcoCore; }

/* ===================== OUTILS ===================== */

var FORUM = "https://thedrownedlands.forumactif.com";

function cles(v){ return (v && typeof v === "object") ? Object.keys(v) : []; }
function val(v){ return cles(v).map(function(k){ return v[k]; }); }

/* Un nœud de participants normalisé : { cléAssainie : { nom } }.
   Les tableaux rangent leurs gens de quatre façons différentes — un nœud
   pseudo→pseudo, un nœud pseudo→objet, des postes, des rôles. */
function gens(liste){
  var o = {};
  (liste || []).forEach(function(p){
    var nom = (typeof p === "string") ? p : (p && (p.pseudo || p.qui || p.nom));
    if (!nom || nom === "\u2014") return;
    o[V().cle(nom)] = { nom:nom };
  });
  return o;
}
/* pseudo → pseudo, ou pseudo → { pseudo, … } : la clé porte déjà le nom. */
function depuisNoeud(n){ return cles(n); }
/* postes du hangar et rôles d'un coup : le nom est dans « qui ». */
function depuisPris(n, champ){
  return val(n).map(function(x){ return x && x[champ || "qui"]; }).filter(Boolean);
}
function lignes(){
  var out = [];
  Array.prototype.forEach.call(arguments, function(x){
    String(x || "").split("\n").forEach(function(l){
      l = l.trim(); if (l) out.push(l);
    });
  });
  return out;
}

/* ===================== SOURCES =====================
   clos(m)  : vocabulaire de clôture PROPRE à chaque tableau — « close »
              partout sauf chez les Maringouins, dont le cycle finit par
              « terminee ».
   garde(m) : ce qui est un évent. Les chasses à primes, les petites missions
              du marché noir et les dossiers ordinaires de la Main n'en sont
              pas : ils ne bougent ni jauge ni réputation.                   */

var SOURCES = [
  { id:"marees", node:"flottille/marees", url:FORUM + "/t96-le-tableau-du-hangar",
    libelle:"Tableau du Hangar · marée", categorie:"communautaire", visible:true,
    clos:function(m){ return m.statut === "close"; },
    /* Une marée se rejoint par le POSTE : c'est là que sont ses gens. */
    parts:function(m){ return gens(depuisPris(m.postes)); },
    texte:function(m){ return lignes(m.contexte); } },

  /* Ce qui se joue n'est pas le transport mais la réunion de partis qui ne se
     rencontreraient pas autrement : une opération est communautaire. */
  { id:"operations", node:"flottille/operations", url:FORUM + "/t96-le-tableau-du-hangar",
    libelle:"Opération de la Flottille", categorie:"communautaire", visible:true,
    clos:function(m){ return m.statut === "close"; },
    parts:function(m){
      return gens(depuisNoeud(m.participants).concat([m.capitaine, m.mandataire]));
    },
    texte:function(m){ return lignes(m.contexte, m.parties); },
    objectif:function(m){ return lignes(m.objectif); } },

  { id:"maringouins", node:"missions", url:FORUM + "/t90-le-tableau-des-missions",
    libelle:"Tableau des Maringouins", categorie:"bande", visible:true,
    clos:function(m){ return m.statut === "terminee"; },
    parts:function(m){
      return gens(depuisNoeud(m.participants)
        .concat(depuisPris(m.roles)).concat([m.chef]));
    },
    texte:function(m){ return lignes(m.contexte); },
    objectif:function(m){ return lignes(m.objectif); } },

  /* Le contexte d'une mission du Carrefour vit dans carrefour_txt, pas dans
     l'entrée : le socle du tableau sépare la liste du texte pour ne pas
     télécharger des kilo-octets de prose à chaque affichage de colonne. */
  { id:"carrefour", node:"carrefour", txt:"carrefour_txt",
    url:FORUM + "/t107-le-tableau-du-carrefour",
    libelle:"Tableau du Carrefour · mission", categorie:"bande", visible:true,
    garde:function(m){ return m.type !== "chasse"; },
    clos:function(m){ return m.statut === "close"; },
    parts:function(m){ return gens(depuisNoeud(m.interets || m.participants)); },
    texte:function(m, t){ return lignes(t && t.contexte, t && t.acteurs); },
    objectif:function(m, t){ return (t && V().vt(t.appel)) || []; } },

  { id:"sorcieres", node:"lost_bayou", url:FORUM + "/t108-le-tableau-des-secrets",
    libelle:"Tableau des secrets · avant-poste", categorie:"bande", visible:true,
    garde:function(m){ return m.type === "poste"; },
    clos:function(m){ return m.statut === "close"; },
    parts:function(m){
      return gens(depuisNoeud(m.participants).concat([m.demandeur, m.repondant]));
    },
    texte:function(m){ return lignes(m.objet, m.apport); } },

  /* Trois services de la Main seulement laissent des traces publiques
     possibles. [MAJ] codes du champ `service` — à compléter si un service
     s'ajoute à la boutique de la Main. */
  { id:"main", node:"dossiers_main", url:FORUM + "/t92-le-tableau-des-dettes",
    libelle:"Dossier de la Main", categorie:"bande", visible:false,
    garde:function(m){
      return ["vend","intim","confesse","medi","mediation"].indexOf(m.service) > -1;
    },
    clos:function(m){ return m.statut === "close"; },
    parts:function(m){ return gens(depuisNoeud(m.participants).concat([m.responsable])); },
    texte:function(m){ return lignes(m.contexte); },
    objectif:function(m){ return lignes(m.objectif); } }
];

/* ===================== TRADUCTION ===================== */

/* « En bref » d'une fiche reprise : ce qu'on ne lit pas déjà dans le héros.
   La jauge pressentie est déduite de la catégorie — un évent de bande pèse
   sur l'activité clandestine, un évent communautaire sur le climat social.
   Ce n'est qu'une annonce : la jauge réellement touchée est décidée à la
   clôture par le staff. */
function faits(src, m, c){
  var out = [];
  if (!c){
    out.push({ libelle:"Tenue par", valeur:src.libelle });
    out.push({ libelle:"Jauge pressentie",
      valeur:(src.categorie === "bande" ? V().JAUGES.activite_clandestine
                                        : V().JAUGES.climat_social)
             + ", selon l'issue" });
    if (m.prime) out.push({ libelle:"Prime", valeur:m.prime + " $" });
    if (m.zone || m.lieu) out.push({ libelle:"Zone", valeur:m.zone || m.lieu });
  }
  var o = {};
  out.forEach(function(f, i){ o["f" + i] = f; });
  return o;
}

function depuisSource(src, id, m, txt, conclusions){
  var cid = src.id + "_" + id;
  var c = (conclusions || {})[cid] || null;
  var clos = !!src.clos(m);
  var liens = {};
  if (m.sujet) liens.rp = { libelle:"Sujet RP", titre:m.titre || "Le sujet", url:m.sujet };
  liens.src = { libelle:"Au tableau d'origine", titre:src.libelle, url:src.url };

  return V().normaliser({
    id:cid, origine:"tableau", sourceType:src.id, sourceId:id,
    source:src.libelle, urlSource:src.url,
    categorie:src.categorie,
    titre:m.titre || m.intitule || "(mission)",
    sous:m.resume || "",
    contexte:src.texte ? src.texte(m, txt) : [],
    objectifs:src.objectif ? src.objectif(m, txt) : [],
    periode:"",
    statut:clos ? "cloture" : "en_cours",
    ouvert:!clos && (m.statut === "en_attente" || m.statut === "ouverte"
                  || m.statut === "acceptee"  || m.statut === "saisi"),
    visibilite:src.visible ? "publique" : "bandes",
    participants:src.parts(m),
    retenus:c ? (c.retenus || {}) : {},
    conclusion:c,
    classee:!!(c && c.classee),
    /* clos dans son tableau mais sans conclusion : c'est la file du staff */
    aConclure:clos && !c,
    faits:faits(src, m, c),
    liens:liens,
    rps:m.sujet ? { s0:{ titre:m.titre || "Le sujet", url:m.sujet } } : {},
    cree:m.clos || m.cree || ""
  });
}

/* ===================== LECTURE ===================== */

function lire(conclusions){
  var jobs = SOURCES.map(function(src){
    var lots = [Promise.resolve(E().firebaseGet(src.node)).catch(function(){ return {}; })];
    if (src.txt) lots.push(Promise.resolve(E().firebaseGet(src.txt)).catch(function(){ return {}; }));
    return Promise.all(lots).then(function(r){
      var brut = r[0] || {}, txt = r[1] || {}, out = [];
      cles(brut).forEach(function(id){
        var m = brut[id];
        if (!m || typeof m !== "object") return;
        if (src.garde && !src.garde(m)) return;
        out.push(depuisSource(src, id, m, txt[id], conclusions));
      });
      return out;
    }, function(){ return []; });
  });
  return Promise.all(jobs).then(function(lots){
    return lots.reduce(function(a, b){ return a.concat(b); }, []);
  });
}

window.TDLEvSources = { SOURCES:SOURCES, lire:lire, FORUM:FORUM };

})();
