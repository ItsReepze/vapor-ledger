// Parses the rows of the purchase history table from
// https://store.steampowered.com/account/history/
//
// Every row has these cells (class names from Steam's page):
//   .wht_date            date of the transaction
//   .wht_items           one div per item, plus the payment method
//   .wht_type            "Purchase", "Refund", "Gift Purchase", ...
//   .wht_total           total amount
//   .wht_wallet_change   change of the Steam wallet balance

var VL = globalThis.VL || {};
globalThis.VL = VL;

// Keywords for the transaction type, in English and German.
// The order matters: "Gift Purchase" must be checked before "Purchase".
const TYPE_RULES = [
  { type: "refund", words: ["refund", "rückerstatt", "erstattung"] },
  { type: "market", words: ["market", "markt"] },
  { type: "ingame", words: ["in-game", "in game", "ingame"] },
  { type: "gift", words: ["gift", "geschenk"] },
  { type: "purchase", words: ["purchase", "kauf"] },
];

// Items that are Steam wallet top-ups, not games.
const WALLET_WORDS = ["wallet", "guthaben"];

function cellText(row, selector) {
  const cell = row.querySelector(selector);
  return cell ? cell.textContent.replace(/\s+/g, " ").trim() : "";
}

function classify(typeText, items) {
  const lowerType = typeText.toLowerCase();
  let type = "other";
  for (const rule of TYPE_RULES) {
    if (rule.words.some((w) => lowerType.includes(w))) {
      type = rule.type;
      break;
    }
  }
  const allItems = items.join(" ").toLowerCase();
  if (type === "purchase" && WALLET_WORDS.some((w) => allItems.includes(w))) {
    type = "wallet";
  }
  return type;
}

// Reads item names. The payment method also sits in this cell
// (class wth_payment), so we skip it.
function readItems(row) {
  const cell = row.querySelector(".wht_items");
  if (!cell) return [];
  const names = [];
  for (const div of cell.querySelectorAll(":scope > div")) {
    if (div.className.includes("payment")) continue;
    const text = div.textContent.replace(/\s+/g, " ").trim();
    if (text) names.push(text);
  }
  return names;
}

// Takes a document or element and returns a list of transactions.
VL.parseHistoryRows = function (root) {
  const transactions = [];
  for (const row of root.querySelectorAll("tr.wallet_table_row")) {
    const dateText = cellText(row, ".wht_date");
    const typeText = cellText(row, ".wht_type");
    const totalText = cellText(row, ".wht_total");
    const walletText = cellText(row, ".wht_wallet_change");
    const items = readItems(row);

    const total = VL.parseAmount(totalText);
    const walletChange = VL.parseAmount(walletText);

    transactions.push({
      date: VL.parseDate(dateText),
      type: classify(typeText, items),
      typeText,
      items,
      // We store the amount as a positive number, the type says what it means.
      amount: Math.abs(total ?? walletChange ?? 0),
      walletChange,
      currency: VL.parseCurrency(totalText || walletText),
    });
  }
  return transactions;
};
