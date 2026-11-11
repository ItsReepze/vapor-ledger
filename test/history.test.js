// Tests for reading Steam's purchase history in several languages and
// currencies, with made up copies of Steam's pages in test/fixtures.
// Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const { load, fixture } = require("./load.js");

const VL = load(["src/lib/util.js", "src/lib/i18n.js", "src/lib/history.js", "src/lib/steam.js",
  "src/lib/stats.js"]);

const iso = (t) => new Date(t).toISOString().slice(0, 10);

test("the English page gives session, cursor and all transaction types", () => {
  const doc = fixture("history-en-usd.html");
  assert.deepStrictEqual(VL.readStoreSession(doc), {
    steamid: "76561190000000001",
    token: "fake-token-en",
    country: "US",
    sessionId: "0a1b2c3d4e5f60718293a4b5",
  });
  assert.strictEqual(VL.readHistoryCursor(doc).wallet_txnid, "1000000000000000050");

  const rows = VL.parseHistoryRows(doc);
  assert.deepStrictEqual(rows.map((t) => t.type),
    ["purchase", "purchase", "gift", "ingame", "refund", "purchase", "wallet", "market", "purchase"]);
  assert.deepStrictEqual(rows.map((t) => t.amount), [19.99, 17.5, 9.99, 4.99, 14.99, 14.99, 20, 1.12, 7.99]);
  assert.strictEqual(rows[0].currency, "$");
  assert.strictEqual(rows[8].currency, "£");
  assert.strictEqual(rows[0].transid, "1000000000000000101");
  assert.strictEqual(rows[7].transid, null);
  assert.deepStrictEqual(rows[1].items, ["Lantern Keeper - Soundtrack", "Orbit Garden"]);
  // The payment part ("$5.00 Wallet $12.50 PayPal") is not part of the type.
  assert.strictEqual(rows[1].typeText, "Purchase");
  assert.strictEqual(iso(rows[0].date), "2026-11-04");
  assert.strictEqual(rows[7].walletChange, 1.12);
});

test("the German page reads the same types, with a gift card payment that is no gift", () => {
  const doc = fixture("history-de-eur.html");
  const session = VL.readStoreSession(doc);
  assert.strictEqual(session.steamid, "76561190000000002");
  assert.strictEqual(session.sessionId, "b5a4f3e2d1c0b9a8f7e6d5c4");
  assert.strictEqual(VL.readHistoryCursor(doc), null);

  const rows = VL.parseHistoryRows(doc);
  assert.deepStrictEqual(rows.map((t) => t.type),
    ["purchase", "gift", "ingame", "refund", "wallet", "market", "purchase"]);
  assert.deepStrictEqual(rows.map((t) => iso(t.date)),
    ["2026-11-04", "2026-09-12", "2026-08-02", "2026-07-20", "2026-07-01", "2026-06-15", "2019-03-12"]);
  assert.strictEqual(rows[6].amount, 1234.5);
  assert.strictEqual(rows[5].walletChange, -0.85);
  assert.ok(rows.every((t) => t.currency === "€"));
});

test("rows in many languages and currencies are read by type, amount, currency and date", () => {
  const doc = fixture("history-more.html");
  const rows = VL.parseHistoryRows(doc);
  const expected = [...doc.querySelectorAll("tr.wallet_table_row")].map((tr) => tr.getAttribute("data-expect"));
  assert.strictEqual(rows.length, expected.length);
  rows.forEach((t, i) => {
    assert.strictEqual([t.type, t.amount, t.currency, iso(t.date)].join("|"), expected[i], "row " + (i + 1));
  });
});

test("a page without a logged in user gives no session", () => {
  const doc = fixture("history-de-eur.html");
  doc.getElementById("application_config").setAttribute("data-userinfo", "{\"logged_in\":false}");
  assert.strictEqual(VL.readStoreSession(doc), null);
});

test("parseDate understands the date formats of many store languages", () => {
  const nov4 = Date.UTC(2026, 10, 4);
  for (const text of ["4 Nov, 2026", "Nov 4, 2026", "4. Nov. 2026", "4 nov. 2026", "4 нояб. 2026 г.",
    "4 ноя. 2026", "2026年11月4日", "2026 年 11 月 4 日", "2026년 11월 4일", "4 thg 11, 2026", "4 lis 2026",
    "4. listopadu 2026", "4 de nov. de 2026", "4 Kas 2026", "2026. nov. 4."]) {
    assert.strictEqual(VL.parseDate(text), nov4, text);
  }
  assert.strictEqual(VL.parseDate("12. März 2019"), Date.UTC(2019, 2, 12));
  assert.strictEqual(VL.parseDate("4 juil. 2026"), Date.UTC(2026, 6, 4));
  assert.strictEqual(VL.parseDate("nonsense"), null);
});

test("purchases in another currency are never added to the main currency", () => {
  const rows = VL.parseHistoryRows(fixture("history-en-usd.html"));
  const games = [
    { appid: 1, name: "Lantern Keeper", minutes: 30, lastPlayed: null },
    { appid: 2, name: "Orbit Garden", minutes: 600, lastPlayed: null },
    { appid: 3, name: "Hollow Pines", minutes: 10, lastPlayed: null },
  ];
  const stats = VL.buildStats(games, rows, null);
  assert.strictEqual(stats.currency, "$");
  // 19.99 + 17.50 + 9.99 + 4.99 - 14.99 + 14.99, the £ purchase is apart.
  assert.strictEqual(stats.spent, 52.47);
  assert.deepStrictEqual(stats.otherCurrencies, { "£": { spent: 7.99, count: 1 } });
  // Orbit Garden was paid in £ only, so it has no price in $.
  assert.strictEqual(stats.games[1].paid, null);
  assert.strictEqual(stats.games[1].bought, Date.UTC(2019, 2, 3));
  assert.strictEqual(stats.games[0].paid, 19.99);
  assert.strictEqual(stats.byMonth["2026-07"], 0);
  assert.strictEqual(stats.byYear[2026], 52.47);
});
