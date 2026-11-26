import { Component, createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { initials } from '../../lib/format';
import { Modal } from './Modal';
import { Button } from './Button';
import { BrandLoaderSvg } from '../brandLogo';
import { CloudBank } from '../Cloud';
import { ErrorSplash } from '../ErrorSplash';

export function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  const text = !src;
  return (
    <span className={['avatar', text && 'avatar-text'].filter(Boolean).join(' ')} style={{ ['--size' as string]: `${size}px` }} aria-hidden>
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : initials(name)}
    </span>
  );
}

/** Overlapping avatars for a group; past `max`, the last spot becomes "+2". */
export function AvatarStack({ people, size = 32, max = 3 }: { people: Array<{ name: string; avatarUrl?: string | null }>; size?: number; max?: number }) {
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const rest = people.length - shown.length;
  return (
    <span className="avatar-stack" aria-hidden>
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} src={p.avatarUrl} size={size} />
      ))}
      {rest > 0 && (
        <span className="avatar avatar-more" style={{ ['--size' as string]: `${size}px` }}>
          +{rest}
        </span>
      )}
    </span>
  );
}

export function Spinner({ size = 20, label = 'Loading' }: { size?: number; label?: string }) {
  return <LoaderCircle size={size} className="spinner" role="status" aria-label={label} />;
}

export function PageLoader() {
  return (
    <div className="page-loader page-loader-brand" role="status" aria-label="Loading">
      <BrandLoaderSvg />
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
  /** Colour coding for the sky: blue (default) for wishlists, blush for collections, kraft for boxes. */
  tone?: 'blush' | 'kraft';
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
  className,
  role = 'group',
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode; icon?: ReactNode; title?: string }>;
  label: string;
  full?: boolean;
  className?: string;
  role?: 'group' | 'tablist';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true, scrollable: false, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const scrollable = el.scrollWidth > el.clientWidth + 1;
      setEdges({
        start: el.scrollLeft <= 1,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
        scrollable,
        height: el.offsetHeight,
      });
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      resize.disconnect();
    };
  }, [options]);

  const scrollByDir = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * Math.min(140, el.clientWidth * 0.5), behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div
      className={['segmented-scroll', edges.scrollable && 'is-scrollable'].filter(Boolean).join(' ')}
      data-at-start={edges.start || undefined}
      data-at-end={edges.end || undefined}
      style={edges.height ? ({ ['--segmented-h']: `${edges.height}px` } as CSSProperties) : undefined}
    >
      <div ref={ref} className={['segmented', full && 'full', className].filter(Boolean).join(' ')} role={role} aria-label={label}>
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role={role === 'tablist' ? 'tab' : undefined}
              aria-pressed={role === 'tablist' ? undefined : selected}
              aria-selected={role === 'tablist' ? selected : undefined}
              aria-current={role === 'tablist' && selected ? 'page' : undefined}
              onClick={() => onChange(o.value)}
              title={o.title}
            >
              {o.icon}
              {o.label}
            </button>
          );
        })}
      </div>
      {edges.scrollable && !edges.start && (
        <button
          type="button"
          className="segmented-scroll-more segmented-scroll-more-prev"
          aria-label="Show earlier options"
          tabIndex={-1}
          onClick={() => scrollByDir(-1)}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
      )}
      {edges.scrollable && !edges.end && (
        <button
          type="button"
          className="segmented-scroll-more segmented-scroll-more-next"
          aria-label="Show more options"
          tabIndex={-1}
          onClick={() => scrollByDir(1)}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      )}
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
      <ErrorSplash
        kind="crash"
        actions={
          <>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <a className="btn" href="/app">
              Go home
            </a>
          </>
        }
      />
    );
  }
}
