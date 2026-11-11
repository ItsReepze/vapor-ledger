// Settings: every improvement of Steam's own pages can be switched off.
// They live in chrome.storage.local under "settings" and are read by the
// extension page and by the content scripts on Steam's pages.

var VL = globalThis.VL || {};
globalThis.VL = VL;

// key: name in storage, also the text keys "set_<key>" and "set_<key>_hint"
VL.FEATURES = [
  { key: "headerLink", pages: "store.steampowered.com, steamcommunity.com" },
  { key: "profileEdit", pages: "steamcommunity.com/id/.../edit" },
  { key: "historyTools", pages: "store.steampowered.com/account/history" },
  { key: "licensesTools", pages: "store.steampowered.com/account/licenses" },
];

VL.loadSettings = async function () {
  const result = await chrome.storage.local.get("settings");
  const saved = result.settings || {};
  const settings = {};
  // Everything is on unless the user switched it off.
  for (const feature of VL.FEATURES) settings[feature.key] = saved[feature.key] !== false;
  return settings;
};

VL.saveSetting = async function (key, on) {
  const result = await chrome.storage.local.get("settings");
  const settings = { ...(result.settings || {}), [key]: Boolean(on) };
  await chrome.storage.local.set({ settings });
};
