import { useEffect, useLayoutEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Toasts } from './Toasts'

export const STAGE_W = 2000
export const STAGE_H = 1333

// Ribbons stick out up to about 110 px past the book's right edge, so the fit
// width is wider than the stage. The book always fills the window width and is
// pinned to the top, whatever the window's ratio, so it looks the same everywhere.
// The bottom is cropped, and the pages shrink to the visible height and scroll
// inside (see .page in book.css).
const FIT_W = 2240
const PAGE_TOP = 180
const PAGE_MAX_H = 870
const PAGE_BOTTOM_GAP = 70
// Design px that must stay visible: enough for full-height pages, so ultrawide windows
// (wider than about 2:1) shrink the book instead of squashing the pages.
const MIN_VISIBLE_H = PAGE_TOP + PAGE_MAX_H + PAGE_BOTTOM_GAP // 1120

// Below 900 px wide, or in portrait, the book is dropped for one scrolling column (plan 9.2).
const NARROW_QUERY = '(max-width: 899px), (orientation: portrait)'

const measure = () => {
  const scale = Math.min(window.innerWidth / FIT_W, window.innerHeight / MIN_VISIBLE_H)
  const visibleH = window.innerHeight / scale
  return {
    scale,
    pageH: Math.max(400, Math.min(PAGE_MAX_H, visibleH - PAGE_TOP - PAGE_BOTTOM_GAP)),
  }
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

export function Stage() {
  const [m, setM] = useState(measure)
  const narrow = useNarrow()
  const { pathname } = useLocation()

  useEffect(() => {
    const onResize = () => setM(measure())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // In the single column the quest sits below the list, so opening one brings it into view.
  useLayoutEffect(() => {
    if (!narrow) return
    const scroll = () => {
      if (/^\/(quest|new)/.test(pathname)) document.querySelector('.stage-narrow .page-right')?.scrollIntoView({ block: 'start' })
      else document.querySelector('.stage-narrow')?.scrollTo({ top: 0 })
    }
    scroll()
    // The editor takes its content a moment later (it waits for the lock), which would leave the page short at first.
    const later = setTimeout(scroll, 300)
    return () => clearTimeout(later)
  }, [narrow, pathname])

  return (
    <>
    <main
      className={narrow ? 'stage stage-narrow' : 'stage'}
      style={
        narrow
          ? undefined
          : {
              width: STAGE_W,
              height: STAGE_H,
              transform: `translate(-50%, 0) scale(${m.scale})`,
              ['--page-h' as string]: `${m.pageH.toFixed(0)}px`,
            }
      }
    >
      {!narrow && <img className="stage-book" src="/images/tome-book.webp" alt="" aria-hidden="true" />}
      <Outlet />
    </main>
    <Toasts />
    </>
  )
}
