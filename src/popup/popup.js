// The toolbar popup only opens the store page with the dashboard.
document.getElementById("open").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://store.steampowered.com/account/#vapor-ledger" });
  window.close();
});
