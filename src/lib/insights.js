// Answers built on top of the stats: which games can still be refunded,
// which purchases were worth it, what discounts saved, the data for the
// charts and the numbers for the recap image.

var VL = globalThis.VL || {};
globalThis.VL = VL;

// Steam's refund rule: within 14 days of purchase and less than 2 hours
// played. Steam decides every request itself, this is only a hint.
VL.REFUND_DAYS = 14;
VL.REFUND_MINUTES = 120;
VL.REFUND_POLICY_URL = "https://store.steampowered.com/steam_refunds/";

// Link to Steam's help page for one purchase, or for a game.
VL.refundHelpUrl = function (candidate) {
  if (candidate.transid) {
    return "https://help.steampowered.com/wizard/HelpWithPurchase?transid=" + encodeURIComponent(candidate.transid);
  }
  if (candidate.appid) return "https://help.steampowered.com/wizard/HelpWithGame/?appid=" + candidate.appid;
  return "https://help.steampowered.com/";
};

// Finds purchases of the last 14 days. Returns
// { games: [...], others: [...] }.
// games: owned games bought by this account (not gifts for others, not
//   in-game purchases) with less than 2 hours played, matched by exact name.
// others: other items from those purchases (DLC, soundtracks, bundles)
//   that can't be matched to a game, so their playtime is unknown.
// Items refunded later are left out.
VL.findRefundable = function (games, transactions, now) {
  const findGame = VL.gameMatcher(games);
  const deadline = (date) => date + VL.REFUND_DAYS * VL.DAY_MS;
  const refundedNames = new Set();
  for (const t of transactions) {
    if (t.type === "refund") t.items.forEach((item) => refundedNames.add(VL.normalizeName(item)));
  }

  const result = { games: [], others: [] };
  const seen = new Set();
  for (const t of transactions) {
    // Dates are whole days, so the purchase day itself counts fully.
    if (t.type !== "purchase" || !t.date || deadline(t.date) + VL.DAY_MS <= now) continue;
    const daysLeft = Math.max(0, Math.ceil((deadline(t.date) + VL.DAY_MS - now) / VL.DAY_MS) - 1);
    for (const item of t.items) {
      const key = VL.normalizeName(item);
      if (refundedNames.has(key) || seen.has(key)) continue;
      seen.add(key);
      const entry = {
        name: item,
        bought: t.date,
        daysLeft,
        transid: t.transid || null,
        amount: t.items.length === 1 ? t.amount : null,
        currency: t.currency,
      };
      const game = findGame(item, true);
      if (game) {
        if (game.minutes >= VL.REFUND_MINUTES) continue;
        result.games.push({ ...entry, appid: game.appid, minutes: game.minutes,
          minutesLeft: VL.REFUND_MINUTES - game.minutes });
      } else {
        result.others.push(entry);
      }
    }
  }
  result.games.sort((a, b) => a.daysLeft - b.daysLeft);
  result.others.sort((a, b) => a.daysLeft - b.daysLeft);
  return result;
};

// Best and worst purchases by cost per hour. Games played less than an
// hour count as one hour, so a game never started costs its full price
// per hour.
VL.worthRanking = function (stats, limit) {
  const paid = stats.games.filter((g) => g.paid !== null && g.paid > 0)
    .map((g) => ({ ...g, perHour: g.paid / Math.max(1, g.minutes / 60) }));
  const best = paid.filter((g) => g.minutes >= 60).sort((a, b) => a.perHour - b.perHour);
  const worst = [...paid].sort((a, b) => b.perHour - a.perHour);
  return { best: best.slice(0, limit || 10), worst: worst.slice(0, limit || 10), count: paid.length };
};

// What discounts saved: the price paid compared with the regular store
// price. Steam's history doesn't say what the regular price was on the day
// of the purchase, so today's regular price is used and marked as such.
VL.discountSavings = function (stats) {
  if (!stats.hasStorePrices || !stats.storeSameCurrency) return null;
  const rows = stats.games
    .filter((g) => g.paid !== null && g.storeRegular)
    .map((g) => ({ ...g, saved: Math.round(g.storeRegular * 100 - g.paid * 100) / 100 }));
  const saved = rows.filter((g) => g.saved > 0);
  return {
    total: saved.reduce((sum, g) => sum + Math.round(g.saved * 100), 0) / 100,
    regular: rows.reduce((sum, g) => sum + Math.round(g.storeRegular * 100), 0) / 100,
    paid: rows.reduce((sum, g) => sum + Math.round(g.paid * 100), 0) / 100,
    compared: rows.length,
    cheaper: saved.length,
    top: saved.sort((a, b) => b.saved - a.saved).slice(0, 10),
  };
};

