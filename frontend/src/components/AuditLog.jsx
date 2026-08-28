import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { severityMeta } from "../constants";
import { ErrorBanner, Empty, Loading, SeveritySwatch } from "./Common";

export default function AuditLog() {
  const [entries, setEntries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getAuditLog();
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load audit log.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="panel">
      <div className="panel-header">Audit Log — Immutable Record</div>
      <div className="panel-body">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        {loading && <Loading text="Loading audit log…" />}
        {!loading && entries && entries.length === 0 && (
          <Empty text="No audit entries yet." />
        )}
        {!loading && entries && entries.length > 0 && (
          <div className="ledger">
            <div className="ledger-row header">
              <span>Timestamp</span>
              <span>Event</span>
              <span>Patient</span>
              <span>Level Change</span>
              <span>Reason</span>
              <span>Clinician</span>
            </div>
            {entries.map((e) => {
              const isAutoOnOverridden =
                e.eventType === "auto-retriage" && e.clinicianName == null;
              return (
                <div
                  className={`ledger-row ${isAutoOnOverridden ? "muted" : ""}`}
                  key={e.id}
                >
                  <span>{new Date(e.timestamp).toLocaleString()}</span>
                  <span>
                    <span className={`event-tag ${e.eventType}`}>{e.eventType}</span>
                  </span>
                  <span>{e.patientName}</span>
                  <span className="level-arrow">
                    <SeveritySwatch level={e.previousLevel} />
                    {severityMeta(e.previousLevel).label}
                    {" → "}
                    <SeveritySwatch level={e.newLevel} />
                    {severityMeta(e.newLevel).label}
                  </span>
                  <span>{e.reason}</span>
                  <span>{e.clinicianName || "System"}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
