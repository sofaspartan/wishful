import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
  label: string;
  buttonClassName?: string;
  buttonContent: ReactNode;
  children: (close: () => void) => ReactNode;
  className?: string;
}

/** Non-menu popover (e.g. notifications panel). Fixed-positioned in a portal. */
export function Popover({ label, buttonClassName = 'btn btn-ghost btn-icon', buttonContent, children, className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const p = panelRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(t.right - p.width, window.innerWidth - p.width - 8));
    setPos({ top: t.bottom + 6, left });
    panelRef.current.focus({ preventScroll: true });
  }, [open]);

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
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            className={['menu', className].filter(Boolean).join(' ')}
            style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, right: 'auto' }}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}
