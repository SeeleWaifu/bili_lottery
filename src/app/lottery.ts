import { randomInt } from 'node:crypto';

import type { Candidate, FilterFlags, FilterSplitResult, LotteryRelation } from './types.js';

// Re-export filter logic and domain types so existing imports keep working.
export { filterCandidates, relationMatches } from './filter.js';
export type { Candidate, FilterFlags, FilterSplitResult, LotteryRelation };

// ── shuffle (Fisher-Yates, cryptographic RNG) ───────────────────────

export function shuffleCandidates<T>(input: T[]): T[] {
    const result = [...input];
    if (result.length <= 1) {
        return result;
    }

    const rounds = Math.max(3, Math.ceil(Math.log2(result.length)) + 2);
    for (let round = 0; round < rounds; round++) {
        for (let i = result.length - 1; i > 0; i--) {
            const j = randomInt(0, i + 1);
            [result[i], result[j]] = [result[j], result[i]];
        }
    }

    return result;
}
