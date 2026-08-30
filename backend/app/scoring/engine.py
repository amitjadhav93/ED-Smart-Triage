from typing import Dict, List, Optional, Tuple

from app.config import LEVEL_LABELS
from app.scoring.thresholds import THRESHOLDS, get_age_group

RED_FLAG_KEYWORDS = [
    "crushing chest", "chest pain", "can't breathe", "cannot breathe",
    "not breathing", "stroke", "slurred speech", "face drooping",
    "severe bleeding", "uncontrolled bleeding", "unresponsive",
    "seizure", "anaphylaxis", "severe allergic reaction",
    "stab wound", "gunshot", "suicidal", "coughing up blood",
    "vomiting blood", "swelling of face", "swelling of throat",
]

HIGH_SIGNAL_TRAUMA_PHRASES = ["fracture", "unable to bear weight", "deformity", "open wound"]

VAGUE_PHRASES = [
    "not feeling well", "hard to explain", "feels weird", "kinda woozy",
    "just feels off", "don't know what's wrong", "not sure what's wrong",
    "something's not right", "generally unwell", "off today",
]

SYMPTOM_KEYWORDS: Dict[str, List[str]] = {
    "respiratory": ["shortness of breath", "wheezing", "cough", "breathing fast", "labored breathing"],
    "cardiac": ["chest pain", "chest pressure", "palpitations", "chest tightness"],
    "neurological": ["confusion", "weakness on one side", "slurred speech", "severe headache", "dizzy", "dizziness"],
    "allergic": ["hives", "swelling of face", "swelling of throat", "rash after eating", "anaphylaxis"],
    "gi": ["vomiting blood", "severe abdominal pain", "black stool", "persistent vomiting"],
    "trauma": ["fracture", "laceration", "fell", "car accident", "deep cut"],
    "infectious": ["fever", "chills", "night sweats"],
    "other": [],
}


def flag(id_: str, label: str, detail: str, severity: str) -> dict:
    return {"id": id_, "label": label, "detail": detail, "severity": severity}


def score_to_level(score: float) -> int:
    if score >= 80:
        return 1
    if score >= 60:
        return 2
    if score >= 40:
        return 3
    if score >= 20:
        return 4
    return 5


def compute_data_completeness(vitals: dict, history: dict) -> Tuple[str, int]:
    vital_fields = ["heartRate", "bpSystolic", "bpDiastolic", "temperature", "spo2", "respRate"]
    provided = sum(1 for f in vital_fields if vitals.get(f) is not None)
    history_fields = ["medicalHistory", "medications", "allergies"]
    provided += sum(1 for f in history_fields if history.get(f))

    if provided <= 2:
        return "minimal", provided
    if provided <= 6:
        return "partial", provided
    return "complete", provided


