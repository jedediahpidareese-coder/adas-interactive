import { CASE_STORAGE_KEY, DEFAULT_KAPPA } from "./case-library.js";

const canvas = document.getElementById("adasCanvas");
const ctx = canvas.getContext("2d");

const controls = {
  ad: document.getElementById("adShift"),
  sras: document.getElementById("srasShift"),
  lras: document.getElementById("lrasShift"),
  kappa: document.getElementById("kappaSlope")
};

const labels = {
  ad: document.getElementById("adShiftValue"),
  sras: document.getElementById("srasShiftValue"),
  lras: document.getElementById("lrasShiftValue"),
  kappa: document.getElementById("kappaValue")
};

const outputValue = document.getElementById("outputValue");
const priceValue = document.getElementById("priceValue");
const gapValue = document.getElementById("gapValue");
const scenarioText = document.getElementById("scenarioText");
const adjustmentText = document.getElementById("adjustmentText");

const baselineDateText = document.getElementById("baselineDateText");
const anchorPiValue = document.getElementById("anchorPiValue");
const anchorGrowthValue = document.getElementById("anchorGrowthValue");
const anchorSpendingValue = document.getElementById("anchorSpendingValue");
const shockPiValue = document.getElementById("shockPiValue");
const shockGrowthValue = document.getElementById("shockGrowthValue");
const shockSpendingValue = document.getElementById("shockSpendingValue");
const expInflValue = document.getElementById("expInflValue");
const potentialGrowthValue = document.getElementById("potentialGrowthValue");
const adGrowthValue = document.getElementById("adGrowthValue");
const deltaAdPanelValue = document.getElementById("deltaAdPanelValue");
const deltaSrasPanelValue = document.getElementById("deltaSrasPanelValue");
const deltaLrasPanelValue = document.getElementById("deltaLrasPanelValue");
const kappaPanelValue = document.getElementById("kappaPanelValue");

const resetBtn = document.getElementById("resetBtn");
const runLongRunBtn = document.getElementById("runLongRunBtn");
const resetViewBtn = document.getElementById("resetViewBtn");
const autoZoomToggle = document.getElementById("autoZoomToggle");

const explanationPanel = document.getElementById("explanationPanel");
const explanationTitle = document.getElementById("explanationTitle");
const explanationEquation = document.getElementById("explanationEquation");
const explanationBody = document.getElementById("explanationBody");
const showMathBtn = document.getElementById("showMathBtn");
const showStoryBtn = document.getElementById("showStoryBtn");

const defaultAnchor = {
  label: "Default classroom anchor",
  pi0: 2.0,
  g0: 2.0
};

const DEFAULT_AXIS_BOUNDS = {
  gMin: -8,
  gMax: 10,
  piMin: -6,
  piMax: 16
};

const CURVE_HIT_PX = 10;
const LABEL_HIT_RADIUS = 20;

