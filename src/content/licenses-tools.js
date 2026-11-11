// Improvements for the licenses page
// (store.steampowered.com/account/licenses/), a long table without search:
// a search field, a year filter and how many licenses match.
//
// Steam's own buttons in the table (for example "Remove" for free
// licenses) are not touched. If the table can't be found, the page stays
// as it is.

(function () {
  const VL = globalThis.VL;
  if (!location.pathname.startsWith("/account/licenses")) return;

  VL.content.runFeature("licensesTools", () => {
    const table = document.querySelector("table.account_table");
    if (!table) return;
    const rows = [...table.querySelectorAll("tr")].filter((tr) => tr.querySelector("td"));
    if (rows.length === 0) return;

    // The first cell is the date the license was added.
    const years = new Map(rows.map((row) => {
      const date = VL.parseDate(row.querySelector("td").textContent);
      return [row, date ? new Date(date).getUTCFullYear() : null];
    }));
    const yearList = [...new Set(years.values())].filter(Boolean).sort((a, b) => b - a);

    const filter = VL.content.rowFilter({
      rows: () => rows,
      search: VL.t("lcSearch"),
      choice: {
        label: VL.t("lcYear"),
        options: [["", VL.t("lcAllYears")], ...yearList.map((y) => [String(y), String(y)])],
        of: (row) => years.get(row),
      },
      count: (shown, all) => VL.t("lcCount", shown, all),
    });
    table.before(filter.bar);
    filter.apply();
  });
})();
