import { create } from 'zustand';
import type { Message, BranchNode, Conversation, ConversationTree, BranchSourceType } from '@/types/conversation';

function generateId(): string {
  return crypto.randomUUID();
}

interface ConversationState {
  conversations: Map<string, ConversationTree>;
  activeConversationId: string | null;

  // Getters
  getActiveConversation: () => ConversationTree | null;
  getMessages: () => Map<string, Message>;
  getNodes: () => Map<string, BranchNode>;
  getActivePath: () => string[];

  // Actions
  createConversation: (title?: string) => string;
  setActiveConversation: (id: string | null) => void;
  addMessage: (message: Omit<Message, 'id' | 'createdAt' | 'branchIndex'>) => string;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  createBranch: (parentId: string, sourceType: BranchSourceType) => string;
  setActivePath: (path: string[]) => void;
  deleteConversation: (id: string) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: new Map(),
  activeConversationId: null,

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    if (!activeConversationId) return null;
    return conversations.get(activeConversationId) ?? null;
  },

  getMessages: () => {
    const active = get().getActiveConversation();
    return active?.messages ?? new Map();
  },

  getNodes: () => {
    const active = get().getActiveConversation();
    return active?.nodes ?? new Map();
  },

  getActivePath: () => {
    const active = get().getActiveConversation();
    return active?.activePath ?? [];
  },

  createConversation: (title?: string) => {
    const id = generateId();
    const now = new Date();
    const conversation: Conversation = {
      id,
      title: title ?? null,
      rootMessageId: null,
      createdAt: now,
      updatedAt: now,
    };

    const tree: ConversationTree = {
      conversation,
      messages: new Map(),
      nodes: new Map(),
      activePath: [],
    };

    set((state) => {
      const newConversations = new Map(state.conversations);
      newConversations.set(id, tree);
      return {
        conversations: newConversations,
        activeConversationId: id,
      };
    });

    return id;
  },

  setActiveConversation: (id: string | null) => {
    set({ activeConversationId: id });
  },

  addMessage: (messageData) => {
    const { activeConversationId, conversations } = get();
    if (!activeConversationId) {
      throw new Error('No active conversation');
    }

    const tree = conversations.get(activeConversationId);
    if (!tree) {
      throw new Error('Conversation not found');
    }

    const id = generateId();
    const now = new Date();

    // Calculate branch index based on siblings
    let branchIndex = 0;
    if (messageData.parentId) {
      const parentNode = tree.nodes.get(messageData.parentId);
      if (parentNode) {
        branchIndex = parentNode.children.length;
      }
    }

    const message: Message = {
      ...messageData,
      id,
      branchIndex,
      createdAt: now,
    };

    // Create node for the message
    const node: BranchNode = {
      id,
      messageId: id,
      parentId: messageData.parentId,
      children: [],
      depth: messageData.parentId ? (tree.nodes.get(messageData.parentId)?.depth ?? 0) + 1 : 0,
      isActive: true,
    };

    set((state) => {
      const currentTree = state.conversations.get(activeConversationId);
      if (!currentTree) return state;

      const newMessages = new Map(currentTree.messages);
      const newNodes = new Map(currentTree.nodes);

      newMessages.set(id, message);
      newNodes.set(id, node);

      // Update parent's children list
      if (messageData.parentId) {
        const parentNode = newNodes.get(messageData.parentId);
        if (parentNode) {
          newNodes.set(messageData.parentId, {
            ...parentNode,
            children: [...parentNode.children, id],
          });
        }
      }

      // Update root message if this is the first message
      const newConversation = currentTree.conversation.rootMessageId
        ? currentTree.conversation
        : { ...currentTree.conversation, rootMessageId: id, updatedAt: now };

      const newConversations = new Map(state.conversations);
      newConversations.set(activeConversationId, {
        ...currentTree,
        conversation: newConversation,
        messages: newMessages,
        nodes: newNodes,
        activePath: [...currentTree.activePath, id],
      });

      return { conversations: newConversations };
    });

    return id;
  },

  updateMessage: (id, updates) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    set((state) => {
      const tree = state.conversations.get(activeConversationId);
      if (!tree) return state;

      const message = tree.messages.get(id);
      if (!message) return state;

      const newMessages = new Map(tree.messages);
      newMessages.set(id, { ...message, ...updates });

      const newConversations = new Map(state.conversations);
      newConversations.set(activeConversationId, {
        ...tree,
        messages: newMessages,
      });

      return { conversations: newConversations };
    });
  },

  createBranch: (parentId, _sourceType) => {
    const { activeConversationId, conversations } = get();
    if (!activeConversationId) {
      throw new Error('No active conversation');
    }

    const tree = conversations.get(activeConversationId);
    if (!tree) {
      throw new Error('Conversation not found');
    }

    const parentNode = tree.nodes.get(parentId);
    if (!parentNode) {
      throw new Error('Parent node not found');
    }

    // The branch is created when a new message is added to the parent
    // This function updates the active path to focus on the new branch
    const branchId = generateId();

    set((state) => {
      const currentTree = state.conversations.get(activeConversationId);
      if (!currentTree) return state;

      // Update active path to include parent
      const parentIndex = currentTree.activePath.indexOf(parentId);
      const newActivePath = parentIndex >= 0
        ? currentTree.activePath.slice(0, parentIndex + 1)
        : [...currentTree.activePath, parentId];

      const newConversations = new Map(state.conversations);
      newConversations.set(activeConversationId, {
        ...currentTree,
        activePath: newActivePath,
      });

      return { conversations: newConversations };
    });

    return branchId;
  },

  setActivePath: (path) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    set((state) => {
      const tree = state.conversations.get(activeConversationId);
      if (!tree) return state;

      const newNodes = new Map(tree.nodes);

      // Deactivate all nodes
      for (const [nodeId, node] of newNodes) {
        newNodes.set(nodeId, { ...node, isActive: false });
      }

      // Activate nodes in the path
      for (const nodeId of path) {
        const node = newNodes.get(nodeId);
        if (node) {
          newNodes.set(nodeId, { ...node, isActive: true });
        }
      }

      const newConversations = new Map(state.conversations);
      newConversations.set(activeConversationId, {
        ...tree,
        nodes: newNodes,
        activePath: path,
      });

      return { conversations: newConversations };
    });
  },

  deleteConversation: (id) => {
    set((state) => {
      const newConversations = new Map(state.conversations);
      newConversations.delete(id);

      return {
        conversations: newConversations,
        activeConversationId:
          state.activeConversationId === id ? null : state.activeConversationId,
      };
    });
  },
}));
