export type ChatMessageRole = 'human' | 'ai'; // 消息角色 human: 用户 ai: 助手
export type ChatAssistantKey = string; // 助手标识
export type ChatConversationId = string; // 会话标识
export type ChatConversationStatus = 'active' | 'archived'; // 会话状态
export type ChatAttachmentStatus = 'uploaded' | 'ready' | 'error'; // 附件处理状态
export const CHAT_EXECUTION_MODES = [
  'langchain',
  'hybrid',
  'langgraph_agent',
] as const;
/** 普通 LangChain、当前工作流，以及未来由 SDK 驱动的 LangGraph Agent。 */
export type ChatExecutionMode = (typeof CHAT_EXECUTION_MODES)[number];

/** 单条用户消息最大字符数（trim 后） */
export const CHAT_CONTENT_MAX_LENGTH = 8_000;
/** 单次请求最多关联的附件数 */
export const CHAT_ATTACHMENT_IDS_MAX = 10;
/** 会话 / 附件 ID 最大长度 */
export const CHAT_ID_MAX_LENGTH = 64;

/**
 * 由 Agent 输出、可供前端再次使用的结果快照。具体业务字段由 `kind` 决定；
 * 前端不得通过解析 Markdown 恢复这些字段。
 */
export type ChatAgentResult = {
  status: 'completed' | 'requires_input' | 'failed' | 'cancelled';
  route: string | null;
  content: string;
  structuredResult?: { kind: string; data: unknown } | null;
  question?: string;
  fields?: string[];
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    field?: string;
    boundary?: {
      actual?: number;
      limit?: number;
      unit: 'characters' | 'items' | 'bytes' | 'tokens';
    };
  };
  execution: {
    durationMs?: number;
    attempt: number;
    maxAttempts: number;
    retry: {
      state: 'not_needed' | 'retrying' | 'exhausted' | 'not_retryable';
      retryable: boolean;
      nextRetryAfterMs?: number;
    };
  };
};

export type ChatMessageMetadata = {
  agentResult?: ChatAgentResult;
  agentResultVersion?: number;
  agentResultTruncated?: boolean;
};

// 历史记录所返回的对象
export type ChatMessage = {
  id?: string; // 消息唯一标识
  role: ChatMessageRole; // 角色 human: 人类 ai: 机器人
  content: string; // 内容
  createdAt?: string; // 创建时间
  metadata?: ChatMessageMetadata;
};

// 历史记录
export type ChatMessageList = ChatMessage[];

export type ChatAssistant = {
  id: ChatAssistantKey; // 助手唯一标识
  name: string; // 助手名称
  prompt: string; // 系统提示词
  isDefault: boolean; // 是否默认助手
  updatedAt: string; // 更新时间
};

export type ChatAssistantList = ChatAssistant[];

// 会话列表所返回的对象
export type ChatConversation = {
  id: ChatConversationId; // 会话唯一标识
  assistantKey: ChatAssistantKey; // 助手唯一标识
  title: string; // 会话标题
  status?: ChatConversationStatus; // 会话状态
  updatedAt: string; // 更新时间
  /** 搜索命中时的消息摘要片段 */
  snippet?: string;
};

export type ChatConversationList = ChatConversation[];

export type ChatAttachment = {
  id: string; // 附件唯一标识
  conversationId: ChatConversationId; // 所属会话
  messageId?: string | null; // 关联消息
  fileName: string; // 文件名
  mimeType?: string | null; // 文件类型
  size?: number | null; // 文件大小
  url?: string | null; // 文件访问地址
  status: ChatAttachmentStatus; // 附件状态
  createdAt: string; // 创建时间
};

// 发送消息所需要的对象
export type ChatDto = {
  assistantKey: ChatAssistantKey; // 助手 id
  conversationId: ChatConversationId; // 会话 ID（UUID）
  /** 用户消息正文；trim 后非空，且不超过 CHAT_CONTENT_MAX_LENGTH */
  content: string;
  userId: string; // 用户id（服务端从 JWT 注入，勿信任客户端）
  /** 可选附件 ID 列表；最多 CHAT_ATTACHMENT_IDS_MAX 个 */
  attachmentIds?: string[];
  /** 未传时兼容旧客户端，默认使用当前工作流模式。 */
  executionMode?: ChatExecutionMode;
};

/** 客户端请求体（不含由服务端注入的 userId） */
export type ChatRequestDto = Omit<ChatDto, 'userId'>;

export type ChatStreamEvent =
  | {
      type: 'delta';
      role: 'ai';
      content: string;
    }
  | {
      type: 'done';
      role: 'ai';
    }
  | {
      type: 'error';
      role: 'ai';
      error: string;
    }
  | {
      type: 'agent_started';
      role: 'ai';
      runId: string;
    }
  | {
      type: 'route_selected';
      role: 'ai';
      runId: string;
      route: string;
      skillId: string | null;
    }
  | {
      type: 'tool_started';
      role: 'ai';
      runId: string;
      tool: string;
      callId: string;
    }
  | {
      type: 'tool_completed';
      role: 'ai';
      runId: string;
      tool: string;
      callId: string;
      durationMs: number | null;
    }
  | {
      type: 'tool_failed';
      role: 'ai';
      runId: string;
      tool: string;
      callId: string;
      durationMs: number | null;
      error: {
        code: string;
        message: string;
        retryable: boolean;
      };
    }
  | {
      /** 任务完成时提供机器可读结果；文本仍通过 delta 保持流式展示。 */
      type: 'agent_result';
      role: 'ai';
      runId: string;
      result: ChatAgentResult;
    }
  | {
      type: 'agent_completed';
      role: 'ai';
      runId: string;
      durationMs: number;
    }
  | {
      type: 'agent_failed';
      role: 'ai';
      runId: string;
      error: string;
    }
  | {
      type: 'agent_cancelled';
      role: 'ai';
      runId: string;
    };
