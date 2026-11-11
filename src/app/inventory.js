// The inventory and market page. Inventory and market data live on
// steamcommunity.com and Steam limits these requests hard, so they are
// only loaded when the user asks for them, and prices are kept for a day.

var VL = globalThis.VL || {};
globalThis.VL = VL;

function inventoryGameLabel(appid) {
  const app = VL.INVENTORY_APPS.find((a) => a[0] === appid);
  return app ? app[2] : "App " + appid;
}

function errorText(error) {
  return error && error.rateLimited ? VL.t("rateLimited") : VL.t("somethingWrong", error ? error.message : "");
}

// view: { steamid, onCommunity(data) } from app.js
VL.views.inventory = function (view) {
  const el = VL.el;
  const box = el("div", {}, el("p", { class: "status" }, VL.t("loadingSaved")));

  // Only one loading run at a time, so requests never run in parallel.
  let busy = false;
  function start(force) {
    if (busy) return;
    busy = true;
    load(force).catch((error) => {
      console.error("[Vapor Ledger]", error);
      box.replaceChildren(el("p", { class: "status error" }, errorText(error)));
    }).finally(() => { busy = false; });
  }

  async function load(force) {
    const cacheId = "community-" + view.steamid;
    let data = await VL.loadCache(cacheId);
    if (!data && !force) {
      box.replaceChildren(
        el("p", {}, VL.t("inventoryIntro")),
        el("button", { type: "button", class: "primary", onclick: () => start(true) }, VL.t("inventoryLoad"))
      );
      return;
    }

    const notes = [];
    const session = await VL.openCommunity();
    if (!session) {
      if (!data) {
        box.replaceChildren(el("p", { class: "status error" }, VL.t("communityLogin")),
          el("p", {}, el("a", { href: "https://steamcommunity.com/login/", target: "_blank", rel: "noopener" },
            "steamcommunity.com")));
        return;
      }
      notes.push(VL.t("communityLogin"));
    } else if (session.steamid !== view.steamid) {
      box.replaceChildren(el("p", { class: "status error" }, VL.t("communityOtherAccount")));
      return;
    }

    if (force || !data) {
      const oldPrices = (data && data.prices) || {};
      data = { stacks: [], history: [], historyComplete: false, prices: oldPrices, fetchedAt: Date.now() };
      const status = el("p", { class: "status" });
      box.replaceChildren(status);
      try {
        data.stacks = await VL.fetchInventories(view.steamid, (label) => {
          status.textContent = VL.t("loadingInventory", label);
        });
      } catch (error) {
        notes.push(errorText(error));
      }
      try {
        const result = await VL.fetchMarketHistory([], (done, total) => {
          status.textContent = VL.t("loadingMarket", done, total);
        });
        data.history = result.entries;
        data.historyComplete = result.complete;
      } catch (error) {
        notes.push(errorText(error));
      }
      await VL.saveCache(cacheId, data);
    }

    // Prices load in the background. The page is built once and only its
    // numbers and rows are updated, so a search the user typed in stays.
    let stopped = false;
    const progress = el("div", { class: "progress", "aria-live": "polite" });
    const page = VL.buildCommunityPage(data, progress, notes, () => start(true));
    box.replaceChildren(page);
    view.onCommunity && view.onCommunity(data);

    if (!session) return;
    const todo = data.stacks.filter((s) => {
      const p = data.prices[s.appid + "/" + s.hashName];
      return s.marketable && (!p || Date.now() - p.at > VL.PRICE_MAX_AGE_MS);
    }).length;
    if (todo === 0) return;

    const stop = el("button", { type: "button", onclick: () => { stopped = true; } }, VL.t("stop"));
    try {
      await VL.fetchPrices(data.stacks, session.currency, data.prices, (done, total) => {
        const minutes = Math.ceil(((total - done) * 3.5) / 60);
        progress.replaceChildren(VL.t("loadingPrices", done, total, minutes), " ", done < total ? stop : "");
        if (done % 10 === 0 || done === total) page.update();
      }, () => !stopped);
    } catch (error) {
      notes.push(errorText(error));
    }
    progress.replaceChildren();
    await VL.saveCache(cacheId, data);
    page.update();
    view.onCommunity && view.onCommunity(data);
  }

  start(false);
  return box;
};

