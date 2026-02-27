import { contextBridge, ipcRenderer } from 'electron';

import { type NativeApi, NativeApiKeys, type NativeEvent } from '../types.js';

(() => {
    try {
        contextBridge.exposeInMainWorld(
            'rawApi',
            Object.fromEntries(
                NativeApiKeys.map(key => {
                    const methodKey = key as keyof NativeApi;
                    return [
                        methodKey,
                        (...args: Parameters<NativeApi[typeof methodKey]>) => {
                            return ipcRenderer.invoke(methodKey, ...args);
                        },
                    ];
                }),
            ),
        );

        const nativeEvent: NativeEvent = {
            onLogin: callback => {
                ipcRenderer.on('onLogin', (_event, result) => {
                    callback(result);
                });
            },
        };
        contextBridge.exposeInMainWorld('nativeEvent', nativeEvent);
    } catch (error) {
        console.error('Failed to expose API in preload script:', error);
    }
})();
