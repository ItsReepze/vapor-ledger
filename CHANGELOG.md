# Changelog

## 0.3.0 (2026-11-11)

- Own extension page instead of an overlay on Steam. It opens from the
  toolbar button or the "Vapor Ledger" link in Steam's header, the only
  script left on Steam's pages
- Refund watch: games bought in the last 14 days with less than 2 hours
  played, with days and minutes left and a link to Steam's help page
- Worth it: best and worst purchases by cost per hour, savings from
  discounts compared with today's regular price
- Charts without a library: spending per month and year, added up over
  time, playtime ranges, price against playtime. Light and dark mode,
  keyboard and table access, tooltips
- Recap image for the whole account or one year, game names optional
- Export as CSV (purchases, games) and JSON
- Interface in English and German
- Purchase history in all Steam store languages, dates through the
  browser's month names, types read from the row structure first
- Different currencies are kept apart and never added up
- Delete all saved data from the page
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
