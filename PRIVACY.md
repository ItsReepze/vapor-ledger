# Privacy Policy for Vapor Ledger

Last updated: November 11, 2026

Vapor Ledger is a free browser extension that shows statistics about your own
Steam account. It is made by an individual developer (ItsReepze) and is not
affiliated with Valve or Steam.

## Short version

- Vapor Ledger does not collect, sell or share any data.
- There is no Vapor Ledger server. The extension only talks to Steam.
- Everything it loads is stored in your browser and nowhere else.
- No analytics, no tracking, no ads, no third party services.

## What the extension reads

When you open the Vapor Ledger page, the extension loads the following data
from Steam, using the Steam login you already have in your browser:

| Data | Where it comes from |
|---|---|
| Your Steam ID and the access token Steam puts on its own store pages | the HTML of store.steampowered.com/account/history |
| Your games and playtime | api.steampowered.com (IPlayerService/GetOwnedGames) |
| Your purchase history | store.steampowered.com/account/history |
| Current store prices of your games | api.steampowered.com (IStoreBrowseService/GetItems) |
| Your inventory | steamcommunity.com/inventory |
| Market prices of your items | steamcommunity.com/market/priceoverview |
| Your market history | steamcommunity.com/market/myhistory |

Games, purchase history and store prices are loaded when you open the page
for the first time or click "Load again from Steam". Inventory and market
data are only loaded when you click "Load inventory and market".

## Where the data goes

- The data is sent from Steam to your browser and is used to calculate the
  numbers on the page.
- The results are saved in the extension's local storage
  (`chrome.storage.local`) on your computer, so the page opens quickly
  next time. This storage is not synced to other devices.
- The access token is only ever sent back to api.steampowered.com. It is
  never stored by the extension.
- Nothing is sent to the developer or to anyone other than Steam.

## The recap image and the export

The "Save image" button creates a PNG file in your browser and saves it to
your computer. It contains totals (money spent, playtime, number of games and
similar), no Steam ID and no account name. Game names are only on it if you
tick "Show my 5 most played games". Nothing is uploaded. If you share the
image, you decide where.

The export buttons save your purchase history and games as CSV or JSON files
on your computer. They contain no Steam ID and no token.

## Refunds

The refund page only shows which purchases may still be refundable and links
to Steam's own help page. Vapor Ledger never sends a refund request.

## What the extension never does

- It never buys, sells, lists, trades or refunds anything on your behalf.
- It never changes your Steam account or settings.
- It never reads pages other than Steam's. The script on Steam's pages only
  adds the "Vapor Ledger" link to the header.
- It never loads code from the internet. All code is part of the extension
  package and is public on GitHub.

## Deleting your data

Click "Delete all saved data" on the "Recap & export" tab, click "Load again
from Steam" to replace the saved data, or remove the extension. Removing the
extension deletes everything it stored. You can also clear it through your
browser's extension settings.

## Permissions

| Permission | Why |
|---|---|
| `storage` | to keep the loaded data in your browser, so the page opens instantly |
| store.steampowered.com | to read your purchase history and who is logged in, and to add the "Vapor Ledger" link to the header |
| api.steampowered.com | to read your games, playtime and current store prices from Steam's official API |
| steamcommunity.com | to read your inventory, market prices and market history, and to add the "Vapor Ledger" link to the header |

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
