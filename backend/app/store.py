from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from app.config import settings
from app.audit import AuditLogRepository
from app.integration.service import IntegrationService


class PatientRepository:
    def __init__(self):
        self._patients: Dict[str, dict] = {}

    def add(self, patient: dict) -> None:
        self._patients[patient["id"]] = patient

    def get(self, patient_id: str) -> Optional[dict]:
        return self._patients.get(patient_id)

    def all(self) -> List[dict]:
        return list(self._patients.values())

    def waiting(self) -> List[dict]:
        return [p for p in self._patients.values() if p["status"] == "waiting"]


class AppState:
    """Singleton-style module-level app state: patients, audit log,
    integration service, surge mode, and trust metrics."""

    def __init__(self):
        self.patients = PatientRepository()
        self.audit_log = AuditLogRepository()
        self.integration = IntegrationService(settings.integration_mode, dict(settings.bed_capacity))

        self.surge_active = False
        self.surge_activated_at: Optional[datetime] = None

        self.total_assessed = 0
        self.overridden_patient_ids: set = set()

    # ---- surge helpers (module 12) ----
    def surge_is_active(self) -> bool:
        if not self.surge_active or self.surge_activated_at is None:
            return False
        elapsed_minutes = (datetime.now(timezone.utc) - self.surge_activated_at).total_seconds() / 60.0
        if elapsed_minutes > settings.surge_mode_duration_minutes:
            self.surge_active = False
            return False
        return True

    def surge_expires_at(self) -> Optional[str]:
        if not self.surge_activated_at:
            return None
        expires = self.surge_activated_at + timedelta(minutes=settings.surge_mode_duration_minutes)
        return expires.isoformat()

    def activate_surge(self) -> None:
        self.surge_active = True
        self.surge_activated_at = datetime.now(timezone.utc)

    def end_surge(self) -> None:
        self.surge_active = False
        self.surge_activated_at = None

    def safe_wait_threshold(self, level: int) -> float:
        base = settings.safe_wait_threshold_minutes[level]
        # Deliberate safety floor: levels 1-2 are NEVER relaxed, even
        # during surge mode. Only levels 3-5 get relaxed thresholds.
        if self.surge_is_active() and level in (3, 4, 5):
            return base * settings.surge_threshold_multiplier
        return base


state = AppState()
