import { NextRequest } from 'next/server';
import { eventEmitter, SSEPayload } from '@/lib/events-emitter';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connected greeting
      const initMessage = `data: ${JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
      })}\n\n`;
      controller.enqueue(encoder.encode(initMessage));

      // 2. Subscribe to real-time events bus
      const unsubscribe = eventEmitter.subscribe((payload: SSEPayload) => {
        try {
          const chunk = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch (err) {
          console.error('[SSE Stream] Failed to enqueue event:', err);
        }
      });

      // 3. Heartbeat keepalive ping every 15 seconds to prevent browser/proxy timeouts
      const keepaliveInterval = setInterval(() => {
        try {
          const pingChunk = `data: ${JSON.stringify({
            type: 'ping',
            timestamp: new Date().toISOString(),
          })}\n\n`;
          controller.enqueue(encoder.encode(pingChunk));
        } catch {
          clearInterval(keepaliveInterval);
        }
      }, 15000);

      // 4. Handle client disconnection
      req.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(keepaliveInterval);
        try {
          controller.close();
        } catch {
          // Stream might already be closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for Nginx reverse proxies
    },
  });
}
