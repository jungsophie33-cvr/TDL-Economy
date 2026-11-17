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

var MC = window.MarinaConfig;
var TXT = MC.TEXTES.STAFF, CH = MC.CHAMPS_STAFF, IC = MC.ICONES;
var NOTIF = MC.NOTIF;

/* ===================== STRUCTURE ===================== */

function construire(){
  var p = document.createElement("div");
  p.id = "marina-staff"; p.className = "qbm-fixe"; p.hidden = true;
  p.innerHTML =
    '<header class="qbm-gmastic">'
    + '<div><button class="tdlev-txt-btn" id="qbm-staffclose" type="button"><i class="fi '+IC.retour+'"></i><span>'+TXT.RETOUR+'</span></button></div>'
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
  var defs = Object.keys(IC.staffTabs).map(function(k){
    return { k:k, icon:IC.staffTabs[k].ic, lab:IC.staffTabs[k].lab, c:IC.staffTabs[k].c };
  });
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
    + (M().joursRestants(new Date(f.cree).getTime()+7*86400000)<0 && f.statut==="publiee" ? '<span class="tdlev-tag qbm-ej-tag">'+TXT.SANS_REVUE+'</span>' : '')
    + '<h3>'+M().esc(f.nom)+'</h3></div>';
}

function dossier(f){
  var m = M(), v = m.voixDe(f);
  return '<div class="tdlev-elem">'
    + m.elem("fi-tr-dollar","Montant", m.money(f.montant)+(f.avec?" · 1 000 / 1 000":""))
    + m.elem("fi-tr-bolt","Vote", voteInfo(f))
    + m.elem("fi-sr-hand-present","Bénéficiaires", f.benef||"—")
    + '</div>'
    + (f.precisions ? '<div class="qb-asbox qbm-u-mt16"><span class="qb-lab">'+TXT.PRECISIONS+'</span><p>'+m.esc(f.precisions)+'</p></div>' : "")
    + m.pave("fi-tr-house-flood","Contexte",'<p class="tdlev-f-p">'+m.esc(f.probleme||"")+'</p>')
    + '<div class="qbm-pavgrid qbm-u-mt16">'
    + m.pave("fi-tr-bullseye","Objectifs",'<ul class="tdlev-obj"><li>'+m.esc(f.objectif||"")+'</li></ul>')
    + m.pave("fi-tr-diamond-exclamation","Risques",'<p class="tdlev-f-p">'+m.esc(f.risque||"")+'</p>')
    + '</div>'
    + '<p class="qb-lab qbm-u-m208">'+TXT.OPT_MAX+'</p>'
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
  var h = '<p class="qb-lab qbm-u-m012">'+TXT.EDIT_TITRE+'</p>'
    + '<div class="qbm-edgrid">'
    + inp(CH.nom,"nom", f.nom)
    + ta(CH.probleme,"probleme", f.probleme)
    + ta(CH.objectif,"objectif", f.objectif)
    + inp(CH.benef,"benef", f.benef)
    + ta(CH.risque,"risque", f.risque)
    + ta(CH.conflit,"conflit", f.conflit)
    + ta(CH.abandon,"abandon", f.abandon)
    + inp(CH.img,"img", f.img)
    + '</div>'
    + '<p class="qb-lab qbm-u-m2012">'+TXT.OPT_TITRE+'</p>'
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
    + '<p class="qb-lab qbm-u-m248">'+TXT.CQ_TITRE+'</p>'
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
    : '<p class="qbm-note qbm-u-mt14">'+TXT.CQ_TOUTES+'</p>';
  /* passage en jeu d'un dossier communautaire : décision staff */
  if (f.statut==="cloturee" && f.type==="dossier" && !f.event){
    h += '<div class="qb-asbox qbm-u-mt18"><span class="qb-lab">'+TXT.ENJEU_TITRE+'</span>'
      + '<p>'+TXT.ENJEU_TXT+'</p>'
      + '<div class="qbm-u-mt10"><button class="tdlev-btn" data-gact="enjeu" type="button">'+TXT.ENJEU_BTN+'</button></div></div>';
  }
  return h;
}

