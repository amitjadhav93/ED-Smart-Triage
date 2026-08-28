import { useState } from "react";
import { api, ApiError } from "../api";
import {
  CONSCIOUSNESS_OPTIONS,
  BREATHING_OPTIONS,
  TRAUMA_OPTIONS,
} from "../constants";
import { ErrorBanner, SeverityBadge } from "./Common";
import AIInterpretationSection from "./AIInterpretationSection";

const EMPTY_FORM = {
  name: "",
  age: "",
  gender: "",
  chiefComplaint: "",
  consciousness: "A",
  breathingStatus: "normal",
  traumaSeverity: "none",
  heartRate: "",
  bpSystolic: "",
  bpDiastolic: "",
  temperature: "",
  spo2: "",
  respRate: "",
  medicalHistory: [],
  medications: [],
  allergies: [],
};

function TagListField({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div className="tag-input-row">
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={addTag}>
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="tag-list">
          {items.map((item, i) => (
            <span className="tag-pill" key={`${item}-${i}`}>
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IntakeForm({ onPatientCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setResult(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.name || !form.age || !form.gender || !form.chiefComplaint) {
      setError("Name, age, gender, and chief complaint are required.");
      return;
    }

    const numOrUndefined = (v) => (v === "" || v == null ? undefined : Number(v));

    const vitals = {
      heartRate: numOrUndefined(form.heartRate),
      bpSystolic: numOrUndefined(form.bpSystolic),
      bpDiastolic: numOrUndefined(form.bpDiastolic),
      temperature: numOrUndefined(form.temperature),
      spo2: numOrUndefined(form.spo2),
      respRate: numOrUndefined(form.respRate),
    };
    const hasVitals = Object.values(vitals).some((v) => v !== undefined);

    const history = {
      medicalHistory: form.medicalHistory,
      medications: form.medications,
      allergies: form.allergies,
    };
    const hasHistory =
      history.medicalHistory.length || history.medications.length || history.allergies.length;

    const payload = {
      name: form.name,
      age: Number(form.age),
      gender: form.gender,
      chiefComplaint: form.chiefComplaint,
      consciousness: form.consciousness,
      breathingStatus: form.breathingStatus,
      traumaSeverity: form.traumaSeverity,
      ...(hasVitals ? { vitals } : {}),
      ...(hasHistory ? { history } : {}),
    };

    setSubmitting(true);
    try {
      const patient = await api.createPatient(payload);
      setResult(patient);
      onPatientCreated?.(patient);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not register patient.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">Patient Intake</div>
      <div className="panel-body">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {result ? (
          <div className="intake-result">
            <div className="intake-result-headline">
              <SeverityBadge level={result.severityLevel} label={result.severityLabel} />
              <span className="intake-result-score">
                score {result.severityScore}/100 · confidence {result.confidence?.level} (
                {result.confidence?.score})
              </span>
            </div>

            {result.flags?.length > 0 && (
              <div className="engine-block">
                <div className="engine-label-row">
                  <span className="engine-tag">ENGINE</span>
                  <span className="ai-label-title">Why this severity — rule-based flags</span>
                </div>
                <ul className="flag-list">
                  {result.flags.map((f) => (
                    <li key={f.id} className={`flag-item ${f.severity}`}>
                      <div>
                        <div className="flag-label">{f.label}</div>
                        <div className="flag-detail">{f.detail}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <AIInterpretationSection
              aiInterpretation={result.aiInterpretation}
              title="AI-interpreted from your description"
            />

            <div className="btn-row">
              <button className="btn" onClick={resetForm}>
                Register Another Patient
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>
                  Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>
                  Age <span className="required">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.age}
                  onChange={(e) => update("age", e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>
                  Gender <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={form.gender}
                  onChange={(e) => update("gender", e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>
                  Consciousness (AVPU) <span className="required">*</span>
                </label>
                <select
                  value={form.consciousness}
                  onChange={(e) => update("consciousness", e.target.value)}
                >
                  {CONSCIOUSNESS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>
                  Breathing Status <span className="required">*</span>
                </label>
                <select
                  value={form.breathingStatus}
                  onChange={(e) => update("breathingStatus", e.target.value)}
                >
                  {BREATHING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>
                  Trauma Severity <span className="required">*</span>
                </label>
                <select
                  value={form.traumaSeverity}
                  onChange={(e) => update("traumaSeverity", e.target.value)}
                >
                  {TRAUMA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field span-2">
                <label>
                  Chief Complaint <span className="required">*</span>
                </label>
                <textarea
                  value={form.chiefComplaint}
                  onChange={(e) => update("chiefComplaint", e.target.value)}
                  placeholder="Describe the patient's condition in their own words…"
                  required
                />
                <span className="field-hint">
                  This free text is interpreted by the AI assistant for signal chips and a
                  narrative — it never sets severity by itself.
                </span>
              </div>
            </div>

            <details className="disclosure">
              <summary>Enrichment — vitals &amp; history (optional)</summary>
              <div className="disclosure-body">
                <div className="form-grid">
                  <div className="field">
                    <label>Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={form.heartRate}
                      onChange={(e) => update("heartRate", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>SpO2 (%)</label>
                    <input
                      type="number"
                      value={form.spo2}
                      onChange={(e) => update("spo2", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>BP Systolic</label>
                    <input
                      type="number"
                      value={form.bpSystolic}
                      onChange={(e) => update("bpSystolic", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>BP Diastolic</label>
                    <input
                      type="number"
                      value={form.bpDiastolic}
                      onChange={(e) => update("bpDiastolic", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Temperature (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.temperature}
                      onChange={(e) => update("temperature", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Respiratory Rate</label>
                    <input
                      type="number"
                      value={form.respRate}
                      onChange={(e) => update("respRate", e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-grid" style={{ marginTop: "12px" }}>
                  <TagListField
                    label="Medical History"
                    items={form.medicalHistory}
                    onChange={(v) => update("medicalHistory", v)}
                    placeholder="e.g. diabetes"
                  />
                  <TagListField
                    label="Medications"
                    items={form.medications}
                    onChange={(v) => update("medications", v)}
                    placeholder="e.g. metformin"
                  />
                  <TagListField
                    label="Allergies"
                    items={form.allergies}
                    onChange={(v) => update("allergies", v)}
                    placeholder="e.g. penicillin"
                  />
                </div>
              </div>
            </details>

            <div className="btn-row">
              <button className="btn" type="submit" disabled={submitting}>
                {submitting ? "Registering…" : "Register Patient"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
