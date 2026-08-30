import copy
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from app.ai_interpretation import interpret_intake
from app.audit import now_iso
from app.config import LEVEL_LABELS, settings
from app.errors import APIError
from app.models import PatientCreate, VitalsUpdateIn
from app.queue_engine import hydrate_wait_fields, public_view
from app.scoring.engine import score_patient
from app.seed_data import SEED_PATIENTS
from app.store import state


def _empty_vitals() -> dict:
    return {"heartRate": None, "bpSystolic": None, "bpDiastolic": None,
            "temperature": None, "spo2": None, "respRate": None}


def _vitals_dict(vitals_in) -> dict:
    if vitals_in is None:
        return _empty_vitals()
    return {
        "heartRate": vitals_in.heartRate,
        "bpSystolic": vitals_in.bpSystolic,
        "bpDiastolic": vitals_in.bpDiastolic,
        "temperature": vitals_in.temperature,
        "spo2": vitals_in.spo2,
        "respRate": vitals_in.respRate,
    }


def _history_dict(history_in) -> dict:
    if history_in is None:
        return {"medicalHistory": [], "medications": [], "allergies": []}
    return {
        "medicalHistory": history_in.medicalHistory or [],
        "medications": history_in.medications or [],
        "allergies": history_in.allergies or [],
    }


def _tier_for_level(level: int) -> str:
    # Only levels 1-2 ever attempt a bed assignment (see
    # _apply_bed_assignment), so this mapping only meaningfully covers
    # those two: level 1 (Critical) needs a critical/resus-bay bed,
    # level 2 (Emergent) needs an urgent-tier acute bed. Levels 3-5 are
    # mapped for completeness/extensibility but never trigger an
    # assignment attempt in this prototype.
    if level == 1:
        return "critical"
    if level == 2:
        return "urgent"
    if level == 3:
        return "urgent"
    return "nonUrgent"


def _apply_bed_assignment(patient: dict) -> None:
    """Bed-capacity conflict handling (module 10). Only attempted for
    severity level 1 or 2, per spec - this is the concrete scenario of a
    newly-arrived critical patient outranking others when critical beds
    are full."""
    if patient["severityLevel"] not in (1, 2):
        return
    if patient.get("assignedBedId"):
        return  # already holds a bed
    tier = _tier_for_level(patient["severityLevel"])
    bed_id = state.integration.assign_bed(patient["id"], tier)
    if bed_id:
        patient["assignedBedId"] = bed_id
        patient["bedConflict"] = False
    else:
        patient["bedConflict"] = True
        if not any(f["id"] == "BED_CAPACITY_CONFLICT" for f in patient["flags"]):
            patient["flags"].append({
                "id": "BED_CAPACITY_CONFLICT",
                "label": "No Critical Bed Available",
                "detail": f"All {tier}-tier beds are currently assigned. Clinician review needed for overflow/reassignment.",
                "severity": "high",
            })


def _release_bed_if_any(patient: dict) -> None:
    bed_id = patient.get("assignedBedId")
    if bed_id:
        state.integration.release_bed(bed_id)
        patient["assignedBedId"] = None
        patient["bedConflict"] = False


def _new_patient_shell(*, name: str, age: float, gender: str, chief_complaint: str,
                        consciousness: str, breathing_status: str, trauma_severity: str,
                        vitals: dict, history: dict, ai_result: dict, scored: dict) -> dict:
    now = now_iso()
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "age": age,
        "gender": gender,
        "ageGroup": scored["ageGroup"],
        "chiefComplaint": chief_complaint,
        "consciousness": consciousness,
        "breathingStatus": breathing_status,
        "traumaSeverity": trauma_severity,
        "vitals": vitals,
        "history": history,
        "severityScore": scored["severityScore"],
        "severityLevel": scored["severityLevel"],
        "aiRecommendedLevel": scored["severityLevel"],
        "severityLabel": scored["severityLabel"],
        "confidence": scored["confidence"],
        "flags": scored["flags"],
        "aiInterpretation": ai_result,
        "dataCompleteness": scored["dataCompleteness"],
        "status": "waiting",
        "arrivalTime": now,
        "lastAssessedTime": now,
        "waitTimeMinutes": 0.0,
        "safeWaitThresholdMinutes": state.safe_wait_threshold(scored["severityLevel"]),
        "isOverdue": False,
        "isOverridden": False,
        "overrideHistory": [],
        "assignedBedId": None,
        "bedConflict": False,
        "deteriorationDetected": False,
        "_lastAutoRetriageWaitFlag": False,  # internal bookkeeping, stripped from responses
    }


