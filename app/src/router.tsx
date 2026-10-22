import { createHashRouter } from 'react-router'
import { Stage } from './components/Stage'
import { requireLogin, skipLoginIfSignedIn } from './lib/auth'
import { LoginPage } from './pages/LoginPage'
import { LogPage } from './pages/LogPage'

export const router = createHashRouter([
  {
    element: <Stage />,
    children: [
      { path: '/login', loader: skipLoginIfSignedIn, element: <LoginPage /> },
      { path: '/*', loader: requireLogin, element: <LogPage /> },
    ],
  },
])
