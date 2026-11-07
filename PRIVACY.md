# Privacy Policy for Vapor Ledger

Last updated: November 7, 2026

Vapor Ledger is a free browser extension that shows statistics about your own
Steam account. It is made by an individual developer (ItsReepze) and is not
affiliated with Valve or Steam.

## Short version

- Vapor Ledger does not collect, sell or share any data.
- There is no Vapor Ledger server. The extension only talks to Steam.
- Everything it loads is stored in your browser and nowhere else.
- No analytics, no tracking, no ads, no third party services.

## What the extension reads

When you open the Vapor Ledger dashboard on a Steam page, the extension loads
the following data from Steam, using the login you already have in your
browser:

| Data | Where it comes from |
|---|---|
| Your Steam ID and the access token Steam puts on its own store pages | the Steam page you have open |
| Your games and playtime | api.steampowered.com (IPlayerService/GetOwnedGames) |
| Your purchase history | store.steampowered.com/account/history |
| Current store prices of your games | api.steampowered.com (IStoreBrowseService/GetItems) |
| Your inventory | steamcommunity.com/inventory |
| Market prices of your items | steamcommunity.com/market/priceoverview |
| Your market history | steamcommunity.com/market/myhistory |

This data is only loaded when you open the dashboard or click Refresh.

## Where the data goes

- The data is sent from Steam to your browser and is used to calculate the
  numbers on the dashboard.
- The results are saved in the extension's local storage
  (`chrome.storage.local`) on your computer, so the dashboard opens quickly
  next time. This storage is not synced to other devices.
- The access token is only ever sent back to api.steampowered.com. It is
  never stored by the extension.
- Nothing is sent to the developer or to anyone other than Steam.

## The summary image

The "Save summary image" button creates a PNG file in your browser and saves
it to your computer. It contains only totals (money spent, playtime, number
of games and similar), no Steam ID, no account name and no game list. Nothing
is uploaded. If you share the image, you decide where.

## What the extension never does

- It never buys, sells, lists or trades anything on your behalf.
- It never changes your Steam account or settings.
- It never reads pages other than Steam's.
- It never loads code from the internet. All code is part of the extension
  package and is public on GitHub.

## Deleting your data

Click Refresh to replace the saved data, or remove the extension. Removing the
extension deletes everything it stored. You can also clear it through your
browser's extension settings.

## Permissions

| Permission | Why |
|---|---|
| `storage` | to keep the loaded data in your browser, so the dashboard opens instantly |
| store.steampowered.com, steamcommunity.com | to show the dashboard on these Steam pages and read your data from them |
| api.steampowered.com | to read your games, playtime and current store prices from Steam's official API |

## Children

Vapor Ledger is not directed at children and does not knowingly process data
of children. It only shows data that Steam already shows to the logged in
user.

## Changes

Changes to this policy are published in this file in the public repository,
with the date at the top.

## Contact

Questions or problems: open an issue at
https://github.com/ItsReepze/vapor-ledger/issues
