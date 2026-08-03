/* ============================================================
   TDL — BOTTIN DES MÉTIERS · actions & interface (3/3)
   Blocs : ACTIONS · EVENTS · INIT
   Requiert tdl-botm-core puis tdl-botm-render (window.BM).
   ============================================================ */
(function(){
"use strict";

let BM, T, S, CFG, $, vt;
function attendreNoyau(n){
  n = n || 0;
  if(window.BM && window.BM.detailHTML){
    BM = window.BM; T = BM.T; S = BM.S; CFG = BM.CFG; $ = BM.$; vt = BM.versTableau;
    demarrer(); return;
  }
  if(n > 40){
    if(window.console) console.error('[TDL bottin] tdl-botm-core.js puis tdl-botm-render.js doivent être chargés avant tdl-botm-ui.js.');
    return;
  }
  setTimeout(function(){ attendreNoyau(n+1); }, 250);
}
const val = id => (($(id)||{}).value||'');
const coche = id => !!(($(id)||{}).checked);
function reset(){ S.inline=null; S.roleEdit=null; S.posteEdit=null; S.confirmDel=null; }

/* ===================== ACTIONS — tags ===================== */
function ajouterTag(id, champ){
  const e = BM.ent(id), v = val('bm-tagin').trim();
  if(!v) return;
  const arr = vt(e[champ]).slice(); arr.push(v);
  const o = {}; o[champ] = arr;
  BM.patch(e,o).then(()=>{ S.inline=null; BM.renderDetail(); BM.toast(T.okTag); }).catch(()=>{});
}
function retirerTag(id, champ, i){
  const e = BM.ent(id), arr = vt(e[champ]).slice(); arr.splice(i,1);
  const o = {}; o[champ] = arr;
  BM.patch(e,o).then(()=>BM.renderDetail()).catch(()=>{});
}

/* ===================== ACTIONS — rôles & postes ===================== */
function enregistrerRole(id, i){
  const e = BM.ent(id), n = val('bm-rnom').trim();
  if(!n){ BM.toast(T.errNom, true); return; }
  /* pas de champ avatar : il est résolu à la lecture depuis le bottin des avatars */
  const r = {nom:n, poste:val('bm-rposte').trim(), depuis:val('bm-rdepuis').trim(),
    type:val('bm-rtype')||'pj', lien:val('bm-rlien').trim(), dir:coche('bm-rdir')};
  /* uid : identité stable d'un compte joué. Capté depuis le lien saisi ou la
     carte faceclaim ; c'est lui qui permettra à la suppression d'un membre de
     libérer son poste. Sans objet pour un PNJ ou un pré-lien. */
  const uid = BM.uidDe(r);
  if(uid != null) r.uid = uid;
  const arr = vt(e.roles).slice();
  if(i>=0) arr[i]=r; else arr.push(r);
  BM.patch(e,{roles:arr}).then(()=>{ S.roleEdit=null; BM.renderDetail(); BM.toast(T.okRole); }).catch(()=>{});
}
function retirerRole(id, i){
  const e = BM.ent(id), arr = vt(e.roles).slice(); arr.splice(i,1);
  BM.patch(e,{roles:arr}).then(()=>{ BM.renderDetail(); BM.toast(T.okRoleDel); }).catch(()=>{});
}
function enregistrerPoste(id, i){
  const e = BM.ent(id), t = val('bm-pt').trim();
  if(!t){ BM.toast(T.errPoste, true); return; }
  const p = {t:t, c:val('bm-pc').trim(), ic:val('bm-pic').trim()||'fi-tr-briefcase',
    dir:coche('bm-pdir'), n:Math.max(1,Number(val('bm-pn'))||1), d:val('bm-pd').trim()};
  const arr = vt(e.postes).slice();
  if(i>=0) arr[i]=p; else arr.push(p);
  BM.patch(e,{postes:arr}).then(()=>{ S.posteEdit=null; BM.renderDetail(); BM.toast(T.okPoste); }).catch(()=>{});
}
function retirerPoste(id, i){
  const e = BM.ent(id), arr = vt(e.postes).slice(); arr.splice(i,1);
  BM.patch(e,{postes:arr}).then(()=>BM.renderDetail()).catch(()=>{});
}

/* ===================== ACTIONS — fiche ===================== */
function ouvrirEdition(id){ S.draft = BM.clone(BM.ent(id)); S.mode='edition'; BM.renderDetail(true); }
function ouvrirNouveau(){
  S.draft = {id:'lieu_'+Date.now().toString(36), nom:'', type:'', rue:'—',
    zone:S.zone, cat:(S.cat!=='tous'?S.cat:'services'), ic:'', img:'', facs:[], emploi:true, amb:'—',
    effectif:'', fondee:'', rayonnement:'', desc:'', accroche:'',
    culture:[], partenaires:[], rivaux:[], verrou:false, complet:false, referent:null, brouillon:false,
    roles:[], postes:[]};
  S.mode='nouveau'; S.vue='panneau'; S.mob='detail'; BM.renderBarre(); BM.renderStage(true);
}
function lireFormulaire(d){
  d.nom = val('bm-f-nom').trim(); d.zone = val('bm-f-zone'); d.cat = val('bm-f-cat');
  d.type = val('bm-f-type').trim(); d.ic = val('bm-f-ic').trim();
  d.rue = val('bm-f-rue').trim()||'—'; d.img = val('bm-f-img').trim();
  d.amb = val('bm-f-amb').trim()||'—';
  d.effectif = val('bm-f-eff').trim(); d.fondee = val('bm-f-fond').trim();
  d.rayonnement = val('bm-f-ray').trim();
  d.desc = val('bm-f-desc').trim(); d.accroche = val('bm-f-accroche').trim();
  d.complet = coche('bm-f-complet');
  if($('bm-f-verrou')) d.verrou = coche('bm-f-verrou');
  if($('bm-f-ref')) d.referent = val('bm-f-ref').trim()||null;
  return d;
}
function enregistrer(){
  const d = lireFormulaire(S.draft);
  if(!d.nom){ BM.toast(T.errNom, true); return; }
  const neuf = S.mode==='nouveau';
  const fin = ()=>{
    S.mode='lecture'; S.sel=d.id; S.zone=d.zone; S.draft=null;
    BM.renderZones(); BM.renderBarre(); BM.renderStage(true); BM.toast(T.okSave);
  };
  if(neuf){
    /* créer ici crée AUSSI le lieu dans le Répertoire des lieux */
    BM.creerEntreprise(d).then(()=>{ BM.E.push(d); fin(); })
      .catch(err=>BM.toast(T.errSave+((err&&err.message)||err), true));
  } else {
    const e = BM.ent(d.id), champs = {};
    Object.keys(d).forEach(k=>{ if(k!=='id') champs[k]=d[k]; });
    BM.patch(e, champs).then(fin).catch(()=>{});
  }
}
function publier(id){
  const e = BM.ent(id);
  BM.patch(e,{brouillon:false}).then(()=>{ BM.renderStage(); BM.toast(e.nom+T.okPublie); }).catch(()=>{});
}
function retirer(id){
  const e = BM.ent(id), nom = e.nom;
  BM.retirerDuBottin(e).then(()=>{
    const i = BM.E.indexOf(e); if(i>=0) BM.E.splice(i,1);
    if(S.sel===id) S.sel=null;
    S.confirmDel=null; S.mob='liste';
    BM.renderBarre(); BM.renderStage(true); BM.toast(nom+T.okRetire);
  }).catch(err=>BM.toast(T.errSave+((err&&err.message)||err), true));
}

/* ===================== EVENTS ===================== */
function actionDo(d){
  const k = d.dataset.do, id = d.dataset.id, i = Number(d.dataset.i);
  if(k==='retour'){ S.mob='liste'; BM.renderStage(); return; }
  if(k==='cancel'){
    if(S.mode==='edition'||S.mode==='nouveau'){ S.mode='lecture'; S.draft=null; }
    reset(); BM.renderDetail(); return;
  }
  if(k==='tagok')   return ajouterTag(id, d.dataset.champ);
  if(k==='roleok')  return enregistrerRole(id, i);
  if(k==='posteok') return enregistrerPoste(id, i);
  if(k==='togroles'){ S.editRoles=!S.editRoles; S.roleEdit=null; BM.renderDetail(); return; }
  if(k==='togpostes'){ S.editPostes=!S.editPostes; S.posteEdit=null; BM.renderDetail(); return; }
  if(k==='voir'){
    const dej = S.ouvertPoste && S.ouvertPoste.id===id && S.ouvertPoste.i===i;
    S.ouvertPoste = dej?null:{id:id,i:i}; BM.renderDetail(); return;
  }
  if(k==='plusroles'){ S.plusRoles=true; BM.renderDetail(); return; }
  if(k==='moinsroles'){ S.plusRoles=false; BM.renderDetail(); return; }
  if(k==='pluspostes'){ S.plusPostes=true; BM.renderDetail(); return; }
  if(k==='moinspostes'){ S.plusPostes=false; BM.renderDetail(); return; }
  if(k==='edit')    return ouvrirEdition(id);
  if(k==='saveok')  return enregistrer();
  if(k==='publier') return publier(id);
  if(k==='del'){ S.confirmDel=id; BM.renderDetail(); return; }
  if(k==='delok')   return retirer(id);
}
function brancherBarres(){
  $('bm-zones').addEventListener('click', ev=>{
    const b = ev.target.closest('[data-z]'); if(!b) return;
    S.zone=b.dataset.z; S.sel=null; S.mode='lecture'; S.mob='liste'; reset();
    BM.renderZones(); BM.renderBarre(); BM.renderStage(true);
  });
  $('bm-vue').addEventListener('click', ev=>{
    const b = ev.target.closest('[data-v]'); if(!b) return;
    S.vue=b.dataset.v; BM.renderBarre(); BM.renderStage();
  });
  const add = $('bm-add'); if(add) add.addEventListener('click', ouvrirNouveau);
}
function brancherScene(){
  $('bm-stage').addEventListener('click', ev=>{
    const cat = ev.target.closest('[data-c]');
    if(cat && !cat.disabled){ S.cat=cat.dataset.c; S.sel=null; reset(); BM.renderBarre(); BM.renderStage(true); return; }
    if(ev.target.closest('.bm-plink')) return;   /* laisser le lien s'ouvrir */

    const rmt = ev.target.closest('[data-rmtag]');
    if(rmt) return retirerTag(rmt.dataset.id, rmt.dataset.rmtag, Number(rmt.dataset.i));
    const rmr = ev.target.closest('[data-rmrole]');
    if(rmr) return retirerRole(rmr.dataset.id, Number(rmr.dataset.rmrole));
    const rmp = ev.target.closest('[data-rmposte]');
    if(rmp) return retirerPoste(rmp.dataset.id, Number(rmp.dataset.rmposte));

    const add = ev.target.closest('[data-add]');
    if(add){
      const k = add.dataset.add;
      if(k==='role'){ S.posteEdit=null; S.roleEdit={id:add.dataset.id,i:-1}; BM.renderDetail(); return; }
      if(k==='poste'){ S.roleEdit=null; S.posteEdit={id:add.dataset.id,i:-1}; BM.renderDetail(); return; }
      S.inline={champ:k,id:add.dataset.id}; BM.renderDetail(); return;
    }

    const d = ev.target.closest('[data-do]');
    if(d) return actionDo(d);

    const er = ev.target.closest('[data-editrole]');
    if(er){ S.posteEdit=null; S.roleEdit={id:er.dataset.id,i:Number(er.dataset.editrole)}; BM.renderDetail(); return; }
    const ep = ev.target.closest('[data-editposte]');
    if(ep){ S.roleEdit=null; S.posteEdit={id:ep.dataset.id,i:Number(ep.dataset.editposte)}; BM.renderDetail(); return; }

    const open = ev.target.closest('[data-open]');
    if(open){
      S.sel=open.dataset.open; S.mode='lecture'; S.plusRoles=false; S.plusPostes=false;
      S.ouvertPoste=null; S.editRoles=false; S.editPostes=false; reset();
      if(S.vue==='mur'){ S.vue='panneau'; BM.renderBarre(); }
      S.mob='detail'; BM.renderStage(true);
    }
  });
  $('bm-stage').addEventListener('input', ev=>{
    if(ev.target.id!=='bm-f-img') return;
    const p = $('bm-imgprev'), u = ev.target.value.trim();
    if(!p) return;
    if(u){ p.style.display='block'; p.style.backgroundImage = "url('"+u.replace(/'/g,'%27')+"')"; }
    else p.style.display='none';
  });
}

/* ===================== INIT ===================== */
function contexteUtilisateur(){
  const u = window._userdata || {};
  S.admin = CFG.FORCER_ADMIN || u.user_level===1 || u.user_level===2;
  S.moi = u.username || '';
  document.body.classList.toggle('bm-body-admin', S.admin);
}
/* ancre #bm-<id> : arrivée depuis le Répertoire des lieux */
function lireAncre(){
  const m = /^#bm-(.+)$/.exec(window.location.hash||'');
  if(!m) return;
  const e = BM.ent(m[1]); if(!e) return;
  S.sel = e.id; S.zone = e.zone; S.cat = 'tous'; S.vue = 'panneau'; S.mob = 'detail';
}
function init(){
  if(BM.demarre) return;
  if(!$('bm-stage') || !$('bm-zones')) return;      /* structure absente → on sort */
  BM.ZC = window.TDLZonesCats;
  if(!BM.ZC){
    $('bm-stage').innerHTML = '<div class="bm-erreur">'+T.errCfg+'</div>';
    if(window.console) console.error('[TDL bottin] '+T.errCfg);
    BM.demarre = true; return;
  }
  BM.demarre = true;
  BM.ZONES = BM.ZC.ZONES; BM.CATS = BM.ZC.CATS;
  /* sort l'overlay du contexte du forum : évite qu'un ancêtre ne piège le position:fixed */
  const rep = document.querySelector('.bm-rep');
  if(rep && rep.parentNode!==document.body) document.body.appendChild(rep);
  contexteUtilisateur();
  const home = $('bm-home'); if(home) home.setAttribute('href', CFG.HREF_ACCUEIL);
  const ed = $('bm-edit');   if(ed)   ed.setAttribute('href', CFG.EDIT_URL);
  brancherBarres(); brancherScene(); BM.renderZones();
  BM.charger(()=>{
    S.vue = 'mur';        /* l'ouverture se fait toujours sur le mur */
    lireAncre();
    BM.renderZones(); BM.renderBarre(); BM.renderStage();
  });
}
/* la structure peut être injectée après le load (template FA) → on attend */
function demarrer(){
  (function attendreDOM(n){
    n = n || 0;
    if($('bm-stage')){ init(); return; }
    if(n > 60) return;
    setTimeout(()=>attendreDOM(n+1), 250);
  })();
  window.addEventListener('load', init);
}
attendreNoyau();

})();
