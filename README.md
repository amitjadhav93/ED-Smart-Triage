# 🚑 ED Smart Triage Assistant: AI-Assisted Emergency Department Triage & Live Priority Queue

**ED Smart Triage Assistant** is a clinical decision-support prototype built for a hackathon (Round 2) that reimagines Emergency Department triage as a **living, continuously re-assessed process** rather than a single static decision made once at arrival.

Patient intake flows through **AI-assisted interpretation** of free-text complaints, a **deterministic, age-adjusted severity scoring engine**, and into a **live, auto-re-triaging priority queue** — with every clinician override captured in an **immutable audit trail**. The result is a system that behaves less like a one-shot classifier and more like a second opinion that keeps watching the room.

> ⚠️ This is a **judged prototype running on simulated data** — not a production clinical system. See `DESIGN_NOTES.md` for an honest discussion of clinical grounding, limitations, and what a real deployment would still need.

---

## 🚨 Why ED Smart Triage Assistant?

Manual ED triage is a proven, necessary process — but it has structural blind spots that get worse exactly when a department is under the most pressure.

### Core Challenges:
- **One-Shot Assessment**: Standard triage happens once at arrival and rarely gets automatically revisited as a patient waits and their condition evolves.
- **Messy, Free-Text Complaints**: Patients and reporters describe symptoms in their own words — inconsistent, vague, or ambiguous phrasing is hard to standardize into structured severity criteria.
- **Deterioration Goes Unnoticed**: A patient who is quietly worsening while waiting has no automatic mechanism to flag that change to staff.
- **Surge Conditions Break Static Rules**: A 3x patient surge should change operating behavior (thresholds, staff attention), but static protocols don't adapt on their own.
- **Trust & Accountability Gaps**: Clinicians need to be able to override an automated recommendation — and that override needs to be logged, not silently lost.

---

## ✅ How ED Smart Triage Assistant Solves This

- 🧠 **AI-Assisted Intake Interpretation**: Google Gemini interprets messy chief-complaint text into structured signals (respiratory, cardiac, neurological, allergic, etc.) — and the app **runs and scores correctly even if the AI call fails or no API key is set**, via a deterministic keyword-only fallback.
- 🩺 **Deterministic, Age-Adjusted Scoring Engine**: A hybrid red-flag + weighted-score engine, calibrated against four distinct age-band vital-sign threshold tables (infant / pediatric / adult / geriatric), inspired by NEWS2, PEWS, and ESI structures.
- 📋 **Live, Self-Correcting Priority Queue**: A background sweep automatically re-triages waiting patients who exceed their safety-adjusted wait threshold, and any new vitals entry immediately triggers re-scoring and deterioration detection.
- 🖊️ **Clinician Override, Never Silently Overwritten**: Once a clinician overrides a patient's severity, automatic re-triage keeps updating the AI's *recommendation* in the background but never silently changes the clinician-set effective level — every override and auto-retriage event is written to an append-only audit log.
- 🛏️ **Bed-Aware, Conflict-Transparent**: Bed assignment is handled through a swappable integration layer; when no bed is available in the right tier, the system surfaces a clear `bedConflict` flag instead of silently reassigning resources.
- ⚡ **Surge Simulation**: Injects a burst of patients from a seed dataset and activates a real threshold-relaxation behavior change for lower-acuity levels — critical/emergent thresholds are **never** relaxed, even under surge.
- 📊 **Built-In Self-Validation**: `GET /api/validation-report` re-scores 18 hand-labeled seed cases and reports exact agreement, over-triage, and under-triage counts on every run.

---

## 🛠️ Tech Stack

### 🌐 Frontend
- **React** – UI components
- **Vite** – Lightning-fast dev/build tool
- **Plain CSS** – Custom design system (severity badges, confidence pills, ledger views)
- **Fetch API** – Typed API client with normalized error handling

### 🔗 Backend
- **FastAPI** – Python web framework (async APIs, auto-generated OpenAPI docs)
- **Pydantic** – Request/response schema validation
- **Google Gemini (`google-genai`)** – LLM-based intake interpretation, with graceful fallback
- **Uvicorn** – ASGI server
- **In-memory repository pattern** – Patient store, audit log, and app state (no external DB required for the demo)

---

## 🏗️ System Architecture

The backend is organized as a **layered pipeline**, not a monolithic handler — each layer has a single responsibility and the scoring engine never depends on the AI call succeeding.