async def create_patient(payload: PatientCreate) -> dict:
    vitals = _vitals_dict(payload.vitals)
    history = _history_dict(payload.history)

    ai_result = await interpret_intake(payload.age, payload.chiefComplaint, vitals)

    scored = score_patient(
        age=payload.age,
        chief_complaint=payload.chiefComplaint,
        consciousness=payload.consciousness,
        breathing_status=payload.breathingStatus,
        trauma_severity=payload.traumaSeverity,
        vitals=vitals,
        history=history,
        ai_extracted_signals=ai_result["extractedSignals"],
        ai_ambiguity_detected=ai_result["ambiguityDetected"],
    )

    patient = _new_patient_shell(
        name=payload.name, age=payload.age, gender=payload.gender,
        chief_complaint=payload.chiefComplaint, consciousness=payload.consciousness,
        breathing_status=payload.breathingStatus, trauma_severity=payload.traumaSeverity,
        vitals=vitals, history=history, ai_result=ai_result, scored=scored,
    )

    _apply_bed_assignment(patient)
    state.patients.add(patient)
    state.total_assessed += 1
    return public_view(hydrate_wait_fields(patient))


def get_patient(patient_id: str) -> dict:
    patient = state.patients.get(patient_id)
    if patient is None:
        raise APIError(404, "Patient not found.", "NOT_FOUND")
    return public_view(hydrate_wait_fields(patient))


def override_patient(patient_id: str, new_level: int, reason: str, clinician_name: str) -> dict:
    patient = state.patients.get(patient_id)
    if patient is None:
        raise APIError(404, "Patient not found.", "NOT_FOUND")
    if not (1 <= new_level <= 5):
        raise APIError(400, "newSeverityLevel must be between 1 and 5.", "INVALID_SEVERITY_LEVEL")
    if not reason or not reason.strip():
        raise APIError(400, "A reason is required for an override.", "MISSING_REASON")
    if not clinician_name or not clinician_name.strip():
        raise APIError(400, "A clinicianName is required for an override.", "MISSING_CLINICIAN_NAME")

    previous_level = patient["severityLevel"]
    patient["severityLevel"] = new_level
    patient["severityLabel"] = LEVEL_LABELS[new_level]
    patient["isOverridden"] = True
    patient["overrideHistory"].append({
        "timestamp": now_iso(),
        "previousLevel": previous_level,
        "newLevel": new_level,
        "reason": reason,
        "clinicianName": clinician_name,
    })
    state.overridden_patient_ids.add(patient["id"])

    state.audit_log.add_override(
        patient_id=patient["id"], patient_name=patient["name"],
        previous_level=previous_level, new_level=new_level,
        reason=reason, clinician_name=clinician_name,
    )

    _apply_bed_assignment(patient)
    return public_view(hydrate_wait_fields(patient))


def _rescore(patient: dict, pain_level: Optional[float] = None) -> dict:
    return score_patient(
        age=patient["age"], chief_complaint=patient["chiefComplaint"],
        consciousness=patient["consciousness"], breathing_status=patient["breathingStatus"],
        trauma_severity=patient["traumaSeverity"], vitals=patient["vitals"], history=patient["history"],
        ai_extracted_signals=patient["aiInterpretation"]["extractedSignals"],
        ai_ambiguity_detected=patient["aiInterpretation"]["ambiguityDetected"],
        pain_level=pain_level,
    )


