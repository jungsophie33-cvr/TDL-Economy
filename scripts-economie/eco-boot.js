// === ECONOMIE V2 – BOOT SEQUENCE ===
// Auteur : ChatGPT x THE DROWNED LANDS
console.log("[EcoV2] >>> eco-boot chargé");

(function(){

  const { warn, err, createErrorBanner, MENU_SELECTOR, RETRY_INTERVAL_MS, RETRY_MAX } = window.EcoCore;
  const { coreInit } = window.EcoUI;

  // ---------- BOOT (wait menu) ----------
  let tries = 0;
  const timer = setInterval(async () => {
    tries++;
    const menu = document.querySelector(MENU_SELECTOR);
    if (menu) {
      clearInterval(timer);
      try { await coreInit(); } catch (e) { err("coreInit", e); }
    } else if (tries >= RETRY_MAX) {
      clearInterval(timer);
      warn("menu not found");
      document.body.prepend(createErrorBanner("Initialisation économie : menu introuvable."));
    }
  }, RETRY_INTERVAL_MS);

  console.log("[EcoV2] <<< eco-boot prêt");

})();
