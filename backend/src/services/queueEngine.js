/**
 * Module 4 — Queue engine.
 *
 * Sorting and overdue detection operate on the "effective" severityLevel
 * (i.e. the clinician-overridden level when one is in effect, otherwise
 * the AI-recommended level — patientRepository stores severityLevel as
 * exactly that effective value per the override rules in module 5).
 */

const repo = require("./patientRepository");

/**
 * Sort waiting patients by effective severity level ascending (1 = most
 * critical first), then by waitTimeMinutes descending within the same level.
 */
function sortQueue(patients) {
  return [...patients].sort((a, b) => {
    if (a.severityLevel !== b.severityLevel) return a.severityLevel - b.severityLevel;
    return b.waitTimeMinutes - a.waitTimeMinutes;
  });
}

function getSortedWaitingQueue() {
  return sortQueue(repo.getWaiting());
}

function getStats() {
  const waiting = repo.getWaiting();
  const totalWaiting = waiting.length;
  const avgWaitMinutes =
    totalWaiting === 0 ? 0 : Math.round((waiting.reduce((sum, p) => sum + p.waitTimeMinutes, 0) / totalWaiting) * 10) / 10;
  const overdueCount = waiting.filter((p) => p.isOverdue).length;
  const byLevel = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const p of waiting) {
    byLevel[String(p.severityLevel)] = (byLevel[String(p.severityLevel)] || 0) + 1;
  }
  return { totalWaiting, avgWaitMinutes, overdueCount, byLevel };
}

module.exports = { sortQueue, getSortedWaitingQueue, getStats };