def manual_retriage(patient_id: str) -> dict:
    """GET /api/patients/:id/retriage - always updates both aiRecommendedLevel
    and severityLevel, even for a previously-overridden patient."""
    patient = state.patients.get(patient_id)
    if patient is None:
        raise APIError(404, "Patient not found.", "NOT_FOUND")

    scored = _rescore(patient)
    previous_effective = patient["severityLevel"]

    patient["severityScore"] = scored["severityScore"]
    patient["aiRecommendedLevel"] = scored["severityLevel"]
    patient["severityLevel"] = scored["severityLevel"]
    patient["severityLabel"] = scored["severityLabel"]
    patient["confidence"] = scored["confidence"]
    patient["flags"] = scored["flags"]
    patient["dataCompleteness"] = scored["dataCompleteness"]
    patient["isOverridden"] = False
    patient["lastAssessedTime"] = now_iso()

    _apply_bed_assignment(patient)

    state.audit_log.add_auto_retriage(
        patient_id=patient["id"], patient_name=patient["name"],
        previous_level=previous_effective, new_level=patient["severityLevel"],
        reason="Manual re-triage requested; re-scored from current wait time and data.",
        trigger="wait-threshold",
    )
    return public_view(hydrate_wait_fields(patient))


def _apply_auto_rescore(patient: dict, trigger: str, reason: str, track_deterioration: bool = False,
                         pain_level: Optional[float] = None) -> None:
    """Shared logic for automatic (non-manual) re-scoring events: wait-
    threshold auto re-triage (module 4) and vitals-triggered reassessment
    (module 11). Preserves an active clinician override rather than
    silently overwriting it."""
    scored = _rescore(patient, pain_level=pain_level)
    previous_ai_level = patient["aiRecommendedLevel"]

    patient["severityScore"] = scored["severityScore"]
    patient["aiRecommendedLevel"] = scored["severityLevel"]
    patient["confidence"] = scored["confidence"]
    patient["flags"] = scored["flags"]
    patient["dataCompleteness"] = scored["dataCompleteness"]
    patient["lastAssessedTime"] = now_iso()

    if track_deterioration:
        patient["deteriorationDetected"] = scored["severityLevel"] < previous_ai_level

    if patient["isOverridden"]:
        # Override preserved: effective severityLevel/severityLabel untouched.
        state.audit_log.add_auto_retriage(
            patient_id=patient["id"], patient_name=patient["name"],
            previous_level=patient["severityLevel"], new_level=scored["severityLevel"],
            reason=reason, trigger=trigger,
        )
    else:
        previous_effective = patient["severityLevel"]
        patient["severityLevel"] = scored["severityLevel"]
        patient["severityLabel"] = scored["severityLabel"]
        state.audit_log.add_auto_retriage(
            patient_id=patient["id"], patient_name=patient["name"],
            previous_level=previous_effective, new_level=scored["severityLevel"],
            reason=reason, trigger=trigger,
        )

    _apply_bed_assignment(patient)


def update_vitals(patient_id: str, update: VitalsUpdateIn) -> dict:
    patient = state.patients.get(patient_id)
    if patient is None:
        raise APIError(404, "Patient not found.", "NOT_FOUND")

    for field_name in ("heartRate", "bpSystolic", "bpDiastolic", "temperature", "spo2", "respRate"):
        value = getattr(update, field_name)
        if value is not None:
            patient["vitals"][field_name] = value

    _apply_auto_rescore(
        patient, trigger="vitals-update",
        reason="Vitals updated; re-scored from updated data.",
        track_deterioration=True, pain_level=update.painLevel,
    )
    return public_view(hydrate_wait_fields(patient))


def update_status(patient_id: str, status: str) -> dict:
    patient = state.patients.get(patient_id)
    if patient is None:
        raise APIError(404, "Patient not found.", "NOT_FOUND")
    patient["status"] = status
    if status != "waiting":
        _release_bed_if_any(patient)
    return public_view(hydrate_wait_fields(patient))


