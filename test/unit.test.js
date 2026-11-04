// Unit tests for the parsing helpers. Run with: node --test test/unit.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// The extension files expect a browser-like global scope, so we load them
// into this context instead of using require().
for (const file of ["src/lib/util.js", "src/lib/stats.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
}
const VL = globalThis.VL;

test("parseAmount understands different price formats", () => {
  assert.strictEqual(VL.parseAmount("19,99€"), 19.99);
  assert.strictEqual(VL.parseAmount("$1,234.50"), 1234.5);
  assert.strictEqual(VL.parseAmount("1.234,50 €"), 1234.5);
  assert.strictEqual(VL.parseAmount("5,--€"), 5);
  assert.strictEqual(VL.parseAmount("-$1.00"), -1);
  assert.strictEqual(VL.parseAmount("+0,30€"), 0.3);
  assert.strictEqual(VL.parseAmount("1.234€"), 1234);
  assert.strictEqual(VL.parseAmount("R$ 10,00"), 10);
  assert.strictEqual(VL.parseAmount(""), null);
  assert.strictEqual(VL.parseAmount("Free"), null);
});

test("parseDate understands English and German dates", () => {
  const nov4 = Date.UTC(2026, 10, 4);
  assert.strictEqual(VL.parseDate("4 Nov, 2026"), nov4);
  assert.strictEqual(VL.parseDate("Nov 4, 2026"), nov4);
  assert.strictEqual(VL.parseDate("4. Nov. 2026"), nov4);
  assert.strictEqual(VL.parseDate("12. März 2019"), Date.UTC(2019, 2, 12));
  assert.strictEqual(VL.parseDate("1 Okt. 2020"), Date.UTC(2020, 9, 1));
  assert.strictEqual(VL.parseDate("nonsense"), null);
});

test("normalizeName ignores symbols and case", () => {
  assert.strictEqual(VL.normalizeName("DOOM® Eternal"), "doom eternal");
  assert.strictEqual(VL.normalizeName("Ori & the Blind Forest™"), "ori and the blind forest");
});

test("buildStats sums spending and matches single purchases", () => {
  const games = [
    { appid: 1, name: "Hades", minutes: 600, lastPlayed: null },
    { appid: 2, name: "Portal 2", minutes: 0, lastPlayed: null },
    { appid: 3, name: "Portal", minutes: 30, lastPlayed: null },
  ];
  const tx = (type, items, amount, extra) =>
    ({ date: Date.UTC(2025, 0, 1), type, items, amount, currency: "€", walletChange: null, ...extra });
  const transactions = [
    tx("purchase", ["Hades"], 20),
    tx("purchase", ["Portal 2"], 10),
    tx("purchase", ["Portal", "Some DLC"], 15),
    tx("refund", ["Portal 2"], 10),
    tx("wallet", ["10,00€ Wallet Credit"], 10),
    tx("market", ["Steam Community Market"], 2, { walletChange: 1.5 }),
  ];
  const stats = VL.buildStats(games, transactions);
  assert.strictEqual(stats.spent, 35);
  assert.strictEqual(stats.marketNet, 1.5);
  assert.strictEqual(stats.multiItemPurchases, 1);
  assert.strictEqual(stats.pileCount, 2);
  assert.strictEqual(stats.neverPlayedCount, 1);
  const hades = stats.games.find((g) => g.appid === 1);
  assert.strictEqual(hades.paid, 20);
  assert.strictEqual(hades.costPerHour, 2);
  assert.strictEqual(stats.games.find((g) => g.appid === 3).paid, null);
  // Portal 2 was refunded, so it has no price any more.
  assert.strictEqual(stats.games.find((g) => g.appid === 2).paid, null);
});

test("a refund only cancels the refunded purchase", () => {
  const games = [{ appid: 1, name: "Hades", minutes: 600, lastPlayed: null }];
  const tx = (type, amount) =>
    ({ date: Date.UTC(2025, 0, 1), type, items: ["Hades"], amount, currency: "€", walletChange: null });
  const stats = VL.buildStats(games, [tx("refund", 24.99), tx("purchase", 24.99), tx("purchase", 19.99)]);
  assert.strictEqual(stats.games[0].paid, 19.99);
  assert.strictEqual(stats.spent, 19.99);
});
