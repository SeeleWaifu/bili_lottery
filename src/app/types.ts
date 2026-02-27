/**
 * Unified domain types shared across CLI and GUI.
 * This is the Single Source of Truth for candidate / relation / filter models.
 */

/** String-literal union for user–UP relationship. */
export type LotteryRelation = 'none' | 'fan' | 'follow' | 'mutual';

/** A deduplicated candidate user built from comment data + relation query. */
export type Candidate = {
    uid: string;
    uname: string;
    avatar: string;
    relation: LotteryRelation;
    likedBySelf: boolean;
    likedByUp: boolean;
};

/** Multi-relation OR filter flags used by both CLI and GUI. */
export type FilterFlags = {
    /**
     * Which relations to keep.
     * - Empty array → do not filter by relation (pass all).
     * - Non-empty → keep candidates whose relation matches ANY entry (OR semantics).
     *
     * When the array contains 'fan', candidates with 'mutual' also match
     * (mutual implies fan). Same for 'follow'.
     */
    relations: LotteryRelation[];
    likedBySelf: boolean;
    likedByUp: boolean;
};

export type FilterSplitResult = {
    matched: Candidate[];
    unmatched: Candidate[];
};
