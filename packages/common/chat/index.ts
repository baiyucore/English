export type ChatMessageRole = 'human' | 'ai'; // 消息角色 human: 用户 ai: 助手
export type ChatAssistantKey = string; // 助手标识
export type ChatConversationId = string; // 会话标识
export type ChatConversationStatus = 'active' | 'archived'; // 会话状态
export type ChatAttachmentStatus = 'uploaded' | 'ready' | 'error'; // 附件处理状态

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
  conversationId: string; // 会话 ID
  content: string; // 内容
  userId: string; // 用户id
};

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
