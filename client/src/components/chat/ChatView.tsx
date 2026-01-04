import { useCallback, useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useConversationStore } from '@store/conversationStore';
import { useViewStore } from '@store/viewStore';
import { detectMultipleQuestions, shouldAutoBranch } from '@lib/branchDetection';
import './ChatView.css';

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

  // Create initial conversation if none exists
  useEffect(() => {
    if (!activeConversationId) {
      createConversation('New Chat');
    }
  }, [activeConversationId, createConversation]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

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
          updateMessage(assistantMessageId, {
            content: 'This is a placeholder response. LLM integration coming soon!',
            status: 'completed',
          });
        }, 500);
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
      <div className="chat-messages">
        <MessageList messages={activeMessages} />
      </div>
      {isInputVisible && (
        <div className="chat-input-container">
          <MessageInput onSend={handleSendMessage} />
        </div>
      )}
    </div>
  );
}
