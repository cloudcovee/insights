import { PageContext } from '../types';

export function getPageContext(): PageContext {
  if (typeof window === 'undefined') {
    return {
      url: '',
      hostname: '',
      pathname: '',
      title: '',
      referrer: '',
      search: ''
    };
  }

  return {
    url: window.location.href,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    title: document.title,
    referrer: document.referrer,
    search: window.location.search
  };
}
