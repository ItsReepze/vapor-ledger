// Everything that talks to Steam. All requests go to Steam's own servers
// and nowhere else.

var VL = globalThis.VL || {};
globalThis.VL = VL;

const STORE = "https://store.steampowered.com";
const API = "https://api.steampowered.com";

// Pause between "load more" requests so we don't hammer Steam.
const HISTORY_DELAY_MS = 600;

// Reads the logged in user and the web API token from the current store page.
// Steam puts this into <div id="application_config" data-userinfo="..."
// data-store_user_config="...">. The token never leaves this browser,
// it is only sent to api.steampowered.com.
VL.getSession = function () {
  const config = document.getElementById("application_config");
  if (!config) return null;
  try {
    const user = JSON.parse(config.dataset.userinfo || "{}");
    const storeConfig = JSON.parse(config.dataset.store_user_config || "{}");
    if (!user.steamid || !storeConfig.webapi_token) return null;
    return {
      steamid: user.steamid,
      token: storeConfig.webapi_token,
      country: user.country_code || "",
    };
  } catch (error) {
    console.warn("[Vapor Ledger] Could not read session info", error);
    return null;
  }
};

// The sessionid cookie is needed for POST requests to the store.
function getSessionId() {
  const match = document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Owned games with playtime, through Steam's official IPlayerService API.
VL.fetchOwnedGames = async function (session) {
  const params = new URLSearchParams({
    access_token: session.token,
    steamid: session.steamid,
    include_appinfo: "1",
    include_played_free_games: "1",
  });
  const response = await fetch(API + "/IPlayerService/GetOwnedGames/v1/?" + params);
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
function readCursor(doc) {
  for (const script of doc.querySelectorAll("script")) {
    const match = script.textContent.match(/g_historyCursor\s*=\s*(\{[^;]*\})\s*;/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (error) {
        return null;
      }
    }
  }
  return null;
}

// Loads the complete purchase history. Steam shows the first part on
// /account/history/ and the rest through the "Load more" button, which
// calls /account/AjaxLoadMoreHistory/ with a cursor. We do the same.
VL.fetchPurchaseHistory = async function (onProgress) {
  const response = await fetch(STORE + "/account/history/", { credentials: "include" });
  if (!response.ok) throw new Error("Purchase history failed: HTTP " + response.status);
  const html = await response.text();

  // DOMParser builds a document without running any of its scripts.
  const doc = new DOMParser().parseFromString(html, "text/html");
  const transactions = VL.parseHistoryRows(doc);
  let cursor = readCursor(doc);
  let page = 1;
  onProgress && onProgress(page, transactions.length);

  const sessionId = getSessionId();
  while (cursor && sessionId) {
    await VL.sleep(HISTORY_DELAY_MS);

    // Same format jQuery uses on Steam's page: cursor[key]=value
    const body = new URLSearchParams({ sessionid: sessionId });
    for (const [key, value] of Object.entries(cursor)) {
      body.append("cursor[" + key + "]", value);
    }

    const more = await fetch(STORE + "/account/AjaxLoadMoreHistory/", {
      method: "POST",
      credentials: "include",
      body,
    });
    if (!more.ok) throw new Error("Load more failed: HTTP " + more.status);
    const data = await more.json();
    if (!data.html) break;

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

  return transactions;
};
