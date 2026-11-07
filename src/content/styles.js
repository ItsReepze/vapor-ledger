// Styles for the dashboard. They live inside a shadow root, so they
// don't mix with Steam's own CSS in either direction.

var VL = globalThis.VL || {};
globalThis.VL = VL;

VL.STYLES = `
:host {
  --bg: #171d25;
  --panel: #1f2833;
  --panel-2: #26313d;
  --text: #dfe3e6;
  --muted: #8f98a0;
  --accent: #66c0f4;
  --good: #a4d007;
  --bad: #e06c5a;
  --border: #33414f;
  all: initial;
  font-family: "Motiva Sans", Arial, Helvetica, sans-serif;
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.7);
  overflow-y: auto;
  padding: 32px 16px;
  box-sizing: border-box;
}

.window {
  max-width: 1100px;
  margin: 0 auto;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.4;
}

header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

header h1 {
  font-size: 20px;
  margin: 0;
  font-weight: normal;
  flex: 1;
}

header .updated {
  color: var(--muted);
  font-size: 12px;
}

button {
  font: inherit;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 6px 12px;
  cursor: pointer;
}

button:hover { border-color: var(--accent); }
button.active { background: var(--accent); color: #0e141b; border-color: var(--accent); }

main { padding: 20px; }

section { margin-bottom: 28px; }

h2 {
  font-size: 15px;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
  margin: 0 0 10px;
}

.actions { display: flex; justify-content: flex-end; margin: -6px 0 12px; }

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.tile {
  background: var(--panel);
  border-radius: 4px;
  padding: 14px 16px;
}

.tile .label { color: var(--muted); font-size: 12px; }
.tile .value { font-size: 24px; margin-top: 4px; }
.tile .hint { color: var(--muted); font-size: 12px; margin-top: 2px; }

.columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.list { background: var(--panel); border-radius: 4px; padding: 6px 16px; }

.list-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}

.list-row:last-child { border-bottom: none; }
.list-row .muted { color: var(--muted); }

.bar-row {
  display: grid;
  grid-template-columns: 48px 1fr 110px;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.bar { height: 10px; background: var(--accent); border-radius: 2px; min-width: 2px; }
.bar-row .amount { text-align: right; }

.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.filters input {
  font: inherit;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 6px 10px;
  margin-left: auto;
  min-width: 200px;
}

.table-wrap { overflow-x: auto; }

table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-weight: normal; cursor: pointer; user-select: none; white-space: nowrap; }
th:hover { color: var(--text); }
td.num, th.num { text-align: right; }
tr.shame td:first-child { color: var(--bad); }

.notes { color: var(--muted); font-size: 12px; }
.notes a { color: var(--accent); }
.notes li.error { color: var(--bad); }
tr.muted-row td { color: var(--muted); }
tr.gain td:last-child { color: var(--good); }
tr.loss td:last-child { color: var(--bad); }
.progress { color: var(--muted); margin: -12px 0 20px; min-height: 1em; }
.progress button { margin-left: 8px; padding: 2px 10px; }
.notes li { margin-bottom: 4px; }

.status { padding: 60px 20px; text-align: center; color: var(--muted); }
.status.error { color: var(--bad); }
`;
