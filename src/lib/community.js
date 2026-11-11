// Inventory and market prices from steamcommunity.com. The extension page
// loads them with the user's own Steam Community login, the same data the
// inventory and market pages load.
//
// Steam limits these endpoints hard. All requests go one after another with
// a pause, and a "429 Too Many Requests" stops loading instead of retrying.

var VL = globalThis.VL || {};
globalThis.VL = VL;

const COMMUNITY = "https://steamcommunity.com";

// Pauses between requests. Market prices are the strictest limit
// (about 20 requests per minute).
const INVENTORY_DELAY_MS = 2000;
const PRICE_DELAY_MS_COMMUNITY = 3500;

// Prices are kept for one day, so opening the dashboard again doesn't
// ask Steam for every price again.
VL.PRICE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Inventories we look at: [appid, contextid, label].
VL.INVENTORY_APPS = [
  [753, 6, "Steam"],
  [730, 2, "Counter-Strike 2"],
  [440, 2, "Team Fortress 2"],
  [570, 2, "Dota 2"],
  [252490, 2, "Rust"],
  [578080, 2, "PUBG"],
];

VL.RateLimitError = class extends Error {
  constructor() {
    super("Steam is limiting requests right now. Please try again in a few minutes.");
    this.rateLimited = true;
  }
};

// Reads the logged in user and the wallet currency from a community page.
// Steam writes them into inline scripts ("g_steamID = ..." and
// "g_rgWalletInfo = {...}"); we only read the text, nothing is executed.
VL.getCommunitySession = function (doc) {
  let steamid = null;
  let currency = null;
  const config = doc.getElementById("application_config");
  if (config && config.dataset.userinfo) {
    try {
      steamid = JSON.parse(config.dataset.userinfo).steamid || null;
    } catch {
      steamid = null;
    }
  }
  for (const script of doc.querySelectorAll("script:not([src])")) {
    const text = script.textContent;
    if (!steamid) {
      const match = text.match(/g_steamID\s*=\s*"(\d{17})"/);
      if (match) steamid = match[1];
    }
    if (currency === null) {
      const match = text.match(/"wallet_currency"\s*:\s*(\d+)/);
      if (match) currency = Number(match[1]);
    }
  }
  if (!steamid) return null;
  return { steamid, currency };
};

// Loads the user's own inventory page once to learn who is logged in on
// Steam Community and which wallet currency the market uses. Returns
// { steamid, currency } or null if nobody is logged in there.
VL.openCommunity = async function () {
  const response = await communityGet(COMMUNITY + "/my/inventory/");
  if (!response.ok) return null;
  const doc = new DOMParser().parseFromString(await response.text(), "text/html");
  return VL.getCommunitySession(doc);
};

// Turns one inventory page into a list of item stacks:
// { appid, name, hashName, type, marketable, count, icon }.
// Items with the same market name are counted together.
VL.parseInventory = function (data) {
  if (!data || !Array.isArray(data.assets)) return [];
  const descriptions = new Map();
  for (const d of data.descriptions || []) {
    descriptions.set(d.classid + "_" + d.instanceid, d);
  }
  const stacks = new Map();
  for (const asset of data.assets) {
    const d = descriptions.get(asset.classid + "_" + asset.instanceid);
    if (!d) continue;
    const hashName = d.market_hash_name || d.name || "";
    const key = asset.appid + "/" + hashName;
    const amount = Number(asset.amount) || 1;
    if (stacks.has(key)) {
      stacks.get(key).count += amount;
    } else {
      stacks.set(key, {
        appid: Number(asset.appid),
        name: d.name || hashName,
        hashName,
        type: d.type || "",
        marketable: d.marketable === 1,
        count: amount,
        icon: d.icon_url || "",
      });
    }
  }
  return [...stacks.values()];
};

// Merges stacks from several inventory pages.
VL.mergeStacks = function (lists) {
  const merged = new Map();
  for (const stack of lists.flat()) {
    const key = stack.appid + "/" + stack.hashName;
    if (merged.has(key)) merged.get(key).count += stack.count;
    else merged.set(key, { ...stack });
  }
  return [...merged.values()];
};

async function communityGet(url) {
  const response = await fetch(url, { credentials: "include" });
  if (response.status === 429) throw new VL.RateLimitError();
  return response;
}

