// The tabs of the Vapor Ledger page: Overview, Spending, Games and
// Refundable. (Inventory, Recap and Settings have their own files.)
// Every view takes view = { data, stats, balance } from page.js
// and returns an element. Details stay behind "Show more" until asked for.

var VL = globalThis.VL || {};
globalThis.VL = VL;

VL.views = VL.views || {};

function moneyOf(stats) {
  return (v) => VL.formatMoney(v, stats.currency);
}

function externalLink(href, text) {
  return VL.el("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);
}

function more(summary, ...children) {
  return VL.el("details", { class: "more" }, VL.el("summary", {}, summary), ...children);
}

// ---------- Key numbers above the tabs ----------

VL.views.heroFigures = function (view) {
  const el = VL.el;
  const stats = view.stats;
  const money = moneyOf(stats);
  const percent = stats.gameCount ? Math.round((stats.pileCount / stats.gameCount) * 100) : 0;
  const figure = (label, value, hint, main) => el("div", { class: "hero-figure" + (main ? " main" : "") },
    el("div", { class: "label" }, label), el("div", { class: "value" }, value),
    hint ? el("div", { class: "hint" }, hint) : null);
  return [
    figure(VL.t("tileSpent"), money(stats.spent), VL.t("tileSpentHint"), true),
    figure(VL.t("tilePlaytime"), VL.formatHours(stats.totalMinutes), VL.t("heroGames", stats.gameCount)),
    figure(VL.t("tilePerHour"), stats.costPerHour === null ? "-" : money(stats.costPerHour), VL.t("tilePerHourHint")),
    figure(VL.t("tilePile"), percent + " %", VL.t("tilePileHint", VL.PILE_OF_SHAME_MINUTES / 60, stats.neverPlayedCount)),
    view.balance ? figure(VL.t("tileBalance"), money(view.balance.netCost), VL.t("tileBalanceHint")) : null,
  ].filter(Boolean);
};

// ---------- Overview ----------

VL.views.overview = function (view) {
  const el = VL.el;
  const stats = view.stats;
  const money = moneyOf(stats);
  const refundable = VL.findRefundable(view.data.games, view.data.transactions, Date.now());
  const ranking = VL.worthRanking(stats, 1);
  const thisYear = new Date().getUTCFullYear();

  const highlight = (tab, label, value, detail, alert) => el("a", {
    href: VL.LEDGER_HASH + "/" + tab, class: "highlight" + (alert ? " alert" : "") },
  el("div", { class: "label" }, label),
  el("div", { class: "value" }, value),
  detail ? el("div", { class: "muted" }, detail) : null,
  el("div", { class: "more" }, VL.t("showDetails")));

  return el("div", {},
    el("div", { class: "highlights" },
      highlight("refunds", VL.t("hlRefundable"), VL.t("hlRefundableValue", refundable.games.length),
        refundable.games[0] ? VL.t("hlRefundableNext", refundable.games[0].name, refundable.games[0].daysLeft) : null,
        refundable.games.length > 0),
      highlight("spending", VL.t("hlThisYear", thisYear), money(stats.byYear[thisYear] || 0),
        VL.t("hlLastYear", money(stats.byYear[thisYear - 1] || 0))),
      ranking.best[0]
        ? highlight("games", VL.t("hlBest"), ranking.best[0].name,
          VL.t("perHourValue", money(ranking.best[0].perHour)))
        : null,
      ranking.worst[0]
        ? highlight("games", VL.t("hlWorst"), ranking.worst[0].name,
          VL.t("perHourValue", money(ranking.worst[0].perHour)))
        : null,
      highlight("inventory", VL.t("hlInventory"),
        view.balance ? money(view.balance.inventoryReceive) : VL.t("hlInventoryLoad"), null)
    ),
    more(VL.t("notesTitle"), VL.views.notes(view))
  );
};

VL.views.notes = function (view) {
  const el = VL.el;
  const stats = view.stats;
  const unknown = Object.entries(stats.unknownTypes);
  const others = Object.entries(stats.otherCurrencies);
  return el("div", { class: "notes" },
    el("ul", {},
      el("li", {}, VL.t("noteEntries", stats.transactionCount, stats.matchedCount)),
      view.data.historyComplete === false ? el("li", { class: "error" }, VL.t("noteHistoryIncomplete")) : null,
      stats.multiItemPurchases > 0 ? el("li", {}, VL.t("noteCarts", stats.multiItemPurchases)) : null,
      others.length
        ? el("li", {}, VL.t("noteCurrencies", stats.currency,
          others.map(([c, o]) => VL.formatMoney(o.spent, c) + " (" + o.count + ")").join(", ")))
        : null,
      unknown.length
        ? el("li", {}, VL.t("noteUnknown", unknown.map(([label, count]) => label + " (" + count + ")").join(", ")))
        : null,
      el("li", {}, VL.t("noteNoPrice")),
      stats.hasStorePrices ? el("li", {}, VL.t("noteStoreValue")) : el("li", {}, VL.t("noteNoStorePrices")),
      el("li", {}, VL.t("notePrivacy"))
    )
  );
};

// ---------- Spending ----------

VL.views.spending = function (view) {
  const el = VL.el;
  const stats = view.stats;
  const money = moneyOf(stats);
  const shortMoney = (v) => Math.round(v).toLocaleString(VL.locale()) + (stats.currency ? " " + stats.currency : "");
  const others = Object.entries(stats.otherCurrencies);
  const years = VL.recapYears(stats);

  const breakdown = el("div", { class: "list" },
    VL.listRow(VL.t("typePurchase"), money(stats.byType.purchase)),
    VL.listRow(VL.t("typeGift"), money(stats.byType.gift)),
    VL.listRow(VL.t("typeIngame"), money(stats.byType.ingame)),
    VL.listRow(VL.t("typeRefund"), "- " + money(stats.byType.refund)),
    VL.listRow(VL.t("typeWallet"), money(stats.byType.wallet), true),
    VL.listRow(VL.t("typeMarket"), money(stats.marketNet), true),
    VL.listRow(VL.t("typeOther"), money(stats.byType.other), true)
  );

  const monthBox = el("div");
  const drawMonths = (year) => monthBox.replaceChildren(VL.barChart(VL.t("chartMonths"),
    VL.monthSeries(stats, year).map((p) => ({ label: VL.formatMonth(p.key), value: p.value })),
    shortMoney, VL.t("colMonth"), VL.t("colSpent"), 1060));
  const yearSelect = el("select", { "aria-label": VL.t("chartPeriod"),
    onchange: (e) => drawMonths(e.target.value ? Number(e.target.value) : null) },
  el("option", { value: "" }, VL.t("periodAll")),
  years.map((y) => el("option", { value: y }, String(y))));
  drawMonths(years.length ? years[0] : null);
  if (years.length) yearSelect.value = String(years[0]);

  const storeMoney = (v) => VL.formatMoney(v, stats.storeCurrency || stats.currency);
  const tiles = el("div", { class: "tiles" },
    VL.tile(VL.t("tilePilePaid"), money(stats.pilePaid), VL.t("knownPricesOnly")),
    stats.hasStorePrices
      ? VL.tile(VL.t("tileStoreValue"), storeMoney(stats.storeValue),
        VL.t("tileStoreValueHint", stats.storePricedCount, storeMoney(stats.pileStoreValue)))
      : null,
    others.length
      ? VL.tile(VL.t("tileOtherCurrencies"), others.map(([c, o]) => VL.formatMoney(o.spent, c)).join(" + "),
        VL.t("tileOtherCurrenciesHint"), "warn")
      : null);

  return el("div", {},
    tiles,
    el("div", { class: "columns" },
      el("section", {}, el("h2", {}, VL.t("spendingTitle")), breakdown,
        others.length
          ? el("p", { class: "muted" }, VL.t("noteCurrencies", stats.currency,
            others.map(([c, o]) => VL.formatMoney(o.spent, c)).join(", ")))
          : null),
      el("section", {},
        VL.barChart(VL.t("chartYears"), VL.yearSeries(stats).map((p) => ({ label: p.key, value: p.value })),
          shortMoney, VL.t("colYear"), VL.t("colSpent")))
    ),
    el("h2", {}, VL.t("chartMonths")),
    el("label", { class: "inline" }, VL.t("chartPeriod"), " ", yearSelect),
    monthBox,
    more(VL.t("moreSpending"),
      el("div", { class: "charts" },
        VL.lineChart(VL.t("chartCumulative"),
          VL.cumulativeSeries(stats).map((p) => ({ label: VL.formatMonth(p.key), value: p.value })),
          shortMoney, VL.t("colMonth"), VL.t("colTotal"))),
      VL.views.savings(view))
  );
};

VL.views.savings = function (view) {
  const el = VL.el;
  const stats = view.stats;
  const money = moneyOf(stats);
  const savings = VL.discountSavings(stats);
  const title = el("h2", {}, VL.t("savingsTitle"));
  if (!stats.hasStorePrices) return el("section", {}, title, el("p", { class: "empty" }, VL.t("noteNoStorePrices")));
  if (!savings) {
    return el("section", {}, title,
      el("p", { class: "empty" }, VL.t("savingsOtherCurrency", stats.storeCurrency, stats.currency)));
  }
  return el("section", {}, title,
    el("div", { class: "tiles" },
      VL.tile(VL.t("savingsTotal"), money(savings.total), VL.t("savingsTotalHint", savings.cheaper)),
      VL.tile(VL.t("savingsRegular"), money(savings.regular), VL.t("savingsCompared", savings.compared)),
      VL.tile(VL.t("savingsPaid"), money(savings.paid), VL.t("knownPricesOnly"))),
    el("p", { class: "muted" }, VL.t("savingsTodayNote")),
    savings.top.length
      ? el("ol", { class: "rank" }, savings.top.map((g) => el("li", {},
        el("span", { class: "rank-name" }, g.name),
        el("span", { class: "rank-value good" }, "- " + money(g.saved)),
        el("span", { class: "rank-detail" }, VL.t("savingsRow", money(g.paid), money(g.storeRegular))))))
      : null);
};

// ---------- Games ----------

VL.views.games = function (view) {
  const el = VL.el;
  const stats = view.stats;
  const money = moneyOf(stats);
  const storeMoney = (v) => VL.formatMoney(v, stats.storeCurrency || stats.currency);
  const ranking = VL.worthRanking(stats, 5);

  const rankList = (games, emptyText) => (games.length
    ? el("ol", { class: "rank" }, games.map((g) => el("li", {},
      el("span", { class: "rank-name" }, g.name),
      el("span", { class: "rank-value" }, VL.t("perHourValue", money(g.perHour))),
      el("span", { class: "rank-detail" }, money(g.paid) + " · " + VL.formatHours(g.minutes)))))
    : el("p", { class: "empty" }, emptyText));

  const columns = [
    { key: "name", label: VL.t("colGame"), show: (g) => VL.gameNameCell(g) },
    { key: "minutes", label: VL.t("colPlaytime"), num: true, show: (g) => VL.formatHours(g.minutes) },
    { key: "lastPlayed", label: VL.t("colLastPlayed"), num: true, show: (g) => VL.formatDate(g.lastPlayed) },
    { key: "bought", label: VL.t("colBought"), num: true, show: (g) => VL.formatDate(g.bought) },
    { key: "paid", label: VL.t("colPaid"), num: true, show: (g) => (g.paid === null ? "-" : money(g.paid)) },
    { key: "costPerHour", label: VL.t("colPerHour"), num: true,
      show: (g) => (g.costPerHour === null ? "-" : money(g.costPerHour)) },
  ];
  if (stats.hasStorePrices) {
    columns.push({ key: "storePrice", label: VL.t("colStoreToday"), num: true, show: (g) => {
      if (g.storePrice === null) return "-";
      if (g.storePrice === 0) return VL.t("free");
      return storeMoney(g.storePrice) + (g.storeDiscount ? " (-" + g.storeDiscount + " %)" : "");
    } });
  }
  if (stats.games.some((g) => g.historicalLow)) {
    columns.push({ key: "lowAmount", label: VL.t("colHistoricalLow"), num: true,
      show: (g) => (g.historicalLow ? VL.formatMoney(g.historicalLow.amount, g.historicalLow.currency) : "-") });
  }

  const table = VL.dataTable(columns, stats.games, {
    sort: "minutes",
    placeholder: VL.t("searchGames"),
    searchText: (g) => g.name,
    rowClass: (g) => (g.shame ? "shame" : ""),
    filters: [
      { label: VL.t("filterAll"), test: () => true },
      { label: VL.t("filterPile"), test: (g) => g.shame },
      { label: VL.t("filterPaid"), test: (g) => g.paid !== null },
    ],
  });

  const points = VL.spendPlayPoints(stats).map((p) => ({ name: p.name, x: p.hours, y: p.paid }));
  const shortMoney = (v) => Math.round(v).toLocaleString(VL.locale()) + (stats.currency ? " " + stats.currency : "");

  return el("div", {},
    el("div", { class: "columns" },
      el("section", {}, el("h2", {}, VL.t("worthBest")), rankList(ranking.best, VL.t("worthBestEmpty"))),
      el("section", {}, el("h2", {}, VL.t("worthWorst")), rankList(ranking.worst, VL.t("worthWorstEmpty")))),
    el("p", { class: "muted" }, VL.t("worthIntro", ranking.count)),
    el("h2", {}, VL.t("gamesTitle")),
    table,
    more(VL.t("moreGames"),
      el("div", { class: "charts" },
        VL.barChart(VL.t("chartPlaytime"),
          VL.playtimeBuckets(stats.games).map((b) => ({ label: VL.t("bucket" + b.key.replace(/[^0-9a-z]/gi, "_")),
            value: b.value })), (v) => VL.formatNumber(v), VL.t("colPlaytime"), VL.t("colGames")),
        points.length
          ? VL.scatterChart(VL.t("chartSpendPlay"), points, (h) => VL.formatHours(h * 60), money,
            [VL.t("colGame"), VL.t("colPlaytime"), VL.t("colPaid")], shortMoney)
          : el("p", { class: "empty" }, VL.t("chartNoPrices"))),
      el("p", { class: "muted" }, VL.t("chartKeyboard")))
  );
};

// The game name, with a link to SteamDB if the user switched it on.
VL.gameNameCell = function (game) {
  if (!VL.sourceSettings || !VL.sourceSettings.steamdbLinks) return game.name;
  return VL.el("span", {}, game.name, " ",
    externalLink("https://steamdb.info/app/" + game.appid + "/", "SteamDB"));
};

// ---------- Refundable ----------

VL.views.refunds = function (view) {
  const el = VL.el;
  const found = VL.findRefundable(view.data.games, view.data.transactions, Date.now());
  const ageHours = (Date.now() - view.data.fetchedAt) / 3600000;
  const money = (v, c) => (v === null ? "-" : VL.formatMoney(v, c));
  const helpLink = (c) => externalLink(VL.refundHelpUrl(c), VL.t("refundRequest"));

  return el("div", {},
    el("div", { class: "callout" },
      el("p", {}, VL.t("refundIntro", VL.REFUND_DAYS, VL.REFUND_MINUTES / 60)),
      el("p", {}, VL.t("refundSteamDecides"), " ", externalLink(VL.REFUND_POLICY_URL, VL.t("refundPolicyLink"))),
      ageHours > 1 ? el("p", { class: "error" }, VL.t("refundOldData", VL.formatHours(ageHours * 60))) : null),
    el("h2", {}, VL.t("refundGamesTitle")),
    found.games.length
      ? el("div", { class: "cards" }, found.games.map((g) => el("article", { class: "card refundable" },
        el("h3", {}, g.name),
        el("div", { class: "badge" }, VL.t("refundStill")),
        el("dl", {},
          el("dt", {}, VL.t("refundDaysLeft")), el("dd", {}, VL.t("refundDays", g.daysLeft)),
          el("dt", {}, VL.t("refundMinutesLeft")), el("dd", {}, VL.t("refundMinutes", g.minutesLeft)),
          el("dt", {}, VL.t("refundBought")), el("dd", {}, VL.formatDate(g.bought)),
          el("dt", {}, VL.t("colPaid")), el("dd", {}, money(g.amount, g.currency))),
        helpLink(g))))
      : el("p", { class: "empty" }, VL.t("refundNone")),
    found.others.length
      ? el("section", {}, el("h2", {}, VL.t("refundOthersTitle")),
        el("p", { class: "muted" }, VL.t("refundOthersText")),
        el("div", { class: "list" }, found.others.map((o) => el("div", { class: "list-row" },
          el("span", {}, o.name), el("span", {}, VL.t("refundDays", o.daysLeft), " · ", helpLink(o))))))
      : null,
    more(VL.t("notesTitle"), el("div", { class: "notes" }, el("ul", {},
      el("li", {}, VL.t("refundNoteGifts")),
      el("li", {}, VL.t("refundNoteDlc")),
      el("li", {}, VL.t("refundNoteIngame")),
      el("li", {}, VL.t("refundNoteNothingAutomatic")))))
  );
};
