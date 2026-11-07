// The inventory and market part of the dashboard. It runs on
// steamcommunity.com, because inventory and market data live there.

var VL = globalThis.VL || {};
globalThis.VL = VL;

// A small sortable, searchable table.
// columns: [{ key, label, num, show(row) }]
VL.dataTable = function (columns, rows, options) {
  const el = VL.el;
  const state = { sort: options.sort, desc: options.desc !== false, search: "" };
  const tbody = el("tbody");
  const headRow = el("tr");
  const search = el("input", {
    type: "search",
    placeholder: options.placeholder || "Search",
    oninput: (e) => { state.search = e.target.value.toLowerCase(); draw(); },
  });

  function draw() {
    let list = rows;
    if (state.search) list = list.filter((r) => options.searchText(r).toLowerCase().includes(state.search));
    list = [...list].sort((a, b) => {
      const x = a[state.sort];
      const y = b[state.sort];
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const result = typeof x === "string" ? x.localeCompare(y) : x - y;
      return state.desc ? -result : result;
    });
    headRow.replaceChildren(...columns.map((c) => {
      const arrow = state.sort === c.key ? (state.desc ? " ▼" : " ▲") : "";
      return el("th", {
        class: c.num ? "num" : "",
        onclick: () => {
          state.desc = state.sort === c.key ? !state.desc : Boolean(c.num);
          state.sort = c.key;
          draw();
        },
      }, c.label + arrow);
    }));
    tbody.replaceChildren(...list.map((r) =>
      el("tr", { class: options.rowClass ? options.rowClass(r) : "" },
        columns.map((c) => el("td", { class: c.num ? "num" : "" }, c.show ? c.show(r) : r[c.key])))
    ));
  }

  draw();
  return el("div", {},
    el("div", { class: "filters" }, search),
    el("div", { class: "table-wrap" }, el("table", {}, el("thead", {}, headRow), tbody))
  );
};

function gameLabel(appid) {
  const app = VL.INVENTORY_APPS.find((a) => a[0] === appid);
  return app ? app[2] : "App " + appid;
}

// Loads and shows inventory and market history.
// view: { content, showStatus, setUpdated, force }
VL.loadCommunityView = async function (view) {
  const el = VL.el;
  const session = VL.getCommunitySession(document);
  if (!session) {
    view.showStatus("Please log in to Steam Community first, then open Vapor Ledger again.", true);
    return;
  }
  const cacheId = "community-" + session.steamid;
  let data = view.force ? null : await VL.loadCache(cacheId);
  const oldPrices = (data && data.prices) || {};
  const notes = [];

  if (!data) {
    data = { stacks: [], history: [], historyComplete: false, prices: oldPrices, fetchedAt: Date.now() };
    try {
      data.stacks = await VL.fetchInventories(session.steamid, (label) => {
        view.showStatus("Loading inventory: " + label + "...");
      });
    } catch (error) {
      notes.push(error.message);
    }
    try {
      const result = await VL.fetchMarketHistory([], (done, total) => {
        view.showStatus("Loading market history (" + done + " of " + total + " entries)...");
      });
      data.history = result.entries;
      data.historyComplete = result.complete;
    } catch (error) {
      notes.push(error.message);
    }
    await VL.saveCache(cacheId, data);
  }
  view.setUpdated("Data from " + new Date(data.fetchedAt).toLocaleString());

  // Prices load in the background. The view is drawn first and updated
  // every few prices, and the user can stop at any time.
  let stopped = false;
  const progress = el("div", { class: "progress" });

  function render() {
    view.content.replaceChildren(renderCommunity(data, progress, notes));
  }
  render();

  const todo = data.stacks.filter((s) => {
    const p = data.prices[s.appid + "/" + s.hashName];
    return s.marketable && (!p || Date.now() - p.at > VL.PRICE_MAX_AGE_MS);
  }).length;
  if (todo === 0) return;

  const stop = el("button", { onclick: () => { stopped = true; } }, "Stop");
  try {
    await VL.fetchPrices(data.stacks, session.currency, data.prices, (done, total) => {
      const minutes = Math.ceil(((total - done) * 3.5) / 60);
      progress.replaceChildren(
        "Loading market prices: " + done + " of " + total
          + (done < total ? " (about " + minutes + " min left) " : " "),
        done < total ? stop : ""
      );
      if (done % 10 === 0 || done === total) render();
    }, () => !stopped);
  } catch (error) {
    notes.push(error.message);
  }
  progress.replaceChildren();
  await VL.saveCache(cacheId, data);
  render();
};

