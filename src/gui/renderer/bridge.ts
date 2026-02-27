import { Err, Ok } from 'neverthrow';

import type { LoginStatus, NativeApi, NativeApiContract } from '../types';
import { Result, type Result as ResultType } from 'neverthrow';
import { useToast } from './composables/useToast';
import './env.d.ts';

(() => {
    const toast = useToast();
    function recoverResult(result: any): Result<any, Error> {
        if (result && typeof result === 'object' && 'error' in result) {
            return new Err(result.error as Error);
        }
        if (result && typeof result === 'object' && 'value' in result) {
            return new Ok(result.value);
        }
        return new Ok(result);
    }

    if (!window.rawApi) {
        toast.error('window.rawApi is undefined. preload may not be loaded.');
        return;
    }

    window.api = new Proxy(
        {},
        {
            get(_, prop) {
                return async (...args: any[]) => {
                    try {
                        const api = window.rawApi as NativeApiContract;
                        const key = prop as keyof NativeApi;
                        const result = await api[key](...args);
                        return recoverResult(result);
                    } catch (error) {
                        console.error(`Error calling API method ${String(prop)}:`, error);
                        return new Err(error instanceof Error ? error : new Error(String(error)));
                    }
                };
            },
        },
    ) as NativeApi;

    if (!window.nativeEvent) {
        toast.error('window.nativeEvent is undefined. preload may not be loaded.');
        return;
    }
})();
