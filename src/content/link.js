// Runs on all Steam store and community pages. It adds "Vapor Ledger" to
// Steam's account menu (the menu under your name at the top). If Steam's
// menu is not there, a small link next to it is used instead. It reads
// nothing from the page and loads nothing. It can be switched off in the
// settings.

(function () {
  const LEDGER_URL = "https://store.steampowered.com/account/#vapor-ledger";
  if (document.getElementById("vapor-ledger-link")) return;

  chrome.storage.local.get("settings").then((result) => {
    if (result.settings && result.settings.headerLink === false) return;
    if (document.getElementById("vapor-ledger-link")) return;

    const link = document.createElement("a");
    link.id = "vapor-ledger-link";
    link.href = LEDGER_URL;
    link.textContent = "Vapor Ledger";

    // The account menu: <div id="account_dropdown"><div class="popup_body">
    // <a class="popup_menu_item">...</a>. Our entry goes before the last
    // entry (log out).
    const menu = document.querySelector("#account_dropdown .popup_body");
    if (menu) {
      link.className = "popup_menu_item";
      const items = menu.querySelectorAll(":scope > a.popup_menu_item");
      if (items.length > 1) items[items.length - 1].before(link);
      else menu.append(link);
      return;
    }
    const header = document.getElementById("global_action_menu");
    if (header) {
      link.className = "global_action_link";
      link.style.marginRight = "8px";
      header.prepend(link);
    }
  });
})();
