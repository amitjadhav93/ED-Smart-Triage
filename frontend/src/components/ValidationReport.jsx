import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { severityMeta } from "../constants";
import { ErrorBanner, Empty, Loading } from "./Common";

export default function ValidationReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getValidationReport();
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load validation report.");
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
    <div>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {loading && <Loading text="Loading validation report…" />}

      {!loading && report && (
        <>
          <div className="validation-summary">
            <div className="validation-cell">
              <div className="big-stat">{report.agreementPct}%</div>
              <div className="stat-label">
                Exact Agreement ({report.exactAgreement}/{report.totalCases} cases)
              </div>
            </div>
            <div className="validation-cell">
              <div className="big-stat">{report.overTriageCount}</div>
              <div className="stat-label">Over-Triage</div>
            </div>
            <div className="validation-cell under">
              <div className={`big-stat ${report.underTriageCount > 0 ? "nonzero" : ""}`}>
                {report.underTriageCount}
              </div>
              <div className="stat-label">Under-Triage</div>
            </div>
          </div>

          <p className="validation-note">
            Agreement measured against the team's own hand-labeled expectations on simulated
            data — not a formal clinical validation.
          </p>

          <div className="panel">
            <div className="panel-header">Seed Cases</div>
            <div className="panel-body">
              {report.cases?.length ? (
                <div className="ledger">
                  <div className="ledger-row header" style={{ gridTemplateColumns: "1fr 1fr 1fr 130px" }}>
                    <span>Case</span>
                    <span>Expected</span>
                    <span>Computed</span>
                    <span>Outcome</span>
                  </div>
                  {report.cases.map((c) => (
                    <div
                      className="ledger-row"
                      style={{ gridTemplateColumns: "1fr 1fr 1fr 130px" }}
                      key={c.id}
                    >
                      <span>{c.name}</span>
                      <span>{severityMeta(c.expectedSeverityLevel).label}</span>
                      <span>{severityMeta(c.computedSeverityLevel).label}</span>
                      <span>
                        <span className={`outcome-tag ${c.outcome}`}>{c.outcome}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="No seed cases returned." />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
