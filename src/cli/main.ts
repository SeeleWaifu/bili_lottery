import { cac } from 'cac';
import qrcodeTerminal from 'qrcode-terminal';
import { CookieJar } from 'tough-cookie';
import * as readline from 'node:readline/promises';
import path from 'node:path';

import {
    createCookieJarGot,
    QrCodeStatus,
    requestQrCodeInfo,
    createWbiSignGot,
    checkQrCodeStatus,
} from '../bili/index.js';
import { ConfigStore } from '../app/config_store.js';
import { fetchCandidates, enrichRelations } from '../app/candidate_loader.js';
import {
    filterCandidates,
    shuffleCandidates,
    type Candidate,
    type FilterFlags,
    type LotteryRelation,
} from '../app/lottery.js';
import { ok, err, type Result } from 'neverthrow';
import { toError } from '../shared/error.js';

const cli = cac();

const DEFAULT_CONFIG_PATH = path.resolve('config.json');

function resolveConfigPath(inputPath?: string, mode: 'input' | 'output' = 'input'): string {
    if (inputPath && inputPath.trim().length > 0) {
        return path.resolve(inputPath.trim());
    }

    console.log(`No ${mode} config path provided, using default: ${DEFAULT_CONFIG_PATH}`);
    return DEFAULT_CONFIG_PATH;
}

async function login(options?: { outputConfigPath?: string; onputConfigPath?: string }) {
    const configPath = resolveConfigPath(
        options?.outputConfigPath ?? options?.onputConfigPath,
        'output',
    );
    const configStore = new ConfigStore(configPath);

    const bili = await createCookieJarGot(new CookieJar());
    const qrCodeResult = await requestQrCodeInfo(bili);
    if (qrCodeResult.isErr()) {
        console.error('Failed to initiate QR code login:\n', qrCodeResult.error);
        return;
    }
    const { url, qrCodeKey } = qrCodeResult.value;

    console.log('Please scan the QR code below with the Bilibili app:');
    qrcodeTerminal.generate(url, {
        small: true,
    });
    console.log(`If the QR code is not visible, open this URL directly: ${url}`);

    let checker = (status: Result<QrCodeStatus, Error>): boolean => {
        if (status.isErr()) {
            console.error('Error checking QR code status:', status.error);
            return true;
        }
        switch (status.value) {
            case QrCodeStatus.waiting:
                console.log('Waiting for QR code scan...');
                return true;
            case QrCodeStatus.scanned:
                console.log('QR code scanned, waiting for login confirmation...');
                return true;
            case QrCodeStatus.success:
                console.log('Login successful!');
                return false;
            case QrCodeStatus.expired:
                console.log('QR code expired.');
                return false;
            default:
                console.error('Unknown QR code status:', status.value);
                return false;
        }
    };

    while (checker(await checkQrCodeStatus(bili, qrCodeKey))) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    configStore.patch({ cookieJar: JSON.stringify(bili.getCookieJar().toJSON()) }).then(result => {
        if (result.isErr()) {
            console.error('Failed to save config:\n', result.error);
        } else {
            console.log('Config saved successfully.');
        }
    });
}

function parseYesNo(input: string, defaultValue = false): boolean {
    const normalized = input.trim().toLowerCase();
    if (!normalized) {
        return defaultValue;
    }
    return (
        normalized === 'y' || normalized === 'yes' || normalized === '1' || normalized === 'true'
    );
}

function parseRelationFilter(input: string): LotteryRelation | null {
    const normalized = input.trim().toLowerCase();

    switch (normalized) {
        case '0':
        case 'none':
            return 'none';
        case '1':
        case 'follow':
            return 'follow';
        case '2':
        case 'fan':
            return 'fan';
        case '3':
        case 'mutual':
            return 'mutual';
        default:
            return null;
    }
}

async function lottery(
    oid: string,
    type: string,
    mode: string,
    options?: { inputConfigPath?: string },
) {
    const configPath = resolveConfigPath(options?.inputConfigPath, 'input');
    const configStore = new ConfigStore(configPath);

    const configResult = await configStore.load();
    if (configResult.isErr()) {
        console.error('Failed to read config:', configResult.error);
        return;
    }
    if (!configResult.value.cookieJar) {
        console.error('No cookie jar found in config. Please login first.');
        return;
    }

    const cookieJar = CookieJar.fromJSON(JSON.parse(configResult.value.cookieJar));

    const bili = await createWbiSignGot(await createCookieJarGot(cookieJar));

    const fetchResult = await fetchCandidates(bili, oid, type, mode);
    if (fetchResult.isErr()) {
        console.error('Error fetching candidates:', fetchResult.error);
        return;
    }
    let candidates = fetchResult.value;

    console.log(`Loaded ${candidates.length} unique candidates.`);
    console.log('Please choose filters (press Enter to use defaults):');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const relationInput = await rl.question(
        'Relation filter 0=non, 1=follow, 2=fan, 3=mutual [default no-filter]: ',
    );
    const likedByUpInput = await rl.question('Keep only users liked by the UP? (y/N): ');
    const likedBySelfInput = await rl.question(
        'Keep only comments liked by the user themselves? (y/N): ',
    );

    const relationFilter: LotteryRelation | null = parseRelationFilter(relationInput);
    if (relationFilter != null) {
        candidates = await enrichRelations(bili, candidates);
    }

    const flags: FilterFlags = {
        relations: relationFilter != null ? [relationFilter] : [],
        likedByUp: parseYesNo(likedByUpInput, false),
        likedBySelf: parseYesNo(likedBySelfInput, false),
    };

    const { matched } = filterCandidates(candidates, flags);

    if (matched.length === 0) {
        console.log('No candidates matched the filter criteria.');
        rl.close();
        return;
    }
    console.log('Matched candidates:');
    matched.forEach(candidate => {
        console.log(`- ${candidate.uname} (UID: ${candidate.uid})`);
    });

    const result = shuffleCandidates(matched);

    const numWinnersInput = await rl.question(`Number of winners [default 1]: `);
    const numWinners = parseInt(numWinnersInput, 10) || 1;

    result.slice(0, numWinners).forEach(candidate => {
        console.log(
            `Congratulations to ${candidate.uname} (UID: ${candidate.uid}) for winning the lottery!`,
        );
    });

    rl.close();
}
cli.command('login', 'Login to Bilibili')
    .option('-o, --output-config-path <path>', 'Output config path')
    .option('--onput-config-path <path>', 'Output config path (compat typo alias)')
    .action(login);

cli.command('lottery <oid> <type> [mode]', 'Run the lottery')
    .option('-i, --input-config-path <path>', 'Input config path')
    .action(async (oid, type, mode, options) => {
        await lottery(oid, type, mode ?? '2', options);
    });

cli.version('0.1.0');
cli.help();
try {
    cli.parse();
} catch (e) {
    console.log(`${toError(e)}`);
    console.log('Use --help to see available commands and options.');
}
if (process.argv.length <= 2) {
    cli.outputHelp();
}
