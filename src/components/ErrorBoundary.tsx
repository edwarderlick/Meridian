import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Top-level safety net — without this, React unmounts the entire tree on any uncaught render
 * error, leaving a blank white screen with zero indication anything went wrong. Catches render
 * errors anywhere in the app and shows a real fallback instead, with a way back to a working
 * screen rather than a dead end.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-on-surface px-6">
          <div className="glass-premium rounded-2xl p-10 max-w-md text-center space-y-4">
            <span className="material-symbols-outlined text-error text-4xl">error</span>
            <h1 className="font-headline-lg text-xl font-semibold">Something went wrong</h1>
            <p className="text-body-sm text-on-surface-variant/70">
              This screen hit an unexpected error. No funds or pending transactions are affected by this — it's a
              display issue only.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null })
                window.location.href = '/'
              }}
              className="btn-primary px-6 py-2.5 text-sm mt-2"
            >
              Back to home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
