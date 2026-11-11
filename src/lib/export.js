// Export of the loaded data as CSV and JSON files. The files are made in
// this browser and saved to the computer, nothing is uploaded. They contain
// no Steam ID and no token.

var VL = globalThis.VL || {};
globalThis.VL = VL;

// One CSV cell. Text that a spreadsheet would run as a formula
// ("=", "+", "-", "@" at the start) gets a leading apostrophe.
function csvCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  if (/[",\n\r;]/.test(text)) text = "\"" + text.replace(/"/g, "\"\"") + "\"";
  return text;
}

VL.toCsv = function (header, rows) {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
};

const isoDate = (timestamp) => (timestamp ? new Date(timestamp).toISOString().slice(0, 10) : "");

VL.transactionsCsv = function (transactions) {
  return VL.toCsv(
    ["date", "type", "steam_type_text", "items", "amount", "currency", "wallet_change"],
    transactions.map((t) => [isoDate(t.date), t.type, t.typeText, t.items.join(" | "), t.amount,
      t.currency, t.walletChange])
  );
};

VL.gamesCsv = function (stats) {
  return VL.toCsv(
    ["appid", "name", "playtime_minutes", "last_played", "first_bought", "paid", "currency",
      "cost_per_hour", "store_price_today", "store_regular_today", "store_currency"],
    stats.games.map((g) => [g.appid, g.name, g.minutes, isoDate(g.lastPlayed), isoDate(g.bought),
      g.paid, g.paid === null ? "" : stats.currency,
      g.costPerHour === null ? null : Math.round(g.costPerHour * 100) / 100,
      g.storePrice, g.storeRegular, g.storePrice === null ? "" : stats.storeCurrency])
  );
};

VL.exportJson = function (data, stats) {
  return JSON.stringify({
    exportedBy: "Vapor Ledger",
    exportedAt: new Date().toISOString(),
    dataFrom: data.fetchedAt ? new Date(data.fetchedAt).toISOString() : null,
    currency: stats.currency,
    totals: {
      spent: stats.spent,
      byType: stats.byType,
      byYear: stats.byYear,
      byMonth: stats.byMonth,
      otherCurrencies: stats.otherCurrencies,
      playtimeMinutes: stats.totalMinutes,
      games: stats.gameCount,
    },
    games: stats.games.map((g) => ({
      appid: g.appid, name: g.name, minutes: g.minutes, lastPlayed: isoDate(g.lastPlayed) || null,
      firstBought: isoDate(g.bought) || null, paid: g.paid, storePrice: g.storePrice,
      storeRegular: g.storeRegular,
    })),
    transactions: data.transactions.map((t) => ({
      date: isoDate(t.date) || null, type: t.type, typeText: t.typeText, items: t.items,
      amount: t.amount, currency: t.currency, walletChange: t.walletChange,
    })),
  }, null, 2);
};

// Saves text or a blob as a file through a temporary download link.
VL.download = function (name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: type || "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = VL.el("a", { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