// Every month from the first to the last purchase, also months without
// spending, as [{ key: "2026-11", value }]. year limits it to one year.
VL.monthSeries = function (stats, year) {
  const keys = Object.keys(stats.byMonth).sort();
  if (keys.length === 0) return [];
  let [y, m] = (year ? year + "-01" : keys[0]).split("-").map(Number);
  const [lastY, lastM] = (year ? year + "-12" : keys[keys.length - 1]).split("-").map(Number);
  const series = [];
  while (y < lastY || (y === lastY && m <= lastM)) {
    const key = y + "-" + String(m).padStart(2, "0");
    series.push({ key, value: stats.byMonth[key] || 0 });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return series;
};

VL.yearSeries = function (stats) {
  return Object.keys(stats.byYear).sort().map((key) => ({ key, value: stats.byYear[key] }));
};

VL.cumulativeSeries = function (stats) {
  let sum = 0;
  return VL.monthSeries(stats).map((point) => {
    sum += Math.round(point.value * 100);
    return { key: point.key, value: sum / 100 };
  });
};

// How many games fall into each playtime range.
VL.PLAYTIME_BUCKETS = [
  { key: "0", max: 0 },
  { key: "<1", max: 59 },
  { key: "1-5", max: 5 * 60 - 1 },
  { key: "5-20", max: 20 * 60 - 1 },
  { key: "20-50", max: 50 * 60 - 1 },
  { key: "50-100", max: 100 * 60 - 1 },
  { key: "100+", max: Infinity },
];

VL.playtimeBuckets = function (games) {
  const series = VL.PLAYTIME_BUCKETS.map((b) => ({ key: b.key, value: 0 }));
  for (const game of games) {
    const index = VL.PLAYTIME_BUCKETS.findIndex((b) => game.minutes <= b.max);
    series[index].value++;
  }
  return series;
};

// Points for "money against playtime": games with a known price.
VL.spendPlayPoints = function (stats) {
  return stats.games.filter((g) => g.paid !== null)
    .map((g) => ({ name: g.name, paid: g.paid, hours: g.minutes / 60 }));
};

// Years that have purchases, newest first.
VL.recapYears = function (stats) {
  return Object.keys(stats.byYear).map(Number).sort((a, b) => b - a);
};

// The numbers for the recap image, for the whole account (year null) or
// one year. Only totals, unless includeGames is set: then the five most
// played games of that period are added by name.
VL.recapData = function (stats, transactions, year, includeGames) {
  const inPeriod = (date) => year === null || (date && new Date(date).getUTCFullYear() === year);
  const own = transactions.filter((t) => !t.currency || !stats.currency || t.currency === stats.currency);
  let spentCents = 0;
  let purchases = 0;
  let refunds = 0;
  for (const t of own) {
    if (!inPeriod(t.date)) continue;
    spentCents += Math.round(VL.spendingOf(t) * 100);
    if (VL.SPENDING_TYPES.includes(t.type)) purchases++;
    if (t.type === "refund") refunds++;
  }
  const games = year === null ? stats.games : stats.games.filter((g) => g.bought && inPeriod(g.bought));
  const minutes = games.reduce((sum, g) => sum + g.minutes, 0);
  const spent = year === null ? stats.spent : spentCents / 100;
  const bars = year === null ? VL.yearSeries(stats) : VL.monthSeries(stats, year);
  const top = includeGames
    ? [...games].sort((a, b) => b.minutes - a.minutes).filter((g) => g.minutes > 0).slice(0, 5)
      .map((g) => ({ name: g.name, minutes: g.minutes }))
    : [];
  return {
    year,
    currency: stats.currency,
    spent,
    purchases,
    refunds,
    gameCount: games.length,
    minutes,
    neverPlayed: games.filter((g) => g.minutes === 0).length,
    perHour: minutes >= 60 ? spent / (minutes / 60) : null,
    bars,
    top,
  };
};
