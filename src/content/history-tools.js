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
  // Pause between two clicks on "Load more", like a person would click.
  const LOAD_MORE_DELAY_MS = 1200;
  const TYPES = ["purchase", "gift", "ingame", "refund", "wallet", "market", "other"];

  VL.content.runFeature("historyTools", () => {
    const table = document.querySelector(".wallet_history_table");
    if (!table) return;
    let loading = false;

    const rows = () => [...table.querySelectorAll("tr.wallet_table_row")];
    // The type of a row, read once with the same parser Vapor Ledger uses.
    const typeOf = (row) => {
      if (!row.dataset.vlType) {
        const [t] = VL.parseHistoryRows({ querySelectorAll: () => [row] });
        row.dataset.vlType = t ? t.type : "other";
      }
      return row.dataset.vlType;
    };
    const loadMoreButton = () => {
      const button = document.getElementById("load_more_button");
      return button && button.offsetParent !== null ? button : null;
    };

    const loadAll = VL.content.button(VL.t("htLoadAll"), async () => {
      if (loading) {
        loading = false;
        return;
      }
      loading = true;
      loadAll.textContent = VL.t("htStop");
      let before = -1;
      while (loading) {
        const button = loadMoreButton();
        const now = rows().length;
        if (!button || now === before) break; // all loaded, or Steam stopped answering
        before = now;
        button.click();
        // Wait until Steam added rows, at most 15 seconds.
        for (let waited = 0; waited < 15000 && rows().length === now; waited += 300) await VL.sleep(300);
        await VL.sleep(LOAD_MORE_DELAY_MS);
      }
      loading = false;
      loadAll.textContent = VL.t("htLoadAll");
      loadAll.hidden = !loadMoreButton();
    });
    loadAll.hidden = !loadMoreButton();

    const filter = VL.content.rowFilter({
      rows,
      search: VL.t("htSearch"),
      choice: {
        label: VL.t("htType"),
        options: [["", VL.t("htAllTypes")], ...TYPES.map((type) => [type, VL.t("htType_" + type)])],
        of: typeOf,
      },
      count: (shown, all) => VL.t("htCount", shown, all),
      extra: [loadAll],
    });
    table.before(filter.bar);
    filter.apply();

    // Rows Steam adds through "Load more" are filtered too.
    new MutationObserver((records) => {
      if (VL.content.addedBySteam(records)) filter.apply();
    }).observe(table, { childList: true, subtree: true });
  });
})();
