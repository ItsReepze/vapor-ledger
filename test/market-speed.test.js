// Measures how many requests and how much waiting the inventory and market
// tab needs, with a made up but typical account: 6 games' inventories,
// 260 marketable item stacks (200 Steam community items from 25 games,
// 60 game items) and 1,500 market history entries. Steam is replaced by a
// fake that answers instantly; the pauses Vapor Ledger makes between
// requests are added up instead of waited for.
// Run with: npm test (prints the numbers with --test-reporter=spec)
const test = require("node:test");
const assert = require("node:assert");
const { load, html } = require("./load.js");

const VL = load(["src/lib/util.js", "src/lib/i18n.js", "src/lib/request.js", "src/lib/community.js",
  "src/lib/market.js"]);

function makeStacks() {
  const stacks = [];
  for (let game = 1; game <= 25; game++) {
    for (let card = 1; card <= 8; card++) {
      stacks.push({ appid: 753, hashName: game + "-Card " + card, name: "Card", marketable: true, count: 1,
        feeApp: 1000 + game });
    }
  }
  for (let i = 1; i <= 60; i++) {
    stacks.push({ appid: 730, hashName: "Case " + i, name: "Case " + i, marketable: true, count: 1 + (i % 4) });
  }
  return stacks;
}

// A fake Steam: priceoverview, market search per game and market history.
function fakeSteam(log) {
  return async (url) => {
    const u = new URL(url);
    log.push(u.pathname);
    if (u.pathname === "/market/priceoverview/") {
      return new Response(JSON.stringify({ success: true, lowest_price: "0,50€" }));
    }
    if (u.pathname === "/market/search/render/") {
      const game = u.searchParams.get("category_753_Game[]").replace("tag_app_", "") - 1000;
      const results = [];
      for (let card = 1; card <= 8; card++) {
        results.push({ hash_name: game + "-Card " + card, sell_price: 12, sell_price_text: "0,12€" });
      }
      return new Response(JSON.stringify({ success: true, results }));
    }
    if (u.pathname === "/market/myhistory/render/") {
      return new Response(JSON.stringify({ success: true, total_count: 1500, results_html: "" }));
    }
    return new Response("{}", { status: 404 });
  };
}

async function measure(run) {
  const log = [];
  let waited = 0;
  const originalFetch = globalThis.fetch;
  const originalSleep = VL.sleep;
  globalThis.fetch = fakeSteam(log);
  globalThis.DOMParser = class {
    parseFromString(text) { return html(text); }
  };
  VL.sleep = async (ms) => { waited += ms; };
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    VL.sleep = originalSleep;
  }
  return { requests: log.length, seconds: Math.round(waited / 1000), log };
}

test("market prices: one request per game for community items, the rest one by one", async () => {
  const stacks = makeStacks();
  const before = 260 * 3.5; // 0.3.0: one priceoverview per stack, 3.5 s apart
  const known = {};
  const result = await measure(() => VL.fetchPrices(stacks, 3, known));
  console.log(`  prices: ${result.requests} requests, ${result.seconds} s waiting `
    + `(0.3.0: 260 requests, ${before} s)`);
  // 1 single price to learn the currency + 25 games + 59 other items
  assert.strictEqual(result.requests, 85);
  assert.ok(result.seconds <= 300);
  assert.strictEqual(Object.keys(known).length, 260);
  assert.strictEqual(known["753/3-Card 2"].cents, 12);

  // A second run within a day asks nothing.
  const again = await measure(() => VL.fetchPrices(stacks, 3, known));
  assert.strictEqual(again.requests, 0);
});

test("market history: 500 rows per request", async () => {
  const result = await measure(() => VL.fetchMarketHistory([]));
  console.log(`  history: ${result.requests} requests, ${result.seconds} s waiting (0.3.0: 15 requests, 49 s)`);
  assert.strictEqual(result.requests, 3);
});

test("batch prices in another currency are not used", async () => {
  const stacks = makeStacks().filter((s) => s.appid === 753).slice(0, 8);
  const known = { "730/x": { cents: 100, text: "1,00$", at: Date.now() } };
  const result = await measure(() => VL.fetchPrices(stacks, 1, known));
  // The search answered in €, the known prices are in $: every card is
  // asked on its own instead.
  assert.strictEqual(result.requests, 1 + 8);
});
