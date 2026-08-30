
export default function AIInterpretationBadge({ aiInterpretation, title = 'AI-Interpreted Summary' }) {
  if (!aiInterpretation) return null

  if (!aiInterpretation.available) {
    return (
      <div className="ai-block">
        <div className="ai-block__title">
          <span className="ai-tag">AI</span> {title}
        </div>
        <p className="ai-muted-note">
          AI interpretation unavailable for this patient — scoring proceeded using
          rule-based matching only.
        </p>
      </div>
    )
  }

  const { extractedSignals = [], narrative, missingFieldSuggestions = [], ambiguityDetected } = aiInterpretation

  return (
    <div className="ai-block">
      <div className="ai-block__title">
        <span className="ai-tag">AI</span> {title}
      </div>

      {narrative && <p className="ai-narrative">{narrative}</p>}

      {extractedSignals.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {extractedSignals.map((sig, i) => (
            <span className="ai-chip" key={i}>{sig}</span>
          ))}
        </div>
      )}

      {ambiguityDetected && (
        <p className="ai-muted-note" style={{ marginTop: 4 }}>
          The description was flagged as ambiguous by the interpreter.
        </p>
      )}

      {missingFieldSuggestions.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div className="ai-block__title" style={{ fontSize: 11 }}>Suggested additional info</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
            {missingFieldSuggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
