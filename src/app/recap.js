// The recap image to share. It is drawn on a canvas in this browser and
// saved as a PNG file. Nothing is uploaded. The image contains no Steam ID
// and no account name, and game names only if the user ticks the box.

var VL = globalThis.VL || {};
globalThis.VL = VL;

const RECAP_W = 1200;
const RECAP_H = 675;
const RECAP_COLORS = {
  bg: "#171a21", panel: "#1b2838", text: "#ffffff", muted: "#8f98a0", accent: "#66c0f4",
  accent2: "#a4d007", bad: "#e06c5a",
};

// The text on the image, as [label, value, hint]. Kept apart from the
// drawing, so it can be tested without a canvas.
VL.recapFigures = function (recap) {
  const money = (v) => VL.formatMoney(v, recap.currency);
  const gamesLabel = recap.year === null ? VL.t("recapGamesAll") : VL.t("recapGamesYear");
  const playLabel = recap.year === null ? VL.t("recapPlayedAll") : VL.t("recapPlayedYear");
  return [
    [VL.t("recapSpent"), money(recap.spent), VL.t("recapSpentHint", recap.purchases, recap.refunds)],
    [gamesLabel, VL.formatNumber(recap.gameCount), VL.t("recapNeverPlayed", recap.neverPlayed)],
    [playLabel, VL.formatHours(recap.minutes), ""],
    [VL.t("recapPerHour"), recap.perHour === null ? "-" : money(recap.perHour), VL.t("recapPerHourHint")],
  ];
};

VL.drawRecap = function (canvas, recap) {
  canvas.width = RECAP_W;
  canvas.height = RECAP_H;
  const ctx = canvas.getContext("2d");
  const c = RECAP_COLORS;
  const font = (size, bold) => (bold ? "bold " : "") + size + "px Arial, Helvetica, sans-serif";

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, RECAP_W, RECAP_H);
  ctx.fillStyle = c.accent;
  ctx.fillRect(0, 0, RECAP_W, 6);

  ctx.fillStyle = c.text;
  ctx.font = font(42, true);
  ctx.fillText(recap.year === null ? VL.t("recapTitleAll") : VL.t("recapTitleYear", recap.year), 60, 86);
  ctx.fillStyle = c.muted;
  ctx.font = font(20);
  ctx.fillText(VL.t("recapMadeOn", new Date().toLocaleDateString(VL.locale())), 60, 120);

  // Four figures in a row
  const figures = VL.recapFigures(recap);
  const gap = 20;
  const panelW = (RECAP_W - 120 - gap * 3) / 4;
  figures.forEach(([label, value, hint], i) => {
    const x = 60 + i * (panelW + gap);
    const y = 150;
    ctx.fillStyle = c.panel;
    ctx.fillRect(x, y, panelW, 150);
    ctx.fillStyle = c.muted;
    ctx.font = font(19);
    ctx.fillText(label, x + 20, y + 36, panelW - 40);
    ctx.fillStyle = i === 0 ? c.accent : c.text;
    ctx.font = font(38, true);
    ctx.fillText(value, x + 20, y + 90, panelW - 40);
    ctx.fillStyle = c.muted;
    ctx.font = font(16);
    ctx.fillText(hint, x + 20, y + 126, panelW - 40);
  });

  // Bars: months of the year, or years of the account
  const hasTop = recap.top.length > 0;
  const chartX = 60;
  const chartY = 340;
  const chartW = hasTop ? 640 : RECAP_W - 120;
  const chartH = 230;
  ctx.fillStyle = c.panel;
  ctx.fillRect(chartX, chartY, chartW, chartH + 40);
  ctx.fillStyle = c.muted;
  ctx.font = font(18);
  ctx.fillText(recap.year === null ? VL.t("recapBarsYears") : VL.t("recapBarsMonths"), chartX + 20, chartY + 30);
  const bars = recap.bars;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const innerX = chartX + 20;
  const innerW = chartW - 40;
  const baseY = chartY + chartH;
  const band = innerW / Math.max(1, bars.length);
  bars.forEach((b, i) => {
    const h = Math.max(0, (b.value / max) * (chartH - 70));
    ctx.fillStyle = c.accent;
    ctx.fillRect(innerX + i * band + band * 0.15, baseY - h, band * 0.7, h);
    ctx.fillStyle = c.muted;
    ctx.font = font(14);
    ctx.textAlign = "center";
    const label = recap.year === null ? String(b.key) : VL.formatMonth(b.key).replace(/\s*\d{4}.*$/, "");
    if (bars.length <= 16 || i % 2 === 0) ctx.fillText(label, innerX + i * band + band / 2, baseY + 24);
    ctx.textAlign = "left";
  });

  // Most played games, only if the user chose to show them
  if (hasTop) {
    const x = 720;
    ctx.fillStyle = c.panel;
    ctx.fillRect(x, chartY, RECAP_W - 60 - x, chartH + 40);
    ctx.fillStyle = c.muted;
    ctx.font = font(18);
    ctx.fillText(VL.t("recapTopGames"), x + 20, chartY + 30);
    recap.top.forEach((game, i) => {
      const y = chartY + 72 + i * 38;
      ctx.fillStyle = c.text;
      ctx.font = font(20);
      ctx.fillText((i + 1) + ". " + game.name, x + 20, y, 300);
      ctx.fillStyle = c.accent2;
      ctx.textAlign = "right";
      ctx.fillText(VL.formatHours(game.minutes), RECAP_W - 80, y);
      ctx.textAlign = "left";
    });
  }

  ctx.fillStyle = c.muted;
  ctx.font = font(18);
  ctx.fillText(VL.t("recapFooter"), 60, RECAP_H - 30);
  return canvas;
};

VL.saveRecap = function (recap) {
  const canvas = VL.drawRecap(document.createElement("canvas"), recap);
  canvas.toBlob((blob) => {
    if (blob) VL.download("vapor-ledger-" + (recap.year || "all") + ".png", blob);
  }, "image/png");
};