/* ===================== CLÔTURE ===================== */

function clotureForm(f){
  var m = M(), v = m.voixDe(f), opp = m.oppositionDe(f);
  var q = m.quorumDe(f);
  var h = staffTete(f) + dossier(f);
  h += '<div class="qb-asbox qbm-u-mt16"><span class="qb-lab">'+TXT.DECOMPTE+'</span><p>'
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
    return '<button class="tdlev-btn est-second" data-cloture="'+k+'" type="button">'+TXT.CLOTURER_OPT(k, v[k]||0)+'</button>';
  }).join("");
  h += '<p class="qb-lab qbm-u-m188">'+TXT.ISSUE_TITRE+'</p>'
    + '<div class="qbm-u-flexw">'
    + boutons
    + '<button class="tdlev-btn est-second" data-gact="nontranchee" type="button">'+TXT.NON_TRANCHEE+'</button>'
    + '</div>'
    + '<div class="qbm-cqadd"><input type="number" class="qbm-u-de" id="qbm-de" min="1" max="'+Object.keys(f.options).length+'" placeholder="'+TXT.DE_PH+'"'
    + '><button class="tdlev-btn est-second" data-gact="de" type="button">'+TXT.CONSIGNER_DE+'</button></div>'
    + '<p class="qbm-note qbm-u-mt12">'+TXT.NOTE_DE+'</p>';
  return h;
}

/* ===================== RENDU DU PANNEAU ===================== */

function rendrePanneau(){
  var p = $("#marina-staff"); if (!p) return;
  if (!M().estStaff()){ fermer(); return; }
  staffTabs();
  var l = items();
  $("#qbm-gnom").textContent = SS.stab==="vote" ? TXT.TITRE_VOTE
    : SS.stab==="cloture" ? TXT.TITRE_CLOTURE : TXT.TITRE_CONSEQ;
  $("#qbm-gnb").textContent = l.length + " " + (l.length>1?TXT.FICHES:TXT.FICHE);
  if (!l.length){
    $("#qbm-gliste").innerHTML = '<div class="tdlev-vide">'+TXT.LISTE_VIDE+'</div>';
    $("#qbm-gtrav").innerHTML = '<div class="tdlev-vide">'+TXT.TRAVAIL_VIDE+'</div>';
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
        + '<button class="tdlev-btn est-second" data-gact="editcancel" type="button">'+TXT.ANNULER+'</button>'
        + '<button class="tdlev-btn" data-gact="editsave" type="button">'+TXT.ENREGISTRER+'</button>';
    } else {
      trav.innerHTML = staffTete(f) + dossier(f);
      pied.innerHTML = '<span class="qbm-gnote">'+TXT.NOTE_VOTE+'</span>'
        + '<button class="tdlev-btn est-second" data-gact="precisions" type="button">'+TXT.DEMANDER+'</button>'
        + '<button class="tdlev-btn est-second" data-gact="edit" type="button">'+TXT.EDITER+'</button>'
        + '<button class="tdlev-btn" data-gact="voter" type="button">'+TXT.OUVRIR_VOTE(M().CFG.VOTE_JOURS)+'</button>';
    }
  } else if (SS.stab==="cloture"){
    trav.innerHTML = clotureForm(f);
    pied.innerHTML = '<span class="qbm-gnote">'+TXT.NOTE_DEBIT+'</span>';
  } else {
    trav.innerHTML = staffTete(f) + conseqForm(f);
    pied.innerHTML = '<span class="qbm-gnote">'+TXT.NOTE_CONSEQ+'</span>'
      + '<button class="tdlev-btn" data-gact="qsave" type="button">'+TXT.OK_CONSEQ_BTN+'</button>';
  }
}

/* ===================== ACTIONS ===================== */

