import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Only the top-most open modal reacts to Escape / Tab trapping. */
const stack: string[] = [];
let scrollLocks = 0;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Hide the header (for custom layouts like the search palette). */
  bare?: boolean;
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', className, bare }: ModalProps) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    stack.push(id);
    // The app root becomes inert so screen readers and pointer input can't reach the page behind.
    if (scrollLocks++ === 0) {
      document.body.style.overflow = 'hidden';
      document.getElementById('root')?.setAttribute('inert', '');
    }

    const frame = requestAnimationFrame(() => {
      const root = ref.current;
      if (!root) return;
      // Without an explicit target, focus the dialog itself: a focused field far up a long form
      // makes some browsers scroll back to it while the user scrolls down.
      const target = root.querySelector<HTMLElement>('[data-autofocus]') ?? root;
      target.focus({ preventScroll: true });
    });

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === 'Tab' && ref.current) {
        const nodes = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (document.activeElement === ref.current) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      const i = stack.lastIndexOf(id);
      if (i >= 0) stack.splice(i, 1);
      if (--scrollLocks === 0) {
        document.body.style.overflow = '';
        document.getElementById('root')?.removeAttribute('inert');
      }
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, id]);

  if (!open) return null;
  return createPortal(
    <div className="modal-root">
      <div className="modal-backdrop" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        className={['modal', size !== 'md' && `modal-${size}`, className].filter(Boolean).join(' ')}
      >
        {bare ? (
          <h2 id={`${id}-title`} className="sr-only">
            {title}
          </h2>
        ) : (
          <div className="modal-header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 id={`${id}-title`} className="modal-title display">
                {title}
              </h2>
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        {bare ? children : <div className="modal-body">{children}</div>}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
