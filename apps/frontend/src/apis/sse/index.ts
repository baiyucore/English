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
  onDone?(): void;
}
/* eslint-enable no-unused-vars */

/** 基于 @microsoft/fetch-event-source 的实现 */
export const sse = <T>(
  url: string,
  method: Method,
  body: unknown,
  onMessage?: SseCallbacks<T>['onMessage'],
  onError?: SseCallbacks<T>['onError'],
) => {
  fetchEventSource(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    onmessage: (event) => {
      onMessage?.(JSON.parse(event.data) as T);
    },
    onerror: (event) => {
      onError?.(event);
    },
  });
};

/** 基于原生 fetch + ReadableStream 的自研实现 */
export const fetchSse = async <T>({
  url,
  method = 'POST',
  body,
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
    });

    if (!response.ok) {
      throw new Error(`请求失败：${response.status}`);
    }

    if (!response.body) {
      throw new Error('当前浏览器不支持流式读取');
    }

    const reader = response.body.getReader();
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
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('请求失败'));
  }
};
