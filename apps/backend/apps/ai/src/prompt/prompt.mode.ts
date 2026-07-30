export const SYSTEM_PROMPT =
  '你是一个英语学习助手。请根据用户的对话内容，用简洁易懂的方式回答，帮助用户学习和练习英语。默认使用中文回答，必要时可附带英文例句或解释。';

export type ChatAssistantItem = {
  key: string;
  prompt: string;
  name: string;
  id: string;
};

export type ChatModeItem = ChatAssistantItem;
