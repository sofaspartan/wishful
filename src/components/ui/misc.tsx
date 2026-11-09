import { Component, createContext, useCallback, useContext, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { initials } from '../../lib/format';
import { Modal } from './Modal';
import { Button } from './Button';
import { CloudBank } from '../Cloud';

export function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  return (
    <span className="avatar" style={{ ['--size' as string]: `${size}px` }} aria-hidden>
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : initials(name)}
    </span>
  );
}

export function Spinner({ size = 20, label = 'Loading' }: { size?: number; label?: string }) {
  return <LoaderCircle size={size} className="spinner" role="status" aria-label={label} />;
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <Spinner size={24} />
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  /** An illustration (e.g. `<SkyArt />`); switches to the cloudy sky style. */
  art?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Colour coding for the sky: blue (default) for wishlists, blush for collections. */
  tone?: 'blush';
}

export function EmptyState({ icon, art, title, children, action, className, tone }: EmptyStateProps) {
  return (
    <div className={['empty', art ? 'empty-sky' : '', tone && `empty-${tone}`, className].filter(Boolean).join(' ')}>
      {art ?? <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="row-wrap" style={{ justifyContent: 'center', marginTop: 8 }}>{action}</div>}
      {art && <CloudBank className="empty-bank" />}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export function SwitchRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="switch-row">
      <div className="switch-text">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  full,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode; icon?: ReactNode; title?: string }>;
  label: string;
  full?: boolean;
}) {
  return (
    <div className={['segmented', full && 'full'].filter(Boolean).join(' ')} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} title={o.title}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Confirm dialog (promise-based) ─────────────────────────────────────────

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(undefined);
  const confirm = useCallback((o: ConfirmOptions) => {
    setState(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const finish = (v: boolean) => {
    resolver.current?.(v);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => finish(false)}
        title={state?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button onClick={() => finish(false)}>Cancel</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => finish(true)} data-autofocus>
              {state?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {state?.message && <p className="muted">{state.message}</p>}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}

// ── Error boundary ─────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-page">
        <div className="stack" style={{ alignItems: 'center', maxWidth: 420 }}>
          <div className="display" style={{ fontSize: '2.4rem' }}>
            Something went wrong
          </div>
          <p className="muted">An unexpected error occurred while showing this page. Your data is safe.</p>
          <div className="row">
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <a className="btn" href="/app">
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
