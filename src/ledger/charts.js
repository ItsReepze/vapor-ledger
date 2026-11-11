// Small SVG charts without any library: bars, a line and a scatter plot.
// Every chart has a text alternative (a table under "Show as table"),
// can be read with the keyboard (focus the chart, then arrow keys) and
// shows a tooltip on hover. Colors come from CSS, so light and dark mode
// both work.

var VL = globalThis.VL || {};
globalThis.VL = VL;

const CHART_W = 640; // default width; wide charts pass their own
const CHART_H = 240;
const PAD = { left: 64, right: 12, top: 12, bottom: 30 };

// Round numbers for the axis: 0, 50, 100, 150 ...
function niceTicks(min, max, count) {
  const span = max - min || 1;
  const raw = span / count;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * power).find((s) => s >= raw) || raw;
  const ticks = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function scale(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax - domainMin || 1;
  return (v) => rangeMin + ((v - domainMin) / span) * (rangeMax - rangeMin);
}

// The frame around every chart: caption, svg, tooltip and the table.
function chartFrame(title, description, svg, table, w) {
  const tooltip = VL.el("div", { class: "chart-tip", role: "status", hidden: true });
  svg.setAttribute("viewBox", "0 0 " + w + " " + CHART_H);
  svg.setAttribute("role", "img");
  svg.setAttribute("tabindex", "0");
  svg.setAttribute("aria-label", title + ". " + description);
  const figure = VL.el("figure", { class: "chart" },
    VL.el("figcaption", {}, title),
    VL.el("div", { class: "chart-box" }, svg, tooltip),
    VL.el("details", {}, VL.el("summary", {}, VL.t("chartShowTable")), table)
  );
  return { figure, tooltip };
}

function dataTable(head, rows) {
  return VL.el("table", { class: "chart-table" },
    VL.el("thead", {}, VL.el("tr", {}, head.map((h) => VL.el("th", {}, h)))),
    VL.el("tbody", {}, rows.map((r) => VL.el("tr", {}, r.map((c) => VL.el("td", {}, c)))))
  );
}

function yAxis(svg, ticks, y, format, w) {
  for (const tick of ticks) {
    svg.append(
      VL.svg("line", { class: "grid", x1: PAD.left, x2: w - PAD.right, y1: y(tick), y2: y(tick) }),
      VL.svg("text", { class: "axis", x: PAD.left - 6, y: y(tick) + 4, "text-anchor": "end" }, format(tick))
    );
  }
}

// x labels, at most about 12 so they don't overlap.
function xLabels(svg, labels, x) {
  const every = Math.max(1, Math.ceil(labels.length / 12));
  labels.forEach((label, i) => {
    if (i % every !== 0) return;
    svg.append(VL.svg("text", { class: "axis", x: x(i), y: CHART_H - 10, "text-anchor": "middle" }, label));
  });
}

// Hover and keyboard: points are [{ x, y, text }] in svg coordinates.
// mark(i) highlights point i (or nothing for -1).
function makeInteractive(svg, tooltip, points, mark, w) {
  let active = -1;
  function show(i) {
    active = i;
    mark(i);
    if (i < 0) {
      tooltip.hidden = true;
      return;
    }
    const box = svg.getBoundingClientRect();
    const sx = box.width / w || 1;
    const sy = box.height / CHART_H || 1;
    tooltip.textContent = points[i].text;
    tooltip.hidden = false;
    tooltip.style.left = Math.min(points[i].x * sx, box.width - 160) + "px";
    tooltip.style.top = Math.max(0, points[i].y * sy - 40) + "px";
  }
  function nearest(event) {
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * w;
    const py = ((event.clientY - box.top) / box.height) * CHART_H;
    let best = -1;
    let bestDistance = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - px) * 4 + Math.abs(p.y - py);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    return best;
  }
  svg.addEventListener("pointermove", (e) => show(nearest(e)));
  svg.addEventListener("pointerleave", () => show(-1));
  svg.addEventListener("blur", () => show(-1));
  svg.addEventListener("focus", () => show(points.length ? 0 : -1));
  svg.addEventListener("keydown", (e) => {
    if (!points.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") show(Math.min(points.length - 1, active + 1));
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") show(Math.max(0, active - 1));
    else if (e.key === "Home") show(0);
    else if (e.key === "End") show(points.length - 1);
    else if (e.key === "Escape") show(-1);
    else return;
    e.preventDefault();
  });
}

