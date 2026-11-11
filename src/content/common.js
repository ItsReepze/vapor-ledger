// Shared helpers for the improvements on Steam's own pages.
//
// Rules for every improvement:
// - Only change how the page looks and is used. Steam's own forms,
//   buttons and save paths stay exactly as they are. Nothing is sent to
//   Steam that Steam's page would not send itself.
// - If an element we look for is missing (Steam changed its layout), the
//   improvement does nothing and the original page stays as it is.
// - Steam's data is only ever added as text, never as HTML.

var VL = globalThis.VL || {};
globalThis.VL = VL;

VL.content = {};

// Runs fn once if the feature is switched on. Errors never break the page.
VL.content.runFeature = async function (key, fn) {
  try {
    const settings = await VL.loadSettings();
    if (!settings[key]) return;
    await fn();
  } catch (error) {
    console.warn("[Vapor Ledger] " + key + " is not active on this page", error);
  }
};

// Calls fn now and whenever Steam's page changes (pages built with React
// render late and swap their content without a page load). fn must be
// safe to call many times.
// root: the part of the page to watch (as small as possible).
VL.content.watch = function (fn, root) {
  let queued = false;
  const run = () => {
    queued = false;
    try {
      fn();
    } catch (error) {
      console.warn("[Vapor Ledger]", error);
    }
  };
  run();
  new MutationObserver((records) => {
    if (queued || !VL.content.addedBySteam(records)) return;
    queued = true;
    requestAnimationFrame(run);
  }).observe(root || document.body, { childList: true, subtree: true });
};

// True if Steam added elements to the page. Our own additions (class
// "vl-ui") and changes of attributes are ignored, so an improvement never
// wakes itself up again.
VL.content.addedBySteam = function (records) {
  return records.some((record) => record.type === "childList" && [...record.addedNodes].some((node) =>
    node.nodeType === 1 && !(node.classList && node.classList.contains("vl-ui"))));
};

// A button in Steam's own style. Steam's classes are used where the page
// has them, our CSS (steam-tools.css) gives the same look elsewhere.
VL.content.button = function (label, onclick, kind) {
  return VL.el("button", {
    type: "button",
    class: "vl-btn" + (kind ? " vl-btn-" + kind : ""),
    onclick,
  }, label);
};

// A search field in Steam's style.
VL.content.searchBox = function (placeholder, oninput) {
  return VL.el("input", {
    type: "search",
    class: "vl-search",
    placeholder,
    "aria-label": placeholder,
    oninput,
  });
};

// A search field and a select above one of Steam's tables, hiding rows
// that don't match. Used by the purchase history and the licenses page.
// options: { rows() -> [tr], search, choice: { label, options: [[value, text]], of(row) },
//   count(shown, all) -> text, extra: [elements] }
// Returns { bar, apply }.
VL.content.rowFilter = function (options) {
  const el = VL.el;
  const state = { search: "", choice: "" };
  const count = el("span", { class: "vl-count", "aria-live": "polite" });
  const search = VL.content.searchBox(options.search, (e) => {
    state.search = e.target.value.toLowerCase();
    apply();
  });
  const choice = options.choice && options.choice.options.length > 1
    ? el("select", { class: "vl-select", "aria-label": options.choice.label,
      onchange: (e) => { state.choice = e.target.value; apply(); } },
    options.choice.options.map(([value, text]) => el("option", { value }, text)))
    : null;

  function apply() {
    const all = options.rows();
    let shown = 0;
    for (const row of all) {
      const match = (!state.search || row.textContent.toLowerCase().includes(state.search))
        && (!state.choice || String(options.choice.of(row)) === state.choice);
      row.classList.toggle("vl-hidden", !match);
      if (match) shown++;
    }
    count.textContent = options.count(shown, all.length);
  }

  const bar = el("div", { class: "vl-ui vl-toolbar" }, search, choice, ...(options.extra || []), count);
  return { bar, apply };
};

// "Save" in all Steam languages, to find Steam's own save button.
VL.content.SAVE_WORDS = [
  "save", "speichern", "enregistrer", "guardar", "salva", "salvar", "сохранить", "zapisz", "uložit",
  "opslaan", "gem", "lagre", "spara", "tallenna", "mentés", "salvează", "kaydet", "зберегти", "запази",
  "αποθήκευση", "保存", "저장", "儲存", "บันทึก", "lưu", "simpan", "حفظ",
];
