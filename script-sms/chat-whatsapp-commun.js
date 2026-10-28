/* ============================================================
   chat-whatsapp.js — v11 · FICHIER 1/3 : COMMUN
   Config, textes, utilitaires, catalogue d'émojis, palette.

   CHARGEMENT (ordre strict) :
     1. chat-whatsapp-v11-1-commun.js
     2. chat-whatsapp-v11-2-envoi.js
     3. chat-whatsapp-v11-3-rendu.js
   Les trois fichiers partagent le namespace window.CW11.

   - Ne touche à RIEN hors de CONFIG.FORUM_SLUG (garanti par le
     fichier 3, seul à déclencher l'application).
   - Catalogue curaté (~430 émojis, aucun codepoint non assigné),
     nommé en français, thématique Louisiane : bayou, cajun,
     southern gothic, hors-la-loi, jazz, tempêtes, politique.
   ============================================================ */
(function () {
  "use strict";

  var CW = window.CW11 = window.CW11 || {};

  /* ===== CONFIG ===== */
  var CONFIG = CW.CONFIG = {
    FORUM_SLUG:    "f2-whatsapp",   // [MAJ] segment du lien forum dans .sub-header-path
    POLL_INTERVAL: 400,
    POLL_MAX:      25,
    LS_PREFIX:     "tdlChatAuteur_",
    LS_DRAFT:      "tdlChatBrouillon_",
    LS_RECENTS:    "tdlChatEmoRecents",
    RECENTS_MAX:   24
  };

  /* ===== TEXTES ===== */
  var TEXTES = CW.TEXTES = {
    sousTitre:     "The Drowned Lands \u00B7 WhatsApp",
    placeholder:   "Message",
    errEnvoi:      "Envoi refus\u00E9 (flood ? jeton p\u00E9rim\u00E9 ?). Message restaur\u00E9 dans le champ.",
    errReseau:     "Erreur r\u00E9seau. Message restaur\u00E9 dans le champ.",
    videRecherche: "Aucun r\u00E9sultat"
  };

  /* ===== UTILS ===== */
  function $(sel, ctx)    { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx)  { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function estForumChat() {
    var liens = $all(".sub-header-path a.nav");
    if (!liens.length) return false;
    var dernier = liens[liens.length - 1];
    return (dernier.getAttribute("href") || "").indexOf(CONFIG.FORUM_SLUG) !== -1;
  }

  function topicId() {
    var m = location.pathname.match(/\/t(\d+)/);
    return m ? m[1] : null;
  }

  function estPage1() {
    if (/\/t\d+p[1-9]/.test(location.pathname)) return false;
    var m = location.search.match(/[?&]start=(\d+)/);
    if (m && parseInt(m[1], 10) > 0) return false;
    return true;
  }

  function urlReponse() {
    var as = $all(".sj-btn-new a");
    for (var i = 0; i < as.length; i++) {
      var h = as[i].getAttribute("href") || "";
      if (/mode=reply/.test(h)) return h;
    }
    return "/post?t=" + topicId() + "&mode=reply";
  }

  /* "Aujourd'hui à 20:49" -> { jour:"Aujourd'hui", heure:"20:49" } */
  function decoupeDate(texte) {
    var t = (texte || "").replace(/\s+/g, " ").trim();
    var m = t.match(/(\d{1,2})\s*[:hH]\s*(\d{2})\s*$/);
    var heure = "", jour = t;
    if (m) {
      heure = (m[1].length === 1 ? "0" + m[1] : m[1]) + ":" + m[2];
      jour  = t.slice(0, m.index);
    }
    jour = jour.replace(/[\s\u00A0]*(?:\u00E0|-)[\s\u00A0]*$/i, "").trim();
    return { jour: jour, heure: heure };
  }

  function texteDate(dateEl) {
    if (!dateEl) return "";
    var spans = dateEl.querySelectorAll("span");
    return spans.length ? spans[spans.length - 1].textContent : dateEl.textContent;
  }

  /* Identifiant stable d'un post : lien d'ancre de sa date */
  function clePost(post) {
    var a = post.querySelector(".sj-post-date a[href]");
    return a ? a.getAttribute("href") : null;
  }

  function heureCourante() {
    var d = new Date();
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  /* Plage de codepoints émoji-texte (sans \p, compatible tous navigateurs) */
  function estEmoji(cp) {
    if (cp >= 0x1F000 && cp <= 0x1FAFF) return true; // plan emoji principal
    if (cp >= 0x2600  && cp <= 0x27BF)  return true; // symboles divers + dingbats
    if (cp >= 0x2300  && cp <= 0x23FF)  return true; // symboles techniques
    if (cp === 0x2B50 || cp === 0x2B55 || cp === 0x2B1B || cp === 0x2B1C) return true;
    if (cp === 0x2764 || cp === 0x2620 || cp === 0x2049 || cp === 0x203C) return true;
    if (cp === 0x00A9 || cp === 0x00AE || cp === 0x2122) return true;
    return false;
  }

  /* Message composé uniquement d'émojis (FA les rend en <img class="emojione">) */
  function infoEmoji(contenu) {
    if (!contenu) return { seul: false, n: 0 };
    var c = contenu.cloneNode(true);
    var jeter = c.querySelectorAll(".post-wordcount, blockquote, .signature_div, .sj-awards, .award_more");
    Array.prototype.forEach.call(jeter, function (el) { el.remove(); });
    var imgsEmoji = c.querySelectorAll("img.emojione");
    var nImg = imgsEmoji.length;
    Array.prototype.forEach.call(imgsEmoji, function (el) { el.remove(); });
    if (c.querySelector("img")) return { seul: false, n: nImg }; // autre image => pas un message émoji
    var reste = c.textContent.replace(/\s/g, "");
    var nTexte = 0;
    for (var i = 0; i < reste.length; ) {
      var cp = reste.codePointAt(i);
      i += (cp > 0xFFFF ? 2 : 1);
      if (cp === 0x200D || cp === 0xFE0F || cp === 0xFE0E || cp === 0x20E3 ||
          (cp >= 0x1F3FB && cp <= 0x1F3FF) || (cp >= 0x1F1E6 && cp <= 0x1F1FF)) continue;
      if (estEmoji(cp)) { nTexte++; }
      else { return { seul: false, n: nImg + nTexte }; }
    }
    var n = nImg + nTexte;
    return { seul: n > 0, n: n };
  }

  /* ============================================================
     CATALOGUE D'ÉMOJIS — "émoji|nom" (le nom sert à la recherche,
     au tooltip et à l'aria-label). Source canonique complète :
     unicode.org (emoji-test.txt, "Full Emoji List").
     Tri pensé pour The Drowned Lands : Louisiane, bayou, cajun,
     southern gothic, hors-la-loi (RDR2), jazz, ouragans, et les
     questions politiques, sociales et climatiques actuelles.
     ============================================================ */
  var CATALOGUE = {
    "Sourires": [
      "😀|rire joie", "😃|grand sourire joie", "😄|sourire joie yeux", "😁|sourire radieux",
      "😆|rire yeux fermés", "😅|sueur rire chaleur", "😂|larmes de rire mdr", "🤣|rouler de rire",
      "🙂|léger sourire", "🙃|sourire renversé", "😉|clin d'oeil", "😊|sourire yeux",
      "😇|ange auréole", "🥰|amoureux coeurs", "😍|amoureux yeux", "🤩|étoiles admiration",
      "😘|bisou coeur", "😗|bisou", "😚|bisou yeux fermés", "😋|gourmand délicieux",
      "😜|clin d'oeil langue", "🤪|fou déjanté", "😝|langue yeux fermés", "🤑|argent bouche",
      "🤗|câlin", "🤭|rire main bouche", "🤫|chut silence secret", "🤔|réflexion pense",
      "🤐|bouche fermée zip", "🤨|sourcil levé", "😐|neutre", "😑|expression vide",
      "😶|sans bouche", "😏|malice sournois", "😒|déçu non amusé", "🙄|yeux au ciel",
      "😬|grimace gêne", "😌|serein soulagé", "😔|triste pensif", "😪|somnolence",
      "🤤|bave gourmand", "😴|endormi zzz", "😷|masque malade", "🤒|thermomètre fièvre",
      "🤕|bandé blessé", "🤢|nausée dégoûté", "🤮|vomi dégoût", "🥵|canicule chaleur humide",
      "🥶|froid grelottant", "🥴|étourdi ivre", "😵|étourdi tête", "🤯|tête qui explose",
      "🤠|cowboy western", "🥳|fête confettis", "😎|cool lunettes", "🤓|nerd lunettes",
      "🧐|monocle inspecteur", "😕|confus", "😟|inquiet", "🙁|bouleversé",
      "😮|étonné bouche ouverte", "😯|hébété", "😲|choqué étonné", "😳|rougit gêné",
      "🥺|yeux suppliants", "😦|front froncé", "😧|angoissé", "😨|effrayé peur",
      "😰|angoisse sueur", "😥|triste soulagement", "😢|pleure larme", "😭|pleure hurle larmes",
      "😱|horreur cri", "😖|perplexe", "😣|persévérance", "😞|abattu déçu",
      "😓|sueur déçu", "😩|fatigué épuisé", "😫|crevé las", "🥱|bâille ennui",
      "😤|vapeur triomphe", "😡|colère rage", "😠|fâché en colère", "🤬|jurons gros mots",
      "😈|diable malicieux", "👿|imp furieux", "💀|crâne mort", "☠️|tête de mort pirates poison",
      "💩|caca", "🤡|clown", "👻|fantôme hanté", "👽|extraterrestre alien",
      "🤖|robot", "🎃|citrouille halloween"
    ],
    "Gestes": [
      "👋|salut coucou au revoir", "🤚|main levée", "✋|stop pause", "🖐️|main doigts écartés",
      "🖖|vulcanien star trek", "👌|ok parfait", "🤌|pincement italien", "✌️|victoire paix",
      "🤞|doigts croisés chance", "🤟|je t'aime rock", "🤘|rock cornes", "🤙|appelle-moi",
      "👈|pointe gauche", "👉|pointe droite", "👆|pointe haut", "👇|pointe bas",
      "☝️|index levé", "👍|super pouce haut", "👎|nul pouce bas", "✊|poing levé protestation",
      "👊|poing punch", "🤛|poing gauche", "🤜|poing droit", "👏|applaudir bravo",
      "🙌|célébration hourra", "👐|mains ouvertes", "🤲|paumes vers le haut", "🤝|poignée de main accord",
      "🙏|merci prière église", "✍️|écrire main", "💅|ongles vernis", "🤳|selfie",
      "💪|force muscle", "🦾|bras mécanique", "🦵|jambe", "🦶|pied empreinte",
      "👂|oreille", "👃|nez", "👀|yeux regard", "👁️|oeil",
      "👅|langue", "👄|lèvres bouche"
    ],
    "Coeurs": [
      "❤️|coeur amour rouge", "🧡|coeur orange", "💛|coeur jaune or mardi gras", "💚|coeur vert mardi gras",
      "💜|coeur violet mardi gras", "💙|coeur bleu", "🖤|coeur noir deuil", "🤍|coeur blanc",
      "🤎|coeur marron", "💔|coeur brisé", "❣️|exclamation coeur", "💕|deux coeurs",
      "💞|coeurs tournants", "💓|coeur battant", "💗|coeur grandissant", "💖|coeur étincelant",
      "💘|coeur flèche cupidon", "💝|coeur ruban cadeau", "💯|cent parfait", "💋|bisou rouge à lèvres"
    ],
    "Animaux & Bayou": [
      "🐺|loup", "🦊|renard", "🐻|ours", "🐼|panda",
      "🐨|koala", "🐯|tigre", "🦁|lion", "🐮|vache",
      "🐷|cochon cochon de lait", "🐸|grenouille bayou marais", "🐵|singe", "🙈|singe ne voit pas",
      "🙉|singe n'entend pas", "🙊|singe ne parle pas", "🐔|poule basse-cour", "🐧|pingouin manchot",
      "🐦|oiseau moineau", "🐤|poussin", "🦆|canard colvert marais", "🦅|aigle",
      "🦉|hibou chouette hanté", "🦇|chauve-souris vampire", "🐴|cheval selle western", "🦄|licorne",
      "🐝|abeille ruche miel", "🐛|chenille ver", "🦋|papillon", "🐌|escargot",
      "🐞|coccinelle", "🐜|fourmi", "🕷️|araignée toile veuve noire", "🦂|scorpion",
      "🐍|serpent mocassin vipère", "🦎|lézard anolis", "🐢|tortue bayou", "🐊|alligator crocodile louisiane",
      "🐙|poulpe pieuvre", "🦑|calamar", "🦐|crevette bouillon", "🦀|crabe",
      "🦞|écrevisse crawfish homard", "🐡|poisson-globe", "🐠|poisson tropical", "🐟|poisson poisson-chat",
      "🐬|dauphin golfe", "🐳|baleine", "🦈|requin golfe", "🐘|éléphant",
      "🦏|rhinocéros", "🐪|chameau", "🦒|girafe", "🐑|mouton",
      "🐐|chèvre", "🦌|cerf biche chasse", "🐕|chien chasse fidèle", "🐩|caniche",
      "🐱|chat", "🐈|chat noir", "🐓|coq", "🐇|lapin garenne",
      "🐰|lapin panier", "🐭|souris", "🐹|hamster", "🦔|hérisson",
      "🐀|rat grange ville", "🕊️|colombe paix", "🦢|cygne", "🦚|paon",
      "🦜|perroquet", "🦤|dodo", "🦝|raton laveur poubelle", "🦫|castor barrage",
      "🦦|loutre rivière", "🦟|moustique maringouin", "🪰|mouche", "🪳|cafard cancrelat",
      "🦗|grillon criquet sauterelle"
    ],
    "Nature & Météo": [
      "🌑|nouvelle lune", "🌒|lune croissante", "🌔|lune gibbeuse", "🌕|pleine lune",
      "🌙|croissant de lune", "🌚|lune noire visage", "☀️|soleil canicule", "🌝|soleil visage",
      "🌤️|soleil derrière nuage", "⛅|nuage soleil", "🌥️|nuages soleil", "☁️|nuage",
      "🌦️|soleil pluie", "🌧️|pluie averse", "⛈️|orage éclair pluie tempête", "🌩️|éclair nuages",
      "⚡|éclair foudre", "🌪️|tornade twister", "🌫️|brouillard brume marais", "🌊|vague crue inondation délue",
      "💧|goutte d'eau", "💦|éclaboussures sueur", "☔|parapluie pluie", "☂️|parapluie",
      "🌈|arc-en-ciel après l'orage", "❄️|flocon neige", "☃️|bonhomme de neige", "⛄|bonhomme neige",
      "🌡️|thermomètre humidité", "🔥|feu flamme incendie", "⭐|étoile", "🌟|étoile brillante",
      "✨|étincelles", "💫|étoile filante", "🌍|globe climat", "🌎|globe amérique",
      "🌏|globe asie", "🌵|cactus", "🎄|sapin noël", "🌲|conifère",
      "🌳|chêne mousse espagnole", "🌴|palmier", "🌱|pousse germination", "🌿|herbe cyprès lianes",
      "🍀|trèfle chance", "🍁|érable automne", "🍂|feuilles mortes", "🍃|feuilles au vent",
      "🌾|épis plantation champ", "💐|bouquet fleurs", "🌸|fleur cerisier", "💮|fleur blanche",
      "🌹|rose", "🥀|fleur fanée", "🌺|hibiscus", "🌻|tournesol",
      "🌷|tulipe", "🪷|nénuphar lotus bayou", "🏝️|île marais", "🏖️|plage golfe",
      "🏕️|camping tente", "🌀|ouragan cyclone tempête"
    ],
    "Nourriture & Cajun": [
      "🍏|pomme verte", "🍎|pomme rouge", "🍐|poire", "🍊|orange mandarine",
      "🍋|citron", "🍌|banane", "🍉|pastèque", "🍇|raisin",
      "🍓|fraise", "🫐|myrtilles", "🍒|cerises", "🍑|pêche",
      "🥭|mangue", "🍍|ananas", "🥥|noix de coco", "🥝|kiwi",
      "🍅|tomate", "🍆|aubergine", "🥑|avocat", "🥦|brocoli",
      "🥕|carotte", "🌽|maïs", "🌶️|piment cajun", "🥒|concombre",
      "🥬|salade chou", "🍄|champignon", "🥜|cacahuètes", "🌰|châtaigne",
      "🧅|oignon holy trinity", "🫑|poivron trinité cajun", "🍞|pain", "🥐|croissant beignet",
      "🥖|baguette", "🥨|bretzel", "🧀|fromage", "🥚|oeuf",
      "🍳|oeufs poêle plat", "🥞|crêpes pancakes", "🥓|lardons bacon grattons", "🍗|poulet frit cuisse",
      "🍔|burger", "🍟|frites", "🍕|pizza", "🌭|hot-dog andouillette",
      "🥪|sandwich po-boy", "🌮|taco", "🌯|burrito", "🥗|salade bol",
      "🍝|pâtes spaghetti", "🍜|nouilles ramen", "🍲|gumbo marmite bouillon", "🍛|curry riz",
      "🍣|sushi", "🍤|crevette panée beignet", "🍚|bol de riz jambalaya", "🍢|brochettes",
      "🍧|glace pilée", "🍨|glace coupelle", "🍦|cornet glace", "🥧|tarte pecan",
      "🍫|chocolat", "🍩|donut beignet", "🍪|cookie", "🎂|gâteau anniversaire",
      "🍰|part de gâteau", "🧁|cupcake king cake", "🍮|flan", "🍬|bonbon",
      "🍭|sucette", "🍯|miel pot", "🍠|patate douce yam", "🥔|pomme de terre",
      "☕|café au lait", "🍵|thé vert", "🧋|bubble tea", "🥤|soda gobelet",
      "🧃|jus brique", "🍺|bière pinte", "🍻|bières trinquer", "🍷|vin rouge",
      "🍸|cocktail sazerac martini", "🍹|cocktail hurricane tropical", "🥂|trinquer champagne", "🍾|bouchon champagne",
      "🥃|whisky bourbon tumbler", "🧊|glaçon", "🥛|lait verre"
    ],
    "Objets & Hors-la-loi": [
      "📱|téléphone portable", "☎️|téléphone ancien", "📞|récepteur téléphone", "💻|ordinateur portable",
      "🖥️|ordinateur écran", "⌨️|clavier", "🖨️|imprimante", "📷|appareil photo",
      "📸|photo flash", "🎥|caméra cinéma", "🎬|clap de tournage", "🎧|écouteurs casque",
      "🎵|note de musique", "🎶|zydeco musique cajun", "🎤|micro jazz", "🎸|guitare",
      "🎹|piano bar", "🥁|tambour batterie", "🎺|trompette fanfare jazz", "🎻|violon fiddle cajun",
      "🪕|banjo", "🪗|accordéon zydeco", "🎷|saxophone nouvelle-orléans", "🎲|dé à jouer",
      "🎯|cible fléchettes", "🎳|bowling", "🎮|manette jeu vidéo", "🕹️|joystick",
      "🧩|puzzle", "🗡️|dague épée bowie", "⚔️|épées croisées duel", "🔫|revolver colt pistolet",
      "🏹|arc flèche", "🛡️|bouclier", "🪓|hache", "🔧|clé à molette",
      "🔨|marteau", "🔩|boulon vis", "⛓️|chaînes histoire", "🧲|aimant",
      "💣|bombe dynamite train", "🧨|pétard bâton dynamite", "🔑|clé", "🗝️|clé ancienne",
      "🔒|cadenas fermé", "🔓|cadenas ouvert", "🔦|lampe torche lanterne", "💡|ampoule idée",
      "🕯️|bougie veillée messe", "🧯|extincteur", "⌛|sablier", "⏳|sablier écoule",
      "⏰|réveil alarme", "⌚|montre gousset", "🕰️|horloge ancienne", "⏱️|chronomètre",
      "💸|billets qui s'envolent prime", "💵|billet dollar", "💰|sac d'or argent prime", "🪙|pièce monnaie",
      "💳|carte bancaire", "🧾|reçu facture", "⚖️|balance justice tribunal procès", "🔗|lien chaînon",
      "🧰|boîte à outils", "🧪|éprouvette potion", "💉|seringue piqûre opioïdes", "💊|pilule médicament opioïdes",
      "🩹|pansement", "🩸|goutte de sang", "🧠|cerveau", "🦴|os",
      "🧬|adn génétique", "🔭|télescope", "🔬|microscope", "🧹|balai sorcière",
      "🔮|boule de cristal voyante", "🕸️|toile d'araignée abandonné", "🏴‍☠️|drapeau pirate hors-la-loi", "🚩|drapeau rouge signal",
      "⚓|ancre", "⛵|voilier", "🚤|vedette speedboat", "🛶|pirogue canoë bayou",
      "🚢|navire bateau port", "🗺️|carte au trésor monde", "🧭|boussole", "🤿|plongée masque tuba",
      "🎣|pêche canne flotteur", "🏊|nage natation déluge", "🚣|aviron rame pirogue", "🧟|zombie",
      "🧛|vampire", "🧜|sirène triton", "🧚|fée", "🧙|mage sorcier traiteur",
      "🧞|génie", "🪦|stèle tombe pierre", "⚱️|urne funéraire", "⚰️|cercueil veillée",
      "🗿|moaï statue", "🕳️|trou puits", "🎈|ballon baudruche", "🎁|cadeau",
      "🎉|fête confettis mardi gras", "🎊|confettis ballon parade", "🎭|masques mardi gras théâtre", "🎪|chapiteau cirque",
      "🎫|ticket billet bateau", "🏆|trophée coupe", "🥇|médaille or premier", "⚽|football",
      "🏀|basket", "🎱|billard boule noire salle", "📕|livre rouge", "📖|livre ouvert",
      "📘|livre bleu bible", "✒️|plume stylo", "🖋️|stylo plume", "📝|note crayon mémo",
      "✏️|crayon papier", "📌|punaise poussez", "📎|trombone", "🗂️|dossiers classeurs",
      "📁|dossier", "📂|dossier ouvert", "📜|parchemin lettre testament", "📰|journal gazette presse",
      "🚂|train locomotive braquage", "🛤️|rails chemin de fer", "🚬|cigarette tabac", "🪶|plume amérindienne",
      "🚔|police shérif sirène", "🚓|voiture de police patrouille", "🚜|tracteur agriculture", "🛻|camionnette pickup",
      "⛪|église chapelle", "🏚️|maison hantée abandonnée", "🛖|hutte cabane", "🏥|hôpital santé",
      "🏛️|capitole congrès politique", "🗳️|urne vote élections", "📣|mégaphone manifestation", "📉|baisse crise économie",
      "📈|hausse bourse", "🛢️|pétrole forage industrie", "🏭|usine raffinerie pollution", "🥫|conserve banque alimentaire"
    ],
    "Symboles": [
      "✅|coché validé ok", "☑️|case cochée", "✔️|coche", "❌|croix erreur faux",
      "❎|croix bouton non", "⭕|cercle rouge", "🚫|interdit barré", "⚠️|attention danger tempête",
      "🔞|18 ans interdit", "‼️|double exclamation", "⁉️|interrogation exclamation", "❓|question point",
      "❗|exclamation", "❕|exclamation blanche", "💤|dodo zzz sommeil", "💢|colère symbole",
      "💥|boum explosion coup de feu", "🗨️|bulle parole gauche", "💬|bulle parole chat", "💭|bulle pensée",
      "🌀|spirale tourbillon", "♻️|recyclage", "♠️|pique poker", "♣️|trèfle carte poker",
      "♥️|coeur carte poker", "♦️|carreau carte", "🃏|joker poker saloon", "🎴|carte fleur hanafuda",
      "🔴|rond rouge", "🟠|rond orange", "🟡|rond jaune", "🟢|rond vert",
      "🔵|rond bleu", "🟣|rond violet", "⚫|rond noir", "⚪|rond blanc",
      "🟥|carré rouge", "🟧|carré orange", "🟨|carré jaune", "🟩|carré vert",
      "🟦|carré bleu", "🟪|carré violet", "🆗|ok bouton", "🆕|nouveau",
      "🔝|haut top", "🔙|retour arrière", "🔚|fin", "🔜|bientôt à suivre",
      "🕐|une heure", "🕒|trois heures", "🕔|cinq heures", "🕖|sept heures",
      "🕘|neuf heures", "🕚|onze heures", "🕛|midi minuit"
    ]
  };

  /* Table émoji -> nom (pour les récents) */
  var NOMS = (function () {
    var m = {};
    Object.keys(CATALOGUE).forEach(function (cat) {
      CATALOGUE[cat].forEach(function (e) {
        var p = e.split("|");
        if (!(p[0] in m)) m[p[0]] = p[1];
      });
    });
    return m;
  })();

  /* ===== RÉCENTS ===== */
  function lireRecents() {
    try { return JSON.parse(localStorage.getItem(CONFIG.LS_RECENTS) || "[]"); }
    catch (e) { return []; }
  }
  function toucherRecent(emo) {
    var liste = lireRecents().filter(function (e) { return e !== emo; });
    liste.unshift(emo);
    try { localStorage.setItem(CONFIG.LS_RECENTS, JSON.stringify(liste.slice(0, CONFIG.RECENTS_MAX))); } catch (e) {}
  }

  /* ===== PALETTE ===== */

  /* Insère un émoji à la position du curseur dans le champ */
  function insererEmoji(input, emoji) {
    var s = input.selectionStart || 0, e = input.selectionEnd || 0;
    var v = input.value;
    input.value = v.slice(0, s) + emoji + v.slice(e);
    var pos = s + emoji.length;
    input.selectionStart = input.selectionEnd = pos;
    input.focus();
    input.dispatchEvent(new Event("input"));
  }

  function construirePalette(bar, input) {
    var pop = $(".cw-emoji-pop", bar);
    pop.innerHTML =
      '<input class="cw-emoji-search" type="text" placeholder="Rechercher un \u00E9moji">' +
      '<div class="cw-emoji-tabs"></div>' +
      '<div class="cw-emoji-grid"></div>';

    var recherche = $(".cw-emoji-search", pop);
    var tabs      = $(".cw-emoji-tabs", pop);
    var grille    = $(".cw-emoji-grid", pop);

    var ongletActif = lireRecents().length ? "R\u00E9cents" : Object.keys(CATALOGUE)[0];
    var filtre = "";

    function construireOnglets() {
      tabs.innerHTML = "";
      var noms = lireRecents().length ? ["R\u00E9cents"].concat(Object.keys(CATALOGUE)) : Object.keys(CATALOGUE);
      var frag = document.createDocumentFragment();
      noms.forEach(function (n) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "cw-emoji-tab" + (n === ongletActif ? " cw-actif" : "");
        b.textContent = n;
        b.setAttribute("data-tab", n);
        frag.appendChild(b);
      });
      tabs.appendChild(frag);
    }

    function renduGrille() {
      var items = [];
      if (filtre) {
        var q = filtre.toLowerCase();
        Object.keys(CATALOGUE).forEach(function (cat) {
          CATALOGUE[cat].forEach(function (e) {
            var p = e.split("|");
            if (p[1].toLowerCase().indexOf(q) !== -1) items.push(p);
          });
        });
      } else if (ongletActif === "R\u00E9cents") {
        var vus = {};
        lireRecents().forEach(function (e) {
          if (!vus[e]) { vus[e] = 1; items.push([e, NOMS[e] || "\u00E9moji"]); }
        });
      } else if (CATALOGUE[ongletActif]) {
        items = CATALOGUE[ongletActif].map(function (e) { return e.split("|"); });
      }

      grille.innerHTML = "";
      var frag = document.createDocumentFragment();
      if (!items.length) {
        var vide = document.createElement("div");
        vide.className = "cw-emoji-vide";
        vide.textContent = TEXTES.videRecherche;
        grille.appendChild(vide);
        return;
      }
      items.forEach(function (p) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "cw-emoji";
        b.textContent = p[0];
        b.setAttribute("data-e", p[0]);
        b.setAttribute("aria-label", p[1]);
        b.title = p[1];
        frag.appendChild(b);
      });
      grille.appendChild(frag);
    }

    /* 1 seul listener pour toute la palette (délégation) */
    pop.addEventListener("click", function (e) {
      e.stopPropagation();
      var tab = e.target.closest(".cw-emoji-tab");
      if (tab) {
        ongletActif = tab.getAttribute("data-tab");
        filtre = "";
        recherche.value = "";
        construireOnglets();
        renduGrille();
        return;
      }
      var emo = e.target.closest(".cw-emoji");
      if (emo) {
        insererEmoji(input, emo.getAttribute("data-e"));
        toucherRecent(emo.getAttribute("data-e"));
        if (ongletActif === "R\u00E9cents") renduGrille();
      }
    });

    recherche.addEventListener("input", function () {
      filtre = recherche.value.trim();
      renduGrille();
    });
    recherche.addEventListener("keydown", function (e) {
      e.stopPropagation(); /* pas d'envoi depuis la recherche */
      if (e.key === "Escape") pop.classList.remove("cw-open");
    });

    construireOnglets();
    renduGrille();

    /* Onglets reconstruits à l'ouverture (les récents bougent) */
    var btnEmoji = $(".cw-emoji-btn", bar);
    btnEmoji.addEventListener("click", function (e) {
      e.stopPropagation();
      var ouvrir = !pop.classList.contains("cw-open");
      if (ouvrir) {
        filtre = "";
        recherche.value = "";
        if (!lireRecents().length && ongletActif === "R\u00E9cents") ongletActif = Object.keys(CATALOGUE)[0];
        construireOnglets();
        renduGrille();
      }
      pop.classList.toggle("cw-open", ouvrir);
    });
  }

  /* ===== EXPORTS ===== */
  CW.$ = $; CW.$all = $all;
  CW.estForumChat = estForumChat;
  CW.topicId = topicId;
  CW.estPage1 = estPage1;
  CW.urlReponse = urlReponse;
  CW.decoupeDate = decoupeDate;
  CW.texteDate = texteDate;
  CW.clePost = clePost;
  CW.heureCourante = heureCourante;
  CW.infoEmoji = infoEmoji;
  CW.lireRecents = lireRecents;
  CW.insererEmoji = insererEmoji;
  CW.construirePalette = construirePalette;
})();
