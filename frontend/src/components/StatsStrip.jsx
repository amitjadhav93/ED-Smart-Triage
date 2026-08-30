import { SEVERITY_LABELS } from './SeverityBadge.jsx'

export default function StatsStrip({ stats, overrideRatePct }) {
  if (!stats) return null
  const { totalWaiting, avgWaitMinutes, overdueCount, byLevel = {} } = stats

  return (
    <div className="strip">
      <div className="strip__cell">
        <div className="label">Waiting</div>
        <div className="value mono">{totalWaiting ?? '—'}</div>
      </div>
      <div className="strip__cell">
        <div className="label">Avg Wait (min)</div>
        <div className="value mono">{avgWaitMinutes ?? '—'}</div>
      </div>
      <div className="strip__cell">
        <div className="label">Overdue</div>
        <div className="value mono" style={{ color: overdueCount > 0 ? 'var(--sev-1)' : undefined }}>
          {overdueCount ?? '—'}
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((lvl) => (
        <div className="strip__cell" key={lvl}>
          <div className="label">{SEVERITY_LABELS[lvl]}</div>
          <div className="value mono">{byLevel[String(lvl)] ?? byLevel[lvl] ?? 0}</div>
        </div>
      ))}
      {overrideRatePct !== undefined && overrideRatePct !== null && (
        <div className="strip__cell">
          <div className="label">Clinician Override Rate</div>
          <div className="value mono small">{overrideRatePct}%</div>
        </div>
      )}
    </div>
  )
}