def score_patient(
    *,
    age: float,
    chief_complaint: str,
    consciousness: str,
    breathing_status: str,
    trauma_severity: str,
    vitals: dict,
    history: dict,
    ai_extracted_signals: Optional[List[str]] = None,
    ai_ambiguity_detected: bool = False,
    pain_level: Optional[float] = None,
) -> dict:
  
    ai_extracted_signals = ai_extracted_signals or []
    age_group = get_age_group(age)
    th = THRESHOLDS[age_group]
    complaint_lower = (chief_complaint or "").lower()

    flags: List[dict] = []
    confidence_reasons: List[str] = []
    red_flag_triggered = False
    floor_level = 5  
    score = 0.0

    def raise_floor(level: int):
        nonlocal floor_level
        floor_level = min(floor_level, level)

    if breathing_status == "absent":
        flags.append(flag("BREATHING_ABSENT", "No Spontaneous Breathing",
                           "Patient has no spontaneous breathing recorded.", "high"))
        raise_floor(1); red_flag_triggered = True; score = max(score, 100)

    if consciousness == "U":
        flags.append(flag("UNRESPONSIVE", "Unresponsive (AVPU: U)",
                           "Patient is unresponsive on the AVPU scale.", "high"))
        raise_floor(1); red_flag_triggered = True; score = max(score, 100)

    if trauma_severity == "severe":
        flags.append(flag("SEVERE_TRAUMA", "Severe Trauma",
                           "Trauma severity recorded as severe.", "high"))
        raise_floor(1); red_flag_triggered = True; score = max(score, 95)

    spo2 = vitals.get("spo2")
    if spo2 is not None and spo2 <= th.spo2_critical:
        flags.append(flag("SPO2_CRITICAL", "Critically Low SpO2",
                           f"SpO2 {spo2}% is below the critical threshold ({th.spo2_critical}%) for {age_group} patients.", "high"))
        raise_floor(1); red_flag_triggered = True; score = max(score, 95)

    temperature = vitals.get("temperature")
    if age_group == "infant" and th.fever_redflag is not None and temperature is not None and temperature >= th.fever_redflag:
        flags.append(flag("INFANT_FEVER_SEPSIS_RISK", "Fever in Infant Under 3 Months",
                           f"Temperature {temperature}°C in an infant under 3 months carries a materially higher sepsis risk "
                           "than the same fever would in an older child or adult, and is treated as a red flag on its own.",
                           "high"))
        raise_floor(1); red_flag_triggered = True; score = max(score, 90)

    if consciousness == "P":
        flags.append(flag("RESPONSIVE_TO_PAIN_ONLY", "Responsive to Pain Only (AVPU: P)",
                           "Patient only responds to painful stimuli.", "high"))
        raise_floor(2); score = max(score, 80)

    ai_neuro_or_cardiac = any(s in ai_extracted_signals for s in ("cardiac", "neurological"))
    if any(kw in complaint_lower for kw in RED_FLAG_KEYWORDS) or ai_neuro_or_cardiac:
        flags.append(flag("HIGH_RISK_COMPLAINT", "High-Risk Chief Complaint",
                           "Chief complaint (or AI-extracted signal) matches a high-risk cardiac/neurological/"
                           "anaphylaxis/bleeding pattern; treated as an immediate red flag.",
                           "high"))
        score = max(score, 90)
        raise_floor(1)

    if consciousness == "V":
        score += 20
        flags.append(flag("ALTERED_CONSCIOUSNESS", "Altered Consciousness (AVPU: V)",
                           "Patient is verbally responsive only (not fully alert) - a significant finding, "
                           "especially in older or very young patients.", "medium"))

    if "severe" in complaint_lower:
        score += 20
        flags.append(flag("SEVERE_SYMPTOM_DESCRIPTOR", "Self-Reported 'Severe' Symptom",
                           "Chief complaint explicitly describes the symptom as severe.", "medium"))


    hr = vitals.get("heartRate")
    if hr is not None:
        if hr < th.hr_critical_low or hr > th.hr_critical_high:
            score += 30
            flags.append(flag("HR_CRITICAL", "Critical Heart Rate",
                               f"Heart rate {hr} bpm is critically abnormal for age group {age_group}.", "high"))
        elif hr < th.hr_concern_low or hr > th.hr_concern_high:
            score += 12
            flags.append(flag("HR_CONCERN", "Abnormal Heart Rate",
                               f"Heart rate {hr} bpm is outside the normal range for age group {age_group}.", "medium"))

    rr = vitals.get("respRate")
    if rr is not None:
        if rr < th.rr_critical_low or rr > th.rr_critical_high:
            score += 30
            flags.append(flag("RR_CRITICAL", "Critical Respiratory Rate",
                               f"Respiratory rate {rr}/min is critically abnormal for age group {age_group}.", "high"))
        elif rr < th.rr_concern_low or rr > th.rr_concern_high:
            score += 12
            flags.append(flag("RR_CONCERN", "Abnormal Respiratory Rate",
                               f"Respiratory rate {rr}/min is outside the normal range for age group {age_group}.", "medium"))

    if spo2 is not None and th.spo2_critical < spo2 < th.spo2_concern:
        score += 15
        flags.append(flag("SPO2_CONCERN", "Low-Normal SpO2",
                           f"SpO2 {spo2}% is below the comfortable range for age group {age_group}.", "medium"))

    sbp = vitals.get("bpSystolic")
    if sbp is not None:
        if sbp < th.sbp_critical_low:
            score += 28
            flags.append(flag("SBP_CRITICAL", "Critical Hypotension",
                               f"Systolic BP {sbp} mmHg is critically low for age group {age_group}.", "high"))
        elif sbp < th.sbp_concern_low:
            score += 10
            flags.append(flag("SBP_CONCERN", "Low Blood Pressure",
                               f"Systolic BP {sbp} mmHg is below the comfortable range for age group {age_group}.", "medium"))

    if temperature is not None and temperature >= th.fever_concern and not (age_group == "infant" and th.fever_redflag):
        score += 18
        flags.append(flag("FEVER", "Fever",
                           f"Temperature {temperature}°C meets the fever concern threshold for age group {age_group}.", "medium"))

    if any(phrase in complaint_lower for phrase in HIGH_SIGNAL_TRAUMA_PHRASES):
        score += 15
        flags.append(flag("HIGH_SIGNAL_TRAUMA", "High-Signal Trauma Description",
                           "Chief complaint describes a suspected fracture, deformity, or inability to bear weight - "
                           "more concerning than a routine minor injury.", "medium"))

    if breathing_status == "labored":
        score += 15
        flags.append(flag("LABORED_BREATHING", "Labored Breathing",
                           "Breathing status recorded as labored.", "medium"))

    if trauma_severity == "minor":
        score += 8
        flags.append(flag("MINOR_TRAUMA", "Minor Trauma", "Trauma severity recorded as minor.", "medium"))


    matched_categories = set()
    for category, keywords in SYMPTOM_KEYWORDS.items():
        keyword_hit = any(kw in complaint_lower for kw in keywords)
        signal_hit = category in ai_extracted_signals
        if (keyword_hit or signal_hit) and category not in matched_categories:
            matched_categories.add(category)

            if category in ("respiratory", "cardiac", "neurological"):
                score += 15
            else:
                score += 8
            flags.append(flag(
                f"SIGNAL_{category.upper()}",
                f"{category.capitalize()} Signal Present",
                f"Chief complaint or AI-extracted signal indicates a possible {category} issue.",
                "medium",
            ))


    no_keyword_match = not any(
        kw in complaint_lower for kws in SYMPTOM_KEYWORDS.values() for kw in kws
    ) and not any(kw in complaint_lower for kw in RED_FLAG_KEYWORDS)
    vague_wording = any(p in complaint_lower for p in VAGUE_PHRASES)
    pain_vitals_mismatch = False
    if pain_level is not None:

        vitals_look_concerning = score >= 40
        if pain_level >= 8 and not vitals_look_concerning:
            pain_vitals_mismatch = True
        if pain_level <= 2 and vitals_look_concerning:
            pain_vitals_mismatch = True

    ambiguous = (no_keyword_match and vague_wording) or pain_vitals_mismatch or ai_ambiguity_detected
    if ambiguous:
        raise_floor(3)
        score = max(score, 40)
        reason_bits = []
        if no_keyword_match and vague_wording:
            reason_bits.append("vague chief complaint with no specific symptom keywords")
        if pain_vitals_mismatch:
            reason_bits.append("reported pain level does not match vital-sign picture")
        if ai_ambiguity_detected:
            reason_bits.append("AI interpretation flagged the presentation as ambiguous")
        detail = "; ".join(reason_bits) if reason_bits else "presentation flagged ambiguous"
        confidence_reasons.append(f"Ambiguous presentation ({detail}) - severity floored at Urgent (3)")
        flags.append(flag("AMBIGUOUS_PRESENTATION", "Ambiguous Presentation",
                           f"Presentation flagged ambiguous: {detail}. Floored at severity level 3 rather than scored lower.",
                           "medium"))

    if age_group != "adult" and score > 0:
        score += 15
        flags.append(flag("AGE_VULNERABILITY", "Extremes-of-Age Risk Loading",
                           f"Age group '{age_group}' carries added risk for the finding(s) above; "
                           "score adjusted upward accordingly.", "medium"))

    if age_group != "adult":
        raise_floor(4)


    completeness, provided_count = compute_data_completeness(vitals, history)
    if completeness == "minimal":
        score = min(100.0, score + 10)
        confidence_reasons.append("Minimal data completeness (few vitals/history fields provided); erring toward higher acuity")
    elif completeness == "partial":
        confidence_reasons.append("Partial data completeness (some vitals/history fields missing)")
    else:
        confidence_reasons.append("Complete vitals and history provided")

    score = max(0.0, min(100.0, score))
    computed_level = score_to_level(score)
    final_level = min(computed_level, floor_level)
    label = LEVEL_LABELS[final_level]


    confidence_score = 90.0
    if completeness == "minimal":
        confidence_score -= 30
    elif completeness == "partial":
        confidence_score -= 15
    if ambiguous:
        confidence_score -= 20
    if red_flag_triggered:
        confidence_score = max(confidence_score, 70)
        confidence_reasons.append("Clear red-flag criteria met; high certainty despite any missing data")
    confidence_score = max(0.0, min(100.0, confidence_score))
    confidence_level = "high" if confidence_score >= 70 else ("medium" if confidence_score >= 40 else "low")

    return {
        "ageGroup": age_group,
        "severityScore": round(score, 1),
        "severityLevel": final_level,
        "severityLabel": label,
        "confidence": {
            "level": confidence_level,
            "score": round(confidence_score, 1),
            "reasons": confidence_reasons,
        },
        "flags": flags,
        "dataCompleteness": completeness,
    }
