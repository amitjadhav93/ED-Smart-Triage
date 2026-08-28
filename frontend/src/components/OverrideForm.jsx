import { useState } from "react";
import { api, ApiError } from "../api";
import { SEVERITY_LEVELS } from "../constants";
import { ErrorBanner } from "./Common";

export default function OverrideForm({ patient, onOverridden }) {
  const [level, setLevel] = useState(String(patient.severityLevel));
  const [clinicianName, setClinicianName] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError("A reason is required before an override can be submitted.");
      return;
    }
    if (!clinicianName.trim()) {
      setError("Clinician name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const updated = await api.overridePatient(patient.id, {
        newSeverityLevel: Number(level),
        reason: reason.trim(),
        clinicianName: clinicianName.trim(),
      });
      setConfirmed(true);
      setReason("");
      onOverridden?.(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit override.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {confirmed && (
        <div className="divergence-note" style={{ marginBottom: "10px" }}>
          Override recorded and logged to the audit trail.
        </div>
      )}
      <div className="form-grid">
        <div className="field">
          <label>
            New Severity Level <span className="required">*</span>
          </label>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {SEVERITY_LEVELS.map((s) => (
              <option key={s.level} value={s.level}>
                {s.level} — {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>
            Clinician Name <span className="required">*</span>
          </label>
          <input
            type="text"
            value={clinicianName}
            onChange={(e) => setClinicianName(e.target.value)}
          />
        </div>
        <div className="field span-2">
          <label>
            Reason <span className="required">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Clinical justification for this override…"
          />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit Override"}
        </button>
      </div>
    </form>
  );
}
