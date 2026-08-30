import PatientRow from './PatientRow.jsx'
import StatsStrip from './StatsStrip.jsx'
import BedStrip from './BedStrip.jsx'
import SurgeControl, { SurgeBanner } from './SurgeControl.jsx'

export default function QueueBoard({
  patients, stats, beds, auth, surgeActive,
  onSelectPatient, onOpenIntake, onTriggerSurge, onEndSurge,
  surgeSubmitting, surgeEnding
}) {
  const waiting = patients.filter((p) => p.status === 'waiting')

  return (
    <div>
      <SurgeBanner active={surgeActive} onEndSurge={onEndSurge} ending={surgeEnding} />

      <StatsStrip stats={stats} overrideRatePct={stats?.overrideRatePct} />
      <BedStrip beds={beds} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Live Priority Queue</h2>
        <button className="btn" onClick={onOpenIntake}>+ New Patient Intake</button>
      </div>

      {waiting.length === 0 ? (
        <div className="empty-state">No patients currently waiting</div>
      ) : (
        <div className="queue-table">
          <div className="queue-header">
            <div></div>
            <div>Patient</div>
            <div>Age</div>
            <div>Complaint</div>
            <div>Severity</div>
            <div>Confidence</div>
            <div>Wait</div>
            <div></div>
          </div>
          {waiting.map((p) => (
            <PatientRow key={p.id} patient={p} onClick={() => onSelectPatient(p.id)} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <SurgeControl
          onTriggerSurge={onTriggerSurge}
          submitting={surgeSubmitting}
          requireAuth={!auth}
        />
      </div>
    </div>
  )
}
