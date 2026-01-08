import { useCallback, useEffect, useState } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useConversationStore } from '@store/conversationStore';
import { useViewStore } from '@store/viewStore';
import { detectMultipleQuestions, shouldAutoBranch } from '@lib/branchDetection';
import './ChatView.css';

interface ChatError {
  message: string;
  code?: string;
  isRetryable?: boolean;
}

export function ChatView(): React.ReactElement {
  const {
    activeConversationId,
    createConversation,
    addMessage,
    getActivePath,
    getMessages,
    updateMessage,
  } = useConversationStore();

  const { isInputVisible } = useViewStore();
  const [error, setError] = useState<ChatError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Create initial conversation if none exists
  useEffect(() => {
    if (!activeConversationId) {
      try {
        createConversation('New Chat');
      } catch (err) {
        setError({
          message: 'Failed to create conversation. Please refresh the page.',
          code: 'CREATE_CONVERSATION_ERROR',
          isRetryable: true,
        });
        console.error('Failed to create conversation:', err);
      }
    }
  }, [activeConversationId, createConversation]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Clear any previous errors
      setError(null);
      setIsLoading(true);

      try {
        // Detect multiple questions for auto-branching
        const detection = detectMultipleQuestions(content);
        const shouldBranch = shouldAutoBranch(detection);

        // Get the last message in active path as parent
        const activePath = getActivePath();
        const parentId = activePath.length > 0 ? activePath[activePath.length - 1] ?? null : null;

        if (shouldBranch && detection.questions.length > 1) {
          // Create separate branches for each question
          for (const question of detection.questions) {
            // Add user message
            const userMessageId = addMessage({
              conversationId: activeConversationId ?? '',
              parentId,
              role: 'user',
              content: question,
              status: 'completed',
            });

            // Add placeholder assistant message
            addMessage({
              conversationId: activeConversationId ?? '',
              parentId: userMessageId,
              role: 'assistant',
              content: '',
              status: 'pending',
            });
          }
        } else {
          // Single message flow
          const userMessageId = addMessage({
            conversationId: activeConversationId ?? '',
            parentId,
            role: 'user',
            content,
            status: 'completed',
          });

          // Add placeholder assistant message (will be updated by streaming)
          const assistantMessageId = addMessage({
            conversationId: activeConversationId ?? '',
            parentId: userMessageId,
            role: 'assistant',
            content: '',
            status: 'pending',
          });

          // TODO: Trigger LLM streaming response
          // For now, simulate a response
          setTimeout(() => {
            try {
              updateMessage(assistantMessageId, {
                content: 'This is a placeholder response. LLM integration coming soon!',
                status: 'completed',
              });
            } catch (err) {
              console.error('Failed to update message:', err);
              setError({
                message: 'Failed to receive response. Please try again.',
                code: 'UPDATE_MESSAGE_ERROR',
                isRetryable: true,
              });
            }
          }, 500);
        }
      } catch (err) {
        console.error('Failed to send message:', err);

        // Provide user-friendly error messages
        let errorMessage = 'Failed to send message. Please try again.';
        let errorCode = 'SEND_MESSAGE_ERROR';

        if (err instanceof Error) {
          if (err.message.includes('No active conversation')) {
            errorMessage = 'No active conversation. Please refresh the page.';
            errorCode = 'NO_ACTIVE_CONVERSATION';
          } else if (err.message.includes('Conversation not found')) {
            errorMessage = 'Conversation not found. Please start a new chat.';
            errorCode = 'CONVERSATION_NOT_FOUND';
          }
        }

        setError({
          message: errorMessage,
          code: errorCode,
          isRetryable: true,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [activeConversationId, addMessage, getActivePath, updateMessage]
  );

  const messages = Array.from(getMessages().values());
  const activePath = getActivePath();

  // Filter to show only messages in the active path
  const activeMessages = messages.filter((msg) => activePath.includes(msg.id));

  return (
    <div className="chat-view">
      {error && (
        <div className="chat-error" role="alert">
          <span className="chat-error-message">{error.message}</span>
          <button
            className="chat-error-dismiss"
            onClick={clearError}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      <div className="chat-messages">
        <MessageList messages={activeMessages} />
      </div>
      {isInputVisible && (
        <div className="chat-input-container">
          <MessageInput onSend={handleSendMessage} disabled={isLoading} />
        </div>
      )}
    </div>
  );
}
