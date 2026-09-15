export type ToolErrorCode =
  | 'VALIDATION_ERROR'
  | 'POLICY_DENIED'
  | 'NOT_FOUND'
  | 'TIMEOUT_ERROR'
  | 'CANCELLED'
  | 'DOWNSTREAM_ERROR'
  | 'INTERNAL_ERROR';

export type ToolError = {
  code: ToolErrorCode;
  message: string;
  retryable: boolean;
  field?: string;
};

export type ToolMeta = {
  skillId?: string;
  skillVersion?: string;
};

export type ToolInputRequest = {
  question: string;
  fields: string[];
};

export type ToolResult<T> =
  | {
      status: 'completed';
      tool: string;
      data: T;
      meta?: ToolMeta;
    }
  | {
      status: 'requires_input';
      tool: string;
      request: ToolInputRequest;
      meta?: ToolMeta;
    }
  | {
      status: 'failed';
      tool: string;
      error: ToolError;
    };

export class ToolExecutionError extends Error {
  constructor(
    public readonly code: Extract<
      ToolErrorCode,
      'TIMEOUT_ERROR' | 'CANCELLED' | 'DOWNSTREAM_ERROR'
    >,
    message: string,
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

export async function withToolTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort(parentSignal?.reason);
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  if (parentSignal?.aborted) {
    onParentAbort();
  } else {
    parentSignal?.addEventListener('abort', onParentAbort, { once: true });
  }

  try {
    const taskPromise = task(controller.signal);
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new ToolExecutionError('TIMEOUT_ERROR', '工具调用超时'));
      }, timeoutMs);
    });
    return await Promise.race([taskPromise, timeoutPromise]);
  } catch (error) {
    if (parentSignal?.aborted) {
      throw new ToolExecutionError('CANCELLED', '工具调用已取消');
    }
    if (timedOut || controller.signal.aborted) {
      throw new ToolExecutionError('TIMEOUT_ERROR', '工具调用超时');
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

export function toolCompleted<T>(
  tool: string,
  data: T,
  meta?: ToolMeta,
): ToolResult<T> {
  return {
    status: 'completed',
    tool,
    data,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };
}

export function toolRequiresInput(
  tool: string,
  request: ToolInputRequest,
  meta?: ToolMeta,
): ToolResult<never> {
  return {
    status: 'requires_input',
    tool,
    request,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };
}

export function toolFailed(
  tool: string,
  code: ToolErrorCode,
  message: string,
  options: { retryable?: boolean; field?: string } = {},
): ToolResult<never> {
  return {
    status: 'failed',
    tool,
    error: {
      code,
      message,
      retryable: options.retryable ?? false,
      ...(options.field ? { field: options.field } : {}),
    },
  };
}

export function errorToToolFailure(
  tool: string,
  error: unknown,
  fallbackMessage: string,
): ToolResult<never> {
  if (error instanceof ToolExecutionError) {
    return toolFailed(tool, error.code, error.message, {
      retryable: error.code !== 'CANCELLED',
    });
  }
  return toolFailed(tool, 'DOWNSTREAM_ERROR', fallbackMessage, {
    retryable: true,
  });
}

/** 只提取排障所需字段，避免日志携带请求头、API Key 或用户原文。 */
export function describeToolError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') {
    return { message: String(error) };
  }

  const value = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    type?: unknown;
    cause?: unknown;
  };

  const details: Record<string, unknown> = {
    ...(typeof value.name === 'string' ? { name: value.name } : {}),
    ...(typeof value.message === 'string' ? { message: value.message } : {}),
    ...(typeof value.code === 'string' ? { code: value.code } : {}),
    ...(typeof value.status === 'number' ? { status: value.status } : {}),
    ...(typeof value.statusCode === 'number'
      ? { statusCode: value.statusCode }
      : {}),
    ...(typeof value.type === 'string' ? { type: value.type } : {}),
  };

  if (value.cause && typeof value.cause === 'object') {
    details.cause = describeToolError(value.cause);
  }

  return details;
}

export function messageContentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }
  if (content == null) return '';
  if (typeof content === 'number' || typeof content === 'boolean') {
    return String(content);
  }
  return '';
}

export function toJsonResult(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
