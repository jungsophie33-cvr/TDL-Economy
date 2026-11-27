/* ==================================================================
   THE DROWNED LANDS — PANNEAU DES ENQUÊTES · FICHIER 2/4 : DATA
   ------------------------------------------------------------------
   Utilitaires, lecture bi-schéma (v1 tableaux / v2 nœuds à clés),
   plan de migration v1 → v2, normalisation, sérialisation, et le
   couple générateur / parseur des archives (markdown Sophie-OS).
   Aucun texte utilisateur ici : tout vient de TDLE_CFG.
   ================================================================== */
(function(){
"use strict";

var CFG = window.TDLE_CFG, K = CFG.ARCHIVE.cle;
var D = {};

/* ===================== UTILS ===================== */
D.esc = function(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); };
/* échappement complet d'attribut : & < > " et ' (l'ancienne version
   n'échappait que les guillemets, fragile en convention de livraison) */
D.escAttr = function(s){ return D.esc(s).replace(/"/g,"&quot;").replace(/'/g,"&#39;"); };
D.typeLabel = function(id){ for(var i=0;i<CFG.TYPES.length;i++){ if(CFG.TYPES[i].id===id) return CFG.TYPES[i].label; } return id; };
D.formatFR = function(iso){ if(!iso) return "—"; var p=iso.split("-").map(Number); if(!p[0]) return "—"; return p[2]+" "+CFG.MOIS[p[1]-1]+" "+p[0]; };
D.nowFR = function(){ var d=new Date(); return d.getDate()+" "+CFG.MOIS[d.getMonth()]+" "+d.getFullYear(); };
D.newId = function(){ return "e"+Date.now().toString(36)+Math.random().toString(36).slice(2,7); };
D.cle = function(){ return window.TDLBase.nouvelleCle(); };
D.cp = function(p){ return window.TDLBase.clePseudo(p); };
D.pad2 = function(n){ return String(n).padStart(2,"0"); };
D.cleanTitre = function(s){
  var t=(s.titre&&!/^t\d+-/i.test(s.titre))?s.titre:(s.titre||(s.url||"").split("/").pop()||"");
  t=t.replace(/^t\d+-/i,"").replace(/[-_]/g," ").trim();
  return t?t.charAt(0).toUpperCase()+t.slice(1):"(sujet)";
};
/* Comptes de service : le pseudo FA réel reste en base, seul l'affichage change */
D.nomAffiche = function(n){
  var k=String(n||"").trim().toLowerCase().replace(/\s+/g," ");
  return CFG.ALIAS_AUTEUR[k]||n;
};

/* ===================== IDENTITÉ (convention du pont) =====================
   Un invité Forumactif porte username "Anonymous" et user_id -1 : tout
   résolveur de pseudo doit filtrer ces deux valeurs. */
D.isStaff = function(){ try{ return typeof _userdata!=="undefined"&&(_userdata.user_level===1||_userdata.user_level===2); }catch(e){ return false; } };
D.estMembre = function(){ try{ return typeof _userdata!=="undefined"&&parseInt(_userdata.user_id,10)>0; }catch(e){ return false; } };
D.myPseudo = function(){
  try{
    if(typeof _userdata==="undefined") return null;
    var u=String(_userdata.username||"").trim();
    if(!u||u==="Anonymous") return null;
    if(parseInt(_userdata.user_id,10)<=0) return null;
    return u;
  }catch(e){ return null; }
};

/* ===================== LECTURE BI-SCHÉMA =====================
   Une liste arrive en v2 (objet à clés) ou v1 (tableau). On rend toujours
   [{k, …champs}] ; k vaut null pour une entrée v1 : sans clé, pas
   d'écriture ciblée possible (garde anti-nœud bâtard). */
D.lst = function(v, conv){
  if(v==null) return [];
  if(Array.isArray(v)){
    var o=[];
    v.forEach(function(x){ if(x==null)return; var r=conv(x); if(r){r.k=null;o.push(r);} });
    return o;
  }
  if(typeof v!=="object") return [];
  return Object.keys(v).sort().map(function(k){
    var x=v[k]; if(x==null) return null;
    var r=conv(x); if(!r) return null; r.k=k; return r;
  }).filter(Boolean);
};
D.luTxt = function(x){
  if(typeof x==="string") return {txt:x, par:"", date:""};
  return {txt:(x&&x.txt)||"", par:(x&&x.par)||"", date:(x&&x.date)||""};
};
D.luChrono = function(x){
  if(Array.isArray(x)) return {par:x[0]||"", dateRp:x[1]||"", txt:x[2]||""};
  return {par:(x&&x.par)||"", dateRp:(x&&x.dateRp)||"", txt:(x&&x.txt)||""};
};
D.luPersonne = function(x){
  if(Array.isArray(x)) return {nom:x[0]||"", role:x[1]||""};
  return {nom:(x&&x.nom)||"", role:(x&&x.role)||""};
};
D.luSujet = function(x){
  if(!x||!x.url) return null;
  var m=x.membres, out=[];
  if(Array.isArray(m)) m.forEach(function(p){ if(p)out.push(String(p)); });
  else if(m&&typeof m==="object") Object.keys(m).forEach(function(k){ out.push(String(m[k]||k)); });
  return {url:x.url, titre:x.titre||"", membres:out};
};
D.lstPseudos = function(v){
  if(v==null) return [];
  if(Array.isArray(v)) return v.filter(Boolean).map(String);
  if(typeof v!=="object") return [];
  return Object.keys(v).map(function(k){ return String(v[k]||k); });
};
D.lstRefs = function(v){
  if(v==null) return [];
  if(Array.isArray(v)) return v.filter(Boolean).map(function(l){
    return Array.isArray(l)?{k:l[0],note:l[1]||"",par:""}:{k:l.id,note:l.note||"",par:l.par||""};
  }).filter(function(l){ return !!l.k; });
  if(typeof v!=="object") return [];
  return Object.keys(v).map(function(k){ var x=v[k]||{}; return {k:k,note:x.note||"",par:x.par||""}; });
};

/* ===================== PLAN DE MIGRATION v1 → v2 ===================== */
function mTxt(x){ var o=D.luTxt(x), t=String(o.txt||"").trim(); if(!t) return null;
  var r={txt:t}; if(o.par)r.par=o.par; if(o.date)r.date=o.date; return r; }
function mRole(x){ var o=mTxt(x); return (o&&o.txt!=="—")?o:null; }
function mChrono(x){ var o=D.luChrono(x); return o.txt?o:null; }
function mPersonne(x){ var o=D.luPersonne(x); return o.nom?o:null; }
function mSujet(x){
  var o=D.luSujet(x); if(!o) return null;
  var m={}; o.membres.forEach(function(p){ m[D.cp(p)]=p; });
  var r={url:o.url, titre:o.titre};
  if(Object.keys(m).length) r.membres=m;
  return r;
}
D.PLAN = {
  elements:         {conv:mTxt},
  particularites:   {conv:mTxt},
  folklore:         {conv:mTxt},
  roles:            {conv:mRole},
  chrono:           {conv:mChrono},
  personnes:        {conv:mPersonne},
  sujets:           {conv:mSujet},
  valides:          {mode:"pseudo", conv:function(x){ return x?String(x):null; }},
  demandesReferent: {mode:"pseudo", conv:function(x){ return x?String(x):null; }},
  liens:            {mode:"ref", cle:function(x){ return Array.isArray(x)?x[0]:(x&&x.id); },
                     conv:function(x){ return {note:(x&&x.note)||""}; }},
  demandesLien:     {mode:"ref", cle:function(x){ return Array.isArray(x)?x[0]:(x&&x.id); },
                     conv:function(x){ return {note:(x&&x.note)||"", par:(x&&x.par)||""}; }}
};

/* ===================== NORMALISATION =====================
   Une affaire vit en base (live) ou vient d'un post d'archive (archive:true,
   figée, en lecture seule). Même format de sortie pour le rendu. */
D.normaliser = function(o){
  o.type=o.type||"FP"; o.dateISO=o.dateISO||"";
  o.intrigue=!!o.intrigue; o.coldcase=!!o.coldcase; o.cloturee=!!o.cloturee;
  o.bonusVerse=!!o.bonusVerse; o.demandeCloture=!!o.demandeCloture;
  o.verses=o.verses||{};                        /* carte idempotence des bonus */
  o.referent=o.referent||null; o.enqueteur=o.enqueteur||"—";
  o.titre=o.titre||"Affaire"; o.victime=o.victime||"—"; o.lieu=o.lieu||"—";
  o.synthese=o.synthese||""; o.statutTxt=o.statutTxt||""; o.rp=o.rp||"";
  o.schema=(o.schema===CFG.SCHEMA)?CFG.SCHEMA:1;
  if(o.archive){ o.schema=CFG.SCHEMA; o.cloturee=true; }
  o.particularites=D.lst(o.particularites,D.luTxt);
  o.elements=D.lst(o.elements,D.luTxt);
  o.folklore=D.lst(o.folklore,D.luTxt);
  o.roles=D.lst(o.roles,D.luTxt).filter(function(r){ return r.txt&&r.txt!=="—"; });
  o.valides=D.lstPseudos(o.valides); o.demandesReferent=D.lstPseudos(o.demandesReferent);
  o.chrono=D.lst(o.chrono,D.luChrono);
  o.personnes=D.lst(o.personnes,D.luPersonne);
  o.sujets=D.lst(o.sujets,D.luSujet);
  o.liens=D.lstRefs(o.liens); o.demandesLien=D.lstRefs(o.demandesLien);
  return o;
};
/* objet à écrire (jamais la cote calculée, jamais le fanion d'archive) */
D.serialize = function(a){
  var o={};
  for(var k in a){ if(a.hasOwnProperty(k)&&k!=="cote"&&k!=="archive"&&k!=="aArchive") o[k]=a[k]; }
  return o;
};

/* ===================== ARCHIVES : GÉNÉRATEUR =====================
   Post au markdown maison, grammaire Sophie-OS : === PANNEAU: … === ouvre,
   --- BLOC enquete --- porte tout le contenu en CLÉ: valeur, === FIN ===
   referme. Les sections listes s'écrivent sous leur clé, une entrée par
   ligne ; les entrées composées utilisent " :: " comme séparateur. */
function l(v){ return String(v==null?"":v); }
D.markdownAffaire = function(a){
  var L=[], i;
  L.push("=== PANNEAU: "+CFG.ARCHIVE.prefixPanneau+" "+a.cote+" ===");
  L.push("--- BLOC "+CFG.ARCHIVE.bloc+" ---");
  L.push(K.cote+": "+a.cote);
  L.push(K.titre+": "+l(a.titre));
  L.push(K.type+": "+l(a.type));
  L.push(K.ouverture+": "+l(a.dateISO));
  L.push(K.lieu+": "+l(a.lieu));
  L.push(K.victime+": "+l(a.victime));
  L.push(K.enqueteur+": "+l(a.enqueteur));
  L.push(K.referent+": "+l(a.referent||"—"));
  L.push(K.synthese+": "+l(a.synthese));
  L.push(K.statut+": "+l(a.statutTxt));
  L.push(K.rp+": "+(a.intrigue?"(intrigue staff)":l(a.rp)));
  var bloc=function(cle, arr, fmt){
    if(!arr.length) return;
    L.push(cle+":");
    arr.forEach(function(e){ L.push((CFG.ARCHIVE.puce||"- ")+fmt(e)); });
  };
  bloc(K.particularites, a.particularites, function(e){ return l(e.txt)+(e.par?" (par "+l(D.nomAffiche(e.par))+")":""); });
  bloc(K.elements, a.elements, function(e){ return l(e.txt)+(e.par?" (par "+l(D.nomAffiche(e.par))+")":""); });
  bloc(K.folklore, a.folklore, function(e){ return l(e.txt); });
  bloc(K.roles, a.roles, function(e){ return l(e.txt); });
  bloc(K.chrono, a.chrono, function(e){ return l(e.dateRp)+" :: par "+l(D.nomAffiche(e.par))+" :: "+l(e.txt); });
  bloc(K.personnes, a.personnes, function(e){ return l(e.nom)+" :: "+l(e.role); });
  bloc(K.valides, a.valides, function(e){ return l(e); });
  bloc(K.sujets, a.sujets, function(e){ return l(e.url)+" :: "+e.membres.join(", "); });
  bloc(K.liens, a.liens, function(e){ return l(e.k)+" :: "+l(e.note); });
  L.push("=== FIN ===");
  return L.join("\n");
};

/* ===================== ARCHIVES : PARSEUR =====================
   Méthode Sophie-OS : partir du innerHTML normalisé en \n (jamais
   textContent, qui aplatit les <br> sans retours). Rend une affaire
   normalisée {archive:true} ou null si le texte n'est pas une archive. */
D.normaliserHTML = function(html){
  return String(html||"").replace(/\r\n?/g,"\n")
    /* FA transforme toute URL du post en <a href="…">…</a> : on déroule
       l'ancre — si le texte visible est l'URL (autolien), on garde le href
       (propre, sans markup) ; sinon on garde le texte. Sans ça, la clé
       SUJETS se retrouve polluée par le HTML et le titre extrait cassé. */
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, function(m,href,txt){
      return /^\s*https?:\/\//.test(txt)?href:txt;
    })
    .replace(/<\/?(?:a|b|strong|i|em|u|s|span)\b[^>]*>/gi,"")
    .replace(/<br[^>]*>/gi,"\n").replace(/<\/p>/gi,"\n")
    .replace(/<p[^>]*>/gi,"").replace(/<\/div>/gi,"\n");
};
D.parserArchive = function(texte){
  var LISTE={particularites:1,elements:1,folklore:1,roles:1,chrono:1,personnes:1,valides:1,sujets:1,liens:1};
  var lignes=D.normaliserHTML(texte).split("\n"), i, t;
  var reP=new RegExp("^\\s*===\\s*PANNEAU:\\s*"+CFG.ARCHIVE.prefixPanneau+"\\s","i");
  var reB=new RegExp("^\\s*---\\s*BLOC\\s+"+CFG.ARCHIVE.bloc+"\\s*---\\s*$","i");
  var reFin=/^\s*===\s*FIN\s*(===)?\s*$/i;
  var inverse={}, cle;
  for(cle in K){ inverse[K[cle].toUpperCase()]=cle; }
  var dans=false, section=null, o={archive:true, cloturee:true, schema:CFG.SCHEMA,
    verses:{}, demandesReferent:[], demandesLien:[], liens:[],
    particularites:[], elements:[], folklore:[], roles:[], chrono:[], personnes:[], sujets:[], valides:[]};
  var arrLiens=[];
  function pousse(val){
    if(section==="chrono"){ var p=val.split(" :: ");
      o.chrono.push({k:"arch", dateRp:(p[0]||"").trim(), par:(p[1]||"").replace(/^par\s+/i,"").trim(), txt:p.slice(2).join(" :: ").trim()}); }
    else if(section==="personnes"){ var q=val.split(" :: ");
      o.personnes.push({k:"arch", nom:(q[0]||"").trim(), role:q.slice(1).join(" :: ").trim()}); }
    else if(section==="sujets"){ var r=val.split(" :: ");
      o.sujets.push({k:"arch", url:(r[0]||"").trim(), titre:"", membres:(r[1]||"").split(",").map(function(x){return x.trim();}).filter(Boolean)}); }
    else if(section==="liens"){ var s=val.split(" :: ");
      arrLiens.push({k:(s[0]||"").trim(), note:s.slice(1).join(" :: ").trim()}); }
    else if(section==="valides"){ o.valides.push(val.trim()); }
    else if(section==="particularites"||section==="elements"||section==="folklore"||section==="roles"){
      o[section].push({k:"arch", txt:val.trim()}); }
  }
  for(i=0;i<lignes.length;i++){
    t=lignes[i].replace(/^(\s*)\\+/,"$1");   /* tolère l'échappement FA des débuts de ligne (\- , \===) */
    if(!dans){
      if(reB.test(t)) dans=true;
      continue;
    }
    if(reFin.test(t)||t.trim().indexOf("--- BLOC")===0) break;   /* fin du bloc */
    var m=t.match(/^\s*([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9_]*)\s*:\s?(.*)$/);
    var p=t.match(/^\s*[-•]\s+(.*)$/);
    if(p){ if(section) pousse(p[1]); continue; }
    if(m){
      var c=inverse[m[1].toUpperCase()];
      if(c){
        section=c;
        if(LISTE[c]){ o[c]=[]; if(m[2].trim()) pousse(m[2]); }
        else o[c]=m[2].trim();   /* FA laisse des espaces traîner : sans trim, la cote ne matcherait jamais */
        continue;
      }
    }
    /* ligne libre : continuation de la clé multi-ligne courante (scalaires) */
    if(section&&!LISTE[section]&&t.trim()) o[section]=(o[section]?o[section]+"\n":"")+t.trim();
  }
  if(!dans) return null;
  /* clés du post ≠ champs internes : le markdown porte OUVERTURE et
     STATUT, l'affaire vit sur dateISO et statutTxt */
  if(o.ouverture){ o.dateISO=o.ouverture; delete o.ouverture; }
  if(o.statut){ o.statutTxt=o.statut; delete o.statut; }
  /* liens : le parseur rend la forme v2 (objet à clés = id cible) attendue
     par lstRefs, pas un tableau mixte */
  o.liens={};
  arrLiens.forEach(function(e){ if(e.k) o.liens[e.k]={note:e.note}; });
  return D.normaliser(o);
};

window.TDLE_DATA = D;
})();
