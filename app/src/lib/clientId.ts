const KEY = 'dql.clientId'

let cached: string | undefined

/** One id per browser tab, kept in sessionStorage so a reload of the same tab keeps it (plan 7.6). */
export function getClientId(): string {
  if (cached) return cached
  try {
    cached = sessionStorage.getItem(KEY) ?? undefined
    if (!cached) sessionStorage.setItem(KEY, (cached = crypto.randomUUID()))
  } catch {
    cached ??= crypto.randomUUID()
  }
  return cached
}
