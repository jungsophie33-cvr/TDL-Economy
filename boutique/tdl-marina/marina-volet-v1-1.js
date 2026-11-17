/* THE DROWNED LANDS — LA MARINA · VOLET DE PROPOSITION · v1
 *
 * Deux pages, dans l'esprit du volet du Courier : le choix du type
 * (Petite faveur 500 · Dossier communautaire 1 000 · Grand œuvre 2 000 ·
 * Intercommunautaire 2 000 partagés), puis le formulaire du type choisi.
 * Le montant se déduit du type : plus de palier.
 *
 * CE QUE CE FICHIER FAIT
 *   - pose et anime le volet, gère les deux pages et le retour ;
 *   - affiche le quota restant du membre pour le mois calendaire ;
 *   - valide les champs, contrôle le plafond des 50 % de la cagnotte NETTE
 *     (engagements des fiches en vote déduits — motif du gel de la Main) ;
 *   - crée la fiche (push marina_fiches) ou enregistre la retouche d'un
 *     auteur tant que le vote n'est pas ouvert.
 *
 * CE QU'IL NE FAIT PAS : ni l'ouverture du vote, ni le débit (marina-staff).
 *
 * DÉPEND DE : window.Marina (marina-core), window.EcoCore.
 * EXPOSE : window.MarinaVolet.
 */
