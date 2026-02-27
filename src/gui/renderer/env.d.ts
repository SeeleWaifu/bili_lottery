/// <reference types="vite/client" />
import type { NativeApi, NativeEvent } from '../types';
import { type Result } from 'neverthrow';
declare global {
    interface Window {
        rawApi: NativeApi;
        api: NativeApi;
        nativeEvent: NativeEvent;
    }
}

export {};
