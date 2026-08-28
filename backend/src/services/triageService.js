/**
 * Orchestration layer: wires together module 2a (AI interpretation),
 * module 2/3 (scoring + confidence), the patient repository, and the
 * audit log, to implement create / manual retriage / auto retriage /
 * override / status update as described in the spec.
 */

const repo = require("./patientRepository");
const auditLog = require("./auditLog");
const { scorePatient, scoreToLevel, LEVEL_LABELS } = require("./scoringEngine");
const { interpretChiefComplaint } = require("./aiInterpretation");

// Cooldown so the 30s background overdue sweep doesn't spam duplicate
// auto-retriage audit entries for a patient that's continuously overdue.
const AUTO_RETRIAGE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Modest score bump applied when a patient has exceeded their safe wait
// threshold, reflecting real deterioration risk from prolonged waiting.
// Additive only — consistent with the project's "never reduce severity
// due to missing/stale data" principle.
const OVERDUE_SCORE_BUMP = 10;

function buildIntake(source) {
  return {
    age: source.age,
    chiefComplaint: source.chiefComplaint,
    consciousness: source.consciousness,
    breathingStatus: source.breathingStatus,
    traumaSeverity: source.traumaSeverity,
    vitals: source.vitals,
    history: source.history,
  };
}

async function createPatient(intakeInput) {
  const aiInterpretation = await interpretChiefComplaint({
    chiefComplaint: intakeInput.chiefComplaint,
    age: intakeInput.age,
    vitals: intakeInput.vitals,
  });

  const scored = scorePatient(buildIntake(intakeInput), aiInterpretation);
  const now = new Date().toISOString();

  const stored = repo.create({
    name: intakeInput.name,
    age: intakeInput.age,
    gender: intakeInput.gender,
    ageGroup: scored.ageGroup,
    chiefComplaint: intakeInput.chiefComplaint,
    consciousness: intakeInput.consciousness,
    breathingStatus: intakeInput.breathingStatus,
    traumaSeverity: intakeInput.traumaSeverity,
    vitals: intakeInput.vitals,
    history: intakeInput.history,
    severityScore: scored.severityScore,
    severityLevel: scored.severityLevel,
    aiRecommendedLevel: scored.severityLevel,
    severityLabel: scored.severityLabel,
    confidence: scored.confidence,
    flags: scored.flags,
    aiInterpretation,
    dataCompleteness: scored.dataCompleteness,
    status: "waiting",
    arrivalTime: now,
    lastAssessedTime: now,
    lastAutoRetriageAt: null,
    isOverridden: false,
    overrideHistory: [],
  });

  return repo.getById(stored.id);
}

/**
 * Re-run the deterministic scoring engine against a patient's current
 * stored intake data + stored AI interpretation (the raw chief complaint
 * doesn't change, so we don't re-call Gemini on every retriage).
 */
function rescoreFromStoredData(rawPatient) {
  return scorePatient(buildIntake(rawPatient), rawPatient.aiInterpretation);
}

function applyOverdueBump(scored, live) {
  if (!live.isOverdue) return scored;
  const bumpedScore = Math.min(100, scored.severityScore + OVERDUE_SCORE_BUMP);
  const bumpedLevel = scoreToLevel(bumpedScore);
  const flags = [
    ...scored.flags,
    {
      id: "wait-time-exceeded",
      label: "Prolonged wait time",
      detail: `Wait time (${live.waitTimeMinutes}m) exceeded the safe threshold (${live.safeWaitThresholdMinutes}m) for the previous level — acuity adjusted upward.`,
      severity: "medium",
    },
  ];
  return { ...scored, severityScore: bumpedScore, severityLevel: bumpedLevel, severityLabel: LEVEL_LABELS[bumpedLevel], flags };
}

/** Manual retriage — GET /api/patients/:id/retriage. Always updates the effective level. */
function manualRetriage(id) {
  const raw = repo.getRaw(id);
  if (!raw) return null;
  const live = repo.getById(id);

  const scored = applyOverdueBump(rescoreFromStoredData(raw), live);
  const previousEffectiveLevel = raw.severityLevel;
  const now = new Date().toISOString();

  const updated = repo.update(id, {
    severityScore: scored.severityScore,
    severityLevel: scored.severityLevel,
    aiRecommendedLevel: scored.severityLevel,
    severityLabel: scored.severityLabel,
    confidence: scored.confidence,
    flags: scored.flags,
    dataCompleteness: scored.dataCompleteness,
    lastAssessedTime: now,
    lastAutoRetriageAt: raw.lastAutoRetriageAt,
    // A manual retriage always resets the effective level to the system's
    // fresh recommendation, so any prior override is superseded.
    isOverridden: false,
  });

  auditLog.addEntry({
    patientId: id,
    patientName: raw.name,
    eventType: "auto-retriage",
    previousLevel: previousEffectiveLevel,
    newLevel: scored.severityLevel,
    reason: "Manually triggered re-triage from current data.",
    clinicianName: null,
  });

  return repo.getById(id);
}

