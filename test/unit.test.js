// Unit tests for amounts, statistics, refunds, rankings, charts data,
// recap and export. Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { load, root } = require("./load.js");

const VL = load(["src/lib/util.js", "src/lib/i18n.js", "src/lib/stats.js", "src/lib/prices.js",
  "src/lib/insights.js", "src/lib/export.js", "src/ledger/recap.js"]);

const tx = (type, items, amount, extra) =>
  ({ date: Date.UTC(2025, 0, 1), type, typeText: type, items, amount, currency: "€", walletChange: null,
    transid: null, ...extra });

test("parseAmount understands different price formats", () => {
  assert.strictEqual(VL.parseAmount("19,99€"), 19.99);
  assert.strictEqual(VL.parseAmount("$1,234.50"), 1234.5);
  assert.strictEqual(VL.parseAmount("1.234,50 €"), 1234.5);
  assert.strictEqual(VL.parseAmount("5,--€"), 5);
  assert.strictEqual(VL.parseAmount("-$1.00"), -1);
  assert.strictEqual(VL.parseAmount("+0,30€"), 0.3);
  assert.strictEqual(VL.parseAmount("1.234€"), 1234);
  assert.strictEqual(VL.parseAmount("R$ 10,00"), 10);
  assert.strictEqual(VL.parseAmount("1 234,50 €"), 1234.5);
  assert.strictEqual(VL.parseAmount("1 299 pуб."), 1299);
  assert.strictEqual(VL.parseAmount("¥ 1,980"), 1980);
  assert.strictEqual(VL.parseAmount("165.000₫"), 165000);
  assert.strictEqual(VL.parseCurrency("19,99 €"), "€");
  assert.strictEqual(VL.parseCurrency("1 299 pуб."), "pуб");
  assert.strictEqual(VL.parseAmount(""), null);
  assert.strictEqual(VL.parseAmount("Free"), null);
});

test("normalizeName ignores symbols and case, also outside Latin script", () => {
  assert.strictEqual(VL.normalizeName("DOOM® Eternal"), "doom eternal");
  assert.strictEqual(VL.normalizeName("Ori & the Blind Forest™"), "ori and the blind forest");
  assert.strictEqual(VL.normalizeName("Мор (Утопия)"), "мор утопия");
});

test("buildStats sums spending and matches single purchases", () => {
  const games = [
    { appid: 1, name: "Hades", minutes: 600, lastPlayed: null },
    { appid: 2, name: "Portal 2", minutes: 0, lastPlayed: null },
    { appid: 3, name: "Portal", minutes: 30, lastPlayed: null },
  ];
  const stats = VL.buildStats(games, [
    tx("purchase", ["Hades"], 20),
    tx("purchase", ["Portal 2"], 10),
    tx("purchase", ["Portal", "Some DLC"], 15),
    tx("refund", ["Portal 2"], 10),
    tx("wallet", ["10,00€ Wallet Credit"], 10),
    tx("market", ["Steam Community Market"], 2, { walletChange: 1.5 }),
  ]);
  assert.strictEqual(stats.spent, 35);
  assert.strictEqual(stats.marketNet, 1.5);
  assert.strictEqual(stats.multiItemPurchases, 1);
  assert.strictEqual(stats.pileCount, 2);
  assert.strictEqual(stats.neverPlayedCount, 1);
  const hades = stats.games.find((g) => g.appid === 1);
  assert.strictEqual(hades.paid, 20);
  assert.strictEqual(hades.costPerHour, 2);
  assert.strictEqual(stats.games.find((g) => g.appid === 3).paid, null);
  assert.strictEqual(stats.games.find((g) => g.appid === 3).bought, Date.UTC(2025, 0, 1));
  // Portal 2 was refunded, so it has no price any more.
  assert.strictEqual(stats.games.find((g) => g.appid === 2).paid, null);
});

test("a refund only cancels the refunded purchase", () => {
  const games = [{ appid: 1, name: "Hades", minutes: 600, lastPlayed: null }];
  const stats = VL.buildStats(games, [tx("refund", ["Hades"], 24.99), tx("purchase", ["Hades"], 24.99),
    tx("purchase", ["Hades"], 19.99)]);
  assert.strictEqual(stats.games[0].paid, 19.99);
  assert.strictEqual(stats.spent, 19.99);
});

