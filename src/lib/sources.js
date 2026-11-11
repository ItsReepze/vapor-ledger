// Optional price sources outside Steam. Both are off until the user
// switches them on in the settings.
//
// - IsThereAnyDeal (api.isthereanydeal.com, official API, needs the
//   user's own free API key): the lowest price a game ever had. Only Steam
//   app ids and the store country are sent. Never a Steam ID, token or
//   anything from the purchase history.
// - SteamDB has no public API, so Vapor Ledger only links to it. Nothing
//   is loaded from SteamDB.

var VL = globalThis.VL || {};
globalThis.VL = VL;

const ITAD_API = "https://api.isthereanydeal.com";
const ITAD_STEAM_SHOP = 61;
const ITAD_BATCH = 200;
const ITAD_DELAY_MS = 1000;
const ITAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

VL.sourceSettings = { steamdbLinks: false, itad: false };

async function itadPost(path, query, body) {
  const response = await VL.request(ITAD_API + path + "?" + new URLSearchParams(query), {
    method: "POST",
    body: JSON.stringify(body),
    contentType: "application/json",
  });
  if (response.status === 401 || response.status === 403) throw new Error("IsThereAnyDeal: API key not accepted");
  if (!response.ok) throw new Error("IsThereAnyDeal: HTTP " + response.status);
  return response.json();
}

// { appid: { amount, currency, date, shop } } for the given app ids.
VL.fetchHistoricalLows = async function (appids, country, key) {
  const lows = {};
  for (let start = 0; start < appids.length; start += ITAD_BATCH) {
    if (start > 0) await VL.sleep(ITAD_DELAY_MS);
    const batch = appids.slice(start, start + ITAD_BATCH);
    const ids = await itadPost("/lookup/id/shop/" + ITAD_STEAM_SHOP + "/v1", { key }, batch.map((a) => "app/" + a));
    const appByGame = {};
    for (const appid of batch) {
      if (ids && ids["app/" + appid]) appByGame[ids["app/" + appid]] = appid;
    }
    const games = Object.keys(appByGame);
    if (games.length === 0) continue;
    await VL.sleep(ITAD_DELAY_MS);
    Object.assign(lows, VL.parseHistoricalLows(await itadPost("/games/historylow/v1", { key, country }, games), appByGame));
  }
  return lows;
};

VL.parseHistoricalLows = function (data, appByGame) {
  const lows = {};
  for (const entry of Array.isArray(data) ? data : []) {
    const low = entry && entry.low;
    const appid = entry && appByGame[entry.id];
    if (!appid || !low || !low.price || typeof low.price.amount !== "number") continue;
    lows[appid] = {
      amount: low.price.amount,
      currency: low.price.currency || "",
      date: low.timestamp ? Date.parse(low.timestamp) : null,
      shop: (low.shop && low.shop.name) || "",
    };
  }
  return lows;
};

// Reads the source settings and adds historicalLow to the games in stats
// if IsThereAnyDeal is switched on. Saved lows are reused for a day.
VL.loadPriceSources = async function (stats, data) {
  const settings = await VL.loadSettings();
  const stored = await chrome.storage.local.get(["itadKey", "itad-lows"]);
  VL.sourceSettings = { steamdbLinks: settings.steamdbLinks, itad: settings.itad };
  const key = stored.itadKey;
  const country = (data && data.store && data.store.country) || "US";
  if (!VL.sourceSettings.itad || !key) return;

  let cache = stored["itad-lows"];
  if (!cache || cache.country !== country || Date.now() - cache.at > ITAD_MAX_AGE_MS) {
    try {
      cache = { at: Date.now(), country, lows: await VL.fetchHistoricalLows(stats.games.map((g) => g.appid), country, key) };
      await chrome.storage.local.set({ "itad-lows": cache });
    } catch (error) {
      console.warn("[Vapor Ledger]", error);
      return;
    }
  }
  for (const game of stats.games) {
    game.historicalLow = cache.lows[game.appid] || null;
    game.lowAmount = game.historicalLow ? game.historicalLow.amount : null;
  }
};
