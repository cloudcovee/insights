import { EventPayload } from '../types';

type Middleware = (payload: EventPayload, next: (payload: EventPayload) => void) => void;
type Plugin = { name: string; setup: (bus: EventBus) => void };

class EventBus {
  private middlewares: Middleware[] = [];
  private plugins: Plugin[] = [];
  private subscribers: Record<string, Array<(payload: EventPayload) => void>> = {};

  use(middleware: Middleware) {
    this.middlewares.push(middleware);
  }

  register(plugin: Plugin) {
    this.plugins.push(plugin);
    plugin.setup(this);
  }

  on(eventName: string, callback: (payload: EventPayload) => void) {
    if (!this.subscribers[eventName]) this.subscribers[eventName] = [];
    this.subscribers[eventName].push(callback);
  }
  
  off(eventName: string, callback?: (payload: EventPayload) => void) {
    if (!this.subscribers[eventName]) return;
    if (callback) {
      this.subscribers[eventName] = this.subscribers[eventName].filter(cb => cb !== callback);
    } else {
      this.subscribers[eventName] = [];
    }
  }

  dispatch(payload: EventPayload) {
    // Run through middlewares
    const run = (index: number, currentPayload: EventPayload) => {
      if (index < this.middlewares.length) {
        this.middlewares[index](currentPayload, (nextPayload) => run(index + 1, nextPayload));
      } else {
        // Final dispatch
        this.executeSubscribers(currentPayload);
      }
    };
    run(0, payload);
  }

  private executeSubscribers(payload: EventPayload) {
    const subs = this.subscribers[payload.eventName] || [];
    subs.forEach(cb => cb(payload));
    
    // Also dispatch to a catch-all if needed, e.g. '*'
    const allSubs = this.subscribers['*'] || [];
    allSubs.forEach(cb => cb(payload));
  }
}

export const eventBus = new EventBus();
