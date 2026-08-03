/* ============================================================
   TDL — ZONES & CATÉGORIES · configuration partagée
   Source unique consommée par :
     · eco-rep-lieux    (Répertoire des lieux)
     · eco-bottin-metiers (Bottin des métiers)
   À charger AVANT les deux modules.

   Objectif : ne jamais laisser les deux listes diverger. Toute
   nouvelle zone ou catégorie s'ajoute ICI et nulle part ailleurs.

   Expose : window.TDLZonesCats
   ============================================================ */
(function(){
"use strict";

/* ===================== ZONES ===================== */
/* [MAJ] l'id sert de clé Firebase : ne jamais le renommer une fois en base. */
const ZONES = [
  {id:'houma',          titre:'Houma'},
  {id:'bayou_cane',     titre:'Bayou Cane'},
  {id:'bayou_blue',     titre:'Bayou Blue'},
  {id:'bourg',          titre:'Bourg'},
  {id:'ashland',        titre:'Ashland'},
  {id:'montegut',       titre:'Montegut'},
  {id:'lost_bayou',     titre:'Lost Bayou'},
  {id:'terrebonne_bay', titre:'Terrebonne Bay'}
];

/* ===================== CATÉGORIES =====================
   c    : couleur pleine (icônes, bordure de la direction)
   soft : même couleur en opacité 20 % (fonds discrets)
   s40  : même couleur en opacité 40 % (tags de culture)
   ====================================================== */
const CATS = [
  {id:'institutions', label:'Institutions',    ic:'fi-tr-government-flag',
   c:'var(--gr3-color)',  soft:'var(--gr3-20)',      s40:'var(--gr3-40)'},
  {id:'sante',        label:'Santé',           ic:'fi-ts-marker-hospital',
   c:'var(--gr6-color)',  soft:'var(--gr6-20)',      s40:'var(--gr6-40)'},
  {id:'services',     label:'Services',        ic:'fi-tr-marketplace-store',
   c:'var(--gr1-color)',  soft:'var(--gr1-20)',      s40:'var(--gr1-40)'},
  {id:'loisirs',      label:'Loisirs',         ic:'fi-ts-drink',
   c:'var(--gr4-color)',  soft:'var(--gr4-20)',      s40:'var(--gr4-40)'},
  {id:'nature',       label:'Nature',          ic:'fi-tr-tree-alt',
   c:'var(--gr2-color)',  soft:'var(--gr2-20)',      s40:'var(--gr2-40)'},
  {id:'fermes',       label:'Fermes',          ic:'fi-tr-wheat-awn',
   c:'var(--clair2)',     soft:'var(--clair2opa2)',  s40:'var(--clair2opa4)'},
  {id:'peche',        label:"Au fil de l'eau", ic:'fi-ts-sailboat',
   c:'var(--gr5-color)',  soft:'var(--gr5-20)',      s40:'var(--gr5-40)'}
];

/* ===================== ACCÈS ===================== */
const PAR_ZONE = Object.fromEntries(ZONES.map(z=>[z.id, z]));
const PAR_CAT  = Object.fromEntries(CATS.map(c=>[c.id, c]));

window.TDLZonesCats = {
  ZONES: ZONES,
  CATS: CATS,
  zone: id => PAR_ZONE[id] || null,
  cat:  id => PAR_CAT[id]  || null,
  titreZone: id => (PAR_ZONE[id] ? PAR_ZONE[id].titre : ''),
  labelCat:  id => (PAR_CAT[id]  ? PAR_CAT[id].label  : '')
};

})();
