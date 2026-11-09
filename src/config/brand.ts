/**
 * Brand configuration. Change the name, tagline, colours or fonts here and the
 * whole app follows. Colour values feed the `--brand-*` custom properties that
 * `src/styles/tokens.css` builds the light and dark palettes from. (Email templates read `BRAND_NAME` on the server.)
 */
export const brand = {
  name: 'Wishful',
  tagline: 'Everything you want, all in one place.',
  description: 'More than a wishlist. Collect products, experiences and ideas — and share them with the people who matter.',
  /** Shown on the privacy policy page for privacy questions and data requests. Leave empty to hide the contact section. */
  contactEmail: 'shermanea411@gmail.com',
  /** Store listing for the browser extension. Leave empty until it's published to hide the install button. */
  extensionUrl: '',
  colors: {
    accent: '#2f6fdc',
    accentHover: '#255bc0',
    accentSoft: '#e6eefc',
    accentInk: '#1f4ea6',
  },
  fonts: {
    display: "'Fraunces Variable', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
    sans: "'Inter Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
} as const;

/** The tagline split at its last ", " so headlines can colour the second half, e.g. ["Everything you want, ", "all in one place."]. */
export const taglineParts: [string, string] = (() => {
  const i = brand.tagline.lastIndexOf(', ');
  return i > 0 ? [brand.tagline.slice(0, i + 2), brand.tagline.slice(i + 2)] : [brand.tagline, ''];
})();

export function applyBrand() {
  const root = document.documentElement.style;
  root.setProperty('--brand-accent', brand.colors.accent);
  root.setProperty('--brand-accent-hover', brand.colors.accentHover);
  root.setProperty('--brand-accent-soft', brand.colors.accentSoft);
  root.setProperty('--brand-accent-ink', brand.colors.accentInk);
  root.setProperty('--font-display', brand.fonts.display);
  root.setProperty('--font-sans', brand.fonts.sans);
}
