// === EcoV2 GAIN SYSTEM ===
console.log("[EcoV2] Chargement eco-gain.js");

(function(){
  const { log, warn, err, safeReadBin, writeBin,
          getPseudo, getMessagesCount, showEcoGain, MONNAIE_NAME } = window.EcoCore;
  const { updatePostDollars } = window.EcoUI;

  const GAIN_RULES = {
    presentation_new:20, presentation_reply:5,
    preliens_or_gestion_new:10, preliens_or_gestion_reply:2,
    houma_terrebonne_new:15, houma_terrebonne_reply:10,
    vote_topic_reply:2
  };
  const TAG_BONUS = { "#intrigue":10, "#event":5, "#enquete":5, "#solve":20, "#defi":5, "#mintrigue":5 };
  const FORUM_IDS = { presentations:"/f5-presentations", preliens:"/f4-en-construction",
                      gestionPersos:"/f6-gestion-des-personnages", voteTopicName:"/t22-vote-aux-top-sites" };
  const RP_ZONES = ["/f7-les-bayous-sauvages","/f8-downtown-houma","/f9-bayou-cane","/f10-bayou-blue",
                    "/f11-mandalay-national-wildlife-refuge","/f12-terrebonne-bay"];

  function ecoAttachPostListeners(){
    const forms=document.querySelectorAll('form[name="post"],form#quick_reply,form[action*="post"],form[action*="posting"],form#qrform');
    forms.forEach(f=>{
      if(f.__eco_listening)return;
      f.__eco_listening=true;
      const handler=()=>{
        try{
          const urlObj=new URL(f.action||location.href,location.origin);
          const mode=(urlObj.searchParams.get("mode")||"").toLowerCase();
          if(mode==="editpost"||mode==="delete") return sessionStorage.removeItem("ecoJustPosted");
          const isNewTopic=location.href.includes("mode=newtopic");
          let forumId=location.pathname;
          const bc=document.querySelector(".sub-header-path");
          if(bc){ const last=Array.from(bc.querySelectorAll('a[href*="/f"]')).pop(); if(last) forumId=last.getAttribute("href"); }
          const data={t:Date.now(),newTopic:isNewTopic,fid:forumId,mode};
          sessionStorage.setItem("ecoJustPosted",JSON.stringify(data));
        }catch(e){err("ecoAttach handler",e);}
      };
      f.addEventListener("submit",handler);
      const btn=f.querySelector('input[type="submit"],button[type="submit"]');
      if(btn) btn.addEventListener("click",handler);
    });
  }

  window.addEventListener("load",()=>setTimeout(ecoAttachPostListeners,1500));

  async function ecoCheckPostGain(){
    try{
      const s=JSON.parse(sessionStorage.getItem("ecoJustPosted")||"null");
      if(!s) return;
      if(s.mode==="editpost"||s.mode==="delete"){ sessionStorage.removeItem("ecoJustPosted"); return; }
      const pseudo=getPseudo(); if(!pseudo) return;
      const record=await safeReadBin(); if(!record) return;
      const membres=record.membres||{};
      if(!membres[pseudo]) return;

      // Détermination forum
      let path=s.fid?.toLowerCase()||location.pathname.toLowerCase();
      let isNew=s.newTopic||s.mode==="newtopic";
      let gain=0;
      if(path.includes(FORUM_IDS.presentations)) gain=isNew?GAIN_RULES.presentation_new:GAIN_RULES.presentation_reply;
      else if(path.includes(FORUM_IDS.preliens)||path.includes(FORUM_IDS.gestionPersos)) gain=isNew?GAIN_RULES.preliens_or_gestion_new:GAIN_RULES.preliens_or_gestion_reply;
      else if(RP_ZONES.some(z=>path.includes(z))) gain=isNew?GAIN_RULES.houma_terrebonne_new:GAIN_RULES.houma_terrebonne_reply;
      else if(location.pathname.includes(FORUM_IDS.voteTopicName)&&!isNew) gain=GAIN_RULES.vote_topic_reply;

      // Bonus tags
      const posts=document.querySelectorAll(".sj-postmsg,.sj-post-msg");
      if(posts.length){
        const text=posts[posts.length-1].textContent.toLowerCase();
        for(const [tag,b] of Object.entries(TAG_BONUS)) if(text.includes(tag)) gain+=b;
      }

      // Bonus paliers
      const msgCount=getMessagesCount();
      const user=membres[pseudo];
      const last=user.lastMessageThresholdAwarded||0;
      const REWARDS=[{threshold:100,reward:5},{threshold:500,reward:10},{threshold:1000,reward:15}];
      const next=REWARDS.find(r=>msgCount>=r.threshold&&r.threshold>last);
      if(next){ gain+=next.reward; user.lastMessageThresholdAwarded=next.threshold; }

      if(gain>0){
        membres[pseudo].dollars=(membres[pseudo].dollars||0)+gain;
        await writeBin(record);
        showEcoGain(gain); updatePostDollars();
        console.log(`[EcoV2] +${gain} ${MONNAIE_NAME} pour ${pseudo}`);
      }
      sessionStorage.removeItem("ecoJustPosted");
    }catch(e){err("ecoCheckPostGain",e);}
  }

  window.addEventListener("load",()=>setTimeout(ecoCheckPostGain,3500));
})();
