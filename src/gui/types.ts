import { type Result } from 'neverthrow';
import type { Candidate, FilterFlags, FilterSplitResult, LotteryRelation } from '../app/types.js';
import { QrCodeStatus } from '../shared/types.js';
import type { QrCodeInfo } from '../shared/types.js';
import { filterCandidates } from '../app/filter.js';

// Re-export domain types so renderer imports from '../types' keep working.
export type { Candidate, FilterFlags, FilterSplitResult, LotteryRelation };
export { QrCodeStatus, filterCandidates };
export type { QrCodeInfo };

export type LoginStatus = {
    isLogin: boolean;
    user?: {
        uid: number | string;
        name: string;
        avatar: string;
    };
};

export const NativeApiKeys = [
    'getConfigPath',
    'pickConfigPath',
    'updateConfig',
    'openLoginWindow',
    'startQrLogin',
    'pollQrLoginStatus',
    'logout',
    'loadCandidates',
    'enrichRelation',
    'draw',
    'openExternal',
] as const;

export type DrawParams = {
    candidates: Candidate[];
    winnerCount: number;
};

export type DrawResult = {
    winners: Candidate[];
};

export type NativeApi = {
    getConfigPath: () => Promise<Result<string, Error>>;
    pickConfigPath: () => Promise<Result<string | undefined, Error>>;
    updateConfig: (configPath: string) => Promise<Result<string, Error>>;
    openLoginWindow: () => Promise<Result<void, Error>>;
    startQrLogin: () => Promise<Result<QrCodeInfo, Error>>;
    pollQrLoginStatus: (qrCodeKey: string) => Promise<Result<number, Error>>;
    logout: () => Promise<Result<void, Error>>;
    loadCandidates: (
        oid: string,
        type: string,
        mode?: string,
    ) => Promise<Result<Candidate[], Error>>;
    enrichRelation: (uid: string) => Promise<Result<LotteryRelation, Error>>;
    draw: (params: DrawParams) => Promise<Result<DrawResult, Error>>;
    openExternal: (url: string) => Promise<Result<void, Error>>;
};

export type NativeApiContract = {
    [key: string]: (...args: any[]) => Promise<Result<any, Error>>;
};

const _apiTypeCheck: NativeApiContract = {} as unknown as NativeApi;

const _typeCheck: Record<(typeof NativeApiKeys)[number], any> = {} as NativeApi;
const _typeCheck2: NativeApi = {} as Record<(typeof NativeApiKeys)[number], any>;

export type NativeEventSender = {
    onLogin: (result: LoginStatus) => void;
};

export type NativeEvent = {
    [key in keyof NativeEventSender]: (
        callback: (...args: Parameters<NativeEventSender[key]>) => void,
    ) => void;
};
