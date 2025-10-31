// === EcoV2 BOOT ===
console.log("[EcoV2] Chargement eco-boot.js");

(async function(){
  const { createErrorBanner } = window.EcoCore;
  const { coreInit } = window.EcoUI;

  let tries=0;
  const max=20;
  const menuSel="body #sj-main .menu .sj-menu-top";
  const iv=setInterval(async()=>{
    tries++;
    const menu=document.querySelector(menuSel);
    if(menu){
      clearInterval(iv);
      try{ await coreInit(); }catch(e){ console.error("[EcoV2] coreInit err",e); }
    }else if(tries>=max){
      clearInterval(iv);
      document.body.prepend(createErrorBanner("Économie : menu introuvable."));
    }
  },500);
})();
