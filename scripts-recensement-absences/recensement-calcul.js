/*
 * recensement-calcul.js — Logique de calcul du recensement mensuel · TDL
 *
 * Résumé : Fonctions pures (0 DOM, 0 écriture) retournant les 5 listes :
 * recensés, menacés, absents, nouveaux, suppressions.
 * Tous les tableaux Firebase passent par versTableau() (Firebase sérialise
 * les tableaux JS en objets indexés {0:…, 1:…} lors de la relecture).
 *
 * CARTE DES BLOCS :
 *   UTILS       — versTableau, cleMois, helpers date
 *   ABSENTS     — détection absence longue active
 *   SUPPRESSIONS— membres avec demande de suppression en cours
 *   FICHES      — membres validés tardivement ce mois-ci
 *   LISTES      — calcul des 5 listes
 *   OVERRIDES   — surcharges manuelles staff
 */

(function () {
  "use strict";

  window.RC = window.RC || {};
  const CFG = () => window.RC.CFG;

  /* === UTILS === */

  // Firebase convertit les tableaux JS en objets {0:…, 1:…} lors de la relecture.
  // Appeler sur TOUT tableau lu depuis rec.
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

  // Retourne vrai si le membre a une absence ou présence réduite "en_cours"
  // démarrée il y a plus de SEUIL_ABSENCE_JOURS au moment de dateRef.
  // Prioritaire sur les listes menacés/recensés — sauf si RP posté dans le mois.
  function estEnAbsenceLongue(pseudo, rec, dateRef) {
    const T = CFG().TYPES_ABSENCE;
    const abs = versTableau(rec.absences).find(a =>
      a.pseudo === pseudo &&
      a.statut === "en_cours" &&
      [T.ABSENCE, T.REDUITE].includes(a.type)
    );
    if (!abs) return false;
    const diffJours = (dateRef - new Date(abs.debut)) / 86400000;
    return diffJours > CFG().SEUIL_ABSENCE_JOURS;
  }

  /* === SUPPRESSIONS === */

  // Retourne les pseudos (compte principal) ayant une demande de suppression active.
  // Ces membres apparaissent dans leur propre colonne du recensement.
  function pseudosAvecSuppression(rec) {
    return versTableau(rec.absences)
      .filter(a => a.type === CFG().TYPES_ABSENCE.SUPPRESSION && a.statut === "en_cours")
      .map(a => a.pseudo);
  }

  /* === FICHES === */

  // Membres dont la fiche a été validée à partir du SEUIL_FICHE_TARD du mois courant.
  // Recensés automatiquement — mois incomplet, pas de RP requis.
  function ficheValideeApres15(rec, annee, mois) {
    return versTableau(rec.demandes_fiche)
      .filter(d => {
        if (d.statut !== "validee") return false;
        const dateVal = d.date_validation || d.traite_le || d.date;
        if (!estDansMoisAnnee(dateVal, annee, mois)) return false;
        return new Date(dateVal).getDate() >= CFG().SEUIL_FICHE_TARD;
      })
      .map(d => d.pseudo);
  }

  /* === LISTES === */

  // Retourne { recenses, menaces, absents, nouveaux, suppressions }.
  // dateRef : Date JS (new Date() live, ou date figée snapshot).
  function calculerListes(rec, dateRef) {
    const annee     = dateRef.getFullYear();
    const mois      = dateRef.getMonth();
    const moisKey   = cleMois(dateRef);
    const nouveaux  = ficheValideeApres15(rec, annee, mois);
    const suppressions = pseudosAvecSuppression(rec);
    const recenses  = [], menaces = [], absents = [];

    Object.keys(rec.membres || {}).forEach(pseudo => {
      // Priorité 1 : demande de suppression → colonne dédiée, hors autres listes
      if (suppressions.includes(pseudo)) return;

      // Priorité 2 : absence longue active → absents (si pas de RP dans le mois)
      const rpCount = rec.membres[pseudo].rp_par_mois?.[moisKey] || 0;
      if (estEnAbsenceLongue(pseudo, rec, dateRef) && rpCount < 1) {
        absents.push(pseudo); return;
      }

      // Priorité 3 : fiche validée tardivement → recensé sans RP requis
      if (nouveaux.includes(pseudo)) {
        recenses.push(pseudo); return;
      }

      // Priorité 4 : au moins 1 RP dans le mois (1er → dateRef)
      if (rpCount >= 1) { recenses.push(pseudo); } else { menaces.push(pseudo); }
    });

    return { recenses, menaces, absents, nouveaux, suppressions };
  }

  /* === OVERRIDES === */

  function appliquerOverrides(listes, overrides) {
    if (!overrides) return listes;
    const toutes = ["recenses", "menaces", "absents"];
    Object.entries(overrides).forEach(([pseudo, cible]) => {
      toutes.forEach(k => {
        const idx = listes[k].indexOf(pseudo);
        if (idx !== -1) listes[k].splice(idx, 1);
      });
      if (cible === "recense" && !listes.recenses.includes(pseudo)) listes.recenses.push(pseudo);
      if (cible === "menace"  && !listes.menaces.includes(pseudo))  listes.menaces.push(pseudo);
    });
    return listes;
  }

  function lireTableauSnapshot(snap, champ) {
    return versTableau(snap?.[champ] || []);
  }

  window.RC.Calcul = {
    calculerListes, appliquerOverrides,
    ficheValideeApres15, cleMois,
    versTableau, lireTableauSnapshot,
    pseudosAvecSuppression,
  };

})();
