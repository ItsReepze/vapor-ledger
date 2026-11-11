// The only script that runs on Steam's pages. It adds a "Vapor Ledger"
// link to the header and opens the extension's own page when clicked.
// It reads nothing from the page and loads nothing.

(function () {
  if (document.getElementById("vapor-ledger-link")) return;
  const tab = location.hostname === "steamcommunity.com" ? "inventory" : "overview";
  const open = () => chrome.runtime.sendMessage({ type: "open", tab });

  const link = document.createElement("a");
  link.id = "vapor-ledger-link";
  link.href = "#vapor-ledger";
  link.className = "global_action_link";
  link.style.marginRight = "8px";
  link.textContent = "Vapor Ledger";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    open();
  });

  // Steam's header has the account menu in #global_action_menu.
  // If Steam changes the layout we fall back to a small floating button.
  const menu = document.getElementById("global_action_menu");
  if (menu) {
    menu.prepend(link);
  } else {
    link.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:9999;"
      + "background:#1f2833;color:#66c0f4;padding:8px 12px;border-radius:4px;";
    document.body.append(link);
  }

  // Old bookmarks with #vapor-ledger still open the page.
  if (location.hash === "#vapor-ledger") {
    history.replaceState(null, "", location.pathname + location.search);
    open();
  }
})();
