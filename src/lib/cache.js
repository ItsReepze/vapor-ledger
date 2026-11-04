// Keeps the loaded data in the extension's local storage, so the dashboard
// opens instantly the next time. This storage lives only in this browser.

var VL = globalThis.VL || {};
globalThis.VL = VL;

function cacheKey(steamid) {
  return "cache-" + steamid;
}

VL.loadCache = async function (steamid) {
  const key = cacheKey(steamid);
  const result = await chrome.storage.local.get(key);
  return result[key] || null;
};

VL.saveCache = async function (steamid, data) {
  await chrome.storage.local.set({ [cacheKey(steamid)]: data });
};

VL.clearCache = async function (steamid) {
  await chrome.storage.local.remove(cacheKey(steamid));
};
