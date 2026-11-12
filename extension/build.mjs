/**
 * Builds the browser extension into extension/dist (or extension/dist-dev with --dev).
 *
 *   npm run extension:build          → talks to the live site (Netlify's URL when built there)
 *   npm run extension:dev            → talks to http://localhost:5174
 *   WISHFUL_URL=https://… npm run extension:build   → any other deployment
 *
 * The production build is also zipped into public/downloads/ so the site can
 * offer it for download (`npm run build` runs this first).
 *
 * Two passes: the popup is a normal ES-module page, while the content script
 * must be a single classic script, so it is bundled separately as an IIFE.
 */
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { zipDirectory } from './zip.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');
const siteUrl = (process.env.WISHFUL_URL || (dev ? 'http://localhost:5174' : process.env.URL || 'https://wishful-lists.netlify.app')).replace(/\/$/, '');
const site = new URL(siteUrl);
const outDir = path.join(root, dev ? 'dist-dev' : 'dist');
const define = { __WISHFUL_URL__: JSON.stringify(siteUrl) };
const VERSION = '0.1.0';

await build({
  root,
  configFile: false,
  base: './',
  logLevel: 'warn',
  plugins: [react()],
  define,
  publicDir: path.join(root, 'public'),
  build: {
    outDir,
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: { popup: path.join(root, 'popup.html') },
      output: { entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js', assetFileNames: 'assets/[name]-[hash][extname]' },
    },
  },
});

await build({
  root,
  configFile: false,
  logLevel: 'warn',
  define,
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    lib: { entry: path.join(root, 'src/connect.ts'), formats: ['iife'], name: 'WishfulConnect', fileName: () => 'connect.js' },
  },
});

// Match patterns ignore ports, so the dev build also works on any localhost port.
const origin = `${site.protocol}//${site.hostname}`;
const icons = { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' };
const manifest = {
  manifest_version: 3,
  name: dev ? 'Wishful (dev)' : 'Wishful — Save to your wishlist',
  short_name: 'Wishful',
  version: VERSION,
  description: 'Save products from any store to your Wishful wishlists and collections in one click.',
  icons,
  action: { default_popup: 'popup.html', default_title: 'Save to Wishful', default_icon: icons },
  permissions: ['activeTab', 'scripting', 'storage'],
  host_permissions: [`${origin}/*`],
  content_scripts: [{ matches: [`${origin}/extension/connect*`], js: ['connect.js'], run_at: 'document_start' }],
};
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Built ${path.relative(process.cwd(), outDir)} for ${siteUrl}`);

if (!dev) {
  const downloads = path.join(root, '..', 'public', 'downloads');
  await fs.mkdir(downloads, { recursive: true });
  const archive = await zipDirectory(outDir, 'wishful-extension');
  await fs.writeFile(path.join(downloads, 'wishful-extension.zip'), archive);
  const info = { version: VERSION, size: archive.length, builtAt: new Date().toISOString() };
  await fs.writeFile(path.join(downloads, 'extension.json'), JSON.stringify(info) + '\n');
  console.log(`Packaged ${path.relative(process.cwd(), downloads)}/wishful-extension.zip (${Math.round(archive.length / 1024)} KB)`);
}
