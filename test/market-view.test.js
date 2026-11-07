// Tests for the community page: it must update in place while prices load.
// Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");

const { window, document } = parseHTML("<!doctype html><html><body></body></html>");
globalThis.document = document;
globalThis.Node = window.Node;
globalThis.Event = window.Event;

for (const file of ["src/lib/util.js", "src/lib/community.js", "src/lib/market.js",
  "src/content/dashboard.js", "src/content/market-view.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
}
const VL = globalThis.VL;

function makeData() {
  return {
    stacks: [
      { appid: 730, hashName: "Recoil Case", name: "Recoil Case", marketable: true, count: 3 },
      { appid: 730, hashName: "AK-47 | Slate", name: "AK-47 | Slate", marketable: true, count: 1 },
      { appid: 753, hashName: "Hades Card", name: "Hades Card", marketable: true, count: 2 },
    ],
    prices: {},
    history: [],
    historyComplete: true,
  };
}

const visibleItems = (page) =>
  [...page.querySelectorAll("section")[1].querySelectorAll("tbody tr")]
    .map((tr) => tr.firstChild.textContent);

test("search text and focus survive price updates", () => {
  const data = makeData();
  const page = VL.buildCommunityPage(data, document.createElement("div"), []);
  document.body.append(page);

  const search = page.querySelector("input[type=search]");
  search.value = "case";
  search.dispatchEvent(new Event("input"));
  assert.deepStrictEqual(visibleItems(page), ["Recoil Case"]);

  // Prices come in and the page updates, like every 10 prices while loading.
  data.prices["730/Recoil Case"] = { cents: 52, text: "0,52€", at: Date.now() };
  page.update();

  // The same field is still in the page, so the browser keeps the focus
  // and the cursor in it. (The test DOM has no focus handling itself.)
  const searchAfter = page.querySelector("input[type=search]");
  assert.ok(searchAfter === search, "the search field is not rebuilt");
  assert.ok(search.isConnected, "the search field is still in the page");
  assert.strictEqual(searchAfter.value, "case");
  assert.deepStrictEqual(visibleItems(page), ["Recoil Case"]);
  assert.match(page.querySelector("tbody tr").textContent, /1,56/);
  page.remove();
});

test("sorting survives price updates and the currency appears", () => {
  const data = makeData();
  const page = VL.buildCommunityPage(data, document.createElement("div"), []);
  const nameHeader = page.querySelector("thead th");
  nameHeader.dispatchEvent(new Event("click")); // sort by name, A to Z
  assert.deepStrictEqual(visibleItems(page), ["AK-47 | Slate", "Hades Card", "Recoil Case"]);

  data.prices["753/Hades Card"] = { cents: 8, text: "0,08€", at: Date.now() };
  page.update();
  assert.deepStrictEqual(visibleItems(page), ["AK-47 | Slate", "Hades Card", "Recoil Case"]);
  assert.match(page.querySelector(".tile .value").textContent, /0,16 €|0\.16 €/);
});

test("empty inventory shows a message instead of a table", () => {
  const data = makeData();
  data.stacks = [];
  const page = VL.buildCommunityPage(data, document.createElement("div"), []);
  const section = page.querySelectorAll("section")[1];
  assert.strictEqual(section.querySelector(".list").hidden, false);
  data.stacks = makeData().stacks;
  page.update();
  assert.strictEqual(section.querySelector(".list").hidden, true);
});
