import { SeverityBadge } from "./Common";

function formatWait(mins) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export default function QueueBoard({ patients, onSelect }) {
  if (!patients) return null;
  if (patients.length === 0) {
    return <div className="empty-text">No patients currently waiting.</div>;
  }

  return (
    <div className="panel">
      <table className="queue-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Complaint</th>
            <th>Severity</th>
            <th>Confidence</th>
            <th>Wait</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr
              key={p.id}
              className={`queue-row ${p.isOverdue ? "is-overdue" : ""}`}
              onClick={() => onSelect(p.id)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(p.id);
              }}
            >
              <td>
                <div className="patient-name">{p.name}</div>
                <div className="patient-meta">
                  {p.age}y · {p.ageGroup}
                  {p.isOverridden && (
                    <span className="overridden-tag" style={{ marginLeft: "6px" }}>
                      ✓ overridden
                    </span>
                  )}
                </div>
              </td>
              <td>{p.chiefComplaint}</td>
              <td>
                <SeverityBadge level={p.severityLevel} label={p.severityLabel} />
              </td>
              <td>
                <span className={`confidence-tag ${p.confidence?.level === "low" ? "low" : ""}`}>
                  {p.confidence?.level}
                </span>
              </td>
              <td>
                <span className={`wait-time ${p.isOverdue ? "overdue" : ""}`}>
                  {formatWait(p.waitTimeMinutes)}
                </span>
              </td>
              <td>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(p.id);
                  }}
                >
                  Detail →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
