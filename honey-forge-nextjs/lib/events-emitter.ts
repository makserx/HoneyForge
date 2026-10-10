import { AttackEvent, HoneypotNode } from './types';

export type SSEPayload =
  | { type: 'attack_event'; data: AttackEvent }
  | { type: 'attack_batch'; data: AttackEvent[] }
  | { type: 'node_update'; data: HoneypotNode }
  | { type: 'node_offline'; data: { id: string; lastSeen: string } }
  | { type: 'ping'; timestamp: string };

type Listener = (payload: SSEPayload) => void;

class GlobalEventEmitter {
  private listeners: Set<Listener> = new Set();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(payload: SSEPayload): void {
    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('[EventEmitter] Listener error:', err);
      }
    }
  }

  public getSubscriberCount(): number {
    return this.listeners.size;
  }
}

// In Next.js dev & edge/server environments, attach to globalThis to prevent reload wipes
const globalWithEmitter = globalThis as unknown as {
  __honeyforgeEmitter?: GlobalEventEmitter;
};

if (!globalWithEmitter.__honeyforgeEmitter) {
  globalWithEmitter.__honeyforgeEmitter = new GlobalEventEmitter();
}

export const eventEmitter = globalWithEmitter.__honeyforgeEmitter;
