// The "Inventory and market" tab. Inventory and market data live on
// steamcommunity.com and Steam limits these requests hard, so they are
// only loaded when the user asks for them. Saved data shows at once,
// prices are kept for a day and only missing or old ones are asked again.

var VL = globalThis.VL || {};
globalThis.VL = VL;
VL.views = VL.views || {};

function inventoryGameLabel(appid) {
  const app = VL.INVENTORY_APPS.find((a) => a[0] === appid);
  return app ? app[2] : "App " + appid;
}

function errorText(error) {
  return error && error.rateLimited ? VL.t("rateLimited") : VL.t("somethingWrong", error ? error.message : "");
}

// view: { steamid, onCommunity(data) } from page.js
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
    const cached = await VL.loadCache(cacheId);
    if (!cached && !force) {
      box.replaceChildren(
        el("p", {}, VL.t("inventoryIntro")),
        el("button", { type: "button", class: "primary", onclick: () => start(true) }, VL.t("inventoryLoad"))
      );
      return;
    }

    // Show what is there right away, everything else fills in while it loads.
    const data = cached || { stacks: [], history: [], historyComplete: false, prices: {}, fetchedAt: Date.now() };
    const notes = [];
    const progress = el("div", { class: "progress", "aria-live": "polite" });
    const page = VL.buildCommunityPage(data, progress, notes, () => start(true));
    box.replaceChildren(page);
    const say = (...parts) => progress.replaceChildren(...parts);
    const saved = async () => {
      page.update();
      await VL.saveCache(cacheId, data);
      view.onCommunity && view.onCommunity(data);
    };

    say(VL.t("loadingStart"));
    const session = await VL.openCommunity();
    if (!session || session.steamid !== view.steamid) {
      notes.push(session ? VL.t("communityOtherAccount") : VL.t("communityLogin"));
      say();
      page.update();
      return;
    }

    if (force || !cached) {
      try {
        data.stacks = await VL.fetchInventories(view.steamid, (label) => say(VL.t("loadingInventory", label)));
        data.fetchedAt = Date.now();
      } catch (error) {
        notes.push(errorText(error));
      }
      await saved();
      try {
        // Only pages newer than the saved history are loaded.
        const result = await VL.fetchMarketHistory(data.historyComplete ? data.history : [],
          (done, total) => say(VL.t("loadingMarket", done, total)));
        data.history = result.entries;
        data.historyComplete = result.complete;
      } catch (error) {
        notes.push(errorText(error));
      }
      await saved();
    }

    // Prices: only missing or older than a day, as few requests as possible.
    if (VL.stalePrices(data.stacks, data.prices).length > 0) {
      let stopped = false;
      const stop = el("button", { type: "button", onclick: () => { stopped = true; } }, VL.t("stop"));
      try {
        await VL.fetchPrices(data.stacks, session.currency, data.prices, (done, total) => {
          const minutes = Math.ceil(((total - done) * VL.PRICE_DELAY_SECONDS) / 60);
          say(VL.t("loadingPrices", done, total, minutes), " ", done < total ? stop : "");
          if (done % 5 === 0) page.update();
          if (done % 20 === 0) VL.saveCache(cacheId, data);
        }, () => !stopped);
      } catch (error) {
        notes.push(errorText(error));
      }
    }
    say();
    await saved();
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
  const dataAge = el("span", { class: "muted" });
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
    dataAge.textContent = data.stacks.length ? VL.t("dataFrom", new Date(data.fetchedAt).toLocaleString(VL.locale())) : "";
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
      dataAge,
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
