/**
 * Module 2 + 3 — Age-adjusted scoring engine, and confidence/reasoning engine.
 *
 * Design (see DESIGN_NOTES.md for the full write-up):
 *  1. Red-flag layer runs first and can set a FLOOR on severityLevel
 *     (a minimum acuity). Nothing downstream can make the patient less
 *     severe than a triggered floor — only more severe.
 *  2. Weighted scoring layer computes a 0-100 severityScore from
 *     consciousness/breathing/trauma/vitals/complaint signals.
 *  3. Ambiguity handling floors severityLevel at 3 and reduces confidence.
 *  4. Missing data never counts as "normal" — it simply contributes
 *     nothing to the score, but does reduce dataCompleteness/confidence,
 *     and dataCompleteness itself nudges the score upward (never down),
 *     per the "under-triage is worse than over-triage" project principle.
 *
 * Clinical grounding: score bands and vital classifications are LOOSELY
 * informed by NEWS2 (adult/geriatric), a pediatric early warning score such
 * as PEWS (infant/pediatric), and the Emergency Severity Index's 5-level
 * urgency structure. Numbers are an illustrative simplification for a
 * hackathon prototype — not a validated clinical instrument.
 */

const { getAgeGroup, classifyVitals } = require("./vitalThresholds");
const {
  detectKeywordSignals,
  hasHighRiskPhrase,
  hasStrokeRedFlag,
  isVagueWording,
  hasHighSelfReportedPain,
} = require("./keywordLists");

const LEVEL_LABELS = {
  1: "Critical",
  2: "Emergent",
  3: "Urgent",
  4: "Less Urgent",
  5: "Non-Urgent",
};

// Lower bound of the severityScore range for each level (higher score = more severe).
const LEVEL_MIN_SCORE = { 1: 90, 2: 70, 3: 45, 4: 20, 5: 0 };

const SIGNAL_WEIGHT = {
  respiratory: 14,
  cardiac: 14,
  neurological: 12,
  allergic: 12,
  gi: 7,
  trauma: 8,
  infectious: 7,
  other: 4,
};

function scoreToLevel(score) {
  if (score >= LEVEL_MIN_SCORE[1]) return 1;
  if (score >= LEVEL_MIN_SCORE[2]) return 2;
  if (score >= LEVEL_MIN_SCORE[3]) return 3;
  if (score >= LEVEL_MIN_SCORE[4]) return 4;
  return 5;
}

function applyFloor(score, floorLevel) {
  if (!floorLevel) return score;
  return Math.max(score, LEVEL_MIN_SCORE[floorLevel]);
}

function tightenFloor(currentFloor, candidateFloor) {
  // Lower level number = more severe = "tighter" floor.
  if (!candidateFloor) return currentFloor;
  if (!currentFloor) return candidateFloor;
  return Math.min(currentFloor, candidateFloor);
}

const VITAL_CLASS_POINTS = { critical: 30, concern: 18, mild: 8, normal: 0 };

/**
 * Core scoring function. Pure / deterministic given its inputs, so it can
 * be re-run at any time (manual retriage, auto re-triage, validation report)
 * without side effects.
 *
 * @param {object} intake - the patient's raw intake fields (name/age/gender/
 *   chiefComplaint/consciousness/breathingStatus/traumaSeverity/vitals/history)
 * @param {object} aiInterpretation - result of module 2a (may be the
 *   "unavailable" fallback shape)
 */
