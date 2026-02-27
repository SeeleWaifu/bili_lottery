import { app, BrowserWindow, dialog, ipcMain, OpenDialogOptions, shell } from 'electron';
import { BaseWindowConstructorOptions, WebPreferences } from 'electron/utility';
import { err, ok, type Result } from 'neverthrow';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CookieJar } from 'tough-cookie';

import { toError } from '../../error.js';
import type {
    DrawParams,
    DrawResult,
    LoginStatus,
    NativeApi,
    NativeEventSender,
} from '../types.js';
import type { Candidate, LotteryRelation } from '../../app/types.js';
import { NativeApiKeys } from '../types.js';
import { AppConfig, ConfigStore } from '../../app/config_store.js';
import { fetchCandidates, mapRelation } from '../../app/candidate_loader.js';
import { requestRelations } from '../../bili/relation.js';
import { shuffleCandidates } from '../../app/lottery.js';
import { createWbiSignGot, type WbiSignGot } from '../../bili/wbi_sign.js';
import {
    checkQrCodeStatus,
    createCookieJarGot,
    type CookieJarGot,
    QrCodeStatus,
    requestNav,
    requestQrCodeInfo,
} from '../../bili/login.js';

function LOGINFO(message: string, ...args: any[]): void {
    console.log(`[INFO] ${message}`, ...args);
}

function LOGERROR(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type WindowName = 'index' | 'login';

class WindowsManager {
    windowsMap: Map<WindowName, BrowserWindow> = new Map();

    get(name: WindowName): BrowserWindow | undefined {
        return this.windowsMap.get(name);
    }

    set(name: WindowName, window: BrowserWindow): WindowsManager {
        this.windowsMap.set(name, window);
        return this;
    }

    delete(name: WindowName): boolean {
        return this.windowsMap.delete(name);
    }

    create(
        name: WindowName,
        html: string,
        options: {
            base: Partial<BaseWindowConstructorOptions>;
            webPreferences?: WebPreferences;
            paintWhenInitiallyHidden?: boolean;
        },
    ): BrowserWindow {
        const win = new BrowserWindow({
            ...options.base,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
                ...options.webPreferences,
            },
            paintWhenInitiallyHidden: options.paintWhenInitiallyHidden,
        });

        win.loadFile(html).catch((error: unknown) => {
            LOGERROR(`window load failed: ${name}`, error);
        });

        this.set(name, win);
        win.on('closed', () => {
            this.delete(name);
        });

        return win;
    }

    createMainWindow(): BrowserWindow {
        return this.create('index', path.join(__dirname, '../renderer/index.html'), {
            base: {
                width: 1280,
                height: 840,
            },
            webPreferences: {
                preload: path.join(__dirname, '../preload/index.js'),
            },
        });
    }

    createLoginWindow(): BrowserWindow {
        return this.create('login', path.join(__dirname, '../renderer/login.html'), {
            base: {
                width: 900,
                height: 520,
            },
            webPreferences: {
                preload: path.join(__dirname, '../preload/index.js'),
            },
        });
    }
}

class Session {
    // ── Fields ──────────────────────────────────────────────────────────
    windowsManager: WindowsManager;
    cookieJar: CookieJar;
    configStore: ConfigStore;

    private _clientCache: Promise<CookieJarGot> | null = null;
    private _wbiClientCache: Promise<WbiSignGot & CookieJarGot> | null = null;

    // ── Constructor & Lifecycle ─────────────────────────────────────────
    constructor(filePath: string = 'config.json') {
        this.windowsManager = new WindowsManager();
        this.cookieJar = new CookieJar();
        this.configStore = new ConfigStore(filePath);

        app.whenReady().then(() => {
            this.registerIpcHandlers();

            const indexWindow = this.windowsManager.createMainWindow();
            indexWindow.webContents.once('did-finish-load', async () => {
                this.loadConfig().then(async () => {
                    this.createEventSender(indexWindow).onLogin(await this.checkLogin());
                });
            });
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });
    }

