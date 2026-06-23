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
    const esc = (s) => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const parrain = (d.parrain && d.parrain !== "Personne") ? `@"${d.parrain}"` : "Personne";
    const prelien = d.pre_lien
      ? `<span>Pré-lien</span> <a href="${esc(d.lien_pre_lien)}"><i class="fi fi-tr-link-alt"></i></a>`
      : `<span>Pré-lien : non</span>`;
    const mc = d.multicompte
      ? `<span>oui</span> <span>@"${d.premier_compte}"</span>`
      : `<span>non</span>`;
    const bande = d.bande
      ? `<span>${esc(d.nom_bande)}</span> <span>${esc(d.role_bande)}</span>`
      : `<span>non</span>`;

    return `<div id="validation-fiche" class="sj-fiche"><div class="h1"><h1>Demande de validation</h1></div>
<tw><span>lire la fiche de @"${d.pseudo}"</span> <a href="${esc(d.lien_fiche)}"><i class="fi fi-ts-circle-book-open"></i></a> <span>Arrivé grâce à ${parrain}</span> ${prelien}</tw>
<div class="sj-formgen"><div class="sj-formcol"><f4>Administratif</f4><d>Multicompte</d> ${mc}
<d>Faceclaim</d> <span>${esc(d.faceclaim)}</span>
<d>Groupe</d> <span>${esc(d.groupe)}</span></div><div class="sj-formcol"><f4>Personnage & bottins</f4><d>Bande hors-la-loi</d> ${bande}
<d>Métier</d> <span>${esc(d.lieu_metier)}</span> <span>${esc(d.societe)}</span> <span>${esc(d.emploi)}</span>
<d>Habitation</d> <span>${esc(d.lieu_habitation)}</span> <span>${esc(d.numero)}</span> <span>${esc(d.type_logement)}</span></div>
</div></div>`;
  };

  FI.bbcodeValidation = function (d, msgPerso, staffPseudo) {
    return [
      "[b]━━━ FICHE VALIDÉE ━━━[/b]",
      "",
      `Bienvenue sur The Drowned Lands, [b]${d.pseudo}[/b] !`,
      "",
      msgPerso,
      "",
      `[i]Validée par ${staffPseudo} le ${new Date().toLocaleDateString("fr-FR")}[/i]`,
    ].join("\n");
  };

})(window.FI, window.FI.CFG);
