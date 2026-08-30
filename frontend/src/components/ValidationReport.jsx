import { useEffect, useState } from 'react'
import { getValidationReport } from '../api/client.js'
import { SEVERITY_LABELS } from './SeverityBadge.jsx'
import ErrorBanner from './ErrorBanner.jsx'

export default function ValidationReport() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getValidationReport()
      .then((data) => { if (!cancelled) setReport(data) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load the validation report.') })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <h2>Validation Report</h2>
      <p className="note-line" style={{ marginBottom: 14 }}>
        Agreement measured against the team's own hand-labeled expectations on
        simulated data — not a formal clinical validation.
      </p>
      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {!report && !error && <div className="loading-line">Loading validation report…</div>}

      {report && (
        <>
          <div className="panel">
            <div className="agreement-hero">
              <span className="big mono">{report.agreementPct}%</span>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: 13 }}>
                  Exact Agreement
                </div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {report.exactAgreement} of {report.totalCases} cases
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <div className="strip__cell" style={{ border: '1px solid var(--color-border-soft)' }}>
                <div className="label">Over-triage</div>
                <div className="value mono small">{report.overTriageCount}</div>
              </div>
              <div className={report.underTriageCount > 0 ? 'under-triage-flag' : 'strip__cell'}
                   style={report.underTriageCount === 0 ? { border: '1px solid var(--color-border-soft)' } : undefined}>
                {report.underTriageCount > 0 ? (
                  <>Under-triage: {report.underTriageCount} case(s) — review priority</>
                ) : (
                  <>
                    <div className="label">Under-triage</div>
                    <div className="value mono small">0</div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Seed Cases</h3>
            <table className="case-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Expected</th>
                  <th>Computed</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {report.cases?.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{SEVERITY_LABELS[c.expectedSeverityLevel]}</td>
                    <td>{SEVERITY_LABELS[c.computedSeverityLevel]}</td>
                    <td><span className={`outcome-tag ${c.outcome}`}>{c.outcome}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
