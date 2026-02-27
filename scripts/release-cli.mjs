/**
 * Build CLI standalone binaries for all platforms/architectures.
 *
 * Targets:
 *   - Windows  x64    → release/cli/bili_lottery-cli-win-x64.exe
 *   - macOS    x64    → release/cli/bili_lottery-cli-macos-x64
 *   - macOS    arm64  → release/cli/bili_lottery-cli-macos-arm64
 *   - Linux    x64    → release/cli/bili_lottery-cli-linux-x64
 *   - Linux    arm64  → release/cli/bili_lottery-cli-linux-arm64
 *
 * Cross-compilation limitations:
 *   pkg cannot cross-compile *from* Windows to macOS-arm64
 *   (and similar edge cases). This script skips unsupported targets
 *   with a warning instead of aborting. Use CI (GitHub Actions) for
 *   full three-platform builds — each OS runner builds its own targets.
 *
 * Prerequisite: dist/cli/main.cjs must already exist (run bundle:cli first).
 * Usage:       node scripts/release-cli.mjs           (all targets)
 *              node scripts/release-cli.mjs --current  (current OS only)
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import process from 'node:process';

if (!existsSync('dist/cli/main.cjs')) {
    console.error('✖ dist/cli/main.cjs not found. Run "pnpm bundle:cli" first.');
    process.exit(1);
}

mkdirSync('release/cli', { recursive: true });

/** @type {{ target: string; output: string; os: string }[]} */
const ALL_BUILDS = [
    { target: 'node20-win-x64', output: 'release/cli/bili_lottery-cli-win-x64.exe', os: 'win32' },
    { target: 'node20-macos-x64', output: 'release/cli/bili_lottery-cli-macos-x64', os: 'darwin' },
    { target: 'node20-macos-arm64', output: 'release/cli/bili_lottery-cli-macos-arm64', os: 'darwin' },
    { target: 'node20-linux-x64', output: 'release/cli/bili_lottery-cli-linux-x64', os: 'linux' },
    { target: 'node20-linux-arm64', output: 'release/cli/bili_lottery-cli-linux-arm64', os: 'linux' },
];

const currentOnly = process.argv.includes('--current');
const builds = currentOnly
    ? ALL_BUILDS.filter(b => b.os === process.platform)
    : ALL_BUILDS;

let succeeded = 0;
let skipped = 0;

for (const { target, output } of builds) {
    console.log(`\n⏳ Building ${target} → ${output}`);
    try {
        execFileSync(
            process.execPath,
            [
                './node_modules/@yao-pkg/pkg/lib-es5/bin.js',
                'dist/cli/main.cjs',
                '-t', target,
                '-o', output,
            ],
            { stdio: 'inherit' },
        );
        console.log(`✔ ${output}`);
        succeeded++;
    } catch {
        console.warn(`⚠ Skipped ${target} (cross-compilation not supported on this host)`);
        skipped++;
    }
}

console.log(`\n✔ CLI release done  —  ${succeeded} built, ${skipped} skipped`);
if (succeeded === 0) {
    process.exit(1);
}
