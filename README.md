# Vapor Ledger for Steam

A free browser extension that shows what your Steam account really looks like:
how much you spent, how much you played, what each hour cost you and how big
your pile of shame is.

No ads, no tracking, no accounts, no servers. Everything happens in your
browser and the only site the extension talks to is Steam itself.

> Vapor Ledger is a hobby project and not affiliated with Valve or Steam.

## Features (v0.1)

- **Total spent**: store purchases, gifts and in-game purchases, minus refunds
- **Spending per year**
- **Playtime** for every game and in total
- **Pile of shame**: games with less than 1 hour of playtime
- **Cost per hour** for games with a known price and for the whole account
- **Store value today**: what your library would cost in the store right now,
  with today's discounts
- Sortable and searchable games table
- **Summary image**: save your totals as a PNG to share. It is made in your
  browser and shows no Steam ID, name or game list
- Local cache, so the dashboard opens instantly next time

## Planned

- Inventory value and prices in the inventory
- Market history with profit and loss
- Quick sell and bulk sell
- Trade offer value comparison

## Install (for now)

The extension is not in the Chrome Web Store or on Firefox Add-ons yet.
To try it:

**Chrome, Edge, Brave, Opera**

1. Download this repository (Code > Download ZIP) and unzip it
2. Open `chrome://extensions`
3. Turn on "Developer mode" (top right)
4. Click "Load unpacked" and select the unzipped folder

**Firefox**

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on" and select `manifest.json`

Then open [store.steampowered.com](https://store.steampowered.com), make sure
you are logged in and click "Vapor Ledger" in the top bar.

## Where the data comes from

| Data | Source |
|---|---|
| Games and playtime | `IPlayerService/GetOwnedGames` on api.steampowered.com, using the token Steam already puts on every store page for logged in users |
| Purchase history | store.steampowered.com/account/history, the same page you see in your account |
| Store prices | `IStoreBrowseService/GetItems` on api.steampowered.com, the API the store uses for its game tiles. Only app ids and your store country are sent, no token |

The token and your data are never sent anywhere except back to Steam. The
loaded data is kept in the extension's local storage on your computer. You can
check all of this yourself: the code is plain JavaScript without a build step
and without any libraries.

## Limits

- Steam only shows one total for a cart with several games, so those games
  get no single price. The money still counts for the total.
- Games from keys, bundles or gifts have no price on Steam.
- The purchase history is read in English and German for now. Other store
  languages may show some entries as "other".

## Development

The extension has no build step. Edit the files and reload the extension.

- `src/lib/` data loading, parsing and statistics
- `src/content/` the dashboard on the Steam store page
- `src/popup/` the toolbar popup
- `test/unit.test.js` tests for the parsers and statistics
- `test/manifest.test.js` checks the manifest, the permissions and the content
  scripts
- `test/harness.html` a fake Steam page with test data, open it through any
  local web server (for example `npx serve .`) to try the dashboard without Steam

Tests and lint need Node.js 22 or newer. ESLint is the only dev dependency,
the extension itself uses no packages.

```
npm install
npm test
npm run lint
```

## License

MIT
