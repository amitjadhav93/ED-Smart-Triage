/**
 * Keyword lists used by the deterministic scoring engine.
 *
 * These run REGARDLESS of whether the Gemini call (module 2a) succeeded —
 * they are the baseline, always-available symptom/red-flag detector that
 * the AI-extracted signals are layered on top of, never a replacement for.
 */

// category -> keywords that, if found in the chief complaint (case-insensitive
// substring match), suggest that category. Mirrors the categories Gemini is
// asked to extract, so both sources merge into the same signal set.
const CATEGORY_KEYWORDS = {
  respiratory: [
    "can't breathe", "cant breathe", "difficulty breathing", "shortness of breath",
    "short of breath", "breathless", "wheezing", "gasping", "choking",
  ],
  cardiac: [
    "chest pain", "chest pressure", "chest tightness", "heart racing",
    "palpitations", "chest feels weird", "pain radiating", "left arm pain",
  ],
  neurological: [
    "confused", "confusion", "slurred speech", "face drooping", "facial droop",
    "one-sided weakness", "seizure", "seizing", "can't speak", "cant speak",
    "worst headache", "sudden weakness", "fainted", "passed out", "dizzy", "woozy",
  ],
  allergic: [
    "allergic reaction", "swelling of the face", "throat swelling", "hives",
    "anaphylaxis", "can't swallow", "cant swallow", "tongue swelling",
  ],
  gi: [
    "abdominal pain", "stomach pain", "vomiting blood", "blood in stool",
    "severe diarrhea", "can't keep anything down", "cant keep anything down",
  ],
  trauma: [
    "fell", "fall", "car accident", "hit by", "stabbed", "gunshot",
    "laceration", "fracture", "broken bone", "head injury", "bleeding heavily",
  ],
  infectious: [
    "high fever", "fever for days", "won't stop shaking", "wont stop shaking",
    "rash spreading", "stiff neck",
  ],
};

// Red-flag keywords that, independent of category, strongly suggest a
// life-threatening presentation and push weighting up sharply.
const HIGH_RISK_PHRASES = [
  "worst headache of my life", "crushing chest pain", "can't breathe at all",
  "cant breathe at all", "unresponsive", "not breathing", "blue lips",
  "severe allergic reaction", "massive bleeding", "vomiting blood", "stiff neck",
];

// Classic stroke-recognition (FAST) wording — treated as an independent,
// time-critical red flag (floors to Critical) regardless of vitals, since
// sudden focal neurological deficit is itself the emergency.
const STROKE_RED_FLAG_PHRASES = [
  "face drooping", "facial droop", "slurred speech", "one-sided weakness",
  "sudden weakness", "can't speak", "cant speak",
];

// Phrases that indicate a genuinely vague/non-specific complaint, used as
// part of ambiguity criterion (a): no specific symptom keyword AND vague wording.
const VAGUE_PHRASES = [
  "not feeling well", "hard to explain", "just feels off", "feels off",
  "something's wrong", "somethings wrong", "don't feel right", "dont feel right",
  "not myself", "under the weather", "generally unwell", "weird", "off",
  "can't explain it", "cant explain it", "not sure what's wrong", "not sure whats wrong",
];

// Text-based proxy for "self-reported pain level" per criterion (b) of the
// ambiguity rule (patient/gender/age/consciousness/etc. schema has no
// dedicated pain-scale field, so we read stated pain intensity out of the
// free-text chief complaint itself).
const HIGH_SELF_REPORTED_PAIN_PHRASES = [
  "10/10", "10 out of 10", "worst pain of my life", "unbearable pain",
  "excruciating", "unbearable", "worst pain", "9/10", "9 out of 10",
];

function textContainsAny(text, phrases) {
  const lower = (text || "").toLowerCase();
  return phrases.some((p) => lower.includes(p));
}

function detectKeywordSignals(chiefComplaint) {
  const lower = (chiefComplaint || "").toLowerCase();
  const signals = [];
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      signals.push(category);
    }
  }
  return signals;
}

function hasHighRiskPhrase(chiefComplaint) {
  return textContainsAny(chiefComplaint, HIGH_RISK_PHRASES);
}

function hasStrokeRedFlag(chiefComplaint) {
  return textContainsAny(chiefComplaint, STROKE_RED_FLAG_PHRASES);
}

function isVagueWording(chiefComplaint) {
  const text = (chiefComplaint || "").trim();
  if (text.length === 0) return true;
  if (textContainsAny(text, VAGUE_PHRASES)) return true;
  // Very short free text with no punctuation/detail is also treated as vague.
  if (text.split(/\s+/).length <= 3) return true;
  return false;
}

function hasHighSelfReportedPain(chiefComplaint) {
  return textContainsAny(chiefComplaint, HIGH_SELF_REPORTED_PAIN_PHRASES);
}

module.exports = {
  CATEGORY_KEYWORDS,
  HIGH_RISK_PHRASES,
  STROKE_RED_FLAG_PHRASES,
  VAGUE_PHRASES,
  detectKeywordSignals,
  hasHighRiskPhrase,
  hasStrokeRedFlag,
  isVagueWording,
  hasHighSelfReportedPain,
};