VL.buildCommunityPage = function (data, progress, notes, reload) {
  const el = VL.el;
  // The currency is only known once the first price arrived, so the
  // formatters read it from here instead of capturing it once.
  const current = { inv: null, market: null };
  const money = (v) => VL.formatMoney(v, current.inv.currency || current.market.currency);
  const marketMoney = (v) => VL.formatMoney(v, current.market.currency || current.inv.currency);

  const tiles = el("div", { class: "tiles" });
  const notesList = el("ul");

  const inventoryTable = VL.dataTable([
    { key: "name", label: VL.t("colItem") },
    { key: "appid", label: VL.t("colGame"), show: (r) => inventoryGameLabel(r.appid) },
    { key: "count", label: VL.t("colCount"), num: true },
    { key: "price", label: VL.t("colPrice"), num: true, show: (r) => (r.price === null ? "-" : money(r.price)) },
    { key: "total", label: VL.t("colTotal"), num: true, show: (r) => (r.total === null ? "-" : money(r.total)) },
  ], [], {
    sort: "total",
    placeholder: VL.t("searchItems"),
    searchText: (r) => r.name + " " + inventoryGameLabel(r.appid),
    rowClass: (r) => (r.marketable ? "" : "muted"),
  });

  const marketTable = VL.dataTable([
    { key: "name", label: VL.t("colItem") },
    { key: "game", label: VL.t("colGame") },
    { key: "bought", label: VL.t("colMarketBought"), num: true,
      show: (r) => (r.boughtCount ? r.boughtCount + " x, " + marketMoney(r.bought) : "-") },
    { key: "sold", label: VL.t("colMarketSold"), num: true,
      show: (r) => (r.soldCount ? r.soldCount + " x, " + marketMoney(r.sold) : "-") },
    { key: "net", label: VL.t("colNet"), num: true, show: (r) => marketMoney(r.net) },
  ], [], {
    sort: "net",
    placeholder: VL.t("searchMarket"),
    searchText: (r) => r.name + " " + r.game,
    rowClass: (r) => (r.net < 0 ? "loss" : r.net > 0 ? "gain" : ""),
  });

  const inventoryEmpty = el("p", { class: "empty" }, VL.t("inventoryEmpty"));
  const marketEmpty = el("p", { class: "empty" }, VL.t("marketEmpty"));

  function update() {
    const inv = VL.buildInventoryStats(data.stacks, data.prices);
    const market = VL.buildMarketStats(data.history);
    current.inv = inv;
    current.market = market;

    tiles.replaceChildren(
      VL.tile(VL.t("tileInventoryValue"), money(inv.value), VL.t("tileInventoryValueHint")),
      VL.tile(VL.t("tileReceive"), money(inv.receive), VL.t("tileReceiveHint")),
      VL.tile(VL.t("tileItems"), VL.formatNumber(inv.itemCount),
        VL.t("tileItemsHint", inv.marketableCount, inv.pricedCount)),
      VL.tile(VL.t("tileMarketBought"), marketMoney(market.bought), VL.t("tileCount", market.boughtCount)),
      VL.tile(VL.t("tileMarketSold"), marketMoney(market.sold), VL.t("tileCount", market.soldCount)),
      VL.tile(VL.t("tileMarketNet"), marketMoney(market.net), VL.t("tileMarketNetHint"))
    );

    inventoryTable.setRows(inv.rows);
    marketTable.setRows(market.rows);
    inventoryTable.hidden = inv.rows.length === 0;
    inventoryEmpty.hidden = inv.rows.length > 0;
    marketTable.hidden = market.rows.length === 0;
    marketEmpty.hidden = market.rows.length > 0;

    notesList.replaceChildren(
      ...notes.map((n) => el("li", { class: "error" }, n)),
      el("li", {}, VL.t("noteInventories", VL.INVENTORY_APPS.map((a) => a[2]).join(", "))),
      el("li", {}, VL.t("notePrices")),
      el("li", {}, VL.t("noteReceive")),
      el("li", {}, VL.t("noteMarket") + (data.historyComplete ? "" : " " + VL.t("noteMarketIncomplete"))),
      el("li", {}, VL.t("noteNothingSold"))
    );
  }

  const page = el("div", {},
    el("div", { class: "form-row" },
      el("span", { class: "muted" }, VL.t("dataFrom", new Date(data.fetchedAt).toLocaleString(VL.locale()))),
      el("button", { type: "button", onclick: reload }, VL.t("refreshInventory"))),
    tiles,
    progress,
    VL.section(VL.t("inventoryTitle"), inventoryTable, inventoryEmpty),
    VL.section(VL.t("marketTitle"), marketTable, marketEmpty),
    el("section", { class: "notes" }, el("h2", {}, VL.t("notesTitle")), notesList)
  );
  page.update = update;
  update();
  return page;
};
