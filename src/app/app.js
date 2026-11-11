// The Vapor Ledger page. It is a page of the extension itself, not an
// overlay on Steam. It loads the data from Steam (see src/lib/steam.js),
// keeps it in the extension's local storage and shows it in tabs.

var VL = globalThis.VL || {};
globalThis.VL = VL;

const TABS = ["overview", "refunds", "worth", "charts", "inventory", "share"];

VL.startApp = function () {
  const el = VL.el;
  document.title = VL.t("appTitle");
  document.documentElement.lang = VL.t("langCode");

  const app = { data: null, stats: null, steamid: null, community: null, tab: "overview", busy: false };
  const updated = el("span", { class: "updated" });
  const refresh = el("button", { type: "button", onclick: () => load(true) }, VL.t("refresh"));
  const main = el("main", { id: "content", tabindex: "-1" });
  const tabButtons = TABS.map((key) => el("button", {
    type: "button",
    role: "tab",
    id: "tab-" + key,
    "aria-controls": "content",
    onclick: () => showTab(key),
    onkeydown: (e) => {
      const i = TABS.indexOf(key);
      const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
      if (next === null) return;
      const target = TABS[(next + TABS.length) % TABS.length];
      showTab(target);
      document.getElementById("tab-" + target).focus();
    },
  }, VL.t("tab_" + key)));
  const nav = el("nav", { role: "tablist", "aria-label": VL.t("appTitle") }, tabButtons);

  document.body.replaceChildren(
    el("header", { class: "top" },
      el("h1", {}, el("img", { src: "../../icons/icon48.png", alt: "", width: 28, height: 28 }), VL.t("appTitle")),
      updated, refresh),
    nav,
    main,
    el("footer", {}, VL.t("footer"))
  );

  function showStatus(text, isError) {
    main.setAttribute("role", "tabpanel");
    main.replaceChildren(el("p", { class: "status" + (isError ? " error" : ""), role: "status" }, text));
  }

  function showLogin() {
    main.replaceChildren(el("div", { class: "callout" },
      el("h2", {}, VL.t("loginTitle")),
      el("p", {}, VL.t("loginText")),
      el("p", {}, el("a", { href: "https://store.steampowered.com/login/", target: "_blank", rel: "noopener" },
        VL.t("loginLink"))),
      el("button", { type: "button", class: "primary", onclick: () => load(true) }, VL.t("loginRetry"))
    ));
  }

  function showTab(key) {
    if (!TABS.includes(key)) key = "overview";
    app.tab = key;
    if (location.hash !== "#" + key) history.replaceState(null, "", "#" + key);
    tabButtons.forEach((b, i) => {
      const selected = TABS[i] === key;
      b.setAttribute("aria-selected", String(selected));
      b.tabIndex = selected ? 0 : -1;
    });
    main.setAttribute("aria-labelledby", "tab-" + key);
    if (!app.stats) return;
    const view = {
      data: app.data,
      stats: app.stats,
      steamid: app.steamid,
      balance: VL.buildBalance(app.stats, app.community),
      onCommunity: (community) => { app.community = community; },
    };
    try {
      main.replaceChildren(VL.views[key](view));
    } catch (error) {
      console.error("[Vapor Ledger]", error);
      showStatus(VL.t("somethingWrong", error.message), true);
    }
  }

  async function show(data, steamid) {
    app.data = data;
    app.steamid = steamid;
    app.stats = VL.buildStats(data.games, data.transactions, data.store || null);
    app.community = await VL.loadCache("community-" + steamid);
    updated.textContent = VL.t("dataFrom", new Date(data.fetchedAt).toLocaleString(VL.locale()));
    showTab(app.tab);
  }

  async function loadFromSteam() {
    showStatus(VL.t("loadingStart"));
    const first = await VL.openHistoryPage();
    const session = first.session;
    showStatus(VL.t("loadingGames"));
    const games = await VL.fetchOwnedGames(session);
    const history = await VL.fetchPurchaseHistory(first, (page, count) => {
      showStatus(VL.t("loadingHistory", page, count));
    });
    const data = {
      games,
      transactions: history.transactions,
      historyComplete: history.complete,
      store: null,
      fetchedAt: Date.now(),
    };
    // Store prices are a separate step. If they fail, the rest still works.
    if (session.country) {
      try {
        showStatus(VL.t("loadingStorePrices"));
        data.store = await VL.fetchStorePrices(games.map((g) => g.appid), session.country, (done, total) => {
          showStatus(VL.t("loadingStorePricesCount", done, total));
        });
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
    refresh.disabled = true;
    try {
      if (!force) {
        const steamid = await VL.loadLastAccount();
        const data = steamid ? await VL.loadCache(steamid) : null;
        if (data && data.games && data.transactions) {
          await show(data, steamid);
          return;
        }
      }
      const result = await loadFromSteam();
      await show(result.data, result.steamid);
    } catch (error) {
      if (error && error.notLoggedIn) {
        showLogin();
      } else {
        console.error("[Vapor Ledger]", error);
        showStatus(VL.t("somethingWrong", error.message), true);
      }
    } finally {
      app.busy = false;
      refresh.disabled = false;
    }
  }

  window.addEventListener("hashchange", () => showTab(location.hash.slice(1)));
  showTab(location.hash.slice(1) || "overview");
  load(false);
};
