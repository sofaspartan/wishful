/**
 * Content script for the site's /extension/connect page. It answers the page's
 * pings so the page knows the extension is installed, and accepts a token only
 * together with the one-time state this extension generated.
 */
import { EXTENSION_SOURCE, isAppMessage, type ExtensionMessage } from '../../shared/extension';
import { saveToken, takePendingState } from './storage';

const reply = (message: ExtensionMessage) => window.postMessage(message, window.location.origin);
const fail = (message: string) => reply({ source: EXTENSION_SOURCE, type: 'connect-failed', message });

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin || !isAppMessage(event.data)) return;
  const msg = event.data;
  if (msg.type === 'ping') return reply({ source: EXTENSION_SOURCE, type: 'pong' });
  if (msg.type !== 'token') return;
  void (async () => {
    if (typeof msg.token !== 'string' || !/^wfx_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(msg.token)) return fail('The connection details were invalid. Please try again.');
    if (!(await takePendingState(String(msg.state)))) return fail('This connect page has expired. Open the extension and choose Connect again.');
    await saveToken(msg.token);
    reply({ source: EXTENSION_SOURCE, type: 'connected' });
  })();
});
