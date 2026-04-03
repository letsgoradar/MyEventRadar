import { Capacitor } from '@capacitor/core';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getApiBaseUrl(): string {
  if (isNativeApp()) {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) {
      console.error('VITE_API_URL is not set. Native app API calls will fail.');
      return '';
    }
    return apiUrl;
  }
  return '';
}

export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}

let _authRefreshCallback: (() => void) | null = null;
let _visibilityListenerAttached = false;

export function setupNativeAuthRefresh(onAuthChange: () => void): void {
  if (!isNativeApp()) return;
  _authRefreshCallback = onAuthChange;
  if (_visibilityListenerAttached) return;
  _visibilityListenerAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && _authRefreshCallback) {
      _authRefreshCallback();
    }
  });
}
