import { init } from './core/init';
import { tracker } from './tracking/tracker';
import { AnalyticsConfig } from './types';

// Declare global interface
declare global {
  interface Window {
    insightq?: IArguments[] | any[];
    insight?: (...args: any[]) => void;
  }
}

function processCommand(args: any[]) {
  const command = args[0];
  
  try {
    switch (command) {
      case 'init':
        init(args[1] as AnalyticsConfig);
        break;
      case 'track':
        tracker.track(args[1], args[2]);
        break;
      case 'page':
        tracker.page(args[1]);
        break;
      case 'identify':
        tracker.identify(args[1], args[2]);
        break;
      default:
        console.warn(`[Insight Analytics] Unknown command: ${command}`);
    }
  } catch (err) {
    console.error(`[Insight Analytics] Error executing command ${command}:`, err);
  }
}

// Initialize and process queue
if (typeof window !== 'undefined') {
  const queue = window.insightq || [];
  
  // Define the main function that will process future calls immediately
  const insight = function(...args: any[]) {
    processCommand(args);
  };
  
  // Process the existing queue
  for (let i = 0; i < queue.length; i++) {
    // Convert arguments object to array if necessary
    processCommand(Array.prototype.slice.call(queue[i]));
  }
  
  // Attach to window so developers can call it
  window.insight = insight;
  
  // Redefine insightq.push to execute immediately so any late-loading scripts using the old push method still work
  window.insightq = {
    push: function(args: any) {
      if (args && args.length !== undefined && typeof args !== 'string') {
        processCommand(Array.prototype.slice.call(args));
      } else {
        processCommand(Array.prototype.slice.call(arguments));
      }
    }
  } as any;

  // Auto-initialize if data attributes are provided on the script tag
  // document.currentScript can be null in React/Next.js async script loading
  const script = (document.currentScript || 
                 document.querySelector('script[src*="insight-tag.js"]') || 
                 document.querySelector('script[data-project]')) as HTMLScriptElement;
                 
  if (script) {
    const apiKey = script.getAttribute('data-api-key') || script.getAttribute('data-project');
    const endpoint = script.getAttribute('data-endpoint') || 'http://localhost:8080/api/track';
    
    if (apiKey) {
      insight('init', {
        apiKey,
        endpoint,
        autoTrack: {
          pageViews: true,
          clicks: true
        }
      });
    }
  }
}

export {};
