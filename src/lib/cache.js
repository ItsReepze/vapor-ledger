// Keeps the loaded data in the extension's local storage, so the overview
// opens instantly the next time. This storage lives only in this browser.

var VL = globalThis.VL || {};
globalThis.VL = VL;

function cacheKey(id) {
  return "cache-" + id;
}

VL.loadCache = async function (id) {
  const key = cacheKey(id);
  const result = await chrome.storage.local.get(key);
  return result[key] || null;
};

VL.saveCache = async function (id, data) {
  await chrome.storage.local.set({ [cacheKey(id)]: data });
};

VL.clearCache = async function (id) {
  await chrome.storage.local.remove(cacheKey(id));
};

// The account that was loaded last, so the page can show its saved data
// before asking Steam again.
VL.loadLastAccount = async function () {
  const result = await chrome.storage.local.get("last-account");
  return result["last-account"] || null;
};

VL.saveLastAccount = async function (steamid) {
  await chrome.storage.local.set({ "last-account": steamid });
};

// Removes everything Vapor Ledger has saved in this browser.
VL.clearAll = async function () {
  await chrome.storage.local.clear();
};
