/**
 * LangGraph Agent SDK integration boundary.
 *
 * TODO(sdk): 接入 SDK 后，在这里实现 remote agent 的创建、run/stream、
 * thread 映射与事件转换；Graph 节点只能依赖这个 Adapter，不能直接依赖 SDK。
 */
export const LANGGRAPH_AGENT_SDK_STATUS = 'not_connected' as const;

export type LangGraphAgentSdkAdapter = {
  readonly status: typeof LANGGRAPH_AGENT_SDK_STATUS;
};

/** 当前版本只保留接入边界，避免尚未选定的 SDK 污染 Graph 编排。 */
export function getLangGraphAgentSdkAdapter(): LangGraphAgentSdkAdapter {
  return { status: LANGGRAPH_AGENT_SDK_STATUS };
}
