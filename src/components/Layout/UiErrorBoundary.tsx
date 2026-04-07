import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  /** Shown in the fallback (e.g. "Chat", "Terminal"). */
  name: string;
  children: ReactNode;
  /** Wrapper around children when healthy (e.g. `flex flex-1 min-h-0` for sidebars). */
  contentClassName?: string;
};

type State = {
  error: Error | null;
  /** Bumps on retry so children remount after a recoverable error. */
  resetKey: number;
};

/**
 * Catches render errors in a subtree so one broken panel does not blank the whole app.
 * Logs component stack in Vite dev only.
 */
export class UiErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error(`[UiErrorBoundary:${this.props.name}]`, error, info.componentStack);
    }
  }

  private retry = (): void => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  render(): ReactNode {
    const { name, children, contentClassName } = this.props;
    const { error, resetKey } = this.state;

    if (error) {
      return (
        <div
          role="alert"
          className="flex h-full min-h-[140px] flex-col gap-3 border border-terminalai-border bg-terminalai-surface p-4 text-sm text-terminalai-text"
        >
          <p className="font-medium text-terminalai-muted">
            {name} hit an error and was isolated so the rest of the app keeps running.
          </p>
          <pre className="max-h-32 overflow-auto rounded-md border border-terminalai-border bg-terminalai-base p-2 font-mono text-2xs text-terminalai-danger">
            {error.message}
          </pre>
          <div>
            <Button type="button" size="sm" variant="outline" onClick={this.retry}>
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div key={resetKey} className={contentClassName ?? 'h-full min-h-0 min-w-0'}>
        {children}
      </div>
    );
  }
}
