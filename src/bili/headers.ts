/**
 * Shared HTTP headers for Bilibili API requests.
 * Eliminates 6+ duplicate header blocks across bili/*.ts modules.
 */

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

const SEC_CH_UA = '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"';

/** Common headers shared across all Bilibili requests. */
const BASE_HEADERS = {
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'sec-ch-ua': SEC_CH_UA,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'user-agent': USER_AGENT,
} as const;

/**
 * Headers for JSON API requests (CORS, same-site).
 *
 * @param options.origin - Override the default `https://www.bilibili.com` origin
 * @param options.referer - Optional `Referer` header
 * @param options.acceptLanguage - Override accept-language (default `en-GB,en;q=0.9`)
 */
export function apiHeaders(options?: {
    origin?: string;
    referer?: string;
    acceptLanguage?: string;
}): Record<string, string> {
    return {
        ...BASE_HEADERS,
        'accept': '*/*',
        'accept-language': options?.acceptLanguage ?? 'en-GB,en;q=0.9',
        'origin': options?.origin ?? 'https://www.bilibili.com',
        'priority': 'u=1, i',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        ...(options?.referer ? { referer: options.referer } : {}),
    };
}

/** Headers for HTML document navigation requests. */
export function documentHeaders(): Record<string, string> {
    return {
        ...BASE_HEADERS,
        'accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-GB,en;q=0.9',
        'priority': 'u=0, i',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
    };
}
