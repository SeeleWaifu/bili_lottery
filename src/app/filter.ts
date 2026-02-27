/**
 * Pure candidate filtering logic — **no** Node.js-specific dependencies.
 * Safe to import from both the main process and the Vite-bundled renderer.
 *
 * Shuffle / draw logic (which depends on `node:crypto`) stays in `lottery.ts`.
 */

import type { Candidate, FilterFlags, FilterSplitResult, LotteryRelation } from './types.js';

// Re-export domain types for convenience.
export type { Candidate, FilterFlags, FilterSplitResult, LotteryRelation };

// ── relation matching (OR semantics) ────────────────────────────────

/**
 * Check whether a single candidate's relation satisfies the filter.
 *
 * Semantic rules:
 * - `relations` is empty → pass (no relation constraint).
 * - 'fan'    matches 'fan' **and** 'mutual' (mutual implies fan).
 * - 'follow' matches 'follow' **and** 'mutual' (mutual implies follow).
 * - 'mutual' matches only 'mutual'.
 * - 'none'   matches only 'none'.
 */
export function relationMatches(
    userRelation: LotteryRelation,
    relations: LotteryRelation[],
): boolean {
    if (relations.length === 0) return true;

    const expandedFlags: Record<LotteryRelation, boolean> = {
        none: userRelation === 'none',
        fan: userRelation === 'fan' || userRelation === 'mutual',
        follow: userRelation === 'follow' || userRelation === 'mutual',
        mutual: userRelation === 'mutual',
    };

    return relations.some(r => expandedFlags[r]);
}

// ── candidate filter ────────────────────────────────────────────────

/**
 * Split `candidates` into `matched` / `unmatched` according to `flags`.
 *
 * - Relations use **OR** semantics (see {@link relationMatches}).
 * - `likedBySelf` / `likedByUp` are *required-if-set* filters:
 *   when the flag is `true`, only candidates with the corresponding
 *   boolean set to `true` pass; when the flag is `false`, all pass.
 */
export function filterCandidates(candidates: Candidate[], flags: FilterFlags): FilterSplitResult {
    const matched: Candidate[] = [];
    const unmatched: Candidate[] = [];

    for (const candidate of candidates) {
        const isMatch =
            relationMatches(candidate.relation, flags.relations) &&
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
