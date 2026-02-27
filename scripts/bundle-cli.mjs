/**
 * Bundle the CLI entry (build/cli/main.js) into a single CJS file
 * that can be fed to @yao-pkg/pkg for standalone binary creation.
 *
 * Run:  node scripts/bundle-cli.mjs
 * Prerequisite:  pnpm build:main   (tsc compile)
 */

import * as esbuild from 'esbuild';

await esbuild.build({
    entryPoints: ['build/cli/main.js'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: 'dist/cli/main.cjs',
    sourcemap: false,
    minify: false,
    // Node.js built-ins are automatically external with platform: 'node'
});

console.log('✔ CLI bundle created → dist/cli/main.cjs');
