// Tests for the pages of the extension page, in a small test DOM.
// Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const { parseHTML } = require("linkedom");
const { load } = require("./load.js");

const { window, document } = parseHTML("<!doctype html><html><body></body></html>");
globalThis.document = document;
globalThis.Node = window.Node;
globalThis.Event = window.Event;

const VL = load(["src/lib/util.js", "src/lib/i18n.js", "src/lib/community.js", "src/lib/market.js",
  "src/lib/stats.js", "src/lib/insights.js", "src/lib/export.js", "src/app/table.js", "src/app/charts.js",
  "src/app/views.js", "src/app/inventory.js"]);

function makeCommunity() {
  return {
    stacks: [
      { appid: 730, hashName: "Recoil Case", name: "Recoil Case", marketable: true, count: 3 },
      { appid: 730, hashName: "AK-47 | Slate", name: "AK-47 | Slate", marketable: true, count: 1 },
      { appid: 753, hashName: "Hades Card", name: "Hades Card", marketable: true, count: 2 },
    ],
    prices: {},
    history: [],
    historyComplete: true,
    fetchedAt: 0,
  };
}

const visibleItems = (page) =>
  [...page.querySelectorAll("section")[0].querySelectorAll("tbody tr")].map((tr) => tr.firstChild.textContent);

test("search text and focus survive price updates", () => {
  const data = makeCommunity();
  const page = VL.buildCommunityPage(data, document.createElement("div"), [], () => {});
  document.body.append(page);

  const search = page.querySelector("input[type=search]");
  search.value = "case";
  search.dispatchEvent(new Event("input"));
  assert.deepStrictEqual(visibleItems(page), ["Recoil Case"]);

  // Prices come in and the page updates, like every 10 prices while loading.
  data.prices["730/Recoil Case"] = { cents: 52, text: "0,52€", at: Date.now() };
  page.update();

  const searchAfter = page.querySelector("input[type=search]");
  assert.ok(searchAfter === search, "the search field is not rebuilt");
  assert.strictEqual(searchAfter.value, "case");
  assert.deepStrictEqual(visibleItems(page), ["Recoil Case"]);
  assert.match(page.querySelector("tbody tr").textContent, /1\.56 €/);
  page.remove();
});

test("sorting survives price updates and empty lists show a message", () => {
  const data = makeCommunity();
  const page = VL.buildCommunityPage(data, document.createElement("div"), [], () => {});
  page.querySelector("thead th button").dispatchEvent(new Event("click")); // sort by name, A to Z
  assert.deepStrictEqual(visibleItems(page), ["AK-47 | Slate", "Hades Card", "Recoil Case"]);
  data.prices["753/Hades Card"] = { cents: 8, text: "0,08€", at: Date.now() };
  page.update();
  assert.deepStrictEqual(visibleItems(page), ["AK-47 | Slate", "Hades Card", "Recoil Case"]);
  assert.match(page.querySelector(".tile .value").textContent, /0\.16 €/);
  assert.strictEqual(page.querySelector("th").getAttribute("aria-sort"), "ascending");

  data.stacks = [];
  page.update();
  assert.strictEqual(page.querySelectorAll(".empty")[0].hidden, false);
});

function makeView() {
  const now = Date.now();
  const games = [
    { appid: 1, name: "Lantern Keeper", minutes: 45, lastPlayed: now },
    { appid: 2, name: "Orbit Garden", minutes: 3000, lastPlayed: now },
    { appid: 3, name: "<img src=x onerror=alert(1)>", minutes: 0, lastPlayed: null },
  ];
  const tx = (type, items, amount, daysAgo) => ({ date: now - daysAgo * VL.DAY_MS, type, typeText: type, items,
    amount, currency: "€", walletChange: null, transid: null });
  const transactions = [tx("purchase", ["Lantern Keeper"], 19.99, 2), tx("purchase", ["Orbit Garden"], 30, 400),
    tx("purchase", ["<img src=x onerror=alert(1)>"], 5, 900), tx("purchase", ["Other"], 7, 10)];
  transactions.push({ ...tx("purchase", ["Orbit Garden"], 8.99, 700), currency: "$" });
  const store = { currency: "€", prices: { 2: { cents: 1999, regular: 3999, discount: 50 } } };
  const data = { games, transactions, store, fetchedAt: now, historyComplete: true };
  return { data, stats: VL.buildStats(games, transactions, store), steamid: "1", balance: null };
}

test("every page builds without errors and shows Steam text only as text", () => {
  const view = makeView();
  for (const key of ["overview", "refunds", "worth", "charts"]) {
    const node = VL.views[key](view);
    document.body.append(node);
    assert.ok(node.textContent.length > 50, key);
    assert.strictEqual(node.querySelector("img"), null, key + " must not turn names into HTML");
    node.remove();
  }
});

test("the refund page marks the recent game and links to Steam's help", () => {
  const node = VL.views.refunds(makeView());
  const cards = node.querySelectorAll(".card.refundable");
  assert.strictEqual(cards.length, 1);
  assert.match(cards[0].textContent, /Lantern Keeper/);
  assert.match(cards[0].textContent, /12 days/);
  assert.match(cards[0].textContent, /75 min/);
  assert.match(cards[0].querySelector("a").getAttribute("href"), /^https:\/\/help\.steampowered\.com\//);
  assert.match(node.textContent, /Steam decides every request itself/);
});

test("the overview keeps other currencies apart", () => {
  const node = VL.views.overview(makeView());
  assert.match(node.querySelector(".tile.warn").textContent, /8\.99 \$/);
  assert.match(node.querySelector(".tile.main .value").textContent, /61\.99 €/);
});

test("charts are SVG with a label, keyboard focus and a table", () => {
  const figure = VL.barChart("Test", [{ label: "a", value: 3 }, { label: "b", value: -1 }],
    (v) => String(v), "Label", "Value");
  const svg = figure.querySelector("svg");
  assert.strictEqual(svg.getAttribute("role"), "img");
  assert.strictEqual(svg.getAttribute("tabindex"), "0");
  assert.match(svg.getAttribute("aria-label"), /^Test\. Bar chart with 2 bars/);
  assert.strictEqual(svg.querySelectorAll("rect.bar").length, 2);
  assert.strictEqual(svg.querySelectorAll("rect.bar.negative").length, 1);
  assert.strictEqual(figure.querySelectorAll("details tbody tr").length, 2);
});
