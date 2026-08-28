import { severityMeta } from "../constants";

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="error-banner" role="alert">
      <strong>Notice —</strong>
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

export function SeverityBadge({ level, label }) {
  const meta = severityMeta(level);
  return (
    <span className={`severity-badge ${meta.key}`}>
      <span className="sev-num">{level}</span>
      {label || meta.label}
    </span>
  );
}

export function SeveritySwatch({ level }) {
  const meta = severityMeta(level);
  return <span className={`severity-swatch ${meta.key}`} aria-hidden="true" />;
}

export function Loading({ text = "Loading…" }) {
  return <div className="loading-text">{text}</div>;
}

export function Empty({ text }) {
  return <div className="empty-text">{text}</div>;
}
