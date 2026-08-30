from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared sub-objects
# ---------------------------------------------------------------------------
class VitalsIn(BaseModel):
    heartRate: Optional[float] = None
    bpSystolic: Optional[float] = None
    bpDiastolic: Optional[float] = None
    temperature: Optional[float] = None
    spo2: Optional[float] = None
    respRate: Optional[float] = None


class VitalsUpdateIn(VitalsIn):
    painLevel: Optional[float] = None


class HistoryIn(BaseModel):
    medicalHistory: Optional[List[str]] = None
    medications: Optional[List[str]] = None
    allergies: Optional[List[str]] = None


class Vitals(BaseModel):
    heartRate: Optional[float] = None
    bpSystolic: Optional[float] = None
    bpDiastolic: Optional[float] = None
    temperature: Optional[float] = None
    spo2: Optional[float] = None
    respRate: Optional[float] = None


class History(BaseModel):
    medicalHistory: List[str] = Field(default_factory=list)
    medications: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)


class Confidence(BaseModel):
    level: Literal["high", "medium", "low"]
    score: float
    reasons: List[str]


class Flag(BaseModel):
    id: str
    label: str
    detail: str
    severity: Literal["high", "medium"]


class AIInterpretation(BaseModel):
    available: bool
    extractedSignals: List[str] = Field(default_factory=list)
    ambiguityDetected: bool = False
    missingFieldSuggestions: List[str] = Field(default_factory=list)
    narrative: str = ""


class OverrideEntry(BaseModel):
    timestamp: str
    previousLevel: int
    newLevel: int
    reason: str
    clinicianName: str


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------
class PatientCreate(BaseModel):
    name: str
    age: float
    gender: str
    chiefComplaint: str
    consciousness: Literal["A", "V", "P", "U"]
    breathingStatus: Literal["normal", "labored", "absent"]
    traumaSeverity: Literal["none", "minor", "severe"]
    vitals: Optional[VitalsIn] = None
    history: Optional[HistoryIn] = None


class OverrideRequest(BaseModel):
    newSeverityLevel: int
    reason: str
    clinicianName: str


class StatusUpdate(BaseModel):
    status: Literal["in-treatment", "discharged"]


class SurgeRequest(BaseModel):
    count: int


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------
class Patient(BaseModel):
    id: str
    name: str
    age: float
    gender: str
    ageGroup: Literal["infant", "pediatric", "adult", "geriatric"]
    chiefComplaint: str
    consciousness: Literal["A", "V", "P", "U"]
    breathingStatus: Literal["normal", "labored", "absent"]
    traumaSeverity: Literal["none", "minor", "severe"]
    vitals: Vitals
    history: History
    severityScore: float
    severityLevel: int
    aiRecommendedLevel: int
    severityLabel: str
    confidence: Confidence
    flags: List[Flag]
    aiInterpretation: AIInterpretation
    dataCompleteness: Literal["minimal", "partial", "complete"]
    status: Literal["waiting", "in-treatment", "discharged"]
    arrivalTime: str
    lastAssessedTime: str
    waitTimeMinutes: float
    safeWaitThresholdMinutes: float
    isOverdue: bool
    isOverridden: bool
    overrideHistory: List[OverrideEntry]
    assignedBedId: Optional[str] = None
    bedConflict: bool = False
    deteriorationDetected: bool = False


class AuditEntry(BaseModel):
    id: str
    timestamp: str
    patientId: str
    patientName: str
    eventType: Literal["override", "auto-retriage"]
    trigger: Optional[Literal["wait-threshold", "vitals-update"]] = None
    previousLevel: int
    newLevel: int
    reason: str
    clinicianName: Optional[str] = None


class ValidationCase(BaseModel):
    id: str
    name: str
    expectedSeverityLevel: int
    computedSeverityLevel: int
    outcome: Literal["match", "over-triage", "under-triage"]


class ValidationReport(BaseModel):
    totalCases: int
    exactAgreement: int
    agreementPct: float
    overTriageCount: int
    underTriageCount: int
    cases: List[ValidationCase]
