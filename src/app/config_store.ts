import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';
import { SerializedCookieJar } from 'tough-cookie';
import { toError } from '../shared/error.js';

const AppConfigSchema = z.object({
    cookieJar: z.string().nullable(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export class ConfigStore {
    private filePath: string;

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    async load(): Promise<Result<AppConfig, Error>> {
        try {
            return ok(AppConfigSchema.parse(JSON.parse(await fs.readFile(this.filePath, 'utf-8'))));
        } catch (error) {
            return err(toError(error));
        }
    }

    async save(config: AppConfig): Promise<Result<void, Error>> {
        try {
            await fs.mkdir(path.dirname(this.filePath), { recursive: true });
            await fs.writeFile(
                this.filePath,
                JSON.stringify(AppConfigSchema.parse(config), null, 2),
                'utf-8',
            );
            return ok(undefined);
        } catch (error) {
            return err(toError(error));
        }
    }

    async patch(partial: Partial<AppConfig>): Promise<Result<AppConfig, Error>> {
        const current = (await this.load()).unwrapOr({ cookieJar: undefined });

        let merged = AppConfigSchema.parse({
            ...current,
            ...partial,
        });
        const writeResult = await this.save(merged);

        return writeResult.match(
            () => ok(merged),
            error => err(error),
        );
    }

    getPath(): string {
        return this.filePath;
    }
}
