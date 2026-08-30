import { useState } from 'react'
import { createPatient, ApiError } from '../api/client.js'
import SeverityBadge from './SeverityBadge.jsx'
import AIInterpretationBadge from './AIInterpretationBadge.jsx'
import ErrorBanner from './ErrorBanner.jsx'

function TagListInput({ label, values, onChange, placeholder }) {
  const [draft, setDraft] = useState('')

  function add() {
    const v = draft.trim()
    if (!v) return
    onChange([...values, v])
    setDraft('')
  }

  function remove(i) {
    onChange(values.filter((_, idx) => idx !== i))
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div className="tag-list-input">
        {values.map((v, i) => (
          <span className="chip" key={i}>
            {v}
            <button type="button" onClick={() => remove(i)} aria-label={`Remove ${v}`}>×</button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          }}
          onBlur={add}
        />
      </div>
    </div>
  )
}

const EMPTY_VITALS = { heartRate: '', bpSystolic: '', bpDiastolic: '', temperature: '', spo2: '', respRate: '' }

export default function IntakeForm({ auth, onCreated, onClose, onRequireAuth }) {
  const [form, setForm] = useState({
    name: '', age: '', gender: '', chiefComplaint: '',
    consciousness: 'A', breathingStatus: 'normal', traumaSeverity: 'none'
  })
  const [vitals, setVitals] = useState(EMPTY_VITALS)
  const [medicalHistory, setMedicalHistory] = useState([])
  const [medications, setMedications] = useState([])
  const [allergies, setAllergies] = useState([])
  const [enrichmentOpen, setEnrichmentOpen] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function buildVitalsPayload() {
    const out = {}
    for (const [k, v] of Object.entries(vitals)) {
      if (v !== '' && v !== null) out[k] = Number(v)
    }
    return Object.keys(out).length ? out : undefined
  }

  function buildHistoryPayload() {
    if (!medicalHistory.length && !medications.length && !allergies.length) return undefined
    return { medicalHistory, medications, allergies }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!auth) { onRequireAuth?.(); return }
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        name: form.name,
        age: Number(form.age),
        gender: form.gender,
        chiefComplaint: form.chiefComplaint,
        consciousness: form.consciousness,
        breathingStatus: form.breathingStatus,
        traumaSeverity: form.traumaSeverity,
        vitals: buildVitalsPayload(),
        history: buildHistoryPayload()
      }
      const patient = await createPatient(payload, auth.token)
      setResult(patient)
      onCreated?.(patient)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onRequireAuth?.('Session token invalid or missing — please sign in again')
      } else {
        setError(err.message || 'Could not register this patient.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="panel">
        <h2>Patient Registered</h2>
        <p style={{ marginTop: -4 }}>{result.name} has been added to the queue.</p>

        {result.bedConflict && (
          <div className="banner banner--info" style={{ marginBottom: 12 }}>
            No critical bed currently available — this patient has been added to the
            queue and flagged for clinician review.
          </div>
        )}

        <div className="engine-block">
          <div className="engine-block__title">Rule-Based Engine Result</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <SeverityBadge level={result.severityLevel} label={result.severityLabel} />
            <span className="mono">Score: {result.severityScore}/100</span>
            {result.confidence && (
              <span className={`confidence-pill confidence-${result.confidence.level}`}>
                Confidence: {result.confidence.level}
              </span>
            )}
          </div>
          {result.flags?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {result.flags.map((f) => (
                <div className="flag-row" key={f.id}>
                  <span className={`flag-sev ${f.severity}`}>{f.severity}</span>
                  <span><strong>{f.label}</strong> — {f.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <AIInterpretationBadge
          aiInterpretation={result.aiInterpretation}
          title="AI-interpreted from your description"
        />

        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={onClose}>Back to queue</button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <h2>New Patient Intake</h2>
      <ErrorBanner message={error} onDismiss={() => setError('')} />

      <form onSubmit={handleSubmit}>
        <div className="field-row">
          <div className="field">
            <label>Name <span className="required-mark">*</span></label>
            <input required value={form.name} onChange={(e) => update('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Age <span className="required-mark">*</span></label>
            <input required type="number" step="any" min="0" max="130" value={form.age} onChange={(e) => update('age', e.target.value)} />
          </div>
          <div className="field">
            <label>Gender <span className="required-mark">*</span></label>
            <input required value={form.gender} onChange={(e) => update('gender', e.target.value)} placeholder="e.g. female" />
          </div>
        </div>

        <div className="field">
          <label>Chief complaint <span className="required-mark">*</span></label>
          <textarea
            required
            rows={2}
            value={form.chiefComplaint}
            onChange={(e) => update('chiefComplaint', e.target.value)}
            placeholder="Describe in the patient's or reporter's own words"
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label>Consciousness (AVPU) <span className="required-mark">*</span></label>
            <select value={form.consciousness} onChange={(e) => update('consciousness', e.target.value)}>
              <option value="A">Alert (A)</option>
              <option value="V">Verbal (V)</option>
              <option value="P">Pain (P)</option>
              <option value="U">Unresponsive (U)</option>
            </select>
          </div>
          <div className="field">
            <label>Breathing status <span className="required-mark">*</span></label>
            <select value={form.breathingStatus} onChange={(e) => update('breathingStatus', e.target.value)}>
              <option value="normal">Normal</option>
              <option value="labored">Labored</option>
              <option value="absent">Absent</option>
            </select>
          </div>
          <div className="field">
            <label>Trauma severity <span className="required-mark">*</span></label>
            <select value={form.traumaSeverity} onChange={(e) => update('traumaSeverity', e.target.value)}>
              <option value="none">None</option>
              <option value="minor">Minor</option>
              <option value="severe">Severe</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          className="collapsible-toggle"
          onClick={() => setEnrichmentOpen((o) => !o)}
        >
          {enrichmentOpen ? '▾' : '▸'} Optional: vitals & history
        </button>

        {enrichmentOpen && (
          <div className="panel" style={{ background: 'var(--color-panel-alt)' }}>
            <h3 style={{ fontSize: 13 }}>Vitals (all optional)</h3>
            <div className="field-row">
              <div className="field">
                <label>Heart rate (bpm)</label>
                <input type="number" value={vitals.heartRate} onChange={(e) => setVitals((v) => ({ ...v, heartRate: e.target.value }))} />
              </div>
              <div className="field">
                <label>BP systolic</label>
                <input type="number" value={vitals.bpSystolic} onChange={(e) => setVitals((v) => ({ ...v, bpSystolic: e.target.value }))} />
              </div>
              <div className="field">
                <label>BP diastolic</label>
                <input type="number" value={vitals.bpDiastolic} onChange={(e) => setVitals((v) => ({ ...v, bpDiastolic: e.target.value }))} />
              </div>
              <div className="field">
                <label>Temperature (°C)</label>
                <input type="number" step="0.1" value={vitals.temperature} onChange={(e) => setVitals((v) => ({ ...v, temperature: e.target.value }))} />
              </div>
              <div className="field">
                <label>SpO2 (%)</label>
                <input type="number" value={vitals.spo2} onChange={(e) => setVitals((v) => ({ ...v, spo2: e.target.value }))} />
              </div>
              <div className="field">
                <label>Resp. rate</label>
                <input type="number" value={vitals.respRate} onChange={(e) => setVitals((v) => ({ ...v, respRate: e.target.value }))} />
              </div>
            </div>

            <h3 style={{ fontSize: 13, marginTop: 8 }}>History</h3>
            <TagListInput label="Medical history" values={medicalHistory} onChange={setMedicalHistory} placeholder="Add condition, Enter" />
            <TagListInput label="Medications" values={medications} onChange={setMedications} placeholder="Add medication, Enter" />
            <TagListInput label="Allergies" values={allergies} onChange={setAllergies} placeholder="Add allergy, Enter" />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Registering…' : 'Register Patient'}
          </button>
          <button type="button" className="btn btn--outline" onClick={onClose}>Cancel</button>
        </div>
        {!auth && (
          <p className="ai-muted-note" style={{ marginTop: 8 }}>
            You'll be asked to sign in as a clinician when you submit.
          </p>
        )}
      </form>
    </div>
  )
}
