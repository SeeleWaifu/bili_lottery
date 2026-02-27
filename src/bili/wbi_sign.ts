import { z } from 'zod';
import { createHash } from 'node:crypto';
import { type Got } from 'got';

import { requestNav } from './login.js';

export type WbiConfig = {
    img_key: string;
    sub_key: string;
};

export type WbiSignResult = {
    w_rid: string;
    wts: string;
};

function getPictureHashKey(str: string): string {
    const indexTable = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19,
        29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
        22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
    ];

    return indexTable
        .map(index => str.charAt(index))
        .join('')
        .slice(0, 32);
}

function getKeyFromURL(url: string): string {
    return url.substring(url.lastIndexOf('/') + 1, url.length).split('.')[0];
}

function formatImgByLocalParams(params: URLSearchParams, wbiConfig: WbiConfig): WbiSignResult {
    const hashKey = getPictureHashKey(wbiConfig.img_key + wbiConfig.sub_key);
    const wts = Math.round(Date.now() / 1e3);
    // const wts = "1771836676";

    const sortedEntries = Object.entries(
        Object.assign({}, Object.fromEntries(params.entries()), {
            wts: wts,
        }),
    )
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => {
            if (
                (value && typeof value == 'string' && (value = value.replace(/[!'()*]/g, '')),
                value != null)
            ) {
                return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            }
        })
        .join('&');
    return {
        w_rid: createHash('md5')
            .update(sortedEntries + hashKey)
            .digest('hex'),
        wts: wts.toString(),
    };
}

export async function requestWbiConfig(client: Got): Promise<WbiConfig> {
    const navResult = await requestNav(client);
    return {
        img_key: getKeyFromURL(navResult.data.wbi_img.img_url),
        sub_key: getKeyFromURL(navResult.data.wbi_img.sub_url),
    };
}

export async function wbiSignWithRequest(
    params: URLSearchParams,
    client: Got,
): Promise<WbiSignResult> {
    return wbiSign(params, await requestWbiConfig(client));
}

export function wbiSign(params: URLSearchParams, wbiConfig: WbiConfig): WbiSignResult {
    return formatImgByLocalParams(params, wbiConfig);
}

declare const wbiSignBrand: unique symbol;
export interface WbiSignGotBound {
    getWbiConfig(): WbiConfig;
}

export type WbiSignGot = Got & WbiSignGotBound & { readonly [wbiSignBrand]: true };

export async function createWbiSignGot<T extends Got>(client: T): Promise<WbiSignGot & T> {
    const wbiConfig = await requestWbiConfig(client);

    const gotWithWbiSign = client.extend({
        hooks: {
            beforeRequest: [
                options => {
                    if (options.searchParams && options.searchParams instanceof URLSearchParams) {
                        const wbiSignResult = wbiSign(options.searchParams, wbiConfig);
                        for (const [key, value] of Object.entries(wbiSignResult)) {
                            options.searchParams.set(key, value);
                        }
                    } else {
                        throw new Error(
                            'Expected searchParams to be an instance of URLSearchParams',
                        );
                    }
                },
            ],
        },
    }) as WbiSignGot & T;

    Object.defineProperties(gotWithWbiSign, {
        getWbiConfig: {
            value: () => wbiConfig,
        },
    });

    return gotWithWbiSign;
}
