/*
 * tdlhc-bureau.js — Bureau de rédaction (staff) · The Houma Courier · TDL · lot 3
 *
 * CE QUE CE FICHIER FAIT :
 *   - pose le bouton « Bureau de rédaction » dans le mastic, pour le staff seulement ;
 *   - construit l'écran plein du bureau, sa colonne de rubriques et ses compteurs ;
 *   - liste les soumissions à relire, les plus anciennes d'abord, filtrables par type ;
 *   - affiche la fiche d'une soumission : contenu, vérifications automatiques et manuelles,
 *     échanges, boutons d'action ; Publier reste bloqué tant qu'un accord manque.
 * CE QU'IL NE FAIT PAS : écrire (tdlhc-bureau-actions), ni Composer, Affaires,
 *   Échéances et Caisse (tdlhc-bureau-outils).
 *
 * DÉPEND DE : window.Courier (core), Courier.envoi (lireFrais, compter, estPigiste).
 * EXPOSE : window.Courier.bureau.
 * À CHARGER : après tdlhc-suivi, AVANT tdlhc-bureau-actions et tdlhc-bureau-outils.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var VUES = [
    { nom:"relire",    label:"À relire",   ic:"envelope-open", c:"--gr6-color" },
    { nom:"marbre",    label:"Au marbre",  ic:"archive",       c:"--gr3-color" },
    { nom:"composer",  label:"Composer",   ic:"edit",          c:"--gr2-color" },
    { nom:"affaires",  label:"Affaires",   ic:"book-bookmark", c:"--gr4-color" },
    { nom:"echeances", label:"Échéances",  ic:"calendar-clock",c:"--gr1-color" },
    { nom:"caisse",    label:"Caisse",     ic:"coins",         c:"--gr5-color" },
    { nom:"enligne",   label:"En ligne",   ic:"bullhorn",      c:"--dark2" },
  ];
  var FILTRES = [["*","Tout"],["article","Articles"],["annonce","Annonces"],["rumeur","Rumeurs"],["autre","Autres"]];
  var TYPE = {
    "article":    { l:"Article",        c:"--gr2-color" }, "annonce": { l:"Petite annonce", c:"--gr1-color" },
    "rumeur":     { l:"Rumeur",         c:"--gr6-color" }, "lettre":  { l:"Lettre",         c:"--gr4-color" },
    "etat-civil": { l:"État civil",     c:"--gr5-color" }, "prelien": { l:"Pré-lien",       c:"--gr3-color" }
  };
  var SOUS = { correspondant:"Correspondance", pigiste:"Pige", naissance:"Naissance", mariage:"Mariage", deces:"Décès",
               emploi:"Emploi", logement:"Logement", services:"Services", vendre:"À vendre", perso:"Avis personnels" };

  var TXT = {
    BOUTON:"Bureau de rédaction", TITRE:"Bureau de rédaction", FOLIO:"The Houma Courier · réservé au staff",
    RETOUR_JOURNAL:"Retour au journal", RETOUR_LISTE:"À relire", A_RELIRE:"À relire",
    EN_ATTENTE:function(n){ return n + " en attente"; },
    VIDE_LISTE:"Rien à relire. La rédaction peut souffler.", VIDE_FICHE:"Sélectionnez une soumission dans la liste.",
    TRAITEE:"Soumission traitée. Sélectionnez la suivante dans la liste.",
    REPRISE:function(n){ return "Reprise " + n + " sur 2"; },
    AUTEUR:"Auteur", RECU:"Reçu le", PARUTION:"Parution en jeu", SUJET:"Sujet RP", REMUNERATION:"Rémunération",
    CITES:"Joueurs cités", RETENU:"Retenu", SIGNATURE:"Signature", LIEU:"Lieu", REPONSE:"En réponse à", RUBRIQUE:"Rubrique",
    DUREE:"Durée", JOURS:function(n){ return n + " jours"; }, SECTEUR:"Secteur", LIEN:"Lien", NATURE:"Nature",
    FAMILLE:"Famille", PERSONNES:"Personnes", CEREMONIE:"Cérémonie", AFFAIRE:"Affaire", ENQUETE:"Enquête",
    PSEUDONYME:function(a){ return "pseudonyme — auteur réel : " + a; }, A_LA_PARUTION:function(n){ return n + " $ à la parution"; },
    NON_REMUNERE:"non rémunéré (sous le plancher)", NOUVELLE:function(n){ return "nouvelle : " + n; },
    VERIFS:"Vérifications", ECHANGES:"Échanges", AUCUN_ECHANGE:"Première relecture, aucun échange.",
    PLANCHER:"Plancher", PLANCHER_D:function(n, m){ return n + " signes pour " + m + " requis" + (n < m ? " — paraîtra sans rémunération" : "") + "."; },
    QUOTA:"Quota", QUOTA_D:function(n, m, p){ return n + " sur " + m + (p==="semaine" ? " cette semaine." : " ce mois-ci."); },
    RP:"Sujet RP libre", RP_OK:function(t){ return "Sujet t" + t + " : aucun autre article publié ni en attente."; },
    RP_KO:function(t){ return "Le sujet t" + t + " a déjà un article. Un seul par événement."; },
    PIGE:"Statut de pigiste", PIGE_OK:"Rôle au Houma Courier confirmé.", PIGE_KO:"Aucun rôle au Houma Courier pour ce pseudo.",
    ACCORDS:"Accord des joueurs cités",
    ACC_RESUME:function(o, n){ return o + " sur " + n + (o===n ? " — tous les accords sont donnés." : " — publication bloquée."); },
    ACC:{ oui:"accord le ", non:"refus le ", attente:"en attente" },
    REGISTRE:"Registre de la correspondance", REGISTRE_D:"Pas de citation entre guillemets, personne mis en cause.", VERIFIE:"Vérifié",
    SOMME:"Somme retenue", SOMME_D:function(n){ return n + " $ retenus au dépôt, rendus en cas de refus."; },
    PUBLIER:"Publier", PUBLIER_AIDE:"S'active quand tous les joueurs cités ont donné leur accord et que les vérifications manuelles sont cochées.",
    RETOUCHE:"Demander une retouche", MARBRE:"Mettre au marbre", REFUSER:"Refuser",
    PLUS_DE_RETOUCHE:"Deux retouches déjà demandées : publier ou refuser."
  };

  /* ===================== UTILS ===================== */
  var A = null, Bu = null, dom = null, etat = { vue:"relire", sel:null, db:{} };
  function esc(s){ return A.esc(s); }
  function boucle(l, fn){ Array.prototype.forEach.call(l, fn); }
  function J(){ return A.journal(etat.db); }
  function meta(id){ return (J().soum_meta || {})[id] || null; }
  function corpsDe(id){ return (J().soum_corps || {})[id] || {}; }
  function typeLabel(m){ return m.type==="article" ? (SOUS[m.sous_type] || TYPE.article.l) : (TYPE[m.type] || { l:m.type }).l; }
  function couleur(m){ return "var(" + ((TYPE[m.type] || {}).c || "--dark2") + ")"; }
  function filtreDe(m){ return { article:"article", annonce:"annonce", rumeur:"rumeur" }[m.type] || "autre"; }
  function paras(t){ return String(t||"").split(/\n\s*\n/).map(function(x){ return x.trim(); }).filter(Boolean); }
  function date(v){ return A.dateLisible(v); }
  function lienRp(u){ return /^https?:\/\//i.test(u||"") ? '<a href="' + esc(u) + '" data-ext>' + esc(u.replace(/^https?:\/\/[^/]+/, "")) + '</a>' : ""; }
  function aRelire(){
    var n = J().soum_meta || {};
    return Object.keys(n).filter(function(id){ return n[id] && n[id].statut==="relecture"; })
      .sort(function(a, b){ return A.ms(n[a].maj || n[a].cree) - A.ms(n[b].maj || n[b].cree); });
  }
  function chk(etatChk, titre, detail, extra){
    return '<div class="tdlhc-chk ' + etatChk + '"><i class="fi fi-tr-' + (etatChk==="ok" ? "check" : "exclamation") + '"></i>'
      + '<div><b>' + esc(titre) + '</b><em>' + esc(detail) + '</em>' + (extra || "") + '</div></div>';
  }

  /* ===================== DONNÉES ===================== */
  async function lire(){ etat.db = (await A.envoi.lireFrais()) || {}; A.fbInvalider(); return etat.db; }
  function rpPris(t, id){
    var j = J();
    return Object.keys(j.soum_meta || {}).some(function(k){ var m = j.soum_meta[k]; return k!==id && m && m.type==="article" && m.tid===t && m.statut!=="refusee"; })
      || Object.keys(j.archive || {}).some(function(k){ var a = j.archive[k]; return a && a.type==="article" && a.tid===t; });
  }
  function compteurs(){
    var n = J().soum_meta || {}, c = { relire:aRelire().length, marbre:0, echeances:Bu.echeances ? Bu.echeances(etat.db).length : 0 };
    Object.keys(n).forEach(function(id){ if (n[id] && n[id].statut==="marbre") c.marbre++; });
    return c;
  }

  /* ===================== RENDER : COQUILLE ===================== */
  function construire(){
    dom = document.createElement("div"); dom.className = "tdlhc-bureau"; dom.hidden = true;
    dom.innerHTML = '<header class="tdlhc-bu-tete"><button class="tdlhc-btn clair" type="button" data-b="fermer"><i class="fi fi-tr-angle-small-left"></i> '
      + esc(TXT.RETOUR_JOURNAL) + '</button><div class="tdlhc-bu-centre"><div class="tdlhc-bu-titre">' + esc(TXT.TITRE) + '</div>'
      + '<div class="tdlhc-bu-folio">' + esc(TXT.FOLIO) + '</div></div><div class="tdlhc-bu-folio" data-zone="date"></div></header>'
      + '<div class="tdlhc-corps"><nav class="tdlhc-catcol">' + VUES.map(function(v){
          return '<div class="tdlhc-cat" data-vue="' + v.nom + '" style="--c:var(' + v.c + ')"><i class="fi fi-sr-' + v.ic + '"></i><span>'
            + esc(v.label) + '</span><b class="tdlhc-pastille" data-compte="' + v.nom + '" hidden></b></div>';
        }).join("") + '</nav>' + VUES.map(function(v){ return '<section class="tdlhc-vue" data-nom="' + v.nom + '"></section>'; }).join("")
      + '</div>';
    document.body.appendChild(dom);
    dom.querySelector('[data-zone="date"]').textContent = new Date().toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
    brancher();
  }
  function poserCompteurs(){
    var c = compteurs();
    boucle(document.querySelectorAll('[data-compte]'), function(p){
      var n = c[p.getAttribute("data-compte")] || 0; p.textContent = n; p.hidden = !n;
    });
  }
  function section(nom){ return dom.querySelector('.tdlhc-vue[data-nom="' + nom + '"]'); }
  async function montre(nom, opts){
    etat.vue = nom;
    boucle(dom.querySelectorAll(".tdlhc-cat"), function(c){ c.classList.toggle("on", c.getAttribute("data-vue")===nom); });
    boucle(dom.querySelectorAll(".tdlhc-corps > .tdlhc-vue"), function(s){ s.classList.toggle("on", s.getAttribute("data-nom")===nom); s.classList.remove("mob"); });
    if (nom==="relire") rendreRelire(opts && opts.id);
    else if (Bu.vues && Bu.vues[nom]) await Bu.vues[nom](section(nom), etat.db);
  }

  /* ===================== RENDER : À RELIRE ===================== */
  function itemHtml(id){
    var m = meta(id);
    return '<div class="tdlhc-item" data-id="' + esc(id) + '" data-cat="' + filtreDe(m) + '" style="--c:' + couleur(m) + '">'
      + '<div class="tdlhc-surtitre">' + esc(typeLabel(m)) + '</div><h5>' + esc(m.titre) + '</h5>'
      + '<div class="tdlhc-item-meta">' + esc(m.auteur) + ' · ' + esc(A.depuis(m.maj || m.cree))
      + (m.retouches ? ' · <span class="tdlhc-statut reprise">' + esc(TXT.REPRISE(m.retouches)) + '</span>' : "")
      + (m.montant < 0 ? " · " + esc(-m.montant) + " $" : "") + '</div></div>';
  }
  function rendreRelire(id){
    var ids = aRelire(), s = section("relire");
    s.innerHTML = '<div class="tdlhc-liste"><div class="tdlhc-liste-tete"><h4>' + esc(TXT.A_RELIRE) + '</h4><span class="tdlhc-cpt">'
      + esc(TXT.EN_ATTENTE(ids.length)) + '</span></div><div class="tdlhc-onglets">' + FILTRES.map(function(f, i){
        return '<div class="tdlhc-onglet' + (i ? "" : " on") + '" data-f="' + f[0] + '">' + esc(f[1]) + '</div>';
      }).join("") + '</div><div class="tdlhc-liste-rows tdlhc-rows' + (ids.length ? "" : " vide") + '">' + ids.map(itemHtml).join("")
      + '<p class="tdlhc-vide">' + esc(TXT.VIDE_LISTE) + '</p></div></div>'
      + '<div class="tdlhc-lect tdlhc-fiche vide" data-vide="' + esc(TXT.VIDE_FICHE) + '"></div>';
    var cible = id && meta(id) ? id : (etat.sel && meta(etat.sel) && meta(etat.sel).statut==="relecture" ? etat.sel : ids[0]);
    if (cible) selectionner(cible, !!id);
    poserCompteurs();
  }
  function selectionner(id, depuisClic){
    var s = section("relire"), f = s.querySelector(".tdlhc-fiche"), m = meta(id); if (!m) return;
    etat.sel = id;
    boucle(s.querySelectorAll(".tdlhc-item"), function(it){ it.classList.toggle("on", it.getAttribute("data-id")===id); });
    f.classList.remove("vide"); f.innerHTML = ficheHtml(id); f.scrollTop = 0;
    A.anime(f.querySelector(".tdlhc-lect-corps"), "tdlhc-anim-g");
    if (depuisClic) s.classList.add("mob");
    majPublier();
  }
  function traitee(){
    var f = section("relire").querySelector(".tdlhc-fiche");
    f.classList.add("vide"); f.setAttribute("data-vide", TXT.TRAITEE); f.innerHTML = "";
    section("relire").classList.remove("mob"); etat.sel = null;
  }

  /* ===================== RENDER : FICHE ===================== */
  function metaGrille(m, c){
    var g = [[TXT.AUTEUR, esc(m.auteur)], [TXT.RECU, esc(date(m.cree))]], t = m.type;
    if (t==="article") {
      g.push([TXT.PARUTION, esc(date(c.date))], [TXT.SUJET, lienRp(c.rp)],
             [TXT.REMUNERATION, esc(m.remunere===false ? TXT.NON_REMUNERE : TXT.A_LA_PARUTION(m.montant))]);
      if (c.affaire) g.push([TXT.AFFAIRE, esc(c.affaire==="new" ? TXT.NOUVELLE(c.affaire_nom||"") : ((J().affaires||{})[c.affaire]||{}).nom || c.affaire)]);
      if (c.enquete) g.push([TXT.ENQUETE, esc(((etat.db[A.CFG.NODE_ENQUETES]||{})[c.enquete]||{}).titre || c.enquete)]);
    }
    if (t==="lettre") {
      g.push([TXT.SIGNATURE, esc(c.signature) + (c.pseudonyme ? " (" + esc(TXT.PSEUDONYME(m.auteur)) + ")" : "")], [TXT.LIEU, esc(c.lieu||"—")]);
      var art = c.reponse_a && A.parAncre(c.reponse_a); if (art) g.push([TXT.REPONSE, esc(art.cles.TITRE)]);
    }
    if (t==="etat-civil") g.push([TXT.NATURE, esc(SOUS[c.nature]||c.nature)], [TXT.FAMILLE, esc(c.famille)], [TXT.PARUTION, esc(date(c.date))],
                                 [TXT.PERSONNES, esc(c.personnes)], [TXT.CEREMONIE, esc(c.ceremonie||"—")], [TXT.SUJET, c.rp_ouvert ? lienRp(c.rp) : "—"]);
    if (t==="annonce") g.push([TXT.RUBRIQUE, esc(SOUS[c.rubrique]||c.rubrique)], [TXT.DUREE, esc(TXT.JOURS(c.duree||14))], [TXT.SIGNATURE, esc(c.signature)]);
    if (t==="prelien") g.push([TXT.LIEN, lienRp(c.url)], [TXT.SIGNATURE, esc(c.signature)]);
    if (t==="rumeur") g.push([TXT.SECTEUR, esc(c.secteur)], [TXT.SUJET, lienRp(c.rp) || "—"]);
    if (m.cites) g.push([TXT.CITES, esc(Object.keys(m.cites).join(", "))]);
    if (m.montant < 0) g.push([TXT.RETENU, esc(-m.montant + " $")]);
    return '<div class="tdlhc-meta">' + g.map(function(x){ return '<div><span>' + esc(x[0]) + '</span>' + (x[1] || "—") + '</div>'; }).join("") + '</div>';
  }
  /* Le texte tel qu'il paraîtra, citations du pigiste insérées après leur paragraphe */
  function contenuHtml(m, c){
    var cit = A.versTableau(c.citations), out = (c.image && /^https?:/i.test(c.image) ? '<img class="hero" alt="" src="' + esc(c.image) + '">' : "")
      + (c.chapo ? '<p class="tdlhc-chapo">' + esc(c.chapo) + '</p>' : "");
    var ps = paras(c.texte);
    ps.forEach(function(p, i){
      out += '<p>' + esc(p) + '</p>';
      cit.filter(function(x){ return (x.apres||1)===i+1 || (i===ps.length-1 && (x.apres||1) > ps.length); }).forEach(function(x){
        out += '<div class="tdlhc-citation" style="--c:' + couleur(m) + '"><div class="tdlhc-cit-texte">' + esc(x.texte) + '</div>'
          + '<div class="tdlhc-cit-source"><b>' + esc(x.auteur) + '</b>' + (x.qualite ? '<span>' + esc(x.qualite) + '</span>' : "") + '</div></div>';
      });
    });
    return out;
  }
  function verifsHtml(id, m, c){
    var E = A.envoi, l = [];
    if (m.type==="article") {
      var min = E.CFG.PLANCHER[m.sous_type] || 0, n = String(c.texte||"").length;
      l.push(chk(n >= min ? "ok" : "warn", TXT.PLANCHER, TXT.PLANCHER_D(n, min)));
      if (m.sous_type==="pigiste") l.push(chk(E.estPigiste(etat.db, m.auteur) ? "ok" : "warn", TXT.PIGE, E.estPigiste(etat.db, m.auteur) ? TXT.PIGE_OK : TXT.PIGE_KO));
      if (m.tid) l.push(chk(rpPris(m.tid, id) ? "warn" : "ok", TXT.RP, rpPris(m.tid, id) ? TXT.RP_KO(m.tid) : TXT.RP_OK(m.tid)));
    }
    var qc = m.type==="article" ? (m.sous_type==="correspondant" ? "correspondant" : null) : (E.CFG.QUOTAS[m.type] ? m.type : null);
    if (qc && E.CFG.QUOTAS[qc]) { var q = E.compter(etat.db, m.auteur, qc); l.push(chk(q.n <= q.max ? "ok" : "warn", TXT.QUOTA, TXT.QUOTA_D(q.n, q.max, q.p))); }
    if (m.cites) {
      var noms = Object.keys(m.cites), oui = noms.filter(function(k){ return m.cites[k].choix==="oui"; }).length;
      l.push(chk(oui===noms.length ? "ok" : "warn", TXT.ACCORDS, TXT.ACC_RESUME(oui, noms.length), '<ul class="tdlhc-accords">' + noms.map(function(k){
        var a = m.cites[k]; return '<li class="' + esc(a.choix) + '">' + esc(k) + ' <span>' + esc(TXT.ACC[a.choix] + (a.date ? date(a.date) : ""))
          + (a.raison ? " — « " + esc(a.raison) + " »" : "") + '</span></li>'; }).join("") + '</ul>'));
    }
    if (m.type==="article" && m.sous_type==="correspondant")
      l.push(chk("warn", TXT.REGISTRE, TXT.REGISTRE_D, '<label><input type="checkbox" class="tdlhc-manuel"> ' + esc(TXT.VERIFIE) + '</label>'));
    if (m.montant < 0) l.push(chk("ok", TXT.SOMME, TXT.SOMME_D(-m.montant)));
    return l.join("");
  }
  function echangesHtml(m){
    var l = A.versTableau(m.echanges);
    return '<div class="tdlhc-hist"><h4>' + esc(TXT.ECHANGES) + '</h4>' + (l.length ? l.map(function(e){
      return '<p><b>' + esc(date(e.date)) + ' · ' + esc(e.par||"") + '</b> — ' + esc(A.versTableau(e.motifs).join(" · ")) + (e.texte ? " — " + esc(e.texte) : "") + '</p>';
    }).join("") : '<p>' + esc(TXT.AUCUN_ECHANGE) + '</p>') + '</div>';
  }
  function ficheHtml(id){
    var m = meta(id), c = corpsDe(id), sous = m.type==="article" ? " · " + (c.rubrique || "") : "";
    return '<div class="tdlhc-lect-corps"><button class="tdlhc-btn creux tdlhc-retour" type="button"><i class="fi fi-tr-angle-small-left"></i> '
      + esc(TXT.RETOUR_LISTE) + '</button><div class="tdlhc-surtitre" style="--c:' + couleur(m) + '">' + esc(typeLabel(m) + sous) + '</div>'
      + '<h2>' + esc(m.titre) + '</h2>' + metaGrille(m, c) + contenuHtml(m, c)
      + (Bu.panneaux ? Bu.panneaux(id, m, c) : "") + '</div>'
      + '<aside class="tdlhc-verif"><h4>' + esc(TXT.VERIFS) + '</h4>' + verifsHtml(id, m, c) + echangesHtml(m)
      + '<div class="tdlhc-actions"><button class="tdlhc-btn plein" type="button" data-b="ouvrir" data-act="publier" data-zone="publier"><i class="fi fi-tr-check"></i> '
      + esc(TXT.PUBLIER) + '</button><p class="tdlhc-aide">' + esc(TXT.PUBLIER_AIDE) + '</p>'
      + '<button class="tdlhc-btn creux plein" type="button" data-b="ouvrir" data-act="retouche"' + ((m.retouches||0) >= 2 ? ' disabled title="' + esc(TXT.PLUS_DE_RETOUCHE) + '"' : "")
      + '><i class="fi fi-tr-edit"></i> ' + esc(TXT.RETOUCHE) + '</button>'
      + '<button class="tdlhc-btn creux plein" type="button" data-b="ouvrir" data-act="marbre"><i class="fi fi-tr-archive"></i> ' + esc(TXT.MARBRE) + '</button>'
      + '<button class="tdlhc-btn creux plein danger" type="button" data-b="ouvrir" data-act="refus"><i class="fi fi-tr-cross-small"></i> ' + esc(TXT.REFUSER) + '</button>'
      + '</div></aside>';
  }
  function majPublier(){
    var f = section("relire").querySelector(".tdlhc-fiche"), b = f.querySelector('[data-zone="publier"]'), m = meta(etat.sel); if (!b || !m) return;
    var accords = !m.cites || Object.keys(m.cites).every(function(k){ return m.cites[k].choix==="oui"; });
    var manuels = Array.prototype.every.call(f.querySelectorAll(".tdlhc-manuel"), function(x){ return x.checked; });
    b.disabled = !(accords && manuels);
  }

  /* ===================== EVENTS ===================== */
  function onglet(o){
    var grp = o.parentNode, rows = grp.parentNode.querySelector(".tdlhc-rows"), f = o.getAttribute("data-f") || "*", n = 0;
    boucle(grp.querySelectorAll(".tdlhc-onglet"), function(x){ x.classList.toggle("on", x===o); });
    if (o.hasAttribute("data-pan")) {
      boucle(grp.parentNode.querySelectorAll(".tdlhc-pan"), function(p){ p.hidden = p.getAttribute("data-pan")!==o.getAttribute("data-pan"); if (!p.hidden) A.anime(p, "tdlhc-anim-d"); });
      return;
    }
    if (!rows) return;
    boucle(rows.querySelectorAll("[data-cat]"), function(r){ var ok = f==="*" || r.getAttribute("data-cat")===f; r.hidden = !ok; if (ok) n++; });
    rows.classList.toggle("vide", n===0); A.anime(rows, "tdlhc-anim-d");
  }
  function brancher(){
    dom.addEventListener("click", function(e){
      var t = e.target, x;
      if ((x = t.closest("a[data-ext]"))) { e.preventDefault(); e.stopPropagation(); window.open(x.getAttribute("href"), "_blank"); return; }
      if ((x = t.closest(".tdlhc-catcol .tdlhc-cat"))) { montre(x.getAttribute("data-vue")); return; }
      if ((x = t.closest(".tdlhc-onglet"))) { onglet(x); return; }
      if ((x = t.closest(".tdlhc-retour"))) { var v = x.closest(".tdlhc-vue"); if (v) v.classList.remove("mob"); return; }
      if ((x = t.closest('.tdlhc-item[data-id]')) && etat.vue==="relire") { selectionner(x.getAttribute("data-id"), true); return; }
      if ((x = t.closest("[data-b]"))) {
        var b = x.getAttribute("data-b");
        if (b==="fermer") { dom.hidden = true; return; }
        if (Bu.actions && Bu.actions[b]) Bu.actions[b](etat.sel, x);
      }
    });
    dom.addEventListener("change", function(e){ if (e.target.classList.contains("tdlhc-manuel")) majPublier(); });
  }

  /* ===================== INIT ===================== */
  async function ouvrir(id){
    if (!A.isStaff()) return;
    if (!dom) construire();
    dom.hidden = false;
    await lire();
    if (Bu.auOuvrir) await Bu.auOuvrir(etat.db);
    poserCompteurs();
    montre(id ? "relire" : etat.vue, { id:id });
  }
  async function rafraichir(opts){
    await lire(); poserCompteurs();
    if (opts && opts.traitee && etat.vue==="relire") { var garde = etat.sel; rendreRelire(); if (!meta(garde) || meta(garde).statut!=="relecture") traitee(); return; }
    montre(etat.vue);
  }
  function poserBouton(n){
    if (!A.estPageJournal()) return;
    var slot = A.slot("g");
    if (!slot) { if ((n||0) < 80) setTimeout(function(){ poserBouton((n||0)+1); }, 250); return; }
    if (!A.isStaff()) return;
    slot.insertAdjacentHTML("beforeend", '<button class="tdlhc-btn creux" type="button" data-zone="bureau"><i class="fi fi-tr-clipboard-list"></i> '
      + esc(TXT.BOUTON) + ' <b class="tdlhc-pastille" data-compte="relire" hidden></b></button>');
    slot.querySelector('[data-zone="bureau"]').addEventListener("click", function(e){ e.stopPropagation(); ouvrir(); });
    lire().then(poserCompteurs);
  }
  function demarrer(){
    var C = window.Courier; A = C.api; A.envoi = C.envoi;
    Bu = C.bureau = { TXT:TXT, SOUS:SOUS, TYPE:TYPE, etat:etat, esc:esc, paras:paras, typeLabel:typeLabel, couleur:couleur,
                      meta:meta, corps:corpsDe, J:J, lire:lire, rafraichir:rafraichir, montre:montre, section:section,
                      majPublier:majPublier, traitee:traitee, onglet:onglet, vues:{}, actions:{} };
    C.ancre("bureau", function(reste){ ouvrir(reste.charAt(0)==="-" ? reste.slice(1) : null); });
    poserBouton();
  }
  (function attendre(n){
    if (window.Courier && window.Courier.envoi) { demarrer(); return; }
    if ((n||0) < 60) setTimeout(function(){ attendre((n||0)+1); }, 250);
  })();
})();
