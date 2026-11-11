# Store listing texts

Texts for the Chrome Web Store and Firefox Add-ons (addons.mozilla.org).
Chrome's summary allows 132 characters, Firefox's 250. The name and the
short description in the manifest come from `_locales/`, so both stores
show them in English or German depending on the browser.

## Name

Vapor Ledger for Steam

## Category

- Chrome Web Store: Tools (if the dashboard offers a games or entertainment
  category, that one fits better)
- Firefox Add-ons: Games & Entertainment

## Links

- Homepage: https://github.com/ItsReepze/vapor-ledger
- Support: https://github.com/ItsReepze/vapor-ledger/issues
- Privacy policy: https://github.com/ItsReepze/vapor-ledger/blob/HEAD/PRIVACY.md

## Screenshots

`store/screenshots/`, 1280x800, made from `test/harness.html` with made up
data:

1. `1-overview.png` the page inside the Steam store: key numbers and overview
2. `2-refunds.png` still refundable games (German interface)
3. `3-spending.png` spending per year and month
4. `4-games.png` best and worst purchases and the games table
5. `5-recap.png` recap image and export

---

## English

### Summary (max. 132 characters)

An honest statement for your Steam account: spending, playtime, refunds, inventory and market. No tracking, data stays local.

### Description

Vapor Ledger is an honest statement for your Steam account. Not another price tracker: it shows what you really spent, what you got for it and what you can still do about it.

Overview
- Total spent on Steam: store purchases, gifts and in-game purchases, minus refunds
- Spending per year, playtime for every game and in total
- Pile of shame: games you played less than an hour
- Cost per hour for each game and for your whole account
- What your library would cost in the store today

Refund watch
- Games bought in the last 14 days with less than 2 hours played are marked as still refundable, with the days and minutes left
- One click to Steam's own help page for that purchase. Nothing is requested for you, Steam decides

Worth it?
- Your best and worst purchases by cost per hour
- What discounts saved you, compared with today's regular price

Charts
- Spending per month and year, spending over time, playtime ranges, price against playtime
- In Steam's own look, readable with the keyboard and as a table

Inventory and market
- Inventory value for Steam items, Counter-Strike 2, Team Fortress 2, Dota 2, Rust and PUBG
- What you would actually get after Steam's market fees
- Market history with profit or loss per item and in total
- One number for what Steam really cost you

Recap and export
- Save a recap image for your whole account or one year. No Steam ID, no name, game names only if you want them
- Export purchases and games as CSV, or everything as JSON

Works in every Steam store language. Purchases in different currencies are shown apart, never added up. Interface in English and German.

Private by design
- No ads, no tracking, no account, no server of our own.
- The extension talks to Steam. Optional, only if you switch it on: lowest prices from IsThereAnyDeal with your own key (only app ids are sent). Your data stays in your browser.
- Nothing is ever bought, sold, traded or refunded for you.
- Free and open source: https://github.com/ItsReepze/vapor-ledger

How to use
Log in on store.steampowered.com, then choose "Vapor Ledger" in your account menu or click the toolbar button. Vapor Ledger opens as a page inside the Steam store.

Steam limits how fast its pages may be asked, so the first price check of a big inventory takes a few minutes. Prices are kept for a day.

Vapor Ledger is a hobby project and not affiliated with Valve or Steam.

---

## Deutsch

### Kurzbeschreibung (max. 132 Zeichen)

Ehrlicher Kontoauszug für dein Steam-Konto: Ausgaben, Spielzeit, Erstattungen, Inventar, Markt. Ohne Tracking, Daten bleiben lokal.

### Beschreibung

Vapor Ledger ist ein ehrlicher Kontoauszug für dein Steam-Konto. Kein weiteres Preis-Tool: Es zeigt, was du wirklich ausgegeben hast, was du dafür bekommen hast und was du noch tun kannst.

Übersicht
- Gesamtausgaben auf Steam: Käufe, Geschenke und In-Game-Käufe, abzüglich Erstattungen
- Ausgaben pro Jahr, Spielzeit je Spiel und insgesamt
- Pile of Shame: Spiele mit weniger als einer Stunde Spielzeit
- Kosten pro Stunde je Spiel und für das ganze Konto
- Was deine Bibliothek heute im Store kosten würde

Erstattungs-Wächter
- Spiele aus den letzten 14 Tagen mit weniger als 2 Stunden Spielzeit sind als noch erstattbar markiert, mit verbleibenden Tagen und Minuten
- Ein Klick zur Hilfeseite von Steam für diesen Kauf. Es wird nichts für dich beantragt, Steam entscheidet

Hat es sich gelohnt?
- Deine besten und schlechtesten Käufe nach Kosten pro Stunde
- Was dir Rabatte gespart haben, verglichen mit dem heutigen Normalpreis

Diagramme
- Ausgaben pro Monat und Jahr, Ausgaben über die Zeit, Spielzeit-Verteilung, Preis gegen Spielzeit
- Im Look von Steam, mit Tastatur und als Tabelle lesbar

Inventar und Markt
- Inventarwert für Steam-Items, Counter-Strike 2, Team Fortress 2, Dota 2, Rust und PUBG
- Was nach den Marktgebühren von Steam wirklich übrig bleibt
- Markthistorie mit Gewinn oder Verlust je Gegenstand und gesamt
- Eine Zahl dafür, was Steam dich wirklich gekostet hat

Rückblick und Export
- Rückblick als Bild für das ganze Konto oder ein Jahr. Ohne Steam-ID, ohne Namen, Spielnamen nur wenn du willst
- Käufe und Spiele als CSV exportieren, oder alles als JSON

Funktioniert in jeder Steam-Sprache. Käufe in verschiedenen Währungen werden getrennt gezeigt und nie zusammengerechnet. Oberfläche auf Deutsch und Englisch.

Datenschutz von Anfang an
- Keine Werbung, kein Tracking, kein Konto, kein eigener Server.
- Die Erweiterung spricht mit Steam. Optional, nur wenn du es einschaltest: Tiefstpreise von IsThereAnyDeal mit deinem eigenen Schlüssel (gesendet werden nur App-IDs). Deine Daten bleiben in deinem Browser.
- Es wird nie etwas für dich gekauft, verkauft, gehandelt oder erstattet.
- Kostenlos und Open Source: https://github.com/ItsReepze/vapor-ledger

So geht's
Logge dich auf store.steampowered.com ein und wähle dann "Vapor Ledger" in deinem Kontomenü oder klicke auf das Symbol in der Symbolleiste. Vapor Ledger öffnet sich als Seite im Steam-Store.

Steam begrenzt, wie schnell seine Seiten abgefragt werden dürfen. Die erste Preisabfrage eines großen Inventars dauert deshalb ein paar Minuten. Preise werden einen Tag gespeichert.

Vapor Ledger ist ein Hobbyprojekt und gehört nicht zu Valve oder Steam.
