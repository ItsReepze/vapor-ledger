# Vapor Ledger for Steam

A free browser extension that shows what your Steam account really looks like:
how much you spent, how much you played, what each hour cost you, how big
your pile of shame is, what your inventory is worth and whether the market
made you money.

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
- **Inventory value** for Steam items, Counter-Strike 2, Team Fortress 2,
  Dota 2, Rust and PUBG: market price and what you would get after fees
- **Market history with profit and loss** per item and in total
- **What Steam really cost you**: store spending minus market result minus
  what your items would bring, once the community page was opened
- Local cache, so the dashboard opens instantly next time

Nothing is ever sold, listed or traded automatically.

## Planned

- Quick sell for single items, with a confirmation for every item
- Trade offer value comparison
- Export of all data as CSV

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
you are logged in and click "Vapor Ledger" in the top bar. Inventory and
market stats open the same way on
[steamcommunity.com](https://steamcommunity.com/my/inventory/).

## Where the data comes from

| Data | Source |
|---|---|
| Games and playtime | `IPlayerService/GetOwnedGames` on api.steampowered.com, using the token Steam already puts on every store page for logged in users |
| Purchase history | store.steampowered.com/account/history, the same page you see in your account |
| Store prices | `IStoreBrowseService/GetItems` on api.steampowered.com, the API the store uses for its game tiles. Only app ids and your store country are sent, no token |
| Inventory | steamcommunity.com/inventory, the same data your inventory page loads |
| Market prices | steamcommunity.com/market/priceoverview, the price box on every market page |
| Market history | steamcommunity.com/market/myhistory, the "My market history" tab |

Steam limits how fast these pages may be asked. Vapor Ledger loads one thing
at a time with a pause in between (market prices: one every 3.5 seconds), keeps
prices for a day and stops as soon as Steam says "too many requests".

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
- The first price check of a big inventory takes a while (about 17 items per
  minute). You can stop it and continue later, prices already loaded are kept.
- Market profit or loss is sold minus bought. Items you bought and still own
  count as a cost until you sell them.

## Development

The extension has no build step. Edit the files and reload the extension.

- `src/lib/` data loading, parsing and statistics
- `src/content/` the dashboard on the Steam store and community pages
- `src/popup/` the toolbar popup
- `test/unit.test.js` and `test/community.test.js` tests for the parsers and
  statistics
- `test/manifest.test.js` checks the manifest, the permissions and the content
  scripts
- `test/harness.html` a fake Steam page with test data, open it through any
  local web server (for example `npx serve .`) to try the dashboard without Steam
- `test/harness-community.html` the same for inventory and market

Tests and lint need Node.js 22 or newer. ESLint and linkedom (a DOM for the
tests) are the only dev dependencies, the extension itself uses no packages.

```
npm install
npm test
npm run lint
```

## License

MIT
