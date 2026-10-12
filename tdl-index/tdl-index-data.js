/*
 * tdl-index-data.js — Données de la page d'accueil · The Drowned Lands
 *
 * ============================================================================
 *  C'EST LE SEUL FICHIER QUE LE STAFF ÉDITE.
 *  Tout se passe entre les deux accents graves ci-dessous, en grammaire SOS.
 *  Éditez-le dans GitHub : les sauts de ligne y sont préservés au caractère
 *  près, ce que l'éditeur ForumActif ne sait pas faire.
 * ============================================================================
 *
 *  DEUX CARACTÈRES INTERDITS dans le texte, ils casseraient le fichier entier :
 *    ·  l'accent grave  `
 *    ·  la séquence     ${
 *  Si un titre en a besoin, écrivez-le autrement. Une apostrophe ordinaire,
 *  une apostrophe courbe, un guillemet : aucun problème.
 *
 *  GRAMMAIRE
 *    === PANNEAU: <nom>        ouvre un panneau
 *    --- BLOC <type> ---       ouvre un bloc
 *    CLÉ: valeur               une donnée du bloc
 *
 *  BLOC entite — onglet « Habiter Terrebonne »
 *    ONGLET:  familles | communautes | horslaloi
 *    NOM:     nom affiché de la famille, de la communauté ou de la bande
 *    ORDRE:   facultatif, entier. Les blocs sans ORDRE gardent leur rang
 *             d'écriture et passent devant. Sert à épingler une entité en
 *             fin de liste sans déplacer son bloc.
 *    CHAPO:   deux à quatre lignes de présentation
 *    LIEN:    sujet des pré-liens de l'entité
 *    PL:      Nom ⟡ Rôle ⟡ Lien ⟡ Image          (répétable)
 *
 *  À SAVOIR SUR LES PL
 *    · Trois vignettes s'affichent. DÉCLAREZ-EN QUATRE OU CINQ : un pré-lien
 *      dont le faceclaim n'est plus libre disparaît de l'accueil et le suivant
 *      prend sa place. Indisponible = carte « pris », ou carte « réservé » dont
 *      l'échéance n'est pas passée. Une réservation périmée redevient libre
 *      toute seule, sans toucher à ce fichier.
 *    · Les trois derniers champs sont facultatifs. Si le bottin des faceclaims
 *      a une carte au nom du pré-lien, son image et son lien l'emportent sur ce
 *      qui est écrit ici : inutile de recopier une URL qui vit déjà là-bas.
 *    · Sans carte ni image, la vignette affiche une silhouette. C'est voulu.
 *
 *  BLOC membre — « Responsables de la Paroisse »
 *    PSEUDO:  EXACTEMENT le pseudo du compte : c'est la clé de recherche dans
 *             le bottin des faceclaims. Une faute, et le portrait retombe
 *             silencieusement sur IMG.
 *    ROLE:    qualité affichée sous le pseudo au survol
 *    LIEN:    profil ForumActif
 *    IMG:     secours, si le compte n'a pas de carte « pris » au bottin
 */

window.TDLI_DATA = `
=== PANNEAU: HABITANTS

--- BLOC entite ---
ONGLET: familles
NOM: Les Blackford
CHAPO: Une lignée ancrée à Houma depuis plus d'un siècle. Transport, logistique, terminal portuaire. La famille la plus influente de Terrebonne dans les faits, sans occuper la moindre position officielle.
LIEN: /t42-famille-blackford
PL: Galaad Blackford ⟡ Sécurité logistique, le Majeur ⟡ /t42-famille-blackford#483
PL: Gareth Blackford Jr. ⟡ Opérations fluviales, l'Auriculaire ⟡ /t42-famille-blackford#483
PL: Arthur Dorian Blackford ⟡ Analyste chez Blackbyrd ⟡ /t42-famille-blackford#483
PL: Cassandre Blackford ⟡ Chirurgienne, Doc ⟡ /t42-famille-blackford#483

--- BLOC entite ---
ONGLET: familles
NOM: Les Dumas
CHAPO: Créoles de Saint-Domingue installés à Montegut depuis 1793. Canne à sucre, raffinerie, biocarburant, et un lobby solide à Bâton-Rouge. La famille la plus politique de la paroisse, et la plus rancunière.
LIEN: /t52-famille-dumas
PL: Édouard Dumas III ⟡ 73 ans, le patriarche ⟡ /t52-famille-dumas
PL: Mathieu Dumas ⟡ 48 ans, directeur des opérations ⟡ /t52-famille-dumas
PL: Claire Dumas ⟡ 45 ans, relations institutionnelles ⟡ /t52-famille-dumas
PL: Théodore Dumas ⟡ 41 ans, l'héritier inattendu ⟡ /t52-famille-dumas

--- BLOC entite ---
ONGLET: communautes
NOM: Le bureau du shérif
ORDRE: 99
CHAPO: Juridiction sur toute la paroisse, du centre-ville de Houma aux bayous les plus reculés. Law Enforcement Center, Barrow Street. Tout le monde y passe un jour, d'un côté ou de l'autre du bureau.
LIEN: /t55-sherif-et-adjoints
PL: [MAJ] Nom ⟡ Rôle ⟡ /t55-sherif-et-adjoints
PL: [MAJ] Nom ⟡ Rôle ⟡ /t55-sherif-et-adjoints
PL: [MAJ] Nom ⟡ Rôle ⟡ /t55-sherif-et-adjoints
PL: [MAJ] Nom ⟡ Rôle ⟡ /t55-sherif-et-adjoints

=== PANNEAU: STAFF

--- BLOC membre ---
PSEUDO: Mami Wata
ROLE: Compte MJ
LIEN: /u1
IMG: https://zupimages.net/up/25/41/b3hn.png

--- BLOC membre ---
PSEUDO: Jason Blackford
ROLE: Fondatrice
LIEN: /u2
IMG: https://zupimages.net/up/25/10/8ynr.png

--- BLOC membre ---
PSEUDO: Alyssa Desrosiers
ROLE: Fondatrice
LIEN: /u3
IMG: https://zupimages.net/up/26/17/zwc0.jpg
`;
