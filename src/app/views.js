// The pages of the overview: Overview, Refunds, Worth it, Charts and
// Share & export. Each one takes the loaded data and returns an element.
// view = { data, stats } (see app.js)

var VL = globalThis.VL || {};
globalThis.VL = VL;

VL.views = {};

function moneyOf(stats) {
  return (v) => VL.formatMoney(v, stats.currency);
}

function externalLink(href, text) {
  return VL.el("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);
}

// ---------- Overview ----------

VL.views.overview = function (view) {
  const el = VL.el;
  const stats = view.stats;
  const money = moneyOf(stats);
  const storeMoney = (v) => VL.formatMoney(v, stats.storeCurrency || stats.currency);
  const percent = stats.gameCount ? Math.round((stats.pileCount / stats.gameCount) * 100) : 0;
  const others = Object.entries(stats.otherCurrencies);

  const tiles = el("div", { class: "tiles" },
    VL.tile(VL.t("tileSpent"), money(stats.spent), VL.t("tileSpentHint"), "main"),
    VL.tile(VL.t("tileGames"), VL.formatNumber(stats.gameCount)),
    VL.tile(VL.t("tilePlaytime"), VL.formatHours(stats.totalMinutes)),
    VL.tile(VL.t("tilePile"), VL.formatNumber(stats.pileCount) + " (" + percent + " %)",
      VL.t("tilePileHint", VL.PILE_OF_SHAME_MINUTES / 60, stats.neverPlayedCount)),
    VL.tile(VL.t("tilePilePaid"), money(stats.pilePaid), VL.t("knownPricesOnly")),
    VL.tile(VL.t("tilePerHour"), stats.costPerHour === null ? "-" : money(stats.costPerHour),
      VL.t("tilePerHourHint")),
    stats.hasStorePrices
      ? VL.tile(VL.t("tileStoreValue"), storeMoney(stats.storeValue),
        VL.t("tileStoreValueHint", stats.storePricedCount, storeMoney(stats.pileStoreValue)))
      : null,
    view.balance
      ? VL.tile(VL.t("tileBalance"), money(view.balance.netCost), VL.t("tileBalanceHint"))
      : null,
    others.length
      ? VL.tile(VL.t("tileOtherCurrencies"),
        others.map(([c, o]) => VL.formatMoney(o.spent, c)).join(" + "), VL.t("tileOtherCurrenciesHint"), "warn")
      : null
  );

  const breakdown = VL.section(VL.t("spendingTitle"),
    el("div", { class: "list" },
      VL.listRow(VL.t("typePurchase"), money(stats.byType.purchase)),
      VL.listRow(VL.t("typeGift"), money(stats.byType.gift)),
      VL.listRow(VL.t("typeIngame"), money(stats.byType.ingame)),
      VL.listRow(VL.t("typeRefund"), "- " + money(stats.byType.refund)),
      VL.listRow(VL.t("typeWallet"), money(stats.byType.wallet), true),
      VL.listRow(VL.t("typeMarket"), money(stats.marketNet), true),
      VL.listRow(VL.t("typeOther"), money(stats.byType.other), true)
    )
  );

  const years = VL.yearSeries(stats);
  const max = Math.max(1, ...years.map((y) => y.value));
  const perYear = VL.section(VL.t("perYearTitle"),
    el("div", { class: "list" },
      years.length === 0 ? el("div", { class: "list-row" }, VL.t("noPurchases")) : null,
      years.map((y) => el("div", { class: "bar-row" },
        el("span", {}, y.key),
        el("div", { class: "bar-track" }, el("div", { class: "bar-fill",
          style: "width:" + Math.max(0, (y.value / max) * 100) + "%" })),
        el("span", { class: "num" }, money(y.value))
      ))
    )
  );

  const columns = [
    { key: "name", label: VL.t("colGame") },
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

  return el("div", {},
    tiles,
    el("div", { class: "columns" }, breakdown, perYear),
    VL.section(VL.t("gamesTitle"), table),
    VL.views.notes(view)
  );
};

VL.views.notes = function (view) {
  const el = VL.el;
  const stats = view.stats;
  const unknown = Object.entries(stats.unknownTypes);
  const others = Object.entries(stats.otherCurrencies);
  return el("section", { class: "notes" },
    el("h2", {}, VL.t("notesTitle")),
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

// ---------- Refunds ----------

VL.views.refunds = function (view) {
  const el = VL.el;
  const found = VL.findRefundable(view.data.games, view.data.transactions, Date.now());
  const ageHours = (Date.now() - view.data.fetchedAt) / 3600000;
  const money = (v, c) => (v === null ? "-" : VL.formatMoney(v, c));
  const helpLink = (c) => externalLink(VL.refundHelpUrl(c), VL.t("refundRequest"));

  const intro = el("div", { class: "callout" },
    el("p", {}, VL.t("refundIntro", VL.REFUND_DAYS, VL.REFUND_MINUTES / 60)),
    el("p", {}, VL.t("refundSteamDecides"), " ", externalLink(VL.REFUND_POLICY_URL, VL.t("refundPolicyLink"))),
    ageHours > 1 ? el("p", { class: "error" }, VL.t("refundOldData", VL.formatHours(ageHours * 60))) : null
  );

  const gamesList = found.games.length
    ? el("div", { class: "cards" }, found.games.map((g) => el("article", { class: "card refundable" },
      el("h3", {}, g.name),
      el("div", { class: "badge" }, VL.t("refundStill")),
      el("dl", {},
        el("dt", {}, VL.t("refundDaysLeft")), el("dd", {}, VL.t("refundDays", g.daysLeft)),
        el("dt", {}, VL.t("refundMinutesLeft")), el("dd", {}, VL.t("refundMinutes", g.minutesLeft)),
        el("dt", {}, VL.t("refundBought")), el("dd", {}, VL.formatDate(g.bought)),
        el("dt", {}, VL.t("colPaid")), el("dd", {}, money(g.amount, g.currency))
      ),
      helpLink(g)
    )))
    : el("p", { class: "empty" }, VL.t("refundNone"));

  const othersList = found.others.length
    ? VL.section(VL.t("refundOthersTitle"),
      el("p", { class: "muted" }, VL.t("refundOthersText")),
      el("div", { class: "list" }, found.others.map((o) => el("div", { class: "list-row" },
        el("span", {}, o.name),
        el("span", {}, VL.t("refundDays", o.daysLeft), " · ", helpLink(o))
      ))))
    : null;

  return el("div", {},
    intro,
    VL.section(VL.t("refundGamesTitle"), gamesList),
    othersList,
    el("section", { class: "notes" },
      el("h2", {}, VL.t("notesTitle")),
      el("ul", {},
        el("li", {}, VL.t("refundNoteGifts")),
        el("li", {}, VL.t("refundNoteDlc")),
        el("li", {}, VL.t("refundNoteIngame")),
        el("li", {}, VL.t("refundNoteNothingAutomatic"))
      )
    )
  );
};

// ---------- Worth it ----------

VL.views.worth = function (view) {
  const el = VL.el;
  const stats = view.stats;
  const money = moneyOf(stats);
  const ranking = VL.worthRanking(stats, 10);
  const savings = VL.discountSavings(stats);

  const rankList = (games, emptyText) => (games.length
    ? el("ol", { class: "rank" }, games.map((g) => el("li", {},
      el("span", { class: "rank-name" }, g.name),
      el("span", { class: "rank-value" }, VL.t("perHourValue", money(g.perHour))),
      el("span", { class: "rank-detail" }, money(g.paid) + " · " + VL.formatHours(g.minutes))
    )))
    : el("p", { class: "empty" }, emptyText));

  let savingsPart;
  if (!stats.hasStorePrices) {
    savingsPart = el("p", { class: "empty" }, VL.t("noteNoStorePrices"));
  } else if (!savings) {
    savingsPart = el("p", { class: "empty" }, VL.t("savingsOtherCurrency", stats.storeCurrency, stats.currency));
  } else {
    savingsPart = el("div", {},
      el("div", { class: "tiles" },
        VL.tile(VL.t("savingsTotal"), money(savings.total), VL.t("savingsTotalHint", savings.cheaper)),
        VL.tile(VL.t("savingsRegular"), money(savings.regular), VL.t("savingsCompared", savings.compared)),
        VL.tile(VL.t("savingsPaid"), money(savings.paid), VL.t("knownPricesOnly"))
      ),
      el("p", { class: "muted" }, VL.t("savingsTodayNote")),
      savings.top.length
        ? el("ol", { class: "rank" }, savings.top.map((g) => el("li", {},
          el("span", { class: "rank-name" }, g.name),
          el("span", { class: "rank-value good" }, "- " + money(g.saved)),
          el("span", { class: "rank-detail" }, VL.t("savingsRow", money(g.paid), money(g.storeRegular)))
        )))
        : null
    );
  }

  return el("div", {},
    el("p", { class: "muted" }, VL.t("worthIntro", ranking.count)),
    el("div", { class: "columns" },
      VL.section(VL.t("worthBest"), rankList(ranking.best, VL.t("worthBestEmpty"))),
      VL.section(VL.t("worthWorst"), rankList(ranking.worst, VL.t("worthWorstEmpty")))
    ),
    VL.section(VL.t("savingsTitle"), savingsPart)
  );
};

// ---------- Charts ----------

VL.views.charts = function (view) {
  const el = VL.el;
  const stats = view.stats;
  const money = (v) => VL.formatMoney(v, stats.currency);
  const shortMoney = (v) => Math.round(v).toLocaleString(VL.locale()) + (stats.currency ? " " + stats.currency : "");
  const years = VL.recapYears(stats);

  const monthBox = el("div");
  const yearSelect = el("select", { "aria-label": VL.t("chartPeriod"),
    onchange: () => drawMonths(yearSelect.value ? Number(yearSelect.value) : null) },
  el("option", { value: "" }, VL.t("periodAll")),
  years.map((y) => el("option", { value: y }, String(y))));

  function drawMonths(year) {
    const series = VL.monthSeries(stats, year).map((p) => ({
      label: VL.formatMonth(p.key), value: p.value,
    }));
    monthBox.replaceChildren(VL.barChart(VL.t("chartMonths"), series, shortMoney,
      VL.t("colMonth"), VL.t("colSpent"), 1100));
  }
  drawMonths(years.length ? years[0] : null);
  if (years.length) yearSelect.value = String(years[0]);

  const yearChart = VL.barChart(VL.t("chartYears"),
    VL.yearSeries(stats).map((p) => ({ label: p.key, value: p.value })), shortMoney,
    VL.t("colYear"), VL.t("colSpent"));
  const cumulative = VL.lineChart(VL.t("chartCumulative"),
    VL.cumulativeSeries(stats).map((p) => ({ label: VL.formatMonth(p.key), value: p.value })), shortMoney,
    VL.t("colMonth"), VL.t("colTotal"));
  const buckets = VL.barChart(VL.t("chartPlaytime"),
    VL.playtimeBuckets(stats.games).map((b) => ({ label: VL.t("bucket" + b.key.replace(/[^0-9a-z]/gi, "_")), value: b.value })),
    (v) => VL.formatNumber(v), VL.t("colPlaytime"), VL.t("colGames"));
  const points = VL.spendPlayPoints(stats).map((p) => ({ name: p.name, x: p.hours, y: p.paid }));
  const scatter = points.length
    ? VL.scatterChart(VL.t("chartSpendPlay"), points, (h) => VL.formatHours(h * 60), money,
      [VL.t("colGame"), VL.t("colPlaytime"), VL.t("colPaid")], shortMoney)
    : el("p", { class: "empty" }, VL.t("chartNoPrices"));

  return el("div", { class: "charts" },
    el("div", { class: "chart-wide" }, el("label", { class: "inline" }, VL.t("chartPeriod"), " ", yearSelect), monthBox),
    yearChart,
    cumulative,
    buckets,
    scatter,
    el("p", { class: "muted" }, VL.t("chartKeyboard"))
  );
};

// ---------- Share & export ----------

VL.views.share = function (view) {
  const el = VL.el;
  const stats = view.stats;
  const years = VL.recapYears(stats);
  const period = el("select", { id: "recap-period", onchange: draw },
    el("option", { value: "" }, VL.t("periodAll")),
    years.map((y) => el("option", { value: y }, String(y))));
  const withGames = el("input", { type: "checkbox", id: "recap-games", onchange: draw });
  const canvas = el("canvas", { class: "recap-preview", role: "img", "aria-label": VL.t("recapPreview") });
  let recap = null;

  function draw() {
    recap = VL.recapData(stats, view.data.transactions, period.value ? Number(period.value) : null, withGames.checked);
    VL.drawRecap(canvas, recap);
    canvas.setAttribute("aria-label", VL.t("recapPreview") + ": "
      + VL.recapFigures(recap).map((f) => f[0] + " " + f[1]).join(", "));
  }
  draw();

  const stamp = new Date().toISOString().slice(0, 10);
  return el("div", {},
    VL.section(VL.t("recapTitle"),
      el("p", { class: "muted" }, VL.t("recapIntro")),
      el("div", { class: "form-row" },
        el("label", { for: "recap-period" }, VL.t("recapPeriod")), period,
        el("label", { class: "inline" }, withGames, " ", VL.t("recapWithGames")),
        el("button", { type: "button", class: "primary", onclick: () => VL.saveRecap(recap) }, VL.t("recapSave"))
      ),
      canvas
    ),
    VL.section(VL.t("exportTitle"),
      el("p", { class: "muted" }, VL.t("exportIntro")),
      el("div", { class: "form-row" },
        el("button", { type: "button", onclick: () => VL.download("vapor-ledger-purchases-" + stamp + ".csv",
          VL.transactionsCsv(view.data.transactions), "text/csv") }, VL.t("exportPurchasesCsv")),
        el("button", { type: "button", onclick: () => VL.download("vapor-ledger-games-" + stamp + ".csv",
          VL.gamesCsv(stats), "text/csv") }, VL.t("exportGamesCsv")),
        el("button", { type: "button", onclick: () => VL.download("vapor-ledger-" + stamp + ".json",
          VL.exportJson(view.data, stats), "application/json") }, VL.t("exportJson"))
      )
    ),
    VL.section(VL.t("deleteTitle"),
      el("p", { class: "muted" }, VL.t("deleteIntro")),
      el("button", { type: "button", class: "danger", onclick: async () => {
        if (!confirm(VL.t("deleteConfirm"))) return;
        await VL.clearAll();
        location.reload();
      } }, VL.t("deleteButton"))
    )
  );
};

// ---------- Settings ----------

VL.views.settings = function () {
  const el = VL.el;
  const list = el("div", { class: "settings" }, el("p", { class: "status" }, VL.t("loadingSaved")));
  VL.loadSettings().then((settings) => {
    list.replaceChildren(...VL.FEATURES.map((feature) => {
      const id = "set-" + feature.key;
      const box = el("input", { type: "checkbox", id, checked: settings[feature.key],
        onchange: (e) => VL.saveSetting(feature.key, e.target.checked) });
      return el("div", { class: "setting" },
        box,
        el("label", { for: id },
          el("span", { class: "setting-name" }, VL.t("set_" + feature.key)),
          el("span", { class: "setting-hint" }, VL.t("set_" + feature.key + "_hint")),
          el("span", { class: "setting-pages" }, feature.pages))
      );
    }));
  });
  return el("div", {},
    VL.section(VL.t("settingsTitle"),
      el("p", { class: "muted" }, VL.t("settingsIntro")),
      list,
      el("p", { class: "muted" }, VL.t("settingsReload")))
  );
};
