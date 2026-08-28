/**
 * Age-banded vital sign threshold tables.
 *
 * These numbers are a SIMPLIFIED, ILLUSTRATIVE PROTOTYPE CALIBRATION.
 * They are loosely based on (not a reproduction of, and not validated against):
 *   - NEWS2 (National Early Warning Score 2) — adult/geriatric vital sign
 *     scoring bands (RCP London, 2017 update).
 *   - A pediatric early warning score such as PEWS — for infant/pediatric
 *     age-differentiated HR/RR ranges.
 *   - The Emergency Severity Index (ESI) — for the general 5-level
 *     urgency structure and the idea that certain findings force an
 *     immediate top-acuity level regardless of other factors.
 *
 * Exact cut points here are invented for demo purposes and must NOT be
 * used for real clinical decisions without proper calibration and
 * clinician review. See DESIGN_NOTES.md for the full disclaimer.
 *
 * Each classifier returns one of: "normal" | "mild" | "concern" | "critical" | null
 * (null means the value wasn't provided, i.e. genuinely missing — never
 * treated as "normal").
 */

function classifyRange(value, ranges) {
  // ranges = { criticalLow, concernLow, mildLow, mildHigh, concernHigh, criticalHigh }
  if (value == null) return null;
  const { criticalLow, concernLow, mildLow, mildHigh, concernHigh, criticalHigh } = ranges;
  if (criticalLow != null && value <= criticalLow) return "critical";
  if (criticalHigh != null && value >= criticalHigh) return "critical";
  if (concernLow != null && value <= concernLow) return "concern";
  if (concernHigh != null && value >= concernHigh) return "concern";
  if (mildLow != null && value <= mildLow) return "mild";
  if (mildHigh != null && value >= mildHigh) return "mild";
  return "normal";
}

/** Age band resolution. */
function getAgeGroup(age) {
  if (age == null || Number.isNaN(age)) return "adult"; // safest generic default; age is a required field anyway
  if (age < 0.25) return "infant"; // under 3 months
  if (age < 12) return "pediatric"; // 0.25 - 11 years
  if (age < 65) return "adult"; // 12 - 64
  return "geriatric"; // 65+
}

// Sub-bands used only internally for pediatric HR/RR granularity (PEWS-style),
// collapsed back into the single "pediatric" ageGroup exposed on the patient.
function getPediatricSubBand(age) {
  return age < 2 ? "toddler" : "child";
}

const THRESHOLDS = {
  infant: {
    heartRate: { criticalLow: 80, concernLow: 90, mildLow: 100, mildHigh: 160, concernHigh: 180, criticalHigh: 200 },
    respRate: { criticalLow: 20, concernLow: 25, mildLow: 30, mildHigh: 60, concernHigh: 70, criticalHigh: 80 },
    spo2: { criticalLow: 90, concernLow: 94, mildLow: 96 },
    bpSystolic: { criticalLow: 50, concernLow: 60 }, // rarely used directly for infants; low weight
    temperature: { criticalLow: 35.0, concernHigh: 38.0, criticalHigh: 39.0 }, // note: >=38.0 is handled as an explicit red flag separately
  },
  pediatric: {
    toddler: {
      heartRate: { criticalLow: 70, concernLow: 90, mildLow: 100, mildHigh: 150, concernHigh: 170, criticalHigh: 190 },
      respRate: { criticalLow: 15, concernLow: 20, mildLow: 24, mildHigh: 40, concernHigh: 50, criticalHigh: 60 },
      spo2: { criticalLow: 90, concernLow: 93, mildLow: 95 },
      bpSystolic: { criticalLow: 70, concernLow: 80 },
      temperature: { criticalLow: 35.0, mildHigh: 38.0, concernHigh: 39.5, criticalHigh: 40.5 },
    },
    child: {
      heartRate: { criticalLow: 55, concernLow: 65, mildLow: 70, mildHigh: 120, concernHigh: 140, criticalHigh: 160 },
      respRate: { criticalLow: 12, concernLow: 15, mildLow: 18, mildHigh: 30, concernHigh: 36, criticalHigh: 44 },
      spo2: { criticalLow: 90, concernLow: 93, mildLow: 95 },
      bpSystolic: { criticalLow: 75, concernLow: 85 },
      temperature: { criticalLow: 35.0, mildHigh: 38.0, concernHigh: 39.5, criticalHigh: 40.5 },
    },
  },
  adult: {
    heartRate: { criticalLow: 40, concernLow: 45, mildLow: 51, mildHigh: 90, concernHigh: 111, criticalHigh: 131 },
    respRate: { criticalLow: 8, concernLow: 9, mildLow: 12, mildHigh: 20, concernHigh: 21, criticalHigh: 25 },
    spo2: { criticalLow: 91, concernLow: 93, mildLow: 95 },
    bpSystolic: { criticalLow: 90, concernLow: 100, mildLow: 110, mildHigh: 220 },
    temperature: { criticalLow: 35.0, mildLow: 36.0, mildHigh: 38.0, concernHigh: 39.1 },
  },
  geriatric: {
    // Slightly tighter tolerances than adult: same-magnitude deviations
    // carry more clinical weight (lower physiological reserve, higher
    // comorbidity risk), loosely per NEWS2's general caution for older adults.
    heartRate: { criticalLow: 45, concernLow: 50, mildLow: 55, mildHigh: 85, concernHigh: 105, criticalHigh: 125 },
    respRate: { criticalLow: 9, concernLow: 10, mildLow: 12, mildHigh: 19, concernHigh: 21, criticalHigh: 24 },
    spo2: { criticalLow: 92, concernLow: 94, mildLow: 96 },
    bpSystolic: { criticalLow: 95, concernLow: 105, mildLow: 115, mildHigh: 200 },
    temperature: { criticalLow: 35.5, mildLow: 36.0, mildHigh: 37.8, concernHigh: 38.8 },
  },
};

function getThresholdTable(ageGroup, age) {
  if (ageGroup === "pediatric") {
    return THRESHOLDS.pediatric[getPediatricSubBand(age)];
  }
  return THRESHOLDS[ageGroup];
}

/**
 * Classify every provided vital for the patient's age band.
 * Returns { heartRate: "normal"|"mild"|"concern"|"critical"|null, ... }
 */
function classifyVitals(vitals, ageGroup, age) {
  const table = getThresholdTable(ageGroup, age);
  const v = vitals || {};
  return {
    heartRate: classifyRange(v.heartRate, table.heartRate),
    respRate: classifyRange(v.respRate, table.respRate),
    spo2: classifyRange(v.spo2, table.spo2),
    bpSystolic: classifyRange(v.bpSystolic, table.bpSystolic),
    temperature: classifyRange(v.temperature, table.temperature),
  };
}

module.exports = { getAgeGroup, getPediatricSubBand, classifyVitals, getThresholdTable, THRESHOLDS };
