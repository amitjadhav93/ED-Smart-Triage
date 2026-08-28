/**
 * Module 2a — AI intake interpretation (Gemini).
 *
 * Turns messy free-text chief complaints into structured signals that feed
 * INTO the deterministic scoring engine as an additional input — this
 * module never sets severityLevel or severityScore itself. If the API key
 * is missing, the call errors, times out, or the response isn't valid JSON
 * matching the expected shape, we fail soft: return an "unavailable" result
 * so triage can proceed on keyword-only logic (module 2's own red-flag /
 * symptom keyword checks always run regardless of this module's outcome).
 */

const EXTRACTED_SIGNAL_VALUES = [
  "respiratory",
  "cardiac",
  "neurological",
  "allergic",
  "gi",
  "trauma",
  "infectious",
  "other",
];

const TIMEOUT_MS = 4000;
const MODEL_NAME = "gemini-1.5-flash";

function unavailableResult() {
  return {
    available: false,
    extractedSignals: [],
    ambiguityDetected: false,
    missingFieldSuggestions: [],
    narrative: "",
  };
}

function buildPrompt({ chiefComplaint, age, vitals }) {
  const vitalsSummary = vitals
    ? Object.entries(vitals)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ") || "none recorded"
    : "none recorded";

  return `You are a clinical intake text interpreter for an Emergency Department triage prototype.
You do NOT decide severity or triage level. You only extract structured signals from free text.

Patient age (years): ${age}
Recorded vitals: ${vitalsSummary}
Chief complaint (raw, patient/caregiver words): "${chiefComplaint}"

Return ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{
  "extractedSignals": ["respiratory"|"cardiac"|"neurological"|"allergic"|"gi"|"trauma"|"infectious"|"other", ...],
  "ambiguityDetected": true|false,
  "missingFieldSuggestions": ["short string", ...],
  "narrative": "one short plain-language clinical summary sentence"
}

Rules:
- extractedSignals: only include categories genuinely suggested by the text; may be empty array.
- ambiguityDetected: true if the complaint is vague, non-specific, or hard to map to a clear symptom category.
- missingFieldSuggestions: short suggestions of what additional info would help (e.g. "ask about onset time"), display-only.
- narrative: one short sentence, plain language, no diagnosis, no treatment advice.
- Output must be a single JSON object and nothing else.`;
}

function isValidShape(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (!Array.isArray(obj.extractedSignals)) return false;
  if (!obj.extractedSignals.every((s) => EXTRACTED_SIGNAL_VALUES.includes(s))) return false;
  if (typeof obj.ambiguityDetected !== "boolean") return false;
  if (!Array.isArray(obj.missingFieldSuggestions)) return false;
  if (!obj.missingFieldSuggestions.every((s) => typeof s === "string")) return false;
  if (typeof obj.narrative !== "string") return false;
  return true;
}

function parseModelText(text) {
  if (!text) return null;
  // Strip common markdown code-fence wrapping defensively, in case the model
  // doesn't perfectly follow the "no fences" instruction.
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (isValidShape(parsed)) return parsed;
    return null;
  } catch (e) {
    return null;
  }
}

async function withTimeout(promise, ms) {
  let timeoutHandle;
  const timeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error("AI_TIMEOUT")), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timeoutHandle);
    return result;
  } catch (err) {
    clearTimeout(timeoutHandle);
    throw err;
  }
}

/**
 * Interpret a patient's raw chief complaint via Gemini.
 * Always resolves (never rejects) — failures resolve to an "unavailable" result.
 */
async function interpretChiefComplaint({ chiefComplaint, age, vitals }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return unavailableResult();
  }

  try {
    // Lazy-require so the app still boots fine if the package isn't installed yet.
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = buildPrompt({ chiefComplaint, age, vitals });
    const result = await withTimeout(model.generateContent(prompt), TIMEOUT_MS);
    const text = result?.response?.text ? result.response.text() : null;
    const parsed = parseModelText(text);

    if (!parsed) {
      return unavailableResult();
    }

    return {
      available: true,
      extractedSignals: parsed.extractedSignals,
      ambiguityDetected: parsed.ambiguityDetected,
      missingFieldSuggestions: parsed.missingFieldSuggestions,
      narrative: parsed.narrative,
    };
  } catch (err) {
    // Any failure (missing package, network error, timeout, bad response) —
    // fall back gracefully. Triage must never block on this call.
    return unavailableResult();
  }
}

module.exports = { interpretChiefComplaint, unavailableResult, EXTRACTED_SIGNAL_VALUES };
