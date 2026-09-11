import { tracker } from './tracker';

export function initAutoTrackers(config: any) {
  if (!config.autoTrack) return;

  const { autoTrack } = config;

  if (autoTrack.pageViews !== false && typeof window !== 'undefined') {
    if (document.readyState === 'complete') {
      tracker.page();
    } else {
      window.addEventListener('load', () => tracker.page());
    }

    if (autoTrack.spa !== false) {
      let oldPushState = window.history.pushState;
      window.history.pushState = function(...args) {
        oldPushState.apply(this, args);
        setTimeout(() => tracker.page(), 0);
      };
      window.addEventListener('popstate', () => tracker.page());
    }
  }

  if (autoTrack.clicks !== false && typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Find closest anchor or button
      const actionable = target.closest('a, button');
      if (actionable) {
        tracker.track('click', {
          tagName: actionable.tagName.toLowerCase(),
          id: actionable.id,
          className: actionable.className,
          text: ((actionable as HTMLElement).innerText || '').substring(0, 50).trim(),
          href: (actionable as HTMLAnchorElement).href || undefined
        });
      }
    });
  }

  if (autoTrack.scroll !== false && typeof document !== 'undefined') {
    let maxScroll = 0;
    window.addEventListener('scroll', () => {
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (scrollHeight > 0) {
        const depth = Math.round((window.scrollY / scrollHeight) * 100);
        if (depth > maxScroll && depth % 25 === 0) { // Track 25%, 50%, 75%, 100%
          maxScroll = depth;
          tracker.track('scroll', { depth });
        }
      }
    }, { passive: true });
  }

  if (autoTrack.forms !== false && typeof document !== 'undefined') {
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      if (form) {
        tracker.track('form_submit', {
          formId: form.id,
          formClass: form.className,
          action: form.action
        });
      }
    });
  }

  if (autoTrack.errors !== false && typeof window !== 'undefined') {
    window.addEventListener('error', (e) => {
      tracker.track('js_error', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
      });
    });
    window.addEventListener('unhandledrejection', (e) => {
      tracker.track('unhandled_promise_rejection', {
        reason: e.reason?.toString() || 'Unknown'
      });
    });
  }

  if (autoTrack.performance !== false && typeof window !== 'undefined' && window.performance) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (nav) {
          tracker.track('performance_metric', {
            loadTime: nav.loadEventEnd - nav.startTime,
            domReadyTime: nav.domContentLoadedEventEnd - nav.startTime,
            ttfb: nav.responseStart - nav.requestStart
          });
        }
      }, 0);
    });
  }
}