(function () {
"use strict";

var M = function(){ return window.Marina; };
function E(){ return window.EcoCore; }
function $(s,r){ return (r||document).querySelector(s); }

var S = { type:null, edit:null, occupe:false };
var el = {};

var MC = window.MarinaConfig;
var TXT = MC.TEXTES.VOLET, CH = MC.CHAMPS_VOLET, IC = MC.ICONES, TYPES = MC.TYPES;

/* ===================== CONSTRUCTION ===================== */

function construire(){
  el.voile = document.createElement("div"); el.voile.id = "marina-voile"; el.voile.className = "tdlhc-voile";
  el.volet = document.createElement("aside"); el.volet.id = "marina-volet"; el.volet.className = "tdlhc-volet";
  el.volet.setAttribute("aria-hidden", "true");
  el.volet.innerHTML = voletHTML();
  document.body.appendChild(el.voile); document.body.appendChild(el.volet);
  el.titre = $("#marina-volet-titre", el.volet); el.corps = $("#mrv-choix", el.volet);
  el.form = $("#mrv-form", el.volet); el.cout = $("#mrv-cout", el.volet);
  el.quota = $("#mrv-quota", el.volet); el.ok = $("#mrv-ok", el.volet);
  brancher();
}

function voletHTML(){
  var COMMU = M().COMMU;
  var autres = Object.keys(COMMU).filter(function(k){ return k!==M().maCommu(); });
  var sp = function(lab, span){ return ' <span>— '+span+'</span>'; };
  var champ = function(label, inner, aide){ return '<div class="tdlhc-champ"><label>'+label+'</label>'+inner+(aide?'<p class="tdlhc-aide">'+aide+'</p>':'')+'</div>'; };
  var inp = function(id, ph, ta, minh){
    return '<input id="'+id+'" type="text" placeholder="'+ph+'"'+(ta?' class="tdlhc-ta-court qbm-u-ta60"':'')+'>';
  };
  var types = Object.keys(TYPES).map(function(k){
    var t = TYPES[k];
    return '<div class="tdlhc-type" data-type="'+k+'" style="--c:'+t.c+'"><i class="fi '+t.ic+'"></i>'
      + '<div class="tdlhc-type-txt"><h5>'+t.lab+'</h5><p>'+t.desc+'</p></div><span class="tdlhc-tarif">'+t.tarif+'</span></div>';
  }).join("");
  return '<div class="tdlhc-volet-tete">'
    + '<button class="tdlhc-x" id="mrv-back" type="button" hidden title="Retour au choix du type"><i class="fi '+IC.retour+'"></i></button>'
    + '<h3 id="marina-volet-titre">'+TXT.TITRE+'</h3>'
    + '<button class="tdlhc-x" id="mrv-x" type="button">&times;</button></div>'
    + '<div class="tdlhc-volet-corps">'
    + '<div id="mrv-choix">'
    + '<div class="tdlhc-quota"><i class="fi '+IC.opposition+'"></i><span id="mrv-quota"></span></div>'
    + '<div class="tdlhc-champ"><span class="tdlhc-legende">'+TXT.CHOIX_TITRE+'</span>'
    + '<div class="tdlhc-types" id="mrv-types">'+types+'</div></div>'
    + '<p class="tdlhc-note">'+TXT.NOTE_RELECTURE+'</p>'
    + '</div>'
    + '<div id="mrv-form" hidden>'
    + '<div id="mrv-inter" hidden>'
    + champ(CH.part, '<select id="mrv-part">'
      + autres.map(function(k){ return '<option value="'+M().esc(k)+'">'+M().esc(COMMU[k].nom)+'</option>'; }).join("")
      + '</select>', CH.part_aide)
    + champ(CH.coaut+' <span>— '+CH.coaut_span+'</span>', '<input id="mrv-coaut" type="text" placeholder="Pseudo du co-auteur">', CH.coaut_aide)
    + '</div>'
    + '<div class="tdlhc-duo">'
    + champ(CH.nom, '<input id="mrv-nom" type="text" placeholder="'+CH.nom_ph+'">')
    + champ(CH.img+sp(), '<input id="mrv-img" type="text" placeholder="'+CH.img_ph+'">')
    + '</div>'
    + champ(CH.ctx+sp(), '<textarea id="mrv-ctx" class="qbm-u-ta86" placeholder="'+CH.ctx_ph+'"></textarea>')
    + champ(CH.obj+sp(), '<textarea id="mrv-obj" class="tdlhc-ta-court qbm-u-ta60" placeholder="'+CH.obj_ph+'"></textarea>')
    + '<div class="tdlhc-duo">'
    + champ(CH.ben, '<input id="mrv-ben" type="text" placeholder="'+CH.ben_ph+'">')
    + champ(CH.ris, '<input id="mrv-ris" type="text" placeholder="'+CH.ris_ph+'">')
    + '</div>'
    + '<div class="tdlhc-duo">'
    + champ(CH.conflit+sp(), '<input id="mrv-conflit" type="text" placeholder="'+CH.conflit_ph+'">')
    + champ(CH.ab+sp(), '<input id="mrv-ab" type="text" placeholder="'+CH.ab_ph+'">')
    + '</div>'
    + '<div class="tdlhc-champ"><label>'+CH.opts+' <span>— '+CH.opts_span+'</span></label>'
    + '<input id="mrv-optA" type="text" placeholder="'+CH.optA_ph+'">'
    + '<input id="mrv-optAd" type="text" placeholder="'+CH.optAd_ph+'" class="qbm-u-mt8">'
    + '<input id="mrv-optB" type="text" placeholder="'+CH.optB_ph+'" class="qbm-u-mt12">'
    + '<input id="mrv-optBd" type="text" placeholder="'+CH.optBd_ph+'" class="qbm-u-mt8">'
    + '<input id="mrv-optC" type="text" placeholder="'+CH.optC_ph+'" hidden class="qbm-u-mt12">'
    + '<input id="mrv-optCd" type="text" placeholder="'+CH.optCd_ph+'" hidden class="qbm-u-mt8">'
    + '<button class="tdlhc-btn creux petit" id="mrv-addc" type="button" class="qbm-u-mt10"><i class="fi '+IC.ajouter+'"></i>'+CH.addc+'</button>'
    + '</div>'
    + '<div class="tdlhc-encart"><h5><i class="fi fi-tr-balance-scale-left"></i>'+TXT.AVANT_TITRE+'</h5><ul>'
    + TXT.AVANT.map(function(x){ return '<li>'+x+'</li>'; }).join("")
    + '</ul></div>'
    + '</div></div>'
    + '<div class="tdlhc-volet-pied"><div class="tdlhc-pied-ligne">'
    + '<span class="tdlhc-cout" id="mrv-cout">'+TXT.CHOISIR+'</span>'
    + '<span class="qbm-u-flex">'
    + '<button class="tdlhc-btn creux" id="mrv-retour" type="button" hidden>'+TXT.RETOUR+'</button>'
    + '<button class="tdlhc-btn" id="mrv-ok" type="button"><i class="fi '+IC.deposer+'"></i><span>'+TXT.DEPOSER+'</span></button>'
    + '</span></div></div>';
}

/* ===================== PAGES ===================== */

function pageChoix(){
  S.type = null;
  el.titre.textContent = TXT.TITRE;
  el.corps.hidden = false; el.form.hidden = true;
  el.cout.textContent = TXT.CHOISIR;
  $("#mrv-retour").hidden = true; $("#mrv-back").hidden = true;
  el.ok.hidden = true;
  Array.prototype.forEach.call(el.volet.querySelectorAll("#mrv-types .tdlhc-type"), function(t){
    t.classList.toggle("selu", false);
  });
  poserQuota();
}
function pageForm(){
  el.titre.textContent = S.edit ? TXT.MODIFIER : (M().TYPES[S.type] ? M().TYPES[S.type].lab : TXT.TITRE);
  el.corps.hidden = true; el.form.hidden = false;
  updateCout();
  $("#mrv-retour").hidden = false; $("#mrv-back").hidden = false;
  el.ok.hidden = false;
  el.ok.querySelector("span").textContent = S.edit ? TXT.ENREGISTRER : TXT.DEPOSER;
}
function setType(t){
  S.type = t;
  Array.prototype.forEach.call(el.volet.querySelectorAll("#mrv-types .tdlhc-type"), function(x){
    x.classList.toggle("selu", x.getAttribute("data-type")===t);
  });
  $("#mrv-inter").hidden = (t!=="inter");
  updateCout();
}
function updateCout(){
  var T = M().TYPES;
  el.cout.textContent = S.type
    ? TXT.MONTANT + M().money(T[S.type].m) + (S.type==="inter" ? TXT.PARTAGE : "")
    : TXT.CHOISIR;
}
function poserQuota(){
  var p = M().pseudo(); if (!p){ el.quota.textContent = "Connecte-toi pour proposer une initiative."; return; }
  var q = M().quotaDe(p);
  el.quota.innerHTML = "<b>" + (q.max - q.n > 0 ? (q.max - q.n) + TXT.QUOTA_1 : TXT.QUOTA_0) + "</b>" + TXT.QUOTA_NOTE;
}

/* ===================== OUVERTURE ===================== */

function ouvrir(fid){
  if (!el.volet) construire();
  var edit = fid ? M().fiche(fid) : null;
  S.edit = edit ? edit.id : null;
  el.ok.hidden = false;
  el.ok.querySelector("span").textContent = edit ? TXT.ENREGISTRER : TXT.DEPOSER;
  if (edit){
    setType(edit.avec ? "inter" : (edit.montant===500 ? "faveur" : edit.montant===2000 ? "oeuvre" : "dossier"));
    $("#mrv-nom").value = edit.nom; $("#mrv-ctx").value = edit.probleme||"";
    $("#mrv-obj").value = edit.objectif||""; $("#mrv-ben").value = edit.benef||"";
    $("#mrv-ris").value = edit.risque||""; $("#mrv-conflit").value = edit.conflit||"";
    $("#mrv-ab").value = edit.abandon||""; $("#mrv-img").value = edit.img||"";
    var ks = Object.keys(edit.options).sort();
    $("#mrv-optA").value = edit.options[ks[0]] ? edit.options[ks[0]].t : "";
    $("#mrv-optAd").value = edit.options[ks[0]] ? edit.options[ks[0]].d : "";
    $("#mrv-optB").value = edit.options[ks[1]] ? edit.options[ks[1]].t : "";
    $("#mrv-optBd").value = edit.options[ks[1]] ? edit.options[ks[1]].d : "";
    var a3 = !!ks[2];
    $("#mrv-optC").hidden = !a3; $("#mrv-optCd").hidden = !a3; $("#mrv-addc").hidden = a3;
    $("#mrv-optC").value = a3 ? edit.options[ks[2]].t : "";
    $("#mrv-optCd").value = a3 ? edit.options[ks[2]].d : "";
    if (edit.avec){
      $("#mrv-part").value = edit.avec;
      $("#mrv-coaut").value = Object.keys(edit.auteurs).map(function(k){ return edit.auteurs[k]; })
        .filter(function(a){ return a!==M().pseudo(); })[0] || "";
    } else { $("#mrv-coaut").value = ""; }
    pageForm();
  } else {
    ["mrv-nom","mrv-ctx","mrv-obj","mrv-ben","mrv-ris","mrv-conflit","mrv-ab","mrv-img",
     "mrv-optA","mrv-optAd","mrv-optB","mrv-optBd","mrv-optC","mrv-optCd","mrv-coaut"].forEach(function(id){
      $("#"+id).value = "";
    });
    $("#mrv-optC").hidden = true; $("#mrv-optCd").hidden = true; $("#mrv-addc").hidden = false;
    pageChoix();
  }
  /* reflow AVANT la classe .on : au premier ouverture le volet vient d'être
     inséré dans le DOM ; sans ce calcul forcé, le navigateur n'anime pas la
     transformation (il peint l'état final directement). */
  void el.volet.offsetWidth;
  el.voile.classList.add("on"); el.volet.classList.add("on"); el.volet.setAttribute("aria-hidden", "false");
}
function fermer(){
  el.voile.classList.remove("on"); el.volet.classList.remove("on"); el.volet.setAttribute("aria-hidden", "true");
  S.edit = null; S.type = null;
}

/* ===================== VALIDATION ET ÉCRITURE ===================== */

function champs(){
  var v = {};
  ["nom","ctx","obj","ben","ris","conflit","ab","img","optA","optAd","optB","optBd","optC","optCd","part","coaut"]
    .forEach(function(k){ v[k] = $("#mrv-"+k).value.trim(); });
  return v;
}

function plafondOK(type, com, avec){
  var T = M().TYPES, m = M();
  var net = m.cagnotteNette(com);
  var besoin = (type==="inter") ? T.inter.split : T[type].m;
  if (besoin > Math.floor(m.CFG.PLAFOND * net)) return { ok:false, net:net };
  if (type==="inter"){
    var net2 = m.cagnotteNette(avec);
    if (besoin > Math.floor(m.CFG.PLAFOND * net2)) return { ok:false, net:net2, com:avec };
  }
  return { ok:true };
}

function envoyer(){
  if (S.occupe) return;
  var m = M(), p = m.pseudo();
  if (!p){ m.toast("Connecte-toi pour proposer une initiative."); return; }
  if (!S.type){ m.toast(TXT.ERR_TYPE); return; }
  var v = champs();
  if (!v.nom){ m.toast(TXT.ERR_NOM); return; }
  if (!v.ctx){ m.toast(TXT.ERR_CTX); return; }
  if (!v.obj){ m.toast(TXT.ERR_OBJ); return; }
  if (!v.optA || !v.optB){ m.toast(TXT.ERR_OPTS); return; }
  if (!v.optAd || !v.optBd){ m.toast(TXT.ERR_CONCEPTS); return; }
  var com = m.maCommu();
  if (!com){ m.toast("Ta communauté n'est pas identifiable — préviens le staff."); return; }

  var now = new Date().toISOString();
  var maj = null;

  if (S.edit){
    var f = m.fiche(S.edit);
    if (!f){ S.edit = null; fermer(); return; }
    if (f.statut!=="publiee" && f.statut!=="attente_co"){ m.toast("Le vote est ouvert — la fiche ne s'édite plus."); return; }
    maj = {};
    maj["nom"] = v.nom; maj["probleme"] = v.ctx; maj["objectif"] = v.obj;
    maj["benef"] = v.ben || "—"; maj["risque"] = v.ris || "—";
    maj["conflit"] = v.conflit || "Aucun déclaré.";
    maj["abandon"] = v.ab || "—";
    if (v.img) maj["img"] = v.img;
    maj["type"] = S.type; maj["montant"] = m.TYPES[S.type].m;
    maj["options"] = { A:{t:v.optA,d:v.optAd}, B:{t:v.optB,d:v.optBd} };
    if (v.optC) maj["options"].C = { t:v.optC, d:v.optCd };
    var base = m.CFG.NODE + "/" + S.edit + "/";
    var up = {};
    Object.keys(maj).forEach(function(k){ up[base+k] = maj[k]; });
    if (S.type==="inter"){
      if (!v.coaut){ m.toast(TXT.ERR_CO); return; }
      var mb = (m.D.membres||{})[v.coaut];
      if (!mb || String(mb.group||"").indexOf(v.part)<0){ m.toast(TXT.ERR_CO_INCONNU); return; }
      up[base+"avec"] = v.part;
      up[base+"auteurs/"+m.cle(v.coaut)] = v.coaut;
    } else if (f.avec){
      /* retour d'une inter au solo : le partenaire et son auteur sortent */
      up[base+"avec"] = null;
      Object.keys(f.auteurs).forEach(function(k){
        if (f.auteurs[k]!==p) up[base+"auteurs/"+k] = null;
      });
    }
    ecrire(up, TXT.OK_EDIT);
    return;
  }

  /* création : quota calendaire puis plafond des 50 % de la cagnotte nette */
  var q = m.quotaDe(p);
  if (q.n >= q.max){ m.toast(TXT.ERR_QUOTA); return; }
  var pl = plafondOK(S.type, com, v.part);
  if (!pl.ok){ m.toast(TXT.ERR_PLAFOND(M().money(pl.net), pl.com ? m.COMMU[pl.com].nom : m.COMMU[com].nom)); return; }

  var f = {
    schema:1, type:S.type, nom:v.nom, com:com, avec:null,
    montant:m.TYPES[S.type].m, img:v.img,
    auteurs:{}, statut:"publiee", cree:now,
    options:{ A:{t:v.optA,d:v.optAd}, B:{t:v.optB,d:v.optBd} },
    probleme:v.ctx, objectif:v.obj,
    benef:v.ben || "—", risque:v.ris || "—",
    conflit:v.conflit || "Aucun déclaré.", abandon:v.ab || "—"
  };
  f.auteurs[m.cle(p)] = p;
  if (S.type==="inter"){
    if (!v.coaut){ m.toast(TXT.ERR_CO); return; }
    /* le co-auteur doit exister et appartenir à la communauté partenaire */
    var mb = (m.D.membres||{})[v.coaut];
    if (!mb || String(mb.group||"").indexOf(v.part)<0){ m.toast(TXT.ERR_CO_INCONNU); return; }
    f.avec = v.part;
    f.auteurs[m.cle(v.coaut)] = v.coaut;
    f.statut = "attente_co";         /* le co-auteur confirme sur la fiche, 3 jours */
    f.coNotifie = v.coaut;
  }
  ecrire(null, TXT.OK, f);
}

/* up : PATCH racine (retouche) ; nouv : fiche à pousser (création) */
function ecrire(up, message, nouv){
  var m = M();
  S.occupe = true;
  var promesse;
  if (nouv){
    promesse = Promise.resolve(E().firebasePush(m.CFG.NODE, nouv));
  } else {
    promesse = Promise.resolve(E().firebaseUpdate(up));
  }
  promesse.then(function(res){
    S.occupe = false; fermer(); m.toast(message); m.reprendre();
    if (nouv){
      m.notifier(m.NOTIF.NOUVELLE, "staff", { pseudo:m.pseudo(), titre:nouv.nom }, "marina-" + ((res && res.name) || Date.now()));
      if (nouv.avec && nouv.coNotifie) m.notifier(m.NOTIF.CO, nouv.coNotifie, { titre:nouv.nom }, "marina-co-" + ((res && res.name) || Date.now()));
    }
  }).catch(function(){
    S.occupe = false; m.toast(TXT.ERR_ENVOI);
  });
}

/* ===================== ÉVÉNEMENTS ===================== */

function brancher(){
  el.voile.addEventListener("click", fermer);
  document.addEventListener("keydown", function(e){
    if (e.key==="Escape" && el.volet.classList.contains("on")) fermer();
  });
  el.volet.addEventListener("click", function(e){
    var t = e.target;
    if (t.closest("#mrv-x")){ fermer(); return; }
    if (t.closest("#mrv-back") || t.closest("#mrv-retour")){ pageChoix(); return; }
    if (t.closest("#mrv-ok")){ envoyer(); return; }
    if (t.closest("#mrv-addc")){ $("#mrv-optC").hidden = false; $("#mrv-optCd").hidden = false; $("#mrv-addc").hidden = true; return; }
    var ty = t.closest("#mrv-types .tdlhc-type");
    if (ty){ setType(ty.getAttribute("data-type")); pageForm(); }
  });
}

/* ===================== EXPORT ===================== */

window.MarinaVolet = { ouvrir:ouvrir, fermer:fermer };

})();
