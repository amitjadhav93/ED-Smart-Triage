import { useEffect, useState } from 'react'
import { getAuditLog, ApiError } from '../api/client.js'
import { SEVERITY_LABELS } from './SeverityBadge.jsx'
import ErrorBanner from './ErrorBanner.jsx'

const TRIGGER_LABELS = {
  'wait-threshold': 'Wait threshold exceeded',
  'vitals-update': 'Vitals updated'
}

export default function AuditLog({ patientsById }) {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getAuditLog()
      .then((data) => { if (!cancelled) setEntries(data) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load the audit log.') })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <h2>Audit Log</h2>
      <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: -6, marginBottom: 12 }}>
        Immutable record of every severity change — clinician overrides and automatic
        re-triage events, newest first.
      </p>
      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {entries === null && !error && <div className="loading-line">Loading audit log…</div>}
      {entries?.length === 0 && <div className="empty-state">No audit entries yet</div>}

      {entries?.length > 0 && (
        <div className="ledger">
          <div className="ledger-row ledger-header">
            <div>Timestamp</div>
            <div>Patient</div>
            <div>Event</div>
            <div>Trigger / Clinician</div>
            <div>Change</div>
            <div>Reason</div>
          </div>
          {entries.map((e) => {
            const patient = patientsById?.[e.patientId]
            const isMutedAutoOnOverridden = e.eventType === 'auto-retriage' && patient?.isOverridden
            return (
              <div className={`ledger-row ${isMutedAutoOnOverridden ? 'muted' : ''}`} key={e.id}>
                <div>{new Date(e.timestamp).toLocaleString()}</div>
                <div>{e.patientName}</div>
                <div>
                  <span className={`event-type ${e.eventType}`}>
                    {e.eventType === 'override' ? 'Override' : 'Auto-Retriage'}
                  </span>
                </div>
                <div>
                  {e.eventType === 'override'
                    ? (e.clinicianName || 'System')
                    : (TRIGGER_LABELS[e.trigger] || e.trigger || '—')}
                </div>
                <div>{SEVERITY_LABELS[e.previousLevel]} → {SEVERITY_LABELS[e.newLevel]}</div>
                <div>{e.reason}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
