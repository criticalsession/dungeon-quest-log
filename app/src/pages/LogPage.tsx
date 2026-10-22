import { useNavigate } from 'react-router'
import { BookHeader } from '../components/BookHeader'
import { closeTheBook } from '../lib/auth'

export function LogPage() {
  const navigate = useNavigate()

  async function onClose() {
    await closeTheBook()
    navigate('/login', { replace: true })
  }

  return (
    <section className="page page-left">
      <BookHeader />
      <button className="btn btn-secondary page-corner" type="button" onClick={onClose}>
        Close the book
      </button>
    </section>
  )
}
