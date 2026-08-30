export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="banner banner--error">
      <span>{message}</span>
      {onDismiss && (
        <button className="small" onClick={onDismiss}>Dismiss</button>
      )}
    </div>
  )
}
