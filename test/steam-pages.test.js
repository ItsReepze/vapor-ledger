// Tests for the improvements on Steam's own pages, with made up copies of
// those pages in test/fixtures. Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");
const { root } = require("./load.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

// Loads a fixture as the current page and runs the content scripts of the
// manifest entry for it, like the browser does.
// mutate(document) runs first, for example to add what other extensions add.
async function openPage(fixture, pathname, scripts, settings, mutate) {
  const { window, document } = parseHTML(fs.readFileSync(path.join(__dirname, "fixtures", fixture), "utf8"));
  if (mutate) mutate(document);
  globalThis.Event = window.Event; // events the test sends to the page
  // Every page gets its own scope, like every tab in the browser.
  const sandbox = vm.createContext({
    window, document, console, setTimeout, clearTimeout,
    location: { pathname, hash: "", hostname: "example" },
    Node: window.Node, Event: window.Event, MutationObserver: window.MutationObserver,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    addEventListener: window.addEventListener.bind(window),
    chrome: { storage: { local: { get: async () => ({ settings: settings || {} }) } } },
  });
  sandbox.VL = { messages: JSON.parse(fs.readFileSync(path.join(root, "_locales/en/messages.json"), "utf8")) };
  for (const file of scripts) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
  }
  await tick();
  await tick();
  return document;
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const scriptsFor = (part) => manifest.content_scripts.find((c) => c.matches.some((m) => m.includes(part))).js;

test("profile edit: counters, URL preview, sticky save bar and unsaved note", async () => {
  const doc = await openPage("profile-edit.html", "/id/made_up_name/edit/info", scriptsFor("/edit"));
  const counters = doc.querySelectorAll(".vl-counter");
  assert.strictEqual(counters.length, 3);
  assert.strictEqual(counters[0].textContent, "7 / 32 characters");
  assert.match(doc.querySelector(".vl-url-preview").textContent, /https:\/\/steamcommunity\.com\/id\/made_up_name\//);

  const bar = doc.querySelector("[class*='SaveCancelButtons']");
  assert.ok(bar.classList.contains("vl-sticky-save"));
  const note = doc.getElementById("vl-unsaved");
  assert.strictEqual(note.hidden, true);

  const field = doc.querySelector("input[name='customURL']");
  field.value = "bad name!";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  assert.strictEqual(note.hidden, false);
  assert.match(doc.querySelector(".vl-url-preview").textContent, /3 to 32/);

  // Ctrl+S clicks Steam's own Save button, which clears the note.
  let clicked = 0;
  doc.querySelector("button[type='submit']").addEventListener("click", () => clicked++);
  const key = new Event("keydown", { bubbles: true, cancelable: true });
  Object.assign(key, { key: "s", ctrlKey: true });
  doc.dispatchEvent(key);
  assert.strictEqual(clicked, 1);
  assert.strictEqual(note.hidden, true);
});

test("profile edit does nothing when switched off", async () => {
  const doc = await openPage("profile-edit.html", "/id/made_up_name/edit/info", scriptsFor("/edit"),
    { profileEdit: false });
  assert.strictEqual(doc.querySelector(".vl-ui"), null);
  assert.strictEqual(doc.querySelector(".vl-sticky-save"), null);
});

test("profile edit falls back to the original page without a Save button", async () => {
  const original = fs.readFileSync(path.join(__dirname, "fixtures/profile-edit.html"), "utf8");
  const tmp = path.join(__dirname, "fixtures", "_no-save.tmp.html");
  fs.writeFileSync(tmp, original.replace(/<div class="profileedit_SaveCancelButtons[\s\S]*?<\/div>/, ""));
  try {
    const doc = await openPage("_no-save.tmp.html", "/id/made_up_name/edit/info", scriptsFor("/edit"));
    assert.strictEqual(doc.querySelector(".vl-sticky-save"), null);
    assert.strictEqual(doc.getElementById("vl-unsaved"), null);
  } finally {
    fs.rmSync(tmp);
  }
});

test("purchase history: search and type filter on Steam's own table", async () => {
  const doc = await openPage("history-en-usd.html", "/account/history/", scriptsFor("account/history"));
  const toolbar = doc.querySelector(".vl-toolbar");
  assert.ok(toolbar);
  assert.strictEqual(toolbar.nextElementSibling.className, "wallet_history_table");
  const visible = () => [...doc.querySelectorAll("tr.wallet_table_row")].filter((r) => !r.classList.contains("vl-hidden"));
  assert.strictEqual(visible().length, 9);
  assert.match(toolbar.querySelector(".vl-count").textContent, /9 of 9/);

  const search = toolbar.querySelector("input");
  search.value = "orbit";
  search.dispatchEvent(new Event("input"));
  assert.strictEqual(visible().length, 3);

  search.value = "";
  search.dispatchEvent(new Event("input"));
  const select = toolbar.querySelector("select");
  Object.defineProperty(select, "value", { value: "refund" }); // the test DOM has no select.value
  select.dispatchEvent(new Event("change"));
  assert.deepStrictEqual(visible().map((r) => r.querySelector(".wht_type div").textContent), ["Refund"]);

  // Steam's "Load more" button is there, so "Load all" is offered.
  assert.strictEqual(toolbar.querySelector("button").hidden, false);
});

test("licenses: search and year filter, Steam's own links untouched", async () => {
  const doc = await openPage("licenses-de.html", "/account/licenses/", scriptsFor("account/licenses"));
  const toolbar = doc.querySelector(".vl-toolbar");
  const visible = () => [...doc.querySelectorAll("table.account_table tr")]
    .filter((r) => r.querySelector("td") && !r.classList.contains("vl-hidden"));
  assert.strictEqual(visible().length, 4);
  const select = toolbar.querySelector("select");
  assert.deepStrictEqual([...select.options].map((o) => o.value), ["", "2026", "2025", "2019"]);
  Object.defineProperty(select, "value", { value: "2025" });
  select.dispatchEvent(new Event("change"));
  assert.strictEqual(visible().length, 2);
  assert.ok(doc.querySelector(".free_license_remove_link a"));
});

test("history tools stay away from other pages", async () => {
  const doc = await openPage("history-en-usd.html", "/account/", scriptsFor("account/history"));
  assert.strictEqual(doc.querySelector(".vl-toolbar"), null);
});

// ---------- Living together with other Steam extensions ----------
// The DOM below copies what Augmented Steam, the SteamDB extension, Steam
// Inventory Helper and CSFloat typically add to Steam's pages: their own
// buttons and boxes with their own class prefixes (es_, steamdb_, sih_,
// csfloat-), also buttons called "Save" outside Steam's page.

function addForeign(document, parent, html) {
  const box = document.createElement("div");
  box.className = "foreign-extension";
  // Test data from the test itself, not from Steam.
  box.append(...parseHTML("<div>" + html + "</div>").document.querySelector("div").childNodes);
  parent.append(box);
  return box;
}

test("profile edit: another extension's Save button is never clicked", async () => {
  const doc = await openPage("profile-edit.html", "/id/made_up_name/edit/info", scriptsFor("/edit"), {}, (d) => {
    addForeign(d, d.body, `<button class="es_save_settings">Save</button><csfloat-panel></csfloat-panel>`);
  });
  let ours = 0;
  let foreign = 0;
  doc.querySelector("#application_root button[type='submit']").addEventListener("click", () => ours++);
  doc.querySelector(".es_save_settings").addEventListener("click", () => foreign++);
  const key = new Event("keydown", { bubbles: true, cancelable: true });
  Object.assign(key, { key: "s", ctrlKey: true });
  doc.dispatchEvent(key);
  assert.deepStrictEqual([ours, foreign], [1, 0]);
  assert.strictEqual(doc.querySelectorAll(".vl-sticky-save").length, 1);
});

test("profile edit: elements other extensions add later don't get counters twice", async () => {
  const doc = await openPage("profile-edit.html", "/id/made_up_name/edit/info", scriptsFor("/edit"));
  const rootNode = doc.getElementById("application_root");
  for (let i = 0; i < 3; i++) addForeign(doc, rootNode, `<span class="steamdb_link">SteamDB</span>`);
  await tick();
  await tick();
  assert.strictEqual(doc.querySelectorAll(".vl-counter").length, 3);
  assert.strictEqual(doc.querySelectorAll(".vl-url-preview").length, 1);
});

test("purchase history: works next to Augmented Steam and SteamDB additions", async () => {
  const doc = await openPage("history-en-usd.html", "/account/history/", scriptsFor("account/history"), {}, (d) => {
    addForeign(d, d.querySelector(".page_content"), `<div id="es_wallet_total" class="es_box">Total spent: $1</div>`);
    for (const cell of d.querySelectorAll(".wht_items")) {
      addForeign(d, cell, `<a class="steamdb_link" href="#">SteamDB</a>`);
    }
  });
  assert.strictEqual(doc.querySelectorAll(".vl-toolbar").length, 1);
  assert.ok(doc.getElementById("es_wallet_total"), "Augmented Steam's box stays");
  const search = doc.querySelector(".vl-toolbar input");
  search.value = "lantern";
  search.dispatchEvent(new Event("input"));
  const visible = [...doc.querySelectorAll("tr.wallet_table_row")].filter((r) => !r.classList.contains("vl-hidden"));
  assert.strictEqual(visible.length, 2);
});

test("menu entry is added once and keeps other extensions' entries", async () => {
  const page = `<!DOCTYPE html><html><body><div id="account_dropdown"><div class="popup_body">
    <a class="popup_menu_item" href="#">View my profile</a>
    <a class="popup_menu_item es_menu_item" href="#">Augmented Steam</a>
    <a class="popup_menu_item" href="#">Sign out</a></div></div></body></html>`;
  const tmp = path.join(__dirname, "fixtures", "_menu.tmp.html");
  fs.writeFileSync(tmp, page);
  try {
    const doc = await openPage("_menu.tmp.html", "/", ["src/content/link.js", "src/content/link.js"]);
    const items = [...doc.querySelectorAll(".popup_menu_item")].map((a) => a.textContent);
    assert.deepStrictEqual(items, ["View my profile", "Augmented Steam", "Vapor Ledger", "Sign out"]);
    assert.strictEqual(doc.getElementById("vapor-ledger-link").getAttribute("href"),
      "https://store.steampowered.com/account/#vapor-ledger");
  } finally {
    fs.rmSync(tmp);
  }
});

test("the Vapor Ledger page keeps its styles inside its shadow root", () => {
  const page = fs.readFileSync(path.join(root, "src/ledger/page.js"), "utf8");
  assert.match(page, /attachShadow\(\{ mode: "open" \}\)/);
  assert.match(page, /shadow\.append\(VL\.el\("style"/);
  assert.doesNotMatch(page, /document\.head|document\.styleSheets/);
  // The CSS for Steam's own pages only styles our own vl- classes.
  const css = fs.readFileSync(path.join(root, "src/content/steam-tools.css"), "utf8");
  for (const [, selector] of css.matchAll(/^([^/@\s{}][^{]*)\{/gm)) {
    for (const part of selector.split(",")) assert.match(part.trim(), /^\.vl-/, part);
  }
});