    private registerIpcHandlers(): void {
        NativeApiKeys.forEach(key => {
            const methodKey = key as keyof NativeApi;
            ipcMain.handle(methodKey, async (event, ...args) => {
                try {
                    LOGINFO(`[IPC Call] ${methodKey}`, args);
                    return (this[methodKey] as Function)(...args, event);
                } catch (error) {
                    LOGERROR(`[IPC Call] ${methodKey}`, error);
                    return err(toError(error));
                }
            });
        });
    }

    // ── Client Management (cached) ─────────────────────────────────────

    /**
     * Invalidate both client and wbiClient caches.
     * Must be called whenever `this.cookieJar` is replaced (e.g. loadConfig).
     */
    private invalidateClients(): void {
        this._clientCache = null;
        this._wbiClientCache = null;
        LOGINFO('Client caches invalidated (cookieJar replaced)');
    }

    /**
     * Invalidate only the wbiClient cache.
     * Must be called when the account changes but the cookieJar instance stays
     * the same (e.g. QR login success — cookies mutated in-place).
     */
    private invalidateWbiClient(): void {
        this._wbiClientCache = null;
        LOGINFO('WbiClient cache invalidated (account changed)');
    }

    /**
     * Return a cached CookieJarGot, creating it on first call or after
     * invalidation. Safe to cache because the Got instance is bound to
     * `this.cookieJar` by reference — cookie mutations are reflected
     * automatically.
     */
    async client() {
        if (!this._clientCache) {
            this._clientCache = createCookieJarGot(this.cookieJar);
        }
        return this._clientCache;
    }

    /**
     * Return a cached WbiSignGot. `createWbiSignGot` calls `requestNav`
     * internally to fetch wbi keys, so caching avoids redundant network
     * requests on every IPC call (loadCandidates, enrichRelation, …).
     */
    async wbiClient() {
        if (!this._wbiClientCache) {
            this._wbiClientCache = createWbiSignGot(await this.client());
        }
        return this._wbiClientCache;
    }

    // ── Config Management ──────────────────────────────────────────────

    async loadConfig(configPath?: string): Promise<Result<AppConfig, Error>> {
        if (configPath) {
            this.configStore = new ConfigStore(configPath);
        }
        return (await this.configStore.load()).match(
            config => {
                if (config.cookieJar) {
                    this.cookieJar = CookieJar.fromJSON(config.cookieJar);
                } else {
                    this.cookieJar = new CookieJar();
                }
                this.invalidateClients();
                return ok(config);
            },
            error => {
                this.cookieJar = new CookieJar();
                this.invalidateClients();
                return err(error);
            },
        );
    }

    // ── Login & Auth ───────────────────────────────────────────────────

    async checkLogin(): Promise<LoginStatus> {
        const client = await this.client();
        const navRes = await requestNav(client);
        const nav = navRes.data;
        if (nav.isLogin) {
            return {
                isLogin: true,
                user: {
                    uid: nav.mid ?? 0,
                    name: nav.uname ?? '',
                    avatar: nav.face ?? '',
                },
            };
        }
        return { isLogin: false };
    }

    private async notifyLoginState(): Promise<void> {
        const window = this.indexWindow();
        if (!window) return;
        this.createEventSender(window).onLogin(await this.checkLogin());
    }

    // ── Window Helpers ─────────────────────────────────────────────────

    private indexWindow(): BrowserWindow | undefined {
        return this.windowsManager.get('index');
    }

    private closeLoginWindow(): void {
        const loginWindow = this.windowsManager.get('login');
        if (loginWindow && !loginWindow.isDestroyed()) {
            loginWindow.close();
        }
    }

    createEventSender(window: BrowserWindow): NativeEventSender {
        return {
            onLogin: result => {
                LOGINFO('Sending login status to renderer:', result);
                window.webContents.send('onLogin', result);
            },
        };
    }

    // ── IPC Handlers: Config ───────────────────────────────────────────

    async getConfigPath(): Promise<Result<string, Error>> {
        return ok(path.resolve(this.configStore.getPath()));
    }

