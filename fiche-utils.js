/*
 * fiche-utils.js — Utilitaires du système de validation de fiche · TDL
 *
 * CE QUE CE FICHIER FAIT : fonctions pures sans effets DOM (sauf preremplirReponse),
 * chargement des listes membres, génération BBCode, posting dans un sujet FA.
 * CE QU'IL NE FAIT PAS : aucun rendu de formulaire, aucune logique staff.
 *
 * CARTE DES BLOCS :
 *   MEMBRES  — chargement des listes depuis le JSONBin
 *   DOM      — helpers d'affichage et pré-remplissage de SCEditor
 *   POSTING  — fetch + POST vers un sujet ForumActif
 *   BBCODE   — génération des messages membre et staff
 *
 * Dépend de : fiche-config.js, window.EcoCore
 */

(function (FI, CFG) {
  "use strict";

  /* === MEMBRES === */

  FI.chargerMembres = async function () {
    const rec = await window.EcoCore.safeReadBin();
    if (!rec?.membres) return [];
    return Object.keys(rec.membres).sort((a, b) => a.localeCompare(b, "fr"));
  };

  // Retourne uniquement les racines de groupes DC dont le slot est en attente,
  // car ce sont les seuls groupes auxquels un nouveau personnage peut être rattaché.
  FI.chargerRacinesDCEnAttente = async function () {
    const rec = await window.EcoCore.safeReadBin();
    if (!rec?.doubles_comptes) return [];
    return Object.entries(rec.doubles_comptes)
      .filter(([, g]) => g.slot_en_attente)
      .map(([racine]) => racine)
      .sort((a, b) => a.localeCompare(b, "fr"));
  };

  // Même problème Firebase que pour DC : les tableaux deviennent des objets
  FI.versTableau = function (v) {
    if (!v) return [];
    return Array.isArray(v) ? v : Object.values(v);
  };

  FI.genId = function () {
    return "fi_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  };

  /* === DOM === */

  FI.afficherResultat = function (el, type, html) {
    el.className = "fi-resultat " + type;
    el.innerHTML = html;
  };

  // Délègue à DC.preremplirReponse si disponible pour éviter la duplication de logique SCEditor.
  // [MAJ] Sélecteur TEXTAREA_REPONSE et API sceditor fragiles aux mises à jour FA.
  FI.preremplirReponse = function (texte) {
    if (window.DC?.preremplirReponse) { window.DC.preremplirReponse(texte); return; }
    const ta = document.querySelector(CFG.SEL.TEXTAREA_REPONSE);
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
  };

  /* === POSTING === */

  // Extrait l'ID numérique d'une URL FA : /t123-nom ou https://…/t123-nom → 123
  // [MAJ] Dépend du format d'URL de ForumActif (schéma /tN-)
  FI.extraireTopicId = function (url) {
    const m = String(url).match(/\/t(\d+)[-#]/);
    return m ? parseInt(m[1], 10) : null;
  };

  /*
   * Poste un message dans un sujet FA via fetch same-origin.
   * ForumActif injecte son formulaire de réponse via JavaScript : fetch() récupère
   * le HTML initial SANS l'exécution JS, donc le formulaire peut être absent.
   * Dans ce cas, on lève une erreur FALLBACK_NEEDED que fiche-staff.js intercepte
   * pour afficher le BBCode dans un textarea copiable.
   * [MAJ] Les sélecteurs de formulaire et l'URL de posting sont fragiles aux mises à jour FA.
   */
  FI.posterDansSujet = async function (topicId, contenu) {
    const pageRes = await fetch(`/posting.forum?mode=reply&t=${topicId}`, {
      credentials: "same-origin",
    });
    if (!pageRes.ok) throw new Error(`Erreur fetch page reply : ${pageRes.status}`);

    const html = await pageRes.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    // [MAJ] ForumActif peut changer le sélecteur ou l'action du formulaire
    const form = doc.querySelector("form[action*='posting']")
               || doc.querySelector("form[action*='post']")
               || doc.querySelector("#postform")
               || doc.querySelector("form[method='post']");

    if (!form) {
      // Le formulaire est injecté par JS et absent du HTML statique.
      // L'appelant (fiche-staff.js) affichera le message dans un textarea copiable.
      const err = new Error("FALLBACK_NEEDED");
      err.contenu = contenu;
      throw err;
    }

    const corps = new URLSearchParams();
    form.querySelectorAll("input[type='hidden']").forEach((i) => {
      if (i.name) corps.append(i.name, i.value);
    });
    corps.append("message", contenu);
    corps.append("post", "Envoyer"); // [MAJ] Valeur du bouton submit FA

    const action = form.getAttribute("action") || `/posting.forum?mode=reply&t=${topicId}`;
    const postRes = await fetch(action, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: corps.toString(),
      credentials: "same-origin",
    });
    if (!postRes.ok) throw new Error(`POST échoué : ${postRes.status}`);
  };

  /* === BBCODE === */

  FI.bbcodeDemande = function (d) {
    const prelienLigne = d.pre_lien
      ? `[url=${d.lien_pre_lien}]Voir le pré-lien[/url]`
      : "Non";
    const parrainLigne = d.parrain && d.parrain !== "Personne"
      ? `@"${d.parrain}"` : "Personne";
    const dcLigne = d.multicompte
      ? `Oui — compte racine : @"${d.premier_compte}"` : "Non";
    const bandeLigne = d.bande ? `${d.nom_bande} — ${d.role_bande}` : "Non";

    return [
      "[b]━━━ DEMANDE DE VALIDATION DE FICHE ━━━[/b]",
      "",
      `[b]Membre :[/b] @"${d.pseudo}"`,
      `[b]Fiche :[/b] [url=${d.lien_fiche}]Voir la fiche[/url]`,
      `[b]Pré-lien :[/b] ${prelienLigne}`,
      `[b]Arrivé(e) grâce à :[/b] ${parrainLigne}`,
      `[b]Multi-compte :[/b] ${dcLigne}`,
      `[b]Faceclaim :[/b] ${d.faceclaim}`,
      `[b]Groupe :[/b] ${d.groupe}`,
      `[b]Bande hors-la-loi :[/b] ${bandeLigne}`,
      `[b]Métier :[/b] ${d.lieu_metier} — ${d.societe} — ${d.emploi}`,
      `[b]Habitation :[/b] ${d.lieu_habitation} — ${d.logement}`,
      "",
      `[i]Réf. : ${d.id}[/i]`,
    ].join("\n");
  };

  FI.bbcodeValidation = function (d, msgPerso, staffPseudo) {
    return [
      "[b]━━━ FICHE VALIDÉE ━━━[/b]",
      "",
      `Bienvenue sur The Drowned Lands, [b]${d.pseudo}[/b] !`,
      "",
      msgPerso,
      "",
      `[code]<fb>${d.faceclaim}</fb> — ${d.pseudo}[/code]`,
      "",
      `[i]Validée par ${staffPseudo} le ${new Date().toLocaleDateString("fr-FR")}[/i]`,
    ].join("\n");
  };

})(window.FI, window.FI.CFG);
