/**
 * Shared candidate-loading pipeline: comments → deduplicated candidates → relation enrichment.
 * Used by both CLI and GUI to guarantee identical mapping semantics.
 */

import { err, ok, type Result } from 'neverthrow';

import { requestAllComments } from '../bili/comment.js';
import type { CookieJarGot } from '../bili/login.js';
import { requestRelations, type UserRelationship } from '../bili/relation.js';
import type { WbiSignGot } from '../bili/wbi_sign.js';
import type { Candidate, LotteryRelation } from './types.js';

// ── relation attribute → domain relation ────────────────────────────

/**
 * Map the raw Bilibili `UserRelationship` (attribute numbers) to a
 * domain-level `LotteryRelation` string:
 *
 * | attribute | meaning      |
 * |-----------|-------------|
 * | 6         | mutual      |
 * | 2 (relation)  | follow |
 * | 2 (be_relation) | fan   |
 * | other     | none        |
 */
export function mapRelation(rel: UserRelationship): LotteryRelation {
    if (rel.relation.attribute === 6) return 'mutual';
    if (rel.relation.attribute === 2) return 'follow';
    if (rel.be_relation.attribute === 2) return 'fan';
    return 'none';
}

// ── comments → deduplicated candidates ──────────────────────────────

/**
 * Fetch all comments for the given `oid/type/mode`, deduplicate by uid,
 * and merge per-user flags across multiple comments.
 *
 * Field mapping (from `Reply`):
 * - `action === 1`  → the logged-in user liked this comment (`likedBySelf`)
 * - `up_action.like` → the UP liked this comment (`likedByUp`)
 */
export async function fetchCandidates(
    client: WbiSignGot & CookieJarGot,
    oid: string,
    type: string,
    mode: string = '2',
): Promise<Result<Candidate[], Error>> {
    const users = new Map<string, Candidate>();

    for await (const commentsResult of requestAllComments(client, oid, type, mode)) {
        if (commentsResult.isErr()) {
            return err(commentsResult.error);
        }

        for (const comment of commentsResult.value) {
            const uid = comment.member.mid;
            const current = users.get(uid);

            const next: Candidate = {
                uid,
                uname: comment.member.uname,
                avatar: comment.member.avatar,
                relation: current?.relation ?? 'none',
                likedBySelf: (current?.likedBySelf ?? false) || comment.action === 1,
                likedByUp: (current?.likedByUp ?? false) || comment.up_action.like,
            };
            users.set(uid, next);
        }
    }

    return ok(Array.from(users.values()));
}

// ── enrich candidates with relation data ────────────────────────────

/**
 * For every candidate, query the relation API and map the result with
 * {@link mapRelation}. On per-user failure the candidate keeps its
 * existing `relation` value (graceful degradation).
 */
export async function enrichRelations(
    client: WbiSignGot & CookieJarGot,
    candidates: Candidate[],
): Promise<Candidate[]> {
    return Promise.all(
        candidates.map(async candidate => {
            const result = await requestRelations(client, candidate.uid);
            if (result.isErr()) return candidate;
            return { ...candidate, relation: mapRelation(result.value) };
        }),
    );
}

// ── all-in-one convenience ──────────────────────────────────────────

/**
 * Fetch candidates **and** enrich every user's relation in one call.
 */
export async function loadCandidatesWithRelations(
    client: WbiSignGot & CookieJarGot,
    oid: string,
    type: string,
    mode: string = '2',
): Promise<Result<Candidate[], Error>> {
    const fetchResult = await fetchCandidates(client, oid, type, mode);
    if (fetchResult.isErr()) return fetchResult;
    return ok(await enrichRelations(client, fetchResult.value));
}