const state = {
  anchor: normalizeAnchor(defaultAnchor),
  deltaAd: 0,
  deltaSras: 0,
  deltaLras: 0,
  kappa: DEFAULT_KAPPA,
  note: "Baseline anchor loaded.",
  loadedCase: null,
  selectedTarget: null,
  explanationMode: "math",
  view: {
    autoZoom: false,
    bounds: { ...DEFAULT_AXIS_BOUNDS }
  },
  interaction: {
    plot: null,
    eqPoint: null,
    labelHotspots: []
  },
  longRunAnimation: null
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampToControl(value, control) {
  return clamp(toNumber(value), toNumber(control.min), toNumber(control.max));
}

function signed(value, digits = 2) {
  const amount = toNumber(value);
  return `${amount >= 0 ? "+" : ""}${amount.toFixed(digits)}`;
}

function pct(value, digits = 2) {
  return `${toNumber(value).toFixed(digits)}%`;
}

function pp(value, digits = 2) {
  return `${signed(value, digits)} pp`;
}

function normalizeAnchor(anchor) {
  const pi0 = toNumber(anchor?.pi0, 0);
  const g0 = toNumber(anchor?.g0, 0);
  return {
    label: anchor?.label || "Anchor",
    pi0,
    g0,
    s0: pi0 + g0,
    piE0: pi0,
    gStar0: g0
  };
}

function currentSpending() {
  return state.anchor.s0 + state.deltaAd;
}

function currentPotentialGrowth() {
  return state.anchor.gStar0 + state.deltaLras;
}

function currentSrasIntercept() {
  return state.anchor.piE0 + state.deltaSras;
}

function adInflation(g) {
  return currentSpending() - g;
}

function srasInflation(g) {
  return currentSrasIntercept() + state.kappa * (g - currentPotentialGrowth());
}

function solveEquilibrium() {
  const s = currentSpending();
  const gStar = currentPotentialGrowth();
  const intercept = currentSrasIntercept();
  const denominator = 1 + state.kappa;
  const g = denominator === 0 ? Number.NaN : (s - intercept + state.kappa * gStar) / denominator;
  const pi = s - g;
  const gap = g - gStar;
  return { s, gStar, intercept, g, pi, gap };
}

function setShifts(ad, sras, lras) {
  state.deltaAd = clampToControl(ad, controls.ad);
  state.deltaSras = clampToControl(sras, controls.sras);
  state.deltaLras = clampToControl(lras, controls.lras);
  controls.ad.value = state.deltaAd.toFixed(2);
  controls.sras.value = state.deltaSras.toFixed(2);
  controls.lras.value = state.deltaLras.toFixed(2);
}

function syncControlLabels() {
  labels.ad.textContent = signed(state.deltaAd, 2);
  labels.sras.textContent = signed(state.deltaSras, 2);
  labels.lras.textContent = signed(state.deltaLras, 2);
  labels.kappa.textContent = state.kappa.toFixed(1);
}

function updateOutcomeCards(eq) {
  outputValue.textContent = pct(eq.g, 2);
  priceValue.textContent = pct(eq.pi, 2);
  gapValue.textContent = pp(eq.gap, 2);
}

function updateAnchorPanel(eq) {
  if (state.loadedCase) {
    baselineDateText.textContent = `${state.loadedCase.title} (${state.loadedCase.t0} to ${state.loadedCase.t1})`;
  } else {
    baselineDateText.textContent = state.anchor.label;
  }

  anchorPiValue.textContent = pct(state.anchor.pi0, 2);
  anchorGrowthValue.textContent = pct(state.anchor.g0, 2);
  anchorSpendingValue.textContent = pct(state.anchor.s0, 2);

  if (state.loadedCase) {
    const shockS = toNumber(state.loadedCase.pi1) + toNumber(state.loadedCase.g1);
    shockPiValue.textContent = pct(state.loadedCase.pi1, 2);
    shockGrowthValue.textContent = pct(state.loadedCase.g1, 2);
    shockSpendingValue.textContent = pct(shockS, 2);
  } else {
    shockPiValue.textContent = "-";
    shockGrowthValue.textContent = "-";
    shockSpendingValue.textContent = "-";
  }

  adGrowthValue.textContent = pct(eq.s, 2);
  potentialGrowthValue.textContent = pct(eq.gStar, 2);
  expInflValue.textContent = pct(eq.intercept, 2);
  deltaAdPanelValue.textContent = pp(state.deltaAd, 2);
  deltaSrasPanelValue.textContent = pp(state.deltaSras, 2);
  deltaLrasPanelValue.textContent = pp(state.deltaLras, 2);
  kappaPanelValue.textContent = state.kappa.toFixed(2);
}

function buildIdentityText(eq) {
  const lhs = eq.pi + eq.g;
  let text = `${state.note} Identity check: π + g = s. ` +
    `Current: ${eq.pi.toFixed(2)} + ${eq.g.toFixed(2)} = ${lhs.toFixed(2)}, s = ${eq.s.toFixed(2)}.`;

  if (state.loadedCase) {
    const s0 = toNumber(state.loadedCase.pi0) + toNumber(state.loadedCase.g0);
    const s1 = toNumber(state.loadedCase.pi1) + toNumber(state.loadedCase.g1);
    text += ` Case data: s0 = ${s0.toFixed(2)}, s1 = ${s1.toFixed(2)}, ΔAD = ${(s1 - s0).toFixed(2)} pp.`;
  }

  return text;
}

function padRange(min, max, paddingFraction, minSpan) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [-minSpan / 2, minSpan / 2];
  if (min === max) {
    min -= minSpan / 2;
    max += minSpan / 2;
  }
  let span = max - min;
  if (span < minSpan) {
    const center = (min + max) / 2;
    min = center - minSpan / 2;
    max = center + minSpan / 2;
    span = minSpan;
  }
  const pad = span * paddingFraction;
  return [min - pad, max + pad];
}

