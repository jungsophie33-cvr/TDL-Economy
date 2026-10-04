/*
 * tdlhc-bureau-outils.js — Outils du bureau de rédaction · The Houma Courier · TDL · lot 3
 *
 * CE QUE CE FICHIER FAIT :
 *   - à chaque ouverture du bureau : refuse les retouches sans reprise dans le délai (somme
 *     rendue), ressort du marbre ce qui est arrivé à date, purge les refus de plus de 30 jours,
 *     prévient une fois les auteurs d'une annonce ou d'un pré-lien à trois jours du terme ;
 *   - Au marbre : liste et ressortie ;
 *   - Composer : article de la rédaction (chronologie, affaire) et avis légal (numéro calculé),
 *     post généré puis parution confirmée par le lien du message ;
 *   - Affaires : ouvrir, renommer, clore, rouvrir ;
 *   - Échéances : contenus expirés à retirer, pré-liens à renouveler ;
 *   - Caisse : mouvements, quotas du mois, badges de correspondant à attribuer dans ForumActif.
 *
 * DÉPEND DE : Courier.bureau et ses actions, Courier.envoi, window.EcoCore (firebaseUpdate).
 * À CHARGER : après tdlhc-bureau-actions.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var CFG = {
    SIGNATURES:   ["Kristina Dahlgaard", "La rédaction"],          /* [MAJ] signatures maison proposées */
    PURGE_REFUS_J: 30,
    PREVENIR_J:   3,
    RENOUVELLEMENT_J: 30,
    MAX_MOUVEMENTS: 60,
    N_ECHEANCE:   200
  };
  var RUBRIQUES = [["environnement","Environnement"],["securite","Sécurité"],["economie","Économie"],["paroisse","Paroisse"],
                   ["culture","Culture"],["nouvelles-des-bayous","Nouvelles des bayous"]];
  var NATURES_AVIS = [["succession","Succession"],["sherif","Vente du shérif"],["licence","Licence de débit"],["societe","Société"],
                      ["assignation","Assignation"],["expropriation","Expropriation"]];
  var ETATS = { retenu:"Retenu", definitif:"Définitif", rembourse:"Remboursé", verse:"Versé", a_verser:"À verser", a_rembourser:"À rembourser" };

  var TXT = {
    MARBRE:"Au marbre", MARBRE_SOUS:"Prêts, mis de côté pour une parution ultérieure", MARBRE_VIDE:"Rien au marbre.",
    RESSORTIR:"Ressortir", RESSORTIR_LE:function(d){ return "Ressortir le " + d; },
    COMPOSER:"Composer", COMPOSER_SOUS:"Publications signées par la rédaction", T_ARTICLE:"Article de la rédaction", T_AVIS:"Avis légal",
    TITRE:"Titre", SIGNATURE:"Signature", RUBRIQUE:"Rubrique", DATE:"Date de parution", EN_JEU:"en jeu", AFFAIRE:"Affaire",
    AUCUNE:"Aucune", NOUVELLE:"Ouvrir une nouvelle affaire…", NOM_AFFAIRE:"Nom de la nouvelle affaire",
    CHRONO:"Chronologie de la paroisse",
    CHRONOS:[["majeur","Majeur","entre dans la chronologie et notifie tout le forum."],["mineur","Mineur","entre dans la chronologie, sans notification."],
             ["aucun","Aucun","article courant."]],
    CHAPO:"Chapô", IMAGE:"Image", TEXTE:"Texte",
    TEXTE_AIDE:"Une ligne vide sépare deux paragraphes. Pour une citation, un paragraphe de la forme --- CITATION --- / TEXTE: / AUTEUR: / QUALITE: / --- FIN ---.",
    NATURE:"Nature", INTITULE:"Intitulé", AVIS_TEXTE:"Texte de l'avis", AVIS_PH:"Avis est donné de…",
    NUMERO_DEC:function(n){ return n ? n + (n>1 ? " avis déjà publiés cette année seront renumérotés." : " avis déjà publié cette année sera renuméroté.")
                                     : "Aucun avis existant ne sera renuméroté."; },
    GENERER:"Générer le post", ERR_COMPOSE:"Titre, date et texte sont obligatoires.",
    OK_COMPOSE:"Parution confirmée.", OK_MAJEUR:" Tout le forum est prévenu.",
    AFFAIRES:"Affaires", OUVRIR_AFF:"Ouvrir une affaire", AFF_VIDE:"Aucune affaire ouverte.",
    AFF_N:function(n){ return n + (n>1 ? " articles" : " article"); }, OUVERTE:"Ouverte", CLOSE:"Close",
    RENOMMER:"Renommer", CLORE:"Clore", ROUVRIR:"Rouvrir", PROMPT_NOM:"Nom de l'affaire :", AFF_EXISTE:"Une affaire porte déjà ce nom.",
    ECHEANCES:"Échéances", ECH_SOUS:"Vérifiées à chaque ouverture du bureau", ECH_VIDE:"Aucune échéance à traiter.",
    EXPIRE:"Expiré", DANS:function(j){ return j > 1 ? "Dans " + j + " jours" : "Demain"; }, RETIRER:"Retirer", RENOUVELER:"Renouveler un mois",
    TERMINE_LE:function(d){ return "terminé le " + d; }, EXPIRE_LE:function(d){ return "expire le " + d; },
    AUTO:function(r, s, p){ var l = []; if (r) l.push(r + " refus pour délai dépassé"); if (s) l.push(s + " ressortie" + (s>1?"s":"") + " du marbre");
                              if (p) l.push(p + " refus purgé" + (p>1?"s":"")); return l.length ? "Traité à l'ouverture : " + l.join(", ") + "." : ""; },
    DELAI:"Délai de reprise dépassé",
    CAISSE:"Caisse", MOUVEMENTS:"Mouvements", QUOTAS:"Quotas du mois", BADGES:"Badges", CAISSE_VIDE:"Aucun mouvement.",
    QUOTA_L:function(q){ return "Annonces " + q.annonce + " · Correspondances " + q.correspondant + " · Lettre " + q.lettre + " · Rumeur cette semaine " + q.rumeur; },
    BADGE_A:"Badge « Correspondant pour The Houma Courier » à attribuer dans ForumActif", BADGE_OK:"Attribué", BADGES_VIDE:"Aucun badge à attribuer.",
    TYPES:{ annonce:"Petite annonce", prelien:"Pré-lien", rumeur:"Rumeur" }, OK:"Enregistré.", ERR:"L'opération a échoué."
  };

  /* ===================== UTILS ===================== */
  var A = null, Bu = null;
  function esc(s){ return A.esc(s); }
  function J(){ return Bu.J(); }
  function base(){ return A.CFG.NODE_JOURNAL + "/"; }
  function jour(d){ var x = new Date(d); return x.getFullYear() + "-" + ("0"+(x.getMonth()+1)).slice(-2) + "-" + ("0"+x.getDate()).slice(-2); }
  function joursAvant(v){ return Math.ceil((A.ms(v) - Date.now()) / 86400000); }
  function opts(l, v){ return l.map(function(o){ return '<option value="' + esc(o[0]) + '"' + (o[0]===v ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join(""); }
  function plein(titre, droite, interieur){
    return '<div class="tdlhc-plein"><div class="tdlhc-ariane-bar"><div class="tdlhc-ariane">Bureau · <b>' + esc(titre) + '</b></div>' + (droite||"") + '</div>' + interieur + '</div>';
  }
  function ligne(h5, p, droite){
    return '<div class="tdlhc-row"><div class="tdlhc-row-txt"><h5>' + h5 + '</h5><p>' + p + '</p></div>' + (droite ? '<div class="tdlhc-row-btns">' + droite + '</div>' : "") + '</div>';
  }
  function bouton(b, libelle, attrs, cls){ return '<button class="tdlhc-btn ' + (cls || "creux petit") + '" type="button" data-b="' + b + '"' + (attrs||"") + '>' + esc(libelle) + '</button>'; }
  async function ecrire(maj, ok){
    try { await Bu.ecrire(maj); if (ok!==false) A.toast(ok || TXT.OK); await Bu.rafraichir(); return true; }
    catch(e){ if (window.console) console.error("[Courier] bureau", e); A.toast(TXT.ERR); return false; }
  }

  /* ===================== ÉCHÉANCES : calcul et traitements automatiques ===================== */
  function aRetirer(db){
    var j = A.journal(db), now = Date.now(), out = [];
    ["annonces","prelien","rumeurs"].forEach(function(n){ Object.keys(j[n] || {}).forEach(function(id){
      var x = j[n][id]; if (x && x.expire && A.ms(x.expire) <= now) out.push({ n:n, id:id, x:x });
    }); });
    return out;
  }
  function bientot(db){
    var j = A.journal(db), out = [];
    ["annonces","prelien"].forEach(function(n){ Object.keys(j[n] || {}).forEach(function(id){
      var x = j[n][id], r = x && x.expire ? joursAvant(x.expire) : 99; if (r > 0 && r <= CFG.PREVENIR_J) out.push({ n:n, id:id, x:x, j:r });
    }); });
    return out;
  }
  async function auOuvrir(db){
    var j = A.journal(db), meta = j.soum_meta || {}, now = Date.now(), r = 0, s = 0, p = 0, purge = {};
    for (var id in meta) {
      var m = meta[id]; if (!m || !meta.hasOwnProperty(id)) continue;
      if (m.statut==="retouche" && m.reprise_avant && A.ms(m.reprise_avant) <= now && await Bu.refuser(id, TXT.DELAI, "", true)) r++;
      else if (m.statut==="marbre" && m.marbre && m.marbre.jusqu_au && m.marbre.jusqu_au <= jour(now) && await Bu.ressortir(id, true)) s++;
      else if (m.statut==="refusee" && (now - A.ms(m.maj)) / 86400000 > CFG.PURGE_REFUS_J) {
        purge[base() + "soum_meta/" + id] = null; purge[base() + "soum_corps/" + id] = null; p++;
      }
    }
    bientot(db).forEach(function(b){
      if (b.x.notif3j) return;
      Bu.notifier(CFG.N_ECHEANCE, b.x.auteur, { titre:b.x.titre, jours:b.j, quoi:b.n==="prelien" ? "pré-lien" : "annonce",
                                                url:A.envoi.lien("rub-annonces") }, "hc-ech-" + b.id);
      purge[base() + b.n + "/" + b.id + "/notif3j"] = true;
    });
    if (Object.keys(purge).length) { try { await Bu.ecrire(purge); } catch(e){} }
    if (r || s || p || Object.keys(purge).length) await Bu.lire();
    var msg = TXT.AUTO(r, s, p); if (msg) A.toast(msg);
  }

  /* ===================== VUES : AU MARBRE, AFFAIRES, ÉCHÉANCES ===================== */
  function vueMarbre(sec){
    var n = J().soum_meta || {}, ids = Object.keys(n).filter(function(id){ return n[id] && n[id].statut==="marbre"; });
    sec.innerHTML = plein(TXT.MARBRE, '<div class="tdlhc-cpt">' + esc(TXT.MARBRE_SOUS) + '</div>', '<div class="tdlhc-rows">' + (ids.length ? ids.map(function(id){
      var m = n[id], mb = m.marbre || {};
      return ligne(esc(m.titre), esc(Bu.typeLabel(m) + " · " + m.auteur + (mb.note ? " · " + mb.note : "")),
        '<span class="tdlhc-cpt">' + esc(TXT.RESSORTIR_LE(A.dateLisible(mb.jusqu_au))) + '</span>' + bouton("ressortir", TXT.RESSORTIR, ' data-id="' + esc(id) + '"'));
    }).join("") : '<div class="tdlhc-chargement">' + esc(TXT.MARBRE_VIDE) + '</div>') + '</div>');
  }
  async function vueAffaires(sec){
    sec.innerHTML = plein(TXT.AFFAIRES, "", '<div class="tdlhc-chargement">…</div>');
    await A.chargerTout();
    var aff = J().affaires || {}, arts = A.contenus("article"), slugs = Object.keys(aff);
    sec.innerHTML = plein(TXT.AFFAIRES, bouton("aff-ouvrir", TXT.OUVRIR_AFF, "", ""), '<div class="tdlhc-rows">' + (slugs.length ? slugs.map(function(s){
      var a = aff[s] || {}, n = arts.filter(function(x){ return x.cles.DOSSIER===s; }).length, close = a.statut==="close";
      return ligne(esc(a.nom || s), esc(TXT.AFF_N(n)) + ' · <span class="tdlhc-statut ' + (close ? "relecture" : "publiee") + '">' + esc(close ? TXT.CLOSE : TXT.OUVERTE) + '</span>',
        bouton("aff-renommer", TXT.RENOMMER, ' data-slug="' + esc(s) + '"') + bouton("aff-statut", close ? TXT.ROUVRIR : TXT.CLORE, ' data-slug="' + esc(s) + '"'));
    }).join("") : '<div class="tdlhc-chargement">' + esc(TXT.AFF_VIDE) + '</div>') + '</div>');
  }
  function vueEcheances(sec, db){
    var exp = aRetirer(db), bt = bientot(db), j = A.journal(db), pre = j.prelien || {};
    var renouv = Object.keys(pre).filter(function(id){ var x = pre[id]; return x && !x.renouvele && A.ms(x.expire) > Date.now(); });
    var html = exp.map(function(e){
      return ligne(esc(e.x.titre || e.x.texte || ""), esc(TXT.TYPES[e.n==="annonces" ? "annonce" : e.n==="rumeurs" ? "rumeur" : "prelien"] + " · " + (e.x.auteur||"") + " · " + TXT.TERMINE_LE(A.dateLisible(e.x.expire))),
        '<span class="tdlhc-statut refusee">' + esc(TXT.EXPIRE) + '</span>' + bouton("retirer", TXT.RETIRER, ' data-n="' + e.n + '" data-id="' + esc(e.id) + '"'));
    }).join("") + bt.map(function(e){
      return ligne(esc(e.x.titre), esc(TXT.TYPES[e.n==="annonces" ? "annonce" : "prelien"] + " · " + e.x.auteur + " · " + TXT.EXPIRE_LE(A.dateLisible(e.x.expire))),
        '<span class="tdlhc-statut retouche">' + esc(TXT.DANS(e.j)) + '</span>');
    }).join("") + renouv.map(function(id){
      var x = pre[id];
      return ligne(esc(x.titre), esc(TXT.TYPES.prelien + " · " + x.auteur + " · " + TXT.EXPIRE_LE(A.dateLisible(x.expire))),
        bouton("renouveler", TXT.RENOUVELER, ' data-id="' + esc(id) + '"'));
    }).join("");
    sec.innerHTML = plein(TXT.ECHEANCES, '<div class="tdlhc-cpt">' + esc(TXT.ECH_SOUS) + '</div>',
      '<div class="tdlhc-rows">' + (html || '<div class="tdlhc-chargement">' + esc(TXT.ECH_VIDE) + '</div>') + '</div>');
  }

  /* ===================== VUE : CAISSE ===================== */
  function vueCaisse(sec, db){
    var j = A.journal(db), cs = j.caisse || {}, E = A.envoi;
    var mv = Object.keys(cs).map(function(k){ return cs[k]; }).filter(Boolean)
      .sort(function(a,b){ return A.ms(b.date) - A.ms(a.date); }).slice(0, CFG.MAX_MOUVEMENTS);
    var auteurs = {};
    [j.soum_meta, j.archive].forEach(function(n){ Object.keys(n || {}).forEach(function(k){ if (n[k] && n[k].auteur) auteurs[n[k].auteur] = 1; }); });
    var bd = j.badges || {}, attendus = Object.keys(bd).filter(function(p){ return bd[p] && !bd[p].attribue; });
    var tab = function(k, l, on){ return '<div class="tdlhc-onglet' + (on ? " on" : "") + '" data-pan="' + k + '">' + esc(l) + '</div>'; };
    sec.innerHTML = plein(TXT.CAISSE, "", '<div class="tdlhc-onglets">' + tab("mouv", TXT.MOUVEMENTS, 1) + tab("quotas", TXT.QUOTAS) + tab("badges", TXT.BADGES) + '</div>'
      + '<div class="tdlhc-pan" data-pan="mouv">' + (mv.length ? mv.map(function(m){
          return '<div class="tdlhc-row"><div class="tdlhc-row-txt"><h5>' + esc(m.pseudo) + '</h5><p>' + esc(m.libelle + " · " + A.dateLisible(m.date)) + '</p></div>'
            + '<div class="tdlhc-row-meta"><span class="tdlhc-mt ' + (m.montant > 0 ? "plus" : "moins") + '">' + (m.montant > 0 ? "+ " : "− ") + esc(Math.abs(m.montant)) + ' $</span>'
            + '<b>' + esc(ETATS[m.etat] || m.etat) + '</b></div></div>';
        }).join("") : '<div class="tdlhc-chargement">' + esc(TXT.CAISSE_VIDE) + '</div>') + '</div>'
      + '<div class="tdlhc-pan" data-pan="quotas" hidden>' + Object.keys(auteurs).sort().map(function(p){
          var q = {}; ["annonce","correspondant","lettre","rumeur"].forEach(function(k){ var c = E.compter(db, p, k); q[k] = c.n + "/" + c.max; });
          return ligne(esc(p), esc(TXT.QUOTA_L(q)));
        }).join("") + '</div>'
      + '<div class="tdlhc-pan" data-pan="badges" hidden>' + (attendus.length ? attendus.map(function(p){
          return ligne(esc(p), esc(TXT.BADGE_A), bouton("badge", TXT.BADGE_OK, ' data-pseudo="' + esc(p) + '"', ""));
        }).join("") : '<div class="tdlhc-chargement">' + esc(TXT.BADGES_VIDE) + '</div>') + '</div>');
  }

  /* ===================== VUE : COMPOSER ===================== */
  function champ(l, inner, note){ return '<div class="tdlhc-champ"><label>' + esc(l) + (note ? ' <span>— ' + esc(note) + '</span>' : "") + '</label>' + inner + '</div>'; }
  function vueComposer(sec){
    if (sec.getAttribute("data-pret")) return;
    var aff = J().affaires || {}, affOpts = [["", TXT.AUCUNE]].concat(Object.keys(aff).filter(function(s){ return aff[s] && aff[s].statut!=="close"; })
      .map(function(s){ return [s, aff[s].nom || s]; }), [["new", TXT.NOUVELLE]]);
    var auj = jour(Date.now());
    sec.innerHTML = plein(TXT.COMPOSER, '<div class="tdlhc-cpt">' + esc(TXT.COMPOSER_SOUS) + '</div>', '<div class="tdlhc-onglets">'
      + '<div class="tdlhc-onglet on" data-pan="c-art">' + esc(TXT.T_ARTICLE) + '</div><div class="tdlhc-onglet" data-pan="c-avis">' + esc(TXT.T_AVIS) + '</div></div>'
      + '<div class="tdlhc-pan" data-pan="c-art"><div class="tdlhc-form" data-form="article">'
      + champ(TXT.TITRE, '<input type="text" data-z="titre">')
      + '<div class="tdlhc-duo">' + champ(TXT.SIGNATURE, '<select data-z="signature">' + opts(CFG.SIGNATURES.map(function(s){ return [s, s]; })) + '</select>')
      + champ(TXT.RUBRIQUE, '<select data-z="rubrique">' + opts(RUBRIQUES) + '</select>') + '</div>'
      + '<div class="tdlhc-duo">' + champ(TXT.DATE, '<input type="date" data-z="date" value="' + auj + '">', TXT.EN_JEU)
      + champ(TXT.AFFAIRE, '<select data-z="affaire">' + opts(affOpts) + '</select>') + '</div>'
      + champ(TXT.NOM_AFFAIRE, '<input type="text" data-z="affaire_nom">')
      + champ(TXT.CHRONO, '<div class="tdlhc-radios">' + TXT.CHRONOS.map(function(c, i){
          return '<label class="tdlhc-coche"><input type="radio" name="tdlhc-chrono" value="' + c[0] + '"' + (i===2 ? " checked" : "") + '><span><b>' + esc(c[1]) + '</b> — ' + esc(c[2]) + '</span></label>';
        }).join("") + '</div>')
      + champ(TXT.CHAPO, '<textarea class="tdlhc-ta-court" data-z="chapo"></textarea>') + champ(TXT.IMAGE, '<input type="text" data-z="image" placeholder="https://…">')
      + champ(TXT.TEXTE, '<textarea class="tdlhc-ta-long" data-z="texte"></textarea><p class="tdlhc-aide">' + esc(TXT.TEXTE_AIDE) + '</p>')
      + bouton("generer", TXT.GENERER, ' data-quoi="article"', "") + '<div data-zone="sortie"></div></div></div>'
      + '<div class="tdlhc-pan" data-pan="c-avis" hidden><div class="tdlhc-form" data-form="avis">'
      + '<div class="tdlhc-duo">' + champ(TXT.NATURE, '<select data-z="nature">' + opts(NATURES_AVIS) + '</select>')
      + champ(TXT.DATE, '<input type="date" data-z="date" value="' + auj + '">', TXT.EN_JEU) + '</div>'
      + '<div class="tdlhc-numero"><strong data-zone="numero">…</strong><span data-zone="numero-dec"></span></div>'
      + champ(TXT.INTITULE, '<input type="text" data-z="titre">') + champ(TXT.AVIS_TEXTE, '<textarea class="tdlhc-ta-long" data-z="texte" placeholder="' + esc(TXT.AVIS_PH) + '"></textarea>')
      + bouton("generer", TXT.GENERER, ' data-quoi="avis"', "") + '<div data-zone="sortie"></div></div></div>');
    sec.setAttribute("data-pret", "1");
    numeroAvis(sec);
  }
  function lireForm(f){
    var v = {}; Array.prototype.forEach.call(f.querySelectorAll("[data-z]"), function(x){ v[x.getAttribute("data-z")] = x.value.trim(); });
    var r = f.querySelector('input[name="tdlhc-chrono"]:checked'); if (r) v.chrono = r.value;
    return v;
  }
  async function numeroAvis(sec){
    var f = sec.querySelector('[data-form="avis"]'); if (!f) return;
    await A.chargerTout();
    var d = f.querySelector('[data-z="date"]').value, an = d.slice(0, 4), avis = A.contenus("avis-legal").filter(function(c){ return c.cles.DATE.slice(0, 4)===an; });
    var avant = avis.filter(function(c){ return c.cles.DATE <= d; }).length, apres = avis.length - avant;
    f.querySelector('[data-zone="numero"]').textContent = an + "-" + ("000" + ((A.CFG.AVIS_BASE[an] || 0) + avant + 1)).slice(-4);
    f.querySelector('[data-zone="numero-dec"]').textContent = TXT.NUMERO_DEC(apres);
  }
  function generer(id, b){
    var f = b.closest(".tdlhc-form"), v = lireForm(f), quoi = b.getAttribute("data-quoi");
    if (!v.titre || !v.date || !v.texte) { A.toast(TXT.ERR_COMPOSE); return; }
    var post, nouvelle = quoi==="article" && v.affaire==="new" && v.affaire_nom ? { slug:Bu.slug(v.affaire_nom), nom:v.affaire_nom } : null;
    if (quoi==="article") post = Bu.enveloppe([["TYPE","article"],["DATE",v.date],["RUBRIQUE",v.rubrique],["STATUT","redaction"],["SIGNATURE",v.signature],
      ["TITRE",v.titre],["CHAPO",v.chapo],["IMAGE",v.image],["DOSSIER",nouvelle ? nouvelle.slug : (v.affaire==="new" ? "" : v.affaire)],
      ["CHRONO",v.chrono==="aucun" ? "" : v.chrono]], Bu.corpsPost(v.texte));
    else post = Bu.enveloppe([["TYPE","avis-legal"],["DATE",v.date],["NATURE",v.nature],["REF","al-" + Date.now().toString(36)],["TITRE",v.titre]], Bu.corpsPost(v.texte));
    Bu.compose = { titre:v.titre, chrono:v.chrono, affaire:nouvelle, form:f };
    f.querySelector('[data-zone="sortie"]').innerHTML = '<div class="tdlhc-act">' + Bu.panneauPost(post, "_compose") + '</div>';
    f.querySelector('[data-zone="sortie"] .tdlhc-act').scrollIntoView({ behavior:"smooth", block:"start" });
  }
  async function confirmerCompose(ancre){
    var c = Bu.compose; if (!c) return;
    if (c.affaire) { var maj = {}; maj[base() + "affaires/" + c.affaire.slug] = { nom:c.affaire.nom, statut:"ouverte", cree:new Date().toISOString() };
                     try { await Bu.ecrire(maj); } catch(e){ A.toast(TXT.ERR); return; } }
    var msg = TXT.OK_COMPOSE;
    if (c.chrono==="majeur" && A.envoi.CFG.NOTIFS && window.EcoNotif && EcoNotif.uneFois) {
      /* un seul envoi au forum, même si la parution est confirmée deux fois */
      try { EcoNotif.uneFois("hc-majeur-" + ancre, function(){
              return EcoNotif.tous(Bu.N.MAJEUR, { titre:c.titre, url:A.envoi.lien("art-" + ancre) }, "hc-majeur-" + ancre); });
            msg += TXT.OK_MAJEUR; } catch(e){}
    }
    c.form.closest(".tdlhc-vue").removeAttribute("data-pret"); Bu.compose = null;
    A.toast(msg); await Bu.rafraichir();
  }

  /* ===================== EVENTS ===================== */
  function actions(){
    var X = Bu.actions;
    X.generer = generer;
    X.retirer = function(id, b){ var m = {}; m[base() + b.getAttribute("data-n") + "/" + b.getAttribute("data-id")] = null; ecrire(m); };
    X.renouveler = function(id, b){
      var k = b.getAttribute("data-id"), x = (J().prelien || {})[k], m = {}; if (!x) return;
      m[base() + "prelien/" + k + "/expire"] = new Date(A.ms(x.expire) + CFG.RENOUVELLEMENT_J*86400000).toISOString();
      m[base() + "prelien/" + k + "/renouvele"] = true; ecrire(m);
    };
    X.badge = function(id, b){ var m = {}; m[base() + "badges/" + b.getAttribute("data-pseudo")] = { attribue:true, le:new Date().toISOString(), par:A.pseudo() }; ecrire(m); };
    X["aff-ouvrir"] = function(){
      var nom = (window.prompt(TXT.PROMPT_NOM) || "").trim(), s = Bu.slug(nom); if (!s) return;
      if ((J().affaires || {})[s]) { A.toast(TXT.AFF_EXISTE); return; }
      var m = {}; m[base() + "affaires/" + s] = { nom:nom, statut:"ouverte", cree:new Date().toISOString() }; ecrire(m);
    };
    X["aff-renommer"] = function(id, b){
      var s = b.getAttribute("data-slug"), a = (J().affaires || {})[s] || {}, nom = (window.prompt(TXT.PROMPT_NOM, a.nom || s) || "").trim(); if (!nom) return;
      var m = {}; m[base() + "affaires/" + s + "/nom"] = nom; ecrire(m);        /* l'identifiant ne change pas : les articles restent rattachés */
    };
    X["aff-statut"] = function(id, b){
      var s = b.getAttribute("data-slug"), a = (J().affaires || {})[s] || {}, m = {};
      m[base() + "affaires/" + s + "/statut"] = a.statut==="close" ? "ouverte" : "close"; ecrire(m);
    };
  }

  /* ===================== INIT ===================== */
  function demarrer(){
    var C = window.Courier; A = C.api; Bu = C.bureau;
    Bu.vues.marbre = vueMarbre; Bu.vues.affaires = vueAffaires; Bu.vues.echeances = vueEcheances;
    Bu.vues.caisse = vueCaisse; Bu.vues.composer = vueComposer;
    Bu.echeances = aRetirer; Bu.auOuvrir = auOuvrir; Bu.confirmerCompose = confirmerCompose;
    actions();
    document.addEventListener("change", function(e){
      var f = e.target.closest && e.target.closest('.tdlhc-bureau [data-form="avis"]');
      if (f && e.target.getAttribute("data-z")==="date") numeroAvis(f.closest(".tdlhc-vue"));
    });
  }
  (function attendre(n){
    if (window.Courier && window.Courier.bureau && window.Courier.bureau.panneaux) { demarrer(); return; }
    if ((n||0) < 60) setTimeout(function(){ attendre((n||0)+1); }, 250);
  })();
})();
