/*
 * recensement-rp-tracker.js — DÉPRÉCIÉ · TDL
 *
 * CE FICHIER N'EST PLUS CHARGÉ.
 *
 * Le suivi des RPs est désormais géré directement dans eco-gain.js,
 * dans le même writeBin() qui crédite les dollars.
 * C'est la seule approche fiable : même scope, même écriture, zéro timing.
 *
 * PATCH À APPLIQUER DANS eco-gain.js
 * ────────────────────────────────────
 * Dans la fonction ecoCheckPostGain (ou équivalent), juste AVANT la ligne
 * `await writeBin(record)`, dans le bloc où `path` et `membres[pseudo]`
 * sont disponibles :
 *
 *   // 📅 Recensement mensuel — trace RP (même writeBin que les dollars)
 *   if (RP_ZONES.some(z => path.includes(z))) {
 *     const moisCle = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
 *     if (!membres[pseudo].rp_par_mois || Array.isArray(membres[pseudo].rp_par_mois))
 *       membres[pseudo].rp_par_mois = {};
 *     membres[pseudo].rp_par_mois[moisCle] = (membres[pseudo].rp_par_mois[moisCle] || 0) + 1;
 *     membres[pseudo].dernier_rp = new Date().toISOString();
 *   }
 *
 * Supprimer ce fichier du chargement ForumActif (pied de page admin).
 */
