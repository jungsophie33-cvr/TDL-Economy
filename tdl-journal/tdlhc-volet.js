/*
 * tdlhc-volet.js — Volet « Soumettre au Courier » · The Houma Courier · TDL · lot 2
 *
 * CE QUE CE FICHIER FAIT :
 *   - pose le bouton « Soumettre au Courier » dans le mastic et le volet latéral ;
 *   - affiche l'étape de choix, puis le formulaire du type choisi (six types) ;
 *   - collecte les champs, gère compteurs, champs conditionnels et citations du pigiste ;
 *   - expose Courier.volet, auquel tdlhc-envoi et tdlhc-suivi accrochent leurs fonctions.
 * CE QU'IL NE FAIT PAS : aucun contrôle métier ni aucune écriture (tdlhc-envoi),
 *   ni le suivi des soumissions et des accords (tdlhc-suivi).
 *
 * DÉPEND DE : window.Courier (tdlhc-core).
 * EXPOSE : window.Courier.volet.
 * À CHARGER : après tdlhc-rendu-listes, AVANT tdlhc-envoi et tdlhc-suivi.
 */
(function () {
  "use strict";

  /* ===================== CONFIG ===================== */
  var CFG = {
    SECTEURS: ["Houma", "Bayou Black", "Dulac", "Montegut", "Chauvin", "Petit Caillou"],
    MAX: { titre:70, annonce:400, civil:300, rumeur:200, lettre:1500, prelien:300, chapo:320, citation:180 },
    MAX_CITATIONS: 2
  };
  var TYPES = {
    annonce: { t:"Petite annonce",              ic:"bullhorn",        c:"--gr1-color", tarif:"30 $",      cout:"30 $ retenus au dépôt",
               desc:"Emploi, logement, service, objet à vendre, recherche personnelle." },
    civil:   { t:"Avis d'état civil",           ic:"family",          c:"--gr5-color", tarif:"Gratuit",   cout:"Gratuit",
               desc:"Naissance, mariage, décès dans la famille de votre personnage." },
    rumeur:  { t:"Rumeur",                      ic:"comments",        c:"--gr6-color", tarif:"Gratuit",   cout:"Gratuit · 1 par semaine",
               desc:"Ce qui se dit au marché. Une soumission par semaine." },
    lettre:  { t:"Lettre au rédacteur",         ic:"envelope",        c:"--gr4-color", tarif:"Gratuit",   cout:"Gratuit · 1 par mois",
               desc:"Une opinion, une réaction à un article, une mise au point." },
    prelien: { t:"Mise en avant d'un pré-lien", ic:"address-card",    c:"--gr3-color", tarif:"50 $",      cout:"50 $ retenus · parution d'un mois",
               desc:"Votre recherche de liens épinglée en tête des petites annonces, un mois durant." },
    article: { t:"Proposer un article",         ic:"feather-pointed", c:"--gr2-color", tarif:"Rémunéré",  cout:"",
               desc:"Correspondance ou pige. Votre texte est relu avant parution." }
  };
  var ORDRE = ["annonce", "civil", "rumeur", "lettre", "prelien", "article"];
  var RUB_ANNONCE = [["emploi","Emploi"],["logement","Logement"],["services","Services"],["vendre","À vendre"],["perso","Avis personnels"]];
  var NATURE_CIVIL = [["naissance","Naissance"],["mariage","Mariage"],["deces","Décès"]];
  var NATURE_PRELIEN = [["famille","Famille ou parenté"],["amitie","Amitié ancienne"],["associe","Associé ou employeur"],
                        ["rancune","Rancune ou dette"],["voisinage","Voisinage"],["autre","Autre"]];
  var RUB_ARTICLE = [["nouvelles-des-bayous","Nouvelles des bayous"],["paroisse","Paroisse"],["economie","Économie"],
                     ["culture","Culture"],["environnement","Environnement"],["securite","Sécurité"]];

  var TXT = {
    BOUTON:"Soumettre au Courier", TITRE:"Soumettre au Courier", FERMER:"Fermer",
    ATTENTION:"À votre attention", CHOIX:"Que souhaitez-vous faire paraître ?", MES:"Mes soumissions",
    NOTE_CHOIX:"Toute soumission est relue par la rédaction avant parution. Les sommes sont retenues au dépôt et rendues si le texte n'est pas retenu.",
    CHOISIR:"Sélectionnez un type de parution", RETOUR:"Retour", ENVOYER:"Envoyer à la rédaction", RENVOYER:"Renvoyer à la rédaction",
    REPRENDRE:"Reprendre — ", CHARGEMENT:"Un instant…", ENVOI:"Envoi en cours…",
    COUT_CORR:"Correspondance — 50 $ versés à la parution", COUT_PIGE:"Pige — 80 $ versés à la parution",
    OPTIONNEL:"optionnel", EN_JEU:"en jeu",
    ENC_CIVIL:["Un avis d'état civil engage une famille",
      "L'avis paraît sous le nom de la famille de votre personnage et devient un fait acquis de la paroisse.",
      "Si une autre famille jouée est concernée (mariage, parenté), l'accord du joueur est demandé avant parution.",
      "La rédaction n'écrit pas les circonstances d'un décès. Si elles comptent, elles relèvent d'un article, pas d'un avis."],
    ENC_RUMEUR:["Une rumeur n'est pas un fait",
      "Ce qui paraît ici peut être faux, déformé, ou vrai à moitié. Personne n'est tenu d'en faire une vérité dans ses RP.",
      "Aucun accord n'est demandé aux personnages visés : une rumeur circule sans permission. La rédaction écarte ce qui relève du règlement de comptes entre joueurs.",
      "Une soumission par semaine et par membre."],
    ENC_LETTRE:["Ce qu'une lettre peut faire",
      "Donner un avis, répondre à un article, corriger ce qui a été écrit sur votre personnage ou sa famille.",
      "Elle paraît sous la responsabilité de son auteur. La rédaction peut l'écourter, jamais la réécrire.",
      "Une lettre par mois et par membre. Elle ne vise pas un joueur : elle vise un personnage, un fait ou une décision."],
    ENC_PRELIEN:["Comment paraît la mise en avant",
      "Votre recherche est épinglée en tête des petites annonces pendant un mois, dans un encadré à part, avec un bouton qui mène à votre sujet de pré-lien.",
      "Le texte est rédigé à la première personne, par votre personnage : c'est une annonce de journal.",
      "Elle ne compte pas dans vos deux petites annonces du mois. Renouvelable une fois."],
    ENC_ARTICLE:["Deux façons d'écrire pour le Courier",
      "<b>Correspondance — 50 $.</b> Ouverte à tout le monde, ponctuellement. Vous étiez là, vous racontez : compte rendu d'un événement membre, d'une tradition, d'une réception. Vous décrivez ce qui s'est passé, sans citer personne entre guillemets et sans mettre qui que ce soit en cause. Deux par mois et par membre. 2 500 signes minimum.",
      "<b>Pige — 80 $.</b> Réservée aux personnages journalistes au Courier. Vous pouvez citer entre guillemets, écrire qu'une partie n'a pas répondu, rattacher l'article à une affaire en cours ou à une enquête classée. 4 000 signes minimum."],
    NOTE_ARTICLE:"Les conclusions d'intrigue restent signées par la rédaction. Un pigiste peut en écrire l'encadré local, sur commande du staff.",
    PIGE_OK:"Outils du pigiste", PIGE_NON:"Réservé aux pigistes — citations, affaire et enquête",
    PIGE_REFUS:" (réservé aux journalistes du Courier)",
    AUCUNE:"Aucune", AUCUN_ARTICLE:"Aucun article en particulier", NOUVELLE_AFFAIRE:"Ouvrir une nouvelle affaire…",
    CIT_AJOUT:"Ajouter une citation", CIT:"Citation", CIT_RETIRER:"Retirer",
    CIT_AIDE:"Deux maximum. Chacune est insérée après le paragraphe indiqué.",
    BANNIERE:function(n){ return "Retouche " + n + " sur 2 — ce que demande la rédaction"; },
    LIMITE:function(d){ return "Corrigez puis renvoyez avant le " + d + " ; passé ce délai, la soumission est refusée."; }
  };

  /* ===================== UTILS ===================== */
  var A = null, V = null, el = {}, etat = { type:null, valeurs:null, occupe:false };
  function esc(s){ return A.esc(s); }
  function boucle(l, fn){ Array.prototype.forEach.call(l, fn); }
  function aujourdhui(){ var d = new Date(); return d.getFullYear() + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0"+d.getDate()).slice(-2); }
  function val(v, k, defaut){ return v && v[k]!=null ? v[k] : (defaut==null ? "" : defaut); }

  /* ---------- champs ---------- */
  function champ(label, inner, o){
    o = o || {};
    var cpt = o.max ? '<span class="tdlhc-compteur" data-pour="' + o.k + '" data-max="' + o.max + '">0 / ' + o.max + '</span>'
            : o.compte ? '<span class="tdlhc-compteur" data-pour="' + o.k + '" data-max="0">0 signe</span>' : "";
    return '<div class="tdlhc-champ"' + (o.id ? ' data-zone="' + o.id + '"' : "") + (o.cache ? " hidden" : "") + '><label>' + esc(label)
      + (o.note ? ' <span>— ' + esc(o.note) + '</span>' : "") + cpt + '</label>' + inner
      + (o.aide ? '<p class="tdlhc-aide">' + esc(o.aide) + '</p>' : "") + '</div>';
  }
  function inp(k, v, ph, max, type){
    return '<input type="' + (type||"text") + '" data-k="' + k + '"' + (max ? ' maxlength="' + max + '"' : "")
      + ' placeholder="' + esc(ph||"") + '" value="' + esc(v) + '">';
  }
  function ta(k, v, ph, max, haut){
    return '<textarea data-k="' + k + '"' + (max ? ' maxlength="' + max + '"' : "") + ' placeholder="' + esc(ph||"") + '"'
      + (haut ? ' class="tdlhc-ta-' + haut + '"' : "") + '>' + esc(v) + '</textarea>';
  }
  function sel(k, v, opts){
    return '<select data-k="' + k + '">' + opts.map(function(o){
      return '<option value="' + esc(o[0]) + '"' + (String(o[0])===String(v) ? " selected" : "") + (o[2] ? " disabled" : "") + '>' + esc(o[1]) + '</option>';
    }).join("") + '</select>';
  }
  function coche(k, v, label){ return '<label class="tdlhc-coche"><input type="checkbox" data-k="' + k + '"' + (v ? " checked" : "") + '><span>' + esc(label) + '</span></label>'; }
  function duo(a, b){ return '<div class="tdlhc-duo">' + a + b + '</div>'; }
  function encart(ic, l, note){
    return '<div class="tdlhc-encart"><h5><i class="fi fi-tr-' + ic + '"></i> ' + esc(l[0]) + '</h5><ul>'
      + l.slice(1).map(function(x){ return "<li>" + x + "</li>"; }).join("") + '</ul>'
      + (note ? '<p class="tdlhc-note">' + esc(note) + '</p>' : "") + '</div>';
  }
  function quota(){ return '<p class="tdlhc-quota" data-quota hidden></p>'; }

  /* ===================== RENDER : FORMULAIRES ===================== */
  var FORM = {
    annonce: function(v, ctx){
      return quota() + champ("Titre de l'annonce", inp("titre", val(v,"titre"), "Cherche main-d'œuvre ponctuelle", CFG.MAX.titre))
        + champ("Rubrique", sel("rubrique", val(v,"rubrique","emploi"), RUB_ANNONCE))
        + champ("Texte", ta("texte", val(v,"texte"), "Soyez bref et concret. C'est une annonce de journal, pas un RP.", CFG.MAX.annonce),
                { k:"texte", max:CFG.MAX.annonce, aide:"Texte brut uniquement. La mise en forme du journal est appliquée à la parution." })
        + duo(champ("Signé par", inp("signature", val(v,"signature",ctx.pseudo))),
              champ("Durée", sel("duree", val(v,"duree",14), [[14,"Deux semaines"],[30,"Un mois"]])));
    },
    civil: function(v, ctx){
      return encart("family", TXT.ENC_CIVIL)
        + champ("Nature de l'avis", sel("nature", val(v,"nature","naissance"), NATURE_CIVIL))
        + duo(champ("Nom de la famille", inp("famille", val(v,"famille"), "LeBlanc")),
              champ("Date de l'événement", inp("date", val(v,"date",aujourdhui()), "", 0, "date"), { note:TXT.EN_JEU }))
        + champ("Personnes concernées", inp("personnes", val(v,"personnes"), "Céleste et Antoine LeBlanc — Juliette Marie"),
                { aide:"Prénoms et noms tels qu'ils paraîtront dans le journal." })
        + champ("Lieu", inp("lieu", val(v,"lieu"), "Houma"), { note:TXT.OPTIONNEL })
        + champ("Texte de l'avis", ta("texte", val(v,"texte"), "Le ton du journal est sobre. Une à trois phrases suffisent.", CFG.MAX.civil),
                { k:"texte", max:CFG.MAX.civil })
        + champ("Cérémonie", inp("ceremonie", val(v,"ceremonie"), "Baptême le 7 juin à Sainte-Anne"), { note:TXT.OPTIONNEL })
        + coche("rp_ouvert", val(v,"rp_ouvert",false), "Cette cérémonie fera l'objet d'un RP ouvert à d'autres personnages.")
        + champ("Lien du sujet RP", inp("rp", val(v,"rp"), "https://…/t000-sujet"),
                { id:"rp", cache:!val(v,"rp_ouvert",false), aide:"Le lien apparaît sous l'avis : n'importe qui peut s'inviter à la cérémonie." })
        + champ("Personnages joués d'une autre famille", inp("cites", val(v,"cites"), "Pseudos, séparés par des virgules"),
                { note:TXT.OPTIONNEL, aide:"Leur accord leur est demandé dès l'envoi ; sans accord, l'avis ne paraît pas." });
    },
    rumeur: function(v){
      return quota() + encart("comments", TXT.ENC_RUMEUR)
        + champ("Secteur", sel("secteur", val(v,"secteur",CFG.SECTEURS[0]), CFG.SECTEURS.map(function(s){ return [s, s]; })))
        + champ("Ce qui se dit", ta("texte", val(v,"texte"), "On dit que… / Quelqu'un aurait vu…", CFG.MAX.rumeur, "court"),
                { k:"texte", max:CFG.MAX.rumeur })
        + champ("Sujet RP d'origine", inp("rp", val(v,"rp"), "https://…/t000-sujet"),
                { note:TXT.OPTIONNEL, aide:"Si la rumeur est née d'une scène que vous avez lue." });
    },
    lettre: function(v, ctx){
      var arts = [["", TXT.AUCUN_ARTICLE]].concat(ctx.articles.map(function(a){ return [a.ancre, a.cles.TITRE + " — " + A.dateLisible(a.cles.DATE)]; }));
      return quota() + encart("envelope", TXT.ENC_LETTRE)
        + champ("Objet de la lettre", inp("titre", val(v,"titre"), "« On nous avait dit trois jours en 2021 aussi »", CFG.MAX.titre))
        + champ("En réponse à", sel("reponse_a", val(v,"reponse_a"), arts), { note:TXT.OPTIONNEL, aide:"La lettre paraîtra aussi sous l'article." })
        + champ("Votre lettre", ta("texte", val(v,"texte"), "Monsieur le rédacteur,", CFG.MAX.lettre, "long"), { k:"texte", max:CFG.MAX.lettre })
        + duo(champ("Signature", inp("signature", val(v,"signature",ctx.pseudo))), champ("Lieu", inp("lieu", val(v,"lieu"), "Bayou Black")))
        + coche("pseudonyme", val(v,"pseudonyme",false), "Je signe d'un pseudonyme, écrit ci-dessus : « un pêcheur de Dulac ». Le staff connaît l'auteur, les lecteurs non.");
    },
    prelien: function(v, ctx){
      return encart("address-card", TXT.ENC_PRELIEN)
        + champ("Titre de l'annonce", inp("titre", val(v,"titre"), "Qui se souvient de l'équipage du Marie-Lou ?", CFG.MAX.titre))
        + champ("Lien vers votre sujet de pré-lien", inp("url", val(v,"url"), "https://…/t000-prelien"))
        + champ("Ce que votre personnage cherche", sel("nature", val(v,"nature","famille"), NATURE_PRELIEN))
        + champ("Texte", ta("texte", val(v,"texte"), "Écrivez-le comme une petite annonce : ce que votre personnage cherche, et pourquoi.", CFG.MAX.prelien),
                { k:"texte", max:CFG.MAX.prelien })
        + champ("Signé par", inp("signature", val(v,"signature",ctx.pseudo)));
    },
    article: function(v, ctx){
      var statuts = [["correspondant","Correspondant — 50 $"],["pigiste","Pigiste — 80 $" + (ctx.pigiste ? "" : TXT.PIGE_REFUS), !ctx.pigiste]];
      return quota() + encart("feather-pointed", TXT.ENC_ARTICLE, TXT.NOTE_ARTICLE)
        + champ("Vous écrivez en tant que", sel("statut", val(v,"statut","correspondant"), statuts))
        + champ("Titre", inp("titre", val(v,"titre"), "Le souper des Dames de Sainte-Anne a nourri cent quatre-vingts personnes"))
        + duo(champ("Rubrique", sel("rubrique", val(v,"rubrique","nouvelles-des-bayous"), RUB_ARTICLE)),
              champ("Date de parution", inp("date", val(v,"date",aujourdhui()), "", 0, "date"), { note:TXT.EN_JEU, aide:"Celle du journal, pas celle du post." }))
        + champ("Chapô", ta("chapo", val(v,"chapo"), "Deux ou trois phrases qui résument l'article.", CFG.MAX.chapo, "court"),
                { k:"chapo", max:CFG.MAX.chapo, note:TXT.OPTIONNEL, aide:"Sans chapô, le journal affichera les premières lignes du texte." })
        + champ("Image", inp("image", val(v,"image"), "https://zupimages.net/…"), { note:TXT.OPTIONNEL, aide:"Format paysage." })
        + champ("Lien du sujet RP concerné", inp("rp", val(v,"rp"), "https://…/t000-sujet"),
                { aide:"Un seul article par événement : un sujet déjà couvert bloque l'envoi." })
        + champ("Personnages joués cités", inp("cites", val(v,"cites"), "Pseudos, séparés par des virgules"),
                { aide:"Leur accord leur est demandé dès l'envoi ; sans accord, l'article ne paraît pas." })
        + champ("Votre texte", ta("texte", val(v,"texte"), "Écrivez comme un journal : les faits d'abord, les noms ensuite.", 0, "long"),
                { k:"texte", compte:true, aide:"Une ligne vide sépare deux paragraphes." })
        + formPige(v, ctx);
    }
  };
  function formPige(v, ctx){
    var aff = [["", TXT.AUCUNE]].concat(ctx.affaires.map(function(a){ return [a.slug, a.nom]; }), [["new", TXT.NOUVELLE_AFFAIRE]]);
    var enq = [["", TXT.AUCUNE]].concat(ctx.enquetes.map(function(e){ return [e.id, e.titre]; }));
    return '<div class="tdlhc-pige" data-zone="pige"><p class="tdlhc-legende" data-zone="pige-titre"></p>'
      + champ("Rattacher à une affaire", sel("affaire", val(v,"affaire"), aff), { note:TXT.OPTIONNEL })
      + champ("Nom de la nouvelle affaire", inp("affaire_nom", val(v,"affaire_nom"), "Envasement du chenal de Petit Caillou"),
              { id:"affaire-nom", cache:val(v,"affaire")!=="new" })
      + champ("Enquête du shérif", sel("enquete", val(v,"enquete"), enq), { note:TXT.OPTIONNEL, aide:"Seules les enquêtes classées sont proposées." })
      + champ("Citations", '<div data-zone="citations"></div><button class="tdlhc-btn creux" type="button" data-action="cit-ajout"><i class="fi fi-tr-block-quote"></i> '
              + esc(TXT.CIT_AJOUT) + '</button>', { aide:TXT.CIT_AIDE })
      + '</div>';
  }
  function htmlCitation(c){
    c = c || {};
    return '<div class="tdlhc-cit-item"><div class="tdlhc-cit-tete"><span>' + esc(TXT.CIT) + '</span>'
      + '<button type="button" class="tdlhc-sup" data-action="cit-retire">' + esc(TXT.CIT_RETIRER) + '</button></div>'
      + champ("Ce qui est dit", '<textarea data-c="texte" maxlength="' + CFG.MAX.citation + '" class="tdlhc-ta-court">' + esc(c.texte||"") + '</textarea>')
      + duo(champ("Qui parle", '<input type="text" data-c="auteur" value="' + esc(c.auteur||"") + '">'),
            champ("Après le paragraphe n°", '<input type="number" min="1" data-c="apres" value="' + esc(c.apres||1) + '">'))
      + champ("Qualité", '<input type="text" data-c="qualite" value="' + esc(c.qualite||"") + '">') + '</div>';
  }
  function banniere(v){
    var b = v && v._banniere; if (!b) return "";
    return '<div class="tdlhc-reprise"><p class="tdlhc-legende">' + esc(TXT.BANNIERE(b.n)) + '</p><div class="tdlhc-mes-com">'
      + (b.motifs ? '<b>' + esc(b.motifs) + '</b>' : "") + esc(b.texte||"") + '</div><p class="tdlhc-aide">' + esc(TXT.LIMITE(b.limite)) + '</p></div>';
  }

  /* ===================== RENDER : COQUILLE ET ÉTAPES ===================== */
  function construire(){
    el.voile = document.createElement("div"); el.voile.className = "tdlhc-voile";
    el.volet = document.createElement("aside"); el.volet.className = "tdlhc-volet"; el.volet.setAttribute("aria-hidden", "true");
    el.volet.innerHTML = '<div class="tdlhc-volet-tete"><h3></h3><button class="tdlhc-x" type="button" aria-label="' + esc(TXT.FERMER) + '">'
      + '<i class="fi fi-tr-cross-small"></i></button></div><div class="tdlhc-volet-corps"></div>'
      + '<div class="tdlhc-volet-pied"><div class="tdlhc-alerte"><i class="fi fi-tr-exclamation"></i><div></div></div>'
      + '<div class="tdlhc-pied-ligne"><div class="tdlhc-cout"></div><div class="tdlhc-pied-btns">'
      + '<button class="tdlhc-btn creux" type="button" data-action="retour">' + esc(TXT.RETOUR) + '</button>'
      + '<button class="tdlhc-btn" type="button" data-action="envoyer"><i class="fi fi-tr-envelope-plus"></i> <span></span></button></div></div></div>';
    document.body.appendChild(el.voile); document.body.appendChild(el.volet);
    el.titre = el.volet.querySelector("h3"); el.corps = el.volet.querySelector(".tdlhc-volet-corps");
    el.alerte = el.volet.querySelector(".tdlhc-alerte"); el.cout = el.volet.querySelector(".tdlhc-cout");
    el.retour = el.volet.querySelector('[data-action="retour"]'); el.envoyer = el.volet.querySelector('[data-action="envoyer"]');
  }
  function pied(cout, retour, envoyer){
    el.cout.textContent = cout || ""; el.retour.hidden = !retour;
    el.envoyer.hidden = !envoyer; el.envoyer.disabled = false;
    if (envoyer) el.envoyer.querySelector("span").textContent = envoyer;
  }
  function alerte(msg){
    el.alerte.classList.toggle("on", !!msg);
    el.alerte.querySelector("div").innerHTML = msg ? (Array.isArray(msg) ? msg.map(esc).join("<br class=\"tdlhc-br\">") : esc(msg)) : "";
  }
  function etapeChoix(){
    etat.type = null; etat.valeurs = null; alerte(null);
    el.titre.textContent = TXT.TITRE;
    el.corps.innerHTML = '<div class="tdlhc-mes" data-zone="attention" hidden></div>'
      + '<p class="tdlhc-legende">' + esc(TXT.CHOIX) + '</p><div class="tdlhc-types">'
      + ORDRE.map(function(k){ var t = TYPES[k];
          return '<div class="tdlhc-type" data-type="' + k + '" style="--c:var(' + t.c + ')"><i class="fi fi-sr-' + t.ic + '"></i>'
            + '<div class="tdlhc-type-txt"><h5>' + esc(t.t) + '</h5><p>' + esc(t.desc) + '</p></div><div class="tdlhc-tarif">' + esc(t.tarif) + '</div></div>';
        }).join("") + '</div><p class="tdlhc-note">' + esc(TXT.NOTE_CHOIX) + '</p>'
      + '<div class="tdlhc-mes apres" data-zone="mes" hidden></div>';
    pied(TXT.CHOISIR, false, null);
    el.corps.scrollTop = 0;
    if (V.hooks.choix) V.hooks.choix(el.corps);
  }
  async function etapeForm(type, valeurs){
    etat.type = type; etat.valeurs = valeurs || null; alerte(null);
    el.titre.textContent = (valeurs && valeurs.reprise ? TXT.REPRENDRE : "") + TYPES[type].t;
    el.corps.innerHTML = '<div class="tdlhc-chargement">' + esc(TXT.CHARGEMENT) + '</div>';
    pied("", true, null);
    var ctx = V.hooks.contexte ? await V.hooks.contexte(type) : { pseudo:A.pseudo(), articles:[], affaires:[], enquetes:[], pigiste:false };
    if (etat.type !== type) return;                        /* l'utilisateur est reparti entre-temps */
    el.corps.innerHTML = banniere(valeurs) + FORM[type](valeurs || {}, ctx);
    (valeurs && valeurs.citations || []).forEach(function(c){ ajouterCitation(c); });
    synchroniser();
    pied(TYPES[type].cout, true, valeurs && valeurs.reprise ? TXT.RENVOYER : TXT.ENVOYER);
    boucle(el.corps.querySelectorAll("[data-k]"), majCompteur);
    el.corps.scrollTop = 0;
    if (V.hooks.preparer) V.hooks.preparer(type, el.corps, valeurs || {});
  }
  /* étape libre, pour tdlhc-suivi (demande d'accord) */
  function etapeLibre(titre, html, cout){
    etat.type = "_libre"; alerte(null);
    el.titre.textContent = titre; el.corps.innerHTML = html; el.corps.scrollTop = 0;
    pied(cout || "", true, null);
  }

  /* champs qui dépendent d'autres champs, et coût de l'article selon le statut */
  function synchroniser(){
    var v = collecter(), z = function(n){ return el.corps.querySelector('[data-zone="' + n + '"]'); };
    if (z("rp") && etat.type==="civil") z("rp").hidden = !v.rp_ouvert;
    if (z("affaire-nom")) z("affaire-nom").hidden = v.affaire!=="new";
    if (etat.type==="article") {
      var pige = v.statut==="pigiste";
      z("pige").classList.toggle("tdlhc-reservee", !pige);
      z("pige-titre").textContent = pige ? TXT.PIGE_OK : TXT.PIGE_NON;
      el.cout.textContent = pige ? TXT.COUT_PIGE : TXT.COUT_CORR;
      var q = el.corps.querySelector("[data-quota]"); if (q && q.innerHTML) q.hidden = pige;   /* la pige n'a pas de quota */
      var cpt = el.corps.querySelector('.tdlhc-compteur[data-pour="texte"]');
      if (cpt) cpt.setAttribute("data-plancher", pige ? 4000 : 2500);
    }
  }
  function majCompteur(champEl){
    var cpt = el.corps.querySelector('.tdlhc-compteur[data-pour="' + champEl.getAttribute("data-k") + '"]'); if (!cpt) return;
    var n = champEl.value.length, max = parseInt(cpt.getAttribute("data-max"),10), pl = cpt.getAttribute("data-plancher");
    cpt.textContent = max ? n + " / " + max : n + " signe" + (n>1 ? "s" : "") + (pl ? " · minimum " + Number(pl).toLocaleString("fr-FR") : "");
  }
  function ajouterCitation(c){
    var zone = el.corps.querySelector('[data-zone="citations"]'); if (!zone) return;
    if (zone.children.length >= CFG.MAX_CITATIONS) return;
    zone.insertAdjacentHTML("beforeend", htmlCitation(c));
    el.corps.querySelector('[data-action="cit-ajout"]').disabled = zone.children.length >= CFG.MAX_CITATIONS;
  }
  function collecter(){
    var v = {};
    boucle(el.corps.querySelectorAll("[data-k]"), function(x){ v[x.getAttribute("data-k")] = x.type==="checkbox" ? x.checked : x.value.trim(); });
    v.citations = [];
    boucle(el.corps.querySelectorAll(".tdlhc-cit-item"), function(it){
      var c = {}; boucle(it.querySelectorAll("[data-c]"), function(x){ c[x.getAttribute("data-c")] = x.value.trim(); });
      c.apres = parseInt(c.apres,10) || 1; v.citations.push(c);
    });
    if (etat.valeurs && etat.valeurs.reprise) v.reprise = etat.valeurs.reprise;
    return v;
  }

  /* ===================== EVENTS ===================== */
  function ouvre(type, valeurs){
    el.voile.classList.add("on"); el.volet.classList.add("on"); el.volet.setAttribute("aria-hidden", "false");
    if (type && FORM[type]) etapeForm(type, valeurs); else etapeChoix();
  }
  function ferme(){
    el.voile.classList.remove("on"); el.volet.classList.remove("on"); el.volet.setAttribute("aria-hidden", "true");
    etat.type = null;
  }
  async function envoyer(){
    if (etat.occupe || !V.hooks.envoyer || !FORM[etat.type]) return;
    etat.occupe = true; el.envoyer.disabled = true; alerte(null);
    var lib = el.envoyer.querySelector("span"), avant = lib.textContent; lib.textContent = TXT.ENVOI;
    try {
      var r = await V.hooks.envoyer(etat.type, collecter());
      if (r && r.ok) { ferme(); A.toast(r.message); if (V.hooks.apres) V.hooks.apres(); }
      else if (r && r.erreurs) alerte(r.erreurs);
    } finally { etat.occupe = false; el.envoyer.disabled = false; lib.textContent = avant; }
  }
  function brancher(){
    el.voile.addEventListener("click", ferme);
    document.addEventListener("keydown", function(e){ if (e.key==="Escape" && el.volet.classList.contains("on")) ferme(); });
    el.volet.addEventListener("click", function(e){
      var t = e.target, x;
      if (t.closest(".tdlhc-x")) { ferme(); return; }
      if ((x = t.closest(".tdlhc-type"))) { etapeForm(x.getAttribute("data-type")); return; }
      if ((x = t.closest('[data-action]'))) {
        var a = x.getAttribute("data-action");
        if (a==="retour") etapeChoix();
        else if (a==="envoyer") envoyer();
        else if (a==="cit-ajout") ajouterCitation();
        else if (a==="cit-retire") { x.closest(".tdlhc-cit-item").remove(); var b = el.corps.querySelector('[data-action="cit-ajout"]'); if (b) b.disabled = false; }
        else if (V.hooks.action) V.hooks.action(a, x);
        return;
      }
      if ((x = t.closest('a[href^="#hc="]'))) ferme();
    });
    el.volet.addEventListener("input", function(e){ if (e.target.hasAttribute("data-k")) majCompteur(e.target); });
    el.volet.addEventListener("change", function(e){ if (e.target.hasAttribute("data-k")) synchroniser(); });
  }

  /* ===================== INIT ===================== */
  function poserBouton(n){
    var slot = A.slot("d");
    if (!slot) { if ((n||0) < 80) setTimeout(function(){ poserBouton((n||0)+1); }, 250); return; }
    slot.insertAdjacentHTML("beforeend", '<button class="tdlhc-btn" type="button" data-soumettre=""><i class="fi fi-tr-envelope-plus"></i> '
      + esc(TXT.BOUTON) + ' <span class="tdlhc-pastille" data-zone="pastille" hidden></span></button>');
    if (V.hooks.pret) V.hooks.pret();
  }
  function demarrer(){
    var C = window.Courier; A = C.api;
    V = C.volet = { CFG:CFG, TYPES:TYPES, TXT:TXT, hooks:{},
                    ouvre:ouvre, ferme:ferme, alerte:alerte, etapeLibre:etapeLibre, etapeChoix:etapeChoix,
                    corps:function(){ return el.corps; }, pastille:function(){ return A.slot("d") && A.slot("d").querySelector('[data-zone="pastille"]'); } };
    A.soumettre = function(type){ ouvre(type || null); };
    if (document.body) { construire(); brancher(); }
    else document.addEventListener("DOMContentLoaded", function(){ construire(); brancher(); });
    poserBouton();
  }
  (function attendre(n){
    if (window.Courier && window.Courier.api) { demarrer(); return; }
    if ((n||0) < 60) setTimeout(function(){ attendre((n||0)+1); }, 250);
  })();
})();
