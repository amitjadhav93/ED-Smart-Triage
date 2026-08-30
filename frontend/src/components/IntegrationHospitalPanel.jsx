import { useEffect, useState } from 'react'
import { getIntegrationStatus, getConfig } from '../api/client.js'
import { SEVERITY_LABELS } from './SeverityBadge.jsx'
import ErrorBanner from './ErrorBanner.jsx'

const ADAPTER_LABELS = {
  patientRecords: 'Patient Records',
  bedManagement: 'Bed Management',
  staffRoster: 'Staff Roster'
}

export default function IntegrationHospitalPanel() {
  const [integration, setIntegration] = useState(null)
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([getIntegrationStatus(), getConfig()])
      .then(([i, c]) => { if (!cancelled) { setIntegration(i); setConfig(c) } })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load system status.') })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <h2>Integration Status &amp; Hospital Profile</h2>
      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {!integration && !config && !error && <div className="loading-line">Loading system status…</div>}

      {integration && (
        <div className="panel">
          <h3>Integration Status</h3>
          <p style={{ fontSize: 13 }}>
            Mode: <strong>{integration.mode === 'standalone' ? 'Standalone / Demo Mode' : integration.mode}</strong>
          </p>
          <div className="field-row">
            {Object.entries(integration.adapters || {}).map(([key, status]) => (
              <div key={key} className="strip__cell" style={{ border: '1px solid var(--color-border-soft)' }}>
                <div className="label">{ADAPTER_LABELS[key] || key}</div>
                <div className="value small mono" style={{ textTransform: 'capitalize' }}>{status}</div>
              </div>
            ))}
          </div>
          <p className="note-line">
            This prototype runs in standalone mode with simulated hospital-system
            adapters. In a real deployment, these would connect to the hospital's
            actual patient records, bed management, and staffing systems without
            changing the triage logic itself.
          </p>
        </div>
      )}

      {config && (
        <div className="panel">
          <h3>Hospital Profile: {config.edProfile}</h3>
          <div className="grid-2">
            <div>
              <h4 style={{ fontSize: 12 }}>Safe Wait Threshold (minutes)</h4>
              <table className="config-table">
                <thead>
                  <tr><th>Severity Level</th><th>Threshold</th></tr>
                </thead>
                <tbody>
                  {Object.entries(config.safeWaitThresholdMinutes || {}).map(([lvl, mins]) => (
                    <tr key={lvl}>
                      <td>{SEVERITY_LABELS[lvl] || lvl}</td>
                      <td className="mono">{mins} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 style={{ fontSize: 12 }}>Bed Capacity</h4>
              <table className="config-table">
                <thead>
                  <tr><th>Tier</th><th>Capacity</th></tr>
                </thead>
                <tbody>
                  {Object.entries(config.bedCapacity || {}).map(([tier, cap]) => (
                    <tr key={tier}>
                      <td style={{ textTransform: 'capitalize' }}>{tier}</td>
                      <td className="mono">{cap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="note-line">
            This configuration is set per deployment (e.g. rural clinic vs. large
            trauma center) via environment variable — the underlying scoring and
            queue logic is identical across hospital types, only these operating
            parameters change.
          </p>
        </div>
      )}
    </div>
  )
}
