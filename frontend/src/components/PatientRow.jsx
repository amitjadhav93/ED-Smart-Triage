import SeverityBadge from './SeverityBadge.jsx'

export default function PatientRow({ patient, onClick }) {
  const {
    name, age, ageGroup, chiefComplaint, severityLevel, severityLabel,
    confidence, waitTimeMinutes, isOverdue, isOverridden, bedConflict,
    assignedBedId, deteriorationDetected
  } = patient

  return (
    <div
      className={`queue-row ${isOverdue ? 'overdue' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
    >
      <div className={`queue-row__bar sev-${severityLevel}`} style={{ background: `var(--sev-${severityLevel})` }} />
      <div className="queue-row__cell">
        <div className="patient-name">{name}</div>
        <div className="patient-sub mono">#{patient.id?.slice(0, 8)}</div>
      </div>
      <div className="queue-row__cell">
        <div>{age}</div>
        <div className="patient-sub">{ageGroup}</div>
      </div>
      <div className="queue-row__cell">
        <div>{chiefComplaint}</div>
        <div className="marker-row">
          {isOverridden && <span className="tag tag--overridden">✓ Overridden</span>}
          {bedConflict && <span className="tag tag--bed-conflict">⚠ Bed conflict</span>}
          {deteriorationDetected && <span className="tag tag--deterioration">↓ Deteriorated</span>}
          {assignedBedId && <span className="tag tag--bed-id mono">Bed {assignedBedId}</span>}
        </div>
      </div>
      <div className="queue-row__cell">
        <SeverityBadge level={severityLevel} label={severityLabel} />
      </div>
      <div className="queue-row__cell">
        {confidence && (
          <span className={`confidence-pill confidence-${confidence.level}`}>{confidence.level}</span>
        )}
      </div>
      <div className="queue-row__cell">
        <span className={`wait-time mono ${isOverdue ? 'overdue' : ''}`}>{waitTimeMinutes}m</span>
      </div>
      <div className="queue-row__cell">
        <button className="btn btn--outline btn--sm" onClick={(e) => { e.stopPropagation(); onClick() }}>
          Details
        </button>
      </div>
    </div>
  )
}
