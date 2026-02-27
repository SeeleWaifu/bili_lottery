/**
 * Pure candidate filtering logic — **no** Node.js-specific dependencies.
 * Safe to import from both the main process and the Vite-bundled renderer.
 *
 * Shuffle / draw logic (which depends on `node:crypto`) stays in `lottery.ts`.
 */

import type { Candidate, FilterFlags, FilterSplitResult, LotteryRelation } from './types.js';

// Re-export domain types for convenience.
export type { Candidate, FilterFlags, FilterSplitResult, LotteryRelation };

// ── candidate filter ────────────────────────────────────────────────

/**
 * Split `candidates` into `matched` / `unmatched` according to `flags`.
 *
 * - `likedBySelf` / `likedByUp` are *required-if-set* filters:
 *   when the flag is `true`, only candidates with the corresponding
 *   boolean set to `true` pass; when the flag is `false`, all pass.
 */
export function filterCandidates(candidates: Candidate[], flags: FilterFlags): FilterSplitResult {
    const matched: Candidate[] = [];
    const unmatched: Candidate[] = [];

    for (const candidate of candidates) {
        const isMatch =
            (flags.relations.includes(candidate.relation) || flags.relations.length === 0) &&
            (!flags.likedByUp || candidate.likedByUp) &&
            (!flags.likedBySelf || candidate.likedBySelf);

        if (isMatch) {
            matched.push(candidate);
        } else {
            unmatched.push(candidate);
        }
    }

    return { matched, unmatched };
}
