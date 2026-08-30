from fastapi import APIRouter, Depends

from app import patient_service
from app.auth import require_clinician_auth
from app.config import settings
from app.models import SurgeRequest
from app.store import state

router = APIRouter(prefix="/api", tags=["misc"])


@router.get("/validation-report")
def get_validation_report():
    return patient_service.validation_report()


@router.get("/audit-log")
def get_audit_log():
    return state.audit_log.all_newest_first()


@router.post("/surge", dependencies=[Depends(require_clinician_auth)])
def trigger_surge(payload: SurgeRequest):
    injected = patient_service.inject_surge_patients(payload.count)
    from app.queue_engine import sorted_waiting_queue
    return {"injected": injected, "queueSize": len(sorted_waiting_queue())}


@router.post("/surge/end", dependencies=[Depends(require_clinician_auth)])
def end_surge():
    state.end_surge()
    return {"active": False}


@router.get("/surge/status")
def surge_status():
    active = state.surge_is_active()
    return {
        "active": active,
        "activatedAt": state.surge_activated_at.isoformat() if state.surge_activated_at else None,
        "expiresAt": state.surge_expires_at() if active else None,
        "thresholdMultiplier": settings.surge_threshold_multiplier,
        "note": "Levels 1-2 thresholds are never relaxed during surge",
    }


@router.get("/stats")
def get_stats():
    patient_service.run_wait_threshold_auto_retriage_sweep()
    from app.queue_engine import sorted_waiting_queue
    waiting = sorted_waiting_queue()
    total_waiting = len(waiting)
    avg_wait = round(sum(p["waitTimeMinutes"] for p in waiting) / total_waiting, 1) if total_waiting else 0.0
    overdue_count = sum(1 for p in waiting if p["isOverdue"])
    by_level = {str(level): 0 for level in range(1, 6)}
    for p in waiting:
        by_level[str(p["severityLevel"])] += 1

    trust = patient_service.trust_metrics()

    return {
        "totalWaiting": total_waiting,
        "avgWaitMinutes": avg_wait,
        "overdueCount": overdue_count,
        "byLevel": by_level,
        "overrideRatePct": trust["overrideRatePct"],
        "surgeModeActive": state.surge_is_active(),
    }


@router.get("/beds")
def get_beds():
    return {"available": state.integration.get_bed_availability()}


@router.get("/integration/status")
def get_integration_status():
    return state.integration.status()


@router.get("/trust-metrics")
def get_trust_metrics():
    return patient_service.trust_metrics()


@router.get("/config")
def get_config():
    return {
        "edProfile": settings.ed_profile,
        "safeWaitThresholdMinutes": {str(k): v for k, v in settings.safe_wait_threshold_minutes.items()},
        "bedCapacity": settings.bed_capacity,
    }
