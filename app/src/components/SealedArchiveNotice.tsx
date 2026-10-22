export function SealedArchiveNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="notice" role="alert">
      <h2 className="page-heading">The archive is sealed</h2>
      <p>
        We can&rsquo;t reach the party&rsquo;s records. If the game has been on a long break, the database may be
        asleep; whoever runs the Supabase project can restore it from the dashboard.
      </p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