test("parseStoreItems reads prices, regular prices, free games and skips removed games", () => {
  const prices = VL.parseStoreItems({ response: { store_items: [
    { appid: 10, success: 1, best_purchase_option: {
      final_price_in_cents: "999", original_price_in_cents: "1999", formatted_final_price: "9,99€",
      discount_pct: 50 } },
    { appid: 11, success: 1, best_purchase_option: { final_price_in_cents: "750", discount_pct: 25 } },
    { appid: 20, success: 1, is_free: true },
    { appid: 30, success: 1, visible: false },
    { appid: 40, success: 2 },
    null,
  ] } });
  assert.deepStrictEqual(prices[10], { cents: 999, regular: 1999, formatted: "9,99€", discount: 50, free: false });
  assert.strictEqual(prices[11].regular, 1000);
  assert.strictEqual(prices[20].cents, 0);
  assert.strictEqual(prices[30], undefined);
  assert.strictEqual(prices[40], undefined);
  assert.deepStrictEqual(VL.parseStoreItems({}), {});
});

test("buildStats adds store value and cost per hour", () => {
  const games = [
    { appid: 1, name: "Hades", minutes: 600, lastPlayed: null },
    { appid: 2, name: "Portal 2", minutes: 0, lastPlayed: null },
    { appid: 3, name: "Gone Game", minutes: 0, lastPlayed: null },
  ];
  const store = { currency: "€", prices: { 1: { cents: 2499, regular: 2499, discount: 0 },
    2: { cents: 499, regular: 998, discount: 50 } } };
  const stats = VL.buildStats(games, [tx("purchase", ["Hades"], 20)], store);
  assert.ok(stats.hasStorePrices);
  assert.ok(stats.storeSameCurrency);
  assert.strictEqual(stats.storeValue, 29.98);
  assert.strictEqual(stats.pileStoreValue, 4.99);
  assert.strictEqual(stats.storePricedCount, 2);
  assert.strictEqual(stats.costPerHour, 2);
  assert.strictEqual(stats.games[1].storeRegular, 9.98);
  assert.strictEqual(stats.games[2].storePrice, null);
  assert.strictEqual(VL.buildStats(games, [tx("purchase", ["Hades"], 20)]).hasStorePrices, false);
});

test("findRefundable lists recent purchases with less than 2 hours played", () => {
  const now = Date.UTC(2026, 10, 11, 15);
  const day = (d) => Date.UTC(2026, 10, d);
  const games = [
    { appid: 1, name: "Lantern Keeper", minutes: 45 },
    { appid: 2, name: "Orbit Garden", minutes: 300 },
    { appid: 3, name: "Hollow Pines", minutes: 0 },
    { appid: 4, name: "Old Game", minutes: 0 },
    { appid: 5, name: "Dust Raiders", minutes: 5 },
  ];
  const found = VL.findRefundable(games, [
    tx("purchase", ["Lantern Keeper"], 19.99, { date: day(4), transid: "77" }),
    tx("purchase", ["Orbit Garden", "Lantern Keeper - Soundtrack"], 30, { date: day(10) }),
    tx("refund", ["Hollow Pines"], 9.99, { date: day(9) }),
    tx("purchase", ["Hollow Pines"], 9.99, { date: day(8) }),
    tx("purchase", ["Old Game"], 5, { date: Date.UTC(2026, 9, 20) }),
    tx("gift", ["Dust Raiders"], 5, { date: day(10) }),
    tx("ingame", ["Dust Raiders"], 5, { date: day(10) }),
  ], now);
  assert.deepStrictEqual(found.games.map((g) => [g.name, g.daysLeft, g.minutesLeft, g.amount]),
    [["Lantern Keeper", 7, 75, 19.99]]);
  assert.strictEqual(VL.refundHelpUrl(found.games[0]),
    "https://help.steampowered.com/wizard/HelpWithPurchase?transid=77");
  // The soundtrack is not a game in the library, so its playtime is unknown.
  assert.deepStrictEqual(found.others.map((o) => [o.name, o.daysLeft, o.amount]),
    [["Lantern Keeper - Soundtrack", 13, null]]);

  // On the last day there are 0 days left, the day after it is gone.
  const lastDay = VL.findRefundable(games, [tx("purchase", ["Hollow Pines"], 1, { date: day(1) })],
    Date.UTC(2026, 10, 15, 20));
  assert.strictEqual(lastDay.games[0].daysLeft, 0);
  assert.strictEqual(VL.findRefundable(games, [tx("purchase", ["Hollow Pines"], 1, { date: day(1) })],
    Date.UTC(2026, 10, 16, 1)).games.length, 0);
});

