import uuid
from datetime import datetime, timezone
from typing import List, Optional


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AuditLogRepository:
    def __init__(self):
        self._entries: List[dict] = []

    def add_override(self, *, patient_id: str, patient_name: str, previous_level: int,
                      new_level: int, reason: str, clinician_name: str) -> dict:
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": now_iso(),
            "patientId": patient_id,
            "patientName": patient_name,
            "eventType": "override",
            "trigger": None,
            "previousLevel": previous_level,
            "newLevel": new_level,
            "reason": reason,
            "clinicianName": clinician_name,
        }
        self._entries.append(entry)
        return entry

    def add_auto_retriage(self, *, patient_id: str, patient_name: str, previous_level: int,
                           new_level: int, reason: str, trigger: str) -> dict:
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": now_iso(),
            "patientId": patient_id,
            "patientName": patient_name,
            "eventType": "auto-retriage",
            "trigger": trigger,
            "previousLevel": previous_level,
            "newLevel": new_level,
            "reason": reason,
            "clinicianName": None,
        }
        self._entries.append(entry)
        return entry

    def all_newest_first(self) -> List[dict]:
        return list(reversed(self._entries))
