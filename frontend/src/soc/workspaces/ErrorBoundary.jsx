import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-500 bg-red-950/20 h-full w-full overflow-auto font-mono text-xs">
          <h2 className="text-lg font-bold mb-4">Component Crashed</h2>
          <details style={{ whiteSpace: 'pre-wrap' }} open>
            <summary className="cursor-pointer mb-2 font-bold">{this.state.error && this.state.error.toString()}</summary>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
