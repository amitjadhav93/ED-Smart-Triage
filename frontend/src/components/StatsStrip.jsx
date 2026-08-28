import { SEVERITY_LEVELS, severityMeta } from "../constants";

export default function StatsStrip({ stats }) {
  if (!stats) return null;
  const { totalWaiting, avgWaitMinutes, overdueCount, byLevel = {} } = stats;

  return (
    <div className="stats-strip">
      <div className="stat-cell">
        <div className="stat-label">Waiting</div>
        <div className="stat-value">{totalWaiting ?? "—"}</div>
      </div>
      <div className="stat-cell">
        <div className="stat-label">Avg Wait (min)</div>
        <div className="stat-value">
          {avgWaitMinutes != null ? Math.round(avgWaitMinutes) : "—"}
        </div>
      </div>
      <div className="stat-cell overdue">
        <div className="stat-label">Overdue</div>
        <div className="stat-value">{overdueCount ?? "—"}</div>
      </div>
      <div className="stat-cell by-level">
        {SEVERITY_LEVELS.map((s) => (
          <span className="by-level-chip" key={s.level} title={s.label}>
            <span className={`by-level-dot ${s.key}`} style={{ background: `var(--${s.key})` }} />
            {byLevel[String(s.level)] ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}
