// Turns the raw data (games + transactions) into the numbers we show.

var VL = globalThis.VL || {};
globalThis.VL = VL;

// Games with less playtime than this count as "pile of shame".
VL.PILE_OF_SHAME_MINUTES = 60;

// Types that count as money spent. Wallet top-ups are not counted,
// otherwise a game bought with wallet money would be counted twice.
VL.SPENDING_TYPES = ["purchase", "gift", "ingame"];

// Builds a lookup that finds the owned game for an item name from the
// purchase history. First an exact match, then (unless exact is set) the
// longest game name the item starts with, so "Hades - Original Soundtrack"
// still counts for "Hades".
VL.gameMatcher = function (games) {
  const byName = new Map();
  for (const game of games) byName.set(VL.normalizeName(game.name), game);
  const sorted = [...byName.keys()].sort((a, b) => b.length - a.length);
  return function (itemName, exact) {
    const name = VL.normalizeName(itemName);
    if (byName.has(name)) return byName.get(name);
    if (exact) return null;
    for (const gameName of sorted) {
      if (gameName.length >= 4 && name.startsWith(gameName + " ")) return byName.get(gameName);
    }
    return null;
  };
};

// The currency most purchases were made in. Amounts in other currencies
// are never added to it, they are shown on their own.
VL.mainCurrency = function (transactions) {
  const counts = {};
  for (const t of transactions) {
    if (!t.currency || !VL.SPENDING_TYPES.includes(t.type)) continue;
    counts[t.currency] = (counts[t.currency] || 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (best) return best[0];
  return (transactions.find((t) => t.currency) || {}).currency || "";
};

// Net spending of one transaction: positive for purchases, negative for
// refunds, 0 for everything that is not counted.
VL.spendingOf = function (t) {
  if (VL.SPENDING_TYPES.includes(t.type)) return t.amount;
  if (t.type === "refund") return -t.amount;
  return 0;
};

const cents = (v) => Math.round(v * 100);

// store is optional: the result of VL.fetchStorePrices, or null.
VL.buildStats = function (games, transactions, store) {
  const currency = VL.mainCurrency(transactions);

  // Money, summed in cents so thousands of rows add no rounding errors.
  const byType = { purchase: 0, gift: 0, ingame: 0, refund: 0, wallet: 0, market: 0, other: 0 };
  const byYear = {};
  const byMonth = {};
  const otherCurrencies = {};
  let marketNet = 0;
  let multiItemPurchases = 0;

  const findGame = VL.gameMatcher(games);
  const paid = new Map(); // appid -> cents
  const refunded = new Map(); // appid -> cents
  const bought = new Map(); // appid -> date of the first purchase

  // Labels of entries we could not recognize, with how often they appear.
  const unknownTypes = {};

  for (const t of transactions) {
    if (t.type === "other") {
      const label = t.typeText || "(empty)";
      unknownTypes[label] = (unknownTypes[label] || 0) + 1;
    }

    // The purchase date counts in any currency.
    if (t.type === "purchase" && t.date) {
      for (const item of t.items) {
        const game = findGame(item);
        if (game && (!bought.has(game.appid) || t.date < bought.get(game.appid))) bought.set(game.appid, t.date);
      }
    }

    if (t.currency && currency && t.currency !== currency) {
      const other = otherCurrencies[t.currency] || (otherCurrencies[t.currency] = { spent: 0, count: 0 });
      other.spent += cents(VL.spendingOf(t));
      other.count++;
      continue;
    }

    if (t.type === "market") {
      marketNet += cents(t.walletChange || 0);
      byType.market += cents(t.amount);
      continue;
    }
    byType[t.type] += cents(t.amount);

    const net = cents(VL.spendingOf(t));
    if (net !== 0 && t.date) {
      const year = new Date(t.date).getUTCFullYear();
      const month = VL.monthKey(t.date);
      byYear[year] = (byYear[year] || 0) + net;
      byMonth[month] = (byMonth[month] || 0) + net;
    }

    // Only purchases with a single item can be assigned to one game.
    // A cart with several games only tells us the total, not each price.
    if (t.type === "purchase" || t.type === "ingame") {
      if (t.items.length === 1) {
        const game = findGame(t.items[0]);
        if (game) paid.set(game.appid, (paid.get(game.appid) || 0) + cents(t.amount));
      } else if (t.items.length > 1) {
        multiItemPurchases++;
      }
    }

    // Refunds are collected first and taken off at the end, because Steam
    // lists the newest entries first and the refund comes before the purchase.
    if (t.type === "refund" && t.items.length === 1) {
      const game = findGame(t.items[0]);
      if (game) refunded.set(game.appid, (refunded.get(game.appid) || 0) + cents(t.amount));
    }
  }

  for (const [appid, amount] of refunded) {
    if (!paid.has(appid)) continue;
    const rest = paid.get(appid) - amount;
    if (rest > 0) paid.set(appid, rest);
    else paid.delete(appid);
  }

  const toMoney = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v / 100]));
  const spent = (byType.purchase + byType.gift + byType.ingame - byType.refund) / 100;

  // Games
  const storePrices = (store && store.prices) || {};
  const storeCurrency = (store && store.currency) || "";
  const rows = games.map((game) => {
    const amount = paid.has(game.appid) ? paid.get(game.appid) / 100 : null;
    const hours = game.minutes / 60;
    const price = storePrices[game.appid];
    return {
      ...game,
      paid: amount,
      bought: bought.get(game.appid) || null,
      // Today's store price, null if Steam doesn't sell the game any more.
      storePrice: price ? price.cents / 100 : null,
      storeRegular: price ? (price.regular ?? price.cents) / 100 : null,
      storeDiscount: price ? price.discount : 0,
      costPerHour: amount !== null && hours >= 1 ? amount / hours : null,
      shame: game.minutes < VL.PILE_OF_SHAME_MINUTES,
    };
  });

  const totalMinutes = rows.reduce((sum, g) => sum + g.minutes, 0);
  const pile = rows.filter((g) => g.shame);
  const sumCents = (list, key) => list.reduce((sum, g) => sum + cents(g[key] || 0), 0) / 100;

  return {
    currency,
    spent,
    byType: toMoney(byType),
    byYear: toMoney(byYear),
    byMonth: toMoney(byMonth),
    otherCurrencies: Object.fromEntries(Object.entries(otherCurrencies)
      .map(([c, o]) => [c, { spent: o.spent / 100, count: o.count }])),
    marketNet: marketNet / 100,
    multiItemPurchases,
    unknownTypes,
    transactionCount: transactions.length,
    games: rows,
    gameCount: rows.length,
    totalMinutes,
    pileCount: pile.length,
    neverPlayedCount: rows.filter((g) => g.minutes === 0).length,
    pilePaid: sumCents(pile, "paid"),
    matchedCount: rows.filter((g) => g.paid !== null).length,
    hasStorePrices: Boolean(store),
    storeCurrency,
    // Store prices are only compared with what was paid if both use the
    // same currency.
    storeSameCurrency: Boolean(store) && (!storeCurrency || !currency || storeCurrency === currency),
    storeValue: sumCents(rows, "storePrice"),
    pileStoreValue: sumCents(pile, "storePrice"),
    storePricedCount: rows.filter((g) => g.storePrice !== null && g.storePrice > 0).length,
    // Spent per hour played over the whole account.
    costPerHour: totalMinutes >= 60 ? spent / (totalMinutes / 60) : null,
  };
};

// Combines the store stats with the inventory and market data from
// steamcommunity.com. Returns null if there is no community data yet or
// the currencies don't match.
VL.buildBalance = function (stats, community) {
  if (!community || !community.stacks || !VL.buildInventoryStats) return null;
  const inventory = VL.buildInventoryStats(community.stacks, community.prices || {});
  const market = VL.buildMarketStats(community.history || []);
  for (const c of [inventory.currency, market.currency]) {
    if (c && stats.currency && c !== stats.currency) return null;
  }
  return {
    inventoryReceive: inventory.receive,
    marketNet: market.net,
    netCost: (cents(stats.spent) - cents(market.net) - cents(inventory.receive)) / 100,
  };
};