// data: [{ label, value, tip }]
VL.barChart = function (title, data, format, labelHead, valueHead, width) {
  const w = width || CHART_W;
  const svg = VL.svg("svg", { class: "chart-svg" });
  const values = data.map((d) => d.value);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values, 1), 4);
  const y = scale(ticks[0], ticks[ticks.length - 1], CHART_H - PAD.bottom, PAD.top);
  const band = (w - PAD.left - PAD.right) / Math.max(1, data.length);
  const x = (i) => PAD.left + band * i + band / 2;
  yAxis(svg, ticks, y, format, w);
  xLabels(svg, data.map((d) => d.label), x);

  const bars = data.map((d, i) => {
    const top = y(Math.max(0, d.value));
    const height = Math.abs(y(d.value) - y(0));
    const bar = VL.svg("rect", {
      class: "bar" + (d.value < 0 ? " negative" : ""),
      x: PAD.left + band * i + band * 0.15,
      width: Math.max(1, band * 0.7),
      y: top,
      height: Math.max(d.value === 0 ? 0 : 1, height),
    });
    svg.append(bar);
    return bar;
  });
  svg.append(VL.svg("line", { class: "baseline", x1: PAD.left, x2: w - PAD.right, y1: y(0), y2: y(0) }));

  const description = VL.t("chartBarsDescription", data.length);
  const { figure, tooltip } = chartFrame(title, description, svg,
    dataTable([labelHead, valueHead], data.map((d) => [d.label, format(d.value)])), w);
  makeInteractive(svg, tooltip,
    data.map((d, i) => ({ x: x(i), y: y(Math.max(0, d.value)), text: d.tip || d.label + ": " + format(d.value) })),
    (active) => bars.forEach((b, i) => b.classList.toggle("active", i === active)), w);
  return figure;
};

// data: [{ label, value }]
VL.lineChart = function (title, data, format, labelHead, valueHead) {
  const svg = VL.svg("svg", { class: "chart-svg" });
  const values = data.map((d) => d.value);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(1, ...values), 4);
  const y = scale(ticks[0], ticks[ticks.length - 1], CHART_H - PAD.bottom, PAD.top);
  const w = CHART_W;
  const x = scale(0, Math.max(1, data.length - 1), PAD.left + 4, w - PAD.right - 4);
  yAxis(svg, ticks, y, format, w);
  xLabels(svg, data.map((d) => d.label), x);

  const path = data.map((d, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(d.value).toFixed(1)).join(" ");
  if (data.length) {
    svg.append(VL.svg("path", { class: "area",
      d: path + " L" + x(data.length - 1) + " " + y(ticks[0]) + " L" + x(0) + " " + y(ticks[0]) + " Z" }));
    svg.append(VL.svg("path", { class: "line", d: path }));
  }
  const dot = VL.svg("circle", { class: "dot", r: 5, cx: -10, cy: -10 });
  svg.append(dot);

  const { figure, tooltip } = chartFrame(title, VL.t("chartLineDescription", data.length), svg,
    dataTable([labelHead, valueHead], data.map((d) => [d.label, format(d.value)])), w);
  const points = data.map((d, i) => ({ x: x(i), y: y(d.value), text: d.label + ": " + format(d.value) }));
  makeInteractive(svg, tooltip, points, (i) => {
    dot.setAttribute("cx", i < 0 ? -10 : points[i].x);
    dot.setAttribute("cy", i < 0 ? -10 : points[i].y);
  }, w);
  return figure;
};

// points: [{ name, x, y }], x and y formatted with formatX / formatY.
// The x axis is logarithmic, because playtime ranges from minutes to
// thousands of hours.
VL.scatterChart = function (title, points, formatX, formatY, heads, formatAxisY) {
  const w = CHART_W;
  const svg = VL.svg("svg", { class: "chart-svg" });
  const maxY = Math.max(1, ...points.map((p) => p.y));
  const ticks = niceTicks(0, maxY, 4);
  const y = scale(0, ticks[ticks.length - 1], CHART_H - PAD.bottom, PAD.top);
  const maxLog = Math.max(1, Math.ceil(Math.log10(Math.max(1, ...points.map((p) => p.x)) + 1)));
  const x = (v) => PAD.left + 4 + (Math.log10(v + 1) / maxLog) * (w - PAD.left - PAD.right - 8);
  yAxis(svg, ticks, y, formatAxisY || formatY, w);
  for (let p = -1; p < maxLog; p++) {
    const value = p < 0 ? 0 : Math.pow(10, p);
    svg.append(VL.svg("text", { class: "axis", x: x(value), y: CHART_H - 10, "text-anchor": "middle" },
      formatX(value)));
  }

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const dots = sorted.map((p) => {
    const dot = VL.svg("circle", { class: "point", r: 4, cx: x(p.x), cy: y(p.y) });
    svg.append(dot);
    return dot;
  });

  const { figure, tooltip } = chartFrame(title, VL.t("chartScatterDescription", points.length), svg,
    dataTable(heads, sorted.map((p) => [p.name, formatX(p.x), formatY(p.y)])), w);
  makeInteractive(svg, tooltip,
    sorted.map((p) => ({ x: x(p.x), y: y(p.y), text: p.name + ": " + formatY(p.y) + ", " + formatX(p.x) })),
    (active) => dots.forEach((d, i) => d.classList.toggle("active", i === active)), w);
  return figure;
};