function computeAutoBounds(eq) {
  const gCandidates = [state.anchor.g0, state.anchor.gStar0, eq.g, eq.gStar, currentSpending(), currentPotentialGrowth()];

  if (state.loadedCase) {
    gCandidates.push(toNumber(state.loadedCase.g0), toNumber(state.loadedCase.g1));
  }

  if (Math.abs(state.kappa) > 1e-8) {
    gCandidates.push(currentPotentialGrowth() - currentSrasIntercept() / state.kappa);
  }

  let gMin = Math.min(...gCandidates);
  let gMax = Math.max(...gCandidates);
  [gMin, gMax] = padRange(gMin, gMax, 0.14, 12);

  const piCandidates = [
    state.anchor.pi0,
    eq.pi,
    currentSrasIntercept(),
    adInflation(gMin),
    adInflation(gMax),
    srasInflation(gMin),
    srasInflation(gMax)
  ];

  if (state.loadedCase) {
    piCandidates.push(toNumber(state.loadedCase.pi1));
  }

  let piMin = Math.min(...piCandidates);
  let piMax = Math.max(...piCandidates);
  [piMin, piMax] = padRange(piMin, piMax, 0.14, 12);

  gMin = clamp(gMin, -30, 30);
  gMax = clamp(gMax, -30, 30);
  piMin = clamp(piMin, -30, 35);
  piMax = clamp(piMax, -30, 35);

  if (gMax - gMin < 8) {
    const center = (gMax + gMin) / 2;
    gMin = center - 4;
    gMax = center + 4;
  }

  if (piMax - piMin < 8) {
    const center = (piMax + piMin) / 2;
    piMin = center - 4;
    piMax = center + 4;
  }

  return { gMin, gMax, piMin, piMax };
}

function setupCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = Math.max(320, Math.round(width * 0.62));

  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  return { width, height };
}

function buildPlot(width, height, bounds) {
  const left = 88;
  const right = width - 22;
  const top = 24;
  const bottom = height - 62;
  const plotWidth = right - left;
  const plotHeight = bottom - top;

  return {
    left,
    right,
    top,
    bottom,
    plotWidth,
    plotHeight,
    gMin: bounds.gMin,
    gMax: bounds.gMax,
    piMin: bounds.piMin,
    piMax: bounds.piMax,
    x(g) {
      return left + ((g - bounds.gMin) / (bounds.gMax - bounds.gMin)) * plotWidth;
    },
    y(pi) {
      return top + ((bounds.piMax - pi) / (bounds.piMax - bounds.piMin)) * plotHeight;
    },
    gFromX(x) {
      return bounds.gMin + ((x - left) / plotWidth) * (bounds.gMax - bounds.gMin);
    },
    piFromY(y) {
      return bounds.piMax - ((y - top) / plotHeight) * (bounds.piMax - bounds.piMin);
    }
  };
}

function gridStep(range) {
  if (range <= 12) return 1;
  if (range <= 24) return 2;
  return 4;
}

function drawGrid(plot) {
  const bg = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
  bg.addColorStop(0, "rgba(245, 250, 255, 0.95)");
  bg.addColorStop(1, "rgba(255, 251, 243, 0.95)");
  ctx.fillStyle = bg;
  ctx.fillRect(plot.left, plot.top, plot.plotWidth, plot.plotHeight);

  const gStep = gridStep(plot.gMax - plot.gMin);
  const piStep = gridStep(plot.piMax - plot.piMin);

  for (let g = Math.ceil(plot.gMin); g <= Math.floor(plot.gMax); g += 1) {
    const x = plot.x(g);
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, plot.bottom);
    ctx.strokeStyle = g === 0 ? "rgba(15, 45, 72, 0.25)" : "rgba(16, 41, 64, 0.12)";
    ctx.lineWidth = g === 0 ? 1.5 : 1;
    ctx.stroke();

    if (g % gStep === 0) {
      ctx.fillStyle = "#3c5871";
      ctx.font = "500 11px 'Space Grotesk', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(g), x, plot.bottom + 10);
    }
  }

  for (let pi = Math.ceil(plot.piMin); pi <= Math.floor(plot.piMax); pi += 1) {
    const y = plot.y(pi);
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.strokeStyle = pi === 0 ? "rgba(15, 45, 72, 0.25)" : "rgba(16, 41, 64, 0.12)";
    ctx.lineWidth = pi === 0 ? 1.5 : 1;
    ctx.stroke();

    if (pi % piStep === 0) {
      ctx.fillStyle = "#3c5871";
      ctx.font = "500 11px 'Space Grotesk', sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(pi), plot.left - 9, y);
    }
  }

  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.strokeStyle = "#0f2d48";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#1b324b";
  ctx.font = "600 13px 'Space Grotesk', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Inflation rate, π (%)", plot.left + 10, plot.top + 6);

  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("Real GDP growth rate, g (%)", plot.right, plot.bottom + 36);
}

