import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CircleCheck, Puzzle, TriangleAlert } from 'lucide-react';
import type { ExtensionConnection } from '../../shared/types';
import { APP_SOURCE, isExtensionMessage, type AppMessage } from '../../shared/extension';
import { brand } from '../config/brand';
import { del, errorMessage, post } from '../lib/api';
import { keys, useMe } from '../lib/queries';
import { Button } from '../components/ui/Button';
import { Logo, LogoMark } from '../components/Logo';
import { CloudBank, CloudPuff } from '../components/Cloud';
import { ThemeToggle } from '../components/ThemeToggle';

type Status = 'checking' | 'missing' | 'ready' | 'connecting' | 'done' | 'failed';

/** How long to wait for the extension's content script to answer a ping, and to confirm it stored the token. */
const DETECT_MS = 2500;
const CONFIRM_MS = 6000;

const send = (message: AppMessage) => window.postMessage(message, window.location.origin);

export default function ExtensionConnect() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const state = params.get('state') ?? '';
  const validState = /^[A-Za-z0-9_-]{16,128}$/.test(state);
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ id: string; timer: number } | null>(null);
  const abandonRef = useRef<(message: string) => void>(() => undefined);

  useEffect(() => {
    document.title = `Connect the extension · ${brand.name}`;
  }, []);

  useEffect(() => {
    /** Removes the token we just issued if the extension never took it, so no unused connection lingers. */
    const abandon = (message: string) => {
      const p = pending.current;
      pending.current = null;
      if (p) {
        window.clearTimeout(p.timer);
        void del(`/api/extension/connections/${p.id}`).catch(() => undefined);
      }
      setError(message);
      setStatus('failed');
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || !isExtensionMessage(event.data)) return;
      const msg = event.data;
      if (msg.type === 'pong') setStatus((s) => (s === 'checking' || s === 'missing' ? 'ready' : s));
      else if (msg.type === 'connected' && pending.current) {
        window.clearTimeout(pending.current.timer);
        pending.current = null;
        setStatus('done');
        void qc.invalidateQueries({ queryKey: keys.extensionConnections });
      } else if (msg.type === 'connect-failed') abandon(msg.message);
    };
    window.addEventListener('message', onMessage);

    send({ source: APP_SOURCE, type: 'ping' });
    const pinger = window.setInterval(() => send({ source: APP_SOURCE, type: 'ping' }), 400);
    const giveUp = window.setTimeout(() => {
      window.clearInterval(pinger);
      setStatus((s) => (s === 'checking' ? 'missing' : s));
    }, DETECT_MS);

    abandonRef.current = abandon;
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(pinger);
      window.clearTimeout(giveUp);
    };
  }, [qc]);

  const connect = async () => {
    setStatus('connecting');
    setError(null);
    try {
      const { token, connection } = await post<{ token: string; connection: ExtensionConnection }>('/api/extension/connect');
      const timer = window.setTimeout(() => {
        abandonRef.current("The extension didn't respond. Close this tab and choose Connect from the extension again.");
      }, CONFIRM_MS);
      pending.current = { id: connection.id, timer };
      send({ source: APP_SOURCE, type: 'token', token, state });
    } catch (err) {
      setError(errorMessage(err));
      setStatus('failed');
    }
  };

  return (
    <div className="auth-page connect-page">
      <CloudPuff className="auth-cloud-1" />
      <CloudPuff className="auth-cloud-2" />
      <CloudPuff className="auth-cloud-3" />
      <ThemeToggle className="auth-theme-toggle" />
      <div className="connect-top">
        <Logo to="/app" />
      </div>
      <main id="main" className="connect-main">
        <div className="card connect-card">
          <div className="connect-pair" aria-hidden>
            <LogoMark size={52} />
            <span className="connect-link" />
            <span className="connect-ext">
              <Puzzle size={24} />
            </span>
          </div>

          {status === 'done' ? (
            <>
              <h1 className="connect-title display">You’re connected</h1>
              <p className="connect-lead">
                Close this tab, then click the {brand.name} icon in your browser’s toolbar on any product page to save it.
              </p>
              <div className="connect-note connect-note-ok" role="status">
                <CircleCheck size={18} aria-hidden /> The extension is linked to {me?.displayName ?? 'your account'}.
              </div>
              <Link to="/app/settings?tab=extension" className="btn">
                Manage connected browsers
              </Link>
            </>
          ) : !validState ? (
            <>
              <h1 className="connect-title display">Connect from the extension</h1>
              <p className="connect-lead">
                Click the {brand.name} icon in your browser’s toolbar and choose <strong>Connect to {brand.name}</strong>. It will bring you back here.
              </p>
              <Link to="/app" className="btn">
                Back to {brand.name}
              </Link>
            </>
          ) : (
            <>
              <h1 className="connect-title display">Connect the {brand.name} extension</h1>
              {me && (
                <p className="connect-lead">
                  Signed in as <strong>{me.displayName}</strong> · {me.email}
                </p>
              )}
              <div className="connect-scope">
                <span className="connect-scope-label">The extension will be able to</span>
                <ul>
                  <li>
                    <Check size={16} aria-hidden /> See the names of your lists
                  </li>
                  <li>
                    <Check size={16} aria-hidden /> Save the pages you choose to them
                  </li>
                </ul>
                <p className="muted text-sm">
                  It can’t see gift reservations, change your settings or delete anything. You can disconnect it at any time in Settings.
                </p>
              </div>

              {status === 'missing' && (
                <div className="connect-note" role="alert">
                  <TriangleAlert size={18} aria-hidden /> We can’t find the {brand.name} extension in this browser. Make sure it’s installed and
                  enabled, then reload this page.
                </div>
              )}
              {status === 'failed' && error && (
                <div className="connect-note" role="alert">
                  <TriangleAlert size={18} aria-hidden /> {error}
                </div>
              )}

              <div className="connect-actions">
                <Button variant="primary" size="lg" onClick={connect} loading={status === 'connecting'} disabled={status === 'checking' || status === 'missing'}>
                  {status === 'checking' ? 'Looking for the extension…' : status === 'failed' ? 'Try again' : 'Connect extension'}
                </Button>
                <Link to="/app" className="btn btn-ghost btn-lg">
                  Cancel
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <CloudBank className="auth-bank" />
    </div>
  );
}