def run_wait_threshold_auto_retriage_sweep() -> None:
    """Called periodically (background loop) and opportunistically on
    reads. For each waiting, overdue patient that hasn't yet been
    auto-retriaged for this overdue episode, re-run scoring and log an
    auto-retriage audit entry, preserving any active override."""
    for patient in state.patients.waiting():
        wait_minutes = (
            datetime.now(timezone.utc) - datetime.fromisoformat(patient["arrivalTime"])
        ).total_seconds() / 60.0
        threshold = state.safe_wait_threshold(patient["severityLevel"])
        is_overdue = wait_minutes > threshold

        if is_overdue and not patient.get("_lastAutoRetriageWaitFlag"):
            _apply_auto_rescore(
                patient, trigger="wait-threshold",
                reason="Wait time exceeded safe threshold; re-scored from updated data.",
            )
            patient["_lastAutoRetriageWaitFlag"] = True
        elif not is_overdue:
            patient["_lastAutoRetriageWaitFlag"] = False


def inject_surge_patients(count: int) -> List[dict]:
    if count <= 0:
        raise APIError(400, "count must be a positive integer.", "INVALID_SURGE_COUNT")

    injected: List[dict] = []
    for i in range(count):
        seed = SEED_PATIENTS[i % len(SEED_PATIENTS)]
        vitals = copy.deepcopy(seed["vitals"])
        history = copy.deepcopy(seed["history"])

        # Keyword-only interpretation used for surge injection (no live
        # Gemini calls for bulk-injected demo patients, keeps surge fast
        # and deterministic; the deterministic engine is unaffected).
        from app.ai_interpretation import _keyword_fallback
        ai_result = _keyword_fallback(seed["chiefComplaint"])

        scored = score_patient(
            age=seed["age"], chief_complaint=seed["chiefComplaint"],
            consciousness=seed["consciousness"], breathing_status=seed["breathingStatus"],
            trauma_severity=seed["traumaSeverity"], vitals=vitals, history=history,
            ai_extracted_signals=ai_result["extractedSignals"],
            ai_ambiguity_detected=ai_result["ambiguityDetected"],
        )

        patient = _new_patient_shell(
            name=f"{seed['name']} (Surge #{i + 1})", age=seed["age"], gender=seed["gender"],
            chief_complaint=seed["chiefComplaint"], consciousness=seed["consciousness"],
            breathing_status=seed["breathingStatus"], trauma_severity=seed["traumaSeverity"],
            vitals=vitals, history=history, ai_result=ai_result, scored=scored,
        )
        _apply_bed_assignment(patient)
        state.patients.add(patient)
        state.total_assessed += 1
        injected.append(public_view(hydrate_wait_fields(patient)))

    state.activate_surge()
    return injected


def validation_report() -> dict:
    """Read-only: runs the scoring engine fresh against every seed
    record's raw inputs, ignoring any live overrides, and compares to
    the hand-labeled expectedSeverityLevel."""
    cases = []
    exact = 0
    over_triage = 0
    under_triage = 0

    for seed in SEED_PATIENTS:
        scored = score_patient(
            age=seed["age"], chief_complaint=seed["chiefComplaint"],
            consciousness=seed["consciousness"], breathing_status=seed["breathingStatus"],
            trauma_severity=seed["traumaSeverity"], vitals=seed["vitals"], history=seed["history"],
            ai_extracted_signals=[], ai_ambiguity_detected=False,
        )
        computed = scored["severityLevel"]
        expected = seed["expectedSeverityLevel"]

        if computed == expected:
            outcome = "match"
            exact += 1
        elif computed < expected:
            outcome = "over-triage"
            over_triage += 1
        else:
            outcome = "under-triage"
            under_triage += 1

        cases.append({
            "id": seed["id"], "name": seed["name"],
            "expectedSeverityLevel": expected, "computedSeverityLevel": computed,
            "outcome": outcome,
        })

    total = len(SEED_PATIENTS)
    return {
        "totalCases": total,
        "exactAgreement": exact,
        "agreementPct": round((exact / total) * 100, 1) if total else 0.0,
        "overTriageCount": over_triage,
        "underTriageCount": under_triage,
        "cases": cases,
    }


def trust_metrics() -> dict:
    total_assessed = state.total_assessed
    total_overridden = len(state.overridden_patient_ids)
    rate = round((total_overridden / total_assessed) * 100, 1) if total_assessed else 0.0
    return {"totalAssessed": total_assessed, "totalOverridden": total_overridden, "overrideRatePct": rate}
