import { STATUS_LABEL, type QuestStatus } from '../store/quests'

const COLOUR: Record<QuestStatus, string> = {
  active: 'var(--status-active)',
  on_hold: 'var(--status-hold)',
  fulfilled: 'var(--status-done)',
}

/** The seal beside a quest's title. Archived quests get an ash-grey one, whatever their status. */
export function WaxSeal({ status, archived, plain }: { status: QuestStatus; archived: boolean; plain?: boolean }) {
  const label = archived ? 'Archived' : STATUS_LABEL[status]
  const colour = archived ? 'var(--status-archive)' : COLOUR[status]
  return (
    <svg
      className="wax-seal"
      role={plain ? undefined : 'img'}
      aria-label={plain ? undefined : label}
      aria-hidden={plain || undefined}
      viewBox="0 0 90 90" style={{ ['--seal' as string]: colour }}>
      <path
        d="M45 3 C55 6 60 2 66 8 C74 12 80 14 82 24 C88 32 86 40 87 46 C88 56 82 62 80 70 C74 78 66 80 58 85 C50 88 40 88 32 84 C22 82 16 76 10 68 C4 60 4 52 3 44 C4 34 8 26 14 18 C22 10 32 4 45 3 Z"
        fill="var(--seal)"
      />
      <circle cx="45" cy="45" r="30" fill="none" stroke="color-mix(in srgb, var(--seal) 60%, black)" strokeWidth="2" />
      <circle cx="45" cy="45" r="26" fill="color-mix(in srgb, var(--seal) 85%, white)" />
      <path
        d="M45 26 L50 40 L64 40 L53 49 L57 63 L45 54 L33 63 L37 49 L26 40 L40 40 Z"
        fill="color-mix(in srgb, var(--seal) 60%, black)"
      />
      {!plain && (
        <text x="45" y="80" textAnchor="middle" className="wax-seal-label">
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  )
}
