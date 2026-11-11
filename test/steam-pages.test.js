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
async function openPage(fixture, pathname, scripts, settings) {
  const { window, document } = parseHTML(fs.readFileSync(path.join(__dirname, "fixtures", fixture), "utf8"));
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
