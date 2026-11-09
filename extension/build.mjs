/**
 * Builds the browser extension into extension/dist (or extension/dist-dev with --dev).
 *
 *   npm run extension:build          → talks to the live site
 *   npm run extension:dev            → talks to http://localhost:5173
 *   WISHFUL_URL=https://… npm run extension:build   → any other deployment
 *
 * Two passes: the popup is a normal ES-module page, while the content script
 * must be a single classic script, so it is bundled separately as an IIFE.
 */
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');
const siteUrl = (process.env.WISHFUL_URL || (dev ? 'http://localhost:5173' : 'https://wishful-lists.netlify.app')).replace(/\/$/, '');
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
