# Answers for the store review forms

## Chrome Web Store: Privacy practices tab

### Single purpose

Vapor Ledger shows statistics about the user's own Steam account (spending,
playtime, refund deadlines, inventory value and market history) on its own
extension page.

### Permission justifications

**storage**
Keeps the data loaded from Steam (games, purchase history, inventory, prices)
in the browser's local extension storage, so the page opens instantly next
time and market prices are not requested from Steam again within a day.

**Host permission: https://store.steampowered.com/\***
The extension page loads the purchase history from
store.steampowered.com/account/history with the user's existing login and
reads the logged in user's Steam ID and Web API token from that page. A small
content script adds a "Vapor Ledger" link to the store header that opens the
extension page.

**Host permission: https://api.steampowered.com/\***
Reads the user's owned games and playtime (IPlayerService/GetOwnedGames) and
the current store prices of those games (IStoreBrowseService/GetItems) from
Steam's official Web API.

**Host permission: https://steamcommunity.com/\***
When the user clicks "Load inventory and market", the extension page loads the
inventory (steamcommunity.com/inventory), market prices
(steamcommunity.com/market/priceoverview) and market history
(steamcommunity.com/market/myhistory) with the user's existing login. The
same content script as on the store adds the "Vapor Ledger" link to the
header.

**Remote code**
No. All JavaScript is included in the package. No eval, no remote scripts.

### Data usage

Select only the data types that the extension handles locally. Suggested:

- Personally identifiable information: no
- Health information: no
- Financial and payment information: yes, the Steam purchase history
  (amounts and dates). Used only locally to show spending statistics.
- Authentication information: no (the Steam access token on the page is used
  for one request to Steam and never stored)
- Personal communications: no
- Location: no
- Web history: no
- User activity: no
- Website content: yes, content of the user's own Steam pages (games,
  inventory, market history). Used only locally.

Certifications (all three apply):

- I do not sell or transfer user data to third parties, outside of the
  approved use cases
- I do not use or transfer user data for purposes that are unrelated to my
  item's single purpose
- I do not use or transfer user data to determine creditworthiness or for
  lending purposes

Privacy policy URL:
https://github.com/ItsReepze/vapor-ledger/blob/HEAD/PRIVACY.md

## Firefox Add-ons

- The manifest declares `data_collection_permissions: { required: ["none"] }`,
  because no data leaves the browser except requests to Steam itself.
- Source code: the package is not minified or built, so no separate source
  upload is needed. If asked, point to the GitHub repository.
- Notes for the reviewer (copy into the "Notes to reviewer" field):

  The extension has no build step, the uploaded files are the source. To try
  it without a Steam account, open test/harness.html from the GitHub
  repository through any local web server; it uses made up data. With a
  Steam account: log in on store.steampowered.com and click the toolbar
  button.