/**
 * Background/on-the-fly sweep: find waiting patients who are overdue and
 * haven't been auto-retriaged recently, and re-triage them, respecting
 * the override-preservation rule.
 */
function runAutoRetriageSweep() {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const results = [];

  for (const raw of repo.getAllRaw()) {
    if (raw.status !== "waiting") continue;
    const live = repo.getById(raw.id);
    if (!live.isOverdue) continue;

    const lastAuto = raw.lastAutoRetriageAt ? new Date(raw.lastAutoRetriageAt).getTime() : null;
    if (lastAuto && now - lastAuto < AUTO_RETRIAGE_COOLDOWN_MS) continue;

    const scored = applyOverdueBump(rescoreFromStoredData(raw), live);

    if (raw.isOverridden) {
      // Preserve clinician authority: only refresh the AI recommendation,
      // leave the effective severityLevel untouched.
      const previousRecommendation = raw.aiRecommendedLevel;
      repo.update(raw.id, {
        aiRecommendedLevel: scored.severityLevel,
        lastAssessedTime: nowIso,
        lastAutoRetriageAt: nowIso,
      });
      const entry = auditLog.addEntry({
        patientId: raw.id,
        patientName: raw.name,
        eventType: "auto-retriage",
        previousLevel: previousRecommendation,
        newLevel: scored.severityLevel,
        reason: "Wait time exceeded safe threshold; re-scored from updated data. Clinician override remains in effect — effective level unchanged; system recommendation updated for comparison.",
        clinicianName: null,
      });
      results.push(entry);
    } else {
      const previousLevel = raw.severityLevel;
      repo.update(raw.id, {
        severityScore: scored.severityScore,
        severityLevel: scored.severityLevel,
        aiRecommendedLevel: scored.severityLevel,
        severityLabel: scored.severityLabel,
        confidence: scored.confidence,
        flags: scored.flags,
        dataCompleteness: scored.dataCompleteness,
        lastAssessedTime: nowIso,
        lastAutoRetriageAt: nowIso,
      });
      const entry = auditLog.addEntry({
        patientId: raw.id,
        patientName: raw.name,
        eventType: "auto-retriage",
        previousLevel,
        newLevel: scored.severityLevel,
        reason: "Wait time exceeded safe threshold; re-scored from updated data.",
        clinicianName: null,
      });
      results.push(entry);
    }
  }

  return results;
}

function overridePatient(id, { newSeverityLevel, reason, clinicianName }) {
  const raw = repo.getRaw(id);
  if (!raw) return null;
  const now = new Date().toISOString();
  const previousLevel = raw.severityLevel;

  const overrideEntry = { timestamp: now, previousLevel, newLevel: newSeverityLevel, reason, clinicianName };

  repo.update(id, {
    severityLevel: newSeverityLevel,
    severityLabel: LEVEL_LABELS[newSeverityLevel],
    isOverridden: true,
    overrideHistory: [...raw.overrideHistory, overrideEntry],
    lastAssessedTime: now,
    // aiRecommendedLevel intentionally left untouched — it always reflects
    // the system's own most recent recommendation.
  });

  auditLog.addEntry({
    patientId: id,
    patientName: raw.name,
    eventType: "override",
    previousLevel,
    newLevel: newSeverityLevel,
    reason,
    clinicianName,
  });

  return repo.getById(id);
}

function updateStatus(id, status) {
  const raw = repo.getRaw(id);
  if (!raw) return null;
  repo.update(id, { status, lastAssessedTime: new Date().toISOString() });
  return repo.getById(id);
}

async function injectSurge(count, seedDataset) {
  const picks = [];
  for (let i = 0; i < count; i++) {
    picks.push(seedDataset[i % seedDataset.length]);
  }
  // Run concurrently — surge is specifically meant to demonstrate the
  // system holding up under simultaneous load, and sequential Gemini
  // calls (up to 4s timeout each) would make that demo painfully slow.
  // Note: createPatient needs name/gender too, so pass the full seed
  // record here rather than the scoring-only buildIntake() projection.
  const injected = await Promise.all(picks.map((seed) => createPatient(seed)));
  return injected;
}

module.exports = {
  createPatient,
  manualRetriage,
  runAutoRetriageSweep,
  overridePatient,
  updateStatus,
  injectSurge,
  rescoreFromStoredData,
  AUTO_RETRIAGE_COOLDOWN_MS,
};
