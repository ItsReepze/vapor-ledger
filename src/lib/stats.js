// Turns the raw data (games + transactions) into the numbers we show.

var VL = globalThis.VL || {};
globalThis.VL = VL;

// Games with less playtime than this count as "pile of shame".
VL.PILE_OF_SHAME_MINUTES = 60;

// Types that count as money spent. Wallet top-ups are not counted,
// otherwise a game bought with wallet money would be counted twice.
const SPENDING_TYPES = ["purchase", "gift", "ingame"];

// Tries to find the owned game for an item name from the purchase history.
// First an exact match, then the longest game name the item starts with,
// so "Hades - Original Soundtrack" still counts for "Hades".
function findGame(itemName, gamesByName, sortedNames) {
  const name = VL.normalizeName(itemName);
  if (gamesByName.has(name)) return gamesByName.get(name);
  for (const gameName of sortedNames) {
    if (gameName.length >= 4 && name.startsWith(gameName + " ")) {
      return gamesByName.get(gameName);
    }
  }
  return null;
}

VL.buildStats = function (games, transactions) {
  const currency = (transactions.find((t) => t.currency) || {}).currency || "";

  // Money
  const byType = { purchase: 0, gift: 0, ingame: 0, refund: 0, wallet: 0, market: 0, other: 0 };
  const byYear = {};
  let marketNet = 0;
  let multiItemPurchases = 0;

  // Game lookup for matching purchases to games
  const gamesByName = new Map();
  for (const game of games) gamesByName.set(VL.normalizeName(game.name), game);
  const sortedNames = [...gamesByName.keys()].sort((a, b) => b.length - a.length);
  const paid = new Map(); // appid -> amount
  const refunded = new Map(); // appid -> amount

  for (const t of transactions) {
    if (t.type === "market") {
      marketNet += t.walletChange || 0;
      byType.market += t.amount;
      continue;
    }
    byType[t.type] += t.amount;

    const year = t.date ? new Date(t.date).getUTCFullYear() : "?";
    if (SPENDING_TYPES.includes(t.type)) {
      byYear[year] = (byYear[year] || 0) + t.amount;
    } else if (t.type === "refund") {
      byYear[year] = (byYear[year] || 0) - t.amount;
    }

    // Only plain purchases with a single item can be assigned to one game.
    // A cart with several games only tells us the total, not each price.
    if (t.type === "purchase" || t.type === "ingame") {
      if (t.items.length === 1) {
        const game = findGame(t.items[0], gamesByName, sortedNames);
        if (game) paid.set(game.appid, (paid.get(game.appid) || 0) + t.amount);
      } else if (t.items.length > 1) {
        multiItemPurchases++;
      }
    }

    // Refunds are collected first and taken off at the end, because Steam
    // lists the newest entries first and the refund comes before the purchase.
    if (t.type === "refund" && t.items.length === 1) {
      const game = findGame(t.items[0], gamesByName, sortedNames);
      if (game) refunded.set(game.appid, (refunded.get(game.appid) || 0) + t.amount);
    }
  }

  for (const [appid, amount] of refunded) {
    if (!paid.has(appid)) continue;
    const rest = paid.get(appid) - amount;
    if (rest > 0.005) paid.set(appid, rest);
    else paid.delete(appid);
  }

  const spent = byType.purchase + byType.gift + byType.ingame - byType.refund;

  // Games
  const rows = games.map((game) => {
    const amount = paid.get(game.appid) ?? null;
    const hours = game.minutes / 60;
    return {
      ...game,
      paid: amount,
      costPerHour: amount !== null && hours >= 1 ? amount / hours : null,
      shame: game.minutes < VL.PILE_OF_SHAME_MINUTES,
    };
  });

  const totalMinutes = rows.reduce((sum, g) => sum + g.minutes, 0);
  const pile = rows.filter((g) => g.shame);
  const neverPlayed = rows.filter((g) => g.minutes === 0);
  const pilePaid = pile.reduce((sum, g) => sum + (g.paid || 0), 0);

  return {
    currency,
    spent,
    byType,
    byYear,
    marketNet,
    multiItemPurchases,
    transactionCount: transactions.length,
    games: rows,
    gameCount: rows.length,
    totalMinutes,
    pileCount: pile.length,
    neverPlayedCount: neverPlayed.length,
    pilePaid,
    matchedCount: rows.filter((g) => g.paid !== null).length,
  };
};
