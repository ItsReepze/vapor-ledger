// Tests for inventory, prices and market history. Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const { load, html } = require("./load.js");

const VL = load(["src/lib/util.js", "src/lib/i18n.js", "src/lib/history.js", "src/lib/community.js",
  "src/lib/market.js", "src/lib/stats.js"]);

test("getCommunitySession reads steamid and wallet currency from the page", () => {
  const doc = html(`
    <script>g_steamID = "76561190000000001"; var g_sessionID = "x";</script>
    <script>var g_rgWalletInfo = {"wallet_currency":3,"wallet_country":"DE"};</script>`);
  assert.deepStrictEqual(VL.getCommunitySession(doc), { steamid: "76561190000000001", currency: 3 });
  assert.strictEqual(VL.getCommunitySession(html("<script>g_steamID = false;</script>")), null);
});

test("parseInventory groups items by market name", () => {
  const stacks = VL.parseInventory({
    success: 1,
    assets: [
      { appid: 730, classid: "1", instanceid: "0", amount: "1" },
      { appid: 730, classid: "1", instanceid: "0", amount: "1" },
      { appid: 730, classid: "2", instanceid: "0", amount: "5" },
      { appid: 730, classid: "9", instanceid: "0", amount: "1" }, // no description
    ],
    descriptions: [
      { classid: "1", instanceid: "0", name: "Case Key", market_hash_name: "Case Key", marketable: 1, type: "Key" },
      { classid: "2", instanceid: "0", name: "Medal", market_hash_name: "Medal", marketable: 0, type: "Collectible" },
    ],
  });
  assert.strictEqual(stacks.length, 2);
  assert.strictEqual(stacks[0].count, 2);
  assert.strictEqual(stacks[0].marketable, true);
  assert.strictEqual(stacks[1].count, 5);
  assert.strictEqual(stacks[1].marketable, false);
  assert.deepStrictEqual(VL.parseInventory(null), []);

  const merged = VL.mergeStacks([stacks, [{ ...stacks[0], count: 3 }]]);
  assert.strictEqual(merged.find((s) => s.hashName === "Case Key").count, 5);
  assert.strictEqual(stacks[0].count, 2, "merging must not change the input");
});

test("parsePriceOverview prefers the lowest listing", () => {
  assert.deepStrictEqual(
    VL.parsePriceOverview({ success: true, lowest_price: "2,49€", median_price: "2,30€" }),
    { cents: 249, text: "2,49€" });
  assert.strictEqual(VL.parsePriceOverview({ success: true, median_price: "$1.05" }).cents, 105);
  assert.strictEqual(VL.parsePriceOverview({ success: false }), null);
  assert.strictEqual(VL.parsePriceOverview({ success: true }), null);
});

test("sellerReceives reverses Steam's market fees", () => {
  assert.strictEqual(VL.buyerPays(100), 115);
  assert.strictEqual(VL.sellerReceives(115), 100);
  assert.strictEqual(VL.buyerPays(1), 3);
  assert.strictEqual(VL.sellerReceives(3), 1);
  assert.strictEqual(VL.sellerReceives(2), 0);
  assert.strictEqual(VL.sellerReceives(0), 0);
  // The result is always the largest seller amount that fits the price.
  for (const price of [3, 4, 10, 23, 57, 99, 249, 1000, 12345]) {
    const seller = VL.sellerReceives(price);
    assert.ok(VL.buyerPays(seller) <= price, "fits for " + price);
    assert.ok(VL.buyerPays(seller + 1) > price, "largest for " + price);
  }
});

test("buildInventoryStats sums value and value after fees", () => {
  const stacks = [
    { appid: 730, hashName: "Key", name: "Key", marketable: true, count: 2 },
    { appid: 730, hashName: "Medal", name: "Medal", marketable: false, count: 1 },
    { appid: 753, hashName: "Card", name: "Card", marketable: true, count: 1 },
  ];
  const prices = {
    "730/Key": { cents: 115, text: "1,15€", at: 0 },
    "753/Card": { cents: null, text: "", at: 0 },
  };
  const stats = VL.buildInventoryStats(stacks, prices);
  assert.strictEqual(stats.value, 2.3);
  assert.strictEqual(stats.receive, 2);
  assert.strictEqual(stats.currency, "€");
  assert.strictEqual(stats.itemCount, 4);
  assert.strictEqual(stats.marketableCount, 2);
  assert.strictEqual(stats.pricedCount, 1);
  assert.strictEqual(stats.rows[0].total, 2.3);
  assert.strictEqual(stats.rows[2].price, null);
});

const historyRow = (id, sign, price, name, game) => `
  <div class="market_listing_row market_recent_listing_row" id="${id}">
    <div class="market_listing_left_cell market_listing_gainorloss">${sign}</div>
    <div class="market_listing_right_cell market_listing_their_price">
      <span class="market_table_value"><span class="market_listing_price">${price}</span></span>
    </div>
    <div class="market_listing_right_cell market_listing_listed_date can_combine">4 Nov</div>
    <div class="market_listing_right_cell market_listing_listed_date can_combine">2 Nov</div>
    <div class="market_listing_item_name_block">
      <span class="market_listing_item_name">${name}</span><br>
      <span class="market_listing_game_name">${game}</span>
    </div>
  </div>`;

