// Improvements for the purchase history
// (store.steampowered.com/account/history/).
//
// - A search field and a type filter above Steam's table.
// - "Load all" clicks Steam's own "Load more" button one time after
//   another, with a pause, until the whole history is shown. It can be
//   stopped at any time. Nothing else is loaded.
//
// If Steam's table can't be found, the page stays as it is.

(function () {
  const VL = globalThis.VL;
  if (!location.pathname.startsWith("/account/history")) return;
  const el = VL.el;
  // Pause between two clicks on "Load more", like a person would click.
  const LOAD_MORE_DELAY_MS = 1200;
  const TYPES = ["purchase", "gift", "ingame", "refund", "wallet", "market", "other"];

  VL.content.runFeature("historyTools", () => {
    const table = document.querySelector(".wallet_history_table");
    if (!table) return;

    const state = { search: "", type: "", loading: false };
    const count = el("span", { class: "vl-count", "aria-live": "polite" });
    const search = VL.content.searchBox(VL.t("htSearch"), (e) => {
      state.search = e.target.value.toLowerCase();
      apply();
    });
    const typeSelect = el("select", { class: "vl-select", "aria-label": VL.t("htType"),
      onchange: (e) => { state.type = e.target.value; apply(); } },
    el("option", { value: "" }, VL.t("htAllTypes")),
    TYPES.map((type) => el("option", { value: type }, VL.t("htType_" + type))));
    const loadAll = VL.content.button(VL.t("htLoadAll"), toggleLoading);

    function rows() {
      return [...table.querySelectorAll("tr.wallet_table_row")];
    }

    // The type of a row, read once with the same parser Vapor Ledger uses.
    function rowType(row) {
      if (!row.dataset.vlType) {
        const [t] = VL.parseHistoryRows({ querySelectorAll: () => [row] });
        row.dataset.vlType = t ? t.type : "other";
      }
      return row.dataset.vlType;
    }

    function apply() {
      let shown = 0;
      const all = rows();
      for (const row of all) {
        const match = (!state.search || row.textContent.toLowerCase().includes(state.search))
          && (!state.type || rowType(row) === state.type);
        row.classList.toggle("vl-hidden", !match);
        if (match) shown++;
      }
      count.textContent = VL.t("htCount", shown, all.length);
    }

    function loadMoreButton() {
      const button = document.getElementById("load_more_button");
      return button && button.offsetParent !== null ? button : null;
    }

    async function toggleLoading() {
      if (state.loading) {
        state.loading = false;
        return;
      }
      state.loading = true;
      loadAll.textContent = VL.t("htStop");
      let before = -1;
      while (state.loading) {
        const button = loadMoreButton();
        const now = rows().length;
        if (!button || now === before) break; // all loaded, or Steam stopped answering
        before = now;
        button.click();
        // Wait until Steam added rows, at most 15 seconds.
        for (let waited = 0; waited < 15000 && rows().length === now; waited += 300) await VL.sleep(300);
        await VL.sleep(LOAD_MORE_DELAY_MS);
      }
      state.loading = false;
      loadAll.textContent = VL.t("htLoadAll");
      loadAll.hidden = !loadMoreButton();
    }

    const bar = el("div", { class: "vl-ui vl-toolbar" }, search, typeSelect, loadAll, count);
    table.before(bar);
    loadAll.hidden = !loadMoreButton();

    // Rows Steam adds through "Load more" are filtered too.
    new MutationObserver((records) => {
      if (VL.content.addedBySteam(records)) apply();
    }).observe(table, { childList: true, subtree: true });
    apply();
  });
})();
