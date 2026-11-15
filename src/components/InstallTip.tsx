import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useLocalPref } from '../lib/prefs';
import { isStandaloneDisplay } from '../lib/layoutMode';
import { Button } from './ui/Button';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit && notOther;
}

/**
 * Soft prompt to install Wishful on the home screen. Android/Chrome uses the
 * deferred install prompt; iOS shows Share → Add to Home Screen instructions.
 */
export function InstallTip() {
  const [tip, setTip] = useLocalPref('install.tip', 'show', ['show', 'hidden'] as const);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tip === 'hidden' || isStandaloneDisplay()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setIosHint(false);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    if (isIosSafari()) setIosHint(true);

    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, [tip]);

  useEffect(() => {
    const onInstalled = () => {
      setDeferred(null);
      setTip('hidden');
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, [setTip]);

  if (tip === 'hidden' || isStandaloneDisplay()) return null;
  if (!deferred && !iosHint) return null;

  const dismiss = () => setTip('hidden');

  const install = async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setTip('hidden');
    } catch {
      /* user dismissed the browser sheet */
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="install-tip" role="status">
      <div className="install-tip-copy">
        <strong>Add Wishful to your Home Screen</strong>
        {iosHint && !deferred ? (
          <span>
            Tap <Share size={14} aria-label="Share" className="install-tip-inline-icon" /> then{' '}
            <em>Add to Home Screen</em> for a full-screen app.
          </span>
        ) : (
          <span>Install for a faster, full-screen experience — like an app, in your browser.</span>
        )}
      </div>
      <div className="install-tip-actions">
        {deferred && (
          <Button type="button" size="sm" variant="primary" icon={<Download size={14} aria-hidden />} loading={busy} onClick={() => void install()}>
            Install
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" iconOnly icon={<X size={16} aria-hidden />} aria-label="Dismiss" onClick={dismiss} />
      </div>
    </aside>
  );
}
