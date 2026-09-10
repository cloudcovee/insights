import { EventPayload } from '../types';
import { logger } from '../utils';
import { storage } from '../storage';

const QUEUE_KEY = 'insight_event_queue';

export class QueueManager {
  private queue: EventPayload[] = [];

  constructor() {
    this.loadQueue();
  }

  enqueue(payload: EventPayload) {
    this.queue.push(payload);
    this.saveQueue();
  }

  dequeue(count: number): EventPayload[] {
    const items = this.queue.splice(0, count);
    if (items.length > 0) this.saveQueue();
    return items;
  }

  requeue(payloads: EventPayload[]) {
    this.queue = [...payloads, ...this.queue];
    this.saveQueue();
  }

  length(): number {
    return this.queue.length;
  }

  getAll(): EventPayload[] {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
    this.saveQueue();
  }

  private saveQueue() {
    try {
      storage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      logger.warn('Failed to save event queue', e);
    }
  }

  private loadQueue() {
    try {
      const stored = storage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored) || [];
      }
    } catch (e) {
      logger.warn('Failed to load event queue', e);
      this.queue = [];
    }
  }
}

export const queueManager = new QueueManager();
