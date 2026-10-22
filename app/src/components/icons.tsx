import type { QuestStatus } from '../store/quests'

/** Status marker for a list row: crimson diamond, hollow teal diamond, gold tick circle. */
export function StatusMarker({ status }: { status: QuestStatus }) {
  if (status === 'fulfilled') {
    return (
      <svg className="marker marker-done" aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="var(--status-done)" />
        <path d="M7 12l3.5 3.5L17 9" stroke="var(--on-crimson)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg className="marker" aria-hidden="true" viewBox="0 0 20 20">
      {status === 'active' ? (
        <>
          <path d="M10 1 L19 10 L10 19 L1 10 Z" fill="var(--status-active)" stroke="var(--crimson-edge)" />
          <path d="M10 5 L15 10 L10 15 L5 10 Z" fill="var(--crimson)" opacity=".6" />
        </>
      ) : (
        <path d="M10 1 L19 10 L10 19 L1 10 Z" fill="none" stroke="var(--status-hold)" strokeWidth="2" />
      )}
    </svg>
  )
}

/** Replaces the status marker while someone else is penning changes. */
export function PadlockIcon() {
  return (
    <svg className="marker marker-lock" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="var(--ink-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="1.5" fill="var(--ink-warning)" fillOpacity=".15" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function ChevronIcon() {
  return (
    <svg className="chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function QuillIcon() {
  return (
    <svg className="btn-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 4c-7 0-12 5-14 12l-2 4" />
      <path d="M20 4c0 6-4 11-11 12" />
      <path d="M9 14l5-5" />
    </svg>
  )
}
