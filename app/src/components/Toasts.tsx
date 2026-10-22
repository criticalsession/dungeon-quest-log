import { useQuests } from '../store/quests'
import { useToasts } from '../store/toasts'

/** Toasts and the connection banner live outside the stage, over the table. */
export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  const connection = useQuests((s) => s.connection)

  return (
    <>
      {connection === 'reconnecting' && (
        <p className="connection-banner" role="status">
          The connection to the archive wavers… reconnecting.
        </p>
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((t, i) => (
          <p key={t.id} className="toast" style={{ ['--tilt' as string]: i % 2 ? '1deg' : '-1deg' }}>
            {t.before}
            {t.title && <em>{t.title}</em>}
            {t.after}
          </p>
        ))}
      </div>
    </>
  )
}
