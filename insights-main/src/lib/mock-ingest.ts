const STORAGE_KEY = 'insight_real_events';

export function setupMockIngest() {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch;
  
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());
    
    // Intercept only analytics tracking calls
    if (url.includes('/api/track') && init?.method === 'POST') {
      try {
        const payload = JSON.parse(init.body as string);
        
        // Load existing events
        const existing = localStorage.getItem(STORAGE_KEY);
        const events = existing ? JSON.parse(existing) : [];
        
        // Add new event
        events.push({
          ...payload,
          _mock_timestamp: new Date().toISOString()
        });
        
        // Save back
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
        
        // Dispatch custom event for real-time updates in React
        window.dispatchEvent(new Event('insight_event_tracked'));

        // Simulate a successful network response
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        console.error('Mock ingest error:', e);
      }
    }
    
    // Pass through all other requests
    return originalFetch.apply(this, [input, init] as any);
  };
}
