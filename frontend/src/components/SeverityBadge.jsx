export const SEVERITY_LABELS = {
  1: 'Critical',
  2: 'Emergent',
  3: 'Urgent',
  4: 'Less Urgent',
  5: 'Non-Urgent'
}

export default function SeverityBadge({ level, label, small }) {
  if (!level) return null
  const text = label || SEVERITY_LABELS[level] || `Level ${level}`
  return (
    <span className={`sev-badge sev-${level}`} style={small ? { fontSize: 11, padding: '1px 6px' } : undefined}>
      {text}
    </span>
  )
}
