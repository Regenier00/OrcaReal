import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro na interface:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f3f2ef',
          color: '#121212',
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            Não foi possível abrir o OrcaReal
          </p>
          <p style={{ marginTop: 12, color: '#8a8d87', lineHeight: 1.5 }}>
            {this.state.error.message || 'Erro inesperado na interface.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24,
              border: 0,
              borderRadius: 12,
              background: '#1a2330',
              color: '#f3f2ef',
              padding: '10px 18px',
              cursor: 'pointer',
            }}
          >
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}
