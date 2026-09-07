import './memoryStorageInit.js';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './tracing.js';
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './mail/styles/mail.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, background: 'red', color: 'white', fontFamily: 'monospace', zIndex: 99999, position: 'fixed', inset: 0 }}>
          <h1>React Crashed</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error && this.state.error.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
