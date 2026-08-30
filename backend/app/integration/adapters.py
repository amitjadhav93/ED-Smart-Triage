from abc import ABC, abstractmethod
from typing import Dict, Optional

class PatientRecordsAdapter(ABC):
    @abstractmethod
    def get_patient_history(self, patient_id: str) -> Optional[dict]:
        ...


class MockPatientRecordsAdapter(PatientRecordsAdapter):
    """Canned history for a couple of seed patient IDs; None for unknowns -
    representing a real records-lookup miss (the formal version of a
    zero-history / first-time patient)."""

    def __init__(self):
        self._canned: Dict[str, dict] = {
            "seed-hx-001": {
                "patientId": "seed-hx-001",
                "medicalHistory": ["Hypertension", "Type 2 Diabetes"],
                "medications": ["Metformin", "Lisinopril"],
                "allergies": ["Penicillin"],
            },
            "seed-hx-002": {
                "patientId": "seed-hx-002",
                "medicalHistory": ["Asthma"],
                "medications": ["Albuterol inhaler"],
                "allergies": [],
            },
        }

    def get_patient_history(self, patient_id: str) -> Optional[dict]:
        return self._canned.get(patient_id)


class BedManagementAdapter(ABC):
    @abstractmethod
    def get_bed_availability(self) -> Dict[str, int]:
        ...

    @abstractmethod
    def assign_bed(self, patient_id: str, tier: str) -> Optional[str]:
        ...

    @abstractmethod
    def release_bed(self, bed_id: str) -> None:
        ...


class MockBedManagementAdapter(BedManagementAdapter):
    def __init__(self, capacity: Dict[str, int]):
        self._capacity = dict(capacity)
        self._available = dict(capacity)
        self._assigned: Dict[str, str] = {}  # bed_id -> tier
        self._counter = 0

    def get_bed_availability(self) -> Dict[str, int]:
        return dict(self._available)

    def assign_bed(self, patient_id: str, tier: str) -> Optional[str]:
        if self._available.get(tier, 0) <= 0:
            return None
        self._available[tier] -= 1
        self._counter += 1
        bed_id = f"{tier}-bed-{self._counter}"
        self._assigned[bed_id] = tier
        return bed_id

    def release_bed(self, bed_id: str) -> None:
        tier = self._assigned.pop(bed_id, None)
        if tier is not None:
            self._available[tier] = self._available.get(tier, 0) + 1



class StaffRosterAdapter(ABC):
    @abstractmethod
    def get_active_staff_count(self, shift: str) -> int:
        ...


class MockStaffRosterAdapter(StaffRosterAdapter):
    """Not deeply used in scoring for this prototype; exists to demonstrate
    the adapter pattern is extensible to staffing-aware thresholds later."""

    _STAFF_BY_SHIFT = {"day": 12, "evening": 9, "night": 5}

    def get_active_staff_count(self, shift: str) -> int:
        return self._STAFF_BY_SHIFT.get(shift, 6)
