# Vapor Ledger for Steam

A free browser extension that shows what your Steam account really looks like:
how much you spent, how much you played, what each hour cost you, how big
your pile of shame is, what your inventory is worth and whether the market
made you money.

No ads, no tracking, no accounts, no servers. Everything happens in your
browser. The extension talks to Steam, and to IsThereAnyDeal only if you
switch that on.

> Vapor Ledger is a hobby project and not affiliated with Valve or Steam.

## Features (v0.4)

Vapor Ledger is a page inside the Steam store, with Steam's own header,
navigation and footer: [store.steampowered.com/account/#vapor-ledger](https://store.steampowered.com/account/#vapor-ledger).
Open it from your account menu (under your name at the top of Steam) or
with the toolbar button.

At the top are the key numbers: total spent, playtime, spent per hour and
pile of shame. Below are tabs, each with the details behind "Show more":

- **Overview**: what needs attention, like games you can still refund,
  this year's spending, your best and worst purchase
- **Spending**: store purchases, gifts, in-game purchases and refunds,
  spending per year and month, added up over time, other currencies shown
  apart, what discounts saved compared with today's regular price
- **Games**: best and worst purchases by cost per hour, sortable and
  searchable games table, playtime charts
- **Refundable**: games bought in the last 14 days with less than 2 hours
  played, with the days and minutes left and a link to Steam's help page.
  Steam decides every request, Vapor Ledger never asks for a refund itself
- **Inventory and market**: inventory value for Steam items,
  Counter-Strike 2, Team Fortress 2, Dota 2, Rust and PUBG, what you would
  get after fees, market history with profit and loss, and what Steam
  really cost you
- **Recap**: an image for the whole account or one year (no Steam ID or
  name, game names only if you want them), export as CSV and JSON
- **Settings**: switch each part off, optional price sources

Charts are plain SVG, readable with the keyboard and as a table. Purchase
history works in every Steam store language, different currencies are
never added up. Interface in English and German.

### Optional price sources

Off until you switch them on in the settings:

- **IsThereAnyDeal**: the lowest price each game ever had, through
  IsThereAnyDeal's official API. You need your own free API key from
  IsThereAnyDeal; enter it in the settings, it stays in your browser. Only
  Steam app ids and your store country are sent.
- **SteamDB**: only links next to each game. SteamDB has no public API, so
  nothing is loaded from it.
### Better Steam pages

Vapor Ledger also makes some of Steam's own pages easier to use. It only
changes how they look and work in your browser, saving still goes through
Steam's own buttons and forms. Every part can be switched off on the
"Settings" tab, and if Steam changes a page, the original page stays. The
additions use their own `vl-` classes and a shadow root, so they work next to
Augmented Steam, the SteamDB extension, Steam Inventory Helper and CSFloat.

- **Profile edit**: Steam's Save bar stays in view while you scroll and
  shows when there are unsaved changes, Ctrl+S saves with Steam's own
  button, a warning before leaving with unsaved changes, character
  counters, a preview of your custom URL
- **Purchase history**: search, filter by type, and "Load all", which
  clicks Steam's own "Load more" button for you, one page at a time
- **Licenses**: search and filter by year

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
same browser, then choose "Vapor Ledger" in your account menu or click the
toolbar button. For inventory and market you also need to be logged in on
[steamcommunity.com](https://steamcommunity.com).

## Where the data comes from

| Data | Source |
|---|---|
| Who is logged in, the Web API token | the store page itself and store.steampowered.com/account/history, the same values Steam puts on every store page for logged in users |
| Games and playtime | `IPlayerService/GetOwnedGames` on api.steampowered.com, with that token |
| Purchase history | store.steampowered.com/account/history, the same page you see in your account |
| Store prices | `IStoreBrowseService/GetItems` on api.steampowered.com, the API the store uses for its game tiles. Only app ids and your store country are sent, no token |
| Inventory | steamcommunity.com/inventory, the same data your inventory page loads |
| Market prices | steamcommunity.com/market/search/render for all community items of one game at once, steamcommunity.com/market/priceoverview for other items |
| Market history | steamcommunity.com/market/myhistory, the "My market history" tab, 500 rows per request |
| Lowest prices (optional) | api.isthereanydeal.com, only if switched on, with your own key |

Steam limits how fast these pages may be asked. Vapor Ledger loads one thing
at a time with a pause in between (market prices: one request every 3.5
seconds), asks for all cards, backgrounds and emoticons of a game in one
request, keeps prices for a day and stops as soon as Steam says "too many
requests". Saved data shows at once, the rest fills in while it loads.

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
- The first price check of a big inventory takes a while: Steam community
  items go fast (one request per game), other items about 17 per minute. You
  can stop it and continue later, prices already loaded are kept.
- The IsThereAnyDeal low is in the currency IsThereAnyDeal uses for your
  country, it is shown as it is and not compared with what you paid.
- Market profit or loss is sold minus bought. Items you bought and still own
  count as a cost until you sell them.

## Development

The extension has no build step. Edit the files and reload the extension.

- `src/lib/` data loading, parsing, statistics, settings and
  `request.js`, the one place that talks to servers
- `src/ledger/` the Vapor Ledger page inside the store: tabs, tables, charts,
  recap image, styles (in a shadow root)
- `src/content/link.js` the account menu entry, the only script that runs on
  every Steam page
- `src/content/profile-edit.js`, `history-tools.js`, `licenses-tools.js` the
  improvements of Steam's own pages, only loaded on those pages, with
  `common.js` and `steam-tools.css`
- `src/background.js` the toolbar button, and passes requests of the page
  to api.steampowered.com, steamcommunity.com and IsThereAnyDeal
- `_locales/` English and German texts
- `test/*.test.js` tests for parsers, statistics, pages, manifest and package
- `test/fixtures/` made up copies of Steam's pages (purchase history in
  several languages and currencies, licenses, profile edit)
- `test/market-speed.test.js` counts requests and waiting time of the market
  tab for a typical made up inventory
- `test/harness.html` a copy of Steam's account page with the Vapor Ledger
  page and made up data instead of Steam.
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

The ZIP contains only the manifest, the license, `_locales/`, `src/` and the
PNG icons. The same file is uploaded to the Chrome Web Store and to Firefox Add-ons. Store
texts, review answers and screenshots are in `store/`.

## License

MIT
