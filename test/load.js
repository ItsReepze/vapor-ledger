// Loads the extension scripts into the test's global scope, the same way
// the browser loads the scripts of one manifest entry. Texts are the
// English ones and numbers are formatted as en-US, so the tests don't
// depend on the computer's language.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");

const root = path.join(__dirname, "..");

function load(files) {
  for (const file of files) {
    vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
  }
  const VL = globalThis.VL;
  VL.messages = JSON.parse(fs.readFileSync(path.join(root, "_locales/en/messages.json"), "utf8"));
  VL.messagesLocale = "en-US";
  return VL;
}

function html(body) {
  return parseHTML("<!doctype html><html><body>" + body + "</body></html>").document;
}

function fixture(name) {
  const text = fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
  return parseHTML(text.startsWith("<!DOCTYPE") ? text : "<!doctype html><html><body>" + text + "</body></html>").document;
}

module.exports = { load, html, fixture, root };
