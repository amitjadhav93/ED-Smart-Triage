import { useState } from "react";
import { api, ApiError } from "../api";
import { ErrorBanner } from "./Common";

const PRESETS = [5, 15, 30];

export default function SurgeControl({ onSurge }) {
  const [count, setCount] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  async function fire(n) {
    setError(null);
    setStatus(null);
    setSubmitting(true);
    try {
      const res = await api.triggerSurge(n);
      setStatus(`Injected ${res.injected?.length ?? n} patients — queue size now ${res.queueSize}.`);
      onSurge?.(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not trigger surge.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">Surge Stress-Test</div>
      <div className="panel-body">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <div className="surge-panel">
          <div className="surge-preset-row">
            {PRESETS.map((n) => (
              <button
                key={n}
                className="btn btn-ghost btn-sm"
                disabled={submitting}
                onClick={() => fire(n)}
              >
                +{n} patients
              </button>
            ))}
          </div>
          <input
            type="number"
            min="1"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
          <button className="btn btn-sm" disabled={submitting} onClick={() => fire(count)}>
            {submitting ? "Injecting…" : "Trigger Custom Surge"}
          </button>
          {status && <span className="surge-status">{status}</span>}
        </div>
      </div>
    </div>
  );
}
