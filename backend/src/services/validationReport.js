/**
 * Module 8 — self-validation report.
 *
 * Runs the deterministic scoring engine fresh against every seed record's
 * RAW inputs (never against live/overridden queue state) and compares the
 * computed severityLevel to that record's hand-labeled expectedSeverityLevel.
 *
 * The AI interpretation step is intentionally NOT re-invoked here (we score
 * against the "unavailable" fallback shape) so this report is deterministic,
 * fast, and reproducible without depending on a live Gemini call or network
 * access — see DESIGN_NOTES.md for why that's a reasonable limitation for a
 * self-validation tool rather than a live triage decision.
 */

const { seedDataset } = require("../data/seedData");
const { scorePatient } = require("./scoringEngine");
const { unavailableResult } = require("./aiInterpretation");

function buildIntake(record) {
  return {
    age: record.age,
    chiefComplaint: record.chiefComplaint,
    consciousness: record.consciousness,
    breathingStatus: record.breathingStatus,
    traumaSeverity: record.traumaSeverity,
    vitals: record.vitals,
    history: record.history,
  };
}

function generateValidationReport() {
  const aiFallback = unavailableResult();
  const cases = seedDataset.map((record) => {
    const scored = scorePatient(buildIntake(record), aiFallback);
    const computedSeverityLevel = scored.severityLevel;
    const expected = record.expectedSeverityLevel;

    let outcome;
    if (computedSeverityLevel === expected) outcome = "match";
    else if (computedSeverityLevel < expected) outcome = "over-triage"; // computed MORE severe (lower number) than expected
    else outcome = "under-triage"; // computed LESS severe (higher number) than expected

    return {
      id: record.id,
      name: record.name,
      expectedSeverityLevel: expected,
      computedSeverityLevel,
      outcome,
    };
  });

  const totalCases = cases.length;
  const exactAgreement = cases.filter((c) => c.outcome === "match").length;
  const overTriageCount = cases.filter((c) => c.outcome === "over-triage").length;
  const underTriageCount = cases.filter((c) => c.outcome === "under-triage").length;
  const agreementPct = totalCases === 0 ? 0 : Math.round((exactAgreement / totalCases) * 1000) / 10;

  return { totalCases, exactAgreement, agreementPct, overTriageCount, underTriageCount, cases };
}

module.exports = { generateValidationReport };