test("parseMarketHistory reads purchases and sales and skips listings", () => {
  const doc = html(
    historyRow("history_row_1", "+", "1,50€", "Case Key", "Counter-Strike 2")
    + historyRow("history_row_2", "-", "2,10€", "Case Key", "Counter-Strike 2")
    + historyRow("history_row_3", "", "9,99€", "Case Key", "Counter-Strike 2")
    + historyRow("history_row_4", "−", "1,00€", "Card", "Steam")
  );
  const entries = VL.parseMarketHistory(doc);
  assert.strictEqual(entries.length, 3);
  assert.strictEqual(entries[2].action, "sold", "a typographic minus also means sold");
  assert.deepStrictEqual(entries[0], {
    id: "history_row_1", action: "bought", name: "Case Key", game: "Counter-Strike 2",
    amount: 1.5, currency: "€", dateText: "4 Nov",
  });
  assert.strictEqual(entries[1].action, "sold");
});

test("buildMarketStats gives profit and loss per item", () => {
  const e = (action, name, amount) => ({ id: "", action, name, game: "CS2", amount, currency: "€", dateText: "" });
  const stats = VL.buildMarketStats([
    e("bought", "Key", 1.1), e("bought", "Key", 1.2), e("sold", "Key", 1.4), e("sold", "Knife", 0.7),
  ]);
  assert.strictEqual(stats.bought, 2.3);
  assert.strictEqual(stats.sold, 2.1);
  assert.strictEqual(stats.net, -0.2);
  assert.strictEqual(stats.boughtCount, 2);
  assert.strictEqual(stats.soldCount, 2);
  const key = stats.rows.find((r) => r.name === "Key");
  assert.strictEqual(key.net, -0.9);
  assert.strictEqual(key.boughtCount, 2);
});

test("fetchMarketHistory stops at entries it already knows", async () => {
  const pages = [
    historyRow("r5", "+", "1,00€", "A", "G") + historyRow("r4", "-", "2,00€", "A", "G"),
    historyRow("r3", "+", "3,00€", "A", "G") + historyRow("r2", "+", "4,00€", "A", "G"),
  ];
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalSleep = VL.sleep;
  globalThis.DOMParser = class {
    parseFromString(text) { return html(text); }
  };
  VL.sleep = async () => {};
  globalThis.fetch = async (url) => {
    requests.push(url);
    const start = Number(new URL(url).searchParams.get("start"));
    const page = pages[start / 100] || "";
    return new Response(JSON.stringify({ success: true, total_count: 400, results_html: page }));
  };
  try {
    const known = [{ id: "r3", action: "bought", name: "A", game: "G", amount: 3, currency: "€", dateText: "" },
      { id: "r1", action: "bought", name: "A", game: "G", amount: 9, currency: "€", dateText: "" }];
    const result = await VL.fetchMarketHistory(known);
    assert.strictEqual(requests.length, 2);
    assert.strictEqual(result.complete, true);
    assert.deepStrictEqual(result.entries.map((x) => x.id), ["r5", "r4", "r2", "r3", "r1"]);
  } finally {
    globalThis.fetch = originalFetch;
    VL.sleep = originalSleep;
  }
});

test("a 429 answer stops loading with a clear message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 429 });
  try {
    await assert.rejects(VL.fetchPrice(730, "Key", 3), (error) => error.rateLimited === true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parseHistoryRows reads the purchase history table", () => {
  const doc = html(`<table>
    <tr class="wallet_table_row">
      <td class="wht_date">4. Nov. 2026</td>
      <td class="wht_items"><div>Hades</div><div class="wth_payment">Wallet</div></td>
      <td class="wht_type"><div>Kauf</div><div class="wth_payment">Geschenkkarte</div></td>
      <td class="wht_total">24,99€</td>
      <td class="wht_wallet_change"></td>
    </tr></table>`);
  const [t] = VL.parseHistoryRows(doc);
  assert.strictEqual(t.type, "purchase");
  assert.deepStrictEqual(t.items, ["Hades"]);
  assert.strictEqual(t.amount, 24.99);
  assert.strictEqual(t.date, Date.UTC(2026, 10, 4));
});

test("buildBalance combines store, market and inventory", () => {
  const community = {
    stacks: [{ appid: 730, hashName: "Key", name: "Key", marketable: true, count: 2 }],
    prices: { "730/Key": { cents: 115, text: "1,15€", at: 0 } },
    history: [{ id: "a", action: "sold", name: "X", game: "G", amount: 3.5, currency: "€", dateText: "" }],
  };
  const balance = VL.buildBalance({ spent: 100, currency: "€" }, community);
  assert.deepStrictEqual(balance, { inventoryReceive: 2, marketNet: 3.5, netCost: 94.5 });
  assert.strictEqual(VL.buildBalance({ spent: 100, currency: "€" }, null), null);
  assert.strictEqual(VL.buildBalance({ spent: 100, currency: "$" }, community), null);
});