- **Intake Layer** (`routers/patients.py`) → Validates incoming patient data via Pydantic models.
- **AI Interpretation Layer** (`ai_interpretation.py`) → Calls Gemini to extract structured signals from free text; falls back to deterministic keyword matching on any failure, timeout, or missing API key.
- **Scoring Engine** (`scoring/engine.py` + `scoring/thresholds.py`) → Deterministic hybrid red-flag + weighted scoring against age-banded vital-sign thresholds; always returns a `confidence` object and a `flags` array.
- **Queue Engine** (`queue_engine.py`) → Computes live wait time, overdue status, and sorts the priority queue by severity then wait time.
- **Orchestration Layer** (`patient_service.py`) → Coordinates intake → AI → scoring → bed assignment → audit logging, and runs the periodic wait-threshold auto-retriage sweep.
- **Integration Layer** (`integration/adapters.py`, `integration/service.py`) → Three swappable adapter interfaces (patient records, bed management, staff roster), all mocked in this prototype behind a single `IntegrationService` facade.
- **Audit Layer** (`audit.py`) → Append-only log of every override and auto-retriage event.

---

## 📡 API Reference

Full request/response examples for every endpoint (including error cases) are documented in **`API_EXAMPLES.md`**, and the live interactive docs are available at **`/docs`** once the backend is running.

Base path for every route below: **`/api`**. Endpoints marked 🔒 require `Authorization: Bearer <token>`.

| Method & Path | Purpose |
|---|---|
| `POST /patients` 🔒 | Register a new patient — runs AI interpretation, scoring, and bed assignment |
| `GET /patients` | Live waiting queue, sorted by severity then wait time |
| `GET /patients/{id}` | Full patient detail |
| `POST /patients/{id}/override` 🔒 | Clinician override of the effective severity level (reason required) |
| `GET /patients/{id}/retriage` 🔒 | Manually re-score a patient from current data |
| `PATCH /patients/{id}/status` 🔒 | Move a patient to `in-treatment` or `discharged` |
| `PATCH /patients/{id}/vitals` 🔒 | Record new vitals — triggers immediate re-scoring & deterioration detection |
| `GET /audit-log` | Immutable ledger of overrides and auto-retriage events |
| `POST /surge` 🔒 | Inject N seed patients and activate surge mode |
| `POST /surge/end` 🔒 | End surge mode early |
| `GET /surge/status` | Current surge state and expiry |
| `GET /stats` | Queue stats: totals, average wait, overdue count, per-level breakdown, override rate |
| `GET /beds` | Live bed availability by tier |
| `GET /integration/status` | Integration mode and adapter status |
| `GET /trust-metrics` | Override-rate tracking (an adoption/trust signal) |
| `GET /config` | Active hospital profile, wait thresholds, bed capacity |
| `GET /validation-report` | Re-runs scoring against 18 hand-labeled seed cases |

### Example: `POST /api/patients` 🔒

**Request Body:**
```json
{
  "name": "Rohan Verma",
  "age": 34,
  "gender": "male",
  "chiefComplaint": "Found unresponsive after a motorcycle accident.",
  "consciousness": "U",
  "breathingStatus": "labored",
  "traumaSeverity": "severe",
  "vitals": { "heartRate": 130, "bpSystolic": 82, "spo2": 85, "respRate": 28 }
}
```

**Responses:**
- `201 Created` → Full patient object with `severityLevel`, `flags`, `confidence`, and `aiInterpretation`
- `400 Bad Request` → Missing/invalid field (normalized `{ error: { message, code } }` shape)
- `401 Unauthorized` → Missing or invalid bearer token

---

## 🧪 Getting Started

### 📦 Prerequisites
- Python **3.9+**
- Node.js **v18+** (with npm)
- (Optional) A Google Gemini API key — the app runs and scores correctly without one, falling back to keyword-only interpretation

---

### 🚀 Installation

**Clone the Repo**
```bash
git clone <YOUR_REPO_URL>
cd ed-smart-triage-assistant
```

**Backend Setup**
```bash
cd backend
pip install -r requirements.txt
```

**Frontend Setup**
```bash
cd ../frontend
npm install
```

---

### 🔐 Environment Variables

