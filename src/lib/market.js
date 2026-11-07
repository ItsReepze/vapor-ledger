// Market history from steamcommunity.com/market/myhistory, with profit and
// loss per item. Runs on steamcommunity.com like community.js.
//
// Each history row looks like this (class names from Steam's page):
//   .market_listing_gainorloss   "+" bought, "-" sold, empty for a listing
//                                that was only created or cancelled
//   .market_listing_price        the price as Steam shows it
//   .market_listing_listed_date  date of the action (first cell)
//   .market_listing_item_name    item name
//   .market_listing_game_name    game

var VL = globalThis.VL || {};
globalThis.VL = VL;

const HISTORY_PAGE_SIZE = 100;
const MARKET_DELAY_MS = 3500;

function rowText(row, selector) {
  const node = row.querySelector(selector);
  return node ? node.textContent.replace(/\s+/g, " ").trim() : "";
}

// Takes a document or element with history rows and returns
// { id, action: "bought" | "sold", name, game, amount, currency, dateText }.
// Rows that are not a purchase or a sale are left out.
VL.parseMarketHistory = function (root) {
  const entries = [];
  for (const row of root.querySelectorAll(".market_listing_row")) {
    const sign = rowText(row, ".market_listing_gainorloss");
    const action = sign.startsWith("+") ? "bought" : /^[-−]/.test(sign) ? "sold" : null;
    if (!action) continue;
    const priceText = rowText(row, ".market_listing_price");
    const amount = VL.parseAmount(priceText);
    if (amount === null) continue;
    entries.push({
      id: row.id || "",
      action,
      name: rowText(row, ".market_listing_item_name"),
      game: rowText(row, ".market_listing_game_name"),
      amount: Math.abs(amount),
      currency: VL.parseCurrency(priceText),
      dateText: rowText(row, ".market_listing_listed_date"),
    });
  }
  return entries;
};

// Loads the market history, newest first. `known` is the list from the
// last time: as soon as a page contains an entry we already have, we stop
// and add the old entries, so only new pages are loaded.
VL.fetchMarketHistory = async function (known, onProgress, shouldContinue) {
  const knownIds = new Set((known || []).map((e) => e.id).filter(Boolean));
  const fresh = [];
  let start = 0;
  let total = Infinity;
  let complete = false;

  while (start < total) {
    if (shouldContinue && !shouldContinue()) break;
    if (start > 0) await VL.sleep(MARKET_DELAY_MS);
    const params = new URLSearchParams({ query: "", start: String(start), count: String(HISTORY_PAGE_SIZE) });
    const response = await fetch("https://steamcommunity.com/market/myhistory/render/?" + params, {
      credentials: "include",
    });
    if (response.status === 429) throw new VL.RateLimitError();
    if (!response.ok) throw new Error("Market history failed: HTTP " + response.status);
    const data = await response.json();
    if (!data || !data.success) throw new Error("Market history is not available. Are you logged in?");
    total = data.total_count || 0;

    const doc = new DOMParser().parseFromString(data.results_html || "", "text/html");
    const page = VL.parseMarketHistory(doc);
    const newOnes = page.filter((e) => !knownIds.has(e.id));
    fresh.push(...newOnes);
    start += HISTORY_PAGE_SIZE;
    onProgress && onProgress(Math.min(start, total), total);
    if (newOnes.length < page.length) {
      complete = true; // reached what we already had
      break;
    }
  }
  if (start >= total) complete = true;

  // If loading stopped early, the old list still has a gap, so we keep
  // only what we really have and mark it as incomplete.
  const entries = complete ? [...fresh, ...(known || [])] : fresh;
  return { entries, complete };
};

// Profit and loss per item and in total.
VL.buildMarketStats = function (entries) {
  const items = new Map();
  let bought = 0;
  let sold = 0;
  for (const e of entries) {
    const key = e.game + "|" + e.name;
    if (!items.has(key)) {
      items.set(key, { name: e.name, game: e.game, boughtCount: 0, bought: 0, soldCount: 0, sold: 0 });
    }
    const item = items.get(key);
    // Summed in cents to avoid float errors over thousands of rows.
    const cents = Math.round(e.amount * 100);
    if (e.action === "bought") {
      item.boughtCount++;
      item.bought += cents;
      bought += cents;
    } else {
      item.soldCount++;
      item.sold += cents;
      sold += cents;
    }
  }
  const rows = [...items.values()].map((item) => ({
    ...item,
    bought: item.bought / 100,
    sold: item.sold / 100,
    net: (item.sold - item.bought) / 100,
  }));
  return {
    rows,
    currency: (entries.find((e) => e.currency) || {}).currency || "",
    bought: bought / 100,
    sold: sold / 100,
    net: (sold - bought) / 100,
    boughtCount: entries.filter((e) => e.action === "bought").length,
    soldCount: entries.filter((e) => e.action === "sold").length,
  };
};
