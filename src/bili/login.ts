import { got, Got } from 'got';
import { CookieJar } from 'tough-cookie';
import { z } from 'zod';
import { err, ok, Result } from 'neverthrow';

import { apiHeaders, documentHeaders } from './headers.js';
import { QrCodeStatus, type QrCodeInfo } from '../shared/types.js';

// Re-export so existing `import { QrCodeStatus, QrCodeInfo } from './login.js'` keeps working.
export { QrCodeStatus, type QrCodeInfo };
declare const cookieJarGotBrand: unique symbol;

export interface CookieJarBound {
    getCookieJar(): CookieJar;
}

export type CookieJarGot = Got &
    CookieJarBound & {
        readonly [cookieJarGotBrand]: true;
    };

async function visitBili<T extends Got>(client: T): Promise<T> {
    await client.get('https://www.bilibili.com/', {
        headers: documentHeaders(),
    });
    return client;
}

export async function createCookieJarGot<T extends Got>(
    cookieJar: CookieJar,
    client: T = got as unknown as T,
): Promise<CookieJarGot & T> {
    const gotWithCookieJar = client.extend({ cookieJar }) as CookieJarGot & T;

    Object.defineProperties(gotWithCookieJar, {
        getCookieJar: {
            value: () => cookieJar,
            enumerable: false,
            configurable: false,
            writable: false,
        },
    });
    return await visitBili(gotWithCookieJar);
}

const QRCodeResponseSchema = z.object({
    code: z.number(),
    message: z.string(),
    data: z.object({
        url: z.string(),
        qrcode_key: z.string(),
    }),
});

export async function requestQrCodeInfo(client: Got): Promise<Result<QrCodeInfo, Error>> {
    const response = await client
        .get('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
            headers: apiHeaders(),
        })
        .json();
    try {
        const parsed = QRCodeResponseSchema.parse(response);

        if (parsed.code !== 0) {
            return err(new Error(`Failed to request QR code: ${parsed.message}`));
        }

        return ok({
            url: parsed.data.url,
            qrCodeKey: parsed.data.qrcode_key,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return err(
                new Error(
                    `Failed to parse QR code response: ${error.message}\nResponse: ${JSON.stringify(response)}`,
                ),
            );
        } else {
            return err(new Error(`Unknown error: ${String(error)}`));
        }
    }
}

// QrCodeStatus is imported from shared/types.ts and re-exported above.

const QrCodeStatusResponseSchema = z.object({
    code: z.number(),
    message: z.string(),
    data: z.object({
        code: z.number(),
        url: z.string(),
    }),
});

export async function checkQrCodeStatus(
    client: Got,
    qrCodeKey: string,
): Promise<Result<QrCodeStatus, Error>> {
    const response = await client
        .get('https://passport.bilibili.com/x/passport-login/web/qrcode/poll', {
            searchParams: {
                qrcode_key: qrCodeKey,
            },
            headers: apiHeaders(),
        })
        .json();
    try {
        const parsed = QrCodeStatusResponseSchema.parse(response);

        if (Object.values(QrCodeStatus).includes(parsed.data.code)) {
            return ok(parsed.data.code as QrCodeStatus);
        } else {
            return err(
                new Error(
                    `Unknown QR code status: ${parsed.data.code}, message: ${parsed.message}`,
                ),
            );
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return err(
                new Error(
                    `Failed to parse QR code status response: ${error.message}\nResponse: ${JSON.stringify(response)}`,
                ),
            );
        } else {
            return err(new Error(`Unknown error: ${String(error)}`));
        }
    }
}

const NavSchema = z.object({
    isLogin: z.boolean(),
    face: z.string().optional(),
    level_info: z
        .object({
            current_level: z.number(),
        })
        .optional(),
    mid: z.number().optional(),
    uname: z.string().optional(),
    wbi_img: z.object({
        img_url: z.string(),
        sub_url: z.string(),
    }),
});

const NavResponseSchema = z.object({
    code: z.number(),
    message: z.string(),
    data: NavSchema,
});

/**
 * @field isLogin - Whether the user is logged in
 * @field face - User avatar URL (only available when logged in)
 * @field level_info.current_level - User level (only available when logged in)
 * @field mid - User ID (only available when logged in)
 * @field uname - Username (only available when logged in)
 * @field wbi_img - WBI image URLs (only available when logged in)
 * @field wbi_img.img_url - WBI image URL for generating WBI parameters
 * @field wbi_img.sub_url - Sub URL to be appended to API endpoints when using WBI parameters
 */
export type Nav = z.infer<typeof NavSchema>;

/**
 * @field code - Response code, 0 indicates success
 * @field message - Response message
 * @field data - Response data containing user and WBI information
 */
export type NavResponse = z.infer<typeof NavResponseSchema>;

export async function requestNav(client: Got): Promise<NavResponse> {
    const response = await client
        .get('https://api.bilibili.com/x/web-interface/nav', {
            headers: apiHeaders({ referer: 'https://www.bilibili.com' }),
        })
        .json();
    try {
        return NavResponseSchema.parse(response);
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(
                `Failed to parse nav response: ${error.message}\nResponse: ${JSON.stringify(response)}`,
            );
        } else {
            throw new Error(`Unknown error: ${String(error)}`);
        }
    }
}
