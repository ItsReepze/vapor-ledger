// Texts of the interface in the language of the browser. The texts live in
// _locales/<language>/messages.json (English and German for now) and are
// read through chrome.i18n. Placeholders are written as {0}, {1}, ...

var VL = globalThis.VL || {};
globalThis.VL = VL;

// Tests and the test page set VL.messages to the parsed messages.json.
VL.messages = VL.messages || null;

VL.t = function (key, ...args) {
  let text = "";
  if (VL.messages) {
    text = VL.messages[key] ? VL.messages[key].message : "";
  } else if (globalThis.chrome && chrome.i18n) {
    text = chrome.i18n.getMessage(key);
  }
  if (!text) text = key;
  return text.replace(/\{(\d)\}/g, (match, index) => (args[index] === undefined ? "" : String(args[index])));
};

// Language for numbers and dates, the same one the texts use.
VL.locale = function () {
  if (VL.messagesLocale) return VL.messagesLocale;
  if (globalThis.chrome && chrome.i18n && chrome.i18n.getUILanguage) return chrome.i18n.getUILanguage();
  return undefined;
};
