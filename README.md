# Vapor Ledger for Steam

A free browser extension that shows what your Steam account really looks like:
how much you spent, how much you played, what each hour cost you, how big
your pile of shame is, what your inventory is worth and whether the market
made you money.

No ads, no tracking, no accounts, no servers. Everything happens in your
browser and the only site the extension talks to is Steam itself.

> Vapor Ledger is a hobby project and not affiliated with Valve or Steam.

## Features (v0.3)

Vapor Ledger opens as its own page in the browser. Click the toolbar
button or the "Vapor Ledger" link in Steam's header.

- **Overview**: total spent (store purchases, gifts and in-game purchases
  minus refunds), spending per year, playtime, pile of shame, cost per
  hour, what your library would cost in the store today, sortable and
  searchable games table
- **Refund watch**: games bought in the last 14 days with less than
  2 hours played, with the days and minutes left and a link to Steam's
  help page for that purchase. Steam decides every request, Vapor Ledger
  never asks for a refund by itself
- **Worth it?**: best and worst purchases by cost per hour, and what
  discounts saved compared with today's regular price
- **Charts**: spending per month and year, spending added up over time,
  playtime ranges, price against playtime. Plain SVG, light and dark,
  readable with the keyboard and as a table
- **Inventory and market**: inventory value for Steam items,
  Counter-Strike 2, Team Fortress 2, Dota 2, Rust and PUBG, what you would
  get after fees, market history with profit and loss, and what Steam
  really cost you
- **Recap image** for the whole account or one year. No Steam ID or name,
  game names only if you want them
- **Export** of purchases and games as CSV and of everything as JSON
- English and German, following the browser language
- Purchase history in every Steam store language. Different currencies are
  shown apart and never added up
- Local cache, so the page opens instantly next time

Nothing is ever bought, sold, listed, traded or refunded automatically.

## Planned

- Quick sell for single items, with a confirmation for every item
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

Log in on [store.steampowered.com](https://store.steampowered.com) in the
same browser, then click the Vapor Ledger button in the toolbar. For
inventory and market you also need to be logged in on
[steamcommunity.com](https://steamcommunity.com).

## Where the data comes from

| Data | Source |
|---|---|
| Who is logged in, the Web API token | the HTML of store.steampowered.com/account/history, the same values Steam puts on every store page for logged in users |
| Games and playtime | `IPlayerService/GetOwnedGames` on api.steampowered.com, with that token |
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
and without any libraries. Details in the [privacy policy](PRIVACY.md).

## Limits

- Steam only shows one total for a cart with several games, so those games
  get no single price. The money still counts for the total.
- Games from keys, bundles or gifts have no price on Steam.
- Steam doesn't say what a game's regular price was on the day you bought
  it, so savings are compared with today's regular price.
- Playtime per year is not available from Steam. The recap for one year
  shows the playtime of the games bought that year, up to today.
- Entries the parser doesn't recognize are listed under "Good to know",
  so they can be reported.
- The first price check of a big inventory takes a while (about 17 items per
  minute). You can stop it and continue later, prices already loaded are kept.
- Market profit or loss is sold minus bought. Items you bought and still own
  count as a cost until you sell them.

## Development

The extension has no build step. Edit the files and reload the extension.

- `src/lib/` data loading, parsing and statistics
- `src/app/` the extension page: tabs, tables, charts, recap image
- `src/content/link.js` the "Vapor Ledger" link in Steam's header, the only
  script that runs on Steam's pages
- `src/background.js` opens the page from the toolbar button and the link
- `_locales/` English and German texts
- `test/*.test.js` tests for parsers, statistics, pages, manifest and package
- `test/fixtures/` made up copies of Steam's purchase history in several
  languages and currencies
- `test/harness.html` the extension page with made up data instead of Steam.
  Open it through any local web server from the repository root (for example
  `npx serve .`), add `?lang=de` for German

Tests and lint need Node.js 22 or newer. ESLint and linkedom (a DOM for the
tests) are the only dev dependencies, the extension itself uses no packages.

```
npm install
npm test
npm run lint
npm run pack   # builds dist/vapor-ledger-<version>.zip for the stores
```

The ZIP contains only the manifest, the license, `_locales/`, `src/` and the PNG
icons. The
same file is uploaded to the Chrome Web Store and to Firefox Add-ons. Store
texts, review answers and screenshots are in `store/`.

## License

MIT
