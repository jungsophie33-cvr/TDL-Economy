/*
 * recensement-render.js — Rendu du recensement et panel staff · TDL
 *
 * Résumé : Affiche 5 colonnes live sur le sujet du recensement. Overrides staff
 * (↑↓), colonne "Futurs repas du Doyen" (suppressions), snapshot du 25 avec
 * préremplissage SCEditor automatique. 0 CSS inline — voir recensement.css.
 *
 * [MAJ v3] PLUS AUCUNE LECTURE DE RACINE NI D'invalidateCache.
 *   lireFrais() appelait invalidateCache() puis readBin() : 172 ko tirés
 *   TOUTES LES 5 MINUTES tant que la page restait ouverte, plus à chaque clic
 *   sur ↻ et après chaque flèche d'override. Et l'invalidateCache vidait le
 *   cache de session partagé, forçant tous les autres modules de la page à
 *   relire la racine à leur tour.
 *   Quatre branches ciblées suffisent (~6 ko), et firebaseGet ignore le cache :
 *   la lecture est fraîche par construction.
 *
 * [MAJ v3] LES TROIS ÉCRITURES SONT CIBLÉES.
 *   writeBin(rec) réécrivait la branche recensement ENTIÈRE depuis un
 *   instantané. Le cas le plus visible : les flèches ↑↓ des overrides. Deux
 *   admins cliquant dans la même minute s'annulaient l'un l'autre, en silence.
 *   Un override ne touche plus que son propre chemin.
 *
 * [MAJ v3] GARDE D'URL. Sans elle, la boucle d'attente de recensement-init
 *   tourne 30 s sur CHAQUE page du forum avant d'abandonner.
 *
 * [MAJ v3] LE BLOC PUBLIÉ EST EN HTML TDL, plus en BBCode.
 *
 * CARTE DES BLOCS :
 *   GARDE    — restriction au sujet du recensement
 *   UTILS    — estStaff, tri, moisLabel, échappement
 *   SCEDITOR — preremplirReponse (API SCEditor + fallback natif)
 *   BLOC     — génération du bloc "menacés le 25"
 *   DONNÉES  — lecture ciblée, écritures ciblées
 *   RENDER   — colonnes, boutons overrides
 *   EVENTS   — snapshot du 25, liste finale du 1er
 *   AFFICHAGE — orchestration principale
 *   INIT     — window.RC.initRender
 */