Create **`backend/.env`** (all optional — sensible defaults apply):
```env
PORT=5000
FRONTEND_ORIGIN=http://localhost:5173

# Optional — app falls back to keyword-only interpretation if unset
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
GEMINI_MODEL=gemini-1.5-flash

# Comma-separated bearer tokens accepted by protected endpoints
CLINICIAN_TOKENS=demo-token

# rural | urban | large_trauma — changes default wait thresholds & bed capacity
ED_PROFILE=urban

SURGE_MODE_DURATION_MINUTES=30
SURGE_THRESHOLD_MULTIPLIER=1.5
```

Create **`frontend/.env`**:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

### 🧑‍💻 Running the Application

**Start Backend (FastAPI)**
```bash
cd backend
uvicorn main:app --port 5000
# or: python main.py
```

**Start Frontend (Vite)**
```bash
cd frontend
npm run dev
```

App will be available at → [http://localhost:5173](http://localhost:5173)
Interactive API docs (Swagger UI) → [http://localhost:5000/docs](http://localhost:5000/docs)

---

### 🔑 Signing In as a Clinician

Read-only views (queue board, audit log, validation report, integration status) work without signing in. Any action that changes patient data requires a clinician session.

Use any name and the demo token:
```
Token (demo: demo-token)
```

From `/docs`, click **Authorize**, paste `demo-token`, and every protected endpoint becomes callable directly from the docs UI.

---

## 🧾 Self-Validation

`GET /api/validation-report` re-runs the scoring engine against 18 hand-labeled seed patient records and reports agreement. As of this build:

**16/18 exact matches · 2 over-triage · 0 under-triage** — both disagreements are over-triage (the safe direction), and zero cases were under-triaged. See `DESIGN_NOTES.md` for what this does and doesn't demonstrate.

---

## ⚡ Surge Simulation

`POST /api/surge` (with `{"count": N}`, requires auth) injects N patients drawn from the seed dataset and activates surge mode for `SURGE_MODE_DURATION_MINUTES`. Use a count of ~18+ to demonstrate 3x normal load holding up. While active, safe-wait thresholds for severity levels 3–5 are relaxed by `SURGE_THRESHOLD_MULTIPLIER` — **levels 1–2 are never relaxed**, under any circumstance.

---

## 🌱 Future Scope
- 🔗 **Real Hospital Integration** – Swap the mocked adapters for live EHR, bed-management, and staff-roster systems without touching scoring/queue logic (the adapter interfaces are already in place)
- 🔐 **Production-Grade Auth** – Individual clinician accounts, role-based authorization, token expiry/rotation, and encryption at rest/in transit (DPDP Act / HIPAA-aligned)
- 📊 **Persistent Storage** – Replace the in-memory repository with a real database for durability across restarts
- 🧪 **Formal Clinical Validation** – Review by licensed clinicians and testing against real patient outcome data, beyond the current hand-labeled seed set
- 🌍 **Multi-Language Intake** – Interpret chief complaints in multiple languages via the same AI-interpretation layer

---

## 📁 Project Structure

```
backend/
  main.py                       FastAPI entrypoint, CORS, exception handlers, background sweep
  app/
    config.py                   Env-driven settings, ED_PROFILE presets
    models.py                   Pydantic request/response schemas
    errors.py                   Normalized { error: { message, code } } shape
    auth.py                     require_clinician_auth dependency
    scoring/
      thresholds.py             Age-banded vital-sign threshold tables
      engine.py                 Deterministic hybrid red-flag + weighted scoring engine
    ai_interpretation.py        Gemini wrapper with graceful keyword-only fallback
    audit.py                    Append-only AuditLogRepository
    store.py                    In-memory PatientRepository + central AppState
    queue_engine.py             Wait-time computation, overdue flagging, live queue sort
    patient_service.py          Orchestration layer
    seed_data.py                18 hand-labeled seed patient records
    integration/
      adapters.py                Adapter interfaces + mock implementations
      service.py                  IntegrationService facade
    routers/
      patients.py                 /api/patients* endpoints
      misc.py                     Everything else
  API_EXAMPLES.md               Real example request/response per endpoint
  DESIGN_NOTES.md               Clinical grounding, limitations, design rationale
  requirements.txt

frontend/
  src/
    App.jsx                     Root component, polling, tab routing
    api/client.js                Typed API client with normalized error handling
    components/                  QueueBoard, PatientDetail, IntakeForm, OverrideForm,
                                  AuditLog, ValidationReport, SurgeControl, and more
    styles/index.css
```

---

## Link for testing:
- Live API docs: `http://localhost:5000/docs` (after starting the backend)
- Demo clinician token: `demo-token`
---
