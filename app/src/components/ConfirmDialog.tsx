import { useEffect, useRef } from 'react'
import { WaxSeal } from './WaxSeal'

/** "Abandon your changes?" (plan 9.7). A native `<dialog>`, so focus is trapped and Esc means Keep writing. */
export function ConfirmDialog({ open, onKeep, onAbandon }: { open: boolean; onKeep: () => void; onAbandon: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const keep = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      keep.current?.focus()
    } else if (!open && d.open) {
      d.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialog}
      className="confirm"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault()
        onKeep()
      }}
    >
      <svg width="0" height="0" aria-hidden="true" focusable="false">
        <filter id="torn-edge" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" />
        </filter>
      </svg>
      <div className="confirm-paper" />
      <div className="confirm-seal">
        <WaxSeal status="active" archived={false} plain />
      </div>
      <h2 id="confirm-title" className="confirm-title">
        Abandon your changes?
      </h2>
      <p className="confirm-body">Your unsaved words will be lost to the ether.</p>
      <div className="confirm-actions">
        <button ref={keep} type="button" className="btn btn-secondary" onClick={onKeep}>
          Keep writing
        </button>
        <button type="button" className="btn btn-primary" onClick={onAbandon}>
          Abandon them
        </button>
      </div>
    </dialog>
  )
}
