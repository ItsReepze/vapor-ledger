// Everything that talks to the Steam store and Steam's Web API. All requests
// go to Steam's own servers and nowhere else.
//
// The Vapor Ledger page runs on the store, so it loads the purchase history
// page from store.steampowered.com with the user's Steam login, like the
// store itself. The logged in user, the Web API token and the session id
// are read from that page's HTML. Nothing in it is executed.

var VL = globalThis.VL || {};
globalThis.VL = VL;

const STORE = "https://store.steampowered.com";
const API = "https://api.steampowered.com";

// Pause between "load more" requests so we don't hammer Steam.
const HISTORY_DELAY_MS = 600;

VL.NotLoggedInError = class extends Error {
  constructor() {
    super("not logged in");
    this.notLoggedIn = true;
  }
};

// Reads the session from a store page. Steam puts the user and the token
// into <div id="application_config" data-userinfo="..."
// data-store_user_config="..."> and the session id into an inline script
// ("g_sessionID = ..."). The token never leaves this browser, it is only
// sent to api.steampowered.com.
VL.readStoreSession = function (doc) {
  const config = doc.getElementById("application_config");
  if (!config) return null;
  let user;
  let storeConfig;
  try {
    user = JSON.parse(config.getAttribute("data-userinfo") || "{}");
    storeConfig = JSON.parse(config.getAttribute("data-store_user_config") || "{}");
  } catch {
    return null;
  }
  if (!user.steamid || !storeConfig.webapi_token) return null;
  let sessionId = null;
  for (const script of doc.querySelectorAll("script:not([src])")) {
    const match = script.textContent.match(/g_sessionID\s*=\s*"([^"]+)"/);
    if (match) {
      sessionId = match[1];
      break;
    }
  }
  return {
    steamid: String(user.steamid),
    token: storeConfig.webapi_token,
    country: user.country_code || "",
    sessionId,
  };
};

// Owned games with playtime, through Steam's official IPlayerService API.
VL.fetchOwnedGames = async function (session) {
  const params = new URLSearchParams({
    access_token: session.token,
    steamid: session.steamid,
    include_appinfo: "1",
    include_played_free_games: "1",
  });
  const response = await VL.request(API + "/IPlayerService/GetOwnedGames/v1/?" + params);
  if (!response.ok) throw new Error("GetOwnedGames failed: HTTP " + response.status);
  const data = await response.json();
  const games = (data.response && data.response.games) || [];
  return games.map((game) => ({
    appid: game.appid,
    name: game.name || "App " + game.appid,
    minutes: game.playtime_forever || 0,
    lastPlayed: game.rtime_last_played ? game.rtime_last_played * 1000 : null,
  }));
};

// Finds "g_historyCursor = {...};" in the scripts of the history page.
VL.readHistoryCursor = function (doc) {
  for (const script of doc.querySelectorAll("script")) {
    const match = script.textContent.match(/g_historyCursor\s*=\s*(\{[^;]*\})\s*;/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
  }
  return null;
};

// Loads the first page of the purchase history. It also tells us who is
// logged in. Throws NotLoggedInError if Steam shows the login page instead.
VL.openHistoryPage = async function () {
  const response = await VL.request(STORE + "/account/history/");
  if (!response.ok) throw new Error("Purchase history failed: HTTP " + response.status);
  // DOMParser builds a document without running any of its scripts.
  const doc = new DOMParser().parseFromString(await response.text(), "text/html");
  const session = VL.readStoreSession(doc);
  if (!session) throw new VL.NotLoggedInError();
  return { doc, session };
};

// Loads the rest of the purchase history. Steam shows the first part on
// /account/history/ and the rest through the "Load more" button, which
// calls /account/AjaxLoadMoreHistory/ with a cursor. We do the same.
// Returns { transactions, complete }.
VL.fetchPurchaseHistory = async function (first, onProgress) {
  const transactions = VL.parseHistoryRows(first.doc);
  let cursor = VL.readHistoryCursor(first.doc);
  let page = 1;
  onProgress && onProgress(page, transactions.length);

  while (cursor && first.session.sessionId) {
    await VL.sleep(HISTORY_DELAY_MS);

    // Same format jQuery uses on Steam's page: cursor[key]=value
    const body = new URLSearchParams({ sessionid: first.session.sessionId });
    for (const [key, value] of Object.entries(cursor)) {
      body.append("cursor[" + key + "]", value);
    }

    const more = await VL.request(STORE + "/account/AjaxLoadMoreHistory/", {
      method: "POST",
      body: body.toString(),
      contentType: "application/x-www-form-urlencoded; charset=UTF-8",
    });
    if (!more.ok) return { transactions, complete: false };
    const data = await more.json().catch(() => null);
    if (!data || !data.html) return { transactions, complete: !data ? false : !data.cursor };

    // The answer contains only <tr> elements, they need a table around them.
    const part = new DOMParser().parseFromString(
      "<table><tbody>" + data.html + "</tbody></table>",
      "text/html"
    );
    transactions.push(...VL.parseHistoryRows(part));
    cursor = data.cursor || null;
    page++;
    onProgress && onProgress(page, transactions.length);
  }

  return { transactions, complete: !cursor };
};
