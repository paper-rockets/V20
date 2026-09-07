import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  props: Props;
  state: State = {
    hasError: false,
    errorMessage: '',
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('CanvasErrorBoundary caught error:', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          id="error-boundary-fallback"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#171717',
            color: '#e5e5e5',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'monospace',
            padding: '24px',
            zIndex: 9999,
          }}
        >
          <div style={{ maxWidth: '480px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#ef4444' }}>
              WebGL / Rendering Context Interrupted
            </div>
            <div style={{ fontSize: '12px', color: '#a3a3a3', marginBottom: '16px' }}>
              {this.state.errorMessage}
            </div>
            <button
              id="reload-canvas-btn"
              onClick={this.handleReload}
              style={{
                backgroundColor: '#262626',
                color: '#fafafa',
                border: '1px solid #404040',
                padding: '8px 16px',
                fontSize: '12px',
                fontFamily: 'monospace',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
            >
              Restart Canvas
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
