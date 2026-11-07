// The dashboard overlay. It is drawn into a shadow root on top of the
// Steam store page and can be closed again with the X button or Escape.

var VL = globalThis.VL || {};
globalThis.VL = VL;

const el = VL.el;
let host = null; // the element that holds the shadow root

VL.openDashboard = async function () {
  if (host) return;

  host = document.createElement("div");
  host.id = "vapor-ledger";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.append(el("style", {}, VL.STYLES));

  const content = el("main", {}, el("div", { class: "status" }, "Starting..."));
  const updated = el("span", { class: "updated" });
  const refresh = el("button", { onclick: () => load(true) }, "Refresh");
  const close = el("button", { onclick: VL.closeDashboard, title: "Close" }, "✕");

  const backdrop = el(
    "div",
    { class: "backdrop", onclick: (e) => e.target === backdrop && VL.closeDashboard() },
    el("div", { class: "window" },
      el("header", {}, el("h1", {}, "Vapor Ledger"), updated, refresh, close),
      content
    )
  );
  shadow.append(backdrop);
  document.body.append(host);
  document.addEventListener("keydown", onKey);

  function showStatus(text, isError) {
    content.replaceChildren(el("div", { class: "status" + (isError ? " error" : "") }, text));
  }

  async function load(force) {
    const session = VL.getSession();
    if (!session) {
      showStatus("Please log in to Steam first, then open Vapor Ledger again.", true);
      return;
    }

    refresh.disabled = true;
    try {
      let data = force ? null : await VL.loadCache(session.steamid);
      if (!data) {
        showStatus("Loading your games...");
        const games = await VL.fetchOwnedGames(session);
        showStatus("Loading purchase history...");
        const transactions = await VL.fetchPurchaseHistory((page, count) => {
          showStatus("Loading purchase history (page " + page + ", " + count + " entries)...");
        });
        data = { games, transactions, fetchedAt: Date.now() };
        await VL.saveCache(session.steamid, data);
      }
      // Store prices are a separate step. If they fail, the rest of the
      // dashboard still works and the next open tries again.
      if (!data.store && session.country) {
        showStatus("Loading store prices...");
        try {
          const appids = data.games.map((g) => g.appid);
          data.store = await VL.fetchStorePrices(appids, session.country, (done, total) => {
            showStatus("Loading store prices (" + done + " of " + total + " games)...");
          });
          await VL.saveCache(session.steamid, data);
        } catch (error) {
          console.warn("[Vapor Ledger] Store prices not available", error);
        }
      }
      updated.textContent = "Data from " + new Date(data.fetchedAt).toLocaleString();
      renderStats(content, VL.buildStats(data.games, data.transactions, data.store || null));
    } catch (error) {
      console.error("[Vapor Ledger]", error);
      showStatus("Something went wrong: " + error.message, true);
    } finally {
      refresh.disabled = false;
    }
  }

  load(false);
};

VL.closeDashboard = function () {
  if (!host) return;
  host.remove();
  host = null;
  document.removeEventListener("keydown", onKey);
  if (location.hash === "#vapor-ledger") {
    history.replaceState(null, "", location.pathname + location.search);
  }
};

function onKey(event) {
  if (event.key === "Escape") VL.closeDashboard();
}

// ---------- Rendering ----------

function tile(label, value, hint) {
  return el("div", { class: "tile" },
    el("div", { class: "label" }, label),
    el("div", { class: "value" }, value),
    hint ? el("div", { class: "hint" }, hint) : null
  );
}

function listRow(label, value, muted) {
  return el("div", { class: "list-row" },
    el("span", { class: muted ? "muted" : "" }, label),
    el("span", {}, value)
  );
}

function renderStats(content, stats) {
  const money = (v) => VL.formatMoney(v, stats.currency);
  const storeMoney = (v) => VL.formatMoney(v, stats.storeCurrency || stats.currency);
  const percent = stats.gameCount ? Math.round((stats.pileCount / stats.gameCount) * 100) : 0;

  const tiles = el("section", {},
    el("div", { class: "tiles" },
      tile("Total spent", money(stats.spent), "purchases minus refunds"),
      tile("Games", stats.gameCount.toLocaleString()),
      tile("Total playtime", VL.formatHours(stats.totalMinutes)),
      tile("Pile of shame", stats.pileCount + " (" + percent + "%)",
        "under " + VL.PILE_OF_SHAME_MINUTES / 60 + " h, " + stats.neverPlayedCount + " never started"),
      tile("Paid for the pile", money(stats.pilePaid), "known prices only"),
      tile("Spent per hour", stats.costPerHour === null ? "-" : money(stats.costPerHour),
        "total spent / total playtime"),
      stats.hasStorePrices
        ? tile("Store value today", storeMoney(stats.storeValue),
          stats.storePricedCount + " games still for sale, pile: " + storeMoney(stats.pileStoreValue))
        : null
    )
  );

  const breakdown = el("div", {},
    el("h2", {}, "Spending"),
    el("div", { class: "list" },
      listRow("Store purchases", money(stats.byType.purchase)),
      listRow("Gifts for others", money(stats.byType.gift)),
      listRow("In-game purchases", money(stats.byType.ingame)),
      listRow("Refunds", "- " + money(stats.byType.refund)),
      listRow("Wallet top-ups (not counted)", money(stats.byType.wallet), true),
      listRow("Market, net wallet change (not counted)", money(stats.marketNet), true),
      listRow("Other entries (not counted)", money(stats.byType.other), true)
    )
  );

  content.replaceChildren(
    tiles,
    el("section", { class: "columns" }, breakdown, renderYears(stats, money)),
    renderTable(stats, money),
    renderNotes(stats)
  );
}

