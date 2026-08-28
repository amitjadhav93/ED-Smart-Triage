/**
 * Renders the AI-interpreted chief-complaint output.
 * Deliberately styled with a different surface/border/tag than the
 * rule-based engine content, so a viewer can tell at a glance which
 * parts of the screen came from the language model vs. the deterministic
 * scoring engine.
 */
export default function AIInterpretationSection({ aiInterpretation, title }) {
  if (!aiInterpretation) return null;

  if (!aiInterpretation.available) {
    return (
      <div className="ai-block">
        <div className="ai-label-row">
          <span className="ai-tag">AI</span>
          <span className="ai-label-title">{title || "AI-Interpreted Summary"}</span>
        </div>
        <p className="ai-unavailable-note">
          AI interpretation unavailable for this patient — scoring proceeded
          using rule-based matching only.
        </p>
      </div>
    );
  }

  const { narrative, extractedSignals = [], missingFieldSuggestions = [], ambiguityDetected } =
    aiInterpretation;

  return (
    <div className="ai-block">
      <div className="ai-label-row">
        <span className="ai-tag">AI</span>
        <span className="ai-label-title">{title || "AI-Interpreted Summary"}</span>
        {ambiguityDetected && (
          <span className="ai-label-title" style={{ color: "#9a6b00", marginLeft: "auto" }}>
            Ambiguity flagged
          </span>
        )}
      </div>
      {narrative && <p className="ai-narrative">“{narrative}”</p>}
      {extractedSignals.length > 0 && (
        <div className="chip-row">
          {extractedSignals.map((sig) => (
            <span className="chip" key={sig}>
              {sig}
            </span>
          ))}
        </div>
      )}
      {missingFieldSuggestions.length > 0 && (
        <ul className="ai-suggestions">
          {missingFieldSuggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
