import { createHashRouter } from 'react-router'
import { Stage } from './components/Stage'
import { LoginPage } from './pages/LoginPage'
import { LogPage } from './pages/LogPage'

export const router = createHashRouter([
  {
    element: <Stage />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/*', element: <LogPage /> },
    ],
  },
])
