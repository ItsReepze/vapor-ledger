// Parses the rows of the purchase history table from
// https://store.steampowered.com/account/history/
//
// Every row has these cells (class names from Steam's page):
//   .wht_date            date of the transaction
//   .wht_items           one div per item, plus the payment method
//   .wht_type            "Purchase", "Refund", "Gift Purchase", ...
//   .wht_total           total amount
//   .wht_wallet_change   change of the Steam wallet balance
// The row itself links to Steam's help page for that transaction
// (onclick with "transid=...").
//
// The type is read from the structure first (links, amounts, the item
// cell) and only then from the words in the type cell. The word lists
// cover all Steam store languages.

var VL = globalThis.VL || {};
globalThis.VL = VL;

// Words for the transaction type in all Steam store languages, lower case.
// The order matters: "Gift Purchase" must be checked before "Purchase".
const TYPE_RULES = [
  { type: "refund", words: [
    "refund", "rückerstatt", "erstattung", "rembours", "rimbors", "reembols", "возмещ", "возврат",
    "zwrot", "refundac", "vrácen", "terugbetal", "refunder", "tilbagebetal", "refusjon", "återbetal",
    "hyvity", "palautus", "visszatérít", "rambursa", "iade", "відшкод", "повернен", "възстанов",
    "επιστροφ", "返金", "환불", "退款", "คืนเงิน", "hoàn tiền", "pengembalian", "استرداد",
  ] },
  { type: "market", words: [
    "market", "markt", "marché", "mercato", "mercado", "торгов", "rynk", "tržiš", "markeds",
    "marknad", "kauppapaik", "piac", "piaț", "piat", "pazar", "майданчик", "пазар", "κοινότητ",
    "マーケット", "장터", "市场", "市集", "市場", "ตลาด", "chợ", "thị trường", "pasar", "السوق",
  ] },
  { type: "ingame", words: [
    "in-game", "in game", "ingame", "spielintern", "en jeu", "nel gioco", "in-gioco", "en el juego",
    "dentro del juego", "no jogo", "dentro do jogo", "в игре", "внутриигров", "w grze", "ve hře",
    "i spil", "i spillet", "i spelet", "pelinsisäi", "játékon belül", "în joc", "oyun içi", "у грі",
    "внутрішньоігров", "в играта", "εντός παιχνιδιού", "ゲーム内", "게임 내", "游戏内", "遊戲內",
    "ในเกม", "trong trò chơi", "trong game", "dalam game", "dalam permainan", "داخل اللعبة",
  ] },
  { type: "gift", words: [
    "gift", "geschenk", "cadeau", "regalo", "presente", "oferta", "подар", "prezent", "dárek",
    "dárku", "gave", "gåva", "lahja", "ajándék", "cadou", "hediye", "подарун", "подарък", "δώρο",
    "ギフト", "선물", "礼物", "禮物", "ของขวัญ", "quà", "hadiah", "هدية",
  ] },
  { type: "purchase", words: [
    "purchase", "kauf", "achat", "acquisto", "compra", "покупк", "zakup", "nákup", "aankoop",
    "køb", "kjøp", "köp", "osto", "vásárlás", "achiziți", "cumpăr", "satın", "αγορ", "購入",
    "구매", "购买", "購買", "ซื้อ", "mua", "pembelian", "شراء",
  ] },
];

// Words for Steam wallet top-ups in the item cell.
const WALLET_WORDS = [
  "wallet", "guthaben", "porte-monnaie", "portafoglio", "monedero", "cartera", "carteira",
  "кошел", "portfel", "peněžen", "portemonnee", "tegnebog", "lommebok", "plånbok", "lompakko",
  "pénztárc", "portofel", "cüzdan", "гаманц", "портфейл", "πορτοφόλι", "ウォレット", "지갑",
  "钱包", "錢包", "กระเป๋าเงิน", "ví steam", "dompet", "المحفظة",
];

