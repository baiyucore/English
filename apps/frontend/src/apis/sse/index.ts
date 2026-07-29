import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { Method } from 'axios';

export const CHAT_URL = '/ai/v1/chat';

/* eslint-disable no-unused-vars -- 回调参数名仅用于类型声明 */
interface SseCallbacks<T> {
  onMessage?(data: T): void;
  onError?(event: Error): void;
}

interface FetchSseOptions<T> extends SseCallbacks<T> {
  url: string;
  method?: string;
  body?: unknown;
  /** 调用方传入 AbortSignal，执行 controller.abort() 即可中断 */
  signal?: AbortSignal;
  onDone?(): void;
}
/* eslint-enable no-unused-vars */

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';

/** 基于 @microsoft/fetch-event-source 的实现 */
// TODO: 这里的 body 的类型需要去修改
export const sse = <T>(
  url: string,
  method: Method,
  body: unknown,
  onMessage?: SseCallbacks<T>['onMessage'],
  onError?: SseCallbacks<T>['onError'],
  signal?: AbortSignal,
) => {
  fetchEventSource(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
    onmessage: (event) => {
      onMessage?.(JSON.parse(event.data) as T);
    },
    onerror: (event) => {
      if (signal?.aborted) throw event;
      onError?.(event);
    },
  });
};

/** 基于原生 fetch + ReadableStream 的自研实现 */
export const fetchSse = async <T>({
  url,
  method = 'POST',
  body,
  signal,
  onMessage,
  onError,
  onDone,
}: FetchSseOptions<T>): Promise<void> => {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    if (!response.ok) {
      throw new Error(`请求失败：${response.status}`);
    }

    if (!response.body) {
      throw new Error('当前浏览器不支持流式读取');
    }

    await readSseStream(response.body, onMessage, onDone);
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    onError?.(error instanceof Error ? error : new Error('请求失败'));
  }
};

async function readSseStream<T>(
  body: ReadableStream<Uint8Array>,
  onMessage?: SseCallbacks<T>['onMessage'],
  onDone?: () => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      onDone?.();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.split('\n').find((item) => item.startsWith('data: '));

      if (!line) continue;

      const jsonText = line.replace('data: ', '').trim();
      if (!jsonText) continue;

      onMessage?.(JSON.parse(jsonText) as T);
    }
  }
}
