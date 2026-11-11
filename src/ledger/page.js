// The Vapor Ledger page inside the Steam store. It lives at
// https://store.steampowered.com/account/#vapor-ledger (tabs as
// #vapor-ledger/<tab>), on Steam's own account page: Steam's header, store
// navigation and footer stay, only the content area shows Vapor Ledger.
// The page is drawn in a shadow root, so it doesn't mix with Steam's
// styles or with other extensions.
//
// If Steam's content area can't be found, the page is put at the top of
// the page instead, and Steam's own content stays below it.

var VL = globalThis.VL || {};
globalThis.VL = VL;

VL.LEDGER_HASH = "#vapor-ledger";
VL.LEDGER_TABS = ["overview", "spending", "games", "refunds", "inventory", "recap", "settings"];

// "#vapor-ledger/games" -> "games", other hashes -> null
VL.ledgerTab = function (hash) {
  if (hash !== VL.LEDGER_HASH && !hash.startsWith(VL.LEDGER_HASH + "/")) return null;
  const tab = hash.slice(VL.LEDGER_HASH.length + 1);
  return VL.LEDGER_TABS.includes(tab) ? tab : "overview";
};

// Where the page goes: Steam's content area, without the store navigation.
function steamContentArea() {
  const area = document.getElementById("responsive_page_template_content");
  if (!area) return null;
  const keep = (node) => node.id === "store_header" || node.querySelector("#store_header") !== null;
  return { area, hide: [...area.children].filter((node) => !keep(node) && !["SCRIPT", "STYLE"].includes(node.tagName)) };
}

let ledger = null; // { host, hidden, title, app }

function mount() {
  if (ledger) return ledger;
  const host = VL.el("div", { id: "vapor-ledger-page" });
  const shadow = host.attachShadow({ mode: "open" });
  shadow.append(VL.el("style", {}, VL.LEDGER_STYLES));
  const target = steamContentArea();
  const hidden = [];
  if (target) {
    for (const node of target.hide) {
      hidden.push([node, node.style.display]);
      node.style.display = "none";
    }
    target.area.append(host);
  } else {
    document.body.prepend(host);
  }
  ledger = { host, hidden, title: document.title, app: buildApp(shadow) };
  document.title = VL.t("appTitle") + " :: Steam";
  return ledger;
}

function unmount() {
  if (!ledger) return;
  for (const [node, display] of ledger.hidden) node.style.display = display;
  ledger.host.remove();
  document.title = ledger.title;
  ledger = null;
}

