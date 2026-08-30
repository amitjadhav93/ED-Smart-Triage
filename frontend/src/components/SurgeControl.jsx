import { useState } from 'react'

export function SurgeBanner({ active, onEndSurge, ending }) {
  if (!active) return null
  return (
    <div className="banner banner--surge">
      <span>⚡ Surge Mode Active — lower-acuity wait thresholds temporarily relaxed</span>
      <button className="small" onClick={onEndSurge} disabled={ending}>
        {ending ? 'Ending…' : 'End Surge Mode'}
      </button>
    </div>
  )
}

const PRESETS = [5, 10, 15]

export default function SurgeControl({ onTriggerSurge, submitting, requireAuth }) {
  const [count, setCount] = useState(15)

  return (
    <div className="panel">
      <h3>Surge Simulation</h3>
      <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: -4 }}>
        Injects a burst of simulated patients to stress-test the live queue,
        re-prioritization, and bed availability under load.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map((p) => (
          <button
            key={p}
            className="btn btn--outline btn--sm"
            onClick={() => setCount(p)}
            type="button"
          >
            +{p} patients
          </button>
        ))}
        <input
          type="number"
          min="1"
          max="200"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          style={{ width: 80, border: '1px solid var(--color-border-soft)', padding: '6px 8px' }}
        />
        <button
          className="btn"
          onClick={() => onTriggerSurge(count)}
          disabled={submitting || !count}
        >
          {submitting ? 'Injecting…' : 'Trigger Surge'}
        </button>
      </div>
      {requireAuth && (
        <p className="ai-muted-note" style={{ marginTop: 8 }}>
          Sign in as a clinician to trigger a surge.
        </p>
      )}
    </div>
  )
}
