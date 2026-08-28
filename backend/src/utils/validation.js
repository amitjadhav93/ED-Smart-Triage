const CONSCIOUSNESS_VALUES = ["A", "V", "P", "U"];
const BREATHING_VALUES = ["normal", "labored", "absent"];
const TRAUMA_VALUES = ["none", "minor", "severe"];
const STATUS_VALUES = ["in-treatment", "discharged"];

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function isNullableFiniteNumber(v) {
  return v == null || isFiniteNumber(v);
}

function isStringArray(v) {
  return Array.isArray(v) && v.every((item) => typeof item === "string");
}

/**
 * Validates the body of POST /api/patients.
 * Returns { valid: true, value: <cleaned intake object> } or
 * { valid: false, code, message }.
 */
function validatePatientIntake(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, code: "INVALID_BODY", message: "Request body must be a JSON object." };
  }

  const { name, age, gender, chiefComplaint, consciousness, breathingStatus, traumaSeverity, vitals, history } = body;

  if (!isNonEmptyString(name)) {
    return { valid: false, code: "MISSING_NAME", message: "'name' is required and must be a non-empty string." };
  }
  if (!isFiniteNumber(age) || age < 0 || age > 130) {
    return { valid: false, code: "INVALID_AGE", message: "'age' is required and must be a realistic number of years." };
  }
  if (!isNonEmptyString(gender)) {
    return { valid: false, code: "MISSING_GENDER", message: "'gender' is required and must be a non-empty string." };
  }
  if (!isNonEmptyString(chiefComplaint)) {
    return { valid: false, code: "MISSING_CHIEF_COMPLAINT", message: "'chiefComplaint' is required and must be a non-empty string." };
  }
  if (!CONSCIOUSNESS_VALUES.includes(consciousness)) {
    return { valid: false, code: "INVALID_CONSCIOUSNESS", message: `'consciousness' must be one of ${CONSCIOUSNESS_VALUES.join(", ")}.` };
  }
  if (!BREATHING_VALUES.includes(breathingStatus)) {
    return { valid: false, code: "INVALID_BREATHING_STATUS", message: `'breathingStatus' must be one of ${BREATHING_VALUES.join(", ")}.` };
  }
  if (!TRAUMA_VALUES.includes(traumaSeverity)) {
    return { valid: false, code: "INVALID_TRAUMA_SEVERITY", message: `'traumaSeverity' must be one of ${TRAUMA_VALUES.join(", ")}.` };
  }

  const cleanVitals = { heartRate: null, bpSystolic: null, bpDiastolic: null, temperature: null, spo2: null, respRate: null };
  if (vitals != null) {
    if (typeof vitals !== "object") {
      return { valid: false, code: "INVALID_VITALS", message: "'vitals' must be an object if provided." };
    }
    for (const key of Object.keys(cleanVitals)) {
      if (vitals[key] !== undefined) {
        if (!isNullableFiniteNumber(vitals[key])) {
          return { valid: false, code: "INVALID_VITALS", message: `'vitals.${key}' must be a number or null.` };
        }
        cleanVitals[key] = vitals[key] == null ? null : vitals[key];
      }
    }
  }

  const cleanHistory = { medicalHistory: [], medications: [], allergies: [] };
  if (history != null) {
    if (typeof history !== "object") {
      return { valid: false, code: "INVALID_HISTORY", message: "'history' must be an object if provided." };
    }
    for (const key of Object.keys(cleanHistory)) {
      if (history[key] !== undefined) {
        if (!isStringArray(history[key])) {
          return { valid: false, code: "INVALID_HISTORY", message: `'history.${key}' must be an array of strings.` };
        }
        cleanHistory[key] = history[key];
      }
    }
  }

  return {
    valid: true,
    value: {
      name: name.trim(),
      age,
      gender: gender.trim(),
      chiefComplaint: chiefComplaint.trim(),
      consciousness,
      breathingStatus,
      traumaSeverity,
      vitals: cleanVitals,
      history: cleanHistory,
    },
  };
}

function validateOverride(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, code: "INVALID_BODY", message: "Request body must be a JSON object." };
  }
  const { newSeverityLevel, reason, clinicianName } = body;
  if (!Number.isInteger(newSeverityLevel) || newSeverityLevel < 1 || newSeverityLevel > 5) {
    return { valid: false, code: "INVALID_SEVERITY_LEVEL", message: "'newSeverityLevel' must be an integer from 1 to 5." };
  }
  if (!isNonEmptyString(reason)) {
    return { valid: false, code: "MISSING_REASON", message: "'reason' is required and must be a non-empty string." };
  }
  if (!isNonEmptyString(clinicianName)) {
    return { valid: false, code: "MISSING_CLINICIAN_NAME", message: "'clinicianName' is required and must be a non-empty string." };
  }
  return { valid: true, value: { newSeverityLevel, reason: reason.trim(), clinicianName: clinicianName.trim() } };
}

function validateStatusUpdate(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, code: "INVALID_BODY", message: "Request body must be a JSON object." };
  }
  const { status } = body;
  if (!STATUS_VALUES.includes(status)) {
    return { valid: false, code: "INVALID_STATUS", message: `'status' must be one of ${STATUS_VALUES.join(", ")}.` };
  }
  return { valid: true, value: { status } };
}

function validateSurge(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, code: "INVALID_BODY", message: "Request body must be a JSON object." };
  }
  const { count } = body;
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    return { valid: false, code: "INVALID_COUNT", message: "'count' must be an integer between 1 and 500." };
  }
  return { valid: true, value: { count } };
}

module.exports = {
  validatePatientIntake,
  validateOverride,
  validateStatusUpdate,
  validateSurge,
  CONSCIOUSNESS_VALUES,
  BREATHING_VALUES,
  TRAUMA_VALUES,
  STATUS_VALUES,
};
