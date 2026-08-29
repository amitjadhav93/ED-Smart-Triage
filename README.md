<div>

# PatientTriage.ai — ED Smart Triage Assistant

### AI-powered clinical decision support for emergency department patient prioritization

</div>

<br>

> **⚠️ Prototype notice**
> Built on simulated data for a hackathon demo. Not a validated clinical tool — not for real patient care decisions. See [Limitations](#-limitations--validation-status).

<br>

## The Problem

In a busy ED, one nurse decides who gets seen first — in seconds, often with incomplete information. Existing tools score one patient at a time. Nobody manages the *whole queue* as it constantly shifts, new patients arrive, and others keep waiting.

**The question we set out to answer:**
> How do we help nurses triage faster and more consistently — without ever taking the decision out of their hands?

<br>

## Our Approach

PatientTriage.ai **recommends, it never decides.** It ranks and explains patient urgency across a live queue — the clinician always makes the final call.

<br>

## ✨ Key Features

| | Feature | What it does |
|---|---|---|
| 🚦 | **Two-tier assessment** | Works instantly on minimal data, sharpens as vitals/history arrive |
| 🧠 | **Hybrid AI + rules scoring** | Transparent red-flag rules set a safety floor; weighted scoring refines within it |
| 💬 | **AI intake understanding** | Gemini parses messy free-text complaints into structured signals — feeds the scoring engine, never decides it |
| 📋 | **Live re-ranked queue** | Patients are never scored once and forgotten |
| ⏱️ | **Auto re-triage** | Flags anyone whose wait exceeds a safe threshold for their severity |
| ✅ | **One-tap override** | Clinician can override instantly; the AI's own read is preserved, never erased |
| 🔍 | **Layered explainability** | *Why* it's severe, *how confident* it is, and *what the AI parsed* — always shown separately |
| 🧒 | **Age-differentiated scoring** | Infant, pediatric, adult, and geriatric bands use different vital-sign norms |
| ⚖️ | **Safety-first defaults** | Uncertainty rounds urgency **up**, never down |
| ⚡ | **Surge simulation** | Stress-test the queue under 3× patient load |
| 📊 | **Self-validation report** | Scoring checked against hand-labeled expectations, in-app |
| 🔒 | **Immutable audit log** | Every override and auto re-triage, timestamped forever |

<br>

## 🏗️ Architecture

```
┌───────────────────────────┐        ┌───────────────────────────────┐
│  Frontend — React / Vite  │        │  Backend — Node.js / Express   │
│                            │  HTTP  │                                 │
│  • Live Queue Board        │◄──────►│  • Red-flag rule engine         │
│  • Intake Form             │        │  • Weighted scoring engine      │
│  • Patient Detail/Override │        │  • Age-adjusted thresholds      │
│  • Audit Log               │        │  • Queue + re-triage engine     │
│  • Surge Control           │        │  • Override + audit log         │
│  • Validation Report       │        │  • Gemini intake interpreter    │
└───────────────────────────┘        └───────────────────────────────┘
```

The AI component is scoped narrowly on purpose — it interprets *language*, never *risk*. The severity decision always comes from transparent, auditable logic.

<br>

## 🧰 Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React (Vite), plain CSS |
| Backend | Node.js, Express, in-memory store (repository-layered for an easy future DB swap) |
| AI | Google Gemini API (`gemini-1.5-flash`), graceful fallback to keyword matching |

<br>

## 🚀 Getting Started

### Backend

```bash
cd backend
npm install
cp .env.example .env    # set GEMINI_API_KEY — optional, runs in fallback mode without it
npm start
```
→ `http://localhost:5000` (override with `PORT`)

### Frontend

```bash
cd frontend
npm install
cp .env.example .env    # set VITE_API_BASE_URL if backend isn't on localhost:5000
npm run dev
```
→ `http://localhost:5173`

> 💡 The backend seeds a handful of patients into the live queue on startup, so the board is populated immediately — the rest of the seed set is reserved for the surge-simulation endpoint.

<br>

## 📡 API Overview

| Endpoint | Description |
|---|---|
| `POST /api/patients` | Register a patient → returns severity, confidence, flags, AI interpretation |
| `GET /api/patients` | Live, priority-sorted queue |
| `GET /api/patients/:id` | Full detail for one patient |
| `POST /api/patients/:id/override` | Clinician override (level + reason + name) |
| `GET /api/patients/:id/retriage` | Manually re-score a patient |
| `PATCH /api/patients/:id/status` | Mark in-treatment / discharged |
| `GET /api/audit-log` | Full immutable audit trail |
| `POST /api/surge` | Inject a burst of simulated patients |
| `GET /api/stats` | Live queue statistics |
| `GET /api/validation-report` | Self-check: scoring vs. hand-labeled expectations |

📄 Full request/response examples: [`backend/API_EXAMPLES.md`](./backend/API_EXAMPLES.md)

<br>

## 📓 Design Notes & Clinical Grounding

Full detail in [`DESIGN_NOTES.md`](./DESIGN_NOTES.md):

- Clinical scales that loosely informed our thresholds (ESI, NEWS2, PEWS)
- How this differs from manual ESI triage and prior ML-triage approaches
- A stated integration path into real hospital systems *(future work)*
- Full self-validation results

**Regulatory assumption:** India's Digital Personal Data Protection Act (DPDP), 2023 — a different jurisdiction would mainly change consent/retention wording, not the audit mechanism itself.

<br>

## ⚠️ Limitations & Validation Status

- All data is **simulated** — no real patient records were used
- Thresholds are **loosely informed by** clinical scales, not clinically calibrated or validated
- The validation report checks agreement against **our own hand-labels** — not a formal clinical study, and not reviewed by a licensed clinician
- Real-world use would require: clinical review, a formal validation study, and integration testing with real hospital systems
- The Gemini component only interprets language — it never influences severity beyond feeding in as one additional signal alongside rule-based matching

<br>

---

<div align="center">

**Team:** *(add your name(s) here)*
**License:** *(add your chosen license here)*

</div>
