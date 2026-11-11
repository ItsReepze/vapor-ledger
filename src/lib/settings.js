// Settings: every improvement of Steam's pages and every outside price
// source can be switched on or off. They live in chrome.storage.local
// under "settings" and are read by all of Vapor Ledger's scripts.

var VL = globalThis.VL || {};
globalThis.VL = VL;

// key: name in storage, also the text keys "set_<key>" and "set_<key>_hint".
// on: the setting without a choice of the user. Outside sources are off.
VL.FEATURES = [
  { key: "headerLink", on: true, pages: "store.steampowered.com, steamcommunity.com" },
  { key: "profileEdit", on: true, pages: "steamcommunity.com/id/.../edit" },
  { key: "historyTools", on: true, pages: "store.steampowered.com/account/history" },
  { key: "licensesTools", on: true, pages: "store.steampowered.com/account/licenses" },
  { key: "steamdbLinks", on: false, pages: "steamdb.info", source: true },
  { key: "itad", on: false, pages: "api.isthereanydeal.com", source: true },
];

VL.loadSettings = async function () {
  const result = await chrome.storage.local.get("settings");
  const saved = result.settings || {};
  const settings = {};
  for (const feature of VL.FEATURES) {
    settings[feature.key] = typeof saved[feature.key] === "boolean" ? saved[feature.key] : feature.on;
  }
  return settings;
};

VL.saveSetting = async function (key, on) {
  const result = await chrome.storage.local.get("settings");
  const settings = { ...(result.settings || {}), [key]: Boolean(on) };
  await chrome.storage.local.set({ settings });
};
