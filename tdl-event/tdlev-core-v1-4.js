/* THE DROWNED LANDS — LES ÉVÉNEMENTS · SOCLE
   Contrat de données, chargement, droits, états dérivés.

   CE QUE CE FICHIER FAIT
     - CONTRAT  : la forme des trois nœuds du module et leur schéma.
     - LECTURE  : les trois nœuds propres + les cinq tableaux repris, lus à
                  chaud. Aucune fiche miroir n'est jamais écrite pour une
                  entrée de tableau : seule sa CONCLUSION vit chez nous.
     - DROITS   : qui est staff, qui est référent d'un évent, qui voit quoi.
     - DÉRIVÉS  : l'état d'affichage (à rejoindre / en cours / à venir /
                  clôturé) est CALCULÉ, jamais stocké.
     - VEILLE   : les trois nœuds suivis par la sentinelle de tdl-base.

   CE QU'IL NE FAIT PAS : aucun DOM, aucun CSS. Le rendu est dans
   tdlev-public.js, tdlev-volet.js et tdlev-staff.js.

   EXPOSE : window.TDLEv
   DÉPEND DE : window.EcoCore, window.TDLBase (chargés avant)
   ORDRE : eco-core → tdl-base → tdlev-core → tdlev-sources →
           tdlev-ui → tdlev-staff-vues → tdlev-public → tdlev-volet →
           tdlev-staff

   CARTE DES BLOCS : CONFIG · TEXTES · UTILS · DROITS · NORMALISATION
                     · DÉRIVÉS · CHARGEMENT · VEILLE · EXPORT
   Le mappage des tableaux repris vit dans tdlev-sources.js. */

