import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'

export const STAGE_W = 2000
export const STAGE_H = 1333

const fitScale = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)

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
      <Outlet />
    </main>
  )
}
