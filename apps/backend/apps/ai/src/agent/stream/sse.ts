import type { Response } from 'express';

import type { AgentStreamEvent } from './agent-stream-event';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

export function openSseReply(res: Response): void {
  res.status(200);
  res.set(SSE_HEADERS);
  res.flushHeaders?.();
}

export function writeSseEvent(
  res: Response,
  event: AgentStreamEvent,
): boolean {
  if (res.writableEnded || res.destroyed) {
    return false;
  }

  return res.write(
    `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
  );
}
