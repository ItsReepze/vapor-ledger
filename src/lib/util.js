// Small helpers shared by all other files.
// Content scripts in an extension share one isolated scope, so every file
// adds its functions to the global VL object instead of using imports.

var VL = globalThis.VL || {};
globalThis.VL = VL;

VL.sleep = function (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Turns a Steam price string like "19,99€", "$1,234.50", "-5,--€" or "+0.30 USD"
// into a number. Returns null if there is no number in the text.
VL.parseAmount = function (text) {
  if (!text) return null;
  // \s also covers the no-break spaces Steam uses in prices ("1 234,50 €").
  const clean = text.replace(/\s/g, "");
  const match = clean.match(/([+-]?)[^\d+-]*(\d[\d.,']*)/);
  if (!match) return null;

  // "19,--" means 19.00, so we drop trailing separators.
  const digits = match[2].replace(/[.,']+$/, "");

  // The last separator is the decimal point if it has 1 or 2 digits after it.
  // Otherwise it is a thousands separator ("1.234" in German means 1234).
  const lastSep = Math.max(digits.lastIndexOf("."), digits.lastIndexOf(","));
  let value;
  if (lastSep !== -1 && digits.length - lastSep - 1 <= 2) {
    const whole = digits.slice(0, lastSep).replace(/[.,']/g, "");
    value = Number(whole + "." + digits.slice(lastSep + 1));
  } else {
    value = Number(digits.replace(/[.,']/g, ""));
  }

  if (!Number.isFinite(value)) return null;
  return match[1] === "-" ? -value : value;
};

// Returns the currency part of a price string, for example "€" or "$".
VL.parseCurrency = function (text) {
  if (!text) return "";
  return text.replace(/[\s\d.,'+-]/g, "");
};

// Month names in English and German. Only the first three letters are used.
const MONTHS = {
  jan: 0, feb: 1, mar: 2, "mär": 2, mrz: 2, apr: 3, may: 4, mai: 4,
  jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, dez: 11,
};

// Parses dates like "4 Nov, 2026", "Nov 4, 2026" or "4. Nov. 2026".
// Returns a timestamp in milliseconds, or null.
VL.parseDate = function (text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const words = lower.match(/[a-zäöü]+/g) || [];
  const monthWord = words.map((w) => w.slice(0, 3)).find((w) => w in MONTHS);
  const numbers = (lower.match(/\d+/g) || []).map(Number);
  const year = numbers.find((n) => n >= 1000) ?? new Date().getFullYear();
  const day = numbers.find((n) => n >= 1 && n <= 31);
  if (monthWord === undefined || !day) return null;
  return Date.UTC(year, MONTHS[monthWord], day);
};

// Makes game names comparable: "DOOM® Eternal" and "doom eternal" become equal.
VL.normalizeName = function (name) {
  return (name || "")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .trim();
};

VL.formatMoney = function (value, currency) {
  if (value === null || value === undefined) return "-";
  const text = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? text + " " + currency : text;
};

VL.formatHours = function (minutes) {
  const hours = minutes / 60;
  if (hours === 0) return "0 h";
  if (hours < 10) return hours.toFixed(1) + " h";
  return Math.round(hours).toLocaleString() + " h";
};

VL.formatDate = function (timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString();
};

// Creates a DOM element. We never use innerHTML with data from Steam,
// so names of games or items can never inject HTML into the page.
VL.el = function (tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key === "class") node.className = value;
    else if (key === "style") node.style.cssText = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
};
