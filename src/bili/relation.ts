import z from 'zod';
import { CookieJarGot } from './login.js';
import { WbiSignGot } from './wbi_sign.js';
import { ok, err, Result } from 'neverthrow';
import { toError } from '../shared/error.js';
import { apiHeaders } from './headers.js';

const RelationSchema = z.object({
    mid: z.number(),
    attribute: z.number(),
    mtime: z.number(),
    tag: z.array(z.number()).nullable(),
    special: z.number(),
});

const RelationResponseSchema = z.object({
    code: z.number(),
    message: z.string(),
    data: z
        .object({
            relation: RelationSchema,
            be_relation: RelationSchema,
        })
        .optional(),
});

/**
 * @field mid - user ID of the other user
 * @field attribute - 0: no relation, 2: following, 6: friend, 12: blacklisted
 * @field mtime - timestamp of the following action, 0 if no relation
 * @field tag - user-defined tag for the relation, null if not set
 * @field special - whether the relation is special, 0: no, 1: special
 */
export type Relationship = z.infer<typeof RelationSchema>;

/**
 * @field relation - the relation from the perspective of the logged-in user
 * @field be_relation - the relation from the perspective of the other user
 */
export type UserRelationship = {
    relation: Relationship;
    be_relation: Relationship;
};

export async function requestRelations(
    client: WbiSignGot & CookieJarGot,
    mid: string,
): Promise<Result<UserRelationship, Error>> {
    const response = await client
        .get('https://api.bilibili.com/x/space/wbi/acc/relation', {
            searchParams: {
                mid: mid,
                web_location: '333.1387',
            },
            headers: apiHeaders({
                origin: 'https://space.bilibili.com',
                referer: `https://space.bilibili.com/${mid}/dynamic`,
                acceptLanguage: 'en-GB,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
            }),
        })
        .json();

    try {
        const parsed = RelationResponseSchema.parse(response);

        if (parsed.code !== 0 || !parsed.data) {
            return err(new Error(`Failed to get relation data: ${parsed.message}`));
        }
        return ok(parsed.data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return err(
                new Error(
                    `Failed to parse relation response: ${error.message}\n Response: ${JSON.stringify(response)}`,
                ),
            );
        } else {
            return err(toError(error));
        }
    }
}
