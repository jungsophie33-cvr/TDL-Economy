/* THE DROWNED LANDS — LA MARINA · PANNEAU DE GESTION STAFF · v1
 *
 * Structure du panneau de gestion des événements (mastic retour/titre, nav
 * d'onglets DANS la colonne gauche, liste, zone de travail, pied d'actions).
 *
 * TROIS ONGLETS
 *   Lancer au vote — fiches en attente (et en attente de co-auteur) :
 *     demander des précisions (champ de rédaction au pied), éditer la fiche
 *     en entier (options comprises), ouvrir le vote (7 jours) après contrôle
 *     du plafond des 50 % de la cagnotte nette.
 *   Clôturer — fiches en vote : voix par option, quorum, opposition par
 *     communauté. Clôture sur l'option qui l'emporte (une VRAIE option pour
 *     une inter, jamais « s'y opposer »), non tranchée, ou dé de départage
 *     en cas d'égalité (jet consigné, tiré par le staff en public).
 *     Le débit des cagnottes n'a lieu QU'ICI, par transaction (le gel
 *     d'affichage aura suffi pendant le vote — motif rep-det-main).
 *   Conséquences — fiches en jeu, clôturées ou non tranchées : fiche entière
 *     puis cases « Par toute la paroisse » + une par groupe, ajoutées par
 *     select, supprimables, enregistrées au pied.
 *
 * BASCULE EN JEU — un grand œuvre (2000 $) passe en jeu dès sa clôture avec
 * une vraie option : l'événement tdlev est créé (origine boutique, lien
 * « Fiche boutique »). Un dossier communautaire (1000 $) y passe sur
 * décision du staff, depuis l'onglet Conséquences.
 *
 * DÉPEND DE : window.Marina (marina-core), window.EcoCore.
 * EXPOSE : window.MarinaStaff.
 */
