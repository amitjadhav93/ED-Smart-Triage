export const SEVERITY_LEVELS = [
  { level: 1, label: "Critical", key: "sev-1" },
  { level: 2, label: "Emergent", key: "sev-2" },
  { level: 3, label: "Urgent", key: "sev-3" },
  { level: 4, label: "Less Urgent", key: "sev-4" },
  { level: 5, label: "Non-Urgent", key: "sev-5" },
];

export function severityMeta(level) {
  return (
    SEVERITY_LEVELS.find((s) => s.level === Number(level)) || {
      level,
      label: "Unknown",
      key: "sev-3",
    }
  );
}

export const CONSCIOUSNESS_OPTIONS = [
  { value: "A", label: "A — Alert" },
  { value: "V", label: "V — Responds to Voice" },
  { value: "P", label: "P — Responds to Pain" },
  { value: "U", label: "U — Unresponsive" },
];

export const BREATHING_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "labored", label: "Labored" },
  { value: "absent", label: "Absent" },
];

export const TRAUMA_OPTIONS = [
  { value: "none", label: "None" },
  { value: "minor", label: "Minor" },
  { value: "severe", label: "Severe" },
];

export const STATUS_OPTIONS = [
  { value: "in-treatment", label: "Mark In-Treatment" },
  { value: "discharged", label: "Mark Discharged" },
];
