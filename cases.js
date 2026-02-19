import {
  CASE_STORAGE_KEY,
  HISTORICAL_CASES,
  calibrateCase,
  buildCasePayload
} from "./case-library.js";

const caseGrid = document.getElementById("caseGrid");

function fmtPct(value) {
  const amount = Number(value);
  return `${amount >= 0 ? "+" : ""}${amount.toFixed(2)}%`;
}

function fmtPp(value) {
  const amount = Number(value);
  return `${amount >= 0 ? "+" : ""}${amount.toFixed(2)} pp`;
}

function renderCard(caseDef) {
  const result = calibrateCase(caseDef);

  return `
    <article class="case-card">
      <div class="case-head">
        <h3>${caseDef.title}</h3>
        <span class="case-years">${caseDef.t0} to ${caseDef.t1}</span>
      </div>
      <p class="case-country">${caseDef.country}</p>
      <p class="case-summary">FRED IDs: inflation <code>${caseDef.inflationSeries}</code>, growth <code>${caseDef.growthSeries}</code>${caseDef.contextSeries ? `, context <code>${caseDef.contextSeries}</code>` : ""}</p>
      <ul class="case-notes">
        <li>Anchor (${caseDef.t0}): &pi;0 ${fmtPct(result.pi0)}, g0 ${fmtPct(result.g0)}, s0 = &pi;0 + g0 = ${fmtPct(result.s0)}</li>
        <li>Shock (${caseDef.t1}): &pi;1 ${fmtPct(result.pi1)}, g1 ${fmtPct(result.g1)}, s1 = &pi;1 + g1 = ${fmtPct(result.s1)}</li>
        <li>Chosen DeltaLRAS: ${fmtPp(result.deltaLras)} (kappa ${result.kappa.toFixed(2)})</li>
        <li>Computed DeltaAD: ${fmtPp(result.deltaAd)} from (&pi;1 + g1) - (&pi;0 + g0)</li>
        <li>Computed DeltaSRAS: ${fmtPp(result.deltaSras)} from &pi;1 - &pi;0 - &kappa;(g1 - (g0 + DeltaLRAS))</li>
        <li>Identity errors: s0 ${result.identity.s0IdentityError.toFixed(4)}, s1 ${result.identity.s1IdentityError.toFixed(4)}, DeltaAD ${result.identity.deltaAdIdentityError.toFixed(4)}</li>
      </ul>
      <div class="case-actions">
        <button type="button" class="pill load-case-btn" data-case-id="${caseDef.id}">Load In Simulator</button>
      </div>
    </article>
  `;
}

function bindLoadButtons() {
  document.querySelectorAll(".load-case-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const caseDef = HISTORICAL_CASES.find((item) => item.id === button.dataset.caseId);
      if (!caseDef) return;
      const payload = buildCasePayload(caseDef);
      window.localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(payload));
      window.location.href = "index.html";
    });
  });
}

function renderCases() {
  caseGrid.innerHTML = HISTORICAL_CASES.map(renderCard).join("");
  bindLoadButtons();
}

renderCases();