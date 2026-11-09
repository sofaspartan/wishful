import { Moon, Sun } from 'lucide-react';
import { setTheme, useTheme } from '../lib/theme';

/** Sun / moon button that flips between the daytime sky and the starry night theme. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      className={['btn btn-ghost btn-icon theme-toggle', dark && 'is-dark', className].filter(Boolean).join(' ')}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
    >
      <Sun className="theme-toggle-sun" size={19} aria-hidden />
      <Moon className="theme-toggle-moon" size={18} aria-hidden />
    </button>
  );
}
