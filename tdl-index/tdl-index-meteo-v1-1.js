/*
 * tdl-index-meteo.js — Météo & marées de Houma · The Drowned Lands
 *
 * CE QUE CE FICHIER FAIT
 *   · interroge Open-Meteo pour les AGRÉGATS DU JOUR (maxi, mini, code WMO,
 *     vent dominant, probabilité de pluie, point de rosée) ;
 *   · interroge NOAA CO-OPS pour les marées prévues de PORT FOURCHON ;
 *   · en déduit un état de l'eau, que le staff peut forcer ;
 *   · dessine la carte, teinte comprise, et le profil de marée du jour.
 *
 * POURQUOI DU JOURNALIER ET PAS DE L'INSTANTANÉ
 *   Une température et une marée « en ce moment » obligent le lecteur à se
 *   demander : en ce moment pour qui ? Un joueur à Montréal, un autre à Nice.
 *   Les valeurs du jour ne bougent pas, ne demandent aucune conversion, et
 *   toutes les heures affichées sont celles de HOUMA, annoncées comme telles
 *   sur la carte. C'est l'horloge de la paroisse, pas celle du lecteur.
 *
 * POURQUOI AUCUNE CHAÎNE NOAA NE PASSE PAR new Date()
 *   NOAA renvoie « 2026-10-11 23:37 » : une espace, pas de fuseau. Le
 *   navigateur l'interpréterait dans le fuseau du LECTEUR — 23 h 37 à Paris
 *   au lieu de 23 h 37 à Houma, sept heures d'écart. Ce format n'est en outre
 *   pas de l'ISO 8601 et Safari y a longtemps répondu Invalid Date. On
 *   découpe à l'expression régulière et on affiche tel quel.
 *
 * STATION : Port Fourchon, 8762075. Cocodrie (8762928) ne sert plus que des
 * prédictions calculées depuis la fermeture de sa station, et aucune
 * observation. Port Fourchon est sur la CÔTE OUVERTE : dans Bayou Terrebonne,
 * l'eau arrive plus tard et amortie. D'où le libellé « Marée · côte ».
 *
 * CACHE : les agrégats du jour et les prédictions de marée ne bougent plus une
 * fois publiés. Un appel par API et par jour, la bascule se faisant sur la
 * DATE À HOUMA — un joueur japonais ne déclenche pas un rechargement parce
 * qu'il a passé minuit chez lui.
 *
 * PRÉREQUIS : tdl-index-core.js chargé AVANT.
 *
 * CARTE DES BLOCS : CONFIG · TABLES · UTILS · EAU · RÉSEAU · CACHE
 *                   MARÉE · RENDU · INIT
 */

