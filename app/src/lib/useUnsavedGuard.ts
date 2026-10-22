import { useEffect, type RefObject } from 'react'
import { useBlocker } from 'react-router'

// One flag for the whole app, so "Close the book" can ask the same question as in-app navigation.
let unsaved = false
export const hasUnsaved = () => unsaved
export const clearUnsaved = () => {
  unsaved = false
}

/**
 * Guards an editor with unsaved changes. In-app navigation is blocked (render the returned blocker in a
 * confirm dialog); closing or reloading the tab gets the browser's own prompt. Set `allow.current` just
 * before a navigation that must go through (after sealing the entry).
 */
export function useUnsavedGuard(dirty: boolean, allow: RefObject<boolean>) {
  useEffect(() => {
    unsaved = dirty
    return () => {
      unsaved = false
    }
  }, [dirty])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // Only a change of page counts: the ribbons just change the query string.
  return useBlocker(({ currentLocation, nextLocation }) => unsaved && !allow.current && currentLocation.pathname !== nextLocation.pathname)
}

/** True when the draft differs from what editing started with. The description is compared as normalised HTML. */
export function normaliseHtml(html: string) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.innerHTML
}