test("worthRanking and discountSavings", () => {
  const games = [
    { appid: 1, name: "A", minutes: 6000 },
    { appid: 2, name: "B", minutes: 0 },
    { appid: 3, name: "C", minutes: 120 },
    { appid: 4, name: "D", minutes: 30 },
  ];
  const store = { currency: "€", prices: { 1: { cents: 1000, regular: 4000 }, 2: { cents: 500, regular: 500 },
    3: { cents: 100, regular: 1000 } } };
  const stats = VL.buildStats(games, [tx("purchase", ["A"], 30), tx("purchase", ["B"], 10),
    tx("purchase", ["C"], 4), tx("purchase", ["D"], 2)], store);
  const ranking = VL.worthRanking(stats, 10);
  assert.deepStrictEqual(ranking.best.map((g) => g.name), ["A", "C"]);
  assert.deepStrictEqual(ranking.worst.map((g) => g.name), ["B", "C", "D", "A"]);
  assert.strictEqual(ranking.worst[0].perHour, 10);

  const savings = VL.discountSavings(stats);
  assert.strictEqual(savings.total, 16);
  assert.strictEqual(savings.compared, 3);
  assert.strictEqual(savings.cheaper, 2);
  assert.deepStrictEqual(savings.top.map((g) => [g.name, g.saved]), [["A", 10], ["C", 6]]);

  const otherStore = VL.buildStats(games, [tx("purchase", ["A"], 30)], { ...store, currency: "$" });
  assert.strictEqual(VL.discountSavings(otherStore), null);
});

test("chart series fill empty months and add up", () => {
  const games = [{ appid: 1, name: "A", minutes: 0 }, { appid: 2, name: "B", minutes: 30 },
    { appid: 3, name: "C", minutes: 200 }, { appid: 4, name: "D", minutes: 7000 }];
  const stats = VL.buildStats(games, [
    tx("purchase", ["A"], 10, { date: Date.UTC(2025, 10, 3) }),
    tx("purchase", ["B"], 5, { date: Date.UTC(2026, 1, 3) }),
    tx("refund", ["B"], 5, { date: Date.UTC(2026, 1, 4) }),
    tx("purchase", ["C"], 7.5, { date: Date.UTC(2026, 2, 1) }),
  ]);
  assert.deepStrictEqual(VL.monthSeries(stats).map((p) => p.key + "=" + p.value),
    ["2025-11=10", "2025-12=0", "2026-01=0", "2026-02=0", "2026-03=7.5"]);
  assert.strictEqual(VL.monthSeries(stats, 2026).length, 12);
  assert.deepStrictEqual(VL.cumulativeSeries(stats).map((p) => p.value), [10, 10, 10, 10, 17.5]);
  assert.deepStrictEqual(VL.yearSeries(stats), [{ key: "2025", value: 10 }, { key: "2026", value: 7.5 }]);
  assert.deepStrictEqual(VL.playtimeBuckets(games).map((b) => b.value), [1, 1, 1, 0, 0, 0, 1]);
  assert.deepStrictEqual(VL.recapYears(stats), [2026, 2025]);
});

