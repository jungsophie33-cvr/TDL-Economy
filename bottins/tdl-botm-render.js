/* ============================================================
   TDL — BOTTIN DES MÉTIERS · rendu (2/3)
   Blocs : BARRES · SCÈNE · DÉTAIL · BLOCS · FORMULAIRES
   Requiert eco-bottin-core (window.BM). Complété par eco-bottin-ui.
   ============================================================ */
(function(){
"use strict";
const BM = window.BM;
if(!BM){ if(window.console) console.error('[TDL bottin] eco-bottin-core doit être chargé avant.'); return; }
const T = BM.T, S = BM.S, CFG = BM.CFG, $ = BM.$, esc = BM.esc, icone = BM.icone, vt = BM.versTableau;

/* ===================== BARRES ===================== */
BM.renderZones = function(){
  $('bm-zones').innerHTML = BM.ZONES.map(z=>
    '<button role="tab" data-z="'+z.id+'" aria-selected="'+(S.zone===z.id)+'">'+esc(z.titre)+'</button>').join('');
};
BM.renderBarre = function(){
  $('bm-compteur').textContent = BM.baseZone().length;
  $('bm-vue').querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected', b.dataset.v===S.vue));
};
BM.renderCats = function(ligne){
  const items = [{id:'tous',label:'Tous',ic:'fi-tr-marker',c:'var(--dark)'}].concat(BM.CATS);
  return '<div class="bm-catcol'+(ligne?' bm-ligne':'')+'" role="tablist">'+items.map(c=>{
    const off = c.id!=='tous' && !BM.catActive(c.id);
    return '<button class="bm-cat" data-c="'+c.id+'" role="tab" aria-selected="'+(S.cat===c.id)+'" style="--c:'+c.c+'"'+(off?' disabled':'')+'>'
      +'<span class="bm-ci"><i class="fi '+c.ic+'"></i></span><span class="bm-cl">'+esc(c.label)+'</span></button>';
  }).join('')+'</div>';
};
BM.pastille = function(e){
  if(BM.directionLibre(e)) return '<span class="bm-dot libre" title="'+T.legDir+'"></span>';
  if(BM.estComplet(e)) return '<span class="bm-dot complet" title="'+T.legComplet+'"></span>';
  return '';
};

/* ===================== SCÈNE ===================== */
function vueMur(){
  const d = BM.filtre();
  if(!d.length) return '<div class="bm-boardwrap">'+BM.renderCats(true)+'<div class="bm-empty">'+T.aucune+'</div></div>';
  const cartes = d.map(e=>{
    const n = BM.libres(e);
    return '<article class="bm-fc" data-open="'+e.id+'">'
      +'<div class="bm-fc-top"><span class="bm-cote">'+esc(BM.ZC.labelCat(e.cat))+'</span>'
      +(e.brouillon?'<span class="bm-stamp" style="--sc:var(--clair2)">'+T.brouillon+'</span>':'')+'</div>'
      +'<span class="bm-nom">'+esc(e.nom)+'</span>'
      +'<div class="bm-fc-sec">'+esc(e.type||'')+'</div>'
      +'<div class="bm-fc-foot">'+(BM.pastille(e)||'<span></span>')
      +'<span>'+(n?n+' rôle'+(n>1?'s':'')+' libre'+(n>1?'s':''):T.complet)+'</span></div>'
      +'</article>';
  }).join('');
  return '<div class="bm-boardwrap">'+BM.renderCats(true)
    +'<div class="bm-boardscroll"><div class="bm-board">'+cartes+'</div></div></div>';
}
function vuePanneau(){
  const d = BM.filtre();
  const rows = d.length ? d.map(e=>{
    const c = BM.ZC.cat(e.cat) || {};
    return '<div class="bm-row" data-open="'+e.id+'" aria-current="'+(S.sel===e.id)+'" style="--c:'
      +(c.c||'var(--dark)')+';--soft:'+(c.soft||'var(--cntr2)')+'">'
      +'<span class="bm-ric">'+icone(e.ic)+'</span>'
      +'<span class="bm-rtxt"><span class="bm-rnom">'+esc(e.nom)
        +(e.brouillon?'<span class="bm-exq">'+T.brouillon+'</span>':'')+'</span>'
      +'<span class="bm-rmeta">'+esc(e.type||'')+'</span></span>'
      +BM.pastille(e)+'</div>';
  }).join('') : '<div class="bm-empty">'+T.aucune+'</div>';
  return '<div class="bm-split'+(S.mob==='detail'?' detail':'')+'">'
    +'<div class="bm-idx">'+BM.renderCats(false)+'<div class="bm-list">'+rows+'</div></div>'
    +'<div class="bm-panneau" id="bm-detail"></div></div>';
}
BM.renderStage = function(reset){
  const m = BM.memScroll();
  $('bm-stage').innerHTML = (S.vue==='mur') ? vueMur() : vuePanneau();
  if(S.vue==='panneau') BM.detailHTML();
  BM.poseScroll(m, !!reset);
};
BM.renderDetail = function(reset){
  const m = BM.memScroll();
  BM.detailHTML();
  BM.poseScroll(m, !!reset);
};

/* ===================== DÉTAIL ===================== */
BM.detailHTML = function(){
  const el = $('bm-detail'); if(!el) return;
  const retour = '<button class="bm-retour" data-do="retour">'+T.retour+'</button>';
  if(S.mode==='edition'||S.mode==='nouveau'){ el.innerHTML = retour + formEntreprise(); return; }
  const e = BM.ent(S.sel);
  if(!e){ el.innerHTML = retour + '<div class="bm-empty">'+T.choisir+'</div>'; return; }
  const c = BM.ZC.cat(e.cat) || {}, ed = BM.editable(e);

  const head = '<div class="bm-phead'+(e.img?' bm-img':'')+'"'
    +(e.img?' style="background-image:url(\''+esc(e.img)+'\')"':'')+'>'
    +'<p class="bm-peyebrow">'+esc(BM.ZC.titreZone(e.zone))+' · '+esc(BM.ZC.labelCat(e.cat))+'</p>'
    +'<h2>'+esc(e.nom)+(e.brouillon?'<span class="bm-stamp" style="--sc:var(--clair2)">'+T.brouillon+'</span>':'')+'</h2>'
    +'<p class="bm-pmeta">'+esc(e.type||'')+(e.referent?T.referentPrefixe+esc(e.referent):'')+'</p>'
    +(e.amb&&e.amb!=='—'?'<p class="bm-pamb">'+esc(e.amb)+'</p>':'')
    +'</div>';

  const cles = [
    ['fi-tr-marker','Siège', e.rue],
    ['fi-tr-users-alt','Effectif', e.effectif],
    ['fi-tr-calendar','Fondée', e.fondee],
    ['fi-tr-globe','Rayonnement', e.rayonnement]
  ].map(k=>'<div class="bm-key"><i class="fi '+k[0]+'"></i><b>'+esc(k[1])+'</b><span>'
    +esc(k[2]&&k[2]!=='—'?k[2]:'—')+'</span></div>').join('');

  el.innerHTML = retour
    + '<div class="bm-pbody" style="--c:'+(c.c||'var(--dark)')+';--soft:'+(c.soft||'var(--cntr2)')
      +';--soft40:'+(c.s40||'var(--cntr3)')+'">'
    + head
    + '<div class="bm-pcontent">'
      + '<p class="bm-pdesc">'+esc(e.desc||'')+'</p>'
      + '<div class="bm-keybox">'+cles+'</div>'
      + '<div class="bm-ident">'
        + '<div class="bm-ident-cult">'+blocCulture(e,ed)+'</div>'
        + '<div class="bm-ident-rel">'+blocTags(e,'partenaires',T.partenaires,ed)
          +blocTags(e,'rivaux',T.tensions,ed)+'</div>'
      + '</div>'
      + '<div class="bm-cols">'
        + '<div class="'+(ed?'bm-adm ':'')+(ed&&S.editRoles?'bm-editon':'')+'">'+blocRoles(e,ed)+'</div>'
        + '<div class="'+(ed?'bm-adm ':'')+(ed&&S.editPostes?'bm-editon':'')+'">'+blocPostes(e,ed)+'</div>'
      + '</div>'
    + '</div>'
    + '</div>'
    + barreActions(e,ed);
};

/* ===================== BLOCS ===================== */
function formTag(e, champ){
  return '<div class="bm-iform"><input type="text" class="lg" id="bm-tagin" placeholder="…">'
    +'<div class="acts"><button class="go" data-do="tagok" data-champ="'+champ+'" data-id="'+e.id+'">'+T.ajouter+'</button>'
    +'<button class="no" data-do="cancel">'+T.annuler+'</button></div></div>';
}
function blocCulture(e, ed){
  const arr = vt(e.culture);
  const add = S.inline && S.inline.champ==='culture' && S.inline.id===e.id;
  let h = '<p class="bm-hsec">'+T.culture
    + (ed?'<button class="bm-mini" data-add="culture" data-id="'+e.id+'" title="Ajouter">+</button>':'') + '</p>';
  if(e.accroche) h += '<p class="bm-accroche">'+esc(e.accroche)+'</p>';
  h += arr.length
    ? '<div class="bm-tags">'+arr.map((t,i)=>'<span class="bm-tag bm-cult">'+esc(t)
        +(ed?'<span class="rm" data-rmtag="culture" data-id="'+e.id+'" data-i="'+i+'">✕</span>':'')+'</span>').join('')+'</div>'
    : '<p class="bm-vide">'+T.nonRenseigne+'</p>';
  if(add) h += formTag(e,'culture');
  return h;
}
function blocTags(e, champ, titre, ed){
  const arr = vt(e[champ]);
  const add = S.inline && S.inline.champ===champ && S.inline.id===e.id;
  let h = '<div><p class="bm-hsec">'+esc(titre)
    + (ed?'<button class="bm-mini" data-add="'+champ+'" data-id="'+e.id+'" title="Ajouter">+</button>':'') + '</p>';
  h += arr.length
    ? '<div class="bm-tags">'+arr.map((t,i)=>'<span class="bm-tag">'+esc(t)
        +(ed?'<span class="rm" data-rmtag="'+champ+'" data-id="'+e.id+'" data-i="'+i+'">✕</span>':'')+'</span>').join('')+'</div>'
    : '<p class="bm-vide">'+T.aucunTag+'</p>';
  if(add) h += formTag(e,champ);
  return h+'</div>';
}
function avatarRole(r){
  return r.avatar
    ? '<span class="bm-pav"><img src="'+esc(r.avatar)+'" alt=""></span>'
    : '<span class="bm-pav">'+esc(BM.ini(r.nom))+'</span>';
}
function tagType(r){
  if(r.type==='pnj') return '<span class="bm-minitag pnj">PNJ</span>';
  if(r.type==='pl')  return '<span class="bm-minitag pl">PL</span>';
  return '';
}
function lienRole(r){
  if(!r.lien) return '';
  const t = r.type==='pl' ? 'Voir la fiche de pré-lien' : 'Voir le profil';
  return '<a class="bm-plink" href="'+esc(r.lien)+'" title="'+t+'" target="_blank" rel="noopener">'
    +'<i class="fi fi-tr-link-alt"></i></a>';
}
function blocRoles(e, ed){
  const all = vt(e.roles).map((r,i)=>({r:r,i:i})).sort((a,b)=>BM.dirDabord(a.r,b.r));
  const open = ed||S.plusRoles, vus = open?all:all.slice(0,CFG.MAX_ROLES);
  const enEdit = S.roleEdit && S.roleEdit.id===e.id;
  let h = '<p class="bm-hsec">'+T.roles+' ('+all.length+')'
    + (ed?'<button class="bm-mini" data-add="role" data-id="'+e.id+'" title="Ajouter un rôle">+</button>'
        +'<button class="bm-mini" data-do="togroles" aria-pressed="'+(S.editRoles?'true':'false')
        +'" title="Modifier les rôles"><i class="fi fi-tr-pencil"></i></button>':'')
    + '</p>';
  if(enEdit && S.roleEdit.i===-1) h += BM.formRole(e, null, -1);
  h += vus.length ? '<ul class="bm-people">'+vus.map(o=>{
      const r=o.r, i=o.i;
      if(enEdit && S.roleEdit.i===i) return '<li>'+BM.formRole(e, r, i)+'</li>';
      return '<li class="bm-person'+(r.dir?' bm-dir':'')+'"'
        +(ed&&S.editRoles?' data-editrole="'+i+'" data-id="'+e.id+'"':'')+'>'
        +avatarRole(r)
        +'<span class="bm-pinfo">'
          +'<span class="bm-pligne"><span class="bm-pnom">'+esc(r.nom)+'</span>'+lienRole(r)
            +'<span class="bm-psp"></span>'+tagType(r)+'</span>'
          +'<span class="bm-pfonc"><span class="bm-prole">'+esc(r.poste)+'</span>'
            +(r.depuis?'<span class="bm-pdepuis">'+T.depuis+esc(r.depuis)+'</span>':'')+'</span>'
        +'</span>'
        +(ed?'<button class="bm-rmabs" data-rmrole="'+i+'" data-id="'+e.id+'" title="Retirer">✕</button>':'')
        +'</li>';
    }).join('')+'</ul>'
    : '<p class="bm-vide">'+T.aucunRole+'</p>';
  if(!ed && all.length>CFG.MAX_ROLES) h += '<button class="bm-seemore" data-do="'
    +(S.plusRoles?'moinsroles':'plusroles')+'">'
    + (S.plusRoles?T.reduire:T.voirRoles.replace('{n}', all.length-CFG.MAX_ROLES)) + '</button>';
  return h;
}
function blocPostes(e, ed){
  const all = vt(e.postes).map((p,i)=>({p:p,i:i})).sort((a,b)=>BM.dirDabord(a.p,b.p));
  /* en lecture, un poste entièrement pourvu disparaît de la liste */
  const dispo = ed ? all : all.filter(o=>BM.libresPoste(e,o.p)>0);
  const open = ed||S.plusPostes, vus = open?dispo:dispo.slice(0,CFG.MAX_POSTES);
  const enEdit = S.posteEdit && S.posteEdit.id===e.id;
  let h = '<p class="bm-hsec">'+T.postes+' ('+dispo.length+')'
    + (ed?'<button class="bm-mini" data-add="poste" data-id="'+e.id+'" title="Ajouter un poste">+</button>'
        +'<button class="bm-mini" data-do="togpostes" aria-pressed="'+(S.editPostes?'true':'false')
        +'" title="Modifier les postes"><i class="fi fi-tr-pencil"></i></button>':'')
    + '</p>';
  if(enEdit && S.posteEdit.i===-1) h += BM.formPoste(e, null, -1);
  if(!vus.length && !(enEdit&&S.posteEdit.i===-1))
    h += '<p class="bm-vide">'+(BM.estComplet(e)?T.aucunPoste:T.ouvertProp)+'</p>';
  vus.forEach(o=>{
    const p=o.p, i=o.i;
    if(enEdit && S.posteEdit.i===i){ h += BM.formPoste(e, p, i); return; }
    const l = BM.libresPoste(e,p);
    const ouvert = S.ouvertPoste && S.ouvertPoste.id===e.id && S.ouvertPoste.i===i;
    h += '<div class="bm-pcard'+(p.dir?' bm-dir':'')+(ouvert?' bm-ouvert':'')+'"'
      +(ed&&S.editPostes?' data-editposte="'+i+'" data-id="'+e.id+'"':'')+'>'
      +'<div class="bm-pcard-head"'+(!(ed&&S.editPostes)?' data-do="voir" data-id="'+e.id+'" data-i="'+i+'"':'')+'>'
      +icone(p.ic)
      +'<span class="bm-pcard-txt"><span class="bm-pcard-nom">'+esc(p.t)+'</span>'
      +'<span class="bm-pcard-cat">'+esc(p.c||'')+'</span></span>'
      +'<span class="bm-pcard-libres">'+l+'/'+(Number(p.n)||0)+' libre'+(l>1?'s':'')+'</span>'
      +'</div>'
      + (ed?'<button class="bm-rmabs" data-rmposte="'+i+'" data-id="'+e.id+'" title="Retirer">✕</button>':'');
    if(ouvert) h += '<div class="bm-pcard-body"><p>'+(p.d?esc(p.d):T.sansDesc)+'</p></div>';
    h += '</div>';
  });
  if(!ed && dispo.length>CFG.MAX_POSTES) h += '<button class="bm-seemore" data-do="'
    +(S.plusPostes?'moinspostes':'pluspostes')+'">'+(S.plusPostes?T.reduire:T.voirPostes)+'</button>';
  return h;
}
function barreActions(e, ed){
  const conf = S.confirmDel===e.id;
  let b = '';
  if(ed) b += '<button class="bm-abtn" data-do="edit" data-id="'+e.id+'"><i class="fi fi-tr-pencil"></i> '+T.modifier+'</button>';
  if(S.admin && e.brouillon) b += '<button class="bm-abtn" data-do="publier" data-id="'+e.id+'">'+T.publier+'</button>';
  if(S.admin) b += conf
    ? '<button class="bm-abtn dgr" data-do="delok" data-id="'+e.id+'">'+T.confRetirer+'</button>'
      +'<button class="bm-abtn" data-do="cancel">'+T.annuler+'</button>'
    : '<button class="bm-abtn dgr" data-do="del" data-id="'+e.id+'">'+T.retirer+'</button>';
  /* aucune action disponible (visiteur) : pas de barre du tout */
  return b ? '<div class="bm-actionbar">'+b+'</div>' : '';
}

/* ===================== FORMULAIRES ===================== */
BM.formRole = function(e, r, i){
  const d = r||{nom:'',poste:'',depuis:'',type:'pj',avatar:'',lien:'',dir:false}, P = T.ph;
  return '<div class="bm-iform">'
    +'<input type="text" id="bm-rnom" value="'+esc(d.nom)+'" placeholder="'+P.nomRole+'">'
    +'<input type="text" id="bm-rposte" value="'+esc(d.poste)+'" placeholder="'+P.fonction+'">'
    +'<select id="bm-rtype">'+BM.TYPES_ROLE.map(t=>'<option value="'+t.id+'"'
      +(d.type===t.id?' selected':'')+'>'+esc(t.label)+'</option>').join('')+'</select>'
    +'<input type="text" id="bm-rdepuis" value="'+esc(d.depuis)+'" placeholder="'+P.annee+'">'
    /* [MAJ] avatar : à terme repris automatiquement du bottin des faceclaims */
    +'<input type="text" id="bm-ravatar" value="'+esc(d.avatar)+'" placeholder="'+P.avatar+'">'
    +'<input type="text" id="bm-rlien" value="'+esc(d.lien)+'" placeholder="'+P.lien+'">'
    +'<label class="chk"><input type="checkbox" id="bm-rdir" '+(d.dir?'checked':'')+'> '+P.role+'</label>'
    +'<div class="acts"><button class="go" data-do="roleok" data-id="'+e.id+'" data-i="'+i+'">'+T.enregistrer+'</button>'
    +'<button class="no" data-do="cancel">'+T.annuler+'</button></div></div>';
};
BM.formPoste = function(e, p, i){
  const d = p||{t:'',c:'',ic:'fi-tr-briefcase',dir:false,n:1,d:''}, P = T.ph;
  return '<div class="bm-iform">'
    +'<input type="text" id="bm-pt" value="'+esc(d.t)+'" placeholder="'+P.intitule+'">'
    +'<input type="text" id="bm-pc" value="'+esc(d.c)+'" placeholder="'+P.catPoste+'">'
    +'<input type="text" id="bm-pic" value="'+esc(d.ic)+'" placeholder="'+P.icPoste+'">'
    +'<input type="number" id="bm-pn" min="1" value="'+(Number(d.n)||1)+'" placeholder="'+P.places+'">'
    +'<label class="chk"><input type="checkbox" id="bm-pdir" '+(d.dir?'checked':'')+'> '+P.posteDir+'</label>'
    +'<textarea class="lg" id="bm-pd" placeholder="'+P.resume+'">'+esc(d.d)+'</textarea>'
    +'<div class="acts"><button class="go" data-do="posteok" data-id="'+e.id+'" data-i="'+i+'">'+T.enregistrer+'</button>'
    +'<button class="no" data-do="cancel">'+T.annuler+'</button></div></div>';
};
function champ(id, label, valeur, full){
  return '<div class="bm-field'+(full?' bm-full':'')+'"><label>'+label+'</label>'
    +'<input id="'+id+'" value="'+esc(valeur||'')+'"></div>';
}
function formEntreprise(){
  const d = S.draft, neuf = S.mode==='nouveau', L = T.lbl, P = T.ph;
  const opt = (arr,val,f)=>arr.map(o=>'<option value="'+o.id+'" '+(o.id===val?'selected':'')+'>'
    +esc(f(o))+'</option>').join('');
  return '<div class="bm-pbody"><div class="bm-phead"><p class="bm-peyebrow">'
      +(neuf?T.nouvelle:T.edition)+'</p><h2>'+esc(d.nom||T.sansNom)+'</h2></div>'
    +'<div class="bm-pcontent"><p class="bm-hint">'+T.hintLieu+'</p><div class="bm-pform">'
    + champ('bm-f-nom', L.nom, d.nom, true)
    +'<div class="bm-field"><label>'+L.zone+'</label><select id="bm-f-zone">'
      +opt(BM.ZONES,d.zone,z=>z.titre)+'</select></div>'
    +'<div class="bm-field"><label>'+L.categorie+'</label><select id="bm-f-cat">'
      +opt(BM.CATS,d.cat,c=>c.label)+'</select></div>'
    + champ('bm-f-type', L.type, d.type)
    +'<div class="bm-field"><label>'+L.icone+'</label><input id="bm-f-ic" list="bm-icones" value="'
      +esc(d.ic||'')+'" placeholder="fi-tr-truck-side"><datalist id="bm-icones">'
      +CFG.ICONES.map(v=>'<option value="'+v+'">').join('')+'</datalist></div>'
    + champ('bm-f-rue', L.rue, d.rue==='—'?'':d.rue)
    + champ('bm-f-eff', L.effectif, d.effectif)
    + champ('bm-f-fond', L.fondee, d.fondee)
    + champ('bm-f-ray', L.rayonnement, d.rayonnement)
    +'<div class="bm-field bm-full"><label>'+L.image+'</label><input id="bm-f-img" value="'
      +esc(d.img||'')+'" placeholder="https://…"><div class="bm-imgprev" id="bm-imgprev" style="'
      +(d.img?"background-image:url('"+esc(d.img)+"')":'display:none')+'"></div></div>'
    + champ('bm-f-amb', L.amb, d.amb==='—'?'':d.amb, true)
    +'<div class="bm-field bm-full"><label>'+L.desc+'</label><textarea id="bm-f-desc">'+esc(d.desc||'')+'</textarea></div>'
    +'<div class="bm-field bm-full"><label>'+L.accroche+'</label><textarea id="bm-f-accroche" style="min-height:56px">'
      +esc(d.accroche||'')+'</textarea></div>'
    +'<div class="bm-field bm-full"><label>'+L.dispo+'</label><div class="bm-checks"><label>'
      +'<input type="checkbox" id="bm-f-complet" '+(d.complet?'checked':'')+'> '+P.complet+'</label></div></div>'
    + (S.admin
      ? '<div class="bm-field bm-full"><label>'+L.staff+'</label><div class="bm-checks"><label>'
        +'<input type="checkbox" id="bm-f-verrou" '+(d.verrou?'checked':'')+'> '+P.verrou+'</label></div></div>'
        + champ('bm-f-ref', L.referent, d.referent, true)
      : '')
    +'</div></div></div>'
    +'<div class="bm-actionbar"><button class="bm-abtn" data-do="saveok">'+T.enregistrer+'</button>'
    +'<button class="bm-abtn" data-do="cancel">'+T.annuler+'</button></div>';
}

})();