(function () {
"use strict";

var M = function(){ return window.Marina; };
function E(){ return window.EcoCore; }
function $(s,r){ return (r||document).querySelector(s); }

var SS = { stab:"vote", ssel:null, editing:false, ouvert:false };

var TXT = {
  TITRE:"Gestion Marina", RETOUR:"Retour à la marina",
  NOTE_VOTE:"Le vote ne s'ouvre que de la main du staff. Le plafond des 50 % de la cagnotte nette est revérifié au lancement.",
  NOTE_EDIT:"Le staff corrige avant l'ouverture du vote — les auteurs en sont prévenus par le résultat visible.",
  NOTE_CONSEQ:"Les conséquences se rédigent à la clôture : la paroisse d'abord, puis une case par groupe qui doit en savoir plus.",
  PRECISIONS_PH:"Ce que le staff attend des auteurs avant le vote — un point à préciser, un modèle à justifier, un responsable à nommer…",
  OK_VOTE:"Vote ouvert — scrutin de 7 jours.",
  OK_PREC:"Demande envoyée — les auteurs la liront sur leur fiche.",
  OK_EDIT:"Fiche corrigée — prête à partir au vote.",
  OK_CONSEQ:"Conséquences consignées — chaque audience lira sa part, jamais celle des autres.",
  ERR_PLAFOND:function(c, m){ return "Plafond des 50 % : la cagnotte nette de " + c + " est de " + m + " — lance un dossier moins cher, ou attends une clôture."; },
  ERR_DE:"Indique le résultat du dé (1 à 2 pour départager les options A et B, 1 à 3 avec l'option C).",
  ERR_ECRIT:"L'écriture a échoué — réessaie.",
  QUORUM:function(q, n){ return "Quorum : " + n + " voix" + (n<q?" sur " + q + " requises":" — atteint") + "."; },
  DEBITE:function(m, c){ return " " + m + " débités de la cagnotte " + c + "."; },
  ERR_FONDS:function(c){ return "La cagnotte " + c + " ne couvre pas l'engagement : corrige-la à la main avant de clôturer."; }
};

/* ===================== STRUCTURE ===================== */

function construire(){
  var p = document.createElement("div");
  p.id = "marina-staff"; p.className = "qbm-fixe"; p.hidden = true;
  p.innerHTML =
    '<header class="qbm-gmastic">'
    + '<div><button class="tdlev-txt-btn" id="qbm-staffclose" type="button"><i class="fi fi-tr-angle-left"></i><span>'+TXT.RETOUR+'</span></button></div>'
    + '<h2>'+TXT.TITRE+'</h2><div></div></header>'
    + '<div class="qbm-gcorps">'
    + '<div class="qbm-gcol">'
    + '<nav id="qbm-gnav"></nav>'
    + '<div class="qbm-gcolh"><b id="qbm-gnom"></b><span class="qbm-gn" id="qbm-gnb"></span></div>'
    + '<div class="qbm-gliste" id="qbm-gliste"></div>'
    + '</div>'
    + '<div class="qbm-gtrav">'
    + '<div class="qbm-gtravc" id="qbm-gtrav"></div>'
    + '<div class="qbm-gpied" id="qbm-gpied"></div>'
    + '</div></div>';
  document.body.appendChild(p);
  $("#qbm-staffclose").onclick = fermer;
  brancher();
}

function ouvrir(){
  if (!document.querySelector("#marina-staff")) construire();
  var p = $("#marina-staff");
  p.hidden = false;
  SS.ouvert = true;
  if (window.Quais && window.Quais.api && !window.Quais.api.staff()){ /* le toggle de la coque pilote aussi */ }
  rendrePanneau();
}
function fermer(){
  var p = $("#marina-staff");
  if (p) p.hidden = true;
  SS.ouvert = false;
}
function ouvert(){ var p = $("#marina-staff"); return !!(p && !p.hidden); }

/* ===================== LISTES ET ONGLETS ===================== */

function items(){
  return M().listeFiches().filter(function(f){
    if (SS.stab==="vote")    return f.statut==="publiee" || f.statut==="attente_co";
    if (SS.stab==="cloture") return f.statut==="en_vote";
    return f.statut!=="publiee" && f.statut!=="attente_co" && f.statut!=="en_vote";
  });
}
function staffTabs(){
  var defs = [
    { k:"vote",    icon:"fi-tr-bolt",           lab:"Lancer au vote", c:"var(--gr1-color)" },
    { k:"cloture", icon:"fi-tr-clipboard-check", lab:"Clôturer",       c:"var(--gr4-color)" },
    { k:"conseq",  icon:"fi-tr-customize-edit", lab:"Conséquences",   c:"var(--gr5-color)" }
  ];
  var nOf = function(k){
    return M().listeFiches().filter(function(f){
      return k==="vote" ? (f.statut==="publiee"||f.statut==="attente_co")
           : k==="cloture" ? f.statut==="en_vote"
           : (f.statut!=="publiee" && f.statut!=="attente_co" && f.statut!=="en_vote");
    }).length;
  };
  $("#qbm-gnav").innerHTML = '<div class="qb-bandgrid qbm-gbands">' + defs.map(function(d){
    return '<button class="qb-bandcell'+(SS.stab===d.k?" qb-on":"")+'" data-stab="'+d.k+'" style="--c:'+d.c+'" type="button">'
      + '<i class="fi '+d.icon+'"></i><span class="qb-bcell"><span>'+d.lab+'</span><em class="qbm-bn">'+nOf(d.k)+'</em></span></button>';
  }).join("") + '</div>';
}
function staffRow(f){
  var st = M().ST[f.statut];
  return '<button class="qbm-ge" aria-current="'+(SS.ssel===f.id)+'" style="--c:'+M().commuOf(f).c+'" data-sf="'+f.id+'" type="button">'
    + '<span class="qbm-ge-l1"><span class="tdlev-marq" style="background:'+st.c+'">'+st.t+'</span>'
    + '<span class="qbm-ge-t">'+M().esc(f.nom)+'</span></span>'
    + '<span class="qbm-ge-d">'+M().esc(M().commuOf(f).nom)+' · '+M().money(f.montant)+' · '+M().esc(M().ilya(f.cree))+'</span>'
    + '</button>';
}
function staffTete(f){
  var st = M().ST[f.statut];
  return '<div class="qbm-gtete">'
    + '<span class="tdlev-marq" style="background:'+st.c+'">'+st.t+'</span>'
    + '<span class="qbm-ge-d">'+M().esc(M().commuOf(f).nom)+(f.avec?' · × '+M().esc(M().COMMU[f.avec].nom):'')+' · déposée '+M().esc(M().ilya(f.cree))+'</span>'
    + (M().joursRestants(new Date(f.cree).getTime()+7*86400000)<0 && f.statut==="publiee" ? '<span class="tdlev-tag qbm-ej-tag">> 1 semaine sans revue</span>' : '')
    + '<h3>'+M().esc(f.nom)+'</h3></div>';
}

function dossier(f){
  var m = M(), v = m.voixDe(f);
  return '<div class="tdlev-elem">'
    + m.elem("fi-tr-dollar","Montant", m.money(f.montant)+(f.avec?" · 1 000 / 1 000":""))
    + m.elem("fi-tr-bolt","Vote", voteInfo(f))
    + m.elem("fi-sr-hand-present","Bénéficiaires", f.benef||"—")
    + '</div>'
    + (f.precisions ? '<div class="qb-asbox" style="margin-top:16px"><span class="qb-lab">Précisions demandées</span><p>'+m.esc(f.precisions)+'</p></div>' : "")
    + m.pave("fi-tr-house-flood","Contexte",'<p class="tdlev-f-p">'+m.esc(f.probleme||"")+'</p>')
    + '<div class="qbm-pavgrid" style="margin-top:16px">'
    + m.pave("fi-tr-bullseye","Objectifs",'<ul class="tdlev-obj"><li>'+m.esc(f.objectif||"")+'</li></ul>')
    + m.pave("fi-tr-diamond-exclamation","Risques",'<p class="tdlev-f-p">'+m.esc(f.risque||"")+'</p>')
    + '</div>'
    + '<p class="qb-lab" style="margin:20px 0 8px">Les options — trois au maximum</p>'
    + '<div class="tdlev-opts">' + Object.keys(f.options).sort().map(function(k){
        return '<div class="tdlev-opt qbm-opt" style="--c:'+m.commuOf(f).c+'">'
          + '<i class="fi fi-tr-box"></i>'
          + '<span class="qbm-opttxt"><span class="tdlev-opt-n">Option '+k+' — '+m.esc(f.options[k].t)+'</span>'
          + '<span class="tdlev-opt-d">'+m.esc(f.options[k].d||"")+'</span></span>'
          + '<span class="qbm-optright"><span class="tdlev-opt-p">'+(v[k]||0)+' voix</span></span>'
          + '</div>';
      }).join("") + '</div>';
}
function voteInfo(f){
  var j = M().joursRestants(f.fin);
  if (f.statut==="en_vote")   return "ouvert"+(j!=null && j>=0?" — clos dans "+j+" jours":"");
  if (f.statut==="attente_co") return "en attente du co-auteur";
  if (f.statut==="publiee")    return "ouvre après revue du staff";
  if (f.statut==="en_jeu")     return "résolu — fonds engagés";
  return "clos";
}

/* ===================== ÉDITION AVANT VOTE ===================== */

function escAttr(s){ return M().esc(s||""); }

function editForm(f){
  var inp = function(lab,k,val){ return '<div class="tdlhc-champ"><label>'+lab+'</label><input type="text" data-ed="'+k+'" value="'+escAttr(val)+'"></div>'; };
  var ta  = function(lab,k,val){ return '<div class="tdlhc-champ"><label>'+lab+'</label><textarea data-ed="'+k+'">'+escAttr(val)+'</textarea></div>'; };
  var h = '<p class="qb-lab" style="margin:0 0 12px">Édition de la fiche — avant l\'ouverture du vote</p>'
    + '<div class="qbm-edgrid">'
    + inp("Nom de l'initiative","nom", f.nom)
    + ta("Contexte","probleme", f.probleme)
    + ta("Objectif","objectif", f.objectif)
    + inp("Bénéficiaires","benef", f.benef)
    + ta("Risques","risque", f.risque)
    + ta("Conflit d'intérêts","conflit", f.conflit)
    + ta("Abandon","abandon", f.abandon)
    + inp("Image du hero (URL)","img", f.img)
    + '</div>'
    + '<p class="qb-lab" style="margin:20px 0 12px">Les options soumises au vote</p>'
    + '<div class="qbm-edgrid">'
    + Object.keys(f.options).sort().map(function(k){
        return '<div class="qbm-edopt">'
          + '<div class="tdlhc-champ"><label>Option '+k+' — titre</label><input type="text" data-ed="opt'+k+'t" value="'+escAttr(f.options[k].t)+'"></div>'
          + '<div class="tdlhc-champ"><label>Option '+k+' — concept <span>— ce que les membres liront avant de voter</span></label><textarea data-ed="opt'+k+'d">'+escAttr(f.options[k].d)+'</textarea></div>'
          + '</div>';
      }).join("")
    + '</div>';
  return h;
}

function conseqForm(f){
  var m = M(), cq = f.conseq || {};
  var nomG = function(k){ return k==="paroisse" ? "Par toute la paroisse" : (k===m.BANDES_KEY ? "Bandes hors la loi" : (m.COMMU[k] ? m.COMMU[k].nom : k)); };
  var box = function(k){
    return '<div class="tdlhc-champ"><label>'+m.esc(nomG(k))
      + (k!=="paroisse" ? ' <button class="tdlhc-lien" data-cqdel="'+m.esc(k)+'" type="button">retirer</button>' : "")
      + '</label><textarea data-cq="'+m.esc(k)+'">'+escAttr(cq[k])+'</textarea></div>';
  };
  var h = dossier(f)
    + '<p class="qb-lab" style="margin:24px 0 8px">Conséquences connues — qui sait quoi, à la clôture</p>'
    + '<div class="qbm-edgrid">' + box("paroisse");
  Object.keys(cq).forEach(function(k){ if (k!=="paroisse") h += box(k); });
  h += '</div>';
  var deja = Object.keys(cq);
  var opts = "";
  Object.keys(m.COMMU).forEach(function(k){ if (deja.indexOf(k)<0) opts += '<option value="'+m.esc(k)+'">'+m.esc(m.COMMU[k].nom)+'</option>'; });
  if (deja.indexOf(m.BANDES_KEY)<0) opts += '<option value="'+m.esc(m.BANDES_KEY)+'">Bandes hors la loi</option>';
  h += opts
    ? '<div class="qbm-cqadd"><select id="qbm-cqsel">'+opts+'</select>'
      + '<button class="tdlev-btn est-second" data-gact="qadd" type="button">Ajouter une case</button></div>'
    : '<p class="qbm-note" style="margin-top:14px">Tous les groupes ont déjà leur case de conséquences.</p>';
  /* passage en jeu d'un dossier communautaire : décision staff */
  if (f.statut==="cloturee" && f.type==="dossier" && !f.event){
    h += '<div class="qb-asbox" style="margin-top:18px"><span class="qb-lab">Passage en jeu</span>'
      + '<p>Ce dossier a été clôturé sur une option. Son passage « en jeu » crée l\'événement tdlev — décision staff.</p>'
      + '<div style="margin-top:10px"><button class="tdlev-btn" data-gact="enjeu" type="button">Passer en jeu — créer l\'évent</button></div></div>';
  }
  return h;
}

/* ===================== CLÔTURE ===================== */

function clotureForm(f){
  var m = M(), v = m.voixDe(f), opp = m.oppositionDe(f);
  var q = m.quorumDe(f);
  var h = staffTete(f) + dossier(f);
  h += '<div class="qb-asbox" style="margin-top:16px"><span class="qb-lab">Décompte</span><p>'
    + m.esc(TXT.QUORUM(q, v.tot));
  if (f.avec){
    Object.keys(opp).forEach(function(k){
      var eff = m.effDe(k);
      h += '<br>' + m.esc(m.COMMU[k].nom) + ' : ' + opp[k] + ' opposition' + (opp[k]>1?"s":"")
        + ' sur ' + eff + ' membres' + (opp[k] > Math.floor(eff/2) ? ' — MAJORITÉ, le lancement est bloqué.' : '.');
    });
  }
  h += '</p></div>';
  var boutons = Object.keys(f.options).sort().map(function(k){
    return '<button class="tdlev-btn est-second" data-cloture="'+k+'" type="button">Clôturer — l\'option '+k+' l\'emporte ('+(v[k]||0)+' voix)</button>';
  }).join("");
  h += '<p class="qb-lab" style="margin:18px 0 8px">Issue du vote</p>'
    + '<div style="display:flex;flex-wrap:wrap;gap:10px">'
    + boutons
    + '<button class="tdlev-btn est-second" data-gact="nontranchee" type="button">Non tranchée</button>'
    + '</div>'
    + '<div class="qbm-cqadd"><input type="number" id="qbm-de" min="1" max="'+Object.keys(f.options).length+'" placeholder="Dé de départage — résultat"'
    + ' style="flex:0 1 240px"><button class="tdlev-btn est-second" data-gact="de" type="button">Consigner le dé (égalité)</button></div>'
    + '<p class="qbm-note" style="margin-top:12px">En cas d\'égalité, le dé est tiré en public : 1 = première option, et ainsi de suite. Une inter ne se clôture que sur une vraie option — « s\'y opposer » ne finance rien.</p>';
  return h;
}

/* ===================== RENDU DU PANNEAU ===================== */

function rendrePanneau(){
  var p = $("#marina-staff"); if (!p) return;
  if (!M().estStaff()){ fermer(); return; }
  staffTabs();
  var l = items();
  $("#qbm-gnom").textContent = SS.stab==="vote" ? "Revue avant ouverture du vote"
    : SS.stab==="cloture" ? "Votes à clôturer" : "Fiches résolues ou en jeu";
  $("#qbm-gnb").textContent = l.length + (l.length>1?" fiches":" fiche");
  if (!l.length){
    $("#qbm-gliste").innerHTML = '<div class="tdlev-vide">Rien par ici — le Bayou est calme. Savourons.</div>';
    $("#qbm-gtrav").innerHTML = '<div class="tdlev-vide">Choisissez une fiche dans la colonne de gauche.</div>';
    $("#qbm-gpied").innerHTML = "";
    return;
  }
  if (!SS.ssel || !l.some(function(f){ return f.id===SS.ssel; })) SS.ssel = l[0].id;
  $("#qbm-gliste").innerHTML = l.map(staffRow).join("");
  var f = M().fiche(SS.ssel); if (!f) return;
  var trav = $("#qbm-gtrav"), pied = $("#qbm-gpied");
  if (SS.stab==="vote"){
    if (SS.editing){
      trav.innerHTML = staffTete(f) + editForm(f);
      pied.innerHTML = '<span class="qbm-gnote">'+TXT.NOTE_EDIT+'</span>'
        + '<button class="tdlev-btn est-second" data-gact="editcancel" type="button">Annuler</button>'
        + '<button class="tdlev-btn" data-gact="editsave" type="button">Enregistrer les modifications</button>';
    } else {
      trav.innerHTML = staffTete(f) + dossier(f);
      pied.innerHTML = '<span class="qbm-gnote">'+TXT.NOTE_VOTE+'</span>'
        + '<button class="tdlev-btn est-second" data-gact="precisions" type="button">Demander des précisions</button>'
        + '<button class="tdlev-btn est-second" data-gact="edit" type="button">Éditer la fiche</button>'
        + '<button class="tdlev-btn" data-gact="voter" type="button">Ouvrir le vote — '+M().CFG.VOTE_JOURS+' jours</button>';
    }
  } else if (SS.stab==="cloture"){
    trav.innerHTML = clotureForm(f);
    pied.innerHTML = '<span class="qbm-gnote">Le débit des cagnottes n\'a lieu qu\'à la clôture — jusque-là, la somme est affichée en gel d\'engagement.</span>';
  } else {
    trav.innerHTML = staffTete(f) + conseqForm(f);
    pied.innerHTML = '<span class="qbm-gnote">'+TXT.NOTE_CONSEQ+'</span>'
      + '<button class="tdlev-btn" data-gact="qsave" type="button">Enregistrer les conséquences</button>';
  }
}

/* ===================== ACTIONS ===================== */

function patch(id, maj, message){
  var base = M().CFG.NODE + "/" + id + "/", up = {};
  Object.keys(maj).forEach(function(k){ up[base+k] = maj[k]; });
  return Promise.resolve(E().firebaseUpdate(up))
    .then(function(){ if (message) M().toast(message); M().reprendre(); })
    .catch(function(){ M().toast(TXT.ERR_ECRIT); });
}

function ouvrirVote(f){
  var m = M();
  var besoin = f.avec ? m.TYPES.inter.split : f.montant;
  var cotes = f.avec ? [f.com, f.avec] : [f.com];
  for (var i=0;i<cotes.length;i++){
    var net = m.cagnotteNette(cotes[i]);
    if (besoin > Math.floor(m.CFG.PLAFOND * net)){
      m.toast(TXT.ERR_PLAFOND(m.COMMU[cotes[i]].nom, m.money(net)));
      return;
    }
  }
  var fin = new Date(Date.now() + m.CFG.VOTE_JOURS*86400000).toISOString();
  Object.keys(f.auteurs).forEach(function(k){ m.notifier(m.NOTIF.VOTE, f.auteurs[k], { titre:f.nom, jours:m.CFG.VOTE_JOURS }, "marina-vote-" + f.id); });
  patch(f.id, { statut:"en_vote", ouverte:new Date().toISOString(), fin:fin }, TXT.OK_VOTE);
}

/* débit réel à la clôture : transaction par cagnotte (jamais de négatif) */
function debiter(com, montant){
  var path = M().CFG.NODE_CAGNOTTES + "/" + encodeURIComponent(com);
  return Promise.resolve(E().firebaseTransaction(path, function(cur){
    var c = cur || 0;
    if (c < montant) throw new Error("FONDS");
    return c - montant;
  }));
}

function cloturer(f, cleGagnante, jet){
  var m = M();
  if (f.avec){
    var opp = m.oppositionDe(f);
    var bloque = Object.keys(opp).some(function(k){ return opp[k] > Math.floor(m.effDe(k)/2); });
    if (bloque){ m.toast("Une communauté est majoritairement opposée — la fiche ne peut que rester non tranchée."); return; }
  }
  var v = m.voixDe(f);
  var q = m.quorumDe(f);
  if (v.tot < q){ m.toast("Le quorum ("+q+") n'est pas atteint — classe en non tranchée."); return; }
  var opt = f.options[cleGagnante];
  var montant = f.avec ? m.TYPES.inter.split : f.montant;
  var cotes = f.avec ? [f.com, f.avec] : [f.com];
  var resultat = "L'option "+cleGagnante+" — "+opt.t+" — l'emporte, "+v[cleGagnante]+" voix sur "+v.tot+"."
    + (jet ? " Dé de départage tiré publiquement : "+jet.valeur+" — consigné dans la fiche." : "")
    + (f.avec ? " 1 000 $ engagés sur chaque cagnotte." : " "+m.money(f.montant)+" engagés sur la cagnotte "+m.COMMU[f.com].nom+".");
  var suite = function(){
    var maj = { statut:"cloturee", resultat:resultat, cloturee:new Date().toISOString() };
    if (jet) maj.jet = { valeur:jet.valeur, gagnant:cleGagnante, date:new Date().toISOString() };
    Object.keys(f.auteurs).forEach(function(k){ m.notifier(m.NOTIF.CLOTURE, f.auteurs[k], { titre:f.nom, resultat:resultat }, "marina-clot-" + f.id); });
    patch(f.id, maj, "Vote clôturé — " + m.money(f.avec ? m.TYPES.inter.split : f.montant) + " débités.").then(function(){
      /* grand œuvre et inter : passage en jeu automatique, évent d'origine boutique */
      if (f.type==="oeuvre" || f.type==="inter") basculerEnJeu(m.fiche(f.id) || f);
    });
  };
  var promesses = cotes.map(function(c){ return debiter(c, montant); });
  Promise.all(promesses).then(suite).catch(function(){
    m.toast(TXT.ERR_FONDS(f.avec ? "des deux communautés" : m.COMMU[f.com].nom));
  });
}

function basculerEnJeu(f){
  var m = M();
  m.creerEvenement(f).then(function(){
    patch(f.id, { statut:"en_jeu" }, "Événement créé — la fiche est en jeu.");
  }).catch(function(){ m.toast(TXT.ERR_ECRIT); });
}

/* ===================== ÉVÉNEMENTS ===================== */

function brancher(){
  $("#marina-staff").addEventListener("click", function(e){
    var t = e.target, el;
    if ((el = t.closest("[data-stab]"))){ SS.stab = el.getAttribute("data-stab"); SS.ssel = null; SS.editing = false; rendrePanneau(); return; }
    if ((el = t.closest("[data-sf]"))){ SS.ssel = el.getAttribute("data-sf"); SS.editing = false; rendrePanneau(); return; }
    if ((el = t.closest("[data-cqdel]"))){
      var fc = M().fiche(SS.ssel); if (!fc) return;
      var up = {}; up[M().CFG.NODE+"/"+fc.id+"/conseq/"+el.getAttribute("data-cqdel")] = null;
      Promise.resolve(E().firebaseUpdate(up)).then(function(){ M().reprendre(); }).catch(function(){ M().toast(TXT.ERR_ECRIT); });
      return;
    }
    if ((el = t.closest("[data-cloture]"))){ var fg = M().fiche(SS.ssel); if (fg) cloturer(fg, el.getAttribute("data-cloture"), null); return; }
    if ((el = t.closest("[data-gact]"))){
      var act = el.getAttribute("data-gact");
      var f = M().fiche(SS.ssel);
      if (act==="voter" && f){ ouvrirVote(f); return; }
      if (act==="nontranchee" && f){
        patch(f.id, { statut:"non_tranchee", cloturee:new Date().toISOString() }, "Fiche classée non tranchée — les fonds restent en cagnotte.");
        return;
      }
      if (act==="de" && f){
        var d = parseInt($("#qbm-de") && $("#qbm-de").value, 10);
        if (!d || d<1 || d>Object.keys(f.options).length){ M().toast(TXT.ERR_DE); return; }
        var ks = Object.keys(f.options).sort();
        cloturer(f, ks[d-1], { valeur:d });
        return;
      }
      if (act==="precisions"){
        $("#qbm-gpied").innerHTML = '<textarea class="qbm-prect" id="qbm-prect" placeholder="'+M().esc(TXT.PRECISIONS_PH)+'"></textarea>'
          + '<button class="tdlev-btn est-second" data-gact="precisions-annul" type="button">Annuler</button>'
          + '<button class="tdlev-btn" data-gact="precisions-envoi" type="button">Envoyer la demande</button>';
        $("#qbm-prect").focus();
        return;
      }
      if (act==="precisions-annul"){ rendrePanneau(); return; }
      if (act==="precisions-envoi" && f){
        var ptxt = $("#qbm-prect").value.trim();
        if (!ptxt){ M().toast("Écrivez d'abord ce que vous attendez des auteurs."); return; }
        Object.keys(f.auteurs).forEach(function(k){ m.notifier(m.NOTIF.PRECISIONS, f.auteurs[k], { titre:f.nom }, "marina-prec-" + f.id); });
        patch(f.id, { precisions:ptxt }, TXT.OK_PREC);
        return;
      }
      if (act==="edit"){ SS.editing = true; rendrePanneau(); return; }
      if (act==="editcancel"){ SS.editing = false; rendrePanneau(); return; }
      if (act==="editsave" && f){
        var maj = {};
        Array.prototype.forEach.call($("#qbm-gtrav").querySelectorAll("[data-ed]"), function(x){
          var k = x.getAttribute("data-ed"), val = x.value.trim();
          var mo = k.match(/^opt([A-C])(t|d)$/);
          if (mo){
            maj["options/"+mo[1]+"/"+(mo[2]==="t"?"t":"d")] = val;
          } else if (k==="nom"){ if (val) maj.nom = val; }
          else maj[k] = val;
        });
        patch(f.id, maj, TXT.OK_EDIT);
        SS.editing = false;
        return;
      }
      if (act==="qadd" && f){
        var gk = $("#qbm-cqsel").value;
        var up = {}; up[M().CFG.NODE+"/"+f.id+"/conseq/"+gk] = "";
        if (f.conseq && f.conseq[gk]!==undefined){ M().toast("Ce groupe a déjà sa case de conséquences."); return; }
        Promise.resolve(E().firebaseUpdate(up)).then(function(){ M().reprendre(); }).catch(function(){ M().toast(TXT.ERR_ECRIT); });
        return;
      }
      if (act==="enjeu" && f){ basculerEnJeu(f); return; }
      if (act==="qsave" && f){
        var cq = {};
        Array.prototype.forEach.call($("#qbm-gtrav").querySelectorAll("[data-cq]"), function(x){
          cq[x.getAttribute("data-cq")] = x.value.trim();
        });
        patch(f.id, { conseq:cq }, TXT.OK_CONSEQ);
        return;
      }
      return;
    }
  });
}

/* la veille du socle a repris les données : le panneau ouvert se rafraîchit */
function absorber(){ if (ouvert()) rendrePanneau(); }

/* ===================== EXPORT ===================== */

window.MarinaStaff = {
  ouvrir:ouvrir, fermer:fermer, absorber:absorber, rendre:rendrePanneau, SS:SS
};

})();
