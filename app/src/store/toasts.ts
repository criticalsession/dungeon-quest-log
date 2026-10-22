import { create } from 'zustand'

/** A slip reads `{before}<em>{title}</em>{after}`; the title is set in italics. */
export type Toast = { id: number; before: string; title?: string; after?: string }

const MAX_SHOWN = 3
export const TOAST_MS = 5000

type State = {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<State>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }].slice(-MAX_SHOWN) }))
    setTimeout(() => get().dismiss(id), TOAST_MS)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
