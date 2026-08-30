import { useState } from 'react'
import SeverityBadge, { SEVERITY_LABELS } from './SeverityBadge.jsx'
import AIInterpretationBadge from './AIInterpretationBadge.jsx'
import OverrideForm from './OverrideForm.jsx'
import VitalsRecheckForm from './VitalsRecheckForm.jsx'
import ErrorBanner from './ErrorBanner.jsx'
import { updatePatientStatus, ApiError } from '../api/client.js'

function VitalsList({ vitals }) {
  if (!vitals) return null
  const entries = [
    ['Heart rate', vitals.heartRate, 'bpm'],
    ['BP', vitals.bpSystolic != null && vitals.bpDiastolic != null ? `${vitals.bpSystolic}/${vitals.bpDiastolic}` : null, 'mmHg'],
    ['Temperature', vitals.temperature, '°C'],
    ['SpO2', vitals.spo2, '%'],
    ['Resp. rate', vitals.respRate, '/min']
  ].filter(([, v]) => v !== null && v !== undefined)

  if (entries.length === 0) return <p className="ai-muted-note">No vitals recorded.</p>

  return (
    <div className="field-row">
      {entries.map(([label, val, unit]) => (
        <div key={label}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</div>
          <div className="mono">{val} {unit}</div>
        </div>
      ))}
    </div>
  )
}

function HistoryList({ history }) {
  if (!history) return null
  const { medicalHistory = [], medications = [], allergies = [] } = history
  if (!medicalHistory.length && !medications.length && !allergies.length) {
    return <p className="ai-muted-note">No history recorded.</p>
  }
  return (
    <div>
      {medicalHistory.length > 0 && <p><strong>History:</strong> {medicalHistory.join(', ')}</p>}
      {medications.length > 0 && <p><strong>Medications:</strong> {medications.join(', ')}</p>}
      {allergies.length > 0 && <p><strong>Allergies:</strong> {allergies.join(', ')}</p>}
    </div>
  )
}

export default function PatientDetail({ patient, auth, onClose, onUpdated, onRequireAuth }) {
  const [error, setError] = useState('')
  const [statusSubmitting, setStatusSubmitting] = useState(false)

  async function setStatus(status) {
    if (!auth) { onRequireAuth?.(); return }
    setError('')
    setStatusSubmitting(true)
    try {
      const updated = await updatePatientStatus(patient.id, status, auth.token)
      onUpdated(updated)
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onRequireAuth?.('Session token invalid or missing — please sign in again')
      } else {
        setError(err.message || 'Could not update status.')
      }
    } finally {
      setStatusSubmitting(false)
    }
  }

  const showRecommendationDiff = patient.aiRecommendedLevel && patient.aiRecommendedLevel !== patient.severityLevel

  return (
    <div className="detail-backdrop" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="detail-panel__head">
          <div>
            <h2 style={{ marginBottom: 2 }}>{patient.name}</h2>
            <div className="patient-sub">
              {patient.age} yrs · {patient.ageGroup} · {patient.gender} · <span className="mono">#{patient.id?.slice(0, 8)}</span>
            </div>
          </div>
          <button className="close-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <ErrorBanner message={error} onDismiss={() => setError('')} />

        <div className="panel">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
            <SeverityBadge level={patient.severityLevel} label={patient.severityLabel} />
            {patient.isOverridden && <span className="tag tag--overridden">✓ Clinician-set</span>}
            <span className="mono" style={{ fontSize: 12 }}>Score {patient.severityScore}/100</span>
            {patient.confidence && (
              <span className={`confidence-pill confidence-${patient.confidence.level}`}>
                Confidence: {patient.confidence.level} ({patient.confidence.score})
              </span>
            )}
          </div>

          {showRecommendationDiff && (
            <p style={{ fontSize: 13 }}>
              Currently: <strong>{SEVERITY_LABELS[patient.severityLevel]}</strong> (clinician-set) · AI recommends:{' '}
              <strong>{SEVERITY_LABELS[patient.aiRecommendedLevel]}</strong>
            </p>
          )}

          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
            Chief complaint: {patient.chiefComplaint}
          </p>

          <div className="marker-row" style={{ marginBottom: 4 }}>
            {patient.isOverdue && <span className="tag" style={{ borderColor: 'var(--sev-1)', color: 'var(--sev-1)' }}>Overdue</span>}
            {patient.bedConflict && <span className="tag tag--bed-conflict">⚠ Bed conflict</span>}
            {patient.deteriorationDetected && <span className="tag tag--deterioration">↓ Deterioration detected</span>}
            {patient.assignedBedId && <span className="tag tag--bed-id mono">Bed {patient.assignedBedId}</span>}
            <span className="tag">{patient.dataCompleteness} data</span>
          </div>
          <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Waited {patient.waitTimeMinutes}m of {patient.safeWaitThresholdMinutes}m safe threshold
          </p>
        </div>

        <div className="engine-block">
          <div className="engine-block__title">Why this severity — rule-based flags</div>
          {patient.flags?.length ? patient.flags.map((f) => (
            <div className="flag-row" key={f.id}>
              <span className={`flag-sev ${f.severity}`}>{f.severity}</span>
              <span><strong>{f.label}</strong> — {f.detail}</span>
            </div>
          )) : <p className="ai-muted-note">No flags raised.</p>}
        </div>

        <div className="engine-block">
          <div className="engine-block__title">Why this confidence</div>
          {patient.confidence?.reasons?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
              {patient.confidence.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          ) : <p className="ai-muted-note">No confidence reasons provided.</p>}
        </div>

        <AIInterpretationBadge aiInterpretation={patient.aiInterpretation} />

        <div className="panel">
          <h3>Vitals</h3>
          <VitalsList vitals={patient.vitals} />
        </div>

        <div className="panel">
          <h3>History</h3>
          <HistoryList history={patient.history} />
        </div>

        <div className="panel">
          <h3>Override History</h3>
          {patient.overrideHistory?.length ? patient.overrideHistory.map((o, i) => (
            <div key={i} style={{ fontSize: 12.5, borderBottom: '1px dashed var(--color-border-soft)', padding: '5px 0' }}>
              <span className="mono">{new Date(o.timestamp).toLocaleString()}</span> — {o.clinicianName}:{' '}
              {SEVERITY_LABELS[o.previousLevel]} → {SEVERITY_LABELS[o.newLevel]}. "{o.reason}"
            </div>
          )) : <p className="ai-muted-note">No overrides yet.</p>}
        </div>

        {patient.status === 'waiting' && (
          <>
            <OverrideForm patient={patient} auth={auth} onOverridden={onUpdated} onRequireAuth={onRequireAuth} />
            <VitalsRecheckForm patient={patient} auth={auth} onUpdated={onUpdated} onRequireAuth={onRequireAuth} />

            <div className="panel">
              <h3>Patient Status</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--outline" disabled={statusSubmitting} onClick={() => setStatus('in-treatment')}>
                  Mark In-Treatment
                </button>
                <button className="btn btn--outline" disabled={statusSubmitting} onClick={() => setStatus('discharged')}>
                  Mark Discharged
                </button>
              </div>
              {!auth && (
                <p className="ai-muted-note" style={{ marginTop: 8 }}>Sign in as a clinician to change status.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