// Loads all inventories in VL.INVENTORY_APPS. Empty, private or missing
// inventories are skipped.
VL.fetchInventories = async function (steamid, onProgress) {
  const lists = [];
  let first = true;
  for (const [appid, contextid, label] of VL.INVENTORY_APPS) {
    let startAssetId = null;
    do {
      if (!first) await VL.sleep(INVENTORY_DELAY_MS);
      first = false;
      onProgress && onProgress(label);
      const params = new URLSearchParams({ l: "english", count: "2000" });
      if (startAssetId) params.set("start_assetid", startAssetId);
      const response = await communityGet(
        COMMUNITY + "/inventory/" + steamid + "/" + appid + "/" + contextid + "?" + params
      );
      if (!response.ok) break; // empty inventories answer with an error code
      const data = await response.json();
      if (!data || !data.success) break;
      lists.push(VL.parseInventory(data));
      startAssetId = data.more_items ? data.last_assetid : null;
    } while (startAssetId);
  }
  return VL.mergeStacks(lists);
};

// Reads a priceoverview answer. Returns { cents, text } or null.
// lowest_price is the cheapest listing right now, median_price the
// typical sale price of the last day. We prefer the lowest listing,
// because that's what a seller has to beat.
VL.parsePriceOverview = function (data) {
  if (!data || !data.success) return null;
  const text = data.lowest_price || data.median_price;
  const value = VL.parseAmount(text);
  if (value === null) return null;
  return { cents: Math.round(value * 100), text };
};

VL.fetchPrice = async function (appid, hashName, currency) {
  const params = new URLSearchParams({
    appid: String(appid),
    currency: String(currency || 1),
    market_hash_name: hashName,
  });
  const response = await communityGet(COMMUNITY + "/market/priceoverview/?" + params);
  if (!response.ok) return null;
  return VL.parsePriceOverview(await response.json());
};

// Loads prices for all marketable stacks that have no fresh price in
// `known` yet. `known` is { "appid/hashName": { cents, text, at } } and is
// updated in place. onProgress(done, total) is called after each price;
// return false from shouldContinue() to stop early.
VL.fetchPrices = async function (stacks, currency, known, onProgress, shouldContinue) {
  const now = Date.now();
  const todo = stacks.filter((s) => {
    if (!s.marketable) return false;
    const price = known[s.appid + "/" + s.hashName];
    return !price || now - price.at > VL.PRICE_MAX_AGE_MS;
  });
  for (let i = 0; i < todo.length; i++) {
    if (shouldContinue && !shouldContinue()) break;
    if (i > 0) await VL.sleep(PRICE_DELAY_MS_COMMUNITY);
    const stack = todo[i];
    const price = await VL.fetchPrice(stack.appid, stack.hashName, currency);
    known[stack.appid + "/" + stack.hashName] = price
      ? { ...price, at: Date.now() }
      : { cents: null, text: "", at: Date.now() };
    onProgress && onProgress(i + 1, todo.length);
  }
  return known;
};

// What the seller gets for a buyer price, both in cents. Steam adds a
// 5 % Steam fee and a 10 % game fee to the seller's amount, each at least
// 1 cent. This is the reverse of that.
VL.buyerPays = function (sellerCents) {
  return sellerCents
    + Math.max(1, Math.floor(sellerCents * 0.05))
    + Math.max(1, Math.floor(sellerCents * 0.1));
};

VL.sellerReceives = function (buyerCents) {
  if (!buyerCents || buyerCents < 3) return 0;
  let seller = Math.floor(buyerCents / 1.15);
  while (seller > 0 && VL.buyerPays(seller) > buyerCents) seller--;
  while (VL.buyerPays(seller + 1) <= buyerCents) seller++;
  return seller;
};

// Adds prices to the stacks and sums up the inventory.
VL.buildInventoryStats = function (stacks, prices) {
  let valueCents = 0;
  let receiveCents = 0;
  let pricedCount = 0;
  let currencyText = "";
  const rows = stacks.map((stack) => {
    const price = prices[stack.appid + "/" + stack.hashName];
    const cents = price && price.cents !== null ? price.cents : null;
    if (cents !== null) {
      valueCents += cents * stack.count;
      receiveCents += VL.sellerReceives(cents) * stack.count;
      pricedCount++;
      if (!currencyText && price.text) currencyText = VL.parseCurrency(price.text);
    }
    return {
      ...stack,
      price: cents === null ? null : cents / 100,
      total: cents === null ? null : (cents * stack.count) / 100,
    };
  });
  return {
    rows,
    currency: currencyText,
    value: valueCents / 100,
    receive: receiveCents / 100,
    itemCount: stacks.reduce((sum, s) => sum + s.count, 0),
    marketableCount: stacks.filter((s) => s.marketable).length,
    pricedCount,
  };
};
