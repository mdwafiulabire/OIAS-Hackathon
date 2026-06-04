import { EventEmitter } from 'node:events';
import type { EventBusEvent, EventPayload } from '@oias/types';

export interface EventBus {
  emit(event: EventBusEvent, payload: EventPayload): void;
  on(event: EventBusEvent, handler: (payload: EventPayload) => Promise<void>): void;
  off(event: EventBusEvent, handler: (payload: EventPayload) => Promise<void>): void;
}

export function createEventBus(): EventBus {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(50);

  return {
    emit(event, payload) {
      emitter.emit(event, payload);
    },
    on(event, handler) {
      emitter.on(event, (payload: EventPayload) => {
        handler(payload).catch((err) => {
          // reason: event handlers must not crash the process
          console.error(`[EventBus] Error in handler for ${event}:`, err);
        });
      });
    },
    off(event, handler) {
      emitter.off(event, handler);
    },
  };
}
