// Runs before first paint so the chosen theme never flashes.
(() => {
  let t = "auto";
  try { t = localStorage.getItem("theme") || "auto"; } catch {}
  if (t !== "auto") document.documentElement.dataset.theme = t;
})();
