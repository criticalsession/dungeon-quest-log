const LAST_NAME_KEY = 'dql.lastName'
const ACTIVE_NAME_KEY = 'dql.name'

export const MAX_NAME_LENGTH = 40

// Storage can throw (blocked site data), so every access is wrapped.
function read(store: () => Storage, key: string): string {
  try {
    return store().getItem(key) ?? ''
  } catch {
    return ''
  }
}

function write(store: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) store().removeItem(key)
    else store().setItem(key, value)
  } catch {
    // ignore: the name just won't be remembered
  }
}

/** The name last typed on this PC, used to pre-fill the login form. */
export const getLastName = () => read(() => localStorage, LAST_NAME_KEY)

/** The name this tab is acting as. Empty means "ask again". */
export const getActiveName = () => read(() => sessionStorage, ACTIVE_NAME_KEY)

export function setActiveName(name: string) {
  write(() => localStorage, LAST_NAME_KEY, name)
  write(() => sessionStorage, ACTIVE_NAME_KEY, name)
}

export const clearActiveName = () => write(() => sessionStorage, ACTIVE_NAME_KEY, null)
