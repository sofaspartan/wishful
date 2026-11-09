import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Download, ExternalLink, Puzzle } from 'lucide-react';
import { brand } from '../config/brand';
import { LogoMark } from './Logo';
import { ILLUSTRATED_ITEMS } from './ItemIllustrations';
import { useToast } from './ui/Toast';

export const EXTENSION_ZIP = '/downloads/wishful-extension.zip';
const BROWSERS = 'Chrome, Edge, Brave and Arc';

interface ExtensionInfo {
  version: string;
  size: number;
}

/** Version and size of the zip the build put in /downloads (missing in dev until `npm run extension:build`). */
function useExtensionInfo() {
  return useQuery({
    queryKey: ['extension-download'],
    queryFn: async (): Promise<ExtensionInfo | null> => {
      const res = await fetch('/downloads/extension.json', { cache: 'no-cache' });
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null;
      return res.json();
    },
    staleTime: Infinity,
    retry: false,
  });
}

/** "Add to Chrome" once the store listing exists, otherwise a direct download of the zip. */
export function ExtensionGetButton({ size }: { size?: 'lg' }) {
  const { data: info } = useExtensionInfo();
  const cls = `btn btn-primary${size ? ` btn-${size}` : ''}`;
  if (brand.extensionUrl) {
    return (
      <div className="ext-get">
        <a href={brand.extensionUrl} target="_blank" rel="noreferrer" className={cls}>
          <Puzzle size={17} aria-hidden /> Add to Chrome <ExternalLink size={14} aria-hidden />
        </a>
        <span className="ext-get-meta">Free · Works in {BROWSERS}</span>
      </div>
    );
  }
  return (
    <div className="ext-get">
      <a href={EXTENSION_ZIP} download className={cls}>
        <Download size={17} aria-hidden /> Download the extension
      </a>
      <span className="ext-get-meta">
        {info ? `Version ${info.version} · ${Math.max(1, Math.round(info.size / 1024))} KB · ` : ''}For {BROWSERS}
      </span>
    </div>
  );
}

const EXTENSIONS_PAGE = 'chrome://extensions';

/** Manual install steps for the downloaded zip. Hidden once the store listing exists. */
export function InstallSteps() {
  const toast = useToast();
  if (brand.extensionUrl) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EXTENSIONS_PAGE);
      toast.success('Copied — paste it into your address bar');
    } catch {
      toast.error('Couldn’t copy — type chrome://extensions into your address bar');
    }
  };

  return (
    <ol className="ext-steps">
      <li>
        <strong>Download and unzip it.</strong> You’ll get a folder called <code>wishful-extension</code>. Keep it somewhere it won’t be deleted — your
        browser loads the extension from it.
      </li>
      <li>
        <strong>
          Open <code>{EXTENSIONS_PAGE}</code>
        </strong>{' '}
        <button type="button" className="ext-copy" onClick={() => void copy()} aria-label="Copy chrome://extensions">
          <Copy size={13} aria-hidden /> Copy
        </button>{' '}
        in your address bar (in Edge it’s <code>edge://extensions</code>) and turn on <strong>Developer mode</strong>.
      </li>
      <li>
        Click <strong>Load unpacked</strong> and choose the <code>wishful-extension</code> folder.
      </li>
      <li>
        Pin {brand.name} from the <Puzzle size={14} aria-label="extensions" className="ext-inline-icon" /> menu, open any product page, click the{' '}
        {brand.name} button and choose <strong>Connect to {brand.name}</strong>.
      </li>
    </ol>
  );
}

/** A browser window with a product page and the extension popup open over it. Decorative. */
export function ExtensionArt() {
  const sneaker = ILLUSTRATED_ITEMS[3];
  return (
    <div className="ext-art" aria-hidden>
      <div className="ext-browser">
        <div className="ext-browser-bar">
          <span className="ext-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="ext-url">trailshop.com/products/runner</span>
          <span className="ext-toolbar-icon">
            <LogoMark size={20} />
          </span>
        </div>
        <div className="ext-page">
          <div className="ext-page-photo">{sneaker.art}</div>
          <div className="ext-page-copy">
            <span className="ext-line ext-line-sm" />
            <span className="ext-line ext-line-lg" />
            <span className="ext-page-price">{sneaker.price}.00</span>
            <span className="ext-line" />
            <span className="ext-line ext-line-md" />
            <span className="ext-page-btn" />
          </div>
        </div>
      </div>
      <div className="ext-popup">
        <div className="ext-popup-head">
          <LogoMark size={18} />
          <span>{brand.name}</span>
        </div>
        <div className="ext-popup-item">
          <span className="ext-popup-thumb">{sneaker.art}</span>
          <span className="ext-popup-name">
            <strong>{sneaker.name}</strong>
            <span>{sneaker.price}.00 · Trail Shop</span>
          </span>
        </div>
        <div className="ext-popup-lists">
          <span className="ext-popup-list is-on">
            <Check size={11} strokeWidth={3} /> Birthday
          </span>
          <span className="ext-popup-list">Running gear</span>
        </div>
        <span className="ext-popup-save">Save to Birthday</span>
      </div>
    </div>
  );
}