(function () {
"use strict";

/* ===================== CONFIG ===================== */

var CFG = {
  NODE:        "evenements",              /* la fiche d'un évent            */
  NODE_CONCL:  "evenements_conclusions",  /* conclusion d'une entrée reprise */
  NODE_DEM:    "evenements_demandes",     /* demandes des joueurs            */
  NODE_DBL:    "doubles_comptes",         /* comptes liés d'un même joueur   */
  NODE_PROJ:   "projets_communautaires",  /* [MAJ] nœud à confirmer           */
  MONTAGE:     "#tdlev-app",              /* [MAJ] coquille dans le message  */
  JOURS_APPUI: 7                          /* délai de réponse d'un appui     */
};

var SCHEMA = 2;   /* listes en nœuds à clés dès la naissance : rien à migrer */

var CATEGORIES = {
  intrigue:      { nom:"Intrigue",                court:"Intrigues",  ico:"eye",          c:"var(--gr4-color)" },
  membre:        { nom:"Événement membre",        court:"Membres",    ico:"glass-cheers", c:"var(--gr1-color)" },
  bande:         { nom:"Événement de bande",      court:"Bandes",     ico:"skull",        c:"var(--gr6-color)" },
  communautaire: { nom:"Événement communautaire", court:"Communauté", ico:"users",        c:"var(--gr2-color)" },
  tradition:     { nom:"Tradition",               court:"Traditions", ico:"flame",        c:"var(--gr3-color)" },
  lore:          { nom:"Lore",                    court:"Lore",       ico:"book",         c:"var(--gr5-color)" }
};
var ORDRE_CAT = ["intrigue","membre","bande","communautaire","tradition","lore"];

var COMMUNAUTES = ["Goulipiats","Fardoches","Ashlanders","Spectres","Perles"];
var BANDES = ["Main de la Providence","Maringouins","Faiseuses d'Anges","Braconneurs",
              "Sorcières","Flottille"];

var JAUGES = {
  climat_social:        "Climat social",
  activite_clandestine: "Activité clandestine",
  pression_bayou:       "Pression du Bayou"
};
/* Une catastrophe n'est imputable à personne : la Pression du Bayou ne produit
   aucune contribution de réputation. Le moteur le lit ici, pas ailleurs. */
var JAUGE_SANS_REPUTATION = "pression_bayou";

/* Ce que le bouton « demander un évent » couvre : seulement ce qu'aucun
   tableau n'offre. Les types, les rôles et les codes de notification font
   partie du contrat d'une demande, pas de son rendu. */
var TYPES_DEMANDE = [
  { id:"communautaire", ico:"users", c:"var(--gr2-color)", prix:"Gratuit",
    nom:"Événement communautaire",
    desc:"Rassembler plusieurs communautés, ou faire avancer un projet communautaire. " },
  { id:"bande", ico:"skull", c:"var(--gr6-color)", prix:"Gratuit",
    nom:"Événement de bande",
    desc:"Un évent qui ne peut être offert par les différentes missions des tableaux : une traque interne, une opération qui mêle "
       + "bandes, communautés et/ou forces de l'ordre." },
  { id:"tradition", ico:"flame", c:"var(--gr3-color)", prix:"Gratuit",
    nom:"Tradition",
    desc:"Ces rendez-vous reviennent chaque année mais peuvent attirer rassemblements et péripéties." }
];
var ROLES_DEMANDE = [
  ["jouer","J'y joue un personnage",
   "Vous participez comme les autres."],
  ["mj","Je veux seulement animer cet évent en tant que MJ",
   "Vous tenez les PNJ et animez les péripéties sans y jouer vos personnages."],
  ["idee","Je propose seulement l'idée",
   "Le staff la reprend et l'anime. Votre nom n'apparaît pas sur la fiche."]
];
var ROLE_DIT = { jouer:"Jouer un personnage", mj:"Animer en tant que MJ",
                 idee:"Proposer seulement l'idée" };

/* [MAJ] codes à déclarer dans sos-emi-notif (plage 230-239). */
/* [MAJ] codes à déclarer dans sos-emi-notif.js (plage 230-239, classe
   tdl_event). Voir le diff fourni avec ce lot. */
var NOTIF = { APPUI:230, REPONSE:231, FILE:232, DECISION:233,
              OUVERTURE:234, CLOTURE:235, RP:236 };

/* ===================== TEXTES ===================== */

var TEXTES = {
  CHARGE:      "On trie les événements du bayou…",
  SOCLE:       "Socle indisponible — vérifier l'ordre de chargement.",
  ECHEC:       "Lecture impossible. Réessayez dans un instant.",
  TOUTE:       "Toute la paroisse",
  PLUS_COMM:   "Plusieurs communautés",
  PLUS_BANDES: "Plusieurs bandes",
  ETATS:       { rejoindre:"À rejoindre", cours:"En cours", venir:"À venir", cloture:"Terminé" },
  ISSUES:      { reussite:"Réussite", mitigee:"Mitigée", echec:"Échec" },
  SENS:        { aggrave:"aggravée", apaise:"apaisée" }
};

var MOIS = ["janv","fév","mars","avril","mai","juin",
            "juil","août","sept","oct","nov","déc"];

/* ===================== UTILS ===================== */

function B(){ return window.TDLBase; }
function E(){ return window.EcoCore; }

function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function vt(v){ return B() ? B().versTableau(v) : (!v ? [] : (Array.isArray(v) ? v : Object.keys(v).map(function(k){ return v[k]; }))); }
/* clés d'un nœud à clés, dans l'ordre d'insertion */
function cles(v){ return (v && typeof v === "object") ? Object.keys(v) : []; }
function cle(s){ return B() ? B().clePseudo(s) : String(s||"").replace(/[.$#\[\]\/]/g,"_"); }
function nouvelId(){ return B().nouvelleCle(); }
function maintenant(){ return new Date().toISOString(); }

function dateFr(iso){
  if (!iso) return "—";
  var d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear();
}
function ilya(iso){
  if (!iso) return "";
  var j = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return "hier";
  return "il y a " + j + " j";
}
/* jours restants avant une échéance, négatif si dépassée */
function joursRestants(iso){
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

/* ===================== DROITS ===================== */

function monPseudo(){
  try { return window._userdata && window._userdata.username ? String(window._userdata.username).trim() : null; }
  catch(e){ return null; }
}
/* [MAJ] détection du staff : même convention que les autres tableaux. */
function estStaff(){
  try {
    if (E() && typeof E().isStaff === "function") return !!E().isStaff();
    var g = window._userdata && window._userdata.user_level;
    return g === 1 || g === 2;
  } catch(e){ return false; }
}

/* Le référent édite le DESCRIPTIF, jamais le statut ni les conséquences.
   Une fiche reprise d'un tableau n'a aucun référent : ses données
   appartiennent à son tableau d'origine. */
function estReferent(ev){
  var p = monPseudo();
  if (!p || !ev || ev.origine === "tableau") return false;
  return ev.referent === p || ev.mj === p;
}
/* Une fiche reprise d'un tableau ne s'édite JAMAIS, staff compris : ses
   données appartiennent à son tableau, et l'écrire ici créerait une seconde
   fiche du même événement sous le même identifiant. Sa vignette vient de sa
   source, sa conclusion du panneau de gestion. */
function peutEditer(ev){
  if (!ev || ev.origine === "tableau") return false;
  return estStaff() || estReferent(ev);
}

/* Visibilité d'une fiche pour le lecteur courant.
   - publique                      → tout le monde
   - réservée, non clôturée        → les bandes désignées, et le staff
   - réservée, clôturée et connue  → tout le monde (la paroisse l'a su)
   - réservée, clôturée et tue     → les bandes désignées, pour toujours   */
function peutVoir(ev, mesBandes){
  if (!ev || ev.visibilite !== "bandes") return true;
  if (estStaff()) return true;
  if (ev.statut === "cloture" && ev.conclusion && ev.conclusion.public) return true;
  var permis = cles(ev.visibleA);
  if (!permis.length) return true;
  var miennes = (mesBandes || []).map(cle);
  for (var i = 0; i < permis.length; i++){
    if (miennes.indexOf(permis[i]) > -1) return true;
  }
  return false;
}

/* Bandes et communauté du lecteur, lues dans la branche membres partagée.
   La communauté porte le LIBELLÉ complet du groupe FA : on compare par
   inclusion, jamais par égalité. */
function mesAppartenances(membres){
  var p = monPseudo(); if (!p) return [];
  var m = (membres || {})[p] || {}, out = [];
  var g = String(m.group || "");
  COMMUNAUTES.forEach(function(c){ if (g.indexOf(c) > -1) out.push(c); });
  var hll = m.hors_la_loi || {};
  if (hll.bande){
    var b = String(hll.bande).toLowerCase();
    BANDES.forEach(function(x){
      if (x.toLowerCase().indexOf(b) > -1 || b.indexOf(x.toLowerCase().split(" ")[0]) > -1) out.push(x);
    });
  }
  return out;
}

/* ===================== NORMALISATION ===================== */

function normaliser(o){
  o = o || {};
  o.schema       = (o.schema === SCHEMA) ? SCHEMA : 1;
  o.origine      = o.origine || "staff";
  o.categorie    = CATEGORIES[o.categorie] ? o.categorie : "communautaire";
  o.catastrophe  = !!o.catastrophe;
  o.titre        = o.titre || "(sans titre)";
  o.sous         = o.sous || "";
  o.periode      = o.periode || "";
  o.contexte     = vt(o.contexte);
  o.objectifs    = vt(o.objectifs);
  o.portees      = cles(o.portees).length ? o.portees : {};
  o.statut       = (o.statut === "cloture") ? "cloture" : "en_cours";
  o.ouvert       = !!o.ouvert;
  o.visibilite   = (o.visibilite === "bandes") ? "bandes" : "publique";
  o.elements     = o.elements || {};
  o.faits        = o.faits || {};
  o.rpOuvert     = !!o.rpOuvert;
  o.rappels      = o.rappels || {};
  o.consequences = vt(o.consequences);
  o.liens        = o.liens || {};
  o.rps          = o.rps || {};
  o.participants = o.participants || {};
  o.retenus      = o.retenus || {};
  o.conclusion   = o.conclusion || null;
  return o;
}

function normaliserDemande(o){
  o = o || {};
  o.statut    = o.statut || "appuis";
  o.role      = o.role || "jouer";
  o.portees   = o.portees || {};
  o.appuis    = o.appuis || {};
  o.objectifs = vt(o.objectifs);
  return o;
}

/* ===================== DÉRIVÉS ===================== */

/* L'état d'affichage ne se stocke jamais : il se déduit de statut, ouvert et
   debut. Ajouter un cinquième onglet se ferait ici, et nulle part ailleurs. */
function etatAffichage(ev){
  if (!ev) return "cours";
  if (ev.statut === "cloture") return "cloture";
  if (ev.debut && new Date(ev.debut).getTime() > Date.now()) return "venir";
  return ev.ouvert ? "rejoindre" : "cours";
}

/* Repli des portées par famille : moins de trois, on nomme ; à partir de
   trois, on replie. Les deux familles s'affichent côte à côte. */
function replierFamille(choisies, famille, pluriel){
  var pris = famille.filter(function(x){ return choisies.indexOf(x) > -1; });
  if (!pris.length) return "";
  return pris.length >= 3 ? pluriel : pris.join(", ");
}
function portees(ev){
  var choisies = cles(ev && ev.portees).map(function(k){ return (ev.portees[k] && ev.portees[k].nom) || ev.portees[k]; })
                  .filter(function(x){ return typeof x === "string"; });
  var bouts = [ replierFamille(choisies, COMMUNAUTES, TEXTES.PLUS_COMM),
                replierFamille(choisies, BANDES, TEXTES.PLUS_BANDES) ].filter(Boolean);
  return bouts.length ? bouts : [TEXTES.TOUTE];
}

/* L'évent mis en avant : un seul, celui qui porte le plus petit aLaUne. */
function miseEnAvant(liste){
  var l = liste.filter(function(e){ return e.aLaUne; });
  l.sort(function(a,b){ return (a.aLaUne|0) - (b.aLaUne|0); });
  return l[0] || null;
}

/* ===================== CHARGEMENT ===================== */

var D = { evenements:[], reprises:[], demandes:[], conclusions:{}, membres:{},
          doublesComptes:{}, projets:[] };

function charger(){
  if (!E() || !E().firebaseGet || !B()) return Promise.reject(new Error("socle"));
  return Promise.all([
    Promise.resolve(E().firebaseGet(CFG.NODE)).catch(function(){ return {}; }),
    Promise.resolve(E().firebaseGet(CFG.NODE_CONCL)).catch(function(){ return {}; }),
    Promise.resolve(E().firebaseGet(CFG.NODE_DEM)).catch(function(){ return {}; }),
    Promise.resolve(B().membres()).catch(function(){ return {}; }),
    Promise.resolve(E().firebaseGet(CFG.NODE_DBL)).catch(function(){ return {}; }),
    Promise.resolve(E().firebaseGet(CFG.NODE_PROJ)).catch(function(){ return {}; })
  ]).then(function(r){
    var brut = r[0] || {};
    D.conclusions    = r[1] || {};
    D.membres        = r[3] || {};
    D.doublesComptes = r[4] || {};
    D.projets        = vt(r[5]);
    D.evenements = cles(brut).map(function(id){
      var o = brut[id] || {}; o.id = id; return normaliser(o);
    });
    var dem = r[2] || {};
    D.demandes = cles(dem).map(function(id){
      var o = dem[id] || {}; o.id = id; return normaliserDemande(o);
    });
    return window.TDLEvSources
      ? window.TDLEvSources.lire(D.conclusions)
      : [];
  }).then(function(reprises){
    D.reprises = reprises;
    /* Une fiche d'evenements/ portant l'identifiant d'une entrée de tableau
       est un doublon né d'une édition : on la retire de la page publique et
       on la signale au staff, qui peut la supprimer depuis « Les fiches ». */
    var repris = {};
    reprises.forEach(function(r){ repris[r.id] = true; });
    D.evenements.forEach(function(e){ e.doublon = !!repris[e.id]; });
    return D;
  });
}

/* Ce que le lecteur courant a le droit de voir, tout confondu. */
/* Une fiche reprise d'un tableau est publique si son tableau l'annonce — une
   marée, une opération, une mission du Carrefour, un avant-poste, un coup
   maringouin ouvrent tous des places, donc ils se lisent.
   Ce qui s'est joué dans l'ombre — une mission de cellule, un dossier de la
   Main — n'apparaît qu'une fois terminé ET seulement si le staff a coché
   « connu de la paroisse » à la clôture.
   RÈGLE : ce qui a été public le reste. On ne fait pas disparaître d'une
   page une fiche que les joueurs ont lue pendant qu'elle se jouait. */
function montrable(e){
  if (e.origine !== "tableau") return true;
  if (e.ouvreAvant) return true;
  return e.statut === "cloture" && !!(e.conclusion && e.conclusion.public);
}

function visibles(){
  var miennes = mesAppartenances(D.membres);
  return D.evenements.concat(D.reprises).filter(function(e){
    return !e.classee && !e.doublon && montrable(e) && peutVoir(e, miennes);
  }).sort(ordre);
}

/* Les intrigues passent devant : ce sont les arcs auxquels tout le reste se
   rattache. Ensuite, du plus récent au plus ancien, par date de création. */
function ordre(a, b){
  var ia = (a.categorie === "intrigue") ? 0 : 1;
  var ib = (b.categorie === "intrigue") ? 0 : 1;
  if (ia !== ib) return ia - ib;
  return String(b.cree || "").localeCompare(String(a.cree || ""));
}

/* ===================== VEILLE ===================== */

var _veilles = [];

function veiller(surMaj){
  [CFG.NODE, CFG.NODE_CONCL, CFG.NODE_DEM].forEach(function(node){
    var v = B().suivre({
      node: node, rev: true,
      onEntrees: function(){ if (surMaj) surMaj(node); }
    });
    if (v) _veilles.push(v);
  });
}

/* ===================== EXPORT ===================== */

window.TDLEv = {
  /* contrat */
  CFG: CFG, SCHEMA: SCHEMA,
  CATEGORIES: CATEGORIES, ORDRE_CAT: ORDRE_CAT,
  COMMUNAUTES: COMMUNAUTES, BANDES: BANDES,
  JAUGES: JAUGES, JAUGE_SANS_REPUTATION: JAUGE_SANS_REPUTATION,
  TYPES_DEMANDE: TYPES_DEMANDE, ROLES_DEMANDE: ROLES_DEMANDE,
  ROLE_DIT: ROLE_DIT, NOTIF: NOTIF,
  TEXTES: TEXTES,
  /* utils */
  esc: esc, vt: vt, cles: cles, cle: cle, nouvelId: nouvelId, maintenant: maintenant,
  dateFr: dateFr, ilya: ilya, joursRestants: joursRestants,
  /* droits */
  monPseudo: monPseudo, estStaff: estStaff, estReferent: estReferent,
  peutEditer: peutEditer, peutVoir: peutVoir, mesAppartenances: mesAppartenances,
  /* dérivés */
  normaliser: normaliser, normaliserDemande: normaliserDemande,
  etatAffichage: etatAffichage, portees: portees, miseEnAvant: miseEnAvant,
  ordre: ordre,
  montrable: montrable,
  /* données */
  D: D, charger: charger, visibles: visibles,
  /* veille */
  veiller: veiller
};

})();
