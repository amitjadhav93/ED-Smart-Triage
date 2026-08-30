import { useState } from 'react'

export default function SignInPanel({ onSignIn, onClose, forcedMessage }) {
  const [name, setName] = useState('')
  const [token, setToken] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!name.trim() || !token.trim()) return
    onSignIn({ name: name.trim(), token: token.trim() })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Clinician Sign-In</h2>
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 12 }}>
          Required before any action that changes patient data. Read-only views
          (the board, audit log, reports) don't need this.
        </p>

        {forcedMessage && (
          <div className="banner banner--info" style={{ marginBottom: 12 }}>{forcedMessage}</div>
        )}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="clinician-name">Clinician name <span className="required-mark">*</span></label>
            <input
              id="clinician-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. R. Sharma"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="clinician-token">Token <span className="required-mark">*</span></label>
            <input
              id="clinician-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Token (demo: demo-token)"
              required
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" className="btn">Sign in</button>
            {onClose && (
              <button type="button" className="btn btn--outline" onClick={onClose}>
                Continue read-only
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
