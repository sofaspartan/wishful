import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const MenuContext = createContext<{ close: () => void } | null>(null);

interface MenuProps {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  buttonClassName?: string;
  buttonContent?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

/**
 * Accessible dropdown menu. Rendered in a portal with fixed positioning so it
 * is never clipped by cards with `overflow: hidden`.
 */
export function Menu({ label, icon, children, buttonClassName = 'btn btn-ghost btn-icon btn-sm', buttonContent, align = 'right', className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    setPos(null);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const m = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = align === 'right' ? t.right - m.width : t.left;
    left = Math.max(8, Math.min(left, vw - m.width - 8));
    let top = t.bottom + 6;
    if (top + m.height > vh - 8 && t.top - m.height - 6 > 8) top = t.top - m.height - 6;
    setPos({ top, left });
    const first = menuRef.current.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus({ preventScroll: true });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={buttonClassName}
        aria-label={buttonContent ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (open) close(false);
          else setOpen(true);
        }}
      >
        {buttonContent ?? icon}
      </button>
      {open &&
        createPortal(
          <MenuContext.Provider value={{ close }}>
            <div
              ref={menuRef}
              id={id}
              role="menu"
              aria-label={label}
              className={['menu', className].filter(Boolean).join(' ')}
              style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, right: 'auto', bottom: 'auto' }}
              onKeyDown={onKeyDown}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </div>
          </MenuContext.Provider>,
          document.body,
        )}
    </>
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function MenuItem({ icon, children, onSelect, danger, disabled }: MenuItemProps) {
  const ctx = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      className={['menu-item', danger && 'danger'].filter(Boolean).join(' ')}
      onClick={() => {
        ctx?.close();
        onSelect();
      }}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export const MenuSeparator = () => <div className="menu-sep" role="separator" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => <div className="menu-label">{children}</div>;
