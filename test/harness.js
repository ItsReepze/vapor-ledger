// Made up data for test/harness.html, a copy of Steam's account page.
// It replaces every function that talks to Steam, so the page can be tried
// and screenshotted without a Steam account. All names, ids and amounts are invented.
/* global VL */

(async function () {
  const lang = new URLSearchParams(location.search).get("lang") === "de" ? "de" : "en";
  VL.messages = await (await fetch("../_locales/" + lang + "/messages.json")).json();
  VL.messagesLocale = lang === "de" ? "de-DE" : "en-US";
  const currency = lang === "de" ? "€" : "$";

  // Fake chrome.storage, so the cache works outside an extension.
  const store = {};
  window.chrome = { storage: { local: {
    get: async (keys) => Object.fromEntries([].concat(keys).map((key) => [key, store[key]])),
    set: async (obj) => Object.assign(store, obj),
    remove: async (key) => { delete store[key]; },
    clear: async () => { for (const key of Object.keys(store)) delete store[key]; },
  } } };

  // Small seeded random numbers, so every load shows the same data.
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const day = 24 * 60 * 60 * 1000;
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const names = ["Lantern Keeper", "Orbit Garden", "Hollow Pines", "Dust Raiders", "Ember Tactics",
    "Tidewater Tales", "Neon Courier", "Glass Citadel", "Moss and Iron", "Starward Drift", "Quiet Harbor",
    "Pixel Foundry", "Frostline", "Copper Crown", "Ashen Vale", "Rift Runners", "Paper Lanterns",
    "Night Bazaar", "Cinder Road", "Salt and Sails", "Gearwright", "Velvet Heist", "Echo Mines", "Lumen Drift",
    "Sky Orchard", "Iron Psalm", "Bramble Knight", "Circuit Saint", "Deep Current", "Marble Run Deluxe",
    "Tiny Tavern", "Comet Kitchen", "Harbor Lights", "Wyrm Valley", "Signal Lost", "Patchwork Planet"];
  const prices = [4.99, 9.99, 14.99, 19.99, 24.99, 29.99, 39.99, 59.99];
  const games = names.map((name, i) => {
    const r = random();
    const minutes = i % 5 === 3 ? 0 : Math.round(r * r * r * 30000 + random() * 300);
    return { appid: 1000 + i, name, minutes, lastPlayed: minutes ? today - Math.round(random() * 400) * day : null };
  });
  games[0].minutes = 45; // bought 3 days ago, still refundable
  games[21].minutes = 0; // bought 9 days ago, never started
  games[3].minutes = 9100; // the game with the in-game purchases

  const transactions = [];
  const add = (date, type, items, amount, extra) => transactions.push({
    date, type, typeText: type, items, amount, currency, walletChange: null, transid: null, ...extra,
  });
  add(today - 3 * day, "purchase", ["Lantern Keeper"], 19.99, { transid: "1" });
  add(today - 9 * day, "purchase", ["Velvet Heist", "Velvet Heist - Art Book"], 27.48, { transid: "2" });
  games.forEach((game, i) => {
    if (i === 0 || i === 21 || i % 7 === 6) return; // some came from keys or bundles
    const date = today - Math.round(30 + random() * 1700) * day;
    const price = prices[Math.floor(random() * prices.length)];
    const paid = random() < 0.5 ? Math.round(price * (0.25 + random() * 0.5) * 100) / 100 : price;
    add(date, "purchase", [game.name], paid);
  });
  for (let i = 0; i < 14; i++) {
    add(today - Math.round(random() * 1700) * day, "ingame", ["Dust Raiders"], [4.99, 9.99, 1.99][i % 3]);
  }
  for (let i = 0; i < 4; i++) add(today - Math.round(random() * 1500) * day, "gift", ["Tiny Tavern"], 9.99);
  add(today - 400 * day, "purchase", ["Signal Lost", "Patchwork Planet", "Comet Kitchen"], 34.97);
  add(today - 380 * day, "refund", ["Frostline"], 14.99);
  add(today - 381 * day, "purchase", ["Frostline"], 14.99);
  add(today - 200 * day, "wallet", ["20,00 Wallet"], 20);
  add(today - 150 * day, "market", ["Steam Community Market"], 3.4, { walletChange: 2.15 });
  transactions.sort((a, b) => b.date - a.date);

  // Last played lies between the first purchase and today.
  for (const game of games) {
    if (!game.minutes) continue;
    const t = transactions.filter((x) => x.items.includes(game.name)).pop();
    const from = t ? t.date : today - 1800 * day;
    game.lastPlayed = from + Math.round(random() * (today - from) / day) * day;
  }

  const storePrices = {};
  games.forEach((game, i) => {
    if (i % 9 === 8) return; // no longer sold
    const regular = Math.round(prices[i % prices.length] * 100);
    const discount = i % 4 === 0 ? 50 : 0;
    storePrices[game.appid] = { cents: Math.round(regular * (1 - discount / 100)), regular, discount,
      formatted: "", free: false };
  });

  const steamid = "76561190000000000";
  VL.openHistoryPage = async () => ({ doc: null, session: { steamid, token: "x", country: "US", sessionId: "x" } });
  VL.fetchOwnedGames = async () => games;
  VL.fetchPurchaseHistory = async () => ({ transactions, complete: true });
  VL.fetchStorePrices = async () => ({ prices: storePrices, currency, country: "US", fetchedAt: Date.now() });

  const items = [["Fracture Case", 730, 14, 0.42], ["Case Key", 730, 3, 2.49], ["Neon Rider Sticker", 730, 2, 6.1],
    ["Lantern Keeper Trading Card", 753, 5, 0.09], ["Orbit Garden Background", 753, 1, 0.31],
    ["Mann Co. Key", 440, 2, 2.2], ["Gilded Helmet", 570, 1, 4.75], ["Rusty Crate", 252490, 6, 0.18]];
  VL.openCommunity = async () => ({ steamid, currency: 3 });
  VL.fetchInventories = async () => items.map(([name, appid, count]) => ({
    appid, name, hashName: name, type: "", marketable: true, count, icon: "" }));
  VL.fetchMarketHistory = async () => ({ complete: true, entries: [
    { id: "a", action: "sold", name: "Fracture Case", game: "Counter-Strike 2", amount: 0.48, currency },
    { id: "b", action: "bought", name: "Neon Rider Sticker", game: "Counter-Strike 2", amount: 4.2, currency },
    { id: "c", action: "sold", name: "Mann Co. Key", game: "Team Fortress 2", amount: 2.05, currency },
    { id: "d", action: "bought", name: "Gilded Helmet", game: "Dota 2", amount: 5.9, currency },
  ] });
  VL.fetchPrices = async (stacks, cur, known) => {
    for (const [name, appid, , price] of items) {
      known[appid + "/" + name] = { cents: Math.round(price * 100), text: price + currency, at: Date.now() };
    }
    return known;
  };

  if (!VL.ledgerTab(location.hash)) location.hash = VL.LEDGER_HASH;
  VL.startLedger();
})();
