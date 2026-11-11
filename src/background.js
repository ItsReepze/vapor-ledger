// Opens the Vapor Ledger page in a new tab: from the toolbar button and
// from the "Vapor Ledger" link the content script adds to Steam's header.

const APP_URL = chrome.runtime.getURL("src/app/app.html");

function openApp(tab) {
  chrome.tabs.create({ url: APP_URL + (tab ? "#" + tab : "") });
}

chrome.action.onClicked.addListener(() => openApp());

chrome.runtime.onMessage.addListener((message, sender) => {
  // Only our own content script sends this message.
  if (sender.id !== chrome.runtime.id || !message || message.type !== "open") return;
  openApp(["overview", "inventory"].includes(message.tab) ? message.tab : null);
});
