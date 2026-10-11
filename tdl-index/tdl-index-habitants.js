/*
 * tdl-index-habitants.js — Habiter Terrebonne & Responsables · The Drowned Lands
 *
 * CE QUE CE FICHIER FAIT
 *   · construit le carrousel à onglets des pré-liens à partir du bloc
 *     #tdli-data déjà analysé par le core (TDLI.DATA) ;
 *   · résout les portraits dans le bottin des faceclaims : par nom_prelien
 *     pour un pré-lien, par pseudo pour un membre du staff ;
 *   · écarte les pré-liens dont le faceclaim n'est plus libre ;
 *   · rend les volets du staff avec le même composant.
 *
 * CE QU'IL NE FAIT PAS
 *   · aucune écriture. Une réservation se prend au bottin, pas ici.
 *   · aucune lecture propre du nœud si sos-pl-core est déjà sur la page : sa
 *     lecture de « faceclaims » est mutualisée, on s'y greffe.
 *
 * SCHÉMA LU
 *   faceclaims/{cle_acteur} = { acteur, statut, uid, pseudo, image,
 *                               nom_prelien, prelien_lien, expiration }
 *   statut : « pris » | « reserve » | « libre »
 *
 * POURQUOI UN BARÈME PLUTÔT QUE LA DERNIÈRE CARTE LUE : un même pseudo peut
 * porter plusieurs cartes — une réservation multicompte au nom du compte
 * racine coexiste avec la carte du personnage validé. Firebase rend les clés
 * par ordre alphabétique, ce qui n'a aucun sens ici. Même barème que le bottin
 * des métiers et le registre paroissial.
 *
 * PRÉREQUIS : tdl-index-core.js chargé AVANT. eco-core avant lui.
 *
 * CARTE DES BLOCS : CONFIG · TEXTES · FACECLAIMS · MODÈLE · VOLET
 *                   RENDU · TRANSITION · EVENTS · INIT
 */

