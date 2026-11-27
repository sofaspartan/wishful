import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
  label: string;
  buttonClassName?: string;
  buttonContent?: ReactNode;
  children: (close: () => void) => ReactNode;
  className?: string;
  /** Prefer aligning the panel to the trigger/viewport end (right in LTR). */
  align?: 'start' | 'end';
  /** Controlled open state (omit for uncontrolled). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When false, no trigger — open only via `open` / `onOpenChange`. */
  showTrigger?: boolean;
}

/** Non-menu popover (e.g. notifications panel). Fixed-positioned in a portal. */
export function Popover({
  label,
  buttonClassName = 'btn btn-ghost btn-icon',
  buttonContent,
  children,
  className,
  align = 'end',
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight?: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, [setOpen]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    panel.style.maxHeight = '';
    panel.style.overflowY = '';
    const p = panel.getBoundingClientRect();
    const pad = 8;
    const gap = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const shell = document.querySelector('.app-shell');
    const mobileShell = shell?.getAttribute('data-layout-mode') === 'mobile' || vw < 1024;
    const t = triggerRef.current?.getBoundingClientRect();

    let left: number;
    let top: number;
    let maxHeight: number | undefined;
    if (t) {
      left = align === 'end' ? (mobileShell ? vw - p.width - pad : t.right - p.width) : t.left;
      left = Math.max(pad, Math.min(left, vw - Math.min(p.width, vw - pad * 2) - pad));
      const spaceBelow = vh - t.bottom - gap - pad;
      const spaceAbove = t.top - gap - pad;
      if (p.height <= spaceBelow) {
        top = t.bottom + gap;
      } else if (p.height <= spaceAbove) {
        top = t.top - p.height - gap;
      } else if (spaceBelow >= spaceAbove) {
        top = t.bottom + gap;
        maxHeight = Math.max(120, spaceBelow);
      } else {
        maxHeight = Math.max(120, spaceAbove);
        top = Math.max(pad, t.top - gap - maxHeight);
      }
    } else {
      /* No trigger (opened from a menu) — pin to the top end of the viewport. */
      left = align === 'end' ? vw - p.width - 12 : 12;
      left = Math.max(pad, Math.min(left, vw - Math.min(p.width, vw - pad * 2) - pad));
      top = Math.max(12, (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0) + 56);
      if (top + p.height > vh - pad) maxHeight = Math.max(120, vh - pad - top);
    }
    if (top < pad) {
      top = pad;
      maxHeight = Math.max(120, Math.min(maxHeight ?? p.height, vh - pad * 2));
    }
    if (top + (maxHeight ?? p.height) > vh - pad) {
      maxHeight = Math.max(120, vh - pad - top);
    }
    setPos({ top, left, maxHeight });
    panel.focus({ preventScroll: true });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  return (
    <>
      {showTrigger && (
        <button
          ref={triggerRef}
          type="button"
          className={buttonClassName}
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => (open ? close() : setOpen(true))}
          style={{ position: 'relative' }}
        >
          {buttonContent}
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            className={['menu', className].filter(Boolean).join(' ')}
            style={{
              position: 'fixed',
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              right: 'auto',
              maxHeight: pos?.maxHeight,
              overflowY: pos?.maxHeight ? 'auto' : undefined,
            }}
          >
            {children(close)}
          </div>,
          (triggerRef.current?.closest('.app-shell, .modal-root, .public-shell') as HTMLElement | null) ??
            (document.querySelector('.app-shell') as HTMLElement | null) ??
            document.body,
        )}
    </>
  );
}
