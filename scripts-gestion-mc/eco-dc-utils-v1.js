/*
 * eco-dc-utils.js — Fonctions utilitaires du système multi-compte · TDL
 *
 * CE QUE CE FICHIER FAIT : fournit des fonctions pures (sans effets DOM),
 * le fetch de la page profil ForumActif, et la génération des messages BBCode.
 * CE QU'IL NE FAIT PAS : aucune manipulation DOM, aucune écriture JSONBin.
 *
 * CARTE DES BLOCS :
 *   PROFIL   — fetch de /u{id} et lecture des champs personnalisés
 *   DATES    — parsing et calcul d'ancienneté
 *   GROUPES  — navigation dans la structure doubles_comptes du JSONBin
 *   AFFICHAGE — helpers DOM sans inline CSS
 *   MESSAGES  — générateurs de messages BBCode postés dans le sujet FA
 *
 * Dépend de : eco-dc-config.js, window.EcoCore
 */

(function (DC, CFG) {
  "use strict";

  /* === NORMALISATION FIREBASE === */

  /*
   * Firebase Realtime Database sérialise les tableaux JS en objets {0:{…}, 1:{…}}.
   * Toute valeur lue depuis rec qui devrait être un tableau doit passer par cette fonction
   * avant d'utiliser .find(), .filter(), .forEach(), etc.
   */
  DC.versTableau = function (valeur) {
    if (!valeur) return [];
    if (Array.isArray(valeur)) return valeur;
    return Object.values(valeur);
  };

  /* === PROFIL === */

  // Cache partagé : une seule requête /u{id} par chargement de page.
  // [MAJ] L'URL /u{id} est propre à ForumActif — à vérifier si la plateforme change son routage.
  let _profilCache = null;

  DC.fetchProfil = async function () {
    if (_profilCache) return _profilCache;

    // [MAJ] Si ForumActif renomme _userdata, mettre à jour ici.
    const uid = window._userdata?.["user_id"];
    if (!uid || uid <= 0) return null;

    // AbortController avec timeout : sans ça, fetch() peut rester en attente indéfiniment
    // si ForumActif est lent ou rate-limite la requête sur /u{id}.
    const ctrl = new AbortController();
    const minuterie = setTimeout(() => ctrl.abort(), 6000);

    try {
      const rep = await fetch("/u" + uid, {
        credentials: "same-origin",
        signal: ctrl.signal,
      });
      clearTimeout(minuterie);
      if (!rep.ok) return null;
      _profilCache = new DOMParser().parseFromString(await rep.text(), "text/html");
      return _profilCache;
    } catch (_) {
      // Timeout (AbortError) ou erreur réseau → on continue avec null (affichera "?")
      clearTimeout(minuterie);
      return null;
    }
  };

  DC.lireDateInscription = async function () {
    const doc = await DC.fetchProfil();
    if (!doc) return null;
    // [MAJ] Sélecteur dépend du nom du champ personnalisé dans l'admin ForumActif
    const el = doc.querySelector(CFG.SEL.PROFIL_DATE);
    return el ? DC.parseDateFR(el.textContent.trim()) : null;
  };

  DC.lireNbRP = async function () {
    const doc = await DC.fetchProfil();
    if (!doc) return null;
    // [MAJ] Sélecteur dépend du nom du champ personnalisé dans l'admin ForumActif
    const el = doc.querySelector(CFG.SEL.PROFIL_RP);
    return el ? (parseInt(el.textContent.trim(), 10) || 0) : null;
  };

  /* === DATES === */

  DC.parseDateFR = function (str) {
    if (!str) return null;
    str = str.trim();
    let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);

    // Couvre les formats longs générés par ForumActif selon la langue du forum
    const MOIS = {
      jan:0, janv:0, janvier:0,
      fév:1, fev:1, février:1, fevrier:1,
      mar:2, mars:2, avr:3, avril:3, mai:4, juin:5,
      juil:6, juillet:6,
      aoû:7, aou:7, août:7, aout:7,
      sep:8, sept:8, septembre:8,
      oct:9, octobre:9, nov:10, novembre:10,
      déc:11, dec:11, décembre:11, decembre:11,
    };
    m = str.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\.?\s+(\d{4})$/);
    if (m) {
      const mo = MOIS[m[2].toLowerCase()];
      if (mo !== undefined) return new Date(+m[3], mo, +m[1]);
    }
    return null;
  };

  DC.ancienneteEnMois = function (date) {
    const auj = new Date();
    return (auj.getFullYear() - date.getFullYear()) * 12
      + (auj.getMonth() - date.getMonth())
      + (auj.getDate() >= date.getDate() ? 0 : -1);
  };

  /* === GROUPES === */

  DC.trouverGroupe = function (rec, pseudo) {
    const dcs = rec.doubles_comptes || {};
    for (const racine in dcs) {
      if (DC.versTableau(dcs[racine].comptes).includes(pseudo)) return racine;
    }
    return null;
  };

  DC.infosGroupe = function (rec, pseudo) {
    const racine = DC.trouverGroupe(rec, pseudo);
    if (!racine) return { racine: pseudo, comptes: [pseudo], estNouveau: true };
    // Normalisation : Firebase peut retourner comptes comme objet {0:…, 1:…}
    const comptes = DC.versTableau(rec.doubles_comptes[racine].comptes);
    return { racine, comptes, estNouveau: false };
  };

  /* === INDEX UID ↔ PSEUDO === */

  // Retourne le pseudo actuel d'un UID depuis uid_index
  DC.pseudoDepuisUID = function (rec, uid) {
    return rec.uid_index?.[String(uid)] || null;
  };

  // Retourne l'UID d'un pseudo depuis membres[pseudo].uid ou uid_index inversé
  DC.uidDepuisPseudo = function (rec, pseudo) {
    if (rec.membres?.[pseudo]?.uid) return rec.membres[pseudo].uid;
    // Fallback : recherche inversée dans uid_index (si uid pas encore stocké dans membres)
    const entree = Object.entries(rec.uid_index || {}).find(([, p]) => p === pseudo);
    return entree ? parseInt(entree[0], 10) : null;
  };

  DC.genId = function () {
    return "dc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  };

  DC.estStaff = function () {
    const pseudo = window.EcoCore.getPseudo();
    return (window.EcoCore.ADMIN_USERS || []).includes(pseudo)
        || CFG.STAFF_USERS.includes(pseudo);
  };

  /* === AFFICHAGE === */

  // Applique le type (succes / erreur / info) comme classe CSS sur l'élément .dc-resultat
  DC.afficherResultat = function (el, type, html) {
    el.className = "dc-resultat " + type;
    el.innerHTML = html;
  };

  /*
   * Pré-remplit le textarea de la réponse rapide avec le texte BBCode généré.
   *
   * ForumActif utilise SCEditor (éditeur WYSIWYG) dont le textarea réel est caché
   * sous #quick_reply .sceditor-container textarea.
   * Écrire dans .value ne suffit pas : SCEditor maintient son propre état interne.
   * Il faut passer par son API (sceditor.instance) pour que le contenu soit
   * effectivement envoyé lors du clic sur "Envoyer".
   *
   * [MAJ] Le sélecteur TEXTAREA_REPONSE et l'API sceditor sont fragiles aux mises
   * à jour de ForumActif. Si le texte n'apparaît plus, vérifier ces deux points.
   */
  DC.preremplirReponse = function (texte) {
    const ta = document.querySelector(CFG.SEL.TEXTAREA_REPONSE);
    if (!ta) return;

    // Méthode 1 : API SCEditor (méthode fiable — synchronise l'état interne de l'éditeur)
    // [MAJ] SCEditor expose son instance via sceditor.instance(element)
    if (window.sceditor) {
      const instance = window.sceditor.instance(ta);
      if (instance) {
        instance.val(texte);
        ta.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    // Méthode 2 : écriture directe + événements natifs (fallback si SCEditor absent)
    // Nécessaire pour que le framework JS de FA détecte le changement de valeur
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, "value"
    ).set;
    nativeInputValueSetter.call(ta, texte);
    ta.dispatchEvent(new Event("input",  { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    ta.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /* === MESSAGES BBCode === */

 DC.msgMembre = function (demande, monnaie) {
    const esc = (s) => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    return `<div id="demande-dc" class="sj-fiche"><div class="h1"><h1>Demande de multicompte n° ${demande.numero_dc}</h1></div>
<tw><span>par @"${demande.compte_demandeur}"</span> <span>avatar réservé :</span> <span>${esc(demande.avatar_reserve)}</span></tw>
<div class="sj-formgen"><div class="sj-formcol"><f4>Résumé du personnage envisagé</f4> ${esc(demande.resume)}</div>
</div></div>`;
  };

  DC.msgStaff = function (demande, decision, motif, staffPseudo, monnaie) {
    const esc = (s) => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    if (decision === "validee") {
      return `<div id="demande-dc" class="sj-fiche"><div class="h1"><h1>Demande acceptée</h1></div>
<tw><span>demande faite par @"${demande.compte_demandeur}"</span> <span>avatar réservé :</span> <span>${esc(demande.avatar_reserve)}</span></tw>
<div class="sj-formgen"><div class="sj-formcol"><f4>ça y est, on perd la tête !</f4>Bonjour, ta demande de ${demande.numero_dc}e compte a été acceptée et <i3>ton avatar réservé</i3>.
Tu peux dès à présent inscrire ton nouveau personnage et nous faire découvrir sa fiche. <d3>Va, cours, vole !</d3> Nous avons <u1>hâte</u1> de lire ses aventures.
<b3>Merci</b3> pour ton implication sur TDL et <u>à très vite.</u></div></div>
</div>`;
    }

   // Refus
    return `<div id="demande-dc" class="sj-fiche"><div class="h1"><h1>Demande refusée</h1></div>
<tw><span>demande faite par @"${demande.compte_demandeur}"</span> <span>avatar réservé :</span> <span>${esc(demande.avatar_reserve)}</span></tw>
<div class="sj-formgen"><div class="sj-formcol"><f4>motif du refus</f4>"${esc(motif || "—")}"
<d>N'hésite pas à reformuler ta demande</d> après un petit temps de réflexion. Le staff est <u>disponible</u> à la moindre question et pour t'aider à développer tes idées.</div></div>
</div>`;
  };

})(window.DC, window.DC.CFG);
