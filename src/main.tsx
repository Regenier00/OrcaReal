import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary'

const App = lazy(() => import('./App.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <Suspense
        fallback={
          <div
            style={{
              minHeight: '100vh',
              display: 'grid',
              placeItems: 'center',
              background: '#f3f2ef',
              color: '#8a8d87',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Carregando OrcaReal...
          </div>
        }
      >
        <App />
      </Suspense>
    </AppErrorBoundary>
  </StrictMode>
)
