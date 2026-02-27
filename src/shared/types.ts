/**
 * Cross-environment types and constants shared between main process and renderer.
 * This module has **no** Node.js dependencies, so Vite can bundle it for the browser.
 *
 * - Domain model types are in `src/app/types.ts`.
 * - This file holds IPC-level constants that both sides need at runtime.
 */

/** QR code login status codes from the Bilibili passport API. */
export enum QrCodeStatus {
    success = 0,
    expired = 86038,
    scanned = 86090,
    waiting = 86101,
}

/** QR code URL + key returned by the generate endpoint. */
export type QrCodeInfo = {
    url: string;
    qrCodeKey: string;
};
