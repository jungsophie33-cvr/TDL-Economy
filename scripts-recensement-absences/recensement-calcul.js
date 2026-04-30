/*
 * recensement-calcul.js — Logique de calcul du recensement mensuel · TDL
 *
 * Résumé : Fonctions pures (0 DOM, 0 écriture JSONBin) qui lisent rec et
 * retournent les 4 listes : recensés, en danger, absents, nouveaux membres.
 * Tous les accès aux tableaux Firebase passent par versTableau() car Firebase
 * sérialise les tableaux JS en objets indexés {0:…, 1:…} lors de la relecture.
 *
 * CARTE DES BLOCS :
 *   UTILS    — versTableau, helpers date, clé mois
 *   ABSENTS  — détection absence longue active
 *   FICHES   — membres validés tardivement ce mois-ci
 *   LISTES   — calcul des 4 listes à partir de rec + dateRef
 *   OVERRIDES — application des surcharges staff
 */

(function () {
  "use strict";

  window.RC = window.RC || {};
  const CFG = () => window.RC.CFG;

  /* === UTILS === */

  // Firebase convertit les tableaux JS en objets {0:…, 1:…} lors de la relecture.
  // versTableau() normalise les deux formes — à appeler sur TOUT tableau lu depuis rec.
  function versTableau(v) {
    if (!v) return [];
    return Array.isArray(v) ? v : Object.values(v);
  }

  function cleMois(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function estDansMoisAnnee(isoString, annee, mois) {
    if (!isoString) return false;
    const d = new Date(isoString);
    return d.getFullYear() === annee && d.getMonth() === mois;
  }

  /* === ABSENTS === */

  // Retourne vrai si le membre a une absence "en_cours" démarrée il y a plus de
  // SEUIL_ABSENCE_JOURS au moment de dateRef. Prioritaire sur les autres listes.
  function estEnAbsenceLongue(pseudo, rec, dateRef) {
    // rec.absences peut être un objet Firebase {0:…} ou un vrai tableau
    const abs = versTableau(rec.absences)
      .find(a => a.pseudo === pseudo && a.statut === "en_cours");
    if (!abs) return false;
    const diffJours = (dateRef - new Date(abs.debut)) / 86400000;
    return diffJours > CFG().SEUIL_ABSENCE_JOURS;
  }

  /* === FICHES === */

  // Retourne les pseudos dont la fiche a été validée à partir du SEUIL_FICHE_TARD
  // du mois courant — ils sont recensés automatiquement sans RP requis.
  function ficheValideeApres15(rec, annee, mois) {
    // rec.demandes_fiche peut être un objet Firebase {0:…} ou un vrai tableau
    return versTableau(rec.demandes_fiche)
      .filter(d => {
        if (d.statut !== "validee") return false;
        // date_validation est ajouté par fiche-staff.js (traite_le), date est le dépôt
        const dateVal = d.date_validation || d.traite_le || d.date;
        if (!estDansMoisAnnee(dateVal, annee, mois)) return false;
        return new Date(dateVal).getDate() >= CFG().SEUIL_FICHE_TARD;
      })
      .map(d => d.pseudo);
  }

  /* === LISTES === */

  // Point d'entrée principal — retourne { recenses, danger, absents, nouveaux }.
  // dateRef : Date JS (new Date() pour le live, ou date figée pour un snapshot).
  function calculerListes(rec, dateRef) {
    const annee   = dateRef.getFullYear();
    const mois    = dateRef.getMonth(); // 0-indexé
    const moisKey = cleMois(dateRef);

    const nouveaux = ficheValideeApres15(rec, annee, mois);
    const recenses = [], danger = [], absents = [];

    Object.keys(rec.membres || {}).forEach(pseudo => {
      // Priorité 1 : absence longue active → exclut des deux autres listes
      if (estEnAbsenceLongue(pseudo, rec, dateRef)) {
        absents.push(pseudo); return;
      }
      // Priorité 2 : fiche validée ≥ 15 du mois → recensé sans RP requis
      if (nouveaux.includes(pseudo)) {
        recenses.push(pseudo); return;
      }
      // Priorité 3 : RP dans le mois (du 1er jusqu'à dateRef inclus)
      // rp_par_mois est un objet clé/valeur (jamais un tableau) — stable Firebase
      const rpCount = rec.membres[pseudo].rp_par_mois?.[moisKey] || 0;
      if (rpCount >= 1) { recenses.push(pseudo); } else { danger.push(pseudo); }
    });

    return { recenses, danger, absents, nouveaux };
  }

  /* === OVERRIDES === */

  // Applique les déplacements manuels staff (recense / danger) après calculerListes().
  // Mute les tableaux en place.
  function appliquerOverrides(listes, overrides) {
    if (!overrides) return listes;
    const toutes = ["recenses", "danger", "absents"];

    Object.entries(overrides).forEach(([pseudo, cible]) => {
      toutes.forEach(k => {
        const idx = listes[k].indexOf(pseudo);
        if (idx !== -1) listes[k].splice(idx, 1);
      });
      if (cible === "recense" && !listes.recenses.includes(pseudo)) listes.recenses.push(pseudo);
      if (cible === "danger"  && !listes.danger.includes(pseudo))   listes.danger.push(pseudo);
    });

    return listes;
  }

  // Lecture sécurisée d'un sous-tableau dans rec.recensement[moisKey]
  // Firebase peut avoir converti en_danger_25, recenses, etc. en objets
  function lireTableauSnapshot(snap, champ) {
    return versTableau(snap?.[champ] || []);
  }

  window.RC.Calcul = {
    calculerListes,
    appliquerOverrides,
    ficheValideeApres15,
    cleMois,
    versTableau,
    lireTableauSnapshot,
  };

})();
