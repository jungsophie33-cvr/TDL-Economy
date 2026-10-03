/*
 * tdlhc-rendu.js — Rubriques « À la une », « Articles », « Courrier des lecteurs »
 * du journal The Houma Courier · TDL · lot 1
 *
 * CE QUE CE FICHIER FAIT :
 *   - enregistre trois vues auprès de tdlhc-core ;
 *   - compose la une (un dominant, trois secondaires, six avis légaux, rail des rumeurs) ;
 *   - affiche les articles en panneau liste + lecture, avec citations, fil de l'affaire,
 *     encart d'enquête et lettres reçues sur l'article ;
 *   - affiche le courrier des lecteurs en panneau liste + lecture ;
 *   - expose les aides de rendu partagées dans Courier.rendu (rubriques, natures, corps).
 * CE QU'IL NE FAIT PAS : annonces, état civil, avis légaux complets (tdlhc-rendu-listes).
 *
 * DÉPEND DE : window.Courier (tdlhc-core).
 * EXPOSE : window.Courier.rendu.
 * À CHARGER : après tdlhc-core, AVANT tdlhc-rendu-listes.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var RUB = {
    "environnement":        { l:"Environnement",        c:"--gr2-color" },
    "securite":             { l:"Sécurité",             c:"--gr3-color" },
    "economie":             { l:"Économie",             c:"--gr1-color" },
    "paroisse":             { l:"Paroisse",             c:"--gr4-color" },
    "culture":              { l:"Culture",              c:"--gr5-color" },
    "nouvelles-des-bayous": { l:"Nouvelles des bayous", c:"--gr6-color" }
  };
  var STATUT = {
    "redaction":     { sceau:"Rédaction",      court:"Rédaction",      plein:true, sig:"par {n}, The Houma Courier" },
    "pigiste":       { sceau:"Pige",           court:"Pige",                       sig:"par {n}, pour The Houma Courier" },
    "correspondant": { sceau:"Correspondance", court:"Correspondance",             sig:"Correspondance particulière de {n}" }
  };
  var NATURE_AVIS = { succession:"Succession", sherif:"Vente du shérif", licence:"Licence de débit",
                      societe:"Société", assignation:"Assignation", expropriation:"Expropriation" };
  var NATURE_CIVIL = { naissance:"Naissance", mariage:"Mariage", deces:"Nécrologie" };

  var TXT = {
    UNE:"À la une", ARTICLES:"Articles", COURRIER:"Courrier des lecteurs", COURRIER_COURT:"Courrier",
    CHARGEMENT:"Recherche dans les archives du Courier…",
    UNE_VIDE:"Le premier numéro n'est pas encore paru.",
    LEGAUX_TITRE:"Avis légaux de la paroisse", TOUS_AVIS:"Tous les avis",
    RAIL_TITRE:"Rumeurs du bayou", RAIL_SOUS:"Ce qui circule au marché, au ponton et sur le parvis.",
    RAIL_VIDE:"Rien ne se dit, pour l'instant.", RAPPORTER:"Rapporter une rumeur",
    PARUS:function(n){ return n + (n>1 ? " parus" : " paru"); },
    LETTRES:function(n){ return n + (n>1 ? " lettres" : " lettre"); },
    VIDE_ARTICLES:"Aucun article paru.", VIDE_COURRIER:"Aucune lettre publiée.",
    RETOUR_ART:"Tous les articles", RETOUR_LET:"Tout le courrier",
    FIL:"Le fil de l'affaire",
    FIL_SOUS:function(nom, n){ return nom + " — " + n + (n>1 ? " articles" : " article"); },
    ENQUETE:"Dossier du shérif", REPONSES:"Courrier sur cet article", EN_REPONSE:"En réponse à",
    LETTRE:"Lettre",
    NOTE_LETTRE:"Les lettres sont publiées sous la responsabilité de leurs auteurs. La rédaction se réserve le droit de les écourter."
  };

  /* ===================== UTILS ===================== */
  var A = null;                                  /* api du cœur, posée au démarrage */
  function esc(s){ return A.esc(s); }
  function rub(c){ return RUB[c.cles.RUBRIQUE] || { l:c.cles.RUBRIQUE||"", c:"--dark2" }; }
  function coul(c){ return "var(" + rub(c).c + ")"; }
  function statut(c){ return STATUT[c.cles.STATUT] || STATUT.redaction; }
  function sceau(c){ var s = statut(c); return '<span class="tdlhc-sceau' + (s.plein ? "" : " creux") + '">' + esc(s.sceau) + '</span>'; }
  function signature(c){ return statut(c).sig.replace("{n}", "<b>" + esc(c.cles.SIGNATURE||"") + "</b>"); }
  function date(c){ return esc(A.dateLisible(c.cles.DATE)); }
  function img(url, cls){ return url ? '<img' + (cls ? ' class="' + cls + '"' : "") + ' alt="" loading="lazy" src="' + esc(url) + '">' : ""; }
  function paras(c){ return (c.corps||[]).filter(function(b){ return b.t==="p"; }); }
  function extrait(c, max){
    var p = paras(c)[0], t = p ? A.texteBrut(p.html) : "";
    return max && t.length > max ? t.slice(0, max).replace(/\s+\S*$/, "") + "…" : t;
  }
  function chapo(c, max){ return esc(c.cles.CHAPO || extrait(c, max || 320)); }
  function corpsHtml(c){
    return (c.corps||[]).map(function(b){
      if (b.t!=="cit") return "<p>" + b.html + "</p>";
      return '<div class="tdlhc-citation" style="--c:' + coul(c) + '"><blockquote>' + esc(b.texte) + '</blockquote>'
        + '<cite><b>' + esc(b.auteur) + '</b>' + (b.qualite ? '<span>' + esc(b.qualite) + '</span>' : "") + '</cite></div>';
    }).join("");
  }
  function chargement(){ return '<div class="tdlhc-plein"><div class="tdlhc-chargement">' + esc(TXT.CHARGEMENT) + '</div></div>'; }
  function vide(t){ return '<div class="tdlhc-plein"><div class="tdlhc-chargement">' + esc(t) + '</div></div>'; }
  function retour(t){ return '<button class="tdlhc-btn creux tdlhc-retour" type="button"><i class="fi fi-tr-angle-small-left"></i> ' + esc(t) + '</button>'; }
  /* Une seule préparation par section, même si deux clics arrivent pendant le chargement */
  function preparer(sec, fn){ if (!sec._pret) sec._pret = fn(); return sec._pret; }

  /* ===================== RENDER : À LA UNE ===================== */
  function htmlDominant(a){
    return '<article class="tdlhc-dom' + (a.cles.IMAGE ? "" : " sans-image") + '" data-art="' + esc(a.ancre) + '">' + img(a.cles.IMAGE)
      + '<div style="--c:' + coul(a) + '"><div class="tdlhc-surtitre">' + esc(rub(a).l) + '</div>'
      + '<h2>' + esc(a.cles.TITRE) + '</h2><p>' + chapo(a) + '</p>'
      + '<div class="tdlhc-signe">' + sceau(a) + '<span>' + signature(a) + ' · ' + date(a) + '</span></div></div></article>';
  }
  function htmlSecondaire(a){
    return '<article class="tdlhc-sec" style="--c:' + coul(a) + '" data-art="' + esc(a.ancre) + '">' + img(a.cles.IMAGE)
      + '<div class="tdlhc-surtitre">' + esc(rub(a).l) + '</div><h3>' + esc(a.cles.TITRE) + '</h3><p>' + chapo(a, 170) + '</p></article>';
  }
  function htmlLegaux(avis){
    if (!avis.length) return "";
    return '<div class="tdlhc-sep"></div><div class="tdlhc-legaux"><div class="tdlhc-legaux-tete"><h4>' + esc(TXT.LEGAUX_TITRE) + '</h4>'
      + '<span class="tdlhc-lien" data-vue-lien="legaux">' + esc(TXT.TOUS_AVIS) + '</span></div><div class="tdlhc-legaux-grille">'
      + avis.map(function(v){
          return '<div class="tdlhc-leg" data-art="' + esc(v.ancre) + '"><span class="tdlhc-ref">' + esc(NATURE_AVIS[v.cles.NATURE] || v.cles.NATURE || "")
            + ' · ' + date(v) + '</span>' + esc(extrait(v, 150)) + '</div>';
        }).join("") + '</div></div>';
  }
  function rumeurs(root){
    var n = A.journal(root).rumeurs || {}, now = Date.now();
    return Object.keys(n).map(function(k){ return n[k]; })
      .filter(function(r){ return r && r.texte && (!r.expire || A.ms(r.expire) > now); })
      .sort(function(a,b){ return A.ms(b.publie) - A.ms(a.publie); })
      .slice(0, A.CFG.RAIL_MAX);
  }
  function htmlRail(liste){
    return '<aside class="tdlhc-rail"><div class="tdlhc-rail-tete"><h4>' + esc(TXT.RAIL_TITRE) + '</h4><p>' + esc(TXT.RAIL_SOUS) + '</p></div>'
      + (liste.length ? liste.map(function(r){
          return '<div class="tdlhc-com">' + esc(r.texte) + '<div class="tdlhc-com-meta"><span>' + esc(r.secteur||"")
            + '</span><span>' + esc(A.depuis(r.publie)) + '</span></div></div>';
        }).join("") : '<div class="tdlhc-com">' + esc(TXT.RAIL_VIDE) + '</div>')
      + (typeof A.soumettre==="function"
          ? '<div class="tdlhc-rail-pied"><button class="tdlhc-btn creux" type="button" data-soumettre="rumeur"><i class="fi fi-tr-comments"></i> '
            + esc(TXT.RAPPORTER) + '</button></div>' : "")
      + '</aside>';
  }
  async function afficherUne(sec){
    if (sec.getAttribute("data-pret")) return;
    sec.innerHTML = chargement();
    var cfg = A.CFG;
    await preparer(sec, function(){ return A.chargerJusqua(function(){
      return A.contenus("article").length >= cfg.UNE_ARTICLES && A.contenus("avis-legal").length >= cfg.UNE_AVIS;
    }); });
    var root = await A.fb(), arts = A.contenus("article");
    var dom = arts.filter(function(a){ return a.cles.IMAGE || a.cles.CHRONO==="majeur"; })[0] || arts[0];
    var secs = arts.filter(function(a){ return a!==dom; }).slice(0, 3);
    sec.innerHTML = '<div class="tdlhc-une">'
      + (dom ? htmlDominant(dom) : '<div class="tdlhc-chargement">' + esc(TXT.UNE_VIDE) + '</div>')
      + (secs.length ? '<div class="tdlhc-sepeps"></div><div class="tdlhc-secs">' + secs.map(htmlSecondaire).join("") + '</div>' : "")
      + htmlLegaux(A.contenus("avis-legal").slice(0, cfg.UNE_AVIS))
      + '</div>' + htmlRail(rumeurs(root));
    sec.setAttribute("data-pret", "1");
  }

  /* ===================== RENDER : LECTURE D'UN ARTICLE ===================== */
  function htmlFil(a, arts, root){
    var slug = a.cles.DOSSIER; if (!slug) return "";
    var fil = arts.filter(function(x){ return x.cles.DOSSIER===slug; });
    var aff = A.journal(root).affaires || {};
    var nom = (aff[slug] && aff[slug].nom) || slug.replace(/-/g, " ").replace(/^./, function(l){ return l.toUpperCase(); });
    return '<aside class="tdlhc-fil"><h4>' + esc(TXT.FIL) + '</h4><p class="tdlhc-fil-sous">' + esc(TXT.FIL_SOUS(nom, fil.length)) + '</p>'
      + fil.map(function(x){
          return '<div class="tdlhc-etape' + (x===a ? " on" : "") + '" data-art="' + esc(x.ancre) + '"><div class="tdlhc-etape-d">'
            + date(x) + '</div><p>' + esc(x.cles.TITRE) + '</p></div>';
        }).join("") + '</aside>';
  }
  function htmlEnquete(a, root){
    var id = a.cles.ENQUETE; if (!id) return "";
    var e = root && root[A.CFG.NODE_ENQUETES] && root[A.CFG.NODE_ENQUETES][id];
    if (!e || !e.titre) return "";
    return '<div class="tdlhc-enquete"><i class="fi fi-tr-badge-sheriff"></i><div><b>' + esc(TXT.ENQUETE) + '</b>'
      + '<span>' + esc(e.titre) + '</span></div></div>';
  }
  function htmlReponses(a){
    var l = A.contenus("lettre").filter(function(x){ return x.cles.REPONSE_A===a.ancre; });
    if (!l.length) return "";
    return '<div class="tdlhc-reponses"><h4>' + esc(TXT.REPONSES) + '</h4>' + l.map(function(x){
      return '<div class="tdlhc-reponse" data-art="' + esc(x.ancre) + '"><b>' + esc(x.cles.TITRE) + '</b><span>'
        + esc(x.cles.SIGNATURE||"") + ' · ' + date(x) + '</span></div>';
    }).join("") + '</div>';
  }
  function htmlArticle(a, arts, root){
    return '<div class="tdlhc-lect-corps">' + retour(TXT.RETOUR_ART) + img(a.cles.IMAGE, "hero")
      + '<div class="tdlhc-surtitre" style="--c:' + coul(a) + '">' + esc(rub(a).l) + '</div>'
      + '<h2>' + esc(a.cles.TITRE) + '</h2>'
      + (a.cles.CHAPO ? '<p class="tdlhc-chapo">' + esc(a.cles.CHAPO) + '</p>' : "")
      + '<div class="tdlhc-attrib">' + sceau(a) + '<span>' + signature(a) + '</span><span>·</span><span>' + date(a) + '</span></div>'
      + corpsHtml(a) + htmlEnquete(a, root) + htmlReponses(a)
      + '</div>' + htmlFil(a, arts, root);
  }

  /* ===================== RENDER : PANNEAU GÉNÉRIQUE ===================== */
  /* conf = { type, titre, compte(n), videTxt, item(c), lecture(c, liste, root) } */
  function panneau(conf){
    var choix = null;
    return async function(sec, api, opts){
      if (!sec.getAttribute("data-pret")) {
        sec.innerHTML = chargement();
        await preparer(sec, function(){ return A.chargerTout(); });
        var liste = A.contenus(conf.type);
        if (!liste.length) { sec.innerHTML = vide(conf.videTxt); sec.setAttribute("data-pret", "1"); return; }
        sec.innerHTML = '<div class="tdlhc-liste"><div class="tdlhc-liste-tete"><h4>' + esc(conf.titre) + '</h4>'
          + '<span class="tdlhc-cpt">' + esc(conf.compte(liste.length)) + '</span></div>'
          + '<div class="tdlhc-liste-rows">' + liste.map(conf.item).join("") + '</div></div><div class="tdlhc-lect"></div>';
        sec.setAttribute("data-pret", "1");
      }
      var tous = A.contenus(conf.type); if (!tous.length) return;
      var cible = (opts.ancre && A.parAncre(opts.ancre) && A.parAncre(opts.ancre).type===conf.type) ? opts.ancre : (choix || tous[0].ancre);
      var c = A.parAncre(cible), root = await A.fb(), lect = sec.querySelector(".tdlhc-lect");
      boucle(sec.querySelectorAll(".tdlhc-item"), function(it){
        var on = it.getAttribute("data-art")===cible; it.classList.toggle("on", on);
        if (on && opts.ancre) it.scrollIntoView({ block:"nearest" });
      });
      lect.innerHTML = conf.lecture(c, tous, root); lect.scrollTop = 0;
      if (choix && choix!==cible) A.anime(lect.querySelector(".tdlhc-lect-corps"), "tdlhc-anim-g");
      if (opts.ancre) { sec.classList.add("mob"); A.marquer(cible); }
      choix = cible;
    };
  }
  function boucle(l, fn){ Array.prototype.forEach.call(l, fn); }

  /* ===================== RENDER : ARTICLES ET COURRIER ===================== */
  var afficherArticles = panneau({
    type:"article", titre:TXT.ARTICLES, compte:TXT.PARUS, videTxt:TXT.VIDE_ARTICLES,
    item:function(a){
      return '<div class="tdlhc-item" data-art="' + esc(a.ancre) + '" style="--c:' + coul(a) + '"><div class="tdlhc-surtitre">'
        + esc(rub(a).l) + '</div><h5>' + esc(a.cles.TITRE) + '</h5><div class="tdlhc-item-meta">' + date(a) + ' · ' + esc(statut(a).court) + '</div></div>';
    },
    lecture:htmlArticle
  });
  var afficherCourrier = panneau({
    type:"lettre", titre:TXT.COURRIER_COURT, compte:TXT.LETTRES, videTxt:TXT.VIDE_COURRIER,
    item:function(l){
      return '<div class="tdlhc-item" data-art="' + esc(l.ancre) + '" style="--c:var(--gr4-color)"><h5>' + esc(l.cles.TITRE) + '</h5>'
        + '<div class="tdlhc-item-meta">' + date(l) + ' · ' + esc(l.cles.SIGNATURE||"") + (l.cles.LIEU ? ", " + esc(l.cles.LIEU) : "") + '</div></div>';
    },
    lecture:function(l){
      var art = l.cles.REPONSE_A && A.parAncre(l.cles.REPONSE_A);
      return '<div class="tdlhc-lect-corps">' + retour(TXT.RETOUR_LET)
        + '<div class="tdlhc-surtitre" style="--c:var(--gr4-color)">' + esc(TXT.COURRIER) + '</div><h2>' + esc(l.cles.TITRE) + '</h2>'
        + '<div class="tdlhc-attrib"><span class="tdlhc-sceau creux">' + esc(TXT.LETTRE) + '</span><span><b>' + esc(l.cles.SIGNATURE||"") + '</b>'
        + (l.cles.LIEU ? ", " + esc(l.cles.LIEU) : "") + '</span><span>·</span><span>' + date(l) + '</span></div>'
        + (art ? '<p class="tdlhc-enreponse">' + esc(TXT.EN_REPONSE) + ' <a class="tdlhc-lien" data-art="' + esc(art.ancre) + '">' + esc(art.cles.TITRE) + '</a></p>' : "")
        + corpsHtml(l) + '<p class="tdlhc-note">' + esc(TXT.NOTE_LETTRE) + '</p></div>';
    }
  });

  /* ===================== INIT ===================== */
  function demarrer(){
    var C = window.Courier; A = C.api;
    C.rendu = { RUB:RUB, STATUT:STATUT, NATURE_AVIS:NATURE_AVIS, NATURE_CIVIL:NATURE_CIVIL,
                corpsHtml:corpsHtml, extrait:extrait, paras:paras, preparer:preparer, chargement:chargement };
    C.vue({ nom:"une",      ordre:10, label:TXT.UNE,      icone:"newspaper", couleur:"var(--gr6-color)", afficher:afficherUne });
    C.vue({ nom:"articles", ordre:20, label:TXT.ARTICLES, icone:"document",  couleur:"var(--gr3-color)", afficher:afficherArticles });
    C.vue({ nom:"courrier", ordre:50, label:TXT.COURRIER, icone:"envelope",  couleur:"var(--gr4-color)", afficher:afficherCourrier });
  }
  (function attendre(n){
    if (window.Courier && window.Courier.vue) { demarrer(); return; }
    if ((n||0) < 60) setTimeout(function(){ attendre((n||0)+1); }, 250);
  })();
})();
