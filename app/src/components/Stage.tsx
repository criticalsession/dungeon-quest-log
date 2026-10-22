import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { Toasts } from './Toasts'

export const STAGE_W = 2000
export const STAGE_H = 1333

// Ribbons stick out up to about 110 px past the book's right edge, so the fit
// width is wider than the stage. The book always fills the window width and is
// pinned to the top, whatever the window's ratio, so it looks the same everywhere.
// The bottom is cropped, and the pages shrink to the visible height and scroll
// inside (see .page in book.css).
const FIT_W = 2240
const MIN_VISIBLE_H = 760 // design px that must stay visible, so very wide windows don't over-zoom
const PAGE_TOP = 180
const PAGE_MAX_H = 870
const PAGE_BOTTOM_GAP = 70

const measure = () => {
  const scale = Math.min(window.innerWidth / FIT_W, window.innerHeight / MIN_VISIBLE_H)
  const visibleH = window.innerHeight / scale
  return {
    scale,
    pageH: Math.max(400, Math.min(PAGE_MAX_H, visibleH - PAGE_TOP - PAGE_BOTTOM_GAP)),
  }
}

export function Stage() {
  const [m, setM] = useState(measure)

  useEffect(() => {
    const onResize = () => setM(measure())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <>
    <main
      className="stage"
      style={{
        width: STAGE_W,
        height: STAGE_H,
        transform: `translate(-50%, 0) scale(${m.scale})`,
        ['--page-h' as string]: `${m.pageH.toFixed(0)}px`,
      }}
    >
      <img className="stage-book" src="/images/tome-book.webp" alt="" aria-hidden="true" />
      <Outlet />
    </main>
    <Toasts />
    </>
  )
}
