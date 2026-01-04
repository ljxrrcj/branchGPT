import { ChatView } from '@components/chat/ChatView';
import { useViewStore } from '@store/viewStore';

function App(): React.ReactElement {
  const { mode } = useViewStore();

  return (
    <div className="app">
      <header className="app-header">
        <h1>branchGPT</h1>
        <span className="view-mode-badge">{mode}</span>
      </header>
      <main className="app-main">
        <ChatView />
      </main>
    </div>
  );
}

export default App;
