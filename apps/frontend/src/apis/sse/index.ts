import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { Method } from 'axios';
import { useUserStore } from '@/stores/user';
import { refreshAccessToken } from '@/apis';

export const CHAT_URL = '/ai/v1/chat';

const authHeaders = (accessToken?: string | null): Record<string, string> => {
  const token = accessToken ?? useUserStore().getAccessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';

async function fetchWithAuthRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status !== 401) return response;

  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) {
    return response;
  }

  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...authHeaders(newAccessToken),
    },
  });
}

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
  let retried = false;

  const connect = (accessToken?: string) => {
    fetchEventSource(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(accessToken),
      },
      body: JSON.stringify(body),
      signal,
      onopen: async (response) => {
        if (response.ok) return;
        if (response.status === 401 && !retried) {
          retried = true;
          const newAccessToken = await refreshAccessToken();
          if (newAccessToken) {
            connect(newAccessToken);
            throw new Error('AUTH_RETRY');
          }
        }
        throw new Error(`请求失败：${response.status}`);
      },
      onmessage: (event) => {
        onMessage?.(JSON.parse(event.data) as T);
      },
      onerror: (event) => {
        if (signal?.aborted) throw event;
        if (event instanceof Error && event.message === 'AUTH_RETRY') {
          throw event;
        }
        onError?.(event instanceof Error ? event : new Error('请求失败'));
        throw event;
      },
    });
  };

  connect();
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
    const response = await fetchWithAuthRetry(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
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

    await readSseStream(response.body, onMessage, onDone, signal);
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      return;
    }
    onError?.(error instanceof Error ? error : new Error('请求失败'));
  }
};

async function readSseStream<T>(
  body: ReadableStream<Uint8Array>,
  onMessage?: SseCallbacks<T>['onMessage'],
  onDone?: () => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const onAbort = () => {
    void reader.cancel();
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }

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
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}