window.TDLI = window.TDLI || {};
(function (NS) {
  "use strict";
  if (NS._habitants) return;
  NS._habitants = true;

  /* === CONFIG === */
  var CFG = {
    CHEMIN_FB: "faceclaims",
    VIGNETTES: 3,            // volets affichés par entité
    ONGLETS:   ["familles", "communautes", "horslaloi"],
    SORTIE_MS: 200,          // doit rester <= à la transition CSS de .tdli-ent
    IC_VIDE:   "fi fi-tr-user"
  };

  /* === TEXTES === */
  var T = {
    VIDE_ONGLET: "Aucune entité renseignée pour cet onglet.",
    TOUT_PRIS:   "Tous les pré-liens de cette entité sont pris pour le moment.",
    VOIR:        "Voir les pré-liens"
  };

  var esc = NS.esc, slug = NS.slug, jrn = NS.jrn;

  /* === FACECLAIMS === */

  function note(c) {
    return (c.statut === "pris" ? 4 : c.statut === "reserve" ? 1 : 0) + (c.image ? 2 : 0);
  }

  function indexer(fc) {
    var idx = { pseudo: {}, prelien: {} };
    Object.keys(fc || {}).forEach(function (k) {
      var c = fc[k], s;
      if (!c || typeof c !== "object") return;
      if (c.pseudo) {
        s = slug(c.pseudo);
        if (!idx.pseudo[s] || note(c) > note(idx.pseudo[s])) idx.pseudo[s] = c;
      }
      if (c.nom_prelien) {
        s = slug(c.nom_prelien);
        if (!idx.prelien[s] || note(c) > note(idx.prelien[s])) idx.prelien[s] = c;
      }
    });
    return idx;
  }

  function lireFaceclaims() {
    // 1. socle des pré-liens déjà sur la page : lecture mutualisée
    if (window.TDLPL && typeof window.TDLPL.litFaceclaims === "function") {
      return window.TDLPL.litFaceclaims().then(indexer);
    }
    // 2. sinon EcoCore, de toute façon chargé partout pour les jauges
    return NS.attendreEco().then(function (ok) {
      if (!ok) return null;
      return window.EcoCore.firebaseGet(CFG.CHEMIN_FB)
        .then(indexer)
        .catch(function (e) { jrn("faceclaims : " + e.message); return null; });
    });
  }

  var IDX = null;
  function cartePseudo(p) { return IDX ? (IDX.pseudo[slug(p)] || null) : null; }
  function cartePrelien(n) { return IDX ? (IDX.prelien[slug(n)] || null) : null; }

  /* Un pré-lien n'est proposé que si son faceclaim est réellement libre.
     « réservé » tient la carte le temps qu'une fiche se valide : indisponible
     jusqu'à l'échéance, libre de nouveau après, sans intervention humaine. */
  function indisponible(pl) {
    var c = cartePrelien(pl.nom);
    if (!c) return false;                       // absent du bottin : on fait confiance à la coquille
    if (c.statut === "pris") return true;
    if (c.statut === "reserve") return !(c.expiration && c.expiration < Date.now());
    return false;
  }

  /* === MODÈLE === */

  var ETAT = { onglet: CFG.ONGLETS[0], idx: 0 };

  /* Les blocs sans ORDRE gardent leur rang d'écriture et passent devant ;
     ORDRE sert à épingler une entité en fin de liste sans la déplacer dans
     le message d'accueil. */
  function entites(onglet) {
    var out = [];
    (NS.DATA.habitants || []).forEach(function (b, i) {
      if (b._type !== "entite" || slug(b.onglet) !== onglet) return;
      var o = (b.ordre != null && b.ordre !== "") ? parseInt(b.ordre, 10) : null;
      out.push({ bloc: b, rang: isNaN(o) ? null : o, ecrit: i });
    });
    out.sort(function (a, b) {
      if (a.rang === null && b.rang === null) return a.ecrit - b.ecrit;
      if (a.rang === null) return -1;
      if (b.rang === null) return 1;
      return a.rang - b.rang || a.ecrit - b.ecrit;
    });
    return out.map(function (x) { return x.bloc; });
  }

  /* === VOLET (composant commun) === */

  /* Jamais la propriété raccourcie background ici : elle remettrait
     background-size à auto et l'image cesserait d'être en cover. Et pas de
     guillemets dans url(…) : la déclaration part dans un attribut style="…",
     un guillemet le refermerait et le navigateur jetterait tout le reste. */
  function fondPhoto(url) {
    var u = NS.urlSure(url);
    return u ? "background-image:url(" + u + ");background-size:cover;" +
               "background-position:center 18%;" : "";
  }

  function volet(o) {
    var u = NS.urlSure(o.img);
    return '<a class="tdli-vol' + (o.large ? " tdli-vol-large" : "") + '" href="' +
             esc(o.url || "#") + '">' +
           '<span class="tdli-vol-photo" style="' + fondPhoto(o.img) + '">' +
             (u ? "" : '<i class="' + CFG.IC_VIDE + '" aria-hidden="true"></i>') +
           "</span>" +
           '<span class="tdli-vol-voile">' +
             '<span class="tdli-vol-nom">' + esc(o.nom) + "</span>" +
             (o.role ? '<span class="tdli-vol-role">' + esc(o.role) + "</span>" : "") +
           "</span></a>";
  }

  /* === RENDU === */

  function rendreEntite() {
    var hote = NS.el("#tdli-ent"), pos = NS.el("#tdli-pos");
    if (!hote) return;
    var liste = entites(ETAT.onglet);
    if (pos) pos.textContent = liste.length ? (ETAT.idx + 1) + " / " + liste.length : "";
    if (!liste.length) { hote.innerHTML = "<p>" + T.VIDE_ONGLET + "</p>"; return; }

    var e = liste[Math.min(ETAT.idx, liste.length - 1)];
    var libres = (e.pl || []).filter(function (pl) { return pl.nom && !indisponible(pl); })
                             .slice(0, CFG.VIGNETTES);

    var gauche = libres.length
      ? '<div class="tdli-volets">' + libres.map(function (pl) {
          var c = cartePrelien(pl.nom);
          return volet({
            nom:  pl.nom,
            role: pl.role,
            url:  (c && c.prelien_lien) || pl.url || e.lien,
            img:  (c && c.image) || pl.img
          });
        }).join("") + "</div>"
      : '<p>' + T.TOUT_PRIS + "</p>";

    hote.innerHTML = gauche +
      '<div class="tdli-ent-pres">' +
        "<h3>" + esc(e.nom || "") + "</h3>" +
        (e.chapo ? "<p>" + esc(e.chapo) + "</p>" : "") +
        (e.lien ? '<a class="tdli-lien" href="' + esc(e.lien) + '">' + T.VOIR +
                  ' <span class="tdli-fleche">&rarr;</span></a>' : "") +
      "</div>";
  }

  function rendreStaff() {
    var hote = NS.el("#tdli-eq");
    if (!hote) return;
    hote.innerHTML = (NS.DATA.staff || []).map(function (m) {
      if (m._type !== "membre" || !m.pseudo) return "";
      var c = cartePseudo(m.pseudo);
      return volet({
        nom:   m.pseudo,
        role:  m.role,
        url:   m.lien,
        img:   (c && c.image) || m.img,
        large: true
      });
    }).join("");
  }

  /* === TRANSITION ===
     Le contenu sort du côté vers lequel on va et le suivant entre par l'autre
     bord ; un changement d'onglet n'a pas de direction, il monte. Le verrou
     évite qu'un double clic mette à jour le contenu au milieu d'une sortie. */
  var anime = false;

  function transition(sortie, entree, maj) {
    var hote = NS.el("#tdli-ent");
    if (!hote || anime) { if (!hote) maj(); return; }
    anime = true;
    hote.classList.add(sortie);
    setTimeout(function () {
      maj();
      hote.classList.remove(sortie);
      hote.classList.add(entree);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          hote.classList.remove(entree);
          anime = false;
        });
      });
    }, CFG.SORTIE_MS);
  }

  function pas(d) {
    var liste = entites(ETAT.onglet);
    if (liste.length < 2) return;
    transition(d > 0 ? "tdli-vers-g" : "tdli-vers-d",
               d > 0 ? "tdli-vers-d" : "tdli-vers-g",
               function () {
                 ETAT.idx = (ETAT.idx + d + liste.length) % liste.length;
                 rendreEntite();
               });
  }

  /* === EVENTS === */

  function brancher() {
    document.querySelectorAll(".tdli-tab").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.getAttribute("aria-selected") === "true") return;
        document.querySelectorAll(".tdli-tab").forEach(function (x) {
          x.setAttribute("aria-selected", "false");
        });
        b.setAttribute("aria-selected", "true");
        transition("tdli-vers-h", "tdli-vers-h", function () {
          ETAT.onglet = slug(b.getAttribute("data-onglet"));
          ETAT.idx = 0;
          rendreEntite();
        });
      });
    });
    var p = NS.el("#tdli-prev"), s = NS.el("#tdli-next");
    if (p) p.addEventListener("click", function () { pas(-1); });
    if (s) s.addEventListener("click", function () { pas(1); });
  }

  /* === INIT === */

  var monte = false;

  function init() {
    if (monte) return;
    monte = true;
    if (!NS.el("#tdli-ent")) return;

    var actif = document.querySelector('.tdli-tab[aria-selected="true"]');
    ETAT.onglet = slug((actif && actif.getAttribute("data-onglet")) || CFG.ONGLETS[0]);

    brancher();
    // Premier rendu avec ce que porte la coquille : la page ne reste jamais
    // vide en attendant le bottin.
    rendreEntite();
    rendreStaff();

    lireFaceclaims().then(function (idx) {
      if (!idx) return;
      IDX = idx;
      rendreEntite();      // certains pré-liens peuvent disparaître ici
      rendreStaff();
    });
  }

  NS.initHabitants = init;
  // Filet si le core a déjà monté la page avant le chargement de ce fichier.
  NS.pret(function () { setTimeout(init, 0); });
})(window.TDLI);
