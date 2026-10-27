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

/* Vignettes de bandeau, une par tableau : les fiches reprises n'ont pas
   d'auteur pour en choisir une, et une image par source se reconnaît d'un
   coup d'œil sans rien dire de ce qui s'y joue. */
var IMG = {
  MAIN:       "https://www.aht.li/3993920/FRANK_RELLE-1_copie.png",
  SORCIERES:  "https://www.aht.li/3993922/Cordelle_Frank_Relle_798bab19-f371-4a61-8313-3e8a5d17e8de_copie.png",
  OPERATIONS: "https://www.aht.li/3993923/Melerine_Frank_Relle_2026-b_copie.png",
  COUPS:      "https://www.aht.li/3993924/Auguillard_frank_relle_8dd3d6c2-19b7-434f-82e1-22db33565512.jpg",
  MAREES:     "https://www.aht.li/3993925/Allemands_frank_relle_copyright_2019_copie.png",
  CARREFOUR:  "https://www.aht.li/3993926/Eleusinian_frank_relle_copyright_2018_copie.png"
};

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

   /* Une propriété de source peut être une valeur ou une fonction de l'entrée. */
function lit(x, m){ return (typeof x === "function") ? x(m) : x; }

/* Poids des dossiers de la Main, en points (8 = un cran). */
var POIDS_MAIN = { vend:4, medi:4, mediation:4, intim:2, confesse:1 };

/* Éléments importants, communs aux six tableaux : on prend ce qui existe,
   sous le libellé que le joueur comprend. Un champ absent ne crée pas de case. */
function elements(m, src){
  var o = {}, n = 0;
  function pose(ico, libelle, valeur){
    if (!valeur) return;
    o["e" + (n++)] = { ico:ico, libelle:libelle, valeur:String(valeur) };
  }
  pose("marker", "Lieu", m.zone || m.lieu || m.destination);
  pose("clock", "Quand", m.quand || m.depart || m.heure);
  pose("location-crosshairs", "Cibles", m.cible || m.cibles);

  /* Les dossiers de la Main ne nomment jamais qui a commandé : c'est tout
     l'intérêt de passer par elle. Ailleurs, « au nom de » ne s'affiche que
     faute de commanditaire — les deux disent la même chose. */
  var qui = src && src.anonyme
    ? "" : (m.demandeur || m.auteur || m.createur || m.commanditaire);
  if (qui) pose("user", "Commanditaire", qui);
  else if (!(src && src.anonyme)) pose("shield", "Au nom de", m.mandataire || m.protege);
  return o;
}

/* « Qui doit se retrouver là » : le champ de texte d'une opération nomme les
   partis attendus. On y reconnaît les communautés et les bandes du forum pour
   remplir les portées de la fiche — ce que le tableau dit, la fiche l'affiche. */
function porteesDepuis(txt){
  var t = String(txt || "").toLowerCase(), o = {};
  V().COMMUNAUTES.concat(V().BANDES).forEach(function(nom){
    var court = nom.split(" ")[0].toLowerCase();
    if (t.indexOf(court) > -1) o[V().cle(nom)] = { nom:nom };
  });
  return o;
}

/* ===================== SOURCES =====================
   clos(m)  : vocabulaire de clôture PROPRE à chaque tableau — « close »
              partout sauf chez les Maringouins, dont le cycle finit par
              « terminee ».
   garde(m) : ce qui est un évent. Les chasses à primes, les petites missions
              du marché noir et les dossiers ordinaires de la Main n'en sont
              pas : ils ne bougent ni jauge ni réputation.
   ouvre(m) : la fiche est-elle PUBLIQUE avant sa clôture ? Une mission de
              cellule maringouine et un dossier de la Main se jouent dans
              l'ombre : personne n'a à les lire en cours. Un coup, lui, ouvre
              des rôles au camp d'en face — il est donc annoncé.
   ombre    : le tableau appartient à une bande hors-la-loi. Une fois close et
              traitée, sa fiche ne devient publique que si le staff a coché
              « connu de la paroisse ».
   conseq(m): ce que le référent a écrit À LA CLÔTURE — jamais le contexte.
   anonyme  : le tableau ne nomme jamais le commanditaire (la Main).
   poids    : points versés à la jauge choisie par le staff (8 = un cran).
   pressentie : la jauge annoncée sur la fiche avant clôture, ou rien quand
              elle dépend trop de ce qui se joue. Le staff décide toujours.
   vignette : [MAJ] image de bandeau, une par tableau. Voir la note en pied. */

