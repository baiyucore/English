export type ChatRole = 'human' | 'ai'; // 角色 human: 用户 ai: 助手
export type ChatRoleType = 'normal' | 'master' | 'business' | 'qilinge' | 'xiaoman'; // 角色类型
//历史记录所返回的对象
export type ChatMessage = {
    role: ChatRole; // 角色 human: 人类 ai: 机器人
    content: string; // 内容
}
//历史记录
export type ChatMessageList = ChatMessage[]
//左侧列表所返回的对象
export type ChatMode = {
    label: string; // 标签
    id: string; // id
    role: ChatRoleType; // 角色
}
//左侧列表所返回的对象列表
export type ChatModeList = ChatMode[] //返回角色列表
//发送消息所需要的对象
export type ChatDto = {
    role: ChatRoleType; // 角色
    content: string; // 内容
    userId: string; // 用户id
}