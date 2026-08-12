import { DeviceContext } from '../types';

export function getDeviceContext(): DeviceContext {
  if (typeof window === 'undefined') {
    return {
      type: 'Unknown',
      screenWidth: 0,
      screenHeight: 0,
      viewportWidth: 0,
      viewportHeight: 0
    };
  }

  const screenWidth = window.screen.width || 0;
  const screenHeight = window.screen.height || 0;
  
  let type = 'Desktop';
  if (screenWidth < 768) type = 'Mobile';
  else if (screenWidth < 1024) type = 'Tablet';

  return {
    type,
    screenWidth,
    screenHeight,
    viewportWidth: window.innerWidth || 0,
    viewportHeight: window.innerHeight || 0
  };
}
