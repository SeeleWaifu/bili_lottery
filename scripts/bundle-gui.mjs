/**
 * Bundle the Electron main-process and preload scripts into single CJS files,
 * then copy the Vite-built renderer output into dist/gui/.
 *
 * Output layout (matches the path conventions already in the source):
 *   dist/gui/
 *     main/main.js        ← bundled main process (CJS)
 *     preload/index.js     ← bundled preload      (CJS)
 *     renderer/            ← Vite build output (copied as-is)
 *       index.html
 *       login.html
 *       setting.html
 *       assets/…
 *
 * Run:  node scripts/bundle-gui.mjs
 * Prerequisite:  pnpm build   (tsc + vite)
 */

import * as esbuild from 'esbuild';
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// ── Clean previous output ───────────────────────────────────────────
if (existsSync('dist/gui')) {
    await rm('dist/gui', { recursive: true });
}
await mkdir('dist/gui/main', { recursive: true });
await mkdir('dist/gui/preload', { recursive: true });

// ── Shared esbuild options ──────────────────────────────────────────
// The source uses `import.meta.url` to derive __dirname (ESM convention).
// When targeting CJS, esbuild leaves `import.meta` as an empty object.
// We inject a CJS-compatible polyfill via `define` + `banner` so the
// existing `fileURLToPath(import.meta.url)` continues to work in the bundle.
/** @type {import('esbuild').BuildOptions} */
const sharedOptions = {
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: ['electron'],
    sourcemap: false,
    minify: false,
    define: {
        'import.meta.url': '__import_meta_url',
    },
    banner: {
        js: 'var __import_meta_url = require("url").pathToFileURL(__filename).href;',
    },
};

// ── Bundle main process ─────────────────────────────────────────────
await esbuild.build({
    ...sharedOptions,
    entryPoints: ['build/gui/main/main.js'],
    outfile: 'dist/gui/main/main.js',
});
console.log('✔ Main-process bundle → dist/gui/main/main.js');

// ── Bundle preload ──────────────────────────────────────────────────
await esbuild.build({
    ...sharedOptions,
    entryPoints: ['build/gui/preload/index.js'],
    outfile: 'dist/gui/preload/index.js',
});
console.log('✔ Preload bundle       → dist/gui/preload/index.js');

// ── Copy renderer (already built by Vite) ───────────────────────────
await cp('build/gui/renderer', 'dist/gui/renderer', { recursive: true });
console.log('✔ Renderer copied       → dist/gui/renderer/');

console.log('\n✔ GUI dist ready in dist/gui/');
