# branchGPT - Claude Code 开发指南

## 项目概述
ChatGPT 风格的聊天界面，具有 LLM 驱动的自动对话分支可视化功能。

## 技术栈
- **前端**: React + Vite + TypeScript
- **后端**: Node.js + tRPC
- **数据库**: PostgreSQL (ltree 扩展)
- **画布**: React Flow
- **状态管理**: Zustand

---

## 代码质量标准

### TypeScript 规范

1. **严格模式**: 必须启用 `strict: true`
2. **显式类型**: 所有函数参数和返回值必须有明确类型注解
3. **避免 any**: 禁止使用 `any`，使用 `unknown` 并进行类型守卫
4. **空值处理**: 使用可选链 `?.` 和空值合并 `??`

```typescript
// ✅ Good
function processMessage(msg: Message): ProcessedMessage {
  return { ...msg, processed: true };
}

// ❌ Bad
function processMessage(msg: any) {
  return { ...msg, processed: true };
}
```

### PostgreSQL 规范

1. **使用参数化查询**: 防止 SQL 注入
2. **事务处理**: 多表操作必须使用事务
3. **索引**: 频繁查询的字段必须建立索引
4. **ltree 路径**: 消息树使用 ltree 类型存储路径

```sql
-- ✅ Good: 参数化查询
SELECT * FROM messages WHERE conversation_id = $1;

-- ❌ Bad: 字符串拼接
SELECT * FROM messages WHERE conversation_id = '${id}';
```

---

## 代码质量门禁

### 100 行以上改动必须执行质量检测

当单次提交改动超过 100 行代码时，必须运行以下检测：

```bash
# 运行完整质量检测
npm run quality:check

# 或分步执行
npm run lint          # ESLint 检测
npm run typecheck     # TypeScript 类型检查
npm run test          # 单元测试
npm run test:coverage # 测试覆盖率
```

### 质量分数阈值

| 指标 | 最低要求 | 建议目标 |
|------|----------|----------|
| ESLint 错误 | 0 | 0 |
| ESLint 警告 | < 10 | 0 |
| TypeScript 错误 | 0 | 0 |
| 测试覆盖率 | > 60% | > 80% |
| 测试通过率 | 100% | 100% |

### 质量分数过低时的处理

如果质量检测不通过：
1. **立即通知用户**: 输出具体的错误和警告
2. **提供修复建议**: 列出需要修复的问题
3. **可以选择继续**: 用户可以选择忽略警告继续提交
4. **记录技术债务**: 将未修复的问题记录到 TODO

---

## TDD 开发流程

### 测试优先原则

1. **先写测试**: 新功能必须先写测试用例
2. **红-绿-重构**:
   - 红：写失败的测试
   - 绿：写最小代码使测试通过
   - 重构：优化代码结构

### 测试文件结构

```
/client/tests/
├── /components/     # 组件测试
├── /hooks/          # Hook 测试
├── /store/          # Store 测试
└── /utils/          # 工具函数测试

/server/tests/
├── /routers/        # API 路由测试
├── /services/       # 服务层测试
├── /llm/            # LLM 客户端测试
└── /db/             # 数据库查询测试
```

### 测试命名规范

```typescript
describe('MessageStore', () => {
  describe('addMessage', () => {
    it('should add message to the store', () => {});
    it('should update parent node children list', () => {});
    it('should throw error if conversation not found', () => {});
  });
});
```

---

## 分支管理

### Git 分支命名

```
feature/xxx    - 新功能
fix/xxx        - Bug 修复
refactor/xxx   - 重构
docs/xxx       - 文档更新
test/xxx       - 测试相关
```

### Commit 消息格式

```
<type>(<scope>): <subject>

<body>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

类型: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

---

## 常用命令

```bash
# 开发
npm run dev           # 启动开发服务器
npm run dev:server    # 启动后端服务
npm run dev:client    # 启动前端服务

# 测试
npm run test          # 运行测试
npm run test:watch    # 监听模式
npm run test:coverage # 覆盖率报告

# 质量检测
npm run lint          # ESLint
npm run lint:fix      # 自动修复
npm run typecheck     # 类型检查
npm run format        # Prettier 格式化

# 数据库
npm run db:migrate    # 运行迁移
npm run db:seed       # 填充测试数据

# 完整检测
npm run quality:check # 运行所有质量检测
```

---

## 关键文件说明

| 文件/目录 | 用途 |
|-----------|------|
| `PLAN.md` | 详细实现计划 |
| `CLAUDE.md` | Claude Code 开发指南 (本文件) |
| `/quality/` | 代码质量工具配置 |
| `/client/src/store/` | Zustand 状态管理 |
| `/server/src/llm/` | LLM 抽象层 |
| `/database/` | SQL 脚本 |

---

## 注意事项

1. **不要提交敏感信息**: API keys、密码等必须使用环境变量
2. **保持向后兼容**: 修改 API 时考虑现有客户端
3. **文档同步**: 重大更改需同步更新 PLAN.md
4. **分支策略**: 功能开发在 feature 分支，完成后 PR 到 main
