# branchGPT 实现计划

## 项目概述
创建一个类似 ChatGPT 的聊天界面，具有自动对话分支可视化功能，采用水平可拖动布局。

## 技术选型
| 组件 | 技术 |
|------|------|
| 前端框架 | React + Vite + TypeScript |
| 后端服务 | Node.js + tRPC |
| 数据库 | PostgreSQL (ltree 扩展) |
| 画布渲染 | React Flow |
| 状态管理 | Zustand |
| 动画 | react-spring |
| LLM | 多提供商抽象层 (OpenAI, Anthropic, Ollama) |

## 实现策略：MVP 优先

### Phase 1: 项目初始化与基础架构
**目标**: 搭建项目骨架

1. 初始化 Vite + React + TypeScript 项目
2. 配置 tRPC 后端服务
3. 配置 PostgreSQL 数据库连接
4. 设置基础目录结构

```
/branchGPT
├── /client                 # 前端
│   ├── /src
│   │   ├── /components
│   │   ├── /hooks
│   │   ├── /store
│   │   ├── /types
│   │   ├── /lib
│   │   └── /utils
│   ├── package.json
│   └── vite.config.ts
├── /server                 # 后端
│   ├── /src
│   │   ├── /routers
│   │   ├── /services
│   │   ├── /db
│   │   └── /llm
│   ├── package.json
│   └── tsconfig.json
├── /database               # 数据库脚本
│   ├── schema.sql
│   ├── indexes.sql
│   └── functions.sql
└── package.json            # Monorepo 根配置
```

### Phase 2: 数据库设计与实现
**目标**: 建立数据持久化层

**核心表结构**:

```sql
-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 对话表
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(500),
    root_message_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 消息表 (使用 ltree 实现树结构)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    parent_id UUID REFERENCES messages(id),
    path LTREE NOT NULL,  -- 树路径，用于高效查询
    role VARCHAR(20) NOT NULL,  -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    model VARCHAR(100),
    branch_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 分支元数据表
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id),
    start_message_id UUID REFERENCES messages(id),
    source_type VARCHAR(20) NOT NULL,  -- 'manual' | 'auto'
    source_reason VARCHAR(50),  -- 'edit' | 'regenerate' | 'multi_question'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LLM 配置表
CREATE TABLE llm_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    api_key_encrypted TEXT,
    is_default BOOLEAN DEFAULT FALSE
);
```

**关键索引**:
- `CREATE INDEX idx_messages_path ON messages USING GIST (path);`
- `CREATE INDEX idx_messages_conversation ON messages(conversation_id);`

### Phase 3: 核心类型定义
**目标**: 建立 TypeScript 类型系统

**关键文件**: `client/src/types/`

```typescript
// conversation.ts
interface Message {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: 'pending' | 'streaming' | 'completed' | 'error';
  model?: string;
  createdAt: Date;
}

interface BranchNode {
  id: string;
  messageId: string;
  parentId: string | null;
  children: string[];
  depth: number;
  isActive: boolean;
}

// view.ts
type ViewMode = 'chat' | 'branch' | 'overview';
type ZoomPhase = 'snap' | 'free';

interface ViewState {
  mode: ViewMode;
  viewport: { x: number; y: number; zoom: number; zoomPhase: ZoomPhase };
  isInputVisible: boolean;
  focusRatio: number;  // 默认 0.8
}

// llm.ts
type LLMProvider = 'openai' | 'anthropic' | 'ollama';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### Phase 4: tRPC 后端路由
**目标**: 实现 API 层

**关键文件**: `server/src/routers/`

```typescript
// conversation.router.ts
export const conversationRouter = router({
  create: publicProcedure.mutation(/* 创建对话 */),
  list: publicProcedure.query(/* 获取对话列表 */),
  getTree: publicProcedure.input(z.object({ id: z.string() }))
    .query(/* 获取完整对话树 */),
  delete: publicProcedure.mutation(/* 删除对话 */),
});

// message.router.ts
export const messageRouter = router({
  send: publicProcedure.input(messageSchema).mutation(/* 发送消息 */),
  stream: publicProcedure.subscription(/* SSE 流式响应 */),
  createBranch: publicProcedure.mutation(/* 创建分支 */),
});

// llm.router.ts
export const llmRouter = router({
  listProviders: publicProcedure.query(/* 获取可用提供商 */),
  updateConfig: publicProcedure.mutation(/* 更新 LLM 配置 */),
});
```

### Phase 5: LLM 抽象层
**目标**: 支持多 LLM 提供商

**关键文件**: `server/src/llm/`

```typescript
// ILLMClient.ts - 统一接口
interface ILLMClient {
  provider: LLMProvider;
  complete(config: LLMRequestConfig): Promise<LLMResponse>;
  stream(config: LLMRequestConfig): AsyncGenerator<StreamChunk>;
  abort(): void;
}

// clients/
// - OpenAIClient.ts
// - AnthropicClient.ts
// - OllamaClient.ts

// LLMManager.ts - 管理器
class LLMManager {
  getClient(provider: string): ILLMClient;
  stream(config): AsyncGenerator<StreamChunk>;
  abort(): void;
}
```

### Phase 6: 前端状态管理 (Zustand)
**目标**: 建立响应式状态系统

**关键文件**: `client/src/store/`

```typescript
// conversationStore.ts
interface ConversationState {
  conversations: Map<string, ConversationTree>;
  messages: Map<string, Message>;
  nodes: Map<string, BranchNode>;
  activeConversationId: string | null;