function renderYears(stats, money) {
  const years = Object.keys(stats.byYear).filter((y) => y !== "?").sort();
  const max = Math.max(...years.map((y) => stats.byYear[y]), 1);
  return el("div", {},
    el("h2", {}, "Spending per year"),
    el("div", { class: "list" },
      years.length === 0 ? el("div", { class: "list-row" }, "No purchases found") : null,
      years.map((year) => {
        const value = stats.byYear[year];
        const width = Math.max(0, (value / max) * 100);
        return el("div", { class: "bar-row" },
          el("span", {}, year),
          el("div", {}, el("div", { class: "bar", style: "width:" + width + "%" })),
          el("span", { class: "amount" }, money(value))
        );
      })
    )
  );
}

// The games table, with filter buttons, a search field and sortable columns.
function renderTable(stats, money) {
  const columns = [
    { key: "name", label: "Game" },
    { key: "minutes", label: "Playtime", num: true, show: (g) => VL.formatHours(g.minutes) },
    { key: "lastPlayed", label: "Last played", num: true, show: (g) => VL.formatDate(g.lastPlayed) },
    { key: "paid", label: "Paid", num: true, show: (g) => (g.paid === null ? "-" : money(g.paid)) },
    { key: "costPerHour", label: "Per hour", num: true,
      show: (g) => (g.costPerHour === null ? "-" : money(g.costPerHour)) },
  ];
  if (stats.hasStorePrices) {
    const storeMoney = (v) => VL.formatMoney(v, stats.storeCurrency || stats.currency);
    columns.push({ key: "storePrice", label: "Store today", num: true, show: (g) => {
      if (g.storePrice === null) return "-";
      if (g.storePrice === 0) return "free";
      return storeMoney(g.storePrice) + (g.storeDiscount ? " (-" + g.storeDiscount + "%)" : "");
    } });
  }

  const state = { filter: "all", sort: "minutes", desc: true, search: "" };
  const tbody = el("tbody");
  const headRow = el("tr");

  const filters = [
    { key: "all", label: "All games" },
    { key: "shame", label: "Pile of shame" },
    { key: "paid", label: "Known price" },
  ];
  const filterButtons = filters.map((f) =>
    el("button", { onclick: () => { state.filter = f.key; draw(); } }, f.label)
  );
  const search = el("input", {
    type: "search",
    placeholder: "Search games",
    oninput: (e) => { state.search = e.target.value.toLowerCase(); draw(); },
  });

  function draw() {
    filterButtons.forEach((b, i) => b.classList.toggle("active", filters[i].key === state.filter));

    let list = stats.games;
    if (state.filter === "shame") list = list.filter((g) => g.shame);
    if (state.filter === "paid") list = list.filter((g) => g.paid !== null);
    if (state.search) list = list.filter((g) => g.name.toLowerCase().includes(state.search));

    // Empty values (null) always go to the end, no matter the direction.
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
          state.desc = state.sort === c.key ? !state.desc : c.key !== "name";
          state.sort = c.key;
          draw();
        },
      }, c.label + arrow);
    }));

    tbody.replaceChildren(...list.map((g) =>
      el("tr", { class: g.shame ? "shame" : "" },
        columns.map((c) => el("td", { class: c.num ? "num" : "" }, c.show ? c.show(g) : g[c.key]))
      )
    ));
  }

  draw();
  return el("section", {},
    el("h2", {}, "Games"),
    el("div", { class: "filters" }, filterButtons, search),
    el("div", { class: "table-wrap" }, el("table", {}, el("thead", {}, headRow), tbody))
  );
}

function renderNotes(stats) {
  return el("section", { class: "notes" },
    el("h2", {}, "Good to know"),
    el("ul", {},
      el("li", {}, stats.transactionCount + " entries read from your purchase history, "
        + stats.matchedCount + " games matched to a price."),
      stats.multiItemPurchases > 0
        ? el("li", {}, stats.multiItemPurchases
          + (stats.multiItemPurchases === 1 ? " purchase had" : " purchases had")
          + " several items in one cart. Steam only shows the total for those, "
          + "so they count for the total but not for single games.")
        : null,
      Object.keys(stats.unknownTypes).length > 0
        ? el("li", {}, "Not recognized (counted as other): " + Object.entries(stats.unknownTypes)
          .map(([label, count]) => label + " (" + count + ")").join(", "))
        : null,
      el("li", {}, "Games from keys, bundles or gifts have no price on Steam and show \"-\"."),
      stats.hasStorePrices
        ? el("li", {}, "Store value today is what the games still for sale would cost in "
          + "the store right now, including current discounts. Removed games and free "
          + "games are not counted.")
        : el("li", {}, "Store prices could not be loaded this time. Click Refresh to try again."),
      el("li", {}, "All data stays in your browser. Vapor Ledger only talks to Steam.")
    )
  );
}
