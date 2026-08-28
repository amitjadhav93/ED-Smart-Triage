/**
 * In-memory patient repository.
 *
 * Deliberately kept behind this small module so a real database could be
 * substituted later (swap the function bodies for real queries) without
 * touching routes or the scoring/queue engines, which only ever talk to
 * this repository's interface.
 */

const { randomUUID } = require("crypto");

const patients = new Map(); // id -> patient object (source of truth, includes derived-at-write-time fields)

const SAFE_WAIT_THRESHOLD_MINUTES = { 1: 0, 2: 10, 3: 30, 4: 60, 5: 120 };

function safeWaitThresholdFor(level) {
  return SAFE_WAIT_THRESHOLD_MINUTES[level] ?? 60;
}

function create(patient) {
  const id = patient.id || randomUUID();
  const record = { ...patient, id };
  patients.set(id, record);
  return record;
}

function getRaw(id) {
  return patients.get(id) || null;
}

function getAllRaw() {
  return Array.from(patients.values());
}

function update(id, patch) {
  const existing = patients.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  patients.set(id, updated);
  return updated;
}

/**
 * Compute the live, read-time-derived fields (waitTimeMinutes, isOverdue)
 * on top of a stored patient record, without mutating the stored record.
 */
function withLiveFields(patient) {
  const arrival = new Date(patient.arrivalTime).getTime();
  const now = Date.now();
  const waitTimeMinutes = Math.max(0, Math.round((now - arrival) / 60000));
  const safeWaitThresholdMinutes = safeWaitThresholdFor(patient.severityLevel);
  const isOverdue = patient.status === "waiting" && waitTimeMinutes > safeWaitThresholdMinutes;
  return { ...patient, waitTimeMinutes, safeWaitThresholdMinutes, isOverdue };
}

function getById(id) {
  const raw = getRaw(id);
  return raw ? withLiveFields(raw) : null;
}

function getAll() {
  return getAllRaw().map(withLiveFields);
}

function getWaiting() {
  return getAll().filter((p) => p.status === "waiting");
}

module.exports = {
  create,
  getRaw,
  getAllRaw,
  update,
  getById,
  getAll,
  getWaiting,
  withLiveFields,
  safeWaitThresholdFor,
  SAFE_WAIT_THRESHOLD_MINUTES,
};
