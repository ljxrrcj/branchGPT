import { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import type { Message } from '@types/conversation';
import './MessageList.css';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps): React.ReactElement {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="message-list message-list--empty">
        <div className="empty-state">
          <h2>Welcome to branchGPT</h2>
          <p>Start a conversation by typing a message below.</p>
          <p className="empty-state-hint">
            Tip: Ask multiple questions to automatically create conversation branches!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
