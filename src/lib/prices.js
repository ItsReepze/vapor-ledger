// Current store prices for the games in the library, through Steam's own
// IStoreBrowseService API on api.steampowered.com. It's the same API the
// Steam store uses for its game tiles. No token is needed, only the store
// country, so the prices match what this user would pay today.

var VL = globalThis.VL || {};
globalThis.VL = VL;

// Games per request and pause between requests. A library of 1000 games
// needs 10 requests, about 5 seconds.
const PRICE_BATCH_SIZE = 100;
const PRICE_DELAY_MS = 500;

// Turns one GetItems answer into { appid: price }.
// price is { cents, formatted, discount } for games on sale today,
// { cents: 0, free: true } for free games. Games that are not sold any
// more (removed from the store, or only sold in a bundle) are left out.
VL.parseStoreItems = function (data) {
  const prices = {};
  const items = (data && data.response && data.response.store_items) || [];
  for (const item of items) {
    if (!item || !item.appid || item.success !== 1) continue;
    if (item.is_free) {
      prices[item.appid] = { cents: 0, formatted: "", discount: 0, free: true };
      continue;
    }
    const option = item.best_purchase_option;
    if (!option || option.final_price_in_cents === undefined) continue;
    const cents = Number(option.final_price_in_cents);
    if (!Number.isFinite(cents)) continue;
    prices[item.appid] = {
      cents,
      formatted: option.formatted_final_price || "",
      discount: option.discount_pct || 0,
      free: false,
    };
  }
  return prices;
};

// Loads the prices for a list of app ids. Returns
// { prices, currency, country, fetchedAt }.
VL.fetchStorePrices = async function (appids, country, onProgress) {
  const prices = {};
  for (let start = 0; start < appids.length; start += PRICE_BATCH_SIZE) {
    if (start > 0) await VL.sleep(PRICE_DELAY_MS);
    const batch = appids.slice(start, start + PRICE_BATCH_SIZE);
    const input = {
      ids: batch.map((appid) => ({ appid })),
      context: { language: "english", country_code: country, steam_realm: 1 },
      data_request: {},
    };
    const url = "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json="
      + encodeURIComponent(JSON.stringify(input));
    const response = await fetch(url);
    if (!response.ok) throw new Error("Store prices failed: HTTP " + response.status);
    Object.assign(prices, VL.parseStoreItems(await response.json()));
    onProgress && onProgress(Math.min(start + PRICE_BATCH_SIZE, appids.length), appids.length);
  }

  const sample = Object.values(prices).find((p) => p.formatted);
  return {
    prices,
    currency: sample ? VL.parseCurrency(sample.formatted) : "",
    country,
    fetchedAt: Date.now(),
  };
};
