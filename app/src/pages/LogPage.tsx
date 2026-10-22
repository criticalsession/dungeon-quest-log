import { useEffect } from 'react'
import { Outlet, useMatch, useNavigate, useSearchParams } from 'react-router'
import { BookHeader } from '../components/BookHeader'
import { QuestList } from '../components/QuestList'
import { Ribbons, TABS } from '../components/Ribbons'
import { SealedArchiveNotice } from '../components/SealedArchiveNotice'
import { closeTheBook } from '../lib/auth'
import { groupsForTab, useQuests, type Tab } from '../store/quests'

const parseTab = (value: string | null): Tab => TABS.find((t) => t.id === value)?.id ?? 'all'

/** Layout for the log routes: ribbons and quest list on the left; the route fills the right page. */
export function LogPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const selectedId = useMatch('/quest/:id')?.params.id
  const loaded = useQuests((s) => s.loaded)
  const connection = useQuests((s) => s.connection)
  const load = useQuests((s) => s.load)
  const tab = parseTab(params.get('tab'))

  useEffect(() => {
    void load()
  }, [load])

  // A ribbon is a filter, not a navigation: it replaces the history entry and keeps the path.
  function selectTab(next: Tab) {
    const search = next === 'all' ? '' : `?tab=${next}`
    // An open quest that isn't in the new filter is closed. (The editor is left alone: its draft matters more.)
    const stillListed =
      !selectedId || groupsForTab(useQuests.getState().quests, next).some((g) => g.quests.some((q) => q.id === selectedId))
    if (stillListed) setParams(next === 'all' ? {} : { tab: next }, { replace: true })
    else navigate(`/${search}`, { replace: true })
  }

  async function onClose() {
    await closeTheBook()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {loaded && <Ribbons tab={tab} onSelect={selectTab} />}
      <section className="page page-left page-log">
        <BookHeader />
        {loaded && <QuestList tab={tab} selectedId={selectedId} />}
        <footer className="page-foot">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Close the book
          </button>
        </footer>
      </section>
      {connection === 'sealed' ? (
        <section className="page page-right">
          <SealedArchiveNotice onRetry={() => void load()} />
        </section>
      ) : (
        loaded && <Outlet />
      )}
    </>
  )
}
