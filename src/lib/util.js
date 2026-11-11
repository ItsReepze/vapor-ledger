// Small helpers shared by all other files.
// The extension page loads its scripts with plain <script> tags, so they
// share one global scope. Every file adds its functions to the global VL
// object instead of using imports.

var VL = globalThis.VL || {};
globalThis.VL = VL;

VL.DAY_MS = 24 * 60 * 60 * 1000;

VL.sleep = function (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Turns a Steam price string like "19,99€", "$1,234.50", "-5,--€", "¥ 1,980"
// or "1 299 pуб." into a number. Returns null if there is no number.
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

// Returns the currency part of a price string, for example "€", "$", "zł"
// or "pуб". Two amounts belong to the same currency if this is equal.
VL.parseCurrency = function (text) {
  if (!text) return "";
  return text.replace(/[\s\d.,'+\-−]/g, "");
};

// Languages of the Steam store. Their month names are taken from the
// browser's own Intl data, so no hand written lists are needed.
const DATE_LOCALES = [
  "en", "de", "fr", "it", "es", "pt", "ru", "pl", "cs", "nl", "da", "fi", "nb", "sv",
  "hu", "ro", "tr", "uk", "bg", "el", "vi", "id", "th", "ar",
];

// Short forms Steam uses that Intl does not produce.
const EXTRA_MONTH_WORDS = { mrz: 2, sept: 8, sep: 8, june: 5, july: 6 };

let monthWords = null;

// Builds a map word -> month (0-11) from all locales. Words that mean
// different months in different languages are dropped.
function buildMonthWords() {
  const found = new Map();
  const add = (word, month) => {
    if (!found.has(word)) found.set(word, new Set());
    found.get(word).add(month);
  };
  const formats = [{ month: "long" }, { month: "short" }, { day: "numeric", month: "long" },
    { day: "numeric", month: "short" }];
  for (const locale of DATE_LOCALES) {
    for (const options of formats) {
      let format;
      try {
        format = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
      } catch {
        continue;
      }
      for (let month = 0; month < 12; month++) {
        const text = format.format(new Date(Date.UTC(2021, month, 15))).toLowerCase();
        for (const word of text.match(/[\p{L}\p{M}]+/gu) || []) add(word, month);
      }
    }
  }
  const words = new Map();
  for (const [word, months] of found) {
    if (months.size === 1) words.set(word, [...months][0]);
  }
  for (const [word, month] of Object.entries(EXTRA_MONTH_WORDS)) words.set(word, month);
  return words;
}

function findMonth(words) {
  if (!monthWords) monthWords = buildMonthWords();
  for (const word of words) {
    if (monthWords.has(word)) return monthWords.get(word);
  }
  // Steam sometimes cuts names shorter or longer than Intl ("ноя" / "нояб").
  for (const word of words) {
    if (word.length < 3) continue;
    const months = new Set();
    for (const [known, month] of monthWords) {
      if (known.length >= 3 && (known.startsWith(word) || word.startsWith(known))) months.add(month);
    }
    if (months.size === 1) return [...months][0];
  }
  return null;
}

// Parses the dates of Steam's history pages in all store languages:
// "4 Nov, 2026", "Nov 4, 2026", "4. Nov. 2026", "4 нояб. 2026 г.",
// "2026年11月4日", "2026년 11월 4일", "4 thg 11, 2026".
// Returns a timestamp (UTC midnight) in milliseconds, or null.
VL.parseDate = function (text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const numbers = (lower.match(/\d+/g) || []).map(Number);
  const yearIndex = numbers.findIndex((n) => n >= 1000);
  const year = yearIndex === -1 ? new Date().getFullYear() : numbers[yearIndex];
  const rest = numbers.filter((n, i) => i !== yearIndex);

  const month = findMonth(lower.match(/[\p{L}\p{M}]+/gu) || []);
  if (month !== null) {
    const day = rest.find((n) => n >= 1 && n <= 31);
    return day ? Date.UTC(year, month, day) : null;
  }

  // Only numbers: year first means year, month, day (Chinese, Japanese,
  // Korean), otherwise day, month, year.
  if (rest.length < 2) return null;
  const [m, d] = yearIndex === 0 ? [rest[0], rest[1]] : [rest[1], rest[0]];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return Date.UTC(year, m - 1, d);
};

// Makes game names comparable: "DOOM® Eternal" and "doom eternal" become equal.
VL.normalizeName = function (name) {
  return (name || "")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
};

VL.formatMoney = function (value, currency) {
  if (value === null || value === undefined) return "-";
  const text = value.toLocaleString(VL.locale ? VL.locale() : undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? text + " " + currency : text;
};

VL.formatNumber = function (value) {
  return value.toLocaleString(VL.locale ? VL.locale() : undefined);
};

VL.formatHours = function (minutes) {
  const hours = minutes / 60;
  if (hours === 0) return "0 h";
  if (hours < 10) return hours.toLocaleString(VL.locale ? VL.locale() : undefined,
    { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " h";
  return Math.round(hours).toLocaleString(VL.locale ? VL.locale() : undefined) + " h";
};

VL.formatDate = function (timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString(VL.locale ? VL.locale() : undefined, { timeZone: "UTC" });
};

// "2026-11" -> "Nov 2026" in the language of the browser.
VL.formatMonth = function (key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(VL.locale ? VL.locale() : undefined,
    { month: "short", year: "numeric", timeZone: "UTC" });
};

VL.monthKey = function (timestamp) {
  const d = new Date(timestamp);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
};

// Creates a DOM element. We never use innerHTML with data from Steam,
// so names of games or items can never inject HTML into the page.
VL.el = function (tag, attrs, ...children) {
  const node = document.createElement(tag);
  setAttributes(node, attrs);
  appendChildren(node, children);
  return node;
};

// The same for SVG elements, used by the charts.
VL.svg = function (tag, attrs, ...children) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  setAttributes(node, attrs);
  appendChildren(node, children);
  return node;
};

function setAttributes(node, attrs) {
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.setAttribute("class", value);
    else if (key === "style") node.style.cssText = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
}

function appendChildren(node, children) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "object" ? child : String(child));
  }
}
