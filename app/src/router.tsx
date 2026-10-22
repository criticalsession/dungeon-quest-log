import { createHashRouter, redirect } from 'react-router'
import { Stage } from './components/Stage'
import { requireLogin, skipLoginIfSignedIn } from './lib/auth'
import { LoginPage } from './pages/LoginPage'
import { LogPage } from './pages/LogPage'
import { EditQuestPage, EmptyQuestPage, NewQuestPage, QuestPage } from './pages/QuestPage'

export const router = createHashRouter([
  {
    element: <Stage />,
    children: [
      { path: '/login', loader: skipLoginIfSignedIn, element: <LoginPage /> },
      {
        path: '/',
        loader: requireLogin,
        // The ribbons change the query string; that must not re-run the login check.
        shouldRevalidate: () => false,
        element: <LogPage />,
        children: [
          { index: true, element: <EmptyQuestPage /> },
          { path: 'quest/:id', element: <QuestPage /> },
          { path: 'quest/:id/edit', element: <EditQuestPage /> },
          { path: 'new', element: <NewQuestPage /> },
          { path: '*', loader: () => redirect('/') },
        ],
      },
    ],
  },
])
