// Background script of Vapor Ledger. It does two things:
// - The toolbar button opens the Vapor Ledger page on the Steam store.
// - It passes requests of the Vapor Ledger page to the allowed hosts
//   (see src/lib/request.js), because a page on store.steampowered.com may
//   not read answers from other sites itself.

/* global importScripts, VL */

// Chrome runs this file as a service worker, Firefox loads request.js
// before it (see manifest.json).
if (typeof importScripts === "function" && !globalThis.VL) importScripts("lib/request.js");

const LEDGER_URL = "https://store.steampowered.com/account/#vapor-ledger";

chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: LEDGER_URL }));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only our own content scripts on Steam's store may ask.
  if (sender.id !== chrome.runtime.id || !message || message.type !== "request") return false;
  if (!sender.url || new URL(sender.url).hostname !== "store.steampowered.com") return false;
  let target;
  try {
    target = new URL(message.url);
  } catch {
    sendResponse({ error: "Bad address" });
    return false;
  }
  if (target.protocol !== "https:" || !VL.ALLOWED_HOSTS.includes(target.hostname)) {
    sendResponse({ error: "Host not allowed" });
    return false;
  }
  fetch(target.href, VL.fetchOptions(target, message))
    .then(async (response) => sendResponse({ status: response.status, text: await response.text() }))
    .catch((error) => sendResponse({ error: error.message }));
  return true; // the answer comes later
});
