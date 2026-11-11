// The "Settings" tab: improvements of Steam's pages, outside price sources
// (with the user's own IsThereAnyDeal key) and deleting saved data.

var VL = globalThis.VL || {};
globalThis.VL = VL;
VL.views = VL.views || {};

VL.views.settings = function () {
  const el = VL.el;
  const pages = el("div", { class: "settings" });
  const sources = el("div", { class: "settings" });

  function row(feature, settings, extra) {
    const id = "vl-set-" + feature.key;
    return el("div", { class: "setting" },
      el("input", { type: "checkbox", id, checked: settings[feature.key],
        onchange: (e) => VL.saveSetting(feature.key, e.target.checked) }),
      el("div", {},
        el("label", { for: id },
          el("span", { class: "setting-name" }, VL.t("set_" + feature.key)),
          el("span", { class: "setting-hint" }, VL.t("set_" + feature.key + "_hint")),
          el("span", { class: "setting-pages" }, feature.pages)),
        extra || null));
  }

  // The key is kept in this browser only and sent only to IsThereAnyDeal.
  function itadKeyField(saved) {
    const input = el("input", { type: "password", autocomplete: "off", value: saved || "",
      placeholder: VL.t("itadKeyPlaceholder"), "aria-label": VL.t("itadKeyPlaceholder") });
    const note = el("span", { class: "muted", role: "status" });
    return el("div", { class: "setting-extra" }, input,
      el("button", { type: "button", onclick: async () => {
        await chrome.storage.local.set({ itadKey: input.value.trim() });
        await chrome.storage.local.remove("itad-lows");
        note.textContent = VL.t("itadKeySaved");
      } }, VL.t("itadKeySave")),
      el("a", { href: "https://docs.isthereanydeal.com/", target: "_blank", rel: "noopener noreferrer" },
        VL.t("itadKeyGet")),
      note);
  }

  Promise.all([VL.loadSettings(), chrome.storage.local.get("itadKey")]).then(([settings, stored]) => {
    pages.replaceChildren(...VL.FEATURES.filter((f) => !f.source).map((f) => row(f, settings)));
    sources.replaceChildren(...VL.FEATURES.filter((f) => f.source)
      .map((f) => row(f, settings, f.key === "itad" ? itadKeyField(stored.itadKey) : null)));
  });

  return el("div", {},
    el("h2", {}, VL.t("settingsTitle")),
    el("p", { class: "muted" }, VL.t("settingsIntro")),
    pages,
    el("p", { class: "muted" }, VL.t("settingsReload")),
    el("h2", {}, VL.t("sourcesTitle")),
    el("p", { class: "muted" }, VL.t("sourcesIntro")),
    sources,
    el("h2", {}, VL.t("deleteTitle")),
    el("p", { class: "muted" }, VL.t("deleteIntro")),
    el("button", { type: "button", class: "danger", onclick: async () => {
      if (!confirm(VL.t("deleteConfirm"))) return;
      await VL.clearAll();
      location.reload();
    } }, VL.t("deleteButton"))
  );
};
