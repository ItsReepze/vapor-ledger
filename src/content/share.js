// A summary image to share. It is drawn on a canvas in this browser and
// saved as a PNG file. Nothing is uploaded, and the image contains no
// Steam ID, account name or game list, only the totals.

var VL = globalThis.VL || {};
globalThis.VL = VL;

const SHARE_WIDTH = 1200;
const SHARE_HEIGHT = 630;

// The numbers on the image, as [label, value, hint]. Kept separate from
// the drawing, so it can be tested without a canvas.
VL.summaryFigures = function (stats) {
  const money = (v) => VL.formatMoney(v, stats.currency);
  const percent = stats.gameCount ? Math.round((stats.pileCount / stats.gameCount) * 100) : 0;
  const figures = [
    ["Spent on Steam", money(stats.spent), "purchases minus refunds"],
    ["Played", VL.formatHours(stats.totalMinutes), "in total"],
    ["Games", stats.gameCount.toLocaleString(), ""],
    ["Pile of shame", stats.pileCount.toLocaleString() + " (" + percent + "%)",
      "played less than " + VL.PILE_OF_SHAME_MINUTES / 60 + " h"],
    ["Per hour played", stats.costPerHour === null ? "-" : money(stats.costPerHour), "spent / playtime"],
  ];
  if (stats.hasStorePrices) {
    figures.push(["Store value today",
      VL.formatMoney(stats.storeValue, stats.storeCurrency || stats.currency), "games still for sale"]);
  } else {
    figures.push(["Never started", stats.neverPlayedCount.toLocaleString(), "0 minutes played"]);
  }
  return figures;
};

VL.drawSummary = function (canvas, stats) {
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext("2d");
  const font = (size) => size + "px Arial, Helvetica, sans-serif";

  ctx.fillStyle = "#171d25";
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#dfe3e6";
  ctx.font = font(40);
  ctx.fillText("My Steam account", 60, 95);
  ctx.fillStyle = "#8f98a0";
  ctx.font = font(22);
  ctx.fillText(new Date().toLocaleDateString(), 60, 132);

  // 3 x 2 grid of panels
  const figures = VL.summaryFigures(stats);
  const gap = 20;
  const panelWidth = (SHARE_WIDTH - 120 - gap * 2) / 3;
  const panelHeight = 160;
  figures.forEach(([label, value, hint], i) => {
    const x = 60 + (i % 3) * (panelWidth + gap);
    const y = 170 + Math.floor(i / 3) * (panelHeight + gap);
    ctx.fillStyle = "#1f2833";
    ctx.fillRect(x, y, panelWidth, panelHeight);
    ctx.fillStyle = "#8f98a0";
    ctx.font = font(22);
    ctx.fillText(label, x + 24, y + 42);
    ctx.fillStyle = i === 3 ? "#e06c5a" : "#66c0f4";
    ctx.font = font(46);
    ctx.fillText(value, x + 24, y + 100, panelWidth - 48);
    ctx.fillStyle = "#8f98a0";
    ctx.font = font(18);
    ctx.fillText(hint, x + 24, y + 134, panelWidth - 48);
  });

  ctx.fillStyle = "#8f98a0";
  ctx.font = font(20);
  ctx.fillText("Made with Vapor Ledger, a free browser extension for Steam", 60, SHARE_HEIGHT - 40);
  return canvas;
};

VL.saveSummaryImage = function (stats) {
  const canvas = VL.drawSummary(document.createElement("canvas"), stats);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = VL.el("a", { href: url, download: "vapor-ledger-summary.png" });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, "image/png");
};
