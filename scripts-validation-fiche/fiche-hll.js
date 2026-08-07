/*
 * fiche-hll.js — Bloc « Hors-la-loi » du formulaire de validation · TDL
 *
 * CE QUE CE FICHIER FAIT : deux questions indépendantes, lues dans BHL_CONFIG :
 *   Q1 — Membre d'une bande ? (non/oui) → champs conditionnels par bande → hors_la_loi
 *   Q2 — Lien avec la Main (réseau) ou la Flottille (pilier) ? → liens (cumulable)
 * Produit un objet hors_la_loi aux MÊMES clés que les onglets du bottin
 * (type/doigt/chef pour la Main, capitaine pour la Flottille, etc.) et un lien
 * { type, …, statut:null } — la dette restant posée par le staff plus tard.
 * CE QU'IL NE FAIT PAS : rendu de la modale, logique staff.
 *
 * COMPATIBILITÉ : la demande porte toujours `bande` (booléen) + `nom_bande`/`role_bande`
 * (récap lisible pour la carte staff et le post de demande) ; s'y ajoutent les objets
 * structurés `hll` et `lien`, consommés par fiche-staff (affecterBande).
 *
 * CARTE DES BLOCS : TEXTES · RENDER · EVENTS · LECTURE · VALIDATION · RÉSUMÉ
 *
 * Dépend de : fiche-config.js, fiche-utils.js, tdl-bohl-config.js (window.BHL_CONFIG)
 * À charger APRÈS fiche-utils.js et tdl-bohl-config.js, AVANT fiche-membre.js.
 */

