import { useEditorState, type Editor } from '@tiptap/react'
import type { ReactNode } from 'react'

type Item = {
  label: string
  icon: ReactNode
  run: (e: Editor) => void
  active?: (e: Editor) => boolean
  disabled?: (e: Editor) => boolean
}

const Svg = ({ children }: { children: ReactNode }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

const text = (s: string) => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <text x="12" y="17" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor" fontFamily="var(--font-label)">
      {s}
    </text>
  </svg>
)

const GROUPS: Item[][] = [
  [
    { label: 'Bold', icon: <Svg><path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z" /></Svg>, run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
    { label: 'Italic', icon: <Svg><path d="M10 5h8M6 19h8M14 5L10 19" /></Svg>, run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
  ],
  [
    { label: 'Heading', icon: text('H2'), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive('heading', { level: 2 }) },
    { label: 'Subheading', icon: text('H3'), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive('heading', { level: 3 }) },
  ],
  [
    { label: 'Bullet list', icon: <Svg><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></Svg>, run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
    { label: 'Numbered list', icon: <Svg><path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M4 14h3l-3 4h3" /></Svg>, run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
  ],
  [
    { label: 'Quote', icon: <Svg><path d="M5 17v-4a4 4 0 014-4M13 17v-4a4 4 0 014-4M5 17h4v-4H5zM13 17h4v-4h-4z" /></Svg>, run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive('blockquote') },
    { label: 'Divider', icon: <Svg><path d="M4 12h3M10.5 12h3M17 12h3" /></Svg>, run: (e) => e.chain().focus().setHorizontalRule().run() },
  ],
  [
    { label: 'Undo', icon: <Svg><path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" /></Svg>, run: (e) => e.chain().focus().undo().run(), disabled: (e) => !e.can().undo() },
    { label: 'Redo', icon: <Svg><path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" /></Svg>, run: (e) => e.chain().focus().redo().run(), disabled: (e) => !e.can().redo() },
  ],
]

export function EditorToolbar({ editor }: { editor: Editor }) {
  // The editor doesn't re-render React on every transaction, so read the button states explicitly.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      GROUPS.flat().map((item) => ({ active: item.active?.(e) ?? false, disabled: item.disabled?.(e) ?? false })),
  })
  let i = 0
  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
      {GROUPS.map((group, g) => (
        <div className="toolbar-group" key={g}>
          {group.map((item) => {
            const s = state[i++]
            return (
              <button
                key={item.label}
                type="button"
                className={`tool${s.active ? ' tool-on' : ''}`}
                aria-label={item.label}
                title={item.label}
                aria-pressed={item.active ? s.active : undefined}
                disabled={s.disabled}
                // Keep the caret in the editor when a tool is pressed.
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => item.run(editor)}
              >
                {item.icon}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