test("the recap shows totals only, game names only when chosen", () => {
  const games = [{ appid: 1, name: "Hades", minutes: 600 }, { appid: 2, name: "Portal 2", minutes: 0 }];
  const transactions = [
    tx("purchase", ["Hades"], 20, { date: Date.UTC(2025, 3, 1) }),
    tx("purchase", ["Portal 2"], 5, { date: Date.UTC(2024, 3, 1) }),
    tx("refund", ["Other"], 3, { date: Date.UTC(2025, 4, 1) }),
  ];
  const stats = VL.buildStats(games, transactions);
  const year = VL.recapData(stats, transactions, 2025, false);
  assert.strictEqual(year.spent, 17);
  assert.strictEqual(year.purchases, 1);
  assert.strictEqual(year.refunds, 1);
  assert.strictEqual(year.gameCount, 1);
  assert.strictEqual(year.minutes, 600);
  assert.strictEqual(year.bars.length, 12);
  const figures = VL.recapFigures(year);
  assert.deepStrictEqual(figures.map((f) => f[0]), ["Spent", "Games bought", "Played so far", "Per hour played"]);
  assert.doesNotMatch(JSON.stringify([year, figures]), /Hades|Portal|7656/);

  const all = VL.recapData(stats, transactions, null, true);
  assert.strictEqual(all.spent, 22);
  assert.deepStrictEqual(all.top, [{ name: "Hades", minutes: 600 }]);
});

test("CSV export escapes cells and blocks spreadsheet formulas", () => {
  const csv = VL.toCsv(["a", "b"], [["=HYPERLINK(\"x\")", "Hello, \"you\""], [-1.5, null]]);
  assert.strictEqual(csv, "a,b\r\n\"'=HYPERLINK(\"\"x\"\")\",\"Hello, \"\"you\"\"\"\r\n-1.5,\r\n");
  const rows = VL.transactionsCsv([tx("purchase", ["A", "B"], 3)]).split("\r\n");
  assert.strictEqual(rows[1], "2025-01-01,purchase,purchase,A | B,3,€,");
});

test("the JSON export has no Steam ID or token", () => {
  const games = [{ appid: 1, name: "Hades", minutes: 600 }];
  const data = { games, transactions: [tx("purchase", ["Hades"], 20)], fetchedAt: 0 };
  const json = VL.exportJson(data, VL.buildStats(games, data.transactions));
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.games[0].paid, 20);
  assert.doesNotMatch(json, /steamid|token/i);
});

test("English and German texts have the same keys and placeholders", () => {
  const read = (lang) => JSON.parse(fs.readFileSync(path.join(root, "_locales", lang, "messages.json"), "utf8"));
  const en = read("en");
  const de = read("de");
  assert.deepStrictEqual(Object.keys(de).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    const holes = (m) => (m.match(/\{\d\}/g) || []).sort().join();
    assert.strictEqual(holes(de[key].message), holes(en[key].message), key);
    assert.match(key, /^[A-Za-z0-9_]+$/);
    assert.doesNotMatch(en[key].message + de[key].message, /\$/, key + " must not use $ (chrome.i18n)");
  }
});

test("every text the code asks for exists", () => {
  const en = JSON.parse(fs.readFileSync(path.join(root, "_locales/en/messages.json"), "utf8"));
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = dir + "/" + entry.name;
      if (entry.isDirectory()) walk(rel);
      else if (rel.endsWith(".js")) files.push(rel);
    }
  };
  walk("src");
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    for (const [, key] of source.matchAll(/VL\.t\("([A-Za-z0-9_]+)"/g)) {
      if (["tab_", "bucket", "set_", "htType_"].includes(key)) continue; // built from a list, checked below
      assert.ok(en[key], file + " uses missing text " + key);
    }
  }
  for (const tab of ["overview", "spending", "games", "refunds", "inventory", "recap", "settings"]) assert.ok(en["tab_" + tab]);
  for (const type of ["purchase", "gift", "ingame", "refund", "wallet", "market", "other"]) assert.ok(en["htType_" + type]);
  for (const key of ["headerLink", "profileEdit", "historyTools", "licensesTools", "steamdbLinks", "itad"]) {
    assert.ok(en["set_" + key] && en["set_" + key + "_hint"], key);
  }
  for (const b of VL.PLAYTIME_BUCKETS) assert.ok(en["bucket" + b.key.replace(/[^0-9a-z]/gi, "_")], b.key);
});