window.TDLI = window.TDLI || {};
(function (NS) {
  "use strict";
  if (NS._meteo) return;
  NS._meteo = true;

  /* === CONFIG === */
  var CFG = {
    LAT: 29.5958, LON: -90.7195,          // Houma
    STATION: "8762075",                   // Port Fourchon
    /* Station de repli. Cocodrie n'a plus d'observations depuis sa fermeture,
       mais ses PRÉDICTIONS restent calculées et servies — et elle est au bout
       du Houma Navigation Canal, donc bien plus proche des bayous de
       Terrebonne que Port Fourchon, qui est en pleine côte. */
    STATION_SECOURS: "8762928",           // Cocodrie
    TZ: "America/Chicago",
    /* v2 : la fenêtre des marées est passée à deux jours. Changer la clé
       jette les relevés d'une seule journée, qu'un cache encore frais
       servirait sinon jusqu'au lendemain. */
    CLE_CACHE: "tdli-meteo-v2",
    TTL_METEO: 2 * 3600 * 1000,           // 2 h
    NOEUD_ETAT: "accueil/meteo_etat"      // surcharge staff
  };

  var URL_METEO = "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + CFG.LAT + "&longitude=" + CFG.LON +
    "&daily=temperature_2m_max,temperature_2m_min,weather_code," +
    "wind_speed_10m_max,wind_direction_10m_dominant," +
    "precipitation_probability_max,precipitation_sum,dew_point_2m_mean" +
    "&forecast_days=1&timezone=" + encodeURIComponent(CFG.TZ);

  /* Dates explicites plutôt que date=today : « today » est le jour du SERVEUR
     NOAA, pas celui de Houma, et les deux divergent une partie de la soirée.
     FENÊTRE DE DEUX JOURS, et c'est nécessaire : le cycle diurne dure 24 h 50,
     il dérive donc de cinquante minutes par jour et fait régulièrement tomber
     l'une des deux étales hors de la journée civile. Le 15 octobre 2026, Port
     Fourchon ne renvoie qu'une basse mer à 11 h 41 et aucune pleine. En
     demandant le lendemain, on peut compléter la paire manquante. */
  function urlMaree(station, debut, fin) {
    function fmt(j) { return String(j || "").replace(/-/g, ""); }
    return "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
      "?product=predictions&interval=hilo&datum=MLLW&station=" + station +
      "&begin_date=" + fmt(debut) + "&end_date=" + fmt(fin) +
      "&time_zone=lst_ldt&units=metric&format=json&application=TDL";
  }
  /* « 2026-10-15 » → « 2026-10-16 ». Date nue traitée en UTC : aucun fuseau
     n'intervient, donc aucun décalage possible. */
  function jourSuivant(j) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(j || ""));
    if (!p) return j;
    var d = new Date(Date.UTC(+p[1], +p[2] - 1, +p[3] + 1));
    return d.toISOString().slice(0, 10);
  }

  /* === TABLES === */

  /* Codes WMO → libellé, icône, famille de teinte.
     fam : clair | voile | pluie | orage | neige */
  var WMO = {
    0:  ["Ciel dégagé",            "fi-tr-sun",                  "clair"],
    1:  ["Plutôt dégagé",          "fi-tr-clouds-sun",           "clair"],
    2:  ["Partiellement nuageux",  "fi-tr-clouds-sun",           "voile"],
    3:  ["Ciel couvert",           "fi-tr-clouds",               "voile"],
    45: ["Brouillard",             "fi-tr-fog",                  "voile"],
    48: ["Brouillard givrant",     "fi-tr-fog",                  "voile"],
    51: ["Bruine légère",          "fi-tr-cloud-drizzle",        "pluie"],
    53: ["Bruine",                 "fi-tr-cloud-drizzle",        "pluie"],
    55: ["Bruine dense",           "fi-tr-cloud-drizzle",        "pluie"],
    56: ["Bruine verglaçante",     "fi-tr-cloud-sleet",          "pluie"],
    57: ["Bruine verglaçante",     "fi-tr-cloud-sleet",          "pluie"],
    61: ["Pluie faible",           "fi-tr-cloud-rain",           "pluie"],
    63: ["Pluie",                  "fi-tr-cloud-rain",           "pluie"],
    65: ["Pluie soutenue",         "fi-tr-cloud-showers-heavy",  "pluie"],
    66: ["Pluie verglaçante",      "fi-tr-cloud-sleet",          "pluie"],
    67: ["Pluie verglaçante",      "fi-tr-cloud-sleet",          "pluie"],
    71: ["Neige faible",           "fi-tr-cloud-snow",           "neige"],
    73: ["Neige",                  "fi-tr-cloud-snow",           "neige"],
    75: ["Neige abondante",        "fi-tr-cloud-snow",           "neige"],
    77: ["Grains de neige",        "fi-tr-snowflake",            "neige"],
    80: ["Averses éparses",        "fi-tr-cloud-showers",        "pluie"],
    81: ["Averses",                "fi-tr-cloud-showers",        "pluie"],
    82: ["Averses violentes",      "fi-tr-cloud-showers-heavy",  "orage"],
    85: ["Averses de neige",       "fi-tr-cloud-snow",           "neige"],
    86: ["Averses de neige",       "fi-tr-cloud-snow",           "neige"],
    95: ["Orage",                  "fi-tr-thunderstorm",         "orage"],
    96: ["Orage avec grêle",       "fi-tr-cloud-hail",           "orage"],
    99: ["Orage avec grêle",       "fi-tr-cloud-hail",           "orage"]
  };

  var TEINTE = {
    clair: "rgba(200,165,99,.3)",
    voile: "rgba(120,124,132,.26)",
    pluie: "rgba(88,117,166,.3)",
    orage: "rgba(135,94,173,.28)",
    neige: "rgba(188,177,170,.3)"
  };

  var ROSE = ["Nord", "Nord-est", "Est", "Sud-est", "Sud", "Sud-ouest", "Ouest", "Nord-ouest"];

  /* Quatre paliers d'état de l'eau. --tdli-eau porte la couleur. */
  var EAU = [
    { lib: "Niveau normal",                    ic: "fi-tr-water",      col: "var(--gr2-color)" },
    { lib: "Eau haute · vigilance",            ic: "fi-tr-water-rise", col: "var(--gr1-color)" },
    { lib: "Inondation · routes basses coupées", ic: "fi-tr-flooding", col: "var(--gr6-color)" },
    { lib: "Ouragan · onde de tempête",        ic: "fi-tr-hurricane",  col: "var(--dark2)" }
  ];

  var T = {
    SEC:    "Pas de pluie attendue",
    RISQUE: "Risque d'averse",
    PROB:   "Averses probables",
    FORTE:  "Pluie soutenue attendue",
    VENT:   "Vent",
    MAREE:  "Marée · côte",
    BASSE:  "Basse",
    PLEINE: "Pleine",
    NOTE:   "heures de Houma",
    DEMAIN: "(demain)",
    MINI:   "mini",
    AIR:    "Air",
    INDISPO: "Relevé indisponible"
  };

  var esc = NS.esc, jrn = NS.jrn;

  /* === UTILS === */

  function cardinal(deg) {
    if (deg == null || isNaN(deg)) return "";
    return ROSE[Math.round((((+deg % 360) + 360) % 360) / 45) % 8];
  }

  /* Qualifie l'air par le POINT DE ROSÉE et non par l'humidité relative : à
     humidité égale, 84 % à 7 h et 84 % à 15 h ne décrivent pas le même air,
     parce que l'humidité relative chute quand la température monte. Le point
     de rosée, lui, suit la sensation réelle. Échelle de confort usuelle. */
  function air(td) {
    if (td == null || isNaN(td)) return "";
    if (td < 10) return "sec";
    if (td < 15) return "doux";
    if (td < 18) return "humide";
    if (td < 21) return "lourd";
    if (td < 24) return "moite";
    return "étouffant";
  }

  function alerte(prob, mm) {
    prob = +prob || 0; mm = +mm || 0;
    if (prob >= 70 && mm >= 20) return T.FORTE + " · " + Math.round(mm) + " mm";
    if (prob >= 50) return T.PROB + " · " + prob + " %";
    if (prob >= 20) return T.RISQUE + " · " + prob + " %";
    return T.SEC;
  }

  /* === EAU ===
     NOAA ne sert aucune observation à Port Fourchon : l'état de l'eau ne peut
     pas être mesuré, il est déduit. Règle volontairement grossière — à
     Terrebonne, c'est le vent de secteur sud qui pousse l'eau dans les bayous,
     bien plus que la pluie. Le staff garde le dernier mot : accueil/meteo_etat
     l'emporte sur tout calcul, pour qu'un ouragan RP ne dépende pas de la
     météo réelle en Louisiane. */
  function niveauEau(vent, dir, mm) {
    vent = +vent || 0; mm = +mm || 0;
    var sud = (dir != null && dir >= 112 && dir <= 248);
    if (vent >= 118) return 3;                       // seuil ouragan catégorie 1
    if (mm >= 60 || (sud && vent >= 60)) return 2;
    if (mm >= 25 || (sud && vent >= 40)) return 1;
    return 0;
  }

  /* === RÉSEAU === */

  /* NOAA répond HTTP 200 avec un objet { error: { message } } quand la station
     ne sert pas le produit demandé : sans ce test, l'échec serait silencieux et
     la carte afficherait un tiret sans la moindre trace en console. */
  function recuperer(url, nom) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      if (j && j.error) throw new Error(j.error.message || "réponse en erreur");
      return j;
    }).catch(function (e) {
      jrn(nom + " : " + e.message);
      return null;
    });
  }

  /* Station principale, puis repli. Une marée approximative vaut mieux qu'un
     tiret : les deux stations sont sur la même côte, à quelques dizaines de
     minutes d'écart. */
  function recupererMaree(jour) {
    var fin = jourSuivant(jour);
    return recuperer(urlMaree(CFG.STATION, jour, fin), "NOAA " + CFG.STATION)
      .then(function (j) {
        if (j && j.predictions && j.predictions.length) return j;
        jrn("repli sur la station " + CFG.STATION_SECOURS + ".");
        return recuperer(urlMaree(CFG.STATION_SECOURS, jour, fin), "NOAA " + CFG.STATION_SECOURS);
      });
  }

  /* === CACHE ===
     Clé unique, bascule sur la date de Houma. localStorage peut lever en
     navigation privée ou si le quota est plein : tout est sous try/catch et
     l'absence de cache ne fait que recharger. */
  function lireCache() {
    try { return JSON.parse(localStorage.getItem(CFG.CLE_CACHE) || "null"); }
    catch (e) { return null; }
  }
  function ecrireCache(o) {
    try { localStorage.setItem(CFG.CLE_CACHE, JSON.stringify(o)); } catch (e) { /* sans effet */ }
  }

  function charger(jour) {
    var c = lireCache() || {};
    var fraisMeteo = c.jour === jour && c.meteo && (Date.now() - (c.ts || 0) < CFG.TTL_METEO);
    var fraisMaree = c.jour === jour && c.marees;

    var pM = fraisMeteo ? Promise.resolve(c.meteo) : recuperer(URL_METEO, "Open-Meteo");
    var pT = fraisMaree ? Promise.resolve(c.marees) : recupererMaree(jour);

    return Promise.all([pM, pT]).then(function (r) {
      var o = {
        jour: jour,
        ts: fraisMeteo ? (c.ts || Date.now()) : Date.now(),
        meteo:  r[0] || (fraisMeteo ? c.meteo : null),
        marees: r[1] || (fraisMaree ? c.marees : null)
      };
      if (o.meteo || o.marees) ecrireCache(o);
      return o;
    });
  }

  /* === MARÉE === */

  /* « 2026-10-11 23:37 » → { jour, hm:"23 h 37", min:1417 }. Jamais de new Date :
     cette chaîne n'est pas de l'ISO 8601 et serait lue dans le fuseau du
     LECTEUR, pas dans celui de Houma. */
  function heureNOAA(t) {
    var m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(String(t || ""));
    if (!m) return null;
    return { jour: m[1], hm: m[2] + " h " + m[3], min: (+m[2]) * 60 + (+m[3]) };
  }

  /* Port Fourchon est en régime mixte : la plupart des jours une seule basse
     et une seule pleine mer, mais certaines quadratures en donnent deux de
     chaque. On retient les deux extrêmes principaux — la plus basse et la plus
     haute — et on liste l'ensemble au survol. */
  function extraireMarees(json, jour) {
    var liste = (json && json.predictions) || [];
    var duJour = { H: null, L: null }, duLendemain = { H: null, L: null }, tout = [];
    liste.forEach(function (p) {
      var h = heureNOAA(p.t), v = parseFloat(p.v);
      if (!h || isNaN(v) || (p.type !== "H" && p.type !== "L")) return;
      var aujourdhui = (h.jour === jour);
      if (aujourdhui) {
        tout.push((p.type === "H" ? T.PLEINE : T.BASSE) + " " + h.hm + " · " + v.toFixed(2) + " m");
      }
      var cible = aujourdhui ? duJour : duLendemain;
      var cur = cible[p.type];
      // l'extrême le plus marqué du jour : la plus haute pleine, la plus basse basse
      if (!cur || (p.type === "H" ? v > cur.v : v < cur.v)) {
        cible[p.type] = { h: h, v: v, demain: !aujourdhui };
      }
    });
    /* Le cycle diurne dérivant de 50 min par jour, une étale tombe
       régulièrement hors de la journée civile. On la prend alors au lendemain
       plutôt que de n'afficher aucune marée : le joueur a besoin de l'heure,
       pas d'une leçon sur les bornes de minuit. */
    function choisir(t) {
      if (duJour[t]) return duJour[t];
      if (duLendemain[t]) { tout.push("\u2192 " + (t === "H" ? T.PLEINE : T.BASSE) +
        " " + duLendemain[t].h.hm + " le lendemain"); return duLendemain[t]; }
      return null;
    }
    return { bas: choisir("L"), haut: choisir("H"), tout: tout };
  }

  /* Profil du jour tracé à partir des deux horaires réels : sinusoïde de
     période 2 × (pleine − basse) calée sur la basse mer, sur un axe de 24 h.
     On lit ainsi d'un coup d'œil si l'étale tombe le matin ou le soir ; une
     courbe générique ne correspondrait à aucune journée. */
  function courbe(tb, th) {
    if (tb == null || th == null || tb === th) return "";
    var P = 2 * Math.abs(th - tb), d = [], x, niv;
    for (x = 0; x <= 1440; x += 30) {
      niv = 0.5 - 0.5 * Math.cos(2 * Math.PI * (x - tb) / P);   // 0 basse, 1 pleine
      d.push((x ? "L" : "M") + ((x / 1440) * 104).toFixed(1) + " " + (20 - niv * 16).toFixed(1));
    }
    /* Un repère au-delà de minuit sort du cadre : on ne le dessine pas, la
       courbe suffit à montrer que l'étale tombe après la fin du graphique. */
    function pt(t, y, cl) {
      if (t < 0 || t > 1440) return "";
      return '<circle' + (cl ? ' class="' + cl + '"' : "") +
             ' cx="' + ((t / 1440) * 104).toFixed(1) + '" cy="' + y + '" r="2.6"/>';
    }
    return '<svg class="tdli-met-maree" viewBox="0 0 104 24" aria-hidden="true">' +
           '<path d="' + d.join(" ") + '"/>' +
           pt(tb, 20, "tdli-maree-bas") + pt(th, 4, "") + "</svg>";
  }

  /* === RENDU === */

  function rendre(meteo, marees, forcage, jour) {
    var hote = NS.el("#tdli-met-corps"), carte = NS.el("#tdli-met");
    if (!hote) return;

    var d = (meteo && meteo.daily) || null;
    var code = d ? +d.weather_code[0] : null;
    var w = WMO[code] || ["", "fi-tr-clouds", "voile"];
    var tmax = d ? Math.round(d.temperature_2m_max[0]) : null;
    var tmin = d ? Math.round(d.temperature_2m_min[0]) : null;
    var vent = d ? Math.round(d.wind_speed_10m_max[0]) : null;
    var dir  = d ? d.wind_direction_10m_dominant[0] : null;
    var mm   = d ? d.precipitation_sum[0] : null;
    var prob = d ? d.precipitation_probability_max[0] : null;
    var rosee = d ? d.dew_point_2m_mean[0] : null;

    if (carte) carte.style.setProperty("--tdli-ciel", TEINTE[w[2]]);

    var niv = (forcage && forcage.niveau != null)
      ? Math.max(0, Math.min(3, +forcage.niveau))
      : niveauEau(vent, dir, mm);
    var e = EAU[niv];
    var libEau = (forcage && forcage.texte) ? forcage.texte : e.lib;

    var h = '<div class="tdli-met-bloc">' +
            '<div class="tdli-met-ligne">' +
              '<i class="fi ' + w[1] + ' tdli-met-ico" aria-hidden="true"></i>' +
              '<span class="tdli-met-temp">' +
                (tmax == null ? "—" : tmax + "&nbsp;°C") + "</span>" +
              (tmin == null ? "" : '<span class="tdli-met-mini">' + T.MINI + " " +
                                   tmin + "&nbsp;°C</span>") +
            "</div>" +
            '<div class="tdli-met-ciel">' + esc(d ? w[0] : T.INDISPO) + "</div>" +
            (air(rosee) ? '<div class="tdli-met-air">' + T.AIR + " " + air(rosee) + "</div>" : "") +
            (d ? '<div class="tdli-met-alerte">' + esc(alerte(prob, mm)) + "</div>" : "") +
            '<div class="tdli-met-eau" style="--tdli-eau:' + e.col + '">' +
              '<i class="fi ' + e.ic + '"></i>' + esc(libEau) + "</div>" +
            "</div>";

    var m = extraireMarees(marees, jour);
    h += '<div class="tdli-met-stats">';
    if (vent != null) {
      h += '<div><div class="tdli-met-cle">' + T.VENT + "</div>" +
           '<div class="tdli-met-val">' + esc(cardinal(dir)) +
           (cardinal(dir) ? " · " : "") + vent + " km/h</div></div>";
    }
    h += '<div><div class="tdli-met-cle">' + T.MAREE + "</div>";
    if (m.bas || m.haut) {
      var bulle = esc(m.tout.join("\n"));
      function ligne(e, lib) {
        if (!e) return "";
        return '<span class="tdli-met-heure" title="' + bulle + '"><b>' + lib + "</b>" +
               e.h.hm + (e.demain ? '<span class="tdli-met-dem">' + T.DEMAIN + "</span>" : "") +
               "</span>";
      }
      // une étale au lendemain se place au-delà de 1440 : la courbe reste juste
      var tb = m.bas ? m.bas.h.min + (m.bas.demain ? 1440 : 0) : null;
      var th = m.haut ? m.haut.h.min + (m.haut.demain ? 1440 : 0) : null;
      h += ligne(m.bas, T.BASSE) + ligne(m.haut, T.PLEINE) +
           courbe(tb, th) +
           '<div class="tdli-met-note">' + T.NOTE + "</div>";
    } else {
      h += '<div class="tdli-met-val">—</div>';
    }
    h += "</div></div>";

    hote.innerHTML = h;
  }

  /* === INIT === */

  var monte = false;

  function init() {
    if (monte) return;
    monte = true;
    if (!NS.el("#tdli-met-corps")) return;

    var jour = NS.maintenantHouma().jour;

    // La vitrine est déjà lue par le core : on ne rouvre pas de requête.
    var pEtat = NS.lireVitrine().then(function (rec) {
      return (rec && rec.meteo_etat) || null;
    }).catch(function () { return null; });

    Promise.all([charger(jour), pEtat]).then(function (r) {
      rendre(r[0].meteo, r[0].marees, r[1], jour);
    });
  }

  NS.initMeteo = init;
  NS.pret(function () { setTimeout(init, 0); });
})(window.TDLI);
