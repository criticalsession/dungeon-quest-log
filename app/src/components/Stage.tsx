import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'

export const STAGE_W = 2000
export const STAGE_H = 1333

// The book fills the stage; ribbons stick out up to about 110 px past its right
// edge, so the fit area is a little wider and taller than the stage itself.
const FIT_W = 2240
const FIT_H = 1380

const fitScale = () => Math.min(window.innerWidth / FIT_W, window.innerHeight / FIT_H)

export function Stage() {
  const [scale, setScale] = useState(fitScale)

  useEffect(() => {
    const onResize = () => setScale(fitScale())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <main
      className="stage"
      style={{
        width: STAGE_W,
        height: STAGE_H,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    >
      <img className="stage-book" src="/images/tome-book.webp" alt="" aria-hidden="true" />
      <Outlet />
    </main>
  )
}
