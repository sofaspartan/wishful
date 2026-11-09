import { brand } from './brand';

/** Feed the brand colours and fonts into the CSS custom properties. Kept out of brand.ts, which also runs outside the browser. */
export function applyBrand() {
  const root = document.documentElement.style;
  root.setProperty('--brand-accent', brand.colors.accent);
  root.setProperty('--brand-accent-hover', brand.colors.accentHover);
  root.setProperty('--brand-accent-soft', brand.colors.accentSoft);
  root.setProperty('--brand-accent-ink', brand.colors.accentInk);
  root.setProperty('--font-display', brand.fonts.display);
  root.setProperty('--font-sans', brand.fonts.sans);
}
