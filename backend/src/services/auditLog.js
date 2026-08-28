/**
 * Module 5 (part) — append-only, immutable audit log.
 * In-memory for this prototype, behind a small service layer so a real
 * DB-backed implementation (e.g. an insert-only table) could swap in later
 * without changing callers.
 */

const { randomUUID } = require("crypto");

const auditEntries = []; // newest entries pushed to the end; never spliced/mutated in place

function addEntry({ patientId, patientName, eventType, previousLevel, newLevel, reason, clinicianName }) {
  const entry = Object.freeze({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    patientId,
    patientName,
    eventType, // "override" | "auto-retriage"
    previousLevel,
    newLevel,
    reason,
    clinicianName: clinicianName || null,
  });
  auditEntries.push(entry);
  return entry;
}

function getAllNewestFirst() {
  // Return a shallow copy, newest first — never expose the live array for mutation.
  return [...auditEntries].reverse();
}

module.exports = { addEntry, getAllNewestFirst };
