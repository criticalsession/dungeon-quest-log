import { Link, useLocation, useParams } from 'react-router'
import { Flourish } from '../components/Flourish'
import { QuestView } from '../components/QuestView'
import { useQuests } from '../store/quests'

/** Right page with nothing selected (`#/`). */
export function EmptyQuestPage() {
  return (
    <section className="page page-right">
      <div className="empty-state">
        <Flourish />
        <p>Choose a quest from the log, or inscribe a new one.</p>
      </div>
    </section>
  )
}

/** Right page for `#/quest/:id`. */
export function QuestPage() {
  const { id } = useParams()
  const { search } = useLocation()
  const quest = useQuests((s) => (id ? s.quests[id] : undefined))

  return (
    <section className="page page-right">
      {quest ? (
        <QuestView quest={quest} />
      ) : (
        <div className="notice">
          <p>No such quest is written here.</p>
          <Link className="btn btn-secondary" to={`/${search}`}>
            Return to the log
          </Link>
        </div>
      )}
    </section>
  )
}
