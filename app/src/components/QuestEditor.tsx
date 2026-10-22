import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useState, type ReactNode } from 'react'
import { sanitizeHtml } from '../lib/sanitize'
import type { QuestFields } from '../lib/questApi'
import { EditorToolbar } from './EditorToolbar'

export const BLANK: QuestFields = {
  title: '',
  description: '',
  date_received: null,
  session_number: null,
  quest_giver: '',
  location_received: '',
  quest_location: '',
}

const EXTENSIONS = [
  // Plan 8.3: only the nodes the sanitiser allows.
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    link: false,
  }),
  Placeholder.configure({ placeholder: 'Write what the party learned…' }),
]

function Field({ label, id, wide, children }: { label: string; id: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`ledger-field${wide ? ' ledger-wide' : ''}`}>
      <label className="ledger-label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  )
}

type Props = {
  /** The starting values. Read once: later live updates to the quest never reach the draft. */
  initial: QuestFields
  saving: boolean
  /** Shown above the buttons (save errors, lock lost). */
  banner?: ReactNode
  canSave: boolean
  onSave: (fields: QuestFields) => void
  onAbandon: () => void
  /** Extra buttons beside Abandon (e.g. "Copy my text" once the lock is lost). */
  extraActions?: (draft: QuestFields) => ReactNode
}

export function QuestEditor({ initial, saving, banner, canSave, onSave, onAbandon, extraActions }: Props) {
  const [draft, setDraft] = useState(initial)
  const [titleMissing, setTitleMissing] = useState(false)
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: sanitizeHtml(initial.description),
    onUpdate: ({ editor: e }) => setDraft((d) => ({ ...d, description: e.isEmpty ? '' : e.getHTML() })),
  })

  const set = <K extends keyof QuestFields>(key: K, value: QuestFields[K]) => setDraft((d) => ({ ...d, [key]: value }))

  function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!draft.title.trim()) return setTitleMissing(true)
    onSave({ ...draft, title: draft.title.trim(), description: sanitizeHtml(draft.description) })
  }

  return (
    <form className="quest-editor" onSubmit={submit} noValidate>
      <input
        className="editor-title"
        aria-label="Title"
        aria-invalid={titleMissing || undefined}
        placeholder="Name this quest"
        maxLength={200}
        value={draft.title}
        autoFocus
        onChange={(e) => {
          set('title', e.target.value)
          setTitleMissing(false)
        }}
      />
      {titleMissing && <p className="form-error">A quest needs a name.</p>}

      <div className="ledger editor-ledger">
        <Field label="Received" id="f-date">
          <input id="f-date" type="date" value={draft.date_received ?? ''} onChange={(e) => set('date_received', e.target.value || null)} />
        </Field>
        <Field label="Session" id="f-session">
          <input
            id="f-session"
            type="number"
            min={0}
            step={1}
            value={draft.session_number ?? ''}
            onChange={(e) => set('session_number', e.target.value === '' ? null : Math.max(0, Math.trunc(Number(e.target.value))))}
          />
        </Field>
        <Field label="Given by" id="f-giver">
          <input id="f-giver" maxLength={200} value={draft.quest_giver} onChange={(e) => set('quest_giver', e.target.value)} />
        </Field>
        <Field label="Received at" id="f-at">
          <input id="f-at" maxLength={200} value={draft.location_received} onChange={(e) => set('location_received', e.target.value)} />
        </Field>
        <Field label="Quest location" id="f-where" wide>
          <input id="f-where" maxLength={200} value={draft.quest_location} onChange={(e) => set('quest_location', e.target.value)} />
        </Field>
      </div>

      <div className="editor-box">
        {editor && <EditorToolbar editor={editor} />}
        <EditorContent editor={editor} className="editor-content description" />
      </div>

      {banner}
      <div className="editor-actions">
        {extraActions?.(draft)}
        <button type="button" className="btn btn-secondary" onClick={onAbandon} disabled={saving}>
          Abandon changes
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving || !canSave}>
          Seal the entry
        </button>
      </div>
    </form>
  )
}
