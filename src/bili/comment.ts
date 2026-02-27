import { err, ok, Result } from 'neverthrow';
import { z } from 'zod';

import { type CookieJarGot } from './login.js';
import { type WbiSignGot } from './wbi_sign.js';
import { apiHeaders } from './headers.js';

const ReplySchema = z.object({
    rpid: z.number(),
    oid: z.number(),
    type: z.number(),
    ctime: z.number(),
    action: z.number(), // 0: normal, 1: liked, 2: disliked
    member: z.object({
        mid: z.string(),
        uname: z.string(),
        avatar: z.string(),
        level_info: z.object({
            current_level: z.number(),
        }),
    }),
    content: z.object({
        message: z.string(),
    }),
    up_action: z.object({
        like: z.boolean(),
        reply: z.boolean(),
    }),
});

const CursorSchema = z.object({
    is_begin: z.boolean(),
    is_end: z.boolean(),
    pagination_reply: z.object({
        next_offset: z.string().optional(),
    }),
    mode: z.number(),
    all_count: z.number(),
});

const CommentListResponseSchema = z.object({
    code: z.number(),
    message: z.string(),
    data: z
        .object({
            cursor: CursorSchema,
            replies: z.array(ReplySchema),
        })
        .optional(),
});

export type Reply = z.infer<typeof ReplySchema>;

class Comment {
    #client: CookieJarGot & WbiSignGot;
    #oid: string;
    #type: string;
    #mode: string; // 0 3：only hot, 1：hot + time, 2：only time
    constructor(client: CookieJarGot & WbiSignGot, oid: string, type: string, mode: string = '2') {
        this.#client = client;
        this.#oid = oid;
        this.#type = type;
        this.#mode = mode;
    }

    [Symbol.asyncIterator]() {
        let offset: string = '';
        let isEnd = false;
        return {
            next: async (): Promise<IteratorResult<Result<Reply[], Error>>> => {
                if (isEnd) {
                    return { value: ok([]), done: true };
                }

                const params = {
                    oid: this.#oid,
                    type: this.#type,
                    mode: this.#mode,
                    pagination_str: JSON.stringify({ offset: offset }),
                    plat: '1',
                    seek_rpid: '',
                    web_location: '1315875',
                };

                const response = await this.#client
                    .get('https://api.bilibili.com/x/v2/reply/wbi/main', {
                        searchParams: params,
                        headers: apiHeaders({
                            acceptLanguage: 'en-GB,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
                        }),
                    })
                    .json();

                const parsed = CommentListResponseSchema.parse(response);
                if (parsed.code !== 0 || !parsed.data) {
                    return {
                        value: err(new Error(`Failed to fetch comments: ${parsed.message}`)),
                        done: false,
                    };
                }

                const { cursor, replies } = parsed.data;
                offset = cursor.pagination_reply.next_offset || '';
                isEnd = cursor.is_end;
                return {
                    value: ok(replies),
                    done: false,
                };
            },
        };
    }
}

export function requestAllComments(
    client: CookieJarGot & WbiSignGot,
    oid: string,
    type: string,
    mode: string = '2',
) {
    return new Comment(client, oid, type, mode);
}
