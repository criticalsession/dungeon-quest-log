export function Flourish() {
  return (
    <svg className="flourish" aria-hidden="true" viewBox="0 0 300 24">
      <path d="M10 12 H120 M180 12 H290" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M120 12 C130 2 140 2 144 12 C140 20 130 20 120 12 Z M180 12 C170 2 160 2 156 12 C160 20 170 20 180 12 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M150 3 L158 12 L150 21 L142 12 Z" fill="var(--crimson)" />
      <circle cx="10" cy="12" r="2.5" fill="currentColor" />
      <circle cx="290" cy="12" r="2.5" fill="currentColor" />
    </svg>
  )
}