function buildApp(root) {
  const el = VL.el;
  const app = { data: null, stats: null, steamid: null, community: null, tab: "overview", busy: false };
  const updated = el("span", { class: "updated" });
  const reload = el("button", { type: "button", onclick: () => load(true) }, VL.t("refresh"));
  const hero = el("div", { class: "hero", hidden: true });
  const main = el("div", { id: "vl-content", role: "tabpanel" });
  const tabButtons = VL.LEDGER_TABS.map((key) => el("button", {
    type: "button",
    role: "tab",
    id: "vl-tab-" + key,
    class: key === "settings" ? "tab-end" : null,
    onclick: () => { location.hash = VL.LEDGER_HASH + (key === "overview" ? "" : "/" + key); },
    onkeydown: (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      const tabs = VL.LEDGER_TABS;
      const next = tabs[(tabs.indexOf(key) + step + tabs.length) % tabs.length];
      root.getElementById("vl-tab-" + next).click();
      root.getElementById("vl-tab-" + next).focus();
    },
  }, VL.t("tab_" + key)));

  root.append(el("div", { class: "vl-page" },
    el("div", { class: "vl-head" },
      el("h1", {}, el("span", {}, VL.t("appKicker")), VL.t("appTitle")),
      updated, reload),
    hero,
    el("div", { class: "tabs", role: "tablist", "aria-label": VL.t("appTitle") }, tabButtons),
    main,
    el("p", { class: "muted" }, VL.t("footer"))
  ));

  function status(text, isError) {
    main.replaceChildren(el("p", { class: "status" + (isError ? " error" : ""), role: "status" }, text));
  }

  function view() {
    return {
      data: app.data,
      stats: app.stats,
      steamid: app.steamid,
      balance: app.stats ? VL.buildBalance(app.stats, app.community) : null,
      onCommunity: (community) => {
        app.community = community;
        drawHero();
      },
    };
  }

  function drawHero() {
    hero.hidden = !app.stats;
    if (app.stats) hero.replaceChildren(...VL.views.heroFigures(view()));
  }

  function showTab(key) {
    app.tab = key;
    tabButtons.forEach((b, i) => {
      const selected = VL.LEDGER_TABS[i] === key;
      b.setAttribute("aria-selected", String(selected));
      b.tabIndex = selected ? 0 : -1;
    });
    main.setAttribute("aria-labelledby", "vl-tab-" + key);
    if (key !== "settings" && !app.stats) {
      if (!app.busy) status(VL.t("loadingSaved"));
      return;
    }
    try {
      main.replaceChildren(VL.views[key](view()));
    } catch (error) {
      console.error("[Vapor Ledger]", error);
      status(VL.t("somethingWrong", error.message), true);
    }
  }

  async function show(data, steamid) {
    app.data = data;
    app.steamid = steamid;
    app.stats = VL.buildStats(data.games, data.transactions, data.store || null);
    app.community = await VL.loadCache("community-" + steamid);
    await VL.loadPriceSources(app.stats, data);
    updated.textContent = VL.t("dataFrom", new Date(data.fetchedAt).toLocaleString(VL.locale()));
    drawHero();
    showTab(app.tab);
  }

  async function loadFromSteam(progress) {
    progress(VL.t("loadingStart"));
    const first = await VL.openHistoryPage();
    const session = first.session;
    progress(VL.t("loadingGames"));
    const games = await VL.fetchOwnedGames(session);
    const history = await VL.fetchPurchaseHistory(first, (page, count) => progress(VL.t("loadingHistory", page, count)));
    const data = { games, transactions: history.transactions, historyComplete: history.complete, store: null,
      fetchedAt: Date.now() };
    // Store prices are a separate step. If they fail, the rest still works.
    if (session.country) {
      try {
        data.store = await VL.fetchStorePrices(games.map((g) => g.appid), session.country,
          (done, total) => progress(VL.t("loadingStorePricesCount", done, total)));
      } catch (error) {
        console.warn("[Vapor Ledger] Store prices not available", error);
      }
    }
    await VL.saveCache(session.steamid, data);
    await VL.saveLastAccount(session.steamid);
    return { data, steamid: session.steamid };
  }

  async function load(force) {
    if (app.busy) return;
    app.busy = true;
    reload.disabled = true;
    const progress = (text) => { if (app.tab !== "settings") status(text); };
    try {
      const own = VL.readStoreSession(document);
      const steamid = own ? own.steamid : await VL.loadLastAccount();
      const cached = !force && steamid ? await VL.loadCache(steamid) : null;
      if (cached && cached.games && cached.transactions) {
        await show(cached, steamid);
      } else {
        const result = await loadFromSteam(progress);
        await show(result.data, result.steamid);
      }
    } catch (error) {
      if (error && error.notLoggedIn) {
        main.replaceChildren(el("div", { class: "callout" },
          el("h3", {}, VL.t("loginTitle")), el("p", {}, VL.t("loginText")),
          el("p", {}, el("a", { href: "https://store.steampowered.com/login/" }, VL.t("loginLink")))));
      } else {
        console.error("[Vapor Ledger]", error);
        status(VL.t("somethingWrong", error.message), true);
      }
    } finally {
      app.busy = false;
      reload.disabled = false;
    }
  }

  load(false);
  return { showTab };
}

function route() {
  const tab = VL.ledgerTab(location.hash);
  if (tab === null) {
    unmount();
    return;
  }
  mount().app.showTab(tab);
  window.scrollTo(0, 0);
}

VL.startLedger = function () {
  window.addEventListener("hashchange", route);
  route();
};
