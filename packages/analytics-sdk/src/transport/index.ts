import { EventPayload } from '../types';
import { logger } from '../utils';
import { queueManager } from '../queue';

export class Transport {
  private endpoint: string = '';
  private isProcessing: boolean = false;
  private batchSize: number = 10;
  private flushInterval: number = 2000;
  private retryBaseDelay: number = 1000;
  private timer: any = null;

  setEndpoint(endpoint: string) {
    this.endpoint = endpoint;
    this.startFlushTimer();
  }

  enqueue(payload: EventPayload) {
    queueManager.enqueue(payload);
    if (queueManager.length() >= this.batchSize) {
      this.flush();
    }
  }

  private startFlushTimer() {
    if (this.timer) clearInterval(this.timer);
    if (typeof window !== 'undefined') {
      this.timer = setInterval(() => this.flush(), this.flushInterval);
      window.addEventListener('beforeunload', () => this.flushSync());
    }
  }

  async flush(retries = 0) {
    if (this.isProcessing || queueManager.length() === 0 || !this.endpoint) {
      return;
    }

    this.isProcessing = true;
    const batch = queueManager.dequeue(this.batchSize);

    try {
      const success = await this.sendBatch(batch);
      if (!success) {
        throw new Error('Network failure or 5xx');
      }
      this.isProcessing = false;
      // Process next batch if queue isn't empty
      if (queueManager.length() > 0) {
        setTimeout(() => this.flush(), 50);
      }
    } catch (error) {
      this.isProcessing = false;
      // Requeue and retry with exponential backoff
      queueManager.requeue(batch);
      
      if (retries < 5) {
        const delay = this.retryBaseDelay * Math.pow(2, retries);
        setTimeout(() => this.flush(retries + 1), delay);
      }
    }
  }

  // Attempt to send remaining synchronously using sendBeacon
  private flushSync() {
    const remaining = queueManager.getAll();
    if (remaining.length === 0 || !this.endpoint) return;

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      // Group them as an array if backend supports batching, else just loop
      // We assume backend handles arrays (batch events)
      const blob = new Blob([JSON.stringify(remaining)], { type: 'application/json' });
      if (navigator.sendBeacon(this.endpoint, blob)) {
        queueManager.clear();
      }
    }
  }

  private async sendBatch(payloads: EventPayload[]): Promise<boolean> {
    if (typeof fetch !== 'undefined') {
      try {
        // Here we send the batch. If the backend doesn't support an array, we'd need to loop it.
        // For standard implementations (like GA4/Evergage), we can send an array or newline separated
        // We will send an array
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payloads),
          keepalive: true
        });

        // 4xx errors mean bad request, don't retry, just drop them (return true to clear from queue)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          logger.warn(`Dropping batch due to ${response.status} error`, payloads);
          return true;
        }

        return response.ok;
      } catch (e) {
        return false;
      }
    }
    return false;
  }
}

export const transport = new Transport();