function drawWithinPlot(plot, drawFn) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.plotWidth, plot.plotHeight);
  ctx.clip();
  drawFn();
  ctx.restore();
}

function drawCurve(plot, fn, color, width, options = {}) {
  const { dashed = false, alpha = 1 } = options;
  drawWithinPlot(plot, () => {
    ctx.globalAlpha = alpha;
    ctx.setLineDash(dashed ? [7, 5] : []);

    ctx.beginPath();
    let started = false;

    for (let g = plot.gMin; g <= plot.gMax; g += (plot.gMax - plot.gMin) / 420) {
      const pi = fn(g);
      if (!Number.isFinite(pi)) {
        started = false;
        continue;
      }
      const x = plot.x(g);
      const y = plot.y(pi);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  });
}

function drawVertical(plot, g, color, width, options = {}) {
  const { dashed = false, alpha = 1 } = options;
  drawWithinPlot(plot, () => {
    const x = plot.x(g);
    ctx.globalAlpha = alpha;
    ctx.setLineDash(dashed ? [7, 5] : []);
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, plot.bottom);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  });
}

function collectVisibleCurvePoints(plot, fn) {
  const points = [];
  const step = (plot.gMax - plot.gMin) / 240;
  const piPad = 0.5;
  for (let g = plot.gMin; g <= plot.gMax; g += step) {
    const pi = fn(g);
    if (!Number.isFinite(pi)) continue;
    if (pi < plot.piMin + piPad || pi > plot.piMax - piPad) continue;
    points.push({ g, pi, x: plot.x(g), y: plot.y(pi) });
  }
  return points;
}

function textBox(text) {
  ctx.font = "700 13px 'Space Grotesk', sans-serif";
  const width = ctx.measureText(text).width;
  return { width, height: 15 };
}

function keepInside(plot, label, margin = 8) {
  const halfW = label.width / 2;
  const halfH = label.height / 2;
  label.x = clamp(label.x, plot.left + margin + halfW, plot.right - margin - halfW);
  label.y = clamp(label.y, plot.top + margin + halfH, plot.bottom - margin - halfH);
}

function overlap(a, b, pad = 5) {
  return !(
    a.x + a.width / 2 + pad < b.x - b.width / 2 ||
    a.x - a.width / 2 - pad > b.x + b.width / 2 ||
    a.y + a.height / 2 + pad < b.y - b.height / 2 ||
    a.y - a.height / 2 - pad > b.y + b.height / 2
  );
}

function slopeAngle(plot, fn, g) {
  const delta = (plot.gMax - plot.gMin) * 0.01;
  const g1 = g - delta;
  const g2 = g + delta;
  const x1 = plot.x(g1);
  const y1 = plot.y(fn(g1));
  const x2 = plot.x(g2);
  const y2 = plot.y(fn(g2));
  return Math.atan2(y2 - y1, x2 - x1);
}

