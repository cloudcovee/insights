import { BrowserContext } from '../types';

export function getBrowserContext(): BrowserContext {
  if (typeof navigator === 'undefined') {
    return {
      userAgent: '',
      language: '',
      timezone: '',
      name: '',
      version: '',
      os: ''
    };
  }

  const userAgent = navigator.userAgent;
  let name = 'Unknown';
  let version = 'Unknown';
  let os = 'Unknown';

  if (userAgent.indexOf('Win') !== -1) os = 'Windows';
  else if (userAgent.indexOf('Mac') !== -1) os = 'MacOS';
  else if (userAgent.indexOf('X11') !== -1) os = 'UNIX';
  else if (userAgent.indexOf('Linux') !== -1) os = 'Linux';
  else if (userAgent.indexOf('Android') !== -1) os = 'Android';
  else if (userAgent.indexOf('like Mac') !== -1) os = 'iOS';

  if (userAgent.indexOf('Firefox') !== -1) name = 'Firefox';
  else if (userAgent.indexOf('SamsungBrowser') !== -1) name = 'SamsungBrowser';
  else if (userAgent.indexOf('Opera') !== -1 || userAgent.indexOf('OPR') !== -1) name = 'Opera';
  else if (userAgent.indexOf('Trident') !== -1) name = 'Internet Explorer';
  else if (userAgent.indexOf('Edge') !== -1) name = 'Edge';
  else if (userAgent.indexOf('Chrome') !== -1) name = 'Chrome';
  else if (userAgent.indexOf('Safari') !== -1) name = 'Safari';

  return {
    userAgent,
    language: navigator.language || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    name,
    version,
    os
  };
}
