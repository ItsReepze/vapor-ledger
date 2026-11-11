// Styles of the Vapor Ledger page. The page lives in a shadow root inside
// Steam's store page, so these styles never touch Steam's page or other
// extensions, and their styles never reach in here.
//
// The look is Steam's own (colors, Motiva Sans, the blue accents, the
// dark blue panels), with more room and clearer controls, like a current
// Steam page.

var VL = globalThis.VL || {};
globalThis.VL = VL;

VL.LEDGER_STYLES = `
:host {
  all: initial;
  display: block;
  --bg: #1b2838;
  --panel: #16202d;
  --panel-2: #1f2c3b;
  --line: rgba(255, 255, 255, 0.06);
  --text: #c7d5e0;
  --bright: #ffffff;
  --muted: #8f98a0;
  --dim: #61686d;
  --blue: #1a9fff;
  --light-blue: #66c0f4;
  --good: #a4d007;
  --bad: #e06c5a;
  --warn: #e5b54a;
  color: var(--text);
  font: 14px/1.5 "Motiva Sans", Arial, Helvetica, sans-serif;
}

* { box-sizing: border-box; }
a { color: var(--light-blue); text-decoration: none; }
a:hover { color: var(--bright); }
:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
[hidden] { display: none !important; }

.vl-page { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; }

/* Header: title, data age, reload */
.vl-head { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.vl-head h1 { flex: 1; margin: 0; font-size: 30px; font-weight: 300; color: var(--bright); letter-spacing: 0.01em; }
.vl-head h1 span { display: block; font-size: 13px; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; }
.updated { color: var(--muted); font-size: 12px; }

/* Key numbers */
.hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 1px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--line);
  margin-bottom: 18px;
}
.hero-figure {
  padding: 16px 18px;
  background: linear-gradient(160deg, #213a52 0%, #16202d 70%);
}
.hero-figure .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.hero-figure .value { font-size: 30px; font-weight: 300; color: var(--bright); font-variant-numeric: tabular-nums; }
.hero-figure .hint { font-size: 12px; color: var(--muted); }
.hero-figure.main .value { color: var(--light-blue); }

/* Tabs */
.tabs { display: flex; flex-wrap: wrap; gap: 2px; border-bottom: 1px solid var(--line); margin-bottom: 20px; }
.tabs button {
  height: 42px;
  padding: 0 16px;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
}
.tabs button:hover { color: var(--bright); background: none; }
.tabs button[aria-selected="true"] { color: var(--bright); border-bottom-color: var(--blue); }
.tabs .tab-end { margin-left: auto; }

h2 {
  margin: 28px 0 12px;
  font-size: 15px;
  font-weight: normal;
  color: var(--bright);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
h2:first-child { margin-top: 0; }
h3 { margin: 0 0 6px; font-size: 16px; font-weight: normal; color: var(--bright); }
p { margin: 0 0 10px; }

/* Buttons: Steam's current dialog buttons */
button {
  height: 34px;
  padding: 0 16px;
  border: none;
  border-radius: 2px;
  font: inherit;
  font-size: 14px;
  color: var(--bright);
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
}
button:hover { background: rgba(255, 255, 255, 0.2); }
button:disabled { opacity: 0.45; cursor: default; }
button.primary { background: linear-gradient(to right, #47bfff 5%, #1a44c2 60%); }
button.primary:hover { background: linear-gradient(to right, #63caff 5%, #2f5ad8 60%); }
button.danger { color: #ffb4aa; background: rgba(224, 108, 90, 0.18); }
button.danger:hover { color: var(--bright); background: #c15755; }
button[aria-pressed="true"] { background: var(--blue); }

select, input[type="search"], input[type="text"], input[type="password"] {
  height: 34px;
  padding: 0 10px;
  font: inherit;
  font-size: 14px;
  color: var(--bright);
  background: #0e141b;
  border: 1px solid #2a3f5a;
  border-radius: 2px;
}
select:focus, input:focus { border-color: var(--blue); outline: none; }
input::placeholder { color: var(--dim); }
select option { background: #0e141b; }
input[type="checkbox"] { accent-color: var(--blue); width: 16px; height: 16px; }

/* Panels */
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.tile, .list, .card, .chart, .callout, .setting, .table-wrap, ol.rank li, .highlight {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 4px;
}
.tile { padding: 14px 16px; }
.tile .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.tile .value { font-size: 22px; font-weight: 300; color: var(--bright); font-variant-numeric: tabular-nums; }
.tile .hint { font-size: 12px; color: var(--muted); }
.tile.warn { border-color: rgba(229, 181, 74, 0.5); }
.tile.warn .value { font-size: 17px; color: var(--warn); }

.columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 0 24px; }

/* Highlights on the overview: short cards that lead to a tab */
.highlights { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
.highlight { display: block; padding: 16px; color: var(--text); }
.highlight:hover { border-color: var(--blue); background: var(--panel-2); color: var(--text); }
.highlight .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.highlight .value { font-size: 20px; color: var(--bright); margin: 2px 0; }
.highlight .more { font-size: 13px; color: var(--light-blue); }
.highlight.alert { border-color: rgba(164, 208, 7, 0.45); }
.highlight.alert .value { color: var(--good); }

.list { padding: 4px 14px; }
.list-row, .bar-row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); }
.list-row:last-child, .bar-row:last-child { border-bottom: none; }
.list-row.muted { color: var(--muted); }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.bar-row { align-items: center; }
.bar-row > span:first-child { width: 48px; }
.bar-track { flex: 1; height: 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.06); }
.bar-fill { height: 100%; border-radius: 3px; background: linear-gradient(to right, #47bfff, #1a9fff); }

/* "Show more" sections */
details.more { margin-top: 16px; }
details.more > summary { cursor: pointer; color: var(--light-blue); padding: 6px 0; }
details.more > summary:hover { color: var(--bright); }

/* Tables */
.filters { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 10px; }
.filters input { flex: 1; min-width: 180px; }
.count { font-size: 12px; color: var(--muted); }
.table-wrap { max-height: 600px; overflow: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 8px 12px; text-align: left; }
th { position: sticky; top: 0; z-index: 1; background: #101822; }
tbody tr { border-top: 1px solid var(--line); }
tbody tr:hover { background: rgba(26, 159, 255, 0.08); }
th.num, td.num { text-align: right; }
th button.sort {
  height: auto; padding: 0; background: none; color: var(--muted);
  font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
}
th button.sort:hover, th[aria-sort="ascending"] button.sort, th[aria-sort="descending"] button.sort { color: var(--bright); background: none; }
tr.shame td:first-child { color: var(--warn); }
tr.muted td { color: var(--muted); }
tr.loss td:last-child { color: var(--bad); }
tr.gain td:last-child { color: var(--good); }

.notes ul { margin: 0; padding-left: 20px; color: var(--muted); font-size: 13px; }
.notes li { margin: 4px 0; }
.notes li.error, .error { color: var(--bad); }
.muted { color: var(--muted); }
.empty { color: var(--muted); }
.good { color: var(--good); }
.status { padding: 48px 0; text-align: center; color: var(--muted); }

.callout { padding: 14px 18px; border-left: 3px solid var(--blue); }
.callout p:last-child { margin-bottom: 0; }

/* Refund cards with Steam's green sale badge */
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.card { padding: 16px; }
.card.refundable { border-left: 3px solid #4c6b22; }
.badge { display: inline-block; margin-bottom: 8px; padding: 2px 6px; border-radius: 2px; font-size: 12px; color: #beee11; background: #4c6b22; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; margin: 0 0 12px; font-size: 13px; }
dt { color: var(--muted); }
dd { margin: 0; color: var(--bright); font-variant-numeric: tabular-nums; }

/* Rankings */
ol.rank { list-style: none; counter-reset: rank; margin: 0; padding: 0; }
ol.rank li {
  counter-increment: rank;
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 0 8px;
  padding: 10px 14px;
  margin-bottom: 6px;
}
ol.rank li::before { content: counter(rank) "."; color: var(--dim); grid-row: span 2; }
.rank-name { color: var(--bright); }
.rank-value { text-align: right; color: var(--light-blue); font-variant-numeric: tabular-nums; }
.rank-value.good { color: var(--good); }
.rank-detail { grid-column: 2 / 4; font-size: 12px; color: var(--muted); }

/* Charts */
.charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(440px, 1fr)); gap: 12px; }
.chart-wide { grid-column: 1 / -1; }
.chart { margin: 0; padding: 14px; }
.chart figcaption { margin-bottom: 6px; font-size: 12px; color: var(--bright); text-transform: uppercase; letter-spacing: 0.05em; }
.chart-box { position: relative; }
.chart-svg { display: block; width: 100%; height: auto; }
.chart-svg .grid { stroke: rgba(255, 255, 255, 0.06); }
.chart-svg .baseline { stroke: #3d4b5a; }
.chart-svg .axis { fill: var(--muted); font-size: 11px; font-family: "Motiva Sans", Arial, sans-serif; }
.chart-svg .bar { fill: var(--light-blue); }
.chart-svg .bar.negative { fill: var(--bad); }
.chart-svg .bar.active, .chart-svg .point.active { fill: var(--bright); }
.chart-svg .line { fill: none; stroke: var(--light-blue); stroke-width: 2.5; }
.chart-svg .area { fill: var(--light-blue); opacity: 0.12; }
.chart-svg .dot { fill: var(--bright); stroke: var(--blue); stroke-width: 2; }
.chart-svg .point { fill: var(--light-blue); opacity: 0.8; }
.chart-tip {
  position: absolute; pointer-events: none; max-width: 320px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; padding: 4px 8px; border-radius: 2px; font-size: 12px;
  color: #3d3d3f; background: #c2c2c2; box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
}
.chart details { margin-top: 6px; font-size: 12px; color: var(--muted); }
.chart summary { cursor: pointer; }
.chart-table td, .chart-table th { padding: 3px 8px; }
label.inline { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 8px; }

.form-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 8px 0 14px; }
.recap-preview { width: 100%; max-width: 900px; height: auto; border-radius: 4px; box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5); }
.progress { margin: 12px 0; color: var(--muted); }

/* Settings */
.settings { display: grid; gap: 6px; }
.setting { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; }
.setting > input[type="checkbox"] { flex: none; margin-top: 3px; }
.setting label { display: grid; gap: 2px; cursor: pointer; }
.setting-name { color: var(--bright); }
.setting-hint { font-size: 13px; color: var(--muted); }
.setting-pages { font-size: 12px; color: var(--dim); }
.setting-extra { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }
.setting-extra input { width: 320px; max-width: 100%; }

@media (prefers-reduced-motion: no-preference) {
  button, .highlight, .chart-svg .bar, .chart-svg .point { transition: background 0.15s, color 0.15s, fill 0.1s, border-color 0.15s; }
}
`;
