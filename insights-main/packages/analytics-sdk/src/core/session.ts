import { storage } from '../storage';
import { generateUUID } from '../utils';

const SESSION_KEY = 'insight_session_id';
const LAST_ACTIVITY_KEY = 'insight_last_activity';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export class SessionManager {
  private sessionId: string | null = null;

  getSessionId(): string {
    if (!this.sessionId) {
      this.sessionId = storage.getItem(SESSION_KEY);
    }
    
    const lastActivityStr = storage.getItem(LAST_ACTIVITY_KEY);
    const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : 0;
    const now = Date.now();

    if (!this.sessionId || now - lastActivity > SESSION_TIMEOUT) {
      this.sessionId = generateUUID();
      storage.setItem(SESSION_KEY, this.sessionId);
    }
    
    this.updateLastActivity();
    return this.sessionId;
  }

  updateLastActivity(): void {
    storage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }
  
  reset(): void {
    this.sessionId = null;
    storage.removeItem(SESSION_KEY);
    storage.removeItem(LAST_ACTIVITY_KEY);
  }
}

export const sessionManager = new SessionManager();
