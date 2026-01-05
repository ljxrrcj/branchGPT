import { ChatView } from '@components/chat/ChatView';
import { ErrorBoundary } from '@components/common/ErrorBoundary';
import { useViewStore } from '@store/viewStore';

function App(): React.ReactElement {
  const { mode } = useViewStore();

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log to error tracking service in production
        console.error('Application error:', error);
        console.error('Component stack:', errorInfo.componentStack);
      }}
    >
      <div className="app">
        <header className="app-header">
          <h1>branchGPT</h1>
          <span className="view-mode-badge">{mode}</span>
        </header>
        <main className="app-main">
          <ChatView />
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
