import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { groupsForTab, STATUS_LABEL, useQuests, type Tab } from '../store/quests'
import { QuillIcon } from './icons'
import { QuestRow } from './QuestRow'
import { TABS } from './Ribbons'

const EMPTY_ALL = 'The log is empty. Inscribe the party’s first quest.'
const EMPTY_FILTERED = 'No quests here.'

/** Left page below the header: the title row, then the scrolling list. */
export function QuestList({ tab, selectedId }: { tab: Tab; selectedId: string | undefined }) {
  const quests = useQuests((s) => s.quests)
  const navigate = useNavigate()
  const { search } = useLocation()

  const groups = useMemo(() => groupsForTab(quests, tab), [quests, tab])
  const total = groups.reduce((n, g) => n + g.quests.length, 0)
  const title = TABS.find((t) => t.id === tab)!.label

  // The query string rides along, so the ribbon stays selected while you pick quests.
  const select = useCallback((id: string) => navigate(`/quest/${id}${search}`), [navigate, search])

  return (
    <>
      <div className="list-head">
        <h2 className="list-title">
          {title} &middot; {total}
        </h2>
        <button type="button" className="btn btn-primary" onClick={() => navigate(`/new${search}`)}>
          <QuillIcon />
          Inscribe a quest
        </button>
      </div>
      <div className="list-scroll">
        {total === 0 ? (
          <p className="list-empty">{tab === 'all' ? EMPTY_ALL : EMPTY_FILTERED}</p>
        ) : (
          groups.map((g) => (
            <section key={g.key} className="qgroup">
              {g.status && (
                <h3 className={`qgroup-title qgroup-${g.status}`}>
                  {STATUS_LABEL[g.status]} &middot; {g.quests.length}
                </h3>
              )}
              {g.quests.map((q) => (
                <QuestRow key={q.id} quest={q} selected={q.id === selectedId} onSelect={select} />
              ))}
            </section>
          ))
        )}
      </div>
    </>
  )
}