    async pickConfigPath(): Promise<Result<string | undefined, Error>> {
        try {
            const focusedWindow = BrowserWindow.getFocusedWindow() ?? this.indexWindow();
            const options: OpenDialogOptions = {
                title: '选择配置文件',
                properties: ['openFile'],
                filters: [{ name: 'JSON', extensions: ['json'] }],
            };

            const response = focusedWindow
                ? await dialog.showOpenDialog(focusedWindow, options)
                : await dialog.showOpenDialog(options);

            if (response.canceled || response.filePaths.length === 0) {
                return ok(undefined);
            }

            return ok(response.filePaths[0]);
        } catch (error) {
            return err(toError(error));
        }
    }

    async updateConfig(configPath: string): Promise<Result<string, Error>> {
        const loadResult = await this.loadConfig(configPath);
        return loadResult.match(
            async () => {
                await this.notifyLoginState();
                return ok(path.resolve(this.configStore.getPath()));
            },
            error => err(error),
        );
    }

    // ── IPC Handlers: Login ────────────────────────────────────────────

    async openLoginWindow(): Promise<Result<void, Error>> {
        try {
            const loginWindow = this.windowsManager.get('login');
            if (loginWindow && !loginWindow.isDestroyed()) {
                loginWindow.focus();
                return ok(undefined);
            }

            this.windowsManager.createLoginWindow();
            return ok(undefined);
        } catch (error) {
            return err(toError(error));
        }
    }

    async startQrLogin() {
        const client = await this.client();
        return requestQrCodeInfo(client);
    }

    async pollQrLoginStatus(qrCodeKey: string): Promise<Result<number, Error>> {
        const client = await this.client();
        const statusResult = await checkQrCodeStatus(client, qrCodeKey);

        return statusResult.match(
            async status => {
                if (status === QrCodeStatus.success) {
                    const saveConfigResult = await this.configStore.patch({
                        cookieJar: JSON.stringify(this.cookieJar.toJSON()),
                    });

                    if (saveConfigResult.isErr()) {
                        return err(saveConfigResult.error);
                    }

                    // Account changed — wbi keys may differ for the new user
                    this.invalidateWbiClient();
                    await this.notifyLoginState();
                    this.closeLoginWindow();
                }
                return ok(status);
            },
            error => err(error),
        );
    }

    async logout(): Promise<Result<void, Error>> {
        try {
            // Reset cookie jar to a fresh empty one
            this.cookieJar = new CookieJar();
            this.invalidateClients();

            // Persist: clear cookieJar in config file
            const patchResult = await this.configStore.patch({ cookieJar: null });
            if (patchResult.isErr()) {
                return err(patchResult.error);
            }

            // Notify renderer of the new (logged-out) state
            await this.notifyLoginState();
            return ok(undefined);
        } catch (error) {
            return err(toError(error));
        }
    }

    // ── IPC Handlers: Lottery ──────────────────────────────────────────

    async loadCandidates(
        oid: string,
        type: string,
        mode: string = '2',
    ): Promise<Result<Candidate[], Error>> {
        try {
            const client = await this.wbiClient();
            return await fetchCandidates(client, oid, type, mode);
        } catch (error) {
            return err(toError(error));
        }
    }

    async enrichRelation(uid: string): Promise<Result<LotteryRelation, Error>> {
        try {
            const client = await this.wbiClient();
            const result = await requestRelations(client, uid);
            if (result.isErr()) return err(result.error);
            return ok(mapRelation(result.value));
        } catch (error) {
            return err(toError(error));
        }
    }

    async draw(params: DrawParams): Promise<Result<DrawResult, Error>> {
        try {
            const { candidates, winnerCount } = params;
            const shuffled = shuffleCandidates(candidates);
            const winners = shuffled.slice(
                0,
                Math.min(Math.max(1, winnerCount), candidates.length),
            );
            return ok({ winners });
        } catch (error) {
            return err(toError(error));
        }
    }

    // ── IPC Handlers: Misc ─────────────────────────────────────────────

    async openExternal(url: string): Promise<Result<void, Error>> {
        try {
            await shell.openExternal(url);
            return ok(undefined);
        } catch (error) {
            return err(toError(error));
        }
    }
}

(() => {
    LOGINFO('App starting...');
    new Session();
})();
