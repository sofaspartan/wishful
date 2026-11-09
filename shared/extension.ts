/**
 * Messages exchanged between the website's /extension/connect page and the
 * browser extension's content script via `window.postMessage`. The token only
 * travels from the page to the extension, and the extension accepts it only
 * with the one-time `state` it generated when it opened the page.
 */
export const APP_SOURCE = 'wishful-app';
export const EXTENSION_SOURCE = 'wishful-extension';
export const CONNECT_PATH = '/extension/connect';

export type AppMessage = { source: typeof APP_SOURCE; type: 'ping' } | { source: typeof APP_SOURCE; type: 'token'; token: string; state: string };

export type ExtensionMessage =
  | { source: typeof EXTENSION_SOURCE; type: 'pong' }
  | { source: typeof EXTENSION_SOURCE; type: 'connected' }
  | { source: typeof EXTENSION_SOURCE; type: 'connect-failed'; message: string };

export function isExtensionMessage(data: unknown): data is ExtensionMessage {
  return typeof data === 'object' && data !== null && (data as { source?: unknown }).source === EXTENSION_SOURCE;
}

export function isAppMessage(data: unknown): data is AppMessage {
  return typeof data === 'object' && data !== null && (data as { source?: unknown }).source === APP_SOURCE;
}
