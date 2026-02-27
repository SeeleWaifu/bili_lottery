import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import * as astring from 'astring';
import * as cheerio from 'cheerio';
import { err, ok, Result } from 'neverthrow';
import { z } from 'zod';

import { type CookieJarGot } from './login.js';
import { documentHeaders } from './headers.js';

const InitialStateBasicSchema = z.object({
    comment_id_str: z.string(),
    comment_type: z.number(),
    title: z.string(),
    uid: z.number(),
});
const InitialStateSchema = z.object({
    detail: z.object({
        basic: InitialStateBasicSchema,
        id_str: z.string(),
    }),
});
export type InitialState = z.infer<typeof InitialStateSchema>;
export type InitialStateBasic = z.infer<typeof InitialStateBasicSchema>;

export function extractInitialState(html: string): Result<InitialState, Error> {
    const $ = cheerio.load(html);

    let result: Result<InitialState, Error> = err(new Error('Failed to extract __INITIAL_STATE__'));

    $('script').each((_, el) => {
        const code = $(el).html();
        if (!code || !code.includes('__INITIAL_STATE__')) return true;

        const ast = parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'script',
        });

        walk.simple(ast, {
            AssignmentExpression(node) {
                // window.__INITIAL_STATE__ = {...}
                if (
                    node.left.type === 'MemberExpression' &&
                    !node.left.computed &&
                    node.left.object.type === 'Identifier' &&
                    node.left.object.name === 'window' &&
                    node.left.property.type === 'Identifier' &&
                    node.left.property.name === '__INITIAL_STATE__' &&
                    node.right.type === 'ObjectExpression'
                ) {
                    result = ok(
                        InitialStateSchema.parse(eval(`(${astring.generate(node.right)})`)),
                    );
                }
            },
        });

        return false;
    });

    return result;
}

export function extractInitialStateBasic(html: string): Result<InitialStateBasic, Error> {
    const initialStateResult = extractInitialState(html);
    if (initialStateResult.isErr()) {
        return err(initialStateResult.error);
    }
    return ok(initialStateResult.value.detail.basic);
}

export async function requestInitialStateBasic(
    client: CookieJarGot,
    url: string,
): Promise<Result<InitialStateBasic, Error>> {
    const response = await client.get(url, {
        headers: documentHeaders(),
    });

    return extractInitialStateBasic(response.body);
}
