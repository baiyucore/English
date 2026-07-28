import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { Method } from 'axios';
export const CHAT_URL = '/ai/v1/chat';

export const sse = <T>(
  URL: string,
  method: Method,
  body: any,
  onmessage?: (data: T) => void,
  onerror?: (event: Error) => void,
) => {
  fetchEventSource(URL, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    onmessage: (event) => {
      onmessage?.(JSON.parse(event.data) as T);
    },
    onerror: (event) => {
      onerror?.(event);
    },
  });
};
