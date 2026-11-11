// Improvements for the profile edit pages
// (steamcommunity.com/id/<name>/edit/... and /profiles/<id>/edit/...).
//
// - Steam's own Save button stays in view at the bottom of the window
//   while you scroll, with a note when there are unsaved changes.
// - Ctrl+S (Cmd+S) clicks Steam's own Save button.
// - The browser asks before leaving the page with unsaved changes.
// - Text fields show how many characters they have (and the limit, if
//   Steam sets one).
// - The custom URL field shows the full profile address it will give and
//   which characters Steam allows.
//
// Saving always happens through Steam's own button and form. If Steam's
// Save button can't be found, the page stays as it is.

(function () {
  const VL = globalThis.VL;
  if (!/^\/(id|profiles)\/[^/]+\/edit/.test(location.pathname)) return;
  const el = VL.el;
  let dirty = false;
  let lastSave = null;

  // Steam builds the edit page inside #application_root.
  const root = () => document.getElementById("application_root") || document.body;

  // Steam's Save button: a visible button whose text is "Save" in the
  // page language, inside Steam's own page (not one added by another
  // extension elsewhere).
  function findSaveButton() {
    for (const button of root().querySelectorAll("button, [role='button'], input[type='submit']")) {
      if (button.closest(".vl-ui")) continue;
      const text = (button.value || button.textContent || "").trim().toLowerCase();
      if (VL.content.SAVE_WORDS.includes(text) && button.offsetParent !== null) return button;
    }
    return null;
  }

  function editableFields() {
    return [...root().querySelectorAll("textarea, input[type='text'], input:not([type])")]
      .filter((field) => !field.closest(".vl-ui") && field.offsetParent !== null);
  }

  function updateStatus() {
    const note = document.getElementById("vl-unsaved");
    if (note) note.hidden = !dirty;
  }

  // The bar around Steam's Save and Cancel buttons sticks to the bottom.
  function stickSaveBar(save) {
    const bar = save.parentElement;
    if (!bar || bar === document.body) return;
    bar.classList.add("vl-sticky-save");
    if (!bar.querySelector("#vl-unsaved")) {
      bar.prepend(el("span", { id: "vl-unsaved", class: "vl-ui vl-unsaved", hidden: !dirty, role: "status" },
        VL.t("peUnsaved")));
    }
  }

  function addCounter(field) {
    if (field.dataset.vlCounter) return;
    field.dataset.vlCounter = "1";
    const max = Number(field.getAttribute("maxlength")) || null;
    const counter = el("div", { class: "vl-ui vl-counter", "aria-live": "polite" });
    const update = () => {
      const length = field.value.length;
      counter.textContent = max ? VL.t("peCounterMax", length, max) : VL.t("peCounter", length);
      counter.classList.toggle("vl-counter-full", Boolean(max) && length >= max);
    };
    field.addEventListener("input", update);
    field.after(counter);
    update();
  }

  // The custom URL field: its name or id mentions "customurl", or its
  // value is the name in the address of this page.
  function isCustomUrlField(field) {
    const label = ((field.name || "") + " " + (field.id || "")).toLowerCase();
    if (label.includes("customurl") || label.includes("custom_url")) return true;
    const vanity = location.pathname.match(/^\/id\/([^/]+)\//);
    return Boolean(vanity) && field.value === decodeURIComponent(vanity[1]) && field.tagName === "INPUT";
  }

  function addUrlPreview(field) {
    if (field.dataset.vlUrl) return;
    field.dataset.vlUrl = "1";
    const preview = el("div", { class: "vl-ui vl-url-preview", "aria-live": "polite" });
    const update = () => {
      const value = field.value.trim();
      preview.replaceChildren();
      if (!value) {
        preview.append(VL.t("peUrlEmpty"));
        return;
      }
      preview.append(VL.t("peUrlPreview"), " ",
        el("span", { class: "vl-url" }, "https://steamcommunity.com/id/" + value + "/"));
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(value)) {
        preview.append(el("div", { class: "vl-warn" }, VL.t("peUrlRules")));
      }
    };
    field.addEventListener("input", update);
    field.after(preview);
    update();
  }

  function enhance() {
    for (const field of editableFields()) {
      addCounter(field);
      if (isCustomUrlField(field)) addUrlPreview(field);
    }
    const save = findSaveButton();
    if (save) {
      stickSaveBar(save);
      if (save !== lastSave) {
        lastSave = save;
        save.addEventListener("click", () => {
          dirty = false;
          updateStatus();
        });
      }
    }
  }

  VL.content.runFeature("profileEdit", () => {
    // Any change typed into the page counts as unsaved until Save is clicked.
    document.addEventListener("input", (event) => {
      if (event.target.closest && event.target.closest(".vl-ui")) return;
      dirty = true;
      updateStatus();
    }, true);
    document.addEventListener("change", (event) => {
      if (event.target.closest && event.target.closest(".vl-ui")) return;
      dirty = true;
      updateStatus();
    }, true);

    window.addEventListener("beforeunload", (event) => {
      if (!dirty || !findSaveButton()) return;
      event.preventDefault();
      event.returnValue = "";
    });

    document.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      const save = findSaveButton();
      if (!save) return; // the browser's own Ctrl+S stays as it is
      event.preventDefault();
      save.click();
    });

    VL.content.watch(enhance, root());
  });
})();
