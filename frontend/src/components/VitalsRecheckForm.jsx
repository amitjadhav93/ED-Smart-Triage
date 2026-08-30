import { useState } from 'react'
import { updatePatientVitals, ApiError } from '../api/client.js'
import ErrorBanner from './ErrorBanner.jsx'

export default function VitalsRecheckForm({ patient, auth, onUpdated, onRequireAuth }) {
  const v = patient.vitals || {}
  const [form, setForm] = useState({
    heartRate: v.heartRate ?? '',
    bpSystolic: v.bpSystolic ?? '',
    bpDiastolic: v.bpDiastolic ?? '',
    temperature: v.temperature ?? '',
    spo2: v.spo2 ?? '',
    respRate: v.respRate ?? ''
  })
  const [initial] = useState(form)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!auth) { onRequireAuth?.(); return }
    setError('')
    setConfirmation('')
    setSubmitting(true)
    try {
      const payload = {}
      for (const [k, val] of Object.entries(form)) {
        if (val !== '' && String(val) !== String(initial[k])) payload[k] = Number(val)
      }
      if (Object.keys(payload).length === 0) {
        setError('Change at least one value before re-checking.')
        setSubmitting(false)
        return
      }
      const updated = await updatePatientVitals(patient.id, payload, auth.token)
      onUpdated(updated)
      setConfirmation(
        updated.deteriorationDetected
          ? 'Updated — this patient\u2019s condition appears to have worsened; severity re-assessed accordingly.'
          : 'Vitals updated.'
      )
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onRequireAuth?.('Session token invalid or missing — please sign in again')
      } else {
        setError(err.message || 'Could not update vitals.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (patient.status !== 'waiting') return null

  return (
    <div className="panel">
      <h3>Re-check Vitals</h3>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      {confirmation && (
        <div className={`banner ${confirmation.startsWith('Updated —') ? 'banner--info' : 'banner--info'}`} style={{ marginBottom: 10 }}>
          {confirmation}
        </div>
      )}
      <form onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label>Heart rate (bpm)</label>
            <input type="number" value={form.heartRate} onChange={(e) => update('heartRate', e.target.value)} />
          </div>
          <div className="field">
            <label>BP systolic</label>
            <input type="number" value={form.bpSystolic} onChange={(e) => update('bpSystolic', e.target.value)} />
          </div>
          <div className="field">
            <label>BP diastolic</label>
            <input type="number" value={form.bpDiastolic} onChange={(e) => update('bpDiastolic', e.target.value)} />
          </div>
          <div className="field">
            <label>Temperature (°C)</label>
            <input type="number" step="0.1" value={form.temperature} onChange={(e) => update('temperature', e.target.value)} />
          </div>
          <div className="field">
            <label>SpO2 (%)</label>
            <input type="number" value={form.spo2} onChange={(e) => update('spo2', e.target.value)} />
          </div>
          <div className="field">
            <label>Resp. rate</label>
            <input type="number" value={form.respRate} onChange={(e) => update('respRate', e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Re-check Vitals'}
        </button>
        {!auth && (
          <p className="ai-muted-note" style={{ marginTop: 8 }}>Sign in as a clinician to re-check vitals.</p>
        )}
      </form>
    </div>
  )
}
