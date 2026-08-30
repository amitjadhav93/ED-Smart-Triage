from fastapi import APIRouter, Depends

from app import patient_service
from app.auth import require_clinician_auth
from app.errors import APIError
from app.models import OverrideRequest, PatientCreate, StatusUpdate, VitalsUpdateIn
from app.queue_engine import sorted_waiting_queue
from app.store import state

router = APIRouter(prefix="/api", tags=["patients"])


@router.post("/patients", status_code=201, dependencies=[Depends(require_clinician_auth)])
async def create_patient(payload: PatientCreate):
    return await patient_service.create_patient(payload)


@router.get("/patients")
def list_patients():
    patient_service.run_wait_threshold_auto_retriage_sweep()
    return {"patients": sorted_waiting_queue(), "surgeModeActive": state.surge_is_active()}


@router.get("/patients/{patient_id}")
def get_patient(patient_id: str):
    return patient_service.get_patient(patient_id)


@router.post("/patients/{patient_id}/override", dependencies=[Depends(require_clinician_auth)])
def override_patient(patient_id: str, payload: OverrideRequest):
    if not (1 <= payload.newSeverityLevel <= 5):
        raise APIError(400, "newSeverityLevel must be between 1 and 5.", "INVALID_SEVERITY_LEVEL")
    return patient_service.override_patient(
        patient_id, payload.newSeverityLevel, payload.reason, payload.clinicianName
    )


@router.get("/patients/{patient_id}/retriage", dependencies=[Depends(require_clinician_auth)])
def retriage_patient(patient_id: str):
    return patient_service.manual_retriage(patient_id)


@router.patch("/patients/{patient_id}/status", dependencies=[Depends(require_clinician_auth)])
def update_patient_status(patient_id: str, payload: StatusUpdate):
    return patient_service.update_status(patient_id, payload.status)


@router.patch("/patients/{patient_id}/vitals", dependencies=[Depends(require_clinician_auth)])
def update_patient_vitals(patient_id: str, payload: VitalsUpdateIn):
    return patient_service.update_vitals(patient_id, payload)