var SOURCES = [
  { id:"marees", node:"flottille/marees", url:FORUM + "/t96-le-tableau-du-hangar",
    libelle:"Marée \u27E1 Flottille", categorie:"communautaire", visible:true, poids:1, pressentie:"activite_clandestine",
    ouvre:true, ombre:false, vignette:IMG.MAREES,
    clos:function(m){ return m.statut === "close"; },
    /* Une marée se rejoint par le POSTE : c'est là que sont ses gens. */
    parts:function(m){ return gens(depuisPris(m.postes)); },
    texte:function(m){ return lignes(m.contexte); },
    conseq:function(m){ return lignes(m.consequences); } },

  /* Ce qui se joue n'est pas le transport mais la réunion de partis qui ne se
     rencontreraient pas autrement : une opération est communautaire. */
  { id:"operations", node:"flottille/operations", url:FORUM + "/t96-le-tableau-du-hangar",
    libelle:"Opération \u27E1 Flottille", categorie:"communautaire", visible:true, poids:2, pressentie:null,
    ouvre:true, ombre:false, vignette:IMG.OPERATIONS,
    clos:function(m){ return m.statut === "close"; },
    parts:function(m){
      return gens(depuisNoeud(m.participants).concat([m.capitaine, m.mandataire]));
    },
    texte:function(m){ return lignes(m.contexte); },
    objectif:function(m){ return lignes(m.objectif); },
    conseq:function(m){ return lignes(m.consequences); },
    portees:function(m){ return porteesDepuis(m.parties); } },

  { id:"maringouins", node:"missions", url:FORUM + "/t90-le-tableau-des-missions",
    libelle:"Coup \u27E1 Maringouins", categorie:"bande", visible:true, poids:function(m){ return m.envergure === true ? 2 : 1; }, pressentie:"activite_clandestine",
    ombre:true, vignette:IMG.COUPS,
    /* un coup ouvre des rôles adverses, donc il s'annonce ; une mission de
       cellule reste dans l'ombre tant qu'elle n'est pas terminée */
    ouvre:function(m){ return m.genre === "coup"; },
    clos:function(m){ return m.statut === "terminee"; },
    parts:function(m){
      return gens(depuisNoeud(m.participants)
        .concat(depuisPris(m.roles)).concat([m.chef]));
    },
    texte:function(m){ return lignes(m.contexte); },
    objectif:function(m){ return lignes(m.objectif); },
    conseq:function(m){ return lignes(m.consequences); } },

  /* Le contexte d'une mission du Carrefour vit dans carrefour_txt, pas dans
     l'entrée : le socle du tableau sépare la liste du texte pour ne pas
     télécharger des kilo-octets de prose à chaque affichage de colonne. */
  { id:"carrefour", node:"carrefour", txt:"carrefour_txt",
    url:FORUM + "/t107-le-tableau-du-carrefour",
    libelle:"Mission du Carrefour", categorie:"communautaire", visible:true, poids:1, pressentie:"climat_social",
    ouvre:true, ombre:false, vignette:IMG.CARREFOUR,
    garde:function(m){ return m.type !== "chasse"; },
    clos:function(m){ return m.statut === "close"; },
    parts:function(m){ return gens(depuisNoeud(m.interets || m.participants)); },
    texte:function(m, t){ return lignes(t && t.contexte); },
    /* les objectifs d'une mission, ce sont les acteurs en présence et les
       intérêts affichés — rien d'autre */
    objectif:function(m, t){
      return lignes(t && t.acteurs).concat((t && V().vt(t.appel)) || []);
    },
    conseq:function(m){ return lignes(m.consequences); } },

  { id:"sorcieres", node:"lost_bayou", url:FORUM + "/t108-le-tableau-des-secrets",
    libelle:"Rencontre \u27E1 Sorcières", categorie:"bande", visible:true, poids:1, pressentie:null,
    ouvre:true, ombre:true, vignette:IMG.SORCIERES,
    garde:function(m){ return m.type === "poste"; },
    clos:function(m){ return m.statut === "close"; },
    parts:function(m){
      return gens(depuisNoeud(m.participants).concat([m.demandeur, m.repondant]));
    },
    texte:function(m){ return lignes(m.objet, m.apport); },
    conseq:function(m){ return lignes(m.consequences); } },

  /* Trois services de la Main seulement laissent des traces publiques
     possibles. [MAJ] codes du champ `service` — à compléter si un service
     s'ajoute à la boutique de la Main. */
  { id:"main", node:"dossiers_main", url:FORUM + "/t92-le-tableau-des-dettes",
    libelle:"Dossier \u27E1 Main", categorie:"bande", visible:false,
    poids:function(m){ return POIDS_MAIN[m.service] || 0; },
    pressentie:function(m){
      return (m.service === "medi" || m.service === "mediation")
        ? "climat_social" : "activite_clandestine";
    },
    ouvre:false, ombre:true, anonyme:true, vignette:IMG.MAIN,
    garde:function(m){
      return ["vend","intim","confesse","medi","mediation"].indexOf(m.service) > -1;
    },
    clos:function(m){ return m.statut === "close"; },
    parts:function(m){ return gens(depuisNoeud(m.participants).concat([m.responsable])); },
    /* un dossier de la Main n'engage que la Main : jamais « toute la paroisse » */
    portees:function(){
      var o = {}; o[V().cle("Main de la Providence")] = { nom:"Main de la Providence" };
      return o;
    },
    texte:function(m){ return lignes(m.contexte); },
    objectif:function(m){ return lignes(m.objectif); },
    conseq:function(m){ return lignes(m.consequences); } }
];

