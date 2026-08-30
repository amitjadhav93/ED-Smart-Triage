import { useEffect, useState } from 'react'

const TABS = [
  { id: 'board', label: 'Queue Board' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'validation', label: 'Validation Report' },
  { id: 'system', label: 'Integration & Profile' }
]

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function TopBar({ auth, onSignInClick, onSignOut, activeTab, onTabChange }) {
  const now = useClock()
  const timeStr = now.toLocaleTimeString('en-GB', { hour12: false })
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <div className="top-bar">
        <div className="top-bar__brand">
          <h1>ED Smart Triage</h1>
          <span className="subtitle">Clinical Decision Support — Live Board</span>
        </div>
        <div className="top-bar__right">
          <div className="clock mono">{dateStr} · {timeStr}</div>
          {auth ? (
            <div className="clinician-chip">
              <span>{auth.name}</span>
              <button className="linklike" onClick={onSignOut}>Sign out</button>
            </div>
          ) : (
            <button className="linklike" onClick={onSignInClick}>Clinician Sign In</button>
          )}
        </div>
      </div>
      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={activeTab === t.id ? 'active' : ''}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </>
  )
}
