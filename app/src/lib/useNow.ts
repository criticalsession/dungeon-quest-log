import { useEffect, useState } from 'react'

/** The current time, refreshed every `ms`, so relative times ("2 hours ago") stay fresh. */
export function useNow(ms: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}
