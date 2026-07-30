export type ChatMessageRole = 'human' | 'ai'; // 消息角色 human: 用户 ai: 助手
export type ChatAssistantKey = string; // 助手标识
export type ChatRole = ChatMessageRole; // 兼容旧命名
export type ChatRoleType = ChatAssistantKey; // 兼容旧命名

// 历史记录所返回的对象
export type ChatMessage = {
  role: ChatMessageRole; // 角色 human: 人类 ai: 机器人
  content: string; // 内容
};

// 历史记录
export type ChatMessageList = ChatMessage[];

// 助手列表所返回的对象
export type ChatAssistant = {
  id: string; // id
  key: ChatAssistantKey; // 助手唯一标识
  name: string; // 展示名称
};

// 兼容旧命名
export type ChatMode = ChatAssistant;
export type ChatAssistantList = ChatAssistant[];
export type ChatModeList = ChatAssistantList;

// 发送消息所需要的对象
export type ChatDto = {
  assistantKey: ChatAssistantKey; // 助手标识
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