(function () {
  "use strict";

  window.RC = window.RC || {};
  const CFG  = () => window.RC.CFG;
  const T    = () => window.RC.T;
  const trier = arr => [...arr].sort((a, b) => a.localeCompare(b, "fr"));

    /* === GARDE =====================
     Filtre partagé, défini dans recensement-config. initRender reste indéfini
     ailleurs : recensement-init ne l'appelle que sur ce sujet. */
  if (!window.RC.surLeSujet(window.RC.CFG && window.RC.CFG.TOPIC_SLUG)) return;
  /* initRender reste indéfini hors du sujet : recensement-init ne l'appelle
     que là-bas, personne ne s'en plaint ailleurs. */

  /* === UTILS === */

  function estStaff() {
    return CFG().STAFF_USERS.includes(window.EcoCore?.getPseudo?.() || "");
  }

  function moisLabel(date) {
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }

  /* Les pseudos partent dans du HTML publié : on les échappe. */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* === SCEDITOR === */

  /*
   * Même pattern que DC.preremplirReponse (eco-dc-utils.js) — délègue si disponible.
   * [MAJ] Sélecteur TEXTAREA_REPONSE et API sceditor fragiles aux mises à jour FA.
   */
  function preremplirReponse(texte) {
    if (window.DC?.preremplirReponse) { window.DC.preremplirReponse(texte); return; }
    const ta = document.querySelector(CFG().SEL.TEXTAREA_REPONSE);
    if (!ta) return;
    if (window.sceditor) {
      const inst = window.sceditor.instance(ta);
      if (inst) { inst.val(texte); ta.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, texte);
    ta.dispatchEvent(new Event("input",  { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    ta.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* === BLOC PUBLIÉ =====================
     [MAJ v3] HTML TDL (.sj-fiche) au lieu du BBCode.
     Les mentions gardent la forme @"pseudo" : c'est elle que ForumActif
     reconnaît pour notifier le membre. */

  function genBlocMenaces(pseudos, labelDate) {
    const lignes = trier(pseudos).map(p => `@"${esc(p)}"`).join("\n");
    return `<div id="tdl-snap" class="sj-fiche"><div class="h1"><h1>Recensement du ${esc(labelDate)}</h1></div>
<tw>N'ayant pas posté de RP entre le 1er et le 25 du mois</tw>
<div class="sj-formgen"><div class="sj-formcol"><f4>Paroissiens menacés par le Doyen</f4>
Si vous êtes cités ci-après, vous avez jusqu'au dernier jour du mois pour régulariser votre situation.
N'hésitez pas à contacter le staff au cas où votre rp n'aurait pas été détecté (envoyez-nous le lien), ou à nous communiquer tout empêchement exceptionnel.

${lignes || "(aucun)"}

La liste définitive des comptes disparus sera publiée le 1er du mois prochain.</div></div>
</div>`;
  }

  /* === DONNÉES =====================
     [MAJ v3] Quatre branches ciblées (~6 ko) au lieu des 172 ko de la racine.
     firebaseGet ne passe pas par le cache de session : inutile de le jeter
     pour obtenir une lecture fraîche. */

  const BRANCHES = ["membres", "absences", "demandes_fiche", "recensement"];

  async function lireFrais() {
    const v = await Promise.all(BRANCHES.map(b => window.EcoCore.firebaseGet(b)));
    const rec = {};
    BRANCHES.forEach((b, i) => { rec[b] = v[i] || {}; });
    return rec;
  }

  /* Toutes les écritures de ce fichier visent un chemin sous recensement/{mois}.
     Aucune ne relit ni ne réécrit la branche. */
  function ecrire(updates) {
    return window.EcoCore.firebaseUpdate(updates);
  }

  /* === RENDER === */

  function creerColonne(titre, pseudos, modCss) {
    const div = document.createElement("div");
    div.className = `rc-col rc-col--${modCss}`;
    const h = document.createElement("p");
    h.className = `rc-col-titre rc-col-titre--${modCss}`;
    h.textContent = `${titre} (${pseudos.length})`;
    const ul = document.createElement("div");
    ul.className = "rc-col-liste";
    trier(pseudos).forEach(p => {
      const li = document.createElement("span");
      li.className = "rc-col-item";
      li.dataset.pseudo = p;
      li.textContent = p;
      ul.appendChild(li);
    });
    div.append(h, ul);
    return div;
  }

  function ajouterBtnOverride(colonne, cibleOverride, rec, moisKey, zone) {
    if (!estStaff()) return;
    const label = cibleOverride === "recense" ? T().BTN_VERS_RECENSE : T().BTN_VERS_MENACE;
    colonne.querySelectorAll(".rc-col-item[data-pseudo]").forEach(item => {
      const btn = document.createElement("button");
      btn.className = "rc-btn-override";
      btn.textContent = label;
      btn.addEventListener("click", async () => {
        /* [MAJ v3] un seul chemin : l'override de CE membre, pour CE mois.
           L'ancien readBin → mutation → writeBin réécrivait la branche
           recensement entière depuis un instantané : deux admins cliquant dans
           la même minute s'annulaient, sans rien afficher.
           La clé est le pseudo brut, comme dans les données existantes. Un
           pseudo contenant . # $ [ ] / ferait refuser le PATCH — aucun n'en
           porte aujourd'hui. */
        btn.disabled = true;
        try {
          await ecrire({
            [`recensement/${moisKey}/overrides_staff/${item.dataset.pseudo}`]: cibleOverride
          });
        } catch (e) {
          if (window.console) console.error("[recensement] override", e);
        }
        afficherRecensement(zone);
      });
      item.appendChild(btn);
    });
  }

  /* === EVENTS === */

  async function genererSnapshot(rec, moisKey, zone) {
    const snp = Object.assign({}, rec.recensement?.[moisKey]);
    const now = new Date();

    // Le snapshot du 25 utilise un seuil d'absence réduit (≥ 10j) :
    // absence déclarée depuis ≥ 10j → exclu du bloc "menacés"
    // absence < 10j → toujours dans "menacés" et tagué dans la notification
    // Le calcul final du 1er utilisera le seuil normal (15j) avec cas par cas staff.
    const listesSnap = window.RC.Calcul.calculerListes(
      rec, now, CFG().SEUIL_ABSENCE_SNAPSHOT
    );
    if (snp.overrides_staff) window.RC.Calcul.appliquerOverrides(listesSnap, snp.overrides_staff);

    Object.assign(snp, {
      genere_le:       now.toISOString(),
      genere_le_label: now.toLocaleDateString("fr-FR"),
      recenses:        [...listesSnap.recenses],
      menaces_25:      [...listesSnap.menaces],
      absents:         [...listesSnap.absents],
      suppressions:    [...listesSnap.suppressions],
    });

    /* [MAJ v3] le seul mois concerné, en un PATCH. snp est une COPIE : les
       overrides déjà posés y sont recopiés tels quels, jamais effacés. */
    try { await ecrire({ [`recensement/${moisKey}`]: snp }); }
    catch (e) {
      if (window.console) console.error("[recensement] snapshot", e);
      alert("Enregistrement du snapshot impossible — rien n'a été publié.");
      return;
    }
    preremplirReponse(genBlocMenaces(snp.menaces_25, snp.genere_le_label));
    afficherRecensement(zone);
  }

  async function finaliserListe(rec, moisKey, listes, zone) {
    /* [MAJ v3] deux feuilles, pas la branche */
    try {
      await ecrire({
        [`recensement/${moisKey}/liste_finale_1er`]: [...listes.menaces],
        [`recensement/${moisKey}/finalise_le`]:      new Date().toISOString(),
      });
    } catch (e) {
      if (window.console) console.error("[recensement] finalisation", e);
      alert("Enregistrement impossible — la liste n'a pas été figée.");
      return;
    }
    afficherRecensement(zone);
  }

  function creerPanelStaff(rec, moisKey, listes, zone) {
    const panel = document.createElement("div");
    panel.className = "rc-staff-panel";

    const titre = document.createElement("p");
    titre.className = "rc-staff-titre";
    titre.textContent = "Actions staff — Recensement";
    panel.appendChild(titre);

    const jourd = new Date().getDate();
    const snp   = rec.recensement?.[moisKey];

    if (jourd === CFG().JOUR_RECENSEMENT && !snp?.genere_le) {
      const btn = document.createElement("button");
      btn.className = "rc-btn-action";
      btn.textContent = T().BTN_GENERER;
      btn.addEventListener("click", () => genererSnapshot(rec, moisKey, zone));
      const note = document.createElement("p");
      note.className = "rc-staff-note";
      note.textContent = "Le bloc sera automatiquement inséré dans la réponse rapide.";
      panel.append(btn, note);
    } else if (snp?.genere_le) {
      const info = document.createElement("p");
      info.className = "rc-staff-ok";
      info.textContent = T().DEJA_GENERE(snp.genere_le_label);
      panel.appendChild(info);
    } else {
      const info = document.createElement("p");
      info.className = "rc-staff-note";
      info.textContent = T().PAS_LE_25;
      panel.appendChild(info);
    }

    if (jourd === 1 && snp?.menaces_25 && !snp?.liste_finale_1er) {
      const btn2 = document.createElement("button");
      btn2.className = "rc-btn-action";
      btn2.textContent = T().BTN_FINALISER;
      btn2.addEventListener("click", () => finaliserListe(rec, moisKey, listes, zone));
      panel.appendChild(btn2);
    }
    return panel;
  }

  /* === AFFICHAGE === */

  async function afficherRecensement(zone) {
    // Préserver la barre de statut si elle existe déjà (évite le flash au refresh)
    const ancienStatut = zone.querySelector(".rc-statut");
    if (!ancienStatut) zone.innerHTML = "<p class='rc-chargement'>Chargement du recensement…</p>";

    let rec;
    try { rec = await lireFrais(); }
    catch (e) {
      if (window.console) console.error("[recensement] lecture", e);
      zone.innerHTML = `<p class='rc-erreur'>${T().ERR_DONNEES}</p>`;
      return;
    }

    const now     = new Date();
    const moisKey = window.RC.Calcul.cleMois(now);
    const snp     = rec.recensement?.[moisKey];

    zone.innerHTML = "";

    // En-tête : titre + horodatage + bouton de rafraîchissement manuel
    const entete = document.createElement("div");
    entete.className = "rc-entete";

    const titre = document.createElement("div");
    titre.className = "mc-head";
    titre.innerHTML = `<h3>Recensement automatique</h3><p>${moisLabel(now)}</p>`;

    const statut = document.createElement("span");
    statut.className = "rc-statut";
    statut.textContent = `Mis à jour à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

    const btnRefresh = document.createElement("button");
    btnRefresh.className = "rc-btn-refresh";
    btnRefresh.title = "Rafraîchir maintenant";
    btnRefresh.textContent = "↻";
    // Rafraîchissement manuel — utile entre deux cycles de polling
    btnRefresh.addEventListener("click", () => afficherRecensement(zone));

    entete.append(titre, statut, btnRefresh);
    zone.appendChild(entete);

    let listes = window.RC.Calcul.calculerListes(rec, now);
    if (snp?.overrides_staff) listes = window.RC.Calcul.appliquerOverrides(listes, snp.overrides_staff);

    const grille = document.createElement("div");
    grille.className = "rc-grille";

    const colR = creerColonne(T().TITRE_RECENSES,    listes.recenses,    "recenses");
    const colM = creerColonne(T().TITRE_MENACES,     listes.menaces,     "menaces");
    const colA = creerColonne(T().TITRE_ABSENTS,     listes.absents,     "absents");
    const colN = creerColonne(T().TITRE_NOUVEAUX,    listes.nouveaux,    "nouveaux");
    const colS = creerColonne(T().TITRE_SUPPRESSION, listes.suppressions,"suppression");

    ajouterBtnOverride(colM, "recense", rec, moisKey, zone);
    ajouterBtnOverride(colR, "menace",  rec, moisKey, zone);

    grille.append(colR, colM, colA, colN, colS);
    zone.appendChild(grille);

    if (estStaff()) zone.appendChild(creerPanelStaff(rec, moisKey, listes, zone));
  }

  /* === INIT === */

  // POLL_INTERVAL : rafraîchissement automatique toutes les 5 minutes.
  // Garantit que la liste reste à jour même si la page est laissée ouverte.
  // La liste s'actualise aussi à chaque chargement de page (comportement de base).
  const POLL_INTERVAL_MS = 5 * 60 * 1000;

  window.RC.initRender = function (zone) {
    afficherRecensement(zone);
    // Le polling est lancé une seule fois par session de page
    setInterval(() => afficherRecensement(zone), POLL_INTERVAL_MS);
  };

})();