function renderCommunity(data, progress, notes) {
  const el = VL.el;
  const inv = VL.buildInventoryStats(data.stacks, data.prices);
  const market = VL.buildMarketStats(data.history);
  const money = (v) => VL.formatMoney(v, inv.currency || market.currency);
  const marketMoney = (v) => VL.formatMoney(v, market.currency || inv.currency);

  const tiles = el("section", {},
    el("div", { class: "tiles" },
      VL.tile("Inventory value", money(inv.value), "lowest market listing"),
      VL.tile("You would get", money(inv.receive), "after Steam fees"),
      VL.tile("Items", inv.itemCount.toLocaleString(),
        inv.marketableCount + " marketable, " + inv.pricedCount + " priced"),
      VL.tile("Market bought", marketMoney(market.bought), market.boughtCount + " purchases"),
      VL.tile("Market sold", marketMoney(market.sold), market.soldCount + " sales"),
      VL.tile("Market profit or loss", marketMoney(market.net), "sold minus bought, unsold items count as cost")
    )
  );

  const inventoryTable = VL.dataTable([
    { key: "name", label: "Item" },
    { key: "appid", label: "Game", show: (r) => gameLabel(r.appid) },
    { key: "count", label: "Count", num: true },
    { key: "price", label: "Price", num: true, show: (r) => (r.price === null ? "-" : money(r.price)) },
    { key: "total", label: "Total", num: true, show: (r) => (r.total === null ? "-" : money(r.total)) },
  ], inv.rows, {
    sort: "total",
    placeholder: "Search items",
    searchText: (r) => r.name + " " + gameLabel(r.appid),
    rowClass: (r) => (r.marketable ? "" : "muted-row"),
  });

  const marketTable = VL.dataTable([
    { key: "name", label: "Item" },
    { key: "game", label: "Game" },
    { key: "bought", label: "Bought", num: true,
      show: (r) => (r.boughtCount ? r.boughtCount + " x, " + marketMoney(r.bought) : "-") },
    { key: "sold", label: "Sold", num: true,
      show: (r) => (r.soldCount ? r.soldCount + " x, " + marketMoney(r.sold) : "-") },
    { key: "net", label: "Net", num: true, show: (r) => marketMoney(r.net) },
  ], market.rows, {
    sort: "net",
    placeholder: "Search market history",
    searchText: (r) => r.name + " " + r.game,
    rowClass: (r) => (r.net < 0 ? "loss" : r.net > 0 ? "gain" : ""),
  });

  return el("div", {},
    tiles,
    progress,
    el("section", {}, el("h2", {}, "Inventory"),
      inv.rows.length ? inventoryTable : el("div", { class: "list" }, "No items found.")),
    el("section", {}, el("h2", {}, "Market history"),
      market.rows.length ? marketTable : el("div", { class: "list" }, "No market purchases or sales found.")),
    el("section", { class: "notes" },
      el("h2", {}, "Good to know"),
      el("ul", {},
        notes.map((n) => el("li", { class: "error" }, n)),
        el("li", {}, "Inventories read: " + VL.INVENTORY_APPS.map((a) => a[2]).join(", ") + "."),
        el("li", {}, "Prices are the lowest current listing on the Steam market and are kept "
          + "for one day. Steam allows about 20 price requests per minute, so a big "
          + "inventory takes a while the first time."),
        el("li", {}, "\"You would get\" subtracts the Steam and game fees from each price."),
        el("li", {}, "Market profit or loss uses the prices exactly as your market history "
          + "shows them." + (data.historyComplete ? "" : " The history is not complete yet, "
          + "click Refresh to load the rest.")),
        el("li", {}, "Nothing is sold or listed automatically. All data stays in your browser.")
      )
    )
  );
}
