// Improvements for the licenses page
// (store.steampowered.com/account/licenses/), a long table without search.
//
// - A search field above Steam's table and how many licenses match.
// - "Only from the last ..." filter by year.
//
// Steam's own buttons in the table (for example "Remove" for free
// licenses) are not touched. If the table can't be found, the page stays
// as it is.

(function () {
  const VL = globalThis.VL;
  if (!location.pathname.startsWith("/account/licenses")) return;
  const el = VL.el;

  VL.content.runFeature("licensesTools", () => {
    const table = document.querySelector("table.account_table");
    if (!table) return;
    const rows = [...table.querySelectorAll("tr")].filter((tr) => tr.querySelector("td"));
    if (rows.length === 0) return;

    // The first cell is the date the license was added.
    const yearOf = (row) => {
      const date = VL.parseDate(row.querySelector("td").textContent);
      return date ? new Date(date).getUTCFullYear() : null;
    };
    const years = [...new Set(rows.map(yearOf).filter(Boolean))].sort((a, b) => b - a);

    const state = { search: "", year: "" };
    const count = el("span", { class: "vl-count", "aria-live": "polite" });
    const search = VL.content.searchBox(VL.t("lcSearch"), (e) => {
      state.search = e.target.value.toLowerCase();
      apply();
    });
    const yearSelect = el("select", { class: "vl-select", "aria-label": VL.t("lcYear"),
      onchange: (e) => { state.year = e.target.value; apply(); } },
    el("option", { value: "" }, VL.t("lcAllYears")),
    years.map((y) => el("option", { value: y }, String(y))));

    function apply() {
      let shown = 0;
      for (const row of rows) {
        const match = (!state.search || row.textContent.toLowerCase().includes(state.search))
          && (!state.year || String(yearOf(row)) === state.year);
        row.classList.toggle("vl-hidden", !match);
        if (match) shown++;
      }
      count.textContent = VL.t("lcCount", shown, rows.length);
    }

    table.before(el("div", { class: "vl-ui vl-toolbar" }, search, years.length > 1 ? yearSelect : null, count));
    apply();
  });
})();
