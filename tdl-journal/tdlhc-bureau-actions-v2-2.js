/*
 * tdlhc-bureau-actions.js — Actions du bureau de rédaction · The Houma Courier · TDL · lot 3
 *
 * CE QUE CE FICHIER FAIT :
 *   - génère le post d'un article, d'une lettre ou d'un avis d'état civil selon le contrat
 *     d'en-tête, à copier dans une réponse au sujet t102 ;
 *   - confirme la parution par le lien du message : archive, versement de la pige ou de la
 *     correspondance, création d'une affaire, signalement du badge, suppression du brouillon ;
 *   - publie directement dans Firebase les annonces, pré-liens et rumeurs ;
 *   - demande une retouche, met au marbre, ressort du marbre, refuse en remboursant.
 * CE QU'IL NE FAIT PAS : rien n'est payé, archivé ni supprimé avant le lien collé.
 *
 * DÉPEND DE : Courier.bureau, Courier.envoi (notifier, CFG), window.EcoCore
 *   (firebaseUpdate, firebaseTransaction).
 * À CHARGER : après tdlhc-bureau.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var CFG = {
    URL_REPONSE:  "https://thedrownedlands.forumactif.com/post?t=102&mode=reply",  /* [MAJ] */
    SUJET_ID:     102,
    NODE_MEMBRES: "membres",
    DELAI_REPRISE_J: 14,
    MARBRE_J:     7,
    DUREE_J:      { prelien:30, rumeur:14 },
    BADGE_SEUIL:  5,
    NODE_CHRONO:  "chrono_journal",     /* [MAJ] lu par l'annexe Chronologie */
    PERIODE_CHRONO: "jeu",              /* période « En jeu » de la frise */
    CATS_CHRONO:  [["histo","Histoire"],["fam","Familles"],["comm","Communautés"],
                   ["eco","Économie"],["mys","Mystères"],["cata","Catastrophes"]],
    /* catégorie proposée d'après la rubrique — le staff peut la changer */
    RUB_VERS_CAT: { environnement:"cata", securite:"comm", economie:"eco",
                    paroisse:"histo", culture:"comm", "nouvelles-des-bayous":"comm" },
    N:            { RETOUCHE:192, PUBLICATION:193, REFUS:194, MARBRE:195, CITE:198, MAJEUR:199 }
  };
  var SUJET = { "article":1, "lettre":1, "etat-civil":1 };
  var MOTIFS_RETOUCHE = ["Accord d'un joueur cité manquant", "Plancher de signes non atteint", "Citation entre guillemets hors pige",
                         "Hors du périmètre d'événement", "Sujet RP déjà couvert", "Ton ou forme à revoir"];
  var MOTIFS_REFUS = ["Hors du périmètre d'événement", "Sujet RP déjà couvert", "Contradiction avec le canon",
                      "Quota du mois atteint", "Deux retouches sans correction", "Règlement de comptes entre joueurs", "Autre"];

  var TXT = {
    PUBLIER:"Publier", RETOUCHE:"Demander une retouche", MARBRE:"Mettre au marbre", REFUS:"Refuser", ANNULER:"Annuler",
    PAS1:"Copiez le post, puis collez-le dans une réponse au sujet du journal. Vous pouvez corriger une coquille ici avant de copier.",
    PAS2:"Une fois le message publié, collez son lien ici. Le paiement, l'archivage et les notifications partent à ce moment-là, pas avant.",
    COPIER:"Copier le post", REPONDRE:"Ouvrir le formulaire de réponse", CONFIRMER:"Confirmer la parution",
    LIEN_PH:"https://thedrownedlands.forumactif.com/t102-the-houma-courier#1234",
    FB_TEXTE:function(ou, j){ return "Paraît immédiatement dans " + ou + ", pendant " + j + " jours. Aucun post à copier."; },
    FB_OU:{ annonce:"les petites annonces", prelien:"les pré-liens épinglés", rumeur:"le rail des rumeurs" },
    PUBLIER_FB:"Publier maintenant", CONFIRM_FB:"Publier maintenant ?",
    RETOUCHE_N:function(n){ return "Demander une retouche — " + n + " sur 2"; },
    PRECISIONS:"Précisions pour l'auteur", ENVOYER_RETOUCHE:"Envoyer la demande",
    RETOUCHE_AIDE:function(j){ return "L'auteur dispose de " + j + " jours pour reprendre son texte. Sans reprise, refus automatique et remboursement."; },
    RESSORTIR_LE:"Ressortir le", NOTE:"Note interne", NOTE_SPAN:"invisible du membre", NOTE_PH:"À publier après la conclusion de l'intrigue",
    MARBRE_AIDE:"L'auteur voit « Retenu pour une parution ultérieure ». Les sommes restent retenues.",
    MOTIF:"Motif", MESSAGE:"Message à l'auteur", REFUS_AIDE:"Une somme retenue (annonce, pré-lien) est rendue automatiquement.",
    REFUSER:"Refuser la soumission",
    ERR_LIEN:"Lien invalide : il faut le lien du message publié, qui se termine par #1234.",
    ERR_SUJET:"Ce message n'est pas dans le sujet du Courier (t102).",
    ERR_MOTIF:"Indique au moins un motif ou une précision.", ERR_DATE:"Indique une date de ressortie.",
    ERR:"L'opération a échoué. Rien n'a été modifié.", ERR_PAIE:"Parution enregistrée, mais le versement a échoué : à créditer à la main.",
    ERR_REMB:"Refus enregistré, mais le remboursement a échoué : à recréditer à la main.",
    OK_COPIE:"Post copié. Collez-le dans une réponse au sujet du journal.",
    OK_PUBLIE:"Parution confirmée.", OK_PAYE:function(n, p){ return " " + n + " $ versés à " + p + "."; },
    OK_BADGE:function(p){ return " " + p + " atteint cinq correspondances : badge à attribuer (voir Caisse)."; },
    OK_RETOUCHE:"Retouche demandée. L'auteur est prévenu.", OK_MARBRE:"Mis au marbre.", OK_REFUS:"Soumission refusée.",
    OK_REMB:function(n){ return " " + n + " $ rendus."; }, OK_RESSORTI:"Ressorti : de retour dans À relire.",
    LIBELLE:function(t, titre){ return t + " · " + titre; },
    UNE_DOM:"Mettre en dominant à la une",
    UNE_AIDE:"Un seul article dominant à la fois : le dernier publié avec cette case prend la place.",
    CHRONO:"Entrée dans la chronologie",
    CHRONO_AIDE:"Réservé aux piges. Une correspondance ne rejoint jamais la chronologie de la paroisse.",
    CHRONO_NIV:[["aucun","N'entre pas"],["mineur","Mineur : entre dans la timeline"],
                ["majeur","Majeur : entre dans la timeline et prévient le forum"]],
    CHRONO_CAT:"Catégorie dans la frise",
    OK_CHRONO:" Entré dans la chronologie.",
    TITRE_CIVIL:{ naissance:function(c){ return "Naissance — famille " + c.famille; }, mariage:function(c){ return "Mariage — " + c.personnes; },
                  deces:function(c){ return c.personnes; } }
  };

  /* ===================== UTILS ===================== */
  var A = null, Bu = null;
  function E(){ return window.EcoCore; }
  function esc(s){ return A.esc(s); }
  function J(){ return A.CFG.NODE_JOURNAL + "/"; }
  function maintenant(){ return new Date().toISOString(); }
  function dansJours(n){ return new Date(Date.now() + n*86400000).toISOString(); }
  function jour(d){ var x = new Date(d); return x.getFullYear() + "-" + ("0"+(x.getMonth()+1)).slice(-2) + "-" + ("0"+x.getDate()).slice(-2); }
  function mois(d){ var x = new Date(d); return x.getFullYear() + "-" + ("0" + (x.getMonth()+1)).slice(-2); }
  function semaine(d){
    var x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
    var j1 = new Date(x.getFullYear(), 0, 4);
    return x.getFullYear() + "-W" + ("0" + (1 + Math.round(((x - j1) / 86400000 - 3 + ((j1.getDay() + 6) % 7)) / 7))).slice(-2);
  }
  function slug(nom){
    return String(nom||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  }
  function propre(o){
    if (Array.isArray(o)) return o.filter(function(x){ return x!==undefined; }).map(propre);
    if (o && typeof o==="object") { var r = {}; Object.keys(o).forEach(function(k){ if (o[k]!==undefined) r[k] = propre(o[k]); }); return r; }
    return o;
  }
  async function ecrire(maj){ Object.keys(maj).forEach(function(k){ maj[k] = propre(maj[k]); }); await E().firebaseUpdate(maj); }
  async function crediter(p, n){
    await E().firebaseTransaction(CFG.NODE_MEMBRES + "/" + encodeURIComponent(p) + "/dollars", function(cur){ return (cur||0) + n; });
  }
  function notifier(code, dest, vars, ref){ A.envoi.notifier(code, dest, vars, ref); }
  function lienHc(h){ return A.envoi.lien(h); }
  function panneau(fiche, act){ return fiche && fiche.querySelector('.tdlhc-act[data-act="' + act + '"]'); }
  function fiche(){ return Bu.section("relire").querySelector(".tdlhc-fiche"); }
  /* « …t102-the-houma-courier#1234 », « …t102p25-…#1234 », « viewtopic?p=1234#1234 » → p1234 */
  function ancreDuLien(l){
    var m = /#p?(\d+)\s*$/.exec(l||"") || /[?&]p=(\d+)/.exec(l||"");
    return m ? "p" + m[1] : null;
  }
  function sujetDuLien(l){ var m = /\/t(\d+)(?:p\d+)?-/.exec(l||""); return m ? parseInt(m[1],10) : null; }

  /* ===================== POST : contrat d'en-tête ===================== */
  function escP(s){ return String(s==null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function cle(k, v){ return v==null || v==="" || v===false ? "" : k + ": " + escP(String(v).replace(/\s*\n\s*/g, " ")) + "\n"; }
  function corpsPost(texte, cits){
    var ps = Bu.paras(texte), out = [];
    cits = A.versTableau(cits);
    ps.forEach(function(p, i){
      out.push(escP(p));
      cits.filter(function(x){ return (x.apres||1)===i+1 || (i===ps.length-1 && (x.apres||1) > ps.length); }).forEach(function(x){
        out.push("--- CITATION ---\n" + cle("TEXTE", x.texte) + cle("AUTEUR", x.auteur) + cle("QUALITE", x.qualite) + "--- FIN ---");
      });
    });
    return out.join("\n\n");
  }
  function enveloppe(champs, corps){
    return '<div class="tdlhc-data">\n' + champs.map(function(c){ return cle(c[0], c[1]); }).join("") + "CORPS:\n" + corps + "\n</div>";
  }
    function dossierDe(c){ return c.affaire==="new" ? slug(c.affaire_nom) : (c.affaire || ""); }
  /* Un article acheté paraît sous une mention, pas sous un statut de rédaction :
     « commande » pour un communiqué, « tribune » pour une prise de position.
     L'une et l'autre sont rendues par tdlhc-rendu ; la signature reste celle de
     l'acheteur, puisque tout l'intérêt est qu'on sache qui a payé. */
  function statutPost(m){
    if (m.sous_type!=="commande" && m.sous_type!=="commande-une") return m.sous_type;
    return m.mention==="tribune" ? "tribune" : "commande";
  }
  function genererPost(id, chrono, une){
    var m = Bu.meta(id), c = Bu.corps(id), cites = m.cites ? Object.keys(m.cites).join(", ") : "";
    if (m.type==="article") return enveloppe([["TYPE","article"],["DATE",c.date],["RUBRIQUE",c.rubrique],["STATUT",statutPost(m)],
      ["SIGNATURE",m.auteur],["TITRE",c.titre],["CHAPO",c.chapo],["IMAGE",c.image],["DOSSIER",dossierDe(c)],["RP",c.rp],
      ["ENQUETE",c.enquete],["CITES",cites],["CHRONO",chrono==="aucun" ? "" : (chrono || "")],
      ["UNE",une ? "dominant" : ""],["SOUMISSION",id]], corpsPost(c.texte, c.citations));
    if (m.type==="lettre") return enveloppe([["TYPE","lettre"],["DATE",jour(Date.now())],["SIGNATURE",c.signature],["LIEU",c.lieu],
      ["REPONSE_A",c.reponse_a],["TITRE",c.titre],["SOUMISSION",id]], corpsPost(c.texte));
    var titre = (TXT.TITRE_CIVIL[c.nature] || TXT.TITRE_CIVIL.deces)(c);
    return enveloppe([["TYPE","etat-civil"],["DATE",c.date],["NATURE",c.nature],["FAMILLE",c.famille],["TITRE",titre],
      ["CEREMONIE",c.ceremonie],["RP",c.rp_ouvert ? c.rp : ""],["CITES",cites],["SOUMISSION",id]], corpsPost(c.texte));
  }

  /* ===================== RENDER : PANNEAUX D'ACTION ===================== */
  function tete(titre){
    return '<div class="tdlhc-act-tete"><h4>' + esc(titre) + '</h4><button class="tdlhc-btn creux petit" type="button" data-b="annuler">' + esc(TXT.ANNULER) + '</button></div>';
  }
  /* aussi utilisé par Composer, avec ctx = "_compose" */
  function panneauPost(post, ctx){
    return '<div class="tdlhc-pas"><span class="tdlhc-num">1</span><div><p class="tdlhc-act-txt">' + esc(TXT.PAS1) + '</p>'
      + '<textarea class="tdlhc-post" data-zone="post">' + esc(post) + '</textarea><div class="tdlhc-act-btns">'
      + '<button class="tdlhc-btn" type="button" data-b="copier"><i class="fi fi-tr-copy"></i> ' + esc(TXT.COPIER) + '</button>'
      + '<button class="tdlhc-btn creux" type="button" data-b="repondre"><i class="fi fi-tr-arrow-up-right-from-square"></i> ' + esc(TXT.REPONDRE) + '</button>'
      + '</div></div></div><div class="tdlhc-pas"><span class="tdlhc-num">2</span><div><p class="tdlhc-act-txt">' + esc(TXT.PAS2) + '</p>'
      + '<div class="tdlhc-champ"><input type="text" data-zone="lien" placeholder="' + esc(TXT.LIEN_PH) + '"></div>'
      + '<button class="tdlhc-btn" type="button" data-b="confirmer" data-ctx="' + esc(ctx) + '" disabled>' + esc(TXT.CONFIRMER) + '</button></div></div>';
  }
  /* Deux champs n'apparaissent que pour une pige : le niveau d'entrée dans la
     chronologie et sa catégorie. Changer le niveau régénère le post. */
  function champsChrono(m, c){
    if (m.type!=="article" || m.sous_type!=="pigiste") return "";
    var defaut = CFG.RUB_VERS_CAT[c.rubrique] || "histo";
    return '<div class="tdlhc-duo tdlhc-chrono"><div class="tdlhc-champ"><label>' + esc(TXT.CHRONO) + '</label>'
      + '<select data-zone="chrono">' + TXT.CHRONO_NIV.map(function(x){
          return '<option value="' + x[0] + '">' + esc(x[1]) + '</option>'; }).join("") + '</select></div>'
      + '<div class="tdlhc-champ" data-zone="chrono-cat-champ" hidden><label>' + esc(TXT.CHRONO_CAT) + '</label>'
      + '<select data-zone="chrono-cat">' + CFG.CATS_CHRONO.map(function(x){
          return '<option value="' + x[0] + '"' + (x[0]===defaut ? " selected" : "") + '>' + esc(x[1]) + '</option>'; }).join("")
      + '</select></div></div><p class="tdlhc-aide">' + esc(TXT.CHRONO_AIDE) + '</p>';
  }
    /* La une n'a qu'un dominant. Le bureau tranche : deux commandes majeures la
     même semaine, c'est la plus chère qui passe et l'autre au marbre. */
  function champUne(m){
    if (m.type!=="article") return "";
    return '<label class="tdlhc-coche tdlhc-une-chk"><input type="checkbox" data-zone="une"'
      + (m.sous_type==="commande-une" ? " checked" : "") + '><span>'
      + esc(TXT.UNE_DOM) + '</span></label><p class="tdlhc-aide">' + esc(TXT.UNE_AIDE) + '</p>';
  }
  function panneaux(id, m, c){
        var pub = SUJET[m.type] ? champsChrono(m, c) + champUne(m)
              + panneauPost(genererPost(id, "aucun", m.sous_type==="commande-une"), id)
      : '<p class="tdlhc-act-txt">' + esc(TXT.FB_TEXTE(TXT.FB_OU[m.type], m.type==="annonce" ? (c.duree||14) : CFG.DUREE_J[m.type])) + '</p>'
        + '<button class="tdlhc-btn" type="button" data-b="publierFb"><i class="fi fi-tr-check"></i> ' + esc(TXT.PUBLIER_FB) + '</button>';
    return '<div class="tdlhc-act" data-act="publier" hidden>' + tete(TXT.PUBLIER) + pub + '</div>'
      + '<div class="tdlhc-act" data-act="retouche" hidden>' + tete(TXT.RETOUCHE_N((m.retouches||0) + 1))
      + '<div class="tdlhc-motifs">' + MOTIFS_RETOUCHE.map(function(x){
          return '<label class="tdlhc-coche"><input type="checkbox" data-motif="' + esc(x) + '"><span>' + esc(x) + '</span></label>'; }).join("") + '</div>'
      + '<div class="tdlhc-champ"><label>' + esc(TXT.PRECISIONS) + '</label><textarea class="tdlhc-ta-court" data-zone="r-texte"></textarea>'
      + '<p class="tdlhc-aide">' + esc(TXT.RETOUCHE_AIDE(CFG.DELAI_REPRISE_J)) + '</p></div>'
      + '<button class="tdlhc-btn" type="button" data-b="retouche"><i class="fi fi-tr-edit"></i> ' + esc(TXT.ENVOYER_RETOUCHE) + '</button></div>'
      + '<div class="tdlhc-act" data-act="marbre" hidden>' + tete(TXT.MARBRE) + '<div class="tdlhc-duo">'
      + '<div class="tdlhc-champ"><label>' + esc(TXT.RESSORTIR_LE) + '</label><input type="date" data-zone="m-date" value="' + jour(Date.now() + CFG.MARBRE_J*86400000) + '"></div>'
      + '<div class="tdlhc-champ"><label>' + esc(TXT.NOTE) + ' <span>— ' + esc(TXT.NOTE_SPAN) + '</span></label><input type="text" data-zone="m-note" placeholder="'
      + esc(TXT.NOTE_PH) + '"></div></div><p class="tdlhc-aide">' + esc(TXT.MARBRE_AIDE) + '</p>'
      + '<button class="tdlhc-btn" type="button" data-b="marbre"><i class="fi fi-tr-archive"></i> ' + esc(TXT.MARBRE) + '</button></div>'
      + '<div class="tdlhc-act" data-act="refus" hidden>' + tete(TXT.REFUS)
      + '<div class="tdlhc-champ"><label>' + esc(TXT.MOTIF) + '</label><select data-zone="f-motif">' + MOTIFS_REFUS.map(function(x){
          return '<option>' + esc(x) + '</option>'; }).join("") + '</select></div>'
      + '<div class="tdlhc-champ"><label>' + esc(TXT.MESSAGE) + '</label><textarea class="tdlhc-ta-court" data-zone="f-texte"></textarea>'
      + '<p class="tdlhc-aide">' + esc(TXT.REFUS_AIDE) + '</p></div>'
      + '<button class="tdlhc-btn creux danger" type="button" data-b="refus"><i class="fi fi-tr-cross-small"></i> ' + esc(TXT.REFUSER) + '</button></div>';
  }

  /* ===================== ACTIONS : PUBLICATION ===================== */
  async function confirmer(id, bouton){
    var ctx = bouton.getAttribute("data-ctx") || id, zone = bouton.closest(".tdlhc-act, .tdlhc-form"), lien = zone.querySelector('[data-zone="lien"]').value.trim();
    var ancre = ancreDuLien(lien), t = sujetDuLien(lien);
    if (!ancre) { A.toast(TXT.ERR_LIEN); return; }
    if (t && t!==CFG.SUJET_ID) { A.toast(TXT.ERR_SUJET); return; }
    bouton.disabled = true;
    if (ctx==="_compose") { try { await Bu.confirmerCompose(ancre); } finally { bouton.disabled = false; } return; }
    var m = Bu.meta(id), c = Bu.corps(id), now = maintenant(), maj = {}, msg = TXT.OK_PUBLIE, paye = 0;
    maj[J() + "archive/" + id] = { type:m.type, sous_type:m.sous_type, auteur:m.auteur, titre:m.titre, mois:mois(m.cree), semaine:semaine(m.cree),
                                   montant:m.montant, ancre:ancre, tid:m.tid || null, publie:now };
    maj[J() + "soum_meta/" + id] = null; maj[J() + "soum_corps/" + id] = null;
    if (m.type==="article" && c.affaire==="new" && c.affaire_nom) maj[J() + "affaires/" + slug(c.affaire_nom)] = { nom:c.affaire_nom, statut:"ouverte", cree:now };
    var assez = String(c.texte||"").length >= (A.envoi.CFG.PLANCHER[m.sous_type] || 0);   /* le texte publié fait foi */
    if (m.type==="article" && m.remunere!==false && assez && m.montant > 0) {
      paye = m.montant;
      maj[J() + "caisse/" + id + "-paie"] = { date:now, pseudo:m.auteur, libelle:TXT.LIBELLE(Bu.typeLabel(m), m.titre), montant:paye, etat:"verse", soum:id };
    }
    if (m.type==="article" && m.sous_type==="correspondant") {
      var arch = Bu.J().archive || {}, n = 1 + Object.keys(arch).filter(function(k){ var a = arch[k]; return a && a.auteur===m.auteur && a.type==="article" && a.sous_type==="correspondant"; }).length;
      if (n >= CFG.BADGE_SEUIL && !(Bu.J().badges || {})[m.auteur]) { maj[J() + "badges/" + m.auteur] = { a_attribuer:now, attribue:false }; msg += TXT.OK_BADGE(m.auteur); }
    }
    var niv = zone.querySelector('[data-zone="chrono"]'), chrono = niv ? niv.value : "aucun";
    if (chrono!=="aucun") {
      maj[CFG.NODE_CHRONO + "/" + id] = ligneChrono(id, chrono, zone.querySelector('[data-zone="chrono-cat"]').value,
                                                    c, m.titre, ancre);
      msg += TXT.OK_CHRONO;
    }
    try { await ecrire(maj); }
    catch(e){ if (window.console) console.error("[Courier] parution", e); A.toast(TXT.ERR); bouton.disabled = false; return; }
    if (paye) {
      try { await crediter(m.auteur, paye); msg += TXT.OK_PAYE(paye, m.auteur); }
      catch(e){ var r = {}; r[J() + "caisse/" + id + "-paie/etat"] = "a_verser"; ecrire(r).catch(function(){}); msg = TXT.ERR_PAIE; }
    }
    notifier(CFG.N.PUBLICATION, m.auteur, { titre:m.titre, montant:paye && msg!==TXT.ERR_PAIE ? paye : 0, url:lienHc("art-" + ancre) }, "hc-pub-" + id);
    if (chrono==="majeur" && A.envoi.CFG.NOTIFS && window.EcoNotif && EcoNotif.uneFois) {
      try { EcoNotif.uneFois("hc-majeur-" + ancre, function(){
              return EcoNotif.tous(CFG.N.MAJEUR, { titre:m.titre, url:lienHc("art-" + ancre) }, "hc-majeur-" + ancre); }); } catch(e){}
    }
    if (m.cites) Object.keys(m.cites).forEach(function(p){ notifier(CFG.N.CITE, p, { titre:m.titre, url:lienHc("art-" + ancre) }, "hc-cite-" + id + "-" + p); });
    A.toast(msg); Bu.rafraichir({ traitee:true });
  }
  /* Ce que l'annexe Chronologie lit : un résumé, jamais le texte complet.
     La date est celle EN JEU, pas celle du message. */
  function ligneChrono(id, niveau, cat, c, titre, ancre){
    var texte = (c.chapo || "").trim() || Bu.paras(c.texte || "")[0] || "";
    return { periode:CFG.PERIODE_CHRONO, cat:cat, iso:c.date || "", d:A.dateLisible(c.date) || "",
             titre:titre, texte:texte, ancre:ancre || null, chrono:niveau, soum:id, publie:maintenant() };
  }
  async function publierFb(id){
    if (!window.confirm(TXT.CONFIRM_FB)) return;
    var m = Bu.meta(id), c = Bu.corps(id), now = maintenant(), maj = {}, base = { auteur:m.auteur, publie:now };
    var duree = m.type==="annonce" ? (parseInt(c.duree,10) || 14) : CFG.DUREE_J[m.type];
    base.expire = dansJours(duree);
    if (m.type==="annonce") maj[J() + "annonces/" + id] = Object.assign(base, { rubrique:c.rubrique, titre:c.titre, texte:c.texte, signature:c.signature });
    if (m.type==="prelien") maj[J() + "prelien/" + id] = Object.assign(base, { titre:c.titre, texte:c.texte, url:c.url, nature:c.nature, signature:c.signature, renouvele:false });
    if (m.type==="rumeur")  maj[J() + "rumeurs/" + id] = Object.assign(base, { secteur:c.secteur, texte:c.texte, rp:c.rp || null });
    maj[J() + "archive/" + id] = { type:m.type, sous_type:m.sous_type, auteur:m.auteur, titre:m.titre, mois:mois(m.cree), semaine:semaine(m.cree),
                                   montant:m.montant, ancre:null, publie:now };
    if (m.montant < 0) maj[J() + "caisse/" + id + "-depot/etat"] = "definitif";
    maj[J() + "soum_meta/" + id] = null; maj[J() + "soum_corps/" + id] = null;
    try { await ecrire(maj); } catch(e){ if (window.console) console.error("[Courier] publication", e); A.toast(TXT.ERR); return; }
    notifier(CFG.N.PUBLICATION, m.auteur, { titre:m.titre, url:lienHc("rub-" + (m.type==="rumeur" ? "une" : "annonces")) }, "hc-pub-" + id);
    A.toast(TXT.OK_PUBLIE); Bu.rafraichir({ traitee:true });
  }

  /* ===================== ACTIONS : RETOUCHE, MARBRE, REFUS ===================== */
  async function retouche(id){
    var m = Bu.meta(id), f = fiche(), motifs = [], n = (m.retouches||0) + 1;
    Array.prototype.forEach.call(f.querySelectorAll("[data-motif]:checked"), function(x){ motifs.push(x.getAttribute("data-motif")); });
    var texte = f.querySelector('[data-zone="r-texte"]').value.trim();
    if (!motifs.length && !texte) { A.toast(TXT.ERR_MOTIF); return; }
    if (n > 2) return;
    var p = J() + "soum_meta/" + id + "/", maj = {}, now = maintenant();
    maj[p + "statut"] = "retouche"; maj[p + "retouches"] = n; maj[p + "maj"] = now; maj[p + "reprise_avant"] = dansJours(CFG.DELAI_REPRISE_J);
    maj[p + "echanges"] = A.versTableau(m.echanges).concat([{ par:A.pseudo(), date:now, motifs:motifs, texte:texte }]);
    try { await ecrire(maj); } catch(e){ A.toast(TXT.ERR); return; }
    notifier(CFG.N.RETOUCHE, m.auteur, { titre:m.titre, url:lienHc("soum-" + id) }, "hc-ret-" + id + "-" + n);
    A.toast(TXT.OK_RETOUCHE); Bu.rafraichir({ traitee:true });
  }
  async function marbre(id){
    var m = Bu.meta(id), f = fiche(), d = f.querySelector('[data-zone="m-date"]').value;
    if (!d) { A.toast(TXT.ERR_DATE); return; }
    var p = J() + "soum_meta/" + id + "/", maj = {};
    maj[p + "statut"] = "marbre"; maj[p + "maj"] = maintenant();
    maj[p + "marbre"] = { jusqu_au:d, note:f.querySelector('[data-zone="m-note"]').value.trim(), par:A.pseudo() };
    try { await ecrire(maj); } catch(e){ A.toast(TXT.ERR); return; }
    notifier(CFG.N.MARBRE, m.auteur, { titre:m.titre, url:lienHc("soum-" + id) }, "hc-marbre-" + id + "-" + d);
    A.toast(TXT.OK_MARBRE); Bu.rafraichir({ traitee:true });
  }
  /* Refus : aussi appelé sans fiche par les échéances (délai de reprise dépassé) */
  async function refuser(id, motif, texte, silencieux){
    var m = Bu.meta(id); if (!m) return false;
    var p = J() + "soum_meta/" + id + "/", maj = {}, now = maintenant(), rend = m.montant < 0 ? -m.montant : 0;
    maj[p + "statut"] = "refusee"; maj[p + "maj"] = now;
    maj[p + "refus"] = { motif:motif, texte:texte || "", par:A.pseudo(), date:now };
    if (rend) maj[J() + "caisse/" + id + "-depot/etat"] = "rembourse";
    try { await ecrire(maj); } catch(e){ if (!silencieux) A.toast(TXT.ERR); return false; }
    var msg = TXT.OK_REFUS;
    if (rend) {
      try { await crediter(m.auteur, rend); msg += TXT.OK_REMB(rend); }
      catch(e){ var r = {}; r[J() + "caisse/" + id + "-depot/etat"] = "a_rembourser"; ecrire(r).catch(function(){}); msg = TXT.ERR_REMB; }
    }
    notifier(CFG.N.REFUS, m.auteur, { titre:m.titre, rendu:rend && msg!==TXT.ERR_REMB ? rend : 0, url:lienHc("soum-" + id) }, "hc-refus-" + id);
    if (!silencieux) { A.toast(msg); Bu.rafraichir({ traitee:true }); }
    return true;
  }
  async function ressortir(id, silencieux){
    var p = J() + "soum_meta/" + id + "/", maj = {};
    maj[p + "statut"] = "relecture"; maj[p + "marbre"] = null; maj[p + "maj"] = maintenant();
    try { await ecrire(maj); } catch(e){ if (!silencieux) A.toast(TXT.ERR); return false; }
    if (!silencieux) { A.toast(TXT.OK_RESSORTI); Bu.rafraichir(); }
    return true;
  }

  /* ===================== EVENTS ===================== */
  function ouvrirPanneau(id, bouton){
    var f = fiche(), act = bouton.getAttribute("data-act");
    Array.prototype.forEach.call(f.querySelectorAll(".tdlhc-act"), function(p){ p.hidden = p.getAttribute("data-act")!==act; });
    var cible = panneau(f, act); if (cible) cible.scrollIntoView({ behavior:"smooth", block:"start" });
  }
  function copier(id, bouton){
    var ta = bouton.closest(".tdlhc-act, .tdlhc-form").querySelector('[data-zone="post"]');
    var ok = function(){ A.toast(TXT.OK_COPIE); }, secours = function(){ ta.select(); try { document.execCommand("copy"); } catch(e){} ok(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(ok, secours); else secours();
  }
  function demarrer(){
    var C = window.Courier; A = C.api; Bu = C.bureau;
    Bu.panneaux = panneaux; Bu.panneauPost = panneauPost; Bu.genererPost = genererPost; Bu.slug = slug; Bu.enveloppe = enveloppe;
    Bu.corpsPost = corpsPost; Bu.crediter = crediter; Bu.refuser = refuser;
    Bu.N_CHRONO = CFG.NODE_CHRONO; Bu.PERIODE_CHRONO = CFG.PERIODE_CHRONO; Bu.CATS_CHRONO = CFG.CATS_CHRONO; Bu.ressortir = ressortir; Bu.ecrire = ecrire; Bu.notifier = notifier; Bu.N = CFG.N;
    Bu.actions.ouvrir = ouvrirPanneau;
    Bu.actions.annuler = function(){ Array.prototype.forEach.call(fiche().querySelectorAll(".tdlhc-act"), function(p){ p.hidden = true; }); };
    Bu.actions.copier = copier;
    Bu.actions.repondre = function(){ window.open(CFG.URL_REPONSE, "_blank"); };
    Bu.actions.confirmer = confirmer; Bu.actions.publierFb = publierFb;
    Bu.actions.retouche = retouche; Bu.actions.marbre = marbre;
    Bu.actions.refus = function(id){ var f = fiche(); refuser(id, f.querySelector('[data-zone="f-motif"]').value, f.querySelector('[data-zone="f-texte"]').value.trim()); };
    Bu.actions.ressortir = function(id, x){ ressortir(x.getAttribute("data-id")); };
        document.addEventListener("change", function(e){
      var sel = e.target, z = sel.getAttribute && sel.getAttribute("data-zone");
      if ((z!=="chrono" && z!=="une") || !sel.closest(".tdlhc-bureau")) return;
      var acte = sel.closest(".tdlhc-act");
      if (z==="chrono") {
        var cat = acte.querySelector('[data-zone="chrono-cat-champ"]');
        if (cat) cat.hidden = sel.value==="aucun";
      }
      var niv = acte.querySelector('[data-zone="chrono"]'), une = acte.querySelector('[data-zone="une"]');
      var ta = acte.querySelector('[data-zone="post"]');                 /* le post reflète les deux choix */
      if (ta) ta.value = genererPost(Bu.etat.sel, niv ? niv.value : "aucun", !!(une && une.checked));
    });
    document.addEventListener("input", function(e){
      if (e.target.getAttribute && e.target.getAttribute("data-zone")==="lien" && e.target.closest(".tdlhc-bureau")) {
        var b = e.target.closest(".tdlhc-act, .tdlhc-form").querySelector('[data-b="confirmer"]');
        if (b) b.disabled = !ancreDuLien(e.target.value.trim());
      }
    });
  }
  (function attendre(n){
    if (window.Courier && window.Courier.bureau) { demarrer(); return; }
    if ((n||0) < 60) setTimeout(function(){ attendre((n||0)+1); }, 250);
  })();
})();
