import type { Message } from '@/types/conversation';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps): React.ReactElement {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isPending = message.status === 'pending';
  const isError = message.status === 'error';

  return (
    <div className={`message-item message-item--${message.role}`}>
      <div className="message-avatar">
        {isUser ? (
          <div className="avatar avatar--user">U</div>
        ) : (
          <div className="avatar avatar--assistant">B</div>
        )}
      </div>
      <div className="message-content">
        <div className="message-role">
          {isUser ? 'You' : 'branchGPT'}
          {message.model && <span className="message-model">{message.model}</span>}
        </div>
        <div className={`message-text ${isError ? 'message-text--error' : ''}`}>
          {isPending ? (
            <span className="message-pending">
              <span className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </span>
          ) : (
            message.content
          )}
          {isStreaming && <span className="cursor-blink">|</span>}
        </div>
        {message.branchIndex > 0 && (
          <div className="message-branch-indicator">
            Branch {message.branchIndex + 1}
          </div>
        )}
      </div>
    </div>
  );
}