function patch(id, maj, message){
  var base = M().CFG.NODE + "/" + id + "/", up = {};
  Object.keys(maj).forEach(function(k){ up[base+k] = maj[k]; });
  return patchAbs(up, message);
}
/* patchAbs : écriture de chemins absolus (nœud marina_conseq notamment) */
function patchAbs(up, message){
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
    if (bloque){ m.toast(TXT.ERR_OPPO); return; }
  }
  var v = m.voixDe(f);
  var q = m.quorumDe(f);
  if (v.tot < q){ m.toast(TXT.ERR_QUORUM(q)); return; }
  var opt = f.options[cleGagnante];
  var montant = f.avec ? m.TYPES.inter.split : f.montant;
  var cotes = f.avec ? [f.com, f.avec] : [f.com];
  var resultat = TXT.RESULTAT_OPT(cleGagnante, opt.t, v[cleGagnante], v.tot)
    + (jet ? TXT.RESULTAT_JET(jet.valeur) : "")
    + (f.avec ? TXT.RESULTAT_INTER : TXT.RESULTAT_SOLO(m.money(f.montant), m.COMMU[f.com].nom));
  var suite = function(){
    var maj = { statut:"cloturee", resultat:resultat, cloturee:new Date().toISOString() };
    if (jet) maj.jet = { valeur:jet.valeur, gagnant:cleGagnante, date:new Date().toISOString() };
    Object.keys(f.auteurs).forEach(function(k){ m.notifier(m.NOTIF.CLOTURE, f.auteurs[k], { titre:f.nom, resultat:resultat }, "marina-clot-" + f.id); });
    patch(f.id, maj, TXT.OK_CLOTURE(m.money(f.avec ? m.TYPES.inter.split : f.montant))).then(function(){
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
    patch(f.id, { statut:"en_jeu" }, TXT.OK_ENJEU);
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
      var up = {}; up[M().CFG.NODE_CONSEQ+"/"+fc.id+"/"+el.getAttribute("data-cqdel")] = null;
      Promise.resolve(E().firebaseUpdate(up)).then(function(){ M().reprendre(); }).catch(function(){ M().toast(TXT.ERR_ECRIT); });
      return;
    }
    if ((el = t.closest("[data-cloture]"))){ var fg = M().fiche(SS.ssel); if (fg) cloturer(fg, el.getAttribute("data-cloture"), null); return; }
    if ((el = t.closest("[data-gact]"))){
      var act = el.getAttribute("data-gact");
      var f = M().fiche(SS.ssel);
      if (act==="voter" && f){ ouvrirVote(f); return; }
      if (act==="nontranchee" && f){
        patch(f.id, { statut:"non_tranchee", cloturee:new Date().toISOString() }, TXT.OK_NONTRANCHEE);
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
          + '<button class="tdlev-btn est-second" data-gact="precisions-annul" type="button">'+TXT.ANNULER+'</button>'
          + '<button class="tdlev-btn" data-gact="precisions-envoi" type="button">'+TXT.ENVOYER_DEMANDE+'</button>';
        $("#qbm-prect").focus();
        return;
      }
      if (act==="precisions-annul"){ rendrePanneau(); return; }
      if (act==="precisions-envoi" && f){
        var ptxt = $("#qbm-prect").value.trim();
        if (!ptxt){ M().toast(TXT.PRECISIONS_ERR); return; }
        Object.keys(f.auteurs).forEach(function(k){ M().notifier(NOTIF.PRECISIONS, f.auteurs[k], { titre:f.nom }, "marina-prec-" + f.id); });
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
        var up = {}; up[M().CFG.NODE_CONSEQ+"/"+f.id+"/"+gk] = "";
        if (f.conseq && f.conseq[gk]!==undefined){ M().toast(TXT.CQ_DEJA); return; }
        Promise.resolve(E().firebaseUpdate(up)).then(function(){ M().reprendre(); }).catch(function(){ M().toast(TXT.ERR_ECRIT); });
        return;
      }
      if (act==="enjeu" && f){ basculerEnJeu(f); return; }
      if (act==="qsave" && f){
        var cq = {};
        Array.prototype.forEach.call($("#qbm-gtrav").querySelectorAll("[data-cq]"), function(x){
          cq[x.getAttribute("data-cq")] = x.value.trim();
        });
        var o = {}; o[M().CFG.NODE_CONSEQ+"/"+f.id] = cq;
        patchAbs(o, TXT.OK_CONSEQ);
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