function computeCurveLabels(plot, eq) {
  const adPoints = collectVisibleCurvePoints(plot, adInflation);
  const srasPoints = collectVisibleCurvePoints(plot, srasInflation);

  const adPoint = adPoints[Math.floor(adPoints.length * 0.78)] || { g: eq.g, x: plot.x(eq.g), y: plot.y(eq.pi) };
  const srasPoint = srasPoints[Math.floor(srasPoints.length * 0.65)] || { g: eq.g, x: plot.x(eq.g), y: plot.y(eq.pi) };

  const labelsOut = [
    {
      id: "ad",
      text: "AD",
      x: adPoint.x,
      y: adPoint.y,
      angle: slopeAngle(plot, adInflation, adPoint.g),
      rotate: true,
      color: "#9a4719"
    },
    {
      id: "sras",
      text: "SRAS",
      x: srasPoint.x,
      y: srasPoint.y,
      angle: slopeAngle(plot, srasInflation, srasPoint.g),
      rotate: true,
      color: "#156843"
    },
    {
      id: "lras",
      text: "Potential (Solow) growth, g*",
      x: plot.x(eq.gStar),
      y: plot.top + 14,
      angle: 0,
      rotate: false,
      color: "#1f4f9c"
    }
  ];

  labelsOut.forEach((label) => {
    const box = textBox(label.text);
    label.width = box.width;
    label.height = box.height;
    keepInside(plot, label, 8);
  });

  for (let i = 1; i < labelsOut.length; i += 1) {
    let attempts = 0;
    while (attempts < 10) {
      const overlapsAny = labelsOut.slice(0, i).some((placed) => overlap(labelsOut[i], placed));
      if (!overlapsAny) break;
      labelsOut[i].y += attempts % 2 === 0 ? 14 : -14;
      labelsOut[i].x += attempts % 3 === 0 ? 10 : -8;
      keepInside(plot, labelsOut[i], 8);
      attempts += 1;
    }
  }

  return labelsOut;
}

function drawCurveLabels(labelsOut) {
  ctx.font = "700 13px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const label of labelsOut) {
    ctx.save();
    ctx.translate(label.x, label.y);
    if (label.rotate) ctx.rotate(label.angle);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeText(label.text, 0, 0);
    ctx.fillStyle = label.color;
    ctx.fillText(label.text, 0, 0);
    ctx.restore();
  }
}

