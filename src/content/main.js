// Entry point on store.steampowered.com: adds a "Vapor Ledger" link to the
// header and opens the dashboard when the URL ends with #vapor-ledger.

var VL = globalThis.VL || {};
globalThis.VL = VL;

function addHeaderLink() {
  if (document.getElementById("vapor-ledger-link")) return;
  const link = VL.el("a", {
    id: "vapor-ledger-link",
    href: "#vapor-ledger",
    class: "global_action_link",
    style: "margin-right: 8px;",
    onclick: (event) => {
      event.preventDefault();
      VL.openDashboard();
    },
  }, "Vapor Ledger");

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
}

function checkHash() {
  if (location.hash === "#vapor-ledger") VL.openDashboard();
}

addHeaderLink();
checkHash();
window.addEventListener("hashchange", checkHash);
