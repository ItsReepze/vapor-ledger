# Changelog

## 0.4.0 (2026-11-11)

- Vapor Ledger is now a page inside the Steam store
  (store.steampowered.com/account/#vapor-ledger) with Steam's header,
  navigation and footer, opened from the account menu or the toolbar
  button. The separate extension page is gone
- New layout: the key numbers on top, then tabs Overview, Spending, Games,
  Refundable, Inventory and market, Recap and Settings, details behind
  "Show more"
- Current Steam look for the page and for the improved Steam pages
- Inventory and market load much faster: cards, backgrounds and emoticons
  of a game in one request, market history in pages of 500, saved data
  shows at once, only missing or old prices are asked again. For a
  typical inventory 85 instead of 260 price requests
- Optional price sources: lowest price ever from IsThereAnyDeal (own API
  key, off by default) and links to SteamDB
- All requests go through one place; requests to other hosts than the
  store are passed on by the background script
- Works next to Augmented Steam, the SteamDB extension, Steam Inventory
  Helper and CSFloat: own vl- classes, shadow root, watchers limited to
  Steam's page part
- New host permission: api.isthereanydeal.com

## 0.3.0 (2026-11-11)

- Own extension page instead of an overlay on Steam. It opens from the
  toolbar button or the "Vapor Ledger" link in Steam's header
- Refund watch: games bought in the last 14 days with less than 2 hours
  played, with days and minutes left and a link to Steam's help page
- Worth it: best and worst purchases by cost per hour, savings from
  discounts compared with today's regular price
- Charts without a library: spending per month and year, added up over
  time, playtime ranges, price against playtime. Keyboard and table
  access, tooltips
- Recap image for the whole account or one year, game names optional
- Export as CSV (purchases, games) and JSON
- Interface in English and German
- Purchase history in all Steam store languages, dates through the
  browser's month names, types read from the row structure first
- Different currencies are kept apart and never added up
- Delete all saved data from the page
- The page uses Steam's own look: colors, fonts, buttons and spacing.
  Steam has no light mode, so the page has none either
- Better Steam pages, each part can be switched off on the new Settings
  tab: profile edit (Save bar stays in view, Ctrl+S, warning before
  leaving with unsaved changes, character counters, custom URL preview),
  search, type filter and "Load all" in the purchase history, search and
  year filter in the licenses. Steam's own buttons and forms do the saving
- New host permission for steamcommunity.com, because inventory and
  market now load from the extension page. The toolbar popup is gone
- Tests with made up Steam pages in many languages and currencies

## 0.2.0 (2026-11-07)

- Store value today: current store price of every owned game, with
  discounts, as a tile and a table column
- Spent per hour for the whole account
- Save summary image: a PNG with your totals, made in the browser
- Tests for the manifest and permissions, ESLint setup
- Inventory value on steamcommunity.com: market price and value after fees
  for Steam, CS2, TF2, Dota 2, Rust and PUBG items, rate limited, prices
  cached for a day
- Market history with profit and loss per item and in total
- "What Steam really cost you" tile on the store dashboard
- Search and sorting stay while market prices load
- Privacy policy, store texts and "npm run pack" to build the store ZIP
- Firefox 140 or newer

## 0.1.0 (2026-11-04)

- First version of the library dashboard: total spent, spending per year,
  playtime, pile of shame, cost per hour, sortable games table, local cache
