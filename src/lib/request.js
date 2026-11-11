// The one place where Vapor Ledger asks a server for something.
//
// The Vapor Ledger page runs inside store.steampowered.com. Requests to
// the store itself go out directly, with the user's login, like the
// store's own scripts do. Requests to the other allowed hosts
// (api.steampowered.com, steamcommunity.com and price services the user
// switched on) are passed to the extension's background script, because a
// page may not read answers from other sites. The background script only
// accepts the hosts in VL.ALLOWED_HOSTS.

var VL = globalThis.VL || {};
globalThis.VL = VL;

VL.ALLOWED_HOSTS = [
  "store.steampowered.com",
  "api.steampowered.com",
  "steamcommunity.com",
  "api.isthereanydeal.com",
];

// Hosts that get the user's Steam login (cookies). Everything else is
// asked without any cookies.
VL.LOGIN_HOSTS = ["store.steampowered.com", "steamcommunity.com"];

// options: { method, body (string), contentType }
// Returns { ok, status, text(), json() } like fetch.
VL.request = async function (url, options) {
  const opts = options || {};
  const target = new URL(url);
  if (!VL.ALLOWED_HOSTS.includes(target.hostname)) throw new Error("Host not allowed: " + target.hostname);

  const sameSite = globalThis.location && location.hostname === target.hostname;
  const viaBackground = !sameSite && globalThis.chrome && chrome.runtime && chrome.runtime.sendMessage;
  if (!viaBackground) return fetch(url, VL.fetchOptions(target, opts));

  const answer = await chrome.runtime.sendMessage({ type: "request", url, method: opts.method,
    body: opts.body, contentType: opts.contentType });
  if (!answer || answer.error) throw new Error((answer && answer.error) || "No answer from the extension");
  return {
    ok: answer.status >= 200 && answer.status < 300,
    status: answer.status,
    text: async () => answer.text,
    json: async () => JSON.parse(answer.text),
  };
};

// The fetch options for a request, used here and by the background script.
VL.fetchOptions = function (target, opts) {
  const headers = opts.contentType ? { "Content-Type": opts.contentType } : undefined;
  return {
    method: opts.method || "GET",
    body: opts.body,
    headers,
    credentials: VL.LOGIN_HOSTS.includes(target.hostname) ? "include" : "omit",
  };
};
