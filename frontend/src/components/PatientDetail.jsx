import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { severityMeta } from "../constants";
import { ErrorBanner, Loading, SeverityBadge } from "./Common";
import AIInterpretationSection from "./AIInterpretationSection";
import OverrideForm from "./OverrideForm";

function formatWait(mins) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export default function PatientDetail({ patientId, onClose, onPatientChanged }) {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOverride, setShowOverride] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const p = await api.getPatient(patientId);
      setPatient(p);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load patient.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function handleRetriage() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.retriagePatient(patientId);
      setPatient(updated);
      onPatientChanged?.(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not re-triage patient.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(status) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.setPatientStatus(patientId, status);
      setPatient(updated);
      onPatientChanged?.(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="detail-drawer-header">
          <div>
            <h2>{patient?.name || "Patient"}</h2>
            {patient && (
              <span className="patient-meta">
                {patient.age}y · {patient.ageGroup} · {patient.gender} · {patient.status}
              </span>
            )}
          </div>
          <button className="detail-drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="detail-drawer-body">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />

          {loading && <Loading text="Loading patient…" />}

          {patient && !loading && (
            <>
              <div className="intake-result-headline">
                <SeverityBadge level={patient.severityLevel} label={patient.severityLabel} />
                {patient.isOverridden && (
                  <span className="overridden-tag">✓ clinician-set</span>
                )}
                <span className="intake-result-score">
                  score {patient.severityScore}/100 · wait{" "}
                  <span className={patient.isOverdue ? "wait-time overdue" : "wait-time"}>
                    {formatWait(patient.waitTimeMinutes)}
                  </span>
                </span>
              </div>

              {patient.aiRecommendedLevel !== patient.severityLevel && (
                <div className="divergence-note">
                  Currently: {severityMeta(patient.severityLevel).label} (clinician-set) · AI
                  recommends: {severityMeta(patient.aiRecommendedLevel).label}
                </div>
              )}

              <div className="status-actions">
                <button className="btn btn-ghost btn-sm" onClick={handleRetriage} disabled={busy}>
                  Re-run Retriage
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleStatus("in-treatment")}
                  disabled={busy || patient.status !== "waiting"}
                >
                  Mark In-Treatment
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleStatus("discharged")}
                  disabled={busy || patient.status === "discharged"}
                >
                  Discharge
                </button>
              </div>

              <div className="engine-block">
                <div className="engine-label-row">
                  <span className="engine-tag">ENGINE</span>
                  <span className="ai-label-title">Why this severity — flags</span>
                </div>
                {patient.flags?.length > 0 ? (
                  <ul className="flag-list">
                    {patient.flags.map((f) => (
                      <li key={f.id} className={`flag-item ${f.severity}`}>
                        <div>
                          <div className="flag-label">{f.label}</div>
                          <div className="flag-detail">{f.detail}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ai-suggestions" style={{ paddingLeft: 0 }}>
                    No flags recorded.
                  </p>
                )}
              </div>

              <div className="engine-block">
                <div className="engine-label-row">
                  <span className="engine-tag">ENGINE</span>
                  <span className="ai-label-title">Why this confidence</span>
                </div>
                <ul className="reason-list">
                  {(patient.confidence?.reasons || []).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <AIInterpretationSection
                aiInterpretation={patient.aiInterpretation}
                title="AI-Interpreted Summary"
              />

              <div className="panel">
                <div className="panel-header">Data</div>
                <div className="panel-body">
                  <div className="kv-grid">
                    <div className="kv-cell">
                      <div className="kv-label">Completeness</div>
                      <div className="kv-value">{patient.dataCompleteness}</div>
                    </div>
                    <div className="kv-cell">
                      <div className="kv-label">Consciousness</div>
                      <div className="kv-value">{patient.consciousness}</div>
                    </div>
                    <div className="kv-cell">
                      <div className="kv-label">Breathing</div>
                      <div className="kv-value">{patient.breathingStatus}</div>
                    </div>
                    <div className="kv-cell">
                      <div className="kv-label">Trauma</div>
                      <div className="kv-value">{patient.traumaSeverity}</div>
                    </div>
                    {patient.vitals &&
                      Object.entries(patient.vitals).some(([, v]) => v != null) && (
                        <>
                          {patient.vitals.heartRate != null && (
                            <div className="kv-cell">
                              <div className="kv-label">HR</div>
                              <div className="kv-value">{patient.vitals.heartRate}</div>
                            </div>
                          )}
                          {(patient.vitals.bpSystolic != null ||
                            patient.vitals.bpDiastolic != null) && (
                            <div className="kv-cell">
                              <div className="kv-label">BP</div>
                              <div className="kv-value">
                                {patient.vitals.bpSystolic ?? "?"}/
                                {patient.vitals.bpDiastolic ?? "?"}
                              </div>
                            </div>
                          )}
                          {patient.vitals.temperature != null && (
                            <div className="kv-cell">
                              <div className="kv-label">Temp °C</div>
                              <div className="kv-value">{patient.vitals.temperature}</div>
                            </div>
                          )}
                          {patient.vitals.spo2 != null && (
                            <div className="kv-cell">
                              <div className="kv-label">SpO2</div>
                              <div className="kv-value">{patient.vitals.spo2}%</div>
                            </div>
                          )}
                          {patient.vitals.respRate != null && (
                            <div className="kv-cell">
                              <div className="kv-label">Resp Rate</div>
                              <div className="kv-value">{patient.vitals.respRate}</div>
                            </div>
                          )}
                        </>
                      )}
                  </div>

                  {(patient.history?.medicalHistory?.length > 0 ||
                    patient.history?.medications?.length > 0 ||
                    patient.history?.allergies?.length > 0) && (
                    <div style={{ marginTop: "10px" }}>
                      {patient.history.medicalHistory?.length > 0 && (
                        <p className="field-hint">
                          <strong>History:</strong> {patient.history.medicalHistory.join(", ")}
                        </p>
                      )}
                      {patient.history.medications?.length > 0 && (
                        <p className="field-hint">
                          <strong>Medications:</strong> {patient.history.medications.join(", ")}
                        </p>
                      )}
                      {patient.history.allergies?.length > 0 && (
                        <p className="field-hint">
                          <strong>Allergies:</strong> {patient.history.allergies.join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {patient.overrideHistory?.length > 0 && (
                <div className="panel">
                  <div className="panel-header">Override History</div>
                  <div className="panel-body">
                    <ul className="reason-list">
                      {patient.overrideHistory.map((h, i) => (
                        <li key={i}>
                          <span className="mono">{new Date(h.timestamp).toLocaleString()}</span>
                          {" — "}
                          {severityMeta(h.previousLevel).label} → {severityMeta(h.newLevel).label}{" "}
                          by {h.clinicianName}: {h.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="panel">
                <div className="panel-header">
                  Clinician Override
                  {!showOverride && (
                    <button className="btn btn-sm" onClick={() => setShowOverride(true)}>
                      Override Severity
                    </button>
                  )}
                </div>
                {showOverride && (
                  <div className="panel-body">
                    <OverrideForm
                      patient={patient}
                      onOverridden={(updated) => {
                        setPatient(updated);
                        onPatientChanged?.(updated);
                      }}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
