const TIERS = [
  { key: 'critical', label: 'Critical Beds', color: 'var(--sev-1)' },
  { key: 'urgent', label: 'Urgent Beds', color: 'var(--sev-3)' },
  { key: 'nonUrgent', label: 'Non-Urgent Beds', color: 'var(--sev-5)' }
]

export default function BedStrip({ beds }) {
  if (!beds) return null
  const available = beds.available || {}

  return (
    <div className="bed-strip">
      {TIERS.map((t) => {
        const n = available[t.key]
        return (
          <div className="bed-strip__cell" key={t.key} style={{ '--tier-color': t.color }}>
            <span className="label">{t.label}</span>
            <span className="value mono" style={{ color: n === 0 ? 'var(--sev-1)' : undefined }}>
              {n ?? '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
