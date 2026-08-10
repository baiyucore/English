export type ChatMessageRole = 'human' | 'ai'; // 消息角色 human: 用户 ai: 助手
export type ChatAssistantKey = string; // 助手标识
export type ChatConversationId = string; // 会话标识
export type ChatConversationStatus = 'active' | 'archived'; // 会话状态
export type ChatAttachmentStatus = 'uploaded' | 'ready' | 'error'; // 附件处理状态

/** 单条用户消息最大字符数（trim 后） */
export const CHAT_CONTENT_MAX_LENGTH = 8_000;
/** 单次请求最多关联的附件数 */
export const CHAT_ATTACHMENT_IDS_MAX = 10;
/** 会话 / 附件 ID 最大长度 */
export const CHAT_ID_MAX_LENGTH = 64;

// 历史记录所返回的对象
export type ChatMessage = {
  id?: string; // 消息唯一标识
  role: ChatMessageRole; // 角色 human: 人类 ai: 机器人
  content: string; // 内容
  createdAt?: string; // 创建时间
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
    };
