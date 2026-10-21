/* THE DROWNED LANDS — LES ÉVÉNEMENTS · COMPOSANTS PARTAGÉS
   Ce que le volet et le panneau de gestion écrivent tous les deux : les
   pastilles de portée à deux familles, les champs de formulaire, le toast,
   les notifications.

   Aucun de ces composants ne connaît les données du module : ils prennent ce
   qu'on leur passe et rendent du HTML. Les écouteurs sont branchés à part,
   après insertion, parce que tout le contenu est réécrit à chaque rendu.

   EXPOSE : window.TDLEvUI
   DÉPEND DE : window.TDLEv (pour esc et les deux familles de portées)

   CARTE DES BLOCS : ICÔNES · PASTILLES · CHAMPS · SORTIES */

(function () {
"use strict";

function V(){ return window.TDLEv; }

/* ===================== ICÔNES ===================== */
/* Convention : plein sur les cartes de choix, fin partout ailleurs. */

function fit(n){ return '<i class="fi fi-tr-' + n + '"></i>'; }
function fis(n){ return '<i class="fi fi-sr-' + n + '"></i>'; }

var T = { TOUT:"Tout afficher", REPLIER:"Replier",
          COMM:"Communautés", BANDES:"Bandes et réseaux" };

/* ===================== PASTILLES ===================== */

/* Une famille de portées, repliée à une ligne, dépliable par son bouton +.
   `sel` est un simple tableau de noms, muté sur place par brancherChips. */
function groupe(titre, cle, liste, sel){
  var e = V().esc;
  return '<div class="tdlev-grp"><div class="tdlev-grp-h"><b>' + e(titre) + '</b><i></i>'
    + '<button type="button" class="tdlev-plus" data-plus="' + cle + '" aria-expanded="false"'
    + ' title="' + T.TOUT + '">' + fit("plus-small") + '</button></div>'
    + '<div class="tdlev-chips est-replie" id="tdlev-chips-' + cle + '">'
    + liste.map(function(p){
        return '<button type="button" class="tdlev-chip" data-grp="' + cle + '"'
          + ' data-portee="' + e(p) + '" aria-pressed="' + (sel.indexOf(p) > -1) + '">'
          + e(p) + '</button>';
      }).join("") + '</div></div>';
}

/* Les deux familles d'un coup, avec l'aperçu du repli si on le demande. */
function portees(cles, sel, avecApercu, libelle){
  var h = groupe(T.COMM, cles[0], V().COMMUNAUTES, sel)
        + groupe(T.BANDES, cles[1], V().BANDES, sel);
  if (avecApercu) h += '<p class="tdlev-apercu"><b>' + V().esc(libelle || "Affiché sur la fiche")
    + '</b><span data-apercu="' + cles[0] + '">' + V().esc(apercu(sel)) + '</span></p>';
  return h;
}

function brancherChips(racine, etats){
  racine.querySelectorAll("[data-portee]").forEach(function(b){
    b.addEventListener("click", function(){
      var sel = etats[b.dataset.grp]; if (!sel) return;
      var p = b.dataset.portee, i = sel.indexOf(p);
      if (i > -1) sel.splice(i, 1); else sel.push(p);
      b.setAttribute("aria-pressed", i > -1 ? "false" : "true");
      var a = racine.querySelector('[data-apercu="' + b.dataset.grp + '"]')
           || racine.querySelector("[data-apercu]");
      if (a) a.textContent = apercu(sel);
    });
  });
  racine.querySelectorAll("[data-plus]").forEach(function(b){
    b.addEventListener("click", function(){
      var boite = document.getElementById("tdlev-chips-" + b.dataset.plus);
      if (!boite) return;
      var replie = boite.classList.toggle("est-replie");
      b.setAttribute("aria-expanded", replie ? "false" : "true");
      b.innerHTML = replie ? fit("plus-small") : fit("minus-small");
      b.title = replie ? T.TOUT : T.REPLIER;
    });
  });
}

/* Repli par famille : moins de trois, on nomme ; au-delà, on replie.
   Les deux familles se juxtaposent — « Goulipiats · Plusieurs bandes ». */
function apercu(sel){
  function replier(fam, pluriel){
    var pris = fam.filter(function(x){ return sel.indexOf(x) > -1; });
    if (!pris.length) return "";
    return pris.length >= 3 ? pluriel : pris.join(", ");
  }
  var b = [ replier(V().COMMUNAUTES, V().TEXTES.PLUS_COMM),
            replier(V().BANDES, V().TEXTES.PLUS_BANDES) ].filter(Boolean);
  return b.length ? b.join(" · ") : V().TEXTES.TOUTE;
}

/* ===================== CHAMPS ===================== */

function champ(lib, aide, corps){
  return '<div class="tdlev-champ"><label>' + V().esc(lib)
    + (aide ? '<span class="tdlev-aide">' + aide + '</span>' : '')
    + '</label>' + corps + '</div>';
}
function texte(id, valeur, place){
  return '<input type="text" id="' + id + '" value="' + V().esc(valeur || "") + '"'
    + (place ? ' placeholder="' + V().esc(place) + '"' : '') + '>';
}
function zone(id, valeur){
  return '<textarea id="' + id + '">' + V().esc(valeur || "") + '</textarea>';
}
function choix(id, liste, courant){
  return '<select id="' + id + '"><option value="">—</option>'
    + liste.map(function(x){
        var v = (typeof x === "string") ? x : x.v, l = (typeof x === "string") ? x : x.l;
        return '<option value="' + V().esc(v) + '"' + (courant === v ? " selected" : "") + '>'
          + V().esc(l) + '</option>';
      }).join("") + '</select>';
}
function radios(nom, liste, courant){
  return liste.map(function(r){
    return '<label class="tdlev-radio"><input type="radio" name="' + nom + '" value="' + r[0] + '"'
      + (courant === r[0] ? " checked" : "") + '>'
      + '<span><b>' + V().esc(r[1]) + '</b>'
      + (r[2] ? '<span>' + V().esc(r[2]) + '</span>' : '') + '</span></label>';
  }).join("");
}

function val(id){ var n = document.getElementById(id); return n ? String(n.value || "").trim() : ""; }
function coche(id){ var n = document.getElementById(id); return !!(n && n.checked); }
function lignes(id){
  return val(id).split("\n").map(function(x){ return x.trim(); }).filter(Boolean);
}
/* Un tableau de noms devient le nœud à clés attendu par le contrat. */
function versNoeud(liste){
  var o = {};
  (liste || []).forEach(function(n){ o[V().cle(n)] = { nom:n }; });
  return o;
}

/* ===================== SORTIES ===================== */

function toast(txt){
  try { if (window.EcoCore && window.EcoCore.toast){ window.EcoCore.toast(txt); return; } } catch(e){}
  try { window.alert(txt); } catch(e){}
}
function notifier(pseudo, code, data){
  try { if (window.EcoNotif && window.EcoNotif.a) window.EcoNotif.a(pseudo, code, data || {}); }
  catch(e){}
}
function notifierStaff(code, data){
  try { if (window.EcoNotif && window.EcoNotif.staff) window.EcoNotif.staff(code, data || {}); }
  catch(e){}
}
/* [MAJ] ForumActif : window.open, jamais location.href ni ancre nue. */
function ouvrirLien(url){
  if (!url) return;
  try { window.open(url, "_blank"); } catch(e){}
}

window.TDLEvUI = {
  fit:fit, fis:fis,
  groupe:groupe, portees:portees, brancherChips:brancherChips, apercu:apercu,
  champ:champ, texte:texte, zone:zone, choix:choix, radios:radios,
  val:val, coche:coche, lignes:lignes, versNoeud:versNoeud,
  toast:toast, notifier:notifier, notifierStaff:notifierStaff, ouvrirLien:ouvrirLien
};

})();
