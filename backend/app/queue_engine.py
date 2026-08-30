from datetime import datetime, timezone
from typing import List

from app.store import state


def compute_wait_minutes(patient: dict) -> float:
    arrival = datetime.fromisoformat(patient["arrivalTime"])
    now = datetime.now(timezone.utc)
    return round((now - arrival).total_seconds() / 60.0, 1)


def hydrate_wait_fields(patient: dict) -> dict:
    """Returns the patient dict (mutated in place) with fresh
    waitTimeMinutes / safeWaitThresholdMinutes / isOverdue computed."""
    patient["waitTimeMinutes"] = compute_wait_minutes(patient)
    patient["safeWaitThresholdMinutes"] = state.safe_wait_threshold(patient["severityLevel"])
    patient["isOverdue"] = patient["waitTimeMinutes"] > patient["safeWaitThresholdMinutes"]
    return patient


def public_view(patient: dict) -> dict:
    """Strips internal-only bookkeeping fields before returning to the API layer."""
    return {k: v for k, v in patient.items() if not k.startswith("_")}


def sorted_waiting_queue() -> List[dict]:
    waiting = [hydrate_wait_fields(p) for p in state.patients.waiting()]
    # Ascending severityLevel (1 = most critical first), then waitTimeMinutes descending.
    waiting.sort(key=lambda p: (p["severityLevel"], -p["waitTimeMinutes"]))
    return [public_view(p) for p in waiting]
