import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { BookHeader } from '../components/BookHeader'
import { getLastName, MAX_NAME_LENGTH, setActiveName } from '../lib/playerName'
import { PARTY_EMAIL, supabase } from '../lib/supabase'

const WRONG_PASSWORD = 'That password is not known here.'
const RATE_LIMITED = 'Too many attempts. Rest a moment and try again.'
const UNREACHABLE = 'The book would not open. Check your connection and try again.'

export function LoginPage() {
  const navigate = useNavigate()
  const [name, setName] = useState(getLastName)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !password || busy) return
    setBusy(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: PARTY_EMAIL,
      password,
    })
    if (authError) {
      if (authError.status === 429 || authError.code === 'over_request_rate_limit') {
        setError(RATE_LIMITED)
      } else if (authError.status === 400) {
        setError(WRONG_PASSWORD)
      } else {
        setError(UNREACHABLE)
      }
      setBusy(false)
      return
    }
    setActiveName(trimmed)
    navigate('/', { replace: true })
  }

  return (
    <>
      <section className="page page-left">
        <BookHeader />
      </section>
      <section className="page page-right">
        <h2 className="page-heading">Who goes there?</h2>
        <form className="login-form" onSubmit={onSubmit}>
          <label className="field">
            <span className="field-label">Your name</span>
            <input
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="nickname"
              autoFocus={!name}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">The party&rsquo;s password</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              autoFocus={!!name}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <p className="form-error" role="alert">{error}</p>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || !name.trim() || !password}
          >
            Open the book
          </button>
        </form>
      </section>
    </>
  )
}
