import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerPWA } from './registerServiceWorker';
import { getQualityProfile } from './utils/deviceProfile';
import './index.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('Fatal application error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, background: '#0c0d10', color: '#f1f5f9', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#ef4444', fontSize: '1.25rem', marginBottom: 8 }}>Rendering Error</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 16 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              background: '#38bdf8',
              color: '#000',
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Resolve the adaptive quality profile before the first render so the low-power
// UI rules are already in place when the initial paint happens.
const profile = getQualityProfile();
if (profile.isLowPower) {
  document.documentElement.classList.add('low-power-ui');
}
console.info(
  `[perf] tier=${profile.tier} dpr<=${profile.maxPixelRatio} shadows=${profile.shadows} post=${profile.postProcessing} - ${profile.reason}`
);

// Initialize Progressive Web App registration for the drawings app
registerPWA();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

