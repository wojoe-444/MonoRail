import { Component, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface Props {
  title: string
  hint?: string
  resetKey?: string
  children: ReactNode
}

interface State {
  resetKey?: string
  error: { message?: string } | null
  retried: boolean
}

/** Keep navigation outside the boundary so the user can leave a failed view. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { resetKey: this.props.resetKey, error: null, retried: false }

  static getDerivedStateFromProps({ resetKey }: Props, state: State) {
    // Keep healthy layouts mounted when navigating between their child routes.
    return resetKey === state.resetKey ? null : { resetKey, error: null, retried: false }
  }

  static getDerivedStateFromError(error: unknown) {
    return { error: { message: error instanceof Error ? error.message : typeof error === 'string' ? error : undefined } }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <div role="alert">
          <h2 className="text-lg font-semibold">{this.props.title} stopped working</h2>
          {this.state.error.message && <p className="mt-2 break-words text-sm text-muted-foreground">{this.state.error.message}</p>}
        </div>
        {this.props.hint && <p className="mt-4 text-sm text-muted-foreground">{this.props.hint}</p>}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => this.setState({ error: null, retried: true })}>Try again</Button>
          {/* React.lazy caches a rejected import until the renderer reloads. */}
          {this.state.retried && <Button variant="outline" onClick={() => window.location.reload()}>Reload MonoRail</Button>}
        </div>
      </div>
    )
  }
}
