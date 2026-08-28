import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import Clock from "./components/Clock";
import { ErrorBanner, Loading } from "./components/Common";
import StatsStrip from "./components/StatsStrip";
import QueueBoard from "./components/QueueBoard";
import PatientDetail from "./components/PatientDetail";
import IntakeForm from "./components/IntakeForm";
import SurgeControl from "./components/SurgeControl";
import AuditLog from "./components/AuditLog";
import ValidationReport from "./components/ValidationReport";

const TABS = [
  { id: "board", label: "Triage Board" },
  { id: "intake", label: "Intake" },
  { id: "audit", label: "Audit Log" },
  { id: "validation", label: "Validation" },
];

const POLL_INTERVAL_MS = 7000;

export default function App() {
  const [tab, setTab] = useState("board");
  const [patients, setPatients] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [patientList, statsRes] = await Promise.all([
        api.listPatients(),
        api.getStats(),
      ]);
      setPatients(patientList.filter((p) => p.status === "waiting"));
      setStats(statsRes);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the triage server.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => refresh({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="app-shell">
      <header className="board-header">
        <div className="board-header-inner">
          <div className="board-title">
            ED Smart Triage <small>SIMULATED DATA — PROTOTYPE</small>
          </div>
          <nav className="tab-nav">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "active" : ""}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <Clock />
        </div>
      </header>

      <main className="app-main">
        {tab === "board" && (
          <>
            <div className="view-heading">
              <h1>Live Triage Board</h1>
              <span className="view-subtext">
                Auto-refreshes every {POLL_INTERVAL_MS / 1000}s · click a row for full breakdown
              </span>
            </div>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <StatsStrip stats={stats} />
            <div style={{ marginBottom: "16px" }}>
              <SurgeControl onSurge={() => refresh({ silent: true })} />
            </div>
            {loading && !patients ? (
              <Loading text="Loading queue…" />
            ) : (
              <QueueBoard patients={patients} onSelect={setSelectedId} />
            )}
          </>
        )}

        {tab === "intake" && (
          <>
            <div className="view-heading">
              <h1>Patient Intake</h1>
              <span className="view-subtext">Registers a patient and returns the initial triage result</span>
            </div>
            <IntakeForm onPatientCreated={() => refresh({ silent: true })} />
          </>
        )}

        {tab === "audit" && (
          <>
            <div className="view-heading">
              <h1>Audit Log</h1>
              <span className="view-subtext">Every override and automatic re-triage, newest first</span>
            </div>
            <AuditLog />
          </>
        )}

        {tab === "validation" && (
          <>
            <div className="view-heading">
              <h1>Validation Report</h1>
              <span className="view-subtext">Scoring engine checked against hand-labeled seed cases</span>
            </div>
            <ValidationReport />
          </>
        )}
      </main>

      {selectedId && (
        <PatientDetail
          patientId={selectedId}
          onClose={() => setSelectedId(null)}
          onPatientChanged={() => refresh({ silent: true })}
        />
      )}

      <div className="footer-note">
        ED Smart Triage Assistant — prototype on simulated data. Not for clinical use.
      </div>
    </div>
  );
}