// Short Latin words like "osto" or "mua" must start a word, so they don't
// match inside longer words. Other scripts are matched as they are.
function hasWord(text, word) {
  if (word.length > 4 || !/^[a-z]+$/.test(word)) return text.includes(word);
  return new RegExp("(^|[^\\p{L}])" + word, "u").test(text);
}

// Lower case without the dot that "İ" (Turkish) leaves behind.
function lowerText(text) {
  return text.toLowerCase().replace(/̇/g, "");
}

function cellText(row, selector) {
  const cell = row.querySelector(selector);
  return cell ? cell.textContent.replace(/\s+/g, " ").trim() : "";
}

// The type cell also contains the payment method ("Purchase Klarna",
// "Purchase 8,18€ Wallet 61,81€ Klarna"). We remove the payment part, so a
// payment method like "Geschenkkarte" can't be mistaken for a gift.
function readType(row) {
  const cell = row.querySelector(".wht_type");
  if (!cell) return "";
  const copy = cell.cloneNode(true);
  copy.querySelectorAll("[class*='payment']").forEach((node) => node.remove());
  return copy.textContent.replace(/\s+/g, " ").trim();
}

// Reads item names, one div per item.
function readItems(row) {
  const cell = row.querySelector(".wht_items");
  if (!cell) return [];
  const names = [];
  for (const div of cell.querySelectorAll(":scope > div")) {
    if (String(div.className).includes("payment")) continue;
    const text = div.textContent.replace(/\s+/g, " ").trim();
    if (text) names.push(text);
  }
  return names;
}

// The help link of the row: transid and whether it points to the market.
function readLink(row) {
  const target = (row.getAttribute("onclick") || "") + " "
    + [...row.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).join(" ");
  const transid = target.match(/transid=(\d+)/);
  return {
    transid: transid ? transid[1] : null,
    market: /steamcommunity\.com\/market/.test(target),
  };
}

function typeFromWords(typeText) {
  const lower = lowerText(typeText);
  for (const rule of TYPE_RULES) {
    if (rule.words.some((w) => hasWord(lower, w))) return rule.type;
  }
  return "other";
}

// A wallet top-up has a single item whose name contains its own amount
// with the currency ("10,00€ Wallet Credit"), or a wallet word in the item.
function isWalletTopUp(items, total, currency) {
  if (items.length !== 1) return false;
  const text = lowerText(items[0]);
  const amount = VL.parseAmount(items[0]);
  if (amount !== null && total !== null && currency && items[0].includes(currency)
    && Math.abs(Math.abs(amount) - Math.abs(total)) < 0.005) return true;
  return WALLET_WORDS.some((w) => text.includes(w));
}

VL.classifyTransaction = function (parts) {
  if (parts.link && parts.link.market) return "market";
  let type = typeFromWords(parts.typeText);
  if ((type === "purchase" || type === "other") && isWalletTopUp(parts.items, parts.total, parts.currency)) type = "wallet";
  return type;
};

// Takes a document or element and returns a list of transactions.
VL.parseHistoryRows = function (root) {
  const transactions = [];
  for (const row of root.querySelectorAll("tr.wallet_table_row")) {
    const dateText = cellText(row, ".wht_date");
    const typeText = readType(row);
    const totalText = cellText(row, ".wht_total");
    const walletText = cellText(row, ".wht_wallet_change");
    const items = readItems(row);
    const link = readLink(row);

    const total = VL.parseAmount(totalText);
    const walletChange = VL.parseAmount(walletText);
    const currency = VL.parseCurrency(totalText || walletText);

    transactions.push({
      date: VL.parseDate(dateText),
      type: VL.classifyTransaction({ typeText, items, total, currency, link }),
      typeText,
      items,
      // We store the amount as a positive number, the type says what it means.
      amount: Math.abs(total ?? walletChange ?? 0),
      walletChange,
      currency,
      transid: link.transid,
    });
  }
  return transactions;
};
