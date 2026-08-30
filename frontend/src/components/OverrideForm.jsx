import { useState } from 'react'
import { overridePatient, ApiError } from '../api/client.js'
import { SEVERITY_LABELS } from './SeverityBadge.jsx'
import ErrorBanner from './ErrorBanner.jsx'

export default function OverrideForm({ patient, auth, onOverridden, onRequireAuth }) {
  const [level, setLevel] = useState(patient.severityLevel)
  const [clinicianName, setClinicianName] = useState(auth?.name || '')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!auth) { onRequireAuth?.(); return }
    if (!reason.trim()) { setError('A reason is required to override the severity level.'); return }
    setError('')
    setSubmitting(true)
    try {
      const updated = await overridePatient(
        patient.id,
        { newSeverityLevel: Number(level), reason: reason.trim(), clinicianName: clinicianName.trim() },
        auth.token
      )
      onOverridden(updated)
      setReason('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onRequireAuth?.('Session token invalid or missing — please sign in again')
      } else {
        setError(err.message || 'Could not apply override.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="panel">
      <h3>Clinician Override</h3>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <form onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label>New severity level <span className="required-mark">*</span></label>
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              {[1, 2, 3, 4, 5].map((l) => (
                <option key={l} value={l}>{l} — {SEVERITY_LABELS[l]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Clinician name <span className="required-mark">*</span></label>
            <input required value={clinicianName} onChange={(e) => setClinicianName(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Reason <span className="required-mark">*</span></label>
          <textarea
            required
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why does the effective level need to change?"
          />
        </div>
        <button type="submit" className="btn" disabled={submitting || !reason.trim()}>
          {submitting ? 'Applying…' : 'Apply Override'}
        </button>
        {!auth && (
          <p className="ai-muted-note" style={{ marginTop: 8 }}>Sign in as a clinician to override.</p>
        )}
      </form>
    </div>
  )
}
