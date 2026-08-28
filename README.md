# ED-Smart-Triage

# PatientTriage.ai — ED Smart Triage Assistant

**AI-powered clinical decision support for emergency department patient prioritization.**

> ⚠️ This is a hackathon prototype built on simulated data for demonstration purposes. It is **not** a validated clinical tool and must not be used to make real patient care decisions. See [Limitations](#limitations--validation-status) below.

---

## The Problem

In a hospital emergency department, deciding who gets seen first depends almost entirely on one nurse's judgment, made in seconds, often with incomplete information. Existing tools mostly score one patient at a time — but the real challenge is managing an entire, constantly shifting queue as new patients arrive and others keep waiting. This gets even harder in worst-case conditions: mass-casualty events, missing records, or patients who can't communicate — exactly when the least information is available and the stakes are highest.

**Core question:** How can we help nurses make faster, safer, more consistent triage decisions — without ever taking that decision out of their hands?

## Our Approach

PatientTriage.ai is a decision-**support** tool, not a decision-**maker**. It ranks and explains patient urgency across a live, continuously updating queue, while every final call always stays with the clinician.

### Key features

- **🚦 Two-tier assessment** — an instant assessment works even with minimal data (chief complaint, age, breathing, consciousness), and sharpens as vitals and history become available.
- **🧠 Hybrid AI + rules scoring** — a transparent, rule-based red-flag layer (e.g. hypoxia, unresponsiveness, stroke symptoms) sets a safety floor, refined by a weighted scoring layer across vitals, pain, and history. **The AI never makes the severity decision itself.**
- **💬 AI-assisted intake understanding** — a Gemini language model call parses messy, real-world free-text complaints ("kinda woozy, chest feels weird") into structured clinical signals and a plain-language summary, feeding into the scoring engine as an *additional signal* — never as the decision-maker. Falls back gracefully to keyword matching if the AI call is unavailable, so triage never depends on it succeeding.
- **📋 Live, continuously re-ranked queue** — patients aren't scored once and forgotten. The queue re-sorts as data changes and time passes.
- **⏱ Automatic re-triage on wait time** — if a patient's wait exceeds a severity-adjusted safe threshold, the system flags them for reassessment automatically.
- **✅ One-tap clinician override, always preserved** — a nurse can override any recommendation instantly, with a required reason. The override is logged and takes effect immediately — automatic re-triage never silently overwrites a clinician's decision; it only updates the AI's own recommendation for comparison.
- **🔍 Explainable, always** — every patient shows *why* a severity was recommended (red flags / reasoning), separately from *how confident* the system is, and separately again from what the AI language model interpreted from free text. These three are never blurred together.
- **🧒 Age-differentiated scoring** — infant (<3 months), pediatric, adult, and geriatric patients are scored against different vital-sign norms, since the same raw number means something different at different ages.
- **⚖️ Safety-first defaults** — under uncertainty or ambiguous presentations, urgency is only ever rounded **up**, never down.
- **⚡ Surge simulation** — inject a burst of simulated patients to demonstrate the queue and scoring holding up under 3× normal load.
- **📊 Self-validation report** — the system checks its own scoring against a hand-labeled expected outcome for every seed patient, and reports agreement and (critically) under-triage rate transparently in the app itself.
- **🔒 Immutable audit log** — every override and auto re-triage event is timestamped and permanently logged, for accountability and regulatory compliance.

---

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│   Frontend (React/Vite) │  HTTP   │   Backend (Node.js/Express)   │
│                          │ ──────► │                                │
│  Live Queue Board        │         │  Rule-based red-flag engine   │
│  Intake Form             │         │  Weighted scoring engine      │
│  Patient Detail/Override │         │  Age-adjusted thresholds      │
│  Audit Log               │         │  Queue + re-triage engine     │
│  Surge Control           │         │  Override + audit log         │
│  Validation Report       │         │  Gemini AI intake interpreter │
└─────────────────────────┘         └──────────────────────────────┘
```

The AI (Gemini) component is scoped narrowly and deliberately: it interprets *language*, not *risk*. The actual triage decision always comes from transparent, auditable rules and scoring — this is a deliberate clinical-safety and explainability choice, not a limitation.

---

## Tech Stack

- **Frontend:** React (Vite), plain CSS
- **Backend:** Node.js, Express, in-memory data store (structured behind a repository layer so a real database is a contained future swap-in)
- **AI:** Google Gemini API (`gemini-1.5-flash`) for free-text intake interpretation, with graceful fallback to keyword matching

---

## Getting Started

### Backend
```bash
cd backend
npm install
cp .env.example .env   # set GEMINI_API_KEY (optional — app runs in fallback mode without it)
npm start
```
Runs on `http://localhost:5000` by default (`PORT` env var to override).

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL if backend isn't on localhost:5000
npm run dev
```
Runs on `http://localhost:5173` by default.

> The backend seeds several patients into the live queue on startup and reserves additional seed records for the surge-simulation endpoint, so the board is populated immediately on first load.

---

## API Overview

| Endpoint | Description |
|---|---|
| `POST /api/patients` | Register a new patient; returns severity, confidence, flags, and AI interpretation |
| `GET /api/patients` | Live, priority-sorted queue |
| `GET /api/patients/:id` | Full detail for one patient |
| `POST /api/patients/:id/override` | Clinician override (level + reason + name, required) |
| `GET /api/patients/:id/retriage` | Manually re-score a patient |
| `PATCH /api/patients/:id/status` | Mark in-treatment / discharged |
| `GET /api/audit-log` | Full immutable audit trail |
| `POST /api/surge` | Inject a burst of simulated patients |
| `GET /api/stats` | Live queue statistics |
| `GET /api/validation-report` | Self-check: scoring agreement vs. hand-labeled expectations |

Full request/response examples: see `API_EXAMPLES.md` in the backend directory.

---

## Design Notes, Assumptions & Clinical Grounding

Full detail lives in `DESIGN_NOTES.md`, including:
- Which established scales (ESI, NEWS2, PEWS) loosely informed our age-band thresholds
- How this differs from standard ESI-based manual triage and from prior ML-assisted triage approaches
- A stated integration/adoption pathway into real hospital systems (records, bed management, staffing) — noted as future work, out of scope for this prototype
- The full self-validation report and what it does and doesn't prove

## Regulatory / Data Assumption

This prototype assumes **India's Digital Personal Data Protection Act (DPDP), 2023** as its illustrative jurisdiction for consent and audit-trail design. A different jurisdiction (e.g. HIPAA, GDPR) would primarily change retention/consent language, not the underlying audit mechanism.

## Limitations & Validation Status

- All patient data is **simulated**; no real patient records were used.
- Scoring thresholds are **loosely informed by** established clinical scales but are an illustrative simplification, not a calibrated or clinically validated instrument.
- The self-validation report measures agreement against **our own hand-labeled expectations** on invented seed data — it is not a formal clinical validation study, and has not been reviewed by a licensed clinician.
- Before any real-world use, this system would require: real clinical review, a formal validation study against actual patient outcomes, and integration testing with real hospital systems.
- The AI (Gemini) component is used only to interpret free-text language, never to make or influence the final severity decision beyond feeding in as one additional signal alongside rule-based keyword matching.

---

## Team

*(add your name(s)/team name here)*

## License

*(add your chosen license here, e.g. MIT)*