/* ===================== TRADUCTION ===================== */

/* « En bref » d'une fiche reprise : ce qu'on ne lit pas déjà dans le héros.
   La jauge pressentie est déclarée par la source, ou absente quand elle dépend de ce qui se joue.
   Ce n'est qu'une annonce : la jauge réellement touchée est décidée à la
   clôture par le staff. */
function faits(src, m, c){
  var out = [];
  if (!c){
    out.push({ libelle:"Tenue par", valeur:src.libelle });
    var jp = lit(src.pressentie, m);
    if (jp && V().JAUGES[jp]) out.push({ libelle:"Jauge pressentie", valeur:V().JAUGES[jp] });
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
  var parts = src.parts(m);

  var liens = {};
  if (m.sujet) liens.rp = { libelle:"Sujet RP", titre:m.titre || "Le sujet", url:m.sujet };
  liens.src = { libelle:"Au tableau d'origine", titre:src.libelle, url:src.url };

  /* Les gens validés par le tableau sont déjà validés : ils sont rattachés au
     sujet, et retenus d'office. Le staff n'a plus qu'à dire qui est nommé. */
  var retenus = {};
  if (c && c.retenus) retenus = c.retenus;
  else if (clos) V().cles(parts).forEach(function(k){
    retenus[k] = { nom:parts[k].nom, nomme:false };
  });

  return V().normaliser({
    id:cid, origine:"tableau", sourceType:src.id, sourceId:id,
    source:src.libelle, urlSource:src.url, urlRp:m.sujet || "",
    categorie:src.categorie,
    poids:Math.max(0, lit(src.poids, m) | 0),
    titre:m.titre || m.intitule || "(mission)",
    sous:m.resume || "",
    contexte:src.texte ? src.texte(m, txt) : [],
    objectifs:src.objectif ? src.objectif(m, txt) : [],
    consequences:src.conseq ? src.conseq(m) : [],
    periode:"",
    statut:clos ? "cloture" : "en_cours",
    ouvert:!clos && (m.statut === "en_attente" || m.statut === "ouverte"
                  || m.statut === "acceptee"  || m.statut === "saisi"),
    visibilite:src.visible ? "publique" : "bandes",
    /* une fiche de l'ombre ne s'annonce pas tant qu'elle n'est pas terminée */
    ouvreAvant:(typeof src.ouvre === "function") ? !!src.ouvre(m) : !!src.ouvre,
    ombre:!!src.ombre,
    participants:parts,
    retenus:retenus,
    valideParTableau:clos,
    conclusion:c,
    classee:!!(c && c.classee),
    /* clos dans son tableau mais sans conclusion : c'est la file du staff */
    aConclure:clos && !c,
    faits:faits(src, m, c),
    elements:elements(m, src),
    portees:src.portees ? src.portees(m) : {},
    vignette:src.vignette || "",
    liens:liens,
    rps:m.sujet ? { s0:{ titre:m.titre || "Le sujet", url:m.sujet, participants:parts } } : {},
    cree:m.cree || m.clos || ""
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
