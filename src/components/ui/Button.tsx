import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

type Variant = 'default' | 'primary' | 'accent' | 'ghost' | 'danger' | 'danger-ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconOnly?: boolean;
  block?: boolean;
}

export function buttonClass({ variant = 'default', size = 'md', iconOnly, block }: Pick<ButtonProps, 'variant' | 'size' | 'iconOnly' | 'block'> = {}) {
  return [
    'btn',
    variant !== 'default' && `btn-${variant}`,
    size !== 'md' && `btn-${size}`,
    iconOnly && 'btn-icon',
    block && 'btn-block',
  ]
    .filter(Boolean)
    .join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, icon, iconOnly, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const iconSize = size === 'sm' ? 15 : 17;
  return (
    <button
      ref={ref}
      type={type}
      className={[buttonClass({ variant, size, iconOnly, block }), className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle size={iconSize} className="spinner" aria-hidden /> : icon}
      {children}
    </button>
  );
});