  // Actions
  createConversation: () => string;
  addMessage: (msg: Omit<Message, 'id'>) => string;
  createBranch: (parentId: string, source: BranchSource) => string;
  setActivePath: (path: string[]) => void;
}

// viewStore.ts
interface ViewStoreState extends ViewState {
  setViewMode: (mode: ViewMode) => void;
  handleZoom: (delta: number, isCtrl: boolean) => void;
  selectNode: (nodeId: string | null) => void;
}
```

### Phase 7: 聊天界面 (MVP 核心)
**目标**: 实现基础聊天功能

**关键组件**:
- `ChatView.tsx` - 聊天主视图
- `MessageList.tsx` - 消息列表
- `MessageItem.tsx` - 单条消息
- `MessageInput.tsx` - 输入框
- `StreamingMessage.tsx` - 流式响应显示

### Phase 8: 自动分支检测
**目标**: 检测多问题并自动创建分支

**关键文件**: `client/src/lib/branchDetection.ts`

```typescript
function detectMultipleQuestions(content: string): {
  hasMultipleQuestions: boolean;
  questions: string[];
  confidence: number;
}

// 检测策略:
// 1. 编号列表 (1. 2. 3. 或 - - -)
// 2. 多个问号
// 3. 连接词分隔 (另外、还有、and、also)
```

**触发行为**: 检测到多问题时自动创建分支，无需用户确认

### Phase 9: React Flow 集成
**目标**: 实现对话树可视化

**关键组件**:
- `FlowCanvas.tsx` - React Flow 画布容器
- `MessageNode.tsx` - 自定义消息节点
- `BranchEdge.tsx` - 自定义分支连线

**布局算法**: Reingold-Tilford 树布局
- 水平方向展开分支
- 计算子树宽度避免重叠

### Phase 10: 视图模式切换
**目标**: 实现三种视图模式

| 模式 | 触发 | 特点 |
|------|------|------|
| chat | 默认/点击节点 | 线性聊天，输入框可见 |
| branch | 有分支时 | 80/20 焦点+上下文布局 |
| overview | Ctrl+滚轮缩小 | 隐藏输入框，自由平移 |

**关键组件**:
- `ViewModeRouter.tsx` - 模式切换路由
- `BranchView.tsx` - 分支视图 (80/20 布局)
- `OverviewCanvas.tsx` - 概览视图

### Phase 11: 交互系统 (MVP 简化版)
**目标**: 实现基础导航交互

**MVP 范围**:
- 滚轮缩放
- 拖拽平移
- 点击节点切换焦点

**后续迭代**:
- 吸附滚动 + 自由滚动两阶段
- 物理弹性动画
- Shift+滚轮水平滚动

---

## 关键文件清单

### 必须创建的文件

**后端 (server/)**
| 文件 | 用途 |
|------|------|
| `src/index.ts` | 入口，tRPC 服务器 |
| `src/trpc.ts` | tRPC 配置 |
| `src/routers/conversation.ts` | 对话路由 |
| `src/routers/message.ts` | 消息路由 |
| `src/routers/llm.ts` | LLM 路由 |
| `src/db/client.ts` | 数据库连接 |
| `src/db/queries.ts` | SQL 查询封装 |
| `src/llm/ILLMClient.ts` | LLM 接口 |
| `src/llm/OpenAIClient.ts` | OpenAI 实现 |
| `src/llm/AnthropicClient.ts` | Anthropic 实现 |
| `src/llm/LLMManager.ts` | LLM 管理器 |

**前端 (client/)**
| 文件 | 用途 |
|------|------|
| `src/main.tsx` | 入口 |
| `src/App.tsx` | 根组件 |
| `src/types/*.ts` | 类型定义 |
| `src/store/conversationStore.ts` | 对话状态 |
| `src/store/viewStore.ts` | 视图状态 |
| `src/components/chat/ChatView.tsx` | 聊天视图 |
| `src/components/chat/MessageList.tsx` | 消息列表 |
| `src/components/chat/MessageInput.tsx` | 输入框 |
| `src/components/flow/FlowCanvas.tsx` | React Flow 画布 |
| `src/components/flow/MessageNode.tsx` | 消息节点 |
| `src/components/branch/BranchView.tsx` | 分支视图 |
| `src/lib/branchDetection.ts` | 多问题检测 |
| `src/lib/trpc.ts` | tRPC 客户端 |
| `src/hooks/useLLMStream.ts` | 流式响应 Hook |
| `src/utils/layout.ts` | 树布局算法 |

**数据库 (database/)**
| 文件 | 用途 |
|------|------|
| `schema.sql` | 表结构 |
| `indexes.sql` | 索引 |
| `functions.sql` | 树查询函数 |

---

## MVP 完成标准

- [ ] 用户可以发送消息并收到 LLM 流式响应
- [ ] 消息历史持久化到 PostgreSQL
- [ ] 支持切换 LLM 提供商 (OpenAI/Anthropic/Ollama)
- [ ] 检测到多问题时自动创建分支
- [ ] React Flow 显示对话树结构
- [ ] 点击节点可切换分支焦点
- [ ] 基础缩放和平移导航

---

## 依赖包

**前端**
```json
{
  "react": "^18.x",
  "react-dom": "^18.x",
  "reactflow": "^11.x",
  "@react-spring/web": "^9.x",
  "zustand": "^4.x",
  "@tanstack/react-query": "^5.x",
  "@trpc/client": "^10.x",
  "@trpc/react-query": "^10.x"
}
```

**后端**
```json
{
  "@trpc/server": "^10.x",
  "zod": "^3.x",
  "pg": "^8.x",
  "openai": "^4.x",
  "@anthropic-ai/sdk": "^0.x"
}
```