function drawEquilibrium(plot, eq) {
  const xEq = plot.x(eq.g);
  const yEq = plot.y(eq.pi);
  const xStar = plot.x(eq.gStar);

  if (Math.abs(xEq - xStar) > 2) {
    drawWithinPlot(plot, () => {
      ctx.fillStyle = eq.gap >= 0 ? "rgba(228, 111, 47, 0.13)" : "rgba(31, 79, 156, 0.13)";
      ctx.fillRect(Math.min(xEq, xStar), plot.top, Math.abs(xEq - xStar), plot.plotHeight);
    });
  }

  const inside = xEq >= plot.left && xEq <= plot.right && yEq >= plot.top && yEq <= plot.bottom;
  if (!inside) {
    state.interaction.eqPoint = null;
    return;
  }

  drawWithinPlot(plot, () => {
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(xEq, plot.bottom);
    ctx.lineTo(xEq, yEq);
    ctx.lineTo(plot.left, yEq);
    ctx.strokeStyle = "rgba(15, 45, 72, 0.52)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  });

  const selected = state.selectedTarget === "eq";
  const radius = selected ? 7.5 : 6;
  ctx.beginPath();
  ctx.arc(xEq, yEq, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#0f2d48";
  ctx.fill();

  ctx.fillStyle = "#0f2d48";
  ctx.font = "700 13px 'Sora', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("E", xEq + 9, yEq - 7);

  state.interaction.eqPoint = { x: xEq, y: yEq, r: 10 };
}

function drawGraph(eq) {
  const { width, height } = setupCanvas();

  if (state.view.autoZoom) {
    state.view.bounds = computeAutoBounds(eq);
  }

  const plot = buildPlot(width, height, state.view.bounds);
  state.interaction.plot = plot;

  ctx.clearRect(0, 0, width, height);
  drawGrid(plot);

  const hasCurveSelection = state.selectedTarget === "ad" || state.selectedTarget === "sras" || state.selectedTarget === "lras";
  const fadeAlpha = 0.24;

  const adAlpha = hasCurveSelection && state.selectedTarget !== "ad" ? fadeAlpha : 1;
  const srasAlpha = hasCurveSelection && state.selectedTarget !== "sras" ? fadeAlpha : 1;
  const lrasAlpha = hasCurveSelection && state.selectedTarget !== "lras" ? fadeAlpha : 1;

  const baselineAlpha = hasCurveSelection ? 0.2 : 0.35;

  const baselineAd = (g) => state.anchor.s0 - g;
  const baselineSras = (g) => state.anchor.piE0 + state.kappa * (g - state.anchor.gStar0);

  drawCurve(plot, baselineAd, "#e46f2f", 2, { dashed: true, alpha: baselineAlpha });
  drawCurve(plot, baselineSras, "#1f8a5b", 2, { dashed: true, alpha: baselineAlpha });
  drawVertical(plot, state.anchor.gStar0, "#1f4f9c", 2, { dashed: true, alpha: baselineAlpha });

  drawCurve(plot, adInflation, "#e46f2f", state.selectedTarget === "ad" ? 4.5 : 3, { alpha: adAlpha });
  drawCurve(plot, srasInflation, "#1f8a5b", state.selectedTarget === "sras" ? 4.5 : 3, { alpha: srasAlpha });
  drawVertical(plot, eq.gStar, "#1f4f9c", state.selectedTarget === "lras" ? 4.5 : 3, { alpha: lrasAlpha });

  drawEquilibrium(plot, eq);

  const labelsOut = computeCurveLabels(plot, eq);
  drawCurveLabels(labelsOut);

  state.interaction.labelHotspots = labelsOut.map((label) => ({
    id: label.id,
    x: label.x,
    y: label.y,
    r: Math.max(LABEL_HIT_RADIUS, Math.min(36, label.width * 0.26))
  }));
}

function listToHtml(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function getExplanationData(target, eq) {
  if (target === "ad") {
    return {
      title: "Aggregate Demand (AD)",
      equation: "π = s - g",
      mathPoints: [
        "s is nominal spending growth (approximately ΔM + ΔV).",
        "In (g, π) space, AD has slope -1.",
        "A higher s shifts AD right/up for any given g."
      ],
      shifts: [
        "Shift driver: AD shift slider (Δs, pp).",
        "Interpretation: faster money growth and/or velocity growth raises s.",
        "Identity tie: because s = π + g, AD is pinned by spending growth."
      ],
      story:
        "AD summarizes total nominal spending growth in the economy. When spending growth rises, firms can sell more at existing prices, so inflation and growth combinations move up along the AD relation. If spending growth slows, AD shifts inward. In this simulator, the AD slider is exactly a change in s, not a generic demand mystery."
    };
  }

  if (target === "sras") {
    return {
      title: "Short-Run Aggregate Supply (SRAS)",
      equation: "π = πᵉ + ΔSRAS + κ (g - g*)",
      mathPoints: [
        "πᵉ is expected inflation; in the short run it is sticky.",
        "ΔSRAS captures cost-push, markup pressure, and supply disruption forces.",
        "κ controls how sensitive inflation is to growth gaps around g*."
      ],
      shifts: [
        "Shift drivers: expected inflation πᵉ and the SRAS shift slider ΔSRAS.",
        "Slope driver: κ slider changes SRAS steepness.",
        "When πᵉ adjusts in the long run, SRAS moves until growth returns to g*."
      ],
      story:
        "SRAS tells you how inflation responds when actual growth differs from potential growth. If firms and workers expect higher inflation, the whole SRAS curve moves up. Cost shocks can do the same even when demand has not changed. In the long run, expectations catch up and SRAS repositions."
    };
  }

  if (target === "lras") {
    return {
      title: "Long-Run Aggregate Supply (LRAS)",
      equation: "g = g*",
      mathPoints: [
        "LRAS is vertical at potential (Solow) growth, g*.",
        "LRAS does not depend on current inflation in this framework.",
        "Growth gaps are measured as g - g*."
      ],
      shifts: [
        "Shift driver: LRAS shift slider (ΔLRAS, pp).",
        "Right shifts: better technology, capital deepening, labor-force growth.",
        "Left shifts: disasters, persistent energy constraints, institutional damage."
      ],
      story:
        "LRAS is the economy's potential growth path. It reflects fundamentals, not temporary demand fluctuations. Policy can influence g* over time through productivity and institutions, but not by pure nominal spending boosts. In this model, LRAS movement is a change in potential growth itself."
    };
  }

  const identityGap = eq.pi + eq.g - eq.s;
  return {
    title: "Equilibrium Point (E)",
    equation: "Identity check: s = π + g",
    mathPoints: [
      `Current inflation: π = ${eq.pi.toFixed(2)}%`,
      `Current growth: g = ${eq.g.toFixed(2)}%`,
      `Current spending growth: s = ${eq.s.toFixed(2)}%`,
      `Check: π + g = ${(eq.pi + eq.g).toFixed(2)}% (error ${identityGap.toFixed(4)})`
    ],
    shifts: [
      `Potential growth: g* = ${eq.gStar.toFixed(2)}%`,
      `Growth gap: g - g* = ${eq.gap.toFixed(2)} pp`
    ],
    story:
      "Point E is where AD and SRAS intersect given current sliders. The economy's inflation and growth outcomes are read directly from this point. The identity s = π + g must hold at the same time. If growth is away from g*, long-run adjustment comes from SRAS moving as expected inflation changes."
  };
}

function renderExplanation(eq) {
  if (!state.selectedTarget) {
    explanationPanel.hidden = true;
    return;
  }

  const data = getExplanationData(state.selectedTarget, eq);
  explanationPanel.hidden = false;
  explanationTitle.textContent = data.title;

  const showMath = state.explanationMode === "math";
  showMathBtn.classList.toggle("is-active", showMath);
  showStoryBtn.classList.toggle("is-active", !showMath);

  if (showMath) {
    explanationEquation.textContent = data.equation;
    explanationBody.innerHTML =
      `<h4>Interpretation</h4>${listToHtml(data.mathPoints)}` +
      `<h4>What shifts me?</h4>${listToHtml(data.shifts)}`;
    return;
  }

  explanationEquation.textContent = "";
  explanationBody.innerHTML = `<p>${data.story}</p>`;
}

function render() {
  const eq = solveEquilibrium();
  syncControlLabels();
  updateOutcomeCards(eq);
  updateAnchorPanel(eq);
  scenarioText.textContent = buildIdentityText(eq);
  drawGraph(eq);
  renderExplanation(eq);
}

function distance(aX, aY, bX, bY) {
  return Math.hypot(aX - bX, aY - bY);
}

function pickTargetAt(x, y) {
  const { plot, eqPoint, labelHotspots } = state.interaction;
  if (!plot) return null;

  if (eqPoint && distance(x, y, eqPoint.x, eqPoint.y) <= eqPoint.r) {
    return "eq";
  }

  for (const hotspot of labelHotspots) {
    if (distance(x, y, hotspot.x, hotspot.y) <= hotspot.r) {
      return hotspot.id;
    }
  }

  if (x < plot.left || x > plot.right || y < plot.top || y > plot.bottom) {
    return null;
  }

  const g = plot.gFromX(x);
  const yAd = plot.y(adInflation(g));
  const ySras = plot.y(srasInflation(g));
  const xLras = plot.x(currentPotentialGrowth());

  const candidates = [
    { id: "ad", dist: Math.abs(y - yAd) },
    { id: "sras", dist: Math.abs(y - ySras) },
    { id: "lras", dist: Math.abs(x - xLras) }
  ].sort((a, b) => a.dist - b.dist);

  return candidates[0].dist <= CURVE_HIT_PX ? candidates[0].id : null;
}

function onCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const picked = pickTargetAt(x, y);

  state.selectedTarget = picked;

  if (!picked) {
    explanationPanel.hidden = true;
    adjustmentText.textContent = "Click a curve (or E) to open the explanation panel.";
  }

  render();
}

function stopLongRunAdjustment() {
  if (!state.longRunAnimation) return;
  cancelAnimationFrame(state.longRunAnimation.rafId);
  state.longRunAnimation = null;
  runLongRunBtn.disabled = false;
}

function runLongRunAdjustment() {
  stopLongRunAdjustment();

  const startDeltaSras = state.deltaSras;
  const targetIntercept = currentSpending() - currentPotentialGrowth();
  const targetDeltaSras = clampToControl(targetIntercept - state.anchor.piE0, controls.sras);
  const durationMs = 1500;
  const startTime = performance.now();

  runLongRunBtn.disabled = true;
  state.selectedTarget = "sras";
  state.explanationMode = "story";
  adjustmentText.textContent = "Running long-run adjustment: expected inflation πᵉ is moving SRAS.";

  const animate = (now) => {
    const progress = clamp((now - startTime) / durationMs, 0, 1);
    const eased = 1 - (1 - progress) ** 3;

    state.deltaSras = startDeltaSras + (targetDeltaSras - startDeltaSras) * eased;
    controls.sras.value = state.deltaSras.toFixed(2);
    state.note = "Long-run adjustment in progress.";
    render();

    if (progress < 1) {
      state.longRunAnimation.rafId = requestAnimationFrame(animate);
      return;
    }

    state.deltaSras = targetDeltaSras;
    controls.sras.value = state.deltaSras.toFixed(2);
    state.longRunAnimation = null;
    runLongRunBtn.disabled = false;
    state.note = "In the long run, expected inflation adjusts until growth returns to g*.";
    adjustmentText.textContent = "In the long run, expected inflation adjusts until growth returns to g*.";
    render();
  };

  state.longRunAnimation = { rafId: requestAnimationFrame(animate) };
}

function applyAnchor(anchor, kappa = DEFAULT_KAPPA) {
  state.anchor = normalizeAnchor(anchor);
  state.kappa = clampToControl(kappa, controls.kappa);
  controls.kappa.value = state.kappa.toFixed(1);
}

function applyCasePayloadIfPresent() {
  let raw;
  try {
    raw = window.localStorage.getItem(CASE_STORAGE_KEY);
  } catch (_error) {
    return false;
  }

  if (!raw) return false;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_error) {
    window.localStorage.removeItem(CASE_STORAGE_KEY);
    return false;
  }

  window.localStorage.removeItem(CASE_STORAGE_KEY);

  applyAnchor(payload.anchor || { label: `${payload.title || "Case"} anchor`, pi0: payload.pi0, g0: payload.g0 }, payload.kappa ?? DEFAULT_KAPPA);

  const shifts = payload.shifts || {};
  setShifts(shifts.ad ?? 0, shifts.sras ?? 0, shifts.lras ?? 0);

  state.loadedCase = payload;
  state.note = payload.note || "Historical case loaded.";
  state.selectedTarget = null;
  state.explanationMode = "math";

  state.view.autoZoom = true;
  autoZoomToggle.checked = true;
  state.view.bounds = computeAutoBounds(solveEquilibrium());

  adjustmentText.textContent = payload.prompt || "Historical case loaded. Click a curve for interpretation.";
  return true;
}

function onShiftInput() {
  stopLongRunAdjustment();
  state.deltaAd = toNumber(controls.ad.value);
  state.deltaSras = toNumber(controls.sras.value);
  state.deltaLras = toNumber(controls.lras.value);
  state.note = "Manual shift update.";
  render();
}

function onKappaInput() {
  stopLongRunAdjustment();
  state.kappa = clampToControl(controls.kappa.value, controls.kappa);
  state.note = "Manual κ update.";
  render();
}

function onResetShocks() {
  stopLongRunAdjustment();
  setShifts(0, 0, 0);
  state.selectedTarget = null;
  state.note = "Shifts reset to anchor values.";
  adjustmentText.textContent = "Shifts reset. Click a curve (or E) to open the explanation panel.";
  render();
}

function onResetView() {
  state.view.autoZoom = false;
  autoZoomToggle.checked = false;
  state.view.bounds = { ...DEFAULT_AXIS_BOUNDS };
  render();
}

function onAutoZoomToggle() {
  state.view.autoZoom = autoZoomToggle.checked;
  if (state.view.autoZoom) {
    state.view.bounds = computeAutoBounds(solveEquilibrium());
  }
  render();
}

function setExplanationMode(mode) {
  state.explanationMode = mode;
  render();
}

function wireEvents() {
  controls.ad.addEventListener("input", onShiftInput);
  controls.sras.addEventListener("input", onShiftInput);
  controls.lras.addEventListener("input", onShiftInput);
  controls.kappa.addEventListener("input", onKappaInput);

  resetBtn.addEventListener("click", onResetShocks);
  runLongRunBtn.addEventListener("click", runLongRunAdjustment);
  resetViewBtn.addEventListener("click", onResetView);
  autoZoomToggle.addEventListener("change", onAutoZoomToggle);

  showMathBtn.addEventListener("click", () => setExplanationMode("math"));
  showStoryBtn.addEventListener("click", () => setExplanationMode("story"));

  canvas.addEventListener("click", onCanvasClick);
  window.addEventListener("resize", render);
}

function init() {
  wireEvents();
  applyAnchor(defaultAnchor, DEFAULT_KAPPA);
  setShifts(0, 0, 0);

  const loaded = applyCasePayloadIfPresent();
  if (!loaded) {
    adjustmentText.textContent = "Click a curve (or E) to open the explanation panel.";
  }

  render();
}

init();
