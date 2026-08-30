from typing import Dict, Optional

from app.integration.adapters import (
    MockBedManagementAdapter,
    MockPatientRecordsAdapter,
    MockStaffRosterAdapter,
)


class IntegrationService:
    def __init__(self, mode: str, bed_capacity: Dict[str, int]):
        self.mode = mode
        self.patient_records = MockPatientRecordsAdapter()
        self.bed_management = MockBedManagementAdapter(bed_capacity)
        self.staff_roster = MockStaffRosterAdapter()

    def status(self) -> dict:
        return {
            "mode": self.mode,
            "adapters": {
                "patientRecords": "mock",
                "bedManagement": "mock",
                "staffRoster": "mock",
            },
        }

    def get_bed_availability(self) -> Dict[str, int]:
        return self.bed_management.get_bed_availability()

    def assign_bed(self, patient_id: str, tier: str) -> Optional[str]:
        return self.bed_management.assign_bed(patient_id, tier)

    def release_bed(self, bed_id: str) -> None:
        self.bed_management.release_bed(bed_id)

    def get_patient_history(self, patient_id: str) -> Optional[dict]:
        return self.patient_records.get_patient_history(patient_id)

    def get_active_staff_count(self, shift: str) -> int:
        return self.staff_roster.get_active_staff_count(shift)
