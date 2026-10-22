import DOMPurify from 'dompurify'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'hr']

/** Quest descriptions are HTML from other players: clean them before saving and before showing. */
export const sanitizeHtml = (html: string) =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] })