(function (FI, CFG, T) {
  "use strict";

  var esc = function (s) { return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;"); };
  var C = function () { return window.BHL_CONFIG; };
  var anneeCourante = function () { return String(new Date().getFullYear()); };

  /* === TEXTES === */
  Object.assign(T, {
    HLL_MEMBRE:     "Membre d'une bande hors-la-loi ?",
    HLL_BANDE:      "Bande",
    HLL_CHOISIR:    "— Choisir —",
    HLL_DEPUIS:     "Depuis (année)",
    HLL_CATEGORIE:  "Catégorie",
    HLL_VOCATION:   "Vocation",
    HLL_SPEC:       "Spécialité",
    HLL_CELLULE:    "Cellule",
    HLL_NAVIRE:     "Navire",
    HLL_ROLE:       "Rôle",
    HLL_ROLE_RITUEL:"Rôle rituel",
    HLL_LIEU:       "Lieu d'ancrage",
    HLL_POSITION:   "Position",
    HLL_DOIGT:      "Doigt",
    HLL_CAPITAINE:  "Je tiens la barre de ce navire (capitaine)",
    HLL_PORTEUR:    "Je dirige ce Doigt",
    HLL_LIEN_Q:     "Ton personnage fait-il partie du réseau de contacts de la Main ou de la Flottille ?",
    HLL_LIEN_AUCUN: "Aucun",
    HLL_LIEN_MAIN:  "Réseau de la Main",
    HLL_LIEN_FLO:   "Pilier de la Flottille",
    HLL_CONCOURS:   "Concours apporté",
    ERR_HLL_BANDE:  "⚠️ Choisis ta bande hors-la-loi (ou réponds Non).",
    ERR_HLL_CHAMPS: "⚠️ Complète les champs de ta bande (sélection et rôle).",
    ERR_HLL_LIEN:   "⚠️ Complète les champs de ton lien (catégorie/rôle ou concours).",
  });

  /* === RENDER === */
  FI.hllHTML = function () {
    var B = C().bandes;
    var bandeOpts = '<option value="">' + T.HLL_CHOISIR + '</option>'
      + C().ordre.map(function (k) { return '<option value="' + k + '">' + esc(B[k].nom) + '</option>'; }).join("");
    var optCat = function (m) { return Object.keys(m).map(function (k) { return '<option value="' + k + '">' + esc(m[k]) + '</option>'; }).join(""); };
    var optNom = function (m) { return Object.keys(m).map(function (k) { return '<option value="' + k + '">' + esc(m[k].nom) + '</option>'; }).join(""); };
    var grp = function (bande, inner) { return '<div class="fi-conditionnel fi-hll-grp" data-bande="' + bande + '">' + inner + '</div>'; };
    var lbl = function (t) { return '<label class="fi-label">' + t + '</label>'; };

    var gFai = grp("faiseuses",
      lbl(T.HLL_CATEGORIE) + '<select id="fi-hll-fai-cat" class="fi-select">' + optCat(B.faiseuses.categories) + '</select>'
      + lbl(T.HLL_VOCATION) + '<input id="fi-hll-fai-voc" class="fi-input" type="text" placeholder="Infirmière, confident…">');
    var gBra = grp("braconneurs",
      lbl(T.HLL_SPEC) + '<select id="fi-hll-bra-spec" class="fi-select">' + optNom(B.braconneurs.specialites) + '</select>'
      + lbl(T.HLL_ROLE) + '<input id="fi-hll-bra-role" class="fi-input" type="text" placeholder="Trappeur, préparateur…">');
    var gMar = grp("maringouins",
      lbl(T.HLL_CELLULE) + '<select id="fi-hll-mar-cellule" class="fi-select">' + optNom(B.maringouins.cellules) + '</select>'
      + lbl(T.HLL_ROLE) + '<input id="fi-hll-mar-role" class="fi-input" type="text" placeholder="Guetteur, passeur…">');
    var gFlo = grp("flottille",
      lbl(T.HLL_NAVIRE) + '<select id="fi-hll-flo-navire" class="fi-select">' + optNom(B.flottille.navires) + '</select>'
      + lbl(T.HLL_ROLE) + '<input id="fi-hll-flo-role" class="fi-input" type="text" placeholder="Mécanicien, guide…">'
      + '<label class="fi-hll-chk"><input type="checkbox" id="fi-hll-flo-cap"> ' + T.HLL_CAPITAINE + '</label>');
    var doigtOpts = B.main.ordre_doigts.map(function (k) { return '<option value="' + k + '">' + esc(B.main.doigts[k].nom) + '</option>'; }).join("");
    var gMain = grp("main",
      lbl(T.HLL_POSITION) + '<select id="fi-hll-main-type" class="fi-select">'
        + '<option value="cavalier">' + esc(B.main.types.cavalier) + '</option>'
        + '<option value="doigt">' + esc(B.main.types.doigt) + '</option></select>'
      + '<div id="fi-hll-main-doigt-wrap" class="fi-conditionnel">'
        + lbl(T.HLL_DOIGT) + '<select id="fi-hll-main-doigt" class="fi-select">' + doigtOpts + '</select>'
        + lbl(T.HLL_ROLE) + '<input id="fi-hll-main-role" class="fi-input" type="text" placeholder="Renseignement, exécution…">'
        + '<label class="fi-hll-chk"><input type="checkbox" id="fi-hll-main-chef"> ' + T.HLL_PORTEUR + '</label>'
      + '</div>');
    var gSor = grp("sorcieres",
      lbl(T.HLL_ROLE_RITUEL) + '<select id="fi-hll-sor-role" class="fi-select">' + optNom(B.sorcieres.roles) + '</select>'
      + lbl(T.HLL_LIEU) + '<input id="fi-hll-sor-lieu" class="fi-input" type="text" list="fi-hll-sor-lieux" placeholder="Lost Bayou, Houma…">'
      + '<datalist id="fi-hll-sor-lieux">' + B.sorcieres.lieux.map(function (l) { return '<option value="' + esc(l) + '">'; }).join("") + '</datalist>');

    var lienCatOpts = Object.keys(B.main.reseau_cat).map(function (k) { return '<option value="' + k + '">' + esc(B.main.reseau_cat[k]) + '</option>'; }).join("");

    return ''
      + '<fieldset class="fi-fieldset"><legend>Bande hors-la-loi</legend>'
      +   '<div class="fi-rangee"><span class="fi-label">' + T.HLL_MEMBRE + '</span>'
      +     '<label><input type="radio" name="fi-hll-membre" value="non" checked> Non</label>'
      +     '<label><input type="radio" name="fi-hll-membre" value="oui"> Oui</label></div>'
      +   '<div id="fi-hll-detail" class="fi-conditionnel">'
      +     lbl(T.HLL_BANDE) + '<select id="fi-hll-bande" class="fi-select">' + bandeOpts + '</select>'
      +     gFai + gBra + gMar + gFlo + gMain + gSor
      +     lbl(T.HLL_DEPUIS) + '<input id="fi-hll-depuis" class="fi-input" type="text" placeholder="' + anneeCourante() + '">'
      +   '</div>'
      + '</fieldset>'
      + '<fieldset class="fi-fieldset"><legend>Lien avec la Main ou la Flottille</legend>'
      +   lbl(T.HLL_LIEN_Q)
      +   '<select id="fi-hll-lien" class="fi-select">'
      +     '<option value="">' + T.HLL_LIEN_AUCUN + '</option>'
      +     '<option value="reseau_main">' + T.HLL_LIEN_MAIN + '</option>'
      +     '<option value="pilier_flottille">' + T.HLL_LIEN_FLO + '</option></select>'
      +   '<div id="fi-hll-lien-reseau" class="fi-conditionnel">'
      +     lbl(T.HLL_CATEGORIE) + '<select id="fi-hll-lien-cat" class="fi-select">' + lienCatOpts + '</select>'
      +     lbl(T.HLL_ROLE) + '<input id="fi-hll-lien-role" class="fi-input" type="text" placeholder="Fournisseur, informateur…">'
      +   '</div>'
      +   '<div id="fi-hll-lien-pilier" class="fi-conditionnel">'
      +     lbl(T.HLL_CONCOURS) + '<input id="fi-hll-lien-concours" class="fi-input" type="text" placeholder="bacs de glace, contact radio…">'
      +   '</div>'
      + '</fieldset>';
  };

  /* === EVENTS === */
  FI.hllBrancher = function (overlay) {
    overlay.querySelectorAll('[name="fi-hll-membre"]').forEach(function (r) {
      r.addEventListener("change", function () {
        var oui = overlay.querySelector('[name="fi-hll-membre"]:checked').value === "oui";
        overlay.querySelector("#fi-hll-detail").classList.toggle("fi-visible", oui);
      });
    });
    var selB = overlay.querySelector("#fi-hll-bande");
    selB.addEventListener("change", function () {
      overlay.querySelectorAll(".fi-hll-grp").forEach(function (g) {
        g.classList.toggle("fi-visible", g.dataset.bande === selB.value);
      });
    });
    var selT = overlay.querySelector("#fi-hll-main-type");
    if (selT) selT.addEventListener("change", function () {
      overlay.querySelector("#fi-hll-main-doigt-wrap").classList.toggle("fi-visible", selT.value === "doigt");
    });
    var selL = overlay.querySelector("#fi-hll-lien");
    selL.addEventListener("change", function () {
      overlay.querySelector("#fi-hll-lien-reseau").classList.toggle("fi-visible", selL.value === "reseau_main");
      overlay.querySelector("#fi-hll-lien-pilier").classList.toggle("fi-visible", selL.value === "pilier_flottille");
    });
  };

  /* === LECTURE === */
  FI.hllLecture = function (overlay) {
    var B = C().bandes;
    var v = function (id) { var e = overlay.querySelector(id); return e ? (e.type === "checkbox" ? e.checked : e.value.trim()) : ""; };
    var membre = ((overlay.querySelector('[name="fi-hll-membre"]:checked') || {}).value === "oui");
    var hll = null, nom_bande = "", role_bande = "";

    if (membre) {
      var bande = v("#fi-hll-bande");
      var depuis = v("#fi-hll-depuis") || anneeCourante();
      if (bande === "faiseuses") {
        var cat = v("#fi-hll-fai-cat"), voc = v("#fi-hll-fai-voc");
        hll = { bande: bande, categorie: cat, vocation: voc, depuis: depuis };
        nom_bande = B.faiseuses.nom; role_bande = voc + (cat ? " (" + B.faiseuses.categories[cat] + ")" : "");
      } else if (bande === "braconneurs") {
        var sp = v("#fi-hll-bra-spec"), rb = v("#fi-hll-bra-role");
        hll = { bande: bande, spec: sp, role: rb, depuis: depuis };
        nom_bande = B.braconneurs.nom; role_bande = rb + (sp ? " — " + B.braconneurs.specialites[sp].nom : "");
      } else if (bande === "maringouins") {
        var ce = v("#fi-hll-mar-cellule"), rm = v("#fi-hll-mar-role");
        hll = { bande: bande, cellule: ce, role: rm, depuis: depuis };
        nom_bande = B.maringouins.nom; role_bande = rm + (ce ? " — " + B.maringouins.cellules[ce].nom : "");
      } else if (bande === "flottille") {
        var nv = v("#fi-hll-flo-navire"), rf = v("#fi-hll-flo-role"), cap = v("#fi-hll-flo-cap");
        hll = { bande: bande, navire: nv, capitaine: !!cap, role: rf, depuis: depuis };
        nom_bande = B.flottille.nom; role_bande = (cap ? "Capitaine — " : "") + rf + (nv ? " — " + B.flottille.navires[nv].nom : "");
      } else if (bande === "main") {
        var ty = v("#fi-hll-main-type");
        if (ty === "doigt") {
          var dg = v("#fi-hll-main-doigt"), rmn = v("#fi-hll-main-role"), chef = v("#fi-hll-main-chef");
          hll = { bande: bande, type: "doigt", doigt: dg, role: rmn, chef: !!chef, depuis: depuis };
          nom_bande = B.main.nom; role_bande = (B.main.doigts[dg] ? B.main.doigts[dg].nom : "") + " — " + rmn + (chef ? " (Porteur)" : "");
        } else {
          hll = { bande: bande, type: "cavalier", depuis: depuis };
          nom_bande = B.main.nom; role_bande = "Cavalier";
        }
      } else if (bande === "sorcieres") {
        var ro = v("#fi-hll-sor-role"), li = v("#fi-hll-sor-lieu");
        hll = { bande: bande, role: ro, lieu: li, depuis: depuis };
        nom_bande = B.sorcieres.nom; role_bande = (B.sorcieres.roles[ro] ? B.sorcieres.roles[ro].nom : "") + (li ? " — " + li : "");
      } else {
        membre = false;   // « Oui » coché mais aucune bande choisie
      }
    }

    var lien = null, lt = v("#fi-hll-lien");
    if (lt === "reseau_main")       lien = { type: "reseau_main", categorie: v("#fi-hll-lien-cat"), role: v("#fi-hll-lien-role"), statut: null };
    else if (lt === "pilier_flottille") lien = { type: "pilier_flottille", concours: v("#fi-hll-lien-concours"), statut: null };

    return { bande: membre, hll: hll, lien: lien, nom_bande: nom_bande, role_bande: role_bande };
  };

  /* === VALIDATION === */
  FI.hllVerifier = function (d) {
    if (d.bande) {
      var h = d.hll;
      if (!h || !h.bande) return T.ERR_HLL_BANDE;
      if (h.bande === "faiseuses"   && (!h.categorie || !h.vocation)) return T.ERR_HLL_CHAMPS;
      if (h.bande === "braconneurs" && (!h.spec || !h.role))         return T.ERR_HLL_CHAMPS;
      if (h.bande === "maringouins" && (!h.cellule || !h.role))      return T.ERR_HLL_CHAMPS;
      if (h.bande === "flottille"   && (!h.navire || !h.role))       return T.ERR_HLL_CHAMPS;
      if (h.bande === "main" && h.type === "doigt" && (!h.doigt || !h.role)) return T.ERR_HLL_CHAMPS;
      if (h.bande === "sorcieres"   && !h.role)                      return T.ERR_HLL_CHAMPS;
    }
    if (d.lien) {
      if (d.lien.type === "reseau_main"     && (!d.lien.categorie || !d.lien.role)) return T.ERR_HLL_LIEN;
      if (d.lien.type === "pilier_flottille" && !d.lien.concours)                   return T.ERR_HLL_LIEN;
    }
    return null;
  };

  /* === RÉSUMÉ (post de demande + carte staff) === */
  FI.hllResume = function (d) {
    var B = C().bandes, out = "";
    if (d.bande) out += '<span>' + esc(d.nom_bande) + '</span> <span>' + esc(d.role_bande) + '</span>';
    if (d.lien) {
      var l = d.lien, label = (l.type === "reseau_main")
        ? "Réseau de la Main — " + (B.main.reseau_cat[l.categorie] || "") + (l.role ? " · " + l.role : "")
        : "Pilier de la Flottille — " + l.concours;
      out += ' <span>Lien : ' + esc(label) + '</span>';
    }
    return out || '<span>non</span>';
  };

})(window.FI, window.FI.CFG, window.FI.TEXTES);
