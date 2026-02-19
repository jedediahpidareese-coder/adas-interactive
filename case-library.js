export const CASE_STORAGE_KEY = "adasCaseSelection";
export const DEFAULT_KAPPA = 1.0;

function n(value) {
  return Number(value);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(n(value) * factor) / factor;
}

function withSign(value, digits = 2) {
  const amount = n(value);
  return `${amount >= 0 ? "+" : ""}${amount.toFixed(digits)}`;
}

export const HISTORICAL_CASES = [
  {
    id: "oil-shock-1",
    title: "First Oil Shock",
    country: "United States",
    t0: 1973,
    t1: 1974,
    pi0: 6.18,
    g0: 5.65,
    pi1: 11.05,
    g1: -0.54,
    deltaLras: -3.0,
    kappa: DEFAULT_KAPPA,
    inflationSeries: "FPCPITOTLZGUSA",
    growthSeries: "USAGDPPRAPSMEI"
  },
  {
    id: "oil-shock-2",
    title: "Second Oil Shock",
    country: "United States",
    t0: 1978,
    t1: 1980,
    pi0: 7.63,
    g0: 5.54,
    pi1: 13.55,
    g1: -0.26,
    deltaLras: -2.5,
    kappa: DEFAULT_KAPPA,
    inflationSeries: "FPCPITOTLZGUSA",
    growthSeries: "USAGDPPRAPSMEI",
    contextSeries: "CPIAUCSL"
  },
  {
    id: "housing-crisis",
    title: "Housing & Financial Crisis",
    country: "United States",
    t0: 2006,
    t1: 2009,
    pi0: 3.23,
    g0: 2.78,
    pi1: -0.36,
    g1: -2.58,
    deltaLras: -1.5,
    kappa: DEFAULT_KAPPA,
    inflationSeries: "FPCPITOTLZGUSA",
    growthSeries: "USAGDPPRAPSMEI"
  },
  {
    id: "war-energy-shock",
    title: "War-Driven Energy Shock",
    country: "United States",
    t0: 1989,
    t1: 1991,
    pi0: 4.83,
    g0: 3.67,
    pi1: 4.23,
    g1: -0.11,
    deltaLras: -0.8,
    kappa: DEFAULT_KAPPA,
    inflationSeries: "FPCPITOTLZGUSA",
    growthSeries: "USAGDPPRAPSMEI"
  },
  {
    id: "covid-2020",
    title: "COVID-19 Initial Shock",
    country: "US / Global",
    t0: 2019,
    t1: 2020,
    pi0: 1.81,
    g0: 2.58,
    pi1: 1.23,
    g1: -2.08,
    deltaLras: -1.2,
    kappa: DEFAULT_KAPPA,
    inflationSeries: "FPCPITOTLZGUSA",
    growthSeries: "USAGDPPRAPSMEI"
  },
  {
    id: "tohoku-2011",
    title: "Tohoku Earthquake & Tsunami",
    country: "Japan",
    t0: 2010,
    t1: 2011,
    pi0: -0.73,
    g0: 4.14,
    pi1: -0.27,
    g1: -0.2,
    deltaLras: -1.8,
    kappa: DEFAULT_KAPPA,
    inflationSeries: "FPCPITOTLZGJPN",
    growthSeries: "JPNGDPPRAPSMEI"
  },
  {
    id: "japan-bubble-burst",
    title: "Japan Bubble Burst (Aftermath)",
    country: "Japan",
    t0: 1996,
    t1: 1998,
    pi0: 0.14,
    g0: 3.08,
    pi1: 0.66,
    g1: -1.77,
    deltaLras: -2.5,
    kappa: DEFAULT_KAPPA,
    inflationSeries: "FPCPITOTLZGJPN",
    growthSeries: "JPNGDPPRAPSMEI"
  }
];

export function getCaseById(caseId) {
  return HISTORICAL_CASES.find((item) => item.id === caseId) || null;
}

export function anchorFromCase(caseDef) {
  const pi0 = n(caseDef.pi0);
  const g0 = n(caseDef.g0);
  return {
    label: `${caseDef.title} anchor (${caseDef.t0})`,
    pi0,
    g0,
    s0: pi0 + g0,
    piE0: pi0,
    gStar0: g0
  };
}

export function calibrateCase(caseDef, options = {}) {
  const pi0 = n(caseDef.pi0);
  const g0 = n(caseDef.g0);
  const pi1 = n(caseDef.pi1);
  const g1 = n(caseDef.g1);
  const kappa = n(options.kappa ?? caseDef.kappa ?? DEFAULT_KAPPA);
  const deltaLras = n(options.deltaLras ?? caseDef.deltaLras ?? 0);

  const s0 = pi0 + g0;
  const s1 = pi1 + g1;
  const deltaAd = s1 - s0;

  const gStar1 = g0 + deltaLras;
  const deltaSras = pi1 - pi0 - kappa * (g1 - gStar1);

  const identity = {
    s0IdentityError: s0 - (pi0 + g0),
    s1IdentityError: s1 - (pi1 + g1),
    deltaAdIdentityError: deltaAd - ((pi1 + g1) - (pi0 + g0))
  };

  return {
    pi0,
    g0,
    pi1,
    g1,
    s0,
    s1,
    deltaAd,
    deltaSras,
    deltaLras,
    gStar1,
    kappa,
    identity,
    rounded: {
      s0: round(s0),
      s1: round(s1),
      deltaAd: round(deltaAd),
      deltaSras: round(deltaSras),
      deltaLras: round(deltaLras),
      gStar1: round(gStar1),
      kappa: round(kappa),
      identity: {
        s0IdentityError: round(identity.s0IdentityError, 4),
        s1IdentityError: round(identity.s1IdentityError, 4),
        deltaAdIdentityError: round(identity.deltaAdIdentityError, 4)
      }
    }
  };
}

export function buildCasePayload(caseDef, options = {}) {
  const calibration = calibrateCase(caseDef, options);
  const anchor = anchorFromCase(caseDef);

  return {
    source: "historical-case",
    caseId: caseDef.id,
    title: caseDef.title,
    country: caseDef.country,
    t0: caseDef.t0,
    t1: caseDef.t1,
    pi0: calibration.pi0,
    g0: calibration.g0,
    pi1: calibration.pi1,
    g1: calibration.g1,
    anchor,
    shifts: {
      ad: calibration.deltaAd,
      sras: calibration.deltaSras,
      lras: calibration.deltaLras
    },
    kappa: calibration.kappa,
    identity: calibration.identity,
    fred: {
      inflation: caseDef.inflationSeries,
      growth: caseDef.growthSeries,
      context: caseDef.contextSeries || null
    },
    note: `${caseDef.title} (${caseDef.t1}) loaded with data-pinned DeltaAD and implied DeltaSRAS.`,
    prompt: "Historical case loaded. Compare observed data with model-implied curve shifts.",
    explanation:
      `Anchor ${caseDef.t0}: ﾏ0 ${withSign(calibration.pi0)}%, g0 ${withSign(calibration.g0)}%, s0 ${withSign(calibration.s0)}%. ` +
      `Shock ${caseDef.t1}: ﾏ1 ${withSign(calibration.pi1)}%, g1 ${withSign(calibration.g1)}%, s1 ${withSign(calibration.s1)}%. ` +
      `Shifts: DeltaAD ${withSign(calibration.deltaAd)} pp, DeltaLRAS ${withSign(calibration.deltaLras)} pp, ` +
      `DeltaSRAS ${withSign(calibration.deltaSras)} pp (kappa ${calibration.kappa.toFixed(2)}).`
  };
}
