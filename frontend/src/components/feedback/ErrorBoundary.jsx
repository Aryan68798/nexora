import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

/**
 * Standard React Error Boundary component
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled rendering error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cream flex items-center justify-center p-6 text-ink">
          <div className="max-w-lg w-full bg-card rounded-3xl p-8 md:p-10 shadow-warm-lg border border-border text-center">
            <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-6 shadow-warm-xs">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="font-serif text-2xl md:text-3xl font-bold text-ink mb-3">
              An unexpected hiccup
            </h1>

            <p className="text-body text-sm md:text-base leading-relaxed mb-6">
              Nexora encountered an unexpected view error. We have captured the details
              so our team can resolve it.
            </p>

            {this.state.error && (
              <div className="mb-6 text-left p-3.5 rounded-xl bg-sand border border-border text-xs font-mono text-ink overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={this.handleReset}
                leftIcon={<RotateCcw className="w-4 h-4" />}
              >
                Reload Application
              </Button>
              <Button
                variant="secondary"
                onClick={() => { window.location.href = '/'; }}
              >
                Return to Nexora Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
