const longDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "2026-10-03" -> "3 October 2026". Built from the parts so the timezone can't shift the day. */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return longDate.format(new Date(Date.UTC(y, m - 1, d)))
}

const relative = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "2 hours ago", "yesterday", "just now". */
export function formatRelative(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return 'just now'
  for (const [unit, size] of UNITS) {
    if (abs >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return relative.format(Math.round(seconds / 60), 'minute')
}