function scorePatient(intake, aiInterpretation) {
  const { age, chiefComplaint, consciousness, breathingStatus, traumaSeverity, vitals, history } = intake;

  const ageGroup = getAgeGroup(age);
  const vitalClass = classifyVitals(vitals, ageGroup, age);

  const keywordSignals = detectKeywordSignals(chiefComplaint);
  const aiSignals = (aiInterpretation && aiInterpretation.extractedSignals) || [];
  const combinedSignals = Array.from(new Set([...keywordSignals, ...aiSignals]));

  const flags = [];
  let floorLevel = null; // null = no floor
  let score = 0;

  // ---- Red-flag layer -------------------------------------------------
  if (breathingStatus === "absent") {
    floorLevel = tightenFloor(floorLevel, 1);
    flags.push({ id: "rf-breathing-absent", label: "Absent breathing", detail: "Breathing status recorded as absent — immediate life threat.", severity: "high" });
  }
  if (consciousness === "U") {
    floorLevel = tightenFloor(floorLevel, 1);
    flags.push({ id: "rf-unresponsive", label: "Unresponsive (AVPU: U)", detail: "Patient is unresponsive on the AVPU scale.", severity: "high" });
  } else if (consciousness === "P") {
    floorLevel = tightenFloor(floorLevel, 2);
    flags.push({ id: "rf-pain-only", label: "Responds to pain only (AVPU: P)", detail: "Reduced consciousness — responds to pain only.", severity: "high" });
  }
  if (traumaSeverity === "severe") {
    floorLevel = tightenFloor(floorLevel, 1);
    flags.push({ id: "rf-severe-trauma", label: "Severe trauma", detail: "Trauma severity recorded as severe.", severity: "high" });
  }
  if (vitalClass.spo2 === "critical") {
    floorLevel = tightenFloor(floorLevel, 1);
    flags.push({ id: "rf-spo2-critical", label: "Critical SpO2", detail: `Recorded SpO2 (${vitals && vitals.spo2}%) is at or below the critical threshold for this age band.`, severity: "high" });
  }
  // Infant-specific sepsis-risk red flag: fever >= 38.0C under 3 months is
  // high-severity on its own, independent of other vitals.
  if (ageGroup === "infant" && vitals && vitals.temperature != null && vitals.temperature >= 38.0) {
    floorLevel = tightenFloor(floorLevel, 1);
    flags.push({
      id: "rf-infant-fever",
      label: "Infant fever \u2265 38.0\u00b0C",
      detail: "Fever in an infant under 3 months carries substantially higher sepsis risk than the same fever at an older age — treated as a red flag on its own.",
      severity: "high",
    });
  }
  const criticalVitalCount = Object.values(vitalClass).filter((c) => c === "critical").length;
  if (criticalVitalCount >= 2) {
    floorLevel = tightenFloor(floorLevel, 1);
    flags.push({ id: "rf-multi-critical-vitals", label: "Multiple critical vitals", detail: "Two or more vital signs are in the critical range for this age band.", severity: "high" });
  } else if (criticalVitalCount === 1) {
    floorLevel = tightenFloor(floorLevel, 2);
    flags.push({ id: "rf-single-critical-vital", label: "Critical vital sign", detail: "One vital sign is in the critical range for this age band.", severity: "high" });
  }
  if (hasHighRiskPhrase(chiefComplaint)) {
    floorLevel = tightenFloor(floorLevel, 2);
    flags.push({ id: "rf-high-risk-phrase", label: "High-risk language in chief complaint", detail: "Chief complaint contains wording strongly associated with a life-threatening presentation.", severity: "high" });
  }
  if (hasStrokeRedFlag(chiefComplaint)) {
    floorLevel = tightenFloor(floorLevel, 1);
    flags.push({ id: "rf-stroke-presentation", label: "Stroke-recognition (FAST) presentation", detail: "Chief complaint contains classic sudden focal neurological deficit wording (e.g. face drooping, slurred speech) — time-critical regardless of vitals.", severity: "high" });
  }

  // ---- Ambiguity detection ---------------------------------------------
  const ambiguityReasons = [];
  const criterionA = keywordSignals.length === 0 && isVagueWording(chiefComplaint);
  if (criterionA) ambiguityReasons.push("Chief complaint has no specific symptom keywords and is vague in wording.");

  const noConcerningVitals = Object.values(vitalClass).every((c) => c !== "concern" && c !== "critical");
  const criterionB = hasHighSelfReportedPain(chiefComplaint) && noConcerningVitals;
  if (criterionB) ambiguityReasons.push("Self-reported pain severity does not match recorded vital signs.");

  const criterionC = Boolean(aiInterpretation && aiInterpretation.ambiguityDetected);
  if (criterionC) ambiguityReasons.push("AI intake interpretation flagged this presentation as ambiguous.");

  const ambiguous = criterionA || criterionB || criterionC;
  if (ambiguous) {
    floorLevel = tightenFloor(floorLevel, 3);
    flags.push({
      id: "rf-ambiguous-presentation",
      label: "Ambiguous presentation",
      detail: `Flagged ambiguous — floored at Urgent (3) rather than scored low. Reasons: ${ambiguityReasons.join(" ")}`,
      severity: "medium",
    });
  }

  // ---- Weighted scoring layer -------------------------------------------
  const CONSCIOUSNESS_POINTS = { A: 0, V: 15, P: 35, U: 100 };
  const BREATHING_POINTS = { normal: 0, labored: 28, absent: 100 };
  const TRAUMA_POINTS = { none: 0, minor: 15, severe: 100 };

  score += CONSCIOUSNESS_POINTS[consciousness] || 0;
  score += BREATHING_POINTS[breathingStatus] || 0;
  score += TRAUMA_POINTS[traumaSeverity] || 0;

  for (const vitalName of Object.keys(vitalClass)) {
    const cls = vitalClass[vitalName];
    if (cls && VITAL_CLASS_POINTS[cls]) {
      score += VITAL_CLASS_POINTS[cls];
      if (cls === "concern" || cls === "critical") {
        flags.push({
          id: `vital-${vitalName}-${cls}`,
          label: `${vitalName} in ${cls} range`,
          detail: `${vitalName} classified as "${cls}" for age band "${ageGroup}".`,
          severity: cls === "critical" ? "high" : "medium",
        });
      }
    }
  }

  for (const signal of combinedSignals) {
    score += SIGNAL_WEIGHT[signal] || SIGNAL_WEIGHT.other;
  }
  if (combinedSignals.length > 0) {
    flags.push({
      id: "signals-extracted",
      label: "Symptom category signals detected",
      detail: `Detected signal categories (from keywords and/or AI interpretation): ${combinedSignals.join(", ")}.`,
      severity: "medium",
    });
  }

  if (hasHighRiskPhrase(chiefComplaint)) {
    score += 20;
  }

  score = Math.max(0, Math.min(100, score));

  // ---- Data completeness (also drives an upward-only nudge) -------------
  const vitalFields = ["heartRate", "bpSystolic", "bpDiastolic", "temperature", "spo2", "respRate"];
  const providedVitals = vitalFields.filter((f) => vitals && vitals[f] != null).length;

  const historyFields = ["medicalHistory", "medications", "allergies"];
  const providedHistory = historyFields.filter((f) => history && Array.isArray(history[f]) && history[f].length > 0).length;

  const totalEnrichmentFields = vitalFields.length + historyFields.length; // 9
  const providedEnrichmentFields = providedVitals + providedHistory;
  const completenessRatio = providedEnrichmentFields / totalEnrichmentFields;

  let dataCompleteness;
  if (completenessRatio < 0.34) dataCompleteness = "minimal";
  else if (completenessRatio < 0.75) dataCompleteness = "partial";
  else dataCompleteness = "complete";

  // Never lower the score for missing data — only ever nudge upward, since
  // under-triage from insufficient information is the danger to avoid. A
  // patient with almost no recorded data can't be confirmed low-risk, so
  // the nudge is deliberately large enough to matter (not a token +1-2).
  if (dataCompleteness === "minimal") {
    score = Math.min(100, score + 20);
  }

  // ---- Apply floor(s) ----------------------------------------------------
  score = applyFloor(score, floorLevel);

  const severityLevel = scoreToLevel(score);
  const severityLabel = LEVEL_LABELS[severityLevel];

  // ---- Confidence ---------------------------------------------------------
  let confidenceScore = 100;
  const confidenceReasons = [];

  const missingVitals = vitalFields.length - providedVitals;
  if (missingVitals > 0) {
    confidenceScore -= missingVitals * 6;
    confidenceReasons.push(`${providedVitals} of ${vitalFields.length} vital signs recorded.`);
  }
  const missingHistory = historyFields.length - providedHistory;
  if (missingHistory > 0) {
    confidenceScore -= missingHistory * 4;
    confidenceReasons.push(`${providedHistory} of ${historyFields.length} history categories recorded.`);
  }
  if (ambiguous) {
    confidenceScore -= 15;
    confidenceReasons.push("Ambiguous presentation reduces confidence in the recommendation.");
  }
  if (!aiInterpretation || aiInterpretation.available === false) {
    confidenceScore -= 8;
    confidenceReasons.push("AI intake interpretation unavailable — using keyword-only fallback.");
  }
  if (criterionB) {
    confidenceScore -= 10;
    confidenceReasons.push("Conflicting signal: reported pain intensity does not match recorded vitals.");
  }
  if (confidenceReasons.length === 0) {
    confidenceReasons.push("Data set is reasonably complete with no conflicting signals detected.");
  }

  confidenceScore = Math.max(0, Math.min(100, confidenceScore));
  let confidenceLevel;
  if (confidenceScore >= 75) confidenceLevel = "high";
  else if (confidenceScore >= 45) confidenceLevel = "medium";
  else confidenceLevel = "low";

  return {
    ageGroup,
    severityScore: score,
    severityLevel,
    severityLabel,
    confidence: { level: confidenceLevel, score: confidenceScore, reasons: confidenceReasons },
    flags,
    dataCompleteness,
    combinedSignals,
    ambiguous,
  };
}

module.exports = { scorePatient, scoreToLevel, applyFloor, LEVEL_LABELS, LEVEL_MIN_SCORE };
