// Small building blocks for the pages: tiles, lists and a sortable,
// searchable table.

var VL = globalThis.VL || {};
globalThis.VL = VL;

VL.tile = function (label, value, hint, extraClass) {
  return VL.el("div", { class: "tile" + (extraClass ? " " + extraClass : "") },
    VL.el("div", { class: "label" }, label),
    VL.el("div", { class: "value" }, value),
    hint ? VL.el("div", { class: "hint" }, hint) : null
  );
};

VL.listRow = function (label, value, muted) {
  return VL.el("div", { class: "list-row" + (muted ? " muted" : "") },
    VL.el("span", {}, label),
    VL.el("span", { class: "num" }, value)
  );
};

VL.section = function (title, ...children) {
  return VL.el("section", {}, title ? VL.el("h2", {}, title) : null, ...children);
};

// columns: [{ key, label, num, show(row) }]
// options: { sort, desc, placeholder, searchText(row), rowClass(row),
//   filters: [{ key, label, test(row) }] }
// Returns an element with setRows(rows), which swaps the data and keeps
// search text, filter and sorting, so the table can update while data
// is still loading.
VL.dataTable = function (columns, rows, options) {
  const el = VL.el;
  const state = { sort: options.sort, desc: options.desc !== false, search: "", filter: 0 };
  const tbody = el("tbody");
  const headRow = el("tr");
  const count = el("span", { class: "count", "aria-live": "polite" });
  const search = el("input", {
    type: "search",
    placeholder: options.placeholder || VL.t("search"),
    "aria-label": options.placeholder || VL.t("search"),
    oninput: (e) => { state.search = e.target.value.toLowerCase(); draw(); },
  });
  const filters = options.filters || [];
  const filterButtons = filters.map((f, i) =>
    el("button", { type: "button", onclick: () => { state.filter = i; draw(); } }, f.label));

  function draw() {
    filterButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(i === state.filter)));
    let list = rows;
    if (filters.length) list = list.filter(filters[state.filter].test);
    if (state.search) list = list.filter((r) => options.searchText(r).toLowerCase().includes(state.search));
    // Empty values (null) always go to the end, no matter the direction.
    list = [...list].sort((a, b) => {
      const x = a[state.sort];
      const y = b[state.sort];
      if ((x === null || x === undefined) && (y === null || y === undefined)) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const result = typeof x === "string" ? x.localeCompare(y) : x - y;
      return state.desc ? -result : result;
    });
    count.textContent = VL.t("tableRows", list.length);
    headRow.replaceChildren(...columns.map((c) => {
      const sorted = state.sort === c.key;
      return el("th", {
        class: c.num ? "num" : "",
        "aria-sort": sorted ? (state.desc ? "descending" : "ascending") : "none",
      }, el("button", {
        type: "button",
        class: "sort",
        onclick: () => {
          state.desc = sorted ? !state.desc : Boolean(c.num);
          state.sort = c.key;
          draw();
        },
      }, c.label + (sorted ? (state.desc ? " ▼" : " ▲") : "")));
    }));
    tbody.replaceChildren(...list.map((r) =>
      el("tr", { class: options.rowClass ? options.rowClass(r) : "" },
        columns.map((c) => el("td", { class: c.num ? "num" : "" }, c.show ? c.show(r) : r[c.key])))
    ));
  }

  draw();
  const node = el("div", {},
    el("div", { class: "filters" }, filterButtons, search, count),
    el("div", { class: "table-wrap" }, el("table", {}, el("thead", {}, headRow), tbody))
  );
  node.setRows = (newRows) => {
    rows = newRows;
    draw();
  };
  return node;
};
